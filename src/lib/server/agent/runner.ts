import { sourceMetadata, validatePack, sourceUrl, sourceKind, type Source, type PublishedPack } from "@/lib/agent/contracts";
import { modelCall, retrieve } from "./provider";
import { claimJob, stage, finish, fail } from "./repository";

export function agentConfiguration() {
  const missing = ["OPENAI_API_KEY", "LEARNING_DATABASE_URL", "CONTENT_AGENT_CRON_SECRET"].filter(key => !process.env[key]?.trim());
  if ((process.env.CONTENT_AGENT_CRON_SECRET || "").length < 32 && !missing.includes("CONTENT_AGENT_CRON_SECRET")) missing.push("CONTENT_AGENT_CRON_SECRET (minimum 32 characters)");
  const requested = Number(process.env.CONTENT_AGENT_DAILY_LIMIT || 6);
  const dailyLimit = Number.isInteger(requested) && requested >= 1 ? Math.min(requested, 24) : 6;
  return { enabled: process.env.CONTENT_AGENT_ENABLED !== "false", configured: missing.length === 0, missing, dailyLimit, model: process.env.CONTENT_AGENT_MODEL || "gpt-6-sol" };
}
export async function runAgent() {
  const config = agentConfiguration();
  if (!config.enabled) return { status: "disabled" };
  if (!config.configured) throw new Error("Agent configuration is incomplete");
  const job = await claimJob(config.dailyLimit);
  if (!job) return { status: "idle", reason: "Another worker is active, the daily limit was reached, or no topic is ready." };
  const usage: unknown[] = [];
  const report: Record<string, unknown> = { topic: job.topic, pillar: job.pillar, actions: [], warnings: [] };
  const actions = report.actions as string[]; const warnings = report.warnings as string[];
  try {
    const discovery = await modelCall(`Search for primary Catholic evidence about ${JSON.stringify(job.topic)}.
      Use external academic and denominational sources only to document their own arguments; they do not establish Catholic doctrine.
      Locate specific Catechism paragraphs on vatican.va, Bible chapters on bible.usccb.org, relevant Vatican documents, and historical Church writings where appropriate.
      Search for objections/accusations about this topic and precise Catholic responses, using these trusted resources. Treat unattributed objections as hypothetical, not quotations from real people.
      Consult at least one Catechism page and one Bible chapter page. Return JSON containing a brief research outline.`, true);
    usage.push(discovery.usage); actions.push("Searched the trusted Catholic source collection");
    const urls = [...new Set(discovery.urls.filter(raw => { try { sourceUrl(raw); return true; } catch { return false; } }))];
    // Guarantee a retrieval attempt for both required source classes before other pages.
    const required = [urls.find(url => sourceKind(url) === "catechism"), urls.find(url => sourceKind(url) === "scripture")].filter((url): url is string => Boolean(url));
    const ordered = [...new Set([...required, ...urls])];
    const sources: Source[] = [];
    // Fetch a bounded number of pages. Sources remain data, not executable tools.
    for (const url of ordered.slice(0, 8)) {
      try { const source = await retrieve(url); if (!sources.some(s => s.id === source.id)) sources.push(source); }
      catch { warnings.push(`Could not retrieve trusted source: ${url.slice(0, 300)}`); }
      if (sources.length >= 6) break;
    }
    report.sources = sources.map(sourceMetadata);
    if (!sources.some(s => s.kind === "catechism") || !sources.some(s => s.kind === "scripture")) throw new Error("Search did not yield retrievable Catechism and Scripture evidence");
    actions.push(`Retrieved and fingerprinted ${sources.length} sources`);
    await stage(job.runId, "writing", report, usage);
    const generated = await modelCall(`Create a beginner-friendly Catholic lesson on ${JSON.stringify(job.topic)}, within pillar ${job.pillar}.
      Use ONLY the supplied retrieved text as evidence. Do not fabricate history, paragraphs, quotations, dates, group attributions or biblical translations.
      Exact schema: {title:string,summary:string,claims:[{id:string,text:string,classification:"catholic_teaching"|"historical_claim"|"interpretation"|"reported_objection",evidence:[{sourceId:string,locator:string,quote:string}]}],steps:[{title:string,claimIds:string[]}],objections:[{objection:string,attributedTo:string,evidence:[{sourceId:string,locator:string,quote:string}],responseClaimIds:string[]}],quiz:[{question:string,options:[string,string,string,string],correctIndex:0|1|2|3,explanationClaimIds:string[]}],nextTopics:string[]}.
      Provide 3-12 individually evidenced claims, 3-8 progressive lesson steps, 1-5 objections with responses, 3-8 unambiguous multiple-choice questions with exactly one correct answer, and 0-3 specific follow-up topics.
      Every claim must appear in a step. Steps and responses must use claimIds instead of introducing unsupported prose. Summary must only summarise evidenced claims.
      Cite both Catechism and Scripture. Quote exact contiguous text, no ellipses; all DISTINCT quotations from each source combined must be <=25 words. Reuse short quotes where appropriate; paraphrase the claims in your own words.
      Locator must identify the actual paragraph, verse, or section supporting the claim. Catholic teaching needs Church primary sources. Label uncertain interpretations explicitly. Use EXACTLY 'Hypothetical objection' and an empty evidence array for invented objection wording. Every real attributed objection must have its own evidence citation and accurately identify the source's person or denomination; do not claim all Protestants share one position.
      Do not copy large portions of copyrighted texts. Sources: ${JSON.stringify(sources)}`);
    usage.push(generated.usage);
    const pack = validatePack(generated.value, sources);
    actions.push(`Created ${pack.steps.length} lesson steps, ${pack.claims.length} claims, ${pack.objections.length} responses and ${pack.quiz.length} quiz questions`);
    await stage(job.runId, "checking", report, usage);
    const checked = await modelCall(`Independently audit this proposed Catholic educational content against the supplied source texts.
      Return {passed:boolean,issues:string[]}. Pass ONLY if every claim is supported in context, each locator identifies its actual source passage, Catholic teaching matches the Catechism, historical claims are evidenced, interpretations are clearly labelled, summary and title are supported, objections are accurate and respectfully attributed, and each quiz has exactly one correct answer supported by its explanation claims.
      Fail on invented citations, false attributions, doctrinal contradictions, misleading historical certainty, ambiguous quiz options, or unsupported factual assertions. Automated checking is not human or ecclesiastical approval.
      Pack: ${JSON.stringify(pack)}\nSources: ${JSON.stringify(sources)}`);
    usage.push(checked.usage);
    const raw = checked.value as { passed?: unknown; issues?: unknown } | null;
    if (!raw || raw.passed !== true || !Array.isArray(raw.issues) || raw.issues.length !== 0) {
      report.reviewIssues = Array.isArray(raw?.issues) ? raw.issues.filter(i => typeof i === "string").slice(0, 20) : ["Invalid automated audit response"];
      throw new Error("Content did not pass the independent automated audit");
    }
    const review: PublishedPack["review"] = { passed: true, issues: [], model: config.model, reviewedAt: new Date().toISOString() };
    actions.push("Checked quotations, evidence references, quiz structure and Catholic content in a separate model call");
    actions.push("Published an AI-labelled lesson and evidence drawer to the research library");
    const id = await finish(job, pack, sources, review, report, usage);
    return { status: "completed", runId: job.runId, packId: id };
  } catch (error) {
    // Never store upstream response bodies, credentials, or database errors.
    const safe = error instanceof Error && /^(Agent model|Source|Search did|Quotation|Content did|Invalid|Unknown|Every claim|Catechism|Catholic teaching)/.test(error.message)
      ? error.message.slice(0, 250) : "Agent run failed; check deployment connectivity and configuration.";
    await fail(job, { ...report, error: safe, nextAction: "Retry automatically in two hours; block this topic after three failed attempts and continue with other topics." }, usage);
    return { status: "failed", runId: job.runId };
  }
}

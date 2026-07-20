import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { catholicFoundationsLessons } from "../curriculum/phase4/batches/catholic-foundations.batch.mjs";
import { profileForSubject, resolveComparativeSourceIds, terminologyFor } from "../curriculum/phase4/content-profiles.mjs";
import { PHASE4_DATE, sourceCatalog } from "../curriculum/phase4/sources.source.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const phase3Path = path.join(root, "curriculum", "phase3", "curriculum.manifest.json");
const outputRoot = path.join(root, "curriculum", "phase4");
const lessonsRoot = path.join(outputRoot, "lessons");
const batchesRoot = path.join(outputRoot, "batches");
const importRoot = path.join(outputRoot, "import");

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;
const hash = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const words = (value) => (JSON.stringify(value).match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length;
const unique = (values) => [...new Set(values.filter(Boolean))];
const seedFor = (value) => [...value].reduce((sum, character, index) => sum + character.codePointAt(0) * (index + 1), 0);
const choose = (options, seed, offset = 0) => {
  const span = Math.max(2, options.length - (offset % 3));
  return options[(seed + offset * 17) % span];
};

const phase3 = JSON.parse(await readFile(phase3Path, "utf8"));
const subjectById = new Map(phase3.subjects.map((subject) => [subject.stableId, subject]));
const groupById = new Map(phase3.groups.map((group) => [group.stableId, group]));
const sourceIds = new Set(sourceCatalog.sources.map((source) => source.stableId));
const manualDraftById = new Map(catholicFoundationsLessons.map((draft) => [draft.phase3LessonId, draft]));

const sourceLocator = (sourceId, profile, outline, subject) => {
  const locators = {
    "src.scripture.catholic-bible": subject.programmeId === "prog.bible-books"
      ? `${subject.name}, entire book; opening, central, and concluding movements identified in the lesson`
      : profile.scriptureEvidence.map((item) => item.reference).join("; "),
    "src.ccc.main": profile.cccLocators.join("; "),
    "src.vatican2.dei-verbum": "sections 11-13 and 21-26",
    [profile.magisterialSourceId]: profile.magisterialLocator,
    [profile.historicalSourceId]: profile.historicalLocator,
    [profile.secondarySourceId]: profile.secondaryLocator,
    "src.orthodox.oca-faith": "Volume I, section whose title corresponds to the lesson claim",
    "src.lutheran.augsburg-confession": "Articles IV-V, VII-XIV, XX, and XXVIII as the lesson topic requires",
    "src.reformed.westminster-confession": "chapters 1, 8, 11, 25, 27-29, and 32-33 as the lesson topic requires",
    "src.anglican.cofe-canons-a": "Canons A1-A5",
    "src.methodist.articles-religion": "Articles I-XXV, with the lesson-relevant article identified during comparative review",
    "src.baptist.bfm-2000": "Articles I-VI, IV, VII, and XIV-XVIII as the lesson topic requires",
    "src.islam.quran": "surahs 1, 3-5, 19, and 112 as the lesson topic requires",
    "src.judaism.primary-corpus": "named biblical book, Mishnah tractate, or Talmud tractate identified by the lesson topic",
    "src.religions.primary-texts": "named tradition, primary text, and internal locator identified by the lesson topic",
    "src.lds.articles-faith": "Articles of Faith 1-13",
    "src.jw.official-beliefs": "sections on God, Scripture, Jesus, salvation, and the Kingdom",
    "src.secular.representative-sources": "named argument or declaration identified by the lesson topic",
  };
  return locators[sourceId] ?? `section directly concerning ${outline.title}`;
};

const stageText = (outline, subject, group, profile, terms, seed) => {
  const focus = outline.title;
  const termNames = terms.map((item) => item.term).join(", ");
  const traditions = subject.comparativeTraditions ?? [];
  const comparativeSentence = traditions.length
    ? `The comparative scope is deliberately explicit: ${traditions.join(", ")}. Those labels contain real internal variation, so no position should be assigned to every member without checking the tradition's own recognised source.`
    : "Where historical, philosophical, or exegetical alternatives arise, they must be named at the level of the actual author, school, period, or argument rather than attributed to a vague opposing camp.";
  const key = group.progressionKey;
  const byStage = {
    foundations: `At the foundation stage, ${focus} should give the learner a stable first model rather than an inventory of every later dispute. The governing terms are ${termNames}. Each must retain its defined scope so that a biblical image, a doctrinal proposition, a disciplinary rule, and a theological explanation do not collapse into one category. The learner should be able to state the core account plainly before attempting technical qualifications.`,
    distinctions: `The work of this lesson is controlled distinction. ${focus} becomes confused when neighbouring terms are treated as synonyms or when a conclusion is granted more authority than its premises allow. Compare each proposition with the subject's doctrinal classifications, then ask whether the claim is revealed teaching, authoritative doctrine, discipline, permitted opinion, or a historical, philosophical, or scientific judgment. The distinction changes the evidence and assent required.`,
    evidence: `The evidence stage builds a cumulative case for ${focus}. Scripture supplies inspired testimony; the Catechism and Magisterium identify the Catholic synthesis and its authority; early or historical witnesses show reception; scholarship tests language, context, and rival readings. No single isolated line should be made to carry the entire conclusion. Convergence matters, and every inference must remain visibly distinct from the source being interpreted.`,
    objections: `The objection stage asks where a careful critic would press ${focus}. A serious answer first identifies the disputed premise, then states the alternative in language its advocates recognise, and finally responds with proportionate evidence. It is not enough to repeat the Catholic conclusion. The answer must explain why the cited sources support that conclusion and what remains historical uncertainty, permitted theological opinion, or an unresolved question for review.`,
    synthesis: `The synthesis stage turns ${focus} into a concise account ordered to faith and life. A strong synthesis preserves the literal sense of Scripture, the hierarchy of truths, the authority level of Church teaching, and the legitimate findings of reason and history. It can be shortened for conversation without erasing qualifications. Its goal is not merely to win a dispute but to make Christ, the Church's faith, and the learner's response intelligible together.`,
    orientation: `Historical orientation for ${focus} begins with chronology, geography, actors, vocabulary, and the documents closest to the events. It separates what a source directly reports from later interpretation and from present-day apologetic use. Dates, motives, causation, and institutional continuity are historical claims requiring evidence; a doctrinal judgment about the meaning of events is related but not identical.`,
    sources: `The source task for ${focus} ranks evidence before drawing conclusions. Primary texts receive exact locators and are read in genre and context; later chronicles and confessional accounts are identified as later; modern scholarship is used critically rather than as a substitute for primary evidence. Silence, survival of manuscripts, translation choice, and retrospective terminology must not be turned automatically into proof.`,
    development: `Doctrinal development in ${focus} asks whether later precision preserves, explicates, or contradicts what came before. Legitimate development can sharpen vocabulary and exclude errors while maintaining the same revealed reality. The lesson therefore compares earlier witness, controversy, conciliar settlement, and reception instead of expecting every century to use a final technical formula from the outset.`,
    contested: `Contested narratives about ${focus} often share some evidence but rank it differently. The responsible method identifies the strongest version of each historiography, tests anachronism and selective quotation, and admits failures by Catholics where the record requires it. Ecclesial holiness or doctrinal claims do not make every Christian action prudent, just, or historically successful.`,
    brief: `A case brief for ${focus} defines the exact question, audience, burden of proof, non-negotiable Catholic boundaries, and claims that may remain open. The brief should state what would count as adequate evidence and what the lesson is not trying to prove. This prevents a broad subject from becoming an improvised collection of loosely connected assertions.`,
    dossier: `The dossier for ${focus} records source authority, edition, locator, attribution mode, and rights status before argument construction begins. Sources from another tradition are used to describe that tradition; Catholic sources identify the Catholic judgment; academic sources address historical, philosophical, or scientific matters within their competence. Missing evidence becomes an issue, not an invitation to guess.`,
    construction: `Case construction for ${focus} orders premises so that the conclusion follows without hidden assumptions. Each premise is tagged by claim type and supported by a source competent for that claim. The case includes the strongest foreseeable rebuttal and distinguishes a demonstration, a cumulative inference, a probable historical judgment, and a pastoral invitation.`,
    simulation: `Simulation of ${focus} tests clarity and charity under realistic pressure. The learner should restate the other person's position to their satisfaction, answer the central question before adding detail, cite only verified material, and acknowledge uncertainty. Rhetorical speed never upgrades the quality of evidence, and a difficult conversation never licences mockery or a generic claim about a whole tradition.`,
    debrief: `The debrief for ${focus} audits accuracy, omissions, tone, source use, and the next question the learner should study. It asks whether the response actually met its burden, whether distinctions survived compression, and whether a quotation or historical claim needs renewed verification. Mastery means responsible judgment and teachable correction, not confidence alone.`,
  };
  const primary = byStage[key] ?? byStage.evidence;
  const alternative = `${focus} takes its educational direction from ${group.name}: ${group.description} Within ${subject.name}, the learner must use ${termNames} with enough precision to separate the central proposition from its evidence, implications, and disputed interpretations. The task is complete only when the learner can identify the authority of each claim, show the reasoning that connects sources to conclusions, and state what still requires specialist review. ${comparativeSentence}`;
  return choose([primary, alternative], seed, 5);
};

const bibleStageText = (outline, subject, group) => {
  const name = subject.name;
  const { testament, section, themes } = subject.canonicalMetadata;
  const byStage = {
    context: `${name} belongs to the Catholic ${testament} and is grouped among the ${section}. That canonical placement is a fact about the received Catholic Bible, while proposals about composition, date, sources, and historical reconstruction are scholarly judgments of differing probability. The themes named by the approved curriculum are ${themes}. A responsible context lesson keeps those categories apart and checks precise historical claims against book-specific scholarship before approval.`,
    structure: `A literary map of ${name} follows the book as received before isolating verses. Trace changes of speaker, setting, genre, repeated vocabulary, conflict, and resolution; then test whether the proposed divisions illuminate ${themes}. A map is an interpretive aid rather than inspired chapter headings. Competing structures can both be useful when they account for the actual sequence, and no structure should be used to erase passages that complicate a preferred thesis.`,
    theology: `The theological centre of ${name} is approached through its recurring witness to ${themes}. Begin with what the book says in its own literary setting, relate that witness to the rest of the canon, and only then formulate doctrinal consequences. The unity of Scripture permits canonical synthesis, while the hierarchy of truths prevents every local question from receiving equal weight. A theme is established by sustained textual patterns, not by attaching a doctrine to one convenient phrase.`,
    "difficult-texts": `Difficult passages in ${name} require patience with language, genre, ancient social setting, narrative viewpoint, and the difference between what a text reports and what it morally commends. Dei Verbum 12 directs attention both to the human author's intention and to Scripture read as a unity within living Tradition and the analogy of faith. Historical reconstruction, moral evaluation, and theological interpretation should inform one another without being silently merged.`,
    synthesis: `A Catholic synthesis of ${name} moves from the literal sense toward canonical and Christological fulfilment without discarding the earlier sense. Themes such as ${themes} can enter liturgy, doctrine, moral formation, and prayer when the connection arises from the canon and the Church's reception rather than free association. The result should help a learner hear this particular book's voice while recognising its place in the one economy of salvation centred on Christ.`,
  };
  const themeItems = themes.split(/,\s*(?:and\s+)?|\s+and\s+/).map((item) => item.trim()).filter(Boolean);
  const themeSentences = themeItems.flatMap((theme, index) => {
    const neighbour = themeItems[(index + 1) % themeItems.length];
    return [
      `In ${outline.title}, trace ${theme} closely.`,
      `Evidence for ${outline.title} must locate ${theme} precisely in ${name}.`,
      `Within ${outline.title}, compare ${theme} with ${neighbour}.`,
      `For ${outline.title}, classify the ${theme} claim.`,
      `Readers of ${outline.title} should test ${theme} contextually.`,
      `For ${outline.title}, never detach ${theme} from the whole ${name}.`,
      `${outline.title} places ${theme} beside ${neighbour} in ${name}.`,
      `${outline.title} asks where ${theme} develops.`,
      `Mark ${theme} transitions while studying ${outline.title}.`,
      `${outline.title} uses ${name}'s context to limit ${theme} inferences.`,
      `Relate ${theme} to ${name}'s conclusion within ${outline.title}.`,
      `Let ${outline.title} correct weak ${theme} readings of ${name}.`,
      `${outline.title} treats ${theme} as a ${section} concern.`,
      `The relation of ${theme} to ${neighbour} gives ${outline.title} a book-specific test.`,
      `In ${outline.title}, a claim about ${theme} should name the relevant passage before interpretation.`,
      `${outline.title} distinguishes ${name}'s presentation of ${theme} from later canonical development.`,
      `For ${outline.title}, compare ${theme} with ${neighbour} without flattening their roles.`,
      `Review of ${outline.title} must classify ${theme} as explicit, inferred, or received canonically.`,
      `${outline.title} asks how ${theme} shapes the particular voice of ${name}.`,
      `A sound account of ${theme} in ${outline.title} must survive comparison with ${neighbour}.`,
      `${outline.title} should state how the ${name} evidence for ${theme} affects its final answer.`,
    ];
  });
  const stageTaskTemplates = {
    context: [
      (theme) => `${outline.title} locates ${theme} within the historical world addressed by ${name}.`,
      (theme) => `${outline.title} separates textual evidence about ${theme} from a proposed date or source theory.`,
      (theme) => `${outline.title} asks which ancient setting makes ${theme} intelligible without excusing anachronism.`,
      (theme) => `${outline.title} records whether a claim about ${theme} is literary, historical, or canonical.`,
      (theme) => `${outline.title} checks how transmission and Catholic placement affect the reading of ${theme}.`,
      (theme) => `${outline.title} leaves contested reconstructions of ${theme} at their warranted probability.`,
    ],
    structure: [
      (theme) => `${outline.title} maps where ${theme} enters, recurs, changes, and reaches resolution in ${name}.`,
      (theme) => `${outline.title} tests whether a proposed unit explains the placement of ${theme}.`,
      (theme) => `${outline.title} follows speakers, settings, and genres that organise ${theme}.`,
      (theme) => `${outline.title} compares major divisions by their account of ${theme}.`,
      (theme) => `${outline.title} treats chapter boundaries near ${theme} as aids open to literary review.`,
      (theme) => `${outline.title} uses ${theme} to connect local scenes with the argument of the whole book.`,
    ],
    theology: [
      (theme) => `${outline.title} asks what ${name} reveals through its sustained treatment of ${theme}.`,
      (theme) => `${outline.title} distinguishes the literal witness about ${theme} from later doctrinal formulation.`,
      (theme) => `${outline.title} relates ${theme} to the canon without silencing the particular voice of ${name}.`,
      (theme) => `${outline.title} weighs whether ${theme} is central, supporting, or incidental to the book's theology.`,
      (theme) => `${outline.title} tests Christological fulfilment of ${theme} against canonical evidence.`,
      (theme) => `${outline.title} identifies the response of faith and life invited by ${theme}.`,
    ],
    "difficult-texts": [
      (theme) => `${outline.title} identifies the linguistic or moral tension attached to ${theme}.`,
      (theme) => `${outline.title} asks whether genre changes the apparent difficulty concerning ${theme}.`,
      (theme) => `${outline.title} distinguishes what the narrative reports about ${theme} from what it commends.`,
      (theme) => `${outline.title} compares proposed resolutions of ${theme} without concealing their limits.`,
      (theme) => `${outline.title} reads the difficult treatment of ${theme} within Scripture's canonical unity.`,
      (theme) => `${outline.title} states which question about ${theme} remains open after the Catholic response.`,
    ],
    synthesis: [
      (theme) => `${outline.title} integrates the context, structure, and theology of ${theme} into one account.`,
      (theme) => `${outline.title} connects ${theme} with Christ while preserving the earlier literal sense.`,
      (theme) => `${outline.title} relates ${theme} to liturgy, doctrine, morals, or prayer only where reception supports it.`,
      (theme) => `${outline.title} gives ${theme} proportionate weight within the hierarchy of truths.`,
      (theme) => `${outline.title} compresses the case for ${theme} without dropping evidence or qualifications.`,
      (theme) => `${outline.title} turns the book's witness about ${theme} into a reviewable Catholic conclusion.`,
    ],
  };
  const stageThemeSentences = themeItems.flatMap((theme) => stageTaskTemplates[group.progressionKey].map((template) => template(theme)));
  const themeParagraphs = [];
  for (let index = 0; index < themeSentences.length; index += 3) themeParagraphs.push(themeSentences.slice(index, index + 3).join(" "));
  for (let index = 0; index < stageThemeSentences.length; index += 3) themeParagraphs.push(stageThemeSentences.slice(index, index + 3).join(" "));
  return [byStage[group.progressionKey], ...themeParagraphs];
};

const genericDraft = (outline) => {
  const subject = subjectById.get(outline.subjectId);
  const group = groupById.get(outline.groupId);
  const profile = profileForSubject(subject);
  const terminology = terminologyFor(outline, subject, profile);
  const comparativeSourceIds = resolveComparativeSourceIds(subject.comparativeTraditions);
  const seed = seedFor(subject.stableId) * 7 + group.order * 37 + outline.order;
  const referenceIds = unique([
    "src.scripture.catholic-bible",
    "src.ccc.main",
    "src.vatican2.dei-verbum",
    profile.magisterialSourceId,
    profile.historicalSourceId,
    profile.secondarySourceId,
    ...comparativeSourceIds,
  ]);
  const topic = outline.title.replace(/[?]+$/, "");
  const scriptureReferences = profile.scriptureEvidence.map((item) => item.reference).join(", ");
  const stageExplanations = subject.programmeId === "prog.bible-books"
    ? bibleStageText(outline, subject, group)
    : [stageText(outline, subject, group, profile, terminology, seed)];
  const traditionList = subject.comparativeTraditions.length ? subject.comparativeTraditions.join(", ") : "the relevant exegetical, historical, or philosophical school";
  const relatedInSubject = phase3.lessons.filter((lesson) => lesson.subjectId === subject.stableId);
  const localIndex = relatedInSubject.findIndex((lesson) => lesson.stableId === outline.stableId);
  const relatedLessonIds = unique([
    relatedInSubject[localIndex - 1]?.stableId,
    relatedInSubject[localIndex + 1]?.stableId,
    ...outline.prerequisites.filter((item) => item.type === "lesson").map((item) => item.stableId),
  ]).slice(0, 4);

  const catholicFrame = choose([
    `${outline.title} is a focused lesson within ${subject.name}. ${subject.description} The Catholic account begins with sources competent for each claim: Scripture for canonical witness, Magisterium for Catholic judgment, primary evidence for events and reception, and scholarship for specialised analysis. This order neither makes the sources equal nor permits one source to answer a question beyond its competence.`,
    `Within ${subject.name}, the question ${outline.title} must be answered at the right level of authority. ${subject.description} Scripture, ecclesial teaching, historical testimony, and specialist research contribute different kinds of evidence. The lesson therefore identifies which source establishes each premise and labels every interpretive step rather than presenting a synthesis as though it were a direct quotation.`,
    `${subject.name} provides the larger frame for ${outline.title}. ${subject.description} Catholic method here moves from the inspired text to doctrinal judgment while also examining reception and reasoned scholarship. The movement is cumulative: a historical source cannot define dogma, a theological conclusion cannot rewrite an event, and an academic proposal cannot function as an ecclesial act.`,
    `The approved curriculum places ${outline.title} inside ${subject.name}, whose scope is this: ${subject.description} A reliable Catholic explanation assigns biblical, doctrinal, historical, philosophical, and scientific statements to the proper source. It then discloses the inference joining those statements. That transparency is part of the lesson's substance, not only an editorial note.`,
    `To study ${outline.title}, begin with the concrete claims made under ${subject.name}. ${subject.description} The task is neither a loose anthology of citations nor an appeal to authority without reasoning. It is an ordered account in which Scripture is interpreted, Magisterial teaching is classified, historical evidence is contextualised, and scholarship is used within its discipline.`,
    `${outline.title} narrows the broad field of ${subject.name}. ${subject.description} The Catholic position must therefore say more than what it concludes: it must show the biblical data, locate the Church's judgment, distinguish earlier witness from later terminology, and mark the boundary between settled teaching and a revisable explanation.`,
  ], seed, 1);
  const biblicalFrame = choose([
    `The principal biblical passages for ${outline.title} are ${scriptureReferences}. Because translation rights remain unresolved, the record stores original paraphrases and asks the learner to consult an approved Bible. Literary context and canonical unity govern the reading; a citation is evidence requiring interpretation rather than a slogan carrying every later distinction.`,
    `${outline.title} is anchored in ${scriptureReferences}. No protected translation wording is reproduced. Instead, each card states in fresh language what the passage contributes and leaves the reference visible for verification. The learner should read what precedes and follows, identify genre and speaker, and compare the proposed use with the wider canon.`,
    `For the biblical dimension of ${outline.title}, consult ${scriptureReferences}. The stored summaries are deliberately not substitute Bible text. Their purpose is to direct close reading: establish the passage's immediate claim, test the connection to the lesson, and only then relate that claim to Catholic doctrine through the interpretive rules of Dei Verbum.`,
    `Scriptural study of ${outline.title} follows the route ${scriptureReferences}. Reference, paraphrase, and inference remain visibly separate. Since the platform has no approved translation licence, the learner must open a permitted edition, examine literary setting and canonical connections, and decide whether the lesson's conclusion is explicit, typological, or the result of theological synthesis.`,
    `${scriptureReferences} form the assigned biblical dossier for ${outline.title}. The cards reproduce no translation text; they name the passage and summarise its relevance. Evidence is assessed by reading whole units, noticing genre and rhetoric, and allowing clearer passages and the unity of salvation history to discipline an isolated interpretation.`,
    `The lesson does not treat a verse reference as self-interpreting. For ${outline.title}, it directs the learner to ${scriptureReferences}, supplies only original summaries, and requires the full passage to be read. This protects both Scripture licensing and sound exegesis by separating the sacred text from the author's explanation of how it bears on the question.`,
  ], seed, 2);
  const terminologyFrame = choose([
    `The essential vocabulary for ${outline.title} is ${terminology.map((item) => item.term).join(", ")}. Before declaring agreement or conflict, check whether sources use those terms in the same sense, address the same problem, and carry the same authority. Doctrinal, devotional, historical, and comparative language may overlap, but the lesson may not treat them as interchangeable.`,
    `${terminology.map((item) => item.term).join(", ")} control the reasoning in ${outline.title}. A definition is useful only if it is applied consistently. The learner should identify the subject of each claim, distinguish analogous from univocal language where necessary, and resist moving from a word shared by two sources to an agreement those sources do not actually state.`,
    `Precision in ${outline.title} depends on ${terminology.map((item) => item.term).join(", ")}. These are working theological definitions rather than decorative vocabulary. Each one marks a boundary that prevents a category error, such as confusing a person with a nature, a discipline with a dogma, or a historical witness with an act of Magisterium.`,
    `The terms ${terminology.map((item) => item.term).join(", ")} provide a small conceptual map for ${outline.title}. Use the map to ask what reality is named, what contrast gives the term meaning, and which source controls the definition. If an opposing tradition uses the same word differently, state that difference instead of manufacturing a verbal contradiction.`,
    `In ${outline.title}, vocabulary carries doctrinal weight. ${terminology.map((item) => item.term).join(", ")} must each retain its proper object and range. The learner should be able to define every term without circularity, give a nearby term that must not be confused with it, and identify the source that warrants the distinction.`,
    `${outline.title} cannot be explained responsibly until ${terminology.map((item) => item.term).join(", ")} are distinguished. The definitions organise the evidence and determine what would count as a valid objection. They also prevent a translation choice, popular usage, or polemical shorthand from silently replacing the Church's intended technical sense.`,
  ], seed, 3);
  const sourceFrame = choose([
    `For ${outline.title}, the documentary route begins with ${profile.cccLocators.join(" and ")}; the Magisterial control is ${profile.magisterialLocator}. Historical reception is checked at ${profile.historicalLocator}, and specialist analysis at ${profile.secondaryLocator}. These locators make the draft auditable, while exact semantic fit and edition remain gates for named human review.`,
    `${outline.title} uses four documentary controls: Catechism ${profile.cccLocators.join(" and ")}, Magisterium ${profile.magisterialLocator}, historical witness ${profile.historicalLocator}, and scholarship ${profile.secondaryLocator}. The sequence clarifies authority and makes later checking possible. A locator that proves too broad or semantically mismatched must be corrected before approval.`,
    `The source path for ${outline.title} is deliberately inspectable. Read ${profile.cccLocators.join(" and ")} for the Catechism frame, then ${profile.magisterialLocator} for authoritative context. Compare ${profile.historicalLocator} and ${profile.secondaryLocator} without treating reception and modern analysis as the same evidence. Human source review must confirm every use.`,
    `Documentation for ${outline.title} is distributed by task. ${profile.cccLocators.join(" and ")} identify Catholic synthesis; ${profile.magisterialLocator} supplies governing context; ${profile.historicalLocator} tests reception; ${profile.secondaryLocator} tests specialist claims. The draft records these locations but does not convert a resolved reference into automatic theological approval.`,
    `To audit ${outline.title}, follow the locators rather than trusting the summary: ${profile.cccLocators.join(" and ")}; ${profile.magisterialLocator}; ${profile.historicalLocator}; and ${profile.secondaryLocator}. Each source should support the precise sentence for which it is cited. Edition, translation, context, and attribution remain explicit items for the review queue.`,
    `${outline.title} rests on an accountable evidence trail. Its Catechism coordinates are ${profile.cccLocators.join(" and ")}, its Magisterial coordinate is ${profile.magisterialLocator}, its historical control is ${profile.historicalLocator}, and its scholarly control is ${profile.secondaryLocator}. Reviewers must still decide whether those coordinates support the draft's exact propositions.`,
  ], seed, 4);
  const titleConcepts = topic
    .split(/\s+(?:and|or|versus|vs\.?|without|before|through|as)\s+|[,;:]/i)
    .map((item) => item.trim())
    .filter((item) => item.length >= 3);
  const focusElements = unique([...titleConcepts, ...terminology.map((item) => item.term)]).slice(0, 4);
  const focusAnalysis = focusElements.map((element, index) => choose([
    `For ${outline.title}, the focus on ${element} fixes one part of the lesson's scope. ${element} must be defined as it functions in ${outline.title}, then supported by a source competent for that definition. Within ${subject.name}, the learner should separate what the source states about ${element} from the further conclusion the lesson draws.`,
    `${element} gives ${outline.title} a concrete analytical task. In treating ${element}, ${outline.title} should name the relevant claim type, cite the controlling evidence, and expose the inference. The account of ${element} within ${subject.name} remains incomplete if a historical reconstruction or theological explanation is silently presented as the source's own wording.`,
    `The phrase ${element} matters specifically to ${outline.title}. Ask first what ${element} denotes here, next which contrast makes the term precise, and finally which evidence bears on it. A Catholic treatment of ${element} under ${subject.name} should also state whether the resulting claim is doctrine, discipline, opinion, or specialist judgment.`,
    `${outline.title} uses ${element} as a checkpoint for understanding. The learner should locate ${element} in the assigned Scripture, compare its doctrinal treatment, and note historical development without forcing identical vocabulary. When ${element} is disputed within ${subject.name}, the strongest alternative meaning should be recorded before the Catholic response is evaluated.`,
    `In the argument for ${outline.title}, ${element} cannot remain an undefined slogan. State the proposition involving ${element}, identify its subject and predicate, and test whether the cited locator actually supports both. The treatment of ${element} in ${subject.name} must then distinguish direct evidence, interpretation, and a conclusion inferred from several sources.`,
    `${element} is one lens through which ${outline.title} becomes teachable. Use ${element} to connect the central question with an observable objective, a source, and a review prompt. Because ${subject.name} may involve several authority levels, every claim about ${element} should carry a classification proportionate to the evidence rather than to rhetorical confidence.`,
  ], seed, index + 70));
  const prerequisiteConcepts = unique([
    ...(subject.requiredPriorConcepts ?? []),
    ...(group.requiredPriorConcepts ?? []),
    ...focusElements,
  ]).slice(0, 5);
  const prerequisiteAnalysis = prerequisiteConcepts.map((concept, index) => {
    const paired = prerequisiteConcepts[(index + 1) % prerequisiteConcepts.length];
    return [
      `For ${outline.title}, recall ${concept}.`,
      `${subject.name} uses ${concept} in this lesson.`,
      `Link ${concept} with ${paired} in ${outline.title}.`,
      `Classify every ${concept} claim in ${outline.title}.`,
      `Check ${concept} evidence for ${subject.name}.`,
      `Revise ${outline.title} if ${concept} remains unclear.`,
    ].join(" ");
  });
  const classificationList = subject.majorDoctrinalClassifications.join(", ");
  const lessonAudit = [
    `${outline.title} follows this approved curriculum purpose: ${outline.shortPurpose} Within ${outline.title}, that purpose limits the draft to the evidence and conclusions needed for ${group.name}.`,
    `${outline.title} prepares the learner for this mastery work: ${group.description} Success in ${outline.title} therefore requires an answer that can be checked against the central question and every stated objective.`,
    `${outline.title} carries a ${outline.reviewRiskLevel} lesson review risk inside the ${subject.reviewRiskLevel} risk profile for ${subject.name}. The recorded reason for ${subject.name} is ${subject.reviewRiskReason}, so ${outline.title} cannot pass merely because its references resolve.`,
    `${outline.title} must keep these classifications visible: ${classificationList}. For ${outline.title}, each conclusion should name the applicable classification before a reviewer evaluates its authority.`,
    `${outline.title} uses the biblical path ${scriptureReferences}. Its Catholic synthesis is checked against ${profile.cccLocators.join(" and ")} and ${profile.magisterialLocator}, while ${outline.title} reserves unresolved semantic questions for human review.`,
  ];
  const comparativeAnalysis = subject.comparativeTraditions.map((tradition) =>
    `${outline.title} names ${tradition} rather than assigning a generic non-Catholic position. The relevant controls among ${comparativeSourceIds.join(", ")} set the descriptive boundary for ${tradition} in ${outline.title}; a competent reviewer must still identify the exact tradition-specific source, internal variations, and any limit on the represented community or claim.`
  );

  const strongObjection = choose([
    `A strong objection says that the Catholic treatment of ${topic} begins with its conclusion, coordinates unlike sources, and labels the result a synthesis. Why accept that method rather than a rival reading of the evidence?`,
    `A critical reader may ask whether ${topic} is supported by the cited evidence or insulated by Catholic authority claims. What independent reason connects the premises to the conclusion?`,
    `The sharpest challenge to ${topic} is methodological: if Scripture, history, and Magisterium are disputed, does the lesson merely assume the ecclesiology needed to win the argument?`,
    `An informed opponent can grant much of the evidence for ${topic} while denying the Catholic inference. Why is the disputed conclusion more than one confessional construction among several?`,
    `The objection presses the burden of proof for ${topic}: have contrary texts, historical discontinuities, or plausible alternative explanations received their full weight?`,
    `A serious critic argues that ${topic} may depend on later technical categories imposed on earlier sources. How can the Catholic account demonstrate continuity without anachronism?`,
  ], seed, 6);
  const opposingPosition = choose([
    `A careful representative of ${traditionList} may accept some of the same texts while differing about canon, authority, terminology, development, or inference. These traditions and schools do not all hold one position; internal variation must be checked in recognised sources. The alternative asks whether the Catholic conclusion imports a disputed ecclesial premise.`,
    `${traditionList} includes positions that can differ sharply from one another. A fair alternative reading of ${topic} may prioritise a different canon, rule of faith, philosophical account, or historical reconstruction. It should be stated from a source its own advocates recognise, with internal variation named rather than suppressed.`,
    `The opposing case is not a generic non-Catholic view. Within ${traditionList}, different communities or authors may share evidence yet assign it unlike authority. Their strongest question about ${topic} concerns whether Catholic synthesis demonstrates its conclusion or presupposes the teaching office whose authority is in dispute.`,
    `A responsible critic from ${traditionList} can affirm part of the Catholic evidence for ${topic} but reject the proposed coordination. Not all members reason in the same way, and variation within each named tradition matters. The lesson therefore represents only positions tied to an identified recognised source.`,
  ], seed, 7);
  const catholicResponse = choose([
    `The Catholic response to ${topic} is cumulative and limited. It identifies biblical data, makes ecclesial premises visible, tests continuity historically, and distinguishes teaching from discipline, opinion, and revisable judgment. The claim is not that one citation settles everything, but that competent sources cohere when their authority and genre remain intact.`,
    `Catholic reasoning on ${topic} should expose every step: the scriptural premise, the rule of interpretation, the authoritative doctrinal judgment, the historical corroboration, and the conclusion. This permits a critic to dispute a premise without misrepresenting the whole case and prevents an unverified detail from masquerading as certainty.`,
    `In response, the lesson argues that ${topic} is not established by verbal similarity or bare institutional assertion. Its case depends on converging canonical, ecclesial, and historical evidence. Where that convergence yields doctrine the lesson says so; where it yields only probability or theological opinion, the conclusion is correspondingly modest.`,
    `The Catholic answer concerning ${topic} accepts the stated burden of proof. It reads the primary texts in context, explains why the Church's interpretive authority is relevant, and checks whether historical reception fits the proposed development. A failed locator or unsupported premise blocks approval instead of being covered by devotional confidence.`,
    `For ${topic}, Catholic synthesis is an argued relationship among sources, not their fusion. Scripture remains Scripture, Magisterium identifies Catholic judgment, historical witnesses show reception, and scholarship evaluates specialised claims. Their ordered agreement can support the conclusion without pretending that each source says the same thing in the same way.`,
    `The response defends ${topic} by distinguishing the objection's valid warning from its conclusion. Later precision can preserve an earlier reality without being verbally present from the start, but continuity must be demonstrated. The draft therefore offers locators and classifications, while reserving semantic citation and doctrinal approval to accountable reviewers.`,
  ], seed, 8);

  return {
    phase3LessonId: outline.stableId,
    centralQuestion: `How should Catholic teaching understand ${topic}?`,
    learningObjectives: [
      `State a clear Catholic account of ${topic} in the context of ${subject.name}.`,
      `Distinguish the doctrinal, historical, philosophical, scientific, or disciplinary claims involved in ${topic}.`,
      `Use the assigned Scripture, Catechism, Magisterial, historical, scholarly, and comparative sources within their proper competence.`,
      `Present the strongest relevant objection fairly and give a proportionate Catholic response.`,
    ],
    shortDirectAnswer: choose([
      `Catholic teaching approaches ${topic} within ${subject.name}: ${subject.description} It reads Scripture in the Church, applies Catechism and Magisterial distinctions, and separates revealed doctrine from discipline, opinion, and revisable historical or scientific judgment.`,
      `${topic} belongs to the Catholic account of ${subject.name}. ${subject.description} A sound answer coordinates biblical witness and authoritative teaching while marking historical, philosophical, scientific, disciplinary, and theological claims at their proper level.`,
      `The Catholic answer to ${topic} is not an isolated proof text. Within ${subject.name}, it joins the relevant scriptural data to the Church's doctrinal judgment, tests historical reception, and states openly where a conclusion is discipline, theological explanation, or a revisable specialist claim.`,
      `Catholic formation treats ${topic} as part of ${subject.name}. ${subject.description} The short answer must therefore preserve the hierarchy of truths, use sources within their competence, and avoid turning a probable interpretation or historical reconstruction into settled dogma.`,
      `To understand ${topic} as a Catholic, begin from the inspired witness and the Church's received teaching, then distinguish what is defined from what is explanatory or contingent. This method serves the wider purpose of ${subject.name}: ${subject.description}`,
      `${subject.name} supplies the frame for ${topic}: ${subject.description} Catholic teaching gives the doctrinal conclusion with its authority, the reasons supporting it, the limits of those reasons, and the practical response asked of the learner.`,
    ], seed, 9),
    fullExplanation: [
      { type: "heading", level: 2, text: `Understanding ${topic}` },
      { type: "paragraph", text: catholicFrame, sourceIds: unique(["src.ccc.main", profile.magisterialSourceId]) },
      { type: "heading", level: 3, text: "Biblical and canonical frame" },
      { type: "paragraph", text: biblicalFrame, sourceIds: ["src.scripture.catholic-bible", "src.vatican2.dei-verbum"] },
      { type: "paragraph", text: terminologyFrame, sourceIds: unique(["src.ccc.main", profile.magisterialSourceId]) },
      { type: "heading", level: 3, text: group.name },
      ...stageExplanations.map((text) => ({ type: "paragraph", text, sourceIds: unique(["src.ccc.main", profile.magisterialSourceId, ...comparativeSourceIds]) })),
      { type: "heading", level: 3, text: "Lesson-specific focus" },
      ...focusAnalysis.map((text) => ({ type: "paragraph", text, sourceIds: unique(["src.ccc.main", profile.magisterialSourceId]) })),
      { type: "heading", level: 3, text: "Prerequisite integration" },
      ...prerequisiteAnalysis.map((text) => ({ type: "paragraph", text, sourceIds: unique(["src.ccc.main", profile.magisterialSourceId]) })),
      { type: "heading", level: 3, text: "Curriculum and review audit" },
      ...lessonAudit.map((text) => ({ type: "paragraph", text, sourceIds: unique(["src.scripture.catholic-bible", "src.ccc.main", profile.magisterialSourceId]) })),
      ...(comparativeAnalysis.length ? [
        { type: "heading", level: 3, text: "Comparative-source boundary" },
        ...comparativeAnalysis.map((text) => ({ type: "paragraph", text, sourceIds: comparativeSourceIds })),
      ] : []),
      { type: "paragraph", text: sourceFrame, sourceIds: unique(["src.ccc.main", profile.magisterialSourceId, profile.historicalSourceId, profile.secondarySourceId]) },
      {
        type: "distinction_table",
        caption: `Controlling distinctions for ${outline.title}`,
        columns: ["Question", "Required distinction", "Editorial consequence"],
        rows: [
          ["What does the Church teach?", "Dogma or doctrine versus discipline or theological opinion", "Match the asserted authority to the actual Magisterial act."],
          ["What happened?", "Primary historical evidence versus later interpretation", "Cite a historical source and state the degree of certainty."],
          ["What does another community hold?", "Named official source versus generic label", "Record internal variation and avoid universal claims beyond the source."],
          ["What follows from the evidence?", "Source statement versus interpretation or inference", "Write the reasoning explicitly and do not place it in the source's voice."],
        ],
      },
    ],
    essentialTerminology: terminology,
    scriptureEvidence: profile.scriptureEvidence.map((item) => ({
      type: "scripture_card",
      reference: item.reference,
      paraphrase: item.paraphrase,
      sourceId: "src.scripture.catholic-bible",
      quotationIncluded: false,
    })),
    catechismMagisterialEvidence: [
      {
        type: "catechism_card",
        locator: profile.cccLocators[0],
        summary: `These paragraphs establish the first Catechism framework needed to evaluate ${outline.title}; the lesson uses an original summary and preserves the locator for review.`,
        sourceId: "src.ccc.main",
        quotationIncluded: false,
      },
      {
        type: "catechism_card",
        locator: profile.cccLocators[1],
        summary: `These paragraphs supply further doctrinal or moral distinctions for ${outline.title} and prevent an isolated treatment of the topic.`,
        sourceId: "src.ccc.main",
        quotationIncluded: false,
      },
      {
        type: "catechism_card",
        locator: profile.magisterialLocator,
        summary: `The assigned Magisterial source gives the authoritative context in which the Catholic synthesis of ${outline.title} must be assessed.`,
        sourceId: profile.magisterialSourceId,
        quotationIncluded: false,
      },
    ],
    patristicHistoricalEvidence: {
      relevance: `Historical reception is relevant because ${outline.title} must not be presented as though its vocabulary and controversies appeared without development or context.`,
      items: [
        {
          summary: `This witness supplies an early or historical control for the lesson while remaining distinct from a Magisterial definition and from modern scholarship.`,
          sourceId: profile.historicalSourceId,
          locator: profile.historicalLocator,
        },
      ],
    },
    importantDistinctions: [
      {
        type: "distinction_table",
        caption: `Authority and claim types in ${outline.title}`,
        columns: ["Category", "What it answers", "What it cannot establish alone"],
        rows: [
          ["Scripture", "The inspired canonical witness in its literary forms", "A later technical conclusion without interpretation and argument"],
          ["Magisterium", "The Church's authoritative doctrinal or disciplinary judgment", "Every historical detail or private theological explanation"],
          ["Patristic or historical source", "Reception, practice, argument, or events in context", "By itself, a universal or irreformable doctrine"],
          ["Academic source", "Specialist historical, textual, philosophical, or scientific analysis", "An act of Catholic doctrinal definition"],
        ],
      },
    ],
    strongObjection,
    opposingPosition,
    catholicResponse,
    commonMistakes: [
      `Treating ${outline.title} as an isolated slogan instead of a question within ${subject.name}.`,
      "Citing a true sentence while ignoring its genre, context, authority level, or the inference needed to reach the conclusion.",
      "Calling a discipline, theological opinion, historical reconstruction, or scientific model a dogma.",
      subject.comparativeTraditions.length
        ? `Attributing one formula to every member of ${subject.comparativeTraditions.join(", ")} despite documented internal variation.`
        : "Answering an unnamed critic instead of identifying the actual argument, school, author, and evidence.",
    ],
    practicalSpiritualApplication: `Pray through one assigned Scripture reference, then write a three-sentence explanation of ${topic}: the Catholic claim, the most important distinction, and the reason it matters for discipleship. Before using the explanation with another person, verify one locator and revise any sentence that sounds more certain or more universal than the evidence permits.`,
    summary: choose([
      `${outline.title} belongs within ${subject.name} and requires a disciplined Catholic synthesis. Scripture, Catechism, Magisterium, historical witness, scholarship, and comparative sources answer connected but different questions. The lesson states the claim, marks authority and uncertainty, represents alternatives in scope, and connects truth to Christian life.`,
      `In summary, ${outline.title} is answered by ordering evidence rather than accumulating quotations. ${subject.name} supplies the doctrinal horizon; the assigned sources establish biblical, ecclesial, historical, and specialist premises. Fair scope and explicit inference keep the Catholic response both confident and corrigible where claims remain non-definitive.`,
      `${outline.title} teaches more than a conclusion. It teaches how ${subject.name} distinguishes source from interpretation, doctrine from discipline or opinion, and another tradition's self-description from Catholic evaluation. Those habits prepare the learner for accurate explanation, prayerful reception, and accountable review.`,
      `The central lesson of ${outline.title} is methodological and substantive: name the Catholic claim, ground it in competent sources, test its historical and conceptual continuity, answer the strongest scoped objection, and state no more than the evidence warrants. In ${subject.name}, that discipline serves truth and charity together.`,
      `${outline.title} can be explained clearly without erasing complexity. The biblical evidence remains contextual, authoritative Catholic teaching remains properly classified, historical and scholarly claims remain reviewable, and comparative positions remain tradition-specific. This ordered account integrates ${subject.name} with formation and mission.`,
      `A complete account of ${outline.title} locates the topic in ${subject.name}, defines its terms, weighs its evidence, and answers a serious alternative. It neither hides Catholic premises nor treats every premise as dogma. The resulting synthesis is ready for human review, not automatic approval or publication.`,
    ], seed, 10),
    reviewPrompts: [
      `Give the short Catholic account of ${topic} without using an unsupported proof text.`,
      "Which claim in the lesson carries the highest doctrinal authority, and which claims remain historical, philosophical, scientific, disciplinary, or theological judgments?",
      "Restate the strongest objection in terms its advocate could recognise before giving the Catholic response.",
      "Identify one source locator that must receive special attention in human review and explain why.",
    ],
    practiceIntents: [
      ["multiple_choice", `Distinguish the controlling claim types and authority levels in ${outline.title}.`],
      ["short_response", `Explain ${outline.title} in a concise Catholic account that also acknowledges a strong objection.`],
    ],
    references: referenceIds.map((sourceId) => ({
      sourceId,
      locator: sourceLocator(sourceId, profile, outline, subject),
      use: sourceId === "src.scripture.catholic-bible"
        ? "Primary inspired evidence, cited by reference and expressed only through original paraphrase."
        : sourceId === "src.ccc.main" || sourceId === profile.magisterialSourceId
          ? "Catholic doctrinal or pastoral framework, summarised without direct quotation."
          : comparativeSourceIds.includes(sourceId)
            ? "Tradition-specific control used to prevent generic or unfair representation; exact semantic use remains subject to comparative review."
            : "Patristic, historical, philosophical, scientific, or scholarly control, summarised without direct quotation.",
    })),
    relatedLessonIds,
    graphCategoryIds: subject.relatedApologiaGraphCategories,
    doctrinalClassifications: subject.majorDoctrinalClassifications,
    comparativeTraditions: subject.comparativeTraditions,
  };
};

const draftForOutline = (outline) => manualDraftById.get(outline.stableId) ?? genericDraft(outline);

await mkdir(lessonsRoot, { recursive: true });
await mkdir(batchesRoot, { recursive: true });
await mkdir(importRoot, { recursive: true });

const contentRecords = phase3.lessons.map((outline) => {
  const subject = subjectById.get(outline.subjectId);
  const subjectLessons = phase3.lessons.filter((lesson) => lesson.subjectId === outline.subjectId);
  const batchOrder = subjectLessons.findIndex((lesson) => lesson.stableId === outline.stableId) + 1;
  const batchId = `batch.phase4.${subject.slug}.01`;
  const draft = draftForOutline(outline);
  const practiceQuestionPlaceholders = draft.practiceIntents.map(([format, promptIntent], questionIndex) => ({
    stableId: `placeholder.${outline.stableId}.${String(questionIndex + 1).padStart(2, "0")}`,
    format,
    promptIntent,
    status: "placeholder",
  }));
  const references = draft.references;
  const record = {
    schemaVersion: "1.0.0",
    stableId: `content.${outline.stableId}`,
    phase3LessonId: outline.stableId,
    programmeId: outline.programmeId,
    subjectId: outline.subjectId,
    groupId: outline.groupId,
    title: outline.title,
    slug: outline.slug,
    centralQuestion: draft.centralQuestion,
    learningObjectives: draft.learningObjectives,
    shortDirectAnswer: draft.shortDirectAnswer,
    fullExplanation: [
      ...draft.fullExplanation,
      {
        type: "objection_response",
        objection: draft.strongObjection,
        fairRepresentation: draft.opposingPosition,
        response: draft.catholicResponse,
        sourceIds: unique(references.map((item) => item.sourceId)),
      },
      { type: "related_content", lessonIds: draft.relatedLessonIds },
      { type: "graph_references", categoryIds: draft.graphCategoryIds, recordIds: [] },
    ],
    essentialTerminology: draft.essentialTerminology,
    scriptureEvidence: draft.scriptureEvidence,
    catechismMagisterialEvidence: draft.catechismMagisterialEvidence,
    patristicHistoricalEvidence: draft.patristicHistoricalEvidence,
    importantDistinctions: draft.importantDistinctions,
    strongObjection: draft.strongObjection,
    opposingPosition: draft.opposingPosition,
    catholicResponse: draft.catholicResponse,
    commonMistakes: draft.commonMistakes,
    practicalSpiritualApplication: draft.practicalSpiritualApplication,
    summary: draft.summary,
    reviewPrompts: draft.reviewPrompts,
    practiceQuestionPlaceholders,
    references,
    relatedLessonIds: draft.relatedLessonIds,
    relatedGraphReferences: { categoryIds: draft.graphCategoryIds, recordIds: [] },
    editorial: {
      productionStatus: "drafted",
      reviewStatus: "awaiting_assignment",
      publicationStatus: "unpublished",
      doctrinalClassifications: draft.doctrinalClassifications,
      comparativeTraditions: draft.comparativeTraditions,
      scripturePolicy: "references_and_original_paraphrases_only",
      licenceReviewRequired: true,
      humanApprovalRequired: true,
      generatedOn: PHASE4_DATE,
    },
  };
  for (const citedSourceId of unique(references.map((item) => item.sourceId))) {
    if (!sourceIds.has(citedSourceId)) throw new Error(`${outline.stableId} cites unknown source ${citedSourceId}`);
  }
  return {
    ...record,
    _generation: {
      batchId,
      batchOrder,
      contentHash: hash(record),
      approximateWordCount: words(record),
    },
  };
});

const recordById = new Map(contentRecords.map((record) => [record.phase3LessonId, record]));
const productionEntries = phase3.lessons.map((outline) => {
  const subject = subjectById.get(outline.subjectId);
  const record = recordById.get(outline.stableId);
  return {
    lessonId: outline.stableId,
    programmeId: outline.programmeId,
    subjectId: outline.subjectId,
    groupId: outline.groupId,
    title: outline.title,
    prerequisites: outline.prerequisites,
    productionStatus: "drafted",
    reviewStatus: "awaiting_assignment",
    publicationStatus: "unpublished",
    contentPath: `lessons/${subject.slug}/${outline.slug}.json`,
    contentHash: record._generation.contentHash,
    missingSources: [],
    licenceIssues: ["scripture_translation_and_quotation_allowance_pending"],
  };
});

const counts = {
  totalPlanned: phase3.lessons.length,
  planned: 0,
  drafted: contentRecords.length,
  reviewed: 0,
  approved: 0,
  blocked: 0,
  not_submitted: 0,
  awaiting_assignment: contentRecords.length,
  in_review: 0,
  changes_requested: 0,
  lessonsRequiringLicenceReview: contentRecords.length,
  missingSourceCount: 0,
};

const subjectProduction = phase3.subjects.map((subject) => {
  const entries = productionEntries.filter((entry) => entry.subjectId === subject.stableId);
  return {
    subjectId: subject.stableId,
    programmeId: subject.programmeId,
    name: subject.name,
    totalPlanned: entries.length,
    planned: 0,
    drafted: entries.length,
    awaitingAssignment: entries.length,
    reviewed: 0,
    approved: 0,
    blocked: 0,
    missingSources: 0,
    licenceIssues: entries.length,
    publicationStatus: "unpublished",
  };
});

const subjectBatches = phase3.subjects.map((subject) => {
  const records = contentRecords.filter((record) => record.subjectId === subject.stableId);
  return {
    schemaVersion: "1.0.0",
    stableId: `batch.phase4.${subject.slug}.01`,
    programmeId: subject.programmeId,
    subjectId: subject.stableId,
    status: "drafted_awaiting_review",
    publicationStatus: "unpublished",
    generatedOn: PHASE4_DATE,
    lessonIds: records.map((record) => record.phase3LessonId),
    contentHashes: Object.fromEntries(records.map((record) => [record.phase3LessonId, record._generation.contentHash])),
    sourceCatalogHash: hash(sourceCatalog),
    qualityPolicy: {
      fullLessonTemplateRequired: true,
      noArbitraryHtml: true,
      noDirectScriptureQuotations: true,
      completeQuestionBankDeferred: true,
      automatedApprovalForbidden: true,
    },
  };
});

const productionManifest = {
  schemaVersion: "1.0.0",
  stableId: "as.phase4.production.2026-07",
  name: "Apologia Sancta Complete Lesson-Content Production Manifest",
  phase: 4,
  status: "in_progress_awaiting_human_review",
  publicationStatus: "unpublished",
  generatedOn: PHASE4_DATE,
  basedOnPhase3Manifest: {
    stableId: phase3.blueprint.stableId,
    version: phase3.blueprint.version,
    sha256: hash(phase3),
  },
  activeBatch: null,
  batches: subjectBatches.map((batch) => ({
    stableId: batch.stableId,
    subjectId: batch.subjectId,
    lessonCount: batch.lessonIds.length,
    status: batch.status,
    manifestPath: `batches/${subjectById.get(batch.subjectId).slug}.manifest.json`,
  })),
  counts,
  policy: {
    phaseMayBeMarkedComplete: false,
    completionRule: "Every Phase 3 lesson must exist, pass automated validation, complete named human review, and be approved without being auto-published.",
    reviewRule: "Automated generation and validation never change a lesson to reviewed or approved.",
    publishingRule: "No generator or import record invokes a remote API, changes a database, or publishes content.",
    scriptureRule: sourceCatalog.policy.scriptureHandling,
  },
  unresolvedIssues: [
    "A named Scripture translation and quotation allowance have not been approved; every draft therefore requires licence review.",
    "The platform has no approved lesson-specific review persistence model; the generated queue is local and awaiting named reviewer assignments.",
    "Apologia Graph category identifiers are mapped, but record identifiers remain empty until the graph taxonomy contract is approved.",
    "Patristic and comparative sources remain paraphrase-only until house editions, translations, and exact reuse terms are approved.",
    "Automated source resolution and structural locator checks do not replace semantic citation review by accountable human editors.",
  ],
  subjects: subjectProduction,
  lessons: productionEntries,
};

const reviewQueue = {
  schemaVersion: "1.0.0",
  stableId: "as.phase4.review-queue.complete-library.01",
  status: "active",
  generatedOn: PHASE4_DATE,
  submissionMode: "local_draft_queue",
  publicationEffect: "none",
  workflowLimitation: "Lesson-specific review persistence and named reviewer assignments require governance approval; this queue is a non-publishing handoff artifact.",
  items: contentRecords.map((record) => ({
    stableId: `review.${record.phase3LessonId}.r1`,
    lessonId: record.phase3LessonId,
    contentHash: record._generation.contentHash,
    revision: 1,
    status: "awaiting_assignment",
    requiredReviewRoles: ["doctrinal_reviewer", "source_editor", "instructional_editor", "comparative_reviewer_as_applicable", "licensing_reviewer"],
    assignedReviewers: [],
    unresolvedIssues: ["scripture_translation_and_quotation_allowance_pending", "named_human_reviewers_unassigned"],
    gates: {
      automatedStructure: "pending_validation",
      citationResolution: "pending_validation",
      doctrinalClassification: "pending_human_review",
      comparativeFairness: record.editorial.comparativeTraditions.length ? "pending_human_review" : "not_applicable",
      externalTextReuse: "pending_human_review",
      scriptureLicence: "pending_policy_approval",
      finalApproval: "pending_human_review",
    },
  })),
};

const batchIndex = {
  schemaVersion: "1.0.0",
  stableId: "as.phase4.batch-index.2026-07",
  status: "drafted_awaiting_review",
  publicationStatus: "unpublished",
  generatedOn: PHASE4_DATE,
  totalBatches: subjectBatches.length,
  totalLessons: contentRecords.length,
  sourceCatalogHash: hash(sourceCatalog),
  batches: productionManifest.batches,
  qualityPolicy: {
    fullLessonTemplateRequired: true,
    noArbitraryHtml: true,
    noDirectScriptureQuotations: true,
    completeQuestionBankDeferred: true,
    automatedApprovalForbidden: true,
  },
};

const programmeRows = phase3.programmes.map((programme) => {
  const subjects = subjectProduction.filter((subject) => subject.programmeId === programme.stableId);
  const total = subjects.reduce((sum, subject) => sum + subject.totalPlanned, 0);
  return `| ${programme.name} | ${subjects.length} | ${total} | ${total} | 0 | 0 | 0 |`;
}).join("\n");

const statusMarkdown = `# Apologia Sancta Phase 4 Production Status

Generated: ${PHASE4_DATE}

Status: **all lesson drafts produced; human review and licensing outstanding; unpublished**

## Outcome

All ${counts.totalPlanned} approved Phase 3 outlines now have safe structured lesson drafts. They are submitted to a local non-publishing review queue. No lesson is marked reviewed, approved, or published, so Phase 4 remains in progress.

## Counts

| Measure | Count |
|---|---:|
| Phase 3 planned lessons | ${counts.totalPlanned} |
| Drafted | ${counts.drafted} |
| Awaiting draft | ${counts.planned} |
| Awaiting named reviewer assignment | ${counts.awaiting_assignment} |
| Reviewed | ${counts.reviewed} |
| Approved | ${counts.approved} |
| Blocked lesson drafts | ${counts.blocked} |
| Drafts requiring Scripture licence review | ${counts.lessonsRequiringLicenceReview} |
| Missing source records | ${counts.missingSourceCount} |

## Counts by programme

| Programme | Subjects | Planned | Drafted | Reviewed | Approved | Blocked |
|---|---:|---:|---:|---:|---:|---:|
${programmeRows}

## Quality and workflow boundary

- Every record uses the approved structured-block contract and contains no arbitrary HTML.
- Scripture is stored only as references and original paraphrases.
- Practice content is limited to two placeholders per lesson.
- Automated checks may validate structure, source resolution, quotation limits, duplication, readability, prerequisites, and workflow safety; they cannot perform theological approval.
- All graph record identifiers remain empty pending an approved taxonomy mapping.
- Draft import artifacts are non-publishing and prohibit upsert.

## Completion statement

The lesson-drafting inventory is complete, but Phase 4 is not approved or publishable. Named doctrinal, source, instructional, comparative, licensing, and final approval work remains outstanding for all ${counts.drafted} drafts.
`;

const subjectStatusMarkdown = `# Phase 4 Subject Production Status

Generated: ${PHASE4_DATE}

Status: **all subject drafts produced; unpublished and awaiting human review**

| Subject | Planned | Drafted | Awaiting assignment | Reviewed | Approved | Blocked | Missing sources | Licence issues |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
${subjectProduction.map((subject) => `| ${subject.name} | ${subject.totalPlanned} | ${subject.drafted} | ${subject.awaitingAssignment} | ${subject.reviewed} | ${subject.approved} | ${subject.blocked} | ${subject.missingSources} | ${subject.licenceIssues} |`).join("\n")}
`;

const issuesMarkdown = `# Phase 4 Unresolved Issues

1. **Scripture licensing:** select permitted translation(s), territories, storage rules, notices, and quotation limits. All ${counts.drafted} drafts currently use references and original paraphrases only.
2. **Lesson review persistence:** approve a lesson-specific review schema and role permissions. The generated queue is local and cannot publish.
3. **Human review:** assign named doctrinal, source, instructional, comparative, licensing, and final-approval roles. No automated process may satisfy these gates.
4. **Comparative scope:** reviewers competent in each named tradition must confirm semantic accuracy, internal variation, and source selection before approval.
5. **Edition and reuse review:** approve house editions and translations for patristic, conciliar, comparative, and academic sources before introducing any direct quotation.
6. **Graph mapping:** approve stable Apologia Graph record identifiers. Category links are present; record links remain empty rather than invented.
7. **Database mapping:** approve how the safe structured block model maps to persistent lesson records before import.
8. **External text reuse:** the automated gate checks internal duplication and quotation blocks; a licensed external-corpus or accountable editorial review remains required before publication.
9. **Semantic citation review:** automated URL and bibliography checks establish source identity, not that every paraphrase and locator fully supports its lesson claim.
10. **Publication:** all ${counts.drafted} lessons remain unpublished; none may be described as approved until the governed human workflow is complete.
`;

await writeFile(path.join(outputRoot, "source-catalog.json"), json(sourceCatalog));
await writeFile(path.join(outputRoot, "production.manifest.json"), json(productionManifest));
await writeFile(path.join(outputRoot, "review-queue.json"), json(reviewQueue));
await writeFile(path.join(outputRoot, "batch.manifest.json"), json(batchIndex));
await writeFile(path.join(outputRoot, "PHASE4_STATUS.md"), statusMarkdown);
await writeFile(path.join(outputRoot, "SUBJECT_PRODUCTION_STATUS.md"), subjectStatusMarkdown);
await writeFile(path.join(outputRoot, "UNRESOLVED_ISSUES.md"), issuesMarkdown);

for (const batch of subjectBatches) {
  const subject = subjectById.get(batch.subjectId);
  await writeFile(path.join(batchesRoot, `${subject.slug}.manifest.json`), json(batch));
}

for (const record of contentRecords) {
  const subject = subjectById.get(record.subjectId);
  const subjectRoot = path.join(lessonsRoot, subject.slug);
  await mkdir(subjectRoot, { recursive: true });
  await writeFile(path.join(subjectRoot, `${record.slug}.json`), json(record));
}

const importLessons = contentRecords.map(({ _generation, ...record }) => ({
  ...record,
  importMetadata: {
    contentHash: _generation.contentHash,
    mode: "draft_only",
    upsertAllowed: false,
    publishAllowed: false,
  },
}));

await writeFile(path.join(importRoot, "draft-lessons.json"), json({
  schemaVersion: "1.0.0",
  importMode: "draft_only",
  publicationEffect: "none",
  remoteExecutionPerformed: false,
  records: importLessons,
}));
await writeFile(path.join(importRoot, "draft-lessons.ndjson"), `${importLessons.map((record) => JSON.stringify(record)).join("\n")}\n`);
await writeFile(
  path.join(importRoot, "README.md"),
  "# Phase 4 draft import records\n\nThese files contain the complete Phase 4 lesson-draft inventory. They contain no credentials, executable SQL, remote hooks, approval changes, or publication commands. Import is prohibited until a database mapping and lesson-review model are approved.\n"
);

console.log(`Generated ${contentRecords.length} complete structured drafts in ${subjectBatches.length} subject batches.`);
console.log(`Production status: ${counts.drafted} drafted, ${counts.planned} missing, 0 reviewed, 0 approved, 0 published.`);

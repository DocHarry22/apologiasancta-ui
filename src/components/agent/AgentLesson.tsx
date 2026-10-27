"use client";

import { ReportIssue } from "@/components/content/ReportIssue";
import { useState } from "react";
import type { Claim, PublishedPack } from "@/lib/agent/contracts";
import EvidenceDrawer from "./EvidenceDrawer";
export default function AgentLesson({ entry }: { entry: PublishedPack }) {
  const [evidence, setEvidence] = useState<Claim | null>(null);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const claimMap = new Map(entry.pack.claims.map(c => [c.id, c]));
  function claims(ids: string[]) {
    return ids.map(id => { const c = claimMap.get(id); if (!c) return null;
      return <div key={id} className="mt-3"><p className="leading-8">{c.text}</p><button type="button" className="mt-1 text-sm text-(--accent) underline" onClick={() => setEvidence(c)}>View evidence</button><ReportIssue app="research" contentType="claim" contentId={`${entry.id}:${c.id}`} revisionId={`pack:${entry.id}:${entry.created_at}`} title={c.text} snapshot={{ claim: c, sources: entry.sources }} /></div>;
    });
  }
  return <article className="mx-auto max-w-3xl px-4 py-8 text-foreground">
    <p className="text-sm font-semibold text-(--accent)">AI-generated Catholic study · Automated checks passed</p>
    <h1 className="mt-3 text-3xl font-bold">{entry.pack.title}</h1><ReportIssue app="research" contentType="lesson" contentId={entry.id} revisionId={`pack:${entry.id}:${entry.created_at}`} title={entry.pack.title} snapshot={entry} /><p className="mt-4 text-lg leading-8">{entry.pack.summary}</p>
    <p className="mt-4 rounded-xl border border-(--border) bg-(--card) p-4 text-sm leading-6">This is an AI study aid. It has not received human or ecclesiastical approval. Each explanation links to its evidence.</p>
    <div className="mt-8 space-y-8">{entry.pack.steps.map((step, i) => <section key={i}><h2 className="text-xl font-semibold">{i + 1}. {step.title}</h2>{claims(step.claimIds)}</section>)}</div>
    <section className="mt-10"><h2 className="text-2xl font-bold">Objections and responses</h2>{entry.pack.objections.map((o, i) => <details key={i} className="mt-4 rounded-xl border border-(--border) bg-(--card) p-4"><summary className="cursor-pointer font-semibold">{o.objection}</summary><ReportIssue app="research" contentType="claim" contentId={`${entry.id}:objection:${i}`} revisionId={`pack:${entry.id}:${entry.created_at}`} title={o.objection} snapshot={{ objection: o, sources: entry.sources }} /><p className="mt-3 text-sm text-(--text-secondary)">{o.attributedTo}</p>{!!o.evidence.length && <button type="button" className="mt-2 text-sm text-(--accent) underline" onClick={() => setEvidence({ id: `objection-${i}`, text: o.objection, classification: "reported_objection", evidence: o.evidence })}>View objection source</button>}{claims(o.responseClaimIds)}</details>)}</section>
    <section className="mt-10"><h2 className="text-2xl font-bold">Check your understanding</h2><p className="mt-2 text-sm">Practice quiz. Results stay on this device for this session.</p>
      {entry.pack.quiz.map((q, i) => <fieldset key={i} className="mt-5 rounded-xl border border-(--border) bg-(--card) p-4"><legend className="px-2 font-semibold">{i + 1}. {q.question}</legend><ReportIssue app="research" contentType="question" contentId={`${entry.id}:quiz:${i}`} revisionId={`pack:${entry.id}:${entry.created_at}`} title={q.question} snapshot={{ question: q, sources: entry.sources }} />
        <div className="space-y-2">{q.options.map((option, index) => <label key={index} className="flex cursor-pointer gap-3 rounded-lg border border-(--border) p-3"><input type="radio" name={`question-${i}`} checked={answers[i] === index} onChange={() => setAnswers(prev => ({ ...prev, [i]: index }))} /><span>{option}</span></label>)}</div>
        {answers[i] !== undefined && <div className="mt-4" aria-live="polite"><p className="font-semibold">{answers[i] === q.correctIndex ? "Correct." : `Review this answer: ${q.options[q.correctIndex]}`}</p>{claims(q.explanationClaimIds)}</div>}
      </fieldset>)}
    </section>
    {evidence && <EvidenceDrawer claim={evidence} sources={entry.sources} onClose={() => setEvidence(null)} />}
  </article>;
}

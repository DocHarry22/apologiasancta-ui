import type { Source, Pack } from "./contracts";
export const sources: Source[] = [
  { id: "ccc", url: "https://www.vatican.va/content/catechism/en/test.html", title: "Catechism", kind: "catechism", retrievedAt: "2026-10-14", sha256: "abc", text: "The Church teaches faith and charity. Prayer is important." },
  { id: "bible", url: "https://bible.usccb.org/bible/john/1", title: "John", kind: "scripture", retrievedAt: "2026-10-14", sha256: "def", text: "In the beginning was the Word." },
];
export function fixture(): Pack {
  return { title: "Faith", summary: "A study of faith.", claims: [
    { id: "faith", text: "Study faith.", classification: "catholic_teaching", evidence: [{ sourceId: "ccc", locator: "Paragraph", quote: "faith and charity" }] },
    { id: "word", text: "Study the Word.", classification: "catholic_teaching", evidence: [{ sourceId: "bible", locator: "John 1:1", quote: "In the beginning" }] },
    { id: "prayer", text: "Study prayer.", classification: "interpretation", evidence: [{ sourceId: "ccc", locator: "Paragraph", quote: "Prayer is important." }] },
  ], steps: [ { title: "Faith", claimIds: ["faith"] }, { title: "Word", claimIds: ["word"] }, { title: "Prayer", claimIds: ["prayer"] } ],
    objections: [{ objection: "Why study?", attributedTo: "Hypothetical objection", evidence: [], responseClaimIds: ["faith"] }],
    quiz: Array.from({ length: 3 }, (_, i) => ({ question: `Question ${i}`, options: ["A", "B", "C", "D"], correctIndex: i, explanationClaimIds: ["faith"] })), nextTopics: [] };
}

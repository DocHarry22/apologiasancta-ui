# Apologia Sancta content policy

Status: Phase 2 governance baseline  
Scope: every future lesson, question, source record, Graph relationship, import and publication  
Out of scope: bulk curriculum generation

## Catholic teaching identity

Apologia Sancta teaches from the Catholic position. A doctrinal claim must be grounded in Sacred Scripture and Sacred Tradition as authentically interpreted by the living Magisterium. Scripture, Tradition and Magisterium are neither interchangeable nor separable authorities; see *Dei Verbum* 9–10. The Catechism, councils, papal and dicastery documents must be cited according to their actual authority and intent. Fathers, Doctors, theologians and historians may witness, explain or contextualise doctrine, but their words are not silently promoted to Magisterial definitions.

A statement must use one classification from the doctrinal-classification policy. If authority, scope or theological note is uncertain, the statement is marked `human_review_required` and cannot be published as settled Catholic teaching.

Primary norms:

- [Dei Verbum 9–10](https://www.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19651118_dei-verbum_en.html)
- [Lumen Gentium 25](https://press.vatican.va/archive/hist_councils/ii_vatican_council/documents/vat-ii_const_19641121_lumen-gentium_en.html)
- [Donum Veritatis 15–24](https://www.vatican.va/roman_curia/congregations/cfaith/documents/rc_con_cfaith_doc_19900524_theologian-vocation_en.html)

## Required lesson contract

A publishable lesson contains all of these independently identifiable components:

1. central question;
2. learning objectives;
3. concise answer;
4. full explanation;
5. relevant Scripture;
6. Catholic doctrinal evidence;
7. historical or patristic evidence when relevant;
8. important distinctions;
9. a serious objection;
10. Catholic response;
11. common misunderstandings;
12. summary;
13. practice questions;
14. references; and
15. related Apologia Graph material.

“Not relevant” is a reviewed editorial decision, never a silent omission. It requires a reason and the appropriate review step.

Every borrowed or source-dependent passage is labelled as one of: `direct_quotation`, `paraphrase`, `interpretation`, or `inference`. A direct quotation requires a locator, source, rights record and word count. An interpretation or inference must not be visually or verbally presented as the source’s own assertion.

## Educational design rules

- Objectives use observable outcomes and link to the questions that assess them.
- A lesson teaches a distinction before assessing that distinction.
- Practice may guide; an official mastery attempt may not expose hints or answer keys.
- Historical, doctrinal and comparative claims are kept distinct.
- Serious objections are not reduced to rhetorical caricatures.
- Related Graph records identify the precise claim, objection, evidence or response relationship.
- Accessibility changes may change presentation, not the doctrinal or assessment standard.

## Publication boundary

Draft content may be incomplete but must display validation warnings. Submission starts the governed review sequence. Publication requires no unresolved blocking finding, all required current-version review stages, verified source/licence metadata, and an independent final approval for high-risk content.

Published content is immutable in learner attempt snapshots. Editing a question creates a new version. Invalid or ambiguous questions are quarantined; prior completed mastery and unlock records are not revoked merely because later editorial review changes the item.

## Prohibited behavior

- presenting a private opinion as dogma;
- using a Father or theologian as though that source were a Magisterial definition;
- generic claims about internally diverse traditions;
- unattributed quotation or unlicensed bulk copying;
- publication by a sole author-approver where independent review is required;
- paid, live-competition, client-side or offline bypass of official mastery;
- using generated prose as a source.

## Machine enforcement

The normative machine profile is `governance/content-rules.v1.json`. Database validation is authoritative for publication; TypeScript and Engine/Graph linters are defense in depth. A machine pass is necessary but never sufficient for theological approval.

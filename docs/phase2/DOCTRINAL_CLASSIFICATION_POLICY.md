# Doctrinal classification policy

Each doctrinally meaningful assertion receives exactly one primary classification. The classification describes the assertion, not the prestige of the source cited beside it.

| Classification | Use | Required evidence | Publication rule |
|---|---|---|---|
| `dogma` | Truth proposed as divinely revealed and requiring the assent of faith | Explicit definitive act or clear ordinary-and-universal witness, with precise locator | Qualified doctrinal reviewer; uncertainty blocks |
| `definitively_held` | Teaching proposed definitively because necessarily connected with Revelation | Definitive Magisterial source and scope | Qualified doctrinal reviewer |
| `authoritative_doctrine` | Authentic, non-definitive teaching on faith or morals | Document, issuing authority, genre, date, locator and stated level | Religious submission language; do not call irreformable |
| `discipline` | Ecclesial law, norm or practice capable of legitimate change | Current competent authority and jurisdiction | State time, place and scope |
| `prudential_application` | Authoritative or reasoned application involving contingent judgment | Principles, application source and contingencies | State that prudential judgment is involved |
| `permitted_opinion` | Theological position compatible with defined teaching but not itself taught as settled | Credible theologian/school and boundaries | Present alternatives fairly |
| `historical_claim` | Claim established by historical method | Primary evidence or credible scholarship | Do not infer doctrinal authority from historicity |
| `comparative_religion_claim` | Claim about a non-Catholic or philosophical position | Named tradition and official/recognised source | Comparative fairness review |
| `disputed_or_unresolved` | Question on which the competent authority has not settled the issue, or classification is uncertain | Competing evidence and reason for uncertainty | Mandatory qualified human review |

## Classification method

1. Isolate the exact proposition. Do not classify an entire paragraph containing claims of different kinds.
2. Identify the competent teacher, document genre, intended audience and scope.
3. Record whether the proposition is directly stated, paraphrased, interpreted or inferred.
4. Compare the proposed classification with the source’s language and later authoritative clarification.
5. Record contrary or limiting context.
6. If the evidence does not establish the level, use `disputed_or_unresolved` with `human_review_required=true`.

The authority of an ecumenical council or papal document does not make every historical aside, disciplinary provision or prudential application a dogma. Conversely, ordinary teaching is not treated as optional merely because it is not an ex cathedra definition. *Lumen Gentium* 25 and *Donum Veritatis* 15–24 supply the controlling distinctions.

## Source distinctions

- Sacred Scripture is cited by book, chapter, verse and translation.
- Magisterial texts are cited by official title, promulgating authority, date and paragraph/canon.
- Catechism paragraphs synthesise Catholic teaching; a paragraph’s underlying sources should be inspected for high-risk classifications.
- Fathers and Doctors are identified by person, work, date/edition and role as witnesses or theologians.
- Academic sources support historical, linguistic and comparative claims but do not create Catholic doctrine.

## Review escalation

The following always require a qualified doctrinal reviewer: `dogma`, `definitively_held`, contested moral teaching, claims about infallibility, claims that another Catholic position is impermissible, and any automated or author-supplied classification with confidence below the configured threshold.

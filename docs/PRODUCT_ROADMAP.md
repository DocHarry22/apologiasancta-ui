# Product strategy and roadmap

## MVP shipped in this branch

The operational MVP now connects four product pillars: a clear home/dashboard, a sourced Catholic apologetics learning path, practice assessment, and secure live room competition. Existing role-aware content administration, citations, library, host console, SSE reconnect, PWA support and durable engine snapshots complete the first shippable system.

## Must build now

- Learning: doctrine categories, the Foundations path, lesson references, newcomer explanations, practice mode, device progress and source-required question explanations.
- Competition: create/join room, code/link join, timer, server-side answer window, duplicate prevention, reconnect snapshot, room/global leaderboards, review/explanation states and responsive player/host layouts.
- Community/moderation: safe display names, host/admin/author/reviewer roles, rate limits and audit records for privileged actions.
- Content: bank, categories/topics, difficulty, Scripture/Catechism/Church-document references, review/publish workflow, batch import and explanation field.
- UX: fast join, large answer targets, clear loading/empty/error states, touch/keyboard focus, responsive navigation and installable PWA shell.
- Production: explicit public/internal engine URLs, strict production CORS, health/diagnostics, PostgreSQL runtime durability, repeatable self-initialisation and environment templates.

## Should build soon

- Learning: durable user profiles, server-backed progress, bookmarks/notes, flashcards with spaced repetition, daily challenge and a Church history timeline.
- Competition: spectator mode, challenge/rematch links, question review, report-a-question, ranked daily quiz, seasonal/category boards and difficulty calibration.
- Groups: parish/class cohorts, invitations, group dashboards and moderator reporting queue.
- Content: normalized question/version tables, source URL validation, editorial ownership, version history, CSV export and a human-review gate for AI-assisted drafts.
- UX: first-run onboarding, dark theme, richer offline lesson caching and accessibility testing with screen readers.
- Quality: Playwright end-to-end coverage against an ephemeral engine/database and production monitoring/alerts.

## Later

- Learning: Church Fathers quote bank, councils/heresies explorer, saints/apologists library, certificates, audio/video lessons and an explicitly source-grounded AI tutor.
- Competition: teams, large tournaments, anti-collusion signals, tournament seasons, advanced analytics and native push notifications.
- Monetisation: free core tier, premium study packs, parish/school licences, sponsored tournaments, donations, printable guides and then Stripe. Merchandise is last.
- Platform: native mobile distribution, normalized event analytics, multi-region or multi-controller scale only after demand proves it necessary.

## Remove or simplify

- Do not market a global competitive identity until accounts and abuse controls are durable.
- Keep one canonical `/admin` console; retain `/author` only as a compatibility redirect and remove it after links/bookmarks migrate.
- Do not add separate half-built debate, social-feed or chat products to the MVP.
- Delay public Catholic-vs-Protestant, Catholic-vs-Islamic and atheist comparison packs until each has named theological/editorial review, charitable language standards and primary citations.
- Keep AI to draft assistance; never auto-publish doctrinal answers or questions.
- Do not provision Redis or multi-instance infrastructure until the shared controller is redesigned for distributed coordination.

## Content governance

Every doctrinal claim should link to an authoritative source: Catechism paragraph, Scripture passage, council/church document or a contextualized patristic work. Comparative content must label the claim being represented, avoid caricature and distinguish authoritative Catholic teaching from an interlocutor's position. The publish workflow needs an accountable human reviewer and a correction history.

## Launch sequence

1. Configure production secrets and deploy engine, then UI.
2. Run the end-to-end room smoke script in the production environment with a non-public test room.
3. Complete human review of the Foundations path and a launch-sized curated question set.
4. Add durable learner accounts/progress and reporting before ranked prizes, subscriptions or school licensing.


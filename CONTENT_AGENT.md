# Autonomous Catholic content agent

The agent researches, writes, checks, and publishes AI-labelled Catholic study packs without a per-run approval step. It reports each operation in `/admin/agent`; public studies and practice quizzes appear at `/research/agent` on the website and the hosted Android wrapper. Existing human editorial workflows remain available for other content.

## Ordered operation

1. Seed a curriculum following Creed, sacraments, moral life, and prayer (Catechism 13–17).
2. Reserve one persistent job and one daily work slot. Only one lease is active globally.
3. Use domain-filtered web search on Vatican, USCCB and New Advent resources, with Stanford Encyclopedia, OPC and LCMS sources for documented external arguments. External arguments cannot establish Catholic doctrine. Retrieved page instructions never become agent instructions.
4. Retrieve actual HTTPS pages, enforce trusted hosts on every redirect, bound time/bytes, classify source type, and fingerprint extracted text.
5. Generate progressive steps, individually evidenced claims, evidenced real objections or labelled hypothetical objections, responses, and quizzes using only retrieved text.
6. Require Catechism and Scripture citations; verify exact quotations, source IDs, claim references, quiz shape, and a 25-word aggregate quotation allowance per source.
7. Run a separate automated audit for source context, paragraph/verse locations, doctrine, attribution, summary, and quiz ambiguity.
8. Publish only passing packs, visibly labelled as AI study aids without human or ecclesiastical approval. Automated auditing can miss mistakes; source access is provided for inspection.
9. Append a persistent report with source metadata, actions, warnings, audit failures and provider usage. Add at most three deduplicated follow-up topics behind foundations, with a 200-topic queue ceiling. Revisit completed topics after 30 days.

Each failed topic retries after two hours, up to three attempts, then becomes blocked while other topics continue. Interrupted runs recover after a 15-minute lease. Lease ownership is verified in the same transaction that publishes a pack, preventing stale workers from publishing. Each attempted run counts against the daily cap, including failed runs. The default cap is six runs per South African calendar day; the hard configuration ceiling is 24. This caps calls/output/search work, not an exact rand spending amount; also set a provider account budget.

## Installation

The app's Apologia learning database must be available. Do not install this schema in an unrelated connected database.

1. Set the server-only `LEARNING_DATABASE_URL` and its existing SSL settings.
2. Run `npm run agent:migrate` using that connection. The idempotent SQL creates three RLS-protected tables in the unexposed `apologia_agent` schema, revoking public/anon/authenticated access. The server connection must own these tables or have the necessary trusted database privileges; no browser role is granted access.
3. For API processing, explicitly set `CONTENT_AGENT_PROVIDER=api` and set `OPENAI_API_KEY`, `CONTENT_AGENT_MODEL` (default `gpt-6-sol`, requires Responses API and web-search support), and a dedicated random `CONTENT_AGENT_CRON_SECRET` of at least 32 characters.
4. Deploy this branch to the existing Next.js host. It must allow outgoing HTTPS to OpenAI and source sites, PostgreSQL access, and HTTP jobs lasting up to 600 seconds. For hosts with shorter timeouts, run the pipeline on a suitable worker; do not assume the `maxDuration` export changes hosting limits.
5. Configure GitHub repository variable `CONTENT_AGENT_APP_URL` as the deployed HTTPS origin and repository secret `CONTENT_AGENT_CRON_SECRET` with the same token. The workflow must be on the default branch for scheduled runs. Set the repository variable `CONTENT_AGENT_SCHEDULE_ENABLED=true` when API scheduling is configured; it calls the worker hourly at minute 17. Leave it unset in private Codex mode, whose scheduler runs on the private host. GitHub scheduling can be delayed; it is periodic processing, not a guarantee of an always-running process.
6. Run the workflow once and verify a completed report, a published lesson, working quiz explanations and evidence links. Production activation has not been verified merely by passing local tests.

The `/api/internal/content-agent` endpoint accepts authenticated POST requests only. The admin page requires an active staff session and learning management/audit permission. It shows configuration readiness, daily totals, recent reports, and a stale heartbeat warning. Model secrets never appear in reports. Public pages query only published packs through the server; the private schema is not exposed through the Data API.

Reporting is provided to the admin account as requested; no email credentials or recipient are required. Email delivery is not implemented. Quizzes are practice activities and do not yet feed the existing mastery/competition question bank. The evidence drawer is implemented for agent-generated claims; existing legacy claims have not been backfilled.

## Verification

`npx vitest run src/lib/agent/contracts.test.ts src/lib/server/agent/provider.test.ts src/lib/server/agent/runner.test.ts src/app/api/internal/content-agent/route.test.ts src/components/agent/AgentLesson.test.tsx`

Also run `npm run typecheck`, lint the changed files, and `npm run build`. Before activation, execute the migration in the target database and verify scheduling, real provider responses, failed-job recovery and publication there.

## References

- Catholic curriculum structure: https://www.vatican.va/content/catechism/en/prologue/iv_structure_of_this_catechism.html
- OpenAI domain filtering and search sources: https://developers.openai.com/api/docs/guides/tools-web-search
- Supabase RLS and grants: https://supabase.com/docs/guides/database/postgres/row-level-security

## Implementation verification (14 October 2026)

The `autonomous_catholic_content_agent` migration was applied to the Apologia project `akpxlqktnavtptudyxlp`. A live query confirmed all three agent tables have RLS enabled, both `anon` and `authenticated` lack schema access, and there are no public/anon/authenticated table grants. The advisor's informational "RLS enabled, no policies" findings are intentional for these private, server-owned tables: browser roles are denied. See https://supabase.com/docs/guides/database/database-linter?lint=0008_rls_enabled_no_policy.

Local validation: production build and TypeScript passed; lint had no errors and four pre-existing navigation warnings. Existing Node tests: 65 passed. Vitest: 246 passed; five tests requiring a disposable PostgreSQL server were skipped locally. An isolated embedded PostgreSQL run exercised ordered reservations, daily limits, atomic publication, provenance metadata, lease recovery, stale-worker rejection, retry blocking and private schema ACLs. The committed CI step runs the five acceptance tests against PostgreSQL 16.

Real model generation and scheduled production execution have not been verified. The implementation branch is `feat/autonomous-catholic-content-agent`. The user explicitly authorised publication to the public GitHub repository on 14 October 2026. Production model credentials and scheduler settings still need provisioning on the host.

## ChatGPT subscription mode (private worker)

The user requested use of their ChatGPT Plus subscription. The supported implementation uses a private, signed-in Codex CLI process. It does not copy the current chat's credentials, extract OAuth tokens, or send Codex credentials to `api.openai.com`. The installed Codex CLI reported an existing ChatGPT sign-in in this workspace. This establishes its authentication method, not the account’s subscription tier or available quota. A persistent private deployment still needs its own reachable worker and credentials store.

On a dedicated private machine or self-hosted VM:

1. Install Node 22.17+ and the official Codex CLI (`npm install -g @openai/codex@0.162.1`).
2. Sign in once with `codex login`, selecting **Sign in with ChatGPT**. Use the account holding the subscription. Leave authentication in Codex's native credential store, outside the checkout.
3. Install the reviewed code with `npm ci` (the private worker uses the pinned `tsx` development tool). Provide `LEARNING_DATABASE_URL` and its SSL settings using the worker host's private environment or an environment file outside the checkout. Set `CONTENT_AGENT_PROVIDER=codex` on the website to show private-worker mode in the dashboard.
4. Check authentication with `npm run agent:worker -- --check`, then run one topic with `npm run agent:worker -- --once`.
5. Run `npm run agent:worker` as a persistent private service, or invoke `--once` from the host scheduler hourly. Keep the host running. The worker writes directly to the private agent tables, and the website displays its reports and published packs.

Private Codex mode is the default. API processing requires an explicit `CONTENT_AGENT_PROVIDER=api` setting; subscription quota exhaustion never switches billing modes. No OpenAI API key or web cron secret is required for the private worker. The HTTP endpoint does not launch Codex; in subscription mode it reports that a private worker handles processing. Do not place subscription credentials on a public GitHub Actions runner, and do not expose the worker as a public inference service. Subscription availability and limits depend on the signed-in account; reaching a quota does not cause a fallback to paid API billing.

The subprocess is started without a shell, with shell tools disabled, a read-only sandbox, fresh temporary working directories and ephemeral sessions. Database/API/cron secrets are excluded from its environment. The writing and checking stages have web search disabled; only discovery searches. Discovery URLs from Codex are proposals: the pipeline still retrieves trusted pages itself and verifies evidence against the downloaded passages.

Official documentation: https://learn.chatgpt.com/docs/auth and https://learn.chatgpt.com/docs/non-interactive-mode. For locally hosted open-source apps, a separate Sign in with ChatGPT plan-usage preview also exists: https://developers.openai.com/siwc/token-sharing-open-source. That requires its own client registration and user sign-in; it does not make this chat's credentials available to the website.

## Security dependency repair

Next.js and its ESLint configuration are pinned to 16.3.8, Capacitor Android/core/CLI to 7.6.9, and sharp to 0.35.5. Compatible transitive updates repair the other audit findings. The remaining unpatched `braces` chain was removed by replacing `fast-glob` with a private, bounded adapter for the Next ESLint plugin's `globSync(..., {onlyDirectories:true})` contract, implemented using Node's filesystem glob. Next's lint rules remain enabled. Brace-expansion patterns are deliberately rejected; use plain directory roots or ordinary globs in Next ESLint root settings. No audit allowlist or suppression was added.

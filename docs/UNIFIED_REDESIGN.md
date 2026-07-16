# Unified Apologia Sancta product redesign

This document records the implementation decisions for `feature/unified-apologia-redesign`. It complements the operational audit and production runbook; it is not a substitute for deployment-provider configuration.

## Product and design decisions

- One semantic token system drives light, dark and system themes across web, PWA and Capacitor. The first render resolves the theme before React hydration and subsequent changes persist locally.
- The visual language uses parchment, navy, restrained gold, Marian blue, editorial serif headings and sans-serif controls. Decorative Catholic motifs remain secondary to readable content and gameplay.
- The reference light gold remains the decorative accent; small foreground gold is deliberately darkened to meet WCAG AA on parchment and white surfaces, and interactive control borders use a separate 3:1 token.
- One `AppShell` owns the Graph promotion, responsive header, footer and five-destination mobile navigation. Native uses the same product content and theme rather than a forced-dark duplicate dashboard.
- Home is an honest hub: live state comes from the Engine, learning and practice progress are labelled as device-local, releases can be empty, and the Graph is presented as a separate application.
- Learn is a connected formation journey. Library is a searchable/filterable catalogue. Research is a gateway, not a duplicate Graph. Leaderboard presents only Engine responses and honest empty/error states.
- Authentication preserves the existing secure APIs and diagnostics. Unsupported social login, passkeys, password reset, email delivery, data export and account deletion controls are intentionally omitted.

## Routes redesigned

| Route | Outcome |
| --- | --- |
| `/` and `/native` | Unified learner hub with real room state, formation, practice, research and discovery |
| `/learn`, `/learn/[lessonId]`, `/practice` | Structured sourced formation, lesson progress and explanation-led assessment |
| `/library`, `/library/[topicId]` | Working search, taxonomy, filters, sorting, saved-device view and Engine/bundled fallback |
| `/mobile` | Existing server-authoritative live play retained; theme, modal, status, responsive and token-rollout behaviour hardened |
| `/leaderboard` | Independent period/view controls with real daily, weekly, all-time and streak data |
| `/research` | Safe server-side Graph availability check and public external launch paths |
| `/login`, `/admin/login`, `/author/login`, `/signup` | Shared sign-in/create-account experience with contextual safe redirects |
| `/account` | Authenticated profile, learning, quiz, appearance, security, notifications and privacy controls |
| `/privacy` | Public technical privacy overview; explicitly not a substitute for an approved legal policy |

## Data truth rules

- No production count, popularity, schedule, rank movement or achievement is invented.
- Bundled content is explicitly used as an offline-safe fallback; external Engine and Graph data are labelled by source.
- Device-local progress is never described as synced account progress.
- Graph health is checked server-side over HTTPS, bounded by a short timeout, cached, normalized and never exposes private repository or internal API details.
- The public browser receives no Engine admin token, player join secret, database credential or service-role key.

## Safe contract rollout

The current production Engine returns the legacy player registration contract. The hardened Engine returns an expiring signed room token and requires it for answers. Releasing the Engine first would break the current UI, while releasing the earlier strict UI first would reject the current Engine. This branch resolves that deadlock:

1. The UI stores and submits a signed token whenever the Engine issues one.
2. If the deployed Engine returns the legacy contract, the UI uses the existing registration lookup and answer endpoint without inventing a token.
3. The hardened Engine must receive a genuine 32+ random-byte `PLAYER_JOIN_SECRET` before deployment.
4. After the Engine is deployed, new joins automatically use the signed path; existing legacy sessions can rejoin.

## Known external gates

- Hostinger branch, build and auto-deploy settings are not represented in Git; an owner must confirm that the reviewed UI commit is the commit actually deployed.
- Render must receive the production join secret and must retain healthy PostgreSQL persistence before the Engine release.
- The Graph Hostinger Node process needs a restart/redeploy of current `main` so API 404 and SPA fallback behaviour match the checked-in server.
- Public Android release remains gated on protected signing credentials and a release rehearsal; debug builds are not a public distribution artefact.

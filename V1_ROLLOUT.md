# Apologia Sancta V1 Internal Rollout

## Current Release Target

- UI host: `https://sandybrown-bear-488955.hostingersite.com/`
- Engine host: `https://apologiasancta-engine.onrender.com`
- Android package: `com.apologiasancta.live`
- First APK channel: internal debug APK for testers
- Public signed release: blocked until Android keystore secrets and release workflow are verified

## Current Smoke Status

Last checked from this workspace on 2026-05-15:

| Target | Status | Notes |
| --- | --- | --- |
| Local `next build --webpack` | Pass | Production route map generated successfully |
| Local production Next routes `/`, `/mobile/`, `/author/login/`, `/library/` | Pass | HTTP 200 through `next start` |
| `GET /health` on Render engine | Pass | HTTP 200 |
| `GET /rooms` on Render engine | Pass | HTTP 200 |
| `GET /topics` on Render engine | Pass | HTTP 200 |
| `GET /leaderboard` on Render engine | Pass | HTTP 200 |
| `GET /rooms/global` on Render engine | Pass | HTTP 200 |
| `GET /rooms/global/leaderboard?period=all-time` | Pass | HTTP 200 |
| `GET /rooms/global/state` | Pass | HTTP 200 |
| `GET /rooms/global/events` | Pass | SSE returned initial room state; short test timed out as expected after receiving data |
| `GET /rooms/global/stages` | Blocked | HTTP 404 on deployed engine; Render is behind local source and must redeploy after GitHub upload |
| Hostinger `/` | Pass | HTTP 200 |
| Hostinger `/mobile/` | Blocked | HTTP 403 on deployed host |
| Hostinger `/author/login` | Blocked | HTTP 403 on deployed host |
| Hostinger `/library` | Blocked | HTTP 403 on deployed host |

The source now includes `public/.htaccess` for Apache/Hostinger static routing. If Hostinger is serving a static export, upload rebuilt static output including `.htaccess` before treating Hostinger routes as v1-ready. If Hostinger is running Next as a Node app, deploy the latest source/build output instead.

## APK Artifact

- Debug APK output: `android/app/build/outputs/apk/debug/apologia-sancta-debug.apk`
- Hosted download placeholder: `public/downloads/apologia-sancta.apk`
- Current SHA-256: `6301E8615F3E8FC483318F097F36E0C0DC1FA75C080C994DF7B5B17E410EE84C`
- Both APK/AAB outputs are ignored by git and should be uploaded manually to Hostinger or attached to a GitHub pre-release.

The APK is a hosted-web Capacitor shell. Its embedded config must keep:

- `server.url`: `https://sandybrown-bear-488955.hostingersite.com/`
- `server.cleartext`: `false`
- `android.allowMixedContent`: `false`

## Required V1 Gates

- Hostinger routes `/`, `/mobile/`, `/author/login`, and `/library` return HTTP 200 after redeploy.
- Render engine route `/rooms/global/stages` returns HTTP 200 after redeploying the current local engine source.
- Android APK installs on at least one physical Android device.
- APK opens the Hostinger UI, joins a room, submits an answer, receives an SSE update, and shows answer/leaderboard feedback.
- Engine remains a single Render instance until Postgres/Redis adapters are wired into runtime state.
- `.env.production.local` secrets are rotated in Hostinger/Render and never committed.

## GitHub Upload Rules

- Commit source, configs, workflows, and docs only.
- Do not commit `.env.production.local`, `node_modules`, `.next`, `out`, Android build outputs, debug APKs, or signed release artifacts.
- Publish `apologia-sancta-debug.apk` only as a GitHub pre-release artifact named `v1-internal-test` or by manual Hostinger upload.

## Repeatable Smoke Command

```powershell
.\scripts\v1-smoke.ps1
```

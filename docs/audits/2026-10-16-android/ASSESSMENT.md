# Apologia Sancta Android assessment — 16 October 2026

**Decision: do not certify the current release as production/Play-ready yet.** Its baseline package security is reasonable, but update continuity, recovery, live account operation, device behaviour and store declarations still need work or evidence. Changes in this branch are source fixes; they do not change an APK already installed on a phone.

## Target and evidence boundaries

- Released artifact: [android-v1.0.3 APK](https://github.com/DocHarry22/apologiasancta-ui/releases/tag/android-v1.0.3), 7,301,602 bytes; SHA-256 `e170aec135e1e4dcdfe38e91ac54b357a5f9a75e0a5de2099ec8ed5366925cd1`, matching GitHub asset metadata.
- Source inspected: `35aca7c715b4457b49fcb1e99f9f2695ad471562`, plus the fixes accompanying this report. Current main is not assumed to be the code inside the released APK or deployed website.
- REA 6.5.0 safe artifact inspection: `ev_6a3f11dabb4788fa561a9edb8a73f67545810ccee412299ec4bf9e6af420db45`; inventory `ev_a9b7321801d39b85e7b548f0388a3f0121466a05c80da20b208725c4a5b4c303`. Complete record: [apk-rea-evidence.json.gz](apk-rea-evidence.json.gz).
- Manifest, package configuration and signing-certificate metadata were separately decoded with Androguard. See [manifest](apk-manifest.xml) and [summary](apk-static-summary.json). Signature-scheme presence is not a replacement for a new Android `apksigner` verification run.
- REA's Android decompiler could not run: its required JADX MCP JAR is absent. No REA client configuration was changed. The available REA artifact CLI did run successfully.
- No Android emulator, ADB device or Play Console was available. Chromium download failed with truncated/non-ZIP downloads, so browser end-to-end tests could not run here. No device installation, rotation, accessibility or upgrade pass is claimed.
- One read-only live request to the APK's embedded host `/api/auth/me/` returned HTTP 401 and `{"ok":false,"error":"Unauthorized"}`. It also returned HSTS, `nosniff`, frame protection and CSP. This establishes only anonymous rejection for that endpoint, not successful login or authorization across the service.

## Findings by requested area

| Area | Finding | Evidence / status |
| --- | --- | --- |
| Package identity | `com.apologiasancta.live`, version 1.0.3 / code 3, minimum API 23, target API 36 | Decoded released APK; confirmed |
| Transport | Cleartext disabled; Capacitor mixed content disabled; remote HTTPS host embedded | Manifest and `assets/capacitor.config.json`; confirmed declarations, not a full traffic capture |
| Backup/debugging | `allowBackup=false`; no manifest debug flag enabled | Released manifest; static pass |
| Permissions | Internet, vibration and a signature-protected internal receiver permission; no camera, microphone, location or package-install permission | Released manifest; minimal observed permission set |
| Login security | Salted scrypt password hashes, timing-safe verification, HttpOnly/Secure/SameSite strict production cookie, server-side session freshness and CSRF checks | Source `src/lib/auth/password.ts`, `src/app/api/auth/login/route.ts`, `src/lib/server/apiAuth.ts`; not a live penetration-test pass |
| Registration | Password whitespace was removed at signup but preserved at login, causing lockout for passwords with boundary spaces | Fixed and regression-tested in this branch |
| Password changes | Password-change endpoint accepted >256 characters although login rejected them | Fixed and regression-tested in this branch |
| Session secret | Production previously accepted a nonempty short signing secret | Now refuses secrets with fewer than 32 characters after trimming; length is not an entropy guarantee |
| Login/register interface | Labelled fields, password visibility, password-manager autocomplete, keyboard-operable tabs, loading/error states and learner/staff distinction exist | `src/components/auth/AuthExperience.tsx`; visual and touch behaviour not verified on devices |
| Recovery | No password-reset, email ownership verification or MFA flow found within inspected auth routes/components | Missing implementation; prioritize recovery and staff MFA |
| Screen adaptation | Device-width viewport, initial scale 1, viewport-fit cover, responsive CSS and safe-area bottom padding exist; no fixed manifest orientation found | `src/app/layout.tsx`, `src/app/globals.css`, released manifest; configured, not device-certified |
| Update prompts | “What's new” fetches release news and remembers a commit in Web Storage; no native installed-version comparator or Play Core update implementation found | `src/components/releases/WhatsNewPopup.tsx`, native source/plugins inventory; news is not an APK updater |
| Duplicate installations | Stable application ID is present. No evidence that this release intentionally creates a second package | Android permits only one app per application ID; a mismatched signing certificate blocks replacement, while changing the application ID creates a separate app [1] |
| Signing continuity | Release notes and source workflow identify an ephemeral distribution signing key; workflow generated and removed it | Critical release-continuity risk. The APK certificate subject is GitHub Distribution. Key recovery/retention cannot be determined from the public artifact |
| 16 KB / ABI | No `.so` files found among 413 archive entries | No bundled native-library ELF alignment issue identified. Java/Kotlin-only apps are compatible by default [4]; final AAB and device behaviour still need validation |
| Store readiness | APK target API 36 meets the current phone submission target. An AAB exists on the release, but was not downloaded or validated in this assessment | Partial technical readiness only; policy and pre-launch review remain open [3–6] |

## Where the data goes

The APK is a Capacitor WebView shell loading `https://sandybrown-bear-488955.hostingersite.com`. Its interface is remotely served rather than a fully bundled offline application. Changes to hosted pages can therefore change the experience without changing the installed Android version; native plugins and Android configuration still require a binary update. Evidence: extracted Capacitor configuration and `capacitor.config.ts`.

| Data | Location established by source | What is not established |
| --- | --- | --- |
| Accounts, password hashes, roles, session freshness | Server database selected by `DATABASE_URL` or configured MySQL variables; PostgreSQL and MySQL adapters exist in `src/lib/server/adminUserStore.ts` / `src/lib/auth/databaseConfig.ts` | Actual deployed database host, physical region, backup retention and encryption at rest |
| Browser/app login session | HttpOnly cookie in the browser/WebView cookie store; production Secure and strict SameSite attributes | Device-level extraction resistance, installed WebView lifecycle and successful live renewal |
| Learning service records | PostgreSQL through `LEARNING_DATABASE_URL`, server learning repositories | Actual production project, RLS deployment, privileges and storage location |
| Local progress, bookmarks, preferences and quiz identity/token | Web Storage; native preference helpers additionally use Capacitor Preferences | Cloud backup/sync completeness and persistence after every upgrade scenario |
| Live participation | Client communicates with configured quiz engine; account deletion code also handles competition data | Deployed engine/database configuration and complete retention policy |

Do not describe Capacitor Preferences or localStorage as encrypted secret storage. The main login cookie is HttpOnly, but the separate local quiz identity/token deserves an XSS and ownership review. Source: `src/lib/native.ts`, `src/lib/playerIdentity.ts`, `src/components/account/AccountDashboard.tsx`.

## Improvements applied

1. Preserve signup passwords exactly and enforce the same 256-character maximum during password changes and login.
2. Enforce minimum session-signing-secret length in production readiness, token creation and verification. Deploy a suitably random secret; changing it invalidates existing sessions.
3. Remove the production publishing job that generated and deleted a temporary signing key.
4. Require explicit Android release version codes/names and a pinned trusted certificate fingerprint. Reject changed certificates, reused/decreasing version codes, mismatched tags and replacement of existing release assets. Serialize release publishing.
5. Add browser regression cases for sign-in/signup at 320, 360, 412, 768 and 1024 pixel widths, landscape and reduced viewport height. These are committed for CI but were not executed here.

The new release gate intentionally refuses to publish a new-key APK over the old-key distribution. If the original key is unavailable, a seamless update cannot be promised. Recover the original key or develop a migration plan; do not quietly change the package ID. Play App Signing's app signing key and CI's upload key can differ [1,2].

## Remaining priorities

| Priority | Action | Acceptance evidence |
| --- | --- | --- |
| P0 | Locate and securely preserve the existing distribution signing key; choose the Play App Signing strategy | Certificate comparison and `adb install -r` from the released APK to the candidate, with data retained |
| P1 | Implement store-aware binary update prompting | Play Core flexible update for ordinary Play releases; immediate only when justified. Test via Play internal track. For sideloads, compare installed code with trusted release metadata and hand off to system installer without silent installation. Do not direct Play users to an external executable updater [7,8] |
| P1 | Add password recovery and email verification; MFA for privileged staff | Expiring single-use links, anti-enumeration responses, session revocation, automated abuse tests and live mail delivery |
| P1 | Use shared rate limits and recipient-bound, expiring single-use staff invites | Multiple-instance tests, trusted-proxy configuration, per-account and per-IP protection; current limits are process-local and invite codes reusable (`rateLimit.ts`, `invite.ts`) |
| P1 | Review logout token revocation | Copied token rejected after logout or a clearly documented device-session policy; current logout expires cookies while explicit revoke-all exists |
| P1 | Verify production database TLS, privileges, backups and ownership checks | Inspect deployed settings. `LEARNING_DB_SSL_MODE=require` currently disables certificate verification; use verified TLS with the correct CA where supported (`src/lib/server/learning/database.ts`) |
| P1 | Complete deletion and privacy coverage | Learner deletion exists in-app/web and clears linked data; staff self-service is blocked. Provide a valid deletion path for all applicable accounts and truthful operator contact, retention, processors and cross-border details [5] |
| P1 | Complete Play Console app-content declarations and internal testing | Data Safety, privacy/deletion URLs, app access, content rating, audience, ads declaration and pre-launch report [5,6] |
| P2 | Improve offline/startup and Android navigation experience after device observation | Test unreachable host, slow network, interruption, retry, back button, password manager and process death; remotely hosted startup must not trap users behind a splash screen |

## Required device acceptance matrix

All rows below are **pending**, not passed. Browser viewport simulation cannot replace them.

| Environment | Required observations |
| --- | --- |
| Small phone / 320–360 dp | Full signup form scrolls; submit and errors visible above keyboard; no horizontal clipping; touch targets usable |
| Modern phone / 390–430 dp | Cutout, gesture navigation, edge-to-edge safe areas, autofill, dark/light themes |
| Tablet / 600–840+ dp | Portrait, landscape, split screen and live resizing; no stretched unreadable forms |
| Foldable | Fold/unfold, state preservation, quiz continuity and keyboard transitions |
| Oldest supported API 23 + supported WebView | Cold start and JavaScript compatibility; target minimum API alone does not prove framework compatibility |
| API 35 and 36 | Insets, back navigation, rotation, large fonts/display scaling, TalkBack and permission handling |
| Upgrade | Install released version, retain account/progress, replace with same-ID/same-cert higher-code build; no second launcher app; failed/cancelled update remains usable |
| Network/process lifecycle | Offline launch, reconnect, background/resume, process kill, logout and deleted/revoked accounts |

## Validation performed

- `npm run typecheck`: passed.
- `npm test`: 65 passed, 0 failed ([log](node-tests.txt)); includes 11 Android/release checks.
- Targeted Vitest: 25 passed across four auth test files ([log](auth-tests.txt)).
- Changed TypeScript/JavaScript lint: no errors.
- Workflow YAML and shell step syntax checked; no signed release build was run in this environment.
- Android lint/build, APK installation, AAB validation, browser E2E, Play pre-launch and actual update prompting: **not verified**.

## Official references

1. [Android app update identity/signing rules](https://developer.android.com/google/play/app-updates)
2. [App signing and Play App Signing](https://developer.android.com/studio/publish/app-signing)
3. [Current target API requirement](https://support.google.com/googleplay/android-developer/answer/11926878)
4. [Play technical quality: native 64-bit and 16 KB support](https://support.google.com/googleplay/android-developer/answer/17492799)
5. [Account deletion requirements](https://support.google.com/googleplay/android-developer/answer/13327111)
6. [AAB upload and internal testing](https://developer.android.com/studio/publish/upload-bundle)
7. [Play in-app update flows](https://developer.android.com/guide/playcore/in-app-updates)

8. [Play policy on self-updates](https://support.google.com/googleplay/android-developer/answer/16559646)

# Release audit — 13 October 2026

Production release is blocked. This report distinguishes live observations from isolated checks and pending deployment validation.

## PR 38

Closed without merge at head `e1ec68e65782f1485ed3a6dc9349a45d9bf9c78c`. Android CI run 32775884375 failed API-23 compatibility lint at AppUpdaterPlugin.java:178 (`getContentLengthLong` requires API 24). UI CI run 32775884172 failed horizontal overflow at 1024×768. Other UI verification and disposable database jobs passed. The branch was 80 commits behind current main `6971fe8f212cf175fadb7e899506cf85ca9f14fd`. GitHub initially reported non-mergeability; its later closure response reported mergeable=true. Regardless of that changing signal, the failing checks prevent a safe merge.

## Real production checks

Target: https://sandybrown-bear-488955.hostingersite.com. Public diagnostics reported revision `ac95f3a5b948495325f4a220751c426af31cf8b6`, older than current main.

- Created a new public learner named Release Audit Learner with a unique example.test email. Signup reached the signed-in Account page.
- Opened Phase 1 Verification Programme → Workflow Verification → First Verification Step → Verification Lesson. Rendering passed; completion submission returned “The learning service is temporarily unavailable.”
- Started a real mastery attempt, answered the neutral A question, submitted and received 100% / Mastery achieved. Account Learning subsequently showed one mastered group after navigation/reload. Second Verification Step was accessible, but had no published lessons.
- Practice loaded its neutral question; answer checking returned the same service-unavailable message.
- Joined Global Room as ReleaseAudit, answered the seven-sacraments question, received 16 points and rank 1. Reload retained the participant and 16-point score. This is session continuity, not restart/database durability evidence.
- Research reported Knowledge Engine unavailable. The UI topics proxy and Render /knowledge/topics both returned 404. Timeline rendered its input form, but no valid canonical records were available to verify results or provenance. Linked Graph initially showed its loading state; subsequent browser observation timed out.
- Library Christology showed a bundled offline copy with 23 questions. Expanded item chr_0001 showed options; it did not demonstrate canonical provenance. Live reveal displayed citation strings, but those are not a verified provenance chain. The verification lesson had no public sources attached.
- Unauthenticated admin-learning API returned 401. No existing staff administrator or valid author/reviewer invitations were available, so successful publishing, independent review and production outbox/database validation remain blocked.
- Privacy and external deletion pages returned HTTP 200. Account deletion was not executed.

## Diagnosed failures and changes

Two isolated PostgreSQL reproductions explain the lesson/practice failures: `references` is a reserved alias and fails with SQLSTATE 42601; an uncast progress-state parameter reused as text fails type inference with SQLSTATE 42P08. This change renames the alias to `citations` and explicitly casts the progress parameter to public.lesson_progress_state. Corrected isolated queries succeeded. A new CI step prepares the actual application SQL against the migrated disposable database. Production repair remains unverified until deployed and retested.

Current main UI CI run 38457865097 failed the production dependency audit before lint/build/E2E. This change updates compatible Next 16.3.8, Capacitor 7.6.9, MySQL2 3.24.6, Sharp 0.35.5, and two transitive production overrides. The final production dependency audit reported zero vulnerabilities. Development dependency advisories remain; do not suppress or downgrade framework tooling blindly to make CI green.

Render logs repeatedly reported PostgreSQL DNS ENOTFOUND for the engine persistence target. The confirmed Render workspace listed no PostgreSQL instances. Health returned ok=true although restoration had not succeeded; configured/readiness booleans do not establish actual durability. Restoring the intended database and reconnecting the engine is an infrastructure blocker. No replacement paid database was provisioned.

The connected active Supabase project did not contain the learning tables; the default Knowledge Engine project reference in source was not among accessible projects. No deployed learning schema was changed.

## Android and Play

Downloaded android-v1.0.3 AAB SHA-256: `a59f0298c83aba5e36b29e7700f01169be45c8e94208033f5e81e989d7ebe5f8`, matching GitHub asset metadata. Google bundletool 1.18.3 validation succeeded. Manifest: package com.apologiasancta.live, versionCode 3, versionName 1.0.3, minSdk 23, target/compileSdk 36; cleartext false, backup false. Final permissions include INTERNET, VIBRATE and a signature-level internal receiver permission.

Jarsigner reported “jar verified”; warnings included the self-signed certificate, no timestamp and JarFile/JarInputStream entry-order inconsistencies. Google bundletool accepted the bundle structure. Certificate SHA-256: `E3:9C:17:C5:6D:53:64:A2:E7:4F:3C:BE:67:CE:56:07:21:7A:D7:10:9E:76:88:92:73:0F:E3:F1:60:9A:A2:2F`. This is the ephemeral GitHub distribution identity, not a verified registered Play upload certificate. The workflow deletes its ephemeral keystore. Future in-place APK releases need a retained compatible signing key; matching package names alone are insufficient.

No Android SDK/platform-tools existed at the configured ANDROID_HOME, and no device/emulator was tested. No install, upgrade, API-23/API-36 or 16 KB device pass is claimed. Current main Android CI passed its debug build; its distribution-release job was skipped. That does not validate a new signed Play candidate.

Privacy page lacks an accountable developer contact and detailed retention/third-party processing statements. Data Safety must be reconciled with deployed hosting and live participant data. Console Data Safety, app access, content rating, target audience, listing assets, versionCode availability, signing registration, app integrity and pre-launch reports remain unverified. Play Console navigation was blocked by automatic approval review after redirect to google.play; no upload or submission was performed.

Official policy references: https://support.google.com/googleplay/android-developer/answer/11926878 (API 36 requirement), https://support.google.com/googleplay/android-developer/answer/10787469 (Data Safety), https://support.google.com/googleplay/android-developer/answer/13327111 (account deletion).

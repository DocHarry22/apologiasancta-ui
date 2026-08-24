# Apologia Sancta — Google Play Release Runbook

Last updated: 24 August 2026

## Release identity

- Application ID: `com.apologiasancta.live`
- App name: `Apologia Sancta`
- Android minimum SDK: 23
- Android compile SDK: 36
- Android target SDK: 36
- Store upload artifact: Android App Bundle (`app-release.aab`)
- Direct-install artifact: signed APK (`app-release.apk`)

Google Play requires new apps and app updates to target Android 16 / API 36 from 31 August 2026. This repository targets API 36 now rather than relying on the expiring API 35 window.

References:
- https://support.google.com/googleplay/android-developer/answer/11926878
- https://developer.android.com/google/play/requirements/target-sdk

## Repository-enforced release gates

The signed Android release workflow must pass all of these before an artifact is published:

1. Java 21 and the pinned Gradle/Android Gradle Plugin toolchain.
2. Android SDK platform 36 is installed.
3. Capacitor production sync succeeds with an HTTPS production application URL.
4. All four release-signing secrets are present.
5. `lintRelease` succeeds.
6. Both `assembleRelease` and `bundleRelease` succeed.
7. The APK reports `targetSdkVersion:'36'`.
8. `zipalign -c -P 16 -v 4` succeeds for 16 KB page-size ZIP alignment validation.
9. `apksigner` verifies the APK and rejects an Android debug certificate.
10. `jarsigner` positively verifies the AAB.
11. SHA-256 checksums are generated for every published APK/AAB.

## GitHub Actions configuration

Repository secrets required by **Android signed release**:

- `ANDROID_KEYSTORE_BASE64`
- `ANDROID_KEYSTORE_PASSWORD`
- `ANDROID_KEY_ALIAS`
- `ANDROID_KEY_PASSWORD`

Repository variables recommended:

- `ANDROID_APP_URL` — canonical production HTTPS URL used by the Capacitor app.
- `ANDROID_ENGINE_URL` — production quiz/engine URL.
- `ANDROID_GRAPH_URL` — production Apologia Graph URL.

Do not publish with localhost, a LAN address, HTTP, a staging deployment, or an obsolete Hostinger preview URL baked into the app.

## Producing the Play bundle

Preferred path:

1. Open **Actions → Android signed release**.
2. Use a monotonically increasing positive `version_code`.
3. Use the public semantic `version_name` (for example `1.0.0`).
4. Confirm the production app URL.
5. Run the workflow.
6. Download `apologia-sancta.aab` from the signed workflow artifact.
7. Upload that AAB to the intended Google Play track.

The local `npm run apk:release` path also builds both the signed APK and AAB and runs release lint. It requires the same production URL and signing environment variables.

## Play App Signing

Use Google Play App Signing for the Play application and preserve the upload key securely. The repository signing key used by CI should be the Play upload key, not a disposable debug key.

Reference: https://developer.android.com/guide/app-bundle/faq

## Privacy and account deletion

The app supports public learner account creation, therefore account deletion must remain available both in-app and on the web.

Implemented surfaces:

- Privacy policy: `/privacy`
- External account deletion page: `/account/delete`
- Native Account screen exposes a direct **Delete account** shortcut.
- Authenticated `DELETE /api/auth/me` requires a valid session, CSRF token, public learner account, and explicit `DELETE` confirmation.
- Learner profile, lesson progress, bookmarks, mastery attempts/answers, unlocks, review schedule, and derived mastery data are deleted.
- Historical live-quiz participant rows are anonymised by removing account linkage, display name, external participant key, and participant metadata before the learner profile is removed.
- Local browser/app storage is cleared after successful self-service deletion.

Google Play account-deletion policy reference:
https://support.google.com/googleplay/android-developer/answer/13327111

Before production publication, set the Play Console account-deletion URL to the deployed canonical form of `/account/delete` and the privacy-policy URL to the deployed canonical form of `/privacy`.

## Play Console declarations still performed in Play Console

These are store-account operations and are not representable safely as source code:

- Create/verify the Google Play developer application record.
- Enrol the app in Play App Signing and register the upload certificate.
- Enter the production privacy-policy URL.
- Enter the external account-deletion URL.
- Complete the Data Safety form from the deployed production behaviour.
- Complete the Content Rating questionnaire so the app is not left unrated.
- Complete Target Audience and Content declarations.
- Declare whether the app contains ads. Do not infer this from store defaults.
- Complete App Access instructions and provide reviewer credentials if any reviewed surface requires sign-in.
- Supply the developer/support contact required by the Play listing.
- Upload the store icon, feature graphic, phone screenshots and any tablet/Chromebook screenshots Play Console requests for enabled form factors.
- Select countries/regions, pricing, testing track and production rollout.
- Resolve every Play pre-launch report or policy warning before production rollout.

Data Safety reference:
https://support.google.com/googleplay/android-developer/answer/10787469

Content rating reference:
https://support.google.com/googleplay/android-developer/answer/9859655

## Release smoke-test matrix

Before promoting an AAB from testing to production, verify on real or Play-managed devices:

- cold launch and splash transition;
- sign up, sign in and sign out;
- password/session controls;
- account deletion from the native Account experience;
- external `/account/delete` flow in a normal browser;
- Learn loading, progress persistence and mastery submission;
- Library loading/bookmarks;
- live quiz join, answer, reconnect and leaderboard;
- Research/Graph handoff;
- dark/light/system themes;
- edge-to-edge layouts, display cutouts and gesture navigation;
- rotation where supported;
- offline/network-loss behaviour and recovery;
- Android back behaviour;
- API 36 device/emulator;
- at least one 16 KB page-size Android environment when native libraries are present in the final bundle.

## Release decision

A release is Play-ready only when repository CI is green **and** the Play Console has no blocking policy, app-content, signing, device-compatibility, or pre-launch findings. Source-code readiness alone is not a substitute for the store's own review gates.

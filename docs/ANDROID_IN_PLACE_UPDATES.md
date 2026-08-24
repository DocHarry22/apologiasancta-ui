# Android in-place updates

Apologia Sancta Android uses one permanent application identity: `com.apologiasancta.live`.

## Release contract

Every signed Android release must:

1. use the same `applicationId`;
2. use the same production signing key as the installed release;
3. use a `versionCode` greater than the previous production version;
4. publish `apologia-sancta.apk` and `android-update.json` to an `android-v*` GitHub release.

Android will only replace the existing installation when the package identity and signing identity are compatible and the candidate version is newer. If any of these checks fail, Android refuses the update rather than installing it over the existing application.

## Update discovery

The remotely served Capacitor UI calls `/api/android/update`. The endpoint reads only non-draft, non-prerelease `android-v*` releases and validates the updater manifest before returning it to the client.

The native app checks shortly after startup, every 30 minutes while running, and when returning to the foreground. An update prompt is shown only when `latest.versionCode > installed.versionCode`. Choosing **Later** suppresses that version only; a later versionCode is eligible to prompt again.

## Installation behavior

- Builds installed through Google Play open the Play Store package page.
- Direct/sideload builds open the signed GitHub APK through the user's trusted browser/download surface.
- The app deliberately does **not** request `REQUEST_INSTALL_PACKAGES` and does not silently install APKs.
- The Android package installer remains the authority for package/signing/version compatibility.

## Existing APK bootstrap

An APK installed before the native `AppUpdater` bridge existed still loads the latest production web UI. It can therefore see the update prompt; the first update falls back to the release download surface. Once that update is installed, future releases use the native updater bridge.

## Play Store note

Google Play distribution should continue to use Play-managed updates. The updater intentionally routes Play-installed copies back to Google Play instead of attempting direct APK installation.

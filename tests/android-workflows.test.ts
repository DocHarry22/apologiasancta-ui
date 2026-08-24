import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const debugWorkflow = readFileSync(join(repositoryRoot, ".github", "workflows", "android.yml"), "utf8");
const releaseWorkflow = readFileSync(join(repositoryRoot, ".github", "workflows", "android-release.yml"), "utf8");
const baseStyles = readFileSync(join(repositoryRoot, "android", "app", "src", "main", "res", "values", "styles.xml"), "utf8");
const api28Styles = readFileSync(join(repositoryRoot, "android", "app", "src", "main", "res", "values-v28", "styles.xml"), "utf8");
const apkSyncScript = readFileSync(join(repositoryRoot, "scripts", "sync-latest-apk.cjs"), "utf8");
const androidVariables = readFileSync(join(repositoryRoot, "android", "variables.gradle"), "utf8");
const rootGradle = readFileSync(join(repositoryRoot, "android", "build.gradle"), "utf8");
const appGradle = readFileSync(join(repositoryRoot, "android", "app", "build.gradle"), "utf8");
const androidManifest = readFileSync(join(repositoryRoot, "android", "app", "src", "main", "AndroidManifest.xml"), "utf8");
const releaseBuildScript = readFileSync(join(repositoryRoot, "scripts", "build-release-apk.cjs"), "utf8");
const updaterPlugin = readFileSync(join(repositoryRoot, "android", "app", "src", "main", "java", "com", "apologiasancta", "live", "AppUpdaterPlugin.java"), "utf8");
const mainActivity = readFileSync(join(repositoryRoot, "android", "app", "src", "main", "java", "com", "apologiasancta", "live", "MainActivity.java"), "utf8");
const updateRoute = readFileSync(join(repositoryRoot, "src", "app", "api", "android", "update", "route.ts"), "utf8");
const apkProxyRoute = readFileSync(join(repositoryRoot, "src", "app", "api", "android", "update", "apk", "route.ts"), "utf8");
const updateManager = readFileSync(join(repositoryRoot, "src", "components", "native", "AndroidUpdateManager.tsx"), "utf8");
const updaterClient = readFileSync(join(repositoryRoot, "src", "lib", "androidUpdater.ts"), "utf8");

test("Android debug CI validates an API 36 APK without secrets", () => {
  assert.match(debugWorkflow, /pull_request:\s*\n\s+branches: \[main\]/);
  assert.match(debugWorkflow, /android-actions\/setup-android@v4/);
  assert.match(debugWorkflow, /java-version: 21/);
  assert.match(debugWorkflow, /platforms;android-36/);
  assert.match(debugWorkflow, /build-tools;35\.0\.0/);
  assert.match(debugWorkflow, /gradle\/actions\/setup-gradle@v6/);
  assert.match(debugWorkflow, /testDebugUnitTest lintDebug assembleDebug/);
  assert.match(debugWorkflow, /targetSdkVersion:'36'/);
  assert.match(debugWorkflow, /zipalign" -c -P 16 -v 4/);
  assert.match(debugWorkflow, /apksigner" verify --verbose/);
  assert.doesNotMatch(debugWorkflow, /secrets\./);
});

test("Android native project targets Android 16 with a compatible build toolchain", () => {
  assert.match(androidVariables, /compileSdkVersion = 36/);
  assert.match(androidVariables, /targetSdkVersion = 36/);
  assert.match(rootGradle, /com\.android\.tools\.build:gradle:8\.13\.2/);
});

test("signed release builds are gated by every required secret", () => {
  for (const secretName of ["ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD", "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"]) {
    assert.match(releaseWorkflow, new RegExp(`secrets\\.${secretName}`));
  }
  assert.match(releaseWorkflow, /if: needs\.signing-preflight\.outputs\.ready == 'true'/);
  assert.match(releaseWorkflow, /umask 077/);
  assert.match(releaseWorkflow, /lintRelease assembleRelease bundleRelease/);
  assert.match(releaseWorkflow, /platforms;android-36/);
  assert.match(releaseWorkflow, /targetSdkVersion:'36'/);
  assert.match(releaseWorkflow, /zipalign" -c -P 16 -v 4/);
  assert.match(releaseWorkflow, /gradle\/actions\/setup-gradle@v6/);
  assert.match(releaseWorkflow, /java-version: 21/);
  assert.doesNotMatch(releaseWorkflow, /jarsigner -verify -strict/);
  assert.match(releaseWorkflow, /apologia-sancta\.aab/);
  assert.match(releaseWorkflow, /apologia-sancta\.apk/);
  assert.match(releaseWorkflow, /if: always\(\)/);
  assert.doesNotMatch(releaseWorkflow, /set\s+-x/);
  assert.doesNotMatch(releaseWorkflow, /pull_request:/);
  const appUrlInput = releaseWorkflow.match(/^ {6}app_url:\r?\n(?: {8}.+(?:\r?\n|$))+/m);
  assert.ok(appUrlInput, "app_url workflow input must remain declared");
  assert.doesNotMatch(appUrlInput[0], /^ {8}default:/m);
});

test("signed release requires jarsigner to positively verify the AAB", () => {
  assert.match(releaseWorkflow, /apksigner" \\\n\s+verify --verbose --print-certs/);
  assert.match(releaseWorkflow, /grep -Fqi "CN=Android Debug"/);
  assert.match(releaseWorkflow, /Refusing to publish an APK signed with the Android debug certificate/);
  assert.match(releaseWorkflow, /-J-Duser\.language=en/);
  assert.match(releaseWorkflow, /-J-Duser\.country=US/);
  assert.match(releaseWorkflow, /-verify "\$aab_path" 2>&1/);
  assert.match(releaseWorkflow, /grep -Fqx "jar verified\." <<< "\$aab_verification"/);
  assert.doesNotMatch(releaseWorkflow, /jarsigner\s+-verify "\$aab_path"\s*>\/dev\/null/);
});

test("release app enforces HTTPS transport and excludes Android backup", () => {
  assert.match(appGradle, /manifestPlaceholders\["usesCleartextTraffic"\] = "false"/);
  assert.match(appGradle, /proguard-android-optimize\.txt/);
  assert.match(androidManifest, /android:allowBackup="false"/);
  assert.match(androidManifest, /android:usesCleartextTraffic="\$\{usesCleartextTraffic\}"/);
});

test("local release task produces both signed APK and Play Store AAB", () => {
  assert.match(releaseBuildScript, /lintRelease", "assembleRelease", "bundleRelease/);
  assert.match(releaseBuildScript, /outputs", "bundle", "release", "app-release\.aab"/);
  assert.match(releaseBuildScript, /Expected Play Store AAB not found/);
});

test("Capacitor Java 21 compatibility is not downgraded in Gradle", () => {
  assert.doesNotMatch(rootGradle, /JavaVersion\.VERSION_17/);
  assert.doesNotMatch(appGradle, /JavaVersion\.VERSION_17/);
});

test("display-cutout styling is limited to Android API 28 and newer", () => {
  assert.doesNotMatch(baseStyles, /windowLayoutInDisplayCutoutMode/);
  assert.match(api28Styles, /windowLayoutInDisplayCutoutMode/);
});

test("public APK sync rejects debug-signed build artifacts", () => {
  assert.match(apkSyncScript, /jarsigner/);
  assert.match(apkSyncScript, /CN=Android Debug/);
  assert.match(apkSyncScript, /Refusing to publish an APK signed with the Android debug certificate/);
  assert.doesNotMatch(apkSyncScript, /outputs", "apk", "debug"/);
});

test("Android releases publish machine-readable update metadata for the same app identity", () => {
  assert.match(appGradle, /applicationId "com\.apologiasancta\.live"/);
  assert.match(appGradle, /versionCode releaseVersionCode/);
  assert.match(releaseWorkflow, /android-update\.json/);
  assert.match(releaseWorkflow, /"packageName": "com\.apologiasancta\.live"/);
  assert.match(releaseWorkflow, /"versionCode": \$APP_VERSION_CODE/);
  assert.match(releaseWorkflow, /"apkUrl": "https:\/\/github\.com\/DocHarry22\/apologiasancta-ui\/releases\/download\/\$RELEASE_TAG\/apologia-sancta\.apk"/);
  assert.match(releaseWorkflow, /apk_sha256=.*sha256sum/);
  assert.match(releaseWorkflow, /sha256sum \.\/\*\.apk \.\/\*\.aab android-update\.json > SHA256SUMS/);
});

test("native updater authenticates a direct APK before advertising or opening it", () => {
  assert.match(mainActivity, /registerPlugin\(AppUpdaterPlugin\.class\)/);
  assert.match(updaterPlugin, /@CapacitorPlugin\(name = "AppUpdater"\)/);
  assert.match(updaterPlugin, /void validateUpdate\(PluginCall call\)/);
  assert.match(updaterPlugin, /PackageManager\.GET_SIGNING_CERTIFICATES/);
  assert.match(updaterPlugin, /getPackageArchiveInfo\(candidate\.getAbsolutePath\(\), signingFlags\)/);
  assert.match(updaterPlugin, /Android update APK package mismatch/);
  assert.match(updaterPlugin, /Android update APK digest mismatch/);
  assert.match(updaterPlugin, /signing certificate does not match the installed app/);
  assert.match(updaterPlugin, /validatedAssetApiUrl/);
  assert.match(updaterPlugin, /Android update must be validated before installation/);
  assert.doesNotMatch(updaterPlugin, /REQUEST_INSTALL_PACKAGES/);
  assert.match(updateManager, /validateAndroidUpdate\(latest, current\)/);
});

test("Play updates stay on Play and legacy APKs require an explicit source choice", () => {
  assert.match(updaterPlugin, /PLAY_INSTALLER = "com\.android\.vending"/);
  assert.match(updaterPlugin, /market:\/\/details\?id=/);
  assert.match(updaterPlugin, /PLAY_WEB_URL/);
  assert.doesNotMatch(updaterClient, /window\.open\(update\.apkUrl/);
  assert.match(updaterClient, /openLegacyAndroidUpdate/);
  assert.match(updateManager, /Update from Google Play/);
  assert.match(updateManager, /Open official APK release page/);
  assert.match(updateManager, /nativeUpdaterAvailable/);
});

test("update discovery ranks bounded release manifests by greatest versionCode", () => {
  assert.match(updateRoute, /MAX_RELEASES = 20/);
  assert.match(updateRoute, /RELEASE_TAG_PATTERN/);
  assert.match(updateRoute, /Promise\.all\(releases\.map/);
  assert.match(updateRoute, /right\.versionCode - left\.versionCode/);
  assert.match(updateRoute, /APK_ASSET_NAME = "apologia-sancta\.apk"/);
  assert.match(updateRoute, /apkAssetApiUrl/);
  assert.match(updateRoute, /new URL\("\/api\/android\/update\/apk", request\.url\)/);
});

test("update APK proxy binds the downloaded GitHub asset to the advertised SHA-256", () => {
  assert.match(apkProxyRoute, /ASSET_API_PREFIX = "https:\/\/api\.github\.com\/repos\/DocHarry22\/apologiasancta-ui\/releases\/assets\/"/);
  assert.match(apkProxyRoute, /Accept: "application\/octet-stream"/);
  assert.match(apkProxyRoute, /MAX_APK_BYTES/);
  assert.match(apkProxyRoute, /createHash\("sha256"\)/);
  assert.match(apkProxyRoute, /timingSafeEqual/);
  assert.match(apkProxyRoute, /application\/vnd\.android\.package-archive/);
  assert.match(updaterPlugin, /bridge\.getServerUrl\(\)/);
  assert.match(updaterPlugin, /\/api\/android\/update\/apk/);
});

test("update checks remain periodic, foreground-aware and versionCode-gated", () => {
  assert.match(updateManager, /UPDATE_CHECK_INTERVAL_MS = 30 \* 60 \* 1000/);
  assert.match(updateManager, /latest\.versionCode <= current\.versionCode/);
  assert.match(updateManager, /visibilitychange/);
  assert.match(updateManager, /Android update available/);
  assert.match(updaterClient, /download\.origin !== window\.location\.origin/);
  assert.match(updaterClient, /RELEASE_URL_PATTERN/);
});

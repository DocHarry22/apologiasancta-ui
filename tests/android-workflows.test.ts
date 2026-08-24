import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import test from "node:test";

const repositoryRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const debugWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "android.yml"),
  "utf8",
);
const releaseWorkflow = readFileSync(
  join(repositoryRoot, ".github", "workflows", "android-release.yml"),
  "utf8",
);
const baseStyles = readFileSync(
  join(repositoryRoot, "android", "app", "src", "main", "res", "values", "styles.xml"),
  "utf8",
);
const api28Styles = readFileSync(
  join(
    repositoryRoot,
    "android",
    "app",
    "src",
    "main",
    "res",
    "values-v28",
    "styles.xml",
  ),
  "utf8",
);
const apkSyncScript = readFileSync(
  join(repositoryRoot, "scripts", "sync-latest-apk.cjs"),
  "utf8",
);
const androidVariables = readFileSync(
  join(repositoryRoot, "android", "variables.gradle"),
  "utf8",
);
const rootGradle = readFileSync(
  join(repositoryRoot, "android", "build.gradle"),
  "utf8",
);
const appGradle = readFileSync(
  join(repositoryRoot, "android", "app", "build.gradle"),
  "utf8",
);
const androidManifest = readFileSync(
  join(repositoryRoot, "android", "app", "src", "main", "AndroidManifest.xml"),
  "utf8",
);
const releaseBuildScript = readFileSync(
  join(repositoryRoot, "scripts", "build-release-apk.cjs"),
  "utf8",
);

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
  for (const secretName of [
    "ANDROID_KEYSTORE_BASE64",
    "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS",
    "ANDROID_KEY_PASSWORD",
  ]) {
    assert.match(releaseWorkflow, new RegExp(`secrets\\.${secretName}`));
  }

  assert.match(
    releaseWorkflow,
    /if: needs\.signing-preflight\.outputs\.ready == 'true'/,
  );
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
  const appUrlInput = releaseWorkflow.match(
    /^ {6}app_url:\r?\n(?: {8}.+(?:\r?\n|$))+/m,
  );
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
  assert.match(
    releaseWorkflow,
    /grep -Fqx "jar verified\." <<< "\$aab_verification"/,
  );
  assert.doesNotMatch(
    releaseWorkflow,
    /jarsigner\s+-verify "\$aab_path"\s*>\/dev\/null/,
  );
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

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
const appGradle = readFileSync(
  join(repositoryRoot, "android", "app", "build.gradle"),
  "utf8",
);
const updaterPlugin = readFileSync(
  join(repositoryRoot, "android", "app", "src", "main", "java", "com", "apologiasancta", "live", "AppUpdaterPlugin.java"),
  "utf8",
);
const mainActivity = readFileSync(
  join(repositoryRoot, "android", "app", "src", "main", "java", "com", "apologiasancta", "live", "MainActivity.java"),
  "utf8",
);
const updateRoute = readFileSync(
  join(repositoryRoot, "src", "app", "api", "android", "update", "route.ts"),
  "utf8",
);
const updateManager = readFileSync(
  join(repositoryRoot, "src", "components", "native", "AndroidUpdateManager.tsx"),
  "utf8",
);

test("Android debug CI installs the pinned SDK and validates the APK without secrets", () => {
  assert.match(debugWorkflow, /pull_request:\s*\n\s+branches: \[main\]/);
  assert.match(debugWorkflow, /android-actions\/setup-android@v4/);
  assert.match(debugWorkflow, /java-version: 21/);
  assert.match(debugWorkflow, /platforms;android-35/);
  assert.match(debugWorkflow, /build-tools;35\.0\.0/);
  assert.match(debugWorkflow, /gradle\/actions\/setup-gradle@v6/);
  assert.match(debugWorkflow, /testDebugUnitTest lintDebug assembleDebug/);
  assert.match(debugWorkflow, /apksigner" verify --verbose/);
  assert.doesNotMatch(debugWorkflow, /secrets\./);
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
  assert.match(releaseWorkflow, /assembleRelease bundleRelease/);
  assert.match(releaseWorkflow, /gradle\/actions\/setup-gradle@v6/);
  assert.match(releaseWorkflow, /java-version: 21/);
  assert.doesNotMatch(releaseWorkflow, /jarsigner -verify -strict/);
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

test("Capacitor Java 21 compatibility is not downgraded in Gradle", () => {
  const rootGradle = readFileSync(
    join(repositoryRoot, "android", "build.gradle"),
    "utf8",
  );

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
});

test("native updater reads installed version and hands updates to the trusted Android install surface", () => {
  assert.match(mainActivity, /registerPlugin\(AppUpdaterPlugin\.class\)/);
  assert.match(updaterPlugin, /@CapacitorPlugin\(name = "AppUpdater"\)/);
  assert.match(updaterPlugin, /getLongVersionCode\(\)/);
  assert.match(updaterPlugin, /EXPECTED_PACKAGE = "com\.apologiasancta\.live"/);
  assert.match(updaterPlugin, /"com\.android\.vending"\.equals\(installerPackage\)/);
  assert.match(updaterPlugin, /market:\/\/details\?id=/);
  assert.match(updaterPlugin, /new Intent\(Intent\.ACTION_VIEW, Uri\.parse\(apkUrl\)\)/);
  assert.doesNotMatch(updaterPlugin, /REQUEST_INSTALL_PACKAGES/);
});

test("update discovery is bounded, same-package only, and rechecks on startup and foreground", () => {
  assert.match(updateRoute, /EXPECTED_PACKAGE = "com\.apologiasancta\.live"/);
  assert.match(updateRoute, /tag_name\.startsWith\("android-v"\)/);
  assert.match(updateRoute, /next: \{ revalidate: 300 \}/);
  assert.match(updateRoute, /\/\^\[a-f0-9\]\{64\}\$\/i/);
  assert.match(updateManager, /UPDATE_CHECK_INTERVAL_MS = 30 \* 60 \* 1000/);
  assert.match(updateManager, /latest\.versionCode <= current\.versionCode/);
  assert.match(updateManager, /visibilitychange/);
  assert.match(updateManager, /Android update available/);
  assert.match(updateManager, /same app identity/);
});

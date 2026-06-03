/* eslint-disable @typescript-eslint/no-require-imports */
const { chmodSync, existsSync } = require("node:fs");
const { spawnSync } = require("node:child_process");
const { join } = require("node:path");
const pkg = require("../package.json");
const { syncLatestApk } = require("./sync-latest-apk.cjs");

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32",
    env: process.env,
    ...options,
  });

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

if (!process.env.CAPACITOR_BUILD_MODE) {
  process.env.CAPACITOR_BUILD_MODE = "production";
}

if (!process.env.CAPACITOR_SERVER_URL && !process.env.NEXT_PUBLIC_APP_URL) {
  throw new Error("Set CAPACITOR_SERVER_URL or NEXT_PUBLIC_APP_URL to the production HTTPS app URL before building the APK.");
}

if (!process.env.APKSIGN_KEY_PASSWORD && process.env.APKSIGN_KEYSTORE_PASSWORD) {
  process.env.APKSIGN_KEY_PASSWORD = process.env.APKSIGN_KEYSTORE_PASSWORD;
}

if (!process.env.APKSIGN_KEYSTORE || !process.env.APKSIGN_KEYSTORE_PASSWORD || !process.env.APKSIGN_KEY_ALIAS || !process.env.APKSIGN_KEY_PASSWORD) {
  throw new Error("Release signing is required. Set APKSIGN_KEYSTORE, APKSIGN_KEYSTORE_PASSWORD, APKSIGN_KEY_ALIAS, and APKSIGN_KEY_PASSWORD.");
}

run("npx", ["cap", "sync", "android"]);

const gradleCommand = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
if (process.platform !== "win32") {
  chmodSync(join(process.cwd(), "android", "gradlew"), 0o755);
}
run(gradleCommand, ["assembleRelease"], { cwd: join(process.cwd(), "android") });

const apkPath = join(process.cwd(), "android", "app", "build", "outputs", "apk", "release", "app-release.apk");
if (!existsSync(apkPath)) {
  throw new Error(`Expected release APK not found at ${apkPath}`);
}

const version = process.env.APP_VERSION_NAME || pkg.version;
syncLatestApk({ sourceApkPath: apkPath, version });

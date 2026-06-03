/* eslint-disable @typescript-eslint/no-require-imports */
const { copyFileSync, existsSync, mkdirSync, statSync } = require("node:fs");
const { join, resolve } = require("node:path");
const pkg = require("../package.json");

function getExistingApkCandidates(candidates) {
  return candidates.filter((filePath) => existsSync(filePath));
}

function getNewestFile(filePaths) {
  return filePaths
    .map((filePath) => ({ filePath, mtimeMs: statSync(filePath).mtimeMs }))
    .sort((a, b) => b.mtimeMs - a.mtimeMs)[0]?.filePath;
}

function syncLatestApk(options = {}) {
  const cwd = process.cwd();
  const version = options.version || process.env.APP_VERSION_NAME || pkg.version;
  const explicitSource = options.sourceApkPath || process.env.APK_SOURCE;

  const sourceCandidates = [
    ...(explicitSource ? [resolve(cwd, explicitSource)] : []),
    join(cwd, "android", "app", "build", "outputs", "apk", "release", "app-release.apk"),
    join(cwd, "android", "app", "build", "outputs", "apk", "debug", "apologia-sancta-debug.apk"),
    join(cwd, "android", "app", "build", "outputs", "apk", "debug", "app-debug.apk"),
    join(cwd, "..", "release-artifacts", "apologia-sancta.apk"),
  ];

  const existingCandidates = getExistingApkCandidates(sourceCandidates);
  if (existingCandidates.length === 0) {
    throw new Error(
      [
        "No APK source file found.",
        "Build an APK first or set APK_SOURCE to the APK path.",
        `Checked: ${sourceCandidates.join(", ")}`,
      ].join(" ")
    );
  }

  const apkSource = getNewestFile(existingCandidates);
  if (!apkSource) {
    throw new Error("Unable to resolve newest APK source file.");
  }

  const downloadsDir = join(cwd, "public", "downloads");
  const artifactsDir = join(cwd, "..", "release-artifacts");
  mkdirSync(downloadsDir, { recursive: true });
  mkdirSync(artifactsDir, { recursive: true });

  for (const targetDir of [downloadsDir, artifactsDir]) {
    copyFileSync(apkSource, join(targetDir, "apologia-sancta.apk"));
    copyFileSync(apkSource, join(targetDir, `apologia-sancta-v${version}.apk`));
  }

  console.log(`Synced APK from ${apkSource}`);
  console.log(`Updated public/downloads/apologia-sancta.apk and release-artifacts/apologia-sancta-v${version}.apk`);
}

if (require.main === module) {
  syncLatestApk();
}

module.exports = { syncLatestApk };

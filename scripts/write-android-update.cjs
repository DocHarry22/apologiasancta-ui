/* eslint-disable @typescript-eslint/no-require-imports -- Executed directly by Node in Android release CI. */
const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");

const APPLICATION_ID = "com.apologiasancta.live";
const RELEASES = "https://github.com/DocHarry22/apologiasancta-ui/releases";

function readApkIdentity(badging, verification) {
  const applicationId = /^package:.*?name='([^']+)'/m.exec(badging ?? "")?.[1];
  const versionCode = Number(/^package:.*?versionCode='([1-9][0-9]*)'/m.exec(badging ?? "")?.[1]);
  const versionName = /^package:.*?versionName='([^']+)'/m.exec(badging ?? "")?.[1];
  const certificates = [...(verification ?? "").matchAll(/^Signer #\d+ certificate SHA-256 digest: ([a-f0-9]{64})\s*$/gim)];
  if (applicationId !== APPLICATION_ID || !Number.isInteger(versionCode) || versionCode < 1 || versionCode > 2100000000 ||
      !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(versionName ?? "") ||
      certificates.length !== 1 || /CN=Android Debug/i.test(verification ?? "")) {
    throw new Error("Android update requires the official application ID, valid version, and one release signing certificate.");
  }
  return { applicationId, versionCode, versionName, signingCertSha256: certificates[0][1].toLowerCase() };
}

function createAndroidUpdate({ badging, verification, apkSha256, releaseTag }) {
  const identity = readApkIdentity(badging, verification);
  if (releaseTag !== `android-v${identity.versionName}` || !/^[a-f0-9]{64}$/i.test(apkSha256 ?? "")) {
    throw new Error("Update tag/hash does not match the verified APK.");
  }
  return {
    schemaVersion: 1, ...identity,
    apkUrl: `${RELEASES}/download/${releaseTag}/apologia-sancta.apk`,
    releaseUrl: `${RELEASES}/tag/${releaseTag}`, apkSha256: apkSha256.toLowerCase(),
  };
}

function validateAndroidUpgrade({ previousBadging, previousVerification, update }) {
  const previous = readApkIdentity(previousBadging, previousVerification);
  if (previous.applicationId !== update.applicationId || previous.signingCertSha256 !== update.signingCertSha256 ||
      update.versionCode <= previous.versionCode) {
    throw new Error("Update must preserve the installed application's signing identity and increase its versionCode. Recover the original signing key if it changed.");
  }
}

module.exports = { createAndroidUpdate, validateAndroidUpgrade };

if (require.main === module) {
  if (process.argv[2] === "--check-upgrade") {
    validateAndroidUpgrade({
      previousBadging: process.env.PREVIOUS_APK_BADGING,
      previousVerification: process.env.PREVIOUS_APK_VERIFICATION,
      update: JSON.parse(readFileSync(process.argv[3], "utf8")),
    });
  } else {
    const [, , apkPath, outputPath, releaseTag] = process.argv;
    const update = createAndroidUpdate({
      badging: process.env.APK_BADGING, verification: process.env.APK_VERIFICATION,
      apkSha256: createHash("sha256").update(readFileSync(apkPath)).digest("hex"), releaseTag,
    });
    if (update.versionCode !== Number(process.env.APP_VERSION_CODE) || update.versionName !== process.env.APP_VERSION_NAME) {
      throw new Error("Built APK version does not match the requested release version.");
    }
    writeFileSync(outputPath, `${JSON.stringify(update, null, 2)}\n`);
  }
}

const MAX_ANDROID_VERSION_CODE = 2_100_000_000;
const SEMVER_PATTERN = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const FINGERPRINT_PATTERN = /^[a-f0-9]{64}$/i;

function validateReleaseConfiguration({
  versionCode,
  versionName,
  releaseTag,
  signingCertSha256,
  previousVersionCode,
}) {
  if (!/^[1-9]\d*$/.test(versionCode ?? "")) {
    throw new Error("APP_VERSION_CODE must be a positive integer without leading zeroes.");
  }

  const numericVersionCode = Number(versionCode);
  if (!Number.isSafeInteger(numericVersionCode) || numericVersionCode > MAX_ANDROID_VERSION_CODE) {
    throw new Error(`APP_VERSION_CODE must be between 1 and ${MAX_ANDROID_VERSION_CODE}.`);
  }

  if (!SEMVER_PATTERN.test(versionName ?? "")) {
    throw new Error("APP_VERSION_NAME must be a three-part numeric version such as 1.0.4.");
  }

  if (releaseTag !== `android-v${versionName}`) {
    throw new Error("RELEASE_TAG must equal android-v followed by APP_VERSION_NAME.");
  }

  if (!FINGERPRINT_PATTERN.test(signingCertSha256 ?? "")) {
    throw new Error("ANDROID_SIGNING_CERT_SHA256 must be a 64-character SHA-256 fingerprint.");
  }

  if (previousVersionCode !== undefined && previousVersionCode !== "") {
    if (!/^[1-9]\d*$/.test(previousVersionCode)) {
      throw new Error("PREVIOUS_VERSION_CODE must be a positive integer.");
    }
    if (numericVersionCode <= Number(previousVersionCode)) {
      throw new Error("APP_VERSION_CODE must be greater than PREVIOUS_VERSION_CODE.");
    }
  }

  return {
    versionCode: numericVersionCode,
    versionName,
    releaseTag,
    signingCertSha256: signingCertSha256.toLowerCase(),
  };
}

module.exports = { MAX_ANDROID_VERSION_CODE, validateReleaseConfiguration };

if (require.main === module) {
  validateReleaseConfiguration({
    versionCode: process.env.APP_VERSION_CODE,
    versionName: process.env.APP_VERSION_NAME,
    releaseTag: process.env.RELEASE_TAG,
    signingCertSha256: process.env.ANDROID_SIGNING_CERT_SHA256,
    previousVersionCode: process.env.PREVIOUS_VERSION_CODE,
  });
}

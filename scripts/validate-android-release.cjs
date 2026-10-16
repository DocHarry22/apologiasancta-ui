const MAX_VERSION_CODE = 2100000000;

function validateAndroidRelease({ versionCode, versionName, previousVersionCode }) {
  if (!/^[1-9][0-9]*$/.test(String(versionCode ?? "")) || Number(versionCode) > MAX_VERSION_CODE) {
    throw new Error(`APP_VERSION_CODE must be an explicit integer from 1 to ${MAX_VERSION_CODE}.`);
  }
  if (!/^[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?$/.test(String(versionName ?? ""))) {
    throw new Error("APP_VERSION_NAME must be an explicit semantic version such as 1.0.4.");
  }
  if (previousVersionCode !== undefined) {
    if (!/^[1-9][0-9]*$/.test(String(previousVersionCode)) || Number(versionCode) <= Number(previousVersionCode)) {
      throw new Error("New Android versionCode must exceed the previously published versionCode.");
    }
  }
}

module.exports = { validateAndroidRelease };
if (require.main === module) {
  validateAndroidRelease({
    versionCode: process.env.APP_VERSION_CODE,
    versionName: process.env.APP_VERSION_NAME,
    previousVersionCode: process.env.PREVIOUS_VERSION_CODE,
  });
}

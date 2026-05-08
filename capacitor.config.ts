import type { CapacitorConfig } from "@capacitor/cli";

const defaultHostedUiUrl = "https://sandybrown-bear-488955.hostingersite.com/";
const serverUrl = process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || defaultHostedUiUrl;
const usesCleartextServer = serverUrl.startsWith("http://");

const config: CapacitorConfig = {
  appId: "com.apologiasancta.live",
  appName: "Apologia Sancta",
  webDir: "capacitor-shell",
  server: {
    url: serverUrl,
    cleartext: usesCleartextServer,
    androidScheme: usesCleartextServer ? "http" : "https",
  },
  android: {
    allowMixedContent: usesCleartextServer,
  },
};

export default config;
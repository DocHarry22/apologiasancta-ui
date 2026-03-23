import type { CapacitorConfig } from "@capacitor/cli";

const serverUrl = process.env.CAPACITOR_SERVER_URL || process.env.NEXT_PUBLIC_APP_URL || "https://apologiasancta.example.com";

const config: CapacitorConfig = {
  appId: "com.apologiasancta.live",
  appName: "Apologia Sancta",
  webDir: "capacitor-shell",
  server: {
    url: serverUrl,
    cleartext: false,
    androidScheme: "https",
  },
  android: {
    allowMixedContent: false,
  },
};

export default config;
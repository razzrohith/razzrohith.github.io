import type { CapacitorConfig } from "@capacitor/core";

const config: CapacitorConfig = {
  appId: "com.raithufresh.app",
  appName: "RaithuFresh",

  webDir: "dist/public",

  server: {
    androidScheme: "https",
  },
};

export default config;

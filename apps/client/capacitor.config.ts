import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The iPhone app (docs/ios-app.md): the built client (dist) inside a native
 * shell. The game itself still talks to the Render server and Supabase, so
 * the build needs VITE_SERVER_URL (see scripts/check-native-env.mjs).
 *
 * appId is the app's bundle ID: it must match the App ID in your Apple
 * Developer account and App Store Connect. Change it here before the first
 * upload if you registered another one; it can't change after release.
 */
const config: CapacitorConfig = {
  appId: "com.litojace.elementarena",
  appName: "Element Arena",
  webDir: "dist",
  ios: {
    // The page handles the notch and home bar itself (safe-area insets).
    contentInset: "never",
    // A game: no rubber-band scrolling of the whole page.
    scrollEnabled: false,
    backgroundColor: "#0b1020",
  },
};

export default config;

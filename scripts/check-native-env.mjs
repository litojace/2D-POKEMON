// Checks the settings the iPhone app is built with (docs/ios-app.md), before
// `npm run ios:build` builds it. The app's pages load from inside the app
// (capacitor://localhost), so unlike the website it can't reach the game
// server or Supabase by relative address: it needs their full https URLs.
//
// Settings come from the environment, or from apps/client/.env.ios (or
// .env.ios.local), which Vite reads in "ios" mode. Those files are ignored
// by git: never commit keys.
import { loadEnv } from "vite";
import { fileURLToPath } from "node:url";

const clientDir = fileURLToPath(new URL("../apps/client/", import.meta.url));
const env = { ...loadEnv("ios", clientDir, "VITE_"), ...process.env };
const problems = [];
const https = (name) => {
  const value = env[name];
  if (!value) problems.push(`${name} is missing.`);
  else if (!/^https:\/\/[^/]+/.test(value))
    problems.push(
      `${name} must be a full https:// address (it is "${value}").`,
    );
};
https("VITE_SERVER_URL");
https("VITE_SUPABASE_URL");
https("VITE_SITE_URL");
if (!env.VITE_SUPABASE_ANON_KEY)
  problems.push("VITE_SUPABASE_ANON_KEY is missing.");
if (env.VITE_APPLE_SIGN_IN !== "on")
  problems.push(
    "VITE_APPLE_SIGN_IN must be \"on\": the app's only social sign-in is Apple's.",
  );

if (problems.length) {
  console.error(
    `The iPhone app can't be built yet:\n- ${problems.join("\n- ")}\n\nPut them in apps/client/.env.ios (see docs/ios-app.md).`,
  );
  process.exit(1);
}
console.log(`iPhone app settings look right (server ${env.VITE_SERVER_URL}).`);

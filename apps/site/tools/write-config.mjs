// The website's build step on Render (its only one): writes config.js from
// the Static Site's environment, so the public Supabase address and anon key
// (the same public values the game's build uses) are not in the repo.
//
//   SITE_SUPABASE_URL=… SITE_SUPABASE_ANON_KEY=… node tools/write-config.mjs
//
// Without them the account page says accounts aren't available here, and
// the rest of the site works as usual. No dependencies: plain Node.
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const config = {
  supabaseUrl: process.env.SITE_SUPABASE_URL || "",
  supabaseAnonKey: process.env.SITE_SUPABASE_ANON_KEY || "",
  appleSignIn: process.env.SITE_APPLE_SIGN_IN === "on",
  gameUrl: process.env.SITE_GAME_URL || "https://play.elementarenausa.com/",
};
if (
  config.supabaseUrl &&
  !/^https:\/\/[a-z0-9-]+\.supabase\.co$/.test(config.supabaseUrl)
)
  throw new Error(
    "SITE_SUPABASE_URL should look like https://<project>.supabase.co",
  );
writeFileSync(
  path.join(site, "config.js"),
  `window.EA_CONFIG = ${JSON.stringify(config)};\n`,
);
console.log(
  `config.js written (accounts ${config.supabaseUrl ? "on" : "off"})`,
);

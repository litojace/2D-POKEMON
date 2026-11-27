// Bundles the account area's script (src/account.ts with supabase-js and the
// shared session cookie) to account/account.js. Run after changing either,
// or after a supabase-js update, and commit the output:
//
//   node apps/site/tools/build-account.mjs
//
// tests/unit/site.test.ts rebuilds it in memory and fails if the committed
// file is stale. The live site has no build step beyond tools/write-config.mjs.
import { build } from "esbuild";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export async function bundleAccount() {
  const out = await build({
    entryPoints: [path.join(site, "src/account.ts")],
    bundle: true,
    format: "iife",
    target: "es2020",
    minify: true,
    legalComments: "none",
    write: false,
    logLevel: "silent",
  });
  return out.outputFiles[0].text;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const code = await bundleAccount();
  writeFileSync(path.join(site, "account/account.js"), code);
  console.log(`account/account.js: ${(code.length / 1024).toFixed(0)} KB`);
}

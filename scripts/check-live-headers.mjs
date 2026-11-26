// Checks that the live game sends the headers in
// apps/client/security-headers.json (docs/static-frontend.md, "Security
// headers"). Render's dashboard holds the live copy, so a change to an inline
// script in index.html without its new hash in Render would be blocked by
// the CSP in production; this catches that drift.
//
//   node scripts/check-live-headers.mjs [--site https://play.elementarenausa.com]
//        [--retry-minutes 20] [--require-enforcing] [--json out.json]
//
// It reads public pages only (no secrets). Exit 0 when everything matches,
// 1 when something differs (after retrying, to let a fresh deploy finish).
import { writeFileSync } from "node:fs";
import { compareHeaders, loadConfig } from "./security-headers.mjs";

const args = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : fallback;
};
const site = arg("--site", "https://play.elementarenausa.com").replace(
  /\/+$/,
  "",
);
const retryMinutes = Number(arg("--retry-minutes", "0"));
const requireEnforcing = args.includes("--require-enforcing");
const jsonOut = arg("--json");
// The game page, and a plain page from public/ (the same /* headers).
const PAGES = ["/", "/privacy.html"];

async function check() {
  const config = loadConfig();
  const results = [];
  for (const path of PAGES) {
    const url = `${site}${path}`;
    let res;
    try {
      res = await fetch(url, {
        headers: { "cache-control": "no-cache" },
        redirect: "follow",
      });
    } catch (error) {
      const why = error?.cause?.code ?? String(error);
      results.push({
        url,
        problems: [{ header: "fetch", expected: "a reply", served: why }],
      });
      continue;
    }
    const served = Object.fromEntries(
      [...res.headers].map(([k, v]) => [k.toLowerCase(), v]),
    );
    const html = await res.text();
    const problems = res.ok
      ? compareHeaders(config, served, html, { requireEnforcing })
      : [{ header: "status", expected: "200", served: String(res.status) }];
    results.push({ url, problems });
  }
  return results;
}

const deadline = Date.now() + retryMinutes * 60_000;
let results;
for (;;) {
  results = await check();
  const bad = results.some((r) => r.problems.length);
  if (!bad || Date.now() >= deadline) break;
  console.log("Not matching yet, retrying in 60 s (a deploy may be running)…");
  await new Promise((r) => setTimeout(r, 60_000));
}

const bad = results.filter((r) => r.problems.length);
if (jsonOut) writeFileSync(jsonOut, JSON.stringify(results, null, 2));
if (!bad.length) {
  console.log(
    `Live headers match apps/client/security-headers.json (${site}).`,
  );
} else {
  for (const r of bad) {
    console.log(`\n${r.url}`);
    for (const p of r.problems)
      console.log(
        `- ${p.header}\n    expected: ${p.expected}\n    served:   ${p.served}`,
      );
  }
  process.exitCode = 1;
}

// Builds a preview of the website as one page for a claude.ai Artifact
// (which supplies its own <head>, and loads fonts from Google Fonts only).
//
//   node apps/site/tools/demo.mjs <out-dir>
//
// Writes <out-dir>/index.html; publish it with apps/site's img/ and
// favicon-32.png beside it. Not part of the live site.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = process.argv[2];
if (!out) throw new Error("usage: node apps/site/tools/demo.mjs <out-dir>");

const html = readFileSync(path.join(site, "index.html"), "utf8");
const css = readFileSync(path.join(site, "site.css"), "utf8").replace(
  /@font-face\s*{[^}]*}\s*/g,
  "",
);
const body = html.slice(html.indexOf("<body>") + 6, html.indexOf("</body>"));
const script = readFileSync(path.join(site, "site.js"), "utf8");

const demo = `<title>Element Arena Website</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anton&family=Archivo:wght@400..800&display=swap">
<style>
${css}
</style>
${body}
<script>
${script}
</script>
`;

mkdirSync(out, { recursive: true });
writeFileSync(path.join(out, "index.html"), demo);
console.log("wrote", path.join(out, "index.html"));

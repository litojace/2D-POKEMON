// Draws the raid boss posters (splash 1536x1024, portrait 600x900, thumb
// 320x213) from the bosses' own rig painters and arena art, in the manner of
// the Storm Twins painting. See page/compose.ts for the scene.
//
//   PW_CHROMIUM=<chrome> node scripts/posters/build-posters.mjs [ids...] [--out <dir>]
//
// Writes <id>.webp, <id>-portrait.webp and <id>-thumb.webp into
// apps/client/src/art/raid-splash (or --out), each within the byte budget
// of Storm Twins' own files, and prints where the face and body landed
// (for BOSS_FRAMES in screens/raid-hall-view.ts).
import { createServer } from "vite";
import { chromium } from "playwright";
import { mkdirSync, statSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../..", import.meta.url));
const args = process.argv.slice(2);
const oi = args.indexOf("--out");
const out =
  oi >= 0 ? args.splice(oi, 2)[1] : `${root}apps/client/src/art/raid-splash`;
mkdirSync(out, { recursive: true });
const ref = `${root}apps/client/src/art/raid-splash/storm-twins`;
const budget = {
  splash: statSync(`${ref}.webp`).size,
  portrait: statSync(`${ref}-portrait.webp`).size,
  thumb: statSync(`${ref}-thumb.webp`).size,
};

const server = await createServer({
  configFile: fileURLToPath(new URL("./vite.config.mjs", import.meta.url)),
  server: { port: 4391 + Math.floor(Math.random() * 400) },
});
await server.listen();
const browser = await chromium.launch({
  executablePath: process.env.PW_CHROMIUM || undefined,
});
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error("[page]", e.message));
  await page.goto(server.resolvedUrls.local[0]);
  await page.waitForFunction(() => window.ready, null, { timeout: 120000 });
  const ids = args.length
    ? args
    : await page.evaluate(() => window.posterIds());
  const report = {};
  for (const id of ids) {
    const t = Date.now();
    const r = await page.evaluate(
      ([id, b]) => window.buildPoster(id, b),
      [id, budget],
    );
    const save = (name, data) => {
      const buf = Buffer.from(data.split(",")[1], "base64");
      writeFileSync(`${out}/${name}`, buf);
      return buf.length;
    };
    const sizes = [
      save(`${id}.webp`, r.splash),
      save(`${id}-portrait.webp`, r.portrait),
      save(`${id}-thumb.webp`, r.thumb),
    ];
    report[id] = {
      face: r.face,
      body: r.body,
      box: r.box,
      portraitFace: r.portraitFace,
      thumbFace: r.thumbFace,
      sizes,
    };
    const f = (p) => p.map((v) => v.toFixed(2)).join(", ");
    console.log(
      `${id}: ${sizes.join(" / ")} bytes, face [${f(r.face)}], body [${f(r.body)}], box [${f(r.box)}], portrait face [${f(r.portraitFace)}], thumb face [${f(r.thumbFace)}] (${Date.now() - t} ms)`,
    );
  }
  // where the faces landed (for BOSS_FRAMES and the face check), next to previews only
  if (oi >= 0)
    writeFileSync(`${out}/faces.json`, JSON.stringify(report, null, 1));
} finally {
  await browser.close();
  await server.close();
}

// Part of the UI remodel's Phase 0 (docs/ui-remodel/PLAN.md). Run from the repo
// root after starting the server it needs; PW_CHROMIUM picks the browser.
// Screenshot the mockups (npx vite --config docs/ui-remodel/mockup/vite.config.ts).
// Usage: node docs/ui-remodel/tools/mockshot.cjs <outDir> <screen,...> [desktop|laptop|phone|phone844 ...]
const { chromium } = require("playwright");
const out = process.argv[2];
const screens = process.argv[3].split(",");
const devs = process.argv.slice(4).length
  ? process.argv.slice(4)
  : ["desktop", "phone"];
const SIZES = {
  desktop: { width: 1440, height: 900, mobile: false },
  laptop: { width: 1280, height: 720, mobile: false },
  phone: { width: 852, height: 393, mobile: true, island: true },
  phone844: { width: 844, height: 390, mobile: true },
};
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
  });
  for (const d of devs) {
    const s = SIZES[d];
    const ctx = await b.newContext({
      viewport: { width: s.width, height: s.height },
      isMobile: s.mobile,
      hasTouch: s.mobile,
      deviceScaleFactor: Number(process.env.DSF || 1),
    });
    const p = await ctx.newPage();
    const errs = [];
    p.on("pageerror", (e) => errs.push(String(e).slice(0, 300)));
    p.on(
      "console",
      (m) => m.type() === "error" && errs.push(m.text().slice(0, 300)),
    );
    for (const sc of screens) {
      await p.goto(
        `http://localhost:4180/?s=${sc}${s.island ? "&island" : ""}`,
      );
      await p
        .waitForFunction(() => window.__ready, null, { timeout: 60000 })
        .catch(() => errs.push("not ready " + sc));
      await p.evaluate(() => document.fonts.ready);
      await p.waitForTimeout(400);
      await p.screenshot({
        path: `${out}/${sc}-${d}.png`,
        animations: "disabled",
      });
      console.log(`${sc}-${d}`, errs.splice(0).join(" | "));
    }
    await ctx.close();
  }
  await b.close();
})();

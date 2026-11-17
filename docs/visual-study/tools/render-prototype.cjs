// Renders docs/visual-study/index.html: node render-prototype.cjs <outdir> shots|bench|page [deviceScaleFactor] [benchScale]
// (run with NODE_PATH=$(npm root) from the repo root).
const { chromium } = require("playwright");
const fs = require("fs");
(async () => {
  const out = process.argv[2],
    what = process.argv[3] || "shots";
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
  });
  const p = await b.newPage({
    viewport: { width: 1320, height: 900 },
    deviceScaleFactor: +(process.argv[4] || 1),
  });
  const errs = [];
  p.on("console", (m) => m.type() === "error" && errs.push(m.text()));
  p.on("pageerror", (e) => errs.push(String(e)));
  await p.goto("file://" + require("path").resolve(__dirname, "../index.html"));
  await p.waitForTimeout(800);
  if (what === "shots") {
    for (const [tod, name] of [
      [0.33, "morning"],
      [0.5, "noon"],
      [0.7, "evening"],
    ]) {
      await p.evaluate((t) => {
        const s = window.__study;
        s.ENV.tod = t;
        s.ENV.playing = false;
        s.syncControls();
      }, tod);
      await p.waitForTimeout(400);
      for (const id of [
        "farm-painted",
        "farm-toy",
        "bistro-painted",
        "bistro-toy",
      ])
        await p
          .locator("#" + id)
          .screenshot({ path: `${out}/${id}-${name}.png` });
    }
  } else if (what === "bench") {
    const rows = await p.evaluate(
      (sc) => window.__study.bench(40, sc),
      +(process.argv[5] || 0),
    );
    fs.writeFileSync(`${out}/bench.json`, JSON.stringify(rows, null, 1));
    console.log(JSON.stringify(rows));
  } else if (what === "page") {
    await p.screenshot({ path: `${out}/page.png`, fullPage: true });
  }
  console.log("ERRORS", JSON.stringify(errs));
  await b.close();
})();

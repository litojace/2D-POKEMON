// Part of the UI remodel's Phase 0 (docs/ui-remodel/PLAN.md). Run from the repo
// root after starting the server it needs; PW_CHROMIUM picks the browser.
// Screenshot every hub screen at the four review sizes.
// Usage: node docs/ui-remodel/tools/capture.cjs <outDir> [1440x900 1280x720 844x390 852x393-island]
const fs = require("fs");
const hub = require("./hub-screens.cjs");
const OUT = process.argv[2] || "shots";
const ONLY = process.argv.slice(3);
(async () => {
  const browser = await hub.launch();
  for (const vp of hub.VIEWPORTS) {
    if (ONLY.length && !ONLY.includes(vp.name)) continue;
    const dir = `${OUT}/${vp.name}`;
    fs.mkdirSync(dir, { recursive: true });
    for (const [name, fn] of Object.entries(hub.SCREENS)) {
      const page = await hub.newPage(browser, vp);
      const errors = [];
      page.on("pageerror", (e) => errors.push(String(e)));
      try {
        await hub.openHub(page);
        await fn(page, (label) =>
          page.screenshot({
            path: `${dir}/${label}.png`,
            animations: "disabled",
          }),
        );
      } catch (e) {
        console.log(`FAIL ${vp.name}/${name}: ${String(e).split("\n")[0]}`);
      }
      if (errors.length)
        console.log(
          `ERR ${vp.name}/${name}: ${errors.join(" | ").slice(0, 300)}`,
        );
      await page.context().close();
      console.log(`${vp.name}/${name}`);
    }
  }
  await browser.close();
})();

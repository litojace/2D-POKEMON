// Renders the banner pieces (court + posed champions) into this folder as
// PNGs, using the game's own renderers through the visual-test Vite server.
// Usage (from the repo root, with that server running on port 4179):
//   node supabase/templates/banner/render.cjs
// Then screenshot hero.html (see ../README.md).
const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const here = __dirname;
const FACING = { LEFT: Math.PI, RIGHT: 0, FRONT: Math.PI / 2 };
const cast = JSON.parse(fs.readFileSync(path.join(here, "cast.json"), "utf8"));
(async () => {
  // In the cloud container: PW_CHROMIUM=/opt/pw-browsers/chromium-1243/chrome-linux64/chrome
  const browser = await chromium.launch(
    process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  );
  const page = await browser.newPage();
  page.on("pageerror", (e) => console.error(e.message));
  await page.route("**/banner-stage", (r) =>
    r.fulfill({ contentType: "text/html", body: "<body></body>" }),
  );
  await page.goto("http://localhost:4179/banner-stage");
  const module = "/@fs/" + path.join(here, "poses.ts").replace(/^\//, "");
  for (const job of cast) {
    const j = { ...job, angle: FACING[job.angle] };
    const url = await page.evaluate(
      async ([m, j]) => {
        const p = await import(m);
        return j.court ? p.courtPng(j.court) : p.posePng(j, j.size ?? 360);
      },
      [module, j],
    );
    fs.writeFileSync(
      path.join(here, `${job.name}.png`),
      Buffer.from(url.split(",")[1], "base64"),
    );
    console.log("rendered", job.name);
  }
  await browser.close();
})();

// Usage: node shoot.cjs <theme|current> [outdir] [w] [h]
// Opens the real client (visual harness on :4179), injects a direction's CSS
// (+ optional markup patch js), screenshots the Lobby.
const ROOT = require("path").resolve(__dirname, "../../../..");
const { chromium } = require(ROOT + "/node_modules/playwright");
const fs = require("fs"), path = require("path");
const S = path.dirname(__dirname);
const theme = process.argv[2] || "current";
const out = process.argv[3] || path.join(S, "shots");
const W = +(process.argv[4] || 844), H = +(process.argv[5] || 390);
const island = process.argv.includes("--island");
const dump = process.argv.includes("--dump");
(async () => {
  const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM || "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome" });
  const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.route("**/demo-fonts/**", (r) => {
    const f = path.join(process.env.DEMO_FONTS || path.join(S, "fonts/node_modules/@fontsource"), r.request().url().split("/demo-fonts/")[1]);
    r.fulfill({ path: f, contentType: "font/woff2" });
  });
  await page.route("**/demo-art/**", (r) => {
    const rel = decodeURIComponent(r.request().url().split("/demo-art/")[1]);
    r.fulfill({ path: path.join(ROOT + "/apps/client", rel), contentType: rel.endsWith(".webp") ? "image/webp" : "image/png" });
  });
  await page.addInitScript(() => {
    localStorage.setItem("ea-graphics", "high");
    localStorage.setItem("ea-hub-scene", "lobby");
    localStorage.setItem("arena-tour:11111111-1111-4111-8111-111111111111", "done");
  });
  await page.goto("http://localhost:4179/");
  await page.waitForFunction(() => !!window.__sock);
  for (let i = 0; i < 60; i++) {
    await page.evaluate(() => window.__sock.fire("connect"));
    if (await page.locator("#lobby-play").isVisible()) break;
    await page.waitForTimeout(500);
  }
  await page.locator("#server-startup").waitFor({ state: "detached", timeout: 60000 });
  if (island) await page.addStyleTag({ content: ":root{--safe-left:59px!important;--safe-right:59px!important;--safe-bottom:21px!important;--safe-top:0px!important}" });
  for (let i = 0; i < +(process.env.STEP || 0); i++) { await page.locator('[data-lobby-step="1"]').click(); await page.waitForTimeout(350); }
  if (theme !== "current") {
    const css = path.join(S, "dirs", theme + ".css");
    const js = path.join(S, "dirs", theme + ".js");
    if (fs.existsSync(js)) await page.evaluate(fs.readFileSync(js, "utf8"));
    await page.addStyleTag({ content: fs.readFileSync(path.join(S, "dirs", "fonts.css"), "utf8") + fs.readFileSync(css, "utf8") + (process.env.EXTRA ? fs.readFileSync(process.env.EXTRA, "utf8") : "") });
    await page.evaluate(() => document.fonts.ready);
  }
  await page.waitForTimeout(2500);
  if (dump) {
    const tree = await page.evaluate(() => {
      const walk = (el, d) => {
        if (d > 5) return "";
        const r = el.getBoundingClientRect();
        if (!r.width || getComputedStyle(el).display === "none") return "";
        const id = el.id ? "#" + el.id : "";
        const cls = el.className && typeof el.className === "string" ? "." + el.className.trim().split(/\s+/).join(".") : "";
        let s = "  ".repeat(d) + el.tagName.toLowerCase() + id + cls + ` [${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}]\n`;
        for (const c of el.children) s += walk(c, d + 1);
        return s;
      };
      return [...document.body.children].map((c) => walk(c, 0)).join("");
    });
    console.log(tree);
  }
  if (process.env.EVAL) console.log(JSON.stringify(await page.evaluate(process.env.EVAL), null, 1));
  fs.mkdirSync(out, { recursive: true });
  const name = `${process.env.TAG || theme}-${W}x${H}${island ? "-island" : ""}.png`;
  await page.screenshot({ path: path.join(out, name) });
  console.log("saved", name, errors.length ? "ERRORS " + errors.join(" | ") : "");
  await browser.close();
})();

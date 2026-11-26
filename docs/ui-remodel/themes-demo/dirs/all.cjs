// node all.cjs <theme|current> <outdir> [screens,comma] [WxH] [--el=#hex]
const ROOT = require("path").resolve(__dirname, "../../../..");
const path = require("path"), fs = require("fs");
const HS = require(ROOT + "/docs/ui-remodel/tools/hub-screens.cjs");
const S = path.dirname(__dirname);
const theme = process.argv[2] || "current";
const out = process.argv[3] || path.join(S, "full", theme);
const only = process.argv[4] && process.argv[4] !== "all" ? process.argv[4].split(",") : null;
const [W, H] = (process.argv[5] || "844x390").split("x").map(Number);
const stepArg = +((process.argv.find((a) => a.startsWith("--step=")) || "=0").split("=")[1]);
const elArg = (process.argv.find((a) => a.startsWith("--fighter=")) || "").split("=")[1];
fs.mkdirSync(out, { recursive: true });

async function inject(page) {
  if (theme === "current") return;
  const js = path.join(S, "dirs", theme + ".js");
  if (fs.existsSync(js)) await page.evaluate(fs.readFileSync(js, "utf8")).catch((e) => console.log("js err", e.message));
  await page.addStyleTag({ content: fs.readFileSync(path.join(S, "dirs", "fonts.css"), "utf8") + fs.readFileSync(path.join(S, "dirs", theme + ".css"), "utf8") });
  await page.evaluate(() => document.fonts.ready);
}

const EXTRA = {
  async battle(page, shot) {
    await page.evaluate(async () => {
      const w = window;
      w.__room("pvp", { mode: "duel", phase: "briefing" });
      const m = await import("/rooms.ts");
      const a = new m.Arena("PVP123", "duel");
      a.add("me", "tester", document.getElementById("lobby-fighter-art")?.dataset.previewChampion || "voltkit");
      a.add("p2", "Bot · Normal", "cindrake");
      a.start();
      w.__arena = a; w.__pack = () => m.packSnapshot(a.snapshot()); w.__snap = w.__pack();
    });
    await page.click("#lobby-mode");
    await page.click('#lobby-mode-menu [data-lobby-action="more-play"]');
    await page.locator("#join").waitFor({ state: "visible" });
    await page.evaluate(() => document.getElementById("play-create").click());
    for (let i = 0; i < 60; i++) {
      const ok = await page.evaluate(() => { window.__push(); return document.body.classList.contains("battle-active"); });
      if (ok) break; await page.waitForTimeout(400);
    }
    await page.evaluate(async () => {
      const w = window; const m = await import("/rooms.ts"); const a = w.__arena;
      a.phase = "playing"; a.deadline = a.time + 93; let tick = 0;
      w.__fight = setInterval(() => {
        for (let k = 0; k < 2; k++) {
          tick++;
          a.players.forEach((p, i) => {
            p.hp = Math.max(p.hp, 40);
            const t = a.players[(i + 1) % 2];
            a.submit(p, { ...m.blankInput(), seq: p.ack + 1, dx: Math.cos(tick / 25 + i * 2), dy: Math.sin(tick / 25 + i * 2), aimX: t.x, aimY: t.y, basic: true, skill: (tick + i * 13) % 45 === 0 ? ((tick / 45 + i) | 0) % 4 : -1 });
          });
          a.tick();
        }
        w.__snap = w.__pack(); w.__push();
      }, 66);
    });
    await page.waitForTimeout(6000);
    await shot("battle-hud");
    await page.evaluate(async () => {
      const w = window; clearInterval(w.__fight);
      const s = w.__pack();
      Object.assign(s, { phase: "finished", matchId: "m-demo", winner: "me", vsBot: true, scores: { me: 3, p2: 1 } });
      // Sample numbers for the recap (the harness fight doesn't fill them).
      const st = [{ dealt: 1184, received: 742, kos: 3, combos: 2 }, { dealt: 742, received: 1184, kos: 1, combos: 0 }];
      (s.players || []).forEach((pl, i) => { pl.stats = { ...(pl.stats || {}), ...st[i % 2] }; });
      w.__snap = s; w.__push();
    });
    await page.locator(".action-overlay h2").waitFor({ state: "visible", timeout: 20000 });
    await page.evaluate(async () => {
      const { resultXp } = await import("/rooms.ts");
      const sc = document.querySelector(".panel-scroll");
      // Harness has no records server: drop its "couldn't save" / "updating XP" lines.
      sc.querySelectorAll("p, .result-note, .muted, small").forEach((n) => { if (/Couldn.t save|Updating your XP/.test(n.textContent || "")) n.remove(); });
      sc.insertAdjacentHTML("beforeend", resultXp({ xp: 2600, recent: [{ ref: "match:m-demo", amount: 150, at: new Date().toISOString(), source: "match" }], season: {}, unlocked: [] }, "match:m-demo"));
    });
    await page.waitForTimeout(1500);
    await shot("victory");
  },
};
const ALL = ["lobby", "mode-menu", "play", "shop", "wardrobe", "fighters", "raids", "journey", "missions", "ranks", "friends", "invite", "profile", "settings", "battle", "raid-lobby", "raid-briefing"];

(async () => {
  const browser = await HS.launch();
  for (const name of only || ALL) {
    const ctx = await browser.newContext({ viewport: { width: W, height: H }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const p = await ctx.newPage();
    await HS.init(p, { width: W, height: H, island: process.argv.includes("--island") });
    await p.addInitScript((f) => { try { localStorage.setItem("arena-tour:11111111-1111-4111-8111-111111111111", "done"); if (f) localStorage.setItem("ea-lobby-fighter", f); } catch {} }, elArg || "");
    await p.route("**/demo-fonts/**", (r) => r.fulfill({ path: path.join(process.env.DEMO_FONTS || path.join(S, "fonts/node_modules/@fontsource"), r.request().url().split("/demo-fonts/")[1]), contentType: "font/woff2" }));
    await p.route("**/demo-art/**", (r) => { const rel = decodeURIComponent(r.request().url().split("/demo-art/")[1]); r.fulfill({ path: path.join(ROOT + "/apps/client", rel), contentType: "image/webp" }); });
    const errors = []; p.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
    try {
      await HS.openHub(p);
      await p.locator("#server-startup").waitFor({ state: "detached", timeout: 60000 });
      for (let i = 0; i < stepArg; i++) { await p.click('[data-lobby-step="1"]'); await p.waitForTimeout(700); }
      if (stepArg) await p.waitForTimeout(2500);
      await inject(p);
      await p.waitForTimeout(1500);
      const shot = async (n) => {
        await p.screenshot({ path: path.join(out, n + ".png"), animations: "disabled" }); console.log("shot", n);
        if (process.env.EVAL) console.log(JSON.stringify(await p.evaluate(process.env.EVAL)));
        if (process.env.PROBE) console.log(await p.evaluate((sel) => {
          const walk = (el, d) => { if (d > +(window.__depth || 4)) return ""; const r = el.getBoundingClientRect(); if (!r.width) return "";
            const cls = typeof el.className === "string" && el.className ? "." + el.className.trim().split(/\s+/).join(".") : "";
            let s = "  ".repeat(d) + el.tagName.toLowerCase() + (el.id ? "#" + el.id : "") + cls + ` ${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)}\n`;
            for (const c of el.children) if (!["svg","path","g","circle","rect"].includes(c.tagName.toLowerCase())) s += walk(c, d + 1); return s; };
          return [...document.querySelectorAll(sel)].map((e) => walk(e, 0)).join("\n----\n");
        }, process.env.PROBE));
      };
      await (EXTRA[name] || HS.SCREENS[name])(p, shot);
    } catch (e) { console.log("FAIL", name, e.message.split("\n")[0]); }
    if (errors.length) console.log("pageerrors", name, errors.slice(0, 2));
    await ctx.close();
  }
  await browser.close();
})();

// Part of the UI remodel's Phase 0 (docs/ui-remodel/PLAN.md). Run from the repo
// root after starting the server it needs; PW_CHROMIUM picks the browser.
// The layout rules, measured on every mockup screen at the four sizes: equal
// buttons in a group, equal small buttons in a row, no overlaps, inside the
// safe area, no cut-off labels, Close at one spot. Becomes
// tests/visual/ui-measure.ts in step 1.
const { chromium } = require("playwright");
const SCREENS =
  "shop,confirm,wardrobe,roster,fighter,missions,journey,raids,boss,ranks,friends,profile".split(
    ",",
  );
const SIZES = [
  { n: "1440x900", width: 1440, height: 900, m: false },
  { n: "1280x720", width: 1280, height: 720, m: false },
  { n: "844x390", width: 844, height: 390, m: true },
  { n: "852x393-island", width: 852, height: 393, m: true, island: true },
];
(async () => {
  const b = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM || undefined,
  });
  let bad = 0;
  for (const s of SIZES) {
    const ctx = await b.newContext({
      viewport: { width: s.width, height: s.height },
      isMobile: s.m,
      hasTouch: s.m,
    });
    const p = await ctx.newPage();
    for (const sc of SCREENS) {
      await p.goto(
        `http://localhost:4180/?s=${sc}${s.island ? "&island" : ""}`,
      );
      await p.waitForFunction(() => window.__ready);
      await p.evaluate(() => document.fonts.ready);
      const r = await p.evaluate((island) => {
        const out = [];
        const R = (e) => e.getBoundingClientRect();
        // 1. Every action group: equal sizes, one baseline.
        for (const g of document.querySelectorAll(".ui-actions")) {
          const bs = [...g.children].map(R);
          for (const x of bs)
            if (
              Math.abs(x.width - bs[0].width) > 0.5 ||
              Math.abs(x.height - bs[0].height) > 0.5 ||
              Math.abs(x.top - bs[0].top) > 0.5
            )
              out.push(
                `unequal action buttons ${bs.map((v) => `${v.width}x${v.height}`).join(" ")}`,
              );
        }
        // 2. Small buttons in one row share their size.
        const rows = new Map();
        for (const e of document.querySelectorAll(".ui-btn.is-s")) {
          const q = R(e);
          if (!q.width) continue;
          const k = Math.round(q.top);
          (rows.get(k) ?? rows.set(k, []).get(k)).push(q);
        }
        for (const [k, qs] of rows)
          for (const q of qs)
            if (Math.abs(q.height - qs[0].height) > 0.5)
              out.push(`small buttons differ in height at y=${k}`);
        // 3. Main boxes never overlap; all inside the screen and the safe area.
        const boxes = [".m-hud", ".m-rail", ".m-stage", ".ui-panel", ".m-play"]
          .flatMap((s) => [...document.querySelectorAll(s)])
          .filter((e) => R(e).width);
        const L = island ? 59 : 0,
          Rt = innerWidth - (island ? 59 : 0),
          B = innerHeight - (island ? 21 : 0);
        for (const e of boxes) {
          const q = R(e);
          if (
            q.left < L - 0.5 ||
            q.right > Rt + 0.5 ||
            q.bottom > B + 0.5 ||
            q.top < -0.5
          )
            out.push(
              `${e.className.split(" ")[0]} outside safe area ${Math.round(q.left)},${Math.round(q.top)},${Math.round(q.right)},${Math.round(q.bottom)}`,
            );
        }
        for (let i = 0; i < boxes.length; i++)
          for (let j = i + 1; j < boxes.length; j++) {
            const a = R(boxes[i]),
              c = R(boxes[j]);
            if (
              a.left < c.right - 1 &&
              c.left < a.right - 1 &&
              a.top < c.bottom - 1 &&
              c.top < a.bottom - 1
            )
              out.push(
                `overlap ${boxes[i].className.split(" ")[0]} × ${boxes[j].className.split(" ")[0]}`,
              );
          }
        // 4. Every visible button: nothing truncates its label.
        for (const e of document.querySelectorAll(".ui-btn"))
          if (R(e).width && e.scrollWidth > e.clientWidth + 1)
            out.push(`button label cut: ${e.textContent.trim()}`);
        // 5. Close buttons all at the same spot relative to their panel.
        const cl = [...document.querySelectorAll(".ui-panel .ui-close")].map(
          (c) => {
            const q = R(c),
              pp = R(c.closest(".ui-panel"));
            return `${Math.round(pp.right - q.right)},${Math.round(q.top - pp.top)},${Math.round(q.width)}`;
          },
        );
        return { out, close: cl };
      }, !!s.island);
      if (r.out.length) {
        bad += r.out.length;
        console.log(s.n, sc, r.out.join(" | "));
      }
      console.log(`close ${s.n} ${sc} ${r.close.join(" ")}`);
    }
    await ctx.close();
  }
  console.log("problems:", bad);
  await b.close();
})();

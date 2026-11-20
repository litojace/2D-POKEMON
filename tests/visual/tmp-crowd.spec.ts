import { test } from "@playwright/test";
import { openPlaza } from "./helpers";
for (const mode of ["all1", "all2", "all3"])
  test(`crowd ${mode}`, async ({ page }) => {
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 844, height: 390 });
    await openPlaza(page);
    await page.waitForTimeout(1800);
    await page.evaluate((mode) => {
      const w = window as any, me = w.__plazaWorld.bodyOf("local");
      const skins = ["voltkit-nova-vanguard", "voltkit-sky-pirates", "voltkit-hon-viet", "voltkit-stars-stripes", "voltkit-stormcrown"];
      const sk = true;
      for (let i = 0; i < 20; i++) {
        const k = "c" + i;
        w.__plazaWorld.join(k, "acct-" + k, { name: k, title: null, titleColor: null, level: 3, character: "voltkit",
          skin: sk ? { skin: skins[i % 5], stage: 3 } : null,
          look: { aura: "halo-aura", victory: "galaxy-victory" } });
        Object.assign(w.__plazaWorld.bodyOf(k), { x: me.x - 300 + (i % 5) * 150, y: me.y - 120 + Math.floor(i / 5) * 80 });
      }
    }, mode);
    await page.waitForTimeout(3000);
    { const n = 20; await page.evaluate((n) => { const w = window as any, me = w.__plazaWorld.bodyOf("local"); for (let i = 0; i < n; i++) { Object.assign(w.__plazaWorld.bodyOf("c" + i), { x: me.x - 300 + (i % 5) * 150, y: me.y - 120 + Math.floor(i / 5) * 80 }); w.__plazaWorld.emote("c" + i, "💃", Date.now()); } }, n); await page.waitForTimeout(300); }
    const r = await page.evaluate(() => new Promise<any>((res) => {
      const ts: number[] = []; const t0 = performance.now();
      const f = (t: number) => { ts.push(t); if (t - t0 < 3000) requestAnimationFrame(f); else {
        const d = ts.slice(1).map((t, i) => t - ts[i]).sort((a, b) => a - b);
        res({ frames: d.length, p95: d[Math.floor(d.length * 0.95)].toFixed(1) }); } };
      requestAnimationFrame(f);
    }));
    console.log("MODE", mode, JSON.stringify(r));
  });

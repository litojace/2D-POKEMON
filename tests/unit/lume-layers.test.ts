import { describe, expect, it } from "vitest";
import { lumeLayers, rigAssets } from "../../apps/client/src/animation/assets";
import { lumeStrength } from "../../apps/client/src/animation/rig";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { DESIGNS, modernReplaces } from "../../apps/client/src/skins/modern-designs";
import type { ModernTheme } from "../../apps/client/src/skins/modern-fashion";

describe("glowing costume pieces (lume)", () => {
  it("gives only costumes with glowing pieces light layers, one per way of glowing", () => {
    const plain = rigAssets("voltkit", null, ["down"]);
    expect(plain.some((a) => a.key.includes("~lume-"))).toBe(false);
    const skin = "voltkit-modern-campus";
    (SKIN_ART as any)[skin] = { palette: {}, accessories: ["modern-campus"], replaces: modernReplaces("campus", "voltkit") };
    try {
      const assets = rigAssets("voltkit", { skin, stage: 1 } as any, ["down"]);
      const lit = assets.filter((a) => a.key.includes("~lume-"));
      expect(lit.length).toBeGreaterThan(0);
      for (const a of lit) {
        const base = a.key.replace(/~lume-.*$/, "");
        expect(lumeLayers.get(base)?.some((l) => l.key === a.key), a.key).toBe(true);
        // Same crop as its part, so it lies exactly over it.
        const part = assets.find((b) => b.key === base)!;
        expect([a.width, a.height, a.originX, a.originY, a.x, a.y]).toEqual([part.width, part.height, part.originX, part.originY, part.x, part.y]);
        // Only the glowing pieces show: everything else is hidden.
        const svg = decodeURIComponent(escape(atob(a.url.split(",")[1])));
        expect(svg).toContain("*{visibility:hidden}");
        expect(svg).toContain("lume-on");
      }
      // The headset's LED ring pulses and its status light blinks: two layers on the head-top piece.
      expect(lumeLayers.get(`rig-voltkit-down-flame~${skin}`)!.map((l) => l.kind).sort()).toEqual(["blink", "pulse"]);
    } finally {
      delete (SKIN_ART as any)[skin];
    }
  });

  it("keeps every glow in range and blinks well under three flashes a second", () => {
    for (const kind of ["pulse", "blink", "chase", "twinkle"] as const)
      for (const phase of [0, 1]) {
        let flashes = 0,
          was = false;
        for (let t = 0; t < 10; t += 1 / 120) {
          const v = lumeStrength(kind, phase, t);
          expect(v).toBeGreaterThanOrEqual(0);
          expect(v).toBeLessThanOrEqual(1);
          const on = v > 0.6;
          if (on && !was) flashes++;
          was = on;
        }
        // Per light, at most one flash a second (two phases: two a second in all).
        expect(flashes / 10, `${kind}${phase}`).toBeLessThanOrEqual(1.01);
      }
  });

  it("gives each champion in a collection its own design", () => {
    for (const [theme, byChampion] of Object.entries(DESIGNS) as [ModernTheme, Record<string, unknown>][]) {
      const fns = Object.values(byChampion);
      expect(new Set(fns).size, theme).toBe(fns.length);
      expect(fns.length, theme).toBeGreaterThanOrEqual(5);
    }
  });
});

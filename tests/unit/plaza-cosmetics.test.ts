import { describe, expect, it } from "vitest";
import {
  PLAZA_AURA_SCALE,
  PLAZA_FX_CAP,
  drawWornBehind,
  drawWornFront,
  wearsFx,
  type Wearer,
} from "../../apps/client/src/plaza/plaza-cosmetics";

// The Plaza shows what players wear (their Aura, their Colors' motif), drawn
// by the match's own effect code on the Plaza's canvas. A canvas that only
// records what is drawn on it.
function recorder() {
  const calls: string[] = [];
  const scales: number[] = [];
  const ctx = new Proxy({} as Record<string, unknown>, {
    get(target, key: string) {
      if (key in target) return target[key];
      if (key === "scale")
        return (x: number) => {
          scales.push(x);
          calls.push("scale");
        };
      if (key === "createLinearGradient" || key === "createRadialGradient")
        return () => ({ addColorStop() {} });
      return (..._: unknown[]) => void calls.push(key);
    },
    set(target, key: string, v) {
      target[key] = v;
      return true;
    },
  });
  return { ctx: ctx as unknown as CanvasRenderingContext2D, calls, scales };
}
const paints = (calls: string[]) =>
  calls.filter((c) => /fill|stroke|ellipse|arc|lineTo/.test(c)).length;
const body = (extra: Partial<Wearer>): Wearer => ({
  x: 500,
  y: 600,
  z: 0,
  ...extra,
});
const opts = { now: 1234, reduced: false, low: false };

describe("Plaza: worn effects", () => {
  it("an Aura draws its ring behind the fighter and items in front, Lobby-sized", () => {
    const b = body({ aura: "halo-aura" });
    expect(wearsFx(b)).toBe(true);
    const back = recorder(),
      front = recorder();
    drawWornBehind(back.ctx, b, opts);
    drawWornFront(front.ctx, b, opts);
    expect(paints(back.calls)).toBeGreaterThan(3);
    expect(paints(front.calls)).toBeGreaterThan(0);
    expect(back.scales[0]).toBe(PLAZA_AURA_SCALE);
    // Low keeps the aura itself (only the rarity flourish goes).
    const low = recorder();
    drawWornBehind(low.ctx, b, { ...opts, low: true });
    expect(paints(low.calls)).toBeGreaterThan(3);
  });

  it("every aura in the game draws on the Plaza", async () => {
    const { RAID_COSMETICS } = await import("../../packages/shared/src/raid");
    const auras = Object.entries(
      RAID_COSMETICS as Record<string, { slot: string }>,
    )
      .filter(([, c]) => c.slot === "aura")
      .map(([id]) => id);
    expect(auras.length).toBeGreaterThan(3);
    for (const id of auras) {
      const r = recorder();
      drawWornBehind(r.ctx, body({ aura: id }), opts);
      expect(paints(r.calls), id).toBeGreaterThan(0);
    }
  });

  it("Colors show their motif unless a champion skin is worn, particles capped", () => {
    const b = body({ colour: "candy-colours", sp: 0 });
    expect(wearsFx(b)).toBe(true);
    let most = 0,
      drawn = 0;
    for (let i = 0; i < 400; i++) {
      const r = recorder();
      drawWornBehind(r.ctx, b, { ...opts, now: 1000 + i * 16 });
      drawWornFront(r.ctx, b, { ...opts, now: 1000 + i * 16 });
      most = Math.max(most, b.fx!.length);
      drawn += paints(r.calls);
    }
    expect(drawn).toBeGreaterThan(0);
    expect(most).toBeGreaterThan(0);
    expect(most).toBeLessThanOrEqual(PLAZA_FX_CAP);
    const skinned = body({
      colour: "candy-colours",
      skin: { skin: "voltkit-stormcrown" },
    });
    expect(wearsFx(skinned)).toBe(false);
    const r = recorder();
    drawWornBehind(r.ctx, skinned, opts);
    drawWornFront(r.ctx, skinned, opts);
    expect(paints(r.calls)).toBe(0);
  });

  it("nothing worn, nothing drawn", () => {
    const r = recorder();
    drawWornBehind(r.ctx, body({}), opts);
    drawWornFront(r.ctx, body({}), opts);
    expect(r.calls).toEqual([]);
  });
});

describe("one aura size for the whole game", () => {
  it("the Plaza, battles and the Lobby all size auras from aura-size.ts", async () => {
    const size = await import("../../apps/client/src/aura-size");
    const plaza = await import("../../apps/client/src/plaza/plaza-cosmetics");
    // Aura units per art unit of the fighter: the same everywhere, but for
    // the Plaza's own boost (its fighters are small: owner, 18 Nov 2026).
    const perArt = size.AURA_ART_SCALE;
    expect(plaza.PLAZA_AURA_BOOST).toBe(1.35);
    expect(
      plaza.PLAZA_AURA_SCALE / plaza.PLAZA_PX_PER_ART / plaza.PLAZA_AURA_BOOST,
    ).toBeCloseTo(perArt, 6);
    expect(size.battleAuraScale(0.7) / (0.7 / 2)).toBeCloseTo(perArt, 6);
    // The Lobby (the fighter select, two canvas px per art unit).
    expect(size.auraScale(2)).toBeCloseTo((32 * 2 * size.AURA_SIZE) / 48, 6);
  });
});

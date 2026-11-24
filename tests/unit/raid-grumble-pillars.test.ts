import { describe, expect, it } from "vitest";
import { OBSTACLES } from "@arena/shared";
import { WORLD_ART } from "../../packages/shared/src/world-art";
import { BLOCK_H, courtBlockFrame } from "../../apps/client/src/arena-courts";
import {
  CRUMBLE_MS,
  PILLARS,
  RISE_MS,
  eventBits,
  frameBlock,
  frameShadow,
  glintNow,
  packPillars,
  pillarLook,
  puffAt,
  shadowOutline,
  stoneAt,
} from "../../apps/client/src/raid-grumble-pillars";
import { PILLAR_K } from "../../apps/client/src/raid-grumble-pillars-rig";

const seeded =
  (s = 7) =>
  () =>
    (s = (s * 16807) % 2147483647) / 2147483647;

describe("Grumblecrag's pillars", () => {
  it("stand on the Coliseum blocks' footprints: the stone fills each footprint", () => {
    expect(PILLARS).toBe(OBSTACLES);
    for (const o of PILLARS) {
      const f = frameBlock(o);
      expect(f.x).toBeLessThan(o.x);
      expect(f.y).toBeLessThan(o.y);
      expect(f.x + f.w).toBeGreaterThan(o.x + o.w);
      expect(f.y + f.h).toBeGreaterThan(o.y + o.h);
      // The same picture box as the PvP block (it sorts by the same front edge).
      const c = courtBlockFrame(o);
      expect(c.y + c.h).toBe(f.y + f.h);
    }
  });

  it("cast their shadow along the world's one sun, soft (the blur fits in its picture)", () => {
    const { sun, shadow } = WORLD_ART;
    for (const o of PILLARS) {
      const pts = shadowOutline(o);
      // The base swept by the sun by the stone's height.
      expect(pts).toContainEqual([
        o.x + o.w + sun.x * BLOCK_H,
        o.y + o.h + sun.y * BLOCK_H,
      ]);
      expect(pts).toContainEqual([o.x, o.y + BLOCK_H]);
      const f = frameShadow(o);
      for (const [x, y] of pts) {
        expect(x - f.x).toBeGreaterThanOrEqual(shadow.blur);
        expect(f.x + f.w - x).toBeGreaterThanOrEqual(shadow.blur);
        expect(y - f.y).toBeGreaterThanOrEqual(shadow.blur);
        expect(f.y + f.h - y).toBeGreaterThanOrEqual(shadow.blur);
      }
    }
  });

  it("stand, crumble into rubble, lie broken and rise again", () => {
    const standing = pillarLook(false, undefined, Infinity);
    expect(standing).toMatchObject({
      block: true,
      rubble: 0,
      shadow: 1,
      light: 1,
      crop: 0,
    });
    const broken = pillarLook(true, undefined, Infinity);
    expect(broken).toMatchObject({
      block: false,
      rubble: 1,
      shadow: 0,
      light: 0,
      rlight: 1,
    });
    // Hit: it shudders and cracks before it sinks.
    const hit = pillarLook(true, "crumble", 60);
    expect(hit.block).toBe(true);
    expect(hit.cracks).toBeCloseTo(60 / 90);
    expect(hit.bx).not.toBe(0);
    expect(hit.rubble).toBe(0);
    // Sinking: cut at the floor (crop = how far it sank + the picture's foot room).
    const sinking = pillarLook(true, "crumble", 450);
    expect(sinking.by).toBeGreaterThan(5);
    expect(sinking.crop).toBeCloseTo(sinking.by + 13);
    expect(sinking.rubble).toBeGreaterThan(0.9);
    expect(sinking.shadow).toBeLessThan(1);
    expect(pillarLook(true, "crumble", CRUMBLE_MS)).toEqual(broken);
    // Rising: out of the floor with an overshoot, the rubble fading.
    const up = pillarLook(false, "rise", 0);
    expect(up).toMatchObject({ block: true, ba: 0, rubble: 1 });
    expect(up.by).toBeCloseTo(36);
    const mid = pillarLook(false, "rise", 250);
    expect(mid.rubble).toBeLessThan(1);
    expect(pillarLook(false, "rise", RISE_MS)).toEqual(standing);
  });

  it("change at once with reduced motion", () => {
    expect(pillarLook(true, "crumble", 0, true)).toEqual(
      pillarLook(true, undefined, 0),
    );
    expect(pillarLook(false, "rise", 0, true)).toEqual(
      pillarLook(false, undefined, 0),
    );
  });

  it("throw fewer stones and less dust on Low, and none with reduced motion", () => {
    const o = PILLARS[0];
    const full = eventBits(o, "crumble", seeded());
    expect([full.puffs.length, full.stones.length]).toEqual([8, 12]);
    const low = eventBits(o, "crumble", seeded(), { low: true });
    expect([low.puffs.length, low.stones.length]).toEqual([4, 6]);
    const calm = eventBits(o, "crumble", seeded(), { reduced: true });
    expect([calm.puffs.length, calm.stones.length]).toEqual([3, 0]);
    const rise = eventBits(o, "rise", seeded());
    expect([rise.puffs.length, rise.stones.length]).toEqual([6, 0]);
  });

  it("throws stones that fall, bounce once and settle near the footprint, never under the floor", () => {
    const o = PILLARS[4];
    const { stones, puffs } = eventBits(o, "crumble", seeded(3));
    for (const s of stones) {
      for (let e = 0; e < s.fd + 400; e += 20) {
        const at = stoneAt(s, e);
        if (!at) continue;
        expect(at.z).toBeGreaterThanOrEqual(0);
        expect(at.y).toBeLessThanOrEqual(at.gy + 1e-9);
      }
      const landed = stoneAt(s, s.fd - 1)!;
      expect(landed.z).toBe(0);
      expect(Math.abs(landed.gy - s.ly)).toBeLessThan(1e-6);
      expect(
        Math.hypot(landed.x - (o.x + o.w / 2), landed.gy - (o.y + o.h / 2)),
      ).toBeLessThan(200);
      expect(stoneAt(s, s.fd + 401)).toBeUndefined();
    }
    for (const f of puffs) {
      expect(puffAt(f, f.delay - 1)).toBeUndefined();
      expect(puffAt(f, f.delay + f.d / 2)!.alpha).toBeGreaterThan(0);
    }
  });

  it("glints on one pillar at a time, every pillar in turn", () => {
    const seen = new Set<number>();
    for (let t = 0; t < 20; t += 0.05) {
      const g = glintNow(t);
      if (g) seen.add(g.i);
    }
    expect([...seen].sort()).toEqual([0, 1, 2, 3, 4]);
  });

  it("packs its atlas without overlaps, well under 10 MB", () => {
    const { width, height, spots } = packPillars(PILLAR_K);
    expect(width * height * 4).toBeLessThan(6_000_000);
    for (const a of spots) {
      expect(a.x + a.w).toBeLessThanOrEqual(width);
      for (const b of spots)
        if (a !== b)
          expect(
            a.x + a.w <= b.x ||
              b.x + b.w <= a.x ||
              a.y + a.h <= b.y ||
              b.y + b.h <= a.y,
          ).toBe(true);
    }
  });
});

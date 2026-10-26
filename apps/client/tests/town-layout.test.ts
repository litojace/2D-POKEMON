import { describe, expect, it } from "vitest";
import {
  TOWN_BUILDINGS,
  TOWN_STALLS,
  TOWN_TREES,
  TOWN_SHRUBS,
  TOWN_OBSTACLES,
} from "../../../packages/shared/src/town";
import {
  arenaGroundFoot,
  boundsOverlap,
  buildingVisualBounds,
  stallVisualBounds,
  WINDMILL_ROTOR_SCALE,
} from "../../../packages/shared/src/town-building-layout";
import { paintedBuilding, paintedStall } from "../src/town-architecture";
import { rnd, treeCanopy, shrubSprite, type Sprite } from "../src/town-art";
import { propSprite } from "../src/town-props";

const rect = (s: Sprite, x: number, y: number, scale = 1) => ({
  left: x - s.ax * scale,
  right: x + (s.w - s.ax) * scale,
  top: y - s.ay * scale,
  bottom: y + (s.h - s.ay) * scale,
});
const source = {} as CanvasImageSource;
const buildings = TOWN_BUILDINGS.map((b) => ({
  id: b.id,
  box: buildingVisualBounds(b),
}));
const stalls = TOWN_STALLS.map((s, i) => ({
  id: `stall-${i}`,
  box: stallVisualBounds(s),
}));
const sites = [...buildings, ...stalls];

describe("town scenery spacing", () => {
  it("reserves every painted roof, doorstep and sail without counting transparent padding", () => {
    for (const b of TOWN_BUILDINGS) {
      const art = paintedBuilding(source, b),
        box = buildingVisualBounds(b);
      const raw = rect(art.sprite, b.x, b.y);
      const visible = {
        left: raw.left + 48,
        right: raw.right - 48,
        top: raw.top + 48,
        bottom: raw.bottom - 48,
      };
      expect(box.left).toBeLessThanOrEqual(visible.left + 0.001);
      expect(box.right).toBeGreaterThanOrEqual(visible.right - 0.001);
      expect(box.top).toBeLessThanOrEqual(visible.top + 0.001);
      expect(box.bottom).toBeGreaterThanOrEqual(visible.bottom - 0.001);
      if (art.hub) {
        const radius = 160 * WINDMILL_ROTOR_SCALE;
        expect(box.left).toBeLessThanOrEqual(b.x + art.hub.x - radius);
        expect(box.right).toBeGreaterThanOrEqual(b.x + art.hub.x + radius);
      }
    }
    for (const s of TOWN_STALLS) {
      const raw = rect(paintedStall(source, s.color), s.x, s.y + 26),
        reserved = stallVisualBounds(s);
      expect(reserved.left).toBeCloseTo(raw.left + 48);
      expect(reserved.right).toBeCloseTo(raw.right - 48);
    }
  });

  it("keeps separate buildings and shop awnings apart", () => {
    for (let i = 0; i < sites.length; i++)
      for (const other of sites.slice(i + 1))
        expect(
          boundsOverlap(sites[i].box, other.box, 16),
          `${sites[i].id} and ${other.id}`,
        ).toBe(false);
  });

  it("keeps complete tree crowns and shrub pictures clear of all buildings", () => {
    const plants = [
      ...TOWN_TREES.map((t, i) => ({
        id: `tree-${i}`,
        box: rect(
          treeCanopy(t.variant),
          t.x,
          t.y - 34,
          (1.05 + rnd(i * 3.3) * 0.35) * (t.variant === 3 ? 0.95 : 1),
        ),
      })),
      ...TOWN_SHRUBS.map((s, i) => ({
        id: `${s.kind}-${i}`,
        box: rect(shrubSprite(s.kind, s.variant), s.x, s.y),
      })),
    ];
    for (const site of sites)
      for (const p of plants)
        expect(
          boundsOverlap(site.box, p.box, 12),
          `${site.id} and ${p.id}`,
        ).toBe(false);
  });

  it("keeps the well, wardrobe, lamps and other station props clear of the roofs", () => {
    const kinds = new Set([
      "well",
      "mirror",
      "lamp",
      "board",
      "crates",
      "obelisk",
    ]);
    for (const o of TOWN_OBSTACLES.filter((o) => kinds.has(o.kind))) {
      const box = rect(
        propSprite(o.kind),
        o.x,
        o.y + (o.shape === "box" ? o.h / 2 : 4),
      );
      for (const site of sites)
        expect(
          boundsOverlap(site.box, box, 8),
          `${site.id} and ${o.kind} at ${o.x},${o.y}`,
        ).toBe(false);
    }
  });

  it("meets the arena front step with the same footprint used for movement", () => {
    const b = TOWN_BUILDINGS.find((b) => b.kind === "coliseum")!,
      foot = arenaGroundFoot(b);
    expect(Math.abs(foot.y + foot.ry - b.y)).toBeLessThan(2);
    expect(
      TOWN_OBSTACLES.find((o) => o.kind === "building" && o.x === b.x),
    ).toMatchObject(foot);
  });
});

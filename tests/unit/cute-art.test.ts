import { svgMarkup } from "../../apps/client/tests/svg-markup";
import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "@arena/shared";
import {
  PROPORTIONS,
  creatureLayers,
  creatureSvg,
  proportioned,
} from "../../apps/client/src/creature-design";
import { rigAnchors, rigAssets } from "../../apps/client/src/animation/assets";
import { rosterDetail, rosterGrid } from "./roster-markup";
describe("cute proportions", () => {
  it("grows the face and shrinks the body while keeping the feet planted", () => {
    expect(PROPORTIONS.head.s).toBeGreaterThan(1);
    expect(PROPORTIONS.body.s).toBeLessThan(1);
    // Feet (y = 172) do not move; the chin line stays inside the body.
    expect(proportioned("legL", 80, 172)[1]).toBeCloseTo(172);
    expect(proportioned("head", 100, 121)[1]).toBeGreaterThan(
      proportioned("body", 100, 112)[1],
    );
  });
  it("bakes the transform into every drawn part", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of ["up", "down", "left", "right"] as const) {
        const { layers } = creatureLayers(id, dir);
        for (const [part, markup] of Object.entries(layers))
          if (markup)
            expect(markup, `${id} ${dir} ${part}`).toMatch(
              /^<g transform="matrix\(/,
            );
      }
  });
  it("keeps front blush on every champion except the void-faced wisp and the masked octopus", () => {
    // Duskveil keeps its void face and Shadopus its ink mask; Terradon has a
    // pink blush on both cheeks.
    for (const id of FIGHTER_IDS) {
      const front = creatureLayers(id, "down").layers.head;
      expect(front.includes('opacity=".5" stroke="none"'), id).toBe(
        id !== "duskveil" && id !== "shadopus",
      );
    }
  });
  it("keeps the rig attached: anchors follow the mapped pivots", () => {
    const head = proportioned("head", 100, 100)[1];
    expect(rigAnchors.headY).toBeCloseTo((head - 130) * 0.5);
    expect(rigAnchors.eyesLift).toBeCloseTo(
      (head - proportioned("eyes", 100, 93)[1]) * 0.5,
    );
    expect(rigAnchors.earsLift).toBeCloseTo(
      (head - proportioned("ears", 100, 65)[1]) * 0.5,
    );
  });
  it("crops every part with finite boxes that contain the scaled eyes and head", () => {
    for (const id of FIGHTER_IDS) {
      const assets = rigAssets(id);
      // 52 complete parts + 12 face expressions; no flattened frames.
      expect(assets).toHaveLength(64);
      for (const a of assets) {
        expect(a.width, a.key).toBeGreaterThan(0);
        expect(a.height, a.key).toBeGreaterThan(0);
        for (const v of [a.originX, a.originY, a.x, a.y])
          expect(Number.isFinite(v)).toBe(true);
        expect(svgMarkup(atob(a.url.split(",")[1]))).not.toMatch(
          /NaN|undefined/,
        );
      }
      const eyes = assets.find((a) => a.key === `rig-${id}-down-eyes`)!;
      const box = atob(eyes.url.split(",")[1])
        .match(/viewBox="([^"]+)"/)![1]
        .split(" ")
        .map(Number);
      // Both enlarged eyes (x 79/121 ± 12, y 93 ± 14 before scaling) fit the crop.
      const [lx, ty] = proportioned("eyes", 66, 79),
        [rx, by] = proportioned("eyes", 134, 107);
      expect(box[0]).toBeLessThanOrEqual(lx);
      expect(box[1]).toBeLessThanOrEqual(ty);
      expect(box[0] + box[2]).toBeGreaterThanOrEqual(rx);
      expect(box[1] + box[3]).toBeGreaterThanOrEqual(by);
    }
  });
  it("gives cards a box tall enough for the bigger heads", () => {
    expect(creatureSvg("voltkit")).toContain('viewBox="0 -12 200 202"');
  });
});
describe("menu art", () => {
  it("no menu portrait wears an element aura (the Wardrobe's look only)", () => {
    expect(rosterGrid("tidefin") + rosterDetail("tidefin")).not.toContain(
      "trait-aura",
    );
  });
});

import { WORLD_ART } from "../../packages/shared/src/world-art";
import { svgMarkup } from "../../apps/client/tests/svg-markup";
import { describe, expect, it } from "vitest";
import { CHARACTERS, FIGHTER_IDS } from "@arena/shared";
import {
  PROPORTIONS,
  creatureLayers,
  creatureSvg,
  proportioned,
} from "../../apps/client/src/creature-design";
import { rigAnchors, rigAssets } from "../../apps/client/src/animation/assets";
import { traitAura, withAura } from "../../apps/client/src/trait-effects";
import {
  AURA_SCALE,
  drawBattleAura,
  type AuraPainter,
} from "../../apps/client/src/battle-aura";
import { fighterSelection } from "../../apps/client/src/fighter-selection";
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
  it("keeps front blush on every champion except the void-faced wisp", () => {
    // Duskveil keeps its void face; Terradon has a pink blush on both cheeks.
    for (const id of FIGHTER_IDS) {
      const front = creatureLayers(id, "down").layers.head;
      expect(front.includes('opacity=".5" stroke="none"'), id).toBe(
        id !== "duskveil",
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
describe("trait auras", () => {
  it("is deterministic and well formed for every fighter", () => {
    for (const id of FIGHTER_IDS) {
      expect(traitAura(id)).toEqual(traitAura(id));
      const svg = withAura(creatureSvg(id), id);
      expect(svg.match(/<svg /g)).toHaveLength(1);
      expect(svg).toContain('class="ta-back"');
      expect(svg).toContain('class="ta-front"');
      expect(svgMarkup(svg)).not.toMatch(/NaN|undefined/);
      // No tag may carry the same attribute twice (e.g. two style attributes).
      for (const tag of svg.match(/<[a-zA-Z][^>]*>/g)!) {
        const names = [...tag.matchAll(/\s([a-zA-Z-]+)="/g)].map((m) => m[1]);
        expect(new Set(names).size, `${id}: ${tag.slice(0, 80)}`).toBe(
          names.length,
        );
      }
    }
  });
  it("stands still for reduced motion", () => {
    for (const id of FIGHTER_IDS) {
      const still = withAura(creatureSvg(id), id, true);
      expect(still).not.toContain("animation:");
      expect(still).not.toContain("<animateMotion");
    }
    expect(withAura(creatureSvg("duskveil"), "duskveil")).toContain(
      "<animateMotion",
    );
  });
  it("only the selected card and the detail portrait wear an aura", () => {
    expect(
      fighterSelection("tidefin").match(/class="trait-aura"/g),
    ).toHaveLength(2);
  });
});
describe("battle auras", () => {
  const recorder = () => {
    const points: number[][] = [];
    let calls = 0;
    const p: AuraPainter = {
      fillStyle: () => p,
      lineStyle: () => p,
      fillEllipse: (x, y, w, h) => (
        calls++,
        points.push([x - w / 2, y - h / 2], [x + w / 2, y + h / 2]),
        p
      ),
      strokeEllipse: (x, y, w, h) => (
        calls++,
        points.push([x - w / 2, y - h / 2], [x + w / 2, y + h / 2]),
        p
      ),
      fillCircle: (x, y, r) => (
        calls++,
        points.push([x - r, y - r], [x + r, y + r]),
        p
      ),
      fillTriangle: (a, b, c, d, e, f) => (
        calls++,
        points.push([a, b], [c, d], [e, f]),
        p
      ),
      lineBetween: (a, b, c, d) => (calls++, points.push([a, b], [c, d]), p),
    };
    return { p, points, calls: () => calls };
  };
  it("draws a compact ground effect for every element", () => {
    for (const id of FIGHTER_IDS) {
      for (const t of [0, 0.37, 1.9, 12.4]) {
        const r = recorder();
        drawBattleAura(r.p, CHARACTERS[id].element, 500, 400, t);
        expect(r.calls(), id).toBeGreaterThan(2);
        for (const [x, y] of r.points) {
          expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true);
          // Stays around the feet: within the scaled ring, rising no higher than the head.
          expect(Math.abs(x - 500)).toBeLessThanOrEqual(40 * AURA_SCALE);
          expect(y - 400).toBeLessThanOrEqual(
            40 * WORLD_ART.groundY * AURA_SCALE,
          );
          expect(400 - y).toBeLessThanOrEqual(45 * AURA_SCALE);
        }
      }
    }
  });
  it("draws nothing when hidden", () => {
    const r = recorder();
    drawBattleAura(r.p, "Fire", 0, 0, 1, 0);
    expect(r.calls()).toBe(0);
  });
});

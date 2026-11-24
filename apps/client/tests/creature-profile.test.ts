import { svgMarkup } from "./svg-markup";
import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "@arena/shared";
import { CHAMPION_SKINS } from "../../../packages/shared/src/shop";
import {
  creatureLayers,
  creatureSvg,
  MOODS,
  type Mood,
} from "../src/creature-design";
import { rigAssets, rigKey, rigAnchorsFor } from "../src/animation/assets";

const directions = ["left", "right"] as const;
describe("complete articulated champion profiles", () => {
  it("keeps Terradon's pink cheek visible in either profile across expressions", () => {
    for (const dir of directions)
      for (const mood of ["normal", ...MOODS] as Mood[]) {
        const head = creatureLayers("terradon", dir, mood).layers.head;
        expect(head).toContain('class="profile-blush"');
        expect(head).toContain('fill="#ff8fb0"');
      }
    expect(creatureLayers("terradon", "up").layers.head).not.toContain(
      "profile-blush",
    );
  });
  it("gives every side a turned torso and a single natural eye in the front's drawing style", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of directions) {
        const front = creatureLayers(id, "down").layers;
        const { layers } = creatureLayers(id, dir);
        expect(layers.body).not.toBe(front.body);
        expect(layers.head).not.toBe(front.head);
        expect(layers.eyes.match(/class="profile-near-eye"/g)).toHaveLength(1);
        for (const svg of Object.values(layers))
          expect(svg).not.toContain("<image");
        expect(layers.head).toContain(
          'class="profile-part profile-head articulated-part"',
        );
        expect(svgMarkup(creatureSvg(id, dir))).not.toMatch(
          /NaN|undefined|Infinity/,
        );
      }
  });
  it("keeps all five expressions distinct on each side's eye layer", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of directions) {
        const eyes = ["normal", ...MOODS].map(
          (mood) => creatureLayers(id, dir, mood as Mood).layers.eyes,
        );
        expect(new Set(eyes).size, id).toBe(5);
        for (const svg of eyes) expect(svg).toContain("profile-near-eye");
      }
  });
  it("draws full backs without front-facing facial features", () => {
    for (const id of FIGHTER_IDS) {
      const { layers } = creatureLayers(id, "up");
      expect(layers.eyes).toBe("");
      expect(layers.head).toContain('data-articulated-facing="up"');
      expect(layers.head).not.toBe(creatureLayers(id, "down").layers.head);
      expect(svgMarkup(creatureSvg(id, "up"))).not.toMatch(
        /NaN|undefined|Infinity/,
      );
    }
  });
  it("occludes the far shoulder and far ear, while showing the near ear interior", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of directions) {
        const svg = creatureSvg(id, dir);
        expect(svg.indexOf('class="fighter-armL"')).toBeLessThan(
          svg.indexOf('class="fighter-torso"'),
        );
        expect(svg.indexOf('class="fighter-earFar"')).toBeLessThan(
          svg.indexOf('class="fighter-head"'),
        );
        if (["voltkit", "cindrake", "tidefin"].includes(id))
          expect(svg.indexOf('class="fighter-ears"')).toBeGreaterThan(
            svg.indexOf('class="fighter-head"'),
          );
        else
          expect(svg.indexOf('class="fighter-ears"')).toBeLessThan(
            svg.indexOf('class="fighter-head"'),
          );
      }
  });
  it("keeps wings, shells, gauntlets and lanterns in independent complete layers", () => {
    for (const dir of [...directions, "up"] as const) {
      for (const id of ["lumoth", "terradon"] as const)
        expect(creatureLayers(id, dir).layers.wings).toContain("<path");
      expect(creatureLayers("duskveil", dir).layers.tail).toContain("<path");
      expect(creatureLayers("auralynx", dir).layers.armR).toContain("<path");
      expect(creatureLayers("voltkit", dir).layers.flame).toContain("<path");
    }
  });
  it("preserves every equipped skin and Awakening stage over the new anatomy", () => {
    for (const skin of CHAMPION_SKINS)
      for (const dir of [...directions, "up"] as const)
        for (const stage of [1, 2, 3]) {
          const { layers } = creatureLayers(skin.champion, dir, "normal", {
            skin: skin.id,
            stage,
          });
          expect(layers.head).toContain("profile-head");
          expect(layers.body).toContain("profile-body");
          expect(svgMarkup(Object.values(layers).join(""))).not.toMatch(
            /NaN|undefined|Infinity/,
          );
        }
  });
  it("places side joints symmetrically, with a real neck pivot and no whole-image textures", () => {
    for (const id of FIGHTER_IDS) {
      const a = rigAssets(id);
      expect(a.some((v) => v.key.includes("whole"))).toBe(false);
      for (const part of ["tail", "armL", "armR", "legL", "legR"] as const) {
        const l = a.find((v) => v.key === rigKey(id, "left", part))!,
          r = a.find((v) => v.key === rigKey(id, "right", part))!;
        expect(l.x).toBeCloseTo(-r.x);
        expect(l.y).toBeCloseTo(r.y);
      }
      expect(
        a.find((v) => v.key === rigKey(id, "right", "tail"))!.x,
      ).toBeLessThan(0);
      expect(rigAnchorsFor(id, "left").headY).toBeGreaterThan(
        rigAnchorsFor(id, "down").headY,
      );
    }
  });
});

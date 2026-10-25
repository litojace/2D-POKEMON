import { describe, expect, it } from "vitest";
import { FIGHTER_IDS } from "@arena/shared";
import { CHAMPION_SKINS } from "../../../packages/shared/src/shop";
import {
  creatureLayers,
  creatureSvg,
  MOODS,
  type Mood,
} from "../src/creature-design";
import { rigAssets, rigKey } from "../src/animation/assets";

const directions = ["left", "right"] as const;

describe("authored champion profiles", () => {
  it("gives every fighter a turned torso and one side eye instead of a compressed front", () => {
    for (const id of FIGHTER_IDS) {
      const front = creatureLayers(id, "down").layers;
      for (const dir of directions) {
        const { layers } = creatureLayers(id, dir);
        expect(layers.body, id).toContain("profile-body");
        expect(layers.body, id).not.toBe(front.body);
        expect(layers.head, id).not.toBe(front.head);
        expect(layers.eyes.match(/class="profile-near-eye"/g), id).toHaveLength(
          1,
        );
        expect(layers.head.includes("profile-mouth"), id).toBe(
          id !== "duskveil" && id !== "mystowl",
        );
        expect(creatureSvg(id, dir), id).not.toMatch(/NaN|undefined|Infinity/);
      }
    }
  });

  it("keeps every side expression distinct and attached to the same eye layer", () => {
    for (const id of FIGHTER_IDS)
      for (const dir of directions) {
        const eyes = ["normal", ...MOODS].map(
          (mood) => creatureLayers(id, dir, mood as Mood).layers.eyes,
        );
        expect(new Set(eyes).size, id).toBe(5);
        for (const svg of eyes) expect(svg).toContain("profile-near-eye");
      }
  });

  it("renders the far shoulder behind the torso while preserving the front order", () => {
    for (const id of FIGHTER_IDS) {
      for (const dir of directions) {
        const svg = creatureSvg(id, dir);
        expect(svg.indexOf('class="fighter-armL"')).toBeLessThan(
          svg.indexOf('class="fighter-torso"'),
        );
      }
      const front = creatureSvg(id, "down");
      expect(front.indexOf('class="fighter-armL"')).toBeGreaterThan(
        front.indexOf('class="fighter-torso"'),
      );
    }
  });

  it("retains species-specific anatomy and equipment in both side views", () => {
    for (const dir of directions) {
      expect(creatureLayers("tidefin", dir).layers.armR).toContain("-jewel)");
      expect(creatureLayers("lumoth", dir).layers.wings).toContain(
        "profile-wings",
      );
      expect(creatureLayers("terradon", dir).layers.wings).toContain("#bfe9ff");
      expect(creatureLayers("duskveil", dir).layers.tail).toContain("-shine)");
      for (const id of ["duskveil", "mystowl"] as const) {
        expect(creatureLayers(id, dir).layers.head).not.toContain(
          "profile-mouth",
        );
      }
    }
  });

  it("uses side anatomy beneath every equipped skin and Awakening stage", () => {
    for (const skin of CHAMPION_SKINS)
      for (const dir of directions)
        for (const stage of [1, 2, 3]) {
          const { layers } = creatureLayers(skin.champion, dir, "normal", {
            skin: skin.id,
            stage,
          });
          expect(layers.head, skin.id).toContain("profile-head");
          expect(layers.body, skin.id).toContain("profile-body");
          expect(layers.eyes, skin.id).toContain("profile-near-eye");
          expect(Object.values(layers).join(""), skin.id).not.toMatch(
            /NaN|undefined|Infinity/,
          );
        }
  });

  it("anchors side tails at the rear hip and mirrors the limb joints", () => {
    for (const id of FIGHTER_IDS) {
      const a = rigAssets(id);
      for (const part of ["tail", "armL", "armR", "legL", "legR"] as const) {
        const left = a.find((v) => v.key === rigKey(id, "left", part))!;
        const right = a.find((v) => v.key === rigKey(id, "right", part))!;
        expect(left.x, id + part).toBeCloseTo(-right.x);
        expect(left.y, id + part).toBeCloseTo(right.y);
      }
      expect(
        a.find((v) => v.key === rigKey(id, "right", "tail"))!.x,
      ).toBeLessThan(0);
      expect(
        a.find((v) => v.key === rigKey(id, "left", "tail"))!.x,
      ).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { creatureLayers } from "../../apps/client/src/creature-design";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import {
  HERO_PREVIEWS,
  heroOutfit,
  heroPreviewLayers,
  heroPreviewSvg,
} from "../../apps/client/src/skins/hero-fashion-preview";

const ids = Object.keys(CHARACTERS) as CharacterId[];
const dirs = ["down", "left", "right", "up"] as const;
const paths = (svg: string) =>
  [...svg.matchAll(/\sd="([^"]+)"/g)].map((m) => m[1]);

describe("Nova Vanguard review art", () => {
  it("covers the full roster with individual costumes and multiple articulated pieces", () => {
    expect(Object.keys(HERO_PREVIEWS).sort()).toEqual([...ids].sort());
    expect(new Set(Object.values(HERO_PREVIEWS).map((d) => d.name)).size).toBe(
      ids.length,
    );
    for (const id of ids) {
      const geometry = dirs.map((dir) => {
        const equipment = heroOutfit(id, dir);
        expect(
          new Set(equipment.map(([part]) => part)).size,
          `${id} ${dir}`,
        ).toBeGreaterThanOrEqual(2);
        return paths(equipment.map(([, svg]) => svg).join("")).join("|");
      });
      expect(geometry[0], id).not.toBe(geometry[1]);
      expect(geometry[0], id).not.toBe(geometry[3]);
    }
  });
  it("draws all 72 views with valid geometry and resolvable materials", () => {
    for (const id of ids)
      for (const dir of dirs) {
        const svg = heroPreviewSvg(id, dir);
        expect(svg, `${id} ${dir}`).not.toMatch(/NaN|undefined|Infinity/);
        const defined = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
        expect(new Set(defined).size).toBe(defined.length);
        for (const [, ref] of svg.matchAll(/url\(#([^)]+)\)/g))
          expect(defined).toContain(ref);
      }
  });
  it("preserves cheek fur, beaks and flame anatomy while replacing clothing", () => {
    for (const dir of dirs)
      for (const [id, part] of [
        ["auralynx", "head"],
        ["halcyra", "flame"],
        ["cindrake", "flame"],
      ] as const) {
        const original = creatureLayers(id, dir).layers[part];
        const dressed = heroPreviewLayers(id, dir).layers[part];
        for (const d of paths(original))
          expect(dressed, `${id} ${dir}`).toContain(`d="${d}"`);
      }
  });
  it("leaves live skins untouched after previewing every costume and facing", () => {
    const before = JSON.stringify(SKIN_ART);
    for (const id of ids) for (const dir of dirs) heroPreviewSvg(id, dir);
    expect(JSON.stringify(SKIN_ART)).toBe(before);
  });
});

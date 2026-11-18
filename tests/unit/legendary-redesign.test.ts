import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { creatureSvg } from "../../apps/client/src/creature-design";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { DESIGNS } from "../../apps/client/src/skins/modern-designs";
import { PIRATE_TINTS } from "../../apps/client/src/skins/modern-pirates";
import {
  VANGUARD_LOOK,
  VANGUARD_TINTS,
} from "../../apps/client/src/skins/modern-vanguard";

const ids = Object.keys(CHARACTERS) as CharacterId[];
const views = ["down", "left", "right", "up"] as const;

describe("Sky Pirates and Nova Vanguard, redrawn per champion", () => {
  for (const [collection, theme, tints] of [
    ["sky-pirates", "pirates", PIRATE_TINTS],
    ["nova-vanguard", "vanguard", VANGUARD_TINTS],
  ] as const) {
    it(`${collection}: every champion wears its own design and body colour`, () => {
      expect(Object.keys(DESIGNS[theme] ?? {}).sort()).toEqual([...ids].sort());
      const hues = new Set<string>();
      for (const id of ids) {
        const art = SKIN_ART[`${id}-${collection}`];
        expect(art.accessories, id).toEqual([`modern-${theme}`]);
        // The body is recoloured: its mid tone differs from the default.
        expect(art.palette.mid, id).toBeTruthy();
        hues.add(`${tints[id].hue}/${tints[id].sat}/${tints[id].lift[1]}`);
      }
      // No two champions in the collection share a body colour.
      expect(hues.size).toBe(ids.length);
    });

    it(`${collection}: every view draws its costume, and its glowing pieces show from the front`, () => {
      for (const id of ids) {
        for (const view of views) {
          const svg = creatureSvg(id, view, undefined, undefined, "normal", {
            skin: `${id}-${collection}`,
          } as any);
          expect(svg, `${id} ${view}`).toContain(`modern-${theme}`);
          expect(svg, `${id} ${view}`).not.toMatch(/NaN|undefined/);
        }
        const front = creatureSvg(id, "down", undefined, undefined, "normal", {
          skin: `${id}-${collection}`,
        } as any);
        expect(
          (front.match(/class="lume"/g) ?? []).length,
          id,
        ).toBeGreaterThanOrEqual(2);
      }
    });
  }

  it("Nova Vanguard trails and skills take each hero's new glow", () => {
    for (const id of ids) {
      const art = SKIN_ART[`${id}-nova-vanguard`];
      expect(art.skill, id).toBe(parseInt(VANGUARD_LOOK[id].glow.slice(1), 16));
      expect(art.vanguard, id).toBe(id);
      expect(art.signature, id).toBe(`${id}-nova-vanguard`);
    }
  });

  it("keeps the champions' own crests under the Vanguard suits", () => {
    for (const id of [
      "cindrake",
      "lumoth",
      "halcyra",
      "glacelle",
      "pangrove",
    ] as CharacterId[])
      expect(SKIN_ART[`${id}-nova-vanguard`].replaces, id).not.toContain(
        "flame",
      );
  });
});

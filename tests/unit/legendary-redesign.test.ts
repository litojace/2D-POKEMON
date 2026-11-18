import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { creatureSvg } from "../../apps/client/src/creature-design";
import { creaturePalette } from "../../apps/client/src/creature-palette";
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

  it("never gives one champion two look-alike body colours across collections", () => {
    // Perceptual distance (CIE76 ΔE): under about 10 two colours read as
    // the same; 24 keeps every pair clearly apart.
    const lab = (hex: string) => {
      const [r, g, b] = [1, 3, 5]
        .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
        .map((c) => (c > 0.04045 ? ((c + 0.055) / 1.055) ** 2.4 : c / 12.92));
      const x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047,
        y = r * 0.2126 + g * 0.7152 + b * 0.0722,
        z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;
      const f = (t: number) =>
        t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116;
      return [116 * f(y) - 16, 500 * (f(x) - f(y)), 200 * (f(y) - f(z))];
    };
    const de = (a: string, b: string) => {
      const [p, q] = [lab(a), lab(b)];
      return Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    };
    const collections = [
      "hon-viet",
      "stars-stripes",
      "hero-squad",
      "neon-campus",
      "sky-pirates",
      "nova-vanguard",
    ];
    const close: string[] = [];
    for (const id of ids) {
      const mids = [
        ["default", creaturePalette[id].mid],
        ...collections.map((c) => [c, SKIN_ART[`${id}-${c}`].palette.mid!]),
      ];
      for (let i = 0; i < mids.length; i++)
        for (let j = i + 1; j < mids.length; j++) {
          const d = de(mids[i][1], mids[j][1]);
          if (d < 24)
            close.push(
              `${id}: ${mids[i][0]} ~ ${mids[j][0]} (ΔE ${d.toFixed(1)})`,
            );
        }
    }
    expect(close).toEqual([]);
  });

  it("keeps Halcyra's own beak under every costume that takes its head-top layer", () => {
    for (const c of [
      "hon-viet",
      "stars-stripes",
      "hero-squad",
      "neon-campus",
      "sky-pirates",
      "nova-vanguard",
    ])
      for (const view of ["down", "left", "right"] as const)
        expect(
          creatureSvg("halcyra", view, undefined, undefined, "normal", {
            skin: `halcyra-${c}`,
          } as any),
          `${c} ${view}`,
        ).toContain('data-keep="beak"');
  });
});

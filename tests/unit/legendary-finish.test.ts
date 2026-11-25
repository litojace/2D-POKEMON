import { describe, expect, it } from "vitest";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { SKIN_ART } from "../../apps/client/src/skins/skin-art";
import { modernOutfit } from "../../apps/client/src/skins/modern-fashion";
import { LEGEND_SECOND } from "../../apps/client/src/skins/legend-colours";
import { creaturePalette } from "../../apps/client/src/creature-palette";
import { creatureLayers } from "../../apps/client/src/creature-design";

const ids = Object.keys(CHARACTERS) as CharacterId[];
const LEGENDARY = ["nova-vanguard", "sky-pirates", "hon-viet", "stars-stripes"] as const;
const THEME = { "nova-vanguard": "vanguard", "sky-pirates": "pirates", "hon-viet": "vietlegend", "stars-stripes": "stars" } as const;
const hsl = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  const h = d === 0 ? 0 : mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return { h: h * 60, s, l };
};
const head = { cx: 100, top: 40 };

describe("the Legendary finish", () => {
  it("gives every Legendary a two-tone body whose light markings stay the lightest colour", () => {
    for (const c of LEGENDARY)
      for (const id of ids) {
        const p = SKIN_ART[`${id}-${c}`].palette!;
        const light = hsl(p.light!), mid = hsl(p.mid!);
        // At least 0.1 apart, or half the champion's own gap where that is
        // smaller (Astrabun is white with near-white markings).
        const own = hsl(creaturePalette[id].light).l - hsl(creaturePalette[id].mid).l;
        expect(light.l - mid.l, `${id}-${c}`).toBeGreaterThanOrEqual(Math.min(0.09, own / 2));
        // Faces drawn in the light colour stay pale.
        // (paler than the 0.8 the others come down to).
        if (LEGEND_SECOND[c][id].soft) expect(light.l, `${id}-${c}`).toBeGreaterThan(0.8);
        // Accent keeps the champion's lightness: some draw their face with it.
        expect(Math.abs(hsl(p.accent!).l - hsl(creaturePalette[id].accent).l), `${id}-${c} accent`).toBeLessThan(0.12);
        // The markings move toward their second hue where they show colour.
        if (light.s > 0.15 && LEGEND_SECOND[c][id].sat > 0.1) {
          const dh = Math.abs(((light.h - LEGEND_SECOND[c][id].hue + 540) % 360) - 180);
          expect(dh, `${id}-${c} hue`).toBeLessThan(25);
        }
      }
  });

  it("edges Legendary garments in metal and sets a clasp at the collar, never from behind", () => {
    for (const c of LEGENDARY)
      for (const id of ids) {
        const theme = THEME[c];
        const front = modernOutfit(theme, id, "down", SKIN_ART[`${id}-${c}`].palette as any, head).map(([, svg]) => svg).join("");
        const back = modernOutfit(theme, id, "up", SKIN_ART[`${id}-${c}`].palette as any, head).map(([, svg]) => svg).join("");
        const band = c === "nova-vanguard" ? undefined : "#f2c14e";
        if (front.includes("clip-path") && band) expect(front, `${id}-${c} trim`).toContain(`stroke="${band}" stroke-width="3.2"`);
        expect(front, `${id}-${c} clasp`).toContain("scale(1.25)");
        expect(back, `${id}-${c} back`).not.toContain("scale(1.25)");
      }
  });

  it("leaves the Epics as they were: one tone, plain garments, no clasp", () => {
    for (const [c, theme] of [["hero-squad", "hero"], ["neon-campus", "campus"], ["starlight-idol", "idol"]] as const)
      for (const id of ids) {
        const svg = modernOutfit(theme, id, "down", SKIN_ART[`${id}-${c}`].palette as any, head).map(([, s]) => s).join("");
        expect(svg, `${id}-${c}`).not.toContain('stroke-width="3.2"');
        expect(svg, `${id}-${c}`).not.toContain("scale(1.25)");
      }
  });

  it("takes off a held piece only where a skin re-forges it (SkinArt.heldOff)", () => {
    const all = (layers: Record<string, string>) => Object.values(layers).join("");
    const OFF: [string, string][] = [
      ["tidefin", "nova-vanguard"], ["tidefin", "sky-pirates"], ["tidefin", "stars-stripes"],
      ["pyranda", "nova-vanguard"], ["pyranda", "sky-pirates"], ["pyranda", "stars-stripes"],
      ["duskveil", "nova-vanguard"], ["duskveil", "sky-pirates"], ["duskveil", "hon-viet"], ["duskveil", "stars-stripes"],
    ];
    for (const id of ["tidefin", "pyranda", "duskveil"] as CharacterId[]) {
      // The champion's own art marks the piece, front and profile.
      for (const dir of ["down", "right"] as const) {
        if (id === "pyranda" && dir === "right") continue; // held from the front only
        expect(all(creatureLayers(id, dir).layers), `${id} ${dir}`).toContain('data-held="1"');
      }
      for (const c of LEGENDARY) {
        const off = OFF.some(([i, cc]) => i === id && cc === c);
        expect(!!SKIN_ART[`${id}-${c}`].heldOff, `${id}-${c}`).toBe(off);
        const worn = all(creatureLayers(id, "down", "normal", { skin: `${id}-${c}`, stage: 1 }).layers);
        expect(worn.includes('data-held="1"'), `${id}-${c}`).toBe(!off);
      }
    }
    // Duskveil keeps its lantern's glow under whatever replaces the body.
    expect(all(creatureLayers("duskveil", "down", "normal", { skin: "duskveil-sky-pirates", stage: 1 }).layers)).toContain('r="17"');
  });
});

import type { Palette } from "./skins/skin-art";

/** Blend two #rrggbb colours (t = 0 gives a, 1 gives b). */
export function mixHex(a: string, b: string, t: number) {
  const ch = (c: string, i: number) =>
    Number.parseInt(c.slice(1 + i * 2, 3 + i * 2), 16);
  return `#${[0, 1, 2]
    .map((i) =>
      Math.round(ch(a, i) + (ch(b, i) - ch(a, i)) * t)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/** Pyranda's own mid and dark (creaturePalette.pyranda; a test keeps them in step). */
export const PYRANDA_BASE = { mid: "#d9572b", dark: "#4a1a12" } as const;

/**
 * Pyranda's red-panda markings (ear insides, tear marks, tail rings, belly and
 * dark legs). Without a skin they keep their original colours; a skin's
 * palette recolours them so they match its fur. The chestnuts and bandolier
 * it carries are items and keep theirs.
 */
export function pyrandaMarks(p: Palette) {
  const own = p.mid === PYRANDA_BASE.mid && p.dark === PYRANDA_BASE.dark;
  return {
    mark: own ? "#8a2a14" : mixHex(p.mid, p.dark, 0.55),
    belly: own ? "#5a2216" : mixHex(p.mid, p.dark, 0.8),
    // Pyranda's own dark is "#4a1a12", so the palette gives the same colour.
    limb: p.dark,
  };
}

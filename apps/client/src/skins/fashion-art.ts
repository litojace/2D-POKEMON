import {
  FASHION_COLLECTION_IDS,
  FASHION_ROSTER,
  type FashionCollection,
} from "../../../../packages/shared/src/shop";
import type { CharacterId } from "@arena/shared";
import type { SkinArt, Palette } from "./skin-art";
import { creaturePalette } from "../creature-palette";
import { EPIC_REPLACED_PROPS } from "./epic-materials";

const blend = (a: string, b: string, t: number) =>
  "#" +
  [1, 3, 5]
    .map((i) =>
      Math.round(
        parseInt(a.slice(i, i + 2), 16) * (1 - t) +
          parseInt(b.slice(i, i + 2), 16) * t,
      )
        .toString(16)
        .padStart(2, "0"),
    )
    .join("");
const color = (hex: string) => parseInt(hex.slice(1), 16);
const toHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    l = (max + min) / 2,
    d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h =
    max === r
      ? ((g - b) / d + 6) % 6
      : max === g
        ? (b - r) / d + 2
        : (r - g) / d + 4;
  return [h * 60, s, l];
};
const fromHsl = (h: number, s: number, l: number) => {
  const k = (n: number) => (n + h / 30) % 12,
    a = s * Math.min(l, 1 - l),
    f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, 9 - k(n), 1));
  return (
    "#" +
    [0, 8, 4]
      .map((n) =>
        Math.round(Math.max(0, Math.min(1, f(n))) * 255)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
};
/** Move a champion color toward a collection hue while keeping its lightness:
 * a dark void face stays dark, white markings stay light, so the anatomy
 * reads the same and only the costume's color story changes. */
const retint = (
  hex: string,
  hue: number,
  mix: number,
  sat: number,
  lift = 0,
) => {
  const [h, s, l] = toHsl(hex);
  // Greys have no hue of their own: take the collection's outright.
  const m = s < 0.12 ? 1 : mix;
  const dh = ((hue - h + 540) % 360) - 180;
  // A part-way hue lands between the two (cyan toward amber passes olive), so
  // the hue moves almost all the way and only the saturation keeps a share.
  return fromHsl(
    (h + dh * Math.max(m, 0.94) + 360) % 360,
    s + (sat - s) * m,
    Math.max(0.04, Math.min(0.97, l + lift)),
  );
};
export type Tint = {
  hue: number;
  mix: number;
  sat: number;
  lift: [number, number, number];
};
/** One color story per collection, so the three Rares never read as one look. */
const TINTS: Record<FashionCollection, Tint> = {
  // Warm honey and russet, an adventurer's sun-worn coat.
  wayfarer: { hue: 26, mix: 0.85, sat: 0.58, lift: [0.02, -0.04, -0.04] },
  // Blossom pink over a pale silk base.
  "moonlit-tea": { hue: 340, mix: 0.85, sat: 0.62, lift: [0.04, 0.06, 0] },
  // Midnight velvet: a deep indigo body for gold stars to sit on.
  "astral-court": {
    hue: 238,
    mix: 0.88,
    sat: 0.5,
    lift: [-0.04, -0.14, -0.06],
  },
  // Deep-water teal, still bright enough to read on a dark arena floor.
  "abyssal-expedition": {
    hue: 184,
    mix: 0.9,
    sat: 0.62,
    lift: [0, -0.06, -0.02],
  },
};
const tinted = (id: CharacterId, collection: FashionCollection): Palette => {
  const base = creaturePalette[id],
    t = TINTS[collection];
  const tone = (hex: string, lift: number) =>
    retint(hex, t.hue, t.mix, t.sat, lift);
  return {
    light: tone(base.light, t.lift[0]),
    mid: tone(base.mid, t.lift[1]),
    dark: tone(base.dark, t.lift[2]),
    glow: base.glow,
    accent: tone(base.accent, 0),
  };
};
/** A champion's palette moved toward a tint (Legendary collections use it). */
export const tintPalette = (id: CharacterId, t: Tint): Palette => {
  const base = creaturePalette[id];
  const tone = (hex: string, lift: number) =>
    retint(hex, t.hue, t.mix, t.sat, lift);
  return {
    light: tone(base.light, t.lift[0]),
    mid: tone(base.mid, t.lift[1]),
    dark: tone(base.dark, t.lift[2]),
    glow: base.glow,
    accent: tone(base.accent, 0),
  };
};
const artFor = (
  champion: CharacterId,
  collection: FashionCollection,
): SkinArt => {
  const accent = FASHION_ROSTER[champion][4];
  if (collection === "abyssal-expedition")
    return {
      palette: { ...tinted(champion, collection), glow: "#8ff5e6" },
      accessories: [`fashion-${collection}`],
      replaces: EPIC_REPLACED_PROPS.includes(champion)
        ? ["flame", "scarf"]
        : ["scarf"],
      pattern: {
        kind: "bands",
        color: "#82bfbc",
        opacity: 0.12,
        parts: ["tail", "wings"],
      },
      trail: { kind: "bubble", colors: [0x72f2de, 0xf3ac59] },
      skill: 0x72dfd3,
      // The small glint every Epic has; moving signature motifs are kept
      // for the Legendary collections.
      detail: "glint",
      weapon: { handle: "#284454", head: "#79bfc5" },
    };

  const palette: Palette = {
    ...tinted(champion, collection),
    ...(collection === "astral-court" ? { glow: "#bfe8ff" } : {}),
  };
  const common = {
    palette,
    accessories: [`fashion-${collection}`] as SkinArt["accessories"],
    // The coat takes the neck: a default scarf or towel would sit over it.
    replaces: ["scarf"] as SkinArt["replaces"],
  };
  switch (collection) {
    case "wayfarer":
      return {
        ...common,
        trail: { kind: "leaf", colors: [color(accent), 0xa9bf94] },
      };
    case "moonlit-tea":
      return {
        ...common,
        pattern: {
          kind: "petals",
          color: "#fff2df",
          opacity: 0.22,
          parts: ["tail", "wings"],
        },
        trail: { kind: "petal", colors: [color(accent), 0xffeedc] },
      };
    case "astral-court":
      return {
        ...common,
        pattern: {
          kind: "stars",
          color: "#d6e8ff",
          opacity: 0.5,
          parts: ["tail", "wings", "ears"],
        },
        trail: { kind: "star", colors: [0xbfe8ff, color(accent)] },
      };
  }
};

/** All 72 looks use the production creature layers and effect budget. */
export const FASHION_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(FASHION_ROSTER) as CharacterId[]).flatMap((id) =>
    FASHION_COLLECTION_IDS.map((collection) => [
      `${id}-${collection}`,
      artFor(id, collection),
    ]),
  ),
);

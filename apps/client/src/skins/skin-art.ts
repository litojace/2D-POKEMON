import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";

/**
 * How each Shop skin looks. Skins re-draw the champion's own art with a new
 * palette, then add (by rarity) a pattern masked to the body, small
 * accessories, in-game effects and, for Mythicals, animated extras.
 * Nothing here changes a hitbox, size or timing (see the fairness rules in
 * docs/raid-roster-design.md §10.5.1).
 */
export type Palette = {
  light: string;
  mid: string;
  dark: string;
  glow: string;
  accent: string;
};
export type PatternKind =
  | "spots"
  | "koi"
  | "stripes"
  | "bands"
  | "grid"
  | "stars"
  | "constellation"
  | "panels"
  | "veins"
  | "cracks"
  | "speckle"
  | "facets"
  | "gears"
  | "glowdots"
  | "petals"
  | "snow"
  | "drips";
export type Accessory =
  | "earmuffs"
  | "ribbon"
  | "stem"
  | "goggles"
  | "apron"
  | "tricorn"
  | "tassels"
  | "lantern-tassels"
  | "gradcap"
  | "witchhat"
  | "bonsai"
  | "knit-scarf"
  | "crown"
  | "corona"
  | "island"
  | "halo"
  | "third-eye"
  | "eclipse-ring";
/** Particles left behind when dashing. */
export type Trail =
  | "snow"
  | "confetti"
  | "spice"
  | "lily"
  | "coin"
  | "petal"
  | "leaf"
  | "page"
  | "bubble"
  | "dust"
  | "pixel"
  | "star"
  | "ember";
export type Mythic =
  | "stormcrown"
  | "sunforged"
  | "moontide"
  | "celestial-sage"
  | "starweaver"
  | "oracle"
  | "world-shell"
  | "eclipse";
export interface SkinArt {
  palette: Partial<Palette>;
  pattern?: { kind: PatternKind; color: string; color2?: string; opacity?: number; parts?: CreaturePart[] };
  accessories?: Accessory[];
  /** Accessories that appear from an Awakening stage on (Mythicals). */
  stageAccessories?: { stage: number; accessory: Accessory }[];
  trail?: { kind: Trail; colors: number[] };
  /** Epic and up: skill and hit-spark colour (shapes never change). */
  skill?: number;
  /** Epic and up: a small animated detail on the rig. */
  detail?: "pulse" | "glint" | "flicker" | "shimmer" | "gears" | "frost";
  mythic?: Mythic;
}

const hex = (c: string) => Number.parseInt(c.slice(1), 16);

export const SKIN_ART: Record<string, SkinArt> = {
  // ---------------------------------------------------------------- Voltkit
  "voltkit-midnight": { palette: { light: "#c9d6ff", mid: "#3a4f9a", dark: "#141b3d", glow: "#5ff6ff", accent: "#5ff6ff" } },
  "voltkit-peach-fizz": { palette: { light: "#fff0e6", mid: "#ffb08f", dark: "#7a3a2e", glow: "#ff8fc8", accent: "#ff6fa8" } },
  "voltkit-mint-static": { palette: { light: "#f4fffb", mid: "#9ef0cf", dark: "#22594a", glow: "#ffffff", accent: "#3fbf95" } },
  "voltkit-snowcap": {
    palette: { light: "#ffffff", mid: "#cfe8ff", dark: "#2c4a6e", glow: "#9ff3ff", accent: "#6fa8dc" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 0.8 },
    accessories: ["earmuffs"],
    trail: { kind: "snow", colors: [0xffffff, 0xcfe8ff] },
  },
  "voltkit-kite-runner": {
    palette: { light: "#fff5e0", mid: "#ff9a4f", dark: "#6a2f1a", glow: "#fff16b", accent: "#3a7bd5" },
    pattern: { kind: "stripes", color: "#3a7bd5", opacity: 0.55, parts: ["body", "tail", "ears"] },
    accessories: ["ribbon"],
    trail: { kind: "confetti", colors: [0xff4f6a, 0x3a7bd5, 0xffd65b, 0x4fd68a] },
  },
  "voltkit-neon-arcade": {
    palette: { light: "#ffd6ff", mid: "#7a2bd6", dark: "#1a0b3d", glow: "#ff4fd8", accent: "#2ff3ff" },
    pattern: { kind: "grid", color: "#2ff3ff", opacity: 0.55 },
    trail: { kind: "pixel", colors: [0xff4fd8, 0x2ff3ff] },
    skill: 0xff4fd8,
    detail: "pulse",
  },
  "voltkit-stormcrown": {
    palette: { light: "#d9e0ea", mid: "#6f7d93", dark: "#232a38", glow: "#ffd65b", accent: "#ffd65b" },
    pattern: { kind: "veins", color: "#ffd65b", opacity: 0.9 },
    stageAccessories: [{ stage: 3, accessory: "crown" }],
    trail: { kind: "star", colors: [0xffd65b, 0xfff3b0] },
    skill: 0xffd65b,
    detail: "glint",
    mythic: "stormcrown",
  },
  // --------------------------------------------------------------- Cindrake
  "cindrake-ashen": { palette: { light: "#9a9aa6", mid: "#4a4a55", dark: "#17171d", glow: "#ff8a3d", accent: "#ff6a2a" } },
  "cindrake-coral": { palette: { light: "#fff1ea", mid: "#ff9e8f", dark: "#6e2e2a", glow: "#fff0c2", accent: "#ffd2c4" } },
  "cindrake-lime-flame": { palette: { light: "#f0ffc8", mid: "#8fd66a", dark: "#2a4a1a", glow: "#c8ff3d", accent: "#3a6a1a" } },
  "cindrake-chili-pepper": {
    palette: { light: "#ffb3a8", mid: "#e0261f", dark: "#5a0d0b", glow: "#ffd34d", accent: "#2f8a2f" },
    pattern: { kind: "speckle", color: "#ffffff", opacity: 0.35, parts: ["body", "head"] },
    accessories: ["stem"],
    trail: { kind: "spice", colors: [0xff4f2a, 0xffa23a, 0x8a1a0a] },
  },
  "cindrake-blue-flame": {
    palette: { light: "#e6f3ff", mid: "#4f8cff", dark: "#13245c", glow: "#bff0ff", accent: "#1a2a5c" },
    pattern: { kind: "glowdots", color: "#bff0ff", opacity: 0.55, parts: ["body", "tail", "armL", "armR"] },
    trail: { kind: "ember", colors: [0xbff0ff, 0x4f8cff] },
    skill: 0x9fdcff,
  },
  "cindrake-volcano-forge": {
    palette: { light: "#ffcf8a", mid: "#8a4a2a", dark: "#2a140c", glow: "#ff8a2a", accent: "#3a3a44" },
    pattern: { kind: "cracks", color: "#ffb44d", opacity: 0.95 },
    accessories: ["goggles", "apron"],
    trail: { kind: "ember", colors: [0xff8a2a, 0xffd65b] },
    skill: 0xff9a2e,
    detail: "pulse",
  },
  "cindrake-sunforged": {
    palette: { light: "#6a5a7a", mid: "#2a2230", dark: "#0e0a12", glow: "#ffd65b", accent: "#ffb02e" },
    pattern: { kind: "cracks", color: "#ffd65b", opacity: 1 },
    stageAccessories: [{ stage: 2, accessory: "corona" }],
    trail: { kind: "ember", colors: [0xffd65b, 0xffb02e, 0xfff3b0] },
    skill: 0xffe27a,
    detail: "glint",
    mythic: "sunforged",
  },
  // ---------------------------------------------------------------- Tidefin
  "tidefin-bubblegum": { palette: { light: "#fff0f6", mid: "#ff9ec4", dark: "#6e2346", glow: "#ff4f9a", accent: "#b02a6e" } },
  "tidefin-abyss": { palette: { light: "#6fb6d6", mid: "#1d4a7a", dark: "#071a2e", glow: "#4fffd8", accent: "#0a2a4a" } },
  "tidefin-sandbar": { palette: { light: "#fff6e0", mid: "#e8c98f", dark: "#5a4a2a", glow: "#4fd6b8", accent: "#2a8a7a" } },
  "tidefin-koi-pond": {
    palette: { light: "#ffffff", mid: "#fff3ea", dark: "#4a2a1a", glow: "#ff6a2a", accent: "#ff6a2a" },
    pattern: { kind: "koi", color: "#ff6a2a", color2: "#1a1a1a", opacity: 0.9 },
    trail: { kind: "lily", colors: [0x4fb86a, 0x8fd66a, 0xffb3cf] },
  },
  "tidefin-corsair": {
    palette: { light: "#e6fbff", mid: "#3fbfcf", dark: "#0f3a4f", glow: "#ffd65b", accent: "#c0262a" },
    pattern: { kind: "bands", color: "#ffffff", opacity: 0.55, parts: ["body"] },
    accessories: ["tricorn"],
    trail: { kind: "coin", colors: [0xffd65b, 0xffb02e] },
  },
  "tidefin-glacier": {
    palette: { light: "#ffffff", mid: "#bfeaff", dark: "#2a5a7a", glow: "#e6fbff", accent: "#7fd0ff" },
    pattern: { kind: "facets", color: "#ffffff", opacity: 0.7 },
    trail: { kind: "snow", colors: [0xffffff, 0xbfeaff] },
    skill: 0xbff3ff,
    detail: "frost",
  },
  "tidefin-moontide": {
    palette: { light: "#4f6fa8", mid: "#1a2a5a", dark: "#070d24", glow: "#7ff3ff", accent: "#c8f6ff" },
    pattern: { kind: "glowdots", color: "#7ff3ff", opacity: 1 },
    trail: { kind: "bubble", colors: [0x7ff3ff, 0xc8f6ff] },
    skill: 0xc8f6ff,
    detail: "shimmer",
    mythic: "moontide",
  },
  // --------------------------------------------------------------- Auralynx
  "auralynx-snowshoe": { palette: { light: "#ffffff", mid: "#e6ecf5", dark: "#3a4a62", glow: "#a8e6ff", accent: "#2a3a5a" } },
  "auralynx-desert": { palette: { light: "#fff3dc", mid: "#e0b57a", dark: "#5a3a1a", glow: "#ffc85b", accent: "#3a2a1a" } },
  "auralynx-twilight": { palette: { light: "#f0e0ff", mid: "#9a6bd6", dark: "#2a1a4a", glow: "#ff9ac8", accent: "#1f1236" } },
  "auralynx-cherry-blossom": {
    palette: { light: "#fff0f5", mid: "#ffb3cf", dark: "#6a2a46", glow: "#ffffff", accent: "#ff6fa0" },
    pattern: { kind: "petals", color: "#ff6fa0", opacity: 0.6 },
    trail: { kind: "petal", colors: [0xffb3cf, 0xff6fa0, 0xffffff] },
  },
  "auralynx-jade-temple": {
    palette: { light: "#e6fff0", mid: "#4fc28a", dark: "#0f3a2a", glow: "#b8ffd8", accent: "#c0262a" },
    accessories: ["tassels"],
    trail: { kind: "dust", colors: [0xffd65b, 0xb8ffd8] },
  },
  "auralynx-stained-glass": {
    palette: { light: "#ffffff", mid: "#6a8aff", dark: "#1a1a3a", glow: "#ffd65b", accent: "#ff4f6a" },
    pattern: { kind: "panels", color: "#1a1a3a", opacity: 0.75, parts: ["body", "tail", "ears", "armL", "armR", "legL", "legR", "wings"] },
    trail: { kind: "star", colors: [0xffd65b, 0xff4f6a, 0x6a8aff, 0x4fd68a] },
    skill: 0x8fb0ff,
    detail: "glint",
  },
  "auralynx-celestial-sage": {
    palette: { light: "#a8b8ff", mid: "#2a3a8a", dark: "#0a0f2e", glow: "#fff3b0", accent: "#c8d0ff" },
    pattern: { kind: "stars", color: "#fff3b0", opacity: 1 },
    stageAccessories: [{ stage: 3, accessory: "halo" }],
    trail: { kind: "star", colors: [0xfff3b0, 0xc8d0ff] },
    skill: 0xd8deff,
    detail: "shimmer",
    mythic: "celestial-sage",
  },
  // ---------------------------------------------------------------- Lumoth
  "lumoth-lunar": { palette: { light: "#ffffff", mid: "#e6ecf2", dark: "#4a5a6a", glow: "#fff6d0", accent: "#ffffff" } },
  "lumoth-peachy": { palette: { light: "#fff6ee", mid: "#ffc9a8", dark: "#7a4a3a", glow: "#fff1a0", accent: "#ffffff" } },
  "lumoth-dusk": { palette: { light: "#f0e6ff", mid: "#a88fd6", dark: "#1f1a46", glow: "#ffd6f0", accent: "#e6dcff" } },
  "lumoth-rosy-maple": {
    palette: { light: "#fff6c2", mid: "#ff9ec4", dark: "#7a2a4a", glow: "#fff36b", accent: "#ffe36b" },
    pattern: { kind: "bands", color: "#fff36b", opacity: 0.6, parts: ["wings"] },
    trail: { kind: "dust", colors: [0xfff36b, 0xffe36b] },
  },
  "lumoth-paper-lantern": {
    palette: { light: "#fff3d0", mid: "#ff8a4f", dark: "#6a2a1a", glow: "#ffd65b", accent: "#ffe6b0" },
    pattern: { kind: "stripes", color: "#6a2a1a", opacity: 0.35, parts: ["wings"] },
    trail: { kind: "ember", colors: [0xffd65b, 0xff8a4f] },
  },
  "lumoth-aurora": {
    palette: { light: "#e6fff8", mid: "#4fd6b8", dark: "#13304a", glow: "#b88aff", accent: "#7ff3c8" },
    pattern: { kind: "bands", color: "#b88aff", opacity: 0.45, parts: ["wings"] },
    trail: { kind: "dust", colors: [0x7fffd0, 0xb88aff] },
    skill: 0x7fffd0,
    detail: "shimmer",
  },
  "lumoth-starweaver": {
    palette: { light: "#c8d0ff", mid: "#3a3a8a", dark: "#0e0e2e", glow: "#fff3b0", accent: "#ffffff" },
    pattern: { kind: "constellation", color: "#fff3b0", opacity: 1 },
    trail: { kind: "star", colors: [0xfff3b0, 0xffffff] },
    skill: 0xfff3b0,
    detail: "shimmer",
    mythic: "starweaver",
  },
  // ---------------------------------------------------------------- Mystowl
  "mystowl-snowy": { palette: { light: "#ffffff", mid: "#eef2f8", dark: "#3a3a52", glow: "#ffd65b", accent: "#ffffff" } },
  "mystowl-barn": { palette: { light: "#fff6e6", mid: "#d9a86a", dark: "#4a2e1a", glow: "#ffd65b", accent: "#fff0d6" } },
  "mystowl-midnight": { palette: { light: "#9ab0ff", mid: "#2a3a7a", dark: "#0a1030", glow: "#d8e6ff", accent: "#c8d6ff" } },
  "mystowl-scholar": {
    palette: { light: "#fff0fa", mid: "#c06aa8", dark: "#3a1a3a", glow: "#9ff7ff", accent: "#fff0fa" },
    accessories: ["gradcap"],
    trail: { kind: "page", colors: [0xffffff, 0xf2e6d0] },
  },
  "mystowl-witchs-familiar": {
    palette: { light: "#e6dcff", mid: "#6a4ab8", dark: "#1a1036", glow: "#8fff6a", accent: "#e6dcff" },
    accessories: ["witchhat"],
    trail: { kind: "bubble", colors: [0x8fff6a, 0xc8ffb0] },
  },
  "mystowl-clockwork": {
    palette: { light: "#fff0c8", mid: "#c8963a", dark: "#3a2a12", glow: "#9ff7ff", accent: "#fff0c8" },
    pattern: { kind: "gears", color: "#6a4a1a", opacity: 0.55 },
    trail: { kind: "ember", colors: [0xffd65b, 0xc8963a] },
    skill: 0xffd65b,
    detail: "gears",
  },
  "mystowl-oracle": {
    palette: { light: "#ffc8f0", mid: "#6a2a8a", dark: "#1a0a2a", glow: "#b8f6ff", accent: "#ffd6ff" },
    pattern: { kind: "stars", color: "#ffd6ff", opacity: 0.9 },
    accessories: ["third-eye"],
    trail: { kind: "star", colors: [0xb8f6ff, 0xffd6ff] },
    skill: 0xd8a8ff,
    detail: "shimmer",
    mythic: "oracle",
  },
  // --------------------------------------------------------------- Terradon
  "terradon-mossy": { palette: { light: "#e6f0c8", mid: "#8aa65a", dark: "#2f3a1c", glow: "#c8ff8a", accent: "#5a7a3a" } },
  "terradon-sandstone": {
    palette: { light: "#ffd8b0", mid: "#d0703a", dark: "#4a2010", glow: "#ffd65b", accent: "#8a3a1a" },
  },
  "terradon-granite": {
    palette: { light: "#e6e6ea", mid: "#8a8a96", dark: "#2a2a32", glow: "#a8e6ff", accent: "#5a5a66" },
  },
  "terradon-bonsai": {
    palette: { light: "#f1e0c0", mid: "#a67c4a", dark: "#3a2614", glow: "#6fbf4a", accent: "#4a7a2a" },
    accessories: ["bonsai"],
    trail: { kind: "leaf", colors: [0x6fbf4a, 0x4a7a2a, 0xa6d66a] },
  },
  "terradon-snowball": {
    palette: { light: "#ffffff", mid: "#dfeaf5", dark: "#3a4a5a", glow: "#9fd8ff", accent: "#c0262a" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 0.9 },
    accessories: ["knit-scarf"],
    trail: { kind: "snow", colors: [0xffffff, 0xdfeaf5] },
  },
  "terradon-geode": {
    palette: { light: "#e6d8ff", mid: "#8a7a9a", dark: "#2a1f3a", glow: "#c86bff", accent: "#6a4a8a" },
    pattern: { kind: "cracks", color: "#d48aff", opacity: 1 },
    trail: { kind: "star", colors: [0xc86bff, 0xe6d8ff] },
    skill: 0xc86bff,
    detail: "pulse",
  },
  "terradon-world-shell": {
    palette: { light: "#e6f0c8", mid: "#7a9a5a", dark: "#2a3a1c", glow: "#7fd0ff", accent: "#5a8a3a" },
    pattern: { kind: "spots", color: "#4a7a3a", opacity: 0.45, parts: ["body", "tail"] },
    accessories: ["island"],
    trail: { kind: "leaf", colors: [0x6fbf4a, 0x7fd0ff] },
    skill: 0x8fe0a0,
    detail: "shimmer",
    mythic: "world-shell",
  },
  // --------------------------------------------------------------- Duskveil
  "duskveil-ember": { palette: { light: "#6a6a76", mid: "#3a3a44", dark: "#121216", glow: "#ff9a3d", accent: "#0a0a0e" } },
  "duskveil-ghost-white": { palette: { light: "#ffffff", mid: "#dfe6f0", dark: "#4a5a6e", glow: "#7fd0ff", accent: "#2a3a4e" } },
  "duskveil-teal-spirit": { palette: { light: "#d0fff4", mid: "#2a5a7a", dark: "#0a1a2e", glow: "#4fffd8", accent: "#061220" } },
  "duskveil-pumpkin-lantern": {
    palette: { light: "#ffd6a0", mid: "#6a3a8a", dark: "#1a0e24", glow: "#ff9a2e", accent: "#1a0e14" },
    pattern: { kind: "bands", color: "#ff9a2e", opacity: 0.35, parts: ["head", "body"] },
    trail: { kind: "leaf", colors: [0xff9a2e, 0xc8501a, 0xffd65b] },
  },
  "duskveil-paper-lantern": {
    palette: { light: "#ffe0d0", mid: "#4a2a5a", dark: "#160c1e", glow: "#ff4f4f", accent: "#2a0a14" },
    accessories: ["lantern-tassels"],
    trail: { kind: "ember", colors: [0xff4f4f, 0xffd65b] },
  },
  "duskveil-candlelight": {
    palette: { light: "#fff6e6", mid: "#f0e6d6", dark: "#5a4a3a", glow: "#ffd65b", accent: "#4a3420" },
    pattern: { kind: "drips", color: "#fffaf0", opacity: 0.95, parts: ["head"] },
    trail: { kind: "ember", colors: [0xffd65b, 0xfff3b0] },
    skill: 0xffd65b,
    detail: "flicker",
  },
  "duskveil-eclipse": {
    palette: { light: "#3a3a4a", mid: "#121218", dark: "#000000", glow: "#fff3b0", accent: "#0a0a10" },
    accessories: ["eclipse-ring"],
    trail: { kind: "ember", colors: [0xfff3b0, 0xffd65b] },
    skill: 0xfff3b0,
    detail: "glint",
    mythic: "eclipse",
  },
};

/** Where a champion's head sits, per facing (art units, measured). */
export const HEAD: Record<CharacterId, Record<Facing, { cx: number; top: number }>> = {
  voltkit: { down: { cx: 100, top: 44 }, up: { cx: 100, top: 44 }, left: { cx: 92, top: 44 }, right: { cx: 108, top: 44 } },
  cindrake: { down: { cx: 100, top: 47 }, up: { cx: 100, top: 50 }, left: { cx: 94, top: 47 }, right: { cx: 106, top: 47 } },
  tidefin: { down: { cx: 100, top: 49 }, up: { cx: 100, top: 44 }, left: { cx: 93, top: 49 }, right: { cx: 107, top: 49 } },
  auralynx: { down: { cx: 100, top: 45 }, up: { cx: 100, top: 44 }, left: { cx: 94, top: 45 }, right: { cx: 106, top: 45 } },
  lumoth: { down: { cx: 100, top: 45 }, up: { cx: 100, top: 44 }, left: { cx: 91, top: 45 }, right: { cx: 109, top: 45 } },
  mystowl: { down: { cx: 100, top: 43 }, up: { cx: 100, top: 44 }, left: { cx: 96, top: 43 }, right: { cx: 104, top: 43 } },
  terradon: { down: { cx: 100, top: 51 }, up: { cx: 100, top: 44 }, left: { cx: 89, top: 51 }, right: { cx: 111, top: 51 } },
  duskveil: { down: { cx: 101, top: -5 }, up: { cx: 101, top: -5 }, left: { cx: 96, top: -5 }, right: { cx: 106, top: -5 } },
};

/** Default parts a pattern covers (the eyes are a separate layer and stay clear). */
export const PATTERN_PARTS: CreaturePart[] = ["body", "head", "tail", "armL", "armR", "legL", "legR", "wings", "ears"];

/** A tiny repeatable random from a string (patterns never flicker). */
function seeded(key: string) {
  let h = 2166136261;
  for (const ch of key) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  return () => {
    h = (Math.imul(h ^ (h >>> 15), 2246822507) + 0x6d2b79f5) >>> 0;
    return h / 4294967296;
  };
}
const n = (v: number) => +v.toFixed(1);

/** Wallpaper for a pattern over the whole 200×190 art canvas (masked per part). */
export function patternSvg(kind: PatternKind, color: string, color2 = color, seed: string = kind) {
  const r = seeded(seed);
  const out: string[] = [];
  const star = (x: number, y: number, s: number, c = color) =>
    `<path d="M${n(x)} ${n(y - s)}Q${n(x + s * 0.2)} ${n(y - s * 0.2)} ${n(x + s)} ${n(y)}Q${n(x + s * 0.2)} ${n(y + s * 0.2)} ${n(x)} ${n(y + s)}Q${n(x - s * 0.2)} ${n(y + s * 0.2)} ${n(x - s)} ${n(y)}Q${n(x - s * 0.2)} ${n(y - s * 0.2)} ${n(x)} ${n(y - s)}Z" fill="${c}"/>`;
  switch (kind) {
    case "spots":
      for (let i = 0; i < 26; i++)
        out.push(`<ellipse cx="${n(20 + r() * 160)}" cy="${n(10 + r() * 170)}" rx="${n(4 + r() * 6)}" ry="${n(3 + r() * 5)}" fill="${color}"/>`);
      break;
    case "koi":
      for (let i = 0; i < 9; i++) {
        const x = 30 + r() * 140,
          y = 20 + r() * 160;
        out.push(`<path d="M${n(x)} ${n(y)}q${n(8 + r() * 10)} ${n(-10 - r() * 6)} ${n(20 + r() * 10)} ${n(-2)}q${n(-4)} ${n(14 + r() * 6)} ${n(-20 - r() * 6)} ${n(10)}z" fill="${i % 3 ? color : color2}"/>`);
      }
      break;
    case "stripes":
      for (let x = -200; x < 220; x += 18)
        out.push(`<path d="M${x} 200L${x + 200} 0" stroke="${color}" stroke-width="6" fill="none"/>`);
      break;
    case "bands":
      for (let y = 0; y < 200; y += 16)
        out.push(`<path d="M0 ${y}Q100 ${y + 6} 200 ${y}" stroke="${color}" stroke-width="5" fill="none"/>`);
      break;
    case "grid":
      for (let v = 0; v <= 200; v += 12)
        out.push(`<path d="M${v} -20V200M0 ${v - 12}H200" stroke="${color}" stroke-width="1.2" fill="none"/>`);
      break;
    case "stars":
      for (let i = 0; i < 34; i++) out.push(star(10 + r() * 180, -10 + r() * 195, 1 + r() * 2.6));
      break;
    case "constellation": {
      const pts = Array.from({ length: 22 }, () => [10 + r() * 180, -10 + r() * 195]);
      for (let i = 0; i < pts.length - 1; i += 2)
        out.push(`<path d="M${n(pts[i][0])} ${n(pts[i][1])}L${n(pts[i + 1][0])} ${n(pts[i + 1][1])}" stroke="${color}" stroke-width=".8" opacity=".6" fill="none"/>`);
      for (const [x, y] of pts) out.push(star(x, y, 1.6 + r() * 1.8));
      break;
    }
    case "panels": {
      const fills = ["#ff4f6a", "#ffd65b", "#4fd68a", "#6a8aff", "#c86bff", "#7ff3ff"];
      for (let y = -10; y < 200; y += 22)
        for (let x = 0; x < 200; x += 22) {
          const jx = (r() - 0.5) * 8,
            jy = (r() - 0.5) * 8;
          out.push(`<path d="M${n(x + jx)} ${n(y)}L${n(x + 22)} ${n(y + jy)}L${n(x + 22 - jx)} ${n(y + 22)}L${n(x)} ${n(y + 22 + jy)}Z" fill="${fills[Math.floor(r() * fills.length)]}" fill-opacity=".38" stroke="${color}" stroke-width="2"/>`);
        }
      break;
    }
    case "veins":
      for (let i = 0; i < 9; i++) {
        let x = 20 + r() * 160,
          y = -5 + r() * 180;
        let d = `M${n(x)} ${n(y)}`;
        for (let k = 0; k < 4; k++) {
          x += (r() - 0.5) * 22;
          y += 6 + r() * 10;
          d += `L${n(x)} ${n(y)}`;
        }
        out.push(`<path d="${d}" stroke="${color}" stroke-width="1.8" fill="none"/>`);
      }
      break;
    case "cracks":
      for (let i = 0; i < 10; i++) {
        let x = 20 + r() * 160,
          y = -5 + r() * 185,
          a = r() * Math.PI * 2;
        let d = `M${n(x)} ${n(y)}`;
        for (let k = 0; k < 4; k++) {
          a += (r() - 0.5) * 1.5;
          x += Math.cos(a) * (6 + r() * 7);
          y += Math.sin(a) * (6 + r() * 7);
          d += `L${n(x)} ${n(y)}`;
        }
        out.push(`<path d="${d}" stroke="${color}" stroke-width="4" opacity=".35" fill="none"/><path d="${d}" stroke="${color}" stroke-width="1.6" fill="none"/>`);
      }
      break;
    case "speckle":
      for (let i = 0; i < 90; i++)
        out.push(`<circle cx="${n(r() * 200)}" cy="${n(-10 + r() * 200)}" r="${n(0.6 + r() * 1.2)}" fill="${i % 3 ? color : color2}"/>`);
      break;
    case "facets":
      for (let i = 0; i < 16; i++) {
        const x = 10 + r() * 180,
          y = -5 + r() * 190;
        out.push(`<path d="M${n(x)} ${n(y)}l${n(8 + r() * 10)} ${n(4 + r() * 8)}l${n(-6 - r() * 8)} ${n(8 + r() * 8)}z" fill="${color}" fill-opacity=".35" stroke="${color}" stroke-width=".9"/>`);
      }
      break;
    case "gears":
      for (let i = 0; i < 8; i++) {
        const x = 25 + r() * 150,
          y = 10 + r() * 170,
          s = 5 + r() * 6;
        const teeth = Array.from({ length: 8 }, (_, k) => {
          const a = (k / 8) * Math.PI * 2;
          return `M${n(x + Math.cos(a) * s)} ${n(y + Math.sin(a) * s)}L${n(x + Math.cos(a) * (s + 3))} ${n(y + Math.sin(a) * (s + 3))}`;
        }).join("");
        out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(s)}" stroke="${color}" stroke-width="2" fill="none"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 0.35)}" fill="${color}"/><path d="${teeth}" stroke="${color}" stroke-width="2.6"/>`);
      }
      for (let i = 0; i < 14; i++) out.push(`<circle cx="${n(r() * 200)}" cy="${n(r() * 190)}" r="1.3" fill="${color}"/>`);
      break;
    case "glowdots":
      for (let i = 0; i < 30; i++) {
        const x = r() * 200,
          y = -10 + r() * 200,
          s = 1 + r() * 1.8;
        out.push(`<circle cx="${n(x)}" cy="${n(y)}" r="${n(s * 2.4)}" fill="${color}" opacity=".25"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(s)}" fill="${color}"/>`);
      }
      break;
    case "petals":
      for (let i = 0; i < 18; i++) {
        const x = 15 + r() * 170,
          y = -5 + r() * 190,
          a = Math.round(r() * 360);
        out.push(`<path d="M${n(x)} ${n(y)}q4 -5 8 0q-4 5 -8 0z" fill="${color}" transform="rotate(${a} ${n(x + 4)} ${n(y)})"/>`);
      }
      break;
    case "snow":
      for (let i = 0; i < 28; i++) {
        const x = r() * 200,
          y = -10 + r() * 200,
          s = 1.6 + r() * 2;
        out.push(`<path d="M${n(x - s)} ${n(y)}H${n(x + s)}M${n(x)} ${n(y - s)}V${n(y + s)}M${n(x - s * 0.7)} ${n(y - s * 0.7)}L${n(x + s * 0.7)} ${n(y + s * 0.7)}M${n(x + s * 0.7)} ${n(y - s * 0.7)}L${n(x - s * 0.7)} ${n(y + s * 0.7)}" stroke="${color}" stroke-width=".9"/>`);
      }
      break;
    case "drips":
      // Wax running down from the hood's rim.
      for (let i = 0; i < 9; i++) {
        const x = 52 + i * 12 + (r() - 0.5) * 4,
          len = 8 + r() * 16;
        out.push(`<path d="M${n(x - 4)} 34Q${n(x - 4)} ${n(40 + len)} ${n(x)} ${n(42 + len)}Q${n(x + 4)} ${n(40 + len)} ${n(x + 4)} 34Z" fill="${color}"/>`);
      }
      out.push(`<path d="M30 20Q100 44 170 20V36H30Z" fill="${color}"/>`);
      break;
  }
  return out.join("");
}

/** Accessory art for a facing, as [part layer, svg] in art units. */
export function accessorySvg(a: Accessory, id: CharacterId, dir: Facing, p: Palette): [CreaturePart, string][] {
  const h = HEAD[id][dir];
  const cx = h.cx,
    top = h.top,
    back = dir === "up",
    side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const ink = p.dark;
  // Tails trail to the left when facing right (see creatureLayers).
  const tail = (svg: string): [CreaturePart, string][] => [
    ["tail", dir === "right" ? `<g transform="matrix(-1 0 0 1 200 0)">${svg}</g>` : svg],
  ];
  switch (a) {
    case "earmuffs": {
      const w = side ? 36 : 44;
      const pad = (x: number) => `<ellipse cx="${x}" cy="${top + 14}" rx="9" ry="11" fill="#ffd2e4" stroke="${ink}"/>`;
      return [["flame", `<path d="M${cx - w} ${top + 12}Q${cx} ${top - 22} ${cx + w} ${top + 12}" stroke="#ff8fb8" stroke-width="5" fill="none"/>${pad(cx - w)}${pad(cx + w)}`]];
    }
    case "ribbon":
      return tail(`<path d="M168 92q14 6 18 22q-12 -2 -18 -10q-2 14 -10 22q-2 -16 10 -34z" fill="#ff4f6a" stroke="${ink}"/><path d="M168 92q-6 -10 6 -14q4 8 -6 14z" fill="#ffd65b" stroke="${ink}"/>`);
    case "stem":
      return [["flame", `<path d="M${cx - 16} ${top + 6}Q${cx} ${top - 6} ${cx + 16} ${top + 6}Q${cx} ${top + 12} ${cx - 16} ${top + 6}Z" fill="#3a9a3a" stroke="${ink}"/><path d="M${cx} ${top}q-2 -12 6 -18" stroke="#2f7a2f" stroke-width="5" fill="none"/>`]];
    case "goggles":
      if (back) return [["flame", `<path d="M${cx - 34} ${top + 22}Q${cx} ${top + 30} ${cx + 34} ${top + 22}" stroke="#3a3a44" stroke-width="5" fill="none"/>`]];
      return [["flame", `<path d="M${cx - 36} ${top + 20}Q${cx} ${top + 28} ${cx + 36} ${top + 20}" stroke="#3a3a44" stroke-width="5" fill="none"/>${[-13, 13].filter((dx) => side === 0 || dx * side > 0 || Math.abs(dx) > 10).map((dx) => `<circle cx="${cx + dx + side * 6}" cy="${top + 18}" r="9" fill="#ffb44d" stroke="#3a3a44" stroke-width="3"/><circle cx="${cx + dx + side * 6 - 3}" cy="${top + 15}" r="2.5" fill="#fff" stroke="none"/>`).join("")}`]];
    case "apron":
      if (back) return [];
      return [["scarf", `<path d="M${85 + side * 3} 128L${115 + side * 3} 128L${119 + side * 3} 158L${81 + side * 3} 158Z" fill="#6a4a3a" stroke="${ink}"/><path d="M${88 + side * 3} 136H${112 + side * 3}" stroke="#ffb44d" stroke-width="2"/>`]];
    case "tricorn":
      return [["flame", `<path d="M${cx - 40} ${top + 10}Q${cx} ${top - 26} ${cx + 40} ${top + 10}Q${cx} ${top - 2} ${cx - 40} ${top + 10}Z" fill="#2a1e2e" stroke="${ink}"/><path d="M${cx - 40} ${top + 10}Q${cx} ${top - 2} ${cx + 40} ${top + 10}" stroke="#ffd65b" stroke-width="2.4" fill="none"/>${back ? "" : `<path d="M${cx - 5} ${top - 4}l5 -7l5 7l-5 4z" fill="#fff" stroke="none"/>`}`]];
    case "tassels":
      return [["scarf", `${[-1, 1].map((s) => `<path d="M${100 + s * 22} 124v12" stroke="#c0262a" stroke-width="2"/><path d="M${100 + s * 22 - 4} 136h8l-1 12h-6z" fill="#c0262a" stroke="${ink}"/><circle cx="${100 + s * 22}" cy="124" r="3" fill="#ffd65b" stroke="${ink}"/>`).join("")}`]];
    case "lantern-tassels":
      return tail(`<path d="M168 136v8" stroke="#ffd65b" stroke-width="2"/><path d="M164 144h8l-1 12h-6z" fill="#ff4f4f" stroke="${ink}"/>`);
    case "gradcap":
      return [["flame", `<path d="M${cx - 34} ${top + 2}L${cx} ${top - 12}L${cx + 34} ${top + 2}L${cx} ${top + 14}Z" fill="#1f1a2e" stroke="${ink}"/><path d="M${cx - 18} ${top + 8}v8q18 8 36 0v-8" fill="#1f1a2e" stroke="${ink}"/><path d="M${cx + 30} ${top + 3}v14" stroke="#ffd65b" stroke-width="2"/><circle cx="${cx + 30}" cy="${top + 19}" r="3" fill="#ffd65b" stroke="none"/>`]];
    case "witchhat":
      return [["flame", `<path d="M${cx - 42} ${top + 8}Q${cx} ${top + 20} ${cx + 42} ${top + 8}Q${cx} ${top - 2} ${cx - 42} ${top + 8}Z" fill="#2a1a4a" stroke="${ink}"/><path d="M${cx - 20} ${top + 6}L${cx + 4 - side * 6} ${top - 44}Q${cx + 14} ${top - 40} ${cx + 22} ${top - 30}L${cx + 20} ${top + 6}Z" fill="#2a1a4a" stroke="${ink}"/><path d="M${cx - 19} ${top}Q${cx} ${top + 6} ${cx + 20} ${top}" stroke="#8fff6a" stroke-width="3" fill="none"/>`]];
    case "bonsai":
      return [["flame", `<path d="M${cx} ${top + 4}q-2 -10 4 -18q-8 -4 -6 -12" stroke="#5a3a1a" stroke-width="4" fill="none"/><ellipse cx="${cx - 8}" cy="${top - 26}" rx="16" ry="9" fill="#4a8a2a" stroke="${ink}"/><ellipse cx="${cx + 12}" cy="${top - 18}" rx="13" ry="8" fill="#6fbf4a" stroke="${ink}"/><ellipse cx="${cx - 2}" cy="${top - 34}" rx="10" ry="6" fill="#8fd66a" stroke="${ink}"/>`]];
    case "knit-scarf":
      return [["scarf", `<path d="M76 124Q100 134 124 124L126 134Q100 144 74 134Z" fill="#c0262a" stroke="${ink}"/><path d="M80 128v4M88 130v5M96 131v5M104 131v5M112 130v5M120 128v4" stroke="#ffd2d2" stroke-width="1.4"/>${back ? "" : `<path d="M112 132l6 22l-10 0l-2 -20z" fill="#c0262a" stroke="${ink}"/>`}`]];
    case "crown":
      return [["flame", `<path d="M${cx - 22} ${top + 4}L${cx - 24} ${top - 14}L${cx - 12} ${top - 4}L${cx} ${top - 22}L${cx + 12} ${top - 4}L${cx + 24} ${top - 14}L${cx + 22} ${top + 4}Z" fill="#ffd65b" stroke="#6a4a1f"/><path d="M${cx - 3} ${top - 12}l6 -6l-2 7h4l-7 8l2 -7z" fill="#fff3b0" stroke="none"/>`]];
    case "corona":
      return [["flame", `${Array.from({ length: 10 }, (_, k) => {
        const a = (k / 10) * Math.PI * 2;
        return `<path d="M${n(cx + Math.cos(a) * 22)} ${n(top - 2 + Math.sin(a) * 18)}L${n(cx + Math.cos(a) * 32)} ${n(top - 2 + Math.sin(a) * 27)}" stroke="#ffd65b" stroke-width="3" stroke-linecap="round"/>`;
      }).join("")}`]];
    case "island":
      return [["flame", `<path d="M${cx - 30} ${top - 2}Q${cx} ${top - 14} ${cx + 30} ${top - 2}Q${cx + 10} ${top + 10} ${cx - 30} ${top - 2}Z" fill="#6a8a3a" stroke="${ink}"/><path d="M${cx - 18} ${top - 6}v-12M${cx + 14} ${top - 6}v-10" stroke="#5a3a1a" stroke-width="3"/><circle cx="${cx - 18}" cy="${top - 22}" r="8" fill="#4a8a2a" stroke="${ink}"/><circle cx="${cx + 14}" cy="${top - 19}" r="7" fill="#6fbf4a" stroke="${ink}"/><path d="M${cx - 4} ${top - 10}h10v-6l-5 -5l-5 5z" fill="#fff3d0" stroke="${ink}"/><path d="M${cx + 26} ${top - 4}q2 8 0 14" stroke="#7fd0ff" stroke-width="3" fill="none"/>`]];
    case "halo":
      return [["flame", `<ellipse cx="${cx}" cy="${top - 12}" rx="26" ry="6" fill="none" stroke="#fff3b0" stroke-width="3"/>`]];
    case "third-eye":
      if (back) return [];
      return [["flame", `<ellipse cx="${cx + side * 4}" cy="${top + 14}" rx="7" ry="5" fill="#0a0a2a" stroke="${ink}"/><circle cx="${cx + side * 4}" cy="${top + 14}" r="3" fill="#b8f6ff" stroke="none"/><circle cx="${cx + side * 4 - 1}" cy="${top + 13}" r="1" fill="#fff" stroke="none"/>`]];
    case "eclipse-ring":
      // An eclipsed sun pinned to the hood; the full corona is a Mythical effect.
      if (back) return [];
      return [["flame", `<circle cx="${cx + side * 6}" cy="${top + 30}" r="12" fill="#ffd65b" opacity=".35" stroke="none"/><circle cx="${cx + side * 6}" cy="${top + 30}" r="8" fill="#fff3b0" stroke="none"/><circle cx="${cx + side * 6 + 2}" cy="${top + 29}" r="7" fill="#000" stroke="none"/>`]];
  }
}

/** The look a skin gives a champion at an Awakening stage. */
export function skinArt(skinId: string | null | undefined) {
  return skinId ? SKIN_ART[skinId] : undefined;
}
export function skillColorFor(skinId: string | null | undefined) {
  return skinArt(skinId)?.skill;
}
/** A worn skin's art, only when it was made for the champion being played. */
export function wornArt(
  champion: string,
  look: { skin: string; stage?: number } | null | undefined,
) {
  return look && look.skin.startsWith(`${champion}-`) ? SKIN_ART[look.skin] : undefined;
}
/** The skill colour a fighter's skin gives its moves (Epic and up), if any. */
export function fighterSkillColor(p: {
  character: string;
  championLooks?: Partial<Record<string, { skin: string; stage?: number }>>;
}) {
  return wornArt(p.character, p.championLooks?.[p.character])?.skill;
}
export const hexToNumber = hex;

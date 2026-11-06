import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import { mechaSvg, type MechaPiece } from "./mecha-art";

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
  | "panels"
  | "veins"
  | "cracks"
  | "speckle"
  | "facets"
  | "gears"
  | "glowdots"
  | "petals"
  | "snow"
  | "drips"
  | "circuit"
  | "knit"
  | "runes"
  | "plating";
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
  | "bobble-hat"
  | "acorn-cap"
  | "paper-hat"
  | "lotus"
  | "feather-cap"
  | "towel"
  | "sunflower"
  | "headband"
  | "flower-crown"
  | "antenna"
  | "mushroom"
  | "hardhat"
  | "mask"
  | "starfish"
  | "lure"
  | MechaPiece;
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
  | "ember"
  | "void"
  | "jet";
/** The Void Knight Mythicals (one per champion; art in mythic-art.ts). */
export type Mythic =
  | "storm-revenant"
  | "hellforge"
  | "abyssal-reaver"
  | "spectral-warden"
  | "fallen-lightbringer"
  | "void-inquisitor"
  | "obsidian-bulwark"
  | "crimson-sovereign"
  | "volt-executioner"
  | "ashen-warlord"
  | "rimebane"
  | "nightfeather"
  | "eclipse-templar"
  | "rift-duelist"
  | "iron-juggernaut"
  | "abyss-stalker"
  | "thorn-warden"
  | "blight-sentinel";
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
  detail?: "pulse" | "glint" | "flicker" | "shimmer" | "gears" | "frost" | "scan";
  mythic?: Mythic;
  /**
   * Mythicals: the champion's own pieces on these parts (goggles, crest,
   * kerchief...) come off, and the skin's armour takes their place.
   */
  replaces?: CreaturePart[];
  /**
   * The colours of a champion's held weapon (Astrabun's mochi mallet: its
   * wooden handle and head), so a skin re-forges it. Its band takes the
   * palette's glow either way.
   */
  weapon?: { handle: string; head: string };
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
  "voltkit-arc-unit": {
    palette: { light: "#f4f8ff", mid: "#f2c640", dark: "#161c2a", glow: "#3ff0ff", accent: "#3ff0ff" },
    pattern: { kind: "plating", color: "#3ff0ff", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x3ff0ff, 0xffffff] },
    skill: 0x3ff0ff,
    detail: "scan",
  },
  "voltkit-stormcrown": {
    palette: { light: "#b9b2d8", mid: "#3d3756", dark: "#0d0a18", glow: "#b48cff", accent: "#b48cff" },
    pattern: { kind: "runes", color: "#b48cff", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xb48cff, 0x1a1028] },
    skill: 0xb48cff,
    detail: "glint",
    mythic: "storm-revenant",
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
  "cindrake-reactor": {
    palette: { light: "#f4f8ff", mid: "#e8483a", dark: "#161c2a", glow: "#ffd23f", accent: "#ffd23f" },
    pattern: { kind: "plating", color: "#ffd23f", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xffd23f, 0xffffff] },
    skill: 0xffd23f,
    detail: "scan",
  },
  "cindrake-sunforged": {
    palette: { light: "#8a6f6a", mid: "#2e2226", dark: "#0c0608", glow: "#ff5a2e", accent: "#ff5a2e" },
    pattern: { kind: "runes", color: "#ff5a2e", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xff5a2e, 0x1a1028] },
    skill: 0xff5a2e,
    detail: "glint",
    mythic: "hellforge",
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
  "tidefin-hydro-frame": {
    palette: { light: "#f4f8ff", mid: "#2fb3c8", dark: "#161c2a", glow: "#ff4fd8", accent: "#ff4fd8" },
    pattern: { kind: "plating", color: "#ff4fd8", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xff4fd8, 0xffffff] },
    skill: 0xff4fd8,
    detail: "scan",
  },
  "tidefin-moontide": {
    palette: { light: "#8fb8b8", mid: "#1f3a40", dark: "#04100f", glow: "#2ef2d0", accent: "#2ef2d0" },
    pattern: { kind: "runes", color: "#2ef2d0", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0x2ef2d0, 0x1a1028] },
    skill: 0x2ef2d0,
    detail: "glint",
    mythic: "abyssal-reaver",
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
  "auralynx-prism-mech": {
    palette: { light: "#f4f8ff", mid: "#7f8cff", dark: "#161c2a", glow: "#4ff7ff", accent: "#4ff7ff" },
    pattern: { kind: "plating", color: "#4ff7ff", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x4ff7ff, 0xffffff] },
    skill: 0x4ff7ff,
    detail: "scan",
  },
  "auralynx-celestial-sage": {
    palette: { light: "#a9b6d8", mid: "#2b3352", dark: "#070b1a", glow: "#6fb4ff", accent: "#6fb4ff" },
    pattern: { kind: "runes", color: "#6fb4ff", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0x6fb4ff, 0x1a1028] },
    skill: 0x6fb4ff,
    detail: "glint",
    mythic: "spectral-warden",
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
  "lumoth-photon": {
    palette: { light: "#f4f8ff", mid: "#7fe0b0", dark: "#161c2a", glow: "#fff04a", accent: "#fff04a" },
    pattern: { kind: "plating", color: "#fff04a", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xfff04a, 0xffffff] },
    skill: 0xfff04a,
    detail: "scan",
  },
  "lumoth-starweaver": {
    palette: { light: "#c9c2a8", mid: "#34302a", dark: "#0e0c08", glow: "#ffd95a", accent: "#ffd95a" },
    pattern: { kind: "runes", color: "#ffd95a", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xffd95a, 0x1a1028] },
    skill: 0xffd95a,
    detail: "glint",
    mythic: "fallen-lightbringer",
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
  "mystowl-psi-core": {
    palette: { light: "#f4f8ff", mid: "#ff7ac8", dark: "#161c2a", glow: "#5ae8ff", accent: "#ffe0f2" },
    pattern: { kind: "plating", color: "#5ae8ff", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x5ae8ff, 0xffffff] },
    skill: 0x5ae8ff,
    detail: "scan",
  },
  "mystowl-oracle": {
    palette: { light: "#c6a8c8", mid: "#3a2440", dark: "#10061a", glow: "#ff4fd2", accent: "#e2c4de" },
    pattern: { kind: "runes", color: "#ff4fd2", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xff4fd2, 0x1a1028] },
    skill: 0xff4fd2,
    detail: "glint",
    mythic: "void-inquisitor",
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
  "terradon-tank-mk2": {
    palette: { light: "#f4f8ff", mid: "#8a9a5a", dark: "#161c2a", glow: "#ff9a2e", accent: "#ff9a2e" },
    pattern: { kind: "plating", color: "#ff9a2e", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xff9a2e, 0xffffff] },
    skill: 0xff9a2e,
    detail: "scan",
  },
  "terradon-world-shell": {
    palette: { light: "#9aa890", mid: "#2c3328", dark: "#0a0e08", glow: "#8dff5a", accent: "#8dff5a" },
    pattern: { kind: "runes", color: "#8dff5a", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0x8dff5a, 0x1a1028] },
    skill: 0x8dff5a,
    detail: "glint",
    mythic: "obsidian-bulwark",
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
  "duskveil-phantom-os": {
    palette: { light: "#f4f8ff", mid: "#7a5ad8", dark: "#161c2a", glow: "#6aff8a", accent: "#0a0a14" },
    pattern: { kind: "plating", color: "#6aff8a", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x6aff8a, 0xffffff] },
    skill: 0x6aff8a,
    detail: "scan",
  },
  "duskveil-eclipse": {
    palette: { light: "#5a4a52", mid: "#1e1418", dark: "#050203", glow: "#ff2d55", accent: "#0a0406" },
    pattern: { kind: "runes", color: "#ff2d55", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xff2d55, 0x1a1028] },
    skill: 0xff2d55,
    detail: "glint",
    mythic: "crimson-sovereign",
  },
  // --------------------------------------------------------------- Coilemur
  "coilemur-sifaka": { palette: { light: "#ffffff", mid: "#f0ece4", dark: "#4a2e22", glow: "#ffd84a", accent: "#c9763a" } },
  "coilemur-copper-wire": { palette: { light: "#ffe9d6", mid: "#c8733a", dark: "#3e1f12", glow: "#4ff0e0", accent: "#2fb8a8" } },
  "coilemur-blackout": { palette: { light: "#b8b8c4", mid: "#4a4a56", dark: "#141418", glow: "#b6ff3d", accent: "#7cff5a" } },
  "coilemur-firecracker": {
    palette: { light: "#fff0d6", mid: "#e0352b", dark: "#5a0e0c", glow: "#ffd65b", accent: "#ffd65b" },
    pattern: { kind: "bands", color: "#ffd65b", opacity: 0.75, parts: ["tail"] },
    trail: { kind: "confetti", colors: [0xe0352b, 0xffd65b, 0xffffff] },
  },
  "coilemur-frost-fuse": {
    palette: { light: "#ffffff", mid: "#cfe6ff", dark: "#2c4a6e", glow: "#9ff3ff", accent: "#6fa8dc" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 0.8 },
    accessories: ["bobble-hat"],
    trail: { kind: "snow", colors: [0xffffff, 0xcfe6ff] },
  },
  "coilemur-tesla-coil": {
    palette: { light: "#d8dee8", mid: "#4a5262", dark: "#10141c", glow: "#4ff8ff", accent: "#d8823a" },
    pattern: { kind: "circuit", color: "#4ff8ff", opacity: 1 },
    trail: { kind: "dust", colors: [0x4ff8ff, 0xffffff] },
    skill: 0x4ff8ff,
    detail: "pulse",
  },
  "coilemur-tesla-frame": {
    palette: { light: "#f4f8ff", mid: "#9ab0c8", dark: "#161c2a", glow: "#ffe94a", accent: "#ffe94a" },
    pattern: { kind: "plating", color: "#ffe94a", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xffe94a, 0xffffff] },
    skill: 0xffe94a,
    detail: "scan",
  },
  "coilemur-cometcaller": {
    palette: { light: "#b8c8d0", mid: "#2e3a44", dark: "#081016", glow: "#4ff0ff", accent: "#4ff0ff" },
    pattern: { kind: "runes", color: "#4ff0ff", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0x4ff0ff, 0x1a1028] },
    skill: 0x4ff0ff,
    detail: "glint",
    mythic: "volt-executioner",
  },
  // ---------------------------------------------------------------- Pyranda
  "pyranda-snowy": { palette: { light: "#ffffff", mid: "#e8e8ee", dark: "#3a3a46", glow: "#ffcf4d", accent: "#ffffff" } },
  "pyranda-cinnamon": { palette: { light: "#ffe6cc", mid: "#a8622e", dark: "#3a1e10", glow: "#ffcf4d", accent: "#fff3e0" } },
  "pyranda-plum": { palette: { light: "#ffe0d0", mid: "#8a3a6e", dark: "#2e0f26", glow: "#ffb3a0", accent: "#ffd8c4" } },
  "pyranda-chestnut-grove": {
    palette: { light: "#f2d6b0", mid: "#8a4a22", dark: "#2e1608", glow: "#ffcf4d", accent: "#f6e6cc" },
    accessories: ["acorn-cap"],
    trail: { kind: "leaf", colors: [0xc86a2a, 0x8a4a22, 0xe0a040] },
  },
  "pyranda-street-vendor": {
    palette: { light: "#fff0e0", mid: "#e0572b", dark: "#4a1a12", glow: "#ffcf4d", accent: "#ffffff" },
    pattern: { kind: "stripes", color: "#ffffff", opacity: 0.45, parts: ["body", "armL", "armR"] },
    accessories: ["paper-hat"],
    trail: { kind: "spice", colors: [0xff4f2a, 0xffa23a, 0x8a1a0a] },
  },
  "pyranda-fireside-knit": {
    palette: { light: "#ffe6c8", mid: "#c0502a", dark: "#3e1a10", glow: "#ffb44d", accent: "#fff0dc" },
    pattern: { kind: "knit", color: "#f6e0b8", opacity: 0.7, parts: ["body", "armL", "armR"] },
    trail: { kind: "ember", colors: [0xffb44d, 0xff7a2a] },
    skill: 0xffb44d,
    detail: "flicker",
  },
  "pyranda-afterburner": {
    palette: { light: "#f4f8ff", mid: "#d8643a", dark: "#161c2a", glow: "#4ff0ff", accent: "#fff0dc" },
    pattern: { kind: "plating", color: "#4ff0ff", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x4ff0ff, 0xffffff] },
    skill: 0x4ff0ff,
    detail: "scan",
  },
  "pyranda-harvest-moon": {
    palette: { light: "#b09a8a", mid: "#3a2a24", dark: "#100806", glow: "#ff8a1e", accent: "#cfc4bc" },
    pattern: { kind: "runes", color: "#ff8a1e", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xff8a1e, 0x1a1028] },
    skill: 0xff8a1e,
    detail: "glint",
    mythic: "ashen-warlord",
  },
  // --------------------------------------------------------------- Glacelle
  "glacelle-deep-sea": { palette: { light: "#8fd0f0", mid: "#2a5a9a", dark: "#0a1a3a", glow: "#4ffff0", accent: "#5fa8d8" } },
  "glacelle-lilac-tide": { palette: { light: "#fff4ff", mid: "#d6b8ff", dark: "#4a2a7a", glow: "#ff8fc8", accent: "#f0e0ff" } },
  "glacelle-seafoam": { palette: { light: "#f4fffa", mid: "#9ff0d0", dark: "#1d5a4a", glow: "#ffb36b", accent: "#d8fff0" } },
  "glacelle-water-lily": {
    palette: { light: "#fff6fa", mid: "#ffc4dc", dark: "#6a2a4a", glow: "#ffe36b", accent: "#ffe6f0" },
    accessories: ["lotus"],
    trail: { kind: "petal", colors: [0xffc4dc, 0xffffff, 0x8fd66a] },
  },
  "glacelle-snow-globe": {
    palette: { light: "#e6ecff", mid: "#7f98e8", dark: "#1a2a5a", glow: "#ffd65b", accent: "#c8d8ff" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 1 },
    trail: { kind: "snow", colors: [0xffffff, 0xc8d8ff] },
  },
  "glacelle-deep-glow": {
    palette: { light: "#6a6aa8", mid: "#1a1a4a", dark: "#06061a", glow: "#ff5fd8", accent: "#4ffff0" },
    pattern: { kind: "glowdots", color: "#ff5fd8", opacity: 0.9 },
    trail: { kind: "bubble", colors: [0xff5fd8, 0x4ffff0] },
    skill: 0xff5fd8,
    detail: "shimmer",
  },
  "glacelle-cryo-unit": {
    palette: { light: "#f4f8ff", mid: "#bfe8ff", dark: "#161c2a", glow: "#ff6ad5", accent: "#ff6ad5" },
    pattern: { kind: "plating", color: "#ff6ad5", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xff6ad5, 0xffffff] },
    skill: 0xff6ad5,
    detail: "scan",
  },
  "glacelle-polaris": {
    palette: { light: "#d0e6f0", mid: "#33465a", dark: "#08121e", glow: "#7fe8ff", accent: "#7fe8ff" },
    pattern: { kind: "runes", color: "#7fe8ff", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0x7fe8ff, 0x1a1028] },
    skill: 0x7fe8ff,
    detail: "glint",
    mythic: "rimebane",
  },
  // ---------------------------------------------------------------- Halcyra
  "halcyra-teal-wing": { palette: { light: "#f0fff8", mid: "#2fb8a8", dark: "#0f3a3a", glow: "#c9fff4", accent: "#f0c890" } },
  "halcyra-pied": { palette: { light: "#ffffff", mid: "#3a3a44", dark: "#101014", glow: "#e0e8ff", accent: "#ffffff" } },
  "halcyra-sunset": { palette: { light: "#fff0e0", mid: "#ff7a6a", dark: "#5a1e2a", glow: "#ffe08a", accent: "#ffc84a" } },
  "halcyra-fletcher": {
    palette: { light: "#f0ffe6", mid: "#3a8a4a", dark: "#12301a", glow: "#ffd65b", accent: "#c8823a" },
    pattern: { kind: "stripes", color: "#ffd65b", opacity: 0.5, parts: ["wings"] },
    accessories: ["feather-cap"],
    trail: { kind: "dust", colors: [0xffd65b, 0xfff3b0] },
  },
  "halcyra-winter-plume": {
    palette: { light: "#ffffff", mid: "#e0ecff", dark: "#2a3a6a", glow: "#9ff3ff", accent: "#7fb0ff" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 0.85 },
    accessories: ["earmuffs"],
    trail: { kind: "snow", colors: [0xffffff, 0xe0ecff] },
  },
  "halcyra-paper-crane": {
    palette: { light: "#ffffff", mid: "#f2ece0", dark: "#3a3440", glow: "#ff4f5a", accent: "#e0262f" },
    pattern: { kind: "facets", color: "#8a8070", opacity: 0.8 },
    trail: { kind: "page", colors: [0xffffff, 0xffe0e0] },
    skill: 0xff4f5a,
    detail: "glint",
  },
  "halcyra-sniper-drone": {
    palette: { light: "#f4f8ff", mid: "#3f6ad8", dark: "#161c2a", glow: "#ffa63a", accent: "#ffa63a" },
    pattern: { kind: "plating", color: "#ffa63a", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["scarf"],
    trail: { kind: "jet", colors: [0xffa63a, 0xffffff] },
    skill: 0xffa63a,
    detail: "scan",
  },
  "halcyra-starfletch": {
    palette: { light: "#b0b0d8", mid: "#2a2a4a", dark: "#08081a", glow: "#8a7cff", accent: "#8a7cff" },
    pattern: { kind: "runes", color: "#8a7cff", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["scarf"],
    trail: { kind: "void", colors: [0x8a7cff, 0x1a1028] },
    skill: 0x8a7cff,
    detail: "glint",
    mythic: "nightfeather",
  },
  // ---------------------------------------------------------------- Sunbara
  "sunbara-cocoa": { palette: { light: "#e8c8a8", mid: "#6a3e22", dark: "#24140a", glow: "#ffe066", accent: "#ffb732" } },
  "sunbara-milk-tea": { palette: { light: "#fffaf0", mid: "#e6c8a0", dark: "#5a4030", glow: "#ffe8a0", accent: "#c8945a" } },
  "sunbara-rose-quartz": { palette: { light: "#fff0f4", mid: "#f0a8b8", dark: "#6a2a3a", glow: "#fff0a0", accent: "#ff8fa8" } },
  "sunbara-bathhouse": {
    palette: { light: "#fff6e6", mid: "#d8a070", dark: "#4a2e18", glow: "#9ff3ff", accent: "#ff8fa8" },
    pattern: { kind: "bands", color: "#ffffff", opacity: 0.35, parts: ["body"] },
    accessories: ["towel"],
    trail: { kind: "bubble", colors: [0xffffff, 0xbff0ff] },
  },
  "sunbara-snow-day": {
    palette: { light: "#ffffff", mid: "#e6d6c4", dark: "#4a3a2e", glow: "#9fd8ff", accent: "#c0262a" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 0.9 },
    accessories: ["knit-scarf"],
    trail: { kind: "snow", colors: [0xffffff, 0xe6d6c4] },
  },
  "sunbara-sunflower": {
    palette: { light: "#fff6c8", mid: "#d8a03a", dark: "#4a2e10", glow: "#ffd84a", accent: "#ffb732" },
    accessories: ["sunflower"],
    trail: { kind: "petal", colors: [0xffd84a, 0xffb732] },
    skill: 0xffd84a,
    detail: "glint",
  },
  "sunbara-solar-mech": {
    palette: { light: "#f4f8ff", mid: "#d8a46a", dark: "#161c2a", glow: "#3ff5d0", accent: "#3ff5d0" },
    pattern: { kind: "plating", color: "#3ff5d0", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x3ff5d0, 0xffffff] },
    skill: 0x3ff5d0,
    detail: "scan",
  },
  "sunbara-daybreak": {
    palette: { light: "#c8b49a", mid: "#3a3026", dark: "#0e0a06", glow: "#ffb02e", accent: "#ffb02e" },
    pattern: { kind: "runes", color: "#ffb02e", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xffb02e, 0x1a1028] },
    skill: 0xffb02e,
    detail: "glint",
    mythic: "eclipse-templar",
  },
  // --------------------------------------------------------------- Astrabun
  "astrabun-nightfall": { palette: { light: "#c8d0ff", mid: "#3a4a8a", dark: "#0e1430", glow: "#ffe9a3", accent: "#ffe9a3" } },
  "astrabun-sakura-mochi": { palette: { light: "#ffffff", mid: "#ffc8dc", dark: "#6a2a46", glow: "#fff0a0", accent: "#ff6fa0" } },
  "astrabun-matcha": { palette: { light: "#fffbe6", mid: "#b8d88a", dark: "#2e4a1a", glow: "#fff3b0", accent: "#6a9a3a" } },
  "astrabun-mochi-maker": {
    palette: { light: "#ffffff", mid: "#f6ece0", dark: "#4a3a3a", glow: "#ffd65b", accent: "#e0262f" },
    accessories: ["headband"],
    trail: { kind: "confetti", colors: [0xffffff, 0xff8fb8, 0x8fd66a] },
  },
  "astrabun-clover": {
    palette: { light: "#f6fff0", mid: "#c8f0b0", dark: "#2e5a2a", glow: "#fff3a0", accent: "#3f9a3f" },
    pattern: { kind: "spots", color: "#6fbf4a", opacity: 0.45 },
    accessories: ["flower-crown"],
    trail: { kind: "leaf", colors: [0x6fbf4a, 0x3f9a3f, 0xa6d66a] },
  },
  "astrabun-space-cadet": {
    palette: { light: "#e6eaff", mid: "#5a5aa8", dark: "#141438", glow: "#6ff0ff", accent: "#ffd65b" },
    pattern: { kind: "stars", color: "#ffffff", opacity: 0.9 },
    accessories: ["antenna"],
    trail: { kind: "star", colors: [0x6ff0ff, 0xffffff] },
    skill: 0x6ff0ff,
    detail: "glint",
  },
  "astrabun-warp-unit": {
    palette: { light: "#f4f8ff", mid: "#c8a0ff", dark: "#161c2a", glow: "#ff5aa8", accent: "#ff5aa8" },
    pattern: { kind: "plating", color: "#ff5aa8", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xff5aa8, 0xffffff] },
    skill: 0xff5aa8,
    detail: "scan",
    weapon: { handle: "#5a6478", head: "#dfe6f0" },
  },
  "astrabun-full-moon": {
    palette: { light: "#d0c0e0", mid: "#3a3048", dark: "#0e0a16", glow: "#c86bff", accent: "#c86bff" },
    pattern: { kind: "runes", color: "#c86bff", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xc86bff, 0x1a1028] },
    skill: 0xc86bff,
    detail: "glint",
    mythic: "rift-duelist",
    weapon: { handle: "#15161d", head: "#3b4255" },
  },
  // -------------------------------------------------------------- Wombolder
  "wombolder-sandy": { palette: { light: "#fff6e0", mid: "#e0c890", dark: "#5a4a2a", glow: "#9bd36a", accent: "#a89a80" } },
  "wombolder-coal": { palette: { light: "#b0b0b8", mid: "#55555e", dark: "#18181c", glow: "#7fff8a", accent: "#3a3a44" } },
  "wombolder-ochre": { palette: { light: "#ffe0b8", mid: "#c8742e", dark: "#4a200c", glow: "#ffd65b", accent: "#8a3a1a" } },
  "wombolder-mushroom-hollow": {
    palette: { light: "#f6e6d0", mid: "#8a6a4a", dark: "#2e1e12", glow: "#c8ff8a", accent: "#6a5a4a" },
    accessories: ["mushroom"],
    trail: { kind: "leaf", colors: [0x6fbf4a, 0xa67c4a, 0xe0262f] },
  },
  "wombolder-snowplough": {
    palette: { light: "#ffffff", mid: "#dfe6ee", dark: "#3a4a5a", glow: "#9fd8ff", accent: "#8a9aaa" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 0.9 },
    accessories: ["bobble-hat"],
    trail: { kind: "snow", colors: [0xffffff, 0xdfe6ee] },
  },
  "wombolder-gold-rush": {
    palette: { light: "#f0dcc0", mid: "#9a7a5a", dark: "#2e2012", glow: "#ffd65b", accent: "#6a6a74" },
    pattern: { kind: "veins", color: "#ffc93d", opacity: 0.9 },
    accessories: ["hardhat"],
    trail: { kind: "coin", colors: [0xffd65b, 0xffb02e] },
    skill: 0xffc93d,
    detail: "glint",
  },
  "wombolder-bulldozer": {
    palette: { light: "#f4f8ff", mid: "#9a7050", dark: "#161c2a", glow: "#b8ff3a", accent: "#6a6458" },
    pattern: { kind: "plating", color: "#b8ff3a", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xb8ff3a, 0xffffff] },
    skill: 0xb8ff3a,
    detail: "scan",
  },
  "wombolder-saturnine": {
    palette: { light: "#a8a898", mid: "#33332c", dark: "#0c0c08", glow: "#c8ff3a", accent: "#4a5530" },
    pattern: { kind: "runes", color: "#c8ff3a", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xc8ff3a, 0x1a1028] },
    skill: 0xc8ff3a,
    detail: "glint",
    mythic: "iron-juggernaut",
  },
  // --------------------------------------------------------------- Shadopus
  "shadopus-coral-reef": { palette: { light: "#fff0e0", mid: "#ff7a4f", dark: "#5a1a10", glow: "#ffe36b", accent: "#2a0a06" } },
  "shadopus-deep-blue": { palette: { light: "#d0f0ff", mid: "#2a6ab8", dark: "#081a3a", glow: "#4ffff0", accent: "#04101e" } },
  "shadopus-mimic": { palette: { light: "#fff3dc", mid: "#c8a06a", dark: "#4a3218", glow: "#ffb36b", accent: "#1e1408" } },
  "shadopus-masquerade": {
    palette: { light: "#ffe6f6", mid: "#a8305a", dark: "#2a0a1a", glow: "#ffd65b", accent: "#12040a" },
    accessories: ["mask"],
    trail: { kind: "confetti", colors: [0xffd65b, 0xff6fa8, 0x8a5cff] },
  },
  "shadopus-tide-pool": {
    palette: { light: "#fff0e6", mid: "#c86a5a", dark: "#3a1610", glow: "#7ff3ff", accent: "#1a0806" },
    pattern: { kind: "spots", color: "#ffe0c0", opacity: 0.5 },
    accessories: ["starfish"],
    trail: { kind: "bubble", colors: [0x7ff3ff, 0xffffff] },
  },
  "shadopus-anglerlight": {
    palette: { light: "#6a7aa8", mid: "#1e2a5a", dark: "#060a1e", glow: "#5ff8e0", accent: "#02040e" },
    accessories: ["lure"],
    trail: { kind: "bubble", colors: [0x5ff8e0, 0xc8fff4] },
    skill: 0x5ff8e0,
    detail: "flicker",
  },
  "shadopus-stealth-mk": {
    palette: { light: "#f4f8ff", mid: "#5a48b8", dark: "#161c2a", glow: "#ff3a5a", accent: "#07030c" },
    pattern: { kind: "plating", color: "#ff3a5a", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0xff3a5a, 0xffffff] },
    skill: 0xff3a5a,
    detail: "scan",
  },
  "shadopus-nebula": {
    palette: { light: "#a888b8", mid: "#2a1830", dark: "#08040c", glow: "#ff3b9a", accent: "#07030c" },
    pattern: { kind: "runes", color: "#ff3b9a", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0xff3b9a, 0x1a1028] },
    skill: 0xff3b9a,
    detail: "glint",
    mythic: "abyss-stalker",
  },
  // --------------------------------------------------------------- Pangrove
  "pangrove-autumn": { palette: { light: "#fff0d0", mid: "#e0883a", dark: "#4a2210", glow: "#ffe08a", accent: "#b04a1e" } },
  "pangrove-frostleaf": { palette: { light: "#f4fbff", mid: "#a8d0e0", dark: "#22404e", glow: "#bff4ff", accent: "#6a9ab8" } },
  "pangrove-jade": { palette: { light: "#e0fff0", mid: "#2fa878", dark: "#0a3a28", glow: "#ffd65b", accent: "#147a54" } },
  "pangrove-blossom": {
    palette: { light: "#fff2f8", mid: "#f4a8c8", dark: "#5a2440", glow: "#fff2a0", accent: "#e06a9a" },
    accessories: ["flower-crown"],
    trail: { kind: "petal", colors: [0xffb3d1, 0xffffff] },
  },
  "pangrove-lantern-night": {
    palette: { light: "#ffe8d0", mid: "#d8442e", dark: "#3a0e08", glow: "#ffd65b", accent: "#8a1e12" },
    pattern: { kind: "petals", color: "#ffd65b", opacity: 0.45 },
    accessories: ["lantern-tassels"],
    trail: { kind: "confetti", colors: [0xffd65b, 0xff4f3a, 0xffffff] },
  },
  "pangrove-golden-sap": {
    palette: { light: "#fff6d8", mid: "#e0a43a", dark: "#4a2c08", glow: "#ffe36b", accent: "#a8681a" },
    pattern: { kind: "veins", color: "#fff0a8", opacity: 0.8 },
    accessories: ["stem"],
    trail: { kind: "coin", colors: [0xffd65b, 0xffb02e] },
    skill: 0xffc93d,
    detail: "glint",
  },
  "pangrove-scaleroller": {
    palette: { light: "#f4f8ff", mid: "#4a8a5a", dark: "#161c2a", glow: "#7dff3a", accent: "#2a3a2e" },
    pattern: { kind: "plating", color: "#7dff3a", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x7dff3a, 0xffffff] },
    skill: 0x7dff3a,
    detail: "scan",
  },
  "pangrove-evergrove": {
    palette: { light: "#98a890", mid: "#2a3328", dark: "#080c08", glow: "#7dff3a", accent: "#2a4020" },
    pattern: { kind: "runes", color: "#7dff3a", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0x7dff3a, 0x1a1028] },
    skill: 0x7dff3a,
    detail: "glint",
    mythic: "thorn-warden",
  },
  // --------------------------------------------------------------- Mossloth
  "mossloth-cinnamon": { palette: { light: "#fff0dc", mid: "#b0703e", dark: "#3a1e0c", glow: "#a8e070", accent: "#ffb38a" } },
  "mossloth-snowy": { palette: { light: "#ffffff", mid: "#e8e6dc", dark: "#4a4a40", glow: "#d6f5a8", accent: "#bfe6ff" } },
  "mossloth-dusk": { palette: { light: "#f0e8ff", mid: "#9a8ab0", dark: "#2a2038", glow: "#c8a0ff", accent: "#ffd0f0" } },
  "mossloth-acorn-nap": {
    palette: { light: "#fff4e0", mid: "#c8a070", dark: "#3e2a14", glow: "#b8e07a", accent: "#ffb3c8" },
    accessories: ["acorn-cap"],
    trail: { kind: "leaf", colors: [0x8fd36a, 0xc89a5a, 0xe0b040] },
  },
  "mossloth-cozy-knit": {
    palette: { light: "#ffffff", mid: "#d8dce4", dark: "#3a404e", glow: "#a8e0ff", accent: "#ff8fa8" },
    pattern: { kind: "snow", color: "#ffffff", opacity: 0.85 },
    accessories: ["knit-scarf"],
    trail: { kind: "snow", colors: [0xffffff, 0xdfe6ee] },
  },
  "mossloth-bonsai-keeper": {
    palette: { light: "#f6f0e0", mid: "#a89870", dark: "#33301e", glow: "#ffb3d1", accent: "#ff8fb8" },
    pattern: { kind: "petals", color: "#ffd0e4", opacity: 0.5 },
    accessories: ["bonsai"],
    trail: { kind: "petal", colors: [0xffb3d1, 0xffffff] },
    skill: 0xff9fc8,
    detail: "shimmer",
  },
  "mossloth-treehugger": {
    palette: { light: "#f4f8ff", mid: "#8a8468", dark: "#161c2a", glow: "#3affc0", accent: "#4a4838" },
    pattern: { kind: "plating", color: "#3affc0", opacity: 0.8, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    accessories: ["mecha-helm", "mecha-core", "mecha-pack"],
    replaces: ["flame", "scarf"],
    trail: { kind: "jet", colors: [0x3affc0, 0xffffff] },
    skill: 0x3affc0,
    detail: "scan",
  },
  "mossloth-moonbloom": {
    palette: { light: "#a0a898", mid: "#30332c", dark: "#0a0c08", glow: "#3affc0", accent: "#24402e" },
    pattern: { kind: "runes", color: "#3affc0", opacity: 0.85, parts: ["body", "tail", "armL", "armR", "legL", "legR", "wings"] },
    replaces: ["flame", "scarf"],
    trail: { kind: "void", colors: [0x3affc0, 0x1a1028] },
    skill: 0x3affc0,
    detail: "glint",
    mythic: "blight-sentinel",
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
  terradon: { down: { cx: 100, top: 45 }, up: { cx: 100, top: 47 }, left: { cx: 88, top: 44 }, right: { cx: 112, top: 44 } },
  duskveil: { down: { cx: 101, top: -5 }, up: { cx: 101, top: -5 }, left: { cx: 96, top: -5 }, right: { cx: 106, top: -5 } },
  coilemur: { down: { cx: 100, top: 44 }, up: { cx: 100, top: 44 }, left: { cx: 93, top: 41 }, right: { cx: 107, top: 41 } },
  pyranda: { down: { cx: 100, top: 44 }, up: { cx: 100, top: 44 }, left: { cx: 93, top: 41 }, right: { cx: 107, top: 41 } },
  glacelle: { down: { cx: 100, top: 43 }, up: { cx: 100, top: 43 }, left: { cx: 94, top: 43 }, right: { cx: 106, top: 43 } },
  halcyra: { down: { cx: 100, top: 44 }, up: { cx: 100, top: 44 }, left: { cx: 94, top: 44 }, right: { cx: 106, top: 44 } },
  sunbara: { down: { cx: 100, top: 45 }, up: { cx: 100, top: 45 }, left: { cx: 95, top: 45 }, right: { cx: 105, top: 45 } },
  astrabun: { down: { cx: 100, top: 44 }, up: { cx: 100, top: 44 }, left: { cx: 94, top: 44 }, right: { cx: 106, top: 44 } },
  wombolder: { down: { cx: 100, top: 48 }, up: { cx: 100, top: 48 }, left: { cx: 94, top: 47 }, right: { cx: 106, top: 47 } },
  shadopus: { down: { cx: 100, top: 27 }, up: { cx: 100, top: 27 }, left: { cx: 99, top: 30 }, right: { cx: 101, top: 30 } },
  pangrove: { down: { cx: 100, top: 50 }, up: { cx: 100, top: 50 }, left: { cx: 94, top: 50 }, right: { cx: 106, top: 50 } },
  mossloth: { down: { cx: 100, top: 54 }, up: { cx: 100, top: 54 }, left: { cx: 94, top: 54 }, right: { cx: 106, top: 54 } },
};

/** Default parts a pattern covers (the eyes are a separate layer and stay clear). */
export const PATTERN_PARTS: CreaturePart[] = ["body", "head", "tail", "armL", "armR", "legL", "legR", "wings", "earFar", "ears"];

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
    case "plating":
      // Armour panels: seams in a staggered brick of plates, rivets at the
      // corners, and a few neon status lights.
      for (let y = -8, row = 0; y < 200; y += 20, row++) {
        out.push(`<path d="M0 ${y}H200" stroke="#0a0e16" stroke-width="1.2" opacity=".45" fill="none"/>`);
        for (let x = row % 2 ? 14 : 0; x < 210; x += 28) {
          out.push(`<path d="M${x} ${y}V${y + 20}" stroke="#0a0e16" stroke-width="1.2" opacity=".45" fill="none"/>`);
          out.push(`<circle cx="${x + 3}" cy="${y + 3}" r=".9" fill="#ffffff" opacity=".7"/>`);
        }
      }
      for (let i = 0; i < 12; i++) {
        const x = 10 + r() * 180,
          y = -4 + r() * 186;
        out.push(r() < 0.5 ? `<rect x="${n(x)}" y="${n(y)}" width="7" height="2" rx="1" fill="${color}"/>` : `<circle cx="${n(x)}" cy="${n(y)}" r="1.6" fill="${color}"/>`);
      }
      break;
    case "runes":
      // Glowing runes etched into black steel: a stave with angled branches,
      // over faint plate seams.
      for (let y = 8; y < 200; y += 26)
        out.push(`<path d="M0 ${y}Q100 ${y + 8} 200 ${y}" stroke="#000000" stroke-width="1.4" opacity=".35" fill="none"/>`);
      for (let i = 0; i < 24; i++) {
        const x = 12 + r() * 176,
          y = -6 + r() * 190,
          h = 7 + r() * 5,
          s = r() < 0.5 ? -1 : 1;
        const branches = [
          `M${n(x)} ${n(y - h * 0.5)}l${n(s * 4)} ${n(h * 0.3)}`,
          `M${n(x)} ${n(y)}l${n(-s * 4)} ${n(-h * 0.35)}`,
          `M${n(x)} ${n(y + h * 0.1)}l${n(s * 4)} ${n(h * 0.35)}`,
        ]
          .filter(() => r() < 0.7)
          .join("");
        out.push(`<path d="M${n(x)} ${n(y - h * 0.5)}V${n(y + h * 0.5)}${branches}" stroke="${color}" stroke-width="1.7" stroke-linecap="round" fill="none"/>`);
      }
      break;
    case "circuit":
      // Circuit-board traces: right-angled runs ending in solder pads.
      for (let i = 0; i < 16; i++) {
        let x = Math.round((10 + r() * 180) / 6) * 6,
          y = Math.round((-5 + r() * 190) / 6) * 6;
        let d = `M${x} ${y}`;
        for (let k = 0; k < 3; k++) {
          const len = 6 + Math.round(r() * 3) * 6;
          if (k % 2 === 0) x += r() < 0.5 ? -len : len;
          else y += r() < 0.5 ? -len : len;
          d += `L${x} ${y}`;
        }
        out.push(`<path d="${d}" stroke="${color}" stroke-width="2.4" fill="none" stroke-linejoin="round"/><circle cx="${x}" cy="${y}" r="3" fill="${color}"/>`);
      }
      break;
    case "knit":
      // Cable knit: twisted cables between purl ribs.
      for (let x = 8; x < 200; x += 22) {
        out.push(`<path d="M${x - 8} -10V200M${x + 8} -10V200" stroke="${color}" stroke-width="1.4" opacity=".55" fill="none"/>`);
        for (let y = -10; y < 200; y += 12)
          out.push(`<path d="M${x - 5} ${y}Q${x} ${y + 6} ${x + 5} ${y + 12}M${x + 5} ${y}Q${x} ${y + 6} ${x - 5} ${y + 12}" stroke="${color}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`);
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
  if (a.startsWith("mecha-")) return mechaSvg(a as MechaPiece, id, dir, p);
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
    default:
      return newAccessorySvg(a, id, dir, p);
  }
}

/** Accessories made for the eight newest champions (same anchors and layers). */
function newAccessorySvg(a: Accessory, id: CharacterId, dir: Facing, p: Palette): [CreaturePart, string][] {
  const { cx, top } = HEAD[id][dir];
  const back = dir === "up",
    side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const ink = p.dark;
  const flame = (svg: string): [CreaturePart, string][] => [["flame", svg]];
  switch (a) {
    case "bobble-hat": {
      const w = side ? 25 : 29;
      const rib = Array.from({ length: 9 }, (_, i) => cx - w + 2 + (i * (2 * w - 4)) / 8)
        .map((x) => `M${n(x)} ${top + 8}v8`)
        .join("");
      // A white zigzag knitted round the crown.
      const zig = Array.from({ length: 9 }, (_, i) => `${i ? "L" : "M"}${n(cx - w + 5 + (i * (2 * w - 10)) / 8)} ${top - 2 - (i % 2) * 5}`).join("");
      return flame(
        `<path d="M${cx - w} ${top + 10}Q${cx - w} ${top - 18} ${cx} ${top - 19}Q${cx + w} ${top - 18} ${cx + w} ${top + 10}Z" fill="#c0262a" stroke="${ink}"/>` +
          `<path d="${zig}" stroke="#ffffff" stroke-width="2.2" fill="none" stroke-linejoin="round"/>` +
          `<path d="M${cx - w - 3} ${top + 7}Q${cx} ${top + 3} ${cx + w + 3} ${top + 7}L${cx + w + 3} ${top + 17}Q${cx} ${top + 13} ${cx - w - 3} ${top + 17}Z" fill="#fff4f0" stroke="${ink}"/>` +
          `<path d="${rib}" stroke="#e6c8c8" stroke-width="1.4"/>` +
          `<circle cx="${cx - side * 3}" cy="${top - 20}" r="7.5" fill="#ffffff" stroke="${ink}"/>`,
      );
    }
    case "acorn-cap": {
      const w = side ? 26 : 30;
      const scales = [-2, 4, 10]
        .map((dy, row) =>
          Array.from({ length: 6 - row }, (_, i) => {
            const x = cx - w + 8 + row * 4 + i * ((2 * w - 16 - row * 8) / Math.max(1, 5 - row));
            return `M${n(x - 4)} ${top + dy}q4 4 8 0`;
          }).join(""),
        )
        .join("");
      return flame(
        `<path d="M${cx - w} ${top + 12}Q${cx - w + 2} ${top - 14} ${cx} ${top - 16}Q${cx + w - 2} ${top - 14} ${cx + w} ${top + 12}Q${cx} ${top + 6} ${cx - w} ${top + 12}Z" fill="#8a5a2a" stroke="${ink}"/>` +
          `<path d="${scales}" stroke="#5e3a18" stroke-width="1.4" fill="none"/>` +
          `<path d="M${cx - side * 2} ${top - 15}q1 -8 ${side ? -side * 7 : 7} -11" stroke="#5a3a1a" stroke-width="3.4" fill="none" stroke-linecap="round"/>`,
      );
    }
    case "paper-hat": {
      const w = side ? 24 : 32;
      const lines = [0, 1, 2].map((i) => `M${cx - 10 + i * 2} ${top - 2 + i * 4}h${16 - i * 4}`).join("");
      return flame(
        `<path d="M${cx - w} ${top + 10}L${cx} ${top - 26}L${cx + w} ${top + 10}Z" fill="#fffaf0" stroke="${ink}" stroke-linejoin="round"/>` +
          `<path d="M${cx} ${top - 26}L${cx - 5} ${top + 6}" stroke="#d8ccb4" stroke-width="1.4"/>` +
          (back ? "" : `<path d="${lines}" stroke="#a89c86" stroke-width="1.3"/>`) +
          `<path d="M${cx - w - 4} ${top + 4}H${cx + w + 4}V${top + 13}H${cx - w - 4}Z" fill="#f2e6d0" stroke="${ink}" stroke-linejoin="round"/>` +
          `<path d="M${cx - w} ${top + 8.5}H${cx + w}" stroke="#e0572b" stroke-width="2"/>`,
      );
    }
    case "lotus": {
      const x = side ? cx - side * 4 : cx - 20,
        y = top + 8;
      const petal = (deg: number, len: number, fill: string) =>
        `<path d="M${x} ${y}Q${x - 6} ${y - len * 0.5} ${x} ${y - len}Q${x + 6} ${y - len * 0.5} ${x} ${y}Z" fill="${fill}" stroke="${ink}" stroke-width="1.2" transform="rotate(${deg} ${x} ${y})"/>`;
      return flame(
        `<g transform="translate(${x} ${y}) scale(1.55) translate(${-x} ${-y})">` +
          `<ellipse cx="${x}" cy="${y + 2}" rx="15" ry="4" fill="#5fae5a" stroke="${ink}" stroke-width="1"/>` +
          [-70, 70, -45, 45].map((d) => petal(d, 15, "#ff9cc4")).join("") +
          [-20, 20, 0].map((d) => petal(d, 18, "#ffd0e2")).join("") +
          `<circle cx="${x}" cy="${y - 3}" r="3" fill="#ffd65b" stroke="none"/></g>`,
      );
    }
    case "feather-cap": {
      const f = side ? -side : -1;
      const brim = side
        ? `M${cx - 30} ${top + 12}Q${cx - 18} ${top - 14} ${cx + side * 4} ${top - 16}Q${cx + 22} ${top - 12} ${cx + 32} ${top + 10}Q${cx} ${top + 4} ${cx - 30} ${top + 12}Z`
        : `M${cx - 33} ${top + 12}Q${cx - 22} ${top - 12} ${cx + 4} ${top - 15}Q${cx + 28} ${top - 12} ${cx + 38} ${top + 6}Q${cx} ${top + 2} ${cx - 33} ${top + 12}Z`;
      return flame(
        `<path d="M${cx + f * 6} ${top - 6}Q${cx + f * 26} ${top - 34} ${cx + f * 48} ${top - 34}Q${cx + f * 28} ${top - 20} ${cx + f * 10} ${top - 2}Z" fill="#e0262f" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>` +
          `<path d="M${cx + f * 8} ${top - 4}Q${cx + f * 26} ${top - 26} ${cx + f * 46} ${top - 33}" stroke="#ffd2c8" stroke-width="1.2" fill="none"/>` +
          `<path d="${brim}" fill="#3f7f3a" stroke="${ink}" stroke-linejoin="round"/>` +
          `<path d="M${cx - 28} ${top + 8}Q${cx} ${top + 1} ${cx + 30} ${top + 5}" stroke="#c8823a" stroke-width="3" fill="none"/>`,
      );
    }
    case "towel": {
      const w = side ? 16 : 20;
      return flame(
        `<g transform="rotate(${side ? side * 4 : -7} ${cx} ${top})">` +
          `<path d="M${cx - w} ${top + 4}Q${cx - w - 2} ${top - 8} ${cx - w + 4} ${top - 12}H${cx + w - 4}Q${cx + w + 2} ${top - 8} ${cx + w} ${top + 4}Q${cx} ${top + 8} ${cx - w} ${top + 4}Z" fill="#ffffff" stroke="${ink}" stroke-linejoin="round"/>` +
          `<path d="M${cx - w + 4} ${top - 8}H${cx + w - 4}M${cx - w + 2} ${top - 4}H${cx + w - 2}" stroke="#ff8fa8" stroke-width="2"/>` +
          `<path d="M${cx - w + 2} ${top + 1}Q${cx} ${top + 4} ${cx + w - 2} ${top + 1}" stroke="#e0e6ee" stroke-width="1.4" fill="none"/>` +
          `</g>`,
      );
    }
    case "sunflower": {
      const x = side ? cx - side * 14 : back ? cx - 26 : cx + 26,
        y = top + 12;
      const petals = Array.from({ length: 14 }, (_, i) => {
        const deg = (i * 360) / 14;
        return `<ellipse cx="${x}" cy="${y - 14}" rx="4.4" ry="8.6" fill="#ffd84a" stroke="#b07a10" stroke-width="1" transform="rotate(${n(deg)} ${x} ${y})"/>`;
      }).join("");
      return flame(
        `<path d="M${x - 6} ${y + 10}q-14 2 -19 -8q12 -4 19 8z" fill="#5fae3a" stroke="${ink}" stroke-width="1.2"/>` +
          petals +
          `<circle cx="${x}" cy="${y}" r="8.6" fill="#6a3a12" stroke="${ink}" stroke-width="1.2"/>` +
          [[-2, -2], [2, -1], [0, 2], [-3, 2], [3, 3]].map(([dx, dy]) => `<circle cx="${x + dx}" cy="${y + dy}" r="0.9" fill="#ffd84a" stroke="none"/>`).join(""),
      );
    }
    case "headband": {
      const y = top + 20;
      if (back)
        return flame(
          `<path d="M${cx - 33} ${y}Q${cx} ${y + 6} ${cx + 33} ${y}L${cx + 33} ${y + 7}Q${cx} ${y + 13} ${cx - 33} ${y + 7}Z" fill="#ffffff" stroke="${ink}"/>` +
            `<path d="M${cx - 2} ${y + 6}q-10 10 -6 22l5 -2q-2 -10 5 -18zM${cx + 2} ${y + 6}q10 10 6 22l-5 -2q2 -10 -5 -18z" fill="#ffffff" stroke="${ink}" stroke-width="1.2"/>` +
            `<circle cx="${cx}" cy="${y + 5}" r="4.5" fill="#e0262f" stroke="${ink}" stroke-width="1.2"/>`,
        );
      const knot = cx + (side ? -side * 26 : 31),
        out = side ? -side : 1;
      const twist = Array.from({ length: 8 }, (_, i) => `M${cx - 28 + i * 8} ${y + 1}l4 6`).join("");
      return flame(
        `<path d="M${cx - 33} ${y}Q${cx} ${y - 6} ${cx + 33} ${y}L${cx + 33} ${y + 8}Q${cx} ${y + 2} ${cx - 33} ${y + 8}Z" fill="#ffffff" stroke="${ink}"/>` +
          `<path d="${twist}" stroke="#e0262f" stroke-width="2" stroke-linecap="round"/>` +
          `<path d="M${knot} ${y + 4}q${out * 12} -2 ${out * 16} -12l${out * 3} 4q${-out * 2} 10 ${-out * 15} 10zM${knot} ${y + 5}q${out * 12} 4 ${out * 13} 16l${out * 4} -2q${-out * 1} -12 ${-out * 15} -15z" fill="#ffffff" stroke="${ink}" stroke-width="1.2"/>` +
          `<circle cx="${knot}" cy="${y + 4}" r="4.5" fill="#e0262f" stroke="${ink}" stroke-width="1.2"/>`,
      );
    }
    case "flower-crown": {
      const w = side ? 22 : 30;
      const flowers = Array.from({ length: 7 }, (_, i) => {
        const t = i / 6,
          x = cx - w + t * 2 * w,
          y = top + 10 - Math.sin(t * Math.PI) * 6;
        const fill = ["#ff8fb8", "#ffffff", "#ffd65b"][i % 3];
        const petals = [0, 72, 144, 216, 288]
          .map((d) => `<circle cx="${n(x + Math.cos((d * Math.PI) / 180) * 3.2)}" cy="${n(y + Math.sin((d * Math.PI) / 180) * 3.2)}" r="2.6" fill="${fill}" stroke="${ink}" stroke-width=".8"/>`)
          .join("");
        return petals + `<circle cx="${n(x)}" cy="${n(y)}" r="1.6" fill="#ffb02e" stroke="none"/>`;
      }).join("");
      return flame(
        `<path d="M${cx - w - 2} ${top + 11}Q${cx} ${top - 1} ${cx + w + 2} ${top + 11}" stroke="#3f9a3f" stroke-width="3" fill="none" stroke-linecap="round"/>` +
          flowers,
      );
    }
    case "antenna": {
      const w = side ? 0 : 32;
      const pod = (x: number) => `<circle cx="${x}" cy="${top + 16}" r="6" fill="#c8d0e6" stroke="${ink}" stroke-width="1.4"/><circle cx="${x}" cy="${top + 16}" r="2.4" fill="${p.glow}" stroke="none"/>`;
      const ax = side ? cx - side * 2 : cx + w;
      return flame(
        (side ? "" : `<path d="M${cx - w} ${top + 14}Q${cx} ${top - 14} ${cx + w} ${top + 14}" stroke="#c8d0e6" stroke-width="4" fill="none"/><path d="M${cx - w} ${top + 14}Q${cx} ${top - 14} ${cx + w} ${top + 14}" stroke="${ink}" stroke-width="1" fill="none" opacity=".5"/>`) +
          `<path d="M${ax} ${top + 12}Q${ax + 4} ${top - 6} ${ax + 10} ${top - 20}" stroke="#c8d0e6" stroke-width="2.4" fill="none" stroke-linecap="round"/>` +
          `<circle cx="${ax + 10}" cy="${top - 22}" r="6" fill="${p.glow}" opacity=".35" stroke="none"/><circle cx="${ax + 10}" cy="${top - 22}" r="3.4" fill="${p.glow}" stroke="${ink}" stroke-width="1"/>` +
          (side ? pod(ax) : pod(cx - w) + pod(cx + w)),
      );
    }
    case "mushroom": {
      const w = side ? 30 : 36;
      const spots = [[-16, -6, 4], [2, -14, 5], [18, -4, 4.5], [-4, 0, 3], [-26, 4, 2.6], [28, 5, 2.6]]
        .filter(([dx]) => Math.abs(dx) < w - 4)
        .map(([dx, dy, r]) => `<circle cx="${cx + dx + side * 3}" cy="${top + dy}" r="${r}" fill="#ffffff" stroke="none"/>`)
        .join("");
      return flame(
        `<path d="M${cx - w + 4} ${top + 12}Q${cx} ${top + 18} ${cx + w - 4} ${top + 12}" fill="#f6e6d0" stroke="${ink}"/>` +
          `<path d="M${cx - w} ${top + 12}Q${cx - w + 2} ${top - 20} ${cx} ${top - 22}Q${cx + w - 2} ${top - 20} ${cx + w} ${top + 12}Q${cx} ${top + 4} ${cx - w} ${top + 12}Z" fill="#e0262f" stroke="${ink}"/>` +
          spots,
      );
    }
    case "hardhat": {
      const w = side ? 30 : 34;
      return flame(
        `<path d="M${cx - w} ${top + 12}Q${cx - w + 2} ${top - 16} ${cx} ${top - 18}Q${cx + w - 2} ${top - 16} ${cx + w} ${top + 12}Z" fill="#ffc93d" stroke="${ink}"/>` +
          `<path d="M${cx + side * 6} ${top - 17}Q${cx + side * 8} ${top - 2} ${cx + side * 7} ${top + 11}" stroke="#e0a020" stroke-width="5" fill="none"/>` +
          `<path d="M${cx - w - 6} ${top + 11}Q${cx} ${top + 6} ${cx + w + 6} ${top + 11}L${cx + w + 6} ${top + 16}Q${cx} ${top + 11} ${cx - w - 6} ${top + 16}Z" fill="#ffd65b" stroke="${ink}"/>` +
          (back
            ? ""
            : `<circle cx="${cx + side * 22}" cy="${top + 1}" r="7" fill="#fff3b0" opacity=".45" stroke="none"/><circle cx="${cx + side * 22}" cy="${top + 1}" r="5" fill="#fffbe6" stroke="#6a6a74" stroke-width="2"/>`),
      );
    }
    case "mask": {
      // A jewelled masquerade mask over the ink mask, tied with a ribbon.
      const y = top + 52;
      if (back)
        return flame(
          `<path d="M${cx - 4} ${y}q-12 -8 -16 2q8 6 16 -2zM${cx + 4} ${y}q12 -8 16 2q-8 6 -16 -2z" fill="#ffd65b" stroke="${ink}" stroke-width="1.2"/><path d="M${cx - 3} ${y + 2}l-6 16M${cx + 3} ${y + 2}l6 16" stroke="#ffd65b" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${y}" r="3.4" fill="#ff6fa8" stroke="${ink}" stroke-width="1"/>`,
        );
      const lens = (x: number) => `<ellipse cx="${x}" cy="${y}" rx="11" ry="8"/>`;
      const holes = side ? lens(cx + side * 8) : lens(cx - 18) + lens(cx + 18);
      const shape = side
        ? `M${cx - side * 10} ${y - 4}Q${cx + side * 8} ${y - 18} ${cx + side * 26} ${y - 8}Q${cx + side * 28} ${y + 8} ${cx + side * 10} ${y + 12}Q${cx - side * 4} ${y + 10} ${cx - side * 10} ${y - 4}Z`
        : `M${cx} ${y - 6}Q${cx - 18} ${y - 18} ${cx - 38} ${y - 10}Q${cx - 44} ${y + 8} ${cx - 22} ${y + 13}Q${cx - 8} ${y + 12} ${cx} ${y + 4}Q${cx + 8} ${y + 12} ${cx + 22} ${y + 13}Q${cx + 44} ${y + 8} ${cx + 38} ${y - 10}Q${cx + 18} ${y - 18} ${cx} ${y - 6}Z`;
      const m = `${id}-${dir}-mask`;
      return flame(
        `<mask id="${m}" maskUnits="userSpaceOnUse" x="0" y="-20" width="200" height="200"><rect x="0" y="-20" width="200" height="200" fill="#fff"/><g fill="#000">${holes}</g></mask>` +
          `<path d="${shape}" fill="#ffd65b" stroke="${ink}" stroke-width="1.6" mask="url(#${m})"/>` +
          `<g fill="none" stroke="#b8862a" stroke-width="1.2">${holes}</g>` +
          (side
            ? `<circle cx="${cx + side * 22}" cy="${y - 10}" r="3" fill="#ff6fa8" stroke="${ink}" stroke-width="1"/>`
            : `<circle cx="${cx}" cy="${y - 2}" r="3.4" fill="#ff6fa8" stroke="${ink}" stroke-width="1"/><path d="M${cx - 38} ${y - 10}q-6 -10 -2 -18q4 6 6 16zM${cx + 38} ${y - 10}q6 -10 2 -18q-4 6 -6 16z" fill="#8a5cff" stroke="${ink}" stroke-width="1"/>`),
      );
    }
    case "starfish": {
      const x = side ? cx - side * 20 : back ? cx - 28 : cx + 30,
        y = top + 20;
      const pts = Array.from({ length: 10 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 5,
          r = i % 2 ? 5.2 : 13;
        return `${n(x + Math.cos(a) * r)},${n(y + Math.sin(a) * r)}`;
      }).join(" ");
      return flame(
        `<polygon points="${pts}" fill="#ff8a4f" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round" transform="rotate(14 ${x} ${y})"/>` +
          [0, 1, 2, 3, 4].map((i) => {
            const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5 + 0.24;
            return `<circle cx="${n(x + Math.cos(a) * 6.5)}" cy="${n(y + Math.sin(a) * 6.5)}" r="1.3" fill="#ffe0c0" stroke="none"/>`;
          }).join(""),
      );
    }
    case "lure": {
      const f = side || 1;
      const bx = cx + f * 20,
        by = top - 12;
      return flame(
        `<path d="M${cx} ${top + 8}Q${cx - f * 2} ${top - 18} ${bx} ${by}" stroke="${p.dark}" stroke-width="5" fill="none" stroke-linecap="round"/>` +
          `<path d="M${cx} ${top + 8}Q${cx - f * 2} ${top - 18} ${bx} ${by}" stroke="${p.mid}" stroke-width="2.6" fill="none" stroke-linecap="round"/>` +
          `<circle cx="${bx}" cy="${by}" r="10" fill="${p.glow}" opacity=".3" stroke="none"/>` +
          `<circle cx="${bx}" cy="${by}" r="6" fill="${p.glow}" stroke="${ink}" stroke-width="1.2"/><circle cx="${bx - 2}" cy="${by - 2}" r="2" fill="#ffffff" stroke="none"/>`,
      );
    }
  }
  return [];
}

/** The look a skin gives a champion at an Awakening stage. */
export function skinArt(skinId: string | null | undefined) {
  return skinId ? SKIN_ART[skinId] : undefined;
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

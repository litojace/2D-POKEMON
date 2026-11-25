import type { CharacterId } from "@arena/shared";
import type { Palette, SkinArt } from "./skin-art";

/**
 * Birthstone (Common): a gemstone's colours for every champion. A Common
 * is a palette and nothing else (tests/unit/skin-art.test.ts). `dark` and
 * `accent` stay deep: champions draw outlines, masks and markings with them.
 */
const GEMS: Record<CharacterId, Palette> = {
  // Amethyst: violet crystal, a pink light inside.
  voltkit: { light: "#f1e4ff", mid: "#a05ad8", dark: "#3a1a66", glow: "#ffd0ff", accent: "#6a2fb0" },
  // Sapphire: royal blue, an ice-blue flame.
  cindrake: { light: "#dfeaff", mid: "#2f5fd0", dark: "#0f1f5a", glow: "#7fd0ff", accent: "#1a3a8a" },
  // Citrine: clear golden yellow.
  tidefin: { light: "#fff8d0", mid: "#f2c230", dark: "#6a4a0a", glow: "#fff08a", accent: "#c8860a" },
  // Emerald: deep green, a bright green light.
  auralynx: { light: "#dcffe8", mid: "#1fae6a", dark: "#0a4a2e", glow: "#8fffc0", accent: "#0f7a4a" },
  // Ruby: blood red, a rose light.
  lumoth: { light: "#ffe0e4", mid: "#d81f3f", dark: "#5a0a1a", glow: "#ff8a9a", accent: "#8a0f26" },
  // Topaz: golden orange.
  mystowl: { light: "#fff0d8", mid: "#f29a2e", dark: "#6a3a0a", glow: "#ffd27a", accent: "#b8620f" },
  // Turquoise: sea-green stone veined with gold.
  terradon: { light: "#dffff8", mid: "#2fc8b8", dark: "#0f5a52", glow: "#9ffff0", accent: "#b8862a" },
  // Garnet: dark wine red.
  duskveil: { light: "#f2c8d0", mid: "#9a1f3f", dark: "#3a0a18", glow: "#ff6a8a", accent: "#5a0f24" },
  // Peridot: yellow-green.
  coilemur: { light: "#f4ffd0", mid: "#a8d82f", dark: "#3f5a0a", glow: "#e0ff7a", accent: "#6a8a0f" },
  // Aquamarine: pale sea blue.
  pyranda: { light: "#e6fbff", mid: "#5fd0e0", dark: "#1a5a6a", glow: "#b8f6ff", accent: "#2a8a9a" },
  // Opal: milky peach with a play of green and violet.
  glacelle: { light: "#fffaf0", mid: "#ffd9c2", dark: "#8a5a6a", glow: "#b8fff0", accent: "#c9a3ff" },
  // Tourmaline: hot pink.
  halcyra: { light: "#ffe0f0", mid: "#e0409a", dark: "#5a0f3a", glow: "#ff9ad0", accent: "#8a1f5a" },
  // Lapis: deep blue flecked with gold.
  sunbara: { light: "#dfe6ff", mid: "#2f4fb8", dark: "#0f1a5a", glow: "#ffd65b", accent: "#1a2f7a" },
  // Moonstone: white with a blue sheen.
  astrabun: { light: "#ffffff", mid: "#cfe6ff", dark: "#3a5a8a", glow: "#e6f6ff", accent: "#7fa8e0" },
  // Malachite: banded green.
  wombolder: { light: "#c8ffe0", mid: "#1f9a6a", dark: "#0a3a2a", glow: "#7fffc0", accent: "#0f5a3f" },
  // Onyx: polished black, a magenta light.
  shadopus: { light: "#c8c8d8", mid: "#3a3a4a", dark: "#0f0f18", glow: "#ff4fd8", accent: "#1f1f2a" },
  // Tanzanite: violet blue.
  pangrove: { light: "#ece6ff", mid: "#6a5ad8", dark: "#1f1a5a", glow: "#c8b8ff", accent: "#3a2f9a" },
  // Carnelian: red-orange.
  mossloth: { light: "#ffe6d8", mid: "#e0522f", dark: "#5a1a0a", glow: "#ffb08a", accent: "#8a2a12" },
};

export const BIRTHSTONE_ART: Record<string, SkinArt> = Object.fromEntries(
  (Object.keys(GEMS) as CharacterId[]).map((id) => [`${id}-birthstone`, { palette: GEMS[id] } satisfies SkinArt]),
);

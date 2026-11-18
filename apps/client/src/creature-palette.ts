import type { CharacterId } from "@arena/shared";

/** Each champion's own colors (no imports from the drawing code, so skin
 * data can derive palettes from them without an import cycle). */
export type Palette = {
  light: string;
  mid: string;
  dark: string;
  glow: string;
  /** Secondary colour for markings and accessories. */
  accent: string;
};
export const creaturePalette: Record<CharacterId, Palette> = {
  voltkit: {
    light: "#fff6cf",
    mid: "#ffd65b",
    dark: "#6a4a1f",
    glow: "#7ff3ff",
    accent: "#2fb7d6",
  },
  cindrake: {
    light: "#ffd7a8",
    mid: "#ff7a4f",
    dark: "#5e2316",
    glow: "#ffd34d",
    accent: "#3b1a14",
  },
  tidefin: {
    light: "#dcfbff",
    mid: "#4fd6e6",
    dark: "#113f57",
    glow: "#ff8fb8",
    accent: "#1d2c5c",
  },
  auralynx: {
    light: "#e6ebff",
    mid: "#7f9cff",
    dark: "#202a58",
    glow: "#c9f4ff",
    accent: "#1a1f3d",
  },
  lumoth: {
    light: "#f4fff9",
    mid: "#86f0c0",
    dark: "#1d5a49",
    glow: "#fff1a0",
    accent: "#ffffff",
  },
  mystowl: {
    light: "#ffe6f7",
    mid: "#ff79d2",
    dark: "#581d5c",
    glow: "#9ff7ff",
    accent: "#ffd6f0",
  },
  terradon: {
    light: "#f1dcb5",
    mid: "#c79a5b",
    dark: "#46301c",
    glow: "#8fd36a",
    accent: "#7e6a55",
  },
  duskveil: {
    light: "#e6dbff",
    mid: "#9c6bff",
    dark: "#1e1340",
    glow: "#7dffe1",
    accent: "#120b26",
  },
  coilemur: {
    light: "#f7f3ea",
    mid: "#a9a6bd",
    dark: "#2c2840",
    glow: "#ffd84a",
    accent: "#d9823b",
  },
  pyranda: {
    light: "#ffe0c4",
    mid: "#d9572b",
    dark: "#4a1a12",
    glow: "#ffcf4d",
    accent: "#fbf3e6",
  },
  glacelle: {
    light: "#f4feff",
    mid: "#9fe8ff",
    dark: "#1d4f7a",
    glow: "#ff9a6b",
    accent: "#d9f6ff",
  },
  halcyra: {
    light: "#e8eeff",
    mid: "#6f8dff",
    dark: "#1c2456",
    glow: "#c9f4ff",
    accent: "#ff9a4a",
  },
  sunbara: {
    light: "#fff1d6",
    mid: "#c98f52",
    dark: "#4a2e18",
    glow: "#ffe066",
    accent: "#ffb732",
  },
  astrabun: {
    light: "#ffffff",
    mid: "#e3c8ff",
    dark: "#4b2a6b",
    glow: "#ffe9a3",
    accent: "#8a5cff",
  },
  wombolder: {
    light: "#efdcc0",
    mid: "#b08a62",
    dark: "#3e2a1a",
    glow: "#9bd36a",
    accent: "#8b8f99",
  },
  shadopus: {
    light: "#e9e0ff",
    mid: "#7b5cff",
    dark: "#1a1240",
    glow: "#ff6bd6",
    accent: "#120b26",
  },
  pangrove: {
    light: "#eef9cf",
    mid: "#7fcf6a",
    dark: "#1f4626",
    glow: "#ffd166",
    accent: "#3f8f4a",
  },
  mossloth: {
    light: "#f4efd9",
    mid: "#b8ad88",
    dark: "#3d3726",
    glow: "#9bd36a",
    accent: "#ff9fc4",
  },
};

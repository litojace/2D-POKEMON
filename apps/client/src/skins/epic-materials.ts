import type { CharacterId } from "@arena/shared";

/** One cheerful costume hue with a shaded panel, not a competing third hue. */
export const CARNIVAL_TEXTILES = {
  voltkit: ["#d85b98", "#963969"],
  cindrake: ["#d95970", "#953d51"],
  tidefin: ["#c3679b", "#88436e"],
  auralynx: ["#497bcc", "#34558d"],
  lumoth: ["#9761cc", "#69428f"],
  mystowl: ["#d65d83", "#953d60"],
  terradon: ["#ee9b42", "#ab692e"],
  duskveil: ["#df718c", "#9a4b67"],
  coilemur: ["#538fcd", "#39618f"],
  pyranda: ["#bf6bb3", "#84497e"],
  glacelle: ["#bd6889", "#83465f"],
  halcyra: ["#b265af", "#7b467e"],
  sunbara: ["#eb9970", "#ac6551"],
  astrabun: ["#dc779f", "#984f76"],
  wombolder: ["#8c72c9", "#624e8e"],
  shadopus: ["#df9951", "#9b6839"],
  pangrove: ["#d16587", "#91445f"],
  mossloth: ["#a263c3", "#704489"],
} as const satisfies Record<CharacterId, readonly [string, string]>;

/** Bright new body colors pair with a single costume hue. Small details
 * share warm gold across the collection instead of extra rainbow accents. */
export const CARNIVAL_CREATURES = {
  voltkit: ["#a58be8", "#ffe19a"],
  cindrake: ["#59c5b3", "#ffe19a"],
  tidefin: ["#f0a18b", "#ffe19a"],
  auralynx: ["#f2c76f", "#ffe19a"],
  lumoth: ["#e59bcf", "#ffe19a"],
  mystowl: ["#69c6cb", "#ffe19a"],
  terradon: ["#9daee8", "#ffe19a"],
  duskveil: ["#5bbab4", "#ffe19a"],
  coilemur: ["#e6b19e", "#ffe19a"],
  pyranda: ["#c3a3e9", "#ffe19a"],
  glacelle: ["#f0b0b5", "#ffe19a"],
  halcyra: ["#e59bc6", "#ffe19a"],
  sunbara: ["#8dd8bd", "#ffe19a"],
  astrabun: ["#87cbea", "#ffe19a"],
  wombolder: ["#b6a5e4", "#ffe19a"],
  shadopus: ["#f0c087", "#ffe19a"],
  pangrove: ["#eba4b2", "#ffe19a"],
  mossloth: ["#c9a3e7", "#ffe19a"],
} as const satisfies Record<CharacterId, readonly [string, string]>;

/** Single-source replacement policy: remove old props before drawing a new
 * equipment set. Organic ears, beaks and plants remain their own anatomy. */
export const EPIC_REPLACED_PROPS: readonly CharacterId[] = [
  "voltkit",
  "cindrake",
  "tidefin",
  "auralynx",
  "mystowl",
  "coilemur",
  "sunbara",
  "astrabun",
  "wombolder",
  "mossloth",
];

/**
 * Halcyra's beak, coloured for each collection. The beak is the champion's
 * own (data-keep in creature-design.ts and creature-profile.ts): same
 * shape, size and place in every skin, since it is its mouth. Only its
 * crystal's colours change, chosen to sit with the skin's body colour and
 * costume.
 */
type View = "front" | "profile";
interface BeakLook {
  /** The crystal's light, middle and dark (the shade at the base). */
  colors: [string, string, string];
}

export const HALCYRA_BEAKS: Record<string, BeakLook> = {
  // Chim Lạc, terracotta body: bright Đông Sơn gold-bronze.
  "halcyra-hon-viet": { colors: ["#fff0c0", "#eaa83a", "#7a4a10"] },
  // Barnstormer, rose body under a leather cap: aviator navy steel.
  "halcyra-stars-stripes": { colors: ["#ffffff", "#9fb2d8", "#2c3e6e"] },
  // Falcon Herald, falcon-sky body under gold wings: polished lapis.
  "halcyra-sun-dynasty": { colors: ["#e6f0ff", "#5a8ae0", "#1f3a7a"] },
  // Skysight, tan body in a navy suit: hero gold.
  "halcyra-hero-squad": { colors: ["#fff8d0", "#f6cf3a", "#8a6a10"] },
  // Archery Ace, green body: warm wood orange.
  "halcyra-neon-campus": { colors: ["#fff1d2", "#ec8f3a", "#7a3a12"] },
  // Plume Showstar, peacock-teal body under pink plumes: show gold.
  "halcyra-starlight-idol": { colors: ["#fffbe0", "#ffc94a", "#9a5a12"] },
  // Crow's Nest Ace, indigo body, leather and brass: bone ivory.
  "halcyra-sky-pirates": { colors: ["#ffffff", "#e6d8b8", "#7a6a4a"] },
  // Gale Captain, sky-blue body: icy crystal.
  "halcyra-nova-vanguard": { colors: ["#ffffff", "#bfe8ff", "#3a7ab8"] },
};

/** Recolour the beak's crystal in an SVG layer for a skin. */
export function styleHalcyraBeak(svg: string, skin: string, view: View | null) {
  const look = HALCYRA_BEAKS[skin];
  if (!look || !view) return svg;
  const [light, mid, dark] = look.colors;
  return svg.replace(
    /(<linearGradient id="[^"]*-beak"[^>]*>)[\s\S]*?(<\/linearGradient>)/,
    `$1<stop stop-color="${light}"/><stop offset=".3" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>$2`,
  );
}

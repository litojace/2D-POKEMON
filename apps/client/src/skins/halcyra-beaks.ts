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
  // Chim Lạc, terracotta body: Đông Sơn bronze.
  "halcyra-hon-viet": { colors: ["#ffe2b8", "#b8762e", "#4a2a10"] },
  // Barnstormer, rose body under a leather cap: aviator navy steel.
  "halcyra-stars-stripes": { colors: ["#ffffff", "#9fb2d8", "#2c3e6e"] },
  // Skysight, tan body in a navy suit: hero gold.
  "halcyra-hero-squad": { colors: ["#fff8d0", "#f6cf3a", "#8a6a10"] },
  // Archery Ace, green body: warm wood orange.
  "halcyra-neon-campus": { colors: ["#fff1d2", "#ec8f3a", "#7a3a12"] },
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

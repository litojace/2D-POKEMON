/**
 * Halcyra's beak, made for each collection's figure. The beak is the
 * champion's own (data-keep in creature-design.ts and creature-profile.ts),
 * so these only recolour its crystal and add a detail or two, drawn in the
 * beak's own coordinates (front: base 92–108 at y 100, tip (100, 136);
 * profile, facing left: base x 66 from y 89 to 105, tip (34, 101)) inside
 * its group, so they follow its scale and mirroring in every view.
 */
type View = "front" | "profile";
interface BeakLook {
  /** The crystal's light, middle and dark (the shade at the base). */
  colors: [string, string, string];
  detail?: (view: View) => string;
}

const poly = (pts: number[][], fill: string, extra = "") =>
  `<path d="M${pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L")}Z" fill="${fill}" stroke="none"${extra}/>`;
/** Half the beak's width at height y (front view). */
const half = (y: number) => (8 * (136 - y)) / 36;
/** A band across the beak from y to y + h (front view). */
const bandFront = (y: number, h: number, fill: string) =>
  poly(
    [
      [100 - half(y), y],
      [100 + half(y), y],
      [100 + half(y + h), y + h],
      [100 - half(y + h), y + h],
    ],
    fill,
  );
/** The beak's top and bottom at x (profile view). */
const edges = (x: number) => {
  const u = (66 - x) / 32;
  return [89 + 12 * u, 105 - 4 * u];
};
/** A band across the beak from x to x - w (profile view). */
const bandSide = (x: number, w: number, fill: string) => {
  const [t0, b0] = edges(x),
    [t1, b1] = edges(x - w);
  return poly(
    [
      [x, t0],
      [x - w, t1],
      [x - w, b1],
      [x, b0],
    ],
    fill,
  );
};
/** The beak's tip, from y (front) or x (profile) to the point. */
const tipFront = (y: number, fill: string) =>
  poly(
    [
      [100 - half(y), y],
      [100 + half(y), y],
      [100, 136],
    ],
    fill,
  );
const tipSide = (x: number, fill: string) => {
  const [t, b] = edges(x);
  return poly(
    [
      [x, t],
      [34, 101],
      [x, b],
    ],
    fill,
  );
};

export const HALCYRA_BEAKS: Record<string, BeakLook> = {
  // Chim Lạc, Đông Sơn: a bronze beak with engraved rings and dots.
  "halcyra-hon-viet": {
    colors: ["#ffe7a8", "#c98a2c", "#6a4a1a"],
    detail: (v) =>
      v === "front"
        ? bandFront(106, 2.2, "#6a4a1a") +
          bandFront(113, 2.2, "#6a4a1a") +
          [109.5, 117.5, 124]
            .map((y) => `<circle cx="100" cy="${y}" r="0.9" fill="#ffe7a8"/>`)
            .join("")
        : bandSide(58, 2.4, "#6a4a1a") +
          bandSide(50, 2.4, "#6a4a1a") +
          [54, 46, 40]
            .map(
              (x) =>
                `<circle cx="${x}" cy="${(edges(x)[0] + edges(x)[1]) / 2}" r="0.9" fill="#ffe7a8"/>`,
            )
            .join(""),
  },
  // Barnstormer: a polished silver beak with a red-white-red racing band.
  "halcyra-stars-stripes": {
    colors: ["#ffffff", "#b9c3cf", "#4a5568"],
    detail: (v) =>
      v === "front"
        ? bandFront(104, 2.4, "#c8323a") +
          bandFront(106.4, 2.4, "#ffffff") +
          bandFront(108.8, 2.4, "#c8323a")
        : bandSide(60, 2.6, "#c8323a") +
          bandSide(57.4, 2.6, "#ffffff") +
          bandSide(54.8, 2.6, "#c8323a"),
  },
  // Skysight: a gold beak with a navy stripe down it, like a hero's mask.
  "halcyra-hero-squad": {
    colors: ["#fff6c8", "#e2a82a", "#7a5410"],
    detail: (v) =>
      v === "front"
        ? poly(
            [
              [98.4, 101],
              [101.6, 101],
              [100.8, 126],
              [99.2, 126],
            ],
            "#1f2f5c",
          )
        : poly(
            [
              [64, 96],
              [40, 100],
              [40, 101.6],
              [64, 99],
            ],
            "#1f2f5c",
          ),
  },
  // Archery Ace: a wooden beak with a steel arrowhead tip.
  "halcyra-neon-campus": {
    colors: ["#fff3d6", "#c58a4a", "#5a3a1a"],
    detail: (v) =>
      v === "front"
        ? tipFront(124, "#cfd6de") + bandFront(122.4, 1.6, "#5a3a1a")
        : tipSide(46, "#cfd6de") + bandSide(47.6, 1.6, "#5a3a1a"),
  },
  // Crow's Nest Ace: a black crow's beak with a gold ring.
  "halcyra-sky-pirates": {
    colors: ["#9aa4b8", "#2a2e3a", "#0f1116"],
    detail: (v) =>
      v === "front"
        ? bandFront(110, 3, "#f2c14e") + bandFront(110.8, 1, "#a8823a")
        : bandSide(52, 3.2, "#f2c14e") + bandSide(51.2, 1, "#a8823a"),
  },
  // Gale Captain: an energy-blue crystal with seams of light.
  "halcyra-nova-vanguard": {
    colors: ["#ffffff", "#3fd8ff", "#1a6a9a"],
    detail: (v) =>
      v === "front"
        ? `<path d="M95 102L100 130M105 102L100 130" fill="none" stroke="#e8fbff" stroke-width="0.9" opacity=".9"/>`
        : `<path d="M62 94L38 101M62 101L38 101" fill="none" stroke="#e8fbff" stroke-width="0.9" opacity=".9"/>`,
  },
};

/**
 * Restyle the beak group in an SVG layer for a skin: its crystal's colours
 * and the skin's detail, added inside the group.
 */
export function styleHalcyraBeak(svg: string, skin: string, view: View | null) {
  const look = HALCYRA_BEAKS[skin];
  if (!look || !view) return svg;
  const start = svg.indexOf('<g data-keep="beak">');
  if (start < 0) return svg;
  const end = svg.indexOf("</g>", start);
  const [light, mid, dark] = look.colors;
  let group = svg.slice(start, end);
  // The crystal's gradient: white, glow, middle.
  group = group.replace(
    /(<linearGradient id="[^"]*-beak"[^>]*>)[\s\S]*?(<\/linearGradient>)/,
    `$1<stop stop-color="${light}"/><stop offset=".3" stop-color="${mid}"/><stop offset="1" stop-color="${dark}"/>$2`,
  );
  return (
    svg.slice(0, start) + group + (look.detail?.(view) ?? "") + svg.slice(end)
  );
}

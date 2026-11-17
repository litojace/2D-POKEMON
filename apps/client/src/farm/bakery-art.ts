/*
 * Baked goods' icons (farm-bakery.ts): duotone like the hub's icon set,
 * every shape outlined in a deeper shade of its own fill, light from the top
 * left. Each is a 64×64 SVG drawn at 128 px, for the barn, market, orders
 * and the bakery sheet, and for the bubble over the building.
 */
import type { BakeryRecipe } from "../../../../packages/shared/src/farm-bakery";

/** A deeper shade of a colour, as farm-icons.ts outlines its shapes. */
function deep(hex: string) {
  const n = parseInt(hex.slice(1, 7), 16),
    t = [34, 22, 52],
    k = 0.42;
  return (
    "#" +
    [(n >> 16) & 255, (n >> 8) & 255, n & 255]
      .map((v, i) =>
        Math.round(v * (1 - k) + t[i] * k)
          .toString(16)
          .padStart(2, "0"),
      )
      .join("")
  );
}
const P = (d: string, f: string, w = 2.4) =>
  `<path d="${d}" fill="${f}" stroke="${deep(f)}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
const C = (x: number, y: number, r: number, f: string, w = 2) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${f}" stroke="${deep(f)}" stroke-width="${w}"/>`;
const E = (x: number, y: number, rx: number, ry: number, f: string, w = 2.4) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}" stroke="${deep(f)}" stroke-width="${w}"/>`;
const L = (d: string, col: string, w = 2.2) =>
  `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const HL = (d: string) =>
  `<path d="${d}" fill="none" stroke="#fff" stroke-opacity=".65" stroke-width="2.4" stroke-linecap="round"/>`;
const BOLT = (x: number, y: number, s: number, f: string) =>
  P(
    `M${x + 1 * s} ${y - 6 * s}l-5 ${7 * s}h${4 * s}l-2 ${6 * s}l6 -${8 * s}h-${4 * s}z`,
    f,
    1.6,
  );

const SHAPES: Record<string, (r: BakeryRecipe) => string> = {
  bread: (r) =>
    E(32, 50, 22, 4, "#00000022", 0) +
    P("M9 40c-2-10 6-19 23-19s25 9 23 19c-1 5-6 8-23 8S10 45 9 40z", r.color) +
    L("M22 28l-5 9M32 26l-5 10M42 28l-5 9", r.accent, 2.6) +
    HL("M15 33c2-4 6-6 10-7"),
  berrytart: (r) =>
    E(32, 50, 22, 4, "#00000022", 0) +
    P("M8 33h48l-4 13c-1 3-3 4-6 4H18c-3 0-5-1-6-4z", r.color) +
    L("M15 36v10M22 36v12M29 36v12M36 36v12M43 36v12M50 36v10", r.shade, 1.4) +
    E(32, 33, 24, 7, "#fff0d0", 2.2) +
    C(24, 30, 5, r.accent) +
    C(34, 28, 5, r.accent) +
    C(42, 32, 5, r.accent) +
    C(30, 35, 4.5, r.accent) +
    HL("M22 28.5a2 2 0 0 1 2-1.5M32 26.5a2 2 0 0 1 2-1.5"),
  milkbun: (r) =>
    E(32, 50, 21, 4, "#00000022", 0) +
    P("M11 44c-2-14 7-24 21-24s23 10 21 24z", r.color) +
    P(
      "M15 34c3-7 9-10 17-10s14 3 17 10c-2 2-3 0-5 3-1 3-3 0-5 2s-3 0-6 3c-2-3-3 0-5-3s-4 1-5-2-3-1-5-3c-1 2-2 2-3 0z",
      "#fffaf2",
      1.8,
    ) +
    BOLT(33, 32, 1, r.accent) +
    HL("M17 31c2-3 5-5 9-6"),
  carrotcake: (r) =>
    E(32, 52, 21, 4, "#00000022", 0) +
    P("M10 30l40-10v26l-40 4z", r.color) +
    P("M10 30l40-10 4 3-40 10z", r.accent, 1.8) +
    L("M11 40l39-4", r.accent, 3.2) +
    P("M14 33l40-10v26l-4 1V36L14 37z", r.shade, 1.8) +
    P("M25 22l9-3 2 3-10 3z", "#ff8a3d", 1.6) +
    L("M34 18l2-4M35 19l4-2", "#4fae46", 2) +
    HL("M15 32l14-4"),
  pumpkinpie: (r) =>
    E(32, 50, 23, 4, "#00000022", 0) +
    E(32, 38, 25, 11, r.accent) +
    E(32, 36, 21, 8.5, r.color, 2) +
    L(
      "M18 31l10 11M27 28l12 14M37 28l9 10M14 38l8-8M22 43l16-15M34 44l12-11",
      r.accent,
      2.6,
    ) +
    HL("M14 34c3-3 7-4 11-5"),
  cornbread: (r) =>
    E(32, 51, 22, 4, "#00000022", 0) +
    P("M10 28l22-8 22 8v14l-22 8-22-8z", r.shade, 2) +
    P("M10 28l22-8 22 8-22 8z", r.color) +
    L("M17 25.5l22 8M24 23l22 8M21 30.5l14-5M28 33l14-5", deep(r.color), 1.2) +
    P("M27 26.5l5-2 5 2-5 2z", "#fff3b0", 1.4) +
    BOLT(44, 41, 0.8, r.accent) +
    HL("M14 28l10-3.5"),
};

/** A baked good's icon as SVG markup. */
export function bakedItemSvg(r: BakeryRecipe) {
  const body = (SHAPES[r.id] ?? SHAPES.bread)(r);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="128" height="128">${body}</svg>`;
}

/*
 * The Plaza: a player's title, over their name (owner, 27 Nov 2026: "show
 * the title in the Plaza too; the higher its rank, the more special its
 * effect"). The tier comes from the title's name (title-tier.ts).
 *
 * No plate or frame behind any of them (owner, 28 Nov: frames would make a
 * full town look busy): the tier shows in the lettering alone.
 *
 *   Common     the title in its own colour, outlined like the name
 *   Rare       the lettering shaded, light at the top
 *   Epic       a second outline in the title's colour, and a slow glint
 *              across the letters
 *   Legendary  a gold outline, a star at each end, the glint, small sparks
 *   Mythical   letters whose colours drift, a pale outline, stars, sparks
 *
 * A town full of players pays for this on a phone, so:
 *  - the lettering is painted once per title, colour and sharpness and then
 *    stamped (no text is rasterised per frame);
 *  - what moves (the glint, the sparks, the colours' drift) is a few stamps
 *    of slices of that painting and a few flat stars, drawn only for you
 *    and the nearest few (`animate`), and never on Low graphics or with
 *    Reduce motion: everyone else's holds still;
 *  - nothing glows: no shadowBlur, no filter, no blend mode, no clip.
 */
import {
  TIER_COLORS,
  tierRank,
} from "../../../../packages/shared/src/cosmetic-tier";
import {
  titleTier,
  type TitleTier,
} from "../../../../packages/shared/src/title-tier";

const INK = "rgba(11,16,32,.85)";
const FONT = "700 11px 'Barlow Condensed', 'Arial Narrow', sans-serif";
/** The line's height in world px, and the room it takes over a name. */
const H = 13;
export const PLAZA_TITLE_LIFT = 14;
const TRACK = 0.5;
/** Room round the lettering for its outlines. */
const M = 4;
/** Room at each end for a star (Legendary and Mythical). */
const STAR = 9;

export interface PlazaTitleArt {
  tier: TitleTier;
  /** The whole title as it stands still. */
  still: HTMLCanvasElement;
  /** The letters alone in light (the glint) or in their other colours
   *  (Mythical's drift): stamped over `still` in slices. */
  over: HTMLCanvasElement | null;
  /** Size in world px (the canvases are `res` times that). */
  w: number;
  h: number;
  /** The lettering's width, stars included. */
  pw: number;
  res: number;
  /** Where its sparks sit, from its own name: the same every frame. */
  sparks: [number, number, number][];
}

const cache = new Map<string, PlazaTitleArt>();

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
const rgb = (hex: string) =>
  [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
/** A colour mixed toward white (t from 0 to 1). */
function lighten(hex: string, t: number) {
  const [r, g, b] = rgb(hex).map((v) => Math.round(v + (255 - v) * t));
  return `rgb(${r},${g},${b})`;
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
}

function paint(
  title: string,
  color: string,
  tier: TitleTier,
  res: number,
): PlazaTitleArt {
  const text = title.toUpperCase();
  const probe = document.createElement("canvas").getContext("2d")!;
  probe.font = FONT;
  const tw = Math.ceil(
    probe.measureText(text).width + TRACK * Math.max(0, text.length - 1),
  );
  const rank = tierRank(tier);
  const ends = rank >= 3 ? STAR : 0;
  const pw = tw + 2 * ends,
    w = pw + 2 * M,
    h = H + 2 * M;
  const make = () => {
    const c = document.createElement("canvas");
    c.width = Math.ceil(w * res);
    c.height = Math.ceil(h * res);
    const g = c.getContext("2d")!;
    g.scale(res, res);
    g.font = FONT;
    g.textAlign = "left";
    g.textBaseline = "alphabetic";
    g.lineJoin = "round";
    g.miterLimit = 2;
    return [c, g] as const;
  };
  const y = M + H - 3.2,
    x0 = M + ends;
  /** Where each letter goes, tracked out a little (letter by letter: canvas
   *  letterSpacing is not on every phone's browser). */
  const at: [string, number][] = [];
  {
    let x = x0;
    for (const ch of text) {
      at.push([ch, x]);
      x += probe.measureText(ch).width + TRACK;
    }
  }
  const stroke = (g: CanvasRenderingContext2D, style: string, lw: number) => {
    g.lineWidth = lw;
    g.strokeStyle = style;
    for (const [ch, cx] of at) g.strokeText(ch, cx, y);
  };
  const fill = (
    g: CanvasRenderingContext2D,
    style: string | CanvasGradient,
  ) => {
    g.fillStyle = style;
    for (const [ch, cx] of at) g.fillText(ch, cx, y);
  };
  /** Light at the top of the letters, the title's colour below. */
  const shaded = (g: CanvasRenderingContext2D, top: number) => {
    const gr = g.createLinearGradient(0, M + 1, 0, M + H - 2);
    gr.addColorStop(0, lighten(color, top));
    gr.addColorStop(0.55, color);
    gr.addColorStop(1, color);
    return gr;
  };
  /** Mythical's colours along the line: the title's own, the tier's pink, a
   *  pale light; `shift` moves them half a turn for the other painting. */
  const drift = (g: CanvasRenderingContext2D, shift: boolean) => {
    const gr = g.createLinearGradient(x0, 0, x0 + tw, 0);
    const stops = shift
      ? [
          TIER_COLORS.mythic,
          "#fff3c4",
          TIER_COLORS.mythic,
          color,
          TIER_COLORS.mythic,
        ]
      : [color, TIER_COLORS.mythic, "#fff3c4", TIER_COLORS.mythic, color];
    stops.forEach((c, i) => gr.addColorStop(i / (stops.length - 1), c));
    return gr;
  };
  const [still, g] = make();
  let over: HTMLCanvasElement | null = null;
  // The outlines, widest first: the tier's own, then the dark one every
  // name has.
  if (rank === 2) stroke(g, lighten(color, 0.15), 4.2);
  if (rank === 3) stroke(g, TIER_COLORS.legendary, 4.2);
  if (rank === 4) stroke(g, "#fff6fb", 4.4);
  stroke(g, INK, rank >= 2 ? 2.8 : 2.4);
  fill(g, rank === 0 ? color : rank === 4 ? drift(g, false) : shaded(g, 0.6));
  if (rank >= 3) {
    // A star at each end, outlined as the letters are.
    const sy = M + H / 2 + 0.5;
    for (const sx of [M + 3.5, M + pw - 3.5]) {
      star(g, sx, sy, 4.4);
      g.lineWidth = 2;
      g.strokeStyle = INK;
      g.stroke();
      g.fillStyle = rank >= 4 ? "#fff3c4" : "#ffe08a";
      g.fill();
    }
  }
  if (rank >= 2) {
    const [c, og] = make();
    over = c;
    fill(og, rank === 4 ? drift(og, true) : "#ffffff");
  }
  const seed = hash(title);
  const sparks: [number, number, number][] = [];
  const n = rank >= 4 ? 4 : 3;
  for (let i = 0; i < n; i++) {
    const a = ((seed >>> (i * 5)) & 31) / 31,
      b = ((seed >>> (i * 5 + 3)) & 7) / 7;
    sparks.push([
      (-0.5 + (i + 0.2 + a * 0.6) / n) * (pw + 6),
      i % 2 ? H / 2 + b * 1.5 : -H / 2 - b * 1.5,
      a * Math.PI * 2,
    ]);
  }
  return { tier, still, over, w, h, pw, res, sparks };
}

/**
 * A title's art, painted once. `scale` is how many screen pixels a world
 * pixel takes (the zoom times the canvas's density), so the lettering is as
 * sharp as the name beside it.
 */
export function plazaTitleArt(
  title: string,
  color: string | null,
  scale: number,
): PlazaTitleArt {
  const res = Math.max(1, Math.min(4, Math.ceil(scale * 2) / 2));
  // A webfont that arrives later repaints (its key changes once it's there).
  const font = document.fonts?.check?.(FONT) ? 1 : 0;
  const c = color && /^#[0-9a-fA-F]{6}$/.test(color) ? color : "#ffd65b";
  const key = `${title}|${c}|${res}|${font}`;
  let art = cache.get(key);
  if (!art) {
    // A zoom or a resize leaves old sizes behind: start over now and then.
    if (cache.size > 240) cache.clear();
    art = paint(title, c, titleTier(title), res);
    cache.set(key, art);
  }
  return art;
}

/** A slice of `over` (world px from the painting's left), stamped in place. */
function slice(
  g: CanvasRenderingContext2D,
  art: PlazaTitleArt,
  left: number,
  top: number,
  sx: number,
  sw: number,
) {
  const a = Math.max(0, sx),
    b = Math.min(art.w, sx + sw);
  if (b <= a || !art.over) return;
  g.drawImage(
    art.over,
    a * art.res,
    0,
    (b - a) * art.res,
    art.over.height,
    left + a,
    top,
    b - a,
    art.h,
  );
}

/**
 * Draw a title centred on (x, cy). `animate` is for you and the few nearest
 * (never on Low graphics or with Reduce motion): the rest hold still.
 */
export function drawPlazaTitle(
  g: CanvasRenderingContext2D,
  art: PlazaTitleArt,
  x: number,
  cy: number,
  time: number,
  animate: boolean,
) {
  const rank = tierRank(art.tier),
    left = x - art.w / 2,
    top = cy - art.h / 2;
  g.drawImage(art.still, left, top, art.w, art.h);
  if (!animate || rank < 2) return;
  const phase = art.sparks[0]?.[2] ?? 0;
  if (rank >= 4) {
    // The letters' other colours come and go along the line, as a slow
    // wave: the colours seem to drift through the lettering.
    const N = 8,
      sw = art.w / N;
    for (let i = 0; i < N; i++) {
      const a =
        0.5 + 0.5 * Math.sin(time * 1.1 + phase - (i / N) * Math.PI * 2);
      if (a < 0.04) continue;
      g.globalAlpha = a;
      slice(g, art, left, top, i * sw, sw);
    }
    g.globalAlpha = 1;
  } else {
    // The glint: a band of light crosses the letters now and then (most of
    // its cycle it is away). Three stamps, the middle one brightest.
    const cycle = rank >= 3 ? 4 : 5.5,
      ph = ((time + phase) % cycle) / cycle,
      span = 0.28;
    if (ph < span) {
      const k = ph / span,
        bw = 5,
        gx = -3 * bw + k * (art.w + 3 * bw),
        peak = Math.sin(k * Math.PI);
      for (let i = 0; i < 3; i++) {
        g.globalAlpha = peak * (i === 1 ? 0.95 : 0.45);
        slice(g, art, left, top, gx + i * bw, bw);
      }
      g.globalAlpha = 1;
    }
  }
  if (rank >= 3) {
    g.fillStyle = rank >= 4 ? "#ffffff" : "#ffe9a8";
    for (const [sx, sy, sp] of art.sparks) {
      const a = Math.sin(time * 2.1 + sp);
      if (a <= 0.15) continue;
      g.globalAlpha = Math.min(1, a);
      star(g, x + sx, cy + sy, 1.2 + 2 * a);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

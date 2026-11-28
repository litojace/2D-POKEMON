/*
 * The Plaza: a player's title, over their name (owner, 27 Nov 2026: "show
 * the title in the Plaza too; the higher its rank, the more special its
 * effect"). The tier comes from the title's name (title-tier.ts):
 *
 *   Common     the title in its own colour, outlined like the name
 *   Rare       on a Poster ink plate
 *   Epic       the plate edged in the title's colour, and a slow glint
 *   Legendary  a gold-edged plate with notched ends, the glint, small sparks
 *   Mythical   a ribbon in a drifting gradient, ink lettering, a star at each
 *              end, sparks
 *
 * A town full of players pays for this on a phone, so:
 *  - the lettering is painted once per title, colour and sharpness and then
 *    stamped (no text is rasterised per frame);
 *  - what moves (the glint, the sparks, the gradient's drift) is a few flat
 *    shapes, drawn only for you and the nearest few (`animate`), and never on
 *    Low graphics or with Reduce motion: everyone else's holds still;
 *  - nothing glows: no shadowBlur, no filter, no blend mode.
 */
import {
  TIER_COLORS,
  tierRank,
} from "../../../../packages/shared/src/cosmetic-tier";
import {
  titleTier,
  type TitleTier,
} from "../../../../packages/shared/src/title-tier";

const INK = "#0d0d0f";
const FONT = "700 11px 'Barlow Condensed', 'Arial Narrow', sans-serif";
/** The line's height in world px, and the room it takes over a name. */
const H = 13;
export const PLAZA_TITLE_LIFT = 15;
const PAD = 5;
const TRACK = 0.5;

export interface PlazaTitleArt {
  tier: TitleTier;
  /** The whole title as it stands still. */
  still: HTMLCanvasElement;
  /** Mythical: the lettering and stars alone, over the drifting ribbon. */
  ink: HTMLCanvasElement | null;
  /** Size in world px (the canvases are `res` times that). */
  w: number;
  h: number;
  /** The plate's width (the canvas has a margin round it). */
  pw: number;
  color: string;
  /** Where its sparks sit, from its own name: the same every frame. */
  sparks: [number, number, number][];
}

const cache = new Map<string, PlazaTitleArt>();
const M = 4; // margin round the plate, for the outline and the ribbon's tails

function hash(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++)
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The plate's outline: square (Poster), notched ends from Legendary up. */
function platePath(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  notch: number,
) {
  g.beginPath();
  if (!notch) {
    g.rect(x, y, w, h);
    return;
  }
  g.moveTo(x, y);
  g.lineTo(x + w, y);
  g.lineTo(x + w - notch, y + h / 2);
  g.lineTo(x + w, y + h);
  g.lineTo(x, y + h);
  g.lineTo(x + notch, y + h / 2);
  g.closePath();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number) {
  g.beginPath();
  g.moveTo(x, y - r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.quadraticCurveTo(x, y, x, y + r);
  g.quadraticCurveTo(x, y, x - r, y);
  g.quadraticCurveTo(x, y, x, y - r);
  g.fill();
}

/** The ribbon's colours: the title's own, the tier's pink, a pale light. */
function ribbon(
  g: CanvasRenderingContext2D,
  x0: number,
  x1: number,
  color: string,
  shift: number,
) {
  // Twice the plate wide and mirrored, so it loops as it drifts.
  const w = (x1 - x0) * 2,
    s = x0 - (((shift % 1) + 1) % 1) * w;
  const gr = g.createLinearGradient(s, 0, s + w * 2, 0);
  const stops = [color, TIER_COLORS.mythic, "#fff3c4", TIER_COLORS.mythic];
  for (let k = 0; k < 2; k++)
    stops.forEach((c, i) => gr.addColorStop((k + i / stops.length) / 2, c));
  gr.addColorStop(1, color);
  return gr;
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
  const notch = rank >= 3 ? 3 : 0;
  const ends = rank >= 4 ? 9 : 0; // a star at each end of the ribbon
  const pw = rank ? tw + 2 * (PAD + notch) + 2 * ends : tw,
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
    return [c, g] as const;
  };
  /** The lettering, tracked out a little (drawn glyph by glyph: canvas
   *  letterSpacing is not on every phone's browser). */
  const letters = (
    g: CanvasRenderingContext2D,
    fill: string,
    outline: string | null,
  ) => {
    const y = M + H - 3.2;
    let x = M + (pw - tw) / 2;
    const at: [string, number][] = [];
    for (const ch of text) {
      at.push([ch, x]);
      x += g.measureText(ch).width + TRACK;
    }
    if (outline) {
      g.lineWidth = 2.4;
      g.miterLimit = 2;
      g.strokeStyle = outline;
      for (const [ch, cx] of at) g.strokeText(ch, cx, y);
    }
    g.fillStyle = fill;
    for (const [ch, cx] of at) g.fillText(ch, cx, y);
  };
  const [still, g] = make();
  let ink: HTMLCanvasElement | null = null;
  if (rank === 0) {
    letters(g, color, "rgba(11,16,32,.8)");
  } else if (rank < 4) {
    // Poster's ink plate, with its hard offset shadow.
    g.fillStyle = "rgba(0,0,0,.35)";
    platePath(g, M + 1, M + 1.5, pw, H, notch);
    g.fill();
    g.fillStyle = INK;
    platePath(g, M, M, pw, H, notch);
    g.fill();
    if (rank >= 2) {
      g.lineWidth = 1;
      g.strokeStyle = rank >= 3 ? TIER_COLORS.legendary : color;
      platePath(g, M + 0.5, M + 0.5, pw - 1, H - 1, notch);
      g.stroke();
    }
    letters(g, color, null);
  } else {
    const [inkC, ig] = make();
    ink = inkC;
    // An ink line under the ribbon and round its lettering's stars.
    ig.fillStyle = INK;
    star(ig, M + PAD + 2, M + H / 2, 3.6);
    star(ig, M + pw - PAD - 2, M + H / 2, 3.6);
    letters(ig, INK, null);
    g.fillStyle = INK;
    platePath(g, M - 1, M - 1 + 1.5, pw + 2, H + 2, 4);
    g.fill();
    g.fillStyle = ribbon(g, M, M + pw, color, 0);
    platePath(g, M, M, pw, H, 3);
    g.fill();
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(ink, 0, 0);
  }
  const seed = hash(title);
  const sparks: [number, number, number][] = [];
  for (let i = 0; i < (rank >= 4 ? 4 : 3); i++) {
    const a = ((seed >>> (i * 5)) & 31) / 31,
      b = ((seed >>> (i * 5 + 3)) & 7) / 7;
    sparks.push([
      (-0.5 + (i + 0.2 + a * 0.6) / (rank >= 4 ? 4 : 3)) * (pw + 6),
      i % 2 ? H / 2 + 1 + b * 2 : -H / 2 - 1 - b * 2,
      a * Math.PI * 2,
    ]);
  }
  return { tier, still, ink, w, h, pw, color, sparks };
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
  const c = color ?? "#ffd65b";
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
  if (!animate || rank < 2) {
    g.drawImage(art.still, left, top, art.w, art.h);
    return;
  }
  const x0 = x - art.pw / 2,
    x1 = x + art.pw / 2,
    y0 = cy - H / 2,
    y1 = cy + H / 2;
  if (rank >= 4 && art.ink) {
    // The ribbon's colours drift under still lettering.
    g.fillStyle = INK;
    platePath(g, x0 - 1, y0 + 0.5, art.pw + 2, H + 2, 4);
    g.fill();
    g.save();
    g.translate(x0, 0);
    g.fillStyle = ribbon(g, 0, art.pw, art.color, time / 6);
    platePath(g, 0, y0, art.pw, H, 3);
    g.fill();
    g.restore();
    g.drawImage(art.ink, left, top, art.w, art.h);
  } else {
    g.drawImage(art.still, left, top, art.w, art.h);
  }
  // The glint: a slanted band of light that crosses now and then (most of
  // its cycle it is away). Kept inside the plate by its own corners, so
  // nothing is clipped.
  const cycle = rank >= 4 ? 3.2 : rank >= 3 ? 4 : 5.5,
    ph = ((time + (art.sparks[0]?.[2] ?? 0)) % cycle) / cycle,
    span = 0.3;
  if (ph < span) {
    const k = ph / span,
      bw = 7,
      slant = 5,
      gx = x0 - bw - slant + k * (art.pw + bw + 2 * slant);
    const cl = (v: number) => Math.max(x0 + 1, Math.min(x1 - 1, v));
    g.fillStyle = `rgba(255,255,255,${0.34 * Math.sin(k * Math.PI)})`;
    g.beginPath();
    g.moveTo(cl(gx + slant), y0 + 1);
    g.lineTo(cl(gx + slant + bw), y0 + 1);
    g.lineTo(cl(gx + bw), y1 - 1);
    g.lineTo(cl(gx), y1 - 1);
    g.fill();
  }
  if (rank >= 3) {
    g.fillStyle = rank >= 4 ? "#fff" : "#ffe9a8";
    for (const [sx, sy, sp] of art.sparks) {
      const a = Math.sin(time * 2.1 + sp);
      if (a <= 0.15) continue;
      g.globalAlpha = Math.min(1, a);
      star(g, x + sx, cy + sy, 1.4 + 2.2 * a);
    }
    g.globalAlpha = 1;
  }
}

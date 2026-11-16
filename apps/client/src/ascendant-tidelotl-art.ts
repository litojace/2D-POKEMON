/**
 * Ascendant Tidelotl's new attacks on the Lagoon Court (raid-tidewyrm-art.ts
 * calls these): the Breaker Wall's warning and the wall itself, and the
 * Geyser Line's warnings. Like every raid warning, edges are the server's
 * exact shapes (the calm lanes' width, a geyser's radius) and only fills
 * pulse; each is told apart by shape as well as colour (lane brackets,
 * order dots, a no-jump icon).
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import type { RaidWarning, RaidWave } from "../../../packages/shared/src/raid";

type G = Phaser.GameObjects.Graphics;
const DANGER = 0xff4059,
  EDGE = 0xff8c99,
  CALM = 0x7dffe0,
  ABYSS = 0x0a2a4a,
  FOAM = 0xe6fbff,
  GLOW = 0x5ff6ff;
const W = 1600,
  H = 900;
const progressOf = (w: RaidWarning, now: number) =>
  w.startedAt === undefined
    ? 1
    : Math.max(
        0,
        Math.min(1, (now - w.startedAt) / Math.max(0.01, w.at - w.startedAt)),
      );

/** The stretches of a wall outside its calm lanes, as [from, to] across it. */
function wallSpans(length: number, gaps: number[], gapWidth: number) {
  const out: [number, number][] = [];
  let at = 0;
  for (const c of [...gaps].sort((a, b) => a - b)) {
    const a = c - gapWidth / 2,
      b = c + gapWidth / 2;
    if (a > at) out.push([at, a]);
    at = Math.max(at, b);
  }
  if (at < length) out.push([at, length]);
  return out;
}
/** A calm lane's two exact edges and its brackets, along the wall's travel. */
function drawLanes(
  g: G,
  axis: "x" | "y",
  gaps: number[],
  gapWidth: number,
  alpha: number,
  t: number,
  reduced: boolean,
) {
  const len = axis === "x" ? W : H;
  for (const c of gaps) {
    const a = c - gapWidth / 2,
      b = c + gapWidth / 2;
    // calm water (a soft teal strip) and its exact, dashed edges
    if (axis === "x") g.fillStyle(CALM, 0.1 * alpha).fillRect(0, a, len, b - a);
    else g.fillStyle(CALM, 0.1 * alpha).fillRect(a, 0, b - a, len);
    const flow = reduced ? 0 : (t * 60) % 40;
    for (let s = -40 + flow; s < len; s += 40) {
      g.lineStyle(3, CALM, 0.9 * alpha);
      if (axis === "x")
        g.lineBetween(s, a, s + 22, a).lineBetween(s, b, s + 22, b);
      else g.lineBetween(a, s, a, s + 22).lineBetween(b, s, b, s + 22);
    }
    // brackets every so often: "stand between these"
    for (let s = 120; s < len - 60; s += 260) {
      g.lineStyle(4, FOAM, 0.95 * alpha);
      if (axis === "x") {
        g.lineBetween(s, a + 2, s, a + 16).lineBetween(s, a + 2, s + 14, a + 2);
        g.lineBetween(s, b - 2, s, b - 16).lineBetween(s, b - 2, s + 14, b - 2);
      } else {
        g.lineBetween(a + 2, s, a + 16, s).lineBetween(a + 2, s, a + 2, s + 14);
        g.lineBetween(b - 2, s, b - 16, s).lineBetween(b - 2, s, b - 2, s + 14);
      }
    }
  }
}
/** "Can't jump this": an up arrow struck through, on a dark disc. */
function noJumpIcon(g: G, x: number, y: number) {
  g.fillStyle(0x0c1b32, 0.92).fillCircle(x, y, 22);
  g.lineStyle(3, DANGER, 1).strokeCircle(x, y, 22);
  g.lineStyle(4, FOAM, 1)
    .lineBetween(x, y + 10, x, y - 10)
    .lineBetween(x - 8, y - 2, x, y - 10)
    .lineBetween(x + 8, y - 2, x, y - 10);
  g.lineStyle(4, DANGER, 1).lineBetween(x - 14, y + 14, x + 14, y - 14);
}

/** Ascendant Tidelotl's warnings. Returns false for kinds it doesn't draw. */
export function drawAscendantTideWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  reduced: boolean,
) {
  const t = state.time;
  const pulse = reduced ? 1 : 0.86 + Math.sin(t * 8) * 0.14;
  const progress = progressOf(w, t);
  if (w.kind === "breaker") {
    const axis = w.tx !== w.x ? "x" : "y";
    const dir = axis === "x" ? Math.sign(w.tx - w.x) : Math.sign(w.ty - w.y);
    const gaps = w.gaps ?? [],
      gapWidth = w.gapWidth ?? 170;
    const across = axis === "x" ? H : W,
      along = axis === "x" ? W : H;
    // The whole court outside the lanes is in danger: a faint wash, the
    // source edge glowing deeper as the wall rises.
    for (const [a, b] of wallSpans(across, gaps, gapWidth)) {
      if (axis === "x")
        g.fillStyle(DANGER, 0.07 * pulse).fillRect(0, a, W, b - a);
      else g.fillStyle(DANGER, 0.07 * pulse).fillRect(a, 0, b - a, H);
      const band = 30 + progress * 60;
      g.fillStyle(ABYSS, 0.5 + 0.3 * progress);
      if (axis === "x") g.fillRect(dir > 0 ? 0 : W - band, a, band, b - a);
      else g.fillRect(a, dir > 0 ? 0 : H - band, b - a, band);
      g.fillStyle(DANGER, 0.3 * pulse);
      if (axis === "x") g.fillRect(dir > 0 ? band - 6 : W - band, a, 6, b - a);
      else g.fillRect(a, dir > 0 ? band - 6 : H - band, b - a, 6);
      // chevrons marching the way it will travel, outside the lanes only
      for (let k = 0; k < 5; k++) {
        const off =
          80 + ((reduced ? 0 : t * 140) % 160) + k * ((along - 160) / 5);
        for (let s = a + 50; s < b - 30; s += 150) {
          const ax = axis === "x" ? (dir > 0 ? off : W - off) : s,
            ay = axis === "x" ? s : dir > 0 ? off : H - off;
          const fx = axis === "x" ? dir : 0,
            fy = axis === "x" ? 0 : dir;
          g.lineStyle(3, EDGE, 0.55 * (1 - k / 6))
            .lineBetween(ax - fx * 12 - fy * 12, ay - fy * 12 - fx * 12, ax, ay)
            .lineBetween(
              ax,
              ay,
              ax - fx * 12 + fy * 12,
              ay - fy * 12 + fx * 12,
            );
        }
      }
    }
    drawLanes(g, axis, gaps, gapWidth, 0.6 + 0.4 * progress, t, reduced);
    noJumpIcon(
      g,
      axis === "x" ? (dir > 0 ? 70 : W - 70) : W / 2,
      axis === "x" ? H / 2 : dir > 0 ? 70 : H - 70,
    );
    return true;
  }
  if (w.kind === "geyser") {
    // An exact ring, bubbles welling up inside it, and its order in dots.
    g.fillStyle(DANGER, 0.16 * pulse).fillCircle(w.x, w.y, w.radius);
    g.fillStyle(GLOW, 0.1 + 0.18 * progress).fillCircle(
      w.x,
      w.y,
      w.radius * (0.3 + 0.5 * progress),
    );
    g.lineStyle(4, DANGER, 1).strokeCircle(w.x, w.y, w.radius);
    g.lineStyle(1, EDGE, 0.9).strokeCircle(w.x, w.y, Math.max(0, w.radius - 7));
    for (let i = 0; i < 6; i++) {
      const a = i * 1.047 + w.id,
        k = reduced ? 0.5 : (t * 1.4 + i / 6) % 1,
        d = w.radius * 0.55 * (1 - k);
      g.lineStyle(2, FOAM, 0.8 * Math.sin(k * Math.PI)).strokeCircle(
        w.x + Math.cos(a) * d,
        w.y + Math.sin(a) * d * 0.6,
        3 + 3 * k,
      );
    }
    const order = w.chain ?? 1;
    for (let i = 0; i < order; i++) {
      const x = w.x + (i - (order - 1) / 2) * 20;
      g.fillStyle(0x2a0d12, 1).fillCircle(x, w.y - w.radius - 16, 8.5);
      g.fillStyle(0xffd1d6, 1).fillCircle(x, w.y - w.radius - 16, 5.5);
    }
    g.lineStyle(5, 0xffd1d6, 0.95)
      .beginPath()
      .arc(
        w.x,
        w.y,
        Math.max(0, w.radius - 12),
        -Math.PI / 2,
        -Math.PI / 2 + progress * Math.PI * 2,
        false,
      )
      .strokePath();
    return true;
  }
  return false;
}

/** A Breaker Wall crossing the court: towering water, broken by its calm lanes. */
export function drawBreakerWall(
  g: G,
  wave: RaidWave,
  t: number,
  reduced: boolean,
) {
  const horizontal = wave.axis === "x";
  const h = wave.width,
    across = horizontal ? H : W;
  const gaps = wave.gaps ?? [],
    gapWidth = wave.gapWidth ?? 170;
  const front = wave.pos + wave.dir * (h / 2);
  for (const [a, b] of wallSpans(across, gaps, gapWidth)) {
    const rect = (pos: number, depth: number, color: number, alpha: number) =>
      horizontal
        ? g.fillStyle(color, alpha).fillRect(pos - depth / 2, a, depth, b - a)
        : g.fillStyle(color, alpha).fillRect(a, pos - depth / 2, b - a, depth);
    // deep water, a darker trough behind, a glassy strip and the crest
    rect(wave.pos, h, 0x123c6a, 0.85);
    rect(wave.pos - wave.dir * (h / 2 - 8), 14, 0x061a33, 0.45);
    rect(front - wave.dir * 20, 6, 0xffffff, 0.3);
    rect(front - wave.dir * 5, 10, FOAM, 0.9);
    for (let s = a + 12; s < b - 6; s += 30) {
      const wob = reduced ? 0 : Math.sin(t * 9 + s) * 4;
      g.fillStyle(0xffffff, 0.92).fillCircle(
        horizontal ? front + wob * 0.3 : s + wob,
        horizontal ? s + wob : front + wob * 0.3,
        9,
      );
      g.fillStyle(GLOW, 0.5).fillCircle(
        horizontal ? front - wave.dir * 14 : s,
        horizontal ? s : front - wave.dir * 14,
        4,
      );
    }
    // exact band edges in the danger colour
    g.lineStyle(3, DANGER, 0.9);
    if (horizontal)
      g.lineBetween(wave.pos - h / 2, a, wave.pos - h / 2, b).lineBetween(
        wave.pos + h / 2,
        a,
        wave.pos + h / 2,
        b,
      );
    else
      g.lineBetween(a, wave.pos - h / 2, b, wave.pos - h / 2).lineBetween(
        a,
        wave.pos + h / 2,
        b,
        wave.pos + h / 2,
      );
  }
  drawLanes(g, wave.axis, gaps, gapWidth, 1, t, reduced);
}

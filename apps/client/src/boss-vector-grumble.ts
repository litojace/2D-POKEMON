/**
 * Shared pieces of the raid bosses' vector rigs: the phase type, the facing
 * helpers every rig turns with, the soft glow drawing, and the rock and
 * crystal palettes Cragmuff's attack effects use (grumble-attack-fx.ts).
 * (This file once held Grumblecrag's stone golem; Cragmuff, the ram that
 * replaced it, lives in boss-cragmuff*.ts.)
 */
type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;

// ───────────────────────── palettes ─────────────────────────
export type Phase = 1 | 2 | 3;
export const ROCK: Record<
  Phase,
  { light: string; mid: string; dark: string; line: string; top: string }
> = {
  1: {
    light: "#c2b29c",
    mid: "#6f6258",
    dark: "#1f1916",
    line: "#120d0b",
    top: "rgba(255,240,215,0.16)",
  },
  2: {
    light: "#bba890",
    mid: "#665649",
    dark: "#1c1411",
    line: "#110a08",
    top: "rgba(255,225,190,0.14)",
  },
  3: {
    light: "#c99a82",
    mid: "#6e4438",
    dark: "#1d0d0a",
    line: "#100504",
    top: "rgba(255,200,160,0.14)",
  },
};
export const CRYSTAL: Record<
  Phase,
  { light: string; mid: string; dark: string; line: string; glow: number }
> = {
  1: {
    light: "#fff3c2",
    mid: "#f6b53f",
    dark: "#a8501a",
    line: "#4d2309",
    glow: 0xffbe50,
  },
  2: {
    light: "#ffe7ad",
    mid: "#ff9a33",
    dark: "#9a3c12",
    line: "#4a1c07",
    glow: 0xff963c,
  },
  3: {
    light: "#ffe2bc",
    mid: "#ff6b2c",
    dark: "#8a1b0c",
    line: "#3f0b04",
    glow: 0xff6e28,
  },
};
export const EYE: Record<Phase, number> = {
  1: 0xffcd5a,
  2: 0xffb446,
  3: 0xffecaa,
};
/** A soft white glow (tinted and added on top in battle). */
export function drawGlow(ctx: Ctx, size: number) {
  const r = size / 2;
  const g = ctx.createRadialGradient(r, r, 0, r, r, r);
  g.addColorStop(0, "rgba(255,255,255,0.85)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
}

/** The eight ways the boss faces: index 0 towards the camera, 2 screen right. */
export const FACINGS = 8;
const STEP = TAU / FACINGS;
/** The body's facing (radians, 0 towards the camera) for a screen angle. */
export const yawFor = (angle: number) => Math.PI / 2 - angle;
const wrap = (a: number) => ((((a + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
/**
 * Which of the eight facings to show: the nearest, but a facing already shown
 * holds until the boss has turned well past the halfway mark (no flicker
 * between two facings as it tracks someone).
 */
export function nextFacing(angle: number, previous?: number) {
  const yaw = yawFor(angle);
  const nearest = ((Math.round(yaw / STEP) % FACINGS) + FACINGS) % FACINGS;
  if (previous === undefined) return nearest;
  return Math.abs(wrap(yaw - previous * STEP)) > STEP * 0.65
    ? nearest
    : previous;
}
/** Turn `from` towards `to` (radians) by `rate` per second, the short way round. */
export function turnToward(from: number, to: number, dt: number, rate = 16) {
  const d = wrap(to - from);
  return from + d * Math.min(1, dt * rate);
}
/** Radians from `bodyYaw` to where the boss looks (screen direction x, y). */
export function lookFrom(bodyYaw: number, x: number, y: number) {
  if (!x && !y) return 0;
  return wrap(Math.atan2(x, y) - bodyYaw);
}

/**
 * Prismell, the prism-shelled snail (Prismatail's raid; the id stays
 * "prismatail"): a chubby pearly snail with big glossy eyes, two little
 * antennae tipped with crystal beads, and a big spiral shell of faceted
 * prism crystal with its heart glowing in the coil's eye. Proud and vain:
 * it shows its shell off like a peacock's fan.
 *
 * Pure: the pose from the battle's state (`prismellPose`) and every image's
 * placement this frame (`prismellPlacements`). The pieces are painted once
 * into one atlas (boss-prismell-paint.ts); boss-prismell-rig.ts moves Phaser
 * images to the placements, and the briefing diagram draws the same
 * placements onto a canvas (`prismellGuideImage`).
 *
 * Five views are drawn (front, ¾, side, ¾ back, back); the other three
 * facings are mirrors. The face (eyes and mouth) rides on the head as one
 * group and is never squashed: only the body and shell squash.
 */
import { nextFacing } from "./boss-vector-grumble";
import { PRISM_COLORS } from "../../../packages/shared/src/raid-prismatail";
import {
  ATT,
  FACING,
  SHELL_GLINTS,
  HR,
  buildPrismellAtlas,
  paintPrismellPieces,
  eyeLayout,
  mouthLayout,
} from "./boss-prismell-paint";

const TAU = Math.PI * 2;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 0 → 1 → 0 over `dur` seconds after an event. */
const after = (age: number, dur: number) =>
  age < 0 || age > dur ? 0 : Math.sin((age / dur) * Math.PI);

/** World pixels per rig px: Prismell's size in battle. */
export const PRISMELL_SCALE = 0.86;

export type PrismellLook =
  "idle" | "glare" | "wide" | "hurt" | "dizzy" | "closed";
export type PrismellMouth = "smile" | "smirk" | "open" | "o" | "wavy" | "flat";

/** What the battle tells the rig each frame (all cosmetic). */
export interface PrismellCue {
  clock: number;
  phase: number;
  reduced: boolean;
  /** The attack being wound up (its warning) and how far (0-1). */
  windKind?: string;
  windup: number;
  /** The last attack cast and how long ago (seconds). */
  castKind?: string;
  castAge: number;
  /** Seconds since a new phase began (it shows its shell off). */
  roarAge: number;
  /** The heart opened by a light relay; staggered; hit (0-1); beaten. */
  exposed: boolean;
  stagger: boolean;
  hurt: number;
  dead: boolean;
  deadAge: number;
  /** Creeping along (0-1). */
  walk?: number;
  /** Fan Display: which colour's slice will strike (lit in the shell). */
  prismHot?: number;
  /** Mirrors are flashing before a scramble. */
  scramble?: boolean;
}
export type PrismellPose = ReturnType<typeof prismellPose>;

export function prismellPose(c: PrismellCue) {
  const t = c.reduced ? 0.4 : c.clock;
  const m = c.reduced ? 0 : 1;
  const breathe = Math.sin(t * 1.7);
  const walk = c.reduced ? 0 : clamp(c.walk ?? 0);
  const inch = Math.sin(t * 5.2) * walk;
  const P = {
    t,
    motion: m,
    /** Body squash about the floor. */
    sx: 1 - 0.012 * breathe * m - 0.04 * inch,
    sy: 1 + 0.02 * breathe * m + 0.05 * inch,
    lean: 0,
    /** Head offset (rig px) from its anchor, and its tilt. */
    hx: walk * 3 * Math.sin(t * 5.2 + 0.6),
    hy: -1.6 * Math.sin(t * 1.7 + 0.5) * m,
    hrot: 0.045 * Math.sin(t * 0.8) * m,
    /** Shell lift (rig px), tilt (radians, + leans it forward) and its light. */
    lift: 0,
    srot: 0.022 * Math.sin(t * 0.9 + 1) * m,
    shine: 0,
    /** Rainbow glints, flash (the glare), the fan's hot colour. */
    glints: 1,
    flash: 0,
    hot: -1,
    hotGlow: 0,
    /** The lance's charge in the shell, the halo rising off it. */
    charge: 0,
    halo: 0,
    antL: 0.09 * Math.sin(t * 2.1) * m,
    antR: 0.09 * Math.sin(t * 2.1 + 1.3) * m,
    antLen: 1,
    look: "idle" as PrismellLook,
    mouth: "smile" as PrismellMouth,
    /** The heart: 0 shielded … 1 open. */
    open: 0,
    stars: 0,
    /** Beaten: tucked into the shell (0-1), the shell's light gone (0-1). */
    tuck: 0,
    dim: 0,
    alpha: 1,
    blink: !!m && t % 3.7 > 3.57,
  };
  const w = clamp(c.windup || 0),
    kind = c.windKind,
    age = c.castAge;
  // ── the wind-up of the attack being warned ──
  if (kind === "prism-lance" || kind === "refraction") {
    // it hunkers down and aims its shell, the heart's light gathering
    P.srot += 0.16 * w;
    P.lift -= 4 * w;
    P.sy -= 0.06 * w;
    P.sx += 0.04 * w;
    P.hy += 3 * w;
    P.charge = w;
    P.shine = 0.4 * w;
    P.look = "glare";
    P.mouth = "smirk";
    if (kind === "refraction") P.glints = 1 + w;
  } else if (kind === "fan-display") {
    // the peacock moment: it rears up and shows its shell off, eyes shut in pride
    P.sy += 0.07 * w;
    P.lift += 8 * w;
    P.srot -= 0.12 * w;
    P.hy -= 6 * w;
    P.hrot -= 0.1 * w;
    P.shine = 0.4 * w;
    P.glints = 1 + 1.5 * w;
    P.hot = c.prismHot ?? -1;
    P.hotGlow = w;
    P.look = w > 0.15 ? "closed" : "idle";
    P.mouth = "smirk";
    P.antL -= 0.25 * w;
    P.antR += 0.25 * w;
  } else if (kind === "glare") {
    // the shell flashes brighter and brighter; it squeezes its own eyes shut
    P.flash = w;
    P.shine = 0.5 * w;
    P.sy += 0.04 * w;
    P.hy += 2 * w;
    P.look = w > 0.2 ? "closed" : "glare";
    P.mouth = "smirk";
  } else if (kind === "halo-crush") {
    // it rears up tall while a halo lifts off the shell
    P.sy += 0.09 * w;
    P.sx -= 0.05 * w;
    P.lift += 10 * w;
    P.hy -= 8 * w;
    P.halo = w;
    P.shine = 0.6 * w;
    P.look = "glare";
    P.mouth = w > 0.5 ? "open" : "smirk";
  } else if (kind === "light-relay") {
    // the skylight wakes: antennae perk up, nervous
    P.antL -= 0.2 * w;
    P.antR += 0.2 * w;
    P.look = "wide";
    P.mouth = "o";
  }
  // ── the follow-through (none with reduced motion) ──
  if (!c.reduced) {
    if (c.castKind === "prism-lance" || c.castKind === "refraction") {
      const a = after(age, 0.5);
      P.srot -= 0.12 * a;
      P.hy -= 3 * a;
      P.shine = Math.max(P.shine, a);
      if (a > 0.05) ((P.look = "glare"), (P.mouth = "open"));
    } else if (c.castKind === "fan-display") {
      const a = after(age, 0.8);
      P.sy += 0.05 * a;
      P.lift += 6 * a;
      P.shine = Math.max(P.shine, a);
      P.glints = Math.max(P.glints, 1 + 2 * a);
      if (a > 0.05) ((P.look = "idle"), (P.mouth = "open"));
    } else if (c.castKind === "glare") {
      const a = after(age, 0.6);
      P.flash = Math.max(P.flash, a);
      if (a > 0.05) ((P.look = "closed"), (P.mouth = "smirk"));
    } else if (c.castKind === "halo-crush") {
      const a = after(age, 0.45);
      P.sy -= 0.12 * a;
      P.sx += 0.08 * a;
      P.lift -= 6 * a;
      P.hy += 6 * a;
      if (a > 0.05) ((P.look = "glare"), (P.mouth = "open"));
    }
    const roar = after(c.roarAge, 1.2);
    if (roar > 0.05) {
      // a new phase: it shows off, rearing proud, the shell blazing
      P.sy += 0.1 * roar;
      P.sx -= 0.05 * roar;
      P.lift += 10 * roar;
      P.srot -= 0.1 * roar;
      P.hy -= 8 * roar;
      P.hrot -= 0.12 * roar;
      P.shine = Math.max(P.shine, roar);
      P.glints = Math.max(P.glints, 1 + 2 * roar);
      P.look = "closed";
      P.mouth = "open";
      P.antL -= 0.3 * roar;
      P.antR += 0.3 * roar;
    }
  }
  if (c.scramble && !kind && !c.dead) P.glints = Math.max(P.glints, 1.6);
  if (c.exposed && !c.stagger && !c.dead) {
    // the heart open: startled, ducking behind its own shell
    P.open = 1;
    P.look = "wide";
    P.mouth = "o";
    P.hx -= 4;
    P.hy += 3;
    P.antL += 0.25;
    P.antR -= 0.25;
    P.shine = 0;
    P.flash = 0;
  }
  if (c.stagger && !c.dead) {
    P.open = 1;
    P.look = "dizzy";
    P.mouth = "wavy";
    P.stars = 1;
    P.sy = 0.9;
    P.sx = 1.06;
    P.hy = 7;
    P.hx = -3;
    P.hrot = m ? Math.sin(c.clock * 3) * 0.16 : 0.1;
    P.srot = m ? Math.sin(c.clock * 2.4) * 0.08 : 0.05;
    P.antL = 0.5 + (m ? Math.sin(c.clock * 3.3) * 0.15 : 0);
    P.antR = -0.5 - (m ? Math.sin(c.clock * 3.1) * 0.15 : 0);
    P.shine = 0;
    P.flash = 0;
    P.charge = 0;
    P.halo = 0;
    P.blink = false;
  }
  if (c.hurt > 0.3 && !c.dead && !c.reduced) {
    P.look = "hurt";
    P.mouth = "wavy";
    P.hx -= 5 * c.hurt;
    P.hrot += 0.1 * c.hurt;
    P.srot += Math.sin(t * 40) * 0.03 * c.hurt;
    P.blink = false;
  }
  if (c.dead) {
    // the light goes out of its shell and it tucks itself away inside
    const a = c.reduced ? 3 : c.deadAge;
    P.tuck = smooth(0.2, 1.4, a);
    P.dim = smooth(0, 1, a);
    P.look = "closed";
    P.mouth = "flat";
    P.sy = lerp(1, 0.86, P.tuck);
    P.sx = lerp(1, 1.05, P.tuck);
    P.lift = -4 * P.tuck;
    P.srot = 0.06 * P.tuck;
    P.hx = 0;
    P.hy = 0;
    P.hrot = 0;
    P.antL = P.antR = 0;
    P.antLen = 1 - 0.85 * P.tuck;
    P.shine = P.flash = P.charge = P.halo = P.hotGlow = 0;
    P.hot = -1;
    P.glints = 0;
    P.open = 0;
    P.stars = 0;
    P.blink = false;
    P.alpha = 1 - 0.15 * smooth(2, 3.4, a);
  }
  // it blinks only at rest: a wind-up glare holds until the attack lands
  if (P.blink && P.look === "idle") P.look = "closed";
  return P;
}

/** The facing shown: eight ways, with hysteresis. */
export const prismellFacing = (angle: number, previous?: number) =>
  nextFacing(angle, previous);

// ════════════════════════ placing the images ════════════════════════
export interface PrismellPlacement {
  key: string;
  piece: string;
  /** World px from the floor under the body. */
  x: number;
  y: number;
  rot: number;
  /** World px per rig px of the piece (the rig divides by its density). */
  sx: number;
  sy: number;
  alpha: number;
  z: number;
  glow?: boolean;
  tint?: number;
}
type Mat = [number, number, number, number, number, number];
const mul = (m: Mat, n: Mat): Mat => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): Mat => [1, 0, 0, 1, x, y];
const R = (a: number): Mat => [
  Math.cos(a),
  Math.sin(a),
  -Math.sin(a),
  Math.cos(a),
  0,
  0,
];
const S = (x: number, y = x): Mat => [x, 0, 0, y, 0, 0];
const pt = (m: Mat, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});
type Pt = { x: number; y: number };
/** Blend two 0xRRGGBB colours. */
const mixColor = (a: number, b: number, t: number) => {
  const ch = (s: number) =>
    Math.round(((a >> s) & 255) + (((b >> s) & 255) - ((a >> s) & 255)) * t);
  return (ch(16) << 16) | (ch(8) << 8) | ch(0);
};

/**
 * Pose → every image's placement (world px, from the floor under the body)
 * and where its head, eyes, mouth, shell and heart are.
 */
export function prismellPlacements(
  P: PrismellPose,
  facing: number,
  phaseIn: number,
) {
  const phase = clamp(Math.round(phaseIn), 1, 3);
  const F = FACING[((facing % 8) + 8) % 8],
    v = F.v,
    A = ATT[v];
  const list: PrismellPlacement[] = [];
  let order = 0;
  const put = (
    key: string,
    piece: string,
    m: Mat,
    x: number,
    y: number,
    z: number,
    o: {
      rot?: number;
      sx?: number;
      sy?: number;
      alpha?: number;
      glow?: boolean;
      tint?: number;
    } = {},
  ) => {
    const alpha = (o.alpha ?? 1) * P.alpha;
    if (alpha <= 0.01) return;
    const f = mul(mul(mul(m, T(x, y)), R(o.rot ?? 0)), S(o.sx ?? 1, o.sy ?? 1));
    const sx = Math.hypot(f[0], f[1]);
    list.push({
      key,
      piece,
      x: f[4],
      y: f[5],
      rot: Math.atan2(f[1], f[0]),
      sx,
      sy: (f[0] * f[3] - f[1] * f[2]) / (sx || 1),
      alpha: clamp(alpha),
      z: z + order++ * 1e-4,
      glow: o.glow,
      tint: o.tint,
    });
  };
  // the creature's frame: world scale, mirrored for the far facings
  let m: Mat = S(PRISMELL_SCALE);
  if (F.m) m = mul(m, S(-1, 1));
  m = mul(m, R(P.lean));
  const sq = (q: Pt) => ({ x: q.x * P.sx, y: q.y * P.sy });
  const body = mul(m, S(P.sx, P.sy));
  const back = v >= 3;
  const tuck = P.tuck;
  // ── the shell: on the back, lifted and tilted; the dim shell fades in when beaten ──
  const sc = sq(A.shell);
  const srot = P.srot * (v === 0 || v === 4 ? 0.35 : 1);
  const shellM = mul(mul(m, T(sc.x, sc.y - P.lift)), R(srot));
  const shellZ = 10;
  // ── the head: rides on the body (moved by its squash, never squashed) ──
  const hBase = sq(A.head);
  const headAt = {
    x: lerp(hBase.x + P.hx * (v === 0 || v === 4 ? 0 : 1), sc.x, tuck * 0.55),
    y: lerp(hBase.y + P.hy, sc.y + 26, tuck * 0.6),
  };
  const headM = mul(mul(m, T(headAt.x, headAt.y)), R(P.hrot));
  const headZ = A.headFront ? 20 : 0;
  const headAlpha = 1 - smooth(0.25, 0.85, tuck);
  // the body (the foot and neck)
  // (the dim body lies under the lit one, so the fade never shows the floor through)
  if (P.dim > 0.01)
    put("bodyD", `bodyD_${v}`, body, 0, 0, 4.99, { alpha: clamp(P.dim * 2.5) });
  put("body", `body_${v}`, body, 0, 0, 5, { alpha: 1 - P.dim * 0.999 });
  // ── the head and its antennae ──
  const antLen = P.antLen;
  const ant = (i: number, z: number) => {
    const a = A.ants[i];
    const rot = a.rot + (i === 0 ? P.antL : P.antR);
    put(`ant${i}`, P.dim > 0.5 ? "antD" : "ant", headM, a.x, a.y, z, {
      rot,
      sy: a.len * antLen,
      alpha: headAlpha,
    });
  };
  // which antenna is nearer: the one on the side turned to the camera
  const nearAnt = A.ants[0].z > A.ants[1].z ? 0 : 1;
  ant(1 - nearAnt, headZ - 0.5);
  put("head", tuck > 0.5 ? "headD" : `head_${v}`, headM, 0, 0, headZ, {
    alpha: headAlpha,
  });
  if (!back && headAlpha > 0.02) {
    put("eyes", `eyes_${v}_${P.look}`, headM, 0, 0, headZ + 0.2, {
      alpha: headAlpha,
    });
    put("mouth", `mouth_${v}_${P.mouth}`, headM, 0, 0, headZ + 0.3, {
      alpha: headAlpha,
    });
  }
  ant(nearAnt, back ? headZ - 0.4 : headZ + 0.5);
  // the neck over the shell (front views) or the tail over it (back views)
  if (!back) put("neck", `neck_${v}`, body, 0, 0, 15, { alpha: 1 - P.dim });
  else put("tail", `tail_${v}`, body, 0, 0, 15, { alpha: 1 - P.dim });
  if (P.dim > 0.01)
    put("shellD", `shellD_${v}`, shellM, 0, 0, shellZ - 0.01, {
      alpha: clamp(P.dim * 2.5),
    });
  // Fan Display: the shell takes on the striking slice's colour (a tint, so it reads on any light)
  const hotTint =
    P.hot >= 0 && P.hotGlow > 0.02
      ? mixColor(
          0xffffff,
          PRISM_COLORS[P.hot % PRISM_COLORS.length],
          0.75 * P.hotGlow,
        )
      : undefined;
  put("shell", `shell_${v}_${phase}`, shellM, 0, 0, shellZ, {
    alpha: 1 - P.dim * 0.999,
    tint: hotTint,
  });
  // the heart in the coil's eye: shielded, or open and blazing
  const coreL = { x: A.core.x - A.shell.x, y: A.core.y - A.shell.y };
  if (P.dim < 0.99) {
    put(
      "heart",
      P.open > 0.5 ? "heart_open" : "heart_shut",
      shellM,
      coreL.x,
      coreL.y,
      shellZ + 0.1,
      {
        alpha: (P.open > 0.5 ? 1 : 0.85) * (1 - P.dim),
        sx: P.open > 0.5 ? 1.35 : 1,
        sy: P.open > 0.5 ? 1.35 : 1,
      },
    );
    if (P.open < 0.5)
      put("shield", "shield", shellM, coreL.x, coreL.y, shellZ + 0.2, {
        alpha: 0.9 * (1 - P.dim),
      });
  }
  // ── glows (additive) ──
  const core = pt(shellM, coreL.x, coreL.y);
  const G = 1 / PRISMELL_SCALE;
  const glow = (
    key: string,
    at: Pt,
    r: number,
    alpha: number,
    tint = 0xffffff,
    piece = "glow",
    rot = 0,
  ) =>
    put(key, piece, S(1), at.x, at.y, 30, {
      sx: r / 32,
      sy: r / 32,
      alpha,
      glow: true,
      tint,
      rot,
    });
  const pulse = 0.5 + 0.5 * Math.sin(P.t * 3.1);
  // the heart's light (gentle when shielded, bright when open)
  if (P.dim < 0.95)
    glow(
      "coreGlow",
      core,
      P.open ? 20 : 12 + 3 * phase + 4 * P.charge,
      (P.open ? 0.16 + 0.06 * pulse : 0.1 + 0.03 * phase + 0.12 * P.charge) *
        (1 - P.dim),
      P.open ? 0xffd6a0 : 0xffc4e6,
    );
  const shellMid = pt(shellM, 0, 0);
  if (P.shine > 0.02)
    glow("shine", shellMid, 40 + 12 * P.shine, 0.12 * P.shine, 0xd8ccff);
  if (P.hot >= 0 && P.hotGlow > 0.02)
    glow(
      "hot",
      shellMid,
      56 + 24 * P.hotGlow,
      0.22 * P.hotGlow,
      PRISM_COLORS[P.hot % PRISM_COLORS.length],
    );
  if (P.flash > 0.02) {
    // the glare: a white flash with spokes of light round the shell
    // a light veil on the shell (its facets stay readable); the rays outside carry the warning
    glow("flash", shellMid, 40 + 16 * P.flash, 0.06 + 0.12 * P.flash, 0xfffbe8);
    const n = 8;
    for (let i = 0; i < n; i++) {
      const a = (i * TAU) / n + P.t * 0.4;
      const r = 74 * PRISMELL_SCALE;
      put(
        `ray${i}`,
        "ray",
        S(1),
        shellMid.x + Math.sin(a) * r,
        shellMid.y - Math.cos(a) * r,
        31,
        {
          rot: a,
          sx: 0.9,
          sy: 0.5 + 0.7 * P.flash,
          alpha: P.flash * 0.7,
          glow: true,
          tint: 0xfff6d8,
        },
      );
    }
  }
  // rainbow glints twinkling on the shell (more each phase, and when showing off)
  const shellLocal = (q: Pt) => pt(shellM, q.x, q.y);
  const nGlint = Math.min(
    A.glints.length,
    Math.round(SHELL_GLINTS[phase] * Math.min(2, P.glints)),
  );
  for (let i = 0; i < nGlint; i++) {
    const g = A.glints[i];
    const tw = P.motion
      ? Math.max(0, Math.sin(P.t * (2.2 + i * 0.37) + i * 1.7))
      : 0.6;
    if (tw < 0.05) continue;
    glow(
      `glint${i}`,
      shellLocal(g),
      (6 + 4 * tw) * (1 + 0.4 * (P.glints - 1)),
      tw * 0.95,
      PRISM_COLORS[(i * 3 + phase) % 6],
      "sparkle",
      P.t * 0.8 + i,
    );
  }
  // the antenna beads gleam from phase 2
  const beads: Pt[] = [];
  for (const [i, a] of A.ants.entries()) {
    const rot = a.rot + (i === 0 ? P.antL : P.antR);
    const tip = pt(
      mul(headM, mul(T(a.x, a.y), R(rot))),
      0,
      -(37 * a.len * antLen),
    );
    beads.push(tip);
    if (phase >= 2 && headAlpha > 0.5)
      glow(`bead${i}`, tip, 5 + 1.5 * phase, 0.22 + 0.06 * phase, 0xffd8f4);
  }
  // dizzy stars round the head
  const headPt = pt(headM, 0, 0);
  if (P.stars > 0.5)
    for (let i = 0; i < 3; i++) {
      const a = P.t * 3 + (i * TAU) / 3;
      put(
        `star${i}`,
        "star",
        S(1),
        headPt.x + Math.cos(a) * 42 * PRISMELL_SCALE,
        headPt.y - 44 * PRISMELL_SCALE + Math.sin(a) * 9,
        40,
        { rot: a },
      );
    }
  // where things are (world px from the floor point)
  const face = !back && headAlpha > 0.02;
  return {
    images: list.filter((p) => !p.glow).sort((a, b) => a.z - b.z),
    glows: list.filter((p) => p.glow),
    view: v,
    mirrored: F.m,
    head: headPt,
    /** The head's radius with a margin: the face box effects keep clear of. */
    headR: (HR + 4) * PRISMELL_SCALE,
    heart: core,
    shell: shellMid,
    shellTop: pt(shellM, 0, A.shellTop),
    beads,
    eyes: face
      ? (EYE_POINTS[v] ?? []).map((e) => pt(headM, e.x, e.y))
      : ([] as Pt[]),
    mouth: face ? pt(headM, MOUTH_POINTS[v].x, MOUTH_POINTS[v].y) : undefined,
    scale: G,
  };
}
const EYE_POINTS = [0, 1, 2].map((v) =>
  (eyeLayout(v) as { x: number; y: number }[]).map((e) => ({ x: e.x, y: e.y })),
);
const MOUTH_POINTS = [0, 1, 2].map((v) => mouthLayout(v) as Pt);

// ════════════════════════ the atlas, the guide picture ════════════════════════
export interface PrismellFrame {
  x: number;
  y: number;
  w: number;
  h: number;
  q: number;
  ox: number;
  oy: number;
}
export interface PrismellAtlas {
  canvas: HTMLCanvasElement;
  frames: Record<string, PrismellFrame>;
  bytes: number;
}
/** Paint every piece into one canvas (fixed density, never the screen's pixel ratio). */
export const paintPrismellAtlas = () => buildPrismellAtlas() as PrismellAtlas;

/** Draw placements onto a 2D canvas (the briefing diagram, the demo). */
export function drawPrismellPlacements(
  ctx: CanvasRenderingContext2D,
  atlas: PrismellAtlas,
  placements: PrismellPlacement[],
  x: number,
  y: number,
  k = 1,
) {
  for (const p of placements) {
    const f = atlas.frames[p.piece];
    if (!f) continue;
    if (p.tint !== undefined && !p.glow && p.tint !== 0xffffff) {
      drawTinted(ctx, atlas, f, p, x, y, k);
      continue;
    }
    ctx.save();
    ctx.globalAlpha = clamp(p.alpha);
    if (p.glow) ctx.globalCompositeOperation = "lighter";
    ctx.translate(x + p.x * k, y + p.y * k);
    ctx.rotate(p.rot);
    ctx.scale((p.sx * k) / f.q, (p.sy * k) / f.q);
    ctx.drawImage(
      atlas.canvas,
      f.x,
      f.y,
      f.w,
      f.h,
      -f.ox * f.q,
      -f.oy * f.q,
      f.w,
      f.h,
    );
    ctx.restore();
  }
}

let scratch: HTMLCanvasElement | undefined;
/** A tinted piece on a 2D canvas: the piece multiplied by the colour (like a Phaser tint). */
function drawTinted(
  ctx: CanvasRenderingContext2D,
  atlas: PrismellAtlas,
  f: PrismellFrame,
  p: PrismellPlacement,
  x: number,
  y: number,
  k: number,
) {
  scratch ??= document.createElement("canvas");
  scratch.width = f.w;
  scratch.height = f.h;
  const s = scratch.getContext("2d", { willReadFrequently: true });
  if (!s) return;
  s.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  s.globalCompositeOperation = "multiply";
  s.fillStyle = `#${(p.tint ?? 0xffffff).toString(16).padStart(6, "0")}`;
  s.fillRect(0, 0, f.w, f.h);
  s.globalCompositeOperation = "destination-in";
  s.drawImage(atlas.canvas, f.x, f.y, f.w, f.h, 0, 0, f.w, f.h);
  ctx.save();
  ctx.globalAlpha = clamp(p.alpha);
  ctx.translate(x + p.x * k, y + p.y * k);
  ctx.rotate(p.rot);
  ctx.scale((p.sx * k) / f.q, (p.sy * k) / f.q);
  ctx.drawImage(scratch, -f.ox * f.q, -f.oy * f.q);
  ctx.restore();
}

/** The cue at rest (the guide picture, tests). */
export const prismellRestCue = (exposed = false): PrismellCue => ({
  clock: 0,
  phase: 1,
  reduced: true,
  windup: 0,
  castAge: 99,
  roarAge: 99,
  exposed,
  stagger: false,
  hurt: 0,
  dead: false,
  deadAge: 0,
});
let guideUrls: Partial<Record<"calm" | "exposed", string>> = {};
/**
 * Prismell as an image URL for the briefing diagrams (drawn once per look),
 * at three-quarter; `exposed` opens its heart. Empty outside a browser.
 */
export function prismellGuideImage(exposed = false, paint = true) {
  const width = 300,
    height = 260,
    k = 1.2,
    cx = 158,
    cy = 236;
  const key = exposed ? "exposed" : "calm";
  const P = prismellPose(prismellRestCue(exposed));
  const placed = prismellPlacements(P, 1, 1);
  if (
    paint &&
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      // only the pieces this pose shows, at the picture's own scale
      const all = [...placed.images, ...placed.glows];
      const frames = paintPrismellPieces(
        [...new Set(all.map((p) => p.piece))],
        k * PRISMELL_SCALE * 1.25,
      ) as Record<string, PrismellFrame & { canvas: HTMLCanvasElement }>;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx) {
        for (const p of all) {
          const f = frames[p.piece];
          if (!f) continue;
          ctx.save();
          ctx.globalAlpha = clamp(p.alpha);
          if (p.glow) ctx.globalCompositeOperation = "lighter";
          ctx.translate(cx + p.x * k, cy + p.y * k);
          ctx.rotate(p.rot);
          ctx.scale((p.sx * k) / f.q, (p.sy * k) / f.q);
          ctx.drawImage(f.canvas, -f.ox * f.q, -f.oy * f.q);
          ctx.restore();
        }
        guideUrls[key] = canvas.toDataURL("image/png");
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  // the crop around it (the shell's top to the floor), and where the heart sits
  const top = cy + (placed.shellTop.y - 14) * k,
    bottom = cy + 12 * k;
  const left = cx - 135 * k * PRISMELL_SCALE,
    right = cx + 125 * k * PRISMELL_SCALE;
  const cl = (val: number, hi: number) => Math.max(0, Math.min(hi, val));
  return {
    url: guideUrls[key] ?? "",
    width,
    height,
    crop: [
      cl(left, width),
      cl(top, height),
      cl(right, width) - cl(left, width),
      cl(bottom, height) - cl(top, height),
    ] as const,
    core: [cx + placed.heart.x * k, cy + placed.heart.y * k] as const,
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetPrismellGuide() {
  guideUrls = {};
}

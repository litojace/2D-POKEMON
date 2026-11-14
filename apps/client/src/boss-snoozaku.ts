/**
 * Snoozaku's poses and image placements (no Phaser, no drawing): what the
 * battle tells the rig each frame becomes a pose, and the pose becomes a
 * short list of atlas images with where, how turned and how scaled each one
 * is. boss-snoozaku-art.ts paints the pieces; boss-snoozaku-rig.ts places
 * them.
 *
 * Standing still the baku is about ten images: the legs (one picture for
 * all four), the body, the head, the eyes, the mouth, the trunk, the cap and
 * a dream wisp or two. Phases 2-3 add star patterns on the body, more wisps
 * and a glowing cap.
 *
 * The face is one group: the head, eyes, mouth, trunk and cap move, turn
 * and bob together and are never scaled, so nothing on the face drifts.
 */
import {
  ATT,
  BOSS_SCALE,
  CAPP,
  EYEP,
  FACING,
  HEAD_Y,
  HR,
  PITCH_SCREEN,
  TRUNK_TIP,
  paintSnoozakuPicture,
} from "./boss-snoozaku-art";

export type Phase = 1 | 2 | 3;
export const SNOOZAKU_SCALE: number = BOSS_SCALE;
/** The floor under the boss, below its position (the old whale's float height). */
export const SNOOZAKU_FEET = 26;

export type SnoozakuExpr =
  "idle" | "glare" | "wide" | "hurt" | "dizzy" | "closed";
export type SnoozakuMouth = "smile" | "o" | "open" | "grit" | "flat" | "sleep";
export type SnoozakuTrunk = "rest" | "up" | "slam";

/** What the battle tells the rig each frame (all cosmetic, from the snapshot). */
export interface SnoozakuCue {
  time: number;
  phase: number;
  reduced: boolean;
  /** The attack being wound up (its warning) and how far (0-1). */
  windKind?: string;
  windup: number;
  /** The last attack cast and how long ago (seconds). */
  castKind?: string;
  castAge: number;
  /** Seconds since its yawn into a new phase. */
  roarAge: number;
  /** Seconds since a Nightmare jolted it. */
  nightmareAge: number;
  /** Woken: the star-heart on its chest is open. */
  exposed: boolean;
  stagger: boolean;
  /** 1 just hit, fading to 0. */
  hurt: number;
  dead: boolean;
  /** Seconds since it was beaten. */
  deadAge: number;
  /** Walk cycle (radians) and ground speed (px/s). */
  stride: number;
  speed: number;
}

export type Legs = { FL: number; FR: number; BL: number; BR: number };
export interface SnoozakuPose {
  /** Body: lift (px up), squash, turn (screen radians, × the view's pitch share). */
  bob: number;
  sx: number;
  sy: number;
  pitch: number;
  roll: number;
  /** The head group: nod (radians, + = nose down) and a lift (px up). */
  nod: number;
  headUp: number;
  expr: SnoozakuExpr;
  mouth: SnoozakuMouth;
  trunk: SnoozakuTrunk;
  /** The cap's extra droop (radians) and glow (0-1+). */
  cap: number;
  capGlow: number;
  /** The trunk tip's glow (an attack gathering) and its colour. */
  tipGlow: number;
  tipGold: boolean;
  heart: number;
  stars: number;
  notes: number;
  zz: number;
  bubbles: number;
  /** Wisps' spin speed and how close they hug it. */
  spin: number;
  hug: number;
  /** Lying down asleep (0-1), greyed (0-1). */
  curl: number;
  dim: number;
  leg: Legs;
  lift: Legs;
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
/** 1 fading to 0 over d seconds after something happened. */
const after = (age: number, d: number) =>
  age < 0 || age > d ? 0 : 1 - age / d;
const legs = (): Legs => ({ FL: 0, FR: 0, BL: 0, BR: 0 });

/** The baku's pose for this moment of the fight. */
export function snoozakuPose(c: SnoozakuCue): SnoozakuPose {
  const live = c.reduced ? 0 : 1;
  const t = c.reduced ? 0 : c.time;
  const breath = Math.sin(t * 1.6);
  const P: SnoozakuPose = {
    bob: 1.5 * (breath + 1) * live,
    sx: 1 + 0.012 * breath * live,
    sy: 1 + 0.02 * breath * live,
    pitch: 0,
    roll: 0.02 * Math.sin(t * 0.7) * live,
    nod: 0.03 * Math.sin(t * 1.6 + 0.6) * live,
    headUp: 1.2 * Math.sin(t * 1.6 + 0.3) * live,
    expr: "idle",
    mouth: "smile",
    trunk: "rest",
    cap: 0.04 * Math.sin(t * 1.3) * live,
    capGlow: (clamp(c.phase, 1, 3) - 1) * 0.35,
    tipGlow: 0,
    tipGold: false,
    heart: 0,
    stars: 0,
    notes: 0,
    zz: 0,
    bubbles: 0,
    spin: 0.5,
    hug: 0,
    curl: 0,
    dim: 0,
    leg: legs(),
    lift: legs(),
  };
  // dozing off now and then: the drowsy eyes fall shut, a little snore
  if (live && t % 11 > 8.2) {
    P.expr = "closed";
    P.mouth = "sleep";
    P.zz = smooth(8.2, 8.8, t % 11);
    P.nod += 0.08;
  }
  if (c.speed > 12 && !c.dead && !c.stagger) {
    const a = 0.38 * (live || 0.4),
      w = c.stride;
    const ph: Legs = { FL: 0, FR: Math.PI, BL: Math.PI, BR: 0 };
    for (const k of Object.keys(ph) as (keyof Legs)[]) {
      P.leg[k] = Math.sin(w + ph[k]) * a;
      P.lift[k] = Math.max(0, Math.cos(w + ph[k])) * a * 0.9;
    }
    P.bob += Math.abs(Math.sin(w)) * 3 * live;
    P.roll += Math.sin(w) * 0.025 * live;
    if (P.expr === "closed") {
      P.expr = "idle";
      P.mouth = "smile";
      P.zz = 0;
    }
  }
  const w = clamp(c.windup || 0),
    kind = c.windKind;
  const cast = c.reduced ? undefined : c.castKind,
    age = c.castAge;
  // ── the wind-ups (each attack its own way) ──
  if (kind === "lullaby") {
    // humming a lullaby through the trunk, eyes shut in bliss, rocking
    P.trunk = "up";
    P.expr = "closed";
    P.mouth = "o";
    P.notes = w;
    P.roll += Math.sin(t * 3) * 0.05 * w;
    P.tipGlow = 0.6 * w;
    P.zz = 0;
  } else if (kind === "tail-splash") {
    // the trunk slam: it rears back, the trunk raised high, a sly look
    P.trunk = "up";
    P.pitch -= 0.14 * w;
    P.nod -= 0.22 * w;
    P.headUp += 4 * w;
    P.expr = "glare";
    P.mouth = "smile";
    P.sy *= 1 + 0.04 * w;
    P.tipGlow = 0.8 * w;
    P.tipGold = true;
  } else if (kind === "dream-bubbles") {
    // cheeks puffed, blowing through the trunk
    P.trunk = "up";
    P.sx *= 1 + 0.06 * w;
    P.sy *= 1 + 0.03 * w;
    P.expr = "glare";
    P.mouth = "o";
    P.bubbles = w * 0.6;
    P.tipGlow = 0.5 * w;
  } else if (kind === "falling-stars") {
    // nose to the sky, wide awake, the cap blazing
    P.trunk = "up";
    P.nod -= 0.3 * w;
    P.headUp += 3 * w;
    P.expr = w > 0.35 ? "wide" : "glare";
    P.mouth = "o";
    P.capGlow = Math.max(P.capGlow, 1.4 * w);
    P.tipGlow = 0.7 * w;
    P.tipGold = true;
  } else if (kind === "whale-song") {
    // the thunder snore: asleep on purpose, a huge breath in, a roaring snore
    const snore = 0.5 + 0.5 * Math.sin(t * 5.5);
    P.expr = "closed";
    P.mouth = snore > 0.4 ? "open" : "o";
    P.trunk = "up";
    P.nod -= 0.12 * w;
    P.sx *= 1 + (0.04 + 0.05 * snore) * w;
    P.sy *= 1 + (0.03 + 0.04 * snore) * w;
    P.zz = Math.max(P.zz, w);
    P.tipGlow = 0.5 * w * snore;
  } else if (kind === "dream-sequence") {
    // dreaming: eyes shut, a smile, the pompom aglow, wisps drawn close
    P.expr = "closed";
    P.mouth = "sleep";
    P.capGlow = Math.max(P.capGlow, 0.9 * w);
    P.zz = Math.max(P.zz, w);
    P.spin = 1.4;
    P.hug = w;
    P.roll += 0.04 * Math.sin(t * 1.1) * w;
  }
  // ── the follow-through (none with reduced motion) ──
  if (cast === "lullaby") {
    const a = after(age, 0.9);
    P.notes = Math.max(P.notes, a);
    if (a > 0.05) {
      P.trunk = "up";
      P.mouth = "o";
      P.expr = "closed";
    }
  } else if (cast === "tail-splash" && age < 0.7) {
    // the lunge: the trunk slams down the lane, eyes popping wide
    const k = after(age, 0.7);
    P.trunk = "slam";
    P.pitch += 0.12 * k;
    P.nod += 0.32 * k;
    P.sy *= 1 - 0.1 * k;
    P.sx *= 1 + 0.07 * k;
    P.expr = "wide";
    P.mouth = "grit";
    P.tipGlow = 0.8 * k;
    P.tipGold = true;
  } else if (cast === "dream-bubbles") {
    const a = after(age, 0.8);
    P.bubbles = Math.max(P.bubbles, a);
    if (a > 0.05) {
      P.trunk = "up";
      P.expr = "closed";
      P.mouth = "o";
    }
  } else if (cast === "falling-stars") {
    const a = after(age, 0.7);
    if (a > 0.05) {
      P.nod += 0.2 * a;
      P.expr = "wide";
      P.mouth = "open";
      P.capGlow = Math.max(P.capGlow, a);
    }
  } else if (cast === "whale-song") {
    const a = after(age, 0.9);
    if (a > 0.05) {
      P.mouth = "open";
      P.expr = "closed";
      P.zz = Math.max(P.zz, a);
    }
  }
  // slow blinks while awake
  if (live && (P.expr === "idle" || P.expr === "glare") && t % 4.3 > 4.15)
    P.expr = "closed";
  // a great yawn into a new phase: stretch up, trunk high, the cap flaring
  const roar = c.reduced ? 0 : after(c.roarAge, 1.3);
  if (roar > 0.05) {
    P.expr = "closed";
    P.mouth = "open";
    P.trunk = "up";
    P.nod -= 0.25 * roar;
    P.headUp += 5 * roar;
    P.sy *= 1 + 0.06 * roar;
    P.sx *= 1 - 0.03 * roar;
    P.capGlow = Math.max(P.capGlow, 1.6 * roar);
  }
  // jolted by a Nightmare: grumpy, wide awake, a shake
  const jolt = c.reduced ? 0 : after(c.nightmareAge, 1);
  if (jolt > 0.05) {
    P.expr = jolt > 0.6 ? "wide" : "glare";
    P.mouth = "grit";
    P.roll += Math.sin(c.time * 40) * 0.05 * jolt;
    P.cap += 0.25 * jolt;
    P.capGlow = Math.max(P.capGlow, 1.2 * jolt);
  }
  // woken: eyes popped wide, the star-heart open
  if (c.exposed && !c.stagger) {
    P.expr = "wide";
    P.mouth = "o";
    P.trunk = P.trunk === "slam" ? "slam" : "up";
    P.heart = 1;
    P.zz = 0;
    P.headUp += 3;
    P.cap += 0.15;
  }
  if (c.stagger) {
    P.expr = "dizzy";
    P.mouth = "flat";
    P.trunk = "rest";
    P.stars = 1;
    P.heart = 1;
    P.roll = Math.sin(t * 2.6) * 0.1 * live + (live ? 0 : 0.06);
    P.nod = 0.15;
    P.sy *= 0.94;
    P.sx *= 1.04;
    P.zz = 0;
    P.notes = P.bubbles = 0;
  }
  if (c.hurt > 0.3 && !c.dead && !c.reduced) {
    P.expr = "hurt";
    P.mouth = "grit";
    P.nod -= 0.1 * c.hurt;
    P.sy *= 1 - 0.05 * c.hurt;
    P.sx *= 1 + 0.04 * c.hurt;
  }
  // beaten: it lies down and curls up asleep, the cap flopped over
  if (c.dead) {
    const d = c.reduced ? 1 : smooth(0, 1.2, c.deadAge);
    P.curl = d;
    P.dim = smooth(0.4, 1.8, c.reduced ? 9 : c.deadAge);
    P.bob = 0;
    P.roll = 0;
    P.pitch = 0;
    P.sx = 1;
    P.sy = 1;
    P.nod = 0.22 * d;
    P.headUp = -6 * d;
    P.expr = d < 0.35 && !c.reduced ? "hurt" : "closed";
    P.mouth = "sleep";
    P.trunk = "rest";
    P.cap = 0.35 * d;
    P.capGlow = 0;
    P.tipGlow = 0;
    P.heart = 0;
    P.stars = 0;
    P.notes = P.bubbles = 0;
    P.zz = smooth(1, 1.8, c.reduced ? 9 : c.deadAge);
    P.spin = 0.25;
    P.leg = legs();
    P.lift = legs();
  }
  // an open mouth lifts the trunk out of its way (the mouth hangs under it)
  if ((P.mouth === "o" || P.mouth === "open") && P.trunk === "rest")
    P.trunk = "up";
  return P;
}

// ───────────────────────── placements ─────────────────────────
/** A 2D affine transform (canvas order: a b c d e f). */
type M = [number, number, number, number, number, number];
const I: M = [1, 0, 0, 1, 0, 0];
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x: number, y: number): M => [1, 0, 0, 1, x, y];
const R = (a: number): M => [
  Math.cos(a),
  Math.sin(a),
  -Math.sin(a),
  Math.cos(a),
  0,
  0,
];
const S = (x: number, y: number): M => [x, 0, 0, y, 0, 0];
const ap = (m: M, x: number, y: number) => ({
  x: m[0] * x + m[2] * y + m[4],
  y: m[1] * x + m[3] * y + m[5],
});

export interface Placement {
  key: string;
  piece: string;
  /** Position (rig px from the floor point, y down), turn, scale. */
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  alpha: number;
  /** Additive glow (its own layer). */
  glow?: boolean;
}
/** Decompose a transform into a placement (no skew in the rig's transforms). */
function place(key: string, piece: string, m: M, alpha = 1): Placement {
  const sx = Math.hypot(m[0], m[1]);
  return {
    key,
    piece,
    x: m[4],
    y: m[5],
    rot: Math.atan2(m[1], m[0]),
    sx,
    sy: (m[0] * m[3] - m[1] * m[2]) / (sx || 1),
    alpha,
  };
}
type Pt = { x: number; y: number; z?: number };
type Att = Record<string, { x: number; y: number; z: number }>;
const glowAt = (
  key: string,
  piece: string,
  x: number,
  y: number,
  r: number,
  a: number,
): Placement => ({
  ...place(key, piece, mul(T(x, y), S(r / 32, r / 32)), a),
  glow: true,
});
/** Wisps per phase. */
const WISPS = [0, 2, 3, 5];

/**
 * The images for a pose at a facing (0 towards the camera, 2 screen right),
 * back to front, in rig px around the floor point; and where the head, the
 * eyes and the star-heart are (for auras, the open-heart ring and the face
 * check).
 */
export function snoozakuPlacements(
  P: SnoozakuPose,
  facing: number,
  phase: Phase,
  clock: number,
  reduced = false,
) {
  const F = FACING[((facing % 8) + 8) % 8] as { v: number; m: boolean },
    v = F.v,
    A = ATT[v] as unknown as Att,
    ps: number = PITCH_SCREEN[v];
  const t = reduced ? 0 : clock;
  const back: Placement[] = [];
  const out: Placement[] = [];
  const glows: Placement[] = [];
  const root: M = F.m ? S(-1, 1) : I;
  // the body: squashed from the floor, turned about its middle
  const curl = P.curl;
  const drop = curl * 7;
  const piv = A.body;
  const ang = P.pitch * ps + P.roll;
  let Mb = T(0, -P.bob + drop);
  Mb = mul(Mb, mul(T(piv.x, piv.y), mul(R(ang), T(-piv.x, -piv.y))));
  Mb = mul(Mb, S(P.sx, P.sy));
  const body = mul(root, Mb);
  // legs behind the body: standing, one picture; walking, one by one; asleep, tucked paws
  const still = (Object.keys(P.leg) as (keyof Legs)[]).every(
    (k) => Math.abs(P.leg[k]) < 0.02 && P.lift[k] < 0.02,
  );
  if (curl > 0.5) {
    // paws tucked under the chin: in front of the body unless seen from behind
    const paws = place("paws", `paws_${v}`, root);
    if (v >= 3) out.push(paws);
    else out.push(place("body", `body_${v}`, body), paws);
  } else if (still) {
    out.push(place("legs", `legs4_${v}`, mul(body, T(0, curl * 10))));
  } else {
    const order = (["FL", "FR", "BL", "BR"] as const)
      .slice()
      .sort((a, b) => A[a].z - A[b].z);
    for (const k of order) {
      const hip = ap(Mb, A[k].x, A[k].y);
      const far = A[k].z < A.body.z - 5 ? 1 : 0;
      const rot = -P.leg[k] * ps + ang;
      const m = mul(
        root,
        mul(
          T(hip.x, hip.y - P.lift[k] * 6),
          mul(R(rot), S(1, 1 - 0.25 * P.lift[k])),
        ),
      );
      out.push(place("leg" + k, `leg_${v}_${far}`, m));
    }
  }
  if (!out.some((p) => p.key === "body"))
    out.push(place("body", `body_${v}`, body));
  if (phase >= 2)
    out.push(place("over", `over_${v}_${phase}`, body, 1 - P.dim * 0.7));
  // the star-heart on the chest, when woken
  const heartPt = ap(body, A.heart.x, A.heart.y);
  if (P.heart > 0.02 && v <= 2) {
    const k = 0.75 + 0.3 * P.heart + (reduced ? 0 : Math.sin(clock * 6) * 0.04);
    out.push(
      place("heart", "heart", mul(T(heartPt.x, heartPt.y), S(k, k)), P.heart),
    );
  }
  if (P.heart > 0.05 && v <= 2)
    glows.push(
      glowAt(
        "hglow",
        "glow_rose",
        heartPt.x,
        heartPt.y,
        (30 + (reduced ? 0 : Math.sin(clock * 6) * 4)) * P.heart,
        0.75 * P.heart,
      ),
    );
  // the head group: the head's anchor rides the body, but the group is never scaled
  const hp = ap(Mb, A.head.x, HEAD_Y);
  const nodScreen = P.nod * ps;
  const head = mul(
    root,
    mul(
      T(hp.x, hp.y - P.headUp + P.nod * (1 - ps) * 10 + curl * 12),
      R(ang * 0.6 + nodScreen),
    ),
  );
  const items: Placement[] = [];
  const capPivot = CAPP[v].pivot as Pt;
  const capM = mul(
    head,
    mul(T(capPivot.x, capPivot.y), mul(R(-P.cap), T(-capPivot.x, -capPivot.y))),
  );
  if (v === 3) items.push(place("trunk", `trunk_${v}_${P.trunk}`, head));
  items.push(place("head", `head_${v}`, head));
  if (v <= 2) {
    items.push(place("mouth", `mouth_${v}_${P.mouth}`, head));
    items.push(place("trunk", `trunk_${v}_${P.trunk}`, head));
    items.push(place("eyes", `eyes_${v}_${P.expr}`, head));
  }
  const cap = place("cap", `cap_${v}`, capM);
  if (v >= 3) {
    // from behind, the head is behind the body; the cap rides above it
    out.unshift(...items);
    out.push(cap);
  } else out.push(...items, cap);
  // the pompom's glow and the cap's blaze
  const pom = ap(capM, (CAPP[v].pom as Pt).x, (CAPP[v].pom as Pt).y);
  const on = 1 - P.dim;
  if (P.capGlow > 0.05 && on > 0.02)
    glows.push(
      glowAt(
        "capglow",
        "glow_gold",
        pom.x,
        pom.y,
        12 +
          12 * Math.min(1.6, P.capGlow) +
          (reduced ? 0 : Math.sin(clock * 4) * 2),
        Math.min(0.6, 0.12 + 0.28 * P.capGlow) * on,
      ),
    );
  // the trunk's tip glows as an attack gathers
  const tipV = v <= 3 ? (TRUNK_TIP[v] as Record<string, Pt>)[P.trunk] : null;
  const tip = tipV ? ap(head, tipV.x, tipV.y) : ap(head, 0, 20);
  if (P.tipGlow > 0.05 && v <= 2)
    glows.push(
      glowAt(
        "tipglow",
        P.tipGold ? "glow_gold" : "glow_lilac",
        tip.x,
        tip.y,
        12 + 18 * P.tipGlow,
        Math.min(0.8, 0.7 * P.tipGlow),
      ),
    );
  // dream wisps orbit it (more each phase): behind it on the far side
  const n = WISPS[phase] ?? 2;
  const hc = ap(head, 0, 0);
  for (let i = 0; i < n; i++) {
    const a = t * P.spin + (i * Math.PI * 2) / n + 0.6;
    const rr = lerp(118, 82, P.hug),
      x = Math.cos(a) * rr,
      y = -70 - (i % 2) * 34 + Math.sin(a) * 26 + Math.sin(t * 2 + i) * 5;
    const k = 0.75 + 0.15 * Math.sin(a) + (i % 3) * 0.06;
    const p = place(
      "wisp" + i,
      `wisp_${i % 2}`,
      mul(
        T(x, y),
        mul(R(Math.sin(t + i) * 0.3), S(Math.cos(a) < 0 ? -k : k, k)),
      ),
      on * (0.55 + 0.35 * (1 + Math.sin(a)) * 0.5),
    );
    if (Math.sin(a) < 0) back.push(p);
    else out.push(p);
  }
  // notes from the trunk, bubbles, snores
  if (P.notes > 0.02)
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.8 + i / 3) % 1;
      out.push(
        place(
          "note" + i,
          "note",
          mul(
            T(
              tip.x + Math.sin(u * 6 + i) * 10 + u * 22 * (F.m ? -1 : 1),
              tip.y - 8 - u * 60,
            ),
            mul(R(Math.sin(u * 5) * 0.3), S(0.8 + u * 0.3, 0.8 + u * 0.3)),
          ),
          P.notes * Math.sin(u * Math.PI),
        ),
      );
    }
  if (P.bubbles > 0.02)
    for (let i = 0; i < 3; i++) {
      const u = (t * 0.9 + i / 3) % 1;
      const s = (0.45 + u * 0.55) * (0.8 + 0.2 * P.bubbles);
      out.push(
        place(
          "bub" + i,
          "bubble",
          mul(
            T(
              tip.x + (u * 40 + i * 6) * (F.m ? -1 : 1) * (v === 0 ? 0.3 : 1),
              tip.y - u * 42 + i * 4,
            ),
            S(s, s),
          ),
          P.bubbles * Math.sin(u * Math.PI),
        ),
      );
    }
  if (P.zz > 0.02) {
    for (let i = 0; i < 2; i++) {
      const u = (t * 0.45 + i / 2) % 1;
      const s = 0.6 + u * 0.6;
      out.push(
        place(
          "zz" + i,
          "zz",
          mul(
            T(hc.x + 34 + u * 26 + Math.sin(u * 7) * 4, hc.y - HR - 6 - u * 44),
            mul(R(-0.2), S(s, s)),
          ),
          P.zz * Math.sin(u * Math.PI),
        ),
      );
    }
  }
  // stars circling a dizzy head
  if (P.stars > 0.5)
    for (let i = 0; i < 3; i++) {
      // round the head at eye level, not over the cap
      const a = t * 3 + (i * Math.PI * 2) / 3;
      out.push(
        place(
          "star" + i,
          "star_1",
          mul(
            T(hc.x + Math.cos(a) * 66, hc.y - 14 + Math.sin(a) * 12),
            mul(R(a), S(0.8, 0.8)),
          ),
        ),
      );
    }
  const eyes =
    v <= 2 ? (EYEP[v] as unknown as Pt[]).map((e) => ap(head, e.x, e.y)) : [];
  return {
    images: [...back, ...out],
    glows,
    head: hc,
    eyes,
    tip,
    heart: v <= 2 ? heartPt : ap(body, A.body.x, A.body.y),
    view: v,
    mirrored: F.m,
  };
}

// ───────────────────────── the briefing picture ─────────────────────────
let guideUrls: Record<string, string> = {};
/** The baku's outline in the briefing picture at scale 1 (rig px around the floor point). */
const GUIDE_BOUNDS = { x0: -120, x1: 112, y0: -262, y1: 12 };
const GUIDE_HEART = (ATT[1] as unknown as Att).heart;
/**
 * The boss as an image URL for the briefing diagrams (drawn once per look),
 * with the crop around it and where its star-heart sits. The URL is empty
 * without a canvas (outside a browser).
 */
export function snoozakuGuideImage(exposed = false, paint = true) {
  const width = 360,
    height = 380,
    k = 1.2,
    cx = width / 2 + 4,
    groundY = 350;
  const key = exposed ? "exposed" : "calm";
  if (
    paint &&
    !guideUrls[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      const art = document.createElement("canvas");
      art.width = width;
      art.height = height;
      const a = art.getContext("2d");
      const out = document.createElement("canvas");
      out.width = width;
      out.height = height;
      const o = out.getContext("2d");
      if (a && o) {
        paintSnoozakuPicture(a, cx, groundY, k, exposed);
        // a soft dark outline, as the battle pieces have
        o.shadowColor = "rgba(36,24,84,0.95)";
        o.shadowBlur = 3;
        o.drawImage(art, 0, 0);
        o.drawImage(art, 0, 0);
        o.shadowColor = "transparent";
        o.drawImage(art, 0, 0);
        guideUrls[key] = out.toDataURL("image/png");
      }
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  const pad = 6,
    b = GUIDE_BOUNDS;
  return {
    url: guideUrls[key] ?? "",
    width,
    height,
    crop: [
      cx + b.x0 * k - pad,
      groundY + b.y0 * k - pad,
      (b.x1 - b.x0) * k + pad * 2,
      (b.y1 - b.y0) * k + pad * 2,
    ] as [number, number, number, number],
    core: [cx + GUIDE_HEART.x * k, groundY + GUIDE_HEART.y * k] as [
      number,
      number,
    ],
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetSnoozakuGuide() {
  guideUrls = {};
}

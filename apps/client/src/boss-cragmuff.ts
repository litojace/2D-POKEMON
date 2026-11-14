/**
 * Cragmuff's poses and image placements (no Phaser, no drawing): what the
 * battle tells the rig each frame becomes a pose, and the pose becomes a
 * short list of atlas images with where, how turned and how scaled each one
 * is. boss-cragmuff-art.ts paints the pieces; boss-cragmuff-rig.ts places
 * them.
 *
 * Standing still the ram is seven images: shadow-side legs (one picture for
 * all four), the fleece, the horns behind, the head, the eyes, the mouth and
 * the horns in front. Phases 2–3 add one picture of cracks and crystals.
 */
import {
  ATT,
  BOSS_SCALE,
  EYEP,
  FACING,
  HEAD_Y,
  HORNC,
  LEG_L,
  LODGEDP,
  PITCH_SCREEN,
  REAR_A,
  paintCragmuffPicture,
} from "./boss-cragmuff-art";

export type Phase = 1 | 2 | 3;
export const CRAGMUFF_SCALE: number = BOSS_SCALE;
/** The floor under the boss, below its position (the old rig's feet). */
export const CRAGMUFF_FEET = 51;

/** What the battle tells the rig each frame (all cosmetic, from the snapshot). */
export interface CragmuffCue {
  time: number;
  breath: number;
  phase: number;
  reduced: boolean;
  /** Charge (or volley) wind-up 0..1, and the run itself. */
  charge: number;
  charging: boolean;
  /** Slam warning 0..1, then the stomp fading 1..0. */
  slam: number;
  impact: number;
  /** Debris, eruption and meteor wind-ups 0..1. */
  debris: number;
  /** A new phase: 1..0. */
  transform: number;
  /** Into a pillar: 1..0. */
  crash: number;
  windKind?: string;
  windup: number;
  castKind?: string;
  castAge: number;
  stagger: boolean;
  /** The core is open (pillar, stagger or chapter 3). */
  exposed: boolean;
  /** Sitting dazed after a pillar (the pillar's exposure window). */
  dazed: boolean;
  hurt: number;
  dead: boolean;
  deathAge: number;
  /** Walk/gallop cycle (radians) and ground speed (px/s). */
  stride: number;
  speed: number;
}

export type Legs = { FL: number; FR: number; BL: number; BR: number };
export interface CragmuffPose {
  bdy: number;
  brot: number;
  rear: number;
  pitch: number;
  sit: number;
  flop: number;
  sx: number;
  sy: number;
  head: number;
  foldF: number;
  foldB: number;
  leg: Legs;
  lift: Legs;
  glow: number;
  core: number;
  rocks: number;
  dim: number;
  stars: number;
  expr: string;
  mouth: string;
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};
const legs = (): Legs => ({ FL: 0, FR: 0, BL: 0, BR: 0 });

/** The ram's pose for this moment of the fight. */
export function cragmuffPose(c: CragmuffCue): CragmuffPose {
  const live = c.reduced ? 0 : 1;
  const t = c.reduced ? 0 : c.time;
  const P: CragmuffPose = {
    bdy: 0,
    brot: 0,
    rear: 0,
    pitch: 0,
    sit: 0,
    flop: 0,
    sx: 1 + 0.008 * Math.sin(t * 2.1 + 0.6) * live,
    sy: 1 + 0.012 * Math.sin(t * 2.1) * live,
    head: 0.025 * Math.sin(t * 2.1 + 0.4) * live,
    foldF: 0,
    foldB: 0,
    leg: legs(),
    lift: legs(),
    glow: 0,
    core: 0,
    rocks: 0,
    dim: 0,
    stars: 0,
    expr: "idle",
    mouth: "pout",
  };
  const gait = (amp: number, gallop: boolean) => {
    const a = amp * (live || 0.4),
      w = c.stride;
    const ph: Legs = gallop
      ? { FL: 0, FR: 0.5, BL: Math.PI, BR: Math.PI + 0.5 }
      : { FL: 0, FR: Math.PI, BL: Math.PI, BR: 0 };
    for (const k of Object.keys(ph) as (keyof Legs)[]) {
      P.leg[k] = Math.sin(w + ph[k]) * a;
      P.lift[k] = Math.max(0, Math.cos(w + ph[k])) * a * 0.9;
    }
    P.bdy -= Math.abs(Math.sin(w)) * (gallop ? 6 : 2.5) * live;
  };
  if (c.charging) {
    gait(0.62, true);
    P.head = 0.6;
    P.pitch = 0.12;
    P.expr = "glare";
    P.mouth = "grit";
    P.glow = 0.6;
  } else if (c.speed > 12 && !c.dead && !c.stagger) gait(0.42, false);

  const w = clamp(c.windup);
  // the charge wind-up: horns down, a hoof pawing the floor
  if (c.charge > 0 && !c.charging && c.windKind !== "volley") {
    const k = clamp(c.charge);
    P.head = Math.max(P.head, 0.55 * k);
    P.sy *= 1 - 0.07 * k;
    P.sx *= 1 + 0.05 * k;
    P.glow = 0.85 * k;
    P.expr = "glare";
    P.mouth = "grit";
    const s = Math.sin(t * 11);
    P.leg.FL += (s * 0.5 - 0.15) * k * (live || 0.5);
    P.lift.FL = Math.max(P.lift.FL, Math.max(0, -s) * 0.6 * k * live);
  }
  // the volley: the fleece puffs up with rocks stuck in it, then a wet-dog shake
  if (c.windKind === "volley" && w > 0) {
    // the last moments of the wind-up: the shake that flings the stones (they land as the warning ends)
    const shake = c.reduced ? 0 : clamp((w - 0.66) / 0.08);
    P.sx *= 1 + 0.1 * w * (1 - shake);
    P.sy *= 1 + 0.07 * w * (1 - shake);
    P.rocks = w * (1 - shake);
    P.head = 0.15 * w;
    P.expr = shake > 0 ? "closed" : "glare";
    P.mouth = shake > 0 ? "roar" : "grit";
    if (shake > 0) {
      const s = Math.sin(c.time * 38);
      P.brot += s * 0.07 * shake;
      P.sx *= 1 + 0.05 * s * shake;
    }
  }
  if (c.castKind === "volley" && c.castAge < 0.55) {
    const k = 1 - c.castAge / 0.55,
      s = Math.sin(c.time * 38) * live;
    P.brot += s * 0.07 * k;
    P.sx *= 1 + 0.05 * s * k;
    P.expr = "closed";
    P.mouth = "roar";
  }
  // the slam: rear up (a drawn pose), then a stomp with the fleece bouncing
  if (c.slam > 0) {
    P.rear = 0.62 * smooth(0, 0.35, c.slam);
    P.head = -0.15;
    P.glow = Math.max(P.glow, 1.1 * c.slam);
    P.expr = "glare";
    P.mouth = "roar";
  }
  if (c.impact > 0 && c.slam <= 0) {
    const u = 1 - c.impact;
    const b = c.reduced ? 0 : Math.cos(u * Math.PI * 3) * Math.pow(1 - u, 1.5);
    P.sy *= 1 - 0.18 * b;
    P.sx *= 1 + 0.12 * b;
    P.head = 0.3 * c.impact;
    P.mouth = "grit";
    P.glow = Math.max(P.glow, 0.6 * c.impact);
  }
  // debris: bleating at the cave roof, forelegs stomping in turn
  if (c.windKind === "debris" && w > 0) {
    P.head = -0.45 * w;
    P.mouth = "roar";
    P.expr = "closed";
    P.glow = Math.max(P.glow, 0.9 * w);
    const s = Math.sin(t * 9);
    P.lift.FL = Math.max(P.lift.FL, Math.max(0, s) * w);
    P.lift.FR = Math.max(P.lift.FR, Math.max(0, -s) * w);
  }
  // the eruption: one foreleg raised high, then stomped to crack the floor
  if (c.windKind === "eruption" && w > 0) {
    P.lift.FR = Math.max(P.lift.FR, w);
    P.leg.FR -= 0.35 * w;
    P.head = -0.1;
    P.glow = Math.max(P.glow, 0.5 + 0.4 * w);
    P.expr = "glare";
    P.mouth = "grit";
  }
  if (c.castKind === "eruption" && c.castAge < 0.3) {
    P.sy *= 0.9 + 0.1 * (c.castAge / 0.3);
    P.head = 0.28;
  }
  // the meteor: up on the hind legs, horns blazing at the sky
  if (c.windKind === "share" && w > 0) {
    P.rear = Math.max(P.rear, 0.62 * smooth(0, 0.15, w));
    P.head = -0.25;
    P.glow = Math.max(P.glow, 1.6 * w);
    P.expr = "glare";
    P.mouth = "roar";
  }
  if (c.castKind === "share" && c.castAge < 0.4) {
    P.head = 0.25;
    P.sy *= 0.92;
    P.mouth = "grit";
  }
  // into a pillar: thrown back, then sat down dazed with the core open
  if (c.crash > 0) {
    P.pitch = -0.32 * c.crash;
    P.expr = "wide";
    P.mouth = "roar";
  }
  // dazed after a pillar, unless it is already winding up its next attack
  const busy =
    w > 0.05 || c.charge > 0 || c.slam > 0 || c.charging || c.castAge < 0.5;
  if (c.dazed && !c.stagger && !busy) {
    P.sit = Math.max(P.sit, 0.75);
    P.head = 0.32;
    P.expr = c.crash > 0.5 ? "wide" : "dizzy";
    P.mouth = "wavy";
    P.stars = 1;
    P.brot += Math.sin(t * 3.2) * 0.04 * live;
  }
  if (c.exposed) P.core = 1;
  if (c.stagger) {
    P.flop = 1;
    P.foldF = P.foldB = 1;
    P.leg = legs();
    P.lift = legs();
    P.head = 0.35 + Math.sin(t * 2.4) * 0.08 * live;
    P.expr = "dizzy";
    P.mouth = "wavy";
    P.stars = 1;
    P.core = 1;
  }
  // a new phase: up on the hind legs, a bleat, the crystals flaring
  if (c.transform > 0 && !c.dead) {
    const f = clamp(c.transform);
    if (f > 0.25 && !c.reduced) P.rear = Math.max(P.rear, 0.6);
    P.head = -0.2;
    P.glow = Math.max(P.glow, 2.2 * f);
    P.expr = "glare";
    P.mouth = "roar";
  }
  if (c.hurt > 0 && !c.dead) {
    const h = c.reduced ? 0 : c.hurt;
    P.head -= 0.22 * h;
    P.sy *= 1 - 0.08 * h;
    P.sx *= 1 + 0.06 * h;
    if (c.hurt > 0.3) {
      P.expr = "hurt";
      P.mouth = "roar";
    }
  }
  // defeat: it sits down heavily, the head droops and the crystals go dark
  if (c.dead) {
    const a = c.reduced ? 9 : c.deathAge;
    P.rear = 0;
    P.leg = legs();
    P.lift = legs();
    P.flop = 0;
    P.sit = smooth(0.5, 1.6, a);
    P.foldB = P.sit;
    P.head = lerp(-0.25, 0.4, smooth(0, 2.8, a));
    P.dim = smooth(1, 2.8, a);
    P.glow = 0;
    P.core = 0;
    P.stars = 0;
    P.expr = a < 0.5 ? "hurt" : a < 1.4 ? "wide" : "closed";
    P.mouth = a < 2.8 ? "wavy" : "flat";
  }
  // blink
  if (
    !c.reduced &&
    (P.expr === "idle" || P.expr === "glare") &&
    c.time % 3.6 > 3.47
  )
    P.expr = "closed";
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
const mid = (a: Pt, b: Pt) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/**
 * The images for a pose at a facing (0 towards the camera, 2 screen right),
 * back to front, in rig px around the floor point; and where the head, the
 * eyes and the core are (for auras, the open-core ring and the face check).
 */
export function cragmuffPlacements(
  P: CragmuffPose,
  facing: number,
  phase: Phase,
  clock: number,
  reduced = false,
) {
  const F = FACING[((facing % 8) + 8) % 8],
    v: number = F.v,
    A = ATT[v] as unknown as Record<
      string,
      { x: number; y: number; z: number }
    >,
    ps: number = PITCH_SCREEN[v];
  const out: Placement[] = [];
  const glows: Placement[] = [];
  const root: M = F.m ? S(-1, 1) : I;
  const rearOn = P.rear > 0.28;
  const hind = mid(A.BL, A.BR),
    front = mid(A.FL, A.FR),
    piv = P.sit > 0.01 ? front : hind;
  const legShort = Math.max(P.flop, 0) * 24;
  const ang =
    (P.pitch - (P.rear - (rearOn ? REAR_A : 0)) * 0.8) * ps -
    P.sit * 0.3 * ps +
    P.brot;
  let Mb = T(0, P.bdy + legShort + P.sit * 20 * (1 - 0.4 * ps));
  Mb = mul(Mb, mul(T(piv.x, piv.y), mul(R(ang), T(-piv.x, -piv.y))));
  Mb = mul(Mb, S(P.sx, P.sy));
  const body = mul(root, Mb);
  const hooves: Pt[] = [];
  // legs behind the body; standing still, one picture for all four
  const still =
    (Object.keys(P.leg) as (keyof Legs)[]).every(
      (k) => Math.abs(P.leg[k]) < 0.02 && P.lift[k] < 0.02,
    ) &&
    P.foldF < 0.02 &&
    P.foldB < 0.02;
  if (!rearOn && still) {
    out.push(place("legs", `legs4_${v}`, body));
    for (const k of ["FL", "FR", "BL", "BR"] as const)
      hooves.push(ap(body, A[k].x, A[k].y + LEG_L));
  } else if (!rearOn) {
    const order = (["FL", "FR", "BL", "BR"] as const)
      .slice()
      .sort((a, b) => A[a].z - A[b].z);
    for (const k of order) {
      const isF = k[0] === "F";
      const hip = ap(Mb, A[k].x, A[k].y);
      const farK =
        v === 0
          ? isF
            ? 0
            : 1
          : v === 4
            ? isF
              ? 1
              : 0
            : A[k].z < A.body.z
              ? 1
              : 0;
      const fold = clamp((isF ? P.foldF : P.foldB) + P.lift[k] * 0.55);
      const rot =
        -P.leg[k] * ps +
        (isF ? ang : P.brot) -
        (isF ? P.lift[k] * 0.5 * ps : 0);
      const m = mul(
        root,
        mul(T(hip.x, hip.y), mul(R(rot), S(1, 1 - 0.62 * fold))),
      );
      out.push(place("leg" + k, `leg_${v}_${farK}`, m));
      hooves.push(ap(m, 0, LEG_L));
    }
  }
  out.push(place("body", rearOn ? `bodyR_${v}` : `body_${v}`, body));
  if (rearOn)
    for (const k of ["BL", "BR"] as const)
      hooves.push(ap(body, A[k].x, A[k].y + LEG_L));
  if (phase >= 2) {
    // cracks and crystals in one picture; rearing, it rides up with the chest
    const m = rearOn
      ? mul(
          body,
          mul(
            T(hind.x, hind.y),
            mul(R(-REAR_A * ps), T(-hind.x, -hind.y - 26 * (1 - ps))),
          ),
        )
      : body;
    out.push(place("over", `over_${v}_${phase}`, m, 1 - P.dim * 0.5));
  }
  if (P.rocks > 0.02)
    for (const [i, r] of (
      LODGEDP[v] as unknown as { n: number; q: Pt; c: number }[]
    ).entries())
      if (r.c > 0.1)
        out.push(
          place(
            "rock" + i,
            `rock_${r.n}`,
            mul(
              body,
              mul(
                T(r.q.x, r.q.y),
                mul(
                  R(r.n),
                  S(0.8 * (0.6 + 0.4 * P.rocks), 0.8 * (0.6 + 0.4 * P.rocks)),
                ),
              ),
            ),
            P.rocks,
          ),
        );
  const g = rearOn ? A.gemR : A.gem;
  let core: Pt | null = v <= 2 ? ap(body, g.x, g.y) : null;
  if (v <= 2 && P.core > 0.01) {
    const open = P.core,
      gap = (4 + 14 * open) * (v === 2 ? 0.7 : 1),
      k = 0.7 + 0.35 * open;
    out.push(
      place("gem", "gem_open", mul(body, mul(T(g.x, g.y), S(k, k))), open),
    );
    out.push(
      place("flapL", `flap_${v}_L`, mul(body, T(g.x - gap - 6, g.y)), open),
    );
    out.push(
      place("flapR", `flap_${v}_R`, mul(body, T(g.x + gap + 6, g.y)), open),
    );
  }
  // the head group: horns behind, head, face, horns in front
  const hp = ap(Mb, rearOn ? A.headR.x : A.head.x, rearOn ? A.headR.y : HEAD_Y);
  const hdown = P.head * (1 - ps) * 12;
  const head = mul(
    root,
    mul(T(hp.x, hp.y + hdown), R(ang + P.head * ps - (rearOn ? 0.32 * ps : 0))),
  );
  const headItems: Placement[] = [];
  const horns = (part: "B" | "F") => {
    if (P.dim < 0.99)
      headItems.push(place("horns" + part, `horns${part}_${v}_${phase}`, head));
    if (P.dim > 0.01)
      headItems.push(
        place("horns" + part + "d", `horns${part}d_${v}_${phase}`, head, P.dim),
      );
  };
  // head down to charge, turned views: the face is drawn over the horn (an anime cheat) so the glare reads
  const faceOver = (v === 1 || v === 2) && P.head > 0.3;
  const face = () => {
    if (v > 2) return;
    headItems.push(place("eyes", `eyes_${v}_${P.expr}`, head));
    headItems.push(place("mouth", `mouth_${v}_${P.mouth}`, head));
  };
  horns("B");
  headItems.push(place("head", `head_${v}`, head));
  if (!faceOver) face();
  horns("F");
  if (faceOver) face();
  // from behind the head is behind the body
  if (v >= 3) out.unshift(...headItems);
  else out.push(...headItems);
  // glows: the horns (a wind-up makes them blaze), the open core
  const on = 1 - P.dim;
  const hornPts = (HORNC[v] as unknown as Pt[][]).map((arr) =>
    ap(head, arr[phase].x, arr[phase].y),
  );
  if (on > 0.02)
    for (const [i, h] of hornPts.entries()) {
      const r = (14 + 4 * phase) * (1 + Math.min(1.2, P.glow) * 0.3);
      const a = Math.min(0.6, 0.18 + 0.08 * phase + 0.22 * P.glow) * on;
      glows.push({
        ...place(
          "hglow" + i,
          "glow_amber",
          mul(T(h.x, h.y), S(r / 32, r / 32)),
          a,
        ),
        glow: true,
      });
    }
  if (core && P.core > 0.05) {
    const r =
      (34 + (reduced ? 0 : Math.sin(clock * 6) * 5)) * (0.6 + 0.4 * P.core);
    glows.push({
      ...place(
        "cglow",
        "glow_hot",
        mul(T(core.x, core.y), S(r / 32, r / 32)),
        0.75 * P.core,
      ),
      glow: true,
    });
  }
  const hc = ap(head, 0, 0);
  if (P.stars > 0.5)
    for (let i = 0; i < 3; i++) {
      const a = (reduced ? 0 : clock * 3) + (i * Math.PI * 2) / 3;
      out.push(
        place(
          "star" + i,
          "star",
          mul(
            T(hc.x + Math.cos(a) * 34, hc.y - 44 + Math.sin(a) * 8),
            mul(R(a), S(0.75, 0.75)),
          ),
        ),
      );
    }
  const eyes =
    v <= 2 ? (EYEP[v] as unknown as Pt[]).map((e) => ap(head, e.x, e.y)) : [];
  if (!core) core = ap(body, A.body.x, A.body.y);
  return {
    images: out,
    glows,
    head: hc,
    eyes,
    core,
    hooves,
    view: v as number,
    mirrored: F.m as boolean,
  };
}

// ───────────────────────── the briefing picture ─────────────────────────
let guideUrls: Record<string, string> = {};
/** The ram's outline in the briefing picture at scale 1 (rig px around the floor point). */
const GUIDE_BOUNDS = { x0: -105, x1: 126, y0: -190, y1: 13 };
const GUIDE_GEM = (ATT[1] as unknown as { gem: { x: number; y: number } }).gem;
/**
 * The boss as an image URL for the briefing diagrams (drawn once per look),
 * with the crop around it and where its core sits. The URL is empty without
 * a canvas (outside a browser).
 */
export function cragmuffGuideImage(exposed = false) {
  const width = 360,
    height = 340,
    k = 1.25,
    cx = width / 2 - 12,
    groundY = 300;
  const key = exposed ? "exposed" : "calm";
  if (
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
        paintCragmuffPicture(a, cx, groundY, k, exposed);
        // a soft dark outline, as the battle pieces have
        o.shadowColor = "rgba(44,34,24,0.95)";
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
    core: [cx + GUIDE_GEM.x * k, groundY + GUIDE_GEM.y * k] as [number, number],
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetCragmuffGuide() {
  guideUrls = {};
}

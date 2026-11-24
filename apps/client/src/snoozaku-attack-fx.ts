/**
 * Snoozaku's attack effects in battle (the "somnara" raid; first made for
 * the baku's demo): the trunk's notes and puffs, the dream-trunk that rises
 * over the Trunk Slam's lane and slams down, shooting stars with glittering
 * trails, the Thunder Snore's sound waves, a Nightmare's dark puff, and the
 * baku's own moments (a yawn into a new phase, being woken, staggered,
 * beaten).
 *
 * The server's warnings stay exactly as drawn by raid-ui.ts and
 * raid-somnara-art.ts (the lane, the star marks, the Quiet Zone, the rings
 * and bubbles); these are presentation only. Shock rings stay inside each
 * warning's footprint, and the snore's waves are never drawn inside the
 * Quiet Zone, so the safe spot always reads as quiet.
 *
 * Everything draws through the effects engine's layers (fx.g, fx.floor,
 * fx.soft and the pooled glows passed in), never with its own scene
 * objects. What comes before a hit is drawn from the warning counting down;
 * the hit from the cast (boss-performance.ts), kept here for as long as its
 * effect lasts. Everything is worked out from ids and ages, so nothing
 * random changes from frame to frame.
 */
import type Phaser from "phaser";
import type { Fighter, Snapshot } from "@arena/shared";
import {
  quietZoneAt,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import type { BossCast } from "./boss-performance";
import type { Fx } from "./fx-engine";
import { SNOOZAKU_FEET } from "./boss-snoozaku";

type Glow = (
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  floor?: boolean,
) => void;
type G = Phaser.GameObjects.Graphics;
/** The parts of the effects engine these use (the demo passes its own canvas versions). */
export type SnoozakuFx = Pick<Fx, "g" | "floor" | "soft">;

const TAU = Math.PI * 2;
const FLAT = 0.58;
const LILAC = 0xb9a2ff,
  IVORY = 0xfff4d6,
  GOLD = 0xffd977,
  HOT = 0xfff6cf,
  INK = 0x2a1d63,
  ROSE = 0xff9fd2,
  NIGHT = 0x4a2a7a;
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (u: number) => 1 - (1 - u) * (1 - u) * (1 - u);
const hash = (n: number) => {
  const a = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return a - Math.floor(a);
};

/** How long each hit's effect lasts (s). */
const LIFE: Partial<Record<RaidWarning["kind"], number>> = {
  lullaby: 1.2,
  "tail-splash": 1.3,
  "dream-bubbles": 0.9,
  "falling-stars": 1.1,
};
interface Hit {
  cast: BossCast;
  age: number;
  landed: number;
}
type MomentKind = "roar" | "woken" | "stagger" | "defeat" | "nightmare";
interface Moment {
  kind: MomentKind;
  age: number;
  x: number;
  y: number;
  seed: number;
}
const MOMENT_LIFE: Record<MomentKind, number> = {
  roar: 1.6,
  woken: 1,
  stagger: 1.2,
  defeat: 2.6,
  nightmare: 1,
};
interface Memory {
  last: number;
  map: Map<number, Hit>;
  moments: Moment[];
  phase: number;
  exposed: boolean;
  staggered: boolean;
  dead: boolean;
  nights: number;
  count: number;
}
const memories = new WeakMap<object, Memory>();

/** A puffy five-point star. */
function star(
  g: G,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
  rot = -Math.PI / 2,
) {
  if (alpha <= 0.01 || r <= 0.3) return;
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = rot + (i * Math.PI) / 5,
      rr = i % 2 ? r * 0.48 : r;
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr };
  });
  g.fillStyle(color, alpha).fillPoints(pts, true);
}
/** A four-point sparkle. */
function sparkle(
  g: G,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
  rot = 0,
) {
  if (alpha <= 0.01 || r <= 0.3) return;
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = rot + (i * Math.PI) / 4,
      rr = i % 2 ? r * 0.22 : r;
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr };
  });
  g.fillStyle(color, alpha).fillPoints(pts, true);
}
/** A little music note (lullaby). */
function note(
  g: G,
  x: number,
  y: number,
  s: number,
  color: number,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  g.fillStyle(color, alpha).fillEllipse(x, y, 8 * s, 6 * s);
  g.lineStyle(1.8 * s, color, alpha)
    .lineBetween(x + 3.5 * s, y, x + 3.5 * s, y - 14 * s)
    .lineBetween(x + 3.5 * s, y - 14 * s, x + 9 * s, y - 10 * s);
}
/** A sleepy Z (the snore). */
function zee(
  g: G,
  x: number,
  y: number,
  s: number,
  color: number,
  alpha: number,
) {
  if (alpha <= 0.01) return;
  const pts = [
    { x: x - 6 * s, y: y - 6 * s },
    { x: x + 6 * s, y: y - 6 * s },
    { x: x - 6 * s, y: y + 6 * s },
    { x: x + 6 * s, y: y + 6 * s },
  ];
  g.lineStyle(5 * s, INK, alpha * 0.7).strokePoints(pts, false);
  g.lineStyle(2.6 * s, color, alpha).strokePoints(pts, false);
}
/** A soft dream cloud (normal blend), a few puffs. */
function cloud(
  fx: SnoozakuFx,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
  seed: number,
) {
  if (alpha <= 0.01) return;
  for (let i = 0; i < 3; i++) {
    const a = seed + i * 2.1;
    fx.soft(
      x + Math.cos(a) * r * 0.45,
      y + Math.sin(a) * r * 0.25,
      r * 1.2,
      color,
      alpha,
      0.8,
    );
  }
}
/** Where the trunk's tip is (world), for the boss facing `angle`. */
function trunkTip(boss: Fighter) {
  const a = boss.angle ?? Math.PI / 2;
  return {
    x: boss.x + Math.cos(a) * 52,
    y: boss.y + SNOOZAKU_FEET - 70 + Math.sin(a) * 18,
  };
}
const progress = (w: RaidWarning, time: number) =>
  clamp(
    (time - (w.startedAt ?? w.at - 1.5)) /
      Math.max(0.01, w.at - (w.startedAt ?? w.at - 1.5)),
  );

export function drawSnoozakuAttacks(
  fx: SnoozakuFx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  casts: BossCast[],
  clock: number,
  low: boolean,
  nightmares = 0,
) {
  const r = state.raid;
  if (!r) return;
  // Before the hits: the dream-trunk rising over its lane, shooting stars on
  // their way down, the snore's waves.
  for (const w of r.warnings) {
    if (w.casterId && w.casterId !== boss.id) continue;
    if (w.kind === "tail-splash")
      dreamTrunk(fx, glow, w, progress(w, state.time), 0);
    else if (w.kind === "falling-stars")
      fallingStar(fx, glow, w, progress(w, state.time), low);
    else if (w.kind === "whale-song") snore(fx, glow, state, boss, w, low);
  }
  let mine = memories.get(fx);
  if (!mine)
    memories.set(
      fx,
      (mine = {
        last: clock,
        map: new Map(),
        moments: [],
        phase: r.phase,
        exposed: false,
        staggered: false,
        dead: boss.hp <= 0,
        nights: nightmares,
        count: 0,
      }),
    );
  const dt = state.phase === "paused" ? 0 : clamp(clock - mine.last, 0, 0.1);
  mine.last = clock;
  for (const hit of mine.map.values())
    hit.age = Math.max(
      hit.age,
      Math.min(hit.age + dt, state.time - hit.landed + 0.1),
    );
  for (const cast of casts)
    if (!mine.map.has(cast.id) && LIFE[cast.kind])
      mine.map.set(cast.id, {
        cast: { ...cast },
        age: cast.age,
        landed: state.time - cast.age,
      });
  moments(fx, glow, state, boss, mine, dt, low, nightmares);
  for (const [id, hit] of mine.map) {
    const c = hit.cast,
      age = hit.age;
    if (age > (LIFE[c.kind] ?? 0)) {
      mine.map.delete(id);
      continue;
    }
    const seed = id * 17;
    if (c.kind === "lullaby")
      notesBurst(fx, glow, trunkTip(boss), age, seed, low);
    else if (c.kind === "dream-bubbles")
      puff(fx, glow, trunkTip(boss), age, seed, low);
    else if (c.kind === "tail-splash") slam(fx, glow, c, age, seed, low);
    else if (c.kind === "falling-stars") starBurst(fx, glow, c, age, seed, low);
  }
}

/** The lullaby: notes fly out of the trunk in a soft ring. */
function notesBurst(
  fx: SnoozakuFx,
  glow: Glow,
  at: { x: number; y: number },
  age: number,
  seed: number,
  low: boolean,
) {
  const u = clamp(age / 1.2),
    fade = 1 - u;
  glow(at.x, at.y, 26 + 20 * u, LILAC, 0.5 * fade);
  const n = low ? 5 : 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed + i) * 0.5,
      d = easeOut(u) * (60 + hash(seed + i * 3) * 50);
    note(
      fx.g,
      at.x + Math.cos(a) * d,
      at.y + Math.sin(a) * d * 0.7 - u * 20,
      0.9 + hash(i) * 0.4,
      i % 2 ? IVORY : LILAC,
      fade,
    );
  }
}
/** Dream bubbles blown: a puff of sparkly breath at the trunk. */
function puff(
  fx: SnoozakuFx,
  glow: Glow,
  at: { x: number; y: number },
  age: number,
  seed: number,
  low: boolean,
) {
  const u = clamp(age / 0.9),
    fade = 1 - u;
  cloud(fx, at.x, at.y, 16 + 22 * u, 0xe4dcff, 0.5 * fade, seed);
  glow(at.x, at.y, 22, LILAC, 0.4 * fade);
  for (let i = 0; i < (low ? 3 : 6); i++) {
    const a = hash(seed + i) * TAU,
      d = easeOut(u) * 40;
    sparkle(
      fx.g,
      at.x + Math.cos(a) * d,
      at.y + Math.sin(a) * d,
      4 * fade + 1,
      HOT,
      fade,
      a,
    );
  }
}
/**
 * The dream-trunk: a long ghostly trunk over the lane. In the wind-up it
 * rises (p 0..1); at the hit (down 0..1) it lies along the lane, fading.
 */
function dreamTrunk(
  fx: SnoozakuFx,
  glow: Glow,
  w: RaidWarning,
  p: number,
  down: number,
) {
  if (p < 0.12 && !down) return;
  const k = down ? 1 - down : clamp((p - 0.12) / 0.5);
  const lift = down
    ? 0
    : 70 *
      Math.sin(Math.min(1, p) * Math.PI * 0.5) *
      (p > 0.92 ? (1 - p) / 0.08 : 1);
  const dx = w.tx - w.x,
    dy = w.ty - w.y,
    len = Math.hypot(dx, dy) || 1;
  const pts = Array.from({ length: 14 }, (_, i) => {
    const s = i / 13;
    const arc = Math.sin(s * Math.PI) * lift * 0.6 + s * lift * 0.5;
    return {
      x: w.x + dx * s,
      y: w.y + dy * s - arc - (1 - s) * 40,
      r: w.radius * 0.42 * (1 - 0.35 * s) + 4,
    };
  });
  const a = (down ? 0.55 : 0.42) * k;
  if (a <= 0.01) return;
  // the tube: its outline offset either side of the curve, the tip rounded
  const nx0 = -dy / len,
    ny0 = dx / len;
  const left = pts.map((q) => ({ x: q.x + nx0 * q.r, y: q.y + ny0 * q.r }));
  const right = pts
    .map((q) => ({ x: q.x - nx0 * q.r, y: q.y - ny0 * q.r }))
    .reverse();
  const end = pts[pts.length - 1];
  const cap = Array.from({ length: 7 }, (_, i) => {
    const ang = Math.atan2(ny0, nx0) - (i / 6) * Math.PI;
    return {
      x: end.x + Math.cos(ang) * end.r,
      y: end.y + Math.sin(ang) * end.r,
    };
  });
  const outline = [...left, ...cap, ...right];
  fx.g.fillStyle(LILAC, a * 0.5).fillPoints(outline, true);
  fx.g.lineStyle(2.5, 0xf2ecff, a * 0.9).strokePoints(outline, true);
  fx.g.lineStyle(6, 0xffffff, a * 0.35).strokePoints(
    pts.map((q) => ({
      x: q.x + nx0 * q.r * 0.45,
      y: q.y + ny0 * q.r * 0.45 - 2,
    })),
    false,
  );
  // soft folds across it
  for (const s of [0.3, 0.5, 0.7]) {
    const q = pts[Math.round(s * 13)];
    const nx = -dy / len,
      ny = dx / len;
    fx.g.lineStyle(2, INK, a * 0.5).strokePoints(
      [
        { x: q.x + nx * q.r * 0.8, y: q.y + ny * q.r * 0.8 },
        { x: q.x + (dx / len) * 4, y: q.y + (dy / len) * 4 },
        { x: q.x - nx * q.r * 0.8, y: q.y - ny * q.r * 0.8 },
      ],
      false,
    );
  }
  const tip = pts[pts.length - 1];
  fx.g
    .fillStyle(ROSE, a * 0.7)
    .fillEllipse(tip.x, tip.y, tip.r * 1.6, tip.r * 1.1);
  glow(tip.x, tip.y, 26 + 10 * k, LILAC, 0.45 * k);
}
/** The Trunk Slam lands: the dream-trunk lies along the lane, stars burst up, dust puffs. */
function slam(
  fx: SnoozakuFx,
  glow: Glow,
  c: BossCast,
  age: number,
  seed: number,
  low: boolean,
) {
  const u = clamp(age / 1.3),
    fade = (1 - u) * (1 - u);
  const w = {
    x: c.x,
    y: c.y,
    tx: c.tx,
    ty: c.ty,
    radius: c.radius,
  } as RaidWarning;
  if (age < 0.6) dreamTrunk(fx, glow, w, 1, clamp(age / 0.6));
  const n = low ? 4 : 7;
  for (let i = 0; i < n; i++) {
    const s = (i + 0.5) / n,
      x = c.x + (c.tx - c.x) * s,
      y = c.y + (c.ty - c.y) * s;
    const t = clamp((age - s * 0.18) / 0.9);
    if (t <= 0 || t >= 1) continue;
    cloud(fx, x, y, 16 + 18 * t, 0xd9cdf6, 0.45 * (1 - t), seed + i);
    for (let j = 0; j < 2; j++) {
      const a = -Math.PI / 2 + (hash(seed + i * 5 + j) - 0.5) * 1.6;
      const d = easeOut(t) * (30 + hash(seed + i + j * 7) * 40);
      star(
        fx.g,
        x + Math.cos(a) * d,
        y + Math.sin(a) * d,
        5 * (1 - t) + 1.5,
        j ? GOLD : HOT,
        1 - t,
        t * 4,
      );
    }
  }
  // the tip's ripple, inside the lane's width
  const R = Math.min(c.radius, 57) * (0.35 + 0.65 * easeOut(clamp(age / 0.5)));
  fx.floor
    .lineStyle(3, LILAC, fade * 0.8)
    .strokeEllipse(c.tx, c.ty, R * 2, R * 2 * FLAT);
  glow(c.tx, c.ty, 50, LILAC, 0.5 * fade, true);
}
/** A shooting star on its way to its mark: a glittering trail behind it. */
function fallingStar(
  fx: SnoozakuFx,
  glow: Glow,
  w: RaidWarning,
  p: number,
  low: boolean,
) {
  if (p < 0.3) return;
  const k = clamp((p - 0.3) / 0.7),
    fall = k * k;
  const sx = w.x + 120 * (1 - fall),
    sy = w.y - 300 * (1 - fall);
  const trail = low ? 4 : 8;
  for (let i = trail; i >= 1; i--) {
    const s = i / trail,
      back = Math.max(0, fall - s * 0.12);
    const x = w.x + 120 * (1 - back),
      y = w.y - 300 * (1 - back);
    sparkle(fx.g, x, y, 5 * (1 - s) + 1, i % 2 ? GOLD : HOT, (1 - s) * 0.85, i);
  }
  star(fx.g, sx, sy, 11, GOLD, 1);
  star(fx.g, sx, sy, 6, HOT, 1);
  glow(sx, sy, 30, GOLD, 0.6);
}
/** A star lands: a burst of rays and sparkles inside its mark. */
function starBurst(
  fx: SnoozakuFx,
  glow: Glow,
  c: BossCast,
  age: number,
  seed: number,
  low: boolean,
) {
  const u = clamp(age / 1.1),
    fade = (1 - u) * (1 - u);
  const R = Math.min(c.radius, 64);
  glow(c.x, c.y, R * 1.1, GOLD, 0.6 * fade, true);
  glow(c.x, c.y - 10, 30, HOT, 0.7 * fade);
  const rr = R * (0.3 + 0.7 * easeOut(clamp(age / 0.4)));
  fx.floor
    .lineStyle(3, GOLD, fade)
    .strokeEllipse(c.x, c.y, rr * 2, rr * 2 * FLAT);
  const n = low ? 5 : 9;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + hash(seed) * TAU,
      d = easeOut(u) * R * 0.95;
    sparkle(
      fx.g,
      c.x + Math.cos(a) * d,
      c.y + Math.sin(a) * d * FLAT - 10 * (1 - u),
      7 * (1 - u) + 1,
      i % 2 ? GOLD : HOT,
      1 - u,
      a,
    );
  }
}
/**
 * The Thunder Snore: soft sound waves roll out from the baku every half
 * second while the warning lasts, with Zs riding them; never inside the
 * Quiet Zone.
 */
function snore(
  fx: SnoozakuFx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  w: RaidWarning,
  low: boolean,
) {
  const r = state.raid!;
  const q = r.quietZone ? quietZoneAt(r.quietZone, state.time) : null;
  const qr = r.quietZone?.radius ?? 0;
  const start = w.startedAt ?? w.at - 4;
  const t = state.time - start;
  const head = { x: boss.x, y: boss.y + SNOOZAKU_FEET - 90 };
  glow(head.x, head.y, 34 + 8 * Math.sin(t * 11), LILAC, 0.45);
  const inQuiet = (x: number, y: number) =>
    !!q && Math.hypot(x - q.x, y - q.y) < qr + 10;
  for (let k = 0; k < 4; k++) {
    const age = (((t - k * 0.5) % 2) + 2) % 2;
    if (t - k * 0.5 < 0 || age > 1.8) continue;
    const R = 40 + age * 360,
      a = (1 - age / 1.8) * 0.55;
    const steps = low ? 36 : 64;
    let run: { x: number; y: number }[] = [];
    const flush = () => {
      if (run.length > 1) {
        fx.g.lineStyle(7, LILAC, a * 0.35).strokePoints(run, false);
        fx.g.lineStyle(2.5, 0xf4efff, a).strokePoints(run, false);
      }
      run = [];
    };
    for (let i = 0; i <= steps; i++) {
      const ang = (i / steps) * TAU;
      const x = head.x + Math.cos(ang) * R,
        y =
          boss.y +
          Math.sin(ang) * R * FLAT +
          (head.y - boss.y) * (1 - age / 1.8);
      if (inQuiet(x, y)) flush();
      else run.push({ x, y });
    }
    flush();
    for (let i = 0; i < (low ? 3 : 6); i++) {
      const ang = (i / 6) * TAU + k * 0.9;
      const x = head.x + Math.cos(ang) * R,
        y =
          boss.y +
          Math.sin(ang) * R * FLAT +
          (head.y - boss.y) * (1 - age / 1.8) -
          12;
      if (!inQuiet(x, y)) zee(fx.g, x, y, 0.9 + age * 0.3, 0xf4efff, a * 1.4);
    }
  }
}
/** The baku's own moments: a yawn into a new phase, woken, staggered, beaten, a Nightmare. */
function moments(
  fx: SnoozakuFx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  mine: Memory,
  dt: number,
  low: boolean,
  nightmares: number,
) {
  const r = state.raid!;
  const exposed = r.exposedUntil > state.time,
    stagger = r.staggerUntil > state.time,
    dead = r.result === "victory" || boss.hp <= 0;
  const add = (kind: MomentKind) =>
    mine.moments.push({
      kind,
      age: 0,
      x: boss.x,
      y: boss.y + SNOOZAKU_FEET,
      seed: ++mine.count * 13,
    });
  if (r.phase > mine.phase && !dead) add("roar");
  if (exposed && !mine.exposed && !stagger) add("woken");
  if (stagger && !mine.staggered) add("stagger");
  if (dead && !mine.dead) add("defeat");
  if (nightmares > mine.nights) add("nightmare");
  mine.phase = r.phase;
  mine.exposed = exposed;
  mine.staggered = stagger;
  mine.dead = dead;
  mine.nights = nightmares;
  mine.moments = mine.moments.filter(
    (m) => (m.age += dt) < MOMENT_LIFE[m.kind],
  );
  for (const m of mine.moments) {
    const u = m.age / MOMENT_LIFE[m.kind],
      fade = 1 - u;
    const hx = m.x,
      hy = m.y - 110;
    if (m.kind === "roar") {
      // the yawn: stars and Zs spill out of the cap
      glow(hx, hy - 40, 40 + 30 * u, GOLD, 0.55 * fade);
      for (let i = 0; i < (low ? 6 : 12); i++) {
        const a = (i / 12) * TAU + m.seed,
          d = easeOut(u) * (70 + hash(m.seed + i) * 60);
        const x = hx + Math.cos(a) * d,
          y = hy - 40 + Math.sin(a) * d * 0.7 - u * 30;
        if (i % 3 === 0) zee(fx.g, x, y, 0.8, IVORY, fade);
        else star(fx.g, x, y, 6 * fade + 1, i % 2 ? GOLD : HOT, fade, u * 3);
      }
    } else if (m.kind === "woken") {
      // a pop of light from the star-heart
      const R = 20 + 60 * easeOut(u);
      fx.g.lineStyle(3, ROSE, fade).strokeCircle(m.x, m.y - 30, R);
      glow(m.x, m.y - 30, 30 + 30 * u, ROSE, 0.6 * fade);
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * TAU;
        sparkle(
          fx.g,
          m.x + Math.cos(a) * R,
          m.y - 30 + Math.sin(a) * R,
          6 * fade + 1,
          HOT,
          fade,
          a,
        );
      }
    } else if (m.kind === "stagger") {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * TAU + m.seed,
          d = easeOut(u) * 70;
        star(
          fx.g,
          hx + Math.cos(a) * d,
          hy + Math.sin(a) * d * 0.6,
          6 * fade + 1,
          GOLD,
          fade,
          u * 5,
        );
      }
    } else if (m.kind === "defeat") {
      // curling up: a sleepy cloud settles round it, Zs float up
      cloud(
        fx,
        m.x,
        m.y - 10,
        50 + 20 * u,
        0xd9cdf6,
        0.35 * Math.sin(u * Math.PI),
        m.seed,
      );
      for (let i = 0; i < (low ? 2 : 4); i++) {
        const v = (u * 1.6 + i / 4) % 1;
        zee(
          fx.g,
          m.x + 40 + Math.sin(v * 6 + i) * 10,
          m.y - 120 - v * 70,
          0.8 + v * 0.5,
          IVORY,
          Math.sin(v * Math.PI) * fade,
        );
      }
    } else if (m.kind === "nightmare") {
      // jolted awake: a dark puff and crackling violet sparks
      cloud(fx, m.x, m.y - 50, 40 + 50 * u, NIGHT, 0.55 * fade, m.seed);
      glow(m.x, m.y - 50, 60, 0x9a62ff, 0.5 * fade);
      for (let i = 0; i < (low ? 5 : 10); i++) {
        const a = (i / 10) * TAU + m.seed,
          d = 40 + easeOut(u) * 90;
        const x = m.x + Math.cos(a) * d,
          y = m.y - 50 + Math.sin(a) * d * 0.7;
        fx.g.lineStyle(2.5, 0xc59bff, fade).strokePoints(
          [
            { x, y },
            { x: x + Math.cos(a + 0.6) * 8, y: y + Math.sin(a + 0.6) * 8 },
            { x: x + Math.cos(a) * 16, y: y + Math.sin(a) * 16 },
          ],
          false,
        );
      }
    }
  }
}

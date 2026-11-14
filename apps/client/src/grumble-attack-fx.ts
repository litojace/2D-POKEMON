/**
 * Cragmuff's attack effects in battle (the "grumblecrag" raid; first made
 * for the stone golem's vector demo, 9 Nov): dust, flying rocks, cracks, shock
 * rings, debris, embers, lava geysers and the shared meteor, growing hotter
 * with each phase. They replace the shared boss cast effect (rings, ribbons
 * and the spell flipbook) for this boss only.
 *
 * The server's warnings stay exactly as drawn by raid-ui.ts (the damage
 * footprint, readable without colour); these are presentation only. Shock
 * rings and cracks stay inside the warning's footprint, as for every boss.
 *
 * What comes before a hit (the volley's stones in the air, the meteor
 * forming and falling) is drawn from the warning counting down; the hit
 * itself from the cast (boss-performance.ts), which this module keeps for
 * as long as its effect lasts. Everything else is worked out from the cast's
 * id and age, so nothing random changes from frame to frame.
 */
import type Phaser from "phaser";
import { OBSTACLES, type Fighter, type Snapshot } from "@arena/shared";
import type { RaidWarning } from "../../../packages/shared/src/raid";
import type { BossCast } from "./boss-performance";
import type { Fx } from "./fx-engine";
import { CRYSTAL, ROCK, type Phase } from "./boss-vector-grumble";
import { CRAGMUFF_FEET as GRUMBLE_FEET } from "./boss-cragmuff";

type Glow = (
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  floor?: boolean,
) => void;
type G = Phaser.GameObjects.Graphics;

const TAU = Math.PI * 2;
/** The floor's flattening: a circle on the ground seen from the camera. */
const FLAT = 0.58;
/** Dust: a sandy cloud, dark enough to read on the light stone floor. */
const DUST = 0x9c8a72;
/** The soft sprite's light falls off fast: clouds need a wide one, fairly opaque. */
function cloud(fx: Fx, x: number, y: number, r: number, alpha: number) {
  if (alpha <= 0) return;
  fx.soft(x, y, r * 1.9, DUST, Math.min(1, alpha * 2.6), 0.8);
  fx.floorSolid
    .fillStyle(DUST, Math.min(1, alpha * 0.8))
    .fillEllipse(x, y + 4, r * 1.5, r * 0.75);
}
const hex = (s: string) => parseInt(s.slice(1), 16);
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const easeOut = (u: number) => 1 - (1 - u) * (1 - u) * (1 - u);
const easeIn = (u: number) => u * u * u;
const hash = (n: number) => {
  const a = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return a - Math.floor(a);
};

/** How long each hit's effect lasts (s). */
const LIFE: Partial<Record<RaidWarning["kind"], number>> = {
  slam: 1.5,
  charge: 2.4,
  volley: 1.1,
  eruption: 1.25,
  share: 1.7,
  debris: 1.3,
};
interface Hit {
  cast: BossCast;
  /** Seconds since it landed; stands still while the game is paused. */
  age: number;
  /** The server's time when it landed: the age never runs ahead of the server. */
  landed: number;
  /** Charge: where the boss has been (for the dust trail), and where it stopped (at those ages). */
  trail?: { x: number; y: number; at: number }[];
  stop?: { x: number; y: number; at: number };
  /** Charge: it stopped against a pillar (that just broke) rather than skidding out. */
  crash?: boolean;
}
/**
 * Moments of the boss itself (from the demo): the roar into a new phase, a
 * hit's chips, the stagger cracking it open, and its death.
 */
type MomentKind = "roar" | "hurt" | "stagger" | "defeat";
interface Moment {
  kind: MomentKind;
  age: number;
  landed: number;
  /** Where its feet were then. */
  x: number;
  y: number;
  seed: number;
}
const MOMENT_LIFE: Record<MomentKind, number> = {
  roar: 1.7,
  hurt: 0.9,
  stagger: 1.4,
  defeat: 2.4,
};
/** At most one burst of chips this often (raiders hit all the time). */
const HURT_EVERY = 0.45;
interface Memory {
  last: number;
  map: Map<number, Hit>;
  moments: Moment[];
  phase: number;
  hp: number;
  staggered: boolean;
  dead: boolean;
  hurtAt: number;
  count: number;
}
const hits = new WeakMap<Fx, Memory>();

interface Palette {
  rock: number;
  rockLight: number;
  rockLine: number;
  hot: number;
  glow: number;
  phase: Phase;
}
function palette(phase: number): Palette {
  const p = clamp(Math.round(phase), 1, 3) as Phase;
  return {
    rock: hex(ROCK[p].mid),
    rockLight: hex(ROCK[p].light),
    rockLine: hex(ROCK[p].line),
    hot: hex(CRYSTAL[p].mid),
    glow: CRYSTAL[p].glow,
    phase: p,
  };
}

/** Cragmuff's fleece, for the tufts a hit knocks off (drawn like the chips). */
const WOOL: Palette = {
  rock: 0xb9ae94,
  rockLight: 0xf3ecda,
  rockLine: 0x4f4636,
  hot: 0xffb43c,
  glow: 0xffbe50,
  phase: 1,
};
/** One rock: a lumpy outline, a lit top, a dark rim. */
function rock(
  g: G,
  x: number,
  y: number,
  r: number,
  seed: number,
  turn: number,
  pal: Palette,
  alpha = 1,
) {
  if (r <= 0.5 || alpha <= 0) return;
  const points = Array.from({ length: 7 }, (_, i) => {
    const a = turn + (i / 7) * TAU,
      k = 0.72 + hash(seed + i * 3.1) * 0.38;
    return { x: x + Math.cos(a) * r * k, y: y + Math.sin(a) * r * k * 0.9 };
  });
  g.fillStyle(pal.rock, alpha).fillPoints(points, true);
  g.lineStyle(Math.max(1, r * 0.16), pal.rockLine, alpha).strokePoints(
    points,
    true,
    true,
  );
  g.fillStyle(pal.rockLight, alpha * 0.55).fillEllipse(
    x - r * 0.22,
    y - r * 0.3,
    r * 0.9,
    r * 0.5,
  );
}

/**
 * A hit on the ground: cracks, a shock ring, a flash, dust, debris and (from
 * phase 2) embers. `reach` is the warning's radius: rings and cracks stay
 * inside it.
 */
function impact(
  fx: Fx,
  glow: Glow,
  x: number,
  y: number,
  reach: number,
  size: number,
  age: number,
  seed: number,
  pal: Palette,
  low: boolean,
) {
  if (age < 0) return;
  const many = low ? 0.5 : 1;
  const R = Math.max(30, reach);
  // Cracks: dark lines raced out from the centre, hot inside from phase 2.
  const crackLife = 1.4,
    crackFade = clamp(1 - age / crackLife);
  if (crackFade > 0) {
    const reveal = easeOut(clamp(age / 0.18));
    const count = Math.round(5 + 3 * size);
    for (let i = 0; i < count; i++) {
      const a = hash(seed + i) * TAU,
        len = R * (0.45 + hash(seed + i + 40) * 0.45) * reveal;
      const points = [{ x, y }];
      for (let s = 1; s <= 4; s++) {
        const d = (len * s) / 4,
          wob = (hash(seed + i * 7 + s) - 0.5) * 0.5;
        points.push({
          x: x + Math.cos(a + wob) * d,
          y: y + Math.sin(a + wob) * d * FLAT,
        });
      }
      fx.floorSolid
        .lineStyle(6 * size, 0x140a06, 0.7 * crackFade)
        .strokePoints(points, false);
      if (pal.phase >= 2 || age < 0.4)
        fx.floor
          .lineStyle(
            2.5 * size,
            pal.phase >= 2 ? pal.hot : 0xffc85a,
            0.6 * crackFade,
          )
          .strokePoints(points, false);
    }
  }
  // The shock ring, within the footprint.
  const k = easeOut(clamp(age / 0.55)),
    ringFade = 1 - clamp(age / 0.55);
  if (ringFade > 0) {
    const rr = R * 0.95 * k;
    fx.floor
      .lineStyle(12 * size * (1 - k) + 1, 0xffaa50, ringFade * 0.75)
      .strokeEllipse(x, y, rr * 2, rr * 2 * FLAT);
    fx.floor
      .lineStyle(2, 0xfff0c8, ringFade * 0.9)
      .strokeEllipse(x, y, rr * 2, rr * 2 * FLAT);
  }
  // The flash where it struck.
  const flash = 1 - clamp(age / 0.3);
  if (flash > 0) glow(x, y, R * 0.7 * size, pal.glow, flash * 0.7, true);
  // Dust thrown out and settling.
  const dustLife = 1.1,
    du = clamp(age / dustLife);
  if (du < 1)
    for (let i = 0; i < Math.round(10 * size * many); i++) {
      const a = hash(seed + i + 70) * TAU,
        d = R * (0.25 + 0.6 * easeOut(du)) * (0.7 + hash(seed + i) * 0.4);
      cloud(
        fx,
        x + Math.cos(a) * d,
        y + Math.sin(a) * d * FLAT - 8,
        (16 + age * 34) * size,
        0.34 * (1 - du),
      );
    }
  // Debris: chips of rock in arcs, landing and fading.
  for (let i = 0; i < Math.round(8 * size * many); i++) {
    const a = hash(seed + i + 110) * TAU,
      v = 110 + hash(seed + i + 130) * 150,
      up = 170 + hash(seed + i + 150) * 120;
    const t = Math.min(age, (2 * up) / 620);
    const h = Math.max(0, up * t - 310 * t * t);
    const fade = 1 - clamp((age - 0.9) / 0.4);
    if (fade <= 0) continue;
    const px = x + Math.cos(a) * v * t,
      py = y + Math.sin(a) * v * t * FLAT;
    fx.floorSolid.fillStyle(0x050302, 0.22 * fade).fillEllipse(px, py, 10, 5);
    rock(
      fx.solid,
      px,
      py - h,
      (4 + hash(seed + i + 170) * 5) * size,
      seed + i,
      age * 6 * (hash(seed + i) - 0.5),
      pal,
      fade,
    );
  }
  // Embers rising (phase 2 and 3).
  if (pal.phase >= 2) {
    const eu = clamp(age / 1.2);
    if (eu < 1)
      for (let i = 0; i < Math.round(9 * size * many); i++) {
        const a = hash(seed + i + 190) * TAU,
          d = R * 0.5 * hash(seed + i + 210);
        const ex = x + Math.cos(a) * d + Math.sin(age * 5 + i) * 6,
          ey = y + Math.sin(a) * d * FLAT - (20 + age * (80 + hash(i) * 70));
        fx.g.fillStyle(0xffb450, 1 - eu).fillCircle(ex, ey, 2.4);
        glow(ex, ey, 12, 0xff8c3c, (1 - eu) * 0.5);
      }
  }
}

/**
 * What this frame drew, by effect (for tests and the perf notes): stones in
 * the air and stones stopped by pillars, wool tufts, cracks racing to an
 * eruption, crystal spikes, the meteor, roof debris, ring crystals, a miss's
 * scrape marks, a pillar crash's shards.
 */
export const cragmuffFx = {
  stones: 0,
  stopped: 0,
  wool: 0,
  cracks: 0,
  spikes: 0,
  meteor: 0,
  debris: 0,
  ring: 0,
  scrape: 0,
  crash: 0,
};
// ───────────────────────── Cragmuff's crystal pieces (from the ram demo) ─────────────────────────
const AMBER = { lit: 0xffe07e, mid: 0xffb43c, dark: 0xa9500b, line: 0x5a2206 };
const backOut = (t: number) => {
  const s = 1.70158;
  t -= 1;
  return t * t * ((s + 1) * t + s) + 1;
};
/**
 * A faceted amber crystal point from (x, y) along (dx, dy): a lit facet and
 * a shaded one either side of the ridge, a dark edge. Drawn on `g`.
 */
function crystal(
  g: G,
  x: number,
  y: number,
  dx: number,
  dy: number,
  len: number,
  w: number,
  alpha = 1,
) {
  if (len <= 1 || alpha <= 0) return;
  const nx = -dy,
    ny = dx;
  const sh = { x: x + dx * len * 0.62, y: y + dy * len * 0.62 },
    tip = { x: x + dx * len, y: y + dy * len };
  const l0 = { x: x + nx * w, y: y + ny * w },
    l1 = { x: sh.x + nx * w * 0.92, y: sh.y + ny * w * 0.92 },
    r0 = { x: x - nx * w, y: y - ny * w },
    r1 = { x: sh.x - nx * w * 0.92, y: sh.y - ny * w * 0.92 };
  // the facet toward the upper left catches the light
  const litLeft = nx * -0.6 + ny * -0.8 > 0;
  g.fillStyle(litLeft ? AMBER.lit : AMBER.dark, alpha).fillPoints(
    [l0, l1, tip, { x, y }],
    true,
  );
  g.fillStyle(litLeft ? AMBER.dark : AMBER.lit, alpha).fillPoints(
    [r0, r1, tip, { x, y }],
    true,
  );
  g.fillStyle(AMBER.mid, alpha * 0.55).fillPoints(
    [
      { x: (l0.x + x) / 2, y: (l0.y + y) / 2 },
      { x: (l1.x + sh.x) / 2, y: (l1.y + sh.y) / 2 },
      tip,
      { x: (r1.x + sh.x) / 2, y: (r1.y + sh.y) / 2 },
      { x: (r0.x + x) / 2, y: (r0.y + y) / 2 },
    ],
    true,
  );
  g.lineStyle(Math.max(1, w * 0.3), AMBER.line, alpha).strokePoints(
    [l0, l1, tip, r1, r0],
    true,
    true,
  );
}
/** Crystal spikes bursting from the floor (an eruption): up fast with an overshoot, then sinking. */
function spikes(
  fx: Fx,
  glow: Glow,
  x: number,
  y: number,
  age: number,
  seed: number,
  size: number,
  low: boolean,
) {
  const life = 1.15;
  if (age < 0 || age > life) return;
  cragmuffFx.spikes++;
  const up = backOut(clamp(age / 0.22)),
    down = clamp((age - (life - 0.5)) / 0.5);
  const list: [number, number, number][] = low
    ? [
        [-14, 0.8, -0.3],
        [0, 1, 0],
        [14, 0.75, 0.32],
      ]
    : [
        [-22, 0.62, -0.42],
        [-9, 1, -0.12],
        [6, 0.86, 0.18],
        [20, 0.58, 0.46],
        [-1, 0.5, 0.02],
      ];
  // a heap of broken floor at their foot
  fx.floorSolid
    .fillStyle(0x3a2e22, 0.45 * (1 - down))
    .fillEllipse(x, y + 4, 70 * size, 26 * size);
  for (const [i, [ox, f, lean]] of list.entries()) {
    const len =
      72 * f * size * up * (1 - down * 0.8) * (0.9 + hash(seed + i) * 0.2);
    crystal(
      fx.solid,
      x + ox * size,
      y + 2 + down * 20,
      Math.sin(lean),
      -Math.cos(lean),
      len,
      11 * (0.6 + f * 0.5) * size,
      1 - down * 0.8,
    );
  }
  if (age < 0.6)
    glow(x, y - 30 * size, 70 * size, AMBER.mid, (1 - age / 0.6) * 0.75);
}
/**
 * A glowing crack racing over the floor from the ram's hooves toward an
 * eruption's mark (`u` 0..1 of the way). Its bright tip is a warning:
 * essential, never shrunk on Low.
 */
function crackRace(
  fx: Fx,
  glow: Glow,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  u: number,
  fade: number,
  seed: number,
) {
  if (u <= 0 || fade <= 0) return;
  cragmuffFx.cracks++;
  const dx = x1 - x0,
    dy = y1 - y0,
    l = Math.hypot(dx, dy) || 1;
  const n = Math.max(2, Math.round(10 * u));
  const pts = [{ x: x0, y: y0 }];
  for (let i = 1; i <= n; i++) {
    const f = (i / n) * u,
      j = i < n ? (hash(seed + i) - 0.5) * 18 : 0;
    pts.push({ x: x0 + dx * f - (dy / l) * j, y: y0 + dy * f + (dx / l) * j });
  }
  fx.floorSolid.lineStyle(6, 0x1e140c, 0.8 * fade).strokePoints(pts, false);
  fx.floor.lineStyle(2.4, AMBER.mid, 0.9 * fade).strokePoints(pts, false);
  const tip = pts[pts.length - 1];
  if (u < 1)
    fx.essential(() => glow(tip.x, tip.y, 20, AMBER.mid, 0.75 * fade, true));
}
/** Does the line from (x0, y0) to (x1, y1) meet a standing pillar's footprint? Where it first does. */
function pillarStop(
  r: NonNullable<Snapshot["raid"]>,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
) {
  let best: { t: number; x: number; y: number } | undefined;
  OBSTACLES.forEach((o, i) => {
    if (r.pillars[i]?.broken) return;
    for (let k = 1; k <= 32; k++) {
      const t = k / 32,
        x = x0 + (x1 - x0) * t,
        y = y0 + (y1 - y0) * t;
      if (x > o.x && x < o.x + o.w && y > o.y && y < o.y + o.h) {
        if (!best || t < best.t) best = { t, x, y };
        break;
      }
    }
  });
  return best;
}

/**
 * The volley's stones: where they leave the boss's fist and where they land.
 * The cone is long (most of the court), so they fall all along it, on the
 * court, not only at its far end.
 */
const STONES = 7;
function volleyStones(w: {
  id: number;
  x: number;
  y: number;
  tx: number;
  ty: number;
  radius: number;
  spread?: number;
}) {
  const aim = Math.atan2(w.ty - w.y, w.tx - w.x),
    spread = w.spread ?? 0.45;
  return Array.from({ length: STONES }, (_, i) => {
    const across = (i / (STONES - 1)) * 2 - 1,
      a = aim + across * spread * 0.8 + (hash(w.id + i) - 0.5) * 0.08,
      d = w.radius * (0.25 + hash(w.id + i + 20) * 0.6);
    // shaken out of the fleece all round its top, flung down the cone
    const from = (hash(w.id + i + 100) - 0.5) * 1.6;
    return {
      fromX: w.x + Math.cos(aim + from) * 40,
      fromY: w.y + Math.sin(aim + from) * 40 * FLAT,
      toX: clamp(w.x + Math.cos(a) * d, 90, 1510),
      toY: clamp(w.y + Math.sin(a) * d, 90, 810),
      flight: 0.45 + hash(w.id + i + 40) * 0.2,
      lob: 90 + hash(w.id + i + 60) * 60,
      r: 11 + hash(w.id + i + 80) * 7,
      seed: w.id * 13 + i,
    };
  });
}

/** Before the volley lands: its stones in the air. */
function volleyFlight(
  fx: Fx,
  glow: Glow,
  w: RaidWarning,
  now: number,
  pal: Palette,
  r: NonNullable<Snapshot["raid"]>,
  low: boolean,
) {
  // the wet-dog shake: tufts of stone wool flung off as the stones leave
  const shake = now - (w.at - 0.5);
  if (shake > 0 && shake < 0.7)
    for (let i = 0; i < (low ? 3 : 6); i++) {
      const a = hash(w.id + i + 300) * TAU,
        v = 70 + hash(w.id + i + 310) * 60,
        t = shake;
      const h = 110 + 150 * t - 300 * t * t;
      if (h < 0) continue;
      cragmuffFx.wool++;
      rock(
        fx.solid,
        w.x + Math.cos(a) * v * t,
        w.y + Math.sin(a) * v * t * FLAT - h,
        6 + hash(w.id + i) * 3,
        w.id + i,
        t * 4,
        WOOL,
        1 - t / 0.7,
      );
    }
  for (const [i, s0] of volleyStones(w).entries()) {
    if (low && i % 2) continue;
    // a standing pillar stops a stone at its footprint (hide behind pillars)
    const stop = pillarStop(r, w.x, w.y, s0.toX, s0.toY);
    const s = stop ? { ...s0, toX: stop.x, toY: stop.y } : s0;
    const depart = w.at - s.flight - (STONES - 1 - i) * 0.025,
      u = (now - depart) / s.flight;
    if (u < 0 || u > 1) continue;
    cragmuffFx.stones++;
    if (stop) cragmuffFx.stopped++;
    const x = s.fromX + (s.toX - s.fromX) * u,
      y = s.fromY + (s.toY - s.fromY) * u,
      h = 125 * (1 - u) + Math.sin(u * Math.PI) * s.lob;
    fx.floorSolid
      .fillStyle(0x050302, 0.25)
      .fillEllipse(x, y, s.r * 1.8, s.r * 0.9);
    rock(fx.solid, x, y - h, s.r, s.seed, u * 5, pal);
    if (pal.phase >= 2) glow(x, y - h, s.r * 2.2, 0xff8c3c, 0.35);
  }
}

/** Before the meteor falls: it forms over its mark, then drops. */
function meteorFall(
  fx: Fx,
  glow: Glow,
  w: RaidWarning,
  now: number,
  pal: Palette,
) {
  const form = 1.05,
    fall = 0.45;
  const formed = clamp((now - (w.at - form - fall)) / form);
  if (formed <= 0 || now >= w.at) return;
  cragmuffFx.meteor++;
  const u = clamp((now - (w.at - fall)) / fall);
  const h = 300 * (1 - easeIn(u)),
    r = 34 * easeOut(formed);
  fx.floorSolid
    .fillStyle(0x050302, 0.35 * formed)
    .fillEllipse(w.x, w.y, (30 + 60 * u) * 2, (30 + 60 * u) * 2 * FLAT);
  // forming over its mark: a warning, its light never shrunk on Low
  fx.essential(() => glow(w.x, w.y - h, r * 3, AMBER.mid, 0.85 * formed));
  if (u > 0)
    for (let i = 0; i < 3; i++)
      fx.g
        .lineStyle(3 - i * 0.8, 0xffd690, 0.55 * u)
        .lineBetween(
          w.x + (i - 1) * r * 0.5,
          w.y - h - r,
          w.x + (i - 1) * r * 0.4,
          w.y - h - r - 120 * u,
        );
  // a stone boulder with amber crystals growing out of it
  rock(fx.solid, w.x, w.y - h, r, w.id * 7, now * 0.8, pal);
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.55 + now * 0.8;
    crystal(
      fx.solid,
      w.x + Math.cos(a) * r * 0.55,
      w.y - h + Math.sin(a) * r * 0.5,
      Math.cos(a),
      Math.sin(a),
      r * (i === 2 ? 0.95 : 0.7),
      r * 0.2,
    );
  }
}
/** Rocks dropping from the cave roof onto a debris mark: a growing shadow, then the fall. */
function debrisFall(
  fx: Fx,
  glow: Glow,
  w: RaidWarning,
  now: number,
  pal: Palette,
) {
  const start = w.startedAt ?? w.at - 1.45,
    p = clamp((now - start) / Math.max(0.1, w.at - start));
  if (p <= 0 || now >= w.at) return;
  cragmuffFx.debris++;
  const size = w.radius > 110 ? 1.6 : 1.1;
  fx.floorSolid
    .fillStyle(0x050302, 0.35 * p)
    .fillEllipse(w.x, w.y, 52 * size * p, 22 * size * p);
  const fall = clamp((p - 0.6) / 0.4);
  if (fall > 0)
    rock(
      fx.solid,
      w.x,
      w.y - (1 - fall * fall) * 520,
      13 * size,
      w.id * 5,
      fall * 3,
      pal,
    );
}
/** Chapter 3's closing ring: amber crystal clusters standing on the ring. */
function closingSpikes(fx: Fx, glow: Glow, radius: number, low: boolean) {
  const n = low ? 6 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU + 0.31,
      x = 800 + Math.cos(a) * (radius + 8),
      y = 450 + Math.sin(a) * (radius + 8);
    if (x < 40 || x > 1560 || y < 50 || y > 880) continue;
    cragmuffFx.ring++;
    for (const [ox, f, lean] of [
      [-9, 0.7, -0.35],
      [0, 1, 0.05],
      [9, 0.6, 0.4],
    ] as const)
      crystal(
        fx.solid,
        x + ox,
        y,
        Math.sin(lean),
        -Math.cos(lean),
        26 * f,
        5.5 * f,
      );
  }
}
/** Amber shards flung out and falling (the meteor's landing, a pillar crash). */
function shards(
  fx: Fx,
  glow: Glow,
  x: number,
  y: number,
  age: number,
  seed: number,
  count: number,
  power: number,
) {
  for (let i = 0; i < count; i++) {
    const a = hash(seed + i + 500) * TAU,
      v = (90 + hash(seed + i + 510) * 140) * power,
      up = (180 + hash(seed + i + 520) * 140) * power;
    const land = (2 * up) / 700,
      t = Math.min(age, land);
    const h = Math.max(0, up * t - 350 * t * t);
    const fade = 1 - clamp((age - land - 0.25) / 0.4);
    if (fade <= 0) continue;
    const px = x + Math.cos(a) * v * t,
      py = y + Math.sin(a) * v * t * FLAT,
      spin = a + age * 9 * (hash(seed + i) - 0.5);
    crystal(
      fx.solid,
      px,
      py - h,
      Math.cos(spin),
      Math.sin(spin),
      14 * power,
      3.6 * power,
      fade,
    );
  }
}

/**
 * Grumblecrag's attacks this frame. `casts` are the hits boss-performance.ts
 * saw land; `clock` is the scene's time in seconds.
 */
export function drawGrumbleAttacks(
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  casts: BossCast[],
  clock: number,
  low: boolean,
) {
  const r = state.raid;
  if (!r) return;
  for (const k of Object.keys(cragmuffFx) as (keyof typeof cragmuffFx)[])
    cragmuffFx[k] = 0;
  const pal = palette(r.phase);
  // Before the hits: stones in the air, the meteor forming and falling.
  for (const w of r.warnings) {
    if (w.casterId && w.casterId !== boss.id) continue;
    if (w.kind === "volley") volleyFlight(fx, glow, w, state.time, pal, r, low);
    else if (w.kind === "share") meteorFall(fx, glow, w, state.time, pal);
    else if (w.kind === "eruption") {
      const start = w.startedAt ?? w.at - 1.25,
        u = clamp(((state.time - start) / Math.max(0.1, w.at - start)) * 1.12);
      crackRace(fx, glow, boss.x, boss.y + GRUMBLE_FEET, w.x, w.y, u, 1, w.id);
    } else if (w.kind === "debris") debrisFall(fx, glow, w, state.time, pal);
  }
  if (r.closingRadius) closingSpikes(fx, glow, r.closingRadius, low);
  // The hits, each kept for as long as its effect lasts. Their clock stops
  // while the game is paused, so a paused frame stays as it was.
  let mine = hits.get(fx);
  if (!mine)
    hits.set(
      fx,
      (mine = {
        last: clock,
        map: new Map(),
        moments: [],
        phase: r.phase,
        hp: boss.hp,
        staggered: false,
        dead: boss.hp <= 0,
        hurtAt: -Infinity,
        count: 0,
      }),
    );
  const dt = state.phase === "paused" ? 0 : clamp(clock - mine.last, 0, 0.1);
  mine.last = clock;
  // Smooth with the frames, but never ahead of the server (a slow phone, a
  // pause), so what is drawn matches where the fight is.
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
  moments(fx, glow, state, boss, mine, dt, pal, low);
  for (const [id, hit] of mine.map) {
    const c = hit.cast,
      age = hit.age;
    if (age > (LIFE[c.kind] ?? 0)) {
      mine.map.delete(id);
      continue;
    }
    const seed = id * 17;
    if (c.kind === "slam") {
      impact(fx, glow, c.x, c.y, c.radius, 1.2, age, seed, pal, low);
      dustRing(fx, c.x, c.y, c.radius * 0.85, low ? 8 : 16, age, seed, 1.0);
    } else if (c.kind === "volley")
      for (const [i, s] of volleyStones(c).entries()) {
        if (low && i % 2) continue;
        const stop = pillarStop(r, c.x, c.y, s.toX, s.toY);
        impact(
          fx,
          glow,
          stop?.x ?? s.toX,
          stop?.y ?? s.toY,
          44,
          stop ? 0.5 : 0.6,
          age,
          s.seed,
          pal,
          true,
        );
      }
    else if (c.kind === "eruption") {
      spikes(fx, glow, c.x, c.y, age, seed, 1, low);
      impact(
        fx,
        glow,
        c.x,
        c.y,
        Math.min(c.radius, 70),
        0.55,
        age,
        seed,
        pal,
        true,
      );
    } else if (c.kind === "share") {
      impact(fx, glow, c.x, c.y, c.radius, 1.4, age, seed, pal, low);
      shards(fx, glow, c.x, c.y, age, seed, low ? 4 : 8, 1.2);
    } else if (c.kind === "debris")
      impact(
        fx,
        glow,
        c.x,
        c.y,
        c.radius,
        c.radius > 110 ? 1.1 : 0.8,
        age,
        seed,
        pal,
        low,
      );
    else if (c.kind === "charge") charge(fx, glow, hit, boss, pal, low, r);
  }
}

/** The charge: a dust trail and speed lines behind the boss, then the crash where it stops. */
function charge(
  fx: Fx,
  glow: Glow,
  hit: Hit,
  boss: Fighter,
  pal: Palette,
  low: boolean,
  r: NonNullable<Snapshot["raid"]>,
) {
  const age = hit.age,
    trail = (hit.trail ??= []);
  if (!hit.stop && age < 1.45) {
    const last = trail[trail.length - 1];
    if (!last || Math.hypot(boss.x - last.x, boss.y - last.y) > 18)
      trail.push({ x: boss.x, y: boss.y, at: age });
    // Still for a moment after setting off: it has hit something.
    else if (age > 0.2 && age - last.at > 0.12)
      hit.stop = { x: boss.x, y: boss.y, at: age };
  }
  if (!hit.stop && age >= 1.45) hit.stop = { x: boss.x, y: boss.y, at: age };
  for (const [i, p] of trail.entries()) {
    if (low && i % 2) continue;
    const u = clamp((age - p.at) / 0.75);
    if (u >= 1) continue;
    cloud(fx, p.x, p.y - 6, 18 + u * 26, 0.32 * (1 - u));
  }
  // Speed lines behind it while it runs.
  if (!hit.stop && trail.length > 1) {
    const a = trail[trail.length - 2],
      b = trail[trail.length - 1];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1,
      ux = (b.x - a.x) / d,
      uy = (b.y - a.y) / d;
    for (let i = 0; i < 4; i++) {
      // Spread across the run, side by side, at different heights.
      const h = 60 + hash(hit.cast.id + i + Math.floor(age * 20)) * 110,
        side = (i - 1.5) * 34;
      const sx = boss.x - uy * side,
        sy = boss.y + ux * side * FLAT - h;
      fx.g
        .lineStyle(2, 0xfff0dc, 0.5)
        .lineBetween(
          sx - ux * 40,
          sy - uy * 40 * FLAT,
          sx - ux * 130,
          sy - uy * 130 * FLAT,
        );
    }
  }
  if (!hit.stop) return;
  const since = age - hit.stop.at,
    ax = Math.cos(hit.cast.angle),
    ay = Math.sin(hit.cast.angle);
  if (hit.crash === undefined)
    hit.crash = !!r.pillars.some(
      (p) => p.broken && Math.hypot(p.x - hit.stop!.x, p.y - hit.stop!.y) < 150,
    );
  if (hit.crash) {
    // into a pillar: the crash, a burst of amber shards and dust
    if (since < 2) cragmuffFx.crash++;
    impact(
      fx,
      glow,
      hit.stop.x + ax * 40,
      hit.stop.y + ay * 40,
      100,
      1.15,
      since,
      hit.cast.id * 17,
      pal,
      low,
    );
    shards(
      fx,
      glow,
      hit.stop.x + ax * 50,
      hit.stop.y + ay * 50,
      since,
      hit.cast.id,
      low ? 5 : 10,
      1,
    );
    dustRing(
      fx,
      hit.stop.x,
      hit.stop.y,
      130,
      low ? 8 : 14,
      since,
      hit.cast.id,
      1.1,
    );
  } else {
    // a miss: it skids on, hooves scraping two marks into the floor
    const fade = 1 - clamp((since - 1.2) / 0.8);
    if (fade > 0) cragmuffFx.scrape++;
    if (fade > 0)
      for (const side of [-1, 1]) {
        const ox = -ay * side * 16,
          oy = ax * side * 16 * FLAT;
        fx.floorSolid
          .lineStyle(5, 0x46341f, 0.5 * fade)
          .lineBetween(
            hit.stop.x + ox - ax * 70,
            hit.stop.y + oy - ay * 70 * FLAT + GRUMBLE_FEET * 0.6,
            hit.stop.x + ox,
            hit.stop.y + oy + GRUMBLE_FEET * 0.6,
          );
      }
    dustRing(
      fx,
      hit.stop.x,
      hit.stop.y + GRUMBLE_FEET * 0.6,
      60,
      low ? 4 : 8,
      since,
      hit.cast.id,
      0.8,
    );
  }
}

/** The boss's own moments: noticed from the state, drawn for their life. */
function moments(
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  mine: Memory,
  dt: number,
  pal: Palette,
  low: boolean,
) {
  const r = state.raid!;
  const feetY = boss.y + GRUMBLE_FEET;
  const add = (kind: MomentKind) =>
    mine.moments.push({
      kind,
      age: 0,
      landed: state.time,
      x: boss.x,
      y: feetY,
      seed: 900 + ++mine.count * 31,
    });
  const dead = boss.hp <= 0 || r.result === "victory";
  const staggered = !dead && r.staggerUntil > state.time;
  if (r.phase > mine.phase && !dead) add("roar");
  if (staggered && !mine.staggered) add("stagger");
  if (dead && !mine.dead) add("defeat");
  else if (
    !dead &&
    boss.hp < mine.hp &&
    state.time - mine.hurtAt >= HURT_EVERY &&
    state.phase === "playing"
  ) {
    mine.hurtAt = state.time;
    add("hurt");
  }
  mine.phase = r.phase;
  mine.hp = boss.hp;
  mine.staggered = staggered;
  mine.dead = dead;
  for (const m of mine.moments)
    m.age = Math.max(m.age, Math.min(m.age + dt, state.time - m.landed + 0.1));
  mine.moments = mine.moments.filter((m) => m.age <= MOMENT_LIFE[m.kind]);
  const many = low ? 0.5 : 1;
  for (const m of mine.moments) {
    if (m.kind === "roar") roar(fx, glow, m, pal, low);
    // a hit knocks tufts of stone wool off Cragmuff's fleece
    else if (m.kind === "hurt")
      chips(fx, m.x, m.y, 115, Math.round(6 * many), m.age, m.seed, WOOL, 1.05);
    else if (m.kind === "stagger") {
      chips(fx, m.x, m.y, 90, Math.round(12 * many), m.age, m.seed, pal, 1.1);
      dustRing(fx, m.x, m.y, 150, Math.round(14 * many), m.age, m.seed, 1.2);
    } else if (m.kind === "defeat") {
      dustRing(fx, m.x, m.y, 230, Math.round(26 * many), m.age, m.seed, 2.0);
      chips(
        fx,
        m.x,
        m.y,
        100,
        Math.round(22 * many),
        m.age,
        m.seed + 7,
        pal,
        1.3,
      );
      if (pal.phase >= 2)
        embers(
          fx,
          glow,
          m.x,
          m.y,
          120,
          Math.round(20 * many),
          m.age,
          m.seed,
          1.8,
        );
    }
  }
}

/** Chips of rock bursting from the body (height h above the feet) and falling. */
function chips(
  fx: Fx,
  x: number,
  y: number,
  h0: number,
  count: number,
  age: number,
  seed: number,
  pal: Palette,
  power: number,
) {
  for (let i = 0; i < count; i++) {
    const a = hash(seed + i) * TAU,
      v = (60 + hash(seed + i + 3) * 120) * power,
      up = (90 + hash(seed + i + 5) * 140) * power;
    // Falls back to the floor (height 0), then lies there fading.
    const land = (up + Math.sqrt(up * up + 4 * 310 * h0)) / (2 * 310);
    const t = Math.min(age, land);
    const h = Math.max(0, h0 + up * t - 310 * t * t);
    const fade = 1 - clamp((age - land - 0.2) / 0.5);
    if (fade <= 0) continue;
    const px = x + Math.cos(a) * v * t,
      py = y + Math.sin(a) * v * t * FLAT;
    fx.floorSolid.fillStyle(0x050302, 0.2 * fade).fillEllipse(px, py, 10, 5);
    rock(
      fx.solid,
      px,
      py - h,
      5.5 + hash(seed + i + 7) * 5 * power,
      seed + i,
      age * 7 * (hash(seed + i + 9) - 0.5),
      pal,
      fade,
    );
  }
}

/** A ring of dust thrown out along the floor. */
function dustRing(
  fx: Fx,
  x: number,
  y: number,
  reach: number,
  count: number,
  age: number,
  seed: number,
  life: number,
) {
  const u = clamp(age / life);
  if (u >= 1) return;
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU + hash(seed + i) * 0.4,
      d = reach * (0.3 + 0.7 * easeOut(u)) * (0.75 + hash(seed + i + 1) * 0.35);
    cloud(
      fx,
      x + Math.cos(a) * d,
      y + Math.sin(a) * d * FLAT - 6,
      20 + age * 30,
      0.36 * (1 - u),
    );
  }
}

/** Embers rising around a point, drifting. */
function embers(
  fx: Fx,
  glow: Glow,
  x: number,
  y: number,
  reach: number,
  count: number,
  age: number,
  seed: number,
  life: number,
) {
  const u = clamp(age / life);
  if (u >= 1) return;
  for (let i = 0; i < count; i++) {
    const a = hash(seed + i + 40) * TAU,
      d = reach * hash(seed + i + 41);
    const ex = x + Math.cos(a) * d + Math.sin(age * 4 + i) * 8,
      ey = y + Math.sin(a) * d * FLAT - (30 + age * (70 + hash(seed + i) * 80));
    fx.g.fillStyle(0xffb450, 1 - u).fillCircle(ex, ey, 2.6);
    glow(ex, ey, 13, 0xff8c3c, (1 - u) * 0.5);
  }
}

/**
 * The roar into a new phase: sound waves from the mouth for a second and a
 * bit, a ring along the floor and embers rising around the boss.
 */
function roar(fx: Fx, glow: Glow, m: Moment, pal: Palette, low: boolean) {
  const mouthY = m.y - 140;
  // A wave every 0.16 s from 0.05 to 1.3 s, each lasting 0.7 s.
  for (let k = 0; k < 8; k++) {
    const u = (m.age - 0.05 - k * 0.16) / 0.7;
    if (u < 0 || u > 1) continue;
    fx.g
      .lineStyle(3 * (1 - u) + 0.5, 0xffdcaa, 0.55 * (1 - u))
      .strokeEllipse(m.x, mouthY, (20 + u * 160) * 2, (12 + u * 90) * 2);
  }
  // The floor ring as the new phase takes hold.
  const k = easeOut(clamp(m.age / 0.8)),
    fade = 1 - clamp(m.age / 0.8);
  if (fade > 0) {
    const rr = 200 * k;
    fx.floor
      .lineStyle(8 * (1 - k) + 1, pal.glow, fade * 0.8)
      .strokeEllipse(m.x, m.y, rr * 2, rr * 2 * FLAT);
    glow(m.x, m.y - 90, 140, pal.glow, fade * 0.6);
  }
  embers(fx, glow, m.x, m.y, 110, low ? 6 : 14, m.age, m.seed, 1.6);
}

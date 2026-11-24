/**
 * Lumiwick's attack effects (Emberwing's id), drawn every frame through the
 * effects engine (fx-engine.ts) inside boss-spell-art.ts's `space`, so they
 * keep to the graphics levels and the glow budget, and its warning glows
 * stay full size on Low (`essential`). They start from the lantern itself:
 * where boss-lumiwick-rig.ts last drew its hem and eyes.
 */
import type Phaser from "phaser";
import type { Fighter, Snapshot } from "@arena/shared";
import type { Fx } from "./fx-engine";
import type { BossCast } from "./boss-performance";

type Glow = (
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  floor?: boolean,
) => void;
export interface LumiPoints {
  /** In the boss layer's coordinates. */
  hem: { x: number; y: number };
  eyes: { x: number; y: number }[];
  flame: number;
  lit: number;
}
const points = new WeakMap<Phaser.Scene, LumiPoints>();
/** The rig's latest hem and eyes (raid-emberwing-art.ts records them each frame). */
export const noteLumiwick = (scene: Phaser.Scene, p: LumiPoints) =>
  points.set(scene, p);
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const HOT = 0xffd36a,
  WARM = 0xff8a3a,
  DEEP = 0xe0401a;

export function drawLumiwickAttacks(
  scene: Phaser.Scene,
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid,
    p = points.get(scene);
  if (!r || !p) return;
  // count the glows this frame (the visual checks read it from the registry)
  let glows = 0;
  const lit = glow;
  glow = (x, y, rad, c, a, floor) => {
    glows++;
    lit(x, y, rad, c, a, floor);
  };
  const hem = p.hem;
  const eye = p.eyes.length
    ? {
        x: p.eyes.reduce((s, e) => s + e.x, 0) / p.eyes.length,
        y: p.eyes.reduce((s, e) => s + e.y, 0) / p.eyes.length,
      }
    : { x: hem.x, y: hem.y - 90 };
  // its own light: the open hem glows, and throws a warm pool on the floor
  if (p.lit > 0.05 && p.flame > 0.05) {
    glow(hem.x, hem.y + 8, (low ? 22 : 28) + r.phase * 4, WARM, 0.45 * p.lit);
    glow(boss.x, boss.y + 4, 60 + r.phase * 6, WARM, 0.22 * p.lit, true);
  }
  // windups: the hem flares as each warning fills (a warning: full size on Low)
  for (const w of r.warnings) {
    if (w.casterId && w.casterId !== boss.id) continue;
    if (w.kind === "brazier-lighting") continue;
    const start = w.startedAt ?? w.at - 1.5,
      k = clamp((state.time - start) / Math.max(0.01, w.at - start));
    if (k <= 0 || k > 1) continue;
    if (w.kind === "flame-ring" || w.kind === "dive-bomb")
      glow(hem.x, hem.y + 6, 24 + k * 36, HOT, 0.25 + k * 0.5);
    if (w.kind === "ember-rain" && k > 0.55)
      // the fountain: sparks flung up out of the hem
      fx.trail(`lumi-rain-${w.id}`, 0.06, () =>
        fx.burst({
          x: hem.x,
          y: hem.y,
          z: 0,
          count: low ? 3 : 6,
          kind: "ember",
          color: [HOT, WARM, 0xfff0b0],
          speed: [40, 140],
          up: [260, 420],
          life: [0.7, 1.1],
          size: [2, 3.5],
          grav: 520,
          drag: 0.6,
        }),
      );
    if (w.kind === "heat-mark" && k < 0.18) {
      // the glare: a hot line from its eyes to the branded raider
      const a = 1 - k / 0.18;
      fx.g
        .lineStyle(6, 0xff688c, 0.35 * a)
        .lineBetween(eye.x, eye.y, w.x, w.y - 30);
      fx.g
        .lineStyle(2, 0xfff0f2, 0.9 * a)
        .lineBetween(eye.x, eye.y, w.x, w.y - 30);
      for (const e of p.eyes) glow(e.x, e.y, 12, 0xffe0a0, 0.8 * a);
    }
  }
  for (const c of casts) {
    if (c.kind === "dive-bomb" && c.age < 0.5) {
      // the comet: embers and flame peel off the streaming wick
      fx.trail(`lumi-dive-${c.id}`, 0.03, () =>
        fx.burst({
          x: hem.x,
          y: hem.y,
          z: 0,
          count: low ? 2 : 4,
          kind: "flame",
          color: [WARM, HOT, DEEP],
          speed: [20, 70],
          life: [0.3, 0.55],
          size: [4, 8],
          drag: 2.5,
        }),
      );
      glow(hem.x, hem.y, 34, HOT, 0.7 * (1 - c.age / 0.5));
    } else if (c.kind === "wing-gust" && c.age < 0.45) {
      // a puff of hot air out of the hem, rolling along the cone
      const u = c.age / 0.45;
      for (let i = 0; i < (low ? 3 : 5); i++) {
        const a = c.angle + (i / 4 - 0.5) * 0.8,
          d = 40 + u * 220 * (0.8 + (i % 2) * 0.3);
        fx.soft(
          hem.x + Math.cos(a) * d,
          hem.y + 10 + Math.sin(a) * d * 0.7,
          18 + u * 30,
          0xffe2b0,
          0.22 * (1 - u),
        );
      }
    } else if (c.kind === "flame-ring" && c.age < 0.4) {
      glow(hem.x, hem.y, 50 + c.age * 120, HOT, 0.8 * (1 - c.age / 0.4));
    } else if (c.kind === "scorched-earth" && c.age < 0.5) {
      // a drop of burning wax arcs from the hem to the patch
      const u = c.age / 0.5,
        x = hem.x + (c.x - hem.x) * u,
        y = hem.y + (c.y - hem.y) * u - Math.sin(u * Math.PI) * 60;
      fx.g.fillStyle(0xffc24a, 1).fillCircle(x, y, 6);
      fx.g.fillStyle(0xfff6c8, 0.9).fillCircle(x - 2, y - 2, 2.2);
      fx.g
        .fillStyle(0xff8a3a, 0.85)
        .fillTriangle(x - 4, y - 3, x + 4, y - 3, x, y - 16);
      glow(x, y, 16, WARM, 0.7);
    }
  }
  drawLumiwickFloor(fx, glow, state, boss, casts, low);
  scene.registry.set("lumiwick-glows", glows);
  // beaten: a thread of smoke rises from the guttered wick
  if (boss.hp <= 0 && p.lit < 0.5)
    fx.trail("lumi-smoke", 0.25, () =>
      fx.burst({
        x: hem.x,
        y: hem.y,
        z: 0,
        count: 1,
        kind: "smoke",
        color: 0x6a5a52,
        speed: [2, 8],
        up: [20, 40],
        life: [1.2, 1.8],
        size: [6, 10],
        drag: 1,
      }),
    );
}

// ════════════════ where each attack lands (ported from the approved demo) ════════════════
// The Sky Terrace already draws what stays on the floor (braziers, burning
// patches, the dive lane, the flame ring's band and the flames riding it);
// these are the moments of each attack on top of it. All of it is cosmetic:
// the warning shapes and timings are the server's and are drawn elsewhere.
const TAU = Math.PI * 2;
const hash = (n: number) => {
  const a = Math.sin(n * 127.1) * 43758.5453;
  return a - Math.floor(a);
};
/** Run `fn` once per key (a cast or a warning), through the engine's emit throttle. */
const once = (fx: Fx, key: string, fn: () => void) => fx.trail(key, 1e6, fn);
const RAIN_FALL = 0.35;
/** Seven-segment digits for the Heat Mark countdown (no text objects). */
const SEGS: Record<number, string> = { 1: "bc", 2: "abged", 3: "abgcd" };
function digit(
  g: Phaser.GameObjects.Graphics,
  n: number,
  x: number,
  y: number,
  h: number,
  a: number,
) {
  const w = h * 0.55,
    pts: Record<string, [number, number, number, number]> = {
      a: [-w / 2, -h / 2, w / 2, -h / 2],
      b: [w / 2, -h / 2, w / 2, 0],
      c: [w / 2, 0, w / 2, h / 2],
      d: [-w / 2, h / 2, w / 2, h / 2],
      e: [-w / 2, 0, -w / 2, h / 2],
      g: [-w / 2, 0, w / 2, 0],
    };
  for (const [lw, col, al] of [
    [7, 0x3c000a, 0.75 * a],
    [3.5, 0xffe0e6, a],
  ] as const) {
    g.lineStyle(lw, col, al);
    for (const s of SEGS[n] ?? "") {
      const p = pts[s];
      g.lineBetween(x + p[0], y + p[1], x + p[2], y + p[3]);
    }
  }
}
export function drawLumiwickFloor(
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  boss: Fighter,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid;
  if (!r) return;
  const now = state.time;
  // what this frame drew, for the visual checks (the game's registry)
  const seen: Record<string, number> = {};
  const saw = (k: string) => (seen[k] = (seen[k] ?? 0) + 1);
  // ── before the hits
  for (const w of r.warnings) {
    if (w.casterId && w.casterId !== boss.id) continue;
    const start = w.startedAt ?? w.at - 1.5,
      dur = Math.max(0.01, w.at - start),
      k = clamp((now - start) / dur);
    if (w.kind === "ember-rain") {
      // a spark falls on its circle in the last moment, its tail streaming up
      const u = 1 - (w.at - now) / RAIN_FALL;
      if (u <= 0 || u > 1) continue;
      const dx = 110 + hash(w.id) * 70,
        x = w.x + dx * (1 - u),
        y = w.y - 460 * (1 - u * u);
      const tx = x + dx * 0.32,
        ty = y - 150;
      fx.g.fillStyle(0xff8a2a, 0.45).fillTriangle(x - 7, y, x + 7, y, tx, ty);
      fx.g
        .fillStyle(0xffe08a, 0.8)
        .fillTriangle(x - 3, y, x + 3, y, (x + tx) / 2, (y + ty) / 2);
      saw("rain-fall");
      fx.g.fillStyle(0xffffff, 1).fillCircle(x, y, 4.5);
      fx.g.lineStyle(2, 0xffb84a, 0.9).strokeCircle(x, y, 6.5);
      if (!low && w.id % 3 === 0) glow(x, y, 22, WARM, 0.7);
    } else if (w.kind === "heat-mark") {
      // the brand: turning ticks, a counter-turning inner ring, the countdown
      saw("brand");
      const R = w.radius,
        spin = now * 1.4;
      fx.g.lineStyle(3, 0xff688c, 0.9);
      for (let i = 0; i < (low ? 8 : 12); i++) {
        const a = spin + (i / (low ? 8 : 12)) * TAU;
        fx.g.lineBetween(
          w.x + Math.cos(a) * (R - 18),
          w.y + Math.sin(a) * (R - 18),
          w.x + Math.cos(a) * (R - 6),
          w.y + Math.sin(a) * (R - 6),
        );
      }
      fx.g.lineStyle(2, 0xffbec8, 0.7);
      const n = low ? 10 : 16;
      for (let i = 0; i < n; i += 1) {
        const a0 = -now * 1.4 + (i / n) * TAU;
        fx.g
          .beginPath()
          .arc(w.x, w.y, R * 0.55, a0, a0 + (TAU / n) * 0.45)
          .strokePath();
      }
      const left = Math.ceil(dur * (1 - k) - 1e-3);
      if (left > 0 && left <= 3) digit(fx.g, left, w.x, w.y - R - 32, 30, 1);
    }
  }
  // ── the hits
  for (const c of casts) {
    const key = `lumi-${c.kind}-${c.id}`;
    if (c.kind === "ember-rain" && c.age < 0.55) {
      // impact: a bright ring out to the circle's edge, a scorch, sparks
      saw("rain-impact");
      const u = c.age / 0.55,
        R = 8 + (c.radius * 1.3 - 8) * Math.sqrt(u);
      fx.floor
        .lineStyle(6 * (1 - u) + 1, 0xffbe5a, 0.8 * (1 - u))
        .strokeEllipse(c.x, c.y, R * 2, R * 1.8);
      if (!low && c.age < 0.22)
        glow(c.x, c.y, 50 * (1 + u), HOT, 0.8 * (1 - c.age / 0.22), true);
      once(fx, key, () => {
        fx.decal({
          kind: "scorch",
          x: c.x,
          y: c.y,
          r: c.radius * 1.05,
          color: 0x1e0802,
          life: 2.6,
        });
        fx.burst({
          x: c.x,
          y: c.y,
          z: 2,
          count: low ? 4 : 9,
          kind: "ember",
          color: [HOT, WARM, 0xfff0b0],
          speed: [90, 240],
          up: [120, 260],
          life: [0.45, 0.8],
          size: [2, 3.5],
          grav: 520,
        });
      });
    } else if (c.kind === "heat-mark" && c.age < 0.9) {
      // a pillar of fire on the branded raider, and a pink shockwave
      saw("pillar");
      const k = Math.sin(clamp(c.age / 0.9) * Math.PI),
        u = clamp(c.age / 0.55);
      // three nested tongues of flame, flickering, tallest at the peak
      const col = (
        w: number,
        h: number,
        color: number,
        a: number,
        ph: number,
      ) => {
        const sway = Math.sin(c.age * 24 + ph) * w * 0.25,
          pts: { x: number; y: number }[] = [];
        for (let j = 0; j <= 10; j++) {
          const v = j / 10,
            hw =
              w * Math.sin(Math.PI * (0.15 + 0.85 * v)) * (1 + (1 - v) * 0.15);
          pts.push({ x: c.x - hw + sway * v, y: c.y - h * v });
        }
        for (let j = 10; j >= 0; j--) {
          const v = j / 10,
            hw =
              w * Math.sin(Math.PI * (0.15 + 0.85 * v)) * (1 + (1 - v) * 0.15);
          pts.push({ x: c.x + hw + sway * v, y: c.y - h * v });
        }
        fx.g.fillStyle(color, a).fillPoints(pts, true);
      };
      col(30 * (0.7 + 0.3 * k), 170 * k, 0xe0401a, 0.75 * k, 0);
      col(19 * (0.7 + 0.3 * k), 135 * k, 0xff8a3a, 0.8 * k, 1.7);
      col(9 * (0.7 + 0.3 * k), 95 * k, 0xfff0b0, 0.85 * k, 3.1);
      glow(c.x, c.y - 40, 70 * k, HOT, k);
      if (u < 1)
        fx.floor
          .lineStyle(12 * (1 - u) + 1, 0xff6e8c, 0.8 * (1 - u))
          .strokeEllipse(
            c.x,
            c.y,
            (20 + c.radius * 1.1 * Math.sqrt(u)) * 2,
            (20 + c.radius * 1.1 * Math.sqrt(u)) * 1.8,
          );
      once(fx, key, () => {
        fx.decal({
          kind: "scorch",
          x: c.x,
          y: c.y,
          r: c.radius * 0.8,
          color: 0x1e0802,
          life: 3,
        });
        fx.burst({
          x: c.x,
          y: c.y,
          z: 4,
          count: low ? 6 : 14,
          kind: "flame",
          color: [WARM, HOT, DEEP],
          speed: [60, 200],
          up: [160, 320],
          life: [0.5, 0.8],
          size: [5, 9],
          grav: 300,
        });
        fx.shake(220, 0.006);
      });
    } else if (c.kind === "wing-gust" && c.age < 1) {
      // hot wind ribbons sweep out over the cone, behind a pale wave front
      saw("gust");
      const spread = c.spread ?? 0.6,
        u = c.age,
        fade = 1 - clamp((u - 0.7) / 0.3),
        len = c.radius;
      const n = low ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const off = (i / (n - 1) - 0.5) * spread * 1.6,
          ph = i * 1.3,
          head = 30 + (len - 30) * Math.sqrt(clamp(u + (i % 3) * 0.05)),
          tail = Math.max(0, head - 190);
        const pts: { x: number; y: number }[] = [];
        for (let d = tail; d <= head; d += 16) {
          const a = c.angle + off + Math.sin(d / 70 + ph) * 0.08;
          pts.push({
            x: c.x + Math.cos(a) * d - Math.sin(a) * Math.sin(d / 50 + ph) * 14,
            y: c.y + Math.sin(a) * d + Math.cos(a) * Math.sin(d / 50 + ph) * 14,
          });
        }
        if (pts.length < 2) continue;
        for (const [lw, col, al] of [
          [10, 0x8eddf0, 0.16],
          [4, 0xffd696, 0.22],
          [2, 0xfff8e2, 0.75],
        ] as const)
          fx.g.lineStyle(lw, col, al * fade).strokePoints(pts);
      }
      const R = 40 + (len - 40) * (1 - (1 - clamp(u / 0.8)) ** 2);
      if (u < 0.8)
        for (const [lw, al] of [
          [18, 0.16],
          [5, 0.5],
        ] as const)
          fx.floor
            .lineStyle(lw, 0xbef0ff, al * (1 - u / 0.8))
            .beginPath()
            .arc(c.x, c.y, R, c.angle - spread * 0.95, c.angle + spread * 0.95)
            .strokePath();
    } else if (c.kind === "dive-bomb" && c.age < 0.9) {
      // sparks kick up along the lane as it streaks past, then the pull-up shockwave
      saw(c.age >= 0.42 ? "dive-shock" : "dive-sparks");
      const along = clamp(c.age / 0.4);
      if (c.age < 0.4)
        fx.trail(key, 0.04, () =>
          fx.burst({
            x: c.x + (c.tx - c.x) * along,
            y: c.y + (c.ty - c.y) * along,
            z: 2,
            count: low ? 2 : 4,
            kind: "ember",
            color: [HOT, WARM],
            speed: [40, 120],
            up: [80, 180],
            life: [0.35, 0.6],
            size: [2, 3],
            grav: 520,
          }),
        );
      if (c.age >= 0.42) {
        const u = clamp((c.age - 0.42) / 0.45);
        fx.floor
          .lineStyle(9 * (1 - u) + 1, 0xffbe5a, 0.8 * (1 - u))
          .strokeEllipse(
            c.tx,
            c.ty,
            (20 + 110 * Math.sqrt(u)) * 2,
            (20 + 110 * Math.sqrt(u)) * 1,
          );
        once(fx, key + "-up", () =>
          fx.burst({
            x: c.tx,
            y: c.ty,
            z: 2,
            count: low ? 4 : 8,
            kind: "smoke",
            color: 0x7a5a48,
            speed: [60, 130],
            up: [10, 30],
            life: [0.6, 1],
            size: [8, 14],
            drag: 2,
          }),
        );
      }
    } else if (c.kind === "scorched-earth" && c.age >= 0.5 && c.age < 0.9) {
      // the wax drop lands: a splash of embers and a small ring (the patch is the terrace's)
      saw("wax-splash");
      const u = (c.age - 0.5) / 0.4;
      fx.floor
        .lineStyle(5 * (1 - u) + 1, 0xffb050, 0.75 * (1 - u))
        .strokeEllipse(
          c.x,
          c.y,
          (10 + c.radius * Math.sqrt(u)) * 2,
          (10 + c.radius * Math.sqrt(u)) * 1.8,
        );
      once(fx, key, () =>
        fx.burst({
          x: c.x,
          y: c.y,
          z: 2,
          count: low ? 4 : 8,
          kind: "ember",
          color: [0xffc24a, WARM],
          speed: [60, 160],
          up: [100, 220],
          life: [0.4, 0.7],
          size: [2, 3.5],
          grav: 520,
        }),
      );
    }
  }
  // ── flame rings: a cheap heat shimmer just inside each band (the band and its flames are the terrace's)
  if (!low)
    for (const ring of r.flameRings ?? []) {
      const R = Math.max(1, ring.radius);
      saw("shimmer");
      for (const off of [26, 44]) {
        const pts: { x: number; y: number }[] = [];
        for (let i = 0; i <= 48; i++) {
          const a = (i / 48) * TAU,
            wv = Math.sin(a * 14 + now * 9 + off) * 3.5;
          pts.push({
            x: ring.x + Math.cos(a) * (R - off + wv),
            y: ring.y + Math.sin(a) * (R - off + wv),
          });
        }
        fx.floor.lineStyle(2, 0xffdcb4, 0.16).strokePoints(pts);
      }
    }
  fx.scene.registry.set("lumiwick-fx", seen);
}

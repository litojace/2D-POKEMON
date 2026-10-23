import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * Tidefin's kit: solid water with foam and glints, droplets that splash and
 * fall, ripples and wet floor. Sizes come from the shared abilities.
 */
const FOAM = 0xf2fdff;
const DEEP = 0x1d5f8a;

function splash(fx: Fx, x: number, y: number, color: number, n: number, power = 1) {
  fx.burst({ x, y, z: 8, count: n, kind: "drop", color: [color, FOAM, color], speed: [40 * power, 180 * power], up: [140 * power, 360 * power], life: [0.45, 0.8], size: [1.6, 3], grav: 1100, bounce: 0.15, drag: 1 });
  fx.burst({ x, y, z: 10, count: Math.ceil(n / 3), kind: "smoke", color: FOAM, speed: [20, 60 * power], up: [10, 40], life: [0.4, 0.7], size: [6, 10], drag: 2 });
}
/** A solid water body: dark rim, base colour, light inner, white glint. */
function blob(fx: Fx, x: number, y: number, r: number, color: number, stretch = 1, angle = 0) {
  const dx = Math.cos(angle),
    dy = Math.sin(angle);
  for (let i = 0; i < 4; i++) {
    const t = i / 3,
      px = x - dx * r * stretch * t,
      py = y - dy * r * stretch * t,
      rr = r * (1 - t * 0.55);
    fx.solid.fillStyle(DEEP, 0.5).fillCircle(px, py, rr * 1.08);
    fx.solid.fillStyle(color, 0.95).fillCircle(px, py, rr);
  }
  fx.solid.fillStyle(FOAM, 0.55).fillCircle(x - r * 0.15, y - r * 0.2, r * 0.55);
  fx.solid.fillStyle(0xffffff, 1).fillCircle(x - r * 0.3, y - r * 0.35, r * 0.25);
}

// ───────────── Tide Needle ─────────────
function tideNeedle(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    x = pr.x,
    y = pr.y;
  fx.solid.fillStyle(0x000000, 0.15).fillEllipse(x, y + 18, r * 3, r);
  fx.floor.lineStyle(2, FOAM, 0.4).lineBetween(x - Math.cos(a) * 70, y + 18 - Math.sin(a) * 70, x, y + 18);
  blob(fx, x, y, r, c, 3.2, a);
  fx.glow(x, y, r * 2.4, c, 0.25);
  fx.trail(`tn${pr.id}`, 0.03, () =>
    fx.burst({ x: x - Math.cos(a) * r * 2, y, z: 0, count: 2, kind: "drop", color: [c, FOAM], angle: a + Math.PI, spread: 0.5, speed: [40, 120], up: [20, 90], life: [0.25, 0.45], size: [1, 1.8], grav: 1000 }),
  );
  void now;
}
function needleImpact(scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  splash(fx, x, y + 14, color, 10, a.id === "riptide-wave" ? 1.8 : 0.8);
  fx.decal({ kind: "wet", x, y: y + 14, r: 26, color, life: 3 });
  shot(360, (k) => fx.shockwave(x, y + 14, 34 * ease(k), k, FOAM, 5));
}

// ───────────── Ripple Stars ─────────────
function rippleStar(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    x = pr.x,
    y = pr.y,
    spin = now / 70 + pr.id;
  fx.solid.fillStyle(0x000000, 0.14).fillEllipse(x, y + 18, r * 2, r * 0.7);
  const star = (rr: number, inner: number) =>
    Array.from({ length: 8 }, (_, i) => {
      const a = spin + (i * Math.PI) / 4,
        d = i % 2 ? rr * inner : rr;
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    });
  fx.solid.fillStyle(DEEP, 0.55).fillPoints(star(r * 1.45, 0.4), true);
  fx.solid.fillStyle(c, 1).fillPoints(star(r * 1.3, 0.38), true);
  fx.solid.fillStyle(FOAM, 0.95).fillPoints(star(r * 0.6, 0.4), true);
  fx.glow(x, y, r * 2.2, c, 0.3);
  fx.trail(`rs${pr.id}`, 0.035, () =>
    fx.burst({ x, y, z: 0, count: 1, kind: "drop", color: [c, FOAM], speed: [10, 40], up: [0, 40], life: [0.25, 0.4], size: [1, 1.6], grav: 900 }),
  );
}

// ───────────── Whirlpool ─────────────
function whirlpool(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    c = z.color,
    sq = 0.82,
    fade = progress > 0.85 ? (1 - progress) / 0.15 : Math.min(1, progress / 0.06),
    spin = -now / 420;
  fx.trail(`wp${z.id}`, 999, () => {
    splash(fx, z.x, z.y, c, 24, 1.4);
    fx.decal({ kind: "wet", x: z.x, y: z.y, r: r * 0.85, color: c, life: 3 });
  });
  // Water surface, darkening toward the eye of the vortex.
  fx.floorSolid.fillStyle(c, 0.42 * fade).fillEllipse(z.x, z.y, r * 2, r * 2 * sq);
  fx.floorSolid.fillStyle(DEEP, 0.38 * fade).fillEllipse(z.x, z.y, r * 1.25, r * 1.25 * sq);
  fx.floorSolid.fillStyle(0x0b2d48, 0.5 * fade).fillEllipse(z.x, z.y, r * 0.45, r * 0.45 * sq);
  // Foam arms spiralling in.
  for (let arm = 0; arm < 4; arm++) {
    const pts = [];
    for (let i = 0; i <= 24; i++) {
      const k = i / 24,
        a = spin + arm * (TAU / 4) + k * 3.6;
      pts.push({ x: z.x + Math.cos(a) * r * (1 - k * 0.85), y: z.y + Math.sin(a) * r * (1 - k * 0.85) * sq });
    }
    fx.floorSolid.lineStyle(6, FOAM, 0.55 * fade).strokePoints(pts.slice(0, 18), false);
    fx.floorSolid.lineStyle(2.5, 0xffffff, 0.85 * fade).strokePoints(pts.slice(2, 14), false);
  }
  fx.floorSolid.lineStyle(4, FOAM, 0.75 * fade).strokeEllipse(z.x, z.y, r * 2, r * 2 * sq);
  fx.glow(z.x, z.y, r, c, 0.25 * fade, true);
  // Foam flecks riding the current, bubbles popping up.
  for (let i = 0; i < 14; i++) {
    const t = (now / 1400 + hash(z.id + i)) % 1,
      a = spin * 2 + hash(i) * TAU + t * 4,
      d = r * (1 - t) * 0.95;
    fx.floorSolid.fillStyle(0xffffff, 0.9 * fade * (1 - t * 0.5)).fillCircle(z.x + Math.cos(a) * d, z.y + Math.sin(a) * d * sq, 2.2);
  }
  fx.trail(`wpb${z.id}`, 0.06, () => {
    const a = Math.random() * TAU,
      d = Math.random() * r * 0.8;
    fx.burst({ x: z.x + Math.cos(a) * d, y: z.y + Math.sin(a) * d * sq, z: 2, count: 1, kind: "drop", color: FOAM, speed: [0, 20], up: [60, 140], life: [0.3, 0.5], size: [1.2, 2], grav: 900 });
  });
}

// ───────────── Mirror Mist ─────────────
function mirrorMist(scene: Phaser.Scene, _a: Ability, x: number, y: number, _angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  fx.burst({ x, y, z: 10, count: 18, kind: "smoke", color: [FOAM, 0xdcf6ff], speed: [60, 160], up: [10, 60], life: [0.7, 1.2], size: [10, 18], drag: 2.4 });
  fx.burst({ x, y, z: 16, count: 14, kind: "mote", color: [color, FOAM], speed: [40, 140], up: [20, 90], life: [0.5, 1], size: [1, 1.8], drag: 2 });
  splash(fx, x, y, color, 8, 0.7);
  shot(520, (k) => {
    fx.glow(x, y - 14, 70 * (0.6 + k * 0.6), color, 0.45 * (1 - k));
    fx.shockwave(x, y, 70 * ease(k), k, FOAM, 6);
    // Shimmer lines, like light refracting through spray.
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + k * 1.5,
        d = 24 + k * 46;
      fx.g.lineStyle(2, FOAM, 0.6 * (1 - k)).lineBetween(x + Math.cos(a) * d, y - 14 + Math.sin(a) * d * 0.6 - 8, x + Math.cos(a) * d, y - 14 + Math.sin(a) * d * 0.6 + 8);
    }
  });
}

// ───────────── Riptide Wave ─────────────
function riptideWindup(g: G, a: Ability, x: number, y: number, angle: number, _ax: number, _ay: number, color: number, k: number, now: number) {
  const fx = fxFor(g.scene),
    len = Math.min(a.range, 420),
    nx = -Math.sin(angle),
    ny = Math.cos(angle);
  // True lane, as wide as the wave.
  fx.floorSolid.fillStyle(color, 0.08 + k * 0.1);
  fx.floorSolid.fillPoints(
    [
      { x: x + nx * a.radius, y: y + ny * a.radius },
      { x: x + Math.cos(angle) * len + nx * a.radius, y: y + Math.sin(angle) * len + ny * a.radius },
      { x: x + Math.cos(angle) * len - nx * a.radius, y: y + Math.sin(angle) * len - ny * a.radius },
      { x: x - nx * a.radius, y: y - ny * a.radius },
    ],
    true,
  );
  const fx0 = x + Math.cos(angle) * 30,
    fy0 = y + Math.sin(angle) * 30;
  blob(fx, fx0, fy0 - 10 - k * 6, 6 + k * 12, color);
  fx.trail(`rw${Math.round(x)}`, 0.02, () => {
    const a2 = Math.random() * TAU;
    fx.burst({ x: fx0 + Math.cos(a2) * 60, y: fy0 + Math.sin(a2) * 40, z: 6, count: 1, kind: "drop", color: [color, FOAM], angle: a2 + Math.PI, spread: 0.1, speed: [180, 220], life: [0.25, 0.3], size: [1.4, 2.2], drag: 0.5 });
  });
  void now;
}
function riptideWave(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    nx = -Math.sin(a),
    ny = Math.cos(a),
    fwd = (d: number) => ({ x: pr.x + Math.cos(a) * d, y: pr.y + Math.sin(a) * d });
  // Wake on the floor behind the wave.
  for (let i = 1; i <= 3; i++)
    fx.floorSolid.fillStyle(c, 0.24 - i * 0.05).fillEllipse(pr.x - Math.cos(a) * (40 + i * 34), pr.y + 16 - Math.sin(a) * (40 + i * 34), r * (2.3 - i * 0.3), r * (1.3 - i * 0.2));
  // The wave: a curled crest the full hit width, rising in layers.
  const crest = (back: number, w: number, lift: number) =>
    Array.from({ length: 17 }, (_, i) => {
      const s = i / 16 - 0.5,
        bulge = Math.cos(s * Math.PI) * 16,
        p = fwd(bulge - back);
      // Uneven, rippling crest: taller in the middle, choppy along the top.
      const chop = lift > 0 ? Math.sin(s * 13 + now / 90 + pr.id) * 5 + Math.sin(s * 29 - now / 70) * 2.5 : 0;
      return { x: p.x + nx * s * 2 * w, y: p.y + ny * s * 2 * w - lift * (0.55 + 0.45 * Math.cos(s * Math.PI)) - chop };
    });
  const swell = Math.sin(now / 80) * 3,
    base = crest(70, r * 1.04, 0),
    top = crest(0, r * 0.94, 46 + swell);
  fx.solid.fillStyle(0x000000, 0.16).fillPoints(crest(56, r, -16), false);
  fx.solid.fillStyle(DEEP, 0.85).fillPoints([...base, ...top.slice().reverse()], true);
  fx.solid.fillStyle(c, 1).fillPoints([...crest(54, r * 1, 8), ...crest(6, r * 0.93, 41 + swell).reverse()], true);
  fx.solid.fillStyle(0x9eefff, 0.9).fillPoints([...crest(24, r * 0.92, 24), ...crest(2, r * 0.9, 43 + swell).reverse()], true);
  fx.solid.lineStyle(9, FOAM, 1).strokePoints(top, false);
  fx.solid.lineStyle(3.5, 0xffffff, 1).strokePoints(top.slice(3, 14), false);
  fx.glow(pr.x, pr.y - 10, r * 1.6, c, 0.3);
  // Churning foam where the wave meets the floor.
  for (let i = 0; i <= 8; i++) {
    const p = base[i * 2];
    fx.glow(p.x, p.y + 2, 10 + hash(i + Math.floor(now / 90)) * 7, FOAM, 0.55);
  }
  fx.trail(`rp${pr.id}`, 0.02, () => {
    const s = Math.random() - 0.5,
      p = top[Math.floor((s + 0.5) * 16)];
    fx.burst({ x: p.x, y: p.y + 30, z: 34, count: 3, kind: "drop", color: [FOAM, c], angle: a, spread: 0.8, speed: [40, 160], up: [80, 220], life: [0.35, 0.6], size: [1.4, 2.6], grav: 1100, bounce: 0.1 });
    if (Math.random() < 0.4) fx.burst({ x: p.x, y: p.y + 20, z: 22, count: 1, kind: "smoke", color: FOAM, speed: [10, 40], up: [10, 30], life: [0.4, 0.6], size: [6, 9] });
  });
}

// ───────────── Casts and hits ─────────────
function waterCast(scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 24,
    my = y + Math.sin(angle) * 24;
  fx.burst({ x: mx, y: my, z: 14, count: a.kind === "barrage" ? 8 : 4, kind: "drop", color: [color, FOAM], angle, spread: 0.6, speed: [80, 220], up: [30, 120], life: [0.25, 0.45], size: [1.2, 2], grav: 1000 });
  shot(160, (k) => fx.glow(mx, my - 14, 26 * (1 - k * 0.4), color, 0.5 * (1 - k)));
}
function waterHit(scene: Phaser.Scene, x: number, y: number, color: number, shot: Shot) {
  const fx = fxFor(scene);
  splash(fx, x, y, color, 10, 0.9);
  shot(fx.reduced ? 140 : 340, (k) => {
    fx.glow(x, y - 18, 34 * (1 - k * 0.4), color, 0.45 * (1 - k));
    fx.shockwave(x, y, 40 * ease(k), k, FOAM, 5);
  });
}

export const waterKit: FxKit = {
  projectile: { "tide-needle": tideNeedle, "ripple-stars": rippleStar, "riptide-wave": riptideWave },
  zone: { whirlpool },
  windup: { "riptide-wave": riptideWindup },
  cast: { "tide-needle": waterCast, "ripple-stars": waterCast, "riptide-wave": waterCast, "mirror-mist": mirrorMist },
  impact: { "tide-needle": needleImpact, "ripple-stars": needleImpact, "riptide-wave": needleImpact },
  hit: { water: waterHit },
};

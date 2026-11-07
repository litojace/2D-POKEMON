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

function splash(
  fx: Fx,
  x: number,
  y: number,
  color: number,
  n: number,
  power = 1,
) {
  fx.burst({
    x,
    y,
    z: 8,
    count: n,
    kind: "drop",
    color: [color, FOAM, color],
    speed: [40 * power, 180 * power],
    up: [140 * power, 360 * power],
    life: [0.45, 0.8],
    size: [1.6, 3],
    grav: 1100,
    bounce: 0.15,
    drag: 1,
  });
  fx.burst({
    x,
    y,
    z: 10,
    count: Math.ceil(n / 3),
    kind: "smoke",
    color: FOAM,
    speed: [20, 60 * power],
    up: [10, 40],
    life: [0.4, 0.7],
    size: [6, 10],
    drag: 2,
  });
}
/** A solid water body: dark rim, base colour, light inner, white glint. */
function blob(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  color: number,
  stretch = 1,
  angle = 0,
) {
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
  fx.solid
    .fillStyle(FOAM, 0.55)
    .fillCircle(x - r * 0.15, y - r * 0.2, r * 0.55);
  fx.solid
    .fillStyle(0xffffff, 1)
    .fillCircle(x - r * 0.3, y - r * 0.35, r * 0.25);
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
  fx.floor
    .lineStyle(2, FOAM, 0.4)
    .lineBetween(x - Math.cos(a) * 70, y + 18 - Math.sin(a) * 70, x, y + 18);
  blob(fx, x, y, r, c, 3.2, a);
  fx.glow(x, y, r * 2.4, c, 0.25);
  fx.trail(`tn${pr.id}`, 0.03, () =>
    fx.burst({
      x: x - Math.cos(a) * r * 2,
      y,
      z: 0,
      count: 2,
      kind: "drop",
      color: [c, FOAM],
      angle: a + Math.PI,
      spread: 0.5,
      speed: [40, 120],
      up: [20, 90],
      life: [0.25, 0.45],
      size: [1, 1.8],
      grav: 1000,
    }),
  );
  void now;
}
function needleImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  splash(fx, x, y + 14, color, 10, a.id === "riptide-wave" ? 1.8 : 0.8);
  fx.decal({ kind: "wet", x, y: y + 14, r: 26, color, life: 3 });
  shot(360, (k) => fx.shockwave(x, y + 14, 34 * ease(k), k, FOAM, 5));
}

// ───────────── Undertow ─────────────
/**
 * Undertow: a lane of fast water from where Tidefin stood along its aim,
 * streaks of foam racing down it and chevrons showing which way it flows.
 */
function undertow(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    ang = z.angle ?? 0,
    ux = Math.cos(ang),
    uy = Math.sin(ang),
    nx = -uy,
    ny = ux,
    w = z.radius,
    grow = Math.min(1, progress * 10),
    len = a.range * grow,
    fade = progress > 0.88 ? (1 - progress) / 0.12 : 1,
    c = z.color;
  const at = (along: number, across: number) => ({
    x: z.x + ux * along + nx * across,
    y: z.y + uy * along + ny * across,
  });
  const lane = [at(0, -w), at(len, -w), at(len, w), at(0, w)];
  fx.floorSolid.fillStyle(DEEP, 0.5 * fade).fillPoints(lane, true);
  fx.floorSolid.fillStyle(c, 0.3 * fade).fillPoints(lane, true);
  fx.floor
    .lineStyle(3, FOAM, 0.55 * fade)
    .lineBetween(lane[0].x, lane[0].y, lane[1].x, lane[1].y);
  fx.floor
    .lineStyle(3, FOAM, 0.55 * fade)
    .lineBetween(lane[3].x, lane[3].y, lane[2].x, lane[2].y);
  // Foam streaks racing along.
  const speed = a.current?.speed ?? 200;
  for (let i = 0; i < 9; i++) {
    const across = ((i % 3) - 1) * w * 0.55 + Math.sin(i * 2.3) * 6,
      along = ((now / 1000) * speed * 1.4 + i * 97) % Math.max(1, len),
      p1 = at(along, across),
      p2 = at(Math.max(0, along - 34), across);
    fx.g.lineStyle(3, FOAM, 0.75 * fade).lineBetween(p2.x, p2.y, p1.x, p1.y);
  }
  // Chevrons: which way it flows.
  for (let k = 60; k < len; k += 90) {
    const o = ((now / 1000) * speed) % 90;
    const tip = at(k + o - 45, 0),
      l = at(k + o - 63, -14),
      r = at(k + o - 63, 14);
    if (k + o - 45 > len) continue;
    fx.g.lineStyle(3, c, 0.7 * fade).strokePoints([l, tip, r], false);
  }
  fx.trail(`ut${z.id}`, 0.12, () => {
    const p = at(Math.random() * len, (Math.random() * 2 - 1) * w);
    splash(fx, p.x, p.y, c, 3, 0.6);
  });
}

// ───────────── Tide Double ─────────────
function mirrorMist(
  scene: Phaser.Scene,
  _a: Ability,
  x: number,
  y: number,
  _angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y,
    z: 10,
    count: 18,
    kind: "smoke",
    color: [FOAM, 0xdcf6ff],
    speed: [60, 160],
    up: [10, 60],
    life: [0.7, 1.2],
    size: [10, 18],
    drag: 2.4,
  });
  fx.burst({
    x,
    y,
    z: 16,
    count: 14,
    kind: "mote",
    color: [color, FOAM],
    speed: [40, 140],
    up: [20, 90],
    life: [0.5, 1],
    size: [1, 1.8],
    drag: 2,
  });
  splash(fx, x, y, color, 8, 0.7);
  shot(520, (k) => {
    fx.glow(x, y - 14, 70 * (0.6 + k * 0.6), color, 0.45 * (1 - k));
    fx.shockwave(x, y, 70 * ease(k), k, FOAM, 6);
    // Shimmer lines, like light refracting through spray.
    for (let i = 0; i < 6; i++) {
      const a = (i * TAU) / 6 + k * 1.5,
        d = 24 + k * 46;
      fx.g
        .lineStyle(2, FOAM, 0.6 * (1 - k))
        .lineBetween(
          x + Math.cos(a) * d,
          y - 14 + Math.sin(a) * d * 0.6 - 8,
          x + Math.cos(a) * d,
          y - 14 + Math.sin(a) * d * 0.6 + 8,
        );
    }
  });
}

// ───────────── Riptide Wave ─────────────
function riptideWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  _ax: number,
  _ay: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    len = Math.min(a.range, 420),
    nx = -Math.sin(angle),
    ny = Math.cos(angle);
  // True lane, as wide as the wave.
  fx.floorSolid.fillStyle(color, 0.08 + k * 0.1);
  fx.floorSolid.fillPoints(
    [
      { x: x + nx * a.radius, y: y + ny * a.radius },
      {
        x: x + Math.cos(angle) * len + nx * a.radius,
        y: y + Math.sin(angle) * len + ny * a.radius,
      },
      {
        x: x + Math.cos(angle) * len - nx * a.radius,
        y: y + Math.sin(angle) * len - ny * a.radius,
      },
      { x: x - nx * a.radius, y: y - ny * a.radius },
    ],
    true,
  );
  const fx0 = x + Math.cos(angle) * 30,
    fy0 = y + Math.sin(angle) * 30;
  blob(fx, fx0, fy0 - 10 - k * 6, 6 + k * 12, color);
  fx.trail(`rw${Math.round(x)}`, 0.02, () => {
    const a2 = Math.random() * TAU;
    fx.burst({
      x: fx0 + Math.cos(a2) * 60,
      y: fy0 + Math.sin(a2) * 40,
      z: 6,
      count: 1,
      kind: "drop",
      color: [color, FOAM],
      angle: a2 + Math.PI,
      spread: 0.1,
      speed: [180, 220],
      life: [0.25, 0.3],
      size: [1.4, 2.2],
      drag: 0.5,
    });
  });
  void now;
}
/** Where each wave was last seen heading, so its crash can fall forward. */
const waveHeading = new Map<
  number,
  { x: number; y: number; angle: number; at: number }
>();
function riptideWave(g: G, pr: Projectile, now: number) {
  waveHeading.set(pr.id, {
    x: pr.x,
    y: pr.y,
    angle: Math.atan2(pr.vy, pr.vx),
    at: now,
  });
  if (waveHeading.size > 16)
    waveHeading.delete(waveHeading.keys().next().value!);
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    a = Math.atan2(pr.vy, pr.vx),
    nx = -Math.sin(a),
    ny = Math.cos(a),
    fwd = (d: number) => ({
      x: pr.x + Math.cos(a) * d,
      y: pr.y + Math.sin(a) * d,
    });
  // Wake on the floor behind the wave.
  for (let i = 1; i <= 3; i++)
    fx.floorSolid
      .fillStyle(c, 0.24 - i * 0.05)
      .fillEllipse(
        pr.x - Math.cos(a) * (40 + i * 34),
        pr.y + 16 - Math.sin(a) * (40 + i * 34),
        r * (2.3 - i * 0.3),
        r * (1.3 - i * 0.2),
      );
  // The wave: a curled crest the full hit width, rising in layers.
  const crest = (back: number, w: number, lift: number) =>
    Array.from({ length: 17 }, (_, i) => {
      const s = i / 16 - 0.5,
        bulge = Math.cos(s * Math.PI) * 16,
        p = fwd(bulge - back);
      // Uneven, rippling crest: taller in the middle, choppy along the top.
      const chop =
        lift > 0
          ? Math.sin(s * 13 + now / 90 + pr.id) * 5 +
            Math.sin(s * 29 - now / 70) * 2.5
          : 0;
      return {
        x: p.x + nx * s * 2 * w,
        y:
          p.y +
          ny * s * 2 * w -
          lift * (0.55 + 0.45 * Math.cos(s * Math.PI)) -
          chop,
      };
    });
  const swell = Math.sin(now / 80) * 3,
    base = crest(70, r * 1.04, 0),
    top = crest(0, r * 0.94, 46 + swell);
  fx.solid.fillStyle(0x000000, 0.16).fillPoints(crest(56, r, -16), false);
  fx.solid
    .fillStyle(DEEP, 0.85)
    .fillPoints([...base, ...top.slice().reverse()], true);
  fx.solid
    .fillStyle(c, 1)
    .fillPoints(
      [...crest(54, r * 1, 8), ...crest(6, r * 0.93, 41 + swell).reverse()],
      true,
    );
  fx.solid
    .fillStyle(0x9eefff, 0.9)
    .fillPoints(
      [...crest(24, r * 0.92, 24), ...crest(2, r * 0.9, 43 + swell).reverse()],
      true,
    );
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
    fx.burst({
      x: p.x,
      y: p.y + 30,
      z: 34,
      count: 3,
      kind: "drop",
      color: [FOAM, c],
      angle: a,
      spread: 0.8,
      speed: [40, 160],
      up: [80, 220],
      life: [0.35, 0.6],
      size: [1.4, 2.6],
      grav: 1100,
      bounce: 0.1,
    });
    if (Math.random() < 0.4)
      fx.burst({
        x: p.x,
        y: p.y + 20,
        z: 22,
        count: 1,
        kind: "smoke",
        color: FOAM,
        speed: [10, 40],
        up: [10, 30],
        life: [0.4, 0.6],
        size: [6, 9],
      });
  });
}

// ───────────── Riptide Wave crash ─────────────
function riptideImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius,
    gy = y + 14;
  // The wave that ended nearest this point tells us which way it was moving.
  let dir = 0,
    best = Infinity;
  for (const [id, w] of waveHeading) {
    const d = Math.hypot(w.x - x, w.y - y);
    if (d < best) ((best = d), (dir = w.angle));
    if (d < 80) waveHeading.delete(id);
  }
  const cos = Math.cos(dir),
    sin = Math.sin(dir),
    nx = -sin,
    ny = cos;
  // Spray thrown forward, a geyser straight up, mist hanging after.
  fx.burst({
    x,
    y: gy,
    z: 20,
    count: 34,
    kind: "drop",
    color: [color, FOAM, 0x9eefff],
    angle: dir,
    spread: 0.9,
    speed: [180, 520],
    up: [120, 380],
    life: [0.5, 0.95],
    size: [1.8, 3.4],
    grav: 1100,
    bounce: 0.15,
    drag: 0.8,
  });
  fx.burst({
    x,
    y: gy,
    z: 10,
    count: 30,
    kind: "drop",
    color: [color, FOAM],
    speed: [30, 160],
    up: [380, 620],
    life: [0.8, 1.2],
    size: [2, 3.6],
    grav: 1100,
    bounce: 0.1,
    drag: 0.6,
  });
  fx.burst({
    x,
    y: gy,
    z: 12,
    count: 14,
    kind: "smoke",
    color: FOAM,
    speed: [40, 160],
    up: [20, 60],
    life: [0.7, 1.2],
    size: [10, 18],
    drag: 2,
  });
  fx.decal({
    kind: "wet",
    x: x + cos * 20,
    y: gy,
    r: r * 2.2,
    color,
    life: 4.5,
  });
  fx.ultimate(color, 850);
  fx.shake(220, 0.006);
  shot(fx.reduced ? 300 : 900, (k) => {
    // 1. The crest collapses forward over the first third.
    const fall = Math.min(1, k / 0.32);
    if (fall < 1) {
      const lift = 46 * (1 - ease(fall)),
        push = 40 * ease(fall),
        w = r * (1 + fall * 0.35);
      const pts = (back: number, up: number) =>
        Array.from({ length: 13 }, (_, i) => {
          const s2 = i / 12 - 0.5,
            bulge = Math.cos(s2 * Math.PI) * 16;
          return {
            x: x + cos * (push + bulge - back) + nx * s2 * 2 * w,
            y:
              y +
              sin * (push + bulge - back) +
              ny * s2 * 2 * w -
              up * Math.cos(s2 * Math.PI),
          };
        });
      fx.solid
        .fillStyle(DEEP, 0.85 * (1 - fall))
        .fillPoints([...pts(50, 0), ...pts(0, lift).reverse()], true);
      fx.solid
        .fillStyle(color, 1 - fall)
        .fillPoints([...pts(40, 6), ...pts(4, lift * 0.9).reverse()], true);
      fx.solid.lineStyle(8, FOAM, 1 - fall).strokePoints(pts(0, lift), false);
    }
    // 2. A geyser column rising then falling back.
    const gk = Math.max(0, Math.min(1, (k - 0.05) / 0.6)),
      h = Math.sin(gk * Math.PI) * 120;
    if (h > 4) {
      // A tapered, see-through jet with wobbling edges and a foam crown.
      const cx = x + cos * 10,
        left: { x: number; y: number }[] = [],
        right: { x: number; y: number }[] = [];
      for (let i = 0; i <= 8; i++) {
        const t = i / 8,
          w = 13 * (1 - t * 0.55),
          wob = Math.sin(k * 28 + i * 1.7) * 2.5,
          py = gy - 6 - h * t;
        left.push({ x: cx - w + wob, y: py });
        right.push({ x: cx + w + wob, y: py });
      }
      const jet = [...left, ...right.reverse()];
      fx.solid.fillStyle(DEEP, 0.35).fillPoints(jet, true);
      fx.solid.fillStyle(color, 0.7).fillPoints(jet, true);
      fx.solid.lineStyle(3, FOAM, 0.75).strokePoints(left.slice(1), false);
      fx.solid
        .fillStyle(FOAM, 0.9)
        .fillCircle(cx, gy - 6 - h, 8)
        .fillCircle(cx - 7, gy - 2 - h, 5)
        .fillCircle(cx + 7, gy - 3 - h, 5);
    }
    // 3. Water floods out across the floor with two foam rings.
    const flood = r * 2.4 * ease(Math.min(1, k * 1.5));
    fx.floorSolid
      .fillStyle(color, 0.3 * (1 - k))
      .fillEllipse(x + cos * 18, gy, flood * 2, flood * 2 * 0.7);
    fx.shockwave(x + cos * 18, gy, flood, k, FOAM, 9, 0.7);
    if (k > 0.15)
      fx.shockwave(
        x + cos * 18,
        gy,
        flood * 0.62 * ease(Math.min(1, (k - 0.15) * 1.8)),
        k,
        color,
        6,
        0.7,
      );
    fx.glow(x, gy - 20, r * 2.4, color, 0.45 * (1 - k));
    fx.glow(x, gy, r * 2.2, color, 0.35 * (1 - k), true);
  });
}

// ───────────── Casts and hits ─────────────
function waterCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 24,
    my = y + Math.sin(angle) * 24;
  fx.burst({
    x: mx,
    y: my,
    z: 14,
    count: a.kind === "barrage" ? 8 : 4,
    kind: "drop",
    color: [color, FOAM],
    angle,
    spread: 0.6,
    speed: [80, 220],
    up: [30, 120],
    life: [0.25, 0.45],
    size: [1.2, 2],
    grav: 1000,
  });
  shot(160, (k) =>
    fx.glow(mx, my - 14, 26 * (1 - k * 0.4), color, 0.5 * (1 - k)),
  );
}
function waterHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  splash(fx, x, y, color, 10, 0.9);
  shot(fx.reduced ? 140 : 340, (k) => {
    fx.glow(x, y - 18, 34 * (1 - k * 0.4), color, 0.45 * (1 - k));
    fx.shockwave(x, y, 40 * ease(k), k, FOAM, 5);
  });
}

// ───────────── Glacelle: a sea angel of the ice shelf ─────────────
const ICE = 0xdff8ff;
const FROST = 0xb8ecff;
const RIME = 0x3a7fb8;
const SQ = 0.82;
/** Run `draw(k)` every frame for `ms` from inside a per-frame draw (zones). */
const shotOn =
  (scene: Phaser.Scene): Shot =>
  (ms, draw) => {
    draw(0);
    scene.tweens.addCounter({
      from: 0,
      to: 1,
      duration: ms,
      onUpdate: (tw) => draw(tw.getValue() ?? 1),
      onComplete: () => undefined,
    });
  };
/** An ice crystal pointing along `rot`: dark rim, pale body, white facet. */
function crystal(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  rot: number,
  color: number,
  alpha = 1,
) {
  const c = Math.cos(rot),
    s = Math.sin(rot),
    p = (f: number, side: number) => ({
      x: x + c * r * f - s * r * side,
      y: y + s * r * f + c * r * side,
    });
  const pts = [
    p(1.7, 0),
    p(0.5, 0.48),
    p(-0.6, 0.42),
    p(-1, 0),
    p(-0.6, -0.42),
    p(0.5, -0.48),
  ];
  fx.solid.fillStyle(RIME, 0.6 * alpha).fillPoints(
    pts.map((q) => ({ x: x + (q.x - x) * 1.18, y: y + (q.y - y) * 1.18 })),
    true,
  );
  fx.solid.fillStyle(color, 0.95 * alpha).fillPoints(pts, true);
  fx.solid
    .fillStyle(ICE, 0.9 * alpha)
    .fillTriangle(pts[0].x, pts[0].y, pts[1].x, pts[1].y, pts[3].x, pts[3].y);
  fx.solid
    .lineStyle(1.2, 0xffffff, 0.95 * alpha)
    .lineBetween(pts[0].x, pts[0].y, pts[3].x, pts[3].y);
}
/** A six-armed snowflake (squashed onto the floor when `sq` < 1). */
function snowflake(g: G, x: number, y: number, r: number, rot: number, sq = 1) {
  for (let i = 0; i < 6; i++) {
    const a = rot + (i * TAU) / 6,
      ex = x + Math.cos(a) * r,
      ey = y + Math.sin(a) * r * sq;
    g.lineBetween(x, y, ex, ey);
    for (const f of [0.45, 0.72]) {
      const bx = x + Math.cos(a) * r * f,
        by = y + Math.sin(a) * r * f * sq,
        l = r * (0.92 - f) * 0.9;
      for (const side of [-1, 1])
        g.lineBetween(
          bx,
          by,
          bx + Math.cos(a + side * 0.7) * l,
          by + Math.sin(a + side * 0.7) * l * sq,
        );
    }
  }
}
function iceShards(
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color: number,
  power = 1,
) {
  fx.burst({
    x,
    y,
    z: 14,
    count: n,
    kind: "debris",
    color: [ICE, color, 0xffffff],
    speed: [60 * power, 220 * power],
    up: [100 * power, 300 * power],
    life: [0.45, 0.8],
    size: [2, 4],
    grav: 1100,
    bounce: 0.3,
  });
  fx.burst({
    x,
    y,
    z: 12,
    count: Math.ceil(n / 2),
    kind: "smoke",
    color: ICE,
    speed: [15, 60 * power],
    up: [10, 40],
    life: [0.4, 0.8],
    size: [6, 11],
    drag: 2,
  });
}
/** Where a frost move will land, as the server places it. */
function frostTarget(
  a: Ability,
  x: number,
  y: number,
  angle: number,
  ax: number,
  ay: number,
) {
  const d = Math.min(a.range, Math.hypot(ax - x, ay - y));
  return { x: x + Math.cos(angle) * d, y: y + Math.sin(angle) * d };
}

// ───────────── Rime Shard and Hailstone ─────────────
function rimeShard(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    dir = Math.atan2(pr.vy, pr.vx),
    hover = 12,
    x = pr.x,
    y = pr.y - hover;
  fx.solid
    .fillStyle(0x000000, 0.16)
    .fillEllipse(pr.x, pr.y + 4, r * 2, r * 0.6);
  fx.g
    .lineStyle(r * 0.9, FROST, 0.22)
    .lineBetween(x - Math.cos(dir) * 60, y - Math.sin(dir) * 60, x, y);
  fx.glow(x, y, r * 2.6, c, 0.4);
  crystal(fx, x, y, r * 0.85, dir, c);
  if (hash(Math.floor(now / 80) + pr.id) > 0.55)
    fx.g
      .lineStyle(1.5, 0xffffff, 0.9)
      .lineBetween(x - r, y, x + r, y)
      .lineBetween(x, y - r * 0.8, x, y + r * 0.8);
  fx.trail(`rs${pr.id}`, 0.035, () =>
    fx.burst({
      x,
      y: pr.y,
      z: hover,
      count: 1,
      kind: "mote",
      color: [ICE, c, 0xffffff],
      speed: [5, 30],
      up: [-10, 20],
      life: [0.3, 0.6],
      size: [1, 1.8],
      drag: 2,
    }),
  );
}
function hailstone(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    dir = Math.atan2(pr.vy, pr.vx),
    hover = 16 + Math.sin(now / 110 + pr.id) * 2,
    x = pr.x,
    y = pr.y - hover,
    spin = now / 90 + pr.id;
  fx.solid
    .fillStyle(0x000000, 0.22)
    .fillEllipse(pr.x, pr.y + 5, r * 2, r * 0.75);
  fx.glow(pr.x, pr.y + 5, r * 2.4, c, 0.25, true);
  // A cold wake of mist.
  for (let i = 1; i <= 3; i++)
    fx.soft(
      x - Math.cos(dir) * r * 1.4 * i,
      y - Math.sin(dir) * r * 1.4 * i,
      r * (1.5 - i * 0.25),
      ICE,
      0.35 - i * 0.08,
    );
  fx.glow(x, y, r * 2.8, c, 0.35);
  // A lumpy layered hailstone: rim, body, inner layer, glint.
  const lump = (rr: number) =>
    Array.from({ length: 9 }, (_, i) => {
      const a = spin + (i * TAU) / 9,
        d = rr * (0.9 + hash(pr.id + i) * 0.18);
      return { x: x + Math.cos(a) * d, y: y + Math.sin(a) * d };
    });
  fx.solid.fillStyle(RIME, 0.75).fillPoints(lump(r * 1.08), true);
  fx.solid.fillStyle(c, 1).fillPoints(lump(r), true);
  fx.solid.fillStyle(ICE, 0.9).fillCircle(x, y, r * 0.62);
  fx.solid
    .lineStyle(1.5, RIME, 0.45)
    .strokeCircle(x + Math.cos(spin) * r * 0.08, y, r * 0.42);
  fx.solid
    .fillStyle(0xffffff, 1)
    .fillCircle(x - r * 0.35, y - r * 0.38, r * 0.22);
  fx.trail(`hs${pr.id}`, 0.04, () =>
    fx.burst({
      x,
      y: pr.y,
      z: hover,
      count: 1,
      kind: "smoke",
      color: ICE,
      speed: [5, 20],
      up: [0, 15],
      life: [0.35, 0.6],
      size: [5, 8],
      drag: 2,
    }),
  );
}
function frostImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    heavy = a.id === "hailstone",
    r = a.radius * (heavy ? 3.4 : 2.4);
  iceShards(fx, x, y, heavy ? 14 : 7, color, heavy ? 1.2 : 0.7);
  if (heavy) {
    fx.decal({ kind: "wet", x, y, r: r * 0.8, color: ICE, life: 3 });
    fx.decal({ kind: "crack", x, y, r: r * 0.6, color, life: 2.5 });
    fx.shake(80, 0.0025);
  }
  shot(fx.reduced ? 160 : heavy ? 420 : 280, (k) => {
    fx.glow(x, y - 12, r * (1 - k * 0.3), color, 0.6 * (1 - k));
    fx.glow(x, y - 12, r * 0.4, 0xffffff, Math.max(0, 1 - k * 3));
    fx.shockwave(x, y, r * ease(k), k, ICE, heavy ? 7 : 4);
    if (heavy) {
      fx.floor.lineStyle(1.5, ICE, 0.8 * (1 - k));
      snowflake(fx.floor, x, y, r * 0.7 * ease(Math.min(1, k * 3)), 0.3, SQ);
    }
  });
}

// ───────────── Frost Bloom: frost spreads, then everything freezes ─────────────
function frostBloomWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  aimX: number,
  aimY: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    t = frostTarget(a, x, y, angle, aimX, aimY),
    r = a.radius;
  fx.floorSolid
    .fillStyle(color, 0.06 + k * 0.08)
    .fillEllipse(t.x, t.y, r * 2, r * 2 * SQ);
  fx.floor.lineStyle(2, color, 0.7).strokeEllipse(t.x, t.y, r * 2, r * 2 * SQ);
  fx.floor.lineStyle(1.5, ICE, 0.3 + k * 0.5);
  snowflake(fx.floor, t.x, t.y, r * 0.3 * k, now / 2000, SQ);
  fx.glow(x, y - 20, 16 + k * 22, color, 0.4 + k * 0.4);
}
function frostBloom(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    c = z.color,
    x = z.x,
    y = z.y,
    strikeAt = Math.min(
      0.95,
      (a.tickDelay ?? 0.5) / Math.max(0.01, a.duration),
    ),
    rot = hash(z.id) * TAU;
  if (progress < strikeAt) {
    // Frost creeps out over the real area as a giant snowflake.
    const k = progress / strikeAt,
      grow = ease(k);
    fx.floorSolid
      .fillStyle(c, 0.1 + k * 0.12)
      .fillEllipse(x, y, r * 2, r * 2 * SQ);
    fx.floorSolid
      .fillStyle(ICE, 0.12 + k * 0.18)
      .fillEllipse(x, y, r * 2 * grow, r * 2 * SQ * grow);
    fx.floor.lineStyle(2.5, c, 0.8).strokeEllipse(x, y, r * 2, r * 2 * SQ);
    fx.floor.lineStyle(2, ICE, 0.75);
    snowflake(fx.floor, x, y, r * 0.95 * grow, rot, SQ);
    fx.glow(x, y, r * (0.4 + grow * 0.7), c, 0.25 + k * 0.35, true);
    // Little crystals sprouting along the arms.
    for (let i = 0; i < 6; i++) {
      const aa = rot + (i * TAU) / 6,
        d = r * 0.95 * grow;
      crystal(
        fx,
        x + Math.cos(aa) * d,
        y + Math.sin(aa) * d * SQ - 4,
        3 + k * 3,
        -Math.PI / 2,
        c,
        0.9,
      );
    }
    fx.trail(`fb${z.id}`, 0.05, () => {
      const aa = Math.random() * TAU,
        d = Math.sqrt(Math.random()) * r * grow;
      fx.burst({
        x: x + Math.cos(aa) * d,
        y: y + Math.sin(aa) * d * SQ,
        count: 1,
        kind: "mote",
        color: [ICE, 0xffffff],
        speed: [0, 10],
        up: [30, 70],
        life: [0.4, 0.7],
        size: [1, 1.6],
        drag: 2,
      });
    });
    return;
  }
  // Freeze: ice spikes punch up across the whole area.
  fx.trail(`fbs${z.id}`, 999, () => {
    iceShards(fx, x, y, 22, c, 1.4);
    fx.decal({ kind: "wet", x, y, r: r * 0.8, color: ICE, life: 1.6 });
    fx.shake(140, 0.004);
    const spikes = Array.from({ length: 14 }, (_, i) => {
      const aa = (i * TAU) / 14 + hash(z.id + i) * 0.4,
        d = r * (0.25 + hash(z.id * 3 + i) * 0.7);
      return {
        x: x + Math.cos(aa) * d,
        y: y + Math.sin(aa) * d * SQ,
        h: 18 + hash(i + 9) * 22,
      };
    });
    shotOn(g.scene)(fx.reduced ? 220 : 620, (k) => {
      const up = Math.sin(Math.min(1, k * 1.4) * Math.PI),
        fade = 1 - k;
      if (k < 0.15) fx.glow(x, y - 20, r, 0xffffff, 0.8 * (1 - k / 0.15));
      fx.glow(x, y, r * 1.1, c, 0.5 * fade, true);
      fx.shockwave(x, y, r * ease(Math.min(1, k * 2.5)), k, ICE, 10);
      fx.floorSolid
        .fillStyle(ICE, 0.25 * fade)
        .fillEllipse(x, y, r * 2, r * 2 * SQ);
      for (const s of spikes) {
        const h = s.h * up;
        if (h <= 0.5) continue;
        fx.solid
          .fillStyle(RIME, 0.55)
          .fillTriangle(s.x - 7, s.y + 1, s.x + 7, s.y + 1, s.x, s.y - h - 2);
        fx.solid
          .fillStyle(c, 0.95)
          .fillTriangle(s.x - 6, s.y, s.x + 6, s.y, s.x, s.y - h);
        fx.solid
          .fillStyle(ICE, 0.95)
          .fillTriangle(s.x - 1.5, s.y, s.x + 3, s.y, s.x, s.y - h * 0.9);
      }
    });
  });
  const k = (progress - strikeAt) / (1 - strikeAt);
  fx.floorSolid
    .fillStyle(ICE, 0.3 * (1 - k))
    .fillEllipse(x, y, r * 2, r * 2 * SQ);
  fx.floor.lineStyle(2, ICE, 0.6 * (1 - k));
  snowflake(fx.floor, x, y, r * 0.95, rot, SQ);
  void now;
}

// ───────────── Frost Breath: a freezing cone of mist ─────────────
function frostBreath(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    spread = Math.acos(a.arc ?? 0.7),
    range = a.range,
    mx = x + Math.cos(angle) * 20,
    my = y + Math.sin(angle) * 20;
  // The real cone, faint, with frosted edges.
  fx.floor
    .fillStyle(color, 0.1)
    .slice(x, y, range, angle - spread, angle + spread);
  fx.floor.fillPath();
  fx.floor.lineStyle(1.5, ICE, 0.35);
  for (const side of [-1, 1])
    fx.floor.lineBetween(
      x,
      y,
      x + Math.cos(angle + side * spread) * range,
      y + Math.sin(angle + side * spread) * range,
    );
  fx.floor
    .lineStyle(2, ICE, 0.45)
    .beginPath()
    .arc(x, y, range, angle - spread, angle + spread)
    .strokePath();
  fx.glow(
    x + Math.cos(angle) * range * 0.55,
    y + Math.sin(angle) * range * 0.55,
    range * 0.6,
    color,
    0.3,
    true,
  );
  // Rolling mist, deterministic so it flows without flicker.
  for (let i = 0; i < 12; i++) {
    const life = (now / 520 + hash(i)) % 1,
      off = (hash(i * 7) - 0.5) * 2 * spread * (0.3 + life * 0.7),
      d = 16 + life * (range - 16),
      px = x + Math.cos(angle + off) * d,
      py = y - 12 + Math.sin(angle + off) * d;
    fx.soft(
      px,
      py,
      8 + life * 24,
      ICE,
      0.42 * (1 - life) * Math.min(1, life * 6),
    );
  }
  // Snowflakes tumbling out on the breath.
  fx.g.lineStyle(1.3, 0xffffff, 0.85);
  for (let i = 0; i < 7; i++) {
    const life = (now / 380 + hash(i + 40)) % 1,
      off = (hash(i * 3 + 40) - 0.5) * 2 * spread * 0.85,
      d = life * range;
    snowflake(
      fx.g,
      x + Math.cos(angle + off) * d,
      y - 12 + Math.sin(angle + off) * d,
      3 + life * 3,
      now / 200 + i,
    );
  }
  fx.glow(mx, my - 14, 22, ICE, 0.7 + Math.sin(now / 40) * 0.15);
  fx.trail(`fbr${Math.round(x)}`, 0.03, () => {
    const life = 0.4;
    fx.burst({
      x: mx,
      y: my,
      z: 12,
      count: 2,
      kind: "mote",
      color: [ICE, color, 0xffffff],
      angle,
      spread: spread * 0.85,
      speed: [(range / life) * 0.7, (range / life) * 1.0],
      up: [0, 30],
      life: [life * 0.8, life * 1.1],
      size: [1, 2],
      drag: 0.9,
    });
  });
}

// ───────────── Whiteout (ultimate): a blizzard that freezes ─────────────
function whiteoutWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  aimX: number,
  aimY: number,
  color: number,
  k: number,
  now: number,
) {
  const fx = fxFor(g.scene),
    t = frostTarget(a, x, y, angle, aimX, aimY),
    r = a.radius;
  fx.floorSolid
    .fillStyle(color, 0.06 + k * 0.1)
    .fillEllipse(t.x, t.y, r * 2, r * 2 * SQ);
  fx.floor
    .lineStyle(2.5, color, 0.75)
    .strokeEllipse(t.x, t.y, r * 2, r * 2 * SQ);
  // Wind gathering into the eye of the storm.
  for (let i = 0; i < 4; i++) {
    const rr = r * (1 - ((now / 900 + i / 4) % 1) * (0.6 + k * 0.3));
    fx.floor
      .lineStyle(1.5, ICE, 0.3 + k * 0.4)
      .strokeEllipse(t.x, t.y, rr * 2, rr * 2 * SQ);
  }
  fx.glow(t.x, t.y, r * (0.3 + k * 0.5), ICE, 0.2 + k * 0.3, true);
  fx.glow(x, y - 22, 20 + k * 40, color, 0.4 + k * 0.5);
  fx.glow(x, y - 22, 8 + k * 12, 0xffffff, 0.5 + k * 0.5);
}
function whiteout(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    c = z.color,
    x = z.x,
    y = z.y,
    strikeAt = Math.min(0.9, (a.tickDelay ?? 0.3) / Math.max(0.01, a.duration)),
    fade =
      progress > 0.88 ? (1 - progress) / 0.12 : Math.min(1, progress / 0.05),
    t = progress * a.duration,
    every = Math.max(0.1, a.tickInterval ?? 0.45),
    since = t - (a.tickDelay ?? 0.3),
    gust = since >= 0 ? 1 - Math.min(1, (since % every) / (every * 0.5)) : 0,
    spin = now / 420;
  // The first gust: the freeze, the screen goes white for a beat.
  if (progress >= strikeAt)
    fx.trail(`wo${z.id}`, 999, () => {
      fx.ultimate(ICE, 1000);
      fx.shake(260, 0.006);
      iceShards(fx, x, y, 30, c, 1.8);
      fx.decal({ kind: "wet", x, y, r: r * 0.9, color: ICE, life: a.duration });
      shotOn(g.scene)(fx.reduced ? 240 : 700, (k) => {
        if (k < 0.2)
          fx.glow(x, y - 30, r * 1.2, 0xffffff, 0.85 * (1 - k / 0.2));
        fx.shockwave(x, y, r * ease(Math.min(1, k * 2)), k, 0xffffff, 16);
        fx.shockwave(x, y, r * 0.7 * ease(Math.min(1, k * 2.4)), k, c, 10);
      });
    });
  // Frosted floor and the real edge of the storm.
  const on = progress >= strikeAt ? 1 : progress / strikeAt;
  fx.floorSolid
    .fillStyle(ICE, (0.1 + on * 0.16) * fade)
    .fillEllipse(x, y, r * 2, r * 2 * SQ);
  fx.glow(x, y, r * 1.05, c, (0.25 + gust * 0.2) * fade, true);
  fx.floor
    .lineStyle(3, c, (0.6 + gust * 0.3) * fade)
    .strokeEllipse(x, y, r * 2, r * 2 * SQ);
  fx.floor
    .lineStyle(1.5, 0xffffff, (0.4 + gust * 0.5) * fade)
    .strokeEllipse(x, y, r * 2 * 0.97, r * 2 * SQ * 0.97);
  // Wind: arcs whirling round the eye at a few heights.
  for (let i = 0; i < 9; i++) {
    const rr = r * (0.3 + hash(z.id + i) * 0.65),
      a0 = spin * (1.4 - rr / r) + (i * TAU) / 9,
      lift = 10 + hash(i * 5) * 30,
      len = 0.6 + hash(i * 3) * 0.6,
      pts = Array.from({ length: 8 }, (_, j) => {
        const aa = a0 + (j / 7) * len;
        return {
          x: x + Math.cos(aa) * rr,
          y: y - lift + Math.sin(aa) * rr * SQ,
        };
      });
    fx.g
      .lineStyle(2, i % 2 ? 0xffffff : ICE, 0.5 * on * fade)
      .strokePoints(pts, false);
  }
  // Mist banks rolling round, keeping the storm dense.
  for (let i = 0; i < 6; i++) {
    const aa = -spin * 0.6 + (i * TAU) / 6,
      d = r * 0.6;
    fx.soft(
      x + Math.cos(aa) * d,
      y - 16 + Math.sin(aa) * d * SQ,
      r * 0.45,
      ICE,
      0.28 * on * fade,
      0.6,
    );
  }
  // Snow: flakes swept round the eye, each on its own orbit.
  for (let i = 0; i < 36; i++) {
    const orbit = Math.sqrt(hash(z.id + i * 7)) * r,
      aa = hash(i * 13) * TAU + (now / 1000) * (2.4 - orbit / r) * 1.4,
      h = ((now / 1000) * (40 + hash(i) * 30) + hash(i * 3) * 60) % 60,
      px = x + Math.cos(aa) * orbit,
      py = y + Math.sin(aa) * orbit * SQ - 60 + h;
    fx.g
      .fillStyle(0xffffff, 0.9 * on * fade)
      .fillCircle(px, py, 1.2 + hash(i * 11) * 1.6);
  }
  fx.g.lineStyle(1.3, 0xffffff, 0.8 * on * fade);
  for (let i = 0; i < 5; i++) {
    const aa = spin * 1.5 + (i * TAU) / 5,
      d = r * (0.35 + hash(i + 70) * 0.5);
    snowflake(
      fx.g,
      x + Math.cos(aa) * d,
      y - 30 + Math.sin(aa) * d * SQ,
      5,
      now / 150 + i,
    );
  }
  fx.trail(`wos${z.id}`, 0.04, () => {
    const aa = Math.random() * TAU,
      d = r * (0.8 + Math.random() * 0.2);
    fx.burst({
      x: x + Math.cos(aa) * d,
      y: y + Math.sin(aa) * d * SQ,
      z: 20,
      count: 1,
      kind: "mote",
      color: [0xffffff, ICE],
      angle: aa + Math.PI / 2,
      spread: 0.2,
      speed: [120, 200],
      up: [-10, 20],
      life: [0.4, 0.7],
      size: [1, 2],
      drag: 1,
    });
  });
}

/** Glacelle's shots leave her fins in a puff of frost and ice motes. */
function frostCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    mx = x + Math.cos(angle) * 22,
    my = y + Math.sin(angle) * 22,
    big = a.id === "hailstone";
  fx.burst({
    x: mx,
    y: my,
    z: 14,
    count: big ? 7 : 4,
    kind: "mote",
    color: [ICE, color, 0xffffff],
    angle,
    spread: 0.7,
    speed: [60, 180],
    up: [10, 60],
    life: [0.25, 0.45],
    size: [1, 1.8],
    drag: 3,
  });
  fx.burst({
    x: mx,
    y: my,
    z: 14,
    count: big ? 3 : 1,
    kind: "smoke",
    color: ICE,
    angle,
    spread: 0.5,
    speed: [20, 60],
    up: [0, 20],
    life: [0.3, 0.5],
    size: [5, 9],
    drag: 2,
  });
  shot(160, (k) =>
    fx.glow(mx, my - 14, (big ? 30 : 22) * (1 - k * 0.4), color, 0.6 * (1 - k)),
  );
}

/**
 * Gill Siphon: the stream of water from Tidefin's gills to the enemy it is
 * locked onto, drawn each frame while the server holds the tether. Droplets
 * flow back along it to Tidefin (the drain).
 */
export function drawSiphon(
  scene: Phaser.Scene,
  x: number,
  y: number,
  tx: number,
  ty: number,
  now: number,
  color: number,
) {
  const fx = fxFor(scene),
    sx = x,
    sy = y - 16,
    ex = tx,
    ey = ty - 16,
    len = Math.hypot(ex - sx, ey - sy) || 1,
    nx = -(ey - sy) / len,
    ny = (ex - sx) / len;
  const pts = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12,
      w = Math.sin(t * Math.PI * 3 - now / 80) * 6 * Math.sin(t * Math.PI);
    return { x: sx + (ex - sx) * t + nx * w, y: sy + (ey - sy) * t + ny * w };
  });
  fx.g.lineStyle(9, DEEP, 0.35).strokePoints(pts, false);
  fx.g.lineStyle(5, color, 0.75).strokePoints(pts, false);
  fx.g.lineStyle(2, FOAM, 0.85).strokePoints(pts, false);
  // Droplets flowing home.
  for (let i = 0; i < 4; i++) {
    const t = 1 - ((now / 500 + i / 4) % 1);
    fx.glow(sx + (ex - sx) * t, sy + (ey - sy) * t, 7, FOAM, 0.8);
  }
  fx.glow(ex, ey, 22, color, 0.4);
}
export const waterKit: FxKit = {
  projectile: {
    "tide-needle": tideNeedle,
    "riptide-wave": riptideWave,
    "rime-shard": rimeShard,
    hailstone,
  },
  zone: { undertow, "frost-bloom": frostBloom, whiteout },
  windup: {
    "riptide-wave": riptideWindup,
    "frost-bloom": frostBloomWindup,
    whiteout: whiteoutWindup,
  },
  channel: { "frost-breath": frostBreath },
  cast: {
    "tide-needle": waterCast,
    "gill-siphon": waterCast,
    undertow: waterCast,
    "riptide-wave": waterCast,
    "rime-shard": frostCast,
    hailstone: frostCast,
    "tide-double": (scene, a, x, y, angle, color, shot) => {
      mirrorMist(scene, a, x, y, angle, color, shot);
      // Axolotls regrow: a little green rise as Tidefin slips away.
      if (a.heal)
        fxFor(scene).burst({
          x,
          y: y - 18,
          z: 10,
          count: 6,
          kind: "mote",
          color: [0x7dffb0, FOAM],
          speed: [10, 40],
          up: [60, 110],
          life: [0.6, 1],
          size: [1.5, 2.4],
          drag: 2,
        });
    },
  },
  impact: {
    "tide-needle": needleImpact,
    "riptide-wave": riptideImpact,
    "rime-shard": frostImpact,
    hailstone: frostImpact,
  },
  hit: { water: waterHit },
};

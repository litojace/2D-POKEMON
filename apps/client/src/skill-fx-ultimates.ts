import { fxFor } from "./fx-engine";
import { TAU, ease, hash, type FxKit } from "./fx-kits";
/**
 * Ultimate set pieces, layered on top of each fighter's kit. Every ultimate
 * gets a screen-wide "moment" and a signature beat of its own. Hit areas are
 * unchanged: every size still comes from the ability.
 */
const WHITE = 0xffffff;
const SQ = 0.82;
type CastFn = NonNullable<FxKit["cast"]>[string];
type ZoneFn = NonNullable<FxKit["zone"]>[string];
type WindupFn = NonNullable<FxKit["windup"]>[string];
type ImpactFn = NonNullable<FxKit["impact"]>[string];
const then =
  <A extends unknown[]>(
    base: ((...a: A) => void) | undefined,
    extra: (...a: A) => void,
  ) =>
  (...a: A) => {
    base?.(...a);
    extra(...a);
  };
/** Run `fn` once per call site and moment (for set pieces inside a shot). */
const onceAt = () => {
  const done = new Set<number>();
  return (key: number, fn: () => void) => {
    if (!done.has(key)) {
      done.add(key);
      fn();
    }
  };
};

// ───────────── Voltkit · Overcharge: sky strikes, crackling floor ─────────────
const overcharge: CastFn = (scene, a, x, y, _angle, color, shot) => {
  const fx = fxFor(scene),
    r = a.radius,
    once = onceAt();
  fx.ultimate(color);
  const strikes = Array.from({ length: 5 }, (_, i) => {
    const ang = (i * TAU) / 5 + hash(x + i) * 0.6;
    return {
      x: x + Math.cos(ang) * r * 0.82,
      y: y + Math.sin(ang) * r * 0.82 * SQ,
      at: 0.08 + i * 0.07,
    };
  });
  shot(fx.reduced ? 300 : 1100, (k) => {
    for (const [i, s] of strikes.entries()) {
      const kk = (k - s.at) / 0.14;
      if (kk < 0 || kk > 1) continue;
      once(i, () => {
        fx.burst({
          x: s.x,
          y: s.y,
          count: 14,
          kind: "spark",
          color: [color, WHITE],
          speed: [80, 260],
          up: [120, 340],
          life: [0.3, 0.6],
          size: [1, 1.8],
          grav: 1000,
        });
        fx.decal({ kind: "scorch", x: s.x, y: s.y, r: 22, color, life: 3.5 });
        fx.shake(90, 0.004);
      });
      fx.bolt(s.x + 30, s.y - 560, s.x, s.y, WHITE, {
        width: 4 * (1 - kk) + 1,
        jag: 0.1,
        branches: 2,
        seed: i * 7 + Math.floor(k * 30),
      });
      fx.glow(s.x, s.y, 60 * (1 - kk), color, 0.9 * (1 - kk));
      fx.glow(s.x, s.y, 40, color, 0.6 * (1 - kk), true);
    }
    // The floor stays live: arcs skitter around the rim before dying out.
    const live = Math.max(0, 1 - Math.max(0, k - 0.45) / 0.55);
    if (k > 0.3 && live > 0) {
      const seed = Math.floor(k * 40);
      for (let i = 0; i < 3; i++) {
        const a0 = hash(seed + i) * TAU,
          a1 = a0 + 0.5 + hash(seed - i) * 0.8;
        fx.bolt(
          x + Math.cos(a0) * r * 0.9,
          y + Math.sin(a0) * r * 0.9 * SQ,
          x + Math.cos(a1) * r * 0.9,
          y + Math.sin(a1) * r * 0.9 * SQ,
          color,
          {
            width: 1.6,
            jag: 0.3,
            seed: seed + i * 5,
            alpha: live,
            onFloor: true,
          },
        );
      }
      fx.floor
        .lineStyle(3, color, 0.5 * live)
        .strokeEllipse(x, y, r * 1.8, r * 1.8 * SQ);
    }
  });
};

// ───────────── Cindrake · Sunfire Pillar: sun sigil, sunbeam, molten pool ─────────────
const sunfire: ZoneFn = (g, z, progress, now) => {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    c = z.color,
    strikeAt = (a.tickDelay ?? 0.35) / a.duration;
  if (progress < strikeAt) {
    // The sun sigil fills with heat like a gauge; rays turn faster as it charges.
    const k = progress / strikeAt;
    fx.floor
      .fillStyle(0xff7a2a, 0.25 + k * 0.3)
      .fillEllipse(z.x, z.y, r * 1.6 * k, r * 1.6 * SQ * k);
    for (let i = 0; i < 8; i++) {
      const ang = (i * TAU) / 8 - now / (400 - k * 250),
        p1 = {
          x: z.x + Math.cos(ang - 0.12) * r * 0.55,
          y: z.y + Math.sin(ang - 0.12) * r * 0.55 * SQ,
        },
        p2 = {
          x: z.x + Math.cos(ang + 0.12) * r * 0.55,
          y: z.y + Math.sin(ang + 0.12) * r * 0.55 * SQ,
        },
        tip = {
          x: z.x + Math.cos(ang) * r * (0.85 + k * 0.1),
          y: z.y + Math.sin(ang) * r * (0.85 + k * 0.1) * SQ,
        };
      fx.floor
        .fillStyle(0xffc65a, 0.35 + k * 0.5)
        .fillTriangle(p1.x, p1.y, p2.x, p2.y, tip.x, tip.y);
    }
    // A thin shaft of sunlight starts to break through overhead.
    fx.glow(z.x, z.y - 300, 30 + k * 30, 0xfff4c8, 0.15 + k * 0.35, false, 9);
    return;
  }
  const k = (progress - strikeAt) / (1 - strikeAt);
  fx.trail(`ult-sun${z.id}`, 999, () => {
    fx.ultimate(c, 900);
    fx.decal({ kind: "molten", x: z.x, y: z.y, r: r * 0.7, color: c, life: 5 });
    fx.shake(260, 0.008);
  });
  // The sunbeam slams down: a blinding white core for the first beat.
  if (k < 0.3) {
    const b = 1 - k / 0.3;
    fx.glow(z.x, z.y - 320, r * 0.5, 0xfff4c8, 0.95 * b, false, 7);
    fx.glow(z.x, z.y - 10, r * 1.4, WHITE, 0.6 * b);
  }
  // Heat shimmer rings lifting off the molten ground.
  for (let i = 0; i < 3; i++) {
    const t = (k * 1.6 + i / 3) % 1;
    fx.g
      .lineStyle(2, 0xffd27a, 0.5 * (1 - t))
      .strokeEllipse(
        z.x,
        z.y - 20 - t * 110,
        r * (1.1 - t * 0.4) * 2,
        r * (1.1 - t * 0.4) * 2 * 0.35,
      );
  }
};

// ───────────── Auralynx · Crystal Cage: the screen flashes crystal ─────────────
// (The spires themselves are the zone, drawn for as long as the cage stands.)
const cage: CastFn = (scene, a, x, y, _angle, color) => {
  const fx = fxFor(scene),
    r = a.radius;
  fx.ultimate(color);
  for (let i = 0; i < 12; i++) {
    const ang = (i * TAU) / 12;
    fx.burst({
      x: x + Math.cos(ang) * r,
      y: y + Math.sin(ang) * r * SQ,
      z: 30,
      count: 6,
      kind: "mote",
      color: [0xffffff, color, 0xdff4ff],
      speed: [20, 90],
      up: [40, 140],
      life: [0.5, 1],
      size: [1, 2.2],
      drag: 2,
    });
  }
};

// ───────────── Lumoth · Radiant Flare: a small sun rises, then lights up ─────────────
const flareWindup: WindupFn = (g, _a, x, y, _angle, _ax, _ay, color, k) => {
  const fx = fxFor(g.scene),
    sy = y - 30 - ease(k) * 60,
    rr = 8 + k * 18;
  fx.glow(x, sy, rr * 4, color, 0.5 + k * 0.4);
  fx.solid.fillStyle(0x4a3a18, 0.3).fillCircle(x, sy, rr * 1.1);
  fx.solid.fillStyle(0xffd76a, 1).fillCircle(x, sy, rr);
  fx.solid
    .fillStyle(0xfff6d6, 1)
    .fillCircle(x - rr * 0.2, sy - rr * 0.2, rr * 0.6);
  // Corona spikes slowly turning.
  for (let i = 0; i < 8; i++) {
    const ang = (i * TAU) / 8 + k * 2;
    fx.g
      .lineStyle(2, 0xffd76a, 0.8)
      .lineBetween(
        x + Math.cos(ang) * rr * 1.25,
        sy + Math.sin(ang) * rr * 1.25,
        x + Math.cos(ang) * rr * 1.8,
        sy + Math.sin(ang) * rr * 1.8,
      );
  }
};
const radiant: CastFn = (scene, a, x, y, _angle, color, shot) => {
  const fx = fxFor(scene),
    sy = y - 90;
  fx.ultimate(0xffd76a, 850);
  // Starlight falls slowly over the whole blast area.
  fx.burst({
    x,
    y,
    z: 160,
    count: 40,
    kind: "mote",
    color: [0xffd76a, 0xfff6d6, color],
    speed: [20, a.range * 0.9],
    up: [-30, 10],
    life: [1, 1.6],
    size: [1.2, 2.4],
    grav: 60,
    drag: 1.2,
  });
  shot(fx.reduced ? 260 : 800, (k) => {
    const b = Math.max(0, 1 - k / 0.35);
    // The sun bursts: a white disc expanding and an anamorphic streak.
    fx.glow(x, sy, 40 + ease(Math.min(1, k * 3)) * 120, WHITE, 0.9 * b);
    fx.glow(x, sy, a.range * 1.6, 0xffd76a, 0.55 * b, false, 0.05);
    fx.glow(x, sy, a.range * 0.9, WHITE, 0.7 * b, false, 0.03);
    fx.g
      .lineStyle(3, 0xfff6d6, 0.8 * b)
      .strokeCircle(x, sy, 30 + ease(k) * 140);
  });
};

// ───────────── Mystowl · Mind Maze: the great eye, weightless debris ─────────────
const thought: ZoneFn = (g, z, progress, now) => {
  const fx = fxFor(g.scene),
    a = z.ability,
    c = z.color,
    strikeAt = (a.tickDelay ?? 0.35) / a.duration,
    ex = z.x,
    ey = z.y - 170;
  if (progress < strikeAt) {
    // A great eye opens, its pupil narrowing onto the target.
    const k = progress / strikeAt,
      open = ease(Math.min(1, k * 1.5)),
      w = 120,
      h = 54 * open;
    fx.glow(ex, ey, 140, c, 0.25 + 0.35 * open);
    const lid = (dir: number) =>
      Array.from({ length: 13 }, (_, i) => {
        const t = i / 12 - 0.5;
        return { x: ex + t * w * 2, y: ey + dir * Math.cos(t * Math.PI) * h };
      });
    const shape = [...lid(-1), ...lid(1).reverse()];
    fx.solid.fillStyle(0x2a1446, 0.55).fillPoints(shape, true);
    fx.solid.fillStyle(0xfdf5ff, 0.95).fillPoints(shape, true);
    const iris = h * 0.9;
    if (iris > 2) {
      fx.solid.fillStyle(c, 1).fillCircle(ex, ey, iris);
      fx.solid
        .fillStyle(0x1b0d30, 1)
        .fillEllipse(ex, ey, iris * (0.5 - k * 0.32), iris * 1.4);
      fx.solid
        .fillStyle(WHITE, 0.9)
        .fillCircle(ex - iris * 0.35, ey - iris * 0.35, iris * 0.18);
    }
    fx.solid.lineStyle(4, 0x2a1446, 0.9).strokePoints(shape, true);
    // A thin line of sight from eye to target.
    fx.g.lineStyle(2, c, 0.25 + 0.5 * k).lineBetween(ex, ey + h, z.x, z.y - 20);
    return;
  }
  const k = (progress - strikeAt) / (1 - strikeAt);
  fx.trail(`ult-ts${z.id}`, 999, () => {
    fx.ultimate(c, 850);
    // Debris lifts off weightlessly, hangs, then drifts back down.
    fx.burst({
      x: z.x,
      y: z.y,
      z: 4,
      count: 26,
      kind: "debris",
      color: [0x8a7f74, 0x6d6460, 0x9c9389],
      speed: [20, z.radius * 1.2],
      up: [120, 220],
      life: [1.2, 1.8],
      size: [2.5, 5],
      grav: 140,
      drag: 2.2,
      bounce: 0.2,
    });
    fx.shake(240, 0.008);
  });
  // The eye snaps shut as the blow lands.
  if (k < 0.25) {
    const b = 1 - k / 0.25;
    fx.solid
      .lineStyle(5, 0x2a1446, 0.9 * b)
      .lineBetween(ex - 120, ey, ex + 120, ey);
    fx.glow(ex, ey, 120, c, 0.6 * b);
    fx.glow((ex + z.x) / 2, (ey + z.y) / 2, 60, WHITE, 0.6 * b, false, 3);
  }
  // Glowing fissures in the floor.
  fx.floor.lineStyle(3, c, 0.7 * (1 - k));
  for (let i = 0; i < 8; i++) {
    const ang = (i * TAU) / 8 + hash(z.id + i) * 0.4,
      len = z.radius * (0.6 + hash(i) * 0.4) * ease(Math.min(1, k * 3));
    fx.floor.lineBetween(
      z.x,
      z.y,
      z.x + Math.cos(ang) * len,
      z.y + Math.sin(ang) * len * SQ,
    );
  }
  void now;
};

// ───────────── Terradon · Tremor: rock pillars, dust wall, falling boulders ─────────────
const tremor: CastFn = (scene, a, x, y, _angle, _color, shot) => {
  const fx = fxFor(scene),
    r = a.radius,
    once = onceAt();
  fx.ultimate(0xd9bf8f, 900);
  const pillars = Array.from({ length: 6 }, (_, i) => {
    const ang = (i * TAU) / 6 + 0.5,
      d = r * (0.5 + hash(i * 7) * 0.3);
    return {
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d * SQ,
      h: 60 + hash(i) * 40,
      w: 16 + hash(i * 3) * 8,
      at: (d / r) * 0.3,
    };
  });
  const boulders = Array.from({ length: 4 }, (_, i) => {
    const ang = hash(x + i * 11) * TAU,
      d = r * (0.3 + hash(y + i) * 0.6);
    return {
      x: x + Math.cos(ang) * d,
      y: y + Math.sin(ang) * d * SQ,
      at: 0.25 + i * 0.1,
      size: 12 + hash(i * 13) * 8,
    };
  });
  shot(fx.reduced ? 360 : 1300, (k) => {
    for (const p of pillars) {
      const kk = (k - p.at) / 0.6;
      if (kk <= 0 || kk >= 1) continue;
      const up =
          kk < 0.2 ? ease(kk / 0.2) : kk < 0.7 ? 1 : 1 - (kk - 0.7) / 0.3,
        h = p.h * up;
      fx.solid
        .fillStyle(0x000000, 0.25)
        .fillEllipse(p.x + 8, p.y + 3, p.w * 2.8, p.w);
      fx.solid.fillStyle(0x6e604f, 1).fillPoints(
        [
          { x: p.x - p.w, y: p.y },
          { x: p.x - p.w * 0.6, y: p.y - h },
          { x: p.x + p.w * 0.2, y: p.y - h - 8 },
          { x: p.x, y: p.y + 4 },
        ],
        true,
      );
      fx.solid.fillStyle(0xa8977d, 1).fillPoints(
        [
          { x: p.x, y: p.y + 4 },
          { x: p.x + p.w * 0.2, y: p.y - h - 8 },
          { x: p.x + p.w * 0.7, y: p.y - h + 4 },
          { x: p.x + p.w, y: p.y },
        ],
        true,
      );
      fx.solid
        .lineStyle(2, 0x3b2f24, 0.6)
        .lineBetween(
          p.x - p.w * 0.3,
          p.y - h * 0.3,
          p.x + p.w * 0.1,
          p.y - h * 0.55,
        );
    }
    // A wall of dust rolling outward past the ring.
    const wall = r * (0.4 + ease(Math.min(1, k * 1.4)) * 0.85);
    const dust = Math.max(0, 1 - k * 1.1);
    for (let i = 0; i < 18; i++) {
      const ang = (i * TAU) / 18 + hash(i) * 0.2;
      fx.soft(
        x + Math.cos(ang) * wall,
        y + Math.sin(ang) * wall * SQ - 10,
        22 + hash(i * 5) * 10,
        0xd9bf8f,
        0.55 * dust,
        0.8,
      );
    }
    // Boulders dropping in from above, each landing with a thud.
    for (const [i, b] of boulders.entries()) {
      const kk = (k - b.at) / 0.18;
      if (kk < 0) continue;
      if (kk >= 1) {
        once(i, () => {
          fx.burst({
            x: b.x,
            y: b.y,
            count: 10,
            kind: "debris",
            color: [0x8a7a66, 0x6e604f, 0xa8977d],
            speed: [60, 200],
            up: [100, 260],
            life: [0.6, 1],
            size: [2.5, 4.5],
            grav: 1100,
          });
          fx.burst({
            x: b.x,
            y: b.y,
            z: 4,
            count: 5,
            kind: "smoke",
            color: [0xd9bf8f, 0xc4a678],
            speed: [40, 120],
            up: [10, 40],
            life: [0.6, 1],
            size: [10, 16],
            drag: 3,
          });
          fx.decal({
            kind: "crack",
            x: b.x,
            y: b.y,
            r: 34,
            color: 0x6b5640,
            life: 3,
          });
          fx.shake(80, 0.004);
        });
        continue;
      }
      const height = (1 - kk * kk) * 420;
      fx.solid
        .fillStyle(0x000000, 0.12 + kk * 0.2)
        .fillEllipse(
          b.x,
          b.y + 2,
          b.size * 2.4 * (0.5 + kk * 0.5),
          b.size * (0.5 + kk * 0.5),
        );
      fx.solid.fillStyle(0x6e604f, 1).fillCircle(b.x, b.y - height, b.size);
      fx.solid
        .fillStyle(0xa8977d, 1)
        .fillCircle(
          b.x - b.size * 0.25,
          b.y - height - b.size * 0.25,
          b.size * 0.6,
        );
    }
  });
};

// ───────────── Duskveil · Void Orb: the lights go out, tendrils lash out ─────────────
const voidOrb: ImpactFn = (scene, a, x, y, color, shot) => {
  const fx = fxFor(scene),
    blast = a.explosion ?? 120;
  fx.ultimate(0x150b26, 1000, true);
  fx.decal({ kind: "wet", x, y, r: blast * 0.8, color: 0x150b26, life: 4.5 });
  const tendrils = Array.from({ length: 7 }, (_, i) => ({
    ang: (i * TAU) / 7 + hash(x + i) * 0.5,
    curl: (hash(i * 3) - 0.5) * 1.6,
    len: blast * (0.9 + hash(i) * 0.5),
  }));
  shot(fx.reduced ? 300 : 1000, (k) => {
    if (k < 0.3) return; // the orb's own implosion plays first
    const kk = (k - 0.3) / 0.7,
      reach = ease(Math.min(1, kk * 2.2)),
      fade = kk > 0.6 ? 1 - (kk - 0.6) / 0.4 : 1;
    for (const t of tendrils) {
      const pts: { x: number; y: number }[] = [];
      for (let i = 0; i <= 10; i++) {
        const s = i / 10,
          bend = t.curl * s * s + Math.sin(kk * 12 + s * 5 + t.ang) * 0.15 * s,
          d = t.len * reach * s;
        pts.push({
          x: x + Math.cos(t.ang + bend) * d,
          y: y + Math.sin(t.ang + bend) * d * SQ,
        });
      }
      // Tapered: draw from thick root to thin tip.
      for (let i = 0; i < pts.length - 1; i++) {
        const w = 12 * (1 - i / pts.length);
        fx.floorSolid
          .lineStyle(w + 3, 0x05020c, 0.75 * fade)
          .lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        fx.floor
          .lineStyle(Math.max(1, w * 0.3), color, 0.7 * fade)
          .lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
    }
  });
};

// ───────────── Second pass: the physical side of every older ultimate ─────────────
// Each set piece above gets what it would really throw about: debris that
// falls and bounces, smoke and dust that roll and settle, marks left on the
// floor, things pulled in or blown away.
type BeamFn = NonNullable<FxKit["beam"]>[string];
type ProjectileFn = NonNullable<FxKit["projectile"]>[string];
type Fx = ReturnType<typeof fxFor>;
const ring = (n: number, f: (a: number, i: number) => void) => {
  for (let i = 0; i < n; i++) f((i / n) * TAU, i);
};
const rocks = (
  fx: Fx,
  x: number,
  y: number,
  n: number,
  speed: [number, number],
  size: [number, number] = [2.5, 5],
  color = [0x8a7a64, 0x6b5a48, 0xa8957a],
) =>
  fx.burst({
    x,
    y,
    z: 6,
    count: n,
    kind: "debris",
    color,
    speed,
    up: [200, 460],
    life: [0.7, 1.2],
    size,
    grav: 1100,
    bounce: 0.35,
  });
const dustRing = (
  fx: Fx,
  x: number,
  y: number,
  r: number,
  color = [0xc4a678, 0xd9bf8f],
) =>
  ring(18, (a) =>
    fx.burst({
      x: x + Math.cos(a) * 30,
      y: y + Math.sin(a) * 15,
      z: 4,
      count: 1,
      kind: "smoke",
      color,
      angle: a,
      spread: 0.1,
      speed: [r * 0.9, r * 1.3],
      up: [5, 30],
      life: [0.7, 1.1],
      size: [14, 22],
      drag: 2.2,
    }),
  );

/** Overcharge: fulgurite scorches, spark showers off the rim, ozone rising. */
const overchargePhysics: CastFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.radius;
  fx.decal({ kind: "scorch", x, y, r: r * 0.6, color: 0x9fe8ff, life: 4 });
  ring(6, (aa) => {
    const px = x + Math.cos(aa) * r * 0.8,
      py = y + Math.sin(aa) * r * 0.8 * SQ;
    fx.burst({
      x: px,
      y: py,
      z: 10,
      count: 8,
      kind: "spark",
      color: [WHITE, 0xfff6c2, 0x9fe8ff],
      speed: [80, 260],
      up: [150, 380],
      life: [0.4, 0.8],
      size: [0.9, 1.7],
      grav: 1100,
      bounce: 0.45,
    });
  });
  fx.burst({
    x,
    y,
    z: 20,
    count: 10,
    kind: "smoke",
    color: [0x6a7488, 0x9aa4b8],
    speed: [20, 80],
    up: [40, 90],
    life: [1, 1.6],
    size: [14, 22],
    grav: -20,
    drag: 1.2,
  });
};
/** Electromagnet: filings and grit dragged in from the rim, sparks at the core. */
const electromagnetPhysics: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene),
    r = z.radius;
  if (progress > 0.95) return;
  fx.trail(`em-pull${z.id}`, 0.03, () => {
    const aa = Math.random() * TAU,
      px = z.x + Math.cos(aa) * r,
      py = z.y + Math.sin(aa) * r * SQ;
    fx.burst({
      x: px,
      y: py,
      z: 6,
      count: 1,
      kind: "debris",
      color: [0xd4dde9, 0x8a94a4, 0x6b5a48],
      angle: aa + Math.PI,
      spread: 0.15,
      speed: [r * 1.2, r * 1.8],
      up: [10, 40],
      life: [0.45, 0.6],
      size: [1.2, 2.2],
      drag: 0.4,
    });
  });
  fx.trail(`em-core${z.id}`, 0.08, () =>
    fx.burst({
      x: z.x,
      y: z.y,
      z: 20,
      count: 2,
      kind: "spark",
      color: [WHITE, 0xff5f57, 0x9fe8ff],
      speed: [60, 180],
      up: [80, 220],
      life: [0.3, 0.5],
      size: [0.9, 1.5],
      grav: 1000,
      bounce: 0.4,
    }),
  );
};
/** Riptide Wave: the wall of water throws spray and foam and soaks the floor. */
const riptidePhysics: ProjectileFn = (g, pr) => {
  const fx = fxFor(g.scene),
    dir = Math.atan2(pr.vy, pr.vx),
    r = pr.ability.radius;
  fx.trail(`rw-spray${pr.id}`, 0.03, () => {
    for (const side of [-1, 1])
      fx.burst({
        x: pr.x - Math.sin(dir) * r * side,
        y: pr.y + Math.cos(dir) * r * side,
        z: 20,
        count: 2,
        kind: "drop",
        color: [0x6fd3ff, 0xf2fdff, 0x3fa9e0],
        angle: dir + side * 1.2,
        spread: 0.5,
        speed: [80, 220],
        up: [200, 420],
        life: [0.45, 0.8],
        size: [1.6, 3],
        grav: 1150,
        bounce: 0.1,
      });
    fx.burst({
      x: pr.x,
      y: pr.y,
      z: 30,
      count: 1,
      kind: "smoke",
      color: [0xf2fdff, 0xd6f3ff],
      angle: dir + Math.PI,
      spread: 0.4,
      speed: [40, 90],
      up: [20, 60],
      life: [0.5, 0.8],
      size: [14, 22],
      drag: 1.6,
    });
  });
  fx.trail(`rw-wet${pr.id}`, 0.12, () =>
    fx.decal({
      kind: "wet",
      x: pr.x,
      y: pr.y,
      r: r * 0.9,
      color: 0x3fa9e0,
      life: 2.5,
    }),
  );
};
const riptideCrash: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = Math.max(a.explosion ?? 0, a.radius * 2);
  fx.decal({ kind: "wet", x, y, r: r * 1.2, color: 0x3fa9e0, life: 3.5 });
  fx.burst({
    x,
    y,
    z: 10,
    count: 34,
    kind: "drop",
    color: [0x6fd3ff, 0xf2fdff, 0x3fa9e0],
    speed: [80, 320],
    up: [220, 520],
    life: [0.6, 1],
    size: [1.8, 3.4],
    grav: 1150,
    bounce: 0.1,
  });
  dustRing(fx, x, y, r, [0xf2fdff, 0xd6f3ff]);
  fx.shake(200, 0.006);
};
/** Whiteout: snow driving sideways, ice chips, frost on the floor. */
const whiteoutPhysics: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene),
    r = z.radius,
    wind = 0.4;
  fx.trail(`wo-frost${z.id}`, 999, () =>
    fx.decal({
      kind: "wet",
      x: z.x,
      y: z.y,
      r: r * 0.95,
      color: 0xdff8ff,
      life: z.ability.duration + 1.5,
    }),
  );
  if (progress > 0.95) return;
  fx.trail(`wo-snow${z.id}`, 0.02, () => {
    const px = z.x - r + Math.random() * r * 0.6,
      py = z.y + (Math.random() * 2 - 1) * r * SQ;
    fx.burst({
      x: px,
      y: py,
      z: 40 + Math.random() * 60,
      count: 1,
      kind: "mote",
      color: [WHITE, 0xdff8ff, 0xb8ecff],
      angle: wind,
      spread: 0.3,
      speed: [r * 1.2, r * 1.8],
      up: [-40, 0],
      life: [0.7, 1.1],
      size: [1.2, 2.4],
      grav: 60,
      drag: 0.3,
    });
  });
  fx.trail(`wo-chip${z.id}`, 0.15, () => {
    const aa = Math.random() * TAU,
      d = Math.random() * r;
    fx.burst({
      x: z.x + Math.cos(aa) * d,
      y: z.y + Math.sin(aa) * d * SQ,
      z: 4,
      count: 2,
      kind: "debris",
      color: [0xdff8ff, 0xb8ecff],
      speed: [30, 90],
      up: [80, 180],
      life: [0.4, 0.7],
      size: [1.2, 2.2],
      grav: 1000,
      bounce: 0.45,
    });
  });
};
/** Chestnut Storm: when it lands, shells shatter, fires flare, smoke columns. */
const stormPhysics: ZoneFn = (g, z, progress) => {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    strikeAt = (a.tickDelay ?? 0.35) / a.duration;
  if (progress < strikeAt) return;
  fx.trail(`cs-land${z.id}`, 999, () => {
    ring(7, (aa, i) => {
      const d = r * (0.25 + hash(i * 3 + z.id) * 0.6),
        px = z.x + Math.cos(aa + i) * d,
        py = z.y + Math.sin(aa + i) * d * SQ;
      fx.burst({
        x: px,
        y: py,
        z: 8,
        count: 6,
        kind: "debris",
        color: [0x7a4a24, 0x4a2c14, 0xc98b4a],
        speed: [60, 200],
        up: [200, 420],
        life: [0.6, 1],
        size: [2, 3.6],
        grav: 1100,
        bounce: 0.35,
      });
      fx.burst({
        x: px,
        y: py,
        z: 10,
        count: 5,
        kind: "flame",
        color: [0xff8a3d, 0xffd76a],
        speed: [20, 80],
        up: [40, 120],
        life: [0.3, 0.6],
        size: [8, 13],
        drag: 3,
      });
    });
    fx.shake(260, 0.008);
  });
  fx.trail(`cs-smoke${z.id}`, 0.1, () => {
    const aa = Math.random() * TAU,
      d = Math.random() * r * 0.8;
    fx.burst({
      x: z.x + Math.cos(aa) * d,
      y: z.y + Math.sin(aa) * d * SQ,
      z: 30,
      count: 1,
      kind: "smoke",
      color: [0x4a4240, 0x5e5450],
      speed: [5, 25],
      up: [50, 90],
      life: [1.2, 1.8],
      size: [16, 26],
      grav: -18,
      drag: 1,
    });
  });
};
/** Tremor: radiating cracks, boulders lobbed up, a dust wall rolling out. */
const tremorPhysics: CastFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.radius;
  fx.decal({ kind: "crack", x, y, r: r * 0.7, color: 0x6b5640, life: 5 });
  rocks(fx, x, y, 24, [80, r * 1.2], [3, 6]);
  dustRing(fx, x, y, r);
};
/** Landslide: dirt sprays from the burrow, then the eruption flings boulders. */
const landslideDig: CastFn = (scene, _a, x, y, angle) => {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y,
    z: 4,
    count: 14,
    kind: "debris",
    color: [0x5a4330, 0x8a7a64],
    angle: angle + Math.PI,
    spread: 0.7,
    speed: [80, 220],
    up: [120, 280],
    life: [0.5, 0.8],
    size: [1.8, 3.2],
    grav: 1100,
    bounce: 0.3,
  });
  fx.burst({
    x,
    y,
    z: 4,
    count: 6,
    kind: "smoke",
    color: [0xc4a678, 0xd9bf8f],
    angle: angle + Math.PI,
    spread: 0.6,
    speed: [40, 120],
    up: [10, 40],
    life: [0.6, 1],
    size: [12, 18],
    drag: 2,
  });
};
const landslidePhysics: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.explosion ?? 130;
  fx.decal({ kind: "crack", x, y, r: r * 0.8, color: 0x6b5640, life: 5 });
  rocks(fx, x, y, 22, [60, r * 1.6], [3, 6.5]);
  fx.burst({
    x,
    y,
    z: 10,
    count: 10,
    kind: "smoke",
    color: [0xc4a678, 0xd9bf8f, 0x8a7a64],
    speed: [20, 80],
    up: [80, 180],
    life: [1, 1.6],
    size: [18, 28],
    grav: -10,
    drag: 1.2,
  });
  dustRing(fx, x, y, r);
};
/** Void Orb: it drinks the light around it, then bursts and stains the floor. */
const voidPhysics: ProjectileFn = (g, pr) => {
  const fx = fxFor(g.scene),
    r = pr.ability.radius;
  fx.trail(`vo-suck${pr.id}`, 0.03, () => {
    const aa = Math.random() * TAU;
    fx.burst({
      x: pr.x + Math.cos(aa) * r * 3,
      y: pr.y + Math.sin(aa) * r * 3,
      z: 16,
      count: 1,
      kind: "mote",
      color: [0xb59bff, 0x7dffe1, 0x150b26],
      angle: aa + Math.PI,
      spread: 0.1,
      speed: [r * 4, r * 6],
      life: [0.2, 0.3],
      size: [1, 2],
      drag: 0.5,
    });
  });
};
const voidStain: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.explosion ?? 110;
  fx.decal({ kind: "wet", x, y, r: r * 0.9, color: 0x150b26, life: 4 });
  rocks(fx, x, y, 14, [80, r * 1.4], [2, 4], [0x3a2470, 0x150b26, 0x6b5a48]);
  fx.burst({
    x,
    y,
    z: 10,
    count: 12,
    kind: "smoke",
    color: [0x2a1450, 0x3a2470],
    speed: [30, r],
    up: [20, 70],
    life: [0.9, 1.4],
    size: [14, 24],
    grav: -12,
    drag: 1.6,
  });
};
/** Skyline Lance: the shock along the lane kicks up dust and grit and scars it. */
const lancePhysics: BeamFn = (scene, _a, x, y, tx, ty) => {
  const fx = fxFor(scene),
    len = Math.hypot(tx - x, ty - y),
    ang = Math.atan2(ty - y, tx - x);
  for (let d = 30; d < len; d += 60) {
    const px = x + Math.cos(ang) * d,
      py = y + Math.sin(ang) * d;
    fx.burst({
      x: px,
      y: py,
      z: 4,
      count: 2,
      kind: "debris",
      color: [0x8a7a64, 0xdff4ff],
      angle: ang + (Math.random() < 0.5 ? 1.57 : -1.57),
      spread: 0.5,
      speed: [60, 160],
      up: [120, 260],
      life: [0.4, 0.7],
      size: [1.4, 2.6],
      grav: 1100,
      bounce: 0.35,
    });
    fx.burst({
      x: px,
      y: py,
      z: 4,
      count: 1,
      kind: "smoke",
      color: [0xd9cbb4, 0xdff4ff],
      speed: [10, 40],
      up: [10, 30],
      life: [0.6, 1],
      size: [12, 18],
      drag: 2,
    });
  }
  rocks(fx, tx, ty, 10, [80, 240], [2, 3.6], [0xdff4ff, 0x8ff6ff, 0x8a7a64]);
};
/** Sanctuary: warm light, petals and pollen drifting up, sparkles rising. */
const sanctuaryPhysics: ZoneFn = (g, z) => {
  const fx = fxFor(g.scene),
    r = z.radius;
  fx.trail(`sa-petal${z.id}`, 0.05, () => {
    const aa = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r;
    fx.burst({
      x: z.x + Math.cos(aa) * d,
      y: z.y + Math.sin(aa) * d * SQ,
      z: 2,
      count: 1,
      kind: Math.random() < 0.5 ? "debris" : "mote",
      color: [0xffd76a, 0xfff6d6, 0x9be07a, 0xffb0c8],
      speed: [4, 20],
      up: [30, 70],
      life: [1.2, 1.8],
      size: [1.4, 2.6],
      grav: -8,
      drag: 1.4,
    });
  });
};
/** Full Moon: a crater, moon dust billowing, rocks thrown out. */
const fullMoonPhysics: ImpactFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.radius || 170;
  fx.decal({ kind: "crack", x, y, r: r * 0.6, color: 0x6a4fa0, life: 5 });
  rocks(fx, x, y, 20, [80, r * 1.3], [2.5, 5], [0x9a8a78, 0xc9b8a4, 0x6b5a48]);
  dustRing(fx, x, y, r, [0xfff3cf, 0xe8dcc0]);
  fx.shake(240, 0.008);
};
/** Pinball: every ram sends scale-leaves and grit flying. */
const pinballPhysics: ImpactFn = (scene, _a, x, y) => {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y,
    z: 16,
    count: 8,
    kind: "debris",
    color: [0x9be07a, 0x6fbf5a, 0x3e7a3a],
    speed: [80, 220],
    up: [100, 240],
    life: [0.8, 1.2],
    size: [2.2, 3.4],
    grav: 400,
    drag: 2,
  });
  rocks(fx, x, y, 6, [60, 160], [1.6, 3]);
};
/** Overgrowth: soil heaves, leaves and petals burst out, pollen hangs in the air. */
const overgrowthPhysics: CastFn = (scene, a, x, y) => {
  const fx = fxFor(scene),
    r = a.radius;
  fx.decal({ kind: "crack", x, y, r: r * 0.6, color: 0x3e7a3a, life: 4 });
  rocks(fx, x, y, 12, [60, r], [2, 3.6], [0x5a4330, 0x8a7a64]);
  ring(10, (aa) =>
    fx.burst({
      x: x + Math.cos(aa) * r * 0.6,
      y: y + Math.sin(aa) * r * 0.6 * SQ,
      z: 10,
      count: 3,
      kind: "debris",
      color: [0x9be07a, 0x6fbf5a, 0xffb0c8, 0xfff6a0],
      speed: [20, 80],
      up: [80, 180],
      life: [1, 1.6],
      size: [2.2, 3.4],
      grav: 200,
      drag: 2.4,
    }),
  );
  fx.burst({
    x,
    y,
    z: 30,
    count: 14,
    kind: "mote",
    color: [0xfff6a0, 0xe9f5c8],
    speed: [20, r * 0.6],
    up: [20, 60],
    life: [1.4, 2.2],
    size: [1, 2],
    grav: -10,
    drag: 1.4,
  });
};

export function withUltimates(kit: Required<FxKit>): Required<FxKit> {
  const cast = { ...kit.cast },
    zone = { ...kit.zone },
    windup = { ...kit.windup },
    impact = { ...kit.impact },
    beam = { ...kit.beam },
    projectile = { ...kit.projectile };
  cast.overcharge = then(kit.cast.overcharge, overcharge);
  cast["crystal-cage"] = then(kit.cast["crystal-cage"], cage);
  cast["radiant-flare"] = then(kit.cast["radiant-flare"], radiant);
  cast.tremor = then(kit.cast.tremor, tremor);
  zone["sunfire-pillar"] = then(kit.zone["sunfire-pillar"], sunfire);
  zone["mind-maze"] = then(kit.zone["mind-maze"], thought);
  windup["radiant-flare"] = then(kit.windup["radiant-flare"], flareWindup);
  impact["void-orb"] = then(kit.impact["void-orb"], voidOrb);
  // The physical side of every older ultimate.
  cast.overcharge = then(cast.overcharge, overchargePhysics);
  zone.electromagnet = then(zone.electromagnet, electromagnetPhysics);
  projectile["riptide-wave"] = then(projectile["riptide-wave"], riptidePhysics);
  impact["riptide-wave"] = then(impact["riptide-wave"], riptideCrash);
  zone.whiteout = then(zone.whiteout, whiteoutPhysics);
  zone["chestnut-storm"] = then(zone["chestnut-storm"], stormPhysics);
  cast.tremor = then(cast.tremor, tremorPhysics);
  cast.landslide = then(cast.landslide, landslideDig);
  impact.landslide = then(impact.landslide, landslidePhysics);
  projectile["void-orb"] = then(projectile["void-orb"], voidPhysics);
  impact["void-orb"] = then(impact["void-orb"], voidStain);
  beam["skyline-lance"] = then(beam["skyline-lance"], lancePhysics);
  zone.sanctuary = then(zone.sanctuary, sanctuaryPhysics);
  impact["full-moon"] = then(impact["full-moon"], fullMoonPhysics);
  impact.pinball = then(impact.pinball, pinballPhysics);
  cast.overgrowth = then(cast.overgrowth, overgrowthPhysics);
  return { ...kit, cast, zone, windup, impact, beam, projectile };
}

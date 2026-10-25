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
  <A extends unknown[]>(base: ((...a: A) => void) | undefined, extra: (...a: A) => void) =>
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
    return { x: x + Math.cos(ang) * r * 0.82, y: y + Math.sin(ang) * r * 0.82 * SQ, at: 0.08 + i * 0.07 };
  });
  shot(fx.reduced ? 300 : 1100, (k) => {
    for (const [i, s] of strikes.entries()) {
      const kk = (k - s.at) / 0.14;
      if (kk < 0 || kk > 1) continue;
      once(i, () => {
        fx.burst({ x: s.x, y: s.y, count: 14, kind: "spark", color: [color, WHITE], speed: [80, 260], up: [120, 340], life: [0.3, 0.6], size: [1, 1.8], grav: 1000 });
        fx.decal({ kind: "scorch", x: s.x, y: s.y, r: 22, color, life: 3.5 });
        fx.shake(90, 0.004);
      });
      fx.bolt(s.x + 30, s.y - 560, s.x, s.y, WHITE, { width: 4 * (1 - kk) + 1, jag: 0.1, branches: 2, seed: i * 7 + Math.floor(k * 30) });
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
        fx.bolt(x + Math.cos(a0) * r * 0.9, y + Math.sin(a0) * r * 0.9 * SQ, x + Math.cos(a1) * r * 0.9, y + Math.sin(a1) * r * 0.9 * SQ, color, { width: 1.6, jag: 0.3, seed: seed + i * 5, alpha: live, onFloor: true });
      }
      fx.floor.lineStyle(3, color, 0.5 * live).strokeEllipse(x, y, r * 1.8, r * 1.8 * SQ);
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
    fx.floor.fillStyle(0xff7a2a, 0.25 + k * 0.3).fillEllipse(z.x, z.y, r * 1.6 * k, r * 1.6 * SQ * k);
    for (let i = 0; i < 8; i++) {
      const ang = (i * TAU) / 8 - now / (400 - k * 250),
        p1 = { x: z.x + Math.cos(ang - 0.12) * r * 0.55, y: z.y + Math.sin(ang - 0.12) * r * 0.55 * SQ },
        p2 = { x: z.x + Math.cos(ang + 0.12) * r * 0.55, y: z.y + Math.sin(ang + 0.12) * r * 0.55 * SQ },
        tip = { x: z.x + Math.cos(ang) * r * (0.85 + k * 0.1), y: z.y + Math.sin(ang) * r * (0.85 + k * 0.1) * SQ };
      fx.floor.fillStyle(0xffc65a, 0.35 + k * 0.5).fillTriangle(p1.x, p1.y, p2.x, p2.y, tip.x, tip.y);
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
    fx.g.lineStyle(2, 0xffd27a, 0.5 * (1 - t)).strokeEllipse(z.x, z.y - 20 - t * 110, r * (1.1 - t * 0.4) * 2, r * (1.1 - t * 0.4) * 2 * 0.35);
  }
};

// ───────────── Auralynx · Nova Burst: crystal spires that shatter ─────────────
const nova: CastFn = (scene, a, x, y, _angle, color, shot) => {
  const fx = fxFor(scene),
    r = a.radius,
    once = onceAt();
  fx.ultimate(color);
  const spires = Array.from({ length: 7 }, (_, i) => {
    const ang = (i * TAU) / 7 + 0.3,
      d = r * (0.55 + hash(i * 3) * 0.25);
    return { x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d * SQ, h: 56 + hash(i) * 34, w: 13 + hash(i * 5) * 6, at: 0.05 + i * 0.03, breakAt: 0.55 + hash(i * 9) * 0.12 };
  });
  shot(fx.reduced ? 360 : 1150, (k) => {
    for (const [i, s] of spires.entries()) {
      if (k > s.breakAt) {
        once(i, () => {
          fx.burst({ x: s.x, y: s.y, z: s.h * 0.5, count: 16, kind: "debris", color: [color, 0xdff4ff, 0xff9be0, 0x8ff6ff], speed: [60, 220], up: [60, 260], life: [0.6, 1], size: [2.5, 4.5], grav: 900, bounce: 0.3 });
          fx.burst({ x: s.x, y: s.y, z: s.h * 0.5, count: 10, kind: "mote", color: [0xffffff, color], speed: [20, 90], up: [20, 90], life: [0.5, 1], size: [1, 2], drag: 2 });
        });
        continue;
      }
      const grow = ease(Math.min(1, (k - s.at) / 0.18));
      if (grow <= 0) continue;
      const h = s.h * grow,
        top = { x: s.x, y: s.y - h };
      // Faceted spire: shadow, dark face, light face, glint.
      fx.solid.fillStyle(0x000000, 0.2).fillEllipse(s.x + 6, s.y + 3, s.w * 2.6, s.w);
      fx.solid.fillStyle(0x26285a, 0.5).fillTriangle(s.x - s.w - 2, s.y + 2, s.x + s.w + 2, s.y + 2, top.x, top.y - 3);
      fx.solid.fillStyle(color, 1).fillTriangle(s.x - s.w, s.y, s.x, s.y + 3, top.x, top.y);
      fx.solid.fillStyle(0xdff4ff, 1).fillTriangle(s.x, s.y + 3, s.x + s.w, s.y, top.x, top.y);
      fx.g.fillStyle(WHITE, 0.8).fillTriangle(s.x + 2, s.y - 4, s.x + 5, s.y - 6, top.x + 1, top.y + 6);
      // Each spire throws a beam of refracted light upward.
      fx.glow(top.x, top.y - 40, 16, color, 0.5 * grow, false, 4);
    }
  });
};

// ───────────── Lumoth · Radiant Flare: a small sun rises, then bursts ─────────────
const flareWindup: WindupFn = (g, _a, x, y, _angle, _ax, _ay, color, k) => {
  const fx = fxFor(g.scene),
    sy = y - 30 - ease(k) * 60,
    rr = 8 + k * 18;
  fx.glow(x, sy, rr * 4, color, 0.5 + k * 0.4);
  fx.solid.fillStyle(0x4a3a18, 0.3).fillCircle(x, sy, rr * 1.1);
  fx.solid.fillStyle(0xffd76a, 1).fillCircle(x, sy, rr);
  fx.solid.fillStyle(0xfff6d6, 1).fillCircle(x - rr * 0.2, sy - rr * 0.2, rr * 0.6);
  // Corona spikes slowly turning.
  for (let i = 0; i < 8; i++) {
    const ang = (i * TAU) / 8 + k * 2;
    fx.g.lineStyle(2, 0xffd76a, 0.8).lineBetween(x + Math.cos(ang) * rr * 1.25, sy + Math.sin(ang) * rr * 1.25, x + Math.cos(ang) * rr * 1.8, sy + Math.sin(ang) * rr * 1.8);
  }
};
const radiant: CastFn = (scene, a, x, y, _angle, color, shot) => {
  const fx = fxFor(scene),
    sy = y - 90;
  fx.ultimate(0xffd76a, 850);
  // Starlight falls slowly over the whole blast area.
  fx.burst({ x, y, z: 160, count: 40, kind: "mote", color: [0xffd76a, 0xfff6d6, color], speed: [20, a.radius * 0.9], up: [-30, 10], life: [1, 1.6], size: [1.2, 2.4], grav: 60, drag: 1.2 });
  shot(fx.reduced ? 260 : 800, (k) => {
    const b = Math.max(0, 1 - k / 0.35);
    // The sun bursts: a white disc expanding and an anamorphic streak.
    fx.glow(x, sy, 40 + ease(Math.min(1, k * 3)) * 120, WHITE, 0.9 * b);
    fx.glow(x, sy, a.radius * 2.6, 0xffd76a, 0.55 * b, false, 0.05);
    fx.glow(x, sy, a.radius * 1.4, WHITE, 0.7 * b, false, 0.03);
    fx.g.lineStyle(3, 0xfff6d6, 0.8 * b).strokeCircle(x, sy, 30 + ease(k) * 140);
  });
};

// ───────────── Mystowl · Thoughtstrike: the great eye, weightless debris ─────────────
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
      fx.solid.fillStyle(0x1b0d30, 1).fillEllipse(ex, ey, iris * (0.5 - k * 0.32), iris * 1.4);
      fx.solid.fillStyle(WHITE, 0.9).fillCircle(ex - iris * 0.35, ey - iris * 0.35, iris * 0.18);
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
    fx.burst({ x: z.x, y: z.y, z: 4, count: 26, kind: "debris", color: [0x8a7f74, 0x6d6460, 0x9c9389], speed: [20, z.radius * 1.2], up: [120, 220], life: [1.2, 1.8], size: [2.5, 5], grav: 140, drag: 2.2, bounce: 0.2 });
    fx.shake(240, 0.008);
  });
  // The eye snaps shut as the blow lands.
  if (k < 0.25) {
    const b = 1 - k / 0.25;
    fx.solid.lineStyle(5, 0x2a1446, 0.9 * b).lineBetween(ex - 120, ey, ex + 120, ey);
    fx.glow(ex, ey, 120, c, 0.6 * b);
    fx.glow((ex + z.x) / 2, (ey + z.y) / 2, 60, WHITE, 0.6 * b, false, 3);
  }
  // Glowing fissures in the floor.
  fx.floor.lineStyle(3, c, 0.7 * (1 - k));
  for (let i = 0; i < 8; i++) {
    const ang = (i * TAU) / 8 + hash(z.id + i) * 0.4,
      len = z.radius * (0.6 + hash(i) * 0.4) * ease(Math.min(1, k * 3));
    fx.floor.lineBetween(z.x, z.y, z.x + Math.cos(ang) * len, z.y + Math.sin(ang) * len * SQ);
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
    return { x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d * SQ, h: 60 + hash(i) * 40, w: 16 + hash(i * 3) * 8, at: d / r * 0.3 };
  });
  const boulders = Array.from({ length: 4 }, (_, i) => {
    const ang = hash(x + i * 11) * TAU,
      d = r * (0.3 + hash(y + i) * 0.6);
    return { x: x + Math.cos(ang) * d, y: y + Math.sin(ang) * d * SQ, at: 0.25 + i * 0.1, size: 12 + hash(i * 13) * 8 };
  });
  shot(fx.reduced ? 360 : 1300, (k) => {
    for (const p of pillars) {
      const kk = (k - p.at) / 0.6;
      if (kk <= 0 || kk >= 1) continue;
      const up = kk < 0.2 ? ease(kk / 0.2) : kk < 0.7 ? 1 : 1 - (kk - 0.7) / 0.3,
        h = p.h * up;
      fx.solid.fillStyle(0x000000, 0.25).fillEllipse(p.x + 8, p.y + 3, p.w * 2.8, p.w);
      fx.solid.fillStyle(0x6e604f, 1).fillPoints([{ x: p.x - p.w, y: p.y }, { x: p.x - p.w * 0.6, y: p.y - h }, { x: p.x + p.w * 0.2, y: p.y - h - 8 }, { x: p.x, y: p.y + 4 }], true);
      fx.solid.fillStyle(0xa8977d, 1).fillPoints([{ x: p.x, y: p.y + 4 }, { x: p.x + p.w * 0.2, y: p.y - h - 8 }, { x: p.x + p.w * 0.7, y: p.y - h + 4 }, { x: p.x + p.w, y: p.y }], true);
      fx.solid.lineStyle(2, 0x3b2f24, 0.6).lineBetween(p.x - p.w * 0.3, p.y - h * 0.3, p.x + p.w * 0.1, p.y - h * 0.55);
    }
    // A wall of dust rolling outward past the ring.
    const wall = r * (0.4 + ease(Math.min(1, k * 1.4)) * 0.85);
    const dust = Math.max(0, 1 - k * 1.1);
    for (let i = 0; i < 18; i++) {
      const ang = (i * TAU) / 18 + hash(i) * 0.2;
      fx.soft(x + Math.cos(ang) * wall, y + Math.sin(ang) * wall * SQ - 10, 22 + hash(i * 5) * 10, 0xd9bf8f, 0.55 * dust, 0.8);
    }
    // Boulders dropping in from above, each landing with a thud.
    for (const [i, b] of boulders.entries()) {
      const kk = (k - b.at) / 0.18;
      if (kk < 0) continue;
      if (kk >= 1) {
        once(i, () => {
          fx.burst({ x: b.x, y: b.y, count: 10, kind: "debris", color: [0x8a7a66, 0x6e604f, 0xa8977d], speed: [60, 200], up: [100, 260], life: [0.6, 1], size: [2.5, 4.5], grav: 1100 });
          fx.burst({ x: b.x, y: b.y, z: 4, count: 5, kind: "smoke", color: [0xd9bf8f, 0xc4a678], speed: [40, 120], up: [10, 40], life: [0.6, 1], size: [10, 16], drag: 3 });
          fx.decal({ kind: "crack", x: b.x, y: b.y, r: 34, color: 0x6b5640, life: 3 });
          fx.shake(80, 0.004);
        });
        continue;
      }
      const height = (1 - kk * kk) * 420;
      fx.solid.fillStyle(0x000000, 0.12 + kk * 0.2).fillEllipse(b.x, b.y + 2, b.size * 2.4 * (0.5 + kk * 0.5), b.size * (0.5 + kk * 0.5));
      fx.solid.fillStyle(0x6e604f, 1).fillCircle(b.x, b.y - height, b.size);
      fx.solid.fillStyle(0xa8977d, 1).fillCircle(b.x - b.size * 0.25, b.y - height - b.size * 0.25, b.size * 0.6);
    }
  });
};

// ───────────── Duskveil · Void Orb: the lights go out, tendrils lash out ─────────────
const voidOrb: ImpactFn = (scene, a, x, y, color, shot) => {
  const fx = fxFor(scene),
    blast = a.explosion ?? 120;
  fx.ultimate(0x150b26, 1000, true);
  fx.decal({ kind: "wet", x, y, r: blast * 0.8, color: 0x150b26, life: 4.5 });
  const tendrils = Array.from({ length: 7 }, (_, i) => ({ ang: (i * TAU) / 7 + hash(x + i) * 0.5, curl: (hash(i * 3) - 0.5) * 1.6, len: blast * (0.9 + hash(i) * 0.5) }));
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
        pts.push({ x: x + Math.cos(t.ang + bend) * d, y: y + Math.sin(t.ang + bend) * d * SQ });
      }
      // Tapered: draw from thick root to thin tip.
      for (let i = 0; i < pts.length - 1; i++) {
        const w = 12 * (1 - i / pts.length);
        fx.floorSolid.lineStyle(w + 3, 0x05020c, 0.75 * fade).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
        fx.floor.lineStyle(Math.max(1, w * 0.3), color, 0.7 * fade).lineBetween(pts[i].x, pts[i].y, pts[i + 1].x, pts[i + 1].y);
      }
    }
  });
};

export function withUltimates(kit: Required<FxKit>): Required<FxKit> {
  const cast = { ...kit.cast },
    zone = { ...kit.zone },
    windup = { ...kit.windup },
    impact = { ...kit.impact };
  cast.overcharge = then(kit.cast.overcharge, overcharge);
  cast["nova-burst"] = then(kit.cast["nova-burst"], nova);
  cast["radiant-flare"] = then(kit.cast["radiant-flare"], radiant);
  cast.tremor = then(kit.cast.tremor, tremor);
  zone["sunfire-pillar"] = then(kit.zone["sunfire-pillar"], sunfire);
  zone.thoughtstrike = then(kit.zone.thoughtstrike, thought);
  windup["radiant-flare"] = then(kit.windup["radiant-flare"], flareWindup);
  impact["void-orb"] = then(kit.impact["void-orb"], voidOrb);
  return { ...kit, cast, zone, windup, impact };
}

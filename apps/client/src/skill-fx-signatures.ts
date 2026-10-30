import {
  CHARACTERS,
  type Ability,
  type Projectile,
  type Zone,
} from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, type FxKit } from "./fx-kits";

/** Material accents complement each authored move, rather than replacing its
 * silhouette. The primary colour is always the equipped skin's skill colour. */
export const SIGNATURE_MATERIALS = {
  electric: { accent: 0xfff1ba, ink: 0x27203f },
  fire: { accent: 0xffe1a3, ink: 0x451a13 },
  water: { accent: 0xe5fdff, ink: 0x174369 },
  aura: { accent: 0xf8dcff, ink: 0x29254d },
  light: { accent: 0xfff3c6, ink: 0x32534a },
  psychic: { accent: 0xcff5ff, ink: 0x382343 },
  earth: { accent: 0xe9e8ad, ink: 0x3a3020 },
  shadow: { accent: 0xa1ffe2, ink: 0x18162c },
} as const;
type Element = keyof typeof SIGNATURE_MATERIALS;
const moves = Object.values(CHARACTERS).flatMap((c) => [c.basic, ...c.skills]);
const basics = new Set(Object.values(CHARACTERS).map((c) => c.basic.id));
const ultimates = new Set(Object.values(CHARACTERS).map((c) => c.skills[3].id));
const elementOf = (a: Ability) => a.element.toLowerCase() as Element;
const strength = (a: Ability) =>
  ultimates.has(a.id) ? 1.6 : basics.has(a.id) ? 0.5 : 1;
const material = (element: Element) => SIGNATURE_MATERIALS[element];
const lift: Record<Element, number> = {
  electric: 0,
  fire: 16,
  water: 0,
  aura: 12,
  light: 12,
  psychic: 12,
  earth: 0,
  shadow: 12,
};

/** Eight distinct small silhouettes: forks, flame blades, crests, facets,
 * wing petals, stars, stone slabs and hooked wisps. No per-frame sprites. */
function motif(
  fx: Fx,
  element: Element,
  x: number,
  y: number,
  r: number,
  color: number,
  angle: number,
  alpha: number,
  floor = false,
) {
  if (r < 0.5 || alpha <= 0) return;
  const { accent, ink } = material(element),
    g = floor ? fx.floor : fx.g,
    solid = floor ? fx.floorSolid : fx.solid;
  const cs = Math.cos(angle),
    sn = Math.sin(angle);
  const point = (px: number, py: number) => ({
    x: x + (px * cs - py * sn) * r,
    y: y + (px * sn + py * cs) * r,
  });
  const polygon = (shape: number[][]) => shape.map(([px, py]) => point(px, py));
  if (element === "electric") {
    const p = polygon([
      [-1, 0.65],
      [-0.25, 0.1],
      [-0.5, -0.1],
      [0.3, -0.55],
      [0.1, 0.05],
      [1, -0.6],
    ]);
    solid.lineStyle(4, ink, 0.5 * alpha).strokePoints(p, false);
    g.lineStyle(2, color, alpha).strokePoints(p, false);
    g.lineStyle(1, accent, alpha).strokePoints(p.slice(2), false);
  } else if (element === "fire") {
    const p = polygon([
      [-1, 0.35],
      [-0.45, -0.45],
      [-0.15, -0.05],
      [0.3, -1.2],
      [0.35, -0.15],
      [1, 0.5],
      [0.1, 0.65],
    ]);
    solid.fillStyle(ink, 0.45 * alpha).fillPoints(p, true);
    g.fillStyle(color, 0.8 * alpha).fillPoints(p, true);
    g.fillStyle(accent, 0.85 * alpha).fillPoints(
      polygon([
        [-0.25, 0.25],
        [0.25, -0.65],
        [0.5, 0.4],
      ]),
      true,
    );
  } else if (element === "water" || element === "shadow") {
    const p = [];
    for (let i = 0; i <= 10; i++) {
      const t = i / 10,
        a = -0.8 + t * Math.PI * 1.5;
      p.push(point(Math.cos(a), Math.sin(a) * 0.75));
    }
    for (let i = 10; i >= 0; i--) {
      const t = i / 10,
        a = -0.8 + t * Math.PI * 1.5;
      const inner = element === "shadow" ? 0.65 : 0.5;
      p.push(point(Math.cos(a) * inner + 0.18, Math.sin(a) * inner * 0.75));
    }
    solid.fillStyle(ink, 0.6 * alpha).fillPoints(p, true);
    g.fillStyle(color, 0.7 * alpha).fillPoints(p, true);
    g.lineStyle(1.3, accent, 0.8 * alpha).strokePoints(p.slice(0, 8), false);
  } else if (element === "aura") {
    const p = polygon([
      [0, -1.25],
      [0.65, 0],
      [0, 1.1],
      [-0.65, 0],
    ]);
    solid.fillStyle(ink, 0.8 * alpha).fillPoints(p, true);
    g.fillStyle(color, 0.65 * alpha).fillPoints(p, true);
    g.fillStyle(accent, 0.85 * alpha).fillTriangle(
      p[0].x,
      p[0].y,
      p[1].x,
      p[1].y,
      x,
      y,
    );
    g.lineStyle(1, 0xffffff, 0.8 * alpha).lineBetween(
      p[0].x,
      p[0].y,
      p[2].x,
      p[2].y,
    );
  } else if (element === "light") {
    const p = polygon([
      [-1, 0],
      [-0.35, -0.45],
      [0.3, -0.35],
      [1.2, 0],
      [0.3, 0.35],
      [-0.35, 0.45],
    ]);
    solid.fillStyle(ink, 0.4 * alpha).fillPoints(p, true);
    g.fillStyle(color, 0.7 * alpha).fillPoints(p, true);
    const a = point(-0.7, 0),
      b = point(0.9, 0);
    g.lineStyle(1.2, accent, alpha).lineBetween(a.x, a.y, b.x, b.y);
  } else if (element === "psychic") {
    const p = polygon([
      [0, -1.2],
      [0.22, -0.22],
      [1, 0],
      [0.22, 0.22],
      [0, 1.2],
      [-0.22, 0.22],
      [-1, 0],
      [-0.22, -0.22],
    ]);
    solid.fillStyle(ink, 0.5 * alpha).fillPoints(p, true);
    g.fillStyle(color, 0.75 * alpha).fillPoints(p, true);
    g.fillStyle(accent, alpha).fillCircle(x, y, Math.max(1, r * 0.2));
  } else {
    const p = polygon([
      [-0.75, -0.45],
      [0.1, -0.85],
      [0.8, -0.15],
      [0.5, 0.65],
      [-0.5, 0.55],
    ]);
    solid.fillStyle(ink, alpha).fillPoints(p, true);
    solid.fillStyle(color, 0.9 * alpha).fillPoints(
      p.map((q) => ({ x: x + (q.x - x) * 0.8, y: y + (q.y - y) * 0.8 })),
      true,
    );
    g.lineStyle(1.5, accent, 0.7 * alpha).strokePoints(p.slice(0, 3), false);
    const a = point(-0.2, -0.2),
      b = point(0.25, 0.1),
      c = point(0, 0.45);
    solid.lineStyle(1.3, ink, alpha).strokePoints([a, b, c], false);
  }
}

/** A tapered, curved material wake. Its luminous core stays within the
 * projectile/beam width; the tail has no damaging-looking extra perimeter. */
function ribbon(
  fx: Fx,
  element: Element,
  x: number,
  y: number,
  angle: number,
  length: number,
  width: number,
  phase: number,
  color: number,
  alpha: number,
) {
  const { accent, ink } = material(element),
    cs = Math.cos(angle),
    sn = Math.sin(angle);
  const left = [],
    right = [],
    centre = [];
  const steps = fx.compact ? 6 : 9;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps,
      taper = (1 - t) ** 1.3;
    const bend =
      Math.sin(t * TAU - phase) * Math.sin(t * Math.PI) * width * 0.45;
    const px = x - cs * length * t - sn * bend,
      py = y - sn * length * t + cs * bend;
    const w = width * taper * (0.7 + 0.15 * Math.sin(phase + t * 4));
    left.push({ x: px - sn * w, y: py + cs * w });
    right.push({ x: px + sn * w, y: py - cs * w });
    centre.push({ x: px, y: py });
  }
  const outline = [...left, ...right.reverse()];
  fx.solid.fillStyle(ink, 0.4 * alpha).fillPoints(outline, true);
  fx.g.fillStyle(color, 0.5 * alpha).fillPoints(outline, true);
  fx.g
    .lineStyle(Math.max(1, width * 0.32), accent, 0.65 * alpha)
    .strokePoints(centre, false);
}

function projectileAccent(fx: Fx, pr: Projectile, now: number) {
  if (!fx.detail(4)) return;
  const a = pr.ability,
    element = elementOf(a),
    power = strength(a);
  const angle = Math.atan2(pr.vy, pr.vx),
    r = a.radius;
  const length = Math.min(
    a.range * 0.3,
    Math.max(42, Math.hypot(pr.vx, pr.vy) * (0.09 + power * 0.035)),
  );
  const phase = now / 150 + pr.id * 1.7,
    y = pr.y - lift[element];
  ribbon(
    fx,
    element,
    pr.x,
    y,
    angle,
    length,
    r * (basics.has(a.id) ? 0.45 : 0.65),
    phase,
    pr.color,
    0.8,
  );
  const count = ultimates.has(a.id) ? 3 : basics.has(a.id) ? 1 : 2;
  for (let i = 0; i < count; i++) {
    const travel = (now / 550 + i / count + pr.id * 0.17) % 1;
    const d = length * (0.25 + travel * 0.7),
      side = Math.sin(phase + i * 2) * r * 0.6;
    motif(
      fx,
      element,
      pr.x - Math.cos(angle) * d - Math.sin(angle) * side,
      y - Math.sin(angle) * d + Math.cos(angle) * side,
      r * (0.3 + power * 0.14) * (1 - travel * 0.5),
      pr.color,
      angle + travel * 2,
      0.75 * (1 - travel),
    );
  }
}

/** Ground patterns live inside the real radius. The clean outer circle is
 * unchanged, so the spectacular interior never invents extra attack range. */
function zoneAccent(fx: Fx, z: Zone, progress: number, now: number) {
  if (!fx.detail(8)) return;
  const element = elementOf(z.ability),
    { accent, ink } = material(element),
    r = z.radius;
  const age = progress * z.ability.duration,
    delay = z.ability.tickDelay ?? 0;
  const active = age >= delay,
    fade = Math.min(1, (1 - progress) / 0.18);
  const beat =
    Math.max(0, age - delay) / Math.max(0.12, z.ability.tickInterval ?? 0.65);
  const alpha = fade * (active ? 0.6 + 0.15 * Math.cos(beat * TAU) : 0.3);
  const spin = now / 2200,
    count = ultimates.has(z.ability.id) ? 8 : 6;
  fx.floorSolid.lineStyle(3, ink, 0.25 * fade).strokeCircle(z.x, z.y, r * 0.94);
  fx.floor
    .lineStyle(1.3, z.color, 0.45 * fade)
    .strokeCircle(z.x, z.y, r * 0.94);
  const points = [];
  for (let i = 0; i < count; i++) {
    const angle = (TAU * i) / count + (element === "earth" ? 0 : spin * 0.35);
    const ring = r * (0.7 + 0.05 * Math.sin(beat * TAU + i));
    const px = z.x + Math.cos(angle) * ring,
      py = z.y + Math.sin(angle) * ring;
    points.push({ x: px, y: py });
    motif(
      fx,
      element,
      px,
      py,
      Math.min(15, r * 0.1),
      z.color,
      angle + spin,
      alpha,
      true,
    );
    if (element === "electric" || element === "earth") {
      const mid = {
        x: z.x + Math.cos(angle + 0.13) * r * 0.4,
        y: z.y + Math.sin(angle + 0.13) * r * 0.4,
      };
      fx.floor
        .lineStyle(element === "earth" ? 2.5 : 1.5, z.color, 0.3 * alpha)
        .strokePoints([{ x: z.x, y: z.y }, mid, { x: px, y: py }], false);
    }
  }
  if (element === "aura" || element === "psychic") {
    const ordered =
      element === "psychic"
        ? points
            .filter((_, i) => i % 2 === 0)
            .concat(points.filter((_, i) => i % 2 === 1))
        : points;
    fx.floor.lineStyle(1.4, accent, 0.4 * alpha).strokePoints(ordered, true);
    motif(fx, element, z.x, z.y, r * 0.18, z.color, -spin, alpha, true);
  } else if (
    element === "water" ||
    element === "shadow" ||
    element === "fire"
  ) {
    for (let i = 0; i < 3; i++) {
      const arc = spin * (element === "shadow" ? -1 : 1) + (i * TAU) / 3,
        rr = r * (0.3 + i * 0.18);
      fx.floor
        .lineStyle(
          element === "water" ? 3 : 2,
          i % 2 ? accent : z.color,
          0.5 * alpha,
        )
        .beginPath()
        .arc(z.x, z.y, rr, arc, arc + Math.PI * 1.1)
        .strokePath();
    }
  } else if (element === "light") {
    for (let i = 0; i < 3; i++)
      motif(
        fx,
        element,
        z.x,
        z.y,
        r * 0.28,
        z.color,
        spin + (i * TAU) / 3,
        alpha * 0.5,
        true,
      );
  }
}

/** Cast and impact beats have a decisive onset, then drifting material
 * fragments. Ultimates gain a second, delayed crown within their true area. */
function pulse(
  fx: Fx,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  impact = false,
) {
  const element = elementOf(a),
    power = strength(a),
    big = ultimates.has(a.id),
    basic = basics.has(a.id);
  const melee = a.kind === "melee",
    area = a.kind === "nova" || (impact && !!a.explosion);
  const reach = area
    ? impact
      ? a.explosion!
      : a.radius
    : melee
      ? a.range
      : Math.min(46, 18 + a.radius * 0.4);
  const ms = basic ? 210 : big ? 800 : 420;
  fx.animate(
    ms,
    (k) => {
      if (!fx.detail(big ? 8 : 3, true)) return;
      const spread = melee ? Math.acos(a.arc ?? 0.35) : Math.PI;
      const ring = reach * (0.25 + 0.75 * ease(k)),
        fade = (1 - k) ** 1.5;
      const { accent } = material(element);
      if (area) {
        fx.floor
          .lineStyle(big ? 3 : 2, color, 0.6 * fade)
          .strokeCircle(x, y, ring);
        if (big && k > 0.18)
          fx.floor
            .lineStyle(1.5, accent, 0.45 * fade)
            .strokeCircle(x, y, reach * ease((k - 0.18) / 0.82) * 0.82);
      } else if (melee) {
        const arc = angle - spread + spread * 2 * Math.min(1, k * 2.4);
        fx.solid
          .lineStyle(8 * power, material(element).ink, 0.35 * fade)
          .beginPath()
          .arc(
            x,
            y,
            reach * 0.8,
            Math.max(angle - spread, arc - spread * 0.7),
            arc,
          )
          .strokePath();
        fx.g
          .lineStyle(3 + power, accent, 0.7 * fade)
          .beginPath()
          .arc(
            x,
            y,
            reach * 0.8,
            Math.max(angle - spread, arc - spread * 0.7),
            arc,
          )
          .strokePath();
      }
      const count = basic ? 3 : big ? 8 : 5;
      for (let i = 0; i < count; i++) {
        const dir = melee
          ? angle - spread + (spread * 2 * (i + 0.5)) / count
          : angle + (i * TAU) / count;
        const d = reach * (0.25 + 0.6 * ease(k));
        motif(
          fx,
          element,
          x + Math.cos(dir) * d,
          y + Math.sin(dir) * d - 8 * (1 - k),
          Math.min(18, (basic ? 4 : 7) * power) * (1 - k * 0.35),
          color,
          dir + k * (element === "earth" ? 0.4 : 1.4),
          fade,
        );
      }
      if (!basic && k < 0.22)
        fx.glow(
          x,
          y - 8,
          Math.min(80, reach) * (0.35 + k),
          accent,
          0.35 * (1 - k / 0.22),
        );
      if (big && k > 0.22 && k < 0.75) {
        const q = (k - 0.22) / 0.53;
        for (let i = 0; i < 4; i++) {
          const dir = angle + (i * TAU) / 4 + Math.PI / 4,
            d = reach * (0.7 - q * 0.12);
          motif(
            fx,
            element,
            x + Math.cos(dir) * d,
            y + Math.sin(dir) * d - 20 * Math.sin(q * Math.PI),
            14 * Math.sin(q * Math.PI),
            color,
            dir - q,
            Math.sin(q * Math.PI) * 0.8,
          );
        }
      }
    },
    y,
    true,
  );
}

function windupAccent(
  fx: Fx,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  ax: number,
  ay: number,
  color: number,
  k: number,
  now: number,
) {
  if (!fx.detail(5)) return;
  const element = elementOf(a),
    big = ultimates.has(a.id),
    ring = Math.min(big ? 90 : 50, 22 + a.radius * 0.3) * (1 - k * 0.7);
  const d =
    a.kind === "zone" ? Math.min(a.range, Math.hypot(ax - x, ay - y)) : 0;
  const tx = x + Math.cos(angle) * d,
    ty = y + Math.sin(angle) * d;
  for (let i = 0; i < (big ? 6 : 4); i++) {
    const dir = now / 800 + (i * TAU) / (big ? 6 : 4);
    motif(
      fx,
      element,
      tx + Math.cos(dir) * ring,
      ty + Math.sin(dir) * ring - 8,
      4 + k * 6,
      color,
      dir + k,
      0.3 + k * 0.6,
    );
  }
}

/** Applied to all eight complete kits, including EX/rite-modified geometry. */
export function withSkillSignatures(kit: Required<FxKit>): Required<FxKit> {
  const out = Object.fromEntries(
    Object.entries(kit).map(([key, value]) => [key, { ...value }]),
  ) as Required<FxKit>;
  for (const definition of moves) {
    const id = definition.id;
    const projectile = kit.projectile[id];
    if (projectile)
      out.projectile[id] = (g, pr, now) => {
        projectile(g, pr, now);
        projectileAccent(fxFor(g.scene), pr, now);
      };
    const zone = kit.zone[id];
    if (zone)
      out.zone[id] = (g, z, k, now) => {
        const fx = fxFor(g.scene);
        fx.at(z.y);
        try {
          zone(g, z, k, now);
          zoneAccent(fx, z, k, now);
        } finally {
          fx.at(null);
        }
      };
    const cast = kit.cast[id];
    out.cast[id] = (scene, a, x, y, angle, color, shot) => {
      cast?.(scene, a, x, y, angle, color, shot);
      pulse(fxFor(scene), a, x, y, angle, color);
    };
    const impact = kit.impact[id];
    if (impact)
      out.impact[id] = (scene, a, x, y, color, shot) => {
        impact(scene, a, x, y, color, shot);
        pulse(fxFor(scene), a, x, y, 0, color, true);
      };
    const windup = kit.windup[id];
    if (windup || definition.cast > 0)
      out.windup[id] = (g, a, x, y, angle, ax, ay, color, k, now) => {
        windup?.(g, a, x, y, angle, ax, ay, color, k, now);
        windupAccent(fxFor(g.scene), a, x, y, angle, ax, ay, color, k, now);
      };
    const channel = kit.channel[id];
    if (channel)
      out.channel[id] = (g, a, x, y, angle, color, now) => {
        channel(g, a, x, y, angle, color, now);
        const fx = fxFor(g.scene);
        if (!fx.detail(6)) return;
        const spread = Math.acos(a.arc ?? 0.7);
        for (let i = 0; i < 3; i++) {
          const dir = angle + (i - 1) * spread * 0.55;
          ribbon(
            fx,
            elementOf(a),
            x + Math.cos(dir) * a.range * 0.92,
            y + Math.sin(dir) * a.range * 0.92,
            dir,
            a.range * 0.85,
            6,
            now / 120 + i,
            color,
            0.5,
          );
        }
      };
    const beam = kit.beam[id];
    if (beam)
      out.beam[id] = (scene, a, x, y, tx, ty, color, shot) => {
        beam(scene, a, x, y, tx, ty, color, shot);
        const fx = fxFor(scene),
          angle = Math.atan2(ty - y, tx - x),
          length = Math.hypot(tx - x, ty - y);
        fx.animate(
          330,
          (k) => {
            if (fx.detail(5, true))
              ribbon(
                fx,
                elementOf(a),
                tx,
                ty - 12,
                angle,
                length,
                a.radius * 0.4 * (1 - k),
                k * 8,
                color,
                1 - k,
              );
          },
          Math.min(y, ty),
          true,
        );
      };
  }
  for (const [element, hit] of Object.entries(kit.hit)) {
    if (!(element in SIGNATURE_MATERIALS)) continue;
    out.hit[element] = (scene, x, y, color, shot) => {
      hit(scene, x, y, color, shot);
      const fx = fxFor(scene);
      fx.animate(
        250,
        (k) => {
          if (!fx.detail(3, true)) return;
          for (let i = 0; i < 3; i++) {
            const angle = (i * TAU) / 3 + k * 0.7,
              d = 8 + ease(k) * 20;
            motif(
              fx,
              element as Element,
              x + Math.cos(angle) * d,
              y - 10 + Math.sin(angle) * d,
              5 * (1 - k),
              color,
              angle,
              1 - k,
            );
          }
        },
        y,
        true,
      );
    };
  }
  return out;
}

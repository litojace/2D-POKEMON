import { drawBossSpellFlipbook } from "./boss-spell-flipbook";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { bossLife, type BossLifePose } from "./raid-boss-life";
import { fxFor, type Fx } from "./fx-engine";
import type { BossCast } from "./boss-performance";
const TAU = Math.PI * 2;
type G = Phaser.GameObjects.Graphics;
const colors: Record<RaidBossId, [number, number, number]> = {
  grumblecrag: [0xffaa43, 0xffe6a8, 0x594c3c],
  tidewyrm: [0x43dded, 0xd4ffef, 0x214e72],
  gloomshade: [0xaf72ff, 0xffdc9e, 0x322446],
  somnara: [0xb0a2ff, 0xffedb2, 0x514078],
  prismatail: [0x7df4e7, 0xffefbb, 0x385a72],
  emberwing: [0xff7938, 0xffedac, 0x74301f],
  "storm-twins": [0x77cfff, 0xffe7a3, 0x30466d],
};
const hash = (n: number) => {
  const a = Math.sin(n * 127.1) * 43758.5453;
  return a - Math.floor(a);
};
const curve = (
  x: number,
  y: number,
  r: number,
  angle: number,
  sweep: number,
  flatten = 1,
) =>
  Array.from({ length: 17 }, (_, i) => {
    const a = angle + (sweep * i) / 16;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r * flatten };
  });
function ribbon(
  g: G,
  points: { x: number; y: number }[],
  color: number,
  hot: number,
  width: number,
  alpha: number,
) {
  g.lineStyle(width * 2.2, color, alpha * 0.13).strokePoints(points, false);
  g.lineStyle(width, color, alpha * 0.7).strokePoints(points, false);
  g.lineStyle(Math.max(0.8, width * 0.27), hot, alpha).strokePoints(
    points,
    false,
  );
}
function star(
  g: G,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
  angle = 0,
) {
  const points = Array.from({ length: 8 }, (_, i) => {
    const a = angle + (i * Math.PI) / 4,
      s = i % 2 ? r * 0.24 : r;
    return { x: x + Math.cos(a) * s, y: y + Math.sin(a) * s };
  });
  g.fillStyle(color, alpha).fillPoints(points, true);
}
/** Reuse the battle's pooled additive glows. Review portraits have translated
 * Graphics, so every glow and path uses the same world/camera transform. */
function space(
  g: G,
  run: (
    fx: Fx,
    glow: (
      x: number,
      y: number,
      r: number,
      c: number,
      a: number,
      floor?: boolean,
    ) => void,
  ) => void,
) {
  if (!g.scene?.sys?.isActive?.()) return;
  const fx = fxFor(g.scene),
    m = g.getWorldTransformMatrix();
  fx.at(null);
  const layers = [fx.g, fx.solid, fx.floor, fx.floorSolid];
  for (const layer of layers)
    layer
      .save()
      .translateCanvas(m.tx, m.ty)
      .rotateCanvas(m.rotation)
      .scaleCanvas(m.scaleX, m.scaleY);
  const glow = (
    x: number,
    y: number,
    r: number,
    c: number,
    a: number,
    floor = false,
  ) => {
    const p = m.transformPoint(x, y);
    fx.glow(p.x, p.y, r * m.scaleX, c, a, floor);
  };
  try {
    run(fx, glow);
  } finally {
    for (const layer of layers) layer.restore();
    fx.at(null);
  }
}

export function paintBossAura(
  g: G,
  id: RaidBossId,
  x: number,
  y: number,
  l: BossLifePose,
  alpha = 1,
  blue = false,
) {
  if (!l.move || alpha <= 0.01) return;
  const a = l.action,
    charge = a.gather,
    power = Math.max(charge, a.strike, a.enrage * 0.6);
  if (power < 0.03 && id !== "emberwing") return;
  const [base, hot] = colors[id],
    color = id === "storm-twins" && !blue ? 0xffce6d : base;
  space(g, (fx, glow) => {
    const cy = y + (id === "grumblecrag" ? 18 : 4),
      fade = alpha * (0.2 + power * 0.8);
    glow(x, cy, 30 + power * 36, color, fade * 0.46);
    if (charge > 0.08) {
      const radius = 24 + charge * 46;
      for (let i = 0; i < 6; i++) {
        const k = (l.time * 1.35 + i / 6) % 1,
          angle = l.time * 1.8 + (i * TAU) / 6,
          r = radius * (1 - k) + 6;
        const px = x + Math.cos(angle) * r,
          py = cy + Math.sin(angle) * r * 0.65;
        const pts = curve(x, cy, r, angle - 0.35, 0.35, 0.65);
        ribbon(fx.g, pts, color, hot, 1.5 + charge, fade * (1 - k));
        star(fx.g, px, py, 2.3 + charge * 1.5, hot, fade * (1 - k), angle);
      }
      if (id === "prismatail" || id === "somnara") {
        for (let j = 0; j < 2; j++)
          ribbon(
            fx.g,
            curve(x, cy, 43 + j * 12, l.time * (j ? -0.6 : 0.7), TAU, 0.55),
            color,
            hot,
            1,
            charge * 0.45 * alpha,
          );
      }
    }
    if (id === "emberwing") {
      for (let i = 0; i < 8; i++) {
        const k = (l.time * 0.62 + i / 8) % 1,
          side = i % 2 ? 1 : -1;
        const px = x + side * (46 + k * 35) + Math.sin(k * 7 + i) * 5,
          py = y + 40 - k * 100;
        const c = i % 3 ? color : hot;
        fx.g
          .lineStyle(1.6, c, (1 - k) * 0.65 * alpha)
          .lineBetween(px, py, px - side * 3, py + 7);
        glow(px, py, 5, c, (1 - k) * 0.22 * alpha);
      }
    }
    if (a.enrage > 0.02) {
      for (let i = 0; i < 8; i++) {
        const angle = (i * TAU) / 8 + l.time * 0.25,
          r = 50 + (1 - a.enrage) * 70;
        ribbon(
          fx.g,
          curve(x, cy, r, angle, 0.18, 0.7),
          color,
          hot,
          3,
          a.enrage * 0.55 * alpha,
        );
      }
    }
  });
}

function castEffect(
  fx: Fx,
  glow: (
    x: number,
    y: number,
    r: number,
    c: number,
    a: number,
    floor?: boolean,
  ) => void,
  id: RaidBossId,
  e: BossCast,
  blue: boolean,
) {
  const [base, hot, dark] = colors[id],
    color = id === "storm-twins" && !blue ? 0xffd36e : base;
  const k = Math.min(1, e.age / 0.75),
    fade = (1 - k) * (1 - k),
    radius = Math.min(260, Math.max(42, e.radius));
  const line = [
    "charge",
    "dive-bomb",
    "lunge",
    "tail-splash",
    "prism-lance",
    "refraction",
    "link-beam",
    "twin-rush",
  ].includes(e.kind);
  const x = line ? e.tx : e.x,
    y = line ? e.ty : e.y;
  glow(x, y, radius * (0.5 + k * 0.25), color, fade * 0.45, true);
  const ringRadius = radius * (0.14 + (1 - Math.pow(1 - k, 3)) * 0.85);
  // All shock ripples stay inside the authoritative warning footprint.
  fx.floor
    .lineStyle(10 * (1 - k) + 1, color, fade * 0.28)
    .strokeEllipse(x, y, ringRadius * 2, ringRadius * 1.1);
  fx.floor
    .lineStyle(2, hot, fade * 0.8)
    .strokeEllipse(x, y, ringRadius * 2, ringRadius * 1.1);
  if (line) {
    const points = Array.from({ length: 21 }, (_, i) => {
      const s = i / 20,
        bend = Math.sin(s * Math.PI) * Math.sin(s * 10 + e.id) * 12 * (1 - k);
      return {
        x: e.x + (e.tx - e.x) * s,
        y:
          e.y +
          (e.ty - e.y) * s -
          (id === "prismatail" ? 0 : 40 * Math.sin(s * Math.PI) + bend),
      };
    });
    ribbon(fx.g, points, color, hot, id === "gloomshade" ? 7 : 11, fade * 0.85);
  }
  if (["wing-gust", "bubbles", "volley"].includes(e.kind)) {
    const reach = radius * (1 - Math.pow(1 - Math.min(1, k * 2.8), 3));
    for (let i = -2; i <= 2; i++) {
      const angle = e.angle + i * (e.spread ?? 0.45) * 0.38;
      const points = Array.from({ length: 13 }, (_, j) => {
        const s = j / 12;
        return {
          x: e.x + Math.cos(angle) * reach * s,
          y: e.y + Math.sin(angle) * reach * s - Math.sin(s * Math.PI) * 25,
        };
      });
      ribbon(fx.g, points, color, hot, 4 + 2 * (1 - k), fade * 0.75);
    }
  }
  if (id === "grumblecrag") {
    for (let i = 0; i < 10; i++) {
      const angle = hash(e.id + i) * TAU,
        rr = radius * (0.2 + hash(i + 21) * 0.65);
      const px = x + Math.cos(angle) * rr * k,
        py = y + Math.sin(angle) * rr * k * 0.58;
      const height = Math.sin(k * Math.PI) * (24 + hash(i) * 70),
        s = (4 + hash(i + 9) * 7) * (1 - k * 0.6);
      fx.floorSolid.lineStyle(2, dark, fade * 0.65).lineBetween(x, y, px, py);
      fx.solid.fillStyle(i % 2 ? 0x647386 : 0x394656, fade).fillPoints(
        [
          { x: px - s, y: py - height },
          { x: px, y: py - height - s * 1.5 },
          { x: px + s, y: py - height },
          { x: px + s * 0.3, y: py - height + s },
        ],
        true,
      );
      fx.g
        .lineStyle(1.6, hot, fade * 0.85)
        .lineBetween(px - s, py - height, px, py - height - s * 1.5);
    }
  } else if (id === "tidewyrm") {
    for (let i = 0; i < 7; i++) {
      const angle = (i * TAU) / 7 + e.id,
        rr = ringRadius * (0.65 + hash(i) * 0.3);
      const px = x + Math.cos(angle) * rr,
        py = y + Math.sin(angle) * rr * 0.55;
      const height = Math.sin(k * Math.PI) * (25 + hash(i + 3) * 80);
      ribbon(
        fx.g,
        [
          { x: px - 5, y: py },
          { x: px - 3, y: py - height * 0.6 },
          { x: px + 6, y: py - height },
        ],
        color,
        hot,
        4 * (1 - k) + 1,
        fade * 0.8,
      );
      fx.g.fillStyle(hot, fade).fillEllipse(px + 6, py - height, 4, 8);
    }
    for (let i = 0; i < 3; i++)
      ribbon(
        fx.g,
        curve(x, y, ringRadius * 0.8, (i * TAU) / 3 + k * 3, 1.35, 0.55),
        color,
        hot,
        4,
        fade * 0.6,
      );
  } else if (id === "gloomshade") {
    for (let i = 0; i < 3; i++) {
      const r = radius * (0.4 + i * 0.17),
        angle = -2.5 + k * 2.3 + i * 0.12;
      ribbon(
        fx.g,
        curve(x, y - 16, r, angle, 1.4, 0.7),
        color,
        hot,
        7 - i,
        fade * 0.85,
      );
      const tip = curve(x, y - 16, r, angle + 1.4, 0, 0.7)[0];
      star(fx.g, tip.x, tip.y, 6, hot, fade, k * 4);
    }
  } else if (id === "somnara") {
    const points = Array.from({ length: 7 }, (_, i) => {
      const angle = (i * TAU) / 7 + k * 0.6;
      return {
        x: x + Math.cos(angle) * ringRadius * 0.8,
        y:
          y -
          30 +
          Math.sin(angle) * ringRadius * 0.5 -
          Math.sin(k * Math.PI) * 28,
      };
    });
    for (let i = 0; i < points.length; i++) {
      const p = points[i],
        q = points[(i + 2) % points.length];
      fx.g.lineStyle(1, color, fade * 0.5).lineBetween(p.x, p.y, q.x, q.y);
      star(fx.g, p.x, p.y, 8 - (i % 3), hot, fade, k * 0.5);
      glow(p.x, p.y, 13, color, fade * 0.4);
    }
  } else if (id === "prismatail") {
    const spectrum = [0xffd884, 0x83eaff, 0xd29eff, 0xa5ffdb, 0xffacda];
    for (let i = 0; i < 10; i++) {
      const angle = (i * TAU) / 10 + e.id * 0.2,
        rr = ringRadius * (0.6 + hash(i) * 0.3),
        px = x + Math.cos(angle) * rr,
        py = y - 22 + Math.sin(angle) * rr * 0.6;
      ribbon(
        fx.g,
        [
          { x, y: y - 22 },
          { x: px, y: py },
        ],
        spectrum[i % 5],
        hot,
        3,
        fade * 0.45,
      );
      fx.g.fillStyle(spectrum[i % 5], fade * 0.8).fillPoints(
        [
          { x: px, y: py - 12 },
          { x: px + 5, y: py },
          { x: px, y: py + 12 },
          { x: px - 5, y: py },
        ],
        true,
      );
      star(fx.g, px, py, 4, hot, fade, angle);
    }
  } else if (id === "emberwing") {
    for (let i = 0; i < 12; i++) {
      const angle = (i * TAU) / 12 + hash(e.id) * TAU,
        reach = ringRadius * (0.7 + hash(i) * 0.3);
      const px = x + Math.cos(angle) * reach,
        py = y + Math.sin(angle) * reach * 0.55;
      const height = Math.sin(k * Math.PI) * (35 + hash(i + 1) * 85),
        width = (6 + hash(i + 8) * 5) * (1 - k);
      const pts = [
        { x: px - Math.cos(angle) * 13, y: py + 3 },
        { x: px + Math.sin(k * 8 + i) * 10, y: py - height * 0.55 },
        { x: px + Math.sin(i + 4) * 14, y: py - height },
      ];
      ribbon(fx.g, pts, color, hot, width, fade * 0.8);
      star(fx.g, px, py - height, 3, hot, fade, angle);
    }
    glow(x, y - 25, 45, hot, fade * 0.5);
  } else {
    for (let i = 0; i < 6; i++) {
      const angle = (i * TAU) / 6 + hash(e.id) * TAU;
      const pts = Array.from({ length: 9 }, (_, j) => {
        const r = (ringRadius * j) / 8,
          jitter = j % 2 ? (1 - k) * 11 : -(1 - k) * 5;
        return {
          x: x + Math.cos(angle) * r - Math.sin(angle) * jitter,
          y: y - 20 + Math.sin(angle) * r * 0.65 + Math.cos(angle) * jitter,
        };
      });
      ribbon(fx.g, pts, color, hot, 3, fade);
      const end = pts[8];
      star(fx.g, end.x, end.y, 5, hot, fade, k * 3);
    }
  }
}

/** Cosmetic impact/aftermath from the same server events as the body poses. */
export function drawBossBattleEffects(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
) {
  if (reduced || !g.scene?.sys?.isActive?.()) return;
  const r = state.raid;
  if (!r) return;
  for (const [index, boss] of state.players
    .filter((p) => p.raidBoss)
    .entries()) {
    const life = bossLife(g, state, boss, clock, reduced);
    if (!life.action.casts.length) continue;
    space(g, (fx, glow) => {
      for (const event of life.action.casts) {
        castEffect(fx, glow, r.boss, event, index === 1);
        const line = [
          "charge",
          "dive-bomb",
          "lunge",
          "tail-splash",
          "prism-lance",
          "refraction",
          "link-beam",
          "twin-rush",
        ].includes(event.kind);
        drawBossSpellFlipbook(
          g,
          r.boss,
          line ? event.tx : event.x,
          line ? event.ty : event.y,
          event.radius,
          event.age,
          life.time,
        );
      }
    });
  }
}

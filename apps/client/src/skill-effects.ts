import { battleCurves } from "./battle-curves";
import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
import { mergeKits, type Shot } from "./fx-kits";
import { fxFor } from "./fx-engine";
import { electricKit } from "./skill-fx-electric";
import { fireKit } from "./skill-fx-fire";
import { waterKit } from "./skill-fx-water";
import { auraKit, rewindDive } from "./skill-fx-aura";
import {
  physicalBeam,
  physicalCast,
  physicalChannel,
  physicalHit,
  physicalImpact,
  physicalTrail,
  physicalZone,
} from "./fx-physics";
import { lightKit } from "./skill-fx-light";
import { psychicKit } from "./skill-fx-psychic";
import { earthKit } from "./skill-fx-earth";
import { shadowKit } from "./skill-fx-shadow";
import { natureKit } from "./skill-fx-nature";
import { withUltimates } from "./skill-fx-ultimates";
/** New-style effects by move; anything not listed keeps its classic drawing. */
const KIT = withUltimates(
  mergeKits([
    electricKit,
    fireKit,
    waterKit,
    auraKit,
    lightKit,
    psychicKit,
    earthKit,
    shadowKit,
    natureKit,
  ]),
);
/** Halcyon Rewind's dive from where Halcyra was to where it landed. */
export function playRewindDive(
  scene: Phaser.Scene,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  color: number,
) {
  rewindDive(scene, fromX, fromY, toX, toY, color, shotIn(scene));
}
/** For tests: which moves have a new-style effect. */
export const effectKit = KIT;
const shotIn =
  (scene: Phaser.Scene): Shot =>
  (ms, draw) =>
    oneShot(scene, ms, (_g, k) => draw(k));
/**
 * Per-move visual effects. Purely cosmetic: every size comes from the shared
 * ability definition (radius, range, arc, explosion), so what players see
 * matches the server's hit areas. Nothing here affects gameplay.
 */
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
const WHITE = 0xffffff;
/** Deterministic per-object jitter so effects shimmer without random flicker between frames. */
const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
function zigzag(
  g: G,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  segments: number,
  amp: number,
  seed: number,
) {
  const dx = x1 - x0,
    dy = y1 - y0,
    len = Math.hypot(dx, dy) || 1,
    nx = -dy / len,
    ny = dx / len;
  const points = [{ x: x0, y: y0 }];
  for (let i = 1; i < segments; i++) {
    const t = i / segments,
      o = (hash(seed + i) - 0.5) * 2 * amp;
    points.push({ x: x0 + dx * t + nx * o, y: y0 + dy * t + ny * o });
  }
  points.push({ x: x1, y: y1 });
  g.strokePoints(points, false);
}
function star(
  g: G,
  x: number,
  y: number,
  r: number,
  points: number,
  rotation: number,
  inner = 0.45,
) {
  const pts = [];
  for (let i = 0; i < points * 2; i++) {
    const a = rotation + (i * Math.PI) / points;
    const rr = i % 2 ? r * inner : r;
    pts.push({ x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr });
  }
  g.fillPoints(pts, true);
}
function polygon(
  g: G,
  x: number,
  y: number,
  r: number,
  sides: number,
  rot: number,
) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i * TAU) / sides;
    pts.push({ x: x + Math.cos(a) * r, y: y + Math.sin(a) * r });
  }
  return pts;
}
/** Teardrop flame pointing opposite to travel. */
function flame(
  g: G,
  x: number,
  y: number,
  r: number,
  angle: number,
  flicker: number,
) {
  const back = angle + Math.PI,
    len = r * (2.4 + flicker * 0.6);
  g.fillTriangle(
    x + Math.cos(angle + Math.PI / 2) * r,
    y + Math.sin(angle + Math.PI / 2) * r,
    x + Math.cos(angle - Math.PI / 2) * r,
    y + Math.sin(angle - Math.PI / 2) * r,
    x + Math.cos(back) * len,
    y + Math.sin(back) * len,
  );
  g.fillCircle(x, y, r);
}
function trail(
  g: G,
  pr: Projectile,
  color: number,
  seconds: number,
  width: number,
  alpha: number,
) {
  g.lineStyle(width, color, alpha).lineBetween(
    pr.x - pr.vx * seconds,
    pr.y - pr.vy * seconds,
    pr.x,
    pr.y,
  );
}
// ───────────────────────────── Projectiles ─────────────────────────────
export function drawProjectile(
  g: G,
  pr: Projectile,
  now: number,
  reduced: boolean,
) {
  const kit = KIT.projectile[pr.ability.id];
  if (kit && g.scene) {
    // The shot sorts by where it is over the ground, so stone cover in front
    // of it hides it (see Fx.at).
    const fx = fxFor(g.scene);
    fx.at(pr.y);
    try {
      kit(g, pr, now);
      if (!reduced) physicalTrail(g.scene, pr);
      return;
    } finally {
      fx.at(null);
    }
  }
  const a = pr.ability,
    c = pr.color,
    r = a.radius,
    angle = Math.atan2(pr.vy, pr.vx),
    t = reduced ? 0 : now / 1000,
    seed = pr.id * 7 + Math.floor(now / 60);
  const fallback = () => {
    trail(g, pr, c, 0.07, r * 2.2, 0.18);
    g.fillStyle(c, 0.3).fillCircle(pr.x, pr.y, r * 1.8);
    g.fillStyle(c).fillCircle(pr.x, pr.y, r);
    g.fillStyle(WHITE, 0.8).fillCircle(pr.x - r * 0.3, pr.y - r * 0.3, r * 0.4);
  };
  switch (a.id) {
    case "spark-dart":
    case "static-lance": {
      const len = a.id === "static-lance" ? 70 : 34;
      const bx = pr.x - Math.cos(angle) * len,
        by = pr.y - Math.sin(angle) * len;
      g.lineStyle(r * 2.4, c, 0.18).lineBetween(bx, by, pr.x, pr.y);
      g.lineStyle(3, c, 0.95);
      zigzag(
        g,
        bx,
        by,
        pr.x,
        pr.y,
        a.id === "static-lance" ? 7 : 4,
        r * 0.9,
        seed,
      );
      g.lineStyle(1.5, WHITE, 0.9);
      zigzag(g, bx, by, pr.x, pr.y, 4, r * 0.4, seed + 3);
      g.fillStyle(WHITE).fillCircle(pr.x, pr.y, r * 0.55);
      return;
    }
    case "ball-lightning": {
      g.fillStyle(c, 0.18).fillCircle(pr.x, pr.y, r * 1.9);
      g.fillStyle(c, 0.85).fillCircle(pr.x, pr.y, r);
      g.fillStyle(WHITE, 0.9).fillCircle(pr.x, pr.y, r * 0.45);
      g.lineStyle(2, WHITE, 0.85);
      for (let i = 0; i < 4; i++) {
        const aa = t * 5 + i * (TAU / 4) + hash(seed + i);
        zigzag(
          g,
          pr.x + Math.cos(aa) * r * 0.6,
          pr.y + Math.sin(aa) * r * 0.6,
          pr.x + Math.cos(aa) * r * 1.8,
          pr.y + Math.sin(aa) * r * 1.8,
          3,
          4,
          seed + i * 5,
        );
      }
      return;
    }
    case "magma-bomb": {
      trail(g, pr, 0x4a3b36, 0.12, r * 1.6, 0.35);
      trail(g, pr, c, 0.06, r * 1.2, 0.4);
      const pts = polygon(g, pr.x, pr.y, r, 7, t * 4);
      g.fillStyle(0x5a2a1c).fillPoints(pts, true);
      g.lineStyle(2.5, 0xffd34d, 0.95);
      g.lineBetween(
        pr.x - r * 0.6,
        pr.y - r * 0.2,
        pr.x + r * 0.1,
        pr.y + r * 0.3,
      );
      g.lineBetween(
        pr.x + r * 0.1,
        pr.y + r * 0.3,
        pr.x + r * 0.5,
        pr.y - r * 0.4,
      );
      g.fillStyle(c, 0.25).fillCircle(pr.x, pr.y, r * 1.6);
      return;
    }
    case "tide-needle": {
      const len = 30;
      const bx = pr.x - Math.cos(angle) * len,
        by = pr.y - Math.sin(angle) * len;
      g.lineStyle(r * 1.8, c, 0.2).lineBetween(bx, by, pr.x, pr.y);
      g.lineStyle(3, c, 1).lineBetween(bx, by, pr.x, pr.y);
      g.lineStyle(1.2, WHITE, 0.9).lineBetween(bx, by, pr.x, pr.y);
      for (let i = 1; i <= 3; i++)
        g.fillStyle(c, 0.6 - i * 0.15).fillCircle(
          bx - Math.cos(angle) * i * 8 + (hash(seed + i) - 0.5) * 6,
          by - Math.sin(angle) * i * 8 + (hash(seed - i) - 0.5) * 6,
          2.5 - i * 0.5,
        );
      return;
    }
    case "glint":
    case "wing-dust": {
      const points = 5;
      const spin = t * 3;
      trail(g, pr, c, 0.05, r * 1.4, 0.2);
      g.fillStyle(c, 0.25).fillCircle(pr.x, pr.y, r * 1.6);
      g.fillStyle(c);
      star(g, pr.x, pr.y, r * 1.25, points, spin, 0.45);
      g.fillStyle(WHITE, 0.9);
      star(g, pr.x, pr.y, r * 0.55, points, spin, 0.4);
      if (!reduced && hash(seed) > 0.6)
        g.fillStyle(WHITE, 0.8).fillCircle(
          pr.x - Math.cos(angle) * r * 2,
          pr.y - Math.sin(angle) * r * 2,
          2,
        );
      return;
    }
    case "riptide-wave": {
      // A wide crescent of water perpendicular to travel; width = hit radius.
      const nx = -Math.sin(angle),
        ny = Math.cos(angle);
      for (let layer = 0; layer < 3; layer++) {
        const back = layer * 10,
          w = r * (1 - layer * 0.12);
        const cx = pr.x - Math.cos(angle) * back,
          cy = pr.y - Math.sin(angle) * back;
        const pts = [];
        for (let i = 0; i <= 12; i++) {
          const s = i / 12 - 0.5;
          const bulge = Math.cos(s * Math.PI) * 14;
          pts.push({
            x: cx + nx * s * 2 * w + Math.cos(angle) * bulge,
            y: cy + ny * s * 2 * w + Math.sin(angle) * bulge,
          });
        }
        g.lineStyle(
          10 - layer * 3,
          layer === 0 ? WHITE : c,
          0.85 - layer * 0.25,
        );
        g.strokePoints(pts, false);
      }
      g.fillStyle(c, 0.12).fillCircle(pr.x, pr.y, r);
      return;
    }
    case "prism-shot": {
      trail(g, pr, c, 0.06, r * 1.5, 0.2);
      g.fillStyle(c, 0.25).fillCircle(pr.x, pr.y, r * 1.5);
      const pts = polygon(g, pr.x, pr.y, r, 4, t * 6);
      g.fillStyle(c, 0.9).fillPoints(pts, true);
      g.lineStyle(2, WHITE, 0.9).strokePoints(pts, true);
      g.fillStyle(WHITE, 0.85).fillPoints(
        polygon(g, pr.x, pr.y, r * 0.4, 4, t * 6),
        true,
      );
      return;
    }
    case "mind-dart": {
      trail(g, pr, c, 0.05, r * 1.2, 0.2);
      const tip = {
        x: pr.x + Math.cos(angle) * r * 1.4,
        y: pr.y + Math.sin(angle) * r * 1.4,
      };
      g.fillStyle(c).fillTriangle(
        tip.x,
        tip.y,
        pr.x + Math.cos(angle + 2.5) * r,
        pr.y + Math.sin(angle + 2.5) * r,
        pr.x + Math.cos(angle - 2.5) * r,
        pr.y + Math.sin(angle - 2.5) * r,
      );
      const pulse = reduced ? 1 : 1 + Math.sin(t * 18) * 0.25;
      g.lineStyle(2, c, 0.7).strokeCircle(pr.x, pr.y, r * 1.6 * pulse);
      g.fillStyle(WHITE, 0.9).fillCircle(pr.x, pr.y, r * 0.35);
      return;
    }
    case "lantern-wisp":
    case "ghostfire": {
      const flick = reduced ? 0.5 : hash(seed);
      const tint = a.id === "ghostfire" ? 0x7dffe1 : c;
      g.fillStyle(tint, 0.2).fillCircle(pr.x, pr.y, r * 1.9);
      g.fillStyle(tint, 0.85);
      flame(g, pr.x, pr.y, r, angle, flick);
      g.fillStyle(WHITE, 0.8);
      flame(g, pr.x, pr.y, r * 0.45, angle, flick);
      return;
    }
    case "shade-crawl": {
      // Ground-hugging shadow streak (ground move: jump to dodge).
      const len = 60;
      g.fillStyle(0x0b0618, 0.55).fillEllipse(
        pr.x - Math.cos(angle) * len * 0.5,
        pr.y - Math.sin(angle) * len * 0.5 + 6,
        Math.abs(Math.cos(angle)) * len + r * 2,
        Math.abs(Math.sin(angle)) * len + r * 1.2,
      );
      g.fillStyle(c, 0.8).fillEllipse(pr.x, pr.y + 6, r * 2.2, r * 1.2);
      g.fillStyle(0x7dffe1)
        .fillCircle(pr.x - 4, pr.y + 4, 2.5)
        .fillCircle(pr.x + 4, pr.y + 4, 2.5);
      return;
    }
    case "void-orb": {
      g.fillStyle(c, 0.18).fillCircle(pr.x, pr.y, r * 1.7);
      g.lineStyle(3, c, 0.9);
      for (let i = 0; i < 3; i++) {
        const aa = -t * 6 + (i * TAU) / 3;
        g.beginPath()
          .arc(pr.x, pr.y, r * 1.3, aa, aa + 1.2)
          .strokePath();
      }
      g.fillStyle(0x08040f).fillCircle(pr.x, pr.y, r);
      g.lineStyle(2, 0xd9c7ff, 0.9).strokeCircle(pr.x, pr.y, r);
      return;
    }
    default:
      fallback();
  }
}
// ───────────────────────────── Zones ─────────────────────────────
/** `progress` runs 0 → 1 over the zone's lifetime. */
export function drawZone(
  g: G,
  z: Zone,
  progress: number,
  now: number,
  reduced: boolean,
) {
  const kit = KIT.zone[z.ability.id];
  if (kit && g.scene) {
    kit(g, z, progress, now);
    if (!reduced) physicalZone(g.scene, z);
    return;
  }
  const a = z.ability,
    c = z.color,
    r = z.radius,
    t = reduced ? 0 : now / 1000,
    fade = progress > 0.85 ? (1 - progress) / 0.15 : 1;
  switch (a.id) {
    case "practice-grid": {
      g.fillStyle(c, 0.1 * fade).fillCircle(z.x, z.y, r);
      g.lineStyle(1.5, c, 0.45 * fade);
      for (let o = -r; o <= r; o += r / 3) {
        const h = Math.sqrt(Math.max(0, r * r - o * o));
        g.lineBetween(z.x + o, z.y - h, z.x + o, z.y + h);
        g.lineBetween(z.x - h, z.y + o, z.x + h, z.y + o);
      }
      g.lineStyle(3, c, 0.85 * fade).strokeCircle(z.x, z.y, r);
      g.lineStyle(2, WHITE, 0.8 * fade);
      const seed = Math.floor(now / 90) + z.id;
      for (let i = 0; i < 3; i++) {
        const a0 = hash(seed + i) * TAU,
          a1 = a0 + 1 + hash(seed - i) * 2;
        zigzag(
          g,
          z.x + Math.cos(a0) * r * 0.9,
          z.y + Math.sin(a0) * r * 0.9,
          z.x + Math.cos(a1) * r * 0.5,
          z.y + Math.sin(a1) * r * 0.5,
          4,
          8,
          seed + i,
        );
      }
      return;
    }
    case "heat-cracks": {
      g.fillStyle(c, 0.1 * fade).fillCircle(z.x, z.y, r);
      for (let i = 0; i < 6; i++) {
        const aa = t * 7 + (i * TAU) / 6;
        g.fillStyle(i % 2 ? 0xffd34d : c, 0.75 * fade);
        flame(
          g,
          z.x + Math.cos(aa) * r * 0.78,
          z.y + Math.sin(aa) * r * 0.78,
          9,
          aa + Math.PI / 2,
          0.4,
        );
      }
      g.lineStyle(2, c, 0.6 * fade).strokeCircle(z.x, z.y, r);
      return;
    }
    case "sunfire-pillar": {
      // Telegraph before the first strike, then a column of fire.
      const strikeAt = (a.tickDelay ?? 0.35) / a.duration;
      if (progress < strikeAt) {
        const k = progress / strikeAt;
        g.fillStyle(c, 0.12 + k * 0.15).fillCircle(z.x, z.y, r);
        g.lineStyle(3, 0xffd34d, 0.9).strokeCircle(z.x, z.y, r);
        g.lineStyle(2, 0xffd34d, 0.8).strokeCircle(z.x, z.y, r * (1 - k));
        return;
      }
      g.fillStyle(c, 0.35 * fade).fillCircle(z.x, z.y, r);
      g.fillStyle(0xffd34d, 0.55 * fade).fillCircle(z.x, z.y, r * 0.62);
      g.fillStyle(WHITE, 0.6 * fade).fillCircle(z.x, z.y, r * 0.25);
      for (let i = 0; i < 10; i++) {
        const aa = (i * TAU) / 10 + t * 2,
          h = 40 + hash(i + Math.floor(now / 70)) * 50;
        g.fillStyle(i % 2 ? c : 0xffd34d, 0.7 * fade);
        g.fillTriangle(
          z.x + Math.cos(aa) * r * 0.5 - 8,
          z.y + Math.sin(aa) * r * 0.5,
          z.x + Math.cos(aa) * r * 0.5 + 8,
          z.y + Math.sin(aa) * r * 0.5,
          z.x + Math.cos(aa) * r * 0.5,
          z.y + Math.sin(aa) * r * 0.5 - h,
        );
      }
      return;
    }
    case "mind-maze": {
      const strikeAt = (a.tickDelay ?? 0.35) / a.duration;
      if (progress < strikeAt) {
        // Reticle closes in on the target, then the strike lands.
        const k = progress / strikeAt;
        g.fillStyle(c, 0.1 + k * 0.12).fillCircle(z.x, z.y, r);
        g.lineStyle(3, c, 0.95).strokeCircle(z.x, z.y, r);
        const inner = r * (1.6 - k * 1.2);
        g.lineStyle(2, WHITE, 0.85).strokeCircle(z.x, z.y, inner);
        for (let i = 0; i < 4; i++) {
          const aa = (i * TAU) / 4 + k * 1.5;
          g.lineBetween(
            z.x + Math.cos(aa) * inner,
            z.y + Math.sin(aa) * inner,
            z.x + Math.cos(aa) * (inner + 18),
            z.y + Math.sin(aa) * (inner + 18),
          );
        }
        return;
      }
      g.fillStyle(c, 0.5 * fade).fillCircle(z.x, z.y, r);
      g.fillStyle(WHITE, 0.55 * fade).fillCircle(z.x, z.y, r * 0.45);
      g.lineStyle(4, c, fade).strokeCircle(
        z.x,
        z.y,
        r * (1 + (1 - fade) * 0.3),
      );
      return;
    }
    case "mud-mire": {
      for (let i = 0; i < 9; i++) {
        const aa = (i * TAU) / 9 + t * 0.4,
          d = r * (0.35 + hash(z.id + i) * 0.45);
        g.fillStyle(i % 2 ? 0xe2c79c : 0xcfb184, 0.32 * fade).fillCircle(
          z.x + Math.cos(aa) * d,
          z.y + Math.sin(aa) * d * 0.8,
          r * (0.32 + hash(i * 3 + z.id) * 0.15),
        );
      }
      g.lineStyle(2, 0xe2c79c, 0.55 * fade).strokeCircle(z.x, z.y, r);
      return;
    }
    default:
      g.fillStyle(c, 0.12 * fade).fillCircle(z.x, z.y, r);
      g.lineStyle(3, c, 0.7 * fade).strokeCircle(z.x, z.y, r);
  }
}
// ───────────────────────── Wind-ups and channels ─────────────────────────
/**
 * Telegraph for a skill with a cast time. `progress` 0 → 1 across the wind-up.
 * Shows the real area so the opponent can react.
 */
export function drawWindup(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  aimX: number,
  aimY: number,
  color: number,
  progress: number,
  now: number,
) {
  const k = Math.max(0, Math.min(1, progress));
  const kit = KIT.windup[a.id];
  if (kit && g.scene) return kit(g, a, x, y, angle, aimX, aimY, color, k, now);
  if (a.kind === "nova") {
    g.fillStyle(color, 0.08 + k * 0.12).fillCircle(x, y, a.radius);
    g.lineStyle(2, color, 0.7).strokeCircle(x, y, a.radius);
    g.lineStyle(4, WHITE, 0.6).strokeCircle(x, y, a.radius * k);
    return;
  }
  if (a.kind === "zone") {
    const d = Math.min(a.range, Math.hypot(aimX - x, aimY - y));
    const tx = x + Math.cos(angle) * d,
      ty = y + Math.sin(angle) * d;
    g.lineStyle(2, color, 0.6).strokeCircle(tx, ty, a.radius);
    g.fillStyle(color, 0.08 + k * 0.1).fillCircle(tx, ty, a.radius * k);
    return;
  }
  // Charged projectiles: aim lane as wide as the projectile.
  const len = Math.min(a.range, 420);
  g.lineStyle(a.radius * 2, color, 0.08 + k * 0.1).lineBetween(
    x,
    y - 10,
    x + Math.cos(angle) * len,
    y - 10 + Math.sin(angle) * len,
  );
  g.fillStyle(color, 0.35 + Math.sin(now / 50) * 0.1).fillCircle(
    x + Math.cos(angle) * 30,
    y - 10 + Math.sin(angle) * 30,
    a.radius * (0.4 + k * 0.6),
  );
}
/** Continuous cone (Crest Flare) drawn with the real range and arc. */
export function drawChannel(
  g: G,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  now: number,
  reduced: boolean,
) {
  const kit = KIT.channel[a.id];
  if (kit && g.scene) {
    kit(g, a, x, y, angle, color, now);
    if (!reduced) physicalChannel(g.scene, a, x, y, angle);
    return;
  }
  const spread = Math.acos(a.arc ?? 0.7);
  g.fillStyle(color, 0.16).slice(
    x,
    y - 12,
    a.range,
    angle - spread,
    angle + spread,
  );
  g.fillPath();
  if (reduced) return;
  for (let i = 0; i < 14; i++) {
    const life = (now / 400 + hash(i)) % 1,
      off = (hash(i * 7) - 0.5) * 2 * spread,
      d = life * a.range;
    g.fillStyle(life < 0.5 ? 0xffd34d : color, 0.8 * (1 - life));
    flame(
      g,
      x + Math.cos(angle + off) * d,
      y - 12 + Math.sin(angle + off) * d,
      4 + life * 9,
      angle + off,
      hash(i + Math.floor(now / 60)),
    );
  }
}
// ───────────────────────────── One-shots ─────────────────────────────
/** Run an animated, self-destroying effect; `draw` receives 0 → 1. */
function oneShot(
  scene: Phaser.Scene,
  duration: number,
  draw: (g: G, k: number) => void,
  depth = 4,
) {
  const g = battleCurves(scene.add.graphics()).setDepth(depth);
  draw(g, 0);
  scene.tweens.addCounter({
    from: 0,
    to: 1,
    duration,
    onUpdate: (tween) => {
      g.clear();
      draw(g, tween.getValue() ?? 1);
    },
    onComplete: () => g.destroy(),
  });
}
function swipe(
  g: G,
  x: number,
  y: number,
  a: Ability,
  angle: number,
  color: number,
  k: number,
) {
  const spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.35));
  const from = angle - spread,
    to = angle - spread + 2 * spread * Math.min(1, k * 2.2);
  g.fillStyle(color, 0.28 * (1 - k)).slice(x, y, a.range, from, to);
  g.fillPath();
  g.lineStyle(5 * (1 - k) + 1, WHITE, 0.85 * (1 - k))
    .beginPath()
    .arc(x, y, a.range * 0.92, from, to)
    .strokePath();
}
/** Effects that play when a move is cast (melee strikes, bursts, buffs). */
export function playCast(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  reduced: boolean,
  at?: () => { x: number; y: number } | undefined,
) {
  const kit = KIT.cast[a.id];
  if (kit) {
    kit(scene, a, x, y, angle, color, shotIn(scene), at);
    if (!reduced) physicalCast(scene, a, x, y, angle);
    return;
  }
  // Every roster move has its own effect above; anything else that is a
  // melee strike still shows its real arc.
  if (a.kind === "melee")
    return oneShot(scene, 220, (g, k) =>
      swipe(g, x, y - 10, a, angle, color, k),
    );
}
/** Instant psychic ray along the server-computed path. */
export function playBeam(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  tx: number,
  ty: number,
  color: number,
  reduced: boolean,
) {
  const kit = KIT.beam[a.id];
  if (kit) {
    kit(scene, a, x, y, tx, ty, color, shotIn(scene));
    if (!reduced) physicalBeam(scene, a, x, y, tx, ty);
    return;
  }
  const sy = y - 12;
  oneShot(scene, reduced ? 140 : 320, (g, k) => {
    g.lineStyle(a.radius * 2 * (1 - k * 0.5), color, 0.3 * (1 - k)).lineBetween(
      x,
      sy,
      tx,
      ty,
    );
    g.lineStyle(6 * (1 - k) + 1, WHITE, 0.95 * (1 - k)).lineBetween(
      x,
      sy,
      tx,
      ty,
    );
    const len = Math.hypot(tx - x, ty - sy);
    for (let d = 30; d < len; d += 46) {
      const px = x + ((tx - x) * d) / len,
        py = sy + ((ty - sy) * d) / len;
      g.lineStyle(2, color, 0.9 * (1 - k)).strokeEllipse(
        px,
        py,
        12 + k * 18,
        22 + k * 30,
      );
    }
    g.fillStyle(WHITE, 1 - k).fillCircle(tx, ty, 10 * (1 - k) + 2);
  });
}
/** Projectile end: explosions show their true blast radius. */
export function playImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  reduced: boolean,
) {
  const kit = KIT.impact[a.id];
  if (kit) {
    kit(scene, a, x, y, color, shotIn(scene));
    if (!reduced) physicalImpact(scene, a, x, y);
    return;
  }
  const blast = a.explosion ?? 0;
  if (blast > 0)
    return oneShot(
      scene,
      reduced ? 200 : 420,
      (g, k) => {
        if (a.id === "void-orb") {
          // Implodes, then bursts.
          const r =
            k < 0.35
              ? blast * (1 - k / 0.35) * 0.6
              : blast * ((k - 0.35) / 0.65);
          g.fillStyle(0x08040f, 0.6 * (1 - k)).fillCircle(x, y, blast * 0.5);
          g.lineStyle(5, color, 1 - k).strokeCircle(x, y, Math.max(2, r));
          return;
        }
        g.fillStyle(color, 0.3 * (1 - k)).fillCircle(
          x,
          y,
          blast * Math.min(1, k * 2.5),
        );
        g.lineStyle(4, WHITE, 1 - k).strokeCircle(
          x,
          y,
          blast * Math.min(1, k * 2),
        );
        if (a.id === "ball-lightning") {
          g.lineStyle(2.5, WHITE, 1 - k);
          for (let i = 0; i < 7; i++) {
            const aa = (i * TAU) / 7;
            zigzag(
              g,
              x,
              y,
              x + Math.cos(aa) * blast,
              y + Math.sin(aa) * blast,
              4,
              8,
              i * 9 + Math.floor(k * 5),
            );
          }
        }
        if (a.id === "magma-bomb")
          for (let i = 0; i < 8; i++) {
            const aa = (i * TAU) / 8 + hash(i);
            g.fillStyle(i % 2 ? 0x5a2a1c : 0xffd34d, 1 - k).fillCircle(
              x + Math.cos(aa) * blast * k,
              y + Math.sin(aa) * blast * k - Math.sin(k * Math.PI) * 20,
              4,
            );
          }
      },
      3,
    );
  if (reduced) return;
  oneShot(
    scene,
    220,
    (g, k) => {
      g.lineStyle(3, color, 1 - k).strokeCircle(x, y, a.radius + k * 18);
    },
    3,
  );
}
/** Element-flavoured hit sparks. */
export function playHit(
  scene: Phaser.Scene,
  element: string,
  x: number,
  y: number,
  color: number,
  reduced: boolean,
) {
  const kit = KIT.hit[element.toLowerCase()];
  if (kit) {
    kit(scene, x, y, color, shotIn(scene));
    if (!reduced) physicalHit(scene, element, x, y);
    return;
  }
  if (reduced) return;
  const cy = y - 12;
  oneShot(
    scene,
    320,
    (g, k) => {
      for (let i = 0; i < 7; i++) {
        const aa = (i * TAU) / 7 + hash(i) * 0.5,
          d = 10 + k * 38,
          px = x + Math.cos(aa) * d,
          py = cy + Math.sin(aa) * d;
        const alpha = 1 - k;
        switch (element.toLowerCase()) {
          case "electric":
            g.lineStyle(2, i % 2 ? WHITE : color, alpha);
            zigzag(g, x, cy, px, py, 3, 5, i * 11);
            break;
          case "fire":
            g.fillStyle(i % 2 ? 0xffd34d : color, alpha);
            flame(g, px, py - k * 10, 4, aa, 0.3);
            break;
          case "water":
            g.fillStyle(i % 2 ? WHITE : color, alpha).fillCircle(
              px,
              py + k * k * 20,
              3.5 - k * 2,
            );
            break;
          case "light":
            g.fillStyle(i % 2 ? 0xfff1a0 : color, alpha);
            star(g, px, py, 5, 4, k * 4, 0.35);
            break;
          case "earth":
            g.fillStyle(i % 2 ? 0x7e6a55 : 0xc79a5b, alpha).fillPoints(
              polygon(g, px, py + k * k * 24, 4, 5, i),
              true,
            );
            break;
          case "shadow":
            g.fillStyle(i % 2 ? 0x7dffe1 : color, alpha * 0.8).fillCircle(
              px,
              py - k * 16,
              4 + k * 3,
            );
            break;
          case "psychic":
            if (i === 0)
              g.lineStyle(3, color, alpha).strokeCircle(x, cy, 8 + k * 34);
            break;
          default:
            g.fillStyle(i % 2 ? WHITE : color, alpha).fillPoints(
              polygon(g, px, py, 4, 4, aa),
              true,
            );
        }
      }
      g.lineStyle(2, WHITE, 0.7 * (1 - k)).strokeCircle(x, cy, 6 + k * 20);
    },
    5,
  );
}

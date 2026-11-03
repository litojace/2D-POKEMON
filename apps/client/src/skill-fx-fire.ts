import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
import { fxFor, type Fx } from "./fx-engine";
import { TAU, ease, hash, type FxKit, type G, type Shot } from "./fx-kits";
/**
 * Cindrake's kit: real flame (white-hot cores cooling to orange), embers that
 * float up on the heat, smoke, molten debris and scorched floor. Sizes come
 * from the shared abilities (range, arc, radius, explosion).
 */
const GOLD = 0xffc65a;
const HOT = 0xfff4c8;
const SMOKE = 0x4a4240;
const CRUST = 0x4a2318;

function embers(
  fx: Fx,
  x: number,
  y: number,
  n: number,
  color: number,
  spread = 40,
) {
  fx.burst({
    x,
    y,
    z: 6,
    count: n,
    kind: "ember",
    color: [color, GOLD],
    speed: [10, spread],
    up: [60, 160],
    life: [0.6, 1.3],
    size: [0.9, 1.6],
    grav: -40,
    drag: 1.4,
  });
}
function smoke(
  fx: Fx,
  x: number,
  y: number,
  n: number,
  size: [number, number] = [8, 14],
) {
  fx.burst({
    x,
    y,
    z: 14,
    count: n,
    kind: "smoke",
    color: SMOKE,
    speed: [5, 30],
    up: [20, 50],
    life: [0.9, 1.6],
    size,
    grav: -10,
    drag: 1.2,
  });
}

// ───────────── Cinder Snap: three flaming claw rakes ─────────────
function cinderSnap(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 10,
    spread = Math.min(Math.PI * 0.95, Math.acos(a.arc ?? 0.35)),
    range = a.range;
  for (let i = 0; i < 3; i++) {
    const off = (i - 1) * spread * 0.55;
    fx.burst({
      x: x + Math.cos(angle + off) * range * 0.75,
      y: y + Math.sin(angle + off) * range * 0.75,
      z: 10,
      count: 4,
      kind: "flame",
      color,
      angle: angle + off,
      spread: 0.5,
      speed: [40, 110],
      up: [20, 80],
      life: [0.25, 0.45],
      size: [5, 9],
      drag: 3,
    });
  }
  embers(
    fx,
    x + Math.cos(angle) * range * 0.7,
    y + Math.sin(angle) * range * 0.7,
    8,
    color,
    90,
  );
  shot(fx.reduced ? 160 : 300, (k) => {
    const sweep = Math.min(1, k / 0.45),
      fade = 1 - Math.max(0, (k - 0.35) / 0.65);
    // True hit area, faint.
    fx.floor
      .fillStyle(color, 0.14 * (1 - k))
      .slice(x, cy + 10, range, angle - spread, angle + spread);
    fx.floor.fillPath();
    fx.glow(
      x + Math.cos(angle) * range * 0.6,
      cy + Math.sin(angle) * range * 0.6,
      range * 0.7,
      color,
      0.45 * fade,
      true,
    );
    for (let i = 0; i < 3; i++) {
      const rr = range * (0.58 + i * 0.16),
        head = angle - spread + 2 * spread * sweep,
        tail = head - spread * 0.9;
      const pts: { x: number; y: number }[] = [];
      for (let j = 0; j <= 14; j++) {
        const t = j / 14,
          a2 = Math.max(angle - spread, tail + (head - tail) * t);
        pts.push({ x: x + Math.cos(a2) * rr, y: cy + Math.sin(a2) * rr });
      }
      fx.solid.lineStyle(9, 0x2a0d06, 0.25 * fade).strokePoints(pts, false);
      fx.g.lineStyle(10, color, 0.45 * fade).strokePoints(pts, false);
      fx.g.lineStyle(5, GOLD, 0.8 * fade).strokePoints(pts.slice(5), false);
      fx.g.lineStyle(2, HOT, 0.95 * fade).strokePoints(pts.slice(9), false);
    }
  });
}

// ───────────── Crest Flare: the flame crest flares into a cone ─────────────
function emberGust(
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
    mx = x + Math.cos(angle) * 22,
    my = y + Math.sin(angle) * 22;
  // True cone, very faint, so the reach is still readable.
  fx.floor
    .fillStyle(color, 0.1)
    .slice(x, y, a.range, angle - spread, angle + spread);
  fx.floor.fillPath();
  fx.glow(
    x + Math.cos(angle) * a.range * 0.5,
    y + Math.sin(angle) * a.range * 0.5,
    a.range * 0.65,
    color,
    0.45,
    true,
  );
  fx.glow(mx, my - 12, 34, HOT, 0.7 + Math.sin(now / 40) * 0.15);
  fx.trail(`gust${color}`, 0.016, () => {
    const life = 0.42;
    fx.burst({
      x: mx,
      y: my,
      z: 12,
      count: 4,
      kind: "flame",
      color,
      angle,
      spread: spread * 0.85,
      speed: [(a.range / life) * 0.75, (a.range / life) * 1.05],
      up: [0, 40],
      life: [life * 0.8, life * 1.1],
      size: [9, 15],
      drag: 0.9,
    });
    if (Math.random() < 0.35)
      embers(
        fx,
        mx + Math.cos(angle) * a.range * 0.8,
        my + Math.sin(angle) * a.range * 0.8,
        1,
        color,
        60,
      );
    if (Math.random() < 0.2)
      smoke(
        fx,
        mx + Math.cos(angle) * a.range,
        my + Math.sin(angle) * a.range,
        1,
      );
  });
}

// ───────────── Magma Bomb ─────────────
function magmaBomb(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    r = pr.ability.radius,
    c = pr.color,
    hover = 16 + Math.sin(now / 120 + pr.id) * 2,
    x = pr.x,
    y = pr.y - hover,
    spin = now / 160 + pr.id;
  fx.solid
    .fillStyle(0x000000, 0.25)
    .fillEllipse(pr.x, pr.y + 6, r * 2, r * 0.8);
  fx.glow(pr.x, pr.y + 6, r * 3, c, 0.4, true);
  fx.glow(x, y, r * 3.4, c, 0.45);
  // Crusted rock with molten seams that pulse.
  const pts = Array.from({ length: 8 }, (_, i) => {
    const a = spin + (i * TAU) / 8,
      rr = r * (0.88 + hash(pr.id + i) * 0.2);
    return { x: x + Math.cos(a) * rr, y: y + Math.sin(a) * rr };
  });
  fx.solid.fillStyle(CRUST, 1).fillPoints(pts, true);
  fx.solid
    .fillStyle(0x6b3220, 1)
    .fillCircle(x - r * 0.25, y - r * 0.25, r * 0.45);
  const pulse = 0.7 + Math.sin(now / 90) * 0.3;
  fx.g.lineStyle(3, GOLD, pulse);
  for (let i = 0; i < 3; i++) {
    const a = spin + i * 2.1;
    fx.g.lineBetween(
      x + Math.cos(a) * r * 0.1,
      y + Math.sin(a) * r * 0.1,
      x + Math.cos(a + 0.4) * r * 0.85,
      y + Math.sin(a + 0.4) * r * 0.85,
    );
  }
  fx.g.lineStyle(2, c, 0.8).strokePoints(pts, true);
  fx.trail(`mb${pr.id}`, 0.03, () => {
    smoke(fx, pr.x, pr.y, 1, [6, 10]);
    fx.burst({
      x: pr.x,
      y: pr.y,
      z: hover,
      count: 1,
      kind: "flame",
      color: c,
      speed: [0, 20],
      up: [0, 30],
      life: [0.25, 0.4],
      size: [4, 7],
      drag: 2,
    });
    if (Math.random() < 0.4)
      fx.burst({
        x: pr.x,
        y: pr.y,
        z: hover - r * 0.6,
        count: 1,
        kind: "drop",
        color: GOLD,
        speed: [5, 20],
        up: [-20, 10],
        life: [0.4, 0.6],
        size: [1.6, 2.4],
        grav: 900,
        bounce: 0.1,
      });
  });
}
function magmaImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    blast = a.explosion ?? 110;
  fx.burst({
    x,
    y,
    z: 10,
    count: 34,
    kind: "flame",
    color,
    speed: [blast * 1.2, blast * 3.2],
    up: [40, 220],
    life: [0.3, 0.55],
    size: [8, 15],
    drag: 4,
  });
  fx.burst({
    x,
    y,
    z: 14,
    count: 12,
    kind: "debris",
    color: [CRUST, 0x6b3220, 0x2b1a14],
    speed: [120, 300],
    up: [200, 420],
    life: [0.8, 1.3],
    size: [3, 6],
    grav: 1100,
    bounce: 0.3,
  });
  fx.burst({
    x,
    y,
    z: 14,
    count: 16,
    kind: "drop",
    color: [GOLD, color],
    speed: [80, 260],
    up: [150, 380],
    life: [0.5, 0.9],
    size: [1.6, 2.6],
    grav: 1100,
    bounce: 0.15,
  });
  embers(fx, x, y, 18, color, 120);
  smoke(fx, x, y, 10, [14, 24]);
  fx.decal({ kind: "scorch", x, y, r: blast * 0.6, color, life: 5 });
  fx.shake(150, 0.004);
  shot(fx.reduced ? 220 : 520, (k) => {
    fx.glow(x, y - 12, blast * 0.7, HOT, 0.6 * Math.max(0, 1 - k / 0.15));
    fx.glow(x, y - 12, blast * 1.1, color, 0.55 * (1 - k));
    fx.glow(x, y, blast * 1.3, color, 0.5 * (1 - k), true);
    fx.shockwave(x, y, blast * ease(Math.min(1, k * 2.2)), k, GOLD, 9);
  });
}

// ───────────── Heat Cracks: a ring of heat that follows Cindrake ─────────────
function blazeWhirl(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    r = z.radius,
    c = z.color,
    fade =
      progress > 0.85 ? (1 - progress) / 0.15 : Math.min(1, progress / 0.08),
    spin = now / 260,
    sq = 0.82;
  fx.glow(z.x, z.y, r * 1.15, c, 0.4 * fade, true);
  fx.floor
    .lineStyle(10, c, 0.3 * fade)
    .strokeEllipse(z.x, z.y, r * 2, r * 2 * sq);
  fx.floor
    .lineStyle(3, GOLD, 0.7 * fade)
    .strokeEllipse(z.x, z.y, r * 2, r * 2 * sq);
  // Flame tongues around the rim, leaning with the spin.
  for (let i = 0; i < 14; i++) {
    const a = spin + (i * TAU) / 14,
      px = z.x + Math.cos(a) * r,
      py = z.y + Math.sin(a) * r * sq,
      h = (26 + hash(i + Math.floor(now / 80)) * 22) * fade,
      lean = Math.cos(a) * 10;
    fx.solid
      .fillStyle(c, 0.9 * fade)
      .fillTriangle(px - 10, py, px + 10, py, px + lean, py - h);
    fx.solid
      .fillStyle(0xffa53a, 0.95 * fade)
      .fillTriangle(px - 6, py, px + 6, py, px + lean * 0.75, py - h * 0.66);
    fx.g
      .fillStyle(GOLD, 0.6 * fade)
      .fillTriangle(px - 3, py, px + 3, py, px + lean * 0.5, py - h * 0.38);
    fx.glow(px, py - h * 0.3, 18, c, 0.3 * fade);
  }
  fx.trail(`bw${z.id}`, 0.03, () => {
    const a = Math.random() * TAU;
    fx.burst({
      x: z.x + Math.cos(a) * r,
      y: z.y + Math.sin(a) * r * sq,
      z: 6,
      count: 2,
      kind: "flame",
      color: c,
      angle: a + Math.PI / 2,
      spread: 0.3,
      speed: [80, 140],
      up: [40, 120],
      life: [0.3, 0.5],
      size: [5, 9],
      drag: 2,
    });
    embers(
      fx,
      z.x + Math.cos(a + 1) * r * 0.9,
      z.y + Math.sin(a + 1) * r * sq * 0.9,
      1,
      c,
      50,
    );
    if (Math.random() < 0.3)
      smoke(fx, z.x + Math.cos(a) * r, z.y + Math.sin(a) * r * sq, 1);
  });
}

// ───────────── Sunfire Pillar: a column of fire from the sky ─────────────
function sunfireWindup(
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
    d = Math.min(a.range, Math.hypot(aimX - x, aimY - y)),
    tx = x + Math.cos(angle) * d,
    ty = y + Math.sin(angle) * d;
  sunGlyph(fx, tx, ty, a.radius, color, 0.35 + k * 0.5, now);
  fx.glow(tx, ty, a.radius * (0.5 + k * 0.6), color, 0.3 + k * 0.3, true);
}
function sunGlyph(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
  now: number,
) {
  const sq = 0.82,
    spin = now / 900;
  fx.floor.lineStyle(3, GOLD, alpha).strokeEllipse(x, y, r * 2, r * 2 * sq);
  fx.floor
    .lineStyle(1.5, color, alpha * 0.8)
    .strokeEllipse(x, y, r * 1.5, r * 1.5 * sq);
  for (let i = 0; i < 12; i++) {
    const a = spin + (i * TAU) / 12;
    fx.floor.lineBetween(
      x + Math.cos(a) * r * 0.75,
      y + Math.sin(a) * r * 0.75 * sq,
      x + Math.cos(a) * r * 0.95,
      y + Math.sin(a) * r * 0.95 * sq,
    );
  }
}
function sunfirePillar(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    c = z.color,
    strikeAt = (a.tickDelay ?? 0.35) / a.duration,
    sq = 0.82;
  if (progress < strikeAt) {
    // Gathering: the glyph brightens and closes, heat shimmers rise.
    const k = progress / strikeAt;
    sunGlyph(fx, z.x, z.y, r, c, 0.6 + k * 0.4, now);
    fx.floor
      .lineStyle(4, HOT, 0.8)
      .strokeEllipse(z.x, z.y, r * 2 * (1 - k), r * 2 * sq * (1 - k));
    fx.glow(z.x, z.y, r * (0.6 + k * 0.7), c, 0.35 + k * 0.4, true);
    fx.trail(`sp${z.id}`, 0.04, () =>
      embers(
        fx,
        z.x + (Math.random() - 0.5) * r,
        z.y + (Math.random() - 0.5) * r * sq,
        2,
        c,
        20,
      ),
    );
    return;
  }
  const k = (progress - strikeAt) / (1 - strikeAt),
    fade = k > 0.7 ? 1 - (k - 0.7) / 0.3 : 1,
    top = z.y - 640;
  fx.trail(`sps${z.id}`, 999, () => {
    fx.burst({
      x: z.x,
      y: z.y,
      z: 8,
      count: 40,
      kind: "flame",
      color: c,
      speed: [r * 1.4, r * 3],
      up: [30, 160],
      life: [0.3, 0.6],
      size: [8, 14],
      drag: 3.5,
    });
    fx.burst({
      x: z.x,
      y: z.y,
      z: 10,
      count: 10,
      kind: "debris",
      color: [0x6b5a48, 0x4a3b30],
      speed: [100, 260],
      up: [220, 420],
      life: [0.8, 1.2],
      size: [3, 5],
      grav: 1100,
    });
    smoke(fx, z.x, z.y, 8, [16, 26]);
    fx.decal({
      kind: "scorch",
      x: z.x,
      y: z.y,
      r: r * 0.85,
      color: c,
      life: 5,
    });
    fx.shake(200, 0.005);
  });
  const w =
    r * (0.75 + Math.sin(now / 50) * 0.04) * (k < 0.08 ? 0.5 + k / 0.16 : 1);
  // The column: solid fire body with a hot core, soft at the edges.
  const h = (z.y - top) / 2,
    mid = (z.y + top) / 2,
    flick = 1 + Math.sin(now / 37) * 0.05;
  // Overlapping segments keep the column the same width all the way up.
  for (let i = 0; i < 5; i++) {
    const cy = z.y - (i + 0.5) * ((z.y - top) / 5),
      seg = (z.y - top) / 5,
      wob = Math.sin(now / 90 + i * 1.7) * w * 0.08;
    // The sprite fades well inside its edge, so radius ≈ 2× the visible width.
    fx.soft(
      z.x + wob,
      cy,
      w * 2.1 * flick,
      c,
      0.95 * fade,
      (seg * 1.6) / (w * 2.1),
    );
    fx.soft(z.x + wob, cy, w * 1.4, 0xffa53a, fade, (seg * 1.6) / (w * 1.4));
    fx.glow(
      z.x + wob,
      cy,
      w * 0.8,
      GOLD,
      0.75 * fade,
      false,
      (seg * 1.6) / (w * 0.8),
    );
    fx.glow(
      z.x + wob,
      cy,
      w * 0.35,
      HOT,
      0.8 * fade,
      false,
      (seg * 1.6) / (w * 0.35),
    );
  }
  void h;
  void mid;
  fx.soft(z.x, z.y - 10, w * 1.5, c, 0.85 * fade, 0.7);
  fx.glow(z.x, z.y - 10, w * 0.9, GOLD, 0.6 * fade, false, 0.7);
  fx.glow(z.x, z.y, r * 1.6, c, 0.6 * fade, true);
  if (k < 0.12) fx.glow(z.x, z.y - 60, r * 1.6, GOLD, 0.8 * (1 - k / 0.12));
  fx.shockwave(
    z.x,
    z.y,
    r * (1 + ease(Math.min(1, k * 3)) * 0.6),
    Math.min(1, k * 2),
    GOLD,
    10,
  );
  fx.trail(`spf${z.id}`, 0.025, () => {
    const a2 = Math.random() * TAU;
    fx.burst({
      x: z.x + Math.cos(a2) * w,
      y: z.y + Math.sin(a2) * w * sq,
      z: 4,
      count: 2,
      kind: "flame",
      color: c,
      speed: [20, 60],
      up: [200, 420],
      life: [0.3, 0.5],
      size: [7, 12],
      drag: 1.5,
    });
    embers(fx, z.x, z.y, 2, c, 100);
  });
}

// ───────────── Casts and hits ─────────────
function magmaCast(
  scene: Phaser.Scene,
  _a: Ability,
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
    count: 8,
    kind: "flame",
    color,
    angle,
    spread: 0.5,
    speed: [60, 160],
    up: [20, 80],
    life: [0.2, 0.35],
    size: [5, 8],
    drag: 3,
  });
  smoke(fx, mx, my, 2);
  shot(180, (k) =>
    fx.glow(mx, my - 14, 40 * (1 - k * 0.4), color, 0.8 * (1 - k)),
  );
}
function fireHit(
  scene: Phaser.Scene,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y,
    z: 20,
    count: 10,
    kind: "flame",
    color,
    speed: [40, 140],
    up: [40, 160],
    life: [0.25, 0.45],
    size: [5, 9],
    drag: 3,
  });
  embers(fx, x, y, 6, color, 70);
  smoke(fx, x, y, 2, [8, 12]);
  shot(fx.reduced ? 140 : 300, (k) => {
    fx.glow(x, y - 18, 46 * (1 - k * 0.4), color, 0.75 * (1 - k));
    fx.glow(x, y - 18, 16, HOT, Math.max(0, 1 - k * 2.5));
  });
}

// ───────────── Pyranda: a red panda lobbing burning chestnuts ─────────────
const NUT = 0x7a3b1c;
const NUT_DARK = 0x3a1a0c;
const NUT_BASE = 0xd9b48a;
const RUST = 0xc4522a;
const TAN = 0xf0c48a;
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
/** A chestnut: glossy brown shell, pale base, pointed tip, glowing seams. */
function chestnut(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  rot: number,
  heat = 1,
) {
  const tipX = x + Math.cos(rot - Math.PI / 2) * r * 1.35,
    tipY = y + Math.sin(rot - Math.PI / 2) * r * 1.35;
  fx.glow(x, y, r * 3, 0xff8a3d, 0.45 * heat);
  fx.solid.fillStyle(NUT_DARK, 0.9).fillCircle(x, y, r * 1.12);
  fx.solid
    .fillStyle(NUT_DARK, 0.9)
    .fillTriangle(
      x + Math.cos(rot) * r * 0.7,
      y + Math.sin(rot) * r * 0.7,
      x - Math.cos(rot) * r * 0.7,
      y - Math.sin(rot) * r * 0.7,
      tipX,
      tipY,
    );
  fx.solid.fillStyle(NUT, 1).fillCircle(x, y, r);
  fx.solid
    .fillStyle(NUT, 1)
    .fillTriangle(
      x + Math.cos(rot) * r * 0.55,
      y + Math.sin(rot) * r * 0.55,
      x - Math.cos(rot) * r * 0.55,
      y - Math.sin(rot) * r * 0.55,
      tipX,
      tipY,
    );
  // The pale base of the nut, opposite the tip.
  const bx = x - Math.cos(rot - Math.PI / 2) * r * 0.55,
    by = y - Math.sin(rot - Math.PI / 2) * r * 0.55;
  fx.solid.fillStyle(NUT_BASE, 0.95).fillCircle(bx, by, r * 0.5);
  fx.solid
    .fillStyle(0xffffff, 0.55)
    .fillCircle(x - r * 0.35, y - r * 0.35, r * 0.25);
  // Cracks glowing with the fire inside.
  fx.g
    .lineStyle(Math.max(1, r * 0.18), GOLD, 0.9 * heat)
    .lineBetween(
      x + Math.cos(rot + 0.6) * r * 0.1,
      y + Math.sin(rot + 0.6) * r * 0.1,
      x + Math.cos(rot + 1.1) * r * 0.75,
      y + Math.sin(rot + 1.1) * r * 0.75,
    );
}

// ───────────── Ember Lob ─────────────
function emberLob(g: G, pr: Projectile, now: number) {
  const fx = fxFor(g.scene),
    a = pr.ability,
    r = a.radius,
    c = pr.color,
    left = Number.isFinite(pr.remaining) ? pr.remaining : a.range,
    f = Math.max(0, Math.min(1, 1 - left / Math.max(1, a.range))),
    hover = 12 + Math.sin(f * Math.PI) * 18,
    x = pr.x,
    y = pr.y - hover,
    dir = Math.atan2(pr.vy, pr.vx),
    flick = 1 + Math.sin(now / 35 + pr.id) * 0.12;
  // Shadow on the floor marks where it really is.
  fx.solid
    .fillStyle(0x000000, 0.22)
    .fillEllipse(pr.x, pr.y + 4, r * 1.8, r * 0.7);
  fx.glow(pr.x, pr.y + 4, r * 2.2, c, 0.3, true);
  // A flame tail streaming back along the flight.
  for (let i = 3; i >= 0; i--) {
    const t = i / 3,
      px = x - Math.cos(dir) * r * 1.4 * t,
      py = y - Math.sin(dir) * r * 1.4 * t - t * 3;
    fx.soft(px, py, r * (1.6 - t * 0.7) * flick, c, 0.75 - t * 0.35);
  }
  fx.glow(x, y, r * 3, c, 0.5);
  fx.solid.fillStyle(CRUST, 0.9).fillCircle(x, y, r * 0.78);
  fx.g.fillStyle(GOLD, 0.95).fillCircle(x, y, r * 0.6);
  fx.g.fillStyle(HOT, 1).fillCircle(x - r * 0.1, y - r * 0.1, r * 0.32);
  fx.trail(`el${pr.id}`, 0.035, () => {
    fx.burst({
      x: pr.x,
      y: pr.y,
      z: hover,
      count: 1,
      kind: "flame",
      color: c,
      angle: dir + Math.PI,
      spread: 0.4,
      speed: [20, 60],
      up: [10, 40],
      life: [0.2, 0.35],
      size: [4, 7],
      drag: 2,
    });
    if (Math.random() < 0.5) embers(fx, pr.x, pr.y, 1, c, 30);
  });
}
function emberLobImpact(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    r = a.radius;
  fx.burst({
    x,
    y,
    z: 8,
    count: 8,
    kind: "flame",
    color,
    speed: [40, 120],
    up: [30, 120],
    life: [0.2, 0.4],
    size: [5, 8],
    drag: 3,
  });
  embers(fx, x, y, 6, color, 80);
  smoke(fx, x, y, 2, [6, 10]);
  fx.decal({ kind: "scorch", x, y, r: r * 1.4, color, life: 2.5 });
  shot(fx.reduced ? 140 : 280, (k) => {
    fx.glow(x, y - 10, r * 3.5 * (1 - k * 0.4), color, 0.75 * (1 - k));
    fx.glow(x, y - 10, r * 1.2, HOT, Math.max(0, 1 - k * 2.5));
    fx.shockwave(x, y, r * 2.4 * ease(k), k, GOLD, 4);
  });
}

// ───────────── Lobs: a chestnut flicked up out of the tail ─────────────
function chestnutLob(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    storm = a.id === "chestnut-storm",
    coals = a.id === "hot-coals",
    n = storm ? 5 : 1,
    tx = x - Math.cos(angle) * 18,
    ty = y - 22;
  fx.burst({
    x: tx,
    y,
    z: 22,
    count: storm ? 18 : 7,
    kind: "flame",
    color,
    angle: -Math.PI / 2,
    spread: 0.6,
    speed: [20, 80],
    up: [80, 200],
    life: [0.2, 0.4],
    size: [5, 9],
    drag: 3,
  });
  smoke(fx, tx, y, storm ? 4 : 1);
  if (coals) {
    fx.burst({
      x: tx,
      y,
      z: 20,
      count: 8,
      kind: "debris",
      color: [CRUST, 0x6b3220],
      angle,
      spread: 0.5,
      speed: [160, 300],
      up: [180, 320],
      life: [0.5, 0.8],
      size: [2, 4],
      grav: 1100,
      bounce: 0.2,
    });
    return;
  }
  if (storm) fx.shake(120, 0.003);
  shot(fx.reduced ? 160 : 380, (k) => {
    fx.glow(tx, ty, (storm ? 50 : 30) * (1 - k * 0.5), color, 0.8 * (1 - k));
    for (let i = 0; i < n; i++) {
      const off = (i - (n - 1) / 2) * 0.35,
        h = ease(k) * 260,
        px = tx + Math.cos(angle + off) * k * 70,
        py = ty - h + Math.sin(angle + off) * k * 30;
      if (k < 0.9) chestnut(fx, px, py, 8, k * 12 + i, 1 - k * 0.5);
    }
  });
}

/** The landing: shell shards, a ring of fire out to the real radius. */
function chestnutBurst(
  scene: Phaser.Scene,
  x: number,
  y: number,
  r: number,
  color: number,
  power: number,
) {
  const fx = fxFor(scene);
  fx.burst({
    x,
    y,
    z: 8,
    count: Math.round(20 * power),
    kind: "flame",
    color,
    speed: [r * 0.8, r * 2.6],
    up: [40, 200],
    life: [0.25, 0.5],
    size: [7, 13],
    drag: 4,
  });
  fx.burst({
    x,
    y,
    z: 12,
    count: Math.round(8 * power),
    kind: "debris",
    color: [NUT, NUT_DARK, NUT_BASE],
    speed: [100, 260],
    up: [180, 400],
    life: [0.7, 1.1],
    size: [2.5, 5],
    grav: 1100,
    bounce: 0.3,
  });
  embers(fx, x, y, Math.round(10 * power), color, 110);
  smoke(fx, x, y, Math.round(5 * power), [12, 20]);
  fx.decal({ kind: "scorch", x, y, r: r * 0.65, color, life: 4 });
  shotOn(scene)(fx.reduced ? 200 : 480, (k) => {
    fx.glow(x, y - 14, r * 0.7, HOT, 0.7 * Math.max(0, 1 - k / 0.15));
    fx.glow(x, y - 14, r, color, 0.55 * (1 - k));
    fx.glow(x, y, r * 1.2, color, 0.45 * (1 - k), true);
    fx.shockwave(x, y, r * ease(Math.min(1, k * 2)), k, GOLD, 10);
  });
}

/** Where a lobbed chestnut is coming down: the real area and a growing shadow. */
function landingMark(
  fx: Fx,
  x: number,
  y: number,
  r: number,
  color: number,
  k: number,
  now: number,
) {
  fx.floorSolid
    .fillStyle(color, 0.08 + k * 0.14)
    .fillEllipse(x, y, r * 2, r * 2 * SQ);
  fx.floor.lineStyle(2.5, color, 0.75).strokeEllipse(x, y, r * 2, r * 2 * SQ);
  fx.floor
    .lineStyle(3, GOLD, 0.45 + k * 0.5)
    .strokeEllipse(x, y, r * 2 * (1 - k * 0.85), r * 2 * SQ * (1 - k * 0.85));
  for (let i = 0; i < 4; i++) {
    const a = (i * TAU) / 4 + now / 1400;
    fx.floor
      .lineStyle(2, GOLD, 0.7)
      .lineBetween(
        x + Math.cos(a) * r * 0.82,
        y + Math.sin(a) * r * 0.82 * SQ,
        x + Math.cos(a) * r * 1.02,
        y + Math.sin(a) * r * 1.02 * SQ,
      );
  }
  fx.glow(x, y, r * (0.4 + k * 0.6), color, 0.2 + k * 0.35, true);
}
/** A chestnut on its way down to (x, y), `k` 0 → 1 until it lands. */
function falling(
  fx: Fx,
  x: number,
  y: number,
  k: number,
  size: number,
  seed: number,
  color: number,
) {
  const h = (1 - k) * (1 - k) * 520 + 14,
    dx = (1 - k) * (40 + hash(seed) * 50),
    px = x + dx,
    py = y - h,
    s = 8 + k * 20;
  fx.solid.fillStyle(0x000000, 0.12 + k * 0.28).fillEllipse(x, y, s, s * 0.4);
  // Fire trailing up behind it.
  for (let i = 1; i <= 3; i++)
    fx.soft(
      px + i * 6,
      py - i * 16,
      size * (1.5 - i * 0.3),
      color,
      0.5 - i * 0.12,
    );
  chestnut(fx, px, py, size, seed + k * 8, 1);
}

// ───────────── Chestnut Mortar: telegraph, then it lands ─────────────
function chestnutMortar(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    c = z.color,
    land = Math.min(0.95, (a.tickDelay ?? 0.45) / Math.max(0.01, a.duration));
  if (progress < land) {
    const k = progress / land;
    landingMark(fx, z.x, z.y, r, c, k, now);
    falling(fx, z.x, z.y, k, 11, z.id, c);
    return;
  }
  fx.trail(`cm${z.id}`, 999, () => {
    chestnutBurst(g.scene, z.x, z.y, r, c, 1);
    fx.shake(140, 0.004);
  });
  const k = (progress - land) / (1 - land);
  fx.glow(z.x, z.y, r, c, 0.4 * (1 - k), true);
}

// ───────────── Hot Coals: a bed of glowing coals on the floor ─────────────
function hotCoals(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    c = z.color,
    x = z.x,
    y = z.y,
    fade = progress > 0.9 ? (1 - progress) / 0.1 : Math.min(1, progress / 0.04),
    t = progress * a.duration,
    every = Math.max(0.1, a.tickInterval ?? 0.5),
    flare = 1 - Math.min(1, (t % every) / (every * 0.5));
  fx.trail(`hc${z.id}`, 999, () =>
    fx.burst({
      x,
      y,
      z: 30,
      count: 14,
      kind: "debris",
      color: [CRUST, 0x6b3220, 0x2b1a14],
      speed: [r * 0.4, r * 1.6],
      up: [120, 260],
      life: [0.4, 0.7],
      size: [2.5, 4.5],
      grav: 1200,
      bounce: 0.2,
    }),
  );
  // Ash bed and heat glow, out to the real radius.
  fx.floorSolid
    .fillStyle(0x2a1610, 0.38 * fade)
    .fillEllipse(x, y, r * 2, r * 2 * SQ);
  fx.glow(x, y, r * 1.05, c, (0.3 + flare * 0.15) * fade, true);
  fx.floor
    .lineStyle(2, c, (0.45 + flare * 0.3) * fade)
    .strokeEllipse(x, y, r * 2, r * 2 * SQ);
  // The coals: crusted lumps whose cores breathe.
  const n = Math.round(14 + r / 6);
  for (let i = 0; i < n; i++) {
    const ang = hash(z.id * 31 + i) * TAU,
      d = Math.sqrt(hash(z.id * 17 + i * 3)) * r * 0.9,
      px = x + Math.cos(ang) * d,
      py = y + Math.sin(ang) * d * SQ,
      s = 4 + hash(i * 7 + z.id) * 5,
      breathe = 0.55 + 0.45 * Math.sin(now / 320 + i * 1.7);
    const pts = Array.from({ length: 5 }, (_, j) => {
      const aa = j * 1.26 + i,
        rr = s * (0.8 + hash(i * 5 + j) * 0.4);
      return { x: px + Math.cos(aa) * rr, y: py + Math.sin(aa) * rr * 0.7 };
    });
    fx.floorSolid.fillStyle(CRUST, 0.95 * fade).fillPoints(pts, true);
    fx.floor
      .fillStyle(i % 3 ? c : GOLD, (0.5 + breathe * 0.4) * fade)
      .fillCircle(px, py, s * 0.55);
    fx.floor.fillStyle(HOT, breathe * 0.7 * fade).fillCircle(px, py, s * 0.25);
  }
  // Low flames lick up on each burn tick (it is a ground effect: they stay low).
  if (flare > 0.1)
    for (let i = 0; i < 6; i++) {
      const ang = hash(Math.floor(t / every) * 13 + i) * TAU,
        d = Math.sqrt(hash(Math.floor(t / every) * 7 + i)) * r * 0.85,
        px = x + Math.cos(ang) * d,
        py = y + Math.sin(ang) * d * SQ,
        h = 14 * flare;
      fx.solid
        .fillStyle(c, 0.8 * flare * fade)
        .fillTriangle(px - 5, py, px + 5, py, px, py - h);
      fx.g
        .fillStyle(GOLD, 0.7 * flare * fade)
        .fillTriangle(px - 2.5, py, px + 2.5, py, px, py - h * 0.6);
    }
  fx.trail(`hce${z.id}`, 0.07, () => {
    const ang = Math.random() * TAU,
      d = Math.sqrt(Math.random()) * r * 0.9;
    embers(fx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * SQ, 1, c, 20);
    if (Math.random() < 0.15)
      smoke(fx, x + Math.cos(ang) * d, y + Math.sin(ang) * d * SQ, 1, [6, 10]);
  });
}

// ───────────── Tail Wrap: curled up in a fluffy ringed tail ─────────────
function tailWrap(
  scene: Phaser.Scene,
  a: Ability,
  x: number,
  y: number,
  angle: number,
  color: number,
  shot: Shot,
) {
  const fx = fxFor(scene),
    cy = y - 20,
    rx = 40,
    ry = 32;
  embers(fx, x, y, 8, color, 50);
  shot(Math.min(1000, a.duration * 1000), (k) => {
    const wrap = ease(Math.min(1, k / 0.3)),
      fade = k > 0.75 ? 1 - (k - 0.75) / 0.25 : 1,
      start = angle + Math.PI * 0.5,
      bands = 16,
      shown = Math.max(1, Math.round(bands * wrap));
    fx.glow(x, cy, 60, color, 0.3 * fade);
    // Fluff: soft puffs along the ring.
    for (let i = 0; i < shown; i++) {
      const a0 = start + (i / bands) * TAU,
        px = x + Math.cos(a0) * rx,
        py = cy + Math.sin(a0) * ry;
      fx.soft(px, py, 16, i % 2 ? TAN : RUST, 0.55 * fade);
    }
    // Rings of the tail: rust and tan bands, thick near the base.
    for (let i = 0; i < shown; i++) {
      const a0 = start + (i / bands) * TAU,
        a1 = start + ((i + 1) / bands) * TAU,
        w = 12 - (i / bands) * 5;
      fx.solid
        .lineStyle(w, Math.floor(i / 2) % 2 ? TAN : RUST, 0.95 * fade)
        .lineBetween(
          x + Math.cos(a0) * rx,
          cy + Math.sin(a0) * ry,
          x + Math.cos(a1) * rx,
          cy + Math.sin(a1) * ry,
        );
    }
    // A warm sheen sliding round: the damage it soaks.
    const sheen = start + ((k * 2) % 1) * TAU;
    fx.glow(
      x + Math.cos(sheen) * rx,
      cy + Math.sin(sheen) * ry,
      20,
      GOLD,
      0.6 * fade,
    );
    fx.g
      .lineStyle(2, GOLD, 0.6 * fade * wrap)
      .strokeEllipse(x, cy, rx * 2 + 16, ry * 2 + 14);
    // The flame at the tail tip.
    const tip = start + (shown / bands) * TAU;
    fx.glow(
      x + Math.cos(tip) * rx,
      cy + Math.sin(tip) * ry - 4,
      16,
      color,
      0.9 * fade,
    );
  });
}

// ───────────── Chestnut Storm (ultimate) ─────────────
function stormTarget(
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
function chestnutStormWindup(
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
    t = stormTarget(a, x, y, angle, aimX, aimY),
    r = a.radius;
  // At the target: the real area, filling as the volley is readied.
  landingMark(fx, t.x, t.y, r, color, k * 0.4, now);
  // At Pyranda: the tail flame flares and the nuts heat up.
  const tx = x - Math.cos(angle) * 18,
    ty = y - 26;
  fx.glow(tx, ty, 26 + k * 40, color, 0.5 + k * 0.4);
  fx.glow(tx, ty, 10 + k * 10, HOT, 0.6 + k * 0.4);
  for (let i = 0; i < 5; i++) {
    const a0 = now / 300 + (i * TAU) / 5;
    chestnut(fx, tx + Math.cos(a0) * 22, ty - 10 + Math.sin(a0) * 8, 5, a0, k);
  }
}
function chestnutStorm(g: G, z: Zone, progress: number, now: number) {
  const fx = fxFor(g.scene),
    a = z.ability,
    r = z.radius,
    c = z.color,
    land = Math.min(0.95, (a.tickDelay ?? 0.9) / Math.max(0.01, a.duration)),
    drops = Array.from({ length: 9 }, (_, i) => {
      const ang = i ? (i * TAU) / 8 + hash(z.id + i) * 0.5 : 0,
        d = i ? r * (0.45 + hash(z.id * 3 + i) * 0.4) : 0;
      return { x: z.x + Math.cos(ang) * d, y: z.y + Math.sin(ang) * d * SQ };
    });
  if (progress < land) {
    const k = progress / land;
    // It glows for almost a second: the whole real area, heating up.
    landingMark(fx, z.x, z.y, r, c, k, now);
    fx.floor
      .lineStyle(6, c, 0.25 + k * 0.3)
      .strokeEllipse(z.x, z.y, r * 2, r * 2 * SQ);
    fx.trail(`csh${z.id}`, 0.05, () => {
      const ang = Math.random() * TAU,
        d = Math.sqrt(Math.random()) * r;
      embers(
        fx,
        z.x + Math.cos(ang) * d,
        z.y + Math.sin(ang) * d * SQ,
        1,
        c,
        20,
      );
    });
    drops.forEach((p, i) => {
      const kk = Math.max(0, Math.min(1, (k - hash(i + 5) * 0.25) / 0.75));
      if (kk > 0) falling(fx, p.x, p.y, kk, i ? 9 : 13, z.id + i * 7, c);
    });
    return;
  }
  // Impact: every chestnut lands at once.
  fx.trail(`cs${z.id}`, 999, () => {
    fx.ultimate(c, 900);
    fx.shake(320, 0.008);
    drops.forEach((p, i) =>
      chestnutBurst(
        g.scene,
        p.x,
        p.y,
        i ? r * 0.38 : r * 0.55,
        c,
        i ? 0.45 : 1,
      ),
    );
    fx.decal({ kind: "molten", x: z.x, y: z.y, r: r * 0.5, color: c, life: 4 });
    shotOn(g.scene)(fx.reduced ? 260 : 820, (k) => {
      fx.glow(z.x, z.y - 30, r * 1.1, HOT, 0.6 * Math.max(0, 1 - k / 0.12));
      fx.glow(z.x, z.y, r * 1.3, c, 0.6 * (1 - k), true);
      fx.shockwave(z.x, z.y, r * ease(Math.min(1, k * 1.6)), k, GOLD, 14);
      if (k > 0.1)
        fx.shockwave(
          z.x,
          z.y,
          r * 1.15 * ease(Math.min(1, (k - 0.1) * 1.4)),
          k,
          c,
          8,
        );
    });
  });
  const k = (progress - land) / (1 - land);
  fx.glow(z.x, z.y, r, c, 0.4 * (1 - k), true);
}

export const fireKit: FxKit = {
  projectile: { "magma-bomb": magmaBomb, "ember-lob": emberLob },
  zone: {
    "heat-cracks": blazeWhirl,
    "sunfire-pillar": sunfirePillar,
    "chestnut-mortar": chestnutMortar,
    "hot-coals": hotCoals,
    "chestnut-storm": chestnutStorm,
  },
  windup: {
    "sunfire-pillar": sunfireWindup,
    "chestnut-storm": chestnutStormWindup,
  },
  channel: { "crest-flare": emberGust },
  cast: {
    "cinder-snap": cinderSnap,
    "magma-bomb": magmaCast,
    "ember-lob": magmaCast,
    "chestnut-mortar": chestnutLob,
    "hot-coals": chestnutLob,
    "chestnut-storm": chestnutLob,
    "tail-wrap": tailWrap,
  },
  impact: { "magma-bomb": magmaImpact, "ember-lob": emberLobImpact },
  hit: { fire: fireHit },
};

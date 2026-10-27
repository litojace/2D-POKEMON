import { paintedEmber } from "./boss-painted-poses";
import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossSurface } from "./boss-materials";
import { bossLife, bossEye } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  EMBERWING as E,
  brazierLifetime,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import { RaidBossMotion, type RaidBossCue } from "./raid-boss-motion";
import type { LayerAt } from "./raid-layers";
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
function flame(g: G, x: number, y: number, size: number, alpha = 1) {
  g.fillStyle(0xff6a3d, alpha)
    .fillTriangle(
      x - size,
      y + size * 0.5,
      x + size,
      y + size * 0.5,
      x + size * 0.25,
      y - size * 1.4,
    )
    .fillEllipse(x, y, size * 1.8, size * 1.5);
  g.fillStyle(0xffdc87, alpha).fillTriangle(
    x - size * 0.5,
    y + size * 0.5,
    x + size * 0.5,
    y + size * 0.5,
    x,
    y - size * 0.7,
  );
}
export function drawSkyTerrace(g: G, state: Snapshot, reduced: boolean, at?: LayerAt) {
  const r = state.raid!,
    t = reduced ? 0 : state.time;
  for (const f of r.emberPatches ?? []) {
    g.fillStyle(0x301e23, 0.65).fillCircle(f.x, f.y, f.radius);
    g.fillStyle(0xff643d, 0.17).fillCircle(f.x, f.y, f.radius);
    g.lineStyle(3, 0xffac6f, 0.8).strokeCircle(f.x, f.y, f.radius);
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      flame(
        g,
        f.x + Math.cos(a) * f.radius * 0.55,
        f.y + Math.sin(a) * f.radius * 0.5,
        9 + Math.sin(t * 2 + i) * 2,
        0.65,
      );
    }
  }
  for (const f of r.emberTrails ?? []) {
    g.lineStyle(f.width * 2, 0xff633d, 0.21).lineBetween(f.x, f.y, f.tx, f.ty);
    g.lineStyle(4, 0xffa76a, 0.8).lineBetween(f.x, f.y, f.tx, f.ty);
    for (let i = 1; i < 5; i++)
      flame(
        g,
        f.x + ((f.tx - f.x) * i) / 5,
        f.y + ((f.ty - f.y) * i) / 5,
        8,
        0.8,
      );
  }
  for (const [bi, b] of (r.braziers ?? []).entries()) {
    const lit = b.litUntil > state.time,
      active =
        r.airborne &&
        (r.trait !== "updraft" || state.time - (r.takeoffAt ?? 0) >= 2),
      ring = lit ? 0xffdc87 : active ? 0x8be7d0 : 0x7f8da4;
    g.fillStyle(0x0a1630, 0.4).fillEllipse(b.x, b.y + 24, 112, 38);
    // Circle matches the actual standing range. The stone bowl is decorative.
    g.fillStyle(ring, lit ? 0.1 : 0.045).fillCircle(b.x, b.y, E.brazierRadius);
    g.lineStyle(2, ring, lit ? 1 : 0.6).strokeCircle(b.x, b.y, E.brazierRadius);
    // The bowl and its flame stand up, so they sort with the raiders.
    const bowl = at ? at(`brazier-${bi}`, b.y + 30) : g;
    bowl.fillStyle(0x354259, 1).fillRoundedRect(b.x - 19, b.y - 5, 38, 35, 5);
    bowl.fillStyle(0x4a5874, 1).fillRoundedRect(b.x - 19, b.y - 5, 12, 35, 4);
    bowl.fillStyle(0x5c5862, 1).fillEllipse(b.x, b.y - 7, 64, groundHeight(64));
    bowl.lineStyle(3, 0xc3a37c, 0.9).strokeEllipse(b.x, b.y - 7, 64, groundHeight(64));
    bowl.fillStyle(0x152239, 1).fillEllipse(b.x, b.y - 10, 50, groundHeight(50));
    if (lit) {
      const k = Math.max(
        0,
        Math.min(
          1,
          (b.litUntil - state.time) /
            brazierLifetime(r.partySize, r.phase, r.peril),
        ),
      );
      g.lineStyle(5, 0xffdb8d, 1)
        .beginPath()
        .arc(
          b.x,
          b.y,
          E.brazierRadius,
          -Math.PI / 2,
          -Math.PI / 2 + k * TAU,
          false,
        )
        .strokePath();
      flame(bowl, b.x, b.y - 25, 21 + (reduced ? 0 : Math.sin(t * 3) * 2));
    } else if (b.progress > 0) {
      g.lineStyle(5, 0x8be7d0, 1)
        .beginPath()
        .arc(
          b.x,
          b.y,
          E.brazierRadius,
          -Math.PI / 2,
          -Math.PI / 2 + b.progress * TAU,
          false,
        )
        .strokePath();
      flame(bowl, b.x, b.y - 17, 8 + b.progress * 8, 0.7);
    }
  }
  for (const ring of r.flameRings ?? []) {
    g.lineStyle(E.ring.width * 2, 0xff7949, 0.2).strokeCircle(
      ring.x,
      ring.y,
      Math.max(1, ring.radius),
    );
    g.lineStyle(4, 0xffce87, 1).strokeCircle(
      ring.x,
      ring.y,
      Math.max(1, ring.radius),
    );
  }
  for (const f of r.emberFeathers ?? []) {
    const y = f.y - 7 + (reduced ? 0 : Math.sin(t * 2) * 4);
    g.fillStyle(0xffd778, 0.15).fillCircle(f.x, y, 23);
    g.fillStyle(0xffbe6c, 1).fillEllipse(f.x, y, 10, 25);
    g.lineStyle(2, 0xfff0bf, 1).lineBetween(f.x - 4, y + 11, f.x + 4, y - 12);
  }
}
export function drawEmberwingWarning(g: G, state: Snapshot, w: RaidWarning) {
  const p = Math.max(
    0,
    Math.min(
      1,
      (state.time - (w.startedAt ?? state.time)) /
        Math.max(0.01, w.at - (w.startedAt ?? state.time)),
    ),
  );
  if (w.kind === "dive-bomb") {
    const dx = w.tx - w.x,
      dy = w.ty - w.y,
      len = Math.hypot(dx, dy) || 1,
      nx = (-dy / len) * w.radius,
      ny = (dx / len) * w.radius;
    g.fillStyle(0xff5d77, 0.15 + p * 0.2).fillPoints(
      [
        { x: w.x + nx, y: w.y + ny },
        { x: w.tx + nx, y: w.ty + ny },
        { x: w.tx - nx, y: w.ty - ny },
        { x: w.x - nx, y: w.y - ny },
      ],
      true,
    );
    g.lineStyle(3, 0xffa0ad, 1)
      .lineBetween(w.x + nx, w.y + ny, w.tx + nx, w.ty + ny)
      .lineBetween(w.x - nx, w.y - ny, w.tx - nx, w.ty - ny);
    for (let i = 1; i < 5; i++) {
      const x = w.x + (dx * i) / 5,
        y = w.y + (dy * i) / 5;
      g.lineStyle(3, 0xffd78d, 1)
        .lineBetween(
          x - (dx / len) * 10 + nx * 0.25,
          y - (dy / len) * 10 + ny * 0.25,
          x,
          y,
        )
        .lineBetween(
          x - (dx / len) * 10 - nx * 0.25,
          y - (dy / len) * 10 - ny * 0.25,
          x,
          y,
        );
    }
    return true;
  }
  if (w.kind === "wing-gust") {
    const angle = Math.atan2(w.ty - w.y, w.tx - w.x),
      spread = w.spread ?? E.gust.spread,
      pts = [
        { x: w.x, y: w.y },
        ...Array.from({ length: 20 }, (_, i) => ({
          x: w.x + Math.cos(angle - spread + (i * spread * 2) / 19) * w.radius,
          y: w.y + Math.sin(angle - spread + (i * spread * 2) / 19) * w.radius,
        })),
      ];
    g.fillStyle(0x8eddf0, 0.1 + p * 0.1).fillPoints(pts, true);
    g.lineStyle(3, 0x8eddf0, 0.85).strokePoints(pts, true);
    for (let i = 1; i < 4; i++) {
      const x = w.x + Math.cos(angle) * i * 100,
        y = w.y + Math.sin(angle) * i * 100;
      g.lineStyle(3, 0xd3f5ff, 0.8)
        .lineBetween(
          x - Math.sin(angle) * 18 - Math.cos(angle) * 18,
          y + Math.cos(angle) * 18 - Math.sin(angle) * 18,
          x,
          y,
        )
        .lineBetween(
          x + Math.sin(angle) * 18 - Math.cos(angle) * 18,
          y - Math.cos(angle) * 18 - Math.sin(angle) * 18,
          x,
          y,
        );
    }
    return true;
  }
  if (w.kind === "flame-ring") {
    g.lineStyle(4, 0xffca89, 0.9).strokeCircle(w.x, w.y, 60 + p * 25);
    flame(g, w.x, w.y - 120, 15);
    return true;
  }
  if (
    w.kind === "ember-rain" ||
    w.kind === "scorched-earth" ||
    w.kind === "heat-mark"
  ) {
    const heat = w.kind === "heat-mark",
      color = heat ? 0xff688c : 0xffa56c;
    g.fillStyle(color, 0.08 + p * 0.13).fillCircle(w.x, w.y, w.radius);
    g.lineStyle(3, color, 1).strokeCircle(w.x, w.y, w.radius);
    g.lineStyle(5, 0xffdfac, 1)
      .beginPath()
      .arc(w.x, w.y, w.radius, -Math.PI / 2, -Math.PI / 2 + TAU * p, false)
      .strokePath();
    if (heat) flame(g, w.x, w.y - 105, 15);
    else if (w.kind === "ember-rain") flame(g, w.x, w.y - (1 - p) * 100, 9);
    return true;
  }
  return w.kind === "brazier-lighting";
}
const controllers = new WeakMap<
  G,
  { motion: RaidBossMotion; flight: number; clock: number }
>();
export function drawEmberwing(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
): RaidBossCue[] {
  const r = state.raid!,
    boss = state.players.find((p) => p.raidBoss);
  if (!boss) return [];
  let c = controllers.get(g);
  if (!c) {
    c = { motion: new RaidBossMotion(), flight: r.airborne ? 1 : 0, clock };
    controllers.set(g, c);
  }
  const pose = c.motion.sample(state, clock, reduced)!;
  const life = bossLife(g, state, boss, clock, reduced);
  const dt =
    state.phase === "paused" ? 0 : Math.max(0, Math.min(0.05, clock - c.clock));
  c.clock = clock;
  const target = r.airborne ? 1 : 0;
  c.flight = reduced
    ? target
    : c.flight + Math.max(-dt * 3, Math.min(dt * 3, target - c.flight));
  const t = life.time,
    x = boss.x,
    flight = c.flight;
  const y =
    boss.y -
    64 -
    flight * 65 +
    life.breath * 4 +
    pose.collapse * 35 +
    life.windup * 5;
  const alpha = pose.dead
    ? reduced
      ? 0.2
      : Math.max(0.2, 1 - pose.deathAge * 0.3)
    : 1;
  const exposed = r.permanentGround || r.exposedUntil > state.time;
  g.fillStyle(0x10192a, 0.3).fillEllipse(
    x,
    boss.y + 12,
    170 - flight * 35,
    45 - flight * 10,
  );
  if (
    paintedEmber(g, {
      x,
      y,
      life,
      alpha,
      exposed,
      dead: pose.dead,
      flight,
      gilded: !!r.gilded,
      hurt: pose.hurt > 0.2,
    })
  )
    return pose.cues;
  // Tail plumes overlap and lag behind the chest, with warm shafts and ember tips.
  for (let i = 0; i < 7; i++) {
    const a = -0.82 + i * 0.25 + Math.sin(t * 1.7 + i * 0.4) * 0.04 * life.move;
    g.save()
      .translateCanvas(x + 28, y + 35)
      .rotateCanvas(a);
    g.fillStyle(i % 2 ? 0xc65a50 : 0xa94048, alpha).fillEllipse(54, 0, 100, 29);
    g.fillStyle(0xffb76b, alpha).fillEllipse(88, 0, 34, 21);
    g.lineStyle(2, 0xffd498, alpha * 0.5).lineBetween(30, 0, 91, 0);
    g.restore();
  }
  const flap =
    Math.sin(t * (r.airborne ? 5.8 : 1.7)) *
    (r.airborne ? 0.5 : 0.055) *
    life.move;
  // Shoulder hinge, layered flight feathers and a delayed wrist make a real wing beat.
  for (const side of [-1, 1]) {
    const angle =
      side * (-0.25 + flap - life.windup * 0.26 + (1 - flight) * 0.95);
    g.save()
      .translateCanvas(x + side * 48, y - 4)
      .rotateCanvas(angle)
      .scaleCanvas(side, 1);
    g.fillStyle(0x743942, alpha).fillEllipse(46, 6, 108, 53);
    g.fillStyle(0xd66d51, alpha).fillEllipse(42, 0, 99, 43);
    for (let j = 5; j >= 0; j--) {
      const fx = 24 + j * 15,
        fy =
          18 +
          j * 4 +
          Math.sin(t * 5.8 - 0.5 + j * 0.2) * flight * 5 * life.move;
      g.save()
        .translateCanvas(fx, fy)
        .rotateCanvas(-0.22 + j * 0.075);
      g.fillStyle(j % 2 ? 0xe98d56 : 0xc8654f, alpha).fillEllipse(
        0,
        19,
        24,
        62 - j * 3,
      );
      g.fillStyle(0xffcf84, alpha).fillEllipse(0, 36 - j, 17, 22);
      g.lineStyle(1.5, 0xffedbd, alpha * 0.5).lineBetween(0, 6, 0, 39 - j);
      g.restore();
    }
    g.fillStyle(0xf7b66e, alpha).fillEllipse(30, -9, 60, 18);
    g.restore();
  }
  g.fillStyle(0x713949, alpha).fillEllipse(x, y + 3, 145, 137);
  bossSurface(g, x, y, 138, 132 + life.breath * 2,
    pose.hurt > 0.2 ? 0xffe0b1 : r.gilded ? 0xe2ab65 : 0xe98b58, "feathers", alpha);
  g.fillStyle(0xffd49c, alpha).fillEllipse(x - 6, y + 24, 98, 79);
  for (let i = 0; i < 3; i++)
    g.lineStyle(2, 0xe9a56e, alpha * 0.6)
      .beginPath()
      .arc(x - 5, y + 15 + i * 14, 23, 0.25, Math.PI - 0.25, false)
      .strokePath();
  const hx = x + life.lookX * 5,
    hy = y - 45 - life.windup * 8 + life.breath * 2;
  bossSurface(g, hx, hy, 104, 84, 0xf4b078, "feathers", alpha);
  // Three individually licking crest flames; no rapid glow flicker.
  for (const [dx, size, phase] of [
    [5, 29, 0],
    [-23, 17, 1],
    [29, 16, 2],
  ]) {
    g.save()
      .translateCanvas(hx + dx, hy - 46)
      .rotateCanvas(Math.sin(t * 2.4 + phase) * 0.07 * life.move);
    flame(g, 0, -7, size + Math.sin(t * 3 + phase) * 2 * life.move, alpha);
    g.restore();
  }
  for (const side of [-1, 1]) {
    if (pose.dead)
      g.lineStyle(3, 0x4b3042, alpha).lineBetween(
        hx + side * 22 - 6,
        hy,
        hx + side * 22 + 6,
        hy,
      );
    else bossEye(g, hx + side * 22, hy - 1, 14, 19, life, 0x6a3341, alpha);
    g.lineStyle(3.5, 0x773d43, alpha).lineBetween(
      hx + side * 13,
      hy - 13 - life.windup * 3,
      hx + side * 32,
      hy - 9,
    );
  }
  g.fillStyle(0x944844, alpha).fillTriangle(
    hx - 11,
    hy + 15,
    hx + 12,
    hy + 15,
    hx + 2,
    hy + 32 + life.windup * 7,
  );
  g.fillStyle(0xffd47c, alpha).fillTriangle(
    hx - 13,
    hy + 12,
    hx + 12,
    hy + 12,
    hx + 1,
    hy + 26,
  );
  for (const side of [-1, 1]) {
    const footY = y + 65 - flight * 8;
    g.fillStyle(0xa65e4b, alpha).fillEllipse(x + side * 29, footY, 37, 14);
    for (let j = 0; j < 3; j++)
      g.fillStyle(0xffdc99, alpha).fillEllipse(
        x + side * 29 - 10 + j * 9,
        footY + 3,
        6,
        8,
      );
  }
  if (exposed && !pose.dead) {
    g.fillStyle(0xffe6ad, 0.2).fillCircle(x, y + 22, 30);
    flame(g, x, y + 16, 19 + life.breath, alpha);
    g.lineStyle(2, 0xffe6ad, 0.65).strokeCircle(x, y + 22, 34);
  }
  if (!reduced && !pose.dead)
    for (let i = 0; i < 4; i++) {
      const k = (t * 0.35 + i * 0.25) % 1;
      g.fillStyle(i % 2 ? 0xffce87 : 0xff8b65, (1 - k) * 0.5).fillCircle(
        x + 50 + i * 14,
        y + 25 + k * 65,
        2.5,
      );
    }
  return pose.cues;
}

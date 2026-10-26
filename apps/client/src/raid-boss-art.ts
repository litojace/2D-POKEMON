import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossLife } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";

import { RaidBossMotion } from "./raid-boss-motion";
const motions = new WeakMap<Phaser.GameObjects.Graphics, RaidBossMotion>();

export function drawRaidBoss(
  g: Phaser.GameObjects.Graphics,
  state: Snapshot,
  reduced: boolean,
  clock = performance.now() / 1000,
) {
  const r = state.raid;
  const boss = state.players.find((p) => p.raidBoss);
  if (!r || !boss) return;
  let controller = motions.get(g);
  if (!controller) {
    controller = new RaidBossMotion();
    motions.set(g, controller);
  }
  const pose = controller.sample(state, clock, reduced)!;
  const life = bossLife(g, state, boss, clock, reduced);
  const t = pose.time;
  const stagger = r.staggerUntil > state.time && !pose.dead;
  const exposed =
    (r.phase === 3 || r.exposedUntil > state.time || stagger) && !pose.dead;
  const windup = pose.charge > 0 && !pose.dead;
  const lift = pose.slam > 0 ? Math.min(1, pose.slam * 1.7) : 0;
  const impact = pose.impact;
  const charging = pose.charging;
  const motion = reduced ? 0 : 1;
  const breath =
    Math.sin(t * (r.phase === 3 ? 3.2 : 1.7)) *
    (r.phase === 3 ? 3.5 : 2.5) *
    life.move;
  const stride = charging ? Math.sin(t * 23) * 5 * motion : 0;
  const crouch = stagger
    ? 20
    : pose.dead
      ? Math.sin(Math.min(pose.deathAge, 1) * Math.PI) * 14
      : windup
        ? 5 + pose.charge * 11
        : impact * 17 - lift * 10;
  const lean = stagger
    ? Math.sin(t * 3) * 3 * motion
    : charging
      ? Math.cos(boss.angle) * 9
      : Math.cos(boss.angle) * 3;
  const recoil = Math.sin(pose.hurt * Math.PI * 3) * pose.hurt * 6 * motion;
  const x = boss.x + lean + recoil + Math.sin(t * 17) * pose.crash * 5 * motion,
    y = boss.y + breath + crouch;
  const pulse = reduced ? 0.8 : 0.75 + Math.sin(t * (exposed ? 9 : 3)) * 0.2;
  const hot = pose.dead
    ? 0x655a4b
    : exposed
      ? 0x82ffe7
      : r.phase === 3
        ? 0xff7751
        : 0xffce75;
  const dark = r.gilded ? 0x55402e : 0x202e43;
  const rock =
    pose.hurt > 0.65 && exposed ? 0xb7e4dd : r.gilded ? 0xa78248 : 0x52657b;
  const face = r.gilded ? 0xe4c47c : 0x8a9eb1;
  const rim = r.gilded ? 0xffe9a2 : 0xb6c6d1;
  const poly = (
    cx: number,
    cy: number,
    points: number[],
    color: number,
    alpha = 1,
  ) => {
    g.fillStyle(color, alpha)
      .beginPath()
      .moveTo(cx + points[0], cy + points[1]);
    for (let i = 2; i < points.length; i += 2)
      g.lineTo(cx + points[i], cy + points[i + 1]);
    g.closePath().fillPath();
  };
  const crystal = (cx: number, cy: number, size: number) => {
    poly(
      cx,
      cy,
      [
        0,
        -size,
        size * 0.44,
        -size * 0.2,
        size * 0.3,
        size * 0.5,
        -size * 0.35,
        size * 0.5,
        -size * 0.5,
        -size * 0.15,
      ],
      dark,
    );
    poly(
      cx,
      cy,
      [
        0,
        -size,
        size * 0.35,
        -size * 0.18,
        0,
        size * 0.37,
        -size * 0.36,
        -size * 0.12,
      ],
      hot,
    );
    poly(
      cx,
      cy,
      [0, -size, 0, size * 0.37, -size * 0.36, -size * 0.12],
      rim,
      0.75,
    );
    g.lineStyle(1, rim, 0.8).lineBetween(cx, cy - size, cx, cy + size * 0.3);
  };

  // Shadow and dust stay on the floor as the torso and fists rise.
  g.fillStyle(0x030a18, 0.35).fillEllipse(boss.x, boss.y + 51, 202, 61);
  g.fillStyle(0x030a18, 0.25).fillEllipse(boss.x, boss.y + 51, 146, 39);
  // Low-opacity floor effects never obscure the red damage boundary.
  if ((impact > 0 || pose.crash > 0) && !reduced) {
    const strength = Math.max(impact, pose.crash),
      spread = (1 - strength) * 150;
    g.lineStyle(4, face, strength * 0.45).strokeEllipse(
      boss.x,
      boss.y + 48,
      100 + spread * 2,
      groundHeight(100 + spread * 2),
    );
    for (let i = 0; i < 5; i++)
      g.fillStyle(face, strength * 0.16).fillEllipse(
        boss.x + (i - 2) * 36,
        boss.y + 44,
        30 + spread * 0.3,
        14 + spread * 0.12,
      );
  }
  const paintFragments = () => {
    for (const f of pose.fragments) {
      const fx = f.x + f.vx * f.age,
        fy = f.y + f.vy * f.age + 160 * f.age * f.age;
      poly(
        fx,
        fy,
        [-f.size, -f.size * 0.4, 0, -f.size, f.size, 0, f.size * 0.5, f.size],
        f.glow ? hot : face,
        (1 - f.age / f.life) * 0.9,
      );
    }
  };
  const rubble = () => {
    for (let i = 0; i < 13; i++) {
      const a = i * 2.4,
        radius = 20 + (i % 4) * 23;
      poly(
        boss.x + Math.cos(a) * radius,
        boss.y + 39 + Math.sin(a) * radius * 0.32,
        [-16, -6, -8, -18, 12, -12, 20, 4, 4, 12, -12, 8],
        i % 2 ? rock : dark,
      );
    }
    const fade = reduced ? 0 : Math.max(0, 1 - (pose.deathAge - 1) / 2);
    g.fillStyle(0xffc576, fade * 0.65).fillCircle(boss.x, boss.y + 38, 12);
  };
  if (pose.collapse >= 1) {
    rubble();
    paintFragments();
    return pose.cues;
  }
  g.save();
  if (pose.dead)
    g.translateCanvas(boss.x, boss.y + 54)
      .scaleCanvas(1 + pose.collapse * 0.35, 1 - pose.collapse * 0.85)
      .translateCanvas(-boss.x, -boss.y - 54);
  if (charging && !reduced)
    for (let i = 0; i < 7; i++) {
      const age = (t * 3 + i / 7) % 1,
        distance = 35 + age * 140;
      g.fillStyle(face, (1 - age) * 0.23).fillCircle(
        boss.x - Math.cos(boss.angle) * distance + Math.sin(i * 7) * 22,
        boss.y - Math.sin(boss.angle) * distance + 40,
        5 + age * 13,
      );
    }
  for (const side of [-1, 1]) {
    const footY = y + 47 + side * stride;
    poly(
      x + side * 42,
      footY,
      [-32, -16, -20, -28, 20, -26, 34, -8, 28, 13, -25, 16],
      dark,
    );
    poly(
      x + side * 42,
      footY,
      [-29, -16, -18, -26, 18, -24, 28, -8, 18, 2, -23, 3],
      rock,
    );
    g.lineStyle(2, face, 0.55).lineBetween(
      x + side * 42 - 12,
      footY + 2,
      x + side * 42 - 10,
      footY + 12,
    );
  }

  // Shed armor becomes orbiting fragments around the fully exposed final core.
  if (r.phase === 3 && !pose.dead) {
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2 + (reduced ? 0 : t * 0.45);
      const fx = x + Math.cos(a) * 118,
        fy = y - 36 + Math.sin(a) * 58;
      poly(fx, fy, [-12, -8, 2, -16, 16, -2, 8, 12, -9, 10], rock);
      g.lineStyle(2, hot, 0.8).lineBetween(fx - 6, fy - 7, fx + 5, fy + 6);
    }
  }
  // Broad layered torso, asymmetrical shoulder formations and recessed chest.
  poly(
    x,
    y,
    [
      -71, -44, -49, -75, 21, -79, 66, -57, 77, -3, 60, 49, 23, 63, -40, 56,
      -74, 20,
    ],
    dark,
  );
  poly(
    x,
    y,
    [-66, -45, -46, -69, 22, -72, 62, -51, 64, -1, 43, 38, -36, 41, -62, 16],
    rock,
  );
  poly(x, y, [-46, -69, 22, -72, 62, -51, 20, -37, -43, -39, -66, -45], face);
  poly(
    x,
    y,
    [-54, -27, -29, -39, 33, -37, 55, -18, 43, 37, 0, 53, -40, 35],
    dark,
  );
  for (const side of [-1, 1]) {
    const sx = x + side * 66,
      sy = y - 44 - life.breath * 1.5;
    // The left shoulder breaks in chapter two; both shoulders open in chapter three.
    if (r.phase === 1 || (r.phase === 2 && side === 1)) {
      poly(
        sx,
        sy,
        [-34, -19, -14, -39, 23, -33, 40, -8, 23, 20, -24, 19],
        rock,
      );
      poly(sx, sy, [-34, -19, -14, -39, 23, -33, 8, -12], face);
      crystal(sx + side * 9, sy - 33, side === 1 ? 38 : 27);
      crystal(sx - side * 14, sy - 23, 20);
    } else {
      poly(sx, sy + 10, [-24, -8, -7, -19, 21, -9, 19, 17, -17, 16], dark);
      crystal(sx, sy, 24);
    }
  }
  // Independently articulated forearms. Both rise before the authoritative slam.
  for (const side of [-1, 1]) {
    const beating =
      pose.debris > 0
        ? Math.sin(pose.debris * Math.PI * 5 + side) * 12 * motion
        : 0;
    const grind =
      !lift && !windup && !charging && !stagger && !pose.debris
        ? Math.sin(t * 1.4 + side * 0.7) * 4 * motion
        : 0;
    const armLift =
      lift * 98 + (stagger ? -12 : 0) + (pose.debris > 0 ? 26 : 0);
    const reach = stagger
      ? 56
      : pose.debris > 0
        ? 59
        : windup
          ? 105 + pose.charge * 9
          : 96 + lift * 12;
    const ax = x + side * reach + grind,
      ay =
        y +
        9 -
        armLift +
        side * stride +
        beating +
        (windup ? 18 : 0) +
        (pose.dead ? pose.collapse * 15 : 0);
    g.lineStyle(22, dark, 1).lineBetween(x + side * 68, y - 23, ax, ay);
    poly(
      ax,
      ay,
      [-27, -25, -7, -36, 24, -25, 32, 10, 17, 39, -20, 35, -33, 10],
      dark,
    );
    poly(ax, ay, [-25, -24, -7, -33, 23, -23, 26, 10, 12, 25, -21, 22], rock);
    poly(ax, ay, [-25, -24, -7, -33, 23, -23, 8, -9, -20, -7], face);
    g.lineStyle(3, rim, 0.38).lineBetween(ax - 19, ay - 5, ax + 15, ay - 8);
    for (let i = 0; i < 3; i++)
      g.lineStyle(2, dark, 0.9).lineBetween(
        ax - 15 + i * 12,
        ay + 14,
        ax - 13 + i * 12,
        ay + 27,
      );
    if (r.phase > 1)
      g.lineStyle(2, hot, 0.8)
        .lineBetween(ax + 7, ay - 19, ax - 3, ay + 2)
        .lineBetween(ax - 3, ay + 2, ax + 5, ay + 15);
  }

  if (pose.transform > 0 && !reduced) {
    g.lineStyle(3, hot, pose.transform * 0.5).strokeEllipse(
      x,
      y,
      90 + (1 - pose.transform) * 150,
      130 + (1 - pose.transform) * 100,
    );
  }
  const coreY = y + 16;
  g.fillStyle(hot, 0.06 * pulse).fillCircle(x, coreY, exposed ? 61 : 42);
  poly(x, coreY, [0, -31, 29, -12, 25, 21, 0, 36, -26, 19, -29, -13], face);
  poly(x, coreY, [0, -25, 23, -9, 19, 16, 0, 29, -20, 15, -23, -10], 0x111d2e);
  crystal(x, coreY, r.phase === 3 ? 33 : exposed ? 27 : 18);
  if (exposed || r.phase === 3) {
    g.lineStyle(2, hot, 0.55 * pulse).strokeCircle(x, coreY, 36);
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + (reduced ? 0 : t * 0.7);
      g.fillStyle(hot, 0.8).fillCircle(
        x + Math.cos(a) * 42,
        coreY + Math.sin(a) * 32,
        2,
      );
    }
  } else {
    poly(x - 24, coreY, [-9, -19, 9, -25, 15, 4, 6, 24, -12, 13], rock);
    poly(x + 24, coreY, [9, -19, -9, -25, -15, 4, -6, 24, 12, 13], rock);
  }
  for (let i = 0; i < r.phase; i++) {
    const side = i % 2 ? -1 : 1,
      cy = y - 30 + i * 19;
    g.lineStyle(exposed ? 3 : 2, hot, exposed ? 0.9 : 0.5)
      .lineBetween(x + side * 34, cy, x + side * 46, cy + 12)
      .lineBetween(x + side * 46, cy + 12, x + side * 39, cy + 25);
  }
  // Face moves as one unit; directional offset includes eyes, brow and jaw.
  const hx = x + life.lookX * 5,
    hy = y - 49 + (stagger ? 12 : 0) - lift * 6 + life.breath;
  poly(
    hx,
    hy,
    [-39, -14, -18, -27, 27, -24, 43, -6, 32, 20, 0, 27, -34, 17],
    dark,
  );
  poly(hx, hy, [-38, -14, -18, -27, 27, -24, 40, -7, 8, -11, -3, -2], face);
  poly(hx, hy, [-30, 1, -10, 6, -11, 12, -29, 9], hot);
  poly(hx, hy, [10, 6, 30, 0, 29, 9, 11, 12], hot);
  // Heavy stone lids briefly cover the glowing eyes; the brows remain readable.
  if (life.blink > 0.05 && !pose.dead && !stagger)
    for (const side of [-1, 1]) {
      g.fillStyle(rock, 1).fillRoundedRect(
        hx + side * 20 - 13,
        hy - 1,
        26,
        life.blink * 12,
        2,
      );
      g.lineStyle(2, dark, 0.7).lineBetween(
        hx + side * 20 - 10,
        hy + life.blink * 10,
        hx + side * 20 + 9,
        hy + life.blink * 10 - side * 2,
      );
    }
  const roar =
    (pose.debris > 0 || pose.charge > 0.15 || pose.transform > 0.1) &&
    !pose.dead;
  if (roar) poly(hx, hy, [-20, 18, 20, 17, 16, 34, -12, 36], 0x101a29);
  poly(
    hx,
    hy + (roar ? 8 : 0),
    [-23, 20, 0, 24, 24, 18, 14, 32, -12, 34],
    rock,
  );
  if (roar) {
    for (const side of [-1, 1])
      poly(hx + side * 12, hy + 20, [-3, 0, 3, 0, 0, 5], rim);
  }
  // Eyes follow the same target direction as the entire face.
  if (!pose.dead && life.blink < 0.6)
    for (const side of [-1, 1])
      g.fillStyle(0xfff2d3, 0.7).fillCircle(
        hx + side * 20 + Math.cos(boss.angle) * 3,
        hy + 7 + Math.sin(boss.angle) * 1.5,
        2,
      );
  if (pose.debris > 0 && !reduced)
    for (let i = 0; i < 6; i++) {
      const a = i * 2.4 + t * 0.5,
        radius = 90 + (i % 2) * 18;
      const ry = Math.sin(a) * radius * 0.35;
      g.fillStyle(0x040c19, 0.2).fillEllipse(
        boss.x + Math.cos(a) * radius,
        boss.y + 49 + ry,
        14,
        5,
      );
      poly(
        boss.x + Math.cos(a) * radius,
        boss.y + ry - pose.debris * 95,
        [-7, -4, 0, -10, 9, -2, 5, 7, -5, 6],
        face,
      );
    }
  if (!reduced && !pose.dead && !charging)
    for (let i = 0; i < 3; i++) {
      const age = (t * 0.5 + i / 3) % 1;
      poly(
        x + (i - 1) * 56,
        y - 40 + age * 92,
        [-2, -3, 3, -2, 2, 3, -3, 2],
        face,
        (1 - age) * 0.4,
      );
    }
  if (stagger && !reduced)
    for (let i = 0; i < 3; i++) {
      const a = t * 2 + (i * Math.PI * 2) / 3;
      g.fillStyle(hot, 0.8).fillCircle(
        x + Math.cos(a) * 43,
        y - 94 + Math.sin(a) * 9,
        3,
      );
    }
  if (impact > 0 && !reduced)
    for (let i = 0; i < 10; i++) {
      const a = (i * Math.PI) / 5,
        travel = (1 - impact) * 90;
      poly(
        boss.x + Math.cos(a) * (65 + travel),
        boss.y + 42 + Math.sin(a) * travel * 0.45 - impact * 18,
        [-5, -5, 6, -3, 8, 4, -4, 6],
        face,
        impact * 0.8,
      );
    }
  g.restore();
  if (pose.dead && pose.collapse > 0.4) rubble();
  paintFragments();
  return pose.cues;
}

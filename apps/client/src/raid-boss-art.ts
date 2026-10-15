import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";

// Presentation only: positions, damage and attack deadlines stay server owned.
const frames = new WeakMap<
  Phaser.GameObjects.Graphics,
  {
    time: number;
    x: number;
    y: number;
    slamAt: number;
    speed: number;
  }
>();

export function drawRaidBoss(
  g: Phaser.GameObjects.Graphics,
  state: Snapshot,
  reduced: boolean,
) {
  const r = state.raid;
  const boss = state.players.find((p) => p.raidBoss);
  if (!r || !boss) return;
  const t = state.time;
  let frame = frames.get(g);
  if (!frame || t < frame.time)
    frame = { time: t, x: boss.x, y: boss.y, slamAt: -100, speed: 0 };
  const dt = t - frame.time;
  const speed =
    dt > 0 && dt < 0.3
      ? Math.hypot(boss.x - frame.x, boss.y - frame.y) / dt
      : dt === 0
        ? frame.speed
        : 0;
  const slam = r.warnings.find((w) => w.kind === "slam");
  if (slam) frame.slamAt = slam.at;
  const stagger = r.staggerUntil > t;
  const exposed = r.exposedUntil > t || stagger;
  const windup = r.warnings.find((w) => w.kind === "charge");
  const lift =
    slam && !stagger ? Math.max(0, Math.min(1, 1 - (slam.at - t) / 1.25)) : 0;
  const impact =
    !stagger && t >= frame.slamAt
      ? Math.max(0, 1 - (t - frame.slamAt) / 0.45)
      : 0;
  const charging = speed > 180 && !stagger;
  const motion = reduced ? 0 : 1;
  const breath = Math.sin(t * 2.5) * 2 * motion;
  const stride = charging ? Math.sin(t * 23) * 5 * motion : 0;
  const crouch = windup ? 9 : impact * 13;
  const lean = stagger
    ? Math.sin(t * 3) * 3 * motion
    : charging
      ? Math.cos(boss.angle) * 9
      : Math.cos(boss.angle) * 3;
  const x = boss.x + lean,
    y = boss.y + breath + crouch;
  const pulse = reduced ? 0.8 : 0.75 + Math.sin(t * (exposed ? 9 : 3)) * 0.2;
  const hot = exposed ? 0x82ffe7 : r.phase === 3 ? 0xff7751 : 0xffce75;
  const dark = r.gilded ? 0x55402e : 0x202e43;
  const rock = r.gilded ? 0xa78248 : 0x52657b;
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
      sy = y - 44;
    poly(sx, sy, [-34, -19, -14, -39, 23, -33, 40, -8, 23, 20, -24, 19], rock);
    poly(sx, sy, [-34, -19, -14, -39, 23, -33, 8, -12], face);
    crystal(sx + side * 9, sy - 33, side === 1 ? 38 : 27);
    crystal(sx - side * 14, sy - 23, 20);
  }
  // Independently articulated forearms. Both rise before the authoritative slam.
  for (const side of [-1, 1]) {
    const armLift = lift * 76;
    const ax = x + side * (96 + lift * 12),
      ay = y + 9 - armLift + side * stride;
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

  const coreY = y + 16;
  g.fillStyle(hot, 0.06 * pulse).fillCircle(x, coreY, exposed ? 61 : 42);
  poly(x, coreY, [0, -31, 29, -12, 25, 21, 0, 36, -26, 19, -29, -13], face);
  poly(x, coreY, [0, -25, 23, -9, 19, 16, 0, 29, -20, 15, -23, -10], 0x111d2e);
  crystal(x, coreY, exposed ? 27 : 18);
  if (exposed) {
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
  const hx = x + Math.cos(boss.angle) * 5,
    hy = y - 49 + (stagger ? 7 : 0);
  poly(
    hx,
    hy,
    [-39, -14, -18, -27, 27, -24, 43, -6, 32, 20, 0, 27, -34, 17],
    dark,
  );
  poly(hx, hy, [-38, -14, -18, -27, 27, -24, 40, -7, 8, -11, -3, -2], face);
  poly(hx, hy, [-30, 1, -10, 6, -11, 12, -29, 9], hot);
  poly(hx, hy, [10, 6, 30, 0, 29, 9, 11, 12], hot);
  poly(hx, hy, [-23, 20, 0, 24, 24, 18, 14, 32, -12, 34], rock);
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
  frames.set(g, { time: t, x: boss.x, y: boss.y, slamAt: frame.slamAt, speed });
}

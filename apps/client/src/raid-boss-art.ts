import { paintVectorGrumble } from "./boss-vector-rig";
import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossLife } from "./raid-boss-life";
import { rockGrain } from "./boss-materials";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";

import { RaidBossMotion } from "./raid-boss-motion";
const motions = new WeakMap<Phaser.GameObjects.Graphics, RaidBossMotion>();

/**
 * Grumblecrag in battle: the vector rig (boss-vector-rig.ts) posed from the
 * server's warnings and casts, over its shadow and floor effects. Returns the
 * motion's sound cues.
 */
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
  const stagger = r.staggerUntil > state.time && !pose.dead;
  const exposed =
    (r.phase === 3 || r.exposedUntil > state.time || stagger) && !pose.dead;
  const face = r.gilded ? 0xe4c47c : 0x8a9eb1;
  const hot = r.phase === 3 ? 0xff7751 : 0xffce75;
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
    rockGrain(g, cx, cy, points, color, alpha);
  };

  // Shadow and dust stay on the floor as the torso and fists rise.
  g.fillStyle(0x030a18, 0.35).fillEllipse(boss.x, boss.y + 51, 202, 61);
  g.fillStyle(0x030a18, 0.25).fillEllipse(boss.x, boss.y + 51, 146, 39);
  // Low-opacity floor effects never obscure the red damage boundary.
  const impact = pose.impact;
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
  // The attack being wound up (its server warning) and the last one cast.
  const wind = r.warnings.find(
    (w) =>
      (!w.casterId || w.casterId === boss.id) &&
      w.at >= state.time &&
      (w.startedAt ?? w.at - 1.5) <= state.time,
  );
  const cast = life.action.casts[life.action.casts.length - 1];
  const motion = reduced ? 0 : 1;
  const recoil = Math.sin(pose.hurt * Math.PI * 3) * pose.hurt * 6 * motion;
  paintVectorGrumble(g, {
    x: boss.x + recoil + Math.sin(pose.time * 17) * pose.crash * 5 * motion,
    y: boss.y,
    angle: boss.angle,
    lookX: life.lookX,
    lookY: life.lookY,
    time: pose.time,
    breath: life.breath,
    phase: r.phase,
    reduced,
    gilded: !!r.gilded,
    charge: pose.dead ? 0 : pose.charge,
    charging: pose.charging && !pose.dead,
    slam: pose.dead ? 0 : pose.slam,
    impact,
    debris: pose.dead ? 0 : pose.debris,
    transform: pose.dead ? 0 : pose.transform,
    windKind: wind?.kind,
    windup: life.windup,
    castKind: cast?.kind,
    castAge: cast?.age ?? 99,
    stagger,
    exposed,
    hurt: pose.hurt,
    dead: pose.dead,
    collapse: pose.collapse,
    deathAge: pose.deathAge,
  });
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
  return pose.cues;
}

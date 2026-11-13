import { paintLumiwick } from "./boss-lumiwick-rig";
import { noteLumiwick } from "./lumiwick-attack-fx";
import { paintSkyTerrace } from "./raid-emberwing-terrace-rig";
import { bossLife } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  EMBERWING as E,
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
/**
 * The Sky Terrace's features (braziers, burning ground, dive lanes, flame
 * rings, feathers): pieces from one atlas drawn when the raid's scene starts,
 * placed each frame (raid-emberwing-terrace-rig.ts).
 */
export function drawSkyTerrace(
  g: G,
  state: Snapshot,
  reduced: boolean,
  at?: LayerAt,
) {
  paintSkyTerrace(g, state, reduced, at);
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
interface LumiState {
  motion: RaidBossMotion;
  flight: number;
  clock: number;
  airborne: boolean;
  /** When the braziers last brought it down, and when it last took off (battle seconds). */
  groundedAt: number;
  takeoffAt: number;
  exposed: boolean;
}
const controllers = new WeakMap<G, LumiState>();
/** How long it stays dazed after the braziers bring it down. */
const DAZE = 2.4;
/**
 * Lumiwick (Emberwing's id): a sky-lantern spirit (boss-lumiwick.ts) that
 * floats, reading the battle's own state: each attack's windup (its warning)
 * and follow-through (the cast), dropped onto the floor with its flame heart
 * open when the braziers are lit, a flare at a new phase, a flinch when hit,
 * and its flame guttering out when beaten.
 */
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
    c = {
      motion: new RaidBossMotion(),
      flight: r.airborne ? 1 : 0,
      clock,
      airborne: !!r.airborne,
      groundedAt: -10,
      takeoffAt: -10,
      exposed: false,
    };
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
  const t = life.time;
  const exposed = !!r.permanentGround || r.exposedUntil > state.time;
  if (exposed && !c.exposed) c.groundedAt = t;
  if (!exposed && c.exposed) c.takeoffAt = t;
  if (r.airborne && !c.airborne && !exposed && t - c.takeoffAt > 2)
    c.takeoffAt = t;
  c.exposed = exposed;
  c.airborne = !!r.airborne;
  const dazed =
    (exposed && !r.permanentGround && t - c.groundedAt < DAZE) ||
    r.staggerUntil > state.time;
  // its shadow on the floor: smaller and fainter the higher it floats
  g.fillStyle(0x10192a, 0.3 - c.flight * 0.08).fillEllipse(
    boss.x,
    boss.y + 4,
    150 - c.flight * 30,
    40 - c.flight * 8,
  );
  // the attack being wound up (its warning) and the last one cast
  const wind = r.warnings.find(
    (w) =>
      w.kind !== "brazier-lighting" &&
      (!w.casterId || w.casterId === boss.id) &&
      w.at >= state.time &&
      (w.startedAt ?? w.at - 1.5) <= state.time,
  );
  const cast = life.action.casts[life.action.casts.length - 1];
  const drawn = paintLumiwick(g, {
    x: boss.x,
    y: boss.y,
    // it turns to where it floats, and to its attack's aim
    angle: life.heading,
    clock: t,
    phase: r.phase,
    reduced,
    gilded: !!r.gilded,
    flight: c.flight,
    windKind: wind?.kind,
    windup: life.windup,
    castKind: cast?.kind,
    castAge: cast?.age ?? 99,
    exposed: exposed && !pose.dead,
    groundAge: t - c.groundedAt,
    takeoffAge: t - c.takeoffAt,
    stagger: dazed && !pose.dead,
    hurt: pose.hurt,
    dead: pose.dead,
    deadAge: pose.deathAge,
    roarAge: pose.transform > 0 ? (1 - pose.transform) * 1.6 : 99,
  });
  // where its attack effects start from (lumiwick-attack-fx.ts)
  if (drawn)
    noteLumiwick(g.scene, {
      hem: { x: boss.x + drawn.hem.x, y: boss.y + drawn.hem.y },
      eyes: drawn.eyes.map((e) => ({ x: boss.x + e.x, y: boss.y + e.y })),
      flame: drawn.flame,
      lit: drawn.lit,
    });
  return pose.cues;
}

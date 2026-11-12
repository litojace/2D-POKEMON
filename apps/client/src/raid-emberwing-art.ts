import { paintVectorEmber } from "./boss-vector-ember-rig";
import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossLife } from "./raid-boss-life";
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
export function drawSkyTerrace(
  g: G,
  state: Snapshot,
  reduced: boolean,
  at?: LayerAt,
) {
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
    bowl
      .lineStyle(3, 0xc3a37c, 0.9)
      .strokeEllipse(b.x, b.y - 7, 64, groundHeight(64));
    bowl
      .fillStyle(0x152239, 1)
      .fillEllipse(b.x, b.y - 10, 50, groundHeight(50));
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
interface EmberState {
  motion: RaidBossMotion;
  flight: number;
  clock: number;
  /** When it was last grounded by the braziers (for its crash and daze). */
  groundedAt: number;
  exposed: boolean;
  ash: { x: number; y: number; vx: number; vy: number; age: number }[];
}
const controllers = new WeakMap<G, EmberState>();
/** How long it stays dazed after the braziers bring it down. */
const DAZE = 2.4;
/**
 * Emberwing: a vector fire phoenix (boss-vector-ember.ts) that flies and
 * lands, reading the battle's own state: each attack's windup (its warning)
 * and follow-through (the cast), grounded and dazed with its heart open when
 * the braziers are lit, a screech at a new phase, a flinch when hit, and a
 * fall to grey ash when beaten.
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
      groundedAt: -10,
      exposed: false,
      ash: [],
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
  c.exposed = exposed;
  const dazed =
    (exposed && !r.permanentGround && t - c.groundedAt < DAZE) ||
    r.staggerUntil > state.time;
  // its shadow on the floor: smaller and fainter the higher it flies
  g.fillStyle(0x10192a, 0.3 - c.flight * 0.08).fillEllipse(
    boss.x,
    boss.y + 4,
    170 - c.flight * 35,
    45 - c.flight * 10,
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
  const head = paintVectorEmber(g, {
    x: boss.x,
    y: boss.y,
    // it turns to where it flies, and to its attack's aim
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
    stagger: dazed && !pose.dead,
    hurt: pose.hurt,
    dead: pose.dead,
    deadAge: pose.deathAge,
    roarAge: pose.transform > 0 ? (1 - pose.transform) * 1.6 : 99,
  });
  // beaten, it crumbles: grey ash drifts up from where it fell
  if (head && pose.dead && !reduced) {
    if (pose.deathAge < 2.4 && c.ash.length < 40 && Math.random() < 0.6)
      c.ash.push({
        x: boss.x + (Math.random() - 0.5) * 90,
        y: boss.y - 30 - Math.random() * 60,
        vx: (Math.random() - 0.5) * 12,
        vy: -18 - Math.random() * 22,
        age: 0,
      });
  }
  c.ash = c.ash.filter((a) => (a.age += dt) < 1.6);
  for (const a of c.ash)
    g.fillStyle(
      a.age < 0.4 ? 0xffa060 : 0x8d8a92,
      0.7 * (1 - a.age / 1.6),
    ).fillCircle(a.x + a.vx * a.age, a.y + a.vy * a.age, 2.5);
  return pose.cues;
}

import { paintPrismell } from "./boss-prismell-rig";
import { notePrismell } from "./prismell-attack-fx";
import { paintBossAura } from "./boss-spell-art";
import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossLife } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  PRISMATAIL as P,
  PRISM_COLORS,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import { RaidBossMotion, type RaidBossCue } from "./raid-boss-motion";
import { paintAtriumRig } from "./raid-prismatail-atrium-rig";
import type { LayerAt } from "./raid-layers";
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
/**
 * The Sun Atrium's live pieces: mirrors, skylights, light-relay beams, Sun
 * Pillars and the Blinded marker, as images from one atlas
 * (raid-prismatail-atrium-rig.ts). Its rings and glass are in the baked floor.
 */
export function drawSunAtrium(
  g: G,
  state: Snapshot,
  reduced: boolean,
  at?: LayerAt,
  clock = state.time,
) {
  paintAtriumRig(g, state, reduced, at, clock);
}
export function drawPrismatailWarning(g: G, state: Snapshot, w: RaidWarning) {
  const progress = Math.max(
    0,
    Math.min(
      1,
      (state.time - (w.startedAt ?? state.time)) /
        Math.max(0.01, w.at - (w.startedAt ?? state.time)),
    ),
  );
  if (w.kind === "prism-lance" || w.kind === "refraction") {
    const dx = w.tx - w.x,
      dy = w.ty - w.y,
      len = Math.hypot(dx, dy) || 1,
      nx = (-dy / len) * w.radius,
      ny = (dx / len) * w.radius;
    g.fillStyle(0xff607d, 0.18 + progress * 0.15).fillPoints(
      [
        { x: w.x + nx, y: w.y + ny },
        { x: w.tx + nx, y: w.ty + ny },
        { x: w.tx - nx, y: w.ty - ny },
        { x: w.x - nx, y: w.y - ny },
      ],
      true,
    );
    g.lineStyle(3, 0xff9ab0, 1)
      .lineBetween(w.x + nx, w.y + ny, w.tx + nx, w.ty + ny)
      .lineBetween(w.x - nx, w.y - ny, w.tx - nx, w.ty - ny);
    g.lineStyle(2, 0xffe6a6, 0.8).lineBetween(w.x, w.y, w.tx, w.ty);
    return true;
  }
  if (w.kind === "fan-display") {
    const n = w.prismCount ?? 6,
      index = w.prismIndex ?? 0;
    for (let i = 0; i < n; i++) {
      const angle = (i * TAU) / n,
        hot = i === index,
        start = angle - Math.PI / n,
        end = angle + Math.PI / n;
      const pts = [
        { x: w.x, y: w.y },
        ...Array.from({ length: 17 }, (_, j) => ({
          x: w.x + Math.cos(start + ((end - start) * j) / 16) * w.radius,
          y: w.y + Math.sin(start + ((end - start) * j) / 16) * w.radius,
        })),
      ];
      g.fillStyle(
        PRISM_COLORS[i],
        hot ? 0.16 + progress * 0.13 : 0.025,
      ).fillPoints(pts, true);
      g.lineStyle(hot ? 4 : 1, PRISM_COLORS[i], hot ? 1 : 0.35).strokePoints(
        pts,
        true,
      );
      // Number represented by pips as well as colour, matching the crest cue.
      for (let j = 0; j <= i; j++)
        g.fillStyle(PRISM_COLORS[i], hot ? 1 : 0.45).fillCircle(
          w.x + Math.cos(angle) * 220 + (j - i / 2) * 10,
          w.y + Math.sin(angle) * 220,
          3.3,
        );
    }
    g.fillStyle(PRISM_COLORS[index], 1).fillCircle(w.x, w.y - 200, 18);
    for (let j = 0; j <= index; j++)
      g.fillStyle(0xffffff, 1).fillCircle(
        w.x + (j - index / 2) * 8,
        w.y - 228,
        2.8,
      );
    return true;
  }
  if (w.kind === "glare") {
    const y = w.y - 205;
    g.fillStyle(0xfff3ce, 0.15 + progress * 0.15).fillEllipse(
      w.x,
      y,
      100,
      groundHeight(100),
    );
    g.lineStyle(4, 0xfff3ce, 1).strokeEllipse(w.x, y, 68, groundHeight(68));
    g.fillStyle(0xfff3ce, 1).fillCircle(w.x, y, 9 + progress * 5);
    g.lineStyle(4, 0xffe2ab, 0.9)
      .beginPath()
      .arc(w.x, y, 45, -Math.PI / 2, -Math.PI / 2 + TAU * progress, false)
      .strokePath();
    return true;
  }
  if (w.kind === "halo-crush") {
    const gap = w.gapAngle ?? 0,
      radius = w.radius + (1 - progress) * 170;
    // The thin target ring is the landing hitbox; the large ring shows its approach.
    g.lineStyle(P.halo.width * 2, 0xff607d, 0.12)
      .beginPath()
      .arc(w.x, w.y, w.radius, gap + P.halo.gap, gap + TAU - P.halo.gap, false)
      .strokePath();
    g.lineStyle(4, 0xff9ab0, 1)
      .beginPath()
      .arc(w.x, w.y, radius, gap + P.halo.gap, gap + TAU - P.halo.gap, false)
      .strokePath();
    g.lineStyle(6, 0x8bf0cc, 1)
      .beginPath()
      .arc(w.x, w.y, w.radius, gap - P.halo.gap, gap + P.halo.gap, false)
      .strokePath();
    return true;
  }
  return w.kind === "light-relay";
}
const motion = new WeakMap<G, RaidBossMotion>();
/** Where the boss was last frame, to tell when it walks. */
const steps = new WeakMap<
  G,
  { x: number; y: number; time: number; walk: number }
>();
/**
 * Prismell (the "prismatail" raid): the prism-shelled snail (boss-prismell.ts)
 * posed from the battle's own state. The attack being wound up (its warning)
 * and the last one cast drive its windups and follow-through; a light relay
 * opens its heart; it shows its shell off at a new phase, and when beaten the
 * shell's light goes out and it tucks itself away inside.
 */
export function drawPrismatail(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
): RaidBossCue[] {
  const r = state.raid!,
    boss = state.players.find((p) => p.id === r.bossId);
  if (!boss) return [];
  let m = motion.get(g);
  if (!m) {
    m = new RaidBossMotion();
    motion.set(g, m);
  }
  const pose = m.sample(state, clock, reduced)!;
  const life = bossLife(g, state, boss, clock, reduced);
  const exposed = r.exposedUntil > state.time;
  const stagger = r.staggerUntil > state.time;
  // walking: its speed over the floor, eased
  const last = steps.get(g);
  let walk = last?.walk ?? 0;
  if (last && state.time > last.time) {
    const speed =
      Math.hypot(boss.x - last.x, boss.y - last.y) / (state.time - last.time);
    walk += (Math.min(1, speed / 120) - walk) * 0.3;
  }
  steps.set(g, { x: boss.x, y: boss.y, time: state.time, walk });
  const wind = r.warnings.find(
    (w) =>
      (!w.casterId || w.casterId === boss.id) &&
      w.at >= state.time &&
      (w.startedAt ?? w.at - 1.5) <= state.time,
  );
  const cast = life.action.casts[life.action.casts.length - 1];
  g.fillStyle(0x101a2d, 0.32).fillEllipse(boss.x, boss.y + 6, 172, 40);
  const at = paintPrismell(g, {
    x: boss.x,
    y: boss.y,
    angle: boss.angle,
    clock: pose.time,
    phase: r.phase,
    reduced,
    gilded: !!r.gilded,
    windKind: wind?.kind,
    windup: life.windup,
    castKind: cast?.kind,
    castAge: cast?.age ?? 99,
    roarAge: pose.transform > 0 ? (1 - pose.transform) * 1.6 : 99,
    exposed,
    stagger,
    hurt: pose.hurt,
    dead: pose.dead,
    deadAge: pose.deathAge,
    walk: pose.dead || exposed || stagger ? 0 : walk,
    prismHot: wind?.kind === "fan-display" ? (wind.prismIndex ?? 0) : undefined,
    scramble: !!r.mirrors?.some((m) => (m.scrambleAt ?? 0) > state.time),
  });
  if (at) {
    // where the shell and its heart are, for the attack effects (prismell-attack-fx.ts)
    notePrismell(g.scene, {
      heart: at.heart,
      shell: at.shell,
      shellTop: at.shellTop,
      open: at.open,
      dim: at.dim,
      shine: at.shine,
    });
    if (!pose.dead)
      paintBossAura(g, "prismatail", at.heart.x, at.heart.y, life, 1);
  }
  return pose.cues;
}

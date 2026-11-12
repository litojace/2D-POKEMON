import { paintVectorPrisma } from "./boss-vector-prisma-rig";
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
import type { LayerAt } from "./raid-layers";
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
const diamond = (
  g: G,
  x: number,
  y: number,
  size: number,
  color: number,
  alpha = 1,
) =>
  g.fillStyle(color, alpha).fillPoints(
    [
      { x, y: y - size },
      { x: x + size * 0.6, y },
      { x, y: y + size },
      { x: x - size * 0.6, y },
    ],
    true,
  );
export function drawSunAtrium(
  g: G,
  state: Snapshot,
  reduced: boolean,
  at?: LayerAt,
) {
  const r = state.raid!,
    t = reduced ? 0 : state.time;
  // Inlaid glass stays quiet beneath the functional warnings.
  g.lineStyle(2, 0xffd778, 0.12).strokeEllipse(
    800,
    450,
    1150,
    groundHeight(1150),
  );
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    g.lineStyle(2, PRISM_COLORS[i % 6], 0.13).lineBetween(
      800 + Math.cos(a) * 300,
      450 + Math.sin(a) * groundHeight(300),
      800 + Math.cos(a) * 570,
      450 + Math.sin(a) * groundHeight(570),
    );
  }
  const sources =
    r.phase === 3 && r.partySize > 1
      ? [
          { x: 350, y: 300 },
          { x: 350, y: 600 },
        ]
      : [P.source];
  const range = P.range + (r.trait === "dazzling" ? 60 : 0);
  if (r.exposedUntil <= state.time)
    for (const s of sources) {
      g.fillStyle(0xffe9ac, 0.06).fillCircle(s.x, s.y, range);
      g.lineStyle(2, 0xffe9ac, 0.25).strokeCircle(s.x, s.y, range);
      g.fillStyle(0xffe9ac, 0.16).fillEllipse(s.x, s.y, 90, groundHeight(90));
      g.lineStyle(3, 0xffe9ac, 0.9).strokeEllipse(
        s.x,
        s.y,
        64,
        groundHeight(64),
      );
      diamond(g, s.x, s.y - 23, 24, 0xffe9ac, 0.9);
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + t * 0.18;
        g.lineStyle(2, 0xffe9ac, 0.55).lineBetween(
          s.x + Math.cos(a) * 32,
          s.y - 23 + Math.sin(a) * 32,
          s.x + Math.cos(a) * 44,
          s.y - 23 + Math.sin(a) * 44,
        );
      }
    }
  for (const link of r.lightLinks ?? []) {
    const color = link.beam ? 0x9cddff : 0xffdc83;
    g.lineStyle(15, color, 0.13).lineBetween(link.x, link.y, link.tx, link.ty);
    g.lineStyle(4, color, 0.95).lineBetween(link.x, link.y, link.tx, link.ty);
    if (!reduced) {
      const p = (t * 0.65) % 1;
      diamond(
        g,
        link.x + (link.tx - link.x) * p,
        link.y + (link.ty - link.y) * p,
        6,
        0xffffff,
      );
    }
  }
  for (const [i, m] of (r.mirrors ?? []).entries()) {
    g.fillStyle(0x0d2034, 0.65).fillEllipse(m.x, m.y + 18, 80, 30);
    // The post and its crystal stand up, so they sort with the raiders; the
    // arrow is painted on the floor.
    const post = at ? at(`mirror-${i}`, m.y + 23) : g;
    post.fillStyle(0x42536c, 1).fillRoundedRect(m.x - 24, m.y - 12, 48, 35, 7);
    post.fillStyle(0x56698a, 1).fillRoundedRect(m.x - 24, m.y - 12, 14, 35, 6);
    post.lineStyle(3, 0xd9cf9d, 0.9).strokeCircle(m.x, m.y - 8, 29);
    diamond(post, m.x, m.y - 8, 26, PRISM_COLORS[i], 0.9);
    // About to scramble: the mirror flashes pink, and a long ghost arrow
    // shows where it will point once it turns.
    if (m.scrambleAt !== undefined && m.scrambleAt > state.time) {
      const pulse = reduced
          ? 1
          : 0.55 + 0.45 * Math.abs(Math.sin(state.time * 9)),
        turned = m.angle - ((m.scrambleTurns ?? 2) * Math.PI) / 4,
        gx = Math.cos(turned),
        gy = Math.sin(turned);
      g.fillStyle(0xff6f91, 0.2 * pulse).fillEllipse(m.x, m.y + 4, 124, 48);
      g.lineStyle(4, 0xff6f91, pulse).strokeEllipse(m.x, m.y + 4, 124, 48);
      post.lineStyle(5, 0xff6f91, pulse).strokeCircle(m.x, m.y - 8, 37);
      g.lineStyle(6, 0xff6f91, 0.95 * pulse).lineBetween(
        m.x + gx * 44,
        m.y + gy * 44,
        m.x + gx * 92,
        m.y + gy * 92,
      );
      g.fillStyle(0xff6f91, 0.95 * pulse).fillTriangle(
        m.x + gx * 108,
        m.y + gy * 108,
        m.x + gx * 88 - gy * 11,
        m.y + gy * 88 + gx * 11,
        m.x + gx * 88 + gy * 11,
        m.y + gy * 88 - gx * 11,
      );
    }
    const dx = Math.cos(m.angle),
      dy = Math.sin(m.angle);
    g.lineStyle(5, 0xfff5c9, 1).lineBetween(
      m.x,
      m.y,
      m.x + dx * 56,
      m.y + dy * 56,
    );
    g.fillStyle(0xfff5c9, 1).fillTriangle(
      m.x + dx * 65,
      m.y + dy * 65,
      m.x + dx * 48 - dy * 8,
      m.y + dy * 48 + dx * 8,
      m.x + dx * 48 + dy * 8,
      m.y + dy * 48 - dx * 8,
    );
  }
  for (const p of r.sunPillars ?? []) {
    g.fillStyle(0xffb556, 0.2).fillEllipse(p.x, p.y, 80, groundHeight(80));
    diamond(g, p.x, p.y - 35, 32, 0xffdb83, 0.85);
  }
  for (const p of state.players)
    if ((r.blinded?.[p.id] ?? 0) > state.time) {
      g.lineStyle(3, 0xd4caff, 0.9)
        .strokeEllipse(p.x, p.y - 102, 32, groundHeight(32))
        .lineBetween(p.x - 19, p.y - 90, p.x + 19, p.y - 114);
    }
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
 * Prismatail as vector art (boss-vector-prisma.ts): a crystal peacock posed
 * from the battle's own state. The attack being wound up (its warning) and
 * the last one cast drive its windups and follow-through; a light relay opens
 * its heart; it cries out with its fan up at a new phase and fades to a dim
 * husk when beaten.
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
  g.fillStyle(0x101a2d, 0.32).fillEllipse(boss.x, boss.y + 8, 150, 38);
  const at = paintVectorPrisma(g, {
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
  });
  if (at && !pose.dead)
    paintBossAura(g, "prismatail", at.heart.x, at.heart.y, life, 1);
  return pose.cues;
}

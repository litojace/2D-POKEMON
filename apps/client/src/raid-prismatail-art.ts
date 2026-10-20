import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  PRISMATAIL as P,
  PRISM_COLORS,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import { RaidBossMotion, type RaidBossCue } from "./raid-boss-motion";
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
export function drawSunAtrium(g: G, state: Snapshot, reduced: boolean) {
  const r = state.raid!,
    t = reduced ? 0 : state.time;
  // Inlaid glass stays quiet beneath the functional warnings.
  g.lineStyle(2, 0xffd778, 0.12).strokeEllipse(800, 450, 1150, 660);
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    g.lineStyle(2, PRISM_COLORS[i % 6], 0.13).lineBetween(
      800 + Math.cos(a) * 300,
      450 + Math.sin(a) * 180,
      800 + Math.cos(a) * 570,
      450 + Math.sin(a) * 325,
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
      g.fillStyle(0xffe9ac, 0.16).fillEllipse(s.x, s.y, 90, 50);
      g.lineStyle(3, 0xffe9ac, 0.9).strokeEllipse(s.x, s.y, 64, 30);
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
    g.fillStyle(0x42536c, 1).fillRoundedRect(m.x - 24, m.y - 12, 48, 35, 7);
    g.lineStyle(3, 0xd9cf9d, 0.9).strokeCircle(m.x, m.y - 8, 29);
    diamond(g, m.x, m.y - 8, 26, PRISM_COLORS[i], 0.9);
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
    g.fillStyle(0xffb556, 0.2).fillEllipse(p.x, p.y, 80, 40);
    diamond(g, p.x, p.y - 35, 32, 0xffdb83, 0.85);
  }
  for (const p of state.players)
    if ((r.blinded?.[p.id] ?? 0) > state.time) {
      g.lineStyle(3, 0xd4caff, 0.9)
        .strokeEllipse(p.x, p.y - 102, 32, 15)
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
    g.fillStyle(0xfff3ce, 0.15 + progress * 0.15).fillEllipse(w.x, y, 100, 58);
    g.lineStyle(4, 0xfff3ce, 1).strokeEllipse(w.x, y, 68, 30);
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
  const t = reduced ? 0 : pose.time,
    x = boss.x,
    y = boss.y - 60 + Math.sin(t * 1.3) * 4 + pose.collapse * 32,
    exposed = r.exposedUntil > state.time;
  const alpha =
    r.result === "victory" ? Math.max(0.2, 1 - pose.deathAge * 0.35) : 1;
  g.fillStyle(0x101a2d, 0.35).fillEllipse(x, boss.y + 20, 200, 60);
  // Each prism feather has its own facet and eye; slow fan breathing never rescales the body.
  for (let i = 0; i < 9; i++) {
    const a = -Math.PI + (i / 8) * Math.PI,
      reach = 152 + Math.sin(t * 1.1 + i * 0.6) * 5;
    const tx = x + Math.cos(a) * reach,
      ty = y - 12 + Math.sin(a) * reach;
    const side = 17,
      color = PRISM_COLORS[i % 6];
    g.fillStyle(0x263d59, alpha).fillTriangle(
      x,
      y + 15,
      tx - side,
      ty,
      tx + side,
      ty,
    );
    diamond(g, tx, ty, 36, color, alpha * 0.9);
    diamond(g, tx - 4, ty - 6, 17, 0xfff8e6, alpha * 0.7);
    g.fillStyle(0x20304d, alpha).fillCircle(tx, ty + 4, 7);
    g.fillStyle(color, alpha).fillCircle(tx, ty + 4, 3.5);
  }
  g.fillStyle(
    pose.hurt > 0.2 ? 0xe5faff : r.gilded ? 0xf6c66f : 0x65bcca,
    alpha,
  ).fillEllipse(x, y + 14, 107, 120);
  g.fillStyle(0xffebac, alpha).fillEllipse(x, y + 27, 70, 82);
  g.fillStyle(0x32788e, alpha)
    .fillEllipse(x - 43, y + 25 + Math.sin(t * 1.8) * 3, 34, 70)
    .fillEllipse(x + 43, y + 25 - Math.sin(t * 1.8) * 3, 34, 70);
  g.fillStyle(0x83d7db, alpha).fillEllipse(x, y - 52, 66, 70);
  for (const off of [-14, 0, 14]) {
    g.lineStyle(3, 0xe1c36e, alpha).lineBetween(
      x + off * 0.4,
      y - 83,
      x + off,
      y - 107 - Math.abs(off) * 0.3,
    );
    diamond(g, x + off, y - 109 - Math.abs(off) * 0.3, 8, 0xffe9a0, alpha);
  }
  for (const dx of [-15, 15]) {
    g.fillStyle(0x152438, alpha).fillEllipse(x + dx, y - 56, 10, 15);
    g.fillStyle(0xffffff, alpha).fillCircle(x + dx - 1, y - 59, 2.5);
  }
  g.fillStyle(0xffb56b, alpha).fillTriangle(
    x - 9,
    y - 42,
    x + 9,
    y - 42,
    x,
    y - 29,
  );
  g.fillStyle(0xe3b567, alpha)
    .fillEllipse(x - 25, boss.y + 7, 35, 13)
    .fillEllipse(x + 25, boss.y + 7, 35, 13);
  diamond(g, x, y + 22, 26, exposed ? 0xfff5c9 : 0x9ae4ee, alpha);
  if (!exposed) {
    g.fillStyle(0x9adfff, 0.14).fillEllipse(x, y + 15, 118, 136);
    g.lineStyle(3, 0xc6efff, 0.8).strokeEllipse(x, y + 15, 118, 136);
    g.lineStyle(2, 0xffffff, 0.55).lineBetween(x - 30, y - 27, x - 43, y + 4);
  } else {
    g.lineStyle(3, 0xffe9a0, 0.7).strokeCircle(
      x,
      y + 22,
      36 + Math.sin(t * 2) * 3,
    );
  }
  return pose.cues;
}

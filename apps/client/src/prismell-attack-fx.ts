/**
 * Prismell's attack effects (the "prismatail" raid), drawn every frame
 * through the effects engine (fx-engine.ts) inside boss-spell-art.ts's
 * `space`, so they keep to the graphics levels and the glow budget, and its
 * warning glows stay full size on Low (`essential`). They start from the
 * shell itself: where boss-prismell-rig.ts last drew its heart and shell.
 *
 * The warnings (lance lanes, the fan's slices, the glare marker, the halo's
 * rings) are unchanged and drawn by raid-prismatail-art.ts; these dress
 * them: the heart charging and the beam leaving the shell, the shell
 * projecting its fan, the flash, the halo lifting off the shell and landing,
 * the shield shattering when the light relay reaches it, the shell's pink
 * glints at mirrors about to scramble, and the light leaving a beaten shell.
 */
import type Phaser from "phaser";
import type { Fighter, Snapshot } from "@arena/shared";
import type { BossCast } from "./boss-performance";
import { PRISM_COLORS } from "../../../packages/shared/src/raid-prismatail";
import type { RaidWarning } from "../../../packages/shared/src/raid";

type Pt = { x: number; y: number };
/** The parts of the effects engine these use (the demo passes its own). */
export interface PrismellFxEngine {
  g: Phaser.GameObjects.Graphics;
  floor: Phaser.GameObjects.Graphics;
  soft(x: number, y: number, r: number, c: number, a?: number): void;
  burst(o: {
    x: number;
    y: number;
    z?: number;
    count: number;
    kind: "spark" | "mote" | "debris" | "ember";
    color: number | number[];
    speed: [number, number];
    up?: [number, number];
    angle?: number;
    spread?: number;
    life: [number, number];
    size: [number, number];
    grav?: number;
    drag?: number;
  }): void;
  trail(key: string | number, every: number, emit: () => void): void;
}
export type PrismellGlow = (
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  floor?: boolean,
) => void;
export interface PrismellPoints {
  /** In the boss layer's coordinates. */
  heart: Pt;
  shell: Pt;
  shellTop: Pt;
  /** The heart is open (0-1); the shell's light is gone (0-1). */
  open: number;
  dim: number;
  /** The shell's showing-off shine (0-1). */
  shine: number;
}
const points = new WeakMap<Phaser.Scene, PrismellPoints>();
/** The rig's latest heart and shell (raid-prismatail-art.ts records them each frame). */
export const notePrismell = (scene: Phaser.Scene, p: PrismellPoints) =>
  points.set(scene, p);
export const prismellPoints = (scene: Phaser.Scene) => points.get(scene);

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const WHITE = 0xfffbf0,
  GOLD = 0xffe2a0,
  PINK = 0xff8fc8,
  SHARD = [0xc4f8ef, 0xffffff, 0xa5adff, 0xffd6ef];

/** What one scene's effects remember between frames. */
export interface PrismellFxMemo {
  /** Fan Display: each warning's hot slice, kept for its cast. */
  fans: Map<number, { index: number; count: number }>;
  open: number;
}
const memos = new WeakMap<Phaser.Scene, PrismellFxMemo>();
export const newPrismellMemo = (): PrismellFxMemo => ({
  fans: new Map(),
  open: 0,
});

/** The warnings and mirrors these read (a slice of the snapshot). */
export interface PrismellFxState {
  time: number;
  warnings: RaidWarning[];
  mirrors?: { x: number; y: number; scrambleAt?: number }[];
  bossX: number;
  bossY: number;
  dead: boolean;
}

export function drawPrismellAttacks(
  scene: Phaser.Scene,
  fx: PrismellFxEngine,
  glow: PrismellGlow,
  state: Snapshot,
  boss: Fighter,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid,
    p = points.get(scene);
  if (!r || !p) return;
  let memo = memos.get(scene);
  if (!memo) memos.set(scene, (memo = newPrismellMemo()));
  drawPrismellFx(
    fx,
    glow,
    p,
    {
      time: state.time,
      warnings: r.warnings.filter((w) => !w.casterId || w.casterId === boss.id),
      mirrors: r.mirrors,
      bossX: boss.x,
      bossY: boss.y,
      dead: boss.hp <= 0 || r.result === "victory",
    },
    casts,
    low,
    memo,
  );
}

/** A small rainbow diamond (a prism shard). */
function diamond(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  rot = 0,
) {
  const cs = Math.cos(rot),
    sn = Math.sin(rot);
  const q = (dx: number, dy: number) => ({
    x: x + dx * cs - dy * sn,
    y: y + dx * sn + dy * cs,
  });
  g.fillStyle(c, a).fillPoints(
    [q(0, -r), q(r * 0.55, 0), q(0, r), q(-r * 0.55, 0)],
    true,
  );
  g.fillStyle(0xffffff, a * 0.8).fillPoints(
    [q(0, -r), q(r * 0.2, -r * 0.1), q(0, r * 0.2), q(-r * 0.25, -r * 0.15)],
    true,
  );
}
/** A beam of split light: a soft white body, a rainbow band and a hot core. */
function prismBeam(
  fx: PrismellFxEngine,
  glow: PrismellGlow,
  a: Pt,
  b: Pt,
  width: number,
  alpha: number,
  low: boolean,
) {
  const g = fx.g,
    dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy) || 1,
    nx = -dy / len,
    ny = dx / len;
  g.lineStyle(width * 2.6, WHITE, 0.16 * alpha).lineBetween(a.x, a.y, b.x, b.y);
  const bands = low ? 3 : 6;
  for (let i = 0; i < bands; i++) {
    const o = (i - (bands - 1) / 2) * (width / bands) * 1.1;
    g.lineStyle(
      Math.max(2, (width / bands) * 1.3),
      PRISM_COLORS[(i * 6) / bands],
      0.55 * alpha,
    ).lineBetween(a.x + nx * o, a.y + ny * o, b.x + nx * o, b.y + ny * o);
  }
  g.lineStyle(Math.max(2, width * 0.28), 0xffffff, 0.95 * alpha).lineBetween(
    a.x,
    a.y,
    b.x,
    b.y,
  );
  const n = low ? 2 : 4;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    glow(a.x + dx * t, a.y + dy * t, width * 1.1, GOLD, 0.35 * alpha);
  }
}

/** Everything for one frame (pure apart from the engine and the memo). */
export function drawPrismellFx(
  fx: PrismellFxEngine,
  glow: PrismellGlow,
  p: PrismellPoints,
  s: PrismellFxState,
  casts: BossCast[],
  low: boolean,
  memo: PrismellFxMemo,
) {
  const g = fx.g,
    t = s.time;
  const fromBoss = (w: { x: number; y: number }) =>
    Math.hypot(w.x - s.bossX, w.y - s.bossY) < 2;
  // ── wind-ups (warnings: full size on Low) ──
  for (const w of s.warnings) {
    const start = w.startedAt ?? w.at - 1.5,
      k = clamp((t - start) / Math.max(0.01, w.at - start));
    if (k <= 0 || k > 1) continue;
    if (w.kind === "prism-lance" || w.kind === "refraction") {
      if (!fromBoss(w)) {
        // the bounce: the mirror gathers the light it will throw
        glow(w.x, w.y - 20, 14 + 16 * k, GOLD, 0.25 + 0.4 * k);
        continue;
      }
      // light gathers into the heart: motes spiral in, the heart swells
      const n = low ? 4 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n + t * 3.2,
          rr = 18 + 46 * (1 - ((k * 2.5 + i / n) % 1));
        diamond(
          g,
          p.heart.x + Math.cos(a) * rr,
          p.heart.y + Math.sin(a) * rr * 0.8,
          3.2,
          PRISM_COLORS[i % 6],
          0.5 + 0.5 * k,
          a,
        );
      }
      glow(p.heart.x, p.heart.y, 10 + 12 * k, 0xfff0c8, 0.12 + 0.28 * k);
      // the sight line: a thin split ray reaching down the lane
      const reach = Math.min(1, k * 1.4),
        tx = p.heart.x + (w.tx - p.heart.x) * reach,
        ty = p.heart.y + (w.ty - p.heart.y) * reach;
      for (let i = 0; i < 3; i++)
        g.lineStyle(
          1.6,
          [0xff899e, 0xffd778, 0x80e1ff][i],
          0.3 + 0.3 * k,
        ).lineBetween(p.heart.x + (i - 1) * 2, p.heart.y, tx + (i - 1) * 2, ty);
    } else if (w.kind === "fan-display") {
      const count = w.prismCount ?? 6,
        index = w.prismIndex ?? 0;
      memo.fans.set(w.id, { index, count });
      const hot = PRISM_COLORS[index];
      // the shell blazes in the striking slice's colour, shards circling it
      glow(p.shell.x, p.shell.y, 40 + 24 * k, hot, 0.2 + 0.3 * k);
      for (let i = 0; i < count; i++) {
        const a = (i * TAU) / count,
          spin = a + t * 0.9,
          isHot = i === index;
        diamond(
          g,
          p.shell.x + Math.cos(spin) * 74,
          p.shell.y + Math.sin(spin) * 40,
          isHot ? 7 : 4.5,
          PRISM_COLORS[i],
          isHot ? 1 : 0.55,
          spin,
        );
        // the projected fan: a soft ray from the shell into each slice, the striking one bright
        const ex = w.x + Math.cos(a) * w.radius * 0.55,
          ey = w.y + Math.sin(a) * w.radius * 0.55;
        fx.floor
          .lineStyle(isHot ? 9 : 3, PRISM_COLORS[i], (isHot ? 0.38 : 0.1) * k)
          .lineBetween(p.shell.x, p.shell.y, ex, ey);
      }
    } else if (w.kind === "glare") {
      // the shell's light swells, ring after ring
      glow(p.shell.x, p.shell.y, 40 + 50 * k, WHITE, 0.15 + 0.35 * k);
      for (let i = 0; i < 2; i++) {
        const u = (k * 3 + i * 0.5) % 1;
        g.lineStyle(3, 0xfff6d8, (1 - u) * 0.7 * k).strokeEllipse(
          p.shell.x,
          p.shell.y,
          60 + u * 120,
          50 + u * 100,
        );
      }
    } else if (w.kind === "halo-crush") {
      // a golden halo lifts off the shell, hangs, then flies to its mark
      const rise = clamp(k / 0.3),
        go = clamp((k - 0.3) / 0.7),
        e = go * go * (3 - 2 * go);
      const sx = p.shellTop.x,
        sy = p.shellTop.y - 26 * rise;
      const hx = sx + (w.x - sx) * e,
        hy = sy + (w.y - 70 - sy) * e - Math.sin(e * Math.PI) * 60;
      const rx = 20 + 30 * e,
        ry = rx * 0.38;
      g.lineStyle(7, GOLD, 0.35 * rise).strokeEllipse(hx, hy, rx * 2, ry * 2);
      g.lineStyle(3, 0xfffbe0, 0.95 * rise).strokeEllipse(
        hx,
        hy,
        rx * 2,
        ry * 2,
      );
      const n = low ? 3 : 6;
      for (let i = 0; i < n; i++) {
        const a = (i * TAU) / n + t * 2;
        diamond(
          g,
          hx + Math.cos(a) * rx,
          hy + Math.sin(a) * ry,
          3.5,
          PRISM_COLORS[i % 6],
          rise,
          a,
        );
      }
      glow(hx, hy, rx + 10, GOLD, 0.4 * rise);
      // its shadow on the floor, closing on the mark
      fx.floor
        .lineStyle(2, 0xffe6a0, 0.3 * e)
        .strokeEllipse(w.x, w.y, rx * 2.4, rx * 0.9);
    }
  }
  // ── the casts (none with reduced motion: the performance sends none) ──
  for (const c of casts) {
    const u = c.age;
    if ((c.kind === "prism-lance" || c.kind === "refraction") && u < 0.45) {
      const a = 1 - u / 0.45;
      const from = fromBoss(c) ? p.heart : { x: c.x, y: c.y - 20 };
      prismBeam(fx, glow, from, { x: c.tx, y: c.ty }, 22, a, low);
      if (u < 0.12)
        fx.trail(`prismell-lance-${c.id}`, 1, () =>
          fx.burst({
            x: c.tx,
            y: c.ty,
            count: low ? 6 : 12,
            kind: "spark",
            color: PRISM_COLORS.slice(0, 6),
            speed: [60, 220],
            up: [40, 160],
            life: [0.3, 0.6],
            size: [2, 4],
            grav: 300,
          }),
        );
    } else if (c.kind === "fan-display" && u < 0.65) {
      const fan = memo.fans.get(c.id) ?? { index: 0, count: 6 };
      const a = 1 - u / 0.65,
        mid = (fan.index * TAU) / fan.count,
        half = Math.PI / fan.count,
        hot = PRISM_COLORS[fan.index];
      // the striking slice flares: a sheet of its colour sweeping out
      const reach = c.radius * Math.min(1, 0.35 + u * 2.4);
      const pts: Pt[] = [{ x: c.x, y: c.y }];
      for (let j = 0; j <= 12; j++) {
        const ang = mid - half + (2 * half * j) / 12;
        pts.push({
          x: c.x + Math.cos(ang) * reach,
          y: c.y + Math.sin(ang) * reach,
        });
      }
      fx.floor.fillStyle(hot, 0.3 * a).fillPoints(pts, true);
      fx.floor.lineStyle(3, 0xffffff, 0.7 * a).strokePoints(pts, true);
      const n = low ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const ang = mid - half * 0.8 + (1.6 * half * i) / (n - 1),
          d = reach * (0.5 + 0.5 * ((u * 3 + i * 0.37) % 1));
        g.lineStyle(4, 0xffffff, 0.8 * a).lineBetween(
          c.x + Math.cos(ang) * d * 0.7,
          c.y + Math.sin(ang) * d * 0.7,
          c.x + Math.cos(ang) * d,
          c.y + Math.sin(ang) * d,
        );
      }
      glow(p.shell.x, p.shell.y, 60, hot, 0.45 * a);
    } else if (c.kind === "glare" && u < 0.55) {
      const a = 1 - u / 0.55;
      glow(p.shell.x, p.shell.y, 110 + 120 * u, WHITE, 0.6 * a);
      g.lineStyle(6, 0xfff6d8, 0.8 * a).strokeEllipse(
        p.shell.x,
        p.shell.y,
        120 + u * 1400,
        100 + u * 1100,
      );
    } else if (c.kind === "halo-crush" && u < 0.5) {
      const a = 1 - u / 0.5;
      g.lineStyle(8, GOLD, 0.8 * a).strokeEllipse(
        c.x,
        c.y,
        (c.radius + u * 160) * 2,
        (c.radius + u * 160) * 1.25,
      );
      if (u < 0.1)
        fx.trail(`prismell-halo-${c.id}`, 1, () =>
          fx.burst({
            x: c.x,
            y: c.y,
            count: low ? 8 : 16,
            kind: "debris",
            color: [GOLD, ...SHARD],
            speed: [80, 240],
            up: [80, 220],
            life: [0.4, 0.8],
            size: [2.5, 4.5],
            grav: 520,
          }),
        );
    }
  }
  for (const id of memo.fans.keys())
    if (!s.warnings.some((w) => w.id === id) && !casts.some((c) => c.id === id))
      memo.fans.delete(id);
  // ── the shield shatters when the relay reaches the heart ──
  if (p.open > 0.5 && memo.open <= 0.5) {
    fx.burst({
      x: p.heart.x,
      y: p.heart.y,
      count: low ? 8 : 16,
      kind: "debris",
      color: SHARD,
      speed: [60, 200],
      up: [60, 180],
      life: [0.4, 0.8],
      size: [2.5, 4.5],
      grav: 420,
    });
  }
  memo.open = p.open;
  // ── the scramble cue: the shell winks pink at each mirror about to turn ──
  for (const [i, m] of (s.mirrors ?? []).entries()) {
    if (!m.scrambleAt || m.scrambleAt <= t || s.dead) continue;
    const blink = 0.5 + 0.5 * Math.sin(t * 9 + i);
    glow(p.shellTop.x, p.shellTop.y + 8, 16, PINK, 0.3 + 0.4 * blink);
    for (let j = 0; j < (low ? 2 : 3); j++) {
      const f = (t * 0.9 + j / 3 + i * 0.13) % 1;
      const x = p.shellTop.x + (m.x - p.shellTop.x) * f,
        y =
          p.shellTop.y +
          (m.y - 30 - p.shellTop.y) * f -
          Math.sin(f * Math.PI) * 40;
      diamond(g, x, y, 4, PINK, (1 - f) * 0.9, f * 6);
    }
  }
  // ── showing off: sparkles drift up off the shell ──
  if (p.shine > 0.6 && !s.dead)
    fx.trail("prismell-show", 0.12, () =>
      fx.burst({
        x: p.shell.x,
        y: p.shell.y - 20,
        count: low ? 1 : 2,
        kind: "mote",
        color: PRISM_COLORS.slice(0, 6),
        speed: [20, 60],
        up: [30, 80],
        life: [0.6, 1],
        size: [2, 3],
      }),
    );
  // ── beaten: the last of the light drifts out of the dim shell ──
  if (s.dead && p.dim > 0.3 && p.dim < 0.99)
    fx.trail("prismell-dim", 0.3, () =>
      fx.burst({
        x: p.shell.x,
        y: p.shell.y,
        count: 1,
        kind: "mote",
        color: [0xd8d0f0, 0xb8b0d0],
        speed: [4, 14],
        up: [20, 40],
        life: [1, 1.6],
        size: [2, 3],
      }),
    );
}

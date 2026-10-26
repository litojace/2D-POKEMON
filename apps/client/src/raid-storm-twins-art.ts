import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossSurface } from "./boss-materials";
import { bossLife, bossEye } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  STORM_TWINS as S,
  stormBeamPoints,
  type RaidWarning,
  type StormPoint,
} from "../../../packages/shared/src/raid";
import type { RaidBossCue } from "./raid-boss-motion";
import type { LayerAt } from "./raid-layers";
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
function bolt(g: G, a: StormPoint, b: StormPoint, color: number, alpha = 1) {
  const dx = b.x - a.x,
    dy = b.y - a.y,
    len = Math.hypot(dx, dy) || 1,
    points = Array.from({ length: 9 }, (_, i) => ({
      x: a.x + (dx * i) / 8 + (i % 2 ? (-dy / len) * 8 : 0),
      y: a.y + (dy * i) / 8 + (i % 2 ? (dx / len) * 8 : 0),
    }));
  g.lineStyle(9, color, alpha * 0.16).strokePoints(points, false);
  g.lineStyle(2.5, color, alpha).strokePoints(points, false);
}
function sign(
  g: G,
  x: number,
  y: number,
  value: number,
  color: number,
  size = 10,
) {
  g.lineStyle(3, color, 1).lineBetween(x - size, y, x + size, y);
  if (value > 0) g.lineBetween(x, y - size, x, y + size);
}
export function drawConductorRing(g: G, state: Snapshot, reduced: boolean, at?: LayerAt) {
  const r = state.raid!,
    t = reduced ? 0 : state.time;
  for (const [i, p] of S.posts.entries()) {
    g.fillStyle(0x15253c, 0.6).fillEllipse(p.x, p.y + 12, 68, 26);
    // The post itself stands up, so it sorts with the raiders.
    const post = at ? at(`post-${i}`, p.y + 17) : g;
    post.fillStyle(0x866958, 1).fillRoundedRect(p.x - 13, p.y - 22, 26, 39, 5);
    post.fillStyle(0xa98a6e, 1).fillRoundedRect(p.x - 13, p.y - 22, 9, 39, 4);
    post.lineStyle(4, 0xe6b985, 0.9).strokeEllipse(p.x, p.y - 22, 32, groundHeight(32));
    post.fillStyle(0xffd78b, 0.2).fillCircle(p.x, p.y - 22, 15);
  }
  for (const f of r.stormFields ?? []) {
    g.fillStyle(0x7d9fff, 0.14).fillCircle(f.x, f.y, f.radius);
    g.lineStyle(3, 0xa5c8ff, 0.85).strokeCircle(f.x, f.y, f.radius);
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3 + t * 0.4;
      bolt(
        g,
        {
          x: f.x - Math.cos(a) * f.radius * 0.7,
          y: f.y - Math.sin(a) * f.radius * 0.7,
        },
        {
          x: f.x + Math.cos(a) * f.radius * 0.7,
          y: f.y + Math.sin(a) * f.radius * 0.7,
        },
        0x9dcfff,
        0.45,
      );
    }
  }
  const [a, b] = state.players.filter((p) => p.raidBoss);
  if (a && b && a.hp > 0 && b.hp > 0 && !r.stormBeam) {
    g.lineStyle(2, 0xa3dfff, 0.2).lineBetween(a.x, a.y, b.x, b.y);
  }
  if (r.stormBeam)
    for (let i = 1; i < r.stormBeam.points.length; i++) {
      const from = r.stormBeam.points[i - 1],
        to = r.stormBeam.points[i];
      g.lineStyle(S.link.width * 2, 0xffdc8d, 0.12).lineBetween(
        from.x,
        from.y,
        to.x,
        to.y,
      );
      bolt(g, from, to, i % 2 ? 0xffe18b : 0x9ce4ff);
    }
  if (r.stormChain && r.stormChain.until > state.time)
    for (let i = 1; i < r.stormChain.points.length; i++)
      bolt(g, r.stormChain.points[i - 1], r.stormChain.points[i], 0xaddfff);
  const pad = r.polarityPad;
  if (pad) {
    g.fillStyle(pad.sign > 0 ? 0xffd579 : 0x8adfff, 0.13).fillCircle(
      pad.x,
      pad.y,
      S.polarity.padRadius,
    );
    g.lineStyle(4, pad.sign > 0 ? 0xffd579 : 0x8adfff, 1).strokeCircle(
      pad.x,
      pad.y,
      S.polarity.padRadius,
    );
    sign(g, pad.x, pad.y, pad.sign, pad.sign > 0 ? 0xffd579 : 0x8adfff, 16);
  }
  for (const m of r.polarities ?? []) {
    const p = state.players.find((p) => p.id === m.playerId);
    if (!p || p.hp <= 0) continue;
    const color = m.cancelled ? 0x8de8cf : m.sign > 0 ? 0xffda85 : 0x8edfff,
      y = p.y - 100;
    g.fillStyle(0x12233a, 0.95).fillCircle(p.x, y, 23);
    g.lineStyle(3, color, 1).strokeCircle(p.x, y, 23);
    if (m.cancelled)
      g.lineStyle(3, color, 1)
        .lineBetween(p.x - 10, y, p.x - 2, y + 8)
        .lineBetween(p.x - 2, y + 8, p.x + 12, y - 9);
    else {
      sign(g, p.x, y, m.sign, color);
      const progress = Math.max(0, (m.until - state.time) / S.polarity.seconds);
      g.lineStyle(4, color, 0.6)
        .beginPath()
        .arc(p.x, y, 29, -Math.PI / 2, -Math.PI / 2 + progress * TAU, false)
        .strokePath();
    }
  }
}
export function drawStormWarning(g: G, state: Snapshot, w: RaidWarning) {
  const progress = Math.max(
    0,
    Math.min(
      1,
      (state.time - (w.startedAt ?? state.time)) /
        Math.max(0.01, w.at - (w.startedAt ?? state.time)),
    ),
  );
  if (w.kind === "link-beam") {
    const points = stormBeamPoints(w, { x: w.tx, y: w.ty }, w.beamPost);
    for (let i = 1; i < points.length; i++) {
      g.lineStyle(
        S.link.width * 2,
        0xff7799,
        0.12 + progress * 0.15,
      ).lineBetween(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y);
      g.lineStyle(3, 0xffbdc9, 1).lineBetween(
        points[i - 1].x,
        points[i - 1].y,
        points[i].x,
        points[i].y,
      );
    }
    return true;
  }
  if (w.kind === "twin-rush") {
    const dx = w.tx - w.x,
      dy = w.ty - w.y,
      len = Math.hypot(dx, dy) || 1,
      nx = (-dy / len) * w.radius,
      ny = (dx / len) * w.radius;
    g.fillStyle(0xff6f95, 0.13 + progress * 0.16).fillPoints(
      [
        { x: w.x + nx, y: w.y + ny },
        { x: w.tx + nx, y: w.ty + ny },
        { x: w.tx - nx, y: w.ty - ny },
        { x: w.x - nx, y: w.y - ny },
      ],
      true,
    );
    g.lineStyle(3, 0xffbdc9, 1)
      .lineBetween(w.x + nx, w.y + ny, w.tx + nx, w.ty + ny)
      .lineBetween(w.x - nx, w.y - ny, w.tx - nx, w.ty - ny);
    return true;
  }
  if (["chain-lightning", "static-field", "thunderclap"].includes(w.kind)) {
    const chain = w.kind === "chain-lightning",
      color = chain ? 0xffdc85 : 0xabc7ff;
    g.fillStyle(color, 0.06 + progress * 0.14).fillCircle(w.x, w.y, w.radius);
    g.lineStyle(3, color, 0.85).strokeCircle(w.x, w.y, w.radius);
    g.lineStyle(4, color, 1)
      .beginPath()
      .arc(
        w.x,
        w.y,
        w.radius,
        -Math.PI / 2,
        -Math.PI / 2 + progress * TAU,
        false,
      )
      .strokePath();
    if (chain) sign(g, w.x, w.y - 95, 1, 0xffe18b, 11);
    return true;
  }
  return w.kind === "polarity";
}
interface Memory {
  time: number;
  clock: number;
  serverTime: number;
  seed: number;
  hp: Map<string, number>;
  result: unknown;
}
const memories = new WeakMap<G, Memory>();
export function drawStormTwins(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
  at?: LayerAt,
): RaidBossCue[] {
  const r = state.raid!;
  const memory = g;
  let m = memories.get(g);
  if (
    !m ||
    m.seed !== r.seed ||
    state.time < m.serverTime ||
    (m.result && !r.result)
  ) {
    m = {
      time: 0,
      clock,
      serverTime: state.time,
      seed: r.seed,
      hp: new Map(),
      result: r.result,
    };
    memories.set(g, m);
  }
  const dt =
    state.phase === "paused" ? 0 : Math.max(0, Math.min(0.05, clock - m.clock));
  m.time += dt;
  m.clock = clock;
  m.serverTime = state.time;
  const t = reduced ? 0 : m.time,
    cues: RaidBossCue[] = [];
  for (const [i, meta] of (r.twins ?? []).entries()) {
    const p = state.players.find((p) => p.id === meta.id);
    if (!p) continue;
    const old = m.hp.get(p.id);
    if (old !== undefined && p.hp < old)
      cues.push(
        p.hp <= 0 ? "fall" : meta.exposedUntil > state.time ? "core" : "chip",
      );
    if (old === 0 && p.hp > 0) cues.push("awaken");
    m.hp.set(p.id, p.hp);
    const life = bossLife(memory, state, p, clock, reduced);
    // Each twin draws on its own layer, sorted with the raiders by where it stands.
    const g = at ? at(`twin-${i}`, p.y + 13) : memory;
    const down = p.hp <= 0,
      x = p.x;
    const pulse = Math.sin(t * (i ? 2.5 : 3.4) + i) * life.move;
    const y = p.y - 52 + life.breath * 5 + life.windup * 7;
    const body = i ? 0x72bde6 : r.gilded ? 0xffd277 : 0xf4d675;
    const alpha = down ? 0.35 : 1;
    g.fillStyle(0x0e1a30, 0.27).fillEllipse(x, p.y + 13, 117, 30);
    // Bell contraction drives the tendrils: each tip follows with a small delay.
    for (let j = 0; j < 5; j++) {
      const bx = x - 36 + j * 18;
      const lag =
        Math.sin(t * (i ? 2.5 : 3.4) - j * 0.3 - 0.7 + i) * 7 * life.move;
      g.lineStyle(8, i ? 0x508dbb : 0xc09c56, alpha)
        .beginPath()
        .moveTo(bx, y + 24)
        .lineTo(bx + lag * 0.65, y + 44 + pulse * 2)
        .lineTo(bx + lag, y + 61 - pulse * 3 + (j % 2) * 5)
        .lineTo(bx - lag * 0.2, y + 72 - pulse * 4)
        .strokePath();
      g.lineStyle(2, i ? 0xd5f2ff : 0xfff1ba, alpha * 0.6).lineBetween(
        bx + lag,
        y + 52,
        bx + lag * 0.5,
        y + 65 - pulse * 3,
      );
      g.fillStyle(i ? 0xc4ecff : 0xffefad, alpha).fillCircle(
        bx - lag * 0.2,
        y + 72 - pulse * 4,
        4,
      );
    }
    const width = 130 + pulse * 5,
      height = 98 - pulse * 4 - life.windup * 5;
    g.fillStyle(i ? 0x325d85 : 0x8c713e, alpha).fillEllipse(
      x,
      y + 2,
      width + 4,
      height + 4,
    );
    bossSurface(g, x, y, width, height, body, "cloud", alpha);
    g.fillStyle(i ? 0x9ed9ed : 0xffe9a2, alpha).fillEllipse(
      x - 12,
      y - 15,
      92,
      55,
    );
    g.fillStyle(i ? 0xe0f6ff : 0xfff7d8, alpha * 0.4).fillEllipse(
      x - 27,
      y - 23,
      32,
      13,
    );
    // The cloud cap billows independently, with a raised lightning crest.
    for (let k = 0; k < 4; k++) {
      const cx = x - 35 + k * 26,
        cy =
          y -
          39 -
          Math.sin((k * Math.PI) / 3) * 12 +
          Math.sin(t * 1.5 + k + i) * 2 * life.move;
      g.fillStyle(i ? 0x8eb9d9 : 0xd6bf7f, alpha).fillCircle(
        cx,
        cy + 3,
        19 + (k % 2) * 4,
      );
      const diameter = (18 + (k % 2) * 4) * 2;
      bossSurface(g, cx - 1, cy, diameter, diameter, i ? 0xd8e9f4 : 0xfff3cf, "cloud", alpha);
    }
    const boltColor = i ? 0x5e83c4 : 0xc99341;
    g.fillStyle(boltColor, alpha).fillPoints(
      [
        { x: x + 1, y: y - 71 },
        { x: x - 13, y: y - 47 },
        { x: x - 2, y: y - 47 },
        { x: x - 8, y: y - 28 },
        { x: x + 17, y: y - 54 },
        { x: x + 4, y: y - 54 },
      ],
      true,
    );
    for (const side of [-1, 1]) {
      const ex = x + side * 23 + life.lookX * 2,
        ey = y - 4;
      if (down) {
        g.lineStyle(3, 0x243752, 0.8)
          .lineBetween(ex - 5, ey - 4, ex + 5, ey + 4)
          .lineBetween(ex + 5, ey - 4, ex - 5, ey + 4);
      } else {
        bossEye(
          g,
          ex,
          ey,
          i ? 13 : 15,
          i ? 13 : 20,
          life,
          i ? 0x345985 : 0x78552b,
          alpha,
        );
        g.lineStyle(3, 0x51637b, alpha).lineBetween(
          x + side * 14,
          y - 16 - life.windup * 3,
          x + side * 31,
          y - (i ? 15 : 20),
        );
        g.fillStyle(i ? 0x92c9e5 : 0xf0bb75, alpha * 0.8).fillEllipse(
          x + side * 37,
          y + 8,
          12,
          6,
        );
      }
    }
    g.lineStyle(2.8, 0x476079, alpha)
      .beginPath()
      .arc(
        x + life.lookX * 2,
        y + 13,
        9,
        i ? Math.PI : 0,
        i ? TAU : Math.PI,
        false,
      )
      .strokePath();
    if (!down && life.windup > 0.15)
      sign(g, x + 47, y - 28, 0.8, i ? 0xc7edff : 0xffed9d, 9);
    if (meta.exposedUntil > state.time && !down) {
      g.fillStyle(0xeaffef, 0.18).fillCircle(x, y + 18, 24);
      g.lineStyle(2.5, 0xafffe1, 0.9).strokeCircle(x, y + 18, 25);
      sign(g, x, y + 18, 1, 0xeaffef, 10);
    }
  }
  m.result = r.result;
  return cues;
}

import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossSurface } from "./boss-materials";
import { bossLife, bossEye } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  SOMNARA,
  quietZoneAt,
  type DreamRune,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import type { RaidBossCue } from "./raid-boss-motion";
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
const colors: Record<DreamRune, number> = {
  circle: 0x92efdb,
  star: 0xffdf8d,
  moon: 0xd1b2ff,
  wave: 0x8bceff,
};
const star = (
  g: G,
  x: number,
  y: number,
  radius: number,
  color: number,
  alpha = 1,
) => {
  const points = Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5 - Math.PI / 2,
      r = i % 2 ? radius * 0.45 : radius;
    return { x: x + Math.cos(a) * r, y: y + Math.sin(a) * r };
  });
  g.fillStyle(color, alpha).fillPoints(points, true);
};
export function drawDreamRune(
  g: G,
  rune: DreamRune,
  x: number,
  y: number,
  size = 18,
  alpha = 1,
) {
  const color = colors[rune];
  g.lineStyle(3, color, alpha);
  if (rune === "circle") g.strokeCircle(x, y, size * 0.7);
  else if (rune === "star") star(g, x, y, size, color, alpha);
  else if (rune === "moon") {
    g.fillStyle(color, alpha).fillCircle(x, y, size * 0.8);
    g.fillStyle(0x263251, alpha).fillCircle(
      x + size * 0.45,
      y - size * 0.3,
      size * 0.7,
    );
  } else
    for (const row of [-5, 5]) {
      const points = Array.from({ length: 16 }, (_, i) => ({
        x: x - size + (i * size * 2) / 15,
        y: y + row + Math.sin((i * Math.PI * 2) / 15) * 4,
      }));
      g.strokePoints(points, false);
    }
}
function note(
  g: G,
  x: number,
  y: number,
  s: number,
  color: number,
  alpha: number,
) {
  g.fillStyle(color, alpha).fillEllipse(x, y, 9 * s, 6 * s);
  g.lineStyle(2 * s, color, alpha)
    .lineBetween(x + 4 * s, y, x + 4 * s, y - 16 * s)
    .lineBetween(x + 4 * s, y - 16 * s, x + 11 * s, y - 12 * s);
}
export function drawCloudDeck(g: G, state: Snapshot, reduced: boolean) {
  const r = state.raid!,
    t = reduced ? 0 : state.time;
  const called = [...(r.runeCalls ?? [])]
    .reverse()
    .find((c) => c.until > state.time);
  for (const pad of SOMNARA.pads) {
    const hot = called?.rune === pad.rune;
    g.fillStyle(0x0e1732, 0.8).fillEllipse(
      pad.x,
      pad.y + 8,
      140,
      groundHeight(140),
    );
    g.fillStyle(colors[pad.rune], hot ? 0.24 : 0.09).fillCircle(
      pad.x,
      pad.y,
      SOMNARA.padRadius,
    );
    // This boundary is the exact radius used for entering a pad.
    g.lineStyle(hot ? 4 : 2, colors[pad.rune], hot ? 1 : 0.55).strokeCircle(
      pad.x,
      pad.y,
      SOMNARA.padRadius,
    );
    g.lineStyle(1, colors[pad.rune], 0.28).strokeCircle(
      pad.x,
      pad.y,
      SOMNARA.padRadius + 9,
    );
    drawDreamRune(g, pad.rune, pad.x, pad.y, 24);
    if (hot)
      for (let i = 0; i < 4; i++)
        star(
          g,
          pad.x + Math.cos((i * Math.PI) / 2 + t) * 70,
          pad.y + Math.sin((i * Math.PI) / 2 + t) * 70,
          4,
          colors[pad.rune],
          0.9,
        );
  }
  for (const trail of r.dreamTrails ?? []) {
    g.fillStyle(0x5c3a93, 0.2).fillCircle(trail.x, trail.y, 45);
    g.lineStyle(2, 0xc9a3ff, 0.4).strokeCircle(trail.x, trail.y, 45);
  }
  if (r.quietZone) {
    const q = quietZoneAt(r.quietZone, state.time),
      radius = r.quietZone.radius;
    g.fillStyle(0xd44c7d, 0.1).fillRect(0, 0, 1600, 900);
    g.fillStyle(0x92efdb, 0.23).fillCircle(q.x, q.y, radius);
    g.lineStyle(4, 0x92efdb, 1).strokeCircle(q.x, q.y, radius);
    g.lineStyle(2, 0xd9fff1, 0.7).strokeCircle(q.x, q.y, radius - 9);
    note(g, q.x - 8, q.y, 2, 0xd9fff1, 0.8);
  }
  for (const ring of r.dreamRings ?? [])
    if (ring.startedAt <= state.time) {
      g.lineStyle(SOMNARA.lullaby.width * 2, 0xbd9fff, 0.13).strokeCircle(
        ring.x,
        ring.y,
        ring.radius,
      );
      g.lineStyle(3, 0xe7d7ff, 0.85).strokeCircle(
        ring.x,
        ring.y,
        ring.radius + SOMNARA.lullaby.width,
      );
      g.lineStyle(2, 0xbda2ff, 0.6).strokeCircle(
        ring.x,
        ring.y,
        Math.max(1, ring.radius - SOMNARA.lullaby.width),
      );
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + t * 0.15;
        note(
          g,
          ring.x + Math.cos(a) * ring.radius,
          ring.y + Math.sin(a) * ring.radius,
          0.8,
          0xe7d7ff,
          0.7,
        );
      }
    }
  for (const b of r.dreamBubbles ?? []) {
    g.fillStyle(0xd3b5ff, 0.15).fillCircle(b.x, b.y, SOMNARA.bubbles.radius);
    g.lineStyle(2.5, 0xc9a3ff, 0.95).strokeCircle(
      b.x,
      b.y,
      SOMNARA.bubbles.radius,
    );
    g.fillStyle(0xffffff, 0.7).fillEllipse(b.x - 8, b.y - 9, 8, 5);
    star(g, b.x, b.y + 1, 7, 0xffe2a0, 0.9);
  }
  for (const p of state.players) {
    if (p.raidBoss || p.hp <= 0) continue;
    const d = r.drowsy?.[p.id];
    if (d) {
      for (let i = 0; i < 3; i++)
        g.fillStyle(i < d.stacks ? 0xc9a3ff : 0x19233f, 1).fillCircle(
          p.x - 14 + i * 14,
          p.y - 103,
          5,
        );
      if (d.sleepUntil > state.time) {
        const y = p.y - 130 + Math.sin(t * 2) * 3;
        g.lineStyle(3, 0xe4d8ff, 1)
          .lineBetween(p.x - 8, y, p.x + 8, y)
          .lineBetween(p.x + 8, y, p.x - 8, y + 14)
          .lineBetween(p.x - 8, y + 14, p.x + 8, y + 14);
      }
    }
    const call = [...(r.runeCalls ?? [])]
      .reverse()
      .find((c) => c.playerId === p.id && c.until > state.time);
    if (call) {
      g.fillStyle(0x111c35, 0.95).fillRoundedRect(
        p.x + 25,
        p.y - 113,
        44,
        42,
        10,
      );
      drawDreamRune(g, call.rune, p.x + 47, p.y - 92, 13);
    }
  }
  const view = state.raidDream,
    dreamer = state.players.find((p) => p.id === r.dream?.dreamerId);
  if (view && r.dream && view.id === r.dream.id && dreamer) {
    const width = view.runes.length * 34 + 16;
    const y = dreamer.y - 147;
    g.fillStyle(0x121c36, 0.96).fillRoundedRect(
      dreamer.x - width / 2,
      y - 23,
      width,
      40,
      10,
    );
    g.lineStyle(1.5, 0xc9a3ff, 0.8).strokeRoundedRect(
      dreamer.x - width / 2,
      y - 23,
      width,
      40,
      10,
    );
    view.runes.forEach((rune, i) =>
      drawDreamRune(
        g,
        rune,
        dreamer.x + (i - (view.runes.length - 1) / 2) * 34,
        y - 3,
        11,
      ),
    );
    if (view.backwards)
      g.lineStyle(3, 0xffdf8d, 1)
        .lineBetween(
          dreamer.x + width / 2 - 8,
          y - 33,
          dreamer.x - width / 2 + 8,
          y - 33,
        )
        .lineBetween(
          dreamer.x - width / 2 + 8,
          y - 33,
          dreamer.x - width / 2 + 16,
          y - 39,
        );
  }
}
export function drawSomnaraWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  _reduced: boolean,
) {
  const p = Math.max(
    0,
    Math.min(
      1,
      (state.time - (w.startedAt ?? state.time)) /
        Math.max(0.01, w.at - (w.startedAt ?? state.time)),
    ),
  );
  const danger = 0xff647f,
    edge = 0xffafbf;
  if (w.kind === "tail-splash") {
    const dx = w.tx - w.x,
      dy = w.ty - w.y,
      length = Math.hypot(dx, dy) || 1;
    const nx = (-dy / length) * w.radius,
      ny = (dx / length) * w.radius;
    g.fillStyle(danger, 0.13 + p * 0.16)
      .fillPoints(
        [
          { x: w.x + nx, y: w.y + ny },
          { x: w.tx + nx, y: w.ty + ny },
          { x: w.tx - nx, y: w.ty - ny },
          { x: w.x - nx, y: w.y - ny },
        ],
        true,
      )
      .fillCircle(w.x, w.y, w.radius)
      .fillCircle(w.tx, w.ty, w.radius);
    g.lineStyle(3, edge, 1)
      .lineBetween(w.x + nx, w.y + ny, w.tx + nx, w.ty + ny)
      .lineBetween(w.x - nx, w.y - ny, w.tx - nx, w.ty - ny);
    return true;
  }
  if (w.kind === "falling-stars") {
    g.fillStyle(danger, 0.1 + p * 0.2).fillCircle(w.x, w.y, w.radius);
    g.lineStyle(3, edge, 1).strokeCircle(w.x, w.y, w.radius);
    star(g, w.x, w.y - 65 * (1 - p), 16, 0xffdf8d, p < 0.5 ? 1 : 0.5);
    return true;
  }
  if (w.kind === "lullaby" || w.kind === "dream-bubbles") {
    g.lineStyle(3, 0xd4b7ff, 0.8).strokeCircle(w.x, w.y, 80 + p * 20);
    note(g, w.x - 5, w.y - 130, 1.7, 0xffdf8d, 0.9);
    return true;
  }
  return w.kind === "whale-song";
}
interface WhaleMemory {
  serverTime: number;
  seed: number;
  hp: number;
  exposed: boolean;
  result: unknown;
  clock: number;
  time: number;
  hurtUntil: number;
  deathAt?: number;
}
const memory = new WeakMap<G, WhaleMemory>();
export function drawSomnara(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
): RaidBossCue[] {
  const r = state.raid!,
    boss = state.players.find((p) => p.id === r.bossId);
  if (!boss) return [];
  let m = memory.get(g);
  if (
    !m ||
    m.seed !== r.seed ||
    state.time < m.serverTime ||
    (m.result === "victory" && r.result !== "victory")
  ) {
    m = {
      seed: r.seed,
      serverTime: state.time,
      hp: boss.hp,
      exposed: false,
      result: null,
      clock,
      time: 0,
      hurtUntil: 0,
    };
    memory.set(g, m);
  }
  m.serverTime = state.time;
  const dt = Math.max(0, Math.min(0.05, clock - m.clock));
  m.clock = clock;
  if (state.phase === "playing" || state.phase === "finished") m.time += dt;
  const exposed = r.exposedUntil > state.time || r.staggerUntil > state.time;
  const cues: RaidBossCue[] = [];
  if (boss.hp < m.hp && boss.hp > 0) {
    m.hurtUntil = m.time + 0.12;
    cues.push(exposed ? "core" : "chip");
  }
  if (exposed && !m.exposed) cues.push("awaken");
  if (r.result === "victory" && m.result !== "victory") {
    m.deathAt = m.time;
    cues.push("fall");
  }
  m.hp = boss.hp;
  m.exposed = exposed;
  m.result = r.result;
  const life = bossLife(g, state, boss, clock, reduced),
    t = life.time;
  const farewell =
    m.deathAt === undefined
      ? 0
      : reduced
        ? 1
        : Math.min(1, (m.time - m.deathAt) / 1.25);
  const x = boss.x,
    y = boss.y - 62 + life.breath * 6 - farewell * 90 + life.windup * 4;
  const alpha = 1 - farewell * 0.7;
  const skin = m.time < m.hurtUntil ? 0xb49bdd : r.gilded ? 0xa18b69 : 0x8977c5;
  g.fillStyle(0x08102a, 0.27 * (1 - farewell)).fillEllipse(
    x,
    boss.y + 26,
    217,
    49,
  );
  // A hinged tail stock and two flukes follow the whale's slow swimming stroke.
  const stroke = Math.sin(t * 1.65) * life.move;
  g.save()
    .translateCanvas(x + 105, y + 5)
    .rotateCanvas(stroke * 0.13 - life.windup * 0.12);
  g.fillStyle(0x51447e, alpha).fillEllipse(20, 0, 69, 38);
  for (const side of [-1, 1]) {
    g.save()
      .translateCanvas(42, 0)
      .rotateCanvas(side * (0.35 + stroke * 0.07));
    g.fillStyle(0x68558f, alpha).fillTriangle(
      0,
      0,
      36,
      side * 49,
      49,
      side * 12,
    );
    g.lineStyle(2, 0xc3b3eb, alpha * 0.55).lineBetween(9, 0, 35, side * 25);
    g.restore();
  }
  g.restore();
  // The far flipper stays behind a softly shaded, breathing body.
  g.save()
    .translateCanvas(x - 18, y + 27)
    .rotateCanvas(-0.35 - stroke * 0.18);
  g.fillStyle(0x5d508d, alpha).fillEllipse(0, 25, 48, 73);
  g.restore();
  g.fillStyle(0x283452, alpha).fillEllipse(x, y, 255, 146);
  bossSurface(g, x, y, 250, 144, skin, "velvet", alpha);
  g.fillStyle(0xa797d7, alpha * 0.8).fillEllipse(x - 17, y - 28, 195, 72);
  g.fillStyle(0xcbbbea, alpha).fillEllipse(x - 9, y + 30, 211, 72);
  // Pleated throat and a second flipper make the silhouette read as a whale.
  for (let i = 0; i < 4; i++)
    g.lineStyle(1.8, 0x9d8bc7, alpha * 0.5)
      .beginPath()
      .arc(x - 50 + i * 17, y + 21, 27, 0.25, Math.PI - 0.25, false)
      .strokePath();
  g.save()
    .translateCanvas(x + 18, y + 35)
    .rotateCanvas(0.45 + stroke * 0.2 + life.windup * 0.2);
  g.fillStyle(0x675695, alpha).fillEllipse(14, 22, 70, 33);
  g.fillStyle(0x9981c4, alpha).fillEllipse(11, 17, 58, 20);
  g.lineStyle(2, 0xc3b3eb, alpha * 0.5).lineBetween(0, 19, 32, 24);
  g.restore();
  // A tiny lived-in cottage rides the back, with a pendulum nightcap and warm windows.
  g.fillStyle(0x53678a, alpha).fillEllipse(x + 13, y - 66, 120, 31);
  g.fillStyle(0x99c6bf, alpha).fillEllipse(x + 13, y - 73, 118, 19);
  g.fillStyle(0xf0d6b9, alpha).fillRoundedRect(x - 8, y - 115, 43, 36, 4);
  g.fillStyle(0x64729f, alpha).fillTriangle(
    x - 17,
    y - 112,
    x + 14,
    y - 142,
    x + 45,
    y - 112,
  );
  g.lineStyle(2, 0xb7c6dd, alpha * 0.7).lineBetween(
    x - 17,
    y - 112,
    x + 14,
    y - 142,
  );
  g.fillStyle(exposed || farewell ? 0xffdc85 : 0xd5c1a0, alpha).fillRoundedRect(
    x + 3,
    y - 104,
    16,
    17,
    3,
  );
  g.lineStyle(1.5, 0x64729f, alpha)
    .lineBetween(x + 11, y - 104, x + 11, y - 87)
    .lineBetween(x + 3, y - 96, x + 19, y - 96);
  const cap = life.sway * 4;
  g.fillStyle(0x5f508c, alpha).fillTriangle(
    x - 87,
    y - 62,
    x - 33,
    y - 73,
    x - 94 + cap,
    y - 118,
  );
  g.fillStyle(0xd3d8ed, alpha).fillEllipse(x - 61, y - 73, 69, 22);
  g.fillStyle(0xffe6a8, alpha).fillCircle(x - 94 + cap, y - 117, 9);
  star(g, x - 94 + cap, y - 117, 5, 0xfff8dc, alpha);
  for (let i = 0; i < 8; i++)
    star(
      g,
      x - 55 + (i % 4) * 32,
      y - 29 + Math.floor(i / 4) * 29,
      i % 3 ? 3 : 4,
      0xf6e8ff,
      alpha * (0.42 + Math.sin(t * 1.25 + i) * 0.12),
    );
  const ex = x - 83 + life.lookX * 2,
    ey = y - 10;
  const awake =
    exposed || life.windup > 0.15 || (life.move && Math.sin(t * 0.55) > 0.82);
  if (awake && !farewell) bossEye(g, ex, ey, 15, 22, life, 0x4b477a, alpha);
  else
    g.lineStyle(3.5, 0x35405c, alpha)
      .beginPath()
      .arc(ex, ey - 5, 11, 0.3, Math.PI - 0.3, false)
      .strokePath();
  g.fillStyle(0xc9a9d4, alpha * 0.65).fillEllipse(x - 91, y + 9, 18, 9);
  if (life.windup > 0.1 && !farewell) {
    g.fillStyle(0x514674, alpha).fillEllipse(
      x - 100,
      y + 21,
      19,
      7 + life.windup * 15,
    );
    g.fillStyle(0xdcbbd7, alpha).fillEllipse(
      x - 102,
      y + 26,
      10,
      3 + life.windup * 4,
    );
  } else
    g.lineStyle(3, 0x35405c, alpha)
      .beginPath()
      .arc(x - 97, y + 9, 18, 0.3, 1.5, false)
      .strokePath();
  if (exposed && !farewell) {
    g.fillStyle(0xffdf8d, 0.17).fillCircle(x - 32, y + 24, 28);
    star(g, x - 32, y + 24, 19 + life.breath, 0xffdf8d, alpha);
    g.lineStyle(2, 0xfff1c2, alpha * 0.8).strokeCircle(x - 32, y + 24, 27);
  }
  if ((r.quietZone || r.dream || life.windup > 0.15) && !farewell)
    for (let i = 0; i < 3; i++)
      note(
        g,
        x - 133 - i * 16,
        y - 24 - i * 18 + Math.sin(t + i) * 4 * life.move,
        0.8,
        0xd8c8ff,
        alpha * 0.65,
      );
  return cues;
}

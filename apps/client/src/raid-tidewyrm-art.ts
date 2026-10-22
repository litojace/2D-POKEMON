import { bossLife } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import { TIDEWYRM, type RaidWarning } from "../../../packages/shared/src/raid";
import type { RaidBossCue } from "./raid-boss-motion";

/**
 * Tidewyrm and the Lagoon Court, drawn live each frame: the islands (they
 * crack and sink), the flood, waves, bubbles, prisons, the whirlpool, every
 * warning, and the sea serpent itself. Warning edges are exact server radii;
 * only fills pulse, so the danger boundary never moves.
 */
type G = Phaser.GameObjects.Graphics;
const SEAFOAM = 0x8ff0d8,
  TEAL = 0x2fb7a6,
  DEEP = 0x13606b,
  PEARL = 0xfff3f8,
  PEARL_GLOW = 0xbff6ff,
  FIN = 0xffa8c8,
  DANGER = 0xff4059,
  EDGE = 0xff8c99,
  WATER = 0x7fe9ff;

interface Drop {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
}
/** Per-graphics memory: what changed since the last frame (for cues and splashes). */
class TideMotion {
  seed = -1;
  serverTime = -1;
  time = 0;
  clock?: number;
  submerged = false;
  strands = 0;
  hp = 0;
  phase = 1;
  result: unknown = null;
  seen = new Set<number>();
  sinking = new Map<number, number>();
  surfacedAt = -10;
  hurtAt = -10;
  deathAt = -1;
  drops: Drop[] = [];
  serial = 0;
  splash(x: number, y: number, n: number, reduced: boolean) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = ++this.serial * 2.39996,
        speed = 50 + (this.serial % 7) * 22;
      this.drops.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: -90 - Math.abs(Math.sin(a)) * 160,
        age: 0,
        life: 0.6 + (this.serial % 5) * 0.1,
        size: 2 + (this.serial % 4),
      });
    }
    this.drops = this.drops.slice(-90);
  }
}
const motions = new WeakMap<G, TideMotion>();

const progressOf = (w: RaidWarning, now: number) =>
  w.startedAt === undefined
    ? 1
    : Math.max(
        0,
        Math.min(1, (now - w.startedAt) / Math.max(0.01, w.at - w.startedAt)),
      );

/** The floor features: islands (dry, cracked, sunk) and the flood around them. */
export function drawLagoon(g: G, state: Snapshot, reduced: boolean) {
  const r = state.raid!;
  const t = state.time;
  const flooded = (r.floodUntil ?? 0) > t;
  if (flooded) {
    // Water over the whole floor; islands stay dry above it.
    const rise = Math.min(
      1,
      (t - ((r.floodUntil ?? 0) - TIDEWYRM.highTide.seconds)) / 0.6,
    );
    g.fillStyle(0x6fe0f0, 0.32 * Math.max(0.3, rise)).fillRect(
      36,
      36,
      1600 - 72,
      900 - 72,
    );
    // Rolling swell lines across the flood.
    for (let row = 0; row < 14; row++)
      for (let k = 0; k < 9; k++) {
        const x =
            60 + k * 180 + (((row % 2) * 90 + (reduced ? 0 : t * 50)) % 180),
          y = 70 + row * 58;
        g.lineStyle(3, 0xf2fbfa, 0.35 * rise)
          .beginPath()
          .arc(x, y, 18, Math.PI * 1.15, Math.PI * 1.85, false)
          .strokePath();
      }
  }
  for (const [i, island] of (r.islands ?? []).entries()) {
    const { x, y, radius } = island;
    if (island.gone || island.sunk) {
      // Shallows where it was.
      g.lineStyle(3, 0xd9f5f0, island.gone ? 0.12 : 0.3).strokeCircle(
        x,
        y,
        radius,
      );
      if (!island.gone) {
        g.lineStyle(2, 0xd9c48a, 0.25).strokeCircle(x, y, radius * 0.7);
        // Comes back next chapter.
        g.lineStyle(2, 0xd9f5f0, 0.35).strokeCircle(x, y, radius * 0.35);
      }
      continue;
    }
    const bob = reduced ? 0 : Math.sin(t * 1.4 + i) * 1.5;
    g.fillStyle(0x0b3d48, 0.35).fillEllipse(
      x + 6,
      y + 10,
      radius * 2.15,
      radius * 1.85,
    );
    // Foam where the flood laps at the shore.
    if (flooded)
      g.lineStyle(6, 0xffffff, 0.75).strokeCircle(
        x,
        y,
        radius + 10 + (reduced ? 0 : Math.sin(t * 4 + i) * 2),
      );
    g.fillStyle(0xf2fbfa, 0.6).fillCircle(x, y + bob * 0.3, radius + 7);
    g.fillStyle(0xc9a86a).fillCircle(x, y + 4, radius);
    g.fillStyle(0xe2c88f).fillCircle(x, y, radius - 4);
    g.fillStyle(0xf1dcae, 0.8).fillEllipse(
      x - radius * 0.25,
      y - radius * 0.3,
      radius * 0.9,
      radius * 0.5,
    );
    // A tuft of grass and a shell, so it reads as dry land.
    g.fillStyle(0x58a96a).fillTriangle(
      x + 22,
      y - 18,
      x + 27,
      y - 40,
      x + 32,
      y - 18,
    );
    g.fillStyle(0x3e8f56).fillTriangle(
      x + 28,
      y - 18,
      x + 36,
      y - 34,
      x + 38,
      y - 16,
    );
    g.fillStyle(0xffd2e4).fillCircle(x - 30, y + 28, 6);
    g.lineStyle(1.5, 0xc98aa6, 1).lineBetween(x - 30, y + 22, x - 30, y + 33);
    // Cracks from strands: one more and it sinks.
    for (let c = 0; c < island.cracks; c++) {
      const a = c * 2.2 + i;
      const sx = x + Math.cos(a) * radius * 0.2,
        sy = y + Math.sin(a) * radius * 0.2;
      g.lineStyle(3, 0x6f5532, 0.9)
        .lineBetween(
          sx,
          sy,
          sx + Math.cos(a) * radius * 0.45,
          sy + Math.sin(a) * radius * 0.45,
        )
        .lineBetween(
          sx + Math.cos(a) * radius * 0.45,
          sy + Math.sin(a) * radius * 0.45,
          sx + Math.cos(a + 0.6) * radius * 0.8,
          sy + Math.sin(a + 0.6) * radius * 0.8,
        );
    }
    // Under High Tide, show how full each island is (two fit).
    if (flooded && r.partySize > 1) {
      const on = state.players.filter(
        (p) => !p.raidBoss && p.hp > 0 && Math.hypot(p.x - x, p.y - y) < radius,
      ).length;
      for (let s = 0; s < TIDEWYRM.islandCapacity; s++)
        g.fillStyle(s < on ? 0xffd65b : 0x0c1b32, 0.95).fillCircle(
          x - 9 + s * 18,
          y - radius - 16,
          6,
        );
      if (on > TIDEWYRM.islandCapacity)
        g.lineStyle(4, DANGER, 1).strokeCircle(x, y, radius + 3);
    }
  }
}

/** Every Tidewyrm warning and live attack. Returns false for kinds it doesn't draw. */
export function drawTidewyrmWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  reduced: boolean,
) {
  const r = state.raid!;
  const t = state.time;
  const pulse = reduced ? 1 : 0.86 + Math.sin(t * 8) * 0.14;
  const progress = progressOf(w, t);
  if (w.kind === "dive") {
    const locked = w.lockAt !== undefined && t >= w.lockAt;
    const murky = r.trait === "murky";
    const color = locked ? DANGER : WATER;
    // Ripples spreading from the point that follows the raider.
    for (let k = 0; k < 3; k++) {
      const phase = reduced ? k / 3 : (t * 1.6 + k / 3) % 1;
      g.lineStyle(3, color, (murky ? 0.35 : 0.85) * (1 - phase)).strokeCircle(
        w.x,
        w.y,
        18 + phase * (w.radius - 18),
      );
    }
    if (locked) {
      // The exact splash ring once it stops following.
      g.fillStyle(DANGER, 0.16 * pulse).fillCircle(w.x, w.y, w.radius);
      g.lineStyle(4, DANGER, 1).strokeCircle(w.x, w.y, w.radius);
      g.lineStyle(5, 0xffd1d6, 0.95)
        .beginPath()
        .arc(
          w.x,
          w.y,
          w.radius - 12,
          -Math.PI / 2,
          -Math.PI / 2 + progress * Math.PI * 2,
          false,
        )
        .strokePath();
    }
    // A fin cuts the water at the centre.
    g.fillStyle(DEEP, murky ? 0.4 : 0.85).fillTriangle(
      w.x - 10,
      w.y + 4,
      w.x + 2,
      w.y - 22,
      w.x + 12,
      w.y + 4,
    );
    return true;
  }
  if (w.kind === "wave") {
    // The edge it comes from glows; arrows show the way it will travel.
    const horizontal = w.tx !== w.x;
    const dir = horizontal ? Math.sign(w.tx - w.x) : Math.sign(w.ty - w.y);
    const color = w.high ? DANGER : 0xffd982;
    const len = horizontal ? 900 : 1600;
    for (let k = 0; k < 6; k++) {
      const off = 70 + ((reduced ? 0 : t * 120) % 140) + k * 140;
      for (let s = -2; s <= 2; s++) {
        const along = len / 2 + s * (len / 5);
        const ax = horizontal ? w.x + dir * off : along,
          ay = horizontal ? along : w.y + dir * off;
        const fx = horizontal ? dir : 0,
          fy = horizontal ? 0 : dir;
        g.lineStyle(3, color, 0.5 * (1 - k / 6))
          .lineBetween(ax - fx * 12 - fy * 12, ay - fy * 12 - fx * 12, ax, ay)
          .lineBetween(ax, ay, ax - fx * 12 + fy * 12, ay - fy * 12 + fx * 12);
      }
    }
    const band = 26 + progress * 40;
    if (horizontal)
      g.fillStyle(color, 0.22 * pulse).fillRect(
        dir > 0 ? 0 : 1600 - band,
        0,
        band,
        900,
      );
    else
      g.fillStyle(color, 0.22 * pulse).fillRect(
        0,
        dir > 0 ? 0 : 900 - band,
        1600,
        band,
      );
    waveIcon(
      g,
      horizontal ? (dir > 0 ? 70 : 1530) : 800,
      horizontal ? 450 : dir > 0 ? 70 : 830,
      !!w.high,
    );
    return true;
  }
  if (w.kind === "bubbles") {
    const aim = Math.atan2(w.ty - w.y, w.tx - w.x),
      spread = w.spread ?? 0.45;
    g.fillStyle(WATER, 0.12 * pulse)
      .slice(w.x, w.y, w.radius, aim - spread, aim + spread, false)
      .fillPath();
    g.lineStyle(3, WATER, 0.9)
      .slice(w.x, w.y, w.radius, aim - spread, aim + spread, false)
      .strokePath();
    for (let i = -3; i <= 3; i++) {
      const a = aim + (spread * i) / 3.5,
        d = 70 + progress * 60;
      g.lineStyle(2, PEARL_GLOW, 0.9).strokeCircle(
        w.x + Math.cos(a) * d,
        w.y + Math.sin(a) * d,
        8,
      );
    }
    return true;
  }
  if (w.kind === "hightide") {
    // The water's edge glows all round: get on an island.
    const glow = 10 + progress * 30;
    g.lineStyle(glow, WATER, 0.18 * pulse).strokeRoundedRect(
      36 + glow / 2,
      36 + glow / 2,
      1600 - 72 - glow,
      900 - 72 - glow,
      40,
    );
    g.lineStyle(4, WATER, 0.95).strokeRoundedRect(
      36,
      36,
      1600 - 72,
      900 - 72,
      40,
    );
    for (const island of r.islands ?? [])
      if (!island.sunk && !island.gone) {
        g.lineStyle(4, 0xffd65b, 0.6 + 0.4 * pulse).strokeCircle(
          island.x,
          island.y,
          island.radius + 10,
        );
        g.fillStyle(0xffd65b, 1).fillTriangle(
          island.x - 9,
          island.y - island.radius - 30,
          island.x + 9,
          island.y - island.radius - 30,
          island.x,
          island.y - island.radius - 16,
        );
      }
    return true;
  }
  if (w.kind === "undertow") {
    whirlpool(g, w.x, w.y, w.radius, 0.35 + progress * 0.5, t, reduced);
    g.lineStyle(4, DANGER, 1).strokeCircle(w.x, w.y, w.radius);
    g.lineStyle(5, 0xffd1d6, 0.95)
      .beginPath()
      .arc(
        w.x,
        w.y,
        w.radius - 12,
        -Math.PI / 2,
        -Math.PI / 2 + progress * Math.PI * 2,
        false,
      )
      .strokePath();
    return true;
  }
  if (w.kind === "prison") {
    const target = state.players.find((p) => p.id === w.targetId && p.hp > 0);
    const x = target?.x ?? w.x,
      y = target?.y ?? w.y;
    g.lineStyle(3, PEARL_GLOW, 0.5 + progress * 0.5).strokeCircle(
      x,
      y - 10,
      30 + (1 - progress) * 40,
    );
    g.fillStyle(PEARL_GLOW, 0.08 + progress * 0.12).fillCircle(
      x,
      y - 10,
      30 + (1 - progress) * 40,
    );
    return true;
  }
  return false;
}

/** The low wave has an "up" arrow (jump it); the high one an island (stand on one). */
function waveIcon(g: G, x: number, y: number, high: boolean) {
  g.fillStyle(0x0c1b32, 0.92).fillCircle(x, y, 22);
  g.lineStyle(3, high ? DANGER : 0xffd982, 1).strokeCircle(x, y, 22);
  if (high) {
    g.fillStyle(0xe2c88f, 1).fillEllipse(x, y + 6, 26, 12);
    g.fillStyle(0x58a96a, 1).fillTriangle(
      x - 2,
      y + 2,
      x + 2,
      y - 12,
      x + 6,
      y + 2,
    );
  } else
    g.lineStyle(4, 0xffd982, 1)
      .lineBetween(x, y + 10, x, y - 10)
      .lineBetween(x - 8, y - 2, x, y - 10)
      .lineBetween(x + 8, y - 2, x, y - 10);
}
function whirlpool(
  g: G,
  x: number,
  y: number,
  radius: number,
  strength: number,
  t: number,
  reduced: boolean,
) {
  const spin = reduced ? 0 : t * 3;
  g.fillStyle(0x0b4d5c, 0.35 * strength).fillCircle(x, y, radius * 2.4);
  for (let arm = 0; arm < 4; arm++)
    for (let k = 0; k < 14; k++) {
      const a = spin + arm * (Math.PI / 2) + k * 0.32,
        d = radius * 2.4 * (1 - k / 14);
      g.fillStyle(0xd9f5f0, 0.5 * strength * (k / 14)).fillCircle(
        x + Math.cos(a) * d,
        y + Math.sin(a) * d * 0.8,
        2 + k * 0.25,
      );
    }
}

/** Live attacks: waves, bubbles, the whirlpool and prisons. */
export function drawTideAttacks(g: G, state: Snapshot, reduced: boolean) {
  const r = state.raid!;
  const t = state.time;
  for (const wave of r.waves ?? []) {
    const horizontal = wave.axis === "x";
    const h = wave.width;
    const crest = wave.high ? 0xffffff : 0xe6fbff;
    const body = wave.high ? 0x1d6f8a : 0x3fb3c9;
    if (horizontal) {
      g.fillStyle(body, 0.75).fillRect(wave.pos - h / 2, 36, h, 900 - 72);
      g.fillStyle(crest, 0.85).fillRect(
        wave.pos + (wave.dir > 0 ? h / 2 - 10 : -h / 2),
        36,
        10,
        900 - 72,
      );
      for (let y = 50; y < 860; y += 34)
        g.fillStyle(crest, 0.9).fillCircle(
          wave.pos + wave.dir * (h / 2),
          y + (reduced ? 0 : Math.sin(t * 9 + y) * 4),
          wave.high ? 9 : 6,
        );
    } else {
      g.fillStyle(body, 0.75).fillRect(36, wave.pos - h / 2, 1600 - 72, h);
      g.fillStyle(crest, 0.85).fillRect(
        36,
        wave.pos + (wave.dir > 0 ? h / 2 - 10 : -h / 2),
        1600 - 72,
        10,
      );
      for (let x = 50; x < 1560; x += 34)
        g.fillStyle(crest, 0.9).fillCircle(
          x + (reduced ? 0 : Math.sin(t * 9 + x) * 4),
          wave.pos + wave.dir * (h / 2),
          wave.high ? 9 : 6,
        );
    }
    if (wave.high) {
      // Exact band edges in the danger colour.
      g.lineStyle(3, DANGER, 0.9);
      if (horizontal)
        g.lineBetween(wave.pos - h / 2, 36, wave.pos - h / 2, 864).lineBetween(
          wave.pos + h / 2,
          36,
          wave.pos + h / 2,
          864,
        );
      else
        g.lineBetween(36, wave.pos - h / 2, 1564, wave.pos - h / 2).lineBetween(
          36,
          wave.pos + h / 2,
          1564,
          wave.pos + h / 2,
        );
    }
  }
  for (const b of r.bubbles ?? []) {
    const wobble = reduced ? 0 : Math.sin(t * 6 + b.id) * 2;
    g.fillStyle(PEARL_GLOW, 0.25).fillCircle(
      b.x,
      b.y,
      TIDEWYRM.bubbles.radius + wobble,
    );
    g.lineStyle(3, WATER, 1).strokeCircle(
      b.x,
      b.y,
      TIDEWYRM.bubbles.radius + wobble,
    );
    g.fillStyle(0xffffff, 0.9).fillCircle(b.x - 6, b.y - 7, 4);
  }
  if (r.undertow && r.undertow.until > t) {
    whirlpool(g, r.undertow.x, r.undertow.y, r.undertow.radius, 1, t, reduced);
    g.lineStyle(4, DANGER, 1).strokeCircle(
      r.undertow.x,
      r.undertow.y,
      r.undertow.radius,
    );
  }
  for (const prison of r.prisons ?? []) {
    const left = Math.max(0, prison.until - t),
      total = Math.max(0.01, prison.until - prison.startedAt);
    const wobble = reduced ? 0 : Math.sin(t * 7) * 3;
    g.fillStyle(PEARL_GLOW, 0.22).fillCircle(
      prison.x,
      prison.y - 12,
      46 + wobble,
    );
    g.lineStyle(4, WATER, 1).strokeCircle(prison.x, prison.y - 12, 46 + wobble);
    g.fillStyle(0xffffff, 0.85).fillEllipse(
      prison.x - 18,
      prison.y - 36,
      14,
      8,
    );
    // Pips for teammate hits, and a bar for the mash (solo) and time left.
    for (let i = 0; i < TIDEWYRM.prison.hits; i++)
      g.fillStyle(i < prison.hits ? 0xffd65b : 0x0c1b32, 1).fillCircle(
        prison.x - 18 + i * 18,
        prison.y - 72,
        6,
      );
    g.fillStyle(0x0c1b32, 0.9).fillRect(prison.x - 36, prison.y + 40, 72, 7);
    g.fillStyle(0x7dffb0, 1).fillRect(
      prison.x - 36,
      prison.y + 40,
      72 * Math.min(1, prison.presses / TIDEWYRM.prison.presses),
      7,
    );
    g.lineStyle(3, DANGER, 0.9)
      .beginPath()
      .arc(
        prison.x,
        prison.y - 12,
        54,
        -Math.PI / 2,
        -Math.PI / 2 + (left / total) * Math.PI * 2,
        false,
      )
      .strokePath();
  }
}

/** The serpent: surfacing, stranded on an island, swimming under water, defeated. */
export function drawTidewyrm(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
): RaidBossCue[] {
  const r = state.raid!;
  const boss = state.players.find((p) => p.raidBoss);
  if (!boss) return [];
  let m = motions.get(g);
  if (
    !m ||
    m.seed !== r.seed ||
    state.time < m.serverTime ||
    (!!m.result && !r.result)
  ) {
    m = new TideMotion();
    m.seed = r.seed;
    m.hp = boss.hp;
    m.submerged = !!r.submerged;
    m.strands = r.strands ?? 0;
    m.phase = r.phase;
    motions.set(g, m);
  }
  const dt =
    state.phase === "paused"
      ? 0
      : Math.max(0, Math.min(0.05, clock - (m.clock ?? clock)));
  m.serverTime = state.time;
  m.clock = clock;
  m.time += dt;
  const cues: RaidBossCue[] = [];
  const live = state.phase === "playing";
  for (const w of r.warnings)
    if (!m.seen.has(w.id)) {
      m.seen.add(w.id);
      cues.push("roar");
    }
  if (m.seen.size > 200) m.seen = new Set(r.warnings.map((w) => w.id));
  if (m.submerged && !r.submerged && live) {
    m.surfacedAt = m.time;
    cues.push("slam");
    m.splash(boss.x, boss.y, 26, reduced);
  }
  if (!m.submerged && r.submerged && live)
    m.splash(boss.x, boss.y, 12, reduced);
  if ((r.strands ?? 0) > m.strands) cues.push("crash");
  if (boss.hp < m.hp && boss.hp > 0) {
    m.hurtAt = m.time;
    cues.push(
      r.exposedUntil > state.time || r.staggerUntil > state.time
        ? "core"
        : "chip",
    );
  }
  if (r.phase > m.phase && live) cues.push("awaken");
  for (const island of r.islands ?? [])
    if (island.sunk && !m.sinking.has(island.x * 7 + island.y)) {
      m.sinking.set(island.x * 7 + island.y, m.time);
      m.splash(island.x, island.y, 18, reduced);
    } else if (!island.sunk) m.sinking.delete(island.x * 7 + island.y);
  const dead = r.result === "victory";
  if (dead && m.deathAt < 0) {
    m.deathAt = m.time;
    cues.push("fall");
    m.splash(boss.x, boss.y, 30, reduced);
  }
  m.submerged = !!r.submerged;
  m.strands = r.strands ?? 0;
  m.hp = boss.hp;
  m.phase = r.phase;
  m.result = r.result;

  const life = bossLife(g, state, boss, clock, reduced);
  const t = m.time;
  const motion = reduced ? 0 : 1;
  // Water drops from splashes.
  m.drops = m.drops.filter((d) => (d.age += dt) < d.life);
  const paintDrops = () => {
    for (const d of m!.drops) {
      const x = d.x + d.vx * d.age,
        y = d.y + d.vy * d.age + 380 * d.age * d.age;
      g.fillStyle(0xe6fbff, 0.9 * (1 - d.age / d.life)).fillCircle(
        x,
        y,
        d.size,
      );
    }
  };
  if (r.submerged && !dead) {
    // Only a dark shape and a wake show where it swims.
    g.fillStyle(DEEP, 0.45).fillEllipse(boss.x, boss.y, 120, 46);
    for (let k = 0; k < 2; k++) {
      const p = reduced ? 0.5 : (t * 1.2 + k / 2) % 1;
      g.lineStyle(2, 0xd9f5f0, 0.4 * (1 - p)).strokeEllipse(
        boss.x,
        boss.y,
        120 + p * 70,
        46 + p * 26,
      );
    }
    paintDrops();
    return cues;
  }
  const stranded =
    r.exposedUntil > state.time &&
    !!(r.islands ?? []).some(
      (i) => !i.sunk && Math.hypot(boss.x - i.x, boss.y - i.y) < i.radius,
    );
  const stagger = r.staggerUntil > state.time;
  const hurt = Math.max(0, 1 - (t - m.hurtAt) / 0.24);
  const rise = Math.min(1, (t - m.surfacedAt) / 0.35);
  const sink = dead ? (reduced ? 1 : Math.min(1, (t - m.deathAt) / 2.2)) : 0;
  const x = boss.x + Math.sin(hurt * Math.PI * 3) * hurt * 6 * motion;
  const base = boss.y + 30;
  // Stranded, it flops on its side on dry land; in water it rises in coils.
  const height = (stranded ? 55 : 120 - life.windup * 9) * rise * (1 - sink);
  const sway =
    Math.sin(t * (stranded ? 7 : 1.6)) * (stranded ? 10 : 6) * motion;
  const facing = Math.cos(boss.angle) >= 0 ? 1 : -1;
  // Ring splash at the waterline (not on dry land).
  if (!stranded) {
    g.fillStyle(DEEP, 0.4).fillEllipse(x, base + 6, 190, 54);
    for (let k = 0; k < 3; k++) {
      const p = reduced ? k / 3 : (t * 0.8 + k / 3) % 1;
      g.lineStyle(3, 0xd9f5f0, 0.5 * (1 - p)).strokeEllipse(
        x,
        base + 4,
        120 + p * 120,
        34 + p * 34,
      );
    }
  } else g.fillStyle(0x3b2f1c, 0.3).fillEllipse(x, base + 10, 210, 50);
  // The body: a looping chain of segments, tail in the water.
  const segments = 12;
  const pts: { x: number; y: number; r: number }[] = [];
  for (let i = 0; i < segments; i++) {
    const k = i / (segments - 1);
    const loop = stranded
      ? {
          x: (k - 0.5) * 180 * facing,
          y:
            Math.sin(k * Math.PI * 1.6) * -22 +
            Math.sin(k * Math.PI * 2 + t * 6 * motion) * 6,
        }
      : {
          x:
            Math.sin(k * Math.PI * 1.6 + t * 1.3 * motion) *
              34 *
              (1 - k * 0.4) -
            facing * (1 - k) * 40,
          y: -k * height,
        };
    pts.push({
      x: x + loop.x + (stranded ? 0 : sway * k),
      y: base + loop.y - (stranded ? 8 : 0) + sink * 60,
      r: 30 - k * 8 + (stranded ? 4 : 0),
    });
  }
  const glow = stranded || stagger;
  const skin = hurt > 0.6 ? 0xd8fff6 : r.gilded ? 0xe8d48a : TEAL;
  const belly = r.gilded ? 0xfff3c4 : SEAFOAM;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    g.fillStyle(DEEP, 1).fillCircle(p.x + 2, p.y + 3, p.r + 3);
    g.fillStyle(skin, 1).fillCircle(p.x, p.y, p.r);
    g.fillStyle(belly, 0.85).fillEllipse(
      p.x - facing * p.r * 0.25,
      p.y + p.r * 0.2,
      p.r * 1.1,
      p.r * 0.9,
    );
    // Pearl freckles along the back.
    if (i % 2 === 0 && i > 1)
      g.fillStyle(PEARL, 0.9).fillCircle(
        p.x + facing * p.r * 0.45,
        p.y - p.r * 0.45,
        3.5,
      );
    // Ribbon fins every few segments.
    if (i === 4 || i === 8) {
      const f = Math.sin(t * 5 + i) * 6 * motion;
      g.fillStyle(FIN, 0.9).fillTriangle(
        p.x - facing * p.r * 0.6,
        p.y - p.r * 0.4,
        p.x - facing * (p.r + 26),
        p.y - p.r - 10 + f,
        p.x - facing * (p.r + 10),
        p.y + 4,
      );
    }
  }
  // The head on the last segment: round snout, sleepy eyes, a pearl on its brow.
  const head = pts[pts.length - 1];
  const hx = head.x + facing * 12,
    hy = head.y - (stranded ? 6 : 14) - life.windup * 9 + life.breath;
  g.fillStyle(DEEP, 1).fillEllipse(hx + 2, hy + 3, 92, 74);
  g.fillStyle(skin, 1).fillEllipse(hx, hy, 88, 70);
  g.fillStyle(belly, 1).fillEllipse(hx + facing * 22, hy + 14, 50, 34);
  g.fillStyle(DEEP, 0.7)
    .fillCircle(hx + facing * 34, hy + 8, 3)
    .fillCircle(hx + facing * 26, hy + 10, 3);
  // Ribbon fins at the cheeks.
  const ear = Math.sin(t * 3) * 5 * motion;
  g.fillStyle(FIN, 1).fillTriangle(
    hx - facing * 24,
    hy - 18,
    hx - facing * 62,
    hy - 40 + ear,
    hx - facing * 40,
    hy - 4,
  );
  g.fillStyle(0xffd2e4, 1).fillTriangle(
    hx - facing * 26,
    hy - 14,
    hx - facing * 50,
    hy - 30 + ear,
    hx - facing * 38,
    hy - 6,
  );
  // Eyes: sleepy lids; dizzy when staggered; closed when beaten.
  const eye = (ex: number) => {
    const ey = hy - 6;
    if (dead || (life.blink > 0.85 && !stranded && !stagger)) {
      g.lineStyle(3, DEEP, 1)
        .beginPath()
        .arc(ex, ey, 7, 0.2, Math.PI - 0.2, false)
        .strokePath();
      return;
    }
    if (stagger) {
      g.lineStyle(3, DEEP, 1).strokeCircle(ex, ey, 6);
      g.lineStyle(2, DEEP, 1).strokeCircle(ex, ey, 2.5);
      return;
    }
    const open = Math.max(0.15, 1 - life.blink);
    g.fillStyle(0xffffff, 1).fillEllipse(ex, ey, 16, 16 * open);
    g.fillStyle(0x16324a, 1).fillEllipse(
      ex + facing * 1.5 + life.lookX,
      ey + 1,
      10,
      10 * open,
    );
    g.fillStyle(0xffffff, 1).fillCircle(ex + facing * 3, ey - 2, 2);
    // Heavy lids: half-closed when calm, wide when stranded.
    if (!stranded) g.fillStyle(skin, 1).fillRect(ex - 9, ey - 9, 18, 8);
    g.lineStyle(2, DEEP, 1).lineBetween(
      ex - 9,
      ey - (stranded ? 8 : 1),
      ex + 9,
      ey - (stranded ? 8 : 1),
    );
  };
  eye(hx + facing * 4);
  eye(hx + facing * 24);
  // Paired trailing barbels lag behind the head; a small jaw opens on a cast.
  for (const side of [-1, 1]) {
    const wx = hx + facing * 36,
      wy = hy + 13 + side * 6;
    const lag = Math.sin(t * 2.2 + side) * 4 * life.move;
    g.lineStyle(2.5, PEARL, 0.8)
      .beginPath()
      .moveTo(wx, wy)
      .lineTo(wx + facing * 12, wy + side * 5 + lag)
      .lineTo(wx + facing * 20, wy + side * 12 + lag)
      .strokePath();
  }
  if (life.windup > 0.1 && !dead)
    g.fillStyle(DEEP, 0.9).fillEllipse(
      hx + facing * 31,
      hy + 23,
      18,
      4 + life.windup * 9,
    );
  else
    g.lineStyle(2, DEEP, 0.8)
      .beginPath()
      .arc(hx + facing * 27, hy + 14, 11, 0.1, Math.PI * 0.8, false)
      .strokePath();
  // The pearl: it glows when the boss is open to attack.
  const pearlPulse = reduced ? 1 : 0.75 + Math.sin(t * (glow ? 9 : 2)) * 0.25;
  if (glow)
    g.fillStyle(PEARL_GLOW, 0.35 * pearlPulse).fillCircle(
      hx + facing * 8,
      hy - 30,
      22,
    );
  g.fillStyle(glow ? PEARL_GLOW : PEARL, 1).fillCircle(
    hx + facing * 8,
    hy - 30,
    10,
  );
  g.fillStyle(0xffffff, 1).fillCircle(hx + facing * 5, hy - 33, 3.5);
  if (stagger)
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      g.fillStyle(0xfff1a0, 1).fillCircle(
        hx + Math.cos(a) * 34,
        hy - 46 + Math.sin(a) * 8,
        4,
      );
    }
  if (dead) {
    // Drifting off to sleep: bubbles rise.
    for (let i = 0; i < 4; i++) {
      const p = reduced ? i / 4 : (t * 0.6 + i / 4) % 1;
      g.lineStyle(2, PEARL_GLOW, 1 - p).strokeCircle(
        hx + 20 + i * 8,
        hy - 40 - p * 70,
        4 + p * 6,
      );
    }
  }
  paintDrops();
  return cues;
}

import { bossLife, type BossLifePose } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  GLOOMSHADE,
  handsTileDark,
  lanternRadius,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import type { RaidBossCue } from "./raid-boss-motion";

/**
 * Gloomshade and the Lantern Yard, drawn live each frame: the night closing
 * in, lanterns and their light, curses on raiders, every warning, and the
 * shadow puff itself with its copies. Warning edges are exact server radii;
 * only fills pulse, so the danger boundary never moves.
 *
 * The copies are drawn exactly like the real one, except for the two tells
 * the briefing teaches: only the real one casts a shadow in lantern light,
 * and only its crescent tail flickers.
 */
type G = Phaser.GameObjects.Graphics;
const NIGHT = 0x070914,
  SHADE = 0x2b2245,
  SHADE_TOP = 0x4a3d72,
  SHADE_EDGE = 0x18122b,
  EYE = 0xfff3c4,
  MOON = 0xffd65b,
  LAMP = 0xffd27a,
  LAMP_HOT = 0xfff1c2,
  CURSE = 0xb07bff,
  DANGER = 0xff4059,
  EDGE = 0xff8c99;

interface Mote {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  size: number;
  color: number;
}
/** Per-graphics memory: what changed since the last frame (for cues and puffs). */
class GloomMotion {
  seed = -1;
  serverTime = -1;
  time = 0;
  clock?: number;
  hp = 0;
  phase = 1;
  result: unknown = null;
  copies = new Map<number, { x: number; y: number }>();
  lit: boolean[] = [];
  exposed = false;
  seen = new Set<number>();
  hurtAt = -10;
  splitAt = -10;
  deathAt = -1;
  motes: Mote[] = [];
  serial = 0;
  puff(
    x: number,
    y: number,
    n: number,
    color: number,
    reduced: boolean,
    up = 60,
  ) {
    if (reduced) return;
    for (let i = 0; i < n; i++) {
      const a = ++this.serial * 2.39996,
        speed = 30 + (this.serial % 7) * 16;
      this.motes.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed * 0.6 - up,
        age: 0,
        life: 0.6 + (this.serial % 5) * 0.12,
        size: 3 + (this.serial % 4),
        color,
      });
    }
    this.motes = this.motes.slice(-120);
  }
}
const motions = new WeakMap<G, GloomMotion>();

const progressOf = (w: RaidWarning, now: number) =>
  w.startedAt === undefined
    ? 1
    : Math.max(
        0,
        Math.min(1, (now - w.startedAt) / Math.max(0.01, w.at - w.startedAt)),
      );

/** Is a point in lantern (or temporary) light? Matches the server's check. */
export function litAt(state: Snapshot, x: number, y: number) {
  const r = state.raid!;
  return (
    (r.lanterns ?? []).some(
      (l) => l.lit && Math.hypot(x - l.x, y - l.y) < lanternRadius(r.trait),
    ) ||
    (r.lights ?? []).some(
      (l) => l.until > state.time && Math.hypot(x - l.x, y - l.y) < l.radius,
    )
  );
}

/** The night, the lanterns and their light, and curses on raiders. */
export function drawLanternYard(g: G, state: Snapshot, reduced: boolean) {
  const r = state.raid!;
  const t = state.time;
  const lanterns = r.lanterns ?? [];
  const out = lanterns.filter((l) => !l.lit).length;
  const reach = lanternRadius(r.trait);
  // The night presses in from the edges, more as lanterns go out. It never
  // goes fully dark: the middle of the yard always stays readable.
  const dark = 0.1 + (out / Math.max(1, lanterns.length)) * 0.22;
  for (let i = 0; i < 7; i++)
    g.lineStyle(46, NIGHT, dark * (1 - i / 9)).strokeRoundedRect(
      23 + i * 40,
      23 + i * 40,
      1600 - 46 - i * 80,
      900 - 46 - i * 80,
      30,
    );
  // Light pools: soft warm layers, then the exact edge that counts for
  // cleansing curses and for the real one's shadow.
  for (const [i, l] of lanterns.entries()) {
    if (!l.lit) continue;
    const flicker = reduced
      ? 1
      : 0.92 + Math.sin(t * 9 + i * 1.7) * 0.05 + Math.sin(t * 23 + i) * 0.03;
    for (let k = 4; k >= 1; k--)
      g.fillStyle(LAMP, 0.045 * flicker).fillCircle(l.x, l.y, (reach * k) / 4);
    g.lineStyle(2, LAMP, 0.4).strokeCircle(l.x, l.y, reach);
  }
  // Ball Lightning's patches of light: cool white, fading out.
  for (const l of r.lights ?? []) {
    const left = l.until - t;
    if (left <= 0) continue;
    const fade = Math.min(1, left / 0.6);
    g.fillStyle(0xe8f4ff, 0.1 * fade).fillCircle(l.x, l.y, l.radius);
    g.fillStyle(0xffffff, 0.08 * fade).fillCircle(l.x, l.y, l.radius * 0.55);
    g.lineStyle(2, 0xbfe4ff, 0.6 * fade).strokeCircle(l.x, l.y, l.radius);
    for (let k = 0; k < 4; k++) {
      const a = (reduced ? 0 : t * 5) + (k * Math.PI) / 2;
      g.lineStyle(2, 0xfff3a0, 0.8 * fade).lineBetween(
        l.x,
        l.y,
        l.x + Math.cos(a) * 14,
        l.y + Math.sin(a) * 14,
      );
    }
  }
  for (const [i, l] of lanterns.entries()) lanternPost(g, l, i, t, reduced);
  // Curses: purple wisps circle the raider, one per stack; Haunted glows.
  for (const p of state.players) {
    const c = r.curses?.[p.id];
    if (!c || p.raidBoss || p.hp <= 0) continue;
    const haunted = c.hauntedUntil > t;
    if (!c.stacks && !haunted) continue;
    const spin = reduced ? 0 : t * 2.4;
    if (haunted) {
      const beat = reduced ? 1 : 0.8 + Math.sin(t * 6) * 0.2;
      g.fillStyle(CURSE, 0.16 * beat).fillCircle(p.x, p.y - 20, 52);
      g.lineStyle(3, CURSE, 0.9).strokeCircle(p.x, p.y - 20, 52);
      // A little ghost bobbing above them.
      ghost(g, p.x + 34, p.y - 92 + (reduced ? 0 : Math.sin(t * 3) * 5), 0.9);
    }
    const stacks = haunted ? GLOOMSHADE.curse.haunted : c.stacks;
    for (let s = 0; s < stacks; s++) {
      const a = spin + (s * Math.PI * 2) / Math.max(1, stacks);
      const wx = p.x + Math.cos(a) * 34,
        wy = p.y - 20 + Math.sin(a) * 14;
      g.fillStyle(CURSE, 0.35).fillCircle(wx, wy, 9);
      g.fillStyle(0xe0ccff, 0.95).fillCircle(wx, wy, 4.5);
    }
    // Stack pips over the head: three makes Haunted.
    for (let s = 0; s < GLOOMSHADE.curse.haunted; s++)
      g.fillStyle(s < stacks ? CURSE : 0x0c1b32, 0.95).fillCircle(
        p.x - 14 + s * 14,
        p.y - 112,
        5,
      );
    // How close is too close: the spread range, in a party.
    if (r.partySize > 1 && !haunted)
      for (let k = 0; k < 24; k += 2) {
        const a0 = (k / 24) * Math.PI * 2 + (reduced ? 0 : t * 0.4),
          a1 = a0 + Math.PI / 24;
        g.lineStyle(2, CURSE, 0.45)
          .beginPath()
          .arc(p.x, p.y, GLOOMSHADE.curse.radius, a0, a1, false)
          .strokePath();
      }
  }
}

/** A stone-and-iron lantern post: glowing when lit, cold with hit pips when not. */
function lanternPost(
  g: G,
  l: { x: number; y: number; lit: boolean; hits: number },
  i: number,
  t: number,
  reduced: boolean,
) {
  const { x, y } = l;
  g.fillStyle(NIGHT, 0.35).fillEllipse(x + 4, y + 30, 54, 18);
  // Stone base and iron post.
  g.fillStyle(0x4d4668).fillRoundedRect(x - 18, y + 14, 36, 18, 5);
  g.fillStyle(0x6a628a).fillRoundedRect(x - 14, y + 12, 28, 6, 3);
  g.fillStyle(0x23202f).fillRect(x - 4, y - 30, 8, 46);
  // The lantern housing.
  const glass = l.lit ? LAMP_HOT : 0x2c2b44;
  g.fillStyle(0x23202f).fillTriangle(x - 20, y - 52, x + 20, y - 52, x, y - 68);
  g.fillStyle(0x23202f).fillRoundedRect(x - 17, y - 54, 34, 30, 5);
  g.fillStyle(glass, 1).fillRoundedRect(x - 12, y - 50, 24, 22, 4);
  g.lineStyle(2, 0x23202f, 1).lineBetween(x, y - 50, x, y - 28);
  if (l.lit) {
    const f = reduced ? 1 : 0.85 + Math.sin(t * 11 + i * 2) * 0.15;
    g.fillStyle(LAMP, 0.35 * f).fillCircle(x, y - 40, 28);
    g.fillStyle(0xff9a3d, 1).fillEllipse(x, y - 37, 9, 14 * f);
    g.fillStyle(0xfff6d8, 1).fillEllipse(x, y - 35, 4, 7 * f);
    return;
  }
  // Out: a thin curl of smoke, and pips for the hits it needs.
  for (let k = 0; k < 3; k++) {
    const p = reduced ? k / 3 : (t * 0.5 + k / 3) % 1;
    g.fillStyle(0x8a84a8, 0.35 * (1 - p)).fillCircle(
      x + Math.sin(p * 6 + i) * 6,
      y - 70 - p * 40,
      4 + p * 5,
    );
  }
  for (let h = 0; h < GLOOMSHADE.relightHits; h++)
    g.fillStyle(h < l.hits ? MOON : 0x0c1b32, 1).fillCircle(
      x - 7 + h * 14,
      y - 84,
      5,
    );
  g.lineStyle(2, MOON, 1)
    .strokeCircle(x - 7, y - 84, 5)
    .strokeCircle(x + 7, y - 84, 5);
  // A gentle "hit me" ring so it's easy to find in the dark.
  const ring = reduced ? 0.5 : (t * 0.9) % 1;
  g.lineStyle(3, MOON, 0.6 * (1 - ring)).strokeCircle(
    x,
    y - 40,
    22 + ring * 26,
  );
}

function ghost(g: G, x: number, y: number, alpha: number) {
  g.fillStyle(0xe0ccff, alpha).fillCircle(x, y, 10);
  g.fillStyle(0xe0ccff, alpha).fillRect(x - 10, y, 20, 9);
  g.fillStyle(0xe0ccff, alpha)
    .fillTriangle(x - 10, y + 9, x - 4, y + 9, x - 7, y + 14)
    .fillTriangle(x - 3, y + 9, x + 3, y + 9, x, y + 14)
    .fillTriangle(x + 4, y + 9, x + 10, y + 9, x + 7, y + 14);
  g.fillStyle(SHADE_EDGE, alpha)
    .fillCircle(x - 3.5, y - 1, 2)
    .fillCircle(x + 3.5, y - 1, 2);
}

/** Every Gloomshade warning. Returns false for kinds it doesn't draw. */
export function drawGloomshadeWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  reduced: boolean,
) {
  const r = state.raid!;
  const t = state.time;
  const pulse = reduced ? 1 : 0.86 + Math.sin(t * 8) * 0.14;
  const progress = progressOf(w, t);
  if (w.kind === "lunge") {
    const locked = w.lockAt !== undefined && t >= w.lockAt;
    const color = locked ? DANGER : 0xffd982;
    const len = Math.hypot(w.tx - w.x, w.ty - w.y) || 1;
    const nx = -(w.ty - w.y) / len,
      ny = (w.tx - w.x) / len;
    // The lane it lunges along, with its exact edges.
    g.lineStyle(w.radius * 2, color, (locked ? 0.2 : 0.1) * pulse).lineBetween(
      w.x,
      w.y,
      w.tx,
      w.ty,
    );
    g.lineStyle(3, color, 0.95)
      .lineBetween(
        w.x + nx * w.radius,
        w.y + ny * w.radius,
        w.tx + nx * w.radius,
        w.ty + ny * w.radius,
      )
      .lineBetween(
        w.x - nx * w.radius,
        w.y - ny * w.radius,
        w.tx - nx * w.radius,
        w.ty - ny * w.radius,
      );
    // A shadow claw creeping along the lane as the timer fills.
    const px = w.x + (w.tx - w.x) * progress,
      py = w.y + (w.ty - w.y) * progress;
    g.fillStyle(SHADE_EDGE, 0.8).fillCircle(px, py, w.radius * 0.8);
    g.fillStyle(locked ? DANGER : 0xffd982, 1).fillCircle(px, py, 4);
    // Chevrons show which way it goes.
    for (let k = 1; k < 6; k++) {
      const cx = w.x + ((w.tx - w.x) * k) / 6,
        cy = w.y + ((w.ty - w.y) * k) / 6;
      const dx = (w.tx - w.x) / len,
        dy = (w.ty - w.y) / len;
      g.lineStyle(3, color, 0.6)
        .lineBetween(cx - dx * 10 + nx * 10, cy - dy * 10 + ny * 10, cx, cy)
        .lineBetween(cx, cy, cx - dx * 10 - nx * 10, cy - dy * 10 - ny * 10);
    }
    return true;
  }
  if (w.kind === "hands") {
    // Dark tiles grab. On Peril 2+ the board flips once: the tiles flicker
    // just before it does, so the safe ones are never a surprise.
    const shifting = w.shiftAt !== undefined;
    const before = shifting && t < (w.shiftAt ?? 0);
    const parity = before || !shifting ? (w.parity ?? 0) : 1 - (w.parity ?? 0);
    const flicker =
      before &&
      (w.shiftAt ?? 0) - t < 0.3 &&
      !reduced &&
      Math.floor(t * 16) % 2 === 0;
    const showing = flicker ? 1 - parity : parity;
    const cols = GLOOMSHADE.hands.cols,
      rows = GLOOMSHADE.hands.rows;
    const tw = 1600 / cols,
      th = 900 / rows;
    for (let c = 0; c < cols; c++)
      for (let rr = 0; rr < rows; rr++) {
        if (!handsTileDark((c + 0.5) * tw, (rr + 0.5) * th, showing)) continue;
        // Kept inside the yard's kerb (nobody can stand beyond it).
        const x = Math.max(36, c * tw),
          y = Math.max(36, rr * th),
          w = Math.min(1600 - 36, (c + 1) * tw) - x,
          h = Math.min(900 - 36, (rr + 1) * th) - y;
        g.fillStyle(0x2a0d3d, (0.35 + progress * 0.25) * pulse).fillRect(
          x + 3,
          y + 3,
          w - 6,
          h - 6,
        );
        g.lineStyle(3, before ? 0xffd982 : DANGER, 0.85).strokeRect(
          x + 3,
          y + 3,
          w - 6,
          h - 6,
        );
        // Little shadow hands rising out of the stone.
        const rise = Math.min(1, progress * 1.3);
        for (const k of [-1, 1])
          hand(g, (c + 0.5) * tw + k * 40, (rr + 0.5) * th + 30, 26 * rise);
      }
    if (shifting) {
      // A turn-around arrow in the corner: this board will flip.
      const cx = 800,
        cy = 60;
      g.fillStyle(0x0c1b32, 0.9).fillCircle(cx, cy, 22);
      g.lineStyle(3, before ? 0xffd982 : DANGER, 1)
        .beginPath()
        .arc(cx, cy, 12, -Math.PI * 0.9, Math.PI * 0.6, false)
        .strokePath();
      g.fillStyle(before ? 0xffd982 : DANGER, 1).fillTriangle(
        cx - 6,
        cy + 14,
        cx + 4,
        cy + 5,
        cx + 6,
        cy + 17,
      );
    }
    return true;
  }
  if (w.kind === "snuff") {
    const l = r.lanterns?.[w.lantern ?? -1];
    if (!l) return true;
    // Shadow swallows the light from the edge in.
    const reach = lanternRadius(r.trait);
    const left = reach * (1 - progress);
    g.lineStyle(reach - left + 2, SHADE_EDGE, 0.45).strokeCircle(
      l.x,
      l.y,
      (reach + left) / 2,
    );
    g.lineStyle(3, EDGE, 0.9).strokeCircle(l.x, l.y, reach);
    g.lineStyle(5, 0xffd1d6, 0.95)
      .beginPath()
      .arc(
        l.x,
        l.y - 40,
        32,
        -Math.PI / 2,
        -Math.PI / 2 + progress * Math.PI * 2,
        false,
      )
      .strokePath();
    return true;
  }
  if (w.kind === "curse") {
    const target = state.players.find((p) => p.id === w.targetId && p.hp > 0);
    const x = target?.x ?? w.x,
      y = target?.y ?? w.y;
    g.fillStyle(CURSE, 0.1 + progress * 0.12).fillCircle(x, y, w.radius);
    g.lineStyle(3, CURSE, 0.9).strokeCircle(x, y, w.radius);
    g.lineStyle(5, 0xe0ccff, 0.95)
      .beginPath()
      .arc(
        x,
        y,
        w.radius - 10,
        -Math.PI / 2,
        -Math.PI / 2 + progress * Math.PI * 2,
        false,
      )
      .strokePath();
    ghost(g, x, y - 100 + (1 - progress) * -30, 0.5 + progress * 0.5);
    return true;
  }
  if (w.kind === "split") {
    // It shivers apart: rings spinning out from it.
    for (let k = 0; k < 3; k++) {
      const a = (reduced ? 0 : t * 4) + (k * Math.PI * 2) / 3;
      const d = 20 + progress * 70;
      g.lineStyle(3, CURSE, 0.8).strokeCircle(
        w.x + Math.cos(a) * d,
        w.y - 30 + Math.sin(a) * d * 0.5,
        30,
      );
    }
    return true;
  }
  if (w.kind === "pulse") {
    // Every copy shows the ring; only the real one's hurts. Jump it.
    const centres = [{ x: w.x, y: w.y }, ...(r.decoys ?? [])];
    for (const c of centres) {
      g.fillStyle(0x9c7bff, 0.1 * pulse).fillCircle(c.x, c.y, w.radius);
      g.lineStyle(4, DANGER, 1).strokeCircle(c.x, c.y, w.radius);
      g.lineStyle(5, 0xffd1d6, 0.95)
        .beginPath()
        .arc(
          c.x,
          c.y,
          w.radius - 12,
          -Math.PI / 2,
          -Math.PI / 2 + progress * Math.PI * 2,
          false,
        )
        .strokePath();
      // The jump arrow.
      const ix = c.x,
        iy = c.y - w.radius - 4;
      g.fillStyle(0x0c1b32, 0.92).fillCircle(ix, iy, 18);
      g.lineStyle(3, 0xffd982, 1).strokeCircle(ix, iy, 18);
      g.lineStyle(4, 0xffd982, 1)
        .lineBetween(ix, iy + 8, ix, iy - 8)
        .lineBetween(ix - 7, iy - 1, ix, iy - 8)
        .lineBetween(ix + 7, iy - 1, ix, iy - 8);
    }
    return true;
  }
  return false;
}

function hand(g: G, x: number, y: number, h: number) {
  if (h <= 1) return;
  g.fillStyle(SHADE_EDGE, 0.95).fillRoundedRect(x - 9, y - h, 18, h, 6);
  for (let f = 0; f < 4; f++)
    g.fillStyle(SHADE_EDGE, 0.95).fillRoundedRect(
      x - 10 + f * 5.5,
      y - h - 10,
      4.5,
      12,
      2,
    );
  g.fillStyle(CURSE, 0.7)
    .fillCircle(x - 3, y - h + 6, 2)
    .fillCircle(x + 3, y - h + 6, 2);
}

/** A crescent moon (the tail), pointing along `angle`. */
function crescent(
  g: G,
  x: number,
  y: number,
  radius: number,
  angle: number,
  color: number,
  alpha: number,
) {
  const d = radius * 0.55;
  const phi = Math.atan2(
    Math.sqrt(Math.max(0, radius * radius - (d * d) / 4)),
    d / 2,
  );
  const pts: { x: number; y: number }[] = [];
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const a = phi + ((Math.PI * 2 - 2 * phi) * i) / N;
    pts.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  for (let i = 0; i <= N; i++) {
    const a = Math.PI + phi - (2 * phi * i) / N;
    pts.push({ x: d + Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  const c = Math.cos(angle),
    s = Math.sin(angle);
  g.fillStyle(color, alpha).fillPoints(
    pts.map((p) => ({ x: x + p.x * c - p.y * s, y: y + p.x * s + p.y * c })),
    true,
  );
}

/** Gloomshade and its copies: drifting, splitting, found, staggered, fading at dawn. */
export function drawGloomshade(
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
    m = new GloomMotion();
    m.seed = r.seed;
    m.hp = boss.hp;
    m.phase = r.phase;
    m.lit = (r.lanterns ?? []).map((l) => l.lit);
    for (const d of r.decoys ?? []) m.copies.set(d.id, { x: d.x, y: d.y });
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
  // New copies: a split. Copies that vanished burst into motes.
  const now = new Map((r.decoys ?? []).map((d) => [d.id, { x: d.x, y: d.y }]));
  const fresh = [...now.keys()].filter((id) => !m!.copies.has(id));
  if (fresh.length && live) {
    m.splitAt = m.time;
    cues.push("slam");
    m.puff(boss.x, boss.y - 30, 18, CURSE, reduced);
  }
  for (const [id, c] of m.copies)
    if (!now.has(id) && live) m.puff(c.x, c.y - 30, 12, 0x9c7bff, reduced);
  m.copies = now;
  // Lanterns going out and coming back.
  for (const [i, l] of (r.lanterns ?? []).entries()) {
    if (m.lit[i] === false && l.lit && live)
      m.puff(l.x, l.y - 40, 14, LAMP, reduced, 90);
    m.lit[i] = l.lit;
  }
  const exposed = r.exposedUntil > state.time;
  if (exposed && !m.exposed && live) cues.push("crash");
  m.exposed = exposed;
  if (boss.hp < m.hp && boss.hp > 0) {
    m.hurtAt = m.time;
    cues.push(exposed || r.staggerUntil > state.time ? "core" : "chip");
  }
  if (r.phase > m.phase && live) cues.push("awaken");
  const dead = r.result === "victory";
  if (dead && m.deathAt < 0) {
    m.deathAt = m.time;
    cues.push("fall");
    m.puff(boss.x, boss.y - 40, 30, LAMP_HOT, reduced, 120);
  }
  m.hp = boss.hp;
  m.phase = r.phase;
  m.result = r.result;

  const life = bossLife(g, state, boss, clock, reduced);
  const t = m.time;
  const motion = reduced ? 0 : 1;
  const revealed = (r.revealUntil ?? 0) > state.time;
  const stagger = r.staggerUntil > state.time;
  const hurt = Math.max(0, 1 - (t - m.hurtAt) / 0.24);
  const fade = dead ? (reduced ? 1 : Math.min(1, (t - m.deathAt) / 2.4)) : 0;
  const facing = Math.cos(boss.angle) >= 0 ? 1 : -1;
  // Copies first, so the real one draws on top where they overlap.
  const bodies = [
    ...(r.decoys ?? []).map((d) => ({ x: d.x, y: d.y, real: false, id: d.id })),
    { x: boss.x, y: boss.y, real: true, id: 0 },
  ];
  const appear = Math.min(1, (t - m.splitAt) / 0.4);
  for (const b of bodies) {
    const shake = b.real ? Math.sin(hurt * Math.PI * 3) * hurt * 6 * motion : 0;
    shade(g, {
      x: b.x + shake,
      y: b.y,
      t: t + b.id * 0.37,
      facing,
      motion,
      life,
      // The two tells: a shadow in lantern light, and a flickering tail.
      shadow:
        b.real && litAt(state, b.x, b.y)
          ? nearestLight(state, b.x, b.y)
          : undefined,
      // Hollow trait: the real one's shadow is fainter.
      shadowAlpha: r.trait === "hollow" ? 0.22 : 0.4,
      flicker: b.real && !reduced,
      alpha: (b.real ? 1 : appear) * (1 - fade),
      hurt: b.real && hurt > 0.6,
      gilded: !!r.gilded,
      stagger: b.real && stagger,
      exposed: b.real && exposed,
      dead: b.real && dead,
    });
  }
  // Found: a golden ring and arrow over the real one.
  if ((revealed || exposed) && !dead) {
    const bob = reduced ? 0 : Math.sin(t * 4) * 4;
    g.lineStyle(3, MOON, 0.9).strokeEllipse(boss.x, boss.y + 12, 150, 50);
    g.fillStyle(MOON, 1).fillTriangle(
      boss.x - 12,
      boss.y - 150 + bob,
      boss.x + 12,
      boss.y - 150 + bob,
      boss.x,
      boss.y - 130 + bob,
    );
  }
  // Motes from splits, pops, relights and dawn.
  m.motes = m.motes.filter((d) => (d.age += dt) < d.life);
  for (const d of m.motes) {
    const x = d.x + d.vx * d.age,
      y = d.y + d.vy * d.age;
    g.fillStyle(d.color, 0.9 * (1 - d.age / d.life)).fillCircle(
      x,
      y,
      d.size * (1 - d.age / d.life / 2),
    );
  }
  if (dead) {
    // Dawn: a warm glow rises where it faded.
    g.fillStyle(LAMP, 0.18 * fade).fillCircle(boss.x, boss.y - 40, 90 * fade);
  }
  return cues;
}

function nearestLight(state: Snapshot, x: number, y: number) {
  const r = state.raid!;
  const sources = [
    ...(r.lanterns ?? []).filter((l) => l.lit).map((l) => ({ x: l.x, y: l.y })),
    ...(r.lights ?? [])
      .filter((l) => l.until > state.time)
      .map((l) => ({ x: l.x, y: l.y })),
  ];
  return sources.sort(
    (a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
  )[0];
}

interface ShadeLook {
  x: number;
  y: number;
  t: number;
  facing: number;
  motion: number;
  life: BossLifePose;
  shadow?: { x: number; y: number };
  shadowAlpha: number;
  flicker: boolean;
  alpha: number;
  hurt: boolean;
  gilded: boolean;
  stagger: boolean;
  exposed: boolean;
  dead: boolean;
}
/** One shadow puff: round body, floppy ears, big eyes, a crescent-moon tail. */
function shade(g: G, o: ShadeLook) {
  const { t, facing, motion, alpha } = o;
  if (alpha <= 0.01) return;
  const bob = Math.sin(t * 2.2) * 6 * motion;
  const x = o.x,
    y = o.y - 46 + bob + o.life.windup * 7;
  // Only the real one casts a shadow, and only in light: stretched away
  // from the light source along the floor.
  if (o.shadow) {
    const d = Math.hypot(o.x - o.shadow.x, o.y - o.shadow.y) || 1;
    const sx = (o.x - o.shadow.x) / d,
      sy = (o.y - o.shadow.y) / d;
    for (let k = 0; k < 5; k++)
      g.fillStyle(NIGHT, o.shadowAlpha * alpha).fillEllipse(
        o.x + sx * (18 + k * 14),
        o.y + 18 + sy * (8 + k * 10),
        96 - k * 8,
        32 - k * 3,
      );
  }
  const body = o.hurt ? 0x6e5aa8 : o.gilded ? 0x4a3d62 : SHADE;
  const top = o.gilded ? 0x8a7a52 : SHADE_TOP;
  // Tail: a crescent moon on a wisp, flickering on the real one.
  const tailFlick = o.flicker
    ? 0.3 + 0.7 * Math.abs(Math.sin(t * 7.3) * Math.sin(t * 3.1 + 1))
    : 1;
  const tx = x - facing * (92 + Math.sin(t * 1.7 - 0.5) * 5 * motion),
    ty = y - 6 + Math.sin(t * 3) * 4 * motion;
  // A wisp of shadow curling out to the moon.
  g.fillStyle(body, 0.95 * alpha)
    .fillCircle(x - facing * 56, y + 16, 13)
    .fillCircle(x - facing * 70, y + 8, 10)
    .fillCircle(tx + facing * 4, ty + 10, 8);
  if (o.flicker)
    g.fillStyle(MOON, 0.22 * alpha * tailFlick).fillCircle(tx, ty - 6, 30);
  crescent(
    g,
    tx,
    ty - 6,
    22,
    facing > 0 ? 0 : Math.PI,
    MOON,
    alpha * tailFlick,
  );
  // Wispy hem: scallops trailing beneath.
  for (let k = -3; k <= 3; k++) {
    const sway = Math.sin(t * 4 + k) * 3 * motion;
    g.fillStyle(SHADE_EDGE, 0.95 * alpha).fillCircle(
      x + k * 15 + sway,
      y + 40 + Math.abs(k) * -2,
      12,
    );
  }
  // The round body.
  const squash = Math.sin(t * 2.2) * 2 * motion;
  g.fillStyle(SHADE_EDGE, alpha).fillEllipse(
    x + 2,
    y + 3,
    104 + squash,
    104 - squash,
  );
  g.fillStyle(body, alpha).fillEllipse(x, y, 100 + squash, 100 - squash);
  g.fillStyle(top, 0.6 * alpha).fillEllipse(x - facing * 10, y - 22, 64, 36);
  // Floppy ears hanging down each side, swaying.
  const ear = Math.sin(t * 1.8) * 5 * motion;
  for (const side of [-1, 1]) {
    const ex = x + side * 40;
    g.save()
      .translateCanvas(ex, y - 30)
      .rotateCanvas(side * (0.12 + o.life.windup * 0.2) + ear * 0.012);
    g.fillStyle(SHADE_EDGE, alpha).fillEllipse(side * 6, 26, 30, 70);
    g.fillStyle(body, alpha).fillEllipse(side * 4, 24, 26, 66);
    g.fillStyle(0x7d66ab, 0.7 * alpha).fillEllipse(side * 3, 32, 12, 40);
    g.restore();
  }
  // Too many eyes: little ones scattered over the top, blinking now and then.
  if (!o.dead)
    for (const [i, [ex, ey]] of (
      [
        [-30, -26],
        [28, -30],
        [-6, -38],
        [36, -6],
      ] as const
    ).entries()) {
      const blink = motion && Math.sin(t * 0.9 + i * 2.3) > 0.93;
      if (blink)
        g.lineStyle(2, EYE, 0.8 * alpha).lineBetween(
          x + ex - 4,
          y + ey,
          x + ex + 4,
          y + ey,
        );
      else {
        g.fillStyle(EYE, 0.85 * alpha).fillCircle(x + ex, y + ey, 4);
        g.fillStyle(SHADE_EDGE, alpha).fillCircle(
          x + ex + facing,
          y + ey + 0.5,
          2,
        );
      }
    }
  // The core: a little moon-heart in its chest, shown when it's exposed.
  if (o.exposed || o.stagger) {
    const beat = motion ? 0.8 + Math.sin(t * 9) * 0.2 : 1;
    g.fillStyle(MOON, 0.35 * beat * alpha).fillCircle(x, y + 28, 18);
    g.fillStyle(LAMP_HOT, alpha).fillCircle(x, y + 28, 8);
  }
  // Eyes: big and glowing; dizzy when staggered; closed at dawn.
  for (const side of [-1, 1]) {
    const ex = x + side * 17 + facing * 5,
      ey = y - 8;
    if (o.dead) {
      g.lineStyle(3, EYE, alpha)
        .beginPath()
        .arc(ex, ey, 8, 0.2, Math.PI - 0.2, false)
        .strokePath();
      continue;
    }
    if (o.stagger) {
      g.lineStyle(3, EYE, alpha).strokeCircle(ex, ey, 8);
      g.lineStyle(2, EYE, alpha).strokeCircle(ex, ey, 3);
      continue;
    }
    const open = Math.max(0.08, 1 - o.life.blink);
    g.fillStyle(EYE, 0.16 * alpha).fillEllipse(ex, ey, 29, 29 * open);
    g.fillStyle(EYE, alpha).fillEllipse(ex, ey, 18, 22 * open);
    g.fillStyle(SHADE_EDGE, alpha).fillEllipse(
      ex + facing * 2 + o.life.lookX,
      ey + 2 * open,
      9,
      13 * open,
    );
    if (open > 0.3)
      g.fillStyle(0xffffff, alpha).fillCircle(
        ex + facing * 4,
        ey - 4 * open,
        2.5,
      );
  }
  // Every copy shares the same casting expression; only the taught tells identify the real boss.
  if (o.life.windup > 0.2 && !o.dead)
    g.fillStyle(EYE, alpha * 0.8).fillEllipse(
      x + facing * 5,
      y + 13,
      10,
      3 + o.life.windup * 8,
    );
  // A tiny smile.
  g.lineStyle(2.5, EYE, 0.8 * alpha)
    .beginPath()
    .arc(x + facing * 5, y + 10, 7, 0.3, Math.PI - 0.3, false)
    .strokePath();
  if (o.stagger)
    for (let i = 0; i < 3; i++) {
      const a = t * 4 + (i * Math.PI * 2) / 3;
      g.fillStyle(0xfff1a0, alpha).fillCircle(
        x + Math.cos(a) * 36,
        y - 62 + Math.sin(a) * 8,
        4,
      );
    }
}

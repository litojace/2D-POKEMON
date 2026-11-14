import { paintInkpurr } from "./boss-inkpurr-rig";
import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossLife } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  GLOOMSHADE,
  handsTileDark,
  lanternRadius,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import type { RaidBossCue } from "./raid-boss-motion";
import type { LayerAt } from "./raid-layers";
import { fxFor } from "./fx-engine";
import { dropAtlas, pieceAtlas, stageOn } from "./raid-piece-stage";
import {
  BALL_RADIUS,
  RELIGHT_SHOW,
  RELIGHT_SPREAD,
  hitRing,
  mistBanks,
  nightAlpha,
  nightSlices,
  pipSpot,
  poolLook,
  relightSparks,
  smokePuffs,
  snuffBlend,
  yardPieces,
} from "./raid-yard-pieces";

/**
 * Gloomshade and the Lantern Yard each frame: the night closing in,
 * lanterns and their light (images from the yard's atlas,
 * raid-yard-pieces.ts), curses on raiders, every warning, and the shadow
 * puff itself with its copies. Warning edges are exact server radii; only
 * fills pulse, so the danger boundary never moves.
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
  DANGER = 0xff4059;

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
  exposed = false;
  seen = new Set<number>();
  hurtAt = -10;
  splitAt = -10;
  deathAt = -1;
  roarAt = -10;
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
export function drawLanternYard(
  g: G,
  state: Snapshot,
  reduced: boolean,
  at?: LayerAt,
  clock = state.time,
) {
  const r = state.raid!;
  const t = state.time;
  const lanterns = r.lanterns ?? [];
  // The yard's pieces: lantern posts, light, the night and every lantern
  // warning, as images (raid-yard-pieces.ts). Posts stand up: each sorts
  // with the raiders by its base.
  paintYard(g, state, reduced, clock, (i) =>
    at ? at(`lantern-${i}`, lanterns[i].y + 30) : g,
  );
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

/** Per-yard memory: which lanterns were lit, and when each came back. */
interface YardMemory {
  seed: number;
  serverTime: number;
  lit: boolean[];
  relitAt: number[];
}
const yards = new WeakMap<G, YardMemory>();

/** The yard's atlas for a light reach (drawn once per look). */
const yardAtlasKey = (reach: number) => `yard-atlas-${reach}`;
export function yardAtlas(scene: Phaser.Scene, reach: number) {
  for (const other of [GLOOMSHADE.lightRadius, GLOOMSHADE.moonlitLightRadius])
    if (other !== reach) dropAtlas(scene, yardAtlasKey(other));
  return pieceAtlas(scene, yardAtlasKey(reach), () => yardPieces(reach));
}
/** Draw the yard's atlas now (when the arena scene is created). */
export function prewarmYard(scene: Phaser.Scene, trait?: string) {
  yardAtlas(scene, lanternRadius(trait ?? ""));
}

/**
 * The Lantern Yard's pieces this frame. The floor (night, light pools and
 * their exact edges, Ball Lightning, the snuff's shade) rides just under
 * the yard's graphics `g`, as the old drawing sat first in it; each post,
 * its pips, ring, timer and relight sparks ride on its own sorted layer.
 * Light edges are drawn at the server's exact radius and never flicker:
 * only fills do.
 */
function paintYard(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
  layer: (i: number) => G,
) {
  const r = state.raid!;
  const t = state.time;
  const lanterns = r.lanterns ?? [];
  const floor = stageOn(g, "arena-pieces:yard-floor", g.depth - 0.001);
  // Posts still sort by their base (a layer each), even without a scene.
  const layers = lanterns.map((_, i) => layer(i));
  if (!floor) return;
  const reach = lanternRadius(r.trait);
  const A = yardAtlas(g.scene, reach);
  const fx = fxFor(g.scene);
  // Low quality: no mist or halos, fewer sparks.
  const low = fx.density < 0.5;
  const live = state.phase === "playing";
  // Lanterns coming back: when, for the spreading light and sparks.
  let m = yards.get(g);
  if (!m || m.seed !== r.seed || t < m.serverTime) {
    m = {
      seed: r.seed,
      serverTime: t,
      lit: lanterns.map((l) => l.lit),
      relitAt: [],
    };
    yards.set(g, m);
  }
  m.serverTime = t;
  for (const [i, l] of lanterns.entries()) {
    if (m.lit[i] === false && l.lit && live) m.relitAt[i] = clock;
    if (!l.lit) m.relitAt[i] = -99;
    m.lit[i] = l.lit;
  }
  const relightAge = (i: number) => {
    const age = clock - (m!.relitAt[i] ?? -99);
    return age >= 0 && age < RELIGHT_SHOW ? age : undefined;
  };
  // The snuff being cast, and how far along.
  const snuffs = new Map<number, number>();
  for (const w of r.warnings)
    if (w.kind === "snuff" && lanterns[w.lantern ?? -1])
      snuffs.set(w.lantern!, progressOf(w, t));
  const out = lanterns.filter((l) => !l.lit).length;
  const na = nightAlpha(out, lanterns.length);
  const flickerT = reduced ? 0 : clock;

  // Out lanterns leave a pool of dark where their light was.
  for (const l of lanterns)
    if (!l.lit) floor.put(A, `dark${reach}`, l.x, l.y, { alpha: 0.9 });
  // The night at the edges: eight frames of one texture, the middle empty.
  for (const s of nightSlices()) floor.slice(A, s.name, s.x, s.y, s.w, s.h, na);
  // Mist drifting along the hedges, thicker as lanterns go out.
  if (!low)
    for (const b of mistBanks(clock, reduced))
      floor.put(A, "mist", b.x, b.y, {
        alpha: na * 0.9,
        sx: 1.1,
        sy: 1,
        rot: b.rot,
      });
  // Light pools (additive), the snuff's shade, then the exact edges.
  for (const [i, l] of lanterns.entries()) {
    if (!l.lit) continue;
    const look = poolLook(i, flickerT, reduced, snuffs.get(i), relightAge(i));
    floor.put(A, `pool${reach}`, l.x, l.y, {
      alpha: look.alpha,
      sx: look.scale,
      add: true,
    });
  }
  for (const [i, p] of snuffs) {
    const l = lanterns[i],
      b = snuffBlend(p);
    floor.put(A, `shade${reach}_${b.f0}`, l.x, l.y, { alpha: b.a0 });
    floor.put(A, `shade${reach}_${b.f1}`, l.x, l.y, { alpha: b.a1 });
  }
  for (const [i, l] of lanterns.entries()) {
    if (!l.lit) continue;
    const age = relightAge(i);
    floor.put(A, `rim${reach}`, l.x, l.y, {
      alpha: age === undefined ? 1 : Math.min(1, age / RELIGHT_SPREAD),
    });
  }
  // The snuff's red edge, exactly at the reach.
  for (const [i] of snuffs)
    floor.put(A, `snuffEdge${reach}`, lanterns[i].x, lanterns[i].y);
  // Ball Lightning's patches of light: cool white, fading out.
  for (const b of r.lights ?? []) {
    const left = b.until - t;
    if (left <= 0) continue;
    const fade = Math.min(1, left / 0.6);
    const pop = reduced
      ? 1
      : Math.min(1, (GLOOMSHADE.sparkLight - left) / 0.15 + 0.2);
    const s = b.radius / BALL_RADIUS;
    floor.put(A, "ballPool", b.x, b.y, { alpha: fade * pop, sx: s, add: true });
    floor.put(A, "ballRim", b.x, b.y, { alpha: fade, sx: s });
    floor.put(A, "ballCore", b.x, b.y, {
      alpha: fade * (reduced ? 1 : 0.85 + 0.15 * Math.sin(clock * 31)),
      add: true,
    });
    for (let k = 0; k < 4; k++)
      floor.put(A, "bolt", b.x, b.y, {
        alpha: fade,
        rot: (reduced ? 0 : clock * 5) + (k * Math.PI) / 2,
        add: true,
      });
  }

  // The posts, each on its own sorted layer.
  for (const [i, l] of lanterns.entries()) {
    const post = stageOn(layers[i], "arena-pieces:lantern-" + i);
    if (!post) continue;
    const { x, y } = l;
    const snuff = snuffs.get(i);
    const age = relightAge(i);
    if (l.lit) {
      post.put(A, "contact", x + 2, y + 31);
      post.put(A, "postLit", x, y);
      let f = reduced ? 1 : 0.85 + Math.sin(clock * 11 + i * 2) * 0.15;
      if (snuff !== undefined)
        f *=
          (1 - 0.55 * snuff) *
          (reduced ? 1 : 0.85 + 0.15 * Math.sin(clock * 47));
      const pop = age === undefined ? 1 : Math.min(1, age / 0.2);
      if (!low)
        post.put(A, "halo", x, y - 38, { alpha: 0.8 * f * pop, add: true });
      post.put(A, "flame", x, y - 29.5, {
        alpha: pop,
        sx: (0.9 + 0.1 * f) * pop,
        sy: f * pop,
      });
    } else {
      post.put(A, "moonShadow", x - 2, y + 29, { alpha: 0.85 });
      post.put(A, "contact", x + 2, y + 31, { alpha: 0.9 });
      post.put(A, "postOut", x, y);
      // Out: a thin curl of smoke, and pips for the hits it needs.
      for (const s of smokePuffs(x, y, i, t, reduced))
        post.put(A, "smoke", s.x, s.y, {
          alpha: s.alpha,
          sx: s.scale,
          rot: s.rot,
        });
      post.put(A, "plate", x, y - 84);
      for (let h = 0; h < GLOOMSHADE.relightHits; h++) {
        const spot = pipSpot(x, y, h);
        post.put(A, h < l.hits ? "pipOn" : "pipOff", spot.x, spot.y);
      }
      // A gentle "hit me" ring so it's easy to find in the dark.
      const ring = hitRing(t, reduced);
      post.put(A, "ring", x, y - 40, { alpha: ring.alpha, sx: ring.scale });
    }
    // The snuff's timer around the lamp.
    if (snuff !== undefined) {
      post.lines.lineStyle(8, 0x0c081a, 0.45).strokeCircle(x, y - 40, 32);
      post.lines
        .lineStyle(5, 0xffd1d6, 0.95)
        .beginPath()
        .arc(
          x,
          y - 40,
          32,
          -Math.PI / 2,
          -Math.PI / 2 + snuff * Math.PI * 2,
          false,
        )
        .strokePath();
    }
    // Relit: a warm flash and sparks thrown up out of the lamp.
    if (age !== undefined && !reduced) {
      const k = Math.max(0, 1 - age / 0.6);
      post.put(A, "flash", x, y - 40, {
        alpha: k,
        sx: 0.5 + age * 1.6,
        add: true,
      });
      for (const s of relightSparks(x, y - 40, age, low ? 4 : 12))
        post.put(A, "sparkWarm", s.x, s.y, {
          alpha: s.alpha,
          sx: s.scale,
          rot: s.rot,
          add: true,
        });
    }
  }
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
    // Drawn with the yard (drawLanternYard): the shade creeping in under
    // the light's edge, the exact red edge and the timer around the lamp.
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

/** Gloomshade and its copies: drifting, splitting, found, staggered, fading at dawn. */
export function drawGloomshade(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
  at?: LayerAt,
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
  // (A relit lantern's sparks are the yard's: drawLanternYard.)
  const exposed = r.exposedUntil > state.time;
  if (exposed && !m.exposed && live) cues.push("crash");
  m.exposed = exposed;
  if (boss.hp < m.hp && boss.hp > 0) {
    m.hurtAt = m.time;
    cues.push(exposed || r.staggerUntil > state.time ? "core" : "chip");
  }
  if (r.phase > m.phase && live) {
    cues.push("awaken");
    m.roarAt = m.time;
  }
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
  // dawn: it melts into its puddle, and the puddle fades (the pose times both)
  const fade = dead ? (reduced ? 1 : Math.min(1, (t - m.deathAt) / 3.4)) : 0;
  // The attack being wound up (its warning) and the last one cast: every
  // copy shares the real one's casting pose (the tells are elsewhere).
  const wind = r.warnings.find(
    (w) =>
      (!w.casterId || w.casterId === boss.id) &&
      w.at >= state.time &&
      (w.startedAt ?? w.at - 1.5) <= state.time,
  );
  const cast = life.action.casts[life.action.casts.length - 1];
  // Copies first, so the real one draws on top where they overlap.
  const bodies = [
    ...(r.decoys ?? []).map((d) => ({ x: d.x, y: d.y, real: false, id: d.id })),
    { x: boss.x, y: boss.y, real: true, id: 0 },
  ];
  const appear = Math.min(1, (t - m.splitAt) / 0.4);
  for (const b of bodies) {
    const shake = b.real ? Math.sin(hurt * Math.PI * 3) * hurt * 6 * motion : 0;
    // Each body (the real one and every copy) sorts with the raiders.
    shade(at ? at(`shade-${b.id}`, b.y + 12) : g, {
      key: `shade-${b.id}`,
      x: b.x + shake,
      y: b.y,
      angle: boss.angle,
      clock: t + b.id * 0.37,
      phase: r.phase,
      reduced,
      windKind: wind?.kind,
      windup: life.windup,
      castKind: cast?.kind,
      castAge: cast?.age ?? 99,
      roarAge: t - m.roarAt,
      // The two tells: a shadow in lantern light, and a flickering moon.
      shadow:
        b.real && litAt(state, b.x, b.y)
          ? nearestLight(state, b.x, b.y)
          : undefined,
      // Hollow trait: the real one's shadow is fainter.
      shadowAlpha: r.trait === "hollow" ? 0.22 : 0.4,
      flicker: b.real && !reduced,
      alpha: b.real ? 1 : appear * (1 - fade),
      // a copy is drawn exactly alike, minus the idle drips
      cheap: !b.real,
      hurt: b.real ? hurt : 0,
      gilded: !!r.gilded,
      stagger: b.real && stagger,
      exposed: b.real && exposed,
      dead: b.real && dead,
      deadAge: dead ? t - m.deathAt : 0,
    });
  }
  // Found: a golden ring and arrow over the real one.
  if ((revealed || exposed) && !dead) {
    const bob = reduced ? 0 : Math.sin(t * 4) * 4;
    g.lineStyle(3, MOON, 0.9).strokeEllipse(
      boss.x,
      boss.y + 12,
      150,
      groundHeight(150),
    );
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
  key: string;
  /** The floor under the body. */
  x: number;
  y: number;
  angle: number;
  clock: number;
  phase: number;
  reduced: boolean;
  windKind?: string;
  windup: number;
  castKind?: string;
  castAge: number;
  roarAge: number;
  shadow?: { x: number; y: number };
  shadowAlpha: number;
  flicker: boolean;
  cheap?: boolean;
  alpha: number;
  hurt: number;
  gilded: boolean;
  stagger: boolean;
  exposed: boolean;
  dead: boolean;
  deadAge: number;
}
/** From the boss's position to the floor under its puddle (world pixels). */
const FEET = 16;
/**
 * One body (the real one or a copy): Inkpurr (boss-inkpurr-rig.ts). The real
 * one standing in lantern light also casts its shadow along the floor, away
 * from the light (`shadow`); copies never do.
 */
function shade(g: G, o: ShadeLook) {
  if (o.alpha <= 0.01) return;
  paintInkpurr(g, o.key, { ...o, y: o.y + FEET });
}

import { paintVectorTide } from "./boss-vector-tide-rig";
import { groundHeight } from "../../../packages/shared/src/world-art";
import { bossLife } from "./raid-boss-life";
import { bossSurface } from "./boss-materials";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import { TIDEWYRM, type RaidWarning } from "../../../packages/shared/src/raid";
import type { RaidBossCue } from "./raid-boss-motion";
import {
  beginMapFrame,
  mapAtlas,
  mapLayers,
  raidMapLow,
} from "./raid-map-atlas";
import { FLOOD, lagoonName, lagoonPieces } from "./raid-lagoon-pieces";

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
  /** When the last new phase began (its roar). */
  roarAt = -10;
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

/** Texels per world unit in the lagoon's atlas (sharp on 2x screens). */
const LAGOON_K = 2;
const lagoonKey = (R: number) => `lagoon-atlas-${R}`;
const lagoonAtlas = (scene: Phaser.Scene, R: number) =>
  mapAtlas(scene, lagoonKey(R), () => lagoonPieces(R), LAGOON_K);
/** The islands' radius in this raid (Spring Tide makes them bigger). */
const islandRadius = (state: Snapshot) =>
  state.raid?.islands?.[0]?.radius ??
  (state.raid?.trait === "spring-tide"
    ? TIDEWYRM.springIslandRadius
    : TIDEWYRM.islandRadius);
/** Draw the lagoon's atlas now (the arena scene is being created), not mid-fight. */
export function prewarmLagoon(scene: Phaser.Scene, state: Snapshot) {
  if (state.raid?.boss === "tidewyrm") lagoonAtlas(scene, islandRadius(state));
}
export const lagoonAtlasKey = lagoonKey;

/** How long an island takes to go under, or to come back up (seconds). */
const SINK_SECONDS = 0.9;
interface IslandMemory {
  sunk: boolean;
  anim?: { kind: "sinking" | "rising"; at: number };
}
const lagoonMemory = new WeakMap<
  G,
  { seed: number; islands: IslandMemory[] }
>();
const ease = (p: number) => p * p * (3 - 2 * p);

/**
 * The floor features: islands (dry, cracked, sinking, sunk, gone, rising) and
 * the High Tide flood around them, as painted pieces (raid-lagoon-pieces.ts).
 */
export function drawLagoon(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock = state.time,
) {
  const r = state.raid!;
  const islands = r.islands ?? [];
  const scene = g.scene;
  if (!scene) return;
  const R0 = islandRadius(state);
  const layers = beginMapFrame(g, lagoonAtlas(scene, R0));
  if (!layers) return;
  const L = layers.under;
  const low = raidMapLow();
  const t = state.time;
  const m = reduced ? 0 : 1;
  // What changed since the last frame: an island going under or coming back.
  let mem = lagoonMemory.get(g);
  if (!mem || mem.seed !== r.seed || mem.islands.length !== islands.length) {
    mem = { seed: r.seed, islands: islands.map((i) => ({ sunk: !!i.sunk })) };
    lagoonMemory.set(g, mem);
  }
  const flooded = (r.floodUntil ?? 0) > t;
  if (flooded) {
    // Water over the whole floor; islands stay dry above it.
    const rise = Math.min(
      1,
      (t - ((r.floodUntil ?? 0) - TIDEWYRM.highTide.seconds)) / 0.6,
    );
    L.put("flood", FLOOD.x, FLOOD.y, { a: Math.max(0.3, rise) });
    // Rolling swell rows across the flood (the same 180 px drift as before).
    const off = (m * t * 50) % 180;
    for (let j = 0; j < 7; j++)
      L.put("swell", 60 + off - 90, 70 + j * 116 - 24, { a: 0.45 * rise });
  }
  const riseOf = Math.min(
    1,
    (t - ((r.floodUntil ?? 0) - TIDEWYRM.highTide.seconds)) / 0.6,
  );
  const N = lagoonName;
  for (const [i, isl] of islands.entries()) {
    const { x, y } = isl;
    const R = isl.radius;
    const seen = mem.islands[i];
    if (!!isl.sunk !== seen.sunk) {
      seen.anim = reduced
        ? undefined
        : { kind: isl.sunk ? "sinking" : "rising", at: clock };
      seen.sunk = !!isl.sunk;
    }
    const q = seen.anim ? (clock - seen.anim.at) / SINK_SECONDS : 1;
    if (q >= 1 || q < 0) seen.anim = undefined;
    const an = seen.anim,
      p = an ? ease(q) : 0;
    if (isl.gone && !an) {
      L.put(N.gone(R), x, y);
      continue;
    }
    // How much of the dry island shows (1 dry, 0 under water).
    const dry = !an ? (isl.sunk ? 0 : 1) : an.kind === "sinking" ? 1 - p : p;
    if (dry < 1) {
      L.put(isl.gone ? N.gone(R) : N.sunk(R), x, y, { a: 1 - dry });
      if (!isl.gone && dry === 0 && !low)
        for (let b = 0; b < 2; b++) {
          // Bubbles rise from the "comes back" ring.
          const ph = reduced
              ? 0.4 + b * 0.3
              : (t * 0.55 + b * 0.5 + i * 0.21) % 1,
            ang = i * 1.7 + b * 2.6;
          L.put(
            "drop",
            x + Math.cos(ang) * R * 0.35,
            y + Math.sin(ang) * R * 0.35 - ph * 10,
            { s: 0.8 + ph * 0.9, a: 0.85 * Math.sin(ph * Math.PI) },
          );
        }
    }
    if (an) {
      // A ring of spray leaves the shore as it goes under / closes in as it rises.
      const rr = an.kind === "sinking" ? R + 4 + q * 46 : R + 40 - q * 36;
      L.put("ripple", x, y, { s: rr / 100, a: 0.9 * Math.sin(q * Math.PI) });
      L.put("ripple", x, y, {
        s: (rr - 14) / 100,
        a: 0.5 * Math.sin(q * Math.PI),
        rot: 1.3,
      });
    }
    if (dry <= 0) continue;
    const sb = an ? 0.955 + 0.045 * dry : 1;
    L.put(N.base(R), x, y, { a: (flooded ? 0.4 : 1) * dry });
    if (!flooded && !an && !low)
      for (let r2 = 0; r2 < 2; r2++) {
        const ph = reduced
          ? 0.35 + r2 * 0.4
          : (t * 0.32 + r2 / 2 + i * 0.13) % 1;
        L.put("ripple", x, y, {
          s: (R + 5 + ph * 30) / 100,
          rot: r2 * 2.1 + i,
          a: 0.5 * (1 - ph) * Math.min(1, ph * 5),
        });
      }
    // Foam where the flood laps at the shore, at R + 10.
    if (flooded)
      L.put(N.surf(R), x, y, {
        s: (R + 10 + m * Math.sin(t * 4 + i) * 2) / (R + 10),
        a: Math.min(1, riseOf * 1.4) * dry,
      });
    L.put(N.body(R), x, y, { s: sb, a: dry });
    // Cracks from strands: one more and it sinks.
    for (let c = 0; c < Math.min(2, isl.cracks); c++)
      L.put(N.crack(R, i, c), x, y, { s: sb, a: dry });
    if (isl.cracks >= 2)
      L.put(N.soggy(R), x, y, {
        s: sb,
        a: dry * (0.75 + 0.25 * Math.sin(t * 3 * m + i)),
      });
    const f = 0.5 + 0.5 * Math.sin(t * 1.3 * m + i * 1.7),
      fs = 1 + m * 0.01 * Math.sin(t * 1.4 + i);
    L.put(N.foamA(R), x, y, { s: fs * sb, a: (0.45 + 0.55 * f) * dry });
    L.put(N.foamB(R), x, y, {
      s: fs * sb,
      rot: 0.4,
      a: (0.45 + 0.55 * (1 - f)) * dry,
    });
    if (!low) {
      const gl = reduced ? 0.6 : Math.max(0, Math.sin(t * 2.3 + i * 2.1));
      L.put(
        "glint",
        x + Math.cos(-2.35) * (R - 3),
        y + Math.sin(-2.35) * (R - 3),
        {
          add: true,
          a: gl * dry,
          s: 0.8 + gl * 0.4,
        },
      );
    }
    // Under High Tide, show how full each island is (two fit).
    if (flooded && r.partySize > 1 && !isl.sunk) {
      const on = state.players.filter(
        (pl) => !pl.raidBoss && pl.hp > 0 && Math.hypot(pl.x - x, pl.y - y) < R,
      ).length;
      for (let s = 0; s < TIDEWYRM.islandCapacity; s++)
        L.put(s < on ? "pipOn" : "pipOff", x - 9 + s * 18, y - R - 16);
      if (on > TIDEWYRM.islandCapacity) {
        const pulse = reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 8);
        if (!low) L.put(N.redGlow(R), x, y, { add: true, a: 0.8 * pulse });
        // The exact over-capacity ring at R + 3.
        L.put(N.red(R), x, y);
      }
    }
  }
}

/** High Tide's warning: the water's edge glows all round; get on an island. */
function drawHighTideWarning(
  g: G,
  state: Snapshot,
  progress: number,
  pulse: number,
  reduced: boolean,
) {
  const L = mapLayers(g)?.under;
  if (!L) return;
  const low = raidMapLow();
  const t = state.time;
  const glow = 10 + progress * 30;
  const ga = (0.4 + 0.6 * (glow / 40)) * pulse;
  // Glow strips grow inward with progress, like the flat band did.
  const x0 = 36,
    y0 = 36,
    x1 = 1564,
    y1 = 864,
    c = 40;
  const hw = (x1 - x0 - 2 * c) / 64,
    vh = (y1 - y0 - 2 * c) / 64;
  L.put("rimGlow", x0 + c, y0, { sx: hw, sy: glow / 40, a: ga });
  L.put("rimGlow", x1 - c, y1, { rot: Math.PI, sx: hw, sy: glow / 40, a: ga });
  L.put("rimGlow", x0, y1 - c, {
    rot: -Math.PI / 2,
    sx: vh,
    sy: glow / 40,
    a: ga,
  });
  L.put("rimGlow", x1, y0 + c, {
    rot: Math.PI / 2,
    sx: vh,
    sy: glow / 40,
    a: ga,
  });
  L.put("rimLine", x0 + c, y0, { sx: hw });
  L.put("rimLine", x1 - c, y1, { rot: Math.PI, sx: hw });
  L.put("rimLine", x0, y1 - c, { rot: -Math.PI / 2, sx: vh });
  L.put("rimLine", x1, y0 + c, { rot: Math.PI / 2, sx: vh });
  L.put("rimCorner", x0 + c, y0 + c);
  L.put("rimCorner", x1 - c, y0 + c, { rot: Math.PI / 2 });
  L.put("rimCorner", x1 - c, y1 - c, { rot: Math.PI });
  L.put("rimCorner", x0 + c, y1 - c, { rot: -Math.PI / 2 });
  for (const island of state.raid!.islands ?? [])
    if (!island.sunk && !island.gone) {
      const R = island.radius;
      if (!low)
        L.put(lagoonName.goldGlow(R), island.x, island.y, {
          add: true,
          a: 0.45 + 0.4 * pulse,
        });
      // The exact ring at R + 10.
      L.put(lagoonName.gold(R), island.x, island.y, { a: 0.6 + 0.4 * pulse });
      L.put(
        "chevron",
        island.x,
        island.y - R - 16 - (reduced ? 0 : Math.abs(Math.sin(t * 4)) * 3),
      );
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
    drawHighTideWarning(g, state, progress, pulse, reduced);
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
  if (r.phase > m.phase && live) {
    cues.push("awaken");
    m.roarAt = m.time;
  }
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
        groundHeight(120 + p * 70),
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
  // The attack being wound up (its warning) and the last one cast.
  const wind = r.warnings.find(
    (w) =>
      (!w.casterId || w.casterId === boss.id) &&
      w.at >= state.time &&
      (w.startedAt ?? w.at - 1.5) <= state.time,
  );
  const cast = life.action.casts[life.action.casts.length - 1];
  const islands = (r.islands ?? []).filter((i) => !i.sunk && !i.gone);
  const head = paintVectorTide(g, {
    x: boss.x + Math.sin(hurt * Math.PI * 3) * hurt * 6 * motion,
    y: boss.y + 30,
    angle: boss.angle,
    clock: t,
    phase: r.phase,
    reduced,
    gilded: !!r.gilded,
    windKind: wind?.kind,
    windup: life.windup,
    castKind: cast?.kind,
    castAge: cast?.age ?? 99,
    stranded,
    stagger,
    hurt,
    dead,
    rise,
    deathSink: sink,
    roarAge: t - m.roarAt,
    // Water everywhere but the islands' sand.
    wet: (x, y) =>
      !islands.some((i) => Math.hypot(x - i.x, y - i.y) < i.radius),
  });
  if (head) {
    if (stagger && !stranded)
      for (let i = 0; i < 3; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 3;
        g.fillStyle(0xfff1a0, 1).fillCircle(
          head.head.x + Math.cos(a) * 34,
          head.head.y - 46 + Math.sin(a) * 8,
          4,
        );
      }
    if (stranded && !dead)
      for (let i = 0; i < 4; i++) {
        const a = t * 4 + (i * Math.PI * 2) / 4;
        g.fillStyle(0xfff1a0, 1).fillCircle(
          head.head.x + Math.cos(a) * 30,
          head.head.y - 30 + Math.sin(a) * 8,
          3.5,
        );
      }
    if (dead)
      for (let i = 0; i < 4; i++) {
        const p = reduced ? i / 4 : (t * 0.6 + i / 4) % 1;
        g.lineStyle(2, PEARL_GLOW, 1 - p).strokeCircle(
          head.pearl.x + i * 8 - 12,
          boss.y + 20 - p * 70,
          4 + p * 6,
        );
      }
  }
  paintDrops();
  return cues;
}

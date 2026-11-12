import { paintVectorTwin } from "./boss-vector-twins-rig";
import { paintBossAura } from "./boss-spell-art";
import { bossLife } from "./raid-boss-life";
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
import { fxFor } from "./fx-engine";
import { pieceAtlas, stageOn } from "./raid-piece-stage";
import {
  BOLT_VARIANTS,
  FIELD,
  PAD,
  bandThickness,
  fieldBolts,
  fieldEdgeLook,
  hash,
  orbOf,
  postStates,
  ringPieces,
} from "./raid-ring-pieces";
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
export function drawConductorRing(
  g: G,
  state: Snapshot,
  reduced: boolean,
  at?: LayerAt,
  clock = state.time,
) {
  const r = state.raid!;
  // The posts stand up, so each sorts with the raiders (a layer each).
  const posts = S.posts.map((p, i) => (at ? at(`post-${i}`, p.y + 17) : g));
  const [a, b] = state.players.filter((p) => p.raidBoss);
  if (a && b && a.hp > 0 && b.hp > 0 && !r.stormBeam) {
    g.lineStyle(2, 0xa3dfff, 0.2).lineBetween(a.x, a.y, b.x, b.y);
  }
  // Chain lightning stays a quick vector bolt.
  if (r.stormChain && r.stormChain.until > state.time)
    for (let i = 1; i < r.stormChain.points.length; i++)
      bolt(g, r.stormChain.points[i - 1], r.stormChain.points[i], 0xaddfff);
  paintRing(g, state, reduced, clock, posts);
}

/** The ring's atlas (drawn once). */
const RING_ATLAS = "ring-atlas";
export function ringAtlas(scene: Phaser.Scene) {
  return pieceAtlas(scene, RING_ATLAS, ringPieces);
}
/** Draw the ring's atlas now (when the arena scene is created). */
export function prewarmRing(scene: Phaser.Scene) {
  ringAtlas(scene);
}
/**
 * The conductor ring's pieces this frame (raid-ring-pieces.ts): charge
 * pulses on the filament, post shadows and floor light, static fields, the
 * polarity pad and the live beam ride just under the arena graphics `g`
 * (where the old drawing sat, first in it); each post rides on its own
 * sorted layer; polarity marks ride over the raiders. Gameplay edges (pad
 * rim 58, field edge 100, beam band 44) are drawn at their exact sizes.
 */
function paintRing(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock: number,
  layers: G[],
) {
  const floor = stageOn(g, "arena-pieces:ring-floor", g.depth - 0.001);
  if (!floor) return;
  const r = state.raid!;
  const A = ringAtlas(g.scene);
  const low = fxFor(g.scene).density < 0.5;
  // Reduced motion: one still moment (no flicker).
  const t = reduced ? 2.37 : clock;
  const warning = r.warnings.find(
    (w) => w.kind === "link-beam" && w.beamPost !== undefined,
  );
  const warnP = warning ? progressOf(warning, state.time) : 0;
  const states = postStates(
    S.posts.length,
    r.stormBeam?.post,
    warning?.beamPost,
  );
  // Three charge pulses running round the cyan filament.
  if (!low && !reduced)
    for (let i = 0; i < 3; i++) {
      const a = t * 0.32 + (i * TAU) / 3;
      floor.put(
        A,
        "glowCyan",
        800 + Math.cos(a) * 710,
        450 + Math.sin(a) * 360,
        {
          add: true,
          sx: 0.42,
          alpha: 0.6,
        },
      );
    }
  for (const [i, p] of S.posts.entries()) {
    floor.put(A, "postShadow", p.x + 5, p.y + 14, { sx: 1.2 });
    const st = states[i];
    if (st === "idle")
      floor.put(A, "floorWarm", p.x + 2, p.y + 12, {
        add: true,
        alpha: 0.32,
        sx: 0.8,
      });
    else if (st === "charge")
      floor.put(A, "floorPink", p.x, p.y + 12, {
        add: true,
        alpha: 0.5 + 0.4 * warnP,
        sx: 1 + 0.3 * warnP,
      });
    else
      floor.put(A, "floorGold", p.x, p.y + 12, {
        add: true,
        alpha: 0.85 + 0.15 * hash(Math.floor(t * 20)),
        sx: 1.35,
      });
  }
  for (const [fi, f] of (r.stormFields ?? []).entries()) {
    // Drawn at the field's own radius (S.field.radius: the crisp edge at 100).
    const s = f.radius / FIELD.r;
    floor.put(A, "fieldDisc", f.x, f.y, { sx: s });
    const edge = fieldEdgeLook(t, fi, reduced);
    floor.put(A, edge.frame, f.x, f.y, { sx: s, rot: edge.rot });
    for (const [i, bl] of fieldBolts(f.x, f.y, f.radius, t).entries()) {
      const v = Math.floor(t * 11 + i * 3 + fi) % BOLT_VARIANTS;
      floor.strip(A, "boltField" + v, bl.a, bl.b, 22, {
        add: true,
        alpha: 0.75,
      });
    }
    if (!low && !reduced)
      for (let i = 0; i < 3; i++) {
        const tick = Math.floor(t * 7) + i * 17 + fi * 5;
        const a = hash(tick) * TAU,
          d = 18 + hash(tick + 0.5) * 76 * s;
        floor.put(A, "spark", f.x + Math.cos(a) * d, f.y + Math.sin(a) * d, {
          add: true,
          sx: 0.8 + hash(tick + 0.3),
          alpha: 0.9,
        });
      }
  }
  const pad = r.polarityPad;
  if (pad) {
    const plus = pad.sign > 0;
    // Someone cancelling on it: the pad lights up.
    const onIt = (r.polarities ?? []).some((m) => m.cancelled);
    const s = S.polarity.padRadius / PAD.r;
    floor.put(A, "padPlate", pad.x, pad.y, { sx: s });
    floor.put(A, plus ? "padGlowPlus" : "padGlowMinus", pad.x, pad.y, {
      add: true,
      sx: s,
      alpha: onIt || reduced ? 1 : 0.7 + 0.3 * Math.sin(t * 4),
    });
    floor.put(A, plus ? "padSignPlus" : "padSignMinus", pad.x, pad.y, {
      sx: s,
    });
  }
  if (r.stormBeam) {
    const pts = r.stormBeam.points;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1],
        b = pts[i],
        col = i % 2 ? "Gold" : "Cyan";
      // The danger band at exactly S.link.width × 2.
      floor.strip(A, "band", a, b, bandThickness(S.link.width * 2));
      const v = Math.floor(t * 16 + i);
      // Normal blend keeps each segment's colour (gold, then cyan).
      floor.strip(A, `bolt${col}${(v + 2) % BOLT_VARIANTS}`, a, b, 22, {
        alpha: 0.5,
        flip: true,
      });
      floor.strip(A, `bolt${col}${v % BOLT_VARIANTS}`, a, b, 30);
    }
  }
  // The posts.
  for (const [i, p] of S.posts.entries()) {
    const post = stageOn(layers[i], "arena-pieces:post-" + i);
    if (!post) continue;
    post.put(A, "post", p.x, p.y);
    const orb = orbOf(p.x, p.y);
    const st = states[i];
    if (st === "idle") {
      post.put(A, "glowWarm", orb.x, orb.y, {
        add: true,
        sx: 0.7,
        alpha: 0.55 + 0.12 * Math.sin(t * 2 + i),
      });
      // Now and then a tiny spark jumps on an idle orb.
      const tick = Math.floor(t * 1.6);
      if (
        !low &&
        !reduced &&
        hash(tick * 4 + i) > 0.82 &&
        (t * 1.6) % 1 < 0.14
      ) {
        const a = hash(tick + i * 9) * TAU;
        post.strip(
          A,
          "boltCyan" + (tick % BOLT_VARIANTS),
          orb,
          { x: orb.x + Math.cos(a) * 14, y: orb.y + Math.sin(a) * 10 },
          9,
          { add: true, alpha: 0.9 },
        );
      }
    } else if (st === "charge") {
      post.put(A, "glowPink", orb.x, orb.y, {
        add: true,
        sx: 1.2 + 0.9 * warnP,
        alpha: 0.8 + 0.2 * hash(Math.floor(t * 18)),
      });
      for (let k = 0; k < (low ? 1 : 3); k++) {
        const tick = Math.floor(t * 12) + k * 7;
        const a = (k / 3) * TAU + hash(tick) * 1.6,
          d = 18 + 16 * warnP;
        post.strip(
          A,
          "boltPink" + (tick % BOLT_VARIANTS),
          orb,
          { x: orb.x + Math.cos(a) * d, y: orb.y + Math.sin(a) * d * 0.8 },
          12,
          { add: true },
        );
      }
    } else {
      post.put(A, "glowGold", orb.x, orb.y, {
        add: true,
        sx: 1.5 + 0.2 * hash(Math.floor(t * 20)),
      });
      const v = Math.floor(t * 16);
      post.strip(
        A,
        "boltGold" + (v % BOLT_VARIANTS),
        orb,
        { x: p.x - 2, y: p.y + 2 },
        14,
        {
          add: true,
          alpha: 0.95,
        },
      );
      post.strip(
        A,
        "boltCyan" + ((v + 1) % BOLT_VARIANTS),
        orb,
        { x: p.x + 3, y: p.y + 6 },
        11,
        { add: true, alpha: 0.7, flip: true },
      );
    }
  }
  // Polarity marks: a copper medallion 100 px over each marked raider, over
  // the raiders, with its countdown ring.
  const marks = (r.polarities ?? []).filter((m) => {
    const p = state.players.find((p) => p.id === m.playerId);
    return p && p.hp > 0;
  });
  if (!marks.length) return;
  const over = stageOn(g, "arena-pieces:ring-marks", MARK_DEPTH);
  if (!over) return;
  for (const m of marks) {
    const p = state.players.find((p) => p.id === m.playerId)!;
    const color = m.cancelled ? 0x8de8cf : m.sign > 0 ? 0xffda85 : 0x8edfff,
      y = p.y - 100;
    over.put(A, "markBase", p.x, y);
    over.put(
      A,
      m.cancelled ? "markCheck" : m.sign > 0 ? "markPlus" : "markMinus",
      p.x,
      y,
    );
    if (!m.cancelled) {
      const progress = Math.max(0, (m.until - state.time) / S.polarity.seconds);
      const a0 = -Math.PI / 2,
        a1 = a0 + progress * TAU;
      over.lines
        .lineStyle(6.5, 0x060a16, 0.55)
        .beginPath()
        .arc(p.x, y, 31, a0, a1, false)
        .strokePath();
      over.lines
        .lineStyle(4, color, 0.9)
        .beginPath()
        .arc(p.x, y, 31, a0, a1, false)
        .strokePath();
    }
  }
}
/** Polarity marks draw over the raiders (their band is 2 to 2.09). */
const MARK_DEPTH = 2.95;
const progressOf = (w: RaidWarning, now: number) =>
  Math.max(
    0,
    Math.min(
      1,
      (now - (w.startedAt ?? now)) /
        Math.max(0.01, w.at - (w.startedAt ?? now)),
    ),
  );
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
  hurtAt: Map<string, number>;
  phase: number;
  roarAt: number;
  deathAt: number;
  result: unknown;
}
const memories = new WeakMap<G, Memory>();
/**
 * The twins themselves: two vector jellyfish-clouds (boss-vector-twins.ts),
 * gold Fizz and blue Crackle, each on its own layer, sorted with the raiders
 * by where it floats, each with its own facing. They read the battle's
 * state: each twin's own windup and cast, a roar at a new phase, a flinch
 * when hit, dizzy with its core open when exposed or staggered, sunk and
 * faded while down (until revived), and both sinking when beaten.
 */
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
      hurtAt: new Map(),
      phase: r.phase,
      roarAt: -10,
      deathAt: -1,
      result: r.result,
    };
    memories.set(g, m);
  }
  const dt =
    state.phase === "paused" ? 0 : Math.max(0, Math.min(0.05, clock - m.clock));
  m.time += dt;
  m.clock = clock;
  m.serverTime = state.time;
  const t = m.time,
    cues: RaidBossCue[] = [];
  const live = state.phase === "playing";
  if (r.phase > m.phase && live) m.roarAt = t;
  m.phase = r.phase;
  const dead = r.result === "victory";
  if (dead && m.deathAt < 0) m.deathAt = t;
  for (const [i, meta] of (r.twins ?? []).entries()) {
    const p = state.players.find((p) => p.id === meta.id);
    if (!p) continue;
    const old = m.hp.get(p.id);
    if (old !== undefined && p.hp < old) {
      cues.push(
        p.hp <= 0 ? "fall" : meta.exposedUntil > state.time ? "core" : "chip",
      );
      m.hurtAt.set(p.id, t);
    }
    if (old === 0 && p.hp > 0) cues.push("awaken");
    m.hp.set(p.id, p.hp);
    const life = bossLife(memory, state, p, clock, reduced);
    // Each twin draws on its own layer, sorted with the raiders by where it stands.
    const g = at ? at(`twin-${i}`, p.y + 13) : memory;
    const down = p.hp <= 0 && !dead;
    g.fillStyle(0x0e1a30, down ? 0.14 : 0.27).fillEllipse(
      p.x,
      p.y + 13,
      117,
      30,
    );
    // its own attack being wound up (its warning) and its last cast
    const wind = r.warnings.find(
      (w) =>
        (!w.casterId || w.casterId === p.id) &&
        w.at >= state.time &&
        (w.startedAt ?? w.at - 1.5) <= state.time,
    );
    const cast = life.action.casts[life.action.casts.length - 1];
    const exposed = meta.exposedUntil > state.time;
    const twin = paintVectorTwin(g, {
      twin: i ? 1 : 0,
      x: p.x,
      y: p.y + 13,
      angle: p.angle,
      clock: t,
      phase: r.phase,
      reduced,
      gilded: !!r.gilded,
      windKind: wind?.kind,
      windup: life.windup,
      castKind: cast?.kind,
      castAge: cast?.age ?? 99,
      roarAge: t - m.roarAt,
      exposed: exposed && !down,
      stagger: r.staggerUntil > state.time && !down && !dead,
      hurt: Math.max(0, 1 - (t - (m.hurtAt.get(p.id) ?? -10)) / 0.24),
      down,
      downAge:
        meta.fallenAt !== undefined
          ? Math.max(0, state.time - meta.fallenAt)
          : 9,
      dead,
      deadAge: dead ? t - m.deathAt : 0,
    });
    if (twin && !down && !dead)
      paintBossAura(g, "storm-twins", twin.core.x, twin.core.y, life, 1, !!i);
  }
  m.result = r.result;
  return cues;
}

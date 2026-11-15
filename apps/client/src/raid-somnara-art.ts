import { paintSnoozaku } from "./boss-snoozaku-rig";
import { bossLife } from "./raid-boss-life";
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  SOMNARA,
  quietZoneAt,
  type DreamRune,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import type { RaidBossCue } from "./raid-boss-motion";
import { beginMapFrame, mapAtlas, raidMapLow } from "./raid-map-atlas";
import {
  CONSTELLATION,
  NIGHT_RING_RADIUS,
  cloudDeckPieces,
} from "./raid-cloud-deck-pieces";
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;
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
/**
 * Texels per world unit in the atlas: 1.5 keeps lines and edges crisp at
 * the battle's density and the atlas near 7 MB of GPU memory (2 cost 13-15).
 */
const DECK_K = 1.5;
const deckKey = (quiet: number) => `cloud-deck-atlas-${quiet}`;
/** The Quiet Zone's radius this raid will use (as the server sets it). */
export function quietRadiusFor(state: Snapshot) {
  const r = state.raid;
  if (r?.quietZone) return r.quietZone.radius;
  return (
    SOMNARA.song.radius[Math.min(3, Math.max(1, r?.peril ?? 1))] +
    (r?.trait === "starry-night" ? 35 : 0)
  );
}
const deckAtlas = (scene: Phaser.Scene, quiet: number) =>
  mapAtlas(scene, deckKey(quiet), () => cloudDeckPieces(quiet), DECK_K);
/** Draw the Cloud Deck's atlas now (the arena scene is being created), not mid-fight. */
export function prewarmCloudDeck(scene: Phaser.Scene, state: Snapshot) {
  if (state.raid?.boss === "somnara") deckAtlas(scene, quietRadiusFor(state));
}
export const cloudDeckAtlasKey = deckKey;

// ---------------------------------------------------------------- Steps
/** The pad whose entry radius holds (x, y), as the server's padAt. */
export function padAtPoint(x: number, y: number) {
  return SOMNARA.pads.find(
    (p) => Math.hypot(p.x - x, p.y - y) <= SOMNARA.padRadius,
  )?.rune;
}
/** The server marks a correct step with a value-0 mint "heal" at the raider on the pad. */
const STEP_COLOR = 0x99efdd;
/** The Nightmare: a 500-wide violet raid-impact at the baku. */
const NIGHTMARE = { color: 0xc090ff, radius: 500 };
type Event = Snapshot["events"][number];
/** The pad a correct step was made on, or undefined if the event is not one. */
export function correctStepPad(event: Event) {
  if (event.kind !== "heal" || (event.value ?? 0) !== 0) return undefined;
  if (event.color !== STEP_COLOR) return undefined;
  return padAtPoint(event.x, event.y);
}
export const isNightmare = (event: Event) =>
  event.kind === "raid-impact" &&
  event.color === NIGHTMARE.color &&
  event.raidRadius === NIGHTMARE.radius;
/** Pads with a raider standing on them (the wrong step, when the Nightmare hits). */
export function padsUnderRaiders(state: Snapshot) {
  const runes = new Set<DreamRune>();
  for (const p of state.players)
    if (!p.raidBoss && p.hp > 0 && !p.out) {
      const rune = padAtPoint(p.x, p.y);
      if (rune) runes.add(rune);
    }
  return [...runes];
}
interface PadFx {
  rune: DreamRune;
  kind: "ok" | "bad";
  /** Clock when first drawn (set by the first frame that shows it). */
  at?: number;
}
const deckFx: {
  pads: PadFx[];
  night: { x: number; y: number; at?: number }[];
  /** Nightmares seen so far (the baku jolts awake at each). */
  nightmares: number;
} = { pads: [], night: [], nightmares: 0 };
/** How many Nightmares this client has seen (Snoozaku's jolt, its effects). */
export const cloudDeckNightmares = () => deckFx.nightmares;
/**
 * A server event in a Somnara raid: a correct step flashes its pad mint, the
 * Nightmare sends its shockwave and cracks the pad a raider stood on. True
 * when this draws the event's ring itself (the scene skips its plain one).
 */
export function noteCloudDeckEvent(event: Event, state: Snapshot | undefined) {
  if (state?.raid?.boss !== "somnara") return false;
  const ok = correctStepPad(event);
  if (ok) deckFx.pads.push({ rune: ok, kind: "ok" });
  if (!isNightmare(event)) return false;
  for (const rune of padsUnderRaiders(state))
    deckFx.pads.push({ rune, kind: "bad" });
  deckFx.night.push({ x: event.x, y: event.y });
  deckFx.nightmares++;
  deckFx.pads = deckFx.pads.slice(-8);
  deckFx.night = deckFx.night.slice(-3);
  return true;
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));
const easeOut = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

/**
 * The Cloud Deck's live floor and markers as painted pieces
 * (raid-cloud-deck-pieces.ts): rune pads (idle, called, a correct or wrong
 * step), the constellation's gem light, dream trails, the Quiet Zone, the
 * lullaby rings, dream bubbles and the overhead markers.
 */
export function drawCloudDeck(
  g: G,
  state: Snapshot,
  reduced: boolean,
  clock = state.time,
) {
  const r = state.raid!,
    t = reduced ? 0 : state.time;
  const scene = g.scene;
  if (!scene) return;
  const layers = beginMapFrame(g, deckAtlas(scene, quietRadiusFor(state)));
  if (!layers) return;
  const { under: U, over: O, top: T, lines } = layers;
  const low = raidMapLow();
  // Effects begin on the first frame that shows them, and end on their own.
  for (const f of [...deckFx.pads, ...deckFx.night]) f.at ??= clock;
  deckFx.pads = deckFx.pads.filter((f) => clock - f.at! < 1.6);
  deckFx.night = deckFx.night.filter((f) => clock - f.at! < 0.4);

  // The constellation's twelve gems (the ring is baked into the floor).
  if (!low)
    for (let i = 0; i < 12; i++) {
      const a = (i * Math.PI) / 6,
        tw = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.1);
      U.put(
        "gemGlow",
        CONSTELLATION.x + Math.cos(a) * CONSTELLATION.r,
        CONSTELLATION.y + Math.sin(a) * CONSTELLATION.r,
        { a: 0.25 + 0.5 * tw, s: 0.8 + 0.3 * tw },
      );
    }
  // Duskveil's dream trails (bubbles dissolve within 45).
  for (const trail of r.dreamTrails ?? [])
    U.put("mist", trail.x, trail.y, {
      a: clamp01(0.35 + (trail.until - state.time) / 3),
      rot: trail.x * 0.05,
    });
  if (r.quietZone) {
    const q = quietZoneAt(r.quietZone, state.time),
      R = r.quietZone.radius;
    // The song's hush over the deck: one image (it replaces the old flat tint).
    U.stretch("hush", 0, 0, 1600, 900);
    if (!low)
      U.put(`quietGlow-${R}`, q.x, q.y, { a: 0.75 + 0.2 * Math.sin(t * 3) });
    U.put(`quiet-${R}`, q.x, q.y);
    U.put("noteMint", q.x - 4, q.y - 6, {
      s: 1.5,
      rot: Math.sin(t * 2) * 0.12,
    });
    if (!low)
      for (let i = 0; i < 5; i++) {
        const a = (i * TAU) / 5 + t * 0.5;
        U.put(
          "noteMint",
          q.x + Math.cos(a) * (R - 24),
          q.y + Math.sin(a) * (R - 24) - Math.abs(Math.sin(t * 3 + i)) * 4,
          { s: 0.7, a: 0.75 },
        );
      }
  }
  const called = [...(r.runeCalls ?? [])]
    .reverse()
    .find((c) => c.until > state.time);
  for (const pad of SOMNARA.pads) U.put("padShadow", pad.x + 5, pad.y + 9);
  for (const pad of SOMNARA.pads) {
    const rune = pad.rune,
      hot = called?.rune === rune;
    const fx = deckFx.pads.filter((f) => f.rune === rune).at(-1);
    const age = fx ? clock - fx.at! : 0;
    const breathe = 0.5 + 0.5 * Math.sin(t * 1.6 + pad.x * 0.01);
    // The pad's light on the marble: normal blending (additive turns white here).
    if (hot || !low)
      U.put(`floor-${rune}`, pad.x, pad.y, {
        a: hot ? 0.75 + 0.2 * breathe : 0.22 + 0.08 * breathe,
      });
    U.put(`stone-${rune}`, pad.x, pad.y);
    if (hot)
      U.put(`basin-${rune}`, pad.x, pad.y, {
        add: true,
        a: 0.4 + 0.2 * breathe,
      });
    if (fx?.kind === "ok") {
      const f = 1 - clamp01(age / 0.9);
      U.put("basin-mint", pad.x, pad.y, { add: true, a: f * 0.45 });
      U.put("rim-mint", pad.x, pad.y, { a: f * 0.55 });
    } else if (fx) {
      U.put("cracks", pad.x, pad.y, { a: 1 - clamp01((age - 0.6) / 0.9) });
      U.put("basin-rose", pad.x, pad.y, {
        add: true,
        a: (1 - clamp01(age / 0.7)) * 0.9,
      });
      U.put("rim-rose", pad.x, pad.y, { a: 1 - clamp01(age / 0.9) });
    }
    U.put(`glyph-${rune}`, pad.x, pad.y);
    if (hot || !low)
      U.put(`glyphGlow-${rune}`, pad.x, pad.y, {
        add: true,
        a: hot ? 0.45 + 0.15 * breathe : 0.22 + 0.08 * breathe,
      });
    if (hot && !low)
      U.put(`rim-${rune}`, pad.x, pad.y, { a: 0.35 + 0.25 * breathe });
    // The exact entry edge at the pad's radius, and its dashed ring at +9.
    U.put(hot ? `edgeHot-${rune}` : `edge-${rune}`, pad.x, pad.y, {
      a: hot ? 1 : 0.62,
    });
    if (hot)
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2 + t;
        U.put(
          `orbit-${rune}`,
          pad.x + Math.cos(a) * 70,
          pad.y + Math.sin(a) * 70,
          {
            rot: t * 1.5,
            s: 0.9 + 0.15 * Math.sin(t * 5 + i),
          },
        );
      }
    if (fx?.kind === "ok") {
      U.put("ringMint", pad.x, pad.y, {
        s: reduced ? 1 : 0.85 + easeOut(age / 0.7) * 0.75,
        a: 1 - clamp01(age / 0.7),
      });
      if (!low && !reduced)
        for (let i = 0; i < 6; i++) {
          const a = (i * TAU) / 6 + 0.4,
            u = clamp01((age - i * 0.04) / 1.1);
          if (u <= 0 || u >= 1) continue;
          U.put(
            "sparkMint",
            pad.x + Math.cos(a) * (30 + u * 14),
            pad.y + Math.sin(a) * 18 - u * 46,
            { a: Math.sin(u * Math.PI), rot: u * 2 },
          );
        }
    }
  }
  // Lullaby rings: the band and its two edges stay exactly where the server
  // hits (radius ± width), as cheap lines; notes ride on the ring.
  const W = SOMNARA.lullaby.width;
  for (const ring of r.dreamRings ?? [])
    if (ring.startedAt <= state.time) {
      const R = ring.radius;
      lines
        .lineStyle(W * 2, 0x8f6fe0, 0.1)
        .strokeCircle(ring.x, ring.y, R)
        .lineStyle(W * 1.1, 0xbd9fff, 0.12)
        .strokeCircle(ring.x, ring.y, R)
        .lineStyle(5, 0x2a1a5a, 0.25)
        .strokeCircle(ring.x, ring.y, R + W - 3)
        .lineStyle(3, 0xefe4ff, 0.95)
        .strokeCircle(ring.x, ring.y, R + W)
        .lineStyle(2, 0xbda2ff, 0.65)
        .strokeCircle(ring.x, ring.y, Math.max(1, R - W));
      for (let i = 0; i < 6; i++) {
        const a = (i * TAU) / 6 + t * 0.15;
        O.put("noteIvory", ring.x + Math.cos(a) * R, ring.y + Math.sin(a) * R, {
          s: 0.85,
          a: 0.9,
          rot: Math.sin(t * 3 + i) * 0.2,
        });
        if (low) continue;
        const b = a + TAU / 12;
        O.put(
          "sparkLilac",
          ring.x + Math.cos(b) * R,
          ring.y + Math.sin(b) * R,
          {
            s: 0.7 + 0.3 * Math.sin(t * 6 + i),
            a: 0.85,
          },
        );
      }
    }
  // Above the fighters: dream bubbles (rim at exactly their radius).
  const BR = SOMNARA.bubbles.radius;
  const bubbles = r.dreamBubbles ?? [];
  for (const b of bubbles)
    T.put("bubbleShadow", b.x + 4, b.y + BR + 14, { a: 0.9 });
  for (const [i, b] of bubbles.entries()) {
    const wob = Math.sin(t * 4 + i * 2) * 0.02;
    T.put("bubbleStar", b.x, b.y + 1 + Math.sin(t * 2.4 + i) * 1.5, {
      rot: Math.sin(t * 1.3 + i) * 0.25,
    });
    T.put("bubble", b.x, b.y, { sx: 1 + wob, sy: 1 - wob });
  }
  // Overhead markers: drowsy pips, the sleep Z, rune calls.
  for (const p of state.players) {
    if (p.raidBoss || p.hp <= 0) continue;
    const d = r.drowsy?.[p.id];
    if (d) {
      for (let i = 0; i < 3; i++)
        T.put(i < d.stacks ? "pipOn" : "pipOff", p.x - 14 + i * 14, p.y - 103);
      if (d.sleepUntil > state.time) {
        const y = p.y - 123 + Math.sin(t * 2) * 3;
        T.put("zBig", p.x, y);
        T.put("zSmall", p.x + 15, y - 16 + Math.sin(t * 2 + 1) * 2, {
          a: 0.85,
        });
      }
    }
    const call = [...(r.runeCalls ?? [])]
      .reverse()
      .find((c) => c.playerId === p.id && c.until > state.time);
    if (call) {
      T.put("callTile", p.x + 47, p.y - 92);
      T.put(`coinS-${call.rune}`, p.x + 47, p.y - 92);
    }
  }
  // The Dreamer's sequence plaque (only the Dreamer's client knows the runes).
  const view = state.raidDream,
    dreamer = state.players.find((p) => p.id === r.dream?.dreamerId);
  if (view && r.dream && view.id === r.dream.id && dreamer) {
    const n = view.runes.length,
      width = n * 34 + 16,
      y = dreamer.y - 147;
    const x0 = dreamer.x - width / 2,
      cy = y - 3;
    // Middle first, a little under the caps, so no seam shows.
    T.stretch("plaqueM", x0 + 14, cy - 26, width - 28, 52);
    T.put("plaqueL", x0 + 8, cy);
    T.put("plaqueR", x0 + width - 8, cy);
    view.runes.forEach((rune, i) =>
      T.put(`coinT-${rune}`, dreamer.x + (i - (n - 1) / 2) * 34, cy),
    );
    if (view.backwards) {
      T.stretch("arrowShaft", x0 + 12, y - 37, width - 20, 8);
      T.put("arrowHead", x0 + 10, y - 33);
    }
  }
  // The Nightmare's shockwave: radius 500 at the baku, growing to 625 in 0.4 s.
  for (const n of deckFx.night) {
    const k = clamp01((clock - n.at!) / 0.4);
    T.put("nightRing", n.x, n.y, {
      s: (NIGHTMARE.radius / NIGHT_RING_RADIUS) * (reduced ? 1 : 1 + 0.25 * k),
      a: 1 - k,
    });
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
interface BakuMemory {
  serverTime: number;
  seed: number;
  hp: number;
  exposed: boolean;
  phase: number;
  result: unknown;
  clock: number;
  time: number;
  hurtAt: number;
  roarAt: number;
  nightAt: number;
  nights: number;
  deathAt?: number;
}
const memory = new WeakMap<G, BakuMemory>();
/**
 * Snoozaku, the dream-eating baku (Somnara's raid): its painted rig
 * (boss-snoozaku*.ts) posed from the battle's own state: drowsy and dozing
 * at rest, each attack's windup (its warning) and follow-through (its cast),
 * asleep and dreaming through a dream, jolted by a Nightmare, woken
 * wide-eyed with its star-heart open, dizzy when staggered, a flinch when
 * hit, a yawn into each new phase, and curled up asleep when beaten.
 */
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
      phase: r.phase,
      result: null,
      clock,
      time: 0,
      hurtAt: -10,
      roarAt: -10,
      nightAt: -10,
      nights: deckFx.nightmares,
    };
    memory.set(g, m);
  }
  m.serverTime = state.time;
  const dt = Math.max(0, Math.min(0.05, clock - m.clock));
  m.clock = clock;
  if (state.phase === "playing" || state.phase === "finished") m.time += dt;
  const woken = r.exposedUntil > state.time,
    stagger = r.staggerUntil > state.time,
    exposed = woken || stagger;
  const cues: RaidBossCue[] = [];
  if (boss.hp < m.hp && boss.hp > 0) {
    m.hurtAt = m.time;
    cues.push(exposed ? "core" : "chip");
  }
  if (exposed && !m.exposed) cues.push("awaken");
  if (r.phase > m.phase && state.phase === "playing") m.roarAt = m.time;
  if (r.result === "victory" && m.result !== "victory") {
    m.deathAt = m.time;
    cues.push("fall");
  }
  if (deckFx.nightmares > m.nights) m.nightAt = m.time;
  m.nights = deckFx.nightmares;
  m.hp = boss.hp;
  m.exposed = exposed;
  m.phase = r.phase;
  m.result = r.result;
  const life = bossLife(g, state, boss, clock, reduced),
    t = m.time;
  const deathAt = m.deathAt;
  const dead = deathAt !== undefined;
  g.fillStyle(0x08102a, 0.27).fillEllipse(boss.x, boss.y + 26, 184, 44);
  // The attack being wound up (its warning) and the last one cast; through a
  // dream it sleeps, its nightcap's pompom aglow.
  const wind = r.warnings.find(
    (w) =>
      (!w.casterId || w.casterId === boss.id) &&
      w.at >= state.time &&
      (w.startedAt ?? w.at - 1.5) <= state.time,
  );
  const cast = life.action.casts[life.action.casts.length - 1];
  const dreaming = !wind && !!r.dream;
  paintSnoozaku(g, {
    x: boss.x,
    y: boss.y,
    angle: boss.angle,
    time: t,
    phase: r.phase,
    reduced,
    gilded: !!r.gilded,
    windKind: dreaming ? "dream-sequence" : wind?.kind,
    windup: dreaming ? 1 : life.windup,
    castKind: cast?.kind,
    castAge: cast?.age ?? 99,
    roarAge: t - m.roarAt,
    nightmareAge: t - m.nightAt,
    exposed,
    stagger,
    hurt: Math.max(0, 1 - (t - m.hurtAt) / 0.24),
    dead,
    deadAge: dead ? (reduced ? 9 : t - deathAt) : 0,
  });
  return cues;
}

/**
 * Ascendant Snoozaku's new attacks on the Cloud Deck (raid-somnara-art.ts
 * and boss-spell-art.ts call these):
 *
 * - The Dream Tide's warning: sleep mist closing in from every edge, a
 *   dashed ring round every pad at the awake ring's exact radius (any of
 *   them may be the one), the Seer marked for everyone (a speech bubble and
 *   a pulsing ring: listen to them), and, once the Seer has called, the
 *   called pad's ring lit ivory with a countdown. An eclipse icon says it
 *   can't be jumped. As it lands the awake pad flashes for everyone.
 * - The Twin Dream: a silver thread between the two Dreamers, one dot over
 *   the first (odd runes) and two over the second (even runes).
 *
 * Like every raid warning, edges are the server's exact shapes and only
 * fills pulse. The effects (motes in the mist, the called pad welling with
 * light, the tide's landing) go through the effects engine; the wind-up
 * glow is inside fx.essential, so Low's glow budget never shrinks it.
 */
import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
import {
  ASCENDANT_SNOOZAKU as A,
  type RaidWarning,
} from "../../../packages/shared/src/raid";
import type { Fx } from "./fx-engine";
import type { BossCast } from "./boss-performance";

type G = Phaser.GameObjects.Graphics;
type Glow = (
  x: number,
  y: number,
  r: number,
  c: number,
  a: number,
  floor?: boolean,
) => void;
type Event = Snapshot["events"][number];
const DANGER = 0xff4059,
  EDGE = 0xff8c99,
  MIST = 0x2a1650,
  LILAC = 0xc9b2ff,
  IVORY = 0xfff3c4,
  GOLD = 0xffd65b,
  NIGHT = 0x0e0824;
const W = 1600,
  H = 900;
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const progressOf = (w: RaidWarning, now: number) =>
  w.startedAt === undefined
    ? 1
    : clamp((now - w.startedAt) / Math.max(0.01, w.at - w.startedAt));

/** The colour of the server's event marking a Dream Tide's awake pad. */
export const TIDE_AWAKE_COLOR = 0xfff3c4;
/** Awake pads shown as tides landed (the newest few). */
const awake: { x: number; y: number; time: number }[] = [];
/**
 * A server event in Ascendant Snoozaku's raid: the awake pad of a Dream Tide
 * that just landed. True when it was one (the deck draws it, not the scene).
 */
export function noteTideAwake(event: Event, state: Snapshot | undefined) {
  const r = state?.raid;
  if (
    r?.boss !== "somnara" ||
    r.variant !== "ascendant" ||
    event.kind !== "heal" ||
    (event.value ?? 0) !== 0 ||
    event.color !== TIDE_AWAKE_COLOR
  )
    return false;
  awake.push({ x: event.x, y: event.y, time: state!.time });
  awake.splice(0, Math.max(0, awake.length - 3));
  return true;
}

/** The Seer's call this tide, if they have made it (a rune call at step -1). */
export function tideCall(state: Snapshot, w: RaidWarning) {
  return [...(state.raid?.runeCalls ?? [])]
    .reverse()
    .find(
      (c) => c.step === -1 && c.playerId === w.targetId && c.until > state.time,
    );
}

/** "Can't jump this": a crescent asleep, an up arrow struck through. */
function eclipseIcon(g: G, x: number, y: number) {
  g.fillStyle(NIGHT, 0.94).fillCircle(x, y, 24);
  g.lineStyle(3, DANGER, 1).strokeCircle(x, y, 24);
  g.lineStyle(4, IVORY, 1)
    .lineBetween(x, y + 9, x, y - 9)
    .lineBetween(x - 7, y - 2, x, y - 9)
    .lineBetween(x + 7, y - 2, x, y - 9);
  g.lineStyle(4, DANGER, 1).lineBetween(x - 15, y + 15, x + 15, y - 15);
}
/** A speech bubble (listen to this raider), its tail pointing down. */
function bubble(g: G, x: number, y: number, s: number, lit: boolean) {
  g.fillStyle(NIGHT, 0.92).fillRoundedRect(
    x - 20 * s,
    y - 15 * s,
    40 * s,
    26 * s,
    8 * s,
  );
  g.fillTriangle(
    x - 6 * s,
    y + 10 * s,
    x + 4 * s,
    y + 10 * s,
    x - 4 * s,
    y + 19 * s,
  );
  g.lineStyle(3, lit ? IVORY : LILAC, 1).strokeRoundedRect(
    x - 20 * s,
    y - 15 * s,
    40 * s,
    26 * s,
    8 * s,
  );
  // three dots: "listen"
  for (let i = -1; i <= 1; i++)
    g.fillStyle(lit ? IVORY : LILAC, 1).fillCircle(
      x + i * 10 * s,
      y - 2 * s,
      3.2 * s,
    );
}
/** A dashed circle (a possible awake ring). */
function dashedCircle(
  g: G,
  x: number,
  y: number,
  r: number,
  color: number,
  alpha: number,
) {
  const n = 28;
  g.lineStyle(3, color, alpha);
  for (let i = 0; i < n; i += 2) {
    const a0 = (i / n) * Math.PI * 2,
      a1 = ((i + 1) / n) * Math.PI * 2;
    g.beginPath().arc(x, y, r, a0, a1).strokePath();
  }
}
/** A progress arc just inside a circle's edge (the countdown). */
function timer(g: G, x: number, y: number, r: number, k: number, c: number) {
  g.lineStyle(5, c, 0.95)
    .beginPath()
    .arc(x, y, Math.max(0, r), -Math.PI / 2, -Math.PI / 2 + k * Math.PI * 2)
    .strokePath();
}

/** Ascendant Snoozaku's warnings. Returns false for kinds it doesn't draw. */
export function drawAscendantSnoozeWarning(
  g: G,
  state: Snapshot,
  w: RaidWarning,
  reduced: boolean,
) {
  if (w.kind !== "dream-tide") return false;
  const t = state.time;
  const pulse = reduced ? 1 : 0.86 + Math.sin(t * 7) * 0.14;
  const k = progressOf(w, t);
  // Sleep floods the deck, closing in from every edge.
  g.fillStyle(MIST, (0.16 + 0.3 * k) * pulse).fillRect(0, 0, W, H);
  const band = 18 + k * 130;
  g.fillStyle(MIST, 0.5)
    .fillRect(0, 0, W, band)
    .fillRect(0, H - band, W, band)
    .fillRect(0, band, band, H - band * 2)
    .fillRect(W - band, band, band, H - band * 2);
  g.lineStyle(3, EDGE, 0.7).strokeRect(band, band, W - band * 2, H - band * 2);
  // Every pad may be the awake one: its ring's exact size, dashed.
  const call = tideCall(state, w);
  for (const pad of A.pads) {
    const hot = call?.rune === pad.rune;
    if (hot) {
      g.fillStyle(IVORY, 0.18 + 0.16 * k).fillCircle(pad.x, pad.y, w.radius);
      g.lineStyle(5, IVORY, 1).strokeCircle(pad.x, pad.y, w.radius);
      g.lineStyle(2, NIGHT, 0.8).strokeCircle(pad.x, pad.y, w.radius + 4);
      timer(g, pad.x, pad.y, w.radius - 11, k, GOLD);
    } else dashedCircle(g, pad.x, pad.y, w.radius, LILAC, 0.75);
  }
  // The Seer, for everyone: listen to them.
  const seer = state.players.find((p) => p.id === w.targetId && p.hp > 0);
  if (seer) {
    const r = 46 + (reduced ? 0 : Math.sin(t * 6) * 4);
    g.lineStyle(3, call ? IVORY : LILAC, 0.9).strokeCircle(seer.x, seer.y, r);
    bubble(g, seer.x - 52, seer.y - 112, 0.9, !!call);
  }
  eclipseIcon(g, W / 2, 64);
  return true;
}

/**
 * The Twin Dream's two Dreamers: a silver thread between them, one dot over
 * the first (odd runes) and two over the second (even runes).
 */
export function drawTwinThread(g: G, state: Snapshot, reduced: boolean) {
  const d = state.raid?.dream;
  if (!d?.partnerId) return;
  const first = state.players.find((p) => p.id === d.dreamerId && p.hp > 0);
  const second = state.players.find((p) => p.id === d.partnerId && p.hp > 0);
  if (!first || !second) return;
  const x0 = first.x,
    y0 = first.y - 60,
    x1 = second.x,
    y1 = second.y - 60;
  const len = Math.hypot(x1 - x0, y1 - y0);
  if (len > 1) {
    const ux = (x1 - x0) / len,
      uy = (y1 - y0) / len;
    const flow = reduced ? 0 : (state.time * 40) % 24;
    g.lineStyle(2, 0xe7e0ff, 0.55);
    for (let s = flow; s < len; s += 24) {
      const e = Math.min(len, s + 10);
      g.lineBetween(x0 + ux * s, y0 + uy * s, x0 + ux * e, y0 + uy * e);
    }
  }
  const mark = (x: number, y: number, n: number, mine: boolean) => {
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * 14;
      g.fillStyle(NIGHT, 1).fillCircle(x + dx, y, 7.5);
      g.fillStyle(mine ? IVORY : LILAC, 1).fillCircle(x + dx, y, 4.5);
    }
  };
  const turn = d.step % 2 === 0;
  mark(first.x, first.y - 96, 1, turn);
  mark(second.x, second.y - 96, 2, !turn);
}

/**
 * Effects: motes drifting in the sleep mist, the called pad welling with
 * light (essential: it says where to stand), the mist settling as the tide
 * lands and the awake pad's flash.
 */
export function drawAscendantSnoozeFx(
  fx: Fx,
  glow: Glow,
  state: Snapshot,
  casts: BossCast[],
  low: boolean,
) {
  const r = state.raid;
  if (!r) return;
  for (const w of r.warnings) {
    if (w.kind !== "dream-tide") continue;
    const k = progressOf(w, state.time);
    if (k <= 0 || k >= 1) continue;
    const call = tideCall(state, w);
    const pad = call && A.pads.find((p) => p.rune === call.rune);
    if (pad)
      fx.essential(() =>
        glow(pad.x, pad.y, w.radius * 0.6, IVORY, 0.12 + 0.18 * k, true),
      );
    fx.trail(`snooze-tide-${w.id}`, low ? 0.35 : 0.16, () => {
      const side = Math.floor(Math.random() * 4),
        u = Math.random();
      const x = side < 2 ? u * W : side === 2 ? 30 : W - 30,
        y = side < 2 ? (side === 0 ? 30 : H - 30) : u * H;
      fx.burst({
        x,
        y,
        z: 0,
        count: 1,
        kind: "mote",
        color: [LILAC, 0x8f6fe0, 0xe7e0ff],
        speed: [10, 30],
        up: [20, 50],
        life: [0.6, 1],
        size: [2, 3.5],
        drag: 1,
      });
    });
  }
  for (const c of casts) {
    if (c.kind !== "dream-tide") continue;
    // the mist settles: a band of sleep sweeping in from the edges
    const k = clamp(c.age / 0.6);
    if (k >= 1) continue;
    const inset = 40 + k * 240;
    fx.floor
      .lineStyle(18 * (1 - k) + 2, MIST, 0.55 * (1 - k))
      .strokeRect(inset, inset * 0.56, W - inset * 2, H - inset * 1.12);
  }
  // The awake pad: an ivory ring opening and a few sparks.
  for (const a of awake) {
    const age = state.time - a.time;
    if (age < 0 || age > 1.2) continue;
    const k = clamp(age / 1.2);
    fx.floor
      .lineStyle(5 * (1 - k) + 1, IVORY, 0.85 * (1 - k))
      .strokeEllipse(
        a.x,
        a.y,
        A.tide.radius * 2 * (0.6 + 0.6 * k),
        A.tide.radius * 1.2 * (0.6 + 0.6 * k),
      );
    fx.trail(`snooze-awake-${a.time}`, 99, () =>
      fx.burst({
        x: a.x,
        y: a.y,
        z: 10,
        count: low ? 5 : 10,
        kind: "spark",
        color: [IVORY, GOLD, 0xffffff],
        speed: [60, 160],
        up: [60, 160],
        life: [0.35, 0.6],
        size: [2, 3.5],
        grav: 300,
      }),
    );
  }
}

/**
 * Ascendant Snoozaku's aura: a slow lilac ring on the cloud floor and a few
 * star motes rising round its nightcap. No glows (it is always on).
 */
export function paintAscendantSnoozeAura(
  fx: Fx,
  x: number,
  y: number,
  time: number,
  phase: number,
  reduced: boolean,
  low: boolean,
) {
  const t = reduced ? 0 : time,
    deep = 0.5 + 0.15 * phase;
  const fy = y + 26;
  const ring = 90 + ((t * 16) % 40);
  fx.floor
    .lineStyle(2.4, LILAC, 0.42 * deep * (1 - (ring - 90) / 40))
    .strokeEllipse(x, fy, ring * 2, ring * 0.8);
  fx.floor.lineStyle(1.6, IVORY, 0.22 * deep).strokeEllipse(x, fy, 170, 64);
  if (reduced) return;
  const count = low ? 2 : 3 + phase;
  for (let i = 0; i < count; i++) {
    const k = (t * 0.45 + i / count) % 1,
      side = Math.sin(i * 2.3) * 0.5;
    const px = x + side * 140 + Math.sin(k * 5 + i) * 8,
      py = y - 40 - k * 130;
    fx.g
      .fillStyle(i % 2 ? LILAC : IVORY, Math.sin(k * Math.PI) * 0.75)
      .fillCircle(px, py, 2.2);
  }
}

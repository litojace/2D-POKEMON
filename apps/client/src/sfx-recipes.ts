import {
  CHARACTERS,
  ULT_SLOT,
  type Ability,
  type AbilityKind,
  type Character,
  type CharacterId,
} from "@arena/shared";
import type { SfxLayer, SfxRecipe, Sweep } from "./sfx";

/**
 * Every skill's sound comes from the shared data, not a list of skills: its
 * element gives the timbre (an Electric zap, a Fire whoosh, a Water bloop)
 * and its kind the gesture (a shot, a swing, a beam, a field). A new
 * champion or skill sounds right with no change here, unless it brings a
 * new element or kind, which TypeScript and the unit test then ask for.
 */
interface Palette {
  /** The body: waveform, pitch (Hz) and where its pitch ends (× start). */
  tone: OscillatorType;
  pitch: number;
  glide: number;
  /** A quieter tone above the body: [pitch ratio, level]. */
  partial?: [number, number];
  wobble?: { rate: number; depth: number };
  /** A lowpass over buzzy bodies, as a multiple of their pitch. */
  tame?: number;
  /** The noise's colour (filter and centre Hz) and its share of the sound. */
  noise: { type: BiquadFilterType; hz: number; q: number };
  air: number;
  /** Crackle or rustle on the noise. */
  flutter?: { rate: number; depth: number };
  /**
   * Loudness trim (dB), from measuring every skill through a phone speaker's
   * range (300 Hz to 9 kHz): deep elements need more, bright ones less.
   */
  gain: number;
}
export const ELEMENT_PALETTES: Record<string, Palette> = {
  // A sharp zap that drops away, buzzing, with static crackle on top.
  Electric: {
    tone: "square",
    pitch: 760,
    glide: 0.45,
    partial: [1.5, 0.22],
    wobble: { rate: 34, depth: 0.08 },
    tame: 5,
    noise: { type: "highpass", hz: 3200, q: 0.8 },
    air: 0.45,
    flutter: { rate: 55, depth: 0.8 },
    gain: -2.9,
  },
  // A low roar under a crackling whoosh.
  Fire: {
    tone: "sawtooth",
    pitch: 220,
    glide: 0.62,
    partial: [2, 0.3],
    tame: 8,
    noise: { type: "bandpass", hz: 1800, q: 0.6 },
    air: 0.7,
    flutter: { rate: 23, depth: 0.6 },
    gain: 3.1,
  },
  // A rising bubble and a splash.
  Water: {
    tone: "sine",
    pitch: 380,
    glide: 1.9,
    partial: [2.4, 0.18],
    wobble: { rate: 12, depth: 0.04 },
    noise: { type: "bandpass", hz: 1000, q: 1.4 },
    air: 0.45,
    gain: -0.4,
  },
  // A struck crystal: a steady note with a glassy, inharmonic overtone.
  Aura: {
    tone: "triangle",
    pitch: 1046,
    glide: 1,
    partial: [2.76, 0.35],
    noise: { type: "highpass", hz: 4800, q: 0.6 },
    air: 0.22,
    gain: -0.2,
  },
  // A high chime with glitter.
  Light: {
    tone: "sine",
    pitch: 1318,
    glide: 1.1,
    partial: [2, 0.4],
    noise: { type: "highpass", hz: 6500, q: 0.5 },
    air: 0.25,
    flutter: { rate: 18, depth: 0.5 },
    gain: -2.8,
  },
  // A warbling, rising tone with a fifth above it.
  Psychic: {
    tone: "triangle",
    pitch: 587,
    glide: 1.4,
    partial: [1.5, 0.32],
    wobble: { rate: 6.5, depth: 0.05 },
    noise: { type: "bandpass", hz: 2200, q: 3 },
    air: 0.2,
    gain: -1.7,
  },
  // A deep thud and a scatter of gravel.
  // (The knock, three times the thud, is what a phone's small speaker plays.)
  Earth: {
    tone: "sine",
    pitch: 190,
    glide: 0.42,
    partial: [3, 0.6],
    noise: { type: "bandpass", hz: 800, q: 0.7 },
    air: 0.65,
    flutter: { rate: 40, depth: 0.4 },
    gain: 3.4,
  },
  // A thick, falling, slightly sour tone in a dark breath.
  Shadow: {
    tone: "sawtooth",
    pitch: 208,
    glide: 0.72,
    partial: [1.01, 0.55],
    wobble: { rate: 4.5, depth: 0.03 },
    tame: 6,
    noise: { type: "bandpass", hz: 900, q: 1 },
    air: 0.5,
    gain: 2.3,
  },
  // A hollow, woody knock and a rustle of leaves.
  Nature: {
    tone: "triangle",
    pitch: 620,
    glide: 0.88,
    partial: [3.01, 0.22],
    noise: { type: "bandpass", hz: 2800, q: 0.9 },
    air: 0.42,
    flutter: { rate: 16, depth: 0.7 },
    gain: -0.9,
  },
};
/** An element without a palette of its own (a new one) sounds like Aura. */
const FALLBACK_PALETTE = ELEMENT_PALETTES.Aura;
export function paletteOf(element: string) {
  return ELEMENT_PALETTES[element] ?? FALLBACK_PALETTE;
}

interface Gesture {
  length: number;
  attack: number;
  /** The body's pitch, as a share of the palette's. */
  pitch: number;
  /** How much of the palette's glide it takes (0 steady, 1 all of it). */
  glide: number;
  /** A bend of its own on top: a dash rises, a field sinks. */
  bend: number;
  /** The noise filter's sweep, as multiples of its colour. */
  sweep: [number, number];
  hold: number;
  /** The noise's share, times the palette's. */
  air: number;
  level: number;
  /** Several quick strikes (barrages). */
  repeat?: { count: number; gap: number };
  /** Loudness trim (dB): short sounds carry less than long ones (measured). */
  gain: number;
}
export type GestureId =
  "shot" | "volley" | "strike" | "beam" | "field" | "move" | "self";
const GESTURES: Record<GestureId, Gesture> = {
  shot: {
    length: 0.17,
    attack: 0.004,
    pitch: 1,
    glide: 1,
    bend: 1,
    sweep: [1.5, 0.6],
    hold: 0,
    air: 0.7,
    level: 0.85,
    gain: 1.9,
  },
  volley: {
    length: 0.13,
    attack: 0.004,
    pitch: 1.1,
    glide: 1,
    bend: 1,
    sweep: [1.4, 0.7],
    hold: 0,
    air: 0.7,
    level: 0.85,
    repeat: { count: 3, gap: 0.075 },
    gain: 3.1,
  },
  strike: {
    length: 0.15,
    attack: 0.006,
    pitch: 0.75,
    glide: 0.5,
    bend: 0.9,
    sweep: [0.45, 2.2],
    hold: 0,
    air: 1.3,
    level: 0.9,
    gain: 1.5,
  },
  beam: {
    length: 0.45,
    attack: 0.025,
    pitch: 1,
    glide: 0.25,
    bend: 1,
    sweep: [0.8, 1.5],
    hold: 0.5,
    air: 0.8,
    level: 0.7,
    gain: -4.0,
  },
  field: {
    length: 0.52,
    attack: 0.02,
    pitch: 0.6,
    glide: 1,
    bend: 0.8,
    sweep: [0.35, 1.6],
    hold: 0.15,
    air: 1.1,
    level: 0.8,
    gain: -2.8,
  },
  move: {
    length: 0.26,
    attack: 0.012,
    pitch: 0.9,
    glide: 0,
    bend: 1.7,
    sweep: [0.4, 2.6],
    hold: 0,
    air: 1.4,
    level: 0.7,
    gain: 1.0,
  },
  self: {
    length: 0.38,
    attack: 0.015,
    pitch: 1.25,
    glide: 0.3,
    bend: 1.25,
    sweep: [1, 1.2],
    hold: 0.2,
    air: 0.4,
    level: 0.62,
    gain: -3.4,
  },
};
/** Each kind of skill and the gesture it sounds like. */
export const KIND_GESTURES: Record<AbilityKind, GestureId> = {
  projectile: "shot",
  charged: "shot",
  barrage: "volley",
  shrapnel: "volley",
  storm: "volley",
  creep: "volley",
  melee: "strike",
  cone: "strike",
  clamp: "strike",
  throw: "strike",
  pound: "strike",
  grapple: "strike",
  beam: "beam",
  tether: "beam",
  steer: "beam",
  zone: "field",
  nova: "field",
  gaze: "field",
  cage: "field",
  garden: "field",
  lure: "field",
  screen: "field",
  wave: "field",
  cyclone: "field",
  seedling: "field",
  trail: "field",
  leap: "move",
  surf: "move",
  blink: "move",
  rush: "move",
  tunnel: "move",
  swap: "move",
  buff: "self",
  counter: "self",
  barrier: "self",
  rest: "self",
  veil: "self",
  rewind: "self",
  timewarp: "self",
  clone: "self",
  taunt: "self",
  hunt: "self",
};

/**
 * A champion's voice: sturdier champions sound lower (Terradon, Sunbara),
 * light ones higher (Voltkit, Astrabun), in semitones, so two champions of
 * one element still differ.
 */
export function championVoice(character: Pick<Character, "health">) {
  const semitones = Math.max(
    -4,
    Math.min(4, Math.round(((148 - character.health) / 148) * 20)),
  );
  return 2 ** (semitones / 12);
}

type Slot = "basic" | "skill" | "ultimate";
/** The recipe of one skill's cast. */
export function castRecipe(
  ability: Pick<Ability, "element" | "kind">,
  slot: Slot,
  voice = 1,
): SfxRecipe {
  const p = paletteOf(ability.element),
    g = GESTURES[KIND_GESTURES[ability.kind] ?? "shot"];
  // Basics repeat all match: quieter and shorter. Ultimates are the event.
  const size = slot === "basic" ? 0.82 : slot === "ultimate" ? 1.45 : 1,
    loud = slot === "basic" ? 0.62 : slot === "ultimate" ? 1.1 : 1;
  const length = g.length * size,
    from = p.pitch * g.pitch * voice,
    // No lower than phones and headphones can still say something with.
    to = Math.max(40, from * p.glide ** g.glide * g.bend);
  const body = (at: number, level: number, scale = 1): SfxLayer[] => {
    const layers: SfxLayer[] = [
      {
        tone: p.tone,
        from,
        to,
        at,
        length: length * scale,
        attack: g.attack,
        hold: g.hold,
        level: level * (1 - p.air * 0.45),
        wobble: p.wobble,
        filter: p.tame ? lowpass(from * p.tame, to * p.tame * 0.6) : undefined,
      },
    ];
    if (p.partial)
      layers.push({
        tone: "sine",
        from: from * p.partial[0],
        to: to * p.partial[0],
        at,
        length: length * scale * 0.7,
        attack: g.attack,
        hold: g.hold,
        level: level * p.partial[1] * 0.8,
      });
    return layers;
  };
  const air = (at: number, level: number, scale = 1): SfxLayer => ({
    noise: true,
    at,
    length: length * scale * 1.1,
    attack: Math.max(g.attack, 0.006),
    hold: g.hold * 0.6,
    level: level * p.air * g.air * 0.8,
    filter: {
      type: p.noise.type,
      from: p.noise.hz * g.sweep[0],
      to: p.noise.hz * g.sweep[1],
      q: p.noise.q,
    },
    flutter: p.flutter,
  });
  const layers: SfxLayer[] = [];
  if (g.repeat) {
    // A barrage: the body once, then quick puffs of its noise.
    layers.push(...body(0, g.level * loud));
    for (let i = 0; i < g.repeat.count; i++)
      layers.push(air(i * g.repeat.gap, g.level * loud * (1 - i * 0.15)));
  } else layers.push(...body(0, g.level * loud), air(0, g.level * loud));
  if (KIND_GESTURES[ability.kind] === "self")
    // Buffs and guards: a little rising sparkle above the body.
    layers.push(
      bell(from * 2, 0.06, 0.22, 0.16 * loud),
      bell(from * 2.52, 0.12, 0.24, 0.12 * loud),
    );
  if (slot === "ultimate")
    layers.push(
      // A deep swell under it and a bright tail over it.
      {
        tone: "sine",
        from: 130 * voice,
        to: 50 * voice,
        length: Math.min(1.1, length * 1.6 + 0.2),
        attack: 0.03,
        level: 0.42,
      },
      bell(Math.min(2600, from * 4), length * 0.7, 0.5, 0.1),
    );
  // Basics a little up (they are short), ultimates up to stand out.
  const slotGain = slot === "basic" ? 0.4 : slot === "ultimate" ? 1.5 : 0;
  return {
    layers: layers.slice(0, 8),
    gain: fromDb(p.gain + g.gain + slotGain),
  };
}
/** Decibels to a gain, to two decimals. */
export function fromDb(db: number) {
  return Math.round(10 ** (db / 20) * 100) / 100;
}

/** A sine bell with its octave: chimes and sparkles. */
function bell(hz: number, at: number, length: number, level: number) {
  return {
    tone: "sine" as const,
    from: hz,
    to: hz * 0.995,
    at,
    length,
    attack: 0.004,
    level,
  };
}
function lowpass(from: number, to: number): Sweep {
  return { type: "lowpass", from, to: Math.max(200, to), q: 0.7 };
}

/** Who a hit is to you: one you dealt, one you took, or between others. */
export type HitRole = "dealt" | "taken" | "other";
export interface HitSound {
  role: HitRole;
  damage: number;
  element?: string;
  ko?: boolean;
  miss?: boolean;
  combo?: boolean;
  ambush?: boolean;
}
/** Chip damage (burns, ticks) is a tick, not a blow. */
export const CHIP_DAMAGE = 4;
export function hitRecipe(hit: HitSound): SfxRecipe {
  if (hit.miss)
    // Blinded: a swing through the air.
    return {
      gain: fromDb(6.5),
      layers: [
        {
          noise: true,
          length: 0.13,
          attack: 0.01,
          level: 0.32,
          filter: { type: "bandpass", from: 1800, to: 5200, q: 1.2 },
        },
      ],
    };
  if (hit.damage < CHIP_DAMAGE && !hit.ko)
    return {
      gain: fromDb(6),
      layers: [
        {
          noise: true,
          length: 0.045,
          level: 0.2,
          filter: { type: "bandpass", from: 2600, to: 1800, q: 1.4 },
        },
        { tone: "sine", from: 620, to: 420, length: 0.045, level: 0.1 },
      ],
    };
  const size = Math.max(0.35, Math.min(1.3, hit.damage / 22)),
    taken = hit.role === "taken";
  const layers: SfxLayer[] = [
    // The snap of contact: duller when it's you being hit.
    {
      noise: true,
      length: 0.06 + 0.05 * size,
      attack: 0.002,
      level: 0.5 + 0.3 * size,
      filter: taken
        ? { type: "bandpass", from: 2200, to: 750, q: 0.9 }
        : { type: "bandpass", from: 2800, to: 900, q: 0.9 },
    },
    // The thump of the body. It starts high and drops fast, as a drum's
    // does: the start is what a phone's speaker plays, the rest headphones.
    {
      tone: "sine",
      from: taken ? 240 : 300,
      to: taken ? 50 : 62,
      length: 0.09 + 0.1 * size,
      attack: 0.002,
      // (Under the lift below, so headphones don't get a louder thump.)
      level: (0.5 + 0.35 * size) * (taken ? 0.7 : 1),
    },
  ];
  if (hit.role === "dealt")
    // A crisp confirm on hits you land.
    layers.push({
      tone: "triangle",
      from: 1450,
      to: 1120,
      length: 0.055,
      level: 0.2,
    });
  if (hit.element) {
    // A touch of the attacker's element (a crackle, a splash, a chime).
    const p = paletteOf(hit.element);
    layers.push({
      noise: true,
      at: 0.005,
      length: 0.1,
      level: 0.22 * Math.max(0.5, p.air * 1.4),
      filter: {
        type: p.noise.type,
        from: p.noise.hz * 1.2,
        to: p.noise.hz * 0.7,
        q: p.noise.q,
      },
      flutter: p.flutter,
    });
  }
  if (hit.combo)
    layers.push(bell(784, 0.04, 0.22, 0.18), bell(1175, 0.1, 0.3, 0.16));
  if (hit.ambush)
    layers.push({
      tone: "sawtooth",
      from: 620,
      to: 150,
      length: 0.2,
      level: 0.16,
      filter: lowpass(1400, 500),
    });
  if (hit.ko) {
    layers.push({
      tone: "sine",
      from: 180,
      to: 36,
      length: 0.75,
      attack: 0.004,
      level: 0.42,
    });
    if (hit.role === "taken")
      layers.push({
        tone: "triangle",
        from: 494,
        to: 330,
        at: 0.08,
        length: 0.55,
        level: 0.14,
      });
    else
      layers.push(
        bell(1319, 0.06, 0.3, 0.14),
        bell(1661, 0.11, 0.3, 0.12),
        bell(1976, 0.16, 0.45, 0.12),
      );
  }
  // Measured on a phone's range: the duller hit you take, and a knockout,
  // need lifting to land as hard as the hits you deal.
  return {
    layers: layers.slice(0, 8),
    gain: fromDb((taken ? 5 : 0) + (hit.ko ? 4 : 0)),
  };
}

/** Sounds that are not a skill or a hit. */
export type CueId =
  | "dash"
  | "jump"
  | "land"
  | "orb"
  | "heal"
  | "ult-ready"
  | "ex-armed"
  | "round"
  | "count"
  | "go"
  | "ui"
  | "hazard-vent"
  | "hazard-pool"
  | "hazard-wall";
export const CUES: Record<CueId, SfxRecipe> = {
  // A rising whoosh.
  dash: {
    gain: fromDb(8.7),
    layers: [
      {
        noise: true,
        length: 0.22,
        attack: 0.03,
        level: 0.5,
        filter: { type: "bandpass", from: 500, to: 3200, q: 1.2 },
      },
      {
        tone: "sine",
        from: 300,
        to: 540,
        length: 0.14,
        attack: 0.02,
        level: 0.1,
      },
    ],
  },
  jump: {
    gain: fromDb(1.2),
    layers: [
      {
        tone: "sine",
        from: 320,
        to: 640,
        length: 0.11,
        attack: 0.006,
        level: 0.24,
      },
      {
        noise: true,
        length: 0.07,
        level: 0.1,
        filter: { type: "highpass", from: 2400, to: 4200, q: 0.7 },
      },
    ],
  },
  land: {
    gain: fromDb(6),
    layers: [
      { tone: "sine", from: 240, to: 60, length: 0.1, level: 0.32 },
      {
        noise: true,
        length: 0.08,
        level: 0.22,
        filter: { type: "lowpass", from: 2200, to: 500, q: 0.7 },
      },
    ],
  },
  // A healing orb appears: a soft two-note chime.
  orb: {
    gain: fromDb(5.4),
    layers: [
      {
        tone: "sine",
        from: 880,
        to: 1320,
        length: 0.16,
        attack: 0.01,
        level: 0.2,
      },
      bell(1760, 0.06, 0.28, 0.12),
    ],
  },
  // Picking one up: a warm rising C major arpeggio.
  heal: {
    gain: fromDb(5.4),
    layers: [
      bell(1047, 0, 0.3, 0.22),
      bell(1319, 0.06, 0.3, 0.2),
      bell(1568, 0.12, 0.4, 0.2),
      {
        noise: true,
        length: 0.3,
        attack: 0.05,
        level: 0.05,
        filter: { type: "highpass", from: 5000, to: 7000, q: 0.5 },
      },
    ],
  },
  // The ultimate meter is full: a bright four-note rise.
  "ult-ready": {
    gain: fromDb(7.1),
    layers: [
      { tone: "triangle", from: 784, to: 784, length: 0.12, level: 0.2 },
      {
        tone: "triangle",
        from: 988,
        to: 988,
        at: 0.06,
        length: 0.12,
        level: 0.2,
      },
      {
        tone: "triangle",
        from: 1175,
        to: 1175,
        at: 0.12,
        length: 0.14,
        level: 0.2,
      },
      bell(1568, 0.18, 0.5, 0.2),
      {
        noise: true,
        length: 0.45,
        attack: 0.15,
        level: 0.06,
        filter: { type: "highpass", from: 3000, to: 8000, q: 0.5 },
      },
    ],
  },
  // EX armed: two quick notes up.
  "ex-armed": {
    gain: fromDb(9.8),
    layers: [
      { tone: "triangle", from: 1175, to: 1175, length: 0.07, level: 0.2 },
      {
        tone: "triangle",
        from: 1760,
        to: 1760,
        at: 0.06,
        length: 0.1,
        level: 0.2,
      },
    ],
  },
  // A round ends: a bell over a soft low gong.
  round: {
    gain: fromDb(2.9),
    layers: [
      bell(784, 0, 1, 0.3),
      bell(1568, 0, 0.6, 0.1),
      { tone: "sine", from: 2352, to: 2340, length: 0.35, level: 0.05 },
      {
        tone: "sine",
        from: 98,
        to: 94,
        length: 1.2,
        attack: 0.01,
        level: 0.32,
      },
    ],
  },
  // The countdown's seconds, then "Fight".
  count: {
    gain: fromDb(8.7),
    layers: [
      { tone: "triangle", from: 880, to: 860, length: 0.09, level: 0.22 },
      {
        noise: true,
        length: 0.03,
        level: 0.08,
        filter: { type: "bandpass", from: 3000, to: 2500, q: 2 },
      },
    ],
  },
  go: {
    gain: fromDb(1.1),
    layers: [
      {
        tone: "triangle",
        from: 1319,
        to: 1319,
        length: 0.4,
        hold: 0.3,
        level: 0.2,
      },
      {
        tone: "triangle",
        from: 1760,
        to: 1760,
        length: 0.4,
        hold: 0.3,
        level: 0.16,
      },
      {
        tone: "sine",
        from: 659,
        to: 659,
        length: 0.45,
        hold: 0.3,
        level: 0.16,
      },
      {
        noise: true,
        length: 0.3,
        attack: 0.02,
        level: 0.16,
        filter: { type: "bandpass", from: 600, to: 4000, q: 1 },
      },
    ],
  },
  // A tap on a button: short and soft, as it plays on every button.
  ui: {
    gain: fromDb(9.1),
    layers: [
      { tone: "sine", from: 1250, to: 900, length: 0.035, level: 0.16 },
      {
        noise: true,
        length: 0.015,
        level: 0.04,
        filter: { type: "highpass", from: 4000, to: 4000, q: 0.7 },
      },
    ],
  },
  // Arena hazards: a steam vent, a bubbling pool, a falling wall.
  "hazard-vent": {
    layers: [
      {
        noise: true,
        length: 0.6,
        attack: 0.03,
        hold: 0.3,
        level: 0.34,
        filter: { type: "highpass", from: 1800, to: 3600, q: 0.7 },
      },
      { tone: "sine", from: 90, to: 60, length: 0.35, level: 0.26 },
    ],
  },
  "hazard-pool": {
    gain: fromDb(6.9),
    layers: [
      { tone: "sine", from: 260, to: 620, length: 0.12, level: 0.2 },
      { tone: "sine", from: 340, to: 760, at: 0.1, length: 0.12, level: 0.16 },
      {
        noise: true,
        length: 0.4,
        attack: 0.02,
        level: 0.22,
        filter: { type: "bandpass", from: 900, to: 500, q: 1.4 },
      },
    ],
  },
  "hazard-wall": {
    gain: fromDb(6),
    layers: [
      { tone: "sine", from: 150, to: 40, length: 0.7, level: 0.3 },
      {
        noise: true,
        length: 0.7,
        attack: 0.01,
        level: 0.6,
        filter: { type: "bandpass", from: 900, to: 300, q: 0.8 },
        flutter: { rate: 30, depth: 0.5 },
      },
    ],
  },
};

/** Every skill by id: its champion, its kit slot and its recipe's inputs. */
export interface SkillSound {
  ability: Ability;
  character: CharacterId;
  slot: Slot;
  voice: number;
}
let skills: Map<string, SkillSound> | undefined;
export function skillSound(abilityId: string | undefined) {
  if (!abilityId) return undefined;
  if (!skills) {
    skills = new Map();
    for (const c of Object.values(CHARACTERS)) {
      const voice = championVoice(c);
      skills.set(c.basic.id, {
        ability: c.basic,
        character: c.id,
        slot: "basic",
        voice,
      });
      c.skills.forEach((ability, i) =>
        skills!.set(ability.id, {
          ability,
          character: c.id,
          slot: i === ULT_SLOT ? "ultimate" : "skill",
          voice,
        }),
      );
    }
  }
  return skills.get(abilityId);
}
/** The cast recipe of a skill by id (cached: casts are frequent). */
const castCache = new Map<string, SfxRecipe>();
export function castRecipeOf(abilityId: string) {
  let recipe = castCache.get(abilityId);
  if (!recipe) {
    const skill = skillSound(abilityId);
    if (!skill) return undefined;
    recipe = castRecipe(skill.ability, skill.slot, skill.voice);
    castCache.set(abilityId, recipe);
  }
  return recipe;
}

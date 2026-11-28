import type { CharacterId } from "@arena/shared";
import type { Mood } from "../creature-design";
import type { Facing } from "./controller";

/**
 * Each champion's own entrance (the greeting during a round's countdown) and
 * victory, as body movement: posture, timing and the use of its own tail,
 * wings, crest or weapon (owner, 27 Nov 2026: "the action animation", not the
 * Shop's Entrance and Victory effects, which still play on top).
 *
 * A move is a function of the seconds since it began. Rules every move keeps:
 * - It starts and ends standing where the fighter stands: no teleport, so it
 *   plays the same on the court, in the Shop and when tapped in the Lobby.
 * - The entrance tells its story in about the first 1.6 s (the countdown is
 *   3 s; a Lobby tap shows 2 s), then holds a ready stance. Nothing waits for
 *   it: when the round starts, the fighter is simply playing.
 * - The victory acts for about 2 s, then holds a signature pose for as long
 *   as the fighter stays the winner.
 * - Reduce motion (`calm`): the held pose, with nothing swaying or hopping.
 * - At most a few particles that belong to the move (dust on a landing).
 * - Nothing leaves the body (owner, 28 Nov 2026: a head that looked cut off).
 *   The head never lifts off the neck and barely tilts (the rig clamps both);
 *   "head thrown back" is a lean of the whole fighter. A somersault turns the
 *   fighter as one piece about its middle (`flip`), limbs kept close.
 *
 * A champion without a move here keeps its older pose in rig.ts.
 */
export interface MovePart {
  x: number;
  y: number;
  rotation: number;
  scaleX: number;
  scaleY: number;
  setScale(x: number, y?: number): unknown;
}
export type MovePartName =
  | "head"
  | "body"
  | "armL"
  | "armR"
  | "legL"
  | "legR"
  | "tail"
  | "wings"
  | "flame"
  | "ears"
  | "scarf";
export type MoveAccent = "spark" | "ember" | "drop" | "dust";
export interface MoveStage {
  /** Seconds since the move began (a settled moment under `calm`). */
  t: number;
  /** Reduce motion: the settled pose only. */
  calm: boolean;
  facing: Facing;
  /** Which way "forward" is on screen: -1 facing left, otherwise 1. */
  side: 1 | -1;
  p: Record<MovePartName, MovePart>;
  /** Shift the whole fighter (rig units; y up is negative). */
  move(dx: number, dy: number): void;
  /** Squash (x wider, y shorter) or stretch about the feet. */
  squash(x: number, y: number): void;
  /** Turn the whole fighter (radians): a lean, or a flip in the air. */
  spin(angle: number): void;
  /** The face for this moment (the move's default is "happy"). */
  mood(mood: Mood): void;
  /** How closed the eyes are, 0 to 1. */
  shut(amount: number): void;
  /** sin(t × speed), still under `calm`. */
  sway(speed: number, phase?: number): number;
  /** True on the frame the move passes `at` seconds: fire one-off accents. */
  passed(at: number): boolean;
  /** A few particles that belong to the move, at the feet, tail tip or crest. */
  accent(kind: MoveAccent, count: number): void;
}
export type Move = (s: MoveStage) => void;

/** 0 before `a`, 1 after `b`, smooth between. */
export const ease = (t: number, a: number, b: number) => {
  const k = Math.min(1, Math.max(0, (t - a) / (b - a)));
  return k * k * (3 - 2 * k);
};
/** 0 → 1 → 0 across `a`..`b`. */
export const bump = (t: number, a: number, b: number) =>
  t <= a || t >= b ? 0 : Math.sin(((t - a) / (b - a)) * Math.PI);
/** A thrown arc: 0 at `a` and `b`, 1 at the top. */
export const arc = (t: number, a: number, b: number) => {
  if (t <= a || t >= b) return 0;
  const k = (t - a) / (b - a);
  return 4 * k * (1 - k);
};
/**
 * Turn the whole fighter in the air about its middle (between head and
 * hips), not about the hips: turned about the hips, the big head swings wide
 * round a small body and reads as a head on its own.
 */
const MIDDLE = 22;
const flip = (s: MoveStage, angle: number) => {
  s.spin(angle);
  s.move(-MIDDLE * Math.sin(angle), -MIDDLE * (1 - Math.cos(angle)));
};
/** A landing: squash at `at`, springing back over `len` seconds. */
const land = (s: MoveStage, at: number, depth = 0.14, len = 0.22) => {
  const k = s.t < at ? 0 : Math.max(0, 1 - (s.t - at) / len);
  if (k > 0) s.squash(1 + depth * 0.8 * k, 1 - depth * k);
};
/** A crouch before a leap, deepest just before `b`. */
const crouch = (s: MoveStage, a: number, b: number, depth = 0.14) => {
  const k = ease(s.t, a, b) * (s.t < b ? 1 : 0);
  if (k > 0) s.squash(1 + depth * 0.6 * k, 1 - depth * k);
};

// ---------------------------------------------------------------- Voltkit
// Hyper and cheerful: cannot stand still for a second.
const voltkitEntrance: Move = (s) => {
  const { t, p } = s;
  // A hop up into a short glide, membranes spread.
  crouch(s, 0, 0.14, 0.12);
  const air = arc(t, 0.14, 0.78);
  const glide = ease(t, 0.14, 0.3) * (1 - ease(t, 0.66, 0.8));
  s.move(Math.sin(t * 9) * 3 * glide, -air * 34);
  p.wings.setScale(0.5 + 0.16 * glide, 0.5 + 0.07 * glide);
  p.armL.rotation = 1.5 * glide;
  p.armR.rotation = -1.5 * glide;
  p.legL.rotation = 0.5 * glide;
  p.legR.rotation = -0.5 * glide;
  p.ears.rotation = -0.18 * glide;
  land(s, 0.78);
  if (s.passed(0.78)) s.accent("spark", 4);
  // Static: a full-body shiver, antennae and tail twitching.
  const shiver = bump(t, 0.84, 1.2);
  s.move(Math.sin(t * 70) * 1.6 * shiver, 0);
  p.ears.rotation += Math.sin(t * 46) * 0.22 * shiver;
  p.tail.rotation += Math.sin(t * 38) * 0.35 * shiver;
  p.head.rotation = Math.sin(t * 52) * 0.05 * shiver;
  // A snappy two-finger salute, head cocked.
  const salute = ease(t, 1.2, 1.32) * (1 - ease(t, 1.72, 1.9));
  p.armR.rotation += -2.5 * salute + bump(t, 1.4, 1.56) * 0.5;
  p.head.rotation += 0.14 * salute;
  // Ready: bouncing on its toes, paws up, never still.
  const ready = ease(t, 1.85, 2.05);
  const bounce = Math.max(0, s.sway(11));
  s.move(0, -bounce * 4 * ready);
  p.armL.rotation += (0.5 + s.sway(11) * 0.12) * ready;
  p.armR.rotation += (-0.5 - s.sway(11) * 0.12) * ready;
  p.ears.rotation += s.sway(11, 0.6) * 0.1 * ready;
  p.tail.rotation += s.sway(7) * 0.2 * ready;
};
const voltkitVictory: Move = (s) => {
  const { t, p } = s;
  // A lightning zigzag: left, right, centre.
  const hops: [number, number, number, number][] = [
    [0, 0.26, 0, -18],
    [0.26, 0.52, -18, 18],
    [0.52, 0.78, 18, 0],
  ];
  let x = 0,
    travel = 0;
  for (const [a, b, from, to] of hops) {
    if (t < a) continue;
    const k = Math.min(1, (t - a) / (b - a));
    x = from + (to - from) * k;
    if (t < b) {
      s.move(0, -arc(t, a, b) * 11);
      travel = Math.sign(to - from);
    }
  }
  s.move(x * s.side, 0);
  s.spin(travel * s.side * 0.16);
  p.ears.rotation = -travel * 0.2;
  const zig = t < 0.78 ? 1 : 0;
  p.armL.rotation = 0.7 * zig;
  p.armR.rotation = -0.7 * zig;
  // Then a star jump, membranes flung wide.
  crouch(s, 0.78, 0.96, 0.16);
  const star = arc(t, 0.96, 1.6);
  const open = ease(t, 0.96, 1.08) * (1 - ease(t, 1.5, 1.62));
  s.move(0, -star * 32);
  p.wings.setScale(0.5 + 0.18 * open, 0.5 + 0.08 * open);
  p.armL.rotation += 2.1 * open;
  p.armR.rotation += -2.1 * open;
  p.legL.rotation = 0.75 * open;
  p.legR.rotation = -0.75 * open;
  land(s, 1.6, 0.16);
  if (s.passed(1.6)) s.accent("spark", 5);
  // Hold: both paws high, hopping, antennae buzzing.
  const hold = ease(t, 1.7, 1.9);
  s.move(0, -Math.max(0, s.sway(9)) * 7 * hold);
  p.armL.rotation += (2.4 + s.sway(18) * 0.25) * hold;
  p.armR.rotation += (-2.4 - s.sway(18) * 0.25) * hold;
  p.ears.rotation += s.sway(30) * 0.07 * hold;
  p.tail.rotation += s.sway(9, 1) * 0.25 * hold;
};

// --------------------------------------------------------------- Cindrake
// Hot-headed and proud: "Get close. I dare you."
const cindrakeEntrance: Move = (s) => {
  const { t, p } = s;
  s.mood("focus");
  // Two heavy stomps, the body rocking over each foot.
  const liftL = bump(t, 0.04, 0.3),
    liftR = bump(t, 0.36, 0.62);
  p.legL.rotation = -0.55 * liftL;
  p.legR.rotation = 0.55 * liftR;
  p.legL.y -= 4 * liftL;
  p.legR.y -= 4 * liftR;
  s.spin((liftL - liftR) * 0.09);
  s.move((liftR - liftL) * 3, -(liftL + liftR) * 2.5);
  land(s, 0.3, 0.1, 0.16);
  land(s, 0.62, 0.1, 0.16);
  if (s.passed(0.3) || s.passed(0.62)) s.accent("dust", 3);
  // Fists low and clenched throughout.
  const fists = 1 - ease(t, 1.7, 1.95);
  p.armL.rotation = -0.45 * fists;
  p.armR.rotation = 0.45 * fists;
  // A deep breath in: the crest shrinks, the head sinks.
  const inhale = ease(t, 0.72, 1.0) * (1 - ease(t, 1.0, 1.1));
  s.squash(1 + 0.07 * inhale, 1 - 0.1 * inhale);
  p.head.y += 4 * inhale;
  // The roar: head thrown back, arms flung wide, the crest blazing tall.
  const roar = ease(t, 1.02, 1.14) * (1 - ease(t, 1.62, 1.85));
  const tremble = Math.sin(t * 60) * roar;
  s.squash(1 - 0.03 * roar, 1 + 0.07 * roar);
  s.move(tremble * 1.2, 0);
  // (Head thrown back = the whole fighter leaning back, head on its neck.)
  s.spin(-s.side * 0.1 * roar);
  p.head.rotation = -0.08 * roar;
  p.armL.rotation += 1.5 * roar;
  p.armR.rotation -= 1.5 * roar;
  p.wings.setScale(0.5 + 0.12 * roar, 0.5 + 0.05 * roar);
  p.tail.rotation = 0.35 * roar + tremble * 0.08;
  if (s.passed(1.1)) s.accent("ember", 5);
  // Ready: a brawler's guard, shifting its weight, the crest pulsing.
  const ready = ease(t, 1.75, 2.0);
  const crest = 0.5 + 0.2 * roar - 0.15 * inhale + 0.07 * ready;
  p.flame.setScale(
    crest + s.sway(11) * 0.03 * ready,
    crest * (1 + 0.28 * roar) + 0.06 * ready + s.sway(9) * 0.04 * ready,
  );
  s.spin(s.sway(3.2) * 0.035 * ready);
  p.armL.rotation += (0.85 + s.sway(6.4) * 0.08) * ready;
  p.armR.rotation += (-0.85 + s.sway(6.4) * 0.08) * ready;
  p.head.y += 1.5 * ready;
};
const cindrakeVictory: Move = (s) => {
  const { t, p } = s;
  // Wind up low, then an uppercut that leaves the ground.
  crouch(s, 0, 0.3, 0.18);
  const wind = ease(t, 0, 0.28) * (1 - ease(t, 0.28, 0.36));
  const punch = ease(t, 0.3, 0.4) * (1 - ease(t, 0.92, 1.1));
  s.spin(s.side * (0.12 * wind - 0.08 * punch));
  s.move(0, -arc(t, 0.32, 0.92) * 26);
  if (punch > 0) s.squash(1 - 0.04 * punch, 1 + 0.08 * punch);
  p.armR.rotation = 0.7 * wind - 2.9 * punch;
  p.armL.rotation = -0.5 * wind - 0.5 * punch;
  p.legL.rotation = 0.35 * punch;
  p.legR.rotation = -0.2 * punch;
  p.head.rotation = -0.08 * punch;
  land(s, 0.92, 0.18, 0.24);
  if (s.passed(0.92)) s.accent("dust", 4);
  if (s.passed(0.4)) s.accent("ember", 4);
  // Paws on hips, chest out, chin up, and two smug nods.
  const proud = ease(t, 1.1, 1.35);
  p.armL.rotation += 0.5 * proud;
  p.armR.rotation -= 0.5 * proud;
  p.body.setScale(0.5 + 0.03 * proud, 0.5 + 0.012 * s.sway(2.6) * proud);
  p.head.y += (bump(t, 1.5, 1.72) + bump(t, 1.78, 2.0)) * 4;
  p.head.rotation += -0.05 * proud;
  s.spin(-s.side * 0.05 * proud);
  p.tail.rotation = s.sway(3) * 0.28 * proud;
  const crest = 0.5 + 0.22 * punch + 0.12 * proud;
  p.flame.setScale(
    crest + s.sway(12) * 0.03,
    crest * 1.12 + 0.05 * proud + s.sway(10) * 0.05,
  );
  p.wings.setScale(0.5 + 0.1 * Math.max(punch, proud), 0.5 + 0.04 * proud);
};

// ---------------------------------------------------------------- Tidefin
// Elegant, cheeky and quick: a fencer who enjoys the show.
const tidefinEntrance: Move = (s) => {
  const { t, p } = s;
  const front = s.facing === "down" || s.facing === "up";
  // A step back, then a lunge that slides past and skids home, gills
  // streaming flat behind.
  const back = ease(t, 0, 0.18),
    lunge = ease(t, 0.2, 0.4),
    home = ease(t, 0.52, 0.8);
  const x = -16 * back + 36 * lunge - 20 * home;
  s.move(x * s.side, -bump(t, 0.2, 0.42) * 3);
  const thrust = lunge * (1 - ease(t, 0.6, 0.84));
  s.spin(s.side * (-0.14 * back * (1 - lunge) + 0.24 * thrust));
  // Seen from the front, a lunge comes at the viewer.
  if (front) s.squash(1 + 0.1 * thrust, 1 + 0.06 * thrust);
  else s.squash(1 + 0.1 * thrust, 1 - 0.06 * thrust);
  p.legL.rotation = -0.5 * thrust;
  p.legR.rotation = 0.55 * thrust;
  p.scarf.rotation = -0.5 * thrust + 0.3 * back * (1 - lunge);
  p.tail.rotation = -0.5 * thrust;
  // The blade is painted on this arm: it only ever turns outward, away from
  // the body (UPRIGHT_PROP_ARM in rig.ts). A thrust out to the side, two
  // quick flicks, then the blade held upright in salute while the free arm
  // sweeps high.
  const reach = lunge * (1 - ease(t, 0.84, 0.96));
  const flick = bump(t, 0.86, 1.06) + bump(t, 1.06, 1.26);
  const salute = ease(t, 1.26, 1.38) * (1 - ease(t, 1.8, 2.0));
  p.armR.rotation = 1.1 * reach + 0.4 + 1.0 * flick - 0.4 * salute;
  p.armL.rotation = -0.5 * thrust + 2.2 * salute;
  // The skid stops in a heel-click hop; the gills bloom wide and settle.
  const click = arc(t, 0.84, 1.2);
  s.move(0, -click * 9);
  land(s, 1.2, 0.1, 0.18);
  const bloom = ease(t, 0.8, 0.98) * (1 - 0.45 * ease(t, 1.5, 2.0));
  const flat = thrust * (1 - bloom);
  // (The gills are one drawing across the head: widening it would lift
  // them off the head, so they fan taller instead.)
  p.ears.setScale(
    0.5 - 0.03 * flat + 0.025 * bloom,
    0.5 - 0.08 * flat + (0.13 + bump(t, 0.98, 1.3) * 0.06) * bloom,
  );
  p.ears.rotation = -0.22 * flat;
  p.head.rotation = -0.1 * salute + 0.1 * flat;
  // En garde: blade forward, back arm high, light on its toes, tail up.
  const guard = ease(t, 1.85, 2.05);
  s.move(0, -Math.max(0, s.sway(10)) * 3 * guard);
  s.spin(s.side * 0.06 * guard);
  p.armR.rotation += (0.5 + s.sway(5) * 0.1) * guard;
  p.armL.rotation += 1.2 * guard;
  p.legL.rotation += -0.25 * guard;
  p.legR.rotation += 0.3 * guard;
  p.tail.rotation += (0.35 + s.sway(5) * 0.12) * guard;
  p.scarf.rotation += s.sway(5, 1) * 0.12 * guard;
};
const tidefinVictory: Move = (s) => {
  const { t, p } = s;
  // Crouch, then a leap like a fish clearing the water: up leaning back,
  // over the top, down leaning forward, tail whipping. (Not a somersault:
  // upside down, a big head beside a small body read as a head on its own.)
  crouch(s, 0, 0.24, 0.18);
  const up = ease(t, 0.24, 0.4) * (1 - ease(t, 0.5, 0.66));
  const down = ease(t, 0.56, 0.72) * (1 - ease(t, 0.86, 0.94));
  const air = ease(t, 0.24, 0.34) * (1 - ease(t, 0.84, 0.94));
  s.move(0, -arc(t, 0.24, 0.92) * 40);
  flip(s, s.side * (-0.34 * up + 0.34 * down));
  if (air > 0) s.squash(1 - 0.05 * air, 1 + 0.08 * air);
  p.legL.rotation = 0.3 * air;
  p.legR.rotation = -0.3 * air;
  p.armL.rotation = 1.2 * air;
  p.armR.rotation = 1.2 * air;
  p.tail.rotation = (0.5 * up - 0.5 * down) * 1.2;
  p.scarf.rotation = 0.4 * up - 0.4 * down;
  land(s, 0.92, 0.18);
  if (s.passed(0.92)) s.accent("drop", 5);
  // A deep fencer's bow: head low, gills drooping forward, one arm across
  // the chest, the other swept back.
  const bow = ease(t, 1.05, 1.3) * (1 - ease(t, 1.7, 1.92));
  p.head.y += 7 * bow;
  p.head.rotation = 0.14 * bow;
  if (bow > 0) s.squash(1 + 0.04 * bow, 1 - 0.12 * bow);
  s.spin(
    s.side * 0.12 * bow * (s.facing === "left" || s.facing === "right" ? 1 : 0),
  );
  p.armR.rotation += 1.3 * bow;
  p.armL.rotation += -0.6 * bow;
  p.tail.rotation = 0.5 * bow;
  // Hold: up on its toes, blade upright at its side, free arm high, gills
  // fanned, tail high.
  const hold = ease(t, 1.86, 2.1);
  const rise = bump(t, 1.86, 2.2);
  s.move(0, -rise * 6 - (1 + s.sway(2.6)) * 1.2 * hold);
  p.armR.rotation += (0.15 + s.sway(4) * 0.08) * hold;
  p.armL.rotation += (2.3 + s.sway(4) * 0.1) * hold;
  p.legR.rotation += 0.32 * hold;
  s.spin(s.side * 0.06 * hold);
  p.head.rotation += -0.1 * hold;
  p.ears.setScale(
    0.5 - 0.02 * bow + 0.025 * hold,
    0.5 - 0.08 * bow + (0.12 + s.sway(4, 1.2) * 0.03) * hold,
  );
  p.ears.rotation = 0.2 * bow;
  p.tail.rotation += (0.4 + s.sway(3) * 0.15) * hold;
  p.scarf.rotation += s.sway(5) * 0.14 * hold;
};

export const ENTRANCES: Partial<Record<CharacterId, Move>> = {
  voltkit: voltkitEntrance,
  cindrake: cindrakeEntrance,
  tidefin: tidefinEntrance,
};
export const VICTORIES: Partial<Record<CharacterId, Move>> = {
  voltkit: voltkitVictory,
  cindrake: cindrakeVictory,
  tidefin: tidefinVictory,
};
/** The moment Reduce motion shows: every move has settled into its hold. */
export const SETTLED = 12;

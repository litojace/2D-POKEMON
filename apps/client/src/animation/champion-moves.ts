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
 *   "head thrown back" is a lean of the whole fighter.
 * - The face never flattens (owner, 28 Nov 2026). A move never scales the
 *   head, and a squash or stretch of the fighter is the body's alone: the rig
 *   keeps the head, and all it carries, at its own size and shape, riding on
 *   top (`keepHeadRigid`).
 * - The legs move too (owner, 28 Nov 2026: "to make it lively"): steps, a
 *   stomp, a kick, a tuck in a hop, happy feet (`lift`, `tap`, `kick`). A
 *   foot that isn't lifted stays on the ground line. Tentacles and tails do
 *   the same job for those who have them.
 * - No spins (owner, 28 Nov 2026: "the champions aren't 3D; a spin looks
 *   like a sheet of paper flipping over, Glacelle above all"). The whole
 *   fighter leans (`tilt`), never turns past MAX_TURN, and is never narrowed
 *   below MIN_WIDTH to fake turning edge-on. A ball bounces; it doesn't roll.
 *   Nor does a move change the facing: no turning round, no showing the back.
 *   The rig clamps both, and tests/unit/champion-moves.test.ts fails on a
 *   move that asks for more.
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
  /** See-through for a moment (a ghost fading in): 0 to 1 of its own alpha. */
  fade(alpha: number): void;
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
/** The furthest a move turns the whole fighter (radians): a lean, no more. */
export const MAX_TURN = 0.45;
/** The narrowest a move squashes the fighter (its width, times its own). */
export const MIN_WIDTH = 0.7;
/**
 * Lean the whole fighter about its middle (between head and hips), not
 * about the hips: leaned about the hips, the big head swings wide round a
 * small body and reads as a head on its own.
 */
const MIDDLE = 22;
const tilt = (s: MoveStage, angle: number) => {
  s.spin(angle);
  s.move(-MIDDLE * Math.sin(angle), -MIDDLE * (1 - Math.cos(angle)));
};
/**
 * Lift one leg by `k` (0 to 1): a step, a stomp's wind-up, a kick. `swing`
 * is where the foot goes (radians; positive carries the left foot outward,
 * negative the right), `up` how far it leaves the ground (rig units).
 */
const lift = (leg: MovePart, k: number, swing: number, up = 3) => {
  leg.rotation += swing * k;
  leg.y -= up * Math.abs(k);
};
/** Happy feet: the two feet tap in turn, `k` strong (still under calm). */
const tap = (s: MoveStage, k: number, speed: number, swing = 0.3, up = 3) => {
  const beat = s.sway(speed);
  lift(s.p.legL, Math.max(0, beat) * k, swing, up);
  lift(s.p.legR, Math.max(0, -beat) * k, -swing, up);
};
/** Dangling feet (or tentacles) kick in the air, one after the other. */
const kick = (s: MoveStage, k: number, speed: number, swing = 0.3) => {
  s.p.legL.rotation += s.sway(speed) * swing * k;
  s.p.legR.rotation += s.sway(speed, 2) * swing * k;
};
/** Both feet out to the sides by `k`: a star, a wide stance, a startle. */
const spread = (s: MoveStage, k: number) => {
  s.p.legL.rotation += k;
  s.p.legR.rotation -= k;
};
/**
 * The head keeps its size and shape while the fighter squashes or stretches
 * by (sx, sy): each head part is scaled back, and kept where it sits on the
 * head. The head's own pivot (the neck) still rides the body up and down.
 */
export function keepHeadRigid(
  headParts: Iterable<MovePart>,
  neck: { x: number; y: number },
  sx: number,
  sy: number,
) {
  for (const part of headParts) {
    part.x = neck.x + (part.x - neck.x) / sx;
    part.y = neck.y + (part.y - neck.y) / sy;
    part.setScale(part.scaleX / sx, part.scaleY / sy);
  }
}
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
  // Legs.
  kick(s, shiver, 46, 0.16);
  tap(s, ready, 11, 0.3, 3);
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
  // Legs.
  p.legL.rotation += travel * 0.4 * zig;
  p.legR.rotation += travel * 0.4 * zig;
  spread(s, 0.4 * Math.max(0, s.sway(9)) * hold);
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
  // Legs.
  spread(s, 0.3 * roar);
  tap(s, ready, 6.4, 0.25, 2.5);
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
  // Legs.
  p.legL.rotation += 0.2 * proud;
  lift(p.legR, Math.max(0, s.sway(8)) * proud, -0.25, 2.5);
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
  // Legs.
  spread(s, -0.35 * click);
  tap(s, guard, 10, 0.15, 2);
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
  tilt(s, s.side * (-0.34 * up + 0.34 * down));
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
  // Legs.
  p.legL.rotation += Math.sin(t * 26) * 0.3 * air;
  p.legR.rotation -= Math.sin(t * 26) * 0.3 * air;
  p.legR.rotation += 0.4 * bow;
  lift(p.legL, Math.max(0, s.sway(5.2)) * hold, 0.2, 2);
};

// --------------------------------------------------------------- Auralynx
// Serene and disciplined: slow, slow, then one exact strike.
const auralynxEntrance: Move = (s) => {
  const { t, p } = s;
  // Rises into a lotus and holds perfectly composed.
  const lotus = ease(t, 0, 0.45) * (1 - ease(t, 0.95, 1.15));
  s.move(0, -12 * lotus);
  p.legL.rotation = 0.5 * lotus;
  p.legR.rotation = -0.5 * lotus;
  p.armL.rotation = -0.3 * lotus;
  p.armR.rotation = 0.3 * lotus;
  s.mood(t < 0.95 ? "normal" : t < 1.9 ? "focus" : "happy");
  s.shut(lotus);
  // Settles, and bows from the waist.
  land(s, 1.15, 0.06, 0.2);
  const bow = ease(t, 1.15, 1.4) * (1 - ease(t, 1.6, 1.8));
  p.head.y += 6 * bow;
  s.spin(s.side * 0.1 * bow);
  if (bow > 0) s.squash(1 + 0.02 * bow, 1 - 0.07 * bow);
  // Snaps into a guard: one sharp step, leaning in, a fist forward.
  const snap = ease(t, 1.82, 1.9);
  const guard = snap * (1 - bump(t, 1.82, 2.0) * 0.4);
  s.move(s.side * 6 * bump(t, 1.82, 2.1), 0);
  s.spin(s.side * 0.07 * guard);
  p.armR.rotation += 1.0 * guard;
  p.armL.rotation += -0.7 * guard;
  p.legL.rotation += -0.2 * guard;
  p.legR.rotation += 0.25 * guard;
  s.move(0, -(1 + s.sway(1.6)) * 1.2 * snap);
  // Legs.
  lift(p.legR, bump(t, 1.8, 2.0), -0.5, 4);
  kick(s, snap, 3.2, 0.12);
};
const auralynxVictory: Move = (s) => {
  const { t, p } = s;
  // One, two: a strike to each side, each a clean stop.
  const one = bump(t, 0, 0.38),
    two = bump(t, 0.38, 0.76);
  s.move(s.side * (8 * two - 8 * one), 0);
  s.spin(s.side * (0.13 * two - 0.13 * one));
  if (one + two > 0) s.squash(1 + 0.05 * (one + two), 1 - 0.04 * (one + two));
  p.armL.rotation = 1.3 * one;
  p.armR.rotation = -1.3 * two;
  s.mood(t < 0.8 ? "focus" : "happy");
  // Then palms together, rising cross-legged while the ring whirls.
  const lotus = ease(t, 0.85, 1.4);
  s.move(0, -(16 + s.sway(1.6) * 2) * lotus);
  p.legL.rotation = 0.5 * lotus;
  p.legR.rotation = -0.5 * lotus;
  p.armL.rotation += -0.5 * lotus;
  p.armR.rotation += 0.5 * lotus;
  p.head.y += bump(t, 1.4, 1.8) * 4;
  s.spin(s.sway(0.8) * 0.03 * lotus);
  // Legs.
  p.legL.rotation += 0.5 * one;
  p.legR.rotation -= 0.5 * two;
  kick(s, lotus, 1.6, 0.08);
};

// ----------------------------------------------------------------- Lumoth
// Dreamy and easily distracted: "Ooh, is that a lamp? No. Focus."
const lumothEntrance: Move = (s) => {
  const { t, p } = s;
  // Flutters up, then drifts down like a falling leaf.
  const leaf = bump(t, 0, 1.15);
  const swing = Math.sin(t * 7.5) * (1 - ease(t, 0.7, 1.15));
  s.move(swing * 13 * ease(t, 0, 0.3), -18 * leaf);
  s.spin(swing * 0.16 * ease(t, 0, 0.3));
  const flutter = leaf > 0 ? 1 : 0;
  p.wings.setScale(
    0.5 + Math.sin(t * 42) * 0.07 * flutter,
    0.5 + Math.sin(t * 42) * 0.03 * flutter,
  );
  // Something glows over there... it drifts toward it, gazing up.
  const gaze = ease(t, 1.2, 1.45) * (1 - ease(t, 1.72, 1.8));
  s.move(-s.side * 8 * gaze, -5 * gaze);
  s.spin(-s.side * 0.13 * gaze);
  p.head.rotation = -0.12 * gaze;
  s.mood(gaze > 0.3 ? "normal" : "happy");
  // ...and startles back to the fight: a hop, wings snapping wide.
  const startle = bump(t, 1.76, 2.1);
  s.move(0, -9 * startle);
  const wide = ease(t, 1.76, 1.84) * (1 - ease(t, 2.0, 2.3));
  // Shy: wings half closed, head tilted, a small bob.
  const shy = ease(t, 2.1, 2.4);
  p.wings.setScale(
    p.wings.scaleX + 0.14 * wide - (0.05 - s.sway(2.2) * 0.03) * shy,
    p.wings.scaleY + 0.06 * wide,
  );
  p.head.rotation += 0.1 * shy;
  p.armR.rotation = (-1.6 + s.sway(9) * 0.3) * shy;
  s.move(0, -(1 + s.sway(2.2)) * 1.5 * shy);
  // Legs.
  p.legL.rotation += -swing * 0.4 * ease(t, 0, 0.3);
  p.legR.rotation += -swing * 0.4 * ease(t, 0, 0.3);
  spread(s, 0.6 * startle);
  p.legL.rotation -= 0.15 * shy;
  p.legR.rotation += s.sway(4.4) * 0.3 * shy;
};
const lumothVictory: Move = (s) => {
  const { t, p } = s;
  // A figure of eight in the air.
  const eight = ease(t, 0, 0.2) * (1 - ease(t, 1.1, 1.3));
  s.move(Math.sin(t * 5) * 15 * eight, -(9 + Math.sin(t * 10) * 6) * eight);
  s.spin(Math.cos(t * 5) * 0.14 * eight);
  p.wings.setScale(
    0.5 + Math.sin(t * 42) * 0.07 * eight,
    0.5 + Math.sin(t * 42) * 0.03 * eight,
  );
  // Then the wings burst wide open, with a happy shimmy.
  const open = ease(t, 1.3, 1.4);
  const pop = bump(t, 1.3, 1.6);
  s.squash(1 + 0.06 * pop, 1 + 0.06 * pop);
  s.move(
    Math.sin(t * 34) * 1.6 * bump(t, 1.4, 1.9),
    -(8 + s.sway(2.4) * 2) * open,
  );
  p.wings.setScale(
    p.wings.scaleX + (0.15 + s.sway(2.4) * 0.03) * open,
    p.wings.scaleY + 0.07 * open,
  );
  p.armL.rotation = 1.6 * open;
  p.armR.rotation = -1.6 * open;
  if (s.passed(1.34)) s.accent("spark", 4);
  // Legs.
  p.legL.rotation += -Math.cos(t * 5) * 0.35 * eight;
  p.legR.rotation += -Math.cos(t * 5) * 0.35 * eight;
  kick(s, open, 9, 0.4);
};

// ---------------------------------------------------------------- Mystowl
// Aloof and theatrical: it already knew you would be here.
const mystowlEntrance: Move = (s) => {
  const { t, p } = s;
  // Wrapped in its cloak, eyes closed, quite still.
  const wrapped = 1 - ease(t, 1.2, 1.75);
  s.mood(t < 0.55 ? "normal" : t < 1.9 ? "focus" : "happy");
  s.shut(1 - ease(t, 0.5, 0.6));
  // An owl's slow tilt one way, then the other (the whole bird leans).
  const left = bump(t, 0.55, 0.95),
    right = bump(t, 0.9, 1.3);
  p.head.rotation = 0.16 * left - 0.16 * right;
  s.spin(0.09 * left - 0.09 * right);
  // The third eye opens; the cloak sweeps wide as it rises.
  const open = ease(t, 1.2, 1.75);
  const flourish = bump(t, 1.2, 2.1);
  // (The gem swells a little: more, and it floats off the brow.)
  p.flame.setScale(0.5 + 0.08 * open * (1 + s.sway(4) * 0.25));
  p.wings.setScale(
    0.5 - 0.09 * wrapped + (0.1 + 0.06 * flourish + s.sway(1.4) * 0.02) * open,
    0.5 + 0.05 * open,
  );
  s.move(0, -(7 + 4 * flourish + s.sway(1.4) * 1.5) * open);
  p.head.rotation += s.sway(0.9) * 0.1 * ease(t, 2.1, 2.5);
  // Legs.
  spread(s, 0.4 * flourish);
  kick(s, ease(t, 2.1, 2.5), 1.4, 0.15);
};
const mystowlVictory: Move = (s) => {
  const { t, p } = s;
  // "As foreseen": eyes closed, one slow nod.
  const nod = bump(t, 0.05, 0.75);
  p.head.y += 5 * nod;
  s.mood(t < 0.8 ? "normal" : "happy");
  s.shut(ease(t, 0, 0.1) * (1 - ease(t, 0.7, 0.8)));
  p.wings.setScale(0.5 - 0.07 * nod, 0.5);
  // Rises slowly, cloak spread to its full width, the third eye ablaze.
  const rise = ease(t, 0.8, 1.7);
  s.move(0, -(18 + s.sway(1.3) * 2) * rise);
  s.spin(s.sway(1.3, 1) * 0.05 * rise);
  p.wings.setScale(
    p.wings.scaleX + (0.17 + s.sway(1.3) * 0.02) * rise,
    0.5 + 0.08 * rise,
  );
  p.flame.setScale(0.5 + (0.09 + s.sway(5) * 0.03) * rise);
  p.head.rotation = s.sway(0.9) * 0.12 * ease(t, 1.7, 2.2);
  // Legs.
  lift(p.legL, bump(t, 0.1, 0.4), 0.3, 3);
  lift(p.legR, bump(t, 0.4, 0.7), -0.3, 3);
  p.legL.rotation += s.sway(1.3, 1) * 0.25 * rise;
  p.legR.rotation += s.sway(1.3, 1) * 0.25 * rise;
};

// --------------------------------------------------------------- Terradon
// Sleepy and unhurried: "Mmm... five more minutes..."
const terradonEntrance: Move = (s) => {
  const { t, p } = s;
  // Asleep on its feet: head sunk, the sapling drooping, slow breaths.
  const asleep = 1 - ease(t, 0.66, 0.74);
  p.head.y += 8 * asleep;
  p.flame.rotation = 0.5 * asleep;
  if (asleep > 0)
    s.squash(1 + (0.06 + Math.sin(t * 5) * 0.02) * asleep, 1 - 0.09 * asleep);
  // A jolt awake: a little jump, eyes wide, the sapling springing upright.
  s.move(0, -5 * arc(t, 0.68, 0.94));
  land(s, 0.94, 0.08, 0.18);
  p.flame.rotation += Math.sin((t - 0.7) * 22) * 0.3 * bump(t, 0.7, 1.3);
  // A huge yawning stretch, arms high, leaning back.
  const yawn = ease(t, 1.0, 1.3) * (1 - ease(t, 1.75, 2.05));
  if (yawn > 0) s.squash(1 - 0.05 * yawn, 1 + 0.09 * yawn);
  p.armL.rotation = 2.2 * yawn;
  p.armR.rotation = -2.2 * yawn;
  s.spin(-s.side * 0.07 * yawn);
  // Settles with a heavy plop; half-lidded, breathing slow.
  land(s, 2.05, 0.1, 0.3);
  if (s.passed(2.05)) s.accent("dust", 3);
  const awake = ease(t, 2.05, 2.4);
  if (awake > 0)
    s.squash(1 + s.sway(1.6) * 0.015 * awake, 1 - s.sway(1.6) * 0.015 * awake);
  s.mood("normal");
  s.shut(
    Math.max(0.92 * asleep, 0.95 * yawn, 0.45 * awake) *
      (1 - bump(t, 0.7, 1.0)),
  );
  // Legs.
  spread(s, 0.5 * arc(t, 0.68, 0.94));
  lift(p.legR, bump(t, 1.2, 1.9), -0.35, 3);
  lift(p.legL, Math.max(0, s.sway(1.6)) * awake * 0.6, 0.2, 2);
};
const terradonVictory: Move = (s) => {
  const { t, p } = s;
  // One slow, satisfied stomp.
  s.move(0, -4 * arc(t, 0.1, 0.5));
  land(s, 0.5, 0.12, 0.3);
  if (s.passed(0.5)) s.accent("dust", 4);
  p.armL.rotation = 0.8 * bump(t, 0.1, 0.7);
  p.armR.rotation = -0.8 * bump(t, 0.1, 0.7);
  // ...and it nods off where it stands: the head sinks, sinks, jolts up,
  // and sinks again.
  const drowsy = ease(t, 0.9, 1.2);
  const loop = s.calm ? 0.55 : (Math.max(0, t - 0.9) % 2.6) / 2.6;
  const sink = loop < 0.8 ? ease(loop, 0, 0.8) : 1 - ease(loop, 0.8, 0.88);
  p.head.y += 8 * sink * drowsy;
  p.flame.rotation = 0.45 * sink * drowsy + s.sway(2) * 0.05;
  s.squash(1 + 0.05 * sink * drowsy, 1 - 0.07 * sink * drowsy);
  const jolt = s.calm ? 0 : bump(loop, 0.8, 0.94);
  s.move(0, -3 * jolt * drowsy);
  s.mood(t < 0.9 ? "happy" : "normal");
  s.shut(drowsy * (0.5 + 0.45 * sink) * (1 - jolt));
  // Legs.
  lift(p.legR, bump(t, 0.1, 0.5), -0.5, 5);
  spread(s, 0.2 * sink * drowsy);
  p.legL.y -= 2 * jolt * drowsy;
  p.legR.y -= 2 * jolt * drowsy;
};

// --------------------------------------------------------------- Duskveil
// A spook who wants to scare you and is far too cute: "Boo! ...Did I?"
const duskveilEntrance: Move = (s) => {
  const { t, p } = s;
  // Hides: small, hunched, half faded.
  const hide = 1 - ease(t, 0.52, 0.6);
  if (hide > 0) s.squash(1 - 0.12 * hide, 1 - 0.2 * hide);
  s.fade(1 - 0.6 * hide * ease(t, 0, 0.12));
  p.head.rotation = 0.12 * bump(t, 0.15, 0.5);
  // BOO: springs up tall, arms flung high, the lantern swinging wild.
  const boo = ease(t, 0.54, 0.62) * (1 - ease(t, 0.95, 1.15));
  s.move(Math.sin(t * 60) * 1.5 * boo, -13 * boo);
  if (boo > 0) s.squash(1 - 0.05 * boo, 1 + 0.16 * boo);
  p.armL.rotation = 2.3 * boo;
  p.armR.rotation = -2.3 * boo;
  p.tail.rotation = 0.9 * bump(t, 0.54, 0.8) - 0.6 * bump(t, 0.8, 1.1);
  // A giggle: shoulders bobbing, head to one side.
  const giggle = bump(t, 1.15, 1.75);
  s.move(0, -Math.abs(Math.sin(t * 22)) * 2.5 * giggle);
  p.head.rotation += -0.12 * giggle;
  p.armL.rotation += 0.6 * giggle;
  p.armR.rotation += -0.6 * giggle;
  // Drifting side to side, lantern swaying.
  const drift = ease(t, 1.75, 2.1);
  s.move(s.sway(1.8) * 4 * drift, -(1 + s.sway(3.6)) * 1.2 * drift);
  s.spin(s.sway(1.8) * 0.05 * drift);
  p.tail.rotation += s.sway(1.8, 1) * 0.35 * drift;
  // Legs.
  spread(s, 0.5 * boo);
  kick(s, giggle, 22, 0.3);
  p.legL.rotation += s.sway(1.8, 1) * 0.25 * drift;
  p.legR.rotation += s.sway(1.8, 1) * 0.25 * drift;
};
const duskveilVictory: Move = (s) => {
  const { t, p } = s;
  // Swings the lantern in great arcs, drifting round with it.
  const swing = ease(t, 0, 0.2) * (1 - ease(t, 1.0, 1.2));
  p.tail.rotation = Math.sin(t * 9) * 1.0 * swing;
  s.move(Math.sin(t * 4.5) * 9 * swing, -(5 - Math.cos(t * 9) * 4) * swing);
  s.spin(Math.sin(t * 4.5) * 0.1 * swing);
  // Blinks out...
  const gone = bump(t, 1.15, 1.6);
  s.fade(1 - 0.85 * gone);
  if (gone > 0) s.squash(1 - 0.12 * gone, 1 - 0.12 * gone);
  // ...and is back with a boo: tall, arms up, floating high.
  const back = ease(t, 1.56, 1.66);
  const pop = bump(t, 1.56, 1.9);
  if (pop > 0) s.squash(1 - 0.04 * pop, 1 + 0.14 * pop);
  s.move(s.sway(1.8) * 4 * back, -(9 + s.sway(3.6) * 1.5) * back);
  s.spin(s.sway(1.8) * 0.05 * back);
  p.armL.rotation = (2.0 + s.sway(7) * 0.15) * back;
  p.armR.rotation = (-2.0 - s.sway(7) * 0.15) * back;
  p.tail.rotation += s.sway(1.8, 1) * 0.5 * back;
  // Legs.
  p.legL.rotation += -Math.sin(t * 4.5) * 0.4 * swing;
  p.legR.rotation += -Math.sin(t * 4.5) * 0.4 * swing;
  kick(s, back, 7, 0.3);
};

// --------------------------------------------------------------- Coilemur
// Cheeky, swaggering, a wrestler: "Once I grab you, I don't let go."
const coilemurEntrance: Move = (s) => {
  const { t, p } = s;
  // A wrestler's swagger: three rolling steps, shoulder first.
  const strut = 1 - ease(t, 0.75, 0.85);
  const roll = Math.sin(t * Math.PI * 4) * strut;
  s.move(roll * 9, -Math.abs(Math.sin(t * Math.PI * 4)) * 6 * strut);
  s.spin(roll * 0.17);
  p.armL.rotation = (0.5 + roll * 0.4) * strut;
  p.armR.rotation = (-0.5 + roll * 0.4) * strut;
  // The tail curls up high and cracks like a whip.
  const curl = ease(t, 0.3, 0.8);
  const crack = bump(t, 0.86, 1.04);
  p.tail.rotation = 0.5 * curl - 1.0 * crack;
  s.move(0, -8 * arc(t, 0.84, 1.08));
  land(s, 1.08, 0.1, 0.16);
  if (s.passed(0.95)) s.accent("spark", 3);
  // "Come here": two beckoning dips, leaning in.
  const beckon = bump(t, 1.1, 1.4) + bump(t, 1.4, 1.7);
  s.spin(s.side * 0.14 * beckon);
  s.move(s.side * 4 * beckon, 0);
  p.head.y += 3 * beckon;
  p.armR.rotation +=
    -1.0 * ease(t, 1.05, 1.15) * (1 - ease(t, 1.7, 1.85)) + 0.5 * beckon;
  // Ready: a low grappler's crouch, paws wide, rocking, tail swishing.
  const ready = ease(t, 1.8, 2.05);
  if (ready > 0) s.squash(1 + 0.08 * ready, 1 - 0.1 * ready);
  s.move(s.sway(5) * 5 * ready, 0);
  s.spin(s.sway(5) * 0.07 * ready);
  p.armL.rotation += 1.0 * ready;
  p.armR.rotation += -1.0 * ready;
  p.tail.rotation += s.sway(5, 1) * 0.3 * ready;
  // Legs.
  lift(p.legL, Math.max(0, roll), 0.4, 4);
  lift(p.legR, Math.max(0, -roll), -0.4, 4);
  spread(s, 0.4 * arc(t, 0.84, 1.08));
  lift(p.legR, beckon, -0.3, 3);
  tap(s, ready, 10, 0.3, 3);
};
const coilemurVictory: Move = (s) => {
  const { t, p } = s;
  // Grab and yank: a lunge out, a hard pull back.
  const grab = bump(t, 0, 0.3),
    yank = bump(t, 0.26, 0.6);
  s.move(s.side * (14 * grab - 9 * yank), -5 * arc(t, 0.0, 0.26));
  s.spin(s.side * (0.2 * grab - 0.16 * yank));
  p.armL.rotation = 1.4 * grab + 0.3 * yank;
  p.armR.rotation = -1.4 * grab - 0.3 * yank;
  // Beats its chest: four quick thumps.
  const beat = ease(t, 0.62, 0.7) * (1 - ease(t, 1.3, 1.4));
  const thump = Math.sin(t * 28) * beat;
  if (beat > 0) {
    s.squash(1 + 0.06 * Math.abs(thump), 1 - 0.05 * Math.abs(thump));
    s.move(thump * 2.5, 0);
    s.spin(thump * 0.06);
  }
  p.armL.rotation += (0.5 + thump * 0.5) * beat;
  p.armR.rotation += (-0.5 + thump * 0.5) * beat;
  s.spin(-s.side * 0.05 * beat);
  // Flexes tall, tail whirling, with a bounce.
  crouch(s, 1.3, 1.44, 0.1);
  const flex = ease(t, 1.44, 1.56);
  s.move(
    0,
    -(arc(t, 1.44, 1.9) * 20 + Math.max(0, s.sway(7)) * 4 * ease(t, 2.0, 2.2)),
  );
  land(s, 1.9, 0.12);
  p.armL.rotation += (2.2 + s.sway(14) * 0.1) * flex;
  p.armR.rotation += (-2.2 - s.sway(14) * 0.1) * flex;
  p.tail.rotation = (0.4 + s.sway(16) * 0.5) * flex;
  if (s.passed(1.9)) s.accent("spark", 4);
  // Legs.
  p.legR.rotation -= 0.5 * grab;
  p.legL.rotation += 0.4 * yank;
  lift(p.legL, Math.max(0, thump), 0.3, 3);
  lift(p.legR, Math.max(0, -thump), -0.3, 3);
  spread(s, 0.6 * arc(t, 1.44, 1.9));
  tap(s, ease(t, 2.0, 2.2), 7, 0.3, 3);
};

// ---------------------------------------------------------------- Pyranda
// Shy and easily startled, trying hard to be brave: "I can be brave. Watch."
const pyrandaEntrance: Move = (s) => {
  const { t, p } = s;
  // Hides behind its tail: small, head ducked.
  const hide = ease(t, 0, 0.15) * (1 - ease(t, 1.45, 1.6));
  if (hide > 0) s.squash(1 - 0.06 * hide, 1 - 0.18 * hide);
  p.head.y += 5 * hide;
  p.tail.rotation = 0.55 * hide;
  // Peeks out one side, ducks back, peeks out the other with a tiny wave.
  const peekA = bump(t, 0.3, 0.75),
    peekB = bump(t, 0.85, 1.45);
  s.move((7 * peekA - 7 * peekB) * s.side, 0);
  s.spin((0.14 * peekA - 0.14 * peekB) * s.side);
  p.head.y -= 4 * Math.max(peekA, peekB) * hide;
  p.armL.rotation = (0.9 + Math.sin(t * 18) * 0.3) * peekB;
  s.mood(t < 1.5 ? "normal" : t < 2.2 ? "focus" : "happy");
  // A deep breath, and it stands as tall as it can, fists clenched.
  const brave = ease(t, 1.6, 1.8);
  const puff = bump(t, 1.6, 2.2);
  if (brave > 0) s.squash(1 - 0.03 * puff, 1 + 0.08 * puff + 0.02 * brave);
  s.move(0, -6 * arc(t, 1.62, 1.95));
  p.armL.rotation += -0.5 * brave;
  p.armR.rotation = 0.5 * brave;
  p.tail.rotation += (-0.2 + s.sway(5) * 0.25) * brave;
  p.tail.setScale(0.5 + 0.04 * brave, 0.5 + 0.05 * brave);
  // Legs.
  spread(s, -0.2 * hide);
  lift(p.legL, peekA, 0.3, 3);
  lift(p.legR, peekB, -0.3, 3);
  lift(p.legR, bump(t, 1.62, 1.95), -0.5, 4);
  spread(s, 0.2 * brave);
  lift(p.legL, Math.max(0, s.sway(5)) * brave * 0.5, 0.2, 2);
};
const pyrandaVictory: Move = (s) => {
  const { t, p } = s;
  // Startled by its own win: a jump, eyes wide.
  s.move(0, -12 * arc(t, 0.02, 0.4));
  const eep = bump(t, 0.02, 0.4);
  if (eep > 0) s.squash(1 - 0.05 * eep, 1 + 0.1 * eep);
  land(s, 0.4, 0.12);
  s.mood(t < 0.45 ? "normal" : "happy");
  // Hides its face: curls small, paws up, tail round.
  const hide = ease(t, 0.45, 0.65) * (1 - ease(t, 1.1, 1.25));
  if (hide > 0) s.squash(1 + 0.02 * hide, 1 - 0.14 * hide);
  p.head.y += 6 * hide;
  p.armL.rotation = 1.6 * hide;
  p.armR.rotation = -1.6 * hide;
  p.tail.rotation = 0.5 * hide;
  // Peeks... and two proud little hops, the tail flame flaring.
  const proud = ease(t, 1.25, 1.4);
  s.move(0, -9 * (arc(t, 1.3, 1.6) + arc(t, 1.65, 1.95)));
  land(s, 1.6, 0.08, 0.1);
  land(s, 1.95, 0.08, 0.14);
  p.armL.rotation += (1.9 + s.sway(9) * 0.15) * proud;
  p.armR.rotation += (-1.9 - s.sway(9) * 0.15) * proud;
  // Bashful again: swaying, tail wagging.
  const sway = ease(t, 2.0, 2.3);
  s.spin(s.sway(2.2) * 0.07 * sway);
  p.tail.rotation += s.sway(6) * 0.3 * proud;
  p.tail.setScale(0.5 + 0.05 * proud, 0.5 + 0.07 * proud);
  p.head.rotation = s.sway(2.2) * 0.08 * sway;
  // Legs.
  spread(s, 0.6 * eep - 0.2 * hide);
  spread(s, 0.5 * (arc(t, 1.3, 1.6) + arc(t, 1.65, 1.95)));
  p.legR.rotation += s.sway(2.2) * 0.3 * sway;
  lift(p.legL, Math.max(0, s.sway(4.4)) * sway * 0.6, 0.2, 2);
};

// --------------------------------------------------------------- Glacelle
// Graceful and cool: an ice dancer. "Stay frosty."
const glacelleEntrance: Move = (s) => {
  const { t, p } = s;
  // Drifts down like a snowflake, turning a slow spiral.
  const fall = bump(t, 0, 1.3);
  const spiral = Math.sin(t * 5) * (1 - ease(t, 0.5, 1.3));
  s.move(spiral * 12 * ease(t, 0, 0.3), -16 * fall);
  s.spin(spiral * 0.1 * ease(t, 0, 0.3));
  // Wing-flaps unfurl, slow as a ballet arm.
  const unfurl = ease(t, 0.5, 1.4);
  p.armL.rotation = 1.5 * unfurl;
  p.armR.rotation = -1.5 * unfurl;
  // A curtsey: a dip, head bowed, arms drawn in a little.
  const curtsey = bump(t, 1.4, 2.1);
  if (curtsey > 0) s.squash(1 + 0.03 * curtsey, 1 - 0.1 * curtsey);
  p.head.y += 5 * curtsey;
  p.armL.rotation -= 0.7 * curtsey;
  p.armR.rotation += 0.7 * curtsey;
  s.spin(s.side * 0.06 * curtsey);
  // Poised: arms low and open, a slow paddle.
  const poise = ease(t, 2.1, 2.4);
  p.armL.rotation -= (0.7 - s.sway(2) * 0.15) * poise;
  p.armR.rotation += (0.7 - s.sway(2) * 0.15) * poise;
  s.move(0, -(1 + s.sway(2)) * 1.5 * poise);
  // Legs.
  // (A sea angel: its tail fin and little feet trail and flick.)
  p.tail.rotation += spiral * 0.5 * ease(t, 0, 0.3) + 0.5 * curtsey;
  p.legL.rotation += -spiral * 0.4 * ease(t, 0, 0.3);
  p.legR.rotation += -spiral * 0.4 * ease(t, 0, 0.3);
  spread(s, 0.35 * curtsey);
  kick(s, poise, 2, 0.25);
  p.tail.rotation += s.sway(2, 1) * 0.3 * poise;
};
const glacelleVictory: Move = (s) => {
  const { t, p } = s;
  // Two long skating strokes: out to one side, across to the other, and
  // home, leaning into each glide with the arms held wide. (A glide, never a
  // spin: the art is flat, and a spin reads as paper turning over.)
  const out = ease(t, 0, 0.42),
    across = ease(t, 0.42, 0.92),
    home = ease(t, 0.92, 1.2);
  s.move(s.side * (14 * out - 28 * across + 14 * home), 0);
  const glide = ease(t, 0, 0.15) * (1 - ease(t, 1.1, 1.24));
  s.move(0, -7 * glide);
  const lean =
    bump(t, 0, 0.46) - bump(t, 0.42, 0.96) + 0.6 * bump(t, 0.92, 1.22);
  s.spin(s.side * 0.2 * lean);
  p.armL.rotation = (1.0 + 0.4 * lean) * glide;
  p.armR.rotation = (-1.0 + 0.4 * lean) * glide;
  // Then rises into a dancer's pose, one arm high, the other low and wide,
  // and holds it, frozen.
  const pose = ease(t, 1.22, 1.34);
  const pop = bump(t, 1.22, 1.5);
  if (pop > 0) s.squash(1 - 0.03 * pop, 1 + 0.08 * pop);
  s.move(0, -10 * pose);
  s.spin(s.side * 0.07 * pose);
  p.armL.rotation += 2.4 * pose;
  p.armR.rotation -= 0.8 * pose;
  p.head.rotation = -0.08 * pose;
  if (s.passed(1.28)) s.accent("spark", 4);
  // A tiny shiver, then a slow drift, arms swaying.
  s.move(Math.sin(t * 60) * 1.4 * bump(t, 1.85, 2.15), 0);
  const drift = ease(t, 2.2, 2.5);
  s.move(0, -s.sway(1.8) * 2 * drift);
  p.armL.rotation += s.sway(1.8) * 0.12 * drift;
  p.armR.rotation -= s.sway(1.8) * 0.12 * drift;
  // Legs.
  p.tail.rotation += -0.6 * lean + 0.5 * pop;
  p.legL.rotation += -0.5 * lean;
  p.legR.rotation += -0.5 * lean;
  lift(p.legR, pose, -0.5, 3);
  kick(s, drift, 1.8, 0.2);
  p.tail.rotation += s.sway(1.8, 1) * 0.3 * drift;
};

// ---------------------------------------------------------------- Halcyra
// Precise, composed, a little vain: "Longest reach in the arena."
const halcyraEntrance: Move = (s) => {
  const { t, p } = s;
  // Up and back, then a diving swoop that brakes hard.
  const climb = ease(t, 0, 0.3) * (1 - ease(t, 0.3, 0.62));
  const dive = bump(t, 0.3, 0.7);
  s.move(-s.side * 12 * climb, -18 * climb);
  s.spin(s.side * (-0.12 * climb + 0.28 * dive));
  const swept = ease(t, 0.1, 0.3) * (1 - ease(t, 0.62, 0.7));
  p.armL.rotation = -0.5 * swept;
  p.armR.rotation = 0.5 * swept;
  const brake = bump(t, 0.66, 1.0);
  s.spin(-s.side * 0.16 * brake);
  p.armL.rotation += 2.0 * brake;
  p.armR.rotation -= 2.0 * brake;
  s.move(0, -5 * brake);
  land(s, 1.0, 0.06, 0.14);
  // Folds its wings, one, two, crisp.
  p.armL.rotation += 1.0 * (t > 1.0 && t < 1.14 ? 1 : 0);
  p.armR.rotation -= 1.0 * (t > 1.0 && t < 1.3 ? 1 : 0);
  // Sights along its beak: low, leaning in, crest up, perfectly still.
  const aim = ease(t, 1.35, 1.5);
  s.mood(t > 1.3 && t < 2.3 ? "focus" : "happy");
  s.spin(s.side * 0.08 * aim);
  if (aim > 0) s.squash(1 + 0.02 * aim, 1 - 0.05 * aim);
  p.ears.setScale(0.5, 0.5 + 0.08 * aim);
  // Then a bird's quick looks about: the head snaps, it never drifts.
  const look = s.calm ? 0 : [0, 1, 0, -1, 1, 0, -1][Math.floor(t * 2.2) % 7];
  p.head.rotation = look * 0.11 * ease(t, 2.3, 2.35);
  // Legs.
  p.legL.rotation += 0.5 * swept - 0.6 * brake;
  p.legR.rotation += 0.5 * swept - 0.6 * brake;
  lift(p.legL, bump(t, 1.02, 1.16), 0.3, 3);
  lift(p.legR, bump(t, 1.16, 1.3), -0.3, 3);
  p.legR.rotation += 0.35 * aim;
  lift(p.legL, Math.max(0, s.sway(4.4)) * ease(t, 2.3, 2.4) * 0.6, 0.25, 2);
};
const halcyraVictory: Move = (s) => {
  const { t, p } = s;
  // Preens: leans to its wing, three quick nibbles.
  const preen = ease(t, 0, 0.15) * (1 - ease(t, 0.85, 0.95));
  s.spin(-s.side * 0.14 * preen);
  p.head.rotation = 0.15 * preen;
  p.head.y += (3 + Math.abs(Math.sin(t * 14)) * 2.5) * preen;
  p.armL.rotation = 0.7 * preen;
  // Snaps upright, chest out, crest fanned.
  const proud = ease(t, 0.95, 1.05);
  const puff = bump(t, 0.95, 1.4);
  if (proud > 0)
    s.squash(1 + 0.05 * proud + 0.03 * puff, 1 + 0.03 * proud + 0.05 * puff);
  p.ears.setScale(0.5, 0.5 + 0.1 * proud);
  s.move(0, -7 * arc(t, 0.95, 1.25));
  // One wing swept out in a formal bow.
  const bow = bump(t, 1.3, 2.0);
  p.armL.rotation += 1.9 * bow;
  p.head.y += 5 * bow;
  s.spin(s.side * 0.1 * bow);
  // Poised: beak high, a bird's quick looks about.
  const look = s.calm ? 0 : [0, -1, 0, 1, 0, 1, -1][Math.floor(t * 2.2) % 7];
  p.head.rotation += (-0.06 + look * 0.1) * ease(t, 2.05, 2.1);
  // Legs.
  lift(p.legR, preen, -0.4, 5);
  spread(s, 0.4 * arc(t, 0.95, 1.25));
  p.legR.rotation += 0.4 * bow;
  tap(s, ease(t, 2.05, 2.2), 4.4, 0.3, 3);
};

// ---------------------------------------------------------------- Sunbara
// Blissfully calm and warm: "Hi friend! Everyone's my friend."
const sunbaraEntrance: Move = (s) => {
  const { t, p } = s;
  // An unhurried waddle, rocking side to side.
  const waddle = 1 - ease(t, 0.95, 1.1);
  const rock = Math.sin(t * Math.PI * 2.2) * waddle;
  s.move(rock * 6, -Math.abs(rock) * 2);
  s.spin(rock * 0.09);
  // The yuzu wobbles, nearly rolls off... and it leans calmly to keep it.
  const wobble = ease(t, 0.3, 1.1) * (1 - ease(t, 1.45, 1.75));
  const tip = bump(t, 1.05, 1.6);
  p.flame.rotation = Math.sin(t * 9) * 0.25 * wobble + 0.5 * tip;
  s.spin(-0.12 * tip);
  p.head.rotation = -0.1 * tip;
  s.mood(tip > 0.3 ? "normal" : "happy");
  // Arms open wide: a hug for whoever is across the court.
  const hug = ease(t, 1.7, 2.0);
  const reach = bump(t, 1.7, 2.3);
  p.armL.rotation = (1.3 + 0.3 * reach) * hug;
  p.armR.rotation = (-1.3 - 0.3 * reach) * hug;
  if (hug > 0) s.squash(1 + 0.03 * reach, 1 + 0.03 * reach);
  s.spin(s.sway(1.6) * 0.05 * hug);
  s.move(s.sway(1.6) * 2 * hug, 0);
  p.flame.rotation += s.sway(1.6, 1) * 0.08 * hug;
  // Legs.
  lift(p.legL, Math.max(0, rock), 0.3, 3);
  lift(p.legR, Math.max(0, -rock), -0.3, 3);
  lift(p.legR, tip, -0.5, 4);
  tap(s, hug, 3.2, 0.2, 2);
};
const sunbaraVictory: Move = (s) => {
  const { t, p } = s;
  // Lowers itself into a hot spring that isn't there.
  const soak = ease(t, 0.1, 1.0);
  const breath = s.sway(1.5) * 0.02 * ease(t, 1.2, 1.6);
  s.squash(1 + 0.12 * soak + breath, 1 - 0.2 * soak - breath);
  p.legL.rotation = 0.7 * soak;
  p.legR.rotation = -0.7 * soak;
  s.spin(-s.side * 0.1 * soak);
  // Arms out along the rim, head back, a long contented sigh.
  p.armL.rotation = 1.0 * soak;
  p.armR.rotation = -1.0 * soak;
  p.head.rotation = -0.08 * soak;
  const sigh = bump(t, 1.0, 1.7);
  if (sigh > 0) s.squash(1 - 0.03 * sigh, 1 + 0.05 * sigh);
  p.flame.rotation =
    s.sway(1.5, 1) * 0.1 * soak + Math.sin(t * 8) * 0.2 * bump(t, 0.1, 1.0);
  // Legs.
  lift(p.legL, bump(t, 0.1, 0.5), 0.3, 3);
  kick(s, ease(t, 1.2, 1.6), 6, 0.12);
};

// --------------------------------------------------------------- Astrabun
// Bubbly and bouncy, with the moon's gravity in its legs.
const astrabunEntrance: Move = (s) => {
  const { t, p } = s;
  // Three moon hops, each higher, each with a long float at the top.
  const hops: [number, number, number][] = [
    [0, 0.4, 10],
    [0.4, 0.95, 20],
    [0.95, 1.7, 32],
  ];
  let ears = 0;
  for (const [a, b, h] of hops) {
    s.move(0, -h * arc(t, a, b));
    crouch(s, a - 0.08, a, 0.08);
    land(s, b, 0.12, 0.14);
    if (t > a && t < b) ears = (t - a) / (b - a) < 0.5 ? -0.22 : 0.26;
  }
  if (s.passed(1.7)) s.accent("dust", 3);
  p.ears.rotation = ears;
  const float = arc(t, 0.95, 1.7);
  p.legL.rotation = 0.4 * float;
  p.legR.rotation = -0.4 * float;
  p.armL.rotation = 1.6 * float;
  // Lands, ears flop, then spring straight up.
  const perk = ease(t, 1.8, 1.95);
  p.ears.rotation += 0.3 * bump(t, 1.7, 1.9);
  p.ears.setScale(0.5, 0.5 + (0.07 + s.sway(8) * 0.01) * perk);
  // Ready: bouncing on its toes.
  s.move(0, -Math.max(0, s.sway(9)) * 5 * perk);
  p.armL.rotation += (0.6 + s.sway(9) * 0.1) * perk;
  p.ears.rotation += s.sway(9, 1) * 0.07 * perk;
  // Legs.
  spread(s, 0.4 * (arc(t, 0, 0.4) + arc(t, 0.4, 0.95)));
  spread(s, 0.35 * Math.max(0, s.sway(9)) * perk);
};
const astrabunVictory: Move = (s) => {
  const { t, p } = s;
  // Mochi pound with its whole body: up, and SLAM, twice.
  for (const [a, b] of [
    [0, 0.36],
    [0.42, 0.78],
  ]) {
    s.move(0, -16 * arc(t, a, b));
    land(s, b, 0.26, 0.16);
    if (s.passed(b)) s.accent("dust", 3);
  }
  p.ears.rotation =
    -0.25 * (bump(t, 0, 0.3) + bump(t, 0.42, 0.72)) +
    0.3 * (bump(t, 0.36, 0.5) + bump(t, 0.78, 0.95));
  // Then one enormous, slow moon jump, legs kicking.
  crouch(s, 0.84, 0.98, 0.14);
  const air = arc(t, 0.98, 1.95);
  const up = t > 0.98 && t < 1.95 ? 1 : 0;
  s.move(0, -40 * air);
  p.legL.rotation = Math.sin(t * 16) * 0.5 * up;
  p.legR.rotation = -Math.sin(t * 16) * 0.5 * up;
  p.ears.rotation += (t < 1.46 ? -0.2 : 0.24) * up;
  land(s, 1.95, 0.16);
  // Free paw waving high, still hopping.
  const hold = ease(t, 1.0, 1.2);
  p.armL.rotation = (2.4 + s.sway(13) * 0.3) * hold;
  s.move(0, -Math.max(0, s.sway(8)) * 8 * ease(t, 2.05, 2.25));
  p.ears.rotation += s.sway(8, 1) * 0.1 * ease(t, 2.05, 2.25);
  // Legs.
  spread(s, 0.5 * (arc(t, 0, 0.36) + arc(t, 0.42, 0.78)));
  lift(p.legR, Math.max(0, s.sway(16)) * ease(t, 2.05, 2.25), -0.3, 3);
};

export const ENTRANCES: Partial<Record<CharacterId, Move>> = {
  voltkit: voltkitEntrance,
  cindrake: cindrakeEntrance,
  tidefin: tidefinEntrance,
  auralynx: auralynxEntrance,
  lumoth: lumothEntrance,
  mystowl: mystowlEntrance,
  terradon: terradonEntrance,
  duskveil: duskveilEntrance,
  coilemur: coilemurEntrance,
  pyranda: pyrandaEntrance,
  glacelle: glacelleEntrance,
  halcyra: halcyraEntrance,
  sunbara: sunbaraEntrance,
  astrabun: astrabunEntrance,
};
export const VICTORIES: Partial<Record<CharacterId, Move>> = {
  voltkit: voltkitVictory,
  cindrake: cindrakeVictory,
  tidefin: tidefinVictory,
  auralynx: auralynxVictory,
  lumoth: lumothVictory,
  mystowl: mystowlVictory,
  terradon: terradonVictory,
  duskveil: duskveilVictory,
  coilemur: coilemurVictory,
  pyranda: pyrandaVictory,
  glacelle: glacelleVictory,
  halcyra: halcyraVictory,
  sunbara: sunbaraVictory,
  astrabun: astrabunVictory,
};
/** The moment Reduce motion shows: every move has settled into its hold. */
export const SETTLED = 12;

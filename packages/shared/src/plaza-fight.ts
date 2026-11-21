/**
 * Landing a hooked fish at the Plaza's pond: hold to reel, let go to give
 * line. The browser plays it live (apps/client/src/plaza/plaza-fight-view.ts)
 * and sends the moments the player pressed and let go; the game server runs
 * the same steps from the same seed (apps/server/src/plaza.ts: land) and its
 * result is the one that counts, so a catch can't be made up.
 *
 * Each step (PLAZA_FIGHT.tickMs) the line's tension rises while you hold
 * and falls while you don't; the fish thrashes now and then, pulling it up.
 * In the green band the fish comes in (progress fills). Too slack and it
 * swims back out (progress drains: at 0 it is gone); held at the top too
 * long and the line snaps. Rarer fish thrash harder and more often, keep a
 * narrower band and come in slower.
 */
export type PlazaFightRarity = "common" | "uncommon" | "rare" | "legendary";
export type PlazaFightResult = "going" | "caught" | "snap" | "escape";

export const PLAZA_FIGHT = {
  /** One step (ms): the server replays the fight in these. */
  tickMs: 50,
  /** The longest fight (steps): past it the fish gets away. */
  maxTicks: 400,
  /** Where the tension and the fish start. */
  tension0: 0.3,
  progress0: 0.3,
  /** Tension a second, holding / letting go. */
  reel: 1.0,
  slack: 0.85,
  /** At the top this long (steps), the line snaps. */
  snapAt: 0.97,
  snapTicks: 10,
  /** Progress a second, too slack (the fish swims back out). */
  loss: 0.16,
  /** Above the band: still reeling, at a third of the speed. */
  overGain: 0.33,
  /** Most presses and let-goes a fight can send. */
  maxMoves: 400,
  /** What each rarity's fish is like: its band, how fast it comes in, how
   * hard and how often it thrashes (ms between, ms each). */
  fish: {
    common: {
      lo: 0.3,
      hi: 0.78,
      gain: 0.17,
      pull: 0.75,
      every: [1100, 1900],
      lasts: [250, 450],
    },
    uncommon: {
      lo: 0.34,
      hi: 0.75,
      gain: 0.14,
      pull: 0.95,
      every: [900, 1600],
      lasts: [300, 550],
    },
    rare: {
      lo: 0.38,
      hi: 0.72,
      gain: 0.13,
      pull: 1.0,
      every: [750, 1350],
      lasts: [350, 600],
    },
    legendary: {
      lo: 0.42,
      hi: 0.7,
      gain: 0.11,
      pull: 1.1,
      every: [700, 1200],
      lasts: [350, 650],
    },
  } satisfies Record<
    PlazaFightRarity,
    {
      lo: number;
      hi: number;
      gain: number;
      pull: number;
      every: [number, number];
      lasts: [number, number];
    }
  >,
} as const;

/** A small seeded random (mulberry32): the same fish on both sides. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PlazaFight {
  rarity: PlazaFightRarity;
  /** Steps run. */
  tick: number;
  tension: number;
  progress: number;
  /** The fish is thrashing now (it pulls the line up). */
  thrash: boolean;
  /** Steps held at the top (the line snaps at PLAZA_FIGHT.snapTicks). */
  strain: number;
  result: PlazaFightResult;
  /** The fish's next thrash: when it starts and ends (steps). */
  next: number;
  until: number;
  rand: () => number;
}

export function plazaFightStart(
  seed: number,
  rarity: PlazaFightRarity,
): PlazaFight {
  const f: PlazaFight = {
    rarity,
    tick: 0,
    tension: PLAZA_FIGHT.tension0,
    progress: PLAZA_FIGHT.progress0,
    thrash: false,
    strain: 0,
    result: "going",
    next: 0,
    until: 0,
    rand: seeded(seed),
  };
  plan(f, 0);
  return f;
}
/** The fish's next thrash, from step `from`. */
function plan(f: PlazaFight, from: number) {
  const k = PLAZA_FIGHT.fish[f.rarity],
    T = PLAZA_FIGHT.tickMs,
    gap = k.every[0] + f.rand() * (k.every[1] - k.every[0]),
    len = k.lasts[0] + f.rand() * (k.lasts[1] - k.lasts[0]);
  f.next = from + Math.round(gap / T);
  f.until = f.next + Math.max(1, Math.round(len / T));
}
/** One step, holding or not. */
export function plazaFightStep(f: PlazaFight, holding: boolean) {
  if (f.result !== "going") return f;
  const k = PLAZA_FIGHT.fish[f.rarity],
    dt = PLAZA_FIGHT.tickMs / 1000;
  f.tick++;
  f.thrash = f.tick >= f.next && f.tick < f.until;
  if (f.tick >= f.until) plan(f, f.until);
  f.tension +=
    (holding ? PLAZA_FIGHT.reel : -PLAZA_FIGHT.slack) * dt +
    (f.thrash ? k.pull * dt : 0);
  f.tension = Math.min(1, Math.max(0, f.tension));
  if (f.tension < k.lo) f.progress -= PLAZA_FIGHT.loss * dt;
  else if (f.tension <= k.hi) f.progress += k.gain * dt;
  else f.progress += k.gain * PLAZA_FIGHT.overGain * dt;
  f.strain = f.tension >= PLAZA_FIGHT.snapAt ? f.strain + 1 : 0;
  if (f.progress >= 1) f.result = "caught";
  else if (f.strain >= PLAZA_FIGHT.snapTicks) f.result = "snap";
  else if (f.progress <= 0 || f.tick >= PLAZA_FIGHT.maxTicks)
    f.result = "escape";
  f.progress = Math.min(1, Math.max(0, f.progress));
  return f;
}
/**
 * A whole fight from its moves: the steps at which the player pressed or
 * let go, in order (it starts let go). Runs until the fight ends, or until
 * `upTo` steps (the browser's last step) with the fish still on.
 */
export function plazaFightReplay(
  seed: number,
  rarity: PlazaFightRarity,
  moves: readonly number[],
  upTo = PLAZA_FIGHT.maxTicks,
) {
  const f = plazaFightStart(seed, rarity);
  let i = 0,
    holding = false;
  while (f.result === "going" && f.tick < upTo) {
    while (i < moves.length && moves[i] <= f.tick) {
      holding = !holding;
      i++;
    }
    plazaFightStep(f, holding);
  }
  return f;
}
/** Moves as the browser sends them: whole steps, rising, not too many. */
export function plazaFightMovesOk(moves: unknown): moves is number[] {
  if (!Array.isArray(moves) || moves.length > PLAZA_FIGHT.maxMoves)
    return false;
  let last = -1;
  for (const m of moves) {
    if (!Number.isInteger(m) || m < last || m > PLAZA_FIGHT.maxTicks)
      return false;
    last = m;
  }
  return true;
}

import {
  CHARACTERS,
  CURRENT_HOLD,
  ULT_SLOT,
  advanceMovement,
  blinkLanding,
  exAbility,
  kitOf,
  move,
  normalize,
  RULES,
  type Ability,
  type Fighter,
  type Input,
  dashCooldownOf,
} from "../../../packages/shared/src/index";
import type { RaidState, RaidWarning } from "../../../packages/shared/src/raid";
import {
  driftPrison,
  heldInput,
  pullIntoUndertow,
  undertowPull,
} from "../../../packages/shared/src/tidelotl-drift";
import {
  galeBlow,
  gustBlow,
  inVolleyCone,
  lumiShapeHits,
} from "../../../packages/shared/src/raid-volley";
import { canCastSkill } from "./cast-prediction";

/**
 * Movement skills move you on the server, so they are predicted too (else
 * the fighter would snap a round trip later): a blink teleports, a rush
 * (or a River Dash) starts its charge, a tunnel digs in (and speeds up), exactly as
 * Arena.cast does. Their hits stay the server's.
 */
const moves = (a: Ability | undefined) =>
  a?.kind === "blink" ||
  a?.kind === "rush" ||
  a?.kind === "surf" ||
  a?.kind === "leap" ||
  a?.kind === "tunnel" ||
  !!a?.lunge;
function castMove(
  p: Fighter,
  a: Ability,
  input: Input,
  time: number,
  slot: number,
) {
  if (a.kind === "tunnel") {
    p.burrow = { until: time + a.duration, slot, haste: a.tunnel?.haste ?? 1 };
    return;
  }
  if (a.kind === "leap") {
    // Magma Leap: through the air toward the aim (as Arena.cast).
    const distance = Math.min(
      a.range,
      Math.hypot(input.aimX - p.x, input.aimY - p.y),
    );
    const seconds = Math.max(0.12, distance / Math.max(1, a.speed));
    p.dashX = (Math.cos(p.angle) * distance) / seconds;
    p.dashY = (Math.sin(p.angle) * distance) / seconds;
    p.dashUntil = time + seconds;
    p.jumpUntil = Math.max(p.jumpUntil, time + seconds);
    p.recoveryUntil = Math.max(p.recoveryUntil, time + seconds);
    return;
  }
  if (a.lunge) {
    // Facet Guard: a vault toward the aim.
    const distance = Math.min(
      a.lunge,
      Math.hypot(input.aimX - p.x, input.aimY - p.y),
    );
    const seconds = distance / Math.max(1, a.speed);
    p.dashX = Math.cos(p.angle) * a.speed;
    p.dashY = Math.sin(p.angle) * a.speed;
    p.dashUntil = time + seconds;
    p.recoveryUntil = Math.max(p.recoveryUntil, time + seconds);
    return;
  }
  if (a.kind === "blink") {
    const land = blinkLanding(
      p,
      p.angle,
      Math.min(a.range, Math.hypot(input.aimX - p.x, input.aimY - p.y)),
    );
    p.x = land.x;
    p.y = land.y;
    p.vx = p.vy = 0;
  } else {
    const seconds = a.range / Math.max(1, a.speed);
    p.dashX = Math.cos(p.angle) * a.speed;
    p.dashY = Math.sin(p.angle) * a.speed;
    p.dashUntil = time + seconds;
    p.recoveryUntil = Math.max(p.recoveryUntil, time + seconds);
  }
}

/**
 * Riptide Wave and Radiant Flare: the server refreshes a fighter's
 * `current` (carried) or `lure` (drawn in) to CURRENT_HOLD seconds every
 * tick it holds it. A snapshot therefore says the
 * current ends 0.15 s later, but your inputs are replayed up to a round
 * trip and more past it (~0.2 s), so the last of them were predicted
 * without the drift and every snapshot pulled you back ~7 px: a twitch 15
 * times a second while you stood in it. When the snapshot shows the current
 * was just refreshed (you are still in the lane), it carries on through the
 * replay; once you leave, the server stops refreshing it and the next
 * snapshot ends it.
 */
export function carryCurrent(p: Fighter, snapshotTime: number) {
  for (const s of p.statuses)
    if (
      (s.kind === "current" || s.kind === "lure") &&
      s.until - snapshotTime > CURRENT_HOLD - 1 / RULES.tick - 1e-6
    )
      s.until = snapshotTime + 1;
}
/**
 * Your unanswered inputs as the server will step them: one step each, in
 * order. The first `held` of them pay ticks the server held for them (Wi-Fi
 * held your packets, so those ticks did not move you: Fighter.held, Arena.
 * drainInputs) and step at those ticks' times, the snapshot's own and the
 * ones before it; the rest at the ticks after the snapshot. Returns each
 * input with its tick relative to the snapshot (1 = the next tick).
 *
 * Until 18 Nov 2026 the server ran your last input again on those ticks and
 * folded the late inputs afterwards, so the phone folded them too; a turn during the hold still jumped (network-performance
 * section 16).
 */
export function serverSteps(
  pending: readonly Input[],
  held = 0,
): { input: Input; tick: number }[] {
  const wait = Math.max(0, Math.floor(held));
  return pending.map((input, i) => ({ input, tick: i + 1 - wait }));
}

/**
 * The step a new input (just added at the end of `pending`) takes: the
 * input and its tick relative to the snapshot (see serverSteps).
 */
export function newestStep(
  pending: readonly Input[],
  held = 0,
): { input: Input; tick: number } | undefined {
  const input = pending[pending.length - 1];
  if (!input) return;
  return { input, tick: pending.length - Math.max(0, Math.floor(held)) };
}

/**
 * What Tidelotl does to you between snapshots, as the last one showed it:
 * the Undertow drawing everyone in, the Bubble Prison you are sealed in,
 * and a bubble's root. The server does all three to you every tick, before
 * your input moves you (raid-tidewyrm.ts, through tidelotl-drift.ts); the
 * phone steps them the same way, so a snapshot no longer pulls you back by
 * what the replay left out (about 150 corrections a minute, 26 Nov 2026).
 */
export interface RaidCarry {
  /** The snapshot's time: the ticks up to it are in it already. */
  from: number;
  undertow?: { x: number; y: number; until: number; pull: number };
  /** The bubble you are sealed in, moved on as the replay steps. */
  prison?: { x: number; y: number; until: number };
  /** A bubble rooted you until then. */
  rootedUntil?: number;
  boss?: { x: number; y: number };
  /**
   * Lumiwick's blows on their way: a Wing Gust blows everyone in its cone
   * 220 px, the ascendant's Snuffing Gale everyone in its lane outside a
   * brazier's ring 140 px, in the tick it lands. `landed`: the replay has
   * stepped it.
   */
  gusts?: { w: RaidWarning; landed?: boolean }[];
  braziers?: { x: number; y: number }[];
  /** A staggered boss lands nothing until then (RaidArena.attacksStep). */
  staggerUntil?: number;
}
export function raidCarry(
  me: Fighter,
  raid: RaidState | undefined,
  boss: Fighter | undefined,
  snapshotTime: number,
): RaidCarry | undefined {
  const u = raid?.undertow;
  const prison = raid?.prisons?.find((q) => q.playerId === me.id);
  const rootedUntil = raid?.rooted?.[me.id];
  const gusts = raid?.warnings
    ?.filter((w) => w.kind === "wing-gust" || w.kind === "snuff-gale")
    .map((w) => ({ w: { ...w } }));
  if (!u && !prison && rootedUntil === undefined && !gusts?.length) return;
  return {
    from: snapshotTime,
    undertow: u && {
      x: u.x,
      y: u.y,
      until: u.until,
      pull: undertowPull(raid?.trait),
    },
    prison: prison && { x: prison.x, y: prison.y, until: prison.until },
    rootedUntil,
    boss: boss && { x: boss.x, y: boss.y },
    gusts: gusts?.length ? gusts : undefined,
    braziers: raid?.braziers?.map((b) => ({ x: b.x, y: b.y })),
    staggerUntil: raid?.staggerUntil,
  };
}
/**
 * One predicted tick of it, at the tick's `time` (its end, as
 * predictFighter takes it), in the server's order: a Wing Gust that lands
 * blows you, the prison carries you or else the Undertow pulls you, then a
 * root or the prison holds your input. Returns the input the server will run for the tick. A late input
 * for a tick the server held (serverSteps, at or before the snapshot) only
 * moves you: that tick's pull and drift are in the snapshot already.
 */
export function stepRaidCarry(
  p: Fighter,
  carry: RaidCarry | undefined,
  input: Input,
  time: number,
): Input {
  if (!carry || p.out || p.hp <= 0) return input;
  const dt = 1 / RULES.tick,
    start = time - dt,
    sealed = !!carry.prison;
  if (time <= carry.from + 1e-6) return sealed ? heldInput(input, true) : input;
  // A warning lands in the first tick that starts at or after its time,
  // unless the boss is staggered (then it waits).
  if (carry.gusts && !((carry.staggerUntil ?? 0) > start))
    for (const gust of carry.gusts) {
      const w = gust.w;
      if (gust.landed || w.at > start) continue;
      gust.landed = true;
      const blow =
        w.kind === "snuff-gale"
          ? lumiShapeHits(w, p.x, p.y, carry.braziers ?? [])
            ? galeBlow(w)
            : undefined
          : inVolleyCone(w, p)
            ? gustBlow(p, w, input, start)
            : undefined;
      if (blow) move(p, blow.x, blow.y);
    }
  if (carry.prison) {
    if (carry.boss) driftPrison(carry.prison, carry.boss, start, dt);
    p.x = carry.prison.x;
    p.y = carry.prison.y;
  } else if (carry.undertow && carry.undertow.until > start)
    pullIntoUndertow(p, carry.undertow, carry.undertow.pull, dt);
  return sealed || (carry.rootedUntil ?? 0) > start
    ? heldInput(input, sealed)
    : input;
}

/** Local movement prediction must obey the same knockout rules as the server. */
export function predictFighter(
  p: Fighter,
  input: Input,
  time: number,
  raid: boolean,
) {
  if (p.out || p.hp <= 0) {
    p.vx = p.vy = 0;
    p.dashUntil = p.jumpUntil = 0;
    if (raid && !p.out) {
      const d = normalize(input.dx, input.dy);
      move(p, (d.x * 35) / RULES.tick, (d.y * 35) / RULES.tick);
    }
    return;
  }
  // Rooted (or underground) fighters can't dash (Arena.tick ignores the input).
  // Grounded (Sticky Mochi) fighters can't dash either.
  const rooted = p.statuses.some(
    (s) => (s.kind === "root" || s.kind === "grounded") && s.until > time,
  );
  if (p.burrow && time >= p.burrow.until) p.burrow = undefined;
  if (input.dash && !rooted && !p.burrow && time >= p.dashAt) {
    const d = normalize(input.dx, input.dy);
    p.dashX = (d.x || d.y ? d.x : Math.cos(p.angle)) * RULES.dashSpeed;
    p.dashY = (d.x || d.y ? d.y : Math.sin(p.angle)) * RULES.dashSpeed;
    p.dashUntil = time + RULES.dashDuration;
    p.dashAt = time + dashCooldownOf(p);
  }
  advanceMovement(p, input, 1 / RULES.tick, time);
  const kit = kitOf(p.character, p.rites);
  // A wind-up that ends now (Full Moon, Landslide).
  if (p.charge && time >= p.charge.at) {
    const a = kit.skills[p.charge.skill];
    if (moves(a)) {
      castMove(p, p.charge.ex ? exAbility(a) : a, input, time, p.charge.skill);
      p.charge = undefined;
    }
  }
  const slot = input.skill;
  // Casting Tunnel again surfaces.
  if (p.burrow && slot === p.burrow.slot) {
    p.burrow = undefined;
    return;
  }
  // Underground, only the ultimate (Leaf Storm) goes, and it surfaces first.
  if (p.burrow && slot !== ULT_SLOT) return;
  if (p.burrow && slot === ULT_SLOT && canCastSkill(p, slot, time))
    p.burrow = undefined;
  const a = slot >= 0 ? kit.skills[slot] : undefined;
  if (!a || !moves(a) || !canCastSkill(p, slot, time)) return;
  if (slot === ULT_SLOT) p.ult = 0;
  else p.cooldowns[slot] = time + a.cooldown;
  p.recoveryUntil = time + a.cast + a.recovery;
  const used = input.ex && slot !== ULT_SLOT ? exAbility(a) : a;
  if (a.cast) p.charge = { at: time + a.cast, skill: slot, ex: !!input.ex };
  else castMove(p, used, input, time, slot);
}

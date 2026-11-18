import {
  CHARACTERS,
  CURRENT_HOLD,
  ROLL,
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
import { canCastSkill } from "./cast-prediction";

/**
 * Movement skills move you on the server, so they are predicted too (else
 * the fighter would snap a round trip later): a blink teleports, a rush
 * (or a River Dash) starts its charge, a roll curls up and a pinball launches, exactly as
 * Arena.cast does. Their hits stay the server's.
 */
const moves = (a: Ability | undefined) =>
  a?.kind === "blink" ||
  a?.kind === "rush" ||
  a?.kind === "surf" ||
  a?.kind === "roll" ||
  a?.kind === "pinball" ||
  !!a?.lunge;
function castMove(
  p: Fighter,
  a: Ability,
  input: Input,
  time: number,
  slot: number,
) {
  if (a.kind === "roll") {
    p.roll = {
      until: time + a.duration,
      speed: CHARACTERS[p.character].speed * ROLL.start,
      heading: p.angle,
      top: a.speed,
      slot,
    };
    return;
  }
  if (a.kind === "pinball") {
    p.roll = undefined;
    p.dashX = Math.cos(p.angle) * a.speed;
    p.dashY = Math.sin(p.angle) * a.speed;
    p.dashUntil = time + a.duration;
    p.recoveryUntil = Math.max(p.recoveryUntil, p.dashUntil);
    p.pinball = { bounces: a.count ?? 4, speedUp: a.pinball?.speedUp ?? 1.1 };
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
  // Rooted (or curled-up) fighters can't dash (Arena.tick ignores the input).
  const rooted = p.statuses.some((s) => s.kind === "root" && s.until > time);
  if (p.roll && time >= p.roll.until) p.roll = undefined;
  if (input.dash && !rooted && !p.roll && time >= p.dashAt) {
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
  // Casting Curl & Roll again uncurls.
  if (p.roll && slot === p.roll.slot) {
    p.roll = undefined;
    return;
  }
  // Curled up, only the ultimate (Pinball) goes.
  if (p.roll && slot !== ULT_SLOT) return;
  const a = slot >= 0 ? kit.skills[slot] : undefined;
  if (!a || !moves(a) || !canCastSkill(p, slot, time)) return;
  if (slot === ULT_SLOT) p.ult = 0;
  else p.cooldowns[slot] = time + a.cooldown;
  p.recoveryUntil = time + a.cast + a.recovery;
  const used = input.ex && slot !== ULT_SLOT ? exAbility(a) : a;
  if (a.cast) p.charge = { at: time + a.cast, skill: slot, ex: !!input.ex };
  else castMove(p, used, input, time, slot);
}

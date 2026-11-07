import {
  CHARACTERS,
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
} from "../../../packages/shared/src/index";
import { canCastSkill } from "./cast-prediction";

/**
 * Movement skills move you on the server, so they are predicted too (else
 * the fighter would snap a round trip later): a blink teleports, a rush
 * starts its charge, a roll curls up and a pinball launches, exactly as
 * Arena.cast does. Their hits stay the server's.
 */
const moves = (a: Ability | undefined) =>
  a?.kind === "blink" ||
  a?.kind === "rush" ||
  a?.kind === "roll" ||
  a?.kind === "pinball";
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
    p.dashAt = time + RULES.dashCooldown;
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

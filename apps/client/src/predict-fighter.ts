import {
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
 * the fighter would snap a round trip later): a blink teleports and a rush
 * starts its charge, exactly as Arena.cast does. Their hits stay the server's.
 */
const moves = (a: Ability | undefined) =>
  a?.kind === "blink" || a?.kind === "rush";
function castMove(p: Fighter, a: Ability, input: Input, time: number) {
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
  if (input.dash && time >= p.dashAt) {
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
      castMove(p, p.charge.ex ? exAbility(a) : a, input, time);
      p.charge = undefined;
    }
  }
  const slot = input.skill;
  const a = slot >= 0 ? kit.skills[slot] : undefined;
  if (!a || !moves(a) || !canCastSkill(p, slot, time)) return;
  if (slot === ULT_SLOT) p.ult = 0;
  else p.cooldowns[slot] = time + a.cooldown;
  p.recoveryUntil = time + a.cast + a.recovery;
  const used = input.ex && slot !== ULT_SLOT ? exAbility(a) : a;
  if (a.cast) p.charge = { at: time + a.cast, skill: slot, ex: !!input.ex };
  else castMove(p, used, input, time);
}

import {
  advanceMovement,
  move,
  normalize,
  RULES,
  OBSTACLES,
  type Fighter,
  type Input,
  type MovementContext,
} from "../../../packages/shared/src/index";

/** Local movement prediction must obey the same knockout rules as the server. */
export function predictFighter(
  p: Fighter,
  input: Input,
  time: number,
  raid: boolean,
  context: MovementContext = { obstacles: OBSTACLES, speedScale: 1 },
) {
  if (p.out || p.hp <= 0) {
    p.vx = p.vy = 0;
    p.dashUntil = p.jumpUntil = 0;
    if (raid && !p.out) {
      const d = normalize(input.dx, input.dy);
      move(p, (d.x * 35) / RULES.tick, (d.y * 35) / RULES.tick, RULES.radius, context.obstacles);
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
  advanceMovement(p, input, 1 / RULES.tick, time, context);
}

import type Phaser from "phaser";
import type { Snapshot } from "@arena/shared";
export function drawArcade(
  g: Phaser.GameObjects.Graphics,
  state: Snapshot,
  reduced: boolean,
) {
  for (const m of state.arcade?.meteors ?? []) {
    const progress = Math.max(0, Math.min(1, 1 - (m.at - state.time) / 1.3));
    g.fillStyle(0xff866f, 0.12 + progress * 0.12).fillCircle(
      m.x,
      m.y,
      m.radius,
    );
    g.lineStyle(3, 0xffb4a0, 0.9).strokeCircle(m.x, m.y, m.radius);
    g.fillStyle(0xffdc9e, 0.15).fillCircle(m.x, m.y, m.radius * progress);
    g.lineStyle(3, 0xffe0a0, 0.9)
      .lineBetween(m.x - 10, m.y - 10, m.x + 10, m.y + 10)
      .lineBetween(m.x - 10, m.y + 10, m.x + 10, m.y - 10);
    if (!reduced)
      g.fillStyle(0xffe0a0, 0.7).fillCircle(
        m.x + 80 * (1 - progress),
        m.y - 200 * (1 - progress),
        5 + progress * 6,
      );
  }
}

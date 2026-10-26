import type Phaser from "phaser";
import { TOWN_POND } from "../../../packages/shared/src/town";

export function pondDuckPose(
  duck: { a: number; speed: number; r: number },
  time: number,
  reduced = false,
) {
  const t = reduced ? 0 : time,
    a = duck.a + t * duck.speed;
  return {
    x: TOWN_POND.x + Math.cos(a) * TOWN_POND.rx * duck.r,
    y: TOWN_POND.y + Math.sin(a) * TOWN_POND.ry * duck.r,
    dir: -Math.sin(a) > 0 ? 1 : -1,
    bob: reduced ? 0 : Math.sin(t * 4 + duck.a),
    dabble: !reduced && Math.sin(t * 0.35 + duck.a * 1.7) > 0.93,
    frame: reduced ? 0 : Math.floor(t * 0.8 + duck.a * 0.7) % 2,
  };
}

export function pondFishPose(time: number, index: number, reduced = false) {
  const t = reduced ? 0 : time,
    a = t * (0.12 + index * 0.025) + index * 2.2;
  const r = 0.32 + index * 0.09;
  return {
    x: TOWN_POND.x + Math.cos(a) * TOWN_POND.rx * r,
    y: TOWN_POND.y + Math.sin(a) * TOWN_POND.ry * r,
    angle: Math.atan2(Math.cos(a) * TOWN_POND.ry, -Math.sin(a) * TOWN_POND.rx),
  };
}
/** Small continuous caustics, soft reflections, fish and spreading wavelets. */
export function drawPondWater(
  g: Phaser.GameObjects.Graphics,
  time: number,
  reduced: boolean,
) {
  const t = reduced ? 0 : time,
    p = TOWN_POND;
  g.clear();
  for (let i = 0; i < 42; i++) {
    const a = i * 2.39996,
      r = Math.sqrt((i + 0.5) / 42) * 0.88;
    const x = p.x + Math.cos(a) * p.rx * r,
      y = p.y + Math.sin(a) * p.ry * r;
    const sway = Math.sin(t * 0.85 + i) * 2;
    const points = Array.from({ length: 6 }, (_, j) => ({
      x: x + (j - 2.5) * 3.5,
      y: y + Math.sin(j * 0.8 + t * 0.7 + i) * 1.5 + sway,
    }));
    g.lineStyle(
      0.65,
      0xb8f8f4,
      0.07 + (Math.sin(t * 0.9 + i) + 1) * 0.045,
    ).strokePoints(points);
  }
  for (let i = 0; i < 3; i++) {
    const f = pondFishPose(t, i, reduced),
      c = Math.cos(f.angle),
      s = Math.sin(f.angle);
    const point = (x: number, y: number) => ({
      x: f.x + x * c - y * s,
      y: f.y + x * s + y * c,
    });
    const body = [point(-6, 0), point(-1, -2.5), point(7, 0), point(-1, 2.5)];
    g.fillStyle(i === 1 ? 0xf4bc70 : 0x87c7bc, 0.35).fillPoints(body, true);
    g.fillStyle(0x75a9a0, 0.25).fillPoints(
      [point(-5, 0), point(-10, -3), point(-10, 3)],
      true,
    );
  }
  for (let i = 0; i < 7; i++) {
    const a = i * 2.17,
      u = (t * 0.18 + i / 7) % 1,
      r = 0.3 + i * 0.065;
    const x = p.x + Math.cos(a) * p.rx * r,
      y = p.y + Math.sin(a) * p.ry * r;
    g.lineStyle(0.6, 0xd6fcf7, (1 - u) * 0.13).strokeEllipse(
      x,
      y,
      10 + u * 22,
      4 + u * 9,
    );
  }
}

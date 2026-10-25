import type Phaser from "phaser";
import { FOUNTAIN, rnd } from "./town-art";

interface Point {
  x: number;
  y: number;
}
export interface FountainStream {
  start: Point;
  control: Point;
  end: Point;
  front: boolean;
  period: number;
  phase: number;
  width: number;
  points: Point[];
}

/** Positions are local to the basin, matching the painted bowl rims. */
export function streamPoint(
  stream: Pick<FountainStream, "start" | "control" | "end">,
  u: number,
): Point {
  const v = 1 - u;
  return {
    x:
      v * v * stream.start.x +
      2 * v * u * stream.control.x +
      u * u * stream.end.x,
    y:
      v * v * stream.start.y +
      2 * v * u * stream.control.y +
      u * u * stream.end.y,
  };
}

const { pool, mid, top } = FOUNTAIN;
function cascade(
  from: typeof mid | typeof top,
  targetY: number,
  landRx: number,
  landRy: number,
  count: number,
  seed: number,
) {
  return Array.from({ length: count }, (_, i): FountainStream => {
    const a =
      (i / count) * Math.PI * 2 + 0.04 + (rnd(seed + i * 11) - 0.5) * 0.065;
    const start = {
      x: Math.cos(a) * (from.rx - 0.5),
      y: from.dy + Math.sin(a) * from.ry + 1,
    };
    const end = { x: Math.cos(a) * landRx, y: targetY + Math.sin(a) * landRy };
    const stream: FountainStream = {
      start,
      control: { x: start.x + (end.x - start.x) * 0.65, y: start.y + 1 },
      end,
      front: Math.sin(a) >= 0,
      // Travel time follows the drop height; motion along the quadratic
      // accelerates once, rather than applying two easing curves to the fall.
      period: Math.sqrt((2 * (end.y - start.y)) / 360),
      phase: rnd(seed + i * 5.7),
      width: 0.65 + rnd(seed + i * 9.1) * 0.75,
      points: [],
    };
    stream.points = Array.from({ length: 17 }, (_, k) =>
      streamPoint(stream, k / 16),
    );
    return stream;
  });
}

export const FOUNTAIN_STREAMS = [
  ...cascade(
    top,
    mid.dy + 1,
    top.rx + 7,
    ((top.rx + 7) * mid.ry) / mid.rx,
    12,
    31,
  ),
  ...cascade(
    mid,
    pool.dy,
    mid.rx + 17,
    ((mid.rx + 17) * pool.ry) / pool.rx,
    24,
    79,
  ),
];

/** The caller supplies separate layers behind and in front of the stone. */
export function drawFountainWater(
  back: Phaser.GameObjects.Graphics,
  front: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  time: number,
  reduced: boolean,
) {
  back.clear().setPosition(x, y);
  front.clear().setPosition(x, y);
  const t = reduced ? 0 : time;
  for (const [i, stream] of FOUNTAIN_STREAMS.entries()) {
    const g = stream.front ? front : back;
    const light = stream.front ? 1 : 0.65;
    const flow = reduced
      ? 1
      : 0.88 + Math.sin(t * 3.5 + stream.phase * 9) * 0.12;
    g.lineStyle(stream.width * 3.2, 0x74cddd, 0.07 * light * flow).strokePoints(
      stream.points,
    );
    g.lineStyle(stream.width, 0xd0f3f8, 0.32 * light * flow).strokePoints(
      stream.points,
    );

    if (!reduced)
      for (let drop = 0; drop < 2; drop++) {
        const u = (t / stream.period + stream.phase + drop * 0.5) % 1;
        // Short travelling highlights stretch as the water gains speed.
        const trail = Array.from({ length: 4 }, (_, k) =>
          streamPoint(stream, Math.max(0, u - 0.055 + (k * 0.055) / 3)),
        );
        g.lineStyle(stream.width * 0.55, 0xf1fdff, 0.62 * light).strokePoints(
          trail,
        );
        if (u > 0.55) {
          const p = streamPoint(stream, u);
          g.fillStyle(0xe8fbff, 0.66 * light).fillEllipse(
            p.x,
            p.y,
            stream.width * 0.85,
            1.3 + u,
          );
        }
      }

    // Each stream has its own impact clock. Both bowls receive foam and
    // spreading rings; splashes begin when a falling highlight reaches them.
    const sinceImpact =
      ((t / stream.period + stream.phase) % 0.5) * stream.period;
    const age = reduced ? 0.45 : Math.min(1, sinceImpact / 0.32);
    const { x: ex, y: ey } = stream.end;
    g.fillStyle(
      0xe4fbff,
      (reduced ? 0.2 : 0.16 + (1 - age) * 0.16) * light,
    ).fillEllipse(ex, ey, 3.5 + stream.width, 1.6);
    g.lineStyle(0.65, 0xc6edf3, (1 - age) * 0.3 * light).strokeEllipse(
      ex,
      ey,
      2 + age * 9,
      0.8 + age * 3.2,
    );
    if (!reduced && sinceImpact < 0.2) {
      const s = sinceImpact;
      for (const direction of [-1, 1]) {
        g.fillStyle(0xe8fbff, (1 - s / 0.2) * 0.55 * light).fillCircle(
          ex + direction * s * (8 + stream.width * 3),
          ey - 16 * s + 60 * s * s,
          0.65,
        );
      }
    }
    // Break the regular sheen with a few moving reflections in the pool.
    if (i % 4 === 0) {
      const twinkle = reduced ? 0.2 : Math.max(0, Math.sin(t * 1.7 + i)) * 0.35;
      back
        .lineStyle(0.6, 0xd5f5f7, twinkle)
        .strokeEllipse(
          ex * 0.75,
          pool.dy + Math.sin(i * 2.7) * pool.ry * 0.65,
          7,
          1.6,
        );
    }
  }
}

import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import { predictFighter } from "../../apps/client/src/predict-fighter";
import {
  RULES,
  ULT_SLOT,
  blankInput,
  type CharacterId,
  type Fighter,
  type Input,
} from "@arena/shared";

/**
 * Movement skills are predicted on the client: the predicted fighter must
 * land where the server puts it, tick for tick, or it would snap back.
 */
function compare(
  character: CharacterId,
  slot: number,
  from: { x: number; y: number },
  aim: { x: number; y: number },
  ticks = 30,
) {
  const a = new Arena("PREDICT");
  const p = a.add("me", "Me", character);
  const q = a.add("you", "You", "terradon");
  a.start();
  a.phase = "playing";
  a.deadline = 999;
  Object.assign(p, from);
  Object.assign(q, { x: 1500, y: 800 });
  if (slot === ULT_SLOT) p.ult = RULES.ultMax;
  let local: Fighter = structuredClone(p);
  const path: [number, number, number, number][] = [];
  for (let i = 0; i < ticks; i++) {
    const input: Input = {
      ...blankInput(),
      seq: i + 1,
      aimX: aim.x,
      aimY: aim.y,
      skill: i === 0 ? slot : -1,
    };
    a.submit(p, input);
    a.tick();
    predictFighter(local, input, a.time, false);
    path.push([p.x, p.y, local.x, local.y]);
    // The client starts again from each snapshot, as the real one does.
    if (i % 5 === 4) local = structuredClone(p);
  }
  return path;
}
describe("predicted movement skills", () => {
  it("a blink lands where the server lands it, walls included", () => {
    for (const path of [
      compare("astrabun", 0, { x: 200, y: 150 }, { x: 420, y: 150 }),
      // Toward the centre block: stopped short of it.
      compare("astrabun", 0, { x: 560, y: 450 }, { x: 1000, y: 450 }),
    ]) {
      for (const [sx, sy, px, py] of path) {
        expect(px).toBeCloseTo(sx, 6);
        expect(py).toBeCloseTo(sy, 6);
      }
      // It did hop (well past where walking alone would take it).
      expect(path[0][0] - 200).toBeGreaterThan(150);
    }
  });
  it("a blink with a wind-up (Full Moon) lands on the same tick", () => {
    const path = compare(
      "astrabun",
      ULT_SLOT,
      { x: 200, y: 150 },
      { x: 600, y: 150 },
    );
    for (const [sx, sy, px, py] of path) {
      expect(px).toBeCloseTo(sx, 6);
      expect(py).toBeCloseTo(sy, 6);
    }
    expect(path.at(-1)![0]).toBeGreaterThan(500);
  });
  it("a rush charges along the same path", () => {
    const path = compare(
      "wombolder",
      0,
      { x: 200, y: 150 },
      { x: 900, y: 150 },
    );
    for (const [sx, sy, px, py] of path) {
      expect(px).toBeCloseTo(sx, 6);
      expect(py).toBeCloseTo(sy, 6);
    }
    expect(path.at(-1)![0]).toBeGreaterThan(560);
  });
});

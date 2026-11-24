import { describe, expect, it } from "vitest";
import {
  PLAZA_PLACES,
  PLAZA_QUESTS,
  PLAZA_SPAWN,
  PLAZA_SPOTS,
  plazaBody,
  plazaPlaceOf,
  plazaStep,
} from "../../packages/shared/src/plaza";
import { plazaPath, standable } from "../../apps/client/src/plaza/plaza-path";
import { ICON_SRC } from "../../apps/client/src/hub-art/icons";

/** Walk a found way with the shared step, as the Plaza's Go does. */
function walk(to: { x: number; y: number }, seconds = 40) {
  const b = plazaBody(PLAZA_SPAWN.x, PLAZA_SPAWN.y);
  const way = plazaPath(b, to);
  for (let t = 0; t < seconds && way.length; t += 1 / 30) {
    const at = way[0],
      dx = at.x - b.x,
      dy = at.y - b.y,
      d = Math.hypot(dx, dy);
    if (d < (way.length > 1 ? 18 : 10)) {
      way.shift();
      continue;
    }
    plazaStep(b, { x: dx / d, y: dy / d }, 1 / 30);
  }
  return Math.hypot(b.x - to.x, b.y - to.y);
}

describe("the Plaza map's places", () => {
  it("each stand on open ground, have a known icon and are a walk from spawn", () => {
    const ids = new Set<string>();
    for (const p of PLAZA_PLACES) {
      expect(ids.has(p.id), p.id).toBe(false);
      ids.add(p.id);
      expect(ICON_SRC[p.icon as keyof typeof ICON_SRC], p.icon).toBeTruthy();
      expect(standable(p.x, p.y), p.id).toBe(true);
      expect(walk(p), p.id).toBeLessThan(24);
    }
  });

  it("send every daily quest somewhere (the quest list's Go)", () => {
    for (const q of PLAZA_QUESTS)
      expect(plazaPlaceOf(q.id)?.quests, q.id).toContain(q.id);
  });

  it("bring you within reach of the spot you came for", () => {
    for (const [place, spot] of [
      ["photo", "photo"],
      ["cafe", "cafe"],
      ["leader", "leader"],
      ["pond", "fish"],
    ]) {
      const p = PLAZA_PLACES.find((x) => x.id === place)!,
        s = PLAZA_SPOTS.find((x) => x.id === spot)!;
      expect(Math.hypot(p.x - s.x, p.y - s.y), place).toBeLessThan(s.r);
    }
  });
});

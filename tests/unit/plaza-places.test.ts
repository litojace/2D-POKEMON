import { describe, expect, it } from "vitest";
import {
  PLAZA,
  PLAZA_PATHS,
  PLAZA_PLACES,
  PLAZA_QUESTS,
  PLAZA_SIGNPOSTS,
  PLAZA_SPAWN,
  PLAZA_SPOTS,
  plazaBody,
  plazaCollide,
  plazaPlaceOf,
  plazaStep,
  segmentDistance,
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

describe("the fingerposts", () => {
  it("stand just off a path, with icons we draw, and nobody walks through them", () => {
    for (const s of PLAZA_SIGNPOSTS) {
      expect(s.arms.length).toBeGreaterThan(0);
      for (const a of s.arms)
        expect(ICON_SRC[a.icon as keyof typeof ICON_SRC], a.icon).toBeTruthy();
      const gap = Math.min(
        ...PLAZA_PATHS.flatMap((p) =>
          p.pts
            .slice(1)
            .map(
              ([x, y], i) =>
                segmentDistance(
                  s.x,
                  s.y,
                  { x: p.pts[i][0], y: p.pts[i][1] },
                  { x, y },
                ) -
                p.w / 2,
            ),
        ),
      );
      expect(gap).toBeGreaterThan(4);
      expect(gap).toBeLessThan(60);
      const walker = { x: s.x, y: s.y + 2 };
      plazaCollide(walker);
      expect(walker.y - s.y).toBeGreaterThan(PLAZA.radius);
    }
  });
  it("point each arm toward the place it names", () => {
    const of: Record<string, string> = {
      "ORB BALL": "pitch",
      "DASH TRACK": "track",
      FISHING: "pond",
    };
    for (const s of PLAZA_SIGNPOSTS)
      for (const a of s.arms) {
        const p = PLAZA_PLACES.find((x) => x.id === of[a.text]);
        if (p) expect(a.dir, a.text).toBe(Math.sign(p.x - s.x));
      }
  });
});

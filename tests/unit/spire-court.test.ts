/**
 * The Spire's court (packages/shared/src/spire-court.ts): its preset cover
 * layouts are fair (inside the court, clear of the raiders' corner, the
 * Echoes' spawn bands and the rune ring, every spot reachable), chosen by
 * floor deterministically, and they are what the server collides with.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  OBSTACLES,
  ORB_SPOTS,
  RULES,
  blocked,
  currentObstacles,
  useObstacles,
  type Rect,
} from "@arena/shared";
import {
  SPIRE_COURT_LAYOUTS,
  SPIRE_RING,
  SPIRE_STAIRS,
  spireCourtLayout,
  spireCourtOrbSpots,
  spireCourtWalls,
  spireEchoSpawnCandidate,
  spireRaiderSpawn,
  type SpireCourtLayoutId,
} from "../../packages/shared/src/spire-court";
import {
  SPIRE_FLOORS,
  SPIRE_SEATS,
  spireUnderControls,
} from "../../packages/shared/src/spire";
import { SpireArena, createSpireArena } from "../../apps/server/src/spire";
import { cornersNow } from "../../apps/server/src/bot";

afterEach(() => useObstacles(OBSTACLES));

const R = RULES.radius;
const LAYOUTS = Object.keys(SPIRE_COURT_LAYOUTS) as SpireCourtLayoutId[];
const wallsOf = (id: SpireCourtLayoutId) => [
  ...SPIRE_COURT_LAYOUTS[id].blocks,
  SPIRE_STAIRS,
];
/** How far a point is from a rect (0 inside). */
const gap = (o: Rect, x: number, y: number) =>
  Math.hypot(
    x - Math.max(o.x, Math.min(x, o.x + o.w)),
    y - Math.max(o.y, Math.min(y, o.y + o.h)),
  );
/** Points of a spawn band, sampled on a grid of seeds. */
function band(role: "front" | "caster" | "skirmisher", elite = false) {
  const out: { x: number; y: number }[] = [];
  for (let a = 0; a < 1; a += 0.1)
    for (let b = 0; b < 1; b += 0.1)
      for (const c of [0.05, 0.5, 0.95]) {
        const v = [0, a, b, c];
        out.push(spireEchoSpawnCandidate(role, elite, (k) => v[k]));
      }
  return out;
}
/** Grid cells (by 20 px) a fighter can stand on, flood-filled from `from`. */
function reachable(from: { x: number; y: number }) {
  const S = 20,
    cols = Math.floor(RULES.width / S),
    rows = Math.floor(RULES.height / S);
  const seen = new Set<number>();
  const start = Math.round(from.y / S) * cols + Math.round(from.x / S);
  const queue = [start];
  seen.add(start);
  while (queue.length) {
    const i = queue.pop()!;
    const cx = i % cols,
      cy = Math.floor(i / cols);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = cx + dx,
        ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const n = ny * cols + nx;
      if (seen.has(n) || blocked(nx * S, ny * S, R)) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  return {
    has: (p: { x: number; y: number }) => {
      // The nearest free cell to the point.
      let best = Infinity,
        hit = false;
      for (const dx of [-1, 0, 1])
        for (const dy of [-1, 0, 1]) {
          const x = Math.round(p.x / S) + dx,
            y = Math.round(p.y / S) + dy;
          const d = Math.hypot(x * S - p.x, y * S - p.y);
          if (seen.has(y * cols + x) && d < best) {
            best = d;
            hit = true;
          }
        }
      return hit;
    },
    size: seen.size,
  };
}

describe("Spire court layouts", () => {
  it.each(LAYOUTS)("%s keeps every block inside the court, apart", (id) => {
    const walls = wallsOf(id);
    for (const o of walls) {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.x + o.w).toBeLessThanOrEqual(RULES.width);
      expect(o.y + o.h).toBeLessThanOrEqual(RULES.height);
      // Deep enough to show a raised stone (the painted block is footprint-exact).
      expect(o.h).toBeGreaterThanOrEqual(96);
    }
    // Room for a fighter between any two blocks (no near-sealed slots).
    for (const a of walls)
      for (const b of walls) {
        if (a === b) continue;
        const dx = Math.max(0, b.x - (a.x + a.w), a.x - (b.x + b.w)),
          dy = Math.max(0, b.y - (a.y + a.h), a.y - (b.y + b.h));
        expect(Math.hypot(dx, dy)).toBeGreaterThan(R * 2 + 30);
      }
  });

  it.each(LAYOUTS)(
    "%s leaves the raiders' corner and the Echo bands clear",
    (id) => {
      useObstacles(wallsOf(id));
      for (let seat = 0; seat < SPIRE_SEATS; seat++) {
        const p = spireRaiderSpawn(seat);
        expect(blocked(p.x, p.y, R + 40), `seat ${seat}`).toBe(false);
      }
      // Casters, skirmishers and (on its floor) the elite appear where no
      // cover stands; the front-liners' wide band keeps most of its room.
      const clear = [...band("caster"), ...band("skirmisher")];
      if (id === "captain") clear.push(...band("front", true));
      for (const p of clear)
        expect(blocked(p.x, p.y, R + 6), `${p.x},${p.y}`).toBe(false);
      const front = band("front");
      const free = front.filter((p) => !blocked(p.x, p.y, R + 6)).length;
      expect(free / front.length).toBeGreaterThan(0.7);
    },
  );

  it.each(LAYOUTS)("%s keeps the rune ring clear", (id) => {
    for (const o of SPIRE_COURT_LAYOUTS[id].blocks)
      for (let k = 0; k < 64; k++) {
        const t = (k / 64) * Math.PI * 2;
        const x = SPIRE_RING.x + Math.cos(t) * SPIRE_RING.r,
          y = SPIRE_RING.y + Math.sin(t) * SPIRE_RING.r * 0.65;
        expect(gap(o, x, y)).toBeGreaterThan(0);
      }
  });

  it.each(LAYOUTS)(
    "%s lets a fighter walk from the stairs to every spawn",
    (id) => {
      useObstacles(wallsOf(id));
      const flood = reachable(spireRaiderSpawn(0));
      for (let seat = 1; seat < SPIRE_SEATS; seat++)
        expect(flood.has(spireRaiderSpawn(seat))).toBe(true);
      for (const p of [
        ...band("caster"),
        ...band("skirmisher"),
        ...band("front"),
      ])
        if (!blocked(p.x, p.y, R))
          expect(flood.has(p), `${p.x},${p.y}`).toBe(true);
      // No pocket of the court is sealed off: every free cell is reachable.
      const all = reachable({ x: 1500, y: 450 });
      expect(flood.size).toBe(all.size);
    },
  );

  it.each(LAYOUTS)(
    "%s lays its healing orbs on open ground a raider can reach",
    (id) => {
      const spots = SPIRE_COURT_LAYOUTS[id].orbs ?? ORB_SPOTS;
      expect(spots.length).toBeGreaterThanOrEqual(2);
      useObstacles(wallsOf(id));
      const flood = reachable(spireRaiderSpawn(0));
      for (const s of spots) {
        // No stone over any of the orb's glow, and room to stand on it.
        for (const o of wallsOf(id))
          expect(gap(o, s.x, s.y), `${s.x},${s.y}`).toBeGreaterThan(
            R + RULES.orbRadius,
          );
        expect(flood.has(s), `${s.x},${s.y}`).toBe(true);
        // Not on the rune ring, nor under a phone's touch controls.
        const dx = (s.x - SPIRE_RING.x) / SPIRE_RING.r,
          dy = (s.y - SPIRE_RING.y) / (SPIRE_RING.r * 0.65);
        expect(Math.hypot(dx, dy)).toBeGreaterThan(1.15);
        expect(spireUnderControls(s.x, s.y, RULES.orbRadius)).toBe(false);
      }
    },
  );

  it("a stone on the arena's usual orb spots would fail the orb test", () => {
    // The Four Gates' top and bottom gates stand on them.
    const covered = ORB_SPOTS.filter((s) =>
      SPIRE_COURT_LAYOUTS.gates.blocks.some((o) => gap(o, s.x, s.y) === 0),
    );
    expect(covered).toHaveLength(ORB_SPOTS.length);
  });

  it("a sealed layout would fail the walk test", () => {
    // A wall right across the court: the far side is cut off.
    useObstacles([{ x: 700, y: 0, w: 60, h: RULES.height }]);
    const flood = reachable(spireRaiderSpawn(0));
    expect(flood.has({ x: 1400, y: 450 })).toBe(false);
  });

  it("picks the layout by floor, the same every time", () => {
    const picked = Object.values(SPIRE_FLOORS).map(
      (f) => spireCourtLayout(f.floor, f.kind)?.id,
    );
    expect(picked).toEqual([
      "gates",
      "walls",
      "crystals",
      "pylons",
      "captain",
      "gates",
      "walls",
      "crystals",
      "pylons",
      undefined,
      // Zone 2: the same order.
      "gates",
      "walls",
      "crystals",
      "pylons",
      "captain",
      "gates",
      "walls",
      "crystals",
      "pylons",
      undefined,
      // Zone 3: the same order.
      "gates",
      "walls",
      "crystals",
      "pylons",
      "captain",
      "gates",
      "walls",
      "crystals",
      "pylons",
      undefined,
      // Zone 4: the same order.
      "gates",
      "walls",
      "crystals",
      "pylons",
      "captain",
      "gates",
      "walls",
      "crystals",
      "pylons",
      undefined,
      // Zone 5: the same order.
      "gates",
      "walls",
      "crystals",
      "pylons",
      "captain",
      "gates",
      "walls",
      "crystals",
      "pylons",
      undefined,
      // Zone 6: the same order.
      "gates",
      "walls",
      "crystals",
      "pylons",
      "captain",
      "gates",
      "walls",
      "crystals",
      "pylons",
      undefined,
      // Zone 7: the same order.
      "gates",
      "walls",
      "crystals",
      "pylons",
      "captain",
      "gates",
      "walls",
      "crystals",
      "pylons",
      undefined,
    ]);
    // Later zones reuse the same order (floor 13 like floor 3).
    expect(spireCourtLayout(13, "wave")?.id).toBe("crystals");
    expect(spireCourtLayout(15, "elite")?.id).toBe("captain");
    // One array per layout, so bots can cache their corners by it.
    expect(spireCourtWalls({ floor: 1, kind: "wave" })).toBe(
      spireCourtWalls({ floor: 6, kind: "wave" }),
    );
    expect(spireCourtWalls({ floor: 10, kind: "boss" })).toBeUndefined();
  });
});

describe("the server's Spire court", () => {
  function climbAt(floor: number) {
    const a = new SpireArena("COURT1") as any;
    a.add("me", "tester", "voltkit");
    a.add("p2", "Kai", "cindrake");
    a.configureSpire({ startFloor: floor, ceiling: 10 });
    a.start();
    return a as SpireArena & Record<string, any>;
  }
  it("collides with the floor's shared layout, and the raid's walls on floor 10", () => {
    for (const floor of [1, 2, 3, 4, 5, 9]) {
      const a = climbAt(floor);
      const list = a.walls();
      const def = SPIRE_FLOORS[floor];
      expect(list).toBe(spireCourtWalls({ floor, kind: def.kind }));
      expect(currentObstacles()).toBe(list);
      // No Cragmuff pillars on the Spire court.
      expect(a.raid.pillars).toEqual([]);
      // The raiders stand at the shared spawn points.
      a.heroes().forEach((p: any, i: number) =>
        expect({ x: p.x, y: p.y }).toEqual(spireRaiderSpawn(i)),
      );
    }
    const boss = climbAt(10);
    expect(boss.raid.spire!.kind).toBe("boss");
    expect(boss.walls()).toEqual(OBSTACLES);
    expect(boss.raid.pillars).toHaveLength(OBSTACLES.length);
  });

  it("spawns the orbs where the floor's layout puts them, and a raider picks one up", () => {
    for (const floor of [1, 2, 3, 4, 5, 6, 8, 13, 26, 38, 41, 53, 61]) {
      const def = SPIRE_FLOORS[floor];
      const a = createSpireArena(`ORB${floor}`, def.zone) as any;
      a.add("me", "tester", "voltkit");
      a.add("p2", "Kai", "cindrake");
      a.configureSpire({ startFloor: floor, ceiling: def.zone * 10 });
      a.start();
      expect(a.raid.spire.floor).toBe(floor);
      const spots = spireCourtOrbSpots({ floor, kind: def.kind })!;
      a.nextOrb = 0;
      a.stepOrbs();
      expect(
        a.orbs.map((o: any) => ({ x: o.x, y: o.y })),
        `floor ${floor}`,
      ).toEqual(spots.map((s) => ({ x: s.x, y: s.y })));
      const walls = a.walls();
      for (const orb of a.orbs)
        for (const o of walls)
          expect(gap(o, orb.x, orb.y), `floor ${floor}`).toBeGreaterThan(
            R + RULES.orbRadius,
          );
      // A hurt raider walking onto the first orb heals.
      const [me] = a.heroes();
      const orb = a.orbs[0];
      Object.assign(me, { x: orb.x, y: orb.y, hp: 10 });
      a.stepOrbs();
      expect(me.hp, `floor ${floor}`).toBeGreaterThan(10);
    }
    // An orb left on floor 2 (the usual spots) is gone on floor 3, whose
    // outcrops stand there; one on floor 3's own spots stays.
    const a = climbAt(2);
    a.nextOrb = 0;
    a.stepOrbs();
    expect(a.orbs).toHaveLength(2);
    a.orbs.push({ id: 999, x: 650, y: 190, kind: "heal" });
    a.setupFloor(3);
    expect(a.orbs.map((o: any) => [o.x, o.y])).toEqual([[650, 190]]);
    // The boss floor keeps its raid's own spots.
    expect(climbAt(10).orbSpots()).toBe(ORB_SPOTS);
  });

  it("Echo bots path round the court's blocks (their corners are waypoints)", () => {
    for (const id of LAYOUTS) {
      useObstacles(wallsOf(id));
      const corners = cornersNow();
      for (const o of [...SPIRE_COURT_LAYOUTS[id].blocks, SPIRE_STAIRS])
        for (const [x, y] of [
          [o.x, o.y],
          [o.x + o.w, o.y],
          [o.x, o.y + o.h],
          [o.x + o.w, o.y + o.h],
        ])
          expect(
            corners.some((c) => Math.hypot(c.x - x, c.y - y) < 60),
            `${id} ${x},${y}`,
          ).toBe(true);
      // Same walls, same list (cached by the shared array).
      expect(cornersNow()).toBe(corners);
    }
    // PvP keeps its own corners exactly.
    useObstacles(OBSTACLES);
    expect(cornersNow()).toHaveLength(OBSTACLES.length * 4);
  });
});

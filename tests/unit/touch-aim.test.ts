import { describe, expect, it } from "vitest";
import { CHARACTERS } from "../../packages/shared/src/index";
import {
  ANYWHERE,
  SKILL_INPUT_BUFFER,
  aimPoint,
  aimSpec,
  courtDirection,
  pickNear,
  type AimKind,
} from "../../apps/client/src/touch-aim";

/**
 * How a drag aims each kind the champions use, from how the server reads
 * the aim for it (apps/server/src/simulation.ts cast). A kind missing here
 * fails the first test: say how it aims before shipping it.
 */
const EXPECTED: Record<string, AimKind> = {
  projectile: "line",
  barrage: "line",
  shrapnel: "line",
  beam: "line",
  rush: "line",
  surf: "line",
  grapple: "line",
  creep: "line",
  wave: "line",
  screen: "line",
  melee: "line",
  cone: "line",
  clamp: "line",
  throw: "line",
  pound: "line",
  zone: "point",
  seedling: "point",
  timewarp: "point",
  lure: "point",
  garden: "point",
  steer: "point",
  blink: "point",
  leap: "point",
  storm: "target",
  hunt: "target",
  tether: "target",
  swap: "target",
  nova: "self",
  clone: "self",
  barrier: "self",
  buff: "self",
  rest: "self",
  veil: "self",
  tunnel: "self",
  cyclone: "self",
  taunt: "self",
  rewind: "self",
  gaze: "self",
  cage: "self",
};
const skills = Object.values(CHARACTERS).flatMap((c) => c.skills);
const byName = (name: string) => skills.find((a) => a.name === name)!;

describe("drag-to-aim specs", () => {
  it("knows how every skill kind in the roster reads the aim", () => {
    for (const a of skills) {
      const want =
        a.kind === "counter"
          ? a.lunge
            ? "point"
            : "self"
          : a.kind === "zone" && a.follow
            ? "self"
            : EXPECTED[a.kind];
      expect(want, `${a.name} (${a.kind}) has no aim kind`).toBeDefined();
      expect(aimSpec(a).kind, `${a.name} (${a.kind})`).toBe(want);
    }
  });
  it("draws a projectile's arrow its full range and fires the rest on the press", () => {
    const lance = aimSpec(byName("Static Lance"));
    expect(lance).toMatchObject({ kind: "line", range: 700, arc: 0 });
    expect(lance.width).toBeGreaterThanOrEqual(18);
    expect(aimSpec(byName("Static Glide")).kind).toBe("self");
    // A zone round the caster (Heat Cracks follows it) never asks where.
    expect(aimSpec(byName("Heat Cracks")).kind).toBe("self");
    expect(aimSpec(undefined).kind).toBe("self");
  });
  it("keeps a dragged aim while the cast still reads it", () => {
    // A storm picks the enemy nearest the aim for each of its waves.
    const storm = byName("Thunderstorm");
    const spec = aimSpec(storm);
    expect(spec).toMatchObject({ kind: "target", range: 0 });
    expect(spec.hold).toBeGreaterThanOrEqual(
      SKILL_INPUT_BUFFER +
        storm.cast +
        ((storm.count ?? 3) - 1) * (storm.tickInterval ?? 0.8),
    );
    // A wind-up reads the aim when it ends.
    for (const a of skills.filter(
      (s) => s.cast > 0 && aimSpec(s).kind !== "self",
    ))
      expect(aimSpec(a).hold, a.name).toBeGreaterThan(
        SKILL_INPUT_BUFFER + a.cast,
      );
  });
  it("shows a strike in front as a wedge and a fan of shots as one", () => {
    const paw = aimSpec(byName("Shatter Paw"));
    expect(paw.kind).toBe("line");
    expect(paw.arc).toBeGreaterThan(0.5);
    expect(aimSpec(byName("Scale Shrapnel")).arc).toBeGreaterThan(0.3);
    // Facet Guard vaults up to its lunge toward the aim.
    const guard = byName("Facet Guard");
    expect(aimSpec(guard)).toMatchObject({ kind: "point", range: guard.lunge });
  });
});

describe("drag-to-aim points", () => {
  const from = { x: 400, y: 300 };
  const right = { x: 1, y: 0 };
  it("aims a line along the drag however short it is", () => {
    const spec = aimSpec(byName("Static Lance"));
    expect(aimPoint(spec, from, right, 0.1)).toEqual({ x: 1100, y: 300 });
  });
  it("places a spot as far as the finger went, up to the range", () => {
    const spec = aimSpec(byName("Mind Maze"));
    const half = aimPoint(spec, from, right, 0.5);
    expect(half.x - from.x).toBeCloseTo(spec.range / 2);
    expect(aimPoint(spec, from, right, 3).x - from.x).toBeCloseTo(spec.range);
    expect(aimPoint(spec, from, right, -1)).toEqual(from);
  });
  it("lets a storm's drag reach across the court", () => {
    const spec = aimSpec(byName("Thunderstorm"));
    expect(aimPoint(spec, from, right, 1).x - from.x).toBe(ANYWHERE);
  });
  it("turns a screen drag into a court direction", () => {
    const d = courtDirection(3, 4);
    expect(d.x).toBeCloseTo(0.6);
    expect(d.y).toBeCloseTo(0.8);
    // A camera that squeezes the court's height: the same drag points lower.
    expect(courtDirection(1, 1, 1, 0.5).y).toBeGreaterThan(0.85);
    expect(courtDirection(0, 0)).toEqual({ x: 1, y: 0 });
  });
  it("picks the enemy nearest the aim, within reach", () => {
    const a = { id: "a", x: 500, y: 300 },
      b = { id: "b", x: 900, y: 300 };
    expect(pickNear([a, b], { x: 880, y: 300 }, from, 0)?.id).toBe("b");
    // Out of reach: the wire takes the one in reach.
    expect(pickNear([a, b], { x: 880, y: 300 }, from, 380)?.id).toBe("a");
    expect(pickNear([], { x: 0, y: 0 }, from, 0)).toBeUndefined();
  });
});

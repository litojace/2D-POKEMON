/**
 * Telegraph fairness for the ★★★ bosses' attacks (Prismatail, Emberwing,
 * Storm Twins). Every warning they draw must:
 * - stay on screen at least 0.9 s of server time;
 * - stop moving at least 0.6 s before it lands;
 * - leave every raider a spot they can reach at the slowest champion's
 *   pace (222 px/s) after a 0.45 s reaction.
 * A scripted dodger proves the last one: it waits out the reaction time,
 * picks the nearest spot outside every live warning within reach, moves
 * there, and must take no damage from the boss at all.
 */
import { describe, it, expect } from "vitest";
import { blankInput, type CharacterId, type Fighter } from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import type { RaidArena } from "../../apps/server/src/raid";
import { fanEscape } from "../../apps/server/src/raid-prismatail";
import {
  PRISMATAIL as P,
  STORM_TWINS as S,
  EMBERWING as E,
  angleDifference,
  stormSegmentDistance,
  type RaidAttack,
  type RaidBossId,
  type RaidWarning,
} from "../../packages/shared/src/raid";

const PACE = 222,
  REACTION = 0.45,
  RADIUS = 24,
  /** Extra room the dodger keeps from an edge. */
  SLACK = 6;
type Point = { x: number; y: number };
const segment = (p: Point, w: RaidWarning) =>
  stormSegmentDistance(p, w, { x: w.tx, y: w.ty });

/** Is `p` inside what this warning hits? (Mirrors the server's tests.) */
function inside(w: RaidWarning, p: Point) {
  const dist = Math.hypot(p.x - w.x, p.y - w.y);
  switch (w.kind) {
    case "prism-lance":
    case "refraction":
    case "dive-bomb":
    case "twin-rush":
      return segment(p, w) <= w.radius + RADIUS + SLACK;
    case "fan-display":
      // Checked a little wider than the slice, so the dodger keeps clear.
      return [0, SLACK, -SLACK].some((o) =>
        [0, Math.PI / 2].some(
          (k) =>
            fanEscape(
              {
                x: p.x + Math.cos(k) * o,
                y: p.y + Math.sin(k) * o,
              },
              w,
              w.prismIndex!,
              w.prismCount!,
            ) > 0,
        ),
      );
    case "halo-crush":
      return (
        Math.abs(dist - w.radius) <= P.halo.width + RADIUS + SLACK &&
        angleDifference(Math.atan2(p.y - w.y, p.x - w.x), w.gapAngle ?? 0) >
          P.halo.gap - 0.1
      );
    default:
      return dist <= w.radius + RADIUS + SLACK;
  }
}
/** The nearest spot within `reach` outside every danger, or undefined. */
function safeSpot(from: Point, reach: number, danger: (p: Point) => boolean) {
  if (!danger(from)) return from;
  for (let d = 8; d <= reach; d += 8)
    for (let k = 0; k < 48; k++) {
      const a = (k * Math.PI * 2) / 48,
        p = { x: from.x + Math.cos(a) * d, y: from.y + Math.sin(a) * d };
      if (p.x < 70 || p.x > 1530 || p.y < 70 || p.y > 830) continue;
      if (!danger(p)) return p;
    }
  return undefined;
}
interface Run {
  /** Seconds each warning was on screen, and how long it stood still before landing. */
  shown: { kind: RaidAttack; shown: number; still: number }[];
  hits: string[];
  missing: string[];
}
/**
 * Start an attack, then dodge it as a careful player on the slowest
 * champion would, until everything it set off is over.
 */
function dodge(
  a: RaidArena,
  start: () => void,
  opts: { seconds?: number; hazards?: () => ((p: Point) => boolean)[] } = {},
): Run {
  const bosses = new Set(a.players.filter((p) => p.raidBoss).map((p) => p.id));
  const hits: string[] = [],
    missing: string[] = [];
  const damage = a.damage.bind(a);
  a.damage = (
    target: Fighter,
    amount: number,
    owner: string,
    ability?: any,
  ) => {
    if (!target.raidBoss && bosses.has(owner) && amount > 0 && target.hp > 0)
      hits.push(
        `${target.id} hit by ${(a as any).hitBy ?? "?"} at ${a.time.toFixed(2)}`,
      );
    damage(target, amount, owner, ability);
  };
  const seen = new Map<
    number,
    {
      kind: RaidAttack;
      sig: string;
      changed: number;
      startedAt: number;
      at: number;
    }
  >();
  const decided = new Set<number>();
  const sig = (w: RaidWarning) =>
    JSON.stringify([
      w.x,
      w.y,
      w.tx,
      w.ty,
      w.radius,
      w.gapAngle,
      w.prismIndex,
      w.beamPost,
    ]);
  start();
  for (let t = 0; t < (opts.seconds ?? 4); t += 1 / 30) {
    const r = a.raid;
    for (const w of r.warnings) {
      const s = sig(w),
        known = seen.get(w.id);
      if (!known)
        seen.set(w.id, {
          kind: w.kind,
          sig: s,
          changed: a.time,
          startedAt: w.startedAt!,
          at: w.at,
        });
      else if (known.sig !== s)
        Object.assign(known, { sig: s, changed: a.time });
    }
    const ready = r.warnings.filter(
      (w) =>
        !decided.has(w.id) &&
        a.time >= Math.max(w.startedAt! + REACTION, seen.get(w.id)!.changed),
    );
    if (ready.length) {
      ready.forEach((w) => decided.add(w.id));
      const soonest = Math.min(...r.warnings.map((w) => w.at)),
        reach = PACE * (soonest - a.time),
        extra = opts.hazards?.() ?? [];
      const danger = (p: Point) =>
        r.warnings.some((w) => inside(w, p)) || extra.some((h) => h(p));
      for (const p of a.heroes().filter((p) => p.hp > 0)) {
        const spot = safeSpot(p, reach, danger);
        if (!spot) {
          missing.push(
            `${p.id} at ${Math.round(p.x)},${Math.round(p.y)} vs ${r.warnings.map((w) => w.kind).join("+")}`,
          );
          continue;
        }
        Object.assign(p, { x: spot.x, y: spot.y, vx: 0, vy: 0 });
      }
    }
    a.tick();
  }
  return {
    shown: [...seen.values()].map((w) => ({
      kind: w.kind,
      shown: w.at - w.startedAt,
      still: w.at - w.changed,
    })),
    hits,
    missing,
  };
}
/** A seeded 0–1 random number generator. */
const rng = (seed: number) => () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
function arena(
  boss: RaidBossId,
  size: number,
  phase: number,
  seed: number,
  chars: CharacterId[] = ["terradon"],
) {
  const a = createRaidArena("FAIR", boss);
  for (let i = 0; i < size; i++)
    a.add(`p${i}`, `Raider ${i}`, chars[i % chars.length]);
  a.configure(3, false);
  a.start();
  a.phase = "playing";
  a.raid.phase = phase;
  a.raid.trait = boss === "storm-twins" ? "in-sync" : "ancient";
  a.raid.seed = seed;
  (a as any).started = true;
  (a as any).nextAttack = Infinity;
  const random = rng(seed * 7919 + size);
  a.heroes().forEach((p) => {
    const speed = random() < 0.5 ? 0 : 160 + random() * 80,
      heading = random() * Math.PI * 2;
    Object.assign(p, {
      x: 180 + random() * 1240,
      y: 160 + random() * 580,
      vx: Math.cos(heading) * speed,
      vy: Math.sin(heading) * speed,
      lastInput: blankInput(),
    });
  });
  return a;
}
const check = (run: Run, label: string) => {
  for (const w of run.shown) {
    expect(w.shown, `${label}: ${w.kind} shown`).toBeGreaterThanOrEqual(
      0.9 - 1e-6,
    );
    expect(w.still, `${label}: ${w.kind} still`).toBeGreaterThanOrEqual(
      0.6 - 1e-6,
    );
  }
  expect(run.missing, label).toEqual([]);
  expect(run.hits, label).toEqual([]);
};
const SEEDS = Array.from({ length: 12 }, (_, i) => i + 1);

describe("Prismatail telegraphs are fair", () => {
  for (const kind of [
    "prism-lance",
    "refraction",
    "fan-display",
    "halo-crush",
  ] as const)
    for (const size of [1, 2, 3, 4])
      it(`${kind}, ${size} raider(s)`, () => {
        for (const seed of SEEDS) {
          const a = arena("prismatail", size, 2, seed);
          if (seed % 3 === 0) a.raid.trait = "kaleidoscope";
          (a as any).relayAt = Infinity;
          // Every other seed: raiders deep in fan slices, where leaving
          // sideways or outwards is longest.
          if (seed % 2 === 0) {
            const boss = a.boss()!,
              n = a.raid.trait === "kaleidoscope" ? 8 : 6;
            a.heroes().forEach((p, i) => {
              // Slices 0, 1, 2 and 3 (east to west through the south).
              const angle = (((seed / 2 + i) % 4) * Math.PI * 2) / n,
                d = 425 + (i % 2) * 12;
              Object.assign(p, {
                x: boss.x + Math.cos(angle) * d,
                y: Math.min(830, boss.y + Math.sin(angle) * d),
              });
            });
          }
          const target = a.heroes()[seed % size];
          const run = dodge(a, () => (a as any).startAttack(kind, target));
          expect(run.shown.length).toBeGreaterThan(0);
          check(run, `seed ${seed}`);
        }
      });
});

describe("Emberwing telegraphs are fair", () => {
  for (const phase of [1, 2])
    for (const size of [1, 2, 3, 4])
      it(`dive-bomb${phase > 1 ? " and its return pass" : ""}, ${size} raider(s)`, () => {
        for (const seed of SEEDS) {
          const a = arena("emberwing", size, phase, seed);
          const target = a.heroes()[seed % size];
          const run = dodge(
            a,
            () => (a as any).startAttack("dive-bomb", target),
            {
              seconds: 4.5,
              // Burning trails are no place to stand either.
              hazards: () =>
                (a.raid.emberTrails ?? []).map(
                  (f) => (p: Point) =>
                    stormSegmentDistance(p, f, { x: f.tx, y: f.ty }) <
                    f.width + RADIUS + SLACK,
                ),
            },
          );
          expect(run.shown.filter((w) => w.kind === "dive-bomb")).toHaveLength(
            phase > 1 ? 2 : 1,
          );
          check(run, `seed ${seed}`);
        }
      });
  for (const size of [1, 2, 3, 4])
    it(`embers on the last brazier's lighter, ${size} raider(s)`, () => {
      for (const seed of SEEDS) {
        const a = arena("emberwing", size, 2, seed);
        a.raid.airborne = true;
        a.raid.takeoffAt = a.time;
        const dark = seed % 3;
        a.raid.braziers!.forEach((b, i) => {
          b.litUntil = i === dark ? 0 : a.time + 60;
          b.progress = i === dark ? 0 : 1;
        });
        // Someone is on the dark brazier, lighting it.
        Object.assign(a.heroes()[0], {
          x: E.braziers[dark].x + ((seed % 5) - 2) * 15,
          y: E.braziers[dark].y + ((seed % 7) - 3) * 10,
        });
        const run = dodge(a, () =>
          (a as any).startAttack("wing-gust", a.heroes()[seed % size]),
        );
        // It keeps contesting the brazier while it stays dark.
        expect(run.shown.length).toBeGreaterThanOrEqual(4);
        expect(run.shown.every((w) => w.kind === "ember-rain")).toBe(true);
        check(run, `seed ${seed}`);
      }
    });
});

describe("Storm Twins telegraphs are fair", () => {
  for (const size of [1, 2, 3, 4])
    it(`twin-rush, ${size} raider(s)`, () => {
      for (const seed of SEEDS) {
        const a = arena("storm-twins", size, 2, seed);
        const target = a.heroes()[seed % size];
        const run = dodge(a, () => (a as any).startAttack("twin-rush", target));
        expect(run.shown.filter((w) => w.kind === "twin-rush")).toHaveLength(2);
        check(run, `seed ${seed}`);
      }
    });
  for (const size of [1, 2, 3, 4])
    it(`Link Beam stands still before it lands and then moves no faster than a raider can leave it, ${size} raider(s)`, () => {
      for (const seed of SEEDS) {
        const a = arena("storm-twins", size, 2, seed);
        const twins = a.players.filter((p) => p.raidBoss);
        (a as any).startAttack("link-beam", a.heroes()[0]);
        const w = a.raid.warnings[0];
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(0.9);
        let shape = JSON.stringify([w.x, w.y, w.tx, w.ty]),
          changed = a.time,
          fastest = 0;
        while (a.raid.warnings.length) {
          a.tick();
          const live = a.raid.warnings[0];
          if (live) {
            const s = JSON.stringify([live.x, live.y, live.tx, live.ty]);
            if (s !== shape) [shape, changed] = [s, a.time];
          }
        }
        expect(w.at - changed, `seed ${seed}`).toBeGreaterThanOrEqual(
          0.6 - 1e-6,
        );
        // The beam lands on the line drawn last.
        const [x, y, tx, ty] = JSON.parse(shape);
        expect(a.raid.stormBeam!.points[0]).toEqual({ x, y });
        expect(a.raid.stormBeam!.points.at(-1)).toEqual({ x: tx, y: ty });
        while (a.raid.stormBeam) {
          const before = twins.map((t) => ({ x: t.x, y: t.y }));
          a.tick();
          twins.forEach((t, i) => {
            fastest = Math.max(
              fastest,
              Math.hypot(t.x - before[i].x, t.y - before[i].y) * 30,
            );
          });
        }
        // Slower than the slowest raider walks (and the beam can be jumped).
        expect(fastest).toBeLessThanOrEqual(70 + 1e-6);
        expect(fastest).toBeLessThan(PACE / 3);
        expect(S.link.hold).toBeGreaterThanOrEqual(0.6);
      }
    });
});

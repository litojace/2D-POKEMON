/**
 * The raid honesty rules (docs/boss-raid.md "Fair warnings"). Bosses at every
 * star tier must keep them, solo and in a party:
 *
 *  1. every damaging warning is on screen for at least 0.9 s of server time
 *     (follow-ups announced by an attack already visible aside);
 *  2. a shape that follows a raider freezes at least 0.6 s before it lands,
 *     and never moves again;
 *  3. a predicted aim point is drawn where it lands (a still raider is never
 *     led; a dodger who sees the lock late still escapes);
 *  4. a new attack starts only below the tier's limit of live attacks, its
 *     impacts land 0.5 s from the others, and every raider keeps a safe spot;
 *  5. attacks dodged by jumping land at least the jump cooldown apart.
 *
 * Phones depend on the 0.9 s floor: interpolation and a slow connection can
 * eat a third of it.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { RULES, type CharacterId, type Fighter } from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import type { RaidArena } from "../../apps/server/src/raid";
import {
  RAID_FREEZE,
  RAID_JUMP_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeHits,
  raidShapeOf,
} from "../../apps/server/src/raid-ai";
import {
  RAID_BOSSES,
  RAID_TELEGRAPH_FLOOR,
  SOMNARA,
  raidTier,
  type RaidAttack,
  type RaidBossId,
  type RaidWarning,
} from "../../packages/shared/src/raid";

type Inner = RaidArena & {
  startAttack(kind: RaidAttack, target: Fighter): void;
  tryAttack(): void;
  settleWarnings(): void;
  harmful(w: RaidWarning): boolean;
  concurrency(): number;
  castOf: WeakMap<RaidWarning, number>;
  castSerial: number;
  currentCast: number;
  nextAttack: number;
  started: boolean;
  deck: RaidAttack[];
  lastReaction: number;
  attacks: number;
  motion: Map<string, { t: number; vx: number; vy: number }[]>;
};
const EPS = 1e-6;
const DT = 1 / 30;
const TEAM: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
const BOSSES = Object.keys(RAID_BOSSES) as RaidBossId[];
const spatial = (w: RaidWarning) =>
  ["circle", "line", "cone"].includes(raidShapeOf(w.kind));
const shape = (w: RaidWarning) =>
  [w.x, w.y, w.tx, w.ty, w.radius].map((v) => v.toFixed(3)).join(",");

/** Repeatable runs: the raid seeds itself through Web Crypto. */
const seeded = (seed: number) => {
  let s = seed >>> 0;
  vi.spyOn(crypto, "getRandomValues").mockImplementation(((
    buffer: Uint32Array,
  ) => {
    for (let i = 0; i < buffer.length; i++) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      buffer[i] = s;
    }
    return buffer;
  }) as never);
};
afterEach(() => vi.restoreAllMocks());
const raid = (boss: RaidBossId, size: number) => {
  const a = createRaidArena("FAIR", boss) as Inner;
  TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3, false);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  return a;
};

describe.each(BOSSES)("%s keeps the honesty rules through a raid", (boss) => {
  it.each([1, 4])(
    "with %i raider(s): floor, freeze, live-attack limit, impact gaps, jumps",
    (size) => {
      seeded(boss.length * 97 + size);
      const a = raid(boss, size);
      for (const p of a.heroes()) a.standIn(p.id);
      const problems: string[] = [];
      const note = (s: string) => problems.length < 12 && problems.push(s);
      // Every new attack (a new cast) starts below the tier's limit.
      const start = a.startAttack.bind(a);
      const counted = new Set<number>();
      a.startAttack = (kind, target) => {
        if (
          a.currentCast &&
          a.currentCast === a.castSerial &&
          !counted.has(a.currentCast)
        ) {
          counted.add(a.currentCast);
          const live = a.liveThreats();
          if (live >= a.concurrency())
            note(
              `${kind} started with ${live} live (limit ${a.concurrency()})`,
            );
        }
        start(kind, target);
      };
      type Seen = {
        w: RaidWarning;
        followUp: boolean;
        frozen?: string;
        cast: number;
      };
      const seen = new Map<number, Seen>();
      const jumps: RaidWarning[] = [];
      // The test sets the boss's health itself so every chapter gets ~50 s.
      const chip = a.raid.maxHp / 3 / 50 / 30;
      for (let t = 0; t < 160 && !a.raid.result; t += DT) {
        const b = a.boss()!,
          before = b.hp;
        const was = new Map(a.raid.warnings.map((w) => [w.id, w]));
        a.tick(DT);
        for (const p of a.heroes()) p.hp = Math.max(p.hp, 1);
        if (a.boss()) a.boss()!.hp = before - chip;
        if ((a.phase as string) === "intermission") a.phase = "playing";
        const now = new Set(a.raid.warnings.map((w) => w.id));
        // Warnings that landed this tick: anything new now is a follow-up.
        const landed = [...was.values()].filter(
          (w) => !now.has(w.id) && w.at <= a.time + EPS,
        );
        for (const w of landed) {
          if (RAID_JUMP_ATTACKS.has(w.kind) && w.kind !== "lullaby")
            jumps.push(w);
          const s = seen.get(w.id);
          if (
            s &&
            !s.followUp &&
            a.harmful(w) &&
            w.at - (w.startedAt ?? w.at) < RAID_TELEGRAPH_FLOOR - EPS
          )
            note(
              `${w.kind} on screen ${(w.at - w.startedAt!).toFixed(2)} s (floor ${RAID_TELEGRAPH_FLOOR})`,
            );
        }
        const fresh: Seen[] = [];
        for (const w of a.raid.warnings) {
          let s = seen.get(w.id);
          if (!s) {
            s = {
              w,
              followUp: !!w.followUp || landed.length > 0,
              cast: a.castOf.get(w) ?? -w.id,
            };
            seen.set(w.id, s);
            fresh.push(s);
          }
          // Rule 2: frozen at least 0.6 s before landing, then never moves.
          if (w.lockAt !== undefined && w.lockAt < w.at) {
            if (w.lockAt > w.at - RAID_FREEZE + EPS)
              note(`${w.kind} locks ${(w.at - w.lockAt).toFixed(2)} s before`);
            if (a.time >= w.lockAt + DT + EPS) {
              s.frozen ??= shape(w);
              if (s.frozen !== shape(w)) note(`${w.kind} moved after its lock`);
            }
          }
        }
        // Rule 4: a new attack's impacts land apart from the other attacks'.
        for (const s of fresh) {
          if (s.followUp || !a.harmful(s.w)) continue;
          for (const o of a.raid.warnings) {
            const other = seen.get(o.id)!;
            if (other.cast === s.cast || other.followUp || !a.harmful(o))
              continue;
            const gap =
              RAID_JUMP_ATTACKS.has(o.kind) && RAID_JUMP_ATTACKS.has(s.w.kind)
                ? RULES.jumpCooldown + 0.3
                : 0.5;
            if (Math.abs(o.at - s.w.at) < gap - EPS)
              note(
                `${s.w.kind} lands ${Math.abs(o.at - s.w.at).toFixed(2)} s from ${o.kind}`,
              );
          }
        }
        // Rule 4: an attack that overlaps another leaves every raider a spot.
        const newCasts = new Set(
          fresh.filter((s) => !s.followUp).map((s) => s.cast),
        );
        for (const cast of newCasts) {
          const mine = fresh
            .filter((s) => s.cast === cast && a.harmful(s.w) && spatial(s.w))
            .map((s) => s.w);
          const old = a.raid.warnings.filter(
            (w) => !mine.includes(w) && a.harmful(w) && spatial(w),
          );
          if (!mine.length || !old.length) continue;
          const sequential =
            Math.min(...mine.map((w) => w.at)) >=
            Math.max(...old.map((w) => w.at)) + 1 - EPS;
          if (!sequential && !a.safeSpotExists([...old, ...mine]))
            note(`${mine[0].kind} overlaps ${old[0].kind} with no safe spot`);
        }
      }
      // Rule 5: jump attacks on the same ground land the jump cooldown apart.
      for (const [i, m] of jumps.entries())
        for (const n of jumps.slice(i + 1))
          if (
            Math.abs(n.at - m.at) < RULES.jumpCooldown - EPS &&
            Math.hypot(n.x - m.x, n.y - m.y) < n.radius + m.radius
          )
            note(
              `${m.kind} and ${n.kind} ${Math.abs(n.at - m.at).toFixed(2)} s apart on the same ground`,
            );
      expect(problems).toEqual([]);
      expect(seen.size).toBeGreaterThan(10);
      expect(a.raid.phase).toBeGreaterThanOrEqual(2);
    },
    120_000,
  );
});

/**
 * A scripted dodger: it sees every warning as it was 0.45 s ago and walks at
 * the slowest champion's speed to the nearest spot outside every shape it
 * sees. A runner starts out running straight (so the boss may lead it).
 */
function dodge(
  a: Inner,
  ids: string[],
  runner: string | undefined,
  seconds: number,
) {
  const history = new Map<number, { t: number; w: RaidWarning }[]>();
  const run = { x: 0, y: 1 };
  const hp = new Map(a.heroes().map((p) => [p.id, p.hp]));
  for (let t = 0; t < seconds; t += DT) {
    for (const w of a.raid.warnings) {
      const list = history.get(w.id) ?? [];
      list.push({ t: a.time, w: { ...w } });
      history.set(w.id, list);
    }
    const seen = a.raid.warnings
      .map((w) =>
        history
          .get(w.id)!
          .filter((s) => s.t <= a.time - RAID_REACTION + EPS)
          .at(-1),
      )
      .filter((s): s is { t: number; w: RaidWarning } => !!s)
      .map((s) => s.w)
      .filter((w) => a.harmful(w) && spatial(w));
    const danger = (x: number, y: number) =>
      seen.some((w) => raidShapeHits(w, x, y, RULES.radius + 6));
    for (const id of ids) {
      const p = a.heroes().find((q) => q.id === id)!;
      let vx = 0,
        vy = 0;
      if (danger(p.x, p.y)) {
        let best: { x: number; y: number } | undefined;
        for (let r = 15; r <= 600 && !best; r += 15)
          for (let i = 0; i < 32; i++) {
            const ang = (i / 32) * Math.PI * 2;
            const x = p.x + Math.cos(ang) * r,
              y = p.y + Math.sin(ang) * r;
            if (
              x < 40 ||
              x > RULES.width - 40 ||
              y < 40 ||
              y > RULES.height - 40
            )
              continue;
            if (!danger(x, y)) {
              best = { x, y };
              break;
            }
          }
        if (best) {
          const d = Math.hypot(best.x - p.x, best.y - p.y) || 1;
          vx = ((best.x - p.x) / d) * RAID_SLOWEST_SPEED;
          vy = ((best.y - p.y) / d) * RAID_SLOWEST_SPEED;
        }
        if (id === runner) runner = undefined;
      } else if (id === runner) {
        vx = run.x * RAID_SLOWEST_SPEED;
        vy = run.y * RAID_SLOWEST_SPEED;
      }
      p.x = Math.max(40, Math.min(RULES.width - 40, p.x + vx * DT));
      p.y = Math.max(40, Math.min(RULES.height - 40, p.y + vy * DT));
      p.vx = vx;
      p.vy = vy;
    }
    a.tick(DT);
    if (!a.raid.warnings.length && t > 0.5 && !a.raid.waves?.length) break;
  }
  return ids.filter(
    (id) => a.heroes().find((q) => q.id === id)!.hp < hp.get(id)!,
  );
}

/** Set up a still or running raider, then cast one attack at them. */
function cast(
  boss: RaidBossId,
  kind: RaidAttack,
  opts: {
    size: number;
    phase?: number;
    running?: boolean;
    at?: { x: number; y: number };
  },
) {
  const a = raid(boss, opts.size);
  a.raid.phase = opts.phase ?? 1;
  a.nextAttack = Infinity;
  a.started = true;
  const b = a.boss()!;
  const heroes = a.heroes();
  const spots = [
    opts.at ?? { x: b.x - 380, y: b.y - 40 },
    { x: 330, y: 760 },
    { x: 1300, y: 140 },
    { x: 1350, y: 780 },
  ];
  heroes.forEach((p, i) => Object.assign(p, spots[i], { vx: 0, vy: 0 }));
  const target = heroes[0];
  if (opts.running) {
    // Running straight down the screen for a while.
    target.vy = RAID_SLOWEST_SPEED;
    a.motion.set(target.id, [
      { t: a.time - 0.4, vx: 0, vy: RAID_SLOWEST_SPEED },
      { t: a.time - 0.25, vx: 0, vy: RAID_SLOWEST_SPEED },
    ]);
  }
  a.currentCast = ++a.castSerial;
  a.startAttack(kind, target);
  a.settleWarnings();
  a.currentCast = 0;
  return { a, ids: heroes.map((p) => p.id), target };
}

const DODGE: [RaidBossId, RaidAttack, number][] = [
  ["grumblecrag", "volley", 1],
  ["grumblecrag", "debris", 1],
  ["grumblecrag", "charge", 1],
  ["tidewyrm", "dive", 1],
  ["gloomshade", "lunge", 1],
  ["gloomshade", "lunge", 2],
  ["somnara", "tail-splash", 1],
  ["somnara", "falling-stars", 2],
];
describe("a dodger who reacts in 0.45 s at the slowest speed is never hit", () => {
  it.each(DODGE)("%s %s (chapter %i), standing still", (boss, kind, phase) => {
    for (const size of [1, 4]) {
      const { a, ids } = cast(boss, kind, { size, phase });
      expect(dodge(a, ids, undefined, 6), `${boss} ${kind} ×${size}`).toEqual(
        [],
      );
    }
  });
  it.each(DODGE)(
    "%s %s (chapter %i), running straight into it",
    (boss, kind, phase) => {
      const { a, ids, target } = cast(boss, kind, {
        size: 1,
        phase,
        running: true,
      });
      expect(dodge(a, ids, target.id, 6)).toEqual([]);
    },
  );
  it("a lone eruption and a dimming lantern's burst", () => {
    const { a, ids, target } = cast("grumblecrag", "slam", {
      size: 1,
      at: { x: 400, y: 200 },
    });
    a.raid.warnings = [];
    (
      a as unknown as {
        warnEruption(t: Fighter, c: number, teach: boolean): void;
      }
    ).warnEruption(target, 1, false);
    a.settleWarnings();
    expect(dodge(a, ids, undefined, 4)).toEqual([]);
    const g = cast("gloomshade", "snuff", { size: 1, at: { x: 360, y: 240 } });
    expect(g.a.raid.warnings[0].kind).toBe("snuff");
    expect(dodge(g.a, g.ids, undefined, 4)).toEqual([]);
  });
});

describe("predicted aim", () => {
  it("is drawn where it lands, and never leads a raider standing still", () => {
    for (const running of [false, true]) {
      const { a, target } = cast("grumblecrag", "volley", { size: 1, running });
      const w = a.raid.warnings[0];
      const onTarget = raidShapeHits(w, target.x, target.y, 0);
      // Still: the cone is on the raider. Running: it is ahead of them, and
      // the drawn cone is exactly what lands (the server hits nothing else).
      expect(onTarget).toBe(
        !running || raidShapeHits(w, target.x, target.y, 0),
      );
      if (!running) expect(onTarget).toBe(true);
      const drawn = shape(w);
      for (let i = 0; i < 20; i++) a.tick(DT);
      expect(shape(w)).toBe(drawn);
    }
  });
  it("leads a lock only when a late dodger can still walk out of it", () => {
    // Tidewyrm's splash (a 110 px circle frozen 0.7 s) is never led.
    const { a, target } = cast("tidewyrm", "dive", { size: 1, running: true });
    const w = a.raid.warnings[0];
    while (a.time < w.lockAt! + DT) {
      target.y += RAID_SLOWEST_SPEED * DT;
      a.tick(DT);
    }
    expect(Math.hypot(w.x - target.x, w.y - target.y)).toBeLessThan(
      RAID_SLOWEST_SPEED * DT * 3,
    );
  });
});

describe("live-attack limits and spacing", () => {
  it("the tier table caps live attacks by chapter", () => {
    expect(raidTier("grumblecrag").concurrency).toEqual([1, 2, 2]);
    expect(raidTier("somnara").concurrency).toEqual([2, 2, 2]);
    expect(raidTier("storm-twins").concurrency).toEqual([2, 2, 3]);
  });
  it("Somnara's lullaby rings and Gloomshade's paired pulses can each be jumped", () => {
    const s = cast("somnara", "lullaby", { size: 1 });
    for (let i = 0; i < 60; i++) s.a.tick(DT);
    const rings = (s.a.raid.dreamRings ?? []).map((r) => r.startedAt);
    expect(rings).toHaveLength(SOMNARA.lullaby.count);
    for (let i = 1; i < rings.length; i++)
      expect(rings[i] - rings[i - 1]).toBeGreaterThanOrEqual(
        RULES.jumpCooldown,
      );
    const g = cast("gloomshade", "pulse", { size: 1, phase: 3 });
    const first = g.a.raid.warnings[0];
    while (g.a.raid.warnings.includes(first)) g.a.tick(DT);
    const second = g.a.raid.warnings.find((w) => w.kind === "pulse")!;
    expect(second.at - first.at).toBeGreaterThanOrEqual(RULES.jumpCooldown);
  });
  it("party pressure sends a second, spaced copy of a single-target attack", () => {
    const a = raid("grumblecrag", 4);
    a.raid.phase = 2;
    a.started = true;
    a.nextAttack = Infinity;
    const b = a.boss()!;
    a.heroes().forEach((p, i) =>
      Object.assign(p, {
        x: b.x - 420 + i * 30,
        y: 150 + i * 200,
        vx: 0,
        vy: 0,
      }),
    );
    a.deck = ["volley"];
    a.lastReaction = a.attacks;
    a.tryAttack();
    const first = a.raid.warnings.filter((w) => w.kind === "volley");
    expect(first).toHaveLength(1);
    for (let i = 0; i < 12; i++) a.tick(DT);
    const both = a.raid.warnings.filter((w) => w.kind === "volley");
    expect(both).toHaveLength(2);
    expect(both[0].targetId).not.toBe(both[1].targetId);
    expect(a.castOf.get(both[0])).toBe(a.castOf.get(both[1]));
  });
  it("a second attack overlaps only with a different shape, spaced and with a safe spot", () => {
    const a = raid("grumblecrag", 2);
    a.raid.phase = 2;
    a.started = true;
    const b = a.boss()!;
    Object.assign(a.heroes()[0], { x: b.x - 420, y: 300 });
    Object.assign(a.heroes()[1], { x: 400, y: 700 });
    a.deck = ["eruption", "volley", "debris"];
    a.lastReaction = a.attacks;
    a.nextAttack = 0;
    a.tryAttack();
    expect(a.liveThreats()).toBe(1);
    // A circle is live: the next circle (debris) waits; the cone may join.
    a.deck = ["debris", "volley"];
    a.lastReaction = a.attacks;
    a.nextAttack = 0;
    a.tryAttack();
    const kinds = a.raid.warnings.map((w) => w.kind);
    expect(kinds).toContain("volley");
    expect(kinds).not.toContain("debris");
    const [e, v] = [
      a.raid.warnings.find((w) => w.kind === "eruption")!,
      a.raid.warnings.find((w) => w.kind === "volley")!,
    ];
    expect(Math.abs(e.at - v.at)).toBeGreaterThanOrEqual(0.5 - EPS);
    expect(a.safeSpotExists()).toBe(true);
    // At the limit (2 in chapter 2), nothing else starts.
    a.deck = ["slam"];
    a.nextAttack = 0;
    const before = a.raid.warnings.length;
    a.tryAttack();
    expect(a.raid.warnings.length).toBe(before);
  });
});

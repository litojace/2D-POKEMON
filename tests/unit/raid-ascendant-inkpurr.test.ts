/**
 * Ascendant Inkpurr (the Spire's thirtieth floor, Gloomshade's id): harder
 * and smarter than the raid's Inkpurr, but fair. Its tier, pattern, new
 * moves (Nightfall, Shade Pounce), combos, overlap rule, shorter openings
 * and reads; its rules layer off for the ordinary raid and for other
 * bosses. Each new move's fairness is checked here: a safe spot always
 * exists, every warning is on screen at least the raid's floor, and a
 * dodger who reacts in 0.45 s at the slowest speed is never hit. The whole
 * raid also keeps the honesty rules raid-fairness.test.ts checks for the
 * other bosses (floor, freeze, live-attack limit, impact gaps, jumps).
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { GloomshadeArena } from "../../apps/server/src/raid-gloomshade";
import {
  AscendantInkpurrArena,
  AscendantInkpurrRules,
  POUNCE_LEAP,
  inMoonPool,
  onLitTile,
  poolUnderControls,
} from "../../apps/server/src/raid-ascendant-inkpurr";
import { AscendantCragmuffRules } from "../../apps/server/src/raid-ascendant-cragmuff";
import {
  RAID_EXCLUSIVE_ATTACKS,
  RAID_FREEZE,
  RAID_IMPACT_GAP,
  RAID_JUMP_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeHits,
  raidShapeOf,
  type RaidSituation,
} from "../../apps/server/src/raid-ai";
import {
  ASCENDANT_INKPURR as A,
  GLOOMSHADE as G,
  RAID,
  RAID_ASCENDANT_TIER,
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  RAID_TIERS,
  gloomshadePattern,
  handsTileDark,
  isAscendant,
  lanternRadius,
  raidAttacksOf,
  raidBossName,
  raidChapters,
  raidPattern,
  raidSoloRevive,
  raidTierOf,
  type RaidAttack,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import { BOSS_ATTACK_ART } from "../../apps/client/src/boss-attack-art";

const DT = 1 / 30;
const EPS = 1e-6;
type Inner = AscendantInkpurrArena & { [key: string]: any };
const TEAM: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
const arena = (
  size = 1,
  phase = 1,
  form: "ascendant" | "raid" = "ascendant",
) => {
  const variant = form === "raid" ? undefined : form;
  const a = createRaidArena("ASC", "gloomshade", { variant }) as Inner;
  TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3, false);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  a.raid.phase = phase;
  a.raid.trait = "hollow";
  a.started = true;
  a.nextAttack = Infinity;
  return a;
};
const place = (p: Fighter, x: number, y: number) =>
  Object.assign(p, { x, y, vx: 0, vy: 0 });
const run = (a: Inner, seconds: number) => {
  for (let t = 0; t < seconds; t += DT) {
    a.tick(DT);
    a.nextAttack = Infinity;
  }
};
const hurt = (p: Fighter) => CHARACTERS[p.character].health - p.hp;
/** Cast one attack as the boss would (its own cast number), settled. */
const cast = (a: Inner, kind: RaidAttack, target: Fighter) => {
  a.currentCast = ++a.castSerial;
  a.startAttack(kind, target);
  a.settleWarnings();
  a.currentCast = 0;
};
const kinds = (a: Inner) => a.raid.warnings.map((w: RaidWarning) => w.kind);
const of = (a: Inner, kind: RaidAttack) =>
  a.raid.warnings.filter((w: RaidWarning) => w.kind === kind) as RaidWarning[];
/** Copies out at fixed spots (index 0 of the spots is the real one). */
const splitAt = (a: Inner, spots: { x: number; y: number }[]) => {
  const boss = a.boss()!;
  place(boss, spots[0].x, spots[0].y);
  a.raid.decoys = spots
    .slice(1)
    .map((s) => ({ id: ++a.serial, x: s.x, y: s.y }));
  a.targets = spots.map((s) => ({ ...s }));
  a.driftAts = [];
};
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
/** A small repeatable PRNG for random raider spots. */
const prng = (seed: number) => {
  let s = seed >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
};

/**
 * A scripted dodger: every raider sees each warning as it was 0.45 s ago and
 * walks at the slowest champion's speed to the nearest spot the arena's own
 * safe-spot rule calls clear (outside circles, on a lit tile, in light while
 * Nightfall falls). Returns the ids hurt by the moves `track` watches.
 */
function dodge(a: Inner, seconds: number) {
  const history = new Map<number, { t: number; w: RaidWarning }[]>();
  const goals = new Map<string, { x: number; y: number }>();
  const hits = new Set<string>();
  for (let t = 0; t < seconds; t += DT) {
    for (const w of a.raid.warnings) {
      const list = history.get(w.id) ?? [];
      list.push({ t: a.time, w: { ...w } });
      history.set(w.id, list);
    }
    const seen = a.raid.warnings
      .map(
        (w: RaidWarning) =>
          history
            .get(w.id)!
            .filter((s) => s.t <= a.time - RAID_REACTION + EPS)
            .at(-1)?.w,
      )
      .filter(Boolean) as RaidWarning[];
    // Nightfall: aim for a pool's middle (with room to spare).
    const padded = seen.map((w) =>
      w.kind === "nightfall"
        ? {
            ...w,
            pools: (w.pools ?? []).map((p) => ({
              ...p,
              radius: p.radius - 12,
            })),
          }
        : w.kind === "pounce"
          ? { ...w, radius: w.radius + 6 }
          : w,
    );
    for (const p of a.heroes()) {
      if (p.hp <= 0) continue;
      let vx = 0,
        vy = 0;
      if (!a.inkClear(padded, p.x, p.y)) {
        // Keep heading for the spot picked while it stays clear, else the
        // nearest clear one.
        let spot = goals.get(p.id);
        if (!spot || !a.inkClear(padded, spot.x, spot.y)) {
          spot = undefined;
          for (let r = 15; r <= 600 && !spot; r += 15)
            for (let i = 0; i < 32; i++) {
              const ang = (i / 32) * Math.PI * 2;
              const x = p.x + Math.cos(ang) * r,
                y = p.y + Math.sin(ang) * r;
              if (a.inkClear(padded, x, y)) {
                spot = { x, y };
                break;
              }
            }
          if (spot) goals.set(p.id, spot);
        }
        if (spot) {
          const d = Math.hypot(spot.x - p.x, spot.y - p.y) || 1;
          const v = Math.min(RAID_SLOWEST_SPEED, d / DT);
          vx = ((spot.x - p.x) / d) * v;
          vy = ((spot.y - p.y) / d) * v;
        }
      }
      p.x += vx * DT;
      p.y += vy * DT;
      p.vx = vx;
      p.vy = vy;
    }
    lastHits.clear();
    a.tick(DT);
    for (const id of lastHits) hits.add(id);
    a.nextAttack = Infinity;
    if (!a.raid.warnings.length && t > 0.5) break;
  }
  return [...hits];
}
/** Raiders hurt this tick by one of the moves being checked (see `track`). */
const lastHits = new Set<string>();
/** Note who each new move hurts (the arena's damage, while hitBy is one of them). */
function track(a: Inner, moves: RaidAttack[]) {
  const hit = a.damage.bind(a);
  a.damage = (target: Fighter, amount: number, owner: string, ab?: any) => {
    if (!target.raidBoss && moves.includes(a.hitBy)) {
      lastHits.add(target.id);
    }
    return hit(target, amount, owner, ab);
  };
}

describe("the Ascendant tier", () => {
  it("is the shared Ascendant row, with no solo revive", () => {
    expect(raidTierOf("gloomshade", "ascendant")).toBe(RAID_ASCENDANT_TIER);
    const a = arena();
    expect(a).toBeInstanceOf(AscendantInkpurrArena);
    expect(a.raid.variant).toBe("ascendant");
    expect(a.tier()).toEqual({
      ...RAID_ASCENDANT_TIER,
      reviveSeconds: A.reviveSeconds,
    });
    expect(a.soloRevive()).toBeUndefined();
    expect(raidSoloRevive("gloomshade", "ascendant")).toBeUndefined();
    expect(RAID_ASCENDANT_TIER.reviveSeconds).toBe(4.5);
  });
  it("never shortens a telegraph below the floor; Nightfall keeps its length", () => {
    const a = arena();
    expect(a.telegraph("nightfall", A.nightfall.delay)).toBe(A.nightfall.delay);
    expect(a.telegraph("pounce", A.pounce.delay)).toBeCloseTo(
      Math.max(
        RAID_TELEGRAPH_FLOOR,
        A.pounce.delay * RAID_ASCENDANT_TIER.telegraph,
      ),
    );
    expect(a.telegraph("pounce", A.pounce.delay)).toBeGreaterThanOrEqual(
      RAID_TELEGRAPH_FLOOR,
    );
  });
  it("health: the tier's formula alone; per extra raider, ASCENDANT_INKPURR.perExtraPlayer", () => {
    const health = (size: number, form: "ascendant" | "raid") => {
      const a = arena(size, 1, form);
      a.raid.gilded = false;
      return a.bossMaxHp() / (form === "raid" ? RAID_TIERS[2].health : 1);
    };
    expect(health(1, "ascendant")).toBeCloseTo(
      health(1, "raid") * RAID_ASCENDANT_TIER.health,
      -1,
    );
    for (const n of [2, 4]) {
      const extra = n - 1;
      const want =
        (G.health.base + A.perExtraPlayer * extra) /
        (G.health.base + G.health.perExtraPlayer * extra);
      expect(
        health(n, "ascendant") /
          (health(n, "raid") * RAID_ASCENDANT_TIER.health),
      ).toBeCloseTo(want, 2);
    }
    // Never more health per raider than the raid's own.
    expect(A.perExtraPlayer).toBeLessThanOrEqual(G.health.perExtraPlayer);
  });
  it("a party meets the hits and windows ASCENDANT_INKPURR sets; the raid keeps its own", () => {
    const solo = arena(1),
      four = arena(4),
      plain = arena(4, 1, "raid");
    expect(four.bossDamage()).toBeCloseTo(
      solo.bossDamage() * (1 + 3 * A.partyDamage),
    );
    expect(four.window(4)).toBeCloseTo(
      solo.window(4) * (1 + 3 * A.partyWindows),
    );
    expect(solo.window(4)).toBeCloseTo(4 * RAID_ASCENDANT_TIER.windows);
    expect(plain.window(4)).toBeCloseTo(4 * RAID_TIERS[2].windows);
  });
  it("its rhythm tightens by chapter (the ordinary raid's does not)", () => {
    const gap = (phase: number, form: "ascendant" | "raid" = "ascendant") =>
      arena(4, phase, form).cadence();
    for (const phase of [1, 2, 3])
      expect(
        gap(phase) /
          A.cadence[phase - 1] /
          (gap(phase, "raid") / RAID_TIERS[2].cadence),
      ).toBeCloseTo(RAID_ASCENDANT_TIER.cadence, 5);
    expect(A.cadence[2]).toBeLessThan(A.cadence[0]);
  });
});

describe("the layer acts only for Inkpurr's Ascendant form", () => {
  it("the ordinary raid keeps its class, pattern, health, kit and name", () => {
    const a = arena(2, 1, "raid");
    expect(a).toBeInstanceOf(GloomshadeArena);
    expect(a).not.toBeInstanceOf(AscendantInkpurrArena);
    expect(a.raid.variant).toBeUndefined();
    expect(raidBossName(a.raid)).toBe("Inkpurr");
    expect(a.tier()).toBe(RAID_TIERS[2]);
    for (const phase of [1, 2, 3]) {
      a.raid.phase = phase;
      expect(a.pattern()).toEqual(gloomshadePattern(phase, 3, false));
      expect(raidPattern(phase, 3, 4, "gloomshade")).toEqual(
        gloomshadePattern(phase, 3),
      );
    }
    expect(raidAttacksOf("gloomshade")).toHaveLength(6);
    expect(raidAttacksOf("gloomshade")).not.toContain("nightfall");
    expect(raidChapters("gloomshade")[0].name).not.toBe("Eclipsed Yard");
  });
  it("is off on a Gloomshade arena that isn't Ascendant", () => {
    class Layered extends AscendantInkpurrRules(GloomshadeArena) {}
    const make = (Cls: typeof GloomshadeArena) => {
      const a = new Cls("L", "gloomshade") as unknown as Inner;
      TEAM.forEach((c, i) => a.add("p" + i, "P" + i, c));
      a.configure(3, false);
      a.start();
      return a;
    };
    const layered = make(Layered),
      plain = make(GloomshadeArena);
    layered.raid.trait = plain.raid.trait = "hollow";
    expect(layered.inkAscendant()).toBe(false);
    layered.raid.gilded = plain.raid.gilded = false;
    expect(layered.bossMaxHp()).toBe(plain.bossMaxHp());
    expect(layered.tier()).toBe(plain.tier());
    expect(layered.pattern()).toEqual(plain.pattern());
    expect(layered.cadence()).toBe(plain.cadence());
    const s = layered.situation(layered.heroes()) as RaidSituation;
    expect(layered.reactions(s)).toEqual(plain.reactions(s));
  });
  it("is off for another boss's Ascendant form; Cragmuff's is off for Inkpurr", () => {
    class Layered extends AscendantInkpurrRules(GloomshadeArena) {}
    const other = new Layered("L", "grumblecrag") as unknown as Inner;
    other.add("p0", "P0", "voltkit");
    other.configure(3, false);
    other.start();
    other.raid.variant = "ascendant";
    expect(isAscendant(other.raid, "gloomshade")).toBe(false);
    expect(other.inkAscendant()).toBe(false);
    class Both extends AscendantCragmuffRules(
      AscendantInkpurrRules(GloomshadeArena),
    ) {}
    const both = new Both("B", "gloomshade") as unknown as Inner;
    both.add("p0", "P0", "voltkit");
    both.configure(3, false);
    both.start();
    both.raid.variant = "ascendant";
    expect(both.inkAscendant()).toBe(true);
    expect(both.ascendant()).toBe(false);
    both.nextAttack = Infinity;
    both.started = true;
    both.phase = "playing";
    both.startAttack("nightfall", both.heroes()[0]);
    expect(kinds(both)).toEqual(["nightfall"]);
  });
});

describe("Ascendant Inkpurr's kit", () => {
  it("has a name, never a Gilded look, and keeps both across retries", () => {
    const a = arena(2);
    expect(a.raid.name).toBe("Ascendant Inkpurr");
    expect(raidBossName(a.raid)).toBe("Ascendant Inkpurr");
    expect(a.boss()!.name).toBe("Ascendant Inkpurr");
    for (let i = 0; i < 40; i++) {
      a.start();
      expect(a.raid.gilded).toBe(false);
      expect(a.raid.variant).toBe("ascendant");
      expect(a.boss()!.hp).toBe(a.raid.maxHp);
    }
    expect(raidChapters("gloomshade", "ascendant")[0].name).toBe(
      "Eclipsed Yard",
    );
  });
  it("plays both new moves every chapter, splits from chapter 1, keeps its lunge", () => {
    for (const phase of [1, 2, 3]) {
      const p = raidPattern(phase, 3, 4, "gloomshade", "ascendant");
      const a = arena(4, phase);
      expect(a.pattern()).toEqual(p);
      expect(p).toContain("nightfall");
      expect(p).toContain("pounce");
      expect(p).toContain("lunge");
      if (phase < 3) expect(p).toContain("split");
    }
  });
  it("its new attacks have guide text, a glyph, a shape and a place in the guide", () => {
    for (const kind of ["nightfall", "pounce"] as RaidAttack[]) {
      expect(RAID_ATTACKS[kind].name.length).toBeGreaterThan(3);
      expect(RAID_ATTACKS[kind].tip.length).toBeGreaterThan(20);
      expect(RAID_ATTACKS[kind].summary.length).toBeGreaterThan(10);
    }
    expect(raidShapeOf("nightfall")).toBe("field");
    expect(raidShapeOf("pounce")).toBe("circle");
    expect(RAID_EXCLUSIVE_ATTACKS.has("nightfall")).toBe(true);
    const guide = raidAttacksOf("gloomshade", "ascendant");
    expect(guide).toEqual(expect.arrayContaining(["nightfall", "pounce"]));
    expect(guide).toHaveLength(8);
    for (const kind of guide) expect(BOSS_ATTACK_ART, kind).toContain(kind);
  });
});

describe("Nightfall", () => {
  it("lays a pool near every raider: never under their feet or the phone's controls, inside the court, always within reach", () => {
    let checked = 0,
      longer = 0;
    for (const size of [1, 2, 3, 4])
      for (let seed = 1; seed <= 40; seed++) {
        const a = arena(size, 2);
        const rand = prng(seed * 977 + size);
        for (const p of a.heroes())
          place(
            p,
            40 + rand() * (RULES.width - 80),
            40 + rand() * (RULES.height - 80),
          );
        if (seed % 3 === 0)
          for (const p of a.heroes())
            for (let k = 0; k < 4; k++)
              a.noteInkDodge(p.id, Math.cos(seed + k * 0.1), Math.sin(seed));
        for (const teach of [false, true]) {
          a.raid.warnings = [];
          const w = a.warnNightfall(teach);
          const pools = w.pools!;
          const delay = w.at - w.startedAt!;
          expect(delay).toBeGreaterThanOrEqual(A.nightfall.delay);
          if (delay > A.nightfall.delay) longer++;
          expect(pools.length).toBeGreaterThan(0);
          expect(pools.length).toBeLessThanOrEqual(size);
          for (const q of pools) {
            expect(q.x - q.radius).toBeGreaterThanOrEqual(0);
            expect(q.x + q.radius).toBeLessThanOrEqual(RULES.width);
            expect(q.y - q.radius).toBeGreaterThanOrEqual(0);
            expect(q.y + q.radius).toBeLessThanOrEqual(RULES.height);
            // Never under a phone's touch controls (most of it shows).
            expect(
              poolUnderControls(q.x, q.y, q.radius),
              `pool at ${q.x | 0},${q.y | 0}`,
            ).toBeLessThanOrEqual(A.nightfall.coverMax);
            for (const [x0, y0, x1, y1] of A.nightfall.phoneControls)
              expect(
                q.x > x0 && q.x < x1 && q.y > y0 && q.y < y1,
                `pool centre ${q.x | 0},${q.y | 0} under a control`,
              ).toBe(false);
          }
          // Within reach of the slowest champion seeing it late...
          const reach =
            RAID_SLOWEST_SPEED * (delay - RAID_REACTION) - RULES.radius - 10;
          for (const p of a.heroes()) {
            const d = Math.min(
              ...pools.map((q) => Math.hypot(q.x - p.x, q.y - p.y) - q.radius),
            );
            expect(d).toBeLessThanOrEqual(reach);
            checked++;
          }
          // ...and nobody's own pool is under their feet.
          expect(
            a.heroes().filter((p: Fighter) => !inMoonPool(p.x, p.y, pools))
              .length,
          ).toBeGreaterThan(0);
          expect(a.safeSpotExists([w])).toBe(true);
        }
      }
    expect(checked).toBeGreaterThan(300);
    // Deep in the controls' corner a raider walks farther, and Nightfall waits.
    expect(longer).toBeGreaterThan(0);
    const a = arena(1, 2);
    place(a.heroes()[0], 1450, 760);
    const w = a.warnNightfall(false);
    expect(w.at - w.startedAt!).toBeGreaterThan(A.nightfall.delay);
    expect(a.safeSpotExists([w])).toBe(true);
  });
  it("the dark hurts and curses; a pool or lantern light spares you; the pools stay lit", () => {
    const a = arena(4, 1);
    const [p0, p1, p2, p3] = a.heroes();
    place(p0, 800, 450);
    place(p1, 700, 300);
    place(p2, 1000, 600);
    place(p3, 500, 700);
    cast(a, "nightfall", p0);
    const w = of(a, "nightfall")[0];
    expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(A.nightfall.delay);
    const pools = w.pools!;
    // p0 into a pool, p1 into a lit lantern's light, p2 and p3 stay in the dark.
    place(p0, pools[0].x, pools[0].y);
    const lantern = a.raid.lanterns![0];
    lantern.lit = true;
    place(p1, lantern.x + 20, lantern.y);
    place(p2, 800, 120);
    place(p3, 800, 800);
    expect(inMoonPool(p2.x, p2.y, pools) || a.lit(p2.x, p2.y)).toBe(false);
    expect(inMoonPool(p3.x, p3.y, pools) || a.lit(p3.x, p3.y)).toBe(false);
    run(a, w.at - a.time + DT);
    expect(hurt(p0)).toBe(0);
    expect(hurt(p1)).toBe(0);
    expect(hurt(p2)).toBeGreaterThan(0);
    expect(hurt(p3)).toBeGreaterThan(0);
    expect(a.raid.curses![p2.id].stacks).toBe(1);
    expect(a.raid.curses![p0.id]?.stacks ?? 0).toBe(0);
    // The pools stay lit: light that cleanses and shows the real one's shadow.
    expect(a.lit(pools[0].x, pools[0].y)).toBe(true);
    run(a, A.nightfall.linger + 0.1);
    expect(a.lit(pools[0].x, pools[0].y)).toBe(false);
  });
  it("reads: the pools sit away from where a raider usually dodges", () => {
    const a = arena(1, 2);
    const p = place(a.heroes()[0], 800, 450);
    for (let i = 0; i < 4; i++) a.noteInkDodge(p.id, 1, 0);
    const [q] = a.moonPools(false);
    expect(q.x).toBeLessThan(p.x - A.nightfall.near * 0.7);
    expect(a.inkReads.pools).toBe(1);
  });
  it("a dodger who reacts in 0.45 s at the slowest speed always reaches the light", () => {
    for (const size of [1, 2, 3, 4])
      for (let seed = 1; seed <= 8; seed++) {
        const a = arena(size, 2);
        track(a, ["nightfall"]);
        const rand = prng(seed * 31 + size);
        for (const p of a.heroes())
          place(p, 80 + rand() * 1440, 80 + rand() * 740);
        // Every lantern out: only the pools are safe.
        for (const l of a.raid.lanterns!) l.lit = false;
        cast(a, "nightfall", a.heroes()[0]);
        expect(dodge(a, 3), `${size} raiders, seed ${seed}`).toEqual([]);
      }
  });
});

describe("the Shade Pounce", () => {
  it("copies first, each at the raider nearest it; the real one last, at its target", () => {
    const a = arena(4, 2);
    const [p0, p1, p2, p3] = a.heroes();
    splitAt(a, [
      { x: 800, y: 430 },
      { x: 560, y: 300 },
      { x: 1040, y: 600 },
      { x: 800, y: 690 },
    ]);
    place(p0, 1200, 200);
    place(p1, 500, 250);
    place(p2, 1100, 650);
    place(p3, 820, 820);
    cast(a, "pounce", p0);
    const ws = of(a, "pounce").sort((x, y) => x.at - y.at);
    expect(ws.map((w) => w.chain)).toEqual([1, 2, 3, 4]);
    expect(ws.at(-1)!.body).toBe(0);
    expect(ws.at(-1)!.targetId).toBe(p0.id);
    expect(ws.slice(0, 3).every((w) => w.body !== 0)).toBe(true);
    // Each copy leaps at the raider nearest it.
    const prey = ws.slice(0, 3).map((w) => w.targetId);
    expect(new Set(prey)).toEqual(new Set([p1.id, p2.id, p3.id]));
    expect(ws[0].at - ws[0].startedAt!).toBeGreaterThanOrEqual(
      RAID_TELEGRAPH_FLOOR,
    );
    for (let i = 1; i < ws.length; i++)
      expect(ws[i].at - ws[i - 1].at).toBeGreaterThanOrEqual(
        RAID_IMPACT_GAP - EPS,
      );
    expect(a.safeSpotExists(ws)).toBe(true);
  });
  it("alone without copies, the real one pounces twice; it leaps onto each circle", () => {
    const a = arena(1, 1);
    const boss = a.boss()!;
    const p = place(a.heroes()[0], boss.x - 400, boss.y);
    cast(a, "pounce", p);
    const ws = of(a, "pounce");
    expect(ws).toHaveLength(2);
    expect(ws.every((w) => w.body === 0)).toBe(true);
    // The second leap goes on away from the boss.
    expect(ws[1].x).toBeLessThan(ws[0].x);
    expect(Math.hypot(ws[0].x - p.x, ws[0].y - p.y)).toBeLessThan(1);
    // The body holds still while the circle fills, then leaps onto it.
    const start = { x: boss.x, y: boss.y };
    run(a, ws[0].at - a.time - POUNCE_LEAP - 0.05);
    expect(Math.hypot(boss.x - start.x, boss.y - start.y)).toBeLessThan(2);
    place(p, 200, 820);
    run(a, POUNCE_LEAP + 0.1);
    expect(Math.hypot(boss.x - ws[0].x, boss.y - ws[0].y)).toBeLessThan(1);
    run(a, 0.6);
    expect(Math.hypot(boss.x - ws[1].x, boss.y - ws[1].y)).toBeLessThan(1);
    expect(hurt(p)).toBe(0);
  });
  it("only who is inside is hit: the real one hurts more, a copy curses", () => {
    const a = arena(2, 2);
    a.pounceHands = () => undefined;
    const [p0, p1] = a.heroes();
    splitAt(a, [
      { x: 800, y: 430 },
      { x: 560, y: 300 },
    ]);
    place(p0, 1100, 450);
    place(p1, 500, 300);
    cast(a, "pounce", p0);
    run(a, 3);
    expect(hurt(p0)).toBeCloseTo(A.pounce.damage * a.bossDamage(), 0);
    expect(hurt(p1)).toBeCloseTo(A.pounce.copyDamage * a.bossDamage(), 0);
    expect(a.raid.curses![p1.id].stacks).toBe(1);
    expect(a.raid.curses?.[p0.id]?.stacks ?? 0).toBe(0);
  });
  it("a real one that lands in lantern light casts its shadow: it is revealed", () => {
    for (const lit of [true, false]) {
      const a = arena(2, 2);
      const [p0, p1] = a.heroes();
      splitAt(a, [
        { x: 800, y: 430 },
        { x: 1040, y: 600 },
      ]);
      const l = a.raid.lanterns![0];
      l.lit = lit;
      place(p0, l.x + 30, l.y + 10);
      place(p1, 1200, 700);
      cast(a, "pounce", p0);
      while (of(a, "pounce").length) run(a, DT);
      expect((a.raid.revealUntil ?? 0) > a.time).toBe(lit);
      expect(a.inkReads.reveals).toBe(lit ? 1 : 0);
    }
  });
  it("aims where a raider usually dodges, ahead of a runner", () => {
    const a = arena(1, 2);
    const p = place(a.heroes()[0], 600, 450);
    for (let i = 0; i < 3; i++) a.noteInkDodge(p.id, 0, 1);
    cast(a, "pounce", p);
    const [w] = of(a, "pounce");
    expect(w.y - p.y).toBeCloseTo(A.pounce.radius * A.habit.offset);
    expect(a.inkReads.habits).toBeGreaterThan(0);
  });
  it("a safe spot always exists, and a 0.45 s dodger at the slowest speed is never hit", () => {
    for (const size of [1, 2, 3, 4])
      for (let seed = 1; seed <= 10; seed++) {
        seeded(seed * 13 + size);
        const a = arena(size, 2);
        track(a, ["pounce"]);
        const rand = prng(seed * 7 + size * 101);
        // Copies (0-3) at the yard's spots, raiders anywhere.
        const spots = [...G.spots]
          .sort(() => rand() - 0.5)
          .slice(0, 1 + (seed % 4));
        splitAt(a, spots);
        for (const p of a.heroes())
          place(p, 80 + rand() * 1440, 80 + rand() * 740);
        if (seed % 2)
          for (const p of a.heroes())
            for (let k = 0; k < 4; k++)
              a.noteInkDodge(p.id, Math.cos(seed), Math.sin(seed));
        cast(a, "pounce", a.heroes()[seed % size]);
        const ws = of(a, "pounce");
        expect(a.safeSpotExists(ws)).toBe(true);
        for (const w of ws)
          expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
            RAID_TELEGRAPH_FLOOR,
          );
        expect(dodge(a, 4), `${size} raiders, seed ${seed}`).toEqual([]);
      }
  });
});

/** Cast pounces (each its own attack number) until one brings hands. */
const pounceWithHands = (a: Inner, target: Fighter, tries = 40) => {
  for (let i = 0; i < tries; i++) {
    a.raid.warnings = [];
    a.attacks = i;
    cast(a, "pounce", target);
    if (of(a, "hands").length) return of(a, "hands")[0];
  }
  return undefined;
};

describe("overlap: a pounce may bring Grasping Hands, and a lit tile stays within reach", () => {
  it("in a party from chapter 2; alone, in chapter 1, or in the raid, never", () => {
    for (const [size, phase] of [
      [1, 2],
      [2, 1],
      [2, 2],
      [4, 3],
    ]) {
      const a = arena(size, phase);
      a.heroes().forEach((p: Fighter, i: number) =>
        place(p, 300 + i * 300, 450),
      );
      const open = size >= A.overlap.raiders && phase >= A.overlap.from;
      const hands = pounceWithHands(a, a.heroes()[0]);
      expect(!!hands, `${size}/${phase}`).toBe(open);
      if (!hands) continue;
      // The board closes after the last leap, never flips, and is fair.
      const circles = of(a, "pounce");
      expect(hands.shiftAt).toBeUndefined();
      expect(
        hands.at - Math.max(...circles.map((w) => w.at)),
      ).toBeGreaterThanOrEqual(RAID_IMPACT_GAP - EPS);
      expect(a.safeSpotExists([...circles, hands])).toBe(true);
    }
    const r = arena(2, 2, "raid");
    cast(r, "lunge", r.heroes()[0]);
    expect(kinds(r)).not.toContain("hands");
    // A pounce never meets a pulse (its rings follow the body it moves).
    const a = arena(2, 2);
    cast(a, "pulse", a.heroes()[0]);
    expect(a.canOverlap("pounce")).toBe(false);
    const b = arena(2, 2);
    b.attacks = 99;
    cast(b, "pounce", b.heroes()[0]);
    expect(b.canOverlap("pulse")).toBe(false);
  });
  it("the safe-spot rule knows the board: circles over every lit tile in reach leave no spot", () => {
    const a = arena(2, 2);
    const [p0, p1] = a.heroes();
    place(p1, 1400, 800);
    cast(a, "hands", p0);
    const hands = of(a, "hands")[0];
    // Stand in the middle of a tile that will be dark.
    const tw = RULES.width / G.hands.cols,
      th = RULES.height / G.hands.rows;
    const parity =
      hands.shiftAt !== undefined ? 1 - hands.parity! : hands.parity!;
    let spot = { x: 0, y: 0 };
    for (let c = 1; c < G.hands.cols - 1; c++)
      for (let r = 1; r < G.hands.rows - 1; r++) {
        const x = (c + 0.5) * tw,
          y = (r + 0.5) * th;
        if (handsTileDark(x, y, parity)) spot = { x, y };
      }
    place(p0, spot.x, spot.y);
    expect(onLitTile(hands, p0.x, p0.y)).toBe(false);
    expect(a.safeSpotExists([hands])).toBe(true);
    // Circles on the four lit tiles around it, landing with the hands.
    const circles = [
      [tw, 0],
      [-tw, 0],
      [0, th],
      [0, -th],
    ].map(([dx, dy]) => ({
      ...hands,
      id: 900 + dx + dy,
      kind: "pounce" as RaidAttack,
      x: spot.x + dx,
      y: spot.y + dy,
      tx: spot.x + dx,
      ty: spot.y + dy,
      radius: 130,
    }));
    // The base rule (circles only) sees a spot; the board says there is none.
    expect(a.safeSpotExists(circles)).toBe(true);
    expect(a.safeSpotExists([hands, ...circles])).toBe(false);
    // So an attack that would do that waits until the hands have closed.
    const fresh = circles.map((c) => {
      const w = a.warn("pounce", c.x, c.y, c.x, c.y, c.radius, 1);
      w.at = hands.at + RAID_IMPACT_GAP;
      return w;
    });
    a.spaceOverlap(fresh);
    expect(
      Math.min(...fresh.map((w: RaidWarning) => w.at)),
    ).toBeGreaterThanOrEqual(hands.at + 1 - EPS);
    // And a pounce's own hands never take that board: they darken the
    // other tiles (the raider's own is then lit and clear), or none.
    const b = arena(2, 2);
    const [q0, q1] = b.heroes();
    place(q0, spot.x, spot.y);
    place(q1, 1400, 800);
    const ring = circles.map((c) =>
      b.warn("pounce", c.x, c.y, c.x, c.y, c.radius, 1.2),
    );
    let laid = 0;
    for (let i = 0; i < 40; i++) {
      b.attacks = i;
      const h = b.pounceHands(ring);
      if (!h) continue;
      laid++;
      expect(h.parity).not.toBe(parity);
      expect(b.safeSpotExists([...ring, h])).toBe(true);
      b.raid.warnings = b.raid.warnings.filter((w: RaidWarning) => w !== h);
    }
    expect(laid).toBeGreaterThan(0);
  });
  it("a dodger who reacts in 0.45 s at the slowest speed clears the circles and finds a lit tile", () => {
    let boards = 0;
    for (let seed = 1; seed <= 16; seed++) {
      seeded(seed * 71);
      const a = arena(2 + (seed % 3), 2);
      track(a, ["pounce", "hands"]);
      const rand = prng(seed * 19);
      if (seed % 2)
        splitAt(a, [
          { x: 800, y: 430 },
          { x: 560, y: 300 },
          { x: 1040, y: 600 },
        ]);
      for (const p of a.heroes())
        place(p, 120 + rand() * 1360, 120 + rand() * 660);
      const hands = pounceWithHands(a, a.heroes()[seed % 2]);
      if (!hands) continue;
      boards++;
      expect(dodge(a, 5), `seed ${seed}`).toEqual([]);
    }
    expect(boards).toBeGreaterThan(5);
  });
});

describe("combos", () => {
  it("from chapter 1, a lunge ends in a pounce on the raider it chased (twice at a lone raider)", () => {
    expect(A.combosFrom.lunge).toBe(1);
    const a = arena(2, 1);
    const p = place(a.heroes()[0], 400, 700);
    place(a.heroes()[1], 1300, 150);
    a.seenAttacks.set("lunge", 2);
    a.inkFeintRoll = () => false;
    cast(a, "lunge", p);
    const lanes = of(a, "lunge");
    const last = Math.max(...lanes.map((w) => w.at));
    while (a.raid.warnings.some((w: RaidWarning) => lanes.includes(w)))
      run(a, DT);
    const ws = of(a, "pounce");
    expect(ws).toHaveLength(1);
    expect(ws[0].body).toBe(0);
    expect(ws[0].followUp).toBe(true);
    expect(ws[0].targetId).toBe(p.id);
    expect(ws[0].at - ws[0].startedAt!).toBeGreaterThanOrEqual(
      RAID_TELEGRAPH_FLOOR,
    );
    expect(ws[0].at - last).toBeGreaterThanOrEqual(RAID_IMPACT_GAP);
    // A lone raider: the real one leaps twice, chasing them.
    const solo = arena(1, 1);
    const q = place(solo.heroes()[0], 400, 700);
    solo.seenAttacks.set("lunge", 2);
    solo.inkFeintRoll = () => false;
    cast(solo, "lunge", q);
    while (of(solo, "lunge").length) run(solo, DT);
    expect(of(solo, "pounce").map((w) => w.body)).toEqual([0, 0]);
    // The ordinary raid's lunge doesn't.
    const r = arena(1, 1, "raid");
    cast(r, "lunge", place(r.heroes()[0], 400, 700));
    run(r, 2);
    expect(kinds(r)).not.toContain("pounce");
  });
  it("from chapter 2, a snuffed lantern's darkness lunges at whoever stood in its light", () => {
    expect(A.combosFrom.snuff).toBe(2);
    for (const phase of [1, 2]) {
      const a = arena(2, phase);
      const [p0, p1] = a.heroes();
      const l = a.raid.lanterns![0];
      place(p0, l.x + 40, l.y + 30);
      place(p1, 1300, 800);
      cast(a, "snuff", p0);
      const snuff = of(a, "snuff")[0];
      expect(snuff.lantern).toBe(0);
      run(a, snuff.at - a.time + DT);
      const lanes = of(a, "lunge");
      expect(lanes.length).toBe(phase >= 2 ? 1 : 0);
      if (!lanes.length) continue;
      expect(lanes[0].x).toBe(l.x);
      expect(lanes[0].y).toBe(l.y);
      expect(lanes[0].targetId).toBe(p0.id);
      expect(lanes[0].at - lanes[0].lockAt!).toBeGreaterThanOrEqual(
        RAID_FREEZE - EPS,
      );
    }
  });
  it("from chapter 2, every body pounces once Nightfall has landed", () => {
    expect(A.combosFrom.nightfall).toBe(2);
    for (const phase of [1, 2]) {
      const a = arena(3, phase);
      a.heroes().forEach((p: Fighter, i: number) =>
        place(p, 400 + i * 400, 450),
      );
      splitAt(a, [
        { x: 800, y: 210 },
        { x: 560, y: 600 },
        { x: 1040, y: 600 },
      ]);
      cast(a, "nightfall", a.heroes()[0]);
      const w = of(a, "nightfall")[0];
      run(a, w.at - a.time + DT);
      const ws = of(a, "pounce");
      expect(ws.length).toBe(phase === 2 ? 3 : 0);
      for (const p of ws) {
        expect(p.followUp).toBe(true);
        expect(p.at - p.startedAt!).toBeGreaterThanOrEqual(
          RAID_TELEGRAPH_FLOOR,
        );
      }
    }
  });
});

describe("fewer, shorter openings", () => {
  it("a stagger and a found core last less than in the raid", () => {
    const stagger = (form: "ascendant" | "raid") => {
      const a = arena(1, 1, form);
      a.raid.stagger = 100;
      a.tick(DT);
      return a.raid.staggerUntil - a.time;
    };
    expect(stagger("raid")).toBeCloseTo(RAID.staggerSeconds, 1);
    expect(stagger("ascendant")).toBeCloseTo(
      RAID.staggerSeconds * RAID_ASCENDANT_TIER.windows,
      1,
    );
    const a = arena(1, 2);
    expect(a.window(G.exposeSeconds)).toBeLessThan(
      arena(1, 2, "raid").window(G.exposeSeconds),
    );
  });
});

describe("it reads the fight", () => {
  it("needs a consistent habit, and learns it from real dodges", () => {
    const a = arena(1, 1);
    const p = place(a.heroes()[0], 600, 300);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      a.noteInkDodge(p.id, dx, dy);
    expect(a.inkHabitOf(p.id)).toBeUndefined();
    const b = arena(1, 1);
    const q = place(b.heroes()[0], 600, 450);
    for (let i = 0; i < 3; i++) {
      cast(b, "pounce", q);
      run(b, 0.3);
      place(q, q.x, q.y - 200);
      while (b.raid.warnings.length) run(b, DT);
      run(b, 0.3);
      place(q, 600, 450);
    }
    const h = b.inkHabitOf(q.id)!;
    expect(h).toBeDefined();
    expect(h.y).toBeLessThan(-0.9);
  });
  it("answers a raider standing still to attack with a pounce", () => {
    const a = arena(2, 1);
    const [p0, p1] = a.heroes();
    place(p0, 1000, 450);
    place(p1, 300, 800);
    p1.vx = 220;
    for (let i = 0; i < 45; i++) {
      a.damage(a.boss()!, 1, p0.id);
      a.trackMotion();
      run(a, DT);
      place(p0, 1000, 450);
      p1.vx = 220;
    }
    expect(a.inkAnchored(p0)).toBe(true);
    expect(a.inkAnchored(p1)).toBe(false);
    const s = a.situation(a.heroes()) as RaidSituation;
    const r = a.reactions(s).find((x: { target?: Fighter }) => x.target === p0);
    expect(r).toMatchObject({ kind: "pounce" });
    expect(r!.score).toBeGreaterThanOrEqual(1);
    cast(a, "pounce", p0);
    expect(a.inkReads.anchors).toBe(1);
    p0.vx = 200;
    a.trackMotion();
    expect(a.inkAnchored(p0)).toBe(false);
  });
  it("hunts the raider kneeling to revive a teammate", () => {
    const a = arena(3, 2);
    const [p0, p1, p2] = a.heroes();
    place(p0, 500, 450);
    place(p1, 560, 470);
    place(p2, 1200, 750);
    p0.hp = 0;
    a.raid.downed[p0.id] = { progress: 0, self: false };
    a.threat.set(p2.id, 500);
    const alive = [p1, p2];
    expect(a.chooseTarget("pounce", alive)).toBe(p1);
    expect(a.chooseTarget("lunge", alive)).toBe(p1);
    const s = a.situation(alive) as RaidSituation;
    expect(a.reactions(s)).toContainEqual(
      expect.objectContaining({ kind: "pounce", target: p1 }),
    );
    cast(a, "pounce", p1);
    expect(a.inkReads.revivers).toBe(1);
  });
  it("plays its new moves and reads in a real fight", () => {
    const a = arena(4, 1);
    for (const p of a.heroes()) a.standIn(p.id);
    a.nextAttack = 0;
    const seen = new Set<RaidAttack>();
    for (let t = 0; t < 200 && !a.raid.result; t += DT) {
      for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
      a.tick(DT);
      for (const w of a.raid.warnings) seen.add(w.kind);
      if (a.phase === "intermission") a.phase = "playing";
    }
    expect(seen).toContain("nightfall");
    expect(seen).toContain("pounce");
    const r = a.inkReads;
    expect(r.habits + r.pools + r.reveals).toBeGreaterThan(0);
  }, 60_000);
});

/**
 * The honesty rules raid-fairness.test.ts checks for every boss, through a
 * whole Ascendant Inkpurr raid with stand-ins: every warning on screen at
 * least the floor, a following shape frozen 0.6 s before it lands, no new
 * attack past the live limit, impacts apart, a safe spot for every overlap
 * (the board and Nightfall's pools included), jump answers apart.
 */
describe("Ascendant Inkpurr keeps the honesty rules through a raid", () => {
  it.each([1, 2, 4])(
    "with %i raider(s)",
    (size) => {
      seeded(4242 + size);
      const a = createRaidArena("FAIR", "gloomshade", {
        variant: "ascendant",
      }) as Inner;
      TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
      a.configure(3, false);
      a.start();
      a.phase = "playing";
      a.deadline = a.time + 600;
      for (const p of a.heroes()) a.standIn(p.id);
      const problems: string[] = [];
      const note = (s: string) => problems.length < 12 && problems.push(s);
      const start = a.startAttack.bind(a);
      const counted = new Set<number>();
      a.startAttack = (kind: RaidAttack, target: Fighter) => {
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
      const shape = (w: RaidWarning) =>
        [w.x, w.y, w.tx, w.ty, w.radius].map((v) => v.toFixed(3)).join(",");
      if (process.env.DBG) {
        const so = a.spaceOverlap.bind(a);
        a.spaceOverlap = (fresh: RaidWarning[]) => {
          const before = fresh.map((w) => w.at - a.time);
          so(fresh);
          if (a.time > 148.5 && a.time < 148.7)
            console.log(
              "SO",
              a.time.toFixed(2),
              JSON.stringify(fresh.map((w) => [w.kind, w.id])),
              before,
              fresh.map((w) => w.at - a.time),
              a.safeSpotExists(),
            );
        };
        const pe = a.playEchoes.bind(a);
        a.playEchoes = () => {
          const n = a.raid.warnings.length;
          pe();
          if (a.time > 148.5 && a.time < 148.7 && a.raid.warnings.length !== n)
            console.log("ECHO", a.time.toFixed(2));
        };
      }
      const seen = new Map<number, Seen>();
      const jumps: RaidWarning[] = [];
      const kindsSeen = new Set<RaidAttack>();
      let overlaps = 0;
      const chip = a.raid.maxHp / 3 / 50 / 30;
      for (let t = 0; t < 160 && !a.raid.result; t += DT) {
        const b = a.boss()!,
          before = b.hp;
        const was = new Map(a.raid.warnings.map((w: RaidWarning) => [w.id, w]));
        for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
        a.tick(DT);
        if (a.boss()) a.boss()!.hp = before - chip;
        if ((a.phase as string) === "intermission") a.phase = "playing";
        const now = new Set(a.raid.warnings.map((w: RaidWarning) => w.id));
        const landed = [...was.values()].filter(
          (w) => !now.has(w.id) && w.at <= a.time + EPS,
        );
        for (const w of landed) {
          if (RAID_JUMP_ATTACKS.has(w.kind)) jumps.push(w);
          const s = seen.get(w.id);
          if (
            s &&
            !s.followUp &&
            a.harmful(w) &&
            w.at - (w.startedAt ?? w.at) < RAID_TELEGRAPH_FLOOR - EPS
          )
            note(`${w.kind} on screen ${(w.at - w.startedAt!).toFixed(2)} s`);
        }
        const fresh: Seen[] = [];
        for (const w of a.raid.warnings as RaidWarning[]) {
          kindsSeen.add(w.kind);
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
          if (w.lockAt !== undefined && w.lockAt < w.at) {
            if (w.lockAt > w.at - RAID_FREEZE + EPS)
              note(`${w.kind} locks ${(w.at - w.lockAt).toFixed(2)} s before`);
            if (a.time >= w.lockAt + DT + EPS) {
              s.frozen ??= shape(w);
              if (s.frozen !== shape(w)) note(`${w.kind} moved after its lock`);
            }
          }
          // A pounce circle never moves.
          if (w.kind === "pounce") {
            s.frozen ??= shape(w);
            if (s.frozen !== shape(w)) note(`pounce moved`);
          }
        }
        for (const s of fresh) {
          if (s.followUp || !a.harmful(s.w)) continue;
          for (const o of a.raid.warnings as RaidWarning[]) {
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
        const newCasts = new Set(
          fresh.filter((s) => !s.followUp).map((s) => s.cast),
        );
        for (const c of newCasts) {
          const mine = fresh
            .filter((s) => s.cast === c && a.harmful(s.w))
            .map((s) => s.w);
          const old = (a.raid.warnings as RaidWarning[]).filter(
            (w) => !mine.includes(w) && a.harmful(w),
          );
          if (!mine.length || !old.length) continue;
          overlaps++;
          const sequential =
            Math.min(...mine.map((w) => w.at)) >=
            Math.max(...old.map((w) => w.at)) + 1 - EPS;
          if (!sequential && !a.safeSpotExists([...old, ...mine]))
            note(`${mine[0].kind} overlaps ${old[0].kind} with no safe spot`);
          if (
            process.env.DBG &&
            !sequential &&
            !a.safeSpotExists([...old, ...mine])
          )
            console.log(
              a.time.toFixed(2),
              JSON.stringify(
                mine.map((w) => [
                  w.kind,
                  w.id,
                  a.castOf.get(w),
                  (w.at - a.time).toFixed(2),
                  w.followUp,
                  w.x | 0,
                  w.y | 0,
                  w.tx | 0,
                  w.ty | 0,
                ]),
              ),
              JSON.stringify(
                old.map((w) => [
                  w.kind,
                  w.id,
                  a.castOf.get(w),
                  (w.at - a.time).toFixed(2),
                  w.followUp,
                  w.x | 0,
                  w.y | 0,
                  w.radius,
                ]),
              ),
              JSON.stringify(
                a.heroes().map((p: Fighter) => [p.x | 0, p.y | 0, p.hp > 0]),
              ),
            );
        }
      }
      for (const [i, m] of jumps.entries())
        for (const n of jumps.slice(i + 1))
          if (
            Math.abs(n.at - m.at) < RULES.jumpCooldown - EPS &&
            Math.hypot(n.x - m.x, n.y - m.y) < n.radius + m.radius
          )
            note(`${m.kind} and ${n.kind} too close on the same ground`);
      expect(problems).toEqual([]);
      expect(seen.size).toBeGreaterThan(10);
      expect(kindsSeen).toContain("nightfall");
      expect(kindsSeen).toContain("pounce");
      expect(a.raid.phase).toBeGreaterThanOrEqual(2);
      if (size === 4) expect(overlaps).toBeGreaterThan(0);
    },
    120_000,
  );
});

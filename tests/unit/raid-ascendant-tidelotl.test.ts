/**
 * Ascendant Tidelotl (the Spire's twentieth floor, Tidewyrm's id): harder
 * and smarter than the raid's Tidelotl, but fair. Its tier, pattern, new
 * moves (Breaker Wall, Geyser Line), combos, shorter openings and reads;
 * its rules layer off for the ordinary raid and for other bosses. The
 * honesty rules (floor, freeze, gaps, a 0.45 s dodger at the slowest speed)
 * are in raid-fairness.test.ts and raid-star3-fairness.test.ts.
 */
import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  RULES,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RaidArena } from "../../apps/server/src/raid";
import { TidewyrmArena } from "../../apps/server/src/raid-tidewyrm";
import {
  AscendantTidelotlArena,
  AscendantTidelotlRules,
  BREAKER_REACH,
  breakerLanes,
  inBreakerLane,
} from "../../apps/server/src/raid-ascendant-tidelotl";
import { AscendantCragmuffRules } from "../../apps/server/src/raid-ascendant-cragmuff";
import {
  RAID_EXCLUSIVE_ATTACKS,
  RAID_IMPACT_GAP,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeOf,
  type RaidSituation,
} from "../../apps/server/src/raid-ai";
import {
  ASCENDANT_TIDELOTL as A,
  RAID,
  RAID_ASCENDANT_TIER,
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  RAID_TIERS,
  TIDEWYRM as T,
  isAscendant,
  raidAttacksOf,
  raidBossName,
  raidChapters,
  raidPattern,
  raidSoloRevive,
  raidTelegraph,
  raidTierOf,
  tidewyrmPattern,
  type RaidAttack,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import { BOSS_ATTACK_ART } from "../../apps/client/src/boss-attack-art";

const DT = 1 / 30;
type Inner = AscendantTidelotlArena & { [key: string]: any };
const TEAM: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
const arena = (
  size = 1,
  phase = 1,
  form: "ascendant" | "raid" = "ascendant",
) => {
  const variant = form === "raid" ? undefined : form;
  const a = createRaidArena("ASC", "tidewyrm", { variant }) as Inner;
  TEAM.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3, false);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  a.raid.phase = phase;
  a.raid.trait = "murky";
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

describe("the Ascendant tier", () => {
  it("is the shared Ascendant row, with its own (longer) revive", () => {
    expect(raidTierOf("tidewyrm", "ascendant")).toBe(RAID_ASCENDANT_TIER);
    const a = arena();
    expect(a).toBeInstanceOf(AscendantTidelotlArena);
    expect(a.raid.variant).toBe("ascendant");
    expect(a.tier()).toEqual({
      ...RAID_ASCENDANT_TIER,
      reviveSeconds: A.reviveSeconds,
    });
    expect(A.reviveSeconds).toBeGreaterThan(RAID_ASCENDANT_TIER.reviveSeconds);
    expect(a.soloRevive()).toBeUndefined();
    expect(raidSoloRevive("tidewyrm", "ascendant")).toBeUndefined();
    // Cragmuff's Ascendant tier is untouched.
    expect(RAID_ASCENDANT_TIER.reviveSeconds).toBe(4.5);
  });
  it("never shortens a telegraph below the floor; a Breaker Wall keeps its length", () => {
    for (const s of [0.9, 1.25, 1.4, 1.5, 1.6, 2]) {
      const t = raidTelegraph("tidewyrm", s, "ascendant");
      if (s >= RAID_TELEGRAPH_FLOOR) expect(t).toBeGreaterThanOrEqual(0.9);
    }
    const a = arena();
    expect(a.telegraph("breaker", A.breaker.delay)).toBe(A.breaker.delay);
    expect(a.telegraph("geyser", A.geyser.delay)).toBeCloseTo(
      A.geyser.delay * RAID_ASCENDANT_TIER.telegraph,
    );
  });
  it("a party meets more health per extra raider; alone, the tier's formula", () => {
    const health = (size: number, form: "ascendant" | "raid") => {
      // (A raid may roll Gilded: compare the plain look's health.)
      const a = arena(size, 1, form);
      a.raid.gilded = false;
      return a.bossMaxHp() / (form === "raid" ? RAID_TIERS[2].health : 1);
    };
    expect(health(1, "ascendant")).toBeCloseTo(
      health(1, "raid") * RAID_ASCENDANT_TIER.health,
      -1,
    );
    const ratio = (n: number) =>
      health(n, "ascendant") / (health(n, "raid") * RAID_ASCENDANT_TIER.health);
    expect(ratio(4)).toBeCloseTo(
      (T.health.base + 3 * A.perExtraPlayer) /
        (T.health.base + 3 * T.health.perExtraPlayer),
      2,
    );
    expect(ratio(2)).toBeGreaterThan(1);
  });
});

describe("the layer acts only for Tidelotl's Ascendant form", () => {
  it("the ordinary raid keeps its class, pattern, health, kit and name", () => {
    const a = arena(2, 1, "raid");
    expect(a).toBeInstanceOf(TidewyrmArena);
    expect(a).not.toBeInstanceOf(AscendantTidelotlArena);
    expect(a.raid.variant).toBeUndefined();
    expect(raidBossName(a.raid)).toBe("Tidelotl");
    expect(a.tier()).toBe(RAID_TIERS[2]);
    for (const phase of [1, 2, 3])
      expect(raidPattern(phase, 3, 4, "tidewyrm")).toEqual(
        tidewyrmPattern(phase, 3),
      );
    expect(raidAttacksOf("tidewyrm")).toHaveLength(6);
    expect(raidAttacksOf("tidewyrm")).not.toContain("breaker");
    expect(raidChapters("tidewyrm")[0].name).not.toBe("Abyssal Swell");
  });
  it("is off on a Tidewyrm arena that isn't Ascendant", () => {
    class Layered extends AscendantTidelotlRules(TidewyrmArena) {}
    const make = (Cls: typeof TidewyrmArena) => {
      const a = new Cls("L", "tidewyrm") as unknown as Inner;
      TEAM.forEach((c, i) => a.add("p" + i, "P" + i, c));
      a.configure(3, false);
      a.start();
      return a;
    };
    const layered = make(Layered),
      plain = make(TidewyrmArena);
    expect(layered.tideAscendant()).toBe(false);
    // (A raid may be Gilded at random: compare the plain look's health.)
    layered.raid.gilded = plain.raid.gilded = false;
    expect(layered.bossMaxHp()).toBe(plain.bossMaxHp());
    expect(layered.tier()).toBe(plain.tier());
    expect(layered.telegraph("breaker", 1.6)).toBe(
      plain.telegraph("breaker", 1.6),
    );
    expect(layered.waveHit({ gaps: undefined } as never)).toEqual({
      kind: "wave",
      damage: T.wave.damage,
    });
    const s = layered.situation(layered.heroes()) as RaidSituation;
    expect(layered.reactions(s)).toEqual([]);
  });
  it("is off for another boss's Ascendant form, and Cragmuff's is off for Tidelotl", () => {
    class Layered extends AscendantTidelotlRules(TidewyrmArena) {}
    const other = new Layered("L", "grumblecrag") as unknown as Inner;
    other.add("p0", "P0", "voltkit");
    other.configure(3, false);
    other.start();
    other.raid.variant = "ascendant";
    expect(isAscendant(other.raid, "tidewyrm")).toBe(false);
    expect(other.tideAscendant()).toBe(false);
    // Both layers on one arena: only the one for this boss acts.
    class Both extends AscendantCragmuffRules(
      AscendantTidelotlRules(TidewyrmArena),
    ) {}
    const both = new Both("B", "tidewyrm") as unknown as Inner;
    both.add("p0", "P0", "voltkit");
    both.configure(3, false);
    both.start();
    both.raid.variant = "ascendant";
    expect(both.tideAscendant()).toBe(true);
    expect(both.ascendant()).toBe(false);
    // Cragmuff's volley rule (its own telegraph) stays off here.
    expect(both.telegraph("volley", 1.4)).toBeCloseTo(
      1.4 * RAID_ASCENDANT_TIER.telegraph,
    );
    both.nextAttack = Infinity;
    both.started = true;
    both.phase = "playing";
    both.startAttack("breaker", both.heroes()[0]);
    expect(kinds(both)).toEqual(["breaker"]);
  });
});

describe("Ascendant Tidelotl's kit", () => {
  it("has a name, never a Gilded look, and keeps both across retries", () => {
    const a = arena(2);
    expect(a.raid.name).toBe("Ascendant Tidelotl");
    expect(raidBossName(a.raid)).toBe("Ascendant Tidelotl");
    expect(a.boss()!.name).toBe("Ascendant Tidelotl");
    for (let i = 0; i < 40; i++) {
      a.start();
      expect(a.raid.gilded).toBe(false);
      expect(a.raid.variant).toBe("ascendant");
      expect(a.boss()!.hp).toBe(a.raid.maxHp);
    }
    expect(raidChapters("tidewyrm", "ascendant")[0].name).toBe("Abyssal Swell");
  });
  it("plays both new moves every chapter, beside its signature dive", () => {
    for (const phase of [1, 2, 3]) {
      const p = raidPattern(phase, 3, 4, "tidewyrm", "ascendant");
      expect(p).toContain("breaker");
      expect(p).toContain("geyser");
      expect(p).toContain("dive");
    }
  });
  it("its new attacks have guide text, a glyph, a shape and a place in the guide", () => {
    for (const kind of ["breaker", "geyser"] as RaidAttack[]) {
      expect(RAID_ATTACKS[kind].name.length).toBeGreaterThan(3);
      expect(RAID_ATTACKS[kind].tip.length).toBeGreaterThan(20);
      expect(RAID_ATTACKS[kind].summary.length).toBeGreaterThan(10);
    }
    expect(raidShapeOf("breaker")).toBe("field");
    expect(raidShapeOf("geyser")).toBe("circle");
    expect(RAID_EXCLUSIVE_ATTACKS.has("breaker")).toBe(true);
    const guide = raidAttacksOf("tidewyrm", "ascendant");
    expect(guide).toEqual(expect.arrayContaining(["breaker", "geyser"]));
    expect(guide).toHaveLength(8);
    for (const kind of guide) expect(BOSS_ATTACK_ART, kind).toContain(kind);
  });
});

describe("the Breaker Wall", () => {
  it("lays calm lanes that leave no spot farther than its reach", () => {
    for (const length of [RULES.height, RULES.width]) {
      let offsets = 0;
      for (let o = 0; o < A.breaker.spacing; o += 10) {
        const lanes = breakerLanes(o, length);
        if (!lanes) continue;
        offsets++;
        for (let s = 40; s <= length - 40; s += 5)
          expect(
            Math.min(...lanes.map((c) => Math.abs(c - s))),
          ).toBeLessThanOrEqual(BREAKER_REACH);
      }
      expect(offsets).toBeGreaterThan(0);
    }
    // The slowest champion, seeing it late, reaches a lane in time.
    const walk =
      BREAKER_REACH - (A.breaker.gapWidth / 2 - RULES.radius) + RULES.radius;
    expect(walk).toBeLessThan(
      RAID_SLOWEST_SPEED * (A.breaker.delay - RAID_REACTION),
    );
  });
  it("sweeps the court: a lane or an island spares you, a jump doesn't", () => {
    const a = arena(4, 1);
    const [p0, p1, p2, p3] = a.heroes();
    place(p0, 300, 300);
    place(p1, 900, 600);
    place(p2, 700, 400);
    place(p3, 1300, 200);
    cast(a, "breaker", p0);
    const w = a.raid.warnings[0];
    expect(w.kind).toBe("breaker");
    expect(w.at - w.startedAt!).toBe(A.breaker.delay);
    const axis = w.tx !== w.x ? "x" : "y";
    const lanes = w.gaps!;
    expect(lanes.length).toBeGreaterThanOrEqual(2);
    // p0 into a lane, p1 onto an island, p2 jumps, p3 stays put (not in a lane).
    const at = (q: Fighter, c: number) =>
      axis === "x" ? place(q, q.x, c) : place(q, c, q.y);
    at(p0, lanes[0]);
    const island = a.raid.islands![0];
    place(p1, island.x, island.y);
    at(p2, lanes[0] + A.breaker.gapWidth);
    at(p3, lanes[lanes.length - 1] - A.breaker.gapWidth);
    expect(inBreakerLane(axis === "x" ? p3.y : p3.x, lanes, w.gapWidth!)).toBe(
      false,
    );
    for (
      let t = 0;
      t < 6 && (a.raid.warnings.length || a.raid.waves?.length);
      t += DT
    ) {
      if (a.raid.waves?.length) p2.jumpUntil = a.time + RULES.jumpDuration;
      a.tick(DT);
      a.nextAttack = Infinity;
    }
    expect(hurt(p0)).toBe(0);
    expect(hurt(p1)).toBe(0);
    expect(hurt(p2)).toBeGreaterThan(0);
    expect(hurt(p3)).toBeGreaterThan(0);
    expect(a.downCauses.breaker ?? 0).toBe(0);
  });
  it("reads: lanes away from where the raiders stand, still within reach", () => {
    const a = arena(4, 1);
    a.heroes().forEach((p: Fighter, i: number) => place(p, 220 + i * 50, 450));
    const w = a.warnBreaker(false);
    const axis = w.tx !== w.x ? "x" : "y";
    for (const p of a.heroes()) {
      const across = axis === "x" ? p.y : p.x;
      const d = Math.min(...w.gaps!.map((c: number) => Math.abs(c - across)));
      expect(d).toBeGreaterThan(A.breaker.gapWidth / 2 - RULES.radius);
      expect(d).toBeLessThanOrEqual(BREAKER_REACH);
    }
    expect(a.tideReads.lanes).toBe(1);
  });
});

describe("the Geyser Line", () => {
  it("three geysers marked at once, erupting one after another along a habit", () => {
    const a = arena(1, 1);
    const p = place(a.heroes()[0], 600, 450);
    for (let i = 0; i < 3; i++) a.noteTideDodge(p.id, 1, 0);
    cast(a, "geyser", p);
    const g = a.raid.warnings as RaidWarning[];
    expect(g.map((w) => w.kind)).toEqual(["geyser", "geyser", "geyser"]);
    expect(g.map((w) => w.chain)).toEqual([1, 2, 3]);
    expect(g[0].at - g[0].startedAt!).toBeGreaterThanOrEqual(
      RAID_TELEGRAPH_FLOOR,
    );
    for (let i = 1; i < 3; i++) {
      expect(g[i].at - g[i - 1].at).toBeCloseTo(A.geyser.gap);
      expect(g[i].at - g[i - 1].at).toBeGreaterThanOrEqual(RAID_IMPACT_GAP);
      // Along where it usually dodges (+x).
      expect(g[i].x - g[i - 1].x).toBeCloseTo(A.geyser.step);
    }
    // The raider stands in the first one (the short way out is back or sideways).
    expect(Math.hypot(g[0].x - p.x, g[0].y - p.y)).toBeLessThan(
      A.geyser.radius,
    );
    expect(a.tideReads.habits).toBe(1);
    // Each lands only on who is inside it.
    run(a, g[0].at - a.time + DT);
    expect(hurt(p)).toBeGreaterThan(0);
    const after = hurt(p);
    place(p, 600, 800);
    run(a, 1.2);
    expect(hurt(p)).toBe(after);
  });
  it("without a habit it runs away from the boss; ahead of a runner along the run", () => {
    const a = arena(1, 1);
    const boss = a.boss()!;
    const p = place(a.heroes()[0], boss.x - 300, boss.y);
    cast(a, "geyser", p);
    const g = a.raid.warnings as RaidWarning[];
    expect(g[2].x).toBeLessThan(g[0].x);
    expect(g[0].x).toBe(p.x);
  });
});

describe("combos", () => {
  it("bubble fans chain into geysers from chapter 2 (not in chapter 1)", () => {
    for (const phase of [1, 2]) {
      const a = arena(1, phase);
      const p = place(a.heroes()[0], 400, 700);
      cast(a, "bubbles", p);
      const fan = a.raid.warnings[0];
      while (a.raid.warnings.includes(fan)) run(a, DT);
      const g = a.raid.warnings.filter((w: RaidWarning) => w.kind === "geyser");
      expect(g.length).toBe(phase === 2 ? 3 : 0);
      for (const w of g) {
        expect(w.followUp).toBe(true);
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
          RAID_TELEGRAPH_FLOOR,
        );
      }
    }
  });
  it("chapter 3: once a Breaker Wall has crossed, geysers rise under a raider", () => {
    for (const phase of [2, 3]) {
      const a = arena(1, phase);
      const p = place(a.heroes()[0], 600, 450);
      cast(a, "breaker", p);
      const w = a.raid.warnings[0];
      // Stand in a lane.
      if (w.tx !== w.x) place(p, p.x, w.gaps![0]);
      else place(p, w.gaps![0], p.y);
      let geysersWhileWall = 0,
        geysers = 0;
      for (let t = 0; t < 7; t += DT) {
        run(a, DT);
        const g = a.raid.warnings.filter(
          (x: RaidWarning) => x.kind === "geyser",
        ).length;
        if (a.raid.waves?.length) geysersWhileWall += g;
        geysers = Math.max(geysers, g);
      }
      expect(geysersWhileWall).toBe(0);
      expect(geysers).toBe(phase === 3 ? 3 : 0);
      // Standing in a calm lane, the wall never touches it.
      if (phase === 2) expect(hurt(p)).toBe(0);
    }
  });
  it("a dive that surfaces in the water (from chapter 2) is followed by geysers; a strand is not", () => {
    for (const onIsland of [false, true]) {
      const a = arena(1, 2);
      const island = a.raid.islands![0];
      const p = onIsland
        ? place(a.heroes()[0], island.x, island.y)
        : place(a.heroes()[0], 800, 780);
      a.seenAttacks.set("dive", 2);
      a.tideFeintRoll = () => false;
      cast(a, "dive", p);
      const dive = a.raid.warnings[0];
      while (a.raid.warnings.includes(dive)) run(a, DT);
      const g = a.raid.warnings.filter((w: RaidWarning) => w.kind === "geyser");
      expect(g.length).toBe(onIsland ? 0 : 3);
      for (const w of g)
        expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(
          RAID_TELEGRAPH_FLOOR,
        );
      if (onIsland) expect(a.raid.exposedUntil).toBeGreaterThan(a.time);
    }
  });
  it("a strand ends with two tail sweeps, the second wider and a jump cooldown later", () => {
    for (const form of ["ascendant", "raid"] as const) {
      const a = arena(1, 2, form);
      const island = a.raid.islands![1];
      const p = place(a.heroes()[0], island.x, island.y);
      a.seenAttacks.set("dive", 2);
      a.tideFeintRoll = () => false;
      cast(a, "dive", p);
      const dive = a.raid.warnings[0];
      while (a.raid.warnings.includes(dive)) run(a, DT);
      place(p, 200, 820);
      let sweeps: RaidWarning[] = [];
      for (let t = 0; t < 6; t += DT) {
        run(a, DT);
        for (const w of a.raid.warnings)
          if (w.kind === "slam" && !sweeps.includes(w)) sweeps.push(w);
      }
      sweeps = sweeps.sort((x, y) => x.at - y.at);
      if (form === "raid") {
        expect(sweeps).toHaveLength(1);
        continue;
      }
      expect(sweeps).toHaveLength(2);
      expect(sweeps[1].radius).toBe(A.secondSweep.radius);
      expect(sweeps[1].radius).toBeGreaterThan(sweeps[0].radius);
      expect(sweeps[1].at - sweeps[0].at).toBeGreaterThanOrEqual(
        RULES.jumpCooldown,
      );
    }
  });
});

describe("fewer, shorter openings", () => {
  const strand = (form: "ascendant" | "raid") => {
    const a = arena(1, 2, form);
    const island = a.raid.islands![0];
    const p = place(a.heroes()[0], island.x, island.y);
    a.seenAttacks.set("dive", 2);
    a.tideFeintRoll = () => false;
    cast(a, "dive", p);
    const dive = a.raid.warnings[0];
    while (a.raid.warnings.includes(dive)) run(a, DT);
    return a.raid.exposedUntil - a.time;
  };
  const stagger = (form: "ascendant" | "raid") => {
    const a = arena(1, 1, form);
    a.raid.stagger = 100;
    a.tick(DT);
    return a.raid.staggerUntil - a.time;
  };
  it("a strand and a stagger last less than in the raid", () => {
    expect(strand("raid")).toBeCloseTo(
      T.dive.strand * RAID_TIERS[2].windows + 1,
      1,
    );
    expect(strand("ascendant")).toBeCloseTo(
      T.dive.strand * RAID_ASCENDANT_TIER.windows + 1,
      1,
    );
    expect(stagger("raid")).toBeCloseTo(RAID.staggerSeconds, 1);
    expect(stagger("ascendant")).toBeCloseTo(
      RAID.staggerSeconds * RAID_ASCENDANT_TIER.windows,
      1,
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
      a.noteTideDodge(p.id, dx, dy);
    expect(a.tideHabitOf(p.id)).toBeUndefined();
    const b = arena(1, 1);
    const q = place(b.heroes()[0], 600, 300);
    for (let i = 0; i < 3; i++) {
      cast(b, "geyser", q);
      const w = b.raid.warnings[0];
      run(b, 0.3);
      place(q, q.x, q.y - 150);
      while (b.raid.warnings.length) run(b, DT);
      void w;
      run(b, 0.5);
      place(q, 600, 450);
    }
    const h = b.tideHabitOf(q.id)!;
    expect(h).toBeDefined();
    expect(h.y).toBeLessThan(-0.9);
  });
  it("answers a raider standing still to attack with a Geyser Line", () => {
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
    expect(a.tideAnchored(p0)).toBe(true);
    expect(a.tideAnchored(p1)).toBe(false);
    const s = a.situation(a.heroes()) as RaidSituation;
    const r = a.reactions(s).find((x: { target?: Fighter }) => x.target === p0);
    expect(r).toMatchObject({ kind: "geyser" });
    expect(r!.score).toBeGreaterThanOrEqual(1);
    cast(a, "geyser", p0);
    expect(a.tideReads.anchors).toBe(1);
    p0.vx = 200;
    a.trackMotion();
    expect(a.tideAnchored(p0)).toBe(false);
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
    expect(a.chooseTarget("geyser", alive)).toBe(p1);
    expect(a.chooseTarget("bubbles", alive)).toBe(p1);
    const s = a.situation(alive) as RaidSituation;
    expect(a.reactions(s)).toContainEqual(
      expect.objectContaining({ kind: "geyser", target: p1 }),
    );
    cast(a, "geyser", p1);
    expect(a.tideReads.revivers).toBe(1);
  });
  it("feints: a dive whose ripple sinks away into a Geyser Line, shown in full", () => {
    const a = arena(1, 2);
    a.tideFeintRoll = () => true;
    a.seenAttacks.set("dive", 2);
    const p = place(a.heroes()[0], 700, 780);
    cast(a, "dive", p);
    const dive = a.raid.warnings[0];
    expect(a.raid.submerged).toBe(true);
    const turn =
      dive.startedAt! + (dive.lockAt! - dive.startedAt!) * A.feint.turnAt;
    run(a, turn - a.time + DT);
    expect(a.raid.warnings).not.toContain(dive);
    expect(a.raid.submerged).toBe(false);
    const g = a.raid.warnings.filter((w: RaidWarning) => w.kind === "geyser");
    expect(g).toHaveLength(3);
    for (const w of g)
      expect(w.at - w.startedAt!).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    expect(a.tideReads.feints).toBe(1);
    // The dive never lands: nobody is hit before the first geyser.
    run(a, g[0].at - a.time - 0.1);
    expect(hurt(p)).toBe(0);
  });
  it("a teaching dive, or one with something else live, never feints", () => {
    const a = arena(1, 2);
    a.tideFeintRoll = () => true;
    const p = place(a.heroes()[0], 700, 780);
    cast(a, "dive", p);
    run(a, 1.2);
    expect(kinds(a)).toContain("dive");
    expect(a.tideReads.feints).toBe(0);
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
    expect(seen).toContain("breaker");
    expect(seen).toContain("geyser");
    const r = a.tideReads;
    expect(r.habits + r.lanes + r.feints).toBeGreaterThan(0);
  });
});

/**
 * Ascendant Cragmuff (the Spire's tenth floor): harder and smarter than the
 * raid's Cragmuff, but fair. Its tier, pattern, new moves, combos, shorter
 * openings and reads; the ordinary raid unchanged. The honesty rules
 * (floor, freeze, gaps, a 0.45 s dodger at the slowest speed) are in
 * raid-fairness.test.ts and raid-star3-fairness.test.ts.
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
import { AscendantCragmuffArena } from "../../apps/server/src/raid-ascendant-cragmuff";
import {
  RAID_EXCLUSIVE_ATTACKS,
  RAID_IMPACT_GAP,
  RAID_JUMP_ATTACKS,
  RAID_REACTION,
  RAID_SLOWEST_SPEED,
  raidShapeHits,
  raidShapeOf,
  type RaidSituation,
} from "../../apps/server/src/raid-ai";
import {
  ASCENDANT_CRAGMUFF as A,
  GRUMBLECRAG,
  RAID,
  RAID_ASCENDANT_TIER,
  RAID_ATTACKS,
  RAID_BOSSES,
  RAID_TELEGRAPH_FLOOR,
  RAID_TIERS,
  eruptionChain,
  raidAttacksOf,
  raidChapters,
  raidEnrageSteps,
  raidPattern,
  raidSoloRevive,
  raidTelegraph,
  raidTier,
  raidTierOf,
  type RaidAttack,
  type RaidBossId,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import { BOSS_ATTACK_ART } from "../../apps/client/src/boss-attack-art";
import { soloRevives } from "../../apps/client/src/raid-solo";

const DT = 1 / 30;
type Inner = AscendantCragmuffArena & {
  [key: string]: any;
};
const arena = (
  size = 1,
  phase = 1,
  form: "ascendant" | "raid" = "ascendant",
) => {
  const variant = form === "raid" ? undefined : form;
  const a = createRaidArena("ASC", "grumblecrag", { variant }) as Inner;
  const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
  team.slice(0, size).forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configure(3);
  a.start();
  a.phase = "playing";
  a.deadline = a.time + 600;
  a.raid.phase = phase;
  a.raid.trait = "ancient";
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

describe("the Ascendant tier", () => {
  it("is past ★★★ on every axis that makes a fight harder", () => {
    const t3 = RAID_TIERS[3],
      asc = raidTierOf("grumblecrag", "ascendant");
    expect(asc).toBe(RAID_ASCENDANT_TIER);
    expect(asc.damage).toBeGreaterThan(t3.damage);
    expect(asc.cadence).toBeLessThan(t3.cadence);
    expect(asc.windows).toBeLessThan(t3.windows);
    expect(asc.telegraph).toBeLessThan(t3.telegraph);
    expect(asc.leadFraction).toBeGreaterThan(t3.leadFraction);
    expect(asc.enrageAt).toBeLessThan(t3.enrageAt);
    asc.concurrency.forEach((c, i) =>
      expect(c).toBeGreaterThanOrEqual(t3.concurrency[i]),
    );
    expect(asc.soloRevive).toBeUndefined();
  });
  it("never shortens a telegraph below the floor, nor a jump answer", () => {
    for (const s of [0.5, 0.9, 1.25, 1.4, 1.6, 2, 3.2]) {
      const t = raidTelegraph("grumblecrag", s, "ascendant");
      expect(t).toBeLessThanOrEqual(s);
      if (s >= RAID_TELEGRAPH_FLOOR) expect(t).toBeGreaterThanOrEqual(0.9);
    }
    const a = arena();
    expect(a.telegraph("slam", 1.25)).toBe(1.25);
    expect(a.telegraph("twin-slam", 1.25)).toBe(1.25);
    expect(a.telegraph("charge", 1.6)).toBeCloseTo(1.6 * 0.8);
    // Its volley keeps a slow champion's escape (wide near the boss).
    expect(a.telegraph("volley", 1.4)).toBe(A.volleyDelay);
  });
  it("is what the arena plays: its telegraphs, no solo revive, its enrage", () => {
    const a = arena();
    expect(a).toBeInstanceOf(AscendantCragmuffArena);
    expect(a.raid.variant).toBe("ascendant");
    expect(a.tier()).toBe(RAID_ASCENDANT_TIER);
    expect(a.soloRevive()).toBeUndefined();
    expect(raidSoloRevive("grumblecrag", "ascendant")).toBeUndefined();
    expect(soloRevives("grumblecrag", "ascendant")).toBe(false);
    expect(raidEnrageSteps("grumblecrag", 300, "ascendant")).toBe(1);
    a.raid.elapsed = 300;
    a.stepEnrage();
    expect(a.raid.enrage).toBe(1);
  });
  it("reads its own tier for telegraphs (RaidArena.telegraph uses tier())", () => {
    // A subclass with its own tier row: the base used to read the boss's stars.
    class Tuned extends RaidArena {
      protected override tier() {
        return { ...RAID_TIERS[1], telegraph: 0.5 };
      }
    }
    const a = new Tuned("T") as unknown as Inner;
    a.add("p0", "P", "voltkit");
    a.configure(3);
    a.start();
    expect(a.telegraph("charge", 1.6)).toBe(RAID_TELEGRAPH_FLOOR);
    expect(a.telegraph("debris", 2.4)).toBeCloseTo(1.2);
  });
});

describe("the ordinary raid is unchanged", () => {
  it("every boss keeps its star tier, telegraphs, revive and enrage", () => {
    for (const boss of Object.keys(RAID_BOSSES) as RaidBossId[]) {
      const tier = RAID_TIERS[RAID_BOSSES[boss].stars];
      expect(raidTier(boss)).toBe(tier);
      expect(raidTierOf(boss)).toBe(tier);
      for (const s of [1.25, 1.4, 2])
        expect(raidTelegraph(boss, s)).toBe(
          s >= 1.4 ? Math.max(0.9, s * tier.telegraph) : s,
        );
      expect(!!raidSoloRevive(boss)).toBe(!!tier.soloRevive);
      expect(raidEnrageSteps(boss, tier.enrageAt)).toBe(1);
      expect(raidAttacksOf(boss)).toHaveLength(6);
      expect(raidChapters(boss)).toBe(raidChapters(boss, undefined));
    }
  });
  it("Cragmuff's raid keeps its class, pattern, chain and look", () => {
    const a = arena(2, 1, "raid");
    expect(a).not.toBeInstanceOf(AscendantCragmuffArena);
    expect(a.raid.variant).toBeUndefined();
    expect(a.raid.name).toBe("Cragmuff");
    expect(a.tier()).toBe(RAID_TIERS[1]);
    expect(raidPattern(1, 3, 1)).toEqual([
      "charge",
      "slam",
      "volley",
      "charge",
      "eruption",
      "debris",
    ]);
    expect(raidPattern(2, 3, 4)).toEqual([
      "charge",
      "slam",
      "eruption",
      "charge",
      "share",
      "debris",
    ]);
    expect(raidPattern(3, 3, 1)).toEqual([
      "charge",
      "slam",
      "volley",
      "share",
      "charge",
      "eruption",
    ]);
    expect([1, 2, 3].map((p) => eruptionChain(p, 3))).toEqual([3, 3, 3]);
    expect(raidAttacksOf("grumblecrag")).not.toContain("avalanche");
    expect(raidChapters("grumblecrag")[0].name).toBe("Wake the mountain");
  });
});

describe("Ascendant Cragmuff's kit", () => {
  it("has a name, never a Gilded look, and keeps both across retries", () => {
    const a = arena(2);
    expect(a.raid.name).toBe("Ascendant Cragmuff");
    expect(a.boss()!.name).toBe("Ascendant Cragmuff");
    for (let i = 0; i < 40; i++) {
      a.start();
      expect(a.raid.gilded).toBe(false);
      expect(a.raid.variant).toBe("ascendant");
      expect(a.boss()!.hp).toBe(a.raid.maxHp);
    }
    expect(raidChapters("grumblecrag", "ascendant")[0].name).toBe(
      "Obsidian Wake",
    );
  });
  it("plays both new moves every chapter; alone, no meteor", () => {
    for (const phase of [1, 2, 3])
      for (const size of [1, 4]) {
        const p = raidPattern(phase, 3, size, "grumblecrag", "ascendant");
        expect(p).toContain("avalanche");
        expect(p).toContain("twin-slam");
        expect(p).toContain("charge");
        if (size === 1) expect(p).not.toContain("share");
      }
    expect([1, 2, 3].map((p) => eruptionChain(p, 3, "ascendant"))).toEqual([
      4, 4, 4,
    ]);
  });
  it("its new attacks have guide text, a glyph, a shape and a place in the guide", () => {
    for (const kind of ["avalanche", "fissure", "twin-slam"] as RaidAttack[]) {
      expect(RAID_ATTACKS[kind].name.length).toBeGreaterThan(3);
      expect(RAID_ATTACKS[kind].tip.length).toBeGreaterThan(20);
      expect(RAID_ATTACKS[kind].summary.length).toBeGreaterThan(10);
    }
    expect(raidShapeOf("avalanche")).toBe("line");
    expect(raidShapeOf("fissure")).toBe("line");
    expect(raidShapeOf("twin-slam")).toBe("ring");
    expect(RAID_JUMP_ATTACKS.has("twin-slam")).toBe(true);
    expect(RAID_EXCLUSIVE_ATTACKS.has("avalanche")).toBe(true);
    const guide = raidAttacksOf("grumblecrag", "ascendant");
    expect(guide).toEqual(expect.arrayContaining(["avalanche", "twin-slam"]));
    for (const kind of guide) expect(BOSS_ATTACK_ART, kind).toContain(kind);
  });
});

describe("new moves and combos", () => {
  it("the Avalanche Charge locks at once, runs, and leaves a fissure along its lane", () => {
    const a = arena(2, 2);
    a.raid.pillars.forEach((p: { broken: boolean }) => (p.broken = true));
    const [p0, p1] = a.heroes();
    place(p0, 400, 450);
    place(p1, 1300, 800);
    a.startAttack("avalanche", p0);
    const lane = a.raid.warnings[0];
    expect(lane.kind).toBe("avalanche");
    expect(lane.lockAt).toBe(lane.startedAt);
    // The target steps out of the lane; the boss runs down it.
    place(p0, 400, 640);
    while (a.raid.warnings.includes(lane)) run(a, DT);
    while (a.charging) run(a, DT);
    const fissure = a.raid.warnings.find((w) => w.kind === "fissure")!;
    expect(fissure).toBeDefined();
    expect(fissure.width).toBe(A.fissure.width);
    expect(fissure.at - fissure.startedAt!).toBeGreaterThanOrEqual(
      RAID_TELEGRAPH_FLOOR,
    );
    expect(Math.hypot(fissure.x - 1230, fissure.y - 450)).toBeLessThan(5);
    // Someone who walks into the lane before it erupts is hit; a raider
    // who dodged the charge (outside its 100 px) is not.
    place(p1, (fissure.x + fissure.tx) / 2, (fissure.y + fissure.ty) / 2);
    const before = { p0: hurt(p0), p1: hurt(p1) };
    run(a, fissure.at - a.time + DT);
    expect(hurt(p1)).toBeGreaterThan(before.p1);
    expect(hurt(p0)).toBe(before.p0);
  });
  it("a raider standing on the fissure as it appears can walk off in time", () => {
    const a = arena(1, 2);
    const w = {
      kind: "fissure",
      x: 1230,
      y: 450,
      tx: 700,
      ty: 450,
      width: A.fissure.width,
      radius: A.fissure.width / 2,
    } as RaidWarning;
    // From the middle of the line, the slowest champion after 0.45 s.
    const need = A.fissure.width / 2 + RULES.radius;
    expect(need).toBeLessThan(
      RAID_SLOWEST_SPEED * (A.fissure.delay - RAID_REACTION),
    );
    expect(raidShapeHits(w, 900, 450 + need + 1)).toBe(false);
    expect(raidShapeHits(w, 900, 450 + need - 2)).toBe(true);
    expect(a.raid.warnings).toHaveLength(0);
  });
  it("Twin Slam: ring 1 round the boss, ring 2 toward the target, apart and later", () => {
    for (const [x, y] of [
      [500, 450],
      [1500, 450],
      [1230, 820],
      [1240, 470],
    ]) {
      const a = arena(1, 1);
      const p = place(a.heroes()[0], x, y);
      a.startAttack("twin-slam", p);
      a.settleWarnings();
      const [one, two] = a.raid.warnings;
      expect([one.kind, two.kind]).toEqual(["twin-slam", "twin-slam"]);
      expect([one.chain, two.chain]).toEqual([2, 1]);
      const apart = Math.hypot(one.x - two.x, one.y - two.y);
      const both = apart < one.radius + two.radius + 2 * RULES.radius;
      // A raider in both rings gets the jump cooldown between them.
      expect(two.at - one.at).toBeGreaterThanOrEqual(
        both ? RULES.jumpCooldown : RAID_IMPACT_GAP,
      );
      expect(one.at - one.startedAt!).toBe(A.twinSlam.delay);
    }
  });
  it("a jump clears each ring; standing in one hurts", () => {
    const a = arena(2, 1);
    const [p0, p1] = a.heroes();
    place(p0, 1150, 450); // in ring 1
    place(p1, 560, 450); // ring 2's target
    a.startAttack("twin-slam", p1);
    const [one, two] = a.raid.warnings;
    run(a, one.at - a.time - 0.2);
    p0.jumpUntil = a.time + RULES.jumpDuration;
    run(a, two.at - a.time + 0.05);
    expect(hurt(p0)).toBe(0);
    expect(hurt(p1)).toBeGreaterThan(0);
  });
  it("chains: a second slam from chapter 1, volleys into eruptions from chapter 2, rings into debris in chapter 3", () => {
    const slam = arena(1, 1);
    slam.startAttack("slam", place(slam.heroes()[0], 600, 200));
    const first = slam.raid.warnings[0];
    while (slam.raid.warnings.includes(first)) run(slam, DT);
    const second = slam.raid.warnings.find((w) => w.kind === "slam")!;
    expect(second.followUp).toBe(true);
    expect(second.at - first.at).toBeGreaterThanOrEqual(RULES.jumpCooldown);
    // The raid's Cragmuff starts doubling slams only in chapter 2.
    const plain = arena(1, 1, "raid");
    plain.startAttack("slam", place(plain.heroes()[0], 600, 200));
    run(plain, 1.4);
    expect(plain.raid.warnings.some((w) => w.kind === "slam")).toBe(false);

    const volley = arena(1, 2);
    volley.startAttack("volley", place(volley.heroes()[0], 700, 450));
    const v = volley.raid.warnings[0];
    while (volley.raid.warnings.includes(v)) run(volley, DT);
    expect(volley.raid.warnings.map((w) => w.kind)).toContain("eruption");

    const ring = arena(2, 3);
    ring.raid.closingRadius = undefined;
    ring.startAttack("twin-slam", place(ring.heroes()[0], 600, 450));
    const last = ring.raid.warnings[1];
    while (ring.raid.warnings.includes(last)) run(ring, DT);
    const debris = ring.raid.warnings.filter((w) => w.kind === "debris");
    expect(debris.length).toBeGreaterThanOrEqual(2);
    for (const d of debris)
      expect(d.at - d.startedAt!).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
  });
});

describe("fewer, shorter openings", () => {
  const pillarWindow = (form?: "ascendant" | "raid") => {
    const a = arena(1, 1, form ?? "raid");
    const boss = a.boss()!;
    a.nextAttack = 0;
    a.charging = {
      tx: 700,
      ty: 450,
      until: a.time + 1.3,
      hit: new Set<string>(),
    };
    place(a.heroes()[0], 300, 800);
    while (a.charging) {
      a.tick(DT);
      if (a.raid.exposedUntil > a.time) break;
    }
    expect(boss.x).toBeLessThan(950);
    return {
      exposed: a.raid.exposedUntil - a.time,
      pause: a.nextAttack - a.time,
    };
  };
  const staggerWindow = (form?: "ascendant" | "raid") => {
    const a = arena(1, 1, form ?? "raid");
    a.raid.stagger = 100;
    a.tick(DT);
    return a.raid.staggerUntil - a.time;
  };
  it("a pillar opens the core for less time, and it is back on its feet sooner", () => {
    const raid = pillarWindow(),
      asc = pillarWindow("ascendant");
    expect(raid.exposed).toBeCloseTo(GRUMBLECRAG.pillar.expose * 0.9, 1);
    expect(asc.exposed).toBeCloseTo(GRUMBLECRAG.pillar.expose * 0.6, 1);
    expect(asc.exposed).toBeLessThan(raid.exposed - 1.5);
    expect(asc.pause).toBeLessThan(raid.pause);
  });
  it("a stagger lasts less, and chapter 3's cracked core gives no bonus", () => {
    expect(staggerWindow()).toBeCloseTo(RAID.staggerSeconds, 1);
    expect(staggerWindow("ascendant")).toBeCloseTo(
      RAID.staggerSeconds * 0.6,
      1,
    );
    const raid = arena(1, 3, "raid"),
      asc = arena(1, 3);
    expect(raid.coreMultiplier(raid.boss())).toBe(GRUMBLECRAG.crackedCore);
    expect(asc.coreMultiplier(asc.boss())).toBe(1);
    asc.raid.exposedUntil = asc.time + 2;
    expect(asc.coreMultiplier(asc.boss())).toBe(1.6);
  });
});

describe("it reads the fight", () => {
  it("aims eruptions and debris where a raider habitually dodges", () => {
    const a = arena(1, 1);
    const p = place(a.heroes()[0], 600, 300);
    expect(a.habitOf(p.id)).toBeUndefined();
    for (let i = 0; i < 3; i++) a.noteDodge(p.id, 1, 0.1);
    const h = a.habitOf(p.id)!;
    expect(h.x).toBeGreaterThan(0.9);
    const e = a.warnEruption(p, 1, false);
    expect(e.x - p.x).toBeCloseTo(
      GRUMBLECRAG.eruption.radius * A.habit.offset,
      0,
    );
    // The raider still stands inside it: the short way out is the other way.
    expect(raidShapeHits(e, p.x, p.y, 0)).toBe(true);
    a.raid.warnings = [];
    a.warnDebris(false);
    const d = a.raid.warnings.find(
      (w) => w.radius === GRUMBLECRAG.debris.radius,
    )!;
    expect(d.x).toBeGreaterThan(p.x + 30);
    expect(a.reads.habits).toBe(2);
  });
  it("needs a consistent habit, and learns it from real dodges", () => {
    const a = arena(1, 1);
    const p = place(a.heroes()[0], 600, 300);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ])
      a.noteDodge(p.id, dx, dy);
    expect(a.habitOf(p.id)).toBeUndefined();
    const b = arena(1, 1);
    const q = place(b.heroes()[0], 600, 300);
    for (let i = 0; i < 3; i++) {
      const w = b.warnEruption(q, 1, false);
      b.settleWarnings();
      run(b, 0.3);
      // It dodges up and out every time.
      place(q, q.x, q.y - 150);
      while (b.raid.warnings.includes(w)) run(b, DT);
      run(b, 0.8);
      place(q, 600, 400);
    }
    const h = b.habitOf(q.id)!;
    expect(h).toBeDefined();
    expect(h.y).toBeLessThan(-0.9);
  });
  it("punishes a raider standing still to attack: a stomp in melee, an eruption at range", () => {
    for (const [x, kind] of [
      [1100, "twin-slam"],
      [600, "eruption"],
    ] as const) {
      const a = arena(2, 1);
      const [p0, p1] = a.heroes();
      place(p0, x, 450);
      place(p1, 300, 800);
      p1.vx = 220;
      for (let i = 0; i < 45; i++) {
        a.damage(a.boss()!, 1, p0.id);
        a.trackMotion();
        run(a, DT);
        place(p0, x, 450);
        p1.vx = 220;
      }
      expect(a.anchored(p0)).toBe(true);
      expect(a.anchored(p1)).toBe(false);
      const s = a.situation(a.heroes()) as RaidSituation;
      const r = a
        .reactions(s)
        .find((r: { target?: Fighter }) => r.target === p0);
      expect(r).toMatchObject({ kind });
      expect(r!.score).toBeGreaterThanOrEqual(1);
      // Moving again clears it.
      p0.vx = 200;
      a.trackMotion();
      expect(a.anchored(p0)).toBe(false);
    }
  });
  it("hunts the raider kneeling to revive a teammate", () => {
    const a = arena(3, 2);
    const [p0, p1, p2] = a.heroes();
    place(p0, 500, 300);
    place(p1, 560, 320);
    place(p2, 900, 750);
    p0.hp = 0;
    a.raid.downed[p0.id] = { progress: 0, self: false };
    // p2 hurts the boss far more, but p1 is reviving.
    a.threat.set(p2.id, 500);
    const alive = [p1, p2];
    expect(a.chooseTarget("volley", alive)).toBe(p1);
    expect(a.chooseTarget("eruption", alive)).toBe(p1);
    const s = a.situation(alive) as RaidSituation;
    expect(a.reactions(s)).toContainEqual(
      expect.objectContaining({ kind: "eruption", target: p1 }),
    );
    a.startAttack("eruption", p1);
    expect(a.reads.revivers).toBe(1);
  });
  it("feints: a slam that turns into a volley at a raider who left, shown in full", () => {
    const a = arena(2, 2);
    a.feintRoll = () => true;
    a.seenAttacks.set("slam", 2);
    const [p0, p1] = a.heroes();
    place(p0, 1100, 450);
    place(p1, 500, 700);
    a.currentCast = ++a.castSerial;
    a.startAttack("slam", p0);
    a.settleWarnings();
    a.currentCast = 0;
    const slam = a.raid.warnings[0];
    const turn = slam.startedAt! + (slam.at - slam.startedAt!) * A.feint.turnAt;
    run(a, turn - a.time + DT);
    expect(a.raid.warnings).not.toContain(slam);
    const volley = a.raid.warnings.find((w) => w.kind === "volley")!;
    expect(volley.targetId).toBe(p1.id);
    expect(volley.at - volley.startedAt!).toBeGreaterThanOrEqual(A.volleyDelay);
    expect(a.reads.feints).toBe(1);
    // The slam never lands: the raider who stayed close takes nothing.
    run(a, slam.at - a.time + 0.3);
    expect(hurt(p0)).toBe(0);
  });
  it("feints into an eruption under a raider who stayed in the ring", () => {
    const a = arena(1, 2);
    a.feintRoll = () => true;
    a.seenAttacks.set("slam", 2);
    const p = place(a.heroes()[0], 1120, 450);
    a.startAttack("slam", p);
    a.settleWarnings();
    const slam = a.raid.warnings[0];
    run(a, (slam.at - slam.startedAt!) * A.feint.turnAt + DT);
    const e = a.raid.warnings.find((w) => w.kind === "eruption")!;
    expect(e).toBeDefined();
    expect(e.chain).toBe(1);
    expect(e.at - e.startedAt!).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
  });
  it("a teaching slam, or one with something else live, never feints", () => {
    const a = arena(1, 2);
    a.feintRoll = () => true;
    const p = place(a.heroes()[0], 1120, 450);
    a.startAttack("slam", p);
    run(a, 1);
    expect(a.raid.warnings.some((w) => w.kind === "slam")).toBe(true);
    expect(a.reads.feints).toBe(0);
  });
  it("plays its reads in a real fight", () => {
    const a = arena(4, 1);
    for (const p of a.heroes()) a.standIn(p.id);
    a.nextAttack = 0;
    for (let t = 0; t < 200 && !a.raid.result; t += DT) {
      for (const p of a.heroes()) if (p.hp > 0) p.hp = 99999;
      a.tick(DT);
      if (a.phase === "intermission") a.phase = "playing";
    }
    expect(a.reads.feints + a.reads.habits).toBeGreaterThan(0);
  });
});

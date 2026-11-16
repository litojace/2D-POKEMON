/**
 * The Spire's zone 2, the Lagoon (floors 11–20): its floors and numbers, a
 * room for the zone (SpireTideArena: the Spire's rules over Tidelotl's
 * arena), the elite on floor 15 with Tidelotl's bubble volleys (the raid
 * honesty rules), and the Ascendant Tidelotl on floor 20 in the same room.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import {
  SpireArena,
  SpireTideArena,
  createSpireArena,
  isSpireArena,
} from "../../apps/server/src/spire";
import { TidewyrmArena } from "../../apps/server/src/raid-tidewyrm";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RAID_FREEZE, RAID_SLOWEST_SPEED } from "../../apps/server/src/raid-ai";
import {
  RAID_TELEGRAPH_FLOOR,
  TIDEWYRM,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import {
  SPIRE_ELITE_MECHANICS,
  SPIRE_FLOORS,
  SPIRE_OFFER,
  SPIRE_PARTY,
  SPIRE_TUNING,
  SPIRE_ZONES,
  spireBlessingOffer,
  spireRewardsOf,
  spireRoster,
} from "../../packages/shared/src/spire";
import { spireCourtWalls } from "../../packages/shared/src/spire-court";

const DT = 1 / RULES.tick;
const EPS = 1e-6;
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

function climb(
  chars: CharacterId[] = ["voltkit"],
  o: { startFloor?: number; ceiling?: number } = {},
) {
  const a = createSpireArena("TIDE1", 2) as SpireTideArena;
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({
    startFloor: o.startFloor ?? 11,
    ceiling: o.ceiling ?? 19,
  });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
function run(
  a: SpireTideArena,
  seconds: number,
  each?: () => void,
  sturdy = true,
) {
  for (let t = 0; t < seconds && !a.raid.result; t += DT) {
    if (sturdy) for (const p of a.heroes()) if (p.hp > 0) p.hp = 9999;
    each?.();
    a.tick(DT);
  }
}
const echoes = (a: SpireTideArena) => a.players.filter((p) => p.echo);
const killEchoes = (a: SpireTideArena) => {
  for (const p of echoes(a)) if (p.hp > 0) p.hp = 0;
};
const toPlaying = (a: SpireTideArena) => {
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
};
/** Beat every wave of the floor in play, then wait for the next floor. */
const clearFloor = (a: SpireTideArena) => {
  for (let i = 0; i < 12 && a.raid.spire!.clearedAt === undefined; i++) {
    run(a, 1.2);
    killEchoes(a);
    run(a, SPIRE_PARTY.waveGap + 0.2);
  }
  run(a, SPIRE_PARTY.cleared + 0.2);
};

describe("Spire floors (zone 2, the Lagoon)", () => {
  const water = new Set<string>(SPIRE_ZONES[2].kin);
  it("is Tidelotl's zone: the lagoon for its boss, Water rosters", () => {
    expect(SPIRE_ZONES[2]).toMatchObject({
      boss: "tidewyrm",
      court: "lagoon",
      element: "Water",
      ascendant: "Ascendant Tidelotl",
    });
    for (const c of SPIRE_ZONES[2].kin) expect(CHARACTERS[c]).toBeDefined();
    expect(
      SPIRE_ZONES[2].kin.filter((c) => CHARACTERS[c].element === "Water")
        .length,
    ).toBeGreaterThanOrEqual(2);
  });
  it("has wave floors 11–14 and 16–19, the elite on 15 and the boss on 20", () => {
    for (const f of [11, 12, 13, 14, 16, 17, 18, 19]) {
      const def = SPIRE_FLOORS[f];
      expect(def.kind, `floor ${f}`).toBe("wave");
      expect(def.zone).toBe(2);
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      expect(def.waves.length).toBeLessThanOrEqual(3);
      const all = def.waves.flat();
      for (const e of all) expect(CHARACTERS[e.character]).toBeDefined();
      // Water-leaning, plus at most one off-element champion.
      const off = new Set(
        all.filter((e) => !water.has(e.character)).map((e) => e.character),
      );
      expect(off.size, `floor ${f} off-element`).toBeLessThanOrEqual(1);
      expect(all.filter((e) => water.has(e.character)).length).toBeGreaterThan(
        all.length / 2,
      );
      expect(new Set(all.map((e) => e.role)).size).toBeGreaterThanOrEqual(2);
      expect(SPIRE_TUNING[f]).toBeDefined();
    }
    expect(SPIRE_FLOORS[15]).toMatchObject({ kind: "elite", zone: 2 });
    expect(SPIRE_FLOORS[15].elite?.mechanic).toBe("bubbles");
    expect(SPIRE_ELITE_MECHANICS.bubbles.attack).toBe("bubbles");
    expect(SPIRE_FLOORS[20]).toMatchObject({
      kind: "boss",
      zone: 2,
      boss: "tidewyrm",
    });
    // Ten short names, none repeated across the Spire.
    const names = Object.values(SPIRE_FLOORS).map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (let f = 11; f <= 20; f++)
      expect(SPIRE_FLOORS[f].name.length).toBeLessThanOrEqual(24);
  });
  it("gets harder floor by floor, each Echo a little stronger than the last", () => {
    const level = { easy: 0, normal: 1, hard: 2 };
    const each = (f: number) =>
      (SPIRE_TUNING[f].power / SPIRE_TUNING[f].armour) *
      (1 + level[SPIRE_TUNING[f].difficulty]);
    const threat = (f: number) => each(f) * SPIRE_FLOORS[f].waves.flat().length;
    // Zone 2's champions (casters, an assassin, a controller) are far
    // deadlier per point than zone 1's Earth front-liners, so its numbers
    // start lower than floor 9's: how hard a floor is comes from the
    // play-test below (floor 11, with no blessings, about as hard as 9).
    for (const f of [12, 13, 14, 16, 17, 18, 19])
      expect(each(f), `floor ${f}`).toBeGreaterThan(
        each(f - 1 === 15 ? 14 : f - 1),
      );
    for (const [a, b] of [
      [11, 12],
      [12, 13],
      [16, 17],
      [17, 18],
      [18, 19],
    ])
      expect(threat(b), `floor ${b} over ${a}`).toBeGreaterThan(threat(a));
    // The elite and the boss floors keep their own clocks.
    expect(SPIRE_TUNING[15].limit).toBe(SPIRE_TUNING[5].limit);
    expect(SPIRE_TUNING[20].limit).toBe(SPIRE_TUNING[10].limit);
  });
  it("loads every champion of the zone before the climb (the roster)", () => {
    const roster = spireRoster(2);
    for (const f of Object.values(SPIRE_FLOORS).filter((f) => f.zone === 2))
      for (const e of [
        ...f.waves.flat(),
        ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
      ])
        expect(roster).toContain(e.character);
    // Zone 1's roster is its own.
    expect(spireRoster(1)).not.toContain("mossloth");
  });
  it("pays more on the elite and the boss floor, and a title on floor 20", () => {
    const coins = (f: number) =>
      spireRewardsOf(f)
        .filter((r) => r.kind === "coins")
        .reduce((n, r) => n + r.amount, 0);
    for (let f = 11; f <= 20; f++) expect(coins(f)).toBeGreaterThan(0);
    for (const f of [11, 12, 13, 14, 16, 17, 18, 19]) {
      expect(coins(15)).toBeGreaterThan(coins(f));
      expect(coins(20)).toBeGreaterThan(coins(f));
    }
    expect(spireRewardsOf(20).find((r) => r.kind === "title")?.item).toBe(
      "Tidecaller of the Spire",
    );
  });
});

describe("a zone-2 room", () => {
  it("is the Spire's rules over Tidelotl's arena, climbing 11 → 20 only", () => {
    const a = createSpireArena("Z2", 2);
    expect(a).toBeInstanceOf(SpireTideArena);
    expect(a).toBeInstanceOf(TidewyrmArena);
    expect(isSpireArena(a)).toBe(true);
    expect(a.zone).toBe(2);
    expect(a.raid.boss).toBe("tidewyrm");
    expect(a.raid.spire).toMatchObject({
      zone: 2,
      floor: 11,
      startFloor: 11,
      ceiling: 20,
    });
    // The server's numbers are kept inside the zone.
    a.configureSpire({ startFloor: 1, ceiling: 40 });
    expect(a.raid.spire).toMatchObject({ startFloor: 11, ceiling: 20 });
    // Zone 1's room never climbs past its boss.
    const one = createSpireArena("Z1", 1);
    expect(one).toBeInstanceOf(SpireArena);
    expect(one.raid.spire).toMatchObject({ zone: 1, floor: 1, ceiling: 10 });
    one.configureSpire({ startFloor: 11, ceiling: 20 });
    expect(one.raid.spire).toMatchObject({ startFloor: 10, ceiling: 10 });
    // A plain raid is no climb.
    expect(isSpireArena(createRaidArena("R", "tidewyrm"))).toBe(false);
  });
  it("fights its wave floors on the Spire's court: no islands, no lagoon", () => {
    seeded(201);
    const a = climb();
    expect(a.raid.spire).toMatchObject({ floor: 11, kind: "wave", zone: 2 });
    expect(a.raid.spire!.roster).toEqual(spireRoster(2));
    expect(a.raid.islands).toBeUndefined();
    expect(a.arenaId).toBe("classic");
    expect(a.walls()).toBe(spireCourtWalls({ floor: 11, kind: "wave" }));
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a)[0]?.character).toBe(
      SPIRE_FLOORS[11].waves[0][0].character,
    );
    // Climbs on to 12 with blessing cards, as in zone 1.
    clearFloor(a);
    expect(a.raid.spire!.floor).toBe(12);
    expect(a.phase).toBe("intermission");
    expect(a.raid.spire!.offers.p0).toHaveLength(SPIRE_OFFER);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([11]);
    expect(a.spire.pending[0].startFloor).toBe(11);
  });
  it("ends at floor 19 for a party without a Tidelotl clear (the server's ceiling)", () => {
    seeded(202);
    const a = climb(["voltkit"], { startFloor: 19, ceiling: 19 });
    toPlaying(a);
    clearFloor(a);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.spire!.best).toBe(19);
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
  });
  it("climbs again from floor 11 after a defeat", () => {
    seeded(203);
    const a = climb(["voltkit"], { startFloor: 11, ceiling: 20 });
    toPlaying(a);
    run(a, 1);
    for (let i = 0; i < 400 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, echoes(a).find((e) => e.hp > 0)?.id ?? "");
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Climb again from floor 11/);
    a.retry();
    expect(a.raid.spire).toMatchObject({ floor: 11, startFloor: 11 });
  });
});

describe("the elite (floor 15): Tidelotl's bubble volleys", () => {
  it("is an Echo captain with a boss bar that plays only bubble volleys", () => {
    seeded(211);
    const a = climb(["voltkit"], { startFloor: 15 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const elite = a.boss()!;
    expect(elite).toMatchObject({
      echo: true,
      elite: true,
      team: 1,
      character: "glacelle",
      name: "Echo Captain Glacelle",
    });
    expect(a.raid.bossId).toBe(elite.id);
    expect(a.raid.message).toMatch(/Tidelotl's bubble volleys/);
    const kinds = new Set<string>();
    let flew = 0;
    run(a, 20, () => {
      a.raid.warnings.forEach((w) => kinds.add(w.kind));
      flew = Math.max(flew, a.raid.bubbles?.length ?? 0);
    });
    expect([...kinds]).toEqual(["bubbles"]);
    // The volley really flies (from the captain, not from a lagoon).
    expect(flew).toBeGreaterThanOrEqual(7);
    // No dives, no islands, never under water.
    expect(a.raid.submerged).toBeFalsy();
    expect(a.raid.islands).toBeUndefined();
    elite.hp = a.raid.maxHp * 0.45;
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a).filter((p) => !p.elite && p.hp > 0).length).toBe(1);
  });
  it("hurts and roots a raider a bubble touches, scaled like any Echo hit", () => {
    seeded(212);
    const a = climb(["voltkit"], { startFloor: 15 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const me = a.heroes()[0];
    const elite = a.boss()!;
    me.hp = 500;
    a.raid.bubbles = [
      { id: 999, x: me.x, y: me.y, vx: 0, vy: 0, until: a.time + 2 },
    ];
    a.tick(DT);
    expect(500 - me.hp).toBeCloseTo(
      TIDEWYRM.bubbles.damage * SPIRE_TUNING[15].power,
      4,
    );
    expect(a.raid.bubbles).toEqual([]);
    expect(elite.hp).toBeGreaterThan(0);
  });
  it("staggers when hit enough, and reels", () => {
    seeded(213);
    const a = climb(["voltkit"], { startFloor: 15 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const elite = a.boss()!;
    elite.hp = 99999;
    a.raid.maxHp = 99999;
    for (let i = 0; i < 150 && a.raid.staggerUntil <= a.time; i++) {
      a.damage(elite, 30, "p0");
      a.tick(DT);
    }
    expect(a.raid.staggerUntil).toBeGreaterThan(a.time);
    run(a, 0.1);
    expect(elite.statuses.some((s) => s.kind === "stun")).toBe(true);
  });
  it.each([1, 4])(
    "keeps the raid honesty rules with %i raider(s) (floor, freeze, one at a time, a way out)",
    (size) => {
      seeded(220 + size);
      const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
      const a = climb(team.slice(0, size), { startFloor: 15 });
      toPlaying(a);
      const problems: string[] = [];
      const seen = new Map<number, RaidWarning>();
      let wasLive = 0;
      run(a, 90, () => {
        const elite = a.boss();
        if (elite) elite.hp = Math.max(elite.hp, a.raid.maxHp * 0.6);
        for (const w of a.raid.warnings) {
          if (seen.has(w.id)) continue;
          seen.set(w.id, w);
          if (w.followUp) continue;
          const shown = w.at - (w.startedAt ?? w.at);
          // (One volley at a time: the bubbles are dodged, not the fan, so
          // a spot is only needed when two attacks share the court.)
          if (
            a.raid.warnings.length + (a.raid.bubbles?.length ? 1 : 0) > 1 &&
            !a.safeSpotExists()
          )
            problems.push(`${w.kind} leaves no safe spot`);
          if (shown < RAID_TELEGRAPH_FLOOR - EPS)
            problems.push(`${w.kind} on screen ${shown.toFixed(2)} s`);
          if (w.lockAt !== undefined && w.lockAt > w.at - RAID_FREEZE + EPS)
            problems.push(`${w.kind} locks late`);
          // A raider inside the fan can step out of it sideways at the
          // slowest speed before the first bubble reaches them.
          const aim = Math.atan2(w.ty - w.y, w.tx - w.x),
            spread = w.spread ?? TIDEWYRM.bubbles.spread / 2;
          for (const p of a.heroes()) {
            const d = Math.hypot(p.x - w.x, p.y - w.y);
            const off = Math.abs(
              Math.atan2(
                Math.sin(Math.atan2(p.y - w.y, p.x - w.x) - aim),
                Math.cos(Math.atan2(p.y - w.y, p.x - w.x) - aim),
              ),
            );
            if (off > spread || d > w.radius) continue;
            const out = d * Math.sin(spread - off) + RULES.radius;
            const reach = shown + Math.max(0, d - 60) / TIDEWYRM.bubbles.speed;
            if (out / RAID_SLOWEST_SPEED > reach)
              problems.push(`${w.kind} can't be left in time`);
          }
        }
        const live = a.liveThreats();
        if (live > 1 && live > wasLive) problems.push(`${live} attacks live`);
        wasLive = live;
      });
      expect(problems.slice(0, 8)).toEqual([]);
      expect(seen.size).toBeGreaterThan(5);
    },
    60_000,
  );
});

describe("the boss floor (floor 20: the Ascendant Tidelotl, in the lagoon)", () => {
  const toTwenty = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 19, ceiling: 20 });
    toPlaying(a);
    clearFloor(a);
    return a;
  };
  it("briefs the Ascendant in the same room, in the lagoon, then the blessings, then the fight", () => {
    seeded(231);
    const a = toTwenty();
    const s = a.raid.spire!;
    expect(a.raid.result).toBeNull();
    expect(s).toMatchObject({ floor: 20, kind: "boss", best: 19, zone: 2 });
    expect(a.phase).toBe("briefing");
    expect(a.raid.variant).toBe("ascendant");
    expect(a.raid.name).toBe("Ascendant Tidelotl");
    // Its raid's court: the lagoon and its islands, no Spire walls.
    expect(a.arenaId).toBe("lagoon");
    expect(a.raid.islands?.length).toBe(TIDEWYRM.islands.length);
    expect(a.walls()).toEqual([]);
    const boss = a.boss()!;
    expect(boss).toMatchObject({ raidBoss: true, name: "Ascendant Tidelotl" });
    expect(boss.hp).toBe(a.raid.maxHp);
    expect(a.raid.maxHp).toBeGreaterThan(1);
    expect(a.raid.gilded).toBe(false);
    expect(echoes(a)).toEqual([]);
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("intermission");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    // Tidelotl's deck, with the Ascendant's own moves.
    const kinds = new Set<string>();
    run(a, 90, () => a.raid.warnings.forEach((w) => kinds.add(w.kind)));
    expect(kinds.has("eruption")).toBe(false);
    expect([...kinds].some((k) => k === "breaker" || k === "geyser")).toBe(
      true,
    );
    expect(kinds.size).toBeGreaterThan(2);
  });
  it("goes on without a raider who never reads the briefing", () => {
    seeded(232);
    const a = toTwenty();
    run(a, SPIRE_PARTY.bossBriefing + 0.2);
    expect(a.phase).toBe("intermission");
  });
  it("counts blessings in the boss fight", () => {
    seeded(233);
    const a = toTwenty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    const boss = a.boss()!,
      p = a.heroes()[0];
    a.raid.submerged = false;
    const hit = (target: Fighter, from: string) => {
      const hp = (target.hp = 9999);
      a.damage(target, 40, from);
      return hp - target.hp;
    };
    s.blessings.p0 = {};
    a.raid.exposedUntil = a.time + 99;
    const plain = hit(boss, p.id),
      taken = hit(p, boss.id);
    expect(plain).toBeGreaterThan(0);
    s.blessings.p0 = { keen: 1, stoneskin: 1 };
    expect(hit(boss, p.id)).toBeCloseTo(plain * 1.1, 4);
    expect(hit(p, boss.id)).toBeCloseTo(taken * 0.9, 4);
  });
  it("saves the clear as Spire floor 20, then ends the climb: zone 2 conquered", () => {
    seeded(234);
    const a = toTwenty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    run(a, 5);
    a.spire.pending = [];
    a.raid.submerged = false;
    a.boss()!.hp = 0;
    run(a, 0.1);
    expect(s.clearedAt).toBeDefined();
    expect(s.best).toBe(20);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([20]);
    expect(a.raid.warnings).toEqual([]);
    run(a, SPIRE_PARTY.cleared + 0.2);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.message).toMatch(/Zone 2 conquered/);
    a.retry();
    expect(s).toMatchObject({ startFloor: 19, floor: 19, blessings: {} });
    expect(a.raid.variant).toBeUndefined();
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    expect(a.raid.islands).toBeUndefined();
  });
  it("loses the climb on a defeat by the Ascendant", () => {
    seeded(235);
    const a = toTwenty();
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", a.raid.spire!.offers.p0[0]);
    toPlaying(a);
    (a as unknown as { selfUsed: boolean }).selfUsed = true;
    for (let i = 0; i < 300 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, a.boss()!.id);
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Ascendant Tidelotl stands unbroken/);
  });
});

/**
 * Play-test by simulation, as zone 1's: a Normal bot raider alone, with the
 * blessings it would hold by then on a climb from floor 11 (none on 11).
 */
describe("play-test (bot raiders vs zone 2)", () => {
  function playFloor(floor: number, seed: number) {
    seeded(seed * 7919);
    const a = createSpireArena("SIM" + seed, 2);
    a.add("p0", "P0", "voltkit");
    a.configureSpire({ startFloor: floor, ceiling: floor });
    a.start();
    const mine = (a.raid.spire!.blessings.p0 = {} as Record<string, number>);
    for (let f = 12; f <= floor; f++) {
      const offer = spireBlessingOffer(a.spire.seed, f, 0, mine)[0];
      mine[offer] = (mine[offer] ?? 0) + 1;
    }
    (a as unknown as { applyBlessings(p: Fighter): void }).applyBlessings(
      a.heroes()[0],
    );
    a.standIn("p0");
    a.acknowledgeInstructions("p0");
    for (let t = 0; t < 400 && !a.raid.result; t += DT) a.tick(DT);
    return a.raid.spire!.best >= floor;
  }
  it("floor 11 is often cleared solo with no blessings; floor 19 less often, but sometimes", () => {
    const rate = (floor: number) =>
      [1, 2, 3, 4, 5, 6].filter((s) => playFloor(floor, s)).length / 6;
    const eleven = rate(11),
      nineteen = rate(19);
    // (Zone 1: floor 9 is cleared about a third of the time, floor 1 always.)
    expect(eleven).toBeGreaterThanOrEqual(0.5);
    expect(eleven).toBeLessThan(1);
    expect(nineteen).toBeGreaterThan(0);
    expect(nineteen).toBeLessThan(eleven);
  }, 180_000);
});

/**
 * The Spire on the server (apps/server/src/spire.ts): floors, Echoes, the
 * elite, the floor flow, the guards a team-1 champion needs in a raid room,
 * and a play-test by simulation.
 */
import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  blankInput,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import { SpireArena } from "../../apps/server/src/spire";
import { RaidArena } from "../../apps/server/src/raid";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import {
  RAID_FREEZE,
  RAID_SLOWEST_SPEED,
  raidShapeHits,
} from "../../apps/server/src/raid-ai";
import {
  RAID_TELEGRAPH_FLOOR,
  isRaider,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import {
  SPIRE_BUILT_TOP,
  SPIRE_FLOORS,
  SPIRE_OFFER,
  SPIRE_PARTY,
  SPIRE_REWARDS,
  SPIRE_TUNING,
  SPIRE_ZONES,
  spireCheckpoint,
  spireCourtCap,
  spireRoster,
  spireStartFrom,
  spireWaves,
  spireBlessingOffer as blessingOffer,
} from "../../packages/shared/src/spire";

const DT = 1 / RULES.tick;
const EPS = 1e-6;
/** Repeatable runs: the climb seeds itself through Web Crypto. */
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

type Inner = SpireArena & {
  waveIndex: number;
  queue: unknown[];
};
function climb(
  chars: CharacterId[] = ["voltkit"],
  o: { startFloor?: number; ceiling?: number } = {},
) {
  const a = new SpireArena("SPIRE1") as Inner;
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({ startFloor: o.startFloor ?? 1, ceiling: o.ceiling ?? 9 });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
/** Tick for `seconds`, keeping raiders standing unless told otherwise. */
function run(a: SpireArena, seconds: number, each?: () => void, sturdy = true) {
  for (let t = 0; t < seconds && !a.raid.result; t += DT) {
    if (sturdy) for (const p of a.heroes()) if (p.hp > 0) p.hp = 9999;
    each?.();
    a.tick(DT);
  }
}
const echoes = (a: SpireArena) => a.players.filter((p) => p.echo);
const killEchoes = (a: SpireArena) => {
  for (const p of echoes(a)) if (p.hp > 0) p.hp = 0;
};
/** Run until the court is in play (the countdown is over). */
const toPlaying = (a: SpireArena) => {
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
};

describe("Spire floors (zone 1)", () => {
  const earth = new Set<string>(SPIRE_ZONES[1].kin);
  it("has wave floors 1–4 and 6–9 of two or three waves, the elite on 5 and the boss hook on 10", () => {
    for (const f of [1, 2, 3, 4, 6, 7, 8, 9]) {
      const def = SPIRE_FLOORS[f];
      expect(def.kind, `floor ${f}`).toBe("wave");
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      expect(def.waves.length).toBeLessThanOrEqual(3);
      // Earth-leaning, plus at most one off-element champion.
      const all = def.waves.flat();
      const off = new Set(
        all.filter((e) => !earth.has(e.character)).map((e) => e.character),
      );
      expect(off.size, `floor ${f} off-element`).toBeLessThanOrEqual(1);
      expect(all.filter((e) => earth.has(e.character)).length).toBeGreaterThan(
        all.length / 2,
      );
      // Roles mixed on every floor.
      expect(new Set(all.map((e) => e.role)).size).toBeGreaterThanOrEqual(2);
      expect(SPIRE_TUNING[f]).toBeDefined();
    }
    expect(SPIRE_FLOORS[5].kind).toBe("elite");
    expect(SPIRE_FLOORS[5].elite?.mechanic).toBe("eruption");
    expect(SPIRE_FLOORS[10].kind).toBe("boss");
    expect(SPIRE_BUILT_TOP).toBe(9);
  });
  it("gets harder floor by floor in the tuning table", () => {
    const level = { easy: 0, normal: 1, hard: 2 };
    const threat = (f: number) =>
      (SPIRE_TUNING[f].power / SPIRE_TUNING[f].armour) *
      (1 + level[SPIRE_TUNING[f].difficulty]) *
      SPIRE_FLOORS[f].waves.flat().length;
    for (const [a, b] of [
      [1, 2],
      [2, 3],
      [6, 7],
      [7, 8],
      [8, 9],
    ])
      expect(threat(b), `floor ${b} over ${a}`).toBeGreaterThan(threat(a));
  });
  it("loads every champion of the zone before the climb (the roster)", () => {
    const roster = spireRoster(1);
    for (const f of Object.values(SPIRE_FLOORS))
      for (const e of [
        ...f.waves.flat(),
        ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
      ])
        expect(roster).toContain(e.character);
  });
  it("adds a wave for big parties and keeps at most six fighters on the court", () => {
    expect(spireWaves(3, 1).length).toBe(3);
    expect(spireWaves(3, 3).length).toBe(4);
    for (let n = 1; n <= 4; n++)
      expect(n + spireCourtCap(n)).toBeLessThanOrEqual(SPIRE_PARTY.court);
  });
  it("keeps SPIRE_REWARDS identical to the database's rows", () => {
    const sql = readFileSync(
      "supabase/migrations/20261116120000_spire.sql",
      "utf8",
    );
    const block = sql.slice(
      sql.indexOf("insert into public.arena_spire_rewards"),
      sql.indexOf(";", sql.indexOf("insert into public.arena_spire_rewards")),
    );
    const rows = [
      ...block.matchAll(/\((\d+), (\d+), '(\w+)', '([^']+)', (\d+)\)/g),
    ].map((m) => ({
      season: Number(m[1]),
      floor: Number(m[2]),
      kind: m[3],
      item: m[4],
      amount: Number(m[5]),
    }));
    expect(rows).toEqual(SPIRE_REWARDS);
    // Every title it gives exists in the titles list.
    for (const r of SPIRE_REWARDS.filter((r) => r.kind === "title"))
      expect(sql).toContain(`('${r.item}',`);
  });
});

describe("where a party climbs", () => {
  const m = (checkpoint: number, cleared = true) => ({
    checkpoint,
    clears: cleared ? { grumblecrag: 1 } : {},
  });
  it("starts from the lowest checkpoint among the party", () => {
    expect(spireStartFrom([m(1), m(11)]).startFloor).toBe(1);
    expect(spireCheckpoint(9)).toBe(1);
    expect(spireCheckpoint(11)).toBe(11);
    expect(spireCheckpoint(10)).toBe(1);
  });
  it("needs a Cragmuff clear from every climber", () => {
    expect(spireStartFrom([m(1), m(1, false)])).toMatchObject({ ok: false });
    expect(spireStartFrom([m(1)])).toMatchObject({
      ok: true,
      ceiling: SPIRE_BUILT_TOP,
    });
  });
  it("never starts above what is built", () => {
    expect(spireStartFrom([m(11)]).startFloor).toBeLessThanOrEqual(
      SPIRE_BUILT_TOP,
    );
  });
});

describe("a climb", () => {
  it("goes briefing → countdown (no cards on the first floor) → waves", () => {
    seeded(11);
    const a = new SpireArena("SPIRE2");
    a.add("p0", "Ana", "voltkit");
    a.configureSpire({ startFloor: 1, ceiling: 9 });
    a.start();
    expect(a.phase).toBe("briefing");
    expect(a.raid.spire!.floor).toBe(1);
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("countdown");
    expect(a.raid.spire!.offers).toEqual({});
    toPlaying(a);
    a.tick(DT);
    // A harmless ring first; the Echo steps out of it 0.8 s later.
    expect(a.raid.spire!.spawns.length).toBe(1);
    expect(echoes(a)).toEqual([]);
    run(a, SPIRE_PARTY.materialise + 0.1);
    const [e] = echoes(a);
    expect(e).toMatchObject({ echo: true, team: 1 });
    expect(e.character).toBe(SPIRE_FLOORS[1].waves[0][0].character);
    expect(a.bots.has(e.id)).toBe(true);
    expect(a.heroes().map((p) => p.id)).toEqual(["p0"]);
    expect(
      Math.hypot(e.x - a.heroes()[0].x, e.y - a.heroes()[0].y),
    ).toBeGreaterThan(380);
  });
  it("brings the next wave when one is beaten, then clears the floor and saves it", () => {
    seeded(12);
    const a = climb();
    toPlaying(a);
    run(a, 1);
    expect(a.raid.spire!.wave).toBe(1);
    killEchoes(a);
    run(a, SPIRE_PARTY.waveGap + 0.2);
    expect(a.raid.spire!.wave).toBe(2);
    run(a, 1);
    expect(echoes(a).filter((p) => p.hp > 0).length).toBe(2);
    killEchoes(a);
    run(a, 0.2);
    const s = a.raid.spire!;
    expect(s.clearedAt).toBeDefined();
    expect(s.best).toBe(1);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([1]);
    expect(a.spire.pending[0].players).toEqual([
      { accountId: "p0", character: "voltkit" },
    ]);
    expect(s.saves).toEqual([{ floor: 1, status: "saving" }]);
    // Beaten Echoes fade and leave the room.
    run(a, SPIRE_PARTY.fade + 0.1);
    expect(echoes(a)).toEqual([]);
    expect([...a.bots.keys()]).toEqual([]);
    // On to floor 2, in place: three blessing cards first.
    run(a, SPIRE_PARTY.cleared);
    expect(a.phase).toBe("intermission");
    expect(s.floor).toBe(2);
    expect(s.offers.p0.length).toBe(SPIRE_OFFER);
    expect(a.pickRite("p0", s.offers.p0[0])).toBe(true);
    expect(Object.values(s.blessings.p0)).toEqual([1]);
    run(a, 1.1);
    expect(a.phase).toBe("countdown");
    toPlaying(a);
    expect(a.raid.result).toBeNull();
  });
  it("takes the first card when time runs out", () => {
    seeded(13);
    const a = climb();
    toPlaying(a);
    for (let wave = 0; wave < 2; wave++) {
      run(a, 1);
      killEchoes(a);
      run(a, SPIRE_PARTY.waveGap + 0.2);
    }
    run(a, SPIRE_PARTY.cleared + 0.5);
    const first = a.raid.spire!.offers.p0[0];
    run(a, 21);
    expect(a.raid.spire!.blessings.p0[first]).toBe(1);
  });
  it("ends the climb on a defeat, and climbs again from the checkpoint without blessings", () => {
    seeded(14);
    const a = climb(["voltkit"], { startFloor: 1 });
    a.raid.spire!.best = 0;
    toPlaying(a);
    run(a, 1);
    // A blessing from an earlier floor, then the raider falls.
    a.raid.spire!.blessings.p0 = { keen: 2 };
    for (let i = 0; i < 400 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, echoes(a).find((e) => e.hp > 0)?.id ?? "");
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.phase).toBe("finished");
    // Echo brains are gone (a room with bots can't go back to its lobby).
    expect(a.bots.size).toBe(0);
    a.retry();
    expect(a.raid.spire!.floor).toBe(1);
    expect(a.raid.spire!.blessings).toEqual({});
    expect(a.raid.result).toBeNull();
    expect(a.phase).toBe("countdown");
  });
  it("loses the floor when its time runs out", () => {
    seeded(15);
    const a = climb();
    toPlaying(a);
    run(a, SPIRE_TUNING[1].limit + 1);
    expect(a.raid.result).toBe("defeat");
  });
  it("finishes as a victory at the top of what is built (floor 10 is a hook)", () => {
    seeded(16);
    const a = climb(["voltkit"], { startFloor: 9, ceiling: 9 });
    toPlaying(a);
    for (let i = 0; i < 12 && !a.raid.spire!.clearedAt; i++) {
      run(a, 1.2);
      killEchoes(a);
      run(a, SPIRE_PARTY.waveGap + 0.2);
    }
    run(a, SPIRE_PARTY.cleared + 0.2);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.spire!.best).toBe(9);
  });
});

describe("Echoes in a raid room (the guards)", () => {
  it("are never heroes, never go down as raiders, and keep their own brain", () => {
    seeded(21);
    const a = climb(["voltkit", "terradon"]);
    toPlaying(a);
    run(a, 1.2);
    const e = echoes(a)[0];
    expect(isRaider(e)).toBe(false);
    expect(a.heroes().every((p) => !p.echo)).toBe(true);
    // A beaten Echo isn't a downed raider (no revive circle, no down count).
    const downs = a.raid.downs;
    a.damage(e, 9999, "p0");
    expect(e.hp).toBe(0);
    expect(a.raid.downed[e.id]).toBeUndefined();
    expect(a.raid.downs).toBe(downs);
    // The stand-in brain leaves an Echo's input alone.
    const input = { ...blankInput(), dx: 0.3, dy: -0.4 };
    const live = echoes(a).find((p) => p.hp > 0) ?? e;
    live.hp = 100;
    // Even with a raid warning under it (raider dodging is not for Echoes).
    a.raid.warnings.push({
      id: 999,
      kind: "eruption",
      x: live.x,
      y: live.y,
      tx: live.x,
      ty: live.y,
      radius: 100,
      at: a.time + 1,
      startedAt: a.time,
    });
    expect(a.botInput(live, { ...input })).toEqual(input);
    a.raid.warnings = [];
    // A snapshot with Echo brains is still not a bot match.
    expect(a.bots.size).toBeGreaterThan(0);
    expect(a.snapshot().vsBot).toBeNull();
  });
  it("can't hurt each other, and raiders can't hurt raiders", () => {
    seeded(22);
    const a = climb(["voltkit", "terradon"]);
    toPlaying(a);
    run(a, 1.2);
    a.tick(DT);
    const [e] = echoes(a);
    const hp = a.heroes()[1].hp;
    a.damage(a.heroes()[1], 30, "p0");
    expect(a.heroes()[1].hp).toBe(hp);
    if (echoes(a)[1]) {
      const other = echoes(a)[1];
      const before = other.hp;
      a.damage(other, 30, e.id);
      expect(other.hp).toBe(before);
    }
  });
  it("scales Echo damage both ways by floor and party", () => {
    seeded(23);
    const a = climb();
    toPlaying(a);
    run(a, 1.2);
    const e = echoes(a)[0];
    const me = a.heroes()[0];
    me.hp = 200;
    a.damage(me, 10, e.id);
    expect(200 - me.hp).toBeCloseTo(10 * SPIRE_TUNING[1].power, 5);
    const before = e.hp;
    a.damage(e, 10, me.id);
    expect(before - e.hp).toBeCloseTo(10 * SPIRE_TUNING[1].armour, 5);
  });
  it("leaves a plain raid alone (no Spire, Echo guards don't change it)", () => {
    const r = createRaidArena("PLAIN", "grumblecrag");
    r.add("p0", "Ana", "voltkit");
    r.start();
    expect(r.spire).toBeUndefined();
    expect(r.heroes().map((p) => p.id)).toEqual(["p0"]);
    expect(r.boss()?.raidBoss).toBe(true);
    expect(r).toBeInstanceOf(RaidArena);
  });
  it("ends the climb when every raider has left", () => {
    seeded(24);
    const a = climb();
    toPlaying(a);
    run(a, 1);
    a.heroes()[0].out = true;
    run(a, 0.2);
    expect(a.raid.result).toBe("defeat");
  });
});

describe("the elite (floor 5)", () => {
  it("is an Echo captain with a boss bar, its borrowed eruptions and escorts at half health", () => {
    seeded(31);
    const a = climb(["voltkit"], { startFloor: 5 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const elite = a.boss()!;
    expect(elite).toMatchObject({ echo: true, elite: true, team: 1 });
    expect(elite.raidBoss).toBeFalsy();
    expect(a.raid.bossId).toBe(elite.id);
    expect(a.raid.maxHp).toBe(elite.hp);
    const kinds = new Set<string>();
    run(a, 20, () => a.raid.warnings.forEach((w) => kinds.add(w.kind)));
    expect([...kinds]).toEqual(["eruption"]);
    elite.hp = a.raid.maxHp * 0.45;
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a).filter((p) => !p.elite && p.hp > 0).length).toBe(1);
  });
  it("staggers like a boss when hit enough, and reels (stunned)", () => {
    seeded(32);
    const a = climb(["voltkit"], { startFloor: 5 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const elite = a.boss()!;
    elite.hp = 99999;
    a.raid.maxHp = 99999;
    for (let i = 0; i < 60 && a.raid.staggerUntil <= a.time; i++) {
      a.damage(elite, 30, "p0");
      a.tick(DT);
    }
    expect(a.raid.staggerUntil).toBeGreaterThan(a.time);
    run(a, 0.1);
    expect(elite.statuses.some((s) => s.kind === "stun")).toBe(true);
  });
  it.each([1, 4])(
    "keeps the raid honesty rules with %i raider(s) (floor, freeze, one at a time, a safe spot)",
    (size) => {
      seeded(33 + size);
      const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
      const a = climb(team.slice(0, size), { startFloor: 5 });
      toPlaying(a);
      const problems: string[] = [];
      const seen = new Map<number, RaidWarning>();
      let wasLive = 0;
      let before = new Set<number>();
      run(a, 90, () => {
        const elite = a.boss();
        if (elite) elite.hp = Math.max(elite.hp, a.raid.maxHp * 0.6);
        // As in raid-fairness.test.ts: a warning born as another lands is
        // its follow-up (a chained eruption under its raider).
        const now = new Set(a.raid.warnings.map((w) => w.id));
        const landed = [...before].some((id) => !now.has(id));
        before = now;
        for (const w of a.raid.warnings) {
          if (seen.has(w.id)) continue;
          seen.set(w.id, w);
          if (landed || w.followUp) continue;
          if (!a.safeSpotExists())
            problems.push(`${w.kind} leaves no safe spot`);
          if (w.at - (w.startedAt ?? w.at) < RAID_TELEGRAPH_FLOOR - EPS)
            problems.push(
              `${w.kind} on screen ${(w.at - w.startedAt!).toFixed(2)} s`,
            );
          if (w.lockAt !== undefined && w.lockAt > w.at - RAID_FREEZE + EPS)
            problems.push(`${w.kind} locks late`);
          // A raider standing inside it can walk out at the slowest speed.
          for (const p of a.heroes())
            if (
              raidShapeHits(w, p.x, p.y, RULES.radius) &&
              (w.radius + RULES.radius) / RAID_SLOWEST_SPEED >
                w.at - (w.startedAt ?? w.at)
            )
              problems.push(`${w.kind} can't be left in time`);
        }
        // At most one of its attacks live at once.
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

/**
 * Play-test by simulation: one Normal bot raider (the raids' stand-in
 * brain, which dodges warnings) climbs alone, with an average champion,
 * holding the blessings it would have picked by then (the first card each
 * time). Floor 1 is cleared nearly always; floor 9 is the hardest.
 */
describe("play-test (bot raiders vs the floors)", () => {
  function playFloor(floor: number, chars: CharacterId[], seed: number) {
    seeded(seed * 9973);
    const a = new SpireArena("SIM" + seed);
    chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
    a.configureSpire({ startFloor: floor, ceiling: floor });
    a.start();
    for (const [seat, p] of a.heroes().entries()) {
      const mine = (a.raid.spire!.blessings[p.id] = {} as Record<
        string,
        number
      >);
      for (let f = 2; f <= floor; f++) {
        const offer = spireOffer(a, f, seat, mine);
        mine[offer] = (mine[offer] ?? 0) + 1;
      }
      (a as unknown as { applyBlessings(p: Fighter): void }).applyBlessings(p);
    }
    for (const p of a.heroes()) a.standIn(p.id);
    for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
    for (let t = 0; t < 400 && !a.raid.result; t += DT) a.tick(DT);
    return {
      cleared: a.raid.spire!.best >= floor,
      seconds: a.raid.spire!.climbSeconds,
    };
  }
  const spireOffer = (
    a: SpireArena,
    f: number,
    seat: number,
    mine: Record<string, number>,
  ) => blessingOffer(a.spire.seed, f, seat, mine)[0];
  it("floor 1 is cleared solo every time; floor 9 less often; and floors take longer", () => {
    const rate = (floor: number) => {
      const runs = [1, 2, 3, 4, 5, 6].map((s) =>
        playFloor(floor, ["voltkit"], s),
      );
      return {
        rate: runs.filter((r) => r.cleared).length / runs.length,
        seconds:
          runs.filter((r) => r.cleared).reduce((n, r) => n + r.seconds, 0) /
          Math.max(1, runs.filter((r) => r.cleared).length),
      };
    };
    const one = rate(1),
      five = rate(5),
      nine = rate(9);
    expect(one.rate).toBe(1);
    expect(five.rate).toBeGreaterThan(0.3);
    expect(nine.rate).toBeGreaterThan(0);
    expect(nine.rate).toBeLessThan(one.rate);
    expect(nine.seconds).toBeGreaterThan(one.seconds);
  }, 120_000);
});

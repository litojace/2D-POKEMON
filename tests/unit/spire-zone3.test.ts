/**
 * The Spire's zone 3, the Lantern Yard (floors 21–30): its floors and
 * numbers, a room for the zone (SpireGloomArena: the Spire's rules over
 * Inkpurr's arena), the elite on floor 25 with Inkpurr's Grasping Hands (the
 * raid honesty rules, and a lit tile always within reach), and the
 * Ascendant Inkpurr on floor 30 in the same room, in the Lantern Yard.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  blocked,
  type CharacterId,
  type Fighter,
  type Snapshot,
} from "@arena/shared";
import {
  SpireGloomArena,
  SpireTideArena,
  createSpireArena,
  isSpireArena,
} from "../../apps/server/src/spire";
import { GloomshadeArena } from "../../apps/server/src/raid-gloomshade";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RAID_SLOWEST_SPEED } from "../../apps/server/src/raid-ai";
import {
  GLOOMSHADE,
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  handsTileDark,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import {
  SPIRE_BUILT_TOP,
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
import { raidTargets } from "../../apps/client/src/raid-targets";
import { spireCue } from "../../apps/client/src/spire-battle";
import {
  hasSpireSummitArena,
  spireSummitFloorId,
  spireSummitFloorOf,
} from "../../apps/client/src/spire-court-rig";

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
  const a = createSpireArena("GLOOM1", 3) as SpireGloomArena;
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({
    startFloor: o.startFloor ?? 21,
    ceiling: o.ceiling ?? 29,
  });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
function run(
  a: SpireGloomArena,
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
const echoes = (a: SpireGloomArena) => a.players.filter((p) => p.echo);
const killEchoes = (a: SpireGloomArena) => {
  for (const p of echoes(a)) if (p.hp > 0) p.hp = 0;
};
const toPlaying = (a: SpireGloomArena) => {
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
};
/** Beat every wave of the floor in play, then wait for the next floor. */
const clearFloor = (a: SpireGloomArena) => {
  for (let i = 0; i < 12 && a.raid.spire!.clearedAt === undefined; i++) {
    run(a, 1.2);
    killEchoes(a);
    run(a, SPIRE_PARTY.waveGap + 0.2);
  }
  run(a, SPIRE_PARTY.cleared + 0.2);
};
/** What the client receives (enough of it for the client's helpers). */
const snap = (a: SpireGloomArena) => a.snapshot() as unknown as Snapshot;

describe("Spire floors (zone 3, the Lantern Yard)", () => {
  const shadow = new Set<string>(SPIRE_ZONES[3].kin);
  it("is Inkpurr's zone: the Lantern Yard for its boss, Shadow rosters", () => {
    expect(SPIRE_ZONES[3]).toMatchObject({
      id: 3,
      name: "Lantern Yard",
      boss: "gloomshade",
      court: "lantern-yard",
      element: "Shadow",
      ascendant: "Ascendant Inkpurr",
      bossName: "Inkpurr",
    });
    for (const c of SPIRE_ZONES[3].kin) expect(CHARACTERS[c]).toBeDefined();
    expect(
      SPIRE_ZONES[3].kin.filter((c) => CHARACTERS[c].element === "Shadow")
        .length,
    ).toBeGreaterThanOrEqual(2);
    // Its briefing is its own, never zone 1's or 2's.
    expect(SPIRE_ZONES[3].bossLead).toMatch(/Inkpurr/);
    expect(SPIRE_ZONES[3].bossLead).not.toMatch(/Cragmuff|Tidelotl/);
    expect(SPIRE_ZONES[3].ascendantMoves).toEqual(["nightfall", "pounce"]);
    expect(
      SPIRE_ZONES[3].ascendantMoves.map((m) => RAID_ATTACKS[m].name),
    ).toEqual(["Nightfall", "Shade Pounce"]);
    expect(SPIRE_FLOORS[30].description).toBe(
      "New attacks: Nightfall, Shade Pounce",
    );
    // (Zone 4 is built on top of it.)
    expect(SPIRE_BUILT_TOP).toBeGreaterThanOrEqual(30);
  });
  it("has wave floors 21–24 and 26–29, the elite on 25 and the boss on 30", () => {
    for (const f of [21, 22, 23, 24, 26, 27, 28, 29]) {
      const def = SPIRE_FLOORS[f];
      expect(def.kind, `floor ${f}`).toBe("wave");
      expect(def.zone).toBe(3);
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      expect(def.waves.length).toBeLessThanOrEqual(3);
      const all = def.waves.flat();
      for (const e of all) expect(CHARACTERS[e.character]).toBeDefined();
      // Shadow-leaning, plus at most one off-element champion.
      const off = new Set(
        all.filter((e) => !shadow.has(e.character)).map((e) => e.character),
      );
      expect(off.size, `floor ${f} off-element`).toBe(1);
      expect(all.filter((e) => shadow.has(e.character)).length).toBeGreaterThan(
        all.length / 2,
      );
      expect(new Set(all.map((e) => e.role)).size).toBeGreaterThanOrEqual(2);
      expect(SPIRE_TUNING[f]).toBeDefined();
    }
    // A different off-element champion on every floor.
    const offs = [21, 22, 23, 24, 26, 27, 28, 29].map(
      (f) =>
        SPIRE_FLOORS[f].waves.flat().find((e) => !shadow.has(e.character))!
          .character,
    );
    expect(new Set(offs).size).toBe(offs.length);
    expect(SPIRE_FLOORS[25]).toMatchObject({ kind: "elite", zone: 3 });
    expect(SPIRE_FLOORS[25].elite?.mechanic).toBe("hands");
    expect(SPIRE_ELITE_MECHANICS.hands).toMatchObject({
      attack: "hands",
      boss: "Inkpurr",
    });
    expect(SPIRE_FLOORS[30]).toMatchObject({
      kind: "boss",
      zone: 3,
      boss: "gloomshade",
      name: "Ascendant Inkpurr",
    });
    // Short names, none repeated across the Spire.
    const names = Object.values(SPIRE_FLOORS).map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (let f = 21; f <= 30; f++)
      expect(SPIRE_FLOORS[f].name.length).toBeLessThanOrEqual(24);
  });
  it("keeps its clocks: the elite's and the boss's as in the zones below", () => {
    for (let f = 21; f <= 29; f++)
      if (f !== 25) expect(SPIRE_TUNING[f].limit).toBe(SPIRE_TUNING[11].limit);
    expect(SPIRE_TUNING[25].limit).toBe(SPIRE_TUNING[15].limit);
    expect(SPIRE_TUNING[30]).toEqual(SPIRE_TUNING[20]);
    // Each Echo hits a little harder floor by floor (how tough it is
    // follows its floor's champions: see the play-test below).
    for (const f of [22, 23, 24, 26, 27, 28, 29])
      expect(SPIRE_TUNING[f].power, `floor ${f}`).toBeGreaterThan(
        SPIRE_TUNING[f - 1 === 25 ? 24 : f - 1].power,
      );
    expect(SPIRE_TUNING[21].power).toBeGreaterThanOrEqual(
      SPIRE_TUNING[19].power - 0.08,
    );
  });
  it("loads every champion of the zone before the climb (the roster)", () => {
    const roster = spireRoster(3);
    for (const f of Object.values(SPIRE_FLOORS).filter((f) => f.zone === 3))
      for (const e of [
        ...f.waves.flat(),
        ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
      ])
        expect(roster).toContain(e.character);
    for (const c of SPIRE_ZONES[3].kin) expect(roster).toContain(c);
    // The other zones' rosters are their own.
    expect(spireRoster(2)).not.toContain("duskveil");
    expect(spireRoster(1)).not.toContain("astrabun");
  });
  it("pays more than zone 2, more on the elite and the boss floor, and a title on floor 30", () => {
    const coins = (f: number) =>
      spireRewardsOf(f)
        .filter((r) => r.kind === "coins")
        .reduce((n, r) => n + r.amount, 0);
    for (const f of [21, 22, 23, 24, 26, 27, 28, 29]) {
      expect(coins(f)).toBeGreaterThanOrEqual(55);
      expect(coins(f)).toBeLessThanOrEqual(70);
      expect(coins(f)).toBeGreaterThan(coins(f - 10));
      expect(coins(25)).toBeGreaterThan(coins(f));
      expect(coins(30)).toBeGreaterThan(coins(f));
    }
    expect(coins(25)).toBeGreaterThan(coins(15));
    expect(coins(30)).toBe(250);
    expect(spireRewardsOf(30).find((r) => r.kind === "title")?.item).toBe(
      "Lanternbane of the Spire",
    );
    expect(spireRewardsOf(25).some((r) => r.kind === "title")).toBe(false);
  });
});

describe("a zone-3 room", () => {
  it("is the Spire's rules over Inkpurr's arena, climbing 21 → 30 only", () => {
    const a = createSpireArena("Z3", 3);
    expect(a).toBeInstanceOf(SpireGloomArena);
    expect(a).toBeInstanceOf(GloomshadeArena);
    expect(isSpireArena(a)).toBe(true);
    expect(a.zone).toBe(3);
    expect(a.raid.boss).toBe("gloomshade");
    expect(a.raid.spire).toMatchObject({
      zone: 3,
      floor: 21,
      startFloor: 21,
      ceiling: 30,
    });
    a.configureSpire({ startFloor: 1, ceiling: 40 });
    expect(a.raid.spire).toMatchObject({ startFloor: 21, ceiling: 30 });
    a.configureSpire({ startFloor: 11, ceiling: 20 });
    expect(a.raid.spire).toMatchObject({ startFloor: 21, ceiling: 21 });
    // Zone 2's room never climbs into zone 3.
    const two = createSpireArena("Z2", 2);
    expect(two).toBeInstanceOf(SpireTideArena);
    two.configureSpire({ startFloor: 21, ceiling: 30 });
    expect(two.raid.spire).toMatchObject({ startFloor: 20, ceiling: 20 });
    // A plain Inkpurr raid is no climb.
    expect(isSpireArena(createRaidArena("R", "gloomshade"))).toBe(false);
  });
  it("fights its wave floors on the Spire's court: no lanterns, copies or night", () => {
    seeded(301);
    const a = climb();
    expect(a.raid.spire).toMatchObject({ floor: 21, kind: "wave", zone: 3 });
    expect(a.raid.spire!.roster).toEqual(spireRoster(3));
    expect(a.raid.lanterns).toBeUndefined();
    expect(a.raid.decoys).toEqual([]);
    expect(a.arenaId).toBe("classic");
    expect(a.walls()).toBe(spireCourtWalls({ floor: 21, kind: "wave" }));
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a)[0]?.character).toBe(
      SPIRE_FLOORS[21].waves[0][0].character,
    );
    // The phone target row lists the Echoes (no Inkpurr bodies to pick).
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // Climbs on to 22 with blessing cards, as in the zones below.
    clearFloor(a);
    expect(a.raid.spire!.floor).toBe(22);
    expect(a.phase).toBe("intermission");
    expect(a.raid.spire!.offers.p0).toHaveLength(SPIRE_OFFER);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([21]);
    expect(a.spire.pending[0].startFloor).toBe(21);
    expect(a.raid.lanterns).toBeUndefined();
  });
  it("ends at floor 29 for a party without an Inkpurr clear (the server's ceiling)", () => {
    seeded(302);
    const a = climb(["voltkit"], { startFloor: 29, ceiling: 29 });
    toPlaying(a);
    clearFloor(a);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.spire!.best).toBe(29);
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    expect(a.raid.message).toMatch(/Floor 29 cleared/);
  });
  it("climbs again from floor 21 after a defeat", () => {
    seeded(303);
    const a = climb(["voltkit"], { startFloor: 21, ceiling: 30 });
    toPlaying(a);
    run(a, 1);
    for (let i = 0; i < 400 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, echoes(a).find((e) => e.hp > 0)?.id ?? "");
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Climb again from floor 21/);
    a.retry();
    expect(a.raid.spire).toMatchObject({ floor: 21, startFloor: 21 });
  });
  it("tells a zone-2 conqueror that zone 3 opens at floor 21", () => {
    const a = createSpireArena("Z2", 2) as SpireTideArena;
    Object.assign(a.raid.spire!, { best: 20, kind: "boss", floor: 20 });
    expect(
      (a as unknown as { finishMessage(w: boolean): string }).finishMessage(
        true,
      ),
    ).toBe("Zone 2 conquered — zone 3 opens at floor 21.");
  });
});

describe("the elite (floor 25): Inkpurr's Grasping Hands", () => {
  const toCaptain = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 25 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    return a;
  };
  it("is an Echo captain with a boss bar that plays only Grasping Hands, never flipped", () => {
    seeded(311);
    const a = toCaptain();
    const elite = a.boss()!;
    expect(elite).toMatchObject({
      echo: true,
      elite: true,
      team: 1,
      character: "duskveil",
      name: "Echo Captain Duskveil",
    });
    expect(a.raid.bossId).toBe(elite.id);
    expect(a.raid.message).toMatch(/Inkpurr's grasping hands/);
    const hands: RaidWarning[] = [];
    const kinds = new Set<string>();
    let cue = "";
    run(a, 30, () => {
      for (const w of a.raid.warnings) {
        kinds.add(w.kind);
        if (!hands.includes(w)) hands.push(w);
        if (!cue) cue = spireCue(snap(a));
      }
    });
    expect([...kinds]).toEqual(["hands"]);
    expect(hands.length).toBeGreaterThanOrEqual(3);
    // The board never flips part-way on the Spire.
    for (const w of hands) {
      expect(w.shiftAt).toBeUndefined();
      expect(w.parity === 0 || w.parity === 1).toBe(true);
    }
    // The HUD names it while it is on the court.
    expect(cue).toBe(SPIRE_ELITE_MECHANICS.hands.cue);
    // Inkpurr's yard stays off: no lanterns, copies, curses, lights, and the
    // captain never drifts between Inkpurr's spots.
    expect(a.raid.lanterns).toBeUndefined();
    expect(a.raid.decoys).toEqual([]);
    expect(a.raid.curses).toEqual({});
    expect(a.raid.lights).toEqual([]);
    expect((a as unknown as { targets: unknown[] }).targets).toEqual([]);
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // Escorts at half health.
    elite.hp = a.raid.maxHp * 0.45;
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a).filter((p) => !p.elite && p.hp > 0).length).toBe(1);
    expect(echoes(a).find((p) => !p.elite)?.character).toBe("shadopus");
  });
  it("darkens the tiles the party stands on, hurting those still there (scaled like any Echo hit)", () => {
    seeded(312);
    const a = toCaptain(["voltkit", "terradon"]);
    const [me, you] = a.heroes();
    // (The captain stands aside: only the hands hurt here.)
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    Object.assign(elite, { x: 1500, y: 820 });
    // Both on one colour of tile: that colour goes dark.
    const tile = (c: number, r: number) => ({
      x: (c + 0.5) * (1600 / GLOOMSHADE.hands.cols),
      y: (r + 0.5) * (900 / GLOOMSHADE.hands.rows),
    });
    a.raid.warnings = [];
    (a as unknown as { nextAttack: number }).nextAttack = a.time + 99;
    Object.assign(me, tile(3, 2));
    Object.assign(you, tile(5, 2));
    (
      a as unknown as {
        startAttack(k: string, t: Fighter): void;
      }
    ).startAttack("hands", me);
    const w = a.raid.warnings.find((x) => x.kind === "hands")!;
    expect(handsTileDark(me.x, me.y, w.parity!)).toBe(true);
    expect(handsTileDark(you.x, you.y, w.parity!)).toBe(true);
    expect(w.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    // One stays, one steps onto the lit tile next to it.
    me.hp = you.hp = 500;
    const lit = tile(6, 2);
    expect(handsTileDark(lit.x, lit.y, w.parity!)).toBe(false);
    const closes = w.at + 0.1;
    while (a.time < closes) {
      Object.assign(me, tile(3, 2));
      Object.assign(you, lit);
      me.hp = Math.min(me.hp, 500);
      a.tick(DT);
    }
    expect(500 - me.hp).toBeCloseTo(
      GLOOMSHADE.hands.damage *
        SPIRE_TUNING[25].power *
        (1 + SPIRE_PARTY.power),
      3,
    );
    expect(you.hp).toBe(500);
  });
  it("keeps Inkpurr's counters to its own floor (nothing to reveal on the captain)", () => {
    seeded(313);
    const a = toCaptain(["mystowl", "voltkit"]);
    const elite = a.boss()!;
    const [owl, volt] = a.heroes();
    const message = a.raid.message;
    owl.lastInput = { ...owl.lastInput, aimX: elite.x, aimY: elite.y };
    a.cast(
      owl,
      CHARACTERS.mystowl.skills.find((s) => s.id === "third-eye-ray")!,
    );
    expect(a.raid.revealUntil ?? 0).toBe(0);
    expect(a.raid.message).toBe(message);
    volt.lastInput = { ...volt.lastInput, aimX: 900, aimY: 400 };
    a.cast(
      volt,
      CHARACTERS.voltkit.skills.find((s) => s.id === "ball-lightning")!,
    );
    expect(a.raid.lights).toEqual([]);
  });
  it.each([1, 4])(
    "keeps the raid honesty rules with %i raider(s) (shown long enough, one at a time, a lit tile in reach)",
    (size) => {
      seeded(320 + size);
      const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
      const a = toCaptain(team.slice(0, size));
      const problems: string[] = [];
      const seen = new Map<number, RaidWarning>();
      const walls = spireCourtWalls({ floor: 25, kind: "elite" })!;
      expect(walls).toBeDefined();
      let wasLive = 0;
      run(a, 90, () => {
        const elite = a.boss();
        if (elite) elite.hp = Math.max(elite.hp, a.raid.maxHp * 0.6);
        for (const w of a.raid.warnings) {
          if (seen.has(w.id)) continue;
          seen.set(w.id, w);
          const shown = w.at - (w.startedAt ?? w.at);
          if (shown < RAID_TELEGRAPH_FLOOR - EPS)
            problems.push(`${w.kind} on screen ${shown.toFixed(2)} s`);
          if (w.shiftAt !== undefined) problems.push("the board flips");
          // Every raider can reach a lit, open spot at the slowest speed
          // before the hands close (a lit tile always borders a dark one).
          a.walls();
          for (const p of a.heroes().filter((q) => q.hp > 0)) {
            let near = Infinity;
            for (let x = 30; x < 1600; x += 20)
              for (let y = 30; y < 900; y += 20) {
                if (handsTileDark(x, y, w.parity ?? 0)) continue;
                if (blocked(x, y, RULES.radius)) continue;
                near = Math.min(near, Math.hypot(x - p.x, y - p.y));
              }
            if (near / RAID_SLOWEST_SPEED > shown - 0.25)
              problems.push(`no lit tile in reach (${near.toFixed(0)} px)`);
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

describe("the boss floor (floor 30: the Ascendant Inkpurr, in the Lantern Yard)", () => {
  const toThirty = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 29, ceiling: 30 });
    toPlaying(a);
    clearFloor(a);
    return a;
  };
  it("briefs the Ascendant in the same room, in the Lantern Yard, then the blessings, then the fight", () => {
    seeded(331);
    const a = toThirty();
    const s = a.raid.spire!;
    expect(a.raid.result).toBeNull();
    expect(s).toMatchObject({ floor: 30, kind: "boss", best: 29, zone: 3 });
    expect(a.phase).toBe("briefing");
    expect(a.raid.variant).toBe("ascendant");
    expect(a.raid.name).toBe("Ascendant Inkpurr");
    // Its raid's court: the Lantern Yard and its lanterns, no Spire walls.
    expect(a.arenaId).toBe("lantern-yard");
    expect(a.arenaId).toBe(SPIRE_ZONES[3].court);
    expect(a.raid.lanterns?.length).toBe(GLOOMSHADE.lanterns.length);
    expect(a.walls()).toEqual([]);
    const boss = a.boss()!;
    expect(boss).toMatchObject({ raidBoss: true, name: "Ascendant Inkpurr" });
    expect(boss.hp).toBe(a.raid.maxHp);
    expect(a.raid.maxHp).toBeGreaterThan(1);
    expect(a.raid.gilded).toBe(false);
    expect(echoes(a)).toEqual([]);
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("intermission");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    // Inkpurr's own deck (the raid's), drifting and splitting in its yard.
    const kinds = new Set<string>();
    run(a, 90, () => a.raid.warnings.forEach((w) => kinds.add(w.kind)));
    expect(kinds.has("eruption")).toBe(false);
    expect(kinds.has("bubbles")).toBe(false);
    expect(
      [...kinds].some((k) =>
        ["lunge", "hands", "snuff", "curse", "split", "pulse"].includes(k),
      ),
    ).toBe(true);
    expect(kinds.size).toBeGreaterThan(2);
  });
  it("goes on without a raider who never reads the briefing", () => {
    seeded(332);
    const a = toThirty();
    run(a, SPIRE_PARTY.bossBriefing + 0.2);
    expect(a.phase).toBe("intermission");
  });
  it("counts blessings in the boss fight", () => {
    seeded(333);
    const a = toThirty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    const boss = a.boss()!,
      p = a.heroes()[0];
    a.raid.decoys = [];
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
  it("saves the clear as Spire floor 30, then ends the climb: zone 3 conquered", () => {
    seeded(334);
    const a = toThirty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    run(a, 5);
    a.spire.pending = [];
    a.boss()!.hp = 0;
    run(a, 0.1);
    expect(s.clearedAt).toBeDefined();
    expect(s.best).toBe(30);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([30]);
    expect(a.raid.warnings).toEqual([]);
    run(a, SPIRE_PARTY.cleared + 0.2);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.message).toBe("Zone 3 conquered — zone 4 opens at floor 31.");
    a.retry();
    expect(s).toMatchObject({ startFloor: 29, floor: 29, blessings: {} });
    expect(a.raid.variant).toBeUndefined();
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    expect(a.raid.lanterns).toBeUndefined();
    expect(a.arenaId).toBe("classic");
  });
  it("loses the climb on a defeat by the Ascendant", () => {
    seeded(335);
    const a = toThirty();
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
    expect(a.raid.message).toMatch(/Ascendant Inkpurr stands unbroken/);
  });
  it("is painted ahead with the texture floor 30 shows (the yard's summit)", () => {
    expect(spireSummitFloorId(3)).toBe(
      spireSummitFloorOf(SPIRE_ZONES[3].court),
    );
    expect(hasSpireSummitArena(SPIRE_ZONES[3].court)).toBe(true);
  });
});

/**
 * Play-test by simulation, as the zones below: a Normal bot raider alone,
 * with the blessings it would hold by then on a climb from floor 21 (none
 * on 21).
 */
describe("play-test (bot raiders vs zone 3)", () => {
  function playFloor(floor: number, seed: number) {
    seeded(seed * 7919);
    const a = createSpireArena("SIM" + seed, 3);
    a.add("p0", "P0", "halcyra");
    a.configureSpire({ startFloor: floor, ceiling: floor });
    a.start();
    const mine = (a.raid.spire!.blessings.p0 = {} as Record<string, number>);
    for (let f = 22; f <= floor; f++) {
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
  // Floor 21 is a Four Gates court: since its healing orbs moved off the
  // gates (where no one could reach them), a lone bot clears it nearly
  // every time (35 of 36 seeds); floor 29 still often holds it back.
  it("floor 21 is usually cleared solo with no blessings; floor 29 less often, but sometimes", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const rate = (floor: number) =>
      seeds.filter((s) => playFloor(floor, s)).length / seeds.length;
    const first = rate(21),
      last = rate(29);
    expect(first).toBeGreaterThanOrEqual(0.5);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(first);
  }, 180_000);
});

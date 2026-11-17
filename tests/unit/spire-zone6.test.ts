/**
 * The Spire's zone 6, the Sky Terrace (floors 51–60): its floors and
 * numbers, a room for the zone (SpireEmberArena: the Spire's rules over
 * Lumiwick's arena), the elite on floor 55 with Lumiwick's dive (the raid
 * honesty rules, the way out always within reach, never under a phone's
 * touch controls or through a wall, no hit bigger than a fair share of the
 * frailest champion), and the Ascendant Lumiwick on floor 60 in the same
 * room, on the Sky Terrace.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  blocked,
  maxHealth,
  useObstacles,
  type Ability,
  type CharacterId,
  type Fighter,
  type Input,
  type Snapshot,
} from "@arena/shared";
import {
  SPIRE_DIVE_MIN,
  SPIRE_DIVE_OVERSHOOT,
  SPIRE_DIVE_TEACH,
  SpireEmberArena,
  SpireLightArena,
  createSpireArena,
  isSpireArena,
  spireDive,
  spireSegmentDistance,
} from "../../apps/server/src/spire";
import { EmberwingArena } from "../../apps/server/src/raid-emberwing";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RAID_SLOWEST_SPEED } from "../../apps/server/src/raid-ai";
import {
  ASCENDANT_LUMIWICK,
  RAID_ATTACKS,
  EMBERWING,
  RAID_TELEGRAPH_FLOOR,
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
  spireBorrowed,
  spireRewardsOf,
  spireRoster,
  spireScale,
  spireUnderControls,
} from "../../packages/shared/src/spire";
import { spireCourtWalls } from "../../packages/shared/src/spire-court";
import { raidTargets } from "../../apps/client/src/raid-targets";
import { spireCue } from "../../apps/client/src/spire-battle";
import {
  SPIRE_TERRACE_SUMMIT_FLOOR,
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
  const a = createSpireArena("FIRE1", 6) as SpireEmberArena;
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({
    startFloor: o.startFloor ?? 51,
    ceiling: o.ceiling ?? 59,
  });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
function run(
  a: SpireEmberArena,
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
const echoes = (a: SpireEmberArena) => a.players.filter((p) => p.echo);
const killEchoes = (a: SpireEmberArena) => {
  for (const p of echoes(a)) if (p.hp > 0) p.hp = 0;
};
const toPlaying = (a: SpireEmberArena) => {
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
};
/** Beat every wave of the floor in play, then wait for the next floor. */
const clearFloor = (a: SpireEmberArena) => {
  for (let i = 0; i < 12 && a.raid.spire!.clearedAt === undefined; i++) {
    run(a, 1.2);
    killEchoes(a);
    run(a, SPIRE_PARTY.waveGap + 0.2);
  }
  run(a, SPIRE_PARTY.cleared + 0.2);
};
/** What the client receives (enough of it for the client's helpers). */
const snap = (a: SpireEmberArena) => a.snapshot() as unknown as Snapshot;
/** Lumiwick's terrace, off: nothing of its raid on the court. */
const terraceOff = (a: SpireEmberArena) => {
  const r = a.raid;
  expect(r.braziers ?? []).toEqual([]);
  expect(r.airborne ?? false).toBe(false);
  expect(r.emberDive).toBeUndefined();
  expect(r.emberPatches ?? []).toEqual([]);
  expect(r.emberTrails ?? []).toEqual([]);
  expect(r.flameRings ?? []).toEqual([]);
  expect(r.emberFeathers ?? []).toEqual([]);
  expect(r.permanentGround ?? false).toBe(false);
  expect(a.arenaId).toBe("classic");
};
/** Points along a lane, every few px. */
const along = (w: { x: number; y: number; tx: number; ty: number }) => {
  const n = Math.ceil(Math.hypot(w.tx - w.x, w.ty - w.y) / 4);
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: w.x + ((w.tx - w.x) * i) / Math.max(1, n),
    y: w.y + ((w.ty - w.y) * i) / Math.max(1, n),
  }));
};
const toLane = (
  p: { x: number; y: number },
  w: { x: number; y: number; tx: number; ty: number },
) => spireSegmentDistance(p, w, { x: w.tx, y: w.ty });
/** The frailest champion's health (the fairness cap is a share of it). */
const FRAILEST = Math.min(
  ...(Object.keys(CHARACTERS) as CharacterId[]).map((c) => maxHealth(c)),
);

describe("Spire floors (zone 6, the Sky Terrace)", () => {
  const kin = new Set<string>(SPIRE_ZONES[6].kin);
  it("is Lumiwick's zone: the Sky Terrace for its boss, Fire rosters", () => {
    expect(SPIRE_ZONES[6]).toMatchObject({
      id: 6,
      name: "Sky Terrace",
      boss: "emberwing",
      court: "sky-terrace",
      element: "Fire",
      ascendant: "Ascendant Lumiwick",
      bossName: "Lumiwick",
    });
    for (const c of SPIRE_ZONES[6].kin) expect(CHARACTERS[c]).toBeDefined();
    // Every Fire champion there is (two), and their kin.
    const fire = (Object.keys(CHARACTERS) as CharacterId[]).filter(
      (c) => CHARACTERS[c].element === "Fire",
    );
    expect(fire.length).toBeGreaterThanOrEqual(2);
    for (const c of fire) expect(SPIRE_ZONES[6].kin).toContain(c);
    expect(SPIRE_ZONES[6].kin).toHaveLength(3);
    // Its briefing is its own, never another zone's.
    expect(SPIRE_ZONES[6].bossLead).toMatch(/Lumiwick/);
    expect(SPIRE_ZONES[6].bossLead).not.toMatch(
      /Cragmuff|Tidelotl|Inkpurr|Snoozaku|Prismell/,
    );
    expect(SPIRE_ZONES[6].bossLead).toMatch(/three braziers/);
    expect(SPIRE_ZONES[6].bossReads).toMatch(/you usually dodge to/);
    expect(SPIRE_ZONES[6].bossReads).toMatch(/kneels to revive/);
    // The Ascendant's new attacks, as the boss layer plays them.
    expect(SPIRE_ZONES[6].ascendantMoves).toEqual([
      "snuff-gale",
      "bound-wicks",
    ]);
    expect(
      SPIRE_ZONES[6].ascendantMoves.map((m) => RAID_ATTACKS[m].name),
    ).toEqual(["Snuffing Gale", "Bound Wicks"]);
    expect(SPIRE_FLOORS[60].description).toBe(
      "New attacks: Snuffing Gale, Bound Wicks",
    );
    expect(SPIRE_ZONES[6].bossLead).toMatch(/Snuffing Gale/);
    expect(SPIRE_ZONES[6].bossLead).toMatch(/Bound Wicks/);
    expect(SPIRE_ZONES[6].bossReads).toMatch(/Embers fall where you/);
    expect(SPIRE_BUILT_TOP).toBeGreaterThanOrEqual(60);
  });
  it("has wave floors 51–54 and 56–59, the elite on 55 and the boss on 60", () => {
    for (const f of [51, 52, 53, 54, 56, 57, 58, 59]) {
      const def = SPIRE_FLOORS[f];
      expect(def.kind, `floor ${f}`).toBe("wave");
      expect(def.zone).toBe(6);
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      expect(def.waves.length).toBeLessThanOrEqual(3);
      const all = def.waves.flat();
      for (const e of all) expect(CHARACTERS[e.character]).toBeDefined();
      // Fire-leaning, plus exactly one off-element champion.
      const off = new Set(
        all.filter((e) => !kin.has(e.character)).map((e) => e.character),
      );
      expect(off.size, `floor ${f} off-element`).toBe(1);
      expect(all.filter((e) => kin.has(e.character)).length).toBeGreaterThan(
        all.length / 2,
      );
      expect(new Set(all.map((e) => e.role)).size).toBeGreaterThanOrEqual(2);
      expect(SPIRE_TUNING[f]).toBeDefined();
    }
    // A different off-element champion on every floor.
    const offs = [51, 52, 53, 54, 56, 57, 58, 59].map(
      (f) =>
        SPIRE_FLOORS[f].waves.flat().find((e) => !kin.has(e.character))!
          .character,
    );
    expect(new Set(offs).size).toBe(offs.length);
    expect(SPIRE_FLOORS[55]).toMatchObject({ kind: "elite", zone: 6 });
    expect(SPIRE_FLOORS[55].elite?.mechanic).toBe("dive");
    expect(SPIRE_ELITE_MECHANICS.dive).toMatchObject({
      attack: "dive-bomb",
      boss: "Lumiwick",
    });
    expect(SPIRE_FLOORS[60]).toMatchObject({
      kind: "boss",
      zone: 6,
      boss: "emberwing",
      name: "Ascendant Lumiwick",
    });
    // Short names, none repeated across the Spire.
    const names = Object.values(SPIRE_FLOORS).map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (let f = 51; f <= 60; f++)
      expect(SPIRE_FLOORS[f].name.length).toBeLessThanOrEqual(24);
  });
  it("keeps its clocks: the elite's and the boss's as in the zones below", () => {
    for (let f = 51; f <= 59; f++)
      if (f !== 55) expect(SPIRE_TUNING[f].limit).toBe(SPIRE_TUNING[11].limit);
    expect(SPIRE_TUNING[55].limit).toBe(SPIRE_TUNING[15].limit);
    expect(SPIRE_TUNING[60]).toEqual(SPIRE_TUNING[50]);
    // Each Echo hits a little harder floor by floor (how tough it is
    // follows its floor's champions: see the play-test below).
    for (const f of [52, 53, 54, 56, 57, 58, 59])
      expect(SPIRE_TUNING[f].power, `floor ${f}`).toBeGreaterThan(
        SPIRE_TUNING[f - 1 === 55 ? 54 : f - 1].power,
      );
    expect(SPIRE_TUNING[51].power).toBeGreaterThanOrEqual(
      SPIRE_TUNING[49].power - 0.08,
    );
  });
  it("never spikes: a big party's Echoes hit at most ×1.2, and no dive takes 60% of the frailest champion", () => {
    for (let f = 51; f <= 59; f++)
      expect(
        spireScale(f, 4).power / SPIRE_TUNING[f].power,
        `floor ${f}`,
      ).toBeLessThanOrEqual(1.2);
    // The captain's dive at its hardest (a full party), on the frailest.
    expect(EMBERWING.dive.damage * spireScale(55, 4).power).toBeLessThan(
      FRAILEST * 0.6,
    );
  });
  it("loads every champion of the zone before the climb (the roster)", () => {
    const roster = spireRoster(6);
    for (const f of Object.values(SPIRE_FLOORS).filter((f) => f.zone === 6))
      for (const e of [
        ...f.waves.flat(),
        ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
      ])
        expect(roster).toContain(e.character);
    for (const c of SPIRE_ZONES[6].kin) expect(roster).toContain(c);
    // The other zones' rosters are their own.
    expect(spireRoster(5)).not.toContain("cindrake");
    expect(spireRoster(4)).not.toContain("pyranda");
  });
  it("pays more than zone 5, more on the elite and the boss floor, and a title on floor 60", () => {
    const coins = (f: number) =>
      spireRewardsOf(f)
        .filter((r) => r.kind === "coins")
        .reduce((n, r) => n + r.amount, 0);
    for (const f of [51, 52, 53, 54, 56, 57, 58, 59]) {
      expect(coins(f)).toBeGreaterThanOrEqual(100);
      expect(coins(f)).toBeLessThanOrEqual(115);
      expect(coins(f)).toBeGreaterThan(coins(f - 10));
      expect(coins(55)).toBeGreaterThan(coins(f));
      expect(coins(60)).toBeGreaterThan(coins(f));
    }
    expect(coins(55)).toBeGreaterThan(coins(45));
    expect(coins(60)).toBe(400);
    expect(coins(60)).toBeGreaterThan(coins(50));
    expect(spireRewardsOf(60).find((r) => r.kind === "title")?.item).toBe(
      "Flamebreaker of the Spire",
    );
    expect(spireRewardsOf(55).some((r) => r.kind === "title")).toBe(false);
  });
});

describe("a zone-6 room", () => {
  it("is the Spire's rules over Lumiwick's arena, climbing 51 → 60 only", () => {
    const a = createSpireArena("Z6", 6);
    expect(a).toBeInstanceOf(SpireEmberArena);
    expect(a).toBeInstanceOf(EmberwingArena);
    expect(isSpireArena(a)).toBe(true);
    expect(a.zone).toBe(6);
    expect(a.raid.boss).toBe("emberwing");
    expect(a.raid.spire).toMatchObject({
      zone: 6,
      floor: 51,
      startFloor: 51,
      ceiling: 60,
    });
    a.configureSpire({ startFloor: 1, ceiling: 70 });
    expect(a.raid.spire).toMatchObject({ startFloor: 51, ceiling: 60 });
    a.configureSpire({ startFloor: 41, ceiling: 50 });
    expect(a.raid.spire).toMatchObject({ startFloor: 51, ceiling: 51 });
    // Zone 5's room never climbs into zone 6.
    const five = createSpireArena("Z5", 5);
    expect(five).toBeInstanceOf(SpireLightArena);
    five.configureSpire({ startFloor: 51, ceiling: 60 });
    expect(five.raid.spire).toMatchObject({ startFloor: 50, ceiling: 50 });
    // A plain Lumiwick raid is no climb.
    expect(isSpireArena(createRaidArena("R", "emberwing"))).toBe(false);
  });
  it("fights its wave floors on the Spire's court: no braziers, take-offs, fire or rings", () => {
    seeded(601);
    const a = climb();
    expect(a.raid.spire).toMatchObject({ floor: 51, kind: "wave", zone: 6 });
    expect(a.raid.spire!.roster).toEqual(spireRoster(6));
    terraceOff(a);
    expect(a.walls()).toBe(spireCourtWalls({ floor: 51, kind: "wave" }));
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a)[0]?.character).toBe(
      SPIRE_FLOORS[51].waves[0][0].character,
    );
    // The phone target row lists the Echoes (no braziers to pick).
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // A raider standing where a brazier would be lights nothing.
    Object.assign(a.heroes()[0], EMBERWING.braziers[0]);
    run(a, 10, () => Object.assign(a.heroes()[0], EMBERWING.braziers[0]));
    terraceOff(a);
    expect(a.raid.warnings).toEqual([]);
    // Climbs on to 52 with blessing cards, as in the zones below.
    clearFloor(a);
    expect(a.raid.spire!.floor).toBe(52);
    expect(a.phase).toBe("intermission");
    expect(a.raid.spire!.offers.p0).toHaveLength(SPIRE_OFFER);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([51]);
    expect(a.spire.pending[0].startFloor).toBe(51);
    terraceOff(a);
  });
  it("lets raiders hurt the Echoes, never a teammate", () => {
    seeded(602);
    const a = climb();
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const [me] = a.heroes();
    const foe = echoes(a).find((p) => p.hp > 0)!;
    const hp = (foe.hp = 500);
    a.damage(foe, 40, me.id);
    expect(hp - foe.hp).toBeCloseTo(40 * SPIRE_TUNING[51].armour, 4);
    // A raider's strike reaches an Echo in full (no airborne half-damage).
    const strike = CHARACTERS.voltkit.skills.find((s) => s.kind === "strike");
    if (strike) {
      foe.hp = 500;
      a.damage(foe, 40, me.id, strike as Ability);
      expect(500 - foe.hp).toBeCloseTo(40 * SPIRE_TUNING[51].armour, 4);
    }
    const b = climb(["voltkit", "terradon"]);
    toPlaying(b);
    const [x, y] = b.heroes();
    y.hp = 300;
    b.damage(y, 40, x.id);
    expect(y.hp).toBe(300);
  });
  it("keeps Lumiwick's counters to its own floor: no brazier lit, no Echo touching the lane", () => {
    seeded(603);
    const a = climb(["cindrake", "pyranda"], { startFloor: 55 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const [cin] = a.heroes();
    const cast = (p: Fighter, id: string) => {
      const ability = CHARACTERS[p.character].skills.find(
        (s) => s.id === id,
      ) as Ability;
      expect(ability).toBeDefined();
      a.cast(p, ability);
    };
    Object.assign(cin, EMBERWING.braziers[0]);
    Object.assign(cin.lastInput, { aimX: cin.x + 200, aimY: cin.y });
    cast(cin, "heat-cracks");
    run(a, 1);
    terraceOff(a);
    // An Echo's cast leaves the captain's lane as it was.
    const elite = a.boss()!;
    expect(elite.character).toBe("cindrake");
    a.bots.delete(elite.id);
    a.raid.warnings = [];
    const lane = {
      id: 9001,
      kind: "dive-bomb",
      x: 700,
      y: 200,
      tx: 700,
      ty: 700,
      radius: EMBERWING.dive.width,
      at: a.time + 2,
      startedAt: a.time,
    } as RaidWarning;
    a.raid.warnings.push(lane);
    Object.assign(elite.lastInput, { aimX: 500, aimY: 450 });
    cast(elite, "heat-cracks");
    expect(a.raid.warnings).toContain(lane);
  });
  it("lets a stand-in play the Spire's court, not Lumiwick's brazier routes", () => {
    seeded(604);
    const a = climb();
    toPlaying(a);
    const hint = (
      a as unknown as {
        botHint(b: Fighter, i: Input, go: unknown): Input | undefined;
      }
    ).botHint(a.heroes()[0], { ...a.heroes()[0].lastInput }, () => ({}));
    expect(hint).toBeUndefined();
    // Not even with fire and a dive lane at its feet (its raid's brain
    // would run from them; the Spire's plays like any raider).
    const me = a.heroes()[0];
    a.raid.emberPatches = [
      { id: 1, x: me.x, y: me.y, radius: 60, until: a.time + 9, growAt: 99 },
    ];
    a.raid.warnings = [
      {
        id: 9002,
        kind: "dive-bomb",
        x: me.x - 300,
        y: me.y,
        tx: me.x + 300,
        ty: me.y,
        radius: EMBERWING.dive.width,
        at: a.time + 1,
        startedAt: a.time,
      } as RaidWarning,
    ];
    expect(
      (
        a as unknown as {
          botHint(b: Fighter, i: Input, go: unknown): Input | undefined;
        }
      ).botHint(me, { ...me.lastInput }, () => ({ basic: true })),
    ).toBeUndefined();
  });
  it("ends at floor 59 for a party without a Lumiwick clear (the server's ceiling)", () => {
    seeded(605);
    const a = climb(["voltkit"], { startFloor: 59, ceiling: 59 });
    toPlaying(a);
    clearFloor(a);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.spire!.best).toBe(59);
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    expect(a.raid.message).toMatch(/Floor 59 cleared/);
  });
  it("climbs again from floor 51 after a defeat", () => {
    seeded(606);
    const a = climb(["voltkit"], { startFloor: 51, ceiling: 60 });
    toPlaying(a);
    run(a, 1);
    for (let i = 0; i < 400 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, echoes(a).find((e) => e.hp > 0)?.id ?? "");
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Climb again from floor 51/);
    a.retry();
    expect(a.raid.spire).toMatchObject({ floor: 51, startFloor: 51 });
  });
  it("tells a zone-5 conqueror that zone 6 opens at floor 51", () => {
    const a = createSpireArena("Z5", 5) as SpireLightArena;
    Object.assign(a.raid.spire!, { best: 50, kind: "boss", floor: 50 });
    expect(
      (a as unknown as { finishMessage(w: boolean): string }).finishMessage(
        true,
      ),
    ).toBe("Zone 5 conquered — zone 6 opens at floor 51.");
  });
});

describe("the elite (floor 55): Lumiwick's dive", () => {
  const toCaptain = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 55 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    return a;
  };
  const startDive = (a: SpireEmberArena, target: Fighter) =>
    (a as unknown as { startAttack(k: string, t: Fighter): void }).startAttack(
      "dive-bomb",
      target,
    );
  it("is an Echo captain with a boss bar that plays only its dive", () => {
    seeded(611);
    const a = toCaptain();
    const elite = a.boss()!;
    expect(elite).toMatchObject({
      echo: true,
      elite: true,
      team: 1,
      character: "cindrake",
      name: "Echo Captain Cindrake",
    });
    expect(elite.raidBoss).toBeFalsy();
    expect(a.raid.bossId).toBe(elite.id);
    expect(a.raid.message).toMatch(/Lumiwick's ember dive/);
    const dives: RaidWarning[] = [];
    const kinds = new Set<string>();
    let cue = "";
    run(a, 30, () => {
      for (const w of a.raid.warnings) {
        kinds.add(w.kind);
        if (!dives.includes(w)) dives.push(w);
        if (!cue) cue = spireCue(snap(a));
      }
    });
    expect([...kinds]).toEqual(["dive-bomb"]);
    expect(dives.length).toBeGreaterThanOrEqual(3);
    // The HUD names it while it is on the court.
    expect(cue).toBe(SPIRE_ELITE_MECHANICS.dive.cue);
    terraceOff(a);
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // Escorts at half health.
    elite.hp = a.raid.maxHp * 0.45;
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a).filter((p) => !p.elite && p.hp > 0).length).toBe(1);
    expect(echoes(a).find((p) => !p.elite)?.character).toBe("pyranda");
  });
  it("never drags the captain toward Lumiwick's spot, nor runs the terrace", () => {
    seeded(612);
    const a = toCaptain();
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    a.raid.warnings = [];
    (a as unknown as { nextAttack: number }).nextAttack = a.time + 99;
    Object.assign(elite, { x: 600, y: 200, vx: 0, vy: 0 });
    // A flame ring and a fire patch left on the court would grow if the
    // terrace ran; a raider on them is never burnt.
    a.raid.flameRings = [{ id: 1, x: 400, y: 450, radius: 0, startedAt: 0 }];
    a.raid.emberPatches = [
      { id: 2, x: 400, y: 450, radius: 60, until: a.time + 30, growAt: 0 },
    ];
    const me = a.heroes()[0];
    run(
      a,
      3,
      () => {
        Object.assign(me, { x: 400, y: 450 });
        me.hp = 500;
      },
      false,
    );
    expect(me.hp).toBe(500);
    expect(elite.x).toBeCloseTo(600, 0);
    expect(elite.y).toBeCloseTo(200, 0);
    expect(a.raid.flameRings[0].radius).toBe(0);
    expect(a.raid.emberPatches[0].radius).toBe(60);
  });
  it("lays one lane from the captain through the raider, over open ground only", () => {
    useObstacles([]);
    const from = [
      { x: 1250, y: 450 },
      { x: 1450, y: 150 },
      { x: 900, y: 300 },
      { x: 300, y: 700 },
      { x: 1300, y: 600 },
      { x: 200, y: 150 },
    ];
    const at = [
      { x: 400, y: 300 },
      { x: 800, y: 450 },
      { x: 150, y: 150 },
      { x: 600, y: 820 },
      { x: 700, y: 200 },
      { x: 1400, y: 800 },
    ];
    let laid = 0;
    for (const f of from)
      for (const t of at) {
        if (Math.hypot(t.x - f.x, t.y - f.y) < 1) continue;
        const w = spireDive(f, t);
        if (!w) continue;
        laid++;
        expect(Math.hypot(w.tx - w.x, w.ty - w.y)).toBeGreaterThanOrEqual(
          SPIRE_DIVE_MIN,
        );
        // It runs from the captain's line, never past the overshoot.
        expect(toLane(f, w) - Math.hypot(w.x - f.x, w.y - f.y)).toBeLessThan(1);
        expect(Math.hypot(w.tx - f.x, w.ty - f.y)).toBeLessThanOrEqual(
          Math.hypot(t.x - f.x, t.y - f.y) + SPIRE_DIVE_OVERSHOOT + 1,
        );
        // Every point of the lane, lane width and margin, is open ground
        // on the court (the captain lands at its end: on the court too).
        for (const p of along(w)) {
          expect(
            spireUnderControls(p.x, p.y, EMBERWING.dive.width),
            `${f.x},${f.y} → ${t.x},${t.y}: ${p.x.toFixed(0)},${p.y.toFixed(0)}`,
          ).toBe(false);
          expect(p.x).toBeGreaterThanOrEqual(RULES.radius);
          expect(p.x).toBeLessThanOrEqual(RULES.width - RULES.radius);
          expect(p.y).toBeGreaterThanOrEqual(RULES.radius);
          expect(p.y).toBeLessThanOrEqual(RULES.height - RULES.radius);
        }
        // A raider on open ground in the lane's reach is on it (it is
        // aimed at them).
        if (
          !spireUnderControls(t.x, t.y, EMBERWING.dive.width) &&
          !spireUnderControls(f.x, f.y, EMBERWING.dive.width) &&
          along({ x: f.x, y: f.y, tx: t.x, ty: t.y }).every(
            (p) => !spireUnderControls(p.x, p.y, EMBERWING.dive.width),
          )
        )
          expect(toLane(t, w), `${f.x},${f.y} → ${t.x},${t.y}`).toBeLessThan(1);
      }
    expect(laid).toBeGreaterThan(20);
    // A raider under the thumbs is never drawn on: the lane stops short.
    const hidden = { x: 1300, y: 600 };
    expect(spireUnderControls(hidden.x, hidden.y)).toBe(true);
    const w = spireDive({ x: 500, y: 450 }, hidden)!;
    expect(w).toBeDefined();
    for (const p of along(w))
      expect(spireUnderControls(p.x, p.y, EMBERWING.dive.width)).toBe(false);
    // On a floor with walls, the lane stops at the first one (the captain
    // never flies through a wall).
    for (const floor of [51, 52, 53, 54, 55]) {
      const walls = spireCourtWalls({
        floor,
        kind: floor === 55 ? "elite" : "wave",
      })!;
      useObstacles(walls);
      for (const f of from)
        for (const t of at) {
          if (blocked(f.x, f.y, RULES.radius)) continue;
          const lane = spireDive(f, t);
          if (!lane) continue;
          for (const p of along({ x: f.x, y: f.y, tx: lane.tx, ty: lane.ty }))
            expect(blocked(p.x, p.y, RULES.radius), `floor ${floor}`).toBe(
              false,
            );
        }
    }
    useObstacles([]);
  });
  it("hurts the raider who stays in the lane, not the one who steps out (scaled like any Echo hit); the captain lands at its end", () => {
    seeded(613);
    const a = toCaptain(["voltkit", "terradon"]);
    const [me, you] = a.heroes();
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    a.walls();
    Object.assign(elite, { x: 900, y: 450, vx: 0, vy: 0 });
    a.raid.warnings = [];
    (a as unknown as { nextAttack: number }).nextAttack = a.time + 99;
    Object.assign(me, { x: 500, y: 450, vx: 0, vy: 0 });
    Object.assign(you, { x: 500, y: 450, vx: 0, vy: 0 });
    startDive(a, me);
    const list = a.raid.warnings.filter((w) => w.kind === "dive-bomb");
    expect(list.length).toBe(1);
    const lane = list[0];
    expect(toLane(me, lane)).toBeLessThan(1);
    expect(lane.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    // The first two are teaching ones: shown a little longer.
    expect(lane.teach).toBe(true);
    const taught = lane.at - a.time;
    a.raid.warnings = [];
    startDive(a, me);
    a.raid.warnings = [];
    startDive(a, me);
    const later = a.raid.warnings.at(-1)!;
    expect(later.teach).toBe(false);
    expect(later.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    expect(taught).toBeGreaterThan(later.at - a.time + SPIRE_DIVE_TEACH / 3);
    a.raid.warnings = [lane];
    me.hp = you.hp = 500;
    // A step to the side, clear of the lane.
    const len = Math.hypot(lane.tx - lane.x, lane.ty - lane.y),
      nx = -(lane.ty - lane.y) / len,
      ny = (lane.tx - lane.x) / len,
      side = 1.4 * (EMBERWING.dive.width + RULES.radius);
    const out = { x: 500 + nx * side, y: 450 + ny * side };
    expect(toLane(out, lane)).toBeGreaterThan(
      EMBERWING.dive.width + RULES.radius,
    );
    let path = 0;
    for (let i = 0; i < 2 / DT; i++) {
      Object.assign(me, { x: 500, y: 450 });
      Object.assign(you, out);
      me.hp = Math.min(me.hp, 500);
      const before = { x: elite.x, y: elite.y };
      a.tick(DT);
      // While it flies it never leaves its line from where it stood.
      if (a.time > lane.at) {
        path = Math.max(
          path,
          spireSegmentDistance(
            elite,
            { x: 900, y: 450 },
            { x: lane.tx, y: lane.ty },
          ),
        );
        expect(Math.hypot(elite.x - before.x, elite.y - before.y)).toBeLessThan(
          SPIRE_DIVE_MIN * 2,
        );
      }
    }
    expect(500 - me.hp).toBeCloseTo(
      EMBERWING.dive.damage * SPIRE_TUNING[55].power * (1 + SPIRE_PARTY.power),
      3,
    );
    expect(you.hp).toBe(500);
    expect(path).toBeLessThan(1);
    expect(Math.hypot(elite.x - lane.tx, elite.y - lane.ty)).toBeLessThan(1);
  });
  it.each([1, 4])(
    "keeps the raid honesty rules with %i raider(s) (shown long enough, one at a time, a way out in reach, nothing under the controls)",
    (size) => {
      seeded(620 + size);
      const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "glacelle"];
      const a = toCaptain(team.slice(0, size));
      // Raiders that move (stand-ins): idle ones get pinned to the edge,
      // where the captain has no room to dive at them.
      for (const p of a.heroes()) a.standIn(p.id);
      const problems: string[] = [];
      const seen = new Map<number, RaidWarning>();
      let wasLive = 0;
      let biggest = 0;
      const R = EMBERWING.dive.width + RULES.radius;
      const hp = new Map<string, number>();
      run(
        a,
        90,
        () => {
          const elite = a.boss();
          if (elite) elite.hp = Math.max(elite.hp, a.raid.maxHp * 0.6);
          // The largest single hit a dive lands on anyone.
          for (const p of a.heroes()) {
            const was = hp.get(p.id);
            if (was !== undefined && was > p.hp)
              biggest = Math.max(biggest, was - p.hp);
            p.hp = 9999;
            hp.set(p.id, p.hp);
          }
          const fresh = a.raid.warnings.filter((w) => !seen.has(w.id));
          for (const w of fresh) {
            seen.set(w.id, w);
            if (w.kind !== "dive-bomb") problems.push(`a ${w.kind}`);
            const shown = w.at - (w.startedAt ?? w.at);
            if (shown < RAID_TELEGRAPH_FLOOR - EPS)
              problems.push(`${w.kind} on screen ${shown.toFixed(2)} s`);
            a.walls();
            for (const p of along(w)) {
              if (spireUnderControls(p.x, p.y, w.radius)) {
                problems.push(`a lane under the controls at ${p.x},${p.y}`);
                break;
              }
              if (blocked(p.x, p.y, RULES.radius)) {
                problems.push(`a lane through a wall at ${p.x},${p.y}`);
                break;
              }
            }
          }
          if (!fresh.length) return;
          // Every raider can reach a spot clear of the lane, open ground,
          // at the slowest speed before it goes.
          const live = a.raid.warnings.filter((w) => w.kind === "dive-bomb");
          const shown = Math.min(...live.map((w) => w.at - a.time));
          a.walls();
          for (const p of a.heroes().filter((q) => q.hp > 0)) {
            let near = Infinity;
            for (let x = 30; x < 1600; x += 20)
              for (let y = 30; y < 900; y += 20) {
                if (live.some((w) => toLane({ x, y }, w) < R)) continue;
                if (blocked(x, y, RULES.radius)) continue;
                if (spireUnderControls(x, y)) continue;
                near = Math.min(near, Math.hypot(x - p.x, y - p.y));
              }
            if (near / RAID_SLOWEST_SPEED > shown - 0.25)
              problems.push(`no safe spot in reach (${near.toFixed(0)} px)`);
          }
          const threats = a.liveThreats();
          if (threats > 1 && threats > wasLive)
            problems.push(`${threats} attacks live`);
          wasLive = threats;
        },
        false,
      );
      expect(problems.slice(0, 8)).toEqual([]);
      expect(seen.size).toBeGreaterThan(6);
      // (Echo skills hit too; none of it, dive included, is a spike.)
      expect(biggest).toBeLessThan(FRAILEST * 0.6);
    },
    60_000,
  );
});

describe("the elite's HUD line, on each zone's real elite floor", () => {
  it.each([
    [5, 1, "Cragmuff's eruptions"],
    [15, 2, "Tidelotl's bubble volleys"],
    [25, 3, "Inkpurr's grasping hands"],
    [35, 4, "Snoozaku's falling stars"],
    [45, 5, "Prismell's prism lances"],
    [55, 6, "Lumiwick's ember dive"],
    [65, 7, "the Storm Twins' polarity"],
  ])("floor %i (zone %i) names %s", (floor, zone, borrowed) => {
    seeded(640 + floor);
    const a = createSpireArena("CUE" + floor, zone) as SpireEmberArena;
    a.add("p0", "P0", "voltkit");
    a.configureSpire({ startFloor: floor, ceiling: floor + 4 });
    a.start();
    a.acknowledgeInstructions("p0");
    toPlaying(a);
    const s = a.raid.spire!;
    expect(s).toMatchObject({ floor, kind: "elite", zone });
    // Before (and between) its casts: the captain and whose mechanic.
    a.raid.warnings = [];
    expect(spireCue(snap(a))).toBe(`Echo Captain · it borrowed ${borrowed}`);
    const m = SPIRE_ELITE_MECHANICS[SPIRE_FLOORS[floor].elite!.mechanic];
    expect(spireBorrowed(m)).toBe(borrowed);
  });
});

describe("the boss floor (floor 60: the Ascendant Lumiwick, on the Sky Terrace)", () => {
  const toSixty = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 59, ceiling: 60 });
    toPlaying(a);
    clearFloor(a);
    return a;
  };
  it("briefs the Ascendant in the same room, on the Sky Terrace, then the blessings, then the fight", () => {
    seeded(631);
    const a = toSixty();
    const s = a.raid.spire!;
    expect(a.raid.result).toBeNull();
    expect(s).toMatchObject({ floor: 60, kind: "boss", best: 59, zone: 6 });
    expect(a.phase).toBe("briefing");
    expect(a.raid.variant).toBe("ascendant");
    expect(a.raid.name).toBe("Ascendant Lumiwick");
    // Its raid's court: the Sky Terrace and its braziers, no Spire walls.
    expect(a.arenaId).toBe("sky-terrace");
    expect(a.arenaId).toBe(SPIRE_ZONES[6].court);
    expect(a.walls()).toEqual([]);
    expect(a.raid.braziers).toHaveLength(EMBERWING.braziers.length);
    // The Ascendant's braziers (clear of a phone's controls), not the raid's.
    expect(a.raid.braziers!.map(({ x, y }) => ({ x, y }))).toEqual(
      ASCENDANT_LUMIWICK.braziers.map(({ x, y }) => ({ x, y })),
    );
    expect(a.raid.braziers!.some((b) => spireUnderControls(b.x, b.y, 70))).toBe(
      false,
    );
    const boss = a.boss()!;
    expect(boss).toMatchObject({ raidBoss: true, name: "Ascendant Lumiwick" });
    expect(boss.hp).toBe(a.raid.maxHp);
    expect(a.raid.maxHp).toBeGreaterThan(1);
    expect(a.raid.gilded).toBe(false);
    expect(echoes(a)).toEqual([]);
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("intermission");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    // Lumiwick's own deck (the raid's).
    const kinds = new Set<string>();
    run(a, 90, () => a.raid.warnings.forEach((w) => kinds.add(w.kind)));
    expect(kinds.has("eruption")).toBe(false);
    expect(kinds.has("prism-lance")).toBe(false);
    expect(
      [...kinds].some((k) =>
        [
          "dive-bomb",
          "wing-gust",
          "flame-ring",
          "ember-rain",
          "heat-mark",
          "scorched-earth",
        ].includes(k),
      ),
    ).toBe(true);
  });
  it("plays the Ascendant's new attacks on the Spire's floor 60 (its layer is on)", () => {
    seeded(634);
    const a = toSixty(["voltkit", "voltkit"]);
    const s = a.raid.spire!;
    for (const p of a.heroes()) {
      a.acknowledgeInstructions(p.id);
    }
    for (const p of a.heroes()) a.pickRite(p.id, s.offers[p.id][0]);
    toPlaying(a);
    const kinds = new Set<string>();
    run(a, 150, () => {
      for (const p of a.heroes()) p.hp = maxHealth(p.character, a.mode);
      a.raid.warnings.forEach((w) => kinds.add(w.kind));
    });
    expect(kinds.has("snuff-gale")).toBe(true);
    expect(kinds.has("bound-wicks")).toBe(true);
    // Every gale and wick on the Ascendant's braziers.
    expect(a.raid.braziers!.map(({ x, y }) => ({ x, y }))).toEqual(
      ASCENDANT_LUMIWICK.braziers.map(({ x, y }) => ({ x, y })),
    );
  }, 60_000);
  it("goes on without a raider who never reads the briefing", () => {
    seeded(632);
    const a = toSixty();
    run(a, SPIRE_PARTY.bossBriefing + 0.2);
    expect(a.phase).toBe("intermission");
  });
  it("counts blessings in the boss fight", () => {
    seeded(633);
    const a = toSixty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    const boss = a.boss()!,
      p = a.heroes()[0];
    const hit = (target: Fighter, from: string) => {
      const hp = (target.hp = 9999);
      a.damage(target, 40, from);
      return hp - target.hp;
    };
    s.blessings.p0 = {};
    a.raid.airborne = false;
    a.raid.exposedUntil = a.time + 99;
    const plain = hit(boss, p.id),
      taken = hit(p, boss.id);
    expect(plain).toBeGreaterThan(0);
    s.blessings.p0 = { keen: 1, stoneskin: 1 };
    expect(hit(boss, p.id)).toBeCloseTo(plain * 1.1, 4);
    expect(hit(p, boss.id)).toBeCloseTo(taken * 0.9, 4);
  });
  it("saves the clear as Spire floor 60, then ends the climb: zone 6 conquered", () => {
    seeded(634);
    const a = toSixty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    run(a, 5);
    a.spire.pending = [];
    a.boss()!.hp = 0;
    run(a, 0.1);
    expect(s.clearedAt).toBeDefined();
    expect(s.best).toBe(60);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([60]);
    expect(a.raid.warnings).toEqual([]);
    run(a, SPIRE_PARTY.cleared + 0.2);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.message).toBe("Zone 6 conquered — zone 7 opens at floor 61.");
    a.retry();
    expect(s).toMatchObject({ startFloor: 59, floor: 59, blessings: {} });
    expect(a.raid.variant).toBeUndefined();
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    terraceOff(a);
  });
  it("loses the climb on a defeat by the Ascendant", () => {
    seeded(635);
    const a = toSixty();
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
    expect(a.raid.message).toMatch(/Ascendant Lumiwick stands unbroken/);
  });
});

/**
 * Play-test by simulation, as the zones below: a Normal bot raider alone,
 * with the blessings it would hold by then on a climb from floor 51 (none
 * on 51).
 */
function playFloor(floor: number, seed: number) {
  seeded(seed * 7919);
  const a = createSpireArena("SIM" + seed, 6);
  a.add("p0", "P0", "voltkit");
  a.configureSpire({ startFloor: floor, ceiling: floor });
  a.start();
  const mine = (a.raid.spire!.blessings.p0 = {} as Record<string, number>);
  for (let f = 52; f <= floor; f++) {
    const offer = spireBlessingOffer(a.spire.seed, f, 0, mine)[0];
    mine[offer] = (mine[offer] ?? 0) + 1;
  }
  (a as unknown as { applyBlessings(p: Fighter): void }).applyBlessings(
    a.heroes()[0],
  );
  a.standIn("p0");
  a.acknowledgeInstructions("p0");
  for (let t = 0; t < 400 && !a.raid.result; t += DT) a.tick(DT);
  vi.restoreAllMocks();
  return a.raid.spire!.best >= floor;
}
describe("play-test (bot raiders vs zone 6)", () => {
  it("floor 51 is often cleared solo with no blessings; floor 59 less often, but sometimes", () => {
    const seeds = Array.from({ length: 24 }, (_, i) => i + 1);
    const rate = (floor: number) =>
      seeds.filter((s) => playFloor(floor, s)).length / seeds.length;
    const first = rate(51),
      last = rate(59);
    expect(first).toBeGreaterThanOrEqual(0.5);
    expect(first).toBeLessThan(1);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(first);
  }, 180_000);
});

describe("floor 60's court, painted ahead", () => {
  it("is the texture floor 60 shows: the Sky Terrace's summit grade", () => {
    // Floor 60 shows spireSummitFloorOf(its court); the stairs prewarm
    // spireSummitFloorId(6): the same texture.
    expect(hasSpireSummitArena(SPIRE_ZONES[6].court)).toBe(true);
    expect(spireSummitFloorId(6)).toBe(SPIRE_TERRACE_SUMMIT_FLOOR);
    expect(spireSummitFloorOf(SPIRE_ZONES[6].court)).toBe(
      SPIRE_TERRACE_SUMMIT_FLOOR,
    );
  });
});

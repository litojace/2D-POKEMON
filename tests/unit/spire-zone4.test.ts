/**
 * The Spire's zone 4, the Cloud Deck (floors 31–40): its floors and
 * numbers, a room for the zone (SpireDreamArena: the Spire's rules over
 * Snoozaku's arena), the elite on floor 35 with Snoozaku's Falling Stars
 * (the raid honesty rules, a safe spot always within reach, never under a
 * phone's touch controls), and the Ascendant Snoozaku on floor 40 in the
 * same room, on the Cloud Deck.
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
  SPIRE_STAR_COUNT,
  SPIRE_STAR_RING,
  SPIRE_STAR_TEACH,
  SpireDreamArena,
  SpireGloomArena,
  createSpireArena,
  isSpireArena,
  spireStarfall,
} from "../../apps/server/src/spire";
import { SomnaraArena } from "../../apps/server/src/raid-somnara";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RAID_SLOWEST_SPEED } from "../../apps/server/src/raid-ai";
import {
  RAID_ATTACKS,
  RAID_TELEGRAPH_FLOOR,
  SOMNARA,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import { ASCENDANT_INKPURR } from "../../packages/shared/src/raid-ascendant";
import {
  SPIRE_BUILT_TOP,
  SPIRE_CONTROL_MARGIN,
  SPIRE_ELITE_MECHANICS,
  SPIRE_FLOORS,
  SPIRE_OFFER,
  SPIRE_PARTY,
  SPIRE_PHONE_CONTROLS,
  SPIRE_TUNING,
  SPIRE_ZONES,
  spireBlessingOffer,
  spireRewardsOf,
  spireRoster,
  spireUnderControls,
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
  const a = createSpireArena("DREAM1", 4) as SpireDreamArena;
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({
    startFloor: o.startFloor ?? 31,
    ceiling: o.ceiling ?? 39,
  });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
function run(
  a: SpireDreamArena,
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
const echoes = (a: SpireDreamArena) => a.players.filter((p) => p.echo);
const killEchoes = (a: SpireDreamArena) => {
  for (const p of echoes(a)) if (p.hp > 0) p.hp = 0;
};
const toPlaying = (a: SpireDreamArena) => {
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
};
/** Beat every wave of the floor in play, then wait for the next floor. */
const clearFloor = (a: SpireDreamArena) => {
  for (let i = 0; i < 12 && a.raid.spire!.clearedAt === undefined; i++) {
    run(a, 1.2);
    killEchoes(a);
    run(a, SPIRE_PARTY.waveGap + 0.2);
  }
  run(a, SPIRE_PARTY.cleared + 0.2);
};
/** What the client receives (enough of it for the client's helpers). */
const snap = (a: SpireDreamArena) => a.snapshot() as unknown as Snapshot;
/** Snoozaku's deck, off: nothing of its raid on the court. */
const deckOff = (a: SpireDreamArena) => {
  const r = a.raid;
  expect(r.dream).toBeUndefined();
  expect(r.dreamRings ?? []).toEqual([]);
  expect(r.dreamBubbles ?? []).toEqual([]);
  expect(r.quietZone).toBeUndefined();
  expect(r.drowsy ?? {}).toEqual({});
  expect(r.runeCalls ?? []).toEqual([]);
  expect(a.arenaId).toBe("classic");
};

describe("Spire floors (zone 4, the Cloud Deck)", () => {
  const kin = new Set<string>(SPIRE_ZONES[4].kin);
  it("is Snoozaku's zone: the Cloud Deck for its boss, Psychic rosters", () => {
    expect(SPIRE_ZONES[4]).toMatchObject({
      id: 4,
      name: "Cloud Deck",
      boss: "somnara",
      court: "cloud-deck",
      element: "Psychic",
      ascendant: "Ascendant Snoozaku",
      bossName: "Snoozaku",
    });
    for (const c of SPIRE_ZONES[4].kin) expect(CHARACTERS[c]).toBeDefined();
    expect(
      SPIRE_ZONES[4].kin.filter((c) => CHARACTERS[c].element === "Psychic")
        .length,
    ).toBeGreaterThanOrEqual(2);
    // Its briefing is its own, never another zone's.
    expect(SPIRE_ZONES[4].bossLead).toMatch(/Snoozaku/);
    expect(SPIRE_ZONES[4].bossLead).not.toMatch(/Cragmuff|Tidelotl|Inkpurr/);
    expect(SPIRE_ZONES[4].bossLead).toMatch(/half the runes/);
    expect(SPIRE_ZONES[4].bossLead).toMatch(/Seer/);
    expect(SPIRE_ZONES[4].bossReads).toMatch(/Stars land where you/);
    expect(SPIRE_ZONES[4].bossReads).toMatch(/kneels to revive/);
    expect(SPIRE_ZONES[4].ascendantMoves).toEqual(["twin-dream", "dream-tide"]);
    expect(
      SPIRE_ZONES[4].ascendantMoves.map((m) => RAID_ATTACKS[m].name),
    ).toEqual(["Twin Dream", "Dream Tide"]);
    expect(SPIRE_FLOORS[40].description).toBe(
      "New attacks: Twin Dream, Dream Tide",
    );
    expect(SPIRE_BUILT_TOP).toBe(40);
  });
  it("has wave floors 31–34 and 36–39, the elite on 35 and the boss on 40", () => {
    for (const f of [31, 32, 33, 34, 36, 37, 38, 39]) {
      const def = SPIRE_FLOORS[f];
      expect(def.kind, `floor ${f}`).toBe("wave");
      expect(def.zone).toBe(4);
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      expect(def.waves.length).toBeLessThanOrEqual(3);
      const all = def.waves.flat();
      for (const e of all) expect(CHARACTERS[e.character]).toBeDefined();
      // Psychic-leaning, plus exactly one off-element champion.
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
    const offs = [31, 32, 33, 34, 36, 37, 38, 39].map(
      (f) =>
        SPIRE_FLOORS[f].waves.flat().find((e) => !kin.has(e.character))!
          .character,
    );
    expect(new Set(offs).size).toBe(offs.length);
    expect(SPIRE_FLOORS[35]).toMatchObject({ kind: "elite", zone: 4 });
    expect(SPIRE_FLOORS[35].elite?.mechanic).toBe("stars");
    expect(SPIRE_ELITE_MECHANICS.stars).toMatchObject({
      attack: "falling-stars",
      boss: "Snoozaku",
    });
    expect(SPIRE_FLOORS[40]).toMatchObject({
      kind: "boss",
      zone: 4,
      boss: "somnara",
      name: "Ascendant Snoozaku",
    });
    // Short names, none repeated across the Spire.
    const names = Object.values(SPIRE_FLOORS).map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (let f = 31; f <= 40; f++)
      expect(SPIRE_FLOORS[f].name.length).toBeLessThanOrEqual(24);
  });
  it("keeps its clocks: the elite's and the boss's as in the zones below", () => {
    for (let f = 31; f <= 39; f++)
      if (f !== 35) expect(SPIRE_TUNING[f].limit).toBe(SPIRE_TUNING[11].limit);
    expect(SPIRE_TUNING[35].limit).toBe(SPIRE_TUNING[15].limit);
    expect(SPIRE_TUNING[40]).toEqual(SPIRE_TUNING[30]);
    // Each Echo hits a little harder floor by floor (how tough it is
    // follows its floor's champions: see the play-test below).
    for (const f of [32, 33, 34, 36, 37, 38, 39])
      expect(SPIRE_TUNING[f].power, `floor ${f}`).toBeGreaterThan(
        SPIRE_TUNING[f - 1 === 35 ? 34 : f - 1].power,
      );
    expect(SPIRE_TUNING[31].power).toBeGreaterThanOrEqual(
      SPIRE_TUNING[29].power - 0.08,
    );
  });
  it("loads every champion of the zone before the climb (the roster)", () => {
    const roster = spireRoster(4);
    for (const f of Object.values(SPIRE_FLOORS).filter((f) => f.zone === 4))
      for (const e of [
        ...f.waves.flat(),
        ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
      ])
        expect(roster).toContain(e.character);
    for (const c of SPIRE_ZONES[4].kin) expect(roster).toContain(c);
    // The other zones' rosters are their own.
    expect(spireRoster(3)).not.toContain("pangrove");
    expect(spireRoster(2)).not.toContain("astrabun");
  });
  it("pays more than zone 3, more on the elite and the boss floor, and a title on floor 40", () => {
    const coins = (f: number) =>
      spireRewardsOf(f)
        .filter((r) => r.kind === "coins")
        .reduce((n, r) => n + r.amount, 0);
    for (const f of [31, 32, 33, 34, 36, 37, 38, 39]) {
      expect(coins(f)).toBeGreaterThanOrEqual(70);
      expect(coins(f)).toBeLessThanOrEqual(85);
      expect(coins(f)).toBeGreaterThan(coins(f - 10));
      expect(coins(35)).toBeGreaterThan(coins(f));
      expect(coins(40)).toBeGreaterThan(coins(f));
    }
    expect(coins(35)).toBeGreaterThan(coins(25));
    expect(coins(40)).toBe(300);
    expect(spireRewardsOf(40).find((r) => r.kind === "title")?.item).toBe(
      "Dreambreaker of the Spire",
    );
    expect(spireRewardsOf(35).some((r) => r.kind === "title")).toBe(false);
  });
  it("keeps the phone control boxes of Nightfall's list, without the target row", () => {
    // The joystick, dash, jump, skills, ultimate and attack button: the
    // first eight boxes measured for Nightfall (its last six were the
    // target portraits round them, which phones no longer have).
    expect(SPIRE_PHONE_CONTROLS).toEqual(
      ASCENDANT_INKPURR.nightfall.phoneControls.slice(0, 8),
    );
    expect(spireUnderControls(0, 700)).toBe(true);
    expect(spireUnderControls(800, 450)).toBe(false);
  });
});

describe("a zone-4 room", () => {
  it("is the Spire's rules over Snoozaku's arena, climbing 31 → 40 only", () => {
    const a = createSpireArena("Z4", 4);
    expect(a).toBeInstanceOf(SpireDreamArena);
    expect(a).toBeInstanceOf(SomnaraArena);
    expect(isSpireArena(a)).toBe(true);
    expect(a.zone).toBe(4);
    expect(a.raid.boss).toBe("somnara");
    expect(a.raid.spire).toMatchObject({
      zone: 4,
      floor: 31,
      startFloor: 31,
      ceiling: 40,
    });
    a.configureSpire({ startFloor: 1, ceiling: 50 });
    expect(a.raid.spire).toMatchObject({ startFloor: 31, ceiling: 40 });
    a.configureSpire({ startFloor: 21, ceiling: 30 });
    expect(a.raid.spire).toMatchObject({ startFloor: 31, ceiling: 31 });
    // Zone 3's room never climbs into zone 4.
    const three = createSpireArena("Z3", 3);
    expect(three).toBeInstanceOf(SpireGloomArena);
    three.configureSpire({ startFloor: 31, ceiling: 40 });
    expect(three.raid.spire).toMatchObject({ startFloor: 30, ceiling: 30 });
    // A plain Snoozaku raid is no climb.
    expect(isSpireArena(createRaidArena("R", "somnara"))).toBe(false);
  });
  it("fights its wave floors on the Spire's court: no dreams, pads, rings or bubbles", () => {
    seeded(401);
    const a = climb();
    expect(a.raid.spire).toMatchObject({ floor: 31, kind: "wave", zone: 4 });
    expect(a.raid.spire!.roster).toEqual(spireRoster(4));
    deckOff(a);
    expect(a.walls()).toBe(spireCourtWalls({ floor: 31, kind: "wave" }));
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a)[0]?.character).toBe(
      SPIRE_FLOORS[31].waves[0][0].character,
    );
    // The phone target row lists the Echoes (no Snoozaku pieces to pick).
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    run(a, 10);
    deckOff(a);
    // Climbs on to 32 with blessing cards, as in the zones below.
    clearFloor(a);
    expect(a.raid.spire!.floor).toBe(32);
    expect(a.phase).toBe("intermission");
    expect(a.raid.spire!.offers.p0).toHaveLength(SPIRE_OFFER);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([31]);
    expect(a.spire.pending[0].startFloor).toBe(31);
    deckOff(a);
  });
  it("lets raiders hurt the Echoes (Snoozaku's raid only spares teammates)", () => {
    seeded(402);
    const a = climb();
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const [me] = a.heroes();
    const foe = echoes(a).find((p) => p.hp > 0)!;
    const hp = (foe.hp = 500);
    a.damage(foe, 40, me.id);
    expect(foe.hp).toBeLessThan(hp);
    expect(hp - foe.hp).toBeCloseTo(40 * SPIRE_TUNING[31].armour, 4);
    // A teammate is still only woken, never hurt.
    const b = climb(["voltkit", "terradon"]);
    toPlaying(b);
    const [x, y] = b.heroes();
    y.hp = 300;
    b.damage(y, 40, x.id);
    expect(y.hp).toBe(300);
  });
  it("ends at floor 39 for a party without a Snoozaku clear (the server's ceiling)", () => {
    seeded(403);
    const a = climb(["voltkit"], { startFloor: 39, ceiling: 39 });
    toPlaying(a);
    clearFloor(a);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.spire!.best).toBe(39);
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    expect(a.raid.message).toMatch(/Floor 39 cleared/);
  });
  it("climbs again from floor 31 after a defeat", () => {
    seeded(404);
    const a = climb(["voltkit"], { startFloor: 31, ceiling: 40 });
    toPlaying(a);
    run(a, 1);
    for (let i = 0; i < 400 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, echoes(a).find((e) => e.hp > 0)?.id ?? "");
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Climb again from floor 31/);
    a.retry();
    expect(a.raid.spire).toMatchObject({ floor: 31, startFloor: 31 });
  });
  it("tells a zone-3 conqueror that zone 4 opens at floor 31", () => {
    const a = createSpireArena("Z3", 3) as SpireGloomArena;
    Object.assign(a.raid.spire!, { best: 30, kind: "boss", floor: 30 });
    expect(
      (a as unknown as { finishMessage(w: boolean): string }).finishMessage(
        true,
      ),
    ).toBe("Zone 3 conquered — zone 4 opens at floor 31.");
  });
});

describe("the elite (floor 35): Snoozaku's Falling Stars", () => {
  const toCaptain = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 35 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    return a;
  };
  const startStars = (a: SpireDreamArena, target: Fighter) =>
    (a as unknown as { startAttack(k: string, t: Fighter): void }).startAttack(
      "falling-stars",
      target,
    );
  it("is an Echo captain with a boss bar that plays only Falling Stars", () => {
    seeded(411);
    const a = toCaptain();
    const elite = a.boss()!;
    expect(elite).toMatchObject({
      echo: true,
      elite: true,
      team: 1,
      character: "mystowl",
      name: "Echo Captain Mystowl",
    });
    expect(a.raid.bossId).toBe(elite.id);
    expect(a.raid.message).toMatch(/Snoozaku's falling stars/);
    const stars: RaidWarning[] = [];
    const kinds = new Set<string>();
    let cue = "";
    run(a, 30, () => {
      for (const w of a.raid.warnings) {
        kinds.add(w.kind);
        if (!stars.includes(w)) stars.push(w);
        if (!cue) cue = spireCue(snap(a));
      }
    });
    expect([...kinds]).toEqual(["falling-stars"]);
    expect(stars.length).toBeGreaterThanOrEqual(6);
    // The HUD names it while it is on the court.
    expect(cue).toBe(SPIRE_ELITE_MECHANICS.stars.cue);
    // Snoozaku's deck stays off, and the captain keeps to its own feet
    // (Snoozaku's drift toward the deck's middle is the boss floor's).
    deckOff(a);
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // Escorts at half health.
    elite.hp = a.raid.maxHp * 0.45;
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a).filter((p) => !p.elite && p.hp > 0).length).toBe(1);
    expect(echoes(a).find((p) => !p.elite)?.character).toBe("astrabun");
  });
  it("never drags the captain toward the deck's middle, nor runs the deck", () => {
    seeded(412);
    const a = toCaptain();
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    Object.assign(elite, { x: 1400, y: 200, vx: 0, vy: 0 });
    // A lullaby ring left on the court would spread if the deck ran.
    a.raid.dreamRings = [
      { id: 999, x: 800, y: 450, radius: 0, startedAt: a.time },
    ];
    run(a, 3);
    expect(elite.x).toBeCloseTo(1400, 0);
    expect(elite.y).toBeCloseTo(200, 0);
    expect(a.raid.dreamRings[0]?.radius ?? 0).toBe(0);
  });
  it("lays its first star on the raider, the rest round the court's middle, none under the controls", () => {
    for (const at of [
      { x: 400, y: 300 },
      { x: 800, y: 450 },
      { x: 150, y: 150 },
      { x: 1450, y: 120 },
      { x: 600, y: 820 },
    ]) {
      const stars = spireStarfall(at);
      expect(stars[0]).toEqual(at);
      // (Stars off the court or under the controls are dropped.)
      expect(stars.length).toBeGreaterThanOrEqual(2);
      expect(stars.length).toBeLessThanOrEqual(SPIRE_STAR_COUNT);
      for (const s of stars) {
        expect(spireUnderControls(s.x, s.y, SOMNARA.stars.radius)).toBe(false);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x).toBeLessThanOrEqual(RULES.width);
        expect(s.y).toBeGreaterThanOrEqual(0);
        expect(s.y).toBeLessThanOrEqual(RULES.height);
      }
      // Neighbouring stars leave a gap a fighter fits through.
      const chord = 2 * SPIRE_STAR_RING * Math.sin(Math.PI / SPIRE_STAR_COUNT);
      expect(chord - 2 * (SOMNARA.stars.radius + RULES.radius)).toBeGreaterThan(
        RULES.radius,
      );
    }
    // A raider under the thumbs draws the first star to the nearest open
    // ground beside them: nothing is ever drawn under the controls.
    const hidden = { x: 1300, y: 600 };
    expect(spireUnderControls(hidden.x, hidden.y)).toBe(true);
    const stars = spireStarfall(hidden);
    expect(stars.length).toBeGreaterThan(0);
    for (const s of stars)
      expect(spireUnderControls(s.x, s.y, SOMNARA.stars.radius)).toBe(false);
    expect(
      Math.hypot(stars[0].x - hidden.x, stars[0].y - hidden.y),
    ).toBeLessThan(500);
    expect(SPIRE_CONTROL_MARGIN).toBeGreaterThan(0);
  });
  it("hurts the raider who stays under a star, not the one who steps out (scaled like any Echo hit)", () => {
    seeded(413);
    const a = toCaptain(["voltkit", "terradon"]);
    const [me, you] = a.heroes();
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    Object.assign(elite, { x: 1500, y: 100 });
    a.raid.warnings = [];
    (a as unknown as { nextAttack: number }).nextAttack = a.time + 99;
    Object.assign(me, { x: 500, y: 300 });
    Object.assign(you, { x: 500, y: 300 });
    startStars(a, me);
    const list = a.raid.warnings.filter((w) => w.kind === "falling-stars");
    expect(list.length).toBeGreaterThanOrEqual(3);
    const first = list.find((w) => w.x === 500 && w.y === 300)!;
    expect(first).toBeDefined();
    expect(first.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    // The first two are teaching ones: shown a little longer.
    expect(first.teach).toBe(true);
    const taught = first.at - a.time;
    a.raid.warnings = [];
    startStars(a, me);
    startStars(a, me);
    const later = a.raid.warnings.at(-1)!;
    expect(later.teach).toBe(false);
    expect(later.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    expect(taught).toBeGreaterThan(later.at - a.time + SPIRE_STAR_TEACH / 2);
    a.raid.warnings = [first];
    me.hp = you.hp = 500;
    const lands = first.at + 0.1;
    while (a.time < lands) {
      Object.assign(me, { x: 500, y: 300 });
      // The middle of the constellation is safe.
      const mid = {
        x: 500 + (800 - 500) * (SPIRE_STAR_RING / Math.hypot(300, 150)),
        y: 300 + (450 - 300) * (SPIRE_STAR_RING / Math.hypot(300, 150)),
      };
      Object.assign(you, mid);
      me.hp = Math.min(me.hp, 500);
      a.tick(DT);
    }
    expect(500 - me.hp).toBeCloseTo(
      SOMNARA.stars.damage * SPIRE_TUNING[35].power * (1 + SPIRE_PARTY.power),
      3,
    );
    expect(you.hp).toBe(500);
  });
  it.each([1, 4])(
    "keeps the raid honesty rules with %i raider(s) (shown long enough, one at a time, a safe spot in reach, nothing under the controls)",
    (size) => {
      seeded(420 + size);
      const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
      const a = toCaptain(team.slice(0, size));
      const problems: string[] = [];
      const seen = new Map<number, RaidWarning>();
      const walls = spireCourtWalls({ floor: 35, kind: "elite" })!;
      expect(walls).toBeDefined();
      let wasLive = 0;
      const R = SOMNARA.stars.radius + RULES.radius;
      run(a, 90, () => {
        const elite = a.boss();
        if (elite) elite.hp = Math.max(elite.hp, a.raid.maxHp * 0.6);
        const fresh = a.raid.warnings.filter((w) => !seen.has(w.id));
        for (const w of fresh) {
          seen.set(w.id, w);
          if (w.kind !== "falling-stars") problems.push(`a ${w.kind}`);
          const shown = w.at - (w.startedAt ?? w.at);
          if (shown < RAID_TELEGRAPH_FLOOR - EPS)
            problems.push(`${w.kind} on screen ${shown.toFixed(2)} s`);
          if (spireUnderControls(w.x, w.y, w.radius))
            problems.push(`a star under the controls at ${w.x},${w.y}`);
        }
        if (!fresh.length) return;
        // Every raider can reach a spot clear of every star, open ground, at
        // the slowest speed before the stars land.
        const live = a.raid.warnings.filter((w) => w.kind === "falling-stars");
        const shown = Math.min(...live.map((w) => w.at - a.time));
        a.walls();
        for (const p of a.heroes().filter((q) => q.hp > 0)) {
          let near = Infinity;
          for (let x = 30; x < 1600; x += 20)
            for (let y = 30; y < 900; y += 20) {
              if (live.some((w) => Math.hypot(x - w.x, y - w.y) < R)) continue;
              if (blocked(x, y, RULES.radius)) continue;
              near = Math.min(near, Math.hypot(x - p.x, y - p.y));
            }
          if (near / RAID_SLOWEST_SPEED > shown - 0.25)
            problems.push(`no safe spot in reach (${near.toFixed(0)} px)`);
        }
        const threats = a.liveThreats();
        if (threats > 1 && threats > wasLive)
          problems.push(`${threats} attacks live`);
        wasLive = threats;
      });
      expect(problems.slice(0, 8)).toEqual([]);
      expect(seen.size).toBeGreaterThan(10);
    },
    60_000,
  );
});

describe("the boss floor (floor 40: the Ascendant Snoozaku, on the Cloud Deck)", () => {
  const toForty = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 39, ceiling: 40 });
    toPlaying(a);
    clearFloor(a);
    return a;
  };
  it("briefs the Ascendant in the same room, on the Cloud Deck, then the blessings, then the fight", () => {
    seeded(431);
    const a = toForty();
    const s = a.raid.spire!;
    expect(a.raid.result).toBeNull();
    expect(s).toMatchObject({ floor: 40, kind: "boss", best: 39, zone: 4 });
    expect(a.phase).toBe("briefing");
    expect(a.raid.variant).toBe("ascendant");
    expect(a.raid.name).toBe("Ascendant Snoozaku");
    // Its raid's court: the Cloud Deck, no Spire walls.
    expect(a.arenaId).toBe("cloud-deck");
    expect(a.arenaId).toBe(SPIRE_ZONES[4].court);
    expect(a.walls()).toEqual([]);
    const boss = a.boss()!;
    expect(boss).toMatchObject({ raidBoss: true, name: "Ascendant Snoozaku" });
    expect(boss.hp).toBe(a.raid.maxHp);
    expect(a.raid.maxHp).toBeGreaterThan(1);
    expect(a.raid.gilded).toBe(false);
    expect(echoes(a)).toEqual([]);
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("intermission");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    // Snoozaku's own deck (the raid's): dreams and its attacks.
    const kinds = new Set<string>();
    let dreamt = false;
    run(a, 90, () => {
      a.raid.warnings.forEach((w) => kinds.add(w.kind));
      dreamt ||= !!a.raid.dream;
    });
    expect(kinds.has("eruption")).toBe(false);
    expect(kinds.has("hands")).toBe(false);
    expect(
      [...kinds].some((k) =>
        [
          "lullaby",
          "tail-splash",
          "dream-bubbles",
          "falling-stars",
          "whale-song",
        ].includes(k),
      ),
    ).toBe(true);
    expect(dreamt).toBe(true);
  });
  it("goes on without a raider who never reads the briefing", () => {
    seeded(432);
    const a = toForty();
    run(a, SPIRE_PARTY.bossBriefing + 0.2);
    expect(a.phase).toBe("intermission");
  });
  it("counts blessings in the boss fight", () => {
    seeded(433);
    const a = toForty();
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
    a.raid.exposedUntil = a.time + 99;
    const plain = hit(boss, p.id),
      taken = hit(p, boss.id);
    expect(plain).toBeGreaterThan(0);
    s.blessings.p0 = { keen: 1, stoneskin: 1 };
    expect(hit(boss, p.id)).toBeCloseTo(plain * 1.1, 4);
    expect(hit(p, boss.id)).toBeCloseTo(taken * 0.9, 4);
  });
  it("saves the clear as Spire floor 40, then ends the climb: zone 4 conquered", () => {
    seeded(434);
    const a = toForty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    run(a, 5);
    a.spire.pending = [];
    a.boss()!.hp = 0;
    run(a, 0.1);
    expect(s.clearedAt).toBeDefined();
    expect(s.best).toBe(40);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([40]);
    expect(a.raid.warnings).toEqual([]);
    run(a, SPIRE_PARTY.cleared + 0.2);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.message).toBe("Zone 4 conquered — more floors are coming.");
    a.retry();
    expect(s).toMatchObject({ startFloor: 39, floor: 39, blessings: {} });
    expect(a.raid.variant).toBeUndefined();
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    deckOff(a);
  });
  it("loses the climb on a defeat by the Ascendant", () => {
    seeded(435);
    const a = toForty();
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
    expect(a.raid.message).toMatch(/Ascendant Snoozaku stands unbroken/);
  });
});

/**
 * Play-test by simulation, as the zones below: a Normal bot raider alone,
 * with the blessings it would hold by then on a climb from floor 31 (none
 * on 31).
 */
describe("play-test (bot raiders vs zone 4)", () => {
  function playFloor(floor: number, seed: number) {
    seeded(seed * 7919);
    const a = createSpireArena("SIM" + seed, 4);
    a.add("p0", "P0", "voltkit");
    a.configureSpire({ startFloor: floor, ceiling: floor });
    a.start();
    const mine = (a.raid.spire!.blessings.p0 = {} as Record<string, number>);
    for (let f = 32; f <= floor; f++) {
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
  it("floor 31 is often cleared solo with no blessings; floor 39 less often, but sometimes", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const rate = (floor: number) =>
      seeds.filter((s) => playFloor(floor, s)).length / seeds.length;
    const first = rate(31),
      last = rate(39);
    expect(first).toBeGreaterThanOrEqual(0.5);
    expect(first).toBeLessThan(1);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(first);
  }, 180_000);
});

describe("floor 40's court, painted ahead", () => {
  it("is the texture floor 40 shows (the deck's summit once it has one, else the deck)", () => {
    const court = SPIRE_ZONES[4].court;
    expect(spireSummitFloorId(4)).toBe(
      hasSpireSummitArena(court) ? spireSummitFloorOf(court) : court,
    );
  });
});

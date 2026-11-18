/**
 * The Spire's zone 7, the Conductor Ring (floors 61–70), its last zone: its
 * floors and numbers, a room for the zone (SpireStormArena: the Spire's
 * rules over the Storm Twins' arena), the twins' hit rules checked against
 * the Echoes and the captain, the elite on floor 65 with the twins'
 * Polarity (always a fair answer at the slowest champion's speed, its pad
 * never under a phone's touch controls or in a wall, each mark settled
 * once, no hit bigger than a fair share of the frailest champion), and the
 * Ascendant Storm Twins on floor 70 in the same room: the summit, whose
 * clear conquers the whole Spire.
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
  SPIRE_POLARITY_REACTION,
  SPIRE_TWIN_SPAWNS,
  SpireEmberArena,
  SpireStormArena,
  createSpireArena,
  isSpireArena,
  spirePadOpen,
  spirePolarityPad,
  spirePolarityPlan,
  spirePolarityWalk,
} from "../../apps/server/src/spire";
import { StormTwinsArena } from "../../apps/server/src/raid-storm-twins";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RAID_SLOWEST_SPEED } from "../../apps/server/src/raid-ai";
import {
  RAID_ATTACKS,
  STORM_TWINS,
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
  spireStartFrom,
  spireUnderControls,
} from "../../packages/shared/src/spire";
import { spireCourtWalls } from "../../packages/shared/src/spire-court";
import { raidTargets } from "../../apps/client/src/raid-targets";
import { raidHudView } from "../../apps/client/src/raid-hud";
import { spireCue } from "../../apps/client/src/spire-battle";
import { stormTarget } from "../../apps/client/src/storm-twins-controls";

const DT = 1 / RULES.tick;
const EPS = 1e-6;
const P = STORM_TWINS.polarity;
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
afterEach(() => {
  vi.restoreAllMocks();
  useObstacles([]);
});

function climb(
  chars: CharacterId[] = ["voltkit"],
  o: { startFloor?: number; ceiling?: number } = {},
) {
  const a = createSpireArena("STORM1", 7) as SpireStormArena;
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({
    startFloor: o.startFloor ?? 61,
    ceiling: o.ceiling ?? 69,
  });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
function run(
  a: SpireStormArena,
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
const echoes = (a: SpireStormArena) => a.players.filter((p) => p.echo);
const killEchoes = (a: SpireStormArena) => {
  for (const p of echoes(a)) if (p.hp > 0) p.hp = 0;
};
const toPlaying = (a: SpireStormArena) => {
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
};
/** Beat every wave of the floor in play, then wait for the next floor. */
const clearFloor = (a: SpireStormArena) => {
  for (let i = 0; i < 12 && a.raid.spire!.clearedAt === undefined; i++) {
    run(a, 1.2);
    killEchoes(a);
    run(a, SPIRE_PARTY.waveGap + 0.2);
  }
  run(a, SPIRE_PARTY.cleared + 0.2);
};
const snap = (a: SpireStormArena) => a.snapshot() as unknown as Snapshot;
/** The twins' ring, off: nothing of their raid on the court. */
const ringOff = (a: SpireStormArena) => {
  const r = a.raid;
  expect(r.twins ?? []).toEqual([]);
  expect(r.twinRevivals ?? 0).toBe(0);
  expect(r.stormBeam).toBeUndefined();
  expect(r.stormChain).toBeUndefined();
  expect(r.stormFields ?? []).toEqual([]);
  expect(r.stormRushes ?? []).toEqual([]);
  expect(a.players.some((p) => p.raidBoss)).toBe(false);
  expect(a.arenaId).toBe("classic");
};
type Hidden = {
  startAttack(k: string, t: Fighter): void;
  nextAttack: number;
  botHint(b: Fighter, i: Input, go: unknown): Input | undefined;
  selfUsed: boolean;
};
const hidden = (a: SpireStormArena) => a as unknown as Hidden;
/** The frailest champion's health (the fairness cap is a share of it). */
const FRAILEST = Math.min(
  ...(Object.keys(CHARACTERS) as CharacterId[]).map((c) => maxHealth(c)),
);
/** Spots on open ground of a floor's court (its walls in use), every 40 px. */
const openSpots = (floor: number, kind: "wave" | "elite") => {
  useObstacles(spireCourtWalls({ floor, kind }) ?? []);
  const out: { x: number; y: number }[] = [];
  for (let x = 60; x <= 1540; x += 40)
    for (let y = 60; y <= 840; y += 40)
      if (!blocked(x, y, RULES.radius) && !spireUnderControls(x, y))
        out.push({ x, y });
  return out;
};
/** A tiny deterministic random source. */
const rng = (seed: number) => {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
};

describe("Spire floors (zone 7, the Conductor Ring)", () => {
  const kin = new Set<string>(SPIRE_ZONES[7].kin);
  it("is the Storm Twins' zone: the Conductor Ring for its boss, Electric rosters", () => {
    expect(SPIRE_ZONES[7]).toMatchObject({
      id: 7,
      name: "Conductor Ring",
      boss: "storm-twins",
      court: "conductor-ring",
      element: "Electric",
      ascendant: "Ascendant Storm Twins",
      bossName: "the Storm Twins",
    });
    for (const c of SPIRE_ZONES[7].kin) expect(CHARACTERS[c]).toBeDefined();
    // Every Electric champion there is (two), and their kin.
    const electric = (Object.keys(CHARACTERS) as CharacterId[]).filter(
      (c) => CHARACTERS[c].element === "Electric",
    );
    expect(electric.length).toBeGreaterThanOrEqual(2);
    for (const c of electric) expect(SPIRE_ZONES[7].kin).toContain(c);
    expect(SPIRE_ZONES[7].kin).toHaveLength(3);
    // Its briefing is its own, never another zone's.
    expect(SPIRE_ZONES[7].bossLead).toMatch(/Fizz and Crackle/);
    expect(SPIRE_ZONES[7].bossLead).not.toMatch(
      /Cragmuff|Tidelotl|Inkpurr|Snoozaku|Prismell|Lumiwick/,
    );
    expect(SPIRE_ZONES[7].bossReads).toMatch(/you usually dodge to/);
    expect(SPIRE_ZONES[7].bossReads).toMatch(/kneels to revive/);
    // The Ascendant's new attacks.
    expect(SPIRE_ZONES[7].ascendantMoves).toEqual([
      "mirror-charge",
      "short-circuit",
    ]);
    expect(
      SPIRE_ZONES[7].ascendantMoves.map((m) => RAID_ATTACKS[m].name),
    ).toEqual(["Mirror Charge", "Short Circuit"]);
    expect(SPIRE_FLOORS[70].description).toBe(
      "New attacks: Mirror Charge, Short Circuit",
    );
    expect(SPIRE_ZONES[7].bossLead).toMatch(/Mirror Charge/);
    expect(SPIRE_ZONES[7].bossLead).toMatch(/Short Circuit/);
    // The last zone: the whole Spire is built.
    expect(SPIRE_BUILT_TOP).toBe(70);
    expect(SPIRE_FLOORS[71]).toBeUndefined();
  });
  it("has wave floors 61–64 and 66–69, the elite on 65 and the boss on 70", () => {
    for (const f of [61, 62, 63, 64, 66, 67, 68, 69]) {
      const def = SPIRE_FLOORS[f];
      expect(def.kind, `floor ${f}`).toBe("wave");
      expect(def.zone).toBe(7);
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      expect(def.waves.length).toBeLessThanOrEqual(3);
      const all = def.waves.flat();
      for (const e of all) expect(CHARACTERS[e.character]).toBeDefined();
      // Electric-leaning, plus exactly one off-element champion.
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
    const offs = [61, 62, 63, 64, 66, 67, 68, 69].map(
      (f) =>
        SPIRE_FLOORS[f].waves.flat().find((e) => !kin.has(e.character))!
          .character,
    );
    expect(new Set(offs).size).toBe(offs.length);
    expect(SPIRE_FLOORS[65]).toMatchObject({ kind: "elite", zone: 7 });
    expect(SPIRE_FLOORS[65].elite).toMatchObject({
      name: "Echo Captain Coilemur",
      mechanic: "polarity",
    });
    expect(SPIRE_FLOORS[65].elite!.captain.character).toBe("coilemur");
    expect(SPIRE_ELITE_MECHANICS.polarity).toMatchObject({
      attack: "polarity",
      boss: "the Storm Twins",
    });
    expect(spireBorrowed(SPIRE_ELITE_MECHANICS.polarity)).toBe(
      "the Storm Twins' polarity",
    );
    expect(SPIRE_FLOORS[70]).toMatchObject({
      kind: "boss",
      zone: 7,
      boss: "storm-twins",
      name: "Ascendant Storm Twins",
    });
    const names = Object.values(SPIRE_FLOORS).map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (let f = 61; f <= 70; f++)
      expect(SPIRE_FLOORS[f].name.length).toBeLessThanOrEqual(24);
  });
  it("keeps its clocks: the elite's and the boss's as in the zones below", () => {
    for (let f = 61; f <= 69; f++)
      if (f !== 65) expect(SPIRE_TUNING[f].limit).toBe(SPIRE_TUNING[11].limit);
    expect(SPIRE_TUNING[65].limit).toBe(SPIRE_TUNING[15].limit);
    expect(SPIRE_TUNING[70]).toEqual(SPIRE_TUNING[60]);
    // Each Echo hits a little harder floor by floor (how tough it is
    // follows its floor's champions: see the play-test below).
    for (const f of [62, 63, 64, 66, 67, 68, 69])
      expect(SPIRE_TUNING[f].power, `floor ${f}`).toBeGreaterThan(
        SPIRE_TUNING[f - 1 === 65 ? 64 : f - 1].power,
      );
    expect(SPIRE_TUNING[61].power).toBeGreaterThanOrEqual(
      SPIRE_TUNING[59].power - 0.08,
    );
    expect(SPIRE_TUNING[61].power).toBeLessThanOrEqual(
      SPIRE_TUNING[59].power + 0.08,
    );
  });
  it("never spikes: a big party's Echoes hit at most ×1.2, and no polarity takes 60% of the frailest champion", () => {
    for (let f = 61; f <= 69; f++)
      expect(
        spireScale(f, 4).power / SPIRE_TUNING[f].power,
        `floor ${f}`,
      ).toBeLessThanOrEqual(1.2);
    // The captain's polarity at its hardest (a full party, doubled by a
    // same-sign neighbour), on the frailest.
    expect(P.damage * 2 * spireScale(65, 4).power).toBeLessThan(FRAILEST * 0.6);
  });
  it("loads every champion of the zone before the climb (the roster)", () => {
    const roster = spireRoster(7);
    for (const f of Object.values(SPIRE_FLOORS).filter((f) => f.zone === 7))
      for (const e of [
        ...f.waves.flat(),
        ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
      ])
        expect(roster).toContain(e.character);
    for (const c of SPIRE_ZONES[7].kin) expect(roster).toContain(c);
  });
  it("pays more than zone 6, more on the elite and the boss floor, and the summit's title on floor 70", () => {
    const coins = (f: number) =>
      spireRewardsOf(f)
        .filter((r) => r.kind === "coins")
        .reduce((n, r) => n + r.amount, 0);
    for (const f of [61, 62, 63, 64, 66, 67, 68, 69]) {
      expect(coins(f)).toBeGreaterThanOrEqual(115);
      expect(coins(f)).toBeLessThanOrEqual(130);
      expect(coins(f)).toBeGreaterThan(coins(f - 10));
      expect(coins(65)).toBeGreaterThan(coins(f));
      expect(coins(70)).toBeGreaterThan(coins(f));
    }
    expect(coins(65)).toBeGreaterThan(coins(55));
    expect(coins(70)).toBe(500);
    expect(coins(70)).toBeGreaterThan(coins(60));
    expect(spireRewardsOf(70).find((r) => r.kind === "title")?.item).toBe(
      "Stormbreaker of the Spire",
    );
    expect(spireRewardsOf(65).some((r) => r.kind === "title")).toBe(false);
  });
});

describe("a zone-7 room", () => {
  it("is the Spire's rules over the Storm Twins' arena, climbing 61 → 70 only", () => {
    const a = createSpireArena("Z7", 7);
    expect(a).toBeInstanceOf(SpireStormArena);
    expect(a).toBeInstanceOf(StormTwinsArena);
    expect(isSpireArena(a)).toBe(true);
    expect(a.zone).toBe(7);
    expect(a.raid.boss).toBe("storm-twins");
    expect(a.raid.spire).toMatchObject({
      zone: 7,
      floor: 61,
      startFloor: 61,
      ceiling: 70,
    });
    a.configureSpire({ startFloor: 1, ceiling: 80 });
    expect(a.raid.spire).toMatchObject({ startFloor: 61, ceiling: 70 });
    a.configureSpire({ startFloor: 51, ceiling: 60 });
    expect(a.raid.spire).toMatchObject({ startFloor: 61, ceiling: 61 });
    // Zone 6's room never climbs into zone 7.
    const six = createSpireArena("Z6", 6);
    expect(six).toBeInstanceOf(SpireEmberArena);
    six.configureSpire({ startFloor: 61, ceiling: 70 });
    expect(six.raid.spire).toMatchObject({ startFloor: 60, ceiling: 60 });
    // A plain Storm Twins raid is no climb.
    expect(isSpireArena(createRaidArena("R", "storm-twins"))).toBe(false);
  });
  it("fights its wave floors on the Spire's court: no twins, beam, fields, rushes or polarity", () => {
    seeded(701);
    const a = climb();
    expect(a.raid.spire).toMatchObject({ floor: 61, kind: "wave", zone: 7 });
    expect(a.raid.spire!.roster).toEqual(spireRoster(7));
    ringOff(a);
    expect(a.walls()).toBe(spireCourtWalls({ floor: 61, kind: "wave" }));
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a)[0]?.character).toBe(
      SPIRE_FLOORS[61].waves[0][0].character,
    );
    // The phone target row lists the Echoes; the twins' buttons are off.
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    expect(stormTarget(snap(a))).toBeUndefined();
    // The HUD: the floor's progress, no twin bars.
    const hud = raidHudView(snap(a), a.heroes()[0]);
    expect(hud.stormTwins).toBe(false);
    expect(hud.twins).toEqual([]);
    // No twins: their summed health is 0, and that never clears a floor.
    run(a, 10);
    ringOff(a);
    expect(a.raid.warnings).toEqual([]);
    expect(a.raid.polarities ?? []).toEqual([]);
    expect(a.raid.spire!.clearedAt).toBeUndefined();
    expect(a.raid.result).toBeNull();
    clearFloor(a);
    expect(a.raid.spire!.floor).toBe(62);
    expect(a.phase).toBe("intermission");
    expect(a.raid.spire!.offers.p0).toHaveLength(SPIRE_OFFER);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([61]);
    ringOff(a);
  });
  it("lets raiders hurt the Echoes, never a teammate; the twins' drags and blocks touch no Echo", () => {
    seeded(702);
    const a = climb(["coilemur", "wombolder"]);
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const [coil, wom] = a.heroes();
    const foe = echoes(a).find((p) => p.hp > 0)!;
    const hp = (foe.hp = 500);
    a.damage(foe, 40, coil.id);
    expect(hp - foe.hp).toBeCloseTo(40 * spireScale(61, 2).armour, 4);
    // Coilemur's Electromagnet and Duskveil's Wraith Hunt only drag a twin.
    for (const id of ["electromagnet", "wraith-hunt"]) {
      const ability = [
        ...CHARACTERS.coilemur.skills,
        ...CHARACTERS.duskveil.skills,
      ].find((s) => s.id === id) as Ability;
      expect(ability, id).toBeDefined();
      Object.assign(foe, { x: 900, y: 450, hp: 500 });
      Object.assign(coil, { x: 600, y: 450 });
      a.damage(foe, 10, coil.id, { ...ability, knockback: 0 });
      expect(foe.x, id).toBe(900);
      expect(foe.y, id).toBe(450);
      expect(foe.hp).toBeLessThan(500);
    }
    // Wombolder's brace stops a Twin Rush only: an Echo's hit lands.
    wom.hp = 300;
    wom.statuses.push({ kind: "brace", until: a.time + 5 } as never);
    a.damage(wom, 30, foe.id);
    expect(wom.hp).toBeLessThan(300);
    // Never a teammate.
    const before = wom.hp;
    a.damage(wom, 40, coil.id);
    expect(wom.hp).toBe(before);
  });
  it("lets Halcyra's Focus Shot be its own on the Echo floors (it pierces only into a twin)", () => {
    seeded(703);
    const a = climb(["halcyra"]);
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const me = a.heroes()[0];
    const shot = CHARACTERS.halcyra.skills.find(
      (s) => s.id === "focus-shot",
    ) as Ability;
    expect(shot).toBeDefined();
    // Two Echoes in a line: the twins' pierce looks for twins only.
    const list = echoes(a).filter((p) => p.hp > 0);
    expect(list.length).toBeGreaterThanOrEqual(1);
    for (const [i, p] of list.entries())
      Object.assign(p, { x: 700 + i * 90, y: 450, hp: 500 });
    Object.assign(me, { x: 500, y: 450, angle: 0 });
    const line = (
      a as unknown as { onLine(p: Fighter, a: Ability): Fighter[] }
    ).onLine(me, shot);
    expect(line).toEqual([]);
    ringOff(a);
  });
  it("lets a stand-in play the Spire's court, not the twins' balancing", () => {
    seeded(704);
    const a = climb();
    toPlaying(a);
    const me = a.heroes()[0];
    expect(
      hidden(a).botHint(me, { ...me.lastInput }, () => ({})),
    ).toBeUndefined();
    // Not even with a beam and a field at its feet.
    a.raid.stormFields = [
      {
        id: 1,
        x: me.x,
        y: me.y,
        radius: 100,
        until: a.time + 9,
        casterId: "x",
      },
    ];
    expect(
      hidden(a).botHint(me, { ...me.lastInput }, () => ({ basic: true })),
    ).toBeUndefined();
  });
  it("ends at floor 69 for a party without a Storm Twins clear (the server's ceiling)", () => {
    seeded(705);
    expect(
      spireStartFrom(
        [{ checkpoint: 61, clears: { grumblecrag: 1, emberwing: 1 } }],
        7,
      ).ceiling,
    ).toBe(69);
    const a = climb(["voltkit"], { startFloor: 69, ceiling: 69 });
    toPlaying(a);
    clearFloor(a);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.spire!.best).toBe(69);
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    expect(a.raid.message).toMatch(/Floor 69 cleared/);
  });
  it("climbs again from floor 61 after a defeat", () => {
    seeded(706);
    const a = climb(["voltkit"], { startFloor: 61, ceiling: 70 });
    toPlaying(a);
    run(a, 1);
    for (let i = 0; i < 400 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, echoes(a).find((e) => e.hp > 0)?.id ?? "");
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Climb again from floor 61/);
    a.retry();
    expect(a.raid.spire).toMatchObject({ floor: 61, startFloor: 61 });
  });
});

describe("the elite (floor 65): the twins' Polarity", () => {
  const toCaptain = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 65 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    return a;
  };
  const startPolarity = (a: SpireStormArena, target: Fighter) =>
    hidden(a).startAttack("polarity", target);
  it("is an Echo captain, drawn as its champion, with a boss bar that plays only polarity", () => {
    seeded(711);
    const a = toCaptain();
    const elite = a.boss()!;
    expect(elite).toMatchObject({
      echo: true,
      elite: true,
      team: 1,
      character: "coilemur",
      name: "Echo Captain Coilemur",
    });
    expect(elite.raidBoss).toBeFalsy();
    expect(a.raid.bossId).toBe(elite.id);
    expect(a.raid.message).toMatch(/the Storm Twins' polarity/);
    // No twin metadata: the client draws no twin body (it draws r.twins).
    expect(a.raid.twins ?? []).toEqual([]);
    const kinds = new Set<string>();
    let casts = 0,
      cue = "";
    run(a, 30, () => {
      for (const w of a.raid.warnings) kinds.add(w.kind);
      if (a.raid.polarities?.length && !cue) cue = spireCue(snap(a));
      if (
        a.raid.polarities?.length &&
        a.raid.polarities.every((m) => m.until - a.time > P.seconds - 0.05)
      )
        casts++;
    });
    expect([...kinds]).toEqual(["polarity"]);
    expect(casts).toBeGreaterThanOrEqual(3);
    // The HUD names it while marks are up.
    expect(cue).toBe(SPIRE_ELITE_MECHANICS.polarity.cue);
    ringOff(a);
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // Escorts at half health.
    elite.hp = a.raid.maxHp * 0.45;
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a).filter((p) => !p.elite && p.hp > 0).length).toBe(1);
    expect(echoes(a).find((p) => !p.elite)?.character).toBe("voltkit");
  });
  it("staggers like any captain: the twins' per-twin stagger never blocks it", () => {
    seeded(712);
    const a = toCaptain();
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    const me = a.heroes()[0];
    expect(a.raid.stagger).toBe(0);
    elite.hp = 5000;
    a.damage(elite, 50, me.id);
    expect(a.raid.stagger).toBeGreaterThan(0);
    for (let i = 0; i < 200 && a.raid.staggerUntil <= a.time; i++) {
      elite.hp = 5000;
      a.damage(elite, 60, me.id);
      a.tick(DT);
    }
    expect(a.raid.staggerUntil).toBeGreaterThan(a.time);
    expect(spireCue(snap(a))).toBe("The captain reels — hit it now!");
  });
  it("lays the solo pad a fair walk away: on the court, off the walls, never under the controls", () => {
    for (const floor of [65, 61, 62, 63, 64]) {
      const spots = openSpots(floor, floor === 65 ? "elite" : "wave");
      for (const at of spots) {
        const pad = spirePolarityPad(at);
        expect(pad, `floor ${floor} at ${at.x},${at.y}`).toBeDefined();
        expect(spirePadOpen(pad!.x, pad!.y)).toBe(true);
        expect(spireUnderControls(pad!.x, pad!.y, P.padRadius)).toBe(false);
        expect(blocked(pad!.x, pad!.y, P.padRadius)).toBe(false);
        // The slowest champion steps onto it in time, after reacting.
        const walk = Math.max(
          0,
          Math.hypot(pad!.x - at.x, pad!.y - at.y) - P.padRadius,
        );
        expect(
          walk / RAID_SLOWEST_SPEED + SPIRE_POLARITY_REACTION,
        ).toBeLessThan(P.seconds - 0.25);
        // ...and has to move to (it never lies under them).
        expect(Math.hypot(pad!.x - at.x, pad!.y - at.y)).toBeGreaterThan(
          P.padRadius,
        );
      }
    }
    // A raider standing under the controls gets a pad on open ground.
    const thumb = { x: 1300, y: 600 };
    expect(spireUnderControls(thumb.x, thumb.y)).toBe(true);
    useObstacles([]);
    const pad = spirePolarityPad(thumb)!;
    expect(spireUnderControls(pad.x, pad.y, P.padRadius)).toBe(false);
  });
  it("gives every raider of a party an answer in reach: an opposite sign, or the pad", () => {
    const walk = spirePolarityWalk();
    expect(walk).toBeCloseTo(
      RAID_SLOWEST_SPEED * (P.seconds - SPIRE_POLARITY_REACTION - 0.3),
      6,
    );
    const random = rng(7);
    let pads = 0,
      plans = 0;
    for (const floor of [65, 61, 63, 64]) {
      const spots = openSpots(floor, floor === 65 ? "elite" : "wave");
      for (let k = 0; k < 150; k++) {
        const n = 2 + (k % 3);
        // Parties spread over the court, some bunched, some far apart.
        const centre = spots[Math.floor(random() * spots.length)];
        const spread = k % 2 ? 160 : 900;
        const team = Array.from({ length: n }, () => {
          const near = spots.filter(
            (s) => Math.hypot(s.x - centre.x, s.y - centre.y) <= spread,
          );
          return near[Math.floor(random() * near.length)] ?? centre;
        });
        const plan = spirePolarityPlan(team, k);
        if (!plan) continue;
        plans++;
        expect(plan.signs).toHaveLength(n);
        if (plan.pad) {
          pads++;
          expect(spirePadOpen(plan.pad.x, plan.pad.y)).toBe(true);
        }
        team.forEach((p, i) => {
          const partner = team.some(
            (q, j) =>
              plan.signs[j] !== plan.signs[i] &&
              Math.hypot(q.x - p.x, q.y - p.y) - P.range <= walk,
          );
          const padOk =
            !!plan.pad &&
            plan.pad.sign !== plan.signs[i] &&
            Math.hypot(plan.pad.x - p.x, plan.pad.y - p.y) - P.padRadius <=
              walk;
          expect(
            partner || padOk,
            `floor ${floor} party ${k} raider ${i}`,
          ).toBe(true);
        });
      }
    }
    expect(plans).toBeGreaterThan(500);
    // Spread-out parties sometimes need the pad.
    expect(pads).toBeGreaterThan(0);
    // A lone raider always gets the pad of the other sign.
    useObstacles([]);
    const solo = spirePolarityPlan([{ x: 400, y: 400 }], 3)!;
    expect(solo.pad).toBeDefined();
    expect(solo.pad!.sign).toBe(solo.signs[0] === 1 ? -1 : 1);
  });
  it("cancels by the pad or an opposite sign, hurts the one who stays away once, and doubles by a same sign", () => {
    seeded(713);
    const a = toCaptain(["voltkit", "lumoth", "glacelle"]);
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    for (const e of echoes(a)) if (e !== elite) e.hp = 0;
    hidden(a).nextAttack = a.time + 999;
    a.raid.warnings = [];
    const [x, y, z] = a.heroes();
    // Three far apart: x alone; y and z together, same sign.
    Object.assign(x, { x: 300, y: 300 });
    Object.assign(y, { x: 900, y: 250 });
    Object.assign(z, { x: 960, y: 250 });
    a.raid.polarities = [
      { playerId: x.id, sign: 1, until: a.time + 1, cancelled: false },
      { playerId: y.id, sign: -1, until: a.time + 1, cancelled: false },
      { playerId: z.id, sign: -1, until: a.time + 1, cancelled: false },
    ];
    a.raid.polarityPad = undefined;
    const hp = new Map<string, number>();
    const hits = new Map<string, number>();
    run(
      a,
      2,
      () => {
        Object.assign(x, { x: 300, y: 300 });
        Object.assign(y, { x: 900, y: 250 });
        Object.assign(z, { x: 960, y: 250 });
        for (const p of [x, y, z]) {
          const was = hp.get(p.id);
          if (was !== undefined && p.hp < was)
            hits.set(p.id, (hits.get(p.id) ?? 0) + 1);
          p.hp = 2000;
          hp.set(p.id, p.hp);
        }
      },
      false,
    );
    const power = spireScale(65, 3).power;
    // Each hurt once: x for its plain mark, y and z twice as hard.
    expect(hits.get(x.id)).toBe(1);
    expect(hits.get(y.id)).toBe(1);
    expect(hits.get(z.id)).toBe(1);
    expect(a.raid.polarities ?? []).toEqual([]);
    // (Their sizes: measured on fresh marks.)
    const once = (o: { sx: number; sy: number }) => {
      a.raid.polarities = [
        { playerId: x.id, sign: 1, until: a.time + 0.5, cancelled: false },
        { playerId: y.id, sign: -1, until: a.time + 0.5, cancelled: false },
        { playerId: z.id, sign: -1, until: a.time + 0.5, cancelled: false },
      ];
      a.raid.polarityPad = { x: 600, y: 600, sign: -1, until: a.time + 0.5 };
      const lost = new Map<string, number>();
      run(
        a,
        1,
        () => {
          Object.assign(x, { x: o.sx, y: o.sy });
          Object.assign(y, { x: 900, y: 250 });
          Object.assign(z, { x: 960, y: 250 });
          for (const p of [x, y, z]) {
            lost.set(p.id, (lost.get(p.id) ?? 0) + Math.max(0, 2000 - p.hp));
            p.hp = 2000;
          }
        },
        false,
      );
      return lost;
    };
    // x stays away: plain hit; y, z side by side, same sign: double.
    let lost = once({ sx: 300, sy: 300 });
    expect(lost.get(x.id)).toBeCloseTo(P.damage * power, 3);
    expect(lost.get(y.id)).toBeCloseTo(P.damage * 2 * power, 3);
    // x on the opposite pad: cancelled.
    lost = once({ sx: 600, sy: 600 });
    expect(lost.get(x.id)).toBe(0);
    // x beside y (opposite signs): both cancelled; z, beside y, too.
    lost = once({ sx: 880, sy: 300 });
    expect(lost.get(x.id)).toBe(0);
    expect(lost.get(y.id)).toBe(0);
  });
  it("lets a raider off when every opposite sign went down, and takes the marks away with the captain", () => {
    seeded(714);
    const a = toCaptain(["voltkit", "terradon"]);
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    hidden(a).nextAttack = a.time + 999;
    const [x, y] = a.heroes();
    Object.assign(x, { x: 300, y: 300 });
    Object.assign(y, { x: 1000, y: 300 });
    a.raid.polarities = [
      { playerId: x.id, sign: 1, until: a.time + 1, cancelled: false },
      { playerId: y.id, sign: -1, until: a.time + 1, cancelled: false },
    ];
    y.hp = 0;
    x.hp = 2000;
    run(a, 1.5, () => Object.assign(x, { x: 300, y: 300 }), false);
    expect(x.hp).toBe(2000);
    // The captain falls: its marks go with it.
    a.raid.polarities = [
      { playerId: x.id, sign: 1, until: a.time + 1, cancelled: false },
    ];
    a.raid.polarityPad = { x: 600, y: 300, sign: -1, until: a.time + 1 };
    elite.hp = 0;
    a.tick(DT);
    expect(a.raid.polarities).toEqual([]);
    expect(a.raid.polarityPad).toBeUndefined();
  });
  it("never lays a second polarity over a live one, even once a stagger wiped its warning", () => {
    seeded(716);
    const a = toCaptain(["voltkit", "lumoth"]);
    const [x, y] = a.heroes();
    const live = [
      { playerId: x.id, sign: 1 as const, until: a.time + 3, cancelled: false },
      {
        playerId: y.id,
        sign: -1 as const,
        until: a.time + 3,
        cancelled: false,
      },
    ];
    a.raid.polarities = live.map((m) => ({ ...m }));
    a.raid.warnings = [];
    hidden(a).nextAttack = a.time;
    hidden(a).startAttack("polarity", x);
    for (let i = 0; i < 20; i++) {
      hidden(a).nextAttack = a.time;
      a.tick(DT);
    }
    expect(a.raid.polarities!.map((m) => m.until)).toEqual(
      live.map((m) => m.until),
    );
  });
  it("answers its own mark as a stand-in: onto the pad, or beside the opposite sign", () => {
    seeded(715);
    const a = toCaptain(["voltkit"]);
    const me = a.heroes()[0];
    a.raid.polarities = [
      { playerId: me.id, sign: 1, until: a.time + 3, cancelled: false },
    ];
    a.raid.polarityPad = {
      x: me.x + 150,
      y: me.y,
      sign: -1,
      until: a.time + 3,
    };
    const go = vi.fn((x: number, y: number) => ({ goX: x, goY: y }));
    hidden(a).botHint(me, { ...me.lastInput }, go);
    expect(go).toHaveBeenCalledWith(me.x + 150, me.y, false);
  });
  it.each([1, 2, 4])(
    "keeps the raid honesty rules with %i raider(s) (one polarity at a time, a fair answer, nothing under the controls, a mark hurts once)",
    (size) => {
      seeded(720 + size);
      const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "glacelle"];
      const a = toCaptain(team.slice(0, size));
      for (const p of a.heroes()) a.standIn(p.id);
      const problems: string[] = [];
      let casts = 0,
        biggest = 0,
        wasLive = 0;
      const hp = new Map<string, number>();
      let marks: string | undefined;
      const hurt = new Map<string, number>();
      const damage = a.damage.bind(a);
      a.damage = (t: Fighter, amount: number, owner: string, ab?: Ability) => {
        if ((a as unknown as { hitBy?: string }).hitBy === "polarity") {
          hurt.set(t.id, (hurt.get(t.id) ?? 0) + 1);
          if ((hurt.get(t.id) ?? 0) > 1)
            problems.push("hurt twice by one polarity");
        }
        return damage(t, amount, owner, ab);
      };
      run(
        a,
        90,
        () => {
          const elite = a.boss();
          if (elite) elite.hp = Math.max(elite.hp, a.raid.maxHp * 0.6);
          for (const p of a.heroes()) {
            const was = hp.get(p.id);
            if (was !== undefined && was > p.hp)
              biggest = Math.max(biggest, was - p.hp);
            p.hp = 9999;
            hp.set(p.id, p.hp);
          }
          const now = a.raid.polarities ?? [];
          const key = now.length
            ? now.map((m) => `${m.playerId}${m.until}`).join("|")
            : undefined;
          if (key && key !== marks) {
            // A fresh set of marks: never laid over a live one.
            if (marks)
              problems.push(
                `a polarity over a live one at ${a.time.toFixed(2)}`,
              );
            casts++;
            hurt.clear();
            if (now.some((m) => m.until - a.time < P.seconds - 0.1 - EPS))
              problems.push("marks shown too briefly");
            if (new Set(now.map((m) => m.playerId)).size !== now.length)
              problems.push("two marks on one raider");
            if (now.length !== a.heroes().filter((p) => p.hp > 0).length)
              problems.push("a raider left unmarked");
            const pad = a.raid.polarityPad;
            a.walls();
            if (pad && !spirePadOpen(pad.x, pad.y))
              problems.push(
                `a pad under the controls or a wall at ${pad.x},${pad.y}`,
              );
            // Everyone has an answer in reach.
            const walk = spirePolarityWalk(now[0].until - a.time);
            for (const m of now) {
              const p = a.heroes().find((q) => q.id === m.playerId)!;
              const partner = now.some((n) => {
                const q = a.heroes().find((h) => h.id === n.playerId)!;
                return (
                  n.sign !== m.sign &&
                  Math.hypot(q.x - p.x, q.y - p.y) - P.range <= walk + 5
                );
              });
              const padOk =
                !!pad &&
                pad.sign !== m.sign &&
                Math.hypot(pad.x - p.x, pad.y - p.y) - P.padRadius <= walk + 5;
              if (!partner && !padOk) problems.push("no answer in reach");
            }
          }
          if (!key) marks = undefined;
          else marks = key;
          const threats = a.liveThreats();
          if (threats > 1 && threats > wasLive)
            problems.push(`${threats} attacks live`);
          wasLive = threats;
        },
        false,
      );
      expect(problems.slice(0, 8)).toEqual([]);
      expect(casts).toBeGreaterThan(5);
      // (Echo skills hit too; none of it, polarity included, is a spike.)
      expect(biggest).toBeLessThan(FRAILEST * 0.6);
    },
    60_000,
  );
});

describe("the elite's HUD line on floor 65", () => {
  it("names the twins' polarity before its first cast", () => {
    seeded(741);
    const a = climb(["voltkit"], { startFloor: 65 });
    toPlaying(a);
    a.raid.warnings = [];
    a.raid.polarities = [];
    expect(spireCue(snap(a))).toBe(
      "Echo Captain · it borrowed the Storm Twins' polarity",
    );
  });
});

describe("the boss floor (floor 70: the Ascendant Storm Twins, in the Conductor Ring)", () => {
  const toSeventy = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 69, ceiling: 70 });
    toPlaying(a);
    clearFloor(a);
    return a;
  };
  const begin = (a: SpireStormArena) => {
    const s = a.raid.spire!;
    for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
    for (const p of a.heroes()) a.pickRite(p.id, s.offers[p.id][0]);
    toPlaying(a);
  };
  it("briefs the Ascendant in the same room, on its ring, with both twins named and their health split", () => {
    seeded(731);
    const a = climb(["voltkit"], { startFloor: 69, ceiling: 70 });
    toPlaying(a);
    // The court is laid with the Ascendant's rules on.
    const seen: (string | undefined)[] = [];
    const lay = a as unknown as { setupArena(): void };
    const proto = Object.getPrototypeOf(a) as { setupArena(): void };
    lay.setupArena = function () {
      seen.push(a.raid.variant);
      proto.setupArena.call(this);
    };
    clearFloor(a);
    const s = a.raid.spire!;
    expect(a.raid.result).toBeNull();
    expect(s).toMatchObject({ floor: 70, kind: "boss", best: 69, zone: 7 });
    expect(seen.at(-1)).toBe("ascendant");
    expect(a.phase).toBe("briefing");
    expect(a.raid.variant).toBe("ascendant");
    expect(a.raid.name).toBe("Ascendant Storm Twins");
    expect(a.arenaId).toBe("conductor-ring");
    expect(a.arenaId).toBe(SPIRE_ZONES[7].court);
    expect(a.walls()).toEqual([]);
    const twins = a.players.filter((p) => p.raidBoss);
    expect(twins.map((p) => p.name)).toEqual(["Fizz", "Crackle"]);
    expect(a.raid.twins!.map((t) => t.name)).toEqual(["Fizz", "Crackle"]);
    for (const [i, p] of twins.entries()) {
      expect(p.hp).toBe(a.raid.maxHp / 2);
      expect(a.raid.twins![i]).toMatchObject({ id: p.id, maxHp: p.hp });
    }
    expect(a.raid.maxHp).toBeGreaterThan(2);
    expect(a.raid.gilded).toBe(false);
    expect(a.raid.twinRevivals).toBe(0);
    expect(echoes(a)).toEqual([]);
    // Both twins confirm themselves; the raiders read the briefing.
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("intermission");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    // The HUD: the summed bar and both twins' own, the raid's name.
    const hud = raidHudView(snap(a), a.heroes()[0]);
    expect(hud.stormTwins).toBe(true);
    expect(hud.twins.map((t) => t.name)).toEqual(["Fizz", "Crackle"]);
    expect(hud.health).toBeCloseTo(100, 3);
    expect(hud.title).toMatch(/ASCENDANT STORM TWINS/);
    expect(hud.spire).toMatchObject({ bar: "boss" });
    expect(hud.key).toContain(twins[0].id);
    // The twins' own deck.
    const kinds = new Set<string>();
    run(a, 60, () => a.raid.warnings.forEach((w) => kinds.add(w.kind)));
    expect(
      kinds.has("polarity") ||
        kinds.has("link-beam") ||
        kinds.has("chain-lightning"),
    ).toBe(true);
    expect(kinds.has("eruption")).toBe(false);
  });
  it("lays floor 70's pieces clear of the phone's controls: the twins, the copper posts, the polarity pad", () => {
    seeded(732);
    const a = toSeventy();
    for (const p of a.players.filter((q) => q.raidBoss))
      expect(
        spireUnderControls(p.x, p.y, STORM_TWINS.radius),
        `${p.name} at ${p.x},${p.y}`,
      ).toBe(false);
    for (const post of STORM_TWINS.posts)
      expect(spireUnderControls(post.x, post.y), `${post.x},${post.y}`).toBe(
        false,
      );
    // (The Spire's own spots, if a layout put a twin under a thumb, are clear.)
    for (const spot of SPIRE_TWIN_SPAWNS)
      expect(spireUnderControls(spot.x, spot.y, STORM_TWINS.radius)).toBe(
        false,
      );
    begin(a);
    const me = a.heroes()[0];
    a.walls();
    for (const at of [
      { x: 1150, y: 300 },
      { x: 1450, y: 420 },
      { x: 300, y: 450 },
      { x: 900, y: 800 },
      { x: 200, y: 520 },
      { x: 1100, y: 640 },
    ]) {
      a.raid.polarities = [];
      a.raid.polarityPad = undefined;
      a.raid.warnings = [];
      Object.assign(me, at);
      hidden(a).startAttack("polarity", me);
      const pad = a.raid.polarityPad;
      expect(pad, `${at.x},${at.y}`).toBeDefined();
      expect(spirePadOpen(pad!.x, pad!.y), `${at.x},${at.y}`).toBe(true);
    }
  });
  it("counts blessings in the boss fight", () => {
    seeded(733);
    const a = toSeventy();
    begin(a);
    const s = a.raid.spire!;
    const boss = a.boss()!,
      p = a.heroes()[0];
    const hit = (target: Fighter, from: string) => {
      const hp = (target.hp = 9999);
      a.damage(target, 40, from);
      return hp - target.hp;
    };
    s.blessings.p0 = {};
    a.raid.phase = 3;
    const plain = hit(boss, p.id),
      taken = hit(p, boss.id);
    expect(plain).toBeGreaterThan(0);
    s.blessings.p0 = { keen: 1, stoneskin: 1 };
    expect(hit(boss, p.id)).toBeCloseTo(plain * 1.1, 4);
    expect(hit(p, boss.id)).toBeCloseTo(taken * 0.9, 4);
  });
  it("needs both twins down; then saves floor 70 and ends the climb: the whole Spire conquered", () => {
    seeded(734);
    const a = toSeventy();
    begin(a);
    run(a, 3);
    a.spire.pending = [];
    const s = a.raid.spire!;
    const [fizz, crackle] = a.players.filter((p) => p.raidBoss);
    a.raid.phase = 3;
    // One twin down: the floor goes on.
    a.damage(fizz, 99999, a.heroes()[0].id);
    run(a, 0.2);
    expect(fizz.hp).toBe(0);
    expect(s.clearedAt).toBeUndefined();
    // Both: cleared.
    crackle.hp = 0;
    run(a, 0.1);
    expect(s.clearedAt).toBeDefined();
    expect(s.best).toBe(70);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([70]);
    expect(a.raid.warnings).toEqual([]);
    run(a, SPIRE_PARTY.cleared + 0.2);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.message).toBe("Zone 7 conquered — the Spire is yours.");
    a.retry();
    expect(s).toMatchObject({ startFloor: 69, floor: 69, blessings: {} });
    expect(a.raid.variant).toBeUndefined();
    ringOff(a);
  });
  it("loses the climb on a defeat by the Ascendant", () => {
    seeded(735);
    const a = toSeventy();
    begin(a);
    hidden(a).selfUsed = true;
    for (let i = 0; i < 300 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, a.boss()!.id);
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Ascendant Storm Twins stand unbroken/);
  });
});

/**
 * Play-test by simulation, as the zones below: a Normal bot raider alone,
 * with the blessings it would hold by then on a climb from floor 61 (none
 * on 61).
 */
function playFloor(floor: number, seed: number) {
  seeded(seed * 7919);
  const a = createSpireArena("SIM" + seed, 7);
  a.add("p0", "P0", "voltkit");
  a.configureSpire({ startFloor: floor, ceiling: floor });
  a.start();
  const mine = (a.raid.spire!.blessings.p0 = {} as Record<string, number>);
  for (let f = 62; f <= floor; f++) {
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
describe("play-test (bot raiders vs zone 7)", () => {
  it("floor 61 is often cleared solo with no blessings; floor 69 less often, but sometimes", () => {
    const seeds = Array.from({ length: 24 }, (_, i) => i + 1);
    const rate = (floor: number) =>
      seeds.filter((s) => playFloor(floor, s)).length / seeds.length;
    const first = rate(61),
      last = rate(69);
    expect(first).toBeGreaterThanOrEqual(0.5);
    expect(first).toBeLessThan(1);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(first);
  }, 180_000);
});

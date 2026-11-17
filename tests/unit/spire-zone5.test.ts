/**
 * The Spire's zone 5, the Sun Atrium (floors 41–50): its floors and
 * numbers, a room for the zone (SpireLightArena: the Spire's rules over
 * Prismell's arena), the elite on floor 45 with Prismell's Prism Lances
 * (the raid honesty rules, a gap always within reach, never under a
 * phone's touch controls), and the Ascendant Prismell on floor 50 in the
 * same room, in the Sun Atrium.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CHARACTERS,
  RULES,
  blocked,
  type Ability,
  type CharacterId,
  type Fighter,
  type Input,
  type Snapshot,
} from "@arena/shared";
import {
  SPIRE_LANCE_COUNT,
  SPIRE_LANCE_MIN,
  SPIRE_LANCE_SPREAD,
  SPIRE_LANCE_TEACH,
  SpireDreamArena,
  SpireLightArena,
  createSpireArena,
  isSpireArena,
  spireLances,
} from "../../apps/server/src/spire";
import { PrismatailArena } from "../../apps/server/src/raid-prismatail";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { RAID_SLOWEST_SPEED } from "../../apps/server/src/raid-ai";
import {
  PRISMATAIL,
  RAID_TELEGRAPH_FLOOR,
  type RaidWarning,
} from "../../packages/shared/src/raid";
import {
  SPIRE_BUILT_TOP,
  SPIRE_CONTROL_MARGIN,
  SPIRE_ELITE_MECHANICS,
  SPIRE_FLOORS,
  SPIRE_OFFER,
  SPIRE_PARTY,
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
  SPIRE_ATRIUM_SUMMIT_FLOOR,
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
  const a = createSpireArena("LIGHT1", 5) as SpireLightArena;
  chars.forEach((c, i) => a.add("p" + i, "P" + i, c));
  a.configureSpire({
    startFloor: o.startFloor ?? 41,
    ceiling: o.ceiling ?? 49,
  });
  a.start();
  for (const p of a.heroes()) a.acknowledgeInstructions(p.id);
  return a;
}
function run(
  a: SpireLightArena,
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
const echoes = (a: SpireLightArena) => a.players.filter((p) => p.echo);
const killEchoes = (a: SpireLightArena) => {
  for (const p of echoes(a)) if (p.hp > 0) p.hp = 0;
};
const toPlaying = (a: SpireLightArena) => {
  for (let i = 0; i < 400 && a.phase !== "playing"; i++) a.tick(DT);
  expect(a.phase).toBe("playing");
};
/** Beat every wave of the floor in play, then wait for the next floor. */
const clearFloor = (a: SpireLightArena) => {
  for (let i = 0; i < 12 && a.raid.spire!.clearedAt === undefined; i++) {
    run(a, 1.2);
    killEchoes(a);
    run(a, SPIRE_PARTY.waveGap + 0.2);
  }
  run(a, SPIRE_PARTY.cleared + 0.2);
};
/** What the client receives (enough of it for the client's helpers). */
const snap = (a: SpireLightArena) => a.snapshot() as unknown as Snapshot;
/** Prismell's atrium, off: nothing of its raid on the court. */
const atriumOff = (a: SpireLightArena) => {
  const r = a.raid;
  expect(r.mirrors ?? []).toEqual([]);
  expect(r.lightLinks ?? []).toEqual([]);
  expect(r.sunPillars ?? []).toEqual([]);
  expect(r.lightHold ?? 0).toBe(0);
  expect(r.blinded ?? {}).toEqual({});
  expect(a.arenaId).toBe("classic");
};
/** Points along a warning's lane, every few px. */
const along = (w: { x: number; y: number; tx: number; ty: number }) => {
  const n = Math.ceil(Math.hypot(w.tx - w.x, w.ty - w.y) / 4);
  return Array.from({ length: n + 1 }, (_, i) => ({
    x: w.x + ((w.tx - w.x) * i) / Math.max(1, n),
    y: w.y + ((w.ty - w.y) * i) / Math.max(1, n),
  }));
};
const toSegment = (
  p: { x: number; y: number },
  w: { x: number; y: number; tx: number; ty: number },
) => {
  const dx = w.tx - w.x,
    dy = w.ty - w.y,
    t = Math.max(
      0,
      Math.min(
        1,
        ((p.x - w.x) * dx + (p.y - w.y) * dy) / (dx * dx + dy * dy || 1),
      ),
    );
  return Math.hypot(p.x - w.x - t * dx, p.y - w.y - t * dy);
};

describe("Spire floors (zone 5, the Sun Atrium)", () => {
  const kin = new Set<string>(SPIRE_ZONES[5].kin);
  it("is Prismell's zone: the Sun Atrium for its boss, Light rosters", () => {
    expect(SPIRE_ZONES[5]).toMatchObject({
      id: 5,
      name: "Sun Atrium",
      boss: "prismatail",
      court: "sun-atrium",
      element: "Light",
      ascendant: "Ascendant Prismell",
      bossName: "Prismell",
    });
    for (const c of SPIRE_ZONES[5].kin) expect(CHARACTERS[c]).toBeDefined();
    expect(
      SPIRE_ZONES[5].kin.filter((c) => CHARACTERS[c].element === "Light")
        .length,
    ).toBeGreaterThanOrEqual(2);
    // Its briefing is its own, never another zone's.
    expect(SPIRE_ZONES[5].bossLead).toMatch(/Prismell/);
    expect(SPIRE_ZONES[5].bossLead).not.toMatch(
      /Cragmuff|Tidelotl|Inkpurr|Snoozaku/,
    );
    expect(SPIRE_ZONES[5].bossLead).toMatch(/sunbeam/);
    expect(SPIRE_ZONES[5].bossReads).toMatch(/you usually dodge to/);
    expect(SPIRE_ZONES[5].bossReads).toMatch(/kneels to revive/);
    // The Ascendant's new attacks, as the boss layer plays them.
    expect(SPIRE_ZONES[5].ascendantMoves).toEqual(["eclipse", "umbral-prism"]);
    expect(SPIRE_FLOORS[50].description).toBe(
      "New attacks: Eclipse, Umbral Prism",
    );
    expect(SPIRE_ZONES[5].bossLead).toMatch(/Eclipse/);
    expect(SPIRE_ZONES[5].bossLead).toMatch(/Umbral Prism/);
    expect(SPIRE_BUILT_TOP).toBeGreaterThanOrEqual(50);
  });
  it("has wave floors 41–44 and 46–49, the elite on 45 and the boss on 50", () => {
    for (const f of [41, 42, 43, 44, 46, 47, 48, 49]) {
      const def = SPIRE_FLOORS[f];
      expect(def.kind, `floor ${f}`).toBe("wave");
      expect(def.zone).toBe(5);
      expect(def.waves.length).toBeGreaterThanOrEqual(2);
      expect(def.waves.length).toBeLessThanOrEqual(3);
      const all = def.waves.flat();
      for (const e of all) expect(CHARACTERS[e.character]).toBeDefined();
      // Light-leaning, plus exactly one off-element champion.
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
    const offs = [41, 42, 43, 44, 46, 47, 48, 49].map(
      (f) =>
        SPIRE_FLOORS[f].waves.flat().find((e) => !kin.has(e.character))!
          .character,
    );
    expect(new Set(offs).size).toBe(offs.length);
    expect(SPIRE_FLOORS[45]).toMatchObject({ kind: "elite", zone: 5 });
    expect(SPIRE_FLOORS[45].elite?.mechanic).toBe("lances");
    expect(SPIRE_ELITE_MECHANICS.lances).toMatchObject({
      attack: "prism-lance",
      boss: "Prismell",
    });
    expect(SPIRE_FLOORS[50]).toMatchObject({
      kind: "boss",
      zone: 5,
      boss: "prismatail",
      name: "Ascendant Prismell",
    });
    // Short names, none repeated across the Spire.
    const names = Object.values(SPIRE_FLOORS).map((f) => f.name);
    expect(new Set(names).size).toBe(names.length);
    for (let f = 41; f <= 50; f++)
      expect(SPIRE_FLOORS[f].name.length).toBeLessThanOrEqual(24);
  });
  it("keeps its clocks: the elite's and the boss's as in the zones below", () => {
    for (let f = 41; f <= 49; f++)
      if (f !== 45) expect(SPIRE_TUNING[f].limit).toBe(SPIRE_TUNING[11].limit);
    expect(SPIRE_TUNING[45].limit).toBe(SPIRE_TUNING[15].limit);
    expect(SPIRE_TUNING[50]).toEqual(SPIRE_TUNING[40]);
    // Each Echo hits a little harder floor by floor (how tough it is
    // follows its floor's champions: see the play-test below).
    for (const f of [42, 43, 44, 46, 47, 48, 49])
      expect(SPIRE_TUNING[f].power, `floor ${f}`).toBeGreaterThan(
        SPIRE_TUNING[f - 1 === 45 ? 44 : f - 1].power,
      );
    expect(SPIRE_TUNING[41].power).toBeGreaterThanOrEqual(
      SPIRE_TUNING[39].power - 0.08,
    );
  });
  it("loads every champion of the zone before the climb (the roster)", () => {
    const roster = spireRoster(5);
    for (const f of Object.values(SPIRE_FLOORS).filter((f) => f.zone === 5))
      for (const e of [
        ...f.waves.flat(),
        ...(f.elite ? [f.elite.captain, ...f.elite.escorts] : []),
      ])
        expect(roster).toContain(e.character);
    for (const c of SPIRE_ZONES[5].kin) expect(roster).toContain(c);
    // The other zones' rosters are their own.
    expect(spireRoster(4)).not.toContain("sunbara");
    expect(spireRoster(3)).not.toContain("sunbara");
  });
  it("pays more than zone 4, more on the elite and the boss floor, and a title on floor 50", () => {
    const coins = (f: number) =>
      spireRewardsOf(f)
        .filter((r) => r.kind === "coins")
        .reduce((n, r) => n + r.amount, 0);
    for (const f of [41, 42, 43, 44, 46, 47, 48, 49]) {
      expect(coins(f)).toBeGreaterThanOrEqual(85);
      expect(coins(f)).toBeLessThanOrEqual(100);
      expect(coins(f)).toBeGreaterThan(coins(f - 10));
      expect(coins(45)).toBeGreaterThan(coins(f));
      expect(coins(50)).toBeGreaterThan(coins(f));
    }
    expect(coins(45)).toBeGreaterThan(coins(35));
    expect(coins(50)).toBe(350);
    expect(coins(50)).toBeGreaterThan(coins(40));
    expect(spireRewardsOf(50).find((r) => r.kind === "title")?.item).toBe(
      "Sunbreaker of the Spire",
    );
    expect(spireRewardsOf(45).some((r) => r.kind === "title")).toBe(false);
  });
});

describe("a zone-5 room", () => {
  it("is the Spire's rules over Prismell's arena, climbing 41 → 50 only", () => {
    const a = createSpireArena("Z5", 5);
    expect(a).toBeInstanceOf(SpireLightArena);
    expect(a).toBeInstanceOf(PrismatailArena);
    expect(isSpireArena(a)).toBe(true);
    expect(a.zone).toBe(5);
    expect(a.raid.boss).toBe("prismatail");
    expect(a.raid.spire).toMatchObject({
      zone: 5,
      floor: 41,
      startFloor: 41,
      ceiling: 50,
    });
    a.configureSpire({ startFloor: 1, ceiling: 60 });
    expect(a.raid.spire).toMatchObject({ startFloor: 41, ceiling: 50 });
    a.configureSpire({ startFloor: 31, ceiling: 40 });
    expect(a.raid.spire).toMatchObject({ startFloor: 41, ceiling: 41 });
    // Zone 4's room never climbs into zone 5.
    const four = createSpireArena("Z4", 4);
    expect(four).toBeInstanceOf(SpireDreamArena);
    four.configureSpire({ startFloor: 41, ceiling: 50 });
    expect(four.raid.spire).toMatchObject({ startFloor: 40, ceiling: 40 });
    // A plain Prismell raid is no climb.
    expect(isSpireArena(createRaidArena("R", "prismatail"))).toBe(false);
  });
  it("fights its wave floors on the Spire's court: no mirrors, skylight, relay or Glare", () => {
    seeded(501);
    const a = climb();
    expect(a.raid.spire).toMatchObject({ floor: 41, kind: "wave", zone: 5 });
    expect(a.raid.spire!.roster).toEqual(spireRoster(5));
    atriumOff(a);
    expect(a.walls()).toBe(spireCourtWalls({ floor: 41, kind: "wave" }));
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a)[0]?.character).toBe(
      SPIRE_FLOORS[41].waves[0][0].character,
    );
    // The phone target row lists the Echoes (no mirrors to pick).
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // A raider standing in the skylight carries no light and never burns.
    Object.assign(a.heroes()[0], PRISMATAIL.source);
    run(a, 10, () => Object.assign(a.heroes()[0], PRISMATAIL.source));
    atriumOff(a);
    expect(a.raid.warnings).toEqual([]);
    // Climbs on to 42 with blessing cards, as in the zones below.
    clearFloor(a);
    expect(a.raid.spire!.floor).toBe(42);
    expect(a.phase).toBe("intermission");
    expect(a.raid.spire!.offers.p0).toHaveLength(SPIRE_OFFER);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([41]);
    expect(a.spire.pending[0].startFloor).toBe(41);
    atriumOff(a);
  });
  it("lets raiders hurt the Echoes, never a teammate", () => {
    seeded(502);
    const a = climb();
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const [me] = a.heroes();
    const foe = echoes(a).find((p) => p.hp > 0)!;
    const hp = (foe.hp = 500);
    a.damage(foe, 40, me.id);
    expect(hp - foe.hp).toBeCloseTo(40 * SPIRE_TUNING[41].armour, 4);
    const b = climb(["voltkit", "terradon"]);
    toPlaying(b);
    const [x, y] = b.heroes();
    y.hp = 300;
    b.damage(y, 40, x.id);
    expect(y.hp).toBe(300);
  });
  it("keeps Prismell's counters to its own floor: no sun pillars, no Echo cutting lances", () => {
    seeded(503);
    const a = climb(["cindrake", "halcyra"], { startFloor: 45 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    const [cin, hal] = a.heroes();
    const cast = (p: Fighter, id: string) => {
      const ability = CHARACTERS[p.character].skills.find(
        (s) => s.id === id,
      ) as Ability;
      expect(ability).toBeDefined();
      a.cast(p, ability);
    };
    Object.assign(cin.lastInput, { aimX: cin.x + 200, aimY: cin.y });
    cast(cin, "sunfire-pillar");
    expect(a.raid.sunPillars ?? []).toEqual([]);
    // An Echo Halcyra's Skyline Lance leaves the captain's lances alone; a
    // raider's still cuts them (Prismell's raid counter).
    const elite = a.boss()!;
    expect(elite.character).toBe("halcyra");
    a.bots.delete(elite.id);
    a.raid.warnings = [];
    Object.assign(elite, { x: 900, y: 450, angle: Math.PI });
    Object.assign(hal, { x: 500, y: 450, angle: 0 });
    a.raid.warnings.push({
      id: 9001,
      kind: "prism-lance",
      x: 700,
      y: 200,
      tx: 700,
      ty: 700,
      radius: PRISMATAIL.lance.width,
      at: a.time + 2,
      startedAt: a.time,
    } as RaidWarning);
    cast(elite, "skyline-lance");
    expect(a.raid.warnings.map((w) => w.id)).toContain(9001);
    hal.angle = 0;
    cast(hal, "skyline-lance");
    expect(a.raid.warnings.map((w) => w.id)).not.toContain(9001);
  });
  it("lets a stand-in play the Spire's court, not Prismell's relay posts", () => {
    seeded(504);
    const a = climb();
    toPlaying(a);
    const hint = (
      a as unknown as {
        botHint(b: Fighter, i: Input, go: unknown): Input | undefined;
      }
    ).botHint(a.heroes()[0], { ...a.heroes()[0].lastInput }, () => ({}));
    expect(hint).toBeUndefined();
  });
  it("ends at floor 49 for a party without a Prismell clear (the server's ceiling)", () => {
    seeded(505);
    const a = climb(["voltkit"], { startFloor: 49, ceiling: 49 });
    toPlaying(a);
    clearFloor(a);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.spire!.best).toBe(49);
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    expect(a.raid.message).toMatch(/Floor 49 cleared/);
  });
  it("climbs again from floor 41 after a defeat", () => {
    seeded(506);
    const a = climb(["voltkit"], { startFloor: 41, ceiling: 50 });
    toPlaying(a);
    run(a, 1);
    for (let i = 0; i < 400 && !a.raid.result; i++) {
      const p = a.heroes()[0];
      if (p.hp > 0) a.damage(p, 999, echoes(a).find((e) => e.hp > 0)?.id ?? "");
      a.tick(DT);
    }
    expect(a.raid.result).toBe("defeat");
    expect(a.raid.message).toMatch(/Climb again from floor 41/);
    a.retry();
    expect(a.raid.spire).toMatchObject({ floor: 41, startFloor: 41 });
  });
  it("tells a zone-4 conqueror that zone 5 opens at floor 41", () => {
    const a = createSpireArena("Z4", 4) as SpireDreamArena;
    Object.assign(a.raid.spire!, { best: 40, kind: "boss", floor: 40 });
    expect(
      (a as unknown as { finishMessage(w: boolean): string }).finishMessage(
        true,
      ),
    ).toBe("Zone 4 conquered — zone 5 opens at floor 41.");
  });
});

describe("the elite (floor 45): Prismell's Prism Lances", () => {
  const toCaptain = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 45 });
    toPlaying(a);
    run(a, SPIRE_PARTY.materialise + 0.2);
    return a;
  };
  const startLances = (a: SpireLightArena, target: Fighter) =>
    (a as unknown as { startAttack(k: string, t: Fighter): void }).startAttack(
      "prism-lance",
      target,
    );
  it("is an Echo captain with a boss bar that plays only Prism Lances", () => {
    seeded(511);
    const a = toCaptain();
    const elite = a.boss()!;
    expect(elite).toMatchObject({
      echo: true,
      elite: true,
      team: 1,
      character: "halcyra",
      name: "Echo Captain Halcyra",
    });
    expect(a.raid.bossId).toBe(elite.id);
    expect(a.raid.message).toMatch(/Prismell's prism lances/);
    const lances: RaidWarning[] = [];
    const kinds = new Set<string>();
    let cue = "";
    run(a, 30, () => {
      for (const w of a.raid.warnings) {
        kinds.add(w.kind);
        if (!lances.includes(w)) lances.push(w);
        if (!cue) cue = spireCue(snap(a));
      }
    });
    expect([...kinds]).toEqual(["prism-lance"]);
    expect(lances.length).toBeGreaterThanOrEqual(6);
    // The HUD names it while it is on the court.
    expect(cue).toBe(SPIRE_ELITE_MECHANICS.lances.cue);
    atriumOff(a);
    expect(raidTargets(snap(a), a.heroes()[0])).toBeUndefined();
    // Escorts at half health.
    elite.hp = a.raid.maxHp * 0.45;
    run(a, SPIRE_PARTY.materialise + 0.2);
    expect(echoes(a).filter((p) => !p.elite && p.hp > 0).length).toBe(1);
    expect(echoes(a).find((p) => !p.elite)?.character).toBe("sunbara");
  });
  it("never drags the captain toward Prismell's spot, nor runs the atrium", () => {
    seeded(512);
    const a = toCaptain();
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    a.raid.warnings = [];
    (a as unknown as { nextAttack: number }).nextAttack = a.time + 99;
    Object.assign(elite, { x: 1400, y: 200, vx: 0, vy: 0 });
    // A mirror left on the court would turn if the atrium ran.
    a.raid.mirrors = [
      { x: 600, y: 300, angle: 0, scrambleAt: a.time + 0.2, scrambleTurns: 2 },
    ];
    run(a, 3);
    expect(elite.x).toBeCloseTo(1400, 0);
    expect(elite.y).toBeCloseTo(200, 0);
    expect(a.raid.mirrors[0].angle).toBe(0);
  });
  it("fans its lances from the captain, the middle one through the raider, none under the controls", () => {
    const from = [
      { x: 1250, y: 450 },
      { x: 1450, y: 150 },
      { x: 900, y: 300 },
      { x: 300, y: 700 },
      { x: 1300, y: 600 },
    ];
    const at = [
      { x: 400, y: 300 },
      { x: 800, y: 450 },
      { x: 150, y: 150 },
      { x: 600, y: 820 },
      { x: 700, y: 200 },
    ];
    for (const f of from)
      for (const t of at) {
        const lanes = spireLances(f, t);
        expect(lanes.length).toBeGreaterThanOrEqual(1);
        expect(lanes.length).toBeLessThanOrEqual(SPIRE_LANCE_COUNT);
        for (const w of lanes) {
          expect(Math.hypot(w.tx - w.x, w.ty - w.y)).toBeGreaterThanOrEqual(
            SPIRE_LANCE_MIN,
          );
          // Every point of the lane, lane width and margin, is open ground
          // on the court.
          for (const p of along(w)) {
            expect(
              spireUnderControls(p.x, p.y, PRISMATAIL.lance.width),
              `${f.x},${f.y} → ${t.x},${t.y}: ${p.x.toFixed(0)},${p.y.toFixed(0)}`,
            ).toBe(false);
            expect(p.x).toBeGreaterThanOrEqual(0);
            expect(p.x).toBeLessThanOrEqual(RULES.width);
            expect(p.y).toBeGreaterThanOrEqual(0);
            expect(p.y).toBeLessThanOrEqual(RULES.height);
          }
        }
        // A raider on open ground is on the middle lane (it is aimed at them).
        if (!spireUnderControls(t.x, t.y, PRISMATAIL.lance.width))
          expect(
            Math.min(...lanes.map((w) => toSegment(t, w))),
            `${f.x},${f.y} → ${t.x},${t.y}`,
          ).toBeLessThan(1);
      }
    // Neighbouring lanes leave a gap a fighter fits through 300 px out.
    const gap = 2 * 300 * Math.sin(SPIRE_LANCE_SPREAD / 2);
    expect(gap - 2 * (PRISMATAIL.lance.width + RULES.radius)).toBeGreaterThan(
      RULES.radius,
    );
    // A raider under the thumbs is never drawn on: the lane stops short.
    const hidden = { x: 1300, y: 600 };
    expect(spireUnderControls(hidden.x, hidden.y)).toBe(true);
    for (const w of spireLances({ x: 500, y: 450 }, hidden))
      for (const p of along(w))
        expect(spireUnderControls(p.x, p.y, PRISMATAIL.lance.width)).toBe(
          false,
        );
    expect(SPIRE_CONTROL_MARGIN).toBeGreaterThan(0);
  });
  it("hurts the raider who stays on a lane, not the one who steps into a gap (scaled like any Echo hit)", () => {
    seeded(513);
    const a = toCaptain(["voltkit", "terradon"]);
    const [me, you] = a.heroes();
    const elite = a.boss()!;
    a.bots.delete(elite.id);
    Object.assign(elite, { x: 1000, y: 200 });
    a.raid.warnings = [];
    (a as unknown as { nextAttack: number }).nextAttack = a.time + 99;
    Object.assign(me, { x: 500, y: 300 });
    Object.assign(you, { x: 500, y: 300 });
    startLances(a, me);
    const list = a.raid.warnings.filter((w) => w.kind === "prism-lance");
    expect(list.length).toBe(SPIRE_LANCE_COUNT);
    const middle = list.find((w) => toSegment(me, w) < 1)!;
    expect(middle).toBeDefined();
    expect(middle.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    // The first two are teaching ones: shown a little longer.
    expect(middle.teach).toBe(true);
    const taught = middle.at - a.time;
    a.raid.warnings = [];
    startLances(a, me);
    startLances(a, me);
    const later = a.raid.warnings.at(-1)!;
    expect(later.teach).toBe(false);
    expect(later.at - a.time).toBeGreaterThanOrEqual(RAID_TELEGRAPH_FLOOR);
    // (The raid tier's telegraph scale shortens both a little.)
    expect(taught).toBeGreaterThan(later.at - a.time + SPIRE_LANCE_TEACH / 3);
    a.raid.warnings = [...list];
    me.hp = you.hp = 500;
    // A gap between the middle lane and the next, beside the raider.
    const aim = Math.atan2(300 - 200, 500 - 1000),
      d = Math.hypot(500, 100),
      side = aim + SPIRE_LANCE_SPREAD / 2;
    const gap = { x: 1000 + Math.cos(side) * d, y: 200 + Math.sin(side) * d };
    for (const w of list)
      expect(toSegment(gap, w)).toBeGreaterThan(
        PRISMATAIL.lance.width + RULES.radius,
      );
    const lands = Math.max(...list.map((w) => w.at)) + 0.1;
    while (a.time < lands) {
      Object.assign(me, { x: 500, y: 300 });
      Object.assign(you, gap);
      me.hp = Math.min(me.hp, 500);
      a.tick(DT);
    }
    expect(500 - me.hp).toBeCloseTo(
      PRISMATAIL.lance.damage *
        SPIRE_TUNING[45].power *
        (1 + SPIRE_PARTY.power),
      3,
    );
    expect(you.hp).toBe(500);
  });
  it.each([1, 4])(
    "keeps the raid honesty rules with %i raider(s) (shown long enough, one at a time, a gap in reach, nothing under the controls)",
    (size) => {
      seeded(520 + size);
      const team: CharacterId[] = ["voltkit", "terradon", "lumoth", "cindrake"];
      const a = toCaptain(team.slice(0, size));
      const problems: string[] = [];
      const seen = new Map<number, RaidWarning>();
      const walls = spireCourtWalls({ floor: 45, kind: "elite" })!;
      expect(walls).toBeDefined();
      let wasLive = 0;
      const R = PRISMATAIL.lance.width + RULES.radius;
      run(a, 90, () => {
        const elite = a.boss();
        if (elite) elite.hp = Math.max(elite.hp, a.raid.maxHp * 0.6);
        const fresh = a.raid.warnings.filter((w) => !seen.has(w.id));
        for (const w of fresh) {
          seen.set(w.id, w);
          if (w.kind !== "prism-lance") problems.push(`a ${w.kind}`);
          const shown = w.at - (w.startedAt ?? w.at);
          if (shown < RAID_TELEGRAPH_FLOOR - EPS)
            problems.push(`${w.kind} on screen ${shown.toFixed(2)} s`);
          for (const p of along(w))
            if (spireUnderControls(p.x, p.y, w.radius)) {
              problems.push(`a lane under the controls at ${p.x},${p.y}`);
              break;
            }
        }
        if (!fresh.length) return;
        // Every raider can reach a spot clear of every lane, open ground, at
        // the slowest speed before the lanes fire.
        const live = a.raid.warnings.filter((w) => w.kind === "prism-lance");
        const shown = Math.min(...live.map((w) => w.at - a.time));
        a.walls();
        for (const p of a.heroes().filter((q) => q.hp > 0)) {
          let near = Infinity;
          for (let x = 30; x < 1600; x += 20)
            for (let y = 30; y < 900; y += 20) {
              if (live.some((w) => toSegment({ x, y }, w) < R)) continue;
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

describe("the boss floor (floor 50: the Ascendant Prismell, in the Sun Atrium)", () => {
  const toFifty = (chars: CharacterId[] = ["voltkit"]) => {
    const a = climb(chars, { startFloor: 49, ceiling: 50 });
    toPlaying(a);
    clearFloor(a);
    return a;
  };
  it("briefs the Ascendant in the same room, in the Sun Atrium, then the blessings, then the fight", () => {
    seeded(531);
    const a = toFifty();
    const s = a.raid.spire!;
    expect(a.raid.result).toBeNull();
    expect(s).toMatchObject({ floor: 50, kind: "boss", best: 49, zone: 5 });
    expect(a.phase).toBe("briefing");
    expect(a.raid.variant).toBe("ascendant");
    expect(a.raid.name).toBe("Ascendant Prismell");
    // Its raid's court: the Sun Atrium and its mirrors, no Spire walls.
    expect(a.arenaId).toBe("sun-atrium");
    expect(a.arenaId).toBe(SPIRE_ZONES[5].court);
    expect(a.walls()).toEqual([]);
    expect(a.raid.mirrors).toHaveLength(PRISMATAIL.mirrors.length);
    const boss = a.boss()!;
    expect(boss).toMatchObject({ raidBoss: true, name: "Ascendant Prismell" });
    expect(boss.hp).toBe(a.raid.maxHp);
    expect(a.raid.maxHp).toBeGreaterThan(1);
    expect(a.raid.gilded).toBe(false);
    expect(echoes(a)).toEqual([]);
    a.acknowledgeInstructions("p0");
    expect(a.phase).toBe("intermission");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    // Prismell's own deck (the raid's) and its skylight relay.
    const kinds = new Set<string>();
    let lit = false;
    run(a, 90, () => {
      a.raid.warnings.forEach((w) => kinds.add(w.kind));
      // A raider in the skylight draws the beam.
      Object.assign(a.heroes()[0], { x: 470, y: 450 });
      lit ||= (a.raid.lightLinks ?? []).length > 0;
    });
    expect(kinds.has("eruption")).toBe(false);
    expect(kinds.has("falling-stars")).toBe(false);
    expect(
      [...kinds].some((k) =>
        [
          "prism-lance",
          "fan-display",
          "glare",
          "refraction",
          "halo-crush",
        ].includes(k),
      ),
    ).toBe(true);
    expect(lit).toBe(true);
  });
  it("goes on without a raider who never reads the briefing", () => {
    seeded(532);
    const a = toFifty();
    run(a, SPIRE_PARTY.bossBriefing + 0.2);
    expect(a.phase).toBe("intermission");
  });
  it("counts blessings in the boss fight", () => {
    seeded(533);
    const a = toFifty();
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
  it("saves the clear as Spire floor 50, then ends the climb: zone 5 conquered", () => {
    seeded(534);
    const a = toFifty();
    const s = a.raid.spire!;
    a.acknowledgeInstructions("p0");
    a.pickRite("p0", s.offers.p0[0]);
    toPlaying(a);
    run(a, 5);
    a.spire.pending = [];
    a.boss()!.hp = 0;
    run(a, 0.1);
    expect(s.clearedAt).toBeDefined();
    expect(s.best).toBe(50);
    expect(a.spire.pending.map((r) => r.floor)).toEqual([50]);
    expect(a.raid.warnings).toEqual([]);
    run(a, SPIRE_PARTY.cleared + 0.2);
    expect(a.raid.result).toBe("victory");
    expect(a.raid.message).toBe("Zone 5 conquered — zone 6 opens at floor 51.");
    a.retry();
    expect(s).toMatchObject({ startFloor: 49, floor: 49, blessings: {} });
    expect(a.raid.variant).toBeUndefined();
    expect(a.players.some((p) => p.raidBoss)).toBe(false);
    atriumOff(a);
  });
  it("loses the climb on a defeat by the Ascendant", () => {
    seeded(535);
    const a = toFifty();
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
    expect(a.raid.message).toMatch(/Ascendant Prismell stands unbroken/);
  });
});

/**
 * Play-test by simulation, as the zones below: a Normal bot raider alone,
 * with the blessings it would hold by then on a climb from floor 41 (none
 * on 41).
 */
function playFloor(floor: number, seed: number) {
  seeded(seed * 7919);
  const a = createSpireArena("SIM" + seed, 5);
  a.add("p0", "P0", "voltkit");
  a.configureSpire({ startFloor: floor, ceiling: floor });
  a.start();
  const mine = (a.raid.spire!.blessings.p0 = {} as Record<string, number>);
  for (let f = 42; f <= floor; f++) {
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
describe("play-test (bot raiders vs zone 5)", () => {
  it("floor 41 is often cleared solo with no blessings; floor 49 less often, but sometimes", () => {
    const seeds = Array.from({ length: 24 }, (_, i) => i + 1);
    const rate = (floor: number) =>
      seeds.filter((s) => playFloor(floor, s)).length / seeds.length;
    const first = rate(41),
      last = rate(49);
    expect(first).toBeGreaterThanOrEqual(0.5);
    expect(first).toBeLessThan(1);
    expect(last).toBeGreaterThan(0);
    expect(last).toBeLessThan(first);
  }, 180_000);
});

describe("floor 50's court, painted ahead", () => {
  it("is the texture floor 50 shows: Prismell's Sun Atrium under its summit grade", () => {
    expect(spireSummitFloorId(5)).toBe(SPIRE_ATRIUM_SUMMIT_FLOOR);
    expect(spireSummitFloorOf("sun-atrium")).toBe(SPIRE_ATRIUM_SUMMIT_FLOOR);
    expect(hasSpireSummitArena("sun-atrium")).toBe(true);
  });
});

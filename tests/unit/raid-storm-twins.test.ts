import { describe, it, expect, vi } from "vitest";
import {
  CHARACTERS,
  blankInput,
  packSnapshot,
  type CharacterId,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { StormTwinsArena } from "../../apps/server/src/raid-storm-twins";
import {
  STORM_TWINS as S,
  RAID_BOSSES,
  RAID_BOSS_ATTACKS,
  ritesFor,
  twinKillWindow,
  stormSegmentDistance,
  type RaidAttack,
} from "../../packages/shared/src/raid";
import {
  raidCue,
  featureLabel,
  raidContributions,
} from "../../apps/client/src/raid-presentation";
import { stormTwinHealth } from "../../apps/client/src/storm-twins-controls";
import {
  drawConductorRing,
  drawStormWarning,
  drawStormTwins,
} from "../../apps/client/src/raid-storm-twins-art";
import { SKINS, tonePixels } from "../../apps/client/src/animation/cosmetics";
import {
  drawCollectionAura,
  playCollectionEntrance,
  drawCollectionVictory,
} from "../../apps/client/src/skins/collection-fx";
const setup = (
  size = 1,
  phase = 3,
  peril = 1,
  chars: CharacterId[] = ["cindrake"],
) => {
  const a = createRaidArena("TWINS", "storm-twins") as StormTwinsArena;
  for (let i = 0; i < size; i++)
    a.add("p" + i, "Raider " + i, chars[i % chars.length]);
  a.configure(peril, false);
  a.start();
  a.phase = "playing";
  a.raid.phase = phase;
  a.raid.trait = "bickering";
  a.raid.gilded = false;
  a.raid.seed = 7;
  (a as any).started = true;
  (a as any).nextAttack = Infinity;
  a.heroes().forEach((p, i) => {
    p.x = 300 + i * 200;
    p.y = 450;
    p.lastInput = blankInput();
  });
  return a;
};
const twins = (a: StormTwinsArena) => a.players.filter((p) => p.raidBoss);
const run = (a: StormTwinsArena, seconds: number) => {
  for (let i = 0; i < Math.ceil(seconds * 30); i++) a.tick();
};
const attack = (a: StormTwinsArena, kind: RaidAttack) =>
  (a as any).startAttack(kind, a.heroes()[0]);
const resolve = (a: StormTwinsArena) => {
  const warnings = [...a.raid.warnings];
  a.raid.warnings = [];
  for (const w of warnings) {
    (a as any).struck.clear();
    (a as any).resolveWarning(w, a.boss()!);
  }
};
const down = (a: StormTwinsArena, index: number) =>
  a.damage(twins(a)[index], 100000, a.heroes()[0].id);
describe("Storm Twins encounter lifecycle", () => {
  it("spawns two real enemies, health bars and stagger meters with correct party health scaling", () => {
    const a = setup(4);
    expect(a).toBeInstanceOf(StormTwinsArena);
    expect(a.players).toHaveLength(6);
    expect(a.heroes()).toHaveLength(4);
    expect(twins(a).map((p) => p.name)).toEqual(["Fizz", "Crackle"]);
    expect(a.raid.partySize).toBe(4);
    expect(a.raid.twins).toHaveLength(2);
    expect(a.instructionsReady).toEqual(twins(a).map((p) => p.id));
    for (const t of a.raid.twins!)
      expect([2240, Math.round(4480 * 1.12) / 2]).toContain(t.maxHp);
    expect(a.raid.maxHp).toBe(a.raid.twins!.reduce((s, t) => s + t.maxHp, 0));
    expect(a.arenaId).toBe("conductor-ring");
    expect(a.walls()).toEqual([]);
    expect(a.hitRadius(twins(a)[0])).toBe(S.radius);
    expect(RAID_BOSSES["storm-twins"].playable).toBe(true);
    expect(ritesFor("storm-twins")).toContain("grounded");
    expect(ritesFor("emberwing")).not.toContain("grounded");
    for (const phase of [1, 2, 3]) {
      a.raid.phase = phase;
      for (const kind of (a as any).pattern())
        expect(RAID_BOSS_ATTACKS["storm-twins"]).toContain(kind);
    }
  });
  it("uses combined health for rite boundaries and prevents finishing a twin before Supercell", () => {
    const a = setup(1, 1),
      [f, c] = twins(a);
    a.damage(f, 100000, "p0");
    expect(f.hp + c.hp).toBeCloseTo(a.raid.maxHp * 0.67);
    a.tick();
    expect(a.raid.phase).toBe(2);
    expect(a.phase).toBe("intermission");
    a.phase = "playing";
    a.damage(f, 100000, "p0");
    expect(f.hp).toBe(1);
    expect(a.raid.result).toBeNull();
    a.damage(c, 100000, "p0");
    a.tick();
    expect(a.raid.phase).toBe(3);
    expect(a.phase).toBe("intermission");
  });
  it("staggers and exposes one twin without exposing its partner", () => {
    const a = setup(),
      [f, c] = twins(a);
    a.raid.twins![0].stagger = 100;
    a.tick();
    expect(a.raid.twins![0].exposedUntil).toBeGreaterThan(a.time);
    expect(a.raid.twins![1].exposedUntil).toBe(0);
    const before = f.hp,
      other = c.hp;
    a.damage(f, 20, "p0");
    a.damage(c, 20, "p0");
    expect(before - f.hp).toBeCloseTo(32);
    expect(other - c.hp).toBeCloseTo(14.4);
    expect(a.raid.stagger).toBe(0);
  });
  it("Overloaded fills each twin’s stagger twenty percent faster, including control effects", () => {
    const a = setup(),
      b = setup();
    b.raid.trait = "overloaded";
    a.damage(twins(a)[0], 20, "p0");
    b.damage(twins(b)[0], 20, "p0");
    expect(b.raid.twins![0].stagger).toBeCloseTo(
      a.raid.twins![0].stagger * 1.2,
    );
    a.status(twins(a)[1], "stun", 1);
    b.status(twins(b)[1], "stun", 1);
    expect(b.raid.twins![1].stagger).toBeCloseTo(
      a.raid.twins![1].stagger * 1.2,
    );
  });
  for (const size of [1, 2, 3, 4])
    for (const peril of [1, 2, 3])
      it(`keeps the raid alive after one fall and revives it on timeout: ${size} player(s), Peril ${peril}`, () => {
        const a = setup(size, 3, peril),
          [f, c] = twins(a);
        down(a, 0);
        a.tick();
        expect(a.raid.result).toBeNull();
        expect(a.phase).toBe("playing");
        expect(a.boss()).toBe(c);
        expect(a.raid.twins![0].reviveAt).toBeCloseTo(
          twinKillWindow(peril, size, "bickering"),
        );
        (a as any).nextAttack = Infinity;
        run(a, twinKillWindow(peril, size, "bickering") + 0.1);
        expect(f.hp).toBeCloseTo(Math.round(a.raid.twins![0].maxHp * 0.35));
        expect(a.raid.twins![0].fallenAt).toBeUndefined();
        expect(a.raid.twinRevivals).toBe(1);
        expect(a.raid.result).toBeNull();
      });
  it("finishes only with both down, including a simultaneous finish at expiry", () => {
    const a = setup();
    down(a, 0);
    a.time = a.raid.twins![0].reviveAt!;
    down(a, 1);
    a.tick();
    expect(a.raid.result).toBe("victory");
    expect(a.phase).toBe("finished");
    expect(a.raid.twinRevivals).toBe(0);
  });
  it("adds the In Sync and solo finishing extensions and pauses time on disconnect", () => {
    expect(twinKillWindow(3, 1, "in-sync")).toBe(14);
    expect(twinKillWindow(3, 4, "in-sync")).toBe(11);
    const a = setup();
    down(a, 0);
    const before = a.time;
    a.phase = "paused";
    run(a, 30);
    expect(a.time).toBe(before);
    expect(twins(a)[0].hp).toBe(0);
  });
  it("awards Twin Spark only when the final pair of falls is within two seconds", () => {
    const a = setup();
    down(a, 0);
    a.time += 1.5;
    down(a, 1);
    a.tick();
    expect(a.feat()).toBe(true);
    const b = setup();
    down(b, 0);
    b.time += 2.2;
    down(b, 1);
    b.tick();
    expect(b.raid.result).toBe("victory");
    expect(b.feat()).toBe(false);
  });
  it("cleans both boss entities and hazards on retry, preserving party size and chosen fighters", () => {
    const a = setup(2);
    attack(a, "polarity");
    down(a, 0);
    a.forfeit("p0");
    a.retry();
    expect(a.players).toHaveLength(4);
    expect(a.heroes()).toHaveLength(2);
    expect(a.raid.partySize).toBe(2);
    expect(a.raid.twins!.every((t) => t.fallenAt === undefined)).toBe(true);
    expect(a.raid.polarities).toEqual([]);
    expect(a.raid.twinRevivals).toBe(0);
  });
});
describe("Polarity fairness and champion tricks", () => {
  for (const size of [2, 3, 4])
    it(`cancels opposite signs for all ${size} players, including an odd party`, () => {
      const a = setup(size);
      attack(a, "polarity");
      a.heroes().forEach((p, i) => {
        p.x = 400 + i * 20;
        p.y = 450;
      });
      run(a, 0.1);
      expect(a.raid.polarities!.every((m) => m.cancelled)).toBe(true);
      for (const p of a.heroes())
        expect(a.raid.contributions![p.id].pillars).toBe(1);
      run(a, 1);
      for (const p of a.heroes())
        expect(a.raid.contributions![p.id].pillars).toBe(1);
    });
  it("lets a cancelled teammate help the third raider later, with no repeated credit", () => {
    const a = setup(3);
    attack(a, "polarity");
    a.heroes()[0].x = 400;
    a.heroes()[1].x = 450;
    a.heroes()[2].x = 1000;
    run(a, 0.1);
    expect(a.raid.polarities!.map((m) => m.cancelled)).toEqual([
      true,
      true,
      false,
    ]);
    a.heroes()[2].x = 470;
    run(a, 0.1);
    expect(a.raid.polarities!.every((m) => m.cancelled)).toBe(true);
    expect(a.heroes().map((p) => a.raid.contributions![p.id].pillars)).toEqual([
      1, 1, 1,
    ]);
  });
  it("does not cancel expired marks or grant late pairing credit", () => {
    const a = setup(2);
    attack(a, "polarity");
    a.time = a.raid.polarities![0].until;
    a.heroes()[1].x = a.heroes()[0].x + 40;
    (a as any).polarity();
    expect(a.raid.polarities).toEqual([]);
    expect(a.heroes().map((p) => a.raid.contributions![p.id].pillars)).toEqual([
      0, 0,
    ]);
    expect(
      a.heroes().map((p) => CHARACTERS[p.character].health - p.hp),
    ).toEqual([28, 28]);
  });
  it("gives solo an accessible opposite-sign pad and credits one cancellation", () => {
    const a = setup();
    attack(a, "polarity");
    const pad = a.raid.polarityPad!;
    expect(pad.sign).toBe(-a.raid.polarities![0].sign);
    expect(
      Math.hypot(pad.x - a.heroes()[0].x, pad.y - a.heroes()[0].y),
    ).toBeLessThanOrEqual(191);
    Object.assign(a.heroes()[0], pad);
    run(a, 0.1);
    expect(a.raid.polarities![0].cancelled).toBe(true);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
  });
  it("gives the last standing co-op raider a floor pad instead of an impossible pair", () => {
    const a = setup(3);
    a.heroes()[1].hp = a.heroes()[2].hp = 0;
    attack(a, "polarity");
    expect(a.raid.polarities).toHaveLength(1);
    expect(a.raid.polarityPad).toBeDefined();
    Object.assign(a.heroes()[0], a.raid.polarityPad!);
    (a as any).polarity();
    expect(a.raid.polarities![0].cancelled).toBe(true);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
  });
  it("same signs double the failure damage; Grounded reduces only that mismatch", () => {
    const a = setup(4);
    a.raid.rites.p0 = ["grounded"];
    attack(a, "polarity");
    Object.assign(a.heroes()[0], { x: 400, y: 450 });
    Object.assign(a.heroes()[2], { x: 430, y: 450 });
    a.heroes()[1].x = 1000;
    a.heroes()[3].x = 1400;
    run(a, 4.1);
    expect(CHARACTERS.cindrake.health - a.heroes()[0].hp).toBeCloseTo(28);
    expect(CHARACTERS.cindrake.health - a.heroes()[2].hp).toBeCloseTo(56);
    expect(a.raid.polarities).toEqual([]);
  });
  it("Terradon’s sleeping shell blocks the expired mark without faking a polarity pair", () => {
    const a = setup(1, 3, 1, ["terradon"]);
    attack(a, "polarity");
    a.status(a.heroes()[0], "sleep", 5);
    run(a, 4.1);
    expect(a.heroes()[0].hp).toBe(CHARACTERS.terradon.health);
    expect(a.raid.contributions!.p0.pillars).toBe(0);
  });
  it("Chain Lightning jumps only within 200px, with decreasing damage and no repeated victims", () => {
    const a = setup(3);
    a.heroes().forEach((p, i) => {
      p.x = 400 + i * 150;
      p.y = 450;
    });
    attack(a, "chain-lightning");
    resolve(a);
    expect(a.heroes().map((p) => CHARACTERS.cindrake.health - p.hp)).toEqual([
      24, 16, 10,
    ]);
    expect(a.raid.stormChain!.points).toHaveLength(3);
    const b = setup(3);
    b.heroes().forEach((p, i) => (p.x = 300 + i * 350));
    attack(b, "chain-lightning");
    resolve(b);
    expect(b.heroes()[1].hp).toBe(CHARACTERS.cindrake.health);
  });
  it("Voltkit absorbs the chain for fifteen ultimate and Grounded stops jumps", () => {
    const a = setup(2, 3, 1, ["voltkit", "cindrake"]);
    a.heroes()[0].ult = 0;
    a.heroes()[1].x = 400;
    attack(a, "chain-lightning");
    resolve(a);
    expect(a.heroes()[0].hp).toBe(CHARACTERS.voltkit.health);
    expect(a.heroes()[0].ult).toBe(15);
    expect(a.heroes()[1].hp).toBe(CHARACTERS.cindrake.health);
    const b = setup(2);
    b.heroes()[1].x = 400;
    b.raid.rites.p0 = ["grounded"];
    attack(b, "chain-lightning");
    resolve(b);
    expect(b.heroes()[0].hp).toBeLessThan(CHARACTERS.cindrake.health);
    expect(b.heroes()[1].hp).toBe(CHARACTERS.cindrake.health);
  });
  it("Duskveil’s Void Orb shortens the distance between the two real enemies", () => {
    const a = setup(),
      [f, c] = twins(a);
    f.x = 600;
    c.x = 1200;
    const before = Math.hypot(f.x - c.x, f.y - c.y);
    a.damage(
      f,
      10,
      "p0",
      CHARACTERS.duskveil.skills.find((a) => a.id === "void-orb"),
    );
    expect(Math.hypot(f.x - c.x, f.y - c.y)).toBeLessThan(before);
  });
  it("practice cancellations never grant reward progress", () => {
    const a = setup();
    a.raid.drill = "polarity";
    a.raid.drillStats = { hits: 0, dodges: 0 };
    attack(a, "polarity");
    Object.assign(a.heroes()[0], a.raid.polarityPad!);
    run(a, 0.1);
    expect(a.raid.contributions!.p0.pillars).toBe(0);
    expect(a.raid.drillStats.dodges).toBe(1);
    a.setDrill("link-beam");
    expect(a.raid.polarities).toEqual([]);
    a.stopDrill();
    expect(a.players).toHaveLength(1);
  });
});
describe("Storm Twins attacks and presentation", () => {
  it("bends the warning and active Link Beam through the same copper post", () => {
    const a = setup(1, 2);
    attack(a, "link-beam");
    const w = a.raid.warnings[0];
    expect(w.beamPost).toBeDefined();
    resolve(a);
    expect(a.raid.stormBeam!.points[1]).toEqual(S.posts[w.beamPost!]);
    expect(a.raid.stormBeam!.points).toHaveLength(3);
  });
  it("Link Beam can be jumped, reflects from Mirror Guard and stops when one twin falls", () => {
    const a = setup(1, 1, 1, ["auralynx"]),
      [f, c] = twins(a);
    Object.assign(a.heroes()[0], { x: (f.x + c.x) / 2, y: (f.y + c.y) / 2 });
    a.status(a.heroes()[0], "counter", 2);
    attack(a, "link-beam");
    resolve(a);
    a.tick();
    expect(a.raid.twins!.some((t) => t.stagger >= 20)).toBe(true);
    a.raid.phase = 3;
    down(a, 0);
    expect(a.raid.stormBeam).toBeUndefined();
    const b = setup(1, 1),
      [x, y] = twins(b);
    Object.assign(b.heroes()[0], {
      x: (x.x + y.x) / 2,
      y: (x.y + y.y) / 2,
      jumpUntil: b.time + 3,
    });
    attack(b, "link-beam");
    resolve(b);
    run(b, 2.5);
    expect(b.heroes()[0].hp).toBe(CHARACTERS.cindrake.health);
  });
  it("Static Fields hurt and slow once per interval; jumping avoids both", () => {
    const a = setup();
    attack(a, "static-field");
    resolve(a);
    run(a, 1.1);
    expect(a.heroes()[0].hp).toBeLessThan(CHARACTERS.cindrake.health);
    expect(a.heroes()[0].statuses.some((s) => s.kind === "slow")).toBe(true);
    const b = setup();
    b.heroes()[0].jumpUntil = 3;
    attack(b, "static-field");
    resolve(b);
    run(b, 1.1);
    expect(b.heroes()[0].hp).toBe(CHARACTERS.cindrake.health);
    expect(b.heroes()[0].statuses.some((s) => s.kind === "slow")).toBe(false);
  });
  it("warns for both rush lanes, sweeps them fairly, and avoids two hits at the crossing", () => {
    const a = setup();
    attack(a, "twin-rush");
    expect(a.raid.warnings).toHaveLength(2);
    const lanes = [...a.raid.warnings],
      w = lanes[0];
    Object.assign(a.heroes()[0], { x: (w.x + w.tx) / 2, y: (w.y + w.ty) / 2 });
    resolve(a);
    run(a, 0.8);
    expect(CHARACTERS.cindrake.health - a.heroes()[0].hp).toBeLessThanOrEqual(
      26,
    );
    expect(a.heroes()[0].hp).toBeLessThan(CHARACTERS.cindrake.health);
    expect(a.raid.stormRushes).toEqual([]);
  });
  it("Thunderclap comes from the lower-health twin and allows jumping", () => {
    const a = setup(),
      [f, c] = twins(a);
    c.hp = 50;
    Object.assign(a.heroes()[0], { x: c.x, y: c.y, jumpUntil: 2 });
    attack(a, "thunderclap");
    expect(a.raid.warnings[0].casterId).toBe(c.id);
    resolve(a);
    expect(a.heroes()[0].hp).toBe(CHARACTERS.cindrake.health);
  });
  it("surviving twins replace two-body attacks with a readable solo attack", () => {
    const a = setup();
    down(a, 0);
    attack(a, "link-beam");
    expect(a.raid.warnings[0].kind).toBe("thunderclap");
    expect(a.raid.warnings[0].casterId).toBe(twins(a)[1].id);
  });
  it("In Sync casts two staggered warnings and Overloaded adds fields", () => {
    const a = setup(2);
    a.raid.trait = "in-sync";
    attack(a, "chain-lightning");
    expect(a.raid.warnings).toHaveLength(2);
    expect(a.raid.warnings[1].at - a.raid.warnings[0].at).toBeCloseTo(0.35);
    const b = setup();
    b.raid.trait = "overloaded";
    attack(b, "static-field");
    expect(b.raid.warnings).toHaveLength(2);
    for (let i = 0; i < 10; i++) {
      resolve(b);
      attack(b, "static-field");
    }
    resolve(b);
    expect(b.raid.stormFields).toHaveLength(8);
  });
  it("shows both HP bars, the finish countdown, polarity contributions, and serializes both bosses", () => {
    const a = setup();
    expect(
      packSnapshot(a.snapshot()).players.filter((p) => p.raidBoss),
    ).toHaveLength(2);
    const html = stormTwinHealth(a.snapshot());
    expect(html).toContain("Fizz health");
    expect(html).toContain("Crackle health");
    expect(featureLabel("storm-twins")).toBe("Pairs");
    expect(raidContributions(a.snapshot())).toContain("Polarity pairs");
    down(a, 0);
    expect(raidCue(a.snapshot(), "p0")).toContain("revives in");
    expect(stormTwinHealth(a.snapshot())).toContain("REVIVES IN");
  });
  it("draws the two bodies and every warning without changing the simulation snapshot", () => {
    const a = setup(),
      g: any = new Proxy({}, { get: () => vi.fn(() => g) }),
      before = JSON.stringify(a.snapshot());
    drawConductorRing(g, a.snapshot(), true);
    drawStormTwins(g, a.snapshot(), true, 0);
    expect(JSON.stringify(a.snapshot())).toBe(before);
    for (const kind of RAID_BOSS_ATTACKS["storm-twins"]!) {
      attack(a, kind);
      for (const w of a.raid.warnings)
        expect(drawStormWarning(g, a.snapshot(), w)).toBe(true);
      a.raid.warnings = [];
    }
  });
});
it("renders all Storm Twins cosmetic effects, with different skin palettes", () => {
  const commands: unknown[] = [];
  const g: any = new Proxy(
      {},
      {
        get:
          (_t, k) =>
          (...args: unknown[]) => {
            commands.push([k, ...args]);
            return g;
          },
      },
    ),
    emit = vi.fn();
  expect(drawCollectionAura(g, "spark-aura", 0, 0, 1000, false)).toBe(true);
  const before = JSON.stringify(commands);
  commands.length = 0;
  drawCollectionAura(g, "spark-aura", 0, 0, 1800, false);
  expect(JSON.stringify(commands)).not.toBe(before);
  expect(playCollectionEntrance(emit, "lightning-strike", 0, 0, 1)).toBe(true);
  expect(emit).toHaveBeenCalledTimes(21);
  expect(
    drawCollectionVictory(
      g,
      g,
      emit,
      () => false,
      "twin-spark",
      0,
      0,
      1,
      1,
      0.016,
      false,
    ),
  ).toBe(true);
  const palettes = [];
  for (const skin of ["static-colors", "thundercell"] as const) {
    expect(SKINS).toContain(skin);
    const p = new Uint8ClampedArray([120, 140, 160, 255]);
    tonePixels(p, skin);
    palettes.push([...p]);
  }
  expect(palettes[0]).not.toEqual(palettes[1]);
});

describe("Storm Twins stand-ins and full raids", () => {
  for (const size of [1, 2, 3, 4])
    for (const peril of [1, 2, 3])
      it(`cancels Polarity with ${size} slow stand-ins on Peril ${peril}`, () => {
        const a = setup(size, 3, peril, ["terradon"]);
        a.heroes().forEach((p) => a.standIn(p.id));
        attack(a, "polarity");
        run(a, 3.95);
        expect(
          a.raid.polarities!.every((m) => m.cancelled),
          JSON.stringify(a.raid.polarities),
        ).toBe(true);
        for (const p of a.heroes())
          expect(a.raid.contributions![p.id].pillars).toBe(1);
      });
  it("aims at the healthier twin to balance damage, and focuses the survivor", () => {
    const a = setup(),
      [f, c] = twins(a);
    f.hp = 10;
    c.hp = 400;
    let input = a.botInput(a.heroes()[0], blankInput());
    expect(input.aimX).toBe(c.x);
    down(a, 1);
    input = a.botInput(a.heroes()[0], blankInput());
    expect(input.aimX).toBe(f.x);
  });
  it("uses every chapter and attack without losing a boss or creating invalid positions", () => {
    const a = setup(4, 1, 3, ["voltkit", "cindrake", "tidefin", "mystowl"]);
    a.heroes().forEach((p) => a.standIn(p.id));
    (a as any).nextAttack = 0;
    const seen = new Set<string>();
    let finalFor = 0,
      pairs = 0;
    const chip = a.raid.maxHp / 2 / 3 / 75 / 30;
    for (let t = 0; t < 460 && !a.raid.result && finalFor < 72; t += 1 / 30) {
      const before = twins(a).map((p) => p.hp);
      a.tick();
      twins(a).forEach((p, i) => {
        p.hp = Math.max(
          a.raid.phase < 3 ? 1 : 0,
          before[i] - (a.phase === "playing" ? chip : 0),
        );
      });
      for (const w of a.raid.warnings) seen.add(w.kind);
      if (a.raid.polarities?.length) seen.add("polarity");
      pairs = Math.max(
        pairs,
        Object.values(a.raid.contributions ?? {}).reduce(
          (s, c) => s + c.pillars,
          0,
        ),
      );
      if (a.phase === "intermission")
        for (const [id, offer] of Object.entries(a.raid.offers))
          a.pickRite(id, offer[0]);
      for (const p of a.heroes()) {
        p.hp = CHARACTERS[p.character].health;
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      expect(twins(a)).toHaveLength(2);
      if (a.raid.phase === 3) finalFor += 1 / 30;
    }
    expect(a.raid.phase).toBe(3);
    expect(pairs).toBeGreaterThan(0);
    for (const kind of RAID_BOSS_ATTACKS["storm-twins"]!)
      expect(seen, kind).toContain(kind);
  });
});

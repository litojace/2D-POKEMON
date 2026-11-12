import { RAID } from "../../packages/shared/src/raid";
import { describe, it, expect, vi } from "vitest";
import {
  CHARACTERS,
  blankInput,
  packSnapshot,
  type CharacterId,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import {
  StormTwinsArena,
  polaritySigns,
} from "../../apps/server/src/raid-storm-twins";
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
      expect([
        Math.round(4480 * RAID.healthScale * RAID.perilHealth[a.raid.peril]) /
          2,
        Math.round(
          4480 * RAID.healthScale * RAID.perilHealth[a.raid.peril] * 1.12,
        ) / 2,
      ]).toContain(t.maxHp);
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
    expect(a.phase).toBe("playing");
    a.damage(f, 100000, "p0");
    expect(f.hp).toBe(1);
    expect(a.raid.result).toBeNull();
    a.damage(c, 100000, "p0");
    a.tick();
    expect(a.raid.phase).toBe(3);
    expect(a.phase).toBe("playing");
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
        expect(S.reviveFraction).toBe(0.5);
        expect(f.hp).toBeCloseTo(
          Math.round(a.raid.twins![0].maxHp * S.reviveFraction),
        );
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
    expect(twinKillWindow(3, 4, "bickering")).toBe(7);
    expect(twinKillWindow(3, 1, "bickering")).toBe(10);
    expect(twinKillWindow(3, 1, "in-sync")).toBe(13);
    expect(twinKillWindow(3, 4, "in-sync")).toBe(10);
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
    // The odd one out pairs first with an opposite sign; the third waits.
    const marks = a.raid.polarities!,
      lone = marks.findIndex(
        (m) => marks.filter((n) => n.sign === m.sign).length === 1,
      ),
      [mate, third] = [0, 1, 2].filter((i) => i !== lone),
      hero = (i: number) => a.heroes()[i];
    hero(lone).x = 400;
    hero(mate).x = 450;
    hero(third).x = 1000;
    run(a, 0.1);
    expect(marks.map((m) => m.cancelled)).toEqual(
      [0, 1, 2].map((i) => i !== third),
    );
    hero(third).x = 470;
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
    attack(a, "polarity");
    // A Grounded raider stands with one of its own sign; the rest stay apart.
    const sign = (i: number) => a.raid.polarities![i].sign,
      [g, same] = [0, 1, 2, 3].flatMap((i) =>
        [0, 1, 2, 3]
          .filter((j) => j > i && sign(j) === sign(i))
          .map((j) => [i, j]),
      )[0],
      rest = [0, 1, 2, 3].filter((i) => i !== g && i !== same);
    a.raid.rites[a.heroes()[g].id] = ["grounded"];
    Object.assign(a.heroes()[g], { x: 400, y: 450 });
    Object.assign(a.heroes()[same], { x: 430, y: 450 });
    Object.assign(a.heroes()[rest[0]], { x: 1000, y: 450 });
    Object.assign(a.heroes()[rest[1]], { x: 1400, y: 450 });
    run(a, 4.1);
    expect(CHARACTERS.cindrake.health - a.heroes()[g].hp).toBeCloseTo(28);
    expect(CHARACTERS.cindrake.health - a.heroes()[same].hp).toBeCloseTo(56);
    expect(a.raid.polarities).toEqual([]);
  });
  it("Terradon’s closed shell blocks the expired mark without faking a polarity pair", () => {
    const a = setup(1, 3, 1, ["terradon"]);
    attack(a, "polarity");
    a.status(a.heroes()[0], "shell", 5);
    run(a, 4.1);
    expect(a.heroes()[0].hp).toBe(CHARACTERS.terradon.health);
    expect(a.raid.contributions!.p0.pillars).toBe(0);
  });
  it("Pangrove curled into a ball (Curl & Roll) takes no Polarity damage", () => {
    for (const curled of [true, false]) {
      const a = setup(1, 3, 1, ["pangrove"]);
      attack(a, "polarity");
      // A ball at a standstill, curled for the whole attack.
      if (curled)
        a.heroes()[0].roll = {
          until: a.time + 5,
          speed: 0,
          heading: 0,
          top: 540,
          slot: 2,
        };
      run(a, 4.1);
      const lost = CHARACTERS.pangrove.health - a.heroes()[0].hp;
      if (curled) expect(lost).toBe(0);
      else expect(lost).toBeGreaterThan(0);
    }
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
  it("Link Beam can be jumped, reflects from Facet Guard and stops when one twin falls", () => {
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
  it("draws each twin and each post on its own layer, sorted by where it stands", () => {
    const a = setup(),
      g: any = new Proxy({}, { get: () => vi.fn(() => g) }),
      asked: [string, number][] = [];
    const at = (key: string, y: number) => {
      asked.push([key, y]);
      return g;
    };
    const snap = a.snapshot();
    drawConductorRing(g, snap, true, at);
    drawStormTwins(g, snap, true, 0, at);
    const twins = (snap.raid!.twins ?? []).map((m) =>
      snap.players.find((p) => p.id === m.id)!,
    );
    expect(twins).toHaveLength(2);
    expect(asked).toEqual([
      ...S.posts.map((p, i) => [`post-${i}`, p.y + 17]),
      ...twins.map((p, i) => [`twin-${i}`, p.y + 13]),
    ]);
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

describe("Storm Twins AI: smart polarity, aimed rushes and sweeping beams", () => {
  it("gives raiders standing together the same sign, so everyone must walk to an opposite", () => {
    const pairs = [
      { x: 400, y: 300 },
      { x: 440, y: 330 },
      { x: 1000, y: 600 },
      { x: 1030, y: 640 },
    ];
    const signs = polaritySigns(pairs, 7);
    expect(signs[0]).toBe(signs[1]);
    expect(signs[2]).toBe(signs[3]);
    expect(signs[0]).not.toBe(signs[2]);
    // In the arena: every raider's nearest opposite is far beyond reach.
    const a = setup(4);
    a.heroes().forEach((p, i) => Object.assign(p, pairs[i]));
    attack(a, "polarity");
    const marks = a.raid.polarities!;
    for (const [i, p] of a.heroes().entries()) {
      const gap = Math.min(
        ...a
          .heroes()
          .filter((_, j) => marks[j].sign !== marks[i].sign)
          .map((q) => Math.hypot(q.x - p.x, q.y - p.y)),
      );
      expect(gap).toBeGreaterThan(150);
      // ...and yet within reach before the marks expire.
      expect(gap).toBeLessThan(222 * (S.polarity.seconds - 0.45));
    }
    // A pair always gets opposite signs; practice keeps alternating seats.
    const two = polaritySigns(pairs.slice(0, 2), 3);
    expect(two[0]).not.toBe(two[1]);
    const b = setup(4);
    b.raid.drill = "polarity";
    b.heroes().forEach((p, i) => Object.assign(p, pairs[i]));
    attack(b, "polarity");
    expect(b.raid.polarities!.map((m) => m.sign)).toEqual([1, -1, 1, -1]);
  });
  it("keeps every raider able to reach an opposite sign, even spread across the ring", () => {
    const spread = [
      { x: 120, y: 200 },
      { x: 1480, y: 200 },
      { x: 120, y: 760 },
      { x: 1480, y: 760 },
    ];
    const signs = polaritySigns(spread, 1);
    for (const [i, p] of spread.entries())
      expect(
        Math.min(
          ...spread
            .filter((_, j) => signs[j] !== signs[i])
            .map((q) => Math.hypot(q.x - p.x, q.y - p.y)),
        ),
      ).toBeLessThan(222 * (S.polarity.seconds - 0.45));
  });
  it("rushes each twin through a different raider, ahead of a runner, from where its lane is drawn", () => {
    const a = setup(2, 2);
    const [p, q] = a.heroes();
    Object.assign(p, { x: 500, y: 300, vx: 0, vy: 0 });
    Object.assign(q, { x: 700, y: 650, vx: 230, vy: 0 });
    attack(a, "twin-rush");
    const lanes = a.raid.warnings.filter((w) => w.kind === "twin-rush");
    expect(lanes).toHaveLength(2);
    const off = (pt: { x: number; y: number }) =>
      lanes.map((w) => stormSegmentDistance(pt, w, { x: w.tx, y: w.ty }));
    // One lane through the raider standing still, one ahead of the runner.
    expect(Math.min(...off(p))).toBeLessThan(1);
    const ahead = { x: 700 + Math.min(140, 0.7 * 230 * S.rush.delay), y: 650 };
    expect(Math.min(...off(ahead))).toBeLessThan(1);
    expect(off(p).findIndex((d) => d < 1)).not.toBe(
      off(ahead).findIndex((d) => d < 1),
    );
    for (const w of lanes) {
      expect(w.tx).toBeGreaterThanOrEqual(S.rush.box.x0);
      expect(w.tx).toBeLessThanOrEqual(S.rush.box.x1);
      expect(w.ty).toBeGreaterThanOrEqual(S.rush.box.y0);
      expect(w.ty).toBeLessThanOrEqual(S.rush.box.y1);
    }
    // The twins hold still while their lanes are shown.
    const before = twins(a).map((t) => ({ x: t.x, y: t.y }));
    (a as any).nextAttack = Infinity;
    run(a, S.rush.delay - 0.05);
    expect(twins(a).map((t) => ({ x: t.x, y: t.y }))).toEqual(before);
    // Solo: both lanes cross where the raider will be.
    const b = setup(1, 2);
    Object.assign(b.heroes()[0], { x: 600, y: 450, vx: 0, vy: 0 });
    attack(b, "twin-rush");
    for (const w of b.raid.warnings)
      expect(
        stormSegmentDistance(b.heroes()[0], w, { x: w.tx, y: w.ty }),
      ).toBeLessThan(1);
  });
  it("sweeps the Link Beam across the biggest group, holding still before it lands", () => {
    const a = setup(3, 2);
    const [f, c] = twins(a);
    Object.assign(f, { x: 800, y: 300 });
    Object.assign(c, { x: 1200, y: 300 });
    // Two raiders together south of the beam, one alone north.
    Object.assign(a.heroes()[0], { x: 1000, y: 560 });
    Object.assign(a.heroes()[1], { x: 1040, y: 580 });
    Object.assign(a.heroes()[2], { x: 1000, y: 120 });
    attack(a, "link-beam");
    const w = a.raid.warnings[0];
    // The bend goes through a southern post, nearer the group.
    expect(S.posts[w.beamPost!].y).toBeGreaterThan(450);
    (a as any).nextAttack = Infinity;
    run(a, w.at - S.link.hold - a.time - 0.05);
    expect(f.y).toBeGreaterThan(300);
    expect(c.y).toBeGreaterThan(300);
    // The warning's last 0.6 s: nothing moves, so the drawn line is the hit.
    run(a, 0.1);
    const held = twins(a).map((t) => ({ x: t.x, y: t.y }));
    const drawn = { ...a.raid.warnings[0] };
    run(a, w.at - a.time - 1 / 60);
    expect(twins(a).map((t) => ({ x: t.x, y: t.y }))).toEqual(held);
    run(a, 2 / 30);
    expect(a.raid.stormBeam!.points[0]).toEqual({ x: drawn.x, y: drawn.y });
    expect(a.raid.stormBeam!.points.at(-1)).toEqual({
      x: drawn.tx,
      y: drawn.ty,
    });
    // While it burns it keeps moving towards the group, at orbit speed.
    const y = f.y;
    run(a, 1);
    expect(f.y - y).toBeGreaterThan(60);
    expect(f.y - y).toBeLessThan(75);
  });
  it("hits 24 with the Link Beam (14 when Bickering)", () => {
    for (const trait of ["in-sync", "bickering"] as const) {
      const a = setup(1, 1),
        [f, c] = twins(a);
      a.raid.trait = trait;
      Object.assign(a.heroes()[0], { x: (f.x + c.x) / 2, y: (f.y + c.y) / 2 });
      attack(a, "link-beam");
      resolve(a);
      a.tick();
      expect(CHARACTERS.cindrake.health - a.heroes()[0].hp).toBe(
        trait === "bickering" ? 14 : 24,
      );
    }
  });
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

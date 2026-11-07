import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  RULES,
  blankInput,
  type Ability,
  type CharacterId,
  type Fighter,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import type { RaidArena } from "../../apps/server/src/raid";
import type { TidewyrmArena } from "../../apps/server/src/raid-tidewyrm";
import type { GloomshadeArena } from "../../apps/server/src/raid-gloomshade";
import type { EmberwingArena } from "../../apps/server/src/raid-emberwing";
import type { StormTwinsArena } from "../../apps/server/src/raid-storm-twins";
import type { SomnaraArena } from "../../apps/server/src/raid-somnara";
import type { PrismatailArena } from "../../apps/server/src/raid-prismatail";
import {
  EMBERWING as E,
  GLOOMSHADE as G,
  RAID_BOSS_ORDER,
  RAID_BOSS_PERKS,
  SOMNARA as S,
  STORM_TWINS,
  TIDEWYRM as T,
  type RaidBossId,
  type RaidWarning,
} from "../../packages/shared/src/raid";

/** A raid with these champions, fighting, with no attacks of its own. */
const arena = <A extends RaidArena = RaidArena>(
  boss: RaidBossId,
  characters: CharacterId[],
) => {
  const a = createRaidArena("TRICKS", boss) as A;
  characters.forEach((c, i) => a.add("p" + i, "Player " + i, c));
  a.configure(1, false);
  a.start();
  a.phase = "playing";
  a.deadline = 480;
  (a as any).nextAttack = Infinity;
  (a as any).started = true;
  a.heroes().forEach((p) => (p.lastInput = blankInput()));
  return a;
};
const hero = (a: RaidArena, i: number) => a.heroes()[i];
const skill = (c: CharacterId, id: string): Ability =>
  CHARACTERS[c].skills.find((s) => s.id === id)!;
/** Stand somewhere and aim at a point (casts read the angle and the aim). */
const aim = (p: Fighter, x: number, y: number, at = { x, y }) => {
  Object.assign(p, at);
  p.angle = Math.atan2(y - p.y, x - p.x);
  p.lastInput = { ...blankInput(), aimX: x, aimY: y };
};
const run = (a: RaidArena, seconds: number) => {
  for (let t = 0; t < seconds; t += 1 / 30) a.tick(1 / 30);
};
const down = (a: RaidArena, p: Fighter) => a.damage(p, 9999, a.boss()!.id);
const near = (p: Fighter, q: { x: number; y: number }) =>
  Math.hypot(p.x - q.x, p.y - q.y);

describe("champion trick tables", () => {
  it("lists every trick with a skill and a line of text", () => {
    for (const boss of RAID_BOSS_ORDER) {
      const perks = Object.values(RAID_BOSS_PERKS[boss] ?? {});
      expect(perks.length, boss).toBeGreaterThanOrEqual(7);
      for (const perk of perks) {
        expect(perk!.skill).toBeTruthy();
        expect(perk!.text).toMatch(/\.$/);
      }
    }
  });
});

describe("Grumblecrag tricks", () => {
  it("Coilemur's Magnet Lash drags a fallen ally on its line to its side", () => {
    const a = arena("grumblecrag", ["coilemur", "voltkit", "lumoth"]);
    const [p, fallen, aside] = [hero(a, 0), hero(a, 1), hero(a, 2)];
    Object.assign(fallen, { x: 650, y: 150 });
    Object.assign(aside, { x: 400, y: 330 });
    down(a, fallen);
    down(a, aside);
    aim(p, 650, 150, { x: 200, y: 150 });
    a.cast(p, skill("coilemur", "magnet-lash"));
    expect(near(fallen, p)).toBeLessThan(RULES.radius * 2 + 10);
    expect(aside).toMatchObject({ x: 400, y: 330 });
    expect(a.raid.message).toContain("to safety");
  });
  it("Coilemur's lash stops at the boss: an ally behind it stays put", () => {
    const a = arena("grumblecrag", ["coilemur", "voltkit"]);
    const [p, fallen] = [hero(a, 0), hero(a, 1)];
    Object.assign(a.boss()!, { x: 1200, y: 800 });
    Object.assign(fallen, { x: 1420, y: 800 });
    down(a, fallen);
    aim(p, 1420, 800, { x: 900, y: 800 });
    a.cast(p, skill("coilemur", "magnet-lash"));
    expect(fallen).toMatchObject({ x: 1420, y: 800 });
  });
  it("Sunbara's Warm Spring revives a fallen ally twice as fast", () => {
    const progress = (spring: boolean) => {
      const a = arena("grumblecrag", ["sunbara", "voltkit"]);
      const [p, fallen] = [hero(a, 0), hero(a, 1)];
      Object.assign(p, { x: 300, y: 450 });
      Object.assign(fallen, { x: 360, y: 450 });
      down(a, fallen);
      if (spring) a.cast(p, skill("sunbara", "warm-spring"));
      run(a, 0.6);
      return a.raid.downed[fallen.id]!.progress;
    };
    expect(progress(true)).toBeCloseTo(progress(false) * 2, 1);
  });
  it("Astrabun's Mochi Pound adds 15 stagger", () => {
    const a = arena("grumblecrag", ["astrabun"]);
    const p = hero(a, 0),
      boss = a.boss()!,
      pound = skill("astrabun", "mochi-pound");
    a.damage(boss, 26, p.id, { ...pound, id: "plain-pound" });
    const plain = a.raid.stagger;
    a.raid.stagger = 0;
    a.damage(boss, 26, p.id, pound);
    expect(a.raid.stagger).toBeCloseTo(plain + 15);
  });
  it("Wombolder's charge into a pillar adds 25 stagger (the engine's wall slam)", () => {
    const charge = (bossX: number) => {
      const a = arena("grumblecrag", ["wombolder"]);
      const p = hero(a, 0),
        boss = a.boss()!;
      Object.assign(boss, { x: bossX, y: 450 });
      aim(p, bossX, 450, { x: bossX + 230, y: 450 });
      a.cast(p, skill("wombolder", "burrow-rush"));
      run(a, 0.4);
      return {
        stagger: a.raid.stagger,
        slam: a.events.some((e) => e.abilityId === "burrow-rush" && e.slam),
      };
    };
    // The centre pillar stands right behind it at x 750–850.
    const pinned = charge(920),
      open = charge(1230);
    expect(pinned.slam).toBe(true);
    expect(open.slam).toBe(false);
    expect(pinned.stagger - open.stagger).toBeGreaterThan(25);
  });
  it("Pangrove curled up (Curl & Roll) lets Rock Volley glance off", () => {
    for (const curled of [true, false]) {
      const a = arena("grumblecrag", ["pangrove"]);
      const p = hero(a, 0),
        boss = a.boss()!;
      Object.assign(p, { x: 1000, y: 450 });
      if (curled) a.cast(p, skill("pangrove", "curl-roll"));
      const hp = p.hp;
      (a as any).resolveWarning(
        {
          id: 1,
          kind: "volley",
          x: boss.x,
          y: boss.y,
          tx: p.x,
          ty: p.y,
          radius: 2000,
          spread: 0.4,
          at: a.time,
          startedAt: a.time,
        } as RaidWarning,
        boss,
      );
      if (curled) expect(p.hp).toBe(hp);
      else expect(p.hp).toBeLessThan(hp);
    }
  });
  it("Rock Volley is blocked by Facet Guard only, not by Wombolder's brace", () => {
    const a = arena("grumblecrag", ["wombolder"]);
    const p = hero(a, 0),
      boss = a.boss()!;
    Object.assign(p, { x: 1000, y: 450 });
    a.cast(p, skill("wombolder", "grudge-thump"));
    const hp = p.hp;
    (a as any).resolveWarning(
      {
        id: 1,
        kind: "volley",
        x: boss.x,
        y: boss.y,
        tx: p.x,
        ty: p.y,
        radius: 2000,
        spread: 0.4,
        at: a.time,
        startedAt: a.time,
      } as RaidWarning,
      boss,
    );
    expect(p.hp).toBeLessThan(hp);
  });
});

describe("Tidewyrm tricks", () => {
  const prison = (a: TidewyrmArena, id: string, x: number, y: number) =>
    (a.raid.prisons = [
      {
        playerId: id,
        x,
        y,
        hits: 0,
        presses: 0,
        until: a.time + 6,
        startedAt: a.time,
      },
    ]);
  it("Coilemur's Magnet Lash yanks a raider out of a Bubble Prison", () => {
    const a = arena<TidewyrmArena>("tidewyrm", ["coilemur", "voltkit"]);
    const [p, sealed] = [hero(a, 0), hero(a, 1)];
    prison(a, sealed.id, 450, 150);
    aim(p, 450, 150, { x: 200, y: 150 });
    a.cast(p, skill("coilemur", "magnet-lash"));
    run(a, 0.3);
    expect(a.raid.prisons).toEqual([]);
    expect(near(sealed, p)).toBeLessThan(RULES.radius * 2 + 10);
  });
  it("Pyranda's Chestnut Storm pops the bubbles and the Bubble Prison it lands on", () => {
    const a = arena<TidewyrmArena>("tidewyrm", ["pyranda", "voltkit"]);
    const [p, sealed] = [hero(a, 0), hero(a, 1)];
    prison(a, sealed.id, 700, 200);
    const bubble = { vx: 0, vy: 0, until: a.time + 9 };
    a.raid.bubbles = [
      { id: 1, x: 760, y: 160, ...bubble },
      { id: 2, x: 1400, y: 800, ...bubble },
    ];
    aim(p, 700, 200, { x: 300, y: 200 });
    a.cast(p, skill("pyranda", "chestnut-storm"));
    a.tick(1 / 30);
    expect(a.raid.prisons).toEqual([]);
    expect(a.raid.bubbles!.map((b) => b.id)).toEqual([2]);
  });
  it("Glacelle's Frost Bloom keeps a stranded Tidewyrm there 2 s longer", () => {
    const a = arena<TidewyrmArena>("tidewyrm", ["glacelle"]);
    const p = hero(a, 0),
      boss = a.boss()!,
      island = T.islands[0];
    Object.assign(boss, island);
    (a as any).strandedOn = 0;
    a.raid.exposedUntil = a.time + 5;
    const until = a.raid.exposedUntil;
    aim(p, island.x, island.y, { x: island.x + 300, y: island.y });
    a.cast(p, skill("glacelle", "frost-bloom"));
    run(a, 0.7);
    expect(a.raid.exposedUntil).toBeCloseTo(until + 2);
    expect(a.raid.message).toContain("stranded");
  });
  it("A Mossloth seedling going off by a stranded Tidewyrm keeps it there 1 s longer", () => {
    const a = arena<TidewyrmArena>("tidewyrm", ["mossloth"]);
    const p = hero(a, 0),
      boss = a.boss()!,
      island = T.islands[0];
    Object.assign(boss, island);
    (a as any).strandedOn = 0;
    a.raid.exposedUntil = a.time + 5;
    const until = a.raid.exposedUntil;
    aim(p, island.x, island.y, { x: island.x + 300, y: island.y });
    a.cast(p, skill("mossloth", "seedling"));
    run(a, 0.7);
    expect(a.raid.exposedUntil).toBeCloseTo(until + 1);
    expect(a.raid.message).toContain("stranded");
  });
  it("Pangrove's Tongue Grapple on a stranded Tidewyrm adds extra stagger", () => {
    const grapple = skill("pangrove", "tongue-grapple");
    const staggerAfter = (move: Ability) => {
      const a = arena<TidewyrmArena>("tidewyrm", ["pangrove"]);
      const p = hero(a, 0),
        boss = a.boss()!,
        island = T.islands[0];
      Object.assign(boss, island);
      (a as any).strandedOn = 0;
      a.raid.exposedUntil = a.time + 5;
      a.raid.stagger = 0;
      a.damage(boss, 10, p.id, move);
      return a.raid.stagger;
    };
    // Against the same move under another name (same slow, same stagger from it).
    expect(
      staggerAfter(grapple) - staggerAfter({ ...grapple, id: "plain-tongue" }),
    ).toBeCloseTo(T.lanceStagger, 0);
  });
});

describe("Gloomshade tricks", () => {
  it("Pyranda's Chestnut Mortar relights a dark lantern it lands on", () => {
    const a = arena<GloomshadeArena>("gloomshade", ["pyranda"]);
    const p = hero(a, 0),
      lantern = a.raid.lanterns![0];
    lantern.lit = false;
    aim(p, lantern.x, lantern.y, { x: G.lanterns[0].x + 400, y: 450 });
    a.cast(p, skill("pyranda", "chestnut-mortar"));
    a.tick(1 / 30);
    expect(lantern.lit).toBe(true);
  });
  for (const id of ["warm-spring", "sanctuary"])
    it(`Sunbara's ${id} cleanses curses from allies inside it`, () => {
      const a = arena<GloomshadeArena>("gloomshade", ["sunbara", "voltkit"]);
      const [p, cursed] = [hero(a, 0), hero(a, 1)];
      Object.assign(p, { x: 800, y: 450 });
      Object.assign(cursed, { x: 860, y: 450 });
      a.raid.curses = { [cursed.id]: { stacks: 2, hauntedUntil: 0 } };
      a.cast(p, skill("sunbara", id));
      a.tick(1 / 30);
      expect(a.raid.curses[cursed.id]).toBeUndefined();
    });
  it("Wombolder's Landslide shakes off every copy", () => {
    const a = arena<GloomshadeArena>("gloomshade", ["wombolder"]);
    const p = hero(a, 0),
      boss = a.boss()!;
    (a as any).split();
    expect(a.raid.decoys!.length).toBeGreaterThan(0);
    a.damage(boss, 16, p.id, skill("wombolder", "burrow-rush"));
    expect(a.raid.decoys!.length).toBeGreaterThan(0);
    a.damage(boss, 30, p.id, skill("wombolder", "landslide"));
    expect(a.raid.decoys).toEqual([]);
  });
  it("Shadopus hidden in its Ink Cloud is never picked as a target", () => {
    const a = arena<GloomshadeArena>("gloomshade", ["shadopus", "voltkit"]);
    const [p, other] = [hero(a, 0), hero(a, 1)];
    (a as any).threat.set(p.id, 1000);
    expect((a as any).chooseTarget("lunge", [p, other])).toBe(p);
    a.cast(p, skill("shadopus", "ink-cloud"));
    for (let i = 0; i < 6; i++) {
      (a as any).attacks = i;
      for (const kind of ["lunge", "curse", "snuff"])
        expect((a as any).chooseTarget(kind, [p, other])).toBe(other);
    }
    // Alone and hidden, it waits for you to show yourself.
    const solo = arena<GloomshadeArena>("gloomshade", ["shadopus"]);
    expect((solo as any).canStartAttack()).toBe(true);
    solo.cast(hero(solo, 0), skill("shadopus", "ink-cloud"));
    expect((solo as any).canStartAttack()).toBe(false);
    run(solo, 2.6);
    expect((solo as any).canStartAttack()).toBe(true);
  });
});

describe("Emberwing tricks", () => {
  const flying = (c: CharacterId) => {
    const a = arena<EmberwingArena>("emberwing", [c]);
    a.raid.phase = 2;
    a.tick(1 / 30);
    expect(a.raid.airborne).toBe(true);
    return a;
  };
  it("Pyranda's Chestnut Mortar lights a brazier from range", () => {
    const a = flying("pyranda");
    const p = hero(a, 0),
      b = E.braziers[1];
    aim(p, b.x, b.y, { x: b.x + 600, y: b.y });
    a.cast(p, skill("pyranda", "chestnut-mortar"));
    a.tick(1 / 30);
    expect(a.raid.braziers![1].litUntil).toBeGreaterThan(a.time);
  });
  it("Glacelle's Frost Bloom puts out fire patches and dive trails", () => {
    const a = flying("glacelle");
    const p = hero(a, 0);
    a.raid.emberPatches = [
      { id: 1, x: 500, y: 700, radius: 80, until: a.time + 30, growAt: 99 },
    ];
    a.raid.emberTrails = [
      { x: 400, y: 700, tx: 600, ty: 700, until: a.time + 5, width: 40 },
    ];
    aim(p, 500, 700, { x: 300, y: 450 });
    a.cast(p, skill("glacelle", "frost-bloom"));
    a.tick(1 / 30);
    expect(a.raid.emberPatches).toEqual([]);
    expect(a.raid.emberTrails).toEqual([]);
  });
  it("Mossloth's Overgrowth smothers fire patches and dive trails around it", () => {
    const a = flying("mossloth");
    const p = hero(a, 0);
    a.raid.emberPatches = [
      { id: 1, x: 500, y: 700, radius: 80, until: a.time + 30, growAt: 99 },
    ];
    a.raid.emberTrails = [
      { x: 400, y: 700, tx: 600, ty: 700, until: a.time + 5, width: 40 },
    ];
    Object.assign(p, { x: 500, y: 640 });
    p.ult = 100;
    a.cast(p, skill("mossloth", "overgrowth"));
    a.tick(1 / 30);
    expect(a.raid.emberPatches).toEqual([]);
    expect(a.raid.emberTrails).toEqual([]);
  });
  it("Halcyra's Aura Quill and Focus Shot hit an airborne Emberwing at full damage", () => {
    const a = flying("halcyra");
    const p = hero(a, 0),
      boss = a.boss()!;
    for (const shot of [
      CHARACTERS.halcyra.basic,
      skill("halcyra", "focus-shot"),
    ]) {
      let hp = boss.hp;
      a.damage(boss, 20, p.id, { ...shot, id: "plain-shot" });
      const half = hp - boss.hp;
      hp = boss.hp;
      a.damage(boss, 20, p.id, shot);
      expect(hp - boss.hp).toBeCloseTo(half * 2);
    }
  });
  it("Astrabun's Full Moon reaches an airborne Emberwing at full damage, +20 stagger", () => {
    const a = flying("astrabun");
    const p = hero(a, 0),
      boss = a.boss()!,
      moon = skill("astrabun", "full-moon");
    let hp = boss.hp;
    a.damage(boss, 36, p.id, { ...moon, id: "plain-moon" });
    const half = hp - boss.hp,
      plain = a.raid.stagger;
    hp = boss.hp;
    a.raid.stagger = 0;
    a.damage(boss, 36, p.id, moon);
    expect(hp - boss.hp).toBeCloseTo(half * 2);
    expect(a.raid.stagger).toBeGreaterThanOrEqual(plain + 20);
  });
});

describe("Storm Twins tricks", () => {
  const twins = (a: StormTwinsArena) => a.players.filter((p) => p.raidBoss);
  it("Coilemur's Electromagnet drags both twins toward it, shortening the Link Beam", () => {
    const a = arena<StormTwinsArena>("storm-twins", ["coilemur"]);
    const p = hero(a, 0),
      [fizz, crackle] = twins(a),
      magnet = skill("coilemur", "electromagnet");
    Object.assign(p, { x: 800, y: 450 });
    Object.assign(fizz, { x: 560, y: 450 });
    Object.assign(crackle, { x: 1040, y: 450 });
    a.damage(fizz, 7, p.id, magnet);
    a.damage(crackle, 7, p.id, magnet);
    expect(near(fizz, p)).toBeCloseTo(195);
    expect(near(crackle, p)).toBeCloseTo(195);
    expect(near(fizz, crackle)).toBeCloseTo(390);
    // Never closer than touching.
    for (let i = 0; i < 10; i++) a.damage(fizz, 7, p.id, magnet);
    expect(near(fizz, p)).toBeGreaterThanOrEqual(
      STORM_TWINS.radius + RULES.radius,
    );
  });
  it("Halcyra's Focus Shot pierces the first twin and hits the one behind it", () => {
    const shoot = (crackleY: number) => {
      const a = arena<StormTwinsArena>("storm-twins", ["halcyra"]);
      a.raid.phase = 3;
      const p = hero(a, 0),
        [fizz, crackle] = twins(a);
      Object.assign(fizz, { x: 800, y: 450 });
      Object.assign(crackle, { x: 1150, y: crackleY });
      aim(p, 1400, 450, { x: 300, y: 450 });
      const before = [fizz.hp, crackle.hp];
      a.cast(p, skill("halcyra", "focus-shot"));
      return [before[0] - fizz.hp, before[1] - crackle.hp];
    };
    const [first, second] = shoot(450);
    expect(first).toBeGreaterThan(0);
    expect(second).toBeGreaterThan(0);
    expect(shoot(750)[1]).toBe(0);
  });
  it("Wombolder Braced by Grudge Thump stops Twin Rush and staggers that twin", () => {
    const a = arena<StormTwinsArena>("storm-twins", ["wombolder"]);
    a.raid.trait = "bickering";
    const p = hero(a, 0),
      [fizz] = twins(a),
      hp = p.hp;
    a.cast(p, skill("wombolder", "grudge-thump"));
    (a as any).hitBy = "twin-rush";
    a.damage(p, STORM_TWINS.rush.damage, fizz.id);
    expect(p.hp).toBe(hp);
    expect(a.raid.twins![0].stagger).toBe(15);
    // Once the brace wears off, the rush lands.
    run(a, 2);
    (a as any).hitBy = "twin-rush";
    a.damage(p, STORM_TWINS.rush.damage, fizz.id);
    expect(p.hp).toBeLessThan(hp);
  });
});

describe("Somnara tricks", () => {
  const drowsy = (a: SomnaraArena, p: Fighter) => (a as any).addDrowsy(p);
  it("Sunbara's Warm Spring wakes sleepers and keeps them from going Drowsy", () => {
    const a = arena<SomnaraArena>("somnara", ["sunbara", "voltkit"]);
    const [p, sleeper] = [hero(a, 0), hero(a, 1)];
    Object.assign(p, { x: 800, y: 450 });
    Object.assign(sleeper, { x: 860, y: 450 });
    for (let i = 0; i < S.drowsy.stacks; i++) drowsy(a, sleeper);
    expect(a.has(sleeper, "sleep")).toBe(true);
    a.cast(p, skill("sunbara", "warm-spring"));
    a.tick(1 / 30);
    expect(a.has(sleeper, "sleep")).toBe(false);
    const stacks = a.raid.drowsy?.[sleeper.id]?.stacks ?? 0;
    drowsy(a, sleeper);
    expect(a.raid.drowsy?.[sleeper.id]?.stacks ?? 0).toBe(stacks);
    // Outside the spring, it builds again.
    Object.assign(sleeper, { x: 1300, y: 450 });
    drowsy(a, sleeper);
    expect(a.raid.drowsy![sleeper.id].stacks).toBe(stacks + 1);
  });
  for (const [label, offset] of [
    ["beside", 100],
    ["on", 0],
  ] as const)
    it(`Astrabun's Moon Hop landing ${label} a rune pad steps on it once`, () => {
      const a = arena<SomnaraArena>("somnara", ["astrabun"]);
      const p = hero(a, 0);
      (a as any).beginDream();
      run(a, 0.4);
      const d = a.raid.dream!,
        view = a.dreamFor(p.id)!,
        rune = (view.backwards ? [...view.runes].reverse() : view.runes)[0],
        pad = S.pads.find((q) => q.rune === rune)!,
        side = pad.x < 800 ? 1 : -1;
      aim(p, pad.x + side * offset, pad.y, {
        x: pad.x + side * (offset + 280),
        y: pad.y,
      });
      a.cast(p, skill("astrabun", "moon-hop"));
      expect(d.step).toBe(1);
      run(a, 0.5);
      expect(d.step).toBe(1);
    });
  it("Mossloth's Sloth Time keeps allies inside from going Drowsy", () => {
    const a = arena<SomnaraArena>("somnara", ["mossloth", "voltkit"]);
    const [p, ally] = [hero(a, 0), hero(a, 1)];
    aim(p, 900, 450, { x: 700, y: 450 });
    Object.assign(ally, { x: 900, y: 450 });
    a.cast(p, skill("mossloth", "sloth-time"));
    for (let i = 0; i < S.drowsy.stacks + 1; i++) drowsy(a, ally);
    expect(a.has(ally, "sleep")).toBe(false);
    expect(a.raid.drowsy?.[ally.id]?.stacks ?? 0).toBe(0);
    // Outside the bubble, it builds again.
    Object.assign(ally, { x: 1400, y: 450 });
    drowsy(a, ally);
    expect(a.raid.drowsy![ally.id].stacks).toBe(1);
  });
  it("Shadopus hidden in its Ink Cloud can't go Drowsy or fall asleep", () => {
    const a = arena<SomnaraArena>("somnara", ["shadopus"]);
    const p = hero(a, 0);
    Object.assign(p, { x: 400, y: 450 });
    a.cast(p, skill("shadopus", "ink-cloud"));
    for (let i = 0; i < S.drowsy.stacks; i++) drowsy(a, p);
    expect(a.has(p, "sleep")).toBe(false);
    expect(a.raid.drowsy?.[p.id]?.stacks ?? 0).toBe(0);
    // A Lullaby ring still stings (and reveals it), but adds no Drowsy.
    a.raid.dreamRings = [
      { id: 1, x: 340, y: 450, radius: 0, startedAt: a.time },
    ];
    const hp = p.hp;
    run(a, 0.5);
    expect(p.hp).toBeLessThan(hp);
    expect(a.has(p, "stealth")).toBe(false);
    expect(a.raid.drowsy?.[p.id]?.stacks ?? 0).toBe(0);
    drowsy(a, p);
    expect(a.raid.drowsy![p.id].stacks).toBe(1);
  });
});

describe("Prismatail tricks", () => {
  it("Glacelle's Frost Bloom ice relays the sunbeam for 4 s", () => {
    const a = arena<PrismatailArena>("prismatail", ["glacelle"]);
    const p = hero(a, 0);
    aim(p, 600, 300, { x: 400, y: 300 });
    a.cast(p, skill("glacelle", "frost-bloom"));
    expect(a.raid.sunPillars).toEqual([
      { x: 600, y: 300, until: a.time + 4, owner: p.id },
    ]);
  });
  it("Halcyra's Skyline Lance cuts every Prism Lance lane it crosses", () => {
    const cut = (downward: boolean) => {
      const a = arena<PrismatailArena>("prismatail", ["halcyra", "voltkit"]);
      const [p, target] = [hero(a, 0), hero(a, 1)];
      Object.assign(a.boss()!, { x: 1000, y: 450 });
      Object.assign(target, { x: 400, y: 450 });
      (a as any).startAttack("prism-lance", target);
      expect(a.raid.warnings).toHaveLength(1);
      aim(p, 700, downward ? 800 : 0, { x: 700, y: 200 });
      a.cast(p, skill("halcyra", "skyline-lance"));
      return a.raid.warnings.length;
    };
    expect(cut(true)).toBe(0);
    expect(cut(false)).toBe(1);
  });
  it("Shadopus's Ink Jet on Prismatail blots out a Glare within 3 s", () => {
    const glare = (wait: number) => {
      const a = arena<PrismatailArena>("prismatail", ["shadopus"]);
      const p = hero(a, 0),
        boss = a.boss()!;
      aim(p, boss.x, boss.y, { x: boss.x - 300, y: boss.y });
      a.damage(boss, 12, p.id, skill("shadopus", "ink-jet"));
      a.time += wait;
      (a as any).startAttack("glare", p);
      const [w] = a.raid.warnings;
      a.raid.warnings = [];
      (a as any).resolveWarning(w, boss);
      return a.raid.blinded?.[p.id];
    };
    expect(glare(1.5)).toBeUndefined();
    expect(glare(3.5)).toBeGreaterThan(0);
  });
});

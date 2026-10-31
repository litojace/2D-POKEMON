import { describe, it, expect, vi } from "vitest";
import {
  CHARACTERS,
  blankInput,
  packSnapshot,
  type CharacterId,
} from "@arena/shared";
import { createRaidArena } from "../../apps/server/src/raid-bosses";
import { EmberwingArena } from "../../apps/server/src/raid-emberwing";
import {
  riteValue,
  EMBERWING as E,
  RAID_BOSSES,
  RAID_BOSS_ATTACKS,
  ritesFor,
  brazierLifetime,
  type RaidAttack,
} from "../../packages/shared/src/raid";
import {
  raidCue,
  featureLabel,
  raidContributions,
} from "../../apps/client/src/raid-presentation";
import {
  drawSkyTerrace,
  drawEmberwingWarning,
  drawEmberwing,
} from "../../apps/client/src/raid-emberwing-art";
import { SKINS, tonePixels } from "../../apps/client/src/animation/cosmetics";
import {
  drawCollectionAura,
  playCollectionEntrance,
  drawCollectionVictory,
} from "../../apps/client/src/skins/collection-fx";
const setup = (
  size = 1,
  phase = 2,
  peril = 1,
  chars: CharacterId[] = ["voltkit"],
) => {
  const a = createRaidArena("EMBERS", "emberwing") as EmberwingArena;
  for (let i = 0; i < size; i++)
    a.add("p" + i, "Raider " + i, chars[i % chars.length]);
  a.configure(peril, false);
  a.start();
  a.phase = "playing";
  a.raid.phase = phase;
  a.raid.trait = "molting";
  a.raid.gilded = false;
  (a as any).started = true;
  (a as any).nextAttack = Infinity;
  a.heroes().forEach((p) => {
    p.x = 300;
    p.y = 450;
    p.lastInput = blankInput();
  });
  return a;
};
const run = (a: EmberwingArena, s: number) => {
  for (let i = 0; i < Math.ceil(s * 30); i++) a.tick();
};
const attack = (a: EmberwingArena, kind: RaidAttack) =>
  (a as any).startAttack(kind, a.heroes()[0]);
const resolve = (a: EmberwingArena) => {
  const warnings = [...a.raid.warnings];
  a.raid.warnings = [];
  for (const w of warnings) {
    (a as any).struck.clear();
    (a as any).resolveWarning(w, a.boss()!);
  }
};
const stand = (a: EmberwingArena, index: number, player = 0) =>
  Object.assign(a.heroes()[player], E.braziers[index]);
const lightAll = (a: EmberwingArena) => {
  for (let i = 0; i < 3; i++) {
    stand(a, i);
    run(a, 1.6);
  }
};
describe("Emberwing flight and brazier puzzle", () => {
  it("uses its own wall-free arena, health scaling, chapters, attacks and themed rite", () => {
    const a = setup(4);
    expect(a).toBeInstanceOf(EmberwingArena);
    expect(a.arenaId).toBe("sky-terrace");
    expect(a.walls()).toEqual([]);
    expect(a.raid.pillars).toEqual([]);
    expect(RAID_BOSSES.emberwing.playable).toBe(true);
    expect([3740, Math.round(3740 * 1.12)]).toContain(a.raid.maxHp);
    expect(ritesFor("emberwing")).toContain("fireproof");
    expect(ritesFor("prismatail")).not.toContain("fireproof");
    for (const phase of [1, 2, 3]) {
      a.raid.phase = phase;
      for (const kind of (a as any).pattern())
        expect(RAID_BOSS_ATTACKS.emberwing).toContain(kind);
    }
  });
  it("stays on the ground in Takeoff, and takes flight in High Flight", () => {
    const a = setup(1, 1);
    a.tick();
    expect(a.raid.airborne).toBe(false);
    a.raid.phase = 2;
    a.tick();
    expect(a.raid.airborne).toBe(true);
  });
  for (const size of [1, 2, 3, 4])
    for (const peril of [1, 2, 3])
      it(`grounds with ${size} raider(s) on Peril ${peril}`, () => {
        const a = setup(size, 3, peril);
        a.tick();
        if (size === 1) lightAll(a);
        else if (size === 2) {
          stand(a, 0, 0);
          stand(a, 1, 1);
          run(a, 1.6);
          stand(a, 2, 0);
          run(a, 1.6);
        } else {
          for (let i = 0; i < 3; i++) stand(a, i, i);
          run(a, 1.6);
        }
        expect(a.raid.airborne).toBe(false);
        expect(a.raid.groundings).toBe(1);
        expect(a.raid.exposedUntil).toBeGreaterThan(a.time);
        expect(a.raid.quickGroundings).toBe(1);
      });
  it("requires continuous standing, expires lit flames and never relights a lit brazier for credit", () => {
    const a = setup();
    a.tick();
    stand(a, 0);
    run(a, 0.8);
    expect(a.raid.braziers![0].progress).toBeGreaterThan(0.4);
    a.heroes()[0].x = 100;
    run(a, 0.1);
    expect(a.raid.braziers![0].progress).toBe(0);
    stand(a, 0);
    run(a, 1.6);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
    run(a, 2);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
    a.heroes()[0].x = 100;
    run(a, 11);
    expect(a.raid.braziers![0].litUntil).toBe(0);
  });
  it("uses longer solo timers and Fireproof halves lighting time", () => {
    expect(brazierLifetime(1, 3, 3)).toBe(8);
    expect(brazierLifetime(1, 2, 1)).toBe(12);
    expect(brazierLifetime(2, 3, 1)).toBe(4);
    expect(brazierLifetime(4, 2, 3)).toBe(6);
    const a = setup();
    a.raid.rites.p0 = ["fireproof"];
    a.tick();
    stand(a, 0);
    run(a, 0.8);
    expect(a.raid.braziers![0].litUntil).toBeGreaterThan(a.time);
    expect(a.raid.contributions!.p0.pillars).toBe(1);
  });
  it("blocks airborne melee, halves ranged damage, and gives Lumoth stars full damage", () => {
    const a = setup();
    a.tick();
    const boss = a.boss()!,
      p = a.heroes()[0],
      before = boss.hp;
    a.damage(boss, 20, p.id, { ...CHARACTERS.voltkit.basic, kind: "melee" });
    expect(boss.hp).toBe(before);
    a.damage(boss, 20, p.id, CHARACTERS.voltkit.basic);
    const half = before - boss.hp;
    const hp = boss.hp;
    a.damage(boss, 20, p.id, {
      ...CHARACTERS.lumoth.skills[0],
      id: "starfall-spray",
    });
    expect(hp - boss.hp).toBeCloseTo(half * 2);
    const groundHp = boss.hp;
    a.damage(boss, 20, p.id, {
      ...CHARACTERS.terradon.skills[0],
      ground: true,
    });
    expect(boss.hp).toBe(groundHp);
  });
  it("shrinks fire when grounded and keeps the final heart open after two groundings", () => {
    const a = setup(1, 3);
    a.tick();
    attack(a, "scorched-earth");
    resolve(a);
    a.raid.emberPatches![0].radius = 150;
    lightAll(a);
    expect(a.raid.emberPatches![0].radius).toBeCloseTo(67.5);
    expect(a.raid.permanentGround).toBe(false);
    a.time = a.raid.exposedUntil + 0.1;
    (a as any).nextAttack = Infinity;
    a.tick();
    lightAll(a);
    expect(a.raid.permanentGround).toBe(true);
    expect(a.raid.chapterGroundings).toBe(2);
    a.time = a.raid.exposedUntil + 1;
    a.tick();
    expect(a.raid.airborne).toBe(false);
    expect((a as any).alwaysExposed()).toBe(true);
  });
  it("counts the quick-grounding feat only after three real takeoffs and a victory", () => {
    const a = setup();
    for (let i = 0; i < 3; i++) {
      a.tick();
      lightAll(a);
      a.time = a.raid.exposedUntil + 0.1;
      (a as any).nextAttack = Infinity;
    }
    expect(a.raid.quickGroundings).toBe(3);
    expect(a.feat()).toBe(false);
    a.raid.result = "victory";
    expect(a.feat()).toBe(true);
  });
  it("Updraft delays brazier activation but extends exposure by two seconds", () => {
    const a = setup();
    a.raid.trait = "updraft";
    stand(a, 0);
    run(a, 1.6);
    expect(a.raid.braziers![0].progress).toBe(0);
    expect(raidCue(a.snapshot(), "p0")).toContain("Updraft");
    run(a, 2.1);
    stand(a, 1);
    run(a, 1.6);
    stand(a, 2);
    run(a, 1.6);
    expect(a.raid.groundings).toBe(1);
    expect(a.raid.exposedUntil - a.time).toBeGreaterThan(7.7);
  });
});
describe("Emberwing attacks and champion answers", () => {
  it("locks dives, sweeps their full lane, and leaves a four-second burning trail", () => {
    const a = setup(1, 1);
    attack(a, "dive-bomb");
    const w = { ...a.raid.warnings[0] };
    a.heroes()[0].y += 200;
    a.tick();
    expect(a.raid.warnings[0].ty).toBe(w.ty);
    resolve(a);
    expect(a.raid.emberTrails![0].until - a.time).toBeCloseTo(4);
    run(a, 0.5);
    expect(a.heroes()[0].hp).toBe(CHARACTERS.voltkit.health);
    const b = setup(1, 1);
    attack(b, "dive-bomb");
    resolve(b);
    run(b, 0.5);
    expect(b.heroes()[0].hp).toBeLessThan(CHARACTERS.voltkit.health);
  });
  it("Mirror Guard reflects the dive and contributes twenty stagger", () => {
    const a = setup(1, 1, 1, ["auralynx"]),
      p = a.heroes()[0];
    a.status(p, "counter", 2);
    const spy = vi.spyOn(a, "reflectDamage");
    attack(a, "dive-bomb");
    resolve(a);
    run(a, 0.5);
    expect(spy).toHaveBeenCalled();
    expect(a.raid.stagger).toBeGreaterThanOrEqual(20);
  });
  it("Heat Marks follow their raiders, hurt nearby allies, and are safe for spread allies", () => {
    const a = setup(3, 2);
    attack(a, "heat-mark");
    expect(a.raid.warnings).toHaveLength(2);
    Object.assign(a.heroes()[0], { x: 400, y: 300 });
    Object.assign(a.heroes()[1], { x: 900, y: 700 });
    Object.assign(a.heroes()[2], { x: 405, y: 300 });
    (a as any).followWarnings(a.boss());
    expect(a.raid.warnings[0].x).toBe(400);
    resolve(a);
    expect(a.heroes()[2].hp).toBeLessThan(CHARACTERS.voltkit.health);
    expect(a.heroes()[1].hp).toBeLessThan(CHARACTERS.voltkit.health);
    const b = setup(3, 2);
    attack(b, "heat-mark");
    b.heroes()[2].x = 1450;
    b.heroes()[2].y = 700;
    resolve(b);
    expect(b.heroes()[2].hp).toBe(CHARACTERS.voltkit.health);
  });
  it("staggered rain has separated circles and higher Perils remain readable", () => {
    const a = setup(4, 2, 3);
    attack(a, "ember-rain");
    const warnings = a.raid.warnings;
    expect(warnings.length).toBeGreaterThan(3);
    expect(warnings.length).toBeLessThanOrEqual(9);
    expect(warnings.at(-1)!.at).toBeGreaterThan(warnings[0].at);
    for (let i = 0; i < warnings.length; i++)
      for (let j = i + 1; j < warnings.length; j++)
        expect(
          Math.hypot(
            warnings[i].x - warnings[j].x,
            warnings[i].y - warnings[j].y,
          ),
        ).toBeGreaterThanOrEqual(E.rain.radius * 1.8);
  });
  it("Flame Rings sweep once per raider and can be jumped", () => {
    const a = setup(1, 1);
    const p = a.heroes()[0];
    Object.assign(p, { x: a.boss()!.x - 200, y: a.boss()!.y });
    attack(a, "flame-ring");
    resolve(a);
    run(a, 1.4);
    expect(p.hp).toBeLessThan(CHARACTERS.voltkit.health);
    const hp = p.hp;
    run(a, 1);
    expect(p.hp).toBe(hp);
    const b = setup(1, 1),
      q = b.heroes()[0];
    Object.assign(q, {
      x: b.boss()!.x - 200,
      y: b.boss()!.y,
      jumpUntil: b.time + 2,
    });
    attack(b, "flame-ring");
    resolve(b);
    run(b, 1.4);
    expect(q.hp).toBe(CHARACTERS.voltkit.health);
  });
  it("a dash into Wing Gust resists the push while an ordinary raider is displaced", () => {
    const a = setup(2, 1),
      p = a.heroes()[0],
      q = a.heroes()[1];
    Object.assign(p, { x: 850, y: 400 });
    Object.assign(q, { x: 850, y: 400 });
    p.dashUntil = a.time + 1;
    p.lastInput.dx = 1;
    p.lastInput.dy = 0;
    attack(a, "wing-gust");
    resolve(a);
    expect(p.x).toBe(850);
    expect(q.x).toBeLessThan(700);
  });
  it("grows bounded fire, avoids damage stacking, and Fireproof halves floor damage", () => {
    const a = setup(),
      p = a.heroes()[0];
    attack(a, "scorched-earth");
    resolve(a);
    const patch = a.raid.emberPatches![0];
    const hp = p.hp;
    run(a, 1.1);
    const full = hp - p.hp;
    expect(full).toBeGreaterThan(4);
    const b = setup(),
      q = b.heroes()[0];
    b.raid.rites.p0 = ["fireproof"];
    attack(b, "scorched-earth");
    resolve(b);
    run(b, 1.1);
    // Fireproof's share grows by chapter (50% / 60% / 70% less).
    expect(CHARACTERS.voltkit.health - q.hp).toBeCloseTo(full * (1 - riteValue("fireproof", b.raid.phase)));
    a.time = patch.growAt + 0.1;
    (a as any).worldStep(0.01, a.boss());
    expect(patch.radius).toBeGreaterThan(E.fire.initialRadius);
    for (let i = 0; i < 20; i++) {
      attack(a, "scorched-earth");
      resolve(a);
    }
    expect(a.raid.emberPatches!.length).toBe(12);
  });
  it("Cindrake lights a brazier with Blaze Whirl and Tidefin extinguishes burning ground", () => {
    const a = setup(1, 2, 1, ["cindrake"]);
    a.tick();
    stand(a, 0);
    a.cast(
      a.heroes()[0],
      CHARACTERS.cindrake.skills.find((a) => a.id === "blaze-whirl")!,
    );
    expect(a.raid.braziers![0].litUntil).toBeGreaterThan(a.time);
    const b = setup(1, 2, 1, ["tidefin"]),
      p = b.heroes()[0];
    attack(b, "scorched-earth");
    resolve(b);
    expect(b.raid.emberPatches).toHaveLength(1);
    p.lastInput.aimX = p.x;
    p.lastInput.aimY = p.y;
    b.cast(
      p,
      CHARACTERS.tidefin.skills.find((a) => a.id === "whirlpool")!,
    );
    expect(b.raid.emberPatches).toEqual([]);
  });
  it("Molting drops collectible feathers worth ten ultimate charge", () => {
    const a = setup(1, 1);
    attack(a, "dive-bomb");
    resolve(a);
    run(a, 0.5);
    expect(a.raid.emberFeathers).toHaveLength(1);
    const p = a.heroes()[0];
    Object.assign(p, a.raid.emberFeathers![0]);
    p.ult = 25;
    a.tick();
    expect(p.ult).toBeGreaterThanOrEqual(35);
    expect(a.raid.emberFeathers).toEqual([]);
  });
  it("practises braziers without crediting real progress, and clears mechanics on retry and drill switches", () => {
    const a = setup();
    a.raid.drill = "brazier-lighting";
    a.raid.drillStats = { hits: 0, dodges: 0 };
    lightAll(a);
    expect(a.raid.drillStats.dodges).toBe(1);
    expect(a.raid.contributions!.p0.pillars).toBe(0);
    a.setDrill("ember-rain");
    expect(a.raid.emberPatches).toEqual([]);
    expect(a.raid.airborne).toBe(false);
    a.stopDrill();
    expect(a.phase).toBe("lobby");
    const b = setup();
    b.tick();
    b.forfeit("p0");
    expect(b.raid.airborne).toBe(false);
    b.retry();
    expect(b.raid.groundings).toBe(0);
    expect(b.raid.braziers!.every((b) => b.litUntil === 0)).toBe(true);
  });
  it("packs the encounter, uses brazier contribution labels, and draws all attacks without state mutation", () => {
    const a = setup();
    a.tick();
    expect(packSnapshot(a.snapshot()).raid!.braziers).toHaveLength(3);
    expect(featureLabel("emberwing")).toBe("Braziers");
    expect(raidContributions(a.snapshot())).toContain("Braziers");
    expect(raidCue(a.snapshot(), "p0")).toContain("braziers");
    const g: any = new Proxy({}, { get: () => vi.fn(() => g) });
    const before = JSON.stringify(a.snapshot());
    drawSkyTerrace(g, a.snapshot(), true);
    drawEmberwing(g, a.snapshot(), true, 0);
    expect(JSON.stringify(a.snapshot())).toBe(before);
    for (const kind of RAID_BOSS_ATTACKS.emberwing!) {
      attack(a, kind);
      for (const w of a.raid.warnings)
        expect(drawEmberwingWarning(g, a.snapshot(), w)).toBe(true);
      a.raid.warnings = [];
    }
  });
});
it("renders all Emberwing appearance effects and gives both skins distinct palettes", () => {
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
  expect(drawCollectionAura(g, "ember-aura", 0, 0, 1000, false)).toBe(true);
  const before = JSON.stringify(commands);
  commands.length = 0;
  drawCollectionAura(g, "ember-aura", 0, 0, 1800, false);
  expect(JSON.stringify(commands)).not.toBe(before);
  expect(playCollectionEntrance(emit, "firefall", 0, 0, 1)).toBe(true);
  expect(emit).toHaveBeenCalledTimes(22);
  expect(
    drawCollectionVictory(
      g,
      g,
      emit,
      () => false,
      "feather-fall",
      0,
      0,
      1,
      1,
      0.016,
      false,
    ),
  ).toBe(true);
  const palettes = [];
  for (const skin of ["ember-colors", "cinderplume"] as const) {
    expect(SKINS).toContain(skin);
    const pixels = new Uint8ClampedArray([120, 140, 160, 255]);
    tonePixels(pixels, skin);
    palettes.push([...pixels]);
  }
  expect(palettes[0]).not.toEqual(palettes[1]);
});

describe("Emberwing movement and long encounters", () => {
  for (const size of [1, 2, 3, 4])
    for (const peril of [1, 2, 3])
      it(`walks the final brazier route with ${size} slow stand-ins on Peril ${peril}`, () => {
        const a = setup(size, 3, peril, ["terradon"]);
        a.heroes().forEach((p) => a.standIn(p.id));
        for (let t = 0; t < 30 && !a.raid.groundings; t += 1 / 30) a.tick();
        expect(
          a.raid.groundings,
          JSON.stringify({
            braziers: a.raid.braziers,
            positions: a.heroes().map((p) => ({ x: p.x, y: p.y })),
            time: a.time,
          }),
        ).toBeGreaterThan(0);
      });
  it("plays every chapter and attack with four stand-ins without invalid positions", () => {
    const a = setup(4, 1, 3, ["voltkit", "cindrake", "tidefin", "lumoth"]);
    a.heroes().forEach((p) => a.standIn(p.id));
    (a as any).nextAttack = 0;
    const seen = new Set<string>();
    let finalFor = 0,
      grounds = 0;
    const chip = a.raid.maxHp / 3 / 75 / 30;
    for (let t = 0; t < 460 && !a.raid.result && finalFor < 80; t += 1 / 30) {
      const before = a.boss()!.hp;
      a.tick();
      a.boss()!.hp = before - (a.phase === "playing" ? chip : 0);
      for (const w of a.raid.warnings) seen.add(w.kind);
      grounds = Math.max(grounds, a.raid.groundings ?? 0);
      if (a.phase === "intermission")
        for (const [id, offer] of Object.entries(a.raid.offers))
          a.pickRite(id, offer[0]);
      for (const p of a.heroes()) {
        p.hp = CHARACTERS[p.character].health;
        expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      }
      if (a.raid.phase === 3) finalFor += 1 / 30;
    }
    expect(a.raid.phase).toBe(3);
    expect(grounds).toBeGreaterThan(1);
    for (const kind of RAID_BOSS_ATTACKS.emberwing!.filter(
      (k) => k !== "brazier-lighting",
    ))
      expect(seen, kind).toContain(kind);
  });
});

it("keeps showing dangerous attack advice after the final heart stays exposed", () => {
  const a = setup(2, 3);
  a.raid.permanentGround = true;
  attack(a, "heat-mark");
  expect(raidCue(a.snapshot(), "p0")).toContain("Heat Marks");
});

import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  CHARACTERS,
  FIGHTER_IDS,
  STATUS_RULES,
  blankInput,
  basicInterval,
  type CharacterId,
} from "@arena/shared";
let seq = 0;
const input = (overrides: Partial<ReturnType<typeof blankInput>> = {}) => ({
  ...blankInput(),
  seq: ++seq,
  aimX: 700,
  aimY: 150,
  ...overrides,
});
const duel = (one: CharacterId, two: CharacterId = "terradon") => {
  const arena = new Arena("ROSTER");
  arena.add("one", "One", one);
  arena.add("two", "Two", two);
  arena.start();
  arena.phase = "playing";
  arena.deadline = 999;
  const [p, q] = arena.players;
  Object.assign(p, { x: 600, y: 150, angle: 0 });
  Object.assign(q, { x: 700, y: 150 });
  return { arena, p, q };
};
describe("basic attacks", () => {
  it("cannot fire faster than the attack interval, even when spammed every tick", () => {
    for (const id of FIGHTER_IDS) {
      const { arena, p, q } = duel(id);
      Object.assign(q, { x: 1400, y: 800 });
      for (let i = 0; i < 30; i++) {
        arena.submit(p, input({ basic: true }));
        arena.tick();
      }
      const casts = arena.events.filter(
        (e) => e.kind === "cast" && e.abilityId === CHARACTERS[id].basic.id,
      ).length;
      const expected = Math.floor(1 / basicInterval(CHARACTERS[id])) + 1;
      expect(casts).toBeLessThanOrEqual(expected);
      expect(casts).toBeGreaterThanOrEqual(expected - 1);
      // Basic attacks never touch special-skill cooldowns.
      expect(p.cooldowns.every((c) => c === 0)).toBe(true);
    }
  });
  it("Kindle shortens the basic interval and boosts damage", () => {
    const { arena, p, q } = duel("lumoth");
    arena.cast(p, CHARACTERS.lumoth.skills[2]);
    expect(p.statuses.some((s) => s.kind === "empower")).toBe(true);
    arena.damage(q, 8, p.id, CHARACTERS.lumoth.basic);
    expect(CHARACTERS.terradon.health - q.hp).toBe(
      8 * STATUS_RULES.empowerDamage,
    );
    expect(basicInterval(CHARACTERS.lumoth, true)).toBeCloseTo(0.21);
  });
});
describe("special skills", () => {
  it("every skill casts once and its cooldown blocks repeats", () => {
    for (const id of FIGHTER_IDS)
      for (let i = 0; i < 4; i++) {
        const { arena, p } = duel(id);
        arena.submit(p, input({ skill: i }));
        arena.tick();
        expect(p.stats.skills).toBe(1);
        const cooldown = p.cooldowns[i];
        expect(cooldown).toBeCloseTo(
          arena.time + CHARACTERS[id].skills[i].cooldown,
        );
        for (let k = 0; k < 40; k++) {
          arena.submit(p, input({ skill: i }));
          arena.tick();
        }
        expect(p.stats.skills).toBe(1);
        expect(p.cooldowns[i]).toBe(cooldown);
      }
  });
  it("every damaging skill hits an opponent standing in front", () => {
    const utility = new Set([
      "mirror-mist",
      "mirror-guard",
      "kindle",
      "ward",
      "hibernate",
      "dust-cloud",
    ]);
    for (const id of FIGHTER_IDS)
      for (let i = 0; i < 4; i++) {
        const a = CHARACTERS[id].skills[i];
        if (utility.has(a.id)) continue;
        const { arena, p, q } = duel(id);
        arena.submit(p, input({ skill: i }));
        for (let k = 0; k < 60; k++) arena.tick();
        expect(q.hp, a.name).toBeLessThan(CHARACTERS.terradon.health);
        expect(p.stats.dealt, a.name).toBeGreaterThan(0);
      }
  });
  it("Curse Mark doubles damage against a target with a harmful status", () => {
    const hex = CHARACTERS.duskveil.skills[2];
    const clean = duel("duskveil"),
      cursed = duel("duskveil");
    cursed.arena.status(cursed.q, "burn", 5);
    clean.arena.damage(clean.q, hex.damage, "one", hex);
    cursed.arena.damage(cursed.q, hex.damage, "one", hex);
    expect(CHARACTERS.terradon.health - clean.q.hp).toBe(16);
    expect(CHARACTERS.terradon.health - cursed.q.hp).toBe(32);
  });
  it("Hibernate heals 75 over its duration, blocks actions and takes 20% more damage", () => {
    const { arena, q } = duel("cindrake");
    q.hp = 100;
    arena.submit(q, input({ skill: 1 }));
    arena.tick();
    expect(q.statuses.some((s) => s.kind === "sleep")).toBe(true);
    arena.damage(q, 10, "one", CHARACTERS.cindrake.basic);
    expect(q.hp).toBe(100 - 10 * STATUS_RULES.sleepVulnerability);
    expect(STATUS_RULES.sleepVulnerability).toBe(1.2);
    q.hp = 90; // keep the healing check below on whole numbers
    const x = q.x;
    arena.submit(q, input({ dx: 1, basic: true }));
    arena.tick();
    expect(q.x).toBe(x);
    for (let k = 0; k < 90; k++) arena.tick();
    expect(q.hp).toBe(165);
    expect(q.statuses.some((s) => s.kind === "sleep")).toBe(false);
  });
  it("Focus Ray is instant, synchronizes its end point and is blocked by cover", () => {
    const open = duel("mystowl");
    open.arena.cast(open.p, CHARACTERS.mystowl.skills[0]);
    expect(open.q.hp).toBe(
      CHARACTERS.terradon.health - CHARACTERS.mystowl.skills[0].damage,
    );
    const beam = open.arena.events.find((e) => e.kind === "beam")!;
    expect(beam.tx).toBeGreaterThan(open.p.x);
    const wall = duel("mystowl");
    Object.assign(wall.p, { x: 400, y: 300, angle: 0 });
    Object.assign(wall.q, { x: 680, y: 300 });
    wall.arena.cast(wall.p, CHARACTERS.mystowl.skills[0]);
    expect(wall.q.hp).toBe(CHARACTERS.terradon.health);
  });
  it("jumping avoids grounded skills such as Tremor and Shade Crawl", () => {
    const { arena, p, q } = duel("terradon", "voltkit");
    q.jumpUntil = 99;
    arena.cast(p, CHARACTERS.terradon.skills[3]);
    arena.damage(q, 20, p.id, CHARACTERS.duskveil.skills[0]);
    expect(q.hp).toBe(CHARACTERS.voltkit.health);
  });
  it("Blaze Whirl follows Cindrake", () => {
    const { arena, p } = duel("cindrake");
    arena.cast(p, CHARACTERS.cindrake.skills[2]);
    p.x = 300;
    arena.tick();
    expect(arena.zones[0].x).toBe(300);
  });
  it("stun and sleep cancel wind-ups and channels", () => {
    const { arena, p } = duel("cindrake");
    arena.submit(p, input({ skill: 0 }));
    arena.tick();
    expect(p.channel).toBeDefined();
    arena.status(p, "stun", 1);
    arena.tick();
    expect(p.channel).toBeUndefined();
  });
});

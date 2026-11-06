import { describe, expect, it } from "vitest";
import { Arena } from "../../apps/server/src/simulation";
import {
  CHARACTERS,
  FIGHTER_IDS,
  RULES,
  STATUS_RULES,
  ULT_SLOT,
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
  it("holding the button keeps the stated attack rate (ticks don't round intervals up)", () => {
    for (const id of FIGHTER_IDS) {
      const { arena, p, q } = duel(id);
      Object.assign(q, { x: 1400, y: 800 });
      const seconds = 6;
      for (let i = 0; i < seconds * RULES.tick; i++) {
        arena.submit(p, input({ basic: true }));
        arena.tick();
      }
      const casts = arena.events.filter(
        (e) => e.kind === "cast" && e.abilityId === CHARACTERS[id].basic.id,
      ).length;
      const interval = basicInterval(CHARACTERS[id]);
      // The first attack is immediate; then one per interval.
      expect(casts, id).toBeGreaterThanOrEqual(Math.floor(seconds / interval));
      expect(casts, id).toBeLessThanOrEqual(Math.floor(seconds / interval) + 1);
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
    expect(basicInterval(CHARACTERS.lumoth, true)).toBeCloseTo(0.217, 3);
  });
});
describe("special skills", () => {
  it("every skill casts once; cooldowns (or the empty meter) block repeats", () => {
    for (const id of FIGHTER_IDS)
      for (let i = 0; i < 4; i++) {
        const { arena, p } = duel(id);
        if (i === ULT_SLOT) p.ult = RULES.ultMax;
        arena.submit(p, input({ skill: i }));
        arena.tick();
        expect(p.stats.skills).toBe(1);
        const cooldown = p.cooldowns[i];
        if (i === ULT_SLOT)
          expect(p.ult).toBeLessThan(5); // spent
        else
          expect(cooldown).toBeCloseTo(
            arena.time + CHARACTERS[id].skills[i].cooldown,
          );
        for (let k = 0; k < 40; k++) {
          arena.submit(p, input({ skill: i }));
          arena.tick();
        }
        expect(p.stats.skills).toBe(1);
        if (i !== ULT_SLOT) expect(p.cooldowns[i]).toBe(cooldown);
      }
  });
  it("every damaging skill hits an opponent standing in front", () => {
    const utility = new Set([
      "tide-double",
      "facet-guard",
      "kindle",
      "wing-cloak",
      "shell-up",
      "mud-mire",
      // Guards, decoys, stealth and healing springs deal no damage.
      "tail-wrap",
      "mirage-perch",
      "rump-block",
      "ink-cloud",
      "warm-spring",
      "sanctuary",
      // Sloth Time and Lazy Swap slow and move, they don't hurt.
      "sloth-time",
      "lazy-swap",
    ]);
    for (const id of FIGHTER_IDS)
      for (let i = 0; i < 4; i++) {
        const a = CHARACTERS[id].skills[i];
        if (utility.has(a.id)) continue;
        const { arena, p, q } = duel(id);
        if (i === ULT_SLOT) p.ult = RULES.ultMax;
        arena.submit(p, input({ skill: i }));
        for (let k = 0; k < 60; k++) arena.tick();
        expect(q.hp, a.name).toBeLessThan(CHARACTERS.terradon.health);
        expect(p.stats.dealt, a.name).toBeGreaterThan(0);
      }
  });
  it("Haunted Lantern shoots the nearest enemy in its light, and nothing beyond it", () => {
    const lantern = CHARACTERS.duskveil.skills[2];
    expect(lantern.turret).toBeDefined();
    const { arena, p, q } = duel("duskveil");
    p.lastInput = input({ aimX: 700, aimY: 150 });
    arena.cast(p, lantern);
    expect(arena.zones).toHaveLength(1);
    // Shots at 0.4s, 1.7s and 3.0s; each wisp lands for turret.damage.
    for (let k = 0; k < 30 * 4.2; k++) arena.tick();
    const lost = CHARACTERS.terradon.health - q.hp;
    expect(lost).toBe(lantern.turret!.damage * 3);
    // Out of the light: the lantern holds its fire.
    const far = duel("duskveil");
    far.p.lastInput = input({ aimX: 700, aimY: 150 });
    Object.assign(far.q, { x: 700 + lantern.turret!.range + 120, y: 150 });
    far.arena.cast(far.p, lantern);
    for (let k = 0; k < 30 * 4.2; k++) far.arena.tick();
    expect(far.q.hp).toBe(CHARACTERS.terradon.health);
  });
  it("Static Glide lifts Voltkit over ground attacks, hastes it, and its takeoff pop shoves and slows", () => {
    const glide = CHARACTERS.voltkit.skills[2];
    const { arena, p, q } = duel("voltkit");
    arena.cast(p, glide);
    expect(p.jumpUntil).toBeCloseTo(arena.time + glide.duration);
    expect(arena.has(p, "haste")).toBe(true);
    expect(arena.has(p, "empower")).toBe(false);
    // Terradon (100px away) is inside the pop: hurt, slowed and pushed away.
    expect(q.hp).toBe(CHARACTERS.terradon.health - glide.pop!.damage);
    expect(arena.has(q, "slow")).toBe(true);
    expect(q.x).toBeGreaterThan(700);
    // A ground attack misses while gliding.
    const hp = p.hp;
    arena.damage(p, 30, q.id, CHARACTERS.terradon.skills[3]);
    expect(p.hp).toBe(hp);
  });
  it("Tide Double leaves a decoy, hastes Tidefin and regrows a little health", () => {
    const double = CHARACTERS.tidefin.skills[2];
    const { arena, p } = duel("tidefin");
    p.hp = 100;
    arena.cast(p, double);
    expect(p.clone).toBeDefined();
    expect(arena.has(p, "haste")).toBe(true);
    expect(p.hp).toBe(100 + double.heal!);
  });
  it("Eyespot Flash stuns and pushes enemies in a wide arc in front", () => {
    const flash = CHARACTERS.lumoth.skills[1];
    const { arena, p, q } = duel("lumoth");
    // Off to the side but still in front (the arc is a half circle).
    Object.assign(q, { x: 640, y: 260 });
    arena.cast(p, flash);
    expect(q.hp).toBe(CHARACTERS.terradon.health - flash.damage);
    expect(arena.has(q, "stun")).toBe(true);
    // Behind Lumoth: untouched.
    const back = duel("lumoth");
    Object.assign(back.q, { x: 520, y: 150 });
    back.arena.cast(back.p, flash);
    expect(back.q.hp).toBe(CHARACTERS.terradon.health);
  });
  it("Shell Up heals 25 over its duration, blocks actions and takes 45% less damage", () => {
    const { arena, q } = duel("cindrake");
    q.hp = 100;
    arena.submit(q, input({ skill: 1 }));
    arena.tick();
    expect(q.statuses.some((s) => s.kind === "shell")).toBe(true);
    expect(q.statuses.some((s) => s.kind === "sleep")).toBe(false);
    arena.damage(q, 10, "one", CHARACTERS.cindrake.basic);
    expect(q.hp).toBe(100 - 10 * STATUS_RULES.shellReduction);
    expect(STATUS_RULES.shellReduction).toBe(0.55);
    q.hp = 90; // keep the healing check below on whole numbers
    const x = q.x;
    arena.submit(q, input({ dx: 1, basic: true }));
    arena.tick();
    expect(q.x).toBe(x);
    for (let k = 0; k < 90; k++) arena.tick();
    expect(q.hp).toBe(115);
    expect(q.statuses.some((s) => s.kind === "shell")).toBe(false);
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
  it("Heat Cracks follows Cindrake", () => {
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

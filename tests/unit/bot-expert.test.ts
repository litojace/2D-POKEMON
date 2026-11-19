import { describe, expect, it } from "vitest";
import {
  CHARACTERS,
  RULES,
  type CharacterId,
  type Fighter,
  type Input,
} from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import {
  BALANCE_PROFILES,
  BOT_DIFFICULTIES,
  BOT_LABELS,
  BOT_PROFILES,
  BotBrain,
  EXPERT_FLAGS,
  chooseRite,
} from "../../apps/server/src/bot";

/**
 * The expert bot measures balance (scripts/balance) and is never offered to
 * players; each of its behaviours is a piece of counterplay a decent player
 * knows (docs/balance-overhaul.md, "An expert bot for measuring").
 */
function duel(me: CharacterId, foe: CharacterId, mx: number, fx: number) {
  const a = new Arena("expert");
  a.add("A", "A", me);
  a.add("B", "B", foe);
  a.start();
  a.phase = "playing";
  a.deadline = 999;
  a.time = 20;
  Object.assign(a.players[0], { x: mx, y: 840, vx: 0, vy: 0 });
  Object.assign(a.players[1], { x: fx, y: 840, vx: 0, vy: 0 });
  return { a, me: a.players[0], foe: a.players[1] };
}
/** Every skill on cooldown, so only what a test readies can be cast. */
const busy = (p: Fighter, t: number) => {
  p.cooldowns = p.cooldowns.map(() => t + 99);
  p.ult = 0;
};
const think = (a: Arena, level: "hard" | "expert", seed = 5) =>
  new BotBrain("A", level, seed).think(a, a.players[0]);
/** How far (radians) the aim is from the opponent. */
const aimOff = (input: Input, me: Fighter, foe: Fighter) => {
  const to = Math.atan2(foe.y - me.y, foe.x - me.x),
    aim = Math.atan2(input.aimY - me.y, input.aimX - me.x);
  return Math.abs(Math.atan2(Math.sin(aim - to), Math.cos(aim - to)));
};

describe("expert bot", () => {
  it("is never offered to players", () => {
    // Rooms take a BotDifficulty, which the server's schema checks with
    // z.enum(BOT_DIFFICULTIES); the client's pickers use the same three.
    expect([...BOT_DIFFICULTIES]).toEqual(["easy", "normal", "hard"]);
    expect(Object.keys(BOT_PROFILES).sort()).toEqual([
      "easy",
      "hard",
      "normal",
    ]);
    expect(Object.keys(BOT_LABELS).sort()).toEqual(["easy", "hard", "normal"]);
    for (const level of BOT_DIFFICULTIES)
      expect(BOT_PROFILES[level].expert).toBeUndefined();
    // An expert brain reports itself (and picks rites) as Hard.
    const brain = new BotBrain("A", "expert", 1);
    expect(brain.difficulty).toBe("hard");
    expect(brain.profile).toBe(BALANCE_PROFILES.expert);
    const offer = ["kindle-1", "kindle-2"];
    expect(() =>
      chooseRite(
        brain.difficulty,
        offer,
        { character: "lumoth" },
        undefined,
        () => 0.5,
      ),
    ).not.toThrow();
  });

  it("keeps Hard's reactions and aim", () => {
    const { expert, ...rest } = BALANCE_PROFILES.expert;
    expect(rest).toEqual(BOT_PROFILES.hard);
    expect(Object.keys(expert!).sort()).toEqual([...EXPERT_FLAGS].sort());
  });

  it("looks away from a ready Eyespot Flash between attacks", () => {
    const { a, me, foe } = duel("cindrake", "lumoth", 600, 760);
    busy(me, a.time);
    me.basicAt = a.time + 1;
    expect(aimOff(think(a, "expert"), me, foe)).toBeGreaterThan(0.6);
    // Hard stares at it.
    expect(aimOff(think(a, "hard"), me, foe)).toBeLessThan(0.3);
    // It turns back to strike.
    me.basicAt = a.time;
    expect(aimOff(think(a, "expert"), me, foe)).toBeLessThan(0.3);
    // A flash on cooldown is nothing to look away from.
    me.basicAt = a.time + 1;
    foe.cooldowns = foe.cooldowns.map(() => a.time + 5);
    expect(aimOff(think(a, "expert"), me, foe)).toBeLessThan(0.3);
  });

  it("holds fire and backs off while Facet Guard is up", () => {
    const { a, me, foe } = duel("pyranda", "auralynx", 600, 800);
    busy(me, a.time);
    a.status(foe, "counter", 1);
    const input = think(a, "expert");
    expect(input.basic).toBe(false);
    expect(input.dx).toBeLessThan(0);
    expect(think(a, "hard").basic).toBe(true);
    // Once the guard is down it shoots again.
    foe.statuses = [];
    expect(think(a, "expert").basic).toBe(true);
  });

  it("dashes out of a mark it cannot walk out of in time", () => {
    const { a, me, foe } = duel("voltkit", "pyranda", 800, 200);
    busy(me, a.time);
    const mortar = CHARACTERS.pyranda.skills[0];
    expect(mortar.id).toBe("chestnut-mortar");
    const mark = (born: number) =>
      a.zones.push({
        id: 900,
        owner: foe.id,
        x: me.x,
        y: me.y,
        radius: mortar.radius,
        until: a.time + 0.35,
        nextTick: a.time + 0.3,
        ability: mortar,
        color: 0,
        born,
      });
    // Just marked: it hasn't seen it yet.
    mark(a.time);
    expect(think(a, "expert").dash).toBe(false);
    a.zones = [];
    mark(a.time - 0.3);
    const input = think(a, "expert");
    expect(input.dash).toBe(true);
    // Hard walks out (too slowly).
    expect(think(a, "hard").dash).toBe(false);
  });

  it("does not walk onto an enemy seedling in its way", () => {
    const { a, me, foe } = duel("terradon", "mossloth", 600, 1100);
    busy(me, a.time);
    const seed = CHARACTERS.mossloth.skills[0];
    expect(seed.kind).toBe("seedling");
    a.zones.push({
      id: 901,
      owner: foe.id,
      x: me.x + 70,
      y: me.y,
      radius: seed.radius,
      until: a.time + 10,
      nextTick: a.time + 10,
      ability: seed,
      color: 0,
      born: a.time - 3,
    });
    const reach = (seed.seed?.trigger ?? 30) + RULES.radius;
    for (let s = 1; s <= 8; s++) {
      const input = think(a, "expert", s);
      const l = Math.hypot(input.dx, input.dy) || 1,
        ux = input.dx / l,
        uy = input.dy / l;
      const rx = 70,
        along = rx * ux,
        miss = Math.abs(rx * uy);
      // Hops it, or its way passes clear of it.
      expect(input.jump || along <= 0 || miss >= reach).toBe(true);
    }
  });

  it("sets up its combo before the payoff", () => {
    const { a, me } = duel("glacelle", "terradon", 600, 900);
    busy(me, a.time);
    me.cooldowns[0] = me.cooldowns[1] = 0; // Black Ice, Frost Bloom
    const pick = (level: "hard" | "expert") => {
      for (let s = 1; s < 20; s++) {
        const input = think(a, level, s);
        if (input.skill !== undefined && input.skill >= 0) return input.skill;
      }
    };
    expect(pick("expert")).toBe(0);
    expect(pick("hard")).toBe(1);
  });
});

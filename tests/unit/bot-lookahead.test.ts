import { describe, expect, it } from "vitest";
import {
  BOT_PROFILES,
  BotBrain,
  EXPERT_PROFILE,
} from "../../apps/server/src/bot";
import { cloneArena } from "../../apps/server/src/bot-lookahead";
import { Arena } from "../../apps/server/src/simulation";
import type { CharacterId, Input } from "@arena/shared";

/**
 * The expert's look-ahead (apps/server/src/bot-lookahead.ts) plays candidate
 * actions on a copy of the match. The copy must play exactly like the real
 * match, share nothing with it, and the search must leave the real match
 * untouched; and it must use a skill its rules know nothing about.
 */
function match(a: CharacterId, b: CharacterId, code: string, seconds = 40) {
  const arena = new Arena(code);
  arena.add("A", "A", a);
  arena.add("B", "B", b);
  arena.bots.set("A", new BotBrain("A", "hard", 3));
  arena.bots.set("B", new BotBrain("B", "hard", 4));
  arena.start();
  arena.acknowledgeInstructions("A");
  for (let i = 0; i < 30 * seconds && arena.phase !== "finished"; i++)
    arena.tick();
  return arena;
}
/** The same made-up inputs for both fighters, tick by tick. */
function script(arena: Arena, i: number) {
  for (const p of arena.players) {
    const o = arena.players.find((q) => q !== p)!;
    p.lastInput = {
      seq: 0,
      dx: Math.cos(i / 7),
      dy: Math.sin(i / 5),
      aimX: o.x,
      aimY: o.y,
      basic: true,
      skill: i % 37 === 0 ? (i / 37) % 3 : -1,
      dash: i % 50 === 0,
      jump: i % 61 === 0,
    } as Input;
  }
}
const state = (a: Arena) =>
  JSON.stringify([a.time, a.players, a.projectiles, a.zones, a.orbs]);
const expertWith = (flags: object, extra: object = {}) => {
  const brain = new BotBrain("A", "expert", 5);
  Object.assign(brain, {
    profile: {
      ...EXPERT_PROFILE,
      ...extra,
      expert: { ...EXPERT_PROFILE.expert, ...flags },
    },
  });
  return brain;
};

describe("expert look-ahead", () => {
  it("is the expert's alone", () => {
    expect(EXPERT_PROFILE.expert?.lookAhead).toBe(true);
    for (const p of Object.values(BOT_PROFILES))
      expect(p.expert?.lookAhead).toBeFalsy();
  });

  it("plays a copy of the match exactly as the match plays", () => {
    for (const [a, b] of [
      ["pyranda", "cindrake"],
      ["mossloth", "pangrove"],
      ["lumoth", "auralynx"],
      ["shadopus", "voltkit"],
    ] as [CharacterId, CharacterId][]) {
      const real = match(a, b, `copy-${a}`);
      real.bots.clear();
      const copy = cloneArena(real, 99);
      // The same random numbers on both sides, so they can be compared.
      real.random = cloneArena(real, 99).random;
      for (let i = 0; i < 300; i++) {
        script(real, i);
        script(copy, i);
        real.tick();
        copy.tick();
      }
      expect(state(copy)).toBe(state(real));
    }
  });

  it("shares nothing with the match it copies", () => {
    const real = match("glacelle", "terradon", "share");
    const before = state(real);
    const copy = cloneArena(real, 1);
    copy.players[0].hp = 1;
    copy.players[0].statuses.push({ kind: "stun", until: 999 } as never);
    copy.zones.length = 0;
    for (let i = 0; i < 90; i++) copy.tick();
    expect(state(real)).toBe(before);
    expect(copy.bots.size).toBe(0);
  });

  it("leaves the real match untouched while it searches", () => {
    for (const [a, b] of [
      ["voltkit", "pyranda"],
      ["mossloth", "cindrake"],
    ] as [CharacterId, CharacterId][]) {
      // Two identical matches; the expert searches in one of them only (its
      // answers thrown away). They must stay identical, random numbers too.
      const searched = match(a, b, `search-${a}`, 25),
        plain = match(a, b, `search-${a}`, 25);
      searched.bots.clear();
      plain.bots.clear();
      const brain = new BotBrain("A", "expert", 7);
      for (let i = 0; i < 120; i++) {
        const before = state(searched);
        brain.think(searched, searched.players[0]);
        expect(state(searched)).toBe(before);
        script(searched, i);
        script(plain, i);
        searched.tick();
        plain.tick();
      }
      expect(state(searched)).toBe(state(plain));
      expect(searched.random()).toBe(plain.random());
    }
  });

  it("uses a skill its rules know nothing about", () => {
    // Lumoth's Eyespot Flash, as if gaze were a brand-new mechanic.
    const flash = (lookAhead: boolean) => {
      let casts = 0;
      for (let seed = 1; seed <= 6; seed++) {
        const real = new Arena(`unknown-${seed}`);
        real.add("A", "A", "lumoth");
        real.add("B", "B", "cindrake");
        const brain = expertWith({ lookAhead }, { unknownKinds: ["gaze"] });
        real.bots.set("A", brain);
        real.bots.set("B", new BotBrain("B", "hard", seed));
        real.start();
        real.acknowledgeInstructions("A");
        const lumoth = real.players[0];
        const slot = real
          .kit(lumoth)
          .skills.findIndex((k) => k.kind === "gaze");
        // A cast puts the flash on cooldown (the tick clears the input).
        for (let i = 0; i < 30 * 60 && real.phase !== "finished"; i++) {
          const was = lumoth.cooldowns[slot];
          real.tick();
          if (lumoth.cooldowns[slot] > was + 1) casts++;
        }
      }
      return casts;
    };
    expect(flash(false)).toBe(0);
    expect(flash(true)).toBeGreaterThan(0);
  }, 60_000);
});

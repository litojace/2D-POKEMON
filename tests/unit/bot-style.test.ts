import { describe, expect, it } from "vitest";
import { FIGHTER_IDS, type CharacterId } from "@arena/shared";
import {
  BOT_PROFILES,
  BotBrain,
  EXPERT_PROFILE,
  STYLE_KEYS,
} from "../../apps/server/src/bot";
import { EXPERT_STYLE } from "../../apps/server/src/expert-style";
import { Arena } from "../../apps/server/src/simulation";

/**
 * The expert's learned way of playing each champion (EXPERT_STYLE, written
 * by scripts/balance/train-expert.ts). It is the expert's alone, holds only
 * known numbers, and an empty style plays exactly as the rules as written.
 */
function match(a: CharacterId, b: CharacterId, style: object | undefined) {
  const arena = new Arena(`style-${a}`);
  arena.add("A", "A", a);
  arena.add("B", "B", b);
  for (const [id, seed] of [
    ["A", 3],
    ["B", 4],
  ] as const) {
    const brain = new BotBrain(id, "expert", seed);
    Object.assign(brain, {
      profile: {
        ...EXPERT_PROFILE,
        expert: { ...EXPERT_PROFILE.expert!, lookAhead: false },
        style,
      },
    });
    arena.bots.set(id, brain);
  }
  arena.start();
  arena.acknowledgeInstructions("A");
  for (let i = 0; i < 30 * 30 && arena.phase !== "finished"; i++) arena.tick();
  return JSON.stringify([arena.time, arena.players, arena.zones]);
}

describe("expert style", () => {
  it("is the expert's alone", () => {
    expect(EXPERT_PROFILE.style).toBe(EXPERT_STYLE);
    for (const p of Object.values(BOT_PROFILES)) expect(p.style).toBeFalsy();
  });

  it("holds only known champions and numbers", () => {
    for (const [champion, style] of Object.entries(EXPERT_STYLE)) {
      expect(FIGHTER_IDS).toContain(champion);
      for (const [key, value] of Object.entries(style!)) {
        expect([...STYLE_KEYS, "slots"], key).toContain(key);
        const values = Array.isArray(value) ? value : [value];
        for (const v of values) expect(Number.isFinite(v), key).toBe(true);
      }
    }
  });

  it("plays exactly as the rules when a champion has no style", () => {
    for (const [a, b] of [
      ["pyranda", "terradon"],
      ["shadopus", "lumoth"],
    ] as [CharacterId, CharacterId][])
      expect(match(a, b, {})).toBe(match(a, b, undefined));
  });

  it("changes how a champion with a style plays", () => {
    const style = { shadopus: { reach: 120, slots: [2, 0.5, 1, 1] } };
    expect(match("shadopus", "lumoth", style)).not.toBe(
      match("shadopus", "lumoth", undefined),
    );
  });
});

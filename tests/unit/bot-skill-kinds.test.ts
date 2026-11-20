import { describe, expect, it } from "vitest";
import { BOT_SKILL_KINDS } from "../../apps/server/src/bot";
import { CHARACTERS, RITES, kitOf, type CharacterId } from "@arena/shared";

// A skill whose kind has no `case` in BotBrain.chooseSkill scores 0, so bots
// never cast it: bot matches and balance round robins quietly under-rate
// that champion.
const unhandled = (
  character: CharacterId,
  rites: readonly string[] = [],
  only?: string,
) =>
  kitOf(character, rites)
    .skills.filter(
      (a) =>
        (only === undefined || a.id === only) && !BOT_SKILL_KINDS.has(a.kind),
    )
    .map(
      (a) =>
        `${character}${rites.length ? ` (rite ${rites.join(", ")})` : ""}: ` +
        `skill "${a.id}" has kind "${a.kind}", which the bot never casts. ` +
        `Add a case for "${a.kind}" to chooseSkill in apps/server/src/bot.ts ` +
        `(and to BOT_SKILL_KINDS beside it).`,
    );

describe("bot skill kinds", () => {
  const ids = Object.keys(CHARACTERS) as CharacterId[];

  it("covers every champion's skills", () => {
    expect(ids.length).toBeGreaterThan(0);
    expect(ids.flatMap((id) => unhandled(id))).toEqual([]);
  });

  it("covers every skill a rite changes (a rite can change its kind)", () => {
    expect(RITES.length).toBeGreaterThan(0);
    // Only the skill each rite changes (a rite on the basic attack has none).
    expect(RITES.flatMap((r) => unhandled(r.fighter, [r.id], r.skill))).toEqual(
      [],
    );
  });
});

import { expect, it } from "vitest";
import {
  CHARACTERS,
  POKEMON_MOVES,
  inputSchema,
  blankInput,
} from "@arena/shared";
import { Arena } from "../../apps/server/src/simulation";
import { mobileLayout } from "../../apps/client/src/mobile-input";
it("maps each reference move to basic, 1, 2 and R with no fourth active slot", () => {
  for (const [id, row] of Object.entries(POKEMON_MOVES)) {
    const c = CHARACTERS[id as keyof typeof CHARACTERS];
    expect(c.name).toBe(row[0]);
    expect([c.basic.name, ...c.skills.map((a) => a.name)]).toEqual(
      row.slice(2),
    );
    expect(c.skills).toHaveLength(3);
  }
  expect(inputSchema.safeParse({ ...blankInput(), skill: 3 }).success).toBe(
    false,
  );
  expect(inputSchema.safeParse({ ...blankInput(), skill: 2 }).success).toBe(
    true,
  );
  expect(
    mobileLayout(700, 320)
      .targets.map((t) => t.action)
      .sort(),
  ).toEqual(["0", "1", "2", "attack", "dash", "jump"]);
});
it("Healing Wish restores health only to the caster and respects maximum health and cooldown", () => {
  const a = new Arena("HEAL");
  a.add("one", "One", "duskveil");
  a.add("two", "Two");
  a.start();
  a.phase = "playing";
  a.deadline = 180;
  const p = a.players[0],
    q = a.players[1];
  p.hp = 20;
  a.submit(p, { ...blankInput(), seq: 1, skill: 2 });
  for (let i = 0; i < 25; i++) a.tick();
  expect(p.hp).toBe(55);
  expect(q.hp).toBe(110);
  expect(p.cooldowns).toHaveLength(3);
  a.submit(p, { ...blankInput(), seq: 2, skill: 2 });
  a.tick();
  expect(p.hp).toBe(55);
  p.hp = 110;
  a.cast(p, CHARACTERS.duskveil.skills[2]);
  expect(p.hp).toBe(120);
});

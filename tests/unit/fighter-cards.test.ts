import { expect, it } from "vitest";
import { CHARACTERS, FIGHTER_IDS } from "@arena/shared";
import {
  attackRange,
  fighterSelection,
} from "../../apps/client/src/fighter-selection";
it("labels every card by attack range instead of the basic attack", () => {
  const close = FIGHTER_IDS.filter((id) => attackRange(id) === "close");
  expect(close.sort()).toEqual(["auralynx", "cindrake", "terradon"]);
  const html = fighterSelection("voltkit");
  expect(html.match(/class="range-tag /g)).toHaveLength(8);
  expect(html.match(/Long range/g)).toHaveLength(5);
  expect(html.match(/Close range/g)).toHaveLength(3);
  expect(html).not.toContain("card-basic");
  // The basic attack is still described in the detail panel.
  expect(html).toContain(CHARACTERS.voltkit.basic.description);
});
it("keeps basic-attack knockback light so brawlers can close in and chain hits", () => {
  for (const id of FIGHTER_IDS) {
    const b = CHARACTERS[id].basic;
    expect(b.knockback, id).toBeLessThanOrEqual(b.kind === "melee" ? 25 : 20);
  }
});

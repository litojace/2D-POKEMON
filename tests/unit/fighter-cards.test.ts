import { expect, it } from "vitest";
import { CHARACTERS, FIGHTER_IDS } from "@arena/shared";
import { attackRange } from "../../apps/client/src/fighter-selection";
import { rosterDetail, rosterGrid } from "./roster-markup";
it("labels every card by attack range instead of the basic attack", () => {
  const close = FIGHTER_IDS.filter((id) => attackRange(id) === "close");
  expect(close.sort()).toEqual([
    "astrabun",
    "auralynx",
    "cindrake",
    "coilemur",
    "shadopus",
    "terradon",
    "wombolder",
  ]);
  // The roster's cards (the one fighter picker since UI remodel step 5).
  const html = rosterGrid("voltkit");
  expect(html.match(/class="ui-tag roster-range"/g)).toHaveLength(16);
  expect(html.match(/roster-range">Ranged</g)).toHaveLength(9);
  expect(html.match(/roster-range">Close</g)).toHaveLength(7);
  expect(html).not.toContain("card-basic");
  // The basic attack is still described in the fighter's detail.
  expect(rosterDetail("voltkit", { tab: "overview" })).toContain(
    CHARACTERS.voltkit.basic.description,
  );
});
it("keeps basic-attack knockback light so brawlers can close in and chain hits", () => {
  for (const id of FIGHTER_IDS) {
    const b = CHARACTERS[id].basic;
    expect(b.knockback, id).toBeLessThanOrEqual(b.kind === "melee" ? 25 : 20);
  }
});
it("opens every fighter's stats and skills from its card", () => {
  for (const id of FIGHTER_IDS) {
    // The picked card opens its detail (second tap, Enter or Details).
    const grid = rosterGrid(id);
    expect(grid).toContain(`data-roster-details="${id}"`);
    expect(grid).toMatch(
      new RegExp(`data-roster-card="${id}" aria-pressed="true"`),
    );
    const detail = rosterDetail(id, { tab: "skills" });
    expect(detail).toContain('data-roster-mode="detail"');
    expect(detail).toContain(`data-preview-champion="${id}"`);
    for (const skill of CHARACTERS[id].skills)
      expect(detail).toContain(skill.name);
  }
});

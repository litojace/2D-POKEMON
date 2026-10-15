import { expect, it } from "vitest";
import { RaidArena } from "../../apps/server/src/raid";
import { raidBestiary, raidLobby } from "../../apps/client/src/raid-ui";

it("uses the local pending champion for its party avatar while keeping teammates unchanged", () => {
  const a = new RaidArena("TEST");
  a.add("me", "Player", "voltkit");
  a.add("peer", "Teammate", "cindrake");
  a.start();
  const html = raidLobby(a.snapshot(), "me", "tidefin");
  const mine = html
    .split('data-raid-player="me"')[1]
    .split('data-raid-player="peer"')[0];
  expect(mine).toContain('aria-label="Tidefin"');
  expect(mine).toContain('class="raid-player-character">Tidefin');
  expect(html.split('data-raid-player="peer"')[1]).toContain(
    'aria-label="Cindrake"',
  );
  expect(a.heroes()[0].character).toBe("voltkit");
});
it("marks earned rewards completed and keeps unearned cosmetics visibly locked", () => {
  const html = raidBestiary({
    clears: 1,
    highestPeril: 1,
    bestSeconds: 60,
    titles: ["Cragbreaker"],
    cosmetics: [],
    weekly: [],
    equipped: null,
  });
  expect(html.match(/class="raid-reward is-complete"/g)).toHaveLength(1);
  expect(html).toContain("Completed");
  expect(html).toContain("Unlock with 5 raid clears");
  expect(html).toMatch(/data-raid-cosmetic="cragbound" disabled/);
});
it("distinguishes an equipped cosmetic from another unlocked option", () => {
  const html = raidBestiary({
    clears: 5,
    highestPeril: 3,
    bestSeconds: 60,
    titles: [],
    cosmetics: ["cragbound", "mountain-aura"],
    weekly: [],
    equipped: "cragbound",
  });
  expect(html.match(/class="raid-reward is-complete"/g)).toHaveLength(4);
  expect(html).toMatch(/is-equipped" data-raid-cosmetic="cragbound" disabled/);
  expect(html).toMatch(/data-raid-cosmetic="mountain-aura" >/);
  expect(html).toContain("Equip cosmetic");
});

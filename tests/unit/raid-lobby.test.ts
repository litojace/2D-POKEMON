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
  expect(html.match(/class="raid-goal is-complete"/g)).toHaveLength(1);
  expect(html).toContain("Unlock: 5 raid clears");
  expect(html).toContain("1/5 clears");
  expect(html).toMatch(/data-raid-item="cragbound" data-raid-cosmetic="cragbound" disabled/);
  // Before migration 008 the lifetime titles say when they start counting.
  expect(html).toContain("Counts from the next raid update");
});
it("equips one item per slot and shows exact title progress", () => {
  const html = raidBestiary(
    {
      clears: 10,
      highestPeril: 3,
      bestSeconds: 60,
      titles: [],
      cosmetics: ["cragbound", "cragstone", "mountain-aura", "mountainborn", "conqueror"],
      weekly: [],
      loadout: { skin: "cragstone", frame: "conqueror" },
      pillars: 7,
      revives: 25,
      runs: 14,
    },
    "tidefin",
  );
  expect(html).toMatch(/is-equipped" data-raid-slot="skin" data-raid-item="cragstone"/);
  expect(html).toMatch(/is-equipped" data-raid-slot="frame" data-raid-item="conqueror"/);
  // The aura slot is empty, so its "None" option is the equipped one.
  expect(html).toMatch(/is-equipped" data-raid-slot="aura" data-raid-item=""/);
  expect(html).toContain("7/25 pillars baited");
  expect(html).toContain("20/20 revives");
  expect(html).toContain("Previewing Tidefin");
  expect(html).not.toContain('aria-label="Voltkit"');
});

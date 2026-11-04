import { expect, it } from "vitest";
import { RaidArena } from "../../apps/server/src/raid";
import { raidLobby } from "../../apps/client/src/raid-ui";
// The boss pages' rewards moved to tests/unit/raid-hall.test.ts (step 5).

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

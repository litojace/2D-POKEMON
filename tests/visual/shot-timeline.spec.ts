import { expect, test } from "@playwright/test";
import { CHARACTERS } from "../../packages/shared/src/index";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";

/**
 * Shots are drawn on your timeline (apps/client/src/networking/timeline-lead.ts):
 * past the last snapshot by the inputs the server has not answered, moving
 * smoothly between snapshots, an opponent's easing in from its snapshot.
 * Before, every shot sat where the last snapshot had it, so it moved in
 * 15 Hz steps and was drawn a round trip behind where it hit you.
 */
test("shots run on from their snapshot to where the server will have them", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = await response.text();
    const hook =
      "const drawn = leadProjectile(pr, seconds, walls, slow);";
    expect(body).toContain(hook);
    await route.fulfill({
      response,
      body: body.replace(
        hook,
        `${hook} window.__drawnShots?.push([drawn.id, drawn.x, drawn.y]);`,
      ),
    });
  });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", {
      mode: "duel",
      phase: "playing",
      pos: [150, 120, 800, 560],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  const speed = 300;
  const drawn = await page.evaluate(
    async ({ abilityId, speed }) => {
      const w = window as any;
      const shot = (id: number, owner: string, y: number) => ({
        id,
        owner,
        x: 200,
        y,
        vx: speed,
        vy: 0,
        remaining: 5000,
        // Snapshots travel packed: the client rebuilds the ability from its id.
        abilityId,
        color: 0xffd23f,
      });
      // Mid-court lanes with no cover on the classic court's rows.
      w.__snap.projectiles = [shot(950, "me", 60), shot(951, "p2", 640)];
      w.__drawnShots = [];
      w.__push();
      // No snapshot follows: the shots run on by themselves.
      await new Promise((r) => setTimeout(r, 2500));
      const seen = w.__drawnShots as [number, number, number][];
      w.__drawnShots = undefined;
      return seen;
    },
    { abilityId: CHARACTERS.voltkit.basic.id, speed },
  );
  const mine = drawn.filter(([id]) => id === 950).map(([, x]) => x);
  const theirs = drawn.filter(([id]) => id === 951).map(([, x]) => x);
  expect(mine.length).toBeGreaterThan(2);
  expect(theirs.length).toBeGreaterThan(2);
  // Past the snapshot, and never past the 0.3 s cap (a stall, not latency).
  const cap = 200 + speed * 0.3 + 0.01;
  for (const x of [...mine, ...theirs]) {
    expect(x).toBeGreaterThanOrEqual(200);
    expect(x).toBeLessThanOrEqual(cap);
  }
  expect(Math.max(...mine)).toBeGreaterThan(200 + speed * 0.25);
  expect(Math.max(...theirs)).toBeGreaterThan(200 + speed * 0.25);
  // They move forward frame by frame, never back.
  for (const xs of [mine, theirs])
    for (let i = 1; i < xs.length; i++)
      expect(xs[i]).toBeGreaterThanOrEqual(xs[i - 1] - 1e-6);
  // Yours is on your timeline at once; an opponent's eases in after it.
  expect(theirs[0]).toBeLessThanOrEqual(mine[0] + 1e-6);
  expect(errors).toEqual([]);
});

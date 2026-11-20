import { expect, test, type Page } from "@playwright/test";
import { createRoom, openLobby, openPlayPanel } from "./helpers";

// Between rounds nobody moves: the countdown before a round shows each
// fighter's greeting, never a run on the spot (owner, 20 Nov 2026: your
// champion kept running through the countdown). Two ways it did:
// - your own inputs from the moment the round ended: the server drops
//   inputs outside play without answering them, and the phone replayed
//   them on your fighter at every snapshot;
// - a velocity the server left in the snapshot (it stops a round's
//   movement, it doesn't clear it), drawn as a run.
const MARKER =
  "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";

async function exposeGame(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    expect(body).toContain(MARKER);
    await route.fulfill({
      response,
      body: body.replace(MARKER, "window.__g=gameInstance;" + MARKER),
    });
  });
}
/** Each fighter's animation state on the court ("me:wave p2:run"). */
const poses = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as any).__g?.scene.scenes.find((s: any) => s.rigs);
    if (!scene) return "";
    return [...scene.rigs]
      .map(
        ([id, v]: [string, any]) => `${id}:${(v.rig ?? v).controller?.state}`,
      )
      .sort()
      .join(" ");
  });
const push = (page: Page) => page.evaluate(() => (window as any).__push());

test("the countdown before a round shows greetings, not a run on the spot", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await exposeGame(page);
  const errors = await openLobby(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", { mode: "duel", phase: "briefing" }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  await expect
    .poll(async () => {
      await push(page);
      return poses(page);
    })
    .toBe("me:idle p2:idle");

  // A round under way: you run right (the harness never answers inputs,
  // as the server doesn't once the round has ended), the opponent runs.
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "playing";
    const p2 = w.__snap.players.find((p: any) => p.id === "p2");
    p2.vx = 220;
    w.__push();
  });
  await page.mouse.click(400, 300);
  await page.keyboard.down("KeyD");
  await expect
    .poll(async () => {
      await push(page);
      return poses(page);
    })
    .toBe("me:run p2:run");

  // The round ends mid-run: the next countdown starts with p2's velocity
  // still in the snapshot, and your last inputs unanswered.
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "countdown";
    w.__snap.remaining = 3;
    w.__push();
  });
  await page.keyboard.up("KeyD");
  for (let i = 0; i < 4; i++) {
    await push(page);
    await page.waitForTimeout(300);
    expect(await poses(page)).toBe("me:wave p2:wave");
  }
  expect(errors).toEqual([]);
});

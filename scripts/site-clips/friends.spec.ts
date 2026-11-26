/**
 * The website's Friends picture (docs/website.md): the game's own Friends
 * list beside the Lobby, at two device pixels, with a few friends online
 * (one in the Lobby, one in a match, one in the Plaza, one in a room to join).
 * Writes site-clips/scenes/friends.png; apps/site/tools/make-scenes.py crops it.
 */
import { expect, test } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { openLobby } from "../../tests/visual/helpers";

const NOW = Date.parse("2026-11-06T18:00:00Z");
const id = (n: number) =>
  `44444444-4444-4444-8444-${String(n).padStart(12, "0")}`;
const FRIENDS = {
  code: "a1b2c3d4",
  friends: [
    {
      id: id(1),
      name: "Kai",
      online: true,
      activity: "menu",
      fighter: "cindrake",
    },
    {
      id: id(2),
      name: "Mina",
      online: true,
      activity: "match",
      room: "ABCD12",
      fighter: "lumoth",
    },
    {
      id: id(3),
      name: "Rae",
      online: true,
      activity: "town",
      fighter: "tidefin",
      frame: "galaxy-frame",
      look: { frame: "galaxy-frame" },
    },
    {
      id: id(4),
      name: "Juno",
      online: true,
      activity: "lobby",
      room: "ROOM77",
      joinable: true,
      fighter: "voltkit",
    },
  ],
  incoming: [],
  outgoing: [],
};

test("friends", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(
      ({ friends, now }) => {
        const w = window as any;
        w.__friends = friends;
        w.__recent = { players: [] };
        w.__serverTime = now;
      },
      { friends: FRIENDS, now: NOW },
    );
    await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="friends"]');
    const sheet = page.locator(".friends-sheet");
    await expect(sheet.locator(".fr-row")).toHaveCount(4);
    await page.waitForTimeout(1200);
    mkdirSync("site-clips/scenes", { recursive: true });
    await sheet.screenshot({ path: "site-clips/scenes/friends.png" });
  } finally {
    await context.close();
  }
});

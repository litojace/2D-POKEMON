import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, createRoom } from "./helpers";

// In the menus and in a room, the fighters' rig layers are rasterized ahead
// (fighter-prepaint.ts), so the battle hands them to WebGL instead of
// loading 64 SVG files per fighter behind the loading screen. A rematch
// reuses them, and a fighter nobody wants any more is dropped. In a PvP
// room another side's pick is hidden until the match starts
// (docs/hidden-picks.md): it is loaded at the briefing, whose "I'm ready"
// waits for it, so nothing loads mid-fight.

/** Each battle's queued loader files and its rig textures, at create. */
async function routeMain(page: Page) {
  const queued = "() => this.fighters.settled());";
  const created = "battleLoadMarks.create ||= performance.now();";
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    expect(body).toContain(queued);
    expect(body).toContain(created);
    await route.fulfill({
      response,
      body: body
        .replace(
          queued,
          queued +
            " (window.__queued ||= []).push(this.load.list.entries.map((f) => f.key));",
        )
        .replace(
          created,
          created +
            " { const rig = this.textures.getTextureKeys().filter((k) => k.startsWith('rig-')); (window.__created ||= []).push({ rig: rig.length, canvas: rig.filter((k) => this.textures.get(k).source[0].image instanceof HTMLCanvasElement).length }); }",
        ),
    });
  });
}

/** The page's own fighter-prepaint.ts module (served from /@fs/…). */
async function prepaintModule(page: Page) {
  const url = await page.evaluate(() =>
    performance
      .getEntriesByType("resource")
      .map((e) => e.name)
      .find((n) => n.includes("/apps/client/src/fighter-prepaint.ts"))!,
  );
  expect(url).toBeTruthy();
  return () =>
    page.evaluate(async (url) => {
      const m = await import(url);
      return m.prepaintedLayerKeys() as string[];
    }, url);
}

const base = (keys: string[], id: string) =>
  keys.filter((k) => k.startsWith(`rig-${id}-`) && !k.includes("~")).length;

/** Push snapshots until every layer of these fighters is painted. */
async function untilPainted(
  page: Page,
  held: () => Promise<string[]>,
  ids: string[],
) {
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        const keys = await held();
        return ids.map((id) => base(keys, id));
      },
      { timeout: 90_000, intervals: [500] },
    )
    .toEqual(ids.map(() => 64));
}

async function battle(page: Page, n: number) {
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "briefing";
    w.__push();
  });
  await expect
    .poll(
      async () => {
        await page.evaluate(() => (window as any).__push());
        return page.evaluate(() => ((window as any).__created ?? []).length);
      },
      { timeout: 60_000, intervals: [300] },
    )
    .toBe(n);
  return page.evaluate((n) => {
    const w = window as any;
    return {
      queued: (w.__queued[n - 1] as string[]).filter((k) =>
        k.startsWith("rig-"),
      ),
      created: w.__created[n - 1] as { rig: number; canvas: number },
    };
  }, n);
}

async function backToRoom(page: Page) {
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.phase = "lobby";
    w.__push();
  });
  await expect(page.locator("#battle")).toBeHidden();
}

test("the room rasterizes the fighters it may see ahead; the briefing loads the hidden one", async ({
  page,
}) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await routeMain(page);
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", { mode: "duel", phase: "lobby" }),
  );
  await openPlayPanel(page);
  await createRoom(page);
  const held = await prepaintModule(page);
  // Yours is painted ahead; your opponent's pick isn't known yet.
  await untilPainted(page, held, ["voltkit"]);
  expect(base(await held(), "cindrake")).toBe(0);

  const first = await battle(page, 1);
  // Only the hidden pick's layers were queued for the loader (at the
  // briefing); yours is a painted canvas.
  const theirs = (keys: string[]) =>
    keys.length >= 64 && keys.every((k) => k.startsWith("rig-cindrake-"));
  expect(theirs(first.queued)).toBe(true);
  expect(first.created.rig).toBeGreaterThanOrEqual(128);
  expect(first.created.canvas).toBe(first.created.rig - first.queued.length);

  // Back in the room: your canvases serve the next battle, nothing of yours
  // is repainted.
  await backToRoom(page);
  const kept = await held();
  expect(base(kept, "voltkit")).toBe(64);
  expect(base(kept, "cindrake")).toBe(0);
  const second = await battle(page, 2);
  expect(theirs(second.queued)).toBe(true);
  expect(second.created.canvas).toBe(second.created.rig - second.queued.length);

  // Picking another fighter in the room: the one nobody uses is dropped.
  await backToRoom(page);
  await page.evaluate(() => {
    const w = window as any;
    w.__snap.players.find((p: any) => p.id === "me").character = "tidefin";
    w.__push();
  });
  await page.evaluate(() => (window as any).__push());
  await untilPainted(page, held, ["tidefin"]);
  expect(base(await held(), "voltkit")).toBe(0);
  expect(base(await held(), "cindrake")).toBe(0);
  expect(errors).toEqual([]);
});

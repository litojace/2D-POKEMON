import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  createRoom,
  pushUntilBattle,
  snap,
} from "./helpers";

/**
 * Snapshots as changes in the real app (networking/snapshot-stream.ts;
 * docs/network-performance.md section 21). The harness sends the room as
 * the server does with deltas on: one whole numbered snapshot, then only
 * what changed. The game must be handed exactly the snapshots it would have
 * parsed whole, show them, and recover from a delta that never arrives
 * without showing anything else.
 */

/** Record every snapshot the game is handed, as text. */
async function tapSnapshots(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker = /followSnapshots\(socket, \(snapshot\) => \{/;
    expect(body).toMatch(marker);
    await route.fulfill({
      response,
      body: body.replace(
        marker,
        (found) =>
          `${found} if (snapshot.n !== undefined) (window.__got ??= []).push(JSON.stringify(snapshot));`,
      ),
    });
  });
}
/** A free-for-all in play, stepped by the spec. */
async function fight(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__delta = true;
    w.__deltaLog = new Map<number, string>();
  });
  await tapSnapshots(page);
  const errors = await openHub(page);
  await page.evaluate(async () => {
    const w = window as any;
    w.__room("pvp", { mode: "ffa", phase: "playing" });
    const m = await import("/rooms.ts");
    const a = new m.Arena("PVP123", "ffa");
    ["voltkit", "tidefin", "cindrake", "lumoth"].forEach((c, i) =>
      a.add(i ? `p${i + 1}` : "me", `Player ${i + 1}`, c),
    );
    a.players.forEach((p: any, i: number) => m.dressUp(p, i));
    a.start();
    a.phase = "playing";
    a.deadline = a.time + 150;
    w.__arena = a;
    w.__pack = () => m.packSnapshot(a.snapshot());
    w.__snap = w.__pack();
    /** `ticks` of a fight where everyone runs, shoots and casts. */
    w.__play = (ticks: number) => {
      for (let i = 0; i < ticks; i++) {
        const t = (w.__tick = (w.__tick ?? 0) + 1);
        a.players.forEach((p: any, seat: number) => {
          p.hp = Math.max(p.hp, 40);
          a.submit(p, {
            ...m.blankInput(),
            seq: p.ack + 1,
            dx: Math.cos(t / 15 + seat),
            dy: Math.sin(t / 15 + seat),
            aimX: 800,
            aimY: 450,
            basic: true,
            skill: t % 40 === seat * 7 ? seat % 4 : -1,
          });
        });
        a.tick();
        w.__snap = w.__pack();
        w.__push();
      }
    };
  });
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  return errors;
}
/** What the game was handed against what the harness numbered. */
const compare = (page: Page) =>
  page.evaluate(() => {
    const w = window as any;
    const canon = (v: unknown): unknown =>
      Array.isArray(v)
        ? v.map(canon)
        : v && typeof v === "object"
          ? Object.fromEntries(
              Object.keys(v as object)
                .sort()
                .map((k) => [k, canon((v as Record<string, unknown>)[k])]),
            )
          : v;
    const text = (json: string) => JSON.stringify(canon(JSON.parse(json)));
    const got = (w.__got as string[]).map((json) => ({
      n: JSON.parse(json).n as number,
      json,
    }));
    return {
      got: got.length,
      numbers: got.map((g) => g.n),
      wrong: got.filter((g) => text(g.json) !== text(w.__deltaLog.get(g.n)))
        .length,
      sent: w.__deltaSent as number,
      asked: (w.__deltaAsked ?? 0) as number,
      last: w.__deltaLog.size as number,
      events: got.reduce((n, g) => n + JSON.parse(g.json).events.length, 0),
    };
  });

test.use({ viewport: { width: 844, height: 390 }, hasTouch: true });

test("a match sent as changes is the match the game shows", async ({
  page,
}, info) => {
  const errors = await fight(page);
  const before = await compare(page);
  await page.evaluate(() => (window as any).__play(150));
  const after = await compare(page);
  // One whole snapshot opened the room; everything since came as changes.
  expect(after.sent - before.sent).toBe(150);
  expect(after.asked).toBe(0);
  // The game got every one of them, in order, each exactly the snapshot
  // the server made.
  expect(after.got).toBe(after.last);
  expect(after.numbers).toEqual(after.numbers.map((_, i) => i + 1));
  expect(after.wrong).toBe(0);
  expect(after.events).toBeGreaterThan(10);
  // And it is on screen: the clock reads the last snapshot's time.
  const remaining = await page.evaluate(() => {
    const a = (window as any).__arena;
    return Math.max(0, Math.ceil(a.deadline - a.time));
  });
  const clock = `${String(Math.floor(remaining / 60)).padStart(2, "0")}:${String(remaining % 60).padStart(2, "0")}`;
  await expect(page.locator("#timer")).toHaveText(clock);
  await expect(page.locator("body")).toHaveClass(/battle-active/);
  await snap(page, info, "snapshot-delta-match");
  expect(errors).toEqual([]);
});

test("a delta that never arrives: nothing else is shown until the whole snapshot comes", async ({
  page,
}) => {
  const errors = await fight(page);
  await page.evaluate(() => (window as any).__play(10));
  const before = await compare(page);
  // One delta is lost; the three after it cannot be applied.
  await page.evaluate(() => {
    const w = window as any;
    w.__deltaLose = 1;
    // The harness answers a request on its next push: hold that back to
    // see the client wait.
    w.__holdWhole = true;
    const push = w.__push;
    w.__push = () => {
      if (w.__holdWhole) w.__deltaWhole = false;
      push();
    };
    w.__play(4);
  });
  const waiting = await compare(page);
  expect(waiting.got).toBe(before.got);
  // It asked once (not once per refused delta).
  expect(waiting.asked).toBe(1);
  // The whole snapshot arrives, then changes again.
  await page.evaluate(() => {
    const w = window as any;
    w.__holdWhole = false;
    w.__deltaWhole = true;
    w.__play(20);
  });
  const after = await compare(page);
  expect(after.got).toBe(before.got + 20);
  expect(after.wrong).toBe(0);
  expect(after.asked).toBe(1);
  expect(after.numbers.at(-1)).toBe(after.last);
  expect(errors).toEqual([]);
});

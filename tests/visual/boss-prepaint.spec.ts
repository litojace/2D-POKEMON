import { expect, test } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";

// While the player waits in a raid room, the boss's atlas is painted ahead
// (boss-prepaint.ts), so the battle doesn't paint it behind the loading
// screen. The battle takes it (nothing painted stays after), and leaving
// raids drops it.
for (const boss of ["tidewyrm", "emberwing"])
  test(`the raid room paints ${boss}'s atlas ahead and the battle takes it`, async ({
    page,
  }) => {
    test.setTimeout(180_000);
    const errors = await openHub(page);
    await page.evaluate(async (boss) => {
      const w = window as any;
      w.__room("raid", { boss });
      const m = await import("/rooms.ts");
      const a = m.createRaidArena("RAID42", boss);
      ["voltkit", "cindrake"].forEach((c, i) =>
        a.add(i ? `p${i + 1}` : "me", `Player ${i + 1}`, c),
      );
      a.start();
      w.__snap = m.packSnapshot(a.snapshot());
    }, boss);
    await openPlayPanel(page);
    await page.click("#play-create");
    // The same module instances the client uses: import the very URLs the
    // page loaded them from (served from /@fs/<the checkout>/…).
    const client = (file: string) =>
      page.evaluate(
        (file) =>
          performance
            .getEntriesByType("resource")
            .map((e) => e.name)
            .find((n) => n.includes(`/apps/client/src/${file}`))!,
        file,
      );
    const prepaintUrl = await client("boss-prepaint.ts");
    const prewarmUrl = await client("boss-vector-prewarm.ts");
    expect(prepaintUrl).toBeTruthy();
    expect(prewarmUrl).toBeTruthy();
    const held = () =>
      page.evaluate(async (url) => {
        const m = await import(url);
        return m.prepaintedKeys() as string[];
      }, prepaintUrl);
    // The raid room: the lobby phase while players wait.
    const start = await page.evaluate(() => {
      const w = window as any,
        phase = w.__snap.phase;
      w.__snap.phase = "lobby";
      w.__push();
      return phase;
    });
    await expect
      .poll(
        async () => {
          await page.evaluate(() => (window as any).__push());
          return held();
        },
        { timeout: 30_000, intervals: [300] },
      )
      .toEqual([boss === "tidewyrm" ? "tidewyrm:1" : boss]);
    // The match starts: the battle takes the atlas painted ahead.
    await page.evaluate((phase) => {
      (window as any).__snap.phase = phase;
    }, start);
    await pushUntilBattle(page);
    expect(await held()).toEqual([]);
    // Back in the room, then out of raids: painted again, then dropped.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.phase = "lobby";
      w.__push();
    });
    await expect
      .poll(
        async () => {
          await page.evaluate(() => (window as any).__push());
          return (await held()).length;
        },
        { timeout: 30_000, intervals: [300] },
      )
      .toBe(1);
    await page.evaluate(async (url) => {
      const m = await import(url);
      m.syncBossPrepaint(undefined);
    }, prewarmUrl);
    expect(await held()).toEqual([]);
    expect(errors).toEqual([]);
  });

import { expect, test, type Page } from "@playwright/test";
import {
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
  pickRoomMode,
  createRoom,
} from "./helpers";

/**
 * Quick chat in a battle (chat/battle-chat.ts, docs/chat-plan.md): the
 * button top left, clear of the controls and the camera cutout; its grid
 * sends calls; teammates' lines pop over their nameplate and in the feed;
 * a rival's phrase never shows, a rival's emote does until "Mute others";
 * in a raid the grid carries the raid's signals (the old signals button is
 * gone).
 */
const PHONES = [
  { name: "844x390", width: 844, height: 390, inset: 47, cutout: 210 },
  { name: "852x393-island", width: 852, height: 393, inset: 59, cutout: 126 },
];

async function battle(page: Page, kind: "pvp" | "raid") {
  const errors = await openHub(page);
  await page.evaluate((kind) => {
    const w = window as any;
    if (kind === "pvp") w.__room("pvp", { mode: "teams", phase: "playing" });
    else w.__room("raid");
    w.__sent = [];
    const before = w.__emit;
    w.__emit = (ev: string, data: unknown) => {
      if (ev === "chat-send" || ev === "raid-ping") w.__sent.push([ev, data]);
      before?.(ev, data);
    };
  }, kind);
  if (kind === "pvp") {
    await openPlayPanel(page);
    await pickRoomMode(page, "teams");
  } else {
    await page.evaluate(() => ((window as any).__snap.raid.partySize = 2));
    await openPlayPanel(page);
  }
  await createRoom(page);
  await pushUntilBattle(page);
  return errors;
}
const line = (
  page: Page,
  fighter: string,
  name: string,
  quick: string,
  id: number,
) =>
  page.evaluate(
    ([fighter, name, quick, id]) =>
      (window as any).__sock.fire("chat", {
        id,
        channel: "room",
        from: { id: `acct-${fighter}`, name },
        at: Date.now(),
        quick,
        fighter,
      }),
    [fighter, name, quick, id] as const,
  );

for (const phone of PHONES)
  test(`quick chat in a battle at ${phone.name}`, async ({ browser }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: { width: phone.width, height: phone.height },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();
    await page.addInitScript((inset) => {
      const set = () => {
        for (const [k, v] of Object.entries({
          left: inset,
          right: inset,
          bottom: 21,
          top: 0,
        }))
          document.documentElement.style.setProperty(`--safe-${k}`, `${v}px`);
      };
      if (document.documentElement) set();
      document.addEventListener("DOMContentLoaded", set);
    }, phone.inset);
    try {
      const errors = await battle(page, "pvp");
      const btn = page.locator("#battle-chat");
      await expect(btn).toBeVisible();
      // Clear of every control, the scoreboard and the camera cutout band.
      const clash = await page.evaluate((cutout) => {
        const b = document
          .getElementById("battle-chat")!
          .getBoundingClientRect();
        const H = innerHeight;
        const out: string[] = [];
        if (b.bottom > (H - cutout) / 2 && b.top < (H + cutout) / 2)
          out.push("cutout band");
        for (const e of document.querySelectorAll(
          ".touch-buttons button, .joystick, #battle-menu, #hud .scoreboard, #hud > *",
        )) {
          const r = e.getBoundingClientRect();
          if (!r.width || getComputedStyle(e).display === "none") continue;
          if (
            b.left < r.right &&
            r.left < b.right &&
            b.top < r.bottom &&
            r.top < b.bottom
          )
            out.push((e as HTMLElement).id || e.className.toString());
        }
        return out;
      }, phone.cutout);
      expect(clash).toEqual([]);
      const box = (await btn.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.x).toBeGreaterThanOrEqual(phone.inset - 9);

      // The grid sends a call to the room, then closes.
      await btn.click();
      const grid = page.locator("#battle-chat-grid");
      await expect(grid).toBeVisible();
      await snap(page, info, `battle-chat-grid-${phone.name}`);
      await grid.locator('[data-battle-quick="attack"]').click();
      await expect(grid).toBeHidden();
      expect(await page.evaluate(() => (window as any).__sent)).toEqual([
        ["chat-send", { channel: "room", quick: "attack" }],
      ]);

      // A teammate (Rae, seat 3: Blue with you) calls: a bubble and a line.
      await line(page, "p3", "Rae", "help", 1);
      const rae = page.locator(
        '.battle-nameplate[data-fighter="p3"] .chat-bubble',
      );
      await expect(rae).toHaveText("Help me");
      // The text stays inside the bubble, a long phrase or a long line too.
      const fits = () =>
        rae.evaluate((b) => {
          const r = b.getBoundingClientRect(),
            t = document.createRange();
          t.selectNodeContents(b);
          const s = t.getBoundingClientRect();
          return (
            b.scrollWidth <= b.clientWidth &&
            s.left >= r.left &&
            s.right <= r.right &&
            s.top >= r.top &&
            s.bottom <= r.bottom
          );
        });
      expect(await fits()).toBe(true);
      await rae.evaluate((b) => {
        b.textContent = "see you all at the fountain after this round ok";
      });
      expect(await fits()).toBe(true);
      expect((await rae.boundingBox())!.width).toBeLessThanOrEqual(160);
      await rae.evaluate((b) => {
        b.textContent = "Help me";
      });
      await expect(page.locator(".battle-chat-feed li")).toHaveText([
        "TEAMRae Help me",
      ]);
      // A teammate's call reached your side only: TEAM before it.
      await expect(page.locator(".battle-chat-feed li")).toHaveAttribute(
        "data-to",
        "team",
      );
      // A rival's phrase never shows; a rival's emote does.
      await line(page, "p2", "Kai", "gg", 2);
      await expect(
        page.locator('.battle-nameplate[data-fighter="p2"] .chat-bubble'),
      ).toHaveCount(0);
      await line(page, "p2", "Kai", "fire", 3);
      await expect(
        page.locator('.battle-nameplate[data-fighter="p2"] .chat-bubble'),
      ).toHaveText("🔥");
      await expect(page.locator(".battle-chat-feed li.is-rival")).toHaveCount(
        1,
      );
      // An emote reached the whole room: ALL.
      await expect(
        page.locator(".battle-chat-feed li.is-rival"),
      ).toHaveAttribute("data-to", "all");
      await snap(page, info, `battle-chat-bubbles-${phone.name}`);
      // Mute others: rivals' emotes stop showing.
      await btn.click();
      await grid.locator("[data-battle-mute]").click();
      await expect(grid.locator("[data-battle-mute]")).toHaveAttribute(
        "aria-pressed",
        "true",
      );
      await btn.click();
      await line(page, "p2", "Kai", "laugh", 4);
      await expect(
        page.locator('.battle-nameplate[data-fighter="p2"] .chat-bubble'),
      ).toHaveText("🔥");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

test("in a raid the quick chat carries the raid's signals", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  try {
    const errors = await battle(page, "raid");
    const btn = page.locator("#battle-chat");
    await expect(btn).toBeVisible();
    await expect(btn).toHaveAttribute("data-raid", "true");
    // The raid's own signals button is gone.
    await expect(page.locator("#raid-pings, .raid-ping-menu")).toHaveCount(0);
    await btn.click();
    const grid = page.locator("#battle-chat-grid");
    await expect(grid.locator("[data-battle-ping]")).toHaveCount(3);
    await snap(page, info, "battle-chat-raid-844x390");
    // Open, it keeps clear of the joystick and the boss's bar.
    const over = await page.evaluate(() => {
      const g = document
        .getElementById("battle-chat-grid")!
        .getBoundingClientRect();
      return [".joystick", ".raid-boss-health", ".raid-boss-heading"]
        .flatMap((s) => [...document.querySelectorAll(s)])
        .filter((e) => {
          const r = e.getBoundingClientRect();
          return (
            r.width &&
            g.left < r.right &&
            r.left < g.right &&
            g.top < r.bottom &&
            r.top < g.bottom
          );
        })
        .map((e) => e.className.toString());
    });
    expect(over).toEqual([]);
    await grid.locator('[data-battle-ping="stack"]').click();
    expect(await page.evaluate(() => (window as any).__sent)).toEqual([
      ["raid-ping", { kind: "stack" }],
    ]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

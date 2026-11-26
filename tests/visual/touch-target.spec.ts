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
 * The target button on phones (touch-controls.ts, mobile-input.ts): at the
 * cluster's right edge over the basic attack, where the right thumb reaches
 * from the skills (it turns into the cancel spot while a skill is dragged). A tap locks the
 * nearest enemy on screen, the next tap the next one, and past the last one
 * it lets go; it is off while no enemy is on screen (owner, 18 Nov 2026).
 */
const PHONES = [
  { name: "844x390", width: 844, height: 390, inset: 47 },
  { name: "932x430-island", width: 932, height: 430, inset: 59 },
  { name: "667x375", width: 667, height: 375, inset: 0 },
  { name: "568x320-compact", width: 568, height: 320, inset: 0 },
];

async function teamBattle(page: Page) {
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("pvp", { mode: "teams", phase: "playing" }),
  );
  await openPlayPanel(page);
  await pickRoomMode(page, "teams");
  await createRoom(page);
  await pushUntilBattle(page);
  return errors;
}

for (const phone of PHONES)
  test(`the target button by the skills at ${phone.name}`, async ({
    browser,
  }, info) => {
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
          bottom: inset ? 21 : 0,
          top: 0,
        }))
          document.documentElement.style.setProperty(`--safe-${k}`, `${v}px`);
      };
      if (document.documentElement) set();
      document.addEventListener("DOMContentLoaded", set);
    }, phone.inset);
    try {
      const errors = await teamBattle(page);
      const aim = page.locator(".touch-target");
      await expect(aim).toBeVisible();
      // The 2v2 starts with the rivals at the court's right edge, off screen
      // on a phone (the off-screen arrow points at them): the button is off.
      await expect(aim).toBeDisabled();
      const place = (spots: [number, number][]) =>
        page.evaluate((spots) => {
          const w = window as any;
          const rivals = w.__snap.players.filter((p: any) => p.team === 1);
          rivals.forEach((p: any, i: number) => ([p.x, p.y] = spots[i]));
          w.__push();
        }, spots);
      // Both rivals step onto the screen: on.
      await place([
        [700, 330],
        [820, 520],
      ]);
      await expect(aim).toBeEnabled();

      // On the screen, a finger's size, clear of every other control and
      // the scoreboard.
      const clash = await page.evaluate(() => {
        const b = document
          .querySelector(".touch-target")!
          .getBoundingClientRect();
        const out: string[] = [];
        if (
          b.left < 0 ||
          b.top < 0 ||
          b.right > innerWidth ||
          b.bottom > innerHeight
        )
          out.push("off screen");
        const name = (e: Element) =>
          (e as HTMLElement).id ||
          (e as HTMLElement).dataset.action ||
          (e as HTMLElement).dataset.skill ||
          e.className.toString();
        // The round buttons: circles at least 3 px apart.
        for (const e of document.querySelectorAll(
          ".touch-buttons button:not(.touch-target)",
        )) {
          const r = e.getBoundingClientRect();
          const d = Math.hypot(
            b.x + b.width / 2 - (r.x + r.width / 2),
            b.y + b.height / 2 - (r.y + r.height / 2),
          );
          if (d < (b.width + r.width) / 2 + 3) out.push(name(e));
        }
        // Everything else: no overlap at all.
        for (const e of document.querySelectorAll(
          ".joystick, #battle-menu, #battle-chat, #hud > *",
        )) {
          const r = e.getBoundingClientRect();
          if (!r.width || getComputedStyle(e).display === "none") continue;
          if (
            b.left < r.right &&
            r.left < b.right &&
            b.top < r.bottom &&
            r.top < b.bottom
          )
            out.push(name(e));
        }
        return out;
      });
      expect(clash).toEqual([]);
      const box = (await aim.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      // Near the right thumb: the cluster's right edge, over the basic
      // attack in the corner (the corner layout, 26 Nov 2026).
      const basic = (await page
        .locator('.touch-buttons [data-action="attack"]')
        .boundingBox())!;
      if (!phone.name.includes("compact")) {
        expect(
          Math.abs(box.x + box.width - (basic.x + basic.width)),
        ).toBeLessThan(2);
        expect(box.y + box.height).toBeLessThan(basic.y);
      }
      await snap(page, info, `touch-target-${phone.name}`);

      // A tap locks the nearest enemy (the button lights); taps step on and,
      // past the last enemy on screen, let go.
      await aim.tap();
      await expect(aim).toHaveClass(/is-locked/);
      await snap(page, info, `touch-target-locked-${phone.name}`);
      let taps = 1;
      while ((await aim.getAttribute("class"))!.includes("is-locked")) {
        await aim.tap();
        taps++;
        expect(taps).toBeLessThanOrEqual(4);
      }
      // Two enemies in a 2v2: lock, lock the other, let go.
      expect(taps).toBe(3);

      // Back to the court's edge, off screen: off again.
      await place([
        [1340, 330],
        [1340, 570],
      ]);
      await expect(aim).toBeDisabled();
      // On screen but knocked out: off too.
      await place([
        [700, 330],
        [820, 520],
      ]);
      await expect(aim).toBeEnabled();
      await page.evaluate(() => {
        const w = window as any;
        for (const p of w.__snap.players) if (p.team === 1) p.hp = 0;
        w.__push();
      });
      await expect(aim).toBeDisabled();
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

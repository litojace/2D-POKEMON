/**
 * Instagram's battle pictures (docs/instagram.md): the whole phone screen
 * as a player sees it, HUD, joystick, skill buttons and scoreboard
 * included (owner, 28 Nov: "full screen, with every button and the
 * joystick"), in Poster, on the owner's own iPhone size held sideways
 * (956 × 440 at 3×, 2868 × 1320, with its Dynamic Island's safe areas).
 * The scenes are the website's (scripts/site-clips/scenes.ts): every
 * fighter fires its ultimate within a few ticks of the others, one frame
 * per tick, written to instagram-clips/battles/<scene>/NNN.png. Pick each
 * post's frame by eye: a big move going off, every fighter still in sight.
 *
 *   npx playwright test --config scripts/instagram/playwright.config.ts battles
 *   SCENE=duels ... battles   # one scene
 */
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
} from "../../tests/visual/helpers";
import { lookShown, onPlayersLook } from "../../tests/visual/players-look";
import { setInsets } from "../../tests/visual/ui-measure";
import { SCENES, TICKS, stage, step } from "../site-clips/scenes";

onPlayersLook();

const OUT = "instagram-clips/battles";
/** An iPhone Pro Max held sideways: its safe areas (points). */
const PRO_MAX = { left: 62, right: 62, bottom: 21, top: 0 };
/** Only what comes and goes on its own: a toast mid-fight. */
const QUIET = `#toast { display: none !important; }`;

for (const s of SCENES.filter(
  (s) => !process.env.SCENE || process.env.SCENE.split(",").includes(s.name),
))
  test(`battles ${s.name}`, async ({ browser }) => {
    test.setTimeout(600_000);
    const context = await browser.newContext({
      viewport: { width: 956, height: 440 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
    });
    // The Spire's painted court (as tests/visual/spire-court.spec.ts sets).
    await context.addInitScript(() =>
      localStorage.setItem(
        "arena-controls",
        JSON.stringify({ raidCourt: true }),
      ),
    );
    try {
      const page = await context.newPage();
      await openHub(page);
      expect(await lookShown(page)).toBe("poster");
      await setInsets(page, PRO_MAX);
      await page.evaluate((args) => (window as any).__room(...args), s.room);
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await page.addStyleTag({ content: QUIET });
      await stage(page, s);
      // Let the fighters' art settle before anyone casts.
      await page.evaluate(() => ((window as any).__shot.tick = -60));
      for (let i = 0; i < 30; i++) await step(page, 2, true);
      // The touch controls are on screen: what a phone shows.
      if (process.env.BATTLE_DEBUG)
        writeFileSync(`${OUT}-debug-${s.name}.png`, await page.screenshot());
      await expect(
        page.locator("#mobile-controls .touch-buttons button").first(),
      ).toBeVisible();
      await expect(page.locator("#hud")).toBeVisible();
      const dir = `${OUT}/${s.name}`;
      mkdirSync(dir, { recursive: true });
      for (let f = 0; f <= TICKS; f++) {
        await step(page, 1, true);
        writeFileSync(
          `${dir}/${String(f).padStart(3, "0")}.png`,
          await page.screenshot(),
        );
      }
    } finally {
      await context.close();
    }
  });

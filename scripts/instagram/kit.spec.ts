/**
 * A champion's skill buttons exactly as a phone shows them in battle (owner,
 * 28 Nov: the champion spotlight shows what each skill's button looks
 * like), for make-posts.mjs's champion posts. The website's free-for-all
 * scene (scripts/site-clips/scenes.ts) with the player's fighter swapped for
 * the champion, nobody casting, the ultimate charged, so every button is
 * ready: no cooldown numbers. Each button is written to
 * instagram-clips/kit/<champion>/<slot>.png (0-2 skills, 3 the ultimate)
 * with its aria-label in labels.json, to check the order against the post.
 *
 *   CHAMP=pyranda npx playwright test --config scripts/instagram/playwright.config.ts kit
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
import { SCENES, stage, step } from "../site-clips/scenes";

onPlayersLook();

const CHAMP = process.env.CHAMP ?? "pyranda";

test(`kit ${CHAMP}`, async ({ browser }) => {
  test.setTimeout(300_000);
  const context = await browser.newContext({
    viewport: { width: 956, height: 440 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await openHub(page);
    expect(await lookShown(page)).toBe("poster");
    await setInsets(page, { left: 62, right: 62, bottom: 21, top: 0 });
    const ffa = SCENES.find((s) => s.name === "ffa")!;
    const scene = {
      ...ffa,
      fighters: ffa.fighters.map((f, i) =>
        i ? f : ([f[0], CHAMP, f[2], f[3]] as typeof f),
      ),
    };
    await page.evaluate((args) => (window as any).__room(...args), scene.room);
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await page.addStyleTag({ content: "#toast { display: none !important; }" });
    await stage(page, scene);
    // Nobody casts; the player's ultimate stays full.
    await page.evaluate(() => {
      const shot = (window as any).__shot;
      const keep = shot.keep;
      shot.inputs = () => null;
      shot.keep = () => {
        keep();
        const me = shot.a.players.find((p: any) => p.id === "me");
        if (me) me.ult = 100;
      };
    });
    for (let i = 0; i < 40; i++) await step(page, 2, true);
    const dir = `instagram-clips/kit/${CHAMP}`;
    mkdirSync(dir, { recursive: true });
    const labels: Record<string, string> = {};
    for (const slot of ["0", "1", "2", "3"]) {
      const button = page.locator(
        `#mobile-controls .touch-buttons button[data-skill="${slot}"]`,
      );
      await expect(button).toBeVisible();
      labels[slot] =
        (await button.getAttribute("aria-label")) ??
        (await button.textContent()) ??
        "";
      writeFileSync(
        `${dir}/${slot}.png`,
        await button.screenshot({ omitBackground: true }),
      );
    }
    writeFileSync(`${dir}/labels.json`, JSON.stringify(labels, null, 1));
  } finally {
    await context.close();
  }
});

/**
 * The website's skin loops (docs/website.md, "Skins with their effects"):
 * every champion's Classic look and featured skins, and the Shop spotlight's
 * pieces, played in the game's own fitting room and recorded at 60 frames a
 * second.
 *
 *   npx playwright test --config scripts/site-clips/playwright.config.ts scripts/site-clips/skins.spec.ts --workers=4
 *   python3 apps/site/tools/make-skin-clips.py
 *
 * The stage runs on Playwright's clock: the page's time is paused and moved
 * on by exactly 1/60 s between screenshots, so a frame takes as long as the
 * machine needs (this one draws on the CPU) and the loop still plays at 60
 * frames a second with every frame in its place. A screencast of the stage
 * in real time managed about 17.
 *
 * What each loop plays is the fitting room's own showcase, one 4.4 s cycle
 * of it (shop-preview.ts): a Mythical casts its ultimate at Stage III, a
 * Legendary plays its victory, a victory item plays on its fighter, and the
 * Classic look stands in its idle. Writes site-clips/skins/<name>/NNN.jpg and
 * meta.json (the action, the stage's internal clock at each frame).
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { openHub } from "../../tests/visual/helpers";
import { exposeAccount, shopServer } from "../../tests/visual/shop-server";
import { playersLook } from "../../tests/visual/players-look";

const OUT = "site-clips/skins";
/** The fitting room's showcase cycle (shop-preview.ts: clock % 4400). */
const CYCLE_MS = 4400;
/**
 * The page's time moved on per frame. Playwright's clock runs animation
 * frames every 16 ms, so steps of 1000/60 ms let two frames' worth of time
 * through on every 25th step: the loop jumped 2.5 times a second. Steps of
 * 16 ms give every frame the same 16 ms; the loop is encoded at 60 frames a
 * second, so it plays 4% slower than the game, which no one can see.
 */
const STEP_MS = 16;
/** Frames past the loop, blended into its start where the loop wraps. */
const TAIL = 8;
/** The idle has no cycle: record more and let the encoder find the loop. */
const IDLE_MS = 6600;
/** The square cut round the fighter, as shares of the stage (CSS pixels). */
const CUT = { cx: 0.5, cy: 0.375, side: 0.72 };

type Action = "idle" | "victory" | "ultimate";
interface Clip {
  /** File name on the website. */
  name: string;
  champion: string;
  /** The Shop piece tried on; none for the Classic look. */
  item?: string;
  /** The Shop tab the piece is on (default: skins). */
  section?: "skins" | "collections";
  action: Action;
  /** Another cut (a victory that fills the sky above the fighter). */
  cut?: Partial<typeof CUT>;
}

/** Every champion's Classic look and featured skins (data/champions.json). */
const champions = JSON.parse(
  readFileSync(
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../apps/site/data/champions.json",
    ),
    "utf8",
  ),
) as { id: string; skins: { id: string; rarity: string }[] }[];
const actionFor = (rarity: string): Action =>
  rarity === "mythical" ? "ultimate" : "victory";

/**
 * The Shop spotlight's pieces (gen-data.ts SHOWCASE) that are not featured
 * skins already: their loops are made the same way, under the item's id.
 */
export const SPOTLIGHT_EXTRA: Clip[] = [
  {
    name: "sunbara-sun-dynasty",
    champion: "sunbara",
    item: "sunbara-sun-dynasty",
    action: "victory",
  },
  // A victory for every fighter, shown on Voltkit: it fills the sky above
  // the fighter, so its square is cut wider and higher.
  {
    name: "borealis-victory",
    champion: "voltkit",
    item: "borealis-victory",
    section: "collections",
    action: "victory",
    cut: { cy: 0.33, side: 1 },
  },
];

export const CLIPS: Clip[] = [
  ...champions.flatMap((c) => [
    { name: c.id, champion: c.id, action: "idle" as const },
    ...c.skins.map((s) => ({
      name: s.id,
      champion: c.id,
      item: s.id,
      action: actionFor(s.rarity),
    })),
  ]),
  ...SPOTLIGHT_EXTRA,
];

const ONLY = process.env.CLIPS?.split(",");

const stage = (page: Page) => page.locator(".fit-stage .shop-live-stage");
const animationTime = (page: Page) =>
  stage(page).evaluate((h) =>
    Number((h as HTMLElement).dataset.animationTime ?? -1),
  );

async function open(page: Page, clip: Clip) {
  await playersLook(page);
  await page.clock.install();
  await exposeAccount(page);
  // The Classic look: nothing the harness's account wears on this fighter.
  await shopServer(page, {
    balance: 2340,
    cost: 500,
    cleared: [clip.champion],
  });
  await openHub(page);
  await page.evaluate((c) => {
    (window as any).__choose(c);
    void (window as any).__account.showShop("skins");
  }, clip.champion);
  await expect(stage(page)).toHaveClass(/is-ready/);
  if (clip.item) {
    if (clip.section === "collections") {
      await page.click("[data-ui-section=collections]");
      await page.click(`[data-fit-collection=${clip.item.split("-")[0]}]`);
    } else
      await page
        .locator(`.fit-room [data-ui-item="${clip.item}"]`)
        .scrollIntoViewIfNeeded();
    await page.click(`.fit-room [data-ui-item="${clip.item}"]`);
  }
  // A victory item plays its victory as soon as it is tried on.
  if (clip.action !== "idle" && clip.section !== "collections")
    await page.click(`[data-fit-play=${clip.action}]`);
  // The picture is the stage alone: no buttons, name or price.
  await page.addStyleTag({
    content:
      ".fit-stage-top, .fit-stage-info { visibility: hidden !important; }",
  });
  await expect(stage(page)).toHaveClass(/is-ready/);
  await expect(stage(page)).not.toHaveAttribute("aria-busy", "true");
  await page.waitForTimeout(600);
}

for (const clip of CLIPS.filter((c) => !ONLY || ONLY.includes(c.name)))
  test(`skin ${clip.name}`, async ({ browser }) => {
    test.setTimeout(600_000);
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      // The preview draws at the size shown times the density (up to 3×).
      deviceScaleFactor: 3,
    });
    try {
      const page = await context.newPage();
      await open(page, clip);
      const box = (await page.locator(".fit-stage").boundingBox())!;
      const c = { ...CUT, ...clip.cut };
      const side = Math.round(box.width * c.side);
      const cut = {
        x: Math.round(box.x + box.width * c.cx - side / 2),
        y: Math.round(box.y + box.height * c.cy - side / 2),
        width: side,
        height: side,
      };
      const dir = `${OUT}/${clip.name}`;
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      await page.clock.pauseAt(Date.now() + 1000);
      const step = () => page.clock.runFor(STEP_MS);
      // Two frames first, so the first recorded step is a whole one.
      await step();
      await step();
      // Start where the showcase starts: the stage's clock crossing a cycle.
      if (clip.action !== "idle") {
        const cycleOf = async () =>
          Math.floor((await animationTime(page)) / CYCLE_MS);
        const from = await cycleOf();
        for (let i = 0; i < 400 && (await cycleOf()) === from; i++)
          await step();
      }
      const frames =
        Math.ceil((clip.action === "idle" ? IDLE_MS : CYCLE_MS) / STEP_MS) +
        TAIL;
      const clocks: number[] = [];
      for (let f = 0; f < frames; f++) {
        await page.screenshot({
          path: `${dir}/${String(f).padStart(3, "0")}.jpg`,
          clip: cut,
          type: "jpeg",
          quality: 95,
        });
        clocks.push(await animationTime(page));
        await step();
      }
      writeFileSync(
        `${dir}/meta.json`,
        JSON.stringify({
          ...clip,
          stepMs: STEP_MS,
          tail: TAIL,
          cycleMs: CYCLE_MS,
          cut,
          clocks,
        }),
      );
    } finally {
      await context.close();
    }
  });

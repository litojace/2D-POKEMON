import { expect, test, type Page } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { exposeAccount, shopServer } from "./shop-server";

// The Shop and Wardrobe catalogue keeps still to spare phones' GPUs: each
// effect tile draws one chosen moment of its effect and frames rest in their
// still pose. The stage on the left keeps playing the real effect, so a
// chosen tile still shows it moving there.
const CATALOGUE = ".fit-room > .ui-split-main";

/** Effect tiles in the catalogue that are on screen, and what they show. */
const tiles = (page: Page) =>
  page.evaluate((catalogue) => {
    const out: { id: string; drawn: boolean; sharp: boolean; sig: string }[] =
      [];
    for (const el of document.querySelectorAll<HTMLElement>(
      `${catalogue} .raid-cosmetic-preview`,
    )) {
      const canvases = [
        ...el.querySelectorAll<HTMLCanvasElement>(":scope > .fx-live"),
      ];
      if (!canvases.length) continue;
      const r = el.getBoundingClientRect();
      // The footer's picture sits outside the scrolling list.
      const scroller = (
        el.closest(".fit-body") ?? el.parentElement!
      ).getBoundingClientRect();
      // Inside the scrolling list and not clipped by a row (bundle art).
      const clip = el.parentElement!.parentElement!.getBoundingClientRect();
      if (
        r.bottom < scroller.top ||
        r.top > scroller.bottom ||
        r.left >= clip.right ||
        r.right <= clip.left
      )
        continue;
      let ink = 0;
      for (const c of canvases) {
        const data = c
          .getContext("2d")!
          .getImageData(0, 0, c.width, c.height).data;
        for (let i = 3; i < data.length; i += 4) if (data[i]) ink++;
      }
      const dpr = Math.min(2, devicePixelRatio || 1);
      out.push({
        id: el.dataset.cosmetic!,
        drawn: ink > 0,
        sharp: canvases.every(
          (c) => c.width === Math.round(el.offsetWidth * dpr),
        ),
        sig: canvases.map((c) => c.toDataURL()).join("|"),
      });
    }
    return out;
  }, CATALOGUE);

/** Running CSS animations (not short transitions) inside `scope`. */
const running = (page: Page, scope: string) =>
  page.evaluate((scope) => {
    const names: string[] = [];
    for (const a of document.getAnimations()) {
      const target = (a.effect as KeyframeEffect | null)?.target;
      const name = (a as CSSAnimation).animationName;
      if (name && target?.closest(scope) && a.playState === "running")
        names.push(name);
    }
    return names;
  }, scope);

test("the Shop and Wardrobe catalogue shows still effects; the stage plays them", async ({
  browser,
}, info) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 2,
  });
  try {
    const page = await context.newPage();
    await shopServer(page, {
      owned: [
        "galaxy-aura",
        "galaxy-entrance",
        "galaxy-victory",
        "galaxy-frame",
        "galaxy-colours",
        "candy-frame",
      ],
      raids: {
        cosmetics: ["conqueror"],
        bosses: { grumblecrag: { clears: 16 } },
      },
    });
    const errors = await openLobby(page);
    await page.click('.lobby-rail [data-lobby-action="shop"]');
    await expect(page.locator(".fit-room")).toBeVisible();
    await page.click("[data-ui-section=collections]");
    await page.click("[data-fit-collection=galaxy]");

    // Every effect tile on screen is drawn, sharp, and then keeps still.
    await expect
      .poll(async () => {
        const t = await tiles(page);
        return t.length >= 4 && t.every((x) => x.drawn && x.sharp);
      })
      .toBe(true);
    const first = await tiles(page);
    expect(first.map((t) => t.id)).toEqual(
      expect.arrayContaining([
        "galaxy-aura",
        "galaxy-entrance",
        "galaxy-victory",
        "galaxy-colours",
      ]),
    );
    await page.waitForTimeout(800);
    const later = await tiles(page);
    expect(later.map((t) => t.sig)).toEqual(first.map((t) => t.sig));
    // Frames (the Planet-ring tile is Mythical) don't turn in the catalogue.
    expect(await running(page, CATALOGUE)).toEqual([]);
    await snap(page, info, "catalogue-still-galaxy");

    // Choosing a tile plays the real effect on the stage.
    const stage = page.locator(".fit-stage .shop-live-stage");
    await page.click('.fit-room [data-ui-item="galaxy-aura"]');
    await expect(stage).toHaveClass(/is-ready/);
    await page.waitForTimeout(500);
    const a = await stage.screenshot();
    await page.waitForTimeout(400);
    expect((await stage.screenshot()).equals(a)).toBe(false);
    // A frame's tier edge, sparks and rays keep turning on the stage.
    await page.click('.fit-room [data-ui-item="galaxy-frame"]');
    await expect(stage).toHaveClass(/is-item/);
    expect(await running(page, ".fit-stage .shop-live-stage")).toEqual(
      expect.arrayContaining(["tier-turn", "tier-orbit"]),
    );
    expect(await running(page, CATALOGUE)).toEqual([]);

    // The Wardrobe: the frames and effect tiles keep still there too.
    await page.click('[data-ui-mode="wardrobe"]');
    for (const slot of ["frame", "aura", "entrance", "victory", "skin"]) {
      await page.click(`.fit-slots [data-fit-slot="${slot}"]`);
      await expect(page.locator(".fit-grid [data-ui-item]")).not.toHaveCount(0);
      await expect
        .poll(async () => (await tiles(page)).every((x) => x.drawn && x.sharp))
        .toBe(true);
      const before = await tiles(page);
      await page.waitForTimeout(500);
      expect(
        (await tiles(page)).map((t) => t.sig),
        slot,
      ).toEqual(before.map((t) => t.sig));
      expect(await running(page, CATALOGUE), slot).toEqual([]);
    }
    await page.click('.fit-slots [data-fit-slot="frame"]');
    await snap(page, info, "catalogue-still-wardrobe-frames");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/** What one thumbnail's effect canvases show ("" when it has none). */
const shown = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector<HTMLElement>(selector);
    const canvases = el
      ? [...el.querySelectorAll<HTMLCanvasElement>(":scope > .fx-live")]
      : [];
    let ink = 0;
    for (const c of canvases) {
      const data = c
        .getContext("2d")!
        .getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < data.length; i += 4) if (data[i]) ink++;
    }
    return ink ? canvases.map((c) => c.toDataURL()).join("|") : "";
  }, selector);
/** Draws once and keeps still (true), or keeps changing (false). */
async function keepsStill(page: Page, selector: string) {
  // Only thumbnails in view are drawn.
  await page.locator(selector).first().scrollIntoViewIfNeeded();
  await expect.poll(() => shown(page, selector)).not.toBe("");
  await page.waitForTimeout(300);
  const a = await shown(page, selector);
  await page.waitForTimeout(400);
  return (await shown(page, selector)) === a;
}

test("Raid Hub, Journey and reward reveal tiles keep still; the chosen one plays", async ({
  browser,
}) => {
  test.setTimeout(120_000);
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
  });
  try {
    const page = await context.newPage();
    await exposeAccount(page);
    await shopServer(page, {
      raids: { bosses: { grumblecrag: { clears: 4 } } },
    });
    const errors = await openLobby(page);

    // Raid Hub rewards: still, until a card is opened.
    await page.evaluate(
      () => void (window as any).__account.showRaids("grumblecrag", "rewards"),
    );
    await expect(page.locator(".rh-rewards.is-all")).toBeVisible();
    const card = (id: string) =>
      `[data-raid-reward="${id}"] .raid-cosmetic-preview`;
    for (const id of ["mountain-aura", "mountainborn", "rockslide-flex"])
      expect(await keepsStill(page, card(id)), id).toBe(true);
    expect(await running(page, ".rh-reward")).toEqual([]);
    await page.click('[data-raid-reward="mountain-aura"]');
    await expect(
      page.locator('[data-raid-reward="mountain-aura"]'),
    ).toHaveAttribute("aria-expanded", "true");
    expect(await keepsStill(page, card("mountain-aura"))).toBe(false);
    expect(await keepsStill(page, card("mountainborn"))).toBe(true);
    await page.click('[data-raid-reward="mountain-aura"]');
    expect(await keepsStill(page, card("mountain-aura"))).toBe(true);
    await page.locator(".rh-room .ui-close").click();

    // Journey: still, until an item is picked.
    await page.click('.lobby-rail [data-lobby-action="journey"]');
    await page.click('[data-ui-jtab="levels"]');
    const item = (id: string) =>
      `.journey-room [data-journey-item="${id}"] .raid-cosmetic-preview`;
    expect(await keepsStill(page, item("solar-aura"))).toBe(true);
    expect(await running(page, ".journey-room")).toEqual([]);
    await page.click('[data-journey-item="solar-aura"]');
    expect(await keepsStill(page, item("solar-aura"))).toBe(false);
    // The footer repeats the pick small, and keeps still.
    expect(
      await keepsStill(page, ".journey-foot-art .raid-cosmetic-preview"),
    ).toBe(true);
    await page.locator(".journey-room .ui-close").click();

    // The reward reveal's card keeps still.
    const path = new URL(
      "../../apps/client/src/reward-reveal.ts",
      import.meta.url,
    ).pathname;
    await page.evaluate(async (path) => {
      const m = await import(/* @vite-ignore */ `/@fs${path}`);
      const { RAID_REWARDS } = await import(
        /* @vite-ignore */ `/@fs${path.replace("apps/client/src/reward-reveal.ts", "packages/shared/src/raid.ts")}`
      );
      const pick = (id: string) =>
        RAID_REWARDS.find((r: { id: string }) => r.id === id);
      void m.showRewardReveal(
        [pick("mountain-aura"), pick("conqueror")],
        "voltkit",
      );
    }, path);
    await expect(page.locator("#reward-reveal .reveal-card")).toHaveClass(
      /is-flipped/,
    );
    expect(
      await keepsStill(page, "#reward-reveal .raid-cosmetic-preview"),
    ).toBe(true);
    await page.getByRole("button", { name: "Next reward" }).click();
    await expect(page.locator(".reveal-name")).toHaveText("Conqueror frame");
    expect(
      await running(page, "#reward-reveal .raid-cosmetic-preview"),
    ).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

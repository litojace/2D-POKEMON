import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";
import { onPlayersLook } from "./players-look";
import { titleTier } from "../../packages/shared/src/title-tier";

// A title wears its tier's lettering wherever a player's name and title
// show (title-tag.ts): the Lobby's corner and the Profile, as over heads in
// the Plaza (plaza-titles.spec.ts). No plate or frame anywhere.
onPlayersLook();

const TITLES: [string, string][] = [
  ["First Victory", "#9ee6a8"],
  ["Cragbreaker", "#e5bc73"],
  ["Mountain Conqueror", "#ffcf66"],
  ["Lone Mountain", "#c9a46a"],
  ["Stormbreaker of the Spire", "#8edfff"],
];
const owned = TITLES.map(([name, color], i) => ({
  id: `00000000-0000-4000-8000-00000000000${i}`,
  name,
  description: "",
  color,
  active: true,
  createdAt: null,
}));
const wear = (page: Page, [title, titleColor]: [string, string]) =>
  page.addInitScript(
    (patch) => {
      (window as any).__accountPatch = patch;
    },
    { title, titleColor, ownedTitles: owned },
  );
/** What a title tag is: its tier, its stars, whether anything in it moves,
 *  and whether a plate is painted behind it. */
const tag = (page: Page, selector: string) =>
  page.locator(selector).evaluate((el) => {
    const text = el.querySelector(":scope > span")!,
      style = getComputedStyle(el);
    return {
      tier: (el as HTMLElement).dataset.tier,
      stars: el.querySelectorAll(":scope > i").length,
      moving: [text, ...el.querySelectorAll(":scope > i")].some(
        (n) => getComputedStyle(n).animationName !== "none",
      ),
      plate:
        style.backgroundImage !== "none" ||
        !/rgba\(0, 0, 0, 0\)|transparent/.test(style.backgroundColor),
      title: text.textContent,
    };
  });

for (const title of TITLES) {
  const tier = titleTier(title[0]);
  test(`the Lobby's corner and the Profile show a ${tier} title in its lettering`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 844, height: 390 });
    await wear(page, title);
    const errors = await openLobby(page);
    const stars = tier === "legendary" || tier === "mythic" ? 2 : 0;
    // The corner: always on screen, so it never moves.
    expect(await tag(page, "#account-profile .nav-title .title-tag")).toEqual({
      tier,
      stars,
      moving: false,
      plate: false,
      title: title[0],
    });
    // The Profile's card: the tier's lettering; Epic and up may move (a
    // few times, as the card opens).
    await page.click("#account-profile");
    const card = await tag(page, ".pf-card-title .title-tag");
    expect(card).toMatchObject({ tier, stars, plate: false, title: title[0] });
    expect(card.moving).toBe(tier !== "common" && tier !== "rare");
    // The title picker: every owned title in its own tier, none moving.
    await page.locator('[data-ui-profile-tab="titles"]').click();
    const chips = page.locator(".pf-title-chip .title-tag");
    await expect(chips).toHaveCount(TITLES.length);
    const picker = await chips.evaluateAll((els) =>
      els.map((el) => ({
        tier: (el as HTMLElement).dataset.tier,
        title: el.querySelector(":scope > span")!.textContent,
        moving: [...el.querySelectorAll(":scope > span, :scope > i")].some(
          (n) => getComputedStyle(n).animationName !== "none",
        ),
        // The chip shows the whole title: nothing cut to "…".
        cut: el.scrollWidth > el.clientWidth + 1,
      })),
    );
    expect(picker.map((p) => [p.title, p.tier])).toEqual(
      expect.arrayContaining(TITLES.map(([t]) => [t, titleTier(t)])),
    );
    expect(picker.filter((p) => p.moving || p.cut)).toEqual([]);
    expect(errors).toEqual([]);
  });
}

test("Reduce motion holds the Profile's title still", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 844, height: 390 });
  await wear(page, TITLES[4]);
  const errors = await openLobby(page);
  await page.click("#account-profile");
  const card = await tag(page, ".pf-card-title .title-tag");
  expect(card).toMatchObject({ tier: "mythic", moving: false });
  expect(errors).toEqual([]);
});

// The corner's card is narrow: its title is set in the condensed face the
// Plaza's titles have, so an eighteen-letter title reads in full even on
// the smallest phone (it was cut to "MOUNTAIN CONQUE…").
for (const viewport of [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
  { width: 1440, height: 900 },
])
  test(`"Mountain Conqueror" reads in full in the corner at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await wear(page, TITLES[2]);
    const errors = await openLobby(page);
    const line = page.locator("#account-profile .nav-title");
    await expect(line).toHaveText("Mountain Conqueror");
    await expect
      .poll(() => line.evaluate((el) => el.scrollWidth - el.clientWidth))
      .toBeLessThanOrEqual(0);
    // Inside the card, between the name and the bar.
    const rows = await page.evaluate(() => {
      const r = (s: string) =>
        document.querySelector(s)!.getBoundingClientRect();
      const card = r("#account-profile"),
        name = r("#account-profile .account-name"),
        title = r("#account-profile .nav-title"),
        xp = r("#account-profile .nav-xp");
      return {
        order: name.bottom <= title.top + 1 && title.bottom <= xp.top + 1,
        inside: title.left >= card.left && title.right <= card.right + 0.5,
      };
    });
    expect(rows).toEqual({ order: true, inside: true });
    expect(errors).toEqual([]);
  });

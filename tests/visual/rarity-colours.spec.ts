import { expect, test, type Page } from "@playwright/test";
import { hubMenu, openLobby, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";

// Rarity in its own colour where it is a choice or a picture (owner, 27 Nov
// 2026): themes/poster/rarity.css, the Shop's five colours (--r-*).
onPlayersLook();

type Rgb = [number, number, number];
const lum = (c: Rgb) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
};
const ratio = (a: Rgb, b: Rgb) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};
const toRgb = (page: Page, css: string) =>
  page.evaluate((css) => {
    const g = document.createElement("canvas").getContext("2d")!;
    g.fillStyle = css;
    g.fillRect(0, 0, 1, 1);
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)] as Rgb;
  }, css);
const style = (page: Page, selector: string, prop: string, pseudo = "") =>
  page.evaluate(
    ([selector, prop, pseudo]) =>
      getComputedStyle(
        document.querySelector(selector)!,
        pseudo || null,
      ).getPropertyValue(prop),
    [selector, prop, pseudo],
  );
const token = async (page: Page, name: string) =>
  toRgb(
    page,
    await page.evaluate((name) => {
      const i = document.createElement("i");
      i.style.color = `var(${name})`;
      document.body.append(i);
      const c = getComputedStyle(i).color;
      i.remove();
      return c;
    }, name),
  );

test("the Shop's rarity filter wears each tier; a pressed tier is filled with it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openLobby(page);
  await skipTour(page).catch(() => {});
  await hubMenu(page, "shop");
  await page.click('[data-ui-section="skins"]');
  const chip = (r: string) => `.ui-chip[data-ui-rarity="${r}"]`;
  await expect(page.locator(chip("epic"))).toBeVisible();
  for (const [r, t] of [
    ["common", "--r-common"],
    ["rare", "--r-rare"],
    ["epic", "--r-epic"],
    ["legendary", "--r-legendary"],
  ])
    expect(
      await toRgb(
        page,
        await style(page, chip(r), "background-color", "::before"),
      ),
      r,
    ).toEqual(await token(page, t));
  expect(
    await style(page, chip("mythical"), "background-image", "::before"),
  ).toContain("gradient");
  expect(await style(page, chip("all"), "content", "::before")).toBe("none");
  await page.click(chip("epic"));
  await expect(page.locator(chip("epic"))).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  const epic = await token(page, "--r-epic");
  await expect
    .poll(async () =>
      toRgb(page, await style(page, chip("epic"), "background-color")),
    )
    .toEqual(epic);
  const words = await toRgb(page, await style(page, chip("epic"), "color"));
  expect(ratio(words, epic)).toBeGreaterThanOrEqual(4.5);
});

test("an item tile keeps its tier's edge at its foot", async ({ page }) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await skipTour(page).catch(() => {});
  await hubMenu(page, "shop");
  await page.click('[data-ui-section="skins"]');
  const tile = page.locator('.ui-tile[data-rarity="legendary"]').first();
  await expect(tile).toBeVisible();
  const shadow = await tile.evaluate((t) => getComputedStyle(t).boxShadow);
  expect(shadow).toContain("inset");
  expect(shadow).toContain("-3px");
  const edge = await toRgb(page, shadow.match(/rgba?\([^)]*\)/)![0]);
  expect(edge).toEqual(await token(page, "--r-legendary"));
});

import { expect, test, type Page } from "@playwright/test";
import { hubMenu, openLobby, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";

// An element in its own colour wherever it means the element (owner, 27 Nov
// 2026): themes/poster/elements.css, with the game's own --el-* colours.
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

/** A computed colour of an element (or its pseudo), as RGB via a canvas. */
const rgb = (page: Page, selector: string, prop: string) =>
  page.evaluate(
    ([selector, prop]) => {
      const el = document.querySelector(selector)!;
      const g = document.createElement("canvas").getContext("2d", {
        willReadFrequently: true,
      })!;
      g.fillStyle = getComputedStyle(el).getPropertyValue(prop);
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)] as Rgb;
    },
    [selector, prop],
  );
const token = (page: Page, name: string) =>
  page.evaluate((name) => {
    const i = document.createElement("i");
    i.style.color = `var(${name})`;
    document.body.append(i);
    const g = document.createElement("canvas").getContext("2d")!;
    g.fillStyle = getComputedStyle(i).color;
    g.fillRect(0, 0, 1, 1);
    i.remove();
    return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)] as Rgb;
  }, name);

const ELEMENTS = [
  "Electric",
  "Fire",
  "Water",
  "Aura",
  "Light",
  "Psychic",
  "Earth",
  "Shadow",
  "Nature",
];

test("the Fighters filter wears each element's colour; a pressed chip is filled with it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await skipTour(page).catch(() => {});
  await hubMenu(page, "fighters");
  const ink = await token(page, "--ink");
  for (const e of ELEMENTS) {
    const chip = `.ui-panel-head [data-roster-element="${e}"]`;
    const want = await token(page, `--el-${e.toLowerCase()}`);
    const icon = await rgb(page, `${chip} svg`, "color");
    expect(icon, e).toEqual(want);
    // An icon on the chip's grey holds 3:1 (WCAG, non-text).
    const ground = await rgb(page, chip, "background-color");
    expect(ratio(icon, ground), e).toBeGreaterThanOrEqual(3);
  }
  // "All" keeps the chrome's own colours: it is no element.
  const all = await rgb(
    page,
    '.ui-panel-head [data-roster-element="All"]',
    "background-color",
  );
  expect(ELEMENTS.length).toBe(9);
  await page.click('.ui-panel-head [data-roster-element="Fire"]');
  const fire = '.ui-panel-head [data-roster-element="Fire"]';
  await expect(page.locator(fire)).toHaveAttribute("aria-pressed", "true");
  const fireColour = await token(page, "--el-fire");
  // (The chip's fill eases in: wait for it to settle.)
  await expect
    .poll(() => rgb(page, fire, "background-color"))
    .toEqual(fireColour);
  await expect.poll(() => rgb(page, `${fire} svg`, "color")).toEqual(ink);
  await expect
    .poll(() =>
      rgb(
        page,
        '.ui-panel-head [data-roster-element="All"]',
        "background-color",
      ),
    )
    .not.toEqual(all);
  // The cards' element tags: filled with the element, ink inside.
  const tag = '[data-roster-card="cindrake"] .ui-element';
  expect(await rgb(page, tag, "background-color")).toEqual(
    await token(page, "--el-fire"),
  );
  expect(await rgb(page, `${tag} svg`, "color")).toEqual(ink);
});

test("the Lobby's element tag puts its icon on a square of the element", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await skipTour(page).catch(() => {});
  const pill = "#lobby-fighter-element";
  await expect(page.locator(pill)).toContainText("Electric");
  expect(await rgb(page, `${pill} svg`, "background-color")).toEqual(
    await token(page, "--el-electric"),
  );
  // The words stay ink on cream.
  expect(
    ratio(
      await rgb(page, pill, "color"),
      await rgb(page, pill, "background-color"),
    ),
  ).toBeGreaterThanOrEqual(4.5);
});

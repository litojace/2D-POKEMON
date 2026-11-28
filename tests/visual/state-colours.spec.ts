import { expect, test, type Page } from "@playwright/test";
import { openLobby, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";

// State in its colour (owner, 27 Nov 2026): themes/poster/state.css. New is
// one colour everywhere; progress on a cream card is ink, not red; a friend
// who is here has the presence dot's green edge.
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
const rgb = (page: Page, selector: string, prop: string) =>
  page.evaluate(
    ([selector, prop]) => {
      const g = document.createElement("canvas").getContext("2d")!;
      g.fillStyle = getComputedStyle(
        document.querySelector(selector)!,
      ).getPropertyValue(prop);
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

test("new is one violet, a highlight is not news, a friend who is here has a green edge", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await skipTour(page).catch(() => {});
  await page.evaluate(() => {
    const m = document.createElement("div");
    m.id = "state-probe";
    m.innerHTML =
      '<span class="ui-tag is-new" id="p-new">New</span><span class="ui-tag is-mark" id="p-you">You</span>' +
      '<div class="fr-row is-online"><div class="ui-row" id="p-on">Kai</div></div>' +
      '<div class="fr-row is-offline"><div class="ui-row" id="p-off">Ada</div></div>';
    document.body.append(m);
  });
  const news = await token(page, "--badge-news");
  expect(await rgb(page, "#p-new", "background-color")).toEqual(news);
  const words = await rgb(page, "#p-new", "color");
  expect(ratio(words, news)).toBeGreaterThanOrEqual(4.5);
  // The Lobby rail's news square is the same violet.
  await page.evaluate(() => {
    const r = document.querySelector<HTMLElement>('[data-badge-for="raids"]')!;
    r.hidden = false;
    r.classList.add("is-new");
  });
  expect(
    await rgb(page, '[data-badge-for="raids"]', "background-color"),
  ).toEqual(news);
  // "You" is a highlight, not news.
  expect(await rgb(page, "#p-you", "background-color")).not.toEqual(news);
  // Who is here: the presence dot's green; who isn't: no green.
  const online = await token(page, "--st-online");
  expect(await rgb(page, "#p-on", "border-left-color")).toEqual(online);
  expect(await rgb(page, "#p-off", "border-left-color")).not.toEqual(online);
});

test("a Lobby card's progress is ink on its cream, not red", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  await openLobby(page);
  await skipTour(page).catch(() => {});
  const bar = page.locator(".lobby-layer .lobby-card progress").first();
  await expect(bar).toBeVisible();
  // Full, so the whole bar is its fill.
  await bar.evaluate((p: HTMLProgressElement) => (p.value = p.max));
  const box = (await bar.boundingBox())!;
  const shot = await page.screenshot({
    clip: {
      x: box.x + box.width / 2 - 2,
      y: box.y + box.height / 2 - 1,
      width: 4,
      height: 2,
    },
  });
  const fill = await page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const g = document.createElement("canvas").getContext("2d")!;
    g.canvas.width = img.width;
    g.canvas.height = img.height;
    g.drawImage(img, 0, 0);
    return [...g.getImageData(1, 0, 1, 1).data.slice(0, 3)];
  }, shot.toString("base64"));
  const ink = await token(page, "--ink");
  for (let i = 0; i < 3; i++)
    expect(Math.abs(fill[i] - ink[i]), `channel ${i}`).toBeLessThanOrEqual(8);
});

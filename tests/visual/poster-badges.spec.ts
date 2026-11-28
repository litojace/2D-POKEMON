import { expect, test, type Page } from "@playwright/test";
import { box, openLobby, skipTour } from "./helpers";
import { onPlayersLook } from "./players-look";

// Every notification indicator in the Plaza's shape (owner, 28 Nov 2026):
// themes/poster/badges.css. Counts and dots are red squares with an ink
// edge and a hard shadow; news is a violet square with a white ✦.
onPlayersLook();

/** Shows every kind on the Lobby (the fake server has nothing waiting). */
const showAll = (page: Page) =>
  page.evaluate(() => {
    const b = (id: string) =>
      document.querySelector<HTMLElement>(`[data-badge-for="${id}"]`)!;
    Object.assign(b("friends"), { hidden: false, textContent: "3" });
    const m = b("missions");
    Object.assign(m, { hidden: false, textContent: "" });
    m.classList.add("is-dot");
    const r = b("raids");
    Object.assign(r, { hidden: false, textContent: "" });
    r.classList.add("is-new");
    const c = document.querySelector<HTMLElement>(".chat-unread")!;
    Object.assign(c, { hidden: false, textContent: "2" });
  });

const look = (page: Page, selector: string) =>
  page.evaluate((selector) => {
    const el = document.querySelector(selector)!;
    const cs = getComputedStyle(el);
    const before = getComputedStyle(el, "::before");
    const g = document.createElement("canvas").getContext("2d")!;
    const rgb = (c: string) => {
      g.fillStyle = c;
      g.fillRect(0, 0, 1, 1);
      return [...g.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    return {
      radius: cs.borderTopLeftRadius,
      bg: rgb(cs.backgroundColor),
      image: cs.backgroundImage,
      shadow: cs.boxShadow,
      mark: before.maskImage,
    };
  }, selector);

for (const size of [
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "1440x900", width: 1440, height: 900, phone: false },
])
  test(`indicators are the Plaza's squares at ${size.name}`, async ({
    browser,
  }) => {
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    const page = await context.newPage();
    await openLobby(page);
    await skipTour(page).catch(() => {});
    await showAll(page);
    const [hot] = await page.evaluate(() => {
      const g = document.createElement("canvas").getContext("2d")!;
      const i = document.createElement("i");
      i.style.color = "var(--hot-fill)";
      document.body.append(i);
      g.fillStyle = getComputedStyle(i).color;
      g.fillRect(0, 0, 1, 1);
      return [[...g.getImageData(0, 0, 1, 1).data.slice(0, 3)]];
    });
    for (const selector of [
      '[data-badge-for="friends"]',
      '[data-badge-for="missions"]',
      ".chat-unread",
    ]) {
      const s = await look(page, selector);
      expect(s.radius, selector).toBe("0px");
      expect(s.bg, selector).toEqual(hot);
      expect(s.image, selector).toBe("none"); // no gloss
      expect(s.shadow, selector).toContain("1.5px"); // the ink edge
    }
    const news = await look(page, '[data-badge-for="raids"]');
    expect(news.radius).toBe("0px");
    expect(news.bg).not.toEqual(hot);
    expect(news.image).toBe("none"); // no glow gradient
    expect(news.shadow).not.toMatch(/10px/); // no soft glow
    expect(news.mark).toContain("svg"); // the ✦, not colour alone
    if (!size.phone) {
      // Beside the words on a desktop: the count stays clear of its word.
      const count = await box(page, '[data-badge-for="friends"]');
      const word = await box(
        page,
        '.lobby-rail [data-lobby-action="friends"] > span',
      );
      expect(count.x + count.width).toBeLessThanOrEqual(word.x);
    }
    await context.close();
  });

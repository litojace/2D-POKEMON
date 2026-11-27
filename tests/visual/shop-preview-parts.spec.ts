import { expect, test, type Page } from "@playwright/test";
import { openHub, snap } from "./helpers";
import { exposeAccount, shopServer } from "./shop-server";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// Owner's report (iPhone, 956×440 at 3×, Shop → Skins → Legendary): in the
// big fitting-room preview, Tidefin's Tide Admiral wore its bicorne floating
// above the head and its coat badge low on the body, while the catalogue
// cards (still art) showed it right. Costume skins crop some parts (body,
// scarf, wings, head-top, weapon arm) in a wider box than the champion's own,
// so their texture's pivot sits at another fraction of it; the live rig kept
// the default part's fractions when it put a costume texture on, which moved
// each of those parts by tens of art units.
//
// This compares the live rig's drawn pixels with the still artwork the stage
// holds under it (the same drawing the cards use, framed by the same camera
// box): on the same frame, the hat, the head and the coat must land where the
// still art has them. A wrongly anchored part moves the top of the ink (a
// hat lifted off the head) and the overlap of the two silhouettes.

const IPHONE_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148";

/** Costume skins of several collections and champions, and a plain control. */
const SKINS: [champion: string, skin: string][] = [
  ["tidefin", "tidefin-sky-pirates"],
  ["voltkit", "voltkit-nova-vanguard"],
  ["mystowl", "mystowl-sky-pirates"],
  ["terradon", "terradon-hon-viet"],
  ["auralynx", "auralynx-stars-stripes"],
  ["cindrake", "cindrake-hero-squad"],
  ["lumoth", "lumoth-neon-campus"],
  // Not a costume: its parts always used the default crops.
  ["tidefin", "tidefin-abyssal-expedition"],
];

interface Fit {
  /** Share of the two silhouettes' union that both cover. */
  overlap: number;
  /** Top of the ink in the middle third, live rig minus still art (css px). */
  topShift: number;
  /** The same for the bottom of the ink. */
  bottomShift: number;
  stillTop: number;
  liveTop: number;
}

/** Live canvas ink against the still art's, in canvas pixels. */
async function compare(page: Page): Promise<Fit> {
  return page.evaluate(async () => {
    const stage = document.querySelector<HTMLElement>(
      ".fit-stage .shop-live-stage",
    )!;
    const canvas = stage.querySelector<HTMLCanvasElement>(":scope > canvas")!;
    const svg = stage.querySelector<SVGSVGElement>(
      ".shop-preview-fallback > svg",
    )!;
    const { width, height } = canvas;
    const box = canvas.getBoundingClientRect();
    const k = width / box.width;
    const live = canvas
      .getContext("2d")!
      .getImageData(0, 0, width, height).data;
    // The still art, drawn where it is shown, at the canvas's resolution.
    const shown = svg.getBoundingClientRect();
    const copy = svg.cloneNode(true) as SVGSVGElement;
    copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    copy.setAttribute("width", String(shown.width * k));
    copy.setAttribute("height", String(shown.height * k));
    copy.removeAttribute("style");
    copy.removeAttribute("class");
    const image = new Image();
    image.src =
      "data:image/svg+xml;charset=utf-8," +
      encodeURIComponent(new XMLSerializer().serializeToString(copy));
    await image.decode();
    const art = document.createElement("canvas");
    art.width = width;
    art.height = height;
    const context = art.getContext("2d")!;
    context.drawImage(
      image,
      (shown.left - box.left) * k,
      (shown.top - box.top) * k,
    );
    const still = context.getImageData(0, 0, width, height).data;
    let both = 0,
      either = 0;
    const x0 = Math.floor(width / 3),
      x1 = Math.ceil((2 * width) / 3);
    const extent = (data: Uint8ClampedArray) => {
      let top = -1,
        bottom = -1;
      for (let y = 0; y < height; y++) {
        let ink = 0;
        for (let x = x0; x < x1; x++)
          if (data[(y * width + x) * 4 + 3] > 60) ink++;
        if (ink >= 3) {
          if (top < 0) top = y;
          bottom = y;
        }
      }
      return { top, bottom };
    };
    for (let i = 3; i < live.length; i += 4) {
      const a = live[i] > 60,
        b = still[i] > 60;
      if (a && b) both++;
      if (a || b) either++;
    }
    const l = extent(live),
      s = extent(still);
    return {
      overlap: both / Math.max(1, either),
      topShift: (l.top - s.top) / k,
      bottomShift: (l.bottom - s.bottom) / k,
      stillTop: s.top / k,
      liveTop: l.top / k,
    };
  });
}

for (const graphics of ["high", "low"] as const) {
  test(`Shop preview wears costume parts where the still art has them (${graphics} graphics, iPhone 956x440)`, async ({
    browser,
  }, info) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({
      viewport: { width: 956, height: 440 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: IPHONE_UA,
      // A still fighter: the rig holds its rest pose, as the still art does.
      reducedMotion: "reduce",
    });
    try {
      const page = await context.newPage();
      await page.addInitScript((level) => {
        localStorage.setItem("ea-graphics", level);
      }, graphics);
      await exposeAccount(page);
      await shopServer(page, { balance: 20000 });
      const errors = await openHub(page);
      const stage = page.locator(".fit-stage .shop-live-stage");
      await page.evaluate(
        () => void (window as any).__account.showShop("skins"),
      );
      const results: Record<string, Fit> = {};
      for (const [champion, skin] of SKINS) {
        await page.click(`.fit-room [data-fit-fighter="${champion}"]`);
        await page.click(`.fit-room [data-ui-item="${skin}"]`);
        await expect(stage).toHaveAttribute("data-preview-skin", skin);
        const still = stage.locator(".shop-preview-fallback > svg").first();
        await expect(still).toBeAttached();
        if (graphics === "low") {
          // Low keeps the still artwork (the cards' drawing): no live rig.
          await expect(stage.locator(":scope > canvas")).toHaveCount(0);
          await expect(still).toBeVisible();
          await snap(page, info, `shop-parts-${graphics}-${skin}`);
          continue;
        }
        await expect(stage).toHaveClass(/is-ready/, { timeout: 60_000 });
        await expect(stage).not.toHaveAttribute("aria-busy", "true");
        await expect(stage.locator(":scope > canvas")).toBeVisible();
        // A frame of the newly worn look (the costume loads after the rig).
        await page.waitForTimeout(400);
        results[skin] = await compare(page);
        await snap(page, info, `shop-parts-${graphics}-${skin}`);
      }
      await info.attach("shop-parts.json", {
        body: JSON.stringify(results, null, 1),
        contentType: "application/json",
      });
      if (process.env.SHOP_PARTS_MEASURE) console.log(results);
      for (const [skin, fit] of Object.entries(results)) {
        const where = `${skin}: ${JSON.stringify(fit)}`;
        // The hat sits on the head: the top of the fighter is where the
        // still art's is (a lifted hat moved it 20+ px up on this phone).
        expect(Math.abs(fit.topShift), where).toBeLessThan(4);
        expect(Math.abs(fit.bottomShift), where).toBeLessThan(4);
        expect(fit.overlap, where).toBeGreaterThan(0.85);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

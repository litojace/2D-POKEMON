import { expect, test, type Page } from "@playwright/test";
import { resolve } from "node:path";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";
import { SPIRE_RING } from "../../packages/shared/src/spire-court";

// The floor number carved in the middle of the Spire's court
// (spire-court-art.ts paintNumber): its ink sits on the rune ring's centre,
// for one- and two-digit floors, in every zone's theme, and on every phone
// (the court is drawn in world space, so the camera only scales it: the
// number's offset on screen is its world offset times the zoom).
//
// It once sat a few pixels low: a fixed +4 nudge, and a "middle" baseline
// that centres the font's em box rather than the digits' ink (Georgia's
// old-style digits sit high or low in it, by a different amount per digit).

/** World px of slack: the carving's lip and groove are offset by design. */
const TOLERANCE = 1.5;
const ART = "/@fs" + resolve("apps/client/src/spire-court-art.ts");

/** The solid ink's box (alpha > 200) in a painted number piece, in world px. */
const INK = `(d, w, h, k, fx, fy) => {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      if (d[(y * w + x) * 4 + 3] > 200) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return {
    x: fx + (x0 + x1 + 1) / 2 / k,
    y: fy + (y0 + y1 + 1) / 2 / k,
    w: (x1 - x0 + 1) / k,
    h: (y1 - y0 + 1) / k,
  };
}`;

/**
 * The number's font is Georgia (iPhones and Macs: old-style digits that sit
 * low or high), else Times New Roman, else a serif. This machine has none
 * of them, so "Georgia" is also played by fonts of different shapes: the
 * number must be centred whatever the font's metrics.
 */
const FONTS = [
  { name: "default serif", local: "" },
  { name: "DejaVu Serif as Georgia", local: "DejaVu Serif Bold" },
  { name: "FreeSerif as Georgia", local: "FreeSerif Bold" },
  { name: "Liberation Serif as Georgia", local: "Liberation Serif Bold" },
];
const FLOORS = [
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9],
  ...[11, 12, 13, 14, 15, 16, 17, 18, 19],
  ...[21, 22, 23, 24, 25, 26, 27, 28, 29],
  ...[31, 32, 33, 34, 35, 36, 37, 38, 39],
  ...[41, 42, 43, 44, 45, 46, 47, 48, 49],
  ...[51, 52, 53, 54, 55, 56, 57, 58, 59],
  ...[61, 62, 63, 64, 65, 66, 67, 68, 69],
];

for (const font of FONTS)
  test(`the floor number is centred in its ring on every floor and zone (${font.name})`, async ({
    page,
  }) => {
    test.setTimeout(120_000);
    await openHub(page);
    const found = await page.evaluate(
      async ({ art, floors, ink, local }) => {
        if (local) {
          const face = new FontFace("Georgia", `local("${local}")`, {
            weight: "700",
          });
          await face.load();
          document.fonts.add(face);
        }
        const m = await import(/* @vite-ignore */ art);
        const measure = new Function(`return ${ink}`)();
        const k = 1.4;
        return floors.map((floor: number) => {
          const zone = Math.ceil(floor / 10);
          const kind = floor % 10 === 5 ? "elite" : "wave";
          const p = m
            .spireFloorPieces(zone, floor, kind, k)
            .find((q: { name: string }) => q.name === "number");
          const w = Math.ceil(p.w * k),
            h = Math.ceil(p.h * k);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const c = canvas.getContext("2d")!;
          c.setTransform(k, 0, 0, k, -p.x * k, -p.y * k);
          p.paint(c);
          const d = c.getImageData(0, 0, w, h).data;
          return { floor, frame: p, ...measure(d, w, h, k, p.x, p.y) };
        });
      },
      { art: ART, floors: FLOORS, ink: INK, local: font.local },
    );
    console.log(
      font.name,
      JSON.stringify(
        found.map((f) => ({
          floor: f.floor,
          dx: +(f.x - SPIRE_RING.x).toFixed(2),
          dy: +(f.y - SPIRE_RING.y).toFixed(2),
        })),
      ),
    );
    for (const f of found) {
      // The piece itself is centred on the ring (the rig places it as is).
      expect(f.frame.x + f.frame.w / 2).toBe(SPIRE_RING.x);
      expect(f.frame.y + f.frame.h / 2).toBe(SPIRE_RING.y);
      // A real number was painted, inside its piece.
      expect(f.w, `floor ${f.floor}`).toBeGreaterThan(20);
      expect(f.h, `floor ${f.floor}`).toBeGreaterThan(20);
      expect(f.w).toBeLessThan(f.frame.w);
      expect(f.h).toBeLessThan(f.frame.h);
      expect(
        Math.abs(f.x - SPIRE_RING.x),
        `floor ${f.floor} across`,
      ).toBeLessThanOrEqual(TOLERANCE);
      expect(
        Math.abs(f.y - SPIRE_RING.y),
        `floor ${f.floor} down`,
      ).toBeLessThanOrEqual(TOLERANCE);
    }
  });

/** Expose the battle's game (after the arena prewarm line in main.ts). */
async function hookGame(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text(),
      marker =
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__spireGame=gameInstance;" + marker),
    });
  });
}
/** Show every pushed snapshot `by` floors higher (zone 2's look for 11–19, …). */
async function raiseFloors(page: Page, by: number) {
  await page.evaluate((by) => {
    const w = window as any;
    w.__push = () => {
      const s = w.__snap,
        spire = s?.raid?.spire;
      w.__sock.fire(
        "state",
        spire
          ? {
              ...s,
              raid: {
                ...s.raid,
                spire: {
                  ...spire,
                  floor: spire.floor + by,
                  ceiling: (spire.ceiling ?? 0) + by,
                  ...(spire.zone === undefined
                    ? {}
                    : { zone: spire.zone + Math.round(by / 10) }),
                },
              },
            }
          : s,
      );
    };
  }, by);
}

const PHONES = [
  { name: "667x375", width: 667, height: 375 },
  { name: "844x390", width: 844, height: 390 },
  { name: "852x393", width: 852, height: 393 },
  { name: "932x430", width: 932, height: 430 },
  { name: "844x280", width: 844, height: 280 },
  { name: "ipad", width: 1180, height: 820 },
];
for (const size of PHONES)
  test(`the floor number sits on the ring's centre at ${size.name} (floors 7, 17, 47, 57 and 67)`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await hookGame(page);
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("spire", { stage: "playing", floor: 7 }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      for (const floor of [7, 17, 47, 57, 67]) {
        if (floor > 10) {
          // Zone 2's look for 17; zone 5's bright Light court for 47;
          // zone 6's dusky Fire court for 57; zone 7's storm court for 67.
          await raiseFloors(page, floor - 7);
          await page.evaluate(() => (window as any).__push());
        }
        await page.waitForFunction(
          (key) =>
            !!(window as any).__spireGame?.scene
              .getScene("arena")
              ?.children.list.some(
                (o: any) =>
                  o.name === "spire-number" &&
                  o.visible &&
                  o.texture?.key === key,
              ),
          `spire-court-${Math.ceil(floor / 10)}-${floor}`,
        );
        const got = await page.evaluate((ink) => {
          const scene = (window as any).__spireGame.scene.getScene("arena");
          const img = scene.children.list.find(
            (o: any) => o.name === "spire-number" && o.visible,
          );
          const f = img.frame;
          const src = img.texture.getSourceImage() as HTMLCanvasElement;
          const d = src
            .getContext("2d")!
            .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
          const k = 1 / img.scaleX;
          const measure = new Function(`return ${ink}`)();
          const cam = scene.cameras.main;
          return {
            key: img.texture.key,
            ...measure(d, f.cutWidth, f.cutHeight, k, img.x, img.y),
            frame: {
              x: img.x + img.displayWidth / 2,
              y: img.y + img.displayHeight / 2,
            },
            zoom: cam.zoom,
          };
        }, INK);
        console.log(size.name, floor, JSON.stringify(got));
        expect(got.key).toBe(`spire-court-${Math.ceil(floor / 10)}-${floor}`);
        // The image is placed on the ring (to the atlas's pixel).
        expect(Math.abs(got.frame.x - SPIRE_RING.x)).toBeLessThan(1);
        expect(Math.abs(got.frame.y - SPIRE_RING.y)).toBeLessThan(1);
        // Its ink is on the ring's centre: in world px, and on the screen.
        const dx = got.x - SPIRE_RING.x,
          dy = got.y - SPIRE_RING.y;
        expect(Math.abs(dx), "across (world px)").toBeLessThanOrEqual(
          TOLERANCE,
        );
        expect(Math.abs(dy), "down (world px)").toBeLessThanOrEqual(TOLERANCE);
        expect(Math.hypot(dx, dy) * got.zoom, "screen px").toBeLessThanOrEqual(
          2,
        );
        await snap(page, info, `spire-floor-number-${floor}-${size.name}`);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

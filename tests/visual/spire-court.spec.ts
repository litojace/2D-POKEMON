import { expect, test, type Browser, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";
import {
  SPIRE_STAIRS,
  spireCourtLayout,
} from "../../packages/shared/src/spire-court";
import { SPIRE_BUILT_TOP } from "../../packages/shared/src/spire";
import { somnaraPads } from "../../packages/shared/src/raid-somnara";
import { ASCENDANT_SNOOZAKU } from "../../packages/shared/src/raid-ascendant";
import { PRISMATAIL } from "../../packages/shared/src/raid-prismatail";
import { EMBERWING } from "../../packages/shared/src/raid-emberwing";
import { STORM_TWINS } from "../../packages/shared/src/raid-storm-twins";

// The Spire's court (apps/client/src/spire-court-rig.ts): floors 1–9 on the
// stone platform at the top of the tower, their cover where the server's
// collision is (packages/shared/src/spire-court.ts), the sky darkening with
// height, the stairs lighting when a floor is cleared, and floor 10 on
// Cragmuff's court with the summit grade, switched in the same room with
// nothing loading mid-fight. Real climbs run on the page (harness/rooms.ts).
const DESKTOP = { name: "desktop", width: 1440, height: 900, phone: false };
const SIZES = [
  { ...DESKTOP, floors: [1, 5, 9, 10] },
  {
    name: "844x390",
    width: 844,
    height: 390,
    phone: true,
    floors: [1, 5, 9, 10],
  },
  {
    name: "667x375",
    width: 667,
    height: 375,
    phone: true,
    floors: [1, 5, 9, 10],
  },
  { name: "852x393", width: 852, height: 393, phone: true, floors: [1] },
  { name: "932x430", width: 932, height: 430, phone: true, floors: [9] },
  { name: "ipad", width: 1180, height: 820, phone: true, floors: [1, 10] },
];
const KINDS: Record<number, "wave" | "elite" | "boss"> = {
  1: "wave",
  5: "elite",
  9: "wave",
  10: "boss",
};

/**
 * A context whose raids show the whole court ("Whole court in raids"): these
 * checks read the court's art and every fighter on it. The floor tests below
 * keep the phone's follow camera.
 */
async function courtContext(
  browser: Browser,
  options: Parameters<Browser["newContext"]>[0],
) {
  const context = await browser.newContext(options);
  await context.addInitScript(() =>
    localStorage.setItem("arena-controls", JSON.stringify({ raidCourt: true })),
  );
  return context;
}

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
async function climb(page: Page, floor: number, ceiling?: number) {
  await page.evaluate(
    ({ floor, ceiling }) =>
      (window as any).__room("spire", { stage: "playing", floor, ceiling }),
    { floor, ceiling },
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
}
/** What the scene shows of the Spire's court, once its floor is drawn. */
async function court(page: Page) {
  // Floor 10's court is the Cragmuff picture: it may still be decoding a
  // moment after the battle opens, so wait for the floor itself.
  await page.waitForFunction(
    () =>
      !!(window as any).__spireGame?.scene.getScene("arena")?.floor?.texture,
  );
  return page.evaluate(() => {
    const scene = (window as any).__spireGame.scene.getScene("arena");
    const named = (prefix: string) =>
      scene.children.list.filter(
        (o: any) => o.name?.startsWith(prefix) && o.visible && o.active,
      );
    const box = (o: any) => ({
      x: o.x,
      y: o.y,
      w: o.displayWidth,
      h: o.displayHeight,
      depth: o.depth,
      frame: o.frame?.name,
    });
    const cam = scene.cameras.main;
    return {
      floor: scene.floor.texture.key as string,
      artwork: scene.floor.texture.getSourceImage().dataset?.raidArtwork as
        string | undefined,
      tint: scene.floor.tintTopLeft as number,
      blocks: named("spire-block").map(box),
      stairs: named("spire-stairs")
        .filter((o: any) => o.name === "spire-stairs")
        .map(box),
      number: named("spire-number").length,
      sky: named("spire-sky-").length,
      pillars: named("pillar-block").length,
      surround: scene.raidSurround.filter((o: any) => o.visible).length,
      view: {
        x: cam.worldView.x,
        y: cam.worldView.y,
        w: cam.worldView.width,
        h: cam.worldView.height,
        zoom: cam.zoom,
        width: scene.scale.width,
        height: scene.scale.height,
      },
    };
  });
}

for (const size of SIZES)
  for (const floor of size.floors)
    test(`the Spire court on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climb(page, floor);
        await page.waitForTimeout(600);
        const c = await court(page);
        // Desktop and tablets: the whole court is in view (the raid camera).
        // Phones follow the raider: the court covers the screen, never past
        // its edges (at most its full width: RAID_FOLLOW_ZOOM is 1).
        if (size.phone && size.height <= 600) {
          expect(c.view.w).toBeLessThanOrEqual(1600.5);
          expect(c.view.h).toBeLessThanOrEqual(900.5);
        } else {
          expect(c.view.w).toBeGreaterThanOrEqual(1599);
          expect(c.view.h).toBeGreaterThanOrEqual(899);
        }
        expect(
          Math.max(
            (1600 * c.view.zoom) / c.view.width,
            (900 * c.view.zoom) / c.view.height,
          ),
        ).toBeGreaterThan(0.8);
        // Round the court: the Spire's sky, not the raid's dimmed floor.
        expect(c.sky).toBe(4);
        expect(c.surround).toBe(0);
        if (KINDS[floor] === "boss") {
          // Floor 10: Cragmuff's court, with the summit grade and its pillars.
          await expect
            .poll(async () => (await court(page)).artwork)
            .toBe("spire-summit");
          // (A charge may already have broken one.)
          expect(c.pillars).toBeGreaterThanOrEqual(4);
          expect(c.blocks).toEqual([]);
          expect(c.stairs).toEqual([]);
        } else {
          expect(c.floor).toBe("arena-floor-spire-z1");
          expect(c.pillars).toBe(0);
          expect(c.number).toBe(1);
          // Each block's stone covers its solid footprint exactly where the
          // server collides, and sorts with the fighters by its front edge.
          const layout = spireCourtLayout(floor, KINDS[floor])!;
          expect(c.blocks).toHaveLength(layout.blocks.length);
          const shown = [...c.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
          const feet = [...layout.blocks].sort(
            (a, b) => a.x - b.x || a.y - b.y,
          );
          feet.forEach((o, i) => {
            const b = shown[i];
            expect(b.x).toBeLessThanOrEqual(o.x);
            expect(b.y).toBeLessThanOrEqual(o.y);
            expect(b.x + b.w).toBeGreaterThanOrEqual(o.x + o.w);
            expect(b.y + b.h).toBeGreaterThanOrEqual(o.y + o.h);
            // (Painted with only a small margin round it.)
            expect(b.w - o.w).toBeLessThan(40);
            expect(b.depth).toBeCloseTo(2 + (o.y + o.h) / 10000, 6);
          });
          expect(c.stairs).toHaveLength(1);
          expect(c.stairs[0].depth).toBeCloseTo(
            2 + (SPIRE_STAIRS.y + SPIRE_STAIRS.h) / 10000,
            6,
          );
          expect(c.stairs[0].frame).toBe("stairs");
          // Higher floors are in a cooler, dimmer light.
          if (floor === 1) expect(c.tint).toBe(0xffffff);
          else expect(c.tint).toBeLessThan(0xffffff);
        }
        await snap(page, info, `spire-court-floor-${floor}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

test("the stairs light when a floor is cleared, and the next floor is ready", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: DESKTOP.width, height: DESKTOP.height },
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const errors = await openHub(page);
    await climb(page, 1);
    expect((await court(page)).stairs[0].frame).toBe("stairs");
    // Beat every Echo of both waves.
    for (let i = 0; i < 12; i++) {
      const cleared = await page.evaluate(() => {
        const w = window as any,
          a = w.__spireArena;
        for (const p of a.players) if (p.echo) p.hp = 0;
        w.__spireStep(1.2);
        return w.__snap.raid.spire.clearedAt !== undefined;
      });
      if (cleared) break;
    }
    await expect
      .poll(async () => (await court(page)).stairs[0]?.frame)
      .toBe("stairs-lit");
    // Floor 2 is painted while the stairs are open (not when it starts).
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__spireGame.scene
            .getScene("arena")
            .textures.exists("spire-court-1-2"),
        ),
      )
      .toBe(true);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-stairs-lit-desktop");
    // On up: floor 2's court (Twin Walls), floor 1's pictures released.
    for (let i = 0; i < 10; i++) {
      const floor = await page.evaluate(() => {
        const w = window as any;
        w.__spireStep(1);
        return w.__snap.raid.spire.floor;
      });
      if (floor === 2) break;
    }
    await expect.poll(async () => (await court(page)).blocks.length).toBe(2);
    const after = await court(page);
    expect(after.stairs[0].frame).toBe("stairs");
    expect(
      await page.evaluate(() =>
        (window as any).__spireGame.scene
          .getScene("arena")
          .textures.exists("spire-court-1-1"),
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("floor 9 to floor 10 in the same room: the summit court, nothing loaded mid-climb", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 9;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    await climb(page, 9, 10);
    expect((await court(page)).floor).toBe("arena-floor-spire-z1");
    // Clear floor 9: the summit court is painted while its stairs are open.
    for (let i = 0; i < 14; i++) {
      const cleared = await page.evaluate(() => {
        const w = window as any,
          a = w.__spireArena;
        for (const p of a.players) if (p.echo) p.hp = 0;
        w.__spireStep(1.2);
        return w.__snap.raid.spire.clearedAt !== undefined;
      });
      if (cleared) break;
    }
    await expect
      .poll(() =>
        page.evaluate(() =>
          (window as any).__spireGame.scene
            .getScene("arena")
            .textures.exists("arena-floor-spire-summit"),
        ),
      )
      .toBe(true);
    // Up to floor 10 (its briefing, then the fight).
    for (let i = 0; i < 10; i++) {
      const floor = await page.evaluate(() => {
        const w = window as any;
        w.__spireStep(1);
        return w.__snap.raid.spire.floor;
      });
      if (floor === 10) break;
    }
    floorNow = 10;
    await expect
      .poll(async () => (await court(page)).artwork)
      .toBe("spire-summit");
    const top = await court(page);
    expect(top.blocks).toEqual([]);
    expect(top.pillars).toBeGreaterThanOrEqual(4);
    expect(top.sky).toBe(4);
    // Cragmuff's court picture was fetched before floor 10, never during it.
    expect(art.length).toBeGreaterThan(0);
    expect(art.every((a) => a.floor === 9)).toBe(true);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-floor-10-after-climb-844x390");
    // A new climb: back on the Spire's court.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 1, stage: "playing" });
      w.__push();
    });
    await expect
      .poll(async () => (await court(page)).floor)
      .toBe("arena-floor-spire-z1");
    expect((await court(page)).pillars).toBe(0);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the summit grade darkens Cragmuff's court", async ({ browser }) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: DESKTOP.width, height: DESKTOP.height },
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    let picture: string | undefined;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/")) picture = r.url();
    });
    await openHub(page);
    await climb(page, 10);
    await expect
      .poll(async () => (await court(page)).artwork)
      .toBe("spire-summit");
    // The baked court (test-side read-back only): dimmer and cooler than
    // the raid's own Coliseum picture.
    expect(picture).toContain("grumblecrag");
    const light = await page.evaluate(async (url) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const graded = scene.floor.texture.getSourceImage() as HTMLCanvasElement;
      // (The picture the game fetched.)
      const plain = await new Promise<HTMLImageElement>((done, fail) => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => fail(new Error(`could not load ${url}`));
        img.src = url;
      });
      const measure = (src: CanvasImageSource) => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(src, 0, 0, 160, 90);
        const d = ctx.getImageData(0, 0, 160, 90).data;
        let lum = 0,
          warm = 0;
        for (let i = 0; i < d.length; i += 4) {
          lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
          warm += d[i] - d[i + 2];
        }
        return { lum: lum / (d.length / 4), warm: warm / (d.length / 4) };
      };
      return { graded: measure(graded), plain: measure(plain) };
    }, picture!);
    expect(light.graded.lum).toBeLessThan(light.plain.lum * 0.8);
    expect(light.graded.warm).toBeLessThan(light.plain.warm * 0.7);
  } finally {
    await context.close();
  }
});

/**
 * Pixels of one piece in a floor's atlas (test-side read-back only):
 * luminance and warmth of its opaque pixels.
 */
function atlasPixels(page: Page, key: string, frame: string) {
  return page.evaluate(
    ({ key, frame }) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const tex = scene.textures.get(key);
      const f = tex.get(frame);
      const src = tex.getSourceImage() as HTMLCanvasElement;
      const d = src
        .getContext("2d")!
        .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
      const out: { lum: number; warm: number }[] = [];
      for (let i = 0; i < d.length; i += 4)
        if (d[i + 3] > 200)
          out.push({
            lum: 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2],
            warm: d[i] - d[i + 2],
          });
      return out;
    },
    { key, frame },
  );
}

test("high floors keep amber crystals and a readable floor number", async ({
  browser,
}, info) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const errors = await openHub(page);
    await climb(page, 9);
    // The height's dusk is on the floor only: the cover, the stairs and
    // the number are not tinted at run time (their stone is shaded when
    // painted, their crystals keep their own light).
    const tints = await page.evaluate(() => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      return scene.children.list
        .filter((o: any) => /^spire-(block|stairs$|number)/.test(o.name ?? ""))
        .map((o: any) => o.tintTopLeft);
    });

    // Floor 9's crystals: bright, warm amber pixels.
    const crystal = await atlasPixels(page, "spire-court-1-9", "block0");
    const amber = crystal.filter((p) => p.lum > 170 && p.warm > 90).length;
    // The number: a dark groove round a bright inlay (a fair share of each).
    const number = (await atlasPixels(page, "spire-court-1-9", "number")).map(
      (p) => p.lum,
    );
    const dark = number.filter((l) => l < 70).length / number.length,
      bright = number.filter((l) => l > 190).length / number.length;
    console.log(
      JSON.stringify({ amber: amber / crystal.length, dark, bright }),
    );
    expect(amber / crystal.length).toBeGreaterThan(0.08);
    expect(dark).toBeGreaterThan(0.15);
    expect(bright).toBeGreaterThan(0.25);
    expect(tints.length).toBeGreaterThan(4);
    expect(tints.every((t: number) => t === 0xffffff)).toBe(true);
    await snap(page, info, "spire-court-floor-9-crystals-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// ───────────────────────── Zone 2: Water ─────────────────────────
//
// Floors 11–19 take zone 2's Water look (spireZoneTheme(2)): sea-glass
// marble, aquamarine crystal, water channels and tide pools, the sea far
// below. Test-only path: the rooms harness only builds zone 1's floors
// (harness/rooms.ts is the floor flow's), so a zone-1 climb runs on the
// page and each snapshot is shown ten floors higher (same place in the
// zone, so the same layout): the client reads floor 11–19, zone 2.

/** Show every pushed snapshot `by` floors higher (a copy: the room is untouched). */
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
                  // The climb's zone (the snapshot names it), raised too.
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
const ZONE2_SIZES = [
  { ...DESKTOP, floors: [11, 15, 19] },
  {
    name: "844x390",
    width: 844,
    height: 390,
    phone: true,
    floors: [11, 15, 19],
  },
  {
    name: "667x375",
    width: 667,
    height: 375,
    phone: true,
    floors: [11, 15, 19],
  },
  { name: "ipad", width: 1180, height: 820, phone: true, floors: [11, 15, 19] },
];
for (const size of ZONE2_SIZES)
  for (const floor of size.floors)
    test(`zone 2: the Spire court on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await raiseFloors(page, 10);
        await climb(page, floor - 10);
        await page.waitForTimeout(600);
        const c = await court(page);
        const kind = floor === 15 ? "elite" : "wave";
        // Zone 2's platform floor and its own floor atlas.
        expect(c.floor).toBe("arena-floor-spire-z2");
        expect(
          await page.evaluate(
            (key) =>
              (window as any).__spireGame.scene
                .getScene("arena")
                .textures.exists(key),
            `spire-court-2-${floor}`,
          ),
        ).toBe(true);
        expect(c.sky).toBe(4);
        expect(c.surround).toBe(0);
        expect(c.pillars).toBe(0);
        expect(c.number).toBe(1);
        // The same cover as the zone's place (floor 13 like floor 3), on
        // the server's footprints.
        const layout = spireCourtLayout(floor, kind)!;
        expect(c.blocks).toHaveLength(layout.blocks.length);
        const shown = [...c.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        const feet = [...layout.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        feet.forEach((o, i) => {
          expect(shown[i].x).toBeLessThanOrEqual(o.x);
          expect(shown[i].x + shown[i].w).toBeGreaterThanOrEqual(o.x + o.w);
          expect(shown[i].depth).toBeCloseTo(2 + (o.y + o.h) / 10000, 6);
        });
        expect(c.stairs).toHaveLength(1);
        // Height: the zone's first floor in full light, higher ones bluer.
        if (floor === 11) expect(c.tint).toBe(0xffffff);
        else {
          expect(c.tint).toBeLessThan(0xffffff);
          expect(c.tint & 255).toBeGreaterThan(c.tint >> 16);
        }
        await snap(page, info, `spire-court-z2-floor-${floor}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  for (const floor of [11, 19])
    test(`zone 2: aquamarine crystals and a readable floor number on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await raiseFloors(page, 10);
        await climb(page, floor - 10);
        await page.waitForTimeout(400);
        const key = `spire-court-2-${floor}`;
        // The floor's atlas is painted once the court is up (on a busy
        // machine, after the fixed wait above).
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          key,
        );
        // The cover's crystals: bright aquamarine pixels (blue-green).
        const crystal = await atlasPixels(page, key, "block0");
        const sea = await page.evaluate(
          ({ key }) => {
            const scene = (window as any).__spireGame.scene.getScene("arena");
            const tex = scene.textures.get(key);
            const f = tex.get("block0");
            const d = (tex.getSourceImage() as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
            let n = 0,
              teal = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] <= 200) continue;
              n++;
              const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
              if (lum > 150 && d[i + 1] - d[i] > 60 && d[i + 2] - d[i] > 50)
                teal++;
            }
            return teal / n;
          },
          { key },
        );
        // The number: a dark groove round a bright inlay.
        const number = (await atlasPixels(page, key, "number")).map(
          (p) => p.lum,
        );
        const dark = number.filter((l) => l < 70).length / number.length,
          bright = number.filter((l) => l > 190).length / number.length;
        // The block's stone stands out from the floor round it (it is
        // paler, or darker on the dusk floors: never the same).
        console.log(
          JSON.stringify({ teal: sea, dark, bright, n: crystal.length }),
        );
        expect(sea).toBeGreaterThan(0.08);
        expect(dark).toBeGreaterThan(0.15);
        expect(bright).toBeGreaterThan(0.25);
        await snap(
          page,
          info,
          `spire-court-z2-floor-${floor}-crystals-${size.name}`,
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

test("floor 20: the lagoon's summit grade, painted on floor 19, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 19;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    // Test-only path (the rooms harness has no floor 20 yet): Tidelotl's
    // raid room, carrying a climb's state from a real Spire room, shown as
    // floor 19 cleared (the party may climb to 20), then as floor 20.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 9, ceiling: 10 });
      const climb = JSON.parse(JSON.stringify(w.__snap.raid.spire));
      w.__room("raid", { boss: "tidewyrm" });
      w.__snap.remaining = 300;
      w.__snap.raid.spire = {
        ...climb,
        zone: 2,
        floor: 19,
        kind: "wave",
        ceiling: 20,
        clearedAt: w.__snap.raid.time ?? 1,
      };
    });
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor.texture.key as string,
          artwork: s.floor.texture.getSourceImage().dataset?.raidArtwork as
            string | undefined,
          summit: s.textures.exists("arena-floor-spire-summit-lagoon"),
          summitArt: s.textures.exists("arena-floor-spire-summit-lagoon:art"),
        };
      });
    expect((await scene()).floor).toBe("arena-floor-spire-z2");
    // Floor 19's stairs are open: the lagoon summit is painted now.
    await expect.poll(async () => (await scene()).summitArt).toBe(true);
    // Up to floor 20: Tidelotl's lagoon with the summit grade.
    floorNow = 20;
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.spire = {
        ...w.__snap.raid.spire,
        floor: 20,
        kind: "boss",
        clearedAt: undefined,
      };
      w.__push();
    });
    await expect
      .poll(async () => (await scene()).artwork)
      .toBe("spire-summit-lagoon");
    // The lagoon's picture was fetched on floor 19 (or before), never on 20.
    expect(art.some((a) => a.url.includes("tidewyrm"))).toBe(true);
    expect(art.every((a) => a.floor === 19)).toBe(true);
    const c = await court(page);
    expect(c.sky).toBe(4);
    expect(c.blocks).toEqual([]);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-floor-20-lagoon-summit-844x390");
    // Graded (test-side read-back only): darker and cooler than the
    // lagoon picture the game fetched.
    // (The picture itself, not the module that names it.)
    const url = art.findLast(
      (a) => a.url.includes("tidewyrm") && !a.url.includes("?import"),
    )!.url;
    const light = await page.evaluate(async (url) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const graded = scene.floor.texture.getSourceImage() as HTMLCanvasElement;
      const plain = await new Promise<HTMLImageElement>((done, fail) => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => fail(new Error(`could not load ${url}`));
        img.src = url;
      });
      const measure = (src: CanvasImageSource) => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(src, 0, 0, 160, 90);
        const d = ctx.getImageData(0, 0, 160, 90).data;
        let lum = 0,
          cool = 0;
        for (let i = 0; i < d.length; i += 4) {
          lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
          cool += d[i + 2] - d[i];
        }
        return { lum: lum / (d.length / 4), cool: cool / (d.length / 4) };
      };
      return { graded: measure(graded), plain: measure(plain) };
    }, url);
    console.log(JSON.stringify(light));
    expect(light.graded.lum).toBeLessThan(light.plain.lum * 0.75);
    // Cooler: blue leads red by more (relative to how bright it is).
    expect(light.graded.cool / light.graded.lum).toBeGreaterThan(
      light.plain.cool / light.plain.lum,
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// ───────────────────────── Zone 3: Shadow ─────────────────────────
//
// Floors 21–29 take zone 3's Shadow look (spireZoneTheme(3)): dark slate,
// lantern-lit pools, violet ink veins, lanterns and candles on the cover, a
// night sky with ink clouds. Same test-only path as zone 2: a zone-1 climb
// runs on the page and each snapshot is shown twenty floors higher (floor
// and the snapshot's zone, 1 → 3). A dark court makes the fighters the main
// risk, so their contrast with the floor is measured, as well as the
// crystals, the floor number and the Echoes' rings.
const SHOTS = process.env.ZONE3_SHOTS;
/** Where the zone-3 readability check stands its Echoes (feet, world px). */
// (Clear of the cover on every layout, and of a phone's touch buttons.)
const ZONE3_SPOTS = [
  [900, 700], // dark slate, below the ring
  [230, 190], // the top-left corner's lantern pool
  [600, 790], // dark slate, near the bottom coping
  [1180, 170], // under the top-right lanterns
];
const ZONE3_SIZES = [
  { ...DESKTOP, floors: [21, 25, 29] },
  {
    name: "844x390",
    width: 844,
    height: 390,
    phone: true,
    floors: [21, 25, 29],
  },
  {
    name: "667x375",
    width: 667,
    height: 375,
    phone: true,
    floors: [21, 25, 29],
  },
  { name: "ipad", width: 1180, height: 820, phone: true, floors: [21, 25, 29] },
];
async function shot(page: Page, name: string) {
  if (SHOTS) await page.screenshot({ path: `${SHOTS}/${name}.png` });
}
for (const size of ZONE3_SIZES)
  for (const floor of size.floors)
    test(`zone 3: the Spire court on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await raiseFloors(page, 20);
        await climb(page, floor - 20);
        await page.waitForTimeout(600);
        const c = await court(page);
        const kind = floor === 25 ? "elite" : "wave";
        // Zone 3's platform floor and its own floor atlas.
        expect(c.floor).toBe("arena-floor-spire-z3");
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          `spire-court-3-${floor}`,
        );
        expect(c.sky).toBe(4);
        expect(c.surround).toBe(0);
        expect(c.pillars).toBe(0);
        expect(c.number).toBe(1);
        const layout = spireCourtLayout(floor, kind)!;
        expect(c.blocks).toHaveLength(layout.blocks.length);
        const shown = [...c.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        const feet = [...layout.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        feet.forEach((o, i) => {
          expect(shown[i].x).toBeLessThanOrEqual(o.x);
          expect(shown[i].x + shown[i].w).toBeGreaterThanOrEqual(o.x + o.w);
          expect(shown[i].depth).toBeCloseTo(2 + (o.y + o.h) / 10000, 6);
        });
        expect(c.stairs).toHaveLength(1);
        // Height: the zone's first floor untinted, higher ones a cool dusk.
        if (floor === 21) expect(c.tint).toBe(0xffffff);
        else {
          expect(c.tint).toBeLessThan(0xffffff);
          expect(c.tint & 255).toBeGreaterThan(c.tint >> 16);
        }
        await page.waitForTimeout(300);
        await snap(page, info, `spire-court-z3-floor-${floor}-${size.name}`);
        await shot(page, `z3-floor-${floor}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/** Relative luminance (WCAG) of an sRGB colour, and the contrast of two. */
const relLum = ([r, g, b]: number[]) => {
  const f = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (a: number[], b: number[]) => {
  const [hi, lo] = [relLum(a), relLum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};
const hex = (n: number) => [n >> 16, (n >> 8) & 255, n & 255];

/**
 * How the fighters stand out from the court (test-side read-back only).
 * With the scene paused, three frames: everything; the fighters hidden;
 * only the fighters over a magenta clear. The third gives each fighter's
 * exact pixels (no bias toward pixels that differ), the first two its
 * colour and the court's under it. Per fighter: the share of its pixels
 * whose luminance differs from the court's by 30 or more, and the
 * luminance contrast of its mean colour against the court's.
 */
async function fighterContrast(page: Page) {
  return page.evaluate(async () => {
    const game = (window as any).__spireGame;
    const scene = game.scene.getScene("arena");
    const cam = scene.cameras.main;
    const rigs = [...scene.rigs.entries()]
      .map(([id, r]: [string, any]) => ({ id, root: r.root }))
      .filter((r: any) => r.root?.visible);
    const grab = () =>
      new Promise<Uint8ClampedArray>((done) =>
        game.renderer.snapshot((img: HTMLImageElement) => {
          const c = document.createElement("canvas");
          c.width = img.width;
          c.height = img.height;
          const ctx = c.getContext("2d")!;
          ctx.drawImage(img, 0, 0);
          done(ctx.getImageData(0, 0, c.width, c.height).data);
        }),
      );
    const frames = (n: number) =>
      new Promise<void>((done) => {
        const step = () => (n-- <= 0 ? done() : requestAnimationFrame(step));
        step();
      });
    scene.scene.pause();
    await frames(3);
    const all = await grab();
    for (const r of rigs) r.root.setVisible(false);
    await frames(3);
    const bare = await grab();
    const before = scene.children.list.map((o: any) => o.visible);
    const roots = new Set(rigs.map((r: any) => r.root));
    scene.children.list.forEach((o: any) => o.setVisible?.(roots.has(o)));
    for (const r of rigs) r.root.setVisible(true);
    const bg = cam.backgroundColor.color;
    cam.setBackgroundColor(0xff00ff);
    await frames(3);
    const only = await grab();
    cam.setBackgroundColor(bg);
    scene.children.list.forEach((o: any, i: number) =>
      o.setVisible?.(before[i]),
    );
    for (const r of rigs) r.root.setVisible(true);
    scene.scene.resume();
    const W = game.canvas.width,
      H = game.canvas.height,
      sx = W / scene.scale.width;
    const lum = (d: Uint8ClampedArray, i: number) =>
      0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
    return rigs.map((r: any) => {
      const b = r.root.getBounds();
      const x0 = Math.max(
          0,
          Math.floor((b.x - cam.worldView.x) * cam.zoom * sx),
        ),
        y0 = Math.max(0, Math.floor((b.y - cam.worldView.y) * cam.zoom * sx)),
        x1 = Math.min(
          W,
          Math.ceil((b.right - cam.worldView.x) * cam.zoom * sx),
        ),
        y1 = Math.min(
          H,
          Math.ceil((b.bottom - cam.worldView.y) * cam.zoom * sx),
        );
      let n = 0,
        seen = 0;
      const mf = [0, 0, 0],
        mb = [0, 0, 0];
      for (let y = y0; y < y1; y++)
        for (let x = x0; x < x1; x++) {
          const i = (y * W + x) * 4;
          // Fighter pixel: not the magenta clear in the fighters-only frame.
          if (
            Math.abs(only[i] - 255) < 40 &&
            only[i + 1] < 40 &&
            Math.abs(only[i + 2] - 255) < 40
          )
            continue;
          n++;
          if (Math.abs(lum(all, i) - lum(bare, i)) >= 30) seen++;
          for (let k = 0; k < 3; k++) {
            mf[k] += all[i + k];
            mb[k] += bare[i + k];
          }
        }
      return {
        id: r.id as string,
        n,
        seen: n ? seen / n : 0,
        fighter: mf.map((v) => (n ? v / n : 0)),
        court: mb.map((v) => (n ? v / n : 0)),
      };
    });
  });
}
/** The court floor's mean colour where fighters walk (the middle), tinted. */
async function floorColour(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__spireGame.scene.getScene("arena");
    const src = scene.floor.texture.getSourceImage() as HTMLCanvasElement;
    const c = document.createElement("canvas");
    c.width = 160;
    c.height = 90;
    const ctx = c.getContext("2d")!;
    ctx.drawImage(src, 0, 0, 160, 90);
    // The walkable middle, inside the coping.
    const d = ctx.getImageData(8, 6, 144, 78).data;
    const m = [0, 0, 0];
    for (let i = 0; i < d.length; i += 4)
      for (let k = 0; k < 3; k++) m[k] += d[i + k];
    const tint = scene.floor.tintTopLeft as number;
    const t = [tint >> 16, (tint >> 8) & 255, tint & 255];
    return m.map((v, k) => ((v / (d.length / 4)) * t[k]) / 255);
  });
}

for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  for (const floor of [21, 25, 29])
    test(`zone 3: fighters, Echo rings, crystals and the floor number read on the dark court, floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        // A real zone-3 room (harness/rooms.ts): its own Shadow Echoes.
        await climb(page, floor);
        await page.waitForTimeout(400);
        const key = `spire-court-3-${floor}`;
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          key,
        );
        // The cover's crystals: bright candle-gold pixels.
        const crystal = await atlasPixels(page, key, "block0");
        const gold =
          crystal.filter((p) => p.lum > 170 && p.warm > 60).length /
          crystal.length;
        // The number: a dark groove round a bright inlay.
        const number = (await atlasPixels(page, key, "number")).map(
          (p) => p.lum,
        );
        const dark = number.filter((l) => l < 70).length / number.length,
          bright = number.filter((l) => l > 190).length / number.length;
        const inlay =
          number.filter((l) => l > 190).reduce((a, b) => a + b, 0) /
          Math.max(1, number.filter((l) => l > 190).length);
        // The floor where fighters walk: dark, but not black; the Echoes'
        // rings (lavender, red), the hero's white ring and the inlay stand
        // well clear of it.
        const ground = await floorColour(page);
        const groundLum = 0.3 * ground[0] + 0.59 * ground[1] + 0.11 * ground[2];
        const rings = {
          echo: contrast(hex(0xa98bff), ground),
          enemy: contrast(hex(0xff5d6c), ground),
          hero: contrast([255, 255, 255], ground),
          inlay: contrast([inlay, inlay, inlay], ground),
        };
        // The fighters themselves (the hero and the Echoes, once in).
        await page
          .waitForFunction(
            () =>
              [
                ...(window as any).__spireGame.scene
                  .getScene("arena")
                  .rigs.entries(),
              ].some(
                ([id, r]: [string, any]) =>
                  id.startsWith("echo") && r.root?.visible,
              ),
            undefined,
            { timeout: 15_000 },
          )
          .catch(() => {});
        // Everyone at fixed spots (not wherever the fight took them), the
        // Echoes alternating between the dark slate and the lantern pools,
        // the first (floor 25's captain) on the slate: the same picture on
        // every run.
        await page.evaluate((spots) => {
          const w = window as any;
          const a = w.__spireArena;
          const place = (p: any, [x, y]: number[]) =>
            Object.assign(p, { x, y, vx: 0, vy: 0, angle: Math.PI / 2 });
          place(a.heroes()[0], [380, 470]);
          a.players
            .filter((p: any) => p.echo && p.hp > 0)
            .forEach((p: any, i: number) => place(p, spots[i % spots.length]));
          w.__spireStep(0);
        }, ZONE3_SPOTS);
        await page.waitForTimeout(900);
        const fighters = await fighterContrast(page);
        const shown = fighters.filter((f) => f.n > 60);
        const summary = shown.map((f) => ({
          id: f.id.slice(0, 10),
          n: f.n,
          seen: +f.seen.toFixed(3),
          contrast: +contrast(f.fighter, f.court).toFixed(2),
          fighterLum: Math.round(
            0.3 * f.fighter[0] + 0.59 * f.fighter[1] + 0.11 * f.fighter[2],
          ),
          courtLum: Math.round(
            0.3 * f.court[0] + 0.59 * f.court[1] + 0.11 * f.court[2],
          ),
        }));
        console.log(
          JSON.stringify({
            floor,
            size: size.name,
            gold: +gold.toFixed(3),
            dark: +dark.toFixed(3),
            bright: +bright.toFixed(3),
            inlay: Math.round(inlay),
            groundLum: Math.round(groundLum),
            rings: Object.fromEntries(
              Object.entries(rings).map(([k, v]) => [k, +v.toFixed(2)]),
            ),
            fighters: summary,
          }),
        );
        await shot(page, `z3-floor-${floor}-read-${size.name}`);
        expect(gold).toBeGreaterThan(0.08);
        expect(dark).toBeGreaterThan(0.15);
        expect(bright).toBeGreaterThan(0.25);
        expect(inlay).toBeGreaterThan(200);
        // Dark, not black: fighters' dark outlines still have a floor to
        // stand on.
        expect(groundLum).toBeGreaterThan(45);
        expect(groundLum).toBeLessThan(120);
        expect(rings.echo).toBeGreaterThan(3);
        expect(rings.enemy).toBeGreaterThan(2.5);
        expect(rings.hero).toBeGreaterThan(7);
        expect(rings.inlay).toBeGreaterThan(6);
        // Every fighter in view stands out: most of its pixels differ
        // clearly from the court under them.
        // (Measured the same way on zone 1's floor 9, its Echoes are 0.71,
        // 0.83 and 0.50 and the hero 0.71; on zone 2's floor 19, 0.93, 0.91,
        // 0.70 and 0.75. Zone 3's own Shadow Echoes at these spots, with the
        // pale tint alone: 0.35–0.63, floor 25's Echo Captain Duskveil the
        // worst; with the pale wash over them (spireEchoTint): 0.74–0.99.)
        expect(shown.length).toBeGreaterThanOrEqual(2);
        const echoes = summary.filter((f) => f.id.startsWith("echo"));
        expect(echoes.length).toBeGreaterThanOrEqual(1);
        for (const f of echoes) expect(f.seen).toBeGreaterThan(0.58);
        expect(
          echoes.reduce((a, f) => a + f.seen, 0) / echoes.length,
        ).toBeGreaterThan(0.6);
        for (const f of summary)
          if (!f.id.startsWith("echo")) {
            expect(f.seen).toBeGreaterThan(0.65);
            expect(f.contrast).toBeGreaterThan(2);
          }
        await snap(
          page,
          info,
          `spire-court-z3-floor-${floor}-read-${size.name}`,
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });
test("floor 30: Inkpurr's Lantern Yard with its summit grade, painted on floor 29, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 29;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    // A real zone-3 room (harness/rooms.ts), on floor 29 with floor 30 open.
    await climb(page, 29, 30);
    // The arena paints its floor a frame or two after the room arrives.
    await page.waitForFunction(
      () =>
        !!(window as any).__spireGame?.scene.getScene("arena")?.floor?.texture,
    );
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        const t = s.floor?.texture;
        return {
          floor: t?.key as string,
          artwork: t?.getSourceImage().dataset?.raidArtwork as
            string | undefined,
          floors: (s.textures.getTextureKeys() as string[]).filter((k) =>
            k.startsWith("arena-floor-"),
          ),
        };
      });
    await expect
      .poll(async () => (await scene()).floor)
      .toBe("arena-floor-spire-z3");
    // Beat floor 29: its stairs open.
    for (let i = 0; i < 12; i++) {
      const cleared = await page.evaluate(() => {
        const w = window as any;
        for (const p of w.__spireArena.players) if (p.echo) p.hp = 0;
        w.__spireStep(1.8);
        return w.__snap.raid.spire.clearedAt !== undefined;
      });
      if (cleared) break;
    }
    // While they are open, floor 30's court (the yard with its summit
    // grade) is painted.
    await expect
      .poll(async () => (await scene()).floors)
      .toContain("arena-floor-spire-summit-yard:art");
    const ready = (await scene()).floors;
    await shot(page, "z3-floor-29-stairs-open-844x390");
    // Up to floor 30: the Ascendant Inkpurr's briefing, in its yard.
    floorNow = 30;
    await page.evaluate(() => (window as any).__spireStep(3));
    await expect
      .poll(() => page.evaluate(() => (window as any).__snap.raid.spire.floor))
      .toBe(30);
    await expect
      .poll(async () => (await scene()).artwork)
      .toBe("spire-summit-yard");
    const thirty = await scene();
    expect(thirty.floor).toMatch(/^arena-floor-spire-summit-yard(:art)?$/);
    // The court it shows was ready before the stairs were climbed.
    expect(ready).toContain(thirty.floor);
    // The yard's picture was fetched on floor 29 (or before), never on 30.
    expect(art.some((a) => a.url.includes("gloomshade"))).toBe(true);
    expect(art.every((a) => a.floor === 29)).toBe(true);
    const c = await court(page);
    expect(c.sky).toBe(4);
    expect(c.blocks).toEqual([]);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-floor-30-yard-summit-844x390");
    await shot(page, "z3-floor-30-yard-summit-844x390");
    // Graded (test-side read-back only), against the yard picture the game
    // fetched: darker and more violet overall, the middle (where the
    // lanterns' light falls and the dark ink warnings land) kept bright
    // enough for those warnings to read.
    const url = art.findLast(
      (a) => a.url.includes("gloomshade") && !a.url.includes("?import"),
    )!.url;
    const light = await page.evaluate(async (url) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const graded = scene.floor.texture.getSourceImage() as HTMLCanvasElement;
      const plain = await new Promise<HTMLImageElement>((done, fail) => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => fail(new Error(`could not load ${url}`));
        img.src = url;
      });
      const measure = (src: CanvasImageSource) => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(src, 0, 0, 160, 90);
        const box = (x: number, y: number, w: number, h: number) => {
          const d = ctx.getImageData(x, y, w, h).data;
          let lum = 0,
            violet = 0;
          for (let i = 0; i < d.length; i += 4) {
            lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
            violet += d[i + 2] - d[i + 1];
          }
          return { lum: lum / (d.length / 4), violet: violet / (d.length / 4) };
        };
        return { all: box(0, 0, 160, 90), middle: box(40, 22, 80, 46) };
      };
      return { graded: measure(graded), plain: measure(plain) };
    }, url);
    console.log(JSON.stringify(light));
    expect(light.graded.all.lum).toBeLessThan(light.plain.all.lum * 0.85);
    expect(light.graded.all.violet / light.graded.all.lum).toBeGreaterThan(
      light.plain.all.violet / light.plain.all.lum,
    );
    expect(light.graded.middle.lum).toBeGreaterThan(
      light.plain.middle.lum * 0.78,
    );
    // Inkpurr's darkest warning ink (its hands' and blobs', 0x0e0826)
    // against the middle: nearly as clear as in its own raid.
    const ink = (l: number) => contrast([l, l, l], hex(0x0e0826));
    console.log(
      JSON.stringify({
        ink: {
          graded: ink(light.graded.middle.lum),
          plain: ink(light.plain.middle.lum),
        },
      }),
    );
    expect(ink(light.graded.middle.lum)).toBeGreaterThan(
      ink(light.plain.middle.lum) * 0.8,
    );
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Inkpurr's own raid keeps the Lantern Yard ungraded", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "gloomshade" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__spireGame.scene.getScene("arena").floor.texture
              .key,
        ),
      )
      .toMatch(/^arena-floor-lantern-yard(:art)?$/);
    expect(
      await page.evaluate(() =>
        (window as any).__spireGame.scene
          .getScene("arena")
          .textures.exists("arena-floor-spire-summit-yard"),
      ),
    ).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// ───────────────────────── Zone 4: Psychic ─────────────────────────
//
// Floors 31–39 take zone 4's Psychic look (spireZoneTheme(4)): pale
// lavender marble with a gold star inlay, rose crystals with stars at their
// tips, a twilight sky with a big moon, dream clouds and floating stars,
// deeper indigo higher up. Until zone 4's rooms are built
// (SPIRE_BUILT_TOP < 40), the same test-only path as zones 2 and 3: a real
// zone-3 room (with its own Shadow Echoes) runs on the page and each
// snapshot is shown ten floors higher (floor and zone, 3 → 4). Once they
// are, these tests climb real zone-4 rooms with their own Echoes.
const ZONE4_REAL = SPIRE_BUILT_TOP >= 40;
const SHOTS4 = process.env.ZONE4_SHOTS;
async function shot4(page: Page, name: string) {
  if (SHOTS4) await page.screenshot({ path: `${SHOTS4}/${name}.png` });
}
async function climbZone4(page: Page, floor: number, ceiling?: number) {
  if (ZONE4_REAL) return climb(page, floor, ceiling);
  await raiseFloors(page, 10);
  await climb(
    page,
    floor - 10,
    ceiling === undefined ? undefined : ceiling - 10,
  );
}
/** Where the zone-4 readability check stands its Echoes (feet, world px). */
// (Clear of the cover on every layout and of a phone's touch buttons: the
// pale marble below the ring, a corner crescent, near the bottom coping,
// under the top-right constellation.)
const ZONE4_SPOTS = [
  [900, 700],
  [230, 190],
  [600, 790],
  [1180, 170],
];
const ZONE4_SIZES = [
  { ...DESKTOP, floors: [31, 35, 39] },
  {
    name: "844x390",
    width: 844,
    height: 390,
    phone: true,
    floors: [31, 35, 39],
  },
  {
    name: "667x375",
    width: 667,
    height: 375,
    phone: true,
    floors: [31, 35, 39],
  },
  { name: "ipad", width: 1180, height: 820, phone: true, floors: [31, 35, 39] },
];
for (const size of ZONE4_SIZES)
  for (const floor of size.floors)
    test(`zone 4: the Spire court on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climbZone4(page, floor);
        await page.waitForTimeout(600);
        const c = await court(page);
        const kind = floor === 35 ? "elite" : "wave";
        // Zone 4's platform floor and its own floor atlas.
        expect(c.floor).toBe("arena-floor-spire-z4");
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          `spire-court-4-${floor}`,
        );
        expect(c.sky).toBe(4);
        expect(c.surround).toBe(0);
        expect(c.pillars).toBe(0);
        expect(c.number).toBe(1);
        const layout = spireCourtLayout(floor, kind)!;
        expect(c.blocks).toHaveLength(layout.blocks.length);
        const shown = [...c.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        const feet = [...layout.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        feet.forEach((o, i) => {
          expect(shown[i].x).toBeLessThanOrEqual(o.x);
          expect(shown[i].x + shown[i].w).toBeGreaterThanOrEqual(o.x + o.w);
          expect(shown[i].depth).toBeCloseTo(2 + (o.y + o.h) / 10000, 6);
        });
        expect(c.stairs).toHaveLength(1);
        // Height: the zone's first floor untinted, higher ones a deeper
        // indigo (blue leads).
        if (floor === 31) expect(c.tint).toBe(0xffffff);
        else {
          expect(c.tint).toBeLessThan(0xffffff);
          expect(c.tint & 255).toBeGreaterThan((c.tint >> 16) + 15);
          if (floor === 39)
            expect(c.tint & 255).toBeGreaterThan((c.tint >> 16) + 40);
        }
        await page.waitForTimeout(300);
        await snap(page, info, `spire-court-z4-floor-${floor}-${size.name}`);
        await shot4(page, `z4-floor-${floor}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  for (const floor of [31, 35, 39])
    test(`zone 4: fighters, Echo rings, crystals and the floor number read on the pale court, floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climbZone4(page, floor);
        await page.waitForTimeout(400);
        const key = `spire-court-4-${floor}`;
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          key,
        );
        // The cover: bright rose crystal pixels, against its pale stone.
        const rose = await page.evaluate(
          ({ key }) => {
            const scene = (window as any).__spireGame.scene.getScene("arena");
            const tex = scene.textures.get(key);
            const f = tex.get("block0");
            const d = (tex.getSourceImage() as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
            let n = 0,
              hit = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] <= 200) continue;
              n++;
              const lum = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
              if (lum > 150 && d[i] - d[i + 1] > 50 && d[i] - d[i + 2] > 15)
                hit++;
            }
            return hit / n;
          },
          { key },
        );
        // The number: a dark groove round a bright inlay.
        const number = (await atlasPixels(page, key, "number")).map(
          (p) => p.lum,
        );
        const darkPx = number.filter((l) => l < 70),
          brightPx = number.filter((l) => l > 190);
        const dark = darkPx.length / number.length,
          bright = brightPx.length / number.length;
        const mean = (a: number[]) =>
          a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
        const inlay = mean(brightPx),
          groove = mean(darkPx);
        // The floor where fighters walk: pale marble (darker higher up).
        const ground = await floorColour(page);
        const groundLum = 0.3 * ground[0] + 0.59 * ground[1] + 0.11 * ground[2];
        const g = (l: number) => [l, l, l];
        // (On pale stone the Echoes' rings read by hue, not by lightness:
        // their colour's distance from the floor's, in RGB.)
        const apart = (a: number[], b: number[]) =>
          Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const rings = {
          echo: apart(hex(0xa98bff), ground),
          enemy: apart(hex(0xff5d6c), ground),
          hero: contrast([255, 255, 255], ground),
          // The number's inlay against its groove, and the groove against
          // the marble round it.
          inlay: contrast(g(inlay), g(groove)),
          groove: contrast(g(groove), ground),
        };
        await page
          .waitForFunction(
            () =>
              [
                ...(window as any).__spireGame.scene
                  .getScene("arena")
                  .rigs.entries(),
              ].some(
                ([id, r]: [string, any]) =>
                  id.startsWith("echo") && r.root?.visible,
              ),
            undefined,
            { timeout: 15_000 },
          )
          .catch(() => {});
        // Everyone at fixed spots: the same picture on every run.
        await page.evaluate((spots) => {
          const w = window as any;
          const a = w.__spireArena;
          const place = (p: any, [x, y]: number[]) =>
            Object.assign(p, { x, y, vx: 0, vy: 0, angle: Math.PI / 2 });
          place(a.heroes()[0], [380, 470]);
          a.players
            .filter((p: any) => p.echo && p.hp > 0)
            .forEach((p: any, i: number) => place(p, spots[i % spots.length]));
          w.__spireStep(0);
        }, ZONE4_SPOTS);
        await page.waitForTimeout(900);
        const fighters = await fighterContrast(page);
        const shown = fighters.filter((f) => f.n > 60);
        const summary = shown.map((f) => ({
          id: f.id.slice(0, 10),
          n: f.n,
          seen: +f.seen.toFixed(3),
          contrast: +contrast(f.fighter, f.court).toFixed(2),
          fighterLum: Math.round(
            0.3 * f.fighter[0] + 0.59 * f.fighter[1] + 0.11 * f.fighter[2],
          ),
          courtLum: Math.round(
            0.3 * f.court[0] + 0.59 * f.court[1] + 0.11 * f.court[2],
          ),
        }));
        console.log(
          JSON.stringify({
            floor,
            size: size.name,
            real: ZONE4_REAL,
            rose: +rose.toFixed(3),
            dark: +dark.toFixed(3),
            bright: +bright.toFixed(3),
            inlay: Math.round(inlay),
            groundLum: Math.round(groundLum),
            rings: Object.fromEntries(
              Object.entries(rings).map(([k, v]) => [k, +v.toFixed(2)]),
            ),
            fighters: summary,
          }),
        );
        await shot4(page, `z4-floor-${floor}-read-${size.name}`);
        expect(rose).toBeGreaterThan(0.06);
        expect(dark).toBeGreaterThan(0.15);
        expect(bright).toBeGreaterThan(0.25);
        expect(inlay).toBeGreaterThan(200);
        expect(rings.inlay).toBeGreaterThan(6);
        expect(rings.groove).toBeGreaterThan(4);
        // Pale marble, never white (light fighters keep a floor to stand
        // out from), deeper higher up.
        expect(groundLum).toBeGreaterThan(110);
        expect(groundLum).toBeLessThan(200);
        // (The Echoes' violet ring on this blue-leaning marble is 71–93 apart,
        // the weakest of the zones: zone 1's sandstone about 160, zone 2's
        // sea-glass about 115. Their dark bodies and red rings carry them.)
        expect(rings.echo).toBeGreaterThan(65);
        expect(rings.enemy).toBeGreaterThan(130);
        expect(rings.hero).toBeGreaterThan(2.4);
        // Every fighter in view stands out from the court under it.
        expect(shown.length).toBeGreaterThanOrEqual(2);
        const echoes = summary.filter((f) => f.id.startsWith("echo"));
        expect(echoes.length).toBeGreaterThanOrEqual(1);
        for (const f of echoes) expect(f.seen).toBeGreaterThan(0.58);
        expect(
          echoes.reduce((a, f) => a + f.seen, 0) / echoes.length,
        ).toBeGreaterThan(0.6);
        // (The hero, a pale champion here, is about as light as the marble
        // on average: it reads by its outlines and its white ring, so only
        // its share of clearly different pixels is held.)
        for (const f of summary)
          if (!f.id.startsWith("echo")) expect(f.seen).toBeGreaterThan(0.65);
        await snap(
          page,
          info,
          `spire-court-z4-floor-${floor}-read-${size.name}`,
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/**
 * How the Cloud Deck's pads and the Dream Tide read on a deck picture
 * (test-side, from the baked floor only: everything live is drawn on top).
 * Round each pad (the raid's and Ascendant Snoozaku's), the marble just
 * outside the pad's stone (r 62–80) and at the Dream Tide's awake ring
 * (r 100–110): the contrast of each rune's enamel against the first, and
 * of the tide's lilac and ivory rings against the second under the tide's
 * sleep mist (at half its wind-up), and how much the mist darkens it.
 */
// (The raid's pads and Ascendant Snoozaku's, and the Dream Tide's awake
// ring radius, read from the game's own tables.)
const DECK_PADS = [...somnaraPads(), ...somnaraPads("ascendant")].map((p) => [
  p.x,
  p.y,
]);
const TIDE_RADIUS = ASCENDANT_SNOOZAKU.tide.radius;
const RUNE_ENAMEL = [0x92efdb, 0xffdf8d, 0xd1b2ff, 0x8bceff];
function deckReadability(page: Page, src: "floor" | string) {
  return page.evaluate(
    async ({ src, pads, tide }) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const image: CanvasImageSource =
        src === "floor"
          ? (scene.floor.texture.getSourceImage() as HTMLCanvasElement)
          : await new Promise<HTMLImageElement>((done, fail) => {
              const img = new Image();
              img.onload = () => done(img);
              img.onerror = () => fail(new Error(`could not load ${src}`));
              img.src = src;
            });
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 450;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(image, 0, 0, 800, 450);
      const d = ctx.getImageData(0, 0, 800, 450).data;
      const ring = (x: number, y: number, r0: number, r1: number) => {
        const m = [0, 0, 0];
        let n = 0;
        for (let a = 0; a < 96; a++)
          for (let r = r0; r <= r1; r += 3) {
            const px = Math.round(
                (x + Math.cos((a / 96) * Math.PI * 2) * r) / 2,
              ),
              py = Math.round((y + Math.sin((a / 96) * Math.PI * 2) * r) / 2);
            if (px < 0 || py < 0 || px >= 800 || py >= 450) continue;
            const i = (py * 800 + px) * 4;
            for (let k = 0; k < 3; k++) m[k] += d[i + k];
            n++;
          }
        return m.map((v) => v / Math.max(1, n));
      };
      return pads.map(([x, y]: number[]) => ({
        pad: ring(x, y, 62, 80),
        tide: ring(x, y, tide - 5, tide + 5),
      }));
    },
    { src, pads: DECK_PADS, tide: TIDE_RADIUS },
  );
}
function deckScores(rings: { pad: number[]; tide: number[] }[]) {
  // The tide's mist (0x2a1650) at half its wind-up: alpha 0.24 + 0.34 × 0.5.
  const mist = [0x2a, 0x16, 0x50],
    a = 0.41;
  const misted = (c: number[]) => c.map((v, k) => v * (1 - a) + mist[k] * a);
  const lumOf = (c: number[]) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  const min = (xs: number[]) => Math.min(...xs);
  return {
    glyph: min(
      rings.flatMap((r) => RUNE_ENAMEL.map((e) => contrast(hex(e), r.pad))),
    ),
    lilac: min(rings.map((r) => contrast(hex(0xc9b2ff), misted(r.tide)))),
    ivory: min(rings.map((r) => contrast(hex(0xfff3c4), misted(r.tide)))),
    mist: min(rings.map((r) => lumOf(r.tide) - lumOf(misted(r.tide)))),
  };
}

test("floor 40: Snoozaku's Cloud Deck with its summit grade, painted on floor 39, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 39;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    // Test-only path (the rooms harness has no floor 40 yet): Snoozaku's
    // raid room carrying a climb's state from a real Spire room, shown as
    // floor 39 cleared (the party may climb to 40), then as floor 40.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 9, ceiling: 10 });
      const climb = JSON.parse(JSON.stringify(w.__snap.raid.spire));
      w.__room("raid", { boss: "somnara" });
      w.__snap.remaining = 300;
      w.__snap.raid.spire = {
        ...climb,
        zone: 4,
        floor: 39,
        kind: "wave",
        ceiling: 40,
        clearedAt: w.__snap.raid.time ?? 1,
      };
    });
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    // The arena paints its floor a frame or two after the room arrives.
    await page.waitForFunction(
      () =>
        !!(window as any).__spireGame?.scene.getScene("arena")?.floor?.texture,
    );
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor.texture.key as string,
          artwork: s.floor.texture.getSourceImage().dataset?.raidArtwork as
            string | undefined,
          summitArt: s.textures.exists("arena-floor-spire-summit-deck:art"),
        };
      });
    await expect
      .poll(async () => (await scene()).floor)
      .toBe("arena-floor-spire-z4");
    // Floor 39's stairs are open: the deck's summit is painted now.
    await expect.poll(async () => (await scene()).summitArt).toBe(true);
    await shot4(page, "z4-floor-39-stairs-open-844x390");
    floorNow = 40;
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.spire = {
        ...w.__snap.raid.spire,
        floor: 40,
        kind: "boss",
        clearedAt: undefined,
      };
      w.__push();
    });
    await expect
      .poll(async () => (await scene()).artwork)
      .toBe("spire-summit-deck");
    expect((await scene()).floor).toBe("arena-floor-spire-summit-deck:art");
    // The deck's picture was fetched on floor 39 (or before), never on 40.
    expect(art.some((a) => a.url.includes("somnara"))).toBe(true);
    expect(art.every((a) => a.floor === 39)).toBe(true);
    const c = await court(page);
    expect(c.sky).toBe(4);
    expect(c.blocks).toEqual([]);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-floor-40-deck-summit-844x390");
    await shot4(page, "z4-floor-40-deck-summit-844x390");
    // Graded (test-side read-back only), against the deck picture the
    // game fetched: darker and bluer overall, the middle (the pads, the
    // constellation, every warning) kept nearly as bright.
    const url = art.findLast(
      (a) => a.url.includes("somnara") && !a.url.includes("?import"),
    )!.url;
    const light = await page.evaluate(async (url) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const graded = scene.floor.texture.getSourceImage() as HTMLCanvasElement;
      const plain = await new Promise<HTMLImageElement>((done, fail) => {
        const img = new Image();
        img.onload = () => done(img);
        img.onerror = () => fail(new Error(`could not load ${url}`));
        img.src = url;
      });
      const measure = (src: CanvasImageSource) => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(src, 0, 0, 160, 90);
        const box = (x: number, y: number, w: number, h: number) => {
          const d = ctx.getImageData(x, y, w, h).data;
          let lum = 0,
            blue = 0;
          for (let i = 0; i < d.length; i += 4) {
            lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
            blue += d[i + 2] - d[i];
          }
          return { lum: lum / (d.length / 4), blue: blue / (d.length / 4) };
        };
        return { all: box(0, 0, 160, 90), middle: box(40, 22, 80, 46) };
      };
      return { graded: measure(graded), plain: measure(plain) };
    }, url);
    // The pads' glyphs and the Dream Tide's rings against the deck round
    // them, graded and plain.
    const graded = deckScores(await deckReadability(page, "floor")),
      plain = deckScores(await deckReadability(page, url));
    console.log(JSON.stringify({ light, graded, plain }));
    expect(light.graded.all.lum).toBeLessThan(light.plain.all.lum * 0.85);
    expect(light.graded.all.blue / light.graded.all.lum).toBeGreaterThan(
      light.plain.all.blue / light.plain.all.lum,
    );
    expect(light.graded.middle.lum).toBeGreaterThan(
      light.plain.middle.lum * 0.75,
    );
    // Every rune's enamel and the tide's pale rings read at least as well
    // as on the raid's own deck; the sleep mist still visibly darkens it.
    expect(graded.glyph).toBeGreaterThanOrEqual(plain.glyph * 0.98);
    expect(graded.lilac).toBeGreaterThanOrEqual(plain.lilac * 0.98);
    expect(graded.ivory).toBeGreaterThanOrEqual(plain.ivory * 0.98);
    expect(graded.mist).toBeGreaterThan(plain.mist * 0.6);
    expect(graded.mist).toBeGreaterThan(20);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Snoozaku's own raid keeps the Cloud Deck ungraded", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "somnara" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__spireGame.scene.getScene("arena").floor.texture
              .key,
        ),
      )
      .toMatch(/^arena-floor-cloud-deck(:art)?$/);
    expect(
      await page.evaluate(() =>
        (window as any).__spireGame.scene
          .getScene("arena")
          .textures.getTextureKeys()
          .filter((k: string) => k.startsWith("arena-floor-spire-summit")),
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

/** Snoozaku's Cloud Deck pieces the arena shows (its map atlas's images). */
async function deckPieces(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__spireGame.scene.getScene("arena");
    let n = 0;
    const walk = (o: any) => {
      if (!o?.visible) return;
      if (o.list) o.list.forEach(walk);
      else if (o.texture?.key?.startsWith("cloud-deck-atlas")) n++;
    };
    scene.children.list.forEach(walk);
    return n;
  });
}
/** Wait for two more game frames (this machine draws a few a second). */
async function frames(page: Page, n = 2) {
  const at = await page.evaluate(
    () => (window as any).__spireGame.loop.frame as number,
  );
  await page.waitForFunction(
    ([at, n]) => (window as any).__spireGame.loop.frame >= at + n,
    [at, n] as const,
  );
}

test("zone 4: Snoozaku's Cloud Deck kept to floor 40, painted on floor 39, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.setTimeout(240_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 31;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    // A real zone-4 room (harness/rooms.ts): floor 31, on the Spire's court.
    await climb(page, 31);
    await page.waitForTimeout(600);
    const c31 = await court(page);
    expect(c31.floor).toBe("arena-floor-spire-z4");
    expect(c31.blocks.length).toBeGreaterThan(0);
    expect(c31.stairs).toHaveLength(1);
    await frames(page);
    // No rune pads, Quiet Zone or rings: the deck isn't drawn.
    expect(await deckPieces(page)).toBe(0);
    await snap(page, info, "spire-court-z4-floor-31-844x390");
    await shot4(page, "z4-floor-31-844x390");

    // Floor 35: the captain's falling stars, still on the Spire's court.
    floorNow = 35;
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 35, stage: "playing" });
      w.__push();
    });
    for (let i = 0; i < 40; i++) {
      const stars = await page.evaluate(() => {
        const w = window as any;
        w.__spireStep(0.25);
        return w.__snap.raid.warnings.filter(
          (x: any) => x.kind === "falling-stars",
        ).length;
      });
      if (stars) break;
    }
    await page.evaluate(() => (window as any).__spireStep(0.5));
    await frames(page);
    await page.waitForTimeout(300);
    expect((await court(page)).floor).toBe("arena-floor-spire-z4");
    expect(await deckPieces(page)).toBe(0);
    await snap(page, info, "spire-court-z4-floor-35-stars-844x390");
    await shot4(page, "z4-floor-35-stars-844x390");

    // Floor 39 with floor 40 open: beat it, and while its stairs are open
    // floor 40's court is painted.
    floorNow = 39;
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 39, stage: "playing", ceiling: 40 });
      w.__push();
    });
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor?.texture?.key as string,
          floors: (s.textures.getTextureKeys() as string[]).filter((k) =>
            k.startsWith("arena-floor-"),
          ),
        };
      });
    for (let i = 0; i < 12; i++) {
      const cleared = await page.evaluate(() => {
        const w = window as any;
        for (const p of w.__spireArena.players) if (p.echo) p.hp = 0;
        w.__spireStep(1.8);
        return w.__snap.raid.spire.clearedAt !== undefined;
      });
      if (cleared) break;
    }
    // While they are open, the next floor's court is painted: waited for
    // as on floor 29 (a fixed 1.5 s was too short for CI's runner, which
    // had not drawn a frame on the cleared floor yet, 19 Nov).
    await expect
      .poll(async () => (await scene()).floors, { timeout: 30_000 })
      .toContain("arena-floor-spire-summit-deck:art");
    const ready = (await scene()).floors;
    floorNow = 40;
    await page.evaluate(() => (window as any).__spireStep(3));
    await expect
      .poll(() => page.evaluate(() => (window as any).__snap.raid.spire.floor))
      .toBe(40);
    await expect
      .poll(async () => (await scene()).floor)
      .not.toBe("arena-floor-spire-z4");
    const forty = await scene();
    // Floor 40 shows the deck's summit grade (spireSummitFloorId(4)).
    expect(forty.floor).toBe("arena-floor-spire-summit-deck:art");
    // The court it shows was ready before the stairs were climbed.
    expect(ready).toContain(forty.floor);
    expect(art.every((a) => a.floor !== 40)).toBe(true);
    // Its own floor draws the deck (its rune pads at least).
    await frames(page);
    await expect.poll(() => deckPieces(page)).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-z4-floor-40-844x390");
    await shot4(page, "z4-floor-40-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// ───────────────────────── Zone 5: Light ─────────────────────────
//
// Floors 41–49 take zone 5's Light look (spireZoneTheme(5)): champagne
// stone with a gold sun inlay, clear prism crystals splitting the light
// into rainbow facets, a bright morning sky with a big sun and prismatic
// clouds, a warm gold sunset higher up. Until zone 5's rooms are built
// (SPIRE_BUILT_TOP < 50), the same test-only path as zones 2 to 4: a real
// zone-4 room (with its own Psychic Echoes) runs on the page and each
// snapshot is shown ten floors higher (floor and zone, 4 → 5; the client
// tints the Echoes by the shown zone, spireEchoTint(5)). Once they are,
// these tests climb real zone-5 rooms with their own Echoes.
const ZONE5_REAL = SPIRE_BUILT_TOP >= 50;
const SHOTS5 = process.env.ZONE5_SHOTS;
async function shot5(page: Page, name: string) {
  if (SHOTS5) await page.screenshot({ path: `${SHOTS5}/${name}.png` });
}
async function climbZone5(page: Page, floor: number, ceiling?: number) {
  if (ZONE5_REAL) return climb(page, floor, ceiling);
  await raiseFloors(page, 10);
  await climb(
    page,
    floor - 10,
    ceiling === undefined ? undefined : ceiling - 10,
  );
}
const ZONE5_SIZES = [
  { ...DESKTOP, floors: [41, 45, 49] },
  {
    name: "844x390",
    width: 844,
    height: 390,
    phone: true,
    floors: [41, 45, 49],
  },
  {
    name: "667x375",
    width: 667,
    height: 375,
    phone: true,
    floors: [41, 45, 49],
  },
  { name: "ipad", width: 1180, height: 820, phone: true, floors: [41, 45, 49] },
];
for (const size of ZONE5_SIZES)
  for (const floor of size.floors)
    test(`zone 5: the Spire court on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climbZone5(page, floor);
        await page.waitForTimeout(600);
        const c = await court(page);
        const kind = floor === 45 ? "elite" : "wave";
        // Zone 5's platform floor and its own floor atlas.
        expect(c.floor).toBe("arena-floor-spire-z5");
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          `spire-court-5-${floor}`,
        );
        expect(c.sky).toBe(4);
        expect(c.surround).toBe(0);
        expect(c.pillars).toBe(0);
        expect(c.number).toBe(1);
        const layout = spireCourtLayout(floor, kind)!;
        expect(c.blocks).toHaveLength(layout.blocks.length);
        const shown = [...c.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        const feet = [...layout.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        feet.forEach((o, i) => {
          expect(shown[i].x).toBeLessThanOrEqual(o.x);
          expect(shown[i].x + shown[i].w).toBeGreaterThanOrEqual(o.x + o.w);
          expect(shown[i].depth).toBeCloseTo(2 + (o.y + o.h) / 10000, 6);
        });
        expect(c.stairs).toHaveLength(1);
        // Height: the zone's first floor untinted, higher ones a warm gold
        // sunset (red leads blue, unlike every other zone's dusk).
        if (floor === 41) expect(c.tint).toBe(0xffffff);
        else {
          expect(c.tint).toBeLessThan(0xffffff);
          expect(c.tint >> 16).toBeGreaterThan((c.tint & 255) + 15);
          if (floor === 49)
            expect(c.tint >> 16).toBeGreaterThan((c.tint & 255) + 50);
        }
        await page.waitForTimeout(300);
        await snap(page, info, `spire-court-z5-floor-${floor}-${size.name}`);
        await shot5(page, `z5-floor-${floor}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/** Where the zone-5 readability check stands its Echoes (feet, world px). */
// (Clear of the cover on every layout and of a phone's touch buttons, as
// zone 4's: on the sun's rays below the ring, a corner sunburst, near the
// bottom coping, by the top-right rays.)
const ZONE5_SPOTS = ZONE4_SPOTS;
for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  for (const floor of [41, 45, 49])
    test(`zone 5: fighters, Echo rings, gold cues, crystals and the floor number read on the bright court, floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climbZone5(page, floor);
        await page.waitForTimeout(400);
        const key = `spire-court-5-${floor}`;
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          key,
        );
        // The cover: clear, cool crystal pixels against its warm stone, and
        // the prism's facets in every band of the spectrum.
        const cover = await page.evaluate(
          ({ key }) => {
            const scene = (window as any).__spireGame.scene.getScene("arena");
            const tex = scene.textures.get(key);
            const f = tex.get("block0");
            const d = (tex.getSourceImage() as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
            let n = 0,
              cool = 0;
            const bands = new Set<number>();
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] <= 200) continue;
              n++;
              const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
              const lum = 0.3 * r + 0.59 * g + 0.11 * b;
              if (lum > 140 && b - r > 15) cool++;
              const hi = Math.max(r, g, b),
                lo = Math.min(r, g, b);
              if (hi - lo < 70 || hi < 150) continue;
              // The pixel's hue, in sixths (red, yellow, green, cyan, blue…).
              const h =
                hi === r
                  ? ((g - b) / (hi - lo) + 6) % 6
                  : hi === g
                    ? (b - r) / (hi - lo) + 2
                    : (r - g) / (hi - lo) + 4;
              bands.add(Math.floor(h + 0.5) % 6);
            }
            return { cool: cool / n, bands: bands.size };
          },
          { key },
        );
        // The number: a dark groove round a bright inlay.
        const number = (await atlasPixels(page, key, "number")).map(
          (p) => p.lum,
        );
        const darkPx = number.filter((l) => l < 70),
          brightPx = number.filter((l) => l > 190);
        const dark = darkPx.length / number.length,
          bright = brightPx.length / number.length;
        const mean = (a: number[]) =>
          a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
        const inlay = mean(brightPx),
          groove = mean(darkPx);
        // The floor where fighters walk: champagne stone (warmer higher up).
        const ground = await floorColour(page);
        const groundLum = 0.3 * ground[0] + 0.59 * ground[1] + 0.11 * ground[2];
        const g = (l: number) => [l, l, l];
        const apart = (a: number[], b: number[]) =>
          Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const rings = {
          echo: apart(hex(0xa98bff), ground),
          enemy: apart(hex(0xff5d6c), ground),
          hero: contrast([255, 255, 255], ground),
          // A pale gold warning (a lantern's, a falling star's) by its
          // colour's distance from the stone, and by lightness.
          gold: apart(hex(0xffd982), ground),
          goldLight: contrast(hex(0xffd982), ground),
          inlay: contrast(g(inlay), g(groove)),
          groove: contrast(g(groove), ground),
        };
        await page
          .waitForFunction(
            () =>
              [
                ...(window as any).__spireGame.scene
                  .getScene("arena")
                  .rigs.entries(),
              ].some(
                ([id, r]: [string, any]) =>
                  id.startsWith("echo") && r.root?.visible,
              ),
            undefined,
            { timeout: 15_000 },
          )
          .catch(() => {});
        // Everyone at fixed spots: the same picture on every run.
        await page.evaluate((spots) => {
          const w = window as any;
          const a = w.__spireArena;
          const place = (p: any, [x, y]: number[]) =>
            Object.assign(p, { x, y, vx: 0, vy: 0, angle: Math.PI / 2 });
          place(a.heroes()[0], [380, 470]);
          a.players
            .filter((p: any) => p.echo && p.hp > 0)
            .forEach((p: any, i: number) => place(p, spots[i % spots.length]));
          w.__spireStep(0);
        }, ZONE5_SPOTS);
        await page.waitForTimeout(900);
        const fighters = await fighterContrast(page);
        const shown = fighters.filter((f) => f.n > 60);
        const summary = shown.map((f) => ({
          id: f.id.slice(0, 10),
          n: f.n,
          seen: +f.seen.toFixed(3),
          contrast: +contrast(f.fighter, f.court).toFixed(2),
          fighterLum: Math.round(
            0.3 * f.fighter[0] + 0.59 * f.fighter[1] + 0.11 * f.fighter[2],
          ),
          courtLum: Math.round(
            0.3 * f.court[0] + 0.59 * f.court[1] + 0.11 * f.court[2],
          ),
        }));
        console.log(
          JSON.stringify({
            floor,
            size: size.name,
            real: ZONE5_REAL,
            cover,
            dark: +dark.toFixed(3),
            bright: +bright.toFixed(3),
            inlay: Math.round(inlay),
            groundLum: Math.round(groundLum),
            rings: Object.fromEntries(
              Object.entries(rings).map(([k, v]) => [k, +v.toFixed(2)]),
            ),
            fighters: summary,
          }),
        );
        await shot5(page, `z5-floor-${floor}-read-${size.name}`);
        // The palest champions on the bright stone: the hero (Voltkit, a
        // yellow one, above) as Glacelle (ice white) and Sunbara (gold).
        const pale: Record<string, number> = {};
        for (const character of ["glacelle", "sunbara"]) {
          await page.evaluate((character) => {
            const w = window as any;
            const hero = w.__spireArena.heroes()[0];
            Object.assign(hero, { character, hp: hero.maxHp ?? hero.hp });
            w.__spireStep(0);
          }, character);
          // (Its rig is rebuilt for the new champion: measure once it shows.)
          let me:
            Awaited<ReturnType<typeof fighterContrast>>[number] | undefined;
          for (let i = 0; i < 6 && !(me && me.n > 60); i++) {
            await page.waitForTimeout(1000);
            me = (await fighterContrast(page)).find((f) => f.id === "me");
          }
          // The median over its idle cycle: one reading ranged 0.59-0.69
          // for Glacelle here from pose to pose, and CI's runner caught
          // 0.593 and 0.596 (PR #237, 19 Nov) against a median near 0.66.
          const seen = [me?.seen ?? 0];
          for (let k = 0; k < 5; k++) {
            await page.waitForTimeout(500);
            seen.push(
              (await fighterContrast(page)).find((f) => f.id === "me")?.seen ??
                0,
            );
          }
          seen.sort((a, b) => a - b);
          pale[character] = +((seen[2] + seen[3]) / 2).toFixed(3);
          await shot5(page, `z5-floor-${floor}-read-${character}-${size.name}`);
        }
        console.log(JSON.stringify({ floor, size: size.name, pale }));
        // (Measured the same way on the shipped courts: Glacelle 0.71–0.81
        // on zone 1's sandstone and 0.65–0.77 on zone 4's marble, Sunbara
        // 0.61–0.71 and 0.54–0.64. A gold champion on warm gold stone is
        // the hardest case of any zone: it reads by its outlines, shading
        // and white ring. A champion's idle pose moves the share by up to
        // ±0.05 from run to run, so the median of six readings counts.
        // Held at zone 4's level.)
        expect(pale.glacelle).toBeGreaterThan(0.6);
        expect(pale.sunbara).toBeGreaterThan(0.5);
        expect(cover.cool).toBeGreaterThan(0.04);
        expect(cover.bands).toBeGreaterThanOrEqual(4);
        expect(dark).toBeGreaterThan(0.15);
        expect(bright).toBeGreaterThan(0.25);
        expect(inlay).toBeGreaterThan(200);
        expect(rings.inlay).toBeGreaterThan(6);
        expect(rings.groove).toBeGreaterThan(4);
        // Champagne stone, never white (white and yellow fighters and pale
        // gold cues keep a floor to stand out from), warmer higher up.
        expect(groundLum).toBeGreaterThan(110);
        expect(groundLum).toBeLessThan(185);
        // (Violet on the warm stone is far apart; the enemies' red ring is
        // nearer the stone's hue, about 100 apart, as on zone 1's sandstone:
        // it reads by its lightness and its enemies' dark shade.)
        expect(rings.echo).toBeGreaterThan(110);
        expect(rings.enemy).toBeGreaterThan(90);
        expect(rings.hero).toBeGreaterThan(2.4);
        expect(rings.gold).toBeGreaterThan(70);
        expect(rings.goldLight).toBeGreaterThan(1.5);
        // Every fighter in view stands out from the court under it.
        expect(shown.length).toBeGreaterThanOrEqual(2);
        const echoes = summary.filter((f) => f.id.startsWith("echo"));
        expect(echoes.length).toBeGreaterThanOrEqual(1);
        for (const f of echoes) expect(f.seen).toBeGreaterThan(0.58);
        expect(
          echoes.reduce((a, f) => a + f.seen, 0) / echoes.length,
        ).toBeGreaterThan(0.6);
        for (const f of summary)
          if (!f.id.startsWith("echo")) expect(f.seen).toBeGreaterThan(0.65);
        await snap(
          page,
          info,
          `spire-court-z5-floor-${floor}-read-${size.name}`,
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/**
 * How Prismell's own cues read on a Sun Atrium floor picture (test-side,
 * from the baked floor only: the beams, the skylight's ring, the chimes,
 * the scramble flash and the shield are drawn live on top). Under each
 * relay beam's line (the skylight to the mirrors, mirror to mirror and on
 * to the heart, lifted as the beams are), round the skylight's reach, round
 * each mirror's chime and round the shell's shield: the floor's mean colour
 * there.
 */
const ATRIUM_SOURCE = PRISMATAIL.source;
const ATRIUM_MIRRORS = PRISMATAIL.mirrors.map((m) => [m.x, m.y]);
const ATRIUM_HEART = [1000, 450];
function atriumReadability(page: Page, key: string) {
  return page.evaluate(
    ({ key, source, mirrors, heart, range }) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const image = scene.textures.get(key).getSourceImage() as
        HTMLCanvasElement | HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 450;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(image, 0, 0, 800, 450);
      const d = ctx.getImageData(0, 0, 800, 450).data;
      const at = (x: number, y: number) => {
        const px = Math.round(x / 2),
          py = Math.round(y / 2);
        if (px < 0 || py < 0 || px >= 800 || py >= 450) return undefined;
        const i = (py * 800 + px) * 4;
        return [d[i], d[i + 1], d[i + 2]];
      };
      const meanOf = (pts: [number, number][]) => {
        const m = [0, 0, 0];
        let n = 0;
        for (const [x, y] of pts) {
          const p = at(x, y);
          if (!p) continue;
          for (let k = 0; k < 3; k++) m[k] += p[k];
          n++;
        }
        return m.map((v) => v / Math.max(1, n));
      };
      const line = (a: number[], b: number[]) =>
        meanOf(
          Array.from({ length: 40 }, (_, i) => {
            const t = (i + 0.5) / 40;
            return [
              a[0] + (b[0] - a[0]) * t,
              a[1] + (b[1] - a[1]) * t - 20,
            ] as [number, number];
          }).flatMap(([x, y]) => [
            [x, y - 3] as [number, number],
            [x, y],
            [x, y + 3],
          ]),
        );
      const ring = (
        x: number,
        y: number,
        r0: number,
        r1: number,
        flat = 0.65,
      ) => {
        const pts: [number, number][] = [];
        for (let a = 0; a < 96; a++)
          for (let r = r0; r <= r1; r += 2)
            pts.push([
              x + Math.cos((a / 96) * Math.PI * 2) * r,
              y + Math.sin((a / 96) * Math.PI * 2) * r * flat,
            ]);
        return meanOf(pts);
      };
      const s = [source.x, source.y];
      const [m0, m1, m2, m3] = mirrors;
      return {
        beams: [
          line(s, m0),
          line(s, m2),
          line(m0, m1),
          line(m2, m3),
          line(m0, m2),
          line(m1, heart),
          line(m3, heart),
        ],
        reach: ring(source.x, source.y, range - 4, range + 4),
        chimes: mirrors.map(([x, y]: number[]) => ring(x, y, 31, 39)),
        shield: ring(heart[0], heart[1] - 70, 56, 72, 1),
      };
    },
    {
      key,
      source: ATRIUM_SOURCE,
      mirrors: ATRIUM_MIRRORS,
      heart: ATRIUM_HEART,
      range: PRISMATAIL.range,
    },
  );
}
function atriumScores(f: Awaited<ReturnType<typeof atriumReadability>>) {
  const apart = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const min = (xs: number[]) => Math.min(...xs);
  // The beams' cores (gold, then cyan: BEAM_COLORS), their dark edges
  // (the colour deepened 62% toward 0x2a1530), the reach's cream dashes,
  // the chimes' gold, the scramble's pink and the shield's ice line.
  const deepen = (c: number) =>
    hex(c).map((v, k) => v + (hex(0x2a1530)[k] - v) * 0.62);
  return {
    gold: min(f.beams.map((b) => contrast(hex(0xffdc83), b))),
    cyan: min(f.beams.map((b) => contrast(hex(0x9cddff), b))),
    goldEdge: min(f.beams.map((b) => contrast(deepen(0xffdc83), b))),
    reach: contrast(hex(0xfff8e2), f.reach),
    chime: min(f.chimes.map((c) => contrast(hex(0xffd678), c))),
    scramble: min(f.chimes.map((c) => apart(hex(0xff6f91), c))),
    shield: apart(hex(0xb4e8ff), f.shield),
  };
}
/** Sun Atrium pieces the arena shows (its atlas's images). */
async function atriumPieceCount(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__spireGame.scene.getScene("arena");
    let n = 0;
    const walk = (o: any) => {
      if (!o?.visible) return;
      if (o.list) o.list.forEach(walk);
      else if (o.texture?.key === "atrium-prisma-atlas") n++;
    };
    scene.children.list.forEach(walk);
    return n;
  });
}

test("floor 50: Prismell's Sun Atrium with its summit grade, painted on floor 49, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 49;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    // Test-only path (the rooms harness has no floor 50 yet): Prismell's
    // raid room carrying a climb's state from a real Spire room, shown as
    // floor 49 cleared (the party may climb to 50), then as floor 50.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 9, ceiling: 10 });
      const climb = JSON.parse(JSON.stringify(w.__snap.raid.spire));
      w.__room("raid", { boss: "prismatail" });
      w.__snap.remaining = 300;
      w.__snap.raid.spire = {
        ...climb,
        zone: 5,
        floor: 49,
        kind: "wave",
        ceiling: 50,
        clearedAt: w.__snap.raid.time ?? 1,
      };
    });
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await page.waitForFunction(
      () =>
        !!(window as any).__spireGame?.scene.getScene("arena")?.floor?.texture,
    );
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor.texture.key as string,
          artwork: s.floor.texture.getSourceImage().dataset?.raidArtwork as
            string | undefined,
          summitArt: s.textures.exists("arena-floor-spire-summit-atrium:art"),
        };
      });
    await expect
      .poll(async () => (await scene()).floor)
      .toBe("arena-floor-spire-z5");
    // Floor 49's stairs are open: the atrium's summit is painted now.
    await expect.poll(async () => (await scene()).summitArt).toBe(true);
    await shot5(page, "z5-floor-49-stairs-open-844x390");
    floorNow = 50;
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.spire = {
        ...w.__snap.raid.spire,
        floor: 50,
        kind: "boss",
        clearedAt: undefined,
      };
      w.__push();
    });
    await expect
      .poll(async () => (await scene()).artwork)
      .toBe("spire-summit-atrium");
    expect((await scene()).floor).toBe("arena-floor-spire-summit-atrium:art");
    // The atrium's picture was fetched on floor 49 (or before), never on 50.
    expect(art.some((a) => a.url.includes("prismatail"))).toBe(true);
    expect(art.every((a) => a.floor === 49)).toBe(true);
    const c = await court(page);
    expect(c.sky).toBe(4);
    expect(c.blocks).toEqual([]);
    // Its own floor draws the atrium (mirrors, the skylight) on top.
    await expect.poll(() => atriumPieceCount(page)).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-floor-50-atrium-summit-844x390");
    await shot5(page, "z5-floor-50-atrium-summit-844x390");
    // The raid's own floor, painted beside it (test-side only: it never
    // shows), to measure against.
    await page.evaluate(() =>
      (window as any).__spireGame.scene
        .getScene("arena")
        .floorTexture("sun-atrium"),
    );
    await page.waitForFunction(() =>
      (window as any).__spireGame.scene
        .getScene("arena")
        .textures.exists("arena-floor-sun-atrium:art"),
    );
    // Graded: darker and warmer overall, the middle (the mirrors, the
    // relay, every warning) kept most of its light.
    const light = await page.evaluate(() => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const measure = (key: string) => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(scene.textures.get(key).getSourceImage(), 0, 0, 160, 90);
        const box = (x: number, y: number, w: number, h: number) => {
          const d = ctx.getImageData(x, y, w, h).data;
          let lum = 0,
            warm = 0;
          for (let i = 0; i < d.length; i += 4) {
            lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
            warm += d[i] - d[i + 2];
          }
          return { lum: lum / (d.length / 4), warm: warm / (d.length / 4) };
        };
        return { all: box(0, 0, 160, 90), middle: box(40, 22, 80, 46) };
      };
      return {
        graded: measure("arena-floor-spire-summit-atrium:art"),
        plain: measure("arena-floor-sun-atrium:art"),
      };
    });
    const graded = atriumScores(
        await atriumReadability(page, "arena-floor-spire-summit-atrium:art"),
      ),
      plain = atriumScores(
        await atriumReadability(page, "arena-floor-sun-atrium:art"),
      );
    console.log(JSON.stringify({ light, graded, plain }));
    expect(light.graded.all.lum).toBeLessThan(light.plain.all.lum * 0.9);
    expect(light.graded.all.warm).toBeGreaterThan(light.plain.all.warm);
    expect(light.graded.middle.lum).toBeGreaterThan(
      light.plain.middle.lum * 0.8,
    );
    // Prismell's light cues read at least as well as in the raid (they
    // are light colours: they gain on the deeper floor), its pink and ice
    // cues stay as far from the floor's colour.
    expect(graded.gold).toBeGreaterThanOrEqual(plain.gold * 0.98);
    expect(graded.cyan).toBeGreaterThanOrEqual(plain.cyan * 0.98);
    expect(graded.reach).toBeGreaterThanOrEqual(plain.reach * 0.98);
    expect(graded.chime).toBeGreaterThanOrEqual(plain.chime * 0.98);
    expect(graded.scramble).toBeGreaterThanOrEqual(plain.scramble * 0.98);
    expect(graded.shield).toBeGreaterThanOrEqual(plain.shield * 0.98);
    // (The beams' dark edges lose some contrast on the deeper floor, about
    // as much as their bright cores gain: 3.0 → 2.5 against 1.25 → 1.48.
    // Held so they never sink further.)
    expect(graded.goldEdge).toBeGreaterThan(plain.goldEdge * 0.8);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Prismell's own raid keeps the Sun Atrium ungraded", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "prismatail" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__spireGame.scene.getScene("arena").floor.texture
              .key,
        ),
      )
      .toMatch(/^arena-floor-sun-atrium(:art)?$/);
    expect(
      await page.evaluate(() =>
        (window as any).__spireGame.scene
          .getScene("arena")
          .textures.getTextureKeys()
          .filter((k: string) => k.startsWith("arena-floor-spire-summit")),
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// Once zone 5's rooms are built (SPIRE_BUILT_TOP reaches 50), a real climb:
// floor 41 and the elite on the Spire's court, then floor 49 beaten with
// floor 50 open, its court (the atrium's summit) painted while the stairs
// are open and shown on floor 50 with nothing fetched mid-fight.
test("zone 5: Prismell's Sun Atrium kept to floor 50, painted on floor 49, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.skip(!ZONE5_REAL, "zone 5's rooms are not built yet");
  test.setTimeout(240_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 41;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    await climb(page, 41);
    await page.waitForTimeout(600);
    const c41 = await court(page);
    expect(c41.floor).toBe("arena-floor-spire-z5");
    expect(c41.blocks.length).toBeGreaterThan(0);
    expect(c41.stairs).toHaveLength(1);
    await frames(page);
    // No mirrors or skylight: the atrium isn't drawn.
    expect(await atriumPieceCount(page)).toBe(0);
    await shot5(page, "z5-real-floor-41-844x390");

    floorNow = 49;
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 49, stage: "playing", ceiling: 50 });
      w.__push();
    });
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor?.texture?.key as string,
          floors: (s.textures.getTextureKeys() as string[]).filter((k) =>
            k.startsWith("arena-floor-"),
          ),
        };
      });
    for (let i = 0; i < 12; i++) {
      const cleared = await page.evaluate(() => {
        const w = window as any;
        for (const p of w.__spireArena.players) if (p.echo) p.hp = 0;
        w.__spireStep(1.8);
        return w.__snap.raid.spire.clearedAt !== undefined;
      });
      if (cleared) break;
    }
    // While they are open, the next floor's court is painted: waited for
    // as on floor 29 (a fixed 1.5 s was too short for CI's runner, which
    // had not drawn a frame on the cleared floor yet, 19 Nov).
    await expect
      .poll(async () => (await scene()).floors, { timeout: 30_000 })
      .toContain("arena-floor-spire-summit-atrium:art");
    const ready = (await scene()).floors;
    floorNow = 50;
    await page.evaluate(() => (window as any).__spireStep(3));
    await expect
      .poll(() => page.evaluate(() => (window as any).__snap.raid.spire.floor))
      .toBe(50);
    await expect
      .poll(async () => (await scene()).floor)
      .not.toBe("arena-floor-spire-z5");
    const fifty = await scene();
    expect(fifty.floor).toBe("arena-floor-spire-summit-atrium:art");
    expect(ready).toContain(fifty.floor);
    expect(art.every((a) => a.floor !== 50)).toBe(true);
    await frames(page);
    await expect.poll(() => atriumPieceCount(page)).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-z5-floor-50-844x390");
    await shot5(page, "z5-real-floor-50-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// ───────────────────────── Zone 6: Fire ─────────────────────────
//
// Floors 51–59 take zone 6's Fire look (spireZoneTheme(6)): a lantern
// festival on a volcanic tower at dusk. Warm basalt paving with an
// ember-gold inlay of flame tongues, bronze braziers in the corners, red
// paper lanterns on the coping and the cover, fire-opal crystals; a dusky
// orange sky over smoking volcanoes with sky lanterns and embers, a deep
// crimson night higher up. Until zone 6's rooms are built (SPIRE_BUILT_TOP
// < 60), the same test-only path as zones 2 to 5: a real room of the zone
// below (with its own Echoes) runs on the page and each snapshot is shown
// ten floors higher (floor and zone, 5 → 6; the client tints the Echoes by
// the shown zone, spireEchoTint(6)). Once they are, these tests climb real
// zone-6 rooms with their own Echoes.
const ZONE6_REAL = SPIRE_BUILT_TOP >= 60;
const SHOTS6 = process.env.ZONE6_SHOTS;
async function shot6(page: Page, name: string) {
  if (SHOTS6) await page.screenshot({ path: `${SHOTS6}/${name}.png` });
}
async function climbZone6(page: Page, floor: number, ceiling?: number) {
  if (ZONE6_REAL) return climb(page, floor, ceiling);
  // (The highest built zone's room, shown in zone 6.)
  const by = ZONE5_REAL ? 10 : 20;
  await raiseFloors(page, by);
  await climb(
    page,
    floor - by,
    ceiling === undefined ? undefined : ceiling - by,
  );
}
const ZONE6_SIZES = [
  { ...DESKTOP, floors: [51, 55, 59] },
  {
    name: "844x390",
    width: 844,
    height: 390,
    phone: true,
    floors: [51, 55, 59],
  },
  {
    name: "667x375",
    width: 667,
    height: 375,
    phone: true,
    floors: [51, 55, 59],
  },
  { name: "ipad", width: 1180, height: 820, phone: true, floors: [51, 55, 59] },
];
for (const size of ZONE6_SIZES)
  for (const floor of size.floors)
    test(`zone 6: the Spire court on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climbZone6(page, floor);
        await page.waitForTimeout(600);
        const c = await court(page);
        const kind = floor === 55 ? "elite" : "wave";
        // Zone 6's platform floor and its own floor atlas.
        expect(c.floor).toBe("arena-floor-spire-z6");
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          `spire-court-6-${floor}`,
        );
        expect(c.sky).toBe(4);
        expect(c.surround).toBe(0);
        expect(c.pillars).toBe(0);
        expect(c.number).toBe(1);
        const layout = spireCourtLayout(floor, kind)!;
        expect(c.blocks).toHaveLength(layout.blocks.length);
        const shown = [...c.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        const feet = [...layout.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        feet.forEach((o, i) => {
          expect(shown[i].x).toBeLessThanOrEqual(o.x);
          expect(shown[i].x + shown[i].w).toBeGreaterThanOrEqual(o.x + o.w);
          expect(shown[i].depth).toBeCloseTo(2 + (o.y + o.h) / 10000, 6);
        });
        expect(c.stairs).toHaveLength(1);
        // Height: the zone's first floor untinted, higher ones a crimson
        // night (red leads green and blue).
        if (floor === 51) expect(c.tint).toBe(0xffffff);
        else {
          expect(c.tint).toBeLessThan(0xffffff);
          expect(c.tint >> 16).toBeGreaterThan(((c.tint >> 8) & 255) + 15);
          if (floor === 59)
            expect(c.tint >> 16).toBeGreaterThan(((c.tint >> 8) & 255) + 35);
        }
        await page.waitForTimeout(300);
        await snap(page, info, `spire-court-z6-floor-${floor}-${size.name}`);
        await shot6(page, `z6-floor-${floor}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/** Where the zone-6 readability check stands its Echoes (feet, world px). */
// (Clear of the cover on every layout and of a phone's touch buttons, as
// zones 4 and 5: on a flame tongue below the ring, by a corner brazier,
// near the bottom coping under a lantern's pool, by the top-right tongues.)
const ZONE6_SPOTS = ZONE4_SPOTS;
for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  for (const floor of [51, 55, 59])
    test(`zone 6: fighters, Echo rings, red warnings, fire champions and the floor number read on the ember court, floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(180_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climbZone6(page, floor);
        await page.waitForTimeout(400);
        const key = `spire-court-6-${floor}`;
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          key,
        );
        // The cover: warm fire-opal and lantern-lit pixels against its
        // basalt, and red lantern paper on it.
        const cover = await page.evaluate(
          ({ key }) => {
            const scene = (window as any).__spireGame.scene.getScene("arena");
            const tex = scene.textures.get(key);
            const f = tex.get("block0");
            const d = (tex.getSourceImage() as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
            let n = 0,
              fire = 0,
              paper = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] <= 200) continue;
              n++;
              const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
              const lum = 0.3 * r + 0.59 * g + 0.11 * b;
              if (lum > 150 && r - b > 80) fire++;
              if (r > 170 && r - g > 70 && r - b > 70) paper++;
            }
            return { fire: fire / n, paper: paper / n };
          },
          { key },
        );
        // The number: a dark groove round a bright inlay.
        const number = (await atlasPixels(page, key, "number")).map(
          (p) => p.lum,
        );
        const darkPx = number.filter((l) => l < 70),
          brightPx = number.filter((l) => l > 190);
        const dark = darkPx.length / number.length,
          bright = brightPx.length / number.length;
        const mean = (a: number[]) =>
          a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
        const inlay = mean(brightPx),
          groove = mean(darkPx);
        // The floor where fighters walk: dusky basalt (darker higher up).
        const ground = await floorColour(page);
        const groundLum = 0.3 * ground[0] + 0.59 * ground[1] + 0.11 * ground[2];
        const g = (l: number) => [l, l, l];
        const apart = (a: number[], b: number[]) =>
          Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const rings = {
          echo: apart(hex(0xa98bff), ground),
          echoLight: contrast(hex(0xa98bff), ground),
          enemy: apart(hex(0xff5d6c), ground),
          enemyLight: contrast(hex(0xff5d6c), ground),
          // The raids' red danger (0xff4059), and fire champions' wind-ups
          // in their own colours (Cindrake 0xff7a4f, Pyranda 0xff8a3d).
          danger: apart(hex(0xff4059), ground),
          dangerLight: contrast(hex(0xff4059), ground),
          cindrake: contrast(hex(0xff7a4f), ground),
          pyranda: contrast(hex(0xff8a3d), ground),
          hero: contrast([255, 255, 255], ground),
          inlay: contrast(g(inlay), g(groove)),
        };
        await page
          .waitForFunction(
            () =>
              [
                ...(window as any).__spireGame.scene
                  .getScene("arena")
                  .rigs.entries(),
              ].some(
                ([id, r]: [string, any]) =>
                  id.startsWith("echo") && r.root?.visible,
              ),
            undefined,
            { timeout: 15_000 },
          )
          .catch(() => {});
        // Everyone at fixed spots: the same picture on every run.
        await page.evaluate((spots) => {
          const w = window as any;
          const a = w.__spireArena;
          const place = (p: any, [x, y]: number[]) =>
            Object.assign(p, { x, y, vx: 0, vy: 0, angle: Math.PI / 2 });
          place(a.heroes()[0], [380, 470]);
          a.players
            .filter((p: any) => p.echo && p.hp > 0)
            .forEach((p: any, i: number) => place(p, spots[i % spots.length]));
          w.__spireStep(0);
        }, ZONE6_SPOTS);
        await page.waitForTimeout(900);
        const fighters = await fighterContrast(page);
        const shown = fighters.filter((f) => f.n > 60);
        const summary = shown.map((f) => ({
          id: f.id.slice(0, 10),
          n: f.n,
          seen: +f.seen.toFixed(3),
          contrast: +contrast(f.fighter, f.court).toFixed(2),
          fighterLum: Math.round(
            0.3 * f.fighter[0] + 0.59 * f.fighter[1] + 0.11 * f.fighter[2],
          ),
          courtLum: Math.round(
            0.3 * f.court[0] + 0.59 * f.court[1] + 0.11 * f.court[2],
          ),
        }));
        console.log(
          JSON.stringify({
            floor,
            size: size.name,
            real: ZONE6_REAL,
            cover,
            dark: +dark.toFixed(3),
            bright: +bright.toFixed(3),
            inlay: Math.round(inlay),
            groundLum: Math.round(groundLum),
            ground: ground.map(Math.round),
            rings: Object.fromEntries(
              Object.entries(rings).map(([k, v]) => [k, +v.toFixed(2)]),
            ),
            fighters: summary,
          }),
        );
        await shot6(page, `z6-floor-${floor}-read-${size.name}`);
        // Fire champions on the warm stone (the hero, above, as Cindrake
        // and Pyranda), and the darkest one (Duskveil) on the dusky basalt.
        const hot: Record<string, number> = {};
        for (const character of ["cindrake", "pyranda", "duskveil"]) {
          await page.evaluate((character) => {
            const w = window as any;
            const hero = w.__spireArena.heroes()[0];
            Object.assign(hero, { character, hp: hero.maxHp ?? hero.hp });
            w.__spireStep(0);
          }, character);
          // (Its rig is rebuilt for the new champion: measure once it shows.)
          let me:
            Awaited<ReturnType<typeof fighterContrast>>[number] | undefined;
          for (let i = 0; i < 6 && !(me && me.n > 60); i++) {
            await page.waitForTimeout(1000);
            me = (await fighterContrast(page)).find((f) => f.id === "me");
          }
          hot[character] = +(me?.seen ?? 0).toFixed(3);
          await shot6(page, `z6-floor-${floor}-read-${character}-${size.name}`);
        }
        console.log(JSON.stringify({ floor, size: size.name, hot }));
        // (Measured the same way on zone 5's champagne stone: Cindrake
        // 0.55–0.65, Pyranda 0.73–0.77, Duskveil 0.59–0.67; here Cindrake
        // 0.69–0.75, Pyranda 0.56–0.67, Duskveil 0.69–0.75. Pyranda's mid
        // reds sit near the basalt's lightness: she reads by hue, her dark
        // outlines and her white ring, as Sunbara on zone 5's gold stone.
        // A champion's idle pose moves the share by up to ±0.05.)
        expect(hot.cindrake).toBeGreaterThan(0.6);
        expect(hot.pyranda).toBeGreaterThan(0.5);
        expect(hot.duskveil).toBeGreaterThan(0.6);
        expect(cover.fire).toBeGreaterThan(0.03);
        expect(cover.paper).toBeGreaterThan(0.005);
        expect(dark).toBeGreaterThan(0.15);
        expect(bright).toBeGreaterThan(0.2);
        expect(inlay).toBeGreaterThan(190);
        expect(rings.inlay).toBeGreaterThan(6);
        // Dusky basalt: dark enough that red and orange (warnings, enemy
        // rings, fire champions) stand out by lightness, never black.
        expect(groundLum).toBeGreaterThan(50);
        expect(groundLum).toBeLessThan(110);
        expect(rings.echo).toBeGreaterThan(150);
        expect(rings.echoLight).toBeGreaterThan(3);
        expect(rings.enemy).toBeGreaterThan(140);
        expect(rings.enemyLight).toBeGreaterThan(2.5);
        expect(rings.danger).toBeGreaterThan(130);
        expect(rings.dangerLight).toBeGreaterThan(2.2);
        expect(rings.cindrake).toBeGreaterThan(2.8);
        expect(rings.pyranda).toBeGreaterThan(3);
        expect(rings.hero).toBeGreaterThan(6);
        // Every fighter in view stands out from the court under it.
        expect(shown.length).toBeGreaterThanOrEqual(2);
        const echoes = summary.filter((f) => f.id.startsWith("echo"));
        expect(echoes.length).toBeGreaterThanOrEqual(1);
        for (const f of echoes) expect(f.seen).toBeGreaterThan(0.58);
        expect(
          echoes.reduce((a, f) => a + f.seen, 0) / echoes.length,
        ).toBeGreaterThan(0.6);
        for (const f of summary)
          if (!f.id.startsWith("echo")) expect(f.seen).toBeGreaterThan(0.65);
        await snap(
          page,
          info,
          `spire-court-z6-floor-${floor}-read-${size.name}`,
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/**
 * How Lumiwick's own cues read on a Sky Terrace floor picture (test-side,
 * from the baked floor only: the braziers' rings and arcs, the flame ring,
 * the burning ground and the dive lanes are drawn live on top). Round each
 * brazier's standing radius (its teal or gold ring and the progress arc
 * on it), and across the terrace's middle (where the flame ring sweeps,
 * the ground burns and the dives land): the floor's mean colour there.
 */
function terraceReadability(page: Page, key: string) {
  return page.evaluate(
    ({ key, braziers, radius }) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const image = scene.textures.get(key).getSourceImage() as
        HTMLCanvasElement | HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 450;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(image, 0, 0, 800, 450);
      const d = ctx.getImageData(0, 0, 800, 450).data;
      const meanOf = (pts: [number, number][]) => {
        const m = [0, 0, 0];
        let n = 0;
        for (const [x, y] of pts) {
          const px = Math.round(x / 2),
            py = Math.round(y / 2);
          if (px < 0 || py < 0 || px >= 800 || py >= 450) continue;
          const i = (py * 800 + px) * 4;
          for (let k = 0; k < 3; k++) m[k] += d[i + k];
          n++;
        }
        return m.map((v) => v / Math.max(1, n));
      };
      const ring = (x: number, y: number, r0: number, r1: number) => {
        const pts: [number, number][] = [];
        for (let a = 0; a < 96; a++)
          for (let r = r0; r <= r1; r += 2)
            pts.push([
              x + Math.cos((a / 96) * Math.PI * 2) * r,
              y + Math.sin((a / 96) * Math.PI * 2) * r,
            ]);
        return meanOf(pts);
      };
      const box: [number, number][] = [];
      for (let y = 200; y <= 700; y += 6)
        for (let x = 340; x <= 1260; x += 6) box.push([x, y]);
      return {
        braziers: braziers.map((b: { x: number; y: number }) =>
          ring(b.x, b.y, radius - 6, radius + 6),
        ),
        middle: meanOf(box),
      };
    },
    { key, braziers: EMBERWING.braziers, radius: EMBERWING.brazierRadius },
  );
}
function terraceScores(f: Awaited<ReturnType<typeof terraceReadability>>) {
  const apart = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const min = (xs: number[]) => Math.min(...xs);
  // The brazier arcs (raid-emberwing-terrace-rig.ts): the teal progress
  // band and its pale core, the gold time-left band, and their dark seat;
  // the flame ring's pale edge, the burning ground's outline, the dive
  // lane's edges and the raids' red danger.
  return {
    teal: min(f.braziers.map((b) => contrast(hex(0x5fd9bd), b))),
    tealHue: min(f.braziers.map((b) => apart(hex(0x5fd9bd), b))),
    tealCore: min(f.braziers.map((b) => contrast(hex(0xe4fff7), b))),
    gold: min(f.braziers.map((b) => contrast(hex(0xffdb8d), b))),
    seat: min(f.braziers.map((b) => contrast(hex(0x0e0603), b))),
    flameRing: contrast(hex(0xffce87), f.middle),
    patch: contrast(hex(0xffac6f), f.middle),
    lane: contrast(hex(0xffa76a), f.middle),
    danger: apart(hex(0xff4059), f.middle),
  };
}
/** Sky Terrace pieces the arena shows (its atlas's images). */
async function terracePieceCount(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__spireGame.scene.getScene("arena");
    let n = 0;
    const walk = (o: any) => {
      if (!o?.visible) return;
      if (o.list) o.list.forEach(walk);
      else if (o.texture?.key === "ember-terrace-atlas") n++;
    };
    scene.children.list.forEach(walk);
    return n;
  });
}

test("floor 60: Lumiwick's Sky Terrace with its summit grade, painted on floor 59, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 59;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    // Test-only path (the rooms harness has no floor 60 yet): Lumiwick's
    // raid room carrying a climb's state from a real Spire room, shown as
    // floor 59 cleared (the party may climb to 60), then as floor 60.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 9, ceiling: 10 });
      const climb = JSON.parse(JSON.stringify(w.__snap.raid.spire));
      w.__room("raid", { boss: "emberwing" });
      w.__snap.remaining = 300;
      w.__snap.raid.spire = {
        ...climb,
        zone: 6,
        floor: 59,
        kind: "wave",
        ceiling: 60,
        clearedAt: w.__snap.raid.time ?? 1,
      };
    });
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await page.waitForFunction(
      () =>
        !!(window as any).__spireGame?.scene.getScene("arena")?.floor?.texture,
    );
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor.texture.key as string,
          artwork: s.floor.texture.getSourceImage().dataset?.raidArtwork as
            string | undefined,
          summitArt: s.textures.exists("arena-floor-spire-summit-terrace:art"),
        };
      });
    await expect
      .poll(async () => (await scene()).floor)
      .toBe("arena-floor-spire-z6");
    // Floor 59's stairs are open: the terrace's summit is painted now.
    await expect.poll(async () => (await scene()).summitArt).toBe(true);
    await shot6(page, "z6-floor-59-stairs-open-844x390");
    floorNow = 60;
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.spire = {
        ...w.__snap.raid.spire,
        floor: 60,
        kind: "boss",
        clearedAt: undefined,
      };
      w.__push();
    });
    await expect
      .poll(async () => (await scene()).artwork)
      .toBe("spire-summit-terrace");
    expect((await scene()).floor).toBe("arena-floor-spire-summit-terrace:art");
    // The terrace's picture was fetched on floor 59 (or before), never on 60.
    expect(art.some((a) => a.url.includes("emberwing"))).toBe(true);
    expect(art.every((a) => a.floor === 59)).toBe(true);
    const c = await court(page);
    expect(c.sky).toBe(4);
    expect(c.blocks).toEqual([]);
    // Its own floor draws the terrace (braziers, their rings) on top.
    await expect.poll(() => terracePieceCount(page)).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-floor-60-terrace-summit-844x390");
    await shot6(page, "z6-floor-60-terrace-summit-844x390");
    // The raid's own floor, painted beside it (test-side only: it never
    // shows), to measure against.
    await page.evaluate(() =>
      (window as any).__spireGame.scene
        .getScene("arena")
        .floorTexture("sky-terrace"),
    );
    await page.waitForFunction(() =>
      (window as any).__spireGame.scene
        .getScene("arena")
        .textures.exists("arena-floor-sky-terrace:art"),
    );
    // Graded: darker and redder overall (green drops most), the middle
    // (the braziers, the dive lanes, every warning) kept most of its light.
    const light = await page.evaluate(() => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const measure = (key: string) => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(scene.textures.get(key).getSourceImage(), 0, 0, 160, 90);
        const box = (x: number, y: number, w: number, h: number) => {
          const d = ctx.getImageData(x, y, w, h).data;
          let lum = 0,
            red = 0;
          for (let i = 0; i < d.length; i += 4) {
            lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
            red += d[i] - d[i + 1];
          }
          return { lum: lum / (d.length / 4), red: red / (d.length / 4) };
        };
        return { all: box(0, 0, 160, 90), middle: box(40, 22, 80, 46) };
      };
      return {
        graded: measure("arena-floor-spire-summit-terrace:art"),
        plain: measure("arena-floor-sky-terrace:art"),
      };
    });
    const graded = terraceScores(
        await terraceReadability(page, "arena-floor-spire-summit-terrace:art"),
      ),
      plain = terraceScores(
        await terraceReadability(page, "arena-floor-sky-terrace:art"),
      );
    console.log(JSON.stringify({ light, graded, plain }));
    expect(light.graded.all.lum).toBeLessThan(light.plain.all.lum * 0.9);
    expect(light.graded.all.red).toBeGreaterThan(light.plain.all.red);
    expect(light.graded.middle.lum).toBeGreaterThan(
      light.plain.middle.lum * 0.75,
    );
    // Lumiwick's brazier cues and fire warnings read at least as well as
    // in the raid (they are light colours: they gain on the deeper floor),
    // the teal ring stands as far from the floor's colour, the red danger
    // too.
    expect(graded.teal).toBeGreaterThanOrEqual(plain.teal * 0.98);
    expect(graded.tealHue).toBeGreaterThanOrEqual(plain.tealHue * 0.98);
    expect(graded.tealCore).toBeGreaterThanOrEqual(plain.tealCore * 0.98);
    expect(graded.gold).toBeGreaterThanOrEqual(plain.gold * 0.98);
    expect(graded.flameRing).toBeGreaterThanOrEqual(plain.flameRing * 0.98);
    expect(graded.patch).toBeGreaterThanOrEqual(plain.patch * 0.98);
    expect(graded.lane).toBeGreaterThanOrEqual(plain.lane * 0.98);
    expect(graded.danger).toBeGreaterThanOrEqual(plain.danger * 0.9);
    // (The arcs' dark seat loses some contrast on the deeper floor, as
    // their bright bands gain. Held so it never sinks further.)
    expect(graded.seat).toBeGreaterThan(plain.seat * 0.75);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("Lumiwick's own raid keeps the Sky Terrace ungraded", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "emberwing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__spireGame.scene.getScene("arena").floor.texture
              .key,
        ),
      )
      .toMatch(/^arena-floor-sky-terrace(:art)?$/);
    expect(
      await page.evaluate(() =>
        (window as any).__spireGame.scene
          .getScene("arena")
          .textures.getTextureKeys()
          .filter((k: string) => k.startsWith("arena-floor-spire-summit")),
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// Once zone 6's rooms are built (SPIRE_BUILT_TOP reaches 60), a real climb:
// floor 51 on the Spire's court, then floor 59 beaten with floor 60 open,
// its court (the terrace's summit) painted while the stairs are open and
// shown on floor 60 with nothing fetched mid-fight.
test("zone 6: Lumiwick's Sky Terrace kept to floor 60, painted on floor 59, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.skip(!ZONE6_REAL, "zone 6's rooms are not built yet");
  test.setTimeout(240_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 51;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    await climb(page, 51);
    await page.waitForTimeout(600);
    const c51 = await court(page);
    expect(c51.floor).toBe("arena-floor-spire-z6");
    expect(c51.blocks.length).toBeGreaterThan(0);
    expect(c51.stairs).toHaveLength(1);
    await frames(page);
    // No braziers: the terrace isn't drawn.
    expect(await terracePieceCount(page)).toBe(0);
    await shot6(page, "z6-real-floor-51-844x390");

    floorNow = 59;
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 59, stage: "playing", ceiling: 60 });
      w.__push();
    });
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor?.texture?.key as string,
          floors: (s.textures.getTextureKeys() as string[]).filter((k) =>
            k.startsWith("arena-floor-"),
          ),
        };
      });
    for (let i = 0; i < 12; i++) {
      const cleared = await page.evaluate(() => {
        const w = window as any;
        for (const p of w.__spireArena.players) if (p.echo) p.hp = 0;
        w.__spireStep(1.8);
        return w.__snap.raid.spire.clearedAt !== undefined;
      });
      if (cleared) break;
    }
    // While they are open, the next floor's court is painted: waited for
    // as on floor 29 (a fixed 1.5 s was too short for CI's runner, which
    // had not drawn a frame on the cleared floor yet, 19 Nov).
    await expect
      .poll(async () => (await scene()).floors, { timeout: 30_000 })
      .toContain("arena-floor-spire-summit-terrace:art");
    const ready = (await scene()).floors;
    floorNow = 60;
    await page.evaluate(() => (window as any).__spireStep(3));
    await expect
      .poll(() => page.evaluate(() => (window as any).__snap.raid.spire.floor))
      .toBe(60);
    await expect
      .poll(async () => (await scene()).floor)
      .not.toBe("arena-floor-spire-z6");
    const sixty = await scene();
    expect(sixty.floor).toBe("arena-floor-spire-summit-terrace:art");
    expect(ready).toContain(sixty.floor);
    expect(art.every((a) => a.floor !== 60)).toBe(true);
    await frames(page);
    await expect.poll(() => terracePieceCount(page)).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-z6-floor-60-844x390");
    await shot6(page, "z6-real-floor-60-844x390");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// ──────────────────────── Zone 7: Electric ────────────────────────
//
// Floors 61–69 take zone 7's Electric look (spireZoneTheme(7)): slate and
// steel paving with copper circuit traces and lightning bolts inlaid,
// tesla coils, electric yellow crystals, a thundercloud sky with baked
// lightning; floor 70 fights on the Storm Twins' Conductor Ring with a
// summit grade of its own. Zone 7's rooms are real (SPIRE_BUILT_TOP 70).
const SHOTS7 = process.env.ZONE7_SHOTS ?? process.env.VISUAL_SHOTS;
async function shot7(page: Page, name: string) {
  if (SHOTS7) await page.screenshot({ path: `${SHOTS7}/${name}.png` });
}
const ZONE7_SIZES = [
  { ...DESKTOP, floors: [61, 65, 69] },
  {
    name: "844x390",
    width: 844,
    height: 390,
    phone: true,
    floors: [61, 65, 69],
  },
  {
    name: "667x375",
    width: 667,
    height: 375,
    phone: true,
    floors: [61, 65, 69],
  },
  { name: "ipad", width: 1180, height: 820, phone: true, floors: [61, 69] },
];
for (const size of ZONE7_SIZES)
  for (const floor of size.floors)
    test(`zone 7: the Spire court on floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(150_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climb(page, floor);
        await page.waitForTimeout(600);
        const c = await court(page);
        const kind = floor === 65 ? "elite" : "wave";
        // Zone 7's platform floor and its own floor atlas.
        expect(c.floor).toBe("arena-floor-spire-z7");
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          `spire-court-7-${floor}`,
        );
        expect(c.sky).toBe(4);
        expect(c.surround).toBe(0);
        expect(c.pillars).toBe(0);
        expect(c.number).toBe(1);
        const layout = spireCourtLayout(floor, kind)!;
        expect(c.blocks).toHaveLength(layout.blocks.length);
        const shown = [...c.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        const feet = [...layout.blocks].sort((a, b) => a.x - b.x || a.y - b.y);
        feet.forEach((o, i) => {
          expect(shown[i].x).toBeLessThanOrEqual(o.x);
          expect(shown[i].x + shown[i].w).toBeGreaterThanOrEqual(o.x + o.w);
          expect(shown[i].depth).toBeCloseTo(2 + (o.y + o.h) / 10000, 6);
        });
        expect(c.stairs).toHaveLength(1);
        // Height: the zone's first floor untinted, higher ones a cold
        // storm night (blue leads red).
        if (floor === 61) expect(c.tint).toBe(0xffffff);
        else {
          expect(c.tint).toBeLessThan(0xffffff);
          expect(c.tint & 255).toBeGreaterThan((c.tint >> 16) + 15);
          if (floor === 69)
            expect(c.tint & 255).toBeGreaterThan((c.tint >> 16) + 35);
        }
        await page.waitForTimeout(300);
        await snap(page, info, `spire-court-z7-floor-${floor}-${size.name}`);
        await shot7(page, `z7-floor-${floor}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/** Where the zone-7 readability check stands its Echoes (feet, world px). */
// (Clear of the cover on every layout and of a phone's touch buttons, as
// zones 4 to 6: on a circuit trace below the ring, by a corner coil, near
// the bottom coping, by the top-right traces.)
const ZONE7_SPOTS = ZONE4_SPOTS;
for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  for (const floor of [61, 65, 69])
    test(`zone 7: fighters, Echo rings, yellow and blue warnings and the floor number read on the storm court, floor ${floor} at ${size.name}`, async ({
      browser,
    }, info) => {
      test.setTimeout(180_000);
      const context = await courtContext(browser, {
        viewport: { width: size.width, height: size.height },
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await hookGame(page);
        const errors = await openHub(page);
        await climb(page, floor);
        await page.waitForTimeout(400);
        const key = `spire-court-7-${floor}`;
        await page.waitForFunction(
          (key) =>
            (window as any).__spireGame.scene
              .getScene("arena")
              .textures.exists(key),
          key,
        );
        // The cover: electric yellow crystal and bolt plates against its
        // slate.
        const cover = await page.evaluate(
          ({ key }) => {
            const scene = (window as any).__spireGame.scene.getScene("arena");
            const tex = scene.textures.get(key);
            const f = tex.get("block0");
            const d = (tex.getSourceImage() as HTMLCanvasElement)
              .getContext("2d")!
              .getImageData(f.cutX, f.cutY, f.cutWidth, f.cutHeight).data;
            let n = 0,
              yellow = 0;
            for (let i = 0; i < d.length; i += 4) {
              if (d[i + 3] <= 200) continue;
              n++;
              const [r, g, b] = [d[i], d[i + 1], d[i + 2]];
              if (r > 200 && g > 160 && b < 120) yellow++;
            }
            return { yellow: yellow / n };
          },
          { key },
        );
        // The number: a dark groove round a bright inlay.
        const number = (await atlasPixels(page, key, "number")).map(
          (p) => p.lum,
        );
        const darkPx = number.filter((l) => l < 70),
          brightPx = number.filter((l) => l > 190);
        const dark = darkPx.length / number.length,
          bright = brightPx.length / number.length;
        const mean = (a: number[]) =>
          a.reduce((x, y) => x + y, 0) / Math.max(1, a.length);
        const inlay = mean(brightPx),
          groove = mean(darkPx);
        // The floor where fighters walk: cool slate (darker higher up).
        const ground = await floorColour(page);
        const groundLum = 0.3 * ground[0] + 0.59 * ground[1] + 0.11 * ground[2];
        const g = (l: number) => [l, l, l];
        const apart = (a: number[], b: number[]) =>
          Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
        const rings = {
          echo: apart(hex(0xa98bff), ground),
          echoLight: contrast(hex(0xa98bff), ground),
          enemy: apart(hex(0xff5d6c), ground),
          enemyLight: contrast(hex(0xff5d6c), ground),
          danger: apart(hex(0xff4059), ground),
          dangerLight: contrast(hex(0xff4059), ground),
          // Electric yellow (+) and blue (−): the polarity marks (the
          // floor-65 captain borrows the twins' polarity) and pad, chain
          // lightning's yellow and the static field's blue.
          plus: contrast(hex(0xffda85), ground),
          plusHue: apart(hex(0xffda85), ground),
          minus: contrast(hex(0x8edfff), ground),
          minusHue: apart(hex(0x8edfff), ground),
          chain: contrast(hex(0xffdc85), ground),
          field: contrast(hex(0xabc7ff), ground),
          hero: contrast([255, 255, 255], ground),
          inlay: contrast(g(inlay), g(groove)),
        };
        await page
          .waitForFunction(
            () =>
              [
                ...(window as any).__spireGame.scene
                  .getScene("arena")
                  .rigs.entries(),
              ].some(
                ([id, r]: [string, any]) =>
                  id.startsWith("echo") && r.root?.visible,
              ),
            undefined,
            { timeout: 15_000 },
          )
          .catch(() => {});
        // Everyone at fixed spots: the same picture on every run.
        await page.evaluate((spots) => {
          const w = window as any;
          const a = w.__spireArena;
          const place = (p: any, [x, y]: number[]) =>
            Object.assign(p, { x, y, vx: 0, vy: 0, angle: Math.PI / 2 });
          place(a.heroes()[0], [380, 470]);
          a.players
            .filter((p: any) => p.echo && p.hp > 0)
            .forEach((p: any, i: number) => place(p, spots[i % spots.length]));
          w.__spireStep(0);
        }, ZONE7_SPOTS);
        await page.waitForTimeout(900);
        const fighters = await fighterContrast(page);
        const shown = fighters.filter((f) => f.n > 60);
        const summary = shown.map((f) => ({
          id: f.id.slice(0, 10),
          n: f.n,
          seen: +f.seen.toFixed(3),
          contrast: +contrast(f.fighter, f.court).toFixed(2),
          fighterLum: Math.round(
            0.3 * f.fighter[0] + 0.59 * f.fighter[1] + 0.11 * f.fighter[2],
          ),
          courtLum: Math.round(
            0.3 * f.court[0] + 0.59 * f.court[1] + 0.11 * f.court[2],
          ),
        }));
        const echoes = summary.filter((f) => f.id.startsWith("echo"));
        console.log(
          JSON.stringify({
            floor,
            size: size.name,
            cover,
            dark: +dark.toFixed(3),
            bright: +bright.toFixed(3),
            inlay: Math.round(inlay),
            groundLum: Math.round(groundLum),
            ground: ground.map(Math.round),
            rings: Object.fromEntries(
              Object.entries(rings).map(([k, v]) => [k, +v.toFixed(2)]),
            ),
            fighters: summary,
            echoWorst: Math.min(...echoes.map((f) => f.seen)),
            echoMean: +(
              echoes.reduce((a, f) => a + f.seen, 0) / echoes.length
            ).toFixed(3),
          }),
        );
        await shot7(page, `z7-floor-${floor}-read-${size.name}`);
        expect(cover.yellow).toBeGreaterThan(0.02);
        expect(dark).toBeGreaterThan(0.15);
        expect(bright).toBeGreaterThan(0.2);
        expect(inlay).toBeGreaterThan(190);
        expect(rings.inlay).toBeGreaterThan(6);
        // Cool mid-dark slate: dark enough that the light cues (yellow,
        // blue, pink, violet) stand out by lightness, never black.
        expect(groundLum).toBeGreaterThan(45);
        expect(groundLum).toBeLessThan(105);
        expect(rings.echo).toBeGreaterThan(150);
        expect(rings.echoLight).toBeGreaterThan(3);
        expect(rings.enemy).toBeGreaterThan(150);
        expect(rings.enemyLight).toBeGreaterThan(2.5);
        expect(rings.danger).toBeGreaterThan(140);
        expect(rings.dangerLight).toBeGreaterThan(2.2);
        expect(rings.plus).toBeGreaterThan(5.5);
        expect(rings.plusHue).toBeGreaterThan(200);
        expect(rings.minus).toBeGreaterThan(5);
        expect(rings.minusHue).toBeGreaterThan(150);
        expect(rings.chain).toBeGreaterThan(5.5);
        expect(rings.field).toBeGreaterThan(4.5);
        expect(rings.hero).toBeGreaterThan(6);
        // Every fighter in view stands out from the court under it.
        expect(shown.length).toBeGreaterThanOrEqual(2);
        expect(echoes.length).toBeGreaterThanOrEqual(1);
        for (const f of echoes) expect(f.seen).toBeGreaterThan(0.58);
        expect(
          echoes.reduce((a, f) => a + f.seen, 0) / echoes.length,
        ).toBeGreaterThan(0.6);
        for (const f of summary)
          if (!f.id.startsWith("echo")) expect(f.seen).toBeGreaterThan(0.65);
        await snap(
          page,
          info,
          `spire-court-z7-floor-${floor}-read-${size.name}`,
        );
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

/**
 * How the Storm Twins' cues read on a Conductor Ring floor picture
 * (test-side, from the baked floor only: the beam, the polarity marks and
 * pad, the static fields, the rush lanes and the thunderclap rings are
 * drawn live on top). Round each post (where the Link Beam bends and the
 * post's charge glows), along the ring's filament (where the charge
 * pulses run), across the ring's middle (where the twins orbit, the beam
 * sweeps, the pad and fields land and the claps ring out) and over the
 * whole rush box (where the lanes run): the floor's mean colour there.
 */
function ringReadability(page: Page, key: string) {
  return page.evaluate(
    ({ key, posts, box }) => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const image = scene.textures.get(key).getSourceImage() as
        HTMLCanvasElement | HTMLImageElement;
      const c = document.createElement("canvas");
      c.width = 800;
      c.height = 450;
      const ctx = c.getContext("2d")!;
      ctx.drawImage(image, 0, 0, 800, 450);
      const d = ctx.getImageData(0, 0, 800, 450).data;
      const meanOf = (pts: [number, number][]) => {
        const m = [0, 0, 0];
        let n = 0;
        for (const [x, y] of pts) {
          const px = Math.round(x / 2),
            py = Math.round(y / 2);
          if (px < 0 || py < 0 || px >= 800 || py >= 450) continue;
          const i = (py * 800 + px) * 4;
          for (let k = 0; k < 3; k++) m[k] += d[i + k];
          n++;
        }
        return m.map((v) => v / Math.max(1, n));
      };
      const ring = (
        x: number,
        y: number,
        r0: number,
        r1: number,
        squash = 1,
      ) => {
        const pts: [number, number][] = [];
        for (let a = 0; a < 96; a++)
          for (let r = r0; r <= r1; r += 2)
            pts.push([
              x + Math.cos((a / 96) * Math.PI * 2) * r,
              y + Math.sin((a / 96) * Math.PI * 2) * r * squash,
            ]);
        return meanOf(pts);
      };
      const area = (x0: number, y0: number, x1: number, y1: number) => {
        const pts: [number, number][] = [];
        for (let y = y0; y <= y1; y += 6)
          for (let x = x0; x <= x1; x += 6) pts.push([x, y]);
        return meanOf(pts);
      };
      return {
        posts: posts.map((p: { x: number; y: number }) =>
          ring(p.x, p.y, 30, 70),
        ),
        filament: ring(800, 450, 700, 720, 360 / 710),
        middle: area(340, 200, 1260, 700),
        rush: area(box.x0, box.y0, box.x1, box.y1),
      };
    },
    { key, posts: STORM_TWINS.posts, box: STORM_TWINS.rush.box },
  );
}
function ringScores(f: Awaited<ReturnType<typeof ringReadability>>) {
  const apart = (a: number[], b: number[]) =>
    Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
  const min = (xs: number[]) => Math.min(...xs);
  // The twins' colours (raid-storm-twins-art.ts, raid-ring-pieces.ts COL).
  const where = [f.middle, f.rush];
  const on = (col: number) => min(where.map((b) => contrast(hex(col), b)));
  const hue = (col: number) => min(where.map((b) => apart(hex(col), b)));
  return {
    plusMark: on(0xffda85),
    plusHue: hue(0xffda85),
    minusMark: on(0x8edfff),
    minusHue: hue(0x8edfff),
    plusPad: on(0xffd579),
    minusPad: on(0x8adfff),
    linkWarn: on(0xff7799),
    linkWarnCore: on(0xffbdc9),
    linkHue: hue(0xff7799),
    beamGold: min(
      [...f.posts, f.middle].map((b) => contrast(hex(0xffe18b), b)),
    ),
    beamCyan: min(
      [...f.posts, f.middle].map((b) => contrast(hex(0x9ce4ff), b)),
    ),
    beamBand: on(0xffdc8d),
    rush: contrast(hex(0xff6f95), f.rush),
    rushEdge: contrast(hex(0xffbdc9), f.rush),
    chain: on(0xffdc85),
    field: on(0xa5c8ff),
    fieldHue: hue(0xa5c8ff),
    clap: on(0xabc7ff),
    filament: contrast(hex(0x9ce4ff), f.filament),
    danger: hue(0xff4059),
    // The polarity countdown's dark seat (it loses some on a deeper floor).
    seat: on(0x060a16),
  };
}
/** Conductor Ring pieces the arena shows (its atlas's images). */
async function ringPieceCount(page: Page) {
  return page.evaluate(() => {
    const scene = (window as any).__spireGame.scene.getScene("arena");
    let n = 0;
    const walk = (o: any) => {
      if (!o?.visible) return;
      if (o.list) o.list.forEach(walk);
      else if (o.texture?.key === "ring-atlas") n++;
    };
    scene.children.list.forEach(walk);
    return n;
  });
}

test("floor 70: the Storm Twins' Conductor Ring with its summit grade, painted on floor 69, nothing fetched mid-fight", async ({
  browser,
}, info) => {
  test.setTimeout(180_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const art: { url: string; floor: number }[] = [];
    let floorNow = 69;
    page.on("request", (r) => {
      if (r.url().includes("/raid-arenas/"))
        art.push({ url: r.url(), floor: floorNow });
    });
    const errors = await openHub(page);
    // Test-only path: the twins' raid room carrying a climb's state from a
    // real Spire room, shown as floor 69 cleared (the party may climb to
    // 70), then as floor 70.
    await page.evaluate(() => {
      const w = window as any;
      w.__room("spire", { floor: 9, ceiling: 10 });
      const climb = JSON.parse(JSON.stringify(w.__snap.raid.spire));
      w.__room("raid", { boss: "storm-twins" });
      w.__snap.remaining = 300;
      w.__snap.raid.spire = {
        ...climb,
        zone: 7,
        floor: 69,
        kind: "wave",
        ceiling: 70,
        clearedAt: w.__snap.raid.time ?? 1,
      };
    });
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await page.waitForFunction(
      () =>
        !!(window as any).__spireGame?.scene.getScene("arena")?.floor?.texture,
    );
    const scene = () =>
      page.evaluate(() => {
        const s = (window as any).__spireGame.scene.getScene("arena");
        return {
          floor: s.floor.texture.key as string,
          artwork: s.floor.texture.getSourceImage().dataset?.raidArtwork as
            string | undefined,
          summitArt: s.textures.exists("arena-floor-spire-summit-ring:art"),
        };
      });
    await expect
      .poll(async () => (await scene()).floor)
      .toBe("arena-floor-spire-z7");
    // Floor 69's stairs are open: the ring's summit is painted now.
    await expect.poll(async () => (await scene()).summitArt).toBe(true);
    await shot7(page, "z7-floor-69-stairs-open-844x390");
    floorNow = 70;
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.raid.spire = {
        ...w.__snap.raid.spire,
        floor: 70,
        kind: "boss",
        clearedAt: undefined,
      };
      w.__push();
    });
    await expect
      .poll(async () => (await scene()).artwork)
      .toBe("spire-summit-ring");
    expect((await scene()).floor).toBe("arena-floor-spire-summit-ring:art");
    // The ring's picture was fetched on floor 69 (or before), never on 70.
    expect(art.some((a) => a.url.includes("storm-twins"))).toBe(true);
    expect(art.every((a) => a.floor === 69)).toBe(true);
    const c = await court(page);
    expect(c.sky).toBe(4);
    expect(c.blocks).toEqual([]);
    // Its own floor draws the ring (posts, filament pulses) on top.
    await expect.poll(() => ringPieceCount(page)).toBeGreaterThan(0);
    await page.waitForTimeout(500);
    await snap(page, info, "spire-court-floor-70-ring-summit-844x390");
    await shot7(page, "z7-floor-70-ring-summit-844x390");
    // The raid's own floor, painted beside it (test-side only: it never
    // shows), to measure against.
    await page.evaluate(() =>
      (window as any).__spireGame.scene
        .getScene("arena")
        .floorTexture("conductor-ring"),
    );
    await page.waitForFunction(() =>
      (window as any).__spireGame.scene
        .getScene("arena")
        .textures.exists("arena-floor-conductor-ring:art"),
    );
    // Graded: darker and cooler overall, the middle (the posts, the beam,
    // every warning) kept most of its light.
    const light = await page.evaluate(() => {
      const scene = (window as any).__spireGame.scene.getScene("arena");
      const measure = (key: string) => {
        const c = document.createElement("canvas");
        c.width = 160;
        c.height = 90;
        const ctx = c.getContext("2d")!;
        ctx.drawImage(scene.textures.get(key).getSourceImage(), 0, 0, 160, 90);
        const box = (x: number, y: number, w: number, h: number) => {
          const d = ctx.getImageData(x, y, w, h).data;
          let lum = 0,
            cool = 0;
          for (let i = 0; i < d.length; i += 4) {
            lum += 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
            cool += d[i + 2] - d[i];
          }
          return { lum: lum / (d.length / 4), cool: cool / (d.length / 4) };
        };
        return { all: box(0, 0, 160, 90), middle: box(40, 22, 80, 46) };
      };
      return {
        graded: measure("arena-floor-spire-summit-ring:art"),
        plain: measure("arena-floor-conductor-ring:art"),
      };
    });
    const graded = ringScores(
        await ringReadability(page, "arena-floor-spire-summit-ring:art"),
      ),
      plain = ringScores(
        await ringReadability(page, "arena-floor-conductor-ring:art"),
      );
    const round = (o: Record<string, number>) =>
      Object.fromEntries(Object.entries(o).map(([k, v]) => [k, +v.toFixed(2)]));
    console.log(
      JSON.stringify({ light, graded: round(graded), plain: round(plain) }),
    );
    expect(light.graded.all.lum).toBeLessThan(light.plain.all.lum * 0.9);
    expect(light.graded.all.cool).toBeGreaterThanOrEqual(
      light.plain.all.cool - 1,
    );
    expect(light.graded.middle.lum).toBeGreaterThan(
      light.plain.middle.lum * 0.75,
    );
    // Every twin cue reads at least as well as in the raid (they are light
    // colours: they gain on the deeper floor), and stands as far from the
    // floor's colour.
    for (const k of [
      "plusMark",
      "plusHue",
      "minusMark",
      "minusHue",
      "plusPad",
      "minusPad",
      "linkWarn",
      "linkWarnCore",
      "linkHue",
      "beamGold",
      "beamCyan",
      "beamBand",
      "rush",
      "rushEdge",
      "chain",
      "field",
      "fieldHue",
      "clap",
      "filament",
    ] as const)
      expect(graded[k], k).toBeGreaterThanOrEqual(plain[k] * 0.98);
    expect(graded.danger).toBeGreaterThanOrEqual(plain.danger * 0.9);
    // (The countdown's dark seat loses some contrast on the deeper floor,
    // as the bright cues gain. Held so it never sinks further.)
    expect(graded.seat).toBeGreaterThan(plain.seat * 0.75);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("the Storm Twins' own raid keeps the Conductor Ring ungraded", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await courtContext(browser, {
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await hookGame(page);
    const errors = await openHub(page);
    await page.evaluate(() =>
      (window as any).__room("raid", { boss: "storm-twins" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    await pushUntilBattle(page);
    await expect
      .poll(() =>
        page.evaluate(
          () =>
            (window as any).__spireGame.scene.getScene("arena").floor.texture
              .key,
        ),
      )
      .toMatch(/^arena-floor-conductor-ring(:art)?$/);
    expect(
      await page.evaluate(() =>
        (window as any).__spireGame.scene
          .getScene("arena")
          .textures.getTextureKeys()
          .filter((k: string) => k.startsWith("arena-floor-spire-summit")),
      ),
    ).toEqual([]);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

// A real climb: floor 61 on the Spire's court, then floor 69 beaten with
// floor 70 open, its court (the ring's summit) painted while the stairs
// are open and shown on floor 70 with nothing fetched mid-fight.
for (const size of [
  { name: "844x390", width: 844, height: 390 },
  { name: "667x375", width: 667, height: 375 },
])
  test(`zone 7: the twins' Conductor Ring kept to floor 70, painted on floor 69, nothing fetched mid-fight, at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(240_000);
    const context = await courtContext(browser, {
      viewport: { width: size.width, height: size.height },
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      await hookGame(page);
      const art: { url: string; floor: number }[] = [];
      let floorNow = 61;
      page.on("request", (r) => {
        if (r.url().includes("/raid-arenas/"))
          art.push({ url: r.url(), floor: floorNow });
      });
      const errors = await openHub(page);
      await climb(page, 61);
      await page.waitForTimeout(600);
      const c61 = await court(page);
      expect(c61.floor).toBe("arena-floor-spire-z7");
      expect(c61.blocks.length).toBeGreaterThan(0);
      expect(c61.stairs).toHaveLength(1);
      await frames(page);
      // No posts: the ring isn't drawn.
      expect(await ringPieceCount(page)).toBe(0);
      await shot7(page, `z7-real-floor-61-${size.name}`);

      floorNow = 69;
      await page.evaluate(() => {
        const w = window as any;
        w.__room("spire", { floor: 69, stage: "playing", ceiling: 70 });
        w.__push();
      });
      const scene = () =>
        page.evaluate(() => {
          const s = (window as any).__spireGame.scene.getScene("arena");
          return {
            floor: s.floor?.texture?.key as string,
            floors: (s.textures.getTextureKeys() as string[]).filter((k) =>
              k.startsWith("arena-floor-"),
            ),
          };
        });
      for (let i = 0; i < 12; i++) {
        const cleared = await page.evaluate(() => {
          const w = window as any;
          for (const p of w.__spireArena.players) if (p.echo) p.hp = 0;
          w.__spireStep(1.8);
          return w.__snap.raid.spire.clearedAt !== undefined;
        });
        if (cleared) break;
      }
      // While they are open, the next floor's court is painted: waited for
      // as on floor 29 (a fixed 1.5 s was too short for CI's runner, which
      // had not drawn a frame on the cleared floor yet, 19 Nov).
      await expect
        .poll(async () => (await scene()).floors, { timeout: 30_000 })
        .toContain("arena-floor-spire-summit-ring:art");
      const ready = (await scene()).floors;
      await shot7(page, `z7-real-floor-69-cleared-${size.name}`);
      floorNow = 70;
      await page.evaluate(() => (window as any).__spireStep(3));
      await expect
        .poll(() =>
          page.evaluate(() => (window as any).__snap.raid.spire.floor),
        )
        .toBe(70);
      await expect
        .poll(async () => (await scene()).floor)
        .not.toBe("arena-floor-spire-z7");
      const seventy = await scene();
      expect(seventy.floor).toBe("arena-floor-spire-summit-ring:art");
      expect(ready).toContain(seventy.floor);
      expect(art.every((a) => a.floor !== 70)).toBe(true);
      await frames(page);
      await expect.poll(() => ringPieceCount(page)).toBeGreaterThan(0);
      await page.waitForTimeout(800);
      await snap(page, info, `spire-court-z7-floor-70-${size.name}`);
      await shot7(page, `z7-real-floor-70-${size.name}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

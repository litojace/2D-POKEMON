import { expect, test, type Page } from "@playwright/test";
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
        // The whole court is in view and fills the frame (the raid camera).
        expect(c.view.w).toBeGreaterThanOrEqual(1599);
        expect(c.view.h).toBeGreaterThanOrEqual(899);
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
  const context = await browser.newContext({
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
  const context = await browser.newContext({
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
  const context = await browser.newContext({
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
  const context = await browser.newContext({
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
      const context = await browser.newContext({
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
      const context = await browser.newContext({
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
  const context = await browser.newContext({
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
      const context = await browser.newContext({
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
      const context = await browser.newContext({
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
  const context = await browser.newContext({
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
  const context = await browser.newContext({
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

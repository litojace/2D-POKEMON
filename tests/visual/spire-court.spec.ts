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

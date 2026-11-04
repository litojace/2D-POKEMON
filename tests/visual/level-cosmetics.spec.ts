import { expect, test, type Page } from "@playwright/test";
import {
  box,
  inside,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
  type Box,
} from "./helpers";

// The Journey's Lv 55–100 cosmetics (migration 051): each one in the
// Wardrobe, in the Journey and worn in a real match, on a desktop and
// on a phone in landscape.
const ITEMS = [
  { id: "prism-frame", slot: "frame", name: "Prism frame" },
  { id: "nova-entrance", slot: "entrance", name: "Nova entrance" },
  { id: "starlit-colors", slot: "skin", name: "Starlit colors" },
  { id: "solar-aura", slot: "aura", name: "Solar aura" },
  { id: "eclipse-finale", slot: "victory", name: "Eclipse finale" },
  { id: "prismatic-laurel", slot: "frame", name: "Prismatic laurel" },
  { id: "element-master-frame", slot: "frame", name: "Element Master frame" },
] as const;
const FRAMES = ITEMS.filter((i) => i.slot === "frame").map((i) => i.id);
/** Everything worn at once in the match. */
const OUTFIT = {
  frame: "element-master-frame",
  entrance: "nova-entrance",
  skin: "starlit-colors",
  aura: "solar-aura",
  victory: "eclipse-finale",
};
const SIZES = [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
];

async function fixtures(page: Page, loadout: Record<string, string> = {}) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker = 'window.dispatchEvent(new Event("arena:ready"));';
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__account=accountsUI;" + marker),
    });
  });
  // Record which effects the real code draws, and for which item.
  await page.addInitScript(() => ((window as any).__fxSeen = new Set()));
  const instrument = async (
    pattern: RegExp,
    hooks: [marker: string, kind: string][],
  ) =>
    page.route(pattern, async (route) => {
      const response = await route.fetch();
      let body = await response.text();
      for (const [marker, kind] of hooks) {
        expect(body).toContain(marker);
        body = body.replace(
          marker,
          `globalThis.__fxSeen?.add("${kind}:" + id);` + marker,
        );
      }
      await route.fulfill({ response, body });
    });
  await instrument(/\/skins\/collection-fx\.ts(?:\?|$)/, [
    [
      "if (!drawCollectionAuraBase(g, id, x, y, now, reduced, front, flat, lift)) return false;",
      "aura",
    ],
    // Served as plain JavaScript (Vite strips the types).
    ["const emit = (p) => emit0({ ...p, glow: true });", "entrance"],
    ["const emit0 = emit;", "victory"],
  ]);
  await instrument(/\/skins\/colors-fx\.ts(?:\?|$)/, [
    ["if (!isColors(id)) return false;", "skin"],
  ]);
  await page.route(/\/fake-api\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      body: `${await response.text()}
window.__loadout=${JSON.stringify(loadout)};
window.__equips=[];
const levelProgress=()=>({v:1,stats:{},unlocked:[],cosmetics:[],earned:[],loadout:{...window.__loadout}});
const previousLevelFetch=window.fetch.bind(window);
window.fetch=async(input,init)=>{
 const path=new URL(String(input),location.href).pathname;
 if(path==='/api/raids')return Response.json(levelProgress());
 if(path==='/api/raids/equip'){const q=JSON.parse(init.body);window.__equips.push(q);window.__loadout={...window.__loadout,[q.slot]:q.item};return Response.json({ok:true,progress:levelProgress()});}
 const response=await previousLevelFetch(input,init);
 if(path!=='/api/economy')return response;
 const body=await response.json();
 const ids=${JSON.stringify(ITEMS.map((i) => i.id))};
 body.owned.push(...ids);
 // Lv 100 (431,625 XP): every level reward earned.
 body.journey={...body.journey,xp:432000,unlocked:ids};
 body.looks={};
 return Response.json(body);
};`,
    });
  });
}

async function closePanel(page: Page) {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const d = document.querySelector<HTMLDialogElement>("#dialog")!;
        d.addEventListener("close", () => resolve(), { once: true });
        document.querySelector<HTMLButtonElement>("#close-dialog")!.click();
      }),
  );
}
/**
 * How far each frame's artwork reaches past the portrait, as a share of it
 * (journey-frames.css): the ring 20% each side; the Prism crest from 29%
 * above, the crown from 31%; the laurel's top star 17% above and its crest
 * to 21% below.
 */
const REACH: Record<string, [top: number, bottom: number]> = {
  "prism-frame": [0.29, 0.2],
  "prismatic-laurel": [0.17, 0.21],
  "element-master-frame": [0.31, 0.2],
};
const frameArt = (id: string, b: Box): Box => {
  const [top, bottom] = REACH[id];
  return {
    x: b.x - b.width * 0.2,
    y: b.y - b.height * top,
    width: b.width * 1.4,
    height: b.height * (1 + top + bottom),
  };
};
const pageFits = (page: Page) =>
  page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth + 1,
  );

for (const size of SIZES) {
  const phone = size.width < 1000;
  const tag = `${size.width}x${size.height}`;

  test(`each Lv 55–100 cosmetic previews and equips in the Wardrobe at ${tag}`, async ({
    browser,
  }, info) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      await fixtures(page);
      const errors = await openHub(page);
      // The Wardrobe (the fitting room, UI remodel step 2).
      await page.evaluate(() => (window as any).__account.showWardrobe());
      const wardrobe = page.locator('.fit-room[data-fit-mode="wardrobe"]');
      await expect(wardrobe).toBeVisible();
      for (const item of ITEMS) {
        await page.click(`[data-fit-slot="${item.slot}"]`);
        const tile = page.locator(`.fit-grid [data-ui-item="${item.id}"]`);
        await tile.scrollIntoViewIfNeeded();
        await expect(tile).toContainText(item.name);
        await expect(tile).toContainText("Journey reward");
        await expect(tile.locator(".ui-rarity")).toHaveText("Mythical");
        // The tile shows the item itself.
        const art = tile.locator(".ui-tile-art");
        expect(
          inside(
            (await art.boundingBox()) as Box,
            (await tile.boundingBox()) as Box,
          ),
        ).toBe(true);
        await tile.click();
        await expect(tile).toHaveAttribute("aria-pressed", "true");
        const stage = page.locator(".fit-stage .shop-live-stage");
        if (item.slot === "frame") {
          const frame = stage.locator(`[data-portrait-frame="${item.id}"]`);
          await expect(frame).toHaveAttribute("data-tier", "mythic");
          // Its own ring and crest (journey-frames.css), on top of the
          // Mythical edge.
          for (const pseudo of ["::before", "::after"])
            expect(
              await frame.evaluate(
                (el, p) => getComputedStyle(el, p).backgroundImage,
                pseudo,
              ),
            ).toContain("data:image/svg+xml");
          // The whole artwork shows: nothing is clipped by the stage.
          const art = frameArt(item.id, (await frame.boundingBox()) as Box);
          const room = await box(page, ".fit-stage");
          expect(
            inside(art, room),
            `${item.id} ${JSON.stringify({ art, room })}`,
          ).toBe(true);
        } else {
          await expect(stage).toHaveClass(/is-ready/);
          const look = JSON.parse(
            decodeURIComponent(
              (await stage.getAttribute("data-preview-look")) ?? "%7B%7D",
            ),
          );
          expect(look[item.slot]).toBe(item.id);
          await expect(stage).toHaveAttribute(
            "data-preview-action",
            item.slot === "entrance" || item.slot === "victory"
              ? item.slot
              : "idle",
          );
        }
        await expect(page.locator(".fit-stage-name")).toHaveText(item.name);
        await page.waitForTimeout(item.slot === "victory" ? 1400 : 500);
        await snap(page, info, `level-cosmetic-wardrobe-${item.id}-${tag}`);
        // Equip it through the shared appearance route.
        const save = page.locator("[data-fit-save]");
        expect(
          inside(
            (await save.boundingBox()) as Box,
            await box(page, ".ui-panel-foot"),
          ),
        ).toBe(true);
        await save.click();
        await expect
          .poll(() => page.evaluate(() => (window as any).__equips.at(-1)))
          .toEqual({ slot: item.slot, item: item.id });
        await expect(
          page.locator(`[data-fit-slot="${item.slot}"] b`),
        ).toHaveText(item.name);
      }
      // The last frame equipped is the one in the header.
      await expect(
        page.locator("#account-profile [data-portrait-frame]"),
      ).toHaveAttribute("data-portrait-frame", "element-master-frame");
      expect(await pageFits(page)).toBe(true);
      expect(
        inside(await box(page, ".fit-room"), { x: 0, y: 0, ...size }),
      ).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`the Journey lists and equips the Lv 55–100 rewards at ${tag}`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      await fixtures(page);
      const errors = await openHub(page);
      await page.click('.lobby-rail [data-lobby-action="journey"]');
      const room = page.locator(".journey-room");
      await page.click('[data-ui-jtab="levels"]');
      await expect(room.locator(".journey-ring-text b")).toHaveText("100");
      for (const item of ITEMS) {
        const card = room.locator(
          `.journey-prize[data-journey-item="${item.id}"]`,
        );
        await expect(card).toContainText(item.name);
        await expect(card).toContainText("✓ Earned");
      }
      await expect(
        room.locator(".journey-prize").filter({ hasText: "Level 100" }),
      ).toHaveCount(2);
      const prism = room.locator('[data-journey-item="prism-frame"]');
      await prism.scrollIntoViewIfNeeded();
      await prism.click();
      // Picked: the action bar names it and pictures it.
      await expect(room.locator(".journey-foot-text b")).toHaveText(
        "Prism frame",
      );
      await expect(
        room.locator('.journey-foot-art [data-cosmetic="prism-frame"]'),
      ).toHaveCount(1);
      await snap(page, info, `level-cosmetic-journey-${tag}`);
      // Equip from the Journey: the shared appearance route, not the old
      // two-item one.
      await room.locator('[data-journey-equip="prism-frame"]').click();
      await expect
        .poll(() => page.evaluate(() => (window as any).__equips.at(-1)))
        .toEqual({ slot: "frame", item: "prism-frame" });
      await expect(
        room.locator('[data-journey-equip="prism-frame"]'),
      ).toContainText("Equipped");
      await expect(room.locator(".journey-status")).toHaveText("");
      await expect(
        page.locator("#account-profile [data-portrait-frame]"),
      ).toHaveAttribute("data-portrait-frame", "prism-frame");
      // The last card is reachable and nothing is wider than the panel.
      const last = room.locator('[data-journey-item="element-master-frame"]');
      await last.scrollIntoViewIfNeeded();
      await expect(last).toBeInViewport();
      const fit = await page.evaluate(() => {
        const d = document
          .querySelector(".journey-body")!
          .getBoundingClientRect();
        return [...document.querySelectorAll(".journey-prize")].every((el) => {
          const r = el.getBoundingClientRect();
          return r.left >= d.left - 0.5 && r.right <= d.right + 0.5;
        });
      });
      expect(fit).toBe(true);
      expect(await pageFits(page)).toBe(true);
      await snap(page, info, `level-cosmetic-journey-end-${tag}`);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

  test(`the Lv 55–100 cosmetics are worn in a match at ${tag}`, async ({
    browser,
  }, info) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: phone,
      hasTouch: phone,
    });
    try {
      const page = await context.newPage();
      await fixtures(page, OUTFIT);
      const errors = await openHub(page);
      await page.evaluate((look) => {
        const w = window as any;
        // The real spawn points, clear of the round banners.
        w.__room("pvp", { mode: "duel", phase: "lobby" });
        w.__snap.players.find((p: any) => p.id === "me").raidLook = look;
      }, OUTFIT);
      await openPlayPanel(page);
      await page.click('[data-mode="duel"]');
      await page.click("#play-create");
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__push());
          return page.locator("body").getAttribute("class");
        })
        .toContain("lobby-active");
      const drawer = page.locator(".lobby-room-drawer > summary");
      if (await drawer.isVisible()) await drawer.click();
      // Each frame on the player's portrait in the match room.
      const own = page.locator("[data-me] .player-avatar");
      for (const frame of FRAMES) {
        await page.evaluate((frame) => {
          const a = (window as any).__account;
          a.raidLook = { ...a.raidLook, frame };
          a.hooks.onChange();
        }, frame);
        const framed = own.locator(`[data-portrait-frame="${frame}"]`);
        await expect(framed).toHaveAttribute("data-tier", "mythic");
        const avatar = await own.boundingBox();
        const row = await page.locator("[data-me]").boundingBox();
        expect(avatar!.height).toBeGreaterThan(20);
        expect(inside(avatar as Box, row as Box)).toBe(true);
        await snap(page, info, `level-cosmetic-match-room-${frame}-${tag}`);
      }
      // The round starts: the greeting plays the Nova entrance.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "countdown";
        w.__snap.remaining = 3;
        w.__fxSeen.clear();
      });
      await pushUntilBattle(page);
      await expect
        .poll(() => page.evaluate(() => [...(window as any).__fxSeen].sort()))
        .toEqual(
          expect.arrayContaining([
            "aura:solar-aura",
            "entrance:nova-entrance",
            "skin:starlit-colors",
          ]),
        );
      await snap(page, info, `level-cosmetic-match-entrance-${tag}`);
      // In play: the Solar aura under the fighter, in Starlit colors.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "playing";
        w.__snap.remaining = 90;
        w.__fxSeen.clear();
        w.__push();
      });
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__push());
          return page.evaluate(() => [...(window as any).__fxSeen].sort());
        })
        .toEqual(["aura:solar-aura", "skin:starlit-colors"]);
      await snap(page, info, `level-cosmetic-match-aura-${tag}`);
      // Winning the round plays the Eclipse finale.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "intermission";
        w.__snap.roundWinner = "me";
        w.__snap.remaining = 4;
        w.__fxSeen.clear();
        w.__push();
      });
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__push());
          return page.evaluate(() => [...(window as any).__fxSeen]);
        })
        .toContain("victory:eclipse-finale");
      await page.waitForTimeout(1500);
      await page.evaluate(() => (window as any).__push());
      await snap(page, info, `level-cosmetic-match-victory-${tag}`);
      // The battle canvas fills its frame and nothing scrolls.
      const game = await box(page, "#game"),
        canvas = await box(page, "#game canvas");
      expect(Math.abs(canvas.width - game.width)).toBeLessThanOrEqual(1);
      expect(await pageFits(page)).toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

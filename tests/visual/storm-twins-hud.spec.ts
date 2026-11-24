import { expect, test } from "@playwright/test";
import {
  openHub,
  pushUntilBattle,
  snap,
  openPlayPanel,
  createRoom,
} from "./helpers";

for (const viewport of [
  { width: 844, height: 390 },
  { width: 1280, height: 589 },
  { width: 844, height: 280 },
  { width: 1440, height: 900 },
]) {
  test(`both Storm Twins health bars stay inside the HUD at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const mobile = viewport.width < 1400;
    const context = await browser.newContext({
      viewport,
      isMobile: mobile,
      hasTouch: mobile,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("raid", { boss: "storm-twins" });
        w.__snap.players = w.__snap.players.filter(
          (p: any) => p.raidBoss || p.id === "me",
        );
        w.__snap.raid.partySize = 1;
      });
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      const geometry = await page.locator("#raid-hud").evaluate((hud) => {
        const measure = (el: Element) => {
          const r = el.getBoundingClientRect(),
            s = getComputedStyle(el);
          return {
            cls: el.className,
            x: r.x,
            right: r.right,
            y: r.y,
            bottom: r.bottom,
            width: r.width,
            minWidth: s.minWidth,
            gridArea: s.gridArea,
            columns: s.gridTemplateColumns,
            position: s.position,
          };
        };
        return {
          hud: measure(hud),
          children: [...hud.children].map(measure),
          health: [
            ...hud.querySelectorAll(
              ".raid-twin-health,.raid-twin-bar,.raid-twin-track,.raid-twin-bar > div:first-child,.raid-callout,.raid-boss-heading > span",
            ),
          ].map(measure),
          overflow: hud.scrollWidth - hud.clientWidth,
        };
      });
      await snap(page, info, `twins-hud-${viewport.width}x${viewport.height}`);
      expect(
        geometry.health.filter((r) => String(r.cls) === "raid-twin-track"),
      ).toHaveLength(2);
      for (const r of geometry.health) {
        expect(r.x).toBeGreaterThanOrEqual(geometry.hud.x - 1);
        expect(r.right).toBeLessThanOrEqual(geometry.hud.right + 1);
      }
      const tracks = geometry.health.filter(
        (r) => String(r.cls) === "raid-twin-track",
      );
      expect(tracks[0].right).toBeLessThan(tracks[1].x);
      expect(tracks[0].width).toBeCloseTo(tracks[1].width, 1);
      const gear = await page.locator("#battle-menu").boundingBox();
      expect(geometry.hud.right).toBeLessThanOrEqual(gear!.x + 1);
      expect(geometry.hud.right).toBeLessThanOrEqual(viewport.width);
      // A downed twin and a full party use the same bounded row.
      await page.evaluate(() => {
        const w = window as any,
          s = w.__snap;
        const hero = s.players.find((p: any) => p.id === "me");
        for (let i = 2; i <= 4; i++)
          s.players.push({ ...hero, id: `p${i}`, name: `Raider ${i}` });
        s.raid.partySize = 4;
        const twin = s.raid.twins[1];
        s.players.find((p: any) => p.id === twin.id).hp = 0;
        twin.reviveAt = s.time + 9;
        w.__push();
      });
      const bounded = () =>
        page.locator("#raid-hud").evaluate((hud) => {
          const h = hud.getBoundingClientRect();
          return [
            ...hud.querySelectorAll(
              ".raid-twin-health,.raid-twin-track,.raid-twin-bar > div:first-child,.raid-callout",
            ),
          ].every((el) => {
            const r = el.getBoundingClientRect();
            return r.x >= h.x - 1 && r.right <= h.right + 1;
          });
        });
      await expect.poll(bounded).toBe(true);
      await expect(page.locator(".raid-twin-bar").nth(1)).toContainText(
        "REVIVES IN 9s",
      );
      await snap(
        page,
        info,
        `twins-downed-${viewport.width}x${viewport.height}`,
      );
      if (viewport.width === 844 && viewport.height === 390) {
        await page.setViewportSize({ width: 844, height: 280 });
        await expect.poll(bounded).toBe(true);
        await page.setViewportSize(viewport);
        await expect.poll(bounded).toBe(true);
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

// The Polarity medallion (polarityMarkAt) sits beside its raider at chest
// height: over the head, the raid's old spot, a phone's name tag and health
// bar (`.battle-nameplate`) hid the sign.
for (const viewport of [
  { width: 667, height: 375 },
  { width: 844, height: 390 },
]) {
  test(`the Storm Twins' polarity marks clear every name tag at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const loop =
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch();
          const body = await response.text();
          expect(body).toContain(loop);
          await route.fulfill({
            response,
            body: body.replace(loop, "window.__twinsGame=gameInstance;" + loop),
          });
        },
      );
      const errors = await openHub(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("raid", { boss: "storm-twins" });
        w.__snap.raid.warnings = [];
        w.__snap.raid.decoys = [];
        // The raid itself, not the Spire or the Ascendant form.
        delete w.__snap.raid.spire;
        delete w.__snap.raid.variant;
      });
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      // Every living raider marked, spread over the court (one near its top).
      const marked = await page.evaluate(() => {
        const w = window as any,
          s = w.__snap;
        const raiders = s.players.filter((p: any) => !p.raidBoss && p.hp > 0);
        const spots = [
          [430, 470],
          [700, 250],
          [980, 560],
          [1250, 380],
        ];
        raiders.forEach((p: any, i: number) => {
          [p.x, p.y] = spots[i % spots.length];
        });
        s.raid.polarities = raiders.map((p: any, i: number) => ({
          playerId: p.id,
          sign: i % 2 ? -1 : 1,
          until: s.time + 6,
          cancelled: false,
        }));
        w.__push();
        return raiders.length;
      });
      expect(marked).toBeGreaterThan(0);
      const measure = () =>
        page.evaluate(() => {
          const w = window as any;
          const scene = w.__twinsGame.scene.getScene("arena"),
            cam = scene.cameras.main,
            canvas = w.__twinsGame.canvas as HTMLCanvasElement;
          const c = canvas.getBoundingClientRect(),
            k = c.width / canvas.width,
            v = cam.worldView;
          const stage = scene.children.list.find(
            (o: any) => o.name === "arena-pieces:ring-marks",
          );
          const plates = [
            ...document.querySelectorAll<HTMLElement>(".battle-nameplate"),
          ]
            .filter((e) => e.offsetWidth && !e.hidden)
            .map((e) => e.getBoundingClientRect());
          const marks = (stage?.visible ? stage.list : []).filter(
            (o: any) => o.name === "markBase" && o.visible,
          );
          return {
            plates: plates.length,
            marks: marks.length,
            hidden: marks.flatMap((o: any) => {
              const b = o.getBounds(),
                x0 = c.x + (cam.x + (b.x - v.x) * cam.zoom) * k,
                y0 = c.y + (cam.y + (b.y - v.y) * cam.zoom) * k,
                x1 = x0 + b.width * cam.zoom * k,
                y1 = y0 + b.height * cam.zoom * k;
              return plates.some(
                (p) => x1 > p.x && x0 < p.right && y1 > p.y && y0 < p.bottom,
              )
                ? [`${Math.round(b.centerX)},${Math.round(b.centerY)}`]
                : [];
            }),
          };
        });
      // Wait until every mark is drawn and the name tags have followed
      // their raiders, then judge.
      let last = await measure();
      await expect
        .poll(
          async () => {
            last = await measure();
            return last.marks;
          },
          { timeout: 15_000 },
        )
        .toBe(marked);
      await page.waitForTimeout(400);
      last = await measure();
      await snap(
        page,
        info,
        `twins-marks-${viewport.width}x${viewport.height}`,
      );
      expect(last.plates).toBeGreaterThanOrEqual(marked);
      expect(last.marks).toBe(marked);
      expect(last.hidden, "polarity marks under a name tag").toEqual([]);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

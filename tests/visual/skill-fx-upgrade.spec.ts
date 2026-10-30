import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";
const champions = [
  "voltkit",
  "cindrake",
  "tidefin",
  "auralynx",
  "lumoth",
  "mystowl",
  "terradon",
  "duskveil",
];
for (const viewport of [
  { width: 1280, height: 720 },
  { width: 844, height: 390 },
]) {
  test(`all champion skills render within budget at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    try {
      const page = await context.newPage(),
        errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.route("**/skill-review", (r) =>
        r.fulfill({
          contentType: "text/html",
          body: '<body style="margin:0;background:#122232"><h1 id="review-title" style="position:absolute;z-index:10;top:12px;left:24px;margin:0;color:#f3dfad;font:700 22px system-ui;pointer-events:none"></h1></body>',
        }),
      );
      await page.goto("/skill-review");
      await page.evaluate(async () => {
        const { reviewSkills } = await import("/skill-fx-review.ts");
        (window as any).__review = await reviewSkills();
      });
      for (const champion of champions) {
        for (let slot = 0; slot < 5; slot++) {
          const audit = await page.evaluate(
            ({ champion, slot }) =>
              (window as any).__review.capture(champion, slot),
            { champion, slot },
          );
          expect(audit.unchanged).toBe(true);
          expect(audit.stats.detail).toBeGreaterThan(0);
          for (const key of [
            "particles",
            "animations",
            "glows",
            "floorGlows",
            "softs",
          ] as const)
            expect(audit.stats[key], `${audit.id}: ${key}`).toBeLessThanOrEqual(
              audit.limits[key],
            );
          if (slot === 4)
            await snap(
              page,
              info,
              `skill-${champion}-${viewport.width}x${viewport.height}`,
            );
          const impact = await page.evaluate(
            ({ champion, slot }) =>
              (window as any).__review.capture(
                champion,
                slot,
                "impact",
                slot > 0 && slot < 4,
              ),
            { champion, slot },
          );
          expect(impact.unchanged).toBe(true);
          expect(impact.stats.detail).toBeGreaterThan(0);
        }
      }
      const cleared = await page.evaluate(() =>
        (window as any).__review.clear(),
      );
      expect(cleared.animations).toBe(0);
      expect(cleared.particles).toBe(0);
      await page.emulateMedia({ reducedMotion: "reduce" });
      const reduced = await page.evaluate(() =>
        (window as any).__review.capture("voltkit", 4),
      );
      expect(reduced.reduced).toBe(true);
      expect(reduced.stats.detail).toBe(0);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

test("simultaneous ultimate effects stay bounded in the real mobile arena", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
      const response = await route.fetch(),
        body = await response.text(),
        marker =
          "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
      expect(body).toContain(marker);
      await route.fulfill({
        response,
        body: body.replace(marker, "window.__vfxGame=gameInstance;" + marker),
      });
    });
    const errors = await openTown(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { mode: "ffa", phase: "playing" }),
    );
    await openTownMenu(page);
    await page.click(".town-play");
    await page.click("#play-create");
    await pushUntilBattle(page);
    const audit = await page.evaluate(async () => {
      const { Arena, packSnapshot, blankInput } = await import("/rooms.ts");
      const { auditSkillScene } = await import("/skill-fx-review.ts");
      const w = window as any,
        a = new Arena("PVP123", "ffa");
      ["voltkit", "cindrake", "tidefin", "auralynx"].forEach((c, i) =>
        a.add(i ? `p${i + 1}` : "me", `Caster ${i + 1}`, c as any),
      );
      a.start();
      a.phase = "playing";
      a.deadline = a.time + 1000;
      a.players.forEach((p, i) => {
        p.x = 600 + (i % 2) * 350;
        p.y = 320 + Math.floor(i / 2) * 300;
        p.ult = 100;
      });
      let seq = 0;
      for (let frame = 0; frame < 22; frame++) {
        a.players.forEach((p) =>
          a.submit(p, {
            ...blankInput(),
            seq: ++seq,
            aimX: 800,
            aimY: 450,
            skill: frame === 0 ? 3 : -1,
          }),
        );
        a.tick();
        w.__snap = packSnapshot(a.snapshot());
        w.__push();
        await new Promise((resolve) => setTimeout(resolve, 30));
      }
      return auditSkillScene(w.__vfxGame.scene.getScene("arena"));
    });
    expect(audit.stats.detail).toBeGreaterThan(0);
    for (const key of [
      "particles",
      "animations",
      "glows",
      "floorGlows",
      "softs",
    ] as const)
      expect(audit.stats[key]).toBeLessThanOrEqual(audit.limits[key]);
    await expect(page.locator(".battle-nameplate .fighter-health")).toHaveCount(
      4,
    );
    await snap(page, info, "four-ultimates-mobile-arena");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

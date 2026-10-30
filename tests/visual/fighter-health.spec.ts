import { expect, test } from "@playwright/test";
import { openTown, openTownMenu, pushUntilBattle, snap } from "./helpers";

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
]) {
  test(`champion health sits below names above the fighter at ${viewport.width}x${viewport.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(150_000);
    const context = await browser.newContext({
      viewport,
      isMobile: viewport.width < 1000,
      hasTouch: viewport.width < 1000,
    });
    try {
      const page = await context.newPage();
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch(),
            body = await response.text();
          const marker =
            "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
          expect(body).toContain(marker);
          await route.fulfill({
            response,
            body: body.replace(
              marker,
              "window.__healthGame=gameInstance;" + marker,
            ),
          });
        },
      );
      const errors = await openTown(page);
      await page.evaluate(() => {
        const w = window as any;
        w.__room("pvp", { mode: "ffa", phase: "playing" });
        const positions = [
          [600, 450],
          [850, 450],
          [600, 650],
          [850, 650],
        ];
        w.__snap.players.forEach((p: any, i: number) => {
          [p.x, p.y] = positions[i];
          p.title = i === 0 ? "Mountain Conqueror" : null;
          p.titleColor = "#ffd65b";
        });
      });
      await openTownMenu(page);
      await page.click(".town-play");
      await page.click("#play-create");
      await pushUntilBattle(page);
      await expect(
        page.locator(".battle-nameplate .fighter-health"),
      ).toHaveCount(4);
      for (const champions of [
        ["voltkit", "cindrake", "tidefin", "auralynx"],
        ["lumoth", "mystowl", "terradon", "duskveil"],
      ]) {
        await page.evaluate(async (champions) => {
          const w = window as any,
            { CHARACTERS } = await import("/rooms.ts");
          w.__snap.players.forEach((p: any, i: number) => {
            p.character = champions[i];
            p.hp = CHARACTERS[p.character].health - 17;
          });
          w.__push();
        }, champions);
        await expect
          .poll(() =>
            page.evaluate(() => {
              const w = window as any,
                scene = w.__healthGame.scene.getScene("arena");
              return w.__snap.players.every(
                (p: any) => scene.rigs.get(p.id)?.character === p.character,
              );
            }),
          )
          .toBe(true);
        await expect(
          page.locator('.fighter-health[data-team="self"]'),
        ).toHaveAttribute(
          "aria-valuenow",
          String(
            await page.evaluate(() => (window as any).__snap.players[0].hp),
          ),
        );
        const audit = await page.evaluate(() => {
          const w = window as any,
            scene = w.__healthGame.scene.getScene("arena"),
            camera = scene.cameras.main;
          const canvas = w.__healthGame.canvas.getBoundingClientRect();
          return w.__snap.players.map((p: any) => {
            const label = scene.labels.get(p.id),
              name = label
                .querySelector(".player-name")
                .getBoundingClientRect();
            const track = label.querySelector(".fighter-health"),
              bar = track.getBoundingClientRect();
            const rig = scene.rigs.get(p.id);
            const centerY =
              canvas.y +
              (rig.root.y - camera.worldView.y) *
                camera.zoomY *
                scene.scale.zoom;
            return {
              character: p.character,
              hidden: label.hidden,
              team: track.dataset.team,
              nameBottom: name.bottom,
              barTop: bar.top,
              barBottom: bar.bottom,
              width: bar.width,
              height: bar.height,
              centerY,
              current: Number(track.getAttribute("aria-valuenow")),
              max: Number(track.getAttribute("aria-valuemax")),
              fill: Number(
                (track.firstElementChild as HTMLElement).style.transform.match(
                  /[\d.]+/,
                )![0],
              ),
              ticks: getComputedStyle(track, "::after").backgroundImage,
              centered: Math.abs(
                bar.left + bar.width / 2 - (name.left + name.width / 2),
              ),
            };
          });
        });
        for (const [i, row] of audit.entries()) {
          expect(row.hidden, row.character).toBe(false);
          expect(row.team).toBe(i === 0 ? "self" : "enemy");
          expect(row.barTop).toBeGreaterThanOrEqual(row.nameBottom + 3);
          expect(row.barBottom).toBeLessThan(row.centerY - 8);
          expect(row.width).toBeGreaterThanOrEqual(64);
          expect(row.height).toBeGreaterThanOrEqual(9);
          expect(row.centered).toBeLessThan(1);
          expect(row.fill).toBeCloseTo(row.current / row.max, 3);
          expect(row.ticks).toContain("repeating-linear-gradient");
        }
        await snap(
          page,
          info,
          `fighter-health-${champions[0]}-${viewport.width}x${viewport.height}`,
        );
      }
      // Health updates retain the same nodes and do not write unchanged values each frame.
      const changes = await page.evaluate(async () => {
        const bars = [
          ...document.querySelectorAll(".battle-nameplate .fighter-health"),
        ];
        let writes = 0;
        const observer = new MutationObserver(
          (entries) => (writes += entries.length),
        );
        bars.forEach((bar) =>
          observer.observe(bar, {
            attributes: true,
            childList: true,
            subtree: true,
          }),
        );
        await new Promise((resolve) => setTimeout(resolve, 500));
        observer.disconnect();
        return writes;
      });
      expect(changes).toBe(0);
      // Same-team fighters use green; an enemy in stealth loses its entire label/bar.
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.mode = "teams";
        w.__snap.players.forEach(
          (p: any, i: number) => (p.team = i < 2 ? 0 : 1),
        );
        w.__snap.players[2].statuses.push({
          kind: "stealth",
          until: w.__snap.time + 100,
          by: "p3",
        });
        w.__snap.players[1].hp = 0;
        w.__push();
      });
      await expect(
        page.locator('.fighter-health[data-team="ally"]'),
      ).toHaveAttribute("aria-valuenow", "0");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as any).__healthGame.scene
                .getScene("arena")
                .labels.get("p3").hidden,
          ),
        )
        .toBe(true);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

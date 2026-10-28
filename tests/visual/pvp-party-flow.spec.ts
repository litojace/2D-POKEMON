import { expect, test } from "@playwright/test";
import {
  box,
  inside,
  openTown,
  openTownMenu,
  pushUntilBattle,
  snap,
} from "./helpers";
const pal = "22222222-2222-4222-8222-222222222222";
test("raid room invites open Friends instead of displaying a room code", async ({
  browser,
}, info) => {
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openTown(page);
    await page.evaluate(() => {
      const w = window as any;
      w.__room("raid", { boss: "grumblecrag" });
      w.__snap.phase = "lobby";
      w.__snap.players = w.__snap.players.filter((p: any) => !p.raidBoss);
    });
    await openTownMenu(page);
    await page.click(".town-play");
    await page.click("#play-create");
    await expect
      .poll(async () => {
        await page.evaluate(() => (window as any).__push());
        return page.evaluate(() =>
          document.body.classList.contains("lobby-active"),
        );
      })
      .toBe(true);
    await page.locator(".lobby-room-drawer > summary").click();
    await expect(page.locator("#copy, #invite, #raid-copy-code")).toHaveCount(
      0,
    );
    await expect(page.locator("#invite-friends")).toHaveCount(1);
    await expect(page.locator(".raid-lobby")).not.toContainText(
      "Invite your party",
    );
    await snap(page, info, "raid-friends-invite-844x390");
    await page.locator("#invite-friends").click();
    await expect(page.locator(".friends-hub")).toBeVisible();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});
for (const size of [
  { width: 1440, height: 900 },
  { width: 844, height: 390 },
  { width: 844, height: 280 },
]) {
  test(`friend invites, confirmed picks and survivor viewing at ${size.width}x${size.height}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120000);
    const mobile = size.width < 1000;
    const context = await browser.newContext({
      viewport: size,
      isMobile: mobile,
      hasTouch: mobile,
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
              "window.__pvpGame=gameInstance;" + marker,
            ),
          });
        },
      );
      const errors = await openTown(page);
      await page.evaluate((pal) => {
        const w = window as any,
          fetch = window.fetch.bind(window);
        window.fetch = async (input, init) => {
          if (String(input).includes("/api/friends"))
            return new Response(
              JSON.stringify({
                code: "AABBCCDD",
                incoming: [],
                outgoing: [],
                friends: [
                  {
                    id: pal,
                    name: "Kai",
                    online: true,
                    activity: "town",
                    fighter: "cindrake",
                  },
                  {
                    id: "33333333-3333-4333-8333-333333333333",
                    name: "Mina",
                    online: true,
                    activity: "match",
                    room: "BUSY42",
                    fighter: "lumoth",
                  },
                  {
                    id: "44444444-4444-4444-8444-444444444444",
                    name: "Rae",
                    online: false,
                    lastOnline: "2026-10-27T12:00:00Z",
                  },
                ],
              }),
              { headers: { "Content-Type": "application/json" } },
            );
          return fetch(input, init);
        };
        w.__room("pvp", { mode: "ffa", seats: 3, phase: "lobby" });
        w.__events = [];
        w.__emit = (event: string, data: unknown) => {
          w.__events.push({ event, data });
          if (w.__events.length > 300) w.__events.shift();
        };
      }, pal);
      await openTownMenu(page);
      await page.click('#town-menu-items [data-action="friends"]');
      await expect(page.locator(".friends-hub")).toBeVisible();
      await page.evaluate(
        (pal) =>
          (window as any).__sock.fire("room-invite", {
            id: "55555555-5555-4555-8555-555555555555",
            fromId: pal,
            name: "Kai",
            code: "PVP123",
            mode: "ffa",
            expiresAt: Date.now() + 90000,
          }),
        pal,
      );
      const notice = page.locator(".room-invite-notice");
      await expect(notice).toBeVisible();
      expect(
        inside(await box(page, ".room-invite-notice"), { x: 0, y: 0, ...size }),
      ).toBe(true);
      await expect(page.locator("#dialog .room-invite-notice")).toHaveCount(1);
      await snap(page, info, `room-invite-${size.width}x${size.height}`);
      await notice.locator("[data-invite-join]").click();
      await expect(page.locator("#dialog")).not.toHaveAttribute("open", "");
      await expect
        .poll(async () => {
          await page.evaluate(() => (window as any).__push());
          return page.evaluate(() =>
            document.body.classList.contains("lobby-active"),
          );
        })
        .toBe(true);
      await expect(notice).toBeHidden();
      await page.locator('[data-character="cindrake"]').click();
      // Delay the actual acknowledgement: never claim a selection is saved early.
      await page.evaluate(() => {
        const w = window as any,
          original = w.__sock.timeout.bind(w.__sock);
        w.__sock.timeout = (...args: any[]) => {
          const timed = original(...args),
            emit = timed.emit.bind(timed);
          timed.emit = (event: string, data: unknown, callback: any) => {
            if (event === "select")
              w.__confirmPick = () => {
                const p = w.__snap.players.find((p: any) => p.id === "me");
                p.character = data;
                p.ready = false;
                callback(null, { ok: true });
                w.__push();
              };
            else emit(event, data, callback);
          };
          return timed;
        };
      });
      await page.locator('[data-fighter-lock="cindrake"]').click();
      await expect(page.locator("[data-fighter-lock]")).toHaveText(
        "Confirming…",
      );
      await expect(page.locator(".lobby-room-drawer")).not.toHaveClass(
        /needs-ready/,
      );
      await page.evaluate(() => (window as any).__confirmPick());
      await expect(page.locator("[data-fighter-lock]")).toContainText(
        "Locked in",
      );
      await expect(page.locator("[data-fighter-lock]")).toBeDisabled();
      await expect(page.locator("#ready")).toHaveClass(/needs-ready/);
      if (mobile) {
        await expect(
          page.locator(".lobby-room-drawer > summary"),
        ).toContainText("Ready up");
        await expect(page.locator(".lobby-room-drawer")).toHaveClass(
          /needs-ready/,
        );
        const roomButton = await box(page, ".lobby-room-drawer > summary");
        expect(roomButton.height).toBeGreaterThanOrEqual(44);
        expect(roomButton.y + roomButton.height).toBeLessThanOrEqual(
          (await box(page, ".desktop-lobby-header")).y,
        );
      }
      await page.locator(".fighter-detail").evaluate(async (e) => {
        await Promise.all(
          e.getAnimations().map((a) => a.finished.catch(() => {})),
        );
      });
      await snap(page, info, `locked-in-${size.width}x${size.height}`);
      if (mobile) await page.locator(".lobby-room-drawer > summary").click();
      await expect(page.locator("#copy, #invite, #raid-copy-code")).toHaveCount(
        0,
      );
      await page.locator("#invite-friends").click();
      const invite = page.locator(`[data-friend-invite="${pal}"]`);
      await expect(invite).toBeVisible();
      await expect(page.locator("[data-friend-invite]")).toHaveCount(1);
      expect(
        inside(
          await box(page, `[data-friend-invite="${pal}"]`),
          await box(page, `[data-friend-row="${pal}"]`),
        ),
      ).toBe(true);
      await invite.click();
      await expect(invite).toContainText("Invited");
      await expect(invite).toBeDisabled();
      expect(
        await page.evaluate(() =>
          (window as any).__events.filter(
            (e: any) => e.event === "room-invite",
          ),
        ),
      ).toEqual([{ event: "room-invite", data: { playerId: pal } }]);
      await snap(page, info, `invite-friends-${size.width}x${size.height}`);
      await page.locator("#close-dialog").click();
      if (
        mobile &&
        (await page.locator(".lobby-room-drawer").getAttribute("open")) === null
      )
        await page.locator(".lobby-room-drawer > summary").click();
      await page.locator("#ready").click();
      await expect(page.locator("#ready")).toContainText("Cancel ready");
      await expect(page.locator("#ready")).not.toHaveClass(/needs-ready/);
      await expect(page.locator(".lobby-room-drawer")).not.toHaveClass(
        /needs-ready/,
      );
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.phase = "playing";
        w.__snap.remaining = 90;
        w.__snap.players[0].x = 700;
        w.__snap.players[0].y = 600;
        w.__snap.players[1].x = 1100;
        w.__snap.players[1].y = 230;
        w.__snap.players[2].x = 340;
        w.__snap.players[2].y = 700;
        w.__push();
      });
      await pushUntilBattle(page);
      if (mobile)
        await expect
          .poll(() =>
            page.evaluate(
              () =>
                (window as any).__pvpGame.scene.getScene("arena").cameras.main
                  .worldView.width,
            ),
          )
          .toBeGreaterThan(1300);
      await snap(page, info, `pvp-wide-view-${size.width}x${size.height}`);
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players[0].hp = 0;
        w.__snap.players[0].vx = w.__snap.players[0].vy = 0;
        w.__push();
      });
      const spectator = page.locator("#spectate");
      await expect(spectator).toBeVisible();
      await expect(spectator).toContainText("Watching Kai");
      expect(
        inside(await box(page, "#spectate"), { x: 0, y: 0, ...size }),
      ).toBe(true);
      const watchingBox = await box(page, "#spectate");
      expect(watchingBox.y).toBeGreaterThan(size.height * 0.65);
      expect(watchingBox.x + watchingBox.width).toBeLessThanOrEqual(
        size.width / 2 - 80,
      );
      for (const selector of ["#battle-menu"]) {
        const control = await box(page, selector);
        expect(
          watchingBox.x + watchingBox.width <= control.x ||
            control.x + control.width <= watchingBox.x,
        ).toBe(true);
      }
      if (mobile) {
        await expect(page.locator("#mobile-fullscreen")).toBeHidden();
        const gear = await box(page, "#battle-menu");
        expect(gear.y).toBeLessThanOrEqual(8);
        expect(gear.x).toBeGreaterThan(size.width - 54);
        await page.locator("#battle-menu").click();
        await expect(page.locator("#settings-fullscreen")).toBeVisible();
        await page.click("#close-dialog");
        await expect(page.locator(".joystick-area")).toBeHidden();
        await expect(page.locator(".touch-buttons")).toBeHidden();
        for (const button of await page.locator(".touch-buttons button").all())
          await expect(button).toBeDisabled();
      }
      await spectator.locator('[data-spectate-step="1"]').click();
      await expect(spectator).toContainText("Watching Rae");
      await page.waitForTimeout(500);
      await snap(page, info, `pvp-spectator-${size.width}x${size.height}`);
      await page.evaluate(() => {
        (window as any).__events = [];
      });
      await page.keyboard.down("KeyD");
      await page.keyboard.down("KeyQ");
      await expect
        .poll(() =>
          page.evaluate(
            () =>
              (window as any).__events.filter((e: any) => e.event === "input")
                .length,
          ),
        )
        .toBeGreaterThan(1);
      await page.keyboard.up("KeyD");
      await page.keyboard.up("KeyQ");
      const packets = await page.evaluate(() =>
        (window as any).__events
          .filter((e: any) => e.event === "input")
          .map((e: any) => e.data),
      );
      expect(packets.length).toBeGreaterThan(1);
      expect(
        packets.every(
          (p: any) =>
            !p.dx && !p.dy && !p.basic && p.skill === -1 && !p.dash && !p.jump,
        ),
      ).toBe(true);
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.players[2].hp = 0;
        w.__push();
      });
      await expect(spectator).toContainText("Watching Kai");
      await expect(
        spectator.locator('[data-spectate-step="1"]'),
      ).toBeDisabled();
      await page.evaluate(() => {
        const w = window as any;
        w.__snap.round++;
        w.__snap.players[0].hp = 100;
        w.__push();
      });
      await expect(spectator).toBeHidden();
      if (mobile) {
        await expect(page.locator(".joystick-area")).toBeVisible();
        await expect(
          page.locator('.touch-buttons [data-action="attack"]'),
        ).toBeEnabled();
      }
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });
}

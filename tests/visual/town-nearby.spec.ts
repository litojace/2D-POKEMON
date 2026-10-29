import { test, expect } from "@playwright/test";
import { openTown, snap } from "./helpers";
test("nearby town player can receive a friend request without a code", async ({
  page,
}) => {
  const errors = await openTown(page);
  await page.evaluate(() => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = async (input, init) => {
      if (String(input).includes("/api/friends/request")) {
        (window as any).__friendRequest = JSON.parse(String(init?.body));
        return new Response(JSON.stringify({ result: "sent" }), {
          headers: { "Content-Type": "application/json" },
        });
      }
      return originalFetch(input, init);
    };
    const sock = (window as any).__sock;
    sock.fire("town-profiles", [
      {
        id: 999,
        accountId: "22222222-2222-4222-8222-222222222222",
        name: "Nearby Mina",
        title: null,
        titleColor: null,
        level: 12,
        character: "lumoth",
        skin: null,
      },
    ]);
    const fire = sock.fire.bind(sock);
    sock.fire = (event: string, data: any) => {
      if (event === "town-state")
        data.walkers.push([999, 1670, 1330, 0, 0, 0, 0]);
      return fire(event, data);
    };
    sock.fire("town-state", {
      town: 1,
      population: 2,
      me: 1,
      walkers: [[1, 1600, 1330, 0, 0, 0, 0]],
    });
  });
  await page.getByRole("button", { name: "Nearby Mina Add friend" }).click();
  await expect
    .poll(() => page.evaluate(() => (window as any).__friendRequest?.playerId))
    .toBe("22222222-2222-4222-8222-222222222222");
  expect(
    await page.evaluate(() => (window as any).__friendRequest?.code),
  ).toBeUndefined();
  expect(errors).toEqual([]);
});

for (const width of [1440, 844]) {
  test(`nearby friends invite into a private room with dark cards at ${width}`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: width === 844 ? 390 : 900 });
    const errors = await openTown(page);
    await page.evaluate(() => {
      const w = window as any;
      const fetch = window.fetch.bind(window);
      window.fetch = async (input, init) => String(input).endsWith("/api/friends")
        ? new Response(JSON.stringify({ code: "my-code", friends: [{ id: "friend-id", name: "Mina" }], incoming: [], outgoing: [{ id: "pending-id", name: "Pip" }] }), { headers: { "Content-Type": "application/json" } })
        : fetch(input, init);
      const reply = w.__reply;
      w.__calls = [];
      w.__reply = (event: string, data: unknown) => {
        if (["create", "select", "room-invite"].includes(event)) {
          w.__calls.push({ event, data });
          return event === "create" ? { ok: true, id: 1, token: "test-room-token" } : { ok: true };
        }
        return reply(event, data);
      };
      w.__sock.fire("town-profiles", [
        { id: 998, accountId: "friend-id", name: "Mina", title: null, titleColor: null, level: 12, character: "lumoth", skin: null },
        { id: 999, accountId: "pending-id", name: "Pip", title: null, titleColor: null, level: 12, character: "voltkit", skin: null },
      ]);
      const fire = w.__sock.fire.bind(w.__sock);
      w.__sock.fire = (event: string, data: any) => {
        if (event === "town-state") data.walkers.push([998, 1670, 1330, 0, 0, 0, 0], [999, 1690, 1330, 0, 0, 0, 0]);
        return fire(event, data);
      };
    });
    const invite = page.getByRole("button", { name: "Mina Invite to play" });
    await expect(invite).toBeVisible();
    await expect(page.getByRole("button", { name: "Pip Request sent" })).toBeDisabled();
    expect(await invite.evaluate((el) => getComputedStyle(el).backgroundImage)).toContain("linear-gradient");
    const panel = await page.locator("#town-nearby").boundingBox();
    expect(panel!.x + panel!.width).toBeLessThanOrEqual(width);
    expect(await invite.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBe(true);
    await snap(page, info, `nearby-friends-${width}`);
    await invite.click();
    await expect.poll(() => page.evaluate(() => (window as any).__calls.map((c: any) => c.event))).toEqual(["create", "select", "room-invite"]);
    expect(await page.evaluate(() => (window as any).__calls[2].data)).toEqual({ playerId: "friend-id" });
    await expect(page.getByRole("button", { name: "Mina Invite sent" })).toBeDisabled();
    expect(await page.evaluate(() => (window as any).__friendRequest)).toBeUndefined();
    expect(errors).toEqual([]);
  });
}

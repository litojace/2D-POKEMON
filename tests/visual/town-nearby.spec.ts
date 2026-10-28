import { test, expect } from "@playwright/test";
import { openTown } from "./helpers";
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

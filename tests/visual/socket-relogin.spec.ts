import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";

// A phone waking up after an hour reconnects with its old token; the server
// refuses it (or closes the connection when no fresh token comes in time),
// and Socket.IO never retries such a connection by itself. The player then
// sat in the game offline to their friends. Now the client renews the login
// and connects again with the fresh token.
type Harness = {
  __sock: {
    connected: boolean;
    active: boolean;
    auth: { accessToken?: string };
    fire(ev: string, payload: unknown): void;
  };
  __connects?: number;
  __refreshes?: number;
};
const read = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as Harness;
    return {
      connects: w.__connects ?? 0,
      refreshes: w.__refreshes ?? 0,
      token: w.__sock.auth.accessToken,
    };
  });
/** The server refused or closed the connection: Socket.IO is idle. */
const dropped = (page: Page) =>
  page.evaluate(() => {
    const s = (window as unknown as Harness).__sock;
    s.connected = false;
    s.active = false;
  });
const expired = {
  message: "Your login expired. Please sign in again.",
  data: { code: "ACCOUNT_ERROR", status: 401 },
};

test("a refused expired login is renewed and the socket connects again", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await page.waitForTimeout(500);
  const before = await read(page);
  await dropped(page);
  await page.evaluate(
    (e) => (window as unknown as Harness).__sock.fire("connect_error", e),
    expired,
  );
  await expect
    .poll(async () => (await read(page)).connects)
    .toBe(before.connects + 1);
  const after = await read(page);
  expect(after.refreshes).toBe(before.refreshes + 1);
  expect(after.token).toBe(`fresh-${after.refreshes}`);
  // No "login expired" scare when the renewal fixes it.
  await expect(page.locator("#toast")).not.toContainText("expired");
  // Refused again right away: that one is reported, not retried forever.
  await page.evaluate(
    (e) => (window as unknown as Harness).__sock.fire("connect_error", e),
    expired,
  );
  await expect(page.locator("#toast")).toContainText("expired");
  expect((await read(page)).refreshes).toBe(after.refreshes);
  expect(errors).toEqual([]);
});

test("a connection the server closed for an expired login comes back", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await page.waitForTimeout(500);
  const before = await read(page);
  await dropped(page);
  await page.evaluate(() =>
    (window as unknown as Harness).__sock.fire("access-revoked", {
      error: "Your login expired. Please sign in again.",
    }),
  );
  // It connects again with the token it has…
  await expect
    .poll(async () => (await read(page)).connects)
    .toBeGreaterThan(before.connects);
  const again = await read(page);
  // …which the server refuses as expired: renewed, and connected again.
  await dropped(page);
  await page.evaluate(
    (e) => (window as unknown as Harness).__sock.fire("connect_error", e),
    expired,
  );
  await expect
    .poll(async () => (await read(page)).connects)
    .toBeGreaterThan(again.connects);
  const after = await read(page);
  expect(after.refreshes).toBe(before.refreshes + 1);
  expect(after.token).toBe(`fresh-${after.refreshes}`);
  expect(errors).toEqual([]);
});

test("a fresh token doesn't reconnect a socket that is connected, retrying, or replaced", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await page.waitForTimeout(500);
  const refresh = () =>
    page.evaluate(() =>
      (
        window as unknown as {
          __authChange: (e: string, s: unknown) => void;
        }
      ).__authChange("TOKEN_REFRESHED", {
        access_token: "later",
        refresh_token: "r",
        user: { id: "11111111-1111-4111-8111-111111111111" },
      }),
    );
  const start = (await read(page)).connects;
  // Connected: the token goes over the live connection instead.
  await refresh();
  await page.waitForTimeout(300);
  expect((await read(page)).connects).toBe(start);
  // Socket.IO is still retrying on its own (a network drop).
  await page.evaluate(() => {
    (window as unknown as Harness).__sock.connected = false;
  });
  await refresh();
  await page.waitForTimeout(300);
  expect((await read(page)).connects).toBe(start);
  // Another device took over this login: stay paused.
  await page.evaluate(() => {
    const s = (window as unknown as Harness).__sock;
    s.fire("session-replaced", undefined);
    s.active = false;
  });
  await refresh();
  await page.waitForTimeout(300);
  expect((await read(page)).connects).toBe(start);
  expect(errors).toEqual([]);
});

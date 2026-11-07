import { expect, test, type Page } from "@playwright/test";
import { openLobby } from "./helpers";
import { exposeAccount } from "./shop-server";

// A long press on a phone is a game action (hold to harvest or plant many on
// the Farm), never the phone's text selection or Copy menu (owner, 6 Nov
// 2026); on a computer a drag or a right click selects and opens nothing
// either (7 Nov). Fields you type in keep both.
// (iOS's -webkit-touch-callout isn't in Chromium; tests/unit/touch-hold.test.ts
// checks the stylesheet sets it.)
const selectable = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((e) => {
      const s = getComputedStyle(e);
      return s.userSelect || s.webkitUserSelect;
    });
/** Was a context menu on this element cancelled? `touch`: as Chrome reports a
 * finger's long press; `held`: a menu with no pointer type while a finger is
 * down (Safari, older Chrome). */
const menuCancelled = (
  page: Page,
  selector: string,
  how: "touch" | "mouse" | "held",
) =>
  page
    .locator(selector)
    .first()
    .evaluate((e, how) => {
      if (how === "held")
        e.dispatchEvent(
          new TouchEvent("touchstart", {
            bubbles: true,
            touches: [new Touch({ identifier: 1, target: e })],
          }),
        );
      const menu =
        how === "held"
          ? new MouseEvent("contextmenu", { bubbles: true, cancelable: true })
          : new PointerEvent("contextmenu", {
              bubbles: true,
              cancelable: true,
              pointerType: how,
            });
      e.dispatchEvent(menu);
      if (how === "held")
        e.dispatchEvent(
          new TouchEvent("touchend", { bubbles: true, touches: [] }),
        );
      return menu.defaultPrevented;
    }, how);

test("a long press on a phone selects nothing and opens no menu", async ({
  browser,
}) => {
  const context = await browser.newContext({
    viewport: { width: 852, height: 393 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    // The Lobby's text and buttons.
    for (const selector of ["#lobby-play", ".lobby-layer"])
      expect(await selectable(page, selector), selector).toBe("none");
    expect(await menuCancelled(page, "#lobby-play", "touch")).toBe(true);
    expect(await menuCancelled(page, "#lobby-play", "held")).toBe(true);
    // The Farm, where holding a plot harvests or plants many.
    await page.click('#hub-scenes [data-hub-scene="farm"]');
    await expect(page.locator(".farm-layer #fm-cv")).toBeVisible();
    for (const selector of [".farm-layer #fm-cv", ".farm-layer", "#fm-badge"])
      expect(await selectable(page, selector), selector).toBe("none");
    expect(await menuCancelled(page, ".farm-layer #fm-cv", "touch")).toBe(true);
    expect(await menuCancelled(page, ".farm-layer #fm-cv", "held")).toBe(true);
    // A field you type in keeps selection and its menu (paste a code).
    await page.evaluate(() => {
      const input = document.createElement("input");
      input.id = "zz-field";
      document.body.append(input);
    });
    expect(await selectable(page, "#zz-field")).toBe("text");
    expect(await menuCancelled(page, "#zz-field", "touch")).toBe(false);
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

test("on a computer a drag selects nothing, and right click and dragging a picture open nothing", async ({
  page,
}) => {
  const errors = await openLobby(page);
  expect(await selectable(page, "#lobby-play")).toBe("none");
  expect(await selectable(page, ".lobby-layer")).toBe("none");
  expect(await menuCancelled(page, "#lobby-play", "mouse")).toBe(true);
  // Dragging a picture or a link out of the page.
  const dragCancelled = await page.evaluate(() => {
    const host = document.createElement("div");
    host.innerHTML =
      '<img id="zz-img" alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACw="><a id="zz-link" href="#x">link</a>';
    document.body.append(host);
    return ["#zz-img", "#zz-link"].map((sel) => {
      const drag = new DragEvent("dragstart", {
        bubbles: true,
        cancelable: true,
      });
      document.querySelector(sel)!.dispatchEvent(drag);
      return drag.defaultPrevented;
    });
  });
  expect(dragCancelled).toEqual([true, true]);
  // A dialog (Settings, How to play) selects nothing either: Chrome lets
  // a modal dialog's text be selected unless told otherwise.
  // (The shared dialog every one of them opens in.)
  await page.evaluate(() => {
    const d = document.querySelector<HTMLDialogElement>("dialog#dialog")!;
    d.innerHTML = "<h2>Settings</h2><p>Sound and controls.</p>";
    d.showModal();
  });
  expect(await selectable(page, "dialog#dialog h2")).toBe("none");
  expect(await selectable(page, "dialog#dialog p")).toBe("none");
  await page.evaluate(() =>
    document.querySelector<HTMLDialogElement>("dialog#dialog")!.close(),
  );
  // A field keeps selection and its menu (paste a code).
  await page.evaluate(() => {
    const input = document.createElement("input");
    input.id = "zz-field";
    document.body.append(input);
  });
  expect(await selectable(page, "#zz-field")).toBe("text");
  expect(await menuCancelled(page, "#zz-field", "mouse")).toBe(false);
  expect(errors).toEqual([]);
});

test("admins can select and copy from the Admin panel", async ({ page }) => {
  await page.addInitScript(() => {
    (window as any).__accountPatch = { isAdmin: true };
  });
  await exposeAccount(page);
  const errors = await openLobby(page);
  // The Admin panel's own data (the harness fakes the rest of the API).
  await page.evaluate(() => {
    const fetch = window.fetch.bind(window);
    const reply = (body: unknown) =>
      new Response(JSON.stringify(body), {
        headers: { "Content-Type": "application/json" },
      });
    window.fetch = async (input, init) => {
      const url = String(input instanceof Request ? input.url : input);
      if (url.includes("/api/admin/online"))
        return reply({ players: [], guests: 0, at: new Date().toISOString() });
      if (url.includes("/api/admin/reports"))
        return reply({ reports: [], total: 0, open: 0 });
      if (url.includes("/api/admin/titles")) return reply([]);
      if (url.includes("/api/admin/players"))
        return reply({
          players: [
            {
              id: "22222222-2222-4222-8222-222222222222",
              displayName: "Nova",
              isAdmin: false,
              suspended: false,
              createdAt: "2026-10-01T00:00:00Z",
              titleIds: [],
            },
          ],
          total: 1,
        });
      return fetch(input, init);
    };
  });
  await page.evaluate(() => (window as any).__account.showAdmin());
  const panel = page.locator("dialog:has(.admin-tabs)");
  await expect(panel).toBeVisible();
  for (const selector of [
    "dialog:has(.admin-tabs) h2",
    "dialog:has(.admin-tabs) .admin-tabs",
  ])
    expect(await selectable(page, selector), selector).toBe("text");
  expect(await menuCancelled(page, "dialog:has(.admin-tabs) h2", "mouse")).toBe(
    false,
  );
  // The game around it, and other dialogs, still select nothing.
  expect(await selectable(page, ".lobby-layer")).toBe("none");
  // A player's row, the text an admin copies.
  expect(
    await selectable(page, "dialog:has(.admin-tabs) .admin-row strong"),
  ).toBe("text");
  expect(errors).toEqual([]);
});

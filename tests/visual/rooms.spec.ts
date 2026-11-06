import { expect, test, type Page } from "@playwright/test";
import { box, inside, openHub, snap } from "./helpers";
import {
  ISLAND,
  closeSpot,
  inkOffset,
  layoutProblems,
  setInsets,
} from "./ui-measure";

// UI remodel step 5 (docs/ui-remodel/PLAN.md): the raid room and the PvP
// rooms in one frame, as the owner approved (images/mockups/room-*.webp).
// The seats on the left, the roster as the picker on the right (Details,
// Lock in, Ready bottom right), no rail, no drawer on phones; the picker's
// corner leaves the room. Measured at the review sizes with ui-measure.ts.
const SIZES = [
  { name: "1720x1392", width: 1720, height: 1392, phone: false },
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "1280x720", width: 1280, height: 720, phone: false },
  { name: "844x390", width: 844, height: 390, phone: true },
  {
    name: "852x393-island",
    width: 852,
    height: 393,
    phone: true,
    island: true,
  },
];

/** Enter a prepared room: a raid (from its boss page) or a PvP mode. */
async function enterRoom(page: Page, kind: "raid" | "duel" | "teams" | "ffa") {
  await page.evaluate((kind) => {
    const w = window as any;
    w.__events = [];
    w.__emit = (ev: string, data: unknown) => w.__events.push([ev, data]);
    if (kind === "raid") {
      w.__room("raid", { boss: "grumblecrag" });
      w.__snap.phase = "lobby";
      w.__snap.players = w.__snap.players.filter((p: any) => !p.raidBoss);
    } else
      w.__room("pvp", {
        mode: kind,
        phase: "lobby",
        seats: kind === "ffa" ? 3 : undefined,
      });
  }, kind);
  if (kind === "raid") {
    await page.click('.lobby-rail [data-lobby-action="raids"]');
    await page.click('[data-raid-card="grumblecrag"]');
    await page.click('[data-ui-raid-play="party"]');
    await page.click('[data-raid-start="party"]');
  } else {
    await page.click("#lobby-mode");
    await page.click('#lobby-mode-menu [data-lobby-action="more-play"]');
    await page.click(`#menu [data-mode="${kind}"]`);
    await page.click("#play-create");
  }
  await expect
    .poll(async () => {
      await page.evaluate(() => (window as any).__push());
      return page.locator(".room-screen .roster-room").count();
    })
    .toBe(1);
}
const events = (page: Page, name: string) =>
  page.evaluate(
    (name) =>
      (window as any).__events
        .filter(([ev]: [string]) => ev === name)
        .map(([, data]: [string, unknown]) => data),
    name,
  );

for (const size of SIZES)
  for (const kind of ["raid", "teams"] as const)
    test(`the ${kind} room at ${size.name}`, async ({ browser }, info) => {
      test.setTimeout(150_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        const errors = await openHub(page);
        const inset = size.island ? ISLAND : undefined;
        if (inset) await setInsets(page, inset);
        await enterRoom(page, kind);
        const seats = page.locator(".room-seats");
        const picker = page.locator(".room-screen .roster-room");
        // No rail and no drawer in a room; the seats and the picker side by
        // side, both in sight, never overlapping.
        await expect(page.locator(".lobby-rail")).toHaveCount(0);
        await expect(page.locator(".lobby-room-drawer")).toHaveCount(0);
        await expect(seats).toBeVisible();
        const s = await box(page, ".room-seats");
        const p = await box(page, ".room-screen .roster-room");
        expect(s.x + s.width).toBeLessThanOrEqual(p.x);
        for (const b of [s, p])
          expect(
            inside(b, {
              x: inset?.left ?? 0,
              y: 0,
              width: size.width - (inset?.left ?? 0) - (inset?.right ?? 0),
              height: size.height - (inset?.bottom ?? 0),
            }),
          ).toBe(true);
        if (kind === "raid") {
          await expect(seats.locator(".room-banner-name")).toHaveText(
            "Grumblecrag",
          );
          await expect(seats.locator(".room-seat")).toHaveCount(4);
          await expect(seats.locator("[data-room-invite]")).toHaveCount(2);
        } else {
          await expect(seats.locator(".room-team")).toHaveCount(2);
          await expect(seats.locator("#shuffle")).toBeVisible();
          // The mode banner's text sits in the middle of its box (owner's
          // note, 5 Nov), not in its bottom-left corner.
          const banner = await box(page, ".room-banner");
          const text = await box(page, ".room-banner-name");
          expect(
            Math.abs(text.x + text.width / 2 - (banner.x + banner.width / 2)),
          ).toBeLessThan(2);
        }
        await expect(picker.locator(".ui-kicker")).toContainText(
          kind === "raid" ? "Raid room · Grumblecrag" : "2v2 Teams",
        );
        // Details · Lock in · Ready, bottom right; the corner leaves.
        const acts = picker.locator(".ui-panel-foot .ui-actions > .ui-btn");
        await expect(acts).toHaveCount(3);
        await expect(acts.last()).toHaveAttribute("id", "ready");
        await expect(picker.locator(".ui-close")).toHaveAttribute(
          "aria-label",
          "Leave the room",
        );
        // Leaving is red (owner, 6 Nov): the icon and its outline.
        expect(
          await picker.locator("#leave").evaluate((el) => {
            const cs = getComputedStyle(el);
            return [
              getComputedStyle(el.querySelector("svg")!).color,
              cs.borderTopColor,
            ];
          }),
        ).toEqual(["rgb(255, 138, 151)", "rgba(239, 79, 97, 0.533)"]);
        await page.evaluate(() => document.fonts.ready);
        await page.waitForTimeout(500);
        expect(await closeSpot(page)).toEqual([
          size.phone
            ? { right: 7, top: 7, size: 32 }
            : { right: 11, top: 11, size: 44 },
        ]);
        expect(
          await layoutProblems(page, { inset, phone: size.phone }),
        ).toEqual([]);
        // Labels centred on their buttons (measured on the pixels).
        for (const sel of ["#ready", "[data-roster-details]"]) {
          const ink = await inkOffset(page, page.locator(sel).first());
          expect(
            Math.abs(ink.dx),
            `${sel} ${ink.dx},${ink.dy}`,
          ).toBeLessThanOrEqual(1);
        }
        await snap(page, info, `room-${kind}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

test("Lock in, Ready and Leave go to the room's calls", async ({ page }) => {
  const errors = await openHub(page);
  await enterRoom(page, "duel");
  const picker = page.locator(".room-screen .roster-room");
  // Pick a card, lock it in: the server is asked and the seat follows.
  await picker.locator('[data-roster-card="cindrake"]').click();
  const lock = picker.locator('[data-roster-select="cindrake"]');
  await lock.click();
  await expect(lock).toContainText("Locked in");
  await expect(lock).toBeDisabled();
  expect(await events(page, "select")).toContain("cindrake");
  await expect(
    page.locator(".room-seats [data-me] .room-seat-fighter"),
  ).toContainText("Cindrake");
  // Ready with another fighter picked: it is locked in first, then ready.
  await picker.locator('[data-roster-card="tidefin"]').click();
  await page.locator("#ready").click();
  await expect(page.locator("#ready")).toContainText("Cancel ready");
  expect((await events(page, "select")).at(-1)).toBe("tidefin");
  expect(await events(page, "ready")).toHaveLength(1);
  await expect(
    page.locator(".room-seats [data-me] .ui-tag.is-ok"),
  ).toContainText("Ready");
  // Escape goes back from a fighter's detail to the grid, not out of the room.
  await page.click("#ready");
  await picker.locator("[data-roster-details]").click();
  await expect(picker).toHaveAttribute("data-roster-mode", "detail");
  await page.keyboard.press("Escape");
  await expect(page.locator(".room-screen .roster-room")).toHaveAttribute(
    "data-roster-mode",
    "grid",
  );
  await page.keyboard.press("Escape");
  await expect(page.locator(".room-screen .roster-room")).toHaveCount(1);
  // Party rules (the host) and the corner: leave the room.
  await page.locator(".room-rules > summary").click();
  await page.locator(".room-rules [data-mutator]").first().click();
  expect(await events(page, "mutators")).toHaveLength(1);
  await page.click("#leave");
  await expect(page.locator("#lobby-play")).toBeVisible();
  await expect(page.locator(".room-screen")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("a free-for-all room's open seats invite friends", async ({ page }) => {
  const errors = await openHub(page);
  await enterRoom(page, "ffa");
  await expect(page.locator(".room-seats .room-seat")).toHaveCount(4);
  await page.click("#invite-friends");
  // Friends takes the picker's place beside the seats; closing it brings
  // the picker back.
  await expect(page.locator(".room-screen .friends-sheet")).toBeVisible();
  await expect(page.locator(".room-screen .roster-room")).toHaveCount(0);
  await expect(page.locator(".room-seats")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".friends-sheet")).toHaveCount(0);
  await expect(page.locator(".room-screen .roster-room")).toBeVisible();
  expect(errors).toEqual([]);
});

test("rooms with reduced motion and Low graphics", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const errors = await openHub(page);
    await enterRoom(page, "raid");
    await expect(page.locator(".room-screen")).toHaveAttribute(
      "data-graphics",
      "low",
    );
    await expect(page.locator(".room-screen .roster-room")).toHaveAttribute(
      "data-graphics",
      "low",
    );
    expect(
      await page
        .locator(".room-seats")
        .evaluate((el) => getComputedStyle(el).backdropFilter),
    ).toBe("none");
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

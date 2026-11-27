import { expect, test, type Browser, type Page } from "@playwright/test";
import { openLobby } from "./helpers";
import { playersLook } from "./players-look";

// The Lobby holds still behind what covers it (lobby.css): under a full hub
// panel the parts it covers (data-ui-covered) pause whatever moves in them,
// and behind a dialog the Lobby's own animations pause by name. It moves
// again once they close. The pause must not cost a restyle of its own: a
// rule on `.lobby-layer.is-covered > :not(.ui-panel-host) *` restyled every
// Lobby element a second time on every open and close (900-1,500 of them)
// and missed pseudo-elements, so PLAY's glow and sweep ran on under a
// screen (Nov 2026).

/** Every CSS animation in the Lobby outside the open screen, and its state. */
const lobbyMotion = (page: Page) =>
  page.evaluate(() => {
    const layer = document.querySelector(".lobby-layer")!;
    return document
      .getAnimations()
      .filter((a): a is CSSAnimation => {
        const target = (a.effect as KeyframeEffect | null)?.target;
        return (
          a instanceof CSSAnimation &&
          !!target &&
          layer.contains(target) &&
          !target.closest(".ui-panel-host")
        );
      })
      .map((a) => {
        const effect = a.effect as KeyframeEffect;
        const t = effect.target!;
        return {
          what: `${a.animationName} on ${t.id ? `#${t.id}` : `.${t.classList[0]}`}${effect.pseudoElement ?? ""}`,
          state: a.playState,
        };
      });
  });
const moving = async (page: Page) =>
  (await lobbyMotion(page))
    .filter((m) => m.state === "running")
    .map((m) => m.what);

test("nothing in the Lobby moves under a screen or behind a dialog, and it moves again after", async ({
  page,
}) => {
  await page.setViewportSize({ width: 844, height: 390 });
  // The harness's look (classic) has the loops to watch: PLAY's glow and
  // sweep, on pseudo-elements. A spinning badge stands for whatever a
  // cosmetic might animate in the Lobby's stage.
  const errors = await openLobby(page);
  await page.evaluate(() => {
    const spin = document.createElement("i");
    spin.className = "test-spin";
    spin.style.cssText =
      "position:absolute;width:4px;height:4px;animation:lobby-idle 1s infinite";
    document.querySelector(".lobby-layer .lobby-stage")!.append(spin);
  });
  const loops = [
    "lobby-play-glow on .lobby-play::before",
    "lobby-play-sweep on #lobby-play::after",
    "lobby-idle on .test-spin",
  ];
  await expect.poll(() => moving(page)).toEqual(expect.arrayContaining(loops));

  // A full panel covers the Lobby: everything under it is paused.
  await page.click('.lobby-rail [data-lobby-action="fighters"]');
  await expect(
    page.locator(".ui-panel-host:not([data-ui-parked]) .roster-room"),
  ).toBeVisible();
  await expect.poll(() => moving(page)).toEqual([]);
  expect((await lobbyMotion(page)).map((m) => m.what)).toEqual(
    expect.arrayContaining(loops),
  );
  // Closed: it moves again.
  await page
    .locator(".ui-panel-host:not([data-ui-parked]) [data-ui-close]")
    .click();
  await expect(page.locator(".lobby-layer")).not.toHaveClass(/is-covered/);
  await expect.poll(() => moving(page)).toEqual(expect.arrayContaining(loops));

  // The game's dialog (Settings and the others draw in it): the Lobby's
  // own animations pause.
  await page.evaluate(() =>
    document.querySelector<HTMLDialogElement>("dialog")!.showModal(),
  );
  await expect(page.locator(".lobby-layer")).toHaveClass(/is-covered/);
  await expect
    .poll(async () =>
      (await moving(page)).filter((m) => loops.slice(0, 2).includes(m)),
    )
    .toEqual([]);
  await page.evaluate(() =>
    document.querySelector<HTMLDialogElement>("dialog")!.close(),
  );
  await expect(page.locator(".lobby-layer")).not.toHaveClass(/is-covered/);
  await expect.poll(() => moving(page)).toEqual(expect.arrayContaining(loops));
  expect(errors).toEqual([]);
});

/** How many recalculations restyled 600 elements or more while `act` ran
 * (Chromium's trace counts them: the same on a fast or a slow machine). */
async function bigRestyles(
  browser: Browser,
  page: Page,
  act: () => Promise<void>,
) {
  await browser.startTracing(page, { categories: ["devtools.timeline"] });
  await act();
  await page.waitForTimeout(1000);
  const events = JSON.parse((await browser.stopTracing()).toString())
    .traceEvents as {
    name: string;
    ph: string;
    args?: { elementCount?: number };
  }[];
  return events
    .filter((e) => e.name === "UpdateLayoutTree" && e.ph === "X")
    .map((e) => e.args?.elementCount ?? 0)
    .filter((n) => n >= 600);
}

test("a full screen's repeat open and its close restyle the Lobby once", async ({
  page,
  browser,
}) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 844, height: 390 });
  await playersLook(page);
  const errors = await openLobby(page);
  const shown = (sel: string) =>
    page.locator(`.ui-panel-host:not([data-ui-parked]) ${sel}`).first();
  const close = () =>
    page
      .locator(
        ".ui-panel-host:not([data-ui-parked]):not([data-ui-leaving]) [data-ui-close]",
      )
      .first()
      .click();
  const report: Record<string, number[]> = {};
  for (const [action, sel] of [
    ["fighters", ".roster-room"],
    ["shop", ".fit-room"],
  ] as const) {
    // The first open builds the screen (and loads its pictures): judged on
    // the repeat open, kept or not.
    await page.click(`.lobby-rail [data-lobby-action="${action}"]`);
    await expect(shown(sel)).toBeVisible();
    await page.waitForTimeout(1500);
    await close();
    await page.waitForTimeout(1500);
    report[`${action} open`] = await bigRestyles(browser, page, async () => {
      await page.click(`.lobby-rail [data-lobby-action="${action}"]`);
      await expect(shown(sel)).toBeVisible();
    });
    await page.waitForTimeout(1200);
    report[`${action} close`] = await bigRestyles(browser, page, close);
    await page.waitForTimeout(1200);
  }
  for (const [what, counts] of Object.entries(report))
    expect(counts.length, `${what}: ${counts.join(" + ")} elements`).toBe(1);
  expect(errors).toEqual([]);
});

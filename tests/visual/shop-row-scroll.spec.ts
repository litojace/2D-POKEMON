import { expect, test, type Locator, type Page } from "@playwright/test";
import { openLobby } from "./helpers";
import { onPlayersLook } from "./players-look";

// In the look players have (players-look.ts).
onPlayersLook();

// The Shop's fighter row scrolls sideways on a phone. Picking a fighter far
// along it must leave it where it is: it went back to the first fighter
// whenever the next pick's page had another number of parts (no collection
// line, or no skins yet), because ui/patch.ts rebuilt the whole box then
// (owner, 19 Nov 2026).
test.use({
  viewport: { width: 956, height: 440 },
  isMobile: true,
  hasTouch: true,
});

/**
 * Tap a fighter where it is, as a finger does: never scroll the row.
 *
 * Playwright's tap() scrolls the target into view again when its first try
 * fails (the fighter still moving, or something over it): each retry calls
 * scrollIntoView with another alignment, the first one `inline: "end"`. On a
 * slow CI runner that right-aligned the tapped fighter, which moved this very
 * row from its end (198) to 8, and the test blamed the Shop (21 Nov 2026,
 * "astrabun 8"). Wait instead until the fighter sits still and is what a tap
 * at its centre hits, then tap that point; what held it up goes in the log.
 * A fighter outside the row's view isn't tapped (false): the row moved, and
 * the caller reports where it is.
 */
async function tapInPlace(page: Page, target: Locator) {
  type Seen = { x: number; y: number } | "moving" | "covered" | "outside";
  let seen: Seen = "moving";
  await expect
    .poll(
      async () => {
        seen = await target.evaluate(
          (b) =>
            new Promise<Seen>((done) => {
              const a = b.getBoundingClientRect();
              requestAnimationFrame(() =>
                requestAnimationFrame(() => {
                  const log = (window as any).__rowLog as string[];
                  const name = b.getAttribute("data-fit-fighter");
                  const r = b.getBoundingClientRect();
                  const view = b
                    .closest(".fit-fighters")!
                    .getBoundingClientRect();
                  if (r.left < view.left || r.right > view.right)
                    return done("outside");
                  if (r.left !== a.left || r.top !== a.top) {
                    log.push(`${name} moving`);
                    return done("moving");
                  }
                  const x = r.left + r.width / 2,
                    y = r.top + r.height / 2;
                  const hit = document.elementFromPoint(x, y);
                  if (!hit || !b.contains(hit)) {
                    log.push(
                      `${name} covered by ${hit ? hit.getAttribute("class") || hit.nodeName : "nothing"}`,
                    );
                    return done("covered");
                  }
                  done({ x, y });
                }),
              );
            }),
        );
        return seen !== "moving" && seen !== "covered";
      },
      { intervals: [50, 100, 250] },
    )
    .toBe(true);
  const at = seen as Seen;
  if (typeof at !== "object") return false;
  await page.touchscreen.tap(at.x, at.y);
  return true;
}

async function tapAlongRow(page: Page) {
  const row = page.locator(".fit-room .fit-fighters").first();
  await expect(row).toBeVisible();
  const end = await row.evaluate((r) => {
    r.scrollLeft = r.scrollWidth;
    return Math.round(r.scrollLeft);
  });
  expect(end).toBeGreaterThan(50);
  const names = await row
    .locator(".fit-fighter")
    .evaluateAll((bs) => bs.map((b) => b.getAttribute("data-fit-fighter")!));
  // What happened to the row, for a failure.
  await row.evaluate((r) => {
    const w = window as any;
    const t0 = performance.now();
    const log: string[] = (w.__rowLog = []);
    const at = () => Math.round(performance.now() - t0);
    w.__row = r;
    r.addEventListener("scroll", () =>
      log.push(`${at()} scroll ${Math.round(r.scrollLeft)}`),
    );
    new MutationObserver((records) => {
      for (const m of records)
        for (const n of Array.from(m.removedNodes))
          if (n === r || n.contains(r))
            log.push(
              `${at()} row removed with ${n === r ? "itself" : (n as Element).className || n.nodeName}`,
            );
    }).observe(document.body, { childList: true, subtree: true });
  });
  const seen: string[] = [];
  // The last few, twice over: every kind of page lands on another.
  for (const name of [...names.slice(-5), ...names.slice(-5)]) {
    await page.evaluate((name) => {
      const w = window as any;
      const now = document.querySelector<HTMLElement>(
        ".fit-room .fit-fighters",
      );
      w.__rowLog.push(
        `tap ${name}: row ${now === w.__row ? "same" : "new"} at ${Math.round(now?.scrollLeft ?? -1)}`,
      );
    }, name);
    if (
      !(await tapInPlace(page, row.locator(`[data-fit-fighter="${name}"]`)))
    ) {
      seen.push(
        `${name} ${await row.evaluate((r) => Math.round(r.scrollLeft))}`,
      );
      break;
    }
    await expect(row.locator(`[data-fit-fighter="${name}"]`)).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    seen.push(
      `${name} ${await page
        .locator(".fit-room .fit-fighters")
        .first()
        .evaluate((r) => Math.round(r.scrollLeft))}`,
    );
  }
  expect(
    seen,
    (await page.evaluate(() => (window as any).__rowLog as string[])).join(
      "; ",
    ),
  ).toEqual(seen.map((s) => `${s.split(" ")[0]} ${end}`));
}

test("the Shop's and the Wardrobe's fighter rows stay where you scrolled them", async ({
  page,
}) => {
  const errors = await openLobby(page);
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  await page.click('.fit-room [role="tab"]:has-text("Skins")');
  await tapAlongRow(page);
  await page.click('.fit-room [data-ui-mode="wardrobe"]');
  await tapAlongRow(page);
  expect(errors).toEqual([]);
});

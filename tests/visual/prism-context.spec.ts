import { expect, test, type Page } from "@playwright/test";

import { createRoom, openHub, openPlayPanel, pushUntilBattle } from "./helpers";

/**
 * Prismatail's Turn mirror / Look away on phones (owner, 20 Nov 2026): one
 * round contextual button in the touch cluster's slot, left of skill 1
 * (above it on a narrow screen), shown only when it can be used: Turn
 * mirror by a mirror; Look away while Glare winds up, taking the slot, with
 * the wind-up as a ring. Its drawn icon sits on the circle's centre.
 */
const SIZES = [
  { width: 852, height: 393 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
];

async function setHero(page: Page, x: number, y: number) {
  await page.evaluate(
    ([x, y]) => {
      const w = window as any;
      const me = w.__snap.players.find((p: any) => p.id === "me");
      me.x = x;
      me.y = y;
      w.__snap.raid.warnings = w.__snap.raid.warnings.filter(
        (v: any) => v.kind === "glare",
      );
      w.__snap.time += 0.1;
      w.__push();
    },
    [x, y],
  );
}
/** The buttons that show, each with its box and its icon's centre offset. */
const shown = (page: Page) =>
  page.evaluate(() =>
    Array.from(
      document.querySelectorAll<HTMLElement>("#raid-prism-controls button"),
    )
      .filter((b) => b.offsetWidth > 0)
      .map((b) => {
        const r = b.getBoundingClientRect(),
          icon = b.querySelector("svg")!.getBoundingClientRect();
        return {
          kind: b.hasAttribute("data-prism-away") ? "away" : "turn",
          x: r.x,
          y: r.y,
          width: r.width,
          height: r.height,
          dx: icon.x + icon.width / 2 - (r.x + r.width / 2),
          dy: icon.y + icon.height / 2 - (r.y + r.height / 2),
          ring: getComputedStyle(b, "::before").backgroundImage,
        };
      }),
  );

/** Its pop-in over (a busy CI runner starts it late): measure after. */
const settled = (page: Page) =>
  page.evaluate(() =>
    Promise.all(
      Array.from(
        document.querySelectorAll<HTMLElement>("#raid-prism-controls button"),
      ).flatMap((b) => b.getAnimations().map((a) => a.finished)),
    ).then(() => undefined),
  );

/** How far the one button shown is off its slot (0 when in place). */
const offSlot = (page: Page) =>
  page.evaluate(() => {
    const b = Array.from(
      document.querySelectorAll<HTMLElement>("#raid-prism-controls button"),
    ).find((b) => b.offsetWidth > 0);
    if (!b) return Infinity;
    const r = b.getBoundingClientRect(),
      s = document
        .querySelector(".touch-buttons .touch-context")!
        .getBoundingClientRect();
    return Math.round(Math.max(Math.abs(r.x - s.x), Math.abs(r.y - s.y)));
  });

for (const size of SIZES)
  test(`Prismatail's contextual button shows only when usable, centred, at ${size.width}x${size.height}`, async ({
    browser,
  }) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: size,
      isMobile: true,
      hasTouch: true,
    });
    try {
      const page = await context.newPage();
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", { boss: "prismatail" }),
      );
      await openPlayPanel(page);
      await createRoom(page);
      await pushUntilBattle(page);
      await expect(page.locator("#raid-prism-controls")).toHaveClass(
        /is-context/,
      );
      // The cluster settles after the fight starts (slower on CI): measure
      // once two reads agree.
      const boxes = () =>
        page.evaluate(() => {
          const box = (selector: string) => {
            const r = document.querySelector(selector)!.getBoundingClientRect();
            return { x: r.x, y: r.y, width: r.width, height: r.height };
          };
          return {
            slot: box(".touch-buttons .touch-context"),
            skill1: box('.touch-buttons [data-skill="0"]'),
          };
        });
      let last = "";
      await expect
        .poll(async () => {
          const now = JSON.stringify(await boxes());
          const same = now === last;
          last = now;
          return same;
        })
        .toBe(true);
      const { slot, skill1 } = JSON.parse(last) as Awaited<
        ReturnType<typeof boxes>
      >;
      // Left of skill 1, level with it (a narrow screen: above it).
      if (size.width >= 600) {
        expect(slot.x + slot.width).toBeLessThanOrEqual(skill1.x);
        expect(
          Math.abs(slot.y + slot.height / 2 - skill1.y - skill1.height / 2),
        ).toBeLessThanOrEqual(2);
      } else expect(slot.y + slot.height).toBeLessThanOrEqual(skill1.y);

      // Far from every mirror, no Glare: nothing shows.
      await setHero(page, 300, 780);
      await expect.poll(() => shown(page)).toEqual([]);

      // By a mirror: Turn mirror, round, in the slot, its icon centred.
      const mirror = await page.evaluate(
        () => (window as any).__snap.raid.mirrors[2],
      );
      await setHero(page, mirror.x + 70, mirror.y + 40);
      await expect
        .poll(async () => (await shown(page)).map((b) => b.kind))
        .toEqual(["turn"]);
      await settled(page);
      // In the slot (where it is now).
      await expect.poll(() => offSlot(page)).toBeLessThanOrEqual(1);
      const [turn] = await shown(page);
      expect(Math.abs(turn.width - turn.height)).toBeLessThanOrEqual(1);
      expect(Math.abs(turn.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(turn.dy)).toBeLessThanOrEqual(1);

      // Glare winds up: Look away takes the slot, with its wind-up ring.
      await page.evaluate(() => {
        const w = window as any,
          s = w.__snap,
          boss = s.players.find((p: any) => p.raidBoss);
        s.raid.warnings = [
          {
            id: 901,
            kind: "glare",
            startedAt: s.time - 1,
            at: s.time + 1,
            x: boss.x,
            y: boss.y,
            tx: boss.x,
            ty: boss.y,
            radius: 900,
          },
        ];
        w.__push();
      });
      await expect
        .poll(async () => (await shown(page)).map((b) => b.kind))
        .toEqual(["away"]);
      await settled(page);
      await expect.poll(() => offSlot(page)).toBeLessThanOrEqual(1);
      const [away] = await shown(page);
      expect(Math.abs(away.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(away.dy)).toBeLessThanOrEqual(1);
      expect(away.ring).toContain("conic-gradient");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

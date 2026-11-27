import { expect, test, type Page } from "@playwright/test";

import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

/**
 * Prismatail's Turn mirror / Look away on phones (owner, 24 Nov 2026): two
 * round buttons side by side in the court's free top-right corner, left of
 * the target button, both always showing. Turn mirror dims with no mirror
 * in reach; Look away lights up while Glare winds up, with the wind-up as a
 * ring. Each drawn icon sits on its circle's centre.
 */
const SIZES = [
  { width: 852, height: 393 },
  { width: 844, height: 390 },
  { width: 667, height: 375 },
  { width: 568, height: 320 },
  // Squat: the boss bar is just above, so the pair stays level with the
  // target button, left of the cluster.
  { width: 844, height: 280 },
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
          ready: b.hasAttribute("data-ready"),
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

/** How far the pair is off its slot's two ends (0 when in place). */
const offSlot = (page: Page) =>
  page.evaluate(() => {
    const b = Array.from(
      document.querySelectorAll<HTMLElement>("#raid-prism-controls button"),
    ).filter((b) => b.offsetWidth > 0);
    if (b.length !== 2) return Infinity;
    const [l, r] = b.map((e) => e.getBoundingClientRect()),
      s = document
        .querySelector(".touch-buttons .touch-context")!
        .getBoundingClientRect();
    return Math.round(
      Math.max(
        Math.abs(l.x - s.x),
        Math.abs(r.right - s.right),
        Math.abs(l.y - s.y),
        Math.abs(r.y - s.y),
      ),
    );
  });

for (const size of SIZES)
  test(`Prismatail's Turn mirror and Look away show together, top right, centred, at ${size.width}x${size.height}`, async ({
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
            aim: box(".touch-buttons [data-aim]"),
            hud: box(".raid-elapsed"),
            buttons: Array.from(
              document.querySelectorAll(".touch-buttons > button"),
            ).map((b) => {
              const r = b.getBoundingClientRect();
              return { x: r.x, y: r.y, width: r.width, height: r.height };
            }),
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
      const { slot, aim, hud, buttons } = JSON.parse(last) as Awaited<
        ReturnType<typeof boxes>
      >;
      // Left of the target button, level with it or above, under the clock,
      // clear of every cluster button with room for the names below.
      expect(slot.x + slot.width).toBeLessThanOrEqual(aim.x);
      expect(slot.y + slot.height / 2).toBeLessThanOrEqual(
        aim.y + aim.height / 2 + 1,
      );
      expect(slot.y).toBeGreaterThanOrEqual(hud.y + hud.height);
      for (const b of buttons)
        expect(
          slot.x < b.x + b.width &&
            slot.x + slot.width > b.x &&
            slot.y < b.y + b.height &&
            slot.y + slot.height + 11 > b.y,
        ).toBe(false);

      // Far from every mirror, no Glare: both show, neither lit.
      await setHero(page, 300, 780);
      await expect
        .poll(async () =>
          (await shown(page)).map((b) => `${b.kind}:${b.ready}`),
        )
        .toEqual(["turn:false", "away:false"]);
      await expect.poll(() => offSlot(page)).toBeLessThanOrEqual(1);

      // By a mirror: Turn mirror lights up; round, its icon centred.
      const mirror = await page.evaluate(
        () => (window as any).__snap.raid.mirrors[2],
      );
      await setHero(page, mirror.x + 70, mirror.y + 40);
      await expect
        .poll(async () =>
          (await shown(page)).map((b) => `${b.kind}:${b.ready}`),
        )
        .toEqual(["turn:true", "away:false"]);
      await settled(page);
      await snap(
        page,
        test.info(),
        `prism-pair-${size.width}x${size.height}-mirror`,
      );
      for (const b of await shown(page)) {
        expect(Math.abs(b.width - b.height)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.dx)).toBeLessThanOrEqual(1);
        expect(Math.abs(b.dy)).toBeLessThanOrEqual(1);
      }

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
        .poll(async () =>
          (await shown(page)).map((b) => `${b.kind}:${b.ready}`),
        )
        .toEqual(["turn:true", "away:true"]);
      await expect.poll(() => offSlot(page)).toBeLessThanOrEqual(1);
      await snap(
        page,
        test.info(),
        `prism-pair-${size.width}x${size.height}-glare`,
      );
      const away = (await shown(page)).find((b) => b.kind === "away")!;
      expect(Math.abs(away.dx)).toBeLessThanOrEqual(1);
      expect(Math.abs(away.dy)).toBeLessThanOrEqual(1);
      expect(away.ring).toContain("conic-gradient");
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

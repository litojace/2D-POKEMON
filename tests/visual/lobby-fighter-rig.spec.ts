import { expect, test } from "@playwright/test";
import { openLobby, snap } from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// The Lobby's fighter moves with the same live rig as the Fighters roster
// (shop-preview.ts, "selection" framing), laid over its still artwork.
const SIZES = [
  { name: "1440x900", width: 1440, height: 900, phone: false },
  { name: "852x393-island", width: 852, height: 393, phone: true },
];
const art = "#lobby-fighter-art";

for (const size of SIZES)
  test(`the Lobby fighter is the live rig, sized like its artwork, at ${size.name}`, async ({
    browser,
  }, info) => {
    test.setTimeout(120_000);
    const context = await browser.newContext({
      viewport: { width: size.width, height: size.height },
      isMobile: size.phone,
      hasTouch: size.phone,
    });
    try {
      const page = await context.newPage();
      const errors = await openLobby(page);
      if (size.phone) await setInsets(page, ISLAND);
      await expect(page.locator(art)).toHaveClass(/is-ready/, {
        timeout: 30_000,
      });
      const champion = await page
        .locator(art)
        .getAttribute("data-preview-champion");

      // It moves: the rig's clock runs.
      const clock = () =>
        page.evaluate(
          (s) =>
            Number(
              document.querySelector<HTMLElement>(s)!.dataset.animationTime,
            ),
          art,
        );
      const t1 = await clock();
      await expect.poll(clock, { timeout: 10_000 }).toBeGreaterThan(t1);

      // The canvas lies exactly on the artwork, in the rig's padded frame.
      const boxes = await page.evaluate((s) => {
        const host = document.querySelector(s)!;
        const svg = host.querySelector(":scope > svg:not(.ta-front-layer)")!;
        const r = (e: Element) => {
          const b = e.getBoundingClientRect();
          return [b.x, b.y, b.width, b.height].map((v) => Math.round(v));
        };
        return {
          svg: r(svg),
          canvas: r(host.querySelector(":scope > canvas")!),
          frame: svg.getAttribute("viewBox"),
        };
      }, art);
      expect(boxes.canvas).toEqual(boxes.svg);
      expect(boxes.frame).toBe("-20 -40 240 250");
      // The still fighter steps aside once the rig is drawn (no double fighter).
      expect(
        await page.evaluate(
          (s) =>
            getComputedStyle(document.querySelector(`${s} .fighter-character`)!)
              .visibility,
          art,
        ),
      ).toBe("hidden");
      // No empty band above the fighter: the party row takes the stage's
      // free height, and the fighter grows until the row's height, the room
      // beside a seat on each side (36% of the fighter), or the 560 px cap.
      const fit = await page.evaluate(() => {
        const box = (s: string) => {
          const b = document.querySelector(s)!.getBoundingClientRect();
          return { l: b.left, t: b.top, r: b.right, b: b.bottom };
        };
        const row = document.querySelector(".lobby-party")!;
        const css = getComputedStyle(row);
        return {
          gap: parseFloat(css.columnGap),
          podiums: [
            ".lobby-floor",
            "#lobby-slot-0 .lobby-podium",
            "#lobby-slot-1 .lobby-podium",
          ].map((s) => {
            const b = document.querySelector(s)!.getBoundingClientRect();
            return b.top + b.height / 2;
          }),
          stage: box(".lobby-stage"),
          party: box(".lobby-party"),
          fighter: box("#lobby-fighter"),
          plate: box(".lobby-nameplate"),
          seats: [0, 1].map((i) => box(`#lobby-slot-${i} > *`)),
          third: getComputedStyle(document.getElementById("lobby-slot-2")!)
            .display,
          rail: box(".lobby-rail"),
          cards: box(".lobby-cards"),
          play: box(".lobby-play"),
          toast:
            (document.getElementById("toast")!.classList.add("show"),
            box("#toast")),
        };
      });
      const { stage, party, fighter, plate } = fit;
      const side = fighter.b - fighter.t;
      const room = Math.min(
        party.b - party.t,
        (party.r - party.l - 2 * fit.gap) / 1.72,
        560,
      );
      expect(side, "the fighter fills the stage").toBeGreaterThan(room - 1);
      expect(side).toBeGreaterThan(size.phone ? 200 : 500);
      expect(fighter.t).toBeGreaterThanOrEqual(stage.t - 0.5);
      expect(fighter.b).toBeLessThanOrEqual(party.b + 0.5);
      expect(plate.t).toBeGreaterThanOrEqual(fighter.b);
      const overlaps = (a: typeof stage, b: typeof stage) =>
        a.l < b.r && b.l < a.r && a.t < b.b && b.t < a.b;
      // Balanced: the fighter and its nameplate share one axis, and a seat
      // stands the same distance from each side of it. Alone, there is no
      // third seat (it appears above the right one once both are taken; see
      // lobby.spec). No seat covers the fighter.
      const [left, right] = fit.seats;
      const mid = (b: typeof stage) => (b.l + b.r) / 2;
      expect(Math.abs(mid(fighter) - mid(plate))).toBeLessThanOrEqual(1);
      expect(
        Math.abs(fighter.l - left.r - (right.l - fighter.r)),
      ).toBeLessThanOrEqual(1);
      expect(left.b).toBeCloseTo(right.b, 0);
      expect(fit.third).toBe("none");
      // One floor: every podium is centred on the fighter's shadow line.
      const floor = fighter.t + 0.9307 * side;
      for (const y of fit.podiums)
        expect(Math.abs(y - floor), "podium on the floor").toBeLessThan(1.5);
      for (const seat of fit.seats) {
        expect(overlaps(seat, fighter)).toBe(false);
        expect(overlaps(seat, party) && seat.l >= party.l - 0.5).toBe(true);
        expect(seat.r).toBeLessThanOrEqual(party.r + 0.5);
      }
      for (const other of [fit.rail, fit.cards, fit.play, fit.toast])
        expect(overlaps(stage, other)).toBe(false);
      await page.evaluate(() =>
        document.getElementById("toast")!.classList.remove("show"),
      );
      await snap(page, info, `lobby-fighter-rig-${size.name}`);

      // A screen over the Lobby puts the rig to sleep.
      await page.click('.lobby-rail [data-lobby-action="shop"]');
      await expect(page.locator(art)).toHaveAttribute(
        "data-rendering",
        "false",
      );
      await page.keyboard.press("Escape");
      await page.evaluate(() =>
        (document.getElementById("dialog") as HTMLDialogElement).close(),
      );

      // The arrows step to the next fighter, and the rig follows.
      await page.click('[data-lobby-step="1"]');
      await expect(page.locator(art)).not.toHaveAttribute(
        "data-preview-champion",
        champion!,
      );
      await expect(page.locator(art)).toHaveClass(/is-ready/, {
        timeout: 30_000,
      });
      expect(await page.locator(`${art} > canvas`).count()).toBe(1);
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// Party members as the server sends them: the skin saved on their champion
// and their raid look, read from their own accounts.
const ME = "11111111-1111-4111-8111-111111111111";
const FRIENDS = [
  {
    id: "33333333-3333-4333-8333-333333333333",
    name: "Pal",
    character: "tidefin",
    skin: { skin: "tidefin-abyss", stage: 1 },
    look: { aura: "mountain-aura" },
  },
  {
    id: "66666666-6666-4666-8666-666666666666",
    name: "Bo",
    character: "voltkit",
    skin: { skin: "voltkit-stormcrown", stage: 3 },
    look: { aura: "spark-aura" },
  },
];
const joinParty = (page: import("@playwright/test").Page) =>
  page.evaluate(
    ([me, friends]) =>
      (window as any).__sock.fire("party", {
        code: "PARTY2",
        leader: me,
        members: [{ id: me, name: "tester", character: "voltkit" }, ...friends],
      }),
    [ME, FRIENDS] as const,
  );

test("friends stand in their saved skin and look, live, on the same floor", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = await openLobby(page);
  await joinParty(page);
  const seat = (i: number) =>
    page.locator(`#lobby-slot-${i} .lobby-member-art`);
  for (const [i, friend] of FRIENDS.entries()) {
    await expect(seat(i)).toHaveAttribute(
      "data-preview-champion",
      friend.character,
    );
    await expect(seat(i)).toHaveAttribute(
      "data-preview-item",
      friend.skin.skin,
    );
    await expect(seat(i)).toHaveAttribute(
      "data-preview-stage",
      String(friend.skin.stage),
    );
    await expect(seat(i)).toHaveAttribute(
      "data-preview-look",
      encodeURIComponent(JSON.stringify(friend.look)),
    );
    // The same live rig as yours, lying exactly on the still artwork.
    await expect(seat(i)).toHaveClass(/is-ready/, { timeout: 40_000 });
    const boxes = await seat(i).evaluate((host) => {
      const r = (e: Element) => {
        const b = e.getBoundingClientRect();
        return [b.x, b.y, b.width, b.height].map((v) => Math.round(v));
      };
      return [
        r(host.querySelector(":scope > svg:not(.ta-front-layer)")!),
        r(host.querySelector(":scope > canvas")!),
      ];
    });
    expect(boxes[1]).toEqual(boxes[0]);
  }
  // The fourth seat is open, further back above the right friend.
  await expect(
    page.locator("#lobby-slot-2 [data-lobby-action=invite]"),
  ).toBeVisible();
  // Your fighter and both friends stand on one floor line.
  const lines = await page.evaluate(() => {
    const f = document.getElementById("lobby-fighter")!.getBoundingClientRect();
    const mid = (s: string) => {
      const b = document.querySelector(s)!.getBoundingClientRect();
      return b.top + b.height / 2;
    };
    return {
      floor: f.top + 0.9307 * f.height,
      podiums: [
        ".lobby-floor",
        "#lobby-slot-0 .lobby-podium",
        "#lobby-slot-1 .lobby-podium",
      ].map(mid),
    };
  });
  for (const y of lines.podiums)
    expect(Math.abs(y - lines.floor)).toBeLessThan(1.5);
  await snap(page, info, "lobby-party-rigs-1440x900");
  // A screen over the Lobby puts every rig to sleep.
  await page.click('.lobby-rail [data-lobby-action="shop"]');
  for (const i of [0, 1])
    await expect(seat(i)).toHaveAttribute("data-rendering", "false");
  expect(errors).toEqual([]);
});

test("Low graphics keeps the Lobby fighter and friends as still artwork", async ({
  page,
}) => {
  await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
  const errors = await openLobby(page);
  await joinParty(page);
  await expect(page.locator(`${art} > svg`).first()).toBeVisible();
  await expect(
    page.locator("#lobby-slot-0 .lobby-member-art > svg").first(),
  ).toBeVisible();
  await page.waitForTimeout(2000);
  expect(await page.locator(".lobby-party canvas").count()).toBe(0);
  await expect(page.locator(art)).not.toHaveClass(/is-ready/);
  expect(errors).toEqual([]);
});

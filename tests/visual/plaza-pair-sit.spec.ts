import { expect, test, type Page } from "@playwright/test";
import { openPlaza, snap } from "./helpers";
import {
  PLAZA_EMOTES,
  PLAZA_FLAG,
  PLAZA_SEATS,
} from "../../packages/shared/src/plaza";

// Pair emotes from a player's card and sitting on the benches and the
// fountain's rim, on the narrowest phone in landscape. The harness runs the
// real PlazaWorld in the page (harness/plaza-sim.ts) for the game server.
const PHONE = { width: 667, height: 375 };

/** A box stays on screen (the phone's whole width and height). */
async function onScreen(page: Page, selector: string) {
  const r = await page
    .locator(selector)
    .evaluate((el) => el.getBoundingClientRect().toJSON());
  expect(r.left, `${selector} left`).toBeGreaterThanOrEqual(0);
  expect(r.top, `${selector} top`).toBeGreaterThanOrEqual(0);
  expect(r.right, `${selector} right`).toBeLessThanOrEqual(PHONE.width);
  expect(r.bottom, `${selector} bottom`).toBeLessThanOrEqual(PHONE.height);
}
/** Rin, another player, beside you; resolves once she's drawn. */
async function addRin(page: Page) {
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.bodyOf("local");
    w.__plazaWorld.join("other", "acct-other", {
      name: "Rin",
      title: null,
      titleColor: null,
      level: 7,
      character: "tidefin",
      skin: null,
    });
    Object.assign(w.__plazaWorld.bodyOf("other"), { x: me.x + 90, y: me.y });
  });
  await expect
    .poll(
      () =>
        page.evaluate(() =>
          [...(window as any).__plaza.others.values()].some(
            (b: any) => b.name === "Rin",
          ),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}
const server = (page: Page) =>
  page.evaluate(() => {
    const w = (window as any).__plazaWorld;
    return {
      seat: w.seatOf("local") as number,
      body: { ...w.bodyOf("local") },
    };
  });

test("pair emotes: ask from a player's card and accept a request, on a small phone", async ({
  page,
}, info) => {
  await page.setViewportSize(PHONE);
  const errors = await openPlaza(page);
  await addRin(page);
  const spot = await page.evaluate(() => {
    const p = (window as any).__plaza,
      rin = [...p.others.values()].find((b: any) => b.name === "Rin");
    return p.worldClient(rin.tx, rin.ty - 30);
  });
  await page.mouse.click(spot.x, spot.y);
  const card = page.locator("#pz-card");
  await expect(card).toBeVisible();
  const pairs = card.locator('[data-pc="pair"]');
  await expect(pairs).toHaveText([/High five/, /Hug/, /Dance together/]);
  // The taller card still fits the phone, its buttons big enough for a thumb.
  await onScreen(page, "#pz-card");
  for (const h of await pairs.evaluateAll((els) =>
    els.map((e) => e.getBoundingClientRect().height),
  ))
    expect(h).toBeGreaterThanOrEqual(36);
  await snap(page, info, "plaza-pair-card-667x375");
  // Ask Rin for a high five: the server holds it for her to answer.
  await pairs.filter({ hasText: "High five" }).click();
  await expect(card).toBeHidden();
  await expect(page.locator("#toast")).toContainText("Asked Rin");
  const asked = await page.evaluate(() => (window as any).__plazaPairAsks);
  expect(asked).toEqual([
    expect.objectContaining({ to: "other", kind: "highfive", name: "tester" }),
  ]);
  // She says yes: both play it, facing each other.
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.profileOf("local").id,
      r = w.__plazaWorld.pairAnswer("other", me, true, Date.now());
    w.__sock.fire("plaza-pair", r.start);
  });
  await expect
    .poll(() =>
      page.evaluate(() => {
        const p = (window as any).__plaza,
          rin = [...p.others.values()].find((b: any) => b.name === "Rin");
        return [p.P.pairKind, p.P.face, rin.pairKind, rin.face];
      }),
    )
    .toEqual(["highfive", 1, "highfive", -1]);
  await snap(page, info, "plaza-pair-highfive-667x375");

  // Now Rin asks you for a hug: a small prompt you can accept.
  await page.waitForTimeout(2200);
  await page.evaluate(() => {
    const w = window as any,
      me = w.__plazaWorld.profileOf("local").id,
      r = w.__plazaWorld.pairAsk("other", me, "hug", Date.now());
    w.__sock.fire("plaza-pair-ask", r.ask);
  });
  const ask = page.locator("#pz-ask");
  await expect(ask).toBeVisible();
  await expect(ask).toContainText("Rin wants a hug!");
  await onScreen(page, "#pz-ask");
  await snap(page, info, "plaza-pair-ask-667x375");
  await ask.locator('[data-pa="yes"]').click();
  await expect(ask).toBeHidden();
  // The server plays it for both: the hug's emote with the pair flag.
  const heart = PLAZA_EMOTES.indexOf("❤️") + 1;
  await expect
    .poll(() =>
      page.evaluate(
        ([pair]) => {
          const w = (window as any).__plazaWorld,
            rin = w.profileOf("other").id,
            seen = w.view("local").state.walkers.find((x: any) => x[0] === rin);
          return [seen[6], seen[5] & pair];
        },
        [PLAZA_FLAG.pair],
      ),
    )
    .toEqual([heart, PLAZA_FLAG.pair]);
  await expect
    .poll(() => page.evaluate(() => (window as any).__plaza.P.pairKind))
    .toBe("hug");
  expect(errors).toEqual([]);
});

test("sit on a bench and the fountain's rim; moving stands you up", async ({
  page,
}, info) => {
  await page.setViewportSize(PHONE);
  const errors = await openPlaza(page);
  const sitAt = async (i: number) => {
    const s = PLAZA_SEATS[i];
    await page.evaluate(
      ([x, y]) => (window as any).__plazaPosition(x, y),
      [s.x, s.y + 40],
    );
    // Your screen follows the teleport a frame or two later.
    await expect
      .poll(
        () =>
          page.evaluate(
            ([x, y]) => {
              const P = (window as any).__plaza.P;
              return Math.hypot(P.x - x, P.y - y);
            },
            [s.x, s.y + 40],
          ),
        { timeout: 15_000 },
      )
      .toBeLessThan(10);
    const act = page.locator("#pz-interact");
    await expect(act).toBeVisible({ timeout: 15_000 });
    await expect(act).toContainText("Sit");
    await act.click();
    await expect
      .poll(async () => (await server(page)).seat, { timeout: 15_000 })
      .toBe(i);
    const srv = await server(page);
    expect([srv.body.x, srv.body.y]).toEqual([s.x, s.y]);
    await expect(act).toContainText("Stand up");
    await onScreen(page, "#pz-interact");
    // Drawn raised onto the seat.
    expect(await page.evaluate(() => (window as any).__plaza.P.sitLift)).toBe(
      s.lift,
    );
  };
  // A bench.
  await sitAt(0);
  await page.waitForTimeout(400);
  await snap(page, info, "plaza-sit-bench-667x375");
  // Walking stands you up, on the server too.
  await page.locator(".plaza-layer").focus();
  await page.keyboard.down("d");
  await expect
    .poll(async () => (await server(page)).seat, { timeout: 15_000 })
    .toBe(-1);
  await page.keyboard.up("d");
  expect(await page.evaluate(() => (window as any).__plaza.P.sitLift)).toBe(0);
  // The fountain's rim (the seat in front), then Stand up.
  const rim = PLAZA_SEATS.findIndex(
    (s, i) => i >= 8 && Math.abs(s.x - 1350) < 50,
  );
  expect(rim).toBeGreaterThan(0);
  await sitAt(rim);
  await page.waitForTimeout(400);
  await snap(page, info, "plaza-sit-fountain-667x375");
  await page.locator("#pz-interact").click();
  await expect
    .poll(async () => (await server(page)).seat, { timeout: 15_000 })
    .toBe(-1);
  expect(errors).toEqual([]);
});

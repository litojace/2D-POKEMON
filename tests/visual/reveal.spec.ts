import { expect, test } from "@playwright/test";
import {
  createRoom,
  openLobby,
  openPlayPanel,
  pickRoomMode,
  snap,
} from "./helpers";
import { ISLAND, setInsets } from "./ui-measure";

// The Reveal (docs/hidden-picks.md): a PvP match's briefing. Each player's
// card starts face down (a "?" and their name) while the arena loads, then
// turns over to their fighter: the fighter's name, element and role, and
// the player's name, every line whole and level with its neighbours'. 1v1
// and 2v2 face off across a VS; a free-for-all is one row. Phones held
// sideways keep every card and "I'm ready" on screen, without scrolling.
const SIZES = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "1280x720", width: 1280, height: 720, phone: false },
  { name: "1440x900", width: 1440, height: 900, phone: false },
];
const MODES = [
  { name: "duel", mode: "duel", seats: 2, vs: 1 },
  { name: "teams", mode: "teams", seats: 4, vs: 1 },
  { name: "ffa3", mode: "ffa", seats: 3, vs: 0 },
  { name: "ffa4", mode: "ffa", seats: 4, vs: 0 },
] as const;

for (const size of SIZES)
  for (const m of MODES)
    test(`the Reveal, ${m.name} at ${size.name}`, async ({ browser }, info) => {
      test.setTimeout(90_000);
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        isMobile: size.phone,
        hasTouch: size.phone,
      });
      try {
        const page = await context.newPage();
        const errors = await openLobby(page);
        await page.evaluate((o) => (window as any).__room("pvp", o), {
          mode: m.mode,
          phase: "lobby",
          seats: m.seats,
        });
        await openPlayPanel(page);
        await pickRoomMode(page, m.mode);
        await createRoom(page);
        await expect
          .poll(async () => {
            await page.evaluate(() => (window as any).__push());
            return page.locator(".room-screen .roster-room").count();
          })
          .toBe(1);
        // Watch the Reveal every frame: once in, it stays in. (When the arena
        // finished loading it popped in again, the whole screen blinking out,
        // and a measure taken then caught it mid-pop: CI, 19 Nov.)
        await page.evaluate(() => {
          const w = window as any;
          w.__revealShown = false;
          w.__revealBlinks = [] as string[];
          const tick = () => {
            const c = document.querySelector<HTMLElement>(
              "#arena-overlay .match-reveal",
            );
            if (c) {
              const o = Number(getComputedStyle(c).opacity);
              const r = c.getBoundingClientRect();
              const whole = o === 1 && Math.abs(r.width - innerWidth) < 0.5;
              if (whole) w.__revealShown = true;
              else if (w.__revealShown && w.__revealBlinks.length < 5)
                w.__revealBlinks.push(
                  `${c.querySelector(".rv-load span")?.textContent}: opacity ${o.toFixed(2)}, ${r.width.toFixed(1)} wide`,
                );
            }
            requestAnimationFrame(tick);
          };
          requestAnimationFrame(tick);
        });
        // The match starts: every pick is sent; the cards start face down.
        // Looked at as the Reveal first shows, in the same step: it draws
        // itself again while the arena loads and turns its cards over once
        // the arena is in, snapshot or not (main.ts watchArenaLoad), so on
        // a slow CI runner they had turned and landed (2.3 s for four)
        // before later looks (#462).
        const first = await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "briefing";
          w.__push();
          const c = document.querySelector("#arena-overlay .match-reveal");
          return {
            backs: c?.querySelectorAll(".vs-back").length ?? 0,
            names: [...(c?.querySelectorAll(".vs-back small") ?? [])].map(
              (e) => e.textContent,
            ),
            asks: [...(c?.querySelectorAll(".vs-back .vs-q") ?? [])].map(
              (e) => e.textContent,
            ),
          };
        });
        expect(first.backs).toBe(m.seats);
        expect(first.names[0]).toBe("tester");
        expect(first.names).toHaveLength(m.seats);
        expect(first.asks).toEqual(Array(m.seats).fill("?"));
        const card = page.locator("#arena-overlay .match-reveal");
        await expect(card.locator("h2")).toHaveText("The Reveal");
        const cards = card.locator(".rv-card");
        await expect(cards).toHaveCount(m.seats);
        await expect(card.locator(".vs-mark")).toHaveCount(m.vs);
        await expect(card.locator(".eyebrow")).toContainText(
          m.mode === "teams"
            ? "2v2 Teams"
            : m.mode === "ffa"
              ? `Free-for-all · ${m.seats} players`
              : "1v1 Duel",
        );
        if (process.env.VISUAL_SHOTS)
          await page.screenshot({
            path: `${process.env.VISUAL_SHOTS}/reveal-${m.name}-start-${size.name}.png`,
          });
        // Snapshots keep coming: every card turns over, and stays turned.
        await expect
          .poll(
            async () => {
              await page.evaluate(() => (window as any).__push());
              return card.locator(".vs-flip").count();
            },
            { timeout: 15_000, intervals: [250] },
          )
          .toBe(0);
        await expect(cards.locator("svg[data-fighter]")).toHaveCount(m.seats);
        await expect(card.locator(".rv-card.me .rv-you")).toHaveText("You");
        await expect(card.locator(".rv-card.me .rv-player")).toHaveText(
          "tester",
        );
        await expect(card.locator(".rv-load span")).toHaveText(
          "Arena and every fighter loaded",
        );
        const ready = page.locator("#instructions-ready");
        await expect(ready).toBeEnabled();

        // A loading screen: no chat button on it, neither kind.
        await expect(page.locator("#chat-button")).toBeHidden();
        await expect(page.locator("#battle-chat")).toBeHidden();
        // A frame or two after loading ends, for the sampler to see one.
        await page.evaluate(
          () =>
            new Promise((r) =>
              requestAnimationFrame(() => requestAnimationFrame(r)),
            ),
        );
        expect(
          await page.evaluate(() => (window as any).__revealBlinks),
          "the Reveal popped in again",
        ).toEqual([]);
        const problems = await page.evaluate(() => {
          const out: string[] = [];
          const R = (e: Element) => e.getBoundingClientRect();
          const near = (a: number, b: number) => Math.abs(a - b) <= 1;
          const all = (sel: string) =>
            Array.from(document.querySelectorAll(`#arena-overlay ${sel}`));
          const cards = all(".rv-card").map(R);
          // Every card the same size, on one row.
          for (const c of cards)
            if (
              !near(c.width, cards[0].width) ||
              !near(c.height, cards[0].height) ||
              !near(c.top, cards[0].top)
            )
              out.push(
                `cards differ: ${cards.map((x) => `${x.width.toFixed(0)}×${x.height.toFixed(0)}@${x.top.toFixed(0)}`).join(" ")}`,
              );
          // Each line level across the cards, centred in its card, whole.
          for (const sel of [".rv-art", ".rv-name", ".rv-role", ".rv-player"]) {
            const els = all(sel);
            const tops = els.map((e) => R(e).top);
            if (tops.some((t) => !near(t, tops[0])))
              out.push(`${sel} not level: ${tops.map((t) => t.toFixed(0))}`);
            for (const e of els) {
              const r = R(e);
              const c = R(e.closest(".rv-card")!);
              if (
                getComputedStyle(e).display !== "none" &&
                !near(r.left - c.left, c.right - r.right)
              )
                out.push(`${sel} off centre in its card`);
              if (getComputedStyle(e).textAlign === "left")
                out.push(`${sel} not centred`);
            }
          }
          // The fighter names fit: none cut.
          for (const e of all(".rv-name") as HTMLElement[])
            if (e.scrollWidth > e.clientWidth + 1)
              out.push(`name cut: ${e.textContent}`);
          // Element and role: never cut mid-way (two lines are kept).
          for (const e of all(".rv-role") as HTMLElement[])
            if (
              getComputedStyle(e).display !== "none" &&
              e.scrollHeight > e.clientHeight + 1
            )
              out.push(`role cut: ${e.textContent}`);
          // The row fits the card: no sideways scrolling, all in sight.
          const card = document.querySelector("#arena-overlay .match-reveal")!;
          const box = R(card);
          for (const c of cards)
            if (c.left < box.left - 0.5 || c.right > box.right + 0.5)
              out.push("a card is outside the panel");
          const scroll = card.querySelector(".panel-scroll") as HTMLElement;
          if (scroll.scrollWidth > scroll.clientWidth + 1)
            out.push("the panel scrolls sideways");
          // The cards and "I'm ready" in view without scrolling.
          const view = R(scroll);
          for (const c of cards)
            if (c.bottom > view.bottom + 0.5 || c.top < view.top - 0.5)
              out.push("a card is scrolled out of view");
          const ready = R(document.getElementById("instructions-ready")!);
          if (ready.bottom > innerHeight || ready.top < 0)
            out.push("I'm ready is off screen");
          if (ready.height < 44)
            out.push(`I'm ready is ${ready.height}px tall`);
          // Its own background (the sides' blue and red, or FFA's violet),
          // not a battle theme's panel tint.
          if (
            !getComputedStyle(card).backgroundImage.includes("radial-gradient")
          )
            out.push("the Reveal lost its background");
          // The whole screen, like a loading screen.
          if (
            Math.abs(box.left) > 0.5 ||
            Math.abs(box.top) > 0.5 ||
            Math.abs(box.width - innerWidth) > 0.5 ||
            Math.abs(box.height - innerHeight) > 0.5
          )
            out.push(
              `not the whole screen: ${box.left},${box.top} ${box.width}×${box.height}`,
            );
          return out;
        });
        expect(problems).toEqual([]);
        await snap(page, info, `reveal-${m.name}-${size.name}`);
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

// The Reveal and the countdown on the owner's iPhone (956×440 sideways,
// the Dynamic Island's insets): both reach every edge of the screen, past
// the notch. The Reveal is marked on the overlay itself in the same step as
// its markup (no :has rule that Safari could apply a frame late, showing
// the arena first); the countdown is one big number under a light shade,
// no card, with the arena and the fighters still in view.
test("the Reveal and the countdown fill the whole screen on an iPhone held sideways", async ({
  browser,
}, info) => {
  test.setTimeout(90_000);
  const context = await browser.newContext({
    viewport: { width: 956, height: 440 },
    isMobile: true,
    hasTouch: true,
  });
  try {
    const page = await context.newPage();
    const errors = await openLobby(page);
    await page.evaluate(() =>
      (window as any).__room("pvp", { mode: "duel", phase: "briefing" }),
    );
    await openPlayPanel(page);
    await createRoom(page);
    const overlay = page.locator("#arena-overlay");
    await expect
      .poll(async () => {
        await page.evaluate(() => (window as any).__push());
        return overlay.locator(".match-reveal").count();
      })
      .toBe(1);
    await setInsets(page, ISLAND);
    const whole = () =>
      overlay.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return [r.left, r.top, r.width, r.height].map(Math.round);
      });
    await expect(overlay).toHaveClass(/\bis-reveal\b/);
    expect(await whole()).toEqual([0, 0, 956, 440]);

    // Everyone is ready: 3, 2, 1.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.phase = "countdown";
      w.__snap.remaining = 2;
      w.__push();
    });
    const card = overlay.locator(".countdown-card");
    await expect(card.locator("h2")).toHaveText("2");
    await expect(overlay).toHaveClass(/\bis-countdown\b/);
    await expect(overlay).not.toHaveClass(/\bis-reveal\b/);
    expect(await whole()).toEqual([0, 0, 956, 440]);
    const look = await page.evaluate(() => {
      const ov = document.getElementById("arena-overlay")!;
      const c = ov.querySelector<HTMLElement>(".countdown-card")!;
      const s = getComputedStyle(c);
      const h2 = c.querySelector("h2")!;
      const shade = getComputedStyle(ov).backgroundImage;
      return {
        card: [s.backgroundColor, s.backgroundImage, s.borderTopWidth],
        number: parseFloat(getComputedStyle(h2).fontSize),
        // The shade is see-through: its darkest stop lets the arena show.
        alphas: [...shade.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((m) =>
          Number(m[1]),
        ),
      };
    });
    expect(look.card).toEqual(["rgba(0, 0, 0, 0)", "none", "0px"]);
    expect(look.number).toBeGreaterThanOrEqual(110);
    expect(look.alphas.length).toBeGreaterThan(0);
    expect(Math.max(...look.alphas)).toBeLessThanOrEqual(0.65);
    await snap(page, info, "countdown-956x440-island");

    // The fight: nothing over the arena.
    await page.evaluate(() => {
      const w = window as any;
      w.__snap.phase = "playing";
      w.__push();
    });
    await expect(overlay).toBeEmpty();
    await expect(overlay).toBeHidden();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

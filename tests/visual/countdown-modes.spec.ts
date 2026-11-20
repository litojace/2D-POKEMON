import { expect, test } from "@playwright/test";
import {
  createRoom,
  openLobby,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";
import { ISLAND, setInsets, type Insets } from "./ui-measure";

// The countdown before a fight (3, 2, 1) looks the same in every mode
// (owner, 20 Nov 2026): PvP (duel, 2v2, free-for-all), a bot match, the
// raids (Storm Twins too) and the Spire's wave and boss floors. The whole
// screen, edge to edge past the notch, under a light see-through shade,
// one big number, no card; the arena and the fighters stay in view.
// (Raids and the Spire used to show a small card over the middle of the
// court, the shade stopping at the safe area.) Watchers see the same
// countdown as the players (they had the card). Practice has no countdown.
const SIZES: {
  name: string;
  width: number;
  height: number;
  phone: boolean;
  inset?: Insets;
}[] = [
  { name: "844x390", width: 844, height: 390, phone: true },
  { name: "667x375", width: 667, height: 375, phone: true },
  { name: "1440x900", width: 1440, height: 900, phone: false },
  {
    name: "956x440-island",
    width: 956,
    height: 440,
    phone: true,
    inset: ISLAND,
  },
];
type Mode = {
  name: string;
  kind: "pvp" | "raid" | "spire";
  options: Record<string, unknown>;
  bot?: boolean;
  /** Watching the room (Watch this room instead), not playing in it. */
  watch?: boolean;
  /** The line over the number: which fight this is. */
  eyebrow: RegExp;
};
const MODES: Mode[] = [
  {
    name: "duel",
    kind: "pvp",
    options: { mode: "duel", phase: "playing" },
    eyebrow: /Element Arena/,
  },
  {
    name: "teams",
    kind: "pvp",
    options: { mode: "teams", phase: "playing" },
    eyebrow: /Element Arena/,
  },
  {
    name: "ffa",
    kind: "pvp",
    options: { mode: "ffa", phase: "playing" },
    eyebrow: /Element Arena/,
  },
  {
    name: "bot",
    kind: "pvp",
    options: { mode: "duel", phase: "playing" },
    bot: true,
    eyebrow: /Element Arena/,
  },
  {
    name: "raid",
    kind: "raid",
    options: { boss: "grumblecrag" },
    eyebrow: /Boss raid/,
  },
  {
    name: "storm-twins",
    kind: "raid",
    options: { boss: "storm-twins" },
    eyebrow: /Boss raid/,
  },
  {
    name: "spire-wave",
    kind: "spire",
    options: { floor: 2, stage: "playing" },
    eyebrow: /The Spire · Floor 2/,
  },
  {
    name: "spire-boss",
    kind: "spire",
    options: { floor: 10, stage: "playing" },
    eyebrow: /The Spire · Floor 10/,
  },
  {
    name: "watch-duel",
    kind: "pvp",
    options: { mode: "duel", phase: "playing" },
    watch: true,
    eyebrow: /Watching · WATCH1/,
  },
  {
    name: "watch-raid",
    kind: "raid",
    options: { boss: "grumblecrag" },
    watch: true,
    eyebrow: /Watching · WATCH1/,
  },
  {
    name: "watch-spire",
    kind: "spire",
    options: { floor: 2, stage: "playing" },
    watch: true,
    eyebrow: /Watching · WATCH1/,
  },
];

for (const size of SIZES)
  for (const m of MODES)
    test(`the countdown fills the screen: ${m.name} at ${size.name}`, async ({
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
        await page.evaluate(
          ({ kind, options, bot, watch }) => {
            const w = window as any;
            w.__room(kind, options);
            if (bot) w.__snap.vsBot = "normal";
            if (watch) w.__snap.code = "WATCH1";
            // The raid itself, not the Spire's Ascendant form.
            if (kind === "raid") {
              delete w.__snap.raid.spire;
              delete w.__snap.raid.variant;
            }
          },
          { kind: m.kind, options: m.options, bot: !!m.bot, watch: !!m.watch },
        );
        await openPlayPanel(page);
        if (m.watch) {
          await page.fill("#code", "WATCH1");
          await page.click("#watch");
        } else await createRoom(page);
        await pushUntilBattle(page);
        if (size.inset) await setInsets(page, size.inset);

        // 3, 2, 1.
        await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "countdown";
          w.__snap.remaining = 2;
          w.__push();
        });
        const overlay = page.locator("#arena-overlay");
        const card = overlay.locator(".countdown-card");
        await expect(card).toHaveCount(1);
        await expect(card.locator("h2")).toHaveText("2");
        await expect(card.locator(".eyebrow")).toHaveText(m.eyebrow);
        await expect(overlay).toHaveClass(/\bis-countdown\b/);
        await expect(overlay).not.toHaveClass(/\bis-reveal\b/);
        // One shared countdown: the raids' old card is gone.
        await expect(overlay.locator(".raid-overlay")).toHaveCount(0);
        await page.waitForTimeout(150);

        const look = await page.evaluate(() => {
          const ov = document.getElementById("arena-overlay")!;
          const c = ov.querySelector<HTMLElement>(".countdown-card")!;
          const h2 = c.querySelector("h2")!;
          const s = getComputedStyle(c);
          const r = ov.getBoundingClientRect();
          const n = h2.getBoundingClientRect();
          const shade = getComputedStyle(ov).backgroundImage;
          return {
            box: [r.left, r.top, r.width, r.height].map(Math.round),
            card: [s.backgroundColor, s.backgroundImage, s.borderTopWidth],
            number: parseFloat(getComputedStyle(h2).fontSize),
            centre: [(n.left + n.right) / 2, (n.top + n.bottom) / 2],
            onTop:
              document
                .elementFromPoint(innerWidth / 2, innerHeight / 2)
                ?.closest("#arena-overlay") === ov,
            alphas: [...shade.matchAll(/rgba\([^)]*,\s*([\d.]+)\)/g)].map((x) =>
              Number(x[1]),
            ),
          };
        });
        // Edge to edge, past the notch and the home indicator.
        expect(look.box).toEqual([0, 0, size.width, size.height]);
        // No card: one big number.
        expect(look.card).toEqual(["rgba(0, 0, 0, 0)", "none", "0px"]);
        expect(look.number).toBeGreaterThanOrEqual(110);
        // In the middle of the screen, over everything else.
        expect(Math.abs(look.centre[0] - size.width / 2)).toBeLessThan(4);
        expect(look.onTop).toBe(true);
        // A light shade: the arena and the fighters show through.
        expect(look.alphas.length).toBeGreaterThan(0);
        expect(Math.max(...look.alphas)).toBeLessThanOrEqual(0.65);
        await snap(page, info, `countdown-${m.name}-${size.name}`);

        // The fight: nothing over the arena.
        await page.evaluate(() => {
          const w = window as any;
          w.__snap.phase = "playing";
          w.__push();
        });
        await expect(overlay).not.toHaveClass(/\bis-countdown\b/);
        await expect(overlay).toBeEmpty();
        expect(errors).toEqual([]);
      } finally {
        await context.close();
      }
    });

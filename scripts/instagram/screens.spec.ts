/**
 * Instagram's feature pictures (docs/instagram.md): the game's screens
 * outside battle (the Plaza, Friends, missions and ranks), each the whole
 * phone screen as a player sees it (owner, 28 Nov), in Poster, on the
 * owner's own iPhone size held sideways (956 × 440 at 3×, with its Dynamic
 * Island's safe areas). The player is "Blaze" with Pyranda, as in the App
 * Store scenes (scripts/app-store/scenes.ts); everyone else is the visual
 * harness's made-up players, so no real account shows. Each screen writes
 * a few frames a moment apart to instagram-clips/screens/<name>/NN.png:
 * pick one by eye.
 *
 *   npx playwright test --config scripts/instagram/playwright.config.ts screens
 *   SCREEN=plaza ... screens   # one screen
 */
import { expect, test, type Page } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { playersLook } from "../../tests/visual/players-look";
import { openLobby, openPlaza } from "../../tests/visual/helpers";
import { INSET, middayZone, phone, player } from "../app-store/scenes";

const OUT = "instagram-clips/screens";
// An iPhone Pro Max held sideways (as battles.spec.ts).
Object.assign(INSET, { left: 62, right: 62, bottom: 21, top: 0 });

/**
 * No amounts of the game's money go outside the game (docs/instagram.md):
 * every coin count is blurred where it stands, its chip kept. And no toast
 * caught mid-way.
 */
const QUIET = `
  .coin-chip > b { filter: blur(10px) !important; }
  #toast { display: none !important; }
`;

/**
 * Made-up players around the fountain (the Plaza takes up to 40): the same
 * names as the battles' bots, never a real account. Places are the Plaza's
 * own world coordinates (packages/shared plaza.ts: the fountain at
 * 1350, 892, its lamps, benches and bounce pads), not offsets from where
 * the player happens to spawn, so the scenery around them is the same each
 * run: clear of the lamp posts (which draw over whoever stands behind
 * them), the benches, the Plaza Map sign and the HUD's corners. Moss stands
 * on a bounce pad, so it bounces.
 */
const ME = { x: 1350, y: 1110 };
const CROWD: [
  name: string,
  character: string,
  level: number,
  x: number,
  y: number,
  title: string | null,
  titleColor: string | null,
][] = [
  // Titles over the names, every tier (#650; the game's own titles and
  // colours, as tests/visual/plaza-title-crowd.ts), and one with none.
  ["Rin", "tidefin", 7, 1160, 990, "Master Angler", "#5fb3ff"],
  ["Sunny", "halcyra", 31, 1275, 1045, "Mountain Conqueror", "#ffcf66"],
  ["Kai", "voltkit", 12, 1450, 1045, "Tempest", "#50dbe9"],
  ["Moss", "cindrake", 18, 1555, 1035, "Echo Breaker", "#b79cff"],
  ["Zap", "lumoth", 9, 1560, 1130, "First Victory", "#9ee6a8"],
  ["Hoot", "glacelle", 24, 1350, 1230, "Legend", "#ffe08a"],
  ["Ink", "shadopus", 15, 1480, 1240, null, null],
];
async function crowd(page: Page) {
  await page.evaluate(
    ({ crowd, me }) => {
      const w = window as any;
      w.__plazaPosition(me.x, me.y);
      crowd.forEach(([name, character, level, x, y, title, titleColor], i) => {
        const id = `crowd-${i}`;
        w.__plazaWorld.join(id, `acct-${id}`, {
          name,
          title,
          titleColor,
          level,
          character,
          skin: null,
        });
        Object.assign(w.__plazaWorld.bodyOf(id), { x, y });
      });
    },
    { crowd: CROWD, me: ME },
  );
  // Drawn: every one of them among the Plaza's others (with its own
  // characters, like the Sprinter).
  await expect
    .poll(
      () =>
        page.evaluate(
          (names) =>
            names.every((n) =>
              [...(window as any).__plaza.others.values()].some(
                (b: any) => b.name === n,
              ),
            ),
          CROWD.map((c) => c[0]),
        ),
      { timeout: 15_000 },
    )
    .toBe(true);
}

/** Made-up friends (the battles' names), each doing something different. */
const ago = (h: number) => new Date(Date.now() - h * 3600e3).toISOString();
const friend = (n: number) =>
  `55555555-5555-4555-8555-${String(n).padStart(12, "0")}`;
const FRIENDS = {
  code: "k7m2p9qa",
  friends: [
    {
      id: friend(1),
      name: "Rin",
      online: true,
      activity: "match",
      room: "RIN042",
      fighter: "tidefin",
    },
    {
      id: friend(2),
      name: "Moss",
      online: true,
      activity: "lobby",
      room: "MOSS77",
      joinable: true,
      fighter: "cindrake",
    },
    {
      id: friend(3),
      name: "Sunny",
      online: true,
      activity: "town",
      fighter: "halcyra",
    },
    {
      id: friend(4),
      name: "Kai",
      online: true,
      activity: "menu",
      fighter: "voltkit",
    },
    {
      id: friend(5),
      name: "Hoot",
      online: false,
      lastOnline: ago(3),
      fighter: "glacelle",
    },
    {
      id: friend(6),
      name: "Zap",
      online: false,
      lastOnline: ago(26),
      fighter: "lumoth",
    },
  ],
  incoming: [{ id: friend(9), name: "Ink" }],
  outgoing: [],
};

type Screen = {
  name: string;
  /** Frames to take, and the wait between them (the screen keeps moving). */
  frames: number;
  gap: number;
  /** The page's clock starts here (ms), then runs as usual. */
  at?: () => number;
  /** Before the page loads: the harness's made-up data for this screen. */
  init?: (page: Page) => Promise<void>;
  open: (page: Page) => Promise<void>;
};

const SCREENS: Screen[] = [
  {
    name: "plaza",
    frames: 16,
    gap: 1500,
    // During an Orb Shower (every 15 minutes on the UTC clock, for one
    // minute: packages/shared plaza.ts), well into it: the Plaza opens
    // about 15 s after the clock starts, so the frames fall 35–58 s in,
    // after its big title has gone. How many orbs are down at a moment
    // varies (the crowd catches some): pick the frame by eye.
    at: () => Math.ceil(Date.now() / 900_000) * 900_000 + 20_000,
    async open(page) {
      await openPlaza(page);
      await phone(page);
      await crowd(page);
      await page.waitForTimeout(2500);
    },
  },
  {
    name: "friends",
    frames: 1,
    gap: 0,
    async init(page) {
      await page.addInitScript(
        ({ friends, now }) => {
          const w = window as any;
          w.__friends = friends;
          w.__recent = { players: [] };
          w.__serverTime = now;
        },
        { friends: FRIENDS, now: Date.now() },
      );
    },
    async open(page) {
      await openLobby(page);
      await phone(page);
      await page.click('.lobby-rail [data-lobby-action="friends"]');
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "missions",
    frames: 1,
    gap: 0,
    async open(page) {
      await openLobby(page);
      await phone(page);
      await page.click('.lobby-rail [data-lobby-action="missions"]');
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "journey",
    frames: 1,
    gap: 0,
    async open(page) {
      await openLobby(page);
      await phone(page);
      await page.click("#lobby-journey-card");
      await page.waitForTimeout(1500);
    },
  },
  {
    name: "ranks",
    frames: 1,
    gap: 0,
    async open(page) {
      await openLobby(page);
      await phone(page);
      await page.click('.lobby-rail [data-lobby-action="ranks"]');
      await page.waitForTimeout(1500);
    },
  },
];

for (const s of SCREENS.filter(
  (s) => !process.env.SCREEN || process.env.SCREEN.split(",").includes(s.name),
))
  test(`screens ${s.name}`, async ({ browser }) => {
    test.setTimeout(300_000);
    const context = await browser.newContext({
      viewport: { width: 956, height: 440 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      timezoneId: middayZone(),
    });
    try {
      if (s.at) await context.clock.install({ time: s.at() });
      await playersLook(context);
      const page = await context.newPage();
      await player(page);
      await s.init?.(page);
      await s.open(page);
      await page.addStyleTag({ content: QUIET });
      expect(
        await page.evaluate(() => document.documentElement.dataset.ui),
      ).toBe("poster");
      const dir = `${OUT}/${s.name}`;
      mkdirSync(dir, { recursive: true });
      for (let f = 0; f < s.frames; f++) {
        if (f) await page.waitForTimeout(s.gap);
        writeFileSync(
          `${dir}/${String(f).padStart(2, "0")}.png`,
          await page.screenshot(),
        );
      }
    } finally {
      await context.close();
    }
  });

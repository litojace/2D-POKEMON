/**
 * The staged scenes for the App Store screenshots and the README's
 * pictures (scripts/readme/readme-shots.spec.ts). App Store screenshots: the real client, staged into each scene in the
 * visual harness (tests/visual) and captured at the iPhone sizes App Store
 * Connect asks for (docs/app-store-screenshots.md). Battles are the real
 * server simulation, stepped tick by tick, so a run draws the same frames.
 *
 *   npx playwright test --config scripts/app-store/playwright.config.ts
 *
 * Raw captures go to app-store-screenshots/raw/<device>/, and the framed
 * ones, with their captions, to app-store-screenshots/<device>/: those are
 * the files to upload.
 */
import { expect, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openLobby,
  openPlaza,
  openPlayPanel,
  pushUntilBattle,
} from "../../tests/visual/helpers";

/** The raid shot's boss, the attack it is winding up, and how far in. */
const RAID = {
  boss: process.env.RAID_BOSS ?? "emberwing",
  attack: process.env.RAID_ATTACK ?? "flame-ring",
  ticks: Number(process.env.RAID_TICKS ?? 18),
};

/**
 * The display sizes, landscape (the game is landscape only). App Store
 * Connect requires "iPhone with Dynamic Island (medium display)", and the
 * large display keeps Pro Max screenshots sharp rather than scaled up.
 * Both are 3x screens; insets keep the game clear of the Dynamic Island
 * and the home bar, as on the phone.
 */
export const DEVICES = [
  // iPhone 16 / 17 Pro: 874 x 402 points, 2622 x 1206 pixels.
  { name: "iphone-medium", viewport: { width: 874, height: 402 } },
  // iPhone 16 / 17 Pro Max: 956 x 440 points, 2868 x 1320 pixels.
  { name: "iphone-large", viewport: { width: 956, height: 440 } },
] as const;
/** The safe-area insets `phone()` applies (the README's shots set smaller ones). */
export const INSET = { left: 62, right: 62, bottom: 20, top: 0 };
/** A time zone where it is now about midday (the Plaza lights by the clock). */
export function middayZone() {
  let offset = (12 - new Date().getUTCHours() + 24) % 24;
  if (offset > 12) offset -= 24;
  // Etc/GMT signs are inverted: Etc/GMT-9 is UTC+9.
  return offset >= 0 ? `Etc/GMT-${offset}` : `Etc/GMT+${-offset}`;
}

/**
 * The player in every shot: "Blaze", with Pyranda as their fighter (the
 * harness's account is "tester" with Voltkit). Before the page loads.
 */
export async function player(page: Page) {
  await page.addInitScript(() => {
    const w = window as any;
    w.__accountPatch = { displayName: "Blaze" };
    w.__savedFighter = "pyranda";
  });
}

export async function phone(page: Page) {
  await page.evaluate((inset) => {
    for (const [key, value] of Object.entries(inset))
      document.documentElement.style.setProperty(`--safe-${key}`, `${value}px`);
  }, INSET);
}

/**
 * A live match the page runs itself: `setup` builds the arena (in the page,
 * from /rooms.ts) and returns its fighters; then `play` steps it a tick at a
 * time with the inputs `plan` gives each fighter, drawing every other tick.
 */
async function startMatch(
  page: Page,
  room: [kind: "pvp" | "raid", options: Record<string, unknown>],
) {
  await page.evaluate((args) => (window as any).__room(...args), room);
  await openPlayPanel(page);
  // Create room lives in the Lobby's mode menu now; its drawer button stays
  // hidden and is pressed directly, as the visual tests do (helpers.ts).
  await createRoom(page);
  await pushUntilBattle(page);
}
async function play(page: Page, ticks: number) {
  await page.evaluate(async (ticks) => {
    const w = window as any;
    const { a, m, inputs } = w.__shot;
    for (let t = 0; t < ticks; t++) {
      w.__shot.tick++;
      for (const [i, p] of a.players.entries()) {
        const input = inputs(p, i, w.__shot.tick);
        if (input) a.submit(p, { ...m.blankInput(), seq: p.ack + 1, ...input });
      }
      w.__shot.keep?.();
      a.tick();
      if (t % 2) continue;
      w.__snap = m.packSnapshot(a.snapshot());
      w.__push();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    }
  }, ticks);
}

/** A screenshot: its file name, the caption it is framed with, and how to stage it. */
export type Scene = {
  name: string;
  caption: string;
  capture: (page: Page) => Promise<void>;
};

export const SCENES: Scene[] = [
  {
    // A four-player raid on Emberwing in the air, its warnings on the floor.
    name: "raid",
    caption: "Battle giant raid bosses together",
    async capture(page) {
      await openHub(page);
      await phone(page);
      await startMatch(page, ["raid", { boss: RAID.boss }]);
      await page.evaluate(async (boss) => {
        const w = window as any;
        const m = await import("/rooms.ts");
        const a: any = m.createRaidArena("RAID42", boss);
        a.serial = (w.__arena?.serial ?? 0) + 5000;
        a.add("me", "Blaze", "pyranda");
        a.add("p2", "Frost", "glacelle");
        a.add("p3", "Moss", "pangrove");
        a.add("p4", "Hoot", "mystowl");
        a.configure(1);
        a.start();
        a.phase = "playing";
        a.raid.gilded = false;
        a.nextAttack = 1e6;
        if (boss === "emberwing") a.takeoff();
        // Some way into the fight, still in its first phase.
        a.boss().hp *= 0.72;
        const heroes = a.heroes();
        const spots = [
          [620, 560],
          [980, 560],
          [560, 330],
          [1040, 330],
        ];
        for (const [i, h] of heroes.entries()) [h.x, h.y] = spots[i];
        const full = heroes.map((h: any) => h.hp);
        w.__arena = a;
        w.__shot = {
          a,
          m,
          tick: 0,
          keep() {
            for (const [i, h] of heroes.entries())
              h.hp = Math.max(h.hp, full[i] * (0.55 + 0.1 * i));
          },
          inputs(p: any, i: number, tick: number) {
            const boss = a.boss();
            if (p === boss) return null;
            return {
              aimX: boss.x,
              aimY: boss.y,
              basic: true,
              skill: tick === 3 + i * 3 ? 0 : -1,
            };
          },
        };
      }, RAID.boss);
      await play(page, 90);
      await page.evaluate((attack) => {
        const w = window as any;
        w.__shot.tick = 0;
        w.__shot.a.startAttack(attack, w.__shot.a.heroes()[0]);
      }, RAID.attack);
      await play(page, RAID.ticks);
    },
  },
  {
    // Fire against ice, as on the app icon: Pyranda and Glacelle in Tide Pools.
    name: "duel",
    caption: "Real-time creature duels",
    async capture(page) {
      await openHub(page);
      await phone(page);
      await startMatch(page, ["pvp", { mode: "duel", phase: "playing" }]);
      await page.evaluate(async () => {
        const w = window as any;
        const m = await import("/rooms.ts");
        const a = new m.Arena("PVP123", "duel");
        // Carry on the event numbering, or the client skips the casts.
        a.serial = (w.__arena?.serial ?? 0) + 5000;
        a.arenaId = "tide-pools";
        a.add("me", "Blaze", "pyranda");
        a.add("p2", "Frost", "glacelle");
        a.start();
        a.phase = "playing";
        const [me, foe] = a.players;
        me.x = 640;
        me.y = 480;
        foe.x = 880;
        foe.y = 440;
        const full = [me.hp, foe.hp];
        w.__arena = a;
        w.__shot = {
          a,
          m,
          tick: 0,
          keep() {
            a.deadline = a.time + 84; // the round clock reads 1:24
            me.hp = Math.max(me.hp, full[0] * 0.62);
            foe.hp = Math.max(foe.hp, full[1] * 0.38);
            me.ult = Math.max(me.ult, 72);
          },
          inputs(p: any, i: number, tick: number) {
            const other = a.players[1 - i];
            const skill =
              i === 0
                ? tick === 1
                  ? 1
                  : -1
                : tick === 5
                  ? 0
                  : tick === 8
                    ? 1
                    : -1;
            return { aimX: other.x, aimY: other.y, skill };
          },
        };
      });
      await play(page, 90); // the fighters' art settles
      await page.evaluate(() => ((window as any).__shot.tick = 0));
      await play(page, 9);
    },
  },
  {
    // The roster: every creature, by element.
    name: "roster",
    caption: "18 creatures, 9 elements",
    async capture(page) {
      await openLobby(page);
      await phone(page);
      await page.click('.lobby-rail [data-lobby-action="fighters"]');
      await expect(page.locator("[data-roster-card]").first()).toBeVisible();
      await page.click('[data-roster-card="glacelle"]');
      // Picking scrolls the grid; show it from its first row.
      await page.evaluate(() => {
        let el = document.querySelector("[data-roster-card]")?.parentElement;
        while (el && el.scrollHeight <= el.clientHeight) el = el.parentElement;
        if (el) el.scrollTop = 0;
      });
      await page.waitForTimeout(1500);
    },
  },
  {
    // 2v2: four fighters, two teams.
    name: "teams",
    caption: "2v2 team battles",
    async capture(page) {
      await openHub(page);
      await phone(page);
      await startMatch(page, ["pvp", { mode: "teams", phase: "playing" }]);
      await page.evaluate(async () => {
        const w = window as any;
        const m = await import("/rooms.ts");
        const a = new m.Arena("PVP123", "teams");
        a.serial = (w.__arena?.serial ?? 0) + 5000;
        a.arenaId = "shifting-ruins";
        a.add("me", "Blaze", "pyranda");
        a.add("p2", "Moss", "pangrove");
        a.add("p3", "Frost", "glacelle");
        a.add("p4", "Hoot", "mystowl");
        a.start();
        a.phase = "playing";
        const ps = a.players;
        const spots = [
          [640, 560],
          [680, 440],
          [860, 550],
          [900, 430],
        ];
        for (const [i, p] of ps.entries()) [p.x, p.y] = spots[i];
        const full = ps.map((p: any) => p.hp);
        w.__arena = a;
        w.__shot = {
          a,
          m,
          tick: 0,
          keep() {
            a.deadline = a.time + 71;
            const share = [0.7, 0.5, 0.45, 0.8];
            for (const [i, p] of ps.entries())
              p.hp = Math.max(p.hp, full[i] * share[i]);
          },
          inputs(p: any, i: number, tick: number) {
            const foe = ps.find((o: any) => o.team !== p.team)!;
            // Blaze's ultimate (skill slot 3, on a full meter); the others cast.
            if (i === 0 && tick === 1) p.ult = 100;
            const skill =
              i === 0 ? (tick === 1 ? 3 : -1) : tick === 1 + i ? i % 2 : -1;
            return { aimX: foe.x, aimY: foe.y, skill };
          },
        };
      });
      await play(page, 90);
      await page.evaluate(() => ((window as any).__shot.tick = 0));
      await play(page, 12);
    },
  },
  {
    // Free-for-all: four fighters, everyone against everyone.
    name: "ffa",
    caption: "Four-way free-for-all",
    async capture(page) {
      await openHub(page);
      await phone(page);
      await startMatch(page, ["pvp", { mode: "ffa", phase: "playing" }]);
      await page.evaluate(async () => {
        const w = window as any;
        const m = await import("/rooms.ts");
        const a = new m.Arena("PVP123", "ffa");
        a.serial = (w.__arena?.serial ?? 0) + 5000;
        a.arenaId = "ember-forge";
        a.add("me", "Blaze", "pyranda");
        a.add("p2", "Zap", "coilemur");
        a.add("p3", "Ink", "shadopus");
        a.add("p4", "Sunny", "sunbara");
        a.start();
        a.phase = "playing";
        const ps = a.players;
        const spots = [
          [620, 540],
          [880, 560],
          [660, 400],
          [900, 420],
        ];
        for (const [i, p] of ps.entries()) [p.x, p.y] = spots[i];
        const full = ps.map((p: any) => p.hp);
        w.__arena = a;
        w.__shot = {
          a,
          m,
          tick: 0,
          keep() {
            a.deadline = a.time + 58;
            const share = [0.75, 0.4, 0.55, 0.65];
            for (const [i, p] of ps.entries())
              p.hp = Math.max(p.hp, full[i] * share[i]);
          },
          inputs(p: any, i: number, tick: number) {
            // Each fighter aims at the next one round the ring.
            const foe = ps[(i + 1) % ps.length];
            const skill = tick === 1 + 2 * i ? (i % 2) + 1 : -1;
            return { aimX: foe.x, aimY: foe.y, skill };
          },
        };
      });
      await play(page, 90);
      await page.evaluate(() => ((window as any).__shot.tick = 0));
      await play(page, 12);
    },
  },
  {
    // The Plaza at midday.
    name: "plaza",
    caption: "Hang out in the Plaza",
    async capture(page) {
      await openPlaza(page);
      await phone(page);
      await page.waitForTimeout(2500);
    },
  },
];

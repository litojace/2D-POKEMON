/**
 * Skill clips for the website's champion panel (docs/website.md): each
 * champion casts each move (basic, skills 1-3, ultimate) at a training
 * target in the real client. The match is the real server simulation,
 * stepped tick by tick with scripted inputs (as scripts/app-store does), so
 * a run draws the same frames. Frames land in site-clips/<champion>/<move>/;
 * apps/site/tools/make-clips.py turns them into small animated WebPs.
 *
 *   npx playwright test --config scripts/site-clips/playwright.config.ts
 *   CHAMPIONS=voltkit,pyranda ... (a subset)
 */
import { test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { CHARACTERS, FIGHTER_IDS } from "../../packages/shared/src/index";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
} from "../../tests/visual/helpers";

export const OUT = "site-clips";
/** Frames per clip, one every other tick (the client draws every other tick). */
const FRAMES = { move: 22, ult: 40 };
const MOVES = ["basic", "skill1", "skill2", "skill3", "ult"] as const;

/** The court only: no HUD, buttons or labels over the fighters. */
const CLEAN = `
  #hud, #mobile-controls, #abilities, .battle-footer, #arena-overlay,
  .map-label, .topbar, #practice-controls, #spectate, #toast,
  .stadium-crowd { display: none !important; }
`;

async function battle(page: Page) {
  await openHub(page);
  await page.evaluate(
    (args) => (window as any).__room(...args),
    ["pvp", { mode: "duel", phase: "playing" }],
  );
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  await page.addStyleTag({ content: CLEAN });
}

/** A fresh duel: the champion on the left, a sturdy target on the right. */
async function stage(page: Page, id: string, move: string) {
  await page.evaluate(
    async ({ id, move, melee, name }) => {
      const w = window as any;
      const m = await import("/rooms.ts");
      const a = new m.Arena("CLIP01", "duel");
      a.serial = (w.__arena?.serial ?? 0) + 5000;
      a.arenaId = "classic";
      a.add("me", name, id);
      a.add(
        "p2",
        "Training target",
        id === "terradon" ? "wombolder" : "terradon",
      );
      a.start();
      a.phase = "playing";
      const [me, foe] = a.players;
      // The open strip below the court's pillars.
      me.x = 600;
      me.y = 790;
      foe.x = melee ? 740 : 940;
      foe.y = 790;
      const full = [me.hp, foe.hp];
      const slot =
        move === "basic" ? -1 : move === "ult" ? 3 : Number(move.at(-1)) - 1;
      w.__arena = a;
      w.__shot = {
        a,
        m,
        tick: 0,
        keep() {
          a.deadline = a.time + 90;
          me.hp = full[0];
          foe.hp = Math.max(foe.hp, full[1] * 0.5);
          foe.x = melee ? 740 : 940;
          foe.y = 790;
          if (slot === 3) me.ult = Math.max(me.ult ?? 0, 100);
        },
        inputs(p: any, i: number, tick: number) {
          if (i !== 0) return null; // the target stands still
          const aim = { aimX: foe.x, aimY: foe.y };
          if (slot < 0) return { ...aim, basic: tick < 30 };
          return { ...aim, skill: tick === 2 ? slot : -1 };
        },
      };
    },
    {
      id,
      move,
      melee: CHARACTERS[id as keyof typeof CHARACTERS].basic.range < 300,
      name: CHARACTERS[id as keyof typeof CHARACTERS].name,
    },
  );
}

async function frames(page: Page, n: number, dir: string) {
  mkdirSync(dir, { recursive: true });
  const court = page.locator("#game canvas").first();
  for (let f = 0; f < n; f++) {
    await page.evaluate(async () => {
      const w = window as any;
      const { a, m, inputs } = w.__shot;
      for (let t = 0; t < 2; t++) {
        w.__shot.tick++;
        for (const [i, p] of a.players.entries()) {
          const input = inputs(p, i, w.__shot.tick);
          if (input)
            a.submit(p, { ...m.blankInput(), seq: p.ack + 1, ...input });
        }
        w.__shot.keep?.();
        a.tick();
      }
      w.__snap = m.packSnapshot(a.snapshot());
      w.__push();
      await new Promise((r) =>
        requestAnimationFrame(() => requestAnimationFrame(r)),
      );
    });
    writeFileSync(
      `${dir}/${String(f).padStart(3, "0")}.png`,
      await court.screenshot(),
    );
  }
}

const only = process.env.CHAMPIONS?.split(",");
const done = (dir: string, n: number) =>
  existsSync(dir) &&
  readdirSync(dir).filter((f) => f.endsWith(".png")).length >= n;
// One test per champion and move, so a slow machine never runs one out of
// time, and a rerun skips the clips already captured (delete site-clips/ to
// capture everything again).
for (const id of FIGHTER_IDS.filter((c) => !only || only.includes(c)))
  for (const move of MOVES)
    test(`clip ${id} ${move}`, async ({ browser }) => {
      const n = move === "ult" ? FRAMES.ult : FRAMES.move;
      const dir = `${OUT}/${id}/${move}`;
      test.skip(done(dir, n), "already captured");
      // A phone held sideways: the follow camera frames the fighters up close.
      const context = await browser.newContext({
        viewport: { width: 874, height: 402 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
      });
      try {
        const page = await context.newPage();
        await battle(page);
        await stage(page, id, move);
        // Let the art settle: a few quiet ticks before the cast.
        await page.evaluate(() => {
          (window as any).__shot.tick = -20;
        });
        await frames(page, 10, `${OUT}/.warmup-${id}-${move}`);
        await page.evaluate(() => ((window as any).__shot.tick = 0));
        await frames(page, n, dir);
      } finally {
        await context.close();
      }
    });

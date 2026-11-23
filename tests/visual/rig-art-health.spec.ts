import { expect, test, type Page } from "@playwright/test";
import {
  createRoom,
  openHub,
  openPlayPanel,
  pushUntilBattle,
  snap,
} from "./helpers";

// LomDom's own Astrabun vanished mid-raid on an iPhone Home Screen app
// (22 Nov 2026): nameplate, ring and shadow drawn, body not, after the page
// had been in the background and the battle had reconnected. It could not be
// reproduced; the likely cause is Safari letting the fighters' painted
// canvases go while hidden, so a texture uploaded again from one is blank.
// The battle now checks every rig's art after such moments (rig-health.ts)
// and loads blank art again. Here: no false alarm on healthy fighters, and a
// blanked fighter comes back and is reported ("battle-art"). The check is
// the same for every champion: the local one is whoever the harness seats.

/**
 * Fighters of every kind on the court with the local one (Voltkit). None is
 * the local fighter's champion: allies are copies of it, look included, so a
 * second Voltkit drew from the very textures the test blanks, and the check
 * (one rig a frame) sometimes found and reported that ally first (`mine`
 * false; #377's and #388's runs, 23 Nov 2026).
 */
const ALLIES = [
  "glacelle",
  "tidefin",
  "pyranda",
  "lumoth",
  "halcyra",
  "shadopus",
];

async function openRaid(page: Page) {
  // The game, for its arena scene.
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
      "window.__arenaGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
    );
    await route.fulfill({ response, body });
  });
  const errors = await openHub(page);
  await page.evaluate((allies) => {
    const w = window as any;
    w.__room("raid", { boss: "gloomshade" });
    const snap = w.__snap;
    snap.raid.warnings = [];
    snap.raid.decoys = [];
    const me = snap.players.find((p: any) => p.id === "me");
    if (allies.includes(me.character))
      throw new Error(
        `an ally shares the local fighter's art: ${me.character}`,
      );
    const boss = snap.players.find((p: any) => p.raidBoss);
    snap.players = [
      boss,
      me,
      ...allies.map((character: string, i: number) => ({
        ...structuredClone(me),
        id: `ally-${i}`,
        name: `Ally ${i}`,
        character,
        x: me.x + 90 * ((i % 3) - 1),
        y: me.y + 80 * (1 + Math.floor(i / 3)),
      })),
    ];
    snap.raid.partySize = snap.players.length - 1;
    w.__emitted = [];
    const before = w.__emit;
    w.__emit = (ev: string, data: unknown) => {
      w.__emitted.push([ev, data]);
      before?.(ev, data);
    };
  }, ALLIES);
  await openPlayPanel(page);
  await createRoom(page);
  await pushUntilBattle(page);
  return errors;
}

/** Every rig's art as the battle's check sees it. */
const ROOT = process.cwd();
const health = (page: Page) =>
  page.evaluate(async (root) => {
    const { rigArtHealth } = await import(
      `/@fs${root}/apps/client/src/rig-health.ts`
    );
    const scene = (window as any).__arenaGame.scene.getScene("arena");
    return Object.fromEntries(
      [...scene.rigs.entries()].map(([id, rig]: [string, any]) => [
        id,
        { character: rig.character, ...rigArtHealth(rig.root) },
      ]),
    );
  }, ROOT);

test("a fighter whose art went blank (Safari let its canvases go) is loaded again and reported; healthy fighters never are", async ({
  page,
}, info) => {
  test.setTimeout(120_000);
  const errors = await openRaid(page);
  // Every fighter on the court is drawn with art the check finds healthy.
  await expect
    .poll(
      async () => {
        const h = await health(page);
        return ["me", ...ALLIES.map((_, i) => `ally-${i}`)].every(
          (id) => h[id],
        );
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const before = await health(page);
  for (const [id, h] of Object.entries(before)) {
    expect(h.total, id).toBeGreaterThan(3);
    expect(h.blank, `${id} (${h.character}) is not blank`).toBe(false);
  }
  // The battle's own checks (a new renderer ran one) found nothing.
  await page.waitForTimeout(3500);
  const quiet = await page.evaluate(() =>
    (window as any).__emitted.filter(([ev]: [string]) => ev === "battle-art"),
  );
  expect(quiet).toEqual([]);

  // Safari drops the painted canvases behind the local fighter: each of
  // its textures now draws from a transparent canvas, uploaded again.
  const blanked = await page.evaluate(() => {
    const scene = (window as any).__arenaGame.scene.getScene("arena");
    const rig = scene.rigs.get("me");
    (window as any).__oldRig = rig;
    const keys = new Set<string>();
    const walk = (n: any) => {
      if (n.texture?.key && n.texture.key !== "__MISSING")
        keys.add(n.texture.key);
      for (const c of n.list ?? []) walk(c);
    };
    walk(rig.root);
    for (const key of keys) {
      const t = scene.textures.get(key),
        src = t.source[0],
        empty = document.createElement("canvas");
      empty.width = src.width;
      empty.height = src.height;
      src.image = empty;
      src.update();
    }
    return keys.size;
  });
  expect(blanked).toBeGreaterThan(3);
  expect((await health(page)).me.blank).toBe(true);

  // The page is shown again: the check finds it, loads the art again and
  // tells the server.
  await page.evaluate(() =>
    (window as any).__arenaGame.scene.getScene("arena").checkArtSoon("visible"),
  );
  await expect
    .poll(
      async () =>
        page.evaluate(() =>
          (window as any).__emitted
            .filter(([ev]: [string]) => ev === "battle-art")
            .map(([, d]: [string, any]) => d),
        ),
      { timeout: 10_000 },
    )
    .toEqual([
      expect.objectContaining({
        character: before.me.character,
        mine: true,
        trigger: "visible",
        repaired: true,
        textures: before.me.total,
        blank: blanked,
      }),
    ]);
  // A new rig, drawn from art with pixels again; the others untouched.
  await expect
    .poll(
      async () => {
        const h = (await health(page)).me;
        const fresh = await page.evaluate(() => {
          const scene = (window as any).__arenaGame.scene.getScene("arena");
          const rig = scene.rigs.get("me");
          return !!rig && rig !== (window as any).__oldRig && rig.root.visible;
        });
        return fresh && h && !h.blank;
      },
      { timeout: 30_000 },
    )
    .toBe(true);
  const after = await health(page);
  for (const [id, h] of Object.entries(after)) expect(h.blank, id).toBe(false);
  await snap(page, info, "rig-art-repaired");
  expect(errors).toEqual([]);
});

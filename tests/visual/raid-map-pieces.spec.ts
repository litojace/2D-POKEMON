import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openHub, pushUntilBattle, snap, openPlayPanel } from "./helpers";

// Tidewyrm's Lagoon Court and Somnara's Cloud Deck draw their arena pieces
// (islands, flood, rune pads, Quiet Zone, bubbles, markers...) from one atlas
// per look, drawn while the battle scene is created (raid-map-atlas.ts).
// Each state is driven through the real snapshot; the test reads which atlas
// pieces the arena's image layers show.

async function raid(page: Page, boss: string) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__mapGame=gameInstance;" + marker),
    });
  });
  const errors = await openHub(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.evaluate((boss) => {
    const w = window as any;
    w.__room("raid", { boss });
    w.__snap.remaining = 300;
  }, boss);
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  return errors;
}
/** Change the snapshot (s = the raid's snapshot) and show it. */
async function show(page: Page, setup: string, wait = 450) {
  const frame = await page.evaluate((setup) => {
    const w = window as any,
      s = w.__snap;
    new Function("s", "r", setup)(s, s.raid);
    w.__push();
    return w.__mapGame.loop.frame;
  }, setup);
  // This machine draws a few frames a second: wait for two to show it.
  await page.waitForFunction(
    (frame) => (window as any).__mapGame.loop.frame >= frame + 2,
    frame,
  );
  await page.waitForTimeout(wait);
}
/**
 * The atlas pieces the arena's image layers show now, and its line commands.
 * With `hold`: when every named piece shows, the game holds on this frame
 * (a short effect) until heldShot.
 */
const pieces = (page: Page, hold?: string[]) =>
  page.evaluate((hold) => {
    const scene = (window as any).__mapGame.scene.getScene("arena");
    const frames: string[] = [];
    const at: Record<string, { x: number; y: number; sx: number }[]> = {};
    let lines = 0;
    for (const root of scene.children.list)
      if (
        (root.name === "raid-map-floor" || root.name === "raid-map-top") &&
        root.visible
      )
        for (const c of root.list) {
          if (c.type === "Graphics") lines += c.commandBuffer.length;
          else
            for (const img of c.list)
              if (img.visible) {
                frames.push(img.frame.name);
                (at[img.frame.name] ??= []).push({
                  x: img.x,
                  y: img.y,
                  sx: img.scaleX,
                });
              }
        }
    // The plain Nightmare ring the scene used to add (radius 500).
    const plainRings = scene.children.list.filter(
      (o: any) => o.type === "Arc" && o.radius === 500,
    ).length;
    if (hold?.every((h) => frames.includes(h)))
      (window as any).__mapGame.loop.sleep();
    return { frames, at, lines, plainRings };
  }, hold);
const count = (frames: string[], name: string | RegExp) =>
  frames.filter((f) => (typeof name === "string" ? f === name : name.test(f)))
    .length;
/** The atlas textures this battle has, with how and when each was drawn. */
const atlases = (page: Page, prefix: string) =>
  page.evaluate((prefix) => {
    const textures = (window as any).__mapGame.textures;
    return textures
      .getTextureKeys()
      .filter((k: string) => k.startsWith(prefix))
      .map((k: string) => ({ key: k, ...textures.get(k).customData.mapAtlas }));
  }, prefix);
const shot = (page: Page, info: TestInfo, name: string) =>
  snap(page, info, name);
/** Shoot the frame the game is held on (see pieces), and go on. */
async function heldShot(page: Page, info: TestInfo, name: string) {
  await snap(page, info, name);
  await page.evaluate(() => (window as any).__mapGame.loop.wake());
}

test("Tidewyrm's islands, cracks, sinking, High Tide and capacity are painted pieces", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await raid(page, "tidewyrm");
  // The atlas was drawn while the scene was created (CREATING = 4), not mid-fight.
  const built = await atlases(page, "lagoon-atlas-");
  expect(built).toHaveLength(1);
  expect(built[0].builtWhile).toBe(4);
  console.log("lagoon atlas", JSON.stringify(built));
  // The test room's trait may be Spring Tide: its radius (78, or 92).
  const R = Number(built[0].key.split("-").at(-1));
  const other = R === 78 ? 92 : 78;
  // Keep the serpent off the islands, below the water.
  const base =
    "const b = s.players.find((p) => p.raidBoss); b.x = 800; b.y = 450;" +
    "r.submerged = true; r.exposedUntil = 0; r.warnings = []; r.floodUntil = 0;" +
    "r.waves = []; r.bubbles = []; r.prisons = []; r.undertow = undefined;" +
    "const me = s.players.find((p) => p.id === 'me'); me.x = 640; me.y = 450;" +
    "const p2 = s.players.find((p) => p.id === 'p2'); p2.x = 960; p2.y = 450;";
  const isl = (spec: string) =>
    base +
    `const spec = ${spec}; r.islands.forEach((i, n) => { const o = spec[n] || {};` +
    `i.cracks = o.c || 0; i.sunk = !!o.sunk; i.gone = !!o.gone; i.radius = o.R || ${R}; });`;
  const report: Record<string, number> = {};

  await show(page, isl("[{}, {c: 1}, {c: 2}, {sunk: true}]"));
  let p = await pieces(page);
  report.mix = p.frames.length;
  expect(count(p.frames, `body${R}`)).toBe(3);
  expect(count(p.frames, `base${R}`)).toBe(3);
  expect(count(p.frames, `foamA${R}`)).toBe(3);
  expect(count(p.frames, `crack${R}_1_0`)).toBe(1);
  expect(count(p.frames, new RegExp(`^crack${R}_2_[01]$`))).toBe(2);
  expect(count(p.frames, `soggy${R}`)).toBe(1);
  expect(count(p.frames, `sunk${R}`)).toBe(1);
  // Every island's sand is centred on the server's island, at scale 1.
  for (const a of p.at[`body${R}`]) expect(a.sx).toBeCloseTo(0.5, 3);
  await shot(page, info, "tide-mix");

  // (The sunk island comes back up first: wait for that to end.)
  await show(page, isl("[{}, {}, {}, {}]"), 1200);
  p = await pieces(page);
  report.dry = p.frames.length;
  expect(count(p.frames, `body${R}`)).toBe(4);
  expect(count(p.frames, /^crack|^sunk|^soggy/)).toBe(0);
  await shot(page, info, "tide-dry");

  await show(page, isl("[{c: 1}, {c: 1}, {c: 1}, {c: 1}]"));
  p = await pieces(page);
  report.crack1 = p.frames.length;
  expect(count(p.frames, new RegExp(`^crack${R}_\\d_0$`))).toBe(4);
  await shot(page, info, "tide-crack1");

  await show(page, isl("[{c: 2}, {c: 2}, {c: 2}, {c: 2}]"));
  p = await pieces(page);
  report.crack2 = p.frames.length;
  expect(count(p.frames, new RegExp(`^crack${R}_\\d_1$`))).toBe(4);
  expect(count(p.frames, `soggy${R}`)).toBe(4);
  await shot(page, info, "tide-crack2");

  // Going under: for a moment the sand and the sandbank show together, with spray.
  await show(
    page,
    isl(
      "[{c: 2, sunk: true}, {c: 2, sunk: true}, {c: 2, sunk: true}, {c: 2, sunk: true}]",
    ),
    0,
  );
  await expect
    .poll(
      async () => {
        const q = await pieces(page, [`body${R}`, `sunk${R}`]);
        return (
          count(q.frames, `body${R}`) > 0 && count(q.frames, `sunk${R}`) > 0
        );
      },
      { intervals: [30], timeout: 900 },
    )
    .toBe(true);
  report.sinking = (await pieces(page)).frames.length;
  await heldShot(page, info, "tide-sinking");
  await page.waitForTimeout(1000);
  p = await pieces(page);
  report.sunk = p.frames.length;
  expect(count(p.frames, `sunk${R}`)).toBe(4);
  expect(count(p.frames, `body${R}`)).toBe(0);
  await shot(page, info, "tide-sunk");

  // Coming back up next chapter.
  await show(page, isl("[{}, {}, {}, {}]"), 0);
  await expect
    .poll(
      async () => {
        const q = await pieces(page, [`body${R}`, `sunk${R}`]);
        return (
          count(q.frames, `body${R}`) > 0 && count(q.frames, `sunk${R}`) > 0
        );
      },
      { intervals: [30], timeout: 900 },
    )
    .toBe(true);
  report.rising = (await pieces(page)).frames.length;
  await heldShot(page, info, "tide-rising");
  await page.waitForTimeout(1000);

  // Peril 3: islands sunk for good.
  await show(
    page,
    isl("[{c: 1}, {gone: true, sunk: true}, {gone: true, sunk: true}, {}]"),
  );
  await page.waitForTimeout(900);
  p = await pieces(page);
  report.gone = p.frames.length;
  expect(count(p.frames, `gone${R}`)).toBe(2);
  expect(count(p.frames, `body${R}`)).toBe(2);
  await shot(page, info, "tide-gone");

  // The High Tide warning: the rim glows, a gold ring at R + 10 and an arrow on each dry island.
  await show(
    page,
    isl("[{}, {c: 1}, {}, {sunk: true}]") +
      "r.warnings = [{ id: 901, kind: 'hightide', startedAt: s.time - 1, at: s.time + 1, x: 800, y: 450, tx: 800, ty: 450, radius: 0 }];",
    1000,
  );
  p = await pieces(page);
  report.warn = p.frames.length;
  expect(count(p.frames, "rimGlow")).toBe(4);
  expect(count(p.frames, "rimLine")).toBe(4);
  expect(count(p.frames, "rimCorner")).toBe(4);
  expect(count(p.frames, `gold${R}`)).toBe(3);
  expect(count(p.frames, `goldGlow${R}`)).toBe(3);
  expect(count(p.frames, "chevron")).toBe(3);
  await shot(page, info, "tide-warn");

  // High Tide: the flood, surf round the shore, two pips per island, and a
  // red ring on the island with three raiders on it.
  await show(
    page,
    isl("[{}, {}, {}, {c: 1}]") +
      "r.floodUntil = s.time + 4; r.partySize = 4;" +
      "const extra = ['p3', 'p4', 'p5'].map((id) => ({ ...structuredClone(p2), id, name: id }));" +
      "s.players = s.players.filter((p) => !['p3', 'p4', 'p5'].includes(p.id)).concat(extra);" +
      "const at = { me: [470, 262], p2: [1105, 262], p3: [440, 655], p4: [500, 632], p5: [478, 690] };" +
      "for (const p of s.players) if (at[p.id]) [p.x, p.y] = at[p.id];",
    1200,
  );
  p = await pieces(page);
  report.flood = p.frames.length;
  expect(count(p.frames, "flood")).toBe(1);
  expect(count(p.frames, "swell")).toBe(7);
  expect(count(p.frames, `surf${R}`)).toBe(4);
  expect(count(p.frames, "pipOn") + count(p.frames, "pipOff")).toBe(8);
  expect(count(p.frames, `red${R}`)).toBe(1);
  // The red ring sits on the island at (470, 645).
  expect(p.at[`red${R}`][0]).toMatchObject({ x: 470, y: 645 });
  await shot(page, info, "tide-flood");

  // The other island size (plain 78 or Spring Tide's 92) gets its own pieces.
  await show(
    page,
    isl(
      `[{c: 2, R: ${other}}, {c: 2, R: ${other}}, {c: 2, R: ${other}}, {c: 2, R: ${other}}]`,
    ) +
      "s.players = s.players.filter((p) => !['p3', 'p4', 'p5'].includes(p.id));",
    1200,
  );
  p = await pieces(page);
  report.spring = p.frames.length;
  expect(count(p.frames, `body${other}`)).toBe(4);
  expect(count(p.frames, new RegExp(`^crack${other}_\\d_1$`))).toBe(4);
  await shot(page, info, `tide-crack2-r${other}`);
  console.log("tidewyrm images per frame", JSON.stringify(report));
  expect(errors).toEqual([]);
});

test("Somnara's rune pads, steps, Quiet Zone, lullaby, bubbles and markers are painted pieces", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await raid(page, "somnara");
  const built = await atlases(page, "cloud-deck-atlas-");
  expect(built).toHaveLength(1);
  expect(built[0].builtWhile).toBe(4);
  console.log("cloud deck atlas", JSON.stringify(built));
  const quiet = Number(built[0].key.split("-").at(-1));
  const base =
    "const b = s.players.find((p) => p.raidBoss); b.x = 800; b.y = 450;" +
    "r.warnings = []; r.runeCalls = []; r.dreamRings = []; r.dreamBubbles = [];" +
    "r.dreamTrails = []; r.quietZone = undefined; r.drowsy = {}; s.raidDream = undefined;" +
    "s.events = [];" +
    "const me = s.players.find((p) => p.id === 'me'); me.x = 720; me.y = 520;" +
    "const p2 = s.players.find((p) => p.id === 'p2'); p2.x = 930; p2.y = 360;";
  // You are the Dreamer: you see the sequence and call its runes.
  const dream = (backwards: boolean) =>
    "r.dream = { id: 77, dreamerId: 'me', step: 0, length: 3, until: s.time + 20, startedAt: s.time - 1, backwards: " +
    backwards +
    "};" +
    `s.raidDream = { id: 77, runes: ${backwards ? "['circle', 'moon', 'star']" : "['star', 'moon', 'circle']"}, full: true, backwards: ${backwards} };` +
    `r.runeCalls = [{ id: 5, playerId: 'me', rune: '${backwards ? "circle" : "star"}', step: 0, until: s.time + 3 }];`;
  const report: Record<string, number> = {};

  await show(page, base, 900);
  let p = await pieces(page);
  report.idle = p.frames.length;
  for (const rune of ["circle", "star", "moon", "wave"]) {
    expect(count(p.frames, `stone-${rune}`)).toBe(1);
    expect(count(p.frames, `glyph-${rune}`)).toBe(1);
    expect(count(p.frames, `edge-${rune}`)).toBe(1);
  }
  // The pads' exact entry edges sit on the server's pads.
  expect(p.at["edge-star"][0]).toMatchObject({ x: 1100, y: 270 });
  expect(count(p.frames, "gemGlow")).toBe(12);
  await shot(page, info, "som-idle");

  await show(page, base + dream(false) + "p2.x = 985; p2.y = 335;");
  p = await pieces(page);
  report.called = p.frames.length;
  expect(count(p.frames, "edgeHot-star")).toBe(1);
  expect(count(p.frames, "basin-star")).toBe(1);
  expect(count(p.frames, "orbit-star")).toBe(4);
  expect(count(p.frames, "callTile")).toBe(1);
  expect(count(p.frames, "coinS-star")).toBe(1);
  expect(count(p.frames, /^plaque[LMR]$/)).toBe(3);
  expect(count(p.frames, /^coinT-/)).toBe(3);
  await shot(page, info, "som-called");

  await show(
    page,
    base + dream(true) + "me.x = 760; me.y = 560; p2.x = 640; p2.y = 380;",
  );
  p = await pieces(page);
  report.backwards = p.frames.length;
  expect(count(p.frames, "arrowHead")).toBe(1);
  expect(count(p.frames, "edgeHot-circle")).toBe(1);
  await shot(page, info, "som-backwards");

  // A correct step: the server's value-0 mint heal at the raider on the Star pad.
  await show(
    page,
    base +
      dream(false) +
      "p2.x = 1066; p2.y = 306;" +
      "s.events = [{ id: 100001, kind: 'heal', x: 1066, y: 306, color: 0x99efdd, value: 0, owner: 'p2' }];",
    0,
  );
  await expect
    .poll(
      async () => count((await pieces(page, ["ringMint"])).frames, "ringMint"),
      {
        intervals: [30],
        timeout: 700,
      },
    )
    .toBe(1);
  p = await pieces(page);
  report.ok = p.frames.length;
  expect(p.at.ringMint[0]).toMatchObject({ x: 1100, y: 270 });
  expect(count(p.frames, "basin-mint")).toBe(1);
  await heldShot(page, info, "som-ok");
  await page.waitForTimeout(1600);

  // A wrong step: the Nightmare hits while a raider stands on the Moon pad.
  await show(
    page,
    base +
      "p2.x = 1062; p2.y = 612;" +
      "s.events = [{ id: 100002, kind: 'raid-impact', x: 800, y: 450, color: 0xc090ff, raidRadius: 500, owner: b.id }];",
    0,
  );
  await expect
    .poll(
      async () =>
        count((await pieces(page, ["nightRing"])).frames, "nightRing"),
      {
        intervals: [30],
        timeout: 400,
      },
    )
    .toBe(1);
  p = await pieces(page);
  report.bad = p.frames.length;
  expect(p.at.cracks[0]).toMatchObject({ x: 1100, y: 630 });
  expect(count(p.frames, "basin-rose")).toBe(1);
  // The shockwave is the arena's piece now, not the plain circle.
  expect(p.plainRings).toBe(0);
  await heldShot(page, info, "som-bad");
  await page.waitForTimeout(1600);

  // Lullaby rings: their band edges as lines, notes riding on them; drowsy pips.
  await show(
    page,
    base +
      "r.dreamRings = [{ id: 1, x: 800, y: 450, radius: 330, startedAt: s.time - 1 }, { id: 2, x: 800, y: 450, radius: 140, startedAt: s.time - 0.2 }];" +
      "me.x = 560; me.y = 560; p2.x = 1000; p2.y = 330;" +
      "r.drowsy = { me: { stacks: 2, sleepUntil: 0 }, p2: { stacks: 1, sleepUntil: 0 } };",
  );
  p = await pieces(page);
  report.lullaby = p.frames.length;
  expect(count(p.frames, "noteIvory")).toBe(12);
  expect(p.lines).toBeGreaterThan(0);
  expect(count(p.frames, "pipOn")).toBe(3);
  expect(count(p.frames, "pipOff")).toBe(3);
  await shot(page, info, "som-lullaby");

  // Dream bubbles drifting at a raider, and a dream trail.
  await show(
    page,
    base +
      "me.x = 600; me.y = 610;" +
      "r.dreamBubbles = [{ id: 1, x: 720, y: 470, until: s.time + 5 }, { id: 2, x: 660, y: 520, until: s.time + 5 }, { id: 3, x: 780, y: 540, until: s.time + 5 }];" +
      "r.dreamTrails = Array.from({ length: 10 }, (_, i) => ({ x: 720 + i * 30, y: 790 - i * 15, until: s.time + 0.3 * i }));" +
      "r.drowsy = { me: { stacks: 1, sleepUntil: 0 } };",
  );
  p = await pieces(page);
  report.bubbles = p.frames.length;
  expect(count(p.frames, "bubble")).toBe(3);
  expect(count(p.frames, "bubbleStar")).toBe(3);
  expect(count(p.frames, "mist")).toBe(10);
  await shot(page, info, "som-bubbles");

  // The Whale Song: the Quiet Zone at the server's radius; one raider asleep.
  await show(
    page,
    base +
      `r.quietZone = { x: 560, y: 480, radius: ${quiet}, startedAt: s.time - 1, until: s.time + 3 };` +
      "me.x = 640; me.y = 560; p2.x = 1010; p2.y = 330;" +
      "r.drowsy = { p2: { stacks: 0, sleepUntil: s.time + 3 } };",
  );
  p = await pieces(page);
  report.quiet = p.frames.length;
  expect(count(p.frames, "hush")).toBe(1);
  expect(count(p.frames, `quiet-${quiet}`)).toBe(1);
  expect(count(p.frames, "zBig")).toBe(1);
  // Only the one atlas: the zone's radius was the one it was drawn for.
  expect(await atlases(page, "cloud-deck-atlas-")).toHaveLength(1);
  await shot(page, info, "som-quiet");
  console.log("somnara images per frame", JSON.stringify(report));
  expect(errors).toEqual([]);
});

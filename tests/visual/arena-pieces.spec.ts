import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Gloomshade's Lantern Yard and the Storm Twins' conductor ring draw their
// pieces as images from one atlas each (raid-piece-stage.ts): lantern posts,
// light pools with exact edges, the snuff, hit pips, Ball Lightning and the
// night; copper posts, the polarity pad and marks, static fields and the
// link beam. The atlas is drawn when the arena scene is created, and every
// gameplay edge is drawn at the server's exact size.

const MARKER = "if (state?.raid) prewarmRaidArena(this, state.raid);";
/** Open a raid on `boss`, exposing the game and what was ready at create. */
async function openRaid(page: Page, boss: string) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch();
    let body = await response.text();
    body = body.replace(
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
      "window.__arenaGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
    );
    // Right after the arena's atlas is prepared: which atlases exist now.
    body = body.replace(
      MARKER,
      MARKER +
        " window.__arenaAtCreate = this.textures.getTextureKeys().filter((k) => /^(yard|ring)-atlas/.test(k));",
    );
    await route.fulfill({ response, body });
  });
  const errors = await openHub(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.evaluate((boss) => {
    const w = window as any;
    w.__room("raid", { boss });
    w.__snap.raid.warnings = [];
    w.__snap.raid.decoys = [];
    w.__snap.raid.partySize = 1;
    w.__snap.players = w.__snap.players.filter(
      (p: any) => p.raidBoss || p.id === "me",
    );
  }, boss);
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  return errors;
}
type Piece = {
  f: string;
  x: number;
  y: number;
  w: number;
  h: number;
  a: number;
  add: boolean;
};
type Stages = Record<string, { images: Piece[]; lines: number }>;
/** Every arena-pieces stage shown last frame, and its visible images. */
const stages = (page: Page): Promise<Stages> =>
  page.evaluate(() => {
    const scene = (window as any).__arenaGame.scene.getScene("arena");
    const out: Record<string, any> = {};
    for (const root of scene.children.list) {
      if (!root.name?.startsWith("arena-pieces:") || !root.visible) continue;
      out[root.name.slice("arena-pieces:".length)] = {
        images: root.list
          .filter((o: any) => o.type === "Image" && o.visible)
          .map((o: any) => ({
            f: o.frame.name,
            x: o.x,
            y: o.y,
            w: Math.abs(o.displayWidth),
            h: Math.abs(o.displayHeight),
            a: o.alpha,
            add: o.blendMode === 1,
          })),
        lines:
          root.list.find((o: any) => o.type === "Graphics")?.commandBuffer
            .length ?? 0,
      };
    }
    return out;
  });
/** Change the snapshot and push it to the client. */
const set = (page: Page, change: string) =>
  page.evaluate((change) => {
    const w = window as any;
    new Function("s", "me", change)(
      w.__snap,
      w.__snap.players.find((p: any) => p.id === "me"),
    );
    w.__push();
  }, change);
const frames = (s: Stages, stage: string) =>
  (s[stage]?.images ?? []).map((i) => i.f);
const count = (s: Stages, stage: string, f: string | RegExp) =>
  frames(s, stage).filter((n) => (typeof f === "string" ? n === f : f.test(n)))
    .length;
const all = (s: Stages, f: string | RegExp) =>
  Object.keys(s).reduce((n, k) => n + count(s, k, f), 0);
/** Wait until the drawn pieces pass `check`; returns them. */
async function until(page: Page, check: (s: Stages) => boolean) {
  let last: Stages = {};
  await expect
    .poll(
      async () => {
        last = await stages(page);
        return check(last);
      },
      { timeout: 15_000, intervals: [100, 200] },
    )
    .toBe(true)
    .catch(() => undefined);
  return last;
}
/** How many images each stage drew (for the report). */
const tally = (s: Stages) =>
  Object.fromEntries(
    Object.entries(s).map(([k, v]) => [
      k,
      v.images.length + (v.lines ? "+lines" : ""),
    ]),
  );

const LAMPS = [
  { x: 330, y: 210 },
  { x: 1270, y: 210 },
  { x: 330, y: 690 },
  { x: 1270, y: 690 },
];
const LIT = "for (const l of s.raid.lanterns) [l.lit, l.hits] = [true, 0];";

test("the Lantern Yard draws its posts, light, snuff, pips, relight, Ball Lightning and night", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors = await openRaid(page, "gloomshade");
  const trait = await page.evaluate(() => (window as any).__snap.raid.trait);
  const counts: Record<string, unknown> = {};
  expect
    .soft(await page.evaluate(() => (window as any).__arenaAtCreate))
    // The raid's trait is drawn at random: Moonlit's light reaches 185.
    .toEqual([`yard-atlas-${trait === "moonlit" ? 185 : 150}`]);
  // Lit: four posts aglow, four pools out to the exact edge at 150.
  await set(
    page,
    LIT + "s.raid.trait = ''; s.raid.lights = []; [me.x, me.y] = [430, 300];",
  );
  let s = await until(page, (s) => count(s, "yard-floor", "rim150") === 4);
  counts.lit = tally(s);
  await snap(page, info, "gloom-lit");
  expect.soft(count(s, "yard-floor", "pool150")).toBe(4);
  expect.soft(count(s, "yard-floor", /^night-/)).toBe(8);
  expect.soft(count(s, "yard-floor", "mist")).toBe(4);
  for (const [i, l] of LAMPS.entries()) {
    expect
      .soft(frames(s, `lantern-${i}`))
      .toEqual(expect.arrayContaining(["contact", "postLit", "halo", "flame"]));
    const rim = s["yard-floor"]?.images.find(
      (p) => p.f === "rim150" && p.x === l.x && p.y === l.y,
    );
    // The edge never moves: the 2 px line sits at 150 (piece 2R + 8 wide).
    expect.soft(rim && [rim.w, rim.h, rim.a]).toEqual([308, 308, 1]);
  }
  expect.soft(all(s, "postOut")).toBe(0);
  // The night: eight frames round the edge, the middle empty, faint while lit.
  const nightLit = s["yard-floor"]?.images.find((p) => p.f === "night-0")?.a;
  expect.soft(nightLit).toBeCloseTo(0.1 / 0.32, 3);

  // Moonlit: the light reaches 185.
  await set(page, "s.raid.trait = 'moonlit';");
  s = await until(page, (s) => count(s, "yard-floor", "rim185") === 4);
  await snap(page, info, "gloom-lit-moonlit");
  const moon = s["yard-floor"]?.images.find((p) => p.f === "rim185");
  expect.soft(moon && [moon.w, moon.h]).toEqual([378, 378]);
  expect.soft(count(s, "yard-floor", "pool185")).toBe(4);
  await set(page, "s.raid.trait = '';");
  await until(page, (s) => count(s, "yard-floor", "rim150") === 4);

  // Snuffing the second lantern: the shade creeps in, the red edge at the
  // exact reach and the timer round the lamp.
  await set(
    page,
    LIT +
      "s.raid.warnings = [{ id: 901, kind: 'snuff', lantern: 1, x: 1270, y: 210, tx: 1270, ty: 210, radius: 150, startedAt: s.time - 0.9, at: s.time + 0.6 }];",
  );
  s = await until(page, (s) => count(s, "yard-floor", /^shade150_/) === 2);
  counts.snuff = tally(s);
  await snap(page, info, "gloom-snuff");
  const edge = s["yard-floor"]?.images.find((p) => p.f === "snuffEdge150");
  expect.soft(edge && [edge.x, edge.y, edge.w]).toEqual([1270, 210, 312]);
  expect.soft(s["lantern-1"]?.lines ?? 0).toBeGreaterThan(0);
  // The rim stays exact under the shade.
  expect.soft(count(s, "yard-floor", "rim150")).toBe(4);

  // Out: two lanterns cold, 0/2 and 1/2 hits, with the "hit me" ring.
  await set(
    page,
    LIT +
      "s.raid.warnings = []; s.raid.lanterns[1].lit = false; s.raid.lanterns[2].lit = false; s.raid.lanterns[2].hits = 1;",
  );
  s = await until(page, (s) => all(s, "postOut") === 2);
  counts.out = tally(s);
  await snap(page, info, "gloom-out");
  expect.soft(count(s, "lantern-1", "pipOff")).toBe(2);
  expect.soft(count(s, "lantern-2", "pipOn")).toBe(1);
  expect.soft(count(s, "lantern-2", "pipOff")).toBe(1);
  expect.soft(count(s, "yard-floor", "dark150")).toBe(2);
  expect.soft(count(s, "yard-floor", "rim150")).toBe(2);
  for (const i of [1, 2]) {
    const l = LAMPS[i],
      imgs = s[`lantern-${i}`]?.images ?? [];
    // Pips where they always were: 14 px apart, 84 over the lantern.
    expect
      .soft(
        imgs
          .filter((p) => p.f.startsWith("pip"))
          .map((p) => [p.x, p.y])
          .sort((a, b) => a[0] - b[0]),
      )
      .toEqual([
        [l.x - 7, l.y - 84],
        [l.x + 7, l.y - 84],
      ]);
    const ring = imgs.find((p) => p.f === "ring");
    expect.soft(ring && [ring.x, ring.y]).toEqual([l.x, l.y - 40]);
    // Its radius sweeps 22 → 48 (the piece's ring is drawn at 35 of 80).
    const radius = ring ? (ring.w * 35) / 80 : 0;
    expect.soft(radius).toBeGreaterThanOrEqual(21.9);
    expect.soft(radius).toBeLessThanOrEqual(48.1);
    expect
      .soft(frames(s, `lantern-${i}`))
      .toEqual(
        expect.arrayContaining(["moonShadow", "postOut", "plate", "smoke"]),
      );
  }

  // Relit: the light spreads back out with a flash and sparks.
  await set(page, "s.raid.lanterns[1].hits = 1;");
  await until(page, (s) => count(s, "lantern-1", "pipOn") === 1);
  await set(
    page,
    "s.raid.lanterns[1].lit = true; s.raid.lanterns[1].hits = 0;",
  );
  s = await until(
    page,
    (s) =>
      count(s, "lantern-1", "sparkWarm") > 0 &&
      count(s, "lantern-1", "flash") === 1,
  );
  counts.relight = tally(s);
  await snap(page, info, "gloom-relight");
  expect.soft(count(s, "lantern-1", "sparkWarm")).toBeGreaterThan(0);
  expect.soft(frames(s, "lantern-1")).toContain("postLit");

  // Ball Lightning: a cool patch with its exact edge at 160.
  await set(
    page,
    LIT +
      "s.raid.lanterns[2].lit = false; s.raid.lights = [{ x: 640, y: 600, radius: 160, until: s.time + 2 }];",
  );
  s = await until(page, (s) => count(s, "yard-floor", "ballRim") === 1);
  counts.ball = tally(s);
  await snap(page, info, "gloom-ball");
  const ball = s["yard-floor"]?.images.find((p) => p.f === "ballRim");
  expect.soft(ball && [ball.x, ball.y, ball.w]).toEqual([640, 600, 328]);
  expect.soft(count(s, "yard-floor", "ballPool")).toBe(1);
  expect.soft(count(s, "yard-floor", "ballCore")).toBe(1);
  expect.soft(count(s, "yard-floor", "bolt")).toBe(4);

  // Every lantern out: the night closes in from the edges (never the middle).
  await set(
    page,
    "s.raid.lights = []; s.raid.lanterns.forEach((l, i) => { l.lit = false; l.hits = [0, 1, 1, 0][i]; });",
  );
  s = await until(page, (s) => all(s, "postOut") === 4);
  counts.dark = tally(s);
  await snap(page, info, "gloom-dark");
  expect.soft(count(s, "yard-floor", "pool150")).toBe(0);
  const nightDark = s["yard-floor"]?.images.find((p) => p.f === "night-0")?.a;
  expect.soft(nightDark).toBeCloseTo(1, 3);
  // No slice covers the middle of the yard.
  for (const p of (s["yard-floor"]?.images ?? []).filter((p) =>
    p.f.startsWith("night-"),
  ))
    expect
      .soft(p.x <= 800 && 800 <= p.x + p.w && p.y <= 450 && 450 <= p.y + p.h)
      .toBe(false);
  await info.attach("images per state", {
    body: JSON.stringify(counts, null, 1),
    contentType: "application/json",
  });
  console.log("gloomshade images per state", JSON.stringify(counts));
  expect(errors).toEqual([]);
});

test("the conductor ring draws its copper posts, polarity pad and marks, static fields and link beam", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors = await openRaid(page, "storm-twins");
  const counts: Record<string, unknown> = {};
  expect
    .soft(await page.evaluate(() => (window as any).__arenaAtCreate))
    .toEqual(["ring-atlas"]);
  // Idle: four copper posts, their shadows and warm floor light.
  await set(
    page,
    "s.raid.polarities = []; s.raid.polarityPad = undefined; s.raid.stormFields = []; s.raid.stormBeam = undefined; [me.x, me.y] = [430, 470];",
  );
  let s = await until(page, (s) => all(s, "post") === 4);
  counts.idle = tally(s);
  await snap(page, info, "twins-idle");
  for (let i = 0; i < 4; i++)
    expect
      .soft(frames(s, `post-${i}`))
      .toEqual(expect.arrayContaining(["post", "glowWarm"]));
  expect.soft(count(s, "ring-floor", "postShadow")).toBe(4);
  expect.soft(count(s, "ring-floor", "floorWarm")).toBe(4);
  // The ring inlay is baked into the floor, not drawn each frame.
  expect.soft(all(s, /ring|rail|inlay/i)).toBe(0);

  const twins = await page.evaluate(() => {
    const s = (window as any).__snap;
    return s.raid.twins.map((t: any) => {
      const p = s.players.find((p: any) => p.id === t.id);
      return { x: p.x, y: p.y };
    });
  });
  // Charging: the link beam's warning runs through post 0.
  await set(
    page,
    `s.raid.warnings = [{ id: 902, kind: 'link-beam', x: ${twins[0].x}, y: ${twins[0].y}, tx: ${twins[1].x}, ty: ${twins[1].y}, radius: 22, beamPost: 0, startedAt: s.time - 0.6, at: s.time + 0.55 }];`,
  );
  s = await until(page, (s) => count(s, "post-0", "glowPink") === 1);
  counts.charge = tally(s);
  await snap(page, info, "twins-charge");
  expect.soft(count(s, "post-0", /^boltPink/)).toBeGreaterThan(0);
  expect.soft(count(s, "ring-floor", "floorPink")).toBe(1);
  expect.soft(count(s, "ring-floor", "floorWarm")).toBe(3);

  // Conducting: the live beam through post 0, its band exactly 44 wide.
  await set(
    page,
    `const a = { x: ${twins[0].x}, y: ${twins[0].y} }, b = { x: ${twins[1].x}, y: ${twins[1].y} }, p = { x: 600, y: 260 };
     s.raid.warnings = []; s.raid.stormBeam = { points: [a, p, b], post: 0, until: s.time + 2 };`,
  );
  s = await until(page, (s) => count(s, "post-0", "glowGold") === 1);
  counts.conduct = tally(s);
  await snap(page, info, "twins-conduct");
  const bands = (s["ring-floor"]?.images ?? []).filter((p) => p.f === "band");
  expect.soft(bands.length).toBe(2);
  // The strip piece is 52 tall with the band in its middle 44.
  for (const b of bands) expect.soft(b.h).toBeCloseTo(52, 3);
  expect.soft(count(s, "post-0", /^boltGold/)).toBe(1);
  expect.soft(count(s, "ring-floor", /^bolt(Gold|Cyan)/)).toBe(4);

  // The polarity pad, + and −, and the mark over the raider.
  for (const [name, sign, mark] of [
    ["padPlus", 1, "markMinus"],
    ["padMinus", -1, "markPlus"],
  ] as const) {
    await set(
      page,
      `s.raid.stormBeam = undefined; [me.x, me.y] = [380, 575];
       s.raid.polarityPad = { x: 560, y: 500, sign: ${sign}, until: s.time + 4 };
       s.raid.polarities = [{ playerId: 'me', sign: ${-sign}, until: s.time + 3, cancelled: false }];`,
    );
    s = await until(page, (s) => count(s, "ring-marks", mark) === 1);
    counts[name] = tally(s);
    await snap(page, info, `twins-${name}`);
    const plus = sign > 0 ? "Plus" : "Minus";
    for (const f of ["padPlate", `padGlow${plus}`, `padSign${plus}`]) {
      const p = s["ring-floor"]?.images.find((p) => p.f === f);
      // The rim at 58 of the 150-wide piece: drawn at its own size.
      expect.soft(p && [p.x, p.y, p.w]).toEqual([560, 500, 150]);
    }
    expect.soft(count(s, "ring-marks", "markBase")).toBe(1);
    expect.soft(s["ring-marks"]?.lines ?? 0).toBeGreaterThan(0);
  }
  // Cancelling: standing on the opposite pad, the mark turns to a check.
  await set(
    page,
    "[me.x, me.y] = [560, 512]; s.raid.polarities[0].cancelled = true;",
  );
  s = await until(page, (s) => count(s, "ring-marks", "markCheck") === 1);
  counts.cancel = tally(s);
  await snap(page, info, "twins-cancel");

  // Static fields: the crisp edge at 100.
  await set(
    page,
    `s.raid.polarities = []; s.raid.polarityPad = undefined; [me.x, me.y] = [430, 470];
     s.raid.stormFields = [
       { id: 1, x: 790, y: 600, radius: 100, until: s.time + 5, casterId: s.raid.twins[0].id },
       { id: 2, x: 1270, y: 330, radius: 100, until: s.time + 5, casterId: s.raid.twins[1].id }];`,
  );
  s = await until(page, (s) => count(s, "ring-floor", "fieldDisc") === 2);
  counts.field = tally(s);
  await snap(page, info, "twins-field");
  const edges = (s["ring-floor"]?.images ?? []).filter((p) =>
    p.f.startsWith("fieldEdge"),
  );
  expect.soft(edges.length).toBe(2);
  // Turned, but centred, so the circle at 100 stays put.
  for (const e of edges) expect.soft([e.w, e.h]).toEqual([230, 230]);
  expect
    .soft(edges.map((e) => [e.x, e.y]).sort((a, b) => a[0] - b[0]))
    .toEqual([
      [790, 600],
      [1270, 330],
    ]);
  expect.soft(count(s, "ring-floor", /^boltField/)).toBe(6);
  expect.soft(count(s, "ring-marks", /./)).toBe(0);
  await info.attach("images per state", {
    body: JSON.stringify(counts, null, 1),
    contentType: "application/json",
  });
  console.log("storm-twins images per state", JSON.stringify(counts));
  expect(errors).toEqual([]);
});

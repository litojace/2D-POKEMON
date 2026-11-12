import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

// Emberwing's Sky Terrace is drawn like the painted lava terrace
// (raid-emberwing-terrace.ts): one atlas drawn while the battle scene is
// created, then each frame places images from it plus the exact danger
// edges as lines. Every brazier state, the burning ground, a dive lane, a
// flame ring, a feather and the grounding flash are drawn from it.
test.use({ viewport: { width: 1440, height: 900 } });

const MARKER = 'this.cameras.main.setBackgroundColor("#142746");';
async function enter(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text(),
      loop =
        "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(loop);
    expect(body).toContain(MARKER);
    await route.fulfill({
      response,
      body: body
        .replace(loop, "window.__terraceGame=gameInstance;" + loop)
        .replace(
          MARKER,
          MARKER + "window.__atCreate=this.textures.getTextureKeys();",
        ),
    });
  });
  const errors = await openHub(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.evaluate(() =>
    (window as any).__room("raid", {
      boss: "emberwing",
      pos: [640, 592, 700, 760],
    }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  return errors;
}
/** `n` frames drawn from now (this machine draws only a few a second under load). */
const frames = async (page: Page, n = 3) => {
  const f0 = await page.evaluate(
    () => (window as any).__terraceGame.loop.frame,
  );
  await expect
    .poll(
      () =>
        page.evaluate(() => {
          const w = window as any;
          w.__push();
          return w.__terraceGame.loop.frame;
        }),
      { timeout: 90_000, intervals: [300] },
    )
    .toBeGreaterThanOrEqual(f0 + n);
};
const push = async (page: Page, fn: string) => {
  await page.evaluate((fn) => {
    const w = window as any;
    new Function("s", fn)(w.__snap);
    w.__push();
  }, fn);
  await frames(page);
};
/** The terrace's pieces on show this frame: count per piece, and a few details. */
const terrace = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as any).__terraceGame.scene.getScene("arena");
    const count: Record<string, number> = {};
    const list: any[] = [];
    let total = 0;
    for (const o of scene.children.list) {
      if (!o.visible || o.type !== "Image" || !o.name?.startsWith("terrace-"))
        continue;
      const name = o.name.slice(8);
      count[name] = (count[name] ?? 0) + 1;
      total++;
      list.push({
        name,
        key: o.texture.key,
        x: o.x,
        y: o.y,
        sx: o.scaleX,
        sy: o.scaleY,
        depth: o.depth,
      });
    }
    return { count, list, total };
  });
const BR = (lit: (number | null)[], prog: number[]) =>
  `s.raid.partySize = 2; s.raid.braziers.forEach((b, i) => { b.progress = ${JSON.stringify(prog)}[i]; const k = ${JSON.stringify(lit)}[i]; b.litUntil = k === null ? 0 : s.time + k * 6; });`;

test("Emberwing's terrace draws every brazier state, the burning ground, dive lane, flame ring and feather from one atlas drawn at scene creation", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  const errors = await enter(page);
  expect(
    await page.evaluate(() => (window as any).__atCreate as string[]),
  ).toContain("ember-terrace-atlas");
  const size = await page.evaluate(() => {
    const s = (window as any).__terraceGame.scene
      .getScene("arena")
      .textures.get("ember-terrace-atlas").source[0];
    return { w: s.width, h: s.height };
  });
  expect(size.w * size.h * 4).toBeLessThan(6_000_000);
  const counts: Record<string, number> = {};

  // On the ground: grey rings, cold braziers.
  await push(
    page,
    "s.raid.airborne = false; s.raid.exposedUntil = 0;" +
      BR([null, null, null], [0, 0, 0]),
  );
  let t = await terrace(page);
  expect(t.list.every((o) => o.key === "ember-terrace-atlas")).toBe(true);
  expect(t.count).toMatchObject({ dais: 3, body: 3, "ring-grey": 3 });
  expect(t.count["flame-o"]).toBeUndefined();
  // The brazier stands up and sorts with the raiders by its foot (y + 30).
  const body = t.list.find((o) => o.name === "body" && o.y === 560)!;
  expect(body.depth).toBeCloseTo(2 + 590 / 10000, 6);
  counts.dormant = t.total;
  await snap(page, info, "terrace-dormant");

  // Airborne: teal rings and glyphs, ready to light.
  await push(
    page,
    "s.raid.airborne = true; s.raid.takeoffAt = s.time - 5;" +
      BR([null, null, null], [0, 0, 0]),
  );
  t = await terrace(page);
  expect(t.count).toMatchObject({ "ring-teal": 3, "glyph-teal": 3 });
  counts.active = t.total;

  // Lighting: the progress arc's head and a flame growing in the bowl.
  await push(page, BR([null, null, null], [0.55, 0.7, 0]));
  t = await terrace(page);
  // The progress arcs' heads (the arcs themselves are lines on their exact radius).
  expect(t.count).toMatchObject({ "arc-teal": 2, coals: 2, rimfront: 2 });
  expect(t.count["flame-o"]).toBe(4);
  counts.lighting = t.total;
  await snap(page, info, "terrace-lighting");

  // Lit: gold rings and glyphs, full fire, its light on the floor.
  await push(page, BR([0.62, 1, null], [0, 0, 0.5]));
  t = await terrace(page);
  expect(t.count).toMatchObject({
    "ring-gold": 2,
    "glyph-gold": 2,
    "ring-teal": 1,
    "flame-c": 3,
    "arc-gold": 2,
    "arc-teal": 1,
    // Sparks rising from the two lit fires and the lit one's.
    spark: 3 + 3 + 1,
  });
  expect(t.count.glow).toBe(3);
  counts.lit = t.total;
  await snap(page, info, "terrace-lit");

  // Nearly out: the fire gutters and smokes.
  await push(page, BR([0.66, 0.2, null], [0, 0, 0.6]));
  t = await terrace(page);
  expect(t.count.smoke).toBe(1);
  counts.burning = t.total;

  // All three lit: Emberwing comes down and fire leaps between the braziers.
  await push(
    page,
    "s.raid.airborne = false; s.raid.exposedUntil = s.time + 6;" +
      BR([0.5, 0.74, 1], [0, 0, 0]),
  );
  await push(page, "s.time += 0.4;");
  t = await terrace(page);
  expect(t.count.beam).toBe(3);
  expect(t.list.filter((o) => o.name === "beam").every((o) => o.sx > 0)).toBe(
    true,
  );
  expect(t.count.shock).toBe(3);
  counts.grounding = t.total;
  await snap(page, info, "terrace-grounding");

  // Burning ground, a dive lane, a big flame ring and a molting feather.
  await push(
    page,
    "s.time += 3; s.raid.airborne = true; s.raid.exposedUntil = 0;" +
      BR([null, null, null], [0, 0, 0]) +
      "s.raid.emberPatches = [{id:1,x:330,y:290,radius:88,until:s.time+30,growAt:s.time+9},{id:2,x:1300,y:210,radius:116,until:s.time+30,growAt:s.time+9},{id:3,x:1250,y:770,radius:180,until:s.time+30,growAt:s.time+9},{id:4,x:360,y:770,radius:144,until:s.time+30,growAt:s.time+9}];" +
      "s.raid.emberTrails = [{x:1180,y:440,tx:690,ty:410,until:s.time+4,width:38}];" +
      "s.raid.flameRings = [{id:1,x:1100,y:480,radius:420,startedAt:s.time}];" +
      "s.raid.emberFeathers = [{id:1,x:730,y:470,until:s.time+9}];",
  );
  t = await terrace(page);
  expect(t.count).toMatchObject({
    scorch: 4,
    "scorch-glow": 4,
    trail: 1,
    "trail-glow": 1,
    feather: 1,
  });
  // Each patch's char is scaled to its exact radius (the atlas draws it at 120).
  const patch = t.list.find((o) => o.name === "scorch" && o.x === 1250)!;
  expect(patch.sx * 2 * 0.6 * 120).toBeCloseTo(180, 0);
  // The lane piece is exactly 2 × 38 across (its atlas band is 2 × 38).
  const lane = t.list.find((o) => o.name === "trail")!;
  expect(lane.sy * 2 * 0.75).toBeCloseTo(1, 3);
  // Patch flames 4 + 4 + 6 + 6, the lane's 4, and at most 24 on the ring.
  expect(t.count["flame-s"]).toBeGreaterThan(28);
  expect(t.count["flame-s"]).toBeLessThanOrEqual(20 + 4 + 24);
  counts.scorch = t.total;
  await snap(page, info, "terrace-scorch");

  // Low graphics: no halos, sparks, smoke or breathing glow; the rest stays.
  await page.evaluate(() => localStorage.setItem("ea-graphics", "low"));
  await push(page, BR([0.66, 0.2, null], [0, 0, 0.6]));
  t = await terrace(page);
  for (const n of ["glow", "spark", "smoke", "scorch-glow", "trail-glow"])
    expect(t.count[n]).toBeUndefined();
  expect(t.count).toMatchObject({
    scorch: 4,
    trail: 1,
    "ring-gold": 2,
    "arc-gold": 2,
  });
  counts.low = t.total;
  await info.attach("images-per-frame", {
    body: JSON.stringify(counts),
    contentType: "application/json",
  });
  console.log("terrace images per frame", JSON.stringify(counts));
  expect(errors).toEqual([]);
});

test("with reduced motion the terrace's fire and feather hold still", async ({
  browser,
}) => {
  test.setTimeout(180_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    const errors = await enter(page);
    await push(
      page,
      "s.raid.airborne = true; s.raid.takeoffAt = s.time - 5;" +
        BR([0.9, null, null], [0, 0.5, 0]) +
        "s.raid.emberFeathers = [{id:1,x:730,y:470,until:s.time+90}];",
    );
    const look = async () =>
      (await terrace(page)).list
        .filter((o) => ["flame-o", "flame-c", "feather"].includes(o.name))
        .map((o) => [o.name, o.x, o.y, o.sx, o.sy]);
    const a = await look();
    await push(page, "s.time += 0.37;");
    const b = await look();
    expect(a.length).toBeGreaterThan(3);
    expect(b).toEqual(a);
    // No sparks rising, no grounding flash.
    await push(
      page,
      "s.raid.airborne = false; s.raid.exposedUntil = s.time + 6;" +
        BR([0.5, 0.74, 1], [0, 0, 0]),
    );
    await push(page, "s.time += 0.4;");
    const t = await terrace(page);
    expect(t.count.beam).toBeUndefined();
    expect(t.count.spark).toBeUndefined();
    expect(errors).toEqual([]);
  } finally {
    await context.close();
  }
});

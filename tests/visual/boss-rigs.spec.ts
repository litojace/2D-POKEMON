import { expect, test, type Page } from "@playwright/test";
import { openHub, pushUntilBattle, snap, openPlayPanel } from "./helpers";

// Every raid boss is vector art: a rig per boss (boss-vector-*-rig.ts), drawn
// from one atlas of pieces per phase. These checks run all seven together in
// the boss-review harness; vector-<boss>.spec.ts covers each rig in depth.

async function review(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/boss-review-page", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: '<body style="margin:0"></body>',
    }),
  );
  await page.goto("/boss-review-page");
  await page.evaluate(async () => {
    const { reviewBosses } = await import("/boss-review.ts");
    const w = window as any;
    w.__bossReview = reviewBosses(true);
    await w.__bossReview.loaded;
    w.__bossReview.game.loop.sleep();
  });
  return errors;
}
/** The root names of the rigs: one per boss; Gloomshade's real body and each
 * Storm Twin have their own. */
const ROOTS = {
  grumblecrag: "cragmuff-boss",
  tidewyrm: "vector-boss-tidewyrm",
  gloomshade: "vector-boss-gloomshade:shade-0",
  somnara: "snoozaku-boss",
  prismatail: "vector-boss-prismatail",
  emberwing: "vector-boss-emberwing",
  fizz: "vector-boss-twin-0",
  crackle: "vector-boss-twin-1",
} as const;
type Rig = keyof typeof ROOTS;
const ALL = Object.keys(ROOTS) as Rig[];
/** A rig's root and its visible image parts (null when it has none). */
const vector = (page: Page, id: Rig = "grumblecrag") =>
  page.evaluate((name) => {
    const w = window as any,
      scene = w.__bossReview.rows[0].g.scene,
      root = scene.children.list.find((o: any) => o.name === name);
    if (!root) return null;
    const parts: Record<string, any> = {};
    // the body (root.list[0]) and its glows (root.list[1]); some bodies also
    // hold thin lines (Graphics), which have no texture
    for (const o of root.list.flatMap((c: any) => c.list ?? []))
      if (o.visible && o.type === "Image")
        parts[o.name.replace(/^(vector-part-|cragmuff-|snoozaku-)/, "")] = {
          x: o.x,
          y: o.y,
          rotation: o.rotation,
          sx: o.scaleX,
          sy: o.scaleY,
          alpha: o.alpha,
          frame: o.frame.name,
          texture: o.texture.key,
        };
    return { visible: root.visible, facing: root.getData("facing"), parts };
  }, ROOTS[id]);
const all = async (page: Page) => {
  const out = {} as Record<Rig, Awaited<ReturnType<typeof vector>>>;
  for (const id of ALL) out[id] = await vector(page, id);
  return out;
};
/** Inkpurr's bodies (boss id "gloomshade", boss-inkpurr-rig.ts): one rig per body. */
const gloomRoots = (page: Page) =>
  page.evaluate(() =>
    (window as any).__bossReview.rows[0].g.scene.children.list
      .filter((o: any) => o.name.startsWith("vector-boss-gloomshade:"))
      .map((o: any) => ({ name: o.name, visible: o.visible })),
  );
/** How far a rig's pieces moved between two looks (the largest move). */
const moved = (a: any, b: any) =>
  Math.max(
    0,
    ...Object.keys(a.parts)
      .filter((k) => b.parts[k])
      .map((k) =>
        Math.hypot(a.parts[k].x - b.parts[k].x, a.parts[k].y - b.parts[k].y),
      ),
  );

test("all seven bosses' rigs animate, hold a pause and keep combat snapshots immutable", async ({
  page,
}, info) => {
  await page.setViewportSize({ width: 1600, height: 2000 });
  const errors = await review(page);
  await page.evaluate(() => (window as any).__bossReview.frame(1, 0, false));
  // no painted boss is left: nothing is drawn from a boss atlas
  expect(
    await page.evaluate(() =>
      (window as any).__bossReview.rows[0].g.scene.children.list.some(
        (o: any) => o.name.startsWith("painted-boss-"),
      ),
    ),
  ).toBe(false);
  const start = await all(page);
  for (const id of ALL) {
    expect(start[id], id).not.toBeNull();
    expect(start[id]!.visible, id).toBe(true);
    // Lumiwick (Emberwing's id) is a simple round lantern; Cragmuff and
    // Snoozaku (Somnara's id) stand in a handful of images (one picture for
    // their legs, one for the body).
    expect(Object.keys(start[id]!.parts).length, id).toBeGreaterThan(
      id === "emberwing" || id === "grumblecrag" || id === "somnara" ? 6 : 10,
    );
  }
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const kinds = {
      grumblecrag: "slam",
      tidewyrm: "bubbles",
      gloomshade: "pulse",
      somnara: "lullaby",
      prismatail: "fan-display",
      emberwing: "flame-ring",
      "storm-twins": "thunderclap",
    };
    for (const row of r.rows) {
      const boss = row.state.players.find((p: any) => p.raidBoss);
      row.state.raid.warnings = [
        {
          id: 91,
          kind: kinds[row.id as keyof typeof kinds],
          startedAt: 0,
          at: 1.4,
          x: boss.x,
          y: boss.y,
          tx: boss.x,
          ty: boss.y,
          radius: 120,
        },
      ];
    }
    for (let n = 1; n <= 12; n++) r.frame(1, n * 0.1, false);
  });
  const gathered = await all(page);
  // every boss winds up visibly
  for (const id of ALL)
    expect(moved(gathered[id], start[id]), id).toBeGreaterThan(2);
  // Ground Slam: Cragmuff rears up on its hind legs (its own drawing), horns glowing.
  const v0 = start.grumblecrag!,
    v1 = gathered.grumblecrag!;
  expect(v0.parts.body.frame).toMatch(/^body_/);
  expect(v1.parts.body.frame).toMatch(/^bodyR_/);
  expect(v1.parts.head.y).toBeLessThan(v0.parts.head.y - 15);
  expect(v1.parts.hglow0).toBeTruthy();
  // Fan Display: Prismatail's train spreads and shines, its neck lifts.
  const spread = (v: any) =>
    Math.abs(
      Math.atan2(
        Math.sin(v.parts.shard0.rotation - v.parts.shard4.rotation),
        Math.cos(v.parts.shard0.rotation - v.parts.shard4.rotation),
      ),
    );
  expect(spread(gathered.prismatail)).toBeGreaterThan(spread(start.prismatail));
  expect(gathered.prismatail!.parts.head.y).toBeLessThan(
    start.prismatail!.parts.head.y,
  );
  expect(gathered.prismatail!.parts.shine0).toBeTruthy();
  // Flame Ring: Lumiwick (Emberwing's id) hugs itself, ribbons wrapped.
  expect(start.emberwing!.parts.armL.frame).toMatch(/_rest_/);
  expect(gathered.emberwing!.parts.armL.frame).toMatch(/_wrap_/);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.raid.warnings = [];
    r.frame(1, 1.45, false);
    r.frame(1, 1.5, false);
    r.frame(1, 1.55, false);
  });
  const striking = await all(page);
  // ...and stomps back down
  expect(striking.grumblecrag!.parts.body.frame).toMatch(/^body_/);
  expect(striking.grumblecrag!.parts.head.y).toBeGreaterThan(
    v1.parts.head.y + 15,
  );
  for (const id of ALL)
    for (const p of Object.values(striking[id]!.parts) as any[])
      for (const n of [p.x, p.y, p.rotation, p.sx, p.sy, p.alpha])
        expect(Number.isFinite(n), id).toBe(true);
  // paused: nothing moves however long it lasts
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "paused";
    r.frame(2, 2.1, false);
  });
  const paused = await all(page);
  await page.evaluate(() => (window as any).__bossReview.frame(2, 20, false));
  expect(await all(page)).toEqual(paused);
  // reduced motion: still between frames
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "playing";
    r.frame(3, 20.025, true);
  });
  const reduced = await all(page);
  await page.evaluate(() => (window as any).__bossReview.frame(3, 22, true));
  expect(await all(page)).toEqual(reduced);
  await snap(page, info, "seven-bosses");
  // A retry resets the presentation clock while the same scene and rigs survive.
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows)
      row.state.raid.warnings = [
        {
          id: 101,
          kind: "slam",
          startedAt: 29,
          at: 31,
          x: 0,
          y: 0,
          tx: 0,
          ty: 0,
          radius: 100,
        },
      ];
    r.frame(1, 30, false);
    r.frame(1, 30.05, false);
    for (const row of r.rows) row.state.raid.warnings = [];
    r.frame(1, 0, false);
  });
  const retry = await all(page);
  for (const [id, keys] of [
    ["grumblecrag", ["legs", "body", "head", "eyes"]],
    ["tidewyrm", ["head", "body", "mouth", "tail"]],
    ["prismatail", ["body", "brooch", "head", "shard4"]],
    ["emberwing", ["body", "eyes", "curl"]],
  ] as const)
    for (const k of keys) {
      expect(retry[id]!.parts[k].x, `${id} ${k}`).toBeCloseTo(
        start[id]!.parts[k].x,
        1,
      );
      expect(retry[id]!.parts[k].y, `${id} ${k}`).toBeCloseTo(
        start[id]!.parts[k].y,
        1,
      );
    }
  expect(errors).toEqual([]);
});

test("copies, submerging and fades cannot leave stale boss sprites on cleared layers", async ({
  page,
}) => {
  const errors = await review(page);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const gloom = r.rows.find((o: any) => o.id === "gloomshade");
    gloom.state.raid.decoys = [{ id: 42, x: 150, y: 0 }];
    r.frame(1, 0, false);
    for (let n = 1; n <= 30; n++) r.frame(1, n * 0.025, false);
  });
  // each copy has a rig of its own
  expect(
    (await gloomRoots(page)).find((r) => r.name.endsWith("shade-42"))?.visible,
  ).toBe(true);
  expect((await vector(page, "tidewyrm"))?.visible).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.rows.find((o: any) => o.id === "gloomshade").state.raid.decoys = [];
    r.rows.find((o: any) => o.id === "tidewyrm").state.raid.submerged = true;
    r.frame(1, 0.8, false);
  });
  expect(
    (await gloomRoots(page)).find((r) => r.name.endsWith("shade-42"))?.visible,
  ).toBe(false);
  // diving hides Tidewyrm's rig
  expect((await vector(page, "tidewyrm"))?.visible).toBe(false);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    const s = r.rows.find((o: any) => o.id === "somnara").state;
    s.raid.result = "victory";
    s.players.find((p: any) => p.raidBoss).hp = 0;
    for (let n = 1; n <= 40; n++) r.frame(1, 0.8 + n * 0.05, false);
  });
  // beaten, Snoozaku (Somnara's id) curls up asleep, whole: paws tucked, eyes shut
  const asleep = (await vector(page, "somnara"))!;
  expect(asleep.visible).toBe(true);
  expect(asleep.parts.eyes.frame).toMatch(/^eyes_\d_closed$/);
  expect(asleep.parts.paws).toBeTruthy();
  expect(asleep.parts.head.alpha).toBe(1);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.game.loop.frame += 121;
    r.frame(1, 3, false);
  });
  // undrawn for over 120 frames, the burst copy's rig is disposed
  expect(
    (await gloomRoots(page)).find((r) => r.name.endsWith("shade-42")),
  ).toBeUndefined();
  // still under water and undrawn for over 120 frames: its rig is disposed
  expect(await vector(page, "tidewyrm")).toBeNull();
  expect(errors).toEqual([]);
});

for (const mobile of [false, true])
  test(`${mobile ? "iPhone Home Screen" : "desktop"} draws Emberwing as vector art inside the actual raid scene`, async ({
    browser,
  }, info) => {
    const context = await browser.newContext({
      viewport: mobile
        ? { width: 844, height: 390 }
        : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 3 : 2,
      isMobile: mobile,
      hasTouch: mobile,
      ...(mobile
        ? {
            userAgent:
              "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
          }
        : {}),
    });
    try {
      const page = await context.newPage();
      if (mobile)
        await page.addInitScript(() =>
          Object.defineProperty(navigator, "standalone", { value: true }),
        );
      await page.route(
        /\/apps\/client\/src\/main\.ts(?:\?|$)/,
        async (route) => {
          const response = await route.fetch(),
            body = await response.text();
          const marker =
            "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
          expect(body).toContain(marker);
          await route.fulfill({
            response,
            body: body.replace(
              marker,
              "window.__paintedBattle=gameInstance;" + marker,
            ),
          });
        },
      );
      const errors = await openHub(page);
      await page.evaluate(() =>
        (window as any).__room("raid", {
          boss: "emberwing",
          pos: [500, 450, 700, 600],
        }),
      );
      await openPlayPanel(page);
      await page.click("#play-create");
      await pushUntilBattle(page);
      await expect
        .poll(() =>
          page.evaluate(() => {
            const game = (window as any).__paintedBattle;
            return !!game?.scene
              .getScenes(true)
              .some((s: any) =>
                s.children.list.some(
                  (o: any) => o.name === "vector-boss-emberwing" && o.visible,
                ),
              );
          }),
        )
        .toBe(true);
      // one atlas of code-drawn pieces, and no painted Emberwing at all
      const textures = await page.evaluate(() =>
        (window as any).__paintedBattle.textures
          .getTextureKeys()
          .filter(
            (k: string) =>
              k.startsWith("raid-painted-") ||
              k.startsWith("vember-") ||
              k.startsWith("lumiwick-"),
          ),
      );
      expect(textures).toEqual(["lumiwick-atlas"]);
      await snap(page, info, `painted-raid-${mobile ? "iphone" : "desktop"}`);
      // Reproduce the real server steering back toward centre while a locked
      // Hot Gust points north. The lantern must keep showing its BACK (facing 4).
      await page.evaluate(async () => {
        const { createBossCombatDemo } = await import("/boss-combat-demo.ts");
        const w = window as any;
        w.__turnCombat = createBossCombatDemo("emberwing", true, false);
        w.__turnCombat.face("back");
        w.__turnCombat.cast("wing-gust");
        w.__turnTimer = setInterval(
          () => w.__turnCombat.step(1 / 30),
          1000 / 30,
        );
      });
      await page.waitForTimeout(650);
      // Freeze the server fixture during the locked cone, then wait for the
      // renderer to consume it. Slow CI GPUs may still be drawing the prior frame.
      await page.evaluate(() => clearInterval((window as any).__turnTimer));
      await expect
        .poll(() =>
          page.evaluate(() => {
            const w = window as any;
            return w.__paintedBattle.scene
              .getScenes(true)
              .flatMap((s: any) => s.children.list)
              .find((o: any) => o.name === "vector-boss-emberwing" && o.visible)
              ?.getData("facing");
          }),
        )
        .toBe(4);
      const read = () =>
        page.evaluate(() => {
          const w = window as any,
            root = w.__paintedBattle.scene
              .getScenes(true)
              .flatMap((s: any) => s.children.list)
              .find(
                (o: any) => o.name === "vector-boss-emberwing" && o.visible,
              );
          clearInterval(w.__turnTimer);
          return {
            facing: root?.getData("facing"),
            // from behind: its back view, and no face
            parts: root?.list[0].list
              .filter((o: any) => o.type === "Image" && o.visible)
              .map((o: any) => [o.name, o.frame.name]),
          };
        });
      // it turns round over a few frames once the facing is chosen
      await expect
        .poll(
          async () =>
            (await read()).parts.find(
              ([n]: [string]) => n === "vector-part-body",
            )?.[1],
        )
        .toBe("body_4");
      const locked = await read();
      expect(locked.facing).toBe(4);
      expect(
        locked.parts.find(([n]: [string]) => n === "vector-part-body")?.[1],
      ).toBe("body_4");
      expect(
        locked.parts.some(([n]: [string]) => n.startsWith("vector-part-eyes")),
      ).toBe(false);
      await snap(
        page,
        info,
        `locked-cone-back-${mobile ? "iphone" : "desktop"}`,
      );
      expect(errors).toEqual([]);
    } finally {
      await context.close();
    }
  });

// Tidewyrm is drawn as Tidelotl (tidelotl.spec.ts covers its rig in depth):
// stranded, its whole body lies belly-flat on the island's sand, facing either way.
test("stranded Tidewyrm is one complete grounded creature in both directions", async ({
  page,
}, info) => {
  const errors = await review(page);
  // Floating in the water, side-on: how high its head reaches (the yardstick).
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "tidewyrm"),
      boss = row.state.players.find((p: any) => p.raidBoss);
    boss.angle = 0;
    r.frame(1, 5.5, true);
  });
  const up = (await vector(page, "tidewyrm"))!;
  for (const facing of [1, -1]) {
    await page.evaluate((facing) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((o: any) => o.id === "tidewyrm"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (!row.state.raid.exposedUntil) r.frame();
      row.state.raid.exposedUntil = 20;
      row.state.raid.islands = [
        { x: boss.x, y: boss.y, radius: 220, sunk: false },
      ];
      boss.angle = facing > 0 ? 0 : Math.PI;
      r.frame(1, facing > 0 ? 6 : 6.25, true);
    }, facing);
    const v = (await vector(page, "tidewyrm"))!;
    expect(v.visible).toBe(true);
    // turned to the side it faces, the head out ahead of the body
    expect(v.facing).toBe(facing > 0 ? 2 : 6);
    expect(Math.sign(v.parts.head.x - v.parts.body.x)).toBe(facing);
    // out on the sand: legs splayed, tail flopped, nothing under water
    expect(v.parts.legFL.frame).toMatch(/_F_splay$/);
    expect(v.parts.tail.frame).toMatch(/_flop$/);
    expect(v.parts.fade).toBeUndefined();
    // belly-flat: the head sits lower than when it floats
    expect(v.parts.head.y).toBeGreaterThan(up.parts.head.y - 10);
    // one creature: every visible piece within a body's length of the boss
    for (const p of Object.values(v.parts) as any[])
      expect(Math.hypot(p.x, p.y)).toBeLessThan(260);
    await snap(
      page,
      info,
      `vector-tidewyrm-land-${facing > 0 ? "right" : "left"}`,
    );
  }
  expect(errors).toEqual([]);
});

// Gloomshade still lands its casts with the shared impacts and flipbook
// (Grumblecrag and Lumiwick draw their own; see their attack-fx specs).
test("confirmed casts have flipbook impacts, interrupted casts do not, and pause freezes the effect", async ({
  page,
}) => {
  const errors = await review(page);
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "gloomshade");
    row.state.raid.warnings = [
      {
        id: 1,
        kind: "pulse",
        startedAt: 0,
        at: 1,
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        radius: 90,
      },
    ];
    r.frame(1, 0, false);
    r.frame(1, 0.7, false);
    row.state.raid.warnings = [];
    r.frame(1, 0.75, false);
    r.frame(1, 1.05, false);
  });
  const count = () =>
    page.evaluate(
      () =>
        (window as any).__bossReview.rows[0].g.scene.children.list.filter(
          (o: any) => o.name === "boss-spell-flipbook" && o.visible,
        ).length,
    );
  expect(await count()).toBe(0);
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "gloomshade");
    row.state.raid.warnings = [
      {
        id: 2,
        kind: "pulse",
        startedAt: 1.1,
        at: 2,
        x: 0,
        y: 0,
        tx: 0,
        ty: 0,
        radius: 90,
      },
    ];
    for (let n = 0; n < 19; n++) r.frame(1, 1.1 + n * 0.05, false);
    row.state.raid.warnings = [];
    r.frame(1, 2.05, false);
    r.frame(1, 2.1, false);
  });
  expect(await count()).toBeGreaterThan(0);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "paused";
    r.frame(1, 2.1, false);
  });
  const before = await page.screenshot();
  await page.evaluate(() => (window as any).__bossReview.frame(1, 30, false));
  expect((await page.screenshot()).equals(before)).toBe(true);
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    for (const row of r.rows) row.state.phase = "playing";
    r.frame(1, 30.05, true);
  });
  expect(await count()).toBe(0);
  expect(errors).toEqual([]);
});

test("all seven bosses turn to each of the four main facings, with no face from behind", async ({
  page,
}) => {
  const errors = await review(page);
  for (const [view, angle] of [
    ["front", Math.PI / 2],
    ["back", -Math.PI / 2],
    ["left", Math.PI],
    ["right", 0],
  ] as const) {
    const time = { front: 0, back: 1, left: 2, right: 3 }[view];
    await page.evaluate(
      ({ angle, time }) => {
        const r = (window as any).__bossReview;
        for (const row of r.rows) {
          row.state.raid.airborne = row.id === "emberwing";
          for (const p of row.state.players) if (p.raidBoss) p.angle = angle;
        }
        r.frame(1, time, true);
      },
      { angle, time },
    );
    const facing = { front: 0, right: 2, back: 4, left: 6 }[view];
    const rigs = await all(page);
    for (const id of ALL)
      expect(rigs[id]!.facing, `${id} ${view}`).toBe(facing);
    const v = rigs.grumblecrag!;
    if (view === "front") expect(v.parts.eyes.frame).toMatch(/^eyes_0_/);
    if (view === "back") expect(v.parts.eyes).toBeUndefined();
    if (view === "left" || view === "right")
      expect(Math.sign(v.parts.head.x - v.parts.body.x)).toBe(
        view === "right" ? 1 : -1,
      );
    const t = rigs.tidewyrm!;
    if (view === "front")
      expect(t.parts.eyen && t.parts.eyef && t.parts.pearl).toBeTruthy();
    if (view === "back") expect(t.parts.eyen ?? t.parts.mouth).toBeUndefined();
    if (view === "left" || view === "right")
      expect(Math.sign(t.parts.head.x - t.parts.body.x)).toBe(
        view === "right" ? 1 : -1,
      );
    for (const id of ["gloomshade", "somnara", "fizz", "crackle"] as const) {
      // Inkpurr (id "gloomshade") and Snoozaku (id "somnara") draw their
      // eyes as one face piece
      const eye = id === "gloomshade" || id === "somnara" ? "eyes" : "eyen";
      if (view === "back") expect(rigs[id]!.parts[eye], id).toBeUndefined();
      else expect(rigs[id]!.parts[eye], id).toBeTruthy();
    }
    const pr = rigs.prismatail!;
    if (view === "front") expect(pr.parts.eyen && pr.parts.eyef).toBeTruthy();
    if (view === "back") expect(pr.parts.eyen ?? pr.parts.beak).toBeUndefined();
    if (view === "left" || view === "right")
      expect(Math.sign(pr.parts.beak.x - pr.parts.body.x)).toBe(
        view === "right" ? 1 : -1,
      );
    const e = rigs.emberwing!;
    if (view === "front") expect(e.parts.eyes.frame).toMatch(/^eyes_0_/);
    if (view === "back") expect(e.parts.eyes).toBeUndefined();
    if (view === "left" || view === "right") {
      // the side view, mirrored for the left
      expect(e.parts.eyes.frame).toMatch(/^eyes_2_/);
      expect(Math.sign(e.parts.body.sx * e.parts.body.sy)).toBe(
        view === "right" ? 1 : -1,
      );
    }
  }
  // Server position changes must turn the whole lantern away while travelling,
  // even though its last attack aim still points right.
  await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((o: any) => o.id === "emberwing"),
      boss = row.state.players.find((p: any) => p.raidBoss);
    boss.y -= 12;
    r.frame(1, 3.1, true);
    boss.y -= 12;
    r.frame(1, 3.25, true);
  });
  expect((await vector(page, "emberwing"))!.facing).toBe(4);
  expect(errors).toEqual([]);
});

test("lantern back and profile keep fluttering, then sink low facing the same way", async ({
  page,
}) => {
  const errors = await review(page);
  for (const [view, angle] of [
    ["back", -Math.PI / 2],
    ["right", 0],
  ] as const) {
    const clock = view === "back" ? 0 : 3;
    const facing = { back: 4, right: 2 }[view];
    await page.evaluate(
      ({ angle, clock }) => {
        const r = (window as any).__bossReview,
          row = r.rows.find((o: any) => o.id === "emberwing"),
          boss = row.state.players.find((p: any) => p.raidBoss);
        row.state.raid.airborne = true;
        boss.angle = angle;
        for (let n = 0; n < 20; n++) r.frame(1, clock + n * 0.05, false);
      },
      { angle, clock },
    );
    const first = (await vector(page, "emberwing"))!;
    await page.evaluate((clock) => {
      const r = (window as any).__bossReview;
      for (let n = 20; n < 27; n++) r.frame(1, clock + n * 0.05, false);
    }, clock);
    const second = (await vector(page, "emberwing"))!;
    expect(second.facing).toBe(facing);
    // the ribbons drift
    expect(second.parts.armL.rotation).not.toBeCloseTo(
      first.parts.armL.rotation,
      3,
    );
    await page.evaluate((clock) => {
      const r = (window as any).__bossReview;
      r.rows.find((o: any) => o.id === "emberwing").state.raid.airborne = false;
      for (let n = 27; n < 45; n++) r.frame(1, clock + n * 0.05, false);
    }, clock);
    const grounded = (await vector(page, "emberwing"))!;
    expect(grounded.facing).toBe(facing);
    // it floats low over the terrace until it flies again
    expect(grounded.parts.body.y).toBeGreaterThan(second.parts.body.y + 20);
  }
  expect(errors).toEqual([]);
});

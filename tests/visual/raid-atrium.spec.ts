import { expect, test, type Page } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle } from "./helpers";

// Prismatail's Sun Atrium (raid-prismatail-atrium.ts): its mirrors,
// skylights, light-relay beams, Sun Pillars and Blinded marker are images
// from one atlas, drawn when the battle scene is created, in three layers:
// the floor (under the warnings), one per standing thing (sorted with the
// raiders) and the light over them. Each state is driven through the real
// battle scene with the server's own raid snapshot.

const DEF = [0, Math.PI / 4, 0, (Math.PI * 7) / 4];
const SCR = [Math.PI / 2, Math.PI, (Math.PI * 3) / 4, Math.PI / 2];
type Link = [number, number, number, number, number];
const chain = (pts: [number, number][], beam = 0): Link[] =>
  pts.slice(1).map((p, i) => [pts[i][0], pts[i][1], p[0], p[1], beam]);
const LINKED = chain([
  [350, 450],
  [470, 450],
  [600, 300],
  [880, 300],
  [1000, 450],
]);
const SPLIT = [
  ...chain(
    [
      [350, 300],
      [470, 300],
      [600, 300],
      [880, 300],
      [1000, 450],
    ],
    0,
  ),
  ...chain(
    [
      [350, 600],
      [470, 600],
      [600, 600],
      [880, 600],
      [1000, 450],
    ],
    1,
  ),
];
interface State {
  mirrors: number[];
  me: [number, number];
  p2?: [number, number];
  links: Link[];
  phase?: number;
  trait?: string;
  exposed?: boolean;
  pillar?: [number, number];
  blind?: boolean;
}
const MARKER = "prewarmBossAtlas(this, state.raid.boss, state.raid.phase);";

async function battle(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    expect(body).toContain(MARKER);
    await route.fulfill({
      response,
      body: body
        .replace(
          "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
          "window.__atriumGame=gameInstance;gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);",
        )
        // what the scene holds the moment it is created
        .replace(
          MARKER,
          MARKER +
            " window.__atriumAtCreate = this.textures.exists('atrium-prisma-atlas');",
        ),
    });
  });
  const consoleErrors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  });
  const errors = await openHub(page);
  await page.evaluate(() =>
    (window as any).__room("raid", { boss: "prismatail" }),
  );
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  return { errors, consoleErrors };
}
async function setState(page: Page, s: State) {
  await page.evaluate((s) => {
    const w = window as any,
      snap = w.__snap,
      r = snap.raid;
    snap.remaining = 300;
    snap.time += 0.1;
    snap.events = [];
    r.warnings = [];
    const me = snap.players.find((p: any) => p.id === "me"),
      p2 = snap.players.find((p: any) => p.id === "p2"),
      boss = snap.players.find((p: any) => p.raidBoss);
    [boss.x, boss.y] = [1000, 450];
    [me.x, me.y] = s.me;
    [p2.x, p2.y] = s.p2 ?? [1300, 800];
    r.phase = s.phase ?? 1;
    r.partySize = s.phase === 3 ? 2 : 1;
    r.trait = s.trait ?? "overcast";
    r.mirrors.forEach((m: any, i: number) => (m.angle = s.mirrors[i]));
    r.lightLinks = s.links.map(([x, y, tx, ty, beam]) => ({
      x,
      y,
      tx,
      ty,
      beam,
    }));
    r.exposedUntil = s.exposed ? snap.time + 6 : 0;
    r.sunPillars = s.pillar
      ? [{ x: s.pillar[0], y: s.pillar[1], until: snap.time + 2, owner: "p2" }]
      : [];
    r.blinded = s.blind ? { p2: snap.time + 1.5 } : {};
    w.__push();
  }, s);
  // let the scene draw a few frames of it (this machine renders slowly)
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const loop = (window as any).__atriumGame.loop,
          from = loop.frame,
          start = performance.now();
        const wait = () =>
          loop.frame - from >= 6 && performance.now() - start > 600
            ? resolve()
            : setTimeout(wait, 50);
        wait();
      }),
  );
}
/** The atrium's visible images, by layer: piece names (and a few details). */
const pieces = (page: Page) =>
  page.evaluate(() => {
    const scene = (window as any).__atriumGame.scene.getScene("arena");
    const layers: Record<string, any> = {};
    for (const box of scene.children.list)
      if (box.name?.startsWith("atrium-") && box.visible)
        layers[box.name] = {
          depth: box.depth,
          images: box.list
            .filter((o: any) => o.visible)
            .map((o: any) => ({
              piece: o.name.replace("atrium-", ""),
              texture: o.texture.key,
              x: o.x,
              y: o.y,
              rotation: o.rotation,
              scaleX: o.scaleX,
              alpha: o.alpha,
              blend: o.blendMode,
            })),
        };
    return {
      layers,
      graphicsDepth: scene.graphics.depth,
      atlas: scene.textures.exists("atrium-prisma-atlas"),
    };
  });
const count = (
  layers: Record<string, { images: { piece: string }[] }>,
  piece: string,
  layer?: string,
) =>
  Object.entries(layers)
    .filter(([name]) => !layer || name === layer)
    .flatMap(([, l]) => l.images)
    .filter((i) => i.piece === piece).length;

test("the Sun Atrium's mirrors, skylights and light relay are drawn from one atlas in every state", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const { errors, consoleErrors } = await battle(page);
  // The atlas was drawn while the scene was being created, not on a frame.
  expect(await page.evaluate(() => (window as any).__atriumAtCreate)).toBe(
    true,
  );

  // Linked: skylight → raider → mirror → mirror → heart.
  await setState(page, { mirrors: DEF, me: [470, 450], links: LINKED });
  let seen = await pieces(page);
  const floor = seen.layers["atrium-floor"],
    light = seen.layers["atrium-light"];
  expect(floor, "floor layer").toBeTruthy();
  expect(light, "light layer").toBeTruthy();
  const all = Object.values(seen.layers).flatMap((l: any) => l.images);
  // every piece is an image from the one atlas, in normal blending
  expect(all.every((i: any) => i.texture === "atrium-prisma-atlas")).toBe(true);
  expect(all.every((i: any) => i.blend === 0)).toBe(true);
  // The floor sits under the battle graphics (the live warnings stay on top).
  expect(floor.depth).toBeLessThan(seen.graphicsDepth);
  expect(count(seen.layers, "range", "atrium-floor")).toBe(2);
  expect(count(seen.layers, "plate", "atrium-floor")).toBe(1);
  expect(count(seen.layers, "arrow", "atrium-floor")).toBe(4);
  expect(count(seen.layers, "beam0", "atrium-floor")).toBe(4);
  expect(count(seen.layers, "spill0", "atrium-floor")).toBe(4);
  expect(count(seen.layers, "arrowGlow", "atrium-floor")).toBe(2);
  expect(count(seen.layers, "shaft", "atrium-light")).toBe(1);
  expect(count(seen.layers, "spark0", "atrium-light")).toBe(4);
  expect(count(seen.layers, "flare0", "atrium-light")).toBe(3);
  // The arrows point as the server's mirrors do.
  expect(
    floor.images
      .filter((i: any) => i.piece === "arrow")
      .map((i: any) => Number(i.rotation.toFixed(4))),
  ).toEqual(
    DEF.map((a) => Number(Math.atan2(Math.sin(a), Math.cos(a)).toFixed(4))),
  );
  // Each mirror stands in its own layer, sorted with the raiders by y + 23.
  for (const [i, m] of [
    [600, 300],
    [880, 300],
    [600, 600],
    [880, 600],
  ].entries()) {
    const layer = seen.layers[`atrium-mirror-${i}`];
    expect(layer, `mirror ${i}`).toBeTruthy();
    expect(layer.depth).toBeCloseTo(2 + (m[1] + 23) / 10000, 4);
    expect(layer.images.map((x: any) => x.piece)).toContain(`post${i}`);
    expect(layer.images.at(-1).piece).toBe(`gem${i}`);
  }
  expect(
    seen.layers["atrium-skylight-0"].images.map((x: any) => x.piece),
  ).toEqual(["crown", "glow", "lens"]);

  // Two beams in phase 3: gold and cyan, from two skylights.
  await setState(page, {
    mirrors: DEF,
    me: [470, 300],
    p2: [470, 600],
    phase: 3,
    links: SPLIT,
  });
  seen = await pieces(page);
  expect(count(seen.layers, "beam0")).toBe(4);
  expect(count(seen.layers, "beam1")).toBe(4);
  expect(count(seen.layers, "range")).toBe(4);
  expect(count(seen.layers, "lens")).toBe(2);
  expect(count(seen.layers, "shaft")).toBe(2);

  // The skylight's reach: exactly 300, and 360 with Dazzling.
  await setState(page, { mirrors: DEF, me: [470, 450], links: LINKED });
  const plain = (await pieces(page)).layers["atrium-floor"].images.find(
    (i: any) => i.piece === "range",
  ).scaleX;
  await setState(page, {
    mirrors: DEF,
    me: [470, 450],
    links: LINKED,
    trait: "dazzling",
  });
  const dazzling = (await pieces(page)).layers["atrium-floor"].images.find(
    (i: any) => i.piece === "range",
  ).scaleX;
  expect(dazzling / plain).toBeCloseTo(1.2, 5);

  // A turned mirror rings its chime (and the plain impact ring is skipped).
  await setState(page, {
    mirrors: [0, 0, Math.PI / 2, Math.PI / 2],
    me: [470, 450],
    links: LINKED,
  });
  const turn = await page.evaluate(
    () =>
      new Promise<{ chime: boolean; rings: number }>((resolve) => {
        const w = window as any,
          scene = w.__atriumGame.scene.getScene("arena"),
          m = w.__snap.raid.mirrors[1];
        m.angle = Math.PI / 4;
        w.__snap.events = [
          {
            id: 990001,
            kind: "raid-impact",
            x: m.x,
            y: m.y,
            color: 0xffdf8d,
            raidRadius: 35,
          },
        ];
        w.__push();
        let rings = 0;
        const start = performance.now();
        const look = () => {
          const light = scene.children.list.find(
            (o: any) => o.name === "atrium-light",
          );
          rings = Math.max(
            rings,
            scene.children.list.filter(
              (o: any) => o.type === "Arc" && o.radius === 35,
            ).length,
          );
          if (
            light?.visible &&
            light.list.some((o: any) => o.visible && o.name === "atrium-chime")
          )
            resolve({ chime: true, rings });
          else if (performance.now() - start > 3000)
            resolve({ chime: false, rings });
          else requestAnimationFrame(look);
        };
        look();
      }),
  );
  expect(turn).toEqual({ chime: true, rings: 0 });

  // A Sun Pillar relays the light for its 4 seconds.
  await setState(page, {
    mirrors: SCR,
    me: [470, 450],
    pillar: [760, 450],
    links: chain([
      [350, 450],
      [470, 450],
      [760, 450],
      [1000, 450],
    ]),
  });
  seen = await pieces(page);
  expect(count(seen.layers, "pbase", "atrium-floor")).toBe(1);
  expect(count(seen.layers, "pcrys", "atrium-pillar-0")).toBe(1);

  // The heart open: the skylight goes dark and the ring's gems glint.
  await setState(page, {
    mirrors: DEF,
    me: [860, 500],
    links: [],
    exposed: true,
  });
  seen = await pieces(page);
  expect(count(seen.layers, "range")).toBe(0);
  expect(count(seen.layers, "shaft")).toBe(0);
  expect(count(seen.layers, "glint", "atrium-light")).toBe(12);
  expect(
    seen.layers["atrium-floor"].images.find((i: any) => i.piece === "plate")
      .alpha,
  ).toBeCloseTo(0.55);

  // Blinded: the crossed-out eye over the raider's head.
  await setState(page, {
    mirrors: DEF,
    me: [470, 450],
    p2: [700, 470],
    links: LINKED,
    blind: true,
  });
  seen = await pieces(page);
  const eye = seen.layers["atrium-light"].images.find(
    (i: any) => i.piece === "blind",
  );
  expect(eye).toBeTruthy();
  expect(eye.x).toBeCloseTo(700, 0);
  expect(eye.y).toBeLessThan(470 - 90);

  expect(errors).toEqual([]);
  expect(consoleErrors).toEqual([]);
});

test("Low graphics and reduced motion keep the atrium light and still", async ({
  browser,
}) => {
  test.setTimeout(150_000);
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: "reduce",
  });
  try {
    const page = await context.newPage();
    await page.addInitScript(() => localStorage.setItem("ea-graphics", "low"));
    const { errors, consoleErrors } = await battle(page);
    await setState(page, {
      mirrors: DEF,
      me: [470, 300],
      p2: [470, 600],
      phase: 3,
      links: SPLIT,
    });
    const seen = await pieces(page);
    // Low: no sunbeam, soft floor light, beam glow or flares; the beams stay.
    for (const piece of ["shaft", "spill0", "spill1", "bglow0", "bglow1"])
      expect(count(seen.layers, piece), piece).toBe(0);
    expect(count(seen.layers, "flare0") + count(seen.layers, "flare1")).toBe(0);
    expect(count(seen.layers, "beam0") + count(seen.layers, "beam1")).toBe(8);
    // The relay's floor line stays, thin, on the server's exact line: raiders
    // read it to know whether they stand in the light.
    const traces = seen.layers["atrium-floor"].images.filter((i: any) =>
      /^trace\d$/.test(i.piece),
    );
    expect(traces).toHaveLength(SPLIT.length);
    for (const [i, [x, y, tx, ty, beam]] of SPLIT.entries()) {
      expect(traces[i].piece).toBe(`trace${beam}`);
      expect(traces[i].x).toBeCloseTo(x, 3);
      expect(traces[i].y).toBeCloseTo(y, 3);
      expect(traces[i].rotation).toBeCloseTo(Math.atan2(ty - y, tx - x), 3);
    }
    // Reduced motion: no light blades, no travelling sparkle.
    expect(count(seen.layers, "crown")).toBe(0);
    expect(count(seen.layers, "spark0") + count(seen.layers, "spark1")).toBe(0);
    expect(count(seen.layers, "lens")).toBe(2);
    expect(count(seen.layers, "arrow")).toBe(4);
    // ...and nothing drifts: the range ring is where it was a moment ago.
    await page.waitForTimeout(600);
    const later = await pieces(page);
    const angle = (s: typeof seen) =>
      s.layers["atrium-floor"].images.find((i: any) => i.piece === "range")
        .rotation;
    expect(angle(later)).toBe(angle(seen));
    // A scramble warning is drawn at every level, full size, in atrium pieces.
    await page.evaluate(() => {
      const w = window as any,
        m = w.__snap.raid.mirrors[0];
      m.scrambleAt = w.__snap.time + 30;
      m.scrambleTurns = 2;
      w.__snap.time += 0.1;
      w.__push();
    });
    await expect
      .poll(async () => {
        const l = (await pieces(page)).layers;
        return [
          count(l, "scrHalo", "atrium-floor"),
          count(l, "scrArrow", "atrium-mirror-0"),
          count(l, "scrRing", "atrium-mirror-0"),
        ];
      })
      .toEqual([1, 1, 1]);
    const warned = (await pieces(page)).layers;
    const plate = warned["atrium-floor"].images.find(
      (i: any) => i.piece === "plate",
    );
    const halo = warned["atrium-floor"].images.find(
      (i: any) => i.piece === "scrHalo",
    );
    // the same atlas scale as the unscaled medallion: nothing shrunk on Low
    expect(halo.scaleX).toBeCloseTo(plate.scaleX, 5);
    // steady (reduced motion): full strength
    expect(halo.alpha).toBe(1);
    expect(errors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  } finally {
    await context.close();
  }
});

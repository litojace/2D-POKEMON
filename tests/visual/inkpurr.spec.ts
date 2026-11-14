import { expect, test, type Page } from "@playwright/test";

// Inkpurr (Gloomshade's look) is drawn by boss-inkpurr-rig.ts: every piece is
// painted once into one atlas when the scene is created, then posed every
// frame. It splits into copies: each body has a rig of its own, and only the
// real one shows the two tells (a shadow in lantern light, a flickering moon).
async function review(page: Page, requests: string[] = []) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("request", (r) => requests.push(r.url()));
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
/** Set the boss's state and draw it for `frames` frames from `clock`. */
const draw = (
  page: Page,
  o: {
    phase?: number;
    clock: number;
    frames?: number;
    angle?: number;
    reduced?: boolean;
    setup?: string;
  },
) =>
  page.evaluate(
    ({ phase, clock, frames, angle, reduced, setup }) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((x: any) => x.id === "gloomshade"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (angle !== undefined) boss.angle = angle;
      if (setup) new Function("row", "boss", setup)(row, boss);
      for (let n = 0; n < frames; n++)
        r.frame(phase, clock + n * 0.05, reduced, ["gloomshade"]);
    },
    {
      phase: o.phase ?? 1,
      clock: o.clock,
      frames: o.frames ?? 1,
      angle: o.angle,
      reduced: o.reduced ?? false,
      setup: o.setup,
    },
  );
/** Every body's rig: its root and visible image parts. */
const rigs = (page: Page) =>
  page.evaluate(() => {
    const r = (window as any).__bossReview,
      scene = r.rows[0].g.scene;
    const out: Record<string, any> = {};
    for (const root of scene.children.list.filter((o: any) =>
      o.name.startsWith("vector-boss-gloomshade:"),
    )) {
      const parts: Record<string, any> = {};
      for (const o of root.list.flatMap((c: any) => c.list ?? []))
        if (o.visible && o.type === "Image")
          parts[o.name.replace("vector-part-", "")] = {
            x: o.x,
            y: o.y,
            sx: o.scaleX,
            sy: o.scaleY,
            rot: o.rotation,
            alpha: o.alpha,
            frame: o.frame.name,
            texture: o.texture.key,
          };
      out[root.name.split(":")[1]] = {
        visible: root.visible,
        alpha: root.alpha,
        facing: root.getData("facing"),
        ring:
          root.list.find((o: any) => o.name === "vector-boss-front")
            ?.commandBuffer.length ?? -1,
        parts,
      };
    }
    return out;
  });
const facingFor = (deg: number) => Math.PI / 2 - (deg * Math.PI) / 180;
const CLEAR =
  "row.state.raid.decoys = []; row.state.raid.warnings = [];" +
  "row.state.raid.exposedUntil = 0; row.state.raid.staggerUntil = 0;" +
  "row.state.raid.result = null; boss.hp = Math.max(1, boss.hp);";

test("Inkpurr's atlas is drawn when the scene is created, inside its budget", async ({
  page,
}) => {
  const errors = await review(page);
  // the battle scene draws it on create, through the same call (main.ts: prewarmBossAtlas)
  const atlas = await page.evaluate(async (root) => {
    const r = (window as any).__bossReview,
      scene = r.rows[0].g.scene;
    if (scene.textures.exists("inkpurr-atlas"))
      scene.textures.remove("inkpurr-atlas");
    const { prewarmBossAtlas } = await import(
      `/@fs${root}/apps/client/src/boss-vector-prewarm.ts`
    );
    prewarmBossAtlas(scene, "gloomshade", 2);
    const tex = scene.textures.get("inkpurr-atlas");
    const src = tex.getSourceImage();
    return {
      exists: scene.textures.exists("inkpurr-atlas"),
      bytes: src.width * src.height * 4,
      frames: tex.getFrameNames().length,
    };
  }, process.cwd());
  console.log(
    `inkpurr atlas ${(atlas.bytes / 1048576).toFixed(2)} MB, ${atlas.frames} frames`,
  );
  expect(atlas.exists).toBe(true);
  expect(atlas.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(atlas.frames).toBeGreaterThan(150);
  expect(errors).toEqual([]);
});

test("Inkpurr turns through eight facings; each eye drawing is moved, never squeezed", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors = await review(page, requests);
  for (const [deg, facing, view] of [
    [0, 0, 0],
    [45, 1, 1],
    [90, 2, 2],
    [135, 3, 3],
    [180, 4, 4],
    [225, 5, 3],
    [270, 6, 2],
    [315, 7, 1],
  ]) {
    await draw(page, {
      clock: 1,
      frames: 12,
      angle: facingFor(deg),
      setup: CLEAR,
    });
    const real = (await rigs(page))["shade-0"];
    expect(real.visible).toBe(true);
    expect(real.facing).toBe(facing);
    expect(real.parts.body.frame).toBe(`body_${view}`);
    // the face (eyes, blush and gem in one piece) only for the front, ¾ and side views
    if (view <= 2) {
      expect(real.parts.eyes.frame).toMatch(new RegExp(`^eyes_${view}_`));
      expect(real.parts.mouth.frame).toMatch(new RegExp(`^mouth_${view}_`));
      // never squeezed or skewed: the same scale both ways (only ever mirrored)
      for (const k of ["eyes", "mouth"])
        expect(
          Math.abs(Math.abs(real.parts[k].sx) - Math.abs(real.parts[k].sy)),
        ).toBeLessThan(1e-6);
      // mirrored facings flip the drawing, they do not draw another one
      expect(Math.sign(real.parts.eyes.sx * real.parts.eyes.sy)).toBe(
        deg > 180 ? -1 : 1,
      );
    } else expect(real.parts.eyes).toBeUndefined();
    // its moon tail and its puddle show from every side
    expect(real.parts.tail.frame).toBe(`tail_${view}`);
    expect(real.parts.moon).toBeTruthy();
    expect(real.parts.puddle).toBeTruthy();
    expect(
      Object.values(real.parts).every(
        (p: any) => p.texture === "inkpurr-atlas",
      ),
    ).toBe(true);
    // a dozen images or so for one body
    expect(Object.keys(real.parts).length).toBeLessThanOrEqual(14);
  }
  // nothing painted is loaded for it
  expect(
    requests.some((u) => /raid-(whole|directions)-gloomshade/.test(u)),
  ).toBe(false);
  expect(errors).toEqual([]);
});

test("the face keeps its spacing while the body squashes and stretches", async ({
  page,
}) => {
  const errors = await review(page);
  const face: { eyes: number; mouth: number; body: number }[] = [];
  for (let n = 0; n < 10; n++) {
    await draw(page, {
      clock: 1 + n * 0.09,
      frames: 1,
      angle: facingFor(0),
      setup:
        CLEAR +
        // a lunge wind-up squashes it hard
        `row.state.raid.warnings = [{ id: 7, kind: "lunge", startedAt: 0.5, at: 2, x: boss.x, y: boss.y, tx: boss.x + 400, ty: boss.y, radius: 34 }];`,
    });
    const p = (await rigs(page))["shade-0"].parts;
    face.push({ eyes: p.eyes.y, mouth: p.mouth.y, body: p.body.sy });
  }
  // the body's squash changes...
  expect(
    Math.max(...face.map((f) => f.body)) - Math.min(...face.map((f) => f.body)),
  ).toBeGreaterThan(0.01);
  // ...but eyes and mouth move as one rigid group
  for (const f of face) expect(f.mouth - f.eyes).toBeCloseTo(0, 6);
  expect(errors).toEqual([]);
});

test("its copies are drawn alike; only the real one casts a shadow in lantern light and has a flickering moon", async ({
  page,
}) => {
  const errors = await review(page);
  const SPLIT =
    CLEAR +
    "row.state.raid.decoys = [{ id: 3, x: boss.x - 220, y: boss.y }, { id: 4, x: boss.x + 220, y: boss.y }];";
  // away from every lantern
  await draw(page, {
    clock: 2,
    frames: 1,
    angle: facingFor(30),
    setup: SPLIT + "row.state.raid.lanterns = [];",
  });
  let all = await rigs(page);
  for (const v of Object.values(all) as any[])
    expect(v.parts.shadow).toBeUndefined();
  const alphas: Record<string, number[]> = {};
  for (let n = 0; n < 8; n++) {
    await draw(page, { clock: 2.4 + n * 0.11, frames: 1 });
    for (const [k, v] of Object.entries(await rigs(page)))
      (alphas[k] ??= []).push((v as any).parts.moon?.alpha ?? -1);
  }
  all = await rigs(page);
  expect(Object.keys(all).sort()).toEqual(["shade-0", "shade-3", "shade-4"]);
  for (const v of Object.values(all) as any[]) expect(v.visible).toBe(true);
  // the same pose and pieces on every copy
  // (each body bobs on its own clock, so a paw may be in its other wave drawing)
  const pieces = (k: string) =>
    Object.values(all[k].parts)
      .map((p: any) => p.frame.replace(/_[01]$/, ""))
      .sort()
      .join();
  expect(pieces("shade-3")).toBe(pieces("shade-4"));
  // ...and the real one adds only its drips
  expect(
    pieces("shade-0")
      .split(",")
      .filter((f) => !/^(drips|hangs)_/.test(f))
      .join(),
  ).toBe(pieces("shade-3"));
  // the tell on the tail: the real moon flickers, the copies' hold steady
  expect(
    Math.max(...alphas["shade-0"]) - Math.min(...alphas["shade-0"]),
  ).toBeGreaterThan(0.1);
  for (const k of ["shade-3", "shade-4"])
    expect(new Set(alphas[k]).size).toBe(1);
  // the tell on the floor: in lantern light only the real one casts a shadow
  await draw(page, {
    clock: 3.4,
    frames: 1,
    setup:
      "row.state.raid.lanterns = [{ x: boss.x, y: boss.y - 60, lit: true, hits: 0 }, { x: boss.x - 220, y: boss.y - 60, lit: true, hits: 0 }];",
  });
  all = await rigs(page);
  expect(all["shade-0"].parts.shadow).toBeTruthy();
  expect(all["shade-0"].parts.shadow.alpha).toBeGreaterThan(0.3);
  // a copy standing in light too still has none
  expect(all["shade-3"].parts.shadow).toBeUndefined();
  expect(all["shade-4"].parts.shadow).toBeUndefined();
  await page.screenshot({
    path: test.info().outputPath("inkpurr-copies.png"),
  });
  expect(errors).toEqual([]);
});

test("every attack winds up and follows through with its own pose", async ({
  page,
}) => {
  const errors = await review(page);
  const pose = async (kind: string, at: number, clock: number) => {
    await draw(page, {
      clock,
      frames: 1,
      angle: facingFor(0),
      setup:
        CLEAR +
        `row.state.raid.warnings = [{ id: ${Math.round(clock * 100)}, kind: "${kind}", startedAt: ${clock - 1}, at: ${at}, x: boss.x, y: boss.y, tx: boss.x + 300, ty: boss.y, radius: 120 }];`,
    });
    const p = (await rigs(page))["shade-0"].parts;
    return {
      paws: `${p.pawL.frame}|${p.pawR.frame}`,
      eyes: p.eyes.frame,
      mouth: p.mouth.frame,
    };
  };
  // wind-ups: a hug for the lunge, paws high for the hands, a reach for the snuff,
  // a point for the curse, eyes shut for the pulse, wide eyes for the split
  expect((await pose("lunge", 10, 9.5)).paws).toMatch(/_wrap_/);
  expect((await pose("hands", 20, 19.5)).paws).toMatch(/_up_.*\|.*_up_/);
  expect((await pose("snuff", 30, 29.5)).paws).toMatch(/_sweep_/);
  expect((await pose("curse", 40, 39.5)).paws).toMatch(/_point_/);
  expect((await pose("pulse", 50, 49.5)).eyes).toMatch(/_closed$/);
  expect((await pose("split", 60, 59.5)).eyes).toMatch(/_wide$/);
  expect(errors).toEqual([]);
});

test("found, its core opens with the weak point's ring; staggered it is dizzy; at dawn it melts away", async ({
  page,
}) => {
  const errors = await review(page);
  await draw(page, { clock: 1, frames: 6, angle: facingFor(0), setup: CLEAR });
  expect((await rigs(page))["shade-0"].ring).toBe(0);
  await draw(page, {
    clock: 2,
    frames: 6,
    setup: "row.state.raid.exposedUntil = 99;",
  });
  const open = (await rigs(page))["shade-0"];
  expect(open.ring).toBeGreaterThan(0);
  expect(open.parts.core).toBeTruthy();
  expect(open.parts.eyes.frame).toBe("eyes_0_wide");
  await draw(page, {
    clock: 3,
    frames: 6,
    setup: "row.state.raid.exposedUntil = 0; row.state.raid.staggerUntil = 99;",
  });
  const dizzy = (await rigs(page))["shade-0"];
  expect(dizzy.parts.eyes.frame).toBe("eyes_0_dizzy");
  expect(
    Object.keys(dizzy.parts).filter((k) => k.startsWith("star")),
  ).toHaveLength(3);
  // beaten: it melts through two drawn steps into its puddle, which then fades
  await draw(page, {
    clock: 4,
    frames: 30,
    setup:
      "row.state.raid.staggerUntil = 0; row.state.raid.result = 'victory'; boss.hp = 0;",
  });
  const melting = (await rigs(page))["shade-0"];
  expect(melting.parts.melt1 ?? melting.parts.melt2).toBeTruthy();
  await draw(page, { clock: 5.5, frames: 50 });
  const gone = (await rigs(page))["shade-0"];
  expect(
    Math.max(0, ...Object.values(gone.parts).map((p: any) => p.alpha)) *
      gone.alpha,
  ).toBeLessThan(0.05);
  expect(errors).toEqual([]);
});

test("with reduced motion it holds still: no bob, no flicker", async ({
  page,
}) => {
  const errors = await review(page);
  const looks: string[] = [];
  for (const clock of [1, 1.37, 2.9]) {
    await draw(page, {
      clock,
      frames: 1,
      reduced: true,
      angle: facingFor(45),
      setup: CLEAR,
    });
    const p = (await rigs(page))["shade-0"].parts;
    looks.push(
      JSON.stringify(
        ["body", "eyes", "moon", "tail"].map((k) => [
          p[k].x.toFixed(2),
          p[k].y.toFixed(2),
          p[k].alpha.toFixed(3),
        ]),
      ),
    );
  }
  expect(new Set(looks).size).toBe(1);
  expect(errors).toEqual([]);
});

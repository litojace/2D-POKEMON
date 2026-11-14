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
    const t0 = performance.now();
    prewarmBossAtlas(scene, "gloomshade", 2);
    const ms = Math.round(performance.now() - t0);
    const tex = scene.textures.get("inkpurr-atlas");
    const src = tex.getSourceImage();
    return {
      exists: scene.textures.exists("inkpurr-atlas"),
      ms,
      bytes: src.width * src.height * 4,
      frames: tex.getFrameNames().length,
    };
  }, process.cwd());
  console.log(
    `inkpurr atlas ${(atlas.bytes / 1048576).toFixed(2)} MB, ${atlas.frames} frames, built in ${atlas.ms} ms`,
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

test("its snuff reaches a tendril to the lantern and its lunge leaves an ink streak, with no objects of their own", async ({
  page,
}) => {
  const errors = await review(page);
  const look = (o: {
    warnings: string;
    from: number;
    to: number;
    then?: number;
  }) =>
    page.evaluate((o) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((x: any) => x.id === "gloomshade"),
        boss = row.state.players.find((p: any) => p.raidBoss),
        scene = row.g.scene;
      row.state.raid.decoys = [];
      row.state.raid.lanterns = [
        { x: boss.x - 230, y: boss.y - 40, lit: true, hits: 0 },
      ];
      row.state.raid.warnings = new Function("boss", `return ${o.warnings}`)(
        boss,
      );
      for (let t = o.from; t <= o.to; t += 0.05)
        r.frame(1, t, false, ["gloomshade"]);
      if (o.then !== undefined) {
        row.state.raid.warnings = [];
        for (let t = o.to + 0.05; t <= o.then; t += 0.04)
          r.frame(1, t, false, ["gloomshade"]);
      }
      return {
        commands: row.g.commandBuffer.length,
        // the lunge's existing wind-up art draws from shared pools (the
        // spell flipbook and fx-engine glows); anything else is new
        objects: scene.children.list.filter(
          (c: any) =>
            c.name !== "boss-spell-flipbook" && c.texture?.key !== "fx-glow",
        ).length,
      };
    }, o);
  const base = await look({ warnings: "[]", from: 1, to: 1.2 });
  // halfway through a snuff: the tendril has coiled round the lamp
  const snuff = await look({
    warnings: `[{ id: 801, kind: "snuff", lantern: 0, startedAt: 10, at: 11.5, x: boss.x - 230, y: boss.y - 40, tx: boss.x - 230, ty: boss.y - 40, radius: 150 }]`,
    from: 10,
    to: 11,
  });
  expect(snuff.commands).toBeGreaterThan(base.commands + 20);
  // a lunge just landed: the streak races down its lane
  const lunge = await look({
    warnings: `[{ id: 802, kind: "lunge", startedAt: 20, at: 21.2, x: boss.x + 200, y: boss.y + 60, tx: boss.x - 560, ty: boss.y - 40, radius: 34 }]`,
    from: 20,
    to: 21.15,
    then: 21.32,
  });
  expect(lunge.commands).toBeGreaterThan(base.commands + 10);
  // drawn into the raid's own graphics: no new scene objects
  expect(lunge.objects).toBe(base.objects);
  await page.screenshot({ path: test.info().outputPath("inkpurr-streak.png") });
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

/**
 * Run `body` in the page with the review harness and the raid art at hand:
 * `frame(t, reduced?)` draws one frame of the real art; `count(colour)`
 * counts how often a colour is set in the frame's drawing (each effect
 * piece sets its own colour once), `warn(w, reduced?)` and `yard(reduced?)`
 * add the warnings and the yard as the battle draws them.
 */
const ink = <T>(page: Page, body: string) =>
  page.evaluate(
    async ({ body, root }) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((x: any) => x.id === "gloomshade"),
        boss = row.state.players.find((p: any) => p.raidBoss),
        scene = row.g.scene;
      const art = await import(
        `/@fs${root}/apps/client/src/raid-gloomshade-art.ts`
      );
      const fx = await import(`/@fs${root}/apps/client/src/raid-inkpurr-fx.ts`);
      const engine = await import(`/@fs${root}/apps/client/src/fx-engine.ts`);
      const count = (colour: number) =>
        row.g.commandBuffer.filter((v: number) => v === colour).length;
      const frame = (t: number, reduced = false) =>
        r.frame(1, t, reduced, ["gloomshade"]);
      const warn = (w: any, reduced = false) =>
        art.drawGloomshadeWarning(row.g, row.state, w, reduced);
      const yard = (reduced = false) =>
        art.drawLanternYard(row.g, row.state, reduced);
      const roots = () =>
        Object.fromEntries(
          scene.children.list
            .filter((o: any) => o.name.startsWith("vector-boss-gloomshade:"))
            .map((o: any) => [
              o.name.split(":")[1],
              o.visible && o.alpha > 0.5,
            ]),
        );
      return new Function(
        "r",
        "row",
        "boss",
        "scene",
        "fx",
        "engine",
        "count",
        "frame",
        "warn",
        "yard",
        "roots",
        body,
      )(r, row, boss, scene, fx, engine, count, frame, warn, yard, roots);
    },
    { body, root: process.cwd() },
  ) as Promise<T>;
const INK_SETUP = `
  const s = row.state, raid = s.raid;
  raid.decoys = []; raid.warnings = []; raid.lanterns = [];
  raid.exposedUntil = 0; raid.staggerUntil = 0; raid.revealUntil = 0; raid.result = null;
  boss.hp = Math.max(1, boss.hp);
  const hero = s.players.find((p) => !p.raidBoss);
  hero.x = boss.x - 260; hero.y = boss.y + 40; hero.hp = Math.max(1, hero.hp);
`;

test("its grasping hands rise from every dark tile and grab when they land", async ({
  page,
}) => {
  const errors = await review(page);
  const out = await ink<any>(
    page,
    INK_SETUP +
      `
    const w = { id: 901, kind: "hands", parity: 0, startedAt: 10, at: 11.45, x: 0, y: 0, tx: 0, ty: 0, radius: 0 };
    const dark = 20; // an 8 x 5 board: every other tile
    raid.warnings = [w];
    frame(10.7); warn(w);
    const rising = count(fx.HAND_INK);
    engine.fxFor(scene).density = 0.3;
    frame(10.75); warn(w);
    const low = count(fx.HAND_INK);
    engine.fxFor(scene).density = 1;
    for (let t = 10.8; t < 11.45; t += 0.05) frame(t);
    // it lands: the warning goes, the same tiles' hands close and sink away
    raid.warnings = [];
    frame(11.46);
    const grab = count(fx.HAND_INK);
    for (let t = 11.5; t < 12.4; t += 0.05) frame(t);
    const after = count(fx.HAND_INK);
    return { dark, rising, low, grab, after };
  `,
  );
  expect(out.rising).toBe(out.dark * 2);
  expect(out.low).toBe(out.dark);
  expect(out.grab).toBe(out.dark * 2);
  expect(out.after).toBe(0);
  expect(errors).toEqual([]);
});

test("the curse beams from every body's gem alike, an ink ghost comes down, and ink wisps circle the cursed", async ({
  page,
}) => {
  const errors = await review(page);
  const out = await ink<any>(
    page,
    INK_SETUP +
      `
    raid.decoys = [{ id: 7, x: boss.x + 230, y: boss.y + 20 }, { id: 8, x: boss.x - 40, y: boss.y + 170 }];
    frame(5);
    const w = { id: 902, kind: "curse", targetId: hero.id, startedAt: 6, at: 7.05, x: hero.x, y: hero.y, tx: hero.x, ty: hero.y, radius: 120 };
    raid.warnings = [w];
    frame(6.3);
    const beams = count(0xffe296);
    warn(w);
    const ghost = count(fx.GHOST_INK);
    frame(6.9);
    const late = count(0xffe296);
    raid.warnings = [];
    raid.curses = { [hero.id]: { stacks: 2, hauntedUntil: 0 } };
    frame(7.2); yard();
    const wisps = count(fx.GHOST_INK);
    raid.curses = { [hero.id]: { stacks: 3, hauntedUntil: 20 } };
    frame(7.3); yard();
    const haunted = count(fx.GHOST_INK);
    return { beams, ghost, late, wisps, haunted };
  `,
  );
  // one beam from each of the three bodies, real or copy
  expect(out.beams).toBe(3);
  expect(out.ghost).toBe(1);
  // the beam lasts only the start of the warning
  expect(out.late).toBe(0);
  // a wisp per stack; Haunted: three wisps and the bobbing ghost
  expect(out.wisps).toBe(2);
  expect(out.haunted).toBe(4);
  expect(errors).toEqual([]);
});

test("the pulse rolls out from the real one only once the game shows it; the copies' rings fizzle", async ({
  page,
}) => {
  const errors = await review(page);
  const out = await ink<any>(
    page,
    INK_SETUP +
      `
    raid.decoys = [{ id: 7, x: boss.x + 230, y: boss.y }, { id: 8, x: boss.x - 230, y: boss.y }, { id: 9, x: boss.x, y: boss.y + 180 }];
    frame(5);
    const pulse = (id, t0) => ({ id, kind: "pulse", startedAt: t0, at: t0 + 1.4, x: boss.x, y: boss.y, tx: boss.x, ty: boss.y, radius: 260 });
    const waves = [], fizzles = [];
    // while it is warned: no wave anywhere
    raid.warnings = [pulse(903, 6)];
    for (let t = 6; t < 7.4; t += 0.05) { frame(t); waves.push(count(fx.PULSE_BAND)); }
    // gone, but not shown by the game (no reveal): still none
    raid.warnings = [];
    for (let t = 7.4; t < 7.8; t += 0.05) { frame(t); waves.push(count(fx.PULSE_BAND)); }
    const early = Math.max(...waves);
    // landed and shown: one wave (the real one's), a fizzle on each copy
    raid.warnings = [pulse(904, 8)];
    for (let t = 8; t < 9.4; t += 0.05) frame(t);
    raid.warnings = []; raid.revealUntil = 10.9;
    frame(9.42);
    const wave = count(fx.PULSE_BAND), fizzle = count(fx.FIZZLE);
    for (let t = 9.46; t < 10.4; t += 0.05) frame(t);
    return { early, wave, fizzle, after: count(fx.PULSE_BAND) };
  `,
  );
  expect(out.early).toBe(0);
  expect(out.wave).toBe(1);
  expect(out.fizzle).toBe(3);
  expect(out.after).toBe(0);
  expect(errors).toEqual([]);
});

test("a split throws glossy blobs to every spot, and every body pops up alike as its blob lands", async ({
  page,
}) => {
  const errors = await review(page);
  const out = await ink<any>(
    page,
    INK_SETUP +
      `
    frame(5); frame(5.05);
    // the real one moves to the middle spot; copies left and right
    const x0 = boss.x;
    boss.x = x0 + 20;
    raid.decoys = [{ id: 11, x: x0 - 260, y: boss.y + 30 }, { id: 12, x: x0 + 300, y: boss.y - 20 }];
    const order = [], blobs = [];
    let first;
    for (let n = 0; n < 24; n++) {
      frame(5.1 + n * 0.05);
      blobs.push(count(fx.BLOB_INK));
      const shown = roots();
      const on = Object.keys(shown).filter((k) => shown[k] && !order.includes(k));
      order.push(...on.sort());
    }
    const all = roots();
    return { order, blobs, all };
  `,
  );
  // blobs fly first, then splash
  expect(Math.max(...out.blobs)).toBeGreaterThan(0);
  expect(out.blobs[3]).toBeGreaterThan(0);
  // they pop up left to right across the yard: the real one (in the middle) is never first
  expect(out.order).toEqual(["shade-11", "shade-0", "shade-12"]);
  expect(out.all).toEqual({
    "shade-0": true,
    "shade-11": true,
    "shade-12": true,
  });
  expect(errors).toEqual([]);
});

test("found: the copies vanish in gold bursts; a copy popped by a hit only puffs", async ({
  page,
}) => {
  const errors = await review(page);
  const out = await ink<any>(
    page,
    INK_SETUP +
      `
    raid.decoys = [{ id: 7, x: boss.x + 230, y: boss.y }, { id: 8, x: boss.x - 230, y: boss.y }, { id: 9, x: boss.x, y: boss.y + 180 }];
    frame(5);
    // a hit pops one copy: no gold
    raid.decoys = raid.decoys.slice(1);
    frame(5.05);
    const popped = count(fx.FOUND_GOLD);
    // six in a row: the rest vanish, gold where each copy was and on the real one
    raid.decoys = []; raid.exposedUntil = 10;
    frame(5.1);
    const found = count(fx.FOUND_GOLD);
    for (let t = 5.15; t < 6; t += 0.05) frame(t);
    return { popped, found, after: count(fx.FOUND_GOLD) };
  `,
  );
  expect(out.popped).toBe(0);
  // each burst sets the gold twice (its glow and its ring): two copies and the real one
  expect(out.found).toBe(6);
  expect(out.after).toBe(0);
  expect(errors).toEqual([]);
});

test("its effects thin out on Low graphics and hold still with reduced motion", async ({
  page,
}) => {
  const errors = await review(page);
  const out = await ink<any>(
    page,
    INK_SETUP +
      `
    const w = { id: 905, kind: "hands", parity: 1, startedAt: 10, at: 11.45, x: 0, y: 0, tx: 0, ty: 0, radius: 0 };
    raid.curses = { [hero.id]: { stacks: 3, hauntedUntil: 99 } };
    const look = (t, reduced) => { frame(t, reduced); warn(w, reduced); yard(reduced); return row.g.commandBuffer.length; };
    raid.warnings = [w];
    const high = look(11, false);
    engine.fxFor(scene).density = 0.3;
    const low = look(11, false);
    engine.fxFor(scene).density = 1;
    // (the warning's own fill follows its timer; everything else holds)
    const buf = (t) => { frame(t, true); yard(true); return JSON.stringify(Array.from(row.g.commandBuffer)); };
    return { high, low, same: buf(11.2) === buf(11.27) };
  `,
  );
  expect(out.low).toBeLessThan(out.high * 0.7);
  expect(out.same).toBe(true);
  expect(errors).toEqual([]);
});

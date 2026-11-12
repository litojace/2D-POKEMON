import { expect, test, type Page } from "@playwright/test";

// Gloomshade is vector art (boss-vector-gloom.ts, boss-vector-gloom-rig.ts),
// like Grumblecrag and Tidewyrm: its pieces are drawn once per phase into one
// atlas and posed every frame. It splits into copies: each body has a rig of
// its own, and only the real one shows the two tells.
async function review(page: Page, requests: string[]) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
/** Set Gloomshade's state and draw it for `frames` frames from `clock`. */
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
      const out = [];
      for (let n = 0; n < frames; n++) {
        r.frame(phase, clock + n * 0.05, reduced, ["gloomshade"]);
        out.push(row.g.commandBuffer.length);
      }
      return out;
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
/** Every Gloomshade body's rig: its root and visible image parts. */
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
  "row.state.raid.exposedUntil = 0; row.state.raid.staggerUntil = 0;";

test("Gloomshade turns through eight facings, its face drawn for each view", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors = await review(page, requests);
  for (const [deg, facing] of [
    [0, 0],
    [45, 1],
    [90, 2],
    [135, 3],
    [180, 4],
    [270, 6],
    [315, 7],
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
    const eyes = Object.entries(real.parts).filter(([k]) =>
      /^eye[nf]$/.test(k),
    );
    // never squeezed: only ever mirrored
    for (const [, e] of eyes as [string, any][])
      expect(Math.abs(Math.abs(e.sx) - Math.abs(e.sy))).toBeLessThan(1e-6);
    const frames = eyes.map(([, e]: [string, any]) => e.frame).sort();
    if (deg === 0) expect(frames).toEqual(["eye_front_idle", "eye_front_idle"]);
    if (deg === 45 || deg === 315)
      expect(frames).toEqual(["eye_far_idle", "eye_near_idle"]);
    if (deg === 90 || deg === 270) expect(frames).toEqual(["eye_side_idle"]);
    if (deg === 135 || deg === 180) expect(frames).toEqual([]);
    // the crescent moon on its tail and its gem show from every side
    expect(real.parts.moon).toBeTruthy();
    expect(
      Object.values(real.parts).every(
        (p: any) => p.texture === "vgloom-atlas-1",
      ),
    ).toBe(true);
  }
  // nothing painted is loaded for it
  expect(
    requests.some((u) => /raid-(whole|directions)-gloomshade/.test(u)),
  ).toBe(false);
  await page.screenshot({ path: test.info().outputPath("gloomshade-315.png") });
  expect(errors).toEqual([]);
});

test("its copies are drawn alike; only the real one casts a shadow in lantern light and has a flickering moon", async ({
  page,
}) => {
  const errors = await review(page, []);
  const SPLIT =
    CLEAR +
    "row.state.raid.decoys = [{ id: 3, x: boss.x - 220, y: boss.y }, { id: 4, x: boss.x + 220, y: boss.y }];";
  // away from every lantern
  const unlit = await draw(page, {
    clock: 2,
    frames: 1,
    angle: facingFor(30),
    setup: SPLIT + "row.state.raid.lanterns = [];",
  });
  const alphas: Record<string, number[]> = {};
  for (let n = 0; n < 8; n++) {
    await draw(page, { clock: 2.4 + n * 0.11, frames: 1 });
    const all = await rigs(page);
    for (const [k, v] of Object.entries(all))
      (alphas[k] ??= []).push((v as any).parts.moon?.alpha ?? -1);
  }
  const all = await rigs(page);
  expect(Object.keys(all).sort()).toEqual(["shade-0", "shade-3", "shade-4"]);
  for (const v of Object.values(all) as any[]) expect(v.visible).toBe(true);
  // the same pose and pieces on every body
  const pieces = (k: string) =>
    Object.values(all[k].parts)
      .map((p: any) => p.frame)
      .sort()
      .join();
  expect(pieces("shade-3")).toBe(pieces("shade-4"));
  // the tell on the tail: the real moon flickers, the copies' hold steady
  expect(
    Math.max(...alphas["shade-0"]) - Math.min(...alphas["shade-0"]),
  ).toBeGreaterThan(0.1);
  for (const k of ["shade-3", "shade-4"])
    expect(new Set(alphas[k])).toEqual(new Set([1]));
  // the tell on the floor: in lantern light the real one casts a shadow
  const lit = await draw(page, {
    clock: 3.4,
    frames: 1,
    setup:
      "row.state.raid.lanterns = [{ x: boss.x, y: boss.y - 60, lit: true, hits: 0 }];",
  });
  expect(lit[0]).toBeGreaterThan(unlit[0]);
  await page.screenshot({
    path: test.info().outputPath("gloomshade-copies.png"),
  });
  expect(errors).toEqual([]);
});

test("found, its core opens with the weak point's ring; staggered it is dizzy; at dawn it fades away", async ({
  page,
}) => {
  const errors = await review(page, []);
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
  expect(open.parts.eyen.frame).toBe("eye_front_wide");
  await draw(page, {
    clock: 3,
    frames: 6,
    setup: "row.state.raid.exposedUntil = 0; row.state.raid.staggerUntil = 99;",
  });
  const dizzy = (await rigs(page))["shade-0"];
  expect(dizzy.parts.eyen.frame).toBe("eye_front_dizzy");
  expect(
    Object.keys(dizzy.parts).filter((k) => k.startsWith("star")),
  ).toHaveLength(3);
  // beaten: eyes shut, and it fades out over a couple of seconds
  await draw(page, {
    clock: 4,
    frames: 60,
    setup:
      "row.state.raid.staggerUntil = 0; row.state.raid.result = 'victory'; boss.hp = 0;",
  });
  const gone = (await rigs(page))["shade-0"];
  expect(gone.alpha).toBeLessThan(0.05);
  expect(gone.parts.eyen.frame).toBe("eye_front_closed");
  expect(errors).toEqual([]);
});

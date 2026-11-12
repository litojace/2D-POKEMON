import { expect, test, type Page } from "@playwright/test";

// Prismatail is vector art (boss-vector-prisma.ts, boss-vector-prisma-rig.ts),
// like Grumblecrag and Tidewyrm: its pieces are drawn once per phase into one
// atlas and posed every frame from the battle's own state.
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
/** Set Prismatail's state and draw it for `frames` frames from `clock`. */
const draw = (
  page: Page,
  o: {
    phase?: number;
    clock: number;
    frames?: number;
    step?: number;
    angle?: number;
    reduced?: boolean;
    setup?: string;
  },
) =>
  page.evaluate(
    ({ phase, clock, frames, step, angle, reduced, setup }) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((x: any) => x.id === "prismatail"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (angle !== undefined) boss.angle = angle;
      if (setup) new Function("row", "boss", setup)(row, boss);
      for (let n = 0; n < frames; n++)
        r.frame(phase, clock + n * step, reduced, ["prismatail"]);
    },
    {
      phase: o.phase ?? 1,
      clock: o.clock,
      frames: o.frames ?? 1,
      step: o.step ?? 0.05,
      angle: o.angle,
      reduced: o.reduced ?? false,
      setup: o.setup,
    },
  );
const rig = (page: Page) =>
  page.evaluate(() => {
    const r = (window as any).__bossReview,
      scene = r.rows[0].g.scene,
      root = scene.children.list.find(
        (o: any) => o.name === "vector-boss-prismatail",
      );
    const parts: Record<string, any> = {};
    // the body (root.list[0]) and its glows (root.list[1]); images only
    for (const o of root?.list.flatMap((c: any) => c.list ?? []) ?? [])
      if (o.visible && o.type === "Image")
        parts[o.name.replace("vector-part-", "")] = {
          x: o.x,
          y: o.y,
          rotation: o.rotation,
          alpha: o.alpha,
          frame: o.frame.name,
          texture: o.texture.key,
        };
    const front = root?.list.find((o: any) => o.name === "vector-boss-front");
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      // the front layer: the open heart's ring (a circle) or the shield (an ellipse)
      front: front?.commandBuffer.length ?? -1,
      parts,
      textures: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("vprisma-")),
      painted: r.game.textures
        .getTextureKeys()
        .filter(
          (k: string) => k.startsWith("raid-") && k.includes("prismatail"),
        ),
    };
  });
const ids = (parts: Record<string, any>, re: RegExp) =>
  Object.keys(parts).filter((id) => re.test(id));

test("Prismatail is drawn as vector art from the battle's own state, in eight facings", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors = await review(page, requests);
  await draw(page, { clock: 0, angle: Math.PI / 2, frames: 3 });
  const front = await rig(page);
  expect(front.visible).toBe(true);
  // No painted atlas is downloaded or kept for it.
  expect(front.painted).toEqual([]);
  expect(
    requests.filter((u) => /raid-(whole|directions)-prismatail/.test(u)),
  ).toEqual([]);
  // A whole peacock from one atlas: its train, body, neck, head and crown.
  expect(ids(front.parts, /^shard\d$/)).toHaveLength(9);
  for (const id of ["body", "brooch", "crown", "head", "wing-1", "wing1"])
    expect(front.parts[id], id).toBeTruthy();
  expect(front.parts.head.frame).toBe("head_front");
  expect(
    Object.values(front.parts).every(
      (p: any) => p.texture === "vprisma-atlas-1",
    ),
  ).toBe(true);
  // Front: both almond eyes and the beak face the camera.
  expect(front.facing).toBe(0);
  expect(front.parts.eyen && front.parts.eyef).toBeTruthy();
  expect(front.parts.beak.frame).toBe("beak_front_closed");

  // Eight facings, one per 45°: 0 towards the camera, 2 screen right, 4 away.
  const seen: number[] = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i * Math.PI) / 4;
    await draw(page, { clock: 1 + i, angle: Math.PI / 2 - yaw, frames: 6 });
    seen.push((await rig(page)).facing);
  }
  expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  // Screen right: the head in profile, its beak out ahead of the body.
  await draw(page, { clock: 10, angle: 0, frames: 8 });
  const right = await rig(page);
  expect(right.facing).toBe(2);
  expect(right.parts.head.frame).toBe("head_side");
  expect(right.parts.beak.x).toBeGreaterThan(right.parts.body.x);
  expect(ids(right.parts, /^eye[nf]$/)).toEqual(["eyen"]);
  // Three-quarter: a near and a far eye, the far one tucked behind the beak.
  await draw(page, { clock: 11, angle: Math.PI / 4, frames: 8 });
  const tq = await rig(page);
  expect(tq.parts.eyef.frame).toMatch(/^eye_far_/);
  // Screen left mirrors it.
  await draw(page, { clock: 13, angle: Math.PI, frames: 8 });
  const left = await rig(page);
  expect(left.facing).toBe(6);
  expect(left.parts.beak.x).toBeLessThan(left.parts.body.x);
  // From behind, no face; the crown still rides its head.
  await draw(page, { clock: 14, angle: -Math.PI / 2, frames: 8 });
  const back = await rig(page);
  expect(back.facing).toBe(4);
  expect(ids(back.parts, /^(eye|beak|brow)/)).toEqual([]);
  expect(back.parts.crown && back.parts.head).toBeTruthy();
  expect(errors).toEqual([]);
});

test("phases keep one atlas at a time; the train lights Fan Display's colour", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, { clock: 0, angle: Math.PI / 2, frames: 3 });
  expect((await rig(page)).textures).toEqual(["vprisma-atlas-1"]);
  await draw(page, { phase: 2, clock: 1, frames: 4 });
  const two = await rig(page);
  expect(two.textures).toEqual(["vprisma-atlas-2"]);
  expect(two.parts.body.texture).toBe("vprisma-atlas-2");
  await draw(page, { phase: 3, clock: 2, frames: 4 });
  await draw(page, { phase: 1, clock: 3, frames: 4 });
  await draw(page, { phase: 3, clock: 4, frames: 4 });
  expect((await rig(page)).textures).toEqual(["vprisma-atlas-3"]);

  // Fan Display wound up: the fan spreads wide and the train shines.
  // (after the cry at the last phase change: its clock runs by drawn frames)
  await draw(page, { phase: 1, clock: 8, frames: 40 });
  const calm = await rig(page);
  await draw(page, {
    phase: 1,
    clock: 10.2,
    frames: 24,
    setup:
      "row.state.raid.warnings = [{ id: 7, kind: 'fan-display', startedAt: 10.2, at: 11.65, x: boss.x, y: boss.y, tx: boss.x, ty: boss.y, radius: 650, prismIndex: 2, prismCount: 6 }]",
  });
  const fan = await rig(page);
  // (the shards all hang from one root: half the fan is the angle from the
  // middle shard to the end one)
  const spread = (r: typeof fan) =>
    Math.abs(
      Math.atan2(
        Math.sin(r.parts.shard0.rotation - r.parts.shard4.rotation),
        Math.cos(r.parts.shard0.rotation - r.parts.shard4.rotation),
      ),
    );
  expect(spread(fan)).toBeGreaterThan(spread(calm) + 0.2);
  expect(ids(fan.parts, /^shine\d$/).length).toBeGreaterThan(0);
  // the train's glows stay few (they are drawn per pixel)
  expect(ids(fan.parts, /^shine\d$/).length).toBeLessThanOrEqual(5);
  expect(errors).toEqual([]);
});

test("a light relay opens its heart with the ring; staggered it reels; defeated it fades", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, { clock: 0, frames: 10 });
  const calm = await rig(page);
  // closed: the crystal shield stands over the heart (one ellipse)
  expect(calm.front).toBeGreaterThan(0);
  const shield = calm.front;

  await draw(page, {
    clock: 1,
    frames: 10,
    setup: "row.state.raid.exposedUntil = 99",
  });
  const open = await rig(page);
  // open: startled wide eyes and the weak point's ring (a filled circle and its edge)
  expect(open.parts.eyen.frame).toMatch(/_wide$/);
  expect(open.front).not.toBe(shield);
  expect(open.parts.brooch).toBeTruthy();

  await draw(page, {
    clock: 2,
    frames: 10,
    setup: "row.state.raid.exposedUntil = 0; row.state.raid.staggerUntil = 99",
  });
  const dizzy = await rig(page);
  expect(dizzy.parts.eyen.frame).toMatch(/_dizzy$/);
  expect(ids(dizzy.parts, /^star\d$/)).toHaveLength(3);

  await draw(page, {
    clock: 3,
    frames: 80,
    setup:
      'row.state.raid.staggerUntil = 0; row.state.raid.result = "victory"; boss.hp = 0',
  });
  const down = await rig(page);
  expect(down.front).toBe(0);
  // eyes closed, the head lowered, the whole bird dim
  expect(down.parts.eyen.frame).toMatch(/_closed$/);
  expect(down.parts.head.y).toBeGreaterThan(calm.parts.head.y + 20);
  expect(down.parts.body.alpha).toBeLessThan(0.8);
  expect(ids(down.parts, /^shine/)).toEqual([]);
  expect(errors).toEqual([]);
});

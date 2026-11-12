import { expect, test, type Page } from "@playwright/test";

// Emberwing is vector art (boss-vector-ember.ts, boss-vector-ember-rig.ts),
// like Tidewyrm (vector-tide.spec.ts): its pieces are drawn once per phase
// into one atlas and posed every frame. It flies and lands.
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
/** Set Emberwing's state and draw it for `frames` frames from `clock`. */
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
        row = r.rows.find((x: any) => x.id === "emberwing"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (angle !== undefined) boss.angle = angle;
      if (setup) new Function("row", "boss", setup)(row, boss);
      for (let n = 0; n < frames; n++)
        r.frame(phase, clock + n * step, reduced, ["emberwing"]);
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
        (o: any) => o.name === "vector-boss-emberwing",
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
          tint: o.tintTopLeft,
        };
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      // the open heart's ring (drawn commands on the front layer)
      ring:
        root?.list.find((o: any) => o.name === "vector-boss-front")
          ?.commandBuffer.length ?? -1,
      parts,
      textures: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("vember-")),
      painted: r.game.textures
        .getTextureKeys()
        .filter(
          (k: string) => k.startsWith("raid-") && k.includes("emberwing"),
        ),
    };
  });
const ids = (parts: Record<string, any>, re: RegExp) =>
  Object.keys(parts).filter((id) => re.test(id));
const AIRBORNE = "row.state.raid.airborne = true";

test("Emberwing is drawn as vector art in eight facings, flying and landed", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors = await review(page, requests);
  await draw(page, {
    clock: 0,
    angle: Math.PI / 2,
    frames: 30,
    setup: AIRBORNE,
  });
  const front = await rig(page);
  expect(front.visible).toBe(true);
  // No painted atlas is downloaded or kept for it.
  expect(front.painted).toEqual([]);
  expect(
    requests.filter((u) => /raid-(whole|directions)-emberwing/.test(u)),
  ).toEqual([]);
  // A whole phoenix from one atlas: body, chest, both wings, five tail
  // plumes, legs and a head.
  expect(front.parts.body && front.parts.chest).toBeTruthy();
  expect(front.parts.wing1 && front.parts["wing-1"]).toBeTruthy();
  expect(ids(front.parts, /^plume/)).toHaveLength(5);
  expect(front.parts["f-head"].frame).toBe("head_front");
  expect(
    Object.values(front.parts).every(
      (p: any) => p.texture === "vember-atlas-1",
    ),
  ).toBe(true);
  // Front: both eyes, each its front drawing.
  expect(front.facing).toBe(0);
  expect([front.parts["f-eyen"].frame, front.parts["f-eyef"].frame]).toEqual([
    "eye_front_idle",
    "eye_front_idle",
  ]);

  // Eight facings, one per 45°: 0 towards the camera, 2 screen right, 4 away.
  const seen: number[] = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i * Math.PI) / 4;
    await draw(page, { clock: 2 + i, angle: Math.PI / 2 - yaw, frames: 8 });
    seen.push((await rig(page)).facing);
  }
  expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  // Three-quarter: the near and the far eye, each its own drawing.
  await draw(page, { clock: 11, angle: Math.PI / 4, frames: 8 });
  const tq = await rig(page);
  expect(tq.facing).toBe(1);
  expect([tq.parts["f-eyen"].frame, tq.parts["f-eyef"].frame].sort()).toEqual([
    "eye_far_idle",
    "eye_near_idle",
  ]);
  // In profile the beak points the way it faces.
  await draw(page, { clock: 12, angle: 0, frames: 8 });
  const right = await rig(page);
  expect(right.facing).toBe(2);
  expect(right.parts["f-head"].frame).toBe("head_side");
  expect(right.parts["f-beak"].x).toBeGreaterThan(right.parts.body.x);
  await draw(page, { clock: 13, angle: Math.PI, frames: 8 });
  const left = await rig(page);
  expect(left.facing).toBe(6);
  expect(left.parts["f-beak"].x).toBeLessThan(left.parts.body.x);
  // From behind, no eyes.
  await draw(page, { clock: 14, angle: -Math.PI / 2, frames: 8 });
  const back = await rig(page);
  expect(back.facing).toBe(4);
  expect(ids(back.parts, /^f-eye/)).toEqual([]);
  expect(back.parts["f-head"].frame).toBe("head_back");

  // Landing: it comes down onto its legs, wings folded.
  await draw(page, { clock: 15, angle: Math.PI / 2, frames: 6 });
  const flying = await rig(page);
  await draw(page, {
    clock: 15.3,
    frames: 30,
    setup: "row.state.raid.airborne = false",
  });
  const landed = await rig(page);
  expect(landed.parts["f-head"].y).toBeGreaterThan(
    flying.parts["f-head"].y + 20,
  );
  expect(landed.parts.leg1.y).toBeGreaterThan(flying.parts.leg1.y + 20);
  expect(errors).toEqual([]);
});

test("phases keep one atlas at a time; each attack winds up and follows through", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, {
    clock: 0,
    angle: Math.PI / 2,
    frames: 6,
    setup: AIRBORNE,
  });
  const calm = await rig(page);
  expect(calm.textures).toEqual(["vember-atlas-1"]);
  // phase 2 brings its fire aura
  expect(calm.parts.aura).toBeUndefined();
  await draw(page, { phase: 2, clock: 1, frames: 4 });
  const two = await rig(page);
  expect(two.textures).toEqual(["vember-atlas-2"]);
  expect(two.parts.aura).toBeTruthy();
  await draw(page, { phase: 3, clock: 2, frames: 4 });
  await draw(page, { phase: 1, clock: 3, frames: 4 });
  await draw(page, { phase: 3, clock: 4, frames: 4 });
  const three = await rig(page);
  expect(three.textures).toEqual(["vember-atlas-3"]);
  expect(
    Object.values(three.parts).every(
      (p: any) => p.texture === "vember-atlas-3",
    ),
  ).toBe(true);

  // Dive Bomb: it climbs and glares as the lane fills...
  await draw(page, { clock: 5, frames: 6 });
  const before = await rig(page);
  await draw(page, {
    clock: 5.3,
    frames: 16,
    setup:
      "row.state.raid.warnings = [{ id: 7, kind: 'dive-bomb', startedAt: 5.3," +
      " at: 6.3, x: boss.x, y: boss.y, tx: boss.x + 400, ty: boss.y, radius: 60 }]",
  });
  const climbing = await rig(page);
  expect(climbing.parts.body.y).toBeLessThan(before.parts.body.y - 10);
  expect(climbing.parts["f-eyen"].frame).toMatch(/_glare$/);
  // ...then dives, beak open.
  await draw(page, {
    clock: 6.35,
    frames: 6,
    setup: "row.state.raid.warnings = []",
  });
  const diving = await rig(page);
  expect(diving.parts["f-beak"].frame).toMatch(/_open$/);
  for (const p of Object.values(diving.parts) as any[])
    for (const n of [p.x, p.y, p.rotation, p.alpha])
      expect(Number.isFinite(n)).toBe(true);
  expect(errors).toEqual([]);
});

test("grounded by the braziers it is dazed with its heart open; beaten it falls to ash", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, {
    clock: 0,
    angle: Math.PI / 2,
    frames: 20,
    setup: AIRBORNE,
  });
  const flying = await rig(page);
  expect(flying.ring).toBe(0);
  // The braziers bring it down: on the ground, dizzy, the heart's ring shows.
  await draw(page, {
    clock: 1,
    frames: 24,
    setup:
      "row.state.raid.airborne = false; row.state.raid.exposedUntil = row.state.time + 99",
  });
  const dazed = await rig(page);
  expect(dazed.ring).toBeGreaterThan(0);
  expect(dazed.parts["f-head"].y).toBeGreaterThan(
    flying.parts["f-head"].y + 20,
  );
  expect(dazed.parts["f-eyen"].frame).toBe("eye_front_dizzy");
  expect(ids(dazed.parts, /^star/)).toHaveLength(3);
  // Beaten: eyes shut, no ring, and it fades to grey ash.
  await draw(page, {
    clock: 3,
    frames: 70,
    setup: 'row.state.raid.result = "victory"; boss.hp = 0',
  });
  const dead = await rig(page);
  expect(dead.ring).toBe(0);
  expect(dead.parts["f-eyen"].frame).toBe("eye_front_closed");
  expect(dead.parts.body.alpha).toBeLessThan(0.4);
  expect(dead.parts.body.tint).not.toBe(0xffffff);
  expect(errors).toEqual([]);
});

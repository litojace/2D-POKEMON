import { expect, test, type Page } from "@playwright/test";

// Somnara is vector art (boss-vector-somnara.ts, boss-vector-somnara-rig.ts),
// like Tidewyrm (vector-tide.spec.ts): its pieces are drawn once per phase into
// one atlas and posed every frame.
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
/** Set Somnara's state and draw it for `frames` frames from `clock`. */
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
        row = r.rows.find((x: any) => x.id === "somnara"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (angle !== undefined) boss.angle = angle;
      if (setup) new Function("row", "boss", setup)(row, boss);
      for (let n = 0; n < frames; n++)
        r.frame(phase, clock + n * step, reduced, ["somnara"]);
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
        (o: any) => o.name === "vector-boss-somnara",
      );
    const parts: Record<string, any> = {};
    // the body (root.list[0]) and its glows (root.list[1]); images only
    for (const o of root?.list.flatMap((c: any) => c.list ?? []) ?? [])
      if (o.visible && o.type === "Image")
        parts[o.name.replace("vector-part-", "")] = {
          x: o.x,
          y: o.y,
          sx: o.scaleX,
          alpha: o.alpha,
          frame: o.frame.name,
          texture: o.texture.key,
          tint: o.tintTopLeft,
        };
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      view: root?.getData("view"),
      // the exposed weak point's ring (drawn commands on the front layer)
      ring:
        root?.list.find((o: any) => o.name === "vector-boss-front")
          ?.commandBuffer.length ?? -1,
      parts,
      textures: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("vsom-")),
      painted: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("raid-") && k.includes("somnara")),
    };
  });
const ids = (parts: Record<string, any>, re: RegExp) =>
  Object.keys(parts).filter((id) => re.test(id));

test("Somnara is drawn as vector art from the battle's own state, in eight facings", async ({
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
    requests.filter((u) => /raid-(whole|directions)-somnara/.test(u)),
  ).toEqual([]);
  // A whole whale from one atlas: one smooth body, the fluke, two flippers,
  // the cottage and nightcap on its back, and the head.
  expect(ids(front.parts, /^spine\d+$/).length).toBe(18);
  for (const part of ["fluke", "flip-1", "flip1", "cottage", "cap", "head"])
    expect(front.parts[part]).toBeTruthy();
  expect(
    Object.values(front.parts).every((p: any) => p.texture === "vsom-atlas-1"),
  ).toBe(true);
  // Front: asleep, both eyes closed in a smiling curve.
  expect(front.facing).toBe(0);
  expect(front.view).toBe("front");
  expect(front.parts.eyen.frame).toBe("eye_front_idle");
  expect(front.parts.eyef.frame).toBe("eye_front_idle");
  expect(front.parts.mouth.frame).toBe("mouth_front_smile");

  // Eight facings, one per 45°: 0 towards the camera, 2 screen right, 4 away.
  const seen: number[] = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i * Math.PI) / 4;
    await draw(page, { clock: 1 + i, angle: Math.PI / 2 - yaw, frames: 12 });
    seen.push((await rig(page)).facing);
  }
  expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  // Facing screen right: in profile, one eye, the head out ahead of the fluke.
  await draw(page, { clock: 10, angle: 0, frames: 12 });
  const right = await rig(page);
  expect(right.facing).toBe(2);
  expect(right.view).toBe("side");
  expect(right.parts.head.frame).toBe("head_side");
  expect(ids(right.parts, /^eye[nf]$/)).toEqual(["eyen"]);
  expect(right.parts.head.x).toBeGreaterThan(right.parts.fluke.x);
  // Screen left mirrors it.
  await draw(page, { clock: 11, angle: Math.PI, frames: 12 });
  const left = await rig(page);
  expect(left.facing).toBe(6);
  expect(left.parts.head.x).toBeLessThan(left.parts.fluke.x);
  expect(Math.sign(left.parts.head.sx)).toBe(-Math.sign(right.parts.head.sx));
  // From behind, no face.
  await draw(page, { clock: 12, angle: -Math.PI / 2, frames: 12 });
  const back = await rig(page);
  expect(back.facing).toBe(4);
  expect(back.parts.head.frame).toBe("head_back");
  expect(ids(back.parts, /^(eye|mouth)/)).toEqual([]);
  expect(errors).toEqual([]);
});

test("phases keep one atlas at a time; attacks wind up and follow through", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, { clock: 0, angle: Math.PI / 2, frames: 3 });
  expect((await rig(page)).textures).toEqual(["vsom-atlas-1"]);
  await draw(page, { phase: 2, clock: 1, frames: 4 });
  const two = await rig(page);
  expect(two.textures).toEqual(["vsom-atlas-2"]);
  expect(two.parts.spine5.texture).toBe("vsom-atlas-2");
  await draw(page, { phase: 3, clock: 2, frames: 4 });
  await draw(page, { phase: 1, clock: 3, frames: 4 });
  await draw(page, { phase: 3, clock: 4, frames: 4 });
  const three = await rig(page);
  // Only the current phase's atlas is kept, whatever phases were seen.
  expect(three.textures).toEqual(["vsom-atlas-3"]);
  expect(
    Object.values(three.parts).every((p: any) => p.texture === "vsom-atlas-3"),
  ).toBe(true);

  // (let the yawn into phase 3 pass)
  await draw(page, { phase: 3, clock: 5, frames: 30 });
  // A lullaby wound up: an "o" mouth and notes drifting up from it.
  let id = 7;
  const warn = (kind: string, at: number) =>
    `row.state.raid.warnings = [{ id: ${id++}, kind: "${kind}", startedAt: ${at - 1.4}, at: ${at}, x: boss.x, y: boss.y, tx: boss.x + 200, ty: boss.y, radius: 85 }]`;
  await draw(page, {
    phase: 3,
    clock: 7,
    frames: 12,
    setup: warn("lullaby", 7.65),
  });
  const lull = await rig(page);
  expect(lull.parts.mouth.frame).toBe("mouth_front_o");
  expect(ids(lull.parts, /^note\d$/).length).toBeGreaterThan(0);
  // Falling stars: wide awake, looking up.
  await draw(page, {
    phase: 3,
    clock: 8,
    frames: 12,
    setup: warn("falling-stars", 8.75),
  });
  expect((await rig(page)).parts.eyen.frame).toBe("eye_front_wide");
  // A dream: drowsy-eyed, its nightcap's bobble aglow.
  await draw(page, {
    phase: 3,
    clock: 10,
    frames: 30,
    setup:
      "row.state.raid.warnings = []; row.state.raid.dream = { id: 1, dreamerId: 'hero', runes: [], until: 99 }",
  });
  const dream = await rig(page);
  expect(dream.parts.eyen.frame).toBe("eye_front_glare");
  expect(dream.parts.bobble).toBeTruthy();
  expect(errors).toEqual([]);
});

test("woken it shows its star-heart and ring; staggered it is dizzy; beaten it sinks asleep", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, { clock: 0, angle: Math.PI / 4, frames: 12 });
  const calm = await rig(page);
  expect(calm.ring).toBe(0);
  expect(calm.parts.core).toBeUndefined();

  await draw(page, {
    clock: 1,
    frames: 12,
    setup: "row.state.raid.exposedUntil = 99",
  });
  const woke = await rig(page);
  expect(woke.ring).toBeGreaterThan(0);
  expect(woke.parts.core).toBeTruthy();
  expect(woke.parts.eyen.frame).toBe("eye_near_wide");
  // the star-heart is on its throat, below the head
  expect(woke.parts.core.y).toBeGreaterThan(woke.parts.head.y);

  await draw(page, {
    clock: 2,
    frames: 12,
    setup: "row.state.raid.exposedUntil = 0; row.state.raid.staggerUntil = 99",
  });
  const dizzy = await rig(page);
  expect(dizzy.ring).toBeGreaterThan(0);
  expect(dizzy.parts.eyen.frame).toBe("eye_near_dizzy");
  expect(ids(dizzy.parts, /^star\d$/)).toHaveLength(3);

  await draw(page, {
    clock: 3,
    frames: 12,
    setup: "row.state.raid.staggerUntil = 0",
  });
  const up = await rig(page);
  await draw(page, {
    clock: 4,
    frames: 50,
    setup: 'row.state.raid.result = "victory"; boss.hp = 0',
  });
  const asleep = await rig(page);
  expect(asleep.visible).toBe(true);
  expect(asleep.ring).toBe(0);
  expect(asleep.parts.eyen.frame).toBe("eye_near_closed");
  // it sinks, greyed, and stays whole (no see-through fading pieces)
  expect(asleep.parts.head.y).toBeGreaterThan(up.parts.head.y + 15);
  expect(asleep.parts.head.tint).toBe(0x9b97a0);
  expect(asleep.parts.head.alpha).toBe(1);
  expect(errors).toEqual([]);
});

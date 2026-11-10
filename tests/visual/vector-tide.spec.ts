import { expect, test, type Page } from "@playwright/test";

// Tidewyrm is vector art (boss-vector-tide.ts, boss-vector-tide-rig.ts), like
// Grumblecrag (vector-boss.spec.ts): its pieces are drawn once per phase into
// one atlas and posed every frame, cropped at the waterline.
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
/** Set Tidewyrm's state and draw it for `frames` frames from `clock`. */
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
        row = r.rows.find((x: any) => x.id === "tidewyrm"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (angle !== undefined) boss.angle = angle;
      if (setup) new Function("row", "boss", setup)(row, boss);
      for (let n = 0; n < frames; n++)
        r.frame(phase, clock + n * step, reduced, ["tidewyrm"]);
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
/** Strand it: exposed, with an island's sand right under it. */
const STRAND =
  "row.state.raid.exposedUntil = 99;" +
  "row.state.raid.islands = [{ x: boss.x, y: boss.y, radius: 220, sunk: false }]";
const rig = (page: Page) =>
  page.evaluate(() => {
    const r = (window as any).__bossReview,
      scene = r.rows[0].g.scene,
      root = scene.children.list.find(
        (o: any) => o.name === "vector-boss-tidewyrm",
      );
    const parts: Record<string, any> = {};
    // the body (root.list[0]) and its glows (root.list[1]); images only
    for (const o of root?.list.flatMap((c: any) => c.list ?? []) ?? [])
      if (o.visible && o.type === "Image")
        parts[o.name.replace("vector-part-", "")] = {
          x: o.x,
          y: o.y,
          alpha: o.alpha,
          frame: o.frame.name,
          cropped: o.isCropped,
          texture: o.texture.key,
        };
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      // the exposed weak point's ring (drawn commands on the front layer)
      ring:
        root?.list.find((o: any) => o.name === "vector-boss-front")
          ?.commandBuffer.length ?? -1,
      parts,
      textures: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("vtide-")),
      painted: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("raid-") && k.includes("tidewyrm")),
    };
  });
const ids = (parts: Record<string, any>, re: RegExp) =>
  Object.keys(parts).filter((id) => re.test(id));

test("Tidewyrm is drawn as vector art from the battle's own state, in eight facings", async ({
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
    requests.filter((u) => /raid-(whole|directions)-tidewyrm/.test(u)),
  ).toEqual([]);
  // A whole serpent from one atlas: its body segments (a few tail coils are
  // under the water) and a head.
  expect(ids(front.parts, /^seg\d+$/).length).toBeGreaterThan(20);
  expect(front.parts.cran && front.parts.jaw && front.parts.snout).toBeTruthy();
  expect(
    Object.values(front.parts).every((p: any) => p.texture === "vtide-atlas-1"),
  ).toBe(true);
  // Front: both slit eyes and the pearl on its crown face the camera.
  expect(front.facing).toBe(0);
  expect(front.parts["eye-1"] && front.parts.eye1).toBeTruthy();
  expect(front.parts["eye-1"].frame).toBe("eye-glare");
  expect(front.parts.pearl && front.parts.pearlglow).toBeTruthy();

  // Eight facings, one per 45°: 0 towards the camera, 2 screen right, 4 away.
  const seen: number[] = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i * Math.PI) / 4;
    await draw(page, { clock: 1 + i, angle: Math.PI / 2 - yaw, frames: 6 });
    seen.push((await rig(page)).facing);
  }
  expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  // Facing screen right, then turning towards facing 1: just past halfway
  // (22.5°) it holds; well past it, it turns.
  await draw(page, { clock: 10, angle: 0, frames: 4 });
  const right = await rig(page);
  expect(right.facing).toBe(2);
  // in profile the head is out ahead of the body, on the side it faces
  expect(right.parts.snout.x).toBeGreaterThan(right.parts.seg0.x);
  await draw(page, { clock: 11, angle: (24 * Math.PI) / 180, frames: 4 });
  expect((await rig(page)).facing).toBe(2);
  await draw(page, { clock: 12, angle: (34 * Math.PI) / 180, frames: 4 });
  expect((await rig(page)).facing).toBe(1);
  // Screen left mirrors it.
  await draw(page, { clock: 13, angle: Math.PI, frames: 8 });
  const left = await rig(page);
  expect(left.facing).toBe(6);
  expect(left.parts.snout.x).toBeLessThan(left.parts.seg0.x);
  // From behind, no eyes; the mane and horns face the camera.
  await draw(page, { clock: 14, angle: -Math.PI / 2, frames: 8 });
  const back = await rig(page);
  expect(back.facing).toBe(4);
  expect(ids(back.parts, /^eye/)).toEqual([]);
  expect(back.parts.mane2 && back.parts.horn1).toBeTruthy();
  expect(errors).toEqual([]);
});

test("phases keep one atlas at a time; diving hides the serpent", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, { clock: 0, angle: Math.PI / 2, frames: 3 });
  const calm = await rig(page);
  expect(calm.textures).toEqual(["vtide-atlas-1"]);
  expect(calm.parts.seg10.texture).toBe("vtide-atlas-1");

  await draw(page, { phase: 2, clock: 1, frames: 4 });
  const two = await rig(page);
  expect(two.textures).toEqual(["vtide-atlas-2"]);
  expect(two.parts.seg10.texture).toBe("vtide-atlas-2");

  await draw(page, { phase: 3, clock: 2, frames: 4 });
  expect((await rig(page)).parts.seg10.texture).toBe("vtide-atlas-3");
  // Only the current phase's atlas is kept, whatever phases were seen.
  await draw(page, { phase: 1, clock: 3, frames: 4 });
  await draw(page, { phase: 3, clock: 4, frames: 4 });
  const three = await rig(page);
  expect(three.textures).toEqual(["vtide-atlas-3"]);
  expect(
    Object.values(three.parts).every((p: any) => p.texture === "vtide-atlas-3"),
  ).toBe(true);

  // Submerged: only the dark shape in the boss layer, the rig is hidden.
  expect(three.visible).toBe(true);
  await draw(page, {
    phase: 3,
    clock: 5,
    frames: 3,
    setup: "row.state.raid.submerged = true",
  });
  expect((await rig(page)).visible).toBe(false);
  // ...and it comes back when it surfaces.
  await draw(page, {
    phase: 3,
    clock: 6,
    frames: 12,
    setup: "row.state.raid.submerged = false",
  });
  expect((await rig(page)).visible).toBe(true);
  expect(errors).toEqual([]);
});

test("stranded on an island it lies low and dizzy with its pearl open; defeated it sinks", async ({
  page,
}) => {
  const errors = await review(page, []);
  // Standing in the water, seen side-on: the head rears high above it.
  await draw(page, { clock: 0, angle: 0, frames: 20 });
  const standing = await rig(page);
  expect(standing.facing).toBe(2);
  expect(standing.ring).toBe(0);
  expect(standing.parts.cran.y).toBeLessThan(-80);

  // Stranded: the whole body flat on the sand, at the waterline.
  await draw(page, { clock: 1, frames: 20, setup: STRAND });
  const stranded = await rig(page);
  expect(stranded.visible).toBe(true);
  expect(stranded.facing).toBe(2);
  expect(stranded.parts.cran.y).toBeGreaterThan(standing.parts.cran.y + 50);
  // every segment shows, uncropped (no water over the sand), and none rears up
  const segs = ids(stranded.parts, /^seg\d+$/).map((id) => stranded.parts[id]);
  expect(segs).toHaveLength(30);
  expect(segs.some((p) => p.cropped)).toBe(false);
  // (relative to standing, so the check does not depend on the boss's scale)
  const standingTop = Math.max(
    ...ids(standing.parts, /^seg\d+$/).map((id) => -standing.parts[id].y),
  );
  expect(Math.max(...segs.map((p) => -p.y))).toBeLessThan(standingTop * 0.6);
  // dizzy eyes and the open weak point's ring
  const eyes = ids(stranded.parts, /^eye-?1$/).map((id) => stranded.parts[id]);
  expect(eyes.length).toBeGreaterThan(0);
  // (each view has its own eye drawing: eye-dizzy from the front, eye-side-dizzy in profile)
  expect(eyes.every((p) => /^eye-(\w+-)?dizzy$/.test(p.frame))).toBe(true);
  expect(stranded.parts.pearl).toBeTruthy();
  expect(stranded.ring).toBeGreaterThan(0);

  // Back in the water, then beaten: it sinks out of sight in about two seconds.
  await draw(page, {
    clock: 2,
    frames: 20,
    setup: "row.state.raid.exposedUntil = 0; row.state.raid.islands = []",
  });
  const swimming = await rig(page);
  expect(swimming.ring).toBe(0);
  expect(Object.keys(swimming.parts).length).toBeGreaterThan(50);
  await draw(page, {
    clock: 3,
    frames: 60,
    setup: 'row.state.raid.result = "victory"; boss.hp = 0',
  });
  const sunk = await rig(page);
  expect(sunk.ring).toBe(0);
  // nothing of the body (or almost nothing) is left above the water
  const above = Object.entries(sunk.parts).filter(
    ([id, p]: any) => !/glow|^mark/.test(id) && p.alpha > 0.05,
  );
  expect(above.length).toBeLessThanOrEqual(2);
  expect(ids(sunk.parts, /^(eye|pearl)/)).toEqual([]);
  expect(errors).toEqual([]);
});

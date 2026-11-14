import { expect, test, type Page } from "@playwright/test";

// Tidewyrm is drawn as Tidelotl, the axolotl (boss-tidelotl.ts,
// boss-tidelotl-rig.ts): its pieces are painted once into two atlases when
// the battle loads (main, and a skin atlas whose colours follow the phase)
// and posed every frame, cut at the waterline.
async function review(page: Page, requests: string[] = []) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
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
  page.evaluate(async () => {
    const r = (window as any).__bossReview,
      scene = r.rows[0].g.scene,
      root = scene.children.list.find(
        (o: any) => o.name === "vector-boss-tidewyrm",
      );
    const { tidelotlAtlasBytes, tidelotlSkinPhase } = await import(
      "/@fs" +
        (window as any).__lotlRoot +
        "/apps/client/src/boss-tidelotl-rig.ts"
    ).catch(() => ({}) as any);
    const parts: Record<string, any> = {};
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
      ring:
        root?.list.find((o: any) => o.name === "vector-boss-front")
          ?.commandBuffer.length ?? -1,
      parts,
      textures: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("lotl-") || k.startsWith("vtide-")),
      bytes: tidelotlAtlasBytes ? tidelotlAtlasBytes(scene) : -1,
      skinPhase: tidelotlSkinPhase ? tidelotlSkinPhase(scene) : -1,
    };
  });
const ids = (parts: Record<string, any>, re: RegExp) =>
  Object.keys(parts).filter((id) => re.test(id));
/** Optional screenshots for review (TIDELOTL_SHOTS=<folder>). */
async function shot(page: Page, name: string) {
  const dir = process.env.TIDELOTL_SHOTS;
  if (!dir) return;
  await page.evaluate(() => {
    const r = (window as any).__bossReview;
    r.game.renderer.snapshot?.(() => {});
    r.game.loop.step?.(performance.now());
  });
  await page.screenshot({ path: `${dir}/${name}.png` });
}
test.beforeEach(async ({ page }) => {
  await page.addInitScript((root) => {
    (window as any).__lotlRoot = root;
  }, process.cwd());
});

test("Tidelotl is drawn from the battle's own state, in eight facings, from atlases painted at load", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors = await review(page, requests);
  await draw(page, { clock: 0, angle: Math.PI / 2, frames: 3 });
  const front = await rig(page);
  expect(front.visible).toBe(true);
  // the two atlases exist (painted when the battle loaded), nothing downloaded, within 8 MB
  expect(front.textures.sort()).toEqual(["lotl-main", "lotl-skin"]);
  expect(front.bytes).toBeGreaterThan(2 * 1024 * 1024);
  expect(front.bytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(
    requests.filter((u) => /(tidelotl|tidewyrm)[^/]*\.(webp|png)/.test(u)),
  ).toEqual([]);
  // one whole axolotl: body, head, face, pearl, six gill fronds, a tail
  for (const k of ["body", "head", "eyen", "eyef", "mouth", "pearl", "tail"])
    expect(front.parts[k], k).toBeTruthy();
  expect(ids(front.parts, /^gill[LR]\d$/)).toHaveLength(6);
  expect(front.facing).toBe(0);
  expect(front.parts.head.frame).toBe("head_0");
  // under the image budget
  expect(Object.keys(front.parts).length).toBeLessThanOrEqual(34);
  await shot(page, "front");

  // eight facings, one per 45°: 0 towards the camera, 2 screen right, 4 away
  const seen: number[] = [];
  for (let i = 0; i < 8; i++) {
    await draw(page, {
      clock: 1 + i,
      angle: Math.PI / 2 - (i * Math.PI) / 4,
      frames: 4,
    });
    const v = await rig(page);
    seen.push(v.facing);
    await shot(page, `facing-${i}`);
    if (i === 2) {
      // in profile the head is ahead of the body, on the side it faces
      expect(v.parts.head.x).toBeGreaterThan(v.parts.body.x);
      expect(v.parts.head.frame).toBe("head_2");
    }
    if (i === 6) expect(v.parts.head.x).toBeLessThan(v.parts.body.x);
    if (i === 4) {
      // from behind: no face, no pearl, the back's own tail drawing
      expect(ids(v.parts, /^(eye|mouth|pearl)/)).toEqual([]);
      expect(v.parts.tail.frame).toBe("tail_4_restB");
    }
  }
  expect(seen).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  // a little hysteresis: just past halfway between two facings it holds
  await draw(page, { clock: 10, angle: 0, frames: 2 });
  await draw(page, { clock: 11, angle: (24 * Math.PI) / 180, frames: 2 });
  expect((await rig(page)).facing).toBe(2);
  await draw(page, { clock: 12, angle: (40 * Math.PI) / 180, frames: 2 });
  expect((await rig(page)).facing).toBe(1);
  expect(errors).toEqual([]);
});

test("each attack winds up its own way, the Undertow spins smoothly, and diving hides it", async ({
  page,
}) => {
  const errors = await review(page);
  const warn = (kind: string, at = 31) =>
    `row.state.raid.warnings = [{ id: ${kind.length}, kind: "${kind}", startedAt: 29, at: ${at}, x: boss.x, y: boss.y, tx: boss.x + 1, ty: boss.y, radius: 75, casterId: boss.id }]`;
  await draw(page, { clock: 0, angle: Math.PI / 2, frames: 3 });
  const idle = await rig(page);
  // bubbles: cheeks puffed, a little round mouth
  await draw(page, { clock: 30.9, frames: 1, setup: warn("bubbles") });
  expect((await rig(page)).parts.mouth.frame).toBe("mouth_0_o");
  // high tide: arms up and howling, pearl lit
  await draw(page, { clock: 30.9, frames: 1, setup: warn("hightide") });
  const tide = await rig(page);
  expect(tide.parts.mouth.frame).toBe("mouth_0_open");
  expect(tide.parts.legFL.frame).toBe("leg_0_L_F_up");
  expect(tide.parts.head.y).toBeLessThan(idle.parts.head.y - 10);
  await shot(page, "hightide-windup");
  // the Undertow: it spins, crossfading the facing it leaves into the next
  // (sampled frame by frame: on a whole facing there is nothing to fade in)
  await draw(page, { clock: 29.5, frames: 1, setup: warn("undertow") });
  let spin = await rig(page),
    facings = new Set<number>();
  for (let n = 1; n <= 40 && ids(spin.parts, /^b:/).length === 0; n++) {
    await draw(page, { clock: 29.5 + n / 30, frames: 1 });
    spin = await rig(page);
    facings.add(spin.facing);
  }
  expect(ids(spin.parts, /^b:/).length).toBeGreaterThan(5);
  expect(spin.parts.smear0).toBeTruthy();
  await shot(page, "undertow-spin");
  // and it keeps turning through the facings as the pull goes on
  for (let n = 41; n <= 70; n++) {
    await draw(page, { clock: 29.5 + n / 30, frames: 1 });
    facings.add((await rig(page)).facing);
  }
  expect(facings.size).toBeGreaterThanOrEqual(3);
  // the same spin with reduced motion: no turning, no second drawing
  await draw(page, {
    clock: 29.5,
    frames: 30,
    step: 1 / 60,
    setup: warn("undertow"),
    reduced: true,
  });
  expect(ids((await rig(page)).parts, /^b:/)).toEqual([]);
  // submerged: only the dark shape and the gill fronds in the boss layer
  await draw(page, {
    clock: 40,
    frames: 3,
    setup: "row.state.raid.warnings = []; row.state.raid.submerged = true",
  });
  expect((await rig(page)).visible).toBe(false);
  await draw(page, {
    clock: 41,
    frames: 3,
    setup: "row.state.raid.submerged = false",
  });
  const up = await rig(page);
  expect(up.visible).toBe(true);
  // just surfaced: bursting up, the body still partly under the water
  expect(Object.values(up.parts).some((p: any) => p.cropped)).toBe(true);
  await shot(page, "surfacing");
  expect(errors).toEqual([]);
});

test("stranded it lies belly-flat, dizzy, pearl open; the phase deepens its skin; defeated it sinks", async ({
  page,
}) => {
  const errors = await review(page);
  await draw(page, { clock: 0, angle: 0, frames: 20 });
  const floating = await rig(page);
  expect(floating.ring).toBe(0);
  // in the water the body is cut at the waterline (soft fade and foam over the cut)
  expect(floating.parts.fade && floating.parts.foamFront).toBeTruthy();
  await draw(page, { clock: 1, frames: 20, setup: STRAND });
  const flat = await rig(page);
  expect(flat.visible).toBe(true);
  // out on the sand: nothing cut, legs splayed, tail flopped, dizzy eyes, the weak point open
  expect(Object.values(flat.parts).some((p: any) => p.cropped)).toBe(false);
  expect(flat.parts.fade).toBeUndefined();
  expect(flat.parts.legFL.frame).toMatch(/_F_splay$/);
  expect(flat.parts.tail.frame).toMatch(/_flop$/);
  expect(flat.parts.eyen.frame).toMatch(/_dizzy$/);
  expect(flat.ring).toBeGreaterThan(0);
  // lower than standing on the sand would be
  expect(flat.parts.head.y).toBeGreaterThan(floating.parts.head.y - 10);
  await shot(page, "stranded");

  // a new phase repaints the skin atlas in place (a few ms a frame), no new texture
  await draw(page, {
    phase: 3,
    clock: 2,
    frames: 400,
    step: 1 / 60,
    setup: "row.state.raid.exposedUntil = 0; row.state.raid.islands = []",
  });
  const deep = await rig(page);
  expect(deep.skinPhase).toBe(3);
  expect(deep.textures.sort()).toEqual(["lotl-main", "lotl-skin"]);
  expect(deep.parts.gillL0.frame).toMatch(/_1$/);
  expect(deep.parts.swirl2).toBeTruthy();
  await shot(page, "phase3");

  await draw(page, {
    phase: 3,
    clock: 9,
    frames: 60,
    setup: 'row.state.raid.result = "victory"; boss.hp = 0',
  });
  const sunk = await rig(page);
  expect(sunk.ring).toBe(0);
  expect(ids(sunk.parts, /^(eye|pearl|head)/)).toEqual([]);
  expect(errors).toEqual([]);
});

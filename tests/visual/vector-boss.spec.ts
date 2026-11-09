import { expect, test, type Page } from "@playwright/test";

// Grumblecrag is vector art (boss-vector-grumble.ts, boss-vector-rig.ts):
// its parts are drawn once per phase into textures and posed every frame.
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
/** Set Grumblecrag's state and draw it for `frames` frames from `clock`. */
const draw = (
  page: Page,
  o: {
    phase?: number;
    clock: number;
    frames?: number;
    step?: number;
    angle?: number;
    setup?: string;
  },
) =>
  page.evaluate(
    ({ phase, clock, frames, step, angle, setup }) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((x: any) => x.id === "grumblecrag"),
        boss = row.state.players.find((p: any) => p.raidBoss);
      if (angle !== undefined) boss.angle = angle;
      if (setup) new Function("row", "boss", setup)(row, boss);
      for (let n = 0; n < frames; n++)
        r.frame(phase, clock + n * step, false, ["grumblecrag"]);
    },
    {
      phase: o.phase ?? 1,
      clock: o.clock,
      frames: o.frames ?? 1,
      step: o.step ?? 0.05,
      angle: o.angle,
      setup: o.setup,
    },
  );
const rig = (page: Page) =>
  page.evaluate(() => {
    const r = (window as any).__bossReview,
      scene = r.rows[0].g.scene,
      root = scene.children.list.find(
        (o: any) => o.name === "vector-boss-grumblecrag",
      );
    const parts: Record<string, any> = {};
    for (const o of root?.list.flatMap((c: any) => c.list) ?? [])
      if (o.visible)
        parts[o.name.replace("vector-part-", "")] = {
          x: o.x,
          y: o.y,
          alpha: o.alpha,
          sx: o.scaleX,
          texture: o.texture.key,
        };
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      parts,
      textures: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("vgrumble-")),
      painted: r.game.textures
        .getTextureKeys()
        .filter(
          (k: string) => k.startsWith("raid-") && k.includes("grumblecrag"),
        ),
    };
  });

test("Grumblecrag is drawn as vector art from the battle's own state, in eight facings", async ({
  page,
}) => {
  const requests: string[] = [];
  const errors = await review(page, requests);
  await draw(page, { clock: 0, angle: Math.PI / 2 });
  const front = await rig(page);
  expect(front.visible).toBe(true);
  // No painted atlas is downloaded or kept for it.
  expect(front.painted).toEqual([]);
  expect(
    requests.filter((u) => /raid-(whole|directions)-grumblecrag/.test(u)),
  ).toEqual([]);
  // Front: the angry eyes and the core face the camera.
  expect(front.facing).toBe(0);
  expect(front.parts.eyeL && front.parts.eyeR && front.parts.core).toBeTruthy();

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
  expect((await rig(page)).facing).toBe(2);
  await draw(page, { clock: 11, angle: (24 * Math.PI) / 180, frames: 4 });
  expect((await rig(page)).facing).toBe(2);
  await draw(page, { clock: 12, angle: (34 * Math.PI) / 180, frames: 4 });
  expect((await rig(page)).facing).toBe(1);
  // From behind, no eyes and no core; the spine crystals face the camera.
  await draw(page, { clock: 13, angle: -Math.PI / 2, frames: 8 });
  const back = await rig(page);
  expect(back.facing).toBe(4);
  expect(back.parts.eyeL ?? back.parts.eyeR ?? back.parts.core).toBeUndefined();
  expect(back.parts.spine1).toBeTruthy();
  expect(errors).toEqual([]);
});

test("phases, a stagger and the defeat change the rig; one atlas at a time", async ({
  page,
}) => {
  const errors = await review(page, []);
  await draw(page, { clock: 0, angle: Math.PI / 2, frames: 3 });
  const calm = await rig(page);
  // The whole body comes from one atlas per phase.
  expect(calm.textures).toEqual(["vgrumble-atlas-1"]);
  expect(calm.parts.torso.texture).toBe("vgrumble-atlas-1");

  // Staggered (phase 2): down on a knee, the core's armour open.
  await draw(page, {
    phase: 2,
    clock: 1,
    frames: 10,
    setup: "row.state.raid.staggerUntil = 99",
  });
  const stagger = await rig(page);
  expect(stagger.parts.cavity).toBeTruthy();
  expect(stagger.parts.head.y).toBeGreaterThan(calm.parts.head.y + 15);
  expect(stagger.parts.torso.texture).toBe("vgrumble-atlas-2");
  expect(stagger.textures).toEqual(["vgrumble-atlas-2"]);

  // Phase 3: molten rock and a smouldering aura.
  await draw(page, {
    phase: 3,
    clock: 3,
    frames: 6,
    setup: "row.state.raid.staggerUntil = 0",
  });
  const molten = await rig(page);
  expect(molten.parts.torso.texture).toBe("vgrumble-atlas-3");
  expect(molten.parts["glow-aura"]).toBeTruthy();

  // Only the current phase's atlas is kept, whatever phases were seen.
  await draw(page, { phase: 1, clock: 5, frames: 4 });
  await draw(page, { phase: 3, clock: 6, frames: 4 });
  expect((await rig(page)).textures).toEqual(["vgrumble-atlas-3"]);

  // Defeat: the mountain falls apart into a low heap, eyes out, core gutters.
  await draw(page, {
    phase: 3,
    clock: 7,
    frames: 70,
    setup: 'row.state.raid.result = "victory"; boss.hp = 0',
  });
  const fallen = await rig(page);
  expect(
    fallen.parts.eyeL ?? fallen.parts.eyeR ?? fallen.parts.core,
  ).toBeUndefined();
  const heights = Object.entries(fallen.parts)
    .filter(([id]) => /^(torso|head|hump|shoulder|fist)/.test(id))
    .map(([, p]: any) => -p.y);
  expect(Math.max(...heights)).toBeLessThan(60);
  expect(errors).toEqual([]);
});

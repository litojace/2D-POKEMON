import { expect, test, type Page } from "@playwright/test";

// Lumiwick (Emberwing's id): a sky-lantern spirit painted once into one
// atlas (boss-lumiwick-paint.ts) and posed every frame from the battle's
// warnings and casts (boss-lumiwick.ts, boss-lumiwick-rig.ts).
async function review(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
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
/** Set its state and draw it for `frames` frames from `clock`. */
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
      root = scene.children.list.find((o: any) => o.name === "lumiwick-boss");
    const parts: Record<string, any> = {};
    for (const o of root?.list[0]?.list ?? [])
      if (o.visible && o.type === "Image")
        parts[o.name.replace("lumiwick-part-", "")] = {
          x: o.x,
          y: o.y,
          rotation: o.rotation,
          scaleX: o.scaleX,
          scaleY: o.scaleY,
          alpha: o.alpha,
          frame: o.frame.name,
          texture: o.texture.key,
          blend: o.blendMode,
        };
    const tex = r.game.textures.exists("lumiwick-atlas")
      ? r.game.textures.get("lumiwick-atlas").source[0]
      : null;
    return {
      visible: !!root?.visible,
      facing: root?.getData("facing"),
      action: root?.getData("action"),
      ring:
        root?.list.find((o: any) => o.name === "lumiwick-front")?.commandBuffer
          .length ?? -1,
      parts,
      atlasBytes: tex ? tex.width * tex.height * 4 : 0,
      oldAtlases: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("vember-")),
    };
  });
const AIRBORNE = "row.state.raid.airborne = true";
const warn = (kind: string, at0: number, dur: number, extra = "") =>
  `row.state.raid.warnings = [{ id: 7, kind: '${kind}', startedAt: ${at0}, at: ${at0 + dur},` +
  ` x: boss.x, y: boss.y, tx: boss.x - 300, ty: boss.y + 160, radius: 60${extra} }]`;

test("Lumiwick is one atlas painted at create, drawn in eight facings", async ({
  page,
}) => {
  const errors = await review(page);
  await draw(page, {
    clock: 0,
    angle: Math.PI / 2,
    frames: 20,
    setup: AIRBORNE,
  });
  const front = await rig(page);
  // one atlas for every phase, inside the 8 MB budget (battle-preload checks it is painted at create)
  expect(front.atlasBytes).toBeGreaterThan(1024 * 1024);
  expect(front.atlasBytes).toBeLessThanOrEqual(8 * 1024 * 1024);
  expect(front.visible).toBe(true);
  expect(front.oldAtlases).toEqual([]);
  expect(front.parts.body.frame).toBe("body_0");
  expect(front.parts.eyes.frame).toMatch(/^eyes_0_/);
  expect(front.parts.mouth.frame).toMatch(/^mouth_0_/);
  expect(front.parts.armL && front.parts.armR).toBeTruthy();
  expect(front.parts.wick && front.parts.curl).toBeTruthy();
  expect(front.parts.halo.blend).toBe(1);
  expect(
    Object.values(front.parts).every(
      (p: any) => p.texture === "lumiwick-atlas",
    ),
  ).toBe(true);

  // 0 towards the camera, 2 screen right, 4 away; 5-7 are mirrors of 3-1
  const seen: {
    facing: number;
    body: string;
    mirror: boolean;
    eyes?: string;
  }[] = [];
  for (let i = 0; i < 8; i++) {
    const yaw = (i * Math.PI) / 4;
    await draw(page, { clock: 2 + i, angle: Math.PI / 2 - yaw, frames: 8 });
    const s = await rig(page);
    seen.push({
      facing: s.facing,
      body: s.parts.body.frame,
      // a mirrored image: one of its scales is negative
      mirror: s.parts.body.scaleX * s.parts.body.scaleY < 0,
      eyes: s.parts.eyes?.frame.split("_")[1],
    });
  }
  expect(seen.map((s) => s.facing)).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(seen.map((s) => s.body)).toEqual([
    "body_0",
    "body_1",
    "body_2",
    "body_3",
    "body_4",
    "body_3",
    "body_2",
    "body_1",
  ]);
  expect(seen.map((s) => s.mirror)).toEqual([
    false,
    false,
    false,
    false,
    false,
    true,
    true,
    true,
  ]);
  // a face drawing per view in front, ¾ and side; none from behind
  expect(seen.map((s) => s.eyes)).toEqual([
    "0",
    "1",
    "2",
    undefined,
    undefined,
    undefined,
    "2",
    "1",
  ]);
  expect(errors).toEqual([]);
});

test("each attack winds up from its warning and follows through from its cast", async ({
  page,
}) => {
  const errors = await review(page);
  await draw(page, {
    clock: 0,
    angle: Math.PI / 2,
    frames: 10,
    setup: AIRBORNE,
  });
  const calm = await rig(page);
  // Dive Bomb: it rears up and glares as the lane fills...
  await draw(page, { clock: 1, frames: 16, setup: warn("dive-bomb", 1, 1.15) });
  const rearing = await rig(page);
  expect(rearing.action).toBe("dive-bomb");
  expect(rearing.parts.body.y).toBeLessThan(calm.parts.body.y - 10);
  expect(rearing.parts.eyes.frame).toMatch(/_(glare|closed)$/);
  expect(rearing.parts.armL.frame).toMatch(/_up_/);
  // ...then tips over crown-first along the lane (the cast's streak)
  await draw(page, {
    clock: 2.16,
    frames: 3,
    setup: "row.state.raid.warnings = []",
  });
  const after = await rig(page);
  for (const p of Object.values(after.parts) as any[])
    for (const n of [p.x, p.y, p.rotation, p.alpha])
      expect(Number.isFinite(n)).toBe(true);
  // Heat Mark: the far ribbon points at the raider while the brand hunts
  await draw(page, { clock: 5, frames: 30, setup: warn("heat-mark", 5, 3) });
  const mark = await rig(page);
  expect(mark.action).toBe("heat-mark");
  expect(mark.parts.armL.frame).toMatch(/_point_/);
  // Flame Ring: it hugs itself (ribbons wrapped) as the ring warning fills
  await draw(page, { clock: 9, frames: 8, setup: warn("flame-ring", 9, 1) });
  const ring = await rig(page);
  expect(ring.parts.armL.frame).toMatch(/_wrap_/);
  // Hot Gust: ribbons drawn up and back before the fan
  await draw(page, {
    clock: 12,
    frames: 14,
    setup: warn("wing-gust", 12, 1.1),
  });
  expect((await rig(page)).parts.armL.frame).toMatch(/_up_/);
  // Scorched Earth: it tips toward the raiders, ribbons out
  await draw(page, {
    clock: 15,
    frames: 14,
    setup: warn("scorched-earth", 15, 1.4),
  });
  expect((await rig(page)).parts.armL.frame).toMatch(/_sweep_/);
  // Ember Rain: it rises high before the sparks pour out
  await draw(page, {
    clock: 18,
    frames: 16,
    setup: warn("ember-rain", 18, 1.2),
  });
  const rain = await rig(page);
  expect(rain.parts.body.y).toBeLessThan(calm.parts.body.y - 20);
  // phases heat it up: scorch marks from phase 2, burnt holes in phase 3
  await draw(page, {
    clock: 21,
    frames: 4,
    setup: "row.state.raid.warnings = []",
  });
  const one = await rig(page);
  await draw(page, { phase: 3, clock: 22, frames: 30 });
  const three = await rig(page);
  const marks = (s: any) =>
    Object.keys(s.parts).filter((k) => k.startsWith("mark")).length;
  expect(marks(one)).toBe(0);
  expect(marks(three)).toBeGreaterThan(2);
  expect(three.parts.curlFlame).toBeTruthy();
  expect(errors).toEqual([]);
});

test("grounded by the braziers it slumps with its heart open; beaten it gutters out and crumples", async ({
  page,
}) => {
  const errors = await review(page);
  await draw(page, {
    clock: 0,
    angle: Math.PI / 2,
    frames: 20,
    setup: AIRBORNE,
  });
  const flying = await rig(page);
  expect(flying.ring).toBe(0);
  await draw(page, {
    clock: 1,
    frames: 24,
    setup:
      "row.state.raid.airborne = false; row.state.raid.exposedUntil = row.state.time + 99",
  });
  const grounded = await rig(page);
  expect(grounded.action).toBe("grounded");
  expect(grounded.ring).toBeGreaterThan(0);
  expect(grounded.parts.body.y).toBeGreaterThan(flying.parts.body.y + 40);
  expect(grounded.parts.heart).toBeTruthy();
  expect(grounded.parts.armL.frame).toMatch(/_slump_/);
  // dazed just after the crash: dizzy eyes and stars
  expect(grounded.parts.eyes.frame).toBe("eyes_0_dizzy");
  expect(
    Object.keys(grounded.parts).filter((k) => k.startsWith("star")),
  ).toHaveLength(3);
  // beaten: the flame goes out and it crumples on the floor
  await draw(page, {
    clock: 4,
    frames: 90,
    setup:
      'row.state.raid.exposedUntil = 0; row.state.raid.result = "victory"; boss.hp = 0',
  });
  const dead = await rig(page);
  expect(dead.action).toBe("defeat");
  expect(dead.ring).toBe(0);
  expect(dead.parts.crumple).toBeTruthy();
  expect(dead.parts.wick).toBeUndefined();
  expect(errors).toEqual([]);
});

test("reduced motion holds a still pose, windups included", async ({
  page,
}) => {
  const errors = await review(page);
  const pose = async (clock: number) => {
    await draw(page, {
      clock,
      frames: 1,
      reduced: true,
      angle: Math.PI / 2,
      setup: AIRBORNE,
    });
    const s = await rig(page);
    return Object.fromEntries(
      Object.entries(s.parts).map(([k, p]: [string, any]) => [
        k,
        [Math.round(p.x), Math.round(p.y), p.frame],
      ]),
    );
  };
  const a = await pose(1),
    b = await pose(2.7);
  expect(b).toEqual(a);
  await draw(page, {
    clock: 3,
    frames: 1,
    reduced: true,
    setup: warn("heat-mark", 2.9, 3),
  });
  expect((await rig(page)).parts.armL.frame).toMatch(/_point_/);
  expect(errors).toEqual([]);
});

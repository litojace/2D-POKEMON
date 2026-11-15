import { expect, test, type Page } from "@playwright/test";

// The Storm Twins are vector art (boss-vector-twins.ts, boss-vector-twins-rig.ts),
// like Tidewyrm (vector-tide.spec.ts): one atlas per phase holds both twins'
// pieces; each twin has its own rig and facing, posed every frame.
const SHOTS = process.env.VISUAL_SHOTS;
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
/** Set the twins' state and draw them for `frames` frames from `clock`. */
const draw = (
  page: Page,
  o: {
    phase?: number;
    clock: number;
    frames?: number;
    step?: number;
    angles?: [number, number];
    reduced?: boolean;
    setup?: string;
  },
) =>
  page.evaluate(
    ({ phase, clock, frames, step, angles, reduced, setup }) => {
      const r = (window as any).__bossReview,
        row = r.rows.find((x: any) => x.id === "storm-twins"),
        twins = row.state.raid.twins.map((t: any) =>
          row.state.players.find((p: any) => p.id === t.id),
        );
      if (angles) twins.forEach((p: any, i: number) => (p.angle = angles[i]));
      if (setup) new Function("row", "twins", setup)(row, twins);
      for (let n = 0; n < frames; n++)
        r.frame(phase, clock + n * step, reduced, ["storm-twins"]);
    },
    {
      phase: o.phase ?? 1,
      clock: o.clock,
      frames: o.frames ?? 1,
      step: o.step ?? 0.05,
      angles: o.angles,
      reduced: o.reduced ?? false,
      setup: o.setup,
    },
  );
const rigs = (page: Page) =>
  page.evaluate(() => {
    const r = (window as any).__bossReview,
      scene = r.rows[0].g.scene;
    const one = (twin: number) => {
      const root = scene.children.list.find(
        (o: any) => o.name === `vector-boss-twin-${twin}`,
      );
      const parts: Record<string, any> = {};
      for (const o of root?.list.flatMap((c: any) => c.list ?? []) ?? [])
        if (o.visible && o.type === "Image")
          parts[o.name.replace("vector-part-", "")] = {
            x: o.x,
            y: o.y,
            alpha: o.alpha,
            frame: o.frame.name,
            texture: o.texture.key,
          };
      return {
        visible: !!root?.visible,
        facing: root?.getData("facing"),
        view: root?.getData("view"),
        ring:
          root?.list.find((o: any) => o.name === "vector-boss-front")
            ?.commandBuffer.length ?? -1,
        parts,
      };
    };
    return {
      twins: [one(0), one(1)],
      textures: r.game.textures
        .getTextureKeys()
        .filter((k: string) => k.startsWith("vtwins-")),
      painted: r.game.textures
        .getTextureKeys()
        .filter(
          (k: string) => k.startsWith("raid-") && k.includes("storm-twins"),
        ),
    };
  });
const ids = (parts: Record<string, any>, re: RegExp) =>
  Object.keys(parts).filter((id) => re.test(id));
/** A close look at the twins (only with VISUAL_SHOTS set). */
const shot = async (page: Page, name: string) => {
  if (!SHOTS) return;
  const box = await page.evaluate(() => {
    const r = (window as any).__bossReview,
      row = r.rows.find((x: any) => x.id === "storm-twins");
    return { x: row.g.x, y: row.g.y };
  });
  await page.screenshot({
    path: `${SHOTS}/twins-game-${name}.png`,
    clip: { x: box.x - 300, y: box.y - 270, width: 600, height: 340 },
  });
};

test("the Storm Twins are vector art from the battle's own state, each in eight facings", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 2000 });
  const requests: string[] = [];
  const errors = await review(page, requests);
  await draw(page, { clock: 0, angles: [Math.PI / 2, Math.PI / 2], frames: 3 });
  const front = await rigs(page);
  await shot(page, "front");
  // No painted atlas is downloaded or kept for them.
  expect(front.painted).toEqual([]);
  expect(
    requests.filter((u) => /raid-(whole|directions)-storm-twins/.test(u)),
  ).toEqual([]);
  expect(front.textures).toEqual(["vtwins-atlas-1"]);
  for (const [i, t] of front.twins.entries()) {
    const pre = i ? "ck" : "fz";
    expect(t.visible).toBe(true);
    expect(t.facing).toBe(0);
    expect(t.view).toBe("front");
    // one bell, six tentacles, a curl, two eyes and a mouth, all from one atlas
    expect(t.parts.head.frame).toBe(`${pre}_bell`);
    expect(ids(t.parts, /^tent\d$/)).toHaveLength(6);
    expect(t.parts.curl.frame).toBe(`${pre}_curl`);
    expect(t.parts.eyen && t.parts.eyef && t.parts.mouth).toBeTruthy();
    expect(
      Object.values(t.parts).every((p: any) => p.texture === "vtwins-atlas-1"),
    ).toBe(true);
  }
  // Fizz laughs with arched eyes; Crackle glowers under a flat lid.
  expect(front.twins[0].parts.eyen.frame).toBe("fz_eye_front_idle");
  expect(front.twins[0].parts.mouth.frame).toBe("fz_mouth_front_smile");
  expect(front.twins[1].parts.mouth.frame).toBe("ck_mouth_front_smile");

  // Each twin turns on its own: eight facings, one per 45 degrees.
  const seen: number[][] = [[], []];
  for (let i = 0; i < 8; i++) {
    const yaw = (i * Math.PI) / 4;
    await draw(page, {
      clock: 1 + i,
      angles: [Math.PI / 2 - yaw, Math.PI / 2 + yaw],
      frames: 6,
    });
    const now = await rigs(page);
    seen[0].push(now.twins[0].facing);
    seen[1].push(now.twins[1].facing);
    if (i === 1 || i === 2) await shot(page, `facing-${i}`);
  }
  expect(seen[0]).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  expect(seen[1]).toEqual([0, 7, 6, 5, 4, 3, 2, 1]);
  // Three-quarter: a near and a narrower far eye; side on, one profile eye;
  // from behind, no face at all.
  await draw(page, {
    clock: 10,
    angles: [Math.PI / 4, Math.PI / 2],
    frames: 6,
  });
  const tq = (await rigs(page)).twins[0];
  expect(tq.parts.eyen.frame).toBe("fz_eye_near_idle");
  expect(tq.parts.eyef.frame).toBe("fz_eye_far_idle");
  await draw(page, { clock: 11, angles: [0, Math.PI / 2], frames: 6 });
  const side = (await rigs(page)).twins[0];
  expect(side.view).toBe("side");
  expect(side.parts.eyen.frame).toBe("fz_eye_side_idle");
  expect(side.parts.eyef).toBeUndefined();
  await draw(page, {
    clock: 12,
    angles: [-Math.PI / 2, Math.PI / 2],
    frames: 8,
  });
  const back = (await rigs(page)).twins[0];
  expect(back.facing).toBe(4);
  expect(ids(back.parts, /^(eye|mouth)/)).toEqual([]);
  expect(back.parts.head && back.parts.curl).toBeTruthy();
  expect(errors).toEqual([]);
});

test("exposed cores show the ring; a downed twin sinks and fades; beaten, both sink", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 2000 });
  const errors = await review(page, []);
  await draw(page, { clock: 0, angles: [Math.PI / 2, Math.PI / 2], frames: 6 });
  const calm = await rigs(page);
  expect(calm.twins.map((t) => t.ring)).toEqual([0, 0]);

  // Exposed: startled eyes and the weak point's ring, on that twin only.
  await draw(page, {
    clock: 1,
    frames: 6,
    setup: "row.state.raid.twins[1].exposedUntil = 99",
  });
  const exposed = await rigs(page);
  await shot(page, "exposed");
  expect(exposed.twins[0].ring).toBe(0);
  expect(exposed.twins[1].ring).toBeGreaterThan(0);
  expect(exposed.twins[1].parts.eyen.frame).toBe("ck_eye_front_wide");

  // Staggered: dizzy eyes and stars on both.
  await draw(page, {
    clock: 2,
    frames: 6,
    setup:
      "row.state.raid.twins[1].exposedUntil = 0; row.state.raid.staggerUntil = 99",
  });
  const dizzy = await rigs(page);
  await shot(page, "stagger");
  for (const t of dizzy.twins) {
    expect(t.parts.eyen.frame).toMatch(/_eye_front_dizzy$/);
    expect(ids(t.parts, /^star\d$/)).toHaveLength(3);
  }

  // One twin down, waiting to be revived: sunk lower, eyes shut, faded.
  await draw(page, {
    clock: 3,
    frames: 30,
    setup:
      "row.state.raid.staggerUntil = 0; twins[0].hp = 0; row.state.raid.twins[0].fallenAt = row.state.time",
  });
  const down = await rigs(page);
  await shot(page, "one-down");
  expect(down.twins[0].parts.eyen.frame).toBe("fz_eye_front_closed");
  expect(down.twins[0].parts.head.alpha).toBeLessThan(0.7);
  expect(down.twins[0].parts.head.y).toBeGreaterThan(
    calm.twins[0].parts.head.y + 25,
  );
  expect(down.twins[1].parts.head.alpha).toBe(1);
  expect(down.twins[1].parts.eyen.frame).not.toMatch(/closed/);

  // Revived, then both beaten: both sink with their eyes shut.
  await draw(page, { clock: 5, frames: 6, setup: "twins[0].hp = 500" });
  expect((await rigs(page)).twins[0].parts.head.alpha).toBe(1);
  await draw(page, {
    clock: 6,
    frames: 40,
    setup:
      'row.state.raid.result = "victory"; twins.forEach((p) => (p.hp = 0))',
  });
  const beaten = await rigs(page);
  await shot(page, "defeat");
  for (const [i, t] of beaten.twins.entries()) {
    expect(t.ring).toBe(0);
    expect(t.parts.eyen.frame).toMatch(/_eye_front_closed$/);
    expect(t.parts.head.y).toBeGreaterThan(calm.twins[i].parts.head.y + 45);
  }
  expect(errors).toEqual([]);
});

test("phases keep one atlas for both twins; reduced motion holds them still", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1600, height: 2000 });
  const errors = await review(page, []);
  await draw(page, { clock: 0, angles: [Math.PI / 2, Math.PI / 2], frames: 3 });
  expect((await rigs(page)).textures).toEqual(["vtwins-atlas-1"]);
  await draw(page, { phase: 3, clock: 1, frames: 4 });
  const three = await rigs(page);
  await shot(page, "phase3");
  expect(three.textures).toEqual(["vtwins-atlas-3"]);
  for (const t of three.twins)
    expect(
      Object.values(t.parts).every((p: any) => p.texture === "vtwins-atlas-3"),
    ).toBe(true);
  await draw(page, { phase: 1, clock: 2, frames: 2, reduced: true });
  const a = await rigs(page);
  await draw(page, { phase: 1, clock: 7, frames: 2, reduced: true });
  const b = await rigs(page);
  expect(b.twins.map((t) => t.parts)).toEqual(a.twins.map((t) => t.parts));
  expect(errors).toEqual([]);
});

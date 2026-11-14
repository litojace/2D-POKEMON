import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { openHub, openPlayPanel, pushUntilBattle, snap } from "./helpers";

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

test.describe("face", () => {
  test.use({ deviceScaleFactor: 2 });
  test("eyes, mouth and pearl stay locked to the head in every facing and state", async ({
    page,
  }) => {
    const errors = await review(page);
    // every face image is painted at its place inside a head-sized piece, so it
    // is aligned exactly when it shares the head image's transform
    const check = async (label: string) => {
      const v = await page.evaluate(() => {
        const r = (window as any).__bossReview,
          root = r.rows[0].g.scene.children.list.find(
            (o: any) => o.name === "vector-boss-tidewyrm",
          );
        const out: Record<string, any> = {};
        for (const o of root.list[0].list)
          if (o.visible && o.type === "Image")
            out[o.name.replace("vector-part-", "")] = {
              x: o.x,
              y: o.y,
              r: o.rotation,
              sx: o.scaleX,
              sy: o.scaleY,
              frame: o.frame.name,
              cropped: o.isCropped,
              ch: o.isCropped ? o._crop.height : 0,
              fy: o.originY,
              fh: o.frame.height,
            };
        return out;
      });
      for (const prefix of ["", "b:"]) {
        const head = v[prefix + "head"];
        if (!head) continue;
        for (const k of ["eyen", "eyef", "mouth", "pearl"]) {
          const f = v[prefix + k];
          if (!f) continue;
          const at = `${label} ${prefix}${k} (${f.frame})`;
          expect(f.x, at).toBeCloseTo(head.x, 3);
          expect(f.y, at).toBeCloseTo(head.y, 3);
          // the same matrix as the head (the front view's far eye: mirrored about the centre line)
          const m = (o: any) => [
            o.sx * Math.cos(o.r),
            o.sx * Math.sin(o.r),
            -o.sy * Math.sin(o.r),
            o.sy * Math.cos(o.r),
          ];
          const mirror = k === "eyef" && /^eye_0_/.test(f.frame) ? -1 : 1;
          const hm = m(head),
            fm = m(f);
          // (up to one uniform factor: each piece has its own atlas density)
          const k0 = fm[3] / hm[3];
          expect(k0, at).toBeGreaterThan(0.6);
          expect(k0, at).toBeLessThan(1.01);
          expect(fm[0], at).toBeCloseTo(hm[0] * k0 * mirror, 4);
          expect(fm[1], at).toBeCloseTo(hm[1] * k0 * mirror, 4);
          expect(fm[2], at).toBeCloseTo(hm[2] * k0, 4);
        }
        if (
          v[prefix + "eyen"] &&
          v[prefix + "eyef"] &&
          /eye_0_/.test(v[prefix + "eyef"].frame)
        )
          expect(
            v[prefix + "eyef"].sx * v[prefix + "eyef"].sy,
            label,
          ).toBeLessThan(0);
      }
      return v;
    };
    const clip = { x: 820, y: 40, width: 620, height: 420 };
    const close = async (name: string) => {
      const dir = process.env.TIDELOTL_SHOTS;
      if (dir) await page.screenshot({ path: `${dir}/face-${name}.png`, clip });
    };
    const warn = (kind: string) =>
      `row.state.raid.warnings = [{ id: 7, kind: "${kind}", startedAt: 29, at: 31, x: boss.x, y: boss.y, tx: boss.x + 1, ty: boss.y, radius: 75, casterId: boss.id }]`;
    // eight facings, floating and bobbing (several moments of the bob)
    for (let i = 0; i < 8; i++)
      for (let n = 0; n < 3; n++) {
        await draw(page, {
          clock: 1 + i + n * 0.37,
          angle: Math.PI / 2 - (i * Math.PI) / 4,
          frames: 2,
        });
        await check(`facing ${i} bob ${n}`);
        if (n === 0) await close(`facing-${i}`);
      }
    // glare (an attack winding up), puffed cheeks, hurt, dizzy
    await draw(page, {
      clock: 30.5,
      angle: Math.PI / 4,
      frames: 2,
      setup: warn("wave"),
    });
    await check("glare");
    await close("glare");
    await draw(page, { clock: 30.85, frames: 1, setup: warn("bubbles") });
    await check("puffed");
    await close("puffed");
    await draw(page, {
      clock: 40,
      frames: 2,
      setup: "row.state.raid.warnings = []; row.state.raid.staggerUntil = 99",
    });
    await check("dizzy");
    await close("dizzy");
    await draw(page, {
      clock: 41,
      frames: 2,
      setup: "row.state.raid.staggerUntil = 0; boss.hp -= 5",
    });
    await check("hurt");
    await close("hurt");
    // stranded and flopping: several moments of the flop
    for (let n = 0; n < 4; n++) {
      await draw(page, { clock: 50 + n * 0.17, frames: 2, setup: STRAND });
      await check(`stranded ${n}`);
      if (n === 1) await close("stranded");
    }
    // surfacing: cut at the waterline, the face pieces cut with the head
    await draw(page, {
      clock: 60,
      frames: 2,
      setup:
        "row.state.raid.exposedUntil = 0; row.state.raid.islands = []; row.state.raid.submerged = true",
    });
    await draw(page, {
      clock: 60.2,
      frames: 8,
      step: 1 / 30,
      setup: "row.state.raid.submerged = false",
    });
    const rising = await check("surfacing");
    await close("surfacing");
    expect(rising.head, "its head is out of the water").toBeTruthy();
    if (rising.head.cropped && rising.eyen) {
      // the eye's kept part ends at the same screen line as the head's
      // (or, if the eye is wholly above the water, it ends above that line)
      const cut = (p: any) => p.y + (p.ch - p.fy * p.fh) * p.sy;
      const bottom = (p: any) => p.y + (1 - p.fy) * p.fh * p.sy;
      for (const k of ["eyen", "eyef", "mouth"]) {
        const f = rising[k];
        if (!f) continue;
        if (f.cropped) expect(cut(f), k).toBeCloseTo(cut(rising.head), 0);
        else expect(bottom(f), k).toBeLessThanOrEqual(cut(rising.head) + 0.5);
      }
    }
    // the Undertow spin: both drawings stay locked
    await draw(page, {
      clock: 70,
      frames: 1,
      setup: warn("undertow").replace("29", "69").replace("31", "71"),
    });
    for (let n = 1; n <= 24; n++) {
      await draw(page, { clock: 70 + n / 30, frames: 1 });
      await check(`spin ${n}`);
      if (n === 12) await close("spin");
    }
    expect(errors).toEqual([]);
  });
});

// ── the water effects in the real raid scene ──
async function lagoon(page: Page) {
  await page.route(/\/apps\/client\/src\/main\.ts(?:\?|$)/, async (route) => {
    const response = await route.fetch(),
      body = await response.text();
    const marker =
      "gameInstance.events.once(Phaser.Core.Events.POST_RENDER, syncBattleLoop);";
    expect(body).toContain(marker);
    await route.fulfill({
      response,
      body: body.replace(marker, "window.__mapGame=gameInstance;" + marker),
    });
  });
  const errors = await openHub(page);
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.evaluate(() => {
    const w = window as any;
    w.__room("raid", { boss: "tidewyrm" });
    w.__snap.remaining = 300;
    const s = w.__snap,
      r = s.raid,
      b = s.players.find((p: any) => p.raidBoss);
    r.trait = undefined;
    r.islands.forEach((i: any) => (i.radius = 78));
    b.x = 800;
    b.y = 450;
    r.submerged = false;
  });
  await openPlayPanel(page);
  await page.click("#play-create");
  await pushUntilBattle(page);
  return errors;
}
/** Change the snapshot, show it, and count what the frame draws. */
async function stage(page: Page, setup: string, wait = 600) {
  const frame = await page.evaluate((setup) => {
    const w = window as any,
      s = w.__snap;
    new Function("s", "r", setup)(s, s.raid);
    w.__push();
    return w.__mapGame.loop.frame;
  }, setup);
  await page.waitForFunction(
    (frame) => (window as any).__mapGame.loop.frame >= frame + 2,
    frame,
  );
  await page.waitForTimeout(wait);
  return page.evaluate(() => {
    const scene = (window as any).__mapGame.scene.getScene("arena");
    let images = 0;
    const walk = (list: any[], shown: boolean) => {
      for (const o of list) {
        const on = shown && o.visible !== false && (o.alpha ?? 1) > 0;
        if (o.list) walk(o.list, on);
        else if (on && (o.type === "Image" || o.type === "Sprite")) images++;
      }
    };
    walk(scene.children.list, true);
    return images;
  });
}
const lagoonShot = (page: Page, info: TestInfo, name: string) =>
  snap(page, info, `tidelotl-${name}`);

test("the water effects are painted in the real raid scene (waves, whirlpool, flood, splash)", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await lagoon(page);
  const calm =
    "r.warnings = []; r.waves = []; r.undertow = undefined; r.floodUntil = 0; r.submerged = false;";
  const counts: Record<string, number> = {};
  counts.idle = await stage(page, calm);
  await lagoonShot(page, info, "idle");
  counts.wave = await stage(
    page,
    calm +
      "r.waves = [{ id: 1, axis: 'x', dir: 1, pos: 560, speed: 0, width: 70, high: false }];",
  );
  await lagoonShot(page, info, "wave-low");
  counts.highWave = await stage(
    page,
    calm +
      "r.phase = 2; r.waves = [{ id: 2, axis: 'y', dir: -1, pos: 640, speed: 0, width: 70, high: true }];",
  );
  await lagoonShot(page, info, "wave-high");
  counts.undertow = await stage(
    page,
    calm + "r.undertow = { x: 800, y: 450, until: s.time + 30, radius: 75 };",
  );
  await lagoonShot(page, info, "undertow");
  counts.highTide = await stage(
    page,
    calm + "r.floodUntil = s.time + 30;",
    1200,
  );
  await lagoonShot(page, info, "high-tide");
  // surfacing: the crown of water as it bursts up
  await stage(page, calm + "r.submerged = true;", 300);
  // (held: this machine draws too few frames a second to catch it in passing)
  await page.evaluate(() => {
    const w = window as any,
      game = w.__mapGame;
    game.loop.sleep();
    w.__snap.raid.submerged = false;
    w.__push();
    const t = performance.now();
    game.step(t, 16);
    for (let i = 1; i <= 9; i++) game.step(t + i * 20, 20);
  });
  await lagoonShot(page, info, "surfacing");
  await page.evaluate(() => (window as any).__mapGame.loop.wake());
  console.log("tidelotl scene images per frame", JSON.stringify(counts));
  // the polish stays cheap: a handful of images over the calm frame at most
  for (const k of ["wave", "highWave", "undertow", "highTide"] as const)
    expect(counts[k] - counts.idle, k).toBeLessThanOrEqual(12);
  expect(errors).toEqual([]);
});

/**
 * Pixels in a box round world points, counted in the page from a screenshot:
 * `pink` is the soap film's iridescent rim, `white` the spray and film of a pop.
 */
async function pixels(page: Page, pts: { x: number; y: number }[], r: number) {
  const boxes = await page.evaluate(
    ([pts, r]) => {
      const game = (window as any).__mapGame,
        scene = game.scene.getScene("arena"),
        cam = scene.cameras.main,
        rect = game.canvas.getBoundingClientRect(),
        k = rect.width / game.canvas.width;
      return pts.map((p: any) => ({
        x:
          rect.left + (p.x - cam.worldView.x) * cam.zoom * k - r * cam.zoom * k,
        y: rect.top + (p.y - cam.worldView.y) * cam.zoom * k - r * cam.zoom * k,
        s: r * 2 * cam.zoom * k,
      }));
    },
    [pts, r] as const,
  );
  const png = (await page.screenshot()).toString("base64");
  return page.evaluate(
    async ([png, boxes]) => {
      const img = new Image();
      img.src = "data:image/png;base64," + png;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const g = c.getContext("2d")!;
      g.drawImage(img, 0, 0);
      const scale = img.width / innerWidth;
      let pink = 0,
        white = 0;
      for (const b of boxes as any[]) {
        const d = g.getImageData(
          b.x * scale,
          b.y * scale,
          b.s * scale,
          b.s * scale,
        ).data;
        for (let i = 0; i < d.length; i += 4) {
          const [R, G, B] = [d[i], d[i + 1], d[i + 2]];
          if (R > 200 && B > 170 && G < R - 30) pink++;
          if (R > 235 && G > 240 && B > 240) white++;
        }
      }
      return { pink, white };
    },
    [png, boxes] as const,
  );
}

test("bubbles are iridescent soap bubbles that pop with a splash; the prison is a painted bubble; the blow puffs out", async ({
  page,
}, info) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1440, height: 900 });
  const errors = await lagoon(page);
  const calm =
    "r.warnings = []; r.waves = []; r.undertow = undefined; r.floodUntil = 0; r.submerged = false; r.bubbles = []; r.prisons = [];";
  // a fan of bubbles in open water (they hold still: the client draws where the server says)
  const fan = Array.from({ length: 7 }, (_, i) => ({
    x: 960 + Math.cos(-0.6 + i * 0.2) * 170,
    y: 450 + Math.sin(-0.6 + i * 0.2) * 170,
  }));
  const counts: Record<string, number> = {};
  counts.idle = await stage(page, calm);
  const plain = await pixels(page, fan, 22);
  counts.bubbles = await stage(
    page,
    calm +
      `r.bubbles = ${JSON.stringify(fan)}.map((p, i) => ({ id: 100 + i, x: p.x, y: p.y, vx: 0, vy: 0, until: s.time + 60 }));`,
  );
  const soap = await pixels(page, fan, 22);
  await lagoonShot(page, info, "bubbles");
  // the film's iridescent rim shows at every bubble (open water has none)
  expect(soap.pink).toBeGreaterThan(plain.pink + 7 * 15);
  // the prison: a painted bubble round the sealed raider, with its pips, bar and timer
  counts.prison = await stage(
    page,
    calm +
      "const p2 = s.players.find((p) => p.id === 'p2'); p2.x = 640; p2.y = 600;" +
      "r.prisons = [{ playerId: 'p2', x: 640, y: 600, hits: 1, presses: 4, until: s.time + 60, startedAt: s.time }];",
  );
  const prison = await pixels(page, [{ x: 640, y: 588 }], 54);
  await lagoonShot(page, info, "prison");
  expect(prison.pink).toBeGreaterThan(40);
  // pops: the bubbles go, and each breaks with a ring of film and spray
  // (held: this machine draws too few frames a second to catch it in passing)
  await page.evaluate(() => {
    const w = window as any,
      game = w.__mapGame;
    game.loop.sleep();
    w.__snap.raid.bubbles = [];
    w.__snap.raid.prisons = [];
    w.__push();
    const t = performance.now();
    game.step(t, 16);
    game.step(t + 60, 60);
  });
  const popped = await pixels(page, fan, 30);
  await lagoonShot(page, info, "pop");
  await page.evaluate(() => (window as any).__mapGame.loop.wake());
  expect(popped.white).toBeGreaterThan(plain.white + 60);
  // the blow: the fan's warning fills (bubbles drawn in to the puffed cheeks), then it casts
  await stage(
    page,
    calm +
      "const b = s.players.find((p) => p.raidBoss);" +
      "r.warnings = [{ id: 501, kind: 'bubbles', startedAt: s.time - 0.6, at: s.time + 0.3, x: b.x, y: b.y, tx: b.x + 420, ty: b.y, radius: 420, spread: 0.45, casterId: b.id }];",
    500,
  );
  await lagoonShot(page, info, "bubbles-windup");
  counts.blow = await stage(page, "s.time += 0.5; r.warnings = [];", 150);
  await lagoonShot(page, info, "bubbles-blow");
  console.log("tidelotl bubble images per frame", JSON.stringify(counts));
  for (const k of ["bubbles", "prison", "blow"] as const)
    expect(counts[k] - counts.idle, k).toBeLessThanOrEqual(6);
  expect(errors).toEqual([]);
});

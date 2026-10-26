import { expect, test } from "@playwright/test";
for (const canvas of [false, true])
  test(`all eight articulated champions stay joined in ${canvas ? "Canvas fallback" : "WebGL"}`, async ({
    page,
  }, info) => {
    test.setTimeout(150_000);
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.setViewportSize({ width: 1440, height: 2080 });
    await page.route("**/champion-review", (r) =>
      r.fulfill({
        contentType: "text/html",
        body: '<body style="margin:0;background:#10182b"></body>',
      }),
    );
    await page.goto("/champion-review");
    await page.evaluate(async (canvas) => {
      const { reviewChampions } = await import("/champion-rigs.ts");
      const review = ((window as any).review = reviewChampions(canvas));
      await review.loaded;
      review.pose("idle", true);
    }, canvas);
    const audit = () => page.evaluate(() => (window as any).review.audit());
    const rest = await audit();
    expect(rest).toHaveLength(24);
    const coverage = await page.evaluate(() =>
      (window as any).review.coverage(),
    );
    for (const joint of coverage) {
      const name = `${joint.id} ${joint.dir} ${joint.part}`;
      expect(
        joint.limb,
        `${name}: complete painted joint root`,
      ).toBeGreaterThan(190);
      expect(joint.torso, `${name}: torso underlap`).toBeGreaterThan(190);
    }
    let moved = false;
    for (const state of [
      "walk",
      "run",
      "basic",
      "skill0",
      "skill1",
      "skill2",
      "skill3",
      "dash",
      "jump",
      "hurt",
      "defeat",
      "victory",
      "wave",
      "blink",
    ]) {
      for (const phase of [0.06, 0.22, 0.4, 0.7, 0.92]) {
        await page.evaluate(
          ({ state, phase }) =>
            (window as any).review.pose(state, false, phase),
          { state, phase },
        );
        const rows = await audit();
        if (state === "basic" && phase === 0.4) {
          const left = rows.find(
            (r: any) => r.id === "voltkit" && r.dir === "left",
          );
          const right = rows.find(
            (r: any) => r.id === "voltkit" && r.dir === "right",
          );
          expect(
            left.points.find((p: any) => p.part === "armR").rotation,
          ).toBeGreaterThan(0);
          expect(
            right.points.find((p: any) => p.part === "armR").rotation,
          ).toBeLessThan(0);
        }
        for (const [i, r] of rows.entries()) {
          expect(r.finite, `${r.id} ${state}`).toBe(true);
          expect(r.visible).toBe(true);
          expect(r.whole).toBe(false);
          expect(
            r.headwearAttached,
            `${r.id}: rigid headwear follows the head`,
          ).toBe(true);
          const ears = r.points.find((p: any) => p.part === "ears");
          const farEar = r.points.find((p: any) => p.part === "earFar");
          expect(
            farEar.rotation,
            `${r.id}: far ear stays attached`,
          ).toBeCloseTo(ears.rotation, 6);
          expect(farEar.x).toBeCloseTo(ears.x, 6);
          expect(farEar.y).toBeCloseTo(ears.y, 6);
          if (r.id === "terradon") {
            const shell = r.points.find((p: any) => p.part === "wings");
            const body = r.points.find((p: any) => p.part === "body");
            expect(
              shell.rotation,
              "shell follows the torso rigidly",
            ).toBeCloseTo(body.rotation, 6);
            expect(shell.scaleX).toBe(0.5);
          }
          if (
            ["auralynx", "lumoth", "mystowl", "duskveil"].includes(r.id) &&
            (state === "walk" || state === "run")
          )
            expect(
              r.rootY,
              `${r.id} glides above the ground in every direction`,
            ).toBeLessThan(r.anchorY - 3);
          expect(r.parts).toHaveLength(13);
          moved ||= JSON.stringify(r.points) !== JSON.stringify(rest[i].points);
          for (const point of r.points)
            expect(Math.hypot(point.x, point.y)).toBeLessThan(100);
        }
      }
    }
    expect(moved, "individual articulated parts follow the poses").toBe(true);
    for (const kind of ["rare", "mythical", "original"]) {
      await page.evaluate(async (kind) => {
        await (window as any).review.appearance(kind);
        (window as any).review.pose("idle", true);
      }, kind);
      for (const r of await audit()) {
        expect(r.visible).toBe(true);
        expect(r.finite).toBe(true);
        expect(r.key.includes("~")).toBe(kind !== "original");
      }
    }
    await info.attach("all-eight-left-right-back", {
      body: await page.screenshot(),
      contentType: "image/png",
    });
    expect(errors).toEqual([]);
  });

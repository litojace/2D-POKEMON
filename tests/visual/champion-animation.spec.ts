import { expect, test } from "@playwright/test";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import { FIGHTER_IDS } from "../../packages/shared/src/index";
import { REAR_ARMS_MIRRORED } from "../../apps/client/src/creature-profile";
/**
 * A prop that stands up from the near paw (Astrabun's mallet, Tidefin's
 * blade) is painted on that arm: raised overhead or turned inward, it would
 * hang upside down onto the belly or lie across the chest.
 * Greetings and victories keep that arm near the angle that holds it up.
 */
function expectPropUpright(r: any, what: string) {
  if (!r.propArm) return;
  const side = r.dir === "left" || r.dir === "right";
  const hold = side ? r.propArm.side : r.propArm.front;
  // Side drawings are mirrored: the left view's rotations are negated. So
  // are the rear arms of a champion whose held paw changes side from behind
  // (REAR_ARMS_MIRRORED).
  const arm = r.points.find((p: any) => p.part === "armR").rotation;
  const mirrored =
    r.dir === "left" || (r.dir === "up" && REAR_ARMS_MIRRORED.has(r.id));
  const local = mirrored ? -arm : arm;
  expect(
    Math.abs(local - hold),
    `${r.id} ${r.dir} ${what}: the upright prop stays up`,
  ).toBeLessThanOrEqual(
    ((side ? r.propArm.sideSwing : undefined) ?? r.propArm.swing) + 1e-6,
  );
}
const SKINNED = {
  rare: new Set(
    CHAMPION_SKINS.filter((s) => s.rarity === "rare").map((s) => s.champion),
  ),
  mythical: new Set(
    CHAMPION_SKINS.filter((s) => s.rarity === "mythical").map(
      (s) => s.champion,
    ),
  ),
};
for (const canvas of [false, true])
  for (const group of [0, 1, 2])
    test(`articulated champions ${group * 8 + 1}–${Math.min(FIGHTER_IDS.length, group * 8 + 8)} stay joined in ${canvas ? "Canvas fallback" : "WebGL"}`, async ({
      page,
    }, info) => {
      // 70 poses × 24 articulated views plus skin loads can exceed 150 seconds
      // on CI software rendering. Keep all geometry checks and allow that work.
      // (Eight champions per test, so each stays that size.)
      test.setTimeout(process.env.CI ? 300_000 : 150_000);
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
      await page.evaluate(
        async ([canvas, group]) => {
          const { reviewChampions } = await import("/champion-rigs.ts");
          const review = ((window as any).review = reviewChampions(
            canvas,
            group,
          ));
          await review.loaded;
          review.pose("idle", true);
        },
        [canvas, group] as const,
      );
      const audit = () => page.evaluate(() => (window as any).review.audit());
      const rest = await audit();
      // Three articulated views (left, right, back) per champion in the group.
      expect(rest).toHaveLength(
        3 * FIGHTER_IDS.slice(group * 8, group * 8 + 8).length,
      );
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
          if (state === "basic" && phase === 0.4 && group === 0) {
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
            if (state === "victory" || state === "wave")
              expectPropUpright(r, `${state} ${phase}`);
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
              [
                "auralynx",
                "lumoth",
                "mystowl",
                "duskveil",
                "glacelle",
              ].includes(r.id) &&
              (state === "walk" || state === "run")
            )
              expect(
                r.rootY,
                `${r.id} glides above the ground in every direction`,
              ).toBeLessThan(r.anchorY - 3);
            // Champions with an animated crest (ANIMATED_CRESTS in
            // creature-design.ts) also draw a hat layer for skin headwear.
            expect(r.parts).toHaveLength(
              ["cindrake", "terradon", "sunbara"].includes(r.id) ? 14 : 13,
            );
            moved ||=
              JSON.stringify(r.points) !== JSON.stringify(rest[i].points);
            for (const point of r.points)
              expect(Math.hypot(point.x, point.y)).toBeLessThan(100);
          }
        }
      }
      expect(moved, "individual articulated parts follow the poses").toBe(true);
      // Rockslide Flex (a Victory reward) raises both arms for everyone else.
      for (const phase of [0.5, 0.75, 0.95]) {
        await page.evaluate(
          (phase) =>
            (window as any).review.pose(
              "victory",
              false,
              phase,
              "rockslide-flex",
            ),
          phase,
        );
        for (const r of await audit())
          expectPropUpright(r, `rockslide-flex ${phase}`);
      }
      for (const kind of ["rare", "mythical", "original"]) {
        await page.evaluate(async (kind) => {
          await (window as any).review.appearance(kind);
          (window as any).review.pose("idle", true);
        }, kind);
        for (const r of await audit()) {
          expect(r.visible).toBe(true);
          expect(r.finite).toBe(true);
          // Every champion with a skin of this rarity wears it.
          expect(r.key.includes("~")).toBe(
            kind !== "original" && SKINNED[kind as "rare"].has(r.id),
          );
        }
      }
      await info.attach(
        `champions-${group * 8 + 1}-${Math.min(FIGHTER_IDS.length, group * 8 + 8)}-left-right-back`,
        {
          body: await page.screenshot(),
          contentType: "image/png",
        },
      );
      expect(errors).toEqual([]);
    });

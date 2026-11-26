import { describe, expect, it } from "vitest";
import {
  COMBAT_LAYOUT,
  controlPreferences,
  mobileLayout,
  safeViewport,
  type TouchTarget,
} from "../../apps/client/src/mobile-input";

/** The phones the battle is checked on, landscape, with their safe areas. */
const PHONES = [
  [667, 375, 0, 0],
  [844, 390, 47, 21],
  [852, 393, 59, 21],
  [932, 430, 59, 21],
] as const;
const layoutAt = (
  width: number,
  height: number,
  side: number,
  bottom: number,
  style: "corner" | "ring",
  buttonSize = 1,
) => {
  const v = safeViewport(width, height, {
    left: side,
    right: side,
    top: 0,
    bottom,
  });
  return mobileLayout(
    v.width,
    Math.max(180, v.height - 64),
    controlPreferences({ buttonSize }),
    style,
  );
};
const gap = (a: TouchTarget, b: TouchTarget) =>
  Math.hypot(a.x - b.x, a.y - b.y) - a.size / 2 - b.size / 2;

describe("the corner combat layout (owner, 26 Nov 2026)", () => {
  it("is what phones use", () => {
    expect(COMBAT_LAYOUT).toBe("corner");
  });
  for (const [width, height, side, bottom] of PHONES)
    for (const buttonSize of [0.85, 1, 1.2])
      it(`puts the basic attack in the corner at ${width}x${height} (size ${buttonSize})`, () => {
        const layout = layoutAt(
          width,
          height,
          side,
          bottom,
          "corner",
          buttonSize,
        );
        const at = Object.fromEntries(layout.targets.map((t) => [t.action, t]));
        const basic = at.attack;
        // Nothing passes the basic attack's right or bottom edge.
        for (const t of layout.targets) {
          expect(t.x + t.size / 2).toBeLessThanOrEqual(
            basic.x + basic.size / 2 + 0.01,
          );
          expect(t.y + t.size / 2).toBeLessThanOrEqual(
            basic.y + basic.size / 2 + 0.01,
          );
        }
        const margin = layout.width - (basic.x + basic.size / 2);
        expect(margin).toBeLessThan(10);
        expect(layout.height - (basic.y + basic.size / 2)).toBeCloseTo(
          margin,
          6,
        );
        // Skills 1–3: one arc round it, left to straight up, one gap apart.
        const skills = [at["0"], at["1"], at["2"]];
        const g = gap(skills[0], basic);
        for (const s of skills) expect(gap(s, basic)).toBeCloseTo(g, 6);
        expect(gap(skills[0], skills[1])).toBeCloseTo(g, 6);
        expect(gap(skills[1], skills[2])).toBeCloseTo(g, 6);
        expect(skills[0].y).toBeCloseTo(basic.y, 6);
        expect(skills[0].x).toBeLessThan(basic.x);
        expect(skills[2].y).toBeLessThan(basic.y - basic.size / 2);
        // The ultimate, Dash and Jump each sit in a gap outside the arc,
        // that same gap from both sides of it.
        for (const [key, a, b] of [
          ["3", "0", "1"],
          ["dash", "1", "2"],
          ["jump", "0", "3"],
        ] as const) {
          expect(gap(at[key], at[a])).toBeCloseTo(g, 6);
          expect(gap(at[key], at[b])).toBeCloseTo(g, 6);
        }
        // Every pair keeps at least that gap (a finger's room).
        for (let i = 0; i < layout.targets.length; i++)
          for (let j = i + 1; j < layout.targets.length; j++)
            expect(gap(layout.targets[i], layout.targets[j])).toBeGreaterThan(
              g - 0.01,
            );
        // The target button (the cancel spot while dragging): the right
        // edge, over the basic attack, clear of everything.
        const aim = layout.aim;
        expect(aim.x + aim.size / 2).toBeCloseTo(basic.x + basic.size / 2, 0);
        expect(aim.y).toBeLessThan(skills[2].y);
        for (const t of layout.targets)
          expect(
            Math.hypot(aim.x - t.x, aim.y - t.y) - aim.size / 2 - t.size / 2,
          ).toBeGreaterThan(g - 0.01);
        expect(aim.size).toBeGreaterThanOrEqual(44);
      });
  it("keeps the target button out of a squat screen's HUD band", () => {
    // 844x280 (a short visible viewport): the boss bar and clock sit just
    // over the cluster. The button stops at the HUD's allowance, still
    // clear of the buttons, and boss actions beside it stay level with it.
    const v = safeViewport(844, 280, { left: 0, right: 0, top: 0, bottom: 0 });
    const height = Math.max(180, v.height - 64);
    const layout = mobileLayout(v.width, height, undefined, "corner");
    const aim = layout.aim;
    expect(aim.y - aim.size / 2).toBeGreaterThanOrEqual(
      layout.height - height - 0.01,
    );
    for (const t of layout.targets)
      expect(
        Math.hypot(aim.x - t.x, aim.y - t.y) - aim.size / 2 - t.size / 2,
      ).toBeGreaterThan(3);
    expect(layout.context.y).toBeCloseTo(aim.y, 6);
  });
  it("keeps the ring layout one constant away", () => {
    const ring = layoutAt(844, 390, 47, 21, "ring");
    const at = Object.fromEntries(ring.targets.map((t) => [t.action, t]));
    // Dash and Jump on the basic attack's right, the target button over Dash.
    expect(at.dash.x).toBeGreaterThan(at.attack.x);
    expect(at.jump.x).toBeGreaterThan(at.attack.x);
    expect(Math.abs(ring.aim.x - at.dash.x)).toBeLessThan(12);
  });
});

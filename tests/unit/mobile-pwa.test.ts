import { describe, expect, it } from "vitest";
import {
  TouchInputState,
  mobileLayout,
  controlPreferences,
} from "../../apps/client/src/mobile-input";
import {
  safeToUpdate,
  peerMatchActive,
} from "../../apps/client/src/pwa-policy";
describe("independent touch state", () => {
  it("moves while holding attack and casting a skill", () => {
    const state = new TouchInputState();
    expect(state.startJoystick(1)).toBe(true);
    state.move(1, 40, 0, 40);
    expect(state.press(2, "attack")).toBe(true);
    expect(state.press(3, "0")).toBe(true);
    expect(state.dx).toBe(1);
    expect(state.basic).toBe(true);
    state.release(3);
    expect(state.basic).toBe(true);
    state.release(1);
    expect(state.dx).toBe(0);
    expect(state.basic).toBe(true);
    state.release(2);
    expect(state.basic).toBe(false);
  });
  it("cancels only the corresponding finger and resets interruptions", () => {
    const state = new TouchInputState();
    state.startJoystick(1);
    expect(state.startJoystick(9)).toBe(false);
    expect(state.press(1, "jump")).toBe(false);
    state.move(9, 40, 0, 40);
    expect(state.dx).toBe(0);
    state.move(1, 40, 0, 40);
    state.press(2, "attack");
    state.press(3, "dash");
    state.release(2);
    expect(state.dx).toBe(1);
    expect(state.basic).toBe(false);
    state.reset();
    expect(state.pointers.size).toBe(0);
    expect(state.joystickPointer).toBeNull();
    expect(state.dx).toBe(0);
  });
});
describe("responsive touch layout", () => {
  for (const [width, height] of [
    [320, 568],
    [667, 375],
    [844, 390],
    [1024, 768],
    [1366, 1024],
  ])
    for (const size of [0.85, 1, 1.2])
      it(`fits ${width}x${height} at size ${size} with separate targets`, () => {
        const result = mobileLayout(
          width - 24,
          height,
          controlPreferences({ buttonSize: size, joystickSize: 1.25 }),
        );
        expect(result.width + result.joystick + 24).toBeLessThanOrEqual(
          width + 2,
        );
        for (const target of result.targets) {
          expect(target.size).toBeGreaterThanOrEqual(44);
          expect(target.x - target.size / 2).toBeGreaterThanOrEqual(-0.1);
          expect(target.y - target.size / 2).toBeGreaterThanOrEqual(-0.1);
          expect(target.x + target.size / 2).toBeLessThanOrEqual(
            result.width + 0.1,
          );
          expect(target.y + target.size / 2).toBeLessThanOrEqual(
            result.height + 0.1,
          );
        }
        for (let i = 0; i < result.targets.length; i++)
          for (let j = i + 1; j < result.targets.length; j++) {
            const a = result.targets[i],
              b = result.targets[j];
            expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThan(
              (a.size + b.size) / 2 + 3,
            );
          }
      });
  it("bounds stored preferences and rejects invalid numbers", () => {
    expect(
      controlPreferences({ buttonSize: 100, opacity: -10, joystickSize: NaN }),
    ).toEqual({ buttonSize: 1.2, opacity: 0.4, joystickSize: 1 });
  });
});
it("allows updates only outside matches, including other tabs", () => {
  for (const phase of [
    "playing",
    "countdown",
    "briefing",
    "intermission",
    "paused",
    "finished",
  ])
    expect(safeToUpdate(phase)).toBe(false);
  expect(safeToUpdate("lobby")).toBe(true);
  expect(safeToUpdate(undefined)).toBe(true);
  expect(peerMatchActive([{ active: true, at: 1000 }], 2000)).toBe(true);
  expect(peerMatchActive([{ active: false, at: 1000 }], 2000)).toBe(false);
  expect(peerMatchActive([{ active: true, at: 1000 }], 200000)).toBe(false);
});

it("keeps the approved three-skill arc equally spaced at real landscape viewport sizes", () => {
  for (const [width,height] of [[844,390],[932,430],[844,280],[667,375]])
    for (const buttonSize of [0.85,1,1.2]) {
      const layout = mobileLayout(width-24,Math.max(180,height-88),controlPreferences({buttonSize}));
      const skills = layout.targets.slice(0,3),basic=layout.targets.find((t)=>t.action==="attack")!;
      const distance = (a:typeof basic,b:typeof basic)=>Math.hypot(a.x-b.x,a.y-b.y);
      expect(distance(skills[0],skills[1])).toBeCloseTo(distance(skills[1],skills[2]),8);
      for(const skill of skills) expect(distance(skill,basic)).toBeCloseTo(distance(skills[0],basic),8);
      for(const t of layout.targets) {
        expect(t.x-t.size/2).toBeGreaterThanOrEqual(0);
        expect(t.y-t.size/2).toBeGreaterThanOrEqual(0);
        expect(t.x+t.size/2).toBeLessThanOrEqual(layout.width+0.01);
        expect(t.y+t.size/2).toBeLessThanOrEqual(layout.height+0.01);
      }
    }
});

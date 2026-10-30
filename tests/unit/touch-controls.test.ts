import { describe, expect, it } from "vitest";
import { joystickVector } from "../../apps/client/src/touch-controls";
import { joystickKnob, JOYSTICK_FULL } from "../../apps/client/src/mobile-input";
const speed = (v: { dx: number; dy: number }) => Math.hypot(v.dx, v.dy);
describe("touch joystick", () => {
  it("ignores center drift", () => {
    expect(joystickVector(2, 2, 40)).toEqual({ dx: 0, dy: 0 });
  });
  it("moves at once past the dead zone and reaches full speed at about half the ring", () => {
    // Just past the dead zone: already a visible walk, not a crawl.
    expect(speed(joystickVector(6, 0, 40))).toBeGreaterThan(0.3);
    // A half push (where a thumb usually stays on a phone) is near full speed.
    expect(speed(joystickVector(20, 0, 40))).toBeGreaterThan(0.9);
    // From JOYSTICK_FULL of the radius on, full speed.
    expect(speed(joystickVector(40 * JOYSTICK_FULL, 0, 40))).toBeCloseTo(1);
    expect(speed(joystickVector(30, 0, 40))).toBeCloseTo(1);
    // Speed rises with the push, never falls.
    let last = 0;
    for (let x = 5; x <= 40; x++) {
      const s = speed(joystickVector(x, 0, 40));
      expect(s).toBeGreaterThanOrEqual(last);
      last = s;
    }
  });
  it("keeps the direction and clamps long diagonal drags to legal input magnitude", () => {
    const result = joystickVector(300, -300, 40);
    expect(speed(result)).toBeCloseTo(1);
    expect(result.dx).toBeGreaterThan(0);
    expect(result.dy).toBeLessThan(0);
    expect(result.dx).toBeCloseTo(-result.dy);
  });
  it("draws the knob under the thumb, inside the ring", () => {
    expect(joystickKnob(10, 0, 40)).toEqual({ x: 10, y: 0 });
    const far = joystickKnob(0, 120, 40);
    expect(far.x).toBe(0);
    expect(far.y).toBeCloseTo(40);
  });
});

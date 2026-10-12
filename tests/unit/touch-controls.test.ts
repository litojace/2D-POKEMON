import { describe, expect, it } from "vitest";
import { joystickVector } from "../../apps/client/src/touch-controls";
describe("touch joystick", () => {
  it("ignores center drift and supports partial movement", () => {
    expect(joystickVector(2, 2, 40)).toEqual({ dx: 0, dy: 0 });
    expect(joystickVector(20, 0, 40)).toEqual({ dx: 0.5, dy: 0 });
  });
  it("clamps long diagonal drags to legal input magnitude", () => {
    const result = joystickVector(300, -300, 40);
    expect(Math.hypot(result.dx, result.dy)).toBeCloseTo(1);
    expect(result.dx).toBeGreaterThan(0);
    expect(result.dy).toBeLessThan(0);
  });
});

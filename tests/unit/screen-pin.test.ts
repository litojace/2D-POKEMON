import { describe, expect, it } from "vitest";
import { pinScreen } from "../../apps/client/src/screen-pin";

const page = (x: number, y: number) => {
  const w = {
    scrollX: x,
    scrollY: y,
    scrollTo(nx: number, ny: number) {
      w.scrollX = nx;
      w.scrollY = ny;
    },
  };
  return w;
};

// A fixed-screen page Safari left lifted goes back to the top (screen-pin.ts).
describe("screen pin", () => {
  it("puts a lifted hub or battle back at the top", () => {
    const w = page(0, 74);
    expect(pinScreen(w, true, false, false)).toBe(true);
    expect([w.scrollX, w.scrollY]).toEqual([0, 0]);
  });
  it("leaves the keyboard's lift alone while typing", () => {
    const w = page(0, 74);
    expect(pinScreen(w, true, true, false)).toBe(false);
    expect(w.scrollY).toBe(74);
  });
  it("leaves pages that scroll, and dialogs' own pinning, alone", () => {
    expect(pinScreen(page(0, 300), false, false, false)).toBe(false);
    expect(pinScreen(page(0, 300), true, false, true)).toBe(false);
    expect(pinScreen(page(0, 0), true, false, false)).toBe(false);
  });
});

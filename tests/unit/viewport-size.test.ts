import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  MAX_AGE_MS,
  resetViewportSize,
  viewportHeight,
  viewportLandscape,
  viewportSize,
} from "../../apps/client/src/viewport-size";

/** A window whose size reads are counted (each one forces a layout). */
function fakeWindow(width: number, height: number) {
  const listeners = new Map<string, (() => void)[]>();
  const win = {
    reads: 0,
    width,
    height,
    get innerWidth() {
      win.reads++;
      return win.width;
    },
    get innerHeight() {
      win.reads++;
      return win.height;
    },
    addEventListener(type: string, run: () => void) {
      listeners.set(type, [...(listeners.get(type) ?? []), run]);
    },
    fire(type: string) {
      for (const run of listeners.get(type) ?? []) run();
    },
  };
  return win;
}

describe("the window's size, kept for per-frame code", () => {
  let win: ReturnType<typeof fakeWindow>;
  beforeEach(() => {
    win = fakeWindow(844, 390);
    vi.stubGlobal("window", win);
    resetViewportSize();
  });
  afterEach(() => vi.unstubAllGlobals());

  it("reads the window once for a second of frames, not once a frame", () => {
    for (let frame = 0; frame < 60; frame++) {
      const now = 1000 + frame * (1000 / 60);
      expect(viewportLandscape(now)).toBe(true);
      expect(viewportHeight(now)).toBe(390);
    }
    // Width and height, at most every MAX_AGE_MS.
    expect(win.reads).toBeLessThanOrEqual(2 * Math.ceil(1000 / MAX_AGE_MS));
    expect(win.reads).toBeGreaterThan(0);
  });
  it("follows a resize at once (a turned phone, a resized window)", () => {
    expect(viewportLandscape(5000)).toBe(true);
    win.width = 390;
    win.height = 844;
    // Before the event, the kept size still answers.
    expect(viewportLandscape(5001)).toBe(true);
    win.fire("resize");
    expect(viewportLandscape(5002)).toBe(false);
    expect(viewportSize(5003)).toEqual({ width: 390, height: 844 });
  });
  it("catches a size that settled with no event, within MAX_AGE_MS", () => {
    expect(viewportHeight(9000)).toBe(390);
    win.height = 375;
    expect(viewportHeight(9000 + MAX_AGE_MS - 1)).toBe(390);
    expect(viewportHeight(9000 + MAX_AGE_MS)).toBe(375);
  });
});

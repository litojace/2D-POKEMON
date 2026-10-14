import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  INTERACTIVE,
  LOCKED_VIEWPORT_EXTRA,
  blocksDoubleTap,
  lockedViewport,
} from "../../apps/client/src/zoom-guard";

describe("battle zoom lock", () => {
  it("locks the viewport while keeping the page's own settings", () => {
    expect(
      lockedViewport("width=device-width,initial-scale=1,viewport-fit=cover"),
    ).toBe(
      `width=device-width,initial-scale=1,viewport-fit=cover,${LOCKED_VIEWPORT_EXTRA}`,
    );
    // Replaces, never duplicates, existing zoom limits.
    expect(
      lockedViewport("width=device-width, maximum-scale=5, user-scalable=yes"),
    ).toBe(`width=device-width,${LOCKED_VIEWPORT_EXTRA}`);
  });
  it("blocks only a quick second tap that misses the controls", () => {
    expect(blocksDoubleTap(1000, 1200, false)).toBe(true);
    expect(blocksDoubleTap(1000, 1200, true)).toBe(false); // buttons keep rapid taps
    expect(blocksDoubleTap(1000, 1500, false)).toBe(false); // slow taps are fine
    expect(blocksDoubleTap(-Infinity, 10, false)).toBe(false);
    expect(INTERACTIVE).toContain("button");
    expect(INTERACTIVE).toContain(".joystick-area");
  });
  it("the stylesheet turns the lock into touch-action: none, with pan-only scroll panels", () => {
    const css = readFileSync("apps/client/src/style.css", "utf8");
    expect(css).toMatch(
      /html\.zoom-locked body \*\s*\{\s*touch-action: none !important;/,
    );
    expect(css).toMatch(
      /html\.zoom-locked \.overlay-card,[\s\S]*?touch-action: pan-x pan-y !important;/,
    );
    // Menus keep pinch zoom for accessibility outside battles.
    expect(css).toMatch(/\*\s*\{\s*touch-action: manipulation;/);
  });
});

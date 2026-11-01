import { afterEach, expect, it, vi } from "vitest";
import {
  orientationFlipped,
  settleAfterRotation,
  SETTLE_DELAYS,
} from "../../apps/client/src/orientation-settle";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

it("spots a switch between portrait and landscape only", () => {
  expect(
    orientationFlipped(
      { width: 932, height: 430 },
      { width: 430, height: 932 },
    ),
  ).toBe(true);
  expect(
    orientationFlipped(
      { width: 430, height: 932 },
      { width: 932, height: 430 },
    ),
  ).toBe(true);
  expect(
    orientationFlipped(
      { width: 932, height: 430 },
      { width: 900, height: 400 },
    ),
  ).toBe(false);
});

it("re-sends resize as the size settles, scrolls an unscrollable page home, and undoes a zoom", () => {
  vi.useFakeTimers();
  const meta = {
    content: "width=device-width,initial-scale=1,viewport-fit=cover",
  };
  const dispatchEvent = vi.fn();
  const scrollTo = vi.fn();
  vi.stubGlobal("document", {
    documentElement: {
      scrollHeight: 430,
      clientHeight: 430,
      scrollWidth: 932,
      clientWidth: 932,
    },
    querySelector: () => meta,
  });
  vi.stubGlobal("window", {
    scrollX: 0,
    scrollY: 40,
    visualViewport: { scale: 1.4 },
    dispatchEvent,
    scrollTo,
  });
  vi.stubGlobal(
    "Event",
    class {
      constructor(public type: string) {}
    },
  );
  settleAfterRotation();
  settleAfterRotation(); // a second rotation restarts, not doubles
  vi.advanceTimersByTime(SETTLE_DELAYS[0] + 1);
  expect(meta.content).toContain("maximum-scale=1");
  vi.advanceTimersByTime(SETTLE_DELAYS.at(-1)! + 400);
  expect(dispatchEvent).toHaveBeenCalledTimes(SETTLE_DELAYS.length);
  expect(scrollTo).toHaveBeenCalledWith(0, 0);
  expect(meta.content).toBe(
    "width=device-width,initial-scale=1,viewport-fit=cover",
  );
});

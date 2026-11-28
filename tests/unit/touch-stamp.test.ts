import { describe, expect, it } from "vitest";
import {
  SAME_DISPATCH_MS,
  TouchClock,
} from "../../apps/client/src/touch-stamp";
import { NetMeter } from "../../apps/client/src/battle-perf";

/** An event with a given timeStamp (as the browser stamped it). */
const ev = (timeStamp: number) => ({ timeStamp }) as Event;

describe("a touch's own time (WebKit stamps any finger's last change)", () => {
  it("a new event newer than every one seen keeps its time", () => {
    const clock = new TouchClock();
    const a = ev(100);
    clock.see(a, 101);
    const b = ev(400);
    clock.see(b, 402);
    expect(clock.stampOf(a)).toBe(100);
    expect(clock.stampOf(b)).toBe(400);
  });

  it("a tap stamped with the still thumb's last move is not timed", () => {
    const clock = new TouchClock();
    // The thumb pushes the stick at 1000 and rests.
    clock.see(ev(1000), 1002);
    // 800 ms later the other hand taps a skill: WebKit hands it the
    // thumb's time (touches.anyObject.timestamp).
    const tap = ev(1000);
    clock.see(tap, 1802);
    expect(clock.stampOf(tap)).toBeUndefined();
    expect(clock.isStale(tap)).toBe(true);
  });

  it("an older stamp than one already delivered is another finger's", () => {
    const clock = new TouchClock();
    clock.see(ev(1000), 1001);
    clock.see(ev(1300), 1301);
    const lift = ev(1000);
    clock.see(lift, 1700);
    expect(clock.stampOf(lift)).toBeUndefined();
  });

  it("events of one dispatch share a stamp (pointerdown then touchstart)", () => {
    const clock = new TouchClock();
    const down = ev(500);
    const start = ev(500);
    clock.see(down, 503);
    clock.see(start, 503 + SAME_DISPATCH_MS - 1);
    expect(clock.stampOf(down)).toBe(500);
    expect(clock.stampOf(start)).toBe(500);
  });
});

describe("the meter keeps stale touches apart from the waits", () => {
  it("counts them as pressStale and never as eventToHandler", () => {
    const meter = new NetMeter();
    meter.press("skill1", undefined, 2000, 0, "touch-controls");
    meter.press("skill2", undefined, 2100, 0, "touch-controls");
    // A gamepad press has no DOM time either: not a stale touch.
    meter.press("dash", undefined, 2200, 0, "unknown");
    meter.press("basic", 2290, 2300, 0, "touch-controls");
    meter.input({ basic: true, skill: -1, dash: false, jump: false }, 2320);
    const s = meter.summary();
    expect(s.pressStale).toBe(2);
    expect(s.pressSamples).toBe(1);
    expect(s.eventToHandlerP95).toBe(10);
  });
});

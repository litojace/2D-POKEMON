import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTO_MIN_FPS,
  AUTO_SLOW_WINDOWS,
  autoChoosesLow,
  autoLowWhy,
  FrameRateProbe,
  graphicsSetting,
  lowGraphics,
  rememberAutoLow,
  setGraphicsSetting,
} from "../../apps/client/src/graphics-quality";

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  (globalThis as any).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** Feed the probe steady frames at `fps` for `seconds`. */
function run(probe: FrameRateProbe, fps: number, seconds: number, from = 0) {
  let verdict;
  for (let t = from; t <= from + seconds * 1000; t += 1000 / fps)
    verdict = probe.frame(t) ?? verdict;
  return verdict;
}

describe("Settings → Graphics", () => {
  it("defaults to Auto, which starts High on an ordinary device", () => {
    expect(graphicsSetting()).toBe("auto");
    expect(autoChoosesLow(8)).toBe(false);
    expect(lowGraphics()).toBe(false);
  });
  it("a manual pick wins over Auto either way", () => {
    rememberAutoLow();
    setGraphicsSetting("high");
    expect(lowGraphics()).toBe(false);
    setGraphicsSetting("low");
    expect(lowGraphics()).toBe(true);
  });
  it("Auto remembers a slow device, and choosing Auto again measures afresh", () => {
    rememberAutoLow();
    expect(lowGraphics()).toBe(true);
    setGraphicsSetting("auto");
    expect(lowGraphics()).toBe(false);
  });
  it("remembers where and how slow, for Settings and the read-out", () => {
    expect(autoLowWhy()).toBe("");
    rememberAutoLow("Plaza ran at 41 fps");
    expect(autoLowWhy()).toBe("Plaza ran at 41 fps");
    // Choosing Auto again forgets the reason with the verdict.
    setGraphicsSetting("auto");
    expect(autoLowWhy()).toBe("");
    // Low without a measure (a slow device reported before): no reason.
    rememberAutoLow();
    expect(autoLowWhy()).toBe("");
  });
  it("Auto starts Low on a device reporting 2 GB of memory or less", () => {
    expect(autoChoosesLow(2)).toBe(true);
    expect(autoChoosesLow(1)).toBe(true);
    expect(autoChoosesLow(4)).toBe(false);
    expect(autoChoosesLow(undefined)).toBe(false);
  });
  it("survives storage that throws (private mode)", () => {
    (globalThis as any).localStorage = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    };
    expect(graphicsSetting()).toBe("auto");
    expect(() => setGraphicsSetting("low")).not.toThrow();
    expect(() => rememberAutoLow()).not.toThrow();
  });
});

describe("Auto's frame-rate probe", () => {
  it("passes a phone holding 60, and a 120 Hz screen", () => {
    expect(run(new FrameRateProbe(), 60, 8)).toBe("ok");
    expect(run(new FrameRateProbe(), 120, 8)).toBe("ok");
  });
  it("switches a device stuck around 25 fps (or just under the bar) to Low", () => {
    const p = new FrameRateProbe();
    expect(run(p, 25, 16)).toBe("low");
    expect(p.lastFps).toBeCloseTo(25, 0);
    expect(run(new FrameRateProbe(), AUTO_MIN_FPS - 3, 16)).toBe("low");
  });
  it("needs three slow windows in a row, not one slow moment", () => {
    expect(AUTO_SLOW_WINDOWS).toBe(3);
    // Two slow windows (8 s after the 2 s warm-up; the third would end at
    // 14 s): still measuring.
    const p = new FrameRateProbe();
    expect(run(p, 30, 11)).toBeUndefined();
    expect(p.slow).toBe(2);
    // Then a smooth window: the device is fine.
    expect(run(p, 60, 5, 11_100)).toBe("ok");
    // One slow window (a heavy moment) alone never decides.
    const q = new FrameRateProbe();
    expect(run(q, 20, 6)).toBeUndefined();
    expect(run(q, 60, 5, 6100)).toBe("ok");
  });
  it("says nothing until it has seen enough, and ignores the loading moments", () => {
    const p = new FrameRateProbe();
    // Loading: a couple of very slow frames, then smooth.
    p.frame(0);
    p.frame(200);
    p.frame(400);
    expect(run(p, 60, 4, 400)).toBeUndefined();
    expect(run(p, 60, 4, 4500)).toBe("ok");
  });
  it("does not blame the device for pauses (a panel open, tab hidden)", () => {
    const p = new FrameRateProbe();
    run(p, 60, 3);
    p.pause();
    // Frames resume after a long gap: the gap itself is not a slow frame.
    expect(run(p, 60, 5, 30_000)).toBe("ok");
  });
  it("does not blame a smooth phone for coming back to a screen often", () => {
    // A 60 fps phone switching between the hub's scenes (owner's iPhone,
    // 19 Nov 2026): each return repaints the scene (its ground, let go while
    // away) in one long frame, and the screen goes again a second or so
    // later. Those returns used to add up across visits into "slow" windows
    // (47 fps) until Auto chose Low for good.
    let p = new FrameRateProbe();
    expect(run(p, 60, 7)).toBe("ok");
    p = new FrameRateProbe(0); // as the Plaza keeps watching
    let t = 10_000;
    for (let visit = 0; visit < 40; visit++) {
      p.pause(); // the screen was left (hide)
      t += 3000;
      p.frame(t);
      t += 350; // the return's long frame
      const verdict = run(p, 60, 1.2, t);
      expect(verdict).not.toBe("low");
      if (verdict === "ok") p = new FrameRateProbe(0);
      t += 1200;
    }
    // A slow device still gets Low, once it stays on a screen a while.
    const slow = new FrameRateProbe(0);
    t = 0;
    for (let visit = 0; visit < 5; visit++) {
      slow.pause();
      t += 3000;
      slow.frame(t);
      t += 350;
      run(slow, 30, 6, t);
      t += 6000;
    }
    expect(slow.verdict).toBe("low");
  });
  it("answers once", () => {
    const p = new FrameRateProbe();
    expect(run(p, 20, 16)).toBe("low");
    expect(run(p, 60, 8, 17_000)).toBe("low");
  });
});

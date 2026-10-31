import { beforeEach, describe, expect, it } from "vitest";
import {
  AUTO_MIN_FPS,
  autoChoosesLow,
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
  for (let t = from; t <= from + seconds * 1000; t += 1000 / fps) verdict = probe.frame(t) ?? verdict;
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
  it("Auto starts Low on a device reporting 2 GB of memory or less", () => {
    expect(autoChoosesLow(2)).toBe(true);
    expect(autoChoosesLow(1)).toBe(true);
    expect(autoChoosesLow(4)).toBe(false);
    expect(autoChoosesLow(undefined)).toBe(false);
  });
  it("survives storage that throws (private mode)", () => {
    (globalThis as any).localStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
      removeItem: () => { throw new Error("blocked"); },
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
    expect(run(new FrameRateProbe(), 25, 8)).toBe("low");
    expect(run(new FrameRateProbe(), AUTO_MIN_FPS - 3, 8)).toBe("low");
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
  it("answers once", () => {
    const p = new FrameRateProbe();
    expect(run(p, 20, 8)).toBe("low");
    expect(run(p, 60, 8, 9000)).toBe("low");
  });
});

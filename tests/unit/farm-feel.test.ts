import { describe, expect, it } from "vitest";
import {
  FarmFeel,
  goldenLevel,
  isSuperSwipe,
  nightLevel,
  weatherLook,
} from "../../apps/client/src/farm/farm-feel";
import { FARM_WEATHER_BY_ID } from "../../packages/shared/src/farm";
import {
  FARM_CUES,
  playFarmCue,
  popPitch,
} from "../../apps/client/src/farm/farm-sound";

describe("farm time of day", () => {
  it("follows the Plaza's night curve", () => {
    expect(nightLevel(0.5)).toBe(0);
    expect(nightLevel(0)).toBe(1);
    expect(nightLevel(0.95)).toBe(1);
    expect(nightLevel(0.75)).toBeCloseTo(0.5);
    expect(nightLevel(0.25)).toBeCloseTo(0.5);
  });
  it("glows gold at 17:30 and a little at dawn, never at noon or midnight", () => {
    expect(goldenLevel(0.73)).toBeCloseTo(1);
    expect(goldenLevel(0.27)).toBeCloseTo(0.5);
    expect(goldenLevel(0.5)).toBe(0);
    expect(goldenLevel(0)).toBe(0);
    for (let t = 0; t <= 1; t += 0.01) {
      expect(goldenLevel(t)).toBeGreaterThanOrEqual(0);
      expect(goldenLevel(t)).toBeLessThanOrEqual(1);
    }
  });
});

describe("farm swipe combos", () => {
  it("cheers at 6, 12, 18 crops in one swipe", () => {
    expect([1, 5, 6, 7, 11, 12, 18].map(isSuperSwipe)).toEqual([
      false,
      false,
      true,
      false,
      false,
      true,
      true,
    ]);
  });
  it("raises the pop a whole tone per crop, up to 14 steps", () => {
    expect(popPitch(0)).toBe(1);
    expect(popPitch(6)).toBeCloseTo(2);
    expect(popPitch(-3)).toBe(1);
    expect(popPitch(40)).toBe(popPitch(14));
  });
});

describe("farm particles", () => {
  const make = (reduced = false) =>
    new FarmFeel({ reduced, low: () => false, width: 1760, height: 800 });
  it("make a burst and clear it when it has lived", () => {
    const feel = make();
    feel.burst(100, 100, 10, "spark", { life: 0.5 });
    expect(feel.parts).toHaveLength(10);
    for (let k = 0; k < 40; k++) feel.step(0.05, () => 0);
    expect(feel.parts).toHaveLength(0);
  });
  it("make fewer with reduced motion", () => {
    const feel = make(true);
    feel.burst(0, 0, 10, "leaf");
    feel.pop(0, 0, 50);
    expect(feel.parts.length).toBeLessThan(10);
    expect(feel.confetti.length).toBeLessThan(50);
  });
  it("let falling fruit and leaves rest on the ground", () => {
    const feel = make();
    feel.fruit(0, 0, 200, "#e8453c");
    feel.burst(0, 0, 3, "leaf", { floor: 50, life: 10 });
    for (let k = 0; k < 60; k++) feel.step(0.05, () => 0);
    for (const q of feel.parts) expect(q.y).toBeLessThanOrEqual(q.floor!);
  });
});

/** A stand-in for an audio context: counts what each cue starts. */
function fakeAudio() {
  const started: string[] = [];
  const param = () => ({
    value: 0,
    setValueAtTime() {},
    exponentialRampToValueAtTime() {},
    setTargetAtTime() {},
  });
  const node = (kind: string) => ({
    kind,
    frequency: param(),
    gain: param(),
    Q: param(),
    type: "",
    buffer: null as unknown,
    loop: false,
    connect: (n: unknown) => n,
    start: () => started.push(kind),
    stop() {},
  });
  const ctx = {
    currentTime: 0,
    createOscillator: () => node("osc"),
    createGain: () => node("gain"),
    createBiquadFilter: () => node("filter"),
    createBufferSource: () => node("noise"),
  };
  return { ctx: ctx as unknown as BaseAudioContext, started };
}

describe("farm sounds", () => {
  const noise = { duration: 1 } as AudioBuffer;
  it("every cue plays something", () => {
    for (const cue of FARM_CUES) {
      const { ctx, started } = fakeAudio();
      playFarmCue(ctx, {} as AudioNode, 0.3, noise, cue, 3);
      expect(started.length, cue).toBeGreaterThan(0);
    }
  });
  it("is silent at Effects 0", () => {
    const { ctx, started } = fakeAudio();
    for (const cue of FARM_CUES)
      playFarmCue(ctx, {} as AudioNode, 0, noise, cue);
    expect(started).toEqual([]);
  });
});

describe("weatherLook", () => {
  const look = (id: string, night: number) =>
    weatherLook(
      FARM_WEATHER_BY_ID[id as keyof typeof FARM_WEATHER_BY_ID],
      night,
    );
  it("names the weather for the hour, keeping what it does", () => {
    expect(look("sun", 0).name).toBe("Sunny");
    expect(look("sun", 1)).toMatchObject({ name: "Clear Night", icon: "star" });
    expect(look("sun", 1).text).toBe(FARM_WEATHER_BY_ID.sun.text);
    expect(look("rainbow", 1).name).toBe("Moonbow");
    expect(look("rainbow", 0).name).toBe("Rainbow");
    expect(look("moon", 0).name).toBe("Daytime Moon");
    expect(look("moon", 1).name).toBe("Moonlit Night");
    // Rain, storms and frost look the same at any hour.
    for (const id of ["rain", "storm", "frost"])
      expect(look(id, 1)).toBe(FARM_WEATHER_BY_ID[id as "rain"]);
    // Dusk: night from halfway.
    expect(look("sun", 0.49).name).toBe("Sunny");
    expect(look("sun", 0.5).name).toBe("Clear Night");
  });
});

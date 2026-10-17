import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { AudioManager } from "../../apps/client/src/audio";

let allowed: boolean, page: EventTarget & { hidden: boolean }, win: EventTarget;
let contexts: FakeAudioContext[];
const parameter = () => ({
  value: 1,
  setValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
});
const node = () => ({
  gain: parameter(),
  frequency: parameter(),
  detune: parameter(),
  delayTime: parameter(),
  pan: parameter(),
  Q: parameter(),
  connect: vi.fn(function (target: unknown) {
    return target;
  }),
  disconnect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
  type: "sine",
  onended: null,
});
class FakeAudioContext {
  state = "suspended";
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  gains: ReturnType<typeof node>[] = [];
  oscillators: ReturnType<typeof node>[] = [];
  constructor() {
    contexts.push(this);
  }
  resume = vi.fn(async () => {
    if (!allowed) throw new Error("Gesture needed");
    this.state = "running";
  });
  createGain = () => {
    const n = node();
    this.gains.push(n);
    return n;
  };
  createOscillator = () => {
    const n = node();
    this.oscillators.push(n);
    return n;
  };
  createBiquadFilter = node;
  createDelay = node;
  createStereoPanner = node;
  createBufferSource = node;
  createBuffer = () => ({ getChannelData: () => new Float32Array(25) });
}
beforeEach(() => {
  vi.useFakeTimers();
  allowed = false;
  contexts = [];
  page = Object.assign(new EventTarget(), { hidden: false });
  win = new EventTarget();
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", win);
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("attempts autoplay at startup and succeeds without a click where permitted", () => {
  allowed = true;
  const audio = new AudioManager();
  audio.start();
  expect(contexts).toHaveLength(1);
  expect(contexts[0].resume).toHaveBeenCalledOnce();
  expect(contexts[0].oscillators.length).toBeGreaterThan(0);
});
it("recovers blocked autoplay on any page interaction without duplicate players or schedulers", async () => {
  const audio = new AudioManager();
  audio.start();
  audio.start();
  await Promise.resolve();
  expect(contexts[0].oscillators).toHaveLength(0);
  allowed = true;
  page.dispatchEvent(new Event("pointerdown"));
  await Promise.resolve();
  page.dispatchEvent(new Event("keydown"));
  page.dispatchEvent(new Event("touchend"));
  expect(contexts).toHaveLength(1);
  expect(contexts[0].oscillators.length).toBeGreaterThan(0);
  expect(vi.getTimerCount()).toBe(1);
});
it("resumes an interrupted context when the app regains focus", async () => {
  allowed = true;
  const audio = new AudioManager();
  audio.start();
  await Promise.resolve();
  contexts[0].state = "suspended";
  win.dispatchEvent(new Event("focus"));
  await Promise.resolve();
  expect(contexts[0].state).toBe("running");
  expect(contexts[0].resume).toHaveBeenCalledTimes(2);
});
it("respects a saved mute and silences sustained music when the app is hidden", () => {
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => (key === "arena-music" ? "0" : null),
    setItem: vi.fn(),
  });
  allowed = true;
  const audio = new AudioManager();
  audio.start();
  expect(contexts[0].oscillators).toHaveLength(0);
  expect(contexts[0].gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
    0,
    0,
    0.08,
  );
  audio.set("music", 0.4);
  page.hidden = true;
  page.dispatchEvent(new Event("visibilitychange"));
  expect(contexts[0].gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
    0,
    0,
    0.08,
  );
  page.hidden = false;
  page.dispatchEvent(new Event("visibilitychange"));
  expect(contexts[0].gains[0].gain.setTargetAtTime).toHaveBeenLastCalledWith(
    0.2,
    0,
    0.08,
  );
});
it("crossfades theme changes and retires the old music bus", () => {
  allowed = true;
  const audio = new AudioManager();
  audio.start();
  const old = contexts[0].gains[1];
  audio.setTheme("raid", 3);
  expect(old.gain.setTargetAtTime).toHaveBeenCalledWith(0, 0, 0.25);
  vi.advanceTimersByTime(1850);
  expect(old.disconnect).toHaveBeenCalledOnce();
  expect(contexts).toHaveLength(1);
});

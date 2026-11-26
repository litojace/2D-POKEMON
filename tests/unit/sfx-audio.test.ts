import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { CHARACTERS } from "@arena/shared";
import { AudioManager } from "../../apps/client/src/audio";

/** A Web Audio stand-in that counts what each sound started. */
const parameter = () => ({
  value: 1,
  setValueAtTime: vi.fn(),
  setTargetAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  cancelScheduledValues: vi.fn(),
});
let started: { onended: (() => void) | null }[];
const node = () => {
  const n = {
    gain: parameter(),
    frequency: parameter(),
    detune: parameter(),
    delayTime: parameter(),
    pan: parameter(),
    Q: parameter(),
    connect: vi.fn((target: unknown) => target),
    disconnect: vi.fn(),
    start: vi.fn(() => started.push(n)),
    stop: vi.fn(),
    type: "sine",
    onended: null as (() => void) | null,
  };
  return n;
};
class FakeAudioContext {
  state = "running";
  currentTime = 0;
  sampleRate = 100;
  destination = {};
  resume = vi.fn(async () => {});
  createGain = node;
  createOscillator = node;
  createBiquadFilter = node;
  createDelay = node;
  createStereoPanner = node;
  createBufferSource = node;
  createBuffer = () => ({
    duration: 1,
    getChannelData: () => new Float32Array(100),
  });
}
let page: EventTarget & { hidden: boolean };
beforeEach(() => {
  vi.useFakeTimers();
  started = [];
  page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal("document", page);
  vi.stubGlobal("window", new EventTarget());
  vi.stubGlobal("AudioContext", FakeAudioContext);
  vi.stubGlobal("localStorage", { getItem: () => null, setItem: vi.fn() });
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
/** A started manager, with music off so only effects start sources. */
function manager() {
  const audio = new AudioManager();
  audio.music = 0;
  audio.start();
  started.length = 0;
  return audio;
}
const ability = CHARACTERS.cindrake.skills[1].id;

it("plays a cast once per gap, however many times it is asked", () => {
  const audio = manager();
  audio.cast(ability, "me");
  const one = started.length;
  expect(one).toBeGreaterThan(0);
  audio.cast(ability, "me");
  expect(started.length).toBe(one);
  (audio.context as unknown as FakeAudioContext).currentTime = 0.2;
  audio.cast(ability, "me");
  expect(started.length).toBe(one * 2);
});

it("stays silent with effects muted or the app hidden", () => {
  const audio = manager();
  audio.set("effects", 0);
  audio.cue("dash");
  expect(started).toHaveLength(0);
  audio.set("effects", 0.5);
  page.hidden = true;
  audio.cue("dash");
  expect(started).toHaveLength(0);
  page.hidden = false;
  audio.cue("dash");
  expect(started.length).toBeGreaterThan(0);
});

it("lets other players' sounds give way when many play at once", () => {
  const audio = manager();
  const cast = (owner: string) =>
    audio.event(
      {
        id: 1,
        kind: "cast",
        x: 800,
        y: 450,
        color: 0,
        owner,
        abilityId: ability,
      },
      { me: "me" },
    );
  for (let i = 0; i < 30; i++) cast(`rival${i}`);
  const others = started.length;
  // Others stop well before the cap on yours.
  for (let i = 0; i < 30; i++) cast(`rival-late${i}`);
  expect(started.length).toBe(others);
  audio.cue("ult-ready");
  expect(started.length).toBeGreaterThan(others);
  // As sounds end, room comes back.
  for (const s of [...started]) s.onended?.();
  const before = started.length;
  cast("rival-after");
  expect(started.length).toBeGreaterThan(before);
});

it("ticks each second of the countdown once, then calls the fight", () => {
  const audio = manager();
  const ctx = audio.context as unknown as FakeAudioContext;
  const counts: number[] = [];
  for (const [phase, remaining] of [
    ["countdown", 2.9],
    ["countdown", 2.5],
    ["countdown", 1.9],
    ["countdown", 0.9],
    ["countdown", 0.2],
    ["playing", 60],
    ["playing", 59],
  ] as const) {
    ctx.currentTime += 0.5;
    const before = started.length;
    audio.countdown(phase, remaining);
    counts.push(started.length - before > 0 ? 1 : 0);
  }
  expect(counts).toEqual([1, 0, 1, 1, 0, 1, 0]);
});

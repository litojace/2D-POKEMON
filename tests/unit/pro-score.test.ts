import { describe, expect, it, vi } from "vitest";
import {
  MUSIC_LOOP_STEPS,
  PRO_THEMES,
  scoreStep,
  type ScoreNote,
} from "../../apps/client/src/music-score";
import { ProSynth } from "../../apps/client/src/pro-synth";
import { noteHz } from "../../apps/client/src/audio";

const loop = (theme: "lobby" | "pvp") =>
  Array.from({ length: MUSIC_LOOP_STEPS }, (_, s) =>
    scoreStep(theme, s),
  ).flat();
/** The notes of one 16-step bar of a theme's loop. */
const bar = (theme: "lobby" | "pvp", b: number) =>
  Array.from({ length: 16 }, (_, s) => scoreStep(theme, b * 16 + s)).flat();

describe("the produced hub and PvP themes", () => {
  it("play only the produced voices, with real pitches", () => {
    expect([...PRO_THEMES].sort()).toEqual(["lobby", "pvp"]);
    for (const theme of ["lobby", "pvp"] as const) {
      const notes = loop(theme);
      expect(notes.length).toBeGreaterThan(1000);
      for (const n of notes) {
        expect(n.instrument.startsWith("pro-"), n.instrument).toBe(true);
        expect(n.duration).toBeGreaterThan(0);
        expect(n.volume).toBeGreaterThan(0);
        for (const name of [n.note, n.from, ...(n.notes ?? [])])
          if (name) expect(noteHz(name)).toBeGreaterThan(20);
      }
    }
  });
  it("arrange like a shipped soundtrack: glides, a counter-line, a riser, fills", () => {
    for (const theme of ["lobby", "pvp"] as const) {
      const notes = loop(theme);
      const has = (i: string) => notes.filter((n) => n.instrument === i);
      // Leads glide into some long notes.
      expect(notes.some((n) => n.from)).toBe(true);
      // One riser, into the chorus (the bridge's last bar, bar 23).
      expect(has("pro-riser")).toHaveLength(1);
      expect(bar(theme, 23).some((n) => n.instrument === "pro-riser")).toBe(
        true,
      );
      // Tom fills close sections; crashes open them.
      expect(has("pro-tom").length).toBeGreaterThan(0);
      expect(has("pro-crash").length).toBeGreaterThan(0);
      // The kick and the pad and bass it ducks are all there.
      for (const i of ["pro-kick", "pro-pad", "pro-bass", "pro-pluck"])
        expect(has(i).length, `${theme} ${i}`).toBeGreaterThan(0);
    }
    // The hub opens gently: no kick or bass in its first two bars.
    const intro = [...bar("lobby", 0), ...bar("lobby", 1)];
    expect(
      intro.some(
        (n) => n.instrument === "pro-kick" || n.instrument === "pro-bass",
      ),
    ).toBe(false);
  });
  it("keeps the bridge quieter than the chorus", () => {
    for (const theme of ["lobby", "pvp"] as const) {
      const busy = (from: number) =>
        Array.from({ length: 8 }, (_, i) => bar(theme, from + i)).flat().length;
      expect(busy(24), theme).toBeGreaterThan(busy(16));
    }
  });
});

describe("the produced voices", () => {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
  });
  const node = () => ({
    gain: param(),
    frequency: param(),
    detune: param(),
    Q: param(),
    pan: param(),
    delayTime: param(),
    type: "",
    buffer: null as unknown,
    loop: false,
    connect: vi.fn((n: unknown) => n),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    setPeriodicWave: vi.fn(),
    onended: null as unknown,
  });
  /** A context with only the basics: no compressor, convolver or custom waves. */
  function bare() {
    const oscillators: ReturnType<typeof node>[] = [];
    const ctx = {
      sampleRate: 100,
      currentTime: 0,
      createGain: node,
      createBiquadFilter: node,
      createStereoPanner: node,
      createDelay: node,
      createBufferSource: node,
      createOscillator: () => {
        const o = node();
        oscillators.push(o);
        return o;
      },
      createBuffer: (_c: number, n: number, rate: number) => ({
        duration: n / rate,
        sampleRate: rate,
        getChannelData: () => new Float32Array(n),
      }),
    };
    return {
      ctx: ctx as unknown as BaseAudioContext,
      oscillators,
      noise: ctx.createBuffer(1, 100, 100) as unknown as AudioBuffer,
    };
  }
  it("still play where a browser lacks the compressor, the reverb and custom waves", () => {
    const { ctx, oscillators, noise } = bare();
    const synth = new ProSynth(ctx, node() as unknown as AudioNode, noise, 112);
    const notes: ScoreNote[] = Array.from({ length: 64 }, (_, s) =>
      scoreStep("lobby", 16 * 8 + s),
    ).flat();
    expect(notes.length).toBeGreaterThan(0);
    for (const n of notes) synth.play(n, 1);
    expect(oscillators.length).toBeGreaterThan(0);
    // Pulse voices fall back to squares.
    expect(oscillators.some((o) => o.type === "square")).toBe(true);
    synth.disconnect();
  });
  it("duck the pads and bass under each kick", () => {
    const { ctx, noise } = bare();
    const gains: ReturnType<typeof node>[] = [];
    const tracked = {
      ...ctx,
      createGain: () => {
        const g = node();
        gains.push(g);
        return g;
      },
    } as unknown as BaseAudioContext;
    const synth = new ProSynth(
      tracked,
      node() as unknown as AudioNode,
      noise,
      112,
    );
    synth.play({ instrument: "pro-kick", duration: 0.2, volume: 0.5 }, 2);
    const ducked = gains.some((g) =>
      g.gain.linearRampToValueAtTime.mock.calls.some(
        ([v, t]) => v === 0.5 && Math.abs(t - 2.012) < 1e-9,
      ),
    );
    expect(ducked).toBe(true);
  });
});

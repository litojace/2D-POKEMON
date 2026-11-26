import { describe, expect, it, vi } from "vitest";
import {
  MUSIC_BPM,
  MUSIC_LOOP_STEPS,
  RESULT_MUSIC_STEPS,
  scoreStep,
  type BackgroundTheme,
  type ScoreNote,
} from "../../apps/client/src/music-score";
import { below, RETRO_GAIN } from "../../apps/client/src/retro-score";
import { playChip, ARP_STEP } from "../../apps/client/src/chip-synth";
import { noteHz } from "../../apps/client/src/audio";

const SCENES: BackgroundTheme[] = ["lobby", "pvp", "raid", "spire"];
const loop = (theme: BackgroundTheme, phase = 1) =>
  Array.from({ length: MUSIC_LOOP_STEPS }, (_, s) =>
    scoreStep(theme, s, phase),
  ).flat();

describe("the retro soundtrack", () => {
  it("plays only chip voices, with real pitches, for every scene and result", () => {
    const notes: ScoreNote[] = [
      ...SCENES.flatMap((t) => [...loop(t, 1), ...loop(t, 3)]),
      ...(["victory", "defeat", "draw"] as const).flatMap((t) =>
        Array.from({ length: RESULT_MUSIC_STEPS[t] }, (_, s) =>
          scoreStep(t, s),
        ).flat(),
      ),
    ];
    expect(notes.length).toBeGreaterThan(1000);
    for (const n of notes) {
      expect(n.instrument.startsWith("chip-")).toBe(true);
      expect(n.duration).toBeGreaterThan(0);
      expect(n.volume).toBeGreaterThan(0);
      for (const name of [n.note, ...(n.notes ?? [])])
        if (name) expect(noteHz(name)).toBeGreaterThan(20);
      if (n.instrument === "chip-arp") expect(n.notes?.length).toBe(3);
    }
  });
  it("gives each scene its own role", () => {
    const count = (t: BackgroundTheme, i: string, phase = 1) =>
      loop(t, phase).filter((n) => n.instrument === i).length;
    // A fight has the busiest kit.
    expect(count("pvp", "chip-kick")).toBeGreaterThan(
      count("lobby", "chip-kick"),
    );
    expect(count("pvp", "chip-snare")).toBeGreaterThan(
      count("lobby", "chip-snare"),
    );
    // The fight and the boss run quicker than the menus.
    expect(MUSIC_BPM.pvp).toBeGreaterThan(MUSIC_BPM.lobby);
    expect(MUSIC_BPM.raid).toBeGreaterThan(MUSIC_BPM.lobby);
    // Every scene sounds different.
    const sigs = SCENES.map((t) => JSON.stringify(loop(t).slice(0, 200)));
    expect(new Set(sigs).size).toBe(SCENES.length);
    for (const t of [...SCENES, "victory", "defeat", "draw"] as const)
      expect(RETRO_GAIN[t]).toBeGreaterThan(0);
  });
  it("adds a harmony line of chord tones under the tune", () => {
    expect(below("E5", ["C3", "E3", "G3"])).toBe("C5");
    expect(below("C6", ["F3", "A3", "C4", "D4"])).toBe("A5");
    // Never the tune's own note or less than a minor third under it.
    for (const tune of ["C5", "D5", "G#4", "B5"]) {
      const h = below(tune, ["C3", "E3", "G3", "B3"]);
      const gap = Math.log2(noteHz(tune) / noteHz(h)) * 12;
      expect(gap).toBeGreaterThanOrEqual(2.9);
      expect(gap).toBeLessThan(12);
    }
  });
});

describe("chip voices", () => {
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
    Q: param(),
    pan: param(),
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
  function context(periodic: boolean) {
    const oscillators: ReturnType<typeof node>[] = [];
    const ctx = {
      sampleRate: 100,
      createOscillator: () => {
        const o = node();
        oscillators.push(o);
        return o;
      },
      createGain: node,
      createStereoPanner: node,
      createBiquadFilter: node,
      createBufferSource: node,
      createBuffer: (_c: number, n: number, rate: number) => ({
        sampleRate: rate,
        duration: n / rate,
        getChannelData: () => new Float32Array(n),
      }),
      ...(periodic ? { createPeriodicWave: vi.fn(() => ({})) } : {}),
    };
    const noise = ctx.createBuffer(1, 100, 100);
    return { ctx: ctx as unknown as BaseAudioContext, oscillators, noise };
  }
  const out = node() as unknown as AudioNode;
  it("uses pulse waves of their duty, or squares where the browser has none", () => {
    for (const periodic of [true, false]) {
      const { ctx, oscillators, noise } = context(periodic);
      playChip(
        ctx,
        out,
        undefined,
        noise as unknown as AudioBuffer,
        { instrument: "chip-pulse25", note: "A4", duration: 0.5, volume: 0.1 },
        440,
        [],
        0,
      );
      expect(oscillators[0].setPeriodicWave).toHaveBeenCalledTimes(
        periodic ? 1 : 0,
      );
      if (!periodic) expect(oscillators[0].type).toBe("square");
    }
  });
  it("cycles an arpeggio through its chord every two frames", () => {
    const { ctx, oscillators, noise } = context(true);
    playChip(
      ctx,
      out,
      undefined,
      noise as unknown as AudioBuffer,
      {
        instrument: "chip-arp",
        note: "C4",
        notes: ["C4", "E4", "G4"],
        duration: 0.5,
        volume: 0.05,
      },
      262,
      [262, 330, 392],
      0,
    );
    const steps = oscillators[0].frequency.setValueAtTime.mock.calls;
    expect(steps.length).toBe(15);
    expect(ARP_STEP).toBeCloseTo(1 / 30);
    expect(steps.slice(0, 4).map((c) => c[0])).toEqual([262, 330, 392, 262]);
  });
  it("sends leads marked for it to the echo, and only those", () => {
    const { ctx, noise } = context(true);
    const echo = node() as unknown as AudioNode;
    const panner = node();
    const withPanner = {
      ...ctx,
      createStereoPanner: () => panner,
    } as unknown as BaseAudioContext;
    playChip(
      withPanner,
      out,
      echo,
      noise as unknown as AudioBuffer,
      {
        instrument: "chip-square",
        note: "A4",
        duration: 0.4,
        volume: 0.1,
        echo: true,
      },
      440,
      [],
      0,
    );
    expect(panner.connect).toHaveBeenCalledWith(echo);
    panner.connect.mockClear();
    playChip(
      withPanner,
      out,
      echo,
      noise as unknown as AudioBuffer,
      { instrument: "chip-square", note: "A4", duration: 0.4, volume: 0.1 },
      440,
      [],
      0,
    );
    expect(panner.connect).not.toHaveBeenCalledWith(echo);
  });
});

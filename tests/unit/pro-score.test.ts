import { describe, expect, it, vi } from "vitest";
import {
  MUSIC_LOOP_STEPS,
  RESULT_MUSIC_STEPS,
  scoreStep,
  type BackgroundTheme,
  type ScoreNote,
} from "../../apps/client/src/music-score";
import { ProSynth } from "../../apps/client/src/pro-synth";
import { noteHz } from "../../apps/client/src/audio";

const SCENES: BackgroundTheme[] = ["lobby", "pvp", "raid", "spire"];
const loop = (theme: BackgroundTheme, phase = 1) =>
  Array.from({ length: MUSIC_LOOP_STEPS }, (_, s) =>
    scoreStep(theme, s, phase),
  ).flat();
/** The notes of one 16-step bar of a theme's loop. */
const bar = (theme: BackgroundTheme, b: number) =>
  Array.from({ length: 16 }, (_, s) => scoreStep(theme, b * 16 + s)).flat();
const ending = (theme: "victory" | "defeat" | "draw") =>
  Array.from({ length: RESULT_MUSIC_STEPS[theme] }, (_, s) =>
    scoreStep(theme, s),
  ).flat();

describe("the produced soundtrack", () => {
  it("plays only the produced voices, with real pitches, in every scene and phase", () => {
    const scores = [
      ...SCENES.map((t) => loop(t)),
      loop("raid", 2),
      loop("raid", 3),
      loop("spire", 2),
      loop("spire", 3),
      ...(["victory", "defeat", "draw"] as const).map(ending),
    ];
    for (const notes of scores) {
      expect(notes.length).toBeGreaterThan(10);
      for (const n of notes) {
        expect(n.instrument.startsWith("pro-"), n.instrument).toBe(true);
        expect(n.duration).toBeGreaterThan(0);
        expect(n.volume).toBeGreaterThan(0);
        for (const name of [n.note, n.from, ...(n.notes ?? [])])
          if (name) expect(noteHz(name)).toBeGreaterThan(20);
      }
    }
  });
  it("arranges like a shipped soundtrack: glides, a riser, fills", () => {
    for (const theme of SCENES) {
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
      // (The raid's plucked arpeggios come in with its second phase.)
      for (const i of ["pro-kick", "pro-pad", "pro-bass", "pro-pluck"])
        if (theme !== "raid" || i !== "pro-pluck")
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
    for (const theme of SCENES) {
      const busy = (from: number) =>
        Array.from({ length: 8 }, (_, i) => bar(theme, from + i)).flat().length;
      expect(busy(24), theme).toBeGreaterThan(busy(16));
    }
  });
});

describe("each scene's role", () => {
  const drums = (notes: ScoreNote[]) =>
    notes.filter((n) =>
      ["pro-kick", "pro-snare", "pro-hat", "pro-ohat", "pro-shaker"].includes(
        n.instrument,
      ),
    ).length;
  it("grows the raid and the Spire with the fight's phase", () => {
    for (const theme of ["raid", "spire"] as const) {
      const [one, two, three] = [1, 2, 3].map((p) => loop(theme, p));
      expect(drums(two), theme).toBeGreaterThan(drums(one));
      expect(drums(three), theme).toBeGreaterThan(drums(two));
      expect(three.length, theme).toBeGreaterThan(one.length);
    }
    // The boss's first phase has no snare yet; the third has a four-on-the-floor kick.
    const kicks = (p: number) =>
      loop("raid", p).filter((n) => n.instrument === "pro-kick").length;
    expect(
      loop("raid", 1).filter((n) => n.instrument === "pro-snare").length,
    ).toBe(0);
    expect(kicks(3)).toBeGreaterThan(2 * kicks(1));
  });
  it("gives every scene its own arrangement and a fight a busier kit than the hub", () => {
    const sigs = SCENES.map((t) => JSON.stringify(loop(t).slice(0, 300)));
    expect(new Set(sigs).size).toBe(SCENES.length);
    expect(drums(loop("pvp"))).toBeGreaterThan(drums(loop("lobby")));
  });
  it("ends the results: a fanfare for a win, a gentle farewell for a loss", () => {
    const win = ending("victory"),
      loss = ending("defeat"),
      draw = ending("draw");
    expect(win.some((n) => n.instrument === "pro-crash")).toBe(true);
    expect(drums(win)).toBeGreaterThan(0);
    expect(drums(loss)).toBe(0);
    expect(drums(draw)).toBe(0);
    expect(JSON.stringify(win)).not.toBe(JSON.stringify(loss));
    expect(JSON.stringify(loss)).not.toBe(JSON.stringify(draw));
    for (const t of ["victory", "defeat", "draw"] as const)
      expect(scoreStep(t, RESULT_MUSIC_STEPS[t])).toEqual([]);
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

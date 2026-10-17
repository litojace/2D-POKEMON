import type { ScoreNote } from "./music-score";
const NOTE: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
/** "A4" → 440 Hz. */
export function noteHz(name: string) {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) return 0;
  const semis = NOTE[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12 - 9;
  return 440 * 2 ** (semis / 12);
}

/** Music-only synthesis; the output follows its theme's crossfade and volume bus. */
export class MusicSynth {
  private echo: DelayNode;
  private echoNodes: AudioNode[];
  constructor(
    private ctx: BaseAudioContext,
    private output: AudioNode,
    private noise: AudioBuffer,
    bpm: number,
  ) {
    this.echo = ctx.createDelay(1);
    this.echo.delayTime.value = (60 / bpm) * 0.75;
    const feedback = ctx.createGain(),
      wet = ctx.createGain(),
      filter = ctx.createBiquadFilter(),
      stereo = ctx.createStereoPanner();
    feedback.gain.value = 0.22;
    wet.gain.value = 0.22;
    filter.type = "lowpass";
    filter.frequency.value = 2600;
    stereo.pan.value = 0.35;
    this.echo.connect(filter).connect(feedback).connect(this.echo);
    filter.connect(wet).connect(stereo).connect(output);
    this.echoNodes = [this.echo, filter, feedback, wet, stereo];
  }
  disconnect() {
    this.echoNodes.forEach((node) => node.disconnect());
  }
  play(note: ScoreNote, t: number) {
    const { instrument, volume, duration } = note;
    if (instrument === "kick" || instrument === "tom") {
      this.drum(
        t,
        volume,
        instrument === "kick" ? 0.24 : duration,
        instrument === "kick" ? 155 : 145,
        instrument === "kick" ? 42 : 62,
        note.pan ?? 0,
      );
    } else if (["snare", "hat", "openhat", "crash"].includes(instrument)) {
      const cutoff =
        instrument === "snare" ? 1400 : instrument === "crash" ? 3200 : 6500;
      this.noiseHit(t, volume, duration, cutoff, note.pan ?? 0);
      if (instrument === "snare")
        this.drum(t, volume * 0.45, 0.11, 190, 125, 0);
    } else if (note.note) this.voice(note, t);
  }
  private voice(note: ScoreNote, t: number) {
    const ctx = this.ctx,
      hz = noteHz(note.note!);
    const instrument = note.instrument,
      pad = instrument === "pad",
      bass = instrument === "bass",
      bell = instrument === "bell";
    const duration = Math.max(0.04, note.duration),
      attack = Math.min(duration * 0.2, pad ? 0.26 : 0.012);
    const filter = ctx.createBiquadFilter(),
      envelope = ctx.createGain(),
      stereo = ctx.createStereoPanner();
    filter.type = "lowpass";
    const cutoff = bass
      ? Math.min(950, hz * 6)
      : pad
        ? 1800
        : bell
          ? 8500
          : Math.min(4400, hz * 5);
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(
      bass ? 150 : Math.max(400, cutoff * 0.42),
      t + duration,
    );
    filter.Q.value = bass ? 1.1 : 0.6;
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(note.volume, t + attack);
    envelope.gain.exponentialRampToValueAtTime(
      note.volume * (pad ? 0.78 : 0.45),
      t + Math.max(attack + 0.001, duration * 0.42),
    );
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    stereo.pan.value = note.pan ?? 0;
    filter.connect(envelope).connect(stereo).connect(this.output);
    const echo = ["lead", "pluck", "arp", "bell"].includes(instrument);
    if (echo) stereo.connect(this.echo);
    const layers: [OscillatorType, number, number, number][] = bass
      ? [
          ["triangle", 1, 0.8, 0],
          ["sawtooth", 1, 0.2, 0],
        ]
      : bell
        ? [
            ["sine", 1, 0.75, 0],
            ["sine", 2.01, 0.2, 0],
            ["sine", 3.99, 0.05, 0],
          ]
        : pad
          ? [
              ["sawtooth", 1, 0.5, -7],
              ["sawtooth", 1, 0.5, 7],
            ]
          : instrument === "lead"
            ? [
                ["sawtooth", 1, 0.58, -5],
                ["triangle", 1, 0.42, 5],
              ]
            : instrument === "stab"
              ? [
                  ["sawtooth", 1, 0.7, 0],
                  ["triangle", 2, 0.3, 0],
                ]
              : [
                  ["triangle", 1, 0.72, 0],
                  ["sine", 2, 0.28, 0],
                ];
    let remaining = layers.length;
    for (const [type, multiple, level, detune] of layers) {
      const osc = ctx.createOscillator(),
        mix = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(hz * multiple, t);
      osc.detune.value = detune;
      mix.gain.value = level;
      osc.connect(mix).connect(filter);
      osc.start(t);
      osc.stop(t + duration + 0.015);
      osc.onended = () => {
        osc.disconnect();
        mix.disconnect();
        if (--remaining === 0) {
          filter.disconnect();
          envelope.disconnect();
          stereo.disconnect();
        }
      };
    }
  }
  private drum(
    t: number,
    volume: number,
    duration: number,
    from: number,
    to: number,
    pan: number,
  ) {
    const osc = this.ctx.createOscillator(),
      envelope = this.ctx.createGain(),
      stereo = this.ctx.createStereoPanner();
    osc.type = "sine";
    osc.frequency.setValueAtTime(from, t);
    osc.frequency.exponentialRampToValueAtTime(
      to,
      t + Math.min(0.12, duration),
    );
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(volume, t + 0.003);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    stereo.pan.value = pan;
    osc.connect(envelope).connect(stereo).connect(this.output);
    osc.start(t);
    osc.stop(t + duration + 0.015);
    osc.onended = () => {
      osc.disconnect();
      envelope.disconnect();
      stereo.disconnect();
    };
  }
  private noiseHit(
    t: number,
    volume: number,
    duration: number,
    cutoff: number,
    pan: number,
  ) {
    const src = this.ctx.createBufferSource(),
      filter = this.ctx.createBiquadFilter(),
      envelope = this.ctx.createGain(),
      stereo = this.ctx.createStereoPanner();
    src.buffer = this.noise;
    src.loop = true;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    filter.Q.value = 0.6;
    envelope.gain.setValueAtTime(0.0001, t);
    envelope.gain.exponentialRampToValueAtTime(volume, t + 0.002);
    envelope.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    stereo.pan.value = pan;
    src.connect(filter).connect(envelope).connect(stereo).connect(this.output);
    src.start(t);
    src.stop(t + duration + 0.015);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      envelope.disconnect();
      stereo.disconnect();
    };
  }
}

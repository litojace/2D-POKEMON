import type { ScoreNote } from "./music-score";
import { playChip } from "./chip-synth";
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

/**
 * One theme's player: chip voices (chip-synth.ts) on the theme's
 * crossfade/volume bus, with a soft echo of three-quarters of a beat that
 * the leads send to, as the consoles' composers faked with a second voice.
 */
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
    playChip(
      this.ctx,
      this.output,
      this.echo,
      this.noise,
      note,
      note.note ? noteHz(note.note) : 0,
      note.notes?.map(noteHz) ?? [],
      t,
    );
  }
}

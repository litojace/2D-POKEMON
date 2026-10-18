import sources from "../public/assets/music/sources.json";
import type { ScoreNote } from "./music-score";

export const SAMPLE_INSTRUMENTS = [
  "piano",
  "harp",
  "flute",
  "strings",
  "spiccato",
  "cello",
  "horn",
  "concert-bass",
  "concert-snare",
  "timpani",
  "concert-cymbal",
] as const;
export type SampleInstrument = (typeof SAMPLE_INSTRUMENTS)[number];
export function isSampleInstrument(
  instrument: string,
): instrument is SampleInstrument {
  return (SAMPLE_INSTRUMENTS as readonly string[]).includes(instrument);
}
interface Sample {
  instrument: string;
  rootHz: number | null;
  buffer: AudioBuffer;
}
/** One small bank per audio context; downloaded from our own static assets. */
export class MusicSampleBank {
  private samples: Sample[] = [];
  private pending?: Promise<void>;
  complete = false;
  constructor(private ctx: BaseAudioContext) {}
  load(fetcher: typeof fetch): Promise<void> {
    return (this.pending ??= Promise.allSettled(
      sources.map(async (source) => {
        const response = await fetcher(`/assets/music/${source.file}`, {
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error("Instrument sample unavailable");
        const buffer = await this.ctx.decodeAudioData(
          await response.arrayBuffer(),
        );
        return { instrument: source.instrument, rootHz: source.rootHz, buffer };
      }),
    ).then((results) => {
      this.samples = results.flatMap((result) =>
        result.status === "fulfilled" ? [result.value] : [],
      );
      this.complete = true;
    }));
  }
  get(instrument: SampleInstrument, hz: number) {
    let best: Sample | undefined,
      distance = Infinity;
    for (const sample of this.samples) {
      if (sample.instrument !== instrument) continue;
      const d = sample.rootHz ? Math.abs(Math.log2(hz / sample.rootHz)) : 0;
      if (d < distance) {
        best = sample;
        distance = d;
      }
    }
    return best;
  }
}

/** A recorded attack, followed by the requested note length and a smooth release. */
export function playSample(
  ctx: BaseAudioContext,
  output: AudioNode,
  bank: MusicSampleBank,
  note: ScoreNote,
  hz: number,
  t: number,
  room?: AudioNode,
): boolean {
  if (!isSampleInstrument(note.instrument)) return false;
  const sample = bank.get(note.instrument, hz);
  if (!sample) return false;
  const source = ctx.createBufferSource(),
    gain = ctx.createGain(),
    stereo = ctx.createStereoPanner();
  const rate = sample.rootHz ? hz / sample.rootHz : 1;
  const duration = Math.max(
    0.025,
    Math.min(note.duration, sample.buffer.duration / rate - 0.01),
  );
  const bowed = ["strings", "cello", "horn"].includes(note.instrument);
  const attack = Math.min(duration * 0.15, bowed ? 0.06 : 0.004),
    release = Math.min(duration * 0.25, bowed ? 0.16 : 0.06);
  source.buffer = sample.buffer;
  source.playbackRate.value = rate;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(note.volume, t + attack);
  gain.gain.setValueAtTime(
    note.volume,
    t + Math.max(attack, duration - release),
  );
  gain.gain.linearRampToValueAtTime(0.0001, t + duration);
  stereo.pan.value = note.pan ?? 0;
  source.connect(gain).connect(stereo).connect(output);
  if (room && sample.rootHz) stereo.connect(room);
  source.start(t);
  source.stop(t + duration + 0.01);
  source.onended = () => {
    source.disconnect();
    gain.disconnect();
    stereo.disconnect();
  };
  return true;
}

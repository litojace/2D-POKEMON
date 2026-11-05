/**
 * Farm sounds: every cue is synthesized here (oscillators and filtered
 * noise), so nothing is downloaded. They play through the game's own audio
 * context at the Effects volume (AudioManager.farm), like the battle cues.
 */
export type FarmCue =
  | "pop"
  | "plant"
  | "water"
  | "coin"
  | "chime"
  | "cluck"
  | "moo"
  | "bark"
  | "meow"
  | "quack"
  | "rustle"
  | "splash"
  | "whoosh"
  | "knock"
  | "boing"
  | "tick"
  | "levelup"
  | "fanfare"
  | "chirp"
  | "cricket";

export const FARM_CUES: readonly FarmCue[] = [
  "pop",
  "plant",
  "water",
  "coin",
  "chime",
  "cluck",
  "moo",
  "bark",
  "meow",
  "quack",
  "rustle",
  "splash",
  "whoosh",
  "knock",
  "boing",
  "tick",
  "levelup",
  "fanfare",
  "chirp",
  "cricket",
];

/** A harvest pop climbs a whole tone per crop in a swipe, up to 14 steps. */
export function popPitch(step: number): number {
  return Math.pow(2, (Math.min(Math.max(step, 0), 14) * 2) / 12);
}

interface Tone {
  f: number;
  f2?: number;
  type?: OscillatorType;
  dur?: number;
  vol?: number;
  delay?: number;
  attack?: number;
  lp?: number;
}
interface Hiss {
  dur?: number;
  vol?: number;
  f?: number;
  f2?: number;
  q?: number;
  type?: BiquadFilterType;
  delay?: number;
}

/** Play one cue now. `volume` is the Effects setting (0..1). */
export function playFarmCue(
  ctx: BaseAudioContext,
  out: AudioNode,
  volume: number,
  noise: AudioBuffer | undefined,
  cue: FarmCue,
  step = 0,
) {
  if (volume <= 0) return;
  const level = volume * 0.8;
  const tone = ({
    f,
    f2,
    type = "sine",
    dur = 0.15,
    vol = 0.2,
    delay = 0,
    attack = 0.006,
    lp,
  }: Tone) => {
    const t = ctx.currentTime + delay,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * level, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node: AudioNode = o;
    if (lp) {
      const fl = ctx.createBiquadFilter();
      fl.type = "lowpass";
      fl.frequency.value = lp;
      o.connect(fl);
      node = fl;
    }
    node.connect(g);
    g.connect(out);
    o.start(t);
    o.stop(t + dur + 0.05);
  };
  const hiss = ({
    dur = 0.25,
    vol = 0.15,
    f = 1500,
    f2,
    q = 1,
    type = "bandpass",
    delay = 0,
  }: Hiss) => {
    if (!noise) return;
    const t = ctx.currentTime + delay,
      s = ctx.createBufferSource(),
      fl = ctx.createBiquadFilter(),
      g = ctx.createGain();
    s.buffer = noise;
    fl.type = type;
    fl.frequency.setValueAtTime(f, t);
    fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol * level, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(fl);
    fl.connect(g);
    g.connect(out);
    s.start(t, Math.random() * Math.max(0, noise.duration - dur - 0.1));
    s.stop(t + dur + 0.05);
  };
  switch (cue) {
    case "pop": {
      const m = popPitch(step);
      tone({ f: 420 * m, f2: 760 * m, type: "triangle", dur: 0.13, vol: 0.22 });
      tone({ f: 1400 * m, dur: 0.05, vol: 0.05 });
      break;
    }
    case "plant":
      hiss({ dur: 0.12, vol: 0.12, f: 900, q: 0.8, type: "lowpass" });
      tone({ f: 300, f2: 220, dur: 0.08, vol: 0.08 });
      break;
    case "water":
      hiss({ dur: 0.45, vol: 0.12, f: 3000, q: 0.7, f2: 1800 });
      break;
    case "coin":
      tone({ f: 988, type: "square", dur: 0.08, vol: 0.06, lp: 4000 });
      tone({
        f: 1319,
        type: "square",
        dur: 0.22,
        vol: 0.06,
        delay: 0.07,
        lp: 4000,
      });
      break;
    case "chime":
      [1047, 1319, 1568, 2093].forEach((f, i) =>
        tone({ f, type: "triangle", dur: 0.4, vol: 0.09, delay: i * 0.06 }),
      );
      break;
    case "cluck":
      [
        [750, 520],
        [820, 560],
        [900, 600],
      ].forEach(([f, f2], i) =>
        tone({
          f,
          f2,
          type: "square",
          dur: 0.06 + i * 0.012,
          vol: 0.05,
          delay: i * 0.1,
          lp: 2500,
        }),
      );
      break;
    case "moo":
      tone({
        f: 155,
        f2: 118,
        type: "sawtooth",
        dur: 0.9,
        vol: 0.14,
        attack: 0.12,
        lp: 700,
      });
      tone({
        f: 310,
        f2: 236,
        type: "sawtooth",
        dur: 0.9,
        vol: 0.04,
        attack: 0.12,
        lp: 900,
      });
      break;
    case "bark":
      [0, 0.17].forEach((delay) =>
        tone({
          f: 520,
          f2: 280,
          type: "sawtooth",
          dur: 0.11,
          vol: 0.12,
          delay,
          lp: 1600,
        }),
      );
      break;
    case "meow":
      tone({ f: 620, f2: 900, type: "triangle", dur: 0.18, vol: 0.08 });
      tone({
        f: 900,
        f2: 520,
        type: "triangle",
        dur: 0.3,
        vol: 0.08,
        delay: 0.17,
      });
      break;
    case "quack":
      [0, 0.16].forEach((delay) =>
        tone({
          f: 520,
          f2: 380,
          type: "sawtooth",
          dur: 0.12,
          vol: 0.07,
          delay,
          lp: 1400,
        }),
      );
      break;
    case "rustle":
      hiss({ dur: 0.5, vol: 0.12, f: 2500, q: 0.5, type: "highpass" });
      break;
    case "splash":
      hiss({ dur: 0.35, vol: 0.14, f: 900, q: 0.8, f2: 400 });
      tone({ f: 600, f2: 200, dur: 0.18, vol: 0.06 });
      break;
    case "whoosh":
      hiss({ dur: 0.6, vol: 0.12, f: 300, q: 1.2, f2: 2400 });
      break;
    case "knock":
      tone({ f: 180, dur: 0.08, vol: 0.2 });
      tone({ f: 170, dur: 0.08, vol: 0.2, delay: 0.14 });
      break;
    case "boing":
      tone({ f: 200, f2: 520, dur: 0.25, vol: 0.12 });
      break;
    case "tick":
      tone({ f: 1800, dur: 0.03, vol: 0.05 });
      break;
    case "levelup":
      [523, 659, 784, 1047, 1319].forEach((f, i) =>
        tone({ f, type: "triangle", dur: 0.35, vol: 0.12, delay: i * 0.09 }),
      );
      break;
    case "fanfare":
      [392, 523, 659, 784].forEach((f, i) =>
        tone({
          f,
          type: "square",
          dur: 0.18,
          vol: 0.05,
          delay: i * 0.1,
          lp: 3000,
        }),
      );
      tone({ f: 1047, type: "triangle", dur: 0.7, vol: 0.12, delay: 0.42 });
      break;
    case "chirp": {
      const b = 2400 + Math.random() * 1400,
        n = 2 + Math.floor(Math.random() * 3);
      for (let k = 0; k < n; k++)
        tone({ f: b, f2: b * 1.35, dur: 0.07, vol: 0.03, delay: k * 0.11 });
      break;
    }
    case "cricket":
      for (let k = 0; k < 3; k++)
        tone({
          f: 4400,
          type: "square",
          dur: 0.025,
          vol: 0.012,
          delay: k * 0.05,
          lp: 6000,
        });
      break;
  }
}

/** The rain on the farm: a filtered noise loop that fades in and out. */
export class FarmRain {
  private src?: AudioBufferSourceNode;
  private gain?: GainNode;
  constructor(
    private ctx: BaseAudioContext,
    private out: AudioNode,
    private noise: AudioBuffer,
  ) {}
  /** 0 silent, 1 rain, 1.6 a storm; `volume` is the Effects setting. */
  set(level: number, volume: number) {
    const target = Math.max(0, level) * volume * 0.22;
    const t = this.ctx.currentTime;
    if (target <= 0.0005) {
      if (!this.src) return;
      const { src, gain } = this;
      this.src = undefined;
      this.gain = undefined;
      gain!.gain.setTargetAtTime(0, t, 0.3);
      src.stop(t + 1.5);
      return;
    }
    if (!this.src) {
      const src = this.ctx.createBufferSource(),
        fl = this.ctx.createBiquadFilter(),
        gain = this.ctx.createGain();
      src.buffer = this.noise;
      src.loop = true;
      fl.type = "lowpass";
      fl.frequency.value = 1400;
      gain.gain.value = 0;
      src.connect(fl);
      fl.connect(gain);
      gain.connect(this.out);
      src.start();
      this.src = src;
      this.gain = gain;
    }
    this.gain!.gain.setTargetAtTime(target, t, 0.5);
  }
}

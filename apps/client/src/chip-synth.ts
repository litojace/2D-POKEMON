import type { ScoreNote } from "./music-score";

/**
 * The retro soundtrack's voices, after the sound chips of old consoles:
 * pulse waves at 12.5%, 25% and 50% duty, a triangle bass, a rapid chord
 * arpeggio, and drums from coarse noise. Each note is one oscillator (or
 * noise source) with a short envelope, and nothing needs downloading.
 */
const waves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
/** A band-limited pulse wave of the given duty (Fourier series). */
function pulseWave(ctx: BaseAudioContext, duty: number) {
  let byDuty = waves.get(ctx);
  if (!byDuty) waves.set(ctx, (byDuty = new Map()));
  let wave = byDuty.get(duty);
  if (!wave) {
    const n = 40,
      real = new Float32Array(n),
      imag = new Float32Array(n);
    for (let k = 1; k < n; k++)
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    wave = ctx.createPeriodicWave(real, imag);
    byDuty.set(duty, wave);
  }
  return wave;
}
const crushed = new WeakMap<AudioBuffer, AudioBuffer>();
/** The noise held in steps of 4 samples: grittier, like a chip's noise channel. */
function chipNoise(ctx: BaseAudioContext, noise: AudioBuffer) {
  let out = crushed.get(noise);
  if (!out) {
    const src = noise.getChannelData(0);
    out = ctx.createBuffer(1, src.length, noise.sampleRate);
    const dst = out.getChannelData(0);
    for (let i = 0; i < dst.length; i++) dst[i] = src[i - (i % 4)];
    crushed.set(noise, out);
  }
  return out;
}

const DUTY: Partial<Record<ScoreNote["instrument"], number>> = {
  "chip-pulse12": 0.125,
  "chip-pulse25": 0.25,
  "chip-square": 0.5,
  "chip-bass": 0.25,
  "chip-arp": 0.25,
};
/** How long each chord note of an arpeggio sounds (s): two frames at 60 Hz. */
export const ARP_STEP = 1 / 30;

/**
 * Play one chip note. `hz` is its pitch (0 for drums), `arpHz` the chord of
 * an arpeggio; `echo` receives the notes marked for it.
 */
export function playChip(
  ctx: BaseAudioContext,
  output: AudioNode,
  echo: AudioNode | undefined,
  noise: AudioBuffer,
  note: ScoreNote,
  hz: number,
  arpHz: number[],
  t: number,
) {
  const instrument = note.instrument;
  if (instrument === "chip-kick") return kick(ctx, output, noise, note, t);
  if (
    instrument === "chip-snare" ||
    instrument === "chip-hat" ||
    instrument === "chip-crash"
  )
    return noiseHit(ctx, output, noise, note, t);
  if (!hz && !arpHz.length) return;
  const duration = Math.max(0.03, note.duration),
    end = t + duration;
  const osc = ctx.createOscillator(),
    env = ctx.createGain(),
    stereo = ctx.createStereoPanner();
  const duty = DUTY[instrument];
  if (duty && typeof ctx.createPeriodicWave === "function")
    osc.setPeriodicWave(pulseWave(ctx, duty));
  else osc.type = instrument === "chip-tri" ? "triangle" : "square";
  if (instrument === "chip-arp" && arpHz.length) {
    // Counted, not accumulated, so float drift never adds a step at the end.
    const steps = Math.ceil(duration / ARP_STEP - 1e-6);
    for (let i = 0; i < steps; i++)
      osc.frequency.setValueAtTime(arpHz[i % arpHz.length], t + i * ARP_STEP);
  } else osc.frequency.setValueAtTime(hz, t);
  const nodes: AudioNode[] = [osc, env, stereo];
  // Envelopes: pulses drop to a sustain, the triangle holds (as on the
  // chip, which has no volume control), the bass is punchy.
  const peak = note.volume,
    sustain =
      instrument === "chip-tri"
        ? 1
        : instrument === "chip-bass"
          ? 0.55
          : instrument === "chip-arp"
            ? 0.8
            : 0.65;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(peak, t + 0.004);
  if (sustain < 1) env.gain.setTargetAtTime(peak * sustain, t + 0.004, 0.07);
  env.gain.setTargetAtTime(0, end, 0.012);
  let head: AudioNode = env;
  if (instrument === "chip-bass") {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1500;
    lp.connect(env);
    head = lp;
    nodes.push(lp);
  }
  if (note.vibrato && duration > 0.28 && hz) {
    // Starts a beat in, as composers of the time did, so short notes stay clean.
    const lfo = ctx.createOscillator(),
      depth = ctx.createGain();
    lfo.frequency.value = 5.6;
    depth.gain.setValueAtTime(0, t);
    depth.gain.setValueAtTime(0, t + 0.14);
    depth.gain.linearRampToValueAtTime(hz * 0.011, t + 0.32);
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(t);
    lfo.stop(end + 0.08);
    nodes.push(lfo, depth);
  }
  stereo.pan.value = note.pan ?? 0;
  osc.connect(head);
  env.connect(stereo).connect(output);
  if (note.echo && echo) stereo.connect(echo);
  osc.start(t);
  osc.stop(end + 0.08);
  osc.onended = () => nodes.forEach((n) => n.disconnect());
}

function kick(
  ctx: BaseAudioContext,
  output: AudioNode,
  noise: AudioBuffer,
  note: ScoreNote,
  t: number,
) {
  // A triangle dropping fast in pitch, with a click a phone can hear.
  const osc = ctx.createOscillator(),
    env = ctx.createGain(),
    stereo = ctx.createStereoPanner();
  osc.type = "triangle";
  osc.frequency.setValueAtTime(190, t);
  osc.frequency.exponentialRampToValueAtTime(42, t + 0.09);
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(note.volume, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
  stereo.pan.value = note.pan ?? 0;
  osc.connect(env).connect(stereo).connect(output);
  osc.start(t);
  osc.stop(t + 0.18);
  osc.onended = () => [osc, env, stereo].forEach((n) => n.disconnect());
  noiseHit(
    ctx,
    output,
    noise,
    {
      ...note,
      instrument: "chip-hat",
      volume: note.volume * 0.25,
      duration: 0.012,
    },
    t,
  );
}

function noiseHit(
  ctx: BaseAudioContext,
  output: AudioNode,
  noise: AudioBuffer,
  note: ScoreNote,
  t: number,
) {
  const instrument = note.instrument;
  const length =
    instrument === "chip-crash"
      ? Math.max(0.4, note.duration)
      : instrument === "chip-snare"
        ? 0.14
        : Math.min(0.12, Math.max(0.012, note.duration));
  const src = ctx.createBufferSource(),
    filter = ctx.createBiquadFilter(),
    env = ctx.createGain(),
    stereo = ctx.createStereoPanner();
  src.buffer = chipNoise(ctx, noise);
  src.loop = true;
  filter.type = instrument === "chip-snare" ? "bandpass" : "highpass";
  filter.frequency.value =
    instrument === "chip-snare"
      ? 2600
      : instrument === "chip-crash"
        ? 3500
        : 7000;
  filter.Q.value = instrument === "chip-snare" ? 0.6 : 0.7;
  env.gain.setValueAtTime(0.0001, t);
  env.gain.linearRampToValueAtTime(note.volume, t + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, t + length);
  stereo.pan.value = note.pan ?? 0;
  src.connect(filter).connect(env).connect(stereo).connect(output);
  const span = noise.duration > 0.2 ? noise.duration - 0.2 : 0;
  src.start(t, Math.random() * span);
  src.stop(t + length + 0.02);
  const nodes: AudioNode[] = [src, filter, env, stereo];
  if (instrument === "chip-snare") {
    // The snare's body: a short square drop under the noise.
    const body = ctx.createOscillator(),
      bodyEnv = ctx.createGain();
    body.type = "square";
    body.frequency.setValueAtTime(240, t);
    body.frequency.exponentialRampToValueAtTime(140, t + 0.06);
    bodyEnv.gain.setValueAtTime(0.0001, t);
    bodyEnv.gain.linearRampToValueAtTime(note.volume * 0.35, t + 0.002);
    bodyEnv.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
    body.connect(bodyEnv).connect(stereo);
    body.start(t);
    body.stop(t + 0.08);
    nodes.push(body, bodyEnv);
  }
  src.onended = () => nodes.forEach((n) => n.disconnect());
}

/**
 * The soundtrack's voices (pro-score.ts): chip-like waveforms with the
 * production a shipped game's soundtrack has. Wide detuned leads with
 * glides, pads, a punchy bass that ducks under the kick, a plate-like
 * reverb, a ping-pong delay and a gentle mix bus (low cut, presence, air,
 * glue compression). The owner chose it for the hub and PvP on 26 Nov 2026;
 * the raid, the Spire and the results followed.
 * Where a browser lacks a part (a compressor, a convolver, custom waves),
 * that part is left out rather than the music.
 */
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
export function hz(name: string) {
  const m = /^([A-G])(#?)(\d)$/.exec(name);
  if (!m) return 0;
  return (
    440 *
    2 ** ((NOTE[m[1]] + (m[2] ? 1 : 0) + (Number(m[3]) - 4) * 12 - 9) / 12)
  );
}

const waves = new WeakMap<BaseAudioContext, Map<number, PeriodicWave>>();
function pulse(ctx: BaseAudioContext, duty: number) {
  if (typeof ctx.createPeriodicWave !== "function") return undefined;
  let byDuty = waves.get(ctx);
  if (!byDuty) waves.set(ctx, (byDuty = new Map()));
  let wave = byDuty.get(duty);
  if (!wave) {
    const n = 48,
      real = new Float32Array(n),
      imag = new Float32Array(n);
    for (let k = 1; k < n; k++)
      real[k] = (2 / (k * Math.PI)) * Math.sin(k * Math.PI * duty);
    wave = ctx.createPeriodicWave(real, imag);
    byDuty.set(duty, wave);
  }
  return wave;
}

const impulses = new WeakMap<BaseAudioContext, AudioBuffer>();
/**
 * A plate-like impulse: two decorrelated noise tails that darken as they
 * fade. Made once per audio context (a theme change reuses it).
 */
function impulse(ctx: BaseAudioContext, seconds: number) {
  const made = impulses.get(ctx);
  if (made) return made;
  const rate = ctx.sampleRate,
    n = Math.floor(seconds * rate);
  const ir = ctx.createBuffer(2, n, rate);
  for (let c = 0; c < 2; c++) {
    const d = ir.getChannelData(c);
    let lp = 0;
    for (let i = 0; i < n; i++) {
      const t = i / rate;
      // Darker as it decays: the lowpass coefficient falls with time.
      const k = 0.55 * Math.exp(-t / 0.9) + 0.06;
      lp += k * (Math.random() * 2 - 1 - lp);
      const pre = t < 0.012 ? 0 : 1;
      d[i] = lp * Math.exp(-t / 0.42) * pre * 2.2;
    }
  }
  impulses.set(ctx, ir);
  return ir;
}

export class ProSynth {
  private master: GainNode;
  private reverb: GainNode;
  private delay: GainNode;
  /** Pads and bass go through this; the kick pulls it down (sidechain). */
  private duck: GainNode;
  private nodes: AudioNode[] = [];
  constructor(
    private ctx: BaseAudioContext,
    output: AudioNode,
    private noise: AudioBuffer,
    bpm: number,
  ) {
    const beat = 60 / bpm;
    // Mix bus: low cut, a little air, glue.
    const lowcut = ctx.createBiquadFilter();
    lowcut.type = "highpass";
    lowcut.frequency.value = 32;
    lowcut.Q.value = 0.7;
    const air = ctx.createBiquadFilter();
    air.type = "highshelf";
    air.frequency.value = 8000;
    air.gain.value = 4;
    // Presence: where phones and ears are most sensitive.
    const presence = ctx.createBiquadFilter();
    presence.type = "peaking";
    presence.frequency.value = 3000;
    presence.Q.value = 0.8;
    presence.gain.value = 2.5;
    const glue = ctx.createDynamicsCompressor?.();
    if (glue) {
      glue.threshold.value = -20;
      glue.knee.value = 8;
      glue.ratio.value = 2.5;
      glue.attack.value = 0.012;
      glue.release.value = 0.25;
    }
    this.master = ctx.createGain();
    const tail = this.master.connect(lowcut).connect(presence).connect(air);
    if (glue) tail.connect(glue).connect(output);
    else tail.connect(output);
    // Reverb send.
    this.reverb = ctx.createGain();
    const conv = ctx.createConvolver?.();
    const revOut = ctx.createGain();
    revOut.gain.value = 0.32;
    if (conv) {
      conv.buffer = impulse(ctx, 2.2);
      this.reverb.connect(conv).connect(revOut).connect(this.master);
    }
    // Ping-pong delay send: dotted eighth, left then right.
    this.delay = ctx.createGain();
    const dl = ctx.createDelay(2),
      dr = ctx.createDelay(2);
    dl.delayTime.value = beat * 0.75;
    dr.delayTime.value = beat * 0.75;
    const fb = ctx.createGain();
    fb.gain.value = 0.32;
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 3200;
    const pl = ctx.createStereoPanner(),
      pr = ctx.createStereoPanner();
    pl.pan.value = -0.7;
    pr.pan.value = 0.7;
    const wet = ctx.createGain();
    wet.gain.value = 0.5;
    this.delay.connect(tone).connect(dl);
    dl.connect(pl).connect(wet);
    dl.connect(dr);
    dr.connect(pr).connect(wet);
    dr.connect(fb).connect(dl);
    wet.connect(this.master);
    wet.connect(this.reverb);
    this.duck = ctx.createGain();
    this.duck.connect(this.master);
    if (glue) this.nodes.push(glue);
    if (conv) this.nodes.push(conv);
    this.nodes.push(
      lowcut,
      presence,
      air,
      this.master,
      this.reverb,
      revOut,
      this.delay,
      dl,
      dr,
      fb,
      tone,
      pl,
      pr,
      wet,
      this.duck,
    );
  }
  disconnect() {
    this.nodes.forEach((n) => n.disconnect());
  }
  play(note: ScoreNote, t: number) {
    switch (note.instrument) {
      case "pro-kick":
        return this.kick(note, t);
      case "pro-snare":
        return this.snare(note, t);
      case "pro-hat":
      case "pro-ohat":
      case "pro-shaker":
        return this.hat(note, t);
      case "pro-tom":
        return this.tom(note, t);
      case "pro-crash":
        return this.crash(note, t);
      case "pro-riser":
        return this.riser(note, t);
      case "pro-pad":
        return this.pad(note, t);
      case "pro-bass":
        return this.bass(note, t);
      case "pro-bell":
        return this.bell(note, t);
      default:
        return this.tone(note, t);
    }
  }
  private out(
    pan: number,
    sends: { reverb?: number; delay?: number },
    ducked = false,
  ) {
    const p = this.ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    p.connect(ducked ? this.duck : this.master);
    const extra: AudioNode[] = [];
    for (const [bus, amount] of [
      [this.reverb, sends.reverb],
      [this.delay, sends.delay],
    ] as const)
      if (amount) {
        const g = this.ctx.createGain();
        g.gain.value = amount;
        p.connect(g).connect(bus);
        extra.push(g);
      }
    return { node: p, all: [p, ...extra] };
  }
  private finish(
    src: AudioScheduledSourceNode,
    nodes: AudioNode[],
    stop: number,
  ) {
    src.stop(stop);
    src.onended = () => nodes.forEach((n) => n.disconnect());
  }
  /** Leads, plucks and the arpeggio: pulse voices with a filter envelope. */
  private tone(note: ScoreNote, t: number) {
    const ctx = this.ctx,
      inst = note.instrument;
    const f = note.note ? hz(note.note) : 0;
    const chord = note.notes?.map(hz) ?? [];
    if (!f && !chord.length) return;
    const lead = inst === "pro-lead" || inst === "pro-lead2";
    const dur = Math.max(0.04, note.duration),
      end = t + dur;
    const release = lead ? 0.09 : inst === "pro-pluck" ? 0.25 : 0.05;
    const o = this.out(
      note.pan ?? 0,
      lead
        ? { reverb: 0.22, delay: inst === "pro-lead" ? 0.2 : 0.12 }
        : inst === "pro-pluck"
          ? { reverb: 0.2, delay: 0.3 }
          : { reverb: 0.18, delay: 0.1 },
    );
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.Q.value = lead ? 1.2 : 2;
    const base = f || chord[0];
    if (inst === "pro-pluck") {
      filter.frequency.setValueAtTime(Math.min(9000, base * 10), t);
      filter.frequency.exponentialRampToValueAtTime(
        Math.max(300, base * 1.5),
        t + 0.22,
      );
    } else {
      filter.frequency.setValueAtTime(Math.min(12000, base * 12), t);
      filter.frequency.exponentialRampToValueAtTime(
        Math.min(9000, base * 7),
        t + 0.2,
      );
    }
    const env = ctx.createGain();
    const peak = note.volume;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(peak, t + (lead ? 0.008 : 0.003));
    if (inst === "pro-pluck") env.gain.setTargetAtTime(0.0001, t + 0.005, 0.12);
    else env.gain.setTargetAtTime(peak * (lead ? 0.75 : 0.8), t + 0.01, 0.12);
    env.gain.setTargetAtTime(0, end, release / 3);
    filter.connect(env).connect(o.node);
    const voices: [number, number, number][] = lead
      ? // Two pulses a few cents apart, spread a little: one wide voice.
        [
          [inst === "pro-lead" ? 0.25 : 0.125, -7, -0.3],
          [inst === "pro-lead" ? 0.125 : 0.25, 7, 0.3],
        ]
      : [[inst === "pro-arp" ? 0.125 : 0.5, 0, 0]];
    const all: AudioNode[] = [filter, env, ...o.all];
    let last: OscillatorNode | undefined;
    for (const [duty, cents, pan] of voices) {
      const osc = ctx.createOscillator();
      const wave = pulse(ctx, duty);
      if (wave) osc.setPeriodicWave(wave);
      else osc.type = "square";
      osc.detune.value = cents;
      if (chord.length && inst === "pro-arp") {
        const steps = Math.ceil(dur / (1 / 30) - 1e-6);
        for (let i = 0; i < steps; i++)
          osc.frequency.setValueAtTime(chord[i % chord.length], t + i / 30);
      } else if (note.from) {
        osc.frequency.setValueAtTime(hz(note.from), t);
        osc.frequency.exponentialRampToValueAtTime(f, t + 0.045);
      } else osc.frequency.setValueAtTime(f, t);
      if (lead && dur > 0.3) {
        const lfo = ctx.createOscillator(),
          depth = ctx.createGain();
        lfo.frequency.value = 5.4;
        depth.gain.setValueAtTime(0, t);
        depth.gain.setValueAtTime(0, t + 0.16);
        depth.gain.linearRampToValueAtTime(f * 0.009, t + 0.36);
        lfo.connect(depth).connect(osc.frequency);
        lfo.start(t);
        lfo.stop(end + release + 0.05);
        all.push(lfo, depth);
      }
      const sp = ctx.createStereoPanner();
      sp.pan.value = pan;
      osc.connect(sp).connect(filter);
      osc.start(t);
      all.push(osc, sp);
      last = osc;
      osc.stop(end + release + 0.05);
    }
    if (last) last.onended = () => all.forEach((n) => n.disconnect());
  }
  /** Three detuned saws under a soft lowpass, slow in and out, ducked by the kick. */
  private pad(note: ScoreNote, t: number) {
    const ctx = this.ctx,
      f = note.note ? hz(note.note) : 0;
    if (!f) return;
    const dur = note.duration,
      end = t + dur;
    const o = this.out(note.pan ?? 0, { reverb: 0.45 }, true);
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = Math.min(2400, f * 4);
    filter.Q.value = 0.5;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(note.volume, t + Math.min(0.5, dur * 0.3));
    env.gain.setTargetAtTime(0, end, 0.25);
    filter.connect(env).connect(o.node);
    const all: AudioNode[] = [filter, env, ...o.all];
    let last: OscillatorNode | undefined;
    for (const [cents, pan] of [
      [-11, -0.6],
      [0, 0],
      [11, 0.6],
    ]) {
      const osc = ctx.createOscillator(),
        sp = ctx.createStereoPanner();
      osc.type = "sawtooth";
      osc.frequency.value = f;
      osc.detune.value = cents;
      sp.pan.value = pan;
      osc.connect(sp).connect(filter);
      osc.start(t);
      osc.stop(end + 1.2);
      all.push(osc, sp);
      last = osc;
    }
    if (last) last.onended = () => all.forEach((n) => n.disconnect());
  }
  /** A sub sine and a filtered pulse: weight for headphones, bite for phones. */
  private bass(note: ScoreNote, t: number) {
    const ctx = this.ctx,
      f = note.note ? hz(note.note) : 0;
    if (!f) return;
    const dur = Math.max(0.05, note.duration),
      end = t + dur;
    const o = this.out(0, {}, true);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(note.volume, t + 0.004);
    env.gain.setTargetAtTime(note.volume * 0.7, t + 0.01, 0.1);
    env.gain.setTargetAtTime(0, end, 0.02);
    env.connect(o.node);
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = f;
    const subG = ctx.createGain();
    subG.gain.value = 0.65;
    sub.connect(subG).connect(env);
    const bite = ctx.createOscillator();
    const wave = pulse(ctx, 0.25);
    if (wave) bite.setPeriodicWave(wave);
    else bite.type = "square";
    bite.frequency.value = f;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 3;
    lp.frequency.setValueAtTime(Math.min(3000, f * 14), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(260, f * 4), t + 0.18);
    // More bite and less sub than a club bass: phones play the bite.
    const biteG = ctx.createGain();
    biteG.gain.value = 0.6;
    bite.connect(lp).connect(biteG).connect(env);
    sub.start(t);
    bite.start(t);
    sub.stop(end + 0.1);
    bite.stop(end + 0.1);
    const all = [env, sub, subG, bite, lp, biteG, ...o.all];
    bite.onended = () => all.forEach((n) => n.disconnect());
  }
  /** A two-operator FM bell for sparkle. */
  private bell(note: ScoreNote, t: number) {
    const ctx = this.ctx,
      f = note.note ? hz(note.note) : 0;
    if (!f) return;
    const o = this.out(note.pan ?? 0, { reverb: 0.4, delay: 0.25 });
    const car = ctx.createOscillator(),
      mod = ctx.createOscillator(),
      idx = ctx.createGain(),
      env = ctx.createGain();
    car.frequency.value = f;
    mod.frequency.value = f * 3.5;
    idx.gain.setValueAtTime(f * 2.2, t);
    idx.gain.exponentialRampToValueAtTime(f * 0.1, t + 0.6);
    mod.connect(idx).connect(car.frequency);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(note.volume, t + 0.002);
    env.gain.exponentialRampToValueAtTime(
      0.0001,
      t + Math.max(0.4, note.duration) + 0.8,
    );
    car.connect(env).connect(o.node);
    const stop = t + Math.max(0.4, note.duration) + 0.85;
    car.start(t);
    mod.start(t);
    mod.stop(stop);
    this.finish(car, [car, mod, idx, env, ...o.all], stop);
  }
  /** Kick: a sine diving from 150 Hz with a click; pulls the pads and bass down. */
  private kick(note: ScoreNote, t: number) {
    const ctx = this.ctx;
    const o = this.out(0, {});
    const osc = ctx.createOscillator(),
      env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(155, t);
    osc.frequency.exponentialRampToValueAtTime(46, t + 0.09);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(note.volume, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
    osc.connect(env).connect(o.node);
    osc.start(t);
    this.finish(osc, [osc, env, ...o.all], t + 0.34);
    this.noiseHit(t, note.volume * 0.35, 0.012, "highpass", 3500, 0, {});
    // Sidechain: the pads and bass dip under each kick and swell back.
    this.duck.gain.setValueAtTime(1, t);
    this.duck.gain.linearRampToValueAtTime(0.5, t + 0.012);
    this.duck.gain.setTargetAtTime(1, t + 0.04, 0.08);
  }
  private snare(note: ScoreNote, t: number) {
    const ctx = this.ctx;
    this.noiseHit(
      t,
      note.volume,
      0.2,
      "bandpass",
      2400,
      note.pan ?? 0.05,
      { reverb: 0.22 },
      0.7,
    );
    this.noiseHit(
      t,
      note.volume * 0.5,
      0.09,
      "highpass",
      6000,
      note.pan ?? 0.05,
      {},
    );
    const o = this.out(note.pan ?? 0.05, { reverb: 0.15 });
    const body = ctx.createOscillator(),
      env = ctx.createGain();
    body.type = "triangle";
    body.frequency.setValueAtTime(200, t);
    body.frequency.exponentialRampToValueAtTime(150, t + 0.07);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(note.volume * 0.7, t + 0.002);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    body.connect(env).connect(o.node);
    body.start(t);
    this.finish(body, [body, env, ...o.all], t + 0.12);
  }
  private hat(note: ScoreNote, t: number) {
    const open = note.instrument === "pro-ohat",
      shaker = note.instrument === "pro-shaker";
    this.noiseHit(
      t,
      note.volume,
      open ? 0.22 : shaker ? 0.05 : 0.035,
      shaker ? "bandpass" : "highpass",
      shaker ? 6500 : 8500,
      note.pan ?? 0.3,
      { reverb: open ? 0.15 : 0.05 },
      shaker ? 1.2 : 0.7,
      shaker ? 0.012 : 0.001,
    );
  }
  private tom(note: ScoreNote, t: number) {
    const ctx = this.ctx,
      f = note.note ? hz(note.note) : 140;
    const o = this.out(note.pan ?? 0, { reverb: 0.25 });
    const osc = ctx.createOscillator(),
      env = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(f * 1.6, t);
    osc.frequency.exponentialRampToValueAtTime(f, t + 0.08);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(note.volume, t + 0.003);
    env.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    osc.connect(env).connect(o.node);
    osc.start(t);
    this.finish(osc, [osc, env, ...o.all], t + 0.37);
    this.noiseHit(
      t,
      note.volume * 0.3,
      0.05,
      "bandpass",
      1800,
      note.pan ?? 0,
      {},
    );
  }
  private crash(note: ScoreNote, t: number) {
    this.noiseHit(
      t,
      note.volume,
      Math.max(1.2, note.duration),
      "highpass",
      5000,
      note.pan ?? -0.3,
      { reverb: 0.3 },
      0.5,
    );
    this.noiseHit(
      t,
      note.volume * 0.5,
      0.6,
      "bandpass",
      9000,
      note.pan ?? -0.3,
      {},
      2,
    );
  }
  /** A noise sweep that rises into a big moment. */
  private riser(note: ScoreNote, t: number) {
    const ctx = this.ctx,
      dur = note.duration,
      end = t + dur;
    const o = this.out(0, { reverb: 0.4 });
    const src = ctx.createBufferSource(),
      bp = ctx.createBiquadFilter(),
      env = ctx.createGain();
    src.buffer = this.noise;
    src.loop = true;
    bp.type = "bandpass";
    bp.Q.value = 2;
    bp.frequency.setValueAtTime(400, t);
    bp.frequency.exponentialRampToValueAtTime(9000, end);
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(note.volume, end);
    env.gain.linearRampToValueAtTime(0.0001, end + 0.03);
    src.connect(bp).connect(env).connect(o.node);
    src.start(t);
    this.finish(src, [src, bp, env, ...o.all], end + 0.05);
  }
  private noiseHit(
    t: number,
    volume: number,
    length: number,
    type: BiquadFilterType,
    freq: number,
    pan: number,
    sends: { reverb?: number; delay?: number },
    q = 0.7,
    attack = 0.001,
  ) {
    const ctx = this.ctx;
    const o = this.out(pan, sends);
    const src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      env = ctx.createGain();
    src.buffer = this.noise;
    src.loop = true;
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = q;
    env.gain.setValueAtTime(0.0001, t);
    env.gain.linearRampToValueAtTime(volume, t + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, t + length);
    src.connect(filter).connect(env).connect(o.node);
    src.start(t, Math.random() * Math.max(0, this.noise.duration - 0.2));
    this.finish(src, [src, filter, env, ...o.all], t + length + 0.02);
  }
}

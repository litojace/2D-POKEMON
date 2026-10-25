import type { CourtId } from "./arena-courts";

/**
 * Background sound for each duel court, made from filtered noise (no audio
 * files): the Coliseum's crowd murmur, waves at Tide Pools, the forge's low
 * rumble and crackle, and wind through the Shifting Ruins. It plays on the
 * effects volume and goes quiet while the tab is hidden.
 */
export class CourtAmbience {
  private out: GainNode;
  private nodes: AudioNode[] = [];
  private sources: AudioBufferSourceNode[] = [];
  private timer?: ReturnType<typeof setInterval>;
  /** Layers that the modulation timer moves. */
  private layers: Record<string, GainNode | BiquadFilterNode> = {};
  private cheerUntil = 0;
  private wave = 0;
  id: CourtId | null = null;

  constructor(
    private ctx: AudioContext,
    private noise: AudioBuffer,
    destination: AudioNode,
  ) {
    this.out = ctx.createGain();
    this.out.gain.value = 0;
    this.out.connect(destination);
  }

  /** Ambience level: 0..1 (the effects volume), 0 while hidden. */
  setLevel(level: number) {
    this.out.gain.setTargetAtTime(this.id ? level : 0, this.ctx.currentTime, 0.4);
  }

  play(id: CourtId | null, level: number) {
    if (id === this.id) return;
    this.stop();
    this.id = id;
    if (!id) return;
    const ctx = this.ctx,
      t = ctx.currentTime;
    /** A looping noise source through a filter into its own gain. */
    const layer = (
      name: string,
      type: BiquadFilterType,
      freq: number,
      q: number,
      gain: number,
    ) => {
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      // Start each layer at a different point in the noise so they don't phase.
      src.start(t, Math.random() * this.noise.duration);
      const filter = ctx.createBiquadFilter();
      filter.type = type;
      filter.frequency.value = freq;
      filter.Q.value = q;
      const g = ctx.createGain();
      g.gain.value = gain;
      src.connect(filter).connect(g).connect(this.out);
      this.sources.push(src);
      this.nodes.push(filter, g);
      this.layers[name] = g;
      this.layers[`${name}-filter`] = filter;
    };
    if (id === "classic") {
      layer("murmur", "bandpass", 650, 0.6, 0.11);
      layer("chatter", "bandpass", 1700, 1.4, 0.035);
    } else if (id === "tide-pools") {
      layer("surf", "lowpass", 480, 0.5, 0.025);
      layer("foam", "highpass", 2600, 0.4, 0.005);
    } else if (id === "ember-forge") {
      layer("rumble", "lowpass", 130, 0.8, 0.3);
      layer("roar", "bandpass", 420, 0.7, 0.05);
    } else {
      layer("wind", "bandpass", 420, 2.2, 0.24);
      layer("leaves", "highpass", 4200, 0.5, 0.0);
    }
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setValueAtTime(0, t);
    this.out.gain.setTargetAtTime(level, t, 0.8);
    this.wave = t;
    this.timer = setInterval(() => this.tick(), 200);
  }

  /** The crowd roars for a knockout (Coliseum only). */
  cheer() {
    if (this.id !== "classic") return;
    const g = this.layers.murmur as GainNode | undefined,
      c = this.layers.chatter as GainNode | undefined;
    if (!g || !c) return;
    const t = this.ctx.currentTime;
    this.cheerUntil = t + 1.6;
    g.gain.cancelScheduledValues(t);
    g.gain.setTargetAtTime(0.35, t, 0.08);
    c.gain.cancelScheduledValues(t);
    c.gain.setTargetAtTime(0.14, t, 0.08);
    g.gain.setTargetAtTime(0.11, t + 1.2, 0.5);
    c.gain.setTargetAtTime(0.035, t + 1.2, 0.5);
  }

  private tick() {
    const t = this.ctx.currentTime,
      L = this.layers;
    const set = (name: string, value: number, tc: number) =>
      (L[name] as GainNode | undefined)?.gain.setTargetAtTime(value, t, tc);
    if (this.id === "classic") {
      // The murmur rises and falls a little, as crowds do.
      if (t > this.cheerUntil) {
        set("murmur", 0.08 + Math.random() * 0.06, 0.6);
        set("chatter", 0.02 + Math.random() * 0.03, 0.3);
      }
    } else if (this.id === "tide-pools") {
      // A wave every 6–8 s: it builds, breaks, then drains back.
      if (t >= this.wave) {
        const period = 6 + Math.random() * 2;
        const surf = L.surf as GainNode,
          foam = L.foam as GainNode;
        surf.gain.cancelScheduledValues(t);
        surf.gain.setTargetAtTime(0.21, t, 0.9);
        surf.gain.setTargetAtTime(0.025, t + 2.4, 1.3);
        foam.gain.cancelScheduledValues(t);
        foam.gain.setTargetAtTime(0.045, t + 1.6, 0.4);
        foam.gain.setTargetAtTime(0.005, t + 3.0, 1.0);
        this.wave = t + period;
      }
    } else if (this.id === "ember-forge") {
      set("roar", 0.03 + Math.random() * 0.05, 0.5);
      // Embers crack and pop at random.
      if (Math.random() < 0.55) this.crackle(t + Math.random() * 0.2);
    } else if (this.id === "shifting-ruins") {
      const f = L["wind-filter"] as BiquadFilterNode;
      f.frequency.setTargetAtTime(260 + Math.random() * 520, t, 1.2);
      set("wind", 0.1 + Math.random() * 0.16, 1);
      if (Math.random() < 0.06) {
        set("leaves", 0.1, 0.15);
        (L.leaves as GainNode).gain.setTargetAtTime(0, t + 0.5, 0.3);
      }
    }
  }

  private crackle(at: number) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = "bandpass";
    f.frequency.value = 2200 + Math.random() * 2600;
    f.Q.value = 3;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.linearRampToValueAtTime(0.25 + Math.random() * 0.3, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.04 + Math.random() * 0.05);
    src.connect(f).connect(g).connect(this.out);
    src.start(at, Math.random() * (this.noise.duration - 0.2));
    src.stop(at + 0.12);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    const t = this.ctx.currentTime;
    this.out.gain.cancelScheduledValues(t);
    this.out.gain.setTargetAtTime(0, t, 0.25);
    const sources = this.sources,
      nodes = this.nodes;
    // Let the fade finish before disconnecting.
    setTimeout(() => {
      for (const s of sources) {
        try {
          s.stop();
        } catch {
          // Already stopped.
        }
        s.disconnect();
      }
      for (const n of nodes) n.disconnect();
    }, 1200);
    this.sources = [];
    this.nodes = [];
    this.layers = {};
    this.id = null;
  }
}

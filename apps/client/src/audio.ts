import { MUSIC_BPM, scoreStep, type MusicTheme } from "./music-score";
// Original adaptive lobby, PvP and raid scores plus synthesized combat effects.
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
const MIX = 0.5;
export class AudioManager {
  private lastRaidSound = new Map<string, number>();
  context?: AudioContext;
  music = Number(localStorage.getItem("arena-music") ?? 0.12);
  effects = Number(localStorage.getItem("arena-effects") ?? 0.3);
  timer?: ReturnType<typeof setInterval>;
  private musicBus?: GainNode;
  private scoreBus?: GainNode;
  private theme: MusicTheme = "lobby";
  private phase = 1;
  private autoStarted = false;
  private startupListeners?: AbortController;
  start() {
    if (this.autoStarted) return;
    this.autoStarted = true;
    this.startupListeners = new AbortController();
    const signal = this.startupListeners.signal;
    const resume = () => this.unlock();
    for (const event of ["pointerdown", "touchend", "keydown"])
      document.addEventListener(event, resume, {
        capture: true,
        passive: true,
        signal,
      });
    const foreground = () => {
      this.updateMusicGain();
      if (!document.hidden) this.unlock();
    };
    document.addEventListener("visibilitychange", foreground, { signal });
    window.addEventListener("pageshow", foreground, { signal });
    window.addEventListener("focus", foreground, { signal });
    this.unlock();
  }
  private updateMusicGain() {
    if (!this.context || !this.musicBus) return;
    this.musicBus.gain.setTargetAtTime(
      document.hidden ? 0 : this.music * MIX,
      this.context.currentTime,
      0.08,
    );
  }
  setTheme(theme: MusicTheme, phase = 1) {
    this.phase = phase;
    if (this.theme === theme) return;
    this.theme = theme;
    this.step = 0;
    if (!this.context || !this.musicBus) return;
    const previous = this.scoreBus;
    this.scoreBus = this.context.createGain();
    const t = this.context.currentTime;
    this.scoreBus.gain.setValueAtTime(0, t);
    this.scoreBus.gain.linearRampToValueAtTime(1, t + 1.1);
    this.scoreBus.connect(this.musicBus);
    if (previous) {
      previous.gain.cancelScheduledValues(t);
      previous.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => previous.disconnect(), 1800);
    }
    this.nextTime = t + 0.04;
  }
  private noise?: AudioBuffer;
  private step = 0;
  private nextTime = 0;
  unlock() {
    try {
      this.context ??= new AudioContext();
    } catch {
      return;
    }
    if (this.context.state !== "running")
      void this.context
        .resume()
        .then(() => this.schedule())
        .catch(() => {
          /* Retry on a trusted gesture if autoplay is blocked. */
        });
    if (!this.musicBus) {
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = this.music * MIX;
      this.musicBus.connect(this.context.destination);
      this.scoreBus = this.context.createGain();
      this.scoreBus.connect(this.musicBus);
      const length = Math.floor(this.context.sampleRate * 0.25);
      this.noise = this.context.createBuffer(
        1,
        length,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
    this.updateMusicGain();
    if (this.context.state === "running") this.schedule();
    // Look-ahead scheduler: queue notes slightly ahead so timing stays tight.
    this.timer ??= setInterval(() => this.schedule(), 25);
  }
  private schedule() {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || !this.musicBus) return;
    if (document.hidden || this.music <= 0) {
      this.nextTime = ctx.currentTime + 0.05;
      return;
    }
    if (this.nextTime < ctx.currentTime) this.nextTime = ctx.currentTime + 0.05;
    while (this.nextTime < ctx.currentTime + 0.12) {
      this.playStep(this.step, this.nextTime);
      this.step = (this.step + 1) % 128;
      this.nextTime += 60 / MUSIC_BPM[this.theme] / 4;
    }
  }
  private playStep(step: number, t: number) {
    const beat = 60 / MUSIC_BPM[this.theme];
    for (const note of scoreStep(this.theme, step, this.phase)) {
      if (note.instrument === "kick") this.kick(t, note.volume);
      else if (note.instrument === "tom")
        this.drum(t, note.volume, note.duration);
      else if (note.instrument === "snare" || note.instrument === "hat")
        this.hit(
          t,
          note.volume,
          note.duration,
          note.instrument === "hat" ? 6500 : 1600,
        );
      else
        this.voice(
          noteHz(note.note!),
          t,
          note.duration,
          note.volume,
          note.instrument === "bass" ? "triangle" : "sine",
          note.instrument === "pad" ? 0.22 : 0.008,
        );
      if (note.instrument === "bell")
        this.voice(
          noteHz(note.note!) * 2,
          t,
          note.duration * 0.55,
          note.volume * 0.18,
          "sine",
        );
      if (note.instrument === "pad")
        this.voice(
          noteHz(note.note!) * 1.003,
          t,
          beat * 3.8,
          note.volume * 0.3,
          "triangle",
          0.3,
        );
    }
  }
  private drum(t: number, volume: number, duration: number) {
    const ctx = this.context!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = "triangle";
    o.frequency.setValueAtTime(105, t);
    o.frequency.exponentialRampToValueAtTime(35, t + duration);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.scoreBus!);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private voice(
    hz: number,
    t: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    attack = 0.008,
  ) {
    const ctx = this.context!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.scoreBus!);
    o.start(t);
    o.stop(t + duration + 0.02);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private kick(t: number, volume = 0.3) {
    const ctx = this.context!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.scoreBus!);
    o.start(t);
    o.stop(t + 0.18);
    o.onended = () => {
      o.disconnect();
      g.disconnect();
    };
  }
  private hit(t: number, volume: number, duration: number, cutoff: number) {
    const ctx = this.context!,
      src = ctx.createBufferSource(),
      filter = ctx.createBiquadFilter(),
      g = ctx.createGain();
    src.buffer = this.noise!;
    filter.type = "highpass";
    filter.frequency.value = cutoff;
    g.gain.setValueAtTime(volume, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(filter).connect(g).connect(this.scoreBus!);
    src.start(t);
    src.stop(t + duration + 0.02);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      g.disconnect();
    };
  }
  tone(
    hz: number,
    duration: number,
    volume: number,
    type: OscillatorType = "triangle",
  ) {
    if (!this.context || this.context.state !== "running" || !volume) return;
    const o = this.context.createOscillator(),
      g = this.context.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, this.context.currentTime);
    o.frequency.exponentialRampToValueAtTime(
      hz * 0.55,
      this.context.currentTime + duration,
    );
    g.gain.setValueAtTime(volume, this.context.currentTime);
    g.gain.exponentialRampToValueAtTime(
      0.001,
      this.context.currentTime + duration,
    );
    o.connect(g).connect(this.context.destination);
    o.start();
    o.stop(this.context.currentTime + duration);
  }
  play(kind: string) {
    const hz: Record<string, number> = {
      cast: 660,
      hit: 160,
      dash: 360,
      jump: 480,
      land: 140,
      round: 880,
      ui: 520,
      victory: 1040,
      heal: 760,
      orb: 620,
      defeat: 180,
    };
    this.tone(
      hz[kind] ?? 440,
      kind === "round" ? 0.5 : 0.12,
      this.effects * 0.15,
      kind === "hit" ? "sawtooth" : "triangle",
    );
  }
  /** Original low, filtered rock/roar cues routed through the effects volume. */
  playRaid(kind: import("./raid-boss-motion").RaidBossCue) {
    const ctx = this.context;
    if (!ctx || ctx.state !== "running" || this.effects <= 0 || document.hidden)
      return;
    const t = ctx.currentTime;
    const frequent = kind === "chip" || kind === "core";
    if (
      t - (this.lastRaidSound.get(kind) ?? -10) <
      (frequent ? 0.12 : kind === "step" ? 0.2 : 0.5)
    )
      return;
    this.lastRaidSound.set(kind, t);
    // start pitch, end pitch, duration, filter, gain, rock texture.
    const profiles: Record<import("./raid-boss-motion").RaidBossCue, number[]> =
      {
        roar: [88, 27, 0.65, 380, 0.16, 0.06],
        step: [60, 25, 0.17, 200, 0.08, 0.03],
        slam: [76, 20, 0.5, 420, 0.2, 0.14],
        crash: [110, 25, 0.65, 900, 0.18, 0.16],
        awaken: [115, 32, 0.95, 480, 0.17, 0.08],
        fall: [65, 18, 0.95, 300, 0.17, 0.13],
        charge: [45, 145, 1.35, 650, 0.11, 0.07],
        debris: [280, 110, 0.65, 1700, 0.08, 0.09],
        "debris-hit": [95, 35, 0.3, 1100, 0.12, 0.12],
        core: [420, 180, 0.18, 1400, 0.08, 0.015],
        chip: [150, 60, 0.13, 1200, 0.07, 0.07],
      };
    const [start, end, duration, cutoff, volume, texture] = profiles[kind];
    const osc = ctx.createOscillator(),
      filter = ctx.createBiquadFilter(),
      gain = ctx.createGain();
    osc.type =
      kind === "roar" || kind === "awaken"
        ? "sawtooth"
        : kind === "core"
          ? "sine"
          : "triangle";
    osc.frequency.setValueAtTime(start, t);
    osc.frequency.exponentialRampToValueAtTime(end, t + duration);
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(cutoff, t);
    filter.frequency.exponentialRampToValueAtTime(
      Math.max(90, cutoff * 0.3),
      t + duration,
    );
    gain.gain.setValueAtTime(0.001, t);
    gain.gain.linearRampToValueAtTime(this.effects * volume, t + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.001, t + duration);
    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + duration + 0.02);
    osc.onended = () => {
      osc.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    if (this.noise) {
      const src = ctx.createBufferSource(),
        grit = ctx.createBiquadFilter(),
        mix = ctx.createGain();
      src.buffer = this.noise;
      src.loop = true;
      grit.type = "bandpass";
      grit.frequency.setValueAtTime(cutoff, t);
      grit.Q.value = 0.7;
      mix.gain.setValueAtTime(0.001, t);
      mix.gain.linearRampToValueAtTime(this.effects * texture, t + 0.02);
      mix.gain.exponentialRampToValueAtTime(0.001, t + duration);
      src.connect(grit).connect(mix).connect(ctx.destination);
      src.start(t);
      src.stop(t + duration + 0.02);
      src.onended = () => {
        src.disconnect();
        grit.disconnect();
        mix.disconnect();
      };
    }
  }
  set(kind: "music" | "effects", value: number) {
    this[kind] = value;
    localStorage.setItem(`arena-${kind}`, String(value));
    if (kind === "music") this.updateMusicGain();
  }
}

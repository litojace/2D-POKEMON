// Synthesized audio: an upbeat original chiptune loop plus short effect blips.
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
const BPM = 136,
  STEP = 60 / BPM / 4; // sixteenth notes
const _ = "";
/** Music bus headroom so the slider's 0–1 range stays comfortable. */
const MIX = 0.5;
/** Eight bars of sixteenths over C – G – Am – F, twice with a varied answer. */
const LEAD = [
  ["E5", _, "G5", _, "C6", _, "G5", _, "A5", "G5", "E5", _, "D5", _, "E5", _],
  ["D5", _, "G5", _, "B5", _, "G5", _, "D6", _, "B5", _, "G5", "A5", "B5", _],
  ["C6", _, "A5", _, "E5", _, "A5", _, "C6", "B5", "A5", _, "G5", _, "E5", _],
  ["F5", _, "A5", _, "C6", _, "A5", _, "G5", _, "F5", _, "E5", "D5", "C5", _],
  ["G5", "G5", _, "E5", "G5", _, "C6", _, "B5", _, "A5", _, "G5", _, "E5", _],
  ["B5", _, "D6", _, "B5", _, "G5", _, "A5", "B5", "D6", _, "B5", _, "G5", _],
  ["A5", _, "C6", _, "E6", _, "C6", _, "B5", _, "A5", _, "G5", _, "A5", _],
  ["F5", _, "A5", _, "C6", _, "D6", _, "E6", _, "D6", _, "B5", _, "G5", _],
];
const ROOTS = ["C", "G", "A", "F", "C", "G", "A", "F"];
const CHORDS: Record<string, string[]> = {
  C: ["C4", "E4", "G4"],
  G: ["B3", "D4", "G4"],
  A: ["C4", "E4", "A4"],
  F: ["C4", "F4", "A4"],
};
export class AudioManager {
  context?: AudioContext;
  music = Number(localStorage.getItem("arena-music") ?? 0.12);
  effects = Number(localStorage.getItem("arena-effects") ?? 0.3);
  timer?: ReturnType<typeof setInterval>;
  private musicBus?: GainNode;
  private noise?: AudioBuffer;
  private step = 0;
  private nextTime = 0;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume();
    if (!this.musicBus) {
      this.musicBus = this.context.createGain();
      this.musicBus.gain.value = this.music * MIX;
      this.musicBus.connect(this.context.destination);
      const length = Math.floor(this.context.sampleRate * 0.25);
      this.noise = this.context.createBuffer(
        1,
        length,
        this.context.sampleRate,
      );
      const data = this.noise.getChannelData(0);
      for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    }
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
      this.step = (this.step + 1) % (LEAD.length * 16);
      this.nextTime += STEP;
    }
  }
  private playStep(step: number, t: number) {
    const bar = Math.floor(step / 16),
      s = step % 16,
      root = ROOTS[bar];
    const lead = LEAD[bar][s];
    if (lead) this.voice(noteHz(lead), t, STEP * 1.6, 0.16, "square");
    // Bouncy octave bass on eighths.
    if (s % 2 === 0) {
      const octave = s % 4 === 0 ? 2 : 3;
      this.voice(noteHz(`${root}${octave}`), t, STEP * 1.8, 0.32, "triangle");
    }
    // Off-beat chord stabs.
    if (s === 4 || s === 12 || (s === 14 && bar % 2 === 1))
      for (const n of CHORDS[root])
        this.voice(noteHz(n), t, STEP * 1.2, 0.05, "square");
    // Drums.
    if (s === 0 || s === 8 || (s === 10 && bar % 2 === 1)) this.kick(t);
    if (s === 4 || s === 12) this.hit(t, 0.32, 0.12, 1800);
    if (s % 2 === 0) this.hit(t, 0.08, 0.03, 7000);
    if (bar === LEAD.length - 1 && s >= 12) this.hit(t, 0.18, 0.06, 2500);
  }
  private voice(
    hz: number,
    t: number,
    duration: number,
    volume: number,
    type: OscillatorType,
  ) {
    const ctx = this.context!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(hz, t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(volume, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    o.connect(g).connect(this.musicBus!);
    o.start(t);
    o.stop(t + duration + 0.02);
  }
  private kick(t: number) {
    const ctx = this.context!,
      o = ctx.createOscillator(),
      g = ctx.createGain();
    o.frequency.setValueAtTime(150, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.7, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    o.connect(g).connect(this.musicBus!);
    o.start(t);
    o.stop(t + 0.18);
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
    src.connect(filter).connect(g).connect(this.musicBus!);
    src.start(t);
    src.stop(t + duration + 0.02);
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
  set(kind: "music" | "effects", value: number) {
    this[kind] = value;
    localStorage.setItem(`arena-${kind}`, String(value));
    if (kind === "music" && this.musicBus && this.context)
      this.musicBus.gain.setTargetAtTime(
        value * MIX,
        this.context.currentTime,
        0.05,
      );
  }
}

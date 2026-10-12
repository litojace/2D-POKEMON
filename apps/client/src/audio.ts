export class AudioManager {
  context?: AudioContext;
  music = Number(localStorage.getItem("arena-music") ?? 0.12);
  effects = Number(localStorage.getItem("arena-effects") ?? 0.3);
  timer?: ReturnType<typeof setInterval>;
  note = 0;
  unlock() {
    this.context ??= new AudioContext();
    void this.context.resume();
    if (!this.timer)
      this.timer = setInterval(() => {
        if (document.hidden) return;
        const notes = [
          130.81, 164.81, 196, 164.81, 146.83, 174.61, 220, 174.61,
        ];
        this.tone(
          notes[this.note++ % notes.length],
          0.3,
          this.music * 0.12,
          "sine",
        );
      }, 450);
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
  }
}

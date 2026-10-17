import type { BackgroundTheme, ScoreNote } from "./music-score";
import type { SampleInstrument } from "./music-samples";
const phrase = (s: string) => s.split(" ").map((n) => (n === "-" ? "" : n));

// Original eight-bar sentences: each instrument has space to breathe.
const village = [
  phrase("G4 - - - B4 - A4 - G4 - - - D5 - - -"),
  phrase("F#4 - - - A4 - - - D5 - - - E5 - D5 -"),
  phrase("E5 - - - - - B4 - G4 - - - F#4 - - -"),
  phrase("E4 - - - G4 - - - C5 - - - - - - -"),
  phrase("C5 - - - E5 - D5 - C5 - - - A4 - - -"),
  phrase("B4 - - - A4 - - - G4 - A4 - F#4 - - -"),
  phrase("G4 - B4 - D5 - - - E5 - - - D5 - B4 -"),
  phrase("A4 - - - F#4 - - - G4 - - - - - - -"),
];
const villageAnswer = [
  phrase("D5 - - - G5 - - - F#5 - E5 - D5 - - -"),
  phrase("E5 - D5 - A4 - - - F#4 - - - A4 - - -"),
  phrase("B4 - - - E5 - - - G5 - - - F#5 - E5 -"),
  phrase("D5 - - - C5 - - - G4 - - - - - - -"),
  phrase("A4 - C5 - E5 - - - D5 - C5 - A4 - - -"),
  phrase("G4 - A4 - B4 - D5 - C5 - - - A4 - - -"),
  phrase("B4 - - - D5 - - - G5 - F#5 - E5 - D5 -"),
  phrase("B4 - - - A4 - - - G4 - - - - - - -"),
];
const duel = [
  phrase("D5 - - - F5 - E5 - D5 - A4 - C5 - D5 -"),
  phrase("F5 - - - A5 - - - G5 - F5 - E5 - C5 -"),
  phrase("E5 - G5 - C6 - - - B5 - G5 - E5 - D5 -"),
  phrase("D5 - - - A#4 - D5 - G5 - - - F5 - D5 -"),
  phrase("F5 - - - D5 - F5 - A#5 - A5 - G5 - F5 -"),
  phrase("A5 - - - G5 - F5 - C5 - - - E5 - F5 -"),
  phrase("E5 - - - C#5 - E5 - A5 - - - G5 - E5 -"),
  phrase("F5 - E5 - D5 - C#5 - A4 - - - C#5 - E5 -"),
];
const mountain = [
  phrase("A4 - - - E5 - - - F5 - E5 - C5 - - -"),
  phrase("D5 - - - C5 - - - A4 - - - - - - -"),
  phrase("F4 - - - A4 - - - C5 - - - D5 - C5 -"),
  phrase("B4 - - - G#4 - - - E5 - - - - - - -"),
  phrase("A4 - - - C5 - - - E5 - - - G5 - E5 -"),
  phrase("F5 - - - E5 - D5 - C5 - - - A4 - - -"),
  phrase("B4 - - - D5 - - - F5 - E5 - D5 - B4 -"),
  phrase("G#4 - - - B4 - - - E5 - - - G#5 - - -"),
];
const chords: Record<BackgroundTheme, string[][]> = {
  lobby: [
    ["G3", "B3", "D4", "A4"],
    ["D3", "F#3", "A3", "E4"],
    ["E3", "G3", "B3", "D4"],
    ["C3", "E3", "G3", "B3"],
    ["A3", "C4", "E4", "G4"],
    ["D3", "G3", "A3", "C4"],
    ["G3", "B3", "D4", "A4"],
    ["D3", "F#3", "A3", "C4"],
  ],
  pvp: [
    ["D4", "F4", "A4", "D5"],
    ["F4", "A4", "C5", "F5"],
    ["C4", "E4", "G4", "C5"],
    ["G3", "A#3", "D4", "G4"],
    ["A#3", "D4", "F4", "A#4"],
    ["F4", "A4", "C5", "F5"],
    ["A3", "C#4", "E4", "G4"],
    ["A3", "C#4", "E4", "G4"],
  ],
  raid: [
    ["A3", "C4", "E4", "A4"],
    ["D3", "F3", "A3", "C4"],
    ["F3", "A3", "C4", "E4"],
    ["E3", "G#3", "B3", "D4"],
    ["A3", "C4", "E4", "G4"],
    ["F3", "A3", "C4", "E4"],
    ["D3", "F3", "A3", "C4"],
    ["E3", "G#3", "B3", "D4"],
  ],
};
const roots = {
  lobby: ["G2", "D3", "E3", "C3", "A2", "D3", "G2", "D3"],
  pvp: ["D3", "F3", "C3", "G2", "A#2", "F3", "A2", "A2"],
  raid: ["A2", "D3", "F2", "E2", "A2", "F2", "D3", "E2"],
};

export function adventureStep(
  theme: BackgroundTheme,
  step: number,
  phase: number,
  bpm: number,
): ScoreNote[] {
  const position = ((step % 512) + 512) % 512,
    s = position % 16,
    bar = Math.floor(position / 16),
    h = bar % 8;
  const beat = 60 / bpm,
    bridge = bar >= 16 && bar < 20,
    chorus = (bar >= 8 && bar < 16) || bar >= 24;
  const chord = chords[theme][h],
    notes: ScoreNote[] = [];
  const add = (
    instrument: SampleInstrument,
    note: string | undefined,
    duration: number,
    volume: number,
    pan = 0,
  ) => notes.push({ instrument, note, duration, volume, pan });
  const pad = (volume: number) =>
    chord
      .slice(0, 3)
      .forEach((note, i) =>
        add("strings", note, beat * 3.85, volume, (i - 1) * 0.3),
      );
  const melody = (
    riff: string[],
    instrument: SampleInstrument,
    volume: number,
    octave = 0,
  ) => {
    if (!riff[s]) return;
    const next = riff.findIndex((n, i) => i > s && !!n),
      length = ((next < 0 ? 16 : next) - s) / 4;
    const note = riff[s].replace(/\d$/, (n) => String(Number(n) + octave));
    add(instrument, note, beat * Math.max(0.3, length * 0.94), volume, -0.15);
  };
  if (theme === "lobby") {
    if (s === 0) {
      chord
        .slice(0, 3)
        .forEach((note, i) =>
          add("piano", note, beat * 3.6, 0.13, (i - 1) * 0.18),
        );
      add("piano", roots.lobby[h], beat * 3.7, 0.23, -0.18);
      if (chorus) pad(0.032);
    }
    if (s % 2 === 0 && (!bridge || s % 4 === 0)) {
      const n = chord[[0, 2, 1, 3, 2, 1, 3, 2][s / 2]];
      add("harp", n, beat * 1.25, 0.15, s % 4 === 0 ? 0.25 : -0.25);
    }
    melody(
      (chorus ? villageAnswer : village)[h],
      bridge ? "piano" : "flute",
      bridge ? 0.18 : 0.25,
    );
  } else if (theme === "pvp") {
    if (s === 0) {
      pad(bridge ? 0.03 : 0.045);
      add("cello", roots.pvp[h], beat * (bridge ? 3.6 : 1.7), 0.22, -0.15);
    }
    if (!bridge && s === 8) add("cello", roots.pvp[h], beat * 1.7, 0.2, -0.15);
    if (s % 2 === 0 && !bridge) {
      const n = chord[[0, 2, 1, 2, 0, 3, 1, 2][s / 2]];
      add("spiccato", n, beat * 0.47, s % 4 === 0 ? 0.23 : 0.16, 0.25);
    }
    melody(duel[h], bridge ? "piano" : "flute", bridge ? 0.15 : 0.27);
    if (chorus) melody(duel[h], "strings", 0.1, -1);
    if (chorus && s % 4 === 2) add("harp", chord[3], beat * 0.9, 0.14, -0.3);
    if (!bridge) {
      if (s === 0 || s === 8) add("concert-bass", undefined, 0.9, 0.23);
      if (s === 4 || s === 12)
        add("concert-snare", undefined, 0.35, 0.14, 0.15);
      if (s === 14 && bar % 2) add("timpani", undefined, 0.65, 0.15, -0.2);
      if (bar % 8 === 0 && s === 0)
        add("concert-cymbal", undefined, 2.2, 0.06, 0.3);
      if (bar % 8 === 7 && s === 15)
        add("concert-snare", undefined, 0.25, 0.11, -0.2);
    }
  } else {
    if (s === 0) {
      pad(0.06);
      add("cello", roots.raid[h], beat * 3.8, 0.27, -0.2);
    }
    if (s % 4 === 0 && (!bridge || phase >= 3))
      add("spiccato", chord[[0, 2, 1, 2][s / 4]], beat * 0.72, 0.18, 0.3);
    melody(
      mountain[h],
      bridge ? "piano" : "horn",
      bridge ? 0.2 : 0.25,
      bridge ? 0 : -1,
    );
    if (chorus || phase >= 2) {
      if (s === 0 || s === 8) add("strings", chord[3], beat * 1.8, 0.1, 0.2);
    }
    if (s === 0 || s === 8) add("concert-bass", undefined, 1.1, 0.24);
    if (s === 4 || s === 12) add("concert-snare", undefined, 0.4, 0.12, 0.15);
    if (s === 14) add("timpani", undefined, 0.9, 0.19, -0.3);
    if (phase >= 2) {
      if (s === 6) add("timpani", undefined, 0.75, 0.17, 0.25);
      if (s === 10) add("concert-bass", undefined, 0.7, 0.16);
      if (s % 4 === 2) add("harp", chord[(s >> 2) % 4], beat * 0.8, 0.16, -0.2);
    }
    if (phase >= 3) {
      if (s === 3 || s === 11)
        add("timpani", undefined, 0.5, 0.18, s === 3 ? -0.25 : 0.25);
      if (s === 6 || s === 14) add("concert-snare", undefined, 0.3, 0.12);
      if (s === 4) add("concert-bass", undefined, 0.65, 0.16);
      if (s % 2 === 1)
        add("spiccato", chord[(s >> 1) % 4], beat * 0.34, 0.12, -0.2);
    }
    if (s === 0 && bar % 8 === 0)
      add("concert-cymbal", undefined, 2.6, 0.08, 0.3);
  }
  return notes;
}

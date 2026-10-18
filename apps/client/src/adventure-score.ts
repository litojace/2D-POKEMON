import type { BackgroundTheme, ScoreNote } from "./music-score";
import type { SampleInstrument } from "./music-samples";

export const ADVENTURE_LOOP_STEPS = 48 * 16;
type MelodyNote = { at: number; note: string; beats: number };
/** Explicit lengths leave real breaths between phrases. Positions are sixteenths. */
const line = (s: string): MelodyNote[] =>
  s.split(" ").map((token) => {
    const [at, note, beats] = token.split(":");
    return { at: Number(at), note, beats: Number(beats) };
  });
const lines = (bars: string[]) => bars.map(line);

// Lanterns at Dawn — D major. A rising fourth, answered by a falling third.
const lanterns = lines([
  "0:F#4:1.5 6:A4:.5 8:D5:1.5 14:E5:.5",
  "0:F#5:1 4:E5:.5 6:D5:.5 8:A4:1.5",
  "0:B4:1.5 6:D5:.5 8:F#5:1 12:E5:.5 14:D5:.5",
  "0:A4:2 10:F#4:.5 12:E4:.75",
  "0:G4:1.5 6:B4:.5 8:E5:1.5 14:F#5:.5",
  "0:G5:1 4:F#5:.5 6:E5:.5 8:D5:1.5",
  "0:C#5:1 4:B4:.5 6:A4:.5 8:B4:1 12:C#5:.75",
  "0:D5:2.5 12:A4:.5 14:C#5:.5",
  "0:D5:1 4:F#5:1 8:A5:1.5",
  "0:G5:1.5 6:F#5:.5 8:E5:1.5",
  "0:F#5:1.5 6:E5:.5 8:D5:1 12:B4:.75",
  "0:A4:1 4:B4:.5 6:D5:.5 8:E5:1.5",
  "0:G5:1.5 6:F#5:.5 8:E5:1 12:B4:.75",
  "0:D5:1.5 6:E5:.5 8:F#5:1.5",
  "0:E5:1 4:C#5:1 8:B4:.5 10:A4:.5 12:C#5:.75",
  "0:D5:3",
  "0:B4:2 10:F#4:1",
  "0:A4:1.5 6:G4:.5 8:E4:1.5",
  "0:G4:1 4:B4:1 8:D5:1.5",
  "0:C#5:2 10:A4:1",
  "0:B4:1.5 6:C#5:.5 8:D5:1.5",
  "0:E5:1.5 6:D5:.5 8:B4:1.5",
  "0:G4:1 4:A4:1 8:C#5:1.5",
  "0:E5:1.5 8:C#5:1 12:A4:.75",
  "0:F#5:1.5 6:A5:.5 8:D6:1.5",
  "0:C#6:1 4:A5:.5 6:F#5:.5 8:E5:1.5",
  "0:B4:1 4:D5:.5 6:F#5:.5 8:A5:1.5",
  "0:F#5:1 4:E5:1 8:D5:1.5",
  "0:G5:1.5 6:B5:.5 8:A5:1 12:G5:.75",
  "0:F#5:1 4:E5:.5 6:D5:.5 8:A4:1.5",
  "0:B4:1 4:C#5:1 8:E5:1 12:C#5:.75",
  "0:D5:2.5 12:E5:.5 14:F#5:.5",
]);

// Skybound Rivals — E minor. Syncopated piano gives way to a string-led hook.
const rivals = lines([
  "0:E5:.75 3:B4:.25 4:E5:.5 6:F#5:.5 8:G5:1 12:F#5:.5 14:E5:.5",
  "0:D5:1.5 6:E5:.5 8:G5:1 12:A5:.75",
  "0:B5:1 4:A5:.5 6:G5:.5 8:E5:.75 11:D5:.25 12:E5:.75",
  "0:F#5:1.5 6:D5:.5 8:A4:1 12:D5:.75",
  "0:E5:.75 3:B4:.25 4:E5:.5 6:F#5:.5 8:G5:.5 10:A5:.5 12:B5:.75",
  "0:A5:1.5 6:G5:.5 8:E5:1 12:C5:.75",
  "0:D#5:.5 2:F#5:.5 4:B5:1 8:A5:.5 10:F#5:.5 12:D#5:.75",
  "0:F#5:1 4:E5:.5 6:D#5:.5 8:B4:1 12:D#5:.5 14:F#5:.5",
  "0:G5:1.5 6:B5:.5 8:E6:1.5",
  "0:D6:1 4:B5:.5 6:A5:.5 8:G5:1.5",
  "0:A5:1.5 6:G5:.5 8:E5:1 12:G5:.75",
  "0:F#5:2 10:D5:.5 12:F#5:.75",
  "0:G5:1.5 6:A5:.5 8:B5:1 12:E6:.75",
  "0:D6:1 4:C6:.5 6:B5:.5 8:A5:1.5",
  "0:F#5:1 4:D#5:1 8:F#5:1 12:A5:.75",
  "0:B5:2 10:A5:.5 12:F#5:.75",
  "0:E5:2 10:B4:1",
  "0:D5:1.5 6:E5:.5 8:G5:1.5",
  "0:A5:1 4:G5:1 8:E5:1.5",
  "0:F#5:2.5",
  "0:G5:1.5 6:E5:.5 8:D5:1.5",
  "0:C5:1 4:E5:1 8:A5:1.5",
  "0:G5:1 4:F#5:1 8:E5:.5 10:D#5:.5 12:F#5:.75",
  "0:B4:1 4:D#5:.5 6:F#5:.5 8:A5:1 12:B5:.75",
  "0:E5:.5 2:G5:.5 4:B5:1 8:E6:1.5",
  "0:D6:.75 3:B5:.25 4:A5:1 8:G5:1 12:E5:.75",
  "0:A5:1 4:C6:1 8:B5:.5 10:A5:.5 12:G5:.75",
  "0:F#5:1.5 6:A5:.5 8:D6:1.5",
  "0:B5:1 4:G5:.5 6:E5:.5 8:G5:1 12:B5:.75",
  "0:C6:1.5 6:B5:.5 8:A5:1 12:G5:.75",
  "0:F#5:.5 2:D#5:.5 4:B4:.5 6:D#5:.5 8:F#5:1 12:A5:.75",
  "0:B5:1.5 8:F#5:.5 10:E5:.5 12:D#5:.5 14:B4:.5",
]);

// Crown of the Colossus — C minor. Horn calls, answering strings, a half-time march.
const colossus = lines([
  "0:C4:1.5 6:G4:.5 8:D#4:1.5",
  "0:F4:1 4:D#4:.5 6:D4:.5 8:C4:1.5",
  "0:G#3:1.5 6:D#4:.5 8:G4:1 12:F4:.75",
  "0:D4:2 10:B3:1",
  "0:C4:1 4:D#4:1 8:G4:1.5",
  "0:G#4:1.5 6:G4:.5 8:F4:1 12:D#4:.75",
  "0:D4:1.5 6:F4:.5 8:G#4:1 12:F4:.75",
  "0:G4:2 10:D4:.5 12:B3:.75",
  "0:G4:1.5 6:C5:.5 8:D#5:1.5",
  "0:D5:1 4:C5:1 8:G4:1.5",
  "0:G#4:1.5 6:C5:.5 8:D#5:1 12:F5:.75",
  "0:D5:2 10:B4:1",
  "0:C5:1 4:D#5:.5 6:D5:.5 8:C5:1.5",
  "0:G#4:1.5 6:G4:.5 8:F4:1.5",
  "0:F4:1 4:G#4:1 8:C5:1 12:D5:.75",
  "0:B4:2 10:G4:1",
  "0:D#4:2 10:G4:1",
  "0:F4:1.5 6:D#4:.5 8:C4:1.5",
  "0:G#4:2 10:G4:1",
  "0:F4:1.5 6:G4:.5 8:A#4:1.5",
  "0:C5:1.5 6:A#4:.5 8:G#4:1.5",
  "0:G4:1 4:F4:1 8:D#4:1.5",
  "0:D4:1 4:F4:1 8:G#4:1.5",
  "0:G4:1.5 8:D4:1 12:B3:.75",
  "0:C4:1 4:G4:.5 6:C5:.5 8:D#5:1.5",
  "0:F5:1.5 6:D#5:.5 8:C5:1 12:G4:.75",
  "0:G#4:1 4:C5:1 8:D#5:1.5",
  "0:D5:1 4:B4:1 8:G4:1.5",
  "0:C5:1.5 6:D5:.5 8:D#5:1 12:G5:.75",
  "0:F5:1.5 6:D#5:.5 8:C5:1 12:G#4:.75",
  "0:G#4:1 4:F4:1 8:D4:1 12:F4:.75",
  "0:G4:2 10:D4:.5 12:B3:.75",
]);

interface Harmony {
  chord: string[];
  bass: string;
}
const harmony = (chord: string, bass: string): Harmony => ({
  chord: chord.split(" "),
  bass,
});
const voicings: Record<string, Harmony> = {
  D: harmony("D3 F#3 A3 E4", "D2"),
  A: harmony("A3 C#4 E4 A4", "A2"),
  Bm: harmony("B3 D4 F#4 A4", "B2"),
  G: harmony("G3 B3 D4 F#4", "G2"),
  Em: harmony("E3 G3 B3 D4", "E2"),
  Fsm: harmony("F#3 A3 C#4 E4", "F#2"),
  Asus: harmony("A3 D4 E4 G4", "A2"),
  A7: harmony("A3 C#4 E4 G4", "A2"),
  C: harmony("C4 E4 G4 B4", "C3"),
  Am: harmony("A3 C4 E4 G4", "A2"),
  B7: harmony("B3 D#4 F#4 A4", "B2"),
  Esus: harmony("E3 A3 B3 E4", "E2"),
  Cm: harmony("C3 D#3 G3 C4", "C2"),
  Fm: harmony("F3 G#3 C4 D#4", "F2"),
  Ab: harmony("G#3 C4 D#4 G4", "G#2"),
  Eb: harmony("D#3 G3 A#3 D4", "D#2"),
  Bb: harmony("A#3 D4 F4 A#4", "A#2"),
  G7: harmony("G3 B3 D4 F4", "G2"),
  Gsus: harmony("G3 C4 D4 F4", "G2"),
};
const progressions: Record<BackgroundTheme, string[]> = {
  lobby:
    "D A Bm Fsm Em G Asus D D A Bm Fsm Em G A7 D Bm Em G A Bm Em Asus A7 D A Bm G Em D Asus D".split(
      " ",
    ),
  pvp: "Em C Em D Em Am B7 B7 Em G Am D Em Am B7 B7 Em C Am D G Am Esus B7 Em C Am D Em Am B7 B7".split(
    " ",
  ),
  raid: "Cm Fm Ab G7 Cm Fm Fm G7 Cm Eb Ab G7 Cm Fm Fm G7 Eb Fm Ab Bb Ab Fm Gsus G7 Cm Fm Ab G7 Cm Fm Fm G7".split(
    " ",
  ),
};
const melodies = { lobby: lanterns, pvp: rivals, raid: colossus };
// Statement, answer, quiet bridge, climax, varied answer, homecoming.
const sections = [0, 1, 2, 3, 1, 0];

export function adventureStep(
  theme: BackgroundTheme,
  step: number,
  phase: number,
  bpm: number,
): ScoreNote[] {
  const position =
    ((step % ADVENTURE_LOOP_STEPS) + ADVENTURE_LOOP_STEPS) %
    ADVENTURE_LOOP_STEPS;
  const s = position % 16,
    bar = Math.floor(position / 16),
    section = Math.floor(bar / 8);
  const sourceBar = sections[section] * 8 + (bar % 8);
  const bridge = section === 2,
    climax = section === 3,
    returnHome = section === 5;
  const full = section === 1 || climax || section === 4 || returnHome;
  const beat = 60 / bpm,
    { chord, bass } = voicings[progressions[theme][sourceBar]];
  const notes: ScoreNote[] = [];
  const add = (
    instrument: SampleInstrument,
    note: string | undefined,
    beats: number,
    volume: number,
    pan = 0,
  ) => notes.push({ instrument, note, duration: beats * beat, volume, pan });
  const shift = (note: string, octaves: number) =>
    note.replace(/\d$/, (n) => String(Number(n) + octaves));
  const sustain = (volume: number) =>
    chord
      .slice(0, 3)
      .forEach((n, i) => add("strings", n, 3.9, volume, -0.3 + i * 0.24));
  const lead = (
    instrument: SampleInstrument,
    volume: number,
    octave = 0,
    pan = -0.08,
  ) => {
    for (const n of melodies[theme][sourceBar])
      if (n.at === s)
        add(
          instrument,
          shift(n.note, octave),
          n.beats * 0.94,
          volume * (n.beats >= 1 ? 1 : 0.86),
          pan,
        );
  };
  // A held upper voice answers at phrase endings without doubling every lead note.
  const answer = (instrument: SampleInstrument, volume: number) => {
    if (bar % 2 === 1 && s === 12)
      add(instrument, shift(chord[2], 1), 0.85, volume, 0.22);
  };
  if (theme === "lobby") {
    lead(bridge ? "harp" : "piano", bridge ? 0.25 : 0.31);
    if (s === 0) {
      add("piano", bass, 3.8, 0.22, -0.16);
      if (full) sustain(climax ? 0.035 : 0.023);
    }
    // A gently lilting accompaniment leaves the melody's attacks clear.
    if ([0, 3, 6, 8, 11, 14].includes(s) && (!bridge || s === 0 || s === 8)) {
      const index = [0, 3, 6, 8, 11, 14].indexOf(s);
      add(
        "harp",
        chord[[0, 2, 1, 3, 2, 1][index]],
        1.35,
        s === 0 || s === 8 ? 0.12 : 0.09,
        0.25,
      );
    }
    if (full) answer("flute", 0.19);
    if (climax || section === 4) {
      if (s === 0 && bar % 2 === 0)
        add("flute", shift(chord[2], 1), 2.7, 0.12, 0.18);
      if (s === 8) add("cello", shift(bass, 1), 1.8, 0.075, -0.25);
    }
  } else if (theme === "pvp") {
    lead(
      section === 4 ? "flute" : full ? "strings" : "piano",
      section === 4 ? 0.24 : full ? 0.34 : bridge ? 0.15 : 0.3,
    );
    if (full) {
      // Lower piano attacks keep the string hook crisp without a second melody.
      for (const n of melodies.pvp[sourceBar])
        if (n.at === s && n.beats >= 1)
          add("piano", shift(n.note, -1), 0.75, 0.2, -0.2);
      answer("horn", 0.15);
    }
    if (s === 0) {
      add(
        "cello",
        shift(bass, 1),
        bridge ? 3.5 : 1.6,
        bridge ? 0.13 : 0.21,
        -0.2,
      );
      if (full || bridge) sustain(bridge ? 0.022 : 0.032);
    }
    if (s === 8 && !bridge) add("cello", shift(bass, 1), 1.6, 0.17, -0.2);
    if (s % 2 === 0 && !bridge)
      add(
        "spiccato",
        chord[[0, 2, 1, 2, 0, 3, 1, 2][s / 2]],
        0.4,
        s % 4 === 0 ? 0.2 : 0.135,
        0.25,
      );
    if (bridge && (s === 0 || s === 6 || s === 10))
      add("harp", chord[(s / 2) % 4], 1.3, 0.1, 0.2);
    if (!bridge) {
      if (s === 0 || s === 8 || (full && s === 14))
        add("concert-bass", undefined, 1.6, s === 14 ? 0.12 : 0.22);
      if (s === 4 || s === 12)
        add("concert-snare", undefined, 0.65, 0.135, 0.12);
      if (s === 10 && bar % 2)
        add("concert-snare", undefined, 0.35, 0.055, -0.12);
      if (bar % 8 === 7 && [10, 14, 15].includes(s))
        add("timpani", undefined, 0.9, 0.12 + (s - 10) * 0.01, -0.2);
      if (bar % 8 === 0 && s === 0)
        add("concert-cymbal", undefined, 4, 0.045, 0.3);
      if (climax && s % 4 === 2)
        add("harp", shift(chord[2], 1), 0.6, 0.08, -0.3);
    }
  } else {
    lead(
      bridge ? "cello" : section === 4 ? "horn" : full ? "strings" : "horn",
      bridge ? 0.2 : full ? 0.23 : 0.28,
      section === 4 ? -1 : 0,
    );
    if (full && !bridge && section !== 4) {
      for (const n of melodies.raid[sourceBar])
        if (n.at === s && n.beats >= 1.5)
          add("horn", shift(n.note, -1), n.beats * 0.9, 0.15, -0.15);
    }
    if (s === 0) {
      sustain(bridge ? 0.035 : 0.048);
      add("cello", bass, 3.8, 0.23, -0.2);
    }
    const active = !bridge || phase >= 3;
    if (active && [0, 3, 6, 8, 11, 14].includes(s))
      add(
        "spiccato",
        chord[s < 8 ? 0 : 2],
        0.55,
        s === 0 || s === 8 ? 0.16 : 0.1,
        0.25,
      );
    if (!bridge || phase >= 2) {
      if (s === 0 || s === 10) add("concert-bass", undefined, 2, 0.23);
      if (s === 8) add("concert-snare", undefined, 0.9, 0.12, 0.12);
      if (s === 14) add("timpani", undefined, 1.7, 0.17, -0.25);
    }
    if (phase >= 2) {
      if (s === 6) add("timpani", undefined, 1.2, 0.14, 0.2);
      if (s === 12) add("concert-bass", undefined, 1.3, 0.13);
      if (!bridge && s === 12) add("horn", chord[2], 0.85, 0.14, -0.2);
    }
    if (phase >= 3) {
      if (s === 3 || s === 11)
        add("timpani", undefined, 0.8, 0.14, s === 3 ? -0.2 : 0.2);
      if (s === 4 || s === 12) add("concert-snare", undefined, 0.6, 0.09);
      if (s % 4 === 2)
        add("spiccato", shift(chord[(s >> 2) % 4], 1), 0.4, 0.09, -0.25);
    }
    if (full) answer("flute", 0.12);
    if (s === 0 && bar % 8 === 0 && !bridge)
      add("concert-cymbal", undefined, 4.5, 0.065, 0.3);
  }
  return notes;
}

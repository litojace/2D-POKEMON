import type { BackgroundTheme, ResultTheme } from "./music-score";

/**
 * Each scene's tune: its melody (sixteenth-note positions, lengths in
 * beats), chords and form, and the results' jingles. pro-score.ts arranges
 * them.
 */

export const ADVENTURE_LOOP_STEPS = 48 * 16;
export type MelodyNote = { at: number; note: string; beats: number };
/** Sixteenth-note positions with explicit releases and breathing room. */
const lines = (bars: string[]): MelodyNote[][] =>
  bars.map((bar) =>
    bar.split(" ").map((token) => {
      const [at, note, beats] = token.split(":");
      return { at: Number(at), note, beats: Number(beats) };
    }),
  );

// Pocket Parade — G major. A skipping arpeggio and a little whistling answer.
const parade = lines([
  "0:G4:.5 2:B4:.5 4:D5:1 10:E5:.5 12:D5:.5",
  "0:F#4:.5 2:A4:.5 4:D5:1 8:C5:.5 12:A4:.75",
  "0:E5:.5 2:G5:.5 4:B5:1 8:A5:.5 10:G5:.5 12:E5:.75",
  "0:E5:1 4:D5:.5 6:C5:.5 10:G4:.5 12:E4:.75",
  "0:A4:.5 2:C5:.5 4:E5:1 10:G5:.5 12:E5:.5",
  "0:B4:.5 2:D5:.5 4:G5:1 8:E5:.5 12:D5:.75",
  "0:A4:.5 2:F#4:.5 4:A4:.5 8:C5:.5 10:B4:.5 12:A4:.75",
  "0:G4:.5 2:B4:.5 4:D5:.5 8:G5:1.25",
  "0:E5:.5 2:G5:.5 4:C6:1 10:B5:.5 12:G5:.75",
  "0:D5:.5 2:G5:.5 4:B5:1 8:A5:.5 12:G5:.75",
  "0:A5:1 4:G5:.5 6:E5:.5 10:C5:.5 12:E5:.5",
  "0:F#5:.5 2:E5:.5 4:D5:1 10:A4:.5 12:D5:.75",
  "0:B4:.5 2:D5:.5 4:G5:1 10:A5:.5 12:B5:.5",
  "0:G5:.5 2:E5:.5 4:B4:1 8:D5:.5 12:E5:.75",
  "0:C5:.5 2:E5:.5 4:A5:1 10:G5:.5 12:E5:.75",
  "0:F#5:1 4:E5:.5 6:D5:.5 10:C5:.5 12:A4:.75",
  "0:E4:1 6:G4:.5 8:B4:1.5",
  "0:C5:1 6:B4:.5 8:G4:1.5",
  "0:B4:.5 2:D5:.5 4:G5:1 10:D5:1",
  "0:F#5:1 6:E5:.5 8:D5:1.5",
  "0:E5:.5 2:C5:.5 4:A4:1 10:C5:1",
  "0:B4:1 6:G4:.5 8:E4:1.5",
  "0:E4:.5 2:G4:.5 4:C5:1 10:E5:1",
  "0:D5:1 6:C5:.5 8:A4:1 14:F#4:.5",
  "0:G5:.5 2:B5:.5 4:D6:1 10:B5:.5 12:G5:.75",
  "0:E5:.5 2:G5:.5 4:C6:1 8:B5:.5 12:G5:.75",
  "0:B5:1 4:A5:.5 6:G5:.5 10:E5:.5 12:D5:.75",
  "0:F#5:.5 2:A5:.5 4:C6:1 10:B5:.5 12:A5:.5",
  "0:G5:.5 2:B5:.5 4:E6:1 8:D6:.5 12:B5:.75",
  "0:C6:1 4:B5:.5 6:G5:.5 10:E5:.5 12:G5:.75",
  "0:A5:.5 2:F#5:.5 4:E5:.5 8:D5:.5 10:C5:.5 12:A4:.75",
  "0:G5:1 6:D5:.5 8:B4:1.25",
]);

// Hopscotch Heroes — C major. Short calls over a springy groove.
const hopscotch = lines([
  "0:C5:.5 3:E5:.25 4:G5:.5 8:C6:.75 12:B5:.5 14:G5:.5",
  "0:B5:.5 2:A5:.5 4:G5:1 10:D5:.5 12:G5:.75",
  "0:A5:.5 3:C6:.25 4:E6:.5 8:C6:.5 10:B5:.5 12:A5:.75",
  "0:A5:.5 2:G5:.5 4:F5:1 10:E5:.5 12:C5:.75",
  "0:E5:.5 3:G5:.25 4:C6:.5 8:G5:.5 10:E5:.5 12:D5:.75",
  "0:F5:.5 2:A5:.5 4:D6:.75 8:C6:.5 12:A5:.75",
  "0:B5:.5 2:G5:.5 4:F5:.5 8:D5:.5 10:F5:.5 12:B5:.75",
  "0:C6:1 6:G5:.5 8:E5:1.25",
  "0:F5:.5 2:A5:.5 4:C6:1 10:A5:.5 12:G5:.75",
  "0:E5:.5 3:G5:.25 4:C6:1 10:B5:.5 12:G5:.75",
  "0:A5:.5 2:D6:.5 4:F6:.75 8:E6:.5 10:D6:.5 12:A5:.75",
  "0:B5:.5 2:A5:.5 4:G5:1 10:F5:.5 12:D5:.75",
  "0:E5:.5 2:G5:.5 4:C6:1 10:D6:.5 12:E6:.5",
  "0:C6:.5 2:B5:.5 4:A5:.75 8:G5:.5 10:E5:.5 12:C5:.75",
  "0:F5:.5 2:A5:.5 4:C6:1 10:A5:.5 12:F5:.75",
  "0:G5:1 6:F5:.5 8:D5:.5 12:B4:.75",
  "0:E5:1 6:C5:.5 8:A4:1.25",
  "0:C5:1 6:F5:.5 8:A5:1.25",
  "0:G5:.5 2:E5:.5 4:C5:1 10:E5:1",
  "0:D5:1 6:G5:.5 8:B5:1.25",
  "0:A5:1 6:F5:.5 8:D5:1.25",
  "0:C5:.5 2:E5:.5 4:A5:1 10:G5:1",
  "0:F5:.5 2:A5:.5 4:C6:1 10:A5:.75",
  "0:B5:1 6:A5:.5 8:G5:1 14:B4:.5",
  "0:C5:.5 2:E5:.5 4:G5:.5 8:C6:1 14:G5:.5",
  "0:A5:.5 2:C6:.5 4:F6:1 10:E6:.5 12:C6:.5",
  "0:D6:.5 2:F6:.5 4:E6:.5 8:D6:.75 12:A5:.75",
  "0:B5:.5 2:D6:.5 4:G6:.75 8:F6:.5 12:D6:.75",
  "0:E6:.5 3:D6:.25 4:C6:1 10:G5:.5 12:E5:.75",
  "0:A5:.5 2:C6:.5 4:E6:1 10:C6:.5 12:A5:.75",
  "0:G5:.5 2:B5:.5 4:D6:.5 8:F6:.5 10:D6:.5 12:B5:.75",
  "0:C6:1 6:G5:.5 8:E5:1.25",
]);

// Big Friendly Trouble — D major. Cheeky footsteps and a heroic chorus.
const trouble = lines([
  "0:D4:.5 3:D4:.25 4:F#4:.5 8:A4:.75 12:B4:.5 14:A4:.5",
  "0:G4:.5 2:B4:.5 4:D5:1 10:B4:.5 12:G4:.75",
  "0:F#4:.5 3:A4:.25 4:D5:.75 8:A4:.5 12:F#4:.75",
  "0:E4:.5 2:G4:.5 4:A4:1 10:C#5:.5 12:A4:.75",
  "0:B4:.5 3:D5:.25 4:F#5:.75 8:E5:.5 12:D5:.75",
  "0:B4:.5 2:A4:.5 4:G4:1 10:D4:.5 12:G4:.75",
  "0:E4:.5 2:G4:.5 4:B4:1 10:D5:.5 12:B4:.75",
  "0:C#5:.5 2:B4:.5 4:A4:1 10:G4:.5 12:E4:.75",
  "0:F#5:.5 2:A5:.5 4:D6:1 10:C#6:.5 12:A5:.75",
  "0:B5:.5 2:A5:.5 4:G5:1 10:D5:.5 12:G5:.75",
  "0:F#5:.5 3:A5:.25 4:D6:1 10:A5:.5 12:F#5:.75",
  "0:E5:.5 2:G5:.5 4:A5:1 10:C#6:.5 12:A5:.75",
  "0:D6:1 6:C#6:.5 8:B5:.5 12:A5:.75",
  "0:G5:.5 2:B5:.5 4:D6:1 10:B5:.5 12:G5:.75",
  "0:F#5:.5 2:A5:.5 4:E6:.75 8:D6:.5 12:C#6:.75",
  "0:D6:1 6:A5:.5 8:F#5:1.25",
  "0:G4:.5 2:B4:.5 4:D5:1 10:E5:.75",
  "0:F#5:1 6:D5:.5 8:A4:1.25",
  "0:B4:.5 2:D5:.5 4:F#5:1 10:D5:.75",
  "0:A4:1 6:G4:.5 8:E4:1.25",
  "0:G4:.5 2:B4:.5 4:E5:1 10:F#5:.75",
  "0:D5:1 6:B4:.5 8:G4:1.25",
  "0:F#4:.5 2:A4:.5 4:D5:1 10:E5:.75",
  "0:C#5:1 6:B4:.5 8:A4:1 14:E4:.5",
  "0:D5:.5 2:F#5:.5 4:A5:1 10:D6:.75",
  "0:B5:.5 2:A5:.5 4:G5:1 10:D5:.5 12:G5:.75",
  "0:F#5:.5 3:A5:.25 4:D6:1 10:E6:.5 12:D6:.5",
  "0:C#6:.5 2:A5:.5 4:G5:.75 8:E5:.5 12:A5:.75",
  "0:B5:.5 2:D6:.5 4:F#6:.75 8:E6:.5 12:D6:.75",
  "0:B5:.5 2:G5:.5 4:D5:1 10:G5:.5 12:B5:.5",
  "0:A5:.5 2:G5:.5 4:E5:.5 8:C#5:.5 10:E5:.5 12:A5:.75",
  "0:D6:1 6:A5:.5 8:F#5:1.25",
]);

// Skyward Steps — E major, lifted by a Lydian F# major. Every phrase climbs,
// as the Spire does.
const skyward = lines([
  "0:E4:.5 2:F#4:.5 4:G#4:.5 6:B4:.5 8:E5:1 12:D#5:.5 14:E5:.5",
  "0:F#5:.75 3:E5:.25 4:C#5:.5 6:A#4:.5 8:C#5:1.5",
  "0:G#4:.5 2:A4:.5 4:B4:.5 6:E5:.5 8:G#5:1 12:F#5:.5 14:E5:.5",
  "0:D#5:.75 3:C#5:.25 4:B4:.5 6:F#4:.5 8:B4:1.5",
  "0:C#5:.5 2:D#5:.5 4:E5:.5 6:G#5:.5 8:C#6:1 12:B5:.5 14:G#5:.5",
  "0:A5:.75 3:G#5:.25 4:E5:.5 6:C#5:.5 8:E5:1 12:F#5:.5 14:G#5:.5",
  "0:A#5:.75 3:G#5:.25 4:F#5:.5 6:C#5:.5 8:F#5:1 12:E5:.5 14:C#5:.5",
  "0:D#5:1 4:F#5:.5 6:A5:.5 8:B5:1.25",
  "0:C#5:.5 2:E5:.5 4:A5:.5 6:C#6:.5 8:B5:1 12:A5:.5 14:E5:.5",
  "0:G#5:.75 3:F#5:.25 4:E5:.5 6:B4:.5 8:E5:1.5",
  "0:A4:.5 2:C#5:.5 4:F#5:.5 6:A5:.5 8:G#5:1 12:F#5:.5 14:E5:.5",
  "0:D#5:.75 3:E5:.25 4:F#5:.5 6:B5:.5 8:D#6:1.5",
  "0:D#6:.75 3:B5:.25 4:G#5:.5 6:D#5:.5 8:G#5:1 12:B5:.5 14:D#6:.5",
  "0:E6:.75 3:C#6:.25 4:G#5:.5 6:E5:.5 8:C#6:1.5",
  "0:A5:.5 2:B5:.5 4:C#6:.5 6:E6:.5 8:D#6:.5 10:C#6:.5 12:B5:.75",
  "0:A5:1 4:F#5:.5 6:D#5:.5 8:B4:1 12:D#5:.5 14:F#5:.5",
  "0:E5:1 4:G#5:.5 6:C#6:.5 8:B5:1.5",
  "0:A5:1 4:E5:.5 6:C#5:.5 8:E5:1.5",
  "0:G#5:1 4:B5:.5 6:E6:.5 8:C#6:1.5",
  "0:F#5:1 4:D#5:.5 6:B4:.5 8:D#5:1.5",
  "0:C#5:1 4:E5:.5 6:G#5:.5 8:C#6:1.5",
  "0:C#6:1 4:B5:.5 6:A5:.5 8:E5:1.5",
  "0:F#5:1 4:A#5:.5 6:C#6:.5 8:A#5:1",
  "0:B5:1 4:F#5:.5 6:D#5:.5 8:B4:1 14:B4:.25",
  "0:E5:.5 2:G#5:.5 4:B5:.5 6:E6:.5 8:G#6:1 12:F#6:.5 14:E6:.5",
  "0:F#6:.75 3:E6:.25 4:D6:.5 6:A5:.5 8:F#5:1 12:A5:.5 14:D6:.5",
  "0:E6:.75 3:C#6:.25 4:A5:.5 6:E5:.5 8:A5:1 12:B5:.5 14:C#6:.5",
  "0:B5:.75 3:G#5:.25 4:E5:.5 6:G#5:.5 8:B5:1.5",
  "0:C#6:.5 2:D#6:.5 4:E6:.5 6:G#6:.5 8:E6:1 12:C#6:.5 14:B5:.5",
  "0:A#5:.75 3:C#6:.25 4:F#6:.5 6:C#6:.5 8:A#5:1 12:F#5:.5 14:A#5:.5",
  "0:B5:.5 2:A5:.5 4:F#5:.5 6:D#5:.5 8:F#5:.5 10:A5:.5 12:D#6:.75",
  "0:E6:1 6:B5:.5 8:G#5:1.25",
]);

interface Harmony {
  chord: string[];
  bass: string;
}
const harmony = (chord: string, bass: string): Harmony => ({
  chord: chord.split(" "),
  bass,
});
// Added sixths and ninths keep the harmony warm.
export const voicings: Record<string, Harmony> = {
  G: harmony("G3 B3 D4 E4", "G2"),
  D: harmony("D3 F#3 A3 E4", "D2"),
  D7: harmony("D3 F#3 A3 C4", "D2"),
  Em: harmony("E3 G3 B3 D4", "E2"),
  C: harmony("C3 E3 G3 A3", "C2"),
  Am: harmony("A3 C4 E4 G4", "A2"),
  F: harmony("F3 A3 C4 D4", "F2"),
  Dm: harmony("D3 F3 A3 C4", "D2"),
  G7: harmony("G3 B3 D4 F4", "G2"),
  A: harmony("A3 C#4 E4 F#4", "A2"),
  A7: harmony("A3 C#4 E4 G4", "A2"),
  Bm: harmony("B3 D4 F#4 A4", "B2"),
  // The Spire's E major and its Lydian F# major (with A, and D for the summit).
  E: harmony("E3 G#3 B3 C#4", "E2"),
  B: harmony("B2 D#3 F#3 G#3", "B1"),
  B7: harmony("B2 D#3 F#3 A3", "B1"),
  "C#m": harmony("C#3 E3 G#3 B3", "C#2"),
  "F#": harmony("F#3 A#3 C#4 E4", "F#2"),
  "F#m": harmony("F#3 A3 C#4 E4", "F#2"),
  "G#m": harmony("G#3 B3 D#4 F#4", "G#2"),
};
export const progressions: Record<BackgroundTheme, string[]> = {
  lobby:
    "G D Em C Am G D7 G C G Am D G Em Am D7 Em C G D Am Em C D7 G C G D7 Em C D7 G".split(
      " ",
    ),
  pvp: "C G Am F C Dm G7 C F C Dm G C Am F G7 Am F C G Dm Am F G7 C F Dm G C Am G7 C".split(
    " ",
  ),
  raid: "D G D A7 Bm G Em A7 D G D A7 Bm G A7 D G D Bm A7 Em G D A7 D G D A7 Bm G A7 D".split(
    " ",
  ),
  spire:
    "E F# E B C#m A F# B7 A E F#m B G#m C#m A B7 C#m A E B C#m A F# B E D A E C#m F# B7 E".split(
      " ",
    ),
};
export const melodies: Record<BackgroundTheme, MelodyNote[][]> = {
  lobby: parade,
  pvp: hopscotch,
  raid: trouble,
  spire: skyward,
};
// Introduce the hook, answer, take a breath, celebrate, vary, then come home.
export const sections = [0, 1, 2, 3, 1, 0];
export const shift = (note: string, octaves: number) =>
  note.replace(/\d$/, (n) => String(Number(n) + octaves));

// Victory, defeat and draw: four, three and two bars.
const phrase = (notes: string) =>
  notes.split(" ").map((n) => (n === "-" ? "" : n));
/** The results' chords, a bar each. */
export const resultChords: Record<ResultTheme, string[][]> = {
  victory: [
    ["D4", "F#4", "A4"],
    ["G3", "B3", "D4"],
    ["A3", "C#4", "E4", "G4"],
    ["D4", "F#4", "A4", "E5"],
  ],
  defeat: [
    ["B3", "D4", "F#4"],
    ["E3", "G3", "B3", "D4"],
    ["B3", "D4", "F#4", "C#5"],
  ],
  draw: [
    ["D4", "A4", "E5"],
    ["G3", "A3", "D4"],
  ],
};
/** The results' tunes, a sixteenth a slot ("" holds). */
export const resultMelody: Record<ResultTheme, string[][]> = {
  victory: [
    phrase("D5 - F#5 - A5 - - - B5 - A5 - F#5 - E5 -"),
    phrase("G5 - B5 - D6 - - - B5 - A5 - G5 - - -"),
    phrase("A5 - - - E5 - F#5 - G5 - E5 - C#5 - E5 -"),
    phrase("D6 - - - A5 - - - D5 - - - - - - -"),
  ],
  defeat: [
    phrase("F#4 - - - E4 - - - D4 - - - C#4 - - -"),
    phrase("B3 - - - D4 - - - E4 - - - F#4 - - -"),
    phrase("D4 - - - C#4 - - - B3 - - - - - - -"),
  ],
  draw: [
    phrase("A4 - - - D5 - - - E5 - - - - - - -"),
    phrase("D5 - - - A4 - - - - - - - - - - -"),
  ],
};
export const resultBass: Record<ResultTheme, string[]> = {
  victory: ["D3", "G2", "A2", "D3"],
  defeat: ["B2", "E2", "B2"],
  draw: ["D3", "G2"],
};

import type { BackgroundTheme, ScoreNote } from "./music-score";
import type { SampleInstrument } from "./music-samples";

export const ADVENTURE_LOOP_STEPS = 48 * 16;
type MelodyNote = { at: number; note: string; beats: number };
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

// Hopscotch Heroes — C major. Short flute calls over a springy piano groove.
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

// Big Friendly Trouble — D major. Cheeky brass footsteps and a heroic flute chorus.
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

// Fountain Square — F major. A strolling flute over harp ripples like the
// fountain's, and plucked cello; no drums, for the Plaza's easy pace.
const fountain = lines([
  "0:C5:.75 3:A4:.25 4:F4:.5 6:A4:.5 8:C5:1 12:D5:.5 14:C5:.5",
  "0:A4:.75 3:F4:.25 4:D4:.5 6:F4:.5 8:A4:1.5",
  "0:A#4:.75 3:A4:.25 4:G4:.5 6:A#4:.5 8:D5:1 12:C5:.5 14:A#4:.5",
  "0:A#4:.5 2:G4:.5 4:E4:.5 6:G4:.5 8:C5:1.5",
  "0:C5:.75 3:A4:.25 4:F4:.5 6:A4:.5 8:C5:1 12:F5:.5 14:E5:.5",
  "0:E5:.75 3:C5:.25 4:A4:.5 6:C5:.5 8:E5:1 12:D5:.5 14:C5:.5",
  "0:D5:.5 2:C5:.5 4:A#4:.5 6:A4:.5 8:G4:1 12:A4:.5 14:A#4:.5",
  "0:A#4:.5 2:A4:.5 4:G4:.5 6:A4:.5 8:E5:1.25",
  "0:D5:.75 3:C5:.25 4:A#4:.5 6:D5:.5 8:F5:1 12:D5:.5 14:F5:.5",
  "0:A5:.75 3:G5:.25 4:F5:.5 6:C5:.5 8:A4:1.5",
  "0:G4:.5 2:A#4:.5 4:D5:.5 6:G5:.5 8:F5:.5 10:D5:.5 12:A#4:.75",
  "0:C5:.75 3:D5:.25 4:E5:.5 6:G5:.5 8:C6:1.5",
  "0:C6:.75 3:A5:.25 4:E5:.5 6:A5:.5 8:G5:1 12:E5:.5 14:C5:.5",
  "0:D5:.75 3:F5:.25 4:A5:.5 6:F5:.5 8:D5:1.5",
  "0:A#4:.5 2:D5:.5 4:G5:.5 6:F5:.5 8:D5:.5 10:A#4:.5 12:C5:.75",
  "0:E5:1 4:G5:.5 6:E5:.5 8:C5:1 12:A#4:.5 14:G4:.5",
  "0:F5:1 4:E5:.5 6:D5:.5 8:A4:1.5",
  "0:C5:1 4:E5:.5 6:A5:.5 8:G5:1.5",
  "0:F5:1 4:D5:.5 6:A#4:.5 8:D5:1.5",
  "0:C5:1 4:A4:.5 6:F4:.5 8:A4:1.5",
  "0:D5:1 4:F5:.5 6:A5:.5 8:D6:1.5",
  "0:C6:1 4:A5:.5 6:E5:.5 8:A5:1.5",
  "0:A#5:1 4:F5:.5 6:D5:.5 8:F5:1",
  "0:E5:1 4:G5:.5 6:C6:.5 8:E5:1 14:C5:.5",
  "0:F5:.75 3:A5:.25 4:C6:.5 6:A5:.5 8:F5:1 12:G5:.5 14:A5:.5",
  "0:E6:.75 3:C6:.25 4:A5:.5 6:C6:.5 8:E6:1 12:D6:.5 14:C6:.5",
  "0:D6:.75 3:C6:.25 4:A#5:.5 6:F5:.5 8:D6:1 12:C6:.5 14:A#5:.5",
  "0:A5:.75 3:G5:.25 4:F5:.5 6:A5:.5 8:C6:1.5",
  "0:D6:.5 2:C6:.5 4:A5:.5 6:F5:.5 8:A5:1 12:D6:.5 14:F6:.5",
  "0:D6:.75 3:A#5:.25 4:G5:.5 6:A#5:.5 8:D6:1 12:C6:.5 14:A#5:.5",
  "0:A#5:.5 2:G5:.5 4:E5:.5 6:G5:.5 8:A#5:.5 10:G5:.5 12:E5:.75",
  "0:F5:1 6:C5:.5 8:A4:1.25",
]);

// Skyward Steps — E major, lifted by a Lydian F# major. Every phrase climbs,
// as the Spire does: crisp strings, horn calls, then a flute summit.
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
// Added sixths and ninths keep the harmony warm without a heavy orchestral pad.
const voicings: Record<string, Harmony> = {
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
  // The Plaza's F major.
  Bb: harmony("A#2 D3 F3 A3", "A#1"),
  Gm: harmony("G3 A#3 D4 F4", "G2"),
  C7: harmony("C3 E3 G3 A#3", "C2"),
  // The Spire's E major and its Lydian F# major (with A, and D for the summit).
  E: harmony("E3 G#3 B3 C#4", "E2"),
  B: harmony("B2 D#3 F#3 G#3", "B1"),
  B7: harmony("B2 D#3 F#3 A3", "B1"),
  "C#m": harmony("C#3 E3 G#3 B3", "C#2"),
  "F#": harmony("F#3 A#3 C#4 E4", "F#2"),
  "F#m": harmony("F#3 A3 C#4 E4", "F#2"),
  "G#m": harmony("G#3 B3 D#4 F#4", "G#2"),
};
const progressions: Record<BackgroundTheme, string[]> = {
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
  plaza:
    "F Dm Gm C7 F Am Bb C7 Bb F Gm C Am Dm Gm C7 Dm Am Bb F Dm Am Bb C F Am Bb F Dm Gm C7 F".split(
      " ",
    ),
  spire:
    "E F# E B C#m A F# B7 A E F#m B G#m C#m A B7 C#m A E B C#m A F# B E D A E C#m F# B7 E".split(
      " ",
    ),
};
const melodies: Record<BackgroundTheme, MelodyNote[][]> = {
  lobby: parade,
  pvp: hopscotch,
  raid: trouble,
  plaza: fountain,
  spire: skyward,
};
// Introduce the hook, answer, take a breath, celebrate, vary, then come home.
const sections = [0, 1, 2, 3, 1, 0];
const shift = (note: string, octaves: number) =>
  note.replace(/\d$/, (n) => String(Number(n) + octaves));

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
    climax = section === 3;
  const full = section === 1 || climax || section === 4 || section === 5;
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
          n.beats * 0.88,
          volume * (n.beats >= 0.75 ? 1 : 0.87),
          pan,
        );
  };
  const chordHit = (
    instrument: SampleInstrument,
    volume: number,
    beats: number,
  ) =>
    chord
      .slice(1, 3)
      .forEach((note, i) =>
        add(instrument, note, beats, volume, 0.18 + i * 0.12),
      );
  const pad = (volume: number) =>
    chord
      .slice(0, 3)
      .forEach((note, i) =>
        add("strings", note, 3.65, volume, -0.3 + i * 0.25),
      );
  // A short response in the lead's rests, rather than a constant doubled melody.
  const answer = (instrument: SampleInstrument, volume: number) => {
    if (bar % 2 === 1 && s === 14)
      add(instrument, shift(chord[2], 1), 0.4, volume, 0.3);
  };
  if (theme === "lobby") {
    lead(
      bridge ? "harp" : section === 1 || section === 4 ? "flute" : "piano",
      bridge ? 0.22 : 0.27,
    );
    if (s === 0) {
      add("piano", shift(bass, 1), bridge ? 2.4 : 0.8, 0.15, -0.2);
      if (full) pad(climax ? 0.022 : 0.014);
    }
    if (!bridge && s === 8) add("piano", chord[2], 0.65, 0.11, -0.2);
    // Little offbeat chords supply a friendly bounce without busy drums.
    if (!bridge && (s === 4 || s === 12)) chordHit("spiccato", 0.065, 0.35);
    if ((bridge ? [0, 6, 10] : [2, 6, 10, 14]).includes(s))
      add(
        "harp",
        chord[[0, 2, 1, 3][Math.floor(s / 4)]],
        0.7,
        bridge ? 0.08 : 0.07,
        0.25,
      );
    if (full) answer(section === 1 || section === 4 ? "piano" : "flute", 0.13);
    if (climax && s === 8) add("flute", shift(chord[2], 1), 1.6, 0.075, 0.18);
  } else if (theme === "pvp") {
    lead(
      bridge ? "harp" : section === 1 || climax ? "piano" : "flute",
      bridge ? 0.19 : 0.26,
    );
    if (s === 0) {
      add(
        "cello",
        shift(bass, 1),
        bridge ? 2.5 : 0.7,
        bridge ? 0.11 : 0.16,
        -0.2,
      );
      if (full) pad(0.018);
    }
    if (!bridge) {
      if (s === 8) add("cello", chord[2], 0.65, 0.14, -0.2);
      if (s === 2 || s === 10) chordHit("piano", 0.075, 0.45);
      if ([0, 4, 8, 12].includes(s))
        add(
          "spiccato",
          chord[[0, 2, 1, 2][s / 4]],
          0.35,
          full ? 0.11 : 0.08,
          0.25,
        );
      if (s === 0 || s === 8) add("concert-bass", undefined, 0.8, 0.15);
      if (s === 4 || s === 12)
        add("concert-snare", undefined, 0.35, 0.075, 0.1);
      if (s === 6 || s === 14)
        add("harp", shift(chord[2], 1), 0.35, 0.065, -0.3);
      if (full) answer("flute", 0.12);
      if (bar % 8 === 7 && (s === 13 || s === 15))
        add("concert-snare", undefined, 0.22, s === 15 ? 0.07 : 0.045, -0.1);
      if (climax && s === 0 && bar % 4 === 0)
        add("concert-cymbal", undefined, 1.5, 0.025, 0.3);
    } else if (s === 4 || s === 10)
      add("piano", chord[s === 4 ? 1 : 2], 1.1, 0.09, 0.2);
  } else if (theme === "plaza") {
    // Fountain Square: flute and piano take turns over the harp's ripples.
    const flute = section === 0 || section === 3 || section === 5;
    lead(bridge ? "harp" : flute ? "flute" : "piano", bridge ? 0.21 : 0.25);
    if (climax) lead("strings", 0.1, -1, 0.12);
    if (s === 0) {
      add(
        "cello",
        shift(bass, 1),
        bridge ? 2.6 : 0.55,
        bridge ? 0.12 : 0.15,
        -0.2,
      );
      if (full || bridge) pad(climax ? 0.022 : bridge ? 0.018 : 0.013);
    }
    if (!bridge) {
      // Plucked cello on the third beat, and the ripples: a broken chord in eighths.
      if (s === 8) add("cello", chord[2], 0.5, 0.12, -0.2);
      if (s % 2 === 0) {
        const i = [0, 1, 2, 3, 1, 2, 3, 2][s / 2];
        add(
          "harp",
          s === 8 ? shift(chord[1], 1) : chord[i],
          0.6,
          s === 0 ? 0.075 : 0.055,
          0.28,
        );
      }
      if (bar % 2 === 1 && (s === 6 || s === 14))
        add("piano", shift(chord[3], 1), 0.5, 0.055, 0.35);
    } else if (s === 4 || s === 10)
      add("harp", chord[s === 4 ? 1 : 2], 1.2, 0.07, 0.3);
    if (full) answer(flute ? "piano" : "flute", 0.11);
    if (climax && s === 0 && bar % 8 === 0)
      add("concert-cymbal", undefined, 2, 0.018, 0.3);
  } else if (theme === "spire") {
    // Skyward Steps: crisp strings climb, horns answer, the flute reaches the top.
    const strings = section === 0 || section === 5;
    lead(
      bridge ? "harp" : strings ? "spiccato" : "flute",
      bridge ? 0.19 : strings ? 0.2 : 0.25,
    );
    // The horn holds the long notes of the opening an octave down.
    if (strings)
      for (const n of melodies.spire[sourceBar])
        if (n.at === s && n.beats >= 1)
          add("horn", shift(n.note, -1), n.beats * 0.9, 0.1, -0.15);
    if (climax) lead("strings", 0.11, -1, 0.15);
    if (s === 0) {
      add(
        "cello",
        shift(bass, 1),
        bridge ? 2.5 : 0.8,
        bridge ? 0.12 : 0.16,
        -0.2,
      );
      if (full || bridge) pad(bridge ? 0.02 : 0.018);
    }
    if (!bridge || phase >= 3) {
      if (s === 8) add("cello", chord[2], 0.7, 0.13, -0.2);
      // A climbing ostinato in eighths: up the chord and over the top.
      if (s % 2 === 0) {
        const step = s / 2,
          note =
            step === 7
              ? shift(chord[0], 1)
              : chord[[0, 1, 2, 3, 1, 2, 3][step]];
        add("spiccato", note, 0.35, full ? 0.085 : 0.07, 0.25);
      }
    }
    if (!bridge || phase >= 2) {
      if (s === 0 || s === 8) add("concert-bass", undefined, 0.9, 0.15);
      if (s === 12) add("concert-snare", undefined, 0.35, 0.07, 0.12);
    }
    if (phase >= 2 && s === 4) add("concert-snare", undefined, 0.3, 0.05, -0.1);
    // Timpani at the end of every phrase, as one landing leads to the next.
    if (bar % 8 === 7 && (s === 8 || s === 12 || s === 14))
      add("timpani", undefined, 0.6, s === 8 ? 0.09 : 0.07, 0.2);
    if (phase >= 3 && (s === 6 || s === 14))
      add("timpani", undefined, 0.45, 0.06, -0.2);
    if (full) answer("horn", 0.09);
    if (s === 0 && bar % 8 === 0 && full)
      add("concert-cymbal", undefined, 1.8, 0.028, 0.3);
  } else {
    // A compact brass call becomes a bright flute chorus, never a minor-key march.
    lead(
      bridge ? "harp" : full ? "flute" : "horn",
      bridge ? 0.18 : full ? 0.25 : 0.21,
    );
    if (s === 0) {
      add(
        "cello",
        shift(bass, 1),
        bridge ? 2.5 : 0.8,
        bridge ? 0.12 : 0.17,
        -0.2,
      );
      if (full) pad(0.022);
    }
    if (!bridge || phase >= 3) {
      if (s === 8) add("cello", chord[2], 0.75, 0.14, -0.2);
      if (s === 2 || s === 10) chordHit("piano", 0.075, 0.4);
      if ([0, 4, 8, 12].includes(s))
        add("spiccato", chord[(s / 4) % 3], 0.4, full ? 0.12 : 0.09, 0.25);
    }
    if (!bridge || phase >= 2) {
      if (s === 0 || s === 8) add("concert-bass", undefined, 0.9, 0.16);
      if (s === 12) add("concert-snare", undefined, 0.4, 0.08, 0.12);
    }
    if (phase >= 2) {
      if (s === 4) add("concert-snare", undefined, 0.3, 0.055, -0.1);
      if (s === 6) add("timpani", undefined, 0.65, 0.09, 0.2);
      if (!bridge && s === 14)
        add("piano", shift(chord[2], 1), 0.4, 0.09, -0.2);
    }
    if (phase >= 3) {
      if (s === 3 || s === 11)
        add("timpani", undefined, 0.45, 0.07, s === 3 ? -0.2 : 0.2);
      if (s === 6 || s === 14)
        add("spiccato", shift(chord[(s >> 2) % 3], 1), 0.3, 0.075, -0.25);
    }
    if (full) answer("horn", 0.085);
    if (s === 0 && bar % 8 === 0 && full)
      add("concert-cymbal", undefined, 1.8, 0.03, 0.3);
  }
  return notes;
}

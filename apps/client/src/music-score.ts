import { adventureStep } from "./adventure-score";
import type { SampleInstrument } from "./music-samples";
export type BackgroundTheme = "lobby" | "pvp" | "raid";
export type ResultTheme = "victory" | "defeat" | "draw";
export type MusicTheme = BackgroundTheme | ResultTheme;
export function isResultTheme(theme: MusicTheme): theme is ResultTheme {
  return theme === "victory" || theme === "defeat" || theme === "draw";
}
/** Result themes resolve once, then leave the results panel quiet. */
export const RESULT_MUSIC_STEPS: Record<ResultTheme, number> = {
  victory: 64,
  defeat: 48,
  draw: 32,
};
export type Instrument =
  | SampleInstrument
  | "pad"
  | "bell"
  | "pluck"
  | "lead"
  | "arp"
  | "stab"
  | "bass"
  | "kick"
  | "snare"
  | "hat"
  | "openhat"
  | "tom"
  | "crash";
export interface ScoreNote {
  instrument: Instrument;
  note?: string;
  duration: number;
  volume: number;
  pan?: number;
}
export const MUSIC_BPM: Record<MusicTheme, number> = {
  lobby: 88,
  pvp: 152,
  raid: 116,
  victory: 124,
  defeat: 82,
  draw: 96,
};
/** A full arrangement, with a breakdown and return, rather than an eight-bar loop. */
export const MUSIC_LOOP_STEPS = 32 * 16;
const phrase = (notes: string) =>
  notes.split(" ").map((n) => (n === "-" ? "" : n));
const resultChords = {
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
const resultMelody = {
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
function resultStep(theme: ResultTheme, step: number): ScoreNote[] {
  if (step < 0 || step >= RESULT_MUSIC_STEPS[theme]) return [];
  const s = step % 16,
    bar = Math.floor(step / 16),
    beat = 60 / MUSIC_BPM[theme];
  const notes: ScoreNote[] = [],
    chord = resultChords[theme][bar];
  if (s === 0) {
    chord.forEach((note, i) =>
      notes.push({
        instrument: "pad",
        note,
        duration: beat * 3.8,
        volume: theme === "victory" ? 0.06 : 0.05,
        pan: (i - 1) * 0.25,
      }),
    );
    notes.push({
      instrument: "bass",
      note:
        theme === "victory"
          ? ["D2", "G2", "A2", "D2"][bar]
          : theme === "defeat"
            ? ["B2", "E2", "B2"][bar]
            : ["D3", "G2"][bar],
      duration: beat * 2.8,
      volume: 0.17,
    });
  }
  const melody = resultMelody[theme][bar][s];
  if (melody)
    notes.push({
      instrument: theme === "victory" ? "lead" : "bell",
      note: melody,
      duration: beat * (bar === resultChords[theme].length - 1 ? 2 : 0.95),
      volume: theme === "victory" ? 0.16 : 0.12,
      pan: -0.12,
    });
  if (theme === "victory") {
    if (s === 0 && bar < 3)
      notes.push({ instrument: "kick", duration: 0.24, volume: 0.3 });
    if (bar === 0 && s === 0)
      notes.push({
        instrument: "crash",
        duration: 0.8,
        volume: 0.055,
        pan: 0.35,
      });
    if (bar < 3 && (s === 6 || s === 14))
      notes.push({ instrument: "snare", duration: 0.13, volume: 0.1 });
    if (s === 2 || s === 10)
      notes.push({
        instrument: "bell",
        note: chord[chord.length - 1],
        duration: beat * 1.3,
        volume: 0.08,
        pan: 0.4,
      });
  }
  return notes;
}

/** Original JRPG adventure, battle and boss arrangements. */
export function scoreStep(
  theme: MusicTheme,
  step: number,
  phase = 1,
): ScoreNote[] {
  if (isResultTheme(theme)) return resultStep(theme, step);
  return adventureStep(theme, step, phase, MUSIC_BPM[theme]);
}

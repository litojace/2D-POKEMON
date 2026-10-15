export type MusicTheme = "lobby" | "pvp" | "raid";
export type Instrument =
  "pad" | "bell" | "pluck" | "bass" | "kick" | "snare" | "hat" | "tom";
export interface ScoreNote {
  instrument: Instrument;
  note?: string;
  duration: number;
  volume: number;
}
export const MUSIC_BPM: Record<MusicTheme, number> = {
  lobby: 84,
  pvp: 128,
  raid: 96,
};
const chords = [
  ["D4", "F4", "A4", "E5"],
  ["A#3", "D4", "F4", "A4"],
  ["F4", "A4", "C5", "G5"],
  ["C4", "E4", "G4", "D5"],
];
const roots = ["D", "A#", "F", "C"];
// Original eight-bar phrases; empty positions leave space for combat sounds.
const lobby = [
  ["A4", "", "", "", "D5", "", "", "", "F5", "", "E5", "", "A4", "", "", ""],
  ["F5", "", "", "", "D5", "", "", "", "A4", "", "C5", "", "D5", "", "", ""],
  ["C5", "", "", "", "A4", "", "", "", "G5", "", "F5", "", "E5", "", "", ""],
  ["G4", "", "", "", "D5", "", "E5", "", "G5", "", "", "", "E5", "", "D5", ""],
];
const battle = [
  [
    "D5",
    "",
    "A4",
    "C5",
    "D5",
    "",
    "F5",
    "",
    "E5",
    "D5",
    "",
    "A4",
    "C5",
    "",
    "E5",
    "",
  ],
  [
    "F5",
    "",
    "D5",
    "",
    "A4",
    "C5",
    "D5",
    "",
    "F5",
    "",
    "A5",
    "G5",
    "F5",
    "",
    "D5",
    "",
  ],
  [
    "A4",
    "C5",
    "F5",
    "",
    "A5",
    "",
    "G5",
    "F5",
    "E5",
    "",
    "C5",
    "",
    "F5",
    "G5",
    "A5",
    "",
  ],
  [
    "G5",
    "",
    "E5",
    "D5",
    "C5",
    "",
    "G4",
    "",
    "D5",
    "E5",
    "G5",
    "",
    "E5",
    "",
    "D5",
    "",
  ],
];
export function scoreStep(
  theme: MusicTheme,
  step: number,
  phase = 1,
): ScoreNote[] {
  const beat = 60 / MUSIC_BPM[theme],
    s = step % 16,
    bar = Math.floor(step / 16) % 8,
    harmony = Math.floor(bar / 2) % 4;
  const notes: ScoreNote[] = [];
  const add = (
    instrument: Instrument,
    note: string | undefined,
    duration: number,
    volume: number,
  ) => notes.push({ instrument, note, duration, volume });
  if (theme === "lobby") {
    if (s === 0)
      for (const note of chords[harmony]) add("pad", note, beat * 5, 0.035);
    const melody = lobby[harmony][s];
    if (melody) add("bell", melody, beat * 1.8, 0.085);
    if (s === 0 || s === 8) add("bass", roots[harmony] + "2", beat * 1.8, 0.11);
    if (s === 8) add("tom", undefined, 0.24, 0.045);
    if (s === 6 || s === 14) add("hat", undefined, 0.035, 0.018);
  } else if (theme === "pvp") {
    const melody = battle[harmony][s];
    if (melody) add("pluck", melody, beat * 0.48, 0.11);
    if (s === 0)
      for (const note of chords[harmony].slice(0, 3))
        add("pad", note, beat * 3.5, 0.03);
    if (s % 2 === 0)
      add(
        "bass",
        roots[harmony] + (s % 4 === 0 ? "2" : "3"),
        beat * 0.36,
        0.16,
      );
    if (s === 0 || s === 8 || s === 11) add("kick", undefined, 0.18, 0.3);
    if (s === 4 || s === 12) add("snare", undefined, 0.12, 0.12);
    if (s % 2 === 0) add("hat", undefined, 0.035, 0.035);
  } else {
    const root = ["D", "C", "A#", "A"][harmony];
    if (s === 0)
      for (const note of [root + "2", "A2", "D3", "F3"])
        add("pad", note, beat * 4.8, 0.045);
    if (s % 4 === 0) add("bass", root + "2", beat * 0.75, 0.16);
    if (s === 0 || s === 8) add("tom", undefined, 0.36, 0.28);
    if (s === 4 || s === 12) add("tom", undefined, 0.2, 0.12);
    if (bar % 2 === 1 && (s === 6 || s === 14))
      add("bell", s === 6 ? "A4" : "D5", beat * 1.5, 0.055);
    if (phase >= 2 && (s === 2 || s === 10)) add("kick", undefined, 0.2, 0.2);
    if (phase >= 3) {
      if (s % 4 === 2) add("tom", undefined, 0.19, 0.2);
      if (s % 2 === 1) add("hat", undefined, 0.04, 0.04);
      if (s === 6 || s === 14)
        add("pluck", s === 6 ? "D4" : "F4", beat * 0.6, 0.1);
    }
  }
  return notes;
}

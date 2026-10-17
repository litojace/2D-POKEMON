export type MusicTheme = "lobby" | "pvp" | "raid";
export type Instrument =
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
  lobby: 104,
  pvp: 140,
  raid: 112,
};
/** A full arrangement, with a breakdown and return, rather than an eight-bar loop. */
export const MUSIC_LOOP_STEPS = 32 * 16;
const phrase = (notes: string) =>
  notes.split(" ").map((n) => (n === "-" ? "" : n));
const lobbyHook = [
  phrase("E5 - - B4 C5 - - E5 - - G5 - E5 - D5 -"),
  phrase("C5 - - A4 - - C5 - E5 - - D5 C5 - - -"),
  phrase("G4 - - C5 E5 - - G5 - - E5 - D5 - C5 -"),
  phrase("B4 - D5 - - - E5 - D5 - B4 - A4 - - -"),
];
const lobbyAnswer = [
  phrase("A4 - C5 - E5 - - - G5 - E5 - B5 - A5 -"),
  phrase("A5 - G5 - E5 - C5 - - - A4 - C5 - E5 -"),
  phrase("E5 - G5 - - - B5 - G5 - E5 - D5 - C5 -"),
  phrase("D5 - B4 - G4 - - - A4 - B4 - D5 - E5 -"),
];
const duelHook = [
  phrase("E5 - B4 E5 - G5 - F#5 E5 - D5 - B4 - D5 -"),
  phrase("E5 - G5 - B5 - A5 G5 E5 - D5 E5 - - G5 -"),
  phrase("D5 - G5 - A5 - B5 - D6 - B5 A5 G5 - - -"),
  phrase("F#5 - A5 - F#5 E5 D5 - A4 - D5 - F#5 - E5 -"),
];
const duelAnswer = [
  phrase("B5 - G5 E5 - - B4 - E5 F#5 G5 - B5 - D6 -"),
  phrase("C6 - B5 G5 E5 - - G5 - E5 D5 - C5 - E5 -"),
  phrase("B5 - D6 - B5 - A5 G5 - D5 - G5 A5 - B5 -"),
  phrase("A5 - F#5 D5 - - E5 - F#5 - E5 D5 B4 - E5 -"),
];
const raidHook = [
  phrase("D4 - - A4 - - D5 - C5 - A4 - F4 - - -"),
  phrase("A#4 - - F4 - - A#4 - D5 - C5 - A4 - - -"),
  phrase("F4 - - C5 - - F5 - E5 - C5 - A4 - - -"),
  phrase("E5 - - C#5 - - A4 - G4 - E4 - C#5 - D5 -"),
];
const harmony = {
  lobby: [
    ["A3", "C4", "E4", "B4"],
    ["F3", "A3", "C4", "E4"],
    ["C4", "E4", "G4", "B4"],
    ["G3", "B3", "D4", "A4"],
  ],
  pvp: [
    ["E3", "G3", "B3", "D4"],
    ["C3", "E3", "G3", "B3"],
    ["G3", "B3", "D4", "A4"],
    ["D3", "F#3", "A3", "E4"],
  ],
  raid: [
    ["D3", "F3", "A3", "E4"],
    ["A#2", "D3", "F3", "A3"],
    ["F3", "A3", "C4", "E4"],
    ["A2", "C#3", "E3", "G3"],
  ],
};
const bassRoots = {
  lobby: ["A", "F", "C", "G"],
  pvp: ["E", "C", "G", "D"],
  raid: ["D", "A#", "F", "A"],
};

/** Original synthwave, electro and cinematic scores; no external samples. */
export function scoreStep(
  theme: MusicTheme,
  step: number,
  phase = 1,
): ScoreNote[] {
  const position =
    ((step % MUSIC_LOOP_STEPS) + MUSIC_LOOP_STEPS) % MUSIC_LOOP_STEPS;
  const s = position % 16,
    bar = Math.floor(position / 16),
    section = Math.floor(bar / 8);
  const h = Math.floor(bar / 2) % 4,
    beat = 60 / MUSIC_BPM[theme];
  const chord = harmony[theme][h],
    root = bassRoots[theme][h];
  const breakdown = bar >= 16 && bar < 20;
  const fill = bar % 8 === 7;
  const notes: ScoreNote[] = [];
  const add = (
    instrument: Instrument,
    note: string | undefined,
    duration: number,
    volume: number,
    pan = 0,
  ) => {
    notes.push({ instrument, note, duration, volume, pan });
  };
  const drum = (
    instrument: Instrument,
    volume: number,
    duration = 0.15,
    pan = 0,
  ) => add(instrument, undefined, duration, volume, pan);
  const pad = (volume: number) =>
    chord.forEach((note, i) =>
      add("pad", note, beat * 7.5, volume, (i - 1.5) * 0.22),
    );
  if (theme === "lobby") {
    if (s === 0 && bar % 2 === 0) pad(0.043);
    const melody = (section % 2 ? lobbyAnswer : lobbyHook)[h][s];
    if (melody && (!breakdown || s % 4 === 0))
      add("pluck", melody, beat * 0.95, 0.14, -0.14);
    if (s === 0 || s === 6 || s === 10 || s === 14)
      add(
        "bass",
        root + (s === 14 && bar % 2 ? "3" : "2"),
        beat * (s === 0 ? 0.95 : 0.55),
        0.21,
      );
    if (section > 0 && !breakdown && s % 2 === 1)
      add(
        "arp",
        chord[[0, 2, 1, 3][Math.floor(s / 2) % 4]],
        beat * 0.35,
        0.045,
        s % 4 === 1 ? -0.45 : 0.45,
      );
    if (!breakdown) {
      if (s === 0 || s === 6 || s === 10) drum("kick", 0.34);
      if (s === 4 || s === 12) drum("snare", 0.13);
      if (s % 2 === 0) drum("hat", s % 4 === 2 ? 0.045 : 0.025, 0.045, 0.3);
      if (s === 14 && bar % 2) drum("openhat", 0.035, 0.18, 0.35);
      if (fill && (s === 13 || s === 15)) drum("snare", 0.055, 0.08, -0.2);
    } else if (s === 0) drum("kick", 0.2);
    if (bar === 24 && s === 0) drum("crash", 0.055, 0.8, -0.35);
  } else if (theme === "pvp") {
    if (s === 0 && bar % 2 === 0) pad(breakdown ? 0.043 : 0.024);
    const melody = (section % 2 ? duelAnswer : duelHook)[h][s];
    if (melody && (bar >= 4 || s % 4 === 0))
      add(
        breakdown ? "bell" : "lead",
        melody,
        beat * (s % 4 === 0 ? 0.65 : 0.37),
        breakdown ? 0.08 : 0.12,
        -0.1,
      );
    if (!breakdown) {
      if ([0, 3, 6, 8, 10, 14].includes(s))
        add(
          "bass",
          root + (s === 6 || s === 14 ? "3" : "2"),
          beat * 0.38,
          0.24,
        );
      if ([2, 6, 10, 14].includes(s) && bar >= 4)
        chord
          .slice(0, 3)
          .forEach((note, i) =>
            add("stab", note, beat * 0.27, 0.05, (i - 1) * 0.25),
          );
      if (s % 4 === 0) drum("kick", 0.4);
      if (s === 4 || s === 12) drum("snare", 0.18);
      if (s % 2 === 0) drum("hat", s % 4 === 2 ? 0.055 : 0.028, 0.035, 0.3);
      if (s === 6 || s === 14) drum("openhat", 0.045, 0.14, 0.4);
      if (section >= 1 && s % 2 === 1)
        add(
          "arp",
          chord[[2, 1, 3, 0][Math.floor(s / 2) % 4]],
          beat * 0.25,
          0.04,
          s % 4 === 1 ? -0.55 : 0.55,
        );
      if (fill && s >= 12 && s % 2 === 1)
        drum("snare", 0.08 + (s - 12) * 0.015, 0.09, -0.15);
    } else {
      if (s === 0) add("bass", root + "2", beat * 3.3, 0.16);
      if (s === 8) drum("tom", 0.13, 0.3);
    }
    if (s === 0 && (bar === 8 || bar === 24)) drum("crash", 0.075, 1, -0.4);
  } else {
    if (s === 0 && bar % 2 === 0) pad(0.038);
    const melody = raidHook[h][s];
    if (melody && (bar >= 4 || s === 0 || s === 8))
      add(
        breakdown ? "bell" : "lead",
        melody,
        beat * (s % 8 === 0 ? 1.6 : 0.65),
        breakdown ? 0.08 : 0.12,
        -0.12,
      );
    if (s % 4 === 0 || (phase >= 2 && (s === 6 || s === 14)))
      add("bass", root + "2", beat * 0.6, 0.24);
    if (s === 0 || s === 8) drum("tom", 0.26, 0.42, s === 0 ? -0.2 : 0.2);
    if (s === 6 || s === 14) drum("tom", 0.14, 0.22, s === 6 ? 0.35 : -0.35);
    if (!breakdown || phase >= 3) {
      if (s === 0 || s === 10) drum("kick", 0.38);
      if (s === 4 || s === 12) drum("snare", 0.16);
    }
    if (phase >= 2) {
      if (s === 7 || s === 14) drum("kick", 0.25);
      if (s % 2 === 0) drum("hat", 0.03, 0.045, 0.35);
      if (s % 4 === 2)
        add(
          "arp",
          chord[(Math.floor(s / 4) + bar) % 4],
          beat * 0.4,
          0.08,
          s % 8 === 2 ? -0.45 : 0.45,
        );
    }
    if (phase >= 3) {
      if (s % 2 === 1) drum("hat", 0.045, 0.035, -0.3);
      if (s === 3 || s === 11) drum("tom", 0.2, 0.18, 0.3);
      if (s === 2 || s === 10)
        chord
          .slice(0, 3)
          .forEach((note, i) =>
            add("stab", note, beat * 0.4, 0.06, (i - 1) * 0.3),
          );
      if (s === 15 && fill) drum("snare", 0.17, 0.16);
    }
    if (s === 0 && bar % 8 === 0) drum("crash", 0.065, 1, -0.4);
  }
  return notes;
}

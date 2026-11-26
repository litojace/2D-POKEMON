import {
  ADVENTURE_LOOP_STEPS,
  melodies,
  progressions,
  sections,
  shift,
  voicings,
} from "./adventure-score";
import type {
  BackgroundTheme,
  ChipInstrument,
  ResultTheme,
  ScoreNote,
} from "./music-score";

/**
 * The retro soundtrack: each scene's own tune, arranged for a console sound
 * chip (chip-synth.ts). The scene sets the role: a cheerful town for the
 * Lobby, a quiet stroll for the Plaza, a fight for PvP, a boss that gets
 * fiercer as it weakens for raids, a climb for the Spire.
 */
const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midi = (note: string) => {
  const m = /^([A-G]#?)(\d)$/.exec(note)!;
  return NAMES.indexOf(m[1]) + 12 * (Number(m[2]) + 1);
};
const named = (n: number) => NAMES[n % 12] + String(Math.floor(n / 12) - 1);
/** The nearest chord tone a third or more below the melody: a harmony line. */
export function below(note: string, chord: string[]) {
  const top = midi(note) - 3;
  let best = -1;
  for (const c of chord) {
    const pc = midi(c) % 12;
    const n = top - ((((top - pc) % 12) + 12) % 12);
    if (n > best) best = n;
  }
  return named(best);
}

interface LeadOptions {
  octave?: number;
  pan?: number;
  echo?: boolean;
  vibrato?: boolean;
  /** A second voice a third to a sixth under the tune. */
  harmony?: { instrument: ChipInstrument; volume: number };
}

/**
 * Each theme's level against the recorded soundtrack it replaces, measured
 * offline (full range and a phone speaker's 300 Hz-9 kHz): pulse waves are
 * dense, so the chip themes play quieter to sit where the old ones did.
 */
export const RETRO_GAIN: Record<BackgroundTheme | ResultTheme, number> = {
  lobby: 0.7,
  plaza: 0.6,
  pvp: 0.67,
  raid: 0.68,
  spire: 0.52,
  victory: 0.51,
  defeat: 0.95,
  draw: 0.75,
};
/** The triangle bass, a little under the tune: phones can't play it anyway. */
const BASS = 0.75;

export function retroStep(
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
    full = section === 1 || climax || section === 4 || section === 5;
  const beat = 60 / bpm,
    gain = RETRO_GAIN[theme],
    { chord, bass } = voicings[progressions[theme][sourceBar]];
  const out: ScoreNote[] = [];
  const add = (
    instrument: ChipInstrument,
    note: string | undefined,
    beats: number,
    volume: number,
    pan = 0,
    extra: Partial<ScoreNote> = {},
  ) =>
    out.push({
      instrument,
      note,
      duration: beats * beat,
      volume: volume * gain,
      pan,
      ...extra,
    });
  const lead = (
    instrument: ChipInstrument,
    volume: number,
    o: LeadOptions = {},
  ) => {
    for (const n of melodies[theme][sourceBar])
      if (n.at === s) {
        const note = shift(n.note, o.octave ?? 0);
        add(instrument, note, n.beats * 0.92, volume, o.pan ?? -0.1, {
          echo: o.echo,
          vibrato: o.vibrato && n.beats >= 0.75,
        });
        if (o.harmony)
          add(
            o.harmony.instrument,
            below(note, chord),
            n.beats * 0.9,
            o.harmony.volume,
            0.25,
          );
      }
  };
  /** The chord as a rapid arpeggio, an octave up from its voicing. */
  const arp = (beats: number, volume: number, pan = 0.2, octave = 1) =>
    add("chip-arp", chord[0], beats, volume, pan, {
      notes: chord.slice(0, 3).map((n) => shift(n, octave)),
    });
  const root = shift(bass, 1),
    top = shift(bass, 2),
    fifth = chord[2];
  const kick = (v = 0.22) => add("chip-kick", undefined, 0.2, v);
  const snare = (v = 0.08) => add("chip-snare", undefined, 0.2, v, 0.08);
  const hat = (v = 0.025) => add("chip-hat", undefined, 0.05, v, 0.3);
  const crash = () => add("chip-crash", undefined, 1.8, 0.03, -0.3);

  if (theme === "lobby") {
    // A cheerful town: square and pulse take turns, bouncing octave bass.
    lead(
      bridge
        ? "chip-pulse12"
        : section === 1 || section === 4
          ? "chip-square"
          : "chip-pulse25",
      bridge ? 0.09 : 0.105,
      {
        echo: true,
        vibrato: true,
        harmony: climax
          ? { instrument: "chip-pulse12", volume: 0.045 }
          : undefined,
      },
    );
    if (!bridge) {
      if (s % 2 === 0)
        add("chip-tri", s % 4 === 0 ? root : top, 0.45, 0.17 * BASS);
      if (s === 4 || s === 12) arp(0.9, 0.04);
    } else {
      if (s === 0 || s === 8) add("chip-tri", root, 1.8, 0.16 * BASS);
      if (s === 0) arp(3.8, 0.03);
    }
    if (full) {
      if (s === 0 || s === 8) kick(0.2);
      if (s === 4 || s === 12) snare(0.065);
      if (s % 2 === 0) hat(s % 4 === 2 ? 0.028 : 0.018);
    } else if (!bridge && s % 4 === 2) hat(0.02);
    if (climax && s === 0 && bar % 8 === 0) crash();
  } else if (theme === "plaza") {
    // A stroll: a soft pulse with vibrato, plucked chord ripples, no drums.
    const flute = section === 0 || section === 3 || section === 5;
    lead(
      bridge ? "chip-tri" : flute ? "chip-pulse12" : "chip-pulse25",
      bridge ? 0.2 : 0.1,
      {
        echo: true,
        vibrato: true,
        harmony: climax
          ? { instrument: "chip-pulse25", volume: 0.04 }
          : undefined,
      },
    );
    if (!bridge && s % 2 === 0)
      add(
        "chip-pulse12",
        s === 8 ? shift(chord[1], 1) : chord[[0, 1, 2, 3, 1, 2, 3, 2][s / 2]],
        0.4,
        s === 0 ? 0.04 : 0.03,
        0.3,
      );
    if (bridge && s === 0) arp(3.8, 0.028);
    if (s === 0) add("chip-tri", root, bridge ? 3.6 : 1.6, 0.15 * BASS);
    if (!bridge && s === 8) add("chip-tri", shift(fifth, -1), 1.2, 0.13 * BASS);
  } else if (theme === "pvp") {
    // A fight: a bold square lead, driving pulse bass, a full kit.
    lead(
      climax ? "chip-pulse25" : bridge ? "chip-pulse12" : "chip-square",
      bridge ? 0.09 : 0.1,
      {
        echo: true,
        vibrato: true,
        harmony:
          climax || section === 4
            ? { instrument: "chip-pulse12", volume: 0.045 }
            : undefined,
      },
    );
    if (s % 2 === 0)
      add(
        bridge ? "chip-tri" : "chip-bass",
        [root, root, top, root, fifth, root, top, fifth][s / 2],
        0.42,
        bridge ? 0.15 : 0.11,
      );
    if (full && s % 4 === 0) arp(1, 0.032);
    if (!bridge) {
      if (s === 0 || s === 6 || s === 8) kick();
      if (s === 4 || s === 12) snare();
      if (climax ? true : s % 2 === 0) hat(s % 4 === 2 ? 0.03 : 0.02);
      if (bar % 8 === 7 && s >= 12) snare(0.05 + (s - 12) * 0.01);
    } else if (s % 4 === 2) hat(0.02);
    if (full && s === 0 && bar % 8 === 0) crash();
  } else if (theme === "spire") {
    // A climb: a thin pulse line over a rising ostinato, a triangle bridge.
    const strings = section === 0 || section === 5;
    lead(
      bridge ? "chip-tri" : strings ? "chip-pulse12" : "chip-pulse25",
      bridge ? 0.2 : 0.1,
      {
        echo: true,
        vibrato: !strings,
        harmony: climax
          ? { instrument: "chip-square", volume: 0.04 }
          : undefined,
      },
    );
    // The long notes of the opening, doubled low on the triangle.
    if (strings)
      for (const n of melodies.spire[sourceBar])
        if (n.at === s && n.beats >= 1)
          add("chip-tri", shift(n.note, -1), n.beats * 0.9, 0.12);
    if ((!bridge || phase >= 3) && s % 2 === 0)
      add(
        "chip-pulse12",
        s === 14 ? shift(chord[0], 1) : chord[[0, 1, 2, 3, 1, 2, 3][s / 2]],
        0.3,
        full ? 0.032 : 0.026,
        0.3,
      );
    if (s === 0) add("chip-tri", root, bridge ? 3.6 : 0.9, 0.16 * BASS);
    if (!bridge && s === 8) add("chip-tri", shift(fifth, -1), 0.7, 0.13 * BASS);
    if (!bridge || phase >= 2) {
      if (s === 0 || s === 8) kick(0.18);
      if (s === 12) snare(0.06);
      if (s % 4 === 2) hat(0.022);
    }
    if (phase >= 2 && s === 4) snare(0.04);
    if (phase >= 3) {
      if (s % 2 === 0 && s % 4 !== 2) hat(0.016);
      if (s === 10) kick(0.15);
    }
    if (bar % 8 === 7 && (s === 12 || s === 14)) snare(0.05);
    if (full && s === 0 && bar % 8 === 0) crash();
  } else {
    // A boss: fiercer with every phase of the fight.
    lead(
      full ? "chip-square" : bridge ? "chip-pulse12" : "chip-pulse25",
      bridge ? 0.09 : 0.1,
      {
        echo: true,
        vibrato: true,
        harmony:
          climax || phase >= 3
            ? { instrument: "chip-pulse12", volume: 0.045 }
            : undefined,
      },
    );
    if (!bridge || phase >= 3) {
      if (s % 2 === 0)
        add(
          "chip-bass",
          [root, root, fifth, root, top, root, fifth, root][s / 2],
          0.42,
          0.115,
        );
      if (phase >= 2 && (s === 13 || s === 15))
        add("chip-bass", top, 0.2, 0.08);
    } else if (s === 0 || s === 8) add("chip-tri", root, 1.8, 0.16 * BASS);
    if (bridge && phase < 3 && s === 0) arp(3.8, 0.03);
    if (!bridge || phase >= 2) {
      if (s === 0 || s === 8) kick();
      if (s % 2 === 0) hat(0.022);
    }
    if (phase >= 2) {
      if (s === 4 || s === 12) snare();
      // An alarm of arpeggios on the off-beats.
      if (s === 2 || s === 10) arp(0.5, 0.035);
    }
    if (phase >= 3) {
      if (s % 2 === 1) hat(0.016);
      if (s === 10) kick(0.18);
      if (bar % 8 === 7 && s >= 12) snare(0.05 + (s - 12) * 0.01);
    }
    if (full && s === 14 && bar % 2 === 1)
      add("chip-pulse12", shift(chord[2], 1), 0.4, 0.05, 0.3);
    if ((full || phase >= 3) && s === 0 && bar % 4 === 0) crash();
  }
  return out;
}

// Victory, defeat and draw: four, three and two bars.
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
/** Victory, defeat and draw as chip jingles. */
export function retroResultStep(
  theme: ResultTheme,
  step: number,
  bpm: number,
): ScoreNote[] {
  if (step < 0 || step >= resultChords[theme].length * 16) return [];
  const s = step % 16,
    bar = Math.floor(step / 16),
    beat = 60 / bpm;
  const chord = resultChords[theme][bar],
    last = bar === resultChords[theme].length - 1,
    gain = RETRO_GAIN[theme];
  const out: ScoreNote[] = [];
  const add = (
    instrument: ChipInstrument,
    note: string | undefined,
    beats: number,
    volume: number,
    pan = 0,
    extra: Partial<ScoreNote> = {},
  ) =>
    out.push({
      instrument,
      note,
      duration: beats * beat,
      volume: volume * gain,
      pan,
      ...extra,
    });
  if (s === 0) {
    add("chip-arp", chord[0], 3.8, theme === "victory" ? 0.04 : 0.032, 0.2, {
      notes: chord.slice(0, 3),
    });
    add(
      "chip-tri",
      theme === "victory"
        ? ["D3", "G3", "A3", "D3"][bar]
        : theme === "defeat"
          ? ["B2", "E3", "B2"][bar]
          : ["D3", "G2"][bar],
      2.8,
      // Defeat and draw are quiet endings: the tune leads, the bass stays low.
      theme === "victory" ? 0.17 * BASS : 0.1,
    );
  }
  const melody = resultMelody[theme][bar][s];
  if (melody)
    add(
      theme === "victory"
        ? "chip-square"
        : theme === "defeat"
          ? "chip-pulse12"
          : "chip-pulse25",
      melody,
      last ? 2 : 0.95,
      theme === "victory" ? 0.11 : 0.13,
      -0.1,
      { echo: true, vibrato: theme !== "victory" || last },
    );
  if (theme === "victory") {
    if (s === 0 && bar < 3) add("chip-kick", undefined, 0.2, 0.24);
    if (bar === 0 && s === 0) add("chip-crash", undefined, 1, 0.035, 0.3);
    if (bar < 3 && (s === 6 || s === 14))
      add("chip-snare", undefined, 0.2, 0.08);
    if (s === 2 || s === 10)
      add("chip-pulse12", shift(chord[chord.length - 1], 1), 0.6, 0.045, 0.35);
  }
  return out;
}

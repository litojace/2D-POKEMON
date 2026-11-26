import {
  ADVENTURE_LOOP_STEPS,
  melodies,
  progressions,
  sections,
  shift,
  voicings,
  type MelodyNote,
} from "./adventure-score";
import type { ProInstrument, ScoreNote } from "./music-score";

/**
 * The hub's and PvP's tunes arranged as a shipped game's soundtrack would be
 * (played by pro-synth.ts):
 * a lead with glides, a counter-line answering in the tune's rests, a pad,
 * plucked arpeggios through the delay, a syncopated bass that ducks under
 * the kick, grooves that change by section, fills into each new section and
 * a riser before the chorus.
 */
export type ProTheme = "lobby" | "pvp";
/** Each theme's level against the others, measured offline (docs/music.md). */
export const PRO_GAIN: Record<ProTheme, number> = { lobby: 0.32, pvp: 0.27 };

const NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const midi = (n: string) => {
  const m = /^([A-G]#?)(\d)$/.exec(n)!;
  return NAMES.indexOf(m[1]) + 12 * (Number(m[2]) + 1);
};
const named = (n: number) => NAMES[n % 12] + String(Math.floor(n / 12) - 1);
/** The nearest chord tone a third or more under the tune. */
function below(note: string, chord: string[]) {
  const top = midi(note) - 3;
  let best = -1;
  for (const c of chord) {
    const pc = midi(c) % 12;
    const n = top - ((((top - pc) % 12) + 12) % 12);
    if (n > best) best = n;
  }
  return named(best);
}

export function proStep(
  theme: ProTheme,
  step: number,
  bpm: number,
): ScoreNote[] {
  const beat = 60 / bpm,
    gain = PRO_GAIN[theme];
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
  const intro = section === 0 && bar < 2;
  const lastOfSection = bar % 8 === 7;
  const { chord, bass } = voicings[progressions[theme][sourceBar]];
  const tune: MelodyNote[] = melodies[theme][sourceBar];
  const out: ScoreNote[] = [];
  const add = (
    instrument: ProInstrument,
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
  /** The tune, with a glide into long notes that follow a note directly. */
  const lead = (
    instrument: ProInstrument,
    volume: number,
    octave = 0,
    pan = -0.05,
    harmony?: { instrument: ProInstrument; volume: number },
  ) => {
    tune.forEach((n, i) => {
      if (n.at !== s) return;
      const prev = tune[i - 1];
      const legato =
        prev &&
        prev.at + prev.beats * 4 >= n.at &&
        n.beats >= 1 &&
        Math.abs(midi(n.note) - midi(prev.note)) <= 4;
      const note = shift(n.note, octave);
      add(
        instrument,
        note,
        n.beats * 0.94,
        volume * (n.beats >= 0.75 ? 1 : 0.85),
        pan,
        legato ? { from: shift(prev.note, octave) } : {},
      );
      if (harmony)
        add(
          harmony.instrument,
          below(note, chord),
          n.beats * 0.9,
          harmony.volume,
          0.3,
        );
    });
  };
  /** A counter-line in the tune's rests: chord tones stepping down. */
  const counter = (instrument: ProInstrument, volume: number) => {
    const end = Math.max(...tune.map((n) => n.at + Math.ceil(n.beats * 4)));
    if (end > 12 || s < end) return;
    const tones = [shift(chord[3], 1), shift(chord[2], 1), shift(chord[1], 1)];
    const i = (s - end) / 2;
    if (Number.isInteger(i) && i < 3)
      add(instrument, tones[i], 0.45, volume * (1 - i * 0.15), 0.4);
  };
  const root = shift(bass, 1),
    top = shift(bass, 2),
    fifth = chord[2];
  const arpNotes = [
    chord[0],
    chord[1],
    chord[2],
    chord[3],
    shift(chord[1], 1),
    chord[3],
    chord[2],
    chord[1],
  ].map((n) => shift(n, 1));
  const kick = (v = 0.55) => add("pro-kick", undefined, 0.25, v);
  const snare = (v = 0.24, pan = 0.05) =>
    add("pro-snare", undefined, 0.25, v, pan);
  const hat = (v = 0.05, pan = 0.3) =>
    add("pro-hat", undefined, 0.1, v * 1.4, pan);
  const fill = () => {
    // Toms down into the next section.
    const toms: Record<number, string> = {
      8: "A3",
      10: "F3",
      12: "D3",
      14: "A2",
    };
    if (toms[s]) add("pro-tom", toms[s], 0.4, 0.34, s <= 10 ? 0.3 : -0.3);
  };
  if (s === 0 && bar % 8 === 0 && (section === 1 || climax || section === 4))
    add("pro-crash", undefined, 2, 0.07, -0.3);
  // A riser through the bridge's last bar into the chorus.
  if (bridge && lastOfSection && s === 0) add("pro-riser", undefined, 4, 0.08);

  if (theme === "lobby") {
    // The hub: a bright, friendly town theme.
    if (bridge) lead("pro-bell", 0.16, 0, -0.1);
    else
      lead(
        section === 1 || section === 4 ? "pro-lead2" : "pro-lead",
        0.1,
        0,
        -0.05,
        climax ? { instrument: "pro-lead2", volume: 0.045 } : undefined,
      );
    if (climax) lead("pro-bell", 0.06, 1, 0.25);
    if (full && !climax) counter("pro-pluck", 0.08);
    if ((full || bridge) && s === 0)
      chord
        .slice(0, 3)
        .forEach((n, i) =>
          add(
            "pro-pad",
            shift(n, 1),
            3.9,
            bridge ? 0.02 : 0.016,
            -0.4 + i * 0.4,
          ),
        );
    // Plucked arpeggios: eighths, sixteenths in the chorus.
    if (!intro && !bridge && (climax ? true : s % 2 === 0))
      add(
        "pro-pluck",
        arpNotes[(climax ? s : s / 2) % 8],
        climax ? 0.25 : 0.45,
        climax ? 0.035 : 0.045,
        s % 4 < 2 ? -0.35 : 0.35,
      );
    if (bridge && s % 4 === 0)
      add("pro-pluck", arpNotes[s / 4], 0.9, 0.04, s % 8 === 0 ? -0.3 : 0.3);
    // Bass: syncopated in the verses, driving in the chorus, held in the bridge.
    if (!intro) {
      if (bridge) {
        if (s === 0) add("pro-bass", root, 3.8, 0.13);
      } else if (climax) {
        if (s % 2 === 0) add("pro-bass", s % 4 === 0 ? root : top, 0.45, 0.125);
      } else {
        const line: Record<number, [string, number]> = {
          0: [root, 1],
          6: [fifth, 0.5],
          8: [root, 0.75],
          14: [top, 0.4],
        };
        if (line[s]) add("pro-bass", line[s][0], line[s][1], 0.125);
      }
    }
    // Drums.
    if (intro) {
      if (s % 4 === 2) hat(0.04);
    } else if (bridge) {
      if (s === 12) snare(0.1, -0.1);
      if (s % 4 === 0) hat(0.03);
    } else if (climax) {
      if (s % 4 === 0) kick(0.55);
      if (s === 4 || s === 12) snare(0.24);
      if (s === 7 || s === 15) snare(0.06, -0.15);
      hat(s % 4 === 2 ? 0.055 : 0.03);
      if (s === 14) add("pro-ohat", undefined, 0.3, 0.05, 0.3);
    } else {
      if (s === 0 || s === 8 || (bar % 2 === 1 && s === 10)) kick(0.5);
      if (s === 4 || s === 12) snare(0.22);
      if (s % 2 === 0) hat(s % 4 === 2 ? 0.05 : 0.03);
      if ((section === 1 || section === 4) && s % 2 === 1)
        add("pro-shaker", undefined, 0.1, 0.03, -0.3);
    }
    if (lastOfSection && !bridge && !intro) fill();
  } else {
    // PvP: a fight, pushing forward.
    if (bridge) lead("pro-pluck", 0.12, 0, -0.1);
    else
      lead(
        section === 1 || section === 4 ? "pro-lead" : "pro-lead2",
        0.115,
        0,
        -0.05,
        climax || section === 4
          ? { instrument: "pro-lead2", volume: 0.045 }
          : undefined,
      );
    if (climax) lead("pro-bell", 0.05, 1, 0.25);
    if (full) counter("pro-bell", 0.06);
    if ((full || bridge) && s === 0)
      chord
        .slice(0, 3)
        .forEach((n, i) =>
          add(
            "pro-pad",
            shift(n, 1),
            3.9,
            bridge ? 0.02 : 0.014,
            -0.4 + i * 0.4,
          ),
        );
    if (climax && s % 4 === 0)
      add("pro-arp", chord[0], 1, 0.03, 0.2, {
        notes: chord.slice(0, 3).map((n) => shift(n, 1)),
      });
    if (!bridge && !intro && s % 2 === 1)
      add(
        "pro-pluck",
        arpNotes[(s >> 1) % 8],
        0.3,
        0.035,
        s % 4 === 1 ? -0.35 : 0.35,
      );
    // Driving eighths in the bass, ducking under every kick.
    if (bridge) {
      if (s === 0 || s === 8) add("pro-bass", root, 1.8, 0.13);
    } else if (!intro && s % 2 === 0)
      add(
        "pro-bass",
        [root, root, top, root, fifth, root, top, fifth][s / 2],
        0.42,
        0.1,
      );
    else if (intro && s === 0) add("pro-bass", root, 3.5, 0.12);
    // Drums.
    if (intro) {
      if (s % 2 === 0) hat(s % 4 === 2 ? 0.05 : 0.03);
      if (bar === 1 && s >= 12) snare(0.08 + (s - 12) * 0.03);
    } else if (bridge) {
      if (s === 0) kick(0.45);
      if (s % 4 === 2) hat(0.035);
    } else {
      const four = climax || section === 4;
      if (four ? s % 4 === 0 || s === 14 : s === 0 || s === 6 || s === 8)
        kick(0.46);
      if (s === 4 || s === 12) snare(0.25);
      if (climax || section === 1 || section === 4)
        hat(s % 4 === 2 ? 0.05 : 0.025);
      else if (s % 2 === 0) hat(s % 4 === 2 ? 0.05 : 0.03);
      if (climax && (s === 6 || s === 14))
        add("pro-ohat", undefined, 0.3, 0.045, 0.3);
    }
    if (lastOfSection && !bridge && !intro) fill();
  }
  return out;
}

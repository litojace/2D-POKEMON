import { ADVENTURE_LOOP_STEPS } from "./adventure-score";
import { retroResultStep, retroStep } from "./retro-score";
import { proStep } from "./pro-score";

/**
 * The soundtrack is retro: every scene's tune arranged for a console sound
 * chip (retro-score.ts), played by chip voices (chip-synth.ts). No audio
 * files: the music is synthesized as it plays.
 */
/** The Lobby's tune plays across the hub, the Plaza included. */
export type BackgroundTheme = "lobby" | "pvp" | "raid" | "spire";
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
/** The retro soundtrack's voices (chip-synth.ts). */
export type ChipInstrument =
  | "chip-pulse12"
  | "chip-pulse25"
  | "chip-square"
  | "chip-tri"
  | "chip-bass"
  | "chip-arp"
  | "chip-kick"
  | "chip-snare"
  | "chip-hat"
  | "chip-crash";
/** The produced voices of the hub and PvP themes (pro-synth.ts). */
export type ProInstrument =
  | "pro-lead"
  | "pro-lead2"
  | "pro-pad"
  | "pro-pluck"
  | "pro-bass"
  | "pro-bell"
  | "pro-arp"
  | "pro-kick"
  | "pro-snare"
  | "pro-hat"
  | "pro-ohat"
  | "pro-shaker"
  | "pro-tom"
  | "pro-crash"
  | "pro-riser";
export type Instrument = ChipInstrument | ProInstrument;
/**
 * The themes the produced voices play (the owner chose them for the hub and
 * PvP, 26 Nov 2026); the others stay on the chip voices for now.
 */
export const PRO_THEMES: ReadonlySet<MusicTheme> = new Set(["lobby", "pvp"]);
export interface ScoreNote {
  instrument: Instrument;
  note?: string;
  duration: number;
  volume: number;
  pan?: number;
  /** chip-arp: the chord it cycles through, a step per 1/30 s. */
  notes?: string[];
  /** A delayed vibrato on long notes. */
  vibrato?: boolean;
  /** Into the theme's echo. */
  echo?: boolean;
  /** Glide into this note from that one (produced leads). */
  from?: string;
}
/** The fight and the boss run a little quicker than the menus. */
export const MUSIC_BPM: Record<MusicTheme, number> = {
  lobby: 112,
  pvp: 148,
  raid: 132,
  spire: 132,
  victory: 124,
  defeat: 82,
  draw: 96,
};
/** A full arrangement, with a breakdown and return, rather than an eight-bar loop. */
export const MUSIC_LOOP_STEPS = ADVENTURE_LOOP_STEPS;

/** Each scene's notes for one sixteenth-note step of its loop. */
export function scoreStep(
  theme: MusicTheme,
  step: number,
  phase = 1,
): ScoreNote[] {
  if (isResultTheme(theme))
    return retroResultStep(theme, step, MUSIC_BPM[theme]);
  if (theme === "lobby" || theme === "pvp")
    return proStep(theme, step, MUSIC_BPM[theme]);
  return retroStep(theme, step, phase, MUSIC_BPM[theme]);
}

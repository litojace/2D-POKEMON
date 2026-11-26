import { ADVENTURE_LOOP_STEPS } from "./adventure-score";
import { proResultStep, proStep } from "./pro-score";

/**
 * The soundtrack is modern retro: every scene's tune arranged as a shipped
 * game's soundtrack (pro-score.ts) and played by chip-like voices with a
 * produced mix (pro-synth.ts). No audio files: the music is synthesized as
 * it plays.
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
/** The voices (pro-synth.ts). */
export type Instrument =
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
export interface ScoreNote {
  instrument: Instrument;
  note?: string;
  duration: number;
  volume: number;
  pan?: number;
  /** pro-arp: the chord it cycles through, a step per 1/30 s. */
  notes?: string[];
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
  if (isResultTheme(theme)) return proResultStep(theme, step, MUSIC_BPM[theme]);
  return proStep(theme, step, MUSIC_BPM[theme], phase);
}

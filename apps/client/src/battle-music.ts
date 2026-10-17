import type { Snapshot } from "@arena/shared";
import type { MusicTheme } from "./music-score";

/** The local player's final outcome; rounds and training keep their battle track. */
export function battleMusic(state: Snapshot, playerId: string): MusicTheme {
  const background = state.raid ? "raid" : "pvp";
  if (state.phase !== "finished" || state.practice || state.raid?.drill)
    return background;
  if (state.raid) return state.raid.result ?? "draw";
  const index = state.players.findIndex((p) => p.id === playerId);
  // Watching a match has no personal win/loss outcome.
  if (index < 0) return "draw";
  if (state.mode === "teams") {
    if (state.winnerTeam == null) return "draw";
    return state.winnerTeam === (state.players[index].team ?? index % 2)
      ? "victory"
      : "defeat";
  }
  if (!state.winner) return "draw";
  return state.winner === playerId ? "victory" : "defeat";
}

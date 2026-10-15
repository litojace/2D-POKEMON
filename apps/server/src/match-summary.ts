import type { MatchSummary } from "../../../packages/shared/src/accounts.js";
import type { Arena } from "./simulation.js";

/**
 * The record of a finished match that every player in it reports. It must be
 * identical for everyone (the database only counts a match once all humans
 * submit the same summary), so it is built once, here, by the server.
 */
export function matchSummary(
  arena: Arena,
  accountOf: (fighterId: string) => string | null,
): MatchSummary {
  if (arena.mode === "raid") throw new Error("Raids never enter the PvP match ledger.");
  const bot = [...arena.bots.values()][0]?.difficulty ?? null;
  return {
    v: 1,
    mode: arena.mode,
    arena: arena.arenaId,
    bot,
    winnerTeam: arena.winnerTeam,
    rounds: [...arena.roundLog],
    players: arena.players.map((p) => ({
      account: arena.bots.has(p.id) ? null : accountOf(p.id),
      name: p.name,
      character: p.character,
      team: arena.teamOf(p),
      dealt: Math.round(p.stats.dealt),
      kos: p.stats.kos ?? 0,
      combos: p.stats.combos ?? 0,
    })),
  };
}

/** Finished matches waiting for their players to report them. */
export class MatchLedger {
  private entries = new Map<
    string,
    { summary: MatchSummary; expires: number }
  >();
  constructor(private ttlMs = 60 * 60 * 1000) {}
  add(id: string, summary: MatchSummary) {
    this.prune();
    this.entries.set(id, { summary, expires: Date.now() + this.ttlMs });
  }
  /** The summary, if `accountId` played in the match. */
  forPlayer(id: string, accountId: string) {
    const entry = this.entries.get(id);
    if (!entry || entry.expires < Date.now()) return undefined;
    return entry.summary.players.some((p) => p.account === accountId)
      ? entry.summary
      : undefined;
  }
  prune() {
    const now = Date.now();
    for (const [id, e] of this.entries) if (e.expires < now) this.entries.delete(id);
  }
}

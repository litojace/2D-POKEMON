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
  if (arena.mode === "raid")
    throw new Error("Raids never enter the PvP match ledger.");
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
    {
      summary: MatchSummary;
      expires: number;
      /** When the match ended (epoch ms). */
      ended: number;
      /** Its players who haven't filed it yet. */
      unfiled: Set<string>;
    }
  >();
  constructor(private ttlMs = 60 * 60 * 1000) {}
  add(id: string, summary: MatchSummary, now = Date.now()) {
    this.prune();
    const unfiled = new Set(
      summary.players.flatMap((p) => (p.account ? [p.account] : [])),
    );
    this.entries.set(id, {
      summary,
      expires: now + this.ttlMs,
      ended: now,
      unfiled,
    });
  }
  /** The summary, if `accountId` played in the match. */
  forPlayer(id: string, accountId: string) {
    const entry = this.entries.get(id);
    if (!entry || entry.expires < Date.now()) return undefined;
    return entry.summary.players.some((p) => p.account === accountId)
      ? entry.summary
      : undefined;
  }
  /** `accountId`'s game has sent the match to be saved. */
  filed(id: string, accountId: string) {
    this.entries.get(id)?.unfiled.delete(accountId);
  }
  /**
   * Players who haven't filed a match that ended less than `graceMs` ago. A
   * server being replaced waits for them (drain, server.ts): the summary
   * lives only in this process, and the new server can't file it.
   */
  unfiled(graceMs: number, now = Date.now()) {
    let count = 0;
    for (const entry of this.entries.values())
      if (now - entry.ended < graceMs) count += entry.unfiled.size;
    return count;
  }
  prune() {
    const now = Date.now();
    for (const [id, e] of this.entries)
      if (e.expires < now) this.entries.delete(id);
  }
}

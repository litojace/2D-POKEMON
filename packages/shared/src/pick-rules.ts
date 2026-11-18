/**
 * Hidden picks in PvP rooms (docs/hidden-picks.md).
 *
 * In a PvP lobby you see the picks of your own side only: your teammate's in
 * a 2v2, nobody else's in a 1v1 or a free-for-all. Every pick is revealed
 * when the match starts (the briefing). The server enforces this by never
 * sending another side's pick (`veilPlayers`); the client only draws what it
 * was sent.
 *
 * Within a 2v2 team a fighter can be picked once: whoever locks it in first
 * keeps it. Across sides (and in a 1v1 or a free-for-all) the same fighter
 * may be picked twice: refusing it would tell you what the other side took.
 */
import type { CharacterId, Fighter, MatchMode, Phase } from "./index.js";

/** The placeholder sent for a hidden pick (never shown: see `veiled`). */
export const VEILED_CHARACTER: CharacterId = "voltkit";

/** Does this room hide picks from the other sides right now? */
export function picksHidden(room: {
  mode?: MatchMode;
  phase: Phase;
  practice?: unknown;
}) {
  return (
    room.phase === "lobby" &&
    !room.practice &&
    (room.mode === "duel" || room.mode === "teams" || room.mode === "ffa")
  );
}

/** Only 2v2 teammates share a pool of fighters (one each). */
export const uniquePerTeam = (mode: MatchMode | undefined) => mode === "teams";

/**
 * The teammate who has already locked in `character`, if any (2v2 only).
 * `teamOf` is the room's own team rule.
 */
export function pickTakenBy<
  P extends Pick<Fighter, "id" | "character" | "locked">,
>(
  mode: MatchMode | undefined,
  players: readonly P[],
  me: P,
  character: CharacterId,
  teamOf: (p: P) => number,
): P | undefined {
  if (!uniquePerTeam(mode)) return undefined;
  const team = teamOf(me);
  return players.find(
    (o) =>
      o.id !== me.id &&
      o.locked &&
      o.character === character &&
      teamOf(o) === team,
  );
}

/**
 * 2v2 teammates who locked the same fighter (after a team change or a
 * shuffle): everyone but the first to lock it in. `order` is when each
 * player locked in (lower is earlier).
 */
export function pickClashes<
  P extends Pick<Fighter, "id" | "character" | "locked">,
>(
  mode: MatchMode | undefined,
  players: readonly P[],
  teamOf: (p: P) => number,
  order: (p: P) => number,
): P[] {
  if (!uniquePerTeam(mode)) return [];
  const keep = new Map<string, P>();
  const out: P[] = [];
  const locked = players.filter((p) => p.locked);
  locked.sort((a, b) => order(a) - order(b));
  for (const p of locked) {
    const key = `${teamOf(p)}:${p.character}`;
    if (keep.has(key)) out.push(p);
    else keep.set(key, p);
  }
  return out;
}

/**
 * The players as `viewer` may see them: other sides' picks replaced by a
 * placeholder and marked `veiled`. A watcher (`viewer` undefined) sees no
 * pick at all. `sameSide` decides who shares the viewer's side.
 */
export function veilPlayers<
  P extends { id: string; character: CharacterId; browse?: CharacterId },
>(
  players: readonly P[],
  viewer: string | undefined,
  sameSide: (a: string, b: string) => boolean,
): P[] {
  return players.map((p) => {
    if (viewer !== undefined && (p.id === viewer || sameSide(viewer, p.id)))
      return p;
    const { browse: _browse, ...rest } = p;
    return {
      ...rest,
      character: VEILED_CHARACTER,
      veiled: true,
    } as unknown as P;
  });
}

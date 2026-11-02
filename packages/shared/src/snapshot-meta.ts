/**
 * Static fighter appearance travels apart from the 15 Hz combat stream.
 *
 * Names, titles, mastery flair, equipped skins/collections and boss clears
 * change rarely (joining, equipping, a refreshed profile), yet they were
 * about a third of every battle snapshot. The server now sends them as a
 * versioned `meta` block only when they change, when a socket joins,
 * resumes or starts watching, and on request; each snapshot carries the
 * current `metaRev` so a client can tell its cache is stale and ask again.
 * Values are always the server's own (verified) copies.
 */
import type { Fighter } from "./index.js";

export const META_KEYS = [
  "name",
  "title",
  "titleColor",
  "flair",
  "raidLook",
  "championLooks",
  "raidClears",
] as const;
export type MetaKey = (typeof META_KEYS)[number];
export type PlayerMeta = Pick<Fighter, MetaKey>;
export interface SnapshotMeta {
  rev: number;
  players: Record<string, PlayerMeta>;
}

export function playerMeta(p: Fighter): PlayerMeta {
  const meta = { name: p.name } as PlayerMeta;
  for (const key of META_KEYS)
    if (p[key] !== undefined) (meta as Record<string, unknown>)[key] = p[key];
  return meta;
}

/**
 * Server side, one per room: notices appearance changes cheaply (object
 * identity per field, then a JSON comparison only for changed fields) and
 * re-verifies everything with a full comparison every `verifyEvery` calls
 * in case an object is ever edited in place.
 */
export class MetaTracker {
  rev = 0;
  private refs = new Map<string, unknown[]>();
  private json = new Map<string, string>();
  private calls = 0;
  constructor(private verifyEvery = 30) {}
  /** Bump `rev` if any appearance changed; true when it did. */
  update(players: readonly Fighter[]) {
    let changed = false;
    const verify = ++this.calls % this.verifyEvery === 0;
    const ids = new Set<string>();
    if (!verify && players.length === this.refs.size) {
      // Fast path: same fighters, same objects (the usual 15 Hz case).
      let same = true;
      for (const p of players) {
        const old = this.refs.get(p.id);
        if (!old || !META_KEYS.every((k, i) => p[k] === old[i])) {
          same = false;
          break;
        }
      }
      if (same) return false;
    }
    for (const p of players) {
      ids.add(p.id);
      const old = this.refs.get(p.id);
      if (!verify && old && META_KEYS.every((k, i) => p[k] === old[i]))
        continue;
      const refs = META_KEYS.map((k) => p[k]);
      this.refs.set(p.id, refs);
      const json = JSON.stringify(refs);
      if (this.json.get(p.id) !== json) {
        this.json.set(p.id, json);
        changed = true;
      }
    }
    for (const id of [...this.refs.keys()])
      if (!ids.has(id)) {
        this.refs.delete(id);
        this.json.delete(id);
        changed = true;
      }
    if (changed) this.rev++;
    return changed;
  }
  meta(players: readonly Fighter[]): SnapshotMeta {
    return {
      rev: this.rev,
      players: Object.fromEntries(players.map((p) => [p.id, playerMeta(p)])),
    };
  }
}

/** Client side: the latest appearance block for the room being shown. */
export class MetaCache {
  code = "";
  rev = -1;
  players: Record<string, PlayerMeta> = {};
  /** Keep the newest block per room (requests and broadcasts can cross). */
  apply(code: string, meta: SnapshotMeta) {
    if (code === this.code && meta.rev < this.rev) return;
    this.code = code;
    this.rev = meta.rev;
    this.players = meta.players;
  }
  current(code: string, rev: number | undefined) {
    return rev === undefined || (code === this.code && rev === this.rev);
  }
  get(code: string, id: string): PlayerMeta | undefined {
    return code === this.code ? this.players[id] : undefined;
  }
  clear() {
    this.code = "";
    this.rev = -1;
    this.players = {};
  }
}

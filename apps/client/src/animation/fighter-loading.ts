import type { CharacterId } from "@arena/shared";
import type { RigAsset } from "./assets";

/**
 * Which fighters' textures the battle has, and which to load next.
 *
 * The battle used to queue every fighter in the game (16 × 64 SVG layers,
 * about 10 MB) whenever it opened, which takes many seconds on an older
 * phone. Now it loads the fighters in the room, and any fighter that turns
 * up later (Fighter roulette, a new seat) when it first appears.
 */
export class FighterLoading {
  private assets = new Map<CharacterId, RigAsset[]>();
  private ready = new Set<CharacterId>();
  private requested = new Set<CharacterId>();
  private attempts = new Map<CharacterId, number>();
  constructor(
    private readonly hooks: {
      /** Build a fighter's rig layers (SVG data URLs). */
      build(id: CharacterId): RigAsset[];
      /** The texture keys those layers load into. */
      keys(id: CharacterId, layers: RigAsset[]): string[];
      /** Whether the texture manager already holds a key. */
      exists(key: string): boolean;
    },
    /** Loads that may fail before a fighter is drawn without its art. */
    private readonly maxAttempts = 3,
  ) {}
  /** Rig layers, built once per fighter and only when needed. */
  assetsFor(id: CharacterId) {
    let layers = this.assets.get(id);
    if (!layers) this.assets.set(id, (layers = this.hooks.build(id)));
    return layers;
  }
  isReady(id: CharacterId) {
    if (this.ready.has(id)) return true;
    const layers = this.assetsFor(id);
    if (this.hooks.keys(id, layers).every((key) => this.hooks.exists(key))) {
      this.ready.add(id);
      return true;
    }
    // Art that keeps failing to load must not freeze the battle.
    return (
      !this.requested.has(id) &&
      (this.attempts.get(id) ?? 0) >= this.maxAttempts
    );
  }
  allReady(ids: Iterable<CharacterId>) {
    for (const id of ids) if (!this.isReady(id)) return false;
    return true;
  }
  /** The fighters to queue now: needed, missing and not already on the way. */
  toRequest(ids: Iterable<CharacterId>) {
    const queue: CharacterId[] = [];
    for (const id of ids) {
      if (this.requested.has(id) || this.isReady(id)) continue;
      this.requested.add(id);
      this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
      queue.push(id);
    }
    return queue;
  }
  /** A load finished: whatever is still missing may be asked for again. */
  settled() {
    this.requested.clear();
  }
}

/** Each fighter the players in a snapshot need, once. */
export function neededFighters(players: readonly { character: CharacterId }[]) {
  return [...new Set(players.map((p) => p.character))];
}

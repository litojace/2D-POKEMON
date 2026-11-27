import type { CharacterId } from "@arena/shared";
import type { RigAsset } from "./assets";
import type { SkinLook } from "../creature-design";

/**
 * Which fighters' textures the battle has, and which to load next.
 *
 * The battle used to queue every fighter in the game (16 × 64 SVG layers,
 * about 10 MB) whenever it opened, which takes many seconds on an older
 * phone. Now it loads the fighters in the room, and any fighter that turns
 * up later (Fighter roulette, a new seat) when it first appears.
 */
export class FighterLoading<Id extends string = CharacterId> {
  private assets = new Map<Id, RigAsset[]>();
  private ready = new Set<Id>();
  private requested = new Set<Id>();
  private attempts = new Map<Id, number>();
  constructor(
    private readonly hooks: {
      /** Build a fighter's rig layers (SVG data URLs). */
      build(id: Id): RigAsset[];
      /** The texture keys those layers load into. */
      keys(id: Id, layers: RigAsset[]): string[];
      /** Whether the texture manager already holds a key. */
      exists(key: string): boolean;
    },
    /** Loads that may fail before a fighter is drawn without its art. */
    private readonly maxAttempts = 3,
  ) {}
  /** Rig layers, built once per fighter and only when needed. */
  assetsFor(id: Id) {
    let layers = this.assets.get(id);
    if (!layers) this.assets.set(id, (layers = this.hooks.build(id)));
    return layers;
  }
  /** Every texture of the fighter's rig is loaded: its rig can be built. */
  hasArt(id: Id) {
    if (this.ready.has(id)) return true;
    const layers = this.assetsFor(id);
    if (this.hooks.keys(id, layers).every((key) => this.hooks.exists(key))) {
      this.ready.add(id);
      return true;
    }
    return false;
  }
  /** No load on the way and maxAttempts used up. */
  private outOfAttempts(id: Id) {
    return (
      !this.requested.has(id) &&
      (this.attempts.get(id) ?? 0) >= this.maxAttempts
    );
  }
  /** Its art failed to load maxAttempts times: no more retries. */
  gaveUp(id: Id) {
    return !this.hasArt(id) && this.outOfAttempts(id);
  }
  /**
   * Nothing more to wait for: the art is loaded, or it kept failing (art
   * that never loads must not freeze the battle; the scene then draws that
   * fighter as a plain stand-in instead of a rig, see `hasArt`).
   */
  isReady(id: Id) {
    return this.hasArt(id) || this.outOfAttempts(id);
  }
  allReady(ids: Iterable<Id>) {
    for (const id of ids) if (!this.isReady(id)) return false;
    return true;
  }
  /** The fighters to queue now: needed, missing and not already on the way. */
  toRequest(ids: Iterable<Id>) {
    const queue: Id[] = [];
    for (const id of ids) {
      if (this.requested.has(id) || this.isReady(id)) continue;
      this.requested.add(id);
      this.attempts.set(id, (this.attempts.get(id) ?? 0) + 1);
      queue.push(id);
    }
    return queue;
  }
  /**
   * Its art went blank (rig-health.ts): ask for it again, from scratch, as
   * if it had never loaded (with fresh attempts).
   */
  forget(id: Id) {
    this.ready.delete(id);
    this.requested.delete(id);
    this.attempts.delete(id);
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

/** A fighter as the battle draws it: its champion, in the look it wears. */
export interface FighterLook {
  character: CharacterId;
  /** Its Shop skin on that champion, or null for the champion's own look. */
  look: SkinLook | null;
}
/**
 * Each look the battle draws, once, by name: the champion and its skin's
 * texture suffix (`suffix`, assets.ts skinSuffix; "" for its own look).
 * A fighter in a Shop skin needs only the skin's textures: the champion's
 * own look loads only for someone who shows it (no skin, a Spire Echo), not
 * for every fighter as before (about 3.8 MB of pixels, and the GPU's copy,
 * per fighter in a skin; 26 Nov 2026).
 */
export function neededLooks(
  fighters: readonly FighterLook[],
  suffix: (character: CharacterId, look: SkinLook | null) => string,
) {
  const looks = new Map<string, FighterLook>();
  for (const f of fighters) {
    const own = suffix(f.character, f.look);
    const name = f.character + own;
    if (!looks.has(name))
      looks.set(name, { character: f.character, look: own ? f.look : null });
  }
  return looks;
}

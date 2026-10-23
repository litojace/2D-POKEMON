import type Phaser from "phaser";
import type { Ability, Projectile, Zone } from "@arena/shared";
/**
 * Per-fighter effect kits. Each element module fills in the moves it draws;
 * skill-effects.ts looks a move up here first and falls back to its classic
 * drawing otherwise. Every size must come from the ability or the server
 * state passed in, so what players see matches what can hit them.
 */
export type G = Phaser.GameObjects.Graphics;
/** Run `draw(k)` every frame for `ms`, with k going 0 → 1. */
export type Shot = (ms: number, draw: (k: number) => void) => void;
export interface FxKit {
  projectile?: Record<string, (g: G, pr: Projectile, now: number) => void>;
  zone?: Record<string, (g: G, z: Zone, progress: number, now: number) => void>;
  windup?: Record<
    string,
    (g: G, a: Ability, x: number, y: number, angle: number, aimX: number, aimY: number, color: number, k: number, now: number) => void
  >;
  channel?: Record<string, (g: G, a: Ability, x: number, y: number, angle: number, color: number, now: number) => void>;
  cast?: Record<string, (scene: Phaser.Scene, a: Ability, x: number, y: number, angle: number, color: number, shot: Shot) => void>;
  impact?: Record<string, (scene: Phaser.Scene, a: Ability, x: number, y: number, color: number, shot: Shot) => void>;
  beam?: Record<
    string,
    (scene: Phaser.Scene, a: Ability, x: number, y: number, tx: number, ty: number, color: number, shot: Shot) => void
  >;
  /** Keyed by lower-case element name. */
  hit?: Record<string, (scene: Phaser.Scene, x: number, y: number, color: number, shot: Shot) => void>;
}
export function mergeKits(kits: FxKit[]): Required<FxKit> {
  const out: Required<FxKit> = { projectile: {}, zone: {}, windup: {}, channel: {}, cast: {}, impact: {}, beam: {}, hit: {} };
  for (const kit of kits)
    for (const key of Object.keys(out) as (keyof FxKit)[]) Object.assign(out[key], kit[key] ?? {});
  return out;
}
/** Where a fighter's mouth / hands are, relative to its floor position. */
export const CHEST = 14;
export const ease = (k: number) => 1 - (1 - k) ** 3;
export const hash = (n: number) => {
  const x = Math.sin(n * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};
export const TAU = Math.PI * 2;

import type { GameEvent } from "@arena/shared";
import type { SfxRecipe } from "./sfx";
import {
  castRecipe,
  castRecipeOf,
  CHIP_DAMAGE,
  CUES,
  hitRecipe,
  skillSound,
  type CueId,
  type HitRole,
} from "./sfx-recipes";

/** One sound to play: what, how loud, where, and how often at most. */
export interface SoundCall {
  recipe: SfxRecipe;
  /** Sounds sharing a key play at most once per `gap` seconds. */
  key: string;
  gap: number;
  volume: number;
  pan: number;
  /** 2: yours, or about you (always heard); 1: other players' (dropped first). */
  priority: 1 | 2;
  /** A little random pitch, so repeated casts and hits don't sound stamped. */
  vary: boolean;
}
/** Where you are and which casts already sounded on the key press. */
export interface SoundView {
  me?: string | null;
  x?: number;
  y?: number;
  /** This cast or dash was played on the press (cast-prediction.ts). */
  echo?: boolean;
}
/** Other players' casts sit under yours, and fade a little with distance. */
export const OTHERS_VOLUME = 0.42;
/** The arena's middle, for a spectator (the round event's spot). */
const MIDDLE = { x: 800, y: 450 };
/** A skill's later pulses: a short shot of its element, made once per skill. */
const bursts = new Map<string, SfxRecipe>();

export function cueCall(id: CueId, volume = 1): SoundCall {
  return {
    recipe: CUES[id],
    key: `cue:${id}`,
    gap: id === "ui" ? 0.04 : 0.08,
    volume,
    pan: 0,
    priority: 2,
    vary: false,
  };
}
/** Your own cast, played on the key press (before the server's echo). */
export function ownCastCall(abilityId: string, me: string): SoundCall | null {
  const recipe = castRecipeOf(abilityId);
  if (!recipe) return null;
  return {
    recipe,
    key: `cast:${me}`,
    gap: 0.06,
    volume: 1,
    pan: 0,
    priority: 2,
    vary: true,
  };
}

/** The sound of a battle event for this player, or null for silence. */
export function eventSound(
  event: GameEvent,
  view: SoundView,
): SoundCall | null {
  const mine = !!view.me && event.owner === view.me;
  const from = { x: view.x ?? MIDDLE.x, y: view.y ?? MIDDLE.y };
  const dx = event.x - from.x,
    dy = event.y - from.y;
  const pan = Math.max(-1, Math.min(1, dx / 700)) * 0.6;
  const near = 1 - Math.min(1, Math.hypot(dx, dy) / 1400) * 0.5;
  const call = (
    recipe: SfxRecipe,
    key: string,
    gap: number,
    volume: number,
    priority: 1 | 2,
    vary = true,
  ): SoundCall => ({ recipe, key, gap, volume, pan, priority, vary });
  switch (event.kind) {
    case "cast":
    case "beam": {
      if (mine && view.echo) return null;
      const recipe = event.abilityId ? castRecipeOf(event.abilityId) : null;
      if (!recipe) return null;
      // A beam follows its cast: it sounds only if the cast didn't just now.
      const gap = event.kind === "beam" ? 0.3 : 0.06;
      return mine
        ? call(recipe, `cast:${event.owner}`, gap, 1, 2)
        : call(recipe, `cast:${event.owner}`, gap, OTHERS_VOLUME * near, 1);
    }
    case "hit": {
      const role: HitRole =
        view.me && event.target === view.me
          ? "taken"
          : view.me && event.source === view.me
            ? "dealt"
            : "other";
      const damage = event.value ?? 0;
      const recipe = hitRecipe({
        role,
        damage,
        element: skillSound(event.abilityId)?.ability.element,
        ko: !!event.ko,
        miss: !!event.miss,
        combo: !!event.combo,
        ambush: !!event.ambush,
      });
      // Burns and other ticks repeat: at most one tick a beat per target.
      const chip = damage < CHIP_DAMAGE && !event.ko && !event.miss;
      return call(
        recipe,
        `hit:${event.target ?? ""}${chip ? ":chip" : ""}`,
        chip ? 0.12 : 0.03,
        role === "other" ? 0.5 * near : 1,
        role === "other" && !event.ko ? 1 : 2,
      );
    }
    case "burst": {
      // Your skill going off again (a field's pulse, a landing, a pound).
      if (!mine) return null;
      const id = event.abilityId ?? "";
      let recipe = bursts.get(id);
      if (!recipe) {
        const skill = skillSound(id);
        recipe = castRecipe(
          { element: skill?.ability.element ?? "", kind: "projectile" },
          "basic",
          skill?.voice,
        );
        bursts.set(id, recipe);
      }
      return call(recipe, `burst:${id}`, 0.15, 0.45, 2);
    }
    case "dash":
      return mine && !view.echo ? cueCall("dash") : null;
    case "jump":
    case "land":
      return mine ? cueCall(event.kind) : null;
    case "heal":
      return mine ? cueCall("heal") : null;
    case "orb":
      return { ...cueCall("orb", 0.6 * near), pan };
    case "round":
      return cueCall("round");
    case "hazard": {
      const id: CueId =
        event.abilityId === "hazard-wall"
          ? "hazard-wall"
          : event.abilityId === "hazard-pool"
            ? "hazard-pool"
            : "hazard-vent";
      return call(CUES[id], `cue:${id}`, 0.2, 0.8 * near, 1, false);
    }
    default:
      // Projectile ends and raid impacts sound through hits and the boss's cues.
      return null;
  }
}

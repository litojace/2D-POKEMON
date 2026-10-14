/**
 * Game feel: how hard each hit lands on screen.
 *
 * Values follow common action-game practice: a hit-stop of a few dozen
 * milliseconds (longer for bigger hits), screen shake scaled by hit size and
 * felt most by whoever was hit, and one short white flash on the target.
 * Presentation only: the server simulation never pauses.
 */
export type HitStrength = "weak" | "strong" | "critical";

export function hitStrength(damage: number, knockout = false): HitStrength {
  if (knockout || damage >= 22) return "critical";
  if (damage >= 10) return "strong";
  return "weak";
}

export interface HitFeel {
  /** Freeze the fighters' animation and movement for this long (ms). */
  stopMs: number;
  /** Phaser camera shake: duration (ms) and intensity (fraction of view). */
  shakeMs: number;
  shake: number;
  /** White flash on the target (ms). */
  flashMs: number;
  /** Controller / phone vibration (ms, 0 = none) and strength 0–1. */
  rumbleMs: number;
  rumble: number;
}

const BASE: Record<HitStrength, HitFeel> = {
  weak: {
    stopMs: 0,
    shakeMs: 0,
    shake: 0,
    flashMs: 70,
    rumbleMs: 0,
    rumble: 0,
  },
  strong: {
    stopMs: 55,
    shakeMs: 120,
    shake: 0.004,
    flashMs: 80,
    rumbleMs: 60,
    rumble: 0.45,
  },
  critical: {
    stopMs: 110,
    shakeMs: 220,
    shake: 0.008,
    flashMs: 90,
    rumbleMs: 140,
    rumble: 0.9,
  },
};

/**
 * Feel for one hit as seen by this viewer. `role`: the viewer was hit
 * ("victim"), landed it ("attacker") or is watching ("spectator").
 */
export function hitFeel(
  strength: HitStrength,
  role: "victim" | "attacker" | "spectator",
  reducedMotion = false,
): HitFeel {
  const base = BASE[strength];
  const shakeScale = role === "victim" ? 1 : role === "attacker" ? 0.5 : 0;
  const rumbleScale = role === "victim" ? 1 : role === "attacker" ? 0.4 : 0;
  return {
    // Everyone sees the freeze (it reads as impact), but not the shake.
    stopMs: reducedMotion ? 0 : base.stopMs,
    shakeMs: reducedMotion || !shakeScale ? 0 : base.shakeMs,
    shake: reducedMotion ? 0 : base.shake * shakeScale,
    flashMs: base.flashMs,
    rumbleMs: rumbleScale ? base.rumbleMs : 0,
    rumble: base.rumble * rumbleScale,
  };
}

/** The knockout that ends a round: hold the moment and push the camera in. */
export const KO_FEEL = {
  holdMs: 420,
  zoom: 1.18,
  zoomMs: 520,
  tweenSlowdown: 0.3,
};

/** Best-effort vibration: controller rumble, else phone vibration (Android). */
export function rumble(ms: number, strength: number) {
  if (ms <= 0 || strength <= 0 || typeof navigator === "undefined") return;
  try {
    for (const pad of navigator.getGamepads?.() ?? []) {
      const actuator = (
        pad as
          | (Gamepad & {
              vibrationActuator?: {
                playEffect?: (type: string, params: object) => Promise<unknown>;
              };
            })
          | null
      )?.vibrationActuator;
      if (pad?.connected && actuator?.playEffect) {
        void actuator
          .playEffect("dual-rumble", {
            duration: ms,
            strongMagnitude: strength,
            weakMagnitude: Math.min(1, strength + 0.2),
          })
          .catch(() => {});
        return;
      }
    }
    // iPhone Safari has no web vibration; Android Chrome does.
    navigator.vibrate?.(Math.round(ms * 0.6));
  } catch {
    /* Haptics are optional. */
  }
}

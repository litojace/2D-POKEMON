/**
 * Controller support through the browser Gamepad API ("standard" mapping,
 * which Xbox, PlayStation and most Switch-style pads report in browsers).
 *
 *   Left stick / D-pad  move            Right stick   aim
 *   RT                  basic (hold)    A / Cross     jump
 *   X / Square          skill 1         LB or LT      dash
 *   Y / Triangle        skill 2         Start         menu
 *   B / Circle          skill 3
 *   RB / R1             ultimate
 * PAD_LAYOUT below is the single source of truth.
 */
export type PadAction =
  | "basic"
  | "skill1"
  | "skill2"
  | "skill3"
  | "skill4"
  | "dash"
  | "jump"
  | "menu";

/** Standard-mapping button index → action. */
export const PAD_LAYOUT: Record<number, PadAction> = {
  7: "basic", // RT
  2: "skill1", // X / Square
  3: "skill2", // Y / Triangle
  1: "skill3", // B / Circle
  5: "skill4", // RB / R1 — ultimate
  4: "dash", // LB / L1
  6: "dash", // LT / L2
  0: "jump", // A / Cross
  9: "menu", // Start / Options
};
/** Human labels for the HUD and help screens (Xbox names). */
export const PAD_LABELS: Record<PadAction, string> = {
  basic: "RT",
  skill1: "X",
  skill2: "Y",
  skill3: "B",
  skill4: "RB",
  dash: "LB",
  jump: "A",
  menu: "START",
};

export const STICK_DEADZONE = 0.22;
const PRESS = 0.5;

/** The parts of a browser Gamepad this module reads (easy to fake in tests). */
export interface PadLike {
  connected: boolean;
  mapping?: string;
  axes: readonly number[];
  buttons: readonly { pressed: boolean; value: number }[];
}
export interface PadFrame {
  dx: number;
  dy: number;
  /** Right-stick aim: direction scaled by tilt (0–1], or null when centred. */
  aim: { x: number; y: number } | null;
  held: Set<PadAction>;
  pressed: Set<PadAction>;
  released: Set<PadAction>;
  /** Anything moved or pressed this frame (switches prompts to the pad). */
  active: boolean;
}

/** Scaled radial deadzone: no drift at rest, full range at the edge. */
export function stick(x = 0, y = 0, dead = STICK_DEADZONE) {
  const m = Math.hypot(x, y);
  if (m < dead) return { x: 0, y: 0, m: 0 };
  const scaled = Math.min(1, (m - dead) / (1 - dead));
  return { x: (x / m) * scaled, y: (y / m) * scaled, m: scaled };
}

export function readPad(
  pad: PadLike,
  previous: ReadonlySet<PadAction>,
): PadFrame {
  const down = (i: number) => {
    const b = pad.buttons[i];
    return !!b && (b.pressed || b.value > PRESS);
  };
  const held = new Set<PadAction>();
  for (const [index, action] of Object.entries(PAD_LAYOUT))
    if (down(Number(index))) held.add(action);
  const move = stick(pad.axes[0], pad.axes[1]);
  let dx = move.x,
    dy = move.y;
  // D-pad (12 up, 13 down, 14 left, 15 right) overrides the stick when used.
  const pad4 = [down(12), down(13), down(14), down(15)];
  if (pad4.some(Boolean)) {
    dx = Number(pad4[3]) - Number(pad4[2]);
    dy = Number(pad4[1]) - Number(pad4[0]);
  }
  const right = stick(pad.axes[2], pad.axes[3]);
  const aim = right.m > 0 ? { x: right.x, y: right.y } : null;
  const pressed = new Set([...held].filter((a) => !previous.has(a)));
  const released = new Set([...previous].filter((a) => !held.has(a)));
  return {
    dx,
    dy,
    aim,
    held,
    pressed,
    released,
    active: held.size > 0 || dx !== 0 || dy !== 0 || !!aim,
  };
}

/** The first connected pad, or undefined. */
export function firstPad(): PadLike | undefined {
  if (typeof navigator === "undefined" || !navigator.getGamepads) return;
  try {
    return [...navigator.getGamepads()].find(
      (p): p is Gamepad => !!p?.connected,
    );
  } catch {
    return; // Blocked by a permissions policy.
  }
}

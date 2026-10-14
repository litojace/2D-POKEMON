/**
 * Player controls: key bindings, casting style and aim assist.
 *
 * Bindings use `KeyboardEvent.code` (layout-independent physical keys, e.g.
 * "KeyQ") plus "Mouse0" (left), "Mouse1" (middle) and "Mouse2" (right).
 * Every action has two slots so players can keep a backup key.
 */
export type Action =
  | "up"
  | "left"
  | "down"
  | "right"
  | "basic"
  | "skill1"
  | "skill2"
  | "skill3"
  | "skill4"
  | "dash"
  | "jump";
export type Binding = [string | null, string | null];
export type Bindings = Record<Action, Binding>;
export type CastMode = "preview" | "instant";
export interface ControlPrefs {
  bindings: Bindings;
  /** "preview": hold a skill key to see where it lands, release to cast. */
  cast: CastMode;
  /** Mouse only: basic attacks lean toward an opponent near the cursor. */
  aimAssist: boolean;
}

export const ACTIONS: { id: Action; label: string; group: string }[] = [
  { id: "up", label: "Move up", group: "Movement" },
  { id: "left", label: "Move left", group: "Movement" },
  { id: "down", label: "Move down", group: "Movement" },
  { id: "right", label: "Move right", group: "Movement" },
  { id: "basic", label: "Basic attack (hold)", group: "Combat" },
  { id: "skill1", label: "Skill 1", group: "Combat" },
  { id: "skill2", label: "Skill 2", group: "Combat" },
  { id: "skill3", label: "Skill 3", group: "Combat" },
  { id: "skill4", label: "Ultimate (skill 4)", group: "Combat" },
  { id: "dash", label: "Dash", group: "Combat" },
  { id: "jump", label: "Jump", group: "Combat" },
];
export const SKILL_ACTIONS = ["skill1", "skill2", "skill3", "skill4"] as const;

/** Q E R F sit next to W A S D, so you can cast without letting go of movement. */
export const DEFAULT_BINDINGS: Bindings = {
  up: ["KeyW", "ArrowUp"],
  left: ["KeyA", "ArrowLeft"],
  down: ["KeyS", "ArrowDown"],
  right: ["KeyD", "ArrowRight"],
  basic: ["Mouse0", null],
  skill1: ["KeyQ", "Digit1"],
  skill2: ["KeyE", "Digit2"],
  skill3: ["KeyR", "Digit3"],
  skill4: ["KeyF", "Digit4"],
  dash: ["Mouse2", "ShiftLeft"],
  jump: ["Space", null],
};
export const DEFAULT_PREFS: ControlPrefs = {
  bindings: DEFAULT_BINDINGS,
  cast: "preview",
  aimAssist: false,
};

/** Keys the browser or the game needs for itself. */
const RESERVED = new Set([
  "Escape",
  "Tab",
  "MetaLeft",
  "MetaRight",
  "OSLeft",
  "OSRight",
  "ContextMenu",
  "CapsLock",
]);
export function bindable(code: string) {
  if (!code || RESERVED.has(code)) return false;
  if (/^F\d{1,2}$/.test(code)) return false; // F5 reload, F11 fullscreen, F12 devtools…
  return /^(Mouse[0-4]|[A-Za-z0-9]+)$/.test(code);
}

const NAMED: Record<string, string> = {
  Mouse0: "LMB",
  Mouse1: "MMB",
  Mouse2: "RMB",
  Mouse3: "MB4",
  Mouse4: "MB5",
  Space: "SPACE",
  ShiftLeft: "SHIFT",
  ShiftRight: "R-SHIFT",
  ControlLeft: "CTRL",
  ControlRight: "R-CTRL",
  AltLeft: "ALT",
  AltRight: "R-ALT",
  ArrowUp: "↑",
  ArrowDown: "↓",
  ArrowLeft: "←",
  ArrowRight: "→",
  Enter: "ENTER",
  Backspace: "BKSP",
  Backquote: "`",
  Minus: "-",
  Equal: "=",
  BracketLeft: "[",
  BracketRight: "]",
  Backslash: "\\",
  Semicolon: ";",
  Quote: "'",
  Comma: ",",
  Period: ".",
  Slash: "/",
};
/** Short label for a code: "KeyQ" → "Q", "Digit1" → "1", "Mouse2" → "RMB". */
export function codeLabel(code: string | null | undefined): string {
  if (!code) return "—";
  if (NAMED[code]) return NAMED[code];
  const key = code.match(/^Key([A-Z])$/);
  if (key) return key[1];
  const digit = code.match(/^(?:Digit|Numpad)(\d)$/);
  if (digit) return code.startsWith("Numpad") ? `NUM ${digit[1]}` : digit[1];
  return code.replace(/^Numpad/, "NUM ").toUpperCase();
}
/** The label shown in the HUD for an action: its first bound key. */
export function actionLabel(bindings: Bindings, action: Action) {
  const [a, b] = bindings[action];
  return codeLabel(a ?? b);
}
/** "W A S D" style label for the four movement keys. */
export function movementLabel(bindings: Bindings) {
  return (["up", "left", "down", "right"] as const)
    .map((a) => actionLabel(bindings, a))
    .join(" ");
}
export function skillLabels(bindings: Bindings) {
  return SKILL_ACTIONS.map((a) => actionLabel(bindings, a));
}

export function actionFor(
  bindings: Bindings,
  code: string,
): Action | undefined {
  return ACTIONS.find(({ id }) => bindings[id].includes(code))?.id;
}

/**
 * Put `code` on `action` in `slot`. A key can only do one thing, so it is
 * taken off whatever action had it; that action is returned so the screen can say so.
 */
export function bind(
  bindings: Bindings,
  action: Action,
  slot: 0 | 1,
  code: string | null,
): { bindings: Bindings; displaced?: Action } {
  const next = Object.fromEntries(
    ACTIONS.map(({ id }) => [id, [...bindings[id]] as Binding]),
  ) as Bindings;
  let displaced: Action | undefined;
  if (code) {
    if (!bindable(code)) return { bindings };
    for (const { id } of ACTIONS)
      for (const s of [0, 1] as const)
        if (next[id][s] === code && !(id === action && s === slot)) {
          next[id][s] = null;
          if (id !== action) displaced = id;
        }
  }
  next[action][slot] = code;
  return { bindings: next, displaced };
}

/** Rebuild prefs from storage, keeping only valid, non-duplicated keys. */
export function parsePrefs(raw: unknown): ControlPrefs {
  const data = (raw && typeof raw === "object" ? raw : {}) as Partial<
    Record<keyof ControlPrefs, unknown>
  >;
  let bindings = DEFAULT_BINDINGS;
  const saved = data.bindings as Partial<Record<Action, unknown>> | undefined;
  if (saved && typeof saved === "object") {
    bindings = Object.fromEntries(
      ACTIONS.map(({ id }) => [id, [null, null] as Binding]),
    ) as Bindings;
    for (const { id } of ACTIONS) {
      const pair = Array.isArray(saved[id])
        ? (saved[id] as unknown[])
        : DEFAULT_BINDINGS[id];
      for (const slot of [0, 1] as const) {
        const code = pair[slot];
        if (typeof code === "string" && bindable(code))
          bindings = bind(bindings, id, slot, code).bindings;
      }
    }
  }
  return {
    bindings,
    cast: data.cast === "instant" ? "instant" : "preview",
    aimAssist: data.aimAssist === true,
  };
}

const STORAGE_KEY = "arena-controls";
let current: ControlPrefs | undefined;
const listeners = new Set<(prefs: ControlPrefs) => void>();
export function controlPrefs(): ControlPrefs {
  if (current) return current;
  try {
    const raw =
      typeof localStorage === "undefined"
        ? null
        : localStorage.getItem(STORAGE_KEY);
    current = parsePrefs(raw ? JSON.parse(raw) : {});
  } catch {
    current = parsePrefs({});
  }
  return current;
}
export function setControlPrefs(prefs: ControlPrefs) {
  current = prefs;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    /* Private mode: keep the change for this visit. */
  }
  for (const listener of listeners) listener(prefs);
}
export function onControlPrefs(listener: (prefs: ControlPrefs) => void) {
  listeners.add(listener);
}
/** Changes whenever bindings change, so cached HUD markup re-renders. */
export function bindingsKey(prefs = controlPrefs()) {
  return ACTIONS.map(({ id }) => prefs.bindings[id].join("+")).join(",");
}

/**
 * Aim assist: when an opponent stands within `radius` world units of the
 * cursor, aim at them instead. Otherwise the cursor is used as is.
 */
export function assistAim(
  aim: { x: number; y: number },
  enemies: readonly { x: number; y: number }[],
  radius = 110,
) {
  let best: { x: number; y: number } | undefined,
    bestD = radius;
  for (const e of enemies) {
    const d = Math.hypot(e.x - aim.x, e.y - aim.y);
    if (d <= bestD) {
      best = e;
      bestD = d;
    }
  }
  return best ? { x: best.x, y: best.y } : aim;
}

/**
 * Hold-to-aim skill casting. `press` and `release` come from keys or pad
 * buttons; the returned slot (0–3) is the skill to send this tick, or -1.
 */
export class SkillCaster {
  /** Skill slot being previewed, or -1. */
  aiming = -1;
  press(slot: number, mode: CastMode): number {
    if (mode === "instant") return slot;
    this.aiming = slot;
    return -1;
  }
  release(slot: number, mode: CastMode): number {
    if (mode === "instant" || this.aiming !== slot) return -1;
    this.aiming = -1;
    return slot;
  }
  cancel() {
    this.aiming = -1;
  }
}

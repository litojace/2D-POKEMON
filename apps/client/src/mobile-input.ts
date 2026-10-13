export interface ControlPreferences {
  joystickSize: number;
  buttonSize: number;
  opacity: number;
}
export const DEFAULT_CONTROLS: ControlPreferences = {
  joystickSize: 1,
  buttonSize: 1,
  opacity: 0.85,
};
export function controlPreferences(value: unknown): ControlPreferences {
  const input = (
    value && typeof value === "object" ? value : {}
  ) as Partial<ControlPreferences>;
  const clamp = (v: unknown, min: number, max: number, fallback: number) =>
    typeof v === "number" && Number.isFinite(v)
      ? Math.max(min, Math.min(max, v))
      : fallback;
  return {
    joystickSize: clamp(input.joystickSize, 0.8, 1.25, 1),
    buttonSize: clamp(input.buttonSize, 0.85, 1.2, 1),
    opacity: clamp(input.opacity, 0.4, 1, 0.85),
  };
}
export function joystickVector(x: number, y: number, radius: number) {
  const length = Math.hypot(x, y);
  if (radius <= 0 || !Number.isFinite(length) || length < radius * 0.12)
    return { dx: 0, dy: 0 };
  const scale = Math.max(radius, length);
  return { dx: x / scale, dy: y / scale };
}
export type TouchAction = "attack" | "dash" | "jump" | "0" | "1" | "2";
export class TouchInputState {
  dx = 0;
  dy = 0;
  joystickPointer: number | null = null;
  readonly pointers = new Map<number, TouchAction>();
  get basic() {
    return [...this.pointers.values()].includes("attack");
  }
  startJoystick(id: number) {
    if (this.joystickPointer !== null || this.pointers.has(id)) return false;
    this.joystickPointer = id;
    return true;
  }
  move(id: number, x: number, y: number, radius: number) {
    if (id === this.joystickPointer)
      Object.assign(this, joystickVector(x, y, radius));
  }
  press(id: number, action: TouchAction) {
    if (id === this.joystickPointer || this.pointers.has(id)) return false;
    this.pointers.set(id, action);
    return true;
  }
  release(id: number) {
    this.pointers.delete(id);
    if (id === this.joystickPointer) {
      this.joystickPointer = null;
      this.dx = this.dy = 0;
    }
  }
  reset() {
    this.joystickPointer = null;
    this.pointers.clear();
    this.dx = this.dy = 0;
  }
}
export interface TouchTarget {
  action: TouchAction;
  x: number;
  y: number;
  size: number;
}
export function mobileLayout(
  width: number,
  height: number,
  prefs: ControlPreferences = DEFAULT_CONTROLS,
) {
  const available = Math.max(280, width);
  const joystick = Math.max(
    88,
    Math.min(
      164,
      Math.min(height * 0.34, available * 0.25) * prefs.joystickSize,
    ),
  );
  const compact = available < 600 && height < 500;
  const unit = Math.max(
    44,
    Math.min(
      compact ? 48 : 60,
      height * 0.16 * prefs.buttonSize,
      (available - joystick - 28) / 4.4,
    ),
  );
  const scale = unit / 60;
  const target = (
    action: TouchAction,
    x: number,
    y: number,
    size: number,
  ): TouchTarget => ({
    action,
    x: x * scale,
    y: y * scale,
    size: Math.max(44, size * scale),
  });
  return {
    compact,
    joystick: compact ? Math.min(joystick, 88) : joystick,
    width: 260 * scale,
    height: 180 * scale,
    targets: [
      target("0", 46, 48, 60),
      target("1", 130, 30, 60),
      target("2", 214, 48, 60),
      target("attack", 130, 110, 88),
      target("dash", 30, 150, 48),
      target("jump", 230, 150, 48),
    ],
  };
}

export function safeViewport(
  width: number,
  height: number,
  insets: { top: number; right: number; bottom: number; left: number },
) {
  return {
    width: Math.max(
      0,
      width - Math.max(0, insets.left) - Math.max(0, insets.right) - 24,
    ),
    height: Math.max(
      0,
      height - Math.max(0, insets.top) - Math.max(0, insets.bottom) - 24,
    ),
  };
}

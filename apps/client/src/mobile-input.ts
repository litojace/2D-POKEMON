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
export type TouchAction = "attack" | "dash" | "jump" | "0" | "1" | "2" | "3";
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
  if (available < 600 && height < 500) {
    const short = height < 310;
    const compactJoystick = Math.min(
      joystick,
      Math.max(short ? 72 : 88, height * (short ? 0.23 : 0.28)),
    );
    const size = Math.max(
      44,
      Math.min(
        50,
        44 * prefs.buttonSize,
        (available - compactJoystick - 32) / 7.41,
      ),
    );
    const scale = size / 44;
    const target = (
      action: TouchAction,
      x: number,
      y: number,
      size: number,
    ): TouchTarget => ({
      action,
      x: x * scale,
      y: y * scale,
      size: size * scale,
    });
    return {
      compact: true,
      joystick: compactJoystick,
      width: 270 * scale,
      height: (short ? 92 : 100) * scale,
      targets: [
        target("0", 28, short ? 22 : 26, 44),
        target("1", 84, short ? 22 : 26, 44),
        target("2", 140, short ? 22 : 26, 44),
        target("3", 28, short ? 70 : 78, 44),
        target("attack", 220, short ? 47 : 51, 88),
        target("dash", 84, short ? 70 : 78, 44),
        target("jump", 140, short ? 70 : 78, 44),
      ],
    };
  }
  const unit = Math.max(
    44,
    Math.min(
      64,
      height * 0.15 * prefs.buttonSize,
      (available - joystick - 32) / 4.4,
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
    compact: false,
    joystick,
    width: 262 * scale,
    height: Math.max(253 * scale, 225 * scale + 22),
    targets: [
      // Four skills curve around the large basic attack button.
      target("0", 34, 196, 60),
      target("1", 40, 118, 60),
      target("2", 94, 56, 60),
      target("3", 168, 34, 60),
      target("attack", 160, 170, 88),
      target("dash", 225, 100, 48),
      target("jump", 230, 225, 48),
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

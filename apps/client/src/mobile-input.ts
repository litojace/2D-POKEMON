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
/** Below this share of the ring's radius the stick is neutral (a resting thumb). */
export const JOYSTICK_DEAD = 0.12;
/** From this share of the radius the fighter runs at full speed. */
export const JOYSTICK_FULL = 0.55;
/** The speed at the first push past the dead zone, so it moves at once. */
const JOYSTICK_START = 0.35;
/**
 * Movement from the thumb's offset. A thumb rarely pushes to the rim on a
 * phone, and speed proportional to the push made half a push feel like half
 * speed (laggy); full speed is reached at about half the radius instead.
 */
export function joystickVector(x: number, y: number, radius: number) {
  const length = Math.hypot(x, y);
  if (
    radius <= 0 ||
    !Number.isFinite(length) ||
    length < radius * JOYSTICK_DEAD
  )
    return { dx: 0, dy: 0 };
  const t = Math.min(
    1,
    (length / radius - JOYSTICK_DEAD) / (JOYSTICK_FULL - JOYSTICK_DEAD),
  );
  const speed = JOYSTICK_START + (1 - JOYSTICK_START) * t;
  return { dx: (x / length) * speed, dy: (y / length) * speed };
}
/** Where the knob sits: under the thumb, kept inside the ring. */
export function joystickKnob(x: number, y: number, radius: number) {
  const length = Math.hypot(x, y);
  if (!Number.isFinite(length) || length === 0 || radius <= 0)
    return { x: 0, y: 0 };
  const k = Math.min(1, radius / length);
  return { x: x * k, y: y * k };
}
export type TouchAction = "attack" | "dash" | "jump" | "0" | "1" | "2" | "3";
export class TouchInputState {
  dx = 0;
  dy = 0;
  /** The knob's offset in pixels (follows the thumb; speed follows dx/dy). */
  knobX = 0;
  knobY = 0;
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
    if (id === this.joystickPointer) {
      Object.assign(this, joystickVector(x, y, radius));
      const knob = joystickKnob(x, y, radius);
      this.knobX = knob.x;
      this.knobY = knob.y;
    }
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
      this.dx = this.dy = this.knobX = this.knobY = 0;
    }
  }
  reset() {
    this.joystickPointer = null;
    this.pointers.clear();
    this.dx = this.dy = this.knobX = this.knobY = 0;
  }
}
export interface TouchTarget {
  action: TouchAction;
  x: number;
  y: number;
  size: number;
  iconSize?: number;
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
      height: (short ? 96 : 102) * scale,
      targets: [
        target("0", 28, short ? 22 : 26, 44),
        target("1", 84, short ? 22 : 26, 44),
        target("2", 140, short ? 22 : 26, 44),
        target("3", 28, short ? 70 : 78, 44),
        target("attack", 220, short ? 47 : 51, 88),
        target("dash", 84, short ? 72 : 78, 48),
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
  // One even ring around the basic attack, like a console MOBA: skills 1–3
  // low-left to top, then the ultimate, Dash and Jump down the right. Every
  // button keeps the same gap to the attack button and to its neighbours.
  const DESIGN: [TouchAction, number][] = [
    ["attack", 104],
    ["0", 68],
    ["1", 68],
    ["2", 68],
    ["3", 72],
    ["dash", 60],
    ["jump", 60],
  ];
  const ringOf = (sizes: number[], gap: number) => {
    const [attack, ...rest] = sizes;
    // Skill 1 sits low on the left; the rest follow clockwise (screen y down).
    // Started at 142° so the ultimate, Dash and Jump sit high enough for the
    // right thumb.
    let angle = (142 * Math.PI) / 180;
    let previous: { d: number; r: number } | undefined;
    const placed = [{ x: 0, y: 0, size: attack }];
    for (const size of rest) {
      const r = size / 2,
        d = attack / 2 + r + gap;
      if (previous) {
        // Law of cosines: the step that leaves exactly `gap` to the last one.
        const want = previous.r + r + gap;
        angle += Math.acos(
          Math.min(
            1,
            (previous.d ** 2 + d ** 2 - want ** 2) / (2 * previous.d * d),
          ),
        );
      }
      previous = { d, r };
      placed.push({ x: d * Math.cos(angle), y: d * Math.sin(angle), size });
    }
    const left = Math.min(...placed.map((b) => b.x - b.size / 2)),
      top = Math.min(...placed.map((b) => b.y - b.size / 2)),
      right = Math.max(...placed.map((b) => b.x + b.size / 2)),
      bottom = Math.max(...placed.map((b) => b.y + b.size / 2));
    return { placed, left, top, width: right - left, height: bottom - top };
  };
  const GAP = 14,
    MARGIN = 6;
  const design = ringOf(
    DESIGN.map(([, size]) => size),
    GAP,
  );
  // Height includes the HUD allowance removed by TouchControls.
  const scale = Math.max(
    44 / 68,
    Math.min(
      0.94 * prefs.buttonSize,
      ((height + 88) / 390) * 0.88 * prefs.buttonSize,
      (available - joystick - 32) / (design.width + 2 * MARGIN),
    ),
  );
  // Real sizes (small screens keep 44 px touch targets, 48 for Dash and Jump), then
  // the ring again at real size so the gaps stay even after that floor.
  const sizes = DESIGN.map(([action, size]) =>
    Math.max(action === "dash" || action === "jump" ? 48 : 44, size * scale),
  );
  const ring = ringOf(sizes, GAP * scale);
  const margin = MARGIN * scale;
  const iconSize = (action: TouchAction) =>
    // Grow the touch circle without enlarging the established icon artwork.
    action === "attack"
      ? Math.max(1, (unit / 60) * 88 - 15) * 0.5
      : action === "dash" || action === "jump"
        ? (Math.max(44, (unit / 60) * 48) - 15) * 0.56
        : Math.max(1, unit - 15) * 0.56;
  const targets: TouchTarget[] = DESIGN.map(([action], i) => ({
    action,
    x: ring.placed[i].x - ring.left + margin,
    y: ring.placed[i].y - ring.top + margin,
    size: sizes[i],
    iconSize: iconSize(action),
  }));
  const order: TouchAction[] = ["0", "1", "2", "3", "attack", "dash", "jump"];
  return {
    compact: false,
    joystick,
    width: ring.width + 2 * margin,
    height: ring.height + 2 * margin,
    targets: order.map((action) => targets.find((t) => t.action === action)!),
  };
}

/**
 * The length (CSS px) to size touch controls from: the larger of the visual
 * viewport and the window. The visual viewport alone shrinks while the
 * on-screen keyboard is open or the page is zoomed in, which is not the
 * screen the battle fills.
 */
export function controlExtent(visual: number | undefined, window: number) {
  return Math.max(visual ?? 0, window);
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

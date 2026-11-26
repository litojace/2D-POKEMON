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
/**
 * How the skills sit round the basic attack on a phone (not the compact
 * fallback for very small screens):
 *
 * - "corner": the basic attack in the bottom-right corner, as in a mobile
 *   MOBA; skills 1–3 on one arc round it (left to straight up), and the
 *   ultimate, Dash and Jump each nestled in a gap outside that arc.
 * - "ring": one even ring round the basic attack, Dash and Jump on its
 *   right (the layout approved on 16 Nov 2026).
 *
 * The owner asked to play with "corner" for a while (26 Nov 2026), with
 * drag-to-aim. Going back is this one line.
 */
export type CombatLayoutStyle = "corner" | "ring";
export const COMBAT_LAYOUT: CombatLayoutStyle = "corner";
/** Placed circles (`size` across) round the basic attack at (0, 0), and their box. */
type Placed = {
  placed: { x: number; y: number; size: number }[];
  left: number;
  top: number;
  width: number;
  height: number;
};
function boxOf(placed: Placed["placed"]): Placed {
  const left = Math.min(...placed.map((b) => b.x - b.size / 2)),
    top = Math.min(...placed.map((b) => b.y - b.size / 2)),
    right = Math.max(...placed.map((b) => b.x + b.size / 2)),
    bottom = Math.max(...placed.map((b) => b.y + b.size / 2));
  return { placed, left, top, width: right - left, height: bottom - top };
}
/**
 * A circle `size` across that keeps exactly `gap` to both `a` and `b`, on
 * the side away from the basic attack at (0, 0) (screen y down).
 */
function nestle(
  a: { x: number; y: number; size: number },
  b: { x: number; y: number; size: number },
  size: number,
  gap: number,
) {
  const ra = a.size / 2 + size / 2 + gap,
    rb = b.size / 2 + size / 2 + gap;
  const dx = b.x - a.x,
    dy = b.y - a.y,
    d = Math.hypot(dx, dy);
  const along = (ra * ra - rb * rb + d * d) / (2 * d),
    across = Math.sqrt(Math.max(0, ra * ra - along * along));
  const mx = a.x + (dx * along) / d,
    my = a.y + (dy * along) / d;
  const one = { x: mx - (dy * across) / d, y: my + (dx * across) / d, size },
    two = { x: mx + (dy * across) / d, y: my - (dx * across) / d, size };
  return Math.hypot(one.x, one.y) > Math.hypot(two.x, two.y) ? one : two;
}
/**
 * The corner layout, in DESIGN order (attack, 1, 2, 3, ultimate, Dash,
 * Jump): skills 1–3 keep one gap to the basic attack and to each other,
 * from straight left round to straight up, so nothing passes the basic
 * attack's right edge and it can sit in the corner. The ultimate takes the
 * gap outside skills 1 and 2, Dash the one outside 2 and 3, Jump the one
 * below the ultimate.
 */
function cornerOf(sizes: number[], gap: number): Placed {
  const [attack, s1, s2, s3, ult, dash, jump] = sizes;
  const basic = { x: 0, y: 0, size: attack };
  const d = attack / 2 + s1 / 2 + gap;
  let angle = Math.PI;
  const skills = [s1, s2, s3].map((size, i, all) => {
    if (i) {
      const chord = (all[i - 1] + size) / 2 + gap;
      angle += 2 * Math.asin(Math.min(1, chord / 2 / d));
    }
    return { x: d * Math.cos(angle), y: d * Math.sin(angle), size };
  });
  const ultimate = nestle(skills[0], skills[1], ult, gap);
  return boxOf([
    basic,
    ...skills,
    ultimate,
    nestle(skills[1], skills[2], dash, gap),
    nestle(skills[0], ultimate, jump, gap),
  ]);
}
export function mobileLayout(
  width: number,
  height: number,
  prefs: ControlPreferences = DEFAULT_CONTROLS,
  style: CombatLayoutStyle = COMBAT_LAYOUT,
) {
  const available = Math.max(280, width);
  const joystick = Math.max(
    88,
    Math.min(
      164,
      Math.min(height * 0.46, available * 0.25) * prefs.joystickSize,
    ),
  );
  if (available < 600 && height < 500) {
    const short = height < 310;
    const compactJoystick = Math.min(
      joystick,
      Math.max(short ? 80 : 96, height * (short ? 0.29 : 0.34)),
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
    const attackY = short ? 47 : 51;
    const targets = [
      target("0", 28, short ? 22 : 26, 44),
      target("1", 84, short ? 22 : 26, 44),
      target("2", 140, short ? 22 : 26, 44),
      target("3", 28, short ? 70 : 78, 44),
      target("attack", 220, attackY, 88),
      target("dash", 84, short ? 72 : 78, 48),
      target("jump", 140, short ? 70 : 78, 44),
    ];
    // The target button: over the basic attack, past the cluster's top.
    const aim = {
      x: 220 * scale,
      y: (attackY - 44 - 10 - 22) * scale,
      size: 44 * scale,
    };
    return {
      compact: true,
      joystick: compactJoystick,
      width: 270 * scale,
      height: (short ? 96 : 102) * scale,
      targets,
      aim,
      context: contextPair(
        aim,
        targets,
        44 * scale,
        10 * scale,
        (short ? 96 : 102) * scale - height,
      ),
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
  const ringOf = (sizes: number[], gap: number): Placed => {
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
    return boxOf(placed);
  };
  const place = style === "corner" ? cornerOf : ringOf;
  const GAP = 14,
    MARGIN = 6;
  const design = place(
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
  // the layout again at real size so the gaps stay even after that floor.
  const sizes = DESIGN.map(([action, size]) =>
    Math.max(action === "dash" || action === "jump" ? 48 : 44, size * scale),
  );
  const ring = place(sizes, GAP * scale);
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
  // The target button, at the cluster's right edge. It may sit above the
  // cluster's box (negative y): the court's free top-right corner. While a
  // skill is dragged it turns into the cancel spot (touch-controls.ts).
  const aimSize = Math.max(44, 52 * scale);
  const gap = GAP * scale;
  const aimX = ring.width + 2 * margin - margin - aimSize / 2;
  /** The lowest centre over `t` that keeps the gap to it (Infinity: not in the way). */
  const over = (t: TouchTarget) => {
    const clear = t.size / 2 + aimSize / 2 + gap,
      dx = Math.abs(aimX - t.x);
    return dx < clear ? t.y - Math.sqrt(clear ** 2 - dx ** 2) : Infinity;
  };
  const dash = targets.find((t) => t.action === "dash")!;
  const aimY =
    style === "corner"
      ? // Corner: over the basic attack and skill 3, lifted clear of every
        // button (Dash sits up and to the left).
        Math.min(...targets.map(over))
      : // Ring: over Dash, where the right thumb reaches up from Dash and
        // Jump, and high enough to keep the ring's gap to the ultimate
        // (which tops the ring, left of Dash).
        Math.min(
          dash.y - dash.size / 2 - gap - aimSize / 2,
          over(targets.find((t) => t.action === "3")!),
        );
  const aim = { x: aimX, y: aimY, size: aimSize };
  const clusterHeight = ring.height + 2 * margin;
  return {
    compact: false,
    joystick,
    width: ring.width + 2 * margin,
    height: ring.height + 2 * margin,
    targets: order.map((action) => targets.find((t) => t.action === action)!),
    aim,
    context: contextPair(
      aim,
      targets,
      Math.max(44, 52 * scale),
      gap,
      clusterHeight - height,
    ),
  };
}

/** Room under a contextual button for its name (CSS px). */
const CONTEXT_LABEL = 12;
/**
 * A boss's two contextual actions (Turn mirror, Look away), side by side in
 * the court's free top-right corner: left of the target button, level with
 * it, and lifted over any cluster button below them with room for their
 * names (owner, 24 Nov 2026: both always showing, up there, not one at a
 * time by skill 1). They never rise past `minTop` (the cluster's y of the
 * HUD's allowance: a squat screen's boss bar is just above); where lifting
 * would, they stay level with the target button and slide left until clear.
 * `x`/`y` are the pair's centre; `size` is one button.
 */
function contextPair(
  aim: { x: number; y: number; size: number },
  targets: readonly TouchTarget[],
  size: number,
  gap: number,
  minTop: number,
) {
  // Between the two: room for their names (about 50 px at 9 px type).
  const between = Math.max(gap, 18);
  const width = 2 * size + between;
  const clearAt = (x: number, y: number) =>
    targets.every(
      (t) =>
        Math.abs(t.x - x) >= width / 2 + t.size / 2 + gap ||
        y + size / 2 + CONTEXT_LABEL + gap <= t.y - t.size / 2,
    );
  let x = aim.x - aim.size / 2 - gap - width / 2;
  let y = aim.y;
  for (const t of targets)
    if (Math.abs(t.x - x) < width / 2 + t.size / 2 + gap)
      y = Math.min(y, t.y - t.size / 2 - gap - CONTEXT_LABEL - size / 2);
  if (y - size / 2 < minTop) {
    y = Math.max(aim.y, minTop + size / 2);
    while (!clearAt(x, y) && x > -2 * width) x -= 4;
  }
  return { x, y, size, width, height: size };
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

import {
  RAID_ATTACKS,
  type RaidState,
} from "../../../packages/shared/src/raid";
import { PRISMATAIL } from "../../../packages/shared/src/raid-prismatail";
import type { CameraView } from "./follow-camera";

/** Fit the entire raid below its HUD, uniformly and without following a raider. */
export function raidCameraView(
  width: number,
  height: number,
  hudBottom = 0,
): CameraView {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const top = Math.max(0, Math.min(height - 1, hudBottom));
  const zoom = Math.min(width / 1600, (height - top) / 900);
  return {
    x: 800,
    y: 450 - top / (2 * zoom),
    zoomX: zoom,
    zoomY: zoom,
    fighterX: 1,
    fighterY: 1,
  };
}

/**
 * Phones in landscape follow their raider (owner, 20 Nov 2026: the whole
 * court made fighters tiny and easy to lose). The court covers the space
 * below the HUD, then this much closer: the same magnification as mobile PvP.
 */
export const RAID_FOLLOW_ZOOM = 1.2;
/** How far the view leans from the raider toward the boss (0: none, 1: centred on it). */
export const RAID_BOSS_PULL = 0.35;
/** The raider stays inside this share of the visible half-width/height. */
const RAIDER_MARGIN = 0.62;
/** Any warning this wide (world px) is a court-wide answer, whatever its kind. */
export const RAID_WIDE_RADIUS = 400;
/** Seconds the whole court stays in view after the last court-wide warning. */
const WIDE_HOLD = 0.5;

type Point = { x: number; y: number };
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));

/**
 * Does the raid need the whole court in view right now? A court-wide warning
 * (RAID_ATTACKS[kind].view, or any warning RAID_WIDE_RADIUS across), or a
 * running mechanic whose answer may be anywhere: a dream's rune pads, the
 * moving Quiet Zone, polarity partners, Mirror Charge's twins, the braziers
 * that bring an airborne Lumiwick down.
 */
export function raidWantsCourt(raid: RaidState, now: number) {
  if (
    raid.warnings.some(
      (w) =>
        RAID_ATTACKS[w.kind]?.view === "court" || w.radius >= RAID_WIDE_RADIUS,
    )
  )
    return true;
  if (raid.dream && raid.dream.until > now) return true;
  if (raid.quietZone && raid.quietZone.until > now) return true;
  if (raid.polarities?.some((p) => !p.cancelled && p.until > now)) return true;
  if (raid.polarityPad && raid.polarityPad.until > now) return true;
  if (raid.stormMirror && raid.stormMirror.until > now) return true;
  // Prismatail's light relay: windows, mirrors and heart make one puzzle.
  if (raid.mirrors?.length) return true;
  // Lumiwick aloft: the brazier triangle is the whole fight until it lands.
  if (raid.airborne && raid.braziers?.length) return true;
  return false;
}

/** A spot on the court that must stay readable (world px, a centre and radius). */
export interface FrameMark {
  x: number;
  y: number;
  r: number;
}
/** A world rectangle the camera should show (the court is 1600 × 900). */
export interface FrameBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  /**
   * The middles of the marked warnings and their safe spots: kept clear of
   * the touch controls when the camera frames the moment.
   */
  marks?: FrameMark[];
}
/** A screen rectangle a touch control covers (game px, like the view). */
export interface ScreenRect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Room kept round everything framed (world px): a fighter's art and name. */
const FRAME_PAD = 70;
/**
 * Share of the screen's width kept clear on each side when framing: the
 * joystick and the skill buttons sit at the edges.
 */
const FRAME_SIDE = 0.07;
/** Warnings that sweep the whole court whatever their marked geometry. */
const SWEEPS = new Set(["breaker", "wave"]);
/**
 * The share of a warning's radius that must stay clear of the controls: its
 * middle, where the icon, the order dots and a pool's crescent are drawn.
 */
export const FRAME_CORE = 0.65;

/**
 * What a court-wide moment needs in view: every raider and boss, every
 * marked warning, and the pieces its answer lies on (rune pads, islands,
 * mirrors and skylights, braziers, the Quiet Zone, the polarity pad,
 * lanterns and moonlight). The camera frames just that, so fighters stay as
 * large as the moment allows; when the pieces span the court, it is the
 * whole court. Undefined when nothing court-wide is going on.
 */
export function raidFrame(
  raid: RaidState,
  now: number,
  people: readonly Point[],
): FrameBox | undefined {
  if (!raidWantsCourt(raid, now)) return undefined;
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  const add = (x: number, y: number, r = 0) => {
    x0 = Math.min(x0, x - r);
    y0 = Math.min(y0, y - r);
    x1 = Math.max(x1, x + r);
    y1 = Math.max(y1, y + r);
  };
  const whole = { x0: 0, y0: 0, x1: 1600, y1: 900 };
  for (const p of people) add(p.x, p.y, FRAME_PAD);
  const kinds = new Set(raid.warnings.map((w) => w.kind));
  const marks: FrameMark[] = [];
  for (const w of raid.warnings) {
    if (SWEEPS.has(w.kind)) return whole;
    const r = Math.min(w.radius, 900) + FRAME_PAD / 2;
    add(w.x, w.y, r);
    add(w.tx, w.ty, r);
    // A court-wide warning covers the controls whatever the camera does.
    if (w.radius > 0 && w.radius < RAID_WIDE_RADIUS) {
      marks.push({ x: w.x, y: w.y, r: w.radius * FRAME_CORE });
      if (Math.hypot(w.tx - w.x, w.ty - w.y) > 1)
        marks.push({ x: w.tx, y: w.ty, r: w.radius * FRAME_CORE });
    }
    for (const pool of w.pools ?? []) {
      add(pool.x, pool.y, pool.radius);
      marks.push({ x: pool.x, y: pool.y, r: pool.radius * FRAME_CORE });
    }
  }
  const dreaming =
    (raid.dream && raid.dream.until > now) ||
    kinds.has("dream-sequence") ||
    kinds.has("twin-dream") ||
    kinds.has("dream-tide");
  // A dream's rune pads sit where the dream panel leaves them clear of the
  // whole-court view: keep that view while a dream runs.
  if (dreaming) return whole;
  if (raid.quietZone && raid.quietZone.until > now)
    add(raid.quietZone.x, raid.quietZone.y, raid.quietZone.radius + FRAME_PAD);
  if (raid.polarityPad && raid.polarityPad.until > now)
    add(raid.polarityPad.x, raid.polarityPad.y, FRAME_PAD * 1.5);
  if (raid.mirrors?.length) {
    for (const m of raid.mirrors) add(m.x, m.y, FRAME_PAD);
    for (const l of raid.lightSources ?? [PRISMATAIL.source])
      add(l.x, l.y, FRAME_PAD);
  }
  if (
    raid.braziers?.length &&
    (raid.airborne || kinds.has("snuff-gale") || kinds.has("bound-wicks"))
  )
    for (const b of raid.braziers) add(b.x, b.y, FRAME_PAD * 1.5);
  if (
    raid.islands?.length &&
    (kinds.has("hightide") || kinds.has("dive") || (raid.floodUntil ?? 0) > now)
  )
    for (const i of raid.islands)
      if (!i.sunk) add(i.x, i.y, i.radius + FRAME_PAD / 2);
  if (kinds.has("nightfall")) {
    for (const l of raid.lanterns ?? []) add(l.x, l.y, FRAME_PAD);
    for (const l of raid.lights ?? []) add(l.x, l.y, l.radius);
  }
  if (!Number.isFinite(x0)) return whole;
  return {
    x0: Math.max(0, x0),
    y0: Math.max(0, y0),
    x1: Math.min(1600, x1),
    y1: Math.min(900, y1),
    ...(marks.length ? { marks } : {}),
  };
}

/**
 * How much of the screen the touch controls cover at each side (game px):
 * the joystick's right edge from the left, the skill buttons' left edge from
 * the right. Measured when the battle is laid out (never per frame).
 */
export interface ControlSides {
  left: number;
  right: number;
}
const NO_SIDES: ControlSides = { left: 0, right: 0 };
/** Room kept between your raider and the controls (world px, about a fighter's half-width). */
const CONTROL_PAD = 55;

/**
 * The camera centres (world x) that put `p` on screen between the controls
 * at this zoom, with CONTROL_PAD to spare.
 */
function clearBand(
  p: number,
  zoom: number,
  width: number,
  sides: ControlSides,
): [number, number] {
  const pad = CONTROL_PAD * zoom;
  return [
    p - (width / 2 - sides.right - pad) / zoom,
    p + (width / 2 - sides.left - pad) / zoom,
  ];
}
/** Is this screen x (game px) under the joystick's or the skill buttons' column? */
export function underControls(x: number, width: number, sides: ControlSides) {
  return (
    (sides.left > 0 && x < sides.left) ||
    (sides.right > 0 && x > width - sides.right)
  );
}
/** The court's edges may scroll past the screen's edges this far (screen px), so a raider at a wall can still stand clear of the controls. */
function apronFor(sides: ControlSides, zoom: number): ControlSides {
  const pad = CONTROL_PAD * zoom;
  return {
    left: sides.left ? sides.left + pad : 0,
    right: sides.right ? sides.right + pad : 0,
  };
}

/** The follow zoom: the court covers the space below the HUD, then RAID_FOLLOW_ZOOM. */
function followZoom(width: number, height: number, top: number) {
  return Math.max(width / 1600, (height - top) / 900) * RAID_FOLLOW_ZOOM;
}

/**
 * Keep a camera centre (world) inside the court at this zoom: the court's
 * top edge may come no lower than the HUD's bottom, and where the court is
 * smaller than the view it is centred in the space below the HUD.
 */
function clampCentre(
  c: Point,
  zoom: number,
  width: number,
  height: number,
  top: number,
  /** Screen px the court's left/right edges may scroll in from the screen's. */
  apron: ControlSides = NO_SIDES,
): Point {
  const halfW = width / zoom / 2;
  // The visible world below the HUD, as a centre and half-height.
  const halfVis = (height - top) / zoom / 2,
    lift = top / zoom / 2;
  const x =
    halfW >= 800
      ? 800
      : clamp(
          c.x,
          halfW - apron.left / zoom,
          1600 - halfW + apron.right / zoom,
        );
  const visY = halfVis >= 450 ? 450 : clamp(c.y + lift, halfVis, 900 - halfVis);
  return { x, y: visY - lift };
}

/**
 * Where the follow camera aims: the raider (and where they're heading),
 * leaning toward the boss, but never so far that the raider nears the edge.
 * On a phone the raider always stands clear of the joystick and the skill
 * buttons (the court may scroll past the screen's edge for it), and the boss
 * does too when both fit.
 */
export function raidFollowCentre(
  width: number,
  height: number,
  top: number,
  zoom: number,
  raider: Point,
  ahead: Point,
  boss?: Point,
  sides: ControlSides = NO_SIDES,
): Point {
  const lift = top / zoom / 2;
  const halfW = width / zoom / 2,
    halfVis = (height - top) / zoom / 2;
  const fx = raider.x + ahead.x,
    fy = raider.y + ahead.y;
  // The point the visible area (below the HUD) centres on.
  let vx = boss ? fx + (boss.x - fx) * RAID_BOSS_PULL : fx;
  let vy = boss ? fy + (boss.y - fy) * RAID_BOSS_PULL : fy;
  let [lo, hi] = clearBand(raider.x, zoom, width, sides);
  lo = Math.max(lo, raider.x - halfW * RAIDER_MARGIN);
  hi = Math.min(hi, raider.x + halfW * RAIDER_MARGIN);
  if (boss) {
    // The boss clear of the controls too, where that keeps the raider clear.
    const [blo, bhi] = clearBand(boss.x, zoom, width, sides);
    if (Math.max(lo, blo) <= Math.min(hi, bhi)) vx = clamp(vx, blo, bhi);
  }
  vx = lo <= hi ? clamp(vx, lo, hi) : raider.x;
  vy = clamp(
    vy,
    raider.y - halfVis * RAIDER_MARGIN,
    raider.y + halfVis * RAIDER_MARGIN,
  );
  return clampCentre(
    { x: vx, y: vy - lift },
    zoom,
    width,
    height,
    top,
    apronFor(sides, zoom),
  );
}

/**
 * A court-wide moment's view: the frame between FRAME_SIDE margins and, on a
 * phone, your raider clear of the controls; as close as both allow (never
 * past `most`, never further out than `least`). Returns the zoom and the
 * camera's world x.
 */
export function raidFrameView(
  box: FrameBox,
  width: number,
  least: number,
  most: number,
  raider: Point | undefined,
  sides: ControlSides = NO_SIDES,
): { zoom: number; x: number } {
  const mid = (box.x0 + box.x1) / 2;
  const side = width * FRAME_SIDE;
  const band = (zoom: number): [number, number] => {
    let lo = box.x1 - (width / 2 - side) / zoom,
      hi = box.x0 + (width / 2 - side) / zoom;
    if (raider && (sides.left || sides.right)) {
      const [rlo, rhi] = clearBand(raider.x, zoom, width, sides);
      lo = Math.max(lo, rlo);
      hi = Math.min(hi, rhi);
    }
    return [lo, hi];
  };
  const fits = (zoom: number) => {
    const [lo, hi] = band(zoom);
    return lo <= hi;
  };
  let zoom = most;
  if (!fits(most)) {
    if (!fits(least)) return { zoom: most, x: mid };
    let a = least,
      b = most;
    for (let i = 0; i < 24; i++) {
      const m = (a + b) / 2;
      if (fits(m)) a = m;
      else b = m;
    }
    zoom = a;
  }
  const [lo, hi] = band(zoom);
  return { zoom, x: clamp(mid, lo, hi) };
}

/** Zooms tried, from the framed zoom out to the overview's, to clear the controls. */
const PLACE_ZOOMS = 6;
/** Pans tried across the room the frame leaves (across × down). */
const PLACE_ACROSS = 9,
  PLACE_DOWN = 5;

/** How many marks a view at this centre and zoom hides (off screen or under a control). */
function hiddenMarks(
  marks: readonly FrameMark[],
  controls: readonly ScreenRect[],
  c: Point,
  zoom: number,
  width: number,
  height: number,
  top: number,
) {
  let hidden = 0;
  for (const m of marks) {
    const x = (m.x - c.x) * zoom + width / 2,
      y = (m.y - c.y) * zoom + height / 2,
      r = m.r * zoom;
    if (x - r < 0 || x + r > width || y - r < top || y + r > height) {
      hidden++;
      continue;
    }
    for (const b of controls) {
      const dx = Math.max(b.x0 - x, 0, x - b.x1),
        dy = Math.max(b.y0 - y, 0, y - b.y1);
      if (dx * dx + dy * dy < r * r) {
        hidden++;
        break;
      }
    }
  }
  return hidden;
}

/**
 * Where to frame a court-wide moment. First raidFrameView's view (the box in
 * view, your raider clear of the controls' columns). If that leaves a mark (a
 * warning's middle, a safe spot) under a touch control, the camera pans
 * across the room the box leaves and, if need be, pulls out (never past the
 * overview), still keeping your raider clear, to the closest view that hides
 * the fewest marks. Shared data, no per-boss placement.
 */
export function raidFramePlacement(
  box: FrameBox,
  width: number,
  height: number,
  top: number,
  /** raidFrameView's zoom and camera x. */
  fitted: { zoom: number; x: number },
  /** The overview's zoom: never further out. */
  floor: number,
  controls: readonly ScreenRect[],
  raider?: Point,
  sides: ControlSides = NO_SIDES,
): { x: number; y: number; zoom: number } {
  const midY = (zoom: number) => (box.y0 + box.y1) / 2 - top / zoom / 2;
  const centre = (x: number, y: number, zoom: number) =>
    clampCentre({ x, y }, zoom, width, height, top, apronFor(sides, zoom));
  const fit = fitted.zoom;
  const first = { ...centre(fitted.x, midY(fit), fit), zoom: fit };
  const marks = box.marks ?? [];
  if (!marks.length || !controls.length) return first;
  let best = first,
    bestHidden = hiddenMarks(marks, controls, first, fit, width, height, top),
    bestMove = 0;
  if (!bestHidden) return first;
  const side = width * FRAME_SIDE;
  const keepRaider = !!raider && !!(sides.left || sides.right);
  for (let i = 0; i <= PLACE_ZOOMS; i++) {
    const zoom =
      fit > floor ? fit * Math.pow(floor / fit, i / PLACE_ZOOMS) : fit;
    // Centres that keep the whole box in view (beside the side margins,
    // below the HUD) and your raider clear of the controls' columns.
    let xLo = box.x1 - (width / 2 - side) / zoom,
      xHi = box.x0 + (width / 2 - side) / zoom;
    if (xLo > xHi) xLo = xHi = (xLo + xHi) / 2;
    if (keepRaider) {
      const [rlo, rhi] = clearBand(raider!.x, zoom, width, sides);
      xLo = Math.max(xLo, rlo);
      xHi = Math.min(xHi, rhi);
      if (xLo > xHi) continue;
    }
    let yLo = box.y1 - height / 2 / zoom,
      yHi = box.y0 + (height / 2 - top) / zoom;
    if (yLo > yHi) yLo = yHi = (yLo + yHi) / 2;
    const base = centre(
      clamp((box.x0 + box.x1) / 2, xLo, xHi),
      midY(zoom),
      zoom,
    );
    for (let a = 0; a < PLACE_ACROSS; a++)
      for (let d = 0; d < PLACE_DOWN; d++) {
        const c = centre(
          xLo + ((xHi - xLo) * a) / (PLACE_ACROSS - 1),
          yLo + ((yHi - yLo) * d) / (PLACE_DOWN - 1),
          zoom,
        );
        const hidden = hiddenMarks(
          marks,
          controls,
          c,
          zoom,
          width,
          height,
          top,
        );
        const move = Math.hypot(c.x - base.x, c.y - base.y);
        // Fewest hidden; then the closest zoom (tried first); then the
        // least pan from the box's middle.
        if (
          hidden < bestHidden ||
          (hidden === bestHidden && zoom === best.zoom && move < bestMove)
        ) {
          best = { ...c, zoom };
          bestHidden = hidden;
          bestMove = move;
        }
      }
    if (!bestHidden || fit <= floor) break;
  }
  return best;
}

export interface RaidCameraFocus extends Point {
  vx: number;
  vy: number;
}

/**
 * The raid camera. Desktop, portrait and reduced motion: the fixed overview
 * (raidCameraView). Landscape phones: follow the raider, leaning toward the
 * boss, and pull out to the whole court while a court-wide mechanic is
 * marked. Presentation only: combat stays in world coordinates.
 */
export class RaidCamera {
  private x = 800;
  private y = 450;
  private zoom = 0;
  private identity = "";
  private wideUntil = -Infinity;
  private frame: FrameBox | undefined;
  update(
    width: number,
    height: number,
    hudBottom: number,
    follow: boolean,
    focus: RaidCameraFocus | undefined,
    boss: Point | undefined,
    /** A court-wide moment's frame (raidFrame); undefined: none. */
    frame: FrameBox | undefined,
    key: string,
    /** Milliseconds since the last frame. */
    delta: number,
    /** Seconds, any clock (for the hold after a court-wide warning). */
    now: number,
    reduced: boolean,
    /** Phones: where the touch controls sit (ControlSides). */
    sides: ControlSides = NO_SIDES,
    /** Phones: each touch control's box (game px): framed marks stay clear. */
    controls: readonly ScreenRect[] = [],
  ): CameraView {
    width = Math.max(1, width);
    height = Math.max(1, height);
    const top = Math.max(0, Math.min(height - 1, hudBottom));
    const overview = raidCameraView(width, height, top);
    const snap = key !== this.identity || this.zoom <= 0;
    this.identity = key;
    if (frame) {
      this.wideUntil = now + WIDE_HOLD;
      this.frame = frame;
    }
    const close = follow && !reduced && !!focus && now >= this.wideUntil;
    if (!close && (!follow || reduced)) {
      this.x = overview.x;
      this.y = overview.y;
      this.zoom = overview.zoomX;
      return overview;
    }
    // A court-wide moment: frame what it needs, as close as that allows.
    const box = this.frame ?? { x0: 0, y0: 0, x1: 1600, y1: 900 };
    const fitted = raidFrameView(
      box,
      width,
      overview.zoomX,
      clamp(
        Math.min(
          (width * (1 - 2 * FRAME_SIDE)) / Math.max(1, box.x1 - box.x0),
          (height - top) / Math.max(1, box.y1 - box.y0),
        ),
        overview.zoomX,
        followZoom(width, height, top),
      ),
      focus,
      sides,
    );
    const placed = close
      ? undefined
      : raidFramePlacement(
          box,
          width,
          height,
          top,
          fitted,
          overview.zoomX,
          controls,
          focus,
          sides,
        );
    const targetZoom = placed ? placed.zoom : followZoom(width, height, top);
    const target = !placed
      ? raidFollowCentre(
          width,
          height,
          top,
          targetZoom,
          focus!,
          {
            x: clamp(focus!.vx * 0.16, -65, 65),
            y: clamp(focus!.vy * 0.16, -65, 65),
          },
          boss,
          sides,
        )
      : placed;
    const ms = clamp(delta, 0, 100);
    // Out to the court quickly (a warning is showing), back in gently.
    const zoomBlend = 1 - Math.exp(-ms / (close ? 420 : 140));
    const moveBlend = 1 - Math.exp(-ms / (close ? 180 : 140));
    if (snap) {
      this.zoom = targetZoom;
      this.x = target.x;
      this.y = target.y;
    } else {
      this.zoom += (targetZoom - this.zoom) * zoomBlend;
      this.x += (target.x - this.x) * moveBlend;
      this.y += (target.y - this.y) * moveBlend;
      // Settle exactly once there (a blend alone only ever gets closer).
      if (Math.abs(targetZoom - this.zoom) < 1e-4) this.zoom = targetZoom;
      if (Math.abs(target.x - this.x) < 0.05) this.x = target.x;
      if (Math.abs(target.y - this.y) < 0.05) this.y = target.y;
    }
    // Never past the overview's zoom, and never off the court at this zoom.
    this.zoom = Math.max(this.zoom, overview.zoomX);
    const c = clampCentre(
      { x: this.x, y: this.y },
      this.zoom,
      width,
      height,
      top,
      apronFor(sides, this.zoom),
    );
    this.x = c.x;
    this.y = c.y;
    return {
      x: this.x,
      y: this.y,
      zoomX: this.zoom,
      zoomY: this.zoom,
      fighterX: 1,
      fighterY: 1,
    };
  }
}

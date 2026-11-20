import {
  RAID_ATTACKS,
  type RaidState,
} from "../../../packages/shared/src/raid";
import { PRISMATAIL } from "../../../packages/shared/src/raid-prismatail";
import { somnaraPads } from "../../../packages/shared/src/raid-somnara";
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

/** A world rectangle the camera should show (the court is 1600 × 900). */
export interface FrameBox {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
/** Room kept round everything framed (world px): a fighter's art and name. */
const FRAME_PAD = 70;
/** Warnings that sweep the whole court whatever their marked geometry. */
const SWEEPS = new Set(["breaker", "wave"]);

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
  for (const w of raid.warnings) {
    if (SWEEPS.has(w.kind)) return whole;
    const r = Math.min(w.radius, 900) + FRAME_PAD / 2;
    add(w.x, w.y, r);
    add(w.tx, w.ty, r);
    for (const pool of w.pools ?? []) add(pool.x, pool.y, pool.radius);
  }
  const dreaming =
    (raid.dream && raid.dream.until > now) ||
    kinds.has("dream-sequence") ||
    kinds.has("twin-dream") ||
    kinds.has("dream-tide");
  if (dreaming)
    for (const pad of somnaraPads(raid.variant)) add(pad.x, pad.y, FRAME_PAD);
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
    for (const i of raid.islands) if (!i.sunk) add(i.x, i.y, i.radius);
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
): Point {
  const halfW = width / zoom / 2;
  // The visible world below the HUD, as a centre and half-height.
  const halfVis = (height - top) / zoom / 2,
    lift = top / zoom / 2;
  const x = halfW >= 800 ? 800 : clamp(c.x, halfW, 1600 - halfW);
  const visY = halfVis >= 450 ? 450 : clamp(c.y + lift, halfVis, 900 - halfVis);
  return { x, y: visY - lift };
}

/**
 * Where the follow camera aims: the raider (and where they're heading),
 * leaning toward the boss, but never so far that the raider nears the edge.
 */
export function raidFollowCentre(
  width: number,
  height: number,
  top: number,
  zoom: number,
  raider: Point,
  ahead: Point,
  boss?: Point,
): Point {
  const lift = top / zoom / 2;
  const halfW = width / zoom / 2,
    halfVis = (height - top) / zoom / 2;
  const fx = raider.x + ahead.x,
    fy = raider.y + ahead.y;
  // The point the visible area (below the HUD) centres on.
  let vx = boss ? fx + (boss.x - fx) * RAID_BOSS_PULL : fx;
  let vy = boss ? fy + (boss.y - fy) * RAID_BOSS_PULL : fy;
  vx = clamp(
    vx,
    raider.x - halfW * RAIDER_MARGIN,
    raider.x + halfW * RAIDER_MARGIN,
  );
  vy = clamp(
    vy,
    raider.y - halfVis * RAIDER_MARGIN,
    raider.y + halfVis * RAIDER_MARGIN,
  );
  return clampCentre({ x: vx, y: vy - lift }, zoom, width, height, top);
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
    const framed = clamp(
      Math.min(
        width / Math.max(1, box.x1 - box.x0),
        (height - top) / Math.max(1, box.y1 - box.y0),
      ),
      overview.zoomX,
      followZoom(width, height, top),
    );
    const targetZoom = close ? followZoom(width, height, top) : framed;
    const target = close
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
        )
      : clampCentre(
          {
            x: (box.x0 + box.x1) / 2,
            // The box's middle in the space below the HUD.
            y: (box.y0 + box.y1) / 2 - top / framed / 2,
          },
          framed,
          width,
          height,
          top,
        );
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

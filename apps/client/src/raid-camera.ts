import {
  RAID_ATTACKS,
  type RaidState,
} from "../../../packages/shared/src/raid";
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
  // Lumiwick aloft: the brazier triangle is the whole fight until it lands.
  if (raid.airborne && raid.braziers?.length) return true;
  return false;
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
  update(
    width: number,
    height: number,
    hudBottom: number,
    follow: boolean,
    focus: RaidCameraFocus | undefined,
    boss: Point | undefined,
    wide: boolean,
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
    if (wide) this.wideUntil = now + WIDE_HOLD;
    const close = follow && !reduced && !!focus && now >= this.wideUntil;
    if (!close) {
      if (!follow || reduced || snap) {
        this.x = overview.x;
        this.y = overview.y;
        this.zoom = overview.zoomX;
        return overview;
      }
    }
    const targetZoom = close ? followZoom(width, height, top) : overview.zoomX;
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
      : { x: overview.x, y: overview.y };
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

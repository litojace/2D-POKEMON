import { arenaViewport } from "./arena-viewport";

export interface CameraFocus {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  attacking: boolean;
}
export interface CameraView {
  x: number;
  y: number;
  zoomX: number;
  zoomY: number;
  fighterX: number;
  fighterY: number;
}
const clamp = (n: number, lo: number, hi: number) =>
  Math.max(lo, Math.min(hi, n));
/** Presentation only. All combat and networking remain in authoritative world coordinates. */
export class FollowCamera {
  private x = 800;
  private y = 450;
  private zoom = 1;
  private identity = "";
  update(
    width: number,
    height: number,
    landscape: boolean,
    focus: CameraFocus | undefined,
    key: string,
    delta: number,
    reduced: boolean,
    /** World the view may show above the court (y < 0), e.g. its stands. */
    top = 0,
    /** Mobile PvP uses a wider field of view than solo practice. */
    focusZoom = 1.65,
    /** Decorative world below the playable court; does not change the zoom. */
    bottom = 0,
  ): CameraView {
    const base = arenaViewport(width, height, landscape, top);
    const snap = key !== this.identity;
    this.identity = key;
    const blend = 1 - Math.exp(-clamp(delta, 0, 100) / 180);
    const targetZoom = focus && !reduced ? focusZoom : 1;
    this.zoom =
      snap || reduced
        ? targetZoom
        : this.zoom + (targetZoom - this.zoom) * blend;
    const zoomX = base.zoomX * this.zoom,
      zoomY = base.zoomY * this.zoom;
    const halfW = Math.min(800, Math.max(1, width) / zoomX / 2);
    const halfH = Math.min(450 + (top + bottom) / 2, Math.max(1, height) / zoomY / 2);
    const aheadX = focus
      ? clamp(focus.vx * 0.16, -65, 65) +
        (focus.attacking ? Math.cos(focus.angle) * 45 : 0)
      : 0;
    const aheadY = focus
      ? clamp(focus.vy * 0.16, -65, 65) +
        (focus.attacking ? Math.sin(focus.angle) * 45 : 0)
      : 0;
    const tx = clamp(
      focus && !reduced ? focus.x + aheadX : 800,
      halfW,
      1600 - halfW,
    );
    const ty = clamp(
      focus && !reduced ? focus.y + aheadY : 450 - top / 2,
      halfH - top,
      900 + bottom - halfH,
    );
    this.x = snap || reduced ? tx : this.x + (tx - this.x) * blend;
    this.y = snap || reduced ? ty : this.y + (ty - this.y) * blend;
    this.x = clamp(this.x, halfW, 1600 - halfW);
    this.y = clamp(this.y, halfH - top, 900 + bottom - halfH);
    return {
      x: this.x,
      y: this.y,
      zoomX,
      zoomY,
      fighterX: base.fighterX,
      fighterY: base.fighterY,
    };
  }
}
export function screenToWorld(
  x: number,
  y: number,
  width: number,
  height: number,
  view: CameraView,
) {
  return {
    x: (x - width / 2) / view.zoomX + view.x,
    y: (y - height / 2) / view.zoomY + view.y,
  };
}
export function outsideView(
  x: number,
  y: number,
  width: number,
  height: number,
  view: CameraView,
) {
  return (
    Math.abs((x - view.x) * view.zoomX) > width / 2 - 24 ||
    Math.abs((y - view.y) * view.zoomY) > height / 2 - 24
  );
}

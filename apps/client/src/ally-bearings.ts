import { setHudStyle } from "./hud-dom";

export interface EdgeBox {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * Where a marker for an off-screen point sits: on the box's edge, along the
 * line from the box's centre toward the point (CSS px, like the point).
 */
export function edgeSpot(x: number, y: number, box: EdgeBox) {
  const cx = (box.left + box.right) / 2,
    cy = (box.top + box.bottom) / 2;
  const dx = x - cx,
    dy = y - cy;
  const angle = Math.atan2(dy, dx);
  const sx = dx ? (dx > 0 ? box.right - cx : box.left - cx) / dx : Infinity,
    sy = dy ? (dy > 0 ? box.bottom - cy : box.top - cy) / dy : Infinity;
  const s = Math.min(1, sx, sy);
  return { x: cx + dx * s, y: cy + dy * s, angle };
}

export interface AllyMark {
  id: string;
  /** Screen position (CSS px, relative to the arena box). */
  x: number;
  y: number;
  downed: boolean;
}

/**
 * Raid allies off a phone's follow camera: a small arrow in the allies' blue at
 * the screen's edge, pointing at them; a downed ally's pulses red with "!",
 * so a reviver knows where to run. Only allies off screen get one.
 */
export class AllyBearings {
  private marks = new Map<string, HTMLElement>();
  constructor(private parent: () => HTMLElement | null) {}
  update(allies: AllyMark[], box: EdgeBox) {
    const seen = new Set<string>();
    for (const ally of allies) {
      seen.add(ally.id);
      let mark = this.marks.get(ally.id);
      if (!mark) {
        const parent = this.parent();
        if (!parent) continue;
        mark = document.createElement("div");
        mark.className = "ally-bearing";
        mark.dataset.player = ally.id;
        mark.innerHTML = '<span aria-hidden="true"></span><b>!</b>';
        parent.append(mark);
        this.marks.set(ally.id, mark);
      }
      const spot = edgeSpot(ally.x, ally.y, box);
      mark.hidden = false;
      mark.classList.toggle("is-downed", ally.downed);
      setHudStyle(mark, "transform", `translate(${spot.x}px, ${spot.y}px)`);
      setHudStyle(
        mark.firstElementChild as HTMLElement,
        "transform",
        `rotate(${spot.angle}rad)`,
      );
    }
    for (const [id, mark] of this.marks)
      if (!seen.has(id)) {
        mark.remove();
        this.marks.delete(id);
      }
  }
  clear() {
    for (const mark of this.marks.values()) mark.remove();
    this.marks.clear();
  }
}

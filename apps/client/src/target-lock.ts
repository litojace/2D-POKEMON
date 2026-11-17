/**
 * Touch target lock: on phones the game aims at the nearest enemy, which in
 * team fights and free-for-alls is often not the one you want. Tap an enemy
 * on the court to lock on; tap it again for automatic aiming (a tap on empty
 * ground keeps the lock). The lock holds while that enemy is out of sight
 * (stealth) and aiming falls back to the nearest one meanwhile; it ends when
 * the enemy is defeated or leaves the match.
 */
export interface Targetable {
  id: string;
  x: number;
  y: number;
}
/** How close a tap must land to an enemy (court units). */
export const TAP_RADIUS = 90;
/**
 * How far above its feet an enemy can be tapped: its body, health bar and
 * name (the nameplate sits 68–90 above the feet). Taps on the name used to
 * miss, because only the feet counted.
 */
export const TAP_HEIGHT = 110;

export class TargetLock {
  id: string | undefined;
  /** The locked enemy while it can be aimed at, else undefined (aim nearest). */
  resolve<T extends Targetable>(enemies: T[]): T | undefined {
    return this.id === undefined
      ? undefined
      : enemies.find((e) => e.id === this.id);
  }
  /** Lock this enemy, or unlock it if it was already locked. */
  toggle(id: string) {
    this.id = this.id === id ? undefined : id;
  }
  /**
   * A tap on the court: the enemy under it (nearest within reach), if any.
   * An enemy is the column from its feet up to its name, not just its feet.
   */
  pickAt<T extends Targetable>(
    x: number,
    y: number,
    enemies: T[],
    radius = TAP_RADIUS,
  ) {
    let best: T | undefined,
      bestDistance = radius;
    for (const e of enemies) {
      const nearestY = Math.min(e.y, Math.max(e.y - TAP_HEIGHT, y));
      const d = Math.hypot(e.x - x, nearestY - y);
      if (d <= bestDistance) {
        best = e;
        bestDistance = d;
      }
    }
    return best;
  }
  /** Drop a lock whose enemy is no longer in the match. */
  keepIf(present: (id: string) => boolean) {
    if (this.id !== undefined && !present(this.id)) this.id = undefined;
  }
  clear() {
    this.id = undefined;
  }
}

/** Minimal drawing surface (a Phaser Graphics) for the lock reticle. */
interface Pen {
  lineStyle(width: number, color: number, alpha?: number): Pen;
  fillStyle(color: number, alpha?: number): Pen;
  fillEllipse(x: number, y: number, width: number, height: number): Pen;
  beginPath(): Pen;
  moveTo(x: number, y: number): Pen;
  lineTo(x: number, y: number): Pen;
  strokePath(): Pen;
}
/** The reticle's ring on the floor (court units; the floor's flatness). */
export const RETICLE_RX = 56;
export const RETICLE_RY = RETICLE_RX * 0.65;
/**
 * The reticle's line widths (court units) for a camera showing `pxPerUnit`
 * CSS px per court unit: at least 3.5 px of bright red in a 3 px dark edge
 * on the screen, so it reads on a phone, where the whole court is zoomed
 * out to about half size.
 */
export function reticleWidths(pxPerUnit = 1) {
  const unit = 1 / Math.max(0.1, pxPerUnit);
  const line = Math.max(3, 3.5 * unit);
  return { line, edge: line + Math.max(4, 6 * unit) };
}
/**
 * The locked enemy's reticle: four corner brackets turning slowly on the
 * floor around its feet (the same plane as the team ring), in the enemy red,
 * over a faint red disc. Plain lines (no glow), the same cost on every
 * graphics level.
 */
export function drawTargetReticle(
  g: Pen,
  x: number,
  feetY: number,
  seconds: number,
  pxPerUnit = 1,
) {
  const rx = RETICLE_RX,
    ry = RETICLE_RY;
  const spin = seconds * 1.2;
  const { line, edge } = reticleWidths(pxPerUnit);
  g.fillStyle(0xff5d6c, 0.14).fillEllipse(x, feetY, rx * 2, ry * 2);
  for (const width of [edge, line]) {
    g.lineStyle(
      width,
      width === edge ? 0x3a0710 : 0xff5d6c,
      width === edge ? 0.6 : 1,
    );
    for (let k = 0; k < 4; k++) {
      const mid = spin + (k * Math.PI) / 2;
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = mid - 0.42 + (0.84 * i) / 8;
        const px = x + Math.cos(a) * rx,
          py = feetY + Math.sin(a) * ry;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
  }
}

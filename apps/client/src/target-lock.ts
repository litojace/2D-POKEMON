/**
 * Touch target lock: on phones the game aims at the nearest enemy, which in
 * team fights and free-for-alls is often not the one you want. Tap an enemy
 * on the court (or its name in the target row) to lock on; tap it again for
 * automatic aiming. The lock holds while that enemy is out of sight (stealth)
 * and aiming falls back to the nearest one meanwhile; it ends when the enemy
 * leaves the match.
 */
export interface Targetable {
  id: string;
  x: number;
  y: number;
}
/** How close a tap must land to an enemy's feet (court units). */
export const TAP_RADIUS = 90;

export class TargetLock {
  id: string | undefined;
  /** The locked enemy while it can be aimed at, else undefined (aim nearest). */
  resolve<T extends Targetable>(enemies: T[]): T | undefined {
    return this.id === undefined ? undefined : enemies.find((e) => e.id === this.id);
  }
  /** Lock this enemy, or unlock it if it was already locked. */
  toggle(id: string) {
    this.id = this.id === id ? undefined : id;
  }
  /** A tap on the court: the enemy under it (nearest within reach), if any. */
  pickAt<T extends Targetable>(x: number, y: number, enemies: T[], radius = TAP_RADIUS) {
    let best: T | undefined,
      bestDistance = radius;
    for (const e of enemies) {
      const d = Math.hypot(e.x - x, e.y - y);
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
  beginPath(): Pen;
  moveTo(x: number, y: number): Pen;
  lineTo(x: number, y: number): Pen;
  strokePath(): Pen;
}
/**
 * The locked enemy's reticle: four corner brackets turning slowly on the
 * floor around its feet (the same plane as the team ring), in the enemy red.
 */
export function drawTargetReticle(g: Pen, x: number, feetY: number, seconds: number) {
  const rx = 52,
    ry = rx * 0.65; // the floor's flatness (groundHeight)
  const spin = seconds * 1.2;
  for (const width of [6, 2.5]) {
    g.lineStyle(width, width > 3 ? 0x3a0710 : 0xff5d6c, width > 3 ? 0.55 : 0.95);
    for (let k = 0; k < 4; k++) {
      const mid = spin + (k * Math.PI) / 2;
      g.beginPath();
      for (let i = 0; i <= 8; i++) {
        const a = mid - 0.38 + (0.76 * i) / 8;
        const px = x + Math.cos(a) * rx,
          py = feetY + Math.sin(a) * ry;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.strokePath();
    }
  }
}

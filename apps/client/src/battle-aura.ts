/**
 * The in-battle version of each fighter's trait aura: a small, cheap ground
 * effect at the creature's feet drawn with plain Graphics primitives (no
 * filters or textures), redrawn every frame by the rig.
 */
export interface AuraPainter {
  fillStyle(color: number, alpha?: number): AuraPainter;
  lineStyle(width: number, color: number, alpha?: number): AuraPainter;
  fillEllipse(x: number, y: number, w: number, h: number): AuraPainter;
  strokeEllipse(x: number, y: number, w: number, h: number): AuraPainter;
  fillCircle(x: number, y: number, r: number): AuraPainter;
  fillTriangle(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
  ): AuraPainter;
  lineBetween(x0: number, y0: number, x1: number, y1: number): AuraPainter;
}
const TAU = Math.PI * 2;
/** Battle auras are authored small and drawn this much larger around the feet. */
export const AURA_SCALE = 1.6;
/** Draw through `g`, scaling every shape by `s` around (cx, cy); line widths stay. */
function around(g: AuraPainter, cx: number, cy: number, s: number) {
  const X = (v: number) => cx + (v - cx) * s,
    Y = (v: number) => cy + (v - cy) * s;
  const p: AuraPainter = {
    fillStyle: (c, a) => (g.fillStyle(c, a), p),
    lineStyle: (w, c, a) => (g.lineStyle(w, c, a), p),
    fillEllipse: (x, y, w, h) => (g.fillEllipse(X(x), Y(y), w * s, h * s), p),
    strokeEllipse: (x, y, w, h) => (
      g.strokeEllipse(X(x), Y(y), w * s, h * s),
      p
    ),
    fillCircle: (x, y, r) => (g.fillCircle(X(x), Y(y), r * s), p),
    fillTriangle: (a, b, c, d, e, f) => (
      g.fillTriangle(X(a), Y(b), X(c), Y(d), X(e), Y(f)),
      p
    ),
    lineBetween: (a, b, c, d) => (g.lineBetween(X(a), Y(b), X(c), Y(d)), p),
  };
  return p;
}
/** Point on the flattened ground ellipse around the feet. */
const onRing = (x: number, y: number, rx: number, a: number) =>
  [x + Math.cos(a) * rx, y + Math.sin(a) * rx * 0.32] as const;
/**
 * @param x,y  the fighter's feet, in world pixels
 * @param t    time in seconds
 * @param a    overall opacity (fades with the fighter)
 */
export function drawBattleAura(
  g: AuraPainter,
  element: string,
  x: number,
  y: number,
  t: number,
  a = 1,
) {
  if (a <= 0) return;
  g = around(g, x, y, AURA_SCALE);
  const k = (v: number) => Math.max(0, Math.min(1, v * 1.15)) * a;
  switch (element.toLowerCase()) {
    case "electric": {
      g.fillStyle(0x7ff3ff, k(0.16)).fillEllipse(x, y, 54, 16);
      // A broken static ring that spins, plus one spark that jumps around it.
      for (let i = 0; i < 6; i++) {
        const a0 = t * 2.4 + (i * TAU) / 6;
        const [x0, y0] = onRing(x, y, 26, a0),
          [x1, y1] = onRing(x, y, 26, a0 + 0.55);
        g.lineStyle(2, i % 2 ? 0xffe76b : 0x7ff3ff, k(0.75)).lineBetween(
          x0,
          y0,
          x1,
          y1,
        );
      }
      if (Math.sin(t * 17) > 0.55) {
        const [sx, sy] = onRing(x, y, 22, Math.floor(t * 5) * 2.1);
        g.lineStyle(1.6, 0xffffff, k(0.9))
          .lineBetween(sx, sy, sx + 4, sy - 7)
          .lineBetween(sx + 4, sy - 7, sx + 1, sy - 12);
      }
      break;
    }
    case "fire": {
      g.fillStyle(0xff6a2a, k(0.2)).fillEllipse(x, y, 60, 18);
      for (let i = 0; i < 5; i++) {
        const fx = x - 22 + i * 11,
          h = 9 + Math.sin(t * 9 + i * 1.7) * 3 + (i === 2 ? 5 : 0);
        g.fillStyle(i % 2 ? 0xff9a3c : 0xff5a24, k(0.7)).fillTriangle(
          fx - 4,
          y + 2,
          fx + 4,
          y + 2,
          fx + Math.sin(t * 6 + i) * 1.5,
          y + 2 - h,
        );
      }
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.7 + i / 3) % 1;
        g.fillStyle(0xffd34d, k(0.8 * (1 - p))).fillCircle(
          x - 14 + i * 14 + Math.sin(t * 3 + i) * 3,
          y - p * 34,
          1.6,
        );
      }
      break;
    }
    case "water": {
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.55 + i / 2) % 1;
        g.lineStyle(1.8, 0xbff6ff, k(0.7 * (1 - p))).strokeEllipse(
          x,
          y,
          22 + p * 46,
          7 + p * 14,
        );
      }
      for (let i = 0; i < 3; i++) {
        const p = (t * 0.45 + i / 3) % 1;
        g.lineStyle(1.2, 0xdcfbff, k(0.8 * (1 - p))).strokeEllipse(
          x - 12 + i * 12,
          y - 6 - p * 30,
          4,
          4,
        );
      }
      break;
    }
    case "aura": {
      g.fillStyle(0x7f9cff, k(0.14)).fillEllipse(x, y, 60, 18);
      // A slowly turning hexagon flattened onto the ground.
      for (let i = 0; i < 6; i++) {
        const [x0, y0] = onRing(x, y, 28, t * 0.8 + (i * TAU) / 6),
          [x1, y1] = onRing(x, y, 28, t * 0.8 + ((i + 1) * TAU) / 6);
        g.lineStyle(1.6, 0xc9f4ff, k(0.65)).lineBetween(x0, y0, x1, y1);
      }
      for (let i = 0; i < 3; i++) {
        const [px, py] = onRing(x, y, 30, -t * 1.6 + (i * TAU) / 3);
        g.fillStyle(0xc9f4ff, k(0.9)).fillTriangle(
          px,
          py - 6,
          px + 3,
          py,
          px - 3,
          py,
        );
      }
      break;
    }
    case "light": {
      g.fillStyle(0xfff1a0, k(0.22 + Math.sin(t * 2.4) * 0.06)).fillEllipse(
        x,
        y,
        56,
        16,
      );
      for (let i = 0; i < 4; i++) {
        const p = (t * 0.4 + i / 4) % 1,
          mx = x - 18 + i * 12 + Math.sin(t * 2 + i) * 4,
          my = y - 4 - p * 40,
          s = 2.6 * Math.sin(p * Math.PI);
        g.fillStyle(0xfff6c8, k(0.9 * Math.sin(p * Math.PI)))
          .fillTriangle(mx, my - s * 1.6, mx + s * 0.5, my, mx - s * 0.5, my)
          .fillTriangle(mx, my + s * 1.6, mx + s * 0.5, my, mx - s * 0.5, my);
      }
      break;
    }
    case "psychic": {
      for (let i = 0; i < 2; i++) {
        const p = (t * 0.6 + i / 2) % 1;
        g.lineStyle(
          2,
          i ? 0x9ff7ff : 0xff79d2,
          k(0.75 * (1 - p)),
        ).strokeEllipse(x, y, 18 + p * 50, 6 + p * 16);
      }
      g.fillStyle(0xff79d2, k(0.16)).fillEllipse(x, y, 40, 12);
      break;
    }
    case "earth": {
      g.fillStyle(0xc79a5b, k(0.2)).fillEllipse(x, y, 62, 18);
      g.lineStyle(1.6, 0x8fd36a, k(0.55 + Math.sin(t * 2.2) * 0.2))
        .lineBetween(x - 26, y + 2, x - 16, y - 1)
        .lineBetween(x - 16, y - 1, x - 10, y + 3)
        .lineBetween(x + 12, y + 1, x + 22, y - 2);
      for (let i = 0; i < 3; i++) {
        const [px, py] = onRing(x, y - 4, 30, t * 0.9 + (i * TAU) / 3),
          bob = Math.sin(t * 3 + i) * 2;
        g.fillStyle(i % 2 ? 0xa07a48 : 0x7e6a55, k(0.95)).fillTriangle(
          px - 4,
          py + bob + 2,
          px + 4,
          py + bob + 1,
          px,
          py + bob - 4,
        );
      }
      break;
    }
    case "shadow": {
      g.fillStyle(0x120b26, k(0.55)).fillEllipse(x, y, 64, 18);
      g.fillStyle(0x9c6bff, k(0.18)).fillEllipse(x, y, 44, 12);
      for (let i = 0; i < 2; i++) {
        const [px, py] = onRing(x, y - 10, 28, t * 1.4 + i * Math.PI),
          flick = 1 + Math.sin(t * 8 + i) * 0.15;
        g.fillStyle(0x7dffe1, k(0.85))
          .fillTriangle(px - 3, py, px + 3, py, px, py - 9 * flick)
          .fillCircle(px, py, 3);
      }
      break;
    }
  }
}

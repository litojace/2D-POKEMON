import type Phaser from "phaser";
import type { FxParticle } from "./skin-fx";
import { sparkle } from "./skin-fx";

/**
 * The Shop's all-fighter collection pieces in play: auras under the fighter,
 * entrances at round start and victory finales. Frames and Colours are drawn
 * elsewhere (CSS portraits and the rig's restyled textures).
 */
type G = Phaser.GameObjects.Graphics;
const TAU = Math.PI * 2;

/** Auras sit under the fighter, like the Mountain aura. Returns false if unknown. */
export function drawCollectionAura(g: G, id: string, x: number, y: number, now: number, reduced: boolean) {
  const t = reduced ? 0 : now;
  const ring = (n: number, rx: number, ry: number, speed: number, draw: (px: number, py: number, i: number, a: number) => void) => {
    for (let i = 0; i < n; i++) {
      const a = t / speed + (i / n) * TAU;
      draw(x + Math.cos(a) * rx, y + Math.sin(a) * ry, i, a);
    }
  };
  switch (id) {
    case "candy-aura": {
      const colors = [0xff6fa8, 0x6fd6ff, 0xffd65b, 0x8fe06a, 0xc89aff];
      ring(16, 46, 20, 3000, (px, py, i, a) =>
        g.lineStyle(3, colors[i % colors.length], 0.9).lineBetween(px - Math.cos(a + i) * 3, py - Math.sin(a + i) * 2, px + Math.cos(a + i) * 3, py + Math.sin(a + i) * 2),
      );
      return true;
    }
    case "galaxy-aura": {
      const k = reduced ? 0.5 : 0.5 + Math.sin(now / 900) * 0.5;
      g.fillStyle(0x4a3a9a, 0.16 + k * 0.08).fillEllipse(x, y, 104, 44);
      g.fillStyle(0xc86bff, 0.12).fillEllipse(x + Math.cos(t / 1800) * 10, y, 70, 26);
      ring(6, 48, 19, 5000, (px, py) => sparkle(g, px, py, 2.4, 0xffffff, 0.85));
      return true;
    }
    case "retro-aura":
      ring(8, 46, 19, 3600, (px, py) => {
        // A tiny pixel heart.
        g.fillStyle(0xff3a5a, 0.95);
        for (const [dx, dy] of [[-2, -1], [-1, -2], [1, -2], [2, -1], [-2, 0], [-1, 0], [0, -1], [0, 0], [1, 0], [2, 0], [-1, 1], [0, 1], [1, 1], [0, 2]])
          g.fillRect(px + dx * 1.6, py + dy * 1.6, 1.6, 1.6);
      });
      return true;
    case "festival-aura":
      ring(5, 44, 18, 4200, (px, py, i) => {
        const bob = reduced ? 0 : Math.sin(now / 400 + i) * 2;
        g.fillStyle(0xd8262a, 0.95).fillEllipse(px, py - 8 + bob, 9, 11);
        g.fillStyle(0xffd65b, 0.9).fillRect(px - 3, py - 14 + bob, 6, 1.6).fillRect(px - 3, py - 3 + bob, 6, 1.6);
        g.fillStyle(0xffd65b, 0.25).fillCircle(px, py - 8 + bob, 9);
      });
      return true;
    case "garden-aura":
      ring(10, 46, 19, 4600, (px, py, i, a) => {
        const dx = Math.cos(a * 2 + i) * 4,
          dy = Math.sin(a * 2 + i) * 2;
        g.fillStyle(i % 2 ? 0xffb3cf : 0xfff0f5, 0.95).fillTriangle(px - dx, py - dy, px + dx, py + dy, px - dy, py + dx * 0.6);
      });
      return true;
    case "tidal-aura": {
      // Tidewyrm's reward: a rolling ring of water with foam crests.
      g.fillStyle(0x1f8fa6, 0.18).fillEllipse(x, y, 104, 44);
      g.lineStyle(3, 0x7fe9ff, 0.8).strokeEllipse(x, y, 96, 40);
      ring(10, 48, 20, 2600, (px, py, i) =>
        g.fillStyle(i % 2 ? 0xffffff : 0xbff6ff, 0.9).fillCircle(px, py - 2, 3.4),
      );
      return true;
    }
    case "lullaby-aura": {
      g.fillStyle(0x8977c5, 0.12).fillEllipse(x, y, 102, 43);
      g.lineStyle(1.5, 0xc9a3ff, 0.45).strokeEllipse(x, y, 98, 41);
      ring(6, 46, 19, 6000, (px, py, i) => {
        const bob = reduced ? 0 : Math.sin(now / 750 + i) * 3;
        g.fillStyle(i % 2 ? 0xc9a3ff : 0xffdf8d, 0.9).fillEllipse(px, py + bob, 5, 3);
        g.lineStyle(1.4, i % 2 ? 0xc9a3ff : 0xffdf8d, 0.9).lineBetween(px + 2, py + bob, px + 2, py - 10 + bob).lineBetween(px + 2, py - 10 + bob, px + 7, py - 7 + bob);
      });
      return true;
    }
    case "nightmote": {
      // Gloomshade's reward: fireflies of lantern light circling beneath you.
      g.fillStyle(0x2b2245, 0.22).fillEllipse(x, y, 100, 42);
      ring(7, 46, 19, 4400, (px, py, i) => {
        const bob = reduced ? 0 : Math.sin(now / 350 + i * 1.3) * 4;
        const blink = reduced ? 1 : 0.55 + 0.45 * Math.abs(Math.sin(now / 500 + i * 2.1));
        g.fillStyle(0xffd27a, 0.25 * blink).fillCircle(px, py - 6 + bob, 7);
        g.fillStyle(0xfff1c2, 0.95 * blink).fillCircle(px, py - 6 + bob, 2.6);
      });
      return true;
    }
    case "winter-aura":
      ring(8, 46, 19, 5200, (px, py, i) => {
        const s = 4;
        g.lineStyle(1.4, i % 2 ? 0xffffff : 0xbfe8ff, 0.95)
          .lineBetween(px - s, py, px + s, py)
          .lineBetween(px - s / 2, py - s * 0.86, px + s / 2, py + s * 0.86)
          .lineBetween(px - s / 2, py + s * 0.86, px + s / 2, py - s * 0.86);
      });
      return true;
  }
  return false;
}

type Emit = (p: FxParticle) => void;
const rnd = (a: number, b: number) => a + Math.random() * (b - a);

/** A one-off burst when the round greeting starts. Returns false if unknown. */
export function playCollectionEntrance(emit: Emit, id: string, x: number, y: number, sc: number) {
  const burst = (n: number, make: (i: number) => Omit<FxParticle, "x" | "y"> & { x?: number; y?: number }) => {
    for (let i = 0; i < n; i++) {
      const p = make(i);
      emit({ x: x, y: y, ...p } as FxParticle);
    }
  };
  switch (id) {
    case "candy-entrance": {
      // The gift box bursts open: its lid flies off in a shower of confetti.
      burst(4, (i) => ({ y: y + 4 * sc, vx: (i - 1.5) * 60, vy: -120, life: 0.7, size: 7 * sc, color: i % 2 ? 0xff6fa8 : 0x6fd6ff, shape: "pixel" }));
      burst(26, (i) => ({ y: y - 6 * sc, vx: rnd(-140, 140), vy: rnd(-220, -80), life: rnd(0.8, 1.2), size: 2.6 * sc, color: [0xff6fa8, 0x6fd6ff, 0xffd65b, 0x8fe06a][i % 4], shape: "confetti", spin: rnd(-12, 12) }));
      return true;
    }
    case "galaxy-entrance":
      // Rings fall inward like a tunnel of stars.
      for (let k = 0; k < 4; k++) emit({ x, y: y - 10 * sc, vx: 0, vy: 0, life: 0.3 + k * 0.12, size: (14 - k * 3) * sc, color: k % 2 ? 0x9fd8ff : 0xc86bff, shape: "ring" });
      burst(20, (i) => {
        const a = (i / 20) * TAU;
        return { x: x + Math.cos(a) * 60 * sc, y: y - 10 * sc + Math.sin(a) * 30 * sc, vx: -Math.cos(a) * 150, vy: -Math.sin(a) * 75, life: 0.4, size: 2.4 * sc, color: 0xffffff, shape: "star" };
      });
      return true;
    case "retro-entrance":
      burst(30, (i) => ({ x: x + rnd(-24, 24) * sc, y: y + rnd(-50, 10) * sc, vx: 0, vy: rnd(-20, 20), life: rnd(0.3, 0.7), size: 3 * sc, color: [0x2ff3ff, 0xff4fd8, 0xffffff, 0x8fe06a][i % 4], shape: "pixel" }));
      return true;
    case "festival-entrance":
      burst(14, () => ({ y: y + 10 * sc, vx: rnd(-80, 80), vy: rnd(-60, -10), life: 0.6, size: 4 * sc, color: 0xdddddd, shape: "puff" }));
      burst(22, (i) => {
        const a = rnd(0, TAU);
        return { y: y - 6 * sc, vx: Math.cos(a) * rnd(100, 200), vy: Math.sin(a) * rnd(100, 200), life: 0.5, size: 5 * sc, color: i % 2 ? 0xffd65b : 0xff4f4f, shape: "spark" };
      });
      return true;
    case "garden-entrance":
      burst(24, (i) => {
        const a = (i / 24) * TAU;
        return { y: y + 4 * sc, vx: Math.cos(a) * rnd(60, 120), vy: Math.sin(a) * rnd(30, 60) - 70, life: rnd(0.8, 1.2), size: 3 * sc, color: [0xffb3cf, 0xff6fa0, 0xfff0f5, 0x8fe06a][i % 4], shape: "leaf", spin: rnd(-8, 8) };
      });
      return true;
    case "dreamdrift":
      emit({ x, y, vx: 0, vy: -12, life: 1.2, size: 18 * sc, color: 0xc9a3ff, shape: "ring" });
      burst(20, i => ({ x: x + rnd(-36, 36) * sc, y: y + rnd(-12, 14) * sc, vx: rnd(-20, 20), vy: rnd(-90, -35), life: rnd(0.8, 1.4), size: (i % 3 ? 3 : 7) * sc, color: i % 2 ? 0xd1b2ff : 0x92efdb, shape: "ring" }));
      return true;
    case "riptide":
      // Tidewyrm's reward: burst up out of a splash.
      emit({ x, y: y - 6 * sc, vx: 0, vy: 0, life: 0.45, size: 14 * sc, color: 0x7fe9ff, shape: "ring" });
      burst(30, (i) => {
        const a = -Math.PI * (0.1 + (i / 30) * 0.8);
        return { y: y + 10 * sc, vx: Math.cos(a) * rnd(80, 190), vy: Math.sin(a) * rnd(150, 280), life: rnd(0.6, 1), size: rnd(2, 3.4) * sc, color: i % 3 ? 0xe6fbff : 0x7fe9ff, shape: "dot" };
      });
      return true;
    case "shadowstep":
      // Gloomshade's reward: rise out of a pool of shadow.
      emit({ x, y: y + 8 * sc, vx: 0, vy: 0, life: 0.6, size: 22 * sc, color: 0x2b2245, shape: "ring" });
      burst(26, (i) => {
        const a = (i / 26) * TAU;
        return { x: x + Math.cos(a) * 34 * sc, y: y + 8 * sc + Math.sin(a) * 12 * sc, vx: Math.cos(a) * rnd(10, 30), vy: -rnd(60, 140), life: rnd(0.6, 1), size: rnd(3, 5) * sc, color: i % 4 ? 0x4a3d72 : 0xffd65b, shape: i % 4 ? "puff" : "spark" };
      });
      return true;
    case "winter-entrance":
      burst(34, () => ({ x: x + rnd(-50, 50) * sc, y: y - rnd(10, 70) * sc, vx: rnd(-60, 60), vy: rnd(10, 60), life: rnd(0.8, 1.3), size: rnd(2, 3.5) * sc, color: 0xffffff, shape: "flake" }));
      return true;
  }
  return false;
}

/** Five-row pixel letters for "LEVEL UP!". */
const PIXEL_FONT: Record<string, string[]> = {
  L: ["100", "100", "100", "100", "111"],
  E: ["111", "100", "110", "100", "111"],
  V: ["101", "101", "101", "101", "010"],
  U: ["101", "101", "101", "101", "111"],
  P: ["110", "101", "110", "100", "100"],
  "!": ["1", "1", "1", "0", "1"],
  " ": ["0", "0", "0", "0", "0"],
};
function pixelText(g: G, text: string, cx: number, cy: number, px: number, color: number, alpha: number) {
  const width = [...text].reduce((w, ch) => w + (PIXEL_FONT[ch][0].length + 1) * px, -px);
  let x = cx - width / 2;
  for (const ch of text) {
    const rows = PIXEL_FONT[ch];
    rows.forEach((row, r) =>
      [...row].forEach((bit, c) => {
        if (bit === "1") {
          g.fillStyle(0x1a0b3d, alpha).fillRect(x + c * px + 1, cy + r * px + 1, px, px);
          g.fillStyle(color, alpha).fillRect(x + c * px, cy + r * px, px, px);
        }
      }),
    );
    x += (rows[0].length + 1) * px;
  }
}

/**
 * Victory finales, drawn every frame of the celebration (t seconds in).
 * The champion keeps its own victory move; these play around it.
 */
export function drawCollectionVictory(
  g: G,
  under: G,
  emit: Emit,
  chance: (rate: number, dt: number) => boolean,
  id: string,
  x: number,
  y: number,
  sc: number,
  t: number,
  dt: number,
  first: boolean,
) {
  if (t > 3) return false;
  const fade = t > 2.4 ? Math.max(0, 1 - (t - 2.4) / 0.6) : 1;
  switch (id) {
    case "candy-victory": {
      // A layered cake rises behind, then bursts into confetti.
      const rise = Math.min(1, t / 0.4);
      const bx = x,
        by = y + 20 * sc;
      const layers = [[40, 0xffd2e4], [30, 0xfff0f8], [20, 0xff9ec8]] as const;
      layers.forEach(([w, c], i) => {
        const h = 14 * sc * rise;
        under.fillStyle(c, fade).fillRoundedRect(bx - w * sc, by - (i + 1) * h - i * sc, w * 2 * sc, h, 3 * sc);
      });
      under.fillStyle(0xffd65b, fade).fillRect(bx - 1 * sc, by - 50 * sc * rise, 2 * sc, 8 * sc);
      if (first || (t > 0.4 && t - dt <= 0.4))
        for (let i = 0; i < 28; i++)
          emit({ x: bx, y: by - 48 * sc, vx: rnd(-150, 150), vy: rnd(-260, -80), life: rnd(0.9, 1.4), size: 2.6 * sc, color: [0xff6fa8, 0x6fd6ff, 0xffd65b, 0x8fe06a][i % 4], shape: "confetti", spin: rnd(-12, 12) });
      return true;
    }
    case "galaxy-victory": {
      // A supernova blooms behind the fighter.
      const k = Math.min(1, t / 0.8);
      under.fillStyle(0xc86bff, 0.25 * fade).fillCircle(x, y - 14 * sc, (20 + k * 36) * sc);
      under.fillStyle(0x9fd8ff, 0.3 * fade).fillCircle(x, y - 14 * sc, (12 + k * 30) * sc);
      under.fillStyle(0xffffff, 0.5 * fade * (1 - k * 0.6)).fillCircle(x, y - 14 * sc, (6 + k * 12) * sc);
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * TAU + t * 0.4;
        under.lineStyle(2 * sc, 0xffffff, 0.5 * fade).lineBetween(x + Math.cos(a) * 20 * sc * k, y - 14 * sc + Math.sin(a) * 20 * sc * k, x + Math.cos(a) * 52 * sc * k, y - 14 * sc + Math.sin(a) * 52 * sc * k);
      }
      if (chance(10, dt)) emit({ x: x + rnd(-60, 60) * sc, y: y + rnd(-70, 10) * sc, vx: 0, vy: -10, life: 0.6, size: 2.4 * sc, color: 0xffffff, shape: "star" });
      return true;
    }
    case "retro-victory": {
      const pop = t < 0.25 ? t / 0.25 : 1;
      const blink = Math.floor(t * 6) % 2 ? 0xffd65b : 0x2ff3ff;
      pixelText(g, "LEVEL UP!", x, y - 86 * sc - (1 - pop) * 10 * sc, 3 * sc, blink, fade);
      if (chance(14, dt)) emit({ x: x + rnd(-40, 40) * sc, y: y - rnd(0, 60) * sc, vx: 0, vy: -40, life: 0.5, size: 2.4 * sc, color: [0xff4fd8, 0x2ff3ff, 0xffd65b][Math.floor(rnd(0, 3))], shape: "pixel" });
      return true;
    }
    case "festival-victory":
      // Fireworks: a shell bursts every 0.45 s.
      if (first || Math.floor(t / 0.45) > Math.floor((t - dt) / 0.45)) {
        const fx = x + rnd(-60, 60) * sc,
          fy = y - rnd(70, 110) * sc,
          color = [0xff4f4f, 0xffd65b, 0x7ff3ff, 0xff8fd8][Math.floor(rnd(0, 4))];
        for (let i = 0; i < 18; i++) {
          const a = (i / 18) * TAU;
          emit({ x: fx, y: fy, vx: Math.cos(a) * 110, vy: Math.sin(a) * 110, life: 0.7, size: 4 * sc, color, shape: "spark" });
        }
      }
      return true;
    case "garden-victory":
      if (chance(26, dt))
        emit({ x: x + rnd(-80, 80) * sc, y: y - rnd(80, 120) * sc, vx: rnd(-20, 20), vy: rnd(40, 80), life: rnd(1.2, 1.8), size: 3 * sc, color: [0xffb3cf, 0xff6fa0, 0xfff0f5, 0xffd65b][Math.floor(rnd(0, 4))], shape: "leaf", spin: rnd(-6, 6) });
      return true;
    case "splashdown": {
      // Tidewyrm's reward: a wave rises behind you and crashes in spray.
      const rise = Math.min(1, t / 0.5),
        crash = t > 0.9 ? Math.min(1, (t - 0.9) / 0.4) : 0;
      const h = 90 * sc * rise * (1 - crash * 0.8);
      under.fillStyle(0x1f8fa6, 0.7 * fade).fillEllipse(x, y + 10 * sc, 150 * sc, 34 * sc);
      under.fillStyle(0x3fb3c9, 0.85 * fade).fillTriangle(x - 70 * sc, y + 12 * sc, x + 70 * sc, y + 12 * sc, x + 20 * sc * (1 - crash), y + 12 * sc - h);
      under.fillStyle(0xe6fbff, 0.9 * fade).fillCircle(x + 20 * sc * (1 - crash), y + 12 * sc - h, 10 * sc);
      if (t > 0.9 && t - dt <= 0.9)
        for (let i = 0; i < 34; i++)
          emit({ x: x + rnd(-40, 40) * sc, y: y - 50 * sc, vx: rnd(-170, 170), vy: rnd(-260, -60), life: rnd(0.7, 1.1), size: rnd(2, 3.5) * sc, color: i % 3 ? 0xe6fbff : 0x7fe9ff, shape: "dot" });
      return true;
    }
    case "sweet-dreams": {
      const rise = Math.min(1, t / 0.8), wx = x + Math.sin(t * 1.8) * 30 * sc, wy = y - (45 + rise * 65) * sc;
      under.fillStyle(0xc9a3ff, 0.18 * fade).fillEllipse(x, y + 6 * sc, 136 * sc, 34 * sc);
      under.fillStyle(0x8977c5, fade).fillEllipse(wx, wy, 70 * sc, 38 * sc).fillTriangle(wx + 24 * sc, wy, wx + 48 * sc, wy - 18 * sc, wx + 40 * sc, wy + 10 * sc);
      under.fillStyle(0xd6c9f0, fade).fillEllipse(wx - 3 * sc, wy + 9 * sc, 55 * sc, 17 * sc);
      under.lineStyle(1.5 * sc, 0x283452, fade).lineBetween(wx - 22 * sc, wy - 2 * sc, wx - 15 * sc, wy - 2 * sc);
      if (chance(12, dt)) emit({ x: wx + rnd(-50, 50) * sc, y: wy + rnd(-30, 25) * sc, vx: rnd(-15, 15), vy: rnd(-35, -10), life: 1, size: 2.5 * sc, color: 0xffdf8d, shape: "star" });
      return true;
    }
    case "crescent-bow": {
      // Gloomshade's reward: a crescent moon rises behind you as you bow.
      const rise = Math.min(1, t / 0.8);
      const mx = x + 26 * sc,
        my = y - (40 + 70 * rise) * sc,
        mr = 30 * sc;
      under.fillStyle(0xffd65b, 0.16 * fade).fillCircle(mx, my, mr * 1.8);
      under.fillStyle(0xffd65b, 0.95 * fade).fillCircle(mx, my, mr);
      // The bite that makes it a crescent: the night sky behind it.
      under.fillStyle(0x161a30, fade).fillCircle(mx + mr * 0.5, my - mr * 0.2, mr * 0.85);
      if (chance(10, dt)) emit({ x: x + rnd(-80, 80) * sc, y: y - rnd(70, 140) * sc, vx: 0, vy: rnd(-10, 10), life: rnd(0.8, 1.2), size: 2.4 * sc, color: 0xfff1c2, shape: "star" });
      return true;
    }
    case "winter-victory": {
      // A snow globe: a glassy dome with a swirl of snow.
      under.fillStyle(0xbfe8ff, 0.14 * fade).fillCircle(x, y - 18 * sc, 48 * sc);
      g.lineStyle(2 * sc, 0xffffff, 0.6 * fade).strokeCircle(x, y - 18 * sc, 48 * sc);
      g.lineStyle(3 * sc, 0xffffff, 0.35 * fade).beginPath();
      g.arc(x, y - 18 * sc, 42 * sc, -2.6, -1.9);
      g.strokePath();
      under.fillStyle(0x8a5a3a, fade).fillRoundedRect(x - 36 * sc, y + 24 * sc, 72 * sc, 10 * sc, 3 * sc);
      if (chance(30, dt)) {
        const a = rnd(0, TAU),
          r = rnd(0, 40) * sc;
        emit({ x: x + Math.cos(a) * r, y: y - 18 * sc + Math.sin(a) * r, vx: rnd(-30, 30), vy: rnd(-10, 30), life: 0.7, size: 2.2 * sc, color: 0xffffff, shape: "flake" });
      }
      return true;
    }
  }
  return false;
}

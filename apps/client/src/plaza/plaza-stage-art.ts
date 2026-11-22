// @ts-nocheck
/*
 * The runway's big screen and its rig, baked: the truss (a lattice of
 * tubes), its two towers, the light cans' housings, the screen's bezel and
 * the speaker stacks are one sprite, and the screen's words are painted
 * into a picture only when they change (they were drawn, with fonts, a
 * gradient and 37 scanlines, every frame). Per frame plaza-scene.ts lays
 * the screen's moving colour, the cached words, the scanlines and the
 * blinking cans over it.
 *
 * Light from the top left: tubes are lit on their upper edge, cones on
 * their upper left.
 */
import { GFX } from "../hub-art/gfx";

const { sprite, memo } = GFX;

/** The rig round a screen at (x0, y0)–(x1, y1) whose feet stand at floorY. */
export function ledRig(x0, y0, x1, y1, floorY) {
  const w = x1 - x0;
  return memo(`led-rig:${x0}:${y0}:${x1}:${y1}:${floorY}`, () =>
    // Anchored at the screen's top-left corner.
    sprite(w + 160, floorY - y0 + 44, 80, 40, (g) => {
      const tube = (ax, ay, bx, by, r = 2) => {
        g.strokeStyle = "#11111a";
        g.lineWidth = r * 2 + 1.5;
        g.beginPath();
        g.moveTo(ax, ay);
        g.lineTo(bx, by);
        g.stroke();
        g.strokeStyle = "#3a3a4e";
        g.lineWidth = r * 2;
        g.stroke();
        g.strokeStyle = "rgba(190,195,230,.45)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(ax - 0.5, ay - r * 0.5);
        g.lineTo(bx - 0.5, by - r * 0.5);
        g.stroke();
      };
      const H = floorY - y0;
      // The towers: two uprights each, braced in a zigzag.
      for (const tx of [-24, w + 10]) {
        tube(tx, -34, tx, H, 2);
        tube(tx + 14, -34, tx + 14, H, 2);
        for (let y = -30, k = 0; y < H - 6; y += 16, k++)
          tube(tx + (k % 2 ? 14 : 0), y, tx + (k % 2 ? 0 : 14), y + 16, 1.2);
        // The base plate.
        g.fillStyle = "#1a1a24";
        g.beginPath();
        g.roundRect(tx - 6, H - 4, 26, 6, 2);
        g.fill();
      }
      // The truss across the top: two chords and their lattice.
      tube(-26, -34, w + 26, -34, 2.2);
      tube(-26, -20, w + 26, -20, 2.2);
      for (let x = -22, k = 0; x < w + 22; x += 14, k++)
        tube(x, k % 2 ? -20 : -34, x + 14, k % 2 ? -34 : -20, 1.1);
      // The light cans' housings, hanging from the lower chord.
      for (let i = 0; i < 6; i++) {
        const x = 30 + (i * (w - 60)) / 5;
        g.fillStyle = "#11111a";
        g.fillRect(x - 1.5, -20, 3, 4);
        g.fillStyle = "#24243a";
        g.beginPath();
        g.ellipse(x, -14, 10, 8, 0, 0, 7);
        g.fill();
        g.fillStyle = "rgba(200,205,240,.35)";
        g.beginPath();
        g.ellipse(x - 3, -18, 4, 2, -0.3, 0, 7);
        g.fill();
        g.fillStyle = "#0b0b14";
        g.beginPath();
        g.ellipse(x, -12, 6.5, 5, 0, 0, 7);
        g.fill();
      }
      // The screen's bezel, with bolts in its corners.
      g.fillStyle = "#07060f";
      g.fillRect(-6, -6, w + 12, y1 - y0 + 12);
      g.strokeStyle = "#2a2a3c";
      g.lineWidth = 1.5;
      g.strokeRect(-5.5, -5.5, w + 11, y1 - y0 + 11);
      g.fillStyle = "#4a4a60";
      for (const [bx, by] of [
        [-3, -3],
        [w + 3, -3],
        [-3, y1 - y0 + 3],
        [w + 3, y1 - y0 + 3],
      ]) {
        g.beginPath();
        g.arc(bx, by, 1.6, 0, 7);
        g.fill();
      }
      // The speaker stacks: cabinets with a lit edge, two drivers each
      // (a cone in its surround, a dust cap) and a tweeter.
      const sy = H - 120;
      for (const sx of [-70, w + 30]) {
        g.fillStyle = "#15151f";
        g.beginPath();
        g.roundRect(sx, sy, 40, 120, 3);
        g.fill();
        g.fillStyle = "rgba(255,255,255,.08)";
        g.fillRect(sx + 1, sy + 1, 3, 118);
        g.strokeStyle = "#2b2b3c";
        g.lineWidth = 1;
        g.strokeRect(sx + 0.5, sy + 0.5, 39, 119);
        g.fillStyle = "#0c0c14";
        g.fillRect(sx + 4, sy + 58, 32, 2);
        for (const cy of [sy + 24, sy + 74]) {
          const cg = g.createRadialGradient(sx + 16, cy - 4, 1, sx + 20, cy, 15);
          cg.addColorStop(0, "#4a4a5e");
          cg.addColorStop(0.7, "#22222e");
          cg.addColorStop(1, "#0a0a12");
          g.fillStyle = "#30303f";
          g.beginPath();
          g.arc(sx + 20, cy, 15, 0, 7);
          g.fill();
          g.fillStyle = cg;
          g.beginPath();
          g.arc(sx + 20, cy, 12.5, 0, 7);
          g.fill();
          g.fillStyle = "#3c3c50";
          g.beginPath();
          g.arc(sx + 20, cy, 4, 0, 7);
          g.fill();
          g.fillStyle = "rgba(255,255,255,.25)";
          g.beginPath();
          g.arc(sx + 18.5, cy - 1.5, 1.5, 0, 7);
          g.fill();
        }
        g.fillStyle = "#2c2c3a";
        g.beginPath();
        g.ellipse(sx + 20, sy + 104, 8, 4, 0, 0, 7);
        g.fill();
        g.fillStyle = "#0a0a12";
        g.beginPath();
        g.ellipse(sx + 20, sy + 104, 4, 2, 0, 0, 7);
        g.fill();
      }
    }),
  );
}

/** Scanlines and a soft sheen over a screen w × h (top-left anchored). */
export function ledGlass(w, h) {
  return memo(`led-glass:${w}:${h}`, () =>
    sprite(w, h, 0, 0, (g) => {
      g.fillStyle = "rgba(0,0,0,.18)";
      for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1.5);
      const sh = g.createLinearGradient(0, 0, w * 0.6, h);
      sh.addColorStop(0, "rgba(255,255,255,.1)");
      sh.addColorStop(0.35, "rgba(255,255,255,0)");
      g.fillStyle = sh;
      g.fillRect(0, 0, w, h);
      // Darker toward the edges, as a lit panel is.
      const v = g.createRadialGradient(w / 2, h / 2, h * 0.3, w / 2, h / 2, w * 0.6);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(0,0,0,.25)");
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
    }),
  );
}

/** Under the words: the screen's colour deepening toward its bottom and
 * a cool cast to its right, as the old gradient gave. */
export function ledShade(w, h) {
  return memo(`led-shade:${w}:${h}`, () =>
    sprite(w, h, 0, 0, (g) => {
      const v = g.createLinearGradient(0, 0, w * 0.35, h);
      v.addColorStop(0, "rgba(0,0,0,0)");
      v.addColorStop(1, "rgba(10,10,60,.42)");
      g.fillStyle = v;
      g.fillRect(0, 0, w, h);
      const r = g.createLinearGradient(0, 0, w, 0);
      r.addColorStop(0, "rgba(255,80,200,.08)");
      r.addColorStop(1, "rgba(40,90,255,.18)");
      g.fillStyle = r;
      g.fillRect(0, 0, w, h);
    }),
  );
}

/**
 * The screen's words and picture, kept until what they say changes. draw
 * paints them at the screen's top-left (0, 0) in screen px.
 */
export function ledWords(w, h) {
  let key = null,
    pic = null;
  return (want, draw) => {
    if (want !== key || !pic) {
      key = want;
      pic = sprite(w, h, 0, 0, draw);
    }
    return pic;
  };
}

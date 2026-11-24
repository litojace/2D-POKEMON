// @ts-nocheck
/*
 * The wishing fountain's stonework, baked once into two sprites (it was
 * drawn whole every frame, with five gradients made each time): the basin
 * (its shadow, the wall of dressed stone, the coping round its rim and the
 * still water's colour) and the tiers (two pillars and two bowls). Only
 * what moves is drawn live, in plaza-scene.ts drawFountain: the ripples,
 * the coins catching the light, the falling water, the jet and the crystal.
 *
 * Light from the top left, as everywhere on the Plaza: stone is lit on its
 * left and shaded on its right, a ledge throws a dark line under itself.
 */
import { GFX } from "../hub-art/gfx";

const { sprite, memo, mix } = GFX;

/** The basin's measurements: PLAZA_FOUNTAIN (x, y, rx, ry, wall). */
type Basin = { rx: number; ry: number; wall: number };

/** The ellipse the water fills, inside the coping. */
export const waterOf = (F: Basin) => ({ rx: F.rx - 15, ry: F.ry - 11, dy: 3 });

/** Round the stone of a cylinder: lit left of centre, shaded at the right. */
function stoneAcross(g, x0, x1, light = "#fffaf0", mid = "#e6dcc6", dark = "#a3977d") {
  const gr = g.createLinearGradient(x0, 0, x1, 0);
  gr.addColorStop(0, mix(mid, dark, 0.35));
  gr.addColorStop(0.28, light);
  gr.addColorStop(0.62, mid);
  gr.addColorStop(1, dark);
  return gr;
}

export function fountainBasin(F: Basin) {
  const { rx, ry, wall } = F,
    w = waterOf(F);
  return memo(`fountain-basin:${rx}:${ry}:${wall}`, () =>
    sprite(rx * 2 + 56, ry * 2 + wall + 40, rx + 24, ry + 12, (g) => {
      // A soft shadow down and to the right of the basin's foot.
      for (const [grow, a] of [
        [16, 0.1],
        [9, 0.12],
        [3, 0.14],
      ]) {
        g.fillStyle = `rgba(30,40,40,${a})`;
        g.beginPath();
        g.ellipse(8, wall + 6, rx + grow, ry + grow * 0.7, 0, 0, 7);
        g.fill();
      }
      // The wall's front, between the rim and its foot.
      const front = () => {
        g.beginPath();
        g.ellipse(0, 0, rx, ry, 0, 0, Math.PI);
        g.lineTo(-rx, wall);
        g.ellipse(0, wall, rx, ry, 0, Math.PI, 0, true);
        g.closePath();
      };
      front();
      g.fillStyle = stoneAcross(g, -rx, rx, "#f6eedc", "#e0d4bb", "#a99c82");
      g.fill();
      g.save();
      front();
      g.clip();
      // Darker toward the foot, where the ground's damp reaches; a band of
      // shade right under the coping's overhang.
      const vg = g.createLinearGradient(0, ry * 0.4, 0, ry + wall);
      vg.addColorStop(0, "rgba(60,50,30,0)");
      vg.addColorStop(1, "rgba(60,70,40,.22)");
      g.fillStyle = vg;
      g.fillRect(-rx, 0, rx * 2, ry + wall);
      g.strokeStyle = "rgba(70,58,40,.32)";
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(0, 3, rx, ry, 0, 0.05, Math.PI - 0.05);
      g.stroke();
      // Courses of dressed stone: a joint along the middle, and upright
      // joints staggered course to course.
      g.strokeStyle = "rgba(120,104,78,.55)";
      g.lineWidth = 1.2;
      g.beginPath();
      g.ellipse(0, wall * 0.52, rx, ry, 0, 0.02, Math.PI - 0.02);
      g.stroke();
      for (let row = 0; row < 2; row++)
        for (let k = -6; k <= 6; k++) {
          const a = Math.PI / 2 + (k + (row ? 0.5 : 0)) * 0.24;
          if (a <= 0.05 || a >= Math.PI - 0.05) continue;
          const px = Math.cos(a) * rx,
            py = Math.sin(a) * ry + (row ? wall * 0.52 : 0);
          g.beginPath();
          g.moveTo(px, py + 1);
          g.lineTo(px, py + wall * 0.52 - 1);
          g.stroke();
          // Each block's lit top-left corner.
          g.strokeStyle = "rgba(255,250,236,.45)";
          g.beginPath();
          g.moveTo(px + 1.5, py + 2);
          g.lineTo(px + 1.5, py + wall * 0.3);
          g.stroke();
          g.strokeStyle = "rgba(120,104,78,.55)";
        }
      // Moss in the joints near the foot, and a few weathering stains.
      g.fillStyle = "rgba(96,140,70,.45)";
      for (let k = -14; k <= 14; k++) {
        const a = Math.PI / 2 + k * 0.1 + Math.sin(k * 7.3) * 0.03;
        if (a <= 0.1 || a >= Math.PI - 0.1) continue;
        const px = Math.cos(a) * rx,
          py = Math.sin(a) * ry + wall - 2;
        g.beginPath();
        g.ellipse(px, py, 2.5 + (Math.abs(k * 13) % 4), 1.6, 0, 0, 7);
        g.fill();
      }
      g.restore();
      front();
      g.strokeStyle = "#857a64";
      g.lineWidth = 2;
      g.stroke();
      // The coping on top: a ring of stones, lit on its far (north) side
      // where it faces the light, with joints across it.
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, 7);
      g.fillStyle = "#efe6d2";
      g.fill();
      const cg = g.createLinearGradient(-rx, -ry, rx, ry);
      cg.addColorStop(0, "rgba(255,255,255,.45)");
      cg.addColorStop(0.55, "rgba(255,255,255,0)");
      cg.addColorStop(1, "rgba(90,74,50,.18)");
      g.fillStyle = cg;
      g.fill();
      // Inside the coping: the basin's inner wall, seen on its far side.
      g.beginPath();
      g.ellipse(0, 0, w.rx + 2, w.ry + 2, 0, 0, 7);
      g.fillStyle = "#cfc2a6";
      g.fill();
      g.strokeStyle = "rgba(120,104,78,.5)";
      g.lineWidth = 1;
      for (let k = 0; k < 28; k++) {
        const a = (k / 28) * Math.PI * 2,
          c = Math.cos(a),
          s = Math.sin(a);
        g.beginPath();
        g.moveTo(c * (w.rx + 2), s * (w.ry + 2));
        g.lineTo(c * rx, s * ry);
        g.stroke();
      }
      g.strokeStyle = "#a59a84";
      g.lineWidth = 2;
      g.beginPath();
      g.ellipse(0, 0, rx, ry, 0, 0, 7);
      g.stroke();
      // The still water: deep at the edges, light in the middle, and a
      // band of darker water under the far wall's shadow.
      const water = () => {
        g.beginPath();
        g.ellipse(0, w.dy, w.rx, w.ry, 0, 0, 7);
      };
      water();
      const wg = g.createRadialGradient(-30, -18, 8, 0, w.dy, w.rx);
      wg.addColorStop(0, "#a8f2ff");
      wg.addColorStop(0.55, "#43bcdc");
      wg.addColorStop(1, "#1b7aa6");
      g.fillStyle = wg;
      g.fill();
      g.save();
      water();
      g.clip();
      g.strokeStyle = "rgba(10,60,90,.28)";
      g.lineWidth = 8;
      g.beginPath();
      g.ellipse(0, w.dy - 6, w.rx, w.ry, 0, Math.PI, Math.PI * 2);
      g.stroke();
      // Light on the bottom: a few soft pale patches (caustics).
      g.fillStyle = "rgba(220,255,255,.12)";
      for (let k = 0; k < 9; k++) {
        const a = k * 2.4,
          r = 0.25 + ((k * 31) % 60) / 100;
        g.beginPath();
        g.ellipse(Math.cos(a) * w.rx * r, w.dy + Math.sin(a) * w.ry * r, 10, 4, a, 0, 7);
        g.fill();
      }
      g.restore();
      // The water's edge against the stone: a bright line on the near side.
      g.strokeStyle = "rgba(255,255,255,.5)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, w.dy, w.rx, w.ry, 0, 0.15, Math.PI - 0.15);
      g.stroke();
    }),
  );
}

/** The pillars and bowls, from the basin's water up to the top bowl. */
export function fountainTiers() {
  return memo("fountain-tiers", () =>
    sprite(150, 150, 75, 132, (g) => {
      const pillar = (yt, yb, r) => {
        g.fillStyle = stoneAcross(g, -r, r);
        g.fillRect(-r, yt, r * 2, yb - yt);
        // Fluting: grooves down the column.
        g.strokeStyle = "rgba(120,104,78,.35)";
        g.lineWidth = 1;
        g.beginPath();
        for (let k = -2; k <= 2; k++) {
          g.moveTo(k * r * 0.38, yt + 3);
          g.lineTo(k * r * 0.38, yb - 3);
        }
        g.stroke();
        g.strokeStyle = "#857a64";
        g.lineWidth = 1.5;
        g.strokeRect(-r, yt, r * 2, yb - yt);
        // A moulded ring at the foot.
        g.fillStyle = stoneAcross(g, -r - 4, r + 4);
        g.beginPath();
        g.ellipse(0, yb - 2, r + 4, 4, 0, 0, 7);
        g.fill();
        g.stroke();
      };
      const bowl = (by, rx, ry, d) => {
        const out = () => {
          g.beginPath();
          g.ellipse(0, by, rx, ry, 0, 0, Math.PI);
          g.bezierCurveTo(-rx, by + d * 0.9, -rx * 0.6, by + d, -rx * 0.5, by + d);
          g.ellipse(0, by + d, rx * 0.5, ry * 0.45, 0, Math.PI, 0, true);
          g.bezierCurveTo(rx * 0.6, by + d, rx, by + d * 0.9, rx, by);
          g.closePath();
        };
        out();
        g.fillStyle = stoneAcross(g, -rx, rx, "#fbf4e4", "#ddd1b8", "#9d917a");
        g.fill();
        g.save();
        out();
        g.clip();
        // Shade under the lip, and a carved band of scallops below it.
        g.fillStyle = "rgba(70,58,40,.22)";
        g.beginPath();
        g.ellipse(0, by + 3, rx, ry, 0, 0, Math.PI);
        g.ellipse(0, by, rx, ry, 0, Math.PI, 0, true);
        g.fill();
        g.strokeStyle = "rgba(120,104,78,.45)";
        g.lineWidth = 1;
        for (let k = -5; k <= 5; k++) {
          const a = Math.PI / 2 + k * 0.26,
            px = Math.cos(a) * rx * 0.9,
            py = by + Math.sin(a) * ry * 0.9 + d * 0.35;
          g.beginPath();
          g.arc(px, py, rx * 0.075, 0, Math.PI);
          g.stroke();
        }
        g.restore();
        out();
        g.strokeStyle = "#857a64";
        g.lineWidth = 1.5;
        g.stroke();
        // The lip, lit on its far side.
        g.beginPath();
        g.ellipse(0, by, rx, ry, 0, 0, 7);
        g.fillStyle = "#f4ecdb";
        g.fill();
        g.stroke();
        g.strokeStyle = "rgba(255,255,255,.7)";
        g.lineWidth = 1.5;
        g.beginPath();
        g.ellipse(0, by, rx - 2, ry - 1.5, 0, Math.PI * 1.05, Math.PI * 1.7);
        g.stroke();
        // Its water.
        g.beginPath();
        g.ellipse(0, by + 1, rx - 7, ry - 4.5, 0, 0, 7);
        const wg = g.createRadialGradient(-rx * 0.3, by - ry * 0.3, 2, 0, by, rx);
        wg.addColorStop(0, "#b5f5ff");
        wg.addColorStop(0.6, "#47c0de");
        wg.addColorStop(1, "#2186b0");
        g.fillStyle = wg;
        g.fill();
        g.strokeStyle = "rgba(10,60,90,.25)";
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(0, by - 1, rx - 8, ry - 5, 0, Math.PI * 1.1, Math.PI * 1.9);
        g.stroke();
      };
      pillar(-52, 0, 13);
      bowl(-56, 64, 30, 18);
      pillar(-104, -56, 9);
      bowl(-108, 34, 16, 10);
    }),
  );
}

// @ts-nocheck
/*
 * The fishing pond's water, baked: what lies under the surface and the
 * light on it, painted once into a sprite (it was one radial gradient made
 * every frame). From the edge in: a sandy, pebbled shallow you see the
 * bottom through, weed swaying under the water (drawn still; the surface's
 * ripples move over it), then deep water darkening toward the middle. The
 * far bank throws a band of shade on the water below it; the near edge
 * mirrors the sky. Per frame, plaza-scene.ts lays the moving light, the
 * fish, the ripples and the lily pads over this.
 *
 * Light from the top left, as everywhere on the Plaza.
 */
import { GFX } from "../hub-art/gfx";

const { sprite, memo, rnd, srand } = GFX;

export function pondWater(rx, ry) {
  return memo(`pond-water:${rx}:${ry}`, () =>
    sprite(rx * 2 + 4, ry * 2 + 4, rx + 2, ry + 2, (g) => {
      srand(41);
      const pond = (k = 1, dy = 0) => {
        g.beginPath();
        g.ellipse(0, dy, rx * k, ry * k, 0, 0, Math.PI * 2);
      };
      // The bottom: sand at the edge going down into the deep.
      pond();
      const bed = g.createRadialGradient(0, ry * 0.1, ry * 0.2, 0, 0, rx);
      bed.addColorStop(0, "#0f5f86");
      bed.addColorStop(0.45, "#1b86ad");
      bed.addColorStop(0.78, "#3fb3c9");
      bed.addColorStop(0.93, "#8fd2c4");
      bed.addColorStop(1, "#c9d9a8");
      g.save();
      g.scale(1, ry / rx);
      g.fillStyle = bed;
      g.beginPath();
      g.arc(0, 0, rx, 0, Math.PI * 2);
      g.fill();
      g.restore();
      g.save();
      pond();
      g.clip();
      // Pebbles in the shallows, seen through the water.
      for (let i = 0; i < 160; i++) {
        const a = rnd() * Math.PI * 2,
          r = 0.8 + rnd() * 0.19,
          x = Math.cos(a) * rx * r,
          y = Math.sin(a) * ry * r;
        g.fillStyle = ["rgba(150,160,130,.55)", "rgba(110,130,110,.5)", "rgba(200,205,170,.55)"][i % 3];
        g.beginPath();
        g.ellipse(x, y, 2 + rnd() * 3, 1.4 + rnd() * 1.6, rnd() * 3, 0, 7);
        g.fill();
      }
      // Weed rising from the bottom in clumps, softened by the water.
      for (let c = 0; c < 9; c++) {
        const a = rnd() * Math.PI * 2,
          r = 0.45 + rnd() * 0.35,
          cx = Math.cos(a) * rx * r,
          cy = Math.sin(a) * ry * r;
        g.strokeStyle = c % 2 ? "rgba(40,120,80,.45)" : "rgba(70,150,90,.4)";
        g.lineWidth = 2.2;
        g.lineCap = "round";
        for (let k = 0; k < 5; k++) {
          const bx = cx + (k - 2) * 4;
          g.beginPath();
          g.moveTo(bx, cy + 6);
          g.quadraticCurveTo(bx + (rnd() - 0.5) * 16, cy - 8, bx + (rnd() - 0.5) * 10, cy - 18 - rnd() * 10);
          g.stroke();
        }
      }
      // The far bank's shade on the water, and the sky in the near edge.
      g.strokeStyle = "rgba(10,40,50,.35)";
      g.lineWidth = 26;
      g.beginPath();
      g.ellipse(0, -10, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      const sky = g.createLinearGradient(0, ry * 0.35, 0, ry);
      sky.addColorStop(0, "rgba(220,245,255,0)");
      sky.addColorStop(1, "rgba(220,245,255,.38)");
      g.fillStyle = sky;
      g.fillRect(-rx, ry * 0.35, rx * 2, ry);
      // The surface's sheen: a soft band of light across it, top left.
      g.save();
      g.rotate(-0.18);
      const sh = g.createLinearGradient(0, -ry * 0.7, 0, -ry * 0.2);
      sh.addColorStop(0, "rgba(255,255,255,0)");
      sh.addColorStop(0.5, "rgba(255,255,255,.16)");
      sh.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = sh;
      g.fillRect(-rx, -ry * 0.7, rx * 1.2, ry * 0.5);
      g.restore();
      g.restore();
      // The waterline against the bank: dark, then a bright lip below.
      pond();
      g.strokeStyle = "rgba(20,60,60,.5)";
      g.lineWidth = 3;
      g.stroke();
      g.strokeStyle = "rgba(255,255,255,.4)";
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, 0, rx - 3, ry - 3, 0, 0.2, Math.PI - 0.2);
      g.stroke();
    }),
  );
}

/** A lily pad with its notch, its veins and a sheen; one in two flower. */
export function lilyPad(r, bloom) {
  return memo(`lily:${r}:${bloom}`, () =>
    sprite(r * 2 + 16, r * 1.4 + 22, r + 8, r * 0.7 + 14, (g) => {
      // Its shadow on the water.
      g.fillStyle = "rgba(10,50,60,.3)";
      g.beginPath();
      g.ellipse(3, 3, r, r * 0.6, 0, 0, 7);
      g.fill();
      const pad = (k, a0) => {
        g.beginPath();
        g.ellipse(0, 0, r * k, r * 0.6 * k, 0, a0, Math.PI * 2 - a0);
        g.lineTo(0, 0);
        g.closePath();
      };
      pad(1, 0.35);
      g.fillStyle = "#2f8a3e";
      g.fill();
      pad(0.93, 0.38);
      const pg = g.createRadialGradient(-r * 0.3, -r * 0.25, 1, 0, 0, r);
      pg.addColorStop(0, "#9be27a");
      pg.addColorStop(0.6, "#5fbf55");
      pg.addColorStop(1, "#3f9a46");
      g.fillStyle = pg;
      g.fill();
      g.strokeStyle = "rgba(40,110,50,.55)";
      g.lineWidth = 0.9;
      g.beginPath();
      for (let k = 0; k < 9; k++) {
        const a = 0.55 + (k / 8) * (Math.PI * 2 - 1.1);
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * r * 0.86, Math.sin(a) * r * 0.52);
      }
      g.stroke();
      g.fillStyle = "rgba(255,255,255,.35)";
      g.beginPath();
      g.ellipse(-r * 0.35, -r * 0.22, r * 0.25, r * 0.08, -0.3, 0, 7);
      g.fill();
      if (bloom) {
        // A water lily: outer petals, inner petals, a golden heart.
        const fx = r * 0.2,
          fy = -r * 0.25;
        for (const [n, len, c] of [
          [8, 7, "#ff9fc8"],
          [6, 5, "#ffd6e8"],
        ])
          for (let k = 0; k < n; k++) {
            const a = (k / n) * Math.PI * 2;
            g.fillStyle = c;
            g.beginPath();
            g.ellipse(fx + Math.cos(a) * len * 0.6, fy + Math.sin(a) * len * 0.35 - 1, len * 0.55, len * 0.3, a, 0, 7);
            g.fill();
          }
        g.fillStyle = "#ffd65b";
        g.beginPath();
        g.arc(fx, fy - 2, 2.4, 0, 7);
        g.fill();
      }
    }),
  );
}

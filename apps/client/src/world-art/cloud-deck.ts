/**
 * Snoozaku's Cloud Deck: a lavender marble deck with gold seams, ringed by a
 * gilded balustrade, floating in a sea of soft dusk clouds with stars showing
 * through the gaps.
 */
import {
  type Ctx,
  type Part,
  type WorldPainter,
  W,
  H,
  WORLD,
  rng,
  hex,
  css,
  blob,
  noiseLayer,
  flagstones,
  fbm,
  courtEdgeShadow,
  grade,
  vignette,
  withCourtClip,
  ring,
  ramp,
} from "./kit";

const EDGE = hex("#1d1640");

function sky(c: Ctx) {
  const { x, y, width, height } = WORLD;
  noiseLayer(c, x, y, width, height, 8, 1, 71, (_n, wx, wy) => {
    const t = fbm(wx / 700, wy / 700, 72, 4);
    const col = ramp(
      [hex("#1b1540"), hex("#3a2c6e"), hex("#6a4f9c")],
      t * 1.2 - 0.1,
    );
    return [col[0], col[1], col[2], 255];
  });
  const rand = rng(73);
  for (let i = 0; i < 900; i++) {
    const sx = x + rand() * width,
      sy = y + rand() * height;
    const r = rand() < 0.08 ? 2.4 : 1.2;
    c.fillStyle = `rgba(255,250,235,${0.4 + rand() * 0.6})`;
    c.beginPath();
    c.arc(sx, sy, r, 0, Math.PI * 2);
    c.fill();
  }
}

function clouds(c: Ctx) {
  const { x, y, width, height } = WORLD;
  // Soft cloud masses from thresholded noise, lit from the top left.
  for (const [seed, scale, lo, col, a] of [
    [81, 520, 0.42, [150, 130, 200], 230],
    [82, 380, 0.48, [205, 190, 235], 235],
    [83, 260, 0.55, [245, 238, 255], 240],
  ] as [number, number, number, [number, number, number], number][])
    noiseLayer(c, x, y, width, height, 7, scale, seed, (n, wx, wy) => {
      const near = Math.max(
        0,
        1 - Math.max(0, Math.max(-wx, wx - W, -wy, wy - H) - 60) / 700,
      );
      const v = n + near * 0.25;
      const k = Math.max(0, Math.min(1, (v - lo) / 0.12));
      return [col[0], col[1], col[2], k * a];
    });
  // Highlights on cloud tops.
  const rand = rng(84);
  for (let i = 0; i < 400; i++) {
    const cx = x + rand() * width,
      cy = y + rand() * height;
    blob(c, cx, cy, 30 + rand() * 60, [255, 245, 255], 0.12);
  }
}

function balustrade(c: Ctx) {
  // The deck's edge: a marble lip with gold trim and small posts.
  c.save();
  c.shadowColor = "rgba(20,10,50,0.55)";
  c.shadowBlur = 30;
  c.shadowOffsetX = 10;
  c.shadowOffsetY = 18;
  c.beginPath();
  ring(c, 46, 0.6);
  c.fillStyle = "#cbbde8";
  c.fill();
  c.restore();
  c.beginPath();
  ring(c, 46, 0.6);
  ring(c, 0, 0.6);
  const g = c.createLinearGradient(-46, -46, W + 46, H + 46);
  g.addColorStop(0, "#efe7ff");
  g.addColorStop(1, "#a596cf");
  c.fillStyle = g;
  c.fill("evenodd");
  for (const [d, col, w] of [
    [4, "rgba(240,205,120,0.95)", 3],
    [42, "rgba(240,205,120,0.95)", 3],
    [46, "rgba(60,40,110,0.8)", 2],
  ] as [number, string, number][]) {
    c.beginPath();
    ring(c, d, 0.6);
    c.strokeStyle = col;
    c.lineWidth = w;
    c.stroke();
  }
  const posts: [number, number][] = [];
  for (let x = 0; x <= W; x += 100) posts.push([x, -23], [x, H + 23]);
  for (let y = 100; y < H; y += 100) posts.push([-23, y], [W + 23, y]);
  for (const [px, py] of posts) {
    c.fillStyle = "rgba(40,25,90,0.3)";
    c.beginPath();
    c.arc(px + 3, py + 4, 9, 0, Math.PI * 2);
    c.fill();
    const pg = c.createRadialGradient(px - 3, py - 3, 1, px, py, 9);
    pg.addColorStop(0, "#fff7dd");
    pg.addColorStop(1, "#c9a453");
    c.fillStyle = pg;
    c.beginPath();
    c.arc(px, py, 8, 0, Math.PI * 2);
    c.fill();
  }
}

function court(c: Ctx) {
  withCourtClip(c, () => {
    flagstones(c, 0, 0, W, H, {
      bed: [hex("#c9a75c"), hex("#e3c57e")],
      light: [hex("#f1eafc"), hex("#ddd0f2")],
      dark: [hex("#cbbbe6"), hex("#a998d0")],
      cols: 10,
      rows: 6,
      gap: 5,
      round: 4,
      merge: 0.12,
      cracks: 0,
      seed: 75,
      bevel: 0.6,
      jitter: 0.02,
    });
    // Marble veins.
    const rand = rng(76);
    c.strokeStyle = "rgba(150,120,200,0.28)";
    c.lineWidth = 1.5;
    for (let i = 0; i < 40; i++) {
      let vx = rand() * W,
        vy = rand() * H;
      c.beginPath();
      c.moveTo(vx, vy);
      for (let k = 0; k < 6; k++) {
        vx += 20 + rand() * 40;
        vy += (rand() - 0.5) * 50;
        c.lineTo(vx, vy);
      }
      c.stroke();
    }
    noiseLayer(c, 0, 0, W, H, 8, 240, 77, (n) => [
      180,
      150,
      230,
      Math.max(0, n - 0.5) * 120,
    ]);
    courtEdgeShadow(c, 0.7, [40, 25, 90]);
  });
}

function paint(c: Ctx, part: Part) {
  if (part === "court") {
    court(c);
    return;
  }
  sky(c);
  clouds(c);
  balustrade(c);
  court(c);
  grade(c, hex("#ffe9ff"), hex("#1a1040"), 0.3);
  vignette(c, EDGE, 1100, 2100, 0.6);
}

export const cloudDeck: WorldPainter = { paint, edge: css(EDGE) };

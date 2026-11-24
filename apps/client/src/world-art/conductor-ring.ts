/**
 * The Storm Twins' Conductor Ring: riveted steel deck plates with blue
 * conductive seams inside a copper-capped barrier; beyond it a works floor of
 * steel panels with hazard stripes, cable runs, glowing conduits and tesla
 * coils crackling at the corners.
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
  inGrown,
  noiseLayer,
  flagstones,
  wall,
  courtEdgeShadow,
  glows,
  grade,
  vignette,
  withCourtClip,
} from "./kit";

const EDGE = hex("#0a1220");

function plates(
  c: Ctx,
  x0: number,
  y0: number,
  w: number,
  h: number,
  cols: number,
  rows: number,
  seed: number,
  dark: boolean,
) {
  flagstones(c, x0, y0, w, h, {
    bed: dark
      ? [hex("#0a0f18"), hex("#141c28")]
      : [hex("#121a26"), hex("#1c2634")],
    light: dark
      ? [hex("#4a5668"), hex("#3c4758")]
      : [hex("#5e6b7e"), hex("#4b586b")],
    dark: dark
      ? [hex("#2c3544"), hex("#222a37")]
      : [hex("#3a4556"), hex("#2c3645")],
    cols,
    rows,
    gap: 6,
    round: 4,
    merge: 0.1,
    cracks: 0,
    seed,
    bevel: 0.9,
    jitter: 0.004,
  });
  // Rivets at plate corners.
  const cw = w / cols,
    ch = h / rows;
  for (let j = 0; j <= rows; j++)
    for (let i = 0; i <= cols; i++) {
      const rx = x0 + i * cw,
        ry = y0 + j * ch;
      for (const [dx, dy] of [
        [10, 10],
        [-10, 10],
        [10, -10],
        [-10, -10],
      ]) {
        c.fillStyle = "rgba(10,14,20,0.6)";
        c.beginPath();
        c.arc(rx + dx + 0.8, ry + dy + 1, 2.6, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#9aa8bb";
        c.beginPath();
        c.arc(rx + dx, ry + dy, 2.2, 0, Math.PI * 2);
        c.fill();
      }
    }
}

function coil(c: Ctx, x: number, y: number) {
  blob(c, x + 10, y + 14, 70, [0, 0, 0], 0.55);
  for (const [r, col] of [
    [46, "#2b3442"],
    [38, "#b56a2e"],
    [31, "#d98a45"],
    [24, "#b56a2e"],
    [17, "#d98a45"],
  ] as [number, string][]) {
    c.fillStyle = col;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "rgba(40,20,5,0.6)";
    c.lineWidth = 1.5;
    c.stroke();
  }
  const g = c.createRadialGradient(x - 3, y - 3, 1, x, y, 13);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.4, "#a8e4ff");
  g.addColorStop(1, "#2d7fd8");
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, 12, 0, Math.PI * 2);
  c.fill();
  // Little arcs.
  const rand = rng(Math.round(x * 7 + y));
  c.strokeStyle = "rgba(190,235,255,0.8)";
  c.lineWidth = 1.6;
  for (let k = 0; k < 5; k++) {
    let a = rand() * Math.PI * 2,
      px = x + Math.cos(a) * 12,
      py = y + Math.sin(a) * 12;
    c.beginPath();
    c.moveTo(px, py);
    for (let s = 0; s < 4; s++) {
      a += (rand() - 0.5) * 1.2;
      px += Math.cos(a) * 14;
      py += Math.sin(a) * 14;
      c.lineTo(px, py);
    }
    c.stroke();
  }
}

function works(c: Ctx) {
  const { x, y, width, height } = WORLD;
  plates(c, x, y, width, height, 24, 18, 121, true);
  // Hazard stripes in a band round the barrier.
  c.save();
  c.beginPath();
  c.rect(-130, -130, W + 260, H + 260);
  c.rect(-80, -80, W + 160, H + 160);
  c.clip("evenodd");
  c.fillStyle = "#1c1f24";
  c.fillRect(-130, -130, W + 260, H + 260);
  c.fillStyle = "rgba(240,190,40,0.85)";
  for (let s = -H - 400; s < W + 400; s += 40) {
    c.beginPath();
    c.moveTo(s, -130);
    c.lineTo(s + 20, -130);
    c.lineTo(s + 20 + H + 260, H + 130);
    c.lineTo(s + H + 260, H + 130);
    c.closePath();
    c.fill();
  }
  c.restore();
  // Glowing conduits and cable runs.
  const rand = rng(122);
  c.lineCap = "round";
  for (let i = 0; i < 14; i++) {
    const sx = rand() < 0.5 ? x + rand() * width : x;
    const sy = sx === x ? y + rand() * height : y;
    let px = sx,
      py = sy;
    const pts: [number, number][] = [[px, py]];
    for (let k = 0; k < 6; k++) {
      if (k % 2) px += 200 + rand() * 400;
      else py += (rand() - 0.3) * 500;
      pts.push([px, py]);
    }
    if (pts.some(([qx, qy]) => inGrown(qx, qy, 150))) continue;
    for (const [w, col] of [
      [14, "rgba(10,14,20,0.8)"],
      [8, "#26303e"],
      [3, "rgba(110,200,255,0.9)"],
    ] as [number, string][]) {
      c.strokeStyle = col;
      c.lineWidth = w;
      c.beginPath();
      c.moveTo(...pts[0]);
      for (const q of pts.slice(1)) c.lineTo(...q);
      c.stroke();
    }
  }
  c.lineCap = "butt";
  noiseLayer(c, x, y, width, height, 10, 300, 123, (n) => [
    20,
    30,
    45,
    Math.max(0, n - 0.5) * 200,
  ]);
}

const coils: [number, number][] = [
  [-200, -200],
  [W + 200, -200],
  [-200, H + 200],
  [W + 200, H + 200],
  [W / 2, -230],
  [W / 2, H + 230],
];

function court(c: Ctx) {
  withCourtClip(c, () => {
    plates(c, 0, 0, W, H, 12, 7, 131, false);
    // Blue conductive seams along a few plate joints.
    c.strokeStyle = "rgba(90,190,255,0.35)";
    c.lineWidth = 2.5;
    c.beginPath();
    for (const fx of [3, 9]) {
      c.moveTo((W / 12) * fx, 0);
      c.lineTo((W / 12) * fx, H);
    }
    for (const fy of [2, 5]) {
      c.moveTo(0, (H / 7) * fy);
      c.lineTo(W, (H / 7) * fy);
    }
    c.stroke();
    noiseLayer(c, 0, 0, W, H, 8, 200, 132, (n) => [
      140,
      170,
      210,
      Math.max(0, n - 0.55) * 90,
    ]);
    courtEdgeShadow(c, 1, [2, 4, 10]);
  });
}

function paint(c: Ctx, part: Part) {
  if (part === "court") {
    court(c);
    return;
  }
  works(c);
  wall(c, 0, 56, {
    base: hex("#4a5466"),
    light: hex("#8a98ad"),
    dark: hex("#232a36"),
    line: hex("#c47a3a"),
    block: 90,
    courses: 2,
    seed: 133,
  });
  c.beginPath();
  c.roundRect(-52, -52, W + 104, H + 104, 28);
  c.strokeStyle = "#d48b48";
  c.lineWidth = 5;
  c.stroke();
  court(c);
  for (const [x, y] of coils) coil(c, x, y);
  glows(
    c,
    coils.map(([x, y]) => ({ x, y })),
    [80, 170, 255],
    190,
    0.35,
  );
  grade(c, hex("#c8e4ff"), hex("#050a14"), 0.3);
  vignette(c, EDGE);
}

export const conductorRing: WorldPainter = { paint, edge: css(EDGE) };

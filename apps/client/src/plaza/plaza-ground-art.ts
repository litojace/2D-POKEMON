// @ts-nocheck
/*
 * The Plaza's ground in detail: stones, pavers, grass edges and the
 * little things lying in the grass. All of it is painted once into the
 * ground picture (paintBg in plaza-scene.ts), so it costs nothing a frame.
 *
 * One light for the whole Plaza, from the top left (as gfx.ts draws every
 * prop): a stone's top-left edge catches it, its bottom-right edge is in
 * its own shade and it casts a short shadow down and to the right.
 * Random numbers come from the scene's seeded generator, so the ground is
 * the same picture every time it is painted.
 */
import { GFX } from "../hub-art/gfx";

const { mix, lt, dk, rgba } = GFX;

/**
 * A rounded, slightly irregular outline (a worn stone): n corners at
 * jittered angles and radii, smoothed with curves through their midpoints.
 */
function blob(g, rnd, rx, ry, n = 8, jag = 0.08) {
  const pts = [];
  for (let k = 0; k < n; k++) {
    const a = ((k + (rnd() - 0.5) * 0.5) / n) * Math.PI * 2,
      r = 1 - jag + rnd() * jag;
    pts.push([Math.cos(a) * rx * r, Math.sin(a) * ry * r]);
  }
  return () => {
    g.beginPath();
    const m = (i) => {
      const a = pts[i % n],
        b = pts[(i + 1) % n];
      return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
    };
    const s = m(n - 1);
    g.moveTo(s[0], s[1]);
    for (let i = 0; i < n; i++) {
      const e = m(i);
      g.quadraticCurveTo(pts[i][0], pts[i][1], e[0], e[1]);
    }
    g.closePath();
  };
}

/**
 * One cobble at (x, y): a worn stone of about w × h, turned by rot. Shadow
 * down-right, a darker rim on its shaded side, a lit face, a highlight on
 * its top-left, and now and then a speck or a hairline crack.
 */
export function cobble(g, rnd, x, y, w, h, c, rot = 0) {
  const path = blob(g, rnd, w / 2, h / 2);
  g.save();
  g.translate(x, y);
  g.rotate(rot);
  // Its shadow on the sand (down-right, in the Plaza's light).
  g.save();
  g.rotate(-rot);
  g.translate(1, 1.8);
  g.rotate(rot);
  path();
  g.fillStyle = "rgba(150,122,80,.3)";
  g.fill();
  g.restore();
  // The shaded rim, then the face nudged up-left so the rim shows
  // down-right only.
  path();
  g.fillStyle = dk(c, 0.1);
  g.fill();
  g.save();
  g.rotate(-rot);
  g.translate(-0.7, -1.1);
  g.scale(0.95, 0.93);
  g.rotate(rot);
  path();
  g.fillStyle = c;
  g.fill();
  g.restore();
  // The highlight, on the top-left of the face.
  g.rotate(-rot);
  g.fillStyle = "rgba(255,255,255,.38)";
  g.beginPath();
  g.ellipse(-w * 0.16, -h * 0.22, w * 0.24, h * 0.13, -0.25, 0, Math.PI * 2);
  g.fill();
  const r = rnd();
  if (r < 0.35) {
    g.fillStyle = rgba(dk(c, 0.45), 0.35);
    g.beginPath();
    g.arc((rnd() - 0.5) * w * 0.5, (rnd() - 0.2) * h * 0.4, 0.9, 0, 7);
    g.arc((rnd() - 0.5) * w * 0.5, (rnd() - 0.2) * h * 0.4, 0.7, 0, 7);
    g.fill();
  } else if (r < 0.45) {
    g.strokeStyle = rgba(dk(c, 0.45), 0.4);
    g.lineWidth = 0.8;
    g.beginPath();
    const cx = (rnd() - 0.5) * w * 0.3;
    g.moveTo(cx - w * 0.2, -h * 0.1);
    g.lineTo(cx, h * 0.05);
    g.lineTo(cx + w * 0.15, h * 0.2);
    g.stroke();
  }
  g.restore();
}

/** A stone of a path or a landing: its size and colour vary. */
export const COBBLE_TONES = ["#efe3c8", "#e6d6b4", "#f4ead6", "#dccaa6", "#e9dcc0"];
export function pathCobble(g, rnd, x, y, rot = 0) {
  const c = COBBLE_TONES[Math.floor(rnd() * COBBLE_TONES.length)],
    w = 21 + rnd() * 3,
    h = 16 + rnd() * 2;
  cobble(g, rnd, x, y, w, h, c, rot + (rnd() - 0.5) * 0.12);
}

/**
 * The sand between a path's stones: speckled grit, and darker where it
 * has collected in the joints (drawn before the stones, so only the
 * joints show it).
 */
export function grit(g, rnd, x, y, w, h, inside, n) {
  for (let i = 0; i < n; i++) {
    const px = x + rnd() * w,
      py = y + rnd() * h;
    if (!inside(px, py)) continue;
    const k = rnd();
    g.fillStyle =
      k < 0.45
        ? "rgba(160,132,90,.25)"
        : k < 0.8
          ? "rgba(255,248,230,.45)"
          : "rgba(110,130,70,.35)";
    g.fillRect(px, py, 1.6, 1.6);
  }
}

/**
 * Grass along a path's edge, leaning over the sand, and moss in the
 * joints near it: the edge reads as grass grown up to a path rather than
 * a line drawn round it. edgeAt(x, y) is true where a tuft may grow.
 */
export function grassEdge(g, rnd, pts, w, edgeAt) {
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i],
      [x1, y1] = pts[i + 1],
      L = Math.hypot(x1 - x0, y1 - y0),
      ux = (x1 - x0) / L,
      uy = (y1 - y0) / L;
    for (const side of [-1, 1])
      for (let d = 4; d < L; d += 7 + rnd() * 9) {
        const off = side * (w / 2 + 1 - rnd() * 6),
          x = x0 + ux * d - uy * off,
          y = y0 + uy * d + ux * off;
        if (!edgeAt(x, y)) continue;
        tuft(g, rnd, x, y, 0.7 + rnd() * 0.5);
      }
  }
}

/** A tuft of three to five blades, dark at the root and lit at the tips. */
export function tuft(g, rnd, x, y, s = 1) {
  const n = 3 + Math.floor(rnd() * 3);
  g.lineCap = "round";
  for (let pass = 0; pass < 2; pass++) {
    g.strokeStyle = pass ? "#a2dc7c" : "#4c9a3c";
    g.lineWidth = pass ? 1 : 1.6;
    g.beginPath();
    for (let k = 0; k < n; k++) {
      const a = -Math.PI / 2 + (k / (n - 1) - 0.5) * 1.3,
        l = (6 + ((k * 7) % 5)) * s,
        bx = x + (k - (n - 1) / 2) * 1.6 * s;
      if (pass) {
        g.moveTo(bx + Math.cos(a) * l * 0.45, y + Math.sin(a) * l * 0.45);
      } else g.moveTo(bx, y);
      g.lineTo(bx + Math.cos(a) * l, y + Math.sin(a) * l);
    }
    g.stroke();
  }
}

/**
 * The meadow's small life, in clumps rather than an even sprinkle: daisies
 * and buttercups gathered in drifts, clover patches, dandelion clocks.
 * free(x, y) is true where nothing is built.
 */
export function meadowLife(g, rnd, x0, y0, w, h, free, n) {
  const DRIFTS = [
    ["#ffffff", "#ffcf3a"],
    ["#fff3a6", "#e8a21a"],
    ["#ffc4dc", "#ff8fb8"],
    ["#cfe2ff", "#7fa8ff"],
    ["#ffffff", "#ffcf3a"],
  ];
  for (let i = 0; i < n; i++) {
    const cx = x0 + rnd() * w,
      cy = y0 + rnd() * h,
      kind = rnd();
    if (!free(cx, cy)) continue;
    if (kind < 0.5) {
      // A drift of one flower: 4–9 heads round a centre.
      const [petal, eye] = DRIFTS[i % DRIFTS.length],
        m = 4 + Math.floor(rnd() * 6);
      for (let k = 0; k < m; k++) {
        const x = cx + (rnd() - 0.5) * 34,
          y = cy + (rnd() - 0.5) * 18;
        if (!free(x, y)) continue;
        flower(g, x, y, petal, eye, 0.8 + rnd() * 0.5);
      }
    } else if (kind < 0.82) {
      // A clover patch: darker trefoils with a pale chevron.
      const m = 5 + Math.floor(rnd() * 6);
      for (let k = 0; k < m; k++) {
        const x = cx + (rnd() - 0.5) * 30,
          y = cy + (rnd() - 0.5) * 16;
        if (!free(x, y)) continue;
        for (let l = 0; l < 3; l++) {
          const a = -Math.PI / 2 + (l * Math.PI * 2) / 3;
          g.fillStyle = "#4e9e3e";
          g.beginPath();
          g.arc(x + Math.cos(a) * 2.2, y + Math.sin(a) * 1.6, 2.1, 0, 7);
          g.fill();
        }
        g.fillStyle = "rgba(200,240,170,.55)";
        g.fillRect(x - 0.6, y - 1.2, 1.2, 1.2);
      }
    } else {
      // Dandelion clocks: a stalk and a soft white globe.
      const m = 1 + Math.floor(rnd() * 3);
      for (let k = 0; k < m; k++) {
        const x = cx + (rnd() - 0.5) * 22,
          y = cy + (rnd() - 0.5) * 12;
        if (!free(x, y)) continue;
        g.strokeStyle = "#5c9a3e";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 0.5, y - 8);
        g.stroke();
        g.fillStyle = "rgba(255,255,255,.55)";
        g.beginPath();
        g.arc(x + 0.5, y - 10, 3.6, 0, 7);
        g.fill();
        g.fillStyle = "rgba(255,255,255,.9)";
        g.beginPath();
        g.arc(x - 0.4, y - 11, 1.6, 0, 7);
        g.fill();
      }
    }
  }
}

/** A five-petalled flower head with a coloured eye. */
export function flower(g, x, y, petal, eye, s = 1) {
  g.fillStyle = "rgba(40,90,30,.28)";
  g.beginPath();
  g.ellipse(x + 1, y + 1.6, 3.4 * s, 1.6 * s, 0, 0, 7);
  g.fill();
  g.fillStyle = petal;
  g.beginPath();
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
    g.moveTo(x + Math.cos(a) * 2.3 * s + 1.7 * s, y + Math.sin(a) * 2 * s);
    g.arc(x + Math.cos(a) * 2.3 * s, y + Math.sin(a) * 2 * s, 1.7 * s, 0, 7);
  }
  g.fill();
  g.fillStyle = eye;
  g.beginPath();
  g.arc(x, y, 1.15 * s, 0, 7);
  g.fill();
}

/**
 * Leaves fallen round a tree's foot, in its own colours (fruit trees drop
 * the odd fruit too). Drawn in the ground, under the tree and its shadow.
 */
export function fallenLeaves(g, rnd, x, y, kind, free) {
  const COL = {
    round: ["#4f9a52", "#7cbf5c", "#c2c765"],
    mint: ["#3fae86", "#6fd0aa", "#c2c765"],
    lime: ["#8cc63e", "#b5e060", "#d8c45a"],
    autumn: ["#e8882e", "#f2b440", "#c9582a"],
    cherry: ["#ffc4dc", "#ffe0ec", "#ff9fc4"],
    apple: ["#5ea84a", "#86c25a", "#d8423a"],
    orange: ["#3f9d4a", "#6fbf55", "#f39a2c"],
    pine: ["#6b5a3a", "#8a7348", "#5a4a2e"],
  };
  const cols = COL[kind] || COL.round,
    n = kind === "autumn" || kind === "cherry" ? 22 : 9;
  for (let i = 0; i < n; i++) {
    const a = rnd() * Math.PI * 2,
      r = 18 + rnd() * 52,
      lx = x + Math.cos(a) * r,
      ly = y + 6 + Math.sin(a) * r * 0.45;
    if (!free(lx, ly)) continue;
    const c = cols[Math.floor(rnd() * cols.length)];
    g.save();
    g.translate(lx, ly);
    g.rotate(rnd() * Math.PI);
    if (kind === "pine") {
      // Needles and a cone or two.
      g.strokeStyle = c;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-3, 0);
      g.lineTo(3, 0.6);
      g.stroke();
      if (i % 5 === 0) {
        g.fillStyle = "#7a5a34";
        g.beginPath();
        g.ellipse(0, 0, 3.2, 2, 0, 0, 7);
        g.fill();
      }
    } else if (c === "#d8423a" || c === "#f39a2c") {
      g.fillStyle = c;
      g.beginPath();
      g.arc(0, 0, 3, 0, 7);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.5)";
      g.fillRect(-1.5, -1.6, 1.2, 1.2);
    } else {
      g.fillStyle = c;
      g.beginPath();
      g.ellipse(0, 0, 3.4, 1.7, 0, 0, 7);
      g.fill();
      g.strokeStyle = rgba(dk(c, 0.35), 0.6);
      g.lineWidth = 0.5;
      g.beginPath();
      g.moveTo(-3, 0);
      g.lineTo(3, 0);
      g.stroke();
    }
    g.restore();
  }
}

/**
 * Mottled light across the open grass, as from clouds and the lie of the
 * land, and darker grass in hollows: big soft patches, few of them.
 */
export function grassLight(g, rnd, x0, y0, w, h, n) {
  for (let i = 0; i < n; i++) {
    const x = x0 + rnd() * w,
      y = y0 + rnd() * h,
      rx = 140 + rnd() * 260,
      ry = rx * (0.45 + rnd() * 0.25),
      lit = rnd() < 0.55;
    const gr = g.createRadialGradient(x, y, 0, x, y, rx);
    const c = lit ? "196,236,120" : "38,96,48";
    gr.addColorStop(0, `rgba(${c},${lit ? 0.16 : 0.14})`);
    gr.addColorStop(1, `rgba(${c},0)`);
    g.save();
    g.translate(x, y);
    g.scale(1, ry / rx);
    g.translate(-x, -y);
    g.fillStyle = gr;
    g.fillRect(x - rx, y - rx, rx * 2, rx * 2);
    g.restore();
  }
}

export { mix, lt, dk };

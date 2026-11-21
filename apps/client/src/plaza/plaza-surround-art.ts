/*
 * The Plaza's surroundings, drawn (plaza-surround.ts says what and where).
 *
 * The Plaza's ground picture is one meadow reaching PLAZA_MARGIN past each
 * edge (plaza-scene.ts paintBg), grass all over at one density, so there
 * is no seam where the Plaza ends; the world around it is painted into it
 * once (paintSurroundings), with every prop that can never be drawn over a
 * walker. The river is a hole in
 * the meadow; its water is drawn under it every frame (ripples drifting
 * with the current, glints, ducks, a moored boat bobbing, the far bank's
 * lamps trembling on it at night), so the footbridges baked over it cover
 * it as they should. The park's kites and its balloon move, so they are
 * drawn every frame too, under everyone (they never reach a walker's
 * picture).
 */
import { GFX as GFX0 } from "../hub-art/gfx";
import { PLAZA, PLAZA_GATE } from "../../../../packages/shared/src/plaza";
import {
  BAKED,
  KITES,
  LIVE,
  RIVER_LAMPS,
  PARK,
  PLAZA_MARGIN,
  PLAZA_SCALE,
  RIVER,
  SURROUND,
  balloonAt,
  propBox,
  type SurroundProp,
} from "./plaza-surround";
import { spot, type Drawable } from "./plaza-depth";

// The hub art is ported, untyped drawing code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const GFX: any = GFX0;
type Ctx = CanvasRenderingContext2D;
const W = PLAZA.width,
  H = PLAZA.height,
  M = PLAZA_MARGIN;

const TREE_KINDS = ["round", "mint", "lime", "autumn", "apple", "cherry"];
const treeSprite = (p: SurroundProp) =>
  p.kind === "pine"
    ? GFX.tree("pine", 40 + (p.v % 4), Math.round(p.s * 8) / 8)
    : GFX.tree(
        TREE_KINDS[p.v % TREE_KINDS.length],
        50 + (p.v % 5),
        Math.round(p.s * 8) / 8,
      );

/** Draw one prop at rest (baked, or live without its motion). */
export function drawProp(g: Ctx, p: SurroundProp, time = 0) {
  switch (p.kind) {
    case "tree":
    case "pine":
      GFX.drawTree(g, treeSprite(p), p.x, p.y, time, p.v);
      return;
    case "bush":
      GFX.shadow(g, p.x + 5, p.y + 2, 32 * p.s, 8 * p.s);
      GFX.blit(
        g,
        GFX.bush(
          p.v % 3 ? "green" : "flower",
          60 + (p.v % 6),
          Math.round(70 * p.s),
        ),
        p.x,
        p.y + 4,
      );
      return;
    case "rock":
      GFX.shadow(g, p.x + 4, p.y + 2, 24 * p.s, 6 * p.s);
      GFX.blit(g, GFX.rock(70 + (p.v % 4), Math.round(46 * p.s)), p.x, p.y + 4);
      return;
    case "gazebo":
      GFX.shadow(g, p.x + 16, p.y + 4, 120, 20);
      blitSprite(g, gazebo(), p.x, p.y, p.s);
      return;
    case "balloon":
      // Only its shadow on the meadow: the balloon itself floats, drawn
      // every frame (drawFieldLife).
      GFX.shadow(g, p.x, p.y, 38 * p.s, 10 * p.s, 0.16);
      return;
    case "picnic":
      blitSprite(g, picnic(p.v), p.x, p.y, p.s);
      return;
    case "bench":
      GFX.shadow(g, p.x + 4, p.y + 2, 46, 8);
      GFX.blit(g, GFX.bench(), p.x, p.y + 4, p.s);
      return;
    case "lamp":
      GFX.shadow(g, p.x + 6, p.y + 2, 18, 6);
      GFX.blit(g, GFX.lamp(), p.x, p.y + 4, PLAZA_SCALE.lamp * p.s);
      return;
  }
}

/* ---------- the park's own pictures (painted once each) ---------- */
interface Spr {
  c: HTMLCanvasElement;
  w: number;
  h: number;
  ax: number;
  ay: number;
}
const sprites = new Map<string, Spr>();
function sprite(
  key: string,
  w: number,
  h: number,
  ax: number,
  ay: number,
  fn: (g: Ctx) => void,
): Spr {
  let s = sprites.get(key);
  if (s) return s;
  const R = 2,
    c = document.createElement("canvas");
  c.width = w * R;
  c.height = h * R;
  const g = c.getContext("2d")!;
  g.scale(R, R);
  g.translate(ax, ay);
  g.lineJoin = "round";
  g.lineCap = "round";
  fn(g);
  s = { c, w, h, ax, ay };
  sprites.set(key, s);
  return s;
}
function blitSprite(g: Ctx, s: Spr, x: number, y: number, k = 1) {
  g.drawImage(s.c, x - s.ax * k, y - s.ay * k, s.w * k, s.h * k);
}
const vgrad = (g: Ctx, y0: number, y1: number, a: string, b: string) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  return gr;
};
/** The bandstand: a stone base, six white columns, a scalloped roof in
 * teal and cream with a gold finial, and bunting between the columns. */
function gazebo() {
  return sprite("gazebo", 240, 230, 120, 214, (g) => {
    // Base: two steps of stone.
    g.fillStyle = "#b9b0a0";
    g.beginPath();
    g.ellipse(0, -6, 104, 24, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#e6dfd0";
    g.beginPath();
    g.ellipse(0, -14, 98, 21, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f4efe4";
    g.beginPath();
    g.ellipse(0, -18, 92, 18, 0, 0, Math.PI * 2);
    g.fill();
    // Columns: the far three, then the floor's shade, then the near three.
    const col = (x: number, y: number, far: boolean) => {
      g.fillStyle = far ? "#d9d4ca" : vgrad(g, -140, 0, "#ffffff", "#e3ddd2");
      g.fillRect(x - 4.5, y - 128, 9, 128);
      g.fillStyle = far ? "#c9c2b6" : "#cfc7b9";
      g.fillRect(x - 6, y - 6, 12, 6);
      g.fillRect(x - 6, y - 130, 12, 5);
    };
    for (const [x, y] of [
      [-60, -28],
      [0, -36],
      [60, -28],
    ])
      col(x, y, true);
    // Bunting along the far side.
    const bunting = (pts: number[][], far: boolean) => {
      const C = ["#ff6f9a", "#ffd65b", "#4fb3ff", "#8fe36a"];
      for (let i = 0; i < pts.length - 1; i++) {
        const [x0, y0] = pts[i],
          [x1, y1] = pts[i + 1];
        g.strokeStyle = far ? "#bdb6aa" : "#ffffff";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x0, y0);
        g.quadraticCurveTo((x0 + x1) / 2, (y0 + y1) / 2 + 10, x1, y1);
        g.stroke();
        for (let k = 1; k < 5; k++) {
          const t = k / 5,
            x = x0 + (x1 - x0) * t,
            y = y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 9;
          g.fillStyle = C[(i + k) % 4];
          g.globalAlpha = far ? 0.6 : 1;
          g.beginPath();
          g.moveTo(x - 4, y);
          g.lineTo(x + 4, y);
          g.lineTo(x, y + 8);
          g.closePath();
          g.fill();
          g.globalAlpha = 1;
        }
      }
    };
    bunting(
      [
        [-90, -138],
        [-60, -150],
        [0, -158],
        [60, -150],
        [90, -138],
      ],
      true,
    );
    for (const [x, y] of [
      [-90, -14],
      [-32, -4],
      [32, -4],
      [90, -14],
    ])
      col(x, y, false);
    bunting(
      [
        [-90, -132],
        [-32, -122],
        [32, -122],
        [90, -132],
      ],
      false,
    );
    // Roof: a cone in panels, cream and teal, scalloped at its edge.
    const eave = -140,
      top = -205;
    g.fillStyle = "rgba(0,0,0,.18)";
    g.beginPath();
    g.ellipse(0, eave + 4, 112, 22, 0, 0, Math.PI * 2);
    g.fill();
    for (let i = 0; i < 8; i++) {
      const a0 = Math.PI + (i / 8) * Math.PI,
        a1 = Math.PI + ((i + 1) / 8) * Math.PI;
      g.fillStyle = i % 2 ? "#2fa59a" : "#f7f0dd";
      g.beginPath();
      g.moveTo(0, top);
      g.lineTo(Math.cos(a0) * 110, eave + Math.sin(a0) * -20 * -1);
      g.lineTo(Math.cos(a1) * 110, eave + Math.sin(a1) * -20 * -1);
      g.closePath();
      g.fill();
    }
    // The front of the cone (toward the viewer), panels again.
    for (let i = 0; i < 8; i++) {
      const a0 = (i / 8) * Math.PI,
        a1 = ((i + 1) / 8) * Math.PI;
      g.fillStyle = i % 2 ? "#249086" : "#efe6cf";
      g.beginPath();
      g.moveTo(0, top);
      g.lineTo(Math.cos(a0) * 110, eave + Math.sin(a0) * 20);
      g.lineTo(Math.cos(a1) * 110, eave + Math.sin(a1) * 20);
      g.closePath();
      g.fill();
    }
    // Scallops round the eave.
    for (let i = 0; i <= 16; i++) {
      const a = (i / 16) * Math.PI;
      g.fillStyle = i % 2 ? "#249086" : "#efe6cf";
      g.beginPath();
      g.arc(Math.cos(a) * 106, eave + Math.sin(a) * 20 + 2, 7, 0, Math.PI);
      g.fill();
    }
    // A light from the top left, and the finial.
    const sh = g.createLinearGradient(-110, 0, 110, 0);
    sh.addColorStop(0, "rgba(255,255,255,.18)");
    sh.addColorStop(0.6, "rgba(0,0,0,0)");
    sh.addColorStop(1, "rgba(0,0,0,.18)");
    g.fillStyle = sh;
    g.beginPath();
    g.moveTo(0, top);
    g.lineTo(-110, eave);
    g.ellipse(0, eave, 110, 20, 0, Math.PI, 0, true);
    g.closePath();
    g.fill();
    g.fillStyle = "#e0a020";
    g.fillRect(-1.5, top - 12, 3, 12);
    g.fillStyle = "#ffd65b";
    g.beginPath();
    g.arc(0, top - 14, 5, 0, Math.PI * 2);
    g.fill();
  });
}
/** A picnic: a chequered blanket, a basket, and something on a plate. */
function picnic(v: number) {
  const C = [
    ["#ef4f61", "#fff6f0"],
    ["#4fb3ff", "#f4fbff"],
    ["#ffd65b", "#fffaf0"],
    ["#8fe36a", "#f6fff0"],
  ][v % 4];
  return sprite(`picnic:${v % 4}`, 110, 60, 55, 40, (g) => {
    g.save();
    g.scale(1, 0.5);
    g.rotate(((v % 3) - 1) * 0.12);
    g.fillStyle = "rgba(0,0,0,.18)";
    g.fillRect(-44, -28, 92, 64);
    g.fillStyle = C[1];
    g.fillRect(-46, -32, 92, 64);
    g.fillStyle = C[0];
    for (let i = 0; i < 6; i++) {
      g.globalAlpha = 0.75;
      g.fillRect(-46 + i * 16 + 4, -32, 8, 64);
      g.fillRect(-46, -32 + i * 12 + 3, 92, 6);
    }
    g.globalAlpha = 1;
    g.restore();
    // The basket, lid open.
    g.fillStyle = vgrad(g, -22, 0, "#d9a066", "#9a6a3a");
    g.beginPath();
    g.roundRect(-36, -20, 26, 18, 4);
    g.fill();
    g.strokeStyle = "#7a4e26";
    g.lineWidth = 1;
    for (let k = 0; k < 4; k++) {
      g.beginPath();
      g.moveTo(-34, -16 + k * 4);
      g.lineTo(-12, -16 + k * 4);
      g.stroke();
    }
    g.strokeStyle = "#7a4e26";
    g.lineWidth = 2;
    g.beginPath();
    g.arc(-23, -20, 9, Math.PI, 0);
    g.stroke();
    // A plate with a slice of cake, and a cup.
    g.fillStyle = "#ffffff";
    g.beginPath();
    g.ellipse(14, -4, 11, 5, 0, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#ffd0de";
    g.beginPath();
    g.moveTo(8, -6);
    g.lineTo(20, -9);
    g.lineTo(18, -3);
    g.closePath();
    g.fill();
    g.fillStyle = "#ff6f9a";
    g.beginPath();
    g.arc(18, -9, 1.8, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = "#f4f1ea";
    g.fillRect(30, -12, 7, 9);
    g.fillStyle = "#a0653a";
    g.fillRect(31, -11, 5, 2);
  });
}
/** The hot-air balloon: striped envelope, ropes and a wicker basket. */
function balloon() {
  return sprite("balloon", 120, 170, 60, 160, (g) => {
    const C = ["#ef4f61", "#ffd65b", "#4fb3ff", "#ffffff", "#8fe36a"];
    // Basket and ropes.
    g.strokeStyle = "#6a4a2c";
    g.lineWidth = 1.2;
    for (const x of [-12, 12]) {
      g.beginPath();
      g.moveTo(x * 2.6, -64);
      g.lineTo(x, -18);
      g.stroke();
    }
    g.fillStyle = vgrad(g, -20, 0, "#d9a066", "#8a5a30");
    g.beginPath();
    g.roundRect(-14, -20, 28, 20, 3);
    g.fill();
    g.fillStyle = "#6a4a2c";
    g.fillRect(-15, -21, 30, 3);
    // Envelope: gores in colour, round at the top, tapering down.
    const env = () => {
      g.beginPath();
      g.moveTo(-14, -60);
      g.bezierCurveTo(-58, -80, -60, -150, 0, -156);
      g.bezierCurveTo(60, -150, 58, -80, 14, -60);
      g.closePath();
    };
    g.save();
    env();
    g.clip();
    for (let i = -3; i <= 3; i++) {
      g.fillStyle = C[(i + 5) % C.length];
      g.beginPath();
      g.moveTo(i * 4, -60);
      g.bezierCurveTo(i * 16 - 8, -100, i * 20 - 10, -150, 0, -158);
      g.bezierCurveTo(i * 20 + 10, -150, i * 16 + 8, -100, i * 4 + 4, -60);
      g.closePath();
      g.fill();
    }
    const sh = g.createRadialGradient(-20, -125, 4, 0, -110, 70);
    sh.addColorStop(0, "rgba(255,255,255,.45)");
    sh.addColorStop(0.5, "rgba(255,255,255,0)");
    sh.addColorStop(1, "rgba(0,0,30,.28)");
    g.fillStyle = sh;
    g.fillRect(-60, -160, 120, 100);
    g.restore();
    g.fillStyle = "#7a4e26";
    g.fillRect(-14, -62, 28, 4);
  });
}
/** A diamond kite and its tail, dancing; its string down to a picnic. */
function drawKite(
  g: Ctx,
  k: (typeof KITES)[number],
  t: number,
  reduced: boolean,
) {
  const sway = reduced ? 0 : Math.sin(t * 0.9 + k.ph),
    x = k.x + sway * 14,
    y = k.y + (reduced ? 0 : Math.sin(t * 1.4 + k.ph) * 8),
    tilt = sway * 0.18;
  g.strokeStyle = "rgba(255,255,255,.75)";
  g.lineWidth = 0.8;
  g.beginPath();
  g.moveTo(k.at.x, k.at.y - 12);
  g.quadraticCurveTo((x + k.at.x) / 2 + 20, (y + k.at.y) / 2 + 24, x, y + 16);
  g.stroke();
  g.save();
  g.translate(x, y);
  g.rotate(tilt);
  // Tail: bows on a wavy line.
  g.strokeStyle = "rgba(255,255,255,.8)";
  g.beginPath();
  g.moveTo(0, 16);
  for (let i = 1; i <= 4; i++)
    g.lineTo(Math.sin(t * 4 + i + k.ph) * 5, 16 + i * 9);
  g.stroke();
  for (let i = 1; i <= 4; i++) {
    g.fillStyle = k.c[i % 2];
    const bx = Math.sin(t * 4 + i + k.ph) * 5,
      by = 16 + i * 9;
    g.beginPath();
    g.moveTo(bx - 4, by - 2);
    g.lineTo(bx + 4, by + 2);
    g.lineTo(bx + 4, by - 2);
    g.lineTo(bx - 4, by + 2);
    g.closePath();
    g.fill();
  }
  // The kite: four panels in two colours.
  const quad = (pts: number[][], c: string) => {
    g.fillStyle = c;
    g.beginPath();
    pts.forEach(([px, py], i) => (i ? g.lineTo(px, py) : g.moveTo(px, py)));
    g.closePath();
    g.fill();
  };
  quad(
    [
      [0, -18],
      [12, -2],
      [0, 0],
    ],
    k.c[0],
  );
  quad(
    [
      [0, -18],
      [-12, -2],
      [0, 0],
    ],
    k.c[1],
  );
  quad(
    [
      [0, 16],
      [12, -2],
      [0, 0],
    ],
    k.c[1],
  );
  quad(
    [
      [0, 16],
      [-12, -2],
      [0, 0],
    ],
    k.c[0],
  );
  g.strokeStyle = "rgba(60,30,20,.5)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, -18);
  g.lineTo(0, 16);
  g.moveTo(-12, -2);
  g.lineTo(12, -2);
  g.stroke();
  g.restore();
}

/* ---------- ground ---------- */
function rnd(seed: number) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
/** The far bank's stone wall, the near coping, and the footbridges. */
function paintRiverBanks(g: Ctx) {
  const x0 = -M,
    x1 = W + M;
  // Far wall: its top, then its face down to the water, stone courses.
  g.fillStyle = "#d9d2c2";
  g.fillRect(x0, RIVER.y0 - 20, x1 - x0, 12);
  g.fillStyle = "#9c9282";
  g.fillRect(x0, RIVER.y0 - 8, x1 - x0, 20);
  g.strokeStyle = "rgba(0,0,0,.18)";
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(x0, RIVER.y0 + 2);
  g.lineTo(x1, RIVER.y0 + 2);
  for (let x = x0; x < x1; x += 26) {
    g.moveTo(x, RIVER.y0 - 8);
    g.lineTo(x, RIVER.y0 + 2);
    g.moveTo(x + 13, RIVER.y0 + 2);
    g.lineTo(x + 13, RIVER.y0 + 12);
  }
  g.stroke();
  g.fillStyle = "rgba(30,60,50,.35)";
  g.fillRect(x0, RIVER.y0 + 8, x1 - x0, 4);
  // Near coping, the Plaza's side.
  g.fillStyle = "#cfc6b2";
  g.fillRect(x0, RIVER.y1, x1 - x0, -RIVER.y1);
  g.fillStyle = "rgba(255,255,255,.35)";
  g.fillRect(x0, RIVER.y1, x1 - x0, 2);
}
function paintBridge(g: Ctx, bx: number) {
  const y0 = RIVER.y0 - 22,
    y1 = 4,
    hw = 34;
  // Shadow on the water, then the deck's planks.
  g.fillStyle = "rgba(10,30,40,.3)";
  g.fillRect(bx - hw + 6, y0 + 10, hw * 2, y1 - y0);
  g.fillStyle = "#a9773f";
  g.fillRect(bx - hw, y0, hw * 2, y1 - y0);
  g.strokeStyle = "#7a5230";
  g.lineWidth = 1.5;
  g.beginPath();
  for (let y = y0 + 8; y < y1; y += 9) {
    g.moveTo(bx - hw, y);
    g.lineTo(bx + hw, y);
  }
  g.stroke();
  // The deck's edge facing the water on each side, and the railings.
  for (const side of [-1, 1]) {
    const x = bx + side * hw;
    g.fillStyle = "#6a4426";
    g.fillRect(side < 0 ? x : x - 5, y0, 5, y1 - y0);
    g.fillStyle = "#8a5a30";
    for (let y = y0 + 4; y <= y1; y += 24) g.fillRect(x - 2.5, y - 26, 5, 28);
    g.fillRect(x - 2.5, y0 - 24, 5, y1 - y0 + 4);
  }
}
/** The verge north of the Plaza (inside its own ground picture): flowers and a railing. */
export function paintVerge(g: Ctx) {
  const r = rnd(77);
  const shade = g.createLinearGradient(0, 0, 0, 112);
  shade.addColorStop(0, "rgba(60,90,40,.2)");
  shade.addColorStop(1, "rgba(60,90,40,0)");
  g.fillStyle = shade;
  g.fillRect(0, 0, W, 112);
  for (let x = 14; x < W; x += 34 + r() * 20) {
    if (RIVER.bridges.some((b) => Math.abs(x - b) < 50)) continue;
    const c = ["#ffffff", "#fff3a6", "#ffc4dc", "#cfe2ff", "#ff9bb5"][
      Math.floor(r() * 5)
    ];
    const y = 70 + r() * 22;
    g.fillStyle = "#4f9a3c";
    g.beginPath();
    g.ellipse(x, y + 3, 9, 4, 0, 0, 7);
    g.fill();
    for (let k = 0; k < 5; k++) {
      g.fillStyle = c;
      g.beginPath();
      g.arc(
        x + Math.cos(k * 1.256) * 3,
        y + Math.sin(k * 1.256) * 3,
        2.4,
        0,
        7,
      );
      g.fill();
    }
  }
  // A white railing along the bank; open where the footbridges land.
  const yr = 100;
  g.fillStyle = "rgba(0,0,0,.14)";
  g.fillRect(0, yr + 1, W, 4);
  for (let x = 8; x < W; x += 28) {
    if (RIVER.bridges.some((b) => Math.abs(x - b) < 30)) continue;
    g.fillStyle = "#e9e4da";
    g.fillRect(x - 3, yr - 30, 6, 32);
    g.fillStyle = "#ffffff";
    g.fillRect(x - 3, yr - 30, 6, 4);
  }
  g.fillStyle = "#f4f0e8";
  let x = 0;
  for (const b of [...RIVER.bridges, W + 40]) {
    const a = x,
      e = Math.min(W, b - 30);
    g.fillRect(a, yr - 26, e - a, 4);
    g.fillRect(a, yr - 14, e - a, 3);
    x = b + 30;
  }
  // Gate posts where each footbridge lands.
  for (const b of RIVER.bridges)
    for (const side of [-1, 1]) {
      g.fillStyle = "#c48a4a";
      g.fillRect(b + side * 34 - 5, yr - 40, 10, 42);
      g.fillStyle = "#ffd65b";
      g.beginPath();
      g.arc(b + side * 34, yr - 43, 5, 0, 7);
      g.fill();
    }
}
/** The park south of the gate: a hedge, the lane down to a circle round a
 * flower bed, and a meadow of wildflowers in drifts. */
function paintPark(g: Ctx, r: () => number) {
  const y0 = H,
    y1 = H + M;
  const lane = PARK.lane,
    C = PARK.circle;
  // A hedge line right past the Plaza's flower border, open for the lane.
  g.fillStyle = "#3f8f3a";
  for (let x = -M; x < W + M; x += 22) {
    if (x > lane.x0 - 10 && x < lane.x1 + 10) continue;
    g.beginPath();
    g.arc(x, y0 + 8, 13, 0, 7);
    g.fill();
  }
  g.fillStyle = "#5fb34c";
  for (let x = -M + 6; x < W + M; x += 22) {
    if (x > lane.x0 - 10 && x < lane.x1 + 10) continue;
    g.beginPath();
    g.arc(x, y0 + 4, 7, 0, 7);
    g.fill();
  }
  // Mown stripes across the meadow, faint.
  for (let y = y0 + 26, i = 0; y < y1; y += 34, i++)
    if (i % 2) {
      g.fillStyle = "rgba(255,255,255,.05)";
      g.fillRect(-M, y, W + 2 * M, 34);
    }
  // Wildflowers in drifts: each drift one colour, thinning at its edge.
  const COLS = [
    "#ffffff",
    "#fff3a6",
    "#ffc4dc",
    "#cfe2ff",
    "#ffb04a",
    "#e0b8ff",
  ];
  for (let d = 0; d < 46; d++) {
    const cx = -M + r() * (W + 2 * M),
      cy = y0 + 40 + r() * (M - 50),
      rr = 50 + r() * 70,
      c = COLS[d % COLS.length];
    if (cx > lane.x0 - 30 && cx < lane.x1 + 30) continue;
    if (((cx - C.x) / (C.rx + 40)) ** 2 + ((cy - C.y) / (C.ry + 30)) ** 2 < 1)
      continue;
    for (let k = 0; k < 60; k++) {
      const a = r() * Math.PI * 2,
        q = Math.sqrt(r()) * rr,
        x = cx + Math.cos(a) * q,
        y = cy + Math.sin(a) * q * 0.45;
      if (x > lane.x0 - 8 && x < lane.x1 + 8) continue;
      g.fillStyle = "#4f9a3c";
      g.fillRect(x - 0.5, y, 1, 4);
      g.fillStyle = c;
      g.beginPath();
      g.arc(x, y, 2 + r() * 1.2, 0, 7);
      g.fill();
    }
  }
  // The lane: a gravel bed with stones, down to the circle.
  const stones = (x0: number, x1: number, ya: number, yb: number) => {
    for (let y = ya, row = 0; y < yb; y += 18, row++)
      for (let x = x0 + 10 + (row % 2) * 11; x < x1 - 8; x += 22) {
        g.fillStyle = "rgba(120,100,60,.4)";
        g.beginPath();
        g.roundRect(x - 9, y - 5, 18, 13, 5);
        g.fill();
        g.fillStyle = ["#efe3c8", "#e6d6b4", "#f4ead6"][((row + x) % 3) | 0];
        g.beginPath();
        g.roundRect(x - 9, y - 7, 18, 13, 5);
        g.fill();
      }
  };
  // (From the gate itself: through the flower border, then the hedge.)
  const gy = PLAZA_GATE.y + 24;
  g.fillStyle = "#d9c9a3";
  g.fillRect(lane.x0, gy, lane.x1 - lane.x0, C.y - gy);
  stones(lane.x0, lane.x1, gy + 8, C.y - C.ry + 10);
  // The circle round its flower bed.
  g.fillStyle = "rgba(60,90,40,.3)";
  g.beginPath();
  g.ellipse(C.x, C.y + 4, C.rx + 10, C.ry + 8, 0, 0, 7);
  g.fill();
  g.fillStyle = "#d9c9a3";
  g.beginPath();
  g.ellipse(C.x, C.y, C.rx, C.ry, 0, 0, 7);
  g.fill();
  g.save();
  g.beginPath();
  g.ellipse(C.x, C.y, C.rx - 6, C.ry - 4, 0, 0, 7);
  g.clip();
  stones(C.x - C.rx, C.x + C.rx, C.y - C.ry, C.y + C.ry);
  g.restore();
  g.fillStyle = "#3f8a37";
  g.beginPath();
  g.ellipse(C.x, C.y, 54, 27, 0, 0, 7);
  g.fill();
  g.fillStyle = "#6a4a2c";
  g.beginPath();
  g.ellipse(C.x, C.y, 48, 23, 0, 0, 7);
  g.fill();
  const BED = ["#ff6f9a", "#ffd65b", "#ffffff", "#c47dff"];
  for (let ring = 0; ring < 4; ring++) {
    const rx = 40 - ring * 11,
      ry = 19 - ring * 5.2,
      n = Math.max(1, Math.round(rx * 0.7));
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2,
        x = C.x + Math.cos(a) * rx,
        y = C.y + Math.sin(a) * ry;
      g.fillStyle = BED[ring];
      g.beginPath();
      g.arc(x, y - 1, 3, 0, 7);
      g.fill();
    }
  }
}
/** The woods west or east: a darker floor, deeper in. */
function paintWoods(g: Ctx, side: -1 | 1, r: () => number) {
  const x0 = side < 0 ? -M : W,
    x1 = side < 0 ? 0 : W + M;
  // The meadow's own grass, darker deeper into the woods.
  const gr = g.createLinearGradient(
    side < 0 ? 0 : W,
    0,
    side < 0 ? -M : W + M,
    0,
  );
  // Darker deeper in, from nothing at the Plaza's edge (no seam there).
  gr.addColorStop(0, "rgba(30,70,30,0)");
  gr.addColorStop(0.3, "rgba(30,70,30,0)");
  gr.addColorStop(1, "rgba(30,70,30,.3)");
  g.fillStyle = gr;
  g.fillRect(x0, 0, x1 - x0, H);
  // The verge's shade along the river carries on into the woods.
  const verge = g.createLinearGradient(0, 0, 0, 112);
  verge.addColorStop(0, "rgba(60,90,40,.2)");
  verge.addColorStop(1, "rgba(60,90,40,0)");
  g.fillStyle = verge;
  g.fillRect(x0, 0, x1 - x0, 112);
  // Fallen leaves and ferns.
  for (let i = 0; i < 260; i++) {
    // (Only in the woods, not at the Plaza's edge.)
    const deep = 60 + r() * (M - 60),
      x = side < 0 ? -deep : W + deep,
      y = r() * H;
    g.fillStyle = ["#c98a3a", "#e0a84a", "#5f9a3c", "#3f7f34"][i % 4];
    g.beginPath();
    g.ellipse(x, y, 4, 2, r() * 3, 0, 7);
    g.fill();
  }
}

/**
 * Paint the world around the Plaza into the meadow (the Plaza's own ground
 * picture, which reaches PLAZA_MARGIN past each edge and is already grass
 * everywhere): the river's banks with a hole for its water, the
 * footbridges, the woods' shade, the fields, then every prop that is never
 * drawn over a walker. `g` draws in world coordinates.
 */
export function paintSurroundings(g: Ctx) {
  const r = rnd(9001);
  paintRiverBanks(g);
  // The water's hole: the water is drawn every frame under the meadow.
  g.save();
  g.globalCompositeOperation = "destination-out";
  // (Opaque: a translucent fill would leave the banks' colour over it.)
  g.fillStyle = "#000";
  g.fillRect(-M, RIVER.y0 + 12, W + 2 * M, RIVER.y1 - RIVER.y0 - 12);
  g.restore();
  for (const b of RIVER.bridges) paintBridge(g, b);
  paintWoods(g, -1, r);
  paintWoods(g, 1, r);
  paintPark(g, r);
  for (const p of [...BAKED].sort((a, b) => a.y - b.y)) drawProp(g, p);
}

/* ---------- every frame ---------- */
const DUCKS = [
  { kind: "drake", y: -60, speed: 14, off: 0 },
  { kind: "hen", y: -48, speed: 14, off: 26 },
  { kind: "hen", y: -100, speed: 9, off: 1400 },
];
const BOAT = { x: 300, y: -40 };
/** The river's water, under the meadow's hole (call before drawing the meadow). */
export function drawRiver(
  g: Ctx,
  t: number,
  n: number,
  low: boolean,
  vx0: number,
  vy0: number,
  vx1: number,
) {
  const top = RIVER.y0 + 12,
    bot = RIVER.y1;
  if (vy0 > bot) return;
  const xa = Math.max(-M, vx0 - 4),
    xb = Math.min(W + M, vx1 + 4);
  const gr = g.createLinearGradient(0, top, 0, bot);
  gr.addColorStop(0, "#2f7f9e");
  gr.addColorStop(0.5, "#4aa7c4");
  gr.addColorStop(1, "#6cc3d6");
  g.fillStyle = gr;
  g.fillRect(xa, top, xb - xa, bot - top);
  // The far wall's shadow on the water.
  g.fillStyle = `rgba(10,30,40,${0.26 - n * 0.1})`;
  g.fillRect(xa, top, xb - xa, 18);
  // Ripples drifting with the current (east), in rows across the river.
  const rows = low ? 3 : 5,
    step = low ? 90 : 64;
  g.lineCap = "round";
  g.lineWidth = 1.6;
  g.strokeStyle = n > 0.5 ? "rgba(150,180,230,.25)" : "rgba(255,255,255,.42)";
  g.beginPath();
  for (let r = 0; r < rows; r++) {
    const y = top + 24 + ((bot - top - 34) * (r + 0.5)) / rows;
    const off = (t * (16 + r * 3) + r * 37) % step;
    for (let x = Math.floor(xa / step) * step + off - step; x < xb; x += step) {
      const k = Math.floor(x / step) + r * 31;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + k);
      if (pulse < 0.25) continue;
      const len = 16 + ((k * 7919) % 17);
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y - 2.5, x + len, y);
    }
  }
  g.stroke();
  g.lineCap = "butt";
  // Glints of the sun twinkling.
  if (!low && n < 0.6) {
    for (let i = Math.floor(xa / 40); i < xb / 40; i++) {
      const tw = Math.sin(t * 3 + i * 1.7);
      if (tw < 0.6) continue;
      const x = i * 40 + ((i * 37) % 23),
        y = top + 26 + ((i * 53) % (bot - top - 34));
      g.fillStyle = `rgba(255,255,240,${(tw - 0.6) * 2})`;
      g.beginPath();
      g.moveTo(x, y - 2.5);
      g.lineTo(x + 4, y);
      g.lineTo(x, y + 2.5);
      g.lineTo(x - 4, y);
      g.fill();
    }
  }
  // A rowing boat moored by the near bank, bobbing.
  if (BOAT.x > xa - 80 && BOAT.x < xb + 80) {
    const bob = Math.sin(t * 1.3) * 1.6;
    g.save();
    g.translate(BOAT.x, BOAT.y + bob);
    g.rotate(Math.sin(t * 1.1 + 1) * 0.03);
    g.fillStyle = "rgba(10,30,40,.25)";
    g.beginPath();
    g.ellipse(0, 4, 50, 8, 0, 0, 7);
    g.fill();
    g.fillStyle = "#f4f1ea";
    g.beginPath();
    g.moveTo(-48, -10);
    g.quadraticCurveTo(-42, 4, -30, 4);
    g.lineTo(32, 4);
    g.quadraticCurveTo(46, 2, 50, -12);
    g.closePath();
    g.fill();
    g.fillStyle = "#d94a3a";
    g.fillRect(-40, -6, 80, 3);
    g.fillStyle = "#9a6a3a";
    g.beginPath();
    g.ellipse(0, -11, 44, 5, 0, 0, 7);
    g.fill();
    g.fillStyle = "#b07a44";
    g.fillRect(-5, -15, 10, 8);
    g.restore();
    g.strokeStyle = "#c9a46a";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(BOAT.x - 44, BOAT.y + bob - 8);
    g.quadraticCurveTo(BOAT.x - 60, BOAT.y + 10, BOAT.x - 70, RIVER.y1 + 2);
    g.stroke();
  }
  // Ducks paddling downstream (the whole river's length, round again).
  if (!low) {
    const span = W + 2 * M + 200;
    for (const d of DUCKS) {
      const x = -M - 100 + ((t * d.speed + d.off) % span);
      if (x < xa - 40 || x > xb + 40) continue;
      GFX.duck(g, d.kind, "swim", t + d.off, x, d.y, 1.15, 1, true);
    }
  }
}
/** At night, in the "lighter" pass: the far bank's lamps on the water. */
export function drawRiverLights(
  g: Ctx,
  t: number,
  n: number,
  vx0: number,
  vx1: number,
) {
  if (n < 0.2) return;
  for (const l of RIVER_LAMPS) {
    if (l.x < vx0 - 60 || l.x > vx1 + 60) continue;
    for (let k = 0; k < 6; k++) {
      const w = 12 - k * 1.4 + Math.sin(t * 4 + k * 1.3 + l.x) * 3;
      g.fillStyle = `rgba(255,214,140,${(0.42 - k * 0.06) * n})`;
      g.fillRect(
        l.x - w / 2 + Math.sin(t * 3 + k) * 2,
        RIVER.y0 + 22 + k * 12,
        w,
        3,
      );
    }
  }
}
/** The park's kites and its balloon: moving, never over a walker. */
export function drawFieldLife(
  g: Ctx,
  t: number,
  reduced: boolean,
  vx0: number,
  vy1: number,
  vx1: number,
) {
  if (vy1 < H) return;
  for (const p of SURROUND)
    if (p.kind === "balloon" && p.x > vx0 - 80 && p.x < vx1 + 80) {
      const b = balloonAt(p, reduced ? 0 : t);
      blitSprite(g, balloon(), b.x, b.y, p.s);
    }
  for (const k of KITES)
    if (Math.max(k.x, k.at.x) > vx0 - 60 && Math.min(k.x, k.at.x) < vx1 + 60)
      drawKite(g, k, t, reduced);
}
/** The props drawn live, as depth-sorted drawables. */
export { RIVER_LAMPS };
export function liveDrawables(
  g: Ctx,
  time: number,
  vx0: number,
  vx1: number,
): Drawable[] {
  const out: Drawable[] = [];
  for (const p of LIVE) {
    const b = propBox(p);
    if (b.x1 < vx0 - 20 || b.x0 > vx1 + 20) continue;
    out.push(
      spot(p.x, p.y, 20, p.y - b.top, () => drawProp(g, p, time), {
        sw: (b.x1 - b.x0) / 2,
        name: `surround:${p.kind}`,
      }),
    );
  }
  return out;
}

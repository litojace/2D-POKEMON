/*
 * The Elemental Farm: drawing the land round the farm (farm-scenery.ts says
 * what stands where), and the water, alive.
 *
 * The ground picture (the scene's `bg`) is baked once, with holes where the
 * pond and the brook are (cutWater). The water is drawn under it every
 * frame (drawWater), so the stones round the pond, the banks and the
 * footbridge cover it as they should. As toon water in farm games: a
 * gradient of the sky's colour, short ripple strokes drifting with the
 * brook's current and circling in the pond, glints that twinkle (the moon's
 * at night), lily pads bobbing, a fish leaping now and then, rings when it
 * rains.
 *
 * Props that are never in front of anything live are baked into the ground
 * (drawProp on the ground picture); the rest are drawn live from cached
 * pictures (GFX.sprite, twice the world's resolution), as are the tractor
 * and the brook's ducks.
 */
import { GFX } from "./farm-gfx";
import { POND } from "./farm-layout";
import {
  BRIDGE,
  BROOK,
  FIELDS,
  brookY,
  heightPx,
  widthPx,
  type Prop,
} from "./farm-scenery";

type Ctx = CanvasRenderingContext2D;
// The art module is ported drawing code without types.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const G: any = GFX;

const hash = (n: number) => {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
};
const ell = (g: Ctx, x: number, y: number, rx: number, ry: number, rot = 0) => {
  g.beginPath();
  g.ellipse(x, y, Math.max(0.1, rx), Math.max(0.1, ry), rot, 0, Math.PI * 2);
};
const vg = (g: Ctx, y0: number, y1: number, ...c: string[]) => {
  const gr = g.createLinearGradient(0, y0, 0, y1);
  c.forEach((col, i) =>
    gr.addColorStop(c.length > 1 ? i / (c.length - 1) : 0, col),
  );
  return gr;
};
const OUT = "#5a3a1e";

/* ───────────── pictures (drawn once, 2x) ───────────── */

const memo = new Map<
  string,
  { c: HTMLCanvasElement; w: number; h: number; ax: number; ay: number }
>();
function pic(
  key: string,
  w: number,
  h: number,
  ax: number,
  ay: number,
  fn: (g: Ctx) => void,
) {
  let s = memo.get(key);
  if (!s) {
    s = G.sprite(w, h, ax, ay, fn);
    memo.set(key, s!);
  }
  return s!;
}
const srand = (seed: number) => {
  let x = Math.max(1, Math.floor(seed) % 2147483646);
  return () => (x = (x * 16807) % 2147483647) / 2147483647;
};

/** A round hay bale lying on its side, its rolled face toward the viewer's left. */
function bale(seed: number) {
  const W = widthPx("bale"),
    H = heightPx("bale");
  return pic(`bale:${seed}`, W + 12, H + 12, W / 2 + 6, H + 4, (g) => {
    const r = srand(seed);
    // The body: a short cylinder seen from the side.
    g.fillStyle = vg(g, -H, 0, "#f6dc86", "#e2b74e", "#b88a2c");
    g.beginPath();
    g.roundRect(-W / 2 + H * 0.18, -H, W - H * 0.18, H, H * 0.3);
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1.6;
    g.stroke();
    // Straw strokes along it.
    g.strokeStyle = "rgba(150,100,30,.45)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 16; i++) {
      const y = -H + 6 + r() * (H - 10),
        x = -W / 2 + H * 0.4 + r() * (W - H * 0.6);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + 8 + r() * 10, y + (r() - 0.5) * 3);
      g.stroke();
    }
    // Twine bands.
    g.strokeStyle = "rgba(120,60,30,.6)";
    g.lineWidth = 2;
    for (const f of [0.45, 0.75]) {
      const x = -W / 2 + W * f;
      g.beginPath();
      g.moveTo(x, -H + 2);
      g.lineTo(x, -1);
      g.stroke();
    }
    // The rolled face: a spiral.
    const fx = -W / 2 + H * 0.36,
      fy = -H / 2;
    ell(g, fx, fy, H * 0.36, H / 2 - 1);
    g.fillStyle = vg(g, -H, 0, "#fbe7a2", "#e9c463", "#c99a3a");
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1.6;
    g.stroke();
    g.strokeStyle = "rgba(150,100,30,.6)";
    g.lineWidth = 1.3;
    g.beginPath();
    for (let a = 0; a < Math.PI * 7; a += 0.2) {
      const k = a / (Math.PI * 7);
      const x = fx + Math.cos(a) * H * 0.34 * k,
        y = fy + Math.sin(a) * (H / 2 - 3) * k;
      if (a === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = "rgba(255,250,220,.5)";
    ell(g, fx - 4, fy - H * 0.22, 5, 3);
    g.fill();
  });
}
/** A beehive: two white boxes and a roof, on a little stand. */
function hive(seed: number) {
  const H = heightPx("hive"),
    W = widthPx("hive");
  return pic(`hive:${seed}`, W + 12, H + 10, W / 2 + 6, H + 4, (g) => {
    const tint = ["#fbf3dc", "#f7e7b8", "#e8f2fb"][seed % 3];
    g.fillStyle = "#7a5230";
    g.fillRect(-W / 2 + 2, -8, 3, 8);
    g.fillRect(W / 2 - 5, -8, 3, 8);
    const bh = (H - 14) / 2;
    for (let i = 0; i < 2; i++) {
      const y = -8 - bh * (i + 1);
      g.fillStyle = vg(g, y, y + bh, tint, "#d9cfb6");
      g.beginPath();
      g.roundRect(-W / 2, y, W, bh, 2);
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1.2;
      g.stroke();
    }
    // The roof and the entrance.
    g.fillStyle = vg(g, -H, -H + 8, "#c96a3a", "#8a3e1e");
    g.beginPath();
    g.roundRect(-W / 2 - 3, -H + 2, W + 6, 7, 2);
    g.fill();
    g.stroke();
    g.fillStyle = "#3a2410";
    g.fillRect(-5, -11, 10, 2.5);
  });
}
/** A woodpile: logs stacked between two stakes, their cut ends to the viewer. */
function woodpile(seed: number) {
  const W = widthPx("woodpile"),
    H = heightPx("woodpile");
  return pic(`wood:${seed}`, W + 14, H + 12, W / 2 + 7, H + 4, (g) => {
    const r = srand(seed);
    g.fillStyle = "#6e4524";
    g.fillRect(-W / 2, -H, 5, H);
    g.fillRect(W / 2 - 5, -H, 5, H);
    const rad = 8.5;
    for (let row = 0; row < 3; row++) {
      const y = -rad - row * rad * 1.75,
        n = Math.floor((W - 14) / (rad * 2)) - row;
      for (let i = 0; i < n; i++) {
        const x = -((n - 1) * rad * 2) / 2 + i * rad * 2 + (r() - 0.5) * 1.5;
        ell(g, x, y, rad, rad - 0.5);
        g.fillStyle = "#8a5a30";
        g.fill();
        g.strokeStyle = OUT;
        g.lineWidth = 1.1;
        g.stroke();
        ell(g, x, y, rad - 2.6, rad - 3);
        g.fillStyle = r() < 0.5 ? "#e8c08a" : "#f0cf9c";
        g.fill();
        g.strokeStyle = "rgba(140,90,40,.6)";
        g.lineWidth = 0.8;
        ell(g, x, y, (rad - 3) / 2, (rad - 3) / 2);
        g.stroke();
      }
    }
  });
}
/** A chopping stump with an axe in it. */
function stump() {
  const W = widthPx("stump"),
    H = heightPx("stump");
  return pic("stump", W + 30, H + 36, W / 2 + 15, H + 4, (g) => {
    g.fillStyle = vg(g, -H, 0, "#9a6a3e", "#6e4524");
    g.beginPath();
    g.roundRect(-W / 2, -H + 4, W, H - 4, 4);
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1.3;
    g.stroke();
    ell(g, 0, -H + 4, W / 2, 6);
    g.fillStyle = "#e8c08a";
    g.fill();
    g.stroke();
    // The axe: a handle leaning right, its head in the wood.
    g.strokeStyle = "#a8763e";
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-2, -H + 2);
    g.lineTo(13, -H - 24);
    g.stroke();
    g.fillStyle = "#9aa3b5";
    g.beginPath();
    g.moveTo(-8, -H + 6);
    g.lineTo(4, -H - 2);
    g.lineTo(2, -H + 8);
    g.closePath();
    g.fill();
  });
}
/** A run of dry-stone wall, `len` px long. */
function wall(len: number, seed: number) {
  const H = heightPx("wall");
  return pic(
    `wall:${len}:${seed}`,
    len + 8,
    H + 10,
    len / 2 + 4,
    H + 3,
    (g) => {
      const r = srand(seed);
      g.fillStyle = "rgba(60,60,70,.25)";
      g.fillRect(-len / 2, -4, len, 6);
      const rows = 3,
        rh = H / rows;
      for (let row = 0; row < rows; row++) {
        let x = -len / 2 + (row % 2) * 6;
        while (x < len / 2 - 2) {
          const w = Math.min(len / 2 - x, 12 + r() * 14),
            y = -rh * (row + 1);
          const c = ["#c9cdd6", "#b4b9c4", "#d9dce3", "#a9aeb9"][
            Math.floor(r() * 4)
          ];
          g.fillStyle = c;
          g.beginPath();
          g.roundRect(x + 0.5, y + 0.5, w - 1, rh - 1, 4);
          g.fill();
          g.strokeStyle = "rgba(70,74,90,.7)";
          g.lineWidth = 1;
          g.stroke();
          if (row === rows - 1 && r() < 0.35) {
            g.fillStyle = "rgba(110,170,80,.85)";
            ell(g, x + w / 2, y + 2, w / 2.5, 3);
            g.fill();
          }
          x += w;
        }
      }
    },
  );
}
/** A row of sunflowers, `len` px long. */
function sunrow(len: number, seed: number) {
  const H = heightPx("sunrow");
  return pic(
    `sun:${len}:${seed}`,
    len + 30,
    H + 30,
    len / 2 + 15,
    H + 22,
    (g) => {
      const r = srand(seed);
      const n = Math.floor(len / 26);
      const heads: [number, number, number][] = [];
      for (let i = 0; i < n; i++) {
        const x = -len / 2 + 13 + i * 26 + (r() - 0.5) * 6,
          top = -H * (0.82 + r() * 0.18);
        g.strokeStyle = "#3f8a34";
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + 3, top / 2, x, top);
        g.stroke();
        for (const k of [0.35, 0.6]) {
          const s = r() < 0.5 ? -1 : 1;
          g.fillStyle = s < 0 ? "#4fae46" : "#3c9a3a";
          ell(g, x + s * 8, top * k, 9, 4, s * 0.5);
          g.fill();
        }
        heads.push([x, top, 9 + r() * 3]);
      }
      for (const [x, y, rad] of heads) {
        g.fillStyle = "#ffcb2e";
        for (let k = 0; k < 12; k++) {
          const a = (k / 12) * Math.PI * 2;
          ell(
            g,
            x + Math.cos(a) * rad,
            y + Math.sin(a) * rad * 0.9,
            rad * 0.55,
            rad * 0.25,
            a,
          );
          g.fill();
        }
        ell(g, x, y, rad * 0.62, rad * 0.58);
        g.fillStyle = "#6e3e1c";
        g.fill();
        g.fillStyle = "rgba(255,220,140,.35)";
        ell(g, x - 2, y - 2, rad * 0.25, rad * 0.2);
        g.fill();
      }
    },
  );
}
/** A clump of reeds and cattails at the water's edge. */
function reeds(s: number, seed: number) {
  const H = heightPx("reeds", s),
    W = widthPx("reeds", s);
  return pic(
    `reeds:${Math.round(s * 10)}:${seed}`,
    W + 16,
    H + 10,
    W / 2 + 8,
    H + 4,
    (g) => {
      const r = srand(seed);
      for (let i = 0; i < 9; i++) {
        const x = (r() - 0.5) * W,
          h = H * (0.55 + r() * 0.45),
          lean = (r() - 0.5) * 10;
        g.strokeStyle = i % 2 ? "#4f9a3c" : "#6fb84f";
        g.lineWidth = 2.2;
        g.beginPath();
        g.moveTo(x, 0);
        g.quadraticCurveTo(x + lean / 2, -h / 2, x + lean, -h);
        g.stroke();
        if (i % 3 === 0) {
          g.fillStyle = "#7a4a26";
          g.beginPath();
          g.roundRect(x + lean * 0.85 - 2.2, -h * 0.92, 4.4, 12, 2);
          g.fill();
        }
      }
    },
  );
}
/** A wooden hay cart, parked. */
function cart() {
  const W = widthPx("cart"),
    H = heightPx("cart");
  return pic("cart", W + 16, H + 14, W / 2 + 8, H + 6, (g) => {
    // The shafts on the left, resting on the ground.
    g.strokeStyle = "#8a5a30";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(-W / 2 + 34, -26);
    g.lineTo(-W / 2, -4);
    g.stroke();
    // The bed and its boards.
    g.fillStyle = vg(g, -46, -22, "#d79a5a", "#9a6234");
    g.beginPath();
    g.roundRect(-W / 2 + 30, -48, W - 34, 24, 3);
    g.fill();
    g.strokeStyle = OUT;
    g.lineWidth = 1.5;
    g.stroke();
    g.strokeStyle = "rgba(90,50,20,.45)";
    g.beginPath();
    g.moveTo(-W / 2 + 32, -36);
    g.lineTo(W / 2 - 6, -36);
    g.stroke();
    // The hay piled on it.
    g.fillStyle = vg(g, -H, -44, "#fbe7a2", "#e2b74e");
    g.beginPath();
    g.moveTo(-W / 2 + 34, -46);
    g.quadraticCurveTo(-W / 2 + 44, -H + 4, -10, -H);
    g.quadraticCurveTo(W / 2 - 20, -H + 6, W / 2 - 8, -46);
    g.closePath();
    g.fill();
    g.strokeStyle = "#b88a2c";
    g.lineWidth = 1.4;
    g.stroke();
    g.strokeStyle = "rgba(150,100,30,.5)";
    for (let i = 0; i < 12; i++) {
      const x = -W / 2 + 46 + i * ((W - 70) / 12);
      g.beginPath();
      g.moveTo(x, -50);
      g.lineTo(x + 6, -H + 14 + (i % 3) * 5);
      g.stroke();
    }
    // Two wheels.
    for (const x of [-W / 2 + 56, W / 2 - 34]) {
      ell(g, x, -16, 16, 16);
      g.fillStyle = "#7a4a26";
      g.fill();
      g.strokeStyle = OUT;
      g.lineWidth = 1.5;
      g.stroke();
      ell(g, x, -16, 11, 11);
      g.fillStyle = "#c48a4a";
      g.fill();
      g.strokeStyle = "#7a4a26";
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI;
        g.moveTo(x + Math.cos(a) * 11, -16 + Math.sin(a) * 11);
        g.lineTo(x - Math.cos(a) * 11, -16 - Math.sin(a) * 11);
      }
      g.stroke();
    }
  });
}

/* ───────────── drawing a prop ───────────── */

const trees = new Map<string, unknown>();
/** The tree picture a prop draws (GFX's, cached by the prop). */
export const treeOf = (p: Prop) => {
  let t = trees.get(p.id);
  if (!t) {
    t = G.tree(p.v || "round", p.seed, p.s);
    trees.set(p.id, t);
  }
  return t;
};
const flipped = (g: Ctx, p: Prop, fn: () => void) => {
  if (!p.flip) return fn();
  g.save();
  g.translate(p.x, 0);
  g.scale(-1, 1);
  g.translate(-p.x, 0);
  fn();
  g.restore();
};
/**
 * Draw a prop standing at its foot. `time` sways a tree's crown (0 when
 * baked).
 */
export function drawProp(g: Ctx, p: Prop, time = 0, shake = 0) {
  const { x, y } = p;
  switch (p.kind) {
    case "tree": {
      const t = treeOf(p);
      if (!shake) return G.drawTree(g, t, x, y, time, p.seed, 0.8);
      g.save();
      g.translate(x, y);
      g.rotate(Math.sin(time * 42) * 0.07 * shake);
      G.drawTree(g, t, 0, 0, time, p.seed, 0.8);
      g.restore();
      return;
    }
    case "bush":
      G.shadow(g, x + 6, y + 2, p.s * 0.5, 8);
      return G.blit(
        g,
        G.bush(p.v || "green", p.seed, Math.round(p.s)),
        x,
        y + 4,
      );
    case "rock":
      return G.blit(g, G.rock(p.seed, Math.round(p.s)), x, y + 2);
    case "mailbox":
      G.shadow(g, x + 4, y + 2, 16, 5);
      return G.blit(g, G.mailbox(), x, y);
    case "flowers":
      return;
  }
  const shadowW = p.kind === "wall" || p.kind === "sunrow" ? 0 : p.w + 6;
  if (shadowW) G.shadow(g, x + 5, y + 1, shadowW, Math.min(12, p.d * 0.5 + 4));
  const s =
    p.kind === "bale"
      ? bale(p.seed % 3)
      : p.kind === "hive"
        ? hive(p.seed)
        : p.kind === "woodpile"
          ? woodpile(p.seed)
          : p.kind === "stump"
            ? stump()
            : p.kind === "wall"
              ? wall(p.len ?? 140, p.seed % 5)
              : p.kind === "sunrow"
                ? sunrow(p.len ?? 170, p.seed)
                : p.kind === "reeds"
                  ? reeds(p.s, p.seed % 7)
                  : cart();
  flipped(g, p, () => G.blit(g, s, x, y));
}

/* ───────────── the ground round the farm (baked) ───────────── */

/** The fields round the farm, the brook's banks, then (after cutWater) the footbridge. */
export function paintSurround(g: Ctx) {
  const r = srand(4242);
  for (const f of FIELDS) {
    const w = f.x1 - f.x0,
      h = f.y1 - f.y0;
    g.save();
    g.beginPath();
    g.roundRect(f.x0, f.y0, w, h, 26);
    g.clip();
    if (f.kind === "wheat") {
      g.fillStyle = vg(g, f.y0, f.y1, "#e9c55a", "#d9ac3e");
      g.fillRect(f.x0, f.y0, w, h);
      // Rows of wheat across the field, ears catching the light.
      for (let y = f.y0 + 6; y < f.y1 - 2; y += 11) {
        g.fillStyle = "rgba(160,110,30,.35)";
        g.fillRect(f.x0, y + 6, w, 2);
        for (let x = f.x0 + (y % 2) * 5; x < f.x1; x += 9) {
          g.fillStyle = r() < 0.5 ? "#f6dc86" : "#e6bd52";
          ell(g, x + r() * 3, y + r() * 2, 2.4, 4.2, 0.3);
          g.fill();
        }
      }
    } else if (f.kind === "woodland") {
      // No edge: the wood's floor thins out toward the farm.
      const fade = (x: number) => Math.min(1, (f.x1 - x) / 140);
      for (let i = 0; i < (w * h) / 260; i++) {
        const x = f.x0 + r() * w,
          y = f.y0 + r() * h;
        if (r() > fade(x)) continue;
        g.fillStyle = r() < 0.5 ? "rgba(60,120,50,.35)" : "rgba(70,130,55,.28)";
        ell(g, x, y, 8 + r() * 10, 5 + r() * 6, r() * 3);
        g.fill();
      }
      for (let i = 0; i < (w * h) / 900; i++) {
        const x = f.x0 + r() * w,
          y = f.y0 + r() * h;
        if (r() > fade(x)) continue;
        g.fillStyle = ["#4f8f3c", "#6fb24f", "#b88a4a", "#c99a52", "#3f7f34"][
          i % 5
        ];
        ell(g, x, y, 2 + r() * 3, 1.2 + r() * 1.5, r() * 3);
        g.fill();
      }
      // Ferns.
      for (let i = 0; i < (w * h) / 9000; i++) {
        const x = f.x0 + r() * w,
          y = f.y0 + r() * h;
        if (r() > fade(x)) continue;
        g.strokeStyle = "#3f8a34";
        g.lineWidth = 1.6;
        for (let k = -2; k <= 2; k++) {
          g.beginPath();
          g.moveTo(x, y);
          g.quadraticCurveTo(
            x + k * 5,
            y - 8,
            x + k * 9,
            y - 6 + Math.abs(k) * 2,
          );
          g.stroke();
        }
      }
    } else if (f.kind === "mown") {
      g.fillStyle = "#a9d46c";
      g.fillRect(f.x0, f.y0, w, h);
      g.save();
      g.strokeStyle = "rgba(70,120,40,.35)";
      g.lineWidth = 8;
      g.beginPath();
      g.roundRect(f.x0, f.y0, w, h, 26);
      g.stroke();
      g.restore();
      // Mowing stripes and cut grass in windrows.
      for (let k = 0, x = f.x0 - h; x < f.x1; x += 34, k++) {
        g.fillStyle = k % 2 ? "rgba(255,250,200,.18)" : "rgba(80,130,40,.12)";
        g.beginPath();
        g.moveTo(x, f.y1);
        g.lineTo(x + h * 0.35, f.y0);
        g.lineTo(x + h * 0.35 + 34, f.y0);
        g.lineTo(x + 34, f.y1);
        g.fill();
      }
      for (let i = 0; i < (w * h) / 260; i++) {
        const x = f.x0 + r() * w,
          y = f.y0 + r() * h;
        g.strokeStyle = r() < 0.5 ? "#d8c46a" : "#8fbf54";
        g.lineWidth = 1.2;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 5, y - 1);
        g.stroke();
      }
    } else if (f.kind === "sunsoil") {
      g.fillStyle = "#86b85a";
      g.fillRect(f.x0, f.y0, w, h);
      for (let y = f.y0 + 40; y < f.y1; y += 78) {
        g.fillStyle = "#8a6038";
        g.beginPath();
        g.roundRect(f.x0 + 4, y - 14, w - 8, 26, 12);
        g.fill();
        g.fillStyle = "rgba(255,230,190,.18)";
        g.fillRect(f.x0 + 10, y - 10, w - 20, 3);
      }
    } else {
      // Wildflowers in the grass (the patch round the hives, the far bank),
      // thinning out to its edges.
      const n = (w * h) / (f.kind === "flowers" ? 90 : 420);
      for (let i = 0; i < n; i++) {
        const x = f.x0 + r() * w,
          y = f.y0 + r() * h,
          ex = Math.min(x - f.x0, f.x1 - x) / 40,
          ey = Math.min(y - f.y0, f.y1 - y) / 30;
        if (f.kind === "flowers" && r() > Math.min(1, ex, ey)) continue;
        g.fillStyle = [
          "#ffffff",
          "#fff3a6",
          "#ffc4dc",
          "#cfe2ff",
          "#c9a6ff",
          "#ff9e8a",
        ][i % 6];
        ell(g, x, y, 2.2, 2);
        g.fill();
      }
    }
    g.restore();
  }
  // The brook's banks: a muddy edge and pebbles, under the water's hole.
  const step = 12;
  const band = (off: number, color: string) => {
    g.fillStyle = color;
    g.beginPath();
    for (let x = BROOK.x0; x <= BROOK.x1; x += step)
      g.lineTo(x, brookY(x) - BROOK.half - off);
    for (let x = BROOK.x1; x >= BROOK.x0; x -= step)
      g.lineTo(x, brookY(x) + BROOK.half + off);
    g.closePath();
    g.fill();
  };
  band(14, "rgba(70,110,50,.45)");
  band(7, "#8a7350");
  band(3, "#6e5a3c");
  for (let x = BROOK.x0; x < BROOK.x1; x += 9) {
    for (const side of [-1, 1]) {
      if (r() < 0.45) continue;
      const y = brookY(x) + side * (BROOK.half + 2 + r() * 5);
      g.fillStyle = ["#c9cdd6", "#b4b9c4", "#9aa0ac", "#d9dce3"][
        Math.floor(r() * 4)
      ];
      ell(g, x + r() * 6, y, 3 + r() * 3, 2 + r() * 1.5);
      g.fill();
    }
  }
}
/** Cut the water's holes in the ground picture: the pond and the brook. */
export function cutWater(g: Ctx) {
  g.save();
  g.globalCompositeOperation = "destination-out";
  g.fillStyle = "#000";
  ell(g, POND.x, POND.y, POND.rx, POND.ry);
  g.fill();
  g.beginPath();
  for (let x = BROOK.x0; x <= BROOK.x1; x += 12)
    g.lineTo(x, brookY(x) - BROOK.half);
  for (let x = BROOK.x1; x >= BROOK.x0; x -= 12)
    g.lineTo(x, brookY(x) + BROOK.half);
  g.closePath();
  g.fill();
  g.restore();
}
/** The footbridge over the brook (baked, over the water's hole). */
export function paintBridge(g: Ctx) {
  const { x0, x1, y0, y1 } = BRIDGE;
  // Its shadow on the water, then the planks across it.
  g.fillStyle = "rgba(10,40,60,.35)";
  g.fillRect(x0 + 4, y0 + 10, x1 - x0, y1 - y0);
  for (let y = y0; y < y1; y += 9) {
    g.fillStyle = (y - y0) % 18 ? "#c48a4a" : "#b47a3e";
    g.beginPath();
    g.roundRect(x0, y, x1 - x0, 8, 2);
    g.fill();
    g.strokeStyle = "rgba(90,50,20,.55)";
    g.lineWidth = 1;
    g.stroke();
  }
  // Its rails and posts, both sides.
  for (const x of [x0 + 3, x1 - 3]) {
    g.strokeStyle = "#7a5230";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(x, y0 - 16);
    g.lineTo(x, y1 - 16);
    g.stroke();
    g.strokeStyle = "#d39a5c";
    g.lineWidth = 2.4;
    g.stroke();
    for (let y = y0; y <= y1 + 0.1; y += (y1 - y0) / 3) {
      g.fillStyle = "#8a5a30";
      g.beginPath();
      g.roundRect(x - 3.5, y - 22, 7, 24, 2);
      g.fill();
      g.fillStyle = "#e0a868";
      ell(g, x, y - 22, 3.5, 1.8);
      g.fill();
    }
  }
}

/* ───────────── the water, every frame ───────────── */

export interface WaterLook {
  t: number;
  night: number;
  golden: number;
  wet: boolean;
  low: boolean;
  reduced: boolean;
}
export interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
const mixC = (a: number[], b: number[], f: number) =>
  `rgb(${a.map((v, i) => Math.round(v + (b[i] - v) * f)).join(",")})`;

/** The pond's and the brook's water, under the ground picture. */
export function drawWater(g: Ctx, v: View, l: WaterLook) {
  const pondOn =
    v.x1 > POND.x - POND.rx &&
    v.x0 < POND.x + POND.rx &&
    v.y1 > POND.y - POND.ry &&
    v.y0 < POND.y + POND.ry;
  const brookOn = v.y1 > brookY(0) - 60 && v.y0 < brookY(0) + 60;
  if (pondOn) drawPond(g, l);
  if (brookOn) drawBrook(g, v, l);
}
const sky = (l: WaterLook) => {
  // Day blue, warmer toward sunset (the night's grade darkens it after).
  const near = [126, 214, 236],
    far = [44, 146, 192],
    warm = [255, 196, 140];
  return {
    near: mixC(near, warm, l.golden * 0.35),
    far: mixC(far, [120, 110, 150], l.golden * 0.25),
  };
};
function drawPond(g: Ctx, l: WaterLook) {
  const { x, y, rx, ry } = POND,
    t = l.reduced ? 0 : l.t;
  const s = sky(l);
  g.save();
  ell(g, x, y, rx + 2, ry + 2);
  const wg = g.createLinearGradient(0, y - ry, 0, y + ry);
  wg.addColorStop(0, s.far);
  wg.addColorStop(1, s.near);
  g.fillStyle = wg;
  g.fill();
  g.clip();
  // The far bank's shade on the water.
  g.fillStyle = "rgba(10,40,60,.25)";
  ell(g, x, y - ry + 2, rx * 1.05, 16);
  g.fill();
  // Ripples circling slowly.
  g.strokeStyle =
    l.night > 0.5 ? "rgba(170,200,255,.25)" : "rgba(255,255,255,.4)";
  g.lineWidth = 1.5;
  const rings = l.low ? 3 : 5;
  for (let k = 0; k < rings; k++) {
    const a = t * (0.18 + k * 0.03) + k * 1.9;
    ell(
      g,
      x + Math.cos(a) * rx * 0.45,
      y + Math.sin(a) * ry * 0.4,
      16 + k * 5,
      3.5 + k * 0.6,
    );
    g.stroke();
  }
  // Lily pads, bobbing, one with a flower.
  for (let k = 0; k < 4; k++) {
    const px = x - rx * 0.55 + k * rx * 0.36 + Math.sin(k * 3.1) * 14,
      py = y + Math.sin(k * 1.7) * ry * 0.5 + Math.sin(t * 0.9 + k) * 1.2;
    g.fillStyle = k % 2 ? "#4fae46" : "#5fbf4f";
    g.beginPath();
    g.ellipse(px, py, 11, 5.5, 0, 0.35, Math.PI * 2 - 0.05);
    g.lineTo(px, py);
    g.fill();
    if (k === 1) {
      g.fillStyle = "#ffc4dc";
      ell(g, px - 2, py - 3, 4, 3);
      g.fill();
    }
  }
  if (!l.low)
    glints(
      g,
      x - rx,
      x + rx,
      (i) => y - ry * 0.6 + hash(i + 3) * ry * 1.2,
      t,
      l,
      (px, py) => ((px - x) / rx) ** 2 + ((py - y) / ry) ** 2 < 0.8,
    );
  if (l.wet)
    rainRings(
      g,
      x - rx,
      x + rx,
      (i) => y - ry * 0.7 + hash(i + 5) * ry * 1.4,
      l.t,
    );
  // Now and then a fish leaps (every 9 s, somewhere new).
  if (!l.reduced) {
    const k = Math.floor(l.t / 9),
      u = l.t - k * 9;
    if (u < 0.9) {
      const fx = x + (hash(k) - 0.5) * rx * 1.1,
        fy = y + (hash(k + 1) - 0.5) * ry * 0.8;
      G.fish(
        g,
        l.t,
        fx + (u - 0.45) * 30,
        fy,
        (u - 0.45) * 2.2,
        "#ff8a3d",
        Math.sin((u / 0.9) * Math.PI) * 26,
      );
      g.strokeStyle = "rgba(255,255,255,.6)";
      g.lineWidth = 1.4;
      ell(g, fx - 14, fy, 6 + u * 14, 2 + u * 4);
      g.stroke();
    }
  }
  g.restore();
}
function drawBrook(g: Ctx, v: View, l: WaterLook) {
  const xa = Math.max(BROOK.x0, Math.floor((v.x0 - 20) / 12) * 12),
    xb = Math.min(BROOK.x1, v.x1 + 20);
  if (xb <= xa) return;
  const t = l.reduced ? 0 : l.t,
    s = sky(l),
    H = BROOK.half;
  g.save();
  g.beginPath();
  for (let x = xa; x <= xb + 12; x += 12) g.lineTo(x, brookY(x) - H - 2);
  for (let x = xb + 12; x >= xa; x -= 12) g.lineTo(x, brookY(x) + H + 2);
  g.closePath();
  const mid = brookY((xa + xb) / 2);
  const wg = g.createLinearGradient(0, mid - H, 0, mid + H);
  wg.addColorStop(0, s.far);
  wg.addColorStop(0.55, s.near);
  wg.addColorStop(1, s.far);
  g.fillStyle = wg;
  g.fill();
  g.clip();
  // The far bank's shade.
  g.fillStyle = "rgba(10,40,60,.22)";
  g.beginPath();
  for (let x = xa; x <= xb + 12; x += 12) g.lineTo(x, brookY(x) - H - 2);
  for (let x = xb + 12; x >= xa; x -= 12) g.lineTo(x, brookY(x) - H + 8);
  g.fill();
  // Ripples drifting downstream (to the east), in rows across the brook.
  const rows = l.low ? 2 : 4;
  g.lineCap = "round";
  g.strokeStyle =
    l.night > 0.5 ? "rgba(170,200,255,.25)" : "rgba(255,255,255,.5)";
  g.lineWidth = 1.6;
  g.beginPath();
  for (let r = 0; r < rows; r++) {
    const off = -H + 8 + ((2 * H - 14) * (r + 0.5)) / rows,
      speed = 34 + r * 6,
      stepX = l.low ? 70 : 46,
      shift = (t * speed) % stepX;
    for (
      let x = Math.floor(xa / stepX) * stepX - stepX + shift;
      x < xb;
      x += stepX
    ) {
      const k = Math.round((x - shift) / stepX) + r * 31;
      const len = 10 + hash(k) * 14,
        pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + k);
      if (pulse < 0.25) continue;
      const y = brookY(x) + off + (hash(k + 9) - 0.5) * 4;
      g.moveTo(x, y);
      g.quadraticCurveTo(x + len / 2, y - 2.5, x + len, y);
    }
  }
  g.stroke();
  g.lineCap = "butt";
  if (!l.low)
    glints(
      g,
      xa,
      xb,
      (i) => brookY(i * 26) - H + 8 + hash(i + 11) * (2 * H - 16),
      t,
      l,
    );
  if (l.wet)
    rainRings(
      g,
      xa,
      xb,
      (i) => brookY(i * 26) - H + 6 + hash(i + 7) * (2 * H - 12),
      l.t,
    );
  g.restore();
}
/** Glints of the sun (or the moon) twinkling on the water. */
function glints(
  g: Ctx,
  x0: number,
  x1: number,
  yAt: (i: number) => number,
  t: number,
  l: WaterLook,
  keep: (x: number, y: number) => boolean = () => true,
) {
  const col =
    l.golden > 0.2
      ? "255,214,150"
      : l.night > 0.5
        ? "210,224,255"
        : "255,255,240";
  for (let i = Math.floor(x0 / 26); i < x1 / 26; i++) {
    const tw = Math.sin(t * 3 + i * 1.7);
    if (tw < 0.6) continue;
    const px = i * 26 + hash(i) * 14,
      py = yAt(i);
    if (!keep(px, py)) continue;
    g.fillStyle = `rgba(${col},${(tw - 0.6) * 2})`;
    g.beginPath();
    g.moveTo(px, py - 2.5);
    g.lineTo(px + 4, py);
    g.lineTo(px, py + 2.5);
    g.lineTo(px - 4, py);
    g.fill();
  }
}
/** Rain: rings spreading on the water. */
function rainRings(
  g: Ctx,
  x0: number,
  x1: number,
  yAt: (i: number) => number,
  t: number,
) {
  g.strokeStyle = "rgba(230,240,255,.55)";
  g.lineWidth = 1;
  for (let i = Math.floor(x0 / 22); i < x1 / 22; i++) {
    const u = (t * 1.3 + hash(i)) % 1;
    const px = i * 22 + hash(i + 2) * 16,
      py = yAt(i);
    ell(g, px, py, 2 + u * 9, 0.8 + u * 3);
    g.stroke();
  }
}

/* ───────────── what moves round the farm ───────────── */

/** The tractor pulling a trailer of hay along the road, facing `face`. */
export function drawTractor(
  g: Ctx,
  x: number,
  y: number,
  face: number,
  time: number,
) {
  const body = pic("tractor", 320, 150, 160, 140, (c) => paintTractor(c));
  G.shadow(g, x, y + 1, 150, 12);
  g.save();
  g.translate(x, y);
  g.scale(face, 1);
  const bump = Math.abs(Math.sin(time * 9)) * 1.2;
  g.drawImage(body.c, -body.ax, -body.ay - bump, body.w, body.h);
  // The wheels turn with the road (their spokes).
  const roll = (x / 30) * face;
  for (const [wx, r] of [
    [62, 30],
    [118, 17],
    [-92, 16],
    [-38, 16],
  ] as const) {
    ell(g, wx, -r, r, r);
    g.fillStyle = "#2c2a36";
    g.fill();
    ell(g, wx, -r, r * 0.55, r * 0.55);
    g.fillStyle = r > 20 ? "#ffcb2e" : "#d9dce3";
    g.fill();
    g.strokeStyle = "#2c2a36";
    g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k < 3; k++) {
      const a = roll * (30 / r) + (k * Math.PI) / 3;
      g.moveTo(wx + Math.cos(a) * r * 0.5, -r + Math.sin(a) * r * 0.5);
      g.lineTo(wx - Math.cos(a) * r * 0.5, -r - Math.sin(a) * r * 0.5);
    }
    g.stroke();
  }
  g.restore();
  // A puff from the exhaust now and then.
  const u = (time * 1.6) % 1;
  g.fillStyle = `rgba(230,230,235,${0.5 * (1 - u)})`;
  ell(g, x + face * (100 - u * 30), y - 126 - u * 26, 5 + u * 9, 4 + u * 7);
  g.fill();
}
/** The tractor's body and trailer, facing right, standing at (0, 0): 2.3 m tall. */
function paintTractor(g: Ctx) {
  const H = heightPx("tractor");
  // The trailer, left, with its hay.
  g.fillStyle = vg(g, -54, -26, "#d79a5a", "#9a6234");
  g.beginPath();
  g.roundRect(-140, -54, 128, 26, 3);
  g.fill();
  g.strokeStyle = OUT;
  g.lineWidth = 1.5;
  g.stroke();
  g.fillStyle = vg(g, -100, -52, "#fbe7a2", "#e2b74e");
  g.beginPath();
  g.moveTo(-138, -52);
  g.quadraticCurveTo(-130, -100, -76, -102);
  g.quadraticCurveTo(-24, -98, -14, -52);
  g.closePath();
  g.fill();
  g.strokeStyle = "#b88a2c";
  g.stroke();
  g.strokeStyle = "#6e4524";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-12, -38);
  g.lineTo(22, -36);
  g.stroke();
  // The tractor: a red hood, the cab with a window, a yellow seat back.
  g.fillStyle = vg(g, -76, -30, "#ff6a55", "#c0392b");
  g.beginPath();
  g.roundRect(70, -76, 66, 42, 8);
  g.fill();
  g.strokeStyle = "#6e1e14";
  g.lineWidth = 1.6;
  g.stroke();
  g.fillStyle = "#2c2a36";
  for (let k = 0; k < 4; k++) g.fillRect(118 + k * 4, -70, 2, 26);
  g.fillStyle = vg(g, -H, -34, "#ff6a55", "#c0392b");
  g.beginPath();
  g.roundRect(28, -H, 52, H - 30, 8);
  g.fill();
  g.stroke();
  g.fillStyle = "rgba(190,230,255,.85)";
  g.beginPath();
  g.roundRect(36, -H + 8, 36, 34, 5);
  g.fill();
  g.fillStyle = "rgba(255,255,255,.6)";
  g.fillRect(40, -H + 12, 6, 24);
  // The roof and the exhaust pipe.
  g.fillStyle = "#e8e2d6";
  g.beginPath();
  g.roundRect(22, -H - 6, 64, 9, 4);
  g.fill();
  g.strokeStyle = "#6e1e14";
  g.stroke();
  g.fillStyle = "#3a3846";
  g.fillRect(98, -H + 18, 5, 26);
  // The fender over the big wheel.
  g.fillStyle = "#c0392b";
  g.beginPath();
  g.arc(62, -30, 36, Math.PI, 0);
  g.lineTo(98, -26);
  g.lineTo(26, -26);
  g.fill();
}
/** Bees about the hives in the daytime. */
export function drawBees(g: Ctx, hives: Prop[], t: number) {
  for (const h of hives)
    for (let k = 0; k < 3; k++) {
      const a = t * (1.6 + k * 0.4) + k * 2.1 + h.seed;
      const bx = h.x + Math.cos(a) * (18 + k * 6),
        by = h.y - h.h - 6 + Math.sin(a * 1.7) * 9;
      g.fillStyle = "#ffcb2e";
      ell(g, bx, by, 2.4, 1.8);
      g.fill();
      g.fillStyle = "rgba(255,255,255,.8)";
      ell(g, bx - 0.5, by - 2, 1.6, 1);
      g.fill();
    }
}

/**
 * Emberwing's Sky Terrace, drawn to match the painted lava terrace: carved
 * basalt brazier daises with flame glyphs, wrought-iron braziers with
 * layered fire, heat-split burning ground, a charred dive lane, a ring of
 * fire and a fallen tassel (the Fraying trait).
 *
 * Every piece is a pure Canvas 2D drawer `(ctx, k)` (k = atlas pixels per
 * world unit), drawn ONCE into one atlas when the raid's scene starts
 * (raid-emberwing-terrace-rig.ts). Each frame only places, scales, turns and
 * fades images from it, plus a few cheap lines: the exact danger edges and
 * the brazier arcs. Nothing reads pixels back.
 *
 * Gameplay readability is the server's: the brazier standing radius (65),
 * each patch's radius, the dive lane (2 × its width, 38) and the flame
 * ring's band (2 × 22) are drawn on their exact edges, and the colours keep
 * their meanings: a brazier's ring is grey (cannot be lit yet), teal (stand
 * in it to light it) or gold (lit); its teal arc is the lighting progress,
 * its gold arc the time left.
 */
import {
  EMBERWING as E,
  brazierLifetime,
} from "../../../packages/shared/src/raid";

type Ctx = CanvasRenderingContext2D;
const TAU = Math.PI * 2;
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
/** Scorch base radius in the atlas (scaled to the patch radius each frame). */
export const SCORCH_R = 120;
/** Trail piece: a band exactly 2 × the dive width across, this long, with soft ends. */
export const TRAIL_L = 256;
const TH = E.dive.width;
/** The brazier bowl's geometry (relative to the brazier's world point). */
export const RIM = { y: -10, rx: 32, ry: 13, irx: 27, iry: 9.6, iy: -9 };

function ellipsePath(ctx: Ctx, x: number, y: number, rx: number, ry: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
}
function speckle(
  ctx: Ctx,
  r: () => number,
  x0: number,
  y0: number,
  w: number,
  h: number,
  n: number,
  light: string,
  dark: string,
  size = 1.2,
) {
  for (let i = 0; i < n; i++) {
    const x = x0 + r() * w,
      y = y0 + r() * h,
      s = size * (0.4 + r());
    ctx.fillStyle = r() < 0.5 ? light : dark;
    ctx.fillRect(x, y, s, s);
  }
}
function crackLine(
  ctx: Ctx,
  r: () => number,
  x: number,
  y: number,
  a: number,
  steps: number,
  len: number,
  width: number,
  color: string,
) {
  ctx.beginPath();
  ctx.moveTo(x, y);
  for (let i = 0; i < steps; i++) {
    a += (r() - 0.5) * 0.9;
    x += Math.cos(a) * len * (0.6 + r() * 0.6);
    y += Math.sin(a) * len * (0.6 + r() * 0.6);
    ctx.lineTo(x, y);
  }
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.stroke();
}
/** A small engraved flame glyph centred at 0,0 (pointing up). */
function glyphPath(ctx: Ctx, s: number) {
  ctx.beginPath();
  ctx.moveTo(0, -4.2 * s);
  ctx.bezierCurveTo(1.6 * s, -2 * s, 3 * s, -0.4 * s, 2.4 * s, 1.8 * s);
  ctx.bezierCurveTo(1.8 * s, 3.6 * s, -1.8 * s, 3.6 * s, -2.4 * s, 1.8 * s);
  ctx.bezierCurveTo(-3 * s, -0.2 * s, -0.6 * s, -1.2 * s, 0, -4.2 * s);
  ctx.closePath();
}
const GLYPH_R = 58.5;
const glyphAngles = Array.from(
  { length: 8 },
  (_, i) => -Math.PI / 2 + Math.PI / 8 + (i * TAU) / 8,
);
function tearPath(
  ctx: Ctx,
  cx: number,
  by: number,
  w: number,
  h: number,
  lean = 0,
) {
  ctx.moveTo(cx + lean, by - h);
  ctx.bezierCurveTo(
    cx + w * 0.12 + lean * 0.6,
    by - h * 0.62,
    cx + w * 0.56,
    by - h * 0.38,
    cx + w * 0.5,
    by - h * 0.13,
  );
  ctx.bezierCurveTo(
    cx + w * 0.46,
    by + w * 0.28,
    cx - w * 0.46,
    by + w * 0.28,
    cx - w * 0.5,
    by - h * 0.13,
  );
  ctx.bezierCurveTo(
    cx - w * 0.56,
    by - h * 0.4,
    cx - w * 0.08 + lean * 0.6,
    by - h * 0.6,
    cx + lean,
    by - h,
  );
  ctx.closePath();
}
/** Layered fire: a tall centre tongue and two shorter side licks filled as one shape, red outside to white inside. */
function flameLayers(
  ctx: Ctx,
  cx: number,
  by: number,
  w: number,
  h: number,
  layers: [number, string, number?][],
) {
  for (const [f, color, lean] of layers) {
    const lw = w * f,
      lh = h * f,
      l = lean || 0;
    ctx.beginPath();
    tearPath(ctx, cx, by, lw * 0.74, lh, l);
    tearPath(ctx, cx - lw * 0.2, by, lw * 0.5, lh * 0.6, l - lw * 0.26);
    tearPath(ctx, cx + lw * 0.2, by, lw * 0.5, lh * 0.72, l + lw * 0.2);
    ctx.fillStyle = color;
    ctx.fill("nonzero");
  }
}
/** The bowl rim (bronze), optionally only its front lip. */
function rimDraw(ctx: Ctx, front: boolean) {
  ctx.save();
  if (front) {
    ctx.beginPath();
    ctx.rect(-40, RIM.iy, 80, 30);
    ctx.clip();
  }
  ellipsePath(ctx, 0, RIM.y, RIM.rx, RIM.ry);
  ellipsePath(ctx, 0, RIM.iy, RIM.irx, RIM.iry);
  const g = ctx.createLinearGradient(
    -RIM.rx,
    RIM.y - RIM.ry,
    RIM.rx,
    RIM.y + RIM.ry,
  );
  g.addColorStop(0, "#e9c27c");
  g.addColorStop(0.32, "#b98a4a");
  g.addColorStop(0.7, "#6e4a22");
  g.addColorStop(1, "#3a220e");
  ctx.fillStyle = g;
  ctx.fill("evenodd");
  const r = rng(91);
  ctx.save();
  ellipsePath(ctx, 0, RIM.y, RIM.rx, RIM.ry);
  ellipsePath(ctx, 0, RIM.iy, RIM.irx, RIM.iry);
  ctx.clip("evenodd");
  for (let i = 0; i < 26; i++) {
    const a = r() * TAU,
      rr = 0.84 + r() * 0.14;
    ctx.fillStyle =
      r() < 0.55 ? "rgba(92,160,128,0.55)" : "rgba(40,22,10,0.45)";
    ctx.beginPath();
    ctx.ellipse(
      Math.cos(a) * RIM.rx * rr,
      RIM.y + Math.sin(a) * RIM.ry * rr,
      1 + r() * 1.6,
      0.6 + r(),
      0,
      0,
      TAU,
    );
    ctx.fill();
  }
  ctx.restore();
  ctx.lineWidth = 1;
  ctx.strokeStyle = "rgba(255,236,190,0.7)";
  ctx.beginPath();
  ctx.ellipse(
    0,
    RIM.y,
    RIM.rx - 0.6,
    RIM.ry - 0.6,
    0,
    Math.PI * 1.05,
    Math.PI * 1.75,
  );
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,226,170,0.55)";
  ctx.beginPath();
  ctx.ellipse(
    0,
    RIM.iy,
    RIM.irx + 0.4,
    RIM.iry + 0.4,
    0,
    Math.PI * 0.15,
    Math.PI * 0.85,
  );
  ctx.stroke();
  ctx.strokeStyle = "rgba(20,10,4,0.75)";
  ctx.beginPath();
  ctx.ellipse(0, RIM.y, RIM.rx, RIM.ry, 0, Math.PI * 0.05, Math.PI * 0.95);
  ctx.stroke();
  ctx.restore();
}

export interface TerracePiece {
  name: string;
  w: number;
  h: number;
  /** Its anchor, as fractions of its size. */
  ox: number;
  oy: number;
  /** Stored at this share of the atlas density (big soft pieces: less memory). */
  res: number;
  draw: (ctx: Ctx, k: number) => void;
}
// The burning ground's crack network: wavering spokes from a molten heart,
// linked into plates (seeded, so the same every time).
const scorchNet = (() => {
  const cr = rng(7),
    cracks: { a: [number, number]; b: [number, number]; w: number }[] = [];
  const NS = 11,
    radii = [7, 20, 35, 51, 67, 83, 99, 112, 119];
  const spokes: [number, number][][] = [];
  for (let i = 0; i < NS; i++) {
    let a = (i * TAU) / NS + (cr() - 0.5) * 0.35;
    spokes.push(
      radii.map((rr) => {
        a += (cr() - 0.5) * 0.34;
        const d = rr * (0.86 + cr() * 0.22);
        return [Math.cos(a) * d, Math.sin(a) * d] as [number, number];
      }),
    );
  }
  const heat = (p: [number, number]) =>
    (1 - Math.min(1, Math.hypot(p[0], p[1]) / SCORCH_R)) ** 1.5;
  const seam = (a: [number, number], b: [number, number], w: number) => {
    const dx = b[0] - a[0],
      dy = b[1] - a[1],
      j = (cr() - 0.5) * 0.5;
    const m: [number, number] = [
      a[0] + dx * 0.5 - dy * j,
      a[1] + dy * 0.5 + dx * j,
    ];
    cracks.push({ a, b: m, w }, { a: m, b, w: w * 0.92 });
  };
  for (const sp of spokes) {
    const end = cr() < 0.4 ? 5 + Math.floor(cr() * 3) : radii.length - 1;
    for (let j = 0; j < end; j++)
      seam(sp[j], sp[j + 1], 0.35 + 1.4 * heat(sp[j]));
  }
  for (let i = 0; i < NS; i++) {
    const p = spokes[i],
      q = spokes[(i + 1) % NS];
    for (let j = 2; j < radii.length - 1; j++) {
      if (cr() > 0.42) continue;
      const jq = Math.max(
        2,
        Math.min(radii.length - 2, j + Math.floor(cr() * 3) - 1),
      );
      seam(p[j], q[jq], 0.3 + 0.9 * heat(p[j]));
    }
  }
  return { cracks, spokes, NS, radii };
})();
function strokeCracks(ctx: Ctx, scale: number, color: string) {
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = color;
  for (const c of scorchNet.cracks) {
    ctx.beginPath();
    ctx.moveTo(c.a[0], c.a[1]);
    ctx.lineTo(c.b[0], c.b[1]);
    ctx.lineWidth = scale * c.w;
    ctx.stroke();
  }
}

/** Every piece of the terrace. */
export function terracePieces(): TerracePiece[] {
  const out: TerracePiece[] = [];
  const piece = (
    name: string,
    w: number,
    h: number,
    ox: number,
    oy: number,
    draw: TerracePiece["draw"],
    res = 1,
  ) => out.push({ name, w, h, ox, oy, draw, res });

  // ── Brazier: floor dais (carved basalt ring) + the plinth's contact shadow
  piece("dais", 170, 170, 0.5, 0.5, (ctx, k) => {
    ctx.scale(k, k);
    ctx.translate(85, 85);
    const R = E.brazierRadius,
      IN = 51;
    const r = rng(17);
    let g = ctx.createRadialGradient(0, 8, 4, 0, 0, IN);
    g.addColorStop(0, "rgba(16,8,6,0.42)");
    g.addColorStop(0.7, "rgba(18,9,6,0.2)");
    g.addColorStop(1, "rgba(18,9,6,0.06)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, IN, 0, TAU);
    ctx.fill();
    for (let i = 0; i < 18; i++) {
      const a = r() * TAU,
        d = 26 + r() * 20;
      ctx.fillStyle = `rgba(10,5,4,${0.08 + r() * 0.12})`;
      ctx.beginPath();
      ctx.ellipse(
        Math.cos(a) * d,
        10 + Math.sin(a) * d * 0.7,
        3 + r() * 6,
        2 + r() * 3,
        a,
        0,
        TAU,
      );
      ctx.fill();
    }
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, R, 0, TAU);
    ctx.arc(0, 0, IN, 0, TAU, true);
    ctx.clip();
    g = ctx.createRadialGradient(-18, -22, 10, 0, 0, R);
    g.addColorStop(0, "#5a4a42");
    g.addColorStop(0.75, "#3d312b");
    g.addColorStop(1, "#2a201c");
    ctx.fillStyle = g;
    ctx.fillRect(-R, -R, R * 2, R * 2);
    g = ctx.createLinearGradient(-R, -R, R, R);
    g.addColorStop(0, "rgba(255,214,170,0.16)");
    g.addColorStop(0.5, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.35)");
    ctx.fillStyle = g;
    ctx.fillRect(-R, -R, R * 2, R * 2);
    speckle(
      ctx,
      r,
      -R,
      -R,
      R * 2,
      R * 2,
      900,
      "rgba(255,225,190,0.12)",
      "rgba(0,0,0,0.22)",
      1.1,
    );
    for (let i = 0; i < 14; i++) {
      const a = (i * TAU) / 14 + 0.11;
      ctx.strokeStyle = "rgba(12,6,4,0.8)";
      ctx.lineWidth = 1.3;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * IN, Math.sin(a) * IN);
      ctx.lineTo(Math.cos(a) * R, Math.sin(a) * R);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,200,150,0.14)";
      ctx.lineWidth = 0.7;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a + 0.02) * IN, Math.sin(a + 0.02) * IN);
      ctx.lineTo(Math.cos(a + 0.015) * R, Math.sin(a + 0.015) * R);
      ctx.stroke();
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * TAU,
        d = IN + 2 + r() * 8;
      crackLine(
        ctx,
        r,
        Math.cos(a) * d,
        Math.sin(a) * d,
        a + Math.PI / 2,
        3,
        3,
        0.6,
        "rgba(8,4,3,0.75)",
      );
    }
    for (let i = 0; i < 9; i++) {
      const a = r() * TAU,
        s = 1.5 + r() * 2.2,
        x = Math.cos(a) * (R - 0.5),
        y = Math.sin(a) * (R - 0.5);
      ctx.fillStyle = "rgba(14,8,5,0.85)";
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a + 1.6) * s, y + Math.sin(a + 1.6) * s);
      ctx.lineTo(x - Math.cos(a) * s * 1.2, y - Math.sin(a) * s * 1.2);
      ctx.lineTo(x + Math.cos(a - 1.6) * s, y + Math.sin(a - 1.6) * s);
      ctx.fill();
    }
    for (const a of glyphAngles) {
      ctx.save();
      ctx.translate(Math.cos(a) * GLYPH_R, Math.sin(a) * GLYPH_R);
      ctx.rotate(a + Math.PI / 2);
      glyphPath(ctx, 1);
      ctx.fillStyle = "rgba(10,5,3,0.85)";
      ctx.fill();
      ctx.translate(0.5, 0.7);
      glyphPath(ctx, 0.75);
      ctx.strokeStyle = "rgba(255,200,150,0.18)";
      ctx.lineWidth = 0.6;
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
    g = ctx.createLinearGradient(-IN, -IN, IN, IN);
    g.addColorStop(0, "rgba(255,226,186,0.5)");
    g.addColorStop(1, "rgba(0,0,0,0.5)");
    ctx.strokeStyle = g;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(0, 0, IN + 0.7, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(8,4,2,0.8)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, IN - 0.4, 0, TAU);
    ctx.stroke();
    ctx.strokeStyle = "rgba(6,3,2,0.7)";
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, R - 0.8, 0, TAU);
    ctx.stroke();
    ctx.save();
    ctx.translate(0, 27);
    ctx.scale(1, 0.36);
    g = ctx.createRadialGradient(0, 0, 0, 0, 0, 52);
    g.addColorStop(0, "rgba(6,3,2,0.75)");
    g.addColorStop(0.45, "rgba(6,3,2,0.45)");
    g.addColorStop(1, "rgba(6,3,2,0)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, 0, 52, 0, TAU);
    ctx.fill();
    ctx.restore();
  });

  // ── Brazier state rings: a crisp line at exactly the standing radius and an inner wash
  const ringPiece = (name: string, rgb: string, wash: number) =>
    piece(
      name,
      150,
      150,
      0.5,
      0.5,
      (ctx, k) => {
        ctx.scale(k, k);
        ctx.translate(75, 75);
        const R = E.brazierRadius;
        ctx.fillStyle = `rgba(${rgb},${wash})`;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.fill();
        let g = ctx.createRadialGradient(0, 0, R - 16, 0, 0, R);
        g.addColorStop(0, `rgba(${rgb},0)`);
        g.addColorStop(1, `rgba(${rgb},0.3)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.fill();
        g = ctx.createRadialGradient(0, 0, R, 0, 0, R + 6);
        g.addColorStop(0, `rgba(${rgb},0.28)`);
        g.addColorStop(1, `rgba(${rgb},0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(0, 0, R + 6, 0, TAU);
        ctx.arc(0, 0, R, 0, TAU, true);
        ctx.fill();
        ctx.strokeStyle = "rgba(10,5,3,0.55)";
        ctx.lineWidth = 4.5;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.stroke();
        ctx.strokeStyle = `rgb(${rgb})`;
        ctx.lineWidth = 2.4;
        ctx.beginPath();
        ctx.arc(0, 0, R, 0, TAU);
        ctx.stroke();
      },
      0.75,
    );
  ringPiece("ring-grey", "127,141,164", 0.04);
  ringPiece("ring-teal", "139,231,208", 0.05);
  ringPiece("ring-gold", "255,220,135", 0.08);

  // ── Glowing glyphs (the engraved flames light up teal / gold)
  const glyphGlow = (name: string, core: string, glow: string) =>
    piece(
      name,
      150,
      150,
      0.5,
      0.5,
      (ctx, k) => {
        ctx.scale(k, k);
        ctx.translate(75, 75);
        for (const a of glyphAngles) {
          ctx.save();
          ctx.translate(Math.cos(a) * GLYPH_R, Math.sin(a) * GLYPH_R);
          ctx.rotate(a + Math.PI / 2);
          const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 9);
          g.addColorStop(0, glow);
          g.addColorStop(1, "rgba(0,0,0,0)");
          ctx.fillStyle = g;
          ctx.fillRect(-9, -9, 18, 18);
          glyphPath(ctx, 0.95);
          ctx.fillStyle = core;
          ctx.fill();
          ctx.restore();
        }
      },
      0.6,
    );
  glyphGlow("glyph-teal", "rgba(190,255,236,0.95)", "rgba(110,235,205,0.55)");
  glyphGlow("glyph-gold", "rgba(255,240,190,0.95)", "rgba(255,180,80,0.6)");

  // ── Brazier body: stone plinth, bronze collar, wrought-iron bowl, rim, cold coals.
  // Anchor (42, 62) is the brazier's world point.
  piece("body", 84, 100, 0.5, 0.62, (ctx, k) => {
    ctx.scale(k, k);
    ctx.translate(42, 62);
    const r = rng(33);
    const top = 4,
      foot = 24,
      base = 31;
    const faces: [number, number, number, number, string, string][] = [
      [-17, -6, -18, -6.5, "#7a675b", "#5e4e45"],
      [-6, 6, -6.5, 6.5, "#5b4a41", "#47392f"],
      [6, 17, 6.5, 18, "#3c302a", "#2c221e"],
    ];
    for (const [x0, x1, b0, b1, c0, c1] of faces) {
      const g = ctx.createLinearGradient(0, top, 0, foot);
      g.addColorStop(0, c0);
      g.addColorStop(1, c1);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(x0, top);
      ctx.lineTo(x1, top);
      ctx.lineTo(b1, foot);
      ctx.lineTo(b0, foot);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "#86715f";
    ctx.beginPath();
    ctx.moveTo(-18, foot);
    ctx.lineTo(18, foot);
    ctx.lineTo(23, foot + 3);
    ctx.lineTo(-23, foot + 3);
    ctx.closePath();
    ctx.fill();
    for (const [x0, x1, c] of [
      [-23, -8, "#6a574b"],
      [-8, 8, "#4f3f36"],
      [8, 23, "#33281f"],
    ] as const) {
      ctx.fillStyle = c;
      ctx.fillRect(x0, foot + 3, x1 - x0, base - foot - 3);
    }
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-17, top);
    ctx.lineTo(17, top);
    ctx.lineTo(18, foot);
    ctx.lineTo(23, foot + 3);
    ctx.lineTo(23, base);
    ctx.lineTo(-23, base);
    ctx.lineTo(-23, foot + 3);
    ctx.lineTo(-18, foot);
    ctx.closePath();
    ctx.clip();
    speckle(
      ctx,
      r,
      -24,
      top,
      48,
      base - top,
      260,
      "rgba(255,230,200,0.14)",
      "rgba(0,0,0,0.25)",
      0.9,
    );
    crackLine(ctx, r, -12, top + 3, 1.3, 4, 3.5, 0.6, "rgba(10,5,3,0.8)");
    crackLine(ctx, r, 9, foot + 1, -1.9, 3, 3, 0.6, "rgba(10,5,3,0.8)");
    ctx.fillStyle = "rgba(12,6,4,0.55)";
    ctx.fillRect(-20, 13, 40, 1.4);
    ctx.fillStyle = "rgba(255,220,180,0.18)";
    ctx.fillRect(-20, 14.4, 40, 0.8);
    let g = ctx.createLinearGradient(0, top, 0, top + 10);
    g.addColorStop(0, "rgba(8,4,3,0.6)");
    g.addColorStop(1, "rgba(8,4,3,0)");
    ctx.fillStyle = g;
    ctx.fillRect(-24, top, 48, 10);
    g = ctx.createLinearGradient(10, 0, 23, 0);
    g.addColorStop(0, "rgba(255,110,40,0)");
    g.addColorStop(1, "rgba(255,120,50,0.38)");
    ctx.fillStyle = g;
    ctx.fillRect(10, top, 14, base - top);
    ctx.fillStyle = "rgba(20,12,8,0.9)";
    for (const [x, y, s] of [
      [-23, foot + 4, 2.2],
      [22, base - 1, 2.6],
      [-17, top + 1, 1.6],
      [16, foot - 2, 1.8],
    ]) {
      ctx.beginPath();
      ctx.moveTo(x - s, y);
      ctx.lineTo(x, y - s);
      ctx.lineTo(x + s, y + s * 0.4);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,226,190,0.35)";
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(-6, top);
    ctx.lineTo(-6.5, foot);
    ctx.moveTo(-18, foot + 0.3);
    ctx.lineTo(18, foot + 0.3);
    ctx.stroke();
    // wrought-iron bowl
    ctx.beginPath();
    ctx.moveTo(-RIM.rx, RIM.y);
    ctx.bezierCurveTo(-RIM.rx + 1, RIM.y + 11, -14, 4, 0, 4);
    ctx.bezierCurveTo(14, 4, RIM.rx - 1, RIM.y + 11, RIM.rx, RIM.y);
    ctx.ellipse(0, RIM.y, RIM.rx, RIM.ry, 0, 0, Math.PI, false);
    ctx.closePath();
    g = ctx.createLinearGradient(-RIM.rx, 0, RIM.rx, 0);
    g.addColorStop(0, "#6c6c72");
    g.addColorStop(0.28, "#4a494f");
    g.addColorStop(0.65, "#26252a");
    g.addColorStop(1, "#141317");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    for (let i = 0; i < 40; i++) {
      const x = -30 + r() * 60,
        y = RIM.y + r() * 16;
      ctx.fillStyle = r() < 0.5 ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.22)";
      ctx.beginPath();
      ctx.ellipse(x, y, 1.6 + r() * 1.5, 1 + r(), 0, 0, TAU);
      ctx.fill();
    }
    for (let i = 0; i < 9; i++) {
      ctx.fillStyle = `rgba(150,64,28,${0.2 + r() * 0.25})`;
      ctx.beginPath();
      ctx.ellipse(
        -26 + r() * 52,
        RIM.y + 4 + r() * 10,
        1.5 + r() * 3,
        0.8 + r() * 1.4,
        0,
        0,
        TAU,
      );
      ctx.fill();
    }
    for (const x of [-18, 0, 18]) {
      ctx.strokeStyle = "rgba(0,0,0,0.45)";
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(
        x * 1.55,
        RIM.y +
          RIM.ry * Math.sqrt(Math.max(0, 1 - (x * 1.55) ** 2 / RIM.rx ** 2)),
      );
      ctx.quadraticCurveTo(x * 1.2, RIM.y + 14, x * 0.55, 4);
      ctx.stroke();
      ctx.strokeStyle = "rgba(255,255,255,0.12)";
      ctx.lineWidth = 0.7;
      ctx.stroke();
    }
    ctx.restore();
    g = ctx.createLinearGradient(-15, 0, 15, 0);
    g.addColorStop(0, "#4a2e14");
    g.addColorStop(0.25, "#d2a25a");
    g.addColorStop(0.5, "#8f6630");
    g.addColorStop(1, "#33200c");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.roundRect(-15, 1, 30, 6, 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,236,190,0.55)";
    ctx.fillRect(-14, 1.2, 28, 0.8);
    for (const x of [-10, -3.5, 3.5, 10]) {
      ctx.fillStyle = "#3a240f";
      ctx.beginPath();
      ctx.arc(x, 4.2, 1.1, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(255,230,170,0.8)";
      ctx.beginPath();
      ctx.arc(x - 0.35, 3.8, 0.45, 0, TAU);
      ctx.fill();
    }
    ctx.fillStyle = "rgba(92,160,128,0.6)";
    ctx.fillRect(6, 5.2, 2.5, 1);
    ctx.fillRect(-12, 5.4, 1.8, 0.9);
    rimDraw(ctx, false);
    ctx.save();
    ellipsePath(ctx, 0, RIM.iy, RIM.irx, RIM.iry);
    ctx.clip();
    g = ctx.createLinearGradient(0, RIM.iy - RIM.iry, 0, RIM.iy + RIM.iry);
    g.addColorStop(0, "#3a2a22");
    g.addColorStop(0.45, "#16100d");
    g.addColorStop(1, "#0b0807");
    ctx.fillStyle = g;
    ctx.fillRect(-30, RIM.iy - 12, 60, 24);
    for (let i = 0; i < 22; i++) {
      const x = -22 + r() * 44,
        y = RIM.iy - 2 + r() * 9,
        s = 2 + r() * 2.6;
      ctx.fillStyle = "#2a2522";
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.7, r(), 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(200,190,180,0.22)";
      ctx.beginPath();
      ctx.ellipse(x - s * 0.25, y - s * 0.3, s * 0.5, s * 0.3, 0, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  });
  // the rim's front lip again, drawn over the flame's base so it sits in the bowl
  piece("rimfront", 84, 100, 0.5, 0.62, (ctx, k) => {
    ctx.scale(k, k);
    ctx.translate(42, 62);
    rimDraw(ctx, true);
  });
  // glowing coal bed + warm light on the bowl's inner wall
  piece("coals", 84, 100, 0.5, 0.62, (ctx, k) => {
    ctx.scale(k, k);
    ctx.translate(42, 62);
    const r = rng(33 * 7);
    ctx.save();
    ellipsePath(ctx, 0, RIM.iy, RIM.irx, RIM.iry);
    ctx.clip();
    let g = ctx.createLinearGradient(0, RIM.iy - RIM.iry, 0, RIM.iy + 2);
    g.addColorStop(0, "rgba(255,150,60,0.75)");
    g.addColorStop(1, "rgba(255,90,20,0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(-30, RIM.iy - 12, 60, 14);
    for (let i = 0; i < 26; i++) {
      const x = -23 + r() * 46,
        y = RIM.iy - 3 + r() * 10,
        s = 2 + r() * 2.8;
      g = ctx.createRadialGradient(x, y - s * 0.2, 0, x, y, s);
      g.addColorStop(0, "#fff2b0");
      g.addColorStop(0.35, "#ffa040");
      g.addColorStop(0.75, "#b4320c");
      g.addColorStop(1, "#3a0e05");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y, s, s * 0.7, r(), 0, TAU);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,190,100,0.65)";
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(
      0,
      RIM.iy,
      RIM.irx + 0.8,
      RIM.iry + 0.8,
      0,
      Math.PI * 1.08,
      Math.PI * 1.92,
    );
    ctx.stroke();
  });

  // ── Fire
  piece("flame-o", 40, 76, 0.5, 0.86, (ctx, k) => {
    ctx.scale(k, k);
    flameLayers(ctx, 20, 65, 34, 62, [
      [1, "rgba(200,40,12,0.35)", 1],
      [0.88, "rgba(240,70,18,0.5)", 1.5],
      [0.74, "rgba(255,110,30,0.75)", 1],
      [0.6, "rgba(255,150,45,0.85)", 0.5],
    ]);
  });
  piece("flame-c", 24, 48, 0.5, 0.86, (ctx, k) => {
    ctx.scale(k, k);
    flameLayers(ctx, 12, 41, 18, 36, [
      [1, "rgba(255,190,80,0.55)"],
      [0.78, "rgba(255,225,130,0.75)"],
      [0.55, "rgba(255,248,215,0.95)"],
    ]);
  });
  piece("flame-s", 22, 42, 0.5, 0.86, (ctx, k) => {
    ctx.scale(k, k);
    flameLayers(ctx, 11, 36, 18, 32, [
      [1, "rgba(210,50,14,0.4)", 0.6],
      [0.82, "rgba(255,100,28,0.75)", 0.8],
      [0.62, "rgba(255,160,55,0.9)", 0.4],
      [0.42, "rgba(255,226,140,0.95)"],
      [0.24, "rgba(255,250,225,1)"],
    ]);
  });
  piece(
    "glow",
    128,
    128,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
      g.addColorStop(0, "rgba(255,170,80,0.6)");
      g.addColorStop(0.35, "rgba(255,110,40,0.25)");
      g.addColorStop(0.7, "rgba(255,80,20,0.07)");
      g.addColorStop(1, "rgba(255,60,10,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 128, 128);
    },
    0.25,
  );
  piece(
    "pool",
    240,
    150,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      ctx.translate(120, 75);
      ctx.scale(1, 0.62);
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, 120);
      g.addColorStop(0, "rgba(255,160,70,0.55)");
      g.addColorStop(0.4, "rgba(255,110,40,0.25)");
      g.addColorStop(0.75, "rgba(255,80,20,0.07)");
      g.addColorStop(1, "rgba(255,60,10,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(0, 0, 120, 0, TAU);
      ctx.fill();
    },
    0.25,
  );
  const sparkPiece = (name: string, a: string, b: string, c: string) =>
    piece(name, 10, 10, 0.5, 0.5, (ctx, k) => {
      ctx.scale(k, k);
      const g = ctx.createRadialGradient(5, 5, 0, 5, 5, 5);
      g.addColorStop(0, a);
      g.addColorStop(0.35, b);
      g.addColorStop(1, c);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 10, 10);
    });
  sparkPiece(
    "spark",
    "rgba(255,250,220,1)",
    "rgba(255,190,90,0.8)",
    "rgba(255,100,30,0)",
  );
  sparkPiece(
    "spark-teal",
    "rgba(235,255,250,1)",
    "rgba(140,235,210,0.8)",
    "rgba(80,200,180,0)",
  );
  piece(
    "smoke",
    64,
    64,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      const r = rng(5);
      for (let i = 0; i < 7; i++) {
        const x = 22 + r() * 20,
          y = 22 + r() * 20,
          s = 12 + r() * 10;
        const g = ctx.createRadialGradient(x, y, 0, x, y, s);
        g.addColorStop(0, "rgba(70,60,56,0.28)");
        g.addColorStop(1, "rgba(70,60,56,0)");
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 64, 64);
      }
    },
    0.4,
  );
  // the grounding moment: a beam of fire between braziers, and a shock ring
  piece(
    "beam",
    256,
    28,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      const gx = ctx.createLinearGradient(0, 0, 256, 0);
      gx.addColorStop(0, "rgba(255,200,110,0)");
      gx.addColorStop(0.12, "rgba(255,200,110,1)");
      gx.addColorStop(0.88, "rgba(255,200,110,1)");
      gx.addColorStop(1, "rgba(255,200,110,0)");
      ctx.fillStyle = gx;
      ctx.fillRect(0, 0, 256, 28);
      ctx.globalCompositeOperation = "destination-in";
      const gy = ctx.createLinearGradient(0, 0, 0, 28);
      gy.addColorStop(0, "rgba(0,0,0,0)");
      gy.addColorStop(0.38, "rgba(0,0,0,0.35)");
      gy.addColorStop(0.5, "rgba(0,0,0,1)");
      gy.addColorStop(0.62, "rgba(0,0,0,0.35)");
      gy.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gy;
      ctx.fillRect(0, 0, 256, 28);
    },
    0.5,
  );
  piece(
    "shock",
    200,
    200,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      const g = ctx.createRadialGradient(100, 100, 70, 100, 100, 100);
      g.addColorStop(0, "rgba(255,150,60,0)");
      g.addColorStop(0.7, "rgba(255,190,100,0.55)");
      g.addColorStop(0.82, "rgba(255,240,190,0.9)");
      g.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 200, 200);
    },
    0.4,
  );

  // ── Burning ground: heat-split slabs, charred crust, molten seams
  const { spokes, NS, radii } = scorchNet;
  piece(
    "scorch",
    SCORCH_R * 2 + 4,
    SCORCH_R * 2 + 4,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      const R = SCORCH_R;
      ctx.translate(R + 2, R + 2);
      const r = rng(11);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.clip();
      let g = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      g.addColorStop(0, "rgba(40,14,6,0.95)");
      g.addColorStop(0.25, "rgba(20,10,7,0.94)");
      g.addColorStop(0.7, "rgba(22,12,9,0.86)");
      g.addColorStop(0.9, "rgba(30,15,10,0.62)");
      g.addColorStop(1, "rgba(40,16,8,0.4)");
      ctx.fillStyle = g;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      for (let i = 0; i < NS; i++) {
        const p = spokes[i],
          q = spokes[(i + 1) % NS];
        for (let j = 1; j < radii.length - 1; j += 2) {
          ctx.beginPath();
          ctx.moveTo(p[j][0], p[j][1]);
          ctx.lineTo(p[j + 1][0], p[j + 1][1]);
          ctx.lineTo(q[j + 1][0], q[j + 1][1]);
          ctx.lineTo(q[j][0], q[j][1]);
          ctx.closePath();
          const t = r();
          ctx.fillStyle =
            t < 0.4
              ? `rgba(70,58,52,${0.12 + r() * 0.12})`
              : t < 0.75
                ? `rgba(0,0,0,${0.15 + r() * 0.2})`
                : `rgba(90,36,14,${0.1 + r() * 0.12})`;
          ctx.fill();
        }
      }
      for (let i = 0; i < 80; i++) {
        const a = r() * TAU,
          d = Math.sqrt(r()) * R * 0.97,
          s = 3 + r() * 10;
        ctx.fillStyle =
          r() < 0.45
            ? `rgba(128,114,104,${0.06 + r() * 0.12})`
            : `rgba(0,0,0,${0.1 + r() * 0.2})`;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a) * d,
          Math.sin(a) * d,
          s,
          s * (0.4 + r() * 0.5),
          r() * 3,
          0,
          TAU,
        );
        ctx.fill();
      }
      speckle(
        ctx,
        r,
        -R,
        -R,
        R * 2,
        R * 2,
        1600,
        "rgba(170,150,135,0.2)",
        "rgba(0,0,0,0.35)",
        1.1,
      );
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.32);
      g.addColorStop(0, "rgba(255,170,70,0.85)");
      g.addColorStop(0.35, "rgba(230,80,20,0.55)");
      g.addColorStop(1, "rgba(120,30,8,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      for (let i = 0; i < 9; i++) {
        const a = r() * TAU,
          d = 6 + r() * 22;
        ctx.fillStyle = `rgba(24,10,6,${0.55 + r() * 0.3})`;
        ctx.beginPath();
        ctx.ellipse(
          Math.cos(a) * d,
          Math.sin(a) * d,
          3 + r() * 5,
          2 + r() * 3,
          r() * 3,
          0,
          TAU,
        );
        ctx.fill();
      }
      strokeCracks(ctx, 5, "rgba(6,3,2,0.8)");
      strokeCracks(ctx, 2.6, "rgba(214,62,16,0.95)");
      strokeCracks(ctx, 1.3, "rgba(255,160,58,1)");
      strokeCracks(ctx, 0.45, "rgba(255,238,185,1)");
      for (let i = 0; i < 70; i++) {
        const a = r() * TAU,
          d = Math.sqrt(r()) * R * 0.96,
          s = 0.5 + r() * 1.2;
        ctx.fillStyle =
          r() < 0.6 ? "rgba(255,120,40,0.85)" : "rgba(255,214,130,0.95)";
        ctx.beginPath();
        ctx.arc(Math.cos(a) * d, Math.sin(a) * d, s, 0, TAU);
        ctx.fill();
      }
      g = ctx.createRadialGradient(0, 0, R * 0.8, 0, 0, R);
      g.addColorStop(0, "rgba(255,90,25,0)");
      g.addColorStop(0.75, "rgba(255,96,30,0.16)");
      g.addColorStop(1, "rgba(255,140,60,0.42)");
      ctx.fillStyle = g;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();
    },
    0.6,
  );
  piece(
    "scorch-glow",
    SCORCH_R * 2 + 4,
    SCORCH_R * 2 + 4,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      const R = SCORCH_R;
      ctx.translate(R + 2, R + 2);
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, R, 0, TAU);
      ctx.clip();
      strokeCracks(ctx, 12, "rgba(255,70,15,0.1)");
      strokeCracks(ctx, 6, "rgba(255,100,25,0.18)");
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
      g.addColorStop(0, "rgba(255,120,40,0.4)");
      g.addColorStop(0.5, "rgba(255,80,20,0.12)");
      g.addColorStop(1, "rgba(255,70,15,0)");
      ctx.fillStyle = g;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();
    },
    0.3,
  );

  // ── Dive trail: a charred lane exactly 2 × the dive width across, with an ember seam
  piece(
    "trail",
    TRAIL_L,
    TH * 2 + 4,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      ctx.translate(0, TH + 2);
      const r = rng(23);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      for (let x = 0; x <= TRAIL_L; x += 8)
        ctx.lineTo(x, -TH + r() * 7 * (x > 10 && x < TRAIL_L - 10 ? 1 : 3));
      for (let x = TRAIL_L; x >= 0; x -= 8)
        ctx.lineTo(x, TH - r() * 7 * (x > 10 && x < TRAIL_L - 10 ? 1 : 3));
      ctx.closePath();
      let g = ctx.createLinearGradient(0, -TH, 0, TH);
      g.addColorStop(0, "rgba(40,16,8,0.55)");
      g.addColorStop(0.3, "rgba(16,8,5,0.85)");
      g.addColorStop(0.5, "rgba(10,5,3,0.92)");
      g.addColorStop(0.7, "rgba(16,8,5,0.85)");
      g.addColorStop(1, "rgba(40,16,8,0.55)");
      ctx.fillStyle = g;
      ctx.fill();
      ctx.save();
      ctx.clip();
      for (let i = 0; i < 46; i++) {
        const y = (r() - 0.5) * TH * 1.8,
          x = r() * TRAIL_L,
          l = 20 + r() * 70;
        ctx.strokeStyle =
          r() < 0.5
            ? `rgba(120,100,90,${0.08 + r() * 0.12})`
            : `rgba(0,0,0,${0.2 + r() * 0.2})`;
        ctx.lineWidth = 0.8 + r() * 1.6;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + l, y + (r() - 0.5) * 3);
        ctx.stroke();
      }
      g = ctx.createLinearGradient(0, -TH, 0, TH);
      g.addColorStop(0, "rgba(255,120,40,0.4)");
      g.addColorStop(0.14, "rgba(255,120,40,0)");
      g.addColorStop(0.86, "rgba(255,120,40,0)");
      g.addColorStop(1, "rgba(255,120,40,0.4)");
      ctx.fillStyle = g;
      ctx.fillRect(0, -TH, TRAIL_L, TH * 2);
      ctx.restore();
      const seam: [number, number][] = [];
      for (let x = 6; x <= TRAIL_L - 6; x += 10)
        seam.push([x, (r() - 0.5) * 9]);
      for (const [w, c] of [
        [6, "rgba(6,3,2,0.8)"],
        [3, "rgba(235,80,20,0.95)"],
        [1.5, "rgba(255,180,70,1)"],
        [0.6, "rgba(255,245,200,1)"],
      ] as const) {
        ctx.beginPath();
        seam.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        ctx.lineWidth = w;
        ctx.strokeStyle = c;
        ctx.stroke();
      }
      for (let i = 0; i < 60; i++) {
        ctx.fillStyle =
          r() < 0.6 ? "rgba(255,120,40,0.9)" : "rgba(255,220,130,0.95)";
        ctx.beginPath();
        ctx.arc(
          8 + r() * (TRAIL_L - 16),
          (r() - 0.5) * TH * 1.6,
          0.5 + r() * 1.3,
          0,
          TAU,
        );
        ctx.fill();
      }
      ctx.globalCompositeOperation = "destination-in";
      g = ctx.createLinearGradient(0, 0, TRAIL_L, 0);
      g.addColorStop(0, "rgba(0,0,0,0)");
      g.addColorStop(0.08, "rgba(0,0,0,1)");
      g.addColorStop(0.92, "rgba(0,0,0,1)");
      g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, -TH - 2, TRAIL_L, TH * 2 + 4);
    },
    0.75,
  );
  piece(
    "trail-glow",
    TRAIL_L,
    40,
    0.5,
    0.5,
    (ctx, k) => {
      ctx.scale(k, k);
      const gy = ctx.createLinearGradient(0, 0, 0, 40);
      gy.addColorStop(0, "rgba(255,90,20,0)");
      gy.addColorStop(0.5, "rgba(255,130,40,0.5)");
      gy.addColorStop(1, "rgba(255,90,20,0)");
      ctx.fillStyle = gy;
      ctx.fillRect(0, 0, TRAIL_L, 40);
      ctx.globalCompositeOperation = "destination-in";
      const gx = ctx.createLinearGradient(0, 0, TRAIL_L, 0);
      gx.addColorStop(0, "rgba(0,0,0,0)");
      gx.addColorStop(0.1, "rgba(0,0,0,1)");
      gx.addColorStop(0.9, "rgba(0,0,0,1)");
      gx.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = gx;
      ctx.fillRect(0, 0, TRAIL_L, 40);
    },
    0.25,
  );

  // ── Fraying (the "molting" trait): a tassel fallen from Lumiwick's ribbons
  piece("feather", 24, 52, 0.5, 0.5, (ctx, k) => {
    ctx.scale(k, k);
    ctx.translate(12, 26);
    // a stub of red ribbon with a gold edge
    ctx.fillStyle = "#d8401c";
    ctx.beginPath();
    ctx.moveTo(-3.5, -24);
    ctx.quadraticCurveTo(-1, -19, -3, -14);
    ctx.lineTo(3, -14);
    ctx.quadraticCurveTo(5, -19, 3.5, -24);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#ffd36a";
    ctx.lineWidth = 0.9;
    ctx.stroke();
    // the bundle of paper strands, flame-shaped
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.bezierCurveTo(-10, 0, -8, 12, -1, 22);
    ctx.lineTo(1, 22);
    ctx.bezierCurveTo(8, 12, 10, 0, 4, -9);
    ctx.closePath();
    const g = ctx.createLinearGradient(0, -9, 0, 22);
    g.addColorStop(0, "#ff8a3a");
    g.addColorStop(0.5, "#e2401a");
    g.addColorStop(1, "#ffb84a");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = "rgba(255,214,110,0.75)";
    ctx.lineWidth = 0.8;
    for (const x of [-4, -1.3, 1.3, 4]) {
      ctx.beginPath();
      ctx.moveTo(x * 0.6, -8);
      ctx.quadraticCurveTo(x * 1.2, 6, x * 0.4, 22);
      ctx.stroke();
    }
    ctx.restore();
    // the gold bead it hung from
    const b = ctx.createRadialGradient(-1.2, -12.2, 0.4, 0, -11, 4.6);
    b.addColorStop(0, "#fff6c8");
    b.addColorStop(0.55, "#f0b23a");
    b.addColorStop(1, "#8a4c0c");
    ctx.fillStyle = b;
    ctx.beginPath();
    ctx.arc(0, -11, 4.4, 0, Math.PI * 2);
    ctx.fill();
  });
  return out;
}

export interface TerraceSpot {
  piece: TerracePiece;
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Shelf-pack the pieces at k atlas pixels per world unit (1 px gutter each side). */
export function packTerrace(k: number, width = 1024) {
  const list = terracePieces()
    .map((p) => ({
      p,
      w: Math.ceil(p.w * k * p.res) + 2,
      h: Math.ceil(p.h * k * p.res) + 2,
    }))
    .sort((a, b) => b.h - a.h);
  let x = 0,
    y = 0,
    shelf = 0;
  const spots: TerraceSpot[] = [];
  for (const it of list) {
    if (x + it.w > width) {
      x = 0;
      y += shelf;
      shelf = 0;
    }
    spots.push({ piece: it.p, x, y, w: it.w, h: it.h });
    x += it.w;
    shelf = Math.max(shelf, it.h);
  }
  return { width, height: Math.ceil(y + shelf), spots };
}
export function paintTerrace(ctx: Ctx, spots: TerraceSpot[], k: number) {
  for (const s of spots) {
    ctx.save();
    ctx.beginPath();
    ctx.rect(s.x, s.y, s.w, s.h);
    ctx.clip();
    ctx.translate(s.x + 1, s.y + 1);
    s.piece.draw(ctx, k * s.piece.res);
    ctx.restore();
  }
}

/**
 * The terrace's ritual circle as a worn bronze inlay set into the slabs
 * (painted into the floor once, raid-arena-art.ts).
 */
export function engravedRing(x: Ctx, cx: number, cy: number, R: number) {
  const r = rng(260);
  x.save();
  x.lineWidth = 9;
  x.strokeStyle = "rgba(10,5,3,0.42)";
  x.beginPath();
  x.arc(cx, cy, R + 0.5, 0, TAU);
  x.stroke();
  const n = 72;
  for (let i = 0; i < n; i++) {
    if (r() < 0.06) continue;
    const a0 = (i * TAU) / n + 0.004,
      a1 = ((i + 1) * TAU) / n - 0.004;
    const t = r();
    x.strokeStyle = `rgba(${(170 + t * 40) | 0},${(120 + t * 30) | 0},${(66 + t * 20) | 0},0.62)`;
    x.lineWidth = 3.4;
    x.beginPath();
    x.arc(cx, cy, R, a0, a1);
    x.stroke();
  }
  const g = x.createLinearGradient(cx - R, cy - R, cx + R, cy + R);
  g.addColorStop(0, "rgba(255,232,180,0.5)");
  g.addColorStop(0.5, "rgba(255,232,180,0.05)");
  g.addColorStop(1, "rgba(255,232,180,0)");
  x.strokeStyle = g;
  x.lineWidth = 1;
  x.beginPath();
  x.arc(cx, cy, R - 1.6, 0, TAU);
  x.stroke();
  x.fillStyle = "rgba(92,160,128,0.55)";
  for (let i = 0; i < 40; i++) {
    const a = r() * TAU;
    x.fillRect(
      cx + Math.cos(a) * R - 1,
      cy + Math.sin(a) * R - 0.6,
      1.5 + r() * 2.5,
      1.2,
    );
  }
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    const px = cx + Math.cos(a) * R,
      py = cy + Math.sin(a) * R;
    x.fillStyle = "rgba(20,10,5,0.6)";
    x.beginPath();
    x.arc(px + 0.6, py + 0.8, 4.4, 0, TAU);
    x.fill();
    const sg = x.createRadialGradient(px - 1.2, py - 1.4, 0, px, py, 4);
    sg.addColorStop(0, "#f0cf8e");
    sg.addColorStop(0.6, "#a7773d");
    sg.addColorStop(1, "#4d3014");
    x.fillStyle = sg;
    x.beginPath();
    x.arc(px, py, 3.8, 0, TAU);
    x.fill();
  }
  x.restore();
}

// ───────────────────────── the look each frame (pure) ─────────────────────────
/** Cheap flicker: a few incommensurate sines (constant 0 when time is frozen). */
export const nz = (t: number, s: number) =>
  Math.sin(t * 7.3 + s) * 0.5 +
  Math.sin(t * 13.1 + s * 2.3) * 0.3 +
  Math.sin(t * 23.7 + s * 0.7) * 0.2;

export type BrazierRing = "grey" | "teal" | "gold";
export interface BrazierLook {
  ring: BrazierRing;
  lit: boolean;
  /** Lit: share of its time left; else undefined. */
  left?: number;
  /** Lighting progress (0 when nobody stands in it, or lit). */
  progress: number;
  /** How hot the bowl is (coals, floor light): 0 cold … 1. */
  heat: number;
  /** Flame size (0: no flame). */
  flame: number;
  /** Lit with under a quarter of its time left: the fire gutters and smokes. */
  dying: boolean;
}
/**
 * What a brazier shows, from the server's state: grey while Emberwing is on
 * the ground (or just took off in Updraft), teal while it can be lit, gold
 * once lit. The flame grows with the lighting progress, burns full when lit,
 * and dies down over the last quarter of its time.
 */
export function brazierLook(
  b: { progress: number; litUntil: number },
  o: {
    time: number;
    airborne: boolean;
    trait?: string;
    takeoffAt?: number;
    partySize: number;
    phase: number;
    peril: number;
  },
): BrazierLook {
  const lit = b.litUntil > o.time;
  const active =
    o.airborne && (o.trait !== "updraft" || o.time - (o.takeoffAt ?? 0) >= 2);
  const ring: BrazierRing = lit ? "gold" : active ? "teal" : "grey";
  const left = lit
    ? clamp(
        (b.litUntil - o.time) / brazierLifetime(o.partySize, o.phase, o.peril),
      )
    : undefined;
  const progress = lit ? 0 : clamp(b.progress);
  const heat = lit ? 0.45 + 0.55 * clamp(left! * 4) : progress * 0.85;
  const flame = lit
    ? 0.5 + 0.5 * clamp(left! * 4)
    : progress > 0
      ? 0.24 + 0.34 * progress
      : 0;
  return { ring, lit, left, progress, heat, flame, dying: lit && left! < 0.25 };
}
/** The small flames on a burning patch: where, and how big (more on big patches). */
export function patchFlames(f: {
  id: number;
  x: number;
  y: number;
  radius: number;
}) {
  const n = f.radius >= 120 ? 6 : 4,
    s = clamp(f.radius / 95, 0.75, 1.5);
  return Array.from({ length: n }, (_, i) => {
    const ang = (i * TAU) / n + f.id,
      d = i % 2 && n === 6 ? 0.78 : 0.55;
    return {
      x: f.x + Math.cos(ang) * f.radius * d,
      y: f.y + Math.sin(ang) * f.radius * d * 0.9,
      s,
      seed: i * 3.1 + f.id,
    };
  });
}
/** Most flames along a flame ring (keeps a big ring cheap). */
export const RING_FLAMES_MAX = 24;
/**
 * The flames riding a flame ring of radius R: one every ~50 px up to a cap,
 * each larger as they spread out, so a big ring stays cheap. The ring itself
 * reads as one continuous band of fire (drawn as lines on its exact band),
 * the flames only ride it. Off-screen flames are skipped.
 */
export function ringFlames(
  ring: { x: number; y: number },
  R: number,
  bounds = { x0: -24, y0: -24, x1: 1624, y1: 944 },
) {
  const n = Math.min(RING_FLAMES_MAX, Math.max(10, Math.floor((TAU * R) / 50)));
  const spacing = (TAU * R) / n,
    grow = clamp(spacing / 46, 1, 1.7);
  const out: { x: number; y: number; s: number; seed: number }[] = [];
  for (let i = 0; i < n; i++) {
    const ang = (i * TAU) / n + R * 0.002,
      x = ring.x + Math.cos(ang) * R,
      y = ring.y + Math.sin(ang) * R;
    if (x < bounds.x0 || x > bounds.x1 || y < bounds.y0 || y > bounds.y1)
      continue;
    const big = i % 3 === 0 ? 1.2 : i % 3 === 1 ? 0.88 : 1;
    out.push({ x, y, s: big * grow, seed: i * 1.7 });
  }
  return out;
}
/** A dive trail's placement: centre, angle and the trail piece's stretch. */
export function trailPlacement(f: {
  x: number;
  y: number;
  tx: number;
  ty: number;
  width: number;
}) {
  const dx = f.tx - f.x,
    dy = f.ty - f.y,
    len = Math.hypot(dx, dy) || 1;
  return {
    x: (f.x + f.tx) / 2,
    y: (f.y + f.ty) / 2,
    rot: Math.atan2(dy, dx),
    sx: (len + 2 * f.width * 0.6) / TRAIL_L,
    sy: f.width / TH,
    len,
    /** Unit normal × width: the lane's exact edges are the segment ± this. */
    nx: (-dy / len) * f.width,
    ny: (dx / len) * f.width,
  };
}

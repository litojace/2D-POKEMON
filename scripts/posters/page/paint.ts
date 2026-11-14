/**
 * The poster painter for a boss: it takes the rig's pieces (their shapes,
 * colours and face layout) and paints them again for a poster, each with
 * real form: a soft dome of relief from its silhouette, lit by the scene's
 * one key light (wrapped diffuse with a soft terminator into a cool core
 * shadow), bounce light from below in the element's colour, specular
 * highlights, a rim on the edges turned to the light, ambient occlusion
 * where pieces overlap (each piece casts a soft shadow on what is under
 * it), and the material's own texture (paper fibre and inner glow, wet
 * caustics, glossy ink reflections, fleece curls). Then brush strokes that
 * follow the forms, so it reads painted, with the face kept crisp.
 */
import type { Cutout, Layer } from "./bosses";

export interface Mat {
  /** 0-1: how much the new lighting replaces the rig's own shading. */
  strength: number;
  /** Relief radius as a fraction of the piece's thickest point (smaller = flatter centre, rounder edge). */
  round: number;
  amb: number;
  wrap: number;
  spec: number;
  shin: number;
  rim: number;
  bounce: number;
  /** Inner glow (subsurface) colour and amount. */
  sss?: [number, number, number];
  sssK?: number;
  /** Overall exposure multiplier. */
  expose?: number;
  tex?: "paper" | "caustic" | "ink" | "fleece" | "crystal" | "horn";
  /** Shift pale low-saturation pixels toward this colour (fleece). */
  cream?: [number, number, number];
  /** Sparkle specks over the lit side. */
  glitter?: number;
  /** A second, warm specular light (lantern reflections). */
  spec2?: number;
  /** Leave as painted (face parts): no relight. */
  keep?: boolean;
  /** Leave out entirely. */
  skip?: boolean;
}
export interface Light {
  /** Key light direction, screen space (x right, y down, z toward the viewer), towards the light. */
  key: [number, number, number];
  keyTint: [number, number, number];
  shadowTint: [number, number, number];
  rimColor: [number, number, number];
  bounceColor: [number, number, number];
  /** The warm second light (direction like key). */
  key2?: [number, number, number];
  key2Color?: [number, number, number];
}
export type MatTable = [RegExp, Partial<Mat>][];

const BASE: Mat = {
  strength: 0.8,
  round: 0.9,
  amb: 0.42,
  wrap: 0.45,
  spec: 0.18,
  shin: 24,
  rim: 0.6,
  bounce: 0.35,
};

function norm(v: [number, number, number]): [number, number, number] {
  const l = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / l, v[1] / l, v[2] / l];
}
function rng(seed: number) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return ((s >>> 0) % 1e9) / 1e9;
  };
}

/** Chamfer distance (px) from each inside pixel to the outside. */
function distance(A: Uint8ClampedArray, w: number, h: number) {
  const D = new Float32Array(w * h);
  const INF = 1e9;
  for (let i = 0; i < w * h; i++) D[i] = A[i * 4 + 3] > 110 ? INF : 0;
  const a = 1,
    b = 1.414;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!D[i]) continue;
      let v = D[i];
      if (x > 0) v = Math.min(v, D[i - 1] + a);
      else v = Math.min(v, a);
      if (y > 0) {
        v = Math.min(v, D[i - w] + a);
        if (x > 0) v = Math.min(v, D[i - w - 1] + b);
        if (x < w - 1) v = Math.min(v, D[i - w + 1] + b);
      } else v = Math.min(v, a);
      D[i] = v;
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (!D[i]) continue;
      let v = D[i];
      if (x < w - 1) v = Math.min(v, D[i + 1] + a);
      else v = Math.min(v, a);
      if (y < h - 1) {
        v = Math.min(v, D[i + w] + a);
        if (x < w - 1) v = Math.min(v, D[i + w + 1] + b);
        if (x > 0) v = Math.min(v, D[i + w - 1] + b);
      } else v = Math.min(v, a);
      D[i] = v;
    }
  return D;
}
function boxBlur(src: Float32Array, w: number, h: number, r: number) {
  if (r < 1) return src;
  const tmp = new Float32Array(w * h),
    out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let acc = 0;
    const row = y * w;
    for (let x = -r; x <= r; x++)
      acc += src[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) {
      tmp[row + x] = acc / (2 * r + 1);
      acc +=
        src[row + Math.min(w - 1, x + r + 1)] - src[row + Math.max(0, x - r)];
    }
  }
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r; y <= r; y++)
      acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) {
      out[y * w + x] = acc / (2 * r + 1);
      acc +=
        tmp[Math.min(h - 1, y + r + 1) * w + x] -
        tmp[Math.max(0, y - r) * w + x];
    }
  }
  return out;
}

/** Re-light one piece in place. */
function relight(layer: Layer, m: Mat, L: Light, seed: number) {
  const { c } = layer;
  const w = c.width,
    h = c.height;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const D = distance(d, w, h);
  let maxD = 0;
  for (let i = 0; i < D.length; i++) if (D[i] > maxD) maxD = D[i];
  if (maxD < 2) return;
  const R = Math.max(3, maxD * m.round);
  let H = new Float32Array(w * h);
  for (let i = 0; i < H.length; i++) {
    const t = Math.min(1, D[i] / R);
    H[i] = Math.sqrt(1 - (1 - t) * (1 - t));
  }
  H = boxBlur(H, w, h, Math.max(1, Math.round(R * 0.06)));
  const key = norm(L.key);
  const hv = norm([key[0], key[1], key[2] + 1]);
  const k2 = L.key2 ? norm(L.key2) : null;
  const h2 = k2 ? norm([k2[0], k2[1], k2[2] + 1]) : null;
  const r = rng(seed);
  const ex = m.expose ?? 1;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x,
        p = i * 4;
      if (d[p + 3] < 4) continue;
      const hx = (H[i + (x < w - 1 ? 1 : 0)] - H[i - (x > 0 ? 1 : 0)]) * 0.5;
      const hy = (H[i + (y < h - 1 ? w : 0)] - H[i - (y > 0 ? w : 0)]) * 0.5;
      let nx = -hx * R,
        ny = -hy * R,
        nz = 1;
      const nl = Math.hypot(nx, ny, nz);
      nx /= nl;
      ny /= nl;
      nz /= nl;
      const ndl = nx * key[0] + ny * key[1] + nz * key[2];
      const diff = Math.max(0, (ndl + m.wrap) / (1 + m.wrap));
      // terminator: a narrow cool band where the light turns away
      const term = Math.exp(-((ndl + 0.05) * (ndl + 0.05)) / 0.02) * 0.12;
      let R0 = d[p] / 255,
        G0 = d[p + 1] / 255,
        B0 = d[p + 2] / 255;
      if (m.cream) {
        const mx = Math.max(R0, G0, B0),
          mn = Math.min(R0, G0, B0);
        const sat = mx > 0 ? (mx - mn) / mx : 0;
        if (sat < 0.45 && mx > 0.3) {
          const lum = 0.3 * R0 + 0.59 * G0 + 0.11 * B0;
          const k = Math.min(1, (1 - sat / 0.45) * 1.1) * 0.85;
          const cl = 0.5 + (lum - 0.5) * 1.3 + 0.06;
          R0 = R0 * (1 - k) + m.cream[0] * cl * k;
          G0 = G0 * (1 - k) + m.cream[1] * cl * k;
          B0 = B0 * (1 - k) + m.cream[2] * cl * k;
        }
      }
      const f = (t: number, s: number, kt: number) =>
        s * m.amb + (kt * 1.12 - s * m.amb) * diff - t * term;
      let Rr = R0 * f(0.3, L.shadowTint[0], L.keyTint[0]);
      let Gg = G0 * f(0.5, L.shadowTint[1], L.keyTint[1]);
      let Bb = B0 * f(-0.4, L.shadowTint[2], L.keyTint[2]);
      // bounce from below
      const bo = Math.max(0, ny * 0.8 + nz * 0.2) * m.bounce * 0.55;
      const lum0 = 0.35 + 0.65 * (0.3 * R0 + 0.59 * G0 + 0.11 * B0);
      Rr += L.bounceColor[0] * bo * lum0;
      Gg += L.bounceColor[1] * bo * lum0;
      Bb += L.bounceColor[2] * bo * lum0;
      // inner glow: brightest deep inside
      if (m.sss && m.sssK) {
        const s = Math.pow(Math.min(1, D[i] / maxD), 1.2) * m.sssK;
        Rr += m.sss[0] * s;
        Gg += m.sss[1] * s;
        Bb += m.sss[2] * s;
      }
      Rr *= ex;
      Gg *= ex;
      Bb *= ex;
      // blend with the rig's own painting
      Rr = R0 * (1 - m.strength) + Rr * m.strength;
      Gg = G0 * (1 - m.strength) + Gg * m.strength;
      Bb = B0 * (1 - m.strength) + Bb * m.strength;
      // specular and rim (added on top)
      const sp =
        Math.pow(Math.max(0, nx * hv[0] + ny * hv[1] + nz * hv[2]), m.shin) *
        m.spec;
      let add = sp;
      let ar = 0,
        ag = 0,
        ab = 0;
      if (h2 && m.spec2 && L.key2Color) {
        const s2 =
          Math.pow(
            Math.max(0, nx * h2[0] + ny * h2[1] + nz * h2[2]),
            m.shin * 1.4,
          ) * m.spec2;
        ar += L.key2Color[0] * s2;
        ag += L.key2Color[1] * s2;
        ab += L.key2Color[2] * s2;
      }
      const fres = Math.pow(1 - nz, 2.5);
      const rimL = fres * Math.max(0, nx * key[0] + ny * key[1]) * m.rim;
      ar += L.rimColor[0] * rimL;
      ag += L.rimColor[1] * rimL;
      ab += L.rimColor[2] * rimL;
      if (m.glitter && diff > 0.35 && r() < m.glitter) add += 0.35 + r() * 0.5;
      if (m.tex === "caustic") {
        const v =
          Math.sin(
            (x + layer.x) * 0.045 + Math.sin((y + layer.y) * 0.03) * 2.2,
          ) *
          Math.sin(
            (y + layer.y) * 0.05 + Math.sin((x + layer.x) * 0.037) * 2.0,
          );
        const ca = Math.pow(Math.max(0, 1 - Math.abs(v) * 4), 3);
        add += ca * 0.09 * (0.3 + diff);
      }
      d[p] = Math.min(255, (Rr + add + ar) * 255);
      d[p + 1] = Math.min(255, (Gg + add + ag) * 255);
      d[p + 2] = Math.min(255, (Bb + add + ab) * 255);
    }
  g.putImageData(img, 0, 0);
  texture(layer, m, D, maxD, L, seed);
}

/** The face (cutout px): textures stay off it. */
let AVOID = { x: 0, y: 0, rx: 1, ry: 1 };
const avoided = (x: number, y: number) =>
  Math.hypot((x - AVOID.x) / AVOID.rx, (y - AVOID.y) / AVOID.ry) < 1.15;
/** The material's painted texture, over the lit piece. */
function texture(
  layer: Layer,
  m: Mat,
  D: Float32Array,
  maxD: number,
  L: Light,
  seed: number,
) {
  if (!m.tex || m.tex === "caustic" || m.tex === "fleece") return;
  const { c } = layer;
  const w = c.width,
    h = c.height;
  const g = c.getContext("2d", { willReadFrequently: true })!;
  const r = rng(seed * 7 + 3);
  const img = g.getImageData(0, 0, w, h);
  const d = img.data;
  const inside = (x: number, y: number) => {
    const xi = Math.round(x),
      yi = Math.round(y);
    return (
      xi >= 0 &&
      yi >= 0 &&
      xi < w &&
      yi < h &&
      D[yi * w + xi] > 2 &&
      !avoided(x + layer.x, y + layer.y)
    );
  };
  const col = (x: number, y: number) => {
    const p = (Math.round(y) * w + Math.round(x)) * 4;
    return [d[p], d[p + 1], d[p + 2]];
  };
  g.save();
  g.globalCompositeOperation = "source-atop";
  const S = Math.max(1, maxD / 60);
  if (m.tex === "paper") {
    // paper fibres: fine streaks, a little lighter and darker
    for (let i = 0; i < (w * h) / 90; i++) {
      const x = r() * w,
        y = r() * h;
      if (!inside(x, y)) continue;
      const a = Math.PI / 2 + (r() - 0.5) * 0.5;
      const l = (4 + r() * 9) * S;
      g.strokeStyle =
        r() < 0.5 ? "rgba(255,240,200,0.05)" : "rgba(120,40,10,0.035)";
      g.lineWidth = Math.max(0.6, 0.8 * S);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
      g.stroke();
    }
  } else if (m.tex === "fleece") {
    // clumped curls: little arcs, lit on top and shaded below
    const n = (w * h) / (60 * S * S);
    for (let i = 0; i < n; i++) {
      const x = r() * w,
        y = r() * h;
      if (!inside(x, y)) continue;
      const [cr, cg, cb] = col(x, y);
      const mx = Math.max(cr, cg, cb),
        mn = Math.min(cr, cg, cb);
      if (mx < 120 || (mx - mn) / (mx || 1) > 0.4) continue;
      const rr = (3 + r() * 4.5) * S;
      const a0 = r() * Math.PI * 2;
      g.lineWidth = Math.max(0.8, rr * 0.38);
      g.lineCap = "round";
      g.strokeStyle = `rgba(${cr * 0.55},${cg * 0.5},${cb * 0.45},0.5)`;
      g.beginPath();
      g.arc(x + rr * 0.15, y + rr * 0.25, rr, a0, a0 + Math.PI * 1.3);
      g.stroke();
      g.strokeStyle = `rgba(${Math.min(255, cr * 1.18 + 20)},${Math.min(255, cg * 1.15 + 18)},${Math.min(255, cb * 1.1 + 10)},0.6)`;
      g.beginPath();
      g.arc(x, y, rr * 0.8, a0 + 0.3, a0 + Math.PI * 1.1);
      g.stroke();
    }
  } else if (m.tex === "ink") {
    // reflections of lantern light on the glossy ink
    const kx = L.key2?.[0] ?? -0.6,
      ky = L.key2?.[1] ?? 0.2;
    for (let i = 0; i < 3; i++) {
      const x = w * (0.5 + kx * (0.28 + i * 0.05)) + (r() - 0.5) * w * 0.08,
        y = h * (0.45 + ky * 0.3 + i * 0.12);
      if (!inside(x, y)) continue;
      const rr = (8 + r() * 10) * S;
      const gr = g.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, "rgba(255,214,140,0.55)");
      gr.addColorStop(1, "rgba(255,180,90,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.ellipse(x, y, rr * 0.6, rr, 0.3, 0, Math.PI * 2);
      g.fill();
    }
  } else if (m.tex === "horn") {
    // growth rings: fine dark arcs across the horn
    for (let i = 0; i < (w * h) / 500; i++) {
      const x = r() * w,
        y = r() * h;
      if (!inside(x, y)) continue;
      g.strokeStyle = "rgba(110,60,10,0.2)";
      g.lineWidth = Math.max(0.6, 0.9 * S);
      g.beginPath();
      g.arc(x, y, (4 + r() * 6) * S, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    }
  } else if (m.tex === "crystal") {
    for (let i = 0; i < (w * h) / 900; i++) {
      const x = r() * w,
        y = r() * h;
      if (!inside(x, y)) continue;
      g.fillStyle = "rgba(255,255,240,0.55)";
      g.beginPath();
      g.moveTo(x, y - 4 * S);
      g.lineTo(x + 1.5 * S, y);
      g.lineTo(x, y + 4 * S);
      g.lineTo(x - 1.5 * S, y);
      g.fill();
    }
  }
  g.restore();
}

/** Brush strokes that follow the forms (perpendicular to the light gradient). */
export function brushStrokes(
  src: HTMLCanvasElement,
  o: {
    size: number;
    len: number;
    step: number;
    alpha: number;
    seed: number;
    /** Only where the source is opaque. */
    solid?: boolean;
    /** Points to leave alone. */
    keep?: (x: number, y: number) => number;
    /** Skip strokes across edges stronger than this (keeps detail crisp). */
    edges?: number;
  },
) {
  const w = src.width,
    h = src.height;
  const sg = src.getContext("2d", { willReadFrequently: true })!;
  const d = sg.getImageData(0, 0, w, h).data;
  const lum = (x: number, y: number) => {
    x = Math.max(0, Math.min(w - 1, x | 0));
    y = Math.max(0, Math.min(h - 1, y | 0));
    const p = (y * w + x) * 4;
    return d[p] * 0.3 + d[p + 1] * 0.59 + d[p + 2] * 0.11;
  };
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const g = out.getContext("2d")!;
  g.lineCap = "round";
  const r = rng(o.seed);
  const s = Math.max(1, o.step * 0.8);
  for (let yy = 0; yy < h; yy += o.step)
    for (let xx = 0; xx < w; xx += o.step) {
      const x = xx + (r() - 0.5) * o.step,
        y = yy + (r() - 0.5) * o.step;
      const xi = Math.max(0, Math.min(w - 1, x | 0)),
        yi = Math.max(0, Math.min(h - 1, y | 0));
      const p = (yi * w + xi) * 4;
      if (o.solid && d[p + 3] < 230) continue;
      const keepK = o.keep ? o.keep(x, y) : 0;
      if (keepK >= 1) continue;
      const gx = lum(x + s, y) - lum(x - s, y),
        gy = lum(x, y + s) - lum(x, y - s);
      const mag = Math.hypot(gx, gy);
      if (o.edges && mag > o.edges) continue;
      const a = Math.atan2(gy, gx) + Math.PI / 2 + (r() - 0.5) * 0.35;
      const len = o.len * (mag > 30 ? 0.5 : 1) * (0.7 + r() * 0.6);
      g.strokeStyle = `rgba(${d[p]},${d[p + 1]},${d[p + 2]},${o.alpha * (1 - keepK)})`;
      g.lineWidth = o.size * (0.7 + r() * 0.6);
      g.beginPath();
      g.moveTo(x - Math.cos(a) * len * 0.5, y - Math.sin(a) * len * 0.5);
      g.lineTo(x + Math.cos(a) * len * 0.5, y + Math.sin(a) * len * 0.5);
      g.stroke();
    }
  return out;
}

export interface Painted {
  canvas: HTMLCanvasElement;
}
/**
 * Paint the boss: every piece re-lit by its material, laid back to front,
 * each casting a soft occlusion shadow on what is already there; brush
 * strokes over the body, the face left crisp.
 */
export function paintBoss(
  cut: Cutout,
  table: MatTable,
  L: Light,
  faceBox: { x: number; y: number; rx: number; ry: number },
  scale: number,
  /** How strongly the rig's own glows are added on top. */
  glowK = 1,
): HTMLCanvasElement {
  const W = cut.canvas.width,
    H = cut.canvas.height;
  const out = document.createElement("canvas");
  out.width = W;
  out.height = H;
  const g = out.getContext("2d")!;
  const key = norm(L.key);
  const sdx = -key[0] * 9 * scale,
    sdy = -key[1] * 9 * scale;
  let seed = 1;
  AVOID = faceBox;
  const fleece: Layer[] = [];
  // glows: kept aside, laid behind (before the first solid piece) or added on top
  const glowsBehind: Layer[] = [],
    glowsFront: Layer[] = [];
  let solidSeen = false;
  for (const layer of cut.layers) {
    if (layer.add) {
      (solidSeen ? glowsFront : glowsBehind).push(layer);
      continue;
    }
    let m: Mat = { ...BASE };
    for (const [re, mm] of table)
      if (re.test(layer.name)) m = { ...BASE, ...mm };
    if (m.skip) continue;
    if (!m.keep) relight(layer, m, L, seed++);
    if (!m.keep && layer.c.width * layer.c.height > 2000) solidSeen = true;
    if (m.tex === "fleece") fleece.push(layer);
    if (!layer.add) {
      // occlusion: this piece's soft shadow on what is under it
      const sh = document.createElement("canvas");
      sh.width = W;
      sh.height = H;
      const s = sh.getContext("2d")!;
      s.filter = `blur(${7 * scale}px)`;
      s.drawImage(layer.c, layer.x + sdx, layer.y + sdy);
      s.filter = "none";
      s.globalCompositeOperation = "source-in";
      s.fillStyle = "rgba(30,14,40,1)";
      s.fillRect(0, 0, W, H);
      g.save();
      g.globalCompositeOperation = "source-atop";
      g.globalAlpha = (m.keep ? 0.15 : 0.38) * layer.alpha;
      g.drawImage(sh, 0, 0);
      g.restore();
    }
    g.save();
    g.globalAlpha = Math.min(1, layer.alpha);
    g.drawImage(layer.c, layer.x, layer.y);
    g.restore();
  }
  // a painted body is opaque: nothing behind shows through (only the soft edge stays soft)
  {
    const img = g.getImageData(0, 0, W, H);
    const d = img.data;
    for (let i = 3; i < d.length; i += 4) if (d[i] > 90) d[i] = 255;
    g.putImageData(img, 0, 0);
  }
  // brush strokes over the forms, not over the face
  const keep = (x: number, y: number) => {
    const dd = Math.hypot(
      (x - faceBox.x) / faceBox.rx,
      (y - faceBox.y) / faceBox.ry,
    );
    return dd < 1 ? 1 : dd < 1.5 ? 1 - (dd - 1) / 0.5 : 0;
  };
  for (const [size, len, step, alpha] of [
    [5.5, 16, 5, 0.5],
    [2.6, 8, 3, 0.3],
  ]) {
    const st = brushStrokes(out, {
      size: size * scale,
      len: len * scale,
      step: Math.max(2, Math.round(step * scale)),
      alpha,
      seed: 99 + size,
      solid: true,
      keep,
    });
    // keep the silhouette clean
    const sc = st.getContext("2d")!;
    sc.globalCompositeOperation = "destination-in";
    sc.drawImage(out, 0, 0);
    g.drawImage(st, 0, 0);
  }
  // fleece curls last, crisp over the strokes
  for (const layer of fleece) fleeceCurls(g, out, layer, scale, seed++);
  // the glows: those behind under the body, the rest added on top (dimmed over the face)
  for (const layer of glowsBehind) {
    g.save();
    g.globalCompositeOperation = "destination-over";
    g.globalAlpha = Math.min(1, layer.alpha);
    g.drawImage(layer.c, layer.x, layer.y);
    g.restore();
  }
  for (const layer of glowsFront) {
    g.save();
    g.globalCompositeOperation = "lighter";
    g.globalAlpha =
      glowK *
      Math.min(1, layer.alpha) *
      (avoided(layer.x + layer.c.width / 2, layer.y + layer.c.height / 2)
        ? 0.3
        : 1);
    g.drawImage(layer.c, layer.x, layer.y);
    g.restore();
  }
  return out;
}

/** Clumped curls: many small arcs, lit on top and shaded below, coloured from the painted fleece. */
function fleeceCurls(
  g: CanvasRenderingContext2D,
  out: HTMLCanvasElement,
  layer: Layer,
  scale: number,
  seed: number,
) {
  const r = rng(seed * 13 + 1);
  const lw = layer.c.width,
    lh = layer.c.height;
  const la = layer.c
    .getContext("2d", { willReadFrequently: true })!
    .getImageData(0, 0, lw, lh).data;
  const od = out
    .getContext("2d", { willReadFrequently: true })!
    .getImageData(layer.x, layer.y, lw, lh).data;
  const S = Math.max(1, scale * 2.2);
  const n = (lw * lh) / (130 * S * S);
  g.save();
  g.lineCap = "round";
  for (let i = 0; i < n; i++) {
    const x = r() * lw,
      y = r() * lh;
    const p = ((y | 0) * lw + (x | 0)) * 4;
    if (la[p + 3] < 220 || od[p + 3] < 220 || avoided(layer.x + x, layer.y + y))
      continue;
    const cr = od[p],
      cg = od[p + 1],
      cb = od[p + 2];
    const mx = Math.max(cr, cg, cb),
      mn = Math.min(cr, cg, cb);
    if (mx < 150 || (mx - mn) / (mx || 1) > 0.42) continue;
    const rr = (3 + r() * 4) * S;
    const a0 = Math.PI * (0.85 + r() * 0.3);
    const X = layer.x + x,
      Y = layer.y + y;
    g.lineWidth = Math.max(0.8, rr * 0.42);
    g.strokeStyle = `rgba(${cr * 0.8},${cg * 0.74},${cb * 0.66},0.28)`;
    g.beginPath();
    g.arc(X, Y + rr * 0.35, rr, a0 - Math.PI * 0.9, a0 + Math.PI * 0.2, true);
    g.stroke();
    g.strokeStyle = `rgba(${Math.min(255, cr * 1.12 + 26)},${Math.min(255, cg * 1.1 + 22)},${Math.min(255, cb * 1.05 + 12)},0.7)`;
    g.lineWidth = Math.max(0.7, rr * 0.3);
    g.beginPath();
    g.arc(X, Y, rr * 0.75, Math.PI * 1.1, Math.PI * 1.85);
    g.stroke();
  }
  g.restore();
}

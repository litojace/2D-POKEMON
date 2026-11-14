/**
 * The poster scene around a painted boss, one composition per setting:
 * a sunset sky full of floating lanterns over a sea of clouds (Lumiwick),
 * a low camera over open water with ruins pouring waterfalls (Tidelotl),
 * a lantern-lit night among tall towers (Inkpurr), a golden canyon of
 * crystal-studded cliffs (Cragmuff). One key light per scene (the sun or
 * moon, upper left, as in looks.ts), so shadows fall down and right
 * everywhere. Distance fades toward the sky colour; the background is then
 * repainted in brush strokes and the whole grained and graded.
 *
 * Sizes are in "u" (1/1024 of the poster's height).
 */
import {
  blurred,
  bokeh,
  canvas,
  cloudBank,
  ctxOf,
  drawFloor,
  drawRibbons,
  drawSky,
  godRays,
  keystone,
  mix,
  particle,
  polyPath,
  P,
  rgba,
  rng,
  rock,
  sparkle,
  spiral,
  stoneSwatch,
  trim,
  wisps,
  type Ctx,
  type Proj,
  type Result,
  type Ribbon,
  type Scene,
} from "./compose";
import { brushStrokes } from "./paint";

const TAU = Math.PI * 2;

// ───────────────────────── architecture ─────────────────────────
interface FacadeOpts {
  storeys: number;
  banner?: boolean;
  waterfall?: boolean;
  lit?: boolean;
  moss?: boolean;
  lanterns?: boolean;
}
/**
 * A ruined building face: storeys of arcades with recessed arches, cornices
 * catching the light, crenels, a banner, moss, a waterfall pouring from an
 * arch, lit windows and hanging lanterns at night. x is its left foot on
 * the ground line (screen px), w and h in u at the projection's scale.
 */
function facade(
  g: Ctx,
  s: Scene,
  p: Proj,
  pat: CanvasPattern,
  x: number,
  w: number,
  h: number,
  u: number,
  r: () => number,
  o: FacadeOpts,
) {
  const t = s.theme;
  const U = u * p.sc;
  const ww = w * U;
  const pt = (dx: number, hh: number) => P(p, x + dx, hh * u);
  const sunLeft = s.sun.x * s.W < x + ww / 2;
  // outline with crenels and a broken corner
  const out: [number, number][] = [pt(0, -60)];
  const n = Math.max(3, Math.round(ww / (22 * U)));
  const broken = r() < 0.5 ? (r() < 0.5 ? 0 : 1) : -1;
  for (let i = 0; i <= n; i++) {
    const dx = (ww * i) / n;
    let top = h + (i % 2 ? 12 : 0);
    if (broken === 0 && i < n * 0.35) top -= (1 - i / (n * 0.35)) * h * 0.25;
    if (broken === 1 && i > n * 0.65)
      top -= ((i - n * 0.65) / (n * 0.35)) * h * 0.25;
    out.push(pt(dx, top));
    if (i < n) out.push(pt(dx + ww / n, top));
  }
  out.push(pt(ww, -60));
  const body = new Path2D();
  polyPath(body, out);
  // rim sliver on the sun side, then the body shifted off it
  g.save();
  g.fillStyle = t.rim;
  g.fill(body);
  g.translate((sunLeft ? 1 : -1) * 3 * U, 1.5 * U);
  g.fillStyle = mix(t.stone, t.haze, 0.15);
  g.fill(body);
  g.globalAlpha = 0.5;
  g.fillStyle = pat;
  g.fill(body);
  g.globalAlpha = 1;
  g.clip(body);
  // storeys
  const sh = h / o.storeys;
  for (let j = 0; j < o.storeys; j++) {
    const base = j * sh;
    // cornice: a lit band over a shadow line
    const [cx0, cy0] = pt(-20, base + 6);
    const [cx1] = pt(ww + 20, base + 6);
    const [, cyb] = pt(0, base);
    g.fillStyle = rgba(t.rim, 0.32);
    g.fillRect(cx0, cy0 - 4 * U, cx1 - cx0, 4 * U);
    g.fillStyle = "rgba(0,0,0,0.3)";
    g.fillRect(cx0, cyb, cx1 - cx0, 3 * U);
    // arches
    const na = Math.max(1, Math.round(ww / (36 * U)));
    const bay = ww / na;
    for (let i = 0; i < na; i++) {
      if (j === o.storeys - 1 && r() < 0.25) continue;
      const l = i * bay + bay * 0.2,
        rr = (i + 1) * bay - bay * 0.2,
        hw = (rr - l) / 2;
      const b0 = base + sh * 0.12,
        spring = base + sh * 0.55;
      const arch: [number, number][] = [pt(l, b0), pt(l, spring)];
      for (let k = 1; k < 10; k++) {
        const a = Math.PI - (Math.PI * k) / 10;
        arch.push(
          pt(l + hw + Math.cos(a) * hw, spring + (Math.sin(a) * hw) / U),
        );
      }
      arch.push(pt(rr, spring), pt(rr, b0));
      const ap = new Path2D();
      polyPath(ap, arch);
      const [ax, ay0] = pt(l, spring + hw / U);
      const [, ay1] = pt(l, b0);
      const litWin = o.lit && r() < 0.4;
      const gr = g.createLinearGradient(0, ay0, 0, ay1);
      if (litWin) {
        gr.addColorStop(0, "rgba(255,190,90,0.95)");
        gr.addColorStop(1, "rgba(255,130,40,0.9)");
      } else {
        gr.addColorStop(0, "rgba(10,6,20,0.72)");
        gr.addColorStop(1, rgba(t.haze, 0.35));
      }
      g.fillStyle = gr;
      g.fill(ap);
      // the jamb on the sun side in shadow
      g.fillStyle = "rgba(0,0,0,0.25)";
      const jx = sunLeft ? l : rr - hw * 0.25;
      const [jx0, jy0] = pt(jx, b0);
      const [jx1, jy1] = pt(jx + hw * 0.25, spring);
      g.fillRect(Math.min(jx0, jx1), jy1, Math.abs(jx1 - jx0) + 1, jy0 - jy1);
      if (litWin) {
        g.save();
        g.globalCompositeOperation = "lighter";
        const lg = g.createRadialGradient(
          ax + hw,
          (ay0 + ay1) / 2,
          0,
          ax + hw,
          (ay0 + ay1) / 2,
          hw * 3,
        );
        lg.addColorStop(0, "rgba(255,170,70,0.35)");
        lg.addColorStop(1, "rgba(255,120,40,0)");
        g.fillStyle = lg;
        g.fillRect(ax - hw * 3, ay0 - hw * 3, hw * 8, ay1 - ay0 + hw * 6);
        g.restore();
      }
      // a waterfall pouring out of one arch
      if (
        o.waterfall &&
        j === Math.min(1, o.storeys - 1) &&
        i === Math.floor(na / 2)
      ) {
        const [wx, wy] = pt(l + hw, b0);
        const [, gy] = pt(0, -60);
        const ww2 = hw * 1.1;
        const wf = g.createLinearGradient(0, wy, 0, gy);
        wf.addColorStop(0, "rgba(235,255,255,0.95)");
        wf.addColorStop(0.6, "rgba(190,240,250,0.75)");
        wf.addColorStop(1, "rgba(255,255,255,0.4)");
        g.fillStyle = wf;
        g.beginPath();
        g.moveTo(wx - ww2 * 0.6, wy);
        g.lineTo(wx + ww2 * 0.6, wy);
        g.lineTo(wx + ww2 * 0.9, gy);
        g.lineTo(wx - ww2 * 0.9, gy);
        g.closePath();
        g.fill();
        g.strokeStyle = "rgba(255,255,255,0.7)";
        g.lineWidth = Math.max(1, 1.2 * U);
        for (let k = 0; k < 7; k++) {
          const fx = wx + (r() - 0.5) * ww2 * 1.2;
          g.beginPath();
          g.moveTo(fx, wy + r() * 20 * U);
          g.lineTo(fx + (r() - 0.5) * 6 * U, gy);
          g.stroke();
        }
      }
    }
  }
  // moss along the cornices and the top
  if (o.moss) {
    for (let j = 0; j <= o.storeys; j++) {
      const hh = j === o.storeys ? h : j * sh + 6;
      for (let k = 0; k < ww / (5 * U); k++) {
        if (r() < 0.5) continue;
        const [mx, my] = pt(r() * ww, hh);
        const mr = (2 + r() * 4) * U;
        g.fillStyle =
          r() < 0.5 ? "rgba(90,140,60,0.75)" : "rgba(140,190,80,0.7)";
        g.beginPath();
        g.arc(mx, my + mr * 0.6, mr, 0, TAU);
        g.fill();
        if (r() < 0.25) {
          g.fillRect(mx, my, Math.max(1, 1.2 * U), (6 + r() * 26) * U);
        }
      }
    }
  }
  // shade across the face away from the light, darker low
  const [lx] = pt(0, h * 0.5);
  const [rx] = pt(ww, h * 0.5);
  const sg = g.createLinearGradient(lx, 0, rx, 0);
  sg.addColorStop(sunLeft ? 0 : 1, "rgba(0,0,0,0)");
  sg.addColorStop(sunLeft ? 1 : 0, "rgba(0,0,0,0.35)");
  g.fillStyle = sg;
  g.fill(body);
  const [, ty] = pt(0, h);
  const [, by] = pt(0, -60);
  const vg = g.createLinearGradient(0, ty, 0, by);
  vg.addColorStop(0, rgba(t.rim, 0.12));
  vg.addColorStop(1, "rgba(0,0,0,0.3)");
  g.fillStyle = vg;
  g.fill(body);
  g.restore();
  // a banner from the top storey
  if (o.banner) {
    const bxw = Math.min(ww * 0.4, 40 * U);
    const bx0 = x + ww / 2 - bxw / 2;
    const top = h - sh * 0.2,
      len = sh * (1.2 + r() * 0.8);
    const q = (dx: number, hh: number) => P(p, bx0 + dx, hh * u);
    const ban = new Path2D();
    polyPath(ban, [
      q(0, top),
      q(bxw, top),
      q(bxw, top - len),
      q(bxw / 2, top - len - 30),
      q(0, top - len),
    ]);
    const col = t.ribbons[0][0];
    const [b0x] = q(0, top);
    const [b1x] = q(bxw, top);
    const bg = g.createLinearGradient(b0x, 0, b1x, 0);
    bg.addColorStop(sunLeft ? 0 : 1, mix(col, "#ffffff", 0.1));
    bg.addColorStop(0.5, mix(col, "#000000", 0.2));
    bg.addColorStop(sunLeft ? 1 : 0, mix(col, "#000000", 0.55));
    g.fillStyle = bg;
    g.fill(ban);
    g.strokeStyle = rgba(t.rim, 0.85);
    g.lineWidth = 2 * U;
    g.stroke(ban);
    const [ex, ey] = q(bxw / 2, top - len * 0.4);
    g.fillStyle = rgba(t.rim, 0.8);
    g.beginPath();
    g.moveTo(ex, ey - bxw * 0.3);
    g.lineTo(ex + bxw * 0.22, ey);
    g.lineTo(ex, ey + bxw * 0.3);
    g.lineTo(ex - bxw * 0.22, ey);
    g.fill();
  }
  // hanging lanterns at night
  if (o.lanterns) {
    for (let k = 0; k < 2; k++) {
      const [hx, hy] = pt(
        ww * (0.2 + 0.6 * k + (r() - 0.5) * 0.1),
        h * (0.35 + r() * 0.4),
      );
      lanternGlow(g, hx, hy, 7 * U);
    }
  }
}
function lanternGlow(g: Ctx, x: number, y: number, R: number) {
  g.save();
  g.globalCompositeOperation = "lighter";
  const gl = g.createRadialGradient(x, y, 0, x, y, R * 7);
  gl.addColorStop(0, "rgba(255,190,90,0.6)");
  gl.addColorStop(0.3, "rgba(255,140,50,0.2)");
  gl.addColorStop(1, "rgba(255,110,40,0)");
  g.fillStyle = gl;
  g.fillRect(x - R * 7, y - R * 7, R * 14, R * 14);
  g.globalCompositeOperation = "source-over";
  g.strokeStyle = "rgba(40,20,10,0.8)";
  g.lineWidth = Math.max(1, R * 0.12);
  g.beginPath();
  g.moveTo(x, y - R * 1.2);
  g.lineTo(x, y - R * 3);
  g.stroke();
  const lg = g.createRadialGradient(x - R * 0.3, y - R * 0.3, 0, x, y, R * 1.2);
  lg.addColorStop(0, "#fff2c0");
  lg.addColorStop(0.5, "#ffb050");
  lg.addColorStop(1, "#c0501a");
  g.fillStyle = lg;
  g.beginPath();
  g.ellipse(x, y, R * 0.8, R * 1.1, 0, 0, TAU);
  g.fill();
  g.restore();
}

/** A layer of buildings at one distance, hazed toward the sky by how far it is. */
function ruins(
  s: Scene,
  u: number,
  r: () => number,
  stone: HTMLCanvasElement,
  o: {
    gy: number;
    sc: number;
    haze: number;
    blur: number;
    count: number;
    /** Where along the width (fractions) they stand. */
    xs: [number, number][];
    tall: [number, number];
    opts: Partial<FacadeOpts>;
  },
) {
  const { W, H, theme: t } = s;
  const c = canvas(W, H);
  const g = ctxOf(c);
  const p: Proj = {
    gy: o.gy * H,
    cx: W / 2,
    vp: 2600 * u * Math.sqrt(o.sc),
    sc: o.sc,
  };
  const pat = g.createPattern(stone, "repeat")!;
  pat.setTransform(new DOMMatrix().scale(1.4 * o.sc * u));
  for (let i = 0; i < o.count; i++) {
    const span = o.xs[i % o.xs.length];
    const fx = span[0] + (span[1] - span[0]) * r();
    const w = 70 + r() * 110;
    const x = fx * W - (w * u * o.sc) / 2;
    const edge = Math.min(1, Math.abs(fx - 0.5) / 0.5);
    const h =
      (o.tall[0] + (o.tall[1] - o.tall[0]) * r()) * (0.35 + 0.65 * edge);
    facade(g, s, p, pat, x, w, h, u, r, {
      storeys: Math.max(1, Math.round(h / 130)),
      banner: r() < 0.35,
      moss: false,
      ...o.opts,
      waterfall: o.opts.waterfall ? r() < 0.55 : false,
    });
  }
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = rgba(t.haze, o.haze);
  g.fillRect(0, 0, W, H);
  const mist = g.createLinearGradient(
    0,
    o.gy * H - 220 * u * o.sc,
    0,
    o.gy * H,
  );
  mist.addColorStop(0, rgba(t.haze, 0));
  mist.addColorStop(1, rgba(t.haze, Math.min(1, o.haze + 0.45)));
  g.fillStyle = mist;
  g.fillRect(0, 0, W, H);
  return o.blur ? blurred(c, o.blur * u) : c;
}

/** Canyon walls: stratified cliffs with crystal clusters, leaning in. */
function cliffs(
  s: Scene,
  u: number,
  r: () => number,
  stone: HTMLCanvasElement,
  depth: number,
) {
  const { W, H, theme: t } = s;
  const c = canvas(W, H);
  const g = ctxOf(c);
  const pat = g.createPattern(stone, "repeat")!;
  pat.setTransform(new DOMMatrix().scale(1.8 * u));
  const sc = 0.6 + depth * 0.5;
  for (const side of [-1, 1]) {
    const inner =
      side < 0
        ? (0.12 + (1 - depth) * 0.12) * W
        : W - (0.12 + (1 - depth) * 0.12) * W;
    const foot = (s.horizon + 0.06 + depth * 0.2) * H;
    const pts: [number, number][] = [];
    const outer = side < 0 ? -W * 0.1 : W * 1.1;
    pts.push([outer, H * 1.1], [outer, -H * 0.1]);
    // the inner edge: jagged, leaning in toward the top (the camera looks up)
    const N = 26;
    for (let i = 0; i <= N; i++) {
      const f = i / N;
      const y = -H * 0.1 + (foot + H * 0.1) * f;
      const jag =
        (r() - 0.5) * 40 * u * sc + Math.sin(f * 9 + side) * 18 * u * sc;
      pts.push([inner - side * (1 - f) * 0.1 * W + jag, y]);
    }
    pts.push([side < 0 ? inner + 60 * u : inner - 60 * u, H * 1.1]);
    const path = new Path2D();
    polyPath(path, pts);
    const lit = side > 0; // the right wall faces the sun (upper left)
    g.save();
    const base = g.createLinearGradient(0, 0, 0, H);
    base.addColorStop(0, mix(t.stone, t.rim, lit ? 0.35 : 0.1));
    base.addColorStop(1, mix(t.stone, "#000000", lit ? 0.25 : 0.45));
    g.fillStyle = base;
    g.fill(path);
    g.clip(path);
    g.globalAlpha = 0.45;
    g.fillStyle = pat;
    g.fillRect(-W, -H, W * 3, H * 3);
    g.globalAlpha = 1;
    // strata: wavy bands, light over dark
    for (let y = -H * 0.1; y < foot; y += (14 + r() * 26) * u * sc) {
      g.strokeStyle =
        r() < 0.5 ? "rgba(0,0,0,0.18)" : rgba(t.rim, lit ? 0.2 : 0.08);
      g.lineWidth = (2 + r() * 5) * u * sc;
      g.beginPath();
      for (
        let x = side < 0 ? -W * 0.1 : inner - 300 * u;
        x < (side < 0 ? inner + 300 * u : W * 1.1);
        x += 20 * u
      ) {
        const yy =
          y +
          Math.sin(x * 0.01 + y * 0.02) * 6 * u * sc +
          (x - inner) * 0.04 * side;
        if (x === (side < 0 ? -W * 0.1 : inner - 300 * u)) g.moveTo(x, yy);
        else g.lineTo(x, yy);
      }
      g.stroke();
    }
    // vertical cracks
    for (let k = 0; k < 10; k++) {
      let x = inner + side * (20 + r() * 260) * u * sc,
        y = r() * foot;
      g.strokeStyle = "rgba(0,0,0,0.3)";
      g.lineWidth = (1 + r() * 2) * u * sc;
      g.beginPath();
      g.moveTo(x, y);
      for (let q = 0; q < 5; q++) {
        x += (r() - 0.5) * 14 * u * sc;
        y += (12 + r() * 20) * u * sc;
        g.lineTo(x, y);
      }
      g.stroke();
    }
    // shade toward the inner edge on the shadow side, light on the lit side
    const ig = g.createLinearGradient(inner + side * 260 * u, 0, inner, 0);
    ig.addColorStop(0, "rgba(0,0,0,0)");
    ig.addColorStop(1, lit ? rgba(t.rim, 0.22) : "rgba(0,0,0,0.3)");
    g.fillStyle = ig;
    g.fillRect(-W, -H, W * 3, H * 3);
    g.restore();
    // crystal clusters on the face of the cliff
    for (let k = 0; k < 4; k++) {
      const cx = inner + side * (30 + r() * 160) * u * sc,
        cy = (0.2 + r() * 0.6) * foot;
      crystalCluster(g, cx, cy, (10 + r() * 14) * u * sc, t.crack || t.aura, r);
    }
  }
  const hz = 0.55 * (1 - depth);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = rgba(t.haze, hz);
  g.fillRect(0, 0, W, H);
  return depth < 0.5 ? blurred(c, (1 - depth) * 1.2 * u) : c;
}
function crystalCluster(
  g: Ctx,
  x: number,
  y: number,
  R: number,
  col: string,
  r: () => number,
) {
  g.save();
  g.globalCompositeOperation = "lighter";
  const gl = g.createRadialGradient(x, y, 0, x, y, R * 3);
  gl.addColorStop(0, rgba(col, 0.45));
  gl.addColorStop(1, rgba(col, 0));
  g.fillStyle = gl;
  g.fillRect(x - R * 3, y - R * 3, R * 6, R * 6);
  g.restore();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i - 2) * 0.35 + (r() - 0.5) * 0.2;
    const L = R * (0.9 + r() * 1.2),
      wd = R * 0.28;
    const tx = x + Math.cos(a) * L,
      ty = y + Math.sin(a) * L;
    const nx = -Math.sin(a) * wd,
      ny = Math.cos(a) * wd;
    g.fillStyle = mix(col, "#ffffff", 0.35);
    g.beginPath();
    g.moveTo(x + nx, y + ny);
    g.lineTo(tx, ty);
    g.lineTo(x - nx, y - ny);
    g.closePath();
    g.fill();
    g.fillStyle = mix(col, "#000000", 0.25);
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(tx, ty);
    g.lineTo(x - nx, y - ny);
    g.closePath();
    g.fill();
  }
}

/** Far mesas / floating islands: soft silhouettes in the haze. */
function farMasses(
  s: Scene,
  u: number,
  r: () => number,
  kind: "islands" | "mesas",
  y: number,
  alpha: number,
) {
  const { W, H, theme: t } = s;
  const c = canvas(W, H);
  const g = ctxOf(c);
  for (let i = 0; i < (kind === "islands" ? 9 : 6); i++) {
    const cx = r() * W,
      cy = (kind === "islands" ? y - 0.25 + r() * 0.3 : y) * H,
      w = (kind === "islands" ? 50 + r() * 110 : 160 + r() * 260) * u,
      h = (kind === "islands" ? 30 + r() * 40 : 80 + r() * 140) * u;
    g.fillStyle = mix(t.stone, t.haze, 0.55);
    g.beginPath();
    if (kind === "islands") {
      // a flat top, a jagged hanging root, a tower or two on top
      g.moveTo(cx - w / 2, cy);
      g.lineTo(cx + w / 2, cy);
      for (let k = 0; k <= 6; k++)
        g.lineTo(
          cx + w / 2 - (w * k) / 6,
          cy + h * (0.4 + r() * 0.6) * Math.sin((Math.PI * k) / 6) + 2,
        );
      g.closePath();
      g.fill();
      for (let k = 0; k < 2; k++) {
        const tx = cx + (r() - 0.5) * w * 0.6,
          tw = w * (0.08 + r() * 0.08),
          th = h * (0.6 + r() * 1.2);
        g.fillRect(tx, cy - th, tw, th);
      }
      g.fillStyle = rgba(t.rim, 0.35);
      g.fillRect(cx - w / 2, cy - 2 * u, w, 3 * u);
    } else {
      g.moveTo(cx - w / 2, cy + 40 * u);
      g.lineTo(cx - w * 0.42, cy - h);
      g.lineTo(cx + w * 0.4, cy - h + (r() - 0.5) * 20 * u);
      g.lineTo(cx + w / 2, cy + 40 * u);
      g.closePath();
      g.fill();
      g.fillStyle = rgba(t.rim, 0.25);
      g.fillRect(cx - w * 0.42, cy - h, w * 0.2, h + 40 * u);
    }
  }
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = rgba(t.haze, 0.35);
  g.fillRect(0, 0, W, H);
  const b = blurred(c, 1.5 * u);
  return { c: b, alpha };
}

/** Sky lanterns drifting up at every distance. */
function skyLanterns(
  g: Ctx,
  s: Scene,
  u: number,
  r: () => number,
  n: number,
  near: boolean,
  avoid?: (x: number, y: number) => boolean,
) {
  const { W, H } = s;
  const c = canvas(W, H);
  const k = ctxOf(c);
  for (let i = 0; i < n; i++) {
    const depth = near ? 0.75 + r() * 0.25 : r() * 0.7;
    const R = (3 + depth * depth * 22) * u;
    const x = r() * W,
      y = (0.05 + r() * (s.horizon + 0.1)) * H;
    if (avoid?.(x, y)) continue;
    // glow
    k.save();
    k.globalCompositeOperation = "lighter";
    const gl = k.createRadialGradient(x, y, 0, x, y, R * 4);
    gl.addColorStop(0, `rgba(255,190,100,${0.35 + depth * 0.25})`);
    gl.addColorStop(1, "rgba(255,120,40,0)");
    k.fillStyle = gl;
    k.fillRect(x - R * 4, y - R * 4, R * 8, R * 8);
    k.restore();
    const lg = k.createLinearGradient(x, y - R, x, y + R);
    lg.addColorStop(0, "#ffe7b0");
    lg.addColorStop(0.6, "#ffa648");
    lg.addColorStop(1, "#e2662a");
    k.fillStyle = lg;
    k.beginPath();
    k.moveTo(x - R * 0.62, y - R * 0.9);
    k.quadraticCurveTo(x, y - R * 1.3, x + R * 0.62, y - R * 0.9);
    k.lineTo(x + R * 0.48, y + R * 0.8);
    k.lineTo(x - R * 0.48, y + R * 0.8);
    k.closePath();
    k.fill();
    k.fillStyle = "rgba(120,40,10,0.35)";
    k.fillRect(x - R * 0.5, y + R * 0.7, R, R * 0.12);
    k.fillStyle = "rgba(255,250,220,0.9)";
    k.beginPath();
    k.ellipse(x, y + R * 0.9, R * 0.14, R * 0.22, 0, 0, TAU);
    k.fill();
  }
  g.drawImage(near ? blurred(c, 3 * u) : c, 0, 0);
}

/** The sea under a low camera: the water's glitter path, and swells. */
function seaSurface(g: Ctx, s: Scene, u: number, r: () => number) {
  const { W, H, theme: t } = s;
  const y0 = s.horizon * H;
  // glints: short bright dashes, densest in the sun's path
  g.save();
  g.globalCompositeOperation = "lighter";
  for (let i = 0; i < 900; i++) {
    const v = Math.pow(r(), 1.6);
    const y = y0 + v * (H - y0);
    const path = s.sun.x * W + (r() - 0.5) * W * (0.25 + v * 0.8);
    const x = r() < 0.6 ? path : r() * W;
    const L = (3 + v * 26) * u * (0.5 + r());
    g.fillStyle = `rgba(255,255,240,${0.15 + (1 - v) * 0.4})`;
    g.fillRect(x - L / 2, y, L, Math.max(1, v * 2.5 * u));
  }
  g.restore();
  // swells: darker troughs and lit crests across the water
  for (let i = 0; i < 18; i++) {
    const v = (i + r()) / 18;
    const y = y0 + Math.pow(v, 1.5) * (H - y0);
    g.strokeStyle = rgba(t.cloud[2], 0.12 + v * 0.18);
    g.lineWidth = (1 + v * 8) * u;
    g.beginPath();
    for (let x = -20; x <= W + 20; x += 24 * u) {
      const yy = y + Math.sin((x * 0.006) / (0.3 + v) + i) * (2 + v * 14) * u;
      if (x === -20) g.moveTo(x, yy);
      else g.lineTo(x, yy);
    }
    g.stroke();
  }
}
/** Breaking waves in the foreground, with foam and spray. */
function waves(g: Ctx, s: Scene, u: number, r: () => number) {
  const { W, H, theme: t } = s;
  for (const [cx, w, hgt] of [
    [0.08, 0.5, 120],
    [0.92, 0.5, 140],
  ] as const) {
    const x = cx * W,
      ww = w * W,
      top = H - hgt * u;
    const path = new Path2D();
    path.moveTo(x - ww / 2, H + 10);
    path.bezierCurveTo(
      x - ww * 0.25,
      top + 30 * u,
      x - ww * 0.05,
      top - 20 * u,
      x + ww * 0.08 * (cx < 0.5 ? 1 : -1),
      top,
    );
    path.bezierCurveTo(
      x + ww * 0.2,
      top + 40 * u,
      x + ww * 0.35,
      top + 60 * u,
      x + ww / 2,
      H + 10,
    );
    path.closePath();
    const gr = g.createLinearGradient(0, top, 0, H);
    gr.addColorStop(0, mix(t.ribbons[0][1], "#ffffff", 0.2));
    gr.addColorStop(0.3, t.ribbons[0][0]);
    gr.addColorStop(1, mix(t.shade, t.ribbons[0][0], 0.3));
    g.fillStyle = gr;
    g.fill(path);
    // light through the thin crest
    g.save();
    g.clip(path);
    const tl = g.createRadialGradient(
      x,
      top + 20 * u,
      0,
      x,
      top + 20 * u,
      ww * 0.3,
    );
    tl.addColorStop(0, "rgba(180,255,240,0.5)");
    tl.addColorStop(1, "rgba(180,255,240,0)");
    g.fillStyle = tl;
    g.fillRect(x - ww, top - 50 * u, ww * 2, H);
    g.restore();
  }
  const foam = cloudBank(s, u, r, {
    y: 0.98,
    x0: -0.15,
    x1: 1.15,
    size: 60,
    rows: 1,
    alpha: 1,
    blur: 1.5,
    haze: 0,
  });
  g.drawImage(foam.c, 0, 0);
  for (let i = 0; i < 70; i++) {
    const x = (r() < 0.5 ? r() * 0.35 : 0.65 + r() * 0.35) * W,
      y = H - (60 + r() * 260) * u;
    particle(g, s, "droplets", x, y, (2 + r() * 6) * u, r);
  }
}
/** Stars in the night sky. */
function stars(g: Ctx, s: Scene, u: number, r: () => number) {
  const { W, H } = s;
  for (let i = 0; i < 260; i++) {
    const x = r() * W,
      y = r() * H * s.horizon * 0.9;
    const a = 0.3 + r() * 0.7;
    g.fillStyle = `rgba(255,250,235,${a})`;
    g.fillRect(x, y, Math.max(1, r() * 2 * u), Math.max(1, r() * 2 * u));
    if (r() < 0.04) sparkle(g, x, y, (2 + r() * 3) * u, "#e8dcff", 0.8);
  }
}

// ───────────────────────── the scene ─────────────────────────
export function compose(s: Scene): Result {
  const { W, H, theme: t } = s;
  const u = H / 1024;
  const r = rng(s.seed);
  const out = canvas(W, H);
  const g = ctxOf(out);
  g.imageSmoothingQuality = "high";
  const stone = stoneSwatch(s.arena, t.stone);
  const pat = g.createPattern(stone, "repeat")!;
  pat.setTransform(new DOMMatrix().scale(0.6 * u + 0.2));

  // the boss's spot
  const bb = trim(s.boss);
  let k = (s.place.h * H) / bb.h;
  if (bb.w * k > s.place.maxW * W) k = (s.place.maxW * W) / bb.w;
  const bw = bb.w * k,
    bh = bb.h * k;
  const bx = s.place.cx * W - bw / 2;
  let by = s.place.cy * H - bh / 2;
  if (s.place.faceY !== undefined)
    by = s.place.faceY * H - (s.face.y - bb.y) * k;
  if (s.place.ground !== undefined) by = s.place.ground * H - bh;
  const toPoster = (p: { x: number; y: number }) => ({
    x: bx + (p.x - bb.x) * k,
    y: by + (p.y - bb.y) * k,
  });
  const face = toPoster(s.face),
    body = toPoster(s.body);
  const fr: [number, number] = [s.faceR[0] * k, s.faceR[1] * k];
  // the face region (eyes and mouth) nothing may cover
  const faceC = { x: face.x, y: face.y + fr[1] * 0.3 };
  const inFace = (x: number, y: number, m = 1) =>
    Math.hypot((x - faceC.x) / (fr[0] * m), (y - faceC.y) / (fr[1] * m)) < 1;
  const bcx = bx + bw / 2,
    bcy = by + bh / 2;

  // ── 1 the sky
  drawSky(g, s, u);
  if (s.setting === "night") stars(g, s, u, r);
  wisps(g, s, u, r);
  if (s.setting === "night") moon(g, s, u);
  godRays(g, s, u, r);

  // ── 2 the far distance
  const far = cloudBank(s, u, r, {
    y: s.horizon - 0.06,
    x0: -0.1,
    x1: 1.1,
    size: 70,
    rows: 2,
    alpha: 0.8,
    blur: 3,
    haze: 0.45,
  });
  if (s.setting === "canyon") {
    const m = farMasses(s, u, r, "mesas", s.horizon + 0.02, 0.9);
    g.globalAlpha = m.alpha;
    g.drawImage(m.c, 0, 0);
    g.globalAlpha = 1;
  } else {
    const m = farMasses(s, u, r, "islands", s.horizon - 0.1, 0.85);
    g.globalAlpha = m.alpha;
    g.drawImage(m.c, 0, 0);
    g.globalAlpha = 1;
  }
  g.globalAlpha = far.alpha;
  g.drawImage(far.c, 0, 0);
  g.globalAlpha = 1;
  if (s.setting === "sunset") skyLanterns(g, s, u, r, 70, false);

  // ── 3 the middle distance, per setting
  const xsSides: [number, number][] = [
    [0.0, 0.3],
    [0.7, 1.0],
  ];
  if (s.setting === "canyon") {
    g.drawImage(cliffs(s, u, r, stone, 0.1), 0, 0);
    drawFloor(g, s, u);
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: s.horizon + 0.03,
        sc: 0.35,
        haze: 0.5,
        blur: 0.6,
        count: 10,
        xs: [[0.25, 0.75]],
        tall: [120, 260],
        opts: { moss: false },
      }),
      0,
      0,
    );
    g.drawImage(cliffs(s, u, r, stone, 0.5), 0, 0);
    g.drawImage(cliffs(s, u, r, stone, 0.95), 0, 0);
  } else if (s.setting === "sea") {
    drawFloor(g, s, u);
    seaSurface(g, s, u, r);
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: s.horizon + 0.005,
        sc: 0.3,
        haze: 0.35,
        blur: 0.4,
        count: 16,
        xs: [[0, 1]],
        tall: [160, 420],
        opts: { moss: true, waterfall: true },
      }),
      0,
      0,
    );
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: s.horizon + 0.05,
        sc: 0.62,
        haze: 0.12,
        blur: 0,
        count: 8,
        xs: xsSides,
        tall: [380, 700],
        opts: { moss: true, waterfall: true },
      }),
      0,
      0,
    );
  } else if (s.setting === "night") {
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: s.horizon + 0.0,
        sc: 0.32,
        haze: 0.5,
        blur: 0.6,
        count: 26,
        xs: [[0, 1]],
        tall: [200, 480],
        opts: { lit: true },
      }),
      0,
      0,
    );
    drawFloor(g, s, u);
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: s.horizon + 0.08,
        sc: 0.6,
        haze: 0.14,
        blur: 0,
        count: 8,
        xs: xsSides,
        tall: [500, 900],
        opts: { lit: true, lanterns: true },
      }),
      0,
      0,
    );
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: 1.12,
        sc: 1.1,
        haze: 0.05,
        blur: 0,
        count: 2,
        xs: [
          [-0.02, 0.04],
          [0.96, 1.02],
        ],
        tall: [1100, 1300],
        opts: { lit: true, lanterns: true, banner: true },
      }),
      0,
      0,
    );
  } else {
    // sunset: a sea of clouds below, arcades on islands at the sides
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: s.horizon + 0.02,
        sc: 0.35,
        haze: 0.45,
        blur: 0.6,
        count: 18,
        xs: [[0, 1]],
        tall: [160, 380],
        opts: { moss: true },
      }),
      0,
      0,
    );
    g.drawImage(
      ruins(s, u, r, stone, {
        gy: s.horizon + 0.12,
        sc: 0.75,
        haze: 0.18,
        blur: 0,
        count: 6,
        xs: xsSides,
        tall: [480, 820],
        opts: { moss: true, banner: true },
      }),
      0,
      0,
    );
  }
  // cloud banks (or sea mist) in front of the middle distance
  for (const [x0, x1] of [
    [-0.2, 0.4],
    [0.6, 1.2],
  ]) {
    const mid = cloudBank(s, u, r, {
      y: s.horizon + (s.setting === "sea" ? 0.02 : 0.1),
      x0,
      x1,
      size: s.setting === "sea" ? 70 : 110,
      rows: 2,
      alpha: s.setting === "canyon" ? 0.55 : 1,
      blur: 1,
      haze: 0.05,
    });
    g.globalAlpha = mid.alpha;
    g.drawImage(mid.c, 0, 0);
    g.globalAlpha = 1;
  }
  if (s.setting === "sunset") {
    const sea = cloudBank(s, u, r, {
      y: 1.02,
      x0: -0.2,
      x1: 1.2,
      size: 150,
      rows: 2,
      alpha: 1,
      blur: 1.5,
      haze: 0,
    });
    g.drawImage(sea.c, 0, 0);
    skyLanterns(g, s, u, r, 26, false);
  }
  // far floating debris, hazed
  {
    const c = canvas(W, H);
    const cg = ctxOf(c);
    for (let i = 0; i < 12; i++) {
      const x = r() * W,
        y = r() * H * 0.8;
      if (Math.abs(x - bcx) < bw * 0.5 && Math.abs(y - bcy) < bh * 0.5)
        continue;
      rock(cg, s, pat, x, y, (7 + r() * 22) * u, r() * TAU, r, r() < 0.45);
    }
    cg.globalCompositeOperation = "source-atop";
    cg.fillStyle = rgba(t.haze, 0.4);
    cg.fillRect(0, 0, W, H);
    g.drawImage(c, 0, 0);
  }

  // ── 4 the background repainted in brush strokes, then graded
  {
    const fine = brushStrokes(out, {
      size: 2.8 * u,
      len: 8 * u,
      step: Math.max(2, Math.round(3.5 * u)),
      alpha: 0.32,
      seed: s.seed + 9,
      edges: 40,
    });
    g.drawImage(fine, 0, 0);
    const copy = canvas(W, H);
    ctxOf(copy).drawImage(out, 0, 0);
    g.globalCompositeOperation = "overlay";
    g.globalAlpha = 0.3;
    g.drawImage(copy, 0, 0);
    g.globalAlpha = 1;
    g.globalCompositeOperation = "source-over";
  }

  // ── 5 ribbons around the boss (curling, branching)
  const spin = s.spin ?? 1;
  const ribbons: Ribbon[] = [];
  const cols = t.ribbons;
  const R0 = Math.max(bw, bh * 0.75);
  for (let i = 0; i < 3; i++) {
    const col = cols[i % cols.length];
    const rx = R0 * (0.56 + i * 0.12 + r() * 0.08);
    const ry = rx * (0.2 + r() * 0.12);
    const tilt = spin * (i === 1 ? 0.32 : -0.22) + (r() - 0.5) * 0.2;
    const t0 = r() * TAU;
    const span = TAU * (0.8 + r() * 0.35);
    const yy = bcy + bh * (0.32 - i * 0.22);
    const ph = r() * TAU;
    for (let q = 0; q < 3; q++) {
      const off = (q - 1) * 8 * u;
      const wide = q === 1 ? 1 : 0.2 + r() * 0.2;
      const main = spiral(
        bcx,
        yy,
        rx,
        ry,
        tilt,
        t0 + q * 0.05,
        t0 + spin * span - q * 0.12,
        bh * (0.28 + r() * 0.12),
        (17 + r() * 8) * u * wide,
        col,
        0.22,
        ph + q * 0.4,
        q === 1 ? 0 : off * 1.6,
        q === 1 ? spin * (r() < 0.5 ? 1 : -1) : 0,
      );
      ribbons.push(main);
      // branches: short tendrils peeling off and curling
      if (q === 1)
        for (let b = 0; b < 3; b++) {
          const at = Math.floor((0.2 + r() * 0.6) * 160);
          const p0 = main.pts[at],
            p1 = main.pts[at + 2];
          if (!p0 || !p1) continue;
          let th =
            Math.atan2(p1.y - p0.y, p1.x - p0.x) + (r() < 0.5 ? 0.5 : -0.5);
          const pts = [];
          let x = p0.x,
            y = p0.y,
            st = R0 * 0.012;
          const cv = (r() < 0.5 ? 1 : -1) * 0.05;
          for (let j = 0; j < 40; j++) {
            th += cv * (1 + j * 0.08);
            x += Math.cos(th) * st;
            y += Math.sin(th) * st;
            st *= 0.975;
            pts.push({
              x,
              y,
              z: p0.z,
              w: p0.w * 0.45 * (1 - j / 40),
              a: p0.a * (1 - j / 50),
            });
          }
          ribbons.push({ pts, col });
        }
    }
  }
  for (let i = 0; i < 2; i++) {
    const col = cols[(i + 1) % cols.length];
    const ph = r() * TAU;
    ribbons.push(
      spiral(
        bcx,
        bcy + bh * (i ? -0.15 : 0.25),
        R0 * (1.2 + i * 0.2),
        R0 * 0.3,
        spin * (i ? 0.5 : -0.35),
        Math.PI * (0.1 + i),
        Math.PI * (1.1 + i),
        bh * 0.1,
        5 * u,
        col,
        0.16,
        ph,
        0,
        spin,
      ),
    );
  }
  const hole: [number, number, number, number] = [
    faceC.x,
    faceC.y,
    fr[0] * 1.15,
    fr[1] * 1.2,
  ];

  // ── 6 behind the boss: its glow, back ribbons, back particles
  const aura = g.createRadialGradient(bcx, bcy, 0, bcx, bcy, R0 * 0.9);
  aura.addColorStop(0, rgba(t.aura, 0.4));
  aura.addColorStop(0.45, rgba(t.aura, 0.15));
  aura.addColorStop(1, rgba(t.aura, 0));
  g.globalCompositeOperation = "screen";
  g.fillStyle = aura;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "source-over";
  drawRibbons(g, s, u, ribbons, false, hole);
  for (let i = 0; i < 22; i++) {
    const kind = t.particles[i % t.particles.length];
    const a = r() * TAU,
      d = R0 * (0.45 + r() * 0.75);
    const x = bcx + Math.cos(a) * d * 1.2,
      y = bcy + Math.sin(a) * d * 0.75;
    // behind a see-through boss these would show on its face
    if (inFace(x, y, 1.8)) continue;
    particle(g, s, kind, x, y, (3 + r() * 5) * u, r);
  }

  // ── 7 the boss
  const big = canvas(bw, bh);
  {
    const bgc = ctxOf(big);
    bgc.imageSmoothingQuality = "high";
    bgc.drawImage(s.boss, bb.x, bb.y, bb.w, bb.h, 0, 0, bw, bh);
  }
  const boss = keystone(big, 0.05);
  const ox = bx - (boss.width - bw) / 2;
  // its shadow: on the ground under its feet, or a soft one on the clouds / water far below
  {
    const sh = canvas(W, H);
    const sg = ctxOf(sh);
    const groundY =
      s.place.ground !== undefined
        ? s.place.ground * H
        : Math.min(H * 0.97, by + bh * 1.15);
    const flat = canvas(boss.width, boss.height);
    const fg = ctxOf(flat);
    fg.drawImage(boss, 0, 0);
    fg.globalCompositeOperation = "source-in";
    fg.fillStyle = "#1a0c1c";
    fg.fillRect(0, 0, flat.width, flat.height);
    sg.save();
    // squashed and thrown down-right, away from the key light
    sg.translate(ox + boss.width * 0.12, groundY);
    sg.transform(1, 0, 0.9, 0.22, 0, 0);
    sg.drawImage(flat, 0, -boss.height);
    sg.restore();
    const contact = sg.createRadialGradient(
      bcx,
      groundY,
      0,
      bcx,
      groundY,
      bw * 0.45,
    );
    contact.addColorStop(0, "rgba(20,10,20,0.9)");
    contact.addColorStop(1, "rgba(20,10,20,0)");
    sg.fillStyle = contact;
    sg.save();
    sg.translate(bcx, groundY);
    sg.scale(1, 0.18);
    sg.translate(-bcx, -groundY);
    sg.fillRect(bcx - bw, groundY - bw, bw * 2, bw * 2);
    sg.restore();
    g.save();
    g.globalAlpha = s.place.ground !== undefined ? 0.55 : 0.22;
    g.globalCompositeOperation = "multiply";
    g.drawImage(blurred(sh, (s.place.ground !== undefined ? 6 : 22) * u), 0, 0);
    g.restore();
  }
  // a soft glow around it (not over it), then the boss
  {
    const tinted = canvas(boss.width, boss.height);
    const tg = ctxOf(tinted);
    tg.drawImage(boss, 0, 0);
    tg.globalCompositeOperation = "source-in";
    tg.fillStyle = t.aura;
    tg.fillRect(0, 0, tinted.width, tinted.height);
    g.save();
    g.filter = `blur(${26 * u}px)`;
    g.globalCompositeOperation = "lighter";
    g.globalAlpha = 0.28;
    g.drawImage(tinted, ox, by);
    g.restore();
  }
  // reflection in the water
  if (s.setting === "sea") {
    const wl = s.horizon * H + (H - s.horizon * H) * 0.15;
    const refl = canvas(W, H);
    const rg = ctxOf(refl);
    const top = Math.max(wl, by + bh + 20 * u);
    for (let yy = 0; yy < boss.height; yy += 3) {
      const ry = top + (boss.height - yy) * 0.5;
      if (ry > H) continue;
      const wob = Math.sin(yy * 0.08) * 6 * u;
      rg.drawImage(boss, 0, yy, boss.width, 3, ox + wob, ry, boss.width, 1.6);
    }
    g.save();
    g.globalAlpha = 0.28;
    g.drawImage(blurred(refl, 2.5 * u), 0, 0);
    g.restore();
  }
  g.drawImage(boss, ox, by);

  // ── 8 front ribbons, sparkles, particles (never over the face)
  drawRibbons(g, s, u, ribbons, true, hole, { img: boss, x: ox, y: by });
  for (const rb of ribbons)
    for (let i = 0; i < rb.pts.length; i += 9) {
      const p = rb.pts[i];
      if (r() < 0.55 || p.w < 1) continue;
      const jx = (r() - 0.5) * 30 * u,
        jy = (r() - 0.5) * 30 * u;
      if (p.z > 0 && inFace(p.x + jx, p.y + jy, 1.3)) continue;
      if (r() < 0.35)
        sparkle(g, p.x + jx, p.y + jy, (2.5 + r() * 4) * u, t.spark, 0.9);
      else bokeh(g, p.x + jx, p.y + jy, (2 + r() * 4) * u, rb.col[1], 0.9);
    }
  for (let i = 0; i < 36; i++) {
    const kind = t.particles[i % t.particles.length];
    const x = r() * W,
      y = r() * H;
    if (inFace(x, y, 1.5)) continue;
    particle(g, s, kind, x, y, (3 + r() * 7) * u, r);
  }
  for (let i = 0; i < 16; i++) {
    const x = r() * W,
      y = r() * H;
    if (!inFace(x, y, 1.4))
      sparkle(g, x, y, (2 + r() * 5) * u, t.spark, 0.4 + r() * 0.5);
  }
  for (let i = 0; i < 20; i++) {
    const x = r() * W,
      y = r() * H;
    if (!inFace(x, y, 1.4))
      bokeh(g, x, y, (6 + r() * 18) * u, t.spark, 0.2 + r() * 0.3);
  }

  // ── 9 the foreground, per setting
  if (s.setting === "sea") waves(g, s, u, r);
  else if (s.setting === "sunset")
    skyLanterns(
      g,
      s,
      u,
      r,
      9,
      true,
      (x, y) => Math.abs(x - bcx) < bw * 0.62 && Math.abs(y - bcy) < bh * 0.6,
    );
  if (s.setting !== "sea") {
    const cl = canvas(W, H);
    const cc = ctxOf(cl);
    const n = s.setting === "sunset" ? 2 : 4;
    for (const side of [-1, 1])
      for (let i = 0; i < n; i++) {
        const x =
          side < 0
            ? (0.02 + i * 0.07 + r() * 0.03) * W
            : W - (0.02 + i * 0.07 + r() * 0.03) * W;
        const y = H * (1.03 - (n - 1 - i) * 0.03) - (n - 1 - i) * 22 * u;
        rock(
          cc,
          s,
          pat,
          x,
          y,
          (50 + (n - 1 - i) * 14 + r() * 20) * u * Math.min(1, (W / H) * 1.2),
          (r() - 0.5) * 0.6,
          r,
          r() < 0.4,
        );
        if (s.setting === "canyon" && r() < 0.7)
          crystalCluster(
            cc,
            x + (r() - 0.5) * 60 * u,
            y - 50 * u,
            (14 + r() * 12) * u,
            t.crack,
            r,
          );
      }
    cc.globalCompositeOperation = "source-atop";
    cc.fillStyle = rgba(t.shade, 0.45);
    cc.fillRect(0, 0, W, H);
    g.drawImage(blurred(cl, 1.2 * u), 0, 0);
  }
  for (let i = 0; i < 6; i++) {
    const a = r() * TAU;
    const x = bcx + Math.cos(a) * R0 * (0.75 + r() * 0.35) * 1.15,
      y = bcy + Math.sin(a) * R0 * (0.55 + r() * 0.3);
    if (inFace(x, y, 2) || Math.abs(x - bcx) < bw * 0.45) continue;
    rock(g, s, pat, x, y, (14 + r() * 22) * u, r() * TAU, r, r() < 0.6);
  }
  if (s.setting !== "sea" && s.place.ground === undefined) {
    const fgc = cloudBank(s, u, r, {
      y: 1.08,
      x0: -0.2,
      x1: 1.2,
      size: 120,
      rows: 1,
      alpha: 0.85,
      blur: 5,
      haze: 0,
    });
    g.globalAlpha = fgc.alpha;
    g.drawImage(fgc.c, 0, 0);
    g.globalAlpha = 1;
  }

  // ── 10 grade: a light wash from the key, vignette, canvas grain
  const wash = g.createRadialGradient(
    s.sun.x * W,
    s.sun.y * H,
    0,
    s.sun.x * W,
    s.sun.y * H,
    Math.max(W, H),
  );
  wash.addColorStop(0, rgba(t.light, 0.14));
  wash.addColorStop(0.5, rgba(t.light, 0.04));
  wash.addColorStop(1, rgba(t.light, 0));
  g.globalCompositeOperation = "screen";
  g.fillStyle = wash;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "multiply";
  const vg = g.createRadialGradient(
    W / 2,
    H * 0.48,
    Math.min(W, H) * 0.35,
    W / 2,
    H * 0.5,
    Math.hypot(W, H) * 0.62,
  );
  vg.addColorStop(0, "#ffffff");
  vg.addColorStop(0.6, mix("#ffffff", t.shade, 0.3));
  vg.addColorStop(1, t.shade);
  g.fillStyle = vg;
  g.fillRect(0, 0, W, H);
  g.globalCompositeOperation = "overlay";
  g.globalAlpha = 0.07;
  g.fillStyle = g.createPattern(grain(256, s.seed), "repeat")!;
  g.fillRect(0, 0, W, H);
  g.globalAlpha = 1;
  g.globalCompositeOperation = "source-over";

  return {
    canvas: out,
    box: [ox / W, by / H, boss.width / W, bh / H],
    face: [face.x / W, face.y / H],
    body: [body.x / W, body.y / H],
  };
}

function moon(g: Ctx, s: Scene, u: number) {
  const cx = s.sun.x * s.W,
    cy = s.sun.y * s.H,
    R = 46 * u;
  g.save();
  g.globalCompositeOperation = "screen";
  const gl = g.createRadialGradient(cx, cy, 0, cx, cy, R * 5);
  gl.addColorStop(0, "rgba(255,240,200,0.55)");
  gl.addColorStop(1, "rgba(255,240,200,0)");
  g.fillStyle = gl;
  g.fillRect(cx - R * 5, cy - R * 5, R * 10, R * 10);
  g.globalCompositeOperation = "source-over";
  const mg = g.createRadialGradient(cx - R * 0.3, cy - R * 0.3, 0, cx, cy, R);
  mg.addColorStop(0, "#fffbe8");
  mg.addColorStop(1, "#f0d898");
  g.fillStyle = mg;
  g.beginPath();
  g.arc(cx, cy, R, 0, TAU);
  g.fill();
  g.fillStyle = "rgba(180,150,100,0.25)";
  for (const [dx, dy, rr] of [
    [-0.3, 0.1, 0.22],
    [0.25, -0.25, 0.15],
    [0.2, 0.35, 0.12],
  ]) {
    g.beginPath();
    g.arc(cx + dx * R, cy + dy * R, rr * R, 0, TAU);
    g.fill();
  }
  g.restore();
}

/** A tile of fine canvas grain. */
function grain(n: number, seed: number) {
  const c = canvas(n, n);
  const g = ctxOf(c);
  const img = g.createImageData(n, n);
  const r = rng(seed + 77);
  for (let i = 0; i < n * n; i++) {
    const v = 128 + (r() - 0.5) * 255;
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return c;
}

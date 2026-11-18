/*
 * Element Bistro: the canal, alive.
 *
 * The street is baked into one picture with a hole where the water shows;
 * the water is drawn under it every frame, so the bridges, the banks and
 * everything standing on them cover it as they should. As toon-water in
 * games does it: the sky's colour mirrored in a gradient, short ripple
 * strokes drifting with the current, glints that twinkle, a darker band
 * under the far wall, lamps' light trembling on it at night, a moored
 * rowing boat bobbing. In winter it freezes: pale ice, cracks, a glint
 * sweeping across.
 */
import { R, iso, shade, skyColours, type Light } from "./bistro-art";
import { poly } from "./bistro-geom";
import {
  BRIDGE,
  TILE,
  WATER,
  canal,
  footX,
  hash,
  lerpRgb,
  onWall,
  quad,
  up,
  viewRect,
} from "./bistro-town";

type Ctx = CanvasRenderingContext2D;

/** How far along x the canal runs (well past the screen either way). */
const SPAN = { x0: -70, x1: 80 };
/** The open stretches of water (between the bridges' decks). */
export function openWater(): [number, number][] {
  const fx = footX();
  return [
    [SPAN.x0, BRIDGE.x0],
    [BRIDGE.x1, fx - 0.7],
    [fx + 0.7, SPAN.x1],
  ];
}
const rgb = (s: string) => (s.match(/\d+/g) ?? ["0", "0", "0"]).map(Number);

/** Cut the water's hole in the baked street (call right after the ground). */
export function cutWater(ctx: Ctx) {
  const c = canal();
  ctx.save();
  ctx.globalCompositeOperation = "destination-out";
  ctx.fillStyle = "#000";
  for (const [x0, x1] of [[SPAN.x0, BRIDGE.x0], [BRIDGE.x1, SPAN.x1]]) {
    quad(ctx, x0, c.y0, x1, c.y1);
    ctx.fill();
  }
  ctx.restore();
}
/** The banks (baked): the far wall's face down to the water, copings, the road bridge's arch. */
export function drawBanks(ctx: Ctx, l: Light) {
  const n = l.night,
    snow = l.season === "winter";
  const c = canal();
  const stone = lerpRgb([184, 174, 158], [62, 62, 76], n);
  const stoneDark = lerpRgb([140, 130, 118], [42, 42, 56], n);
  const coping = lerpRgb(snow ? [240, 244, 250] : [222, 214, 198], [84, 84, 100], n);
  for (const [x0, x1] of [[SPAN.x0, BRIDGE.x0], [BRIDGE.x1, SPAN.x1]]) {
    // The far wall: stone courses, a wet line at the water.
    ctx.fillStyle = stoneDark;
    poly(ctx, [iso(x0, c.y0), iso(x1, c.y0), up(iso(x1, c.y0), -WATER), up(iso(x0, c.y0), -WATER)]);
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,.16)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const dz of [6, 12]) {
      const a = iso(x0, c.y0),
        b = iso(x1, c.y0);
      ctx.moveTo(a.x, a.y + dz);
      ctx.lineTo(b.x, b.y + dz);
    }
    for (let x = Math.ceil(x0); x < x1; x += 0.6) {
      const p = iso(x, c.y0);
      const o = (Math.round(x / 0.6) % 2) * 6;
      ctx.moveTo(p.x, p.y + o);
      ctx.lineTo(p.x, p.y + o + 6);
    }
    ctx.stroke();
    ctx.fillStyle = "rgba(30,60,50,.35)";
    poly(ctx, [up(iso(x0, c.y0), -WATER + 4), up(iso(x1, c.y0), -WATER + 4), up(iso(x1, c.y0), -WATER), up(iso(x0, c.y0), -WATER)]);
    ctx.fill();
    // Copings along both banks.
    ctx.fillStyle = coping;
    quad(ctx, x0, c.y0 - 0.22, x1, c.y0);
    ctx.fill();
    quad(ctx, x0, c.y1, x1, c.y1 + 0.22);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,.12)";
    quad(ctx, x0, c.y1 + 0.18, x1, c.y1 + 0.22);
    ctx.fill();
  }
  // The road bridge's side over the water: an arch, voussoirs, a keystone.
  onWall(ctx, "y", BRIDGE.x1, c.y1, () => {
    const w = (c.y1 - c.y0) * TILE;
    ctx.fillStyle = stone;
    ctx.fillRect(0, -2, w, WATER + 30);
    ctx.fillStyle = lerpRgb([36, 60, 80], [10, 14, 28], n);
    ctx.beginPath();
    ctx.ellipse(w / 2, WATER + 30, w * 0.4, WATER + 22, 0, Math.PI, 0);
    ctx.fill();
    ctx.strokeStyle = stoneDark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(w / 2, WATER + 30, w * 0.4 + 3, WATER + 25, 0, Math.PI, 0);
    ctx.stroke();
    ctx.fillStyle = coping;
    ctx.fillRect(w / 2 - 5, -2, 10, 10);
  });
}

/** The water itself, every frame, under the baked street. */
export function drawWater(ctx: Ctx, l: Light, low: boolean) {
  const c = canal();
  const vr = viewRect(ctx);
  // The stretch of canal on screen.
  const xa = Math.max(SPAN.x0, vr.x0 / 48 + c.y0 - 2, vr.y0 / 24 - c.y1 - 2),
    xb = Math.min(SPAN.x1, vr.x1 / 48 + c.y1 + 2, vr.y1 / 24 - c.y0 + 2);
  if (xb <= xa) return;
  const n = l.night,
    t = l.t;
  const down = (p: { x: number; y: number }) => ({ x: p.x, y: p.y + WATER });
  const frozen = l.season === "winter";
  const top = down(iso(xa, c.y0)).y,
    bot = down(iso(xa, c.y1)).y;
  const [skyTop, skyBot] = skyColours(l);
  if (frozen) {
    const g = ctx.createLinearGradient(0, top, 0, bot + 40);
    g.addColorStop(0, lerpRgb([206, 224, 238], [64, 78, 108], n));
    g.addColorStop(1, lerpRgb([234, 244, 250], [86, 100, 130], n));
    ctx.fillStyle = g;
  } else {
    // The sky mirrored in the canal's own green-blue.
    const water = [62, 146, 168],
      deep = [38, 104, 132];
    const mix = (a: number[], b: number[], f: number) => a.map((v, i) => v + (b[i] - v) * f);
    const near = mix(water, rgb(skyBot), 0.35),
      far = mix(deep, rgb(skyTop), 0.25);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, lerpRgb(far, [14, 24, 48], n * 0.85));
    g.addColorStop(1, lerpRgb(near, [22, 34, 64], n * 0.85));
    ctx.fillStyle = g;
  }
  // Fill the whole stretch, sheared along the canal (iso): one quad.
  poly(ctx, [down(iso(xa, c.y0)), down(iso(xb, c.y0)), down(iso(xb, c.y1)), down(iso(xa, c.y1))]);
  ctx.fill();
  // The far wall's shadow on the water.
  const sh = ctx.createLinearGradient(0, 0, 0, 1);
  void sh;
  ctx.fillStyle = frozen ? "rgba(60,80,110,.12)" : `rgba(10,30,40,${0.28 - n * 0.1})`;
  poly(ctx, [down(iso(xa, c.y0)), down(iso(xb, c.y0)), down(iso(xb, c.y0 + 0.5)), down(iso(xa, c.y0 + 0.5))]);
  ctx.fill();
  if (frozen) {
    // Cracks in the ice, and a glint sweeping slowly along.
    ctx.strokeStyle = `rgba(255,255,255,${0.6 - n * 0.3})`;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    for (let i = Math.floor(xa); i < xb; i++) {
      const gy = c.y0 + 0.9 + hash(i + 7) * (c.y1 - c.y0 - 1.1);
      const p = down(iso(i + hash(i) * 0.6, gy)),
        q = down(iso(i + 0.5 + hash(i) * 0.6, gy + 0.25 - hash(i + 3) * 0.5)),
        r = down(iso(i + 0.9, gy + 0.1));
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(q.x, q.y);
      ctx.lineTo(r.x, r.y);
    }
    ctx.stroke();
    const sweep = xa + (((t * 1.5) % (xb - xa + 10)) - 5);
    const g = down(iso(sweep, (c.y0 + c.y1) / 2 + 0.3));
    const glint = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, 50);
    glint.addColorStop(0, `rgba(255,255,255,${0.45 - n * 0.3})`);
    glint.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glint;
    ctx.fillRect(g.x - 50, g.y - 50, 100, 100);
    return;
  }
  // Ripples drifting with the current (toward +x), in rows across the canal.
  const rows = low ? 3 : 5;
  const vis0 = c.y0 + 0.85,
    vis1 = c.y1 - 0.15;
  ctx.lineCap = "round";
  for (let r = 0; r < rows; r++) {
    const gy = vis0 + ((vis1 - vis0) * (r + 0.5)) / rows;
    const speed = 0.35 + r * 0.06;
    const step = low ? 1.9 : 1.3;
    const off = (t * speed + hash(r + 3) * step) % step;
    ctx.strokeStyle = n > 0.5 ? "rgba(150,180,230,.22)" : `rgba(255,255,255,${0.42 - n * 0.2})`;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    for (let x = Math.floor(xa / step) * step + off; x < xb; x += step) {
      const k = Math.floor(x / step) + r * 31;
      const jit = (hash(k) - 0.5) * 0.25;
      const len = 0.35 + hash(k + 5) * 0.35;
      const pulse = 0.5 + 0.5 * Math.sin(t * 2.2 + k);
      if (pulse < 0.25) continue;
      const a = down(iso(x, gy + jit)),
        b = down(iso(x + len, gy + jit));
      ctx.moveTo(a.x, a.y);
      ctx.quadraticCurveTo((a.x + b.x) / 2, (a.y + b.y) / 2 - 2.5, b.x, b.y);
    }
    ctx.stroke();
  }
  ctx.lineCap = "butt";
  // Glints of the sun (or the moon) twinkling.
  if (!low) {
    const sun = l.gold > 0.2 ? "255,214,150" : n > 0.5 ? "200,214,255" : "255,255,240";
    for (let i = Math.floor(xa * 1.5); i < xb * 1.5; i++) {
      const tw = Math.sin(t * 3 + i * 1.7);
      if (tw < 0.55) continue;
      const p = down(iso(i / 1.5 + hash(i) * 0.5, vis0 + hash(i + 11) * (vis1 - vis0)));
      ctx.fillStyle = `rgba(${sun},${(tw - 0.55) * 1.6 * (1 - n * 0.5)})`;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - 2.5);
      ctx.lineTo(p.x + 4, p.y);
      ctx.lineTo(p.x, p.y + 2.5);
      ctx.lineTo(p.x - 4, p.y);
      ctx.fill();
    }
  }
  // The promenade's lamps trembling on the water at night.
  if (n > 0.2) {
    for (const lx of lampXs()) {
      const p = down(iso(lx, c.y0 + 0.85));
      if (p.x < vr.x0 - 20 || p.x > vr.x1 + 20) continue;
      for (let k = 0; k < 6; k++) {
        const w = 10 - k * 1.2 + Math.sin(t * 4 + k * 1.3 + lx) * 3;
        ctx.fillStyle = `rgba(255,214,140,${(0.42 - k * 0.06) * n})`;
        ctx.fillRect(p.x - w / 2 + Math.sin(t * 3 + k) * 2, p.y + 4 + k * 5, w, 2.4);
      }
    }
  }
  drawBoat(ctx, l);
}
const lampXs = () => {
  const C = R.cols;
  return [1.8, footX() + 1.4, C - 0.8, C + 6, C + 12];
};
/** A rowing boat moored by the near bank, bobbing. */
function drawBoat(ctx: Ctx, l: Light) {
  const c = canal();
  const n = l.night;
  const x = R.cols + 3.2,
    y = c.y1 - 0.95;
  const bob = Math.sin(l.t * 1.3) * 1.6,
    roll = Math.sin(l.t * 1.1 + 1) * 0.03;
  const a = iso(x - 0.9, y),
    b = iso(x + 0.9, y);
  const o = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 + WATER + bob };
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.rotate(Math.atan2(b.y - a.y, b.x - a.x) + roll);
  const L = Math.hypot(b.x - a.x, b.y - a.y);
  ctx.fillStyle = "rgba(10,30,40,.25)";
  ctx.beginPath();
  ctx.ellipse(0, 3, L / 2 + 4, 6, 0, 0, Math.PI * 2);
  ctx.fill();
  // The hull: white with a red stripe, the inside wood.
  ctx.fillStyle = shade("#f4f1ea", -0.5 * n);
  ctx.beginPath();
  ctx.moveTo(-L / 2, -8);
  ctx.quadraticCurveTo(-L / 2 + 6, 4, -L / 2 + 18, 4);
  ctx.lineTo(L / 2 - 14, 4);
  ctx.quadraticCurveTo(L / 2 - 2, 2, L / 2 + 2, -10);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = shade("#d94a3a", -0.5 * n);
  ctx.fillRect(-L / 2 + 8, -4, L - 18, 3);
  ctx.fillStyle = shade("#9a6a3a", -0.5 * n);
  ctx.beginPath();
  ctx.ellipse(0, -9, L / 2 - 4, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade("#b07a44", -0.5 * n);
  ctx.fillRect(-5, -13, 10, 8);
  ctx.restore();
  // The rope to the bank.
  const post = iso(x - 0.6, c.y1 + 0.1);
  ctx.strokeStyle = shade("#c9a46a", -0.5 * n);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(a.x + 6, a.y + WATER + bob - 8);
  ctx.quadraticCurveTo((a.x + post.x) / 2, (a.y + post.y) / 2 + WATER, post.x, post.y - 6);
  ctx.stroke();
}

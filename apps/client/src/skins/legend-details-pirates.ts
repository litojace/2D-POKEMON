import { legendDetails, malletHead, lanternSpot, bladeLine, CHESTNUT, type Details } from "./legend-details";
import type { Kit } from "./modern-designs";
// Registers the costumes these details are drawn over.
import "./modern-pirates";

/**
 * Sky Pirates: each champion's own headwear and prop, worked up (see
 * legend-details.ts). Every piece comes from the captain's own post: the
 * storm corsair's plume and lightning cockade, the admiral's feather crest
 * and order star, the quartermaster's brooch and sealed, gilded map, the
 * kraken captain's brim wrapped in a lit tentacle... The coordinates are
 * the costume's own (modern-pirates.ts), so each detail sits on its piece.
 */
const GOLD = "#f2c14e",
  GOLD_DARK = "#a8823a",
  GOLD_LIGHT = "#fff0b3",
  PEARL = "#f6f1e4";
const cx = (k: Kit) => k.C + k.side * 3;
const flip = (x: number, svg: string) => `<g transform="translate(${2 * x} 0) scale(-1 1)">${svg}</g>`;
/** Seen from behind, a piece worn on one side of the head swaps sides. */
const turn = (k: Kit, x: number, svg: string) => (k.back ? flip(x, svg) : svg);
/** Drawn once for the right-facing profile, mirrored for the left one. */
const profile = (k: Kit, x: number, svg: string) => (k.side < 0 ? flip(x, svg) : svg);
const rot = (a: number, x: number, y: number, svg: string) => (a ? `<g transform="rotate(${a} ${x} ${y})">${svg}</g>` : svg);
const scaleAt = (sx: number, sy: number, x: number, y: number, svg: string) =>
  `<g transform="translate(${x} ${y}) scale(${sx} ${sy}) translate(${-x} ${-y})">${svg}</g>`;
const r1 = (v: number) => +v.toFixed(1);
type P = [number, number];
/** A point on a quadratic curve. */
const bez = (a: P, c: P, b: P, t: number): P => [
  (1 - t) ** 2 * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0],
  (1 - t) ** 2 * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1],
];
/** A gold wire with an ink edge (filigree, chains, piping). */
const wire = (k: Kit, d: string, w = 1.1, color = GOLD) => k.line(d, k.ink, w + 1) + k.line(d, color, w);
/** A white glint that catches the light. */
const glint = (k: Kit, x: number, y: number, r: number, i: number, color = "#ffffff") =>
  k.lume("twinkle", k.path(k.star(x, y, r, 4, 0.3), "#ffffff", "none", 0), i, color);
/** A cut stone in a gold setting. */
const gem = (k: Kit, x: number, y: number, r: number, fill: string) =>
  k.circle(x, y, r + 1.3, GOLD, GOLD_DARK, 0.7) + k.circle(x, y, r, fill, k.ink, 0.5) +
  k.path(`M${r1(x - r * 0.55)} ${r1(y - r * 0.1)}Q${r1(x - r * 0.45)} ${r1(y - r * 0.6)} ${r1(x + r * 0.05)} ${r1(y - r * 0.62)}`, "none", "#ffffffcc", Math.max(0.6, r * 0.32));
/** A filigree curl: a stem ending in a little spiral, opening toward d. */
const curl = (x: number, y: number, d: number, s = 1) =>
  `M${x} ${y}c${d * 2 * s} ${-2.5 * s} ${d * 6 * s} ${-3 * s} ${d * 7 * s} ${0.2 * s}c${d * 0.6 * s} ${2.2 * s} ${-d * 2.2 * s} ${2.8 * s} ${-d * 2.8 * s} ${0.8 * s}`;
/** A string of beads along a quadratic curve. */
const beads = (k: Kit, a: P, c: P, b: P, n: number, r: number, colors: string[], from = 0, to = 1) =>
  Array.from({ length: n }, (_, i) => {
    const [x, y] = bez(a, c, b, from + ((to - from) * i) / Math.max(1, n - 1));
    return k.circle(x, y, r, colors[i % colors.length], k.ink, 0.4);
  }).join("");
/**
 * An ostrich plume along a curve: a full, wavy-edged vane round its spine,
 * widest past the middle and rounding off at the tip, with barbs sweeping
 * toward the tip.
 */
function plume(k: Kit, a: P, c: P, b: P, w: number, fill: string, shade: string, n = 12) {
  const left: P[] = [],
    right: P[] = [],
    spine: [P, P, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = bez(a, c, b, t),
      p1 = bez(a, c, b, Math.min(1, t + 0.01)),
      p0 = bez(a, c, b, Math.max(0, t - 0.01));
    const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
    const tx = (p1[0] - p0[0]) / len,
      ty = (p1[1] - p0[1]) / len;
    const wt = w * Math.sqrt(Math.sin(Math.PI * (0.1 + 0.8 * t))) * (i % 2 ? 1 : 0.82);
    left.push([p[0] - ty * wt, p[1] + tx * wt]);
    right.push([p[0] + ty * wt, p[1] - tx * wt]);
    spine.push([p, [tx, ty], wt]);
  }
  const wave = (pts: P[]) => {
    let d = "";
    for (let i = 1; i < pts.length - 1; i++) d += `Q${r1(pts[i][0])} ${r1(pts[i][1])} ${r1((pts[i][0] + pts[i + 1][0]) / 2)} ${r1((pts[i][1] + pts[i + 1][1]) / 2)}`;
    return d + `L${r1(pts[pts.length - 1][0])} ${r1(pts[pts.length - 1][1])}`;
  };
  const [[ex, ey], [etx, ety], ew] = spine[n];
  const d = `M${r1(a[0])} ${r1(a[1])}L${r1(left[0][0])} ${r1(left[0][1])}` + wave(left) +
    `Q${r1(ex + etx * ew * 1.6)} ${r1(ey + ety * ew * 1.6)} ${r1(right[n][0])} ${r1(right[n][1])}` + wave([...right].reverse()) + "Z";
  const barbs = spine.slice(1, n).map(([[px, py], [tx, ty], wt]) =>
    `M${r1(px)} ${r1(py)}l${r1(-ty * wt * 0.7 + tx * wt * 0.6)} ${r1(tx * wt * 0.7 + ty * wt * 0.6)}M${r1(px)} ${r1(py)}l${r1(ty * wt * 0.7 + tx * wt * 0.6)} ${r1(-tx * wt * 0.7 + ty * wt * 0.6)}`).join("");
  return k.path(d, fill, k.ink, 0.9) + k.line(barbs, shade, 0.6) + k.line(`M${a[0]} ${a[1]}Q${c[0]} ${c[1]} ${b[0]} ${b[1]}`, shade, 1);
}

const DETAILS: Details = {
  // Storm Corsair: an ostrich plume the colour of storm cloud behind the
  // cockade, the lightning bolt set in a filigreed gold rosette, a beaded
  // lace along the brim; the storm compass gains an engraved bezel, a
  // compass-rose star, a sapphire at its bow and a gold chain to the belt.
  voltkit(k) {
    const hy = k.ht + 16,
      w = k.side ? 32 : 40,
      x = k.hx + k.side * 3,
      h = w * 0.62,
      f = k.side;
    const bx = k.hx + k.side * 6,
      by = hy - 26;
    const bolt = "#ffe25a";
    // The plume: tucked behind the cockade, sweeping over the crown to the
    // left side of the head (back over the crown in profile).
    const feather = f
      ? profile(k, x, plume(k, [x + 6, hy - 22], [x - 4, hy - 62], [x - 42, hy - 32], 7, "#e6ebf5", "#8f9ab0"))
      : turn(k, x, plume(k, [x + 3, hy - 22], [x + 22, hy - 62], [x + 48, hy - 24], 7, "#e6ebf5", "#8f9ab0"));
    // Lace beads just inside the gold brim edge.
    const lace = f
      ? profile(k, x, beads(k, [x - 44, hy - 24.5], [x - 12, hy - 11], [x + 46, hy - 12], 8, 1, [GOLD_LIGHT], 0.08, 0.92))
      : beads(k, [x - w + 3, hy - h * 0.7], [x - w * 0.55, hy - 1], [x, hy + 4.5], 5, 1, [GOLD_LIGHT], 0.15, 0.95) +
        beads(k, [x, hy + 4.5], [x + w * 0.55, hy - 1], [x + w - 3, hy - h * 0.7], 5, 1, [GOLD_LIGHT], 0.05, 0.85);
    // Filigree curls at the brim's corners.
    const corners = f
      ? profile(k, x, wire(k, curl(x - 40, hy - 22, 1, 1.1)))
      : wire(k, curl(x - w + 4, hy - h * 0.62, 1, 1.1)) + wire(k, curl(x + w - 4, hy - h * 0.62, -1, 1.1));
    // The cockade: a scalloped gold rosette with curls, the bolt redrawn on it.
    const rosette = (sx: number) =>
      scaleAt(sx, 1, bx, by + 9,
        wire(k, curl(bx - 8, by + 12, -1, 1.2), 1) + wire(k, curl(bx + 8, by + 12, 1, 1.2), 1) +
        k.path(k.star(bx, by + 9, 9.5, 14, 0.82), GOLD, GOLD_DARK, 0.8) + k.circle(bx, by + 9, 6.6, "#24345e", k.ink, 0.6) +
        `<circle cx="${bx}" cy="${by + 9}" r="5.2" fill="none" stroke="${GOLD_LIGHT}" stroke-width="0.6" stroke-dasharray="0.8 1.2"/>`) +
      k.lume("pulse", k.path(`M${bx + 1} ${by}L${bx - 5} ${by + 10}H${bx - 1}L${bx - 3} ${by + 18}L${bx + 5} ${by + 7}H${bx + 1}Z`, bolt, k.ink, 0.6), 0, bolt) +
      glint(k, bx + 3.5, by + 3, 2.2, 5);
    k.put("flame", lace + corners + feather + (k.back ? "" : rosette(f ? 0.6 : 1)));
    // The storm compass, worked up: rose, bezel, bow and sapphire, chain.
    if (!k.back) {
      const c = cx(k);
      const px = c + (k.side ? k.side * 6 : 12),
        py = k.B - 18;
      k.put("body",
        wire(k, `M${px - 1} ${py - 9}Q${c - 2} ${py - 8} ${c - 4} ${k.B - 10}`, 1.2, GOLD) +
        `<path d="M${px - 1} ${py - 9}Q${c - 2} ${py - 8} ${c - 4} ${k.B - 10}" fill="none" stroke="${GOLD_DARK}" stroke-width="1.2" stroke-dasharray="1.2 1"/>` +
        k.path(k.star(px, py, 11, 4, 0.36), GOLD, GOLD_DARK, 0.7) + k.path(k.star(px, py, 8.6, 4, 0.4), GOLD_DARK, "none", 0).replace("<path", `<path transform="rotate(45 ${px} ${py})"`) +
        k.circle(px, py, 7.4, GOLD, k.ink, 0.8) +
        `<circle cx="${px}" cy="${py}" r="6.3" fill="none" stroke="${GOLD_DARK}" stroke-width="1.3" stroke-dasharray="0.6 1.05"/>` +
        k.circle(px, py, 5.1, "#1b2440", "none", 0) +
        k.lume("pulse", k.path(`M${px} ${py - 4.6}L${px + 1.6} ${py}L${px} ${py + 4.6}L${px - 1.6} ${py}Z`, bolt, "none") + k.circle(px, py, 1, "#ffffff", "none", 0), 1, bolt) +
        k.circle(px, py - 9.2, 2, "none", GOLD, 1.2) + gem(k, px, py - 7.4, 1.5, "#3f7cff") + glint(k, px - 2.6, py - 2.6, 1.8, 6));
    }
  },

  // Tide Admiral: a crest of white ostrich feather along the bicorne's laced
  // edge, gold bullion tassels at its points, the cockade ringed in pearls
  // under a gold loop and button; on the sash, the star of an order in blue
  // enamel with a pearl at its heart.
  tidefin(k) {
    const navy = "#1d2c58";
    const x = k.side ? k.hx - k.side * 4 : k.hx,
      y = k.side ? k.ht + 12 : k.ht + 11;
    if (k.side) {
      // End-on: the feather crest runs up both edges of the wedge.
      const b = 36,
        h = 34;
      const crest = beads(k, [x - b + 2, y - 3], [x - b * 0.8, y - h * 0.62], [x - 2, y - h * 1.06], 6, 3, [PEARL]) +
        beads(k, [x + 2, y - h * 1.06], [x + b * 0.8, y - h * 0.62], [x + b - 2, y - 3], 6, 3, [PEARL]);
      k.put("flame", crest, true);
      // The loop and button over the cockade on the face side.
      const lx = x + k.side * 30;
      k.put("flame", wire(k, `M${lx} ${y - 19}L${lx - k.side * 4} ${y - 27}`, 1.4) + k.circle(lx - k.side * 4.4, y - 27.6, 1.8, GOLD, GOLD_DARK, 0.6) +
        // A bullion tassel hanging from the near point at the top.
        k.circle(x, y - h * 1.08, 2.2, GOLD, GOLD_DARK, 0.6));
    } else {
      const w = 54,
        h = 30;
      // The crest peeks above the gold edge, from behind the hat.
      k.put("flame", beads(k, [x - w + 4, y - 2], [x - w * 0.8, y - h * 1.24], [x, y - h - 2.5], 7, 3.2, [PEARL], 0.12, 1) +
        beads(k, [x, y - h - 2.5], [x + w * 0.8, y - h * 1.24], [x + w - 4, y - 2], 7, 3.2, [PEARL], 0, 0.88), true);
      // Bullion tassels at the points, swinging below them.
      const tassel = (tx: number, s: number) => k.circle(tx, y + 1, 2.6, GOLD, GOLD_DARK, 0.7) +
        k.path(`M${tx - 3} ${y + 3}L${tx + 3} ${y + 3}L${tx + 3.6 + s} ${y + 11}L${tx - 3.6 + s} ${y + 11}Z`, GOLD, GOLD_DARK, 0.7) +
        [-2, 0, 2].map((dx) => k.line(`M${tx + dx + s * 0.4} ${y + 4.5}l${s * 0.6} 6`, GOLD_DARK, 0.6)).join("");
      let hat = tassel(x - w + 2, -1) + tassel(x + w - 2, 1);
      if (!k.back) {
        const cyk = y - 14.4;
        hat += wire(k, `M${x - 2.6} ${cyk - 6}L${x - 2.2} ${y - h + 1}M${x + 2.6} ${cyk - 6}L${x + 2.2} ${y - h + 1}`, 1.3) +
          k.circle(x, y - h + 1.5, 2.2, GOLD, GOLD_DARK, 0.6) +
          Array.from({ length: 10 }, (_, i) => {
            const a = (i / 10) * Math.PI * 2;
            return k.circle(x + Math.cos(a) * 7.8, cyk + Math.sin(a) * 7.8, 1.25, PEARL, k.ink, 0.35);
          }).join("") +
          k.lume("pulse", k.circle(x, cyk, 6, "#2f8fd0", GOLD, 1.4) + k.path(k.star(x, cyk, 3.4, 6, 0.45), "#ffffff", "none", 0), 0, "#9fe2ff");
      }
      k.put("flame", hat);
    }
    // The order's star on the sash.
    if (!k.back) {
      const s = k.side < 0 ? -1 : 1;
      const t = 0.62;
      const sx = s > 0 ? k.L + (k.R - k.L) * t : k.R - (k.R - k.L) * t,
        sy = k.T + 5 + (k.B - k.T - 10) * t;
      k.put("body", k.path(k.star(sx, sy, 7.4, 8, 0.5), GOLD, GOLD_DARK, 0.7) + k.path(k.star(sx, sy, 5.4, 8, 0.6), GOLD_LIGHT, "none", 0).replace("<path", `<path transform="rotate(22.5 ${sx} ${sy})"`) +
        k.circle(sx, sy, 3.4, "#2f6fc0", navy, 0.6) + k.circle(sx, sy, 1.5, PEARL, "none", 0) + glint(k, sx + 2.6, sy - 3, 2, 4, "#fff3b0"));
    }
  },

  // Chart Quartermaster: a gold compass-rose brooch with a ruby pinning the
  // cavalier hat's band, a chain swagged to the quill, gold piping on the
  // brim; the map gains gilded rollers with knobbed finials, a sea route to
  // its X, a compass rose, and a red wax seal on ribbons.
  mystowl(k) {
    const x = k.hx + k.side * 3,
      y = k.ht + 14;
    const w = k.side ? 34 : 50;
    const ruby = "#e0283c";
    const hat = wire(k, `M${x - w + 4} ${y + 2.4}Q${x} ${y + 10} ${x + w - 4} ${y - 1.2}`, 1.1) +
      `<path d="M${x - w * 0.28} ${y - 6.5}Q${x - w * 0.04} ${y + 1} ${x + w * 0.2} ${y - 6.5}" fill="none" stroke="${GOLD}" stroke-width="1.5" stroke-dasharray="1.3 0.8"/>` +
      k.path(k.star(x - w * 0.28, y - 6.5, 6.4, 8, 0.45), GOLD, GOLD_DARK, 0.7) +
      gem(k, x - w * 0.28, y - 6.5, 2.2, ruby) + glint(k, x - w * 0.28 + 2, y - 9, 1.8, 6);
    k.put("flame", turn(k, x, profile(k, x, rot(k.side ? -6 : -7, x, y, hat))));
    const roller = (rx: number, ry: number, half: number) =>
      k.rect(rx - half, ry - 2.2, half * 2, 4.4, 2, GOLD, GOLD_DARK, 0.7) + k.line(`M${rx - half + 1.5} ${ry - 0.9}H${rx + half - 1.5}`, GOLD_LIGHT, 0.7) +
      k.circle(rx - half - 1.2, ry, 2, GOLD, k.ink, 0.6) + k.circle(rx + half + 1.2, ry, 2, GOLD, k.ink, 0.6);
    const seal = (sx: number, sy: number) =>
      k.path(`M${sx - 2} ${sy + 2}L${sx - 4} ${sy + 9}L${sx - 1.5} ${sy + 7.5}L${sx} ${sy + 10}Z`, "#b01e2c", k.ink, 0.5) +
      k.path(`M${sx + 1} ${sy + 2}L${sx + 3.5} ${sy + 9.5}L${sx + 1} ${sy + 8}L${sx - 0.5} ${sy + 10}Z`, "#b01e2c", k.ink, 0.5) +
      k.path(`M${sx - 3.4} ${sy - 1}Q${sx - 3.8} ${sy - 3.6} ${sx - 1} ${sy - 3.5}Q${sx + 0.6} ${sy - 4.4} ${sx + 2.4} ${sy - 3}Q${sx + 4} ${sy - 1.6} ${sx + 3.4} ${sy + 0.6}Q${sx + 3.6} ${sy + 3.2} ${sx + 0.8} ${sy + 3.4}Q${sx - 1.2} ${sy + 4.2} ${sx - 2.8} ${sy + 2.6}Q${sx - 4.2} ${sy + 1} ${sx - 3.4} ${sy - 1}Z`, "#d02a36", k.ink, 0.6) +
      k.path(k.star(sx, sy, 1.8, 4, 0.4), "#8a1420", "none", 0);
    if (k.back) {
      // The map's rolled end past the hip: a gilded cap and its seal.
      k.put("scarf", k.circle(k.C + 30.5, k.B - 26, 3.4, GOLD, GOLD_DARK, 0.8) + k.circle(k.C + 30.5, k.B - 26, 1.4, GOLD_LIGHT, "none", 0) +
        k.rect(k.C + 25.5, k.B - 6, 10, 3, 1.2, GOLD, GOLD_DARK, 0.6) + seal(k.C + 31, k.B - 13));
    } else {
      const s = k.side || 1;
      const mx = k.side ? k.C - s * 4 : k.C - 34,
        my = k.B - 16;
      k.put("body",
        `<path d="M${mx - 5} ${my - 7}Q${mx - 2} ${my - 1} ${mx + 3} ${my}" fill="none" stroke="#8a3a2a" stroke-width="0.8" stroke-dasharray="1 1"/>` +
        k.path(k.star(mx + 4.5, my - 6.5, 2.8, 4, 0.3), "#8a6a3a", "none", 0) +
        roller(mx, my - 12, 10) + roller(mx, my + 10, 10) + seal(mx - 5, my + 7) +
        k.lume("pulse", k.line(`M${mx + 1} ${my + 1}l5 5m0 -5l-5 5`, "#ff3a3a", 1.8), 1, "#ff6a5a"));
    }
  },

  // Ghost Ship Wisp: a bone skull over crossed bones under the ghost-flame
  // cockade, its sockets lit green; a tattered spectral plume streaming off
  // the crown; a rusted chain swagged across it; wisps rising off the brim.
  duskveil(k) {
    const y = k.ht + 44,
      w = k.side ? 34 : 44,
      x = k.hx + k.side * 3,
      green = "#7dffc8",
      bone = "#efe8d4";
    // The ragged plume, behind the crown, trailing off the back (to the
    // head's left from the front).
    const strands = (ax: number, ay: number, d: number) =>
      [0, 1, 2, 3].map((i) => k.path(`M${ax} ${ay}Q${ax + d * (10 + i * 3)} ${ay - 26 + i * 4} ${ax + d * (30 + i * 4)} ${ay - 18 + i * 7}Q${ax + d * (18 + i * 3)} ${ay - 16 + i * 4} ${ax + d * 2} ${ay + 2}Z`, i % 2 ? "#a8e8cf" : "#cdf7e6", k.ink, 0.6)).join("");
    k.put("flame", `<g opacity=".9">${k.side ? profile(k, x, strands(x - 6, y - 26, -1)) : turn(k, x, rot(6, x, y, strands(x + 8, y - 30, 1)))}</g>`, true);
    // The rusted chain across the crown: links in turn, flat and edge-on.
    const chain = (a: P, c: P, b: P, n: number) =>
      Array.from({ length: n }, (_, i) => {
        const [lx, ly] = bez(a, c, b, i / (n - 1));
        return i % 2 ? k.rect(lx - 2.2, ly - 0.8, 4.4, 1.6, 0.8, "#7a5a40", k.ink, 0.5) : `<ellipse cx="${r1(lx)}" cy="${r1(ly)}" rx="2.4" ry="1.6" fill="none" stroke="${k.ink}" stroke-width="1.8"/><ellipse cx="${r1(lx)}" cy="${r1(ly)}" rx="2.4" ry="1.6" fill="none" stroke="#9a7458" stroke-width="0.9"/>`;
      }).join("");
    const h = w * 0.62;
    const swag = k.side
      ? profile(k, x, chain([x - 26, y - 14], [x - 4, y - 4], [x + 22, y - 12], 9))
      : rot(6, x, y, chain([x - w * 0.56, y - h * 0.62], [x - 4, y - h * 0.02], [x + w * 0.5, y - h * 0.66], 11));
    // Wisps curling up off the brim's points.
    const wisp = (wx: number, wy: number, d: number, i: number) =>
      k.lume("twinkle", k.path(`M${wx} ${wy}q${d * -3} -5 ${d * 1} -9q${d * 2} -2 ${d * 1} -5q${d * 4} 4 ${d * 1} 9q${d * -2} 3 ${d * -2} 5Z`, green, "none", 0), i, green);
    const wisps = k.side ? profile(k, x, wisp(x - 44, y - 30, 1, 2)) : rot(6, x, y, wisp(x - w + 2, y - h * 0.75, 1, 2) + wisp(x + w - 2, y - h * 0.75, -1, 3));
    // The skull badge under the ghost flame, over crossed bones.
    const sx = k.hx + k.side * 4 + 3,
      sy = y - 13;
    const skull = k.line(`M${sx - 6} ${sy - 4}L${sx + 6} ${sy + 5}M${sx + 6} ${sy - 4}L${sx - 6} ${sy + 5}`, k.ink, 3.4) + k.line(`M${sx - 6} ${sy - 4}L${sx + 6} ${sy + 5}M${sx + 6} ${sy - 4}L${sx - 6} ${sy + 5}`, bone, 1.9) +
      [[-6.5, -4.5], [6.5, -4.5], [-6.5, 5.5], [6.5, 5.5]].map(([dx, dy]) => k.circle(sx + dx, sy + dy, 1.3, bone, k.ink, 0.5)).join("") +
      k.path(`M${sx - 4.4} ${sy}Q${sx - 4.6} ${sy - 5.4} ${sx} ${sy - 5.4}Q${sx + 4.6} ${sy - 5.4} ${sx + 4.4} ${sy}Q${sx + 4.2} ${sy + 2.4} ${sx + 2.6} ${sy + 2.8}L${sx + 2.4} ${sy + 4.6}H${sx - 2.4}L${sx - 2.6} ${sy + 2.8}Q${sx - 4.2} ${sy + 2.4} ${sx - 4.4} ${sy}Z`, bone, k.ink, 0.7) +
      k.lume("pulse", k.circle(sx - 1.8, sy - 1, 1.3, green, "none", 0) + k.circle(sx + 1.8, sy - 1, 1.3, green, "none", 0), 4, green) +
      k.line(`M${sx - 1} ${sy + 3}v1.4M${sx + 1} ${sy + 3}v1.4`, k.ink, 0.5);
    k.put("flame", `<g opacity=".94">${swag}</g>` + wisps + (k.back ? "" : k.side ? scaleAt(0.7, 1, sx, sy, skull) : skull));
  },

  // Sunset Skipper: the little orange set in a gilded sunburst, a scarlet
  // macaw feather from its parrot tucked in the band, and the parrot itself
  // in a tiny tricorne of its own, a gold ring on its leg.
  sunbara(k) {
    const x = k.hx + k.side * 3,
      y = k.ht + 16;
    const w = k.side ? 30 : 38;
    // The macaw feather, tucked into the band on the far side of the orange.
    const feather = (fx: number, fy: number, d: number) =>
      k.path(`M${fx} ${fy}Q${fx + d * 4} ${fy - 16} ${fx + d * 18} ${fy - 30}Q${fx + d * 12} ${fy - 14} ${fx + d * 3} ${fy + 1}Z`, "#e8322a", k.ink, 0.8) +
      k.path(`M${fx + d * 13} ${fy - 24}Q${fx + d * 16} ${fy - 28} ${fx + d * 18} ${fy - 30}Q${fx + d * 15} ${fy - 24} ${fx + d * 12} ${fy - 20}Z`, "#2f8fd0", "none", 0) +
      k.path(`M${fx + d * 9} ${fy - 17}Q${fx + d * 11} ${fy - 20} ${fx + d * 13} ${fy - 24}L${fx + d * 12} ${fy - 20}Q${fx + d * 10} ${fy - 16} ${fx + d * 8} ${fy - 13}Z`, "#f2c14e", "none", 0) +
      k.line(`M${fx + d * 1.5} ${fy}Q${fx + d * 6} ${fy - 16} ${fx + d * 17} ${fy - 29}`, "#8a1a14", 0.7);
    const tuck = k.side ? profile(k, x, feather(x - 10, y - 8, -1)) : turn(k, x, feather(x + 12, y - 7, 1));
    k.put("flame", tuck);
    // The sunburst behind the orange, which is redrawn on it.
    if (!k.back) {
      const ox = x + (k.side ? k.side * 6 : -16),
        oy = y - 10;
      const burst = k.path(k.star(ox, oy, 10.5, 12, 0.62), GOLD, GOLD_DARK, 0.7) + k.path(k.star(ox, oy, 8, 12, 0.7), "#ff9a3a", "none", 0).replace("<path", `<path transform="rotate(15 ${ox} ${oy})"`);
      k.put("flame", (k.side ? scaleAt(0.65, 1, ox, oy, burst) : burst) +
        k.lume("pulse", k.circle(ox, oy, 5.4, "#ff9a2a", "#a8562c", 0.8), 1, "#ffb347") + k.path(`M${ox} ${oy - 5}q4 -4 7 -2q-3 3 -7 2Z`, "#3fbf5a", k.ink, 0.5) +
        k.circle(ox - 1.8, oy - 1.8, 1.2, "#ffd9a0", "none", 0) + glint(k, ox + 5, oy - 6, 2, 5, "#fff3b0"));
    }
    // The parrot's own little tricorne and leg ring.
    const s = k.side ? k.side : 1;
    const px = k.back ? k.C - 30 : k.side ? k.C - k.side * 6 : k.R + 8,
      py = k.back ? k.T - 6 : k.side ? k.T - 6 : k.T - 2;
    k.put("flame", `<g transform="translate(${px} ${py}) scale(${s} 1)">` +
      k.path(`M-6 -10Q1 -7.5 9 -11.5L7.5 -15Q2.5 -20.5 -2.5 -16Q-5 -14.5 -6 -10Z`, "#2a1a14", k.ink, 0.7) +
      k.line(`M-6 -10Q1 -7.5 9 -11.5`, GOLD, 1.2) + k.circle(1.5, -14.5, 1.1, "#f4ecd8", "none", 0) +
      k.circle(-2, 9.5, 1.6, "none", GOLD, 1.1) + "</g>");
  },

  // Kraken Captain: a second tentacle wrapped round the brim, curling up at
  // its end, with a row of pale suckers lit from within (suckers along the
  // crown's tentacle in profile too), a gold laurel round the star; on the
  // coat, the glowing spot becomes a kraken's eye pendant on a gold chain.
  shadopus(k) {
    const bio = "#5ff0ff",
      skin = "#7a3ac0",
      belly = "#c9a2f0";
    const x = k.hx + k.side * 3,
      y = k.ht + 30;
    const w = k.side ? 30 : 42;
    const sucker = (sx: number, sy: number, r: number, i: number) =>
      k.circle(sx, sy, r, belly, k.ink, 0.5) + k.lume("chase", k.circle(sx, sy, r * 0.5, bio, "none", 0), i, bio);
    const arm = (d: string) => k.line(d, k.ink, 6.6) + k.line(d, skin, 5) + k.line(d, "#9a5ad8", 1.4);
    let svg: string;
    if (k.side) {
      const f = k.side;
      // Along the brim's near edge, tip curling up at the front.
      const brim: [P, P, P] = [[x - f * (w + 4), y - 3], [x, y + 9], [x + f * (w + 2), y]];
      svg = arm(`M${brim[0][0]} ${brim[0][1]}Q${brim[1][0]} ${brim[1][1]} ${brim[2][0]} ${brim[2][1]}Q${x + f * (w + 9)} ${y - 4} ${x + f * (w + 6)} ${y - 9}Q${x + f * (w + 3)} ${y - 11} ${x + f * (w + 2)} ${y - 7}`) +
        [0.18, 0.4, 0.62, 0.84].map((t, i) => {
          const [sx, sy] = bez(...brim, t);
          return sucker(sx, sy + 1.2, 1.7, i);
        }).join("") +
        // The crown's tentacle gets suckers on its underside.
        [0.25, 0.55].map((t, i) => {
          const [sx, sy] = bez([x - f * 26, y - 2], [x, y - 10], [x + f * 22, y - 18], t);
          return sucker(sx, sy + 2.2, 1.5, i + 4);
        }).join("");
    } else {
      const brim: [P, P, P] = [[x + w + 4, y - 3], [x, y + 13], [x - w - 2, y]];
      svg = arm(`M${brim[0][0]} ${brim[0][1]}Q${brim[1][0]} ${brim[1][1]} ${brim[2][0]} ${brim[2][1]}Q${x - w - 9} ${y - 4} ${x - w - 6} ${y - 10}Q${x - w - 2} ${y - 13} ${x - w} ${y - 8}`) +
        [0.12, 0.3, 0.5, 0.7, 0.88].map((t, i) => {
          const [sx, sy] = bez(...brim, t);
          return sucker(sx, sy + 1.3, 1.9, i);
        }).join("") +
        // Pale rings round the crown tentacle's lit spots.
        [[x - 26, y - 7], [x - 8, y - 10], [x + 10, y - 9], [x + 30, y - 10], [x + 40, y - 20]].map(([sx, sy]) => `<circle cx="${sx}" cy="${sy}" r="2.5" fill="none" stroke="${belly}" stroke-width="1"/>`).join("") +
        (k.back ? "" : [-1, 1].map((d) => [0, 1, 2].map((j) => `<ellipse cx="${x + d * (8.5 + j * 1.2)}" cy="${y - 20 + j * 3.4}" rx="1.1" ry="2.2" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.4" transform="rotate(${d * (25 + j * 20)} ${x + d * (8.5 + j * 1.2)} ${y - 20 + j * 3.4})"/>`).join("")).join(""));
    }
    k.put("flame", turn(k, x, svg));
    if (!k.back) {
      const c = cx(k);
      k.put("body", wire(k, `M${c - 8} ${k.T}Q${c - 3} ${k.T + 6} ${c} ${k.T + 9.5}M${c + 8} ${k.T}Q${c + 3} ${k.T + 6} ${c} ${k.T + 9.5}`, 0.9) +
        k.circle(c, k.T + 14, 4.8, "none", GOLD, 1.6) + k.circle(c, k.T + 14, 5.7, "none", k.ink, 0.5) +
        `<ellipse cx="${c}" cy="${k.T + 14}" rx="0.9" ry="2.6" fill="#0d1e2c"/>` + glint(k, c + 2, k.T + 12, 1.6, 5));
    }
  },

  // Cinder Buccaneer: a skull over crossed bones on the bandana, its eyes
  // lit like embers, gold studs along the band and gold doubloons on the
  // knot's tails; the ship's lantern framed in brass with a cage, a ring and
  // a finial, sparks rising off it.
  cindrake(k) {
    const ember = "#ffb347",
      bone = "#f4ecd8";
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    // Headwear: it goes on the hat layer, riding the head (ANIMATED_CRESTS).
    const part = "flame";
    let band = [-22, -8, 8, 22].map((dx) => ((k.side && dx * k.side > 12) || (!k.side && Math.abs(dx) < 10) ? "" : k.circle(x + dx, y + 3.5 + Math.abs(dx) * 0.04, 1.5, GOLD, GOLD_DARK, 0.5))).join("");
    if (!k.back) {
      const sx = k.side ? x + k.side * 27 : x,
        sy = k.side ? y + 3 : y + 2.5,
        r = k.side ? 2.6 : 3.4;
      const bones = `M${sx - r * 2} ${sy - r * 1.1}L${sx + r * 2} ${sy + r * 1.1}M${sx + r * 2} ${sy - r * 1.1}L${sx - r * 2} ${sy + r * 1.1}`;
      band += k.line(bones, k.ink, 2.6) + k.line(bones, bone, 1.4) + k.circle(sx, sy, r, bone, k.ink, 0.6) +
        k.lume("pulse", k.circle(sx - r * 0.36, sy - r * 0.1, r * 0.26, ember, "none", 0) + k.circle(sx + r * 0.36, sy - r * 0.1, r * 0.26, ember, "none", 0), 2, ember);
    }
    // Doubloons on the ends of the knot's tails.
    const w = 37;
    const kx = k.back ? x : k.side ? x - k.side * (w - 2) : x + w - 4;
    const d = k.back ? 1 : k.side ? -k.side : 1;
    const ky = y + 1;
    band += [[kx + d * 6, ky + 22], [kx + d * 16, ky + 16]].map(([cx0, cy0]) => k.circle(cx0, cy0, 2.2, GOLD, GOLD_DARK, 0.6) + k.circle(cx0, cy0, 1, GOLD_DARK, "none", 0)).join("");
    k.put(part, band);
    // The lantern: brass posts, cage bars, ring and finial, rising sparks;
    // on the scarf layer, with the lantern it details.
    const lx = k.back ? k.R + 8 : k.side ? k.C - k.side * 10 : k.L - 8,
      ly = k.B - 2;
    k.put("scarf",
      k.line(`M${lx - 1.6} ${ly - 7}V${ly + 5}M${lx + 1.6} ${ly - 7}V${ly + 5}`, "#3a2a1c", 0.9) +
      k.rect(lx - 6.6, ly - 9.5, 2, 17, 0.8, GOLD, k.ink, 0.5) + k.rect(lx + 4.6, ly - 9.5, 2, 17, 0.8, GOLD, k.ink, 0.5) +
      k.path(`M${lx - 6.5} ${ly - 9}L${lx} ${ly - 14}L${lx + 6.5} ${ly - 9}Z`, GOLD, k.ink, 0.6) + k.path(`M${lx - 3} ${ly - 10}L${lx} ${ly - 12.4}L${lx + 3} ${ly - 10}`, "none", GOLD_DARK, 0.7) +
      k.circle(lx, ly - 18, 2.2, "none", GOLD, 1.3) + k.circle(lx, ly - 14.8, 1.4, GOLD, k.ink, 0.5) +
      k.rect(lx - 7.5, ly + 5.5, 15, 3.6, 1.2, GOLD, k.ink, 0.6) + k.line(`M${lx - 6} ${ly + 7.3}H${lx + 6}`, GOLD_DARK, 0.6) +
      [[-3, -20, 0], [3.5, -24, 1]].map(([dx, dy, i]) => k.lume("twinkle", k.circle(lx + dx, ly + dy, 1, "#ffd27a", "none", 0), 4 + i, ember)).join(""));
  },

  // Prism Navigator: the brow band set with gold stars like a chart, the
  // compass-rose pin made an eight-point rose round a sapphire with a prism
  // drop beneath; the spyglass gains engraved gold bands, a leather grip and
  // a prism at its lens throwing a little rainbow.
  auralynx(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    let band = "";
    // Chart stars along the band.
    const pts = k.side ? [-0.7, -0.35, 0] : [-0.75, -0.42, 0.12, 0.5];
    band += pts.map((t) => {
      const sx = x + t * 35,
        sy = y + 2.5 - 4.5 * (1 - t * t);
      return k.path(k.star(sx, sy, 2.2, 4, 0.35), GOLD_LIGHT, GOLD_DARK, 0.4);
    }).join("");
    if (!k.back) {
      const px = k.side ? x + k.side * 18 : x + 22,
        py = y + 1;
      band += k.path(k.star(px, py, 7.4, 4, 0.3), GOLD, GOLD_DARK, 0.6) + k.path(k.star(px, py, 5.6, 4, 0.35), GOLD_LIGHT, GOLD_DARK, 0.4).replace("<path", `<path transform="rotate(45 ${px} ${py})"`) +
        gem(k, px, py, 1.8, "#3f6cff") +
        k.line(`M${px} ${py + 3}V${py + 5.5}`, GOLD, 0.9) +
        k.lume("twinkle", k.path(`M${px} ${py + 5}L${px + 2.2} ${py + 8}L${px} ${py + 11}L${px - 2.2} ${py + 8}Z`, "#e8fbff", k.ink, 0.5) + k.line(`M${px - 1.1} ${py + 8}L${px} ${py + 6.2}M${px + 0.4} ${py + 9.6}L${px + 1.4} ${py + 8}`, "#ff8ad8", 0.5), 3, "#bfe8ff");
    }
    k.put("flame", band);
    // The spyglass: engraved gold bands, a leather grip, a prism at the lens.
    const d = k.back ? -1 : k.side ? k.side : 1;
    const sx = k.back ? k.L - 10 : k.side ? k.C + k.side * 8 : k.R + 14,
      sy = k.B - 4;
    const ex = sx - d * 26;
    k.put("flame",
      k.rect(Math.min(ex - 4, ex + 4), sy - 2.2, 8, 4.4, 1.5, "#5a3a22", k.ink, 0.6) +
      [-2.5, 0, 2.5].map((o) => k.line(`M${ex + o - 1} ${sy - 2}l2 4`, "#3a2416", 0.6)).join("") +
      [2.5, 8, 15, 21].map((o) => k.rect(sx - d * o - 1, sy - 3.4, 2, 6.8, 0.6, GOLD, GOLD_DARK, 0.5)).join("") +
      [11.5, 18].map((o) => k.path(k.star(sx - d * o, sy, 1.4, 4, 0.4), GOLD_LIGHT, "none", 0)).join("") +
      k.path(`M${sx + d * 1} ${sy - 3.2}L${sx + d * 5.5} ${sy}L${sx + d * 1} ${sy + 3.2}Z`, "#e8fbffdd", k.ink, 0.5) +
      k.lume("twinkle", ["#ff6a6a", "#ffd84a", "#6aff8a", "#6ab8ff"].map((c, i) => k.line(`M${sx + d * 5} ${sy}l${d * 5} ${-2.4 + i * 1.6}`, c, 0.9)).join(""), 2, "#ffffff"));
  },

  // Lantern Lookout: cable knit up the watch cap, a gold moth badge on its
  // cuff, gold thread in the pom; the lantern framed in brass with a little
  // crown on its roof, a hanging ring, and a moth drawn to the flame.
  lumoth(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 15;
    const cable = (cx0: number) => [0, 1, 2, 3].map((i) => k.path(`M${cx0 - 2.6} ${y - 7 - i * 4.2}L${cx0} ${y - 9.4 - i * 4.2}L${cx0 + 2.6} ${y - 7 - i * 4.2}`, "none", "#8e1e28", 1.2)).join("");
    const moth = (mx: number, my: number, s: number) =>
      `<g transform="translate(${mx} ${my}) scale(${s})">` +
      k.path(`M0 0C-3 -4 -8 -4 -8 -1C-8 2 -3 2 0 1Z M0 0C3 -4 8 -4 8 -1C8 2 3 2 0 1Z`, GOLD, GOLD_DARK, 0.6) +
      k.path(`M0 1C-2 2 -5 4 -4 6C-2 6 -1 4 0 2Z M0 1C2 2 5 4 4 6C2 6 1 4 0 2Z`, GOLD_LIGHT, GOLD_DARK, 0.5) +
      k.line(`M0 -2V5`, GOLD_DARK, 1.2) + k.line(`M-0.4 -2Q-2 -5 -3.4 -5.6M0.4 -2Q2 -5 3.4 -5.6`, GOLD_DARK, 0.5) + "</g>";
    let cap = (k.side ? cable(x - k.side * 6) : cable(x - 15) + cable(x + 15) + cable(x)) +
      // Gold yarn flecks in the pom.
      [[-2.6, -29.5], [2.4, -30], [0, -27], [-3, -25], [3, -25.4]].map(([dx, dy]) => k.circle(x + dx, y + dy, 0.9, GOLD, GOLD_DARK, 0.3)).join("");
    if (!k.back) cap += k.side ? scaleAt(0.55, 1, x + k.side * 25, y - 2, moth(x + k.side * 25, y - 2, 0.8)) : moth(x, y - 3, 0.9);
    k.put("flame", cap);
    // The lantern, at its 1.3 scale (see the costume).
    const px = k.back ? k.L - 16 : k.side ? k.C + k.side * 26 : k.R + 16,
      py = k.B - 18;
    const lx = px,
      ly = py - 2;
    k.put("flame", scaleAt(1.3, 1.3, lx, ly,
      k.rect(lx - 7.6, ly - 0.5, 2, 18, 0.8, GOLD, k.ink, 0.5) + k.rect(lx + 5.6, ly - 0.5, 2, 18, 0.8, GOLD, k.ink, 0.5) +
      k.path(`M${lx - 7.5} ${ly}L${lx} ${ly - 5}L${lx + 7.5} ${ly}Z`, GOLD, k.ink, 0.6) +
      k.path(`M${lx - 3} ${ly - 5.5}L${lx - 3} ${ly - 8.5}L${lx - 1.5} ${ly - 6.8}L${lx} ${ly - 9}L${lx + 1.5} ${ly - 6.8}L${lx + 3} ${ly - 8.5}L${lx + 3} ${ly - 5.5}Z`, GOLD, k.ink, 0.5) +
      k.circle(lx, ly - 11, 1.8, "none", GOLD, 1.1) +
      // The moth on the glass, dark against the flame.
      k.path(`M${lx} ${ly + 10}c-1.4 -2 -4 -2.4 -4 -0.6c0 1.6 2.4 1.6 4 0.9Zm0 0c1.4 -2 4 -2.4 4 -0.6c0 1.6 -2.4 1.6 -4 0.9Z`, "#5a3a1a", "none", 0) +
      k.rect(lx - 8.5, ly + 15.5, 17, 4, 1.2, GOLD, k.ink, 0.6) + k.line(`M${lx - 7} ${ly + 17.5}H${lx + 7}`, GOLD_DARK, 0.6)));
  },

  // Ironhull Captain: gold oak leaves on the cap's visor, a gold chin cord
  // between buttons, a laurel round the anchor badge; a brass porthole with
  // bolts and lit glass set in the iron shell plating.
  terradon(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 22;
    const rivet = "#ffcf7a";
    const leaf = (lx: number, ly: number, a: number, s = 1) =>
      `<ellipse cx="${r1(lx)}" cy="${r1(ly)}" rx="${2.4 * s}" ry="${1.1 * s}" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.4" transform="rotate(${a} ${r1(lx)} ${r1(ly)})"/>`;
    let cap = "";
    if (!k.back) {
      const bx = k.side ? x + k.side * 28 : x;
      if (k.side) {
        const f = k.side;
        cap += [0, 1, 2].map((i) => leaf(x + f * (24 + i * 7), y + 4.4 + i * 0.6, f * (8 + i * 4), 0.9)).join("") +
          wire(k, `M${x + f * 6} ${y + 1.5}L${x + f * 24} ${y + 1}`, 1.2) + k.circle(x + f * 5, y + 1.5, 1.8, GOLD, GOLD_DARK, 0.6);
      } else {
        cap += [-1, 1].map((s) => [0, 1, 2].map((i) => leaf(x + s * (6 + i * 7), y + 7.6 - i * 1.2, s * (-10 - i * 8))).join("")).join("") +
          wire(k, `M${x - 30} ${y + 1}Q${x} ${y - 2} ${x + 30} ${y + 1}`, 1.3) + k.circle(x - 30, y + 1, 2, GOLD, GOLD_DARK, 0.6) + k.circle(x + 30, y + 1, 2, GOLD, GOLD_DARK, 0.6);
      }
      // The laurel round the badge.
      const s = k.side ? 0.7 : 1;
      cap += [-1, 1].map((d) => [0, 1, 2].map((i) => leaf(bx + d * (6.4 - i * 0.6) * s, y - 4 + i * 3.4, d * (70 - i * 25), 0.75 * s)).join("")).join("");
    }
    k.put("flame", cap);
    // The porthole: on the shell's back, between the plates in profile.
    const port = (px: number, py: number, r: number) =>
      k.circle(px, py, r + 2, "#8a6a3a", k.ink, 0.8) + k.circle(px, py, r + 1.2, GOLD, GOLD_DARK, 0.6) +
      Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + 0.5;
        return k.circle(px + Math.cos(a) * (r + 1.2), py + Math.sin(a) * (r + 1.2), 0.8, "#5a4a2a", "none", 0);
      }).join("") +
      k.lume("pulse", k.circle(px, py, r, rivet, k.ink, 0.5), 3, rivet) + k.line(`M${px - r * 0.5} ${py - r * 0.1}L${px - r * 0.1} ${py - r * 0.5}`, "#ffffff", 0.9);
    if (k.back) k.put("scarf", port(k.C, k.T + 27, 5));
    else if (k.side) k.put("flame", port(k.C - k.side * 22, k.T + 22, 3.4));
  },

  // Rigging Runner: rope-twist piping on the headband, a monkey's-fist knot
  // at its tie and a brass marlinspike tucked behind it; the grappling hook
  // bound in gold with a coil of rope at its ring and gilded prong tips.
  coilemur(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 12,
      w = 36;
    const twist = (d: string) => k.line(d, "#f4ecd8", 1.6) + `<path d="${d}" fill="none" stroke="#a8823a" stroke-width="1.6" stroke-dasharray="1.2 1.4"/>`;
    // The spike: brass knob, wooden grip, steel point, tucked behind the band.
    const spike = (sx: number, sy: number, d: number) =>
      k.path(`M${sx - 1.8} ${sy - 1}L${sx + d * 20} ${sy - 11}L${sx + 1.8} ${sy + 1.4}Z`, "#8c96a8", k.ink, 0.8) +
      k.line(`M${sx + d * 1} ${sy - 1.4}L${sx + d * 16} ${sy - 9.4}`, "#e8eef6", 0.7) +
      k.rect(sx - 2.6, sy - 1, 5.2, 8.5, 1.8, "#8a5a2a", k.ink, 0.7).replace("<rect", `<rect transform="rotate(${-d * 42} ${sx} ${sy})"`) +
      k.circle(sx, sy, 2.2, GOLD, k.ink, 0.6) + k.circle(sx - d * 5.6, sy + 5.2, 2.4, GOLD, k.ink, 0.6);
    const kx = k.back ? x : k.side ? x - k.side * (w - 2) : x + w - 4;
    // Monkey's fist on the knot: a rope ball, its turns crossing.
    const fist = k.circle(kx, y + 3, 4.4, "#d8b27a", k.ink, 0.8) +
      k.line(`M${kx - 3.4} ${y + 1}Q${kx} ${y - 0.5} ${kx + 3.4} ${y + 1}M${kx - 3.6} ${y + 4.5}Q${kx} ${y + 3} ${kx + 3.6} ${y + 4.5}M${kx - 1} ${y - 0.8}Q${kx - 2.2} ${y + 3} ${kx - 1} ${y + 6.8}M${kx + 1.6} ${y - 0.8}Q${kx + 0.4} ${y + 3} ${kx + 1.6} ${y + 6.8}`, "#8a6a3a", 0.7) +
      k.circle(kx, y + 7.8, 1.4, "none", GOLD, 0.9);
    const pipe = `M${x - w} ${y}Q${x} ${y - 9} ${x + w} ${y}`;
    const pipe2 = `M${x - w + 1} ${y + 7}Q${x} ${y - 2} ${x + w - 1} ${y + 7}`;
    const tucked = k.side ? profile(k, x, spike(x - 28, y + 3, -1)) : turn(k, x, spike(x - 30, y + 3, -1));
    k.put("flame", tucked);
    k.put("flame", twist(pipe) + twist(pipe2) + fist);
    // The grappling hook.
    const hx = k.back ? k.L - 8 : k.side ? k.C - k.side * 9 : k.R + 8,
      hy = k.B - 4;
    k.put("flame",
      [-9, -5.5, -2].map((o) => k.line(`M${hx - 1.6} ${hy + o + 1}L${hx + 1.6} ${hy + o - 1}`, GOLD, 1.3)).join("") +
      k.path(`M${hx - 1.4} ${hy + 4}L${hx} ${hy + 10}L${hx + 1.4} ${hy + 4}Z`, "#c9d0da", k.ink, 0.6) +
      k.path(`M${hx - 9} ${hy - 3}L${hx - 7} ${hy - 0.5}L${hx - 5.6} ${hy - 2.4}Z M${hx + 9} ${hy - 3}L${hx + 7} ${hy - 0.5}L${hx + 5.6} ${hy - 2.4}Z`, GOLD, k.ink, 0.5) +
      // A coil of rope tied to its ring.
      k.path(`M${hx} ${hy - 15}Q${hx - 6} ${hy - 20} ${hx - 9} ${hy - 14}Q${hx - 11} ${hy - 6} ${hx - 6} ${hy - 7}`, "none", "#8a6a3a", 2.6) +
      k.path(`M${hx} ${hy - 15}Q${hx - 6} ${hy - 20} ${hx - 9} ${hy - 14}Q${hx - 11} ${hy - 6} ${hx - 6} ${hy - 7}`, "none", "#d8b27a", 1.6) +
      k.circle(hx, hy - 13, 2.6, "none", GOLD, 1.3));
  },

  // Spice Raider: a gold aigrette round the ruby with pearl drops, strands of
  // pearl and gold swagged across the turban, a peacock eye at the plume's
  // tip; the spice pouches tied with gold cords and tassels, embroidered.
  pyranda(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 17;
    const ruby = "#ff4a5a";
    // The peacock eye at the plume's tip.
    const eye = turn(k, x, profile(k, x,
      `<ellipse cx="${x + 17}" cy="${y - 36}" rx="4.6" ry="3.2" fill="#2f7ac0" stroke="${k.ink}" stroke-width="0.6" transform="rotate(-40 ${x + 17} ${y - 36})"/>` +
      `<ellipse cx="${x + 17.4}" cy="${y - 36.4}" rx="2.6" ry="1.8" fill="#1a2f6a" stroke="${GOLD}" stroke-width="0.8" transform="rotate(-40 ${x + 17.4} ${y - 36.4})"/>` +
      k.line(`M${x + 6} ${y - 16}L${x + 10} ${y - 24}M${x + 9} ${y - 18}L${x + 14} ${y - 26}`, "#1f8a7e", 0.7)));
    let svg = eye;
    if (!k.back) {
      const rx = k.side ? x + k.side * 30 : x,
        ry = y - 10;
      const sw = (d: number) => beads(k, [rx + d * 5, ry + 1], [rx + d * 18, ry + 8], [rx + d * 31, ry - 4], 9, 1.15, [PEARL, GOLD]);
      // Swags on both sides from the front; toward the back in profile.
      svg += (k.side ? sw(-k.side) : sw(-1) + sw(1)) +
        // The aigrette: a gold drop-shaped setting round the ruby, a spray above.
        k.path(`M${rx} ${ry - 9}Q${rx + 6.5} ${ry - 3} ${rx + 5.6} ${ry + 2}Q${rx} ${ry + 7} ${rx - 5.6} ${ry + 2}Q${rx - 6.5} ${ry - 3} ${rx} ${ry - 9}Z`, GOLD, GOLD_DARK, 0.8) +
        k.path(`M${rx} ${ry - 9}L${rx - 2.6} ${ry - 13.5}M${rx} ${ry - 9}L${rx} ${ry - 15}M${rx} ${ry - 9}L${rx + 2.6} ${ry - 13.5}`, "none", GOLD, 1.1) +
        [-2.6, 0, 2.6].map((dx, i) => k.circle(rx + dx, ry - 13.5 - (i === 1 ? 1.5 : 0), 1.1, PEARL, k.ink, 0.4)).join("") +
        k.circle(rx, ry - 1.5, 3.4, "#7a1a24", "none", 0) + k.lume("pulse", k.circle(rx, ry - 1.5, 2.8, ruby, "none", 0), 0, ruby) +
        k.path(`M${rx - 1.6} ${ry - 2.4}Q${rx - 1} ${ry - 3.8} ${rx + 0.4} ${ry - 3.6}`, "none", "#ffffffcc", 0.9) +
        [-3, 0, 3].map((dx) => k.line(`M${rx + dx} ${ry + 4}V${ry + 6.5}`, GOLD, 0.6) + k.circle(rx + dx, ry + 7.6, 1.2, PEARL, k.ink, 0.4)).join("") +
        glint(k, rx + 3.4, ry - 5, 1.8, 6);
    }
    k.put("flame", svg);
    if (!k.back) {
      const c = cx(k);
      const xs = k.side ? [c - k.side * 2, c + k.side * 8] : [c - 16, c + 13];
      k.put("flame", xs.map((px) =>
        k.path(`M${px - 3} ${k.B - 1}l3 -2.6l3 2.6l-3 2.6Z`, GOLD, GOLD_DARK, 0.5) + k.circle(px, k.B + 3.2, 0.9, GOLD_LIGHT, "none", 0) +
        k.line(`M${px - 4} ${k.B - 7}H${px + 4}`, GOLD, 1.3) + k.circle(px + 3.6, k.B - 7, 1.3, GOLD, GOLD_DARK, 0.4) +
        k.line(`M${px + 3.4} ${k.B - 6}l-0.8 5M${px + 4.2} ${k.B - 6}l0.6 5`, GOLD, 0.8)).join(""));
    }
  },

  // Frost Privateer: a crest of ice shards rising behind the cockade, icicles
  // hanging off the brim's corners, and the crystal cockade set in a silver
  // ring of seed pearls.
  glacelle(k) {
    const y = k.ht + 14,
      w = k.side ? 30 : 38;
    const x = k.hx + k.side * 3;
    const h = w * 0.62;
    const ice = "#d8f4ff",
      deep = "#8fd0ec",
      crystal = "#bff4ff";
    const shard = (sx: number, sy: number, len: number, a: number, wd = 4) =>
      `<g transform="rotate(${a} ${sx} ${sy})">` + k.path(`M${sx - wd} ${sy}L${sx - wd * 0.6} ${sy - len * 0.7}L${sx} ${sy - len}L${sx + wd * 0.6} ${sy - len * 0.7}L${sx + wd} ${sy}Z`, ice, k.ink, 0.7) +
      k.path(`M${sx} ${sy}L${sx} ${sy - len}L${sx + wd * 0.6} ${sy - len * 0.7}L${sx + wd} ${sy}Z`, deep, "none", 0) + "</g>";
    // The crest stands behind the crown.
    const crest = k.side
      ? profile(k, x, shard(x + 8, y - 26, 20, 14) + shard(x, y - 30, 24, -4, 4.6) + shard(x - 10, y - 26, 16, -22))
      : shard(x - 13, y - 26, 16, -24) + shard(x + 13, y - 26, 16, 24) + shard(x - 6, y - 30, 21, -9) + shard(x + 6, y - 30, 21, 9) + shard(x, y - 32, 25, 0, 4.6);
    k.put("flame", crest + (k.back ? "" : k.lume("twinkle", k.path(k.star(x + (k.side ? k.side * 2 : 0), y - 54, 2.6, 4, 0.3), "#ffffff", "none", 0), 6, crystal)), true);
    // Icicles off the brim corners.
    const icicle = (ix: number, iy: number, len: number) => k.path(`M${ix - 2.2} ${iy - 1}L${ix} ${iy + len}L${ix + 2.2} ${iy - 1}Z`, "#b4e6ff", k.ink, 0.6) + k.line(`M${ix + 0.6} ${iy}L${ix + 0.2} ${iy + len * 0.6}`, "#ffffff", 0.6);
    let brim: string;
    if (k.side) {
      brim = profile(k, x, [[-44, -26, 8], [-36, -20, 5]].map(([dx, dy, l]) => icicle(x + dx, y + dy + 4, l)).join(""));
    } else {
      const edge = (t: number, s: number) => bez([x + s * w, y - h * 0.7], [x + s * w * 0.55, y + 2], [x, y + 8], t);
      brim = [-1, 1].map((s) => [[0.04, 8], [0.15, 5]].map(([t, l]) => {
        const [ix, iy] = edge(t, s);
        return icicle(ix, iy, l);
      }).join("")).join("");
    }
    let cock = "";
    if (!k.back) {
      const [ccx, ccy] = k.side ? [x + k.side * w * 0.55, y - h * 0.55] : [x, y - h * 0.28];
      const ring = Array.from({ length: 8 }, (_, i) => {
        const a = (i / 8) * Math.PI * 2;
        return k.circle(ccx + Math.cos(a) * 7.2, ccy + Math.sin(a) * 7.2, 1.2, PEARL, k.ink, 0.35);
      }).join("");
      cock = (k.side ? scaleAt(0.6, 1, ccx, ccy, `<circle cx="${ccx}" cy="${ccy}" r="7.2" fill="#2f5f8f" stroke="#e8f6ff" stroke-width="1.4"/>` + ring) : `<circle cx="${ccx}" cy="${ccy}" r="7.2" fill="#2f5f8f" stroke="#e8f6ff" stroke-width="1.4"/>` + ring) +
        k.lume("pulse", k.line([0, 60, 120].map((a) => {
          const dx = Math.cos((a * Math.PI) / 180) * 5,
            dy = Math.sin((a * Math.PI) / 180) * 5;
          return `M${r1(ccx - dx)} ${r1(ccy - dy)}L${r1(ccx + dx)} ${r1(ccy + dy)}`;
        }).join(""), crystal, 1.8) + k.circle(ccx, ccy, 1.6, "#ffffff", "none", 0), 0, crystal);
    }
    k.put("flame", brim + cock);
  },

  // Crow's Nest Ace: gold aviator wings on the cap, the goggles' brass rims
  // riveted with a glint sweeping each lens, the strap stitched; the
  // spyglass wrapped in stitched leather, a lens cap on a chain and a crow's
  // feather tied to it.
  halcyra(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 16;
    const wings = (wx: number, wy: number, s: number) =>
      `<g transform="translate(${wx} ${wy}) scale(${s} 1)">` +
      k.path(`M-2.5 0C-6 -3 -12 -4.5 -16 -3.5C-13 -2 -12 -1 -11 0C-13 0 -14 1 -14.5 2C-10 2.6 -5.5 2.6 -2.5 1.5Z`, GOLD, GOLD_DARK, 0.6) +
      k.path(`M2.5 0C6 -3 12 -4.5 16 -3.5C13 -2 12 -1 11 0C13 0 14 1 14.5 2C10 2.6 5.5 2.6 2.5 1.5Z`, GOLD, GOLD_DARK, 0.6) +
      k.line(`M-5 -0.5L-12 -2.4M5 -0.5L12 -2.4`, GOLD_DARK, 0.5) + "</g>" + gem(k, wx, wy + 0.4, 1.9, "#c8323a");
    let cap = `<path d="M${x - 36} ${y - 3.6}Q${x} ${y - 11.6} ${x + 36} ${y - 3.6}" fill="none" stroke="#e8dcc4" stroke-width="0.7" stroke-dasharray="1.4 1.2"/>`;
    if (!k.back) {
      if (k.side) {
        const gx = x + k.side * 20,
          gy = y - 8;
        cap += scaleAt(0.55, 1, x + k.side * 6, y - 23, wings(x + k.side * 6, y - 23, 1)) +
          `<circle cx="${gx}" cy="${gy}" r="7.5" fill="none" stroke="${GOLD}" stroke-width="1.2"/>` +
          [0, 1, 2, 3].map((i) => k.circle(gx + Math.cos(i * 1.57 + 0.78) * 6.6, gy + Math.sin(i * 1.57 + 0.78) * 6.6, 0.7, "#5a3a1a", "none", 0)).join("") +
          k.lume("twinkle", k.line(`M${gx - 2.6} ${gy + 1}L${gx + 1} ${gy - 2.6}`, "#ffffff", 1.4), 4, "#ffffff");
      } else {
        cap += wings(x, y - 23, 1) +
          [-13, 13].map((dx, j) => {
            const gx = x + dx,
              gy = y - 9;
            return `<circle cx="${gx}" cy="${gy}" r="8" fill="none" stroke="${GOLD}" stroke-width="1.2"/>` +
              [0, 1, 2, 3].map((i) => k.circle(gx + Math.cos(i * 1.57 + 0.78) * 7, gy + Math.sin(i * 1.57 + 0.78) * 7, 0.75, "#5a3a1a", "none", 0)).join("") +
              k.lume("twinkle", k.line(`M${gx - 2.8} ${gy + 1}L${gx + 1} ${gy - 2.8}`, "#ffffff", 1.4), 4 + j, "#ffffff");
          }).join("");
      }
    }
    k.put("flame", cap);
    // The spyglass at its right hip.
    const d = k.back ? 1 : k.side ? k.side : -1;
    const sx = k.back ? k.R + 14 : k.side ? k.C + k.side * 8 : k.L - 14,
      sy = k.B - 4;
    const x0 = Math.min(sx - d * 4, sx - d * 18);
    k.put("flame",
      k.rect(x0, sy - 3.3, 14, 6.6, 1.4, "#5a321a", k.ink, 0.6) +
      `<path d="M${x0 + 1} ${sy - 1.8}H${x0 + 13}M${x0 + 1} ${sy + 1.8}H${x0 + 13}" fill="none" stroke="#e8dcc4" stroke-width="0.6" stroke-dasharray="1.2 1"/>` +
      k.rect(sx - d * 3 - 1, sy - 3.4, 2, 6.8, 0.6, GOLD, GOLD_DARK, 0.5) +
      // The lens cap swinging on its chain under the lens.
      `<path d="M${sx - d * 2} ${sy + 3}Q${sx + d * 1} ${sy + 8} ${sx + d * 3} ${sy + 8}" fill="none" stroke="${GOLD}" stroke-width="0.9" stroke-dasharray="1 0.7"/>` +
      k.rect(sx + d * 3 - 1.4, sy + 7, 2.8, 4.6, 1, "#8a5a2a", k.ink, 0.5) +
      // A crow feather tied at the eyepiece.
      k.line(`M${sx - d * 22} ${sy + 2}l0 3`, "#c8b48a", 0.8) +
      k.path(`M${sx - d * 22} ${sy + 4.6}Q${sx - d * 25} ${sy + 9} ${sx - d * 24} ${sy + 15}Q${sx - d * 21} ${sy + 9} ${sx - d * 22} ${sy + 4.6}Z`, "#1e2230", k.ink, 0.5) +
      k.line(`M${sx - d * 22} ${sy + 5}Q${sx - d * 23.2} ${sy + 9} ${sx - d * 23.6} ${sy + 14}`, "#5a6a8a", 0.5));
  },

  // Moonsail Bosun: navy ribbons with gold tips streaming from the sailor's
  // cap, a gold rim on its brim, stars round the moon pin; the bosun's call
  // made a real one in gold, its pipe, buoy and keel, on a gold chain.
  astrabun(k) {
    const navy = "#1f2f5c";
    const x = k.side ? k.hx - k.side * 2 : k.hx + (k.back ? -10 : 10),
      y = k.ht + 14;
    const tilt = k.side ? 0 : k.back ? -12 : 12;
    // The ribbons fall from the back of the cap: to the side away from its
    // tip from the front, behind it in profile, down the middle from behind.
    const ribbons = (rx: number, ry: number, d: number, down: number) =>
      [0, 1].map((i) => {
        const ex = rx + d * (10 + i * 5),
          ey = ry + down - i * 3;
        return k.path(`M${rx} ${ry}Q${rx + d * (4 + i * 3)} ${ry + down * 0.5} ${ex} ${ey}L${ex + d * 1.5} ${ey - 3.5}Q${rx + d * (6 + i * 3)} ${ry + down * 0.3} ${rx + d * 2} ${ry - 2}Z`, navy, k.ink, 0.6) +
          k.path(`M${ex} ${ey}L${ex + d * 1.5} ${ey - 3.5}L${ex + d * 3.6} ${ey + 0.4}Z`, GOLD, k.ink, 0.5);
      }).join("");
    const tails = k.back ? ribbons(x - 4, y + 2, -1, 14) + ribbons(x + 4, y + 2, 1, 12) : k.side ? ribbons(x - k.side * 16, y, -k.side, 12) : ribbons(x - 16, y + 1, -1, 9);
    k.put("flame", rot(tilt, x, y, tails), true);
    let cap = k.line(`M${x - 21} ${y + 1.6}Q${x} ${y + 7.4} ${x + 21} ${y + 1.6}`, GOLD, 1.2);
    if (!k.back) {
      const mx = x + k.side * 12 + 2,
        my = y - 3.5;
      cap += [[-6, -5, 1.8, 3], [7, -6, 1.5, 4], [5, 3.5, 1.2, 5]].map(([dx, dy, r, i]) => k.lume("twinkle", k.path(k.star(mx + dx, my + dy, r + 0.6, 4, 0.35), "#fff3c4", GOLD_DARK, 0.3), i, "#fff3c4")).join("");
    }
    k.put("flame", rot(tilt, x, y, cap));
    // The bosun's call.
    if (!k.back) {
      const c = cx(k);
      const wx = k.side ? c + k.side * 4 : c + 11,
        wy = k.T + 16;
      const s = k.side ? k.side : 1;
      k.put("body",
        `<path d="M${c - (k.side ? 0 : 6)} ${k.T + 2}Q${wx} ${k.T + 10} ${wx} ${wy}" fill="none" stroke="${GOLD}" stroke-width="1" stroke-dasharray="1.1 0.7"/>` +
        `<g transform="translate(${wx} ${wy}) scale(${s} 1)">` +
        k.path(`M1.2 10.5L4.6 6.4L3.2 3.6L-0.6 7Z`, GOLD, GOLD_DARK, 0.5) +
        k.path(`M-1.6 9Q-2.2 3.6 0.6 -0.6L2.4 0.4Q0.2 4.2 1.4 9Z`, GOLD, k.ink, 0.6) +
        k.circle(4.4, 6.8, 0.9, "none", GOLD_DARK, 0.6) +
        k.lume("pulse", k.circle(0, 10.6, 2.8, GOLD_LIGHT, GOLD_DARK, 0.6) + k.path(k.star(0, 10.6, 1.4, 4, 0.4), GOLD_DARK, "none", 0), 0, "#ffe08a") + "</g>");
    }
  },

  // Anchor Warden: a navy cord round the sou'wester tied at a gold shackle,
  // a gold anchor badge on its crown and stitching rows on its brim; the anchor's shank bound in
  // rope, its flukes and stock tipped in gold.
  wombolder(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 7;
    const rope = "#d8b27a",
      cord = "#1f2a48",
      stitch = "#b07a1e";
    // A navy cord round the crown, its twist picked out in light.
    const band = `M${x - 35} ${y - 4}Q${x} ${y - 13} ${x + 35} ${y - 4}`;
    let hat = k.line(band, k.ink, 5) + k.line(band, cord, 3.8) + `<path d="${band}" fill="none" stroke="#5a7ab8" stroke-width="3.8" stroke-dasharray="1.1 1.9"/>`;
    // The warden's badge: a gold anchor in a ring on the crown.
    const badge = (bx: number, by: number) =>
      k.circle(bx, by, 5.4, cord, GOLD, 1.3) + k.line(`M${bx} ${by - 3}V${by + 3}M${bx - 2} ${by - 1.6}H${bx + 2}`, GOLD, 1.1) +
      k.path(`M${bx - 3} ${by + 0.8}Q${bx} ${by + 4.4} ${bx + 3} ${by + 0.8}`, "none", GOLD, 1.1) + glint(k, bx + 3, by - 3.6, 1.6, 5);
    const shackle = (sx: number, sy: number) => k.circle(sx, sy - 2.8, 2.8, "none", GOLD, 1.5) + k.circle(sx, sy, 1.3, GOLD, GOLD_DARK, 0.4);
    if (k.side) {
      const f = k.side;
      hat += [0, 4].map((o) => `<path d="M${x + f * (30 - o)} ${y - 0.6 + o * 0.5}Q${x} ${y + 3.6 + o} ${x - f * (44 - o)} ${y + 9 + o * 0.2}" fill="none" stroke="${stitch}" stroke-width="1" stroke-dasharray="1.8 1.2"/>`).join("") +
        shackle(x - f * 22, y - 4.6) + scaleAt(0.7, 1, x + f * 18, y - 16, badge(x + f * 18, y - 16));
    } else {
      const rx = k.back ? 50 : 46,
        ry = k.back ? 7.6 : 5.2;
      hat += [0, 5].map((o) => `<ellipse cx="${x}" cy="${y}" rx="${rx - o}" ry="${ry - o * 0.25}" fill="none" stroke="${stitch}" stroke-width="1" stroke-dasharray="1.8 1.2"/>`).join("") +
        (k.back ? shackle(x, y - 7.2) : badge(x, y - 16) + shackle(x + 26, y - 4.6));
    }
    k.put("flame", hat);
    // The anchor, worked up wherever it shows (front: its ring above the
    // shoulder, the rest behind the body).
    const work = (x0: number, y0: number, x1: number, y1: number, full: boolean) => {
      const ang = Math.atan2(y1 - y0, x1 - x0),
        px = -Math.sin(ang),
        py = Math.cos(ang);
      const at = (t: number, o = 0): P => [x0 + (x1 - x0) * t + px * o, y0 + (y1 - y0) * t + py * o];
      const [ax, ay] = at(0.15);
      let svg = [0.22, 0.27, 0.32].map((t) => {
        const [a, b] = [at(t, -2.6), at(t + 0.035, 2.6)];
        return k.line(`M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`, k.ink, 2.4) + k.line(`M${r1(a[0])} ${r1(a[1])}L${r1(b[0])} ${r1(b[1])}`, rope, 1.5);
      }).join("") +
        k.circle(ax + px * 9.5, ay + py * 9.5, 2.2, GOLD, GOLD_DARK, 0.6) + k.circle(ax - px * 9.5, ay - py * 9.5, 2.2, GOLD, GOLD_DARK, 0.6);
      if (full) {
        const fl = (s: number) => {
          const fx = x1 + px * 14 * s,
            fy = y1 + py * 14 * s - 6;
          return k.path(`M${r1(fx)} ${r1(fy - 3.4)}L${r1(fx + 3)} ${r1(fy + 1)}L${r1(fx)} ${r1(fy + 3.4)}L${r1(fx - 3)} ${r1(fy + 1)}Z`, GOLD, k.ink, 0.6);
        };
        svg += fl(1) + fl(-1);
      }
      return svg;
    };
    if (k.back) k.put("scarf", work(k.R + 4, k.T - 16, k.L + 12, k.B + 2, true));
    else if (k.side) k.put("body", work(k.C - k.side * 34, k.T - 8, k.C - k.side * 14, k.B + 6, true));
  },

  // Jungle Corsair: the hibiscus over a split monstera leaf with a second
  // bloom and a jade bead on its knot, a jade-and-gold ornament on the brow;
  // the machete with a gold guard, a wrapped grip and a vine etched on the
  // blade; the firefly jar tied with twine under a gold lid band.
  pangrove(k) {
    const bx = k.hx + k.side * 2,
      by = k.ht + 11;
    const kx = k.back ? bx : k.side ? bx - k.side * 34 : bx + 33;
    const leafC = "#3f9a4a";
    const d = k.back ? 1 : k.side ? -k.side : 1;
    const monstera = k.path(`M${kx} ${by - 2}Q${kx + d * 6} ${by - 16} ${kx + d * 16} ${by - 14}Q${kx + d * 18} ${by - 4} ${kx} ${by - 2}Z`, leafC, k.ink, 0.6) +
      k.line(`M${kx + d * 3} ${by - 6}l${d * 6} -3M${kx + d * 6} ${by - 3}l${d * 7} -1`, "#1f5a2a", 0.9) +
      k.line(`M${kx} ${by - 2}Q${kx + d * 8} ${by - 8} ${kx + d * 15} ${by - 13}`, "#7fce6a", 0.6);
    const bloom = (fx: number, fy: number, r: number, c: string) =>
      Array.from({ length: 5 }, (_, j) => {
        const a = (j / 5) * Math.PI * 2;
        return k.circle(fx + Math.cos(a) * r, fy + Math.sin(a) * r, r1(r * 0.9), c, k.ink, 0.5);
      }).join("") + k.circle(fx, fy, r1(r * 0.48), "#ffd65b", "none", 0);
    const hib = Array.from({ length: 5 }, (_, j) => {
      const a = (j / 5) * Math.PI * 2;
      return k.circle(kx + Math.cos(a) * 3.4, by - 2 + Math.sin(a) * 3.4, 3, "#ff5a8a", k.ink, 0.5);
    }).join("") + k.circle(kx, by - 2, 1.6, "#ffd65b", "none", 0) +
      k.line(`M${kx} ${by - 2}l${d * 4} -5`, "#ffd65b", 0.8) + k.circle(kx + d * 4.4, by - 7.4, 1, "#ff3a3a", "none", 0);
    let head = monstera + bloom(kx - d * 5, by + 3.5, 2.2, "#ff9a3a") + hib +
      k.line(`M${kx + d * 2} ${by + 8}V${by + 12}`, "#8a6a3a", 0.7) + gem(k, kx + d * 2, by + 13.6, 1.5, "#2fbf7a");
    if (!k.back) {
      const ox = k.side ? bx + k.side * 26 : bx,
        oy = k.side ? by + 3.4 : by;
      head += k.side ? scaleAt(0.65, 1, ox, oy, gem(k, ox, oy, 2.4, "#2fbf7a")) : gem(k, ox, oy, 2.6, "#2fbf7a") + k.path(`M${ox - 7} ${oy + 1.6}L${ox - 4} ${oy}L${ox - 7} ${oy - 1.6}Z M${ox + 7} ${oy + 1.6}L${ox + 4} ${oy}L${ox + 7} ${oy - 1.6}Z`, GOLD, GOLD_DARK, 0.4) + glint(k, ox + 2, oy - 2.6, 1.6, 5);
    }
    k.put("flame", head);
    // The machete and the jar.
    const mx = k.back ? k.R + 6 : k.side ? k.C - k.side * 4 : k.L - 6,
      jx = k.back ? k.L - 8 : k.side ? k.C - k.side * 14 : k.R + 8,
      y = k.B - 6;
    const md = k.back ? 1 : k.side ? -k.side : -1;
    k.put("flame",
      [-8, -5.5, -3].map((o) => k.line(`M${mx - 2} ${y + o + 0.8}L${mx + 2} ${y + o - 0.8}`, "#c8a26a", 0.9)).join("") +
      k.circle(mx, y - 10.8, 1.8, GOLD, GOLD_DARK, 0.6) +
      k.rect(mx - 4.5, y - 2, 9, 2.4, 1, GOLD, GOLD_DARK, 0.6) +
      k.path(`M${mx + md * 0.5} ${y + 2}Q${mx + md * 4.5} ${y + 8} ${mx + md * 3} ${y + 14}`, "none", "#3f8a4a", 0.7) +
      k.circle(mx + md * 2.6, y + 6, 0.8, "#5fae4a", "none", 0) + k.circle(mx + md * 3.8, y + 10.5, 0.8, "#5fae4a", "none", 0) +
      glint(k, mx + md * 5, y + 9, 1.6, 6));
    k.put("flame",
      k.rect(jx - 4.6, y - 5.6, 9.2, 1.6, 0.6, GOLD, GOLD_DARK, 0.4) +
      k.line(`M${jx - 4.6} ${y - 3}H${jx + 4.6}`, "#c8a26a", 1.1) + k.path(`M${jx + 4} ${y - 3}l3 4l-1.4 0.4Z`, "#c8a26a", k.ink, 0.4) +
      k.path(`M${jx + 6.2} ${y + 1}q2.6 1 1.6 4q-2.6 -1 -1.6 -4Z`, "#5fae4a", k.ink, 0.4));
  },

  // Hammock Pirate: a sleep mask pushed up on the stocking cap, gold-stitched
  // closed eyes and a crescent moon on it; gold stars on the cap's tail and
  // gold thread in the pom; the hammock's ends lashed and fitted with rings.
  mossloth(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    const d = k.back ? -1 : k.side ? -k.side : 1;
    const maskC = "#2a3566";
    const strap = `M${x - 36} ${y - 12}Q${x} ${y - 25} ${x + 36} ${y - 12}`;
    let cap = k.line(strap, k.ink, 3.4) + k.line(strap, maskC, 2.2) +
      // Stars on the tail.
      [[18, -30, 2.4], [34, -22, 2]].map(([dx, dy, r]) => k.path(k.star(x + d * dx, y + dy, r, 5, 0.45), GOLD, GOLD_DARK, 0.4)).join("") +
      k.line(`M${x + d * 43} ${y + 2}Q${x + d * 47} ${y + 5} ${x + d * 51} ${y + 3}M${x + d * 44} ${y + 8}Q${x + d * 47} ${y + 6} ${x + d * 50} ${y + 9}`, GOLD, 0.9);
    if (!k.back) {
      const lids = (ex: number, ey: number, s = 1) =>
        k.path(`M${ex - 4 * s} ${ey}Q${ex} ${ey + 3} ${ex + 4 * s} ${ey}`, "none", GOLD, 1.1) +
        k.line(`M${ex - 2.6 * s} ${ey + 1.4}l-0.8 1.6M${ex} ${ey + 2.2}v1.8M${ex + 2.6 * s} ${ey + 1.4}l0.8 1.6`, GOLD, 0.6);
      if (k.side) {
        const mx = x + k.side * 24,
          my = y - 15;
        cap += k.path(`M${mx - 7} ${my - 4}Q${mx} ${my - 7} ${mx + 7} ${my - 3}Q${mx + 8} ${my + 4} ${mx + 3} ${my + 5}Q${mx - 3} ${my + 4} ${mx - 7} ${my + 4}Z`, maskC, k.ink, 0.8) + lids(mx + k.side * 1.5, my - 1, 0.8);
      } else {
        const my = y - 16;
        cap += k.path(`M${x - 19} ${my - 2}Q${x} ${my - 8} ${x + 19} ${my - 2}Q${x + 21} ${my + 5} ${x + 13} ${my + 6}Q${x + 5} ${my + 6} ${x} ${my + 3}Q${x - 5} ${my + 6} ${x - 13} ${my + 6}Q${x - 21} ${my + 5} ${x - 19} ${my - 2}Z`, maskC, k.ink, 0.9) +
          lids(x - 9, my - 0.5) + lids(x + 9, my - 0.5) +
          k.lume("twinkle", k.path(`M${x + 1.6} ${my - 5}A3 3 0 1 0 ${x + 1.6} ${my + 0.4}A2.3 2.3 0 1 1 ${x + 1.6} ${my - 5}Z`, "#fff3c4", GOLD_DARK, 0.4), 2, "#fff3c4");
      }
    }
    k.put("flame", cap);
    // The hammock's lashed ends with their rings.
    const lash = (lx: number, ly: number) =>
      k.line(`M${lx} ${ly - 6}V${ly + 6}`, k.ink, 3) + k.line(`M${lx} ${ly - 6}V${ly + 6}`, "#c8a26a", 2) +
      `<path d="M${lx} ${ly - 6}V${ly + 6}" fill="none" stroke="#7a5a3a" stroke-width="2" stroke-dasharray="1 1.4"/>`;
    const ring = (rx: number, ry: number) => k.circle(rx, ry, 2.8, "none", k.ink, 2.4) + k.circle(rx, ry, 2.8, "none", GOLD, 1.4);
    if (k.back) k.put("scarf", lash(k.L - 6, k.T + 4) + lash(k.R + 6, k.T + 4) + ring(k.L - 15, k.T + 4) + ring(k.R + 15, k.T + 4));
    else if (k.side) k.put("body", lash(k.C - k.side * 16, k.T + 4) + ring(k.C - k.side * 31, k.T + 4));
    else k.put("body", ring(k.L - 19, k.T - 2) + ring(k.R + 19, k.T - 2) + lash(k.L - 12, k.T - 2) + lash(k.R + 12, k.T - 2));
  },
};

/**
 * The Moonsail Bosun's mallet becomes a little mast (the handle,
 * recoloured in pirate-art.ts) flying its moonsail: a canvas sail bellied
 * by the wind with a gold crescent on it, a yard across its head and a
 * navy pennant streaming from the masthead.
 */
const ownSail = DETAILS.astrabun;
DETAILS.astrabun = (k) => {
  ownSail?.(k);
  const { x, y } = malletHead(k);
  const d = k.side ? -k.side : 1;
  // Kept within the arm's crop: the masthead stays below the head's top.
  const top = y - 20,
    foot = y + 17;
  k.put("armR", k.line(`M${x} ${foot + 2}V${top - 6}`, "#6a4424", 3) + k.circle(x, top - 7, 2.2, GOLD, GOLD_DARK, 0.6) +
    k.path(`M${x} ${top - 6}l${-d * 14} -4l${d * 4} 5l${-d * 4} 5Z`, "#24345e", k.ink, 0.6) +
    k.line(`M${x - 20} ${top}H${x + 20}`, "#6a4424", 2.4) +
    // Both edges belly the same way, with the wind.
    k.path(`M${x - 19} ${top + 1}Q${x - 19 + 7 * d} ${y - 6} ${x - 19} ${foot}H${x + 19}Q${x + 19 + 7 * d} ${y - 6} ${x + 19} ${top + 1}Z`, "#f4ecd8", k.ink, 1) +
    k.line(`M${x - 19} ${top + 10}Q${x} ${top + 13} ${x + 19} ${top + 10}M${x - 19} ${foot - 9}Q${x} ${foot - 6} ${x + 19} ${foot - 9}`, "#d8ccb0", 0.8) +
    k.lume("pulse", k.path(`M${x + 4} ${y - 9}A9.5 9.5 0 1 0 ${x + 4} ${y + 10}A7.4 7.4 0 1 1 ${x + 4} ${y - 9}Z`, GOLD, GOLD_DARK, 0.7), 4, "#fff3b0"));
};

/**
 * Held pieces re-forged for the crew (their own taken off, SkinArt.heldOff
 * in pirate-art.ts): the Tide Admiral's fin-blade becomes a cutlass with a
 * gold basket hilt, the Spice Raider's chestnut a round bomb with a lit
 * fuse, and the Ghost Ship Wisp's lantern a brass ship's lantern with a
 * ghost-green flame.
 */
const ownCutlass = DETAILS.tidefin;
DETAILS.tidefin = (k) => {
  ownCutlass?.(k);
  if (k.back) return;
  const { hx, hy, tx, ty } = bladeLine(k);
  const len = Math.hypot(tx - hx, ty - hy),
    ux = (tx - hx) / len,
    uy = (ty - hy) / len,
    nx = -uy,
    ny = ux;
  /** A point along the blade (t from the hilt) and across it (w). */
  const P = (t: number, w = 0) => `${(hx + ux * t + nx * w).toFixed(1)} ${(hy + uy * t + ny * w).toFixed(1)}`;
  const curve = 6 * (k.side < 0 ? -1 : 1);
  k.put("armR", k.path(`M${P(-7, -2.2)}L${P(5, -2.2)}L${P(5, 2.2)}L${P(-7, 2.2)}Z`, "#24345e", k.ink, 0.8) +
    k.circle(Number(P(-8).split(" ")[0]), Number(P(-8).split(" ")[1]), 2.4, GOLD, GOLD_DARK, 0.6) +
    k.path(`M${P(5, -7)}Q${P(-2, -9)} ${P(-7, -3)}`, "none", GOLD, 2.2) +
    k.path(`M${P(4, -6)}L${P(7, -6)}L${P(7, 6)}L${P(4, 6)}Z`, GOLD, GOLD_DARK, 0.7) +
    k.path(`M${P(7, -3)}Q${P(len * 0.55, -3 + curve)} ${P(len + 3, curve * 0.8)}Q${P(len * 0.5, 3 + curve)} ${P(7, 3)}Z`, "#dfe6ee", k.ink, 0.9) +
    k.line(`M${P(9, -0.6)}Q${P(len * 0.5, -0.6 + curve * 0.8)} ${P(len - 4, curve * 0.6)}`, "#9aa6b4", 0.9) +
    k.lume("twinkle", k.path(k.star(Number(P(len * 0.6, curve * 0.5).split(" ")[0]), Number(P(len * 0.6, curve * 0.5).split(" ")[1]), 2, 4, 0.3), "#ffffff", "none", 0), 6, "#ffffff"));
};
const ownBomb = DETAILS.pyranda;
DETAILS.pyranda = (k) => {
  ownBomb?.(k);
  if (k.back || k.side) return;
  const { x, y } = CHESTNUT;
  k.put("armR", k.circle(x, y + 1, 10, "#2a2a32", k.ink, 1) + k.path(`M${x - 9.6} ${y + 1}Q${x} ${y + 5} ${x + 9.6} ${y + 1}`, "none", GOLD, 1.6) +
    k.circle(x + 0.5, y + 3.6, 1.6, "#c8202e", "none", 0) + k.circle(x - 4, y - 3, 2, "#ffffff", "none", 0) +
    k.rect(x - 2.6, y - 12, 5.2, 4, 1, "#5a5a66", k.ink, 0.6) +
    k.path(`M${x} ${y - 12}Q${x + 3} ${y - 16} ${x + 1} ${y - 19}`, "none", "#c8a070", 1.2) +
    k.lume("pulse", k.path(k.star(x + 1, y - 20, 3.4, 6, 0.4), "#ffd27a", "#ff8a2a", 0.5), 3, "#ffb347"));
};
const ownShipLantern = DETAILS.duskveil;
DETAILS.duskveil = (k) => {
  ownShipLantern?.(k);
  const { x, y } = lanternSpot(k);
  k.put("tail", k.circle(x, y - 17, 2.6, "none", GOLD_DARK, 1.2) + k.path(`M${x - 7} ${y - 11}L${x} ${y - 16}L${x + 7} ${y - 11}Z`, "#b8823a", k.ink, 0.8) +
    k.rect(x - 7, y - 11, 14, 21, 2, "#bfffe0", k.ink, 0.9) +
    k.lume("pulse", k.path(`M${x} ${y - 7}Q${x + 4.4} ${y} ${x} ${y + 6}Q${x - 4.4} ${y} ${x} ${y - 7}Z`, "#5dffc0", "none", 0) + k.path(`M${x} ${y - 2}Q${x + 1.8} ${y + 1.4} ${x} ${y + 4}Q${x - 1.8} ${y + 1.4} ${x} ${y - 2}Z`, "#ffffff", "none", 0), 2, "#5dffc0") +
    k.line(`M${x - 3.5} ${y - 11}V${y + 10}M${x + 3.5} ${y - 11}V${y + 10}`, "#b8823a", 1.1) +
    k.rect(x - 8.5, y + 9, 17, 4, 1.2, "#b8823a", k.ink, 0.8));
};

legendDetails("pirates", DETAILS);

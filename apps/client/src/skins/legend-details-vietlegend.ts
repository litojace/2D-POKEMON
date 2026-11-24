import type { Kit } from "./modern-designs";
import { legendDetails, lanternSpot, type Details } from "./legend-details";
// Registers the costumes these details are drawn over.
import "./modern-viet-legend";

/**
 * Hồn Việt: each champion's own headwear and prop, worked up (see
 * legend-details.ts) from its own story and the craft that goes with it:
 * a bamboo-framed star lantern with paper tassels, Thánh Gióng's iron
 * helmet and scorched golden bamboo, a Huế poem hat, a Quan họ hat's silk
 * straps, the crossed folds of a khăn đóng and the returned sword's jade
 * hilt, a đàn bầu in lacquer and mother-of-pearl, a H'Mông silver soul lock,
 * Đông Sơn drum rings on a Lạc crown, banded pheasant plumes...
 * Coordinates follow each costume's own drawing (modern-viet.ts, the `viet`
 * designs in modern-designs.ts and modern-viet-legend.ts).
 */
const GOLD = "#f2c14e",
  GOLD_DARK = "#a8823a",
  GOLD_LIGHT = "#fff3c4";
/** Mother-of-pearl (xà cừ): pale shell with a pink and a sea-green sheen. */
const NACRE = ["#f4fbf8", "#ffd6e8", "#c8f4ec"];

const f = (v: number) => +v.toFixed(1);
/** A five-pointed star's outer and inner corners round (x, y). */
const starCorners = (x: number, y: number, r: number, inner: number) =>
  Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * inner : r;
    return [f(x + Math.cos(a) * rr), f(y + Math.sin(a) * rr)];
  });
/** Where `onPole` (modern-designs.ts) hangs its item in this view. */
function poleSpot(k: Kit) {
  const s = k.side ? -k.side : 1;
  if (k.back) return { x: k.C - s * 34, y: k.T - 34, part: "scarf" as const };
  return { x: k.C + s * (k.side ? 30 : 64), y: k.T - 46, part: "body" as const };
}
/** A silk tassel (tua) hanging from (x, y): a knot bead, a cap and its fringe. */
const tassel = (k: Kit, x: number, y: number, len: number, silk: string, bead = GOLD) =>
  k.line(`M${x} ${y}V${y + len * 0.3}`, silk, 0.8) +
  k.circle(x, y + len * 0.3, 1.3, bead, GOLD_DARK, 0.4) +
  k.path(`M${x - 1.4} ${y + len * 0.42}L${x + 1.4} ${y + len * 0.42}L${x + 2.4} ${y + len}L${x - 2.4} ${y + len}Z`, silk, k.ink, 0.5) +
  k.line(`M${x - 0.8} ${y + len * 0.55}V${y + len - 0.6}M${x + 0.8} ${y + len * 0.55}V${y + len - 0.6}`, "#00000040", 0.4);
/** The band shape modern-viet.ts uses for headbands, as an outline path. */
const bandPath = (k: Kit, y: number, w: number, h: number) => {
  const x = k.hx + k.side * 2;
  return `M${x - w} ${y + 2}Q${x} ${y - 8} ${x + w} ${y + 2}L${x + w - 1} ${y + 2 + h}Q${x} ${y - 8 + h} ${x - w + 1} ${y + 2 + h}Z`;
};
/** A curve along a band at `v` (0 top edge, 1 bottom edge). */
const bandLine = (k: Kit, y: number, w: number, h: number, v: number, inset = 2) => {
  const x = k.hx + k.side * 2,
    d = h * v;
  return `M${x - w + inset} ${y + 2 + d}Q${x} ${y - 8 + d} ${x + w - inset} ${y + 2 + d}`;
};
/** A point on a band's centre line, u from -1 (left end) to 1 (right end). */
const onBand = (k: Kit, y: number, w: number, h: number, u: number) => {
  const x = k.hx + k.side * 2,
    t = (u + 1) / 2;
  // The quadratic from (x-w, y+2) through control (x, y-8) to (x+w, y+2).
  const by = (1 - t) * (1 - t) * (y + 2) + 2 * t * (1 - t) * (y - 8) + t * t * (y + 2);
  return [f(x + u * w), f(by + h / 2)];
};

const DETAILS: Details = {
  // Trung Thu child: the star lantern's bamboo frame, its paper tassels and
  // candle; an ông Địa papier-mâché mask pushed up on the head.
  voltkit(k) {
    const { x, y, part } = poleSpot(k);
    const cy = y - 4,
      pts = starCorners(x, cy, 16, 0.5);
    const outer = pts.filter((_, i) => i % 2 === 0),
      inner = pts.filter((_, i) => i % 2 === 1);
    // Split bamboo ribs from the hub to each point and round the waist.
    const ribs = outer.map(([px, py]) => `M${x} ${cy}L${px} ${py}`).join("") + "M" + inner.map((p) => p.join(" ")).join("L") + "Z";
    // Crepe-paper fringes at the three upper points, red and gold.
    const fringe = [0, 1, 4].map((i) => {
      const [px, py] = outer[i];
      const ax = (px - x) / 16,
        ay = (py - cy) / 16;
      return [-1, 0, 1].map((j) => {
        const ex = px + ax * 6 + ay * j * 2,
          ey = py + ay * 6 - ax * j * 2;
        return k.line(`M${px} ${py}L${f(ex)} ${f(ey)}`, j ? "#ffd84a" : "#e8322a", 1.2);
      }).join("");
    }).join("");
    // Drawn a size up over the Epic's lantern.
    const star = pts.map((p, i) => `${i ? "L" : "M"}${p.join(" ")}`).join("") + "Z";
    k.put(part, `<g transform="translate(${x} ${cy}) scale(1.3) translate(${-x} ${-cy})">` + fringe +
      k.lume("pulse", k.path(star, "#e8322a", k.ink, 1.1) + k.path(k.star(x, cy, 9, 5, 0.5), "#ffb347", "none", 0), 0, "#ffb347") +
      k.line(ribs, "#f2d08a", 0.8) + k.path(star, "none", "#7a1a14", 0.5) +
      // The candle's flame at the hub.
      k.lume("pulse", k.path(`M${x} ${cy - 5}Q${x + 2.6} ${cy - 1} ${x} ${cy + 2}Q${x - 2.6} ${cy - 1} ${x} ${cy - 5}Z`, GOLD_LIGHT, "#ff8a1a", 0.5), 1, "#ffd27a") +
      // Paper streamers from the two lower points.
      [2, 3].map((i) => tassel(k, outer[i][0], outer[i][1], 10, i === 2 ? "#3fa04f" : "#ffd84a")).join("") + "</g>");
    // The mask sits pushed up on the crown, tilted back.
    const mx = k.hx + k.side * 6,
      my = k.ht + 2;
    if (k.back) {
      k.put("flame", `<ellipse cx="${mx}" cy="${my}" rx="14" ry="9" fill="#e9d2b0" stroke="${k.ink}" stroke-width="1"/>` +
        k.line(`M${mx - 13} ${my + 2}Q${mx} ${my + 9} ${mx + 13} ${my + 2}`, "#c8323a", 1));
    } else if (k.side) {
      const s = k.side;
      k.put("flame", k.path(`M${mx - s * 10} ${my + 8}Q${mx - s * 12} ${my - 8} ${mx + s * 2} ${my - 9}Q${mx + s * 12} ${my - 8} ${mx + s * 11} ${my + 2}Q${mx + s * 14} ${my + 4} ${mx + s * 10} ${my + 7}Z`, "#f6e2c8", k.ink, 1) +
        k.path(`M${mx + s * 3} ${my - 3}q${s * 3} -2 ${s * 5} 0`, "none", k.ink, 0.9) + k.path(`M${mx + s * 2} ${my + 4}q${s * 4} 3 ${s * 8} -1`, "#c8323a", k.ink, 0.7) +
        k.circle(mx + s * 1, my + 1, 1.8, "#f08a8a", "none", 0));
    } else {
      k.put("flame", `<g transform="rotate(-10 ${mx} ${my})">` +
        `<ellipse cx="${mx}" cy="${my}" rx="14" ry="11" fill="#f6e2c8" stroke="${k.ink}" stroke-width="1"/>` +
        // Smiling crescent eyes, round red cheeks and the wide laugh of ông Địa.
        k.path(`M${mx - 8} ${my - 2}q2.5 -3 5 0M${mx + 3} ${my - 2}q2.5 -3 5 0`, "none", k.ink, 1) +
        k.circle(mx - 9, my + 2, 2, "#f08a8a", "none", 0) + k.circle(mx + 9, my + 2, 2, "#f08a8a", "none", 0) +
        k.path(`M${mx - 6} ${my + 2}Q${mx} ${my + 10} ${mx + 6} ${my + 2}Z`, "#c8323a", k.ink, 0.8) +
        k.path(`M${mx - 4.5} ${my + 2.6}H${mx + 4.5}`, "none", "#ffffff", 1) + "</g>");
    }
  },

  // Thánh Gióng: the iron helmet's riveted band with a bronze drum star the
  // flame rises from; the golden bamboo with raised nodes, the scorch of the
  // iron horse's fire and a spray of leaves.
  cindrake(k) {
    const y = k.ht + 14,
      w = k.side ? 40 : 46,
      h = 7;
    const rivets = [-0.8, -0.55, -0.3, 0.3, 0.55, 0.8].filter((u) => !k.side || u * k.side > -0.6).map((u) => {
      const [rx, ry] = onBand(k, y, w, h, u);
      return k.circle(rx, ry, 0.9, "#9aa0b0", k.ink, 0.4);
    }).join("");
    const [sx, sy] = onBand(k, y, w, h, k.side ? k.side * 0.62 : 0);
    // Cindrake's flame is drawn behind its head in profile and from behind,
    // so there the band goes on the head.
    k.put(k.side || k.back ? "head" : "flame", k.path(bandPath(k, y, w, h), "#4a4f5c", k.ink, 1) + k.line(bandLine(k, y, w, h, 0.25), "#6a7080", 1) + rivets +
      (k.back ? k.path(`M${k.hx - 2} ${y + 1}l-3 14l3 -2l3 2l-1 -14Z`, "#c8323a", k.ink, 0.6) :
        k.circle(sx, sy - 1, 6, "#b8823a", k.ink, 0.9) + k.lume("pulse", k.path(k.star(sx, sy - 1, 4.4, 10, 0.4), GOLD, "none", 0), 2, "#ffb347") + k.circle(sx, sy - 1, 1.4, "#6a4a1c", "none", 0)));
    // The bamboo on its pole.
    const { x, y: py, part } = poleSpot(k);
    const nodes = [-6, 3, 12, 21].map((dy) => k.path(`M${x - 3.8} ${py + dy}Q${x} ${py + dy + 1.6} ${x + 3.8} ${py + dy}Q${x} ${py + dy - 1.2} ${x - 3.8} ${py + dy}Z`, "#c8a83a", k.ink, 0.5)).join("");
    const scorch = k.path(`M${x - 2.4} ${py + 12}q1 4 0 8M${x + 1.6} ${py + 21}q1 3 -0.4 6M${x + 2} ${py - 6}q0.6 3 -0.4 5`, "none", "#6a3a14", 1);
    const leaf = (lx: number, ly: number, dx: number, dy: number) => k.path(`M${lx} ${ly}q${dx * 0.6} ${dy * 0.2 - 3} ${dx} ${dy}q${-dx * 0.5} ${-dy * 0.1 + 2} ${-dx} ${-dy}Z`, "#5a9a3a", k.ink, 0.5);
    k.put(part, k.line(`M${x - 1.6} ${py - 13}V${py + 29}`, "#fff6c0", 0.9) + nodes + scorch +
      leaf(x, py - 13, 13, -12) + leaf(x, py - 11, -12, -10) + leaf(x + 1, py - 9, 15, 2) +
      k.lume("twinkle", k.circle(x + 6, py - 24, 1, "#ffd27a", "none", 0) + k.circle(x - 7, py - 20, 0.8, "#ffb347", "none", 0), 3, "#ffb347"));
  },

  // Hoa đăng: a Huế poem hat (nón bài thơ) with Trường Tiền bridge and verse
  // between its leaves, a stitched rim and silk ties; the lotus lamp gets a
  // leaf saucer, an outer row of petals and gold stamens.
  tidefin(k) {
    const w = k.side ? 40 : 48,
      y = k.ht + 14,
      apex = y - 30,
      x = k.hx + k.side * 2;
    const at = (u: number) => apex + (y - apex) * u;
    const seams = [-0.75, -0.45, -0.15, 0.15, 0.45, 0.75].map((u) => `M${x} ${apex + 3}L${f(x + u * w * 0.98)} ${f(y + 2 - Math.abs(u) * 2)}`).join("");
    let hat = k.line(seams, "#c8a870", 0.5) +
      k.path(`M${x - w} ${y}Q${x} ${y + 9} ${x + w} ${y}`, "none", "#7a5a2a", 1.4) + k.path(`M${x - w} ${y}Q${x} ${y + 9} ${x + w} ${y}`, "none", GOLD, 0.6).replace("<path", '<path stroke-dasharray="1.4 1.6"');
    if (!k.back) {
      // Trường Tiền's six spans and three lines of verse, glowing faintly.
      const bw = w * 0.62,
        by = at(0.72),
        bx0 = x - bw + k.side * 4;
      const spans = Array.from({ length: 6 }, (_, i) => `Q${f(bx0 + (i + 0.5) * (bw / 3))} ${f(by - 4)} ${f(bx0 + (i + 1) * (bw / 3))} ${f(by)}`).join("");
      hat += k.lume("pulse", k.path(`M${f(bx0)} ${f(by)}${spans}`, "none", "#2f6fa8", 0.9) +
        [0, 1, 2].map((i) => k.line(`M${f(x - 7 + i * 5 + k.side * 4)} ${f(at(0.36))}v${f(5 - i)}`, "#2f6fa8", 0.8)).join(""), 3, "#bfe4ff");
    }
    // Silk ties down the sides of the head, off the face.
    if (!k.side) hat += [-1, 1].map((s) => k.path(`M${x + s * w * 0.9} ${y + 3}Q${x + s * w * 1.04} ${y + 22} ${x + s * w * 0.98} ${y + 36}`, "none", "#2f7fb8", 1.6)).join("");
    k.put("flame", hat);
    if (k.back) return;
    const tip = k.side ? [84, 130] : [150, 128];
    const bx = k.side < 0 ? 200 - tip[0] : tip[0],
      by = tip[1];
    const petal = (s: number, len: number, fill: string) => k.path(`M${bx} ${by + 4}Q${bx + s * 12} ${by} ${bx + s * len} ${by - 8}Q${bx + s * 3} ${by - 2} ${bx} ${by + 4}Z`, fill, k.ink, 0.5);
    k.put("armR", `<g transform="translate(${bx} ${by}) scale(1.7) translate(${-bx} ${-by})">` +
      `<ellipse cx="${bx}" cy="${by + 4.5}" rx="12" ry="3" fill="#3f8a4f" stroke="${k.ink}" stroke-width="0.6"/>` + k.line(`M${bx - 9} ${by + 4.5}H${bx + 9}M${bx} ${by + 2}V${by + 7}`, "#2f6a3a", 0.4) +
      [-1.25, 1.25].map((s) => petal(s, 8, "#e8709a")).join("") +
      [-1, -0.5, 0.5, 1].map((s) => k.line(`M${bx} ${by + 3}Q${bx + s * 6} ${by - 1} ${bx + s * 6} ${by - 6}`, "#d85a88", 0.4)).join("") +
      k.lume("twinkle", [-2.4, -0.8, 0.8, 2.4].map((dx) => k.circle(bx + dx, by - 3.6 + Math.abs(dx) * 0.3, 0.7, "#ffd84a", "none", 0)).join(""), 4, "#ffe08a") +
      k.lume("pulse", k.path(`M${bx} ${by - 11}Q${bx + 1.4} ${by - 8} ${bx} ${by - 6}Q${bx - 1.4} ${by - 8} ${bx} ${by - 11}Z`, "#ffffff", "none", 0), 0, "#fff3c4") + "</g>");
  },

  // Vovinam: the headband edged in gold, its knot and long tails behind, a
  // Việt Võ Đạo disc at the brow and on the chest, and rank bars on the belt.
  auralynx(k) {
    const y = k.ht + 22,
      w = k.side ? 42 : 48,
      h = 6;
    const disc = (dx: number, dy: number, r: number) =>
      k.circle(dx, dy, r, "#ffd84a", k.ink, 0.6) +
      k.path(`M${dx} ${dy - r * 0.8}A${r * 0.8} ${r * 0.8} 0 0 1 ${dx} ${dy + r * 0.8}A${r * 0.4} ${r * 0.4} 0 0 1 ${dx} ${dy}A${r * 0.4} ${r * 0.4} 0 0 0 ${dx} ${dy - r * 0.8}Z`, "#c8323a", "none", 0) +
      k.path(`M${dx} ${dy - r * 0.8}A${r * 0.8} ${r * 0.8} 0 0 0 ${dx} ${dy + r * 0.8}A${r * 0.4} ${r * 0.4} 0 0 0 ${dx} ${dy}A${r * 0.4} ${r * 0.4} 0 0 1 ${dx} ${dy - r * 0.8}Z`, "#2f5fb0", "none", 0);
    let head = k.line(bandLine(k, y, w, h, 0.08, 1.5), GOLD, 0.9) + k.line(bandLine(k, y, w, h, 0.92, 2), GOLD, 0.9);
    if (k.back) head += k.circle(k.hx, y + 1, 3.6, "#c8323a", k.ink, 0.7) + k.line(`M${k.hx - 8} ${y + 12}l-1 6M${k.hx + 8} ${y + 12}l1 6`, GOLD, 1.4);
    else if (k.side) {
      // The knot at the back of the head, its tails streaming behind.
      const kx = k.hx - k.side * (w - 4),
        ky = y + 2;
      head += k.path(`M${kx} ${ky}q${-k.side * 10} 6 ${-k.side * 16} 18l${k.side * 4} 1q${k.side * 4} -10 ${k.side * 12} -15Z M${kx} ${ky + 1}q${-k.side * 12} 0 ${-k.side * 20} 8l${k.side * 2} 3q${k.side * 8} -6 ${k.side * 18} -7Z`, "#c8323a", k.ink, 0.7) +
        k.circle(kx, ky + 1, 3.4, "#c8323a", k.ink, 0.7);
      const [ex, ey] = onBand(k, y, w, h, k.side * 0.55);
      head += disc(ex, ey - 1, 3.8);
    } else {
      const [ex, ey] = onBand(k, y, w, h, 0);
      head += disc(ex, ey - 1, 4.2);
      // The knot's tails, streaming out past the side of the head.
      const tx = k.hx + w - 2,
        ty = y + 3;
      head += k.path(`M${tx} ${ty}q9 3 15 13l-3.4 2q-5 -8 -11.6 -11Z M${tx} ${ty + 2}q11 -1 18 6l-2.4 2.6q-6 -5 -15.6 -5.4Z`, "#c8323a", k.ink, 0.7) +
        k.line(`M${tx + 12} ${ty + 15}l3 -1.6M${tx + 15.6} ${ty + 9}l2.4 -2.4`, GOLD, 1.2);
    }
    k.put("flame", head);
    if (k.back) return;
    const c = k.C + k.side * 3;
    k.put("body", (k.side ? "" : disc(c + 11, k.T + 9, 3.6)) +
      // Red rank bars across the yellow belt's tails.
      [-1, 1].map((s) => k.line(`M${c + s * 3.4} ${k.B - 3}l${s * 2.6} 0.4M${c + s * 4.4} ${k.B - 0.4}l${s * 2.6} 0.4`, "#c8323a", 1.1)).join(""));
  },

  // Hội An lantern maker: a gold khăn vấn wound round the head, and silk
  // lanterns with curved bamboo ribs, gold caps and red tassels.
  lumoth(k) {
    const xs = k.side ? [k.hx + k.side * 22] : [k.hx - 42, k.hx + 42],
      ly = k.ht - 2;
    // The khăn vấn: a wound silk turban, each turn of it shown.
    const y = k.ht + 6,
      w = k.side ? 41 : 47,
      h = 11;
    const turns = [-0.82, -0.58, -0.34, -0.1, 0.14, 0.38, 0.62, 0.86].map((u) => {
      const [tx, ty] = onBand(k, y, w, h, u);
      return k.path(`M${f(tx - 4)} ${f(ty - h / 2 + 0.6)}Q${f(tx + 1)} ${f(ty - 1)} ${f(tx + 3)} ${f(ty + h / 2 - 0.6)}`, "none", "#a8761a", 1.1);
    }).join("");
    const lanterns = xs.map((x) => {
      const ribs = [-3.2, 0, 3.2].map((dx) => `M${x + dx * 0.6} ${ly - 6}Q${x + dx * 1.5} ${ly} ${x + dx * 0.6} ${ly + 6}`).join("");
      return k.line(ribs, "#7a2a14", 0.5) + k.rect(x - 3.6, ly - 8.4, 7.2, 2.4, 0.8, GOLD, GOLD_DARK, 0.4) + k.line(`M${x - 2} ${ly - 8.4}Q${x} ${ly - 12} ${x + 2} ${ly - 8.4}`, GOLD, 0.7) +
        tassel(k, x, ly + 7.6, 9, "#c8202e");
    }).join("");
    k.put("flame", k.path(bandPath(k, y, w, h), "#e8b830", k.ink, 0.9) + turns + k.line(bandLine(k, y, w, h, 0.5, 4), "#fff0a8", 0.6) + lanterns);
  },

  // Quan họ Kinh Bắc: the nón quai thao's rings of palm leaf and lacquered
  // rim, and its long black silk ties (quai thao) ending in tassels.
  mystowl(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 6,
      w = k.side ? 46 : 54,
      ry = k.side ? 8 : 10;
    const rings = [0.62, 0.82].map((u) => `<ellipse cx="${x}" cy="${f(y - 0.5)}" rx="${f(w * u)}" ry="${f(ry * u)}" fill="none" stroke="#b88a4a" stroke-width="0.6"/>`).join("");
    const rim = `<ellipse cx="${x}" cy="${y}" rx="${w - 0.8}" ry="${ry - 0.8}" fill="none" stroke="#3a2010" stroke-width="1.4"/>`;
    const ties = (k.side ? [-k.side] : [-1, 1]).map((s) => {
      const tx = k.back ? x + s * 40 : k.side ? x + s * 28 : x + s * 50;
      const top = y + (k.side ? 4 : 7);
      const bottom = y + (k.back ? 56 : 52);
      const cord = `M${tx} ${top}Q${tx + s * 6} ${(top + bottom) / 2} ${tx + s * 2} ${bottom}`;
      return k.path(cord, "none", "#14101c", 3) + k.path(cord, "none", "#5a4a6a", 0.7) +
        `<g transform="translate(${tx + s * 2} ${bottom}) scale(1.5) translate(${-(tx + s * 2)} ${-bottom})">${tassel(k, tx + s * 2, bottom, 11, "#14101c")}</g>`;
    }).join("");
    k.put("flame", rings + rim + k.lume("twinkle", [0.3, 0.7].map((u) => k.circle(x - w * 0.5 + u * w, y - 3, 0.9, GOLD_LIGHT, "none", 0)).join(""), 5, GOLD_LIGHT) + ties);
  },

  // Kim Quy: the khăn đóng's pleats crossed in the shape of chữ nhân (人)
  // over the brow, and the returned sword Thuận Thiên with a gold pommel set
  // with jade, a bound grip, cloud-curled guard and a red silk tassel.
  terradon(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 16,
      w = k.side ? 42 : 46,
      top = k.ht - 12;
    let khan = k.path(`M${x - w * 0.8} ${top + 12}Q${x} ${top - 1} ${x + w * 0.8} ${top + 12}`, "none", "#5a5a70", 1);
    if (!k.back) {
      // The two pleats rise from either temple and cross above the brow,
      // the right one laid over the left, as the strokes of 人.
      const cx0 = x + k.side * w * 0.45;
      const pleat = (x0: number, y0: number, x1: number, y1: number) => {
        const len = Math.hypot(x1 - x0, y1 - y0),
          nx = ((y1 - y0) / len) * 3.4,
          ny = (-(x1 - x0) / len) * 3.4;
        const mx = (x0 + x1) / 2,
          my = (y0 + y1) / 2 - 2;
        return k.path(`M${f(x0 + nx)} ${f(y0 + ny)}Q${f(mx + nx)} ${f(my + ny)} ${f(x1 + nx * 0.6)} ${f(y1 + ny * 0.6)}L${f(x1 - nx * 0.6)} ${f(y1 - ny * 0.6)}Q${f(mx - nx)} ${f(my - ny)} ${f(x0 - nx)} ${f(y0 - ny)}Z`, "#2c2c3a", k.ink, 0.8) +
          k.line(`M${f(x0 + nx * 0.55)} ${f(y0 + ny * 0.55)}Q${f(mx + nx * 0.55)} ${f(my + ny * 0.55)} ${f(x1 + nx * 0.35)} ${f(y1 + ny * 0.35)}`, "#7a7a96", 1);
      };
      khan += k.side
        ? pleat(cx0 - k.side * 18, y, cx0 + k.side * 3, y - 17) + pleat(cx0 + k.side * 12, y - 1, cx0 - k.side * 1, y - 18)
        : pleat(x - 30, y - 1, x + 3, y - 18) + pleat(x + 30, y - 1, x - 2, y - 19);
    } else khan += k.line(`M${x - w + 4} ${y - 4}Q${x} ${y - 11} ${x + w - 4} ${y - 4}`, "#5a5a70", 0.8);
    k.put("flame", khan);
    // The sword's hilt, where modern-designs.ts draws it.
    const s = k.side ? -k.side : -1;
    const [hx0, hy0] = k.back ? [k.C - 20, k.T - 20] : [k.C + s * (k.side ? 30 : 54), k.T - 28];
    const px = hx0 + s * 7,
      py = hy0 - 12;
    const wraps = [0.25, 0.5, 0.75].map((u) => k.line(`M${f(hx0 + s * 7 * u - 1.8)} ${f(hy0 - 12 * u - 0.6)}l3.6 1.2`, GOLD, 0.7)).join("");
    k.put(k.back ? "scarf" : "body", wraps +
      // Guard with cloud-curled ends.
      k.circle(hx0 - 5.4, hy0 + 2.2, 1.6, GOLD, GOLD_DARK, 0.5) + k.circle(hx0 + 5.4, hy0 - 2.2, 1.6, GOLD, GOLD_DARK, 0.5) +
      k.circle(px, py, 2.6, GOLD, GOLD_DARK, 0.6) + k.lume("twinkle", k.circle(px, py, 1.3, "#5fd89a", "none", 0), 3, "#c8ffe0") +
      tassel(k, px, py + 2, 12, "#c8202e"));
  },

  // Đèn kéo quân: the revolving lantern gains a six-cornered roof with
  // curled eaves, shadow riders on its panes and a hanging tassel; gold
  // tassels at the ends of the hood's cord.
  duskveil(k) {
    const cordY = k.ht + 56;
    const ends = k.side ? [k.hx - k.side * 40] : [k.hx - 44, k.hx + 44];
    k.put("flame", ends.map((x) => `<g transform="translate(${x} ${cordY}) scale(1.4) translate(${-x} ${-cordY})">${tassel(k, x, cordY, 10, "#c8202e")}</g>`).join(""));
    if (k.back) return;
    // The lantern, drawn again larger and lower on the chest, clear of the
    // clasp: a gold hexagon of six lit paper panes, the riders whose shadows
    // go round on them, a roof with curled eaves and a tassel below.
    const c = k.C + k.side * 3,
      y = k.T + 23,
      r = 10;
    const pts = Array.from({ length: 6 }, (_, i) => {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      return [f(c + Math.cos(a) * r), f(y + Math.sin(a) * r)];
    });
    const panes = pts.map((p, i) => {
      const q = pts[(i + 1) % 6];
      return k.lume("chase", k.path(`M${c} ${y}L${p[0]} ${p[1]}L${q[0]} ${q[1]}Z`, i % 2 ? "#ffb347" : "#ffd27a", "none", 0), i, "#ffb347");
    }).join("");
    const rider = (rx: number, ry: number, dir: number) =>
      k.path(`M${rx - dir * 3} ${ry + 1}q${dir * 3} -2 ${dir * 5.4} 0l${dir * 0.8} -2l${dir * 0.8} 1.2l${-dir * 0.6} 2l${-dir * 0.2} 2.2M${rx - dir * 2.2} ${ry + 1.6}v2.4M${rx + dir * 1.8} ${ry + 1.6}v2.4M${rx} ${ry}v-3`, "none", "#3a1a0a", 1) +
      k.circle(rx, ry - 4, 1.1, "#3a1a0a", "none", 0) + k.line(`M${rx - dir * 1.4} ${ry - 0.6}l${dir * 4.6} -4.6`, "#3a1a0a", 0.6);
    const eave = (s: number) => k.path(`M${c} ${y - r - 6}L${c + s * 11} ${y - r + 0.4}q${s * 2.4} -0.2 ${s * 2.6} -3`, "none", GOLD, 1.4);
    k.put("body", k.line(`M${c - 3} ${k.T + 6}L${c} ${y - r - 7}L${c + 3} ${k.T + 6}`, GOLD, 0.8) +
      k.path("M" + pts.map((p) => p.join(" ")).join("L") + "Z", "#3a2a1c", k.ink, 0.9) + panes +
      rider(c - 3.4, y - 2.6, 1) + rider(c + 3.6, y + 4, -1) +
      k.path("M" + pts.map((p) => p.join(" ")).join("L") + "Z" + pts.map((p) => `M${c} ${y}L${p[0]} ${p[1]}`).join(""), "none", GOLD, 0.9) +
      k.path(`M${c - 9} ${y - r + 1.4}L${c} ${y - r - 6}L${c + 9} ${y - r + 1.4}Z`, "#8a1a14", GOLD, 0.8) + eave(-1) + eave(1) + k.circle(c, y - r - 7, 1.6, GOLD, GOLD_DARK, 0.4) +
      tassel(k, c, y + r - 1, 10, "#c8202e"));
  },

  // Đàn bầu player: a brown khăn xếp, the folded turban of the northern
  // musician, its pleats laid one over another; the đàn bầu's long box in
  // red lacquer inlaid with mother-of-pearl flowers, a calabash gourd and a
  // red tassel on the curved horn rod, and a tuning peg.
  coilemur(k) {
    {
      const y = k.ht + 7,
        w = k.side ? 42 : 48,
        h = 13,
        x = k.hx + k.side * 2;
      // The pleat ends tucked in at the temple the champion faces (the
      // right one from the front).
      const [tx, ty] = onBand(k, y, w, h, k.side ? k.side * 0.55 : 0.6);
      const crown = w * (k.side ? 0.7 : 0.6);
      k.put("flame", k.path(`M${x - crown} ${y}Q${x} ${k.ht - 16} ${x + crown} ${y}Z`, "#3a2418", k.ink, 1) + k.path(`M${x - crown * 0.6} ${y - 5}Q${x} ${k.ht - 9} ${x + crown * 0.6} ${y - 5}`, "none", "#6a4630", 0.9) +
        k.path(bandPath(k, y, w, h), "#3a2418", k.ink, 1) +
        [0.27, 0.52, 0.77].map((v) => k.line(bandLine(k, y, w, h, v, 2), "#6a4630", 1)).join("") + k.line(bandLine(k, y, w, h, 0.08, 4), "#8a6448", 0.6) +
        (k.back ? "" : k.path(`M${tx - 2} ${ty - h / 2 + 1}L${tx + 2.4} ${ty - h / 2 + 1}L${tx + 1} ${ty + h / 2 - 0.6}L${tx - 3} ${ty + h / 2 - 0.6}Z`, "#4a3020", k.ink, 0.6)));
    }
    const s = k.side ? -k.side : 1;
    const [x0, y0, x1, y1] = k.back ? [k.C + 18, k.B + 2, k.C - 20, k.T - 22] : [k.C - s * 14, k.B, k.C + s * (k.side ? 26 : 52), k.T - 28];
    // Only what shows past the body in front and in profile.
    const shows = (px: number, py: number) => k.back || py < k.T - 3 || px < k.L - 3 || px > k.R + 3;
    const along = (u: number) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u];
    const inlay = [0.2, 0.32, 0.44, 0.56, 0.68, 0.8].map((u, i) => {
      const [px, py] = along(u);
      if (!shows(px, py)) return "";
      return i % 2
        ? k.circle(px, py, 1, NACRE[1 + (i % 4 === 1 ? 0 : 1)], "none", 0)
        : [0, 1, 2, 3].map((j) => k.circle(px + Math.cos((j * Math.PI) / 2) * 1, py + Math.sin((j * Math.PI) / 2) * 1, 0.8, NACRE[(i + j) % 3], "none", 0)).join("");
    }).join("");
    // The box's visible runs, lacquered red with a gold edge, the string
    // drawn over them again.
    const runs: number[][] = [];
    for (let i = 0; i <= 50; i++) {
      const u = i / 50,
        [px, py] = along(u);
      if (!shows(px, py)) continue;
      const last = runs[runs.length - 1];
      if (last && last[1] >= u - 0.021) last[1] = u;
      else runs.push([u, u]);
    }
    const segs = runs.filter(([a, b]) => b > a).map(([a, b]) => {
      const [ax, ay] = along(a),
        [bx, by] = along(b);
      return `M${f(ax)} ${f(ay)}L${f(bx)} ${f(by)}`;
    });
    const lacquer = segs.map((seg) => k.line(seg, "#9a2418", 3.8) + k.line(seg, "#e05a40", 0.6).replace("<path", '<path transform="translate(0 -1.3)"')).join("");
    const strings = segs.map((seg) => k.lume("pulse", k.line(seg, "#bff6ff", 0.6).replace("<path", '<path transform="translate(0 1)"'), 0, "#7ff3ff")).join("");
    const [gx, gy] = [x1 + s * 2, y1 - 6];
    const gourd = k.circle(gx, gy + 2, 4.4, "#e0b060", k.ink, 0.8) + k.circle(gx + s * 0.8, gy - 3.4, 2.6, "#e0b060", k.ink, 0.8) + k.line(`M${gx - s * 1.6} ${gy + 0.4}q${s * 1} -1.4 ${s * 2.4} -0.4`, "#fff0c0", 0.6);
    const rod = k.path(`M${x1} ${y1}Q${x1 + s * 1} ${y1 - 8} ${x1 + s * 6} ${y1 - 14}`, "none", "#2a1a10", 1.6) + tassel(k, x1 + s * 6, y1 - 14, 10, "#c8202e");
    const peg = (() => {
      const [px, py] = along(0.06);
      return shows(px, py) ? k.circle(px, py, 2, "#3a1a0c", GOLD, 0.6) : "";
    })();
    k.put(k.back ? "scarf" : "body", lacquer + inlay + strings + rod + gourd + peg);
  },

  // Hạt dẻ seller: the khăn mỏ quạ's folds and the knot at the nape; woven
  // bamboo baskets on rope cradles, a noded carrying pole, and glossy
  // chestnuts split open over their embers.
  pyranda(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 14,
      w = k.side ? 44 : 50;
    let khan = k.path(`M${x - w * 0.62} ${k.ht + 2}Q${x - w * 0.2} ${k.ht - 7} ${x + w * 0.3} ${k.ht - 5}`, "none", "#4a4058", 1.2);
    if (k.back) {
      // The two ends knotted at the nape.
      khan += k.path(`M${x - 4} ${y + 6}l-9 12l5 1l6 -10Z M${x + 4} ${y + 6}l9 12l-5 1l-6 -10Z`, "#24202e", k.ink, 0.7) + k.circle(x, y + 5, 4.4, "#24202e", k.ink, 0.8) + k.line(`M${x - 2} ${y + 3.6}q2 -1.2 4 0`, "#4a4058", 0.8);
    } else {
      // The folds that run up from the crow's-beak point at the brow.
      const px = x + (k.side ? k.side * 8 : 0);
      khan += k.line(`M${px - 3} ${y + 6}Q${px - 12} ${y - 2} ${px - 26} ${y - 2}M${px + 3} ${y + 6}Q${px + 12} ${y - 2} ${px + 26} ${y - 2}`, "#3e3650", 1);
      if (k.side) {
        const kx = x - k.side * (w - 6);
        khan += k.path(`M${kx} ${y + 4}l${-k.side * 8} 13l${k.side * 5} 0l${k.side * 4} -11Z`, "#24202e", k.ink, 0.7) + k.circle(kx, y + 3, 4, "#24202e", k.ink, 0.8);
      }
    }
    k.put("flame", khan);
    // The baskets, where modern-viet.ts hangs them.
    const yP = k.T - 6;
    const basket = (bx: number, by: number) => {
      const weave = [-4, 0, 4].map((dx) => k.line(`M${bx + dx * 1.4} ${by - 6.6}L${bx + dx} ${by + 4.6}`, "#8a6a3a", 0.6)).join("") +
        [-2, 1.4].map((dy) => k.line(`M${bx - 7.6} ${by + dy}Q${bx} ${by + dy + 1.6} ${bx + 7.6} ${by + dy}`, "#8a6a3a", 0.6)).join("");
      const ropes = k.line(`M${bx - 8} ${by - 6}L${bx} ${by - 22}L${bx + 8} ${by - 6}M${bx - 3} ${by - 6}L${bx} ${by - 22}L${bx + 3} ${by - 6}`, "#6a4a24", 0.7) + k.circle(bx, by - 22, 1.4, "none", "#6a4a24", 0.8);
      const nuts = [-5, -1.6, 1.8, 5.2].map((dx, i) => k.circle(bx + dx, by - 8 - (i % 2) * 1.6, 2.3, "#6a3418", k.ink, 0.5) +
        k.circle(bx + dx - 0.7, by - 8.8 - (i % 2) * 1.6, 0.7, "#c8865a", "none", 0)).join("") +
        // One split open, its kernel showing.
        k.path(`M${bx - 0.6} ${by - 12.6}q1.2 -1.8 2.6 0q-1.2 1.2 -2.6 0Z`, "#ffd27a", k.ink, 0.4);
      return ropes + weave + k.path(`M${bx - 8.6} ${by - 6.4}Q${bx} ${by - 9.6} ${bx + 8.6} ${by - 6.4}`, "none", "#6a4a24", 1.4) + nuts;
    };
    if (k.back) k.put("scarf", basket(k.C - 44, yP + 22) + basket(k.C + 44, yP + 22));
    else if (!k.side) {
      const nodes = [-40, -26, 26, 40].map((dx) => k.line(`M${k.C + dx} ${yP - 1.6}v3.2`, "#6a4a24", 0.8)).join("");
      k.put("body", nodes + basket(k.C - 50, yP + 22) + basket(k.C + 50, yP + 22));
    }
  },

  // Sa Pa H'Mông: cross-stitched diamonds round the headwrap with silver
  // coins along its edge and wool pom-poms; a silver soul lock (khóa bạc)
  // hung from the neck ring on little chains.
  glacelle(k) {
    const y = k.ht + 10,
      w = k.side ? 40 : 46,
      h = 10;
    const us = k.side ? [-0.7, -0.4, -0.1, 0.2, 0.5, 0.8] : [-0.8, -0.53, -0.27, 0, 0.27, 0.53, 0.8];
    const stitch = us.map((u, i) => {
      const [sx, sy] = onBand(k, y, w, h, u);
      const c = ["#e8322a", "#ffd84a", "#3fa04f", "#ff6ab0"][i % 4];
      return k.path(`M${sx} ${sy - 3.4}L${sx + 3} ${sy}L${sx} ${sy + 3.4}L${sx - 3} ${sy}Z`, c, k.ink, 0.5) + k.path(`M${sx - 1} ${sy}h2M${sx} ${sy - 1}v2`, "none", "#ffffff", 0.6);
    }).join("");
    const coins = k.back ? "" : us.filter((_, i) => i % 2 === 0).map((u) => {
      const [sx, sy] = onBand(k, y, w, h, u);
      return k.line(`M${sx} ${sy + h / 2}v2`, "#c8d4e0", 0.5) + k.circle(sx, sy + h / 2 + 3.6, 1.8, "#e4ecf4", "#7a8a9a", 0.5);
    }).join("");
    const poms = (k.side ? [k.hx + k.side * 30] : [k.hx - 40, k.hx + 40]).map((px) =>
      k.circle(px - 3, y + 16, 2.6, "#ff6ab0", k.ink, 0.5) + k.circle(px + 3, y + 16.4, 2.6, "#ffd84a", k.ink, 0.5) + k.circle(px, y + 19.4, 2.6, "#e8322a", k.ink, 0.5)).join("");
    k.put("flame", stitch + poms + coins);
    if (k.back) return;
    const c = k.C + k.side * 3,
      ly = k.T + 18;
    // The lock, a rounded silver plate with a spiral engraved, and its chains.
    const chains = [-3.6, 0, 3.6].map((dx, i) => k.line(`M${c + dx} ${ly + 4.6}v${4 + (i % 2) * 2}`, "#c8d4e0", 0.6) + k.circle(c + dx, ly + 9.6 + (i % 2) * 2, 1.2, "#e4ecf4", "#7a8a9a", 0.4)).join("");
    k.put("body", k.line(`M${c} ${k.T + 6}V${ly - 4}`, "#c8d4e0", 0.9) + `<g transform="translate(${c} ${ly}) scale(1.35) translate(${-c} ${-ly})">` + chains +
      k.path(`M${c - 7} ${ly - 1}Q${c - 7} ${ly - 5} ${c - 3} ${ly - 4.4}Q${c} ${ly - 6.4} ${c + 3} ${ly - 4.4}Q${c + 7} ${ly - 5} ${c + 7} ${ly - 1}Q${c + 6} ${ly + 5} ${c} ${ly + 5}Q${c - 6} ${ly + 5} ${c - 7} ${ly - 1}Z`, "#e4ecf4", "#6a7a8a", 0.8) +
      k.path(`M${c} ${ly}m-0.6 0a0.8 0.8 0 1 1 1.4 0.6a2 2 0 1 1 -3 -1.4a3.2 3.2 0 1 1 5 2`, "none", "#6a7a8a", 0.6) +
      k.lume("twinkle", k.circle(c - 3.6, ly - 2.4, 0.9, "#ffffff", "none", 0), 2, "#ffffff") + "</g>");
  },

  // Lạc warrior: Đông Sơn drum rings on the feather crown's bronze band (a
  // saw-tooth border, circles joined by tangents), dark bars across each
  // feather, and a ring of the same circles round the breastplate's sun.
  halcyra(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 14,
      w = k.side ? 40 : 46,
      h = 6,
      n = k.side ? 4 : 7;
    const bars = Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1);
      const a = k.side ? -Math.PI / 2 - k.side * (0.2 + u * 0.9) : -Math.PI / 2 + (u - 0.5) * 1.8;
      const bx = x + Math.cos(a) * 26,
        by = y - 4 + Math.sin(a) * 6;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      return [14, 22].map((d) => {
        const mx = bx + ca * d,
          my = by + sa * d,
          hw = 3.4 * (1 - d / 40);
        return k.line(`M${f(mx - sa * hw)} ${f(my + ca * hw)}L${f(mx + sa * hw)} ${f(my - ca * hw)}`, "#5a3a14", 1.6);
      }).join("") + [8, 18, 28].map((d) => {
        const mx = bx + ca * d,
          my = by + sa * d;
        return k.line(`M${f(mx)} ${f(my)}l${f(-sa * 2.4 - ca * 2)} ${f(ca * 2.4 - sa * 2)}M${f(mx)} ${f(my)}l${f(sa * 2.4 - ca * 2)} ${f(-ca * 2.4 - sa * 2)}`, "#c8b48a", 0.5);
      }).join("");
    }).join("");
    const us = k.side ? [-0.6, -0.25, 0.1, 0.45, 0.8].map((u) => u * k.side) : [-0.8, -0.53, -0.27, 0, 0.27, 0.53, 0.8];
    const rings = us.map((u) => onBand(k, y, w, h, u));
    const tangents = rings.slice(1).map(([rx, ry], i) => k.line(`M${rings[i][0]} ${rings[i][1] - 1.9}L${rx} ${ry - 1.9}M${rings[i][0]} ${rings[i][1] + 1.9}L${rx} ${ry + 1.9}`, "#5a3a14", 0.5)).join("");
    const circles = rings.map(([rx, ry]) => k.circle(rx, ry, 1.9, "#d8a050", "#5a3a14", 0.5) + k.circle(rx, ry, 0.6, "#5a3a14", "none", 0)).join("");
    const teeth = Array.from({ length: 14 }, (_, i) => {
      const u0 = -0.95 + (i / 14) * 1.9,
        u1 = u0 + 1.9 / 28;
      const [ax, ay] = onBand(k, y, w, h, u0),
        [bx2, by2] = onBand(k, y, w, h, u1);
      return `M${ax} ${f(ay - h / 2 + 0.4)}L${bx2} ${f(by2 - h / 2 + 2)}`;
    }).join("");
    // Three tall plumes rising behind the crown, as the drum's warriors wear.
    const tall = (k.side ? [0.42, 0.75].map((v) => -Math.PI / 2 - k.side * v) : [-0.3, 0, 0.3].map((v) => -Math.PI / 2 + v)).map((a, i) => {
      const bx = x + Math.cos(a) * 18,
        by = y - 8 + Math.sin(a) * 4;
      const tx = bx + Math.cos(a) * 46,
        ty = by + Math.sin(a) * 46;
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const mx = (bx + tx) / 2,
        my = (by + ty) / 2;
      return k.path(`M${f(bx - sa * 2.6)} ${f(by + ca * 2.6)}Q${f(mx - sa * 5)} ${f(my + ca * 5)} ${f(tx)} ${f(ty)}Q${f(mx + sa * 5)} ${f(my - ca * 5)} ${f(bx + sa * 2.6)} ${f(by - ca * 2.6)}Z`, "#f4ead0", k.ink, 0.8) +
        [0.45, 0.62, 0.79].map((u) => {
          const px = bx + ca * 46 * u,
            py = by + sa * 46 * u,
            hw = 4.6 * (1 - u * 0.8);
          return k.line(`M${f(px - sa * hw)} ${f(py + ca * hw)}L${f(px + sa * hw)} ${f(py - ca * hw)}`, "#5a3a14", 1.5);
        }).join("") +
        k.line(`M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}`, "#6a4a1c", 0.6) + k.lume("chase", k.circle(tx, ty, 2.2, "#ffe08a", k.ink, 0.4), 7 + i, "#ffe08a");
    }).join("");
    k.put("flame", tall, true);
    k.put("flame", bars + k.line(teeth, "#5a3a14", 0.5) + tangents + circles);
    if (k.back) return;
    const c = k.C + k.side * 3,
      sy = k.T + 15;
    k.put("body", Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return k.circle(c + Math.cos(a) * 9.2, sy + Math.sin(a) * 9.2, 1.5, "#d8a050", "#5a3a14", 0.4) + k.circle(c + Math.cos(a) * 9.2, sy + Math.sin(a) * 9.2, 0.45, "#5a3a14", "none", 0);
    }).join(""));
  },
  // Tết: the hoa mai crown gets red-tipped stamens, buds and new leaves on
  // its branch; gold lozenges woven along the khăn vấn; the lì xì envelope
  // a gold border and flap.
  sunbara(k) {
    const x = k.hx + k.side * 2,
      y = k.ht - 2;
    const blooms = k.side ? [[x, y - 6, 7], [x - k.side * 12, y + 2, 5]] : [[x, y - 8, 8], [x - 15, y + 1, 5.5], [x + 15, y + 1, 5.5]];
    const stamens = blooms.map(([bx, by, r]) => Array.from({ length: 5 }, (_, j) => {
      const a = (j / 5) * Math.PI * 2 - Math.PI / 2 + Math.PI / 5;
      return k.line(`M${bx} ${by}L${f(bx + Math.cos(a) * r * 0.55)} ${f(by + Math.sin(a) * r * 0.55)}`, "#c8501a", 0.5) + k.circle(bx + Math.cos(a) * r * 0.6, by + Math.sin(a) * r * 0.6, 0.6, "#c8202e", "none", 0);
    }).join("")).join("");
    const bud = (bx: number, by: number) => `<ellipse cx="${f(bx)}" cy="${f(by)}" rx="2" ry="2.6" fill="#ffd84a" stroke="#c8902a" stroke-width="0.5"/>` + k.line(`M${f(bx - 1.2)} ${f(by + 2)}q1.2 1.4 2.4 0`, "#5a8a2a", 1);
    const leaf = (lx: number, ly: number, d: number) => k.path(`M${lx} ${ly}q${d * 3} -4 ${d * 7} -2q${-d * 3} 3 ${-d * 7} 2Z`, "#6ab04a", k.ink, 0.5);
    const twig = k.side
      ? bud(x + k.side * 11, y + 3) + leaf(x + k.side * 6, y + 5, k.side) + bud(x - k.side * 20, y + 6)
      : bud(x - 25, y + 5) + bud(x + 25, y + 5) + leaf(x - 7, y + 4, -1) + leaf(x + 7, y + 4, 1) + bud(x + 6, y - 15);
    // Two more blooms behind the crown, to fill it out.
    const back = (bx: number, by: number, r: number) =>
      Array.from({ length: 5 }, (_, j) => {
        const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
        return k.circle(bx + Math.cos(a) * r, by + Math.sin(a) * r, r * 0.8, "#f8cc3a", "#c8902a", 0.5);
      }).join("") + k.circle(bx, by, r * 0.5, "#e86a1a", "none", 0);
    k.put("flame", k.side ? back(x - k.side * 5, y - 12, 4.6) : back(x - 9, y - 13, 5) + back(x + 9, y - 13, 5), true);
    k.put("flame", twig + stamens);
    // Gold lozenges along the khăn vấn's turn.
    const ky = k.ht + 8,
      w = k.side ? 42 : 48;
    const us = k.side ? [-0.6, -0.3, 0, 0.3, 0.6] : [-0.75, -0.5, -0.25, 0, 0.25, 0.5, 0.75];
    k.put("flame", us.map((u) => {
      const [px, py] = onBand(k, ky - 1, w, 9, u);
      return k.path(`M${px} ${py - 2}L${px + 1.8} ${py}L${px} ${py + 2}L${px - 1.8} ${py}Z`, GOLD, GOLD_DARK, 0.4);
    }).join(""));
    if (k.back) return;
    const c = k.C + k.side * 3,
      ex = c + (k.side ? 0 : -14),
      ey = k.B - 14;
    k.put("body", k.rect(ex + 1, ey + 1, 5, 7, 0.6, "none", GOLD, 0.5) + k.path(`M${ex} ${ey}L${ex + 3.5} ${ey + 3}L${ex + 7} ${ey}`, "none", GOLD, 0.6));
  },

  // Thỏ Ngọc: the banyan of Chú Cuội on the moon, a gold crescent hairpin
  // with a jade bead between the ears, and the rabbit lantern's face, its
  // gold cloud and paper fringe.
  astrabun(k) {
    if (!k.back) {
      const mx = k.hx - (k.side ? k.side * 18 : 0),
        my = k.ht - 20;
      // Cây đa: a trunk and spreading crown on the moon's face, where it
      // shows between the ears.
      const tx = mx + (k.side ? -k.side * 8 : -3),
        ty = my + 8;
      k.put("wings", `<g opacity="0.8">` + k.path(`M${tx - 1.6} ${ty + 6}L${tx - 0.8} ${ty - 3}L${tx - 4.4} ${ty - 6}M${tx + 1.6} ${ty + 6}L${tx + 0.8} ${ty - 3}L${tx + 4.6} ${ty - 7}`, "none", "#a06a24", 1.6) +
        k.circle(tx - 5, ty - 8, 3.6, "#b8822e", "none", 0) + k.circle(tx + 4, ty - 9, 4, "#b8822e", "none", 0) + k.circle(tx - 0.5, ty - 12.5, 3.8, "#b8822e", "none", 0) + "</g>");
    }
    // The hairpin: a gold crescent with a jade bead and cloud curls.
    const hx = k.hx + k.side * 4,
      hy = k.ht + 6;
    k.put("flame", `<g transform="translate(${hx} ${hy}) scale(1.4) translate(${-hx} ${-hy})">` + (k.back
      ? k.path(`M${hx - 7} ${hy}Q${hx} ${hy + 3} ${hx + 7} ${hy}`, "none", GOLD, 1.6)
      : k.path(`M${hx - 7} ${hy - 1}A7 7 0 0 0 ${hx + 7} ${hy - 1}A5.6 5.6 0 0 1 ${hx - 7} ${hy - 1}Z`, GOLD, GOLD_DARK, 0.6) +
        k.path(`M${hx - 7} ${hy - 1}q-3 -1 -2.4 -3.4q1.6 -1 2.4 1M${hx + 7} ${hy - 1}q3 -1 2.4 -3.4q-1.6 -1 -2.4 1`, "none", GOLD, 1) +
        k.circle(hx, hy + 4.4, 1.9, "#5fb88a", GOLD_DARK, 0.5) + k.lume("twinkle", k.circle(hx - 0.6, hy + 3.8, 0.6, "#ffffff", "none", 0), 4, "#c8ffe0")) + "</g>");
    // The rabbit lantern (modern-viet-legend.ts measures where it hangs).
    const spot = k.back ? [143, 99] : k.side ? [54, 106] : [150.7, 101.5];
    const cx = k.side < 0 ? 200 - spot[0] : spot[0],
      cy = spot[1],
      w = 19,
      h = 17;
    const face = k.back ? "" : (() => {
      const d = k.side ? -k.side : 1,
        fx = cx + d * 8,
        fy = cy - 3;
      return k.circle(fx, fy, 2.2, "#1a1020", GOLD, 0.7) + k.circle(fx + d * 6, fy + 4, 1.4, "#ff9ac0", "none", 0) +
        k.line(`M${fx + d * 6} ${fy + 4}l${d * 5} -1.6M${fx + d * 6} ${fy + 4}l${d * 5} 1.6`, "#f4f1f8", 0.6);
    })();
    const cloud = k.path(`M${cx - 10} ${cy + 7}q1 -4 5 -2.4q2 -3.6 6 -1q4 -1.4 4.6 2.4q-7.6 2 -15.6 1Z`, "none", GOLD, 0.9);
    const fringe = Array.from({ length: 7 }, (_, i) => k.line(`M${f(cx - w * 0.54 + i * w * 0.18)} ${cy + h + 1}v${4 + (i % 2) * 2}`, i % 2 ? "#ffd84a" : "#e8322a", 1)).join("");
    k.put("armR", fringe + cloud + face);
  },

  // Rice farmer: the head cloth turned into a checked khăn rằn knotted at
  // the back; the gùi's woven bamboo, its bound rim, and ripe panicles
  // bowed with grain.
  wombolder(k) {
    const y = k.ht + 12,
      w = k.side ? 42 : 48,
      h = 6;
    const n = k.side ? 9 : 13;
    const us = Array.from({ length: n }, (_, i) => -0.92 + (i / (n - 1)) * 1.84);
    const checks = us.map((u, i) => {
      const [px, py] = onBand(k, y, w, h, u);
      return k.rect(px - 1.3, py - (i % 2 ? 2.8 : 0), 2.6, 2.8, 0.3, "#5a3a1c", "none", 0);
    }).join("");
    let khan = k.path(bandPath(k, y, w, h), "#f2ead2", k.ink, 0.9) + checks + k.line(bandLine(k, y, w, h, 0.5, 1.5), "#5a3a1c", 0.5);
    if (k.back) khan += k.circle(k.hx, y + 1, 3.6, "#f2ead2", k.ink, 0.8) + k.path(`M${k.hx - 2} ${y + 3}l-5 12l4 0l3 -11Z M${k.hx + 2} ${y + 3}l6 11l3 -1l-6 -11Z`, "#f2ead2", k.ink, 0.6) + k.line(`M${k.hx - 5} ${y + 9}l3 1M${k.hx + 5} ${y + 9}l3 -1`, "#5a3a1c", 1);
    else if (k.side) {
      const kx = k.hx - k.side * (w - 3);
      khan += k.path(`M${kx} ${y + 2}l${-k.side * 9} 10l${k.side * 3} 2l${k.side * 7} -10Z`, "#f2ead2", k.ink, 0.6) + k.circle(kx, y + 2, 3.4, "#f2ead2", k.ink, 0.8);
    }
    k.put("flame", khan);
    // The gùi, where modern-viet.ts draws it.
    const s = k.side ? -k.side : 1;
    const [gx, gy] = k.back ? [k.C, k.T - 2] : [k.C + s * (k.side ? 20 : 44), k.T - 14];
    const weave = [3, 8, 13].map((dy) => k.line(`M${gx - 10 + dy * 0.14} ${gy + dy}H${gx + 10 - dy * 0.14}`, "#8a6a3a", 0.6)).join("") +
      [-6, -2, 2, 6].map((dx) => k.line(`M${gx + dx} ${gy + 1}L${gx + dx * 0.72} ${gy + 19}`, "#d8b878", 0.7)).join("");
    const panicle = (px: number, py: number, d: number) => k.path(`M${px} ${py}q${d * 4} -2 ${d * 6} 4`, "none", "#c8a83a", 1) +
      [0.3, 0.6, 0.9].map((u) => `<ellipse cx="${f(px + d * 6 * u)}" cy="${f(py + 4 * u * u - 1)}" rx="1.1" ry="0.7" fill="#f2c84a" stroke="#a8823a" stroke-width="0.3"/>`).join("");
    k.put(k.back ? "scarf" : "body", weave + k.rect(gx - 11.6, gy - 1.4, 23.2, 3.2, 1, "#6a4a24", k.ink, 0.6) +
      panicle(gx - 12, gy - 18, -1) + panicle(gx + 12, gy - 18, 1) + panicle(gx - 4, gy - 18, -1) + panicle(gx + 4, gy - 18, 1));
  },

  // Hát bội general: barred pheasant plumes with red pom-poms at their foot,
  // pom-poms on springs along the headdress; the back flags with saw-tooth
  // borders, a gold disc each and gilded spear tips.
  shadopus(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 24,
      bw = k.side ? 42 : 50;
    const plume = (s: number) => {
      const d = `M${x + s * 8} ${y - 6}C${x + s * 20} ${y - 50} ${x + s * 52} ${y - 52} ${x + s * 64} ${y - 30}`;
      return k.path(d, "none", "#3a2010", 3.4).replace("<path", '<path stroke-dasharray="1.6 3.8"') + k.path(d, "none", "#ffe8b0", 0.5) +
        k.circle(x + s * 8, y - 6, 3.6, "#e8322a", k.ink, 0.6);
    };
    const springs = (k.side ? [k.side * 18, -k.side * 6] : [-24, -12, 12, 24]).map((dx, i) => {
      const [px, py] = onBand(k, y, bw, 6, dx / bw);
      return k.path(`M${px} ${py - 3}q-1.4 -2 0 -3q1.4 -1 0 -3`, "none", GOLD, 0.6) + k.circle(px, py - 10.4, 2.4, i % 2 ? "#3fa04f" : "#e8322a", k.ink, 0.5);
    }).join("");
    k.put("flame", (k.side ? plume(-k.side) : plume(-1) + plume(1)) + springs);
    // The flags, where modern-viet.ts plants them.
    const angles = k.back ? [-2.4, -2.0, -1.15, -0.75] : [-2.95, -2.7, -0.44, -0.19];
    const trims = ["#ffd84a", "#e8322a", "#ffd84a", "#2f6fb8"];
    const fx0 = k.C,
      fy0 = k.back ? k.T + 4 : k.T + 6,
      len = k.back ? 30 : 64;
    const flags = angles.map((a, i) => {
      const ca = Math.cos(a),
        sa = Math.sin(a);
      const fx = fx0 + ca * len,
        fy = fy0 + sa * len;
      const nx = -sa * 10,
        ny = ca * 10;
      const mx = (fx + fx0) / 2 + nx * 0.2,
        my = (fy + fy0) / 2 + ny * 0.2;
      const ex = fx + nx,
        ey = fy + ny;
      // Saw teeth along the long edge, from the corner back to the pole.
      const teeth = Array.from({ length: 5 }, (_, j) => {
        const p = (u: number) => [ex + (mx - ex) * u, ey + (my - ey) * u];
        const [ax, ay] = p(j / 5),
          [bx, by] = p((j + 0.5) / 5),
          [cx2, cy2] = p((j + 1) / 5);
        return `M${f(ax)} ${f(ay)}L${f(bx + nx * 0.18)} ${f(by + ny * 0.18)}L${f(cx2)} ${f(cy2)}`;
      }).join("");
      // A gilded spear tip past the top of the pole.
      const tip = `M${f(fx - sa * 1.8)} ${f(fy + ca * 1.8)}L${f(fx + ca * 8)} ${f(fy + sa * 8)}L${f(fx + sa * 1.8)} ${f(fy - ca * 1.8)}Z`;
      return k.path(teeth, trims[i], k.ink, 0.4) + k.circle((fx + mx + ex) / 3, (fy + my + ey) / 3, k.back ? 1.4 : 2, GOLD, GOLD_DARK, 0.4) + k.path(tip, GOLD, GOLD_DARK, 0.5);
    }).join("");
    k.put(k.back ? "scarf" : "body", flags);
  },

  // Đồng Tháp: the lotus-leaf hat's radiating veins and paler rolled rim,
  // dew drops that glint, a bud opening its outer petals; a lotus seed pod
  // tucked in the áo bà ba's pocket.
  pangrove(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 8,
      w = k.side ? 42 : 50;
    const veins = [-0.85, -0.42, 0, 0.42, 0.85].map((u) => k.line(`M${x} ${y - 8}L${f(x + u * w * 0.9)} ${f(y + 4 - Math.abs(u) * 3)}`, "#2f6a3a", 0.6)).join("");
    const rim = k.path(`M${x - w} ${y + 6}Q${x} ${y - 2} ${x + w} ${y + 6}`, "none", "#8ac878", 1.4) + k.path(`M${x - w + 3} ${y + 4}Q${x - w * 0.5} ${y - 9} ${x} ${y - 12}`, "none", "#6aaa5a", 0.8);
    const dew = k.lume("twinkle", (k.side ? [[x - k.side * 16, y - 4]] : [[x - 22, y - 3], [x + 18, y - 6]]).map(([dx, dy]) => k.circle(dx, dy, 1.5, "#e0fbff", "#7ab8c8", 0.4)).join(""), 2, "#e0fbff");
    const petal = (s: number) => k.path(`M${x} ${y - 10}C${x + s * 10} ${y - 14} ${x + s * 10} ${y - 24} ${x + s * 3} ${y - 27}C${x + s * 4} ${y - 20} ${x + s * 2} ${y - 14} ${x} ${y - 10}Z`, "#ffc0d8", k.ink, 0.6);
    k.put("flame", veins + rim + dew + petal(-1) + petal(1) + k.lume("pulse", k.circle(x, y - 29, 1.4, GOLD_LIGHT, "none", 0), 1, "#ffb3cf"));
    if (k.back) return;
    const c = k.C + k.side * 3,
      px = c + (k.side ? k.side * 6 : -9.5),
      py = k.B - 15;
    k.put("body", k.line(`M${px} ${py + 6}L${px + 1} ${py + 1}`, "#3f8a4f", 1.2) +
      k.path(`M${px - 3.6} ${py}Q${px + 1} ${py - 3} ${px + 5.6} ${py}L${px + 4} ${py + 3}Q${px + 1} ${py + 4} ${px - 2} ${py + 3}Z`, "#5aa05a", k.ink, 0.6) +
      [-1.8, 1, 3.6].map((dx) => k.circle(px + dx, py + 0.4, 0.7, "#2f6a3a", "none", 0)).join(""));
  },

  // Ông đồ: the scroll mounted in blue silk with gold thread, ivory knobs on
  // its rollers and a hanging cord, the calligrapher's red seal (triện) on
  // the paper, and his brush (bút lông) beside it.
  mossloth(k) {
    const s = k.side ? -k.side : 1;
    const [x, y] = k.back ? [k.C, k.T - 4] : [k.C + s * (k.side ? 22 : 46), k.T - 30];
    const knobs = [y - 0.5, y + 30.5].map((ky) => k.circle(x - 10, ky, 1.7, "#f4ead0", k.ink, 0.5) + k.circle(x + 10, ky, 1.7, "#f4ead0", k.ink, 0.5)).join("");
    const silk = k.rect(x - 7, y + 1, 14, 4, 0, "#2f5f8a", k.ink, 0.5) + k.rect(x - 7, y + 25, 14, 3.4, 0, "#2f5f8a", k.ink, 0.5) +
      k.line(`M${x - 7} ${y + 4.4}H${x + 7}M${x - 7} ${y + 25.6}H${x + 7}`, GOLD, 0.6) +
      k.line(`M${x - 6.4} ${y + 5}V${y + 25}M${x + 6.4} ${y + 5}V${y + 25}`, "#2f5f8a", 1.2);
    const seal = k.rect(x - 5, y + 19.4, 3.6, 3.6, 0.4, "#c8202e", "none", 0) + k.line(`M${x - 4.2} ${y + 20.4}h2M${x - 3.2} ${y + 20.4}v2`, "#f4ead0", 0.4);
    const cord = k.path(`M${x - 8} ${y - 2}L${x} ${y - 9}L${x + 8} ${y - 2}`, "none", "#c8202e", 0.7);
    const brush = k.back ? "" : k.line(`M${x + s * 10} ${y + 28}L${x + s * 16} ${y + 6}`, "#c8a060", 1.6) + k.line(`M${x + s * 10} ${y + 28}L${x + s * 16} ${y + 6}`, "#8a6a3a", 0.4) +
      k.path(`M${x + s * 16 - 1} ${y + 6}l${s * 1.6} -6l${s * 0.6} 6Z`, "#1a1a22", k.ink, 0.4) + k.line(`M${x + s * 15.4} ${y + 7}h${s * 1.6}`, GOLD, 0.8);
    k.put(k.back ? "scarf" : "body", cord + silk + seal + knobs + brush);
    // The spectacles in tortoiseshell (đồi mồi) with gold hinges, and the
    // silk cord old scholars hang them by.
    if (k.back) return;
    const ly = k.ht + 40;
    const lenses = k.side ? [k.hx + k.side * 22] : [k.hx - 21, k.hx + 21];
    const rims = lenses.map((lx) => `<circle cx="${lx}" cy="${ly}" r="12" fill="none" stroke="#6a3a14" stroke-width="2.2"/>` +
      `<circle cx="${lx}" cy="${ly}" r="12" fill="none" stroke="#d8923a" stroke-width="1.2" stroke-dasharray="2.4 3.2"/>`).join("");
    const hinges = k.side ? [k.hx + k.side * 10] : [k.hx - 33, k.hx + 33];
    const arm = k.side ? k.line(`M${hinges[0]} ${ly - 2}L${k.hx - k.side * 6} ${ly - 5}`, "#6a3a14", 1.8) : "";
    const cords = hinges.map((hx) => {
      const d = k.side ? -k.side : hx < k.hx ? -1 : 1;
      return k.path(`M${hx} ${ly + 1}Q${hx + d * 5} ${ly + 16} ${hx - d * 2} ${ly + 30}`, "none", "#c8323a", 1.1);
    }).join("");
    k.put("flame", rims + arm + cords + hinges.map((hx) => k.circle(hx, ly - 1, 1.4, GOLD, GOLD_DARK, 0.4)).join(""));
  },
};

/**
 * Đèn Kéo Quân's own lantern on its crook becomes a red silk lồng đèn (its
 * own taken off, SkinArt.heldOff in viet-art.ts): ribs of bamboo, gold caps
 * and a red tassel, its glow showing through the silk.
 */
const ownLongDen = DETAILS.duskveil;
DETAILS.duskveil = (k) => {
  ownLongDen?.(k);
  const { x, y } = lanternSpot(k);
  k.put("tail", k.rect(x - 4.5, y - 15, 9, 3.4, 1, "#f2c14e", "#a8823a", 0.6) +
    k.lume("pulse", `<ellipse cx="${x}" cy="${y}" rx="10.5" ry="12" fill="#e8322a" stroke="${k.ink}" stroke-width="0.9"/>`, 2, "#ffb347") +
    [-0.55, 0, 0.55].map((u) => k.line(`M${x + u * 10.5} ${y - 11.5}Q${x + u * 15} ${y} ${x + u * 10.5} ${y + 11.5}`, "#a81c1c", 0.8)).join("") +
    k.circle(x, y, 3, "#ffd27a", "none", 0) +
    k.rect(x - 4.5, y + 11.6, 9, 3.4, 1, "#f2c14e", "#a8823a", 0.6) +
    k.line(`M${x - 1.6} ${y + 15}l-0.8 7M${x} ${y + 15}v8M${x + 1.6} ${y + 15}l0.8 7`, "#e8322a", 1.1));
};

legendDetails("vietlegend", DETAILS);

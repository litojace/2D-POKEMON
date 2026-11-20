import { legendDetails, malletHead, type Details } from "./legend-details";
import { onPole, type Kit } from "./modern-designs";
// Registers the costumes these details are drawn over.
import "./modern-stars";

/**
 * Stars & Stripes: each champion's own headwear and prop, worked up (see
 * legend-details.ts). Every piece comes from its own figure: tooled leather
 * and a silver concho on the sheriff's hat, a braided band and a feather on
 * the rodeo rider's, the sax's keys and bell rim, a satin band and a peeking
 * card on the magician's top hat, a gilded flame cage round Liberty's
 * torch... All drawn over the costume's own pieces, at their coordinates.
 */
const RED = "#c8323a",
  NAVY = "#1f2f5c",
  CREAM = "#f7f1e1",
  GOLD = "#f2c14e",
  GOLD_D = "#b8823a",
  GOLD_L = "#fff3a8",
  SILVER = "#e4e8ef",
  SILVER_D = "#9aa4b8";

const f = (v: number) => +v.toFixed(1);
/** A point along a quadratic curve. */
function qp(a: number[], c: number[], b: number[], t: number) {
  const u = 1 - t;
  return [f(u * u * a[0] + 2 * u * t * c[0] + t * t * b[0]), f(u * u * a[1] + 2 * u * t * c[1] + t * t * b[1])];
}
/**
 * Where something worn on the champion's left shows across the head or body,
 * as an offset from the centre: right of centre from the front, left of it
 * from behind, at the centre in the profile that turns that side to us, and
 * nowhere (null) in the other.
 */
const onLeft = (k: Kit, off: number) => (k.back ? -off : !k.side ? off : k.side < 0 ? 0 : null);
/** The same for something worn on the champion's right. */
const onRight = (k: Kit, off: number) => (k.back ? off : !k.side ? -off : k.side > 0 ? 0 : null);
/** A small glint that twinkles on metal or glass. */
const glint = (k: Kit, x: number, y: number, r: number, i: number, c = "#ffffff") =>
  k.lume("twinkle", k.path(k.star(x, y, r, 4, 0.3), c, "none", 0), i, c);
/** A silver concho: a scalloped disc with a domed centre. */
const concho = (k: Kit, x: number, y: number, r: number) =>
  k.path(k.star(x, y, r, 10, 0.8), SILVER, k.ink, 0.6) + k.circle(x, y, r * 0.58, "#c3cad6", SILVER_D, 0.5) + k.circle(x - r * 0.15, y - r * 0.18, r * 0.22, "#ffffff", "none", 0);

const DETAILS: Details = {
  // Sheriff: a tooled leather band set with silver conchos round a creased
  // cattleman crown, a rolled brim lip; the badge gets ball tips and an
  // engraved ring.
  terradon(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 16,
      w = 36,
      h = 28;
    // Crown creases: the long dent down the top and the pinches either side.
    const crease = k.side
      ? k.line(`M${x - k.side * 16} ${y - h + 4}Q${x} ${y - h + 8} ${x + k.side * 14} ${y - h + 5}`, "#6e4a24", 1.6)
      : k.line(`M${x - 9} ${y - h + 3}Q${x} ${y - h + 9} ${x + 9} ${y - h + 3}`, "#6e4a24", 1.6) +
        k.line(`M${x - 15} ${y - h + 8}Q${x - 13} ${y - 14} ${x - 15} ${y - 10}M${x + 15} ${y - h + 8}Q${x + 13} ${y - 14} ${x + 15} ${y - 10}`, "#7e5428", 1.1);
    // The brim's front lip catches the light; its ends curl up.
    const bw = w * 1.7;
    const lip = k.side
      ? k.line(`M${x - bw + 4} ${y + 0.5}Q${x} ${y + 5} ${x + bw - 4} ${y - 1.5}`, "#b88550", 1.3)
      : k.line(`M${x - bw + 4} ${y + 1}Q${x} ${y + 6.5} ${x + bw - 4} ${y + 1}`, "#b88550", 1.3) +
        k.path(`M${x - bw + 1} ${y}Q${x - bw - 2} ${y - 6} ${x - bw + 6} ${y - 7}Q${x - bw + 6} ${y - 3} ${x - bw + 10} ${y - 1}Z`, "#8a5a2c", k.ink, 0.8) +
        k.path(`M${x + bw - 1} ${y}Q${x + bw + 2} ${y - 6} ${x + bw - 6} ${y - 7}Q${x + bw - 6} ${y - 3} ${x + bw - 10} ${y - 1}Z`, "#8a5a2c", k.ink, 0.8);
    // The tooled band: dark leather, a stitched edge and stamped diamonds.
    const bx0 = x - 22.5,
      bx1 = x + 22.5;
    const band = k.path(`M${bx0} ${y - 2}Q${x} ${y - 6} ${bx1} ${y - 2}L${bx1} ${y - 9}Q${x} ${y - 13} ${bx0} ${y - 9}Z`, "#4a2e16", k.ink, 0.8) +
      [0.12, 0.3, 0.7, 0.88].map((t) => {
        const [px, py] = qp([bx0, y - 5.5], [x, y - 9.5], [bx1, y - 5.5], t);
        return k.path(`M${px} ${py - 2}l1.6 2l-1.6 2l-1.6 -2Z`, "#c8945a", "none", 0);
      }).join("") +
      k.line(`M${bx0 + 1} ${y - 3.2}Q${x} ${y - 7.2} ${bx1 - 1} ${y - 3.2}`, "#e8c896", 0.5).replace("/>", ' stroke-dasharray="1.2 1.2"/>');
    // Conchos round the band: three across the front or back, two from the side.
    const at = k.side ? [-0.3, 0.45] : [0.5, 0.22, 0.78];
    const conchos = at.map((t, i) => {
      const tt = k.side ? 0.5 + t : t;
      const [px, py] = qp([bx0, y - 5.5], [x, y - 9.5], [bx1, y - 5.5], tt);
      const r = i === 0 && !k.side ? 3.6 : 2.7;
      return concho(k, px, py, r) + (i === 0 && !k.back ? glint(k, px - 1, py - 1.4, 2.2, 0) : "");
    }).join("");
    k.put("flame", crease + lip + band + conchos);
    // The badge: a ball on each point and an engraved ring.
    if (!k.back) {
      const c = k.C + k.side * 3 - (k.side ? 0 : 11),
        cy = k.T + 14;
      k.put("body", Array.from({ length: 6 }, (_, i) => {
        const a = -Math.PI / 2 + (i * Math.PI) / 3;
        return k.circle(c + Math.cos(a) * 5.4, cy + Math.sin(a) * 5.4, 1.1, "#ffe9a0", GOLD_D, 0.5);
      }).join("") + `<circle cx="${c}" cy="${cy}" r="2.3" fill="none" stroke="${GOLD_D}" stroke-width="0.6"/>` + glint(k, c + 1.4, cy - 1.6, 1.8, 2));
    }
  },
  // Rodeo Rider: a straw crown with a braided horsehair band and a hawk
  // feather, the brim bound in red; a rope lasso with its honda knot and
  // tail, and a trophy buckle; pins on the back number.
  coilemur(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 18,
      w = 30,
      h = 20;
    const bw = w * 1.6;
    // Straw weave on the crown and a pinched top.
    const weave = (k.side ? [-12, -4, 4, 12] : [-14, -7, 0, 7, 14]).map((dx) => k.line(`M${x + dx} ${y - h + 3}Q${x + dx * 1.15} ${y - 10} ${x + dx * 1.1} ${y - 3}`, "#c9b48a", 0.7)).join("") +
      k.line(k.side ? `M${x - k.side * 12} ${y - h + 3}Q${x} ${y - h + 7} ${x + k.side * 10} ${y - h + 3}` : `M${x - 8} ${y - h + 2}Q${x} ${y - h + 7} ${x + 8} ${y - h + 2}`, "#a8946a", 1.3);
    // Red binding round the brim's edge.
    const binding = k.side
      ? k.line(`M${x - bw} ${y}Q${x} ${y + 6} ${x + bw} ${y - 2}`, RED, 1.6)
      : k.line(`M${x - bw} ${y}Q${x} ${y + 8} ${x + bw} ${y}`, RED, 1.8);
    // The braided band: two strands twisted, brown and cream.
    const bx0 = x - 18.6,
      bx1 = x + 18.6;
    const band = k.path(`M${bx0} ${y - 2}Q${x} ${y - 6} ${bx1} ${y - 2}L${bx1} ${y - 8}Q${x} ${y - 12} ${bx0} ${y - 8}Z`, "#6a4220", k.ink, 0.7) +
      Array.from({ length: 9 }, (_, i) => {
        const [px, py] = qp([bx0, y - 5], [x, y - 9], [bx1, y - 5], (i + 0.5) / 9);
        return k.path(`M${px - 1.8} ${py + 2}L${px + 0.4} ${py - 2.4}L${px + 2} ${py - 2.4}L${px - 0.2} ${py + 2}Z`, i % 2 ? "#f0e2c0" : "#a8742e", "none", 0);
      }).join("");
    // The feather, tucked in the band on the left, rising back.
    const fx = onLeft(k, 13);
    const feather = (bx: number, by: number, s: number) =>
      k.path(`M${bx} ${by}Q${bx - s * 4} ${by - 14} ${bx + s * 10} ${by - 28}Q${bx + s * 12} ${by - 12} ${bx + s * 4} ${by}Z`, "#b0662c", k.ink, 0.8) +
      [0.3, 0.5, 0.7, 0.88].map((t) => {
        const [px, py] = qp([bx + s * 2, by], [bx + s * 2, by - 14], [bx + s * 10, by - 28], t);
        return k.path(`M${px - s * 3} ${py + 1.5}L${px + s * 3.4} ${py - 1}L${px + s * 3.2} ${py + 0.6}L${px - s * 3} ${py + 3}Z`, "#f4e6c8", "none", 0);
      }).join("") + k.line(`M${bx + s * 2} ${by}Q${bx + s * 2} ${by - 14} ${bx + s * 10} ${by - 28}`, "#4a2a12", 0.7) +
      k.path(`M${bx + s * 9} ${by - 28}q${s * 2} -1 ${s * 2.6} -3.6q${-s * 2.6} 0.6 ${-s * 3.2} 2.6Z`, "#2a1a10", "none", 0);
    const tuck = fx === null ? feather(x - k.side * 10, y - h + 3, -k.side) : feather(x + fx, y - 7, k.side ? -k.side : fx >= 0 ? 1 : -1);
    k.put("flame", weave + binding + band + tuck);
    if (k.back) {
      // Safety pins at the corners of the back number.
      k.put("scarf", [-8, 8].map((dx) => k.line(`M${k.C + dx - 2} ${k.T + 6}h4`, SILVER_D, 1.2) + k.circle(k.C + dx + 2.4, k.T + 6, 0.9, SILVER, SILVER_D, 0.4)).join(""));
      return;
    }
    const c = k.C + k.side * 3;
    // The lasso: rope twists over the glowing coils, the honda knot and a tail.
    const lx = c + (k.side ? -k.side * 10 : -12),
      ly = k.B - 8;
    const twists = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return k.line(`M${f(lx + Math.cos(a) * 6 - 0.6)} ${f(ly + Math.sin(a) * 4 - 0.6)}l1.2 1.2`, "#8a5a2c", 0.6);
    }).join("");
    const tail = k.line(`M${lx + 5} ${ly + 2}Q${lx + 8} ${ly + 8} ${lx + 4} ${ly + 12}`, "#d8b878", 1.4) + k.line(`M${lx + 3} ${ly + 11}l1.4 2M${lx + 4.5} ${ly + 11}l0.4 2.2`, "#d8b878", 0.7);
    const honda = `<ellipse cx="${lx - 5}" cy="${ly - 2}" rx="1.8" ry="1.4" fill="none" stroke="#8a5a2c" stroke-width="1.1"/>`;
    // The trophy buckle: an engraved silver oval with a gold star.
    const bkx = c,
      bky = k.B + 1;
    const buckle = `<ellipse cx="${bkx}" cy="${bky}" rx="6" ry="4.2" fill="${SILVER}" stroke="${k.ink}" stroke-width="0.7"/>` +
      `<ellipse cx="${bkx}" cy="${bky}" rx="4.6" ry="3" fill="none" stroke="${SILVER_D}" stroke-width="0.6" stroke-dasharray="1 0.8"/>` +
      k.path(k.star(bkx, bky, 2.4, 5), GOLD, GOLD_D, 0.4) + glint(k, bkx + 3, bky - 2, 1.8, 1);
    k.put("body", twists + honda + tail + buckle);
  },
  // Jazz Cat: a pinched fedora with a red satin band, a bow and a gold
  // note pin; the sax gets an outlined tube, its keys, a mouthpiece and a
  // bell rim that glints.
  auralynx(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 18,
      w = 30,
      h = 16;
    const pinch = k.side
      ? k.line(`M${x - k.side * 12} ${y - h + 3}Q${x} ${y - h + 6} ${x + k.side * 13} ${y - h + 4}`, "#6a6a82", 1.5) +
        k.line(`M${x + k.side * 14} ${y - h + 4}q${k.side * 2} 4 ${k.side * 1} 7`, "#6a6a82", 1.2)
      : k.line(`M${x - 9} ${y - h + 2}Q${x} ${y - h + 6} ${x + 9} ${y - h + 2}`, "#6a6a82", 1.5) +
        k.line(`M${x - 8} ${y - h + 4}q-2 4 -1 8M${x + 8} ${y - h + 4}q2 4 1 8`, "#6a6a82", 1.2);
    // The snap brim's edge.
    const bw = w * 1.5;
    const edge = k.side ? k.line(`M${x - bw + 3} ${y + 0.5}Q${x} ${y + 5} ${x + bw - 3} ${y - 1.5}`, "#5a5a70", 1.1) : k.line(`M${x - bw + 3} ${y + 1}Q${x} ${y + 6.5} ${x + bw - 3} ${y + 1}`, "#5a5a70", 1.1);
    // The satin band, a bow and the note pin on the left.
    const bx0 = x - 18.6,
      bx1 = x + 18.6;
    const band = k.path(`M${bx0} ${y - 2}Q${x} ${y - 6} ${bx1} ${y - 2}L${bx1} ${y - 7}Q${x} ${y - 11} ${bx0} ${y - 7}Z`, RED, k.ink, 0.7) +
      k.line(`M${bx0 + 1} ${y - 5.5}Q${x} ${y - 9.3} ${bx1 - 1} ${y - 5.5}`, "#ff8a8a", 0.8);
    const px = onLeft(k, 12);
    let pin = "";
    if (px !== null) {
      const nx = x + px,
        ny = y - 6;
      pin = k.path(`M${nx - 1} ${ny}l-3.4 -2.2v4.4Z M${nx - 1} ${ny}l-3.4 2.2`, "#8a1c24", k.ink, 0.5) +
        // An eighth note in gold.
        `<ellipse cx="${nx + 1.4}" cy="${ny + 1.2}" rx="1.8" ry="1.3" fill="${GOLD}" stroke="${GOLD_D}" stroke-width="0.5" transform="rotate(-20 ${nx + 1.4} ${ny + 1.2})"/>` +
        k.line(`M${nx + 3} ${ny + 0.8}V${ny - 6}q2 1 3 3.4`, GOLD, 1.1) + glint(k, nx + 3, ny - 6, 1.8, 3);
    }
    k.put("flame", pinch + edge + band + pin);
    if (k.back) return;
    // The saxophone: an outlined tube, keys along it, mouthpiece, bell rim.
    const c = k.C + k.side * 3,
      s = k.side ? k.side : 1;
    const a = [c - s * 10, k.T + 4],
      m = [c - s * 4, k.T + 20],
      b = [c + s * 6, k.B - 6];
    const tube = `M${a[0]} ${a[1]}Q${m[0]} ${m[1]} ${b[0]} ${b[1]}`;
    const keys = [0.3, 0.45, 0.6, 0.75].map((t) => {
      const [px2, py2] = qp(a, m, b, t);
      return k.circle(px2 + s * 1.2, py2, 1.35, "#fff3c8", "#8a6420", 0.5);
    }).join("");
    const rod = (() => {
      const [x0, y0] = qp(a, m, b, 0.28),
        [x1, y1] = qp(a, m, b, 0.78);
      return k.line(`M${x0 - s * 1.6} ${y0}L${x1 - s * 1.4} ${y1}`, "#fff3a8", 0.6);
    })();
    const neck = k.line(`M${a[0]} ${a[1]}q${-s * 3} -2 ${-s * 3} -6`, GOLD, 2.4) + k.path(`M${a[0] - s * 3.8} ${a[1] - 5}l${s * 1.6} -3.4l${s * 1.2} 0.6l-${s * 0.6} 3.6Z`, "#2a2a36", k.ink, 0.5) +
      k.line(`M${a[0] - s * 4.4} ${a[1] - 5.6}l${s * 2.4} 0.6`, SILVER, 1);
    const bell = [b[0] + s * 4.5, b[1] - 0.5];
    const rim = `<ellipse cx="${bell[0]}" cy="${bell[1]}" rx="5.4" ry="2.4" fill="none" stroke="#fff0a0" stroke-width="1.4" transform="rotate(${s * 22} ${bell[0]} ${bell[1]})"/>`;
    k.put("body",
      k.line(tube, k.ink, 5) + k.line(tube, GOLD, 3.8) + k.line(`M${a[0] + s * 0.8} ${a[1]}Q${m[0] + s * 0.8} ${m[1]} ${b[0] + s * 0.8} ${b[1]}`, "#fff3a8", 0.8) +
        rod + keys + neck + k.lume("pulse", rim, 1, "#ffe066") + glint(k, bell[0] + s * 3, bell[1] - 2, 2.4, 4));
  },
  // Film Noir: a pinched fedora with a grosgrain band, its bow and a press
  // card tucked in; the reel badge gets a chrome rim, spokes and a strip of
  // film running off it; a buckle on the trench belt.
  duskveil(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 34,
      w = 32,
      h = 21;
    const bw = w * 1.5;
    const pinch = k.side
      ? k.line(`M${x - k.side * 13} ${y - h + 3}Q${x} ${y - h + 7} ${x + k.side * 14} ${y - h + 4}`, "#62627a", 1.5)
      : k.line(`M${x - 10} ${y - h + 2}Q${x} ${y - h + 7} ${x + 10} ${y - h + 2}`, "#62627a", 1.5) + k.line(`M${x - 9} ${y - h + 4}q-2 4 -1.2 8M${x + 9} ${y - h + 4}q2 4 1.2 8`, "#62627a", 1.2);
    const edge = k.side ? k.line(`M${x - bw + 3} ${y + 0.5}Q${x} ${y + 5} ${x + bw - 3} ${y - 1.5}`, "#62627a", 1.1) : k.line(`M${x - bw + 3} ${y + 1}Q${x} ${y + 6.5} ${x + bw - 3} ${y + 1}`, "#62627a", 1.1);
    const bx0 = x - 19.8,
      bx1 = x + 19.8;
    const band = k.path(`M${bx0} ${y - 1.5}Q${x} ${y - 5} ${bx1} ${y - 1.5}L${bx1} ${y - 6}Q${x} ${y - 9.5} ${bx0} ${y - 6}Z`, "#16161e", k.ink, 0.6) +
      Array.from({ length: 8 }, (_, i) => {
        const [px, py] = qp([bx0, y - 3.8], [x, y - 7.3], [bx1, y - 3.8], (i + 0.5) / 8);
        return k.line(`M${px} ${py - 1.6}v3.2`, "#2e2e3c", 0.6);
      }).join("");
    const px = onLeft(k, 13);
    let card = "";
    if (px !== null) {
      const cxp = x + px,
        cyp = y - 6;
      card = `<g transform="rotate(${k.back ? -14 : 14} ${cxp} ${cyp})">` + k.rect(cxp - 4.4, cyp - 11, 8.8, 11.5, 0.6, "#f4ecd2", k.ink, 0.7) +
        `<text x="${cxp}" y="${cyp - 6.4}" font-family="Arial Black,Arial,sans-serif" font-size="3.1" text-anchor="middle" fill="#1b1b24">PRESS</text>` +
        k.line(`M${cxp - 3} ${cyp - 4}h6M${cxp - 3} ${cyp - 2.4}h4.2`, "#8a8a96", 0.6) + "</g>" +
        k.path(`M${cxp - 1} ${cyp - 4}l-3 -2.2v4.4Z`, "#16161e", "#3a3a48", 0.5);
    }
    k.put("flame", pinch + edge + band + card);
    if (k.back) {
      k.put("scarf", k.rect(k.C - 3.5, k.B - 13, 7, 6, 1, "none", "#d8c08a", 1));
      return;
    }
    const c = k.C + k.side * 3;
    const rx = c + (k.side ? k.side * 3 : -10),
      ry = k.T + 12;
    // A strip of film running off the reel and curling at its end.
    const strip = k.path(`M${rx - 2} ${ry + 4}Q${rx - 6} ${ry + 12} ${rx - 1} ${ry + 18}L${rx + 3} ${ry + 16}Q${rx - 1} ${ry + 11} ${rx + 2} ${ry + 4}Z`, "#2a2a36", k.ink, 0.6) +
      [0.25, 0.5, 0.75].map((t) => {
        const [px2, py2] = qp([rx, ry + 4], [rx - 4, ry + 12], [rx + 1, ry + 17], t);
        return k.rect(px2 - 1, py2 - 1, 2, 2, 0.3, "#d8d0b0", "none", 0);
      }).join("");
    const rim = `<circle cx="${rx}" cy="${ry}" r="6.4" fill="none" stroke="${SILVER}" stroke-width="1.3"/>` +
      [0, 1, 2].map((i) => {
        const a = -Math.PI / 2 + (i * Math.PI * 2) / 3;
        return k.line(`M${rx} ${ry}L${f(rx + Math.cos(a) * 5)} ${f(ry + Math.sin(a) * 5)}`, SILVER_D, 0.8);
      }).join("") + k.circle(rx, ry, 1.3, SILVER, k.ink, 0.4);
    // The belt buckle.
    const buckle = k.rect(c - 3.5, k.B - 13, 7, 6, 1, "none", "#d8c08a", 1.1) + k.line(`M${c} ${k.B - 12}v4`, "#d8c08a", 0.9);
    k.put("body", strip + rim + buckle + glint(k, rx + 3.4, ry - 4, 1.8, 6));
  },
  // Stage Magician: a satin top hat (a sheen down the crown, a lit rim on
  // top, a satin band with its bow) with a card peeking from the band; a fan
  // of cards at the coat (its wand is the mallet, below).
  astrabun(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    const sheen = k.path(`M${x - 10} ${y - 30}h3.8v20h-3.8Z`, "#5a5a7a", "none", 0) + k.line(`M${x - 4} ${y - 30}v20`, "#4a4a66", 1);
    const top = `<ellipse cx="${x}" cy="${y - 32}" rx="14" ry="2.8" fill="#3a3a4c" stroke="${k.ink}" stroke-width="0.8"/>`;
    const lip = k.line(`M${x - 22} ${y + 0.6}Q${x} ${y + 5.6} ${x + 22} ${y + 0.6}`, "#55556e", 1.1);
    // The card, tucked behind the band on the left, peeking up.
    const px = onLeft(k, 7);
    let card = "";
    if (px !== null) {
      const cxp = x + px,
        cyp = y - 11;
      const tilt = k.back ? -16 : 16;
      card = `<g transform="rotate(${tilt} ${cxp} ${cyp})">` + k.rect(cxp - 4, cyp - 11, 8, 11, 1, "#ffffff", k.ink, 0.7) +
        k.rect(cxp - 3, cyp - 10, 6, 9, 0.6, "none", RED, 0.5) + k.path(k.star(cxp, cyp - 6, 2.2, 5), RED, "none", 0) + "</g>";
    }
    // The satin band (over the card's foot), its sheen and a bow.
    const band = k.rect(x - 14, y - 9, 28, 5.6, 0, RED, k.ink, 0.6) + k.line(`M${x - 13.5} ${y - 7.4}H${x + 13.5}`, "#ff9a9a", 0.8);
    const bx = onRight(k, 10);
    const bow = bx === null ? "" : k.path(`M${x + bx} ${y - 6.2}l-3.6 -2.6v5.2Z M${x + bx} ${y - 6.2}l3.6 -2.6v5.2Z`, "#9a1c26", k.ink, 0.5) + k.circle(x + bx, y - 6.2, 1.1, "#ff9a9a", "none", 0);
    k.put("flame", sheen + top + lip + card + band + bow);
    if (k.back) return;
    // A fan of three cards at the coat.
    const c = k.C + k.side * 3;
    const fx = c + (k.side ? k.side * 5 : 11),
      fy = k.B - 6;
    const cardAt = (a: number, suit: string, col: string) =>
      `<g transform="rotate(${a} ${fx} ${fy + 4})">` + k.rect(fx - 3, fy - 5, 6, 8.5, 0.8, "#ffffff", k.ink, 0.6) + (suit === "star" ? k.path(k.star(fx, fy - 1, 1.8, 5), col, "none", 0) : k.path(`M${fx} ${fy - 3}l1.8 2l-1.8 2l-1.8 -2Z`, col, "none", 0)) + "</g>";
    k.put("body", cardAt(-24, "diamond", RED) + cardAt(0, "star", "#2a2a36") + cardAt(24, "star", RED) + glint(k, fx + 4, fy - 6, 1.8, 3));
  },
  // Fourth of July: a red, white and blue rosette on the hat band, white
  // piping on the brim, a lit rim on the crown; the sparkler bursts.
  sunbara(k) {
    const x = k.hx + k.side * 3,
      y = k.ht + 8;
    const top = `<ellipse cx="${x}" cy="${y - 34}" rx="18" ry="3" fill="#ffffff" stroke="${k.ink}" stroke-width="0.8"/>` + k.line(`M${x - 13} ${y - 34.6}Q${x} ${y - 37} ${x + 13} ${y - 34.6}`, RED, 0.9);
    const piping = k.line(`M${x - 28} ${y + 0.6}Q${x} ${y + 7.6} ${x + 28} ${y + 0.6}`, "#ffffff", 1.3);
    // The rosette on the champion's right.
    const rx = onRight(k, 12);
    const ros = (() => {
      if (rx === null) return "";
      const cx0 = x + rx,
        cy0 = y - 5;
      return k.path(`M${cx0 - 2} ${cy0 + 2}l-2.4 8l2.4 -1.6l1 2.4Z M${cx0 + 2} ${cy0 + 2}l2.4 8l-2.4 -1.6l-1 2.4Z`, RED, k.ink, 0.5) +
        k.path(k.star(cx0, cy0, 6.4, 12, 0.82), NAVY, k.ink, 0.6) + k.path(k.star(cx0, cy0, 4.6, 12, 0.8), "#ffffff", "none", 0) +
        k.circle(cx0, cy0, 3.2, RED, "none", 0) + k.path(k.star(cx0, cy0, 2.4, 5), GOLD, GOLD_D, 0.4);
    })();
    // The sparkler's burst: rays round its tip.
    const sx = x + 26,
      sy = y - 42;
    const rays = Array.from({ length: 8 }, (_, i) => {
      const a = (i / 8) * Math.PI * 2 + 0.2;
      const r0 = 3.4,
        r1 = i % 2 ? 7 : 9.5;
      return k.line(`M${f(sx + Math.cos(a) * r0)} ${f(sy + Math.sin(a) * r0)}L${f(sx + Math.cos(a) * r1)} ${f(sy + Math.sin(a) * r1)}`, i % 2 ? "#ffd84a" : "#fff3a8", 1);
    });
    const burst = k.lume("twinkle", rays.filter((_, i) => i % 2 === 0).join(""), 1, "#fff3a8") + k.lume("twinkle", rays.filter((_, i) => i % 2).join(""), 5, "#ffd84a") +
      k.lume("pulse", k.circle(sx, sy, 2.4, "#ffffff", "#ffd84a", 0.8), 2, "#fff3a8");
    k.put("flame", `<g transform="rotate(${k.side ? k.side * 6 : -8} ${x} ${y})">` + top + piping + ros + burst + "</g>");
  },
  // Ace Pitcher: stitched panels to the cap's button, an embroidered A, a
  // stitched visor, the snapback strap behind; lacing on the glove and red
  // stitches on the ball.
  pyranda(k) {
    const x = k.hx + k.side * 2,
      cy = k.ht + 18,
      cw = k.side ? 30 : 36;
    const by0 = cy - 26.5;
    const seams = (k.side ? [-0.55, 0.15, 0.7] : k.back ? [-0.5, 0, 0.5] : [-0.55, 0.55]).map((u) =>
      k.line(`M${x} ${by0}Q${x + u * cw * 0.9} ${cy - 22} ${x + u * cw} ${cy - 1}`, "#33477e", 1)).join("");
    let cap = seams + k.circle(x, by0, 2.2, RED, k.ink, 0.6);
    if (k.back) {
      // The snapback: an arched opening, a strap with holes and a tab.
      cap += k.path(`M${x - 9} ${cy}Q${x - 9} ${cy - 10} ${x} ${cy - 10}Q${x + 9} ${cy - 10} ${x + 9} ${cy}`, "none", "#13204a", 2) +
        k.rect(x - 9, cy - 4, 18, 3.6, 1, "#13204a", k.ink, 0.5) + [-5, -1.5, 2].map((dx) => k.circle(x + dx, cy - 2.2, 0.7, SILVER, "none", 0)).join("") + k.rect(x + 4, cy - 4.4, 4, 4.4, 0.8, SILVER, k.ink, 0.4);
    } else if (k.side) {
      cap += k.line(`M${x + k.side * cw * 0.7} ${cy + 0.6}Q${x + k.side * (cw + 14)} ${cy + 0.4} ${x + k.side * (cw + 18)} ${cy + 3.2}`, "#e8e8f2", 0.6).replace("/>", ' stroke-dasharray="1.2 1"/>');
    } else {
      cap += k.line(`M${x - cw + 8} ${cy + 1.6}Q${x} ${cy + 8.6} ${x + cw - 8} ${cy + 1.6}`, "#e8e8f2", 0.6).replace("/>", ' stroke-dasharray="1.2 1"/>') +
        `<text x="${x}" y="${cy - 9}" font-family="Brush Script MT,cursive" font-size="12" text-anchor="middle" fill="${RED}" stroke="#ffffff" stroke-width="2.4" paint-order="stroke" stroke-linejoin="round">A</text>` +
        k.circle(x + 7, cy - 18, 1, GOLD, "none", 0);
    }
    k.put("flame", cap);
    if (k.back) return;
    const c = k.C + k.side * 3;
    const bx = c + (k.side ? k.side * 4 : 12),
      by = k.B - 8;
    // The glove's lacing and the ball's stitches, either side of its seams.
    const lacing = k.line(`M${bx - 6} ${by + 3}q-1 -6 2 -9M${bx + 5} ${by + 4}q2 -3 1 -7`, "#d8a050", 0.9).replace("/>", ' stroke-dasharray="1.4 1"/>') +
      k.path(`M${bx - 8} ${by + 5}l3 1.6l-2 1.6Z`, "#6a3e18", k.ink, 0.5);
    const stitches = [-1, 1].map((s) => [0, 1, 2].map((i) => k.line(`M${bx + s * (2.4 - (i === 1 ? 0.9 : 0))} ${by - 5.4 + i * 2.2}l${s * 1.4} -0.7`, RED, 0.6)).join("")).join("");
    k.put("body", lacing + stitches + glint(k, bx - 1.6, by - 4.8, 1.6, 2));
  },
  // Linebacker: a glossy shell with a star decal each side, a padded rim,
  // snaps and a hanging chin strap; a laced football tucked at the side.
  wombolder(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 22,
      w = k.side ? 46 : 52,
      top = k.ht - 14;
    const decal = (dx: number, dy: number, r: number) => k.circle(x + dx, y + dy, r, NAVY, k.ink, 0.7) + k.path(k.star(x + dx, y + dy, r * 0.72, 5), "#ffffff", "none", 0);
    const decals = k.side ? decal(-k.side * 10, -12, 8) : [-30, 30].map((dx) => decal(dx, -12, 6.4)).join("");
    const gloss = k.line(`M${x - w * 0.62} ${y - 8}Q${x - w * 0.55} ${top + 8} ${x - w * 0.18} ${top + 4}`, "#ffffff", 2.4).replace("/>", ' opacity=".55"/>');
    const rim = k.line(`M${x - w + 1} ${y + 5}Q${x} ${y - 5} ${x + w - 1} ${y + 5}`, "#3a3a48", 3);
    // A snap each side, and the chin strap hanging from it.
    const snaps = (k.side ? [x + k.side * (w - 10)] : [x - w + 6, x + w - 6]).map((sx, i) =>
      k.circle(sx, y + 1, 2, SILVER, k.ink, 0.6) + k.path(`M${sx - 1.6} ${y + 2}l${i ? 1 : -1} 12h3.6l${i ? 1.4 : 0.6} -12Z`, "#f4f4f8", k.ink, 0.5)).join("");
    k.put("flame", `<g transform="translate(0 -12)">` + gloss + decals + rim + snaps + "</g>");
    // The football, tucked at the right side.
    const c = k.C + k.side * 3;
    const side = onRight(k, 15);
    if (side === null) return;
    const fx = k.back ? k.C + k.W - 2 : c + (k.side ? k.side * 2 : side),
      fy = k.B - 9,
      rot = k.back ? 30 : k.side ? k.side * -20 : -30;
    const ball = `<g transform="rotate(${rot} ${fx} ${fy})">` + `<ellipse cx="${fx}" cy="${fy}" rx="8" ry="5" fill="#8a4a24" stroke="${k.ink}" stroke-width="0.8"/>` +
      k.line(`M${fx - 5.6} ${fy - 3}q-0.8 3 0 6M${fx + 5.6} ${fy - 3}q0.8 3 0 6`, "#ffffff", 1) +
      k.line(`M${fx - 2.6} ${fy - 1.6}h5.2`, "#ffffff", 0.9) + [-1.8, -0.6, 0.6, 1.8].map((dx) => k.line(`M${fx + dx} ${fy - 2.6}v2`, "#ffffff", 0.6)).join("") +
      k.line(`M${fx - 4} ${fy + 2}q4 1.6 8 0`, "#b06a3a", 0.8) + "</g>";
    k.put(k.back ? "scarf" : "body", ball);
  },
  // Space Ranger: mission-star caps on the headset's cups in chrome rings,
  // banded antenna, a mic boom with a lit tip; twin rocket tanks on the back
  // with glowing nozzles.
  voltkit(k) {
    const cy = k.ht + 46;
    const cups = k.side ? [k.hx - k.side * 18] : [k.hx - 52, k.hx + 52];
    const ax = k.side ? cups[0] : k.hx + 52;
    const cap = (x: number) => `<circle cx="${x}" cy="${cy}" r="7.2" fill="none" stroke="${SILVER_D}" stroke-width="1.2"/>` +
      k.circle(x, cy, 5.4, NAVY, k.ink, 0.6) + k.path(k.star(x, cy, 3.8, 5), "#ffffff", "none", 0) + `<circle cx="${x}" cy="${cy}" r="5.4" fill="none" stroke="${RED}" stroke-width="0.9"/>`;
    const bands = [0.35, 0.65].map((t) => k.line(`M${ax + 4 * t - 1.6} ${cy - 6 - 20 * t}h3.2`, GOLD, 1.6)).join("") +
      `<circle cx="${ax + 4}" cy="${cy - 27}" r="3.6" fill="none" stroke="${SILVER_D}" stroke-width="0.6"/>`;
    // The mic boom runs from the cup round under the eyes to the mouth.
    let boom = "";
    if (!k.back) {
      const s = k.side || 1;
      const bx = k.side ? cups[0] : k.hx + 50,
        ex = k.side ? bx + s * 34 : k.hx + 26,
        ey = cy + 26;
      const arm = `M${bx} ${cy + 6}Q${bx + s * (k.side ? 4 : -2)} ${ey} ${ex} ${ey}`;
      boom = k.line(arm, "#2a2f40", 3) + k.line(arm, "#c8ccd8", 1.6) +
        `<ellipse cx="${ex - s * 1}" cy="${ey}" rx="3.2" ry="2.4" fill="#2a2f40" stroke="${k.ink}" stroke-width="0.6"/>` +
        k.lume("pulse", k.circle(ex - s * 2.6, ey, 1.1, "#5aff7a", "none", 0), 1, "#5aff7a");
    }
    k.put("flame", cups.map(cap).join("") + bands + boom);
    if (!k.back) return;
    // Twin rocket tanks on the back, on a strap with a status light.
    const y = k.T + 1;
    const tanks = [-1, 1].map((s, i) => {
      const tx = k.C + s * 6.5;
      return k.rect(tx - 5.6, y, 11.2, 25, 5.6, "#b8c2d4", k.ink, 0.9) + k.rect(tx - 5.6, y + 7, 11.2, 3.4, 0, RED, "none", 0) + k.rect(tx - 5.6, y + 10.4, 11.2, 1.4, 0, NAVY, "none", 0) +
        k.line(`M${tx - 3} ${y + 3}v19`, "#ffffff", 1.4) + k.path(`M${tx - 3.6} ${y + 25}h7.2l1.6 4.4h-10.4Z`, "#5a6078", k.ink, 0.7) +
        k.lume("pulse", k.path(`M${tx - 3.2} ${y + 29.8}Q${tx} ${y + 38} ${tx + 3.2} ${y + 29.8}Z`, "#ffb347", "none", 0) + k.path(`M${tx - 1.4} ${y + 29.8}Q${tx} ${y + 34.4} ${tx + 1.4} ${y + 29.8}Z`, "#fff3a8", "none", 0), i, "#ffb347");
    }).join("");
    k.put("scarf", k.rect(k.C - 12, k.T + 4, 24, 4, 1.5, "#5a6078", k.ink, 0.6) + tanks + k.lume("blink", k.circle(k.C, k.T + 6, 1.4, "#5aff7a", "none", 0), 0, "#5aff7a"));
  },
  // Hot-Rod Racer: chrome-rimmed goggles with amber lenses, rivets and a
  // glint, on a stitched strap buckled behind; crossed checkered flags on
  // the chest, a racing roundel on the back.
  cindrake(k) {
    const y = k.ht + 20;
    const checks = (x: number, yy: number, s: number) =>
      k.rect(x, yy, 7, 5, 0, "#ffffff", k.ink, 0.5) + [0, 1, 2].map((i) => [0, 1].map((j) => ((i + j) % 2 ? "" : k.rect(x + i * 2.33, yy + j * 2.5, 2.33, 2.5, 0, "#1b1b24", "none", 0))).join("")).join("") +
      k.line(`M${x + (s > 0 ? 0 : 7)} ${yy}l${-s * 3} 9`, "#8a8a96", 0.9);
    if (k.back) {
      // The strap round the back of the head and its buckle; the roundel.
      k.put("flame", k.line(`M${k.hx - 46} ${y + 6}Q${k.hx} ${y - 4} ${k.hx + 46} ${y + 6}`, "#5a3a22", 3) +
        k.line(`M${k.hx - 44} ${y + 5}Q${k.hx} ${y - 4.6} ${k.hx + 44} ${y + 5}`, "#c8945a", 0.5).replace("/>", ' stroke-dasharray="1.2 1.2"/>') +
        k.rect(k.hx - 4, y - 2.6, 8, 6, 1, "none", SILVER, 1.4) + k.line(`M${k.hx} ${y - 2}v5`, SILVER, 0.9));
      k.put("scarf", k.circle(k.C, k.T + 10, 7.4, "#ffffff", k.ink, 0.8) + `<circle cx="${k.C}" cy="${k.T + 10}" r="6" fill="none" stroke="${RED}" stroke-width="1"/>` +
        `<text x="${k.C}" y="${k.T + 13.6}" font-family="Arial Black,Arial,sans-serif" font-size="9.5" text-anchor="middle" fill="#1b1b24">8</text>`);
      return;
    }
    const xs = k.side ? [k.hx + k.side * 16] : [k.hx - 16, k.hx + 16];
    const lens = (x: number, i: number) =>
      k.circle(x, y, 6.6, "#ff9a3a", "none", 0).replace("/>", ' opacity=".55"/>') + k.path(`M${x - 6} ${y + 2}Q${x} ${y + 7} ${x + 6} ${y + 2}Q${x} ${y + 4} ${x - 6} ${y + 2}Z`, "#c8501a", "none", 0).replace("/>", ' opacity=".6"/>') +
      `<circle cx="${x}" cy="${y}" r="8" fill="none" stroke="${SILVER}" stroke-width="1"/>` + `<circle cx="${x}" cy="${y}" r="6.4" fill="none" stroke="#7a5a2a" stroke-width="0.6"/>` +
      [-2.4, -1.6, -0.8, 0.8, 1.6, 2.4].map((a) => k.circle(x + Math.cos(a - Math.PI / 2) * 8, y + Math.sin(a - Math.PI / 2) * 8, 0.75, "#ffffff", "none", 0)).join("") +
      glint(k, x - 2.6, y - 2.6, 2.4, i);
    const bridge = k.side ? "" : k.line(`M${xs[0] + 8} ${y - 1}Q${k.hx} ${y - 4} ${xs[1] - 8} ${y - 1}`, SILVER, 1.6);
    const strap = k.line(`M${k.hx - 42} ${y + 5.2}Q${k.hx} ${y - 6.4} ${k.hx + 42} ${y + 5.2}`, "#c8945a", 0.5).replace("/>", ' stroke-dasharray="1.2 1.2"/>');
    k.put("flame", strap + xs.map(lens).join("") + bridge);
    // Crossed checkered flags on the chest, opposite the flame decals.
    const c = k.C + k.side * 3;
    const px = c + (k.side ? k.side * 2 : 9),
      py = k.T + 10;
    k.put("body", `<g transform="rotate(-14 ${px} ${py})">` + checks(px - 8, py, 1) + "</g>" + `<g transform="rotate(14 ${px} ${py})">` + checks(px + 1, py, -1) + "</g>");
  },
  // Malibu Surfer: mirrored shades with a sunset in the lenses, hinge studs
  // and their arms; a neon strap behind; the surfboard gets rail stripes, a
  // hibiscus, its fin and a coiled leash.
  tidefin(k) {
    const neon = "#ff4fd8";
    const y = k.ht + 8;
    if (k.back) {
      k.put("flame", k.line(`M${k.hx - 44} ${y + 4}Q${k.hx} ${y - 6} ${k.hx + 44} ${y + 4}`, neon, 2.2) + k.line(`M${k.hx - 44} ${y + 4}Q${k.hx} ${y - 6} ${k.hx + 44} ${y + 4}`, "#ffffff", 0.6).replace("/>", ' stroke-dasharray="2 3"/>'));
    } else {
      const xs = k.side ? [k.hx + k.side * 14] : [k.hx - 15, k.hx + 15];
      const lens = (x: number) =>
        k.path(`M${x - 8.6} ${y + 0.6}H${x + 8.6}V${y + 1.2}Q${x + 8.6} ${y + 3.6} ${x + 5} ${y + 3.6}H${x - 5}Q${x - 8.6} ${y + 3.6} ${x - 8.6} ${y + 1.2}Z`, "#ff8a3a", "none", 0) +
        k.path(`M${x - 8.6} ${y - 1.6}H${x + 8.6}V${y + 0.6}H${x - 8.6}Z`, "#ff4f8a", "none", 0).replace("/>", ' opacity=".8"/>') +
        k.line(`M${x - 5} ${y - 3}l3.4 -1.8M${x - 2} ${y - 2.4}l3.4 -1.8`, "#ffffff", 1);
      const studs = (k.side ? [xs[0] - k.side * 10] : [xs[0] - 10, xs[1] + 10]).map((sx) => k.circle(sx, y - 3, 1.3, SILVER, k.ink, 0.5)).join("");
      const arm = k.side ? k.line(`M${xs[0] - k.side * 10} ${y - 3}Q${xs[0] - k.side * 26} ${y - 4} ${xs[0] - k.side * 36} ${y + 2}`, neon, 1.6) : "";
      k.put("flame", arm + xs.map(lens).join("") + studs);
    }
    // The surfboard: drawn where the costume draws it, in its tilt.
    const s = k.side ? -k.side : -1;
    const bx = k.back ? k.C : k.C + s * (k.side ? 34 : 58),
      by = k.back ? k.T + 4 : k.T - 10;
    const board = `<g transform="rotate(${s * 18} ${bx} ${by})">` +
      `<ellipse cx="${bx}" cy="${by}" rx="6" ry="27.4" fill="none" stroke="#ff8a3a" stroke-width="1.8"/>` +
      `<ellipse cx="${bx}" cy="${by}" rx="4" ry="24.6" fill="none" stroke="#2f8fb0" stroke-width="1"/>` +
      // A hibiscus off the stringer.
      Array.from({ length: 5 }, (_, i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return k.circle(bx - 3.2 + Math.cos(a) * 2, by + 9 + Math.sin(a) * 2, 1.8, "#ff3f7f", k.ink, 0.3);
      }).join("") + k.circle(bx - 3.2, by + 9, 1, "#ffd84a", "none", 0) +
      k.path(`M${bx - 2} ${by + 27}Q${bx} ${by + 37} ${bx + 4.4} ${by + 37}Q${bx + 2} ${by + 32} ${bx + 2} ${by + 27}Z`, "#2f8fb0", k.ink, 0.8) + "</g>";
    // The leash, coiled from the tail.
    const tail = [bx + Math.sin((-s * 18 * Math.PI) / 180) * 28, by + Math.cos((s * 18 * Math.PI) / 180) * 28];
    const leash = k.line(`M${f(tail[0])} ${f(tail[1])}q${-s * 4} 4 ${-s * 2} 7q${s * 3} 2 ${s * 1} 5q${-s * 3} 1 ${-s * 1} 4`, "#2b2f3d", 1);
    if (k.back) k.put("scarf", board + leash);
    else k.put("body", board + leash, true);
  },
  // Lady Liberty: lit windows along the crown's band, ridges on its rays and
  // a verdigris edge; the torch gets a gilded flame cage over its fire and a
  // railed balcony; the tablet its date in numerals.
  mystowl(k) {
    const x = k.hx + k.side * 3,
      y = k.ht + 12;
    const w = k.side ? 38 : 44;
    const n = k.side ? 4 : 7;
    const ridges = k.back ? "" : Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1);
      const ang = k.side ? -Math.PI / 2 + k.side * (u - 0.1) * 1.4 : -Math.PI / 2 + (u - 0.5) * 2.2;
      const bx = x + Math.cos(ang) * w * 0.55,
        by = y - 2 + Math.sin(ang) * 6;
      return k.line(`M${f(bx + Math.cos(ang) * 4)} ${f(by + Math.sin(ang) * 4)}L${f(bx + Math.cos(ang) * 14)} ${f(by + Math.sin(ang) * 14)}`, "#ffffff", 0.7);
    }).join("");
    const edge = k.line(`M${x - w + 1} ${y + 2.6}Q${x} ${y - 7} ${x + w - 1} ${y + 2.6}`, "#bff0dc", 1);
    const nw = k.back ? 0 : k.side ? 5 : 7;
    const windows = Array.from({ length: nw }, (_, i) => {
      const t = k.side ? 0.4 + (i / (nw - 1)) * 0.5 : 0.14 + (i / (nw - 1)) * 0.72;
      const [px, py] = qp([x - w, y + 5], [x, y - 5], [x + w, y + 5], t);
      return k.rect(px - 1.5, py - 1.6, 3, 3.2, 0.6, "#2a3f5c", k.ink, 0.4) + k.lume("pulse", k.rect(px - 0.9, py - 1, 1.8, 2, 0.3, "#ffd27a", "none", 0), i, "#ffd27a");
    }).join("");
    // From behind: the band's riveted seams.
    const rivets = k.back ? [-0.3, 0, 0.3].map((t) => {
      const [px, py] = qp([x - w, y + 5], [x, y - 5], [x + w, y + 5], 0.5 + t);
      return k.line(`M${px} ${py - 2.6}v5.2`, "#3f7f6c", 0.9) + k.circle(px, py - 1.4, 0.6, "#bff0dc", "none", 0) + k.circle(px, py + 1.4, 0.6, "#bff0dc", "none", 0);
    }).join("") : "";
    k.put("flame", ridges + edge + windows + rivets);
    // The torch: a gilded cage round the flame, a railed balcony, grip rings.
    onPole(k, (tx, ty) => `<g transform="translate(${tx} ${ty}) scale(1.4) translate(${-tx} ${-ty})">` + k.path(`M${tx} ${ty - 12}Q${tx + 8.6} ${ty - 2} ${tx + 5} ${ty + 4}H${tx - 5}Q${tx - 8.6} ${ty - 2} ${tx} ${ty - 12}Z`, "none", GOLD, 1.1) +
      k.line(`M${tx} ${ty - 11}V${ty + 4}M${tx - 4.6} ${ty - 3}Q${tx} ${ty - 5} ${tx + 4.6} ${ty - 3}`, GOLD_D, 0.8) +
      `<ellipse cx="${tx}" cy="${ty + 4.4}" rx="7" ry="2" fill="${GOLD}" stroke="${k.ink}" stroke-width="0.6"/>` +
      [-4.5, -1.5, 1.5, 4.5].map((dx) => k.line(`M${tx + dx} ${ty + 4.4}v2.4`, GOLD_D, 0.6)).join("") +
      k.line(`M${tx - 3.4} ${ty + 7.8}h6.8M${tx - 3} ${ty + 9.6}h6`, GOLD, 0.9) + glint(k, tx + 4, ty - 6, 2.2, 4) + "</g>");
    // The tablet's date, in numerals.
    if (!k.back) {
      const c = k.C + k.side * 3;
      // In the tablet's own glow, so the light never washes it out.
      k.put("body", k.lume("pulse", `<text x="${c}" y="${k.B - 12.8}" font-family="Georgia,serif" font-weight="700" font-size="4.6" text-anchor="middle" fill="#3f7f6c">IV</text>` + k.line(`M${c - 3.6} ${k.B - 17}h7.2`, "#3f7f6c", 0.5), 0, "#ffffff"));
    }
  },
  // Neon Diner: the folded paper cap gets pink piping, a crease and a neon
  // cherry pin; stripes on the straw and a glint on the glass.
  lumoth(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 14;
    let cap: string;
    if (k.side) {
      cap = k.line(`M${x - 25} ${y + 0.6}Q${x} ${y - 3.4} ${x + 25} ${y + 0.6}`, "#ff6fae", 2) + k.line(`M${x - 16} ${y - 12}H${x + 16}`, "#ff6fae", 1.4) +
        k.line(`M${x - 22} ${y - 6}Q${x} ${y - 9} ${x + 22} ${y - 6}`, "#e0e8ec", 0.8);
    } else {
      cap = k.line(`M${x - 23.4} ${y + 1.6}Q${x} ${y - 3.2} ${x + 23.4} ${y + 1.6}`, "#ff6fae", 2) + k.line(`M${x - 19} ${y - 9}Q${x} ${y - 17} ${x + 19} ${y - 9}`, "#ff6fae", 1.4) +
        k.line(`M${x} ${y - 13}V${y - 3}`, "#d8e2e8", 0.9);
    }
    // The neon cherry pin on the cap's left side.
    const px = onLeft(k, 12);
    const pin = px === null ? "" : k.lume("pulse", k.circle(x + px - 1.4, y - 4, 2, "#ff3a5a", k.ink, 0.5) + k.circle(x + px + 2, y - 3.4, 2, "#ff3a5a", k.ink, 0.5) + k.line(`M${x + px - 1.2} ${y - 6}q1.6 -3 3.6 -3.6M${x + px + 2} ${y - 5.4}l0.4 -3.2`, "#5aff7a", 0.9), 2, "#ff3a5a");
    k.put("flame", cap + pin);
    if (k.back) return;
    const c = k.C + k.side * 3;
    const mx = c + (k.side ? k.side * 5 : 11),
      my = k.T + 12;
    k.put("body", [0.25, 0.55, 0.85].map((t) => k.line(`M${f(mx - 1.6 - 2.6 * t - 0.8)} ${f(my - 1 - 11 * t)}l1.8 -0.4`, "#ffffff", 0.9)).join("") +
      k.line(`M${mx - 3.4} ${my + 1.6}l1 6`, "#ffffff", 0.9).replace("/>", ' opacity=".8"/>') + glint(k, mx + 3.6, my + 1.4, 1.8, 3));
  },
  // Aurora Alaska: the hood's ruff gets its tufts and a beaded band, the hood
  // itself shows from behind; horn toggles and a glowing
  // snowflake toggle on the parka.
  glacelle(k) {
    const fur = "#f0ead8",
      tip = "#c8b89a",
      parka = "#2c5f8c";
    const a = [k.hx - 46, k.ht + 50],
      m1 = [k.hx - 52, k.ht + 4],
      top = [k.hx, k.ht],
      m2 = [k.hx + 52, k.ht + 4],
      b = [k.hx + 46, k.ht + 50];
    // A point on the ruff (0..1 over both halves) and its outward offset.
    const at = (t: number, out: number) => {
      const [p, q, r] = t < 0.5 ? [a, m1, top] : [top, m2, b];
      const u = t < 0.5 ? t * 2 : (t - 0.5) * 2;
      const [x, y] = qp(p, q, r, u);
      const dx = x - k.hx,
        dy = y - (k.ht + 46);
      const d = Math.hypot(dx, dy) || 1;
      return [f(x + (dx / d) * out), f(y + (dy / d) * out)];
    };
    if (k.back) {
      // The hood, up over the back of the head, its ruff showing round it.
      k.put("flame", k.path(`M${k.hx - 48} ${k.ht + 54}Q${k.hx - 54} ${k.ht - 2} ${k.hx} ${k.ht - 4}Q${k.hx + 54} ${k.ht - 2} ${k.hx + 48} ${k.ht + 54}Q${k.hx} ${k.ht + 64} ${k.hx - 48} ${k.ht + 54}Z`, parka, k.ink, 1.1) +
        k.line(`M${k.hx} ${k.ht - 3}V${k.ht + 60}`, "#1f4a70", 1.2) + k.line(`M${k.hx - 48} ${k.ht + 54}Q${k.hx - 54} ${k.ht - 2} ${k.hx} ${k.ht - 4}Q${k.hx + 54} ${k.ht - 2} ${k.hx + 48} ${k.ht + 54}`, fur, 2.4).replace("/>", ' stroke-dasharray="3 1.6"/>'));
      return;
    }
    // Tufts round the outside of the ruff, dark-tipped like a wolf's.
    const n = 13;
    const tufts = Array.from({ length: n }, (_, i) => {
      const t = 0.04 + (i / (n - 1)) * 0.92;
      const [x, y] = at(t, 3.2);
      const [tx, ty] = at(t, 6.4);
      return k.circle(x, y, 3.2, fur, "none", 0) + k.line(`M${x} ${y}L${tx} ${ty}`, tip, 1.1);
    }).join("");
    // A band of trade beads across the hood's crown, inside the ruff.
    const beads = Array.from({ length: 9 }, (_, i) => {
      const [x, y] = at(0.3 + (i / 8) * 0.4, -5.6);
      return k.circle(x, y, 1.6, ["#c8323a", "#59f0ff", "#ffd84a"][i % 3], k.ink, 0.4);
    }).join("");
    k.put("flame", tufts + beads);
    // On the parka: horn toggles down the front and the glowing snowflake.
    const c = k.C + k.side * 3;
    const toggles = [k.T + 28, k.T + 36].map((ty) => k.rect(c - 3.4, ty - 1, 6.8, 2.2, 1.1, "#efe2c0", k.ink, 0.5)).join("");
    const sx = c + (k.side ? k.side * 6 : 10),
      sy = k.T + 31;
    const flake = k.lume("pulse", [0, 1, 2].map((i) => {
      const ang = (i * Math.PI) / 3;
      const dx = f(Math.cos(ang) * 4),
        dy = f(Math.sin(ang) * 4);
      return k.line(`M${sx - dx} ${sy - dy}L${sx + dx} ${sy + dy}`, "#bff4ff", 1.2);
    }).join("") + k.circle(sx, sy, 1.1, "#ffffff", "none", 0), 3, "#bff4ff");
    k.put("body", toggles + flake);
  },
  // Barnstormer: a stitched leather cap lined in fleece with buckled ear
  // flaps, brass-rimmed goggles with rivets and a glint, their strap behind;
  // pilot's wings round the chest star, a fringe on the scarf.
  halcyra(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 18,
      w = k.side ? 44 : 50,
      top = k.ht - 12;
    const stitch = (d: string) => k.line(d, "#c8945a", 0.6).replace("/>", ' stroke-dasharray="1.2 1.2"/>');
    const seams = k.side
      ? k.line(`M${x - k.side * 6} ${top + 1}Q${x + k.side * 18} ${top + 6} ${x + k.side * 22} ${y}`, "#5a3418", 1.2) + stitch(`M${x - k.side * 4} ${top + 2.6}Q${x + k.side * 19} ${top + 8} ${x + k.side * 23.6} ${y - 1}`)
      : k.line(`M${x} ${top + 1}V${y - 4}`, "#5a3418", 1.2) + stitch(`M${x + 2} ${top + 2}V${y - 5}`) +
        k.line(`M${x - 8} ${top + 2}Q${x - 26} ${top + 10} ${x - 32} ${y}M${x + 8} ${top + 2}Q${x + 26} ${top + 10} ${x + 32} ${y}`, "#5a3418", 1);
    const fleece = k.line(`M${x - w + 1} ${y + 3.6}Q${x} ${y - 4.4} ${x + w - 1} ${y + 3.6}`, "#f0e2c8", 3.4) + k.line(`M${x - w + 1} ${y + 3.6}Q${x} ${y - 4.4} ${x + w - 1} ${y + 3.6}`, "#d8c8a8", 0.8).replace("/>", ' stroke-dasharray="0.8 2"/>');
    // Ear flaps hanging at the sides, each with its buckled strap.
    const flaps = (k.side ? [x - k.side * 8] : [x - w + 4, x + w - 4]).map((fx) =>
      k.path(`M${fx - 5} ${y + 2}L${fx + 5} ${y + 2}L${fx + 4} ${y + 16}Q${fx} ${y + 19} ${fx - 4} ${y + 16}Z`, "#7a4a24", k.ink, 0.8) +
      k.path(`M${fx - 4.2} ${y + 3}L${fx + 4.2} ${y + 3}L${fx + 3.4} ${y + 15}Q${fx} ${y + 17} ${fx - 3.4} ${y + 15}Z`, "none", "#f0e2c8", 0.8) +
      k.rect(fx - 2, y + 10, 4, 3.2, 0.6, "none", GOLD, 0.9)).join("");
    let goggles = "";
    if (k.back) {
      goggles = k.line(`M${x - w + 2} ${y - 4}Q${x} ${y - 13} ${x + w - 2} ${y - 4}`, "#3a2412", 2.6) + k.rect(x - 4, y - 12, 8, 5.4, 1, "none", GOLD, 1.2);
    } else {
      const gx = k.side ? [x + k.side * 16] : [x - 16, x + 16];
      goggles = gx.map((g, i) => `<circle cx="${g}" cy="${y - 6}" r="8" fill="none" stroke="${GOLD}" stroke-width="1"/>` +
        [0, 1, 2, 3, 4, 5].map((j) => {
          const ang = (j / 6) * Math.PI * 2;
          return k.circle(g + Math.cos(ang) * 8, y - 6 + Math.sin(ang) * 8, 0.7, "#fff3c8", "none", 0);
        }).join("") + glint(k, g - 2.6, y - 8.6, 2.2, i)).join("") + (k.side ? "" : k.line(`M${gx[0] + 8} ${y - 7}Q${x} ${y - 10} ${gx[1] - 8} ${y - 7}`, GOLD_D, 1.6));
    }
    k.put("flame", seams + fleece + flaps + goggles);
    if (k.back) return;
    // Pilot's wings either side of the chest star.
    const c = k.C + k.side * 3;
    const sx = c + (k.side ? k.side * 6 : -10),
      sy = k.T + 14;
    const wing = (s: number) => k.path(`M${sx + s * 3} ${sy - 1}Q${sx + s * 9} ${sy - 4} ${sx + s * 12} ${sy - 3}Q${sx + s * 9} ${sy + 0.4} ${sx + s * 3} ${sy + 1.6}Z`, GOLD, GOLD_D, 0.5) + k.line(`M${sx + s * 5} ${sy - 0.2}l${s * 5} -1.6`, GOLD_D, 0.5);
    k.put("body", (k.side ? wing(k.side) : wing(-1) + wing(1)));
    // A fringe and a red stripe at the scarf's end.
    const s = k.side ? -k.side : -1;
    const ex = k.C + s * 37,
      ey = k.T + 16.5;
    k.put("body", k.line(`M${ex - s * 4} ${ey - 5}l${-s * 2} 6`, RED, 1.4) + [0, 1, 2, 3].map((i) => k.line(`M${ex + s * 0.5 - i * 0.4} ${ey - 2 + i * 1.6}l${s * 4} ${1 + i * 0.4}`, "#ffffff", 0.8)).join(""), true);
  },
  // Times Square DJ: a snapback worn backwards (the strap and its opening
  // to the front, the visor behind, a lit star on its face); headphones
  // with grilles and chrome yokes; a vinyl record at the hip.
  shadopus(k) {
    const x = k.hx + k.side * 2,
      y0 = k.ht + 22,
      t0 = k.ht - 6,
      cw = k.side ? 30 : 34;
    const crown = k.path(`M${x - cw} ${y0}Q${x - cw} ${t0} ${x} ${t0}Q${x + cw} ${t0} ${x + cw} ${y0}Q${x} ${y0 - 5} ${x - cw} ${y0}Z`, "#1b1b28") +
      (k.side ? [-0.5, 0.3] : [-0.5, 0, 0.5]).map((u) => k.line(`M${x} ${t0 + 1}Q${x + u * cw * 0.9} ${t0 + 4} ${x + u * cw} ${y0 - 3}`, "#3a3550", 0.9)).join("") +
      k.circle(x, t0 + 0.6, 1.8, "#ff4fd8", k.ink, 0.5);
    let cap = crown;
    if (k.back) {
      // Its face, turned to the back: the visor and the lit star.
      cap += k.path(`M${x - cw + 3} ${y0}Q${x} ${y0 + 11} ${x + cw - 3} ${y0}Q${x} ${y0 + 4} ${x - cw + 3} ${y0}Z`, "#1b1b28") +
        k.line(`M${x - cw + 4} ${y0 + 1}Q${x} ${y0 + 10.4} ${x + cw - 4} ${y0 + 1}`, "#ff4fd8", 1.2) +
        k.lume("pulse", k.path(k.star(x, y0 - 9, 5, 5), GOLD, k.ink, 0.5), 0, "#ffd84a");
    } else if (k.side) {
      cap += k.path(`M${x - k.side * cw * 0.6} ${y0 - 1}Q${x - k.side * (cw + 16)} ${y0 - 2} ${x - k.side * (cw + 19)} ${y0 + 3}Q${x - k.side * cw * 0.8} ${y0 + 4} ${x - k.side * cw * 0.5} ${y0 + 2}Z`, "#1b1b28") +
        k.line(`M${x - k.side * (cw + 18)} ${y0 + 2.6}Q${x - k.side * cw * 0.8} ${y0 + 3.6} ${x - k.side * cw * 0.5} ${y0 + 1.6}`, "#ff4fd8", 1);
    } else {
      // The snapback's opening and strap, to the front.
      cap += k.path(`M${x - 8} ${y0 - 1}Q${x - 8} ${y0 - 10} ${x} ${y0 - 10}Q${x + 8} ${y0 - 10} ${x + 8} ${y0 - 1}`, "none", "#ff4fd8", 1.2) +
        k.rect(x - 8, y0 - 4.6, 16, 3.4, 1, "#2a2440", k.ink, 0.5) + [-4.6, -1.6, 1.4].map((dx) => k.circle(x + dx, y0 - 2.9, 0.6, SILVER, "none", 0)).join("") + k.rect(x + 3.4, y0 - 5, 3.6, 4.2, 0.6, SILVER, k.ink, 0.4);
    }
    k.put("flame", cap);
    if (k.back) return;
    const c = k.C + k.side * 3;
    // Headphones: grilles in the cups, chrome yokes on the band.
    k.put("body", [-1, 1].map((s) => {
      const hx = c + s * 16,
        hy = k.T + 3;
      return k.line(`M${hx - s * 1} ${hy - 5.4}l${-s * 2.4} -2`, SILVER, 1.4) + k.circle(hx, hy, 2.2, "#3a3f50", k.ink, 0.4) +
        [0, 1, 2, 3].map((i) => k.circle(hx + Math.cos((i * Math.PI) / 2 + 0.78) * 1.1, hy + Math.sin((i * Math.PI) / 2 + 0.78) * 1.1, 0.4, "#8a90a8", "none", 0)).join("");
    }).join(""));
    // The record, held at the right hip.
    const rx = onRight(k, 13);
    if (rx === null) return;
    const vx = c + (k.side ? 2 : rx),
      vy = k.B - 9;
    k.put("body", k.circle(vx, vy, 7.4, "#16161e", k.ink, 0.8) + [5.6, 4.2].map((r) => `<circle cx="${vx}" cy="${vy}" r="${r}" fill="none" stroke="#3a3a4c" stroke-width="0.5"/>`).join("") +
      k.lume("pulse", k.circle(vx, vy, 2.6, "#ff4fd8", "none", 0), 2, "#ff4fd8") + k.circle(vx, vy, 0.6, "#16161e", "none", 0) +
      k.line(`M${vx - 5} ${vy - 3.4}q2 -2.2 4.6 -2.4`, "#ffffff", 0.7).replace("/>", ' opacity=".7"/>'));
  },
  // Park Ranger: a leather band with a brass buckle and a pine-tree pin on
  // the campaign hat, its Montana-pinch creases and a stitched brim; field
  // binoculars with glass that glints; a shield round the badge.
  pangrove(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 18;
    const creases = k.line(`M${x - 8} ${y - 23}Q${x - 12} ${y - 15} ${x - 14} ${y - 6}M${x + 8} ${y - 23}Q${x + 12} ${y - 15} ${x + 14} ${y - 6}`, "#7a5a32", 1.1) +
      k.line(`M${x} ${y - 18}V${y - 7}`, "#b8955a", 1);
    const stitch = k.line(`M${x - 42} ${y + 0.8}Q${x} ${y + 7.6} ${x + 42} ${y + 0.8}`, "#c8a86a", 0.6).replace("/>", ' stroke-dasharray="1.4 1.2"/>');
    const band = k.path(`M${x - 22} ${y - 2}Q${x} ${y - 5.6} ${x + 22} ${y - 2}L${x + 22} ${y - 6.6}Q${x} ${y - 10.2} ${x - 22} ${y - 6.6}Z`, "#4a2e16", k.ink, 0.6);
    const bk = onRight(k, 15);
    const buckle = bk === null ? "" : k.rect(x + bk - 2.4, y - 8.4, 4.8, 5, 0.8, "none", GOLD, 1.1) + k.line(`M${x + bk} ${y - 7.6}v3.4`, GOLD, 0.8);
    const pin = k.back ? "" : (() => {
      const px = x + (k.side ? k.side * 6 : 0),
        py = y - 14;
      return k.path(`M${px - 4} ${py - 4}H${px + 4}V${py + 1}Q${px + 4} ${py + 4} ${px} ${py + 5.4}Q${px - 4} ${py + 4} ${px - 4} ${py + 1}Z`, GOLD, k.ink, 0.6) +
        k.path(`M${px} ${py - 3}l2.6 3.4h-1.4l2 2.8h-6.4l2 -2.8h-1.4Z`, "#2f6a3a", "none", 0) + k.line(`M${px} ${py + 2.6}v1.4`, "#5a3a22", 0.8) + glint(k, px + 2.6, py - 3, 1.6, 1);
    })();
    k.put("flame", creases + stitch + band + buckle + pin);
    if (k.back) return;
    const c = k.C + k.side * 3;
    // Binoculars: two barrels with blue glass on a hinge, on their strap.
    const bx = c + (k.side ? k.side * 2 : 7),
      by = k.B - 15;
    const barrel = (dx: number) => k.rect(bx + dx - 3.2, by, 6.4, 9.6, 2, "#2a2a36", k.ink, 0.7) + k.rect(bx + dx - 3.4, by + 6.6, 6.8, 2, 0.6, "#4a4a5a", "none", 0) +
      `<ellipse cx="${bx + dx}" cy="${by + 1.4}" rx="2.4" ry="1.3" fill="#7fd8ff" stroke="${SILVER_D}" stroke-width="0.6"/>`;
    k.put("body", k.line(`M${bx - 6} ${by + 1}Q${c - 10} ${k.T + 6} ${c - 9} ${k.T - 1}`, "#5a3a22", 1) + barrel(-3.6) + barrel(3.6) + k.rect(bx - 1, by + 2, 2, 4, 0.6, SILVER_D, k.ink, 0.4) + glint(k, bx - 4.4, by + 0.6, 1.8, 2));
    // A shield behind the badge star.
    const sx = c + (k.side ? k.side * 6 : -8),
      sy = k.T + 9;
    k.put("body", `<circle cx="${sx}" cy="${sy}" r="4.6" fill="none" stroke="${GOLD_D}" stroke-width="0.9"/>`);
  },
  // Woodstock Folk: leaves along the crown's vine and ribbons streaming from
  // it behind; the guitar gets a waist, a rosette round its sound hole,
  // strings, a bridge, tuning pegs and a daisy sticker.
  mossloth(k) {
    const x = k.hx + k.side * 2,
      y = k.ht + 16;
    const vine = [x - 42, y + 4],
      vc = [x, y - 8],
      ve = [x + 42, y + 4];
    const leaves = (k.side ? [0.12, 0.42, 0.7, 0.92] : [0.08, 0.3, 0.5, 0.7, 0.92]).map((t, i) => {
      const [lx, ly] = qp(vine, vc, ve, t);
      const s = i % 2 ? 1 : -1;
      return k.path(`M${lx} ${ly}q${s * 2} -5 ${s * 6} -4q-1 4 -6 4Z`, "#5fb86a", k.ink, 0.5);
    }).join("");
    const ribbon = (rx: number, ry: number, dx: number, c: string) => k.path(`M${rx} ${ry}q${dx * 0.3 + 3} 10 ${dx * 0.6} 18q${dx * 0.3 - 2} 8 ${dx} 16l3 0q${-dx * 0.2 + 2} -8 ${-dx * 0.1 + 0} -16q${-dx * 0.2 - 3} -8 ${-dx * 0.5 + 3} -18Z`, c, k.ink, 0.6);
    let ribbons = "";
    if (k.back) ribbons = ribbon(x - 5, y - 2, -6, "#ff6fae") + ribbon(x + 2, y - 2, 6, "#59f0ff");
    else if (k.side) ribbons = ribbon(x - k.side * 38, y + 2, -k.side * 10, "#ff6fae") + ribbon(x - k.side * 34, y + 1, -k.side * 4, "#59f0ff");
    k.put("flame", leaves + ribbons);
    // The guitar: waisted body, rosette, bridge, strings, pegs, a sticker.
    onPole(k, (gx, gy) => `<ellipse cx="${gx}" cy="${gy + 19}" rx="10" ry="7.6" fill="#c8823a" stroke="${k.ink}" stroke-width="0.8"/>` +
      `<ellipse cx="${gx}" cy="${gy + 9}" rx="7.4" ry="6" fill="#c8823a" stroke="${k.ink}" stroke-width="0.8"/>` +
      `<ellipse cx="${gx}" cy="${gy + 13}" rx="7" ry="4" fill="#c8823a"/>` +
      `<circle cx="${gx}" cy="${gy + 12}" r="3.8" fill="none" stroke="#f0e2c0" stroke-width="1"/>` + k.circle(gx, gy + 12, 2.8, "#3a2a1c", "none", 0) +
      k.rect(gx - 1.6, gy - 12, 3.2, 18, 1, "#5a3a22", k.ink, 0.5) + k.rect(gx - 2.4, gy - 16, 4.8, 5, 1.2, "#3a2414", k.ink, 0.5) +
      [-1, 1].map((s) => [0, 1].map((i) => k.circle(gx + s * 3, gy - 15 + i * 2.4, 0.8, SILVER, k.ink, 0.3)).join("")).join("") +
      k.rect(gx - 3.4, gy + 20, 6.8, 1.8, 0.6, "#3a2414", "none", 0) +
      [-0.9, -0.3, 0.3, 0.9].map((dx) => k.line(`M${gx + dx} ${gy - 11}V${gy + 20.6}`, "#f4f4f8", 0.3)).join("") +
      Array.from({ length: 6 }, (_, i) => {
        const ang = (i / 6) * Math.PI * 2;
        return k.circle(gx + 5 + Math.cos(ang) * 1.4, gy + 20 + Math.sin(ang) * 1.4, 1.1, "#ffffff", "none", 0);
      }).join("") + k.circle(gx + 5, gy + 20, 0.9, "#ffd84a", "none", 0));
  },
};

/**
 * The Stage Magician's mallet becomes its magic wand: a black wand (the
 * handle, recoloured in stars-art.ts) with a white tip, crowned by a gold
 * star in a burst of sparkle. It takes over from the little wand it used
 * to carry on its back (modern-stars.ts).
 */
const ownWand = DETAILS.astrabun;
DETAILS.astrabun = (k) => {
  ownWand?.(k);
  const { x, y } = malletHead(k);
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    return `M${x + Math.cos(a) * 15} ${y + Math.sin(a) * 15}L${x + Math.cos(a) * 24} ${y + Math.sin(a) * 24}`;
  }).join("");
  k.put("armR", k.rect(x - 3.4, y + 10, 6.8, 9, 1.2, "#ffffff", k.ink, 0.7) +
    k.circle(x, y, 18, "#2a2a36", k.ink, 1) +
    k.lume("twinkle", k.line(rays, "#fff3a8", 1.6), 5, "#ffffff") +
    k.lume("pulse", k.path(k.star(x, y, 17, 5, 0.45), "#f2c14e", "#a8823a", 1) + k.path(k.star(x, y, 8, 5, 0.45), "#fff3c4", "none", 0), 6, "#fff3a8"));
};

legendDetails("stars", DETAILS);

import type { CharacterId } from "@arena/shared";
import { DESIGNS, backPanel, onPole, torso, type Design, type Kit } from "./modern-designs";

/**
 * Hồn Việt for the rest of the roster: each champion is a figure of
 * Vietnamese culture that suits it (the hero Thánh Gióng for fire-breathing
 * Cindrake, a Vovinam fighter for the monk Auralynx, Lạc-bird feathers of the
 * Đông Sơn drums for the bird Halcyra, the Moon Lady's jade rabbit for
 * Astrabun...), with gold embroidery, lanterns and lacquer that give off light.
 */
const GOLD = "#f2c14e",
  GOLD_DARK = "#a8823a";

/** A stand collar (cổ đứng) over the neck. */
const collar = (k: Kit, c: number, silk: string) => k.rect(c - 8, k.T - 4, 16, 6, 2, silk, k.ink, 0.9) + k.line(`M${c - 7} ${k.T - 2.6}H${c + 7}`, GOLD, 0.8);
/** The long front panel (vạt) of an áo dài, falling past the waist. */
const panel = (k: Kit, c: number, silk: string, extra = "") =>
  k.put("body", k.path(`M${c - 8} ${k.B - 6}L${c + 8} ${k.B - 6}L${c + 7} ${k.B + 16}Q${c} ${k.B + 19} ${c - 7} ${k.B + 16}Z`, silk, k.ink, 0.9) + extra, true);
/** An áo dài's back with its long panel. */
const aoDaiBack = (k: Kit, silk: string, extra = "") =>
  k.put("scarf", k.path(`M${k.C - k.W - 1} ${k.T + 1}Q${k.C} ${k.T - 4} ${k.C + k.W + 1} ${k.T + 1}L${k.C + k.W + 1} ${k.B - 2}L${k.C + 6} ${k.B + 16}L${k.C - 6} ${k.B + 16}L${k.C - k.W - 1} ${k.B - 2}Z`, silk) + extra);
/** The side closure from the collar to the arm, with gold buttons. */
const closure = (k: Kit, c: number) =>
  k.line(`M${c + 2} ${k.T + 2}Q${c + 8} ${k.T + 5} ${c + 12} ${k.T + 11}`, GOLD_DARK, 1) +
  [0, 1, 2].map((i) => k.circle(c + 4 + i * 3.6, k.T + 3.4 + i * 2.6, 0.9, GOLD, GOLD_DARK, 0.4)).join("");
/** A head band across the brow (khăn, headband): front or profile. */
const band = (k: Kit, y: number, w: number, fill: string, h = 7) => {
  const x = k.hx + k.side * 2;
  return k.path(`M${x - w} ${y + 2}Q${x} ${y - 8} ${x + w} ${y + 2}L${x + w - 1} ${y + 2 + h}Q${x} ${y - 8 + h} ${x - w + 1} ${y + 2 + h}Z`, fill);
};
const cx = (k: Kit) => k.C + k.side * 3;

export const VIET: Partial<Record<CharacterId, Design>> = {
  // Thánh Gióng: iron armour scales, the flame crest kept, and a stalk of
  // golden bamboo (tre đằng ngà) slung on the back, its nodes glowing.
  cindrake(k) {
    const iron = "#4a4f5c",
      plate = "#6a7080";
    const scales = (c: number) => [0, 1, 2].flatMap((r) => [-2, -1, 0, 1, 2].map((q) => k.path(`M${c + q * 6 - 3 + (r % 2) * 3} ${k.T + 6 + r * 6}q3 5 6 0`, "none", plate, 1.2))).join("");
    if (k.back) backPanel(k, iron, scales(k.C));
    else {
      const c = cx(k);
      k.put("body", torso(k, iron, scales(c) + k.rect(k.L - 2, k.B - 10, k.R - k.L + 4, 5, 0, "#c8323a")) +
        // A bronze chest disc.
        k.circle(c, k.T + 13, 5.5, "#b8823a", k.ink, 0.8) + k.lume("pulse", k.circle(c, k.T + 13, 2.4, "#ffb347", "none", 0), 0, "#ffb347"));
    }
    onPole(k, (x, y) => {
      const nodes = [0, 1, 2].map((i) => k.lume("chase", k.line(`M${x - 3} ${y + 4 + i * 9}h6`, "#fff3a8", 1.6), i, "#ffe08a")).join("");
      return k.line(`M${x} ${y - 14}V${y + 30}`, "#e6c84a", 5.4) + nodes + [0, 1, 2].map((i) => k.line(`M${x - 3} ${y - 8 + i * 9}h6`, "#a8902a", 0.6)).join("") +
        k.path(`M${x} ${y - 14}q8 -8 14 -5q-6 6 -14 5Z`, "#7ab84a", k.ink, 0.6) + k.path(`M${x} ${y - 12}q-8 -6 -12 -2q6 4 12 2Z`, "#7ab84a", k.ink, 0.6);
    });
  },
  // Vovinam fighter: a blue võ phục with a yellow belt whose knot and tails
  // glow, and a red headband.
  auralynx(k) {
    const gi = "#2f5fb0";
    if (k.back) backPanel(k, gi, k.rect(k.C - k.W - 2, k.B - 12, 2 * k.W + 4, 5, 0, "#f2c14e"));
    else {
      const c = cx(k);
      k.put("body", torso(k, gi,
        k.line(`M${c - 10} ${k.T - 1}L${c + 4} ${k.B - 12}`, "#1f4a8c", 1.2) + k.line(`M${c + 10} ${k.T - 1}L${c - 2} ${k.T + 12}`, "#1f4a8c", 1.2) +
          k.rect(k.L - 2, k.B - 12, k.R - k.L + 4, 5, 0, "#f2c14e", k.ink, 0.6)) +
        // The belt knot and its two tails, lit.
        k.lume("pulse", k.rect(c - 3, k.B - 13, 6, 6, 1.5, "#ffd84a", k.ink, 0.6) + k.path(`M${c - 2} ${k.B - 7}l-4 10l3 0l3 -9Z M${c + 2} ${k.B - 7}l4 10l-3 0l-3 -9Z`, "#ffd84a", k.ink, 0.5), 0, "#ffd84a"));
    }
    const y = k.ht + 22;
    const w = k.side ? 42 : 48;
    k.put("flame", band(k, y, w, "#c8323a", 6) +
      (k.back ? k.path(`M${k.hx - 3} ${y + 2}l-6 16l4 0l4 -12Z M${k.hx + 3} ${y + 2}l6 16l-4 0l-4 -12Z`, "#c8323a") : ""));
  },
  // Hội An lantern maker: a yellow áo dài with lantern embroidery and a
  // silk lantern hanging from each antenna, glowing in turn.
  lumoth(k) {
    const silk = "#f6c84a";
    const lantern = (x: number, y: number, color: string, i: number) =>
      k.line(`M${x} ${y - 9}V${y - 6}`, GOLD_DARK, 0.8) +
      k.lume("chase", `<ellipse cx="${x}" cy="${y}" rx="5" ry="6.5" fill="${color}" stroke="${k.ink}" stroke-width="0.7"/>` + k.line(`M${x - 4.6} ${y}H${x + 4.6}`, GOLD, 0.6), i, "#ffb347") +
      k.rect(x - 3, y - 7.5, 6, 1.6, 0.5, GOLD, GOLD_DARK, 0.3) + k.rect(x - 3, y + 6, 6, 1.6, 0.5, GOLD, GOLD_DARK, 0.3) + k.line(`M${x} ${y + 7.6}V${y + 12}`, color, 0.8);
    const em = (c: number, y: number) => [0, 1].map((i) => k.lume("chase", `<ellipse cx="${c - 5 + i * 10}" cy="${y + i * 3}" rx="2.4" ry="3" fill="#e8322a" stroke="${GOLD_DARK}" stroke-width="0.4"/>`, i + 2, "#ffb347")).join("");
    if (k.back) aoDaiBack(k, silk, em(k.C, k.T + 14));
    else {
      const c = cx(k);
      panel(k, c, silk, em(c, k.B + 4));
      k.put("body", torso(k, silk, closure(k, c) + em(c - 2, k.T + 14)) + collar(k, c, silk));
    }
    // The lanterns hang at the tips of the feathery antennae.
    {
      const xs = k.side ? [k.hx + k.side * 22] : [k.hx - 42, k.hx + 42];
      k.put("flame", xs.map((x, i) => lantern(x, k.ht - 2, i ? "#e8322a" : "#ff8a3a", i)).join(""));
    }
  },
  // Đèn kéo quân: an áo the of dark gauze with gold trim and a hexagonal
  // revolving lantern at the chest, its paper figures lit one after another.
  duskveil(k) {
    const gauze = "#2a2244";
    if (k.back) backPanel(k, gauze, k.line(`M${k.C - k.W} ${k.B - 3}H${k.C + k.W}`, GOLD, 1.4));
    else {
      const c = cx(k);
      k.put("body", torso(k, gauze, k.line(`M${k.L} ${k.B - 3}H${k.R}`, GOLD, 1.4) + k.line(`M${c} ${k.T + 2}V${k.B}`, "#3a3060", 1)));
      // The lantern: a gold hexagon with six paper panes lit in turn.
      const y = k.T + 15;
      const pts = Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
        return [c + Math.cos(a) * 8, y + Math.sin(a) * 8];
      });
      k.put("body", k.line(`M${c - 6} ${k.T}Q${c} ${k.T + 4} ${c + 6} ${k.T}`, GOLD, 0.8) +
        k.path("M" + pts.map((p) => p.map((v) => v.toFixed(1)).join(" ")).join("L") + "Z", "#3a2a1c", GOLD, 1) +
        pts.map((p, i) => {
          const q = pts[(i + 1) % 6];
          return k.lume("chase", k.path(`M${c} ${y}L${p[0].toFixed(1)} ${p[1].toFixed(1)}L${q[0].toFixed(1)} ${q[1].toFixed(1)}Z`, "#ffb347", "none"), i, "#ffb347");
        }).join("") + k.circle(c, y, 1.6, "#3a2a1c", "none", 0));
    }
    // A gold-tasselled cord round the hood's brim.
    k.put("flame", k.line(`M${k.hx - 44} ${k.ht + 56}Q${k.hx} ${k.ht + 46} ${k.hx + 44} ${k.ht + 56}`, GOLD, 1.4));
  },
  // Đàn bầu player: a brown áo the and the one-string monochord on the back,
  // its metal string humming with light.
  coilemur(k) {
    const tunic = "#7a4a2c";
    if (k.back) backPanel(k, tunic);
    else {
      const c = cx(k);
      k.put("body", torso(k, tunic, closure(k, c) + k.rect(k.L - 2, k.B - 10, k.R - k.L + 4, 4, 0, "#c8323a")) + collar(k, c, tunic));
    }
    // The đàn bầu: a long lacquered box, the gourd and flexible rod at one end.
    const s = k.side ? -k.side : 1;
    const draw = (x0: number, y0: number, x1: number, y1: number) =>
      k.line(`M${x0} ${y0}L${x1} ${y1}`, "#5a2a14", 6) + k.line(`M${x0} ${y0}L${x1} ${y1}`, "#8a4a24", 3.6) +
      k.lume("pulse", k.line(`M${x0} ${y0}L${x1} ${y1}`, "#bff6ff", 0.8), 0, "#7ff3ff") +
      k.circle(x1, y1, 3.6, "#d9a35a") + k.line(`M${x1} ${y1}l${s * 4} -10`, "#3a2a1c", 1);
    if (k.back) k.put("scarf", draw(k.C + 18, k.B + 2, k.C - 20, k.T - 22));
    else k.put("body", draw(k.C - s * 14, k.B, k.C + s * (k.side ? 26 : 52), k.T - 28), true);
  },
  // Hạt dẻ seller: a khăn mỏ quạ headscarf and a shoulder pole with two
  // baskets of roasting chestnuts that glow like embers.
  pyranda(k) {
    const shirt = "#d8c8a8";
    if (k.back) backPanel(k, shirt);
    else {
      const c = cx(k);
      k.put("body", torso(k, shirt, k.path(`M${c - 9} ${k.T - 1}Q${c} ${k.T + 6} ${c + 9} ${k.T - 1}`, "none", k.ink, 0.9) + [0, 1, 2].map((i) => k.circle(c, k.T + 9 + i * 7, 1, "#8a6a3a", k.ink, 0.3)).join("")));
    }
    // The pole across the shoulders, a basket hanging at each end.
    const basket = (x: number, y: number, i: number) =>
      k.line(`M${x - 6} ${y - 14}L${x} ${y - 22}L${x + 6} ${y - 14}`, "#8a6a3a", 0.7) +
      k.path(`M${x - 8} ${y - 6}Q${x} ${y - 9} ${x + 8} ${y - 6}L${x + 6} ${y + 4}Q${x} ${y + 6} ${x - 6} ${y + 4}Z`, "#b8955a") +
      k.lume("pulse", [0, 1, 2].map((j) => k.circle(x - 4 + j * 4, y - 7 - (j % 2), 2.2, "#ff7a2a", k.ink, 0.4)).join(""), i, "#ff9a3a");
    const yP = k.T - 6;
    if (k.back) k.put("scarf", k.line(`M${k.C - 46} ${yP}L${k.C + 46} ${yP}`, "#a87a3a", 3) + basket(k.C - 44, yP + 22, 0) + basket(k.C + 44, yP + 22, 0));
    else if (k.side) k.put("body", k.line(`M${k.C - 8} ${yP - 4}L${k.C + 8} ${yP + 4}`, "#a87a3a", 3), true);
    else k.put("body", k.line(`M${k.C - 52} ${yP}L${k.C + 52} ${yP}`, "#a87a3a", 3) + basket(k.C - 50, yP + 22, 0) + basket(k.C + 50, yP + 22, 0), true);
    // Khăn mỏ quạ: a black headscarf folded to a point over the brow.
    const x = k.hx + k.side * 2,
      y = k.ht + 14,
      w = k.side ? 44 : 50;
    k.put("flame", k.path(`M${x - w} ${y + 8}Q${x - w} ${k.ht - 8} ${x} ${k.ht - 8}Q${x + w} ${k.ht - 8} ${x + w} ${y + 8}Q${x + w * 0.4} ${y + 2} ${x + (k.side ? k.side * 8 : 0)} ${y + 10}Q${x - w * 0.4} ${y + 2} ${x - w} ${y + 8}Z`, "#24202e") +
      k.line(`M${x - w + 6} ${y + 4}Q${x} ${y - 6} ${x + w - 6} ${y + 4}`, "#3a3448", 1.2));
  },
  // Sa Pa H'Mông: an indigo blouse with bright embroidered bands, a silver
  // neck ring that shines like frost, and an embroidered headwrap.
  glacelle(k) {
    const indigo = "#2a3a6e";
    const bands = (x0: number, x1: number, y: number) => [0, 1, 2].map((i) => k.line(`M${x0} ${y + i * 3}H${x1}`, ["#e8322a", "#ffd84a", "#3fa04f"][i], 1.6)).join("") +
      k.line(`M${x0} ${y + 1.5}H${x1}`, "#ffffff", 0.4).replace("<path", '<path stroke-dasharray="1.5 2"');
    if (k.back) backPanel(k, indigo, bands(k.C - k.W, k.C + k.W, k.B - 10));
    else {
      const c = cx(k);
      k.put("body", torso(k, indigo, bands(k.L, k.R, k.T + 8)));
      // The silver neck ring, catching the light.
      k.put("body", k.lume("pulse", k.path(`M${c - 13} ${k.T - 1}Q${c} ${k.T + 9} ${c + 13} ${k.T - 1}`, "none", "#e8f4ff", 2.6) + k.path(`M${c - 10} ${k.T + 2}Q${c} ${k.T + 10} ${c + 10} ${k.T + 2}`, "none", "#c8dcf0", 1.4), 0, "#ffffff") +
        k.lume("twinkle", k.circle(c, k.T + 8.5, 1.8, "#ffffff", "#9ab0c8", 0.4), 1, "#ffffff"));
    }
    // The headwrap: indigo with an embroidered band and pom-poms.
    const y = k.ht + 10;
    const w = k.side ? 40 : 46;
    k.put("flame", band(k, y, w, indigo, 10) + k.line(`M${k.hx + k.side * 2 - w + 3} ${y + 7}Q${k.hx + k.side * 2} ${y - 3} ${k.hx + k.side * 2 + w - 3} ${y + 7}`, "#e8322a", 1.6) +
      (k.side ? [k.hx + k.side * 30] : [k.hx - 40, k.hx + 40]).map((x, i) => k.circle(x, y + 12, 3, i ? "#ffd84a" : "#e8322a")).join(""));
  },
  // Lạc warrior of the Đông Sơn drums: a crown of Lạc-bird feathers lit along
  // their tips and a bronze breastplate with the drum's sun.
  halcyra(k) {
    const bronze = "#9a6a2c";
    const sun = (c: number, y: number, r: number) => k.circle(c, y, r, "#b8823a", "#6a4a1c", 0.8) + k.lume("pulse", k.path(starPts(c, y, r * 0.75, 12), GOLD, "none"), 0, GOLD) +
      `<circle cx="${c}" cy="${y}" r="${r * 0.9}" fill="none" stroke="#6a4a1c" stroke-width="0.5" stroke-dasharray="1 1"/>`;
    if (k.back) backPanel(k, "#6a4a2c", sun(k.C, k.T + 15, 7));
    else {
      const c = cx(k);
      k.put("body", torso(k, "#6a4a2c", k.line(`M${k.L} ${k.T + 2}H${k.R}`, bronze, 3)) + sun(c, k.T + 15, 7));
    }
    // Feathers fan up from a bronze band; each tip lights in turn.
    const x = k.hx + k.side * 2,
      y = k.ht + 14;
    const n = k.side ? 4 : 7;
    const feathers = Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1);
      const a = k.side ? -Math.PI / 2 - k.side * (0.2 + u * 0.9) : -Math.PI / 2 + (u - 0.5) * 1.8;
      const bx = x + Math.cos(a) * 26,
        by = y - 4 + Math.sin(a) * 6;
      const tx = bx + Math.cos(a) * 34,
        ty = by + Math.sin(a) * 34;
      // Cream feathers with dark quills, clear against Halcyra's blue crest.
      return k.path(`M${bx - 3.4} ${by}Q${(bx + tx) / 2 - 5} ${(by + ty) / 2} ${tx} ${ty}Q${(bx + tx) / 2 + 5} ${(by + ty) / 2} ${bx + 3.4} ${by}Z`, "#f4ead0", k.ink, 0.8) +
        k.line(`M${bx} ${by}L${tx} ${ty}`, "#6a4a1c", 0.7) +
        k.lume("chase", k.circle(tx, ty, 2, "#ffe08a", k.ink, 0.4), i, "#ffe08a");
    }).join("");
    k.put("flame", feathers + band(k, y, k.side ? 40 : 46, bronze, 6));
  },
  // Chị Hằng's jade rabbit: a white silk áo dài with a moon and clouds, a
  // full moon rising behind the head and a mooncake at the sash.
  astrabun(k) {
    const silk = "#f4f1f8";
    const clouds = (c: number, y: number) => k.path(`M${c - 9} ${y}q2 -4 5 -2q2 -4 6 -1q4 -2 5 2q-8 2 -16 1Z`, "none", "#b8a8d8", 0.9);
    if (k.back) aoDaiBack(k, silk, clouds(k.C, k.T + 18));
    else {
      const c = cx(k);
      panel(k, c, silk, clouds(c, k.B + 8));
      k.put("body", torso(k, silk, closure(k, c) + clouds(c - 3, k.T + 18) +
        k.lume("pulse", k.circle(c - 6, k.T + 10, 3.2, "#fff3a8", GOLD_DARK, 0.4), 1, "#fff3c4")) + collar(k, c, silk) +
        // A mooncake (bánh trung thu) tucked at the sash.
        k.circle(c + (k.side ? 0 : 10), k.B - 6, 3.6, "#c8823a", "#7a4a1c", 0.6) + k.circle(c + (k.side ? 0 : 10), k.B - 6, 2, "none", "#7a4a1c", 0.4));
    }
    // The moon behind the head, glowing softly between the ears.
    if (!k.back) {
      const x = k.hx - (k.side ? k.side * 18 : 0),
        y = k.ht - 20;
      // Behind the head: on the wings layer, which Astrabun has no wings on.
      k.put("wings", k.lume("pulse", `<circle cx="${x}" cy="${y}" r="24" fill="#ffe08a" stroke="${GOLD_DARK}" stroke-width="1"/>` +
        `<circle cx="${x - 8}" cy="${y - 7}" r="4" fill="#f2c860"/><circle cx="${x + 9}" cy="${y + 2}" r="3" fill="#f2c860"/><circle cx="${x - 2}" cy="${y + 10}" r="2.4" fill="#f2c860"/>`, 0, "#fff3c4"));
    }
  },
  // Rice farmer: an áo nâu, a woven gùi of ripe rice on the back, its grains
  // twinkling gold, and a straw head cloth.
  wombolder(k) {
    const brown = "#6a4a2c";
    if (k.back) backPanel(k, brown);
    else {
      const c = cx(k);
      k.put("body", torso(k, brown, k.path(`M${c - 9} ${k.T - 1}Q${c} ${k.T + 6} ${c + 9} ${k.T - 1}`, "none", k.ink, 0.9) + k.rect(k.L - 2, k.B - 10, k.R - k.L + 4, 4, 0, "#a8823a")));
    }
    // The gùi basket with a sheaf of rice standing out of it.
    const s = k.side ? -k.side : 1;
    const gui = (x: number, y: number) => k.path(`M${x - 11} ${y}L${x + 11} ${y}L${x + 8} ${y + 20}L${x - 8} ${y + 20}Z`, "#b8955a") +
      [0, 1, 2].map((i) => k.line(`M${x - 10 + i} ${y + 6 + i * 5}H${x + 10 - i}`, "#8a6a3a", 0.7)).join("") +
      [-6, -2, 2, 6].map((dx, i) => k.line(`M${x + dx} ${y}Q${x + dx * 1.4} ${y - 12} ${x + dx * 2} ${y - 18}`, "#c8a83a", 1.2) +
        k.lume("twinkle", k.circle(x + dx * 2, y - 18, 1.8, "#ffe08a", "none", 0), i, "#ffe08a")).join("");
    if (k.back) k.put("scarf", gui(k.C, k.T - 2));
    else k.put("body", gui(k.C + s * (k.side ? 20 : 44), k.T - 14), true);
    k.put("flame", band(k, k.ht + 12, k.side ? 42 : 48, "#d9c08a", 6));
  },
  // Hát bội general: the long pheasant plumes (lông trĩ) arching back over the
  // head and four command flags (cờ lệnh) on the back with lit borders.
  shadopus(k) {
    const robe = "#7a1f2c";
    if (k.back) backPanel(k, robe, k.line(`M${k.C - k.W} ${k.T + 3}H${k.C + k.W}`, GOLD, 1.6));
    else {
      const c = cx(k);
      k.put("body", torso(k, robe, k.line(`M${k.L} ${k.T + 3}H${k.R}`, GOLD, 1.6) +
        [-1, 0, 1].map((i) => k.circle(c + i * 9, k.T + 15, 2.8, "none", GOLD, 0.9)).join("")) +
        k.lume("pulse", k.circle(c, k.T + 15, 1.6, GOLD, "none", 0), 2, GOLD));
    }
    // The flags fan out above the shoulders behind.
    const flag = (x: number, y: number, a: number, color: string, i: number) => {
      const len = k.back ? 30 : 64;
      const fx = x + Math.cos(a) * len,
        fy = y + Math.sin(a) * len;
      const nx = Math.cos(a + Math.PI / 2) * 10,
        ny = Math.sin(a + Math.PI / 2) * 10;
      return k.line(`M${x} ${y}L${fx} ${fy}`, "#5a3a22", 1.2) +
        k.lume("chase", k.path(`M${fx} ${fy}L${(fx + x) / 2 + nx * 0.2} ${(fy + y) / 2 + ny * 0.2}L${fx + nx} ${fy + ny}Z`, color, GOLD, 1), i, GOLD);
    };
    const angles = k.back ? [-2.4, -2.0, -1.15, -0.75] : [-2.95, -2.7, -0.44, -0.19];
    const colors = ["#3fa04f", "#ffd84a", "#2f6fb8", "#e8322a"];
    if (k.back) k.put("scarf", angles.map((a, i) => flag(k.C, k.T + 4, a, colors[i], i)).join(""));
    else k.put("body", angles.map((a, i) => flag(k.C, k.T + 6, a, colors[i], i)).join(""), true);
    // The plumes: two long feathers arching from a jewelled band.
    const x = k.hx + k.side * 2,
      y = k.ht + 24;
    const plume = (s: number) => k.path(`M${x + s * 8} ${y - 6}C${x + s * 20} ${y - 50} ${x + s * 52} ${y - 52} ${x + s * 64} ${y - 30}`, "none", "#c8823a", 3.2) +
      k.path(`M${x + s * 8} ${y - 6}C${x + s * 20} ${y - 50} ${x + s * 52} ${y - 52} ${x + s * 64} ${y - 30}`, "none", "#2a1c10", 0.8).replace("<path", '<path stroke-dasharray="2 3"');
    k.put("flame", (k.side ? plume(-k.side) : plume(-1) + plume(1)) + band(k, y, k.side ? 42 : 50, "#c8323a", 6) +
      (k.back ? "" : k.lume("pulse", k.circle(x + k.side * 8, y - 2, 2.6, GOLD, k.ink, 0.6), 1, GOLD)));
  },
  // Đồng Tháp lotus pond: a pink áo bà ba, a lotus leaf worn as a hat with
  // a lotus bud on top that glows, as country children wear them.
  pangrove(k) {
    const shirt = "#f2a8c0";
    if (k.back) backPanel(k, shirt);
    else {
      const c = cx(k);
      k.put("body", torso(k, shirt, k.path(`M${c - 9} ${k.T - 1}Q${c} ${k.T + 6} ${c + 9} ${k.T - 1}`, "none", k.ink, 0.9) +
        [0, 1, 2].map((i) => k.circle(c, k.T + 9 + i * 7, 1, "#ffffff", k.ink, 0.3)).join("") + k.rect(c - 14, k.B - 14, 9, 7, 1.5, "#e890a8", k.ink, 0.6)));
    }
    const x = k.hx + k.side * 2,
      y = k.ht + 8;
    const w = k.side ? 42 : 50;
    const leaf = k.path(`M${x - w} ${y + 6}Q${x - w * 0.6} ${y - 14} ${x} ${y - 14}Q${x + w * 0.6} ${y - 14} ${x + w} ${y + 6}Q${x} ${y - 2} ${x - w} ${y + 6}Z`, "#3f8a4f") +
      [-0.6, -0.2, 0.2, 0.6].map((u) => k.line(`M${x} ${y - 8}L${x + u * w} ${y + 3}`, "#2f6a3a", 0.8)).join("");
    k.put("flame", leaf + k.lume("pulse", k.path(`M${x} ${y - 30}C${x - 8} ${y - 22} ${x - 6} ${y - 12} ${x} ${y - 10}C${x + 6} ${y - 12} ${x + 8} ${y - 22} ${x} ${y - 30}Z`, "#ff9ac0", k.ink, 0.7), 0, "#ffb3cf") +
      k.line(`M${x} ${y - 10}V${y - 6}`, "#3f8a4f", 1.4));
  },
  // Ông đồ: a black áo the, round spectacles and a scroll of calligraphy on
  // the back whose ink glows, as at the Tết calligraphy stalls.
  mossloth(k) {
    const the = "#2a2a32";
    if (k.back) backPanel(k, the);
    else {
      const c = cx(k);
      k.put("body", torso(k, the, closure(k, c)) + collar(k, c, the));
    }
    // The scroll, unrolled down the back and showing past a shoulder.
    const s = k.side ? -k.side : 1;
    const scroll = (x: number, y: number) => k.rect(x - 7, y, 14, 30, 1, "#f4ead0", k.ink, 0.8) + k.rect(x - 9, y - 2, 18, 3, 1.5, "#7a4a24", k.ink, 0.5) + k.rect(x - 9, y + 29, 18, 3, 1.5, "#7a4a24", k.ink, 0.5) +
      k.lume("pulse", k.path(`M${x - 3} ${y + 6}q4 2 3 6q-2 4 2 6M${x + 2} ${y + 8}q-1 6 1 10M${x - 2} ${y + 22}q3 1 5 -1`, "none", "#c8323a", 1.6), 0, "#ff6a5a");
    if (k.back) k.put("scarf", scroll(k.C, k.T - 4));
    else k.put("body", scroll(k.C + s * (k.side ? 22 : 46), k.T - 30), true);
    if (!k.back) {
      // Round spectacles over the eyes, catching the light.
      const pts = k.side ? [[k.hx + k.side * 22, k.ht + 40]] : [[k.hx - 21, k.ht + 40], [k.hx + 21, k.ht + 40]];
      k.put("flame", pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="12" fill="#ffffff1a" stroke="#3a2a1c" stroke-width="1.8"/>`).join("") +
        (pts.length > 1 ? k.line(`M${pts[0][0] + 12} ${pts[0][1] - 2}Q${k.hx} ${pts[0][1] - 6} ${pts[1][0] - 12} ${pts[1][1] - 2}`, "#3a2a1c", 1.6) : "") +
        pts.map(([x, y], i) => k.lume("twinkle", k.line(`M${x - 6} ${y - 3}L${x - 2} ${y - 7}`, "#ffffff", 1.8), i, "#ffffff")).join(""));
    }
  },
};

function starPts(x: number, y: number, r: number, n: number, inner = 0.4) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + "Z";
}

Object.assign((DESIGNS.viet ??= {}), VIET);

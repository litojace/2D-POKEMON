import type { CharacterId } from "@arena/shared";
import { DESIGNS, backPanel, hatShape, onPole, torso, type Design, type Kit } from "./modern-designs";

/**
 * Neon Campus for the rest of the roster: every champion belongs to its own
 * school club, with the club's kit and something on it that lights up
 * (Cindrake's chemistry flask, Lumoth's camera flash, Coilemur's robot
 * badge, Pangrove's marching drum...).
 */
const cx = (k: Kit) => k.C + k.side * 3;
const band = (k: Kit, y: number, w: number, fill: string, h = 7) => {
  const x = k.hx + k.side * 2;
  return k.path(`M${x - w} ${y + 2}Q${x} ${y - 8} ${x + w} ${y + 2}L${x + w - 1} ${y + 2 + h}Q${x} ${y - 8 + h} ${x - w + 1} ${y + 2 + h}Z`, fill);
};
/** A school shirt collar with a tie or bow in the club's colour. */
const collar = (k: Kit, c: number, tie: string, bow = false) =>
  k.path(`M${c - 10} ${k.T - 1}L${c} ${k.T + 8}L${c + 10} ${k.T - 1}Z`, "#f7f4ee", k.ink, 0.8) +
  (bow ? k.path(`M${c} ${k.T + 3}l-6 -3v6Z M${c} ${k.T + 3}l6 -3v6Z`, tie, k.ink, 0.6) : k.path(`M${c - 2.4} ${k.T + 1}L${c + 2.4} ${k.T + 1}L${c + 3.2} ${k.T + 12}L${c} ${k.T + 15}L${c - 3.2} ${k.T + 12}Z`, tie, k.ink, 0.6));

export const CAMPUS: Partial<Record<CharacterId, Design>> = {
  // Chemistry Club: a lab coat, safety goggles up on the brow and a flask of
  // something bubbling and glowing in the pocket; its own flame kept.
  cindrake(k) {
    const coat = "#f4f4f8";
    if (k.back) backPanel(k, coat, k.line(`M${k.C} ${k.T + 4}V${k.B}`, "#d8d8e0", 1));
    else {
      const c = cx(k);
      const px = c + (k.side ? k.side * 6 : 10);
      k.put("body", torso(k, coat, collar(k, c, "#2f8a4f") + k.line(`M${c - 10} ${k.T}L${c - 4} ${k.B}M${c + 10} ${k.T}L${c + 4} ${k.B}`, "#d8d8e0", 1) +
        k.rect(px - 5, k.T + 14, 10, 8, 1, "#e6e6ee", k.ink, 0.6)) +
        // The flask, half out of the pocket, its liquid glowing.
        k.path(`M${px - 1.6} ${k.T + 6}h3.2v4l3 6q0 2 -2 2h-5q-2 0 -2 -2l3 -6Z`, "#e8f8ff", k.ink, 0.6) +
        k.lume("pulse", k.path(`M${px - 3.4} ${k.T + 15}l1.8 -3.6h3.2l1.8 3.6q0 1 -1 1h-4.8q-1 0 -1 -1Z`, "#7dff8a", "none") + k.circle(px + 0.5, k.T + 9, 0.9, "#b6ff4f", "none", 0), 0, "#7dff8a"));
    }
    if (!k.back) {
      const y = k.ht + 20;
      const xs = k.side ? [k.hx + k.side * 16] : [k.hx - 16, k.hx + 16];
      k.put("flame", k.line(`M${k.hx - 44} ${y + 6}Q${k.hx} ${y - 6} ${k.hx + 44} ${y + 6}`, "#2a2a36", 2.4) +
        xs.map((x) => k.circle(x, y, 8, "#bfe8ff55", "#2a2a36", 2)).join(""));
    }
  },
  // Student Council President: a crisp blazer, an armband and a glowing
  // council badge, and a neat ribbon between the ears.
  auralynx(k) {
    const blazer = "#2f3f8c";
    if (k.back) backPanel(k, blazer);
    else {
      const c = cx(k);
      k.put("body", torso(k, blazer, collar(k, c, "#c8323a", true) +
        k.lume("pulse", k.path(`M${c + (k.side ? k.side * 7 : -11)} ${k.T + 11}l3 3l-3 3l-3 -3Z`, "#ffd84a", k.ink, 0.5) + k.circle(c + (k.side ? k.side * 7 : -11), k.T + 14, 0.9, "#ffffff", "none", 0), 0, "#ffd84a")));
      // The armband round the arm's shoulder, as seen at the side.
      const s = k.side ? -k.side : 1;
      k.put("body", k.rect(k.C + s * (k.W - 4) - 4, k.T + 3, 8, 5, 1, "#c8323a", k.ink, 0.6));
    }
    const x = k.hx + k.side * 2,
      y = k.ht + 6;
    k.put("flame", k.path(`M${x} ${y}C${x - 5} ${y - 8} ${x - 13} ${y - 8} ${x - 13} ${y - 1}C${x - 13} ${y + 5} ${x - 5} ${y + 5} ${x} ${y}Z M${x} ${y}C${x + 5} ${y - 8} ${x + 13} ${y - 8} ${x + 13} ${y - 1}C${x + 13} ${y + 5} ${x + 5} ${y + 5} ${x} ${y}Z`, "#c8323a") + k.circle(x, y, 2.4, "#ffd84a"));
  },
  // Photography Club: a cardigan and a camera on its strap whose flash
  // light blinks, and a press-pass lanyard.
  lumoth(k) {
    const knit = "#c9b07a";
    if (k.back) backPanel(k, knit, k.line(`M${k.C - k.W} ${k.T + 2}L${k.C + k.W} ${k.B - 4}`, "#3a3a48", 1.6));
    else {
      const c = cx(k);
      k.put("body", torso(k, knit, collar(k, c, "#2f6b4f", true) + [0, 1, 2].map((i) => k.circle(c, k.T + 11 + i * 5, 0.9, "#7a5a2c", "none", 0)).join("")));
      // The camera hangs at the chest on a strap.
      const cy = k.T + 15,
        bx = c + (k.side ? k.side * 4 : 9);
      k.put("body", k.line(`M${c - 12} ${k.T}L${bx - 6} ${cy - 4}M${c + 12} ${k.T}L${bx + 6} ${cy - 4}`, "#3a3a48", 1.2) +
        k.rect(bx - 8, cy - 5, 16, 11, 2, "#2a2a36") + k.circle(bx, cy + 0.5, 3.8, "#5a6478", "#9aa4b8", 0.8) +
        k.lume("blink", k.rect(bx + 3.5, cy - 4, 3, 2, 0.5, "#fff6c9", "none", 0), 0, "#ffffff"));
    }
  },
  // Drama Club Lead: a velvet costume with a gold hem and a brooch of the
  // two theatre masks, and a big comedy mask held up on a gold stick, its
  // rim lit like stage lights. The mask is held at its left: the viewer's
  // right from the front, the viewer's left from behind, and out in front of
  // the body in profile.
  duskveil(k) {
    const velvet = "#4a1f5a",
      gold = "#f2c14e";
    const masks = (x: number, y: number) =>
      k.path(`M${x - 6} ${y - 4}q3 -2 6 0v4q-3 4 -6 0Z`, "#fff3c4", k.ink, 0.5) + k.path(`M${x} ${y - 2}q3 -2 6 0v4q-3 4 -6 0Z`, "#c9a3e7", k.ink, 0.5);
    if (k.back) backPanel(k, velvet, k.line(`M${k.C - k.W} ${k.B - 3}H${k.C + k.W}`, gold, 1.6));
    else {
      const c = cx(k);
      k.put("body", torso(k, velvet, k.line(`M${k.L} ${k.B - 3}H${k.R}`, gold, 1.6)) + k.lume("pulse", masks(c, k.T + 12), 0, "#ffd27a"));
    }
    // The comedy mask on its stick: a white face with gold rim, eye holes
    // and a wide smile; facing us from the front and in profile, its back
    // (plain gold) from behind.
    const mx = k.back ? k.L - 12 : k.side ? k.C + k.side * 26 : k.R + 14,
      my = k.T - 20;
    const face = k.back
      ? k.path(`M${mx - 12} ${my - 9}Q${mx} ${my - 15} ${mx + 12} ${my - 9}Q${mx + 13} ${my + 6} ${mx} ${my + 12}Q${mx - 13} ${my + 6} ${mx - 12} ${my - 9}Z`, "#b8862a")
      : k.path(`M${mx - 12} ${my - 9}Q${mx} ${my - 15} ${mx + 12} ${my - 9}Q${mx + 13} ${my + 6} ${mx} ${my + 12}Q${mx - 13} ${my + 6} ${mx - 12} ${my - 9}Z`, "#fff6e0") +
        k.path(`M${mx - 8} ${my - 3}q3 -4 6 0q-3 2 -6 0Z M${mx + 2} ${my - 3}q3 -4 6 0q-3 2 -6 0Z`, "#2a1f2e", "none") +
        k.path(`M${mx - 7} ${my + 3}Q${mx} ${my + 11} ${mx + 7} ${my + 3}Q${mx} ${my + 6} ${mx - 7} ${my + 3}Z`, "#c8323a", k.ink, 0.5) +
        k.circle(mx - 8, my + 2, 1.6, "#ff9ab0", "none", 0) + k.circle(mx + 8, my + 2, 1.6, "#ff9ab0", "none", 0);
    const stick = k.line(`M${mx + (k.back ? 2 : -2)} ${my + 11}L${mx + (k.back ? 5 : -5)} ${my + (k.B - 14 - my) / 1.5}`, gold, 2.4);
    const rim = k.lume("pulse", `<path d="M${mx - 12} ${my - 9}Q${mx} ${my - 15} ${mx + 12} ${my - 9}Q${mx + 13} ${my + 6} ${mx} ${my + 12}Q${mx - 13} ${my + 6} ${mx - 12} ${my - 9}Z" fill="none" stroke="${gold}" stroke-width="2"/>`, 1, "#ffd27a");
    // A ribbon of marquee lights trails from the stick.
    const bulbs = [0, 1, 2].map((i) => k.lume("chase", k.circle(mx + (k.back ? 4 : -4) + (i - 1) * 5, my + 16 + i * 4, 1.6, "#fff3a8", "none", 0), 2 + i, "#fff3a8")).join("");
    // Drawn half again as large, so it reads at play size.
    const big = (svg: string) => `<g transform="translate(${mx} ${my}) scale(1.5) translate(${-mx} ${-my})">${svg}</g>`;
    k.put("flame", big(stick + face + rim + bulbs));
  },
  // Robotics Club: overalls with a tool belt, a robot badge whose eyes
  // blink, and an antenna headband with a light on top.
  coilemur(k) {
    const denim = "#3a5a8c";
    if (k.back) backPanel(k, denim, k.rect(k.C - k.W - 2, k.B - 10, 2 * k.W + 4, 4, 0, "#7a5a3a"));
    else {
      const c = cx(k);
      k.put("body", torso(k, denim, k.rect(c - 9, k.T, 18, 14, 2, "#4a6aa0", k.ink, 0.6) + k.rect(k.L - 2, k.B - 10, k.R - k.L + 4, 4, 0, "#7a5a3a") +
        [-1, 1].map((s) => k.rect(c + s * 9 - 2, k.B - 9, 4, 6, 0.5, "#9aa4b8", k.ink, 0.4)).join("")) +
        // The robot badge: a little square face with blinking eyes.
        k.rect(c - 5, k.T + 3, 10, 8, 2, "#d9d9e0", k.ink, 0.6) +
        k.lume("blink", k.circle(c - 2, k.T + 7, 1, "#7ff3ff", "none", 0) + k.circle(c + 2, k.T + 7, 1, "#7ff3ff", "none", 0), 0, "#7ff3ff"));
    }
    const x = k.hx + k.side * 2;
    k.put("flame", band(k, k.ht + 18, k.side ? 42 : 48, "#3a3f52", 5) + k.line(`M${x} ${k.ht + 12}V${k.ht - 6}`, "#8a8a96", 1.4) +
      k.lume("blink", k.circle(x, k.ht - 8, 2.6, "#ff4f5a", k.ink, 0.5), 1, "#ff4f5a"));
  },
  // Baking Club: an apron and a chef's toque, and a cupcake with a lit
  // candle held at the pocket.
  pyranda(k) {
    const apron = "#fff3e6";
    if (k.back) backPanel(k, "#d9572b", k.path(`M${k.C - 6} ${k.T + 14}l6 4l6 -4l-2 6h-8Z`, apron, k.ink, 0.6));
    else {
      const c = cx(k);
      k.put("body", torso(k, "#d9572b", k.path(`M${c - 12} ${k.T + 2}H${c + 12}L${c + 14} ${k.B + 4}H${c - 14}Z`, apron, k.ink, 0.8) + k.rect(c - 6, k.T + 16, 12, 7, 1, "#f2dcc8", k.ink, 0.5)));
      const px = c + (k.side ? k.side * 4 : 8),
        py = k.T + 14;
      k.put("body", k.path(`M${px - 4} ${py}h8l-1.4 5h-5.2Z`, "#c8823a", k.ink, 0.5) + k.path(`M${px - 4.5} ${py}q4.5 -6 9 0Z`, "#ff9ac0", k.ink, 0.5) +
        k.line(`M${px} ${py - 3}v-3`, "#ffffff", 1) + k.lume("pulse", k.path(`M${px} ${py - 9}q1.6 2 0 3q-1.6 -1 0 -3Z`, "#ffd84a", "#ff8a1a", 0.4), 0, "#ffb347"));
    }
    // The toque: a puffed crown on a band.
    const x = k.hx + k.side * 2,
      y = k.ht + 14;
    k.put("flame", k.rect(x - 22, y - 6, 44, 8, 2, "#ffffff") +
      [-1, 0, 1].map((s) => k.circle(x + s * 13, y - 16, 12, "#ffffff")).join("") + k.line(`M${x - 20} ${y - 3}H${x + 20}`, "#e0e0e8", 1));
  },
  // Choir: a choir robe with a stole, and music notes on the stole that
  // twinkle one after another.
  glacelle(k) {
    const robe = "#2c5f8c",
      stole = "#ffd84a";
    const note = (x: number, y: number, i: number) => k.lume("twinkle", k.circle(x, y, 1.6, "#ffffff", "none", 0) + k.line(`M${x + 1.5} ${y}v-6l3 1`, "#ffffff", 0.8), i, "#ffffff");
    if (k.back) backPanel(k, robe, k.path(`M${k.C - 10} ${k.T - 1}L${k.C} ${k.T + 12}L${k.C + 10} ${k.T - 1}`, "none", stole, 3));
    else {
      const c = cx(k);
      k.put("body", torso(k, robe, k.path(`M${c - 12} ${k.T - 2}L${c - 6} ${k.B + 4}M${c + 12} ${k.T - 2}L${c + 6} ${k.B + 4}`, "none", stole, 4) +
        note(c - 9, k.T + 10, 0) + note(c + 9, k.T + 16, 1) + note(c - 7, k.T + 22, 2)));
    }
  },
  // Archery Club: a chest guard, a quiver on the back whose arrow tips glow,
  // and a sweatband.
  halcyra(k) {
    const shirt = "#f4f1ea";
    if (k.back) backPanel(k, shirt);
    else {
      const c = cx(k);
      k.put("body", torso(k, shirt, k.path(`M${c - 12} ${k.T + 2}L${c + 4} ${k.T + 2}L${c + 2} ${k.B - 6}L${c - 12} ${k.B - 4}Z`, "#3a3a48", k.ink, 0.7) + k.line(`M${k.L} ${k.T + 2}L${k.R} ${k.B - 4}`, "#7a4a24", 2)));
    }
    // The quiver over a shoulder, with three lit arrow tips.
    onPole(k, (x, y) => k.rect(x - 5, y + 2, 10, 20, 3, "#7a4a24", k.ink, 0.8) +
      [-3, 0, 3].map((dx, i) => k.line(`M${x + dx} ${y + 4}V${y - 6}`, "#d9c08a", 1.2) + k.lume("chase", k.path(`M${x + dx} ${y - 11}l2 5h-4Z`, "#7ff3ff", k.ink, 0.4), i, "#7ff3ff")).join(""));
    k.put("flame", band(k, k.ht + 20, k.side ? 42 : 48, "#2f6fb8", 5));
  },
  // Astronomy Club: a navy pinafore with constellation pins that light in
  // turn, and a telescope slung on the back.
  astrabun(k) {
    const navy = "#2a2f6e";
    const pins = (x0: number, y0: number) => [[0, 0], [5, 3], [9, -1], [13, 4]].map(([dx, dy], i) => k.lume("chase", k.circle(x0 + dx, y0 + dy, 1.1, "#fff3a8", "none", 0), i, "#fff3a8")).join("") +
      k.line(`M${x0} ${y0}L${x0 + 5} ${y0 + 3}L${x0 + 9} ${y0 - 1}L${x0 + 13} ${y0 + 4}`, "#fff3a855", 0.6);
    if (k.back) backPanel(k, navy, pins(k.C - 6, k.T + 12));
    else {
      const c = cx(k);
      k.put("body", torso(k, navy, collar(k, c, "#ffd84a", true) + pins(c - 12, k.T + 16)));
    }
    onPole(k, (x, y) => `<g transform="rotate(${k.side ? -k.side * 30 : 30} ${x} ${y + 10})">` + k.rect(x - 4, y - 6, 8, 26, 2, "#b8823a", k.ink, 0.8) + k.rect(x - 5, y - 8, 10, 4, 1, "#e6c46a", k.ink, 0.5) +
      k.lume("pulse", k.circle(x, y - 6, 2.4, "#bfe8ff", "none", 0), 3, "#bfe8ff") + "</g>");
  },
  // Gardening Club: overalls, a straw hat and a seedling in a pot whose
  // first leaves glow.
  wombolder(k) {
    const denim = "#5a7a3a";
    if (k.back) backPanel(k, denim);
    else {
      const c = cx(k);
      k.put("body", torso(k, "#f4ead0", k.path(`M${c - 12} ${k.T + 6}H${c + 12}V${k.B + 4}H${c - 12}Z`, denim, k.ink, 0.7) + k.line(`M${c - 10} ${k.T}V${k.T + 6}M${c + 10} ${k.T}V${k.T + 6}`, denim, 2.4) +
        k.rect(c - 6, k.T + 10, 12, 7, 1, "#6a8a4a", k.ink, 0.5)));
      // The pot at the bib pocket, its seedling lit.
      const px = c + (k.side ? k.side * 3 : 0);
      k.put("body", k.path(`M${px - 4} ${k.T + 9}h8l-1.4 6h-5.2Z`, "#b85a3a", k.ink, 0.5) + k.line(`M${px} ${k.T + 9}v-4`, "#3f8a4f", 1) +
        k.lume("pulse", k.path(`M${px} ${k.T + 5}q-4 -1 -4 -4q3 0 4 4Z M${px} ${k.T + 5}q4 -1 4 -4q-3 0 -4 4Z`, "#b6ff4f", k.ink, 0.4), 0, "#b6ff4f"));
    }
    k.put("flame", hatShape(k, 30, 14, k.ht + 18, "#e8c88a", "#e8c88a", 1.7) + k.line(`M${k.hx + k.side * 2 - 18} ${k.ht + 14}Q${k.hx} ${k.ht + 11} ${k.hx + k.side * 2 + 18} ${k.ht + 14}`, "#c8323a", 2));
  },
  // Mystery Club: a checked deerstalker and a magnifying glass on a cord
  // whose lens catches the light.
  shadopus(k) {
    const tweed = "#7a6a4a";
    if (k.back) backPanel(k, tweed);
    else {
      const c = cx(k);
      k.put("body", torso(k, tweed, collar(k, c, "#2a2a36") + k.path(`M${k.L - 2} ${k.T}L${c - 6} ${k.T + 14}L${k.L - 2} ${k.T + 20}Z M${k.R + 2} ${k.T}L${c + 6} ${k.T + 14}L${k.R + 2} ${k.T + 20}Z`, "#6a5a3a", k.ink, 0.7)));
      const gx = c + (k.side ? k.side * 6 : 11),
        gy = k.T + 16;
      k.put("body", k.line(`M${c + 4} ${k.T + 2}Q${gx + 2} ${gy - 8} ${gx} ${gy - 5}`, "#3a2a1c", 0.7) + k.line(`M${gx + 3} ${gy + 3}l4 5`, "#5a3a22", 2) +
        k.circle(gx, gy, 5, "#bfe8ff44", "#c9a24a", 1.6) + k.lume("twinkle", k.line(`M${gx - 2.5} ${gy - 1}l2 -2.5`, "#ffffff", 1.2), 0, "#ffffff"));
    }
    // The deerstalker, with its flaps and peaks.
    const x = k.hx + k.side * 2,
      y = k.ht + 16;
    const w = k.side ? 44 : 50;
    k.put("flame", k.path(`M${x - w} ${y + 2}Q${x - w} ${k.ht - 14} ${x} ${k.ht - 14}Q${x + w} ${k.ht - 14} ${x + w} ${y + 2}Q${x} ${y - 6} ${x - w} ${y + 2}Z`, tweed) +
      [0.3, 0.55, 0.8].map((u) => k.line(`M${x - w * 0.9} ${y - (y - k.ht + 14) * u}Q${x} ${y - (y - k.ht + 14) * u - 6} ${x + w * 0.9} ${y - (y - k.ht + 14) * u}`, "#5a4a2c", 0.8)).join("") +
      k.path(`M${x - 8} ${y - 2}Q${x} ${y + 6} ${x + 8} ${y - 2}Z`, "#6a5a3a"));
  },
  // Marching Band: a shako with a plume and a drum at the front whose rim
  // lights run round.
  pangrove(k) {
    const jacket = "#c8323a";
    if (k.back) backPanel(k, jacket, k.line(`M${k.C - k.W} ${k.T + 2}L${k.C + k.W} ${k.B - 4}M${k.C + k.W} ${k.T + 2}L${k.C - k.W} ${k.B - 4}`, "#ffffff", 1.6));
    else {
      const c = cx(k);
      k.put("body", torso(k, jacket, k.line(`M${k.L} ${k.T + 2}L${c} ${k.T + 14}L${k.R} ${k.T + 2}`, "#ffffff", 1.6) + [0, 1, 2].map((i) => k.circle(c, k.T + 16 + i * 5, 1, "#ffd84a", "none", 0)).join("")));
      // The drum, slung low, its rim of lights.
      const dy = k.B - 2;
      k.put("body", `<ellipse cx="${c}" cy="${dy}" rx="15" ry="5" fill="#f4f4f8" stroke="${k.ink}" stroke-width="0.8"/>` + k.rect(c - 15, dy, 30, 9, 0, "#2f6fb8", k.ink, 0.8) +
        [0, 1, 2, 3, 4, 5].map((i) => k.lume("chase", k.circle(c - 13 + i * 5.2, dy + 7, 0.9, "#ffd84a", "none", 0), i, "#ffd84a")).join(""));
    }
    // The shako: a tall cylinder with a peak and a plume.
    const x = k.hx + k.side * 2,
      y = k.ht + 14;
    k.put("flame", k.rect(x - 16, y - 26, 32, 28, 3, "#2a2a36") + k.path(`M${x - 18} ${y}Q${x} ${y + 6} ${x + 18} ${y}L${x + 16} ${y - 3}Q${x} ${y + 2} ${x - 16} ${y - 3}Z`, "#2a2a36") +
      k.line(`M${x - 16} ${y - 20}H${x + 16}`, "#ffd84a", 2) + k.path(`M${x} ${y - 26}C${x - 6} ${y - 34} ${x - 2} ${y - 44} ${x + 4} ${y - 46}C${x + 2} ${y - 38} ${x + 6} ${y - 32} ${x} ${y - 26}Z`, "#ffffff"));
  },
  // Nap Club: pyjamas, a nightcap with a glowing star pom and a sleep mask
  // pushed up on the brow.
  mossloth(k) {
    const pj = "#9ab8e8";
    const dots = (x0: number, y0: number, w: number, h: number) => [0, 1, 2, 3, 4, 5].map((i) => k.circle(x0 + ((i * 0.41) % 1) * w, y0 + ((i * 0.67) % 1) * h, 1.2, "#ffffff", "none", 0)).join("");
    if (k.back) backPanel(k, pj, dots(k.C - k.W + 2, k.T + 4, 2 * k.W - 4, k.B - k.T - 8));
    else {
      const c = cx(k);
      k.put("body", torso(k, pj, dots(k.L + 2, k.T + 4, k.R - k.L - 4, k.B - k.T - 8) + k.line(`M${c} ${k.T + 2}V${k.B}`, "#7a98c8", 1) + collar(k, c, "#7a98c8", true)));
    }
    // The nightcap droops to one side, its pom glowing; the mask on the brow.
    const x = k.hx + k.side * 2,
      y = k.ht + 14;
    const tip = x + (k.side ? -k.side * 34 : 36);
    k.put("flame", k.path(`M${x - 40} ${y + 2}Q${x - 36} ${k.ht - 14} ${x} ${k.ht - 16}Q${x + 26} ${k.ht - 16} ${tip} ${y + 10}L${tip - 4} ${y + 12}Q${x + 20} ${y - 6} ${x + 40} ${y + 2}Q${x} ${y - 6} ${x - 40} ${y + 2}Z`, "#5a7ab8") +
      k.lume("pulse", k.path(starD(tip, y + 14, 5), "#fff3a8", k.ink, 0.6), 0, "#fff3a8") +
      (k.back ? "" : band(k, y + 6, k.side ? 40 : 46, "#c9a3e7", 7)));
  },
};

function starD(x: number, y: number, r: number) {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + "Z";
}

Object.assign((DESIGNS.campus ??= {}), CAMPUS);

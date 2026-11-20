import { addDetails, inMalletFrame, type Details } from "./legend-details";
import type { Kit } from "./modern-designs";

/**
 * Epic signature props: every Hero Squad and Neon Campus skin carries one
 * piece of its own that reads at battle size, where the costume alone was
 * small behind the arms: a hero's power (a trident, a tesla magnet, a
 * katana, a clock on the back...) or a club's kit (a swim ring, a robot
 * buddy, a palette, a giant magnifier...). Each changes the champion's
 * outline, and its lit part speaks Epic's language (lume). Nothing here is
 * a Legendary mark: no aura, no gold rim or clasp, no summoned motif.
 *
 * Placement is shared, so every piece sits the same way in all four views:
 *  - `held`: at the hand, where Pyranda holds its chestnut (front), before
 *    the chest (profile), at the other hand from behind;
 *  - `onBack`: whole from behind, peeking past the shoulders and head from
 *    the front, behind the body in profile;
 *  - `slung`: carried on a shaft across the back, its head above a
 *    shoulder (as `onPole` does);
 *  - the head-top part, above the eyes, for headwear.
 */
type View = "front" | "side" | "back";
const sc = (x: number, y: number, s: number, svg: string) => `<g transform="translate(${x.toFixed(1)} ${y.toFixed(1)}) scale(${s}) translate(${(-x).toFixed(1)} ${(-y).toFixed(1)})">${svg}</g>`;
const poly = (pts: number[][]) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";

function held(k: Kit, draw: (x: number, y: number, f: number) => string) {
  const at = (x: number, y: number, f: number) => sc(x, y, 1.3, draw(x, y, f));
  if (k.back) k.put("scarf", at(k.C - k.W - 15, k.T + 14, -1));
  else if (k.side) k.put("body", at(k.C + k.side * (k.W + 4), k.T + 16, k.side));
  else k.put("body", at(k.C + k.W + 15, k.T + 14, 1));
}
function onBack(k: Kit, draw: (x: number, y: number, v: View) => string, spread = false) {
  if (k.back) k.put("scarf", draw(k.C, k.T + 12, "back"));
  // The chibi head hides the shoulders: from the front and side a piece
  // shows beside the body, below the head, so it is set low and spread.
  // A piece that spreads out beside the body (wings, boosters) is drawn
  // over its edge, or the arms would hide it; others sit behind.
  // In profile it sits out past the line of the back, drawn over the
  // body's edge, or the body and tail would hide it.
  else if (k.side) k.put("body", draw(k.C - k.side * (k.W + 9), k.T + 22, "side"));
  else k.put("body", draw(k.C, k.T + 14, "front"), !spread);
}
function slung(k: Kit, shaft: string, sw: number, head: (x: number, y: number, a: number) => string, over = false) {
  const s = k.side ? -k.side : 1;
  const [x0, y0, x, y] = k.back ? [k.C + s * 10, k.B - 4, k.C - s * 34, k.T - 34] : [k.C + s * 12, k.B - 6, k.C + s * (k.side ? 40 : 62), k.T - 16];
  const a = (Math.atan2(y - y0, x - x0) * 180) / Math.PI + 90;
  const svg = k.line(`M${x0} ${y0}L${x} ${y}`, k.ink, sw + 1.6) + k.line(`M${x0} ${y0}L${x} ${y}`, shaft, sw) + head(x, y, a);
  if (k.back) k.put("scarf", svg);
  else k.put("body", svg, !over);
}
/** A lightning bolt, point down, about 30 tall. */
const boltD = (x: number, y: number) => poly([[x + 3, y - 15], [x - 7, y + 1], [x - 1, y + 1], [x - 4, y + 15], [x + 7, y - 3], [x + 1, y - 3], [x + 5, y - 15]]);
const shard = (x: number, y: number, w: number, h: number, lean = 0) =>
  poly([[x - w, y], [x - w * 0.7 + lean * 0.5, y - h * 0.7], [x + lean, y - h], [x + w * 0.7 + lean * 0.5, y - h * 0.7], [x + w, y]]);
const leafD = (x: number, y: number, len: number, a: number) =>
  `<path d="M${x} ${y}Q${x - len * 0.32} ${y - len * 0.5} ${x} ${y - len}Q${x + len * 0.32} ${y - len * 0.5} ${x} ${y}Z" transform="rotate(${a} ${x} ${y})"`;

// ================= Hero Squad =================
const HERO: Details = {
  // Volt Streak: lightning-bolt fins flaring off its winged visor.
  voltkit(k) {
    const y = k.ht + 6;
    const fin = (x: number, a: number, i: number) => k.lume("pulse", `<g transform="rotate(${a} ${x} ${y})">${sc(x, y, 1.45, k.path(boltD(x, y - 10), "#ffd84a", k.ink, 1))}</g>`, i, "#ffd84a");
    k.put("flame", k.side ? fin(k.hx - k.side * 22, -k.side * 30, 0) : fin(k.hx - 34, -30, 0) + fin(k.hx + 34, 30, 1));
  },
  // Blaze Breaker: a molten greatsword across its back: a riveted iron
  // crossguard, a leather-wrapped grip and pommel, and a blade fuller that
  // runs with magma, its edge glowing.
  cindrake(k) {
    slung(k, "#3a2a24", 3.4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.circle(x, y + 13, 2.4, "#6a5a52", k.ink, 0.7) +
      k.rect(x - 1.8, y + 5, 3.6, 7, 1, "#5a3a24", k.ink, 0.6) + k.line(`M${x - 1.8} ${y + 6.5}l3.6 1.4M${x - 1.8} ${y + 8.8}l3.6 1.4`, "#2a1a10", 0.6) +
      k.path(`M${x - 9} ${y + 2}L${x - 7} ${y + 5.4}H${x + 7}L${x + 9} ${y + 2}L${x + 7} ${y + 3}H${x - 7}Z`, "#4a4452", k.ink, 0.9) +
      k.circle(x - 6, y + 3.6, 0.6, "#a8a8b4", "none", 0) + k.circle(x + 6, y + 3.6, 0.6, "#a8a8b4", "none", 0) +
      k.path(`M${x - 5} ${y + 2}V${y - 22}L${x} ${y - 30}L${x + 5} ${y - 22}V${y + 2}Z`, "#3a3440", k.ink, 1) +
      k.line(`M${x - 3.6} ${y}V${y - 21}`, "#5a5462", 0.8) +
      k.lume("pulse", k.path(`M${x - 1.6} ${y}V${y - 21}L${x} ${y - 25}L${x + 1.6} ${y - 21}V${y}Z`, "#ff8a3a", "none", 0) + k.line(`M${x + 4.4} ${y - 1}V${y - 21.4}L${x} ${y - 29}`, "#ffb347", 0.8), 3, "#ff8a3a") + `</g>`);
  },
  // Tide Guardian: a golden trident across its back: barbed prongs with
  // lit tips, a crossbar set with a pearl, and a shaft bound with sea-blue
  // cord.
  tidefin(k) {
    slung(k, "#e8b84a", 2.4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.line(`M${x} ${y + 8}V${y + 14}`, "#2c6fb0", 3.4) + k.line(`M${x - 1.6} ${y + 9}l3.2 1.4M${x - 1.6} ${y + 11.6}l3.2 1.4`, "#9fd8ff", 0.6) +
      k.path(`M${x - 10} ${y - 2}Q${x} ${y + 7} ${x + 10} ${y - 2}L${x + 10} ${y - 15}L${x + 12} ${y - 12}L${x + 7} ${y - 6}Q${x} ${y} ${x - 7} ${y - 6}L${x - 12} ${y - 12}L${x - 10} ${y - 15}Z`, "#e8b84a", k.ink, 0.9) +
      k.path(`M${x - 2.2} ${y + 1}L${x} ${y - 20}L${x + 2.2} ${y + 1}Z`, "#e8b84a", k.ink, 0.9) + k.path(`M${x - 2} ${y - 13}l-2.4 2.4l2.2 -0.2Z M${x + 2} ${y - 13}l2.4 2.4l-2.2 -0.2Z`, "#c8902a", k.ink, 0.5) +
      k.rect(x - 7, y + 2.4, 14, 3, 1.2, "#c8902a", k.ink, 0.7) + k.circle(x, y + 3.9, 1.7, "#f4f0ff", k.ink, 0.5) +
      k.lume("pulse", k.circle(x - 10, y - 15, 1.6, "#bff6ff", "none", 0) + k.circle(x, y - 20, 1.8, "#bff6ff", "none", 0) + k.circle(x + 10, y - 15, 1.6, "#bff6ff", "none", 0), 3, "#7ff0ff") + `</g>`);
  },
  // Prism Fist: a cluster of great prism crystals rising off its back.
  auralynx(k) {
    onBack(k, (x, y, v) => {
      if (v === "front")
        // From the front, a cluster rises beside each arm, clear of the chest.
        return [-1, 1].map((s) => {
          const bx = x + s * (k.W + 12),
            by = y + 10;
          return [[0, 30, s * 4, 6], [s * 7, 20, s * 10, 4.5], [-s * 5, 18, -s * 2, 4]].map(([dx, h, lean, hw], i) =>
            k.path(shard(bx + dx, by, hw, h, lean), i ? "#8ab4ff" : "#c8b0ff", k.ink, 1.1)).join("") +
            k.lume("pulse", k.line(`M${bx} ${by - 4}L${bx + s * 4} ${by - 27}`, "#ffffff", 1.3), s > 0 ? 4 : 3, "#bfe8ff");
        }).join("");
      const w = v === "side" ? 0.6 : 1;
      const lean = 6;
      return [[-16 * w, 22, -lean, 7], [16 * w, 22, lean, 7], [0, 32, 0, 8]].map(([dx, h, lean, hw], i) =>
        k.path(shard(x + dx, y + 2, hw, h + 14, lean), i === 2 ? "#c8b0ff" : "#8ab4ff", k.ink, 1) +
        k.lume("pulse", k.line(`M${x + dx} ${y - 2}L${x + dx + lean} ${y - h - 6}`, "#ffffff", 1.2), 3 + i, "#bfe8ff")).join("");
    }, true);
  },
  // Lumina: a lantern staff, its lantern alight with a cold white flame
  // in a dark iron frame, so it shows on its golden body.
  lumoth(k) {
    const iron = "#2e2a3a";
    slung(k, iron, 2.4, (x, y) => sc(x, y, 1.3,
      k.line(`M${x} ${y}V${y - 4}`, iron, 1.6) + k.path(`M${x - 9} ${y - 4}H${x + 9}L${x + 6} ${y - 8}H${x - 6}Z`, iron, k.ink, 0.8) +
      k.rect(x - 8, y - 3, 16, 19, 3, "#e8fbff", iron, 1.6) + k.lume("pulse", k.rect(x - 5.5, y - 0.5, 11, 14, 2, "#7ff0ff", "none", 0) + k.path(`M${x} ${y + 1}q4 5 0 10q-4 -5 0 -10Z`, "#ffffff", "none", 0), 3, "#7ff0ff") +
      k.line(`M${x} ${y - 3}V${y + 16}`, iron, 1.2) + k.path(`M${x - 9} ${y + 16}H${x + 9}L${x + 6} ${y + 20}H${x - 6}Z`, iron, k.ink, 0.8)));
  },
  // Third Eye: a seer's staff, its head a silver crescent cradling a lit
  // star and an eye-shaped gem, ribbons tied below it.
  mystowl(k) {
    slung(k, "#3a3070", 2.4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.path(`M${x - 1} ${y + 2}q-6 4 -8 12M${x + 1} ${y + 2}q6 3 7 11`, "none", "#b9a8ff", 1.4) +
      k.rect(x - 2.6, y - 1, 5.2, 4, 1, "#c8ccd6", k.ink, 0.6) +
      k.path(`M${x + 5} ${y - 22}A11 11 0 1 0 ${x + 5} ${y}A8.5 8.5 0 1 1 ${x + 5} ${y - 22}Z`, "#d8dcf0", k.ink, 1) +
      k.path(`M${x - 6.4} ${y - 15}A8 8 0 0 0 ${x - 4} ${y - 4}`, "none", "#ffffff", 1) +
      k.path(`M${x - 4.6} ${y - 11}q2 -2.4 4.6 0q-2.6 2.4 -4.6 0Z`, "#7a5cff", k.ink, 0.5) + k.circle(x - 2.3, y - 11, 0.8, "#1e1a4a", "none", 0) +
      k.lume("pulse", k.path(k.star(x + 2, y - 11, 5, 5), "#ffffff", k.ink, 0.6), 3, "#c8b8ff") + `</g>`, true);
  },
  // Iron Bulwark: a stone tower shield rimmed in riveted iron, a raised
  // boss at its heart, chips in the stone and lava glowing in its cracks.
  terradon(k) {
    held(k, (x, y) => {
      const d = `M${x - 13} ${y - 16}H${x + 13}V${y + 2}Q${x + 13} ${y + 16} ${x} ${y + 22}Q${x - 13} ${y + 16} ${x - 13} ${y + 2}Z`;
      const inner = `M${x - 9.5} ${y - 12.5}H${x + 9.5}V${y + 1.5}Q${x + 9.5} ${y + 12.5} ${x} ${y + 17}Q${x - 9.5} ${y + 12.5} ${x - 9.5} ${y + 1.5}Z`;
      return k.path(d, "#4a4652", k.ink, 1.3) + k.path(inner, "#6a6670", "#3a3640", 0.9) +
        [[-11, -14], [0, -14], [11, -14], [-11, -4], [11, -4], [-9, 8], [9, 8], [0, 19]].map(([dx, dy]) => k.circle(x + dx, y + dy, 0.9, "#a8a8b4", k.ink, 0.4)).join("") +
        k.path(`M${x - 6} ${y - 9}l3 1l-1 3Z M${x + 5} ${y + 9}l3 -1l-1 3Z`, "#57535c", "none", 0) +
        k.lume("pulse", k.line(`M${x - 6} ${y - 10}L${x - 1} ${y - 3}L${x + 5} ${y - 7}M${x - 1} ${y - 3}L${x + 1} ${y + 7}L${x - 4} ${y + 12}M${x + 1} ${y + 7}L${x + 6} ${y + 9}`, "#ff8a3a", 1.6), 3, "#ff8a3a") +
        k.circle(x, y - 1, 3.6, "#57535c", k.ink, 0.9) + k.circle(x - 1, y - 2, 1.2, "#8a8694", "none", 0);
    });
  },
  // Duskwatch: its cape flares into tattered night wings either side.
  duskveil(k) {
    const night = "#241634";
    const wing = (s: number, x: number) =>
      k.path(`M${x} ${k.T}Q${x + s * 20} ${k.T - 6} ${x + s * 28} ${k.T + 8}L${x + s * 22} ${k.B + 4}L${x + s * 16} ${k.B - 2}L${x + s * 10} ${k.B + 8}L${x + s * 4} ${k.B}Z`, night, k.ink, 1) +
      k.lume("chase", k.line(`M${x + s * 4} ${k.T + 1}Q${x + s * 20} ${k.T - 4} ${x + s * 27} ${k.T + 8}`, "#7fe0ff", 1.2), 3, "#7fe0ff");
    if (k.back) k.put("scarf", wing(-1, k.C - k.W + 4) + wing(1, k.C + k.W - 4));
    else k.put("body", k.side ? wing(-k.side, k.C - k.side * 6) : wing(-1, k.C - k.W + 4) + wing(1, k.C + k.W - 4), true);
  },
  // Magnetail: a great horseshoe magnet mounted on its back, sparking.
  coilemur(k) {
    onBack(k, (x, y, v) => {
      if (v === "front") {
        // From the front its two arms rise either side of the body.
        const w = k.W + 13,
          top = y - 22;
        return [-1, 1].map((s) => k.rect(x + s * w - 4.5, top, 9, 30, 2, "#e0303a", k.ink, 1.1) + k.line(`M${x + s * w - 4.5} ${top + 10}h9M${x + s * w - 4.5} ${top + 12}h9`, "#a81c24", 0.9) +
          k.rect(x + s * w - 4.5, top - 8, 9, 9, 0, "#dfe4ec", k.ink, 1) + k.line(`M${x + s * w - 3} ${top - 6}h6`, "#ffffff", 0.8) +
          k.path(s < 0 ? `M${x + s * w - 1.6} ${top - 1.6}v-4.6l3.2 4.6v-4.6` : `M${x + s * w + 1.6} ${top - 5.8}h-3.2v2.3h3.2v2.3h-3.2`, "none", "#3a3f4a", 0.8)).join("") +
          k.lume("blink", k.line(`M${x - w} ${top - 10}l3 -5l-2 0l3 -5M${x + w} ${top - 10}l-3 -5l2 0l-3 -5`, "#fff7a8", 1.3), 3, "#fff7a8");
      }
      const w = v === "side" ? 10 : k.W + 4,
        top = y - 34;
      return k.path(`M${x - w} ${top}V${y - 4}Q${x - w} ${y + 14} ${x} ${y + 14}Q${x + w} ${y + 14} ${x + w} ${y - 4}V${top}H${x + w - 9}V${y - 4}Q${x + w - 9} ${y + 5} ${x} ${y + 5}Q${x - w + 9} ${y + 5} ${x - w + 9} ${y - 4}V${top}Z`, "#e0303a", k.ink, 1.1) +
        k.rect(x - w, top - 8, 9, 9, 0, "#dfe4ec", k.ink, 1) + k.rect(x + w - 9, top - 8, 9, 9, 0, "#dfe4ec", k.ink, 1) +
        k.line(`M${x - w} ${top + 10}h9M${x + w - 9} ${top + 10}h9M${x - w} ${top + 12}h9M${x + w - 9} ${top + 12}h9`, "#a81c24", 0.9) +
        k.rect(x - 5, y + 6.4, 10, 5, 1.4, "#c8ccd6", k.ink, 0.7) + k.circle(x - 2.6, y + 8.9, 0.8, "#4a4f5c", "none", 0) + k.circle(x + 2.6, y + 8.9, 0.8, "#4a4f5c", "none", 0) +
        k.lume("blink", k.line(`M${x - w + 4} ${top - 10}l3 -5l-2 0l3 -5M${x + w - 4} ${top - 10}l-3 -5l2 0l-3 -5`, "#fff7a8", 1.3), 3, "#fff7a8");
    });
  },
  // Chestnut Comet: twin chestnut boosters, their nozzles burning.
  pyranda(k) {
    onBack(k, (x, y, v) => {
      const xs = v === "side" ? [x] : v === "front" ? [x - k.W - 8, x + k.W + 8] : [x - k.W + 2, x + k.W - 2];
      return xs.map((bx, i) =>
        k.path(`M${bx - 6} ${y - 2}l-4 7l4 -1Z M${bx + 6} ${y - 2}l4 7l-4 -1Z`, "#c8ccd6", k.ink, 0.7) +
        k.rect(bx - 6, y - 24, 12, 28, 4, "#8a4a2a", k.ink, 1.1) +
        k.path(`M${bx - 6} ${y - 22}Q${bx} ${y - 34} ${bx + 6} ${y - 22}Z`, "#c8ccd6", k.ink, 0.9) +
        k.rect(bx - 6.4, y - 18, 12.8, 2.6, 0.8, "#c8ccd6", k.ink, 0.6) + k.rect(bx - 6.4, y - 4, 12.8, 2.6, 0.8, "#c8ccd6", k.ink, 0.6) +
        [-3.6, 0, 3.6].map((d) => k.circle(bx + d, y - 16.7, 0.5, "#4a4f5c", "none", 0) + k.circle(bx + d, y - 2.7, 0.5, "#4a4f5c", "none", 0)).join("") +
        k.path(`M${bx} ${y - 14}q4 2 3 6q-3 3 -6 0q-1 -4 3 -6Z`, "#5a2e18", k.ink, 0.5) +
        k.path(`M${bx - 4} ${y + 4}H${bx + 4}L${bx + 6} ${y + 9}H${bx - 6}Z`, "#4a4a56", k.ink, 0.8) + k.line(`M${bx - 5} ${y + 6.5}h10`, "#8a8f9c", 0.7) +
        k.lume("pulse", k.path(`M${bx - 4} ${y + 9}Q${bx} ${y + 22} ${bx + 4} ${y + 9}Z`, "#ffb347", "none", 0), 3 + i, "#ffb347")).join("");
    }, true);
  },
  // Frost Sentinel: wings of ice shards fanning out from its back. From the
  // front they rise beside the arms, clear of the head; in profile they fan
  // backward, away from the face, out past the line of the back.
  glacelle(k) {
    onBack(k, (x, y, v) => {
      // Which way each wing fans: both sides from the front and behind, only
      // toward the back in profile (left of a right-facing champion).
      const sides = v === "side" ? [-k.side] : [-1, 1];
      const by = v === "front" ? y - 2 : y;
      return sides.map((s) => [0, 1, 2].map((i) => {
        const bx = x + s * (v === "side" ? 0 : v === "front" ? k.W + 8 : k.W - 6);
        const h = 46 - i * 8;
        const a = s * ((v === "front" ? 18 : v === "side" ? 24 : 28) + i * 22);
        return `<g transform="rotate(${a} ${bx} ${by})">` + k.path(shard(bx, by, 6.5 - i * 0.8, h), i ? "#c8eeff" : "#8fd8ff", k.ink, 1.2) +
          k.line(`M${bx} ${by - 3}L${bx} ${by - h + 6}`, "#ffffff", 1.1) + `</g>`;
      }).join("") + k.lume("twinkle", k.path(k.star(x + s * (v === "side" ? 30 : k.W + 22), by - 26, 2.4, 4, 0.3), "#ffffff", "none", 0), s > 0 ? 4 : 3, "#ffffff")).join("");
    }, true);
  },
  // Skysight: a long red scarf streaming out in the wind.
  halcyra(k) {
    const red = "#e0303a";
    const tails = (x: number, y: number, s: number) =>
      k.path(`M${x} ${y}Q${x + s * 14} ${y - 8} ${x + s * 30} ${y - 2}Q${x + s * 38} ${y + 2} ${x + s * 46} ${y - 4}L${x + s * 42} ${y + 4}Q${x + s * 32} ${y + 9} ${x + s * 24} ${y + 5}Q${x + s * 12} ${y + 2} ${x} ${y + 7}Z`, red, k.ink, 1) +
      k.path(`M${x} ${y + 5}Q${x + s * 12} ${y + 6} ${x + s * 24} ${y + 14}L${x + s * 20} ${y + 19}Q${x + s * 10} ${y + 12} ${x} ${y + 11}Z`, "#b8242c", k.ink, 0.9);
    if (k.back) k.put("scarf", tails(k.C + 6, k.T - 2, 1));
    else k.put("body", k.side ? tails(k.C - k.side * 4, k.T - 1, -k.side) : tails(k.C + 8, k.T - 1, 1), true);
  },
  // Solar Flare: its cape ends in tongues of fire.
  sunbara(k) {
    const flames = (x0: number, x1: number, y: number) =>
      Array.from({ length: 5 }, (_, i) => {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / 5,
          h = 12 + (i % 2) * 6;
        return k.path(`M${x - 5} ${y}Q${x - 6} ${y + h * 0.6} ${x} ${y + h}Q${x + 6} ${y + h * 0.6} ${x + 5} ${y}Z`, "#ff6a2a", k.ink, 0.8) +
          k.lume("pulse", k.path(`M${x - 2.4} ${y}Q${x - 3} ${y + h * 0.45} ${x} ${y + h * 0.75}Q${x + 3} ${y + h * 0.45} ${x + 2.4} ${y}Z`, "#ffd84a", "none", 0), 3, "#ffd84a");
      }).join("");
    if (k.back) k.put("scarf", flames(k.C - k.W - 6, k.C + k.W + 6, k.B + 2));
    else k.put("body", k.side ? flames(k.C - k.side * 2 - 14, k.C - k.side * 2 + 14, k.B) : flames(k.C - k.W - 14, k.C - k.W + 6, k.B) + flames(k.C + k.W - 6, k.C + k.W + 14, k.B), true);
  },
  // Moon Blink: the mallet comes off (SkinArt.heldOff in hero-art.ts) and
  // the paw holds a moon staff drawn along the mallet's line
  // (inMalletFrame): a silver shaft bound in blue, a crescent cradle and a
  // full moon with its craters, its rim lit.
  astrabun(k) {
    k.put("armR", inMalletFrame(k, (x) => `<g transform="rotate(6 ${x} 155)">` +
      k.rect(x - 2, 104, 4, 52, 1.6, "#c8d0e6", k.ink, 0.9) +
      k.line(`M${x - 2} 138l4 2M${x - 2} 142l4 2M${x - 2} 146l4 2`, "#3b4f9a", 1) +
      k.path(`M${x - 12} 94Q${x - 10} 108 ${x} 109Q${x + 10} 108 ${x + 12} 94Q${x + 6} 104 ${x} 104Q${x - 6} 104 ${x - 12} 94Z`, "#c8d0e6", k.ink, 0.9) +
      k.circle(x, 88, 13, "#e8ecff", k.ink, 1.2) + k.circle(x - 4.6, 84.6, 3.2, "#c8d0f0", "none", 0) + k.circle(x + 5, 92, 2.4, "#c8d0f0", "none", 0) + k.circle(x + 4, 82, 1.6, "#c8d0f0", "none", 0) +
      k.lume("pulse", `<circle cx="${x}" cy="88" r="11.4" fill="none" stroke="#fff6c9" stroke-width="1.6"/>`, 3, "#fff6c9") + `</g>`));
  },
  // Bulldozer: a giant adjustable spanner slung across its back: a jaw
  // with its worm screw, a hanging hole, a ridged rubber grip and a hazard
  // stripe that glows.
  wombolder(k) {
    slung(k, "#b8bec8", 4.4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.rect(x - 3.4, y + 10, 6.8, 12, 2, "#e0a020", k.ink, 0.9) + k.line(`M${x - 3.4} ${y + 13}h6.8M${x - 3.4} ${y + 16}h6.8M${x - 3.4} ${y + 19}h6.8`, "#8a5a10", 0.8) +
      k.path(`M${x - 5} ${y + 8}L${x - 11} ${y - 5}L${x - 7} ${y - 17}L${x - 2} ${y - 8}H${x + 2}L${x + 6} ${y - 15}L${x + 11} ${y - 5}L${x + 5} ${y + 8}Z`, "#c8ccd6", k.ink, 1.1) +
      k.rect(x - 3.6, y - 4, 7.2, 5, 1.4, "#8a8f9c", k.ink, 0.6) + k.line(`M${x - 2.4} ${y - 4}v5M${x - 0.8} ${y - 4}v5M${x + 0.8} ${y - 4}v5M${x + 2.4} ${y - 4}v5`, "#4a4f5c", 0.5) +
      k.circle(x, y + 4.4, 1.4, "#3a3f4a", k.ink, 0.5) +
      k.lume("pulse", k.rect(x - 2.4, y + 22.4, 4.8, 3, 0.8, "#ffd23f", "none", 0), 3, "#ffd23f") + `</g>`);
  },
  // Inkshade: a katana across its back, its lacquered scabbard banded, a
  // pierced round guard, a diamond-wrapped hilt with a capped pommel and
  // a silk cord, its pommel gem glowing.
  shadopus(k) {
    slung(k, "#1e1e2a", 3, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.line(`M${x} ${y + 12}V${y + 20}`, "#c8323a", 0.9) + k.path(`M${x} ${y + 20}l-2 4h4Z`, "#c8323a", k.ink, 0.4) +
      k.rect(x - 1.8, y + 8, 3.6, 3, 0.6, "#c89048", k.ink, 0.5) +
      `<ellipse cx="${x}" cy="${y + 5.6}" rx="6.4" ry="2" fill="#4a4a5a" stroke="${k.ink}" stroke-width=".8"/>` +
      k.circle(x - 3.4, y + 5.6, 0.7, "#1e1e2a", "none", 0) + k.circle(x + 3.4, y + 5.6, 0.7, "#1e1e2a", "none", 0) +
      k.rect(x - 2.6, y - 16, 5.2, 20.6, 1.4, "#c8323a", k.ink, 0.8) +
      Array.from({ length: 5 }, (_, i) => k.path(`M${x} ${y - 14 + i * 4}l2.2 2l-2.2 2l-2.2 -2Z`, "#1e1e2a", "none", 0)).join("") +
      k.rect(x - 3, y - 19, 6, 3.2, 1, "#c89048", k.ink, 0.6) +
      k.lume("pulse", k.circle(x, y - 20.6, 1.8, "#ff6ad8", k.ink, 0.5), 3, "#ff6ad8") + `</g>`);
  },
  // Leaf Ranger: two great leaves rising off its back like a glider, their
  // veins lit.
  pangrove(k) {
    onBack(k, (x, y, v) => {
      const sides = v === "side" ? [-1] : [-1, 1];
      return sides.map((s) => {
        // From the front each leaf rises beside an arm, clear of the chest.
        const bx = x + s * (v === "side" ? 2 : v === "front" ? k.W + 9 : 6);
        const a = s * (v === "back" ? 38 : v === "front" ? 30 : 50);
        return leafD(bx, y + 4, 46, a) + ` fill="#3f9a45" stroke="${k.ink}" stroke-width="1.2"/>` +
          k.lume("pulse", `<path d="M${bx} ${y + 4}V${y - 38}" transform="rotate(${a} ${bx} ${y + 4})" stroke="#c8ff6a" stroke-width="1.3" fill="none"/>`, s > 0 ? 4 : 3, "#c8ff6a");
      }).join("");
    }, true);
  },
  // Chrono Keeper: a great brass clock on its back: a toothed gear rim, a
  // dial with numerals marked, a pendulum below and hands sweeping in light.
  mossloth(k) {
    const clock = (x: number, y: number, r: number) =>
      k.path(Array.from({ length: 24 }, (_, i) => {
        const a = (i * Math.PI) / 12,
          rr = i % 2 ? r + 3 : r + 5;
        return `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
      }).join("") + "Z", "#a8823a", k.ink, 1) +
      k.circle(x, y, r + 1.4, "#6a5a3a", k.ink, 0.8) + k.circle(x, y, r, "#f7f1e1", k.ink, 0.8) +
      Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6,
          l = i % 3 ? 2 : 3.6;
        return k.line(`M${x + Math.cos(a) * (r - 1)} ${y + Math.sin(a) * (r - 1)}L${x + Math.cos(a) * (r - 1 - l)} ${y + Math.sin(a) * (r - 1 - l)}`, "#3a2a1a", i % 3 ? 0.8 : 1.4);
      }).join("") +
      k.lume("pulse", k.line(`M${x} ${y}V${y - r + 4}M${x} ${y}L${x + r * 0.5} ${y + r * 0.2}`, "#5fe0ff", 1.8), 3, "#5fe0ff") +
      k.circle(x, y, 1.4, "#a8823a", k.ink, 0.5);
    const pendulum = (x: number, y: number) => k.line(`M${x} ${y}v8`, "#a8823a", 1.2) + k.circle(x, y + 10, 2.6, "#c8a050", k.ink, 0.6);
    if (k.back) k.put("scarf", pendulum(k.C, k.T + 30) + clock(k.C, k.T + 14, 15));
    else if (k.side) k.put("body", clock(k.C - k.side * (k.W + 6), k.T + 8, 14), true);
    else k.put("body", clock(k.C + k.W + 14, k.T + 6, 14), true);
  },
};

// ================= Neon Campus =================
const CAMPUS: Details = {
  // Game Club Ace: an RGB gaming backpack, its light strip running round.
  voltkit(k) {
    if (!k.back) {
      const xs = k.side ? [k.C - k.side * 2] : [k.C - 10, k.C + 10];
      k.put("body", xs.map((x, i) => k.line(`M${x} ${k.T}V${k.B - 4}`, k.ink, 4.6) + k.line(`M${x} ${k.T}V${k.B - 4}`, "#2b2f3d", 3) +
        [0, 1, 2].map((j) => k.lume("chase", k.circle(x, k.T + 6 + j * 8, 1.1, ["#ff4fd8", "#59f0ff", "#7dff8a"][j], "none", 0), 3 + j + i, "#59f0ff")).join("")).join(""));
    }
    // From the front its side pockets show beside the body, lit too.
    if (!k.back && !k.side)
      k.put("body", [-1, 1].map((s) => k.rect(k.C + s * (k.W + 12) - 5.5, k.T + 2, 11, 24, 3, "#2b2f3d", k.ink, 1.1) +
        k.lume("chase", k.rect(k.C + s * (k.W + 12) - 1.4, k.T + 6, 2.8, 16, 1.2, s > 0 ? "#59f0ff" : "#ff4fd8", "none", 0), s > 0 ? 7 : 6, s > 0 ? "#59f0ff" : "#ff4fd8")).join(""));
    onBack(k, (x, y, v) => {
      const w = v === "side" ? 9 : v === "front" ? k.W + 6 : 17;
      return k.path(`M${x - 5} ${y - 22}q0 -5 5 -5q5 0 5 5`, "none", "#2b2f3d", 2.2) +
        k.rect(x - w, y - 22, 2 * w, 34, 6, "#2b2f3d", k.ink, 1.1) +
        `<path d="M${x - w + 3} ${y - 19}H${x + w - 3}" stroke="#8a8f9c" stroke-width=".8" stroke-dasharray="1 1"/>` +
        k.rect(x - w + 4, y - 4, 2 * w - 8, 12, 3, "#3d4256", k.ink, 0.8) + k.path(`M${x - w + 4} ${y - 1}H${x + w - 4}`, "none", "#2b2f3d", 1) +
        k.rect(x - 1.6, y - 2, 3.2, 3.4, 0.8, "#c8ccd6", k.ink, 0.4) +
        k.path(`M${x - 3} ${y - 10}l3 -3l3 3l-3 3Z`, "#ff4fd8", k.ink, 0.5) +
        ["#ff4fd8", "#59f0ff", "#7dff8a", "#ffd84a"].map((c, i) => k.lume("chase", k.circle(x - w + 4 + i * ((2 * w - 8) / 3), y - 15, 1.6, c, "none", 0), 3 + i, c)).join("");
    });
  },
  // Lab Prodigy: a round-bottomed flask with a cork and a paper label, its
  // glass ruled with measuring marks and catching a streak of light, the
  // potion inside glowing and bubbling up the neck.
  cindrake(k) {
    held(k, (x, y) =>
      k.path(`M${x - 3.2} ${y - 13}h6.4v8q10.5 4 10.5 14q0 10.5 -13.7 10.5q-13.7 0 -13.7 -10.5q0 -10 10.5 -14Z`, "#e8f8ff", k.ink, 1.1) +
      k.lume("pulse", k.path(`M${x - 11.6} ${y + 4}q0 -3.4 4.6 -5.4h14q4.6 2 4.6 5.4q0 7.6 -11.6 7.6q-11.6 0 -11.6 -7.6Z`, "#7dff8a", "none", 0) +
        k.circle(x - 3, y - 2, 1.5, "#b6ff4f", "none", 0) + k.circle(x + 2, y - 7, 1.1, "#b6ff4f", "none", 0) + k.circle(x + 0.5, y - 11, 0.8, "#b6ff4f", "none", 0) + k.circle(x + 5, y + 4, 1.2, "#d8ffb0", "none", 0), 3, "#7dff8a") +
      k.line(`M${x + 8} ${y - 1}h3M${x + 9.4} ${y + 3}h3M${x + 10} ${y + 7}h3`, "#7aa8c8", 0.7) +
      k.path(`M${x - 8.5} ${y - 1}Q${x - 11} ${y + 4} ${x - 9} ${y + 9}`, "none", "#ffffff", 1.6) +
      k.rect(x - 5, y + 3, 9, 6, 1, "#f7f1e1", k.ink, 0.5) + k.line(`M${x - 3.4} ${y + 5}h6M${x - 3.4} ${y + 7}h4`, "#8a7a5a", 0.5) +
      k.path(`M${x - 4.2} ${y - 18}h8.4l-0.8 5.4h-6.8Z`, "#c8956a", k.ink, 0.7) + k.line(`M${x - 3} ${y - 16.4}h6`, "#9a6a40", 0.6) +
      k.rect(x - 3.6, y - 13.4, 7.2, 2, 0.8, "#c8d8e8", k.ink, 0.5));
  },
  // Swim Team Star: a swim ring round its waist, banded red and white with
  // rope loops, a valve and a shine along its top.
  tidefin(k) {
    const y = k.B - 4,
      rx = k.side ? k.W + 6 : k.W + 10,
      ry = 8;
    const ring = (half: "back" | "front") => {
      const d = half === "front" ? `M${k.C - rx} ${y}A${rx} ${ry} 0 0 0 ${k.C + rx} ${y}` : `M${k.C - rx} ${y}A${rx} ${ry} 0 0 1 ${k.C + rx} ${y}`;
      return k.line(d, k.ink, 9.4) + k.line(d, "#ffffff", 7.4) + `<path d="${d}" fill="none" stroke="#e8343a" stroke-width="7.4" stroke-dasharray="9 9"/>` +
        (half === "front"
          ? `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity=".7" stroke-width="1.4" transform="translate(0 -2.4)"/>` +
            `<path d="${d}" fill="none" stroke="#f7f1e1" stroke-width=".9" stroke-dasharray="1 6" transform="translate(0 3.6)"/>` +
            k.rect(k.C + (k.side ? -k.side * 4 : 6) - 1.4, y + ry - 1.6, 2.8, 2.6, 0.6, "#ffd84a", k.ink, 0.4)
          : "");
    };
    k.put("body", ring("back"), true);
    k.put(k.back ? "scarf" : "body", ring("front"));
  },
  // Council President: the school banner on a staff: a swallowtail flag
  // with a stitched border and fringe, the crest's star lit on a shield,
  // and a gilt finial with a tassel.
  auralynx(k) {
    slung(k, "#8a6a4a", 2.2, (x, y) => {
      const f = k.side ? -k.side : k.back ? -1 : 1;
      return k.path(`M${x} ${y - 2}Q${x + f * 11} ${y - 6} ${x + f * 22} ${y - 2}L${x + f * 18} ${y + 7}L${x + f * 22} ${y + 16}Q${x + f * 12} ${y + 12} ${x} ${y + 16}Z`, "#2f3f8c", k.ink, 1) +
        `<path d="M${x + f * 2} ${y}Q${x + f * 11} ${y - 3.4} ${x + f * 19.5} ${y}L${x + f * 16} ${y + 7}L${x + f * 19.5} ${y + 14}Q${x + f * 12} ${y + 10.4} ${x + f * 2} ${y + 14}Z" fill="none" stroke="#bfe8ff" stroke-width=".6" stroke-dasharray="1.4 1.2"/>` +
        k.line(`M${x} ${y + 12}Q${x + f * 10} ${y + 8} ${x + f * 19} ${y + 12}`, "#c8323a", 2) +
        k.path(`M${x + f * 5} ${y}h${f * 10}v7q0 5 ${-f * 5} 7q${-f * 5} -2 ${-f * 5} -7Z`, "#f7f1e1", k.ink, 0.6) +
        k.lume("pulse", k.path(k.star(x + f * 10, y + 5.4, 3.8, 5), "#ffd84a", k.ink, 0.5), 3, "#ffd84a") +
        k.path(`M${x - 2.4} ${y - 3}L${x} ${y - 9}L${x + 2.4} ${y - 3}Z`, "#e6c46a", k.ink, 0.6) + k.circle(x, y - 3, 1.8, "#e6c46a", k.ink, 0.5) +
        k.line(`M${x + f * 2} ${y - 2}q${f * 2} 4 ${f * 1} 8`, "#c8323a", 1) + k.circle(x + f * 3, y + 6.6, 1.2, "#c8323a", "none", 0);
    });
  },
  // Photo Club Snap: a film camera with a textured leather grip, a lens
  // barrel in three rings with a glass reflection, a shutter button, a
  // strap lug, a viewfinder and a flash that blinks.
  lumoth(k) {
    held(k, (x, y, f) =>
      k.rect(x - 12, y - 8, 24, 16, 3, "#2b2f3d", k.ink, 1) +
      k.rect(x - 12, y - 4, 24, 9, 1, "#4a3a2e", k.ink, 0.6) +
      Array.from({ length: 10 }, (_, i) => k.circle(x - 10 + (i % 5) * 2.2 + (i > 4 ? 1.1 : 0), y - 2 + (i > 4 ? 3 : 0), 0.35, "#2a1e16", "none", 0)).join("") +
      k.rect(x - 8, y - 12, 9, 4.4, 1, "#3d4256", k.ink, 0.8) + k.rect(x - 6.4, y - 11, 4, 2.4, 0.6, "#8ab4d8", "none", 0) +
      k.rect(x + 3.5, y - 10.5, 3.6, 2.6, 0.6, "#c8ccd6", k.ink, 0.5) +
      k.circle(x + f * 2, y + 1, 7.4, "#3d4256", k.ink, 1) + k.circle(x + f * 2, y + 1, 5.6, "#c8ccd6", k.ink, 0.6) +
      k.circle(x + f * 2, y + 1, 4.2, "#2a3a5a", k.ink, 0.6) + k.circle(x + f * 2, y + 1, 2.2, "#4a6a9a", "none", 0) +
      k.path(`M${x + f * 2 - 2.6} ${y - 1.2}q1.4 -1.6 3.4 -1.4`, "none", "#ffffff", 1) +
      k.circle(x - f * 12.4, y - 5, 1.3, "#c8ccd6", k.ink, 0.5) +
      k.lume("blink", k.rect(x + f * 6 - 3, y - 7.4, 6, 3.4, 1, "#ffffff", k.ink, 0.5), 3, "#fff6c9"));
  },
  // Library Prefect: a stack of clothbound books, each with banded spines,
  // gilt titles and cream page edges, a ribbon marker hanging from the top
  // one and a reading lamp's glint on its clasp.
  mystowl(k) {
    held(k, (x, y) => {
      const book = (bx: number, by: number, w: number, c: string, band: string) =>
        k.rect(bx, by, w, 7.5, 1.4, c, k.ink, 0.9) +
        k.rect(bx + w - 4.5, by + 1.2, 3.6, 5.1, 0.6, "#f7f1e1", "#c8b890", 0.5) +
        k.line(`M${bx + w - 4} ${by + 2.4}h2.6M${bx + w - 4} ${by + 3.8}h2.6M${bx + w - 4} ${by + 5.2}h2.6`, "#d8ccb0", 0.4) +
        k.line(`M${bx + 2.6} ${by}V${by + 7.5}M${bx + 5} ${by}V${by + 7.5}`, band, 1) +
        k.line(`M${bx + 7.5} ${by + 3.75}h${w - 14}`, "#f2d27a", 1);
      return book(x - 13, y + 8, 24, "#3a5ab0", "#24387a") + book(x - 11, y + 0.5, 22, "#b8323a", "#7a1c24") + book(x - 12, y - 7, 23, "#2f8a4f", "#1c5a32") +
        k.path(`M${x - 3} ${y - 7}v-1h2.4v6l-1.2 -1.2l-1.2 1.2Z`, "#ffd84a", k.ink, 0.4) +
        k.rect(x + 7.5, y - 5.6, 2.4, 4.4, 0.6, "#f2d27a", k.ink, 0.4) +
        k.lume("twinkle", k.path(k.star(x + 8.7, y - 3.4, 2.4, 4, 0.35), "#fff3c4", "none", 0), 3, "#fff3c4");
    });
  },
  // Team Captain: a basketball, its seams and pebbled grain, a scuffed
  // shine and the captain's star stitched on.
  terradon(k) {
    held(k, (x, y) =>
      k.circle(x, y + 2, 12, "#f07a24", k.ink, 1.2) +
      [[-6, -4], [-2, -7], [3, -6], [7, -2], [-8, 3], [4, 5], [-3, 8], [8, 6], [0, 1]].map(([dx, dy]) => k.circle(x + dx, y + 2 + dy, 0.45, "#b8501a", "none", 0)).join("") +
      k.line(`M${x - 12} ${y + 2}H${x + 12}M${x} ${y - 10}V${y + 14}M${x - 8.5} ${y - 6.5}Q${x - 3} ${y + 2} ${x - 8.5} ${y + 10.5}M${x + 8.5} ${y - 6.5}Q${x + 3} ${y + 2} ${x + 8.5} ${y + 10.5}`, "#3a1a08", 1.2) +
      k.path(`M${x - 8} ${y - 4}Q${x - 6} ${y - 8} ${x - 1} ${y - 9}`, "none", "#ffd8b0", 1.6) +
      k.lume("pulse", k.path(k.star(x + 5, y - 3, 2.6, 5), "#fff3c4", k.ink, 0.4), 3, "#fff3c4"));
  },
  // Drama Club Lead: a velvet cape lined in stage-curtain red, tasselled.
  duskveil(k) {
    const cape = (x0: number, x1: number) =>
      k.path(`M${x0} ${k.T - 2}Q${(x0 + x1) / 2} ${k.T - 6} ${x1} ${k.T - 2}L${x1 + 8} ${k.B + 12}Q${(x0 + x1) / 2} ${k.B + 18} ${x0 - 8} ${k.B + 12}Z`, "#b8202e", k.ink, 1.1) +
      [0, 1, 2, 3, 4].map((i) => k.path(`M${x0 - 6 + i * ((x1 - x0 + 12) / 4)} ${k.B + 12 + Math.sin((i / 4) * Math.PI) * 5}v4`, "none", "#ffd23f", 1.6)).join("");
    if (k.back) k.put("scarf", cape(k.C - k.W - 2, k.C + k.W + 2));
    else k.put("body", k.side ? cape(k.C - k.side * 4 - 12, k.C - k.side * 4 + 12) : cape(k.C - k.W - 6, k.C + k.W + 6), true);
  },
  // Robotics Whiz: a little robot buddy at its side: a riveted body with a
  // control panel, a screen face whose eyes glow, ear bolts, an antenna
  // that blinks and little treads.
  coilemur(k) {
    const bot = (x: number, y: number) =>
      k.rect(x - 8, y + 7, 16, 4, 2, "#3a3f4a", k.ink, 0.8) + [-5, 0, 5].map((d) => k.circle(x + d, y + 9, 1.2, "#8a8f9c", k.ink, 0.4)).join("") +
      k.rect(x - 7, y - 4, 14, 11, 3, "#c8d0dc", k.ink, 1) +
      k.rect(x - 4.6, y - 1.4, 9.2, 5.4, 1, "#3d4256", k.ink, 0.5) + k.circle(x - 2, y + 1.3, 1, "#ff4f5a", "none", 0) + k.circle(x + 1, y + 1.3, 1, "#7dff8a", "none", 0) + k.rect(x + 2.4, y + 0.4, 1.4, 1.8, 0.3, "#ffd84a", "none", 0) +
      [[-6, -3], [6, -3], [-6, 6], [6, 6]].map(([dx, dy]) => k.circle(x + dx, y + dy, 0.5, "#8a8f9c", "none", 0)).join("") +
      k.rect(x - 9, y - 17, 18, 13, 4, "#dfe4ec", k.ink, 1) +
      k.rect(x - 6.4, y - 14.4, 12.8, 8, 2, "#1e2230", k.ink, 0.6) +
      k.lume("pulse", k.rect(x - 4.4, y - 12, 2.6, 3, 1, "#59f0ff", "none", 0) + k.rect(x + 1.8, y - 12, 2.6, 3, 1, "#59f0ff", "none", 0) + k.path(`M${x - 2} ${y - 8}q2 1.4 4 0`, "none", "#59f0ff", 0.7), 3, "#59f0ff") +
      k.circle(x - 9.6, y - 10.5, 1.8, "#8a8f9c", k.ink, 0.5) + k.circle(x + 9.6, y - 10.5, 1.8, "#8a8f9c", k.ink, 0.5) +
      k.line(`M${x} ${y - 17}V${y - 22}`, "#4a4a56", 1) + k.lume("blink", k.circle(x, y - 23, 1.8, "#ff4f5a", k.ink, 0.5), 4, "#ff4f5a");
    if (k.back) k.put("scarf", sc(k.C + k.W + 12, k.T + 22, 1.3, bot(k.C + k.W + 12, k.T + 22)));
    else k.put("body", k.side ? sc(k.C + k.side * (k.W + 2), k.T + 26, 1.3, bot(k.C + k.side * (k.W + 2), k.T + 26)) : sc(k.C - k.W - 12, k.T + 22, 1.3, bot(k.C - k.W - 12, k.T + 22)));
  },
  // Bake Club Chef: a two-tier strawberry cake on a cake stand, cream
  // dripping from each tier, piped rosettes, strawberries with their seeds
  // and leaves, and a striped candle alight on top.
  pyranda(k) {
    held(k, (x, y) => {
      const drips = (x0: number, x1: number, yy: number) =>
        k.path(`M${x0} ${yy}H${x1}V${yy + 2}` + Array.from({ length: 5 }, (_, i) => {
          const xx = x1 - ((i + 0.5) * (x1 - x0)) / 5;
          return `L${xx + 1.4} ${yy + 2}Q${xx} ${yy + 4.5 + (i % 2) * 1.6} ${xx - 1.4} ${yy + 2}`;
        }).join("") + `L${x0} ${yy + 2}Z`, "#fffaf4", k.ink, 0.6);
      const berry = (bx: number, by: number) =>
        k.path(`M${bx} ${by + 3.2}Q${bx - 3} ${by} ${bx - 1.6} ${by - 1.4}Q${bx} ${by - 2.2} ${bx + 1.6} ${by - 1.4}Q${bx + 3} ${by} ${bx} ${by + 3.2}Z`, "#e8343a", k.ink, 0.6) +
        k.path(`M${bx - 1.8} ${by - 1.4}l1 -1.4l0.8 1l0.8 -1l1 1.4Z`, "#4caf50", k.ink, 0.4) +
        k.circle(bx - 0.6, by + 0.4, 0.3, "#ffe0a0", "none", 0) + k.circle(bx + 0.8, by + 1.4, 0.3, "#ffe0a0", "none", 0);
      return (
        k.path(`M${x - 4} ${y + 13}h8l2 4h-12Z`, "#c8ccd6", k.ink, 0.7) +
        `<ellipse cx="${x}" cy="${y + 11}" rx="15" ry="3.6" fill="#e6eaf2" stroke="${k.ink}" stroke-width="1"/>` +
        k.rect(x - 12, y - 1, 24, 11, 3, "#ffc8dc", k.ink, 1) + k.line(`M${x - 12} ${y + 5}H${x + 12}`, "#ff6fae", 2) + drips(x - 12, x + 12, y - 1) +
        k.rect(x - 8, y - 10, 16, 9, 3, "#fff6f0", k.ink, 1) + drips(x - 8, x + 8, y - 10) +
        [-9, -4.5, 0, 4.5, 9].map((dx) => k.circle(x + dx, y + 9.4, 1.2, "#fffaf4", k.ink, 0.4)).join("") +
        berry(x - 4, y - 12) + berry(x + 4, y - 12) + berry(x - 9, y - 3) + berry(x + 9, y - 3) +
        k.rect(x - 1, y - 19, 2, 7, 0.6, "#7ad0ff", k.ink, 0.5) + k.line(`M${x - 1} ${y - 17}l2 -1M${x - 1} ${y - 14.6}l2 -1`, "#ffffff", 0.6) +
        k.lume("pulse", k.path(`M${x} ${y - 25}q2.6 3.2 0 5.4q-2.6 -2.2 0 -5.4Z`, "#ffc94a", "#ff8a3a", 0.4), 3, "#ffc94a")
      );
    });
  },
  // Choir Soloist: its robe flares into a bell, a stole down the front and
  // notes that twinkle on the hem.
  glacelle(k) {
    const w = k.side ? k.W + 4 : k.W + 10;
    // Kept within the body's crop: the bell flares out more than down.
    const y = k.B - 6;
    const bell = k.path(`M${k.C - k.W + 2} ${y - 12}L${k.C - w} ${y + 6}Q${k.C} ${y + 11} ${k.C + w} ${y + 6}L${k.C + k.W - 2} ${y - 12}Z`, "#2a3a7a", k.ink, 1.1) +
      k.line(`M${k.C - w + 2} ${y + 3}Q${k.C} ${y + 8} ${k.C + w - 2} ${y + 3}`, "#ffffff", 1.4) +
      [0, 1, 2].map((i) => k.lume("twinkle", k.path(`M${k.C - w * 0.5 + i * w * 0.5} ${y}v-6l3 1.4v1.6l-3 -1.4`, "none", "#ffffff", 1) + k.circle(k.C - w * 0.5 + i * w * 0.5 - 1.4, y, 1.6, "#ffffff", "none", 0), 3 + i, "#c8e6ff")).join("");
    k.put(k.back ? "scarf" : "body", bell);
  },
  // Archery Ace: a longbow slung across its back.
  halcyra(k) {
    const s = k.side ? -k.side : 1;
    const draw = (x: number, y: number, len: number) =>
      k.path(`M${x} ${y - len}Q${x + s * len * 0.5} ${y} ${x} ${y + len}`, "none", k.ink, 4.2) + k.path(`M${x} ${y - len}Q${x + s * len * 0.5} ${y} ${x} ${y + len}`, "none", "#a8723a", 2.6) +
      k.line(`M${x} ${y - len}L${x} ${y + len}`, "#f7f1e1", 0.8) + k.rect(x + s * len * 0.25 - 2.4, y - 5, 4.8, 10, 1.2, "#3a5ab0", k.ink, 0.6) +
      k.line(`M${x + s * len * 0.25 - 2.4} ${y - 2.6}l4.8 1.4M${x + s * len * 0.25 - 2.4} ${y}l4.8 1.4M${x + s * len * 0.25 - 2.4} ${y + 2.4}l4.8 1.4`, "#24387a", 0.6) +
      k.path(`M${x + s * len * 0.27} ${y - 6}l${s * 3} -1l0 2Z`, "#c8ccd6", k.ink, 0.4) +
      k.path(`M${x + s * len * 0.12} ${y - len * 0.55}q${s * 1.6} 1 ${s * 1.4} 3`, "none", "#d8a868", 0.8) + k.path(`M${x + s * len * 0.12} ${y + len * 0.55}q${s * 1.6} -1 ${s * 1.4} -3`, "none", "#d8a868", 0.8) +
      k.lume("pulse", k.circle(x, y - len, 1.6, "#7dff8a", "none", 0) + k.circle(x, y + len, 1.6, "#7dff8a", "none", 0), 3, "#7dff8a");
    if (k.back) k.put("scarf", `<g transform="rotate(${-s * 28} ${k.C} ${k.T + 12})">${draw(k.C, k.T + 12, 34)}</g>`);
    else k.put("body", `<g transform="rotate(${s * 28} ${k.C} ${k.T + 6})">${draw(k.C + s * (k.side ? 6 : 10), k.T + 4, 38)}</g>`, true);
  },
  // Art Club Painter: a wooden palette with its thumb hole and grain, six
  // blobs of paint (the glow-in-the-dark ones lit) and a brush with a
  // metal ferrule and a loaded tip.
  sunbara(k) {
    held(k, (x, y, f) =>
      k.path(`M${x - 15} ${y + 2}Q${x - 17} ${y - 13} ${x} ${y - 13}Q${x + 17} ${y - 13} ${x + 16} ${y + 2}Q${x + 15} ${y + 13} ${x} ${y + 11}Q${x - 4} ${y + 3} ${x - 9} ${y + 9}Q${x - 15} ${y + 11} ${x - 15} ${y + 2}Z`, "#e6c08a", k.ink, 1.1) +
      k.line(`M${x - 10} ${y - 8}Q${x} ${y - 11} ${x + 10} ${y - 8}M${x - 6} ${y - 4}Q${x + 2} ${y - 6} ${x + 12} ${y - 2}`, "#c89a5a", 0.6) +
      `<ellipse cx="${x - 3}" cy="${y + 4}" rx="3" ry="2.4" fill="#1b2238" stroke="${k.ink}" stroke-width=".8"/>` +
      [["#ff4f6a", -9, -6], ["#59f0ff", -3, -8], ["#ffd84a", 3, -8], ["#7dff8a", 9, -5], ["#b48aff", 11, 1], ["#ffffff", 6, 5]].map(([c, dx, dy], i) => {
        const blob = k.path(`M${x + +dx - 2.6} ${y + +dy}q0 -2.6 2.6 -2.6q2.8 0 2.6 2.4q0 2.6 -2.8 2.4q-2.4 0 -2.4 -2.2Z`, c as string, k.ink, 0.5) + k.circle(x + +dx - 0.8, y + +dy - 1, 0.6, "#ffffff", "none", 0);
        return i < 4 ? k.lume("twinkle", blob, 3 + i, c as string) : blob;
      }).join("") +
      k.line(`M${x + f * 2} ${y + 8}L${x + f * 16} ${y - 15}`, k.ink, 3) + k.line(`M${x + f * 2} ${y + 8}L${x + f * 16} ${y - 15}`, "#8a5a2a", 1.8) +
      k.path(`M${x + f * 14.4} ${y - 12.4}l${f * 3.6} 2.2l${f * 1} -1.6l${-f * 3.6} -2.2Z`, "#c8ccd6", k.ink, 0.5) +
      k.path(`M${x + f * 15.6} ${y - 14.6}q${f * 1} -4 ${f * 4} -5q${f * 0.4} 3.4 ${-f * 2} 6.4Z`, "#ff4f6a", k.ink, 0.5));
  },
  // Stargazer: the mallet comes off (SkinArt.heldOff in campus-art.ts) and
  // the paw holds a brass telescope in its place, drawn along the mallet's
  // own line (inMalletFrame) so it turns with the paw and points at the sky
  // in every view: an eyepiece at the paw, a focuser, a navy tube banded in
  // brass with a little finder scope, a dew shield and a lens that glints.
  astrabun(k) {
    const brass = "#c89048",
      navy = "#2a3a7a";
    k.put("armR", inMalletFrame(k, (x) => `<g transform="rotate(6 ${x} 155)">` +
      k.rect(x - 2.2, 140, 4.4, 13, 1, "#3a3f4a", k.ink, 0.8) +
      k.rect(x - 4, 130, 8, 10, 1.4, brass, k.ink, 0.9) + k.line(`M${x + 4} 133h2.4v4h-2.4`, "#8a5a2a", 1) +
      k.path(`M${x - 5} 131L${x - 8} 88H${x + 8}L${x + 5} 131Z`, navy, k.ink, 1.1) +
      k.rect(x - 6.6, 116, 13.2, 3, 1, brass, k.ink, 0.6) + k.rect(x - 7.6, 98, 15.2, 3, 1, brass, k.ink, 0.6) +
      k.line(`M${x - 5.4} 126L${x - 7.2} 92`, "#5a6aa8", 1.2) +
      k.rect(x + 8, 104, 4, 12, 1.2, "#3a3f4a", k.ink, 0.6) + k.line(`M${x + 6} 108h2M${x + 6} 113h2`, brass, 1) + k.circle(x + 10, 104, 1.6, "#9fd8ff", k.ink, 0.4) +
      k.rect(x - 9.6, 76, 19.2, 13, 2, brass, k.ink, 1) + k.line(`M${x - 9.6} 80h19.2`, "#8a5a2a", 0.8) +
      `<ellipse cx="${x}" cy="76" rx="9" ry="2.8" fill="#24305e" stroke="${k.ink}" stroke-width=".9"/>` +
      `<ellipse cx="${x - 2.4}" cy="75.6" rx="3" ry="1" fill="#9fd8ff" opacity=".8"/>` +
      k.lume("twinkle", k.path(k.star(x + 3, 73.6, 3.2, 4, 0.3), "#ffffff", "none", 0), 3, "#bfe8ff") + `</g>`));
  },
  // Garden Club Keeper: a tin watering can, its rim and base banded and
  // riveted, a leaf label, a filler cap, an arched handle with a grip, a
  // braced spout ending in a rose pierced with holes, and a spray of drops
  // catching the light.
  wombolder(k) {
    held(k, (x, y, f) => {
      const tin = "#3fa05a",
        band = "#2a7040",
        rose = x + f * 22;
      return (
        // The arched handle behind the body, with a wrapped grip.
        k.path(`M${x - f * 8} ${y - 6}Q${x - f * 2} ${y - 22} ${x + f * 8} ${y - 8}`, "none", k.ink, 4.4) +
        k.path(`M${x - f * 8} ${y - 6}Q${x - f * 2} ${y - 22} ${x + f * 8} ${y - 8}`, "none", band, 2.8) +
        k.line(`M${x - f * 4} ${y - 15}l${f * 2} -1.6M${x - f * 1} ${y - 16.4}l${f * 2} -0.6M${x + f * 2} ${y - 16.2}l${f * 2} 0.6`, "#9fd8a8", 0.9) +
        // The spout and its brace.
        k.path(`M${x + f * 7} ${y + 4}L${x + f * 20} ${y - 7}L${x + f * 22} ${y - 5}L${x + f * 9} ${y + 8}Z`, tin, k.ink, 0.9) +
        k.line(`M${x + f * 8} ${y - 2}L${x + f * 13} ${y + 1}`, band, 1.2) +
        // The rose: a flared head with its holes.
        k.path(`M${rose - f * 2} ${y - 9}L${rose + f * 4} ${y - 13}L${rose + f * 7} ${y - 5}L${rose + f * 1} ${y - 3}Z`, "#c8ccd6", k.ink, 0.9) +
        [[3.2, -10.4], [4.6, -8.2], [5.6, -6.2], [2.4, -7.6], [3.6, -5.6]].map(([dx, dy]) => k.circle(rose + f * dx, y + dy, 0.55, "#4a4f5c", "none", 0)).join("") +
        // The can: tapered tin with banded, riveted rim and base.
        k.path(`M${x - 10} ${y - 8}H${x + 10}L${x + 9} ${y + 11}H${x - 9}Z`, tin, k.ink, 1.1) +
        k.rect(x - 10.6, y - 9.5, 21.2, 3.6, 1, band, k.ink, 0.8) +
        k.rect(x - 9.6, y + 8.4, 19.2, 3.4, 1, band, k.ink, 0.8) +
        [-7, -2.4, 2.4, 7].map((dx) => k.circle(x + dx, y - 7.7, 0.55, "#c8ccd6", "none", 0) + k.circle(x + dx * 0.92, y + 10.1, 0.55, "#c8ccd6", "none", 0)).join("") +
        // A leaf label and the filler cap.
        k.rect(x - 5.5, y - 2.5, 11, 8, 1.5, "#f7f1e1", k.ink, 0.6) +
        k.path(`M${x - 2.6} ${y + 3.6}Q${x - 2.6} ${y - 1} ${x + 2.6} ${y - 1.4}Q${x + 2.4} ${y + 3.4} ${x - 2.6} ${y + 3.6}Z`, "#5fbf6a", k.ink, 0.5) +
        k.line(`M${x - 2.4} ${y + 3.4}L${x + 1.6} ${y - 0.4}`, "#2a7040", 0.6) +
        `<ellipse cx="${x - f * 3}" cy="${y - 9.6}" rx="4" ry="1.6" fill="#1e3a28" stroke="${k.ink}" stroke-width=".7"/>` +
        // The spray: drops falling from the rose.
        k.lume("twinkle", [[9, -2, 1.5], [12, 3, 1.3], [8, 6, 1.1], [14, -6, 1.2]].map(([dx, dy, r]) => k.path(`M${rose + f * dx} ${y + dy - r * 1.6}q${r} ${r * 1.4} 0 ${r * 2.4}q${-r} ${-r} 0 ${-r * 2.4}Z`, "#9fe8ff", k.ink, 0.4)).join(""), 3, "#9fe8ff")
      );
    });
  },
  // Mystery Club Sleuth: a giant magnifying glass, its brass rim bevelled
  // and screwed to a turned wooden handle with brass bands, the lens
  // reflecting a window of light.
  shadopus(k) {
    slung(k, "#6a4424", 3, (x, y) =>
      k.rect(x - 2.4, y + 1, 4.8, 5, 1, "#c89048", k.ink, 0.6) +
      k.circle(x, y - 7, 12, "#c89048", k.ink, 1.2) + k.circle(x, y - 7, 10.4, "none", "#8a5a2a", 0.8) +
      k.circle(x, y - 7, 9, "#bfe8ff88", k.ink, 0.8) +
      k.path(`M${x - 6} ${y - 9}q2 -5 7 -6`, "none", "#ffffff", 1.6) + k.path(`M${x + 4} ${y - 1}q2 -1 3 -3`, "none", "#ffffff", 1) +
      k.circle(x + 11.4, y - 7, 0.8, "#8a5a2a", "none", 0) + k.circle(x - 11.4, y - 7, 0.8, "#8a5a2a", "none", 0) +
      k.lume("twinkle", k.path(k.star(x - 3, y - 10, 3, 4, 0.3), "#ffffff", "none", 0), 3, "#ffffff"));
  },
  // Band Drummer: a pair of drumsticks crossed on its back, tips lit.
  pangrove(k) {
    onBack(k, (x, y, v) => {
      const w = v === "side" ? 12 : v === "front" ? k.W + 24 : k.W + 6;
      return [-1, 1].map((s) => {
        const x0 = x - s * w * 0.6, y0 = y + 10, x1 = x + s * w, y1 = y - 34;
        const at = (t: number) => `${x0 + (x1 - x0) * t} ${y0 + (y1 - y0) * t}`;
        return k.line(`M${x0} ${y0}L${x1} ${y1}`, k.ink, 4.2) + k.line(`M${x0} ${y0}L${x1} ${y1}`, "#e6c08a", 2.6) +
          k.line(`M${at(0.35)}L${at(0.9)}`, "#f7e0b0", 0.6) +
          k.line(`M${at(0)}L${at(0.22)}`, "#c8323a", 3) +
          k.circle(x1, y1 - 1, 3.4, "#ffffff", k.ink, 0.8) + k.circle(x1 - 1, y1 - 2, 1, "#ffffff", "none", 0);
      }).join("") +
        k.lume("pulse", k.circle(x + w, y - 35, 1.6, "#ffd84a", "none", 0) + k.circle(x - w, y - 35, 1.6, "#ffd84a", "none", 0), 3, "#ffd84a");
    });
  },
  // Nap Club Captain: a plump striped pillow, its seams stitched, a tassel
  // at each corner, a crescent-and-star print and a little tag.
  mossloth(k) {
    held(k, (x, y) =>
      k.path(`M${x - 13} ${y - 10}Q${x} ${y - 14} ${x + 13} ${y - 10}Q${x + 17} ${y + 2} ${x + 13} ${y + 14}Q${x} ${y + 18} ${x - 13} ${y + 14}Q${x - 17} ${y + 2} ${x - 13} ${y - 10}Z`, "#cfe0ff", k.ink, 1.1) +
      k.line(`M${x - 14} ${y - 3}Q${x} ${y - 5} ${x + 15} ${y - 3}M${x - 15} ${y + 6}Q${x} ${y + 4} ${x + 15} ${y + 6}`, "#8aa8e8", 2) +
      `<path d="M${x - 11} ${y - 8}Q${x} ${y - 11} ${x + 11} ${y - 8}Q${x + 14} ${y + 2} ${x + 11} ${y + 12}Q${x} ${y + 15} ${x - 11} ${y + 12}Q${x - 14} ${y + 2} ${x - 11} ${y - 8}Z" fill="none" stroke="#6a88c8" stroke-width=".7" stroke-dasharray="1.6 1.3"/>` +
      [[-13, -10], [13, -10], [13, 14], [-13, 14]].map(([dx, dy]) => k.path(`M${x + dx} ${y + dy}l${dx > 0 ? 2 : -2} ${dy > 0 ? 2 : -2}l${dx > 0 ? 1.6 : -1.6} ${dy > 0 ? 3.2 : -3.2}l${dx > 0 ? -2.6 : 2.6} ${dy > 0 ? -1 : 1}Z`, "#ffd84a", k.ink, 0.5)).join("") +
      k.path(`M${x - 4} ${y - 2}A5 5 0 1 0 ${x + 1} ${y + 6}A4 4 0 1 1 ${x - 4} ${y - 2}Z`, "#fff3a8", k.ink, 0.5) +
      k.rect(x + 8, y + 9, 4, 3, 0.6, "#ffffff", k.ink, 0.4) +
      k.lume("twinkle", k.path(k.star(x + 5, y + 1, 3, 5), "#fff3a8", k.ink, 0.4), 3, "#fff3a8"));
  },
};

/** The props by collection, for the tests. */
export const EPIC_PROPS = { hero: HERO, campus: CAMPUS } as const;

/**
 * The props' finish: every solid shape takes light at its top left and
 * shade at its bottom right (a gradient over its own outline), so a prop
 * reads as a rounded, solid object rather than flat cut paper. Lit pieces
 * (lume) and see-through glass are left as they are.
 */
// Each finished piece carries its own copy, as every part is cut into its
// own texture and a drawing defines each id once. The id is a hash of the
// piece, so the same art always draws the same SVG.
const hash = (t: string) => {
  let h = 2166136261;
  for (let i = 0; i < t.length; i++) h = Math.imul(h ^ t.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
};
const propShade = (id: string) =>
  `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">` +
  `<stop offset="0" stop-color="#ffffff" stop-opacity=".42"/><stop offset=".38" stop-color="#ffffff" stop-opacity="0"/>` +
  `<stop offset=".6" stop-color="#000000" stop-opacity="0"/><stop offset="1" stop-color="#000000" stop-opacity=".34"/></linearGradient></defs>`;
const SHAPE = /^<(path|rect|circle|ellipse)\b[^>]*\bfill="(#[0-9a-fA-F]{6}|#[0-9a-fA-F]{3})"[^>]*\/>$/;
export function shadeProp(svg: string) {
  const id = `epic-prop-shade-${hash(svg)}`;
  let out = "",
    lume = 0,
    shaded = false;
  // Walk the tags, keeping track of whether we are inside a lume group.
  const depth: boolean[] = [];
  for (const tok of svg.split(/(?=<)|(?<=>)/)) {
    if (tok.startsWith("<g")) {
      const lit = /class="lume"/.test(tok);
      depth.push(lit);
      if (lit) lume++;
    } else if (tok.startsWith("</g")) {
      if (depth.pop()) lume--;
    }
    out += tok;
    if (lume || !SHAPE.test(tok)) continue;
    // Skip specks: they are dots of colour, not objects.
    const r = Number(tok.match(/\br="([\d.]+)"/)?.[1] ?? 99),
      w = Number(tok.match(/\bwidth="([\d.]+)"/)?.[1] ?? 99),
      h = Number(tok.match(/\bheight="([\d.]+)"/)?.[1] ?? 99);
    if (r < 2.5 || w < 3 || h < 3) continue;
    out += tok.replace(/\bfill="[^"]*"/, `fill="url(#${id})"`).replace(/\bstroke="[^"]*"/, 'stroke="none"');
    shaded = true;
  }
  return shaded ? propShade(id) + out : out;
}
/** Each prop draws through a kit whose pieces come out finished. */
const finished = (table: Details): Details =>
  Object.fromEntries(Object.entries(table).map(([id, fn]) => [id, (k: Kit) => fn!({ ...k, put: (part, svg, under) => k.put(part, shadeProp(svg), under) })]));
addDetails("hero", finished(HERO));
addDetails("campus", finished(CAMPUS));

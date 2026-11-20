import { addDetails, malletHead, type Details } from "./legend-details";
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
  // Blaze Breaker: a molten greatsword across its back, its edge glowing.
  cindrake(k) {
    slung(k, "#2e2a34", 3.4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.rect(x - 8, y + 2, 16, 4, 1.5, "#4a4452", k.ink, 0.9) +
      k.path(`M${x - 4.5} ${y + 2}V${y - 20}L${x} ${y - 28}L${x + 4.5} ${y - 20}V${y + 2}Z`, "#3a3440", k.ink, 1) +
      k.lume("pulse", k.path(`M${x - 2.6} ${y}V${y - 19}L${x} ${y - 24}L${x + 2.6} ${y - 19}V${y}Z`, "#ff8a3a", "none", 0), 3, "#ff8a3a") + `</g>`);
  },
  // Tide Guardian: a golden trident across its back, its prongs lit.
  tidefin(k) {
    slung(k, "#e8b84a", 2.4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.path(`M${x - 9} ${y - 2}Q${x} ${y + 6} ${x + 9} ${y - 2}L${x + 9} ${y - 14}L${x + 6} ${y - 6}Q${x} ${y} ${x - 6} ${y - 6}L${x - 9} ${y - 14}Z`, "#e8b84a", k.ink, 0.9) +
      k.path(`M${x - 2} ${y + 1}L${x} ${y - 18}L${x + 2} ${y + 1}Z`, "#e8b84a", k.ink, 0.9) +
      k.lume("pulse", k.circle(x - 9, y - 14, 1.6, "#bff6ff", "none", 0) + k.circle(x, y - 18, 1.8, "#bff6ff", "none", 0) + k.circle(x + 9, y - 14, 1.6, "#bff6ff", "none", 0), 3, "#7ff0ff") + `</g>`);
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
  // Third Eye: a seer's staff crowned with a crescent and a star.
  mystowl(k) {
    slung(k, "#3a3070", 2.4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.path(`M${x + 5} ${y - 22}A11 11 0 1 0 ${x + 5} ${y}A8.5 8.5 0 1 1 ${x + 5} ${y - 22}Z`, "#b9a8ff", k.ink, 1) +
      k.lume("pulse", k.path(k.star(x + 1, y - 11, 5, 5), "#ffffff", k.ink, 0.6), 3, "#c8b8ff") + `</g>`, true);
  },
  // Iron Bulwark: a stone tower shield, lava glowing in its cracks.
  terradon(k) {
    held(k, (x, y) => {
      const d = `M${x - 13} ${y - 16}H${x + 13}V${y + 2}Q${x + 13} ${y + 16} ${x} ${y + 22}Q${x - 13} ${y + 16} ${x - 13} ${y + 2}Z`;
      return k.path(d, "#6a6670", k.ink, 1.3) + k.path(`M${x - 9} ${y - 12}H${x + 9}V${y + 1}Q${x + 9} ${y + 12} ${x} ${y + 17}Q${x - 9} ${y + 12} ${x - 9} ${y + 1}Z`, "#57535c", "#45414a", 0.8) +
        k.lume("pulse", k.line(`M${x - 6} ${y - 10}L${x - 1} ${y - 2}L${x + 5} ${y - 6}M${x - 1} ${y - 2}L${x + 1} ${y + 8}L${x - 4} ${y + 13}`, "#ff8a3a", 1.6), 3, "#ff8a3a");
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
        return [-1, 1].map((s) => k.rect(x + s * w - 4.5, top, 9, 30, 2, "#e0303a", k.ink, 1.1) + k.rect(x + s * w - 4.5, top - 8, 9, 9, 0, "#dfe4ec", k.ink, 1)).join("") +
          k.lume("blink", k.line(`M${x - w} ${top - 10}l3 -5l-2 0l3 -5M${x + w} ${top - 10}l-3 -5l2 0l-3 -5`, "#fff7a8", 1.3), 3, "#fff7a8");
      }
      const w = v === "side" ? 10 : k.W + 4,
        top = y - 34;
      return k.path(`M${x - w} ${top}V${y - 4}Q${x - w} ${y + 14} ${x} ${y + 14}Q${x + w} ${y + 14} ${x + w} ${y - 4}V${top}H${x + w - 9}V${y - 4}Q${x + w - 9} ${y + 5} ${x} ${y + 5}Q${x - w + 9} ${y + 5} ${x - w + 9} ${y - 4}V${top}Z`, "#e0303a", k.ink, 1.1) +
        k.rect(x - w, top - 8, 9, 9, 0, "#dfe4ec", k.ink, 1) + k.rect(x + w - 9, top - 8, 9, 9, 0, "#dfe4ec", k.ink, 1) +
        k.lume("blink", k.line(`M${x - w + 4} ${top - 10}l3 -5l-2 0l3 -5M${x + w - 4} ${top - 10}l-3 -5l2 0l-3 -5`, "#fff7a8", 1.3), 3, "#fff7a8");
    });
  },
  // Chestnut Comet: twin chestnut boosters, their nozzles burning.
  pyranda(k) {
    onBack(k, (x, y, v) => {
      const xs = v === "side" ? [x] : v === "front" ? [x - k.W - 8, x + k.W + 8] : [x - k.W + 2, x + k.W - 2];
      return xs.map((bx, i) =>
        k.rect(bx - 6, y - 26, 12, 30, 5, "#8a4a2a", k.ink, 1.1) + k.line(`M${bx - 6} ${y - 16}H${bx + 6}M${bx - 6} ${y - 6}H${bx + 6}`, "#c8ccd6", 1.6) +
        k.path(`M${bx - 4} ${y + 4}H${bx + 4}L${bx + 6} ${y + 9}H${bx - 6}Z`, "#4a4a56", k.ink, 0.8) +
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
  // Moon Blink: its mallet head becomes a full moon, its craters lit.
  astrabun(k) {
    const { x, y } = malletHead(k);
    k.put("armR", k.circle(x, y, 17, "#e8ecff", k.ink, 1.2) + k.circle(x - 6, y - 4, 4, "#c8d0f0", "none", 0) + k.circle(x + 6, y + 5, 3, "#c8d0f0", "none", 0) + k.circle(x + 5, y - 7, 2, "#c8d0f0", "none", 0) +
      k.lume("pulse", `<circle cx="${x}" cy="${y}" r="15" fill="none" stroke="#fff6c9" stroke-width="1.6"/>`, 3, "#fff6c9"));
  },
  // Bulldozer: a giant spanner slung across its back.
  wombolder(k) {
    slung(k, "#b8bec8", 4, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.path(`M${x - 4} ${y + 6}L${x - 10} ${y - 6}L${x - 6} ${y - 16}L${x - 2} ${y - 8}H${x + 2}L${x + 6} ${y - 16}L${x + 10} ${y - 6}L${x + 4} ${y + 6}Z`, "#c8ccd6", k.ink, 1) +
      k.lume("pulse", k.rect(x - 2, y + 8, 4, 8, 1, "#ffd23f", "none", 0), 3, "#ffd23f") + `</g>`);
  },
  // Inkshade: a katana across its back, its wrapped hilt over a shoulder.
  shadopus(k) {
    slung(k, "#1e1e2a", 3, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.path(`M${x - 6} ${y + 4}H${x + 6}V${y + 7}H${x - 6}Z`, "#4a4a5a", k.ink, 0.8) +
      k.rect(x - 2.4, y - 16, 4.8, 20, 1.2, "#c8323a", k.ink, 0.8) +
      k.line(`M${x - 2.4} ${y - 12}l4.8 3M${x - 2.4} ${y - 6}l4.8 3M${x - 2.4} ${y}l4.8 3`, "#1e1e2a", 0.9) +
      k.lume("pulse", k.circle(x, y - 18, 2, "#ff6ad8", k.ink, 0.6), 3, "#ff6ad8") + `</g>`);
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
  // Chrono Keeper: a great clock on its back, its hands sweeping in light.
  mossloth(k) {
    const clock = (x: number, y: number, r: number) =>
      k.circle(x, y, r + 3, "#6a5a3a", k.ink, 1.1) + k.circle(x, y, r, "#f7f1e1", k.ink, 0.8) +
      [0, 1, 2, 3].map((i) => {
        const a = (i * Math.PI) / 2;
        return k.line(`M${x + Math.cos(a) * (r - 1)} ${y + Math.sin(a) * (r - 1)}L${x + Math.cos(a) * (r - 4)} ${y + Math.sin(a) * (r - 4)}`, "#3a2a1a", 1.4);
      }).join("") +
      k.lume("pulse", k.line(`M${x} ${y}V${y - r + 4}M${x} ${y}L${x + r * 0.5} ${y + r * 0.2}`, "#5fe0ff", 1.8), 3, "#5fe0ff");
    if (k.back) k.put("scarf", clock(k.C, k.T + 14, 15));
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
      return k.rect(x - w, y - 22, 2 * w, 34, 6, "#2b2f3d", k.ink, 1.1) + k.rect(x - w + 4, y - 4, 2 * w - 8, 12, 3, "#3d4256", k.ink, 0.8) +
        ["#ff4fd8", "#59f0ff", "#7dff8a", "#ffd84a"].map((c, i) => k.lume("chase", k.circle(x - w + 4 + i * ((2 * w - 8) / 3), y - 15, 1.6, c, "none", 0), 3 + i, c)).join("");
    });
  },
  // Lab Prodigy: a great round flask, bubbling green.
  cindrake(k) {
    held(k, (x, y) =>
      k.path(`M${x - 3} ${y - 14}h6v8q10 4 10 14q0 10 -13 10q-13 0 -13 -10q0 -10 10 -14Z`, "#e8f8ff", k.ink, 1.1) +
      k.lume("pulse", k.path(`M${x - 11} ${y + 4}q0 -3 4 -5h14q4 2 4 5q0 7 -11 7q-11 0 -11 -7Z`, "#7dff8a", "none", 0) + k.circle(x - 2, y - 3, 1.4, "#b6ff4f", "none", 0) + k.circle(x + 3, y - 8, 1, "#b6ff4f", "none", 0), 3, "#7dff8a") +
      k.rect(x - 4, y - 17, 8, 3, 1, "#c8a06a", k.ink, 0.6));
  },
  // Swim Team Star: a striped swim ring round its waist.
  tidefin(k) {
    const y = k.B - 4,
      rx = k.side ? k.W + 6 : k.W + 10,
      ry = 8;
    const ring = (half: "back" | "front") => {
      const d = half === "front" ? `M${k.C - rx} ${y}A${rx} ${ry} 0 0 0 ${k.C + rx} ${y}` : `M${k.C - rx} ${y}A${rx} ${ry} 0 0 1 ${k.C + rx} ${y}`;
      return k.line(d, k.ink, 9.4) + k.line(d, "#ffffff", 7.4) + `<path d="${d}" fill="none" stroke="#e8343a" stroke-width="7.4" stroke-dasharray="9 9"/>` + (half === "front" ? `<path d="${d}" fill="none" stroke="#ffffff" stroke-opacity=".6" stroke-width="1.4" transform="translate(0 -2)"/>` : "");
    };
    k.put("body", ring("back"), true);
    k.put(k.back ? "scarf" : "body", ring("front"));
  },
  // Council President: the school banner on its staff, its crest lit.
  auralynx(k) {
    slung(k, "#8a6a4a", 2.2, (x, y) => {
      const f = k.side ? -k.side : k.back ? -1 : 1;
      return k.path(`M${x} ${y - 2}Q${x + f * 12} ${y - 6} ${x + f * 24} ${y - 2}V${y + 16}Q${x + f * 12} ${y + 12} ${x} ${y + 16}Z`, "#2f3f8c", k.ink, 1) +
        k.line(`M${x} ${y + 12}Q${x + f * 12} ${y + 8} ${x + f * 24} ${y + 12}`, "#c8323a", 2) +
        k.lume("pulse", k.path(k.star(x + f * 12, y + 4, 4.5, 5), "#ffffff", k.ink, 0.5), 3, "#bfe8ff") + k.circle(x, y - 3, 2.2, "#dfe4ec", k.ink, 0.6);
    });
  },
  // Photo Club Snap: a big camera with a long lens, its flash blinking.
  lumoth(k) {
    held(k, (x, y, f) =>
      k.rect(x - 11, y - 8, 22, 15, 3, "#2b2f3d", k.ink, 1) + k.rect(x - 7, y - 11, 8, 4, 1, "#2b2f3d", k.ink, 0.8) +
      k.rect(x + f * 6 - 5, y - 4, 10, 12, 2, "#3d4256", k.ink, 0.8) + k.circle(x + f * 6, y + 9, 4.5, "#6a8aa8", k.ink, 0.9) +
      k.circle(x - f * 4, y - 1, 4.5, "#4a5a70", k.ink, 0.9) + k.circle(x - f * 5, y - 2, 1.4, "#ffffff", "none", 0) +
      k.lume("blink", k.rect(x + 4, y - 11, 5, 3, 1, "#ffffff", k.ink, 0.5), 3, "#fff6c9"));
  },
  // Library Prefect: a tall stack of books held at its side.
  mystowl(k) {
    held(k, (x, y) =>
      [["#3a5ab0", 0], ["#c8323a", 7], ["#2f8a4f", 14]].map(([c, dy], i) =>
        k.rect(x - 12 + (i % 2) * 2, y + 8 - (dy as number), 22, 7, 1, c as string, k.ink, 0.9) + k.line(`M${x - 10 + (i % 2) * 2} ${y + 11.5 - (dy as number)}H${x + 8 + (i % 2) * 2}`, "#f7f1e1", 1)).join("") +
      k.lume("twinkle", k.path(k.star(x + 4, y - 9, 2.4, 4, 0.35), "#fff3c4", "none", 0), 3, "#fff3c4"));
  },
  // Team Captain: the game ball held at its side.
  terradon(k) {
    held(k, (x, y) =>
      k.circle(x, y + 2, 12, "#ff8a2a", k.ink, 1.2) + k.line(`M${x - 12} ${y + 2}H${x + 12}M${x} ${y - 10}V${y + 14}M${x - 8} ${y - 7}Q${x - 3} ${y + 2} ${x - 8} ${y + 11}M${x + 8} ${y - 7}Q${x + 3} ${y + 2} ${x + 8} ${y + 11}`, "#5a2a12", 1) +
      k.lume("pulse", k.path(`M${x - 6} ${y - 6}q3 -3 7 -3`, "none", "#fff3c4", 1.4), 3, "#fff3c4"));
  },
  // Drama Club Lead: a velvet cape lined in stage-curtain red, tasselled.
  duskveil(k) {
    const cape = (x0: number, x1: number) =>
      k.path(`M${x0} ${k.T - 2}Q${(x0 + x1) / 2} ${k.T - 6} ${x1} ${k.T - 2}L${x1 + 8} ${k.B + 12}Q${(x0 + x1) / 2} ${k.B + 18} ${x0 - 8} ${k.B + 12}Z`, "#b8202e", k.ink, 1.1) +
      [0, 1, 2, 3, 4].map((i) => k.path(`M${x0 - 6 + i * ((x1 - x0 + 12) / 4)} ${k.B + 12 + Math.sin((i / 4) * Math.PI) * 5}v4`, "none", "#ffd23f", 1.6)).join("");
    if (k.back) k.put("scarf", cape(k.C - k.W - 2, k.C + k.W + 2));
    else k.put("body", k.side ? cape(k.C - k.side * 4 - 12, k.C - k.side * 4 + 12) : cape(k.C - k.W - 6, k.C + k.W + 6), true);
  },
  // Robotics Whiz: a little robot buddy clipped to its belt at its side.
  coilemur(k) {
    const bot = (x: number, y: number) =>
      k.rect(x - 7, y - 4, 14, 12, 3, "#c8d0dc", k.ink, 1) + k.rect(x - 9, y - 16, 18, 13, 4, "#dfe4ec", k.ink, 1) +
      k.rect(x - 6, y - 13, 12, 7, 2, "#2b2f3d", "none", 0) +
      k.lume("pulse", k.circle(x - 2.5, y - 9.5, 1.5, "#59f0ff", "none", 0) + k.circle(x + 2.5, y - 9.5, 1.5, "#59f0ff", "none", 0), 3, "#59f0ff") +
      k.line(`M${x} ${y - 16}V${y - 21}`, "#4a4a56", 1) + k.lume("blink", k.circle(x, y - 22, 1.8, "#ff4f5a", k.ink, 0.5), 4, "#ff4f5a");
    if (k.back) k.put("scarf", sc(k.C + k.W + 12, k.T + 22, 1.3, bot(k.C + k.W + 12, k.T + 22)));
    else k.put("body", k.side ? sc(k.C + k.side * (k.W + 2), k.T + 26, 1.3, bot(k.C + k.side * (k.W + 2), k.T + 26)) : sc(k.C - k.W - 12, k.T + 22, 1.3, bot(k.C - k.W - 12, k.T + 22)));
  },
  // Bake Club Chef: a strawberry layer cake on a tray, its candle lit.
  pyranda(k) {
    held(k, (x, y) =>
      `<ellipse cx="${x}" cy="${y + 10}" rx="15" ry="4" fill="#dfe4ec" stroke="${k.ink}" stroke-width="1"/>` +
      k.rect(x - 11, y - 2, 22, 11, 3, "#ffd8e6", k.ink, 1) + k.line(`M${x - 11} ${y + 3}H${x + 11}`, "#ff6fae", 2) +
      k.rect(x - 8, y - 10, 16, 8, 3, "#fff6f0", k.ink, 1) + k.circle(x - 3, y - 11, 2.6, "#e8343a", k.ink, 0.6) + k.circle(x + 4, y - 11, 2.6, "#e8343a", k.ink, 0.6) +
      k.rect(x - 1, y - 18, 2, 7, 0.6, "#7ad0ff", k.ink, 0.5) + k.lume("pulse", k.path(`M${x} ${y - 24}q2.4 3 0 5q-2.4 -2 0 -5Z`, "#ffc94a", "none", 0), 3, "#ffc94a"));
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
      k.line(`M${x} ${y - len}L${x} ${y + len}`, "#f7f1e1", 0.8) + k.rect(x + s * len * 0.25 - 2, y - 4, 4, 8, 1, "#3a5ab0", k.ink, 0.6) +
      k.lume("pulse", k.circle(x, y - len, 1.6, "#7dff8a", "none", 0) + k.circle(x, y + len, 1.6, "#7dff8a", "none", 0), 3, "#7dff8a");
    if (k.back) k.put("scarf", `<g transform="rotate(${-s * 28} ${k.C} ${k.T + 12})">${draw(k.C, k.T + 12, 34)}</g>`);
    else k.put("body", `<g transform="rotate(${s * 28} ${k.C} ${k.T + 6})">${draw(k.C + s * (k.side ? 6 : 10), k.T + 4, 38)}</g>`, true);
  },
  // Art Club Painter: a big paint palette with a brush, its paint glowing.
  sunbara(k) {
    held(k, (x, y, f) =>
      k.path(`M${x - 14} ${y + 2}Q${x - 16} ${y - 12} ${x} ${y - 12}Q${x + 16} ${y - 12} ${x + 15} ${y + 2}Q${x + 14} ${y + 12} ${x} ${y + 10}Q${x - 4} ${y + 2} ${x - 8} ${y + 8}Q${x - 14} ${y + 10} ${x - 14} ${y + 2}Z`, "#e6c08a", k.ink, 1.1) +
      ["#ff4f6a", "#59f0ff", "#ffd84a", "#7dff8a"].map((c, i) => k.lume("twinkle", k.circle(x - 8 + i * 5, y - 6 + (i % 2) * 3, 2.4, c, k.ink, 0.5), 3 + i, c)).join("") +
      k.line(`M${x + f * 4} ${y + 6}L${x + f * 16} ${y - 16}`, "#8a5a2a", 2) + k.path(`M${x + f * 16} ${y - 16}l${f * 2} -5l${f * 2} 3Z`, "#ff4f6a", k.ink, 0.5));
  },
  // Stargazer: a brass telescope slung across its back, its lens glinting.
  astrabun(k) {
    slung(k, "#b8803a", 5, (x, y, a) => `<g transform="rotate(${a} ${x} ${y})">` +
      k.rect(x - 5, y - 8, 10, 12, 2, "#c89048", k.ink, 1) + k.circle(x, y - 8, 5, "#3a4a7a", k.ink, 1) +
      k.lume("twinkle", k.path(k.star(x - 1.5, y - 9.5, 2.2, 4, 0.3), "#ffffff", "none", 0), 3, "#bfe8ff") + `</g>`);
  },
  // Garden Club Keeper: a green watering can, drops of water catching light.
  wombolder(k) {
    held(k, (x, y, f) =>
      k.path(`M${x - 9} ${y - 8}H${x + 9}L${x + 8} ${y + 10}H${x - 8}Z`, "#3fa05a", k.ink, 1.1) + k.path(`M${x - 6} ${y - 8}Q${x} ${y - 18} ${x + 6} ${y - 8}`, "none", "#2f7a44", 2) +
      k.path(`M${x + f * 8} ${y + 4}L${x + f * 20} ${y - 6}`, "none", "#3fa05a", 3) + k.path(`M${x + f * 19} ${y - 9}l${f * 4} 0l0 6Z`, "#2f7a44", k.ink, 0.6) +
      k.lume("twinkle", k.circle(x + f * 25, y - 2, 1.5, "#9fe8ff", "none", 0) + k.circle(x + f * 27, y + 4, 1.2, "#9fe8ff", "none", 0), 3, "#9fe8ff"));
  },
  // Mystery Club Sleuth: a giant magnifying glass, its lens glinting.
  shadopus(k) {
    slung(k, "#6a4424", 3, (x, y) =>
      k.circle(x, y - 6, 11, "#c8ccd6", k.ink, 1.1) + k.circle(x, y - 6, 8, "#bfe8ff88", k.ink, 0.8) +
      k.lume("twinkle", k.path(k.star(x - 3, y - 9, 3, 4, 0.3), "#ffffff", "none", 0), 3, "#ffffff"));
  },
  // Band Drummer: a pair of drumsticks crossed on its back, tips lit.
  pangrove(k) {
    onBack(k, (x, y, v) => {
      const w = v === "side" ? 12 : v === "front" ? k.W + 24 : k.W + 6;
      return [-1, 1].map((s) => k.line(`M${x - s * w * 0.6} ${y + 10}L${x + s * w} ${y - 34}`, k.ink, 4) + k.line(`M${x - s * w * 0.6} ${y + 10}L${x + s * w} ${y - 34}`, "#e6c08a", 2.4) +
        k.circle(x + s * w, y - 35, 3.4, "#ffffff", k.ink, 0.8)).join("") +
        k.lume("pulse", k.circle(x + w, y - 35, 1.6, "#ffd84a", "none", 0) + k.circle(x - w, y - 35, 1.6, "#ffd84a", "none", 0), 3, "#ffd84a");
    });
  },
  // Nap Club Captain: a big striped pillow tucked under its arm.
  mossloth(k) {
    held(k, (x, y) =>
      k.path(`M${x - 13} ${y - 10}Q${x} ${y - 14} ${x + 13} ${y - 10}Q${x + 17} ${y + 2} ${x + 13} ${y + 14}Q${x} ${y + 18} ${x - 13} ${y + 14}Q${x - 17} ${y + 2} ${x - 13} ${y - 10}Z`, "#cfe0ff", k.ink, 1.1) +
      k.line(`M${x - 13} ${y - 2}Q${x} ${y - 4} ${x + 14} ${y - 2}M${x - 14} ${y + 6}Q${x} ${y + 4} ${x + 14} ${y + 6}`, "#8aa8e8", 1.6) +
      k.lume("twinkle", k.path(k.star(x + 3, y + 1, 3.2, 5), "#fff3a8", k.ink, 0.4), 3, "#fff3a8"));
  },
};

/** The props by collection, for the tests. */
export const EPIC_PROPS = { hero: HERO, campus: CAMPUS } as const;
addDetails("hero", HERO);
addDetails("campus", CAMPUS);

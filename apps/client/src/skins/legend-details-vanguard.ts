import type { Kit } from "./modern-designs";
import { legendDetails, malletHead, type Details } from "./legend-details";
// Registers the costumes these details are drawn over.
import { VANGUARD_LOOK } from "./modern-vanguard";

/**
 * Nova Vanguard: each champion's own headwear and prop, worked up (see
 * legend-details.ts), drawn on the coordinates of its design in
 * modern-vanguard.ts. Every piece comes from the hero's post: a courier's
 * beacon mast and sealed satchel, a forger's goggles, a ranger's fin-crested
 * visor... As in the suits, what sits on one side of the body keeps that
 * side from behind, and what is worn on the face never shows from behind.
 */
const GOLD = "#f2c14e",
  GOLD_D = "#8a6420",
  STEEL = "#c9d4e0",
  STEEL_D = "#5a6a7a";
/** Drawn once for the right-facing profile, mirrored for the left one. */
const prof = (k: Kit, x: number, svg: string) => (k.side < 0 ? `<g transform="translate(${2 * x} 0) scale(-1 1)">${svg}</g>` : svg);
const f = (n: number) => +n.toFixed(2);
/** A rivet: a metal dot with a highlight. */
const rivet = (k: Kit, x: number, y: number, r = 1.3, c = GOLD) => k.circle(x, y, r, c, k.ink, 0.5) + k.circle(x - r * 0.35, y - r * 0.35, r * 0.35, "#ffffff", "none", 0);
/** A hexagon's corners, pointed at top and bottom, as in Prism Sentinel's shield. */
const hexPts = (x: number, y: number, r: number) =>
  Array.from({ length: 6 }, (_, i) => {
    const a = Math.PI / 6 + (i * Math.PI) / 3;
    return [f(x + Math.cos(a) * r), f(y + Math.sin(a) * r)];
  });

const DETAILS: Details = {
  // Pulse Courier: the antenna becomes a segmented mast with gold collars
  // and a caged beacon sending signal arcs; ear cups on the headset; the
  // satchel gets a lit courier seal over its flap and buckled straps.
  voltkit(k) {
    const L = VANGUARD_LOOK.voltkit;
    const ay = k.ht + 36;
    const ax = k.side ? k.hx - k.side * 26 : k.hx + (k.back ? -44 : 44);
    const tip = k.back ? -7 : k.side ? -k.side * 7 : 7;
    const at = (t: number) => [ax + tip * t, ay - 34 * t];
    const [m1x, m1y] = at(0.36),
      [m2x, m2y] = at(0.7),
      [bx, by] = at(1.03);
    const mast = k.line(`M${ax} ${ay}L${m1x} ${m1y}`, "#2a5664", 3.4) + k.line(`M${m1x} ${m1y}L${m2x} ${m2y}`, "#8f9bb0", 2.6) + k.line(`M${m2x} ${m2y}L${bx} ${by + 3}`, "#d9dde6", 2) +
      [at(0.36), at(0.7)].map(([x, y]) => `<ellipse cx="${f(x)}" cy="${f(y)}" rx="2.8" ry="1.5" fill="${GOLD}" stroke="${k.ink}" stroke-width="0.5"/>`).join("");
    // The beacon: a collar under the bulb, a cage over it, signal arcs.
    const beacon = k.rect(bx - 3.6, by + 2, 7.2, 2.6, 1, "#2a5664", k.ink, 0.6) +
      k.line(`M${bx - 3.2} ${by + 2}Q${bx - 4.2} ${by - 4.5} ${bx} ${by - 5}Q${bx + 4.2} ${by - 4.5} ${bx + 3.2} ${by + 2}M${bx} ${by - 5}V${by + 2}`, "#d9dde6", 0.7) +
      k.circle(bx, by - 5.6, 1.1, GOLD, k.ink, 0.4) +
      [-1, 1].map((s, i) => k.lume("chase", k.line(`M${bx + s * 6} ${by - 3.4}Q${bx + s * 7.6} ${by} ${bx + s * 6} ${by + 3.4}M${bx + s * 9} ${by - 5.4}Q${bx + s * 11.4} ${by} ${bx + s * 9} ${by + 5.4}`, L.glow, 1.1), 4 + i, L.glow)).join("");
    // Ear cups: the antenna's, and a plain one on the far side from the
    // front and from behind.
    const cup = (x: number, y: number, r: number) => k.circle(x, y, r, "#2a5664", k.ink, 0.9) + k.lume("pulse", `<circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="none" stroke="${L.glow}" stroke-width="1.4"/>`, 2, L.glow) + rivet(k, x, y, r * 0.22, GOLD);
    const other = k.side ? "" : cup(k.back ? k.hx + 44 : k.hx - 44, ay, 5.6);
    k.put("flame", other + mast + beacon + cup(ax, ay, 6.6));
    // The satchel: buckled straps and the lit courier seal.
    const sx = k.back ? k.L - 9 : k.side ? k.C - k.side * 8 : k.R + 9,
      sy = k.side ? k.B + 4 : k.B + 1;
    const strap = (x: number) => k.rect(x - 1.2, sy - 9, 2.4, 13, 0.6, "#1a3a46", k.ink, 0.5) + k.rect(x - 1.9, sy - 2.2, 3.8, 3, 0.6, "none", GOLD, 0.9);
    const seal = k.circle(sx, sy - 3.4, 3.9, GOLD, k.ink, 0.7) + k.lume("pulse", k.circle(sx, sy - 3.4, 2.6, L.glow, "none", 0), 3, L.glow) +
      k.path(`M${sx + 0.6} ${sy - 5.6}L${sx - 1.2} ${sy - 3}H${sx + 0.4}L${sx - 0.6} ${sy - 1.1}L${sx + 1.4} ${sy - 3.9}H${sx - 0.2}Z`, "#1a3a46", "none");
    k.put(k.side ? "flame" : "body", strap(sx - 8.2) + strap(sx + 8.2) + rivet(k, sx - 8.2, sy - 7, 0.9, STEEL) + rivet(k, sx + 8.2, sy - 7, 0.9, STEEL) + seal);
  },
  // Solar Forger: forge goggles pushed up on the brow under its crest,
  // brass-rimmed with lenses that hold the forge's glow; the strap and its
  // buckle from behind. (Its hammer is drawn with its design.)
  cindrake(k) {
    const y = k.ht + 15;
    const lens = (x: number, r: number, i: number) => k.circle(x, y, r, "#c9a24a", k.ink, 1) + k.circle(x, y, r - 1.8, "#3a1a10", k.ink, 0.5) +
      k.lume("pulse", k.circle(x, y, r - 2.8, "#ff9a3a", "none", 0), i, "#ffb347") +
      k.line(`M${x - r * 0.45} ${y - r * 0.1}L${x - r * 0.1} ${y - r * 0.45}`, "#fff3c0", 1.2) +
      [0, 1, 2, 3].map((j) => rivet(k, x + Math.cos(Math.PI / 4 + (j * Math.PI) / 2) * (r - 0.9), y + Math.sin(Math.PI / 4 + (j * Math.PI) / 2) * (r - 0.9), 0.6, "#ffe08a")).join("");
    // Its crest is drawn behind the head in profile and from behind, so
    // there the goggles go on the head itself.
    if (k.back) k.put("head", k.line(`M${k.hx - 46} ${y + 6}Q${k.hx} ${y - 2} ${k.hx + 46} ${y + 6}`, "#4a2a1a", 3.6) + k.rect(k.hx - 4, y - 0.5, 8, 5, 1, "none", "#c9a24a", 1.2));
    else if (k.side) k.put("head", prof(k, k.hx, k.line(`M${k.hx - 34} ${y + 6}Q${k.hx} ${y - 1} ${k.hx + 20} ${y + 1}`, "#4a2a1a", 3.4) + lens(k.hx + 24, 6.6, 0)));
    else k.put("flame", k.line(`M${k.hx - 48} ${y + 7}Q${k.hx - 34} ${y + 1} ${k.hx - 20} ${y}M${k.hx + 20} ${y}Q${k.hx + 34} ${y + 1} ${k.hx + 48} ${y + 7}`, "#4a2a1a", 3.4) +
      k.line(`M${k.hx - 6} ${y}Q${k.hx} ${y - 3} ${k.hx + 6} ${y}`, "#c9a24a", 2) + lens(k.hx - 13, 7, 0) + lens(k.hx + 13, 7, 1));
  },
  // Riptide Ranger: a fin crest rising from the visor band with a wave lit
  // along it, and steel pods at the band's ends.
  tidefin(k) {
    const L = VANGUARD_LOOK.tidefin;
    const y = k.ht + 14;
    const pod = (x: number, yy: number) => k.circle(x, yy, 3.4, STEEL, k.ink, 0.7) + k.lume("pulse", k.circle(x, yy, 1.5, L.glow, "none", 0), 1, L.glow);
    if (k.back) k.put("flame", k.path(`M${k.hx - 3} ${y + 1}L${k.hx} ${y - 14}L${k.hx + 3} ${y + 1}Z`, "#1f6fb0", k.ink, 0.8) + pod(k.hx - 33, y + 6) + pod(k.hx + 33, y + 6));
    else if (k.side) k.put("flame", prof(k, k.hx, k.path(`M${k.hx + 12} ${y + 2}Q${k.hx + 4} ${y - 10} ${k.hx - 9} ${y - 16}Q${k.hx - 4} ${y - 5} ${k.hx - 8} ${y + 4}Z`, "#1f6fb0", k.ink, 0.9) +
      k.lume("chase", k.line(`M${k.hx + 7} ${y}Q${k.hx + 1} ${y - 7} ${k.hx - 5} ${y - 10}`, L.glow, 1.2), 2, L.glow) + pod(k.hx - 6, y + 4.5)));
    else k.put("flame", k.path(`M${k.hx - 8} ${y + 2}Q${k.hx - 6} ${y - 10} ${k.hx + 4} ${y - 17}Q${k.hx + 3} ${y - 7} ${k.hx + 8} ${y + 2}Z`, "#1f6fb0", k.ink, 0.9) +
      k.lume("chase", k.line(`M${k.hx - 4} ${y}Q${k.hx - 3} ${y - 7} ${k.hx + 2} ${y - 11}`, L.glow, 1.2), 2, L.glow) + pod(k.hx - 35, y + 6) + pod(k.hx + 35, y + 6));
  },
  // Prism Sentinel: the hex shield cut into facets that catch the light
  // (bright above, shaded below), a steel rim with gold rivets at its
  // corners and a glint sweeping it; the brow shards get facets of their
  // own and a gold setting with side gems.
  auralynx(k) {
    const L = VANGUARD_LOOK.auralynx;
    const shield = (x: number, y: number, z: number) => {
      const p = hexPts(x, y, 20 * z);
      const shade = ["#1a2a6a40", "#1a2a6a26", "#ffffff10", "#ffffff40", "#ffffff2a", "#1a2a6a14"];
      return p.map((a, i) => {
        const b = p[(i + 1) % 6];
        return `<path d="M${x} ${y}L${a[0]} ${a[1]}L${b[0]} ${b[1]}Z" fill="${shade[i]}" stroke="#ffffff55" stroke-width="0.5"/>`;
      }).join("") +
        `<path d="M${p.map((q) => q.join(" ")).join("L")}Z" fill="none" stroke="${STEEL}" stroke-width="${2.6 * z}"/>` +
        `<path d="M${p.map((q) => q.join(" ")).join("L")}Z" fill="none" stroke="${k.ink}" stroke-width="0.6"/>` +
        p.map(([u, v]) => rivet(k, u, v, 1.5 * z)).join("") +
        k.lume("pulse", k.path(`M${x} ${y - 4 * z}L${x + 3 * z} ${y}L${x} ${y + 4 * z}L${x - 3 * z} ${y}Z`, "#ffffff", k.ink, 0.5), 2, L.glow) +
        k.lume("twinkle", k.line(`M${x - 13 * z} ${y - 3 * z}L${x - 5 * z} ${y - 13 * z}`, "#ffffff", 1.6 * z) + k.path(k.star(x - 9 * z, y - 12 * z, 2.6 * z, 4, 0.3), "#ffffff", "none"), 1, "#ffffff");
    };
    k.put("body", k.back ? shield(k.C + 42, k.B - 12, 1) : k.side ? shield(k.C - k.side * 22, k.B - 6, 0.75) : shield(k.C - 42, k.B - 12, 1));
    const base = k.ht + 9;
    // Facets on a shard: a ridge of light and a shaded far half.
    const facet = (x: number, tall: number, lean: number) =>
      k.path(`M${x} ${base + 3}L${x + lean} ${base - tall}L${x + 3.2} ${base}Z`, "#3a4a9a55", "none") + k.line(`M${x} ${base + 2}L${x + lean} ${base - tall + 1.5}`, "#ffffff", 0.7);
    const sideGem = (x: number, y: number) => k.path(`M${x} ${y - 2.4}L${x + 1.8} ${y}L${x} ${y + 2.4}L${x - 1.8} ${y}Z`, "#ffffff", GOLD_D, 0.5);
    if (k.back) k.put("flame", rivet(k, k.hx, k.ht + 13.5, 1.8));
    else if (k.side) k.put("flame", prof(k, k.hx, facet(k.hx + 14, 11, 2) + facet(k.hx + 22, 15, 2) + facet(k.hx + 29, 10, 2) +
      k.path(`M${k.hx + 14} ${base + 9}Q${k.hx + 21} ${base + 13} ${k.hx + 28} ${base + 9}`, "none", GOLD, 1.4) + sideGem(k.hx + 6, base + 9.5)));
    else k.put("flame", facet(k.hx - 9, 11, 0) + facet(k.hx, 16, 0) + facet(k.hx + 9, 11, 0) +
      k.path(`M${k.hx - 8} ${base + 9}Q${k.hx} ${base + 14} ${k.hx + 8} ${base + 9}`, "none", GOLD, 1.4) + sideGem(k.hx - 17, base + 6) + sideGem(k.hx + 17, base + 6));
  },
  // Lumen Warden: its lamp becomes a warden's lantern, a gilded cage over
  // the light with a flame inside, moth-wing brackets on its roof, a ring
  // finial, and gold bands down the staff.
  lumoth(k) {
    const L = VANGUARD_LOOK.lumoth;
    const lamp = (x: number, y: number) =>
      k.line(`M${x - 3.6} ${y - 6}V${y + 6}M${x + 3.6} ${y - 6}V${y + 6}M${x} ${y - 6}V${y - 3}M${x} ${y + 4}V${y + 6}`, GOLD, 0.9) +
      k.lume("pulse", k.path(`M${x} ${y - 3}Q${x + 2.4} ${y + 0.5} ${x} ${y + 3}Q${x - 2.4} ${y + 0.5} ${x} ${y - 3}Z`, "#ffffff", "none"), 3, L.glow) +
      k.rect(x - 8, y + 5, 16, 2.6, 1, GOLD, GOLD_D, 0.6) + k.rect(x - 7, y - 7.6, 14, 2, 1, GOLD, GOLD_D, 0.6) +
      [-1, 1].map((s) => k.path(`M${x + s * 4} ${y - 9}Q${x + s * 13} ${y - 17} ${x + s * 15} ${y - 9}Q${x + s * 12} ${y - 5} ${x + s * 5} ${y - 7}Z`, "#f4ecd0", k.ink, 0.7) +
        k.lume("pulse", k.circle(x + s * 11, y - 11, 1.4, L.glow, "none", 0), 4, L.glow)).join("") +
      `<circle cx="${x}" cy="${y - 14}" r="2.2" fill="none" stroke="${GOLD}" stroke-width="1.2"/>` +
      k.rect(x - 2, y + 14, 4, 2.4, 0.8, GOLD, GOLD_D, 0.5) + k.rect(x - 2, y + 30, 4, 2.4, 0.8, GOLD, GOLD_D, 0.5) +
      k.path(`M${x} ${y + 64}l-2.4 2.6l2.4 3.4l2.4 -3.4Z`, GOLD, GOLD_D, 0.5);
    if (k.back) k.put("flame", lamp(k.C - 66, k.T - 24));
    else if (k.side) k.put("flame", lamp(k.C - k.side * 58, k.T - 28));
    else k.put("flame", lamp(k.C + 66, k.T - 24));
  },
  // Night Cartographer: the star map gets gilt corner brackets, a faint
  // grid and a compass point, and a brass projector at the hip casting it
  // up in two beams; a navigator's circlet with a compass-star gem.
  mystowl(k) {
    const L = VANGUARD_LOOK.mystowl;
    const map = (x: number, y: number) =>
      k.line(`M${x - 13} ${y - 4}H${x + 13}M${x - 13} ${y + 3}H${x + 13}M${x - 4.5} ${y - 13}V${y + 9}M${x + 4.5} ${y - 13}V${y + 9}`, `${L.glow}44`, 0.5) +
      k.line(`M${x - 4} ${y + 22}L${x - 12} ${y + 9}M${x + 4} ${y + 22}L${x + 12} ${y + 9}`, `${L.glow}66`, 0.8) +
      [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => k.line(`M${x + u * 14} ${y - 2 + v * 6}V${y - 2 + v * 12}H${x + u * 9}`, GOLD, 1.3)).join("") +
      k.lume("twinkle", k.path(k.star(x + 9, y + 4.5, 2.8, 4, 0.3), "#fff6c8", "none"), 2, "#fff6c8") +
      k.rect(x - 4.5, y + 21, 9, 5, 1.5, "#b8862a", k.ink, 0.8) + k.lume("pulse", `<ellipse cx="${x}" cy="${y + 21}" rx="3" ry="1.2" fill="${L.glow}"/>`, 3, L.glow);
    k.put(k.side || k.back ? "flame" : "body", k.back ? map(k.C + 34, k.B - 18) : k.side ? map(k.C - k.side * 14, k.B - 4) : map(k.C - 36, k.B - 18));
    const y = k.ht + 15;
    const gem = (x: number, yy: number) => k.circle(x, yy, 4.2, "#1e2350", GOLD, 1.1) + k.lume("pulse", k.path(`M${x} ${yy - 3.4}L${x + 1} ${yy}L${x} ${yy + 3.4}L${x - 1} ${yy}Z M${x - 3.4} ${yy}L${x} ${yy - 1}L${x + 3.4} ${yy}L${x} ${yy + 1}Z`, L.glow, "none"), 1, L.glow);
    if (k.back) k.put("flame", k.line(`M${k.hx - 34} ${y + 8}Q${k.hx} ${y - 4} ${k.hx + 34} ${y + 8}`, GOLD, 2));
    else if (k.side) k.put("flame", prof(k, k.hx, k.line(`M${k.hx - 26} ${y + 8}Q${k.hx} ${y - 3} ${k.hx + 26} ${y + 1}`, GOLD, 2) + gem(k.hx + 24, y + 1)));
    else k.put("flame", k.line(`M${k.hx - 34} ${y + 8}Q${k.hx} ${y - 4} ${k.hx + 34} ${y + 8}`, GOLD, 2) + gem(k.hx, y - 1));
  },
  // Bulwark Grove: the tower shield laid in stone blocks inside a bronze
  // rim with rivets, a vine trailing from its moss and veins in its leaf
  // rune; the circlet carved in segments, set with a bronze bezel round
  // its rune and sprouting leaves.
  terradon(k) {
    const BRONZE = "#b07a3a";
    const tower = (x: number, y: number, w: number) => {
      const s = w / 13;
      return k.path(`M${x - w + 2.4} ${y - 19.6}H${x + w - 2.4}V${y + 9.4}Q${x} ${y + 21} ${x - w + 2.4} ${y + 9.4}Z`, "none", BRONZE, 1.6) +
        k.line(`M${x - w + 3} ${y - 7}H${x - 5 * s}M${x + 5 * s} ${y - 7}H${x + w - 3}M${x - w + 3} ${y + 4}H${x - 5 * s}M${x + 5 * s} ${y + 4}H${x + w - 3}M${x - 8 * s} ${y - 17}V${y - 7}M${x + 8 * s} ${y - 7}V${y + 4}`, "#4a4a3a", 0.8) +
        [[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([u, v]) => rivet(k, x + u * (w - 3.4), y + (v < 0 ? -17 : 7), 1.2 * Math.max(s, 0.8), "#d8b070")).join("") +
        k.line(`M${x - w + 4} ${y - 18}Q${x - w + 1} ${y - 10} ${x - w + 4} ${y - 4}`, "#3a6a2a", 1.4) +
        k.path(`M${x - w + 2} ${y - 12}q-3 -1 -3 -4q3 0 3 4Z M${x - w + 4} ${y - 6}q3 -1 3.4 -3.6q-3 0 -3.4 3.6Z`, "#6aaa3a", k.ink, 0.5) +
        k.line(`M${x} ${y - 13}V${y + 7}M${x} ${y - 6}l${3 * s} -3M${x} ${y}l${-3 * s} -3`, "#2f5a2a", 0.8);
    };
    if (k.back) k.put("body", tower(k.C - 44, k.B - 14, 13));
    else k.put("body", k.side ? tower(k.C + k.side * 4, k.B - 10, 7) : tower(k.C + 44, k.B - 14, 13));
    const y = k.ht + 12;
    const sprout = (x: number, yy: number, lean: number) => k.line(`M${x} ${yy}Q${x + lean} ${yy - 4} ${x + lean * 1.4} ${yy - 7}`, "#3a6a2a", 1.2) +
      k.path(`M${x + lean * 1.4} ${yy - 7}q${lean * 4} -3 ${lean * 6} 0q${-lean * 3} 3 ${-lean * 6} 0Z`, "#7ac84a", k.ink, 0.5) + k.path(`M${x + lean * 0.6} ${yy - 3}q${-lean * 4} -2 ${-lean * 5} 1q${lean * 3} 2 ${lean * 5} -1Z`, "#6aaa3a", k.ink, 0.5);
    const bezel = (x: number, yy: number, r: number) => k.path(`M${x} ${yy - r * 1.4}Q${x + r} ${yy} ${x} ${yy + r * 1.4}Q${x - r} ${yy} ${x} ${yy - r * 1.4}Z`, "none", BRONZE, 1.4);
    const notches = (pts: number[][]) => k.line(pts.map(([u, v]) => `M${u} ${v - 2.2}V${v + 2.2}`).join(""), "#55554a", 0.8);
    if (k.back) k.put("flame", notches([[k.hx - 22, y + 2], [k.hx - 8, y], [k.hx + 8, y], [k.hx + 22, y + 2]]) + sprout(k.hx - 16, y - 1, -1) + sprout(k.hx + 16, y - 1, 1));
    else if (k.side) k.put("flame", prof(k, k.hx, notches([[k.hx - 18, y + 4], [k.hx - 4, y + 2], [k.hx + 10, y + 2]]) + sprout(k.hx - 8, y + 1, -1) + bezel(k.hx + 22, y + 2, 7)));
    else k.put("flame", notches([[k.hx - 26, y + 2], [k.hx - 14, y], [k.hx + 14, y], [k.hx + 26, y + 2]]) + sprout(k.hx - 20, y - 1, -1) + sprout(k.hx + 20, y - 1, 1) + bezel(k.hx, y - 1, 8.5));
  },
  // Echo Beacon: a steel emitter fitted to the tip of its hood, three
  // prongs caging the light over a collar, and pips running round the
  // outer signal ring.
  duskveil(k) {
    const L = VANGUARD_LOOK.duskveil;
    const x = k.hx + (k.side ? k.side * 2 : 0),
      y = k.ht + 8;
    k.put("flame", `<g transform="translate(${x} ${y}) scale(1.45) translate(${-x} ${-y})">` + `<ellipse cx="${x}" cy="${y + 1}" rx="7" ry="2.6" fill="${STEEL}" stroke="${k.ink}" stroke-width="0.8"/>` +
      k.line(`M${x - 5.6} ${y}Q${x - 5} ${y - 7} ${x} ${y - 10}M${x + 5.6} ${y}Q${x + 5} ${y - 7} ${x} ${y - 10}`, STEEL, 1.1) +
      k.circle(x, y - 10.6, 1.5, GOLD, k.ink, 0.5) + rivet(k, x - 3.6, y + 1, 0.8, GOLD) + rivet(k, x + 3.6, y + 1, 0.8, GOLD) + "</g>" +
      [-1, 0, 1].map((u, i) => k.lume("twinkle", k.path(k.star(x + u * 21, y + 14 + (u ? -1 : 4.4), 2, 4, 0.35), "#ffffff", "none"), i, L.glow)).join(""));
  },
  // Flux Runner: the visor band gets a HUD lens showing lit chevrons and
  // swept speed fins at its ends.
  coilemur(k) {
    const L = VANGUARD_LOOK.coilemur;
    const y = k.ht + 14;
    const fin = (x: number, yy: number, s: number) => k.path(`M${x} ${yy + 2}L${x + s * 14} ${yy - 10}L${x + s * 10} ${yy - 1}L${x + s * 6} ${yy + 4}Z`, STEEL, k.ink, 0.8) + k.lume("chase", k.line(`M${x + s * 3} ${yy}L${x + s * 11} ${yy - 7}`, L.glow, 1.1), 3, L.glow);
    const hud = (x: number, yy: number, w: number) => k.rect(x - w / 2, yy - 3.6, w, 7.2, 3, "#14161f", k.ink, 0.8) +
      k.lume("chase", k.line(`M${x - w / 2 + 3} ${yy - 2}l2.4 2l-2.4 2M${x - w / 2 + 6.4} ${yy - 2}l2.4 2l-2.4 2${w > 12 ? `M${x - w / 2 + 9.8} ${yy - 2}l2.4 2l-2.4 2` : ""}`, L.glow, 1.1), 4, L.glow);
    if (k.back) k.put("flame", fin(k.hx - 30, y + 4, -1) + fin(k.hx + 30, y + 4, 1));
    else if (k.side) k.put("flame", prof(k, k.hx, fin(k.hx - 20, y + 6, -1) + hud(k.hx + 20, y + 3.4, 12)));
    else k.put("flame", fin(k.hx - 32, y + 4, -1) + fin(k.hx + 32, y + 4, 1) + hud(k.hx, y, 16));
  },
  // Cinder Medic: the med-drone (drawn larger with its design) gets rotor
  // hubs on a mast, green running lights and a steel band; the headband's
  // cross gets medic's wings, and from behind the band ties in a knot with
  // two tails.
  pyranda(k) {
    const L = VANGUARD_LOOK.pyranda;
    const by = k.ht + 16;
    const wing = (x: number, y: number, s: number) => k.path(`M${x + s * 4.5} ${y - 1}Q${x + s * 11} ${y - 10} ${x + s * 17} ${y - 7}Q${x + s * 13} ${y - 4.5} ${x + s * 14} ${y - 2.5}Q${x + s * 9} ${y - 1.5} ${x + s * 4.5} ${y + 2}Z`, "#ffffff", k.ink, 0.7) +
      k.line(`M${x + s * 8} ${y - 1}l${s * 4} -4M${x + s * 10} ${y + 0.2}l${s * 4} -3.4`, "#9ab0b8", 0.6);
    if (k.back) k.put("flame", k.path(`M${k.hx - 2} ${by + 1}Q${k.hx - 6} ${by + 10} ${k.hx - 9} ${by + 16}L${k.hx - 4} ${by + 15}Z M${k.hx + 2} ${by + 1}Q${k.hx + 5} ${by + 9} ${k.hx + 9} ${by + 14}L${k.hx + 4} ${by + 15}Z`, "#f4f8f8", k.ink, 0.7) + k.circle(k.hx, by + 1, 2.8, "#f4f8f8", k.ink, 0.7));
    else if (k.side) k.put("flame", prof(k, k.hx, wing(k.hx + 22, by + 1, -1)));
    else k.put("flame", wing(k.hx, by - 1, -1) + wing(k.hx, by - 1, 1));
    const dx = k.back ? k.C - 52 : k.side ? k.hx - k.side * 40 : k.hx + 62,
      dy = k.ht + 2;
    k.put(k.back ? "scarf" : "flame", `<g transform="translate(${dx} ${dy}) scale(1.3) translate(${-dx} ${-dy})">` +
      k.line(`M${dx} ${dy - 8}V${dy - 6}`, STEEL_D, 2) +
      k.circle(dx - 14, dy - 6.5, 1.8, STEEL, k.ink, 0.5) + k.circle(dx + 14, dy - 6.5, 1.8, STEEL, k.ink, 0.5) +
      k.line(`M${dx - 9.6} ${dy + 1.5}Q${dx} ${dy + 4} ${dx + 9.6} ${dy + 1.5}`, STEEL_D, 1.2) +
      k.lume("pulse", k.circle(dx - 8.6, dy - 2, 1.3, "#7dff8a", "none", 0) + k.circle(dx + 8.6, dy - 2, 1.3, "#7dff8a", "none", 0), 6, "#7dff8a") +
      k.line(`M${dx - 4} ${dy - 5.5}Q${dx - 1} ${dy - 7} ${dx + 3} ${dy - 6.4}`, "#ffffff", 1) + "</g>");
  },
  // Frost Weaver: a silver tiara of three ice crystals on the brow, and
  // its mantle's points cut into facets, strung on a frost thread with a
  // bead of light on each.
  glacelle(k) {
    const pts = k.back ? [-22, -11, 0, 11, 22] : k.side ? [-12, -2, 8] : [-22, -11, 0, 11, 22];
    const x0 = k.side ? k.C - k.side * 2 : k.C;
    const tips = pts.map((u) => [x0 + (k.side ? k.side * u : u), k.T + 15 - Math.abs(u) * 0.25]);
    const facets = tips.map(([x, ty]) => k.path(`M${x} ${k.T}L${x} ${ty}L${x + 5.5} ${k.T}Z`, "#3a7ab066", "none") + k.line(`M${x} ${k.T + 1}L${x} ${ty - 1.5}`, "#ffffff", 0.8)).join("");
    const thread = k.lume("chase", k.line("M" + tips.map(([x, ty]) => `${f(x)} ${f(ty - 4)}`).join("L"), "#dff6ff", 0.8), 2, "#dff6ff") +
      tips.map(([x, ty], i) => k.lume("twinkle", k.circle(x, ty - 4, 1.3, "#ffffff", "#7fd8ff", 0.5), 3 + i, "#dff6ff")).join("");
    const y = k.ht + 14;
    const crystal = (x: number, yy: number, h: number, i: number) => k.lume("twinkle", k.path(`M${x - 4.2} ${yy}L${x} ${yy - h}L${x + 4.2} ${yy}L${x} ${yy + 3}Z`, "#8fd8ff", k.ink, 0.8), i, "#dff6ff") +
      k.path(`M${x} ${yy + 3}L${x} ${yy - h}L${x + 4.2} ${yy}Z`, "#2a5a9a55", "none") + k.line(`M${x - 1.4} ${yy}L${x - 0.3} ${yy - h + 3}`, "#ffffff", 0.9);
    const tiara = k.back ? k.line(`M${k.hx - 28} ${y + 7}Q${k.hx} ${y - 3} ${k.hx + 28} ${y + 7}`, "#dfe6ee", 2.8)
      : k.side ? prof(k, k.hx, k.line(`M${k.hx - 22} ${y + 7}Q${k.hx} ${y - 2} ${k.hx + 26} ${y + 3}`, "#dfe6ee", 2.8) + crystal(k.hx + 14, y + 2, 9, 0) + crystal(k.hx + 23, y + 3, 13, 1))
      : k.line(`M${k.hx - 28} ${y + 7}Q${k.hx} ${y - 3} ${k.hx + 28} ${y + 7}`, "#dfe6ee", 2.8) + crystal(k.hx - 11, y + 2.5, 9, 0) + crystal(k.hx + 11, y + 2.5, 9, 1) + crystal(k.hx, y + 1, 15, 2);
    k.put("flame", facets + thread + tiara);
  },
  // Gale Captain: the vane rotor gets a steel cowling, lit blade tips, a
  // gold pennant streaming from a staff above it and a shoulder mount; its
  // shoulder boards hang gold fringe.
  halcyra(k) {
    const L = VANGUARD_LOOK.halcyra;
    const s = k.back ? -1 : k.side ? -k.side : 1;
    const rotor = (x: number, y: number) => k.line(`M${x} ${y - 13}V${y - 27}`, "#5a6a8a", 1.6) +
      k.path(`M${x} ${y - 27}Q${x + s * 8} ${y - 28} ${x + s * 14} ${y - 24}Q${x + s * 8} ${y - 22} ${x} ${y - 20}Z`, GOLD, k.ink, 0.7) +
      k.lume("chase", k.line(`M${x + s * 1.5} ${y - 23.6}Q${x + s * 7} ${y - 24.4} ${x + s * 11} ${y - 24}`, L.glow, 1), 6, L.glow) +
      `<circle cx="${x}" cy="${y}" r="14" fill="none" stroke="${STEEL}" stroke-width="2"/>` + `<circle cx="${x}" cy="${y}" r="15.2" fill="none" stroke="${k.ink}" stroke-width="0.6"/>` +
      [0, 120, 240].map((a) => k.circle(x + Math.cos((a * Math.PI) / 180) * 11, y + Math.sin((a * Math.PI) / 180) * 11, 1.2, "#ffffff", "none", 0)).join("") +
      k.rect(x - 4, y + 28, 8, 4, 1.2, GOLD, GOLD_D, 0.6);
    const fringe = (x: number) => k.line(Array.from({ length: 6 }, (_, i) => `M${x - 6 + i * 2.4} ${k.T + 5}v4.4`).join(""), GOLD, 1.1) + k.path(k.star(x, k.T + 2.5, 1.8, 5), "#ffffff", "none");
    if (k.back) k.put("flame", rotor(k.C - 40, k.T - 14));
    else if (k.side) k.put("flame", rotor(k.C - k.side * 46, k.T - 16) + fringe(k.C - k.side * 2));
    else k.put("flame", rotor(k.C + 56, k.T - 14) + fringe(k.L + 5) + fringe(k.R - 5));
  },
  // Dawn Defender: the sun crown's band engraved and set with rubies
  // between its rays, a light ridge down each ray, and a sunburst round
  // the front gem (front and face side only).
  sunbara(k) {
    const cx = k.hx + (k.side ? -k.side * 2 : 0),
      cy = k.ht + 30,
      rx = k.side ? 42 : 46,
      ry = 22;
    const at = (deg: number, out = 0) => {
      const a = (deg * Math.PI) / 180;
      return [cx + Math.cos(a) * (rx + out), cy + Math.sin(a) * (ry + out)];
    };
    const [x0, y0] = at(205),
      [x1, y1] = at(335);
    const engrave = `<path d="M${f(x0)} ${f(y0)}A${rx} ${ry} 0 0 1 ${f(x1)} ${f(y1)}" fill="none" stroke="#8a5a10" stroke-width="0.7" stroke-dasharray="1.4 1.6"/>`;
    const ridges = k.line([210, 230, 250, 270, 290, 310, 330].map((deg) => {
      const [bx, by] = at(deg, 1),
        [tx, ty] = at(deg, deg === 270 ? 17 : 12);
      return `M${f(bx)} ${f(by)}L${f(tx)} ${f(ty)}`;
    }).join(""), "#fff3b0", 0.8);
    const rubies = [220, 240, 260, 280, 300, 320].map((deg, i) => {
      const [gx, gy] = at(deg);
      return k.lume("twinkle", k.circle(gx, gy, 1.9, i % 2 ? "#ff5a3a" : "#ffffff", "#8a5a10", 0.6), i, "#ffcf5a");
    }).join("");
    const gemDeg = k.side ? (k.side > 0 ? 330 : 210) : 270;
    const [gx, gy] = at(gemDeg);
    const burst = k.back ? "" : k.path(Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const r1 = 5.4,
        r2 = i % 2 ? 7.6 : 9;
      return `M${f(gx + 2 + Math.cos(a - 0.12) * r1 - 2)} ${f(gy + 2 + Math.sin(a - 0.12) * r1)}L${f(gx + Math.cos(a) * r2)} ${f(gy + 2 + Math.sin(a) * r2)}L${f(gx + Math.cos(a + 0.12) * r1)} ${f(gy + 2 + Math.sin(a + 0.12) * r1)}Z`;
    }).join(""), "#ffcf5a", "#b8862a", 0.5);
    k.put("flame", ridges + engrave + rubies, false);
    if (burst) k.put("flame", burst + k.lume("pulse", k.circle(gx, gy + 2, 4.6, "#ff9a3a", "#b8862a", 1) + k.circle(gx, gy + 2, 2, "#fff3b0", "none", 0), 8, VANGUARD_LOOK.sunbara.glow));
  },
  // Comet Strider: a star band high on the forehead, lit along its length
  // and studded with gold stars, well above the comet clip by its left eye,
  // so the clip's star stands on its own.
  astrabun(k) {
    const L = VANGUARD_LOOK.astrabun;
    const y = k.ht + 9;
    const studs = (pts: number[][]) => pts.map(([x, yy], i) => k.lume("twinkle", k.path(k.star(x, yy, 3.2, 5), "#ffe9a8", k.ink, 0.5), 2 + i, L.glow)).join("");
    const band = (d: string) => k.line(d, "#2a3a6a", 4) + k.lume("chase", k.line(d, "#9fd8ff", 1.3), 1, "#9fd8ff");
    if (k.back) k.put("flame", band(`M${k.hx - 34} ${y + 6}Q${k.hx} ${y - 6} ${k.hx + 34} ${y + 6}`));
    else if (k.side) k.put("flame", prof(k, k.hx, band(`M${k.hx - 28} ${y + 6}Q${k.hx} ${y - 5} ${k.hx + 16} ${y + 1}`) + studs([[k.hx - 8, y - 0.6], [k.hx + 6, y - 1]])));
    else k.put("flame", band(`M${k.hx - 32} ${y + 6}Q${k.hx} ${y - 6} ${k.hx + 18} ${y + 1}`) + studs([[k.hx - 18, y - 0.4], [k.hx - 4, y - 2.6], [k.hx + 9, y - 2]]));
  },
  // Quake Marshal: a gold braid and buttons across the cap, wings round its
  // star badge and a button on top; rivets and a gold edge on its
  // pauldrons.
  wombolder(k) {
    const y = k.ht + 16;
    const wings = (x: number, yy: number, sides: number[]) => sides.map((s) => k.path(`M${x + s * 5.5} ${yy - 1}Q${x + s * 11} ${yy - 7} ${x + s * 16} ${yy - 5}Q${x + s * 12} ${yy - 2} ${x + s * 14} ${yy}Q${x + s * 9} ${yy + 1} ${x + s * 5.5} ${yy + 2}Z`, GOLD, GOLD_D, 0.6)).join("");
    const pauldron = (x: number, yy: number) => `<ellipse cx="${x}" cy="${yy}" rx="11" ry="6.5" fill="none" stroke="${GOLD}" stroke-width="1"/>` + [-6, 0, 6].map((u) => rivet(k, x + u, yy + 2.6 - Math.abs(u) * 0.2, 1, STEEL)).join("");
    if (k.back) k.put("flame", rivet(k, k.hx, y - 27, 2) + k.rect(k.hx - 5, y - 4, 10, 4, 1, GOLD, GOLD_D, 0.6));
    else if (k.side) k.put("flame", prof(k, k.hx, k.line(`M${k.hx - 26} ${y - 5}Q${k.hx} ${y - 10} ${k.hx + 22} ${y - 5}`, GOLD, 1.6) + rivet(k, k.hx + 21, y - 5, 1.6) + rivet(k, k.hx - 2, y - 27, 2) + wings(k.hx + 18, y - 14, [-1])) +
      pauldron(k.C - k.side * 2, k.T + 3));
    else k.put("flame", k.line(`M${k.hx - 30} ${y - 5}Q${k.hx} ${y - 11} ${k.hx + 30} ${y - 5}`, GOLD, 1.6) + rivet(k, k.hx - 30, y - 5, 1.6) + rivet(k, k.hx + 30, y - 5, 1.6) + rivet(k, k.hx, y - 27, 2) +
      wings(k.hx, y - 14, [-1, 1]) + pauldron(k.L + 5, k.T + 3) + pauldron(k.R - 5, k.T + 3));
  },
  // Deepwatch Oracle: a brass sonar bell mounted on top of its dome,
  // sending a lit ping; brass rims round the collar's portholes and bolts
  // between them.
  shadopus(k) {
    const L = VANGUARD_LOOK.shadopus;
    const x = k.hx + k.side * 2,
      top = k.ht + 1;
    k.put("flame", k.rect(x - 1.6, top - 7, 3.2, 8, 1, "#8a6420", k.ink, 0.6) +
      k.path(`M${x - 7} ${top - 7}Q${x - 7} ${top - 15} ${x} ${top - 15}Q${x + 7} ${top - 15} ${x + 7} ${top - 7}Z`, "#c9963a", k.ink, 0.9) +
      k.line(`M${x - 4.6} ${top - 9}Q${x - 4} ${top - 12.6} ${x - 1} ${top - 13.2}`, "#ffe8b0", 1) +
      k.rect(x - 8, top - 8, 16, 2.6, 1, "#8a6420", k.ink, 0.6) +
      k.lume("pulse", k.circle(x, top - 15.6, 1.8, L.glow, k.ink, 0.5), 4, L.glow) +
      k.lume("chase", `<path d="M${x - 11} ${top - 13}Q${x} ${top - 25} ${x + 11} ${top - 13}" fill="none" stroke="${L.glow}" stroke-width="1.2"/>`, 3, L.glow));
    const ports = k.back ? [-14, 0, 14] : k.side ? [-6, 6] : [-16, -6, 6, 16];
    const x0 = k.side ? k.C + k.side * 2 : k.C;
    const bolts = k.back ? [-7, 7] : k.side ? [0] : [-11, 0, 11];
    k.put("body", ports.map((u) => `<circle cx="${x0 + u}" cy="${k.T - 0.5}" r="3" fill="none" stroke="#7a5418" stroke-width="1.1"/>`).join("") + bolts.map((u) => rivet(k, x0 + u, k.T - 0.5, 0.9, "#e8c27a")).join(""));
  },
  // Briar Bastion: a circlet of two twined briars with thorns and a rose
  // bud lit on the brow; leaves and buds on its thorned pauldrons.
  pangrove(k) {
    const y = k.ht + 16;
    const bud = (x: number, yy: number, r: number, i: number) => k.path(`M${x - r * 1.1} ${yy + r * 0.6}Q${x} ${yy + r * 1.7} ${x + r * 1.1} ${yy + r * 0.6}Z`, "#4a8a3a", k.ink, 0.5) +
      k.lume("pulse", k.path(`M${x} ${yy - r * 1.2}Q${x + r * 1.2} ${yy - r * 0.2} ${x + r * 0.8} ${yy + r * 0.8}Q${x} ${yy + r * 1.1} ${x - r * 0.8} ${yy + r * 0.8}Q${x - r * 1.2} ${yy - r * 0.2} ${x} ${yy - r * 1.2}Z`, "#ff8ab4", k.ink, 0.6), i, "#ffb3cf");
    const briar = (d: string, thorns: number[][]) => k.line(d, "#3a2a1a", 2.6) + k.line(d, "#6a4a2a", 1.2) +
      thorns.map(([u, v, s]) => k.path(`M${u - 1.4} ${v}L${u + s * 1.6} ${v - 3.6}L${u + 1.4} ${v}Z`, "#c8d8a0", k.ink, 0.4)).join("");
    if (k.back) k.put("flame", briar(`M${k.hx - 36} ${y + 8}Q${k.hx} ${y - 4} ${k.hx + 36} ${y + 8}`, [[k.hx - 24, y + 3, -1], [k.hx - 8, y + 0.5, 0], [k.hx + 8, y + 0.5, 0], [k.hx + 24, y + 3, 1]]));
    else if (k.side) k.put("flame", prof(k, k.hx, briar(`M${k.hx - 28} ${y + 8}Q${k.hx} ${y - 3} ${k.hx + 26} ${y + 3}`, [[k.hx - 16, y + 3.6, -1], [k.hx, y + 2, 0], [k.hx + 12, y + 2, 1]]) + bud(k.hx + 24, y + 1, 3.6, 0)));
    else k.put("flame", briar(`M${k.hx - 38} ${y + 8}Q${k.hx} ${y - 4} ${k.hx + 38} ${y + 8}`, [[k.hx - 26, y + 3, -1], [k.hx - 13, y + 0.6, -1], [k.hx + 13, y + 0.6, 1], [k.hx + 26, y + 3, 1]]) + bud(k.hx, y - 1, 4, 0));
    const leaf = (x: number, yy: number) => k.path(`M${x} ${yy}q6 -4 10 -1q-5 4 -10 1Z`, "#7ac84a", k.ink, 0.5) + bud(x - 1, yy - 1, 2.2, 2);
    if (k.back) k.put("scarf", leaf(k.C - 22, k.T + 6) + leaf(k.C + 14, k.T + 6));
    else k.put("flame", k.side ? leaf(k.C - k.side * 2 - 4, k.T + 7) : leaf(k.L + 1, k.T + 7) + leaf(k.R - 9, k.T + 7));
  },
  // Cloud Keeper: a soft band with a raindrop gem on the brow and small
  // cloud puffs at the temples. (Its cloud is drawn with its design.)
  mossloth(k) {
    const L = VANGUARD_LOOK.mossloth;
    const y = k.ht + 10;
    const puff = (x: number, yy: number) => [[-3, 1, 3.4], [1.5, -1, 4], [4.6, 1.4, 3]].map(([u, v, r]) => k.circle(x + u, yy + v, r, k.ink, k.ink, 1.6)).join("") +
      [[-3, 1, 3.4], [1.5, -1, 4], [4.6, 1.4, 3]].map(([u, v, r]) => k.circle(x + u, yy + v, r, "#f4f8ff", "none", 0)).join("");
    const drop = (x: number, yy: number) => k.lume("pulse", k.path(`M${x} ${yy - 5.4}Q${x + 4} ${yy + 0.6} ${x} ${yy + 3.6}Q${x - 4} ${yy + 0.6} ${x} ${yy - 5.4}Z`, L.glow, k.ink, 0.7), 1, L.glow) + k.circle(x - 1, yy, 0.8, "#ffffff", "none", 0);
    const band = (d: string) => k.line(d, "#3a5a7a", 3) + k.line(d, "#bfe0ff", 1);
    if (k.back) k.put("flame", band(`M${k.hx - 38} ${y + 8}Q${k.hx} ${y - 4} ${k.hx + 38} ${y + 8}`) + puff(k.hx - 36, y + 7) + puff(k.hx + 34, y + 7));
    else if (k.side) k.put("flame", prof(k, k.hx, band(`M${k.hx - 30} ${y + 8}Q${k.hx} ${y - 3} ${k.hx + 28} ${y + 3}`) + puff(k.hx - 8, y + 2) + drop(k.hx + 26, y + 2)));
    else k.put("flame", band(`M${k.hx - 40} ${y + 8}Q${k.hx} ${y - 4} ${k.hx + 40} ${y + 8}`) + puff(k.hx - 38, y + 7) + puff(k.hx + 36, y + 7) + drop(k.hx, y - 0.5));
  },
};

/**
 * Comet Strider's mallet becomes a comet staff: a silver shaft (the
 * handle, recoloured in vanguard-art.ts) topped by a night-blue orb that
 * holds a glowing star, its comet tail streaming up and back.
 */
const ownComet = DETAILS.astrabun;
DETAILS.astrabun = (k) => {
  ownComet?.(k);
  const { x, y } = malletHead(k);
  // The tail streams behind it in profile, outward from the front and back.
  const back = k.side ? -k.side : 1;
  const tail = [0, 1, 2].map((i) => k.path(`M${x + back * 4} ${y - 8 + i * 6}Q${x + back * (22 + i * 4)} ${y - 26 + i * 4} ${x + back * (34 + i * 6)} ${y - 40 + i * 6}Q${x + back * (18 + i * 2)} ${y - 18 + i * 6} ${x + back * 2} ${y - 2 + i * 6}Z`, i === 1 ? "#ffe9a8" : "#9fd8ff", "none")).join("");
  k.put("armR", k.lume("chase", tail, 3, "#9fd8ff") +
    k.circle(x, y, 19, "#1c2850", k.ink, 1.1) + k.circle(x, y, 15.5, "none", "#9fd8ff", 1.2) +
    k.lume("pulse", k.path(k.star(x, y, 13, 5, 0.46), "#ffe9a8", k.ink, 0.8) + k.path(k.star(x, y, 6, 5, 0.46), "#ffffff", "none", 0), 4, "#ffe9a8") +
    k.circle(x - 9, y - 9, 2, "#ffffff", "none", 0));
};

legendDetails("vanguard", DETAILS);

import type { CharacterId } from "@arena/shared";
import { DESIGNS, backPanel, torso, type Design, type Kit } from "./modern-designs";

/**
 * Hero Squad for the rest of the roster. The squad shares one language: a
 * suit with a glowing chest emblem on a white diamond plate and a belt with
 * a lit buckle. Each hero adds its own power, drawn from the champion
 * (Cindrake's magma vents, Glacelle's ice crown, Halcyra's targeting lens,
 * Mossloth's clock...). Every name and mark is original.
 */
const cx = (k: Kit) => k.C + k.side * 3;
/** The squad's emblem plate and belt, shared by every hero. */
function suit(k: Kit, color: string, trim: string, emblem: (x: number, y: number) => string, extra = "") {
  const c = cx(k),
    ey = k.T + 12;
  k.put("body", torso(k, color,
    k.line(`M${k.L + 2} ${k.T + 3}Q${c} ${k.T + 9} ${k.R - 2} ${k.T + 3}`, trim, 1) +
      k.rect(k.L - 2, k.B - 11, k.R - k.L + 4, 5, 0, "#2a2a36") +
      k.lume("pulse", k.rect(c - 3, k.B - 11.5, 6, 6, 1.5, trim, k.ink, 0.6), 1, trim) +
      extra +
      (k.side ? "" : k.path(`M${c} ${ey - 9}L${c + 9} ${ey}L${c} ${ey + 9}L${c - 9} ${ey}Z`, "#ffffff", k.ink, 0.8)) +
      k.lume("pulse", emblem(c, ey), 0, trim)));
}
/** A short cape: its edges show past the arms in front, the whole of it behind. */
function cape(k: Kit, color: string, edge?: string) {
  if (k.back) {
    k.put("scarf", k.path(`M${k.C - k.W + 2} ${k.T}Q${k.C} ${k.T - 4} ${k.C + k.W - 2} ${k.T}L${k.C + k.W + 8} ${k.B + 10}Q${k.C} ${k.B + 16} ${k.C - k.W - 8} ${k.B + 10}Z`, color) +
      (edge ? [0, 1, 2, 3, 4, 5].map((i) => {
        const u = i / 5;
        return k.lume("chase", k.circle(k.C - k.W - 6 + u * (2 * k.W + 12), k.B + 10 + Math.sin(u * Math.PI) * 5, 1.1, edge, "none", 0), i, edge);
      }).join("") : ""));
    return;
  }
  k.put("body", k.path(`M${k.C - k.W - 4} ${k.T + 2}L${k.C - k.W - 9} ${k.B + 10}L${k.C - k.W + 2} ${k.B + 2}Z M${k.C + k.W + 4} ${k.T + 2}L${k.C + k.W + 9} ${k.B + 10}L${k.C + k.W - 2} ${k.B + 2}Z`, color, k.ink, 0.9), true);
}
/** A band across the brow, front or profile. */
const band = (k: Kit, y: number, w: number, fill: string, h = 7) => {
  const x = k.hx + k.side * 2;
  return k.path(`M${x - w} ${y + 2}Q${x} ${y - 8} ${x + w} ${y + 2}L${x + w - 1} ${y + 2 + h}Q${x} ${y - 8 + h} ${x - w + 1} ${y + 2 + h}Z`, fill);
};
/** A crescent moon of radius r, opening to the right. */
function crescentD(x: number, y: number, r: number) {
  const px = x + r * 0.5,
    py = r * 0.866;
  return `M${px} ${y - py}A${r} ${r} 0 1 0 ${px} ${y + py}A${r * 0.95} ${r * 0.95} 0 0 1 ${px} ${y - py}Z`;
}
function starPts(x: number, y: number, r: number, n: number, inner = 0.45) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + "Z";
}

export const HERO: Partial<Record<CharacterId, Design>> = {
  // Blaze Breaker: a magma-vented collar glowing in a run, a flame emblem and
  // its own living flame crest kept as the hero's hair.
  cindrake(k) {
    const flame = "#ff8a3a";
    const flameD = (x: number, y: number) => k.path(`M${x} ${y - 6}C${x + 5} ${y - 1} ${x + 4} ${y + 6} ${x} ${y + 6}C${x - 4} ${y + 6} ${x - 5} ${y - 1} ${x} ${y - 6}Z`, flame, k.ink, 0.5);
    if (k.back) backPanel(k, "#2a1c1c", k.lume("pulse", flameD(k.C, k.T + 14), 0, flame));
    else {
      suit(k, "#3a1f1f", flame, flameD);
      // The vented collar: plates with magma between them.
      const c = cx(k);
      k.put("body", k.path(`M${c - 15} ${k.T - 2}Q${c} ${k.T + 6} ${c + 15} ${k.T - 2}L${c + 13} ${k.T - 7}Q${c} ${k.T} ${c - 13} ${k.T - 7}Z`, "#2a2a36") +
        [-2, -1, 0, 1, 2].map((i) => k.lume("chase", k.line(`M${c + i * 5} ${k.T - 4 + Math.abs(i) * 0.6}v4`, "#ffb347", 1.4), i + 2, "#ffb347")).join(""));
    }
  },
  // Prism Fist: crystal pauldrons, a gem emblem and a crystal on the brow.
  auralynx(k) {
    const crystal = "#bfe8ff";
    const gem = (x: number, y: number) => k.path(`M${x} ${y - 6}L${x + 5} ${y - 1}L${x + 3} ${y + 6}L${x - 3} ${y + 6}L${x - 5} ${y - 1}Z`, crystal, k.ink, 0.5);
    if (k.back) backPanel(k, "#2f3f8c", k.lume("pulse", gem(k.C, k.T + 14), 0, crystal));
    else {
      suit(k, "#2f3f8c", crystal, gem);
      const pad = (s: number) => k.path(`M${k.C + s * (k.W - 6)} ${k.T + 4}L${k.C + s * (k.W + 2)} ${k.T - 10}L${k.C + s * (k.W + 12)} ${k.T - 2}L${k.C + s * (k.W + 8)} ${k.T + 8}Z`, crystal) +
        k.lume("pulse", k.line(`M${k.C + s * (k.W + 2)} ${k.T - 8}L${k.C + s * (k.W + 6)} ${k.T + 4}`, "#ffffff", 1), 2, crystal);
      k.put("body", k.side ? pad(-k.side) : pad(-1) + pad(1));
    }
    const x = k.hx + k.side * 6,
      y = k.ht + 18;
    k.put("flame", band(k, y, k.side ? 40 : 46, "#2f3f8c", 5) + (k.back ? "" : k.lume("pulse", gem(x, y - 1), 1, crystal)));
  },
  // Lumina: a cream suit with a lantern-core emblem, a glittering sash and a
  // tiara of light between the antennae.
  lumoth(k) {
    const gold = "#ffe08a";
    const core = (x: number, y: number) => k.circle(x, y, 4.6, "#fff6c9", k.ink, 0.6) + k.circle(x, y, 2.2, gold, "none", 0);
    const sash = () => k.line(`M${k.L} ${k.T + 2}L${k.R} ${k.B - 6}`, "#c8a83a", 3.4) +
      [0, 1, 2, 3].map((i) => k.lume("twinkle", k.path(starPts(k.L + 6 + i * (k.R - k.L - 12) / 3, k.T + 5 + i * (k.B - k.T - 12) / 3, 1.6, 4), "#ffffff", "none"), i, "#ffffff")).join("");
    if (k.back) backPanel(k, "#efe6c9", k.lume("pulse", core(k.C, k.T + 14), 0, gold));
    else suit(k, "#efe6c9", gold, core, sash());
    const x = k.hx + k.side * 2,
      y = k.ht + 6;
    k.put("flame", k.line(`M${x - 22} ${y + 4}Q${x} ${y - 4} ${x + 22} ${y + 4}`, "#c8a83a", 1.8) +
      k.lume("pulse", k.path(starPts(x + k.side * 6, y - 4, 6, 4), gold, k.ink, 0.6), 1, gold));
  },
  // Duskwatch: a dark cape lit along its edge and a crescent-and-lamp emblem.
  duskveil(k) {
    const teal = "#8ff5e6";
    const em = (x: number, y: number) => k.path(crescentD(x, y, 6), teal, k.ink, 0.5);
    cape(k, "#1b1630", teal);
    if (!k.back) {
      suit(k, "#2a2244", teal, em);
      // The cape's lit edge, down both sides.
      k.put("body", [0, 1, 2].map((i) => k.lume("chase", k.circle(k.C - k.W - 5 - i * 1.5, k.T + 8 + i * 7, 1, teal, "none", 0) + k.circle(k.C + k.W + 5 + i * 1.5, k.T + 8 + i * 7, 1, teal, "none", 0), i, teal)).join(""), true);
    }
  },
  // Magnetail: a horseshoe-magnet emblem, coil stripes round the suit lit in
  // a run, and arc earpieces.
  coilemur(k) {
    const arc = "#7ff3ff";
    const magnet = (x: number, y: number) => k.path(`M${x - 5} ${y + 5}V${y - 1}A5 5 0 0 1 ${x + 5} ${y - 1}V${y + 5}H${x + 2}V${y - 1}A2 2 0 0 0 ${x - 2} ${y - 1}V${y + 5}Z`, "#e8322a", k.ink, 0.5) +
      k.rect(x - 5, y + 3, 3, 2.4, 0, "#e8e8f0", "none") + k.rect(x + 2, y + 3, 3, 2.4, 0, "#e8e8f0", "none");
    const coils = [0, 1, 2].map((i) => k.lume("chase", k.line(`M${k.L} ${k.T + 18 + i * 5}H${k.R}`, arc, 1), i, arc)).join("");
    if (k.back) backPanel(k, "#3a3f52", coils);
    else suit(k, "#3a3f52", arc, magnet, coils);
    if (!k.back) {
      const xs = k.side ? [k.hx - k.side * 18] : [k.hx - 52, k.hx + 52];
      const cy = k.ht + 46;
      k.put("flame", xs.map((x, i) => k.circle(x, cy, 6, "#3a3f52") + k.lume("blink", k.path(`M${x} ${cy - 6}l3 -6l-4 2l3 -6`, "none", arc, 1.4), i, arc)).join(""));
    }
  },
  // Chestnut Comet: aviator goggles with lit lenses, a chestnut emblem, and a
  // launcher tube slung on the back with an ember at its mouth.
  pyranda(k) {
    const ember = "#ff9a3a";
    const nut = (x: number, y: number) => k.path(`M${x} ${y - 6}Q${x + 7} ${y - 2} ${x + 5} ${y + 4}Q${x} ${y + 7} ${x - 5} ${y + 4}Q${x - 7} ${y - 2} ${x} ${y - 6}Z`, "#8a4a24", k.ink, 0.5) +
      k.path(`M${x - 4} ${y + 2}Q${x} ${y + 5} ${x + 4} ${y + 2}`, "none", ember, 1);
    if (k.back) backPanel(k, "#7a2a1c", k.lume("pulse", nut(k.C, k.T + 14), 0, ember));
    else suit(k, "#7a2a1c", ember, nut);
    // The launcher across the back, its mouth glowing above a shoulder.
    const s = k.side ? -k.side : 1;
    const tube = (x0: number, y0: number, x1: number, y1: number) => k.line(`M${x0} ${y0}L${x1} ${y1}`, "#4a4f5c", 7) + k.line(`M${x0} ${y0}L${x1} ${y1}`, "#6a7080", 3) +
      k.lume("pulse", k.circle(x1, y1, 3.6, ember, k.ink, 0.6), 2, ember);
    if (k.back) k.put("scarf", tube(k.C + 14, k.B, k.C - 22, k.T - 18));
    else k.put("body", tube(k.C - s * 12, k.B - 4, k.C + s * (k.side ? 26 : 52), k.T - 26), true);
    // Goggles up on the brow.
    if (!k.back) {
      const y = k.ht + 14;
      const xs = k.side ? [k.hx + k.side * 16] : [k.hx - 16, k.hx + 16];
      k.put("flame", k.line(`M${k.hx - 46} ${y + 4}Q${k.hx} ${y - 8} ${k.hx + 46} ${y + 4}`, "#5a3a22", 3) +
        xs.map((x, i) => k.circle(x, y, 9, "#b8823a") + k.lume("pulse", k.circle(x, y, 6, "#ffd27a", k.ink, 0.6), i + 3, ember)).join(""));
    }
  },
  // Frost Sentinel: an ice crown whose spikes light one after another, a
  // snowflake emblem and a frosted cape.
  glacelle(k) {
    const ice = "#d8f6ff";
    const flake = (x: number, y: number) => k.line([0, 60, 120].map((a) => {
      const c = Math.cos((a * Math.PI) / 180) * 6,
        s = Math.sin((a * Math.PI) / 180) * 6;
      return `M${x - c} ${y - s}L${x + c} ${y + s}`;
    }).join(""), "#7fd8ff", 1.8);
    cape(k, "#9fd8f0", ice);
    if (!k.back) suit(k, "#2c5f8c", ice, flake);
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    const n = k.side ? 3 : 5;
    const spikes = Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1);
      const sx = x - (k.side ? 16 : 28) + u * (k.side ? 32 : 56);
      const h = 12 + (1 - Math.abs(u - 0.5) * 2) * 10;
      return k.lume("chase", k.path(`M${sx - 4} ${y}L${sx} ${y - h}L${sx + 4} ${y}Z`, ice, "#6aa8c8", 0.7), i, ice);
    }).join("");
    k.put("flame", spikes + k.path(`M${x - 34} ${y + 2}Q${x} ${y - 6} ${x + 34} ${y + 2}L${x + 33} ${y + 7}Q${x} ${y - 1} ${x - 33} ${y + 7}Z`, "#9fd8f0"));
  },
  // Skysight: a targeting lens over one eye with a lit crosshair, a wing
  // emblem and a long scarf streaming behind.
  halcyra(k) {
    const amber = "#ffb347";
    const wing = (x: number, y: number) => k.path(`M${x - 6} ${y + 4}Q${x - 1} ${y - 7} ${x + 6} ${y - 4}Q${x + 1} ${y - 1} ${x + 4} ${y + 1}Q${x} ${y + 1} ${x - 6} ${y + 4}Z`, amber, k.ink, 0.5);
    if (k.back) backPanel(k, "#1f4f6e", k.lume("pulse", wing(k.C, k.T + 14), 0, amber) +
      k.path(`M${k.C - 6} ${k.T}Q${k.C - 18} ${k.T + 20} ${k.C - 30} ${k.T + 26}L${k.C - 26} ${k.T + 30}Q${k.C - 12} ${k.T + 24} ${k.C + 2} ${k.T + 4}Z`, "#e8322a"));
    else {
      suit(k, "#1f4f6e", amber, wing);
      const s = k.side ? -k.side : -1;
      k.put("body", k.path(`M${k.C + s * 4} ${k.T}Q${k.C + s * 22} ${k.T + 2} ${k.C + s * 38} ${k.T + 14}L${k.C + s * 36} ${k.T + 19}Q${k.C + s * 20} ${k.T + 8} ${k.C + s * 2} ${k.T + 6}Z`, "#e8322a", k.ink, 0.8), true);
    }
    if (!k.back) {
      // The lens sits over the near eye.
      const ex = k.side ? k.hx + k.side * 22 : k.hx + 22,
        ey = k.ht + 40;
      k.put("flame", k.line(`M${k.hx - 48} ${ey - 8}Q${k.hx} ${ey - 18} ${ex} ${ey - 10}`, "#2a2a36", 2) +
        `<circle cx="${ex}" cy="${ey}" r="13" fill="#ffb3471a" stroke="#2a2a36" stroke-width="2.4"/>` +
        k.lume("pulse", k.line(`M${ex - 8} ${ey}H${ex - 3}M${ex + 3} ${ey}H${ex + 8}M${ex} ${ey - 8}V${ey - 3}M${ex} ${ey + 3}V${ey + 8}`, amber, 1.2), 1, amber));
    }
  },
  // Moon Blink: a crescent moon between the ears and a belt of moon phases
  // lit one after another.
  astrabun(k) {
    const moon = "#fff3a8";
    const crescent = (x: number, y: number) => k.path(crescentD(x, y, 6), moon, k.ink, 0.5);
    const phases = [0, 1, 2, 3, 4].map((i) => k.lume("chase", k.circle(k.L + 5 + i * (k.R - k.L - 10) / 4, k.B - 8.5, 1.6, moon, k.ink, 0.3), i, moon)).join("");
    cape(k, "#2a2f6e", moon);
    if (!k.back) suit(k, "#3b3f8c", moon, crescent, phases);
    const x = k.hx + k.side * 4,
      y = k.ht - 14;
    k.put("flame", k.lume("pulse", k.path(crescentD(x, y, 14), moon, k.ink, 0.9), 1, moon) +
      band(k, k.ht + 18, k.side ? 40 : 46, "#3b3f8c", 5));
  },
  // Bulldozer: a hard-hat helmet with a headlamp, a boulder emblem and a
  // belt of hazard stripes running in light.
  wombolder(k) {
    const yellow = "#ffd84a";
    const boulder = (x: number, y: number) => k.path(`M${x - 6} ${y + 4}Q${x - 7} ${y - 4} ${x - 1} ${y - 6}Q${x + 7} ${y - 6} ${x + 6} ${y + 3}Q${x} ${y + 7} ${x - 6} ${y + 4}Z`, "#8a8a96", k.ink, 0.5);
    const hazard = [0, 1, 2, 3, 4, 5].map((i) => k.lume("chase", k.path(`M${k.L + i * (k.R - k.L) / 6} ${k.B - 6}l4 -5h3l-4 5Z`, yellow, "none"), i, yellow)).join("");
    if (k.back) backPanel(k, "#4a4a5a", hazard);
    else suit(k, "#4a4a5a", yellow, boulder, hazard);
    // The helmet and its lamp, up on the head, clear of the eyes.
    const x = k.hx + k.side * 2,
      y = k.ht + 9;
    const w = k.side ? 42 : 48;
    k.put("flame", k.path(`M${x - w} ${y + 2}Q${x - w} ${k.ht - 19} ${x} ${k.ht - 19}Q${x + w} ${k.ht - 19} ${x + w} ${y + 2}Q${x} ${y - 4} ${x - w} ${y + 2}Z`, yellow) +
      k.line(`M${x} ${k.ht - 19}V${y - 4}`, "#e0b830", 3) + k.path(`M${x - w - 4} ${y + 3}Q${x} ${y - 4} ${x + w + 4} ${y + 3}L${x + w + 2} ${y + 7}Q${x} ${y} ${x - w - 2} ${y + 7}Z`, "#e0b830") +
      (k.back ? "" : k.circle(x + k.side * 14, y - 8, 5, "#2a2a36") + k.lume("pulse", k.circle(x + k.side * 14, y - 8, 3.4, "#fff6c9", "none", 0), 1, "#fff6c9")));
  },
  // Inkshade: a stealth suit with an ink-drop emblem, a ninja headband whose
  // tails stream behind, and smoke pellets on the belt.
  shadopus(k) {
    const magenta = "#ff4fd8";
    const drop = (x: number, y: number) => k.path(`M${x} ${y - 7}C${x + 5} ${y - 1} ${x + 5} ${y + 5} ${x} ${y + 5}C${x - 5} ${y + 5} ${x - 5} ${y - 1} ${x} ${y - 7}Z`, magenta, k.ink, 0.5);
    const pellets = [0, 1, 2].map((i) => k.circle(k.L + 6 + i * 5, k.B - 8.5, 1.8, "#3a2c6e", "#c9a3e7", 0.5)).join("");
    if (k.back) backPanel(k, "#1b1438", k.lume("pulse", drop(k.C, k.T + 14), 0, magenta));
    else suit(k, "#1b1438", magenta, drop, pellets);
    const x = k.hx + k.side * 2,
      y = k.ht + 26;
    const s = k.side ? -k.side : 1;
    k.put("flame", band(k, y, k.side ? 46 : 52, "#2a1f44", 7) +
      k.lume("pulse", k.line(`M${x - (k.side ? 44 : 50)} ${y + 5}Q${x} ${y - 5} ${x + (k.side ? 44 : 50)} ${y + 5}`, magenta, 1), 1, magenta) +
      k.path(`M${x + s * 46} ${y + 2}Q${x + s * 62} ${y + 4} ${x + s * 70} ${y + 14}L${x + s * 66} ${y + 17}Q${x + s * 58} ${y + 10} ${x + s * 46} ${y + 9}Z`, "#2a1f44"));
  },
  // Leaf Ranger: leaf armour with glowing veins, a leaf emblem and a crown of
  // leaves where the sprout was, its veins lit.
  pangrove(k) {
    const vein = "#b6ff4f";
    const leafD = (x: number, y: number) => k.path(`M${x - 5} ${y + 5}Q${x - 6} ${y - 4} ${x + 5} ${y - 6}Q${x + 4} ${y + 5} ${x - 5} ${y + 5}Z`, "#3f8a4f", k.ink, 0.5) +
      k.line(`M${x - 4} ${y + 4}L${x + 4} ${y - 5}`, vein, 0.8);
    const plates = [0, 1].map((r) => [-1, 0, 1].map((q) => k.path(`M${cx(k) + q * 11 - 5} ${k.T + 22 + r * 7}q5 -6 10 0`, "none", "#2f6a3a", 1.4)).join("")).join("");
    if (k.back) backPanel(k, "#2f6a3a", k.lume("pulse", leafD(k.C, k.T + 14), 0, vein));
    else suit(k, "#4f8a3f", vein, leafD, plates);
    const x = k.hx + k.side * 2,
      y = k.ht + 6;
    const n = k.side ? 3 : 5;
    k.put("flame", Array.from({ length: n }, (_, i) => {
      const u = i / (n - 1);
      const a = -Math.PI / 2 + (u - 0.5) * (k.side ? 1.2 : 1.8);
      const lx = x + Math.cos(a) * 18,
        ly = y + 6 + Math.sin(a) * 14;
      const tx = lx + Math.cos(a) * 14,
        ty = ly + Math.sin(a) * 14;
      return k.path(`M${lx} ${ly}Q${(lx + tx) / 2 - 5} ${(ly + ty) / 2} ${tx} ${ty}Q${(lx + tx) / 2 + 5} ${(ly + ty) / 2} ${lx} ${ly}Z`, "#3f8a4f", k.ink, 0.6) +
        k.lume("chase", k.line(`M${lx} ${ly}L${tx} ${ty}`, vein, 0.9), i, vein);
    }).join("") + band(k, y + 6, k.side ? 38 : 44, "#2f6a3a", 5));
  },
  // Chrono Keeper: a clock emblem whose hand sweeps in light, a pocket-watch
  // chain on the belt and a gear halo where the sprout was.
  mossloth(k) {
    const brass = "#e6c46a";
    const clock = (x: number, y: number) => k.circle(x, y, 6.5, "#fff6e0", k.ink, 0.6) +
      [0, 1, 2, 3].map((i) => k.lume("chase", k.line(`M${x} ${y}L${x + Math.cos((i * Math.PI) / 2 - Math.PI / 2) * 5} ${y + Math.sin((i * Math.PI) / 2 - Math.PI / 2) * 5}`, "#3a7a5a", 1.2), i, brass)).join("");
    const chain = k.path(`M${k.L + 4} ${k.B - 8}Q${k.L + 10} ${k.B - 2} ${k.L + 16} ${k.B - 8}`, "none", brass, 0.9) + k.circle(k.L + 4, k.B - 6, 2.4, brass, k.ink, 0.4);
    cape(k, "#5a6e3a", brass);
    if (!k.back) suit(k, "#3a5a3a", brass, clock, chain);
    const x = k.hx + k.side * 2,
      y = k.ht - 8;
    const teeth = Array.from({ length: 10 }, (_, i) => {
      const a = (i / 10) * Math.PI * 2;
      return `M${x + Math.cos(a) * 16} ${y + Math.sin(a) * 8}L${x + Math.cos(a) * 21} ${y + Math.sin(a) * 10.5}`;
    }).join("");
    k.put("flame", `<ellipse cx="${x}" cy="${y}" rx="16" ry="8" fill="none" stroke="${brass}" stroke-width="2.8"/>` +
      k.lume("pulse", k.line(teeth, brass, 2), 1, brass));
  },
};

Object.assign((DESIGNS.hero ??= {}), HERO);

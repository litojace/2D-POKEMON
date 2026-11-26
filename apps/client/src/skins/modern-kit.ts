import type { CharacterId } from "@arena/shared";
import { DESIGNS, backUnder, hatShape, torso, type Design, type Kit } from "./modern-designs";

/**
 * The champions' own Epics that were a recolour and a pattern alone (Neon
 * Arcade, Glacier, Stained Glass, Aurora, Clockwork, Geode, Candlelight,
 * Tesla Coil, Fireside Knit, Deep Glow, Paper Crane) now wear a costume of
 * their theme too: a tailored garment (Epic cloth, modern-designs.ts) and a
 * headpiece or prop, with a lit piece in Epic's own language (lume). The
 * skin's colours, pattern, trail and small detail are kept.
 */
const cx = (k: Kit) => k.C + k.side * 3;
const poly = (pts: number[][]) => "M" + pts.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join("L") + "Z";
/** A gear of n teeth, radius r. */
const gearD = (x: number, y: number, r: number, n = 8) => {
  let d = "";
  for (let i = 0; i < n * 4; i++) {
    const a = (i * Math.PI) / (n * 2);
    const rr = i % 4 < 2 ? r : r * 0.74;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + "Z";
};
/** A crystal shard standing at (x, y), h tall, leaning by `lean`. */
const shard = (x: number, y: number, w: number, h: number, lean = 0) =>
  poly([[x - w, y], [x - w * 0.7 + lean * 0.5, y - h * 0.7], [x + lean, y - h], [x + w * 0.7 + lean * 0.5, y - h * 0.7], [x + w, y]]);

export const KIT: Partial<Record<CharacterId, Design>> = {
  // Neon Arcade: a synthwave bomber jacket, its collar and cuffs in neon
  // magenta, cyan piping lit down the front, a pixel heart pin and, behind,
  // a striped sunset over a neon grid. Its own goggles stay.
  voltkit(k) {
    const jacket = "#1c1638",
      pink = "#ff4fd8",
      cyan = "#59f0ff";
    if (k.back) {
      const y = k.T + 20;
      const sun = `M${k.C - 13} ${y}A13 13 0 0 1 ${k.C + 13} ${y}Z`;
      backUnder(k, jacket,
        k.lume("pulse", k.path(sun, pink, "none", 0) + [3, 7, 10].map((dy) => k.rect(k.C - 14, y - dy, 28, 1.3, 0, jacket, "none", 0)).join(""), 0, pink) +
          k.lume("pulse", k.line(`M${k.C - 16} ${y + 3}H${k.C + 16}M${k.C - 16} ${y + 7}H${k.C + 16}M${k.C - 16} ${y + 12}H${k.C + 16}` + [-12, -6, 0, 6, 12].map((dx) => `M${k.C + dx * 0.6} ${y}L${k.C + dx * 1.4} ${y + 13}`).join(""), cyan, 0.8), 1, cyan) +
          k.rect(k.C - k.W - 2, k.B - 4, 2 * k.W + 4, 5, 0, pink, k.ink, 0.8));
    } else {
      const c = cx(k);
      const heart = (x: number, y: number) =>
        [[-2, -2], [1, -2], [-3, -1], [-2, -1], [-1, -1], [0, -1], [1, -1], [2, -1], [-2, 0], [-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1]]
          .map(([dx, dy]) => k.rect(x + dx * 1.3, y + dy * 1.3, 1.3, 1.3, 0, pink, "none", 0))
          .join("");
      k.put("body", torso(k, jacket,
        // Neon piping down each side of the zip, the zip itself, ribbed hem.
        (k.side ? "" : k.line(`M${c} ${k.T + 2}V${k.B}`, "#c8c8d8", 1.2)) +
          k.lume("chase", k.line(`M${c - (k.side ? -k.side * 6 : 4)} ${k.T + 4}V${k.B - 6}`, cyan, 1.2), 0, cyan) +
          (k.side ? "" : k.lume("chase", k.line(`M${c + 4} ${k.T + 4}V${k.B - 6}`, cyan, 1.2), 1, cyan)) +
          k.rect(k.L - 2, k.B - 6, k.R - k.L + 4, 7, 0, pink, k.ink, 0.8) +
          k.line(`M${k.L} ${k.B - 3}H${k.R}`, "#ffffff88", 0.8) +
          k.lume("pulse", heart(c + (k.side ? k.side * 8 : -11), k.T + 13), 2, pink)));
      // A ribbed neon collar standing round the neck.
      k.put("body", k.path(`M${c - 15} ${k.T - 1}Q${c} ${k.T + 7} ${c + 15} ${k.T - 1}L${c + 13} ${k.T - 6}Q${c} ${k.T + 1} ${c - 13} ${k.T - 6}Z`, pink) +
        k.line([-8, -4, 0, 4, 8].map((dx) => `M${c + dx} ${k.T - 3 + Math.abs(dx) * -0.2}v3`).join(""), "#ffffff66", 0.8));
    }
  },
  // Glacier: a breastplate cut from faceted ice with crystal pauldrons, and
  // a tiara of three ice spikes whose points glint.
  tidefin(k) {
    const ice = "#bfe8ff",
      deep = "#6fb6e0",
      white = "#ffffff";
    const facets = (x0: number, y0: number, w: number, h: number) =>
      k.line(`M${x0} ${y0 + h * 0.3}L${x0 + w * 0.35} ${y0 + h * 0.55}L${x0 + w * 0.6} ${y0 + h * 0.2}L${x0 + w} ${y0 + h * 0.5}M${x0 + w * 0.35} ${y0 + h * 0.55}L${x0 + w * 0.3} ${y0 + h}M${x0 + w * 0.6} ${y0 + h * 0.2}L${x0 + w * 0.75} ${y0 + h}`, white, 0.9);
    if (k.back) {
      backUnder(k, ice, facets(k.C - k.W, k.T + 2, 2 * k.W, k.B - k.T) +
        // A ridge of crystals down the spine.
        [0, 1, 2].map((i) => k.path(shard(k.C, k.T + 12 + i * 10, 4 - i * 0.6, 9 - i * 1.5), i % 2 ? ice : "#e6f6ff", k.ink, 0.8)).join("") +
        k.lume("twinkle", k.path(k.star(k.C, k.T + 4, 2, 4, 0.3), white, "none", 0), 0, white));
    } else {
      const c = cx(k);
      k.put("body", torso(k, ice, facets(k.L, k.T, k.R - k.L, k.B - k.T) +
        k.path(poly([[c - 9, k.T + 6], [c, k.T + 2], [c + 9, k.T + 6], [c + 6, k.T + 20], [c, k.T + 24], [c - 6, k.T + 20]]), deep, k.ink, 0.8) +
        k.line(`M${c} ${k.T + 2}V${k.T + 24}M${c - 9} ${k.T + 6}L${c} ${k.T + 12}L${c + 9} ${k.T + 6}`, white, 0.8) +
        k.lume("twinkle", k.path(k.star(c - 3, k.T + 9, 1.8, 4, 0.3), white, "none", 0), 1, white)));
      // Crystal pauldrons: a cluster of shards on each shoulder.
      const pad = (s: number) => {
        const x = k.C + s * (k.W + 1),
          y = k.T + 6;
        return k.path(shard(x, y, 6, 14, s * 4), ice, k.ink, 0.9) + k.path(shard(x + s * 6, y + 2, 4, 9, s * 4), "#e6f6ff", k.ink, 0.8) + k.line(`M${x} ${y}L${x + s * 4} ${y - 13}`, white, 0.8);
      };
      k.put("body", k.side ? pad(-k.side) : pad(-1) + pad(1));
    }
    // The tiara: a band and three spikes, the middle one tallest.
    const x = k.hx + k.side * 2,
      y = k.ht + 10,
      w = k.side ? 26 : 32;
    const spikes = (k.side ? [0] : [-14, 0, 14]).map((dx, i, a) => k.path(shard(x + dx + k.side * 6, y, a.length > 1 && i !== 1 ? 5.5 : 7, a.length > 1 && i !== 1 ? 18 : 28), i === 1 || a.length === 1 ? "#e6f6ff" : ice, k.ink, 0.9)).join("");
    k.put("flame", spikes +
      k.path(`M${x - w} ${y + 2}Q${x} ${y - 6} ${x + w} ${y + 2}L${x + w} ${y + 6}Q${x} ${y - 2} ${x - w} ${y + 6}Z`, deep) +
      (k.back ? "" : k.lume("twinkle", k.path(k.star(x + k.side * 6, y - (k.side ? 26 : 25), 2.6, 4, 0.3), white, "none", 0), 2, white)));
  },
  // Stained Glass: a tabard of leaded glass in red, blue, gold and green
  // round a rose window that lets the light through, and a little
  // rose-window medallion between the ears.
  auralynx(k) {
    const lead = "#262434",
      glass = ["#e0403a", "#3a6ae0", "#f2c14e", "#3ab07a"];
    const panes = (x0: number, y0: number, w: number, h: number, cols: number, rows: number) => {
      let s = "";
      for (let r = 0; r < rows; r++)
        for (let q = 0; q < cols; q++)
          s += k.rect(x0 + (q * w) / cols, y0 + (r * h) / rows, w / cols, h / rows, 0, glass[(q + r * 3) % 4], lead, 1.4);
      return s;
    };
    const rose = (x: number, y: number, r: number) =>
      k.circle(x, y, r, "#f6e6b0", lead, 1.4) +
      [0, 1, 2, 3, 4, 5].map((i) => {
        const a = (i * Math.PI) / 3;
        return k.circle(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55, r * 0.32, glass[i % 4], lead, 0.8);
      }).join("") +
      k.circle(x, y, r * 0.28, "#fff6d0", lead, 0.8);
    if (k.back) {
      const top = k.T + 4;
      backUnder(k, lead, panes(k.C - k.W, top + 8, 2 * k.W, k.B - top - 6, 4, 3) +
        // A pointed arch window over them.
        k.path(`M${k.C - 12} ${top + 22}V${top + 10}Q${k.C - 12} ${top} ${k.C} ${top - 3}Q${k.C + 12} ${top} ${k.C + 12} ${top + 10}V${top + 22}Z`, "#f6e6b0", lead, 1.4) +
        k.lume("pulse", rose(k.C, top + 11, 7), 0, "#fff3b0"));
    } else {
      const c = cx(k);
      k.put("body", torso(k, lead, panes(k.L - 2, k.T - 2, k.R - k.L + 4, k.B - k.T + 6, k.side ? 3 : 4, 3) +
        k.lume("pulse", rose(c, k.T + 13, k.side ? 7 : 8.5), 0, "#fff3b0")));
    }
    if (!k.back) {
      const x = k.hx + k.side * 4,
        y = k.ht + 6;
      k.put("flame", k.path(`M${x - 20} ${y + 4}Q${x} ${y - 4} ${x + 20} ${y + 4}`, "none", lead, 2.6) + k.lume("pulse", rose(x, y - 1, 6), 1, "#fff3b0"));
    }
  },
  // Aurora: a night-blue robe with curtains of northern light rippling
  // across it, and a crescent hairpin with a star between the antennae.
  lumoth(k) {
    const night = "#18264a",
      lights = ["#6affc0", "#4ad8ff", "#b48aff"];
    const curtain = (x0: number, x1: number, y: number, i: number) =>
      k.lume("chase", k.path(`M${x0} ${y}Q${(x0 * 3 + x1) / 4} ${y - 5} ${(x0 + x1) / 2} ${y}T${x1} ${y}`, "none", lights[i % 3], 2), i, lights[i % 3]);
    if (k.back) {
      backUnder(k, night, [0, 1, 2].map((i) => curtain(k.C - k.W, k.C + k.W, k.T + 9 + i * 7, i)).join("") +
        [0, 1, 2, 3].map((i) => k.lume("twinkle", k.path(k.star(k.C - k.W + 8 + i * (k.W - 6) * 0.65, k.B - 4 - (i % 2) * 4, 1.5, 4, 0.35), "#ffffff", "none", 0), i, "#ffffff")).join(""));
    } else {
      const c = cx(k);
      k.put("body", torso(k, night, [0, 1, 2].map((i) => curtain(k.L, k.R, k.T + 14 + i * 6, i)).join("") +
        // A shawl collar crossing at the chest.
        (k.side
          ? k.path(`M${c - k.side * 4} ${k.T - 1}L${c + k.side * 9} ${k.T + 14}L${c + k.side * 3} ${k.T + 16}Z`, "#2c3c6a", k.ink, 0.8)
          : k.path(`M${c - 12} ${k.T - 1}L${c + 3} ${k.T + 16}L${c - 2} ${k.T + 18}L${c - 15} ${k.T + 6}Z M${c + 12} ${k.T - 1}L${c - 3} ${k.T + 16}L${c + 2} ${k.T + 18}L${c + 15} ${k.T + 6}Z`, "#2c3c6a", k.ink, 0.8))));
    }
    // The crescent hairpin and its star.
    const x = k.side ? k.hx - k.side * 16 : k.back ? k.hx - 30 : k.hx + 30,
      y = k.ht + 18;
    const r = 9,
      px = x + r * 0.5,
      py = r * 0.866;
    k.put("flame", k.path(`M${px} ${y - py}A${r} ${r} 0 1 0 ${px} ${y + py}A${r * 0.78} ${r * 0.78} 0 0 1 ${px} ${y - py}Z`, "#ffe27a") +
      (k.back ? "" : k.lume("twinkle", k.path(k.star(x + 5, y - 1, 3.4, 4, 0.35), "#ffffff", "#c8b0ff", 0.5), 0, "#ffffff")));
  },
  // Clockwork: a burgundy waistcoat with gear buttons over a shirt and
  // cravat, a pocket watch on its chain whose face is lit, and a little top
  // hat banded with turning brass.
  mystowl(k) {
    const coat = "#7a2e3a",
      brass = "#e0b24a",
      shirt = "#f7f1e1";
    if (k.back) {
      backUnder(k, coat, k.rect(k.C - k.W, k.T + 22, 2 * k.W, 5, 0, "#4a1c24", k.ink, 0.8) +
        k.rect(k.C - 3.5, k.T + 21, 7, 7, 1, brass, k.ink, 0.6) +
        k.path(gearD(k.C, k.T + 11, 6), "#9a3e4a", "#4a1c24", 0.9) + k.circle(k.C, k.T + 11, 2, "#4a1c24", "none", 0));
    } else {
      const c = cx(k);
      const wx = c + (k.side ? k.side * 9 : 12),
        wy = k.B - 9;
      k.put("body", torso(k, coat,
        (k.side
          ? k.path(`M${c - k.side * 2} ${k.T - 1}L${c + k.side * 9} ${k.T - 1}L${c + k.side * 4} ${k.T + 14}Z`, shirt, k.ink, 0.8)
          : k.path(`M${c - 11} ${k.T - 1}L${c} ${k.T + 18}L${c + 11} ${k.T - 1}Z`, shirt, k.ink, 0.8) +
            k.path(`M${c - 4} ${k.T + 1}Q${c} ${k.T + 4} ${c + 4} ${k.T + 1}L${c + 2} ${k.T + 9}L${c} ${k.T + 12}L${c - 2} ${k.T + 9}Z`, "#3a5ab0", k.ink, 0.6)) +
          // Gear buttons down the front.
          [0, 1, 2].map((i) => k.path(gearD(c + (k.side ? k.side * 5 : 0), k.T + 20 + i * 6, 2.2, 6), brass, k.ink, 0.5)).join("") +
          // The watch chain and the watch, its face lit.
          k.line(`M${c + (k.side ? k.side * 5 : 0)} ${k.T + 26}Q${(c + wx) / 2} ${wy + 2} ${wx} ${wy - 4}`, brass, 1) +
          k.circle(wx, wy, 4.4, brass, k.ink, 0.7) +
          k.lume("pulse", k.circle(wx, wy, 3.1, "#fff3c4", "none", 0), 0, "#fff3c4") +
          k.line(`M${wx} ${wy}V${wy - 2.4}M${wx} ${wy}h1.8`, "#4a1c24", 0.7)));
    }
    // The top hat, with a gear on its band.
    const y = k.ht + 8;
    const hx = k.hx + k.side * 2;
    k.put("flame", hatShape(k, 19, 26, y, "#2a1c24", "#2a1c24", 1.45) +
      k.rect(hx - (k.side ? 12.5 : 11.5), y - 8, k.side ? 25 : 23, 5, 0, coat, k.ink, 0.6) +
      (k.back ? "" : k.path(gearD(hx + (k.side ? k.side * 7 : 7), y - 5.5, 4.6, 7), brass, k.ink, 0.6) + k.circle(hx + (k.side ? k.side * 7 : 7), y - 5.5, 1.5, "#2a1c24", "none", 0)));
  },
  // Geode: a breastplate split open on a hollow of amethyst crystals that
  // glow, amethyst clusters on the shoulders and, from behind, a geode
  // bursting through its shell. Its sprout stays.
  terradon(k) {
    const rock = "#5a5262",
      rim = "#8a7e94",
      ame = "#b86bff",
      pale = "#e6c8ff";
    const cluster = (x: number, y: number, s: number) =>
      k.path(shard(x - 4 * s, y, 3 * s, 9 * s, -2 * s), ame, k.ink, 0.8) +
      k.path(shard(x + 3 * s, y, 3 * s, 8 * s, 2 * s), ame, k.ink, 0.8) +
      k.path(shard(x, y, 3.6 * s, 13 * s), pale, k.ink, 0.8);
    if (k.back) {
      k.put("scarf", k.path(`M${k.C - 15} ${k.T + 22}Q${k.C} ${k.T + 2} ${k.C + 15} ${k.T + 22}Q${k.C} ${k.T + 30} ${k.C - 15} ${k.T + 22}Z`, rock) +
        k.path(`M${k.C - 11} ${k.T + 22}Q${k.C} ${k.T + 8} ${k.C + 11} ${k.T + 22}Q${k.C} ${k.T + 27} ${k.C - 11} ${k.T + 22}Z`, "#3a2a4a", "none", 0) +
        k.lume("pulse", cluster(k.C, k.T + 23, 1.1), 0, ame));
    } else {
      const c = cx(k),
        w = k.side ? 9 : 13;
      k.put("body", torso(k, rock,
        k.line(`M${k.L} ${k.T + 8}L${k.L + 8} ${k.T + 12}M${k.R} ${k.B - 6}L${k.R - 7} ${k.B - 12}`, "#3e3846", 1) +
          k.path(`M${c - w} ${k.T + 10}Q${c - w} ${k.T + 2} ${c} ${k.T + 1}Q${c + w} ${k.T + 2} ${c + w} ${k.T + 10}Q${c + w} ${k.T + 22} ${c} ${k.T + 24}Q${c - w} ${k.T + 22} ${c - w} ${k.T + 10}Z`, rim, k.ink, 0.9) +
          k.path(`M${c - w + 3} ${k.T + 10}Q${c - w + 3} ${k.T + 5} ${c} ${k.T + 4}Q${c + w - 3} ${k.T + 5} ${c + w - 3} ${k.T + 10}Q${c + w - 3} ${k.T + 19} ${c} ${k.T + 21}Q${c - w + 3} ${k.T + 19} ${c - w + 3} ${k.T + 10}Z`, "#3a2a4a", "none", 0) +
          k.lume("pulse", cluster(c, k.T + 19, k.side ? 0.8 : 1), 0, ame)));
      k.put("body", k.side ? cluster(k.C - k.side * (k.W - 2), k.T + 4, 0.8) : cluster(k.C - k.W + 1, k.T + 4, 0.8) + cluster(k.C + k.W - 1, k.T + 4, 0.8));
    }
  },
  // Candlelight: a capelet of poured wax, dripping at its hem, fastened
  // with a brass candleholder whose candle burns on the shoulder.
  duskveil(k) {
    const wax = "#f4ead0",
      seal = "#9a2e3a",
      brass = "#d8a84a";
    const drips = (x0: number, x1: number, y: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const x = x0 + ((i + 0.5) * (x1 - x0)) / 6,
          h = 4 + ((i * 7) % 5);
        return k.path(`M${x - 2.6} ${y - 1}Q${x - 2.6} ${y + h} ${x} ${y + h + 1}Q${x + 2.6} ${y + h} ${x + 2.6} ${y - 1}Z`, wax, k.ink, 0.7);
      }).join("");
    const capelet = (x0: number, x1: number, y0: number, y1: number) =>
      k.path(`M${x0 + 4} ${y0}Q${(x0 + x1) / 2} ${y0 - 5} ${x1 - 4} ${y0}L${x1 + 2} ${y1}Q${(x0 + x1) / 2} ${y1 + 3} ${x0 - 2} ${y1}Z`, seal) +
      k.path(`M${x0 + 1} ${y1 - 4}Q${(x0 + x1) / 2} ${y1 - 1} ${x1 - 1} ${y1 - 4}L${x1 + 2} ${y1}Q${(x0 + x1) / 2} ${y1 + 3} ${x0 - 2} ${y1}Z`, wax, k.ink, 0.7) +
      drips(x0, x1, y1 + 1);
    const candle = (x: number, y: number) =>
      k.path(`M${x - 5} ${y}h10l-1.5 3h-7Z`, brass, k.ink, 0.7) +
      k.rect(x - 2.6, y - 11, 5.2, 11, 1, "#fff8e6", k.ink, 0.7) +
      k.line(`M${x} ${y - 11}v-2`, "#3a2a1a", 0.8) +
      k.lume("pulse", k.path(`M${x} ${y - 19}Q${x + 3.4} ${y - 14} ${x} ${y - 12.5}Q${x - 3.4} ${y - 14} ${x} ${y - 19}Z`, "#ffc94a", "none", 0), 0, "#ffc94a");
    if (k.back) k.put("scarf", capelet(k.C - k.W, k.C + k.W, k.T - 2, k.T + 18));
    else {
      k.put("body", capelet(k.L, k.R, k.T - 2, k.T + (k.side ? 14 : 16)) +
        k.circle(cx(k), k.T + 3, 3.4, brass, k.ink, 0.7) + k.circle(cx(k), k.T + 3, 1.3, "#fff3c4", "none", 0));
      const s = k.side ? -k.side : 1;
      const x = k.C + s * (k.W - 3),
        y = k.T - 1;
      k.put("body", `<g transform="translate(${x} ${y}) scale(1.35) translate(${-x} ${-y})">${candle(x, y)}</g>`);
    }
  },
  // Tesla Coil: a gunmetal tech harness with circuit traces lit in a run, a
  // coil node at the chest and, on the back, a copper-wound tesla coil
  // whose crown glows and sparks.
  coilemur(k) {
    const metal = "#3a4048",
      strap = "#1e2228",
      teal = "#4af0e0",
      copper = "#d07a3a";
    if (k.back) {
      const x = k.C,
        y0 = k.T - 18,
        y1 = k.T + 22;
      backUnder(k, metal, k.lume("chase", k.line(`M${k.C - k.W + 4} ${k.B - 4}V${k.B - 12}H${k.C - 8}`, teal, 1), 0, teal) +
        k.lume("chase", k.line(`M${k.C + k.W - 4} ${k.B - 4}V${k.B - 14}H${k.C + 8}`, teal, 1), 1, teal));
      k.put("scarf", k.rect(x - 6, y0, 12, y1 - y0, 2, copper) +
        k.line(Array.from({ length: 9 }, (_, i) => `M${x - 6} ${y0 + 3 + i * 4}H${x + 6}`).join(""), "#8a4a20", 1) +
        k.rect(x - 9, y1 - 2, 18, 6, 2, strap) +
        k.path(`M${x - 11} ${y0 - 2}Q${x} ${y0 - 9} ${x + 11} ${y0 - 2}Q${x} ${y0 + 5} ${x - 11} ${y0 - 2}Z`, "#c8d0d8") +
        k.lume("pulse", k.path(`M${x - 8} ${y0 - 2}Q${x} ${y0 - 6} ${x + 8} ${y0 - 2}Q${x} ${y0 + 2} ${x - 8} ${y0 - 2}Z`, teal, "none", 0), 2, teal) +
        k.lume("blink", k.line(`M${x + 10} ${y0 - 4}l5 -4l-2 4l5 -3`, "#e6fffb", 1.2), 3, teal));
    } else {
      const c = cx(k);
      k.put("body", torso(k, metal,
        k.line(`M${k.L} ${k.T + 2}L${c} ${k.T + 14}L${k.R} ${k.T + 2}`, strap, 3.4) +
          k.lume("chase", k.line(`M${k.L + 3} ${k.B - 4}V${k.B - 12}H${c - 6}`, teal, 1), 0, teal) +
          k.lume("chase", k.line(`M${k.R - 3} ${k.B - 4}V${k.B - 14}H${c + 6}V${k.T + 20}`, teal, 1), 1, teal) +
          k.circle(c, k.T + 14, 5.5, copper, k.ink, 0.8) +
          k.circle(c, k.T + 14, 3.8, "none", "#8a4a20", 1) +
          k.lume("pulse", k.circle(c, k.T + 14, 2.2, teal, "none", 0), 2, teal)));
    }
  },
  // Fireside Knit: a chunky cable-knit scarf in cream and cocoa stripes
  // wrapped round the neck, its fringed tails hanging, and a knitted beanie
  // with a pompom.
  pyranda(k) {
    const cream = "#f4e6cc",
      cocoa = "#8a4a2a";
    const stripes = (x0: number, x1: number, y: number) =>
      k.line([0.25, 0.5, 0.75].map((t) => `M${x0 + (x1 - x0) * t} ${y - 4}v8`).join(""), cocoa, 2);
    const fringe = (x: number, y: number) => k.line([-3, -1, 1, 3].map((dx) => `M${x + dx} ${y}v4`).join(""), cream, 1.2);
    const wrap = (c: number) =>
      k.path(`M${c - 19} ${k.T - 6}Q${c} ${k.T + 4} ${c + 19} ${k.T - 6}L${c + 20} ${k.T + 2}Q${c} ${k.T + 12} ${c - 20} ${k.T + 2}Z`, cream) +
      stripes(c - 19, c + 19, k.T + 1) +
      k.line(`M${c - 18} ${k.T - 2}Q${c} ${k.T + 7} ${c + 18} ${k.T - 2}`, "#d8c4a4", 0.8);
    if (k.back) {
      k.put("scarf", wrap(k.C) +
        k.path(`M${k.C + 4} ${k.T + 4}l-3 22h9l2 -22Z`, cream) + k.line(`M${k.C + 2.5} ${k.T + 12}h8M${k.C + 2} ${k.T + 18}h8`, cocoa, 2) + fringe(k.C + 6, k.T + 26));
    } else {
      const c = cx(k),
        tx = c + (k.side ? k.side * 6 : 8);
      k.put("body", wrap(c) +
        k.path(`M${tx - 4} ${k.T + 5}l-2 24h9l1 -24Z`, cream) + k.line(`M${tx - 5} ${k.T + 13}h9M${tx - 5.5} ${k.T + 20}h9`, cocoa, 2) + fringe(tx, k.T + 29));
    }
    // The beanie: ribbed brim, a cocoa crown with a cream band, a pompom.
    const x = k.hx + k.side * 2,
      y = k.ht + 8,
      w = k.side ? 20 : 24;
    k.put("flame", k.path(`M${x - w} ${y}Q${x - w} ${y - 22} ${x} ${y - 23}Q${x + w} ${y - 22} ${x + w} ${y}Z`, cocoa) +
      k.line(`M${x - w + 6} ${y - 12}Q${x} ${y - 16} ${x + w - 6} ${y - 12}`, cream, 2) +
      k.path(`M${x - w - 2} ${y - 4}Q${x} ${y - 8} ${x + w + 2} ${y - 4}L${x + w + 2} ${y + 4}Q${x} ${y} ${x - w - 2} ${y + 4}Z`, cream) +
      k.line(Array.from({ length: 7 }, (_, i) => `M${x - w + 2 + (i * (2 * w - 4)) / 6} ${y - 4}v6`).join(""), "#d8c4a4", 1) +
      k.circle(x - k.side * 2, y - 25, 6, cream));
  },
  // Deep Glow: a frilled collar and a bell cape of living jelly, dotted
  // with lights that twinkle, its tendrils trailing, and a little jellyfish
  // pinned at the side of the head.
  glacelle(k) {
    const jelly = "#ff6fae",
      dots = ["#59f0ff", "#ff9ad0", "#c8ffef"];
    const twinkles = (pts: number[][]) => pts.map(([x, y], i) => k.lume("twinkle", k.circle(x, y, 1.3, dots[i % 3], "none", 0), i, dots[i % 3])).join("");
    if (k.back) {
      const y0 = k.T - 4,
        y1 = k.B - 2;
      k.put("scarf", k.path(`M${k.C - k.W - 4} ${y1}Q${k.C - k.W - 6} ${y0} ${k.C} ${y0 - 2}Q${k.C + k.W + 6} ${y0} ${k.C + k.W + 4} ${y1}Q${k.C} ${y1 - 6} ${k.C - k.W - 4} ${y1}Z`, jelly + "88") +
        k.line(Array.from({ length: 6 }, (_, i) => {
          const x = k.C - k.W + (i * 2 * k.W) / 5;
          return `M${x} ${y1 - 3}q-3 6 0 10q3 4 0 8`;
        }).join(""), jelly, 1.1) +
        twinkles([[k.C - 10, y0 + 10], [k.C + 8, y0 + 8], [k.C, y0 + 18], [k.C - 16, y0 + 22], [k.C + 15, y0 + 21]]));
    } else {
      const c = cx(k);
      const w = k.side ? 17 : 26;
      const frill = Array.from({ length: 7 }, (_, i) => {
        const x = c - w + (i * 2 * w) / 6;
        return `${i ? "" : `M${c - w - 2} ${k.T - 3}`}Q${x - w / 6} ${k.T + 12} ${x + w / 6} ${k.T + 6}`;
      }).join("");
      k.put("body", k.path(`${frill}L${c + w + 2} ${k.T - 3}Q${c} ${k.T + 2} ${c - w - 2} ${k.T - 3}Z`, jelly + "dd") +
        k.line(Array.from({ length: 4 }, (_, i) => `M${c - w + 4 + i * ((2 * w - 8) / 3)} ${k.T + 6}q-2 5 0 9`).join(""), jelly, 1) +
        twinkles([[c - w * 0.6, k.T + 1], [c, k.T + 3], [c + w * 0.6, k.T + 1]]));
    }
    // The jellyfish hairpin, at the side of the head, clear of the eyes.
    if (!k.back) {
      const x = k.side ? k.hx - k.side * 14 : k.hx + 30,
        y = k.ht + 6;
      k.put("flame", k.path(`M${x - 8} ${y}Q${x - 8} ${y - 10} ${x} ${y - 10}Q${x + 8} ${y - 10} ${x + 8} ${y}Q${x} ${y - 3} ${x - 8} ${y}Z`, jelly + "cc") +
        k.line(`M${x - 5} ${y - 1}q-2 5 0 9M${x} ${y - 2}q2 5 0 10M${x + 5} ${y - 1}q2 5 0 9`, jelly, 1) +
        k.lume("pulse", k.circle(x, y - 5, 2.2, "#c8ffef", "none", 0), 3, "#59f0ff"));
    }
  },
  // Paper Crane: a tabard folded from cream paper, its creases in crimson,
  // tied with a crimson obi, a great crane folded on its back, and a small
  // origami crane perched on the head (behind the beak's line).
  halcyra(k) {
    const paper = "#fbf4e6",
      crimson = "#c8323a",
      crease = "#ef8a8e";
    const crane = (x: number, y: number, s: number, f = 1) =>
      k.path(poly([[x - 9 * s * f, y - 6 * s], [x, y + 2 * s], [x + 9 * s * f, y - 7 * s], [x + 3 * s * f, y + 3 * s], [x + 11 * s * f, y - 1 * s], [x, y + 6 * s], [x - 6 * s * f, y + 3 * s]]), paper, k.ink, 0.8) +
      k.path(poly([[x, y + 2 * s], [x + 9 * s * f, y - 7 * s], [x + 3 * s * f, y + 3 * s]]), crimson, k.ink, 0.6) +
      k.line(`M${x} ${y + 2 * s}L${x} ${y + 6 * s}M${x - 9 * s * f} ${y - 6 * s}L${x - 3 * s * f} ${y + 1 * s}`, crimson, 0.9);
    if (k.back) {
      backUnder(k, crimson, k.line(`M${k.C - k.W} ${k.T + 2}L${k.C + k.W} ${k.B}M${k.C + k.W} ${k.T + 2}L${k.C - k.W} ${k.B}`, crease, 1) +
        k.rect(k.C - k.W - 2, k.T + 24, 2 * k.W + 4, 6, 0, paper, k.ink, 0.8) +
        k.path(poly([[k.C - 14, k.T + 6], [k.C, k.T + 14], [k.C + 14, k.T + 5], [k.C + 4, k.T + 17], [k.C, k.T + 21], [k.C - 4, k.T + 17]]), paper, k.ink, 0.8) +
        k.line(`M${k.C} ${k.T + 14}V${k.T + 21}`, crimson, 0.9));
    } else {
      const c = cx(k);
      k.put("body", torso(k, crimson,
        k.line(`M${k.L} ${k.T}L${c} ${k.T + 14}L${k.R} ${k.T}M${c} ${k.T + 14}V${k.B}M${k.L} ${k.B - 2}L${c} ${k.T + 22}L${k.R} ${k.B - 2}`, crease, 1) +
          (k.side ? "" : k.path(`M${c - 10} ${k.T - 1}L${c} ${k.T + 12}L${c + 10} ${k.T - 1}Z`, paper, k.ink, 0.8)) +
          k.rect(k.L - 2, k.T + 20, k.R - k.L + 4, 6, 0, paper, k.ink, 0.8) +
          k.path(`M${c + (k.side ? k.side * 4 : 6)} ${k.T + 23}l4 -4l2 8Z`, paper, k.ink, 0.6)));
    }
    // The crane at the side of the head, behind the crest, away from the beak.
    const f = k.side ? -k.side : 1;
    const x = k.side ? k.hx - k.side * 26 : k.back ? k.hx - 36 : k.hx + 36,
      y = k.ht + 8;
    k.put("flame", `<g transform="translate(${x} ${y}) scale(1.7) translate(${-x} ${-y})">${crane(x, y, 1, f)}</g>` + (k.back ? "" : k.lume("twinkle", k.path(k.star(x + 9 * f, y - 8, 1.6, 4, 0.3), "#ffffff", "none", 0), 0, "#ffd8d8")));
  },
};
DESIGNS.kit = KIT;

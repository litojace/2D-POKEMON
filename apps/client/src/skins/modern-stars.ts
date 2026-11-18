import type { CharacterId } from "@arena/shared";
import { DESIGNS, backPanel, hatShape, onPole, torso, type Design, type Kit } from "./modern-designs";

/**
 * Stars & Stripes for the rest of the roster: every champion is a figure of
 * American popular culture that suits it (a hot-rod racer for fiery
 * Cindrake, a stage magician for the rabbit Astrabun, a park ranger for
 * leafy Pangrove...), each with something that lights up.
 */
const RED = "#c8323a",
  NAVY = "#1f2f5c",
  CREAM = "#f7f1e1",
  GOLD = "#f2c14e";
const cx = (k: Kit) => k.C + k.side * 3;
const band = (k: Kit, y: number, w: number, fill: string, h = 7) => {
  const x = k.hx + k.side * 2;
  return k.path(`M${x - w} ${y + 2}Q${x} ${y - 8} ${x + w} ${y + 2}L${x + w - 1} ${y + 2 + h}Q${x} ${y - 8 + h} ${x - w + 1} ${y + 2 + h}Z`, fill);
};
function starD(x: number, y: number, r: number, n = 5, inner = 0.45) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + "Z";
}

export const STARS: Partial<Record<CharacterId, Design>> = {
  // Hot-Rod Racer: a racing jacket with flame decals, a checkered scarf and
  // goggles; its own flame crest kept as the hair.
  cindrake(k) {
    const jacket = "#2a2a36";
    const flames = (x: number, y: number) => k.lume("pulse", k.path(`M${x - 8} ${y + 6}q2 -8 5 -4q1 -7 5 -3q2 -6 6 0q-4 4 -16 7Z`, "#ff8a3a", k.ink, 0.5), 0, "#ffb347");
    if (k.back) backPanel(k, jacket, flames(k.C - 2, k.B - 12));
    else {
      const c = cx(k);
      k.put("body", torso(k, jacket, flames(c - 4, k.B - 10) + k.line(`M${c} ${k.T + 2}V${k.B}`, "#5a5a68", 1.2)) +
        // A checkered scarf knotted at the neck.
        [0, 1, 2, 3, 4, 5].map((i) => k.rect(c - 9 + i * 3, k.T - 2 + (i % 2) * 2, 3, 3, 0, i % 2 ? "#ffffff" : "#2a2a36", "none")).join(""));
    }
    if (!k.back) {
      const y = k.ht + 20;
      const xs = k.side ? [k.hx + k.side * 16] : [k.hx - 16, k.hx + 16];
      k.put("flame", k.line(`M${k.hx - 44} ${y + 6}Q${k.hx} ${y - 6} ${k.hx + 44} ${y + 6}`, "#5a3a22", 2.6) +
        xs.map((x) => k.circle(x, y, 8, "#ffb34744", "#b8823a", 2)).join(""));
    }
  },
  // Jazz Musician: a fedora, a waistcoat and a saxophone slung on its strap,
  // the bell glowing gold.
  auralynx(k) {
    const vest = "#5a2f6e";
    if (k.back) backPanel(k, vest);
    else {
      const c = cx(k);
      k.put("body", torso(k, CREAM, k.path(`M${k.L - 2} ${k.T - 2}H${c - 5}L${c - 3} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 5}L${c + 3} ${k.B + 4}H${k.R + 2}Z`, vest, k.ink, 0.8) +
        k.path(`M${c} ${k.T + 3}l-5 -3v6Z M${c} ${k.T + 3}l5 -3v6Z`, "#2a2a36", k.ink, 0.5)));
      // The saxophone across the chest, its bell lit.
      const s = k.side ? k.side : 1;
      k.put("body", k.line(`M${c - s * 10} ${k.T + 4}Q${c - s * 4} ${k.T + 20} ${c + s * 6} ${k.B - 6}`, GOLD, 3.2) +
        k.lume("pulse", k.path(`M${c + s * 4} ${k.B - 8}q${s * 8} -2 ${s * 10} 4q${-s * 4} 4 ${-s * 10} 0Z`, "#ffd84a", k.ink, 0.6), 0, "#ffd84a") +
        [0, 1, 2].map((i) => k.circle(c - s * (6 - i * 3), k.T + 9 + i * 4, 0.9, "#fff3a8", "none", 0)).join(""));
    }
    k.put("flame", hatShape(k, 30, 16, k.ht + 18, "#2a2a36", "#2a2a36", 1.5) + k.line(`M${k.hx + k.side * 2 - 18} ${k.ht + 13}Q${k.hx} ${k.ht + 10} ${k.hx + k.side * 2 + 18} ${k.ht + 13}`, RED, 2.2));
  },
  // Neon Diner: a diner cap and apron, and a milkshake whose neon straw glows.
  lumoth(k) {
    const dress = "#7fd8e0";
    if (k.back) backPanel(k, dress, k.path(`M${k.C - 6} ${k.T + 14}l6 4l6 -4l-2 6h-8Z`, "#ffffff", k.ink, 0.6));
    else {
      const c = cx(k);
      k.put("body", torso(k, dress, k.path(`M${c - 11} ${k.T + 4}H${c + 11}L${c + 13} ${k.B + 4}H${c - 13}Z`, "#ffffff", k.ink, 0.7) + k.path(`M${c - 9} ${k.T - 1}L${c} ${k.T + 6}L${c + 9} ${k.T - 1}Z`, "#ff6fae", k.ink, 0.6)));
      const mx = c + (k.side ? k.side * 4 : 10),
        my = k.T + 14;
      k.put("body", k.path(`M${mx - 4} ${my}h8l-1.4 8h-5.2Z`, "#ffb3cf", k.ink, 0.5) + k.circle(mx, my - 1, 4, "#fff6f0", k.ink, 0.5) + k.circle(mx + 1, my - 5, 1.4, RED, "none", 0) +
        k.lume("pulse", k.line(`M${mx + 1} ${my - 1}l3 -9`, "#59f0ff", 1.4), 0, "#59f0ff"));
    }
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    k.put("flame", k.path(`M${x - 20} ${y}Q${x} ${y - 14} ${x + 20} ${y}Q${x} ${y - 4} ${x - 20} ${y}Z`, "#ffffff") + k.line(`M${x - 16} ${y - 3}Q${x} ${y - 9} ${x + 16} ${y - 3}`, "#ff6fae", 1.6));
  },
  // Film Noir: a trench coat with its belt and a fedora, and a film reel
  // badge whose sprocket holes light in a run.
  duskveil(k) {
    const trench = "#b8955a";
    if (k.back) backPanel(k, trench, k.rect(k.C - k.W - 2, k.B - 12, 2 * k.W + 4, 4, 0, "#8a6a3a"));
    else {
      const c = cx(k);
      k.put("body", torso(k, trench, k.path(`M${k.L - 2} ${k.T - 2}L${c - 2} ${k.T + 18}L${k.L - 2} ${k.T + 22}Z M${k.R + 2} ${k.T - 2}L${c + 2} ${k.T + 18}L${k.R + 2} ${k.T + 22}Z`, "#a8854a", k.ink, 0.7) +
        k.rect(k.L - 2, k.B - 12, k.R - k.L + 4, 4, 0, "#8a6a3a")));
      const rx = c + (k.side ? k.side * 3 : -10),
        ry = k.T + 12;
      k.put("body", k.circle(rx, ry, 5.5, "#2a2a36", "#9aa4b8", 0.8) +
        [0, 1, 2, 3, 4, 5].map((i) => {
          const a = (i / 6) * Math.PI * 2;
          return k.lume("chase", k.circle(rx + Math.cos(a) * 3.4, ry + Math.sin(a) * 3.4, 1, "#fff3c4", "none", 0), i, "#fff3c4");
        }).join(""));
    }
    k.put("flame", hatShape(k, 26, 12, k.ht + 30, "#3a3a48", "#3a3a48", 1.5) + k.line(`M${k.hx + k.side * 2 - 16} ${k.ht + 26}Q${k.hx} ${k.ht + 23} ${k.hx + k.side * 2 + 16} ${k.ht + 26}`, "#1b1b24", 2));
  },
  // Rodeo Rider: a fringed vest, a competitor's number on the back and a
  // lasso of light coiled at the hip.
  coilemur(k) {
    const vest = "#6a4220";
    if (k.back) backPanel(k, CREAM, k.rect(k.C - 10, k.T + 4, 20, 14, 1, "#ffffff", k.ink, 0.6) + `<text x="${k.C}" y="${k.T + 15}" font-family="Arial Black,Arial,sans-serif" font-size="9" text-anchor="middle" fill="${RED}">7</text>`);
    else {
      const c = cx(k);
      k.put("body", torso(k, CREAM, k.path(`M${k.L - 2} ${k.T - 2}H${c - 5}L${c - 3} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 5}L${c + 3} ${k.B + 4}H${k.R + 2}Z`, vest, k.ink, 0.8) +
        [0, 1, 2, 3].map((i) => k.line(`M${k.L + 2 + i * 4} ${k.B - 6}v6M${k.R - 2 - i * 4} ${k.B - 6}v6`, "#4a2a12", 1)).join("")) +
        k.path(`M${c - 10} ${k.T - 2}Q${c} ${k.T + 6} ${c + 10} ${k.T - 2}L${c} ${k.T + 10}Z`, "#2f6fb8", k.ink, 0.7));
      const lx = c + (k.side ? -k.side * 10 : -12),
        ly = k.B - 8;
      k.put("body", k.lume("pulse", `<ellipse cx="${lx}" cy="${ly}" rx="6" ry="4" fill="none" stroke="#ffe08a" stroke-width="1.6"/><ellipse cx="${lx}" cy="${ly}" rx="4" ry="2.6" fill="none" stroke="#ffe08a" stroke-width="1.2"/>`, 0, "#ffe08a"));
    }
    k.put("flame", hatShape(k, 30, 20, k.ht + 18, "#e8dcc4", "#d8c8a8", 1.6) + k.line(`M${k.hx + k.side * 2 - 18} ${k.ht + 13}Q${k.hx} ${k.ht + 10} ${k.hx + k.side * 2 + 18} ${k.ht + 13}`, "#6a4220", 2));
  },
  // Ace Pitcher: a pinstriped jersey, a ball cap and a baseball in the
  // glove whose seams glow.
  pyranda(k) {
    const pin = (x0: number, x1: number, y0: number, y1: number) => [0, 1, 2, 3, 4, 5].map((i) => k.line(`M${x0 + i * (x1 - x0) / 5} ${y0}V${y1}`, "#c8d0e0", 0.8)).join("");
    if (k.back) backPanel(k, "#ffffff", pin(k.C - k.W, k.C + k.W, k.T, k.B) + `<text x="${k.C}" y="${k.T + 22}" font-family="Arial Black,Arial,sans-serif" font-size="14" text-anchor="middle" fill="${NAVY}">1</text>`);
    else {
      const c = cx(k);
      k.put("body", torso(k, "#ffffff", pin(k.L, k.R, k.T, k.B) + k.path(`M${c - 9} ${k.T - 1}L${c} ${k.T + 8}L${c + 9} ${k.T - 1}`, "none", NAVY, 1.6) +
        `<text x="${c}" y="${k.T + 22}" font-family="Brush Script MT,cursive" font-size="9" text-anchor="middle" fill="${RED}">Aces</text>`));
      const bx = c + (k.side ? k.side * 4 : 12),
        by = k.B - 8;
      k.put("body", k.path(`M${bx - 6} ${by + 4}q-2 -8 4 -10q6 -1 8 4q1 6 -4 8Z`, "#8a5a2c", k.ink, 0.6) + k.circle(bx, by - 2, 3.4, "#ffffff", k.ink, 0.5) +
        k.lume("pulse", k.path(`M${bx - 2} ${by - 5}q2 3 0 6M${bx + 2} ${by - 5}q-2 3 0 6`, "none", RED, 0.8), 0, "#ff6a5a"));
    }
    const x = k.hx + k.side * 2,
      cy = k.ht + 18,
      cw = k.side ? 30 : 36;
    let cap = k.path(`M${x - cw} ${cy}Q${x - cw} ${cy - 26} ${x} ${cy - 27}Q${x + cw} ${cy - 26} ${x + cw} ${cy}Z`, NAVY) + k.circle(x, cy - 26.5, 1.8, RED);
    if (k.side) cap += k.path(`M${x + k.side * cw * 0.6} ${cy - 1}Q${x + k.side * (cw + 18)} ${cy - 2} ${x + k.side * (cw + 20)} ${cy + 4}Q${x + k.side * cw * 0.8} ${cy + 5} ${x + k.side * cw * 0.5} ${cy + 3}Z`, NAVY);
    else if (!k.back) cap += k.path(`M${x - cw + 4} ${cy}Q${x} ${cy + 10} ${x + cw - 4} ${cy}Q${x} ${cy + 4} ${x - cw + 4} ${cy}Z`, NAVY) + `<text x="${x}" y="${cy - 9}" font-family="Brush Script MT,cursive" font-size="12" text-anchor="middle" fill="${RED}">A</text>`;
    k.put("flame", cap);
  },
  // Alaska Aurora: a fur-trimmed parka and a sash whose aurora ribbons
  // shimmer in a run.
  glacelle(k) {
    const parka = "#2c5f8c";
    const aurora = (x0: number, x1: number, y: number) => ["#7dff8a", "#59f0ff", "#c9a3ff"].map((c, i) => k.lume("chase", k.path(`M${x0} ${y + i * 3}q${(x1 - x0) / 4} -4 ${(x1 - x0) / 2} 0t${(x1 - x0) / 2} 0`, "none", c, 1.6), i, c)).join("");
    if (k.back) backPanel(k, parka, aurora(k.C - k.W, k.C + k.W, k.T + 12));
    else {
      const c = cx(k);
      k.put("body", torso(k, parka, aurora(k.L, k.R, k.T + 14) + k.line(`M${c} ${k.T + 2}V${k.B}`, "#1f4a70", 1)));
    }
    // The fur-trimmed hood ruff round the face.
    if (!k.back) k.put("flame", k.path(`M${k.hx - 46} ${k.ht + 50}Q${k.hx - 52} ${k.ht + 4} ${k.hx} ${k.ht}Q${k.hx + 52} ${k.ht + 4} ${k.hx + 46} ${k.ht + 50}`, "none", "#f0ead8", 6));
  },
  // Barnstormer Pilot: a leather flying cap with goggles, a bomber jacket
  // and a long scarf whose star pin glows.
  halcyra(k) {
    const leather = "#7a4a24";
    if (k.back) backPanel(k, leather, k.path(starD(k.C, k.T + 14, 6), CREAM, RED, 0.8));
    else {
      const c = cx(k);
      k.put("body", torso(k, leather, k.path(`M${k.L - 2} ${k.T - 2}Q${c} ${k.T + 6} ${k.R + 2} ${k.T - 2}L${k.R + 2} ${k.T + 3}Q${c} ${k.T + 11} ${k.L - 2} ${k.T + 3}Z`, "#e8dcc4", k.ink, 0.6) + k.line(`M${c} ${k.T + 6}V${k.B}`, "#5a3a1c", 1.2)) +
        k.lume("pulse", k.path(starD(c + (k.side ? k.side * 6 : -10), k.T + 14, 3.4), "#ffd84a", k.ink, 0.5), 0, "#ffd84a"));
      const s = k.side ? -k.side : -1;
      k.put("body", k.path(`M${k.C + s * 4} ${k.T}Q${k.C + s * 22} ${k.T + 2} ${k.C + s * 38} ${k.T + 14}L${k.C + s * 36} ${k.T + 19}Q${k.C + s * 20} ${k.T + 8} ${k.C + s * 2} ${k.T + 6}Z`, "#ffffff", k.ink, 0.8), true);
    }
    const x = k.hx + k.side * 2,
      y = k.ht + 18;
    const w = k.side ? 44 : 50;
    k.put("flame", k.path(`M${x - w} ${y + 4}Q${x - w} ${k.ht - 12} ${x} ${k.ht - 12}Q${x + w} ${k.ht - 12} ${x + w} ${y + 4}Q${x} ${y - 4} ${x - w} ${y + 4}Z`, leather) +
      (k.back ? "" : (k.side ? [x + k.side * 16] : [x - 16, x + 16]).map((gx) => k.circle(gx, y - 6, 8, "#bfe8ff55", "#b8823a", 2)).join("")));
  },
  // Stage Magician: a top hat (a rabbit in a top hat), a tailcoat, and a
  // wand whose tip sparkles.
  astrabun(k) {
    const coat = "#2a2a36";
    if (k.back) backPanel(k, coat, k.path(`M${k.C - 2} ${k.B - 2}L${k.C - 8} ${k.B + 12}L${k.C} ${k.B + 6}L${k.C + 8} ${k.B + 12}L${k.C + 2} ${k.B - 2}Z`, coat));
    else {
      const c = cx(k);
      k.put("body", torso(k, "#ffffff", k.path(`M${k.L - 2} ${k.T - 2}H${c - 5}L${c - 3} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 5}L${c + 3} ${k.B + 4}H${k.R + 2}Z`, coat, k.ink, 0.8) +
        k.path(`M${c} ${k.T + 3}l-5 -3v6Z M${c} ${k.T + 3}l5 -3v6Z`, RED, k.ink, 0.5)));
    }
    onPole(k, (x, y) => k.line(`M${x} ${y + 20}L${x} ${y - 2}`, "#2a2a36", 2.4) + k.line(`M${x} ${y - 2}V${y - 6}`, "#ffffff", 2.4) +
      k.lume("twinkle", k.path(starD(x, y - 9, 5, 4, 0.35), "#fff3a8", "none"), 0, "#ffffff"));
    // The top hat sits between the ears.
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    k.put("flame", k.path(`M${x - 22} ${y}Q${x} ${y + 6} ${x + 22} ${y}Q${x} ${y - 6} ${x - 22} ${y}Z`, coat) + k.rect(x - 13, y - 26, 26, 25, 2, coat) + k.rect(x - 13, y - 8, 26, 5, 0, RED, "none"));
  },
  // Linebacker: a helmet with a stripe and shoulder pads under a jersey
  // whose number lights up.
  wombolder(k) {
    if (k.back) backPanel(k, NAVY, `<text x="${k.C}" y="${k.T + 24}" font-family="Arial Black,Arial,sans-serif" font-size="18" text-anchor="middle" fill="${CREAM}">55</text>`);
    else {
      const c = cx(k);
      k.put("body", torso(k, NAVY, k.line(`M${k.L} ${k.T + 6}H${k.R}`, CREAM, 2) +
        k.lume("pulse", `<text x="${c}" y="${k.B - 6}" font-family="Arial Black,Arial,sans-serif" font-size="15" text-anchor="middle" fill="#ffffff" stroke="${RED}" stroke-width="0.8">55</text>`, 0, "#ffffff")));
      const pad = (s: number) => k.path(`M${k.C + s * (k.W - 6)} ${k.T + 6}Q${k.C + s * (k.W - 4)} ${k.T - 8} ${k.C + s * (k.W + 10)} ${k.T - 4}Q${k.C + s * (k.W + 16)} ${k.T + 4} ${k.C + s * (k.W + 10)} ${k.T + 10}Z`, NAVY);
      k.put("body", k.side ? pad(-k.side) : pad(-1) + pad(1));
    }
    const x = k.hx + k.side * 2,
      y = k.ht + 22;
    const w = k.side ? 46 : 52;
    k.put("flame", k.path(`M${x - w} ${y + 6}Q${x - w} ${k.ht - 14} ${x} ${k.ht - 14}Q${x + w} ${k.ht - 14} ${x + w} ${y + 6}Q${x} ${y - 4} ${x - w} ${y + 6}Z`, "#c8c8d0") +
      k.line(`M${x} ${k.ht - 14}V${y - 2}`, RED, 4) + k.line(`M${x - 4} ${k.ht - 13}V${y - 2}M${x + 4} ${k.ht - 13}V${y - 2}`, CREAM, 1));
  },
  // Times Square DJ: a bomber jacket, a gold chain with a glowing star
  // pendant and headphones round the neck lit in a run.
  shadopus(k) {
    const bomber = "#2a1f44";
    if (k.back) backPanel(k, bomber, k.path(starD(k.C, k.T + 14, 7), "#ff4fd8", "none"));
    else {
      const c = cx(k);
      k.put("body", torso(k, bomber, k.line(`M${k.L} ${k.B - 5}H${k.R}`, "#ff4fd8", 2)) +
        k.path(`M${c - 10} ${k.T - 1}Q${c} ${k.T + 12} ${c + 10} ${k.T - 1}`, "none", GOLD, 1.4) +
        k.lume("pulse", k.path(starD(c, k.T + 13, 4), "#ffd84a", k.ink, 0.5), 0, "#ffd84a"));
      k.put("body", k.path(`M${c - 15} ${k.T + 2}Q${c} ${k.T + 10} ${c + 15} ${k.T + 2}`, "none", "#2b2f3d", 2.6) +
        [-1, 1].map((s, i) => k.circle(c + s * 16, k.T + 3, 5.5, "#2b2f3d") + k.lume("chase", `<circle cx="${c + s * 16}" cy="${k.T + 3}" r="3.4" fill="none" stroke="#59f0ff" stroke-width="1.2"/>`, i, "#59f0ff")).join(""));
    }
  },
  // Park Ranger: a campaign hat, a ranger shirt with its badge lit and a
  // pair of binoculars.
  pangrove(k) {
    const shirt = "#c8b07a";
    if (k.back) backPanel(k, shirt);
    else {
      const c = cx(k);
      k.put("body", torso(k, shirt, k.rect(c - 12, k.T + 6, 8, 6, 1, "#b89a62", k.ink, 0.5) + k.rect(c + 4, k.T + 6, 8, 6, 1, "#b89a62", k.ink, 0.5) + k.path(`M${c - 9} ${k.T - 1}L${c} ${k.T + 6}L${c + 9} ${k.T - 1}`, "none", "#3f6a3a", 1.6)) +
        k.lume("pulse", k.path(starD(c + (k.side ? k.side * 6 : -8), k.T + 9, 3.2, 6, 0.55), GOLD, k.ink, 0.5), 0, "#ffd84a") +
        // Binoculars on their strap.
        k.rect(c + 1, k.B - 14, 5, 7, 1.5, "#2a2a36") + k.rect(c + 7, k.B - 14, 5, 7, 1.5, "#2a2a36"));
    }
    const x = k.hx + k.side * 2,
      y = k.ht + 18;
    k.put("flame", k.path(`M${x - 46} ${y}Q${x} ${y + 8} ${x + 46} ${y}Q${x} ${y - 6} ${x - 46} ${y}Z`, "#8a6a3a") +
      k.path(`M${x - 22} ${y - 2}Q${x - 20} ${y - 22} ${x - 8} ${y - 24}L${x} ${y - 18}L${x + 8} ${y - 24}Q${x + 20} ${y - 22} ${x + 22} ${y - 2}Z`, "#9a7a4a") + k.line(`M${x - 22} ${y - 4}Q${x} ${y - 7} ${x + 22} ${y - 4}`, "#5a3a22", 1.8));
  },
  // Woodstock Folk: a tie-dye shirt, a flower crown whose blooms glow and a
  // guitar on the back.
  mossloth(k) {
    const swirl = (x0: number, y0: number) => ["#ff6fae", "#ffd84a", "#59f0ff", "#7dff8a"].map((c, i) => `<circle cx="${x0}" cy="${y0}" r="${14 - i * 3.4}" fill="${c}" opacity=".9"/>`).join("");
    if (k.back) backPanel(k, "#ff9ac0", swirl(k.C, k.T + 16));
    else {
      const c = cx(k);
      k.put("body", torso(k, "#ff9ac0", swirl(c, k.T + 16)));
    }
    onPole(k, (x, y) => `<ellipse cx="${x}" cy="${y + 14}" rx="9" ry="11" fill="#c8823a" stroke="${k.ink}" stroke-width="0.8"/>` + k.circle(x, y + 12, 3, "#3a2a1c") + k.rect(x - 1.6, y - 10, 3.2, 18, 1, "#5a3a22"));
    const x = k.hx + k.side * 2,
      y = k.ht + 16;
    const bloom = (bx: number, by: number, c: string, i: number) => k.lume("twinkle", Array.from({ length: 5 }, (_, j) => {
      const a = (j / 5) * Math.PI * 2;
      return k.circle(bx + Math.cos(a) * 3, by + Math.sin(a) * 3, 2.4, c, "none", 0);
    }).join("") + k.circle(bx, by, 1.8, "#ffd84a", "none", 0), i, c);
    const xs = k.side ? [-28, -12, 4] : [-34, -17, 0, 17, 34];
    k.put("flame", k.line(`M${x - 42} ${y + 4}Q${x} ${y - 8} ${x + 42} ${y + 4}`, "#3f8a4f", 2.4) + xs.map((dx, i) => bloom(x + dx + (k.side ? k.side * 10 : 0), y - 2 + Math.abs(dx) * 0.1, ["#ff6fae", "#ffffff", "#ffd84a", "#c9a3ff", "#ff8a5a"][i], i)).join(""));
  },
};

Object.assign((DESIGNS.stars ??= {}), STARS);

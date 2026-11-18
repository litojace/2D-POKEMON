import type { CharacterId } from "@arena/shared";
import { DESIGNS, backPanel, torso, type Design, type Kit } from "./modern-designs";
import type { Tint } from "./fashion-art";

/**
 * Sky Pirates, redrawn: every champion holds its own post on the ship (an
 * admiral, a quartermaster, a ghost, a kraken captain...), with its own hat,
 * coat and gear, and something on it that lights up.
 */
const GOLD = "#f2c14e",
  GOLD_DARK = "#a8823a",
  SHIRT = "#f4ecd8";
const cx = (k: Kit) => k.C + k.side * 3;
/** Seen from behind, a piece worn on one side of the head swaps sides. */
const turn = (k: Kit, x: number, svg: string) => (k.back ? `<g transform="translate(${2 * x} 0) scale(-1 1)">${svg}</g>` : svg);
/** Drawn once for the right-facing profile, mirrored for the left one. */
const profile = (k: Kit, x: number, svg: string) => (k.side < 0 ? `<g transform="translate(${2 * x} 0) scale(-1 1)">${svg}</g>` : svg);

/** A tricorne: three upturned brim points, gold edged. */
function tricorne(k: Kit, y: number, w: number, felt: string, edge = GOLD, tilt = 0) {
  const x = k.hx + k.side * 3;
  const h = w * 0.62;
  let svg: string;
  if (k.side) {
    // Profile. The crown fits the head, so the hat is as deep as the head
    // (front to back), whatever its width from the front: a round crown,
    // and the side flap turned up in front of it, running from the front
    // point (low, forward over the brow) up to a rear corner.
    const f = k.side,
      d = 46;
    const flapTop = `M${x - f * d} ${y - 28}Q${x - f * 12} ${y - 14} ${x + f * (d + 2)} ${y - 15}`;
    svg = k.path(`M${x - f * 30} ${y - 6}Q${x - f * 32} ${y - 40} ${x} ${y - 40}Q${x + f * 30} ${y - 40} ${x + f * 28} ${y - 6}Z`, felt) +
      k.path(`M${x + f * (d + 2)} ${y - 15}Q${x + f * 12} ${y + 7} ${x - f * 30} ${y + 3}Q${x - f * (d - 2)} ${y + 1} ${x - f * d} ${y - 28}Q${x - f * 12} ${y - 14} ${x + f * (d + 2)} ${y - 15}Z`, felt) +
      k.line(flapTop, edge, 2.4);
  } else {
    svg = k.path(`M${x - w * 0.6} ${y - h * 0.45}Q${x - w * 0.62} ${y - h * 1.55} ${x} ${y - h * 1.6}Q${x + w * 0.62} ${y - h * 1.55} ${x + w * 0.6} ${y - h * 0.45}Z`, felt) +
      k.path(`M${x - w} ${y - h * 0.7}Q${x - w * 0.55} ${y + 2} ${x} ${y + 8}Q${x + w * 0.55} ${y + 2} ${x + w} ${y - h * 0.7}Q${x + w * 0.55} ${y - h * 0.35} ${x} ${y - h * 0.45}Q${x - w * 0.55} ${y - h * 0.35} ${x - w} ${y - h * 0.7}Z`, felt) +
      k.line(`M${x - w} ${y - h * 0.7}Q${x - w * 0.55} ${y + 2} ${x} ${y + 8}Q${x + w * 0.55} ${y + 2} ${x + w} ${y - h * 0.7}`, edge, 2.4);
  }
  return tilt ? `<g transform="rotate(${tilt} ${x} ${y})">${svg}</g>` : svg;
}
/** A long coat over a shirt: open front, lapels, a row of buttons each side. */
function coat(k: Kit, cloth: string, trim: string, inner = SHIRT, extra = "") {
  const c = cx(k);
  const open = k.side ? 4 : 7;
  return torso(k, inner,
    k.path(`M${k.L - 2} ${k.T - 2}H${c - open}L${c - open + 2} ${k.B + 6}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + open}L${c + open - 2} ${k.B + 6}H${k.R + 2}Z`, cloth, k.ink, 0.8) +
      k.line(`M${c - open} ${k.T - 2}L${c - open + 2} ${k.B + 6}M${c + open} ${k.T - 2}L${c + open - 2} ${k.B + 6}`, trim, 1.6) +
      [0, 1, 2].map((i) => k.circle(c - open - 4, k.T + 8 + i * 9, 1.4, GOLD, GOLD_DARK, 0.4) + k.circle(c + open + 4, k.T + 8 + i * 9, 1.4, GOLD, GOLD_DARK, 0.4)).join("") +
      extra);
}
/** A sash and big buckled belt across the waist. */
function belt(k: Kit, sash: string, buckleGlow?: string) {
  const c = cx(k),
    y = k.B - 10;
  const buckle = k.rect(c - 5, y - 1, 10, 8, 1.5, GOLD, GOLD_DARK, 0.8) + k.rect(c - 2.5, y + 1.2, 5, 3.6, 0.8, "#3a2a1c", "none");
  return k.rect(k.L - 2, y, k.R - k.L + 4, 6, 0, "#3a2a1c", "none") +
    k.path(`M${k.L - 2} ${y - 5}Q${c} ${y - 1} ${k.R + 2} ${y - 5}L${k.R + 2} ${y}Q${c} ${y + 4} ${k.L - 2} ${y}Z`, sash, "none") +
    (buckleGlow ? k.lume("pulse", buckle, 5, buckleGlow) : buckle);
}

/** A dome that fits the head (a cap's crown): the same from every side. */
function dome(k: Kit, y: number, w: number, h: number, fill: string, x = k.hx + k.side * 2) {
  return k.path(`M${x - w} ${y}C${x - w} ${y - h * 1.33} ${x + w} ${y - h * 1.33} ${x + w} ${y}Q${x} ${y + 5} ${x - w} ${y}Z`, fill);
}
/** A band round the head at y, h tall. */
function headBand(k: Kit, y: number, w: number, h: number, fill: string, x = k.hx + k.side * 2) {
  return k.path(`M${x - w} ${y}Q${x} ${y - 9} ${x + w} ${y}L${x + w - 1} ${y + h}Q${x} ${y - 9 + h} ${x - w + 1} ${y + h}Z`, fill);
}
/**
 * A knot tied at the back of the head with two tails: peeking past the
 * head's left edge from the front, at the back of the head in profile, in
 * the middle from behind.
 */
function backKnot(k: Kit, y: number, w: number, fill: string) {
  const x = k.hx + k.side * 2;
  const kx = k.back ? x : k.side ? x - k.side * (w - 2) : x + w - 4;
  const d = k.back ? 1 : k.side ? -k.side : 1;
  const tails = k.path(`M${kx} ${y + 4}Q${kx + d * 8} ${y + 10} ${kx + d * 6} ${y + 22}L${kx + d * 1} ${y + 18}Z`, fill, k.ink, 0.8) +
    k.path(`M${kx} ${y + 4}Q${kx + d * 14} ${y + 6} ${kx + d * 16} ${y + 16}L${kx + d * 10} ${y + 15}Z`, fill, k.ink, 0.8);
  return tails + k.circle(kx, y + 3, 4, fill, k.ink, 0.8);
}
/** A brass spyglass, drawn level, its lens end at (x, y) facing d. */
function spyglass(k: Kit, x: number, y: number, d: number, glow: string, i = 0) {
  return k.rect(Math.min(x, x - d * 22), y - 3, 22, 6, 2, "#b8823a", k.ink, 0.8) + k.rect(Math.min(x - d * 22, x - d * 30), y - 2.2, 8, 4.4, 1.5, "#8a5a2a", k.ink, 0.7) +
    k.line(`M${x - d * 8} ${y - 3}v6M${x - d * 15} ${y - 3}v6`, GOLD_DARK, 0.8) +
    k.lume("pulse", `<ellipse cx="${x}" cy="${y}" rx="2" ry="3.6" fill="${glow}" stroke="${k.ink}" stroke-width="0.6"/>`, i, glow);
}

export const PIRATES: Partial<Record<CharacterId, Design>> = {
  // Storm Corsair: a storm-grey tricorne with a lightning cockade, a navy
  // greatcoat frogged in gold, and a brass storm compass at the belt whose
  // needle crackles with light.
  voltkit(k) {
    const navy = "#24345e",
      bolt = "#ffe25a";
    const compass = (x: number, y: number) => k.circle(x, y, 7, GOLD, GOLD_DARK, 1) + k.circle(x, y, 5.2, "#1b2440", "none") +
      k.lume("pulse", k.path(`M${x} ${y - 4.6}L${x + 1.6} ${y}L${x} ${y + 4.6}L${x - 1.6} ${y}Z`, bolt, "none") + k.circle(x, y, 1, "#ffffff", "none", 0), 1, bolt);
    if (k.back) backPanel(k, navy, [0, 1, 2].map((i) => k.line(`M${k.C - 12} ${k.T + 8 + i * 8}H${k.C + 12}`, GOLD, 1.4)).join("") + k.line(`M${k.C} ${k.B - 14}V${k.B + 2}`, "#1b2440", 1.4));
    else {
      const c = cx(k);
      k.put("body", coat(k, navy, GOLD,
        SHIRT,
        // Gold frogging across the chest.
        (k.side ? "" : [0, 1, 2].map((i) => k.line(`M${c - 15} ${k.T + 8 + i * 9}H${c - 9}M${c + 9} ${k.T + 8 + i * 9}H${c + 15}`, GOLD, 1.3)).join("")) +
          belt(k, "#2f4d8c")) + compass(c + (k.side ? k.side * 6 : 12), k.B - 18));
    }
    const hy = k.ht + 16,
      bx = k.hx + k.side * 6,
      by = hy - 26;
    k.put("flame", tricorne(k, hy, k.side ? 32 : 40, "#3a4152") +
      (k.back ? "" : k.lume("pulse", k.path(`M${bx + 1} ${by}L${bx - 5} ${by + 10}H${bx - 1}L${bx - 3} ${by + 18}L${bx + 5} ${by + 7}H${bx + 1}Z`, bolt, k.ink, 0.6), 0, bolt)));
  },
  // Tide Admiral: a gold-laced bicorne worn athwart with a glowing cockade,
  // a navy dress coat with fringed epaulettes, a blue sash and medals that
  // catch the light.
  tidefin(k) {
    const navy = "#1d2c58";
    const epaulette = (x: number, y: number) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="4" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.8"/>` +
      [-6, -3, 0, 3, 6].map((dx) => k.line(`M${x + dx} ${y + 3}v5`, GOLD, 1.1)).join("");
    if (k.back) backPanel(k, navy, k.line(`M${k.C} ${k.T + 20}V${k.B + 2}`, "#14203f", 1.4) + epaulette(k.L + 4, k.T + 2) + epaulette(k.R - 4, k.T + 2));
    else {
      const c = cx(k);
      k.put("body", coat(k, navy, GOLD, SHIRT,
        (k.side < 0 ? k.path(`M${k.R} ${k.T + 2}L${k.L} ${k.B - 8}L${k.L} ${k.B - 2}L${k.R} ${k.T + 8}Z`, "#2f8fd0", "none") : k.path(`M${k.L} ${k.T + 2}L${k.R} ${k.B - 8}L${k.R} ${k.B - 2}L${k.L} ${k.T + 8}Z`, "#2f8fd0", "none")) +
          [0, 1, 2].map((i) => k.lume("twinkle", k.path(k.star(c - (k.side ? k.side * 4 : 10), k.T + 16 + i * 6, 2.6, 8, 0.55), GOLD, GOLD_DARK, 0.4) + k.rect(c - (k.side ? k.side * 4 : 10) - 1.5, k.T + 11 + i * 6, 3, 3, 0, ["#c8323a", "#ffffff", "#2f8fd0"][i], "none"), i, "#fff3b0")).join("")) +
        (k.side ? epaulette(k.C - k.side * 2, k.T + 1) : epaulette(k.L + 4, k.T + 1) + epaulette(k.R - 4, k.T + 1)));
    }
    // The bicorne, worn athwart (Napoleon's way). Its crown fits the head,
    // so from any side its base is as long as the head is: a broad
    // half-moon from the front and back, and end-on in profile a pointed
    // wedge as deep as the head, the cockade's edge showing on the front.
    const x = k.side ? k.hx - k.side * 4 : k.hx,
      y = k.side ? k.ht + 12 : k.ht + 11;
    const moon = (w: number, h: number) =>
      k.path(`M${x - w} ${y}Q${x - w * 0.8} ${y - h * 1.2} ${x} ${y - h}Q${x + w * 0.8} ${y - h * 1.2} ${x + w} ${y}Q${x} ${y + 7} ${x - w} ${y}Z`, navy) +
      k.line(`M${x - w} ${y}Q${x - w * 0.8} ${y - h * 1.2} ${x} ${y - h}Q${x + w * 0.8} ${y - h * 1.2} ${x + w} ${y}`, GOLD, 2.6) +
      k.line(`M${x - w + 6} ${y - 3}Q${x} ${y - h * 0.65} ${x + w - 6} ${y - 3}`, "#f4ecd8", 1.2);
    const wedge = (b: number, h: number) => {
      const edge = `M${x - b} ${y}Q${x - b * 0.8} ${y - h * 0.6} ${x - b * 0.12} ${y - h * 0.98}L${x} ${y - h * 1.08}L${x + b * 0.12} ${y - h * 0.98}Q${x + b * 0.8} ${y - h * 0.6} ${x + b} ${y}`;
      // The flaps meet in a point; their laced edges and the seam between them.
      return k.path(edge + `Q${x} ${y + 6} ${x - b} ${y}Z`, navy) + k.line(edge, GOLD, 2.2) +
        k.line(`M${x} ${y - h * 1.04}L${x} ${y + 3}`, GOLD, 1.4) +
        k.path(`M${x - 3} ${y - h * 1.0}L${x} ${y - h * 1.08}L${x + 3} ${y - h * 1.0}L${x} ${y - h * 0.86}Z`, GOLD, "none");
    };
    const hat = k.side ? wedge(36, 34) : moon(54, 30);
    // The cockade on the front flap: whole from the front, a sliver at the
    // face side of the wedge in profile, hidden from behind.
    const cockade = k.back
      ? ""
      : k.side
        ? `<ellipse cx="${x + k.side * 30}" cy="${y - 14}" rx="2.6" ry="5.5" fill="#2f8fd0" stroke="${GOLD}" stroke-width="1.2"/>`
        : k.circle(x, y - 14.4, 6, "#2f8fd0", GOLD, 1.4) + k.circle(x, y - 14.4, 2.4, "#ffffff", "none", 0);
    k.put("flame", hat + (cockade ? k.lume("pulse", cockade, 0, "#9fe2ff") : ""));
  },
  // Chart Quartermaster: a cavalier hat with a long quill, a plum waistcoat
  // with a pocket watch chain, and a rolled treasure map at the hip whose X
  // glows.
  mystowl(k) {
    const plum = "#4a2550";
    if (k.back) {
      backPanel(k, plum, k.line(`M${k.C - 16} ${k.T + 2}L${k.C + 16} ${k.B - 8}`, "#5a3a22", 2));
      // The map's rolled end showing past the hip, on its right side.
      k.put("scarf", k.rect(k.C + 26, k.B - 26, 9, 22, 3, "#e8d6a6", "#8a6a3a", 0.9) + k.circle(k.C + 30.5, k.B - 26, 3, "#d6c08a", "#8a6a3a", 0.7));
    }
    else {
      const c = cx(k);
      k.put("body", coat(k, "#6a3a1f", GOLD, plum,
        // A watch chain looping between pockets.
        k.line(`M${c - 12} ${k.T + 16}Q${c} ${k.T + 24} ${c + 12} ${k.T + 16}`, GOLD, 1) + k.circle(c + 12, k.T + 16, 2.4, GOLD, GOLD_DARK, 0.5)) +
        belt(k, "#8a1f2c"));
      // The treasure map, half unrolled, held at the side.
      const s = k.side || 1;
      const mx = k.side ? k.C - s * 4 : k.C - 34,
        my = k.B - 16;
      k.put("body", k.rect(mx - 9, my - 12, 18, 22, 1.5, "#e8d6a6", "#8a6a3a", 0.9) +
        k.circle(mx, my - 12, 3, "#d6c08a", "#8a6a3a", 0.7) + k.circle(mx, my + 10, 3, "#d6c08a", "#8a6a3a", 0.7) +
        k.line(`M${mx - 6} ${my - 6}q3 4 6 2t5 5`, "#8a6a3a", 0.8) +
        k.lume("pulse", k.line(`M${mx + 1} ${my + 1}l5 5m0 -5l-5 5`, "#ff3a3a", 1.8), 1, "#ff6a5a"));
    }
    // The cavalier hat: a broad brim pinned up at one side, a crown, a quill.
    const x = k.hx + k.side * 3,
      y = k.ht + 14;
    const w = k.side ? 34 : 50;
    k.put("flame", turn(k, x, profile(k, x, `<g transform="rotate(${k.side ? -6 : -7} ${x} ${y})">` +
      k.path(`M${x - w} ${y + 2}Q${x} ${y + 12} ${x + w} ${y - 2}Q${x + w * 0.4} ${y - 8} ${x} ${y - 6}Q${x - w * 0.5} ${y - 6} ${x - w} ${y + 2}Z`, "#3a2440") +
      k.path(`M${x - w * 0.45} ${y - 3}Q${x - w * 0.45} ${y - 26} ${x} ${y - 26}Q${x + w * 0.45} ${y - 26} ${x + w * 0.45} ${y - 3}Z`, "#3a2440") +
      k.rect(x - w * 0.46, y - 9, w * 0.92, 5, 1, GOLD, "none") +
      // The quill sweeps back over the brim, its tip lit like fresh ink catching moonlight.
      k.path(`M${x + w * 0.2} ${y - 8}Q${x + w * 0.9} ${y - 40} ${x + w * 1.25} ${y - 30}Q${x + w * 0.85} ${y - 22} ${x + w * 0.3} ${y - 6}Z`, "#f4ecd8", k.ink, 0.8) +
      k.line(`M${x + w * 0.25} ${y - 7}Q${x + w * 0.8} ${y - 28} ${x + w * 1.2} ${y - 30}`, "#c9b28a", 0.8) +
      k.lume("twinkle", k.path(k.star(x + w * 1.25, y - 31, 3.4, 4), "#fff3a8", "none"), 2, "#fff3a8") + "</g>")));
  },
  // Ghost Ship Wisp: a tattered spectral coat whose torn hem glows ghost
  // green, a battered tricorne riding the hood, and a chain of soul-lights.
  duskveil(k) {
    const ghost = "#2a3d3a",
      green = "#7dffc8";
    const hem = (y: number) => {
      let d = `M${k.L - 2} ${y}`;
      const n = 6,
        step = (k.R - k.L + 4) / n;
      for (let i = 0; i < n; i++) d += `L${k.L - 2 + step * (i + 0.5)} ${y + (i % 2 ? 9 : 5)}L${k.L - 2 + step * (i + 1)} ${y}`;
      return d;
    };
    if (k.back) backPanel(k, ghost, k.lume("chase", k.line(hem(k.B - 4), green, 1.6), 0, green), 6);
    else {
      const c = cx(k);
      k.put("body", coat(k, ghost, "#4f7a6e", "#1b2422",
        // Rows of ghost-lit buttons, flickering one after another.
        [0, 1, 2].map((i) => k.lume("chase", k.circle(c, k.T + 6 + i * 9, 1.6, green, "none", 0), i + 1, green)).join("")) +
        k.lume("chase", k.line(hem(k.B - 2), green, 1.6), 0, green));
    }
    // A battered tricorne riding the hood, its brim torn, a ghost-flame cockade.
    const y = k.ht + 44;
    k.put("flame", `<g opacity=".94">${tricorne(k, y, k.side ? 34 : 44, "#24302e", "#4f7a6e", k.side ? 0 : 6)}</g>` +
      (k.back ? "" : profile(k, k.hx + k.side * 4, k.lume("pulse", k.path(`M${k.hx + k.side * 4 + 4} ${y - 18}q-6 -6 -2 -12q2 5 5 4q-1 -5 3 -8q2 8 -2 13q-1 3 -4 3Z`, green, k.ink, 0.5), 0, green))));
  },
  // Sunset Skipper: a sunset-striped tricorne with its own little orange as
  // the cockade, an open vest over a striped shirt, and a parrot on the
  // shoulder; the hat band glows like the last of the sun.
  sunbara(k) {
    const vest = "#c8562c";
    if (k.back) backPanel(k, vest, k.lume("chase", [0, 1, 2].map((i) => k.circle(k.C - 10 + i * 10, k.T + 14, 2.6, "#ffb347", k.ink, 0.4)).join(""), 1, "#ffb347") + k.rect(k.L, k.B - 12, k.R - k.L, 6, 0, "#f2c14e", "none"));
    else {
      const c = cx(k);
      k.put("body", torso(k, "#f4ecd8", [0, 1, 2, 3, 4].map((i) => k.line(`M${k.L} ${k.T + 3 + i * 8}H${k.R}`, "#2f5d8c", 2.2)).join("") +
        k.path(`M${k.L - 2} ${k.T - 2}H${c - 6}L${c - 4} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 6}L${c + 4} ${k.B + 4}H${k.R + 2}Z`, vest, k.ink, 0.8) +
        belt(k, "#f2c14e")));
    }
    // The parrot on its left shoulder: the viewer's right from the front,
    // left from behind, and on the shoulder nearest us in profile.
    const s = k.side ? k.side : 1;
    const px = k.back ? k.C - 30 : k.side ? k.C - k.side * 6 : k.R + 8,
      py = k.back ? k.T - 6 : k.side ? k.T - 6 : k.T - 2;
    const parrot = `<g transform="translate(${px} ${py}) scale(${s} 1)">` +
      k.path(`M-6 4Q-8 -10 2 -12Q10 -12 9 -2Q8 8 -2 10Z`, "#e8322a") +
      k.path(`M-4 2Q-14 8 -12 22L-4 12Z`, "#2f8fd0") + k.path(`M-2 6Q-8 12 -6 24L0 12Z`, "#3fbf5a", k.ink, 0.8) +
      k.path(`M8 -6L14 -3L8 0Z`, "#f2c14e", k.ink, 0.8) + k.circle(4, -6, 1.6, "#1b1b1b", "none", 0) + k.circle(4.6, -6.6, 0.5, "#ffffff", "none", 0) + "</g>";
    k.put("flame", parrot);
    // The tricorne with a sunset band and a little orange for its cockade.
    const x = k.hx + k.side * 3,
      y = k.ht + 16;
    const w = k.side ? 30 : 38;
    k.put("flame", tricorne(k, y, w, "#5a2a1c") +
      k.lume("chase", k.path(`M${x - w * 0.6} ${y - 6}Q${x} ${y - 1} ${x + w * 0.6} ${y - 6}L${x + w * 0.58} ${y - 10}Q${x} ${y - 5} ${x - w * 0.58} ${y - 10}Z`, "#ff9a3a", "none"), 0, "#ffb347") +
      (k.back ? "" : k.lume("pulse", k.circle(x + (k.side ? k.side * 6 : -16), y - 10, 5.4, "#ff9a2a", "#a8562c", 0.8), 1, "#ffb347") + k.path(`M${x + (k.side ? k.side * 6 : -16)} ${y - 15}q4 -4 7 -2q-3 3 -7 2Z`, "#3fbf5a", k.ink, 0.5)));
  },
  // Kraken Captain: a captain's hat gripped by a tentacle, a deep-sea coat
  // with gold epaulettes, and glowing bioluminescent spots that pulse along
  // its arms.
  shadopus(k) {
    const coatC = "#13324a",
      bio = "#5ff0ff";
    if (k.back) backPanel(k, coatC, [0, 1, 2, 3].map((i) => k.lume("chase", k.circle(k.C - 12 + i * 8, k.B - 6, 1.5, bio, "none", 0), i, bio)).join(""));
    else {
      const c = cx(k);
      k.put("body", coat(k, coatC, GOLD, "#0d1e2c",
        [0, 1, 2, 3].map((i) => k.lume("chase", k.circle(k.L + 4 + (i % 2) * 3, k.T + 8 + i * 8, 1.5, bio, "none", 0) + k.circle(k.R - 4 - (i % 2) * 3, k.T + 8 + i * 8, 1.5, bio, "none", 0), i, bio)).join("") +
          k.lume("pulse", k.circle(c, k.T + 14, 3.4, bio, k.ink, 0.5), 4, bio)) +
        (k.side ? "" : [k.L + 3, k.R - 3].map((x) => `<ellipse cx="${x}" cy="${k.T + 1}" rx="8" ry="4" fill="${GOLD}" stroke="${GOLD_DARK}" stroke-width="0.8"/>`).join("")));
    }
    // The captain's hat: a peaked crown and a tentacle wound around it.
    const x = k.hx + k.side * 3,
      y = k.ht + 30;
    const w = k.side ? 30 : 42;
    const tent = k.side
      ? k.line(`M${x - k.side * 26} ${y - 2}Q${x} ${y - 10} ${x + k.side * 22} ${y - 18}Q${x + k.side * 30} ${y - 24} ${x + k.side * 24} ${y - 30}`, "#7a3ac0", 5)
      : k.line(`M${x - 40} ${y - 2}Q${x - 10} ${y - 12} ${x + 22} ${y - 8}Q${x + 44} ${y - 6} ${x + 40} ${y - 26}Q${x + 36} ${y - 34} ${x + 28} ${y - 30}`, "#7a3ac0", 5);
    const suckers = k.side ? [] : [[x - 26, y - 7], [x - 8, y - 10], [x + 10, y - 9], [x + 30, y - 10], [x + 40, y - 20]];
    k.put("flame", turn(k, x,
      k.path(`M${x - w} ${y}Q${x} ${y + 8} ${x + w} ${y}Q${x + w * 0.7} ${y - 8} ${x} ${y - 7}Q${x - w * 0.7} ${y - 8} ${x - w} ${y}Z`, "#0d1e2c") +
      k.path(`M${x - w * 0.7} ${y - 3}Q${x - w * 0.8} ${y - 30} ${x} ${y - 32}Q${x + w * 0.8} ${y - 30} ${x + w * 0.7} ${y - 3}Z`, coatC) +
      k.line(`M${x - w * 0.7} ${y - 6}Q${x} ${y - 2} ${x + w * 0.7} ${y - 6}`, GOLD, 2.4) +
      (k.back ? "" : k.path(k.star(x, y - 18, 6, 5), GOLD, GOLD_DARK, 0.6)) +
      tent + suckers.map(([sx, sy], i) => k.lume("chase", k.circle(sx, sy, 1.6, bio, "none", 0), i, bio)).join("")));
  },
  // Cinder Buccaneer: a black bandana with its own flame bursting out of the
  // top, a leather vest over a striped shirt, and a ship's lantern at the
  // right hip glowing like embers.
  cindrake(k) {
    const vest = "#3a2418",
      red = "#c8282e",
      scarf = "#22222c",
      ember = "#ffb347";
    const c = cx(k);
    if (k.back) backPanel(k, vest, k.line(`M${k.R} ${k.T + 2}L${k.L + 4} ${k.B - 6}`, red, 3));
    else
      k.put("body", torso(k, SHIRT, [0, 1, 2, 3, 4].map((i) => k.line(`M${k.L} ${k.T + 3 + i * 8}H${k.R}`, red, 2.2)).join("") +
        k.path(`M${k.L - 2} ${k.T - 2}H${c - 6}L${c - 4} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 6}L${c + 4} ${k.B + 4}H${k.R + 2}Z`, vest, k.ink, 0.8) +
        belt(k, "#7a1a1e")));
    // The ship's lantern at its right hip: the viewer's left from the front,
    // right from behind, at the hip nearest us in profile.
    const lx = k.back ? k.R + 8 : k.side ? k.C - k.side * 10 : k.L - 8,
      ly = k.B - 2;
    k.put("flame", k.line(`M${lx} ${ly - 16}V${ly - 10}`, "#3a2a1c", 1.4) + k.path(`M${lx - 6} ${ly - 9}L${lx} ${ly - 14}L${lx + 6} ${ly - 9}Z`, "#3a2a1c", k.ink, 0.6) +
      k.rect(lx - 6, ly - 9, 12, 16, 2, "#3a2a1c", k.ink, 0.8) +
      k.lume("pulse", k.rect(lx - 4, ly - 7, 8, 12, 1.5, ember, "none") + k.path(`M${lx} ${ly - 5}q3 3 0 7q-3 -3 0 -7Z`, "#fff3b0", "none"), 1, ember) +
      k.rect(lx - 7, ly + 6, 14, 3, 1, "#3a2a1c", k.ink, 0.6));
    // The bandana, its flame bursting from the top, and its knot behind.
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    const flame = profile(k, x, turn(k, x, k.lume("pulse",
      k.path(`M${x - 16} ${y + 2}Q${x - 22} ${y - 14} ${x - 12} ${y - 24}Q${x - 11} ${y - 14} ${x - 5} ${y - 11}Q${x - 8} ${y - 28} ${x + 3} ${y - 40}Q${x + 3} ${y - 24} ${x + 9} ${y - 19}Q${x + 11} ${y - 27} ${x + 18} ${y - 30}Q${x + 23} ${y - 12} ${x + 16} ${y + 2}Z`, "#ff7a22", k.ink, 0.8) +
        k.path(`M${x - 8} ${y + 2}Q${x - 10} ${y - 10} ${x - 3} ${y - 14}Q${x - 1} ${y - 8} ${x + 3} ${y - 22}Q${x + 6} ${y - 10} ${x + 10} ${y - 12}Q${x + 12} ${y - 4} ${x + 8} ${y + 2}Z`, "#ffd65b", "none"), 0, ember)));
    const skull = k.back ? "" : k.side
      ? k.circle(x + k.side * 27, y + 3, 2.6, "#f4ecd8", k.ink, 0.5)
      : k.circle(x, y + 2.5, 3.4, "#f4ecd8", k.ink, 0.6) + k.circle(x - 1.2, y + 2.2, 0.8, "#1b1b1b", "none", 0) + k.circle(x + 1.2, y + 2.2, 0.8, "#1b1b1b", "none", 0);
    // Cindrake's head-top layer sits behind its head in profile and from
    // behind (creature-profile.ts), so there the bandana goes on the layer
    // drawn after the head; the flame stays behind, rising over the top.
    if (k.side || k.back) k.put("flame", flame);
    k.put(k.side || k.back ? "eyes" : "flame", (k.side || k.back ? "" : flame) + headBand(k, y, 37, 8, scarf) + [-22, -8, 8, 22].map((dx) => (k.side && dx * k.side > 12) || (!k.side && Math.abs(dx) < 10) ? "" : k.circle(x + dx, y + 3.5 + Math.abs(dx) * 0.04, 1.1, "#f4ecd8", "none", 0)).join("") + skull + backKnot(k, y + 1, 37, scarf));
  },
  // Prism Navigator: a long indigo coat under a star-chart capelet whose
  // stars light up in turn, a compass-rose pin on its brow band, and a brass
  // spyglass at the left hip with a glowing prism lens.
  auralynx(k) {
    const coatC = "#26285a",
      star = "#bfe8ff";
    const c = cx(k);
    const cape = (y0: number, y1: number) => k.path(`M${k.L - 4} ${y0}Q${k.C} ${y0 - 6} ${k.R + 4} ${y0}L${k.R + 6} ${y1}Q${k.C + 12} ${y1 + 5} ${k.C} ${y1}Q${k.C - 12} ${y1 + 5} ${k.L - 6} ${y1}Z`, "#3a3c7a", k.ink, 0.9);
    const dots = (y0: number, n: number) => Array.from({ length: n }, (_, i) => k.lume("chase", k.path(k.star(k.L + 4 + ((k.R - k.L - 8) * i) / (n - 1), y0 + (i % 2 ? 7 : 3), 2.2, 4), star, "none"), i, star)).join("");
    if (k.back) backPanel(k, coatC, cape(k.T - 2, k.T + 18) + dots(k.T + 2, 5));
    else k.put("body", coat(k, coatC, GOLD, "#e8e4f4") + cape(k.T - 3, k.T + 9) + dots(k.T - 2, k.side ? 3 : 5) + belt(k, "#4a3b8c"));
    // The spyglass at its left hip, lens forward.
    const d = k.back ? -1 : k.side ? k.side : 1;
    const sx = k.back ? k.L - 10 : k.side ? k.C + k.side * 8 : k.R + 14;
    k.put("flame", spyglass(k, sx, k.B - 4, d, "#9ff4ff", 1));
    // The brow band with a compass-rose pin at its left temple.
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    const px = k.side ? x + k.side * 18 : x + 22;
    k.put("flame", headBand(k, y, 35, 5, "#2a2c5e") + (k.back ? "" : k.lume("twinkle", k.circle(px, y + 1, 4.6, GOLD, GOLD_DARK, 0.8) + k.path(k.star(px, y + 1, 4, 4, 0.3), "#fff3b0", "none"), 2, "#fff3b0")));
  },
  // Lantern Lookout: a striped knit watch cap with a pom-pom, a rolled-neck
  // sweater, and a lantern held out on a short pole.
  lumoth(k) {
    const wool = "#c8323a",
      cream = "#f4ecd8";
    if (k.back) backPanel(k, "#24345e", [0, 1, 2].map((i) => k.line(`M${k.L} ${k.T + 8 + i * 8}H${k.R}`, cream, 2)).join(""));
    else {
      const c = cx(k);
      k.put("body", torso(k, "#24345e", [0, 1, 2].map((i) => k.line(`M${k.L} ${k.T + 8 + i * 8}H${k.R}`, cream, 2)).join("") +
        k.path(`M${c - 13} ${k.T - 2}Q${c} ${k.T + 6} ${c + 13} ${k.T - 2}L${c + 12} ${k.T + 3}Q${c} ${k.T + 10} ${c - 12} ${k.T + 3}Z`, cream, k.ink, 0.7)));
    }
    const lantern = (x: number, y: number) => k.line(`M${x} ${y - 6}V${y - 1}`, "#3a2a1c", 1.2) + k.path(`M${x - 7} ${y}L${x} ${y - 5}L${x + 7} ${y}Z`, "#3a2a1c", k.ink, 0.6) +
      k.rect(x - 7, y, 14, 17, 2, "#2a2a2a", k.ink, 0.8) +
      k.lume("pulse", k.rect(x - 5, y + 2, 10, 13, 1.5, "#ffd27a", "none") + k.path(`M${x} ${y + 5}q3 3 0 7q-3 -3 0 -7Z`, "#ffffff", "none"), 0, "#ffd27a") +
      k.lume("twinkle", k.line(`M${x - 3} ${y + 4}l2 2`, "#ffffff", 1.2), 1, "#ffffff") + k.rect(x - 8, y + 16, 16, 3, 1, "#2a2a2a", k.ink, 0.6);
    // The lookout holds its lantern out on a short pole at its left side,
    // clear of the face and wings: the viewer's right from the front, left
    // from behind, held out ahead in profile.
    const px = k.back ? k.L - 16 : k.side ? k.C + k.side * 26 : k.R + 16,
      py = k.B - 18;
    k.put("flame", k.line(`M${px - (k.side ? k.side * 18 : k.back ? -10 : 10)} ${py + 22}L${px} ${py - 8}`, "#7a5a3a", 2.4) + k.line(`M${px} ${py - 8}V${py - 2}`, "#3a2a1c", 1.2) + `<g transform="translate(${px} ${py - 2}) scale(1.3) translate(${-px} ${-(py - 2)})">${lantern(px, py - 2)}</g>`);
    // The watch cap: a knit dome with stripes, a turned-up cuff and a pom.
    const x = k.hx + k.side * 2,
      y = k.ht + 15;
    k.put("flame", dome(k, y, 38, 24, wool) + k.line(`M${x - 34} ${y - 10}Q${x} ${y - 24} ${x + 34} ${y - 10}`, cream, 3) +
      headBand(k, y - 2, 38, 8, cream) + [-24, -12, 0, 12, 24].map((dx) => k.line(`M${x + dx} ${y - 3 + Math.abs(dx) * 0.06}v6`, "#d8ccb4", 0.8)).join("") +
      k.circle(x, y - 27, 6, cream, k.ink, 0.8));
  },
  // Ironhull Captain: a peaked captain's cap with a glowing anchor badge, an
  // iron-grey coat with gold buttons, and its shell plated in riveted iron
  // whose rivets glow like a ship's portholes.
  terradon(k) {
    const iron = "#4a5260",
      navy = "#1f2a48",
      rivet = "#ffcf7a";
    const c = cx(k);
    if (k.back) {
      // Iron straps across the shell, rivets lit in a run.
      const ys = [k.T + 16, k.T + 38];
      k.put("scarf", ys.map((y) => k.path(`M${k.L + 2} ${y}Q${k.C} ${y - 8} ${k.R - 2} ${y}L${k.R - 2} ${y + 6}Q${k.C} ${y - 2} ${k.L + 2} ${y + 6}Z`, iron, k.ink, 0.9)).join("") +
        k.rect(k.C - 3.5, k.T + 4, 7, 50, 2, iron, k.ink, 0.9) +
        ys.map((y, j) => [-20, -10, 10, 20].map((dx, i) => k.lume("chase", k.circle(k.C + dx, y + 3 - Math.abs(dx) * 0.12, 1.5, rivet, k.ink, 0.4), i + j * 4, rivet)).join("")).join(""));
    } else {
      k.put("body", coat(k, iron, GOLD, "#d8dce4", [0, 1, 2, 3].map((i) => k.circle(k.L + 3, k.T + 6 + i * 7, 0.9, "#9aa4b4", "none", 0) + k.circle(k.R - 3, k.T + 6 + i * 7, 0.9, "#9aa4b4", "none", 0)).join("")) + belt(k, navy, rivet));
      // In profile the plated shell shows behind.
      if (k.side) k.put("flame", [16, 28].map((dx, i) => k.rect(k.C - k.side * dx - 2.5, k.T + 4, 5, k.B - k.T - 4, 2, iron, k.ink, 0.8) + [0, 1, 2].map((j) => k.lume("chase", k.circle(k.C - k.side * dx, k.T + 10 + j * 11, 1.3, rivet, k.ink, 0.4), i * 3 + j, rivet)).join("")).join(""));
    }
    // The cap: a white crown on a navy band; a visor and badge in front.
    const x = k.hx + k.side * 2,
      y = k.ht + 22;
    const visor = k.back ? "" : k.side
      ? k.path(`M${x + k.side * 16} ${y + 1}Q${x + k.side * 34} ${y + 1} ${x + k.side * 46} ${y + 7}L${x + k.side * 20} ${y + 7}Z`, "#15161c")
      : k.path(`M${x - 28} ${y + 3}Q${x} ${y + 13} ${x + 28} ${y + 3}Q${x} ${y + 6} ${x - 28} ${y + 3}Z`, "#15161c");
    const bx = k.side ? x + k.side * 28 : x;
    const badge = k.back ? "" : k.lume("pulse", k.line(`M${bx} ${y - 5}V${y + 3}M${bx - 3} ${y - 3}H${bx + 3}`, GOLD, 1.4) + k.path(`M${bx - 4} ${y + 1}Q${bx} ${y + 5} ${bx + 4} ${y + 1}`, "none", GOLD, 1.4), 0, "#ffe08a");
    k.put("flame", `<ellipse cx="${x}" cy="${y - 12}" rx="40" ry="11" fill="#f4f4f0" stroke="${k.ink}" stroke-width="1.1"/>` + headBand(k, y - 6, 33, 8, navy) + k.line(`M${x - 33} ${y - 6}Q${x} ${y - 15} ${x + 33} ${y - 6}`, GOLD, 1.2) + visor + badge);
  },
  // Rigging Runner: a red headband knotted behind, a striped shirt, a coil
  // of rope slung across the body with lamps lit along it in a run, and a
  // grappling hook at the left hip that glints.
  coilemur(k) {
    const blue = "#2f5d8c",
      rope = "#c8a26a",
      lamp = "#ffcf5a";
    const c = cx(k);
    const ropeLine = (x0: number, y0: number, x1: number, y1: number) =>
      k.line(`M${x0} ${y0}L${x1} ${y1}`, "#8a6a3a", 6) + k.line(`M${x0} ${y0}L${x1} ${y1}`, rope, 4.4) +
      `<path d="M${x0} ${y0}L${x1} ${y1}" stroke="#8a6a3a" stroke-width="4.4" stroke-dasharray="1 3" fill="none"/>` +
      [0.25, 0.5, 0.75].map((t, i) => k.lume("chase", k.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, 1.8, lamp, k.ink, 0.4), i, lamp)).join("");
    const stripes = [0, 1, 2, 3, 4].map((i) => k.line(`M${k.L} ${k.T + 3 + i * 8}H${k.R}`, blue, 2.4)).join("");
    // The rope goes over the right shoulder to the left hip.
    if (k.back) backPanel(k, "#f4ecd8", stripes + ropeLine(k.R - 2, k.T, k.L + 4, k.B - 6));
    else if (k.side) k.put("body", torso(k, "#f4ecd8", stripes) + profile(k, k.C, ropeLine(k.C - 10, k.T, k.C + 12, k.B - 8)));
    else k.put("body", torso(k, "#f4ecd8", stripes) + ropeLine(k.L + 2, k.T - 1, k.R - 4, k.B - 6));
    // The grappling hook at its left hip.
    const hx = k.back ? k.L - 8 : k.side ? k.C - k.side * 9 : k.R + 8,
      hy = k.B - 4;
    k.put("flame", k.line(`M${hx} ${hy - 12}V${hy + 4}`, "#7a7f8a", 2) +
      k.lume("twinkle", k.path(`M${hx - 7} ${hy - 1}Q${hx - 7} ${hy + 7} ${hx} ${hy + 5}Q${hx + 7} ${hy + 7} ${hx + 7} ${hy - 1}`, "none", "#c9d0da", 2.2) + k.circle(hx - 7, hy - 1, 1.2, "#ffffff", "none", 0) + k.circle(hx + 7, hy - 1, 1.2, "#ffffff", "none", 0), 3, "#ffffff") +
      k.circle(hx, hy - 13, 2.4, "none", "#7a7f8a", 1.4));
    const y = k.ht + 12;
    k.put("flame", headBand(k, y, 36, 7, "#c8282e") + backKnot(k, y, 36, "#c8282e"));
  },
  // Spice Raider: a saffron turban with a glowing ruby and a tall plume, an
  // embroidered teal vest, and spice pouches at the sash that sparkle.
  pyranda(k) {
    const vest = "#1f6e6a",
      saffron = "#e8a23a",
      ruby = "#ff4a5a";
    const c = cx(k);
    if (k.back) backPanel(k, vest, [0, 1, 2].map((i) => k.circle(k.C - 10 + i * 10, k.T + 14, 1.6, GOLD, "none", 0)).join("") + k.rect(k.L, k.B - 12, k.R - k.L, 6, 0, GOLD, "none"));
    else {
      k.put("body", torso(k, "#f4ecd8", k.path(`M${k.L - 2} ${k.T - 2}H${c - 6}L${c - 4} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 6}L${c + 4} ${k.B + 4}H${k.R + 2}Z`, vest, k.ink, 0.8) +
        [0, 1, 2, 3].map((i) => k.circle(c - 9, k.T + 4 + i * 7, 1, GOLD, "none", 0) + k.circle(c + 9, k.T + 4 + i * 7, 1, GOLD, "none", 0)).join("") + belt(k, GOLD)));
      // Spice pouches hanging from the sash, a sparkle of spice above each.
      const xs = k.side ? [c - k.side * 2, c + k.side * 8] : [c - 16, c + 13];
      const cols = ["#c8323a", "#f2c14e", "#3f8a4f"];
      // Drawn over the arms: they hang at the front of the sash.
      k.put("flame", xs.map((px, i) => k.path(`M${px - 5} ${k.B - 8}Q${px - 8} ${k.B + 4} ${px} ${k.B + 6}Q${px + 8} ${k.B + 4} ${px + 5} ${k.B - 8}Z`, cols[i], k.ink, 0.8) +
        k.line(`M${px - 4} ${k.B - 7}H${px + 4}`, "#3a2a1c", 1.2) + k.lume("twinkle", k.path(k.star(px + 3, k.B - 12, 3.2, 4), "#fff3b0", "none"), i, "#fff3b0")).join(""));
    }
    // The turban: wrapped folds, a ruby at the front, a plume rising from it.
    const x = k.hx + k.side * 2,
      y = k.ht + 17;
    const folds = [7, 15, 23].map((dy) => k.line(`M${x - 35 + dy * 0.45} ${y - dy}Q${x} ${y - dy - 9} ${x + 35 - dy * 0.45} ${y - dy + 3}`, "#c8862a", 1.4)).join("") +
      // The wrap's end crossing the front.
      (k.back ? "" : profile(k, x, k.path(`M${x - (k.side ? 4 : 24)} ${y + 1}Q${x + (k.side ? 10 : -4)} ${y - 14} ${x + (k.side ? 26 : 18)} ${y - 26}L${x + (k.side ? 30 : 24)} ${y - 20}Q${x + (k.side ? 16 : 4)} ${y - 8} ${x + (k.side ? 4 : -14)} ${y + 3}Z`, "#f2b84a", k.ink, 0.8)));
    const rx = k.side ? x + k.side * 30 : x;
    const plume = turn(k, x, profile(k, x, k.path(`M${x + 2} ${y - 14}Q${x + 6} ${y - 34} ${x + 22} ${y - 44}Q${x + 14} ${y - 30} ${x + 6} ${y - 13}Z`, "#2fb8a8", k.ink, 0.8)));
    k.put("flame", plume + dome(k, y, 38, 30, saffron) + folds +
      (k.back ? "" : k.circle(rx, y - 10, 4.6, GOLD, GOLD_DARK, 0.8) + k.lume("pulse", k.circle(rx, y - 10, 3, ruby, "none", 0), 0, ruby)));
  },
  // Frost Privateer: an ice-blue tricorne edged in white fur with a glowing
  // ice-crystal cockade, a fur-collared coat and snowflake buttons that glint.
  glacelle(k) {
    const ice = "#3f78a8",
      fur = "#f4fbff",
      crystal = "#bff4ff";
    const flake = (x: number, y: number, r: number) => [0, 60, 120].map((a) => {
      const dx = Math.cos((a * Math.PI) / 180) * r,
        dy = Math.sin((a * Math.PI) / 180) * r;
      return `M${x - dx} ${y - dy}L${x + dx} ${y + dy}`;
    }).join("");
    const collar = (y: number) => [0, 1, 2, 3, 4, 5, 6].map((i) => k.circle(k.L + 2 + ((k.R - k.L - 4) * i) / 6, y + (i % 2) * 1.5, 3.4, fur, "#c8d8e4", 0.6)).join("");
    if (k.back) backPanel(k, ice, collar(k.T - 1));
    else {
      const c = cx(k);
      k.put("body", coat(k, ice, fur, "#dff0fa") + collar(k.T - 2) +
        [0, 1, 2].map((i) => k.lume("twinkle", k.line(flake(c + (k.side ? k.side * 8 : 11), k.T + 12 + i * 9, 2.6), crystal, 1.1), i + 1, crystal)).join(""));
    }
    const y = k.ht + 14,
      w = k.side ? 30 : 38;
    const x = k.hx + k.side * 3;
    const h = w * 0.62;
    const cock = k.back ? "" : k.side ? [x + k.side * w * 0.55, y - h * 0.55] : [x, y - h * 0.28];
    k.put("flame", tricorne(k, y, w, "#2f5f8f", fur) +
      (cock ? k.lume("pulse", k.line(flake(cock[0] as number, cock[1] as number, 5), crystal, 1.8) + k.circle(cock[0] as number, cock[1] as number, 1.6, "#ffffff", "none", 0), 0, crystal) : ""));
  },
  // Crow's Nest Ace: a leather aviator cap with flight goggles pushed up on
  // the brow, their lenses lit, a fur-collared flight jacket, a white scarf
  // streaming, and a spyglass at the right hip.
  halcyra(k) {
    const leather = "#7a4a2a",
      lens = "#ffcf5a";
    const c = cx(k);
    const collar = k.path(`M${k.L - 2} ${k.T - 2}Q${k.C} ${k.T + 8} ${k.R + 2} ${k.T - 2}L${k.R} ${k.T + 4}Q${k.C} ${k.T + 14} ${k.L} ${k.T + 4}Z`, "#e8dcc4", k.ink, 0.8);
    if (k.back) backPanel(k, leather, collar + k.path(`M${k.C - 4} ${k.T}Q${k.C - 18} ${k.T + 10} ${k.L - 10} ${k.T + 22}L${k.L - 6} ${k.T + 14}Q${k.C - 10} ${k.T + 4} ${k.C + 4} ${k.T}Z`, "#ffffff", k.ink, 0.7));
    else {
      k.put("body", coat(k, leather, "#5a321a", "#c8b48a") + collar + belt(k, "#3a2418"));
      // The scarf, its tail streaming to the left (back in profile).
      const d = k.side ? -k.side : 1;
      k.put("body", k.path(`M${c - 6} ${k.T}Q${c} ${k.T + 6} ${c + 6} ${k.T}Q${c + d * 18} ${k.T + 4} ${c + d * 32} ${k.T + 14}L${c + d * 26} ${k.T + 18}Q${c + d * 14} ${k.T + 10} ${c} ${k.T + 8}Z`, "#ffffff", k.ink, 0.8));
    }
    // The spyglass at its right hip, lens forward.
    const d = k.back ? 1 : k.side ? k.side : -1;
    const sx = k.back ? k.R + 14 : k.side ? k.C + k.side * 8 : k.L - 14;
    k.put("flame", spyglass(k, sx, k.B - 4, d, "#bfe8ff", 2));
    // The cap: a leather dome with flaps over the sides of the head.
    const x = k.hx + k.side * 2,
      y = k.ht + 22;
    const flaps = k.side
      ? k.path(`M${x - k.side * 20} ${y - 2}Q${x - k.side * 6} ${y - 2} ${x - k.side * 8} ${y + 14}Q${x - k.side * 16} ${y + 18} ${x - k.side * 22} ${y + 10}Z`, leather)
      : [-1, 1].map((s) => k.path(`M${x + s * 30} ${y - 2}Q${x + s * 42} ${y} ${x + s * 42} ${y + 14}Q${x + s * 38} ${y + 20} ${x + s * 32} ${y + 14}Z`, leather)).join("");
    const goggles = k.back ? k.line(`M${x - 38} ${y - 6}Q${x} ${y - 14} ${x + 38} ${y - 6}`, "#3a2418", 3)
      : k.side
        ? k.line(`M${x - k.side * 30} ${y - 6}Q${x} ${y - 13} ${x + k.side * 22} ${y - 8}`, "#3a2418", 3) + k.circle(x + k.side * 20, y - 8, 7.5, "#b8823a", k.ink, 0.9) + k.lume("pulse", k.circle(x + k.side * 20, y - 8, 5, lens, "none", 0), 0, lens)
        : k.line(`M${x - 38} ${y - 6}Q${x} ${y - 14} ${x + 38} ${y - 6}`, "#3a2418", 3) + [-13, 13].map((dx) => k.circle(x + dx, y - 9, 8, "#b8823a", k.ink, 0.9) + k.lume("pulse", k.circle(x + dx, y - 9, 5.4, lens, "none", 0), 0, lens)).join("") + k.line(`M${x - 5} ${y - 10}H${x + 5}`, "#b8823a", 2);
    k.put("flame", flaps + dome(k, y, 38, 26, leather) + k.line(`M${x} ${y - 34}V${y - 2}`, "#5a321a", 1.2) + goggles);
  },
  // Moonsail Bosun: a white sailor's cap tipped over one ear with a moon
  // pin, a sailor shirt with a square navy collar and red neckerchief, and a
  // bosun's whistle on its lanyard that glows.
  astrabun(k) {
    const navy = "#1f2f5c",
      whistle = "#ffe08a";
    const c = cx(k);
    if (k.back) backPanel(k, "#f7f7fb", k.rect(k.L + 1, k.T - 2, k.R - k.L - 2, 20, 1, navy, k.ink, 0.8) + [3, 6].map((o) => k.rect(k.L + 1 + o, k.T - 2 + o, k.R - k.L - 2 - o * 2, 20 - o * 2, 0, "none", "#ffffff", 1)).join(""));
    else {
      const collar = k.side
        ? k.path(`M${k.C - k.side * 14} ${k.T - 2}L${k.C + k.side * 6} ${k.T + 10}L${k.C - k.side * 14} ${k.T + 14}Z`, navy, k.ink, 0.8)
        : k.path(`M${k.L} ${k.T - 2}L${c} ${k.T + 16}L${k.R} ${k.T - 2}L${k.R} ${k.T + 4}L${c} ${k.T + 22}L${k.L} ${k.T + 4}Z`, navy, k.ink, 0.8) + k.line(`M${k.L + 3} ${k.T + 1}L${c} ${k.T + 18}L${k.R - 3} ${k.T + 1}`, "#ffffff", 0.9);
      k.put("body", torso(k, "#f7f7fb", k.line(`M${k.L} ${k.B - 6}H${k.R}`, navy, 2.4)) + collar +
        k.path(`M${c - 4} ${k.T + 12}L${c + 4} ${k.T + 12}L${c + 2} ${k.T + 22}L${c} ${k.T + 18}L${c - 2} ${k.T + 22}Z`, "#c8323a", k.ink, 0.6));
      // The whistle on its lanyard at the chest's left.
      const wx = k.side ? c + k.side * 4 : c + 11;
      k.put("body", k.line(`M${c - (k.side ? 0 : 6)} ${k.T + 2}Q${wx} ${k.T + 10} ${wx} ${k.T + 16}`, "#ffffff", 0.9) +
        k.lume("pulse", k.rect(wx - 1.5, k.T + 16, 3, 9, 1.2, whistle, GOLD_DARK, 0.6) + k.circle(wx, k.T + 26, 2.2, whistle, GOLD_DARK, 0.6), 0, whistle));
    }
    // The sailor's cap, tipped toward its left ear (the viewer's right from
    // the front, left from behind), upright in profile.
    const x = k.side ? k.hx - k.side * 2 : k.hx + (k.back ? -10 : 10),
      y = k.ht + 14;
    const tilt = k.side ? 0 : k.back ? -12 : 12;
    const pin = k.back ? "" : k.lume("twinkle", k.path(`M${x + k.side * 12 + 4} ${y - 8}A5 5 0 1 0 ${x + k.side * 12 + 4} ${y + 1}A4 4 0 1 1 ${x + k.side * 12 + 4} ${y - 8}Z`, "#fff3c4", k.ink, 0.5), 1, "#fff3c4");
    k.put("flame", `<g transform="rotate(${tilt} ${x} ${y})">` + dome(k, y - 3, 18, 14, "#f7f7fb", x) +
      `<ellipse cx="${x}" cy="${y}" rx="22" ry="6" fill="#f7f7fb" stroke="${k.ink}" stroke-width="1"/>` + k.line(`M${x - 20} ${y - 1}Q${x} ${y + 4} ${x + 20} ${y - 1}`, "#d8d8e4", 1) + pin + "</g>");
  },
  // Anchor Warden: a yellow oilskin sou'wester, a navy pea coat with double
  // brass buttons, and a great anchor slung over the right shoulder whose
  // ring glows, its chain lit link by link.
  wombolder(k) {
    const navy = "#1f2a48",
      oil = "#f2c14e",
      glowC = "#9fe2ff";
    const anchor = (x0: number, y0: number, x1: number, y1: number) => {
      const ang = Math.atan2(y1 - y0, x1 - x0),
        px = -Math.sin(ang),
        py = Math.cos(ang);
      return k.line(`M${x0} ${y0}L${x1} ${y1}`, "#5a6270", 4.2) +
        k.line(`M${x0 + (x1 - x0) * 0.15 + px * 9} ${y0 + (y1 - y0) * 0.15 + py * 9}L${x0 + (x1 - x0) * 0.15 - px * 9} ${y0 + (y1 - y0) * 0.15 - py * 9}`, "#5a6270", 3.4) +
        k.path(`M${x1 + px * 14} ${y1 + py * 14 - 6}Q${x1 + (x1 - x0) * 0.12} ${y1 + (y1 - y0) * 0.12 + 4} ${x1 - px * 14} ${y1 - py * 14 - 6}`, "none", "#5a6270", 3.8) +
        k.lume("pulse", `<circle cx="${x0}" cy="${y0}" r="5" fill="none" stroke="${glowC}" stroke-width="2.4"/>`, 0, glowC) +
        [0.3, 0.5, 0.7].map((t, i) => k.lume("chase", k.circle(x0 + (x1 - x0) * t + px * 4, y0 + (y1 - y0) * t + py * 4, 1.5, glowC, "none", 0), i + 1, glowC)).join("");
    };
    if (k.back) {
      backPanel(k, navy, k.line(`M${k.C} ${k.T + 18}V${k.B + 2}`, "#14203f", 1.4));
      k.put("scarf", anchor(k.R + 4, k.T - 16, k.L + 12, k.B + 2));
    } else {
      const c = cx(k);
      k.put("body", coat(k, navy, GOLD, "#3a3f52", k.side ? "" : [0, 1, 2].map((i) => k.circle(c - 16, k.T + 8 + i * 9, 1.6, GOLD, GOLD_DARK, 0.4) + k.circle(c + 16, k.T + 8 + i * 9, 1.6, GOLD, GOLD_DARK, 0.4)).join("")) + belt(k, "#2f3f6a", glowC));
      // The anchor behind the back, its ring above the right shoulder.
      // In profile it lies across the back, over the shell.
      if (k.side) k.put("body", anchor(k.C - k.side * 34, k.T - 8, k.C - k.side * 14, k.B + 6));
      else k.put("body", anchor(k.hx - 56, k.T - 20, k.C - 10, k.B + 4), true);
    }
    // The sou'wester: a rounded crown and a brim that runs long at the back.
    const x = k.hx + k.side * 2,
      y = k.ht + 17;
    const brim = k.side
      ? k.path(`M${x + k.side * 34} ${y - 2}Q${x} ${y + 4} ${x - k.side * 50} ${y + 12}Q${x - k.side * 44} ${y + 4} ${x} ${y - 4}Q${x + k.side * 24} ${y - 6} ${x + k.side * 34} ${y - 2}Z`, oil)
      : `<ellipse cx="${x}" cy="${y}" rx="${k.back ? 54 : 50}" ry="${k.back ? 10 : 7}" fill="${oil}" stroke="${k.ink}" stroke-width="1.1"/>`;
    k.put("flame", brim + dome(k, y - 2, 36, 22, oil) + k.line(`M${x - 34} ${y - 6}Q${x} ${y - 14} ${x + 34} ${y - 6}`, "#c8962a", 1.4) + k.line(`M${x} ${y - 30}V${y - 6}`, "#c8962a", 1));
  },
  // Jungle Corsair: a leaf-print bandana with a hibiscus at its knot, a vine
  // sash where fireflies light up one after another, a machete at the right
  // hip and a firefly jar glowing at the left.
  pangrove(k) {
    const leaf = "#2f7a3f",
      fly = "#d8ff6a";
    const c = cx(k);
    const vine = (x0: number, y0: number, x1: number, y1: number) => k.line(`M${x0} ${y0}Q${(x0 + x1) / 2 + 6} ${(y0 + y1) / 2 - 6} ${x1} ${y1}`, "#3f6a2a", 2.6) +
      [0.2, 0.45, 0.7].map((t) => k.path(`M${x0 + (x1 - x0) * t} ${y0 + (y1 - y0) * t}q4 -6 9 -3q-4 6 -9 3Z`, "#5fae4a", k.ink, 0.4)).join("") +
      [0.32, 0.58, 0.84].map((t, i) => k.lume("chase", k.circle(x0 + (x1 - x0) * t + 2, y0 + (y1 - y0) * t - 4, 1.6, fly, "none", 0), i, fly)).join("");
    if (k.back) backPanel(k, "#8a6a3a", vine(k.R - 2, k.T, k.L + 4, k.B - 6));
    else {
      k.put("body", torso(k, "#f4ecd8", k.path(`M${k.L - 2} ${k.T - 2}H${c - 6}L${c - 4} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 6}L${c + 4} ${k.B + 4}H${k.R + 2}Z`, "#8a6a3a", k.ink, 0.8)) +
        (k.side ? profile(k, k.C, vine(k.C - 10, k.T, k.C + 12, k.B - 8)) : vine(k.L + 2, k.T - 1, k.R - 4, k.B - 6)));
    }
    // The machete at its right hip, the firefly jar at its left.
    const mx = k.back ? k.R + 6 : k.side ? k.C - k.side * 4 : k.L - 6,
      jx = k.back ? k.L - 8 : k.side ? k.C - k.side * 14 : k.R + 8,
      y = k.B - 6;
    const md = k.back ? 1 : k.side ? -k.side : -1;
    k.put("flame", k.rect(mx - 2, y - 10, 4, 9, 1.5, "#5a3a22", k.ink, 0.6) + k.path(`M${mx - 2.5} ${y - 1}L${mx + 2.5} ${y - 1}Q${mx + md * 8} ${y + 12} ${mx + md * 2} ${y + 20}Q${mx - md * 1} ${y + 10} ${mx - 2.5} ${y - 1}Z`, "#c9d0da", k.ink, 0.7));
    k.put("flame", k.rect(jx - 5, y - 6, 10, 12, 3, "#bfe8d0aa", k.ink, 0.8) + k.rect(jx - 4, y - 8, 8, 3, 1, "#8a6a3a", k.ink, 0.5) +
      k.lume("pulse", k.circle(jx - 1.5, y, 1.6, fly, "none", 0) + k.circle(jx + 2, y + 2.5, 1.3, fly, "none", 0) + k.circle(jx + 1, y - 2.5, 1.2, fly, "none", 0), 3, fly));
    // The bandana, a hibiscus at the knot.
    const bx = k.hx + k.side * 2,
      by = k.ht + 11;
    const kx = k.back ? bx : k.side ? bx - k.side * 34 : bx + 33;
    const hib = Array.from({ length: 5 }, (_, j) => {
      const a = (j / 5) * Math.PI * 2;
      return k.circle(kx + Math.cos(a) * 3.4, by - 2 + Math.sin(a) * 3.4, 3, "#ff5a8a", k.ink, 0.5);
    }).join("") + k.circle(kx, by - 2, 1.6, "#ffd65b", "none", 0);
    k.put("flame", headBand(k, by, 36, 9, leaf) + [-20, -6, 8, 22].map((dx) => (k.side && dx * k.side > 14) ? "" : k.path(`M${bx + dx - 3} ${by + 4}q3 -4 6 0q-3 3 -6 0Z`, "#5fae4a", "none")).join("") + backKnot(k, by + 1, 36, leaf) + hib);
  },
  // Hammock Pirate: a drooping striped stocking cap whose pom glows like a
  // night-light, a loose shirt with a rope belt, and its hammock rolled
  // across the back, strung with lights.
  mossloth(k) {
    const red = "#c8323a",
      cream = "#f4ecd8",
      bulb = "#ffd27a";
    const roll = (x0: number, x1: number, y: number) => k.rect(x0, y - 6, x1 - x0, 12, 6, "#e8d6a6", k.ink, 0.9) +
      Array.from({ length: Math.floor((x1 - x0) / 7) }, (_, i) => k.line(`M${x0 + 4 + i * 7} ${y - 6}l4 12`, "#b8a27a", 0.7)).join("") +
      Array.from({ length: Math.max(2, Math.floor((x1 - x0) / 12)) }, (_, i) => k.lume("chase", k.circle(x0 + 6 + i * 12, y - 6.5, 1.6, bulb, k.ink, 0.3), i, bulb)).join("");
    if (k.back) {
      backPanel(k, "#6a5a3a", k.line(`M${k.L} ${k.B - 10}H${k.R}`, "#c8a26a", 2.4));
      k.put("scarf", roll(k.L - 12, k.R + 12, k.T + 4));
    } else {
      const c = cx(k);
      k.put("body", torso(k, cream, k.path(`M${c - 7} ${k.T - 2}L${c} ${k.T + 10}L${c + 7} ${k.T - 2}Z`, "#b89a7a", k.ink, 0.6) +
        k.path(`M${k.L - 2} ${k.T - 2}H${c - 9}L${c - 6} ${k.B + 4}H${k.L - 2}Z M${k.R + 2} ${k.T - 2}H${c + 9}L${c + 6} ${k.B + 4}H${k.R + 2}Z`, "#6a5a3a", k.ink, 0.8) +
        k.line(`M${k.L} ${k.B - 10}Q${c} ${k.B - 6} ${k.R} ${k.B - 10}`, "#c8a26a", 2.4)));
      // The rolled hammock behind the shoulders, its ends showing.
      if (k.side) k.put("body", `<ellipse cx="${k.C - k.side * 22}" cy="${k.T + 4}" rx="9" ry="8" fill="#e8d6a6" stroke="${k.ink}" stroke-width="0.9"/>` + k.lume("chase", k.circle(k.C - k.side * 22, k.T - 3, 1.6, bulb, k.ink, 0.3), 0, bulb));
      else k.put("body", roll(k.L - 16, k.L + 6, k.T - 2) + roll(k.R - 6, k.R + 16, k.T - 2), true);
    }
    // The stocking cap, its tail flopping to its left (the viewer's right from
    // the front, left from behind, back in profile), the pom at the end.
    const x = k.hx + k.side * 2,
      y = k.ht + 12;
    const d = k.back ? -1 : k.side ? -k.side : 1;
    const tail = k.path(`M${x - d * 10} ${y - 22}Q${x + d * 34} ${y - 44} ${x + d * 50} ${y + 2}L${x + d * 42} ${y + 4}Q${x + d * 30} ${y - 26} ${x + d * 6} ${y - 14}Z`, red) +
      k.line(`M${x + d * 16} ${y - 30}l${d * 5} 10M${x + d * 32} ${y - 26}l${d * 3} 11`, cream, 3);
    k.put("flame", dome(k, y, 38, 20, red) + k.line(`M${x - 34} ${y - 9}Q${x} ${y - 22} ${x + 34} ${y - 9}`, cream, 3) + tail +
      headBand(k, y - 2, 38, 7, cream) + k.lume("pulse", k.circle(x + d * 47, y + 6, 6.5, "#fff3c4", k.ink, 0.8), 0, "#fff3c4"));
  },
};

const T = (hue: number, sat: number, lift = 0, mix = 0.85): Tint => ({ hue, mix, sat, lift: [0.02 + lift, -0.04 + lift, -0.06 + lift] });
/** A body colour per captain, suiting its post, spread so no two look alike. */
export const PIRATE_TINTS: Record<CharacterId, Tint> = {
  voltkit: T(215, 0.3), // Storm Corsair: storm slate
  cindrake: T(355, 0.75, -0.08), // Cinder Buccaneer: ember crimson
  tidefin: T(165, 0.5), // Tide Admiral: sea foam
  auralynx: T(255, 0.5, -0.12), // Prism Navigator: twilight indigo
  lumoth: T(45, 0.65, 0.12), // Lantern Lookout: lantern gold
  mystowl: T(35, 0.45, 0.04), // Chart Quartermaster: old parchment
  terradon: T(210, 0.06, -0.1), // Ironhull Captain: gunmetal
  duskveil: T(150, 0.55, 0.02), // Ghost Ship Wisp: ghost green
  coilemur: T(55, 0.3, 0.08), // Rigging Runner: sailcloth
  pyranda: T(20, 0.55, -0.12), // Spice Raider: cinnamon
  glacelle: T(190, 0.2, -0.25), // Frost Privateer: hoarfrost
  halcyra: T(232, 0.2, -0.18), // Crow's Nest Ace: crow black
  sunbara: T(18, 0.75, 0.04), // Sunset Skipper: sunset coral
  astrabun: T(300, 0.5, -0.12), // Moonsail Bosun: moonlit orchid
  wombolder: T(140, 0.25, -0.04), // Anchor Warden: sea moss
  shadopus: T(190, 0.65, -0.06), // Kraken Captain: deep-sea teal
  pangrove: T(75, 0.8, 0.06), // Jungle Corsair: jungle lime
  mossloth: T(335, 0.3, 0.06), // Hammock Pirate: sleepy rose
};

Object.assign((DESIGNS.pirates ??= {}), PIRATES);

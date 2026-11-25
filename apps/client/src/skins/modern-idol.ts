import type { CharacterId } from "@arena/shared";
import { DESIGNS, backUnder, hatShape, torso, type Design, type Kit } from "./modern-designs";

/**
 * Starlight Idol for the rest of the roster: one show, and a stage act of
 * its own for every champion, with a costume cut for the act and something
 * on it that lights up (Cindrake's marquee lapels, Lumoth's mirror ball,
 * Shadopus's halo, Wombolder's crystal mohawk...). Voltkit, Mystowl,
 * Terradon, Tidefin and Sunbara are in modern-designs.ts.
 */
const cx = (k: Kit) => k.C + k.side * 3;
/** The head's middle in this view. */
const hx = (k: Kit) => k.hx + k.side * 2;
const PINK = "#ff6fae",
  GOLD = "#ffd84a",
  WHITE = "#ffffff";
/** A four-point glint that twinkles. */
const glint = (k: Kit, x: number, y: number, r: number, i: number, color = WHITE) => k.lume("twinkle", k.path(k.star(x, y, r, 4, 0.32), color, "none", 0), i, color);
/** A band round the brow, curving with the head. */
const band = (k: Kit, y: number, w: number, fill: string, h = 6) => {
  const x = hx(k);
  return k.path(`M${x - w} ${y + 2}Q${x} ${y - 8} ${x + w} ${y + 2}L${x + w - 1} ${y + 2 + h}Q${x} ${y - 8 + h} ${x - w + 1} ${y + 2 + h}Z`, fill);
};
/** A ribbon bow, w across. */
const bow = (k: Kit, x: number, y: number, w: number, fill: string, knot: string) =>
  k.path(`M${x} ${y}C${x - w * 0.35} ${y - w * 0.6} ${x - w} ${y - w * 0.6} ${x - w} ${y - w * 0.1}C${x - w} ${y + w * 0.4} ${x - w * 0.35} ${y + w * 0.4} ${x} ${y}Z`, fill) +
  k.path(`M${x} ${y}C${x + w * 0.35} ${y - w * 0.6} ${x + w} ${y - w * 0.6} ${x + w} ${y - w * 0.1}C${x + w} ${y + w * 0.4} ${x + w * 0.35} ${y + w * 0.4} ${x} ${y}Z`, fill) +
  k.circle(x, y, w * 0.2, knot);
/** Over-ear headphones: a band over the head and a cup each side (one, the near one, in profile). */
function headphones(k: Kit, shell: string, pad: string, glow: string, top = -10, span = 46) {
  const x = k.hx,
    y = k.ht + 44;
  const cup = (cxp: number, i: number) =>
    k.circle(cxp, y, 10, shell) + k.circle(cxp, y, 6.4, pad, k.ink, 0.5) + k.lume("pulse", `<circle cx="${cxp}" cy="${y}" r="8.2" fill="none" stroke="${glow}" stroke-width="1.5"/>`, i, glow);
  if (k.side) {
    const e = x - k.side * 16;
    return k.line(`M${e} ${y - 9}Q${e - k.side * 4} ${k.ht + top + 4} ${e + k.side * 18} ${k.ht + top + 6}`, shell, 4) + cup(e, 0);
  }
  return k.line(`M${x - span} ${y - 8}C${x - span} ${k.ht + top - 14} ${x + span} ${k.ht + top - 14} ${x + span} ${y - 8}`, shell, 4) + cup(x - span, 0) + cup(x + span, 1);
}
/** A music note (a quaver), its head at (x, y). */
const note = (k: Kit, x: number, y: number, s: number, color: string) =>
  `<ellipse cx="${x}" cy="${y}" rx="${2.6 * s}" ry="${2 * s}" fill="${color}" transform="rotate(-20 ${x} ${y})"/>` +
  k.line(`M${x + 2.2 * s} ${y - 0.6 * s}V${y - 9 * s}Q${x + 5 * s} ${y - 8 * s} ${x + 6 * s} ${y - 5 * s}`, color, 1.3 * s);

export const IDOL: Partial<Record<CharacterId, Design>> = {
  // Pyro Headliner: a crimson show jacket whose gold lapels run with
  // marquee bulbs, a jewelled circlet under its own flame, and a headset mic.
  cindrake(k) {
    const coat = "#b3202e",
      lapel = "#f2c14e";
    const bulbs = (x0: number, y0: number, dx: number, dy: number, n: number, from = 0) =>
      Array.from({ length: n }, (_, i) => k.lume("chase", k.circle(x0 + dx * i, y0 + dy * i, 1.1, "#fff3a8", "none", 0), from + i, "#fff3a8")).join("");
    if (k.back)
      backUnder(k, coat, k.lume("pulse", k.path(k.star(k.C, k.T + 15, 8, 5), lapel, k.ink, 0.6), 0, lapel) + bulbs(k.C - k.W + 2, k.B - 1, (2 * k.W - 4) / 6, 0, 7));
    else {
      const c = cx(k);
      k.put("body", torso(k, coat,
        k.path(`M${c - 10} ${k.T - 1}L${c} ${k.T + 12}L${c + 10} ${k.T - 1}Z`, "#fff6e6", k.ink, 0.7) +
          k.path(`M${c - 11} ${k.T - 2}L${c - 2} ${k.T + 17}L${c - 15} ${k.T + 12}Z`, lapel, k.ink, 0.7) +
          k.path(`M${c + 11} ${k.T - 2}L${c + 2} ${k.T + 17}L${c + 15} ${k.T + 12}Z`, lapel, k.ink, 0.7) +
          bulbs(c - 11.5, k.T + 1, 1.7, 3.6, 4) + bulbs(c + 11.5, k.T + 1, -1.7, 3.6, 4) +
          // A fringe of gold along the hem.
          Array.from({ length: 9 }, (_, i) => k.line(`M${k.L + 1 + (i * (k.R - k.L - 2)) / 8} ${k.B - 5}v5`, lapel, 1.3)).join("")) +
        k.lume("pulse", k.path(k.star(c, k.T + 4, 3.6, 5), "#fff3a8", k.ink, 0.5), 0, "#fff3a8"));
    }
    // The circlet sits on the brow, under the flame, a ruby at its centre.
    const x = hx(k),
      y = k.ht + 15;
    const gemX = k.side ? x + k.side * 22 : x;
    k.put("flame", band(k, y, k.side ? 34 : 44, lapel, 5) +
      (k.back ? "" : k.path(`M${gemX} ${y - 9}l5 6l-5 6l-5 -6Z`, "#ff4f5a", k.ink, 0.6) + glint(k, gemX - 1.4, y - 4.6, 2.2, 3, "#ffd0d0") +
        // The headset's boom mic, from the far ear to the corner of the mouth.
        k.line(`M${x - (k.side || 1) * (k.side ? -30 : 44)} ${y + 28}Q${x - (k.side || 1) * (k.side ? -34 : 40)} ${y + 48} ${x - (k.side || 1) * (k.side ? -40 : 22)} ${y + 50}`, "#2a2a36", 1.5) +
        k.circle(x - (k.side || 1) * (k.side ? -41 : 21), y + 50, 2.4, "#2a2a36")));
  },
  // Prism Soloist: a pearl-white jacket crossed by three bands of stage
  // light, a prism pendant that glows, and a star tiara between the ears.
  auralynx(k) {
    const coat = "#2f2a66";
    const beams = ["#ff8fc8", "#8ff0ff", "#fff08a"];
    const stripes = (x0: number, x1: number) => beams.map((c, i) => k.line(`M${x0} ${k.T + 6 + i * 6}L${x1} ${k.T + 16 + i * 6}`, c, 3)).join("");
    if (k.back) backUnder(k, coat, stripes(k.C - k.W - 2, k.C + k.W + 2) + glint(k, k.C, k.T + 8, 3, 0));
    else {
      const c = cx(k);
      k.put("body", torso(k, coat, stripes(k.L - 2, k.R + 2) + k.path(`M${c - 9} ${k.T - 1}Q${c} ${k.T + 7} ${c + 9} ${k.T - 1}`, "none", "#b8a8e8", 1.6)) +
        // The pendant: a prism throwing a little rainbow.
        k.line(`M${c} ${k.T + 3}V${k.T + 8}`, "#b8a8e8", 0.8) +
        k.lume("pulse", k.path(`M${c} ${k.T + 7}l5 8h-10Z`, "#ffffff", k.ink, 0.6), 0, "#ffffff") +
        beams.map((b, i) => k.lume("twinkle", k.line(`M${c + 4} ${k.T + 13 + i * 1.6}l6 ${1 + i}`, b, 1.1), i + 1, b)).join(""));
    }
    // The tiara: a slim band, a big star at the middle and two small ones.
    const x = hx(k),
      y = k.ht + 14;
    const sx = k.side ? x + k.side * 20 : x;
    k.put("flame", band(k, y, k.side ? 34 : 40, "#ffd84a", 4) +
      (k.back ? "" : k.lume("pulse", k.path(k.star(sx, y - 8, 10, 5), "#fff7c2", k.ink, 0.7), 2, "#fff7c2") +
        (k.side ? "" : k.path(k.star(x - 20, y - 2, 3.6, 5), beams[0], k.ink, 0.5) + k.path(k.star(x + 20, y - 2, 3.6, 5), beams[1], k.ink, 0.5)) +
        glint(k, sx + 9, y - 14, 2.6, 4)));
  },
  // Disco Flutter: a sequinned jumpsuit with a wide white collar, and a
  // mirror ball between the antennae whose facets catch the light.
  lumoth(k) {
    const suit = "#7a3fd0";
    const sequins = (x0: number, w: number) => [0, 1, 2, 3, 4, 5, 6].map((i) => glint(k, x0 + 3 + ((i * 8.3) % (w - 6)), k.T + 10 + ((i * 6.1) % 16), 1.7, i, i % 2 ? "#ffe9ff" : "#fff3a8")).join("");
    if (k.back) backUnder(k, suit, sequins(k.C - k.W, 2 * k.W) + k.path(k.star(k.C, k.T + 14, 6, 5), GOLD, k.ink, 0.6));
    else {
      const c = cx(k);
      k.put("body", torso(k, suit, sequins(k.L, k.R - k.L) +
        // The wide collar's two points.
        k.path(`M${c} ${k.T + 3}L${c - 15} ${k.T - 2}L${c - 12} ${k.T + 12}Z`, WHITE, k.ink, 0.7) + k.path(`M${c} ${k.T + 3}L${c + 15} ${k.T - 2}L${c + 12} ${k.T + 12}Z`, WHITE, k.ink, 0.7) +
        k.rect(k.L - 2, k.B - 9, k.R - k.L + 4, 4, 0, GOLD, k.ink, 0.5)));
    }
    // The mirror ball hangs on a short chain over the brow.
    const x = hx(k) + k.side * 4,
      y = k.ht,
      r = 14;
    const facets = [-0.5, 0, 0.5].map((u) => `<path d="M${x - Math.sqrt(1 - u * u) * r} ${y + u * r}Q${x} ${y + u * r + 3} ${x + Math.sqrt(1 - u * u) * r} ${y + u * r}" fill="none" stroke="#7d8aa8" stroke-width=".7"/>`).join("") +
      [-0.5, 0, 0.5].map((u) => `<path d="M${x + u * r} ${y - Math.sqrt(1 - u * u) * r}Q${x + u * r * 1.5} ${y} ${x + u * r} ${y + Math.sqrt(1 - u * u) * r}" fill="none" stroke="#7d8aa8" stroke-width=".7"/>`).join("");
    k.put("flame", k.line(`M${x} ${y - r}v-6`, "#c9c9d6", 1.2) + k.circle(x, y, r, "#dfe6f5", k.ink, 0.9) + facets +
      k.circle(x - 4, y - 4, 3, "#ffffff", "none", 0) +
      glint(k, x + 6, y - 6, 3.4, 7) + glint(k, x - 7, y + 4, 2.6, 8, "#ffb3e6") + glint(k, x + 3, y + 7, 2.4, 9, "#9fe8ff") +
      // Light thrown off the ball.
      glint(k, x - 18, y - 8, 2.2, 10, "#fff3a8") + glint(k, x + 19, y - 2, 2.2, 11, "#ffb3e6"));
  },
  // Phantom Crooner: a black tuxedo with a white dickey and a red bow tie,
  // a rose in the lapel that glows, and a satin band with a rose on the hood.
  duskveil(k) {
    const tux = "#17161f",
      red = "#d8263a";
    const rose = (x: number, y: number, r: number, i: number) =>
      k.lume("pulse", k.circle(x, y, r, red, k.ink, 0.6) + k.line(`M${x - r * 0.5} ${y}q${r * 0.5} ${-r * 0.9} ${r} 0q${-r * 0.5} ${r * 0.7} ${-r * 0.7} ${-r * 0.1}`, "#ff8a96", 0.9), i, "#ff5a6e") +
      k.path(`M${x + r * 0.7} ${y + r * 0.7}q${r} 0 ${r * 1.2} ${r}q${-r} ${r * 0.2} ${-r * 1.2} ${-r}Z`, "#3f9a5a", k.ink, 0.4);
    if (k.back) backUnder(k, tux, k.path(`M${k.C - 5} ${k.B - 2}L${k.C} ${k.T + 12}L${k.C + 5} ${k.B - 2}`, "none", "#3a3848", 1.2));
    else {
      const c = cx(k);
      k.put("body", torso(k, tux,
        k.path(`M${c - 8} ${k.T - 1}L${c} ${k.T + 20}L${c + 8} ${k.T - 1}Z`, "#f7f4ee", k.ink, 0.7) +
          [0, 1].map((i) => k.circle(c, k.T + 9 + i * 5, 0.8, "#17161f", "none", 0)).join("") +
          k.path(`M${c - 9} ${k.T - 2}L${c - 2} ${k.T + 16}L${c - 14} ${k.T + 12}Z`, "#2b2a38", k.ink, 0.7) + k.path(`M${c + 9} ${k.T - 2}L${c + 2} ${k.T + 16}L${c + 14} ${k.T + 12}Z`, "#2b2a38", k.ink, 0.7)) +
        k.path(`M${c} ${k.T + 2}l-6 -3.4v6.8Z M${c} ${k.T + 2}l6 -3.4v6.8Z`, red, k.ink, 0.6) + k.circle(c, k.T + 2, 1.5, "#ff8a96", k.ink, 0.4) +
        rose(c + (k.side ? k.side * 8 : -11), k.T + 12, 2.8, 0));
    }
    // A little top hat, tipped, on the slope of the hood; a rose in its band.
    const x = hx(k) - (k.side ? k.side * 10 : 13),
      y = k.ht + 22;
    const tilt = k.side ? -k.side * 16 : -16;
    k.put("flame", `<g transform="rotate(${tilt} ${x} ${y})">` +
      k.path(`M${x - 19} ${y}Q${x} ${y + 7} ${x + 19} ${y}Q${x} ${y - 6} ${x - 19} ${y}Z`, tux) +
      k.path(`M${x - 11} ${y - 1}L${x - 12.5} ${y - 22}Q${x} ${y - 26} ${x + 12.5} ${y - 22}L${x + 11} ${y - 1}Q${x} ${y + 3} ${x - 11} ${y - 1}Z`, tux) +
      k.path(`M${x - 11.4} ${y - 6}Q${x} ${y - 2} ${x + 11.4} ${y - 6}L${x + 11} ${y - 1}Q${x} ${y + 3} ${x - 11} ${y - 1}Z`, red, k.ink, 0.6) +
      k.line(`M${x - 8} ${y - 19}Q${x - 9} ${y - 12} ${x - 8} ${y - 9}`, "#4a4860", 1.4) +
      (k.back ? "" : rose(x + (k.side ? k.side * 6 : 7), y - 4, 4.4, 1)) + "</g>" +
      (k.back ? "" : glint(k, x + 17, y - 22, 2.8, 2, "#ffd0d6")));
  },
  // Synth Looper: a stage jacket with an equaliser that runs across the
  // chest, a keytar's strap, and a neon visor over the brow.
  coilemur(k) {
    const coat = "#1f1b3a",
      cyan = "#59f0ff",
      mag = "#ff4fd8";
    const eq = (x0: number, w: number, y: number) =>
      [5, 9, 13, 8, 11, 6].map((h, i) => k.lume("chase", k.rect(x0 + (i * w) / 6 + 0.6, y - h, w / 6 - 1.4, h, 0.6, i % 2 ? mag : cyan, "none", 0), i, i % 2 ? mag : cyan)).join("");
    if (k.back) backUnder(k, coat, eq(k.C - k.W + 2, 2 * k.W - 4, k.T + 24));
    else {
      const c = cx(k);
      k.put("body", torso(k, coat, eq(k.L + 1, k.R - k.L - 2, k.B - 4) +
        // The strap, with the keytar's keys at the hip.
        k.line(`M${k.R} ${k.T + 1}L${k.L} ${k.B - 14}`, "#f2f2f8", 3.4) + k.line(`M${k.R} ${k.T + 1}L${k.L} ${k.B - 14}`, mag, 1) +
        k.path(`M${c - 8} ${k.T - 1}Q${c} ${k.T + 6} ${c + 8} ${k.T - 1}`, "none", cyan, 1.6)));
    }
    // The visor: a slim neon strip across the brow, lights running along it.
    const x = hx(k),
      y = k.ht + 15;
    const w = k.side ? 34 : 42;
    k.put("flame", band(k, y, w + 2, "#2a2a36", 4) +
      (k.back ? "" : k.path(`M${x - w} ${y + 5}Q${x} ${y - 4} ${x + w} ${y + 5}L${x + w - 3} ${y + 12}Q${x} ${y + 4} ${x - w + 3} ${y + 12}Z`, "#59f0ffaa", cyan, 1) +
        [0, 1, 2, 3, 4].map((i) => {
          const u = (i - 2) / 2.4;
          return k.lume("chase", k.circle(x + u * (w - 8), y + 7.4 - (1 - u * u) * 4.6, 1.2, WHITE, "none", 0), i, cyan);
        }).join("")));
  },
  // Chestnut MC: an oversized hoodie, a gold chain with a chestnut pendant
  // that glows, and a snapback worn to the side with a lit star badge.
  pyranda(k) {
    const hood = "#ffb52e";
    if (k.back) backUnder(k, hood, k.path(`M${k.C - 10} ${k.T + 2}Q${k.C} ${k.T + 14} ${k.C + 10} ${k.T + 2}`, "none", "#d88f12", 3) + k.lume("pulse", k.path(k.star(k.C, k.T + 20, 6, 5), WHITE, k.ink, 0.5), 0, WHITE));
    else {
      const c = cx(k);
      k.put("body", torso(k, hood, k.rect(c - 11, k.B - 15, 22, 9, 3, "#eaa01c", k.ink, 0.6) +
        // Drawstrings.
        k.line(`M${c - 4} ${k.T}v9M${c + 4} ${k.T}v9`, "#fff3d6", 1.3)) +
        // The chain and its pendant.
        k.path(`M${c - 10} ${k.T}Q${c} ${k.T + 15} ${c + 10} ${k.T}`, "none", "#f2c14e", 1.8) +
        k.lume("pulse", k.path(`M${c} ${k.T + 6}q5 2 4 6.5q-4 3 -8 0q-1 -4.5 4 -6.5Z`, "#a8552a", k.ink, 0.6) + k.path(`M${c - 3} ${k.T + 12.5}q3 1.6 6 0`, "none", "#f2d2a8", 1), 0, "#ffb347"));
    }
    // The cap: its crown on the head, its flat bill out to one side.
    const x = hx(k),
      y = k.ht + 17;
    const w = k.side ? 33 : 38;
    const dir = k.side || 1;
    const crown = k.path(`M${x - w} ${y}Q${x - w} ${y - 28} ${x} ${y - 29}Q${x + w} ${y - 28} ${x + w} ${y}Q${x} ${y - 7} ${x - w} ${y}Z`, "#2b2f3d");
    const bill = k.back
      ? k.path(`M${x - 16} ${y - 2}Q${x} ${y + 9} ${x + 16} ${y - 2}Q${x} ${y + 3} ${x - 16} ${y - 2}Z`, PINK)
      : k.path(`M${x + dir * w * 0.45} ${y - 5}Q${x + dir * (w + 22)} ${y - 12} ${x + dir * (w + 24)} ${y - 5}Q${x + dir * (w + 4)} ${y + 1} ${x + dir * w * 0.5} ${y + 1}Z`, PINK);
    k.put("flame", crown + bill + k.line(`M${x - w + 2} ${y - 2}Q${x} ${y - 9} ${x + w - 2} ${y - 2}`, PINK, 1.6) +
      (k.back ? "" : k.lume("pulse", k.path(k.star(x + (k.side ? k.side * 8 : 0), y - 16, 6.4, 5), GOLD, k.ink, 0.6), 1, GOLD)));
  },
  // Crystal Soprano: a tiara of ice crystals round a glowing gem, a pearl
  // choker and a frill of tulle at the shoulders.
  glacelle(k) {
    const tulle = "#ffffff",
      ice = "#bfeaff";
    const frill = (y: number, x0: number, x1: number) => {
      const n = 5,
        w = (x1 - x0) / n;
      return k.path(`M${x0} ${y}` + Array.from({ length: n }, () => `q${w / 2} ${7} ${w} 0`).join("") + `L${x1} ${y - 5}Q${(x0 + x1) / 2} ${y - 9} ${x0} ${y - 5}Z`, tulle, "#9fc4e0", 0.7);
    };
    if (k.back) backUnder(k, "#fdfbff", frill(k.T + 9, k.C - k.W - 5, k.C + k.W + 5) + glint(k, k.C, k.T + 16, 2.4, 0));
    else {
      const c = cx(k);
      k.put("body", torso(k, "#fdfbff", [0, 1, 2].map((i) => glint(k, k.L + 5 + i * ((k.R - k.L - 10) / 2), k.T + 17 + (i % 2) * 5, 1.5, i + 4, "#d8f6ff")).join("")) + frill(k.T + 9, k.L - 5, k.R + 5) +
        [-2, -1, 0, 1, 2].map((i) => k.circle(c + i * 4.2, k.T - 1 + (2 - Math.abs(i)) * 1.1, 1.5, "#fff6f0", "#c9b8c8", 0.4)).join("") +
        k.lume("pulse", k.path(`M${c} ${k.T + 2}l2.6 3.4l-2.6 3.4l-2.6 -3.4Z`, "#ff9fd0", k.ink, 0.4), 0, "#ffb3e0"));
    }
    // The tiara: a band and five crystals, the tallest in the middle.
    const x = hx(k),
      y = k.ht + 15;
    const spikes = (k.side ? [-1, 0, 1] : [-2, -1, 0, 1, 2]).map((i) => {
      const sx = x + (k.side ? k.side * 14 : 0) + i * 9,
        h = 17 - Math.abs(i) * 5;
      return k.path(`M${sx - 3.4} ${y - 3 + Math.abs(i) * 1.4}L${sx} ${y - 3 - h}L${sx + 3.4} ${y - 3 + Math.abs(i) * 1.4}Z`, ice, "#5a9ac8", 0.7);
    }).join("");
    const gx = x + (k.side ? k.side * 14 : 0);
    k.put("flame", band(k, y, k.side ? 30 : 34, "#e6f4ff", 4) +
      (k.back ? "" : spikes + k.lume("pulse", k.circle(gx, y - 3, 3, "#ff9fd0", k.ink, 0.5), 1, "#ffb3e0") + glint(k, gx, y - 22, 2.8, 2) + glint(k, gx + 16, y - 12, 2, 3, "#d8f6ff")));
  },
  // Plume Showstar: a fan of show plumes behind the crest on a jewelled
  // band, and a sequinned bodice under a feather boa.
  halcyra(k) {
    const bodice = "#d6337f";
    const boa = (y: number, x0: number, x1: number) =>
      Array.from({ length: 7 }, (_, i) => k.circle(x0 + ((x1 - x0) * i) / 6, y + Math.sin((i / 6) * Math.PI) * 5, 4.2, WHITE, "#d8c8e0", 0.5)).join("");
    if (k.back) {
      // The bodice under the folded wings; the boa round the shoulders.
      backUnder(k, bodice);
      k.put("scarf", boa(k.T + 1, k.C - k.W - 2, k.C + k.W + 2));
    }
    else {
      k.put("body", torso(k, bodice, [0, 1, 2, 3, 4].map((i) => glint(k, k.L + 4 + ((i * 9.1) % (k.R - k.L - 8)), k.T + 14 + ((i * 5.3) % 12), 1.6, i, "#fff3a8")).join("")) +
        boa(k.T, k.L - 2, k.R + 2));
    }
    // The plumes fan out behind the head; the band and its jewel in front.
    const x = hx(k) - k.side * 6,
      y = k.ht + 12;
    const plume = (a: number, len: number, c: string) => {
      const r = (a * Math.PI) / 180;
      const tx = x + Math.sin(r) * len,
        ty = y - Math.cos(r) * len;
      const nx = Math.cos(r) * 6.5,
        ny = Math.sin(r) * 6.5;
      return k.path(`M${x} ${y}Q${(x + tx) / 2 - nx} ${(y + ty) / 2 - ny} ${tx} ${ty}Q${(x + tx) / 2 + nx} ${(y + ty) / 2 + ny} ${x} ${y}Z`, c, k.ink, 0.7) + k.line(`M${x} ${y}L${tx} ${ty}`, "#ffffff88", 0.7);
    };
    const fan = (k.side ? [-k.side * 62, -k.side * 36, -k.side * 10] : [-48, -24, 0, 24, 48]).map((a, i) => plume(a, i % 2 ? 40 : 46, i % 2 ? "#fff3a8" : PINK)).join("");
    const jx = hx(k) + (k.side ? k.side * 10 : 0);
    k.put("flame", fan, true);
    k.put("flame", band(k, y + 4, k.side ? 30 : 34, GOLD, 4) +
      (k.back ? "" : k.lume("pulse", k.circle(jx, y + 1, 3.4, "#59f0ff", k.ink, 0.5), 0, "#59f0ff") + glint(k, jx - 12, y - 30, 2.6, 1) + glint(k, jx + 14, y - 26, 2.2, 2, "#fff3a8")));
  },
  // Mochi Starlet: a sailor-collar stage top with a star brooch, a big
  // ribbon between the ears and star clips.
  astrabun(k) {
    const top = "#fff8fb",
      sailor = "#ff6fae";
    if (k.back)
      // The sailor collar's bow sits at its point, clear of the cotton tail.
      backUnder(k, top, k.path(`M${k.C - k.W - 2} ${k.T - 1}H${k.C + k.W + 2}V${k.T + 14}H${k.C - k.W - 2}Z`, sailor, k.ink, 0.7) + k.line(`M${k.C - k.W} ${k.T + 11}H${k.C + k.W}`, WHITE, 1.2) + bow(k, k.C, k.T + 15, 8, sailor, WHITE));
    else {
      const c = cx(k);
      k.put("body", torso(k, top,
        k.path(`M${k.L - 2} ${k.T - 2}L${c} ${k.T + 16}L${k.R + 2} ${k.T - 2}L${k.R + 2} ${k.T + 5}L${c} ${k.T + 22}L${k.L - 2} ${k.T + 5}Z`, sailor, k.ink, 0.7) +
          k.line(`M${k.L} ${k.T + 2}L${c} ${k.T + 19}L${k.R} ${k.T + 2}`, WHITE, 1) +
          k.path(`M${k.L - 2} ${k.B - 7}q5 6 10 0t10 0t10 0t10 0t10 0t10 0L${k.R + 2} ${k.B + 4}H${k.L - 2}Z`, sailor, k.ink, 0.6)) +
        k.lume("pulse", k.path(k.star(c, k.T + 19, 4.6, 5), "#fff3a8", k.ink, 0.6), 0, "#fff3a8"));
    }
    // The ribbon sits between the ears, a star clip either side of it.
    const x = hx(k),
      y = k.ht + 10;
    k.put("flame", bow(k, x + k.side * 6, y, 17, sailor, "#ffd1e6") +
      (k.back ? "" : glint(k, x + k.side * 6 + 12, y - 8, 2.8, 1) +
        (k.side ? "" : k.path(k.star(x - 30, y + 8, 4.6, 5), "#fff3a8", k.ink, 0.5) + k.path(k.star(x + 30, y + 8, 4.6, 5), "#9fe8ff", k.ink, 0.5))));
  },
  // Bedrock Drummer: a studded vest, crossed drumsticks on its back, a red
  // bandana and a mohawk of crystal shards lit from inside.
  wombolder(k) {
    const vest = "#2b2f3d",
      red = "#d8263a";
    const sticks = (x: number, y: number, s: number) =>
      k.line(`M${x - 9 * s} ${y + 9 * s}L${x + 9 * s} ${y - 9 * s}M${x + 9 * s} ${y + 9 * s}L${x - 9 * s} ${y - 9 * s}`, "#e8c98a", 2.2 * s) +
      k.circle(x + 9 * s, y - 9 * s, 1.8 * s, "#fff3d6", k.ink, 0.4) + k.circle(x - 9 * s, y - 9 * s, 1.8 * s, "#fff3d6", k.ink, 0.4);
    const studs = (x0: number, x1: number, y: number) => Array.from({ length: 6 }, (_, i) => k.lume("twinkle", k.circle(x0 + ((x1 - x0) * i) / 5, y, 1.1, "#e8e8f0", "none", 0), i, WHITE)).join("");
    if (k.back) {
      // The vest under the boulder; the drumsticks ride a strap across it.
      backUnder(k, vest, studs(k.C - k.W + 2, k.C + k.W - 2, k.B - 3));
      k.put("scarf", k.path(`M${k.C - k.W - 6} ${k.T + 4}L${k.C + k.W + 4} ${k.B - 14}L${k.C + k.W + 4} ${k.B - 8}L${k.C - k.W - 6} ${k.T + 10}Z`, red, k.ink, 0.8) + sticks(k.C, k.T + 18, 1));
    }
    else {
      const c = cx(k);
      k.put("body", torso(k, vest, k.path(`M${c - 7} ${k.T - 2}L${c} ${k.B + 4}L${c + 7} ${k.T - 2}Z`, "#f2e2c8", "none", 0) + studs(k.L + 2, k.R - 2, k.T + 3) + studs(k.L + 2, k.R - 2, k.B - 3)) +
        k.lume("pulse", k.path(k.star(c + (k.side ? k.side * 8 : -11), k.T + 13, 3.6, 5), GOLD, k.ink, 0.5), 0, GOLD));
    }
    // The bandana round the brow, its knot at the side; the mohawk above.
    // Wombolder's eyes sit high on its head: the band rides above them.
    const x = hx(k),
      y = k.ht + 7;
    const shards = (k.side ? [-2, -1, 0, 1, 2].map((i) => [x - k.side * 4 + i * 10, 26 - Math.abs(i) * 4]) : [-1, 0, 1].map((i) => [x + i * 10, 32 - Math.abs(i) * 9])).map(([sx, h], i) =>
      k.path(`M${sx - 5.6} ${y - 4}L${sx} ${y - 4 - h}L${sx + 5.6} ${y - 4}Z`, "#8fe8d8", "#2f7a78", 0.8) + k.lume("chase", k.path(`M${sx - 1.6} ${y - 6}L${sx} ${y - 3 - h * 0.8}L${sx + 1.6} ${y - 6}Z`, "#eafffb", "none", 0), i, "#8fffe8")).join("");
    const knotX = k.back ? x + 30 : x - (k.side || 1) * (k.side ? 30 : 40);
    k.put("flame", shards + band(k, y, k.side ? 38 : 44, red, 6) +
      [0, 1, 2, 3].map((i) => k.circle(x - 24 + i * 16, y - 0.5 - (i === 1 || i === 2 ? 2.6 : 0), 1, WHITE, "none", 0)).join("") +
      k.path(`M${knotX} ${y + 4}l-7 9l5 -1l1 6Z`, red, k.ink, 0.6) + k.circle(knotX, y + 4, 2.6, red, k.ink, 0.6));
  },
  // Neon Octave: a high-collared stage jacket piped in neon, a row of
  // lights across the brow and a halo that floats over the head.
  shadopus(k) {
    const coat = "#14121f",
      cyan = "#59f0ff",
      mag = "#ff4fd8";
    if (k.back) backUnder(k, coat, k.lume("pulse", k.line(`M${k.C - k.W} ${k.T + 6}Q${k.C} ${k.T + 20} ${k.C + k.W} ${k.T + 6}`, mag, 1.6), 0, mag) + k.lume("pulse", k.line(`M${k.C - k.W} ${k.T + 14}Q${k.C} ${k.T + 28} ${k.C + k.W} ${k.T + 14}`, cyan, 1.6), 1, cyan));
    else {
      const c = cx(k);
      k.put("body", torso(k, coat,
        k.lume("pulse", k.line(`M${c} ${k.T}V${k.B + 2}`, cyan, 1.6), 0, cyan) +
          k.lume("pulse", k.line(`M${k.L} ${k.T + 5}L${c - 3} ${k.T + 14}M${k.R} ${k.T + 5}L${c + 3} ${k.T + 14}`, mag, 1.6), 1, mag)) +
        // The stand collar.
        k.path(`M${c - 11} ${k.T + 3}Q${c} ${k.T - 6} ${c + 11} ${k.T + 3}L${c + 8} ${k.T + 6}Q${c} ${k.T - 1} ${c - 8} ${k.T + 6}Z`, coat, k.ink, 0.7) +
        k.lume("pulse", k.path(`M${c} ${k.T + 6}l3 4l-3 4l-3 -4Z`, mag, k.ink, 0.4), 2, mag));
    }
    // The halo: a tilted ring over the dome, and lights across the brow.
    const x = hx(k),
      y = k.ht - 9;
    const ring = (stroke: string, w: number) => `<ellipse cx="${x}" cy="${y}" rx="${k.side ? 24 : 28}" ry="6.5" fill="none" stroke="${stroke}" stroke-width="${w}"/>`;
    k.put("flame", ring("#0d5a66", 4.4) + k.lume("pulse", ring(cyan, 2.6), 3, cyan) + glint(k, x + 22, y - 6, 3, 4) + glint(k, x - 24, y + 3, 2.2, 5, mag) +
      (k.back ? "" : [0, 1, 2, 3, 4, 5, 6].map((i) => {
        const u = (i - 3) / 3;
        return k.lume("chase", k.circle(x + (k.side ? k.side * 8 : 0) + u * (k.side ? 22 : 32), k.ht + 22 - (1 - u * u) * 5, 1.5, i % 2 ? mag : cyan, "none", 0), i, i % 2 ? mag : cyan);
      }).join("")));
  },
  // Island Serenader: an aloha shirt, a lei of blossoms round the neck, a
  // straw hat with a hibiscus on its band, and a ukulele on the back.
  pangrove(k) {
    const shirt = "#1fa7a0";
    const blossom = (x: number, y: number, r: number, c: string) =>
      [0, 1, 2, 3, 4].map((i) => {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        return k.circle(x + Math.cos(a) * r * 0.62, y + Math.sin(a) * r * 0.62, r * 0.52, c, k.ink, 0.35);
      }).join("") + k.circle(x, y, r * 0.32, GOLD, "none", 0);
    const lei = (c: number, y: number, w: number) => [0, 1, 2, 3, 4, 5, 6].map((i) => {
      const u = i / 6;
      return blossom(c - w + u * 2 * w, y + Math.sin(u * Math.PI) * 9, 3.6, [PINK, "#fff6f0", "#ffb347"][i % 3]);
    }).join("");
    if (k.back) {
      // The ukulele hangs across the back, its neck up over a shoulder.
      const ux = k.C,
        uy = k.T + 22;
      // The shirt under the leaf scales; the ukulele hangs over them.
      backUnder(k, shirt);
      k.put("scarf", k.line(`M${ux + 4} ${uy - 8}L${ux + 20} ${uy - 34}`, "#7a4a24", 3.4) + k.rect(ux + 17, uy - 41, 7, 8, 1.5, "#5a3418", k.ink, 0.5) +
        k.path(`M${ux - 9} ${uy - 6}Q${ux - 14} ${uy + 2} ${ux - 10} ${uy + 9}Q${ux} ${uy + 16} ${ux + 9} ${uy + 8}Q${ux + 13} ${uy} ${ux + 6} ${uy - 9}Q${ux - 2} ${uy - 12} ${ux - 9} ${uy - 6}Z`, "#d79a4e", k.ink, 0.8) +
        k.circle(ux - 1, uy + 2, 3, "#3a2010", "none", 0));
    } else {
      const c = cx(k);
      const leaves = [0, 1, 2, 3].map((i) => k.path(`M${k.L + 4 + i * 12} ${k.T + 14 + (i % 2) * 8}q5 -5 9 0q-4 5 -9 0Z`, "#eafff2", "none", 0)).join("");
      k.put("body", torso(k, shirt, leaves + k.path(`M${c - 8} ${k.T - 1}L${c} ${k.T + 9}L${c + 8} ${k.T - 1}Z`, "#178a84", k.ink, 0.6)) + lei(c, k.T, 15));
    }
    // The straw hat, a hibiscus on its band glowing at its heart.
    const y = k.ht + 15;
    const fx = hx(k) + (k.side ? k.side * 16 : -20);
    k.put("flame", hatShape(k, 36, 24, y, "#edd592", "#e2c476", 1.3) + k.line(`M${hx(k) - 23} ${y - 5}Q${hx(k)} ${y + 1} ${hx(k) + 23} ${y - 5}`, "#d8263a", 3.4) +
      (k.back ? "" : blossom(fx, y - 6, 7, "#ff5a8a") + k.lume("pulse", k.circle(fx, y - 6, 2.4, GOLD, "none", 0), 0, "#fff3a8")));
  },
  // Lo-fi Lullaby: a soft cardigan with a glowing note patch, a slouchy
  // beanie, big headphones and a few notes drifting off them.
  mossloth(k) {
    const knit = "#f1e3c8";
    if (k.back) backUnder(k, knit, k.lume("pulse", k.path(`M${k.C + 3} ${k.T + 8}A8 8 0 1 0 ${k.C + 3} ${k.T + 24}A6 6 0 1 1 ${k.C + 3} ${k.T + 8}Z`, "#ffe08a", k.ink, 0.6), 0, "#ffe08a"));
    else {
      const c = cx(k);
      k.put("body", torso(k, knit, k.path(`M${c - 9} ${k.T - 2}L${c} ${k.T + 16}L${c + 9} ${k.T - 2}Z`, "#8fc7e8", k.ink, 0.6) + k.line(`M${c} ${k.T + 16}V${k.B + 3}`, "#cdb892", 1) +
        [0, 1, 2].map((i) => k.circle(c, k.T + 21 + i * 6, 1.1, "#a8875a", "none", 0)).join("") +
        k.rect(c + (k.side ? k.side * 4 : 6), k.T + 15, 9, 9, 2, "#6f8fd8", k.ink, 0.5)) +
        k.lume("pulse", note(k, c + (k.side ? k.side * 4 : 6) + 3.4, k.T + 21.6, 0.62, "#fff3a8"), 0, "#fff3a8"));
    }
    // The beanie, slouched back, under the headphones' band.
    const x = hx(k),
      y = k.ht + 18;
    const w = k.side ? 34 : 39;
    const slouch = k.side ? -k.side * 10 : 8;
    k.put("flame", k.path(`M${x - w} ${y}Q${x - w} ${y - 24} ${x + slouch} ${y - 30}Q${x + w} ${y - 26} ${x + w} ${y}Q${x} ${y - 8} ${x - w} ${y}Z`, "#5a7ab8") +
      k.path(`M${x - w} ${y}Q${x} ${y - 8} ${x + w} ${y}L${x + w - 1} ${y - 7}Q${x} ${y - 15} ${x - w + 1} ${y - 7}Z`, "#46639c", k.ink, 0.7) +
      k.circle(x + slouch, y - 31, 5.4, "#fff3d6", k.ink, 0.6) +
      headphones(k, "#fff3d6", "#ff9ab8", "#ffd1e0", -2, 44) +
      (k.back ? "" : k.lume("twinkle", note(k, x + (k.side ? -k.side * 40 : 52), k.ht + 10, 1, "#fff3a8"), 3, "#fff3a8") + k.lume("twinkle", note(k, x + (k.side ? -k.side * 50 : -60), k.ht + 24, 0.8, "#bfe8ff"), 4, "#bfe8ff")));
  },
};

Object.assign((DESIGNS.idol ??= {}), IDOL);

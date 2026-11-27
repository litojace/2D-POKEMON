import { writeFileSync } from "node:fs";
import { frameFiles } from "./frame-files.mjs";
// Generates apps/client/src/signature-frames.css: art for the frames that
// used to be a plain coloured ring (owner, 18 Nov 2026: each frame should
// have its own look). Wayfarer, Champion laurel, Planet-ring, Cartridge and
// the four season frames, drawn as still SVG files (apps/client/src/frames/,
// frame-files.mjs) like the collection frames (frame-art.mjs): nothing here
// animates.
// Run: node scripts/signature-frame-art.mjs && npx prettier --write apps/client/src/signature-frames.css
// Frame art: viewBox -70 -70 140 140, the portrait disc is r = 50. The
// portrait is drawn over the art, so anything inside r = 50 is hidden.
const R = (d) => (d * Math.PI) / 180;
const f = (n) => +n.toFixed(2);
const pt = (r, a) => [f(Math.cos(R(a)) * r), f(Math.sin(R(a)) * r)];
const P = (...pts) => pts.map((p) => p.join(" ")).join(" ");
const svg = (body, vb = "-70 -70 140 140") =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${body}</svg>`;
// The pictures are files (frame-files.mjs): frames/signature-<id>.svg.
const pictures = frameFiles("signature");
// Deterministic pseudo-random, so the art never changes between runs.
let seed = 1;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const band = (r, w, stroke, extra = "") =>
  `<circle r='${r}' fill='none' stroke='${stroke}' stroke-width='${w}' ${extra}/>`;
/** A closed line round the centre whose radius follows fn(angle). */
const loop = (fn, step = 3) => {
  let d = "";
  for (let a = 0; a < 360; a += step)
    d += (a ? "L" : "M") + pt(fn(a), a).join(" ");
  return d + "Z";
};
/** An annular sector (a slice of a ring). */
const sector = (r0, r1, a0, a1) => {
  const [x0, y0] = pt(r1, a0),
    [x1, y1] = pt(r1, a1),
    [x2, y2] = pt(r0, a1),
    [x3, y3] = pt(r0, a0);
  return `M${x0} ${y0}A${r1} ${r1} 0 0 1 ${x1} ${y1}L${x2} ${y2}A${r0} ${r0} 0 0 0 ${x3} ${y3}Z`;
};
const star4 = (x, y, s, fill, extra = "") =>
  `<path d='M${f(x)} ${f(y - s)}L${f(x + s * 0.28)} ${f(y - s * 0.28)}L${f(x + s)} ${f(y)}L${f(x + s * 0.28)} ${f(y + s * 0.28)}L${f(x)} ${f(y + s)}L${f(x - s * 0.28)} ${f(y + s * 0.28)}L${f(x - s)} ${f(y)}L${f(x - s * 0.28)} ${f(y - s * 0.28)}Z' fill='${fill}' ${extra}/>`;
const star5 = (x, y, r, fill, stroke, w = 0.8) => {
  const p = [];
  for (let k = 0; k < 10; k++) {
    const [px, py] = pt(k % 2 ? r * 0.45 : r, -90 + k * 36);
    p.push([f(x + px), f(y + py)]);
  }
  return `<polygon points='${P(...p)}' fill='${fill}' stroke='${stroke}' stroke-width='${w}' stroke-linejoin='round'/>`;
};
const GOLD = `<linearGradient id='gold' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#fff6cf'/><stop offset='.45' stop-color='#ffd36b'/><stop offset='1' stop-color='#b9821f'/></linearGradient>`;

// ── Wayfarer (Rare): a traveller's rope ring on teal leather, brass
// compass points with a red north, and a compass on the crown.
function wayfarer() {
  let b = band(55.5, 10, "#2f5a52");
  // Twisted rope: slanted strands, dark then light.
  for (let k = 0; k < 44; k++) {
    const a = k * (360 / 44);
    b += `<path d='M${P(pt(51.2, a))}L${P(pt(59.8, a + 6))}' stroke='#6b4a22' stroke-width='3.4' stroke-linecap='round'/>`;
    b += `<path d='M${P(pt(51.8, a + 0.6))}L${P(pt(59.2, a + 5.6))}' stroke='#e6c98f' stroke-width='1.8' stroke-linecap='round'/>`;
  }
  b += band(50.6, 1.4, "#ffd991");
  b += band(60.6, 1.2, "#3b2a12");
  // Compass points: E, S, W in mint brass; the crown carries north.
  for (const a of [0, 90, 180]) {
    const l = pt(59, a - 7),
      tip = pt(68.5, a),
      r = pt(59, a + 7),
      mid = pt(61, a);
    b += `<polygon points='${P(l, tip, r)}' fill='#9ff3d8' stroke='#3b2a12' stroke-width='.9' stroke-linejoin='round'/>`;
    b += `<polygon points='${P(l, tip, mid)}' fill='#e8fff7'/>`;
  }
  for (const a of [45, 135, 225, 315]) {
    const l = pt(60, a - 3.5),
      tip = pt(65.5, a),
      r = pt(60, a + 3.5);
    b += `<polygon points='${P(l, tip, r)}' fill='#ffd991' stroke='#3b2a12' stroke-width='.7' stroke-linejoin='round'/>`;
  }
  // The compass on the crown, its needle pointing north.
  b += `<circle cy='-60' r='8.6' fill='#ffd991' stroke='#3b2a12' stroke-width='1.2'/>`;
  b += `<circle cy='-60' r='6.4' fill='#f4fbf8' stroke='#b48a3c' stroke-width='.8'/>`;
  for (let k = 0; k < 8; k++) {
    const [x, y] = pt(5.4, k * 45);
    const [x2, y2] = pt(k % 2 ? 4.6 : 4, k * 45);
    b += `<path d='M${f(x)} ${f(y - 60)}L${f(x2)} ${f(y2 - 60)}' stroke='#6b8a80' stroke-width='.6'/>`;
  }
  b += `<polygon points='0,-65.6 1.6,-60 -1.6,-60' fill='#e8414e'/>`;
  b += `<polygon points='0,-54.4 1.6,-60 -1.6,-60' fill='#3c5a52'/>`;
  b += `<circle cy='-60' r='1' fill='#3b2a12'/>`;
  return svg(b);
}

// ── Champion laurel (Legendary): a gold champion's medal. Laurel leaves
// in relief all round a solid gold band, a blue enamel lip, a star where
// the branches meet and a blue ribbon bow below. (The Prismatic laurel is
// open branches with crystal leaves; this is a struck medal.)
function champion() {
  let b = `<defs>${GOLD}</defs>`;
  b += band(56.5, 11.5, "url(#gold)");
  b += band(51.4, 2.4, "#2f5fc4");
  b += band(51.4, 0.6, "#a9c8ff", "opacity='.8'");
  b += band(62.4, 1.1, "#7a5210");
  // Two branches rise from the bow to the star: a stem and paired leaves.
  for (const side of [-1, 1]) {
    let d = "";
    for (let a = 100; a <= 262; a += 4) {
      const ang = side > 0 ? 180 - a : a;
      d += (a === 100 ? "M" : "L") + pt(56.5, ang).join(" ");
    }
    b += `<path d='${d}' fill='none' stroke='#9a6a12' stroke-width='.9'/>`;
    for (let a = 104; a <= 256; a += 10) {
      for (const [dr, tilt] of [
        [-2.6, -38],
        [2.6, 38],
      ]) {
        const ang = side > 0 ? 180 - a : a;
        const [x, y] = pt(56.5 + dr, ang);
        // Leaves lean along the branch, towards the crown.
        const rot = ang + 90 + (side > 0 ? -tilt : tilt);
        b += `<ellipse cx='${x}' cy='${y}' rx='3.2' ry='1.35' transform='rotate(${f(rot)} ${x} ${y})' fill='#fff1b0' stroke='#9a6a12' stroke-width='.55'/>`;
      }
    }
  }
  b += star5(0, -57, 6.6, "#fff6cf", "#9a6a12", 1);
  // Ribbon bow and tails.
  b += `<path d='M0 58L-9 70L-5 70L-2.4 66.5L0 70L2.4 66.5L5 70L9 70Z' fill='#2f5fc4' stroke='#173a8a' stroke-width='.8' stroke-linejoin='round'/>`;
  b += `<path d='M0 57L-9 52.6L-9 61.4Z' fill='#3d6fd6' stroke='#173a8a' stroke-width='.8' stroke-linejoin='round'/>`;
  b += `<path d='M0 57L9 52.6L9 61.4Z' fill='#3d6fd6' stroke='#173a8a' stroke-width='.8' stroke-linejoin='round'/>`;
  b += `<path d='M-6.5 55.2L-6.5 58.8M6.5 55.2L6.5 58.8' stroke='#fff' stroke-width='1' opacity='.8'/>`;
  b += `<circle cy='57' r='2.6' fill='url(#gold)' stroke='#7a5210' stroke-width='.7'/>`;
  return svg(b);
}

// ── Planet-ring (Mythic): a band of deep space. Nebula clouds, stars, a
// ringed planet riding the upper right and a planetary ring that passes
// behind the portrait.
function galaxy() {
  seed = 23;
  let b = `<defs><linearGradient id='neb' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#2a1a6e'/><stop offset='.5' stop-color='#5a2aa8'/><stop offset='1' stop-color='#173a8a'/></linearGradient><radialGradient id='pl' cx='.35' cy='.35' r='.7'><stop offset='0' stop-color='#ffe2b8'/><stop offset='.6' stop-color='#f09a50'/><stop offset='1' stop-color='#a5502a'/></radialGradient></defs>`;
  // The tilted orbit: the portrait hides its middle, so it reads as a
  // ring round the portrait.
  b += `<ellipse rx='69' ry='17' transform='rotate(-22)' fill='none' stroke='#ffd6a0' stroke-width='2.2' opacity='.85'/>`;
  b += `<ellipse rx='69' ry='17' transform='rotate(-22)' fill='none' stroke='#fff7e6' stroke-width='.7'/>`;
  b += band(55.5, 10, "url(#neb)");
  // Nebula clouds: soft glows that fade out, clipped to the band.
  b += `<defs><clipPath id='gb'><path fill-rule='evenodd' d='${loop(() => 60.6, 2)}${loop(() => 50.4, 2)}'/></clipPath>`;
  for (const [id, c] of [
    ["pk", "#ff7ad9"],
    ["cy", "#6fe3ff"],
    ["vi", "#a98bff"],
  ])
    b += `<radialGradient id='${id}'><stop offset='0' stop-color='${c}' stop-opacity='.7'/><stop offset='1' stop-color='${c}' stop-opacity='0'/></radialGradient>`;
  b += `</defs><g clip-path='url(#gb)'>`;
  for (const [a, id, r] of [
    [-150, "pk", 11],
    [-75, "cy", 9],
    [-15, "vi", 10],
    [45, "pk", 10],
    [110, "cy", 11],
    [175, "vi", 10],
  ]) {
    const [x, y] = pt(55.5, a);
    b += `<circle cx='${x}' cy='${y}' r='${r}' fill='url(#${id})'/>`;
  }
  b += `</g>`;
  for (let k = 0; k < 46; k++) {
    const [x, y] = pt(51.5 + rnd() * 8.4, rnd() * 360);
    b += `<circle cx='${x}' cy='${y}' r='${f(0.35 + rnd() * 0.7)}' fill='#fff' opacity='${f(0.55 + rnd() * 0.45)}'/>`;
  }
  for (const a of [-170, -95, 35, 140]) {
    const [x, y] = pt(55.5, a);
    b += star4(x, y, 2.6, "#fff");
  }
  b += band(50.6, 1.1, "#c9b8ff");
  b += band(60.6, 0.9, "#8f7bff", "opacity='.8'");
  // A small moon, low left.
  b += `<circle cx='-46' cy='44' r='3.6' fill='#b9c6e6' stroke='#4a587a' stroke-width='.7'/>`;
  b += `<circle cx='-47' cy='43' r='.9' fill='#8492b4'/>`;
  // The ringed planet, upper right.
  b += `<ellipse cx='47' cy='-47' rx='15' ry='4.2' transform='rotate(-18 47 -47)' fill='none' stroke='#9fd8ff' stroke-width='1.6'/>`;
  b += `<circle cx='47' cy='-47' r='9' fill='url(#pl)' stroke='#14213a' stroke-width='.8'/>`;
  b += `<path d='M39 -46Q47 -43 55 -48' stroke='#c86a36' stroke-width='1.2' fill='none' opacity='.7'/>`;
  // The near half of its ring, in front of the planet.
  b += `<path d='M32 -47A15 4.2 0 0 0 62 -47' transform='rotate(-18 47 -47)' fill='none' stroke='#dff2ff' stroke-width='1.6'/>`;
  return svg(b);
}

// ── Cartridge (Rare): the portrait is the label of a game cartridge:
// a grey shell with a clipped corner, grip ridges, pixel stars, a pixel
// heart and gold contacts along the bottom.
function cartridge() {
  let b = "";
  const shell =
    "M-60 -66H50L64 -52V60Q64 66 58 66H-58Q-64 66 -64 60V-60Q-64 -66 -60 -66Z";
  b += `<path d='${shell}' fill='#8d91a0' stroke='#2e3040' stroke-width='2'/>`;
  b += `<path d='M-58 -62H48L60 -50V58Q60 62 56 62H-56Q-60 62 -60 58V-58Q-60 -62 -58 -62Z' fill='#a3a7b5'/>`;
  for (let k = 0; k < 4; k++)
    b += `<path d='M-30 ${-63.5 + k * 2.4}H26' stroke='#6c7080' stroke-width='1'/>`;
  // The label: dark, with a red and blue stripe across the top.
  b += `<rect x='-55' y='-56' width='110' height='112' rx='5' fill='#1c2546' stroke='#2e3040' stroke-width='1.4'/>`;
  b += `<rect x='-55' y='-56' width='110' height='7' rx='3' fill='#e8414e'/>`;
  b += `<rect x='-55' y='-49.5' width='110' height='3.4' fill='#3d6fd6'/>`;
  // Pixel art in the label's corners.
  const px = (x, y, rows, c, s = 1.8) =>
    rows
      .map((row, j) =>
        [...row]
          .map((ch, i) =>
            ch === "#"
              ? `<rect x='${f(x + i * s)}' y='${f(y + j * s)}' width='${s}' height='${s}' fill='${c}'/>`
              : "",
          )
          .join(""),
      )
      .join("");
  b += px(-51, -42, [".#.", "###", ".#."], "#ffd65b");
  b += px(40, -42, [".#.", "###", ".#."], "#7fd8ff");
  b += px(
    -52,
    42,
    [".#.#.", "#####", "#####", ".###.", "..#.."],
    "#ff5d6c",
    1.7,
  );
  b += px(41, 43, [".##.", "#..#", "#..#", ".##."], "#ffd65b", 1.7);
  // The window round the portrait.
  b += band(51.6, 3.4, "#11131c");
  b += `<path d='M${P(pt(53, 200))}A53 53 0 0 1 ${P(pt(53, 250))}' fill='none' stroke='#fff' stroke-width='1' opacity='.55'/>`;
  // Contacts.
  for (let x = -38; x <= 34; x += 6)
    b += `<rect x='${x}' y='60' width='4' height='4.6' rx='.6' fill='#e8c35a' stroke='#8a6a1e' stroke-width='.5'/>`;
  return svg(b);
}

// ── Aurora Trails (Epic, a season): curtains of northern light rippling
// round a night sky, stars, and snowy pines along the bottom.
function aurora() {
  seed = 41;
  // Everything but the pines stays inside the band (clipped to it).
  let b = `<defs><clipPath id='bd'><path fill-rule='evenodd' d='${loop(() => 60.6, 2)}${loop(() => 50.4, 2)}'/></clipPath><linearGradient id='sky' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#0b1630'/><stop offset='1' stop-color='#14284a'/></linearGradient></defs>`;
  b += band(55.5, 10.4, "url(#sky)");
  b += `<g clip-path='url(#bd)'>`;
  for (let k = 0; k < 14; k++) {
    const [x, y] = pt(56.5 + rnd() * 3.4, rnd() * 360);
    b += `<circle cx='${x}' cy='${y}' r='${f(0.35 + rnd() * 0.4)}' fill='#fff'/>`;
  }
  // Curtains of light: soft filled waves rising from the inner rim.
  for (const [top, amp, k, ph, c, o] of [
    [57.6, 2.4, 7, 0, "#4fc9a8", 0.55],
    [56.2, 2, 9, 50, "#9ff3d8", 0.6],
    [54.4, 1.6, 11, 130, "#b6a0ff", 0.55],
  ])
    b += `<path fill-rule='evenodd' d='${loop((a) => top + amp * Math.sin(R(k * a + ph)), 2)}${loop(() => 50, 2)}' fill='${c}' opacity='${o}'/>`;
  // Light streaks hanging down the curtains.
  for (let a = 0; a < 360; a += 6) {
    const len = 2.4 + rnd() * 3.6;
    b += `<path d='M${P(pt(51, a))}L${P(pt(51 + len, a))}' stroke='#e8fff7' stroke-width='.7' opacity='${f(0.2 + rnd() * 0.35)}'/>`;
  }
  b += `</g>`;
  b += band(50.6, 1.1, "#9ff3d8");
  b += band(60.6, 1, "#b6a0ff");
  // Snowy pines on the lower arc.
  for (const a of [52, 66, 80, 94, 108, 122]) {
    const h = a % 28 === 10 ? 9.5 : 7.5;
    const tip = pt(60 + h, a),
      l = pt(60, a - 4.2),
      r = pt(60, a + 4.2);
    b += `<polygon points='${P(l, tip, r)}' fill='#12384a' stroke='#0a1e2a' stroke-width='.6' stroke-linejoin='round'/>`;
    const sl = pt(60 + h * 0.62, a - 1.6),
      sr = pt(60 + h * 0.62, a + 1.6);
    b += `<polygon points='${P(sl, tip, sr)}' fill='#f2fbff'/>`;
  }
  b += star4(0, -61.5, 4.2, "#e8fff7", "opacity='.95'");
  return svg(b);
}

// ── Ember Festival (Epic, a season): a warm night with fireworks bursting
// over the top and a string of paper lanterns along the bottom.
function ember() {
  seed = 57;
  let b = `<defs><linearGradient id='emb' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2a1030'/><stop offset='1' stop-color='#5a1e10'/></linearGradient></defs>`;
  b += band(55.5, 10, "url(#emb)");
  for (let k = 0; k < 30; k++) {
    const [x, y] = pt(51.5 + rnd() * 8.4, rnd() * 360);
    b += `<circle cx='${x}' cy='${y}' r='${f(0.4 + rnd() * 0.7)}' fill='${rnd() < 0.5 ? "#ffb980" : "#ffe39d"}' opacity='${f(0.5 + rnd() * 0.5)}'/>`;
  }
  b += band(50.6, 1.2, "#ffb980");
  b += band(60.6, 1, "#ffe39d");
  // Fireworks: rays with bright tips.
  const burst = (a, r, size, c, n = 10) => {
    const [cx, cy] = pt(r, a);
    let s = "";
    for (let k = 0; k < n; k++) {
      const t = (k * 360) / n;
      const [x0, y0] = pt(size * 0.35, t),
        [x1, y1] = pt(size, t);
      s += `<path d='M${f(cx + x0)} ${f(cy + y0)}L${f(cx + x1)} ${f(cy + y1)}' stroke='${c}' stroke-width='1' stroke-linecap='round'/>`;
      s += `<circle cx='${f(cx + x1)}' cy='${f(cy + y1)}' r='.8' fill='#fff6d8'/>`;
    }
    return s + `<circle cx='${cx}' cy='${cy}' r='1.1' fill='#fff6d8'/>`;
  };
  b += burst(-90, 61.5, 7.6, "#ffd65b", 12);
  b += burst(-138, 61, 5.4, "#ff7a3a");
  b += burst(-42, 61, 5.4, "#ff6fa8");
  b += burst(-178, 60.5, 4.2, "#ffe39d", 8);
  b += burst(-2, 60.5, 4.2, "#ffe39d", 8);
  // Lantern string: sagging between the sides, a lantern on each dip.
  let d = "";
  for (let a = 15; a <= 165; a += 3) {
    const sag = 1.6 * Math.abs(Math.sin(R(((a - 15) / 25) * 180)));
    d += (a === 15 ? "M" : "L") + pt(60.8 + sag, a).join(" ");
  }
  b += `<path d='${d}' fill='none' stroke='#3a1a10' stroke-width='.8'/>`;
  for (const a of [27.5, 52.5, 77.5, 102.5, 127.5, 152.5]) {
    const [x, y] = pt(64.4, a);
    const rot = a - 90;
    b += `<g transform='rotate(${f(rot)} ${x} ${y})'>`;
    b += `<rect x='${f(x - 1.2)}' y='${f(y - 5.6)}' width='2.4' height='1.4' fill='#ffd65b'/>`;
    b += `<ellipse cx='${x}' cy='${y}' rx='3.4' ry='4.3' fill='#ff6a2a' stroke='#8a2a10' stroke-width='.6'/>`;
    b += `<ellipse cx='${f(x - 0.9)}' cy='${f(y - 0.6)}' rx='1.3' ry='2.4' fill='#ffd27a' opacity='.8'/>`;
    b += `<rect x='${f(x - 1.2)}' y='${f(y + 4.1)}' width='2.4' height='1.2' fill='#ffd65b'/>`;
    b += `</g>`;
  }
  return svg(b);
}

// ── Tidal Voyage (Epic, a season): a ship's wheel. Wooden rim with brass
// studs, eight turned handles, and a ripple of sea along its inner edge.
function tide() {
  let b = "";
  for (let k = 0; k < 8; k++) {
    const a = k * 45 + 22.5;
    b += `<path d='M${P(pt(57, a))}L${P(pt(64.5, a))}' stroke='#5a3414' stroke-width='5.2' stroke-linecap='round'/>`;
    b += `<path d='M${P(pt(57, a))}L${P(pt(64.5, a))}' stroke='#a8743e' stroke-width='3.4' stroke-linecap='round'/>`;
    const [x, y] = pt(66, a);
    b += `<circle cx='${x}' cy='${y}' r='3.4' fill='#c48a4e' stroke='#5a3414' stroke-width='.9'/>`;
    b += `<circle cx='${f(x - 1)}' cy='${f(y - 1)}' r='1' fill='#f1c98f' opacity='.85'/>`;
  }
  b += band(55.5, 9.6, "#5a3414");
  b += band(55.5, 7.8, "#a06a38");
  for (const r of [52.6, 55.5, 58.4])
    b += band(r, 0.6, "#7a4a22", "stroke-dasharray='9 4 3 6' opacity='.85'");
  // The sea along the inner edge.
  b += band(51.4, 2.6, "#1d6f9a");
  b += `<path d='${loop((a) => 51.6 + 0.8 * Math.sin(R(30 * a)), 2)}' fill='none' stroke='#b9f5e9' stroke-width='.9'/>`;
  b += band(60.4, 1.1, "#86deff");
  for (let k = 0; k < 8; k++) {
    const [x, y] = pt(55.5, k * 45 + 22.5);
    b += `<circle cx='${x}' cy='${y}' r='1.9' fill='#ffd27a' stroke='#7a4a10' stroke-width='.6'/>`;
  }
  return svg(b);
}

// ── Astral Carnival (Epic, a season): a carnival tent's striped band, a
// scalloped valance, marquee bulbs and stars.
function astral() {
  let b = "";
  const n = 24;
  for (let k = 0; k < n; k++) {
    const a0 = (k * 360) / n - 90,
      a1 = ((k + 1) * 360) / n - 90;
    b += `<path d='${sector(50.4, 60.2, a0, a1)}' fill='${k % 2 ? "#ffb5da" : "#7a4fc9"}'/>`;
  }
  // Valance scallops on the outer edge.
  for (let k = 0; k < n; k++) {
    const a = (k + 0.5) * (360 / n) - 90;
    b += `<path d='M${P(pt(60.2, a - 7.5))}A4.1 4.1 0 0 0 ${P(pt(60.2, a + 7.5))}Z' fill='${k % 2 ? "#d2b0ff" : "#ff8fc4"}' stroke='#3a2060' stroke-width='.6'/>`;
  }
  b += band(60.2, 0.9, "#3a2060");
  b += band(50.6, 1.2, "#fff0fa");
  // Marquee bulbs.
  for (let k = 0; k < 12; k++) {
    const [x, y] = pt(55.3, k * 30 - 75);
    b += `<circle cx='${x}' cy='${y}' r='3.2' fill='#fff6c8' opacity='.35'/>`;
    b += `<circle cx='${x}' cy='${y}' r='1.7' fill='#fffbe8' stroke='#c9a24a' stroke-width='.5'/>`;
  }
  for (const [a, s] of [
    [-90, 4.6],
    [-130, 2.6],
    [-50, 2.6],
    [160, 2.2],
    [20, 2.2],
  ]) {
    const [x, y] = pt(a === -90 ? 66 : 67, a);
    b += star4(x, y, s, a === -90 ? "#fff1a8" : "#ffd9f0");
  }
  return svg(b);
}

const frames = [
  {
    id: "wayfarer-frame",
    note: "Wayfarer (Rare): rope ring, compass points and a compass crown.",
    art: wayfarer(),
    glow: "#9ff3d8aa",
  },
  {
    id: "champion-laurel",
    note: "Champion laurel (Legendary): a gold medal with laurels in relief, a star and a blue ribbon.",
    art: champion(),
    glow: "#ffd36bcc",
  },
  {
    id: "galaxy-frame",
    note: "Planet-ring (Mythic): nebula and stars, a ringed planet and an orbit behind the portrait.",
    art: galaxy(),
    glow: "#a77bffaa",
  },
  {
    id: "retro-frame",
    note: "Cartridge (Rare): the portrait is a game cartridge's label.",
    art: cartridge(),
    glow: "#7fb2ffaa",
  },
  {
    id: "season-aurora-frame",
    note: "Aurora Trails: northern lights, stars and snowy pines.",
    art: aurora(),
    glow: "#9ff3d8bb",
    edge: ["#9ff3d8", "#ffffff", "#b6a0ff", "#4fc9a8"],
  },
  {
    id: "season-ember-frame",
    note: "Ember Festival: fireworks over the top, paper lanterns below.",
    art: ember(),
    glow: "#ffb980bb",
    edge: ["#ffb980", "#fff1c4", "#ff7a3a", "#ffe39d"],
  },
  {
    id: "season-tide-frame",
    note: "Tidal Voyage: a ship's wheel with a ripple of sea.",
    art: tide(),
    glow: "#86deffbb",
    edge: ["#86deff", "#ffffff", "#b9f5e9", "#3aa6d6"],
  },
  {
    id: "season-astral-frame",
    note: "Astral Carnival: a striped tent band, valance, marquee bulbs and stars.",
    art: astral(),
    glow: "#d2b0ffbb",
    edge: ["#d2b0ff", "#fff0fa", "#ffb5da", "#8a5fd6"],
  },
];

// The class is doubled to outrank the old plain looks in style.css (a
// border, a box-shadow ring, the Planet-ring's round planet).
const sel = (id) =>
  `.raid-cosmetic-preview.raid-cosmetic-preview[data-cosmetic="${id}"]`;
const any = frames.map((x) => `[data-cosmetic="${x.id}"]`).join(",\n  ");
const all = `.raid-cosmetic-preview.raid-cosmetic-preview:is(\n  ${any}\n)`;
let css = `/* Signature portrait frames: the frames that used to be a plain ring now
   have art of their own (owner, 18 Nov 2026). Same layout as the other
   frames: ::before is the art (viewBox -70…70 around a radius-50
   portrait, hence inset -20%). Still images: nothing animates.
   Generated from scripts/signature-frame-art.mjs. */
${all} {
  position: relative;
  border-radius: 50% !important;
  box-shadow: none;
  background: none;
}
${all}::before {
  content: "";
  position: absolute;
  inset: -20%;
  z-index: 1;
  background: center / 100% 100% no-repeat;
  pointer-events: none;
}
/* The art carries every ornament: no separate one (the old planet). */
${all}::after {
  content: none;
}
`;
for (const x of frames) {
  css += `
/* ${x.note} */
${sel(x.id)} {
  --frame-glow: ${x.glow};
}
${sel(x.id)}::before {
  background-image: ${pictures.url(x.id, x.art)};
}
`;
  if (x.edge)
    css += `${sel(x.id)}[data-tier] > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    ${x.edge.join(",\n    ")},
    ${x.edge[0]}
  );
}
`;
}
writeFileSync(
  new URL("../apps/client/src/signature-frames.css", import.meta.url),
  css,
);
pictures.done();

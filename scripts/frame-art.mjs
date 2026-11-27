import { writeFileSync } from "node:fs";
import { frameFiles } from "./frame-files.mjs";
// Generates apps/client/src/collection-frames.css: the Candy, Garden,
// Festival and Winter portrait frames, drawn as SVG files in
// apps/client/src/frames/ (frame-files.mjs).
// Run: node scripts/frame-art.mjs && npx prettier --write apps/client/src/collection-frames.css
// Frame art: viewBox -70 -70 140 140, the portrait disc is r = 50.
const R = (d) => (d * Math.PI) / 180;
const f = (n) => +n.toFixed(2);
const pt = (r, a) => [f(Math.cos(R(a)) * r), f(Math.sin(R(a)) * r)];
// Deterministic pseudo-random.
let seed = 7;
const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const polar = (fn, from = 0, to = 360, step = 2) => {
  const p = [];
  for (let a = from; a <= to + 1e-6; a += step) p.push(pt(fn(a), a));
  return p;
};
const pathOf = (pts, close = true) =>
  "M" + pts.map((p) => p.join(" ")).join("L") + (close ? "Z" : "");
const circle = (r) => pathOf(polar(() => r, 0, 358, 2));

const svg = (body, vb = "-70 -70 140 140") =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${body}</svg>`;
// The pictures are files (frame-files.mjs): frames/collection-<name>.svg.
const pictures = frameFiles("collection");

// ── Candy: a chocolate-chip cookie ring with dripping pink icing and sprinkles.
function cookie() {
  seed = 11;
  let b = "";
  b += `<circle r='55.5' fill='none' stroke='#d79a58' stroke-width='11'/>`;
  b += `<circle r='60.6' fill='none' stroke='#8a5428' stroke-width='1.6'/>`;
  b += `<circle r='57' fill='none' stroke='#f0c287' stroke-width='1.2' stroke-dasharray='6 9' opacity='.6'/>`;
  for (let i = 0; i < 14; i++) {
    const a = i * (360 / 14) + rnd() * 12;
    const [x, y] = pt(58.2 + rnd() * 1.2, a);
    b += `<ellipse cx='${x}' cy='${y}' rx='${f(1.5 + rnd() * 0.8)}' ry='${f(1.2 + rnd() * 0.6)}' transform='rotate(${f(rnd() * 180)} ${x} ${y})' fill='#5a3418'/>`;
  }
  // Icing: drips hang outward over the cookie.
  const icing = pathOf(
    polar(
      (a) => 53.4 + 3.6 * Math.pow(0.5 + 0.5 * Math.sin(R(a * 13)), 4),
      0,
      359,
      2,
    ),
  );
  b += `<path d='${icing} ${circle(49.4)}' fill-rule='evenodd' fill='#ff8fc0' stroke='#e2558f' stroke-width='.8'/>`;
  b += `<path d='${pathOf(
    polar(() => 51.3, 195, 300, 3),
    false,
  )}' fill='none' stroke='#fff' stroke-width='1.3' stroke-linecap='round' opacity='.75'/>`;
  const colors = [
    "#ffffff",
    "#6fd6ff",
    "#ffd65b",
    "#8fe06a",
    "#c89aff",
    "#ff5a7a",
  ];
  for (let i = 0; i < 26; i++) {
    const a = i * (360 / 26) + rnd() * 8;
    const [x, y] = pt(51.8 + rnd() * 1.6, a);
    const t = rnd() * 180;
    const [dx, dy] = [f(Math.cos(R(t)) * 1.3), f(Math.sin(R(t)) * 1.3)];
    b += `<line x1='${f(x - dx)}' y1='${f(y - dy)}' x2='${f(x + dx)}' y2='${f(y + dy)}' stroke='${colors[i % colors.length]}' stroke-width='1.3' stroke-linecap='round'/>`;
  }
  return svg(b);
}
// Ornament: a wrapped bonbon.
function bonbon() {
  return svg(
    `<path d='M-9 0 L-19 -7 L-17 0 L-19 7Z M9 0 L19 -7 L17 0 L19 7Z' fill='#ff6fa8' stroke='#b8326b' stroke-width='1'/>` +
      `<circle r='9' fill='#fff0f8' stroke='#b8326b' stroke-width='1.2'/>` +
      `<path d='M-6 -6.7 Q0 0 -6 6.7 M0 -9 Q6 0 0 9 M6 -6.7 Q12 0 6 6.7' fill='none' stroke='#ff6fa8' stroke-width='2.4'/>` +
      `<ellipse cx='-3' cy='-4' rx='2.6' ry='1.4' fill='#fff' opacity='.85'/>`,
    "-20 -11 40 22",
  );
}

// ── Garden: an intertwined vine with leaves and blossoms.
function vine() {
  seed = 23;
  let b = "";
  const s1 = (a) => 55.5 + 3 * Math.sin(R(a * 9));
  const s2 = (a) => 55.5 - 3 * Math.sin(R(a * 9));
  b += `<path d='${pathOf(polar(s2, 0, 359, 3))}' fill='none' stroke='#2f5a1a' stroke-width='2.6'/>`;
  b += `<path d='${pathOf(polar(s2, 0, 359, 3))}' fill='none' stroke='#4f8f2c' stroke-width='1.4'/>`;
  b += `<path d='${pathOf(polar(s1, 0, 359, 3))}' fill='none' stroke='#2f5a1a' stroke-width='3'/>`;
  b += `<path d='${pathOf(polar(s1, 0, 359, 3))}' fill='none' stroke='#6fbf4a' stroke-width='1.8'/>`;
  // Curling tendrils.
  for (let i = 0; i < 6; i++) {
    const a = i * 60 + 30;
    const [x, y] = pt(s1(a), a);
    const [x2, y2] = pt(62, a + 6);
    const [x3, y3] = pt(60, a + 11);
    b += `<path d='M${x} ${y} Q${x2} ${y2} ${x3} ${y3}' fill='none' stroke='#6fbf4a' stroke-width='.9' stroke-linecap='round'/>`;
  }
  const leaf = (a, r, out, size) => {
    const [x, y] = pt(r, a);
    const rot = a + (out ? 90 - 55 : 90 + 55) + 90;
    const s = size;
    return `<g transform='translate(${x} ${y}) rotate(${f(rot)})'><path d='M0 0 C${f(2.4 * s)} ${f(-1.6 * s)} ${f(6 * s)} ${f(-1.4 * s)} ${f(8 * s)} 0 C${f(6 * s)} ${f(1.4 * s)} ${f(2.4 * s)} ${f(1.6 * s)} 0 0Z' fill='${out ? "#7fd05a" : "#5aa83a"}' stroke='#2f5a1a' stroke-width='.7'/><path d='M0.6 0 L${f(7 * s)} 0' stroke='#2f5a1a' stroke-width='.45' opacity='.7'/></g>`;
  };
  for (let i = 0; i < 24; i++) {
    const a = i * 15 + 4;
    const out = i % 2 === 0;
    b += leaf(a, out ? s1(a) + 0.5 : s1(a) - 0.5, out, 1 + rnd() * 0.3);
  }
  const bloom = (a, c) => {
    const [x, y] = pt(55.5, a);
    let p = "";
    for (let k = 0; k < 5; k++) {
      const [px, py] = pt(2.3, k * 72 + a);
      p += `<circle cx='${f(x + px)}' cy='${f(y + py)}' r='2.1' fill='${c}' stroke='#c76a92' stroke-width='.5'/>`;
    }
    return (
      p +
      `<circle cx='${x}' cy='${y}' r='1.5' fill='#ffd65b' stroke='#c9902a' stroke-width='.4'/>`
    );
  };
  [30, 102, 174, 246, 318].forEach(
    (a, i) => (b += bloom(a, i % 2 ? "#fff0f5" : "#ffb3cf")),
  );
  return svg(b);
}
// Ornament: a five-petal bloom with two leaves.
function blossom() {
  let p = `<path d='M0 0 C4 -6 12 -6 15 -2 C11 1 4 2 0 0Z' fill='#6fbf4a' stroke='#2f5a1a' stroke-width='.8' transform='rotate(20)'/>`;
  p += `<path d='M0 0 C4 -6 12 -6 15 -2 C11 1 4 2 0 0Z' fill='#5aa83a' stroke='#2f5a1a' stroke-width='.8' transform='rotate(150)'/>`;
  for (let k = 0; k < 5; k++)
    p += `<ellipse cx='0' cy='-6' rx='4.4' ry='6.2' fill='${k % 2 ? "#ffd0e2" : "#ffb3cf"}' stroke='#c76a92' stroke-width='.8' transform='rotate(${k * 72})'/>`;
  p += `<circle r='3.6' fill='#ffd65b' stroke='#c9902a' stroke-width='.8'/><circle cx='-1' cy='-1' r='1.2' fill='#fff6c4'/>`;
  return svg(p, "-16 -16 32 32");
}

// ── Festival: red lacquer with a gold lattice and coin studs.
function tassel() {
  let b = "";
  b += `<circle r='55.3' fill='none' stroke='#b3121a' stroke-width='10.6'/>`;
  b += `<circle r='55.3' fill='none' stroke='#e0262d' stroke-width='6'/>`;
  b += `<circle r='50.4' fill='none' stroke='#ffd65b' stroke-width='1.6'/>`;
  b += `<circle r='60.4' fill='none' stroke='#ffd65b' stroke-width='1.8'/>`;
  b += `<circle r='61.6' fill='none' stroke='#8a5a12' stroke-width='.8'/>`;
  // A continuous gold zig-zag lattice around the band.
  const zig = [];
  for (let a = 0; a <= 360; a += 7.5)
    zig.push(pt(zig.length % 2 ? 58 : 52.6, a));
  b += `<path d='${pathOf(zig, false)}' fill='none' stroke='#ffd65b' stroke-width='.9' opacity='.85'/>`;
  for (let i = 0; i < 48; i++) {
    const [x, y] = pt(i % 2 ? 53.3 : 57.3, i * 7.5 + 3.75);
    b += `<circle cx='${x}' cy='${y}' r='.75' fill='#ffe9a0'/>`;
  }
  for (const a of [45, 135, 225, 315]) {
    const [x, y] = pt(55.3, a);
    b += `<circle cx='${x}' cy='${y}' r='5.2' fill='#ffd65b' stroke='#8a5a12' stroke-width='1'/>`;
    b += `<circle cx='${x}' cy='${y}' r='3.7' fill='none' stroke='#c9902a' stroke-width='.6'/>`;
    b += `<rect x='${f(x - 1.4)}' y='${f(y - 1.4)}' width='2.8' height='2.8' transform='rotate(${a} ${x} ${y})' fill='#b3121a' stroke='#8a5a12' stroke-width='.5'/>`;
  }
  // A small gold knot at the top.
  b += `<g transform='translate(0 -55.3) rotate(45)'><rect x='-4' y='-4' width='8' height='8' rx='1.4' fill='#b3121a' stroke='#ffd65b' stroke-width='1.4'/><path d='M-4 0H4M0 -4V4' stroke='#ffd65b' stroke-width='.9'/></g>`;
  return svg(b);
}
// Ornament: a Chinese knot with a gold cap and a red tassel.
function knot() {
  return svg(
    `<path d='M10 0V6' stroke='#ffd65b' stroke-width='1.4'/>` +
      `<g transform='translate(10 13) rotate(45)'><rect x='-6' y='-6' width='12' height='12' rx='2' fill='#d8262a' stroke='#8a1015' stroke-width='1'/><path d='M-6 -2H6M-6 2H6M-2 -6V6M2 -6V6' stroke='#ffd65b' stroke-width='.9'/></g>` +
      `<rect x='6.5' y='21' width='7' height='3.4' rx='1.2' fill='#ffd65b' stroke='#8a5a12' stroke-width='.6'/>` +
      `<path d='M7 24.4 L5.6 39 H14.4 L13 24.4Z' fill='#d8262a' stroke='#8a1015' stroke-width='.6'/>` +
      `<path d='M8.2 25V38.6M10 25V38.6M11.8 25V38.6' stroke='#ff6a6e' stroke-width='.6'/>`,
    "0 0 20 40",
  );
}

// ── Winter: a faceted ice ring with a snow cap and hanging icicles.
function icicle() {
  seed = 41;
  let b = `<defs><linearGradient id='i' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='1' stop-color='#9fdcff'/></linearGradient><linearGradient id='c' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#e8f8ff'/><stop offset='1' stop-color='#6fc4f2'/></linearGradient></defs>`;
  // Icicles on the lower two-thirds, pointing outward.
  for (let a = 22; a <= 158; a += 6.8) {
    // Longest under the portrait, short where the ring turns up the sides.
    const len = (3 + rnd() * 6) * Math.pow(Math.sin(R(a)), 1.5) + 2.5;
    const w = 2.1 + rnd() * 0.7;
    const [x1, y1] = pt(58, a - w);
    const [x2, y2] = pt(58, a + w);
    const [tx, ty] = pt(58 + len, a);
    b += `<path d='M${x1} ${y1} L${tx} ${ty} L${x2} ${y2}Z' fill='url(#i)' stroke='#5fb4e6' stroke-width='.6' stroke-linejoin='round'/>`;
  }
  b += `<circle r='54.6' fill='none' stroke='#5fb4e6' stroke-width='10.4'/>`;
  b += `<circle r='54.6' fill='none' stroke='url(#c)' stroke-width='8.6'/>`;
  // Crystal facets.
  for (let a = 0; a < 360; a += 12) {
    const [x1, y1] = pt(50.6, a);
    const [x2, y2] = pt(58.6, a + 6);
    const [x3, y3] = pt(50.6, a + 12);
    b += `<path d='M${x1} ${y1} L${x2} ${y2} L${x3} ${y3}' fill='none' stroke='#ffffff' stroke-width='.6' opacity='.7'/>`;
  }
  b += `<circle r='50.4' fill='none' stroke='#ffffff' stroke-width='1.1'/>`;
  b += `<circle r='59.2' fill='none' stroke='#d8f2ff' stroke-width='.9'/>`;
  // Snow cap across the top.
  const outer = polar((a) => 60 + 1.6 * Math.sin(R(a * 11)) + 1.2, 200, 340, 2);
  const inner = polar(() => 55.5, 200, 340, 2).reverse();
  b += `<path d='${pathOf([...outer, ...inner])}' fill='#ffffff' stroke='#bfe0f2' stroke-width='.7'/>`;
  const flake = (x, y, s) => {
    let p = "";
    for (let k = 0; k < 3; k++)
      p += `<path d='M${f(x - s)} ${y}H${f(x + s)}' transform='rotate(${k * 60} ${x} ${y})' stroke='#ffffff' stroke-width='.9' stroke-linecap='round'/>`;
    return p;
  };
  for (const a of [20, 70, 110, 160, 250, 290]) {
    const [x, y] = pt(54.6, a);
    b += flake(x, y, 2.4);
  }
  return svg(b);
}
// Ornament: a six-armed snowflake crystal.
function snowflake() {
  let p = "";
  for (let k = 0; k < 6; k++)
    p += `<g transform='rotate(${k * 60})'><path d='M0 0V-13M0 -5L-3.4 -8.4M0 -5L3.4 -8.4M0 -9.4L-2.4 -11.8M0 -9.4L2.4 -11.8' stroke='#5fb4e6' stroke-width='3.2' stroke-linecap='round'/><path d='M0 0V-13M0 -5L-3.4 -8.4M0 -5L3.4 -8.4M0 -9.4L-2.4 -11.8M0 -9.4L2.4 -11.8' stroke='#ffffff' stroke-width='1.6' stroke-linecap='round'/></g>`;
  p += `<circle r='2.6' fill='#ffffff' stroke='#5fb4e6' stroke-width='.8'/>`;
  return svg(p, "-15 -15 30 30");
}

// ── Void Knight: black steel with outward blades, violet runes, a rune gem.
function voidRing() {
  seed = 53;
  let b = `<defs><linearGradient id='v' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#4a4f63'/><stop offset='.5' stop-color='#1f2230'/><stop offset='1' stop-color='#0b0c12'/></linearGradient></defs>`;
  // Blades point outward all round, longer at the four diagonals.
  for (let a = 0; a < 360; a += 15) {
    const long = a % 90 === 45;
    const len = long ? 11 : a % 30 === 0 ? 6 : 4;
    const w = long ? 3.4 : 2.4;
    const [x1, y1] = pt(59, a - w);
    const [x2, y2] = pt(59, a + w);
    const [tx, ty] = pt(59 + len, a);
    b += `<path d='M${x1} ${y1} L${tx} ${ty} L${x2} ${y2}Z' fill='#262a37' stroke='#07080d' stroke-width='.8' stroke-linejoin='round'/>`;
    if (long)
      b += `<path d='M${pt(60, a).join(" ")} L${pt(59 + len - 2, a).join(" ")}' stroke='#b48cff' stroke-width='.8' opacity='.9'/>`;
  }
  b += `<circle r='55' fill='none' stroke='#07080d' stroke-width='11.4'/>`;
  b += `<circle r='55' fill='none' stroke='url(#v)' stroke-width='9.6'/>`;
  b += `<circle r='59.4' fill='none' stroke='#8d96ab' stroke-width='.7' opacity='.8'/>`;
  b += `<circle r='50.4' fill='none' stroke='#b48cff' stroke-width='1.3'/>`;
  b += `<circle r='50.4' fill='none' stroke='#b48cff' stroke-width='3.6' opacity='.25'/>`;
  // Runes round the band: a stave with angled branches, glowing.
  for (let i = 0; i < 18; i++) {
    const a = i * 20 + 10;
    const [x, y] = pt(55, a);
    const s = rnd() < 0.5 ? -1 : 1;
    const d = `M0 -3.2V3.2M0 -3.2l${s * 2} 1.8M0 0.4l${-s * 2} -1.6`;
    b += `<g transform='translate(${x} ${y}) rotate(${a + 90})'><path d='${d}' stroke='#b48cff' stroke-width='2.4' opacity='.35' stroke-linecap='round'/><path d='${d}' stroke='#efe6ff' stroke-width='.9' stroke-linecap='round'/></g>`;
  }
  // Rivets between the runes.
  for (let i = 0; i < 18; i++) {
    const [x, y] = pt(55, i * 20);
    b += `<circle cx='${x}' cy='${y}' r='.9' fill='#b3bccf'/>`;
  }
  // A rune gem at the bottom.
  b += `<circle cx='0' cy='55' r='6.6' fill='#b48cff' opacity='.35'/>`;
  b += `<path d='M0 49.6 L4.2 55 L0 60.4 L-4.2 55Z' fill='#b48cff' stroke='#07080d' stroke-width='1'/>`;
  b += `<path d='M-1 51.8 L1.2 54' stroke='#ffffff' stroke-width='.9' stroke-linecap='round'/>`;
  return svg(b);
}
// Ornament: a crown of blades over two crossed rune swords.
function voidCrest() {
  const sword = (rot) =>
    `<g transform='rotate(${rot})'><path d='M-1.6 -17 L0 -21 L1.6 -17 V6 H-1.6Z' fill='#2c3242' stroke='#07080d' stroke-width='.8'/><path d='M0 -16V4' stroke='#b48cff' stroke-width='1.6' opacity='.4'/><path d='M0 -16V4' stroke='#efe6ff' stroke-width='.6'/><path d='M-5 6.4H5' stroke='#07080d' stroke-width='2.6' stroke-linecap='round'/><path d='M-4.6 6.4H4.6' stroke='#4a4f63' stroke-width='1.4' stroke-linecap='round'/><path d='M0 7V12' stroke='#3a2c44' stroke-width='2'/><circle cy='13' r='1.4' fill='#b48cff' stroke='#07080d' stroke-width='.5'/></g>`;
  let b = sword(-38) + sword(38);
  // The crown: a curved band with five blades, the middle one tallest.
  const blades = [
    [-9, 6, -1.6],
    [-4.6, 9.5, -0.8],
    [0, 14, 0],
    [4.6, 9.5, 0.8],
    [9, 6, 1.6],
  ];
  for (const [x, h, lean] of blades) {
    const y = 2 + Math.abs(x) * 0.18;
    b += `<path d='M${f(x - 2)} ${f(y)} L${f(x + lean)} ${f(y - h)} L${f(x + 2)} ${f(y)}Z' fill='#262a37' stroke='#07080d' stroke-width='.7' stroke-linejoin='round'/>`;
  }
  b += `<path d='M0 -1 V-9' stroke='#b48cff' stroke-width='1.6' opacity='.45'/><path d='M0 -1 V-9' stroke='#efe6ff' stroke-width='.6'/>`;
  b += `<path d='M-11.5 3.4 Q0 -1.4 11.5 3.4 L11 6.4 Q0 1.8 -11 6.4Z' fill='#3b4255' stroke='#07080d' stroke-width='.7'/>`;
  b += `<path d='M0 2 L1.8 4 L0 6 L-1.8 4Z' fill='#b48cff' stroke='#07080d' stroke-width='.5'/>`;
  return svg(b, "-16 -18 32 32");
}

// ── Cyber Mecha: segmented chrome, neon circuits, status lights, HUD ticks.
function mechaRing() {
  let b = `<defs><linearGradient id='m' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffffff'/><stop offset='.45' stop-color='#b9c4d6'/><stop offset='.55' stop-color='#8693a8'/><stop offset='1' stop-color='#dfe6f0'/></linearGradient></defs>`;
  b += `<circle r='55' fill='none' stroke='#0a0e16' stroke-width='11'/>`;
  // Eight chrome plates with small gaps between them.
  for (let i = 0; i < 8; i++) {
    const a0 = i * 45 + 2.4,
      a1 = i * 45 + 42.6;
    const outer = polar(() => 59.6, a0, a1, 2);
    const inner = polar(() => 50.6, a0, a1, 2).reverse();
    b += `<path d='${pathOf([...outer, ...inner])}' fill='url(#m)' stroke='#0a0e16' stroke-width='.6'/>`;
    // A neon trace along each plate, with a step halfway.
    const mid = (a0 + a1) / 2;
    const t1 = pt(53.4, a0 + 4),
      t2 = pt(53.4, mid - 3),
      t3 = pt(56.8, mid),
      t4 = pt(56.8, a1 - 4);
    const d = `M${t1.join(" ")} A53.4 53.4 0 0 1 ${t2.join(" ")} L${t3.join(" ")} A56.8 56.8 0 0 1 ${t4.join(" ")}`;
    b += `<path d='${d}' fill='none' stroke='#3ff0ff' stroke-width='2.6' opacity='.3'/><path d='${d}' fill='none' stroke='#3ff0ff' stroke-width='.9'/>`;
    const [lx, ly] = pt(56.8, a1 - 4);
    const led = i % 3 === 0 ? "#ff4fd8" : "#3ff0ff";
    b += `<circle cx='${lx}' cy='${ly}' r='1.3' fill='${led}' stroke='#0a0e16' stroke-width='.4'/>`;
  }
  b += `<circle r='50.4' fill='none' stroke='#3ff0ff' stroke-width='1.1'/>`;
  b += `<circle r='50.4' fill='none' stroke='#3ff0ff' stroke-width='3.4' opacity='.22'/>`;
  // HUD brackets outside the ring at the four diagonals.
  for (const a of [45, 135, 225, 315]) {
    const p1 = pt(63.4, a - 7),
      p2 = pt(63.4, a + 7),
      c1 = pt(61, a - 7),
      c2 = pt(61, a + 7);
    b += `<path d='M${c1.join(" ")} L${p1.join(" ")} A63.4 63.4 0 0 1 ${p2.join(" ")} L${c2.join(" ")}' fill='none' stroke='#3ff0ff' stroke-width='1.1' stroke-linejoin='round'/>`;
  }
  // A core light at the bottom.
  b += `<circle cx='0' cy='55' r='6' fill='#3ff0ff' opacity='.3'/><circle cx='0' cy='55' r='4.4' fill='#5a6478' stroke='#0a0e16' stroke-width='.8'/><circle cx='0' cy='55' r='2.6' fill='#3ff0ff'/><circle cx='0' cy='55' r='1.1' fill='#ffffff'/>`;
  return svg(b);
}
// Ornament: a chrome V-fin with a neon core, like a mecha's head antenna.
function mechaCrest() {
  let b = "";
  for (const s of [-1, 1])
    b += `<path d='M${s * 1.4} 6 L${s * 14} -9 L${s * 10} -10 L${s * 2.4} -1 Z' fill='#dfe6f0' stroke='#0a0e16' stroke-width='.8' stroke-linejoin='round'/><path d='M${s * 2.6} 2 L${s * 12.6} -8.6' stroke='#3ff0ff' stroke-width='1.8' opacity='.35'/><path d='M${s * 2.6} 2 L${s * 12.6} -8.6' stroke='#3ff0ff' stroke-width='.7'/>`;
  b += `<path d='M-4.6 7 L0 1 L4.6 7 L0 10Z' fill='#8693a8' stroke='#0a0e16' stroke-width='.7'/>`;
  b += `<circle cy='6' r='2.4' fill='#3ff0ff' opacity='.4'/><circle cy='6' r='1.5' fill='#3ff0ff' stroke='#0a0e16' stroke-width='.4'/><circle cx='-.4' cy='5.6' r='.5' fill='#ffffff'/>`;
  return svg(b, "-15 -11 30 22");
}

// ── Arcade: neon tubes in magenta and cyan round a synthwave grid band.
function neonRing() {
  seed = 61;
  let b = `<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#2a0f4a'/><stop offset='1' stop-color='#120626'/></linearGradient></defs>`;
  b += `<circle r='55' fill='none' stroke='#0b0418' stroke-width='11.6'/>`;
  b += `<circle r='55' fill='none' stroke='url(#g)' stroke-width='9.8'/>`;
  // The grid: radial spokes and two rings inside the band.
  for (let a = 0; a < 360; a += 10) {
    const [x1, y1] = pt(51, a);
    const [x2, y2] = pt(59, a);
    b += `<path d='M${x1} ${y1} L${x2} ${y2}' stroke='#ff4fd8' stroke-width='.5' opacity='.55'/>`;
  }
  b += `<circle r='53.6' fill='none' stroke='#ff4fd8' stroke-width='.45' opacity='.5'/>`;
  b += `<circle r='56.6' fill='none' stroke='#ff4fd8' stroke-width='.45' opacity='.5'/>`;
  // Neon tubes: a soft glow, the tube and its hot core.
  const tube = (r, c) =>
    `<circle r='${r}' fill='none' stroke='${c}' stroke-width='4.4' opacity='.3'/><circle r='${r}' fill='none' stroke='${c}' stroke-width='1.8'/><circle r='${r}' fill='none' stroke='#ffffff' stroke-width='.6' opacity='.85'/>`;
  b += tube(60.2, "#ff4fd8");
  b += tube(50.3, "#2ff3ff");
  // Pixel sparkles round the band.
  for (let i = 0; i < 10; i++) {
    const a = i * 36 + 18 + rnd() * 10;
    const [x, y] = pt(55, a);
    const c = i % 2 ? "#2ff3ff" : "#ffd65b";
    b += `<rect x='${f(x - 0.9)}' y='${f(y - 2.7)}' width='1.8' height='5.4' fill='${c}'/><rect x='${f(x - 2.7)}' y='${f(y - 0.9)}' width='5.4' height='1.8' fill='${c}'/>`;
  }
  return svg(b);
}
// Ornament: an arcade joystick with two buttons on a little panel.
function joystick() {
  let b = "";
  b += `<path d='M-13 6 L13 6 L11 12 L-11 12Z' fill='#2a0f4a' stroke='#0b0418' stroke-width='.9' stroke-linejoin='round'/>`;
  b += `<path d='M-12.6 6 H12.6' stroke='#2ff3ff' stroke-width='.8'/>`;
  b += `<path d='M-5 6 V-6' stroke='#0b0418' stroke-width='3.2' stroke-linecap='round'/><path d='M-5 6 V-6' stroke='#9aa3b8' stroke-width='1.6' stroke-linecap='round'/>`;
  b += `<ellipse cx='-5' cy='6' rx='3.6' ry='1.4' fill='#0b0418'/>`;
  b += `<circle cx='-5' cy='-8' r='4.6' fill='#ff3b6a' stroke='#0b0418' stroke-width='.9'/><circle cx='-6.4' cy='-9.4' r='1.4' fill='#ffffff' opacity='.8'/>`;
  b += `<ellipse cx='4.4' cy='4.6' rx='2.6' ry='1.5' fill='#2ff3ff' stroke='#0b0418' stroke-width='.7'/>`;
  b += `<ellipse cx='9.4' cy='4.6' rx='2.6' ry='1.5' fill='#ffd65b' stroke='#0b0418' stroke-width='.7'/>`;
  return svg(b, "-15 -15 30 30");
}

// ── Seaside: a twisted rope set with scallop shells and pearls.
function shellRing() {
  let b = "";
  b += `<circle r='55' fill='none' stroke='#8a5a2c' stroke-width='9.8'/>`;
  b += `<circle r='55' fill='none' stroke='#e9c98f' stroke-width='8.2'/>`;
  // The rope's strands.
  for (let a = 0; a < 360; a += 6) {
    const [x1, y1] = pt(51.4, a);
    const [x2, y2] = pt(58.6, a + 5);
    b += `<path d='M${x1} ${y1}L${x2} ${y2}' stroke='#b98a4e' stroke-width='1.1' stroke-linecap='round'/>`;
  }
  b += `<circle r='50.6' fill='none' stroke='#fff3d6' stroke-width='1'/>`;
  b += `<circle r='59.6' fill='none' stroke='#fff3d6' stroke-width='.7' opacity='.7'/>`;
  // Pearls between the shells.
  for (const a of [0, 55, 110, 170, 228, 280, 335]) {
    const [x, y] = pt(55, a);
    b += `<circle cx='${x}' cy='${y}' r='2.2' fill='#ffffff' stroke='#c9b8a8' stroke-width='.6'/><circle cx='${f(x - 0.6)}' cy='${f(y - 0.6)}' r='.7' fill='#ffffff'/>`;
  }
  // Scallop shells set on the rope, their fans turned outward.
  const shell = (a, s, fill, rib) => {
    const [x, y] = pt(55.5, a);
    return (
      `<g transform='translate(${x} ${y}) rotate(${f(a + 90)}) scale(${s})'>` +
      `<path d='M0 5 L-3 3 Q-9 -1 -6.5 -6 Q-3.4 -9.4 0 -8.6 Q3.4 -9.4 6.5 -6 Q9 -1 3 3Z' fill='${fill}' stroke='#a8553f' stroke-width='.8' stroke-linejoin='round'/>` +
      `<path d='M0 4V-8M-1.4 3.6L-4.6 -6.6M1.4 3.6L4.6 -6.6M-2.4 3L-7 -3.4M2.4 3L7 -3.4' fill='none' stroke='${rib}' stroke-width='.7' stroke-linecap='round'/></g>`
    );
  };
  for (const [a, s, c, r] of [
    [200, 1.15, "#ffd9c8", "#e88a78"],
    [254, 0.95, "#fff3e6", "#e2b48a"],
    [308, 1.1, "#ffc2b0", "#d9705e"],
    [28, 0.95, "#fff3e6", "#e2b48a"],
    [82, 1.15, "#ffd9c8", "#e88a78"],
    [140, 0.95, "#ffc2b0", "#d9705e"],
  ])
    b += shell(a, s, c, r);
  return svg(b);
}
// Ornament: a coral starfish.
function starfish() {
  let d = "";
  for (let i = 0; i < 10; i++) {
    const [x, y] = pt(i % 2 ? 5.6 : 13, -90 + i * 36);
    d += `${i ? "L" : "M"}${x} ${y}`;
  }
  let dots = "";
  for (let i = 0; i < 5; i++)
    for (const r of [4.5, 8]) {
      const [x, y] = pt(r, -90 + i * 72);
      dots += `<circle cx='${x}' cy='${y}' r='.9' fill='#ffe1d2'/>`;
    }
  return svg(
    `<path d='${d}Z' fill='#ff8a6a' stroke='#b8452f' stroke-width='1.3' stroke-linejoin='round'/>${dots}<circle r='1.4' fill='#ffe1d2'/>`,
    "-15 -15 30 30",
  );
}

// ── Steamworks: a brass cog, riveted, with a copper gear set into it.
function cogRing() {
  let b = `<defs><linearGradient id='b' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ffe6a6'/><stop offset='.5' stop-color='#d9982f'/><stop offset='1' stop-color='#8a5a1c'/></linearGradient></defs>`;
  const teeth = (n, r0, r1, w0, w1, cx = 0, cy = 0, turn = 0) => {
    let d = "";
    for (let i = 0; i < n; i++) {
      const a = turn + (i * 360) / n;
      const q = [
        pt(r0, a - w0),
        pt(r1, a - w1),
        pt(r1, a + w1),
        pt(r0, a + w0),
      ];
      d += "M" + q.map(([x, y]) => `${f(x + cx)} ${f(y + cy)}`).join("L") + "Z";
    }
    return d;
  };
  b += `<path d='${teeth(20, 58, 63.6, 3.8, 2.4)}' fill='#c8862a' stroke='#5a3a12' stroke-width='.8' stroke-linejoin='round'/>`;
  b += `<circle r='55' fill='none' stroke='#5a3a12' stroke-width='10.6'/>`;
  b += `<circle r='55' fill='none' stroke='url(#b)' stroke-width='9'/>`;
  b += `<circle r='50.6' fill='none' stroke='#fff1c4' stroke-width='1'/>`;
  b += `<circle r='59.3' fill='none' stroke='#ffe6a6' stroke-width='.7' opacity='.8'/>`;
  // An engraved line and rivets round the rim.
  b += `<circle r='55' fill='none' stroke='#7a4f18' stroke-width='.7' opacity='.7'/>`;
  for (let i = 0; i < 12; i++) {
    const [x, y] = pt(55, i * 30 + 15);
    b += `<circle cx='${x}' cy='${y}' r='1.8' fill='#fff1c4' stroke='#5a3a12' stroke-width='.6'/>`;
  }
  // The copper gear, lower left.
  const [gx, gy] = pt(57, 135);
  b += `<path d='${teeth(8, 6.4, 9.2, 13, 8, gx, gy, 10)}' fill='#c8683a' stroke='#5a2a12' stroke-width='.7' stroke-linejoin='round'/>`;
  b += `<circle cx='${gx}' cy='${gy}' r='6.6' fill='#d97a4a' stroke='#5a2a12' stroke-width='.8'/>`;
  b += `<circle cx='${gx}' cy='${gy}' r='2.4' fill='#3a2410'/>`;
  b += `<circle cx='${gx}' cy='${gy}' r='4.6' fill='none' stroke='#ffd0b0' stroke-width='.6' opacity='.8'/>`;
  return svg(b);
}
// Ornament: a wind-up key.
function windKey() {
  return svg(
    `<path d='M0 14V2' stroke='#5a3a12' stroke-width='5.4' stroke-linecap='round'/><path d='M0 14V2' stroke='#d9982f' stroke-width='3.2' stroke-linecap='round'/>` +
      `<path d='M0 2C-4 -6 -14 -8 -14 -2C-14 4 -5 4 0 2Z M0 2C4 -6 14 -8 14 -2C14 4 5 4 0 2Z' fill='#e0a23a' stroke='#5a3a12' stroke-width='1.2' stroke-linejoin='round'/>` +
      `<ellipse cx='-8.4' cy='-2' rx='2.8' ry='2.2' fill='#3a2410'/><ellipse cx='8.4' cy='-2' rx='2.8' ry='2.2' fill='#3a2410'/>` +
      `<path d='M-12 -4.6Q-9 -7 -5.6 -5.6M5.6 -5.6Q9 -7 12 -4.6' fill='none' stroke='#fff1c4' stroke-width='.9' stroke-linecap='round'/>` +
      `<circle cy='2' r='2.5' fill='#fff1c4' stroke='#5a3a12' stroke-width='.8'/>`,
    "-16 -12 32 28",
  );
}

// ── Borealis: a night sky ringed by curtains of northern light, tallest
// over the top, with a ribbon of light winding through the stars.
function polarRing() {
  seed = 61;
  let b = `<defs><linearGradient id='n' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#1c4580'/><stop offset='1' stop-color='#0c1a40'/></linearGradient><linearGradient id='g' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#4dffb8'/><stop offset='.5' stop-color='#8ff0ff'/><stop offset='1' stop-color='#c9a6ff'/></linearGradient></defs>`;
  // The curtains: rays standing off the ring, green at the foot, violet at the tip.
  for (let a = 0; a < 360; a += 9) {
    const up = Math.max(0, -Math.sin(R(a)));
    const len =
      3 +
      (2.5 + 6.5 * up) * (0.55 + 0.45 * Math.pow(Math.sin(R(a * 5 + 30)), 2));
    const [x1, y1] = pt(58, a - 3.8);
    const [x2, y2] = pt(58, a + 3.8);
    const [tx, ty] = pt(58 + len, a + 1.5);
    const [m1x, m1y] = pt(58 + len * 0.5, a - 2);
    const [m2x, m2y] = pt(58 + len * 0.5, a + 3);
    b += `<path d='M${x1} ${y1}L${tx} ${ty}L${x2} ${y2}Z' fill='#b48cff' opacity='.7'/>`;
    b += `<path d='M${x1} ${y1}L${m1x} ${m1y}L${m2x} ${m2y}L${x2} ${y2}Z' fill='#4dffb8' opacity='.9'/>`;
  }
  b += `<circle r='55' fill='none' stroke='#4dffb8' stroke-width='11.2'/>`;
  b += `<circle r='55' fill='none' stroke='url(#n)' stroke-width='8.2'/>`;
  b += `<path d='${pathOf(polar((a) => 55 + 1.5 * Math.sin(R(a * 8)), 0, 358, 2))}' fill='none' stroke='url(#g)' stroke-width='3.6' opacity='.9' stroke-linejoin='round'/>`;
  // Stars: four-point glints and a scatter of dots.
  for (let i = 0; i < 9; i++) {
    const [x, y] = pt(52.6 + rnd() * 4.8, i * 40 + rnd() * 20);
    const s = 1.5 + rnd() * 1.1;
    b += `<path d='M${x} ${f(y - s)}L${f(x + s * 0.3)} ${f(y - s * 0.3)}L${f(x + s)} ${y}L${f(x + s * 0.3)} ${f(y + s * 0.3)}L${x} ${f(y + s)}L${f(x - s * 0.3)} ${f(y + s * 0.3)}L${f(x - s)} ${y}L${f(x - s * 0.3)} ${f(y - s * 0.3)}Z' fill='#ffffff'/>`;
  }
  for (let i = 0; i < 16; i++) {
    const [x, y] = pt(51.6 + rnd() * 6.8, rnd() * 360);
    b += `<circle cx='${x}' cy='${y}' r='${f(0.35 + rnd() * 0.4)}' fill='#ffffff' opacity='${f(0.5 + rnd() * 0.5)}'/>`;
  }
  b += `<circle r='50.3' fill='none' stroke='#b7fbe6' stroke-width='1.2'/>`;
  return svg(b);
}
// Ornament: the pole star.
function polarStar() {
  const star = (r1, r2, rot) => {
    let d = "";
    for (let i = 0; i < 8; i++) {
      const [x, y] = pt(i % 2 ? r2 : r1, rot + i * 45);
      d += `${i ? "L" : "M"}${x} ${y}`;
    }
    return d + "Z";
  };
  return svg(
    `<circle r='10' fill='#8ff0ff' opacity='.35'/><path d='${star(14, 3, -90)}' fill='#ffffff' stroke='#2fae96' stroke-width='1.1' stroke-linejoin='round'/><path d='${star(7.5, 2.4, -45)}' fill='#b48cff' stroke='#5a3a9a' stroke-width='.6' stroke-linejoin='round'/><circle r='2.4' fill='#ffffff'/>`,
    "-15 -15 30 30",
  );
}

// ── Singles (pieces sold on their own): a gold laurel wreath, open at the
// top, its stems tied with a red ribbon at the bottom.
function laurelRing() {
  let b = `<defs><linearGradient id='l' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff1b0'/><stop offset='.55' stop-color='#e2b23a'/><stop offset='1' stop-color='#8a6414'/></linearGradient></defs>`;
  b += `<circle r='55' fill='none' stroke='#6a4a10' stroke-width='6'/>`;
  b += `<circle r='55' fill='none' stroke='url(#l)' stroke-width='4.4'/>`;
  b += `<circle r='51.4' fill='none' stroke='#fff1b0' stroke-width='.9'/>`;
  const leaf = (a, rot, r, s) => {
    const [x, y] = pt(r, a);
    return (
      `<g transform='translate(${x} ${y}) rotate(${f(rot)}) scale(${s})'>` +
      `<path d='M0 0Q4.4 -5.6 0 -12.8Q-4.4 -5.6 0 0Z' fill='url(#l)' stroke='#6a4a10' stroke-width='.75' stroke-linejoin='round'/>` +
      `<path d='M0 -1.2V-11' stroke='#8a6414' stroke-width='.55'/></g>`
    );
  };
  // Two branches climb from the bottom (90°) up each side, leaves set in
  // and out in turn, pointing up the branch; the inner ones lean less, so
  // the portrait stays clear.
  for (let i = 0; i < 11; i++) {
    const t = 10 + i * 13.6;
    const out = i % 2 === 0;
    const r = out ? 58 : 52.4;
    const s = 1.3 - i * 0.03;
    const lean = out ? 34 : 18;
    b += leaf(90 - t, 90 - t + (out ? lean : -lean), r, s);
    b += leaf(90 + t, 90 + t + 180 + (out ? -lean : lean), r, s);
  }
  // A few gold berries on the branches.
  for (const a of [28, 152, -16, 196]) {
    const [x, y] = pt(60.4, a);
    b += `<circle cx='${x}' cy='${y}' r='1.7' fill='#ffe07a' stroke='#6a4a10' stroke-width='.6'/>`;
  }
  return svg(b);
}
// Ornament: the red ribbon tying the stems.
function ribbonBow() {
  return svg(
    `<path d='M-3 2L-9 15L-5 13L-3 17L0 4Z M3 2L9 15L5 13L3 17L0 4Z' fill='#c8323a' stroke='#6a1418' stroke-width='.9' stroke-linejoin='round'/>` +
      `<path d='M0 0C-6 -8 -15 -7 -14 -1C-13 5 -5 4 0 0Z M0 0C6 -8 15 -7 14 -1C13 5 5 4 0 0Z' fill='#e04a52' stroke='#6a1418' stroke-width='1' stroke-linejoin='round'/>` +
      `<path d='M-11 -2Q-8 -5 -4 -3M4 -3Q8 -5 11 -2' fill='none' stroke='#ffb0b6' stroke-width='.9' stroke-linecap='round'/>` +
      `<ellipse rx='3.2' ry='3' fill='#c8323a' stroke='#6a1418' stroke-width='.9'/>`,
    "-16 -10 32 28",
  );
}
// ── A jewelled gold band: rubies, sapphires and emeralds in gold bezels.
function crownRing() {
  let b = `<defs><linearGradient id='c' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#fff4c0'/><stop offset='.5' stop-color='#e8b33a'/><stop offset='1' stop-color='#7a5410'/></linearGradient></defs>`;
  b += `<circle r='55' fill='none' stroke='#5a3c0c' stroke-width='11'/>`;
  b += `<circle r='55' fill='none' stroke='url(#c)' stroke-width='9.4'/>`;
  b += `<circle r='50.6' fill='none' stroke='#fff4c0' stroke-width='1'/>`;
  b += `<circle r='59.6' fill='none' stroke='#fff4c0' stroke-width='.7' opacity='.8'/>`;
  // Beading along both edges of the band.
  b += `<circle r='51.8' fill='none' stroke='#a8781c' stroke-width='1' stroke-dasharray='.9 1.9' opacity='.9'/>`;
  b += `<circle r='58.2' fill='none' stroke='#a8781c' stroke-width='1' stroke-dasharray='.9 1.9' opacity='.9'/>`;
  const gems = [
    ["#e0303a", "#7a1018"],
    ["#3a6ae0", "#14286a"],
    ["#2ab86a", "#0e5a30"],
  ];
  for (let i = 0; i < 12; i++) {
    const [x, y] = pt(55, i * 30 + 15);
    const [c, d] = gems[i % 3];
    b += `<circle cx='${x}' cy='${y}' r='3.7' fill='#fff1b0' stroke='#5a3c0c' stroke-width='.7'/>`;
    b += `<circle cx='${x}' cy='${y}' r='2.7' fill='${c}' stroke='${d}' stroke-width='.6'/>`;
    b += `<circle cx='${f(x - 0.8)}' cy='${f(y - 0.9)}' r='.85' fill='#ffffff' opacity='.9'/>`;
  }
  return svg(b);
}
// Ornament: a gold crown with three points and a row of gems.
function crown() {
  return svg(
    `<path d='M-15 8L-17 -6L-8 1L0 -11L8 1L17 -6L15 8Z' fill='#e8b33a' stroke='#5a3c0c' stroke-width='1.3' stroke-linejoin='round'/>` +
      `<path d='M-15 8L15 8L14 13L-14 13Z' fill='#c8921e' stroke='#5a3c0c' stroke-width='1.2' stroke-linejoin='round'/>` +
      `<circle cx='-17' cy='-6' r='2.2' fill='#fff1b0' stroke='#5a3c0c' stroke-width='.8'/><circle cx='17' cy='-6' r='2.2' fill='#fff1b0' stroke='#5a3c0c' stroke-width='.8'/><circle cy='-11' r='2.4' fill='#fff1b0' stroke='#5a3c0c' stroke-width='.8'/>` +
      `<circle cy='10.5' r='2' fill='#e0303a' stroke='#7a1018' stroke-width='.6'/><circle cx='-8' cy='10.5' r='1.6' fill='#3a6ae0' stroke='#14286a' stroke-width='.5'/><circle cx='8' cy='10.5' r='1.6' fill='#2ab86a' stroke='#0e5a30' stroke-width='.5'/>` +
      `<path d='M-12 5L-13 -1M12 5L13 -1M-3 3L0 -5' stroke='#fff4c0' stroke-width='.9' stroke-linecap='round' opacity='.85'/>`,
    "-20 -15 40 30",
  );
}

const out = {
  cookie: pictures.url("cookie", cookie()),
  bonbon: pictures.url("bonbon", bonbon()),
  vine: pictures.url("vine", vine()),
  blossom: pictures.url("blossom", blossom()),
  tassel: pictures.url("tassel", tassel()),
  knot: pictures.url("knot", knot()),
  icicle: pictures.url("icicle", icicle()),
  snowflake: pictures.url("snowflake", snowflake()),
  voidRing: pictures.url("void-ring", voidRing()),
  voidCrest: pictures.url("void-crest", voidCrest()),
  mechaRing: pictures.url("mecha-ring", mechaRing()),
  mechaCrest: pictures.url("mecha-crest", mechaCrest()),
  neonRing: pictures.url("neon-ring", neonRing()),
  joystick: pictures.url("joystick", joystick()),
  shellRing: pictures.url("shell-ring", shellRing()),
  starfish: pictures.url("starfish", starfish()),
  cogRing: pictures.url("cog-ring", cogRing()),
  windKey: pictures.url("wind-key", windKey()),
  polarRing: pictures.url("polar-ring", polarRing()),
  polarStar: pictures.url("polar-star", polarStar()),
  laurelRing: pictures.url("laurel-ring", laurelRing()),
  ribbonBow: pictures.url("ribbon-bow", ribbonBow()),
  crownRing: pictures.url("crown-ring", crownRing()),
  crown: pictures.url("crown", crown()),
};

const a = out;
const css = `/* Collection portrait frames (Candy, Garden, Festival, Winter, Seaside,
   Steamworks, Borealis; and the reward frames for owning every Void Knight,
   Cyber Mecha or Arcade skin).
   Artwork is drawn as scalable SVG so the same frame reads clearly from a
   small identity portrait up to the large fitting-room review. ::before is
   the ring (viewBox -70…70 around a radius-50 portrait, hence inset -20%),
   ::after the frame's own ornament. Generated from scripts/frame-art.mjs. */
.raid-cosmetic-preview:is(
    [data-cosmetic="candy-frame"],
    [data-cosmetic="garden-frame"],
    [data-cosmetic="festival-frame"],
    [data-cosmetic="winter-frame"],
    [data-cosmetic="void-frame"],
    [data-cosmetic="cyber-frame"],
    [data-cosmetic="arcade-frame"],
    [data-cosmetic="seaside-frame"],
    [data-cosmetic="steamworks-frame"],
    [data-cosmetic="borealis-frame"],
    [data-cosmetic="laurel-frame"],
    [data-cosmetic="crown-frame"]
  ) {
  box-shadow: none;
}
.raid-cosmetic-preview:is(
    [data-cosmetic="candy-frame"],
    [data-cosmetic="garden-frame"],
    [data-cosmetic="festival-frame"],
    [data-cosmetic="winter-frame"],
    [data-cosmetic="void-frame"],
    [data-cosmetic="cyber-frame"],
    [data-cosmetic="arcade-frame"],
    [data-cosmetic="seaside-frame"],
    [data-cosmetic="steamworks-frame"],
    [data-cosmetic="borealis-frame"],
    [data-cosmetic="laurel-frame"],
    [data-cosmetic="crown-frame"]
  )::before {
  content: "";
  position: absolute;
  inset: -20%;
  z-index: 1;
  background: center / 100% 100% no-repeat;
  pointer-events: none;
}
.raid-cosmetic-preview:is(
    [data-cosmetic="candy-frame"],
    [data-cosmetic="garden-frame"],
    [data-cosmetic="festival-frame"],
    [data-cosmetic="winter-frame"],
    [data-cosmetic="void-frame"],
    [data-cosmetic="cyber-frame"],
    [data-cosmetic="arcade-frame"],
    [data-cosmetic="seaside-frame"],
    [data-cosmetic="steamworks-frame"],
    [data-cosmetic="borealis-frame"],
    [data-cosmetic="laurel-frame"],
    [data-cosmetic="crown-frame"]
  )::after {
  content: "";
  position: absolute;
  inset: auto;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  outline: none;
  background: center / contain no-repeat;
  filter: drop-shadow(0 1px 1px #0008);
  pointer-events: none;
}

/* Candy: a chocolate-chip cookie with dripping icing, sprinkles and a bonbon. */
.raid-cosmetic-preview[data-cosmetic="candy-frame"]::before {
  background-image: ${a.cookie};
}
.raid-cosmetic-preview[data-cosmetic="candy-frame"]::after {
  top: -9%;
  right: -16%;
  width: 36%;
  height: 20%;
  transform: rotate(32deg);
  background-image: ${a.bonbon};
}

/* Garden: two vines twisting round, leaves, blossoms and a large bloom. */
.raid-cosmetic-preview[data-cosmetic="garden-frame"]::before {
  background-image: ${a.vine};
}
.raid-cosmetic-preview[data-cosmetic="garden-frame"]::after {
  top: -14%;
  left: -14%;
  width: 34%;
  height: 34%;
  transform: none;
  background-image: ${a.blossom};
}

/* Festival: red lacquer, gold lattice and coins, a hanging knot and tassel. */
.raid-cosmetic-preview[data-cosmetic="festival-frame"]::before {
  background-image: ${a.tassel};
}
.raid-cosmetic-preview[data-cosmetic="festival-frame"]::after {
  left: 50%;
  bottom: -37%;
  width: 14%;
  height: 28%;
  transform: translateX(-50%);
  background-image: ${a.knot};
}

/* Winter: faceted ice, a snow cap, icicles all round the lower edge and a
   snowflake crest — cold and spiky where Festival is warm and round. */
.raid-cosmetic-preview[data-cosmetic="winter-frame"]::before {
  background-image: ${a.icicle};
}
.raid-cosmetic-preview[data-cosmetic="winter-frame"]::after {
  top: -20%;
  left: 50%;
  width: 26%;
  height: 26%;
  transform: translateX(-50%);
  background-image: ${a.snowflake};
}

/* Both premium sets are Epic. Their rarity edge and halo take each set's
   colours so the two frames never share the same purple trim. */
.raid-cosmetic-preview[data-cosmetic="festival-frame"] {
  --frame-glow: #ff5a3aaa;
}
.raid-cosmetic-preview[data-cosmetic="festival-frame"][data-tier="epic"]
  > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    #ffd65b,
    #ff5a3a,
    #fff1b8,
    #c4161c,
    #ffd65b
  );
}
.raid-cosmetic-preview[data-cosmetic="winter-frame"] {
  --frame-glow: #7fd0ffbb;
}
.raid-cosmetic-preview[data-cosmetic="winter-frame"][data-tier="epic"]
  > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    #ffffff,
    #7fd0ff,
    #e6f6ff,
    #3d9be0,
    #ffffff
  );
}

/* Void Knight (reward for all sixteen Void Knights): black steel with
   outward blades and violet runes, a crown of blades over crossed swords. */
.raid-cosmetic-preview[data-cosmetic="void-frame"]::before {
  background-image: ${a.voidRing};
}
.raid-cosmetic-preview[data-cosmetic="void-frame"]::after {
  top: -33%;
  left: 50%;
  width: 40%;
  height: 40%;
  transform: translateX(-50%);
  background-image: ${a.voidCrest};
}
.raid-cosmetic-preview[data-cosmetic="void-frame"] {
  --frame-glow: #b48cffaa;
}
/* Mythic, but its halo stays in the knight's violet, not the rainbow. */
.raid-cosmetic-preview[data-cosmetic="void-frame"][data-tier="mythic"]
  > .tier-glow {
  background: conic-gradient(
    from var(--tier-turn),
    #b48cffcc,
    #5a3a9acc,
    #efe6ffcc,
    #5a3a9acc,
    #b48cffcc
  );
}
.raid-cosmetic-preview[data-cosmetic="void-frame"][data-tier="mythic"]
  > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    #b48cff,
    #1f2230,
    #efe6ff,
    #5a3a9a,
    #b48cff
  );
}

/* Cyber Mecha (reward for all sixteen Cyber Mechas): segmented chrome,
   neon circuits, status lights and HUD brackets, a V-fin on top. */
.raid-cosmetic-preview[data-cosmetic="cyber-frame"]::before {
  background-image: ${a.mechaRing};
}
.raid-cosmetic-preview[data-cosmetic="cyber-frame"]::after {
  top: -25%;
  left: 50%;
  width: 40%;
  height: 30%;
  transform: translateX(-50%);
  background-image: ${a.mechaCrest};
}
.raid-cosmetic-preview[data-cosmetic="cyber-frame"] {
  --frame-glow: #3ff0ffaa;
}
.raid-cosmetic-preview[data-cosmetic="cyber-frame"][data-tier="epic"]
  > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    #3ff0ff,
    #dfe6f0,
    #ff4fd8,
    #8693a8,
    #3ff0ff
  );
}

/* Arcade (reward for all eight Arcade skins): neon tubes in magenta and
   cyan round a synthwave grid, pixel sparkles and a joystick on top. */
.raid-cosmetic-preview[data-cosmetic="arcade-frame"]::before {
  background-image: ${a.neonRing};
}
.raid-cosmetic-preview[data-cosmetic="arcade-frame"]::after {
  top: -27%;
  left: 50%;
  width: 34%;
  height: 34%;
  transform: translateX(-50%);
  background-image: ${a.joystick};
}
.raid-cosmetic-preview[data-cosmetic="arcade-frame"] {
  --frame-glow: #ff4fd8aa;
}
.raid-cosmetic-preview[data-cosmetic="arcade-frame"][data-tier="epic"]
  > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    #ff4fd8,
    #2ff3ff,
    #ffd65b,
    #7a2bd6,
    #ff4fd8
  );
}

/* ---- The Look sets added on 25 Nov 2026 (docs/shop-new-items.md) ----
   Their frames, and the small pictures of their other pieces, live here
   rather than in style.css. */

/* Seaside: a twisted rope set with scallop shells and pearls, a starfish. */
.raid-cosmetic-preview[data-cosmetic="seaside-frame"]::before {
  background-image: ${a.shellRing};
}
.raid-cosmetic-preview[data-cosmetic="seaside-frame"]::after {
  right: -13%;
  bottom: -11%;
  width: 34%;
  height: 34%;
  transform: rotate(16deg);
  background-image: ${a.starfish};
}
.raid-cosmetic-preview[data-cosmetic="seaside-frame"] {
  --frame-glow: #ff9a76aa;
}

/* Steamworks: a riveted brass cog with a copper gear, a wind-up key on top. */
.raid-cosmetic-preview[data-cosmetic="steamworks-frame"]::before {
  background-image: ${a.cogRing};
}
.raid-cosmetic-preview[data-cosmetic="steamworks-frame"]::after {
  top: -33%;
  left: 50%;
  width: 34%;
  height: 30%;
  transform: translateX(-50%);
  background-image: ${a.windKey};
}
.raid-cosmetic-preview[data-cosmetic="steamworks-frame"] {
  --frame-glow: #e0a23aaa;
}
.raid-cosmetic-preview[data-cosmetic="steamworks-frame"][data-tier="epic"]
  > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    #e0a23a,
    #fff1c4,
    #c8683a,
    #8a5a1c,
    #e0a23a
  );
}

/* Borealis: a night sky ringed by curtains of northern light, the pole
   star on top. Mythical, but its halo stays in the lights' green and violet. */
.raid-cosmetic-preview[data-cosmetic="borealis-frame"]::before {
  background-image: ${a.polarRing};
}
.raid-cosmetic-preview[data-cosmetic="borealis-frame"]::after {
  top: -34%;
  left: 50%;
  width: 40%;
  height: 40%;
  transform: translateX(-50%);
  background-image: ${a.polarStar};
}
.raid-cosmetic-preview[data-cosmetic="borealis-frame"] {
  --frame-glow: #4dffb8aa;
}
.raid-cosmetic-preview[data-cosmetic="borealis-frame"][data-tier="mythic"]
  > .tier-glow {
  background: conic-gradient(
    from var(--tier-turn),
    #4dffb8cc,
    #8ff0ffcc,
    #b48cffcc,
    #14305acc,
    #4dffb8cc
  );
}
.raid-cosmetic-preview[data-cosmetic="borealis-frame"][data-tier="mythic"]
  > .tier-fx {
  background: conic-gradient(
    from var(--tier-turn),
    #4dffb8,
    #14305a,
    #eafff6,
    #b48cff,
    #4dffb8
  );
}

/* Small avatars that show no frame art: a ring in the set's colours. */
:is(.raid-party-avatar, .raid-score-avatar, .player-avatar):is(
  [data-raid-cosmetic~="seaside-frame"],
  [data-raid-cosmetic~="steamworks-frame"],
  [data-raid-cosmetic~="borealis-frame"]
) {
  position: relative;
  border-radius: 50%;
}
:is(
  .raid-party-avatar,
  .raid-score-avatar,
  .player-avatar
)[data-raid-cosmetic~="seaside-frame"] {
  box-shadow:
    0 0 0 3px #e9c98f,
    0 0 0 5px #ff9a76;
}
:is(
  .raid-party-avatar,
  .raid-score-avatar,
  .player-avatar
)[data-raid-cosmetic~="steamworks-frame"] {
  box-shadow:
    0 0 0 3px #d9982f,
    0 0 0 5px #5a3a12;
}
:is(
  .raid-party-avatar,
  .raid-score-avatar,
  .player-avatar
)[data-raid-cosmetic~="borealis-frame"] {
  box-shadow:
    0 0 0 3px #14305a,
    0 0 0 4px #4dffb8,
    0 0 10px 3px #b48cff66;
}

/* Colours restyle the portrait (in play, the rig recolours the textures). */
.raid-cosmetic-preview[data-cosmetic="seaside-colours"] > svg,
:is(
    .raid-party-avatar,
    .raid-score-avatar,
    .player-avatar
  )[data-raid-cosmetic~="seaside-colours"]
  > svg {
  filter: sepia(0.75) hue-rotate(-22deg) saturate(1.9) brightness(1.06);
}
.raid-cosmetic-preview[data-cosmetic="steamworks-colours"] > svg,
:is(
    .raid-party-avatar,
    .raid-score-avatar,
    .player-avatar
  )[data-raid-cosmetic~="steamworks-colours"]
  > svg {
  filter: sepia(0.95) saturate(1.7) brightness(0.92);
}
.raid-cosmetic-preview[data-cosmetic="borealis-colours"] > svg,
:is(
    .raid-party-avatar,
    .raid-score-avatar,
    .player-avatar
  )[data-raid-cosmetic~="borealis-colours"]
  > svg {
  filter: grayscale(0.3) sepia(0.6) hue-rotate(105deg) saturate(2)
    brightness(0.9);
}

/* Auras: a ring under the portrait in the set's style. */
.raid-cosmetic-preview[data-cosmetic="seaside-aura"] {
  box-shadow:
    0 0 0 2px #ffffff,
    0 0 0 5px #7fe0d888;
  background: radial-gradient(circle, #14213a 56%, #ff9a7655);
}
.raid-cosmetic-preview[data-cosmetic="steamworks-aura"] {
  box-shadow:
    0 0 0 2px #e0a23a,
    0 0 0 4px #5a3a12,
    0 0 0 5px #ffe6a6;
  background: radial-gradient(circle, #14213a 56%, #e0a23a44);
}
.raid-cosmetic-preview[data-cosmetic="borealis-aura"] {
  box-shadow:
    0 0 0 2px #4dffb8,
    0 0 12px 4px #b48cff88;
  background: radial-gradient(circle, #14213a 50%, #4dffb844, #b48cff55);
}

/* Entrances and victories: a hint of the moment behind the preview. */
.raid-cosmetic-preview[data-cosmetic="seaside-entrance"] {
  background: linear-gradient(#14213a 58%, #f2c98a 58% 82%, #7fe0d8 82%);
}
.raid-cosmetic-preview[data-cosmetic="steamworks-entrance"] {
  background:
    radial-gradient(circle at 50% 30%, #f4f1e6aa 0 22%, transparent 40%),
    linear-gradient(#14213a 78%, #e0a23a 78%);
}
.raid-cosmetic-preview[data-cosmetic="borealis-entrance"] {
  background: linear-gradient(
    90deg,
    #14213a 20%,
    #4dffb888 38%,
    #8ff0ffaa 50%,
    #b48cff88 62%,
    #14213a 80%
  );
}
.raid-cosmetic-preview[data-cosmetic="seaside-victory"] {
  background:
    linear-gradient(transparent 68%, #2f9ec4 68% 80%, #8fe6e8 80%),
    radial-gradient(circle at 50% 68%, #ffe08a 0 26%, #ff8a4c 40%, #14213a 62%);
}
.raid-cosmetic-preview[data-cosmetic="steamworks-victory"] {
  background: radial-gradient(
    circle,
    #4a2f14 0 6%,
    #fff6dc 7% 44%,
    #e0a23a 45% 54%,
    #14213a 56%
  );
}
.raid-cosmetic-preview[data-cosmetic="borealis-victory"] {
  background:
    linear-gradient(#4dffb866, transparent 46%),
    linear-gradient(transparent 14%, #b48cff66 34%, transparent 62%), #0a1430;
}

/* ---- Singles: pieces sold on their own, outside any set ---- */

/* Laurel: a gold laurel wreath, open at the top, tied with a red ribbon. */
.raid-cosmetic-preview[data-cosmetic="laurel-frame"]::before {
  background-image: ${a.laurelRing};
}
.raid-cosmetic-preview[data-cosmetic="laurel-frame"]::after {
  bottom: -27%;
  left: 50%;
  width: 34%;
  height: 30%;
  transform: translateX(-50%);
  background-image: ${a.ribbonBow};
}
.raid-cosmetic-preview[data-cosmetic="laurel-frame"] {
  --frame-glow: #e2b23aaa;
}

/* Crown: a jewelled gold band under a three-pointed crown. */
.raid-cosmetic-preview[data-cosmetic="crown-frame"]::before {
  background-image: ${a.crownRing};
}
.raid-cosmetic-preview[data-cosmetic="crown-frame"]::after {
  top: -34%;
  left: 50%;
  width: 42%;
  height: 32%;
  transform: translateX(-50%);
  background-image: ${a.crown};
}
.raid-cosmetic-preview[data-cosmetic="crown-frame"] {
  --frame-glow: #e8b33aaa;
}

/* Small avatars: a ring in the frame's colours. */
:is(.raid-party-avatar, .raid-score-avatar, .player-avatar):is(
  [data-raid-cosmetic~="laurel-frame"],
  [data-raid-cosmetic~="crown-frame"]
) {
  position: relative;
  border-radius: 50%;
}
:is(
  .raid-party-avatar,
  .raid-score-avatar,
  .player-avatar
)[data-raid-cosmetic~="laurel-frame"] {
  box-shadow:
    0 0 0 3px #e2b23a,
    0 0 0 4px #6a4a10;
}
:is(
  .raid-party-avatar,
  .raid-score-avatar,
  .player-avatar
)[data-raid-cosmetic~="crown-frame"] {
  box-shadow:
    0 0 0 3px #e8b33a,
    0 0 0 5px #5a3c0c,
    0 0 0 6px #e0303a;
}

/* Auras, entrances and victories: a hint of the piece behind the preview. */
.raid-cosmetic-preview[data-cosmetic="firefly-aura"] {
  box-shadow:
    0 0 0 2px #d8ff7a,
    0 0 10px 3px #fff3a066;
  background:
    radial-gradient(circle at 24% 70%, #fff3a0 0 3%, transparent 6%),
    radial-gradient(circle at 76% 34%, #fff3a0 0 3%, transparent 6%),
    radial-gradient(circle at 64% 80%, #d8ff7a 0 2.4%, transparent 5%),
    radial-gradient(circle, #14213a 56%, #3a4a1a);
}
.raid-cosmetic-preview[data-cosmetic="crystal-aura"] {
  box-shadow:
    0 0 0 2px #b48cff,
    0 0 0 4px #e6dcff88,
    0 0 0 5px #8ff0ff;
  background: radial-gradient(circle, #14213a 56%, #b48cff55, #8ff0ff44);
}
.raid-cosmetic-preview[data-cosmetic="bubble-entrance"] {
  background:
    radial-gradient(circle at 50% 46%, transparent 0 38%, #cff6ffcc 40% 42%, #ffc8f055 44%, transparent 47%),
    radial-gradient(circle at 34% 30%, #ffffffaa 0 4%, transparent 6%),
    #14213a;
}
.raid-cosmetic-preview[data-cosmetic="portal-entrance"] {
  background:
    radial-gradient(ellipse 60% 18% at 50% 82%, #4de8d8 0 30%, #9a5cff 50%, transparent 72%),
    linear-gradient(transparent 30%, #9a5cff44 80%),
    #14213a;
}
.raid-cosmetic-preview[data-cosmetic="trophy-victory"] {
  background:
    radial-gradient(circle at 50% 40%, #ffe08a88 0 26%, transparent 46%),
    linear-gradient(#14213a 72%, #6a4a2a 72%);
}
.raid-cosmetic-preview[data-cosmetic="meteor-victory"] {
  background:
    linear-gradient(225deg, transparent 22%, #ffd36bcc 24%, transparent 30%),
    linear-gradient(225deg, transparent 46%, #9fd8ffaa 47.5%, transparent 52%),
    radial-gradient(circle at 50% 30%, #3a2a6a, #0e1230 70%);
}
.raid-cosmetic-preview[data-cosmetic="music-aura"] {
  box-shadow:
    0 0 0 2px #ff6fa8,
    0 0 0 4px #6fd6ff88;
  background:
    radial-gradient(circle at 26% 30%, #ff6fa8 0 3.4%, transparent 5%),
    radial-gradient(circle at 74% 26%, #6fd6ff 0 3.4%, transparent 5%),
    radial-gradient(circle at 70% 76%, #ffd65b 0 3%, transparent 4.6%),
    radial-gradient(circle, #14213a 56%, #3a2a5a);
}
.raid-cosmetic-preview[data-cosmetic="rune-aura"] {
  box-shadow:
    0 0 0 2px #ffd36b,
    0 0 0 4px #6a3aff66,
    0 0 0 5px #ffd36b;
  background: radial-gradient(circle, #14213a 54%, #6a3aff55 70%, #ffd36b33);
}
.raid-cosmetic-preview[data-cosmetic="smoke-entrance"] {
  background:
    radial-gradient(circle at 22% 78%, #b7bfcc88 0 12%, transparent 20%),
    radial-gradient(circle at 78% 78%, #8a93a688 0 12%, transparent 20%),
    radial-gradient(circle at 30% 26%, #9be07a 0 2.6%, transparent 4%),
    #14213a;
}
.raid-cosmetic-preview[data-cosmetic="rainbow-entrance"] {
  background:
    radial-gradient(circle at 50% 96%, transparent 0 40%, #a77bff99 41% 44%, #4fb6ff99 44% 47%, #5fdc7a99 47% 50%, #ffe06699 50% 53%, #ff9f4399 53% 56%, #ff4f5a99 56% 59%, transparent 60%),
    #14213a;
}
.raid-cosmetic-preview[data-cosmetic="balloon-victory"] {
  background:
    radial-gradient(ellipse 9% 11% at 22% 30%, #ff4f6a 0 90%, transparent 100%),
    radial-gradient(ellipse 9% 11% at 78% 24%, #4fb6ff 0 90%, transparent 100%),
    radial-gradient(ellipse 8% 10% at 66% 62%, #ffd65b 0 90%, transparent 100%),
    #14213a;
}
.raid-cosmetic-preview[data-cosmetic="disco-victory"] {
  background:
    linear-gradient(200deg, transparent 30%, #ff4fd844 34%, transparent 46%),
    linear-gradient(160deg, transparent 30%, #4fb6ff44 34%, transparent 46%),
    radial-gradient(circle at 50% 18%, #e6ebf7 0 9%, #9aa3b8 10%, transparent 12%),
    #14213a;
}
`;
// The gold accent is a design token (ui/tokens.css): write it as one, as
// the stylesheet does (the pictures, in their own files, keep their colours).
const tokens = (text) =>
  text
    .replace(
      /#ffd65b55/g,
      "color-mix(in srgb, var(--ui-accent) 33.3%, transparent)",
    )
    .replace(
      /#ffd65b88/g,
      "color-mix(in srgb, var(--ui-accent) 53.3%, transparent)",
    )
    .replace(
      /#ffd65b99/g,
      "color-mix(in srgb, var(--ui-accent) 60%, transparent)",
    )
    .replace(/#ffd65b/g, "var(--ui-accent)");
writeFileSync(
  new URL("../apps/client/src/collection-frames.css", import.meta.url),
  tokens(css),
);
pictures.done();

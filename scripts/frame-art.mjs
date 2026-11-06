import { writeFileSync } from "node:fs";
// Generates apps/client/src/collection-frames.css: the Candy, Garden,
// Festival and Winter portrait frames drawn as SVG data URIs.
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
const uri = (s) =>
  `url("data:image/svg+xml,${s.replace(/#/g, "%23").replace(/"/g, "'").replace(/\s+/g, " ")}")`;

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

const out = {
  cookie: uri(cookie()),
  bonbon: uri(bonbon()),
  vine: uri(vine()),
  blossom: uri(blossom()),
  tassel: uri(tassel()),
  knot: uri(knot()),
  icicle: uri(icicle()),
  snowflake: uri(snowflake()),
  voidRing: uri(voidRing()),
  voidCrest: uri(voidCrest()),
  mechaRing: uri(mechaRing()),
  mechaCrest: uri(mechaCrest()),
};

const a = out;
const css = `/* Collection portrait frames (Candy, Garden, Festival, Winter; and the
   reward frames for owning every Void Knight or every Cyber Mecha skin).
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
    [data-cosmetic="cyber-frame"]
  ) {
  box-shadow: none;
}
.raid-cosmetic-preview:is(
    [data-cosmetic="candy-frame"],
    [data-cosmetic="garden-frame"],
    [data-cosmetic="festival-frame"],
    [data-cosmetic="winter-frame"],
    [data-cosmetic="void-frame"],
    [data-cosmetic="cyber-frame"]
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
    [data-cosmetic="cyber-frame"]
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

/* Both premium sets are Epic. Their rarity edge and gems take each set's
   colours so the two frames never share the same purple trim. */
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
  box-shadow:
    0 0 12px #ff5a3aaa,
    inset 0 0 6px #ffd65b88;
}
.raid-cosmetic-preview[data-cosmetic="festival-frame"][data-tier="epic"]
  > .tier-orbit {
  background:
    radial-gradient(circle at 50% 8%, #fff1b8 0 2.2%, #ffb02e 2.6%, transparent 4%),
    radial-gradient(circle at 92% 50%, #fff1b8 0 2.2%, #ff4a3a 2.6%, transparent 4%),
    radial-gradient(circle at 50% 92%, #fff1b8 0 2.2%, #ffb02e 2.6%, transparent 4%),
    radial-gradient(circle at 8% 50%, #fff1b8 0 2.2%, #ff4a3a 2.6%, transparent 4%);
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
  box-shadow:
    0 0 12px #7fd0ffbb,
    inset 0 0 6px #e6f6ff99;
}
.raid-cosmetic-preview[data-cosmetic="winter-frame"][data-tier="epic"]
  > .tier-orbit {
  background:
    radial-gradient(circle at 50% 8%, #ffffff 0 2.2%, #7fd0ff 2.6%, transparent 4%),
    radial-gradient(circle at 92% 50%, #ffffff 0 2.2%, #bfe8ff 2.6%, transparent 4%),
    radial-gradient(circle at 50% 92%, #ffffff 0 2.2%, #7fd0ff 2.6%, transparent 4%),
    radial-gradient(circle at 8% 50%, #ffffff 0 2.2%, #bfe8ff 2.6%, transparent 4%);
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
  box-shadow:
    0 0 14px #b48cffaa,
    inset 0 0 6px #efe6ff66;
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
  box-shadow:
    0 0 12px #3ff0ffaa,
    inset 0 0 6px #dfe6f099;
}
`;
writeFileSync(
  new URL("../apps/client/src/collection-frames.css", import.meta.url),
  css,
);

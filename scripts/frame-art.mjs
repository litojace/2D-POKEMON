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

const out = {
  cookie: uri(cookie()),
  bonbon: uri(bonbon()),
  vine: uri(vine()),
  blossom: uri(blossom()),
  tassel: uri(tassel()),
  knot: uri(knot()),
  icicle: uri(icicle()),
  snowflake: uri(snowflake()),
};

const a = out;
const css = `/* Collection portrait frames (Candy, Garden, Festival, Winter).
   Artwork is drawn as scalable SVG so the same frame reads clearly from a
   small identity portrait up to the large fitting-room review. ::before is
   the ring (viewBox -70…70 around a radius-50 portrait, hence inset -20%),
   ::after the frame's own ornament. Generated from scripts/frame-art.mjs. */
.raid-cosmetic-preview:is(
    [data-cosmetic="candy-frame"],
    [data-cosmetic="garden-frame"],
    [data-cosmetic="festival-frame"],
    [data-cosmetic="winter-frame"]
  ) {
  box-shadow: none;
}
.raid-cosmetic-preview:is(
    [data-cosmetic="candy-frame"],
    [data-cosmetic="garden-frame"],
    [data-cosmetic="festival-frame"],
    [data-cosmetic="winter-frame"]
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
    [data-cosmetic="winter-frame"]
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
`;
writeFileSync(
  new URL("../apps/client/src/collection-frames.css", import.meta.url),
  css,
);

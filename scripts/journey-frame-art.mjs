import { writeFileSync } from "node:fs";
// Generates apps/client/src/journey-frames.css: the Journey's Lv 55–100
// portrait frames (Prism frame, Prismatic laurel, Element Master frame),
// drawn as SVG data URIs like the Shop's collection frames (frame-art.mjs).
// Run: node scripts/journey-frame-art.mjs && npx prettier --write apps/client/src/journey-frames.css
// Frame art: viewBox -70 -70 140 140, the portrait disc is r = 50.
const R = (d) => (d * Math.PI) / 180;
const f = (n) => +n.toFixed(2);
const pt = (r, a) => [f(Math.cos(R(a)) * r), f(Math.sin(R(a)) * r)];
const P = (...pts) => pts.map((p) => p.join(" ")).join(" ");
const svg = (body, vb = "-70 -70 140 140") =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${body}</svg>`;
const uri = (s) =>
  `url("data:image/svg+xml,${s.replace(/#/g, "%23").replace(/"/g, "'").replace(/\s+/g, " ")}")`;
/** A colour at an angle round the spectrum (0° = red). */
const hue = (deg, s = 85, l = 70) =>
  `hsl(${f(((deg % 360) + 360) % 360)},${s}%,${l}%)`;
const GOLD = `<linearGradient id='gold' x1='0' y1='-1' x2='0' y2='1' gradientUnits='objectBoundingBox'><stop offset='0' stop-color='#fff6cf'/><stop offset='.45' stop-color='#ffd36b'/><stop offset='1' stop-color='#b9821f'/></linearGradient>`;
/** A four-point star. */
const star = (x, y, s, fill, extra = "") =>
  `<path d='M${f(x)} ${f(y - s)}L${f(x + s * 0.28)} ${f(y - s * 0.28)}L${f(x + s)} ${f(y)}L${f(x + s * 0.28)} ${f(y + s * 0.28)}L${f(x)} ${f(y + s)}L${f(x - s * 0.28)} ${f(y + s * 0.28)}L${f(x - s)} ${f(y)}L${f(x - s * 0.28)} ${f(y - s * 0.28)}Z' fill='${fill}' ${extra}/>`;

// ── Prism frame (Lv 55): a faceted crystal ring in every colour between
// gold rims, crystal compass points (the Wayfarer frame's compass, grown
// up) and a prism crest that splits a beam of starlight.
function prismRing() {
  let b = `<defs>${GOLD}</defs>`;
  const n = 28,
    r0 = 50.6,
    r1 = 59.2;
  for (let k = 0; k < n; k++) {
    const a0 = (k * 360) / n - 90,
      a1 = ((k + 1) * 360) / n - 90,
      am = (a0 + a1) / 2;
    const h = (k * 360) / n;
    // Each facet: a lit half and a shaded half, like a cut gem.
    b += `<polygon points='${P(pt(r0, a0), pt(r1, a0), pt((r0 + r1) / 2 + 1.2, am))}' fill='${hue(h, 90, 80)}'/>`;
    b += `<polygon points='${P(pt(r0, a0), pt((r0 + r1) / 2 + 1.2, am), pt(r0, a1))}' fill='${hue(h + 6, 80, 64)}'/>`;
    b += `<polygon points='${P(pt(r1, a0), pt(r1, a1), pt((r0 + r1) / 2 + 1.2, am))}' fill='${hue(h + 6, 85, 72)}'/>`;
    b += `<polygon points='${P(pt(r0, a1), pt((r0 + r1) / 2 + 1.2, am), pt(r1, a1))}' fill='${hue(h + 12, 75, 58)}'/>`;
  }
  // Starlight catching the upper-left facets.
  for (const a of [-150, -138, -126, -114])
    b += `<path d='M${P(pt(52, a))}L${P(pt(57.6, a + 4))}' stroke='#fff' stroke-width='.9' stroke-linecap='round' opacity='.85'/>`;
  b += `<circle r='50.6' fill='none' stroke='url(#gold)' stroke-width='1.5'/>`;
  b += `<circle r='59.6' fill='none' stroke='url(#gold)' stroke-width='1.9'/>`;
  b += `<circle r='61' fill='none' stroke='#5a3c0e' stroke-width='.6' opacity='.7'/>`;
  // Compass points: crystal at the sides and bottom (the crest takes the
  // top), small gold ones between.
  for (const a of [0, 90, 180]) {
    const tip = pt(69, a),
      l = pt(60, a - 5),
      r = pt(60, a + 5),
      mid = pt(63, a);
    b += `<polygon points='${P(l, tip, r)}' fill='#b9f6ff' stroke='url(#gold)' stroke-width='.9' stroke-linejoin='round'/>`;
    b += `<polygon points='${P(l, tip, mid)}' fill='#ffffff' opacity='.75'/>`;
  }
  for (const a of [-45, 45, 135, 225]) {
    const tip = pt(66, a),
      l = pt(60, a - 3.5),
      r = pt(60, a + 3.5);
    b += `<polygon points='${P(l, tip, r)}' fill='url(#gold)' stroke='#7a5214' stroke-width='.4'/>`;
  }
  for (const a of [-112, -68, 22, 158])
    b += star(...pt(64.5, a), 2.4, "#fffbe8", "opacity='.9'");
  return svg(b);
}
function prismCrest() {
  // A glass prism in a gold mount: white light in, a rainbow out.
  let b = `<defs>${GOLD}<linearGradient id='glass' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f4feff'/><stop offset='.55' stop-color='#a8ecff'/><stop offset='1' stop-color='#6fc6ff'/></linearGradient></defs>`;
  const rays = [
    "#ff7d9c",
    "#ffb35a",
    "#ffe46b",
    "#8ff0b5",
    "#7fd8ff",
    "#b59bff",
  ];
  rays.forEach((c, i) => {
    const y = -6.5 + i * 2.6;
    b += `<path d='M3.2 ${f(-1.5 + i * 0.6)}L18 ${f(y)}L18 ${f(y + 2.4)}Z' fill='${c}' opacity='.95'/>`;
  });
  b += `<path d='M-18 -6L-3 -0.6' stroke='#fffbe8' stroke-width='2.2' stroke-linecap='round'/>`;
  b += `<path d='M-18 -6L-3 -0.6' stroke='#fff' stroke-width='.8' stroke-linecap='round'/>`;
  b += `<polygon points='0 -12 -10.4 7 10.4 7' fill='url(#glass)' stroke='url(#gold)' stroke-width='1.8' stroke-linejoin='round'/>`;
  b += `<polygon points='0 -12 -3.6 7 0 7' fill='#ffffff' opacity='.55'/>`;
  b += `<path d='M-9 9.6H9' stroke='url(#gold)' stroke-width='2.2' stroke-linecap='round'/>`;
  b += star(0, -14.5, 2.6, "#fffbe8");
  return svg(b, "-19 -19 38 38");
}

// ── Prismatic laurel (Lv 95): the Champion laurel's gold, with crystal
// leaves in every colour round a royal blue crest.
function laurelRing() {
  let b = `<defs>${GOLD}</defs>`;
  b += `<circle r='53' fill='none' stroke='url(#gold)' stroke-width='4.2'/>`;
  b += `<circle r='50.8' fill='none' stroke='#fff6cf' stroke-width='.7' opacity='.8'/>`;
  b += `<circle r='55.3' fill='none' stroke='#7a5214' stroke-width='.6' opacity='.7'/>`;
  const STEM = 59.6;
  /** A pointed leaf leaning up the branch (`dir`), cut in two facets. */
  const leaf = (a, dir, h, out) => {
    const [bx, by] = pt(STEM, a);
    const [tx, ty] = pt(STEM + out, a + dir * 10.5);
    const len = Math.hypot(tx - bx, ty - by);
    const nx = -(ty - by) / len,
      ny = (tx - bx) / len;
    const mx = (bx + tx) / 2,
      my = (by + ty) / 2,
      w = 3.9;
    return (
      `<path d='M${bx} ${by}Q${f(mx + nx * w)} ${f(my + ny * w)} ${tx} ${ty}Z' fill='${hue(h, 95, 72)}' stroke='#7a5214' stroke-width='.4'/>` +
      `<path d='M${bx} ${by}Q${f(mx - nx * w)} ${f(my - ny * w)} ${tx} ${ty}Z' fill='${hue(h + 8, 88, 52)}' stroke='#7a5214' stroke-width='.4'/>` +
      `<path d='M${bx} ${by}L${tx} ${ty}' stroke='#fff6cf' stroke-width='.5' opacity='.9'/>`
    );
  };
  // Two branches from the crest at the bottom up to the star at the top:
  // the right one through 0°, the left one through 180°. Leaves in pairs,
  // red at the crest up to violet at the top, the same on both sides.
  for (const side of [-1, 1]) {
    const from = side > 0 ? 74 : 106,
      to = side > 0 ? -80 : 260,
      dir = Math.sign(to - from);
    let stem = "";
    for (let i = 0; i <= 16; i++) {
      const a = from + ((to - from) * i) / 16;
      stem += (i ? "L" : "M") + P(pt(STEM, a));
    }
    const steps = 11;
    let leaves = "";
    for (let i = 0; i < steps; i++) {
      const a = from + ((to - from) * (i + 0.2)) / steps;
      const h = (i * 290) / (steps - 1);
      leaves += leaf(a, dir, h, -4.6) + leaf(a + dir * 3, dir, h + 12, 7.2);
    }
    b +=
      `<path d='${stem}' fill='none' stroke='url(#gold)' stroke-width='1.8' stroke-linecap='round'/>` +
      leaves;
  }
  b += star(0, -62.5, 4.2, "url(#gold)", "stroke='#7a5214' stroke-width='.4'");
  b += star(0, -62.5, 2, "#ffffff");
  return svg(b);
}
function laurelCrest() {
  let b = `<defs>${GOLD}<radialGradient id='blue' cx='.38' cy='.32' r='.8'><stop offset='0' stop-color='#e0ebff'/><stop offset='.35' stop-color='#8cbaff'/><stop offset='1' stop-color='#2f4fc8'/></radialGradient></defs>`;
  b += `<path d='M-11 -11H11V0Q11 9 0 14Q-11 9 -11 0Z' fill='url(#gold)' stroke='#7a5214' stroke-width='.9'/>`;
  b += `<path d='M-8 -8.4H8V-0.4Q8 6.4 0 10.4Q-8 6.4 -8 -0.4Z' fill='#1f2f6e'/>`;
  b += `<polygon points='0 -6.6 5.6 0 0 7 -5.6 0' fill='url(#blue)' stroke='#fff6cf' stroke-width='.6'/>`;
  b += `<polygon points='0 -6.6 -5.6 0 0 0' fill='#ffffff' opacity='.5'/>`;
  ["#ff7d9c", "#ffd36b", "#8ff0b5", "#7fd8ff", "#b59bff"].forEach((c, i) => {
    b += `<circle cx='${-8 + i * 4}' cy='-13.2' r='1.3' fill='${c}' stroke='#7a5214' stroke-width='.3'/>`;
  });
  return svg(b, "-15 -16 30 32");
}

// ── Element Master frame (Lv 100): a prismatic band set with the eight
// fighters' element gems, gold sun points and a crown.
// Electric, Fire, Water, Aura, Light, Psychic, Earth, Shadow (the fighters'
// own colours in packages/shared/src/index.ts).
const ELEMENTS = [
  "#ffd65b",
  "#ff7a4f",
  "#4fd6e6",
  "#7f9cff",
  "#86f0c0",
  "#ff79d2",
  "#c79a5b",
  "#9c6bff",
];
function masterRing() {
  let b = `<defs>${GOLD}`;
  ELEMENTS.forEach((c, i) => {
    b += `<radialGradient id='e${i}' cx='.35' cy='.3' r='.85'><stop offset='0' stop-color='#ffffff'/><stop offset='.3' stop-color='${c}'/><stop offset='1' stop-color='${c}' stop-opacity='.75'/></radialGradient>`;
  });
  b += `</defs>`;
  // Gold sun points behind the band, between the gems.
  for (let k = 0; k < 16; k++) {
    const a = -90 + k * 22.5;
    if (k === 0) continue; // the crown
    const long = k % 2 === 0;
    const tip = pt(long ? 68 : 64, a),
      l = pt(56, a - (long ? 4.5 : 3)),
      r = pt(56, a + (long ? 4.5 : 3));
    b += `<polygon points='${P(l, tip, r)}' fill='url(#gold)' stroke='#7a5214' stroke-width='.4'/>`;
  }
  // The prismatic band: the spectrum all the way round.
  const n = 48,
    r0 = 50.6,
    r1 = 57.6;
  for (let k = 0; k < n; k++) {
    const a0 = (k * 360) / n - 90 - 0.2,
      a1 = ((k + 1) * 360) / n - 90 + 0.2;
    b += `<polygon points='${P(pt(r0, a0), pt(r1, a0), pt(r1, a1), pt(r0, a1))}' fill='${hue((k * 360) / n, 90, 70)}'/>`;
  }
  b += `<circle r='54.1' fill='none' stroke='#ffffff' stroke-width='1.2' opacity='.35'/>`;
  b += `<circle r='50.6' fill='none' stroke='url(#gold)' stroke-width='1.5'/>`;
  b += `<circle r='57.9' fill='none' stroke='url(#gold)' stroke-width='2'/>`;
  // Eight element gems in gold bezels; the crown sits between the first
  // and the last.
  ELEMENTS.forEach((_, i) => {
    const a = -90 + 22.5 + i * 45;
    const [x, y] = pt(57.4, a);
    b += `<circle cx='${x}' cy='${y}' r='6.4' fill='url(#gold)' stroke='#7a5214' stroke-width='.6'/>`;
    b += `<circle cx='${x}' cy='${y}' r='4.6' fill='url(#e${i})' stroke='#5a3c0e' stroke-width='.4'/>`;
    b += `<circle cx='${f(x - 1.5)}' cy='${f(y - 1.6)}' r='1.15' fill='#fff' opacity='.9'/>`;
  });
  return svg(b);
}
function masterCrown() {
  let b = `<defs>${GOLD}<linearGradient id='p' x1='0' y1='0' x2='1' y2='0'><stop offset='0' stop-color='#ff7d9c'/><stop offset='.25' stop-color='#ffd36b'/><stop offset='.5' stop-color='#8ff0b5'/><stop offset='.75' stop-color='#7fd8ff'/><stop offset='1' stop-color='#b59bff'/></linearGradient><radialGradient id='c' cx='.38' cy='.32' r='.8'><stop offset='0' stop-color='#ffffff'/><stop offset='.45' stop-color='#d6fbff'/><stop offset='1' stop-color='#8fd8ff'/></radialGradient></defs>`;
  // Five points, the middle one tallest.
  b += `<path d='M-17 8L-19 -6L-10 1L-9 -11L-3 -1L0 -16L3 -1L9 -11L10 1L19 -6L17 8Z' fill='url(#gold)' stroke='#7a5214' stroke-width='.9' stroke-linejoin='round'/>`;
  b += `<path d='M-16 4.4H16' stroke='url(#p)' stroke-width='3'/>`;
  b += `<path d='M-17 8H17' stroke='url(#gold)' stroke-width='2.2' stroke-linecap='round'/>`;
  b += `<circle cx='0' cy='-4' r='3.6' fill='url(#c)' stroke='#7a5214' stroke-width='.6'/>`;
  b += `<circle cx='-1.1' cy='-5.2' r='1' fill='#fff'/>`;
  [
    [-19, -6, "#ff7d9c"],
    [-9, -11, "#ffd36b"],
    [0, -16, "#ffffff"],
    [9, -11, "#7fd8ff"],
    [19, -6, "#b59bff"],
  ].forEach(([x, y, c]) => {
    b += `<circle cx='${x}' cy='${y}' r='2.1' fill='${c}' stroke='#7a5214' stroke-width='.5'/>`;
  });
  b += star(0, -16, 4.4, "#fffbe8", "opacity='.85'");
  return svg(b, "-21 -21 42 30");
}

const a = {
  prism: uri(prismRing()),
  prismCrest: uri(prismCrest()),
  laurel: uri(laurelRing()),
  laurelCrest: uri(laurelCrest()),
  master: uri(masterRing()),
  crown: uri(masterCrown()),
};
const ids = ["prism-frame", "prismatic-laurel", "element-master-frame"];
const any = ids.map((id) => `[data-cosmetic="${id}"]`).join(",\n  ");
const css = `/* The Journey's Lv 55–100 portrait frames: Prism frame, Prismatic laurel
   and the Element Master frame. Mythical (cosmetic-tier.ts), so the rarity
   edge, rays and sparks come on top (cosmetic-fx.css). Same layout as the
   collection frames: ::before is the ring (viewBox -70…70 around a radius-50
   portrait, hence inset -20%), ::after the frame's crest.
   Generated from scripts/journey-frame-art.mjs. */
.raid-cosmetic-preview:is(
  ${any}
) {
  position: relative;
  border-radius: 50%;
  box-shadow: none;
}
.raid-cosmetic-preview:is(
    ${any}
  )::before {
  content: "";
  position: absolute;
  inset: -20%;
  z-index: 1;
  background: center / 100% 100% no-repeat;
  pointer-events: none;
}
.raid-cosmetic-preview:is(
    ${any}
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

/* Prism frame (Lv 55): crystal facets in every colour, compass points and
   a prism crest splitting starlight. */
.raid-cosmetic-preview[data-cosmetic="prism-frame"]::before {
  background-image: ${a.prism};
}
.raid-cosmetic-preview[data-cosmetic="prism-frame"]::after {
  top: -29%;
  left: 50%;
  width: 34%;
  height: 34%;
  transform: translateX(-50%);
  background-image: ${a.prismCrest};
}

/* Prismatic laurel (Lv 95): gold laurels with crystal leaves round a royal
   blue crest. */
.raid-cosmetic-preview[data-cosmetic="prismatic-laurel"]::before {
  background-image: ${a.laurel};
}
.raid-cosmetic-preview[data-cosmetic="prismatic-laurel"]::after {
  bottom: -21%;
  left: 50%;
  width: 26%;
  height: 28%;
  transform: translateX(-50%);
  background-image: ${a.laurelCrest};
}

/* Element Master frame (Lv 100): a prismatic band, the eight element gems,
   gold sun points and a crown. */
.raid-cosmetic-preview[data-cosmetic="element-master-frame"]::before {
  background-image: ${a.master};
}
.raid-cosmetic-preview[data-cosmetic="element-master-frame"]::after {
  top: -31%;
  left: 50%;
  width: 40%;
  height: 29%;
  transform: translateX(-50%);
  background-image: ${a.crown};
}

/* The Prism and Element Master crests stand taller than other frames'.
   Fitting rooms lift a portrait 10% to leave room for boss-frame stars,
   which Journey frames never have: centre the whole artwork instead, so a
   short phone stage doesn't clip the crest. */
:is(.wardrobe-frame-avatar, .portrait-review-avatar):has(
    > :is([data-portrait-frame="prism-frame"], [data-portrait-frame="element-master-frame"])
  ),
.journey-preview .raid-cosmetic-preview:is([data-cosmetic="prism-frame"], [data-cosmetic="element-master-frame"]) {
  transform: translateY(5%);
}
/* The Journey dialog's preview box is 80–180px tall: size the portrait
   from it so the ring and crest (about 1.5 portraits tall) always fit. */
.journey-preview .shop-live-stage.is-frame {
  container-type: size;
}
.journey-preview .shop-live-stage.is-frame .raid-cosmetic-preview:is(
    ${any}
  ) {
  width: min(100px, 64cqh);
  height: min(100px, 64cqh);
}
`;
writeFileSync(
  new URL("../apps/client/src/journey-frames.css", import.meta.url),
  css,
);

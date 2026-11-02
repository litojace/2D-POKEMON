import { writeFileSync } from "node:fs";
// Generates apps/client/src/boss-frames.css: the seven raid boss portrait
// frames, each drawn as its own SVG so no two share a silhouette or palette.
// Run: node scripts/boss-frame-art.mjs && npx prettier --write apps/client/src/boss-frames.css
// Frame art: viewBox -70 -70 140 140, the portrait disc is r = 50.
// Angles: 0° = right, 90° = bottom, 270° = top (SVG y points down).
const R = (d) => (d * Math.PI) / 180;
const f = (n) => +n.toFixed(2);
const pt = (r, a) => [f(Math.cos(R(a)) * r), f(Math.sin(R(a)) * r)];
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
/** A filled band between two radii (even-odd ring). */
const band = (outer, inner) => `${circle(outer)} ${circle(inner)}`;
const arc = (r, from, to, step = 2) =>
  pathOf(
    polar(() => r, from, to, step),
    false,
  );
const svg = (body, vb = "-70 -70 140 140") =>
  `<svg xmlns='http://www.w3.org/2000/svg' viewBox='${vb}'>${body}</svg>`;
const uri = (s) =>
  `url("data:image/svg+xml,${s.replace(/#/g, "%23").replace(/"/g, "'").replace(/\s+/g, " ")}")`;
/** Angular distance from `centre`, 0…180. */
const off = (a, centre) => Math.abs(((((a - centre) % 360) + 540) % 360) - 180);

// ── Conductor (Storm Twins): a copper coil ring split into a yellow and a
// blue charge, lightning crackling along each half, four lightning rods.
function conductor() {
  seed = 3;
  let b = `<defs><linearGradient id='cu' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#f2b987'/><stop offset='.5' stop-color='#a8643a'/><stop offset='1' stop-color='#5c2f17'/></linearGradient></defs>`;
  // Lightning rods on the diagonals, behind the ring.
  for (const a of [45, 135, 225, 315]) {
    const [x1, y1] = pt(56, a - 4.5);
    const [x2, y2] = pt(56, a + 4.5);
    const [tx, ty] = pt(69, a);
    const [bx, by] = pt(63, a);
    b += `<path d='M${x1} ${y1} L${tx} ${ty} L${x2} ${y2}Z' fill='url(#cu)' stroke='#3d1d0c' stroke-width='.9' stroke-linejoin='round'/>`;
    b += `<circle cx='${bx}' cy='${by}' r='1.6' fill='${a === 45 || a === 315 ? "#8fe3ff" : "#ffe45c"}'/>`;
  }
  b += `<path d='${band(60.5, 49.5)}' fill-rule='evenodd' fill='url(#cu)' stroke='#3d1d0c' stroke-width='1'/>`;
  // Coil windings.
  for (let a = 0; a < 360; a += 6) {
    const [x1, y1] = pt(50.2, a);
    const [x2, y2] = pt(59.8, a + 2);
    b += `<path d='M${x1} ${y1}L${x2} ${y2}' stroke='#5c2f17' stroke-width='.7' opacity='.55'/>`;
  }
  // The charge channel: yellow on the left half, blue on the right.
  b += `<path d='${arc(55, 90, 270)}' fill='none' stroke='#2a1608' stroke-width='5'/>`;
  b += `<path d='${arc(55, -90, 90)}' fill='none' stroke='#2a1608' stroke-width='5'/>`;
  const bolt = (from, to, c, glow) => {
    const p = [];
    let i = 0;
    for (let a = from; a <= to; a += 5) p.push(pt(i++ % 2 ? 53.4 : 56.6, a));
    return (
      `<path d='${pathOf(p, false)}' fill='none' stroke='${glow}' stroke-width='3.4' stroke-linejoin='round' opacity='.55'/>` +
      `<path d='${pathOf(p, false)}' fill='none' stroke='${c}' stroke-width='1.3' stroke-linejoin='round'/>`
    );
  };
  b += bolt(95, 265, "#fff7b0", "#ffcf1f");
  b += bolt(-85, 85, "#e8fbff", "#2fb8ff");
  // Sparks jumping off the ring.
  for (let i = 0; i < 10; i++) {
    const a = i * 36 + 12 + rnd() * 10;
    const left = Math.cos(R(a)) < 0;
    const [x1, y1] = pt(60.5, a);
    const [x2, y2] = pt(64, a + 4);
    const [x3, y3] = pt(63, a - 2);
    const [x4, y4] = pt(66.5, a + 2);
    b += `<path d='M${x1} ${y1}L${x2} ${y2}L${x3} ${y3}L${x4} ${y4}' fill='none' stroke='${left ? "#ffe45c" : "#8fe3ff"}' stroke-width='.9' stroke-linecap='round' stroke-linejoin='round'/>`;
  }
  b += `<circle r='50.2' fill='none' stroke='#ffe2bd' stroke-width='1'/>`;
  b += `<circle r='60.2' fill='none' stroke='#f6c99a' stroke-width='.7' opacity='.7'/>`;
  // Polarity studs: + on the yellow side, − on the blue side.
  const stud = (a, fill, ring, sign) => {
    const [x, y] = pt(55, a);
    return (
      `<circle cx='${x}' cy='${y}' r='5.6' fill='${fill}' stroke='${ring}' stroke-width='1.4'/>` +
      `<path d='M${f(x - 2.8)} ${y}H${f(x + 2.8)}${sign ? `M${x} ${f(y - 2.8)}V${f(y + 2.8)}` : ""}' stroke='#20140a' stroke-width='1.5' stroke-linecap='round'/>`
    );
  };
  b += stud(180, "#ffe45c", "#8a5a12", true);
  b += stud(0, "#8fe3ff", "#1d5f8a", false);
  return svg(b);
}
// Ornament: a two-tone lightning bolt over the top of the frame.
function twinBolt() {
  const p = "M3 0 L-7 16 L0 16 L-5 32 L10 11 L3 11 L9 0Z";
  return svg(
    `<defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='0'><stop offset='.5' stop-color='#ffe45c'/><stop offset='.5' stop-color='#8fe3ff'/></linearGradient></defs>` +
      `<path d='${p}' fill='url(#g)' stroke='#20140a' stroke-width='1.4' stroke-linejoin='round'/>` +
      `<path d='M4 2 L-3 14' stroke='#fff' stroke-width='1.1' stroke-linecap='round' opacity='.8'/>`,
    "-9 -1 20 34",
  );
}

// ── Brazier (Emberwing): a riveted dark-bronze ring wreathed in flame that
// burns tallest at the crown, embers drifting upward.
function brazier() {
  seed = 19;
  let b = "";
  // Flame tongues: three layers, tall at the top (270°), low at the bottom.
  const tongues = (base, height, k) => (a) => {
    const top = Math.pow(1 - off(a, 270) / 180, 1.6);
    const t = Math.pow(0.5 + 0.5 * Math.cos(R((a + k) * 14)), 3);
    const s = 0.5 + 0.5 * Math.cos(R((a + k * 2) * 9));
    return base + height * top * (0.55 * t + 0.25 * s) + 1.5 * t;
  };
  b += `<path d='${pathOf(polar(tongues(58, 13, 0), 0, 359, 1.5))} ${circle(50)}' fill-rule='evenodd' fill='#d8321c'/>`;
  b += `<path d='${pathOf(polar(tongues(57, 9, 6), 0, 359, 1.5))} ${circle(50)}' fill-rule='evenodd' fill='#ff7a1f'/>`;
  b += `<path d='${pathOf(polar(tongues(56.5, 5.5, 11), 0, 359, 1.5))} ${circle(50)}' fill-rule='evenodd' fill='#ffc93c'/>`;
  b += `<defs><radialGradient id='bz'><stop offset='.84' stop-color='#2a1609'/><stop offset='.93' stop-color='#8a5426'/><stop offset='1' stop-color='#3b2010'/></radialGradient></defs>`;
  b += `<path d='${band(59.5, 49.5)}' fill-rule='evenodd' fill='url(#bz)' stroke='#1a0d05' stroke-width='1.2'/>`;
  // Molten inner lip.
  b += `<circle r='50.6' fill='none' stroke='#ff9a3c' stroke-width='1.8'/>`;
  b += `<circle r='51.8' fill='none' stroke='#ffd27a' stroke-width='.6' opacity='.8'/>`;
  // Engraved feather pattern and rivets.
  for (let a = 0; a < 360; a += 15) {
    const [x1, y1] = pt(53.5, a);
    const [x2, y2] = pt(57.5, a + 6);
    const [x3, y3] = pt(53.5, a + 12);
    b += `<path d='M${x1} ${y1}Q${x2} ${y2} ${x3} ${y3}' fill='none' stroke='#c98a4a' stroke-width='.7' opacity='.6'/>`;
  }
  for (let a = 0; a < 360; a += 30) {
    const [x, y] = pt(55.5, a);
    b += `<circle cx='${x}' cy='${y}' r='1.7' fill='#e2a868' stroke='#3b2010' stroke-width='.6'/>`;
  }
  // Embers.
  for (let i = 0; i < 16; i++) {
    const a = 200 + rnd() * 140;
    const [x, y] = pt(66 + rnd() * 3.5, a);
    b += `<circle cx='${x}' cy='${y}' r='${f(0.6 + rnd() * 0.8)}' fill='${i % 3 ? "#ffc93c" : "#fff1b8"}'/>`;
  }
  return svg(b);
}
// Ornament: a bronze fire bowl with glowing coals and a flame.
function fireBowl() {
  return svg(
    `<path d='M-11 -4 C-14 -16 -5 -18 -3 -26 C0 -20 4 -22 3 -30 C10 -22 13 -14 11 -4Z' fill='#ff7a1f'/>` +
      `<path d='M-6 -4 C-8 -11 -2 -12 -1 -18 C2 -13 5 -15 5 -20 C9 -14 8 -9 6 -4Z' fill='#ffc93c'/>` +
      `<path d='M-2 -4 C-3 -8 0 -9 1 -12 C3 -9 4 -7 3 -4Z' fill='#fff4c4'/>` +
      `<path d='M-16 -5 H16 L12 6 H-12Z' fill='#8a5426' stroke='#2a1609' stroke-width='1.2' stroke-linejoin='round'/>` +
      `<path d='M-16 -5 H16' stroke='#ffb35a' stroke-width='1.6'/>` +
      `<circle cx='-8' cy='-5' r='2' fill='#ff5a1f'/><circle cx='-2' cy='-5.5' r='2.2' fill='#ffc93c'/><circle cx='5' cy='-5' r='2' fill='#ff7a1f'/><circle cx='10' cy='-5.4' r='1.6' fill='#ff5a1f'/>` +
      `<path d='M-9 6 L-12 13 M9 6 L12 13 M0 6 V13' stroke='#3b2010' stroke-width='2.2' stroke-linecap='round'/>`,
    "-17 -31 34 45",
  );
}

// ── Conqueror (Grumblecrag): heavy carved stone blocks with molten rock
// glowing through the seams, a keystone rune on top.
function conqueror() {
  seed = 31;
  let b = `<path d='${band(61, 49)}' fill-rule='evenodd' fill='#ff7a1a'/>`;
  b += `<path d='${band(58, 52)}' fill-rule='evenodd' fill='#ffd36b' opacity='.8'/>`;
  const greys = ["#8a7b69", "#7a6b5a", "#958571", "#6f6151"];
  const n = 12;
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n - 90 + 1.6;
    const a1 = ((i + 1) * 360) / n - 90 - 1.6;
    const big = i % 3 === 0;
    const ro = big ? 64.5 : 61 + rnd() * 1.4;
    const ri = 49 + rnd() * 0.6;
    const outer = polar(() => ro, a0, a1, 3);
    const inner = polar(() => ri, a0, a1, 3).reverse();
    // Chipped corners.
    outer[0] = pt(ro - 1.6, a0);
    outer[outer.length - 1] = pt(ro - 1.2, a1);
    b += `<path d='${pathOf([...outer, ...inner])}' fill='${big ? "#9a8a75" : greys[i % 4]}' stroke='#3a2f25' stroke-width='1' stroke-linejoin='round'/>`;
    b += `<path d='${pathOf(
      polar(() => ro - 1.3, a0 + 2, a1 - 2, 3),
      false,
    )}' fill='none' stroke='#c9b89e' stroke-width='1' opacity='.7'/>`;
    b += `<path d='${pathOf(
      polar(() => ri + 1, a0 + 2, a1 - 2, 3),
      false,
    )}' fill='none' stroke='#3a2f25' stroke-width='1' opacity='.55'/>`;
    // A lava crack in some blocks.
    if (i % 4 === 2) {
      const m = (a0 + a1) / 2;
      const c = [
        pt(ri + 1, m - 4),
        pt(54, m + 1),
        pt(56.5, m - 2),
        pt(ro - 1.5, m + 3),
      ];
      b += `<path d='${pathOf(c, false)}' fill='none' stroke='#ff7a1a' stroke-width='1.3' stroke-linejoin='round'/>`;
      b += `<path d='${pathOf(c, false)}' fill='none' stroke='#ffe08a' stroke-width='.5'/>`;
    }
  }
  // Keystone rune.
  b += `<path d='M-4 -59 L0 -54 L4 -59 M0 -54 V-50.5' fill='none' stroke='#ffb23a' stroke-width='1.6' stroke-linecap='round' stroke-linejoin='round'/>`;
  return svg(b);
}
// Ornament: a molten core gem set in a stone mount.
function coreGem() {
  return svg(
    `<path d='M-13 4 L-9 -6 H9 L13 4 L9 12 H-9Z' fill='#7a6b5a' stroke='#3a2f25' stroke-width='1.2' stroke-linejoin='round'/>` +
      `<path d='M0 -12 L9 0 L0 13 L-9 0Z' fill='#ff8a1f' stroke='#5a2a08' stroke-width='1.1' stroke-linejoin='round'/>` +
      `<path d='M0 -12 L4 0 L0 13 L-4 0Z' fill='#ffc04a'/>` +
      `<path d='M-9 0 H9' stroke='#a8460c' stroke-width='.7'/>` +
      `<path d='M-2 -7 L-5 -1' stroke='#fff6d0' stroke-width='1.4' stroke-linecap='round'/>`,
    "-14 -13 28 27",
  );
}

// ── Reef (Tidewyrm): a deep-sea water ring with a curling foam crest,
// coral branches growing from the lower sides, bubbles rising.
function reef() {
  seed = 43;
  let b = `<defs><linearGradient id='sea' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#4fd8e6'/><stop offset='1' stop-color='#0b4f6b'/></linearGradient></defs>`;
  const coral = (a, size, c, dark) => {
    const [x, y] = pt(57, a);
    const rot = a + 90;
    const s = size;
    const br = (x1, y1, x2, y2, w) =>
      `<path d='M${f(x1 * s)} ${f(y1 * s)} L${f(x2 * s)} ${f(y2 * s)}' stroke='${c}' stroke-width='${f(w * s)}' stroke-linecap='round'/>`;
    return (
      `<g transform='translate(${x} ${y}) rotate(${f(rot)})'>` +
      [
        [0, 0, 0, -12, 3.2],
        [0, -5, -5, -10, 2.4],
        [-5, -10, -6, -15, 1.8],
        [-5, -10, -9, -12, 1.6],
        [0, -8, 5, -13, 2.2],
        [5, -13, 4, -17, 1.6],
        [5, -13, 9, -15, 1.4],
        [0, -12, 1, -16, 1.8],
      ]
        .map(([x1, y1, x2, y2, w]) =>
          br(x1, y1, x2, y2, w + 1.2).replace(c, dark),
        )
        .join("") +
      [
        [0, 0, 0, -12, 3.2],
        [0, -5, -5, -10, 2.4],
        [-5, -10, -6, -15, 1.8],
        [-5, -10, -9, -12, 1.6],
        [0, -8, 5, -13, 2.2],
        [5, -13, 4, -17, 1.6],
        [5, -13, 9, -15, 1.4],
        [0, -12, 1, -16, 1.8],
      ]
        .map(([x1, y1, x2, y2, w]) => br(x1, y1, x2, y2, w))
        .join("") +
      `</g>`
    );
  };
  // Coral behind the ring.
  b += coral(140, 1.15, "#ff7f9e", "#a8284f");
  b += coral(160, 0.85, "#ffb36b", "#a8541f");
  b += coral(40, 1.15, "#ff7f9e", "#a8284f");
  b += coral(20, 0.85, "#c58bff", "#5e2fa8");
  // Kelp fronds on the sides.
  for (const [a, dir] of [
    [185, -1],
    [355, 1],
  ]) {
    const [x, y] = pt(58, a);
    b += `<path d='M${x} ${y} q${4 * dir} -6 0 -12 q${-4 * dir} -6 0 -12' fill='none' stroke='#2f9a5a' stroke-width='2.4' stroke-linecap='round' transform='rotate(${dir * 8} ${x} ${y})'/>`;
  }
  b += `<path d='${band(60, 49.5)}' fill-rule='evenodd' fill='url(#sea)' stroke='#06364a' stroke-width='1.1'/>`;
  // Rolling waves inside the band.
  const wave = [];
  for (let a = 0; a <= 360; a += 3)
    wave.push(pt(55 + 2 * Math.sin(R(a * 8)), a));
  b += `<path d='${pathOf(wave, false)}' fill='none' stroke='#bff6ff' stroke-width='1' opacity='.7'/>`;
  // Foam crest curling over the top half.
  for (let a = 196; a <= 344; a += 16) {
    const [x, y] = pt(60, a);
    const [cx, cy] = pt(66, a + 6);
    const [ex, ey] = pt(61.5, a + 12);
    b += `<path d='M${x} ${y} Q${cx} ${cy} ${ex} ${ey}' fill='none' stroke='#e6fbff' stroke-width='2.2' stroke-linecap='round'/>`;
    const [dx, dy] = pt(63.2, a + 9);
    b += `<circle cx='${dx}' cy='${dy}' r='.9' fill='#ffffff'/>`;
  }
  b += `<circle r='50.2' fill='none' stroke='#9ff0ff' stroke-width='1'/>`;
  // Bubbles rising on the right.
  for (let i = 0; i < 7; i++) {
    const a = 290 + rnd() * 50;
    const [x, y] = pt(63 + rnd() * 5, a);
    b += `<circle cx='${x}' cy='${y}' r='${f(0.9 + rnd() * 1.3)}' fill='none' stroke='#dffaff' stroke-width='.6'/>`;
  }
  return svg(b);
}
// Ornament: an open clam shell holding a pearl.
function clamPearl() {
  let ribs = "";
  for (let k = -3; k <= 3; k++)
    ribs += `<path d='M0 10 L${k * 4.2} ${f(-1 + Math.abs(k) * 0.8)}' stroke='#c95f7f' stroke-width='.7'/>`;
  return svg(
    `<path d='M-15 0 Q-14 -13 0 -14 Q14 -13 15 0 Z' fill='#ffc9d6' stroke='#a8284f' stroke-width='1.1'/>` +
      `<path d='M-15 0 Q-12 11 0 11 Q12 11 15 0 Q0 4 -15 0Z' fill='#ffb0c4' stroke='#a8284f' stroke-width='1.1'/>` +
      ribs +
      `<circle cy='-1' r='6' fill='#fbf7ff' stroke='#b7a8d6' stroke-width='.8'/>` +
      `<circle cx='-2' cy='-3' r='2' fill='#ffffff'/>`,
    "-16 -15 32 27",
  );
}

// ── Crescent (Gloomshade): a starry night-blue band ringed in gold, with
// ghostly shadow wisps curling off it.
function crescentFrame() {
  seed = 59;
  let b = "";
  b += `<defs><radialGradient id='wisp' cx='0' cy='0' r='70' gradientUnits='userSpaceOnUse'><stop offset='.8' stop-color='#3a2a7a'/><stop offset='1' stop-color='#120c2a'/></radialGradient></defs>`;
  // Shadow wisps: curved, tapered flames that lean one way round.
  for (let i = 0; i < 12; i++) {
    const a = i * 30 + rnd() * 6;
    const len = 9 + rnd() * 5;
    const [x1, y1] = pt(58, a - 8);
    const [x2, y2] = pt(58, a + 8);
    const [c1x, c1y] = pt(62 + len * 0.4, a - 4);
    const [tx, ty] = pt(58 + len, a + 12);
    const [c2x, c2y] = pt(61, a + 9);
    b += `<path d='M${x1} ${y1} Q${c1x} ${c1y} ${tx} ${ty} Q${c2x} ${c2y} ${x2} ${y2}Z' fill='url(#wisp)' stroke='#9b7cff' stroke-width='1.1' stroke-linejoin='round'/>`;
  }
  b += `<defs><radialGradient id='nb'><stop offset='.8' stop-color='#100c26'/><stop offset='1' stop-color='#2c2366'/></radialGradient></defs>`;
  b += `<path d='${band(60, 49.5)}' fill-rule='evenodd' fill='url(#nb)'/>`;
  // Stars in the band.
  for (let i = 0; i < 26; i++) {
    const a = rnd() * 360;
    const [x, y] = pt(51.8 + rnd() * 6.2, a);
    b += `<circle cx='${x}' cy='${y}' r='${f(0.35 + rnd() * 0.6)}' fill='${i % 5 ? "#e8e4ff" : "#ffd65b"}'/>`;
  }
  for (const a of [30, 150, 210, 330]) {
    const [x, y] = pt(55, a);
    b += `<path d='M${x} ${f(y - 2.6)} L${f(x + 0.7)} ${f(y - 0.7)} L${f(x + 2.6)} ${y} L${f(x + 0.7)} ${f(y + 0.7)} L${x} ${f(y + 2.6)} L${f(x - 0.7)} ${f(y + 0.7)} L${f(x - 2.6)} ${y} L${f(x - 0.7)} ${f(y - 0.7)}Z' fill='#ffd65b'/>`;
  }
  b += `<circle r='50' fill='none' stroke='#d9b24a' stroke-width='1.3'/>`;
  b += `<circle r='60' fill='none' stroke='#d9b24a' stroke-width='1.6'/>`;
  b += `<circle r='61.4' fill='none' stroke='#5a4210' stroke-width='.6'/>`;
  return svg(b);
}
// Ornament: a golden crescent moon cradling a small lantern flame.
function goldMoon() {
  return svg(
    `<path d='M4 -15 A15 15 0 1 0 4 15 A11.5 11.5 0 1 1 4 -15Z' fill='#ffd65b' stroke='#8a5a12' stroke-width='1.2' stroke-linejoin='round'/>` +
      `<path d='M-3 -10 A11 11 0 0 0 -6 6' fill='none' stroke='#fff3c4' stroke-width='1.3' stroke-linecap='round'/>` +
      `<path d='M10 -3 L11 -0.7 L13.4 0 L11 0.7 L10 3 L9 0.7 L6.6 0 L9 -0.7Z' fill='#fff3c4'/>`,
    "-13 -16 28 32",
  );
}

// ── Moonglass (Somnara): faceted lavender glass resting on a bank of dream
// clouds, with silver sparkles drifting above.
function moonglass() {
  seed = 71;
  let b = `<defs><linearGradient id='gl' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#efe6ff'/><stop offset='.5' stop-color='#b49cf2'/><stop offset='1' stop-color='#7d68cf'/></linearGradient></defs>`;
  // Sparkles above.
  const sparkle = (x, y, s, c) =>
    `<path d='M${x} ${f(y - s)} Q${x} ${y} ${f(x + s)} ${y} Q${x} ${y} ${x} ${f(y + s)} Q${x} ${y} ${f(x - s)} ${y} Q${x} ${y} ${x} ${f(y - s)}Z' fill='${c}'/>`;
  for (let i = 0; i < 6; i++) {
    const a = 205 + i * 22 + rnd() * 8;
    const [x, y] = pt(64 + rnd() * 3, a);
    b += sparkle(x, y, 1.6 + rnd() * 1.6, i % 2 ? "#f3f0ff" : "#c9e4ff");
  }
  // Faceted glass: an 18-sided ring of alternating facets.
  const n = 18;
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n;
    const a1 = ((i + 1) * 360) / n;
    const am = (a0 + a1) / 2;
    const [o0x, o0y] = pt(60, a0);
    const [o1x, o1y] = pt(60, a1);
    const [i0x, i0y] = pt(49.5, a0);
    const [i1x, i1y] = pt(49.5, a1);
    const [mx, my] = pt(55, am);
    b += `<path d='M${o0x} ${o0y}L${o1x} ${o1y}L${mx} ${my}Z' fill='${i % 2 ? "#d8c9ff" : "#b8a2f0"}' opacity='.92'/>`;
    b += `<path d='M${i0x} ${i0y}L${i1x} ${i1y}L${mx} ${my}Z' fill='${i % 2 ? "#9d86e6" : "#c4b2fa"}' opacity='.92'/>`;
    b += `<path d='M${o0x} ${o0y}L${mx} ${my}L${i0x} ${i0y}' fill='none' stroke='#f6f1ff' stroke-width='.5' opacity='.8'/>`;
  }
  const poly = (r) => {
    const p = [];
    for (let i = 0; i < n; i++) p.push(pt(r, (i * 360) / n));
    return pathOf(p);
  };
  b += `<path d='${poly(60)}' fill='none' stroke='#5b47a8' stroke-width='1.2' stroke-linejoin='round'/>`;
  b += `<path d='${poly(49.5)}' fill='none' stroke='#f3f0ff' stroke-width='1.1' stroke-linejoin='round'/>`;
  b += `<path d='${arc(57.5, 200, 250, 3)}' fill='none' stroke='#ffffff' stroke-width='1.3' stroke-linecap='round' opacity='.85'/>`;
  // Dream clouds over the lower half.
  const puffs = [];
  for (let a = 28; a <= 152; a += 9)
    puffs.push([
      a + rnd() * 4,
      (3.2 + 4.2 * Math.pow(Math.sin(R(a)), 2)) * (0.75 + rnd() * 0.5),
    ]);
  let back = "";
  let front = "";
  for (const [a, r] of puffs) {
    const [x, y] = pt(59 + r * 0.55, a);
    back += `<circle cx='${x}' cy='${y}' r='${f(r + 1.1)}' fill='#8a76d6'/>`;
    front += `<circle cx='${x}' cy='${y}' r='${f(r)}' fill='#f1ecff'/>`;
  }
  for (const [a, r] of puffs) {
    const [x, y] = pt(59 + r * 0.55, a);
    front += `<circle cx='${f(x - r * 0.2)}' cy='${f(y - r * 0.3)}' r='${f(r * 0.5)}' fill='#ffffff' opacity='.9'/>`;
  }
  b += back + front;
  return svg(b);
}
// Ornament: a sleepy silver crescent with drifting Zs.
function sleepyMoon() {
  return svg(
    `<path d='M2 -12 A12 12 0 1 0 2 12 A9 9 0 1 1 2 -12Z' fill='#eef0ff' stroke='#7d68cf' stroke-width='1.1'/>` +
      `<path d='M-7 2 Q-5 4 -3 2' fill='none' stroke='#7d68cf' stroke-width='.9' stroke-linecap='round'/>` +
      `<path d='M8 -11 H13 L8 -6 H13' fill='none' stroke='#f3f0ff' stroke-width='1.4' stroke-linecap='round' stroke-linejoin='round'/>` +
      `<path d='M14 -18 H17.5 L14 -14.5 H17.5' fill='none' stroke='#c9e4ff' stroke-width='1.1' stroke-linecap='round' stroke-linejoin='round'/>`,
    "-11 -19 30 32",
  );
}

// ── Stained glass (Prismatail): a leaded rose window — two rows of rainbow
// panes with pointed cusps round the outside.
function stainedGlass() {
  const hues = [
    "#ff5a7a",
    "#ff9a3c",
    "#ffd65b",
    "#7fe08a",
    "#4fd0e6",
    "#5a8cff",
    "#a46bff",
    "#ff6fd0",
  ];
  const n = 16;
  let b = "";
  const lead = "#2a2230";
  // Cusps.
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n;
    const a1 = ((i + 1) * 360) / n;
    const [x0, y0] = pt(59.5, a0 + 1);
    const [x1, y1] = pt(59.5, a1 - 1);
    const [tx, ty] = pt(66, (a0 + a1) / 2);
    b += `<path d='M${x0} ${y0} Q${pt(64, a0 + 4).join(" ")} ${tx} ${ty} Q${pt(64, a1 - 4).join(" ")} ${x1} ${y1}Z' fill='${hues[(i + 4) % hues.length]}' stroke='${lead}' stroke-width='1.2' stroke-linejoin='round'/>`;
  }
  const pane = (ri, ro, a0, a1, c) => {
    const outer = polar(() => ro, a0, a1, 2);
    const inner = polar(() => ri, a0, a1, 2).reverse();
    return `<path d='${pathOf([...outer, ...inner])}' fill='${c}' stroke='${lead}' stroke-width='1.3' stroke-linejoin='round'/>`;
  };
  for (let i = 0; i < n; i++) {
    const a0 = (i * 360) / n;
    b += pane(49.5, 54.6, a0, a0 + 360 / n, hues[i % hues.length]);
    b += pane(
      54.6,
      60,
      a0 + 180 / n,
      a0 + 540 / n,
      hues[(i + 2) % hues.length],
    );
  }
  // Glass shine.
  b += `<path d='${arc(57.3, 205, 255, 3)}' fill='none' stroke='#ffffff' stroke-width='1.4' stroke-linecap='round' opacity='.75'/>`;
  b += `<path d='${arc(52, 210, 240, 3)}' fill='none' stroke='#ffffff' stroke-width='1' stroke-linecap='round' opacity='.6'/>`;
  b += `<circle r='49.5' fill='none' stroke='${lead}' stroke-width='1.6'/>`;
  b += `<circle r='60' fill='none' stroke='${lead}' stroke-width='1.6'/>`;
  return svg(b);
}
// Ornament: a prism splitting a beam into a rainbow fan.
function prism() {
  const fan = ["#ff5a7a", "#ffd65b", "#7fe08a", "#4fd0e6", "#a46bff"];
  let rays = "";
  fan.forEach((c, i) => {
    rays += `<path d='M3 2 L${16} ${f(-6 + i * 3.4)}' stroke='${c}' stroke-width='1.8' stroke-linecap='round'/>`;
  });
  return svg(
    `<path d='M-16 4 L-4 1' stroke='#ffffff' stroke-width='1.8' stroke-linecap='round'/>` +
      rays +
      `<path d='M0 -11 L10 8 H-10Z' fill='#e9f6ff' fill-opacity='.85' stroke='#2a2230' stroke-width='1.3' stroke-linejoin='round'/>` +
      `<path d='M0 -11 L3 8' stroke='#9fd8ff' stroke-width='.8'/>` +
      `<path d='M-2 -5 L-5 3' stroke='#ffffff' stroke-width='1.2' stroke-linecap='round'/>`,
    "-17 -12 35 22",
  );
}

/** id, art, ornament, ornament placement, tier colours, portrait backdrop. */
const frames = [
  {
    id: "conductor-frame",
    note: "Conductor (Storm Twins): copper coil, yellow + and blue − charges, crackling bolts and lightning rods; a two-tone bolt strikes the crown.",
    ring: conductor(),
    orn: twinBolt(),
    place:
      "top: -26%; left: 50%; width: 17%; height: 28%; transform: translateX(-50%);",
    anim: "frame-flash 2.4s steps(1, end) infinite",
    tier: ["#ffe45c", "#fff7c4", "#2fb8ff", "#e8fbff"],
    glow: "#8fe3ffaa",
    ray: "#ffe45c66",
    ray2: "#8fe3ff66",
    disc: "radial-gradient(circle at 30% 40%, #3b3a1c, transparent 60%), radial-gradient(circle at 70% 60%, #123b52, transparent 60%), #141b2c",
  },
  {
    id: "brazier-frame",
    note: "Brazier (Emberwing): riveted dark bronze wreathed in flame that burns tallest at the crown; a fire bowl burns below.",
    ring: brazier(),
    orn: fireBowl(),
    place:
      "bottom: -24%; left: 50%; width: 26%; height: 34%; transform: translateX(-50%); transform-origin: 50% 100%;",
    anim: "frame-flicker 1.3s ease-in-out infinite alternate",
    tier: ["#ff5a1f", "#ffd27a", "#c2260f", "#ffb33c"],
    glow: "#ff7a1faa",
    ray: "#ff8a3c66",
    ray2: "#ffd27a55",
    disc: "radial-gradient(circle at 50% 90%, #5a2410, #1a1012 70%)",
  },
  {
    id: "conqueror",
    note: "Conqueror (Grumblecrag): heavy carved stone blocks, molten rock glowing through the seams, a keystone rune and a molten core gem.",
    ring: conqueror(),
    orn: coreGem(),
    place:
      "bottom: -17%; left: 50%; width: 24%; height: 24%; transform: translateX(-50%);",
    anim: "frame-pulse 2.6s ease-in-out infinite alternate",
    tier: ["#ff8a1f", "#ffe08a", "#8a7b69", "#ffb23a"],
    glow: "#ff8a1faa",
    ray: "#ffb23a66",
    ray2: "#ff7a1a55",
    disc: "radial-gradient(circle at 50% 40%, #3a3128, #15110e 85%)",
  },
  {
    id: "reef",
    note: "Reef (Tidewyrm): a deep-sea water ring with a curling foam crest, coral and kelp, rising bubbles and a clam holding a pearl.",
    ring: reef(),
    orn: clamPearl(),
    place:
      "bottom: -18%; left: 50%; width: 28%; height: 24%; transform: translateX(-50%);",
    anim: "frame-bob 3s ease-in-out infinite alternate",
    tier: ["#4fd8e6", "#e6fbff", "#ff7f9e", "#1f8fa6"],
    glow: "#4fd8e6aa",
    ray: "#7fe9ff66",
    ray2: "#ff9fb855",
    disc: "radial-gradient(circle at 50% 30%, #1d5f7a, #071b2c 85%)",
  },
  {
    id: "crescent",
    note: "Crescent (Gloomshade): a starry night band ringed in gold, ghostly shadow wisps curling off it and a golden moon on top.",
    ring: crescentFrame(),
    orn: goldMoon(),
    place:
      "top: -27%; left: 50%; width: 27%; height: 31%; transform: translateX(-50%) rotate(-20deg);",
    anim: "frame-sway 4s ease-in-out infinite alternate",
    tier: ["#7b5cd6", "#ffd65b", "#1a1236", "#c9b6ff"],
    glow: "#7b5cd6cc",
    ray: "#ffd65b55",
    ray2: "#7b5cd666",
    disc: "radial-gradient(circle at 50% 35%, #2a2358, #07061a 85%)",
  },
  {
    id: "moonglass",
    note: "Moonglass (Somnara): faceted lavender glass on a bank of dream clouds, silver sparkles and a sleepy moon drifting off.",
    ring: moonglass(),
    orn: sleepyMoon(),
    place: "top: -18%; right: -18%; width: 34%; height: 36%;",
    anim: "frame-float 3.4s ease-in-out infinite alternate",
    tier: ["#c9b6ff", "#ffffff", "#8a76d6", "#c9e4ff"],
    glow: "#c9b6ffaa",
    ray: "#e6ddff66",
    ray2: "#c9e4ff55",
    disc: "radial-gradient(circle at 50% 30%, #4b3f86, #15123a 85%)",
  },
  {
    id: "stained-glass",
    note: "Stained glass (Prismatail): a leaded rose window of rainbow panes with pointed cusps, and a prism splitting light at the crown.",
    ring: stainedGlass(),
    orn: prism(),
    place:
      "top: -24%; left: 50%; width: 34%; height: 22%; transform: translateX(-50%);",
    anim: "frame-pulse 2.2s ease-in-out infinite alternate",
    tier: ["#ff5a7a", "#ffd65b", "#4fd0e6", "#a46bff"],
    glow: "#ffd65b99",
    ray: "#ffd65b55",
    ray2: "#4fd0e655",
    disc: "conic-gradient(from 20deg, #3a1630, #3a2a12, #123a24, #10283e, #2a1640, #3a1630)",
  },
];

/** Mythic: four twinkling star flares on the diagonals (orbit box). */
const flare = svg(
  [
    [19, 19],
    [81, 19],
    [81, 81],
    [19, 81],
  ]
    .map(
      ([x, y]) =>
        `<circle cx='${x}' cy='${y}' r='4.5' fill='#fff' opacity='.35'/><path d='M${x} ${y - 8}Q${x + 1} ${y - 1} ${x + 8} ${y}Q${x + 1} ${y + 1} ${x} ${y + 8}Q${x - 1} ${y + 1} ${x - 8} ${y}Q${x - 1} ${y - 1} ${x} ${y - 8}Z' fill='#fff'/>`,
    )
    .join(""),
  "0 0 100 100",
);
const ids = frames.map((x) => `[data-cosmetic="${x.id}"]`).join(", ");
const all = `.raid-cosmetic-preview:is(${ids})`;
let css = `/* Raid boss portrait frames. Each boss has its own silhouette, palette and
   ornament, and its rarity edge, rays and sparks take that boss's colours
   instead of the shared purple Epic trim. ::before is the ring (viewBox
   -70…70 around a radius-50 portrait, hence inset -20%), ::after the
   ornament. Generated from scripts/boss-frame-art.mjs. */
${all} {
  position: relative;
  border-radius: 50%;
  box-shadow: none;
  background: var(--frame-disc);
}
${all}::before {
  content: "";
  position: absolute;
  inset: -20%;
  z-index: 1;
  background: center / 100% 100% no-repeat;
  pointer-events: none;
}
${all}::after {
  content: "";
  position: absolute;
  inset: auto;
  border: 0;
  border-radius: 0;
  box-shadow: none;
  outline: none;
  background: center / contain no-repeat;
  filter: drop-shadow(0 1px 1px #0009);
  pointer-events: none;
}
/* The rarity edge is a thin glowing lip on the artwork's inner rim, in the
   boss's colours, so the ring itself stays readable. */
${all}[data-tier] > .tier-fx {
  inset: -2px;
  padding: 2px;
  background: conic-gradient(
    from var(--tier-turn),
    var(--frame-a),
    var(--frame-b),
    var(--frame-c),
    var(--frame-d),
    var(--frame-a)
  );
  box-shadow:
    0 0 14px var(--frame-glow),
    inset 0 0 6px var(--frame-b);
}
/* No shared purple gems: the frame's own ornaments carry the look. */
${all}[data-tier="epic"] > .tier-orbit {
  display: none;
}
${all}[data-tier="legendary"] > .tier-fx {
  box-shadow:
    0 0 16px var(--frame-glow),
    0 0 28px #ffcf4a55,
    inset 0 0 6px var(--frame-b);
}
${all}[data-tier="mythic"] > .tier-fx {
  box-shadow:
    0 0 18px var(--frame-glow),
    0 0 32px var(--frame-a),
    inset 0 0 8px #ffffffaa;
}
${all}[data-tier="legendary"] > .tier-orbit {
  background:
    radial-gradient(circle at 50% 8%, #fffbe8 0 2.4%, transparent 4%),
    radial-gradient(circle at 92% 50%, var(--frame-a) 0 1.8%, transparent 3.2%),
    radial-gradient(circle at 20% 80%, var(--frame-c) 0 1.5%, transparent 2.8%);
}
${all}[data-tier="mythic"] > .tier-orbit {
  background:
    radial-gradient(circle at 50% 8%, #fffbe8 0 2.4%, transparent 4%),
    radial-gradient(circle at 92% 50%, var(--frame-a) 0 1.8%, transparent 3.2%),
    radial-gradient(circle at 20% 80%, var(--frame-c) 0 1.5%, transparent 2.8%),
    radial-gradient(circle at 50% 92%, var(--frame-b) 0 1.6%, transparent 3%),
    radial-gradient(circle at 8% 40%, var(--frame-d) 0 1.6%, transparent 3%);
}
/* Rays start outside the ring, never across the portrait window. */
${all} > .tier-rays {
  inset: -45%;
  -webkit-mask: radial-gradient(circle closest-side, transparent 0 64%, #000 68%, transparent 100%);
  mask: radial-gradient(circle closest-side, transparent 0 64%, #000 68%, transparent 100%);
}
${all}[data-tier="legendary"] > .tier-rays {
  background: repeating-conic-gradient(var(--frame-ray) 0 6deg, transparent 6deg 22deg);
}
${all}[data-tier="mythic"] > .tier-rays {
  background: repeating-conic-gradient(
    var(--frame-ray) 0 5deg,
    transparent 5deg 15deg,
    var(--frame-ray2) 15deg 20deg,
    transparent 20deg 30deg
  );
}
/* ── Mythic (five stars) goes beyond Legendary ──
   a white comet races round the edge, a rune ring turns the other way
   outside the frame, the boss's colours breathe behind it, four star
   flares twinkle on the diagonals and the ring art itself burns brighter. */
${all}[data-tier="mythic"]::before {
  filter: saturate(1.3) brightness(1.12) drop-shadow(0 0 3px var(--frame-glow));
}
${all}[data-tier="mythic"] > .tier-fx {
  background:
    conic-gradient(from var(--tier-turn), transparent 0 290deg, #ffffffcc 340deg, #fff 352deg, transparent 360deg),
    conic-gradient(from var(--tier-turn), var(--frame-a), var(--frame-b), var(--frame-c), var(--frame-d), var(--frame-a));
}
${all}[data-tier="mythic"] > .tier-orbit::before,
${all}[data-tier="mythic"] > .tier-orbit::after,
${all}[data-tier="mythic"] > .tier-rays::before {
  content: "";
  position: absolute;
  pointer-events: none;
}
/* The orbit turns once every 3s; these children undo or reverse that. */
${all}[data-tier="mythic"] > .tier-orbit::before {
  inset: -10%;
  border-radius: 50%;
  background:
    radial-gradient(circle closest-side, transparent 0 91%, var(--frame-b) 91.5% 92.5%, transparent 93%),
    repeating-conic-gradient(var(--frame-a) 0 2.5deg, transparent 2.5deg 9deg, var(--frame-b) 9deg 11deg, transparent 11deg 18deg);
  -webkit-mask: radial-gradient(circle closest-side, transparent 0 90%, #000 90.5% 98.5%, transparent 99%);
  mask: radial-gradient(circle closest-side, transparent 0 90%, #000 90.5% 98.5%, transparent 99%);
  opacity: 0.9;
  animation: tier-orbit 2.4s linear infinite reverse;
}
${all}[data-tier="mythic"] > .tier-orbit::after {
  inset: 0;
  background: center / 100% 100% no-repeat ${uri(flare)};
  animation:
    tier-orbit 3s linear infinite reverse,
    frame-twinkle 1.4s ease-in-out infinite alternate;
}
${all}[data-tier="mythic"] > .tier-rays::before {
  inset: 0;
  border-radius: 50%;
  background: radial-gradient(circle closest-side, transparent 58%, var(--frame-glow) 68%, transparent 84%);
  animation: frame-breathe 2.4s ease-in-out infinite alternate;
}
@keyframes frame-twinkle {
  from { opacity: 0.35; }
  to { opacity: 1; }
}
@keyframes frame-breathe {
  from { opacity: 0.35; }
  to { opacity: 1; }
}
@keyframes frame-flash {
  0%, 70%, 78%, 100% { opacity: 1; }
  74% { opacity: 0.35; }
}
@keyframes frame-flicker {
  from { scale: 1 1; }
  to { scale: 1.04 1.1; }
}
@keyframes frame-pulse {
  from { opacity: 0.85; }
  to { opacity: 1; }
}
@keyframes frame-bob {
  from { translate: 0 0; }
  to { translate: 0 -6%; }
}
@keyframes frame-sway {
  from { rotate: -6deg; }
  to { rotate: 6deg; }
}
@keyframes frame-float {
  from { translate: 0 0; }
  to { translate: 4% -6%; }
}
@media (prefers-reduced-motion: reduce) {
  ${all}::after,
  ${all} > .tier-orbit::before,
  ${all} > .tier-orbit::after,
  ${all} > .tier-rays::before {
    animation: none !important;
  }
}
`;
for (const x of frames) {
  const sel = `.raid-cosmetic-preview[data-cosmetic="${x.id}"]`;
  css += `
/* ${x.note} */
${sel} {
  --frame-a: ${x.tier[0]};
  --frame-b: ${x.tier[1]};
  --frame-c: ${x.tier[2]};
  --frame-d: ${x.tier[3]};
  --frame-glow: ${x.glow};
  --frame-ray: ${x.ray};
  --frame-ray2: ${x.ray2};
  --frame-disc: ${x.disc};
}
${sel}::before {
  background-image: ${uri(x.ring)};
}
${sel}::after {
  ${x.place}
  background-image: ${uri(x.orn)};
  animation: ${x.anim};
}
`;
}
writeFileSync(
  new URL("../apps/client/src/boss-frames.css", import.meta.url),
  css,
);

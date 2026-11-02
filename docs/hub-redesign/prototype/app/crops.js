/* ======================================================================
   CROP ART: every crop is drawn in code (SVG) in the same sticker style as
   the icon set: rounded shapes, an outline in a deeper shade of each fill,
   a soft gloss. Ideas taken from well-known farm and plant games:
   - Stardew Valley: each crop has its own look at every growth stage, so you
     can tell what is growing and how far along it is.
   - Plants vs. Zombies: plants with faces have personality, and the shape
     tells you what the plant does (fire crops carry embers, storm crops sparks).
   - Hay Day: big, bright, glossy produce that is easy to read on a busy field.
   field(c, st): the plant in a plot, stages 0 (seed) to 4 (ripe), 120×140, ground at y=132.
   item(c): the harvested produce, used for icons in menus, the barn and orders.
   ====================================================================== */
const CROPART = (() => {
  const f = v => +(+v).toFixed(1);
  const hex = c => { let h = c.slice(1); if (h.length === 3) h = [...h].map(x => x + x).join(""); const n = parseInt(h.slice(0, 6), 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
  const toHex = a => "#" + a.map(v => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, "0")).join("");
  const mix = (a, b, t) => { const A = hex(a), B = hex(b); return toHex(A.map((v, i) => v + (B[i] - v) * t)); };
  const ink = c => mix(c, "#221634", .42); // same rule as the icon set: outline = a deeper shade of the fill
  const INK = "#2a1d3a";

  // one gradient registry per SVG
  function Ctx() {
    const defs = [], memo = {}; let n = 0;
    const reg = (key, mk) => { if (memo[key]) return memo[key]; const id = "g" + (n++); defs.push(mk(id)); return (memo[key] = `url(#${id})`); };
    return {
      defs,
      rg: c => reg("r" + c, id => `<radialGradient id="${id}" cx=".36" cy=".3" r=".8"><stop offset="0" stop-color="${mix(c, "#ffffff", .62)}"/><stop offset=".42" stop-color="${c}"/><stop offset="1" stop-color="${mix(c, "#2a1640", .26)}"/></radialGradient>`),
      lg: (a, b) => reg("l" + a + b, id => `<linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`),
      dg: (a, b) => reg("d" + a + b, id => `<linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`),
      ug: (a, b, y0, y1) => reg("u" + a + b + y0 + y1, id => `<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="0" y2="${y1}"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`),
      glow: c => reg("w" + c, id => `<radialGradient id="${id}"><stop offset="0" stop-color="${c}" stop-opacity=".55"/><stop offset=".6" stop-color="${c}" stop-opacity=".18"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`),
    };
  }

  /* ---------- shared pieces ---------- */
  const LEAF = [["#b9ef7d", "#4aa43f"], ["#93d95f", "#2f8636"]];
  const P = (d, fill, ol, w = 2) => `<path d="${d}" fill="${fill}" stroke="${ol}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const leaf = (X, x, y, len, deg, w, tone = 0) => {
    const [c1, c2] = Array.isArray(tone) ? tone : LEAF[tone], a = deg * Math.PI / 180, tx = x + Math.cos(a) * len, ty = y + Math.sin(a) * len, nx = -Math.sin(a) * w, ny = Math.cos(a) * w, mx = (x + tx) / 2, my = (y + ty) / 2;
    return P(`M${f(x)} ${f(y)} Q${f(mx + nx)} ${f(my + ny)} ${f(tx)} ${f(ty)} Q${f(mx - nx)} ${f(my - ny)} ${f(x)} ${f(y)}Z`, X.lg(c1, c2), ink(c2), 1.6)
      + `<path d="M${f(x)} ${f(y)} Q${f(mx + nx * .12)} ${f(my + ny * .12)} ${f(x + (tx - x) * .8)} ${f(y + (ty - y) * .8)}" stroke="#ffffff" stroke-opacity=".38" stroke-width="1" fill="none"/>`;
  };
  // a stroke with an outline (draw the ink a bit wider underneath)
  const line = (d, col, w = 3.2) => `<path d="${d}" stroke="${ink(col)}" stroke-width="${w + 2.6}" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${col}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const stem = (d, w = 3.2) => line(d, "#5fae43", w);
  const gloss = (x, y, r) => `<ellipse cx="${f(x - r * .36)}" cy="${f(y - r * .4)}" rx="${f(r * .3)}" ry="${f(r * .17)}" transform="rotate(-35 ${f(x - r * .36)} ${f(y - r * .4)})" fill="#fff" opacity=".78"/><circle cx="${f(x + r * .32)}" cy="${f(y + r * .34)}" r="${f(r * .07)}" fill="#fff" opacity=".5"/>`;
  const ball = (X, x, y, r, c, w = 2) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}" fill="${X.rg(c)}" stroke="${ink(c)}" stroke-width="${w}"/>` + gloss(x, y, r);
  // several shapes that read as one outlined blob (bushes, tree tops, cotton)
  const union = (shapes, fill, ol, w = 2.2) => shapes.map(s => `<${s} fill="${ol}" stroke="${ol}" stroke-width="${w * 2}" stroke-linejoin="round"/>`).join("") + shapes.map(s => `<${s} fill="${fill}"/>`).join("");
  const circ = (x, y, r) => `circle cx="${f(x)}" cy="${f(y)}" r="${f(r)}"`;
  const face = (x, y, s = 1, mood = "happy") => {
    const ex = 4.6 * s;
    const eye = k => mood === "sleepy" ? `<path d="M${f(x + k * ex - 2.4 * s)} ${f(y)} Q${f(x + k * ex)} ${f(y + 2.4 * s)} ${f(x + k * ex + 2.4 * s)} ${f(y)}" stroke="${INK}" stroke-width="${f(1.5 * s)}" fill="none" stroke-linecap="round"/>`
      : mood === "wink" && k > 0 ? `<path d="M${f(x + k * ex - 2.4 * s)} ${f(y + .6 * s)} Q${f(x + k * ex)} ${f(y - 2 * s)} ${f(x + k * ex + 2.4 * s)} ${f(y + .6 * s)}" stroke="${INK}" stroke-width="${f(1.5 * s)}" fill="none" stroke-linecap="round"/>`
        : `<ellipse cx="${f(x + k * ex)}" cy="${f(y)}" rx="${f(2 * s)}" ry="${f(2.6 * s)}" fill="${INK}"/><circle cx="${f(x + k * ex - .7 * s)}" cy="${f(y - 1 * s)}" r="${f(.9 * s)}" fill="#fff"/>`;
    const blush = [-1, 1].map(k => `<ellipse cx="${f(x + k * 8.4 * s)}" cy="${f(y + 3.6 * s)}" rx="${f(2.8 * s)}" ry="${f(1.6 * s)}" fill="#ff5f95" opacity=".5"/>`).join("");
    const mouth = mood === "open" || mood === "wink" ? `<path d="M${f(x - 2.8 * s)} ${f(y + 3.4 * s)} Q${f(x)} ${f(y + 9 * s)} ${f(x + 2.8 * s)} ${f(y + 3.4 * s)}Z" fill="#9b2b46" stroke="${INK}" stroke-width="${f(1.1 * s)}" stroke-linejoin="round"/>`
      : `<path d="M${f(x - 2.5 * s)} ${f(y + 3.6 * s)} Q${f(x)} ${f(y + 6.8 * s)} ${f(x + 2.5 * s)} ${f(y + 3.6 * s)}" stroke="${INK}" stroke-width="${f(1.4 * s)}" fill="none" stroke-linecap="round"/>`;
    return eye(-1) + eye(1) + blush + mouth;
  };
  const star4 = (x, y, s, col = "#fff") => `<path d="M${f(x)} ${f(y - s)} Q${f(x + s * .16)} ${f(y - s * .16)} ${f(x + s)} ${f(y)} Q${f(x + s * .16)} ${f(y + s * .16)} ${f(x)} ${f(y + s)} Q${f(x - s * .16)} ${f(y + s * .16)} ${f(x - s)} ${f(y)} Q${f(x - s * .16)} ${f(y - s * .16)} ${f(x)} ${f(y - s)}Z" fill="${col}"/>`;
  const starPath = (x, y, R, r, rot = 0) => { let p = ""; for (let k = 0; k < 10; k++) { const rr = k % 2 ? r : R, a = -Math.PI / 2 + rot + k * Math.PI / 5; p += `${k ? "L" : "M"}${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`; } return p + "Z"; };
  const mound = (cx = 60, w = 30, h = 12) => P(`M${cx - w} 133 Q${cx - w * .55} ${133 - h} ${cx} ${133 - h} Q${cx + w * .55} ${133 - h} ${cx + w} 133Z`, "#8a5a32", ink("#8a5a32"), 1.8) + `<path d="M${cx - w * .5} ${133 - h * .55} q6 -3 12 -1" stroke="#b07a48" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const shadow = (rx = 30) => `<ellipse cx="60" cy="132" rx="${rx}" ry="5" fill="#2a1406" opacity=".22"/>`;
  const petal = (X, x, y, len, w, deg, c1, c2) => `<g transform="translate(${f(x)} ${f(y)}) rotate(${f(deg)})">${P(`M0 0 Q${f(w)} ${f(-len * .45)} 0 ${f(-len)} Q${f(-w)} ${f(-len * .45)} 0 0Z`, X.lg(c1, c2), ink(c2), 1.6)}</g>`;

  /* ---------- element flair around a ripe crop (Plants vs. Zombies idea: you can see what it is) ---------- */
  const FX = {
    Fire: X => [[22, 50, 1], [98, 40, .8], [92, 70, .65]].map(([x, y, s]) => P(`M${x} ${f(y - 8 * s)} Q${f(x + 5 * s)} ${f(y - 1 * s)} ${x} ${f(y + 4 * s)} Q${f(x - 5 * s)} ${f(y - 1 * s)} ${x} ${f(y - 8 * s)}Z`, X.lg("#ffe36a", "#ff6a1f"), "#c2410c", 1.2)).join(""),
    Electric: X => [[22, 46, 1], [98, 58, .85]].map(([x, y, s]) => P(`M${x} ${y} l${f(-4 * s)} ${f(8 * s)} h${f(4 * s)} l${f(-3 * s)} ${f(8 * s)} l${f(8 * s)} ${f(-10 * s)} h${f(-4 * s)} l${f(3 * s)} ${f(-6 * s)}z`, "#ffe14a", ink("#e0a800"), 1.2)).join(""),
    Water: X => [[22, 54, 1], [98, 42, .8], [94, 72, .7]].map(([x, y, s]) => P(`M${x} ${f(y - 7 * s)} Q${f(x + 5 * s)} ${f(y + 1 * s)} ${x} ${f(y + 4 * s)} Q${f(x - 5 * s)} ${f(y + 1 * s)} ${x} ${f(y - 7 * s)}Z`, X.lg("#d6f3ff", "#3aa0f0"), ink("#3aa0f0"), 1.2)).join(""),
    Light: X => star4(22, 48, 7, "#fff6c2") + star4(98, 40, 5.5, "#fff") + star4(94, 70, 4, "#ffe27a"),
    Shadow: X => P("M18 52 a9 9 0 1 0 12 -10 a7 7 0 1 1 -12 10z", "#b9a3ff", ink("#8a6bff"), 1.2) + `<circle cx="98" cy="44" r="2.6" fill="#c9b6ff"/><circle cx="92" cy="68" r="1.8" fill="#c9b6ff"/><circle cx="104" cy="58" r="1.4" fill="#e6dcff"/>`,
    Psychic: X => `<ellipse cx="24" cy="50" rx="8" ry="3.4" fill="none" stroke="#ff8fd8" stroke-width="2" transform="rotate(-20 24 50)"/><circle cx="24" cy="50" r="2.4" fill="#ff8fd8"/>` + P(starPath(98, 44, 5.5, 2.4), "#ffd0f0", ink("#c47dff"), 1.1) + star4(92, 70, 3.5, "#ffd0f0"),
    Earth: X => [[22, 52, 1], [98, 44, .8], [94, 70, .7]].map(([x, y, s]) => P(`M${x} ${f(y - 5 * s)} L${f(x + 4 * s)} ${y} L${x} ${f(y + 5 * s)} L${f(x - 4 * s)} ${y}Z`, X.lg("#ffe2a8", "#c98a3a"), ink("#c98a3a"), 1.2)).join(""),
    Aura: X => [[16, 50], [86, 40]].map(([x, y]) => `<path d="M${x} ${y} q8 -7 15 -1 q4 5 -2 7 q-4 1 -4 -3" stroke="#e4fbff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".95"/>`).join(""),
  };

  /* ---------- produce pieces ---------- */
  const wheatHead = (X, x, y, deg, len, col) => {
    const a = deg * Math.PI / 180, dx = Math.cos(a), dy = Math.sin(a), px = -dy, py = dx; let s = "";
    for (let k = 0; k < 5; k++) { const cx = x + dx * k * len / 5, cy = y + dy * k * len / 5; for (const side of [-1, 1]) { const gx = cx + px * side * 2.7, gy = cy + py * side * 2.7; s += `<line x1="${f(gx)}" y1="${f(gy)}" x2="${f(gx + (dx * .7 + px * side * .7) * 8)}" y2="${f(gy + (dy * .7 + py * side * .7) * 8)}" stroke="${mix(col, "#ffffff", .25)}" stroke-width=".8"/>`; s += `<ellipse cx="${f(gx)}" cy="${f(gy)}" rx="2.7" ry="4.6" transform="rotate(${f(deg + 90 + side * 28)} ${f(gx)} ${f(gy)})" fill="${X.rg(col)}" stroke="${ink(col)}" stroke-width="1.1"/>`; } }
    const tx = x + dx * len, ty = y + dy * len; s += `<ellipse cx="${f(tx)}" cy="${f(ty)}" rx="2.6" ry="4.4" transform="rotate(${f(deg + 90)} ${f(tx)} ${f(ty)})" fill="${X.rg(col)}" stroke="${ink(col)}" stroke-width="1.1"/>`;
    return s;
  };
  const chili = (X, x, y, len, deg, col) => `<g transform="translate(${x} ${y}) rotate(${deg})">${P(`M-5 0 Q-7 ${f(len * .55)} 3 ${len} Q6 ${f(len * .5)} 5.5 0Z`, X.rg(col), ink(col), 1.8)}<ellipse cx="-1.5" cy="${f(len * .3)}" rx="1.4" ry="${f(len * .2)}" fill="#fff" opacity=".6"/>${P("M-6.5 1 Q0 -5 6.5 1 Q0 4 -6.5 1Z", "#5fae43", ink("#5fae43"), 1.4)}${line("M0 -2 q1 -5 4 -6", "#5fae43", 2)}</g>`;
  const plum = (X, x, y, s, col) => `<ellipse cx="${x}" cy="${y}" rx="${f(6.4 * s)}" ry="${f(7.4 * s)}" fill="${X.rg(col)}" stroke="${ink(col)}" stroke-width="1.8"/><path d="M${x} ${f(y - 6.6 * s)} q${f(-1.6 * s)} ${f(6 * s)} 0 ${f(13 * s)}" stroke="${ink(col)}" stroke-width=".9" fill="none" opacity=".6"/>${gloss(x, y, 6.4 * s)}${line(`M${x} ${f(y - 7 * s)} l1 ${f(-3.5 * s)}`, "#7a5230", 1.4)}`;
  const pumpkin = (X, x, y, w, h, col, crack) => {
    const lobe = (cx, rx) => `<ellipse cx="${f(cx)}" cy="${f(y)}" rx="${f(rx)}" ry="${f(h * .5)}" fill="${X.rg(col)}" stroke="${ink(col)}" stroke-width="2"/>`;
    let s = lobe(x - w * .3, w * .3) + lobe(x + w * .3, w * .3) + lobe(x, w * .3) + gloss(x - w * .12, y - h * .05, h * .4);
    if (crack) s += [[x - w * .3, -1], [x + w * .3, 1]].map(([cx, k]) => `<path d="M${f(cx)} ${f(y - h * .38)} l${f(k * 3)} ${f(h * .2)} l${f(-k * 4)} ${f(h * .14)} l${f(k * 3)} ${f(h * .22)}" stroke="#ffe36a" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    s += line(`M${x} ${f(y - h * .46)} q1 -7 6 -9`, "#6a8a2a", 3.4);
    return s;
  };
  const melon = (X, x, y, rx, ry, base, stripe) => {
    let s = `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${X.rg(base)}" stroke="${ink(base)}" stroke-width="2"/>`;
    for (let k = -1.5; k <= 1.5; k++) { let p = ""; const n = 7; for (let i = 0; i <= n; i++) { const t = -0.92 + 1.84 * i / n, yy = y + t * ry, wf = Math.sqrt(Math.max(0, 1 - t * t)), xx = x + (k / 2.2) * rx * wf + (i % 2 ? 2.4 : -2.4) * wf; p += `${i ? "L" : "M"}${f(xx)} ${f(yy)}`; } s += `<path d="${p}" stroke="${stripe}" stroke-width="2.6" fill="none" stroke-linejoin="round" stroke-linecap="round"/>`; }
    return s + gloss(x, y, Math.min(rx, ry) * 1.1);
  };
  const lobedLeaf = (X, x, y, r, tone = 0) => { const [c1, c2] = LEAF[tone]; return union([circ(x - r * .5, y, r * .6), circ(x + r * .5, y, r * .6), circ(x, y - r * .45, r * .62)], X.ug(c1, c2, y - r, y + r * .6), ink(c2), 1.6) + `<path d="M${f(x)} ${f(y + r * .3)} L${f(x)} ${f(y - r * .6)} M${f(x)} ${f(y)} L${f(x - r * .6)} ${f(y - r * .2)} M${f(x)} ${f(y)} L${f(x + r * .6)} ${f(y - r * .2)}" stroke="#ffffff" stroke-opacity=".35" stroke-width="1"/>`; };
  const tendril = (x, y, k = 1) => `<path d="M${x} ${y} q${8 * k} -2 ${8 * k} -8 q0 -5 ${-4 * k} -4 q-3 1 -1 4" stroke="#5fae43" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  const facePatch = (x, y, s, col) => `<ellipse cx="${f(x)}" cy="${f(y + 2.4 * s)}" rx="${f(11.5 * s)}" ry="${f(7.6 * s)}" fill="${col}" opacity=".88"/>`;
  const mushroom = (X, x, y, r, h, col, mood, spots = "#ffffff") => {
    const sw = r * .62; let s = P(`M${f(x - sw / 2)} ${f(y)} Q${f(x - sw * .62)} 131 ${f(x - sw * .2)} 132 L${f(x + sw * .2)} 132 Q${f(x + sw * .62)} 131 ${f(x + sw / 2)} ${f(y)}Z`, X.lg("#fffaf0", "#e2cfb4"), ink("#e2cfb4"), 1.8);
    s += P(`M${f(x - r)} ${f(y)} Q${f(x - r)} ${f(y - h)} ${f(x)} ${f(y - h)} Q${f(x + r)} ${f(y - h)} ${f(x + r)} ${f(y)} Q${f(x)} ${f(y + 5)} ${f(x - r)} ${f(y)}Z`, X.rg(col), ink(col), 2);
    s += [[-.45, .5, .16], [.1, .72, .2], [.55, .42, .13], [-.08, .32, .1]].map(([dx, dy, rr]) => `<circle cx="${f(x + dx * r)}" cy="${f(y - dy * h)}" r="${f(rr * r)}" fill="${spots}" opacity=".9"/>`).join("");
    if (mood) s += face(x, y + (132 - y) * .38, Math.min(1.1, r / 22), mood);
    return s;
  };
  const crystal = (X, x, y, w, h, deg, col) => `<g transform="rotate(${deg} ${x} ${y})">${P(`M${f(x - w / 2)} ${y} L${f(x - w / 2)} ${f(y - h * .7)} L${x} ${f(y - h)} L${f(x + w / 2)} ${f(y - h * .7)} L${f(x + w / 2)} ${y}Z`, X.lg(mix(col, "#ffffff", .5), col), ink(col), 1.8)}<path d="M${x} ${f(y - h)} L${f(x + w / 2)} ${f(y - h * .7)} L${f(x + w / 2)} ${y} L${x} ${y}Z" fill="${mix(col, "#2a1640", .25)}" opacity=".45"/><path d="M${f(x - w * .25)} ${f(y - h * .15)} L${f(x - w * .25)} ${f(y - h * .7)}" stroke="#fff" stroke-width="1.4" opacity=".7" stroke-linecap="round"/></g>`;
  const grapes = (X, x, y, r, rows, col) => { let s = ""; rows.forEach((n, ri) => { for (let k = 0; k < n; k++) s += ball(X, x - (n - 1) * r * .95 + k * r * 1.9, y + ri * r * 1.6, r, col, 1.4); }); return s; };
  const lotusFlower = (X, x, y, s, col) => {
    let g = ""; [-62, -32, 0, 32, 62].forEach(a => g += petal(X, x, y, 24 * s, 7.5 * s, a, mix(col, "#ffffff", .55), col));
    g += `<ellipse cx="${x}" cy="${f(y - 9 * s)}" rx="${f(7 * s)}" ry="${f(4 * s)}" fill="${X.rg("#ffd65b")}" stroke="${ink("#ffd65b")}" stroke-width="1.4"/>`;
    [-40, 0, 40].forEach(a => g += petal(X, x, y + 2 * s, 18 * s, 7 * s, a, mix(col, "#ffffff", .7), mix(col, "#ffffff", .1)));
    return g;
  };
  const pad = (X, x, y, rx, ry) => { const a0 = .4; return P(`M${f(x + rx * Math.cos(a0))} ${f(y + ry * Math.sin(a0))} A${rx} ${ry} 0 1 1 ${f(x + rx * Math.cos(-a0))} ${f(y + ry * Math.sin(-a0))} L${x} ${y}Z`, X.lg("#9be06a", "#3f9a3a"), ink("#3f9a3a"), 1.6) + `<path d="M${x} ${y} l${f(-rx * .7)} ${f(-ry * .3)} M${x} ${y} l${f(-rx * .5)} ${f(ry * .5)}" stroke="#d8ffb0" stroke-width=".9" opacity=".7"/>`; };
  const puddle = X => `<ellipse cx="60" cy="125" rx="46" ry="10.5" fill="${X.lg("#9fe0ff", "#2f86d0")}" stroke="${ink("#2f86d0")}" stroke-width="1.6" opacity=".92"/><path d="M28 124 q8 -3 16 0 M76 127 q8 -3 16 0" stroke="#e8f8ff" stroke-width="1.3" fill="none" opacity=".8" stroke-linecap="round"/>`;
  const poppy = (X, x, y, r, col) => {
    const c1 = mix(col, "#ffffff", .35), c2 = mix(col, "#7a2bb8", .45);
    let s = [[-r * .55, -r * .2], [r * .55, -r * .2]].map(([dx, dy]) => `<ellipse cx="${f(x + dx)}" cy="${f(y + dy)}" rx="${f(r * .62)}" ry="${f(r * .55)}" fill="${X.lg(c2, col)}" stroke="${ink(c2)}" stroke-width="1.6"/>`).join("");
    s += [[-r * .42, r * .25], [r * .42, r * .25]].map(([dx, dy]) => `<ellipse cx="${f(x + dx)}" cy="${f(y + dy)}" rx="${f(r * .6)}" ry="${f(r * .5)}" fill="${X.lg(c1, col)}" stroke="${ink(col)}" stroke-width="1.6"/>`).join("");
    s += `<circle cx="${x}" cy="${f(y + r * .05)}" r="${f(r * .3)}" fill="#3a1f4a" stroke="${ink("#3a1f4a")}" stroke-width="1"/>` + Array.from({ length: 6 }, (_, k) => `<circle cx="${f(x + Math.cos(k * 1.05) * r * .2)}" cy="${f(y + r * .05 + Math.sin(k * 1.05) * r * .2)}" r="${f(r * .05)}" fill="#ffd65b"/>`).join("");
    return s;
  };
  const pod = (X, x, y, len, deg, open, pearl) => {
    const h = len * .42; let s = `<g transform="translate(${x} ${y}) rotate(${deg})">` + P(`M${f(-len / 2)} 0 Q0 ${f(-h)} ${f(len / 2)} 0 Q0 ${f(h * .62)} ${f(-len / 2)} 0Z`, X.lg("#a6e070", "#4a9a3a"), ink("#4a9a3a"), 1.6);
    if (open) { s += P(`M${f(-len * .4)} -1 Q0 ${f(-h * .78)} ${f(len * .4)} -1 Q0 ${f(h * .2)} ${f(-len * .4)} -1Z`, "#e9ffd4", ink("#8acc5a"), 1); for (let k = -1; k <= 1; k++) s += ball(X, k * len * .24, -h * .22, len * .1, pearl, 1.1); }
    return s + "</g>";
  };
  const cottonPuff = (X, x, y, s, mood) => {
    const bract = [-1, 0, 1].map(k => P(`M${f(x + k * 7 * s)} ${f(y + 6 * s)} l${f(k * 5 * s - 3)} ${f(7 * s)} l6 -2z`, "#8a6a5a", ink("#8a6a5a"), 1.2)).join("");
    return bract + union([circ(x - 6 * s, y + 1 * s, 7 * s), circ(x + 6 * s, y + 1 * s, 7 * s), circ(x, y - 5 * s, 8 * s), circ(x, y + 4 * s, 7 * s)], X.rg("#f6f1ff"), ink("#a68be8"), 1.5)
      + `<circle cx="${f(x - 4 * s)}" cy="${f(y - 6 * s)}" r="${f(1.1 * s)}" fill="#8a6bff"/><circle cx="${f(x + 6 * s)}" cy="${f(y - 1 * s)}" r="${f(.9 * s)}" fill="#8a6bff"/><circle cx="${f(x - 7 * s)}" cy="${f(y + 3 * s)}" r="${f(.7 * s)}" fill="#b9a3ff"/>` + (mood ? face(x, y + 1 * s, .62 * s, mood) : "");
  };
  const starFruit = (X, x, y, R, rot = 0) => P(starPath(x, y, R, R * .52, rot), X.dg("#fff3a0", "#ff7ab8"), ink("#ff7ab8"), 1.8) + Array.from({ length: 5 }, (_, k) => { const a = -Math.PI / 2 + rot + k * 2 * Math.PI / 5; return `<path d="M${x} ${y} L${f(x + Math.cos(a) * R * .72)} ${f(y + Math.sin(a) * R * .72)}" stroke="#fff" stroke-width="1" opacity=".6"/>`; }).join("") + gloss(x, y, R * .7);
  const cob = (X, x, y, s, deg, ripe) => {
    const col = ripe ? "#ffd65b" : "#c8e07a"; let k = "";
    for (let r = 0; r < 6; r++) for (let c = -1; c <= 1; c++) k += `<circle cx="${f(x + c * 3.4 * s)}" cy="${f(y - 12 * s + r * 4.6 * s)}" r="${f(1.5 * s)}" fill="#fff" opacity=".45"/>`;
    const husk = ripe ? ["#a8c8ff", "#5a74ff"] : ["#b9ef7d", "#4aa43f"];
    return `<g transform="rotate(${deg} ${x} ${y})"><ellipse cx="${x}" cy="${y}" rx="${f(7.4 * s)}" ry="${f(17 * s)}" fill="${X.rg(col)}" stroke="${ink(col)}" stroke-width="1.8"/>${k}${P(`M${f(x - 8 * s)} ${f(y + 16 * s)} Q${f(x - 12 * s)} ${f(y + 4 * s)} ${f(x - 7 * s)} ${f(y - 3 * s)} Q${f(x - 3 * s)} ${f(y + 8 * s)} ${f(x + 1 * s)} ${f(y + 17 * s)}Z`, X.lg(husk[0], husk[1]), ink(husk[1]), 1.5)}${P(`M${f(x + 8 * s)} ${f(y + 16 * s)} Q${f(x + 12 * s)} ${f(y + 4 * s)} ${f(x + 7 * s)} ${f(y - 3 * s)} Q${f(x + 3 * s)} ${f(y + 8 * s)} ${f(x - 1 * s)} ${f(y + 17 * s)}Z`, X.lg(husk[0], husk[1]), ink(husk[1]), 1.5)}${ripe ? `<path d="M${f(x - 9 * s)} ${f(y + 2 * s)} l3 -4 l-1 4 l3 -4" stroke="#ffe14a" stroke-width="1.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` : ""}<path d="M${x} ${f(y - 17 * s)} q-3 -8 -1 -12 M${x} ${f(y - 17 * s)} q3 -8 2 -11" stroke="#e8c070" stroke-width="1.3" fill="none" stroke-linecap="round"/></g>`;
  };
  const flamePetal = (X, x, y, len, w, deg, c1, c2) => `<g transform="translate(${x} ${y}) rotate(${deg})">${P(`M0 0 Q${f(w)} ${f(-len * .35)} ${f(w * .35)} ${f(-len * .72)} Q${f(w * .95)} ${f(-len * .82)} 0 ${f(-len)} Q${f(-w * .5)} ${f(-len * .62)} ${f(-w * .7)} ${f(-len * .4)} Q${f(-w * .85)} ${f(-len * .15)} 0 0Z`, X.lg(c1, c2), ink(c2), 1.6)}</g>`;
  const whale = (X, x, y, s, col1, col2) => {
    const T = (px, py) => `${f(x + px * s)} ${f(y + py * s)}`;
    return `<path d="M${T(-38, 8)} Q${T(-40, -30)} ${T(-4, -34)} Q${T(26, -36)} ${T(36, -16)} Q${T(42, -28)} ${T(50, -32)} Q${T(48, -16)} ${T(40, -8)} Q${T(46, 0)} ${T(48, 10)} Q${T(38, 6)} ${T(32, 2)} Q${T(20, 14)} ${T(-4, 14)} Q${T(-34, 16)} ${T(-38, 8)}Z" fill="${X.dg(col1, col2)}" stroke="${ink(mix(col1, col2, .5))}" stroke-width="2" stroke-linejoin="round"/>`
      + `<path d="M${T(-34, 6)} Q${T(-6, 16)} ${T(28, 4)}" stroke="#ffffff" stroke-width="${f(2.2 * s)}" opacity=".55" fill="none" stroke-linecap="round"/>`
      + [[-8, -24, 3.4], [6, -27, 2.6], [18, -22, 2.2], [-18, -18, 2]].map(([px, py, r]) => `<circle cx="${f(x + px * s)}" cy="${f(y + py * s)}" r="${f(r * s)}" fill="#fff" opacity=".85"/>`).join("")
      + face(x - 20 * s, y - 6 * s, .8 * s, "happy") + gloss(x - 14 * s, y - 14 * s, 10 * s);
  };
  const wisp = (X, x, y, s) => `<g transform="translate(${x} ${y}) scale(${s})">${P("M-8 5 Q-9 -9 0 -10 Q9 -9 8 5 Q6 9 3.5 5.5 Q1 10 -1.2 5.5 Q-3.6 10 -5.6 5.5 Q-8 9 -8 5Z", X.rg("#f2fdff"), ink("#7fe7ff"), 1.6)}${face(0, -2, .55, "happy")}</g>`;
  const halo = (x, y, rx) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${f(rx * .28)}" fill="none" stroke="${ink("#ffd65b")}" stroke-width="6.6"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${f(rx * .28)}" fill="none" stroke="#ffe27a" stroke-width="4"/><ellipse cx="${f(x - rx * .4)}" cy="${f(y - rx * .2)}" rx="${f(rx * .25)}" ry="1" fill="#fff" opacity=".8"/>`;
  const ginsengBody = (X, x, y, s, mood, full) => {
    let g = "";
    if (full) g += line(`M${f(x - 6 * s)} ${f(y + 16 * s)} q-3 ${f(8 * s)} ${f(-8 * s)} ${f(12 * s)}`, "#e3b778", 3.4 * s) + line(`M${f(x + 6 * s)} ${f(y + 16 * s)} q3 ${f(8 * s)} ${f(7 * s)} ${f(13 * s)}`, "#e3b778", 3.4 * s);
    g += line(`M${f(x - 11 * s)} ${f(y)} q${f(-7 * s)} ${f(2 * s)} ${f(-11 * s)} ${f(9 * s)}`, "#e3b778", 3 * s) + line(`M${f(x + 11 * s)} ${f(y)} q${f(7 * s)} ${f(-1 * s)} ${f(10 * s)} ${f(-8 * s)}`, "#e3b778", 3 * s);
    g += `<ellipse cx="${x}" cy="${f(y + 2 * s)}" rx="${f(13 * s)}" ry="${f(17 * s)}" fill="${X.rg("#f3d7a6")}" stroke="${ink("#e3b778")}" stroke-width="2"/>`;
    g += `<path d="M${f(x - 9 * s)} ${f(y + 10 * s)} q${f(4 * s)} 2 ${f(8 * s)} 0 M${f(x + 2 * s)} ${f(y + 14 * s)} q${f(4 * s)} 2 ${f(7 * s)} 0" stroke="#c8955a" stroke-width="1.2" fill="none" stroke-linecap="round"/>`;
    return g + face(x, y - 3 * s, .85 * s, mood);
  };
  const palm = (X, x, y, s = 1) => [-150, -115, -90, -65, -30].map((a, k) => leaf(X, x, y, (k === 2 ? 20 : 16) * s, a, 5 * s, k % 2)).join("");
  const bush = (X, cs, light = "#a6ea6e", dark = "#3a8f38") => { const ys = cs.map(c => c[1]), y0 = Math.min(...cs.map(c => c[1] - c[2])), y1 = Math.max(...cs.map(c => c[1] + c[2])); return union(cs.map(([x, y, r]) => circ(x, y, r)), X.ug(light, dark, y0, y1), ink(dark), 2) + cs.slice(0, 4).map(([x, y, r]) => `<path d="M${f(x - r * .35)} ${f(y - r * .2)} q${f(r * .3)} ${f(-r * .35)} ${f(r * .6)} ${f(-r * .1)}" stroke="#ffffff" stroke-opacity=".35" stroke-width="1.4" fill="none" stroke-linecap="round"/>`).join(""); };
  const trunk = d => line(d, "#8a5a32", 6.5);

  /* ---------- the 25 crops ----------
     sp: sprout shape. fol(X, ripe): leaves and stems. prod(X, ripe): the produce on the plant (ripe=0 green, ripe=1 ready).
     item(X): the harvested produce for icons. young(X) (optional): stage 2 when it differs from a smaller fol. */
  const D = {
    wheat: {
      sp: "blade",
      fol: (X, r) => { const st = r ? "#d9a83a" : "#6faa3a"; let s = leaf(X, 58, 131, 44, -112, 4) + leaf(X, 62, 131, 42, -68, 4, 1) + leaf(X, 58, 131, 30, -140, 3.5, 1) + leaf(X, 62, 131, 30, -40, 3.5); WHEAT.forEach(([x0, tx, ty]) => { s += line(`M${x0} 132 Q${f(x0 + (tx - x0) * .3)} 96 ${tx} ${ty}`, st, 1.8); }); return s; },
      prod: (X, r) => WHEAT.map(([x0, tx, ty]) => { const deg = Math.atan2(ty - 96, tx - (x0 + (tx - x0) * .3)) * 180 / Math.PI; return wheatHead(X, tx, ty, deg, r ? 22 : 17, r ? "#f6c94a" : "#b5dc6a"); }).join(""),
      item: X => { let s = ""; [[-26, 34], [-13, 30], [0, 28], [13, 30], [26, 34]].forEach(([dx, ty]) => { const tx = 60 + dx; s += line(`M${60 + dx * .18} 128 Q${60 + dx * .1} 96 ${tx} ${ty + 22}`, "#d9a83a", 2) + wheatHead(X, tx, ty + 22, Math.atan2(-22, dx * .9) * 180 / Math.PI, 24, "#f6c94a"); }); return s + P("M44 94 Q60 100 76 94 L76 102 Q60 108 44 102Z", X.lg("#ff8a6a", "#d9473f"), ink("#d9473f"), 1.6) + P("M60 98 q-12 -8 -14 2 q2 6 14 0z M60 98 q12 -8 14 2 q-2 6 -14 0z", "#ff7a5a", ink("#d9473f"), 1.4); },
    },
    carrot: {
      sp: "leaf",
      fol: (X, r) => [-155, -128, -105, -85, -62, -38, -18].map((a, k) => leaf(X, 60, r ? 106 : 116, 24 + (k % 3) * 6, a, 4.6, k % 2)).join(""),
      prod: (X, r) => r ? P("M43 128 Q42 104 60 103 Q78 104 77 128Z", X.rg("#ff8a3d"), ink("#e0601a"), 2) + `<path d="M48 112 h6 M66 117 h6" stroke="#d0601f" stroke-width="1.6" stroke-linecap="round"/>` + gloss(54, 112, 10) + face(60, 117, .95, "happy") + mound(60, 34, 9)
        : P("M50 128 Q50 113 60 113 Q70 113 70 128Z", X.rg("#ffc08a"), ink("#e08a4a"), 1.8) + mound(60, 30, 8),
      item: X => `<g transform="rotate(-18 60 86)">${[-125, -100, -80, -55].map((a, k) => leaf(X, 60, 50, 24 + (k % 2) * 6, a, 5, k % 2)).join("")}${P("M43 58 Q43 48 60 48 Q77 48 77 58 Q73 98 62 132 Q59 136 56 130 Q47 98 43 58Z", X.rg("#ff8a3d"), ink("#e0601a"), 2.2)}<path d="M50 78 h7 M63 92 h7 M53 106 h6" stroke="#d0601f" stroke-width="1.8" stroke-linecap="round"/>${gloss(55, 66, 12)}${face(60, 66, 1.05, "happy")}</g>`,
    },
    voltberry: {
      sp: "leaf",
      fol: X => bush(X, [[60, 94, 26], [37, 108, 18], [83, 108, 18], [46, 80, 16], [74, 80, 16], [60, 116, 18]]),
      prod: (X, r) => r ? [[44, 98], [58, 84], [74, 94], [52, 110], [68, 112], [84, 106], [38, 112], [62, 99], [48, 84]].map(([x, y], k) => ball(X, x, y, 6.6, "#ffd84a", 1.6) + (k % 3 === 0 ? `<path d="M${x + 1} ${y - 3} l-2 3 h2 l-1 3" stroke="${ink("#e09a00")}" stroke-width="1" fill="none" stroke-linecap="round"/>` : "")).join("")
        : [[46, 96], [60, 86], [72, 98], [56, 108], [80, 108]].map(([x, y]) => ball(X, x, y, 4.4, "#d8e86a", 1.2)).join(""),
      item: X => leaf(X, 60, 50, 22, -140, 7) + leaf(X, 60, 50, 22, -40, 7, 1) + ball(X, 44, 88, 19, "#ffd84a") + ball(X, 76, 88, 19, "#ffd84a") + ball(X, 60, 66, 19, "#ffd84a") + P("M62 58 l-6 9 h6 l-4 9 l11 -12 h-6 l4 -6z", "#fff6c2", ink("#e09a00"), 1.2) + line("M60 48 v-6", "#5fae43", 2.4),
    },
    pepper: {
      sp: "leaf",
      fol: X => stem("M60 132 Q58 110 50 88") + stem("M60 132 Q62 104 72 84") + stem("M60 118 Q70 110 84 100", 2.6) + [[50, 88, -140], [72, 84, -40], [84, 100, -20], [46, 104, -170], [66, 94, -70], [56, 112, -120], [74, 112, -10]].map(([x, y, a], k) => leaf(X, x, y, 18, a, 6.5, k % 2)).join(""),
      prod: (X, r) => (r ? [[50, 90, 26, 12], [70, 86, 28, -14], [83, 103, 22, -28], [57, 104, 24, 6]] : [[52, 94, 15, 10], [70, 92, 16, -12], [80, 106, 13, -24]]).map(([x, y, l, d]) => chili(X, x, y, l, d, r ? "#ff3b2a" : "#7cc04a")).join(""),
      item: X => chili(X, 46, 34, 84, -16, "#ff3b2a") + chili(X, 74, 40, 74, 18, "#ff7a1a"),
    },
    mint: {
      sp: "leaf",
      fol: (X, r) => { const T = ["#d6fff0", "#2fae8a"], T2 = ["#a8f0d6", "#1f8a6e"]; let s = ""; [[44, 66], [60, 50], [76, 62]].forEach(([x, top]) => { s += stem(`M${x} 132 Q${x - 2} ${(132 + top) / 2} ${x} ${top}`, 2.6); for (let y = 124, k = 0; y > top + 6; y -= 14, k++) s += leaf(X, x, y, 14, -165 + k * 4, 6.4, k % 2 ? T2 : T) + leaf(X, x, y, 14, -15 - k * 4, 6.4, k % 2 ? T : T2); s += leaf(X, x, top + 4, 12, -120, 5.4, r ? ["#e8fdff", "#5fd6ef"] : T) + leaf(X, x, top + 4, 12, -60, 5.4, r ? ["#e8fdff", "#5fd6ef"] : T2); }); return s; },
      prod: (X, r) => r ? wisp(X, 88, 38, 1.7) + star4(28, 40, 4, "#e8fdff") : "",
      item: X => { const T = ["#d6fff0", "#2fae8a"], T2 = ["#a8f0d6", "#1f8a6e"]; let s = stem("M56 132 Q52 96 58 56", 3); [118, 100, 82, 66].forEach((y, k) => { const x = 56 - (132 - y) * .02; s += leaf(X, x, y, 22 - k * 2, -160 + k * 6, 9 - k, k % 2 ? T2 : T) + leaf(X, x, y, 22 - k * 2, -20 - k * 6, 9 - k, k % 2 ? T : T2); }); return s + wisp(X, 88, 40, 1.5); },
    },
    lotus: {
      sp: "pad",
      fol: X => puddle(X) + pad(X, 32, 121, 16, 6.5) + pad(X, 88, 127, 18, 7) + stem("M60 124 Q57 108 60 94", 3),
      prod: (X, r) => r ? lotusFlower(X, 60, 100, 1.35, "#ff9bd2") : P("M60 76 Q70 88 60 98 Q50 88 60 76Z", X.lg("#ffd0e8", "#8fc46a"), ink("#8fc46a"), 1.6),
      item: X => pad(X, 60, 116, 40, 13) + lotusFlower(X, 60, 104, 1.7, "#ff9bd2"),
    },
    lumen: {
      sp: "leaf",
      fol: X => stem("M60 132 Q56 100 60 68") + leaf(X, 59, 120, 24, -160, 7) + leaf(X, 60, 114, 24, -20, 7, 1) + leaf(X, 59, 100, 20, -145, 6, 1) + leaf(X, 60, 92, 18, -35, 6),
      prod: (X, r) => r ? `<circle cx="60" cy="54" r="36" fill="${X.glow("#fff1a8")}"/>` + [-60, -30, 0, 30, 60].map(a => petal(X, 60, 72, 30, 9.5, a, "#fffbe0", "#f2b62a")).join("") + `<circle cx="60" cy="52" r="7" fill="#fffef0" stroke="${ink("#f2b62a")}" stroke-width="1.4"/>` + [0, 1, 2, 3, 4, 5].map(k => { const a = -Math.PI / 2 + (k - 2.5) * .55; return `<path d="M${f(60 + Math.cos(a) * 34)} ${f(60 + Math.sin(a) * 34)} l${f(Math.cos(a) * 6)} ${f(Math.sin(a) * 6)}" stroke="#fff3b0" stroke-width="2.2" stroke-linecap="round"/>`; }).join("")
        : P("M60 52 Q69 62 60 72 Q51 62 60 52Z", X.lg("#fff3b0", "#7fbf4a"), ink("#7fbf4a"), 1.6),
      item: X => `<circle cx="60" cy="66" r="50" fill="${X.glow("#fff1a8")}"/>` + stem("M60 132 Q58 112 60 96") + leaf(X, 60, 118, 22, -150, 7) + leaf(X, 60, 112, 22, -30, 7, 1) + [-62, -31, 0, 31, 62].map(a => petal(X, 60, 98, 52, 16, a, "#fffbe0", "#f2b62a")).join("") + `<circle cx="60" cy="62" r="11" fill="#fffef0" stroke="${ink("#f2b62a")}" stroke-width="1.6"/>` + star4(60, 62, 6, "#ffe27a"),
    },
    duskcap: {
      sp: "cap",
      fol: X => leaf(X, 40, 132, 16, -120, 3.5) + leaf(X, 80, 132, 16, -60, 3.5, 1) + leaf(X, 30, 132, 12, -140, 3, 1) + leaf(X, 92, 132, 12, -40, 3),
      young: X => mushroom(X, 54, 118, 10, 11, "#b9a8e8") + mushroom(X, 70, 122, 7, 7, "#b9a8e8"),
      prod: (X, r) => r ? mushroom(X, 84, 112, 14, 17, "#8a6bff", null, "#d8ccff") + mushroom(X, 58, 94, 27, 36, "#8a6bff", "sleepy", "#d8ccff") + mushroom(X, 32, 116, 12, 14, "#a58aff", null, "#e8e0ff")
        : mushroom(X, 58, 106, 17, 20, "#b9a8e8", null, "#ece6ff") + mushroom(X, 82, 118, 9, 10, "#b9a8e8", null, "#ece6ff"),
      item: X => mushroom(X, 86, 112, 14, 16, "#a58aff", null, "#e8e0ff") + mushroom(X, 56, 82, 36, 46, "#8a6bff", "sleepy", "#d8ccff"),
    },
    plum: {
      sp: "tree",
      fol: X => trunk("M58 132 Q56 108 58 90 M58 104 Q66 96 72 84 M58 98 Q50 90 46 80") + bush(X, [[60, 62, 25], [38, 74, 19], [82, 74, 19], [48, 50, 17], [72, 50, 17], [60, 80, 17]], "#9ee06a", "#3a8a3a"),
      prod: (X, r) => (r ? [[44, 72], [58, 56], [74, 64], [52, 86], [70, 84], [84, 78], [62, 72], [38, 86]] : [[46, 74], [62, 60], [74, 78], [54, 86]]).map(([x, y]) => plum(X, x, y, r ? 1 : .62, r ? "#c47dff" : "#a6d66a")).join(""),
      item: X => leaf(X, 62, 44, 26, -30, 9, 1) + plum(X, 44, 86, 3.2, "#c47dff") + plum(X, 80, 92, 2.7, "#b06ae8") + `<path d="M40 76 q4 -6 10 -4" stroke="#fff" stroke-width="2" fill="none" opacity=".7" stroke-linecap="round"/>`,
    },
    pumpkin: {
      sp: "round",
      fol: X => lobedLeaf(X, 26, 116, 16) + lobedLeaf(X, 94, 116, 16, 1) + lobedLeaf(X, 40, 98, 13, 1) + lobedLeaf(X, 82, 96, 13) + `<path d="M20 128 Q40 112 60 120 Q80 128 100 114" stroke="#4f9a36" stroke-width="3" fill="none" stroke-linecap="round"/>` + tendril(96, 104) + tendril(22, 104, -1),
      prod: (X, r) => r ? pumpkin(X, 60, 110, 66, 42, "#ff8a1a", 1) + face(60, 106, 1.25, "wink") : pumpkin(X, 60, 117, 42, 27, "#c8e07a", 0),
      item: X => leaf(X, 70, 50, 22, -20, 8, 1) + pumpkin(X, 60, 96, 86, 60, "#ff8a1a", 1) + face(60, 94, 1.6, "wink"),
    },
    grape: {
      sp: "leaf",
      fol: X => P("M27 132 L27 50 L32 50 L32 132Z", X.lg("#c08a5a", "#8a5a32"), ink("#8a5a32"), 1.6) + P("M88 132 L88 50 L93 50 L93 132Z", X.lg("#c08a5a", "#8a5a32"), ink("#8a5a32"), 1.6) + P("M22 48 L98 48 L98 55 L22 55Z", X.lg("#d29a68", "#9a6a3e"), ink("#9a6a3e"), 1.6) + stem("M60 132 Q52 100 60 56", 3) + [[34, 58], [48, 62], [62, 56], [76, 62], [90, 58]].map(([x, y], k) => lobedLeaf(X, x, y, 11, k % 2)).join("") + tendril(66, 74),
      prod: (X, r) => r ? grapes(X, 40, 70, 4.8, [4, 3, 2, 1], "#7a8cff") + grapes(X, 78, 70, 4.8, [4, 3, 2, 1], "#7a8cff") + star4(60, 86, 4, "#fff6c2") : grapes(X, 42, 72, 3.4, [3, 2, 1], "#b6dc7a") + grapes(X, 78, 72, 3.4, [3, 2, 1], "#b6dc7a"),
      item: X => lobedLeaf(X, 70, 40, 18, 1) + line("M60 34 q-2 10 0 18", "#7a5230", 3) + grapes(X, 60, 58, 9, [4, 3, 2, 1], "#7a8cff") + `<path d="M84 48 l-4 7 h4 l-3 7" stroke="#ffe14a" stroke-width="2" fill="none" stroke-linecap="round"/>`,
    },
    yam: {
      sp: "crystal",
      fol: (X, r) => [-160, -132, -104, -76, -48, -20].map((a, k) => leaf(X, 60, r ? 112 : 120, 26, a, 7, k % 2 ? ["#d6f09a", "#5a9a46"] : ["#c0e888", "#4a8a3e"])).join(""),
      prod: (X, r) => r ? crystal(X, 42, 130, 12, 30, -16, "#c3adff") + crystal(X, 78, 130, 12, 28, 16, "#b29aff") + crystal(X, 60, 128, 15, 38, 0, "#d6c6ff") + mound(60, 36, 8) + star4(70, 96, 4)
        : crystal(X, 52, 130, 8, 16, -10, "#a99cc8") + crystal(X, 68, 130, 8, 14, 12, "#a99cc8") + mound(60, 30, 7),
      item: X => [-150, -125, -100].map((a, k) => leaf(X, 30, 84, 22, a, 7, k % 2)).join("") + crystal(X, 52, 82, 11, 26, -14, "#d6c6ff") + crystal(X, 72, 82, 13, 34, 8, "#c3adff") + P("M22 96 Q20 80 40 78 Q66 74 92 82 Q108 88 102 102 Q96 116 66 114 Q34 114 24 106 Q20 102 22 96Z", X.dg("#ece4ff", "#8f74e8"), ink("#8f74e8"), 2.2) + `<path d="M40 79 L50 113 M66 75 L60 114 M88 81 L84 113 M22 98 L50 92 L74 96 L102 96" stroke="#ffffff" stroke-width="1.4" opacity=".55" fill="none" stroke-linejoin="round"/>` + gloss(44, 92, 14) + star4(92, 64, 5),
    },
    cactus: {
      sp: "nub",
      fol: (X, r) => { const g = X.lg("#9ee07a", "#3f9a46"); return `<path d="M50 100 h-9 a7 7 0 0 1 -7 -7 v-16" stroke="${ink("#3f9a46")}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M50 100 h-9 a7 7 0 0 1 -7 -7 v-16" stroke="#6cc25a" stroke-width="9" fill="none" stroke-linecap="round"/><path d="M70 92 h9 a7 7 0 0 0 7 -7 v-12" stroke="${ink("#3f9a46")}" stroke-width="13" fill="none" stroke-linecap="round"/><path d="M70 92 h9 a7 7 0 0 0 7 -7 v-12" stroke="#5ab64e" stroke-width="9" fill="none" stroke-linecap="round"/>` + P("M47 132 L47 78 Q47 64 60 64 Q73 64 73 78 L73 132Z", g, ink("#3f9a46"), 2) + `<path d="M54 74 v54 M66 74 v54" stroke="#2f7a36" stroke-width="1.2" opacity=".5"/>` + [[51, 84], [62, 80], [69, 96], [52, 110], [64, 118], [36, 84], [86, 80]].map(([x, y]) => `<path d="M${x} ${y} l-2 -2 M${x} ${y} l2 -2" stroke="#fff" stroke-width="1.1" stroke-linecap="round"/>`).join("") + `<path d="M51 70 q4 -3 8 -3" stroke="#fff" stroke-width="2" opacity=".55" fill="none" stroke-linecap="round"/>`; },
      prod: (X, r) => r ? [[60, 62, 1], [34, 74, .8], [86, 70, .8]].map(([x, y, s]) => [0, 1, 2, 3, 4].map(k => petal(X, x, y, 10 * s, 4.4 * s, k * 72, "#ffd0e2", "#ff6fa0")).join("") + `<circle cx="${x}" cy="${y}" r="${f(2.6 * s)}" fill="#ffd65b" stroke="${ink("#ffd65b")}" stroke-width="1"/>`).join("") + face(60, 96, 1, "happy")
        : [[60, 63], [34, 75], [86, 71]].map(([x, y]) => P(`M${x} ${y - 6} Q${x + 4} ${y} ${x} ${y + 2} Q${x - 4} ${y} ${x} ${y - 6}Z`, "#ffb3cf", ink("#ff6fa0"), 1.2)).join(""),
      item: X => `<ellipse cx="60" cy="92" rx="34" ry="36" fill="${X.lg("#9ee07a", "#3f9a46")}" stroke="${ink("#3f9a46")}" stroke-width="2.2"/><path d="M44 62 Q38 92 44 122 M60 56 V128 M76 62 Q82 92 76 122" stroke="#2f7a36" stroke-width="1.4" opacity=".45" fill="none"/>` + [[36, 80], [84, 84], [40, 108], [80, 112], [60, 120]].map(([x, y]) => `<path d="M${x} ${y} l-3 -3 M${x} ${y} l3 -3" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/>`).join("") + [0, 1, 2, 3, 4].map(k => petal(X, 60, 56, 18, 8, k * 72, "#ffd0e2", "#ff6fa0")).join("") + `<circle cx="60" cy="56" r="4.6" fill="#ffd65b" stroke="${ink("#ffd65b")}" stroke-width="1.2"/>` + face(60, 92, 1.5, "happy"),
    },
    kelp: {
      sp: "frond",
      fol: X => puddle(X) + [[40, 76, "#4fd0a0"], [50, 92, "#2aa58a"], [60, 70, "#4fd0a0"], [70, 90, "#2aa58a"], [80, 78, "#4fd0a0"]].map(([x, h, c]) => line(`M${x} 126 Q${x - 10} ${f(126 - h * .3)} ${x} ${f(126 - h * .55)} Q${x + 10} ${f(126 - h * .78)} ${x} ${126 - h}`, c, 5.2)).join(""),
      prod: (X, r) => [[40, 76], [50, 92], [60, 70], [70, 90], [80, 78]].map(([x, h], k) => r ? P(starPath(x, 126 - h - 4, 8, 4, k * .3), X.rg("#5ff0e0"), ink("#13909a"), 1.4) + gloss(x, 126 - h - 4, 5) : ball(X, x, 126 - h - 2, 3.6, "#9fd88a", 1.2)).join("") + (r ? `<circle cx="30" cy="96" r="3.4" fill="none" stroke="#dff9ff" stroke-width="1.4"/><circle cx="92" cy="104" r="2.4" fill="none" stroke="#dff9ff" stroke-width="1.2"/>` : ""),
      item: X => line("M50 132 Q34 108 52 90 Q70 72 56 52", "#2aa58a", 7) + line("M70 132 Q86 112 70 96", "#4fd0a0", 6) + P(starPath(60, 46, 26, 13, .15), X.rg("#5ff0e0"), ink("#13909a"), 2.2) + gloss(60, 46, 16) + `<circle cx="92" cy="74" r="5" fill="none" stroke="#bff3ff" stroke-width="2"/><circle cx="98" cy="58" r="3" fill="none" stroke="#bff3ff" stroke-width="1.6"/>`,
    },
    poppy: {
      sp: "leaf",
      fol: X => stem("M58 132 Q48 100 44 66", 2.4) + stem("M62 132 Q74 96 76 60", 2.4) + stem("M60 132 Q62 108 60 84", 2.4) + [-165, -140, -40, -15].map((a, k) => leaf(X, 60, 130, 24, a, 5, k % 2)).join(""),
      prod: (X, r) => r ? poppy(X, 44, 62, 13, "#ff6fae") + poppy(X, 76, 56, 14, "#ff6fae") + poppy(X, 60, 80, 11, "#e86ad0") + `<text x="94" y="38" font-family="Arial Black,Arial" font-weight="900" font-size="11" fill="#ffd0f0" stroke="${ink("#c47dff")}" stroke-width="2" paint-order="stroke">z</text><text x="102" y="28" font-family="Arial Black,Arial" font-weight="900" font-size="8" fill="#ffd0f0" stroke="${ink("#c47dff")}" stroke-width="1.6" paint-order="stroke">z</text>`
        : [[44, 66, 20], [76, 60, -20], [60, 84, 0]].map(([x, y, a]) => `<g transform="rotate(${a + 160} ${x} ${y})">${P(`M${x} ${y} Q${x + 6} ${y + 8} ${x} ${y + 14} Q${x - 6} ${y + 8} ${x} ${y}Z`, X.lg("#9fd06a", "#e86aa8"), ink("#6a9a3a"), 1.4)}</g>`).join(""),
      item: X => stem("M60 132 Q56 112 60 96", 3) + leaf(X, 59, 120, 22, -150, 6) + leaf(X, 60, 114, 22, -30, 6, 1) + poppy(X, 60, 70, 32, "#ff6fae") + `<text x="88" y="34" font-family="Arial Black,Arial" font-weight="900" font-size="16" fill="#ffd0f0" stroke="${ink("#c47dff")}" stroke-width="2.4" paint-order="stroke">z</text>`,
    },
    melon: {
      sp: "round",
      fol: X => lobedLeaf(X, 24, 114, 15, 1) + lobedLeaf(X, 96, 114, 15) + lobedLeaf(X, 38, 96, 12) + lobedLeaf(X, 84, 98, 12, 1) + `<path d="M18 126 Q40 114 60 122 Q80 130 102 116" stroke="#4f9a36" stroke-width="3" fill="none" stroke-linecap="round"/>` + tendril(100, 102) + tendril(18, 100, -1),
      prod: (X, r) => r ? melon(X, 60, 111, 34, 23, "#3f9a3a", "#e8ff7a") + facePatch(60, 110, 1.2, "#8fd65f") + face(60, 110, 1.2, "open") : melon(X, 60, 120, 16, 11, "#9cd06a", "#e8ffc0"),
      item: X => lobedLeaf(X, 76, 40, 16, 1) + line("M64 48 q2 -8 8 -10", "#6a8a2a", 3.4) + melon(X, 60, 92, 46, 38, "#3f9a3a", "#e8ff7a") + facePatch(60, 92, 1.7, "#8fd65f") + face(60, 92, 1.7, "open"),
    },
    orange: {
      sp: "tree",
      fol: X => trunk("M60 132 Q58 108 60 90 M60 104 Q68 96 76 86 M60 98 Q52 92 46 84") + bush(X, [[60, 60, 26], [36, 72, 19], [84, 72, 19], [46, 48, 18], [74, 48, 18], [60, 80, 18]], "#86d05a", "#2f7a32"),
      prod: (X, r) => (r ? [[42, 70], [58, 54], [76, 62], [50, 84], [70, 84], [86, 76], [62, 70]] : [[46, 72], [62, 58], [76, 76], [54, 86]]).map(([x, y]) => ball(X, x, y, r ? 7.2 : 4.2, r ? "#ffad1f" : "#a6d66a", 1.6) + (r ? `<circle cx="${x + 2}" cy="${y + 2}" r=".8" fill="#e07a0f"/><circle cx="${x - 2}" cy="${y + 3}" r=".8" fill="#e07a0f"/>` : "")).join(""),
      item: X => flamePetal(X, 64, 46, 30, 10, 28, "#ffe36a", "#ff5a1f") + ball(X, 60, 86, 38, "#ffad1f", 2.4) + [[70, 98], [52, 104], [78, 82], [46, 90]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.4" fill="#e07a0f"/>`).join("") + line("M60 50 v-6", "#7a5230", 3),
    },
    pearl: {
      sp: "leaf",
      fol: X => P("M74 132 L74 34 L79 34 L79 132Z", X.lg("#e8d29a", "#b8954a"), ink("#b8954a"), 1.4) + `<path d="M74 60 h5 M74 90 h5" stroke="${ink("#b8954a")}" stroke-width="1.2"/>` + stem("M60 132 Q78 110 64 92 Q52 76 74 58 Q82 50 76 38", 2.6) + [[62, 114, -160], [68, 96, -20], [58, 82, -170], [76, 64, -10], [70, 50, -150]].map(([x, y, a], k) => leaf(X, x, y, 18, a, 6.4, k % 2)).join("") + tendril(80, 76) + tendril(56, 60, -1),
      prod: (X, r) => r ? pod(X, 44, 98, 36, -24, 1, "#eef5ff") + pod(X, 92, 86, 32, 26, 1, "#eef5ff") + pod(X, 50, 64, 30, -10, 1, "#eef5ff") : pod(X, 48, 98, 18, -24, 0) + pod(X, 88, 88, 16, 26, 0),
      item: X => pod(X, 60, 84, 96, -14, 1, "#eef5ff") + star4(92, 52, 5),
    },
    halotea: {
      sp: "leaf",
      fol: X => bush(X, [[60, 96, 26], [36, 108, 18], [84, 108, 18], [46, 84, 16], [74, 84, 16], [60, 116, 18]], "#c9f07a", "#4f8f2e"),
      prod: (X, r) => [[44, 80, -120], [60, 72, -90], [76, 80, -60]].map(([x, y, a]) => leaf(X, x, y, 12, a, 4.6, ["#f4ffd0", "#9fdc4a"])).join("") + (r ? `<circle cx="60" cy="50" r="26" fill="${X.glow("#fff1a8")}"/>` + halo(60, 50, 22) : ""),
      item: X => `<circle cx="60" cy="40" r="34" fill="${X.glow("#fff1a8")}"/>` + leaf(X, 60, 128, 64, -112, 15, ["#e8ffb0", "#5fae32"]) + leaf(X, 60, 128, 56, -70, 14, ["#d6f59a", "#4a9a2e"]) + leaf(X, 60, 128, 44, -140, 11, ["#c9f07a", "#4f8f2e"]) + halo(60, 34, 28),
    },
    cotton: {
      sp: "leaf",
      fol: X => { const C = "#7a5a6a"; return line("M60 132 L60 78", C, 3.4) + line("M60 110 L40 88", C, 2.6) + line("M60 100 L80 80", C, 2.6) + line("M60 118 L48 104", C, 2.2) + line("M60 112 L74 100", C, 2.2) + [[60, 120, -165], [60, 116, -15], [44, 104, -150], [76, 98, -30]].map(([x, y, a], k) => leaf(X, x, y, 16, a, 5.6, k % 2 ? ["#a8d88a", "#4a7a5a"] : ["#b9e08f", "#5a8a52"])).join(""); },
      prod: (X, r) => r ? cottonPuff(X, 40, 86, .95) + cottonPuff(X, 80, 78, .95) + cottonPuff(X, 50, 104, .8) + cottonPuff(X, 72, 100, .8) + cottonPuff(X, 60, 68, 1.2, "sleepy")
        : [[40, 88], [80, 80], [60, 72]].map(([x, y]) => P(`M${x} ${y - 9} Q${x + 7} ${y} ${x} ${y + 7} Q${x - 7} ${y} ${x} ${y - 9}Z`, X.lg("#b9e08f", "#4a7a3a"), ink("#4a7a3a"), 1.4)).join(""),
      item: X => cottonPuff(X, 60, 74, 3.4, "sleepy"),
    },
    ginseng: {
      sp: "leaf",
      fol: (X, r) => stem("M60 132 Q58 100 60 76", 2.8) + line("M60 84 Q46 74 40 64", "#5fae43", 2.2) + line("M60 84 Q74 74 80 64", "#5fae43", 2.2) + palm(X, 40, 66, .9) + palm(X, 80, 66, .9) + palm(X, 60, 78, 1) + (r ? [[58, 52], [62, 49], [56, 47], [60, 45], [64, 52], [54, 52]].map(([x, y]) => ball(X, x, y, 3.2, "#ff3a40", 1)).join("") : ""),
      prod: (X, r) => r ? ginsengBody(X, 60, 112, 1.1, "open") + mound(60, 38, 9) : P("M52 130 Q52 118 60 118 Q68 118 68 130Z", X.rg("#f3d7a6"), ink("#e3b778"), 1.6) + mound(60, 28, 7),
      item: X => palm(X, 60, 36, 1.05) + [[58, 22], [63, 19], [55, 17], [60, 14], [66, 22]].map(([x, y]) => ball(X, x, y, 3.4, "#ff3a40", 1)).join("") + stem("M60 46 L60 36", 2.4) + ginsengBody(X, 60, 76, 1.7, "open", 1),
    },
    starfruit: {
      sp: "leaf",
      fol: X => bush(X, [[60, 98, 24], [38, 110, 17], [82, 110, 17], [48, 86, 15], [72, 86, 15], [60, 118, 17]], "#9ee06a", "#2f7a3a"),
      prod: (X, r) => r ? RAINBOW + [[42, 92, .1], [78, 90, -.1], [60, 72, 0], [60, 106, .2]].map(([x, y, a]) => starFruit(X, x, y, 10.5, a)).join("") : [[44, 96], [76, 94], [60, 80]].map(([x, y]) => P(starPath(x, y, 6, 3.2), "#a8dc7a", ink("#5a9a3a"), 1.2)).join(""),
      item: X => `<path d="M8 104 A52 52 0 0 1 112 104" stroke="#ff8a8a" stroke-width="5" fill="none" opacity=".6"/><path d="M15 104 A45 45 0 0 1 105 104" stroke="#ffe27a" stroke-width="5" fill="none" opacity=".6"/><path d="M22 104 A38 38 0 0 1 98 104" stroke="#8ac8ff" stroke-width="5" fill="none" opacity=".6"/>` + starFruit(X, 60, 86, 40, .05) + leaf(X, 62, 44, 18, -40, 7, 1),
    },
    boltcorn: {
      sp: "blade",
      fol: X => line("M60 132 L60 22", "#4c9a36", 5.6) + [[60, 112, -150, 40], [60, 98, -30, 40], [60, 78, -142, 36], [60, 62, -38, 34], [60, 44, -125, 28], [60, 34, -58, 24]].map(([x, y, a, l], i) => leaf(X, x, y, l, a, 5, i % 2)).join("") + `<path d="M60 22 l-6 -10 M60 22 l0 -12 M60 22 l6 -10" stroke="#e8c070" stroke-width="2" stroke-linecap="round"/>`,
      prod: (X, r) => r ? cob(X, 48, 80, 1, -16, 1) + cob(X, 72, 68, 1, 16, 1) : cob(X, 50, 82, .62, -16, 0) + cob(X, 70, 72, .62, 16, 0),
      item: X => cob(X, 44, 78, 2.1, -18, 1) + cob(X, 76, 78, 2.1, 18, 1),
    },
    emberlily: {
      sp: "leaf",
      fol: X => stem("M60 132 Q56 100 60 64", 3.4) + leaf(X, 58, 130, 48, -118, 5, ["#a6e070", "#2f7a32"]) + leaf(X, 62, 130, 46, -62, 5, 1) + leaf(X, 58, 130, 34, -146, 4.5) + leaf(X, 62, 130, 34, -34, 4.5, ["#a6e070", "#2f7a32"]),
      prod: (X, r) => r ? `<circle cx="60" cy="54" r="40" fill="${X.glow("#ff9a4f")}"/>` + [150, 210, 90, 270, 30, 330].map(a => flamePetal(X, 60, 58, 30, 10, a, "#ffe36a", "#ff5a1f")).join("") + [[-14, -18], [-6, -24], [4, -25], [13, -19]].map(([dx, dy]) => `<path d="M60 58 Q${60 + dx * .4} ${58 + dy * .5} ${60 + dx} ${58 + dy}" stroke="#ffd0a0" stroke-width="1.4" fill="none"/><circle cx="${60 + dx}" cy="${58 + dy}" r="2.4" fill="#fff3a0" stroke="${ink("#ff8a1a")}" stroke-width=".9"/>`).join("") + `<circle cx="60" cy="58" r="5" fill="${X.rg("#ffd65b")}" stroke="${ink("#ff8a1a")}" stroke-width="1.2"/>`
        : P("M60 36 Q70 52 64 66 L56 66 Q50 52 60 36Z", X.lg("#ffb070", "#7fbf4a"), ink("#6a9a3a"), 1.6),
      item: X => `<circle cx="60" cy="70" r="54" fill="${X.glow("#ff9a4f")}"/>` + [150, 210, 90, 270, 30, 330].map(a => flamePetal(X, 60, 74, 52, 17, a, "#ffe36a", "#ff5a1f")).join("") + [[-24, -30], [-10, -40], [8, -41], [22, -32]].map(([dx, dy]) => `<path d="M60 74 Q${60 + dx * .4} ${74 + dy * .5} ${60 + dx} ${74 + dy}" stroke="#ffd0a0" stroke-width="2" fill="none"/><circle cx="${60 + dx}" cy="${74 + dy}" r="3.8" fill="#fff3a0" stroke="${ink("#ff8a1a")}" stroke-width="1.2"/>`).join("") + `<circle cx="60" cy="74" r="8" fill="${X.rg("#ffd65b")}" stroke="${ink("#ff8a1a")}" stroke-width="1.6"/>`,
    },
    dreamshroom: {
      sp: "cap",
      fol: X => leaf(X, 36, 132, 14, -124, 3.4) + leaf(X, 84, 132, 14, -56, 3.4, 1) + [[26, 124], [96, 120], [88, 130]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#bff3ff"/>`).join(""),
      young: X => mushroom(X, 60, 116, 12, 13, "#c9b6f0", null, "#eef0ff"),
      prod: (X, r) => r ? `<circle cx="60" cy="74" r="46" fill="${X.glow("#9fe8ff")}"/>` + P("M50 132 Q46 112 52 98 L68 98 Q74 112 70 132Z", X.lg("#f6f0ff", "#c9b6f0"), ink("#c9b6f0"), 1.8) + whale(X, 58, 92, .95, "#c9a3ff", "#4fd6ff") + star4(80, 40, 4.4, "#e8fbff") + star4(70, 32, 3, "#fff") + `<circle cx="88" cy="52" r="2.4" fill="none" stroke="#e8fbff" stroke-width="1.2"/>`
        : mushroom(X, 60, 108, 18, 20, "#c9b6f0", null, "#eef0ff"),
      item: X => `<circle cx="60" cy="70" r="54" fill="${X.glow("#9fe8ff")}"/>` + P("M50 132 Q44 112 52 100 L70 100 Q76 112 70 132Z", X.lg("#f6f0ff", "#c9b6f0"), ink("#c9b6f0"), 2) + whale(X, 56, 90, 1.25, "#c9a3ff", "#4fd6ff") + star4(90, 30, 6, "#e8fbff") + star4(76, 22, 4, "#fff"),
    },
  };
  const RAINBOW = `<path d="M14 92 A46 46 0 0 1 106 92" stroke="#ff8a8a" stroke-width="3" fill="none" opacity=".75"/><path d="M19 92 A41 41 0 0 1 101 92" stroke="#ffe27a" stroke-width="3" fill="none" opacity=".75"/><path d="M24 92 A36 36 0 0 1 96 92" stroke="#8ae0a0" stroke-width="3" fill="none" opacity=".75"/><path d="M29 92 A31 31 0 0 1 91 92" stroke="#8ac8ff" stroke-width="3" fill="none" opacity=".75"/>`;
  // wheat stalks: [base x, top x, top y]
  const WHEAT = [[48, 26, 64], [52, 38, 54], [56, 50, 46], [60, 60, 42], [64, 70, 46], [68, 82, 54], [72, 94, 64]];

  const SPROUT = {
    leaf: X => stem("M60 132 Q59 124 60 117", 2.6) + leaf(X, 60, 118, 15, -152, 7.2) + leaf(X, 60, 118, 15, -28, 7.2, 1),
    round: X => stem("M60 132 Q59 125 60 119", 2.8) + `<ellipse cx="51" cy="116" rx="9" ry="6.5" transform="rotate(-18 51 116)" fill="${X.lg("#b9ef7d", "#4aa43f")}" stroke="${ink("#4aa43f")}" stroke-width="1.6"/><ellipse cx="69" cy="116" rx="9" ry="6.5" transform="rotate(18 69 116)" fill="${X.lg("#93d95f", "#2f8636")}" stroke="${ink("#2f8636")}" stroke-width="1.6"/>`,
    blade: X => leaf(X, 57, 132, 22, -104, 3.2) + leaf(X, 60, 132, 27, -84, 3.2, 1) + leaf(X, 63, 132, 19, -62, 3.2),
    frond: X => line("M54 132 Q46 122 54 114 Q60 108 54 102", "#4fd0a0", 4.2) + line("M66 132 Q74 124 66 116", "#2aa58a", 4.2),
    pad: X => `<ellipse cx="60" cy="127" rx="26" ry="6.5" fill="${X.lg("#9fe0ff", "#2f86d0")}" stroke="${ink("#2f86d0")}" stroke-width="1.4" opacity=".9"/>` + pad(X, 56, 125, 11, 4.4) + P("M66 112 Q70 118 66 124 Q62 118 66 112Z", X.lg("#ffd0e8", "#8fc46a"), ink("#8fc46a"), 1.2),
    cap: (X, c) => mushroom(X, 60, 124, 7, 7, mix(c.c, "#ffffff", .45), null, "#ffffff"),
    nub: X => `<ellipse cx="60" cy="124" rx="8" ry="9" fill="${X.lg("#9ee07a", "#3f9a46")}" stroke="${ink("#3f9a46")}" stroke-width="1.6"/><path d="M56 120 l-2 -2 M64 122 l2 -2 M60 117 v-3" stroke="#fff" stroke-width="1" stroke-linecap="round"/>`,
    crystal: X => leaf(X, 60, 126, 13, -150, 6) + leaf(X, 60, 126, 13, -30, 6, 1) + crystal(X, 60, 132, 6, 11, 0, "#c3adff"),
    tree: X => line("M60 132 Q59 122 60 110", "#8a5a32", 2.8) + leaf(X, 60, 112, 13, -150, 6) + leaf(X, 60, 112, 13, -30, 6, 1) + leaf(X, 60, 110, 11, -90, 5),
  };

  const wrap = (X, body) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 140" width="240" height="280"><defs>${X.defs.join("")}</defs>${body}</svg>`;
  const at = (s, body) => `<g transform="translate(60 132) scale(${s}) translate(-60 -132)">${body}</g>`;

  function field(c, st) {
    const d = D[c.id], X = Ctx(); let b = "";
    if (!d) return wrap(X, "");
    if (st === 0) {
      b = mound(60, 22, 10) + [[53, 124, -20], [66, 125, 25]].map(([x, y, a]) => `<ellipse cx="${x}" cy="${y}" rx="3.6" ry="2.6" transform="rotate(${a} ${x} ${y})" fill="${X.rg(c.c2)}" stroke="${ink(c.c2)}" stroke-width="1.1"/>`).join("") + star4(72, 116, 3.2, "#fff6c2");
    } else if (st === 1) b = shadow(16) + SPROUT[d.sp](X, c);
    else if (st === 2) b = shadow(22) + (d.young ? d.young(X) : at(.72, d.fol(X, 0)));
    else {
      const ripe = st === 4;
      b = shadow(32) + d.fol(X, ripe ? 1 : 0) + d.prod(X, ripe ? 1 : 0);
      if (ripe) b += (FX[c.el] ? FX[c.el](X) : "") + star4(100, 24, 4.2);
    }
    return wrap(X, b);
  }
  function item(c) { const d = D[c.id], X = Ctx(); return wrap(X, d ? d.item(X) : ""); }
  return { field, item, has: id => !!D[id] };
})();

// Front-view champion art in the same idiom as apps/client/src/creature-design.ts:
// a 200x190 canvas centred on x = 100, chibi FACE/FRAME transforms, a five-colour
// palette turned into body/face/pearl/jewel/shine gradients, dark outlines.
const PALETTES = {
  coilemur: { light: "#f7f3ea", mid: "#a9a6bd", dark: "#2c2840", glow: "#ffd84a", accent: "#d9823b" },
  pyranda: { light: "#ffe0c4", mid: "#d9572b", dark: "#4a1a12", glow: "#ffcf4d", accent: "#fbf3e6" },
  glacelle: { light: "#f4feff", mid: "#9fe8ff", dark: "#1d4f7a", glow: "#ff9a6b", accent: "#d9f6ff" },
  halcyra: { light: "#e8eeff", mid: "#6f8dff", dark: "#1c2456", glow: "#c9f4ff", accent: "#ff9a4a" },
  sunbara: { light: "#fff1d6", mid: "#c98f52", dark: "#4a2e18", glow: "#ffe066", accent: "#ffb732" },
  astrabun: { light: "#ffffff", mid: "#e3c8ff", dark: "#4b2a6b", glow: "#ffe9a3", accent: "#8a5cff" },
  wombolder: { light: "#efdcc0", mid: "#b08a62", dark: "#3e2a1a", glow: "#9bd36a", accent: "#8b8f99" },
  shadopus: { light: "#e9e0ff", mid: "#7b5cff", dark: "#1a1240", glow: "#ff6bd6", accent: "#120b26" },
};
const FACE = { s: 1.17, cx: 100, cy: 118 },
  FRAME = { s: 0.86, cx: 100, cy: 172 };
const PROP = {
  tail: FRAME, wings: FRAME, legL: FRAME, legR: FRAME, body: FRAME, armL: FRAME, armR: FRAME,
  head: FACE, ears: FACE, eyes: FACE, flame: FACE, scarf: FRAME,
};
const ORDER_LOW = ["tail", "wings", "legL", "legR", "body", "armL", "armR"];
const ORDER_FACE = ["head", "ears", "eyes", "flame"];
const INK = "#1b1636";

export function championSvg(id, opts = {}) {
  const p = PALETTES[id];
  const pre = `${id}-${opts.key ?? "a"}`;
  const body = `url(#${pre}-body)`, face = `url(#${pre}-face)`, pearl = `url(#${pre}-pearl)`,
    jewel = `url(#${pre}-jewel)`, shine = `url(#${pre}-shine)`;
  const defs = `<defs>
    <radialGradient id="${pre}-body" cx="30%" cy="18%" r="95%"><stop stop-color="${p.light}"/><stop offset=".42" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${pre}-face" cx="34%" cy="22%" r="85%"><stop stop-color="${p.light}"/><stop offset=".62" stop-color="${p.mid}"/><stop offset="1" stop-color="${p.dark}"/></radialGradient>
    <radialGradient id="${pre}-pearl" cx="32%" cy="15%"><stop stop-color="#ffffff"/><stop offset=".55" stop-color="${p.light}"/><stop offset="1" stop-color="${p.mid}"/></radialGradient>
    <linearGradient id="${pre}-jewel" x2=".8" y2="1"><stop stop-color="#ffffff"/><stop offset=".3" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.mid}"/></linearGradient>
    <radialGradient id="${pre}-shine"><stop stop-color="#ffffff"/><stop offset=".35" stop-color="${p.glow}"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
  </defs>`;
  const path = (d, fill, extra = "") => `<path d="${d}" fill="${fill}"${extra}/>`;
  const line = (d, color, w = 2.2, o = 1) =>
    `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"${o < 1 ? ` opacity="${o}"` : ""}/>`;
  const e = (x, y, rx, ry, fill = body, extra = "") => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${extra}/>`;
  const sparkle = (x, y, r, c = "#ffffff") =>
    path(`M${x} ${y - r}Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y}Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r}Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y}Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z`, c, ' stroke="none"');
  const highlight = (x, y, w) =>
    `<path d="M${x} ${y}Q${x + w / 2} ${y - w * 0.32} ${x + w} ${y - w * 0.12}" stroke="#ffffff" stroke-width="3.5" stroke-linecap="round" opacity=".55" fill="none"/>`;
  const paw = (x, y, w = 14, fill = body) =>
    `<path d="M${x - 9} ${y - 18}Q${x - 14} ${y - 4} ${x - w} ${y + 3}Q${x} ${y + 12} ${x + w} ${y + 3}Q${x + 14} ${y - 4} ${x + 9} ${y - 18}Z" fill="${fill}"/>${e(x, y + 4, w, 7, fill)}<path d="M${x - 6} ${y + 7}V${y + 10}M${x} ${y + 7}V${y + 11}M${x + 6} ${y + 7}V${y + 10}" stroke="${p.dark}" stroke-width="1.6" opacity=".5"/>`;
  const hand = (x, fill = body) => `${e(x, 138, 9, 17, fill)}${e(x, 151, 10, 7, fill)}`;
  const eye = (x, ring = p.glow, w0 = 9, h0 = 11, y = 93) => {
    const w = w0 * 1.3, h = h0 * 1.22;
    return `${e(x, y, w, h, INK)}${e(x, y + h * 0.3, w * 0.74, h * 0.52, ring)}${e(x, y + h * 0.22, w * 0.42, h * 0.4, INK)}${e(x - w * 0.3, y - h * 0.36, w * 0.44, h * 0.38, "#ffffff")}<circle cx="${x + w * 0.38}" cy="${y + h * 0.34}" r="${w * 0.17}" fill="#fff"/><circle cx="${x + w * 0.42}" cy="${y - h * 0.5}" r="${w * 0.09}" fill="#fff"/>`;
  };
  const eyes = (ring, w, h) => eye(79, ring, w, h) + eye(121, ring, w, h);
  const lookEye = (x, ring, w0, h0, dx, dy, y = 93) => {
    const w = w0 * 1.3, h = h0 * 1.22, cx = x + dx * w, cy = y + dy * h;
    return `${e(x, y, w, h, INK)}${e(cx, cy + h * 0.2, w * 0.66, h * 0.48, ring)}${e(cx, cy + h * 0.14, w * 0.38, h * 0.36, INK)}${e(x - w * 0.28, y - h * 0.38, w * 0.4, h * 0.34, "#ffffff")}<circle cx="${(x + w * 0.4).toFixed(1)}" cy="${(y + h * 0.36).toFixed(1)}" r="${(w * 0.15).toFixed(1)}" fill="#fff"/>`;
  };
  const strokeP = (d, c = p.dark, w = 1.9) => `<path d="${d}" stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const mouth = `<path d="M95.5 109Q97.8 112 100 109.6Q102.2 112 104.5 109" stroke="${p.dark}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
  const blush = (y = 108, dx = 32) => `${e(100 - dx, y, 8, 4.5, "#ff8fb0", ' opacity=".5" stroke="none"')}${e(100 + dx, y, 8, 4.5, "#ff8fb0", ' opacity=".5" stroke="none"')}`;
  const L = {
    tail: "", wings: "", legL: paw(80, 160), legR: paw(120, 160),
    body: `${e(100, 138, 30, 28)}${e(100, 143, 18, 19, pearl)}${highlight(80, 124, 18)}`,
    armL: hand(67), armR: hand(133),
    head: `${e(100, 88, 40, 33, face)}${highlight(72, 70, 26)}${mouth}${blush()}`,
    ears: "", eyes: eyes(), flame: "", scarf: "",
  };

  if (id === "coilemur") {
    // Ring-tailed lemur: pointed ears, white face mask with dark eye patches, a
    // copper-banded electromagnet tail, coil bracers and a horseshoe-magnet clip.
    const ear = (d) => {
      const x = (v) => 100 + d * v;
      return `${path(`M${x(22)} 66Q${x(30)} 34 ${x(50)} 28Q${x(52)} 50 ${x(40)} 72Z`, body)}${path(`M${x(28)} 64Q${x(34)} 42 ${x(46)} 36Q${x(46)} 52 ${x(38)} 66Z`, p.light, ' stroke="none"')}`;
    };
    L.ears = ear(-1) + ear(1);
    L.head = `${e(100, 88, 41, 33, face)}${path("M62 92Q66 66 100 64Q134 66 138 92Q132 116 100 120Q68 116 62 92Z", p.light, ' stroke="none"')}${e(79, 94, 16, 15, p.dark, ' opacity=".85" stroke="none" transform="rotate(-18 79 94)"')}${e(121, 94, 16, 15, p.dark, ' opacity=".85" stroke="none" transform="rotate(18 121 94)"')}${path("M96 102L104 102L100 107Z", INK, ' stroke="none"')}${highlight(70, 74, 18)}${strokeP("M93.5 108Q100 112.5 106.5 107.5")}${path("M101.5 109.6Q103 116.5 107.4 113Q108.4 110 106 108.6Z", "#ff7d9c", ` stroke="${p.dark}" stroke-width="1.3"`)}${blush(110, 30)}`;
    L.eyes = lookEye(79, "#ffb02e", 8.5, 10, 0.26, -0.05) + lookEye(121, "#ffb02e", 8.5, 10, 0.26, -0.05);
    L.flame = `${path("M118 52Q118 40 128 40Q138 40 138 52L133 52Q133 45 128 45Q123 45 123 52Z", "#e8473f")}${path("M118 52H123V56H118ZM133 52H138V56H133Z", "#e6ecf5")}${sparkle(142, 40, 4, p.glow)}`;
    const tail = "M124 152Q160 156 166 128Q170 104 152 92Q140 82 150 64Q158 50 176 52";
    L.tail = `${line(tail, p.dark, 22)}${line(tail, p.mid, 17.5)}<path d="${tail}" fill="none" stroke="${p.accent}" stroke-width="17.5" stroke-dasharray="9 9" stroke-linecap="butt"/>${line(tail, "#ffffff", 3, 0.35)}<circle cx="176" cy="52" r="15" fill="${shine}" stroke="none"/>${sparkle(176, 52, 6, "#ffffff")}${line("M170 36L174 44L168 46L172 54", p.glow, 2.2, 0.9)}`;
    L.body = `${e(100, 138, 29, 28)}${e(100, 144, 18, 18, pearl)}${highlight(80, 124, 16)}`;
    const coil = (x) => `${hand(x)}${[136, 142, 148].map((y) => e(x, y, 10.5, 2.6, p.accent, ` stroke="${p.dark}" stroke-width="1.2"`)).join("")}${e(x, 156, 7, 3.5, p.dark, ' opacity=".55" stroke="none"')}`;
    L.armL = coil(67);
    L.armR = coil(133);
    L.legL = paw(80, 160, 14);
    L.legR = paw(120, 160, 14);
  }

  // ---- Pyranda's shy face pieces.
  const shyMouth = (y = 110.5) => strokeP(`M93.5 ${y}Q96 ${y - 2.5} 98.5 ${y}Q101 ${y + 2.5} 103.5 ${y}Q105.5 ${y - 2} 107 ${y - 0.5}`);
  const shyCheeks = `${blush(108, 31)}${line("M62 104l3-3.5M66 105l3-3.5M134 105l3-3.5M138 104l3-3.5", "#ff6f6f", 1.6, 0.8)}${path("M140 66Q146 74 143 79Q138 82 135.5 77.5Q135 72 140 66Z", "#bfeaff", ` stroke="${p.dark}" stroke-width="1.2"`)}`;
  const shyEyes = (ring, brows = true) => lookEye(79, ring, 9, 11, -0.18, 0.18) + lookEye(121, ring, 9, 11, -0.18, 0.18) + (brows ? strokeP("M67 79Q75 78.5 84 74.5M133 79Q125 78.5 116 74.5", p.dark, 2.6) : "");
  const flameTip = (x, y, r = 9) => `<circle cx="${x}" cy="${y}" r="${r * 1.6}" fill="${shine}" stroke="none" opacity=".8"/>${path(`M${x - r * 0.7} ${y + r * 0.5}Q${x - r} ${y - r * 0.6} ${x} ${y - r * 1.6}Q${x + r * 0.2} ${y - r * 0.6} ${x + r * 0.7} ${y - r * 0.9}Q${x + r} ${y} ${x + r * 0.7} ${y + r * 0.5}Q${x} ${y + r} ${x - r * 0.7} ${y + r * 0.5}Z`, jewel)}${path(`M${x - r * 0.3} ${y + r * 0.4}Q${x - r * 0.4} ${y - r * 0.3} ${x} ${y - r * 0.8}Q${x + r * 0.4} ${y - r * 0.2} ${x + r * 0.3} ${y + r * 0.4}Z`, "#fff3b8", ' stroke="none"')}`;

  if (id === "pyranda") {
    // Red panda, the "fire fox": white-rimmed ears, white brow spots tipped up
    // (shy), tear marks, dark legs and belly, a fluffy tail with a flame tip,
    // and a bandolier of glowing chestnuts it lobs as mortars.
    const ear = (d) => {
      const x = (v) => 100 + d * v;
      return `${path(`M${x(20)} 68Q${x(22)} 36 ${x(42)} 32Q${x(56)} 44 ${x(44)} 72Z`, p.accent)}${path(`M${x(26)} 66Q${x(28)} 44 ${x(41)} 41Q${x(49)} 50 ${x(41)} 68Z`, "#8a2a14", ' stroke="none"')}`;
    };
    L.ears = ear(-1) + ear(1);
    L.head = `${e(100, 88, 41, 33, face)}${path("M78 101Q80 92 91 94Q100 97 109 94Q120 92 122 101Q120 116 100 118Q80 116 78 101Z", p.accent, ' stroke="none"')}${e(77, 74, 7.5, 4.2, p.accent, ' stroke="none" transform="rotate(16 77 74)"')}${e(123, 74, 7.5, 4.2, p.accent, ' stroke="none" transform="rotate(-16 123 74)"')}${line("M69 100Q71 111 78 116M131 100Q129 111 122 116", "#8a2a14", 4, 0.5)}${path("M96 102H104L100 106Z", INK, ' stroke="none"')}${highlight(68, 72, 22)}${shyMouth(111)}${shyCheeks}`;
    L.eyes = shyEyes("#ffb84d", false);
    L.body = `${e(100, 138, 30, 28)}${e(100, 144, 17, 18, "#5a2216")}${highlight(80, 124, 16)}`;
    const dark = "#4a1a12";
    L.armL = hand(67, dark);
    L.armR = `${path("M134 132Q134 120 143 118Q152 120 152 130Q150 138 143 138Q136 138 134 132Z", "#8a4a22")}${e(143, 121, 7, 3, "#c98a52")}${flameTip(143, 110, 6)}${hand(133, dark)}`;
    L.legL = paw(80, 160, 14, dark);
    L.legR = paw(120, 160, 14, dark);
    L.tail = `${path("M122 152Q160 160 172 132Q180 108 164 92Q156 86 150 94Q162 104 158 120Q152 140 120 140Z", body)}${line("M150 140Q160 136 168 128M158 118Q166 114 174 114", "#8a2a14", 6, 0.35)}${flameTip(157, 88, 10)}`;
    L.scarf = `${line("M72 120L128 158", "#6b3a1e", 6)}${[0.3, 0.55, 0.8].map((t) => { const x = 72 + 56 * t, y = 120 + 38 * t; return `${e(x, y, 4.5, 4.5, "#8a4a22")}${e(x, y - 1, 1.8, 1.8, p.glow, ' stroke="none"')}`; }).join("")}`;
  }

  if (id === "glacelle") {
    // Sea angel: a translucent floating body with a glowing orange heart, two
    // frosted wing-flaps, little ice horns and drifting snow crystals.
    L.legL = "";
    L.legR = "";
    L.ears = `${path("M76 60L70 34L86 54Z", jewel)}${path("M124 60L130 34L114 54Z", jewel)}${line("M72 40L78 50M128 40L122 50", "#ffffff", 1.4, 0.8)}`;
    const frost = (x, y) => line(`M${x - 2.4} ${y}H${x + 2.4}M${x} ${y - 2.4}V${y + 2.4}`, "#ffffff", 1.3, 0.9);
    L.head = `${e(100, 88, 39, 34, face, ' fill-opacity=".93"')}${highlight(70, 72, 24)}${strokeP("M96.5 109.5Q100 112.6 103.5 109.5")}${blush(108, 30)}${frost(66, 103)}${frost(71, 109)}${frost(134, 103)}${frost(129, 109)}`;
    const iceLashes = (x, k) => strokeP(`M${x - k * 12} 84l${-k * 4} -3.5M${x - k * 9} 80.5l${-k * 3} -4.2M${x - k * 5} 78.5l${-k * 1.5} -4.6`, "#e9fbff", 2.2);
    L.eyes = eyes("#43c6ff", 9.5, 11.5) + iceLashes(79, 1) + iceLashes(121, -1) + path("M86 86l2 3l-2 3l-2 -3Z", "#e9fbff", ' stroke="none"') + path("M128 86l2 3l-2 3l-2 -3Z", "#e9fbff", ' stroke="none"');
    L.body = `${path("M72 120Q100 110 128 120Q134 146 116 166Q106 178 100 186Q94 178 84 166Q66 146 72 120Z", body, ' fill-opacity=".9"')}${e(100, 140, 9, 11, `url(#${pre}-heart)`, ' stroke="none"')}<circle cx="100" cy="140" r="17" fill="url(#${pre}-heartglow)" stroke="none"/>${line("M86 128Q84 146 92 162M114 128Q116 146 108 162", "#ffffff", 1.6, 0.45)}`;
    const flap = (d) => {
      const x = (v) => 100 + d * v;
      return `${path(`M${x(26)} 126Q${x(52)} 104 ${x(64)} 118Q${x(70)} 132 ${x(54)} 146Q${x(40)} 150 ${x(26)} 140Z`, jewel, ' fill-opacity=".85"')}${line(`M${x(30)} 132Q${x(46)} 124 ${x(58)} 124`, "#ffffff", 1.5, 0.75)}${sparkle(x(54), 132, 3, "#ffffff")}`;
    };
    L.armL = flap(-1);
    L.armR = flap(1);
    const flake = (x, y, r) => `<g opacity=".9">${line(`M${x - r} ${y}H${x + r}M${x - r * 0.5} ${y - r * 0.86}L${x + r * 0.5} ${y + r * 0.86}M${x - r * 0.5} ${y + r * 0.86}L${x + r * 0.5} ${y - r * 0.86}`, "#e8fbff", 1.6)}</g>`;
    L.wings = `${flake(40, 96, 6)}${flake(164, 80, 5)}${flake(156, 150, 4)}${flake(44, 156, 4)}`;
    L.flame = `${path("M88 58Q100 46 112 58Q106 54 100 56Q94 54 88 58Z", "#ffffff", ' opacity=".9" stroke="none"')}`;
  }

  if (id === "halcyra") {
    // Kingfisher marksman: swept crest, long crystal beak, white cheek flashes,
    // orange chest, feathered wing-arms, small orange feet, focusing visor gem.
    L.ears = `${path("M70 62Q60 46 70 34Q78 48 84 52Q82 36 94 26Q98 44 104 50Q110 34 124 32Q118 50 126 60Z", body)}${line("M76 54Q78 46 76 40M96 46Q98 38 96 32M114 50Q118 42 120 36", p.light, 1.6, 0.6)}`;
    L.head = `${e(100, 88, 41, 33, face)}${path("M60 98Q64 112 78 116Q70 106 72 98Z", "#ffffff", ' stroke="none"')}${path("M140 98Q136 112 122 116Q130 106 128 98Z", "#ffffff", ' stroke="none"')}${highlight(70, 72, 24)}${blush(108, 31)}`;
    L.eyes = eyes(p.glow, 8.5, 10.5) + strokeP("M67 79.5L87 80.8M133 79.5L113 80.8", p.dark, 2.8) + `<circle cx="121" cy="93" r="17" fill="none" stroke="${p.glow}" stroke-width="2.6"/><circle cx="121" cy="93" r="17" fill="none" stroke="#ffffff" stroke-width="1" opacity=".7" stroke-dasharray="6 30"/>` + strokeP("M137 98Q144 104 140 111", p.glow, 1.6);
    L.flame = `${path("M92 100L108 100L100 136Z", jewel)}${line("M100 102V132", "#ffffff", 1.6, 0.8)}${path("M92 100Q100 96 108 100Q100 104 92 100Z", p.dark, ' opacity=".5" stroke="none"')}${path("M100 62L105 69L100 76L95 69Z", jewel)}<circle cx="100" cy="69" r="9" fill="${shine}" stroke="none" opacity=".6"/>`;
    L.body = `${e(100, 138, 29, 28)}${e(100, 144, 19, 20, `url(#${pre}-chest)`)}${highlight(80, 124, 16)}`;
    const wing = (d) => {
      const x = (v) => 100 + d * v;
      return `${path(`M${x(26)} 120Q${x(48)} 124 ${x(46)} 150Q${x(44)} 162 ${x(34)} 166Q${x(36)} 156 ${x(30)} 158Q${x(30)} 150 ${x(24)} 150Q${x(18)} 136 ${x(26)} 120Z`, body)}${line(`M${x(30)} 132Q${x(38)} 142 ${x(36)} 156`, p.light, 1.5, 0.6)}${path(`M${x(28)} 126Q${x(40)} 128 ${x(40)} 138Q${x(32)} 136 ${x(28)} 132Z`, p.glow, ' stroke="none" opacity=".55"')}`;
    };
    L.armL = wing(-1);
    L.armR = wing(1);
    const foot = (x) => line(`M${x} 162V172M${x} 172L${x - 6} 176M${x} 172L${x + 6} 176M${x} 172V178`, "#ff9a4a", 3.2);
    L.legL = foot(88);
    L.legR = foot(112);
    L.tail = `${path("M122 150Q146 156 158 172Q144 172 140 166Q138 174 128 172Q130 164 120 158Z", body)}`;
  }

  if (id === "sunbara") {
    // Capybara on a sunny day: broad boxy muzzle, tiny ears, contented half-lidded
    // eyes, a glowing yuzu with a leaf and sun rays, a striped bath towel.
    L.ears = `${e(66, 64, 9, 8)}${e(66, 65, 4.5, 4, p.dark, ' opacity=".55" stroke="none"')}${e(134, 64, 9, 8)}${e(134, 65, 4.5, 4, p.dark, ' opacity=".55" stroke="none"')}`;
    L.head = `${path("M58 90Q58 56 100 56Q142 56 142 90Q142 120 100 122Q58 120 58 90Z", face)}${path("M74 100Q74 90 100 90Q126 90 126 100Q126 120 100 121Q74 120 74 100Z", `url(#${pre}-muzzle)`)}${e(92, 101, 3, 2.2, p.dark, ' stroke="none"')}${e(108, 101, 3, 2.2, p.dark, ' stroke="none"')}<path d="M95.5 111Q97.8 114 100 111.6Q102.2 114 104.5 111" stroke="${p.dark}" stroke-width="1.9" fill="none" stroke-linecap="round"/>${highlight(68, 70, 26)}${blush(104, 34)}`;
    // Contented closed eyes: the game's own "happy" arcs, so the capybara reads as calm.
    const content = (x) => `<path d="M${x - 11} 88Q${x} 75 ${x + 11} 88" stroke="${INK}" stroke-width="4.2" fill="none" stroke-linecap="round"/>`;
    L.eyes = content(80) + content(120);
    L.flame = `<circle cx="100" cy="40" r="24" fill="${shine}" stroke="none" opacity=".75"/>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => { const a = (i * Math.PI) / 4; return line(`M${(100 + Math.cos(a) * 17).toFixed(1)} ${(40 + Math.sin(a) * 17).toFixed(1)}L${(100 + Math.cos(a) * 23).toFixed(1)} ${(40 + Math.sin(a) * 23).toFixed(1)}`, p.glow, 2.4, 0.9); }).join("")}${e(100, 41, 13, 12, `url(#${pre}-yuzu)`)}${path("M100 30Q106 20 116 24Q110 32 100 30Z", "#7cc46a")}${e(96, 37, 4, 2.5, "#ffffff", ' opacity=".6" stroke="none"')}`;
    L.body = `${e(100, 140, 33, 27)}${e(100, 145, 20, 18, pearl)}${highlight(78, 126, 18)}`;
    L.scarf = `${path("M68 122Q100 134 132 122L134 132Q100 146 66 132Z", "#ffffff")}${line("M70 127Q100 139 130 127", "#ff8f6b", 2, 0.85)}${path("M126 128L138 156L128 156L120 132Z", "#ffffff")}${line("M128 140H134M130 148H136", "#ff8f6b", 1.6, 0.85)}`;
    L.legL = paw(82, 162, 13);
    L.legR = paw(118, 162, 13);
    L.armL = hand(65);
    L.armR = hand(135);
  }

  if (id === "astrabun") {
    // Moon rabbit: tall ears (one folded at the tip), crescent-moon mark, star
    // catchlights, a cotton tail and a wooden mochi mallet with a gold band.
    L.ears = `${path("M78 64Q64 30 72 8Q84 4 88 30Q90 50 90 62Z", body)}${path("M80 58Q72 34 76 16Q82 16 84 34Q86 48 86 58Z", "#ffc6e3", ' stroke="none"')}${path("M110 62Q110 40 118 22Q124 12 134 14Q132 24 126 22Q124 34 124 64Z", body)}${path("M114 58Q114 42 120 28L122 58Z", "#ffc6e3", ' stroke="none"')}${path("M118 22Q128 6 146 8Q140 18 128 22Z", body)}`;
    L.head = `${e(100, 88, 39, 33, face)}${highlight(72, 72, 22)}${path("M97 103Q100 100 103 103Q100 106 97 103Z", "#ff8fb8", ' stroke="none"')}${strokeP("M100 105V107.6M100 107.6Q97.5 110.5 95.5 109.5M100 107.6Q102.5 110.5 104.5 109.5")}${path("M98.3 108.2H101.7V111.4H98.3Z", "#ffffff", ` stroke="${p.dark}" stroke-width=".9"`)}${line("M100 108.2V111.4", p.dark, 0.8)}${blush(108, 31)}`;
    L.flame = `${path("M104 58Q94 62 95 72Q96 80 106 82Q98 76 99 70Q100 62 104 58Z", `url(#${pre}-moon)`)}${sparkle(112, 62, 3, p.glow)}`;
    const star5 = (x, y, r) => path(Array.from({ length: 10 }, (_, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r; return `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`; }).join("") + "Z", "#ffe27a", ' stroke="none"');
    const starEye = (x) => `${e(x, 93, 11.7, 13.4, INK)}${e(x, 95, 9, 9.5, p.accent)}${star5(x, 95.5, 6)}${e(x - 3.5, 88, 4, 3.4, "#ffffff")}`;
    L.eyes = starEye(79) + starEye(121);
    L.body = `${e(100, 138, 28, 28)}${e(100, 143, 17, 19, pearl)}${highlight(80, 124, 16)}`;
    L.tail = `${e(130, 156, 13, 12, "#ffffff")}${e(126, 152, 5, 4, "#ffffff", ' stroke="none" opacity=".9"')}`;
    const mallet = `${path("M148 154L156 96L162 97L154 155Z", "#b37a45")}${path("M140 80Q140 72 160 74Q178 76 178 86L176 100Q176 108 158 106Q140 104 140 96Z", "#d29a5c")}${path("M152 76L150 104L156 105L158 76Z", p.glow)}${line("M144 82Q158 82 174 86", "#ffffff", 1.6, 0.5)}`;
    L.armR = `${mallet}${hand(133)}`;
    L.legL = paw(82, 160, 15);
    L.legR = paw(118, 160, 15);
  }

  if (id === "wombolder") {
    // Wombat: wide squat body, small round ears, a big broad nose, a boulder
    // plate on its back, mossy patches, digging claws and a pebble pouch.
    L.wings = `${path("M52 156Q42 120 58 104Q76 92 100 92Q124 92 142 104Q158 120 148 156Q128 168 100 168Q72 168 52 156Z", `url(#${pre}-stone)`)}${line("M64 116L74 126L70 138M136 112L128 124L134 134", p.dark, 1.8, 0.45)}${path("M58 108Q72 96 86 100Q78 108 64 112Z", p.glow, ' opacity=".9"')}${path("M128 100Q140 100 146 112Q136 110 126 106Z", p.glow, ' opacity=".9"')}`;
    L.ears = `${e(64, 62, 10, 10)}${e(64, 63, 5, 5, p.dark, ' opacity=".45" stroke="none"')}${e(136, 62, 10, 10)}${e(136, 63, 5, 5, p.dark, ' opacity=".45" stroke="none"')}`;
    L.head = `${e(100, 90, 44, 32, face)}${path("M86 98Q86 90 100 90Q114 90 114 98Q114 108 100 108Q86 108 86 98Z", "#3a2a22")}${e(94, 95, 3, 2, "#ffffff", ' opacity=".5" stroke="none"')}${strokeP("M95 114H105", p.dark, 2.2)}${highlight(66, 72, 26)}${e(70, 108, 8, 4.5, "#ff8fb0", ' opacity=".45" stroke="none"')}${e(130, 108, 8, 4.5, "#ff8fb0", ' opacity=".45" stroke="none"')}`;
    const bead = (x) => `${e(x, 87, 5.6, 6.4, INK)}${e(x - 1.8, 84.8, 2, 2, "#ffffff")}`;
    L.eyes = bead(76) + bead(124) + strokeP("M66 77.5H86M134 77.5H114", p.dark, 4.2);
    L.flame = `${e(112, 60, 9, 6, `url(#${pre}-stone)`)}${path("M104 58Q108 50 116 54Q112 58 104 58Z", p.glow, ' stroke="none"')}`;
    L.body = `${e(100, 140, 36, 27)}${e(100, 146, 22, 17, pearl)}${highlight(76, 126, 18)}`;
    L.scarf = `${path("M66 134Q100 146 134 134L134 140Q100 152 66 140Z", "#6b4a2c")}${e(124, 146, 8, 7, "#8a6440")}${line("M118 142Q124 138 130 142", "#3e2a1a", 1.4, 0.8)}`;
    const claw = (x) => `${e(x, 140, 11, 14)}${e(x, 152, 12, 7)}${line(`M${x - 6} 156L${x - 7} 161M${x} 157V162M${x + 6} 156L${x + 7} 161`, "#f4ead8", 2.6)}`;
    L.armL = claw(62);
    L.armR = claw(138);
    L.legL = paw(80, 164, 16);
    L.legR = paw(120, 164, 16);
  }

  if (id === "shadopus") {
    // Midnight octopus: a tall mantle head with glowing spots, a bandit ink mask
    // over glowing eyes, curling tentacle arms and legs with suckers, ink drips.
    L.head = `${path("M58 96Q54 48 100 40Q146 48 142 96Q138 120 100 122Q62 120 58 96Z", face)}${e(84, 58, 4, 3, p.glow, ' opacity=".8" stroke="none"')}${e(118, 52, 3, 2.5, p.glow, ' opacity=".8" stroke="none"')}${e(128, 70, 2.5, 2, p.glow, ' opacity=".7" stroke="none"')}${highlight(70, 66, 22)}${path("M60 88Q100 76 140 88L140 102Q100 92 60 102Z", p.accent)}${path("M60 92L50 86L54 96Z", p.accent)}${strokeP("M91 107Q99 114 108 105.5", p.light, 2)}${strokeP("M108 105.5l2 -1.6", p.light, 1.6)}`;
    const glow = (x) => `<circle cx="${x}" cy="94" r="13" fill="${shine}" stroke="none" opacity=".75"/>${e(x, 94, 7.5, 8.5, p.glow)}${e(x - 2.5, 93, 3, 2.6, "#ffffff")}${path(`M${x - 9} 94Q${x} 85 ${x + 9} 94L${x + 9} 84H${x - 9}Z`, p.accent, ' stroke="none"')}${strokeP(`M${x - 8.5} 93.5Q${x} 86 ${x + 8.5} 93.5`, p.glow, 1.4)}`;
    L.eyes = glow(82) + glow(118);
    const tent = (d, x0, y0, x1, y1, cx, cy) => `${line(`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`, p.dark, 15)}${line(`M${x0} ${y0}Q${cx} ${cy} ${x1} ${y1}`, body, 11.5)}<circle cx="${x1}" cy="${y1}" r="5.6" fill="${body}"/>${[0.35, 0.6, 0.82].map((t) => { const bx = (1 - t) ** 2 * x0 + 2 * (1 - t) * t * cx + t * t * x1, by = (1 - t) ** 2 * y0 + 2 * (1 - t) * t * cy + t * t * y1; return `<circle cx="${bx.toFixed(1)}" cy="${(by + 3).toFixed(1)}" r="2" fill="${p.light}" stroke="none" opacity=".85"/>`; }).join("")}`;
    L.body = `${e(100, 136, 26, 22)}${highlight(82, 124, 14)}`;
    L.armL = tent(-1, 80, 132, 46, 128, 54, 154);
    L.armR = tent(1, 120, 132, 154, 128, 146, 154);
    L.legL = tent(-1, 90, 150, 70, 176, 72, 160) + tent(-1, 96, 154, 92, 182, 100, 170);
    L.legR = tent(1, 110, 150, 130, 176, 128, 160) + tent(1, 104, 154, 108, 182, 100, 170);
    L.tail = `${line("M118 140Q160 150 168 116Q172 96 156 92", p.dark, 15)}${line("M118 140Q160 150 168 116Q172 96 156 92", body, 11.5)}<circle cx="156" cy="92" r="5.6" fill="${body}"/>${e(160, 170, 7, 4, p.accent, ' opacity=".7" stroke="none"')}${e(40, 172, 5, 3, p.accent, ' opacity=".6" stroke="none"')}`;
  }

  // Extra gradients some champions use.
  const extra = `<defs>
    <linearGradient id="${pre}-shell" x2="0" y2="1"><stop stop-color="#a77a62"/><stop offset=".6" stop-color="${p.accent}"/><stop offset="1" stop-color="#3a2620"/></linearGradient>
    <radialGradient id="${pre}-heart" cx="40%" cy="35%"><stop stop-color="#fff0c8"/><stop offset=".5" stop-color="${p.glow}"/><stop offset="1" stop-color="#e2553a"/></radialGradient>
    <radialGradient id="${pre}-heartglow"><stop stop-color="${p.glow}" stop-opacity=".55"/><stop offset="1" stop-color="${p.glow}" stop-opacity="0"/></radialGradient>
    <radialGradient id="${pre}-chest" cx="35%" cy="20%"><stop stop-color="#ffe1c2"/><stop offset=".6" stop-color="${p.accent}"/><stop offset="1" stop-color="#c25a1e"/></radialGradient>
    <radialGradient id="${pre}-muzzle" cx="40%" cy="25%"><stop stop-color="${p.light}"/><stop offset="1" stop-color="#d9a873"/></radialGradient>
    <radialGradient id="${pre}-yuzu" cx="35%" cy="30%"><stop stop-color="#fff6c2"/><stop offset=".55" stop-color="${p.accent}"/><stop offset="1" stop-color="#e08a16"/></radialGradient>
    <linearGradient id="${pre}-moon" x2="1" y2="1"><stop stop-color="#fffbe6"/><stop offset="1" stop-color="${p.glow}"/></linearGradient>
    <radialGradient id="${pre}-stone" cx="35%" cy="25%"><stop stop-color="#c9ccd4"/><stop offset=".55" stop-color="${p.accent}"/><stop offset="1" stop-color="#4b4e57"/></radialGradient>
  </defs>`;
  const wrap = (part) => {
    if (!L[part]) return "";
    const { s, cx, cy } = PROP[part];
    return `<g class="part part-${part}"><g transform="matrix(${s} 0 0 ${s} ${+(cx - s * cx).toFixed(3)} ${+(cy - s * cy).toFixed(3)})">${L[part]}</g></g>`;
  };
  const shadow = `<ellipse class="shadow" cx="100" cy="177" rx="40" ry="8" fill="#060d24" opacity=".28"/>`;
  const content = `${shadow}<g class="character">${ORDER_LOW.map(wrap).join("")}<g class="face">${ORDER_FACE.map(wrap).join("")}</g>${wrap("scarf")}</g>`;
  const viewBox = opts.viewBox ?? "0 -12 200 202";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" class="champ champ-${id}" role="img" aria-label="${id}">${defs}${extra}<g stroke="${p.dark}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round">${content}</g></svg>`;
}
export { PALETTES };

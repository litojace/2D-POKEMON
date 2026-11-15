/**
 * Illustrated boss attack icons for the raid pages: one small painted scene
 * per attack, in the same 128 × 128 style as the champions' skill icons
 * (skill-art.ts: dark element-lit backdrop, glowing subject, sparks).
 *
 * Each scene shows how the attack is beaten, the way the raid shows it:
 * the red dashed warning on the floor, a small pale raider, and a white
 * arrow for the dodge (step, jump or dash). No text inside the art: counts
 * are dots, signs are drawn strokes.
 */
import type { RaidAttack } from "../../../packages/shared/src/raid";
import {
  THEMES,
  backdrop,
  bolt,
  ensureSkillArtDefs,
  floorGlow,
  glint,
  glow,
  halo,
  n,
  sparks,
  type Element,
} from "./skill-art";

// ── Shared pieces ────────────────────────────────────────────────────────
const RED = "#ff5468";
const WHITE = "#ffffff";
/** An ellipse as a path (so it can glow through `glow`). */
const ell = (cx: number, cy: number, rx: number, ry: number) =>
  `M${n(cx - rx)} ${cy} A${rx} ${ry} 0 1 0 ${n(cx + rx)} ${cy} A${rx} ${ry} 0 1 0 ${n(cx - rx)} ${cy}Z`;
/** The raid's warning: red, translucent, dashed edge. */
const danger = (d: string, o = 0.24) =>
  `<path d="${d}" fill="${RED}" fill-opacity="${o}" stroke="${RED}" stroke-width="2" stroke-dasharray="5 4" stroke-linejoin="round"/>`;
/** A small raider seen from above and in front (shadow, body, head). */
const raider = (x: number, y: number, s = 1, c = "#f6f3ff") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><ellipse cx="0" cy="10" rx="7.5" ry="2.8" fill="#000" opacity=".4"/><path d="M-6 9 Q-6.5 -2.5 0 -2.5 Q6.5 -2.5 6 9Z" fill="${c}"/><circle cx="0" cy="-7" r="5" fill="${c}"/></g>`;
/** A raider in the air: lifted, with its shadow left on the floor. */
const jumper = (x: number, y: number, lift = 16, s = 1) =>
  `<ellipse cx="${x}" cy="${y + 10 * s}" rx="${n(6 * s)}" ry="${n(2.2 * s)}" fill="#000" opacity=".35"/>` +
  raider(x, y - lift, s).replace(/<ellipse[^>]*\/>/, "");
/** The dodge: a white arrow with a soft dark outline (reads on any light). */
function arrow(x0: number, y0: number, x1: number, y1: number, w = 3.2) {
  const a = Math.atan2(y1 - y0, x1 - x0),
    h = 8;
  const head = `M${n(x1 - h * Math.cos(a - 0.55))} ${n(y1 - h * Math.sin(a - 0.55))} L${x1} ${y1} L${n(x1 - h * Math.cos(a + 0.55))} ${n(y1 - h * Math.sin(a + 0.55))}`;
  const line = `M${x0} ${y0} L${x1} ${y1}`;
  return (
    `<path d="${line} ${head}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="${n(w + 3)}" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${line} ${head}" fill="none" stroke="${WHITE}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
/** A curved dodge arrow (quadratic through a control point). */
function curveArrow(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x1: number,
  y1: number,
) {
  const a = Math.atan2(y1 - cy, x1 - cx),
    h = 8;
  const d = `M${x0} ${y0} Q${cx} ${cy} ${x1} ${y1} M${n(x1 - h * Math.cos(a - 0.55))} ${n(y1 - h * Math.sin(a - 0.55))} L${x1} ${y1} L${n(x1 - h * Math.cos(a + 0.55))} ${n(y1 - h * Math.sin(a + 0.55))}`;
  return (
    `<path d="${d}" fill="none" stroke="#000" stroke-opacity=".45" stroke-width="6.2" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${WHITE}" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
/** An angular rock (deterministic shape from its seed). */
function rock(
  x: number,
  y: number,
  r: number,
  seed: number,
  fill: string,
  edge: string,
) {
  const pts: string[] = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + seed;
    const k = 0.78 + (((seed * 7 + i * 13) % 10) / 10) * 0.32;
    pts.push(`${n(x + Math.cos(a) * r * k)} ${n(y + Math.sin(a) * r * k * 0.9)}`);
  }
  return `<path d="M${pts.join(" L")}Z" fill="${fill}" stroke="${edge}" stroke-width="2" stroke-linejoin="round"/><path d="M${n(x - r * 0.45)} ${n(y - r * 0.2)} L${n(x + r * 0.1)} ${n(y - r * 0.5)}" stroke="#fff" stroke-opacity=".35" stroke-width="2" stroke-linecap="round"/>`;
}
/** A flame tongue, base at (x, y). */
const flame = (x: number, y: number, s: number, el: Element = "fire") => {
  const t = THEMES[el];
  return `<g transform="translate(${x} ${y}) scale(${s})"><path d="M0 0 Q-9 -6 -6 -16 Q-3 -10 -1 -12 Q-4 -22 4 -30 Q3 -20 9 -14 Q12 -6 0 0Z" fill="${t.accent[1]}"/><path d="M0 -1 Q-4 -5 -2 -11 Q0 -8 2 -10 Q1 -16 5 -19 Q5 -12 6 -8 Q6 -3 0 -1Z" fill="${t.accent[2]}"/></g>`;
};
/** A soap-like bubble with a highlight. */
const bubble = (x: number, y: number, r: number, el: Element) => {
  const t = THEMES[el];
  return `<circle cx="${x}" cy="${y}" r="${r}" fill="${t.accent[1]}" fill-opacity=".18" stroke="${t.accent[2]}" stroke-width="${n(Math.max(1.4, r / 7))}"/><path d="M${n(x - r * 0.55)} ${n(y - r * 0.15)} A${n(r * 0.6)} ${n(r * 0.6)} 0 0 1 ${n(x - r * 0.1)} ${n(y - r * 0.6)}" fill="none" stroke="${WHITE}" stroke-opacity=".8" stroke-width="${n(Math.max(1.2, r / 9))}" stroke-linecap="round"/>`;
};
/** A wedge (cone) from (cx, cy), angles in degrees, flattened for the floor. */
function wedge(cx: number, cy: number, r: number, a0: number, a1: number) {
  const p = (a: number) => {
    const rad = (a * Math.PI) / 180;
    return `${n(cx + Math.cos(rad) * r)} ${n(cy + Math.sin(rad) * r * 0.62)}`;
  };
  return `M${cx} ${cy} L${p(a0)} A${r} ${n(r * 0.62)} 0 0 1 ${p(a1)}Z`;
}
/** A straight lane from (x0, y0) to (x1, y1), `w` wide. */
function lane(x0: number, y0: number, x1: number, y1: number, w: number) {
  const a = Math.atan2(y1 - y0, x1 - x0) + Math.PI / 2,
    dx = (Math.cos(a) * w) / 2,
    dy = (Math.sin(a) * w) / 2;
  return `M${n(x0 + dx)} ${n(y0 + dy)} L${n(x1 + dx)} ${n(y1 + dy)} L${n(x1 - dx)} ${n(y1 - dy)} L${n(x0 - dx)} ${n(y0 - dy)}Z`;
}
/** A raised island: sand top, darker rim, a tuft. */
const island = (x: number, y: number, rx: number) =>
  `<ellipse cx="${x}" cy="${y + 4}" rx="${rx}" ry="${n(rx * 0.42)}" fill="#0b3b4a"/><ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${n(rx * 0.4)}" fill="#e9d29a" stroke="#b89a5a" stroke-width="1.6"/><path d="M${n(x + rx * 0.35)} ${n(y - 2)} q2 -7 4 0 q2 -6 3 1" fill="none" stroke="#4f9a4a" stroke-width="1.8" stroke-linecap="round"/>`;
/** A lantern on a short post; lit or snuffed. */
function lantern(x: number, y: number, lit: boolean) {
  const glowing = lit
    ? `<circle cx="${x}" cy="${y - 4}" r="26" fill="url(#sa-glow-light)" opacity=".9"/>`
    : "";
  const body = lit ? "#ffd86b" : "#6a5f8c";
  return (
    glowing +
    `<path d="M${x} ${y + 26} V${y + 8}" stroke="${lit ? "#2a2238" : "#8a7fae"}" stroke-width="3"/>` +
    `<path d="M${x - 7} ${y - 12} H${x + 7} L${x + 9} ${y + 6} H${x - 9}Z" fill="${body}" stroke="${lit ? "#1d1830" : "#b3a6d9"}" stroke-width="2" stroke-linejoin="round"/>` +
    `<path d="M${x - 5} ${y - 16} H${x + 5} L${x + 7} ${y - 12} H${x - 7}Z" fill="${lit ? "#1d1830" : "#b3a6d9"}"/>` +
    (lit
      ? `<circle cx="${x}" cy="${y - 3}" r="3.4" fill="#fffbe6"/>`
      : `<path d="M${x - 1} ${y - 18} q-6 -6 0 -12 q6 -6 0 -12" fill="none" stroke="#8d84a8" stroke-width="2" stroke-linecap="round" opacity=".7"/>`)
  );
}
/** A raider's mark: a target reticle floating above them. */
const mark = (x: number, y: number, color: string) =>
  `<circle cx="${x}" cy="${y}" r="7" fill="none" stroke="${color}" stroke-width="2.2"/><path d="M${x} ${y - 11} V${y - 5} M${x} ${y + 5} V${y + 11} M${x - 11} ${y} H${x - 5} M${x + 5} ${y} H${x + 11}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>`;
/** Dots in a row: a count without text. */
const dots = (x: number, y: number, count: number, color: string) =>
  Array.from(
    { length: count },
    (_, i) =>
      `<circle cx="${n(x + (i - (count - 1) / 2) * 5)}" cy="${y}" r="1.9" fill="${color}"/>`,
  ).join("");
/** A small crescent-eyed shadow creature (Inkpurr's copies). */
const shade = (x: number, y: number, s: number, eyes = "#d9c2ff") =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path d="M-12 12 Q-14 -6 -9 -12 L-7 -20 L-2 -13 Q0 -14 2 -13 L7 -20 L9 -12 Q14 -6 12 12Z" fill="#1a1030" stroke="#7d5bd6" stroke-width="1.8" stroke-linejoin="round"/><path d="M-6 -4 q2 -2 4 0 M2 -4 q2 -2 4 0" fill="none" stroke="${eyes}" stroke-width="2" stroke-linecap="round"/></g>`;
/** A twin of the Storm Twins: a charged orb with a face. */
const twin = (x: number, y: number, r: number) =>
  halo("electric", x, y, r * 2.2) +
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sa-orb-electric)"/><path d="M${n(x - r * 0.4)} ${n(y - r * 0.1)} v2 M${n(x + r * 0.4)} ${n(y - r * 0.1)} v2" stroke="#3a2a00" stroke-width="2.2" stroke-linecap="round"/>`;
/** Two strokes forming + or −. */
const sign = (x: number, y: number, plus: boolean, color: string) =>
  `<circle cx="${x}" cy="${y}" r="8" fill="#0d0b22" stroke="${color}" stroke-width="2"/><path d="M${x - 4.5} ${y} H${x + 4.5}${plus ? ` M${x} ${y - 4.5} V${y + 4.5}` : ""}" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>`;

const R = THEMES.earth,
  W = THEMES.water,
  S = THEMES.shadow,
  P = THEMES.psychic,
  L = THEMES.light,
  F = THEMES.fire,
  E = THEMES.electric;

// ── The attacks ──────────────────────────────────────────────────────────
const art: Partial<Record<RaidAttack, { el: Element; draw: () => string }>> =
  {
    // Cragmuff · Earth
    charge: {
      el: "earth",
      draw: () =>
        danger(lane(30, 40, 104, 98, 26)) +
        floorGlow("earth", 36, 52, 30, 12, 0.8) +
        rock(34, 40, 18, 1, R.accent[1], R.accent[0]) +
        `<path d="M24 28 l-8 -8 M32 24 l-4 -10" stroke="${R.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
        glow("M10 44 H2 M12 54 H4 M16 64 H8", R.accent[2], 2, R.accent[1]) +
        raider(84, 84) +
        arrow(90, 82, 108, 60),
    },
    slam: {
      el: "earth",
      draw: () =>
        danger(ell(64, 88, 50, 20), 0.28) +
        `<path d="M64 88 l-22 -4 M64 88 l20 -8 M64 88 l6 14 M64 88 l-14 10" stroke="${R.accent[0]}" stroke-width="2.4" stroke-linecap="round"/>` +
        halo("earth", 64, 70, 30) +
        rock(64, 66, 20, 2, R.accent[1], R.accent[0]) +
        glow("M50 40 V30 M64 36 V24 M78 40 V30", R.accent[2], 2.2, R.accent[1]) +
        jumper(104, 92, 22, 0.9) +
        arrow(104, 52, 104, 38),
    },
    volley: {
      el: "earth",
      draw: () =>
        danger(wedge(22, 74, 96, -30, 30)) +
        rock(22, 74, 13, 3, R.accent[1], R.accent[0]) +
        rock(56, 64, 6, 4, R.accent[2], R.accent[0]) +
        rock(70, 82, 6, 5, R.accent[2], R.accent[0]) +
        rock(84, 70, 5, 6, R.accent[2], R.accent[0]) +
        `<path d="M46 66 h-8 M60 84 h-8 M74 72 h-8" stroke="${R.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
        `<rect x="92" y="54" width="14" height="40" rx="3" fill="#8a7a66" stroke="#4a3d2c" stroke-width="2"/><ellipse cx="99" cy="54" rx="7" ry="3" fill="#b9a68a"/>` +
        raider(114, 82, 0.85),
    },
    debris: {
      el: "earth",
      draw: () =>
        [
          [34, 92, 1],
          [66, 70, 2],
          [98, 94, 3],
        ]
          .map(
            ([x, y, s]) =>
              danger(ell(x, y, 15, 6.5), 0.3) +
              rock(x, y - 46 + s * 4, 9, s, R.accent[1], R.accent[0]) +
              `<path d="M${x} ${y - 60 + s * 4} v-12" stroke="${R.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".6"/>`,
          )
          .join("") +
        raider(66, 104, 0.9) +
        arrow(56, 108, 40, 116),
    },
    eruption: {
      el: "earth",
      draw: () =>
        danger(ell(26, 98, 11, 5), 0.18) +
        danger(ell(50, 88, 13, 5.5), 0.26) +
        danger(ell(76, 76, 15, 6.5), 0.34) +
        floorGlow("fire", 76, 74, 22, 10) +
        flame(76, 76, 1.1, "fire") +
        flame(50, 88, 0.6, "fire") +
        sparks(
          [
            [70, 40, 1.8],
            [84, 46, 1.4],
            [62, 50, 1.2],
          ],
          F.accent[2],
        ) +
        raider(104, 64, 0.9) +
        arrow(108, 58, 120, 40),
    },
    share: {
      el: "earth",
      draw: () =>
        danger(ell(60, 92, 30, 12.5), 0.26) +
        mark(60, 92, RED) +
        `<path d="M118 10 L80 52" stroke="url(#sa-diag-fire)" stroke-width="12" stroke-linecap="round" opacity=".55"/>` +
        halo("fire", 82, 48, 22) +
        rock(82, 48, 12, 4, R.accent[1], F.accent[0]) +
        raider(64, 88, 0.95) +
        arrow(74, 92, 108, 100),
    },

    // Tidelotl · Water
    dive: {
      el: "water",
      draw: () =>
        island(36, 66, 24) +
        [8, 15, 22]
          .map(
            (r, i) =>
              `<ellipse cx="44" cy="70" rx="${r}" ry="${n(r * 0.42)}" fill="none" stroke="${RED}" stroke-width="${2.4 - i * 0.5}" opacity="${0.9 - i * 0.25}"/>`,
          )
          .join("") +
        `<path d="M70 96 q10 -6 20 0 q10 6 20 0" fill="none" stroke="${W.accent[2]}" stroke-width="2.2" stroke-linecap="round" opacity=".7"/>` +
        raider(42, 58, 0.95) +
        arrow(56, 62, 90, 80),
    },
    wave: {
      el: "water",
      draw: () =>
        `<path d="M6 92 Q28 60 52 76 Q70 88 86 70 Q104 50 122 66 L122 104 L6 104Z" fill="url(#sa-up-water)" opacity=".85"/>` +
        glow(
          "M6 92 Q28 60 52 76 Q70 88 86 70 Q104 50 122 66",
          W.hot,
          2.4,
          W.accent[1],
        ) +
        sparks(
          [
            [30, 66, 1.6],
            [94, 58, 1.8],
            [112, 56, 1.3],
          ],
          W.hot,
        ) +
        jumper(64, 58, 16, 0.95) +
        arrow(64, 26, 64, 13),
    },
    bubbles: {
      el: "water",
      draw: () =>
        halo("water", 18, 64, 22) +
        `<circle cx="18" cy="64" r="9" fill="url(#sa-orb-water)"/>` +
        [
          [48, 34, 8],
          [56, 52, 7],
          [60, 72, 8],
          [54, 92, 7],
          [84, 26, 9],
          [92, 52, 8],
          [94, 82, 9],
        ]
          .map(([x, y, r]) => bubble(x, y, r, "water"))
          .join("") +
        raider(78, 66, 0.85) +
        curveArrow(70, 104, 76, 86, 110, 70),
    },
    hightide: {
      el: "water",
      draw: () =>
        `<rect x="0" y="66" width="128" height="62" fill="${W.accent[0]}" opacity=".55"/>` +
        danger("M0 66 H128 V128 H0Z", 0.14) +
        `<path d="M6 82 q8 -4 16 0 q8 4 16 0 M76 106 q8 -4 16 0 q8 4 16 0 M90 76 q6 -3 12 0" fill="none" stroke="${W.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".8"/>` +
        island(64, 82, 26) +
        raider(64, 72) +
        arrow(30, 40, 50, 60),
    },
    undertow: {
      el: "water",
      draw: () =>
        floorGlow("water", 64, 70, 54, 24) +
        glow(
          "M64 70 m-4 0 a4 2 0 1 1 8 0 a10 5 0 1 1 -20 0 a18 8 0 1 1 36 0 a28 12 0 1 1 -56 0 a40 17 0 1 1 80 0",
          W.accent[2],
          2.4,
          W.accent[1],
        ) +
        raider(96, 62, 0.9) +
        arrow(104, 66, 122, 82),
    },
    prison: {
      el: "water",
      draw: () =>
        `<path d="M70 70 Q48 74 26 60" stroke="${W.accent[2]}" stroke-width="2" stroke-dasharray="3 5" stroke-linecap="round" fill="none"/>` +
        halo("water", 22, 56, 20) +
        `<circle cx="22" cy="56" r="8" fill="url(#sa-orb-water)"/>` +
        raider(82, 68) +
        bubble(82, 64, 22, "water") +
        glint(108, 42, 7, W.hot) +
        glint(58, 40, 5, W.hot) +
        glint(104, 90, 5, W.hot),
    },

    // Inkpurr · Shadow
    lunge: {
      el: "shadow",
      draw: () =>
        danger(lane(26, 44, 100, 92, 14), 0.32) +
        shade(26, 42, 1) +
        `<path d="M26 56 L100 92" stroke="#0a0614" stroke-width="5" stroke-linecap="round" opacity=".6"/>` +
        raider(92, 84) +
        arrow(98, 80, 114, 58),
    },
    hands: {
      el: "shadow",
      draw: () => {
        let tiles = "";
        for (let row = 0; row < 3; row++)
          for (let col = 0; col < 4; col++) {
            const x = 8 + col * 28 + row * 0,
              y = 52 + row * 22,
              dark = (row + col) % 2 === 0;
            tiles += dark
              ? danger(`M${x} ${y} h26 v20 h-26Z`, 0.3)
              : `<path d="M${x} ${y} h26 v20 h-26Z" fill="${S.accent[2]}" fill-opacity=".22" stroke="${S.accent[2]}" stroke-width="1.5"/>`;
            if (dark && (row + col) % 4 === 0)
              tiles += `<path d="M${x + 7} ${y + 18} v-9 m4 9 v-12 m4 12 v-10 m4 10 v-7" stroke="#120a22" stroke-width="2.6" stroke-linecap="round"/>`;
          }
        return (
          tiles +
          halo("shadow", 64, 30, 22) +
          shade(64, 30, 0.8) +
          raider(78, 76, 0.85)
        );
      },
    },
    snuff: {
      el: "shadow",
      draw: () =>
        lantern(64, 62, false) +
        glint(88, 52, 7, S.hot) +
        glint(42, 70, 5, S.hot) +
        `<path d="M90 82 l-14 -10" stroke="${WHITE}" stroke-width="2.4" stroke-linecap="round"/>` +
        raider(98, 92, 0.85) +
        dots(64, 104, 2, S.accent[2]),
    },
    curse: {
      el: "shadow",
      draw: () =>
        lantern(92, 48, true) +
        floorGlow("light", 92, 84, 26, 10, 0.9) +
        raider(38, 82) +
        `<g transform="translate(38 52)"><circle r="9" fill="#20103a" stroke="${S.accent[1]}" stroke-width="2"/><path d="M-4 -4 L4 4 M4 -4 L-4 4" stroke="${S.accent[2]}" stroke-width="2.2" stroke-linecap="round"/></g>` +
        `<path d="M30 92 q-6 4 -12 2 M46 92 q6 4 10 0" fill="none" stroke="${S.accent[1]}" stroke-width="2" opacity=".7" stroke-linecap="round"/>` +
        arrow(52, 84, 78, 84),
    },
    split: {
      el: "shadow",
      draw: () =>
        floorGlow("light", 64, 84, 52, 18, 0.7) +
        shade(28, 70, 0.9) +
        shade(100, 70, 0.9) +
        `<ellipse cx="68" cy="86" rx="14" ry="4" fill="#000" opacity=".7"/>` +
        shade(64, 72, 1, "#fff2b0") +
        glint(64, 44, 6, L.hot),
    },
    pulse: {
      el: "shadow",
      draw: () =>
        `<ellipse cx="28" cy="82" rx="22" ry="9" fill="none" stroke="${S.accent[1]}" stroke-width="1.6" stroke-dasharray="3 4" opacity=".6"/>` +
        `<ellipse cx="100" cy="82" rx="22" ry="9" fill="none" stroke="${S.accent[1]}" stroke-width="1.6" stroke-dasharray="3 4" opacity=".6"/>` +
        glow(ell(64, 86, 34, 13), RED, 2.6, RED) +
        shade(28, 70, 0.7) +
        shade(100, 70, 0.7) +
        shade(64, 70, 0.9) +
        jumper(64, 110, 14, 0.75) +
        arrow(80, 108, 80, 94),
    },

    // Snoozaku · Psychic
    lullaby: {
      el: "psychic",
      draw: () =>
        [20, 34, 48]
          .map((r, i) =>
            glow(ell(52, 82, r, n(r * 0.4)), P.accent[2 - i], 2.2, P.accent[1]),
          )
          .join("") +
        `<path d="M44 26 v18 m0 -18 l10 -3 v15" stroke="${P.hot}" stroke-width="2.4" fill="none" stroke-linecap="round"/><ellipse cx="41" cy="45" rx="4" ry="3" fill="${P.hot}"/><ellipse cx="51" cy="40" rx="4" ry="3" fill="${P.hot}"/>` +
        jumper(102, 90, 20, 0.9) +
        arrow(102, 52, 102, 38),
    },
    "tail-splash": {
      el: "psychic",
      draw: () =>
        danger(lane(14, 70, 112, 70, 34), 0.28) +
        `<path d="M8 40 Q30 28 44 52 Q56 72 96 68" fill="none" stroke="#8f7bb8" stroke-width="14" stroke-linecap="round"/>` +
        `<path d="M8 40 Q30 28 44 52 Q56 72 96 68" fill="none" stroke="#c7b4ee" stroke-width="6" stroke-linecap="round" opacity=".6"/>` +
        sparks(
          [
            [100, 62, 2],
            [106, 74, 1.6],
            [92, 78, 1.4],
          ],
          P.hot,
        ) +
        raider(70, 72, 0.85) +
        arrow(70, 84, 70, 108),
    },
    "dream-bubbles": {
      el: "psychic",
      draw: () =>
        `<path d="M18 30 Q40 60 82 78" stroke="${P.accent[2]}" stroke-width="2" stroke-dasharray="3 5" fill="none" stroke-linecap="round"/>` +
        bubble(22, 34, 9, "psychic") +
        bubble(42, 54, 11, "psychic") +
        bubble(64, 70, 8, "psychic") +
        raider(94, 84) +
        arrow(104, 86, 122, 96),
    },
    "falling-stars": {
      el: "psychic",
      draw: () =>
        glow(
          "M22 26 L50 16 L78 30 L104 18",
          P.accent[2],
          1.4,
          P.accent[1],
        ) +
        [
          [22, 26],
          [50, 16],
          [78, 30],
          [104, 18],
        ]
          .map(([x, y]) => glint(x, y, 6, P.hot))
          .join("") +
        [
          [30, 92],
          [60, 80],
          [92, 96],
        ]
          .map(
            ([x, y]) =>
              danger(ell(x, y, 13, 5.5), 0.3) +
              `<path d="M${x} ${y - 40} v28" stroke="url(#sa-up-psychic)" stroke-width="4" stroke-linecap="round" opacity=".8"/>` +
              glint(x, y - 12, 5, P.hot),
          )
          .join("") +
        raider(76, 112, 0.8),
    },
    "whale-song": {
      el: "psychic",
      draw: () =>
        danger("M0 56 H128 V128 H0Z", 0.2) +
        `<ellipse cx="58" cy="90" rx="28" ry="12" fill="${P.accent[2]}" fill-opacity=".25" stroke="${P.hot}" stroke-width="2.2"/>` +
        `<path d="M14 24 h10 l-10 12 h10 M32 14 h8 l-8 9 h8 M48 8 h6 l-6 7 h6" fill="none" stroke="${P.hot}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>` +
        glow("M84 30 q8 -8 16 0 M80 44 q14 -12 28 0", P.accent[2], 2, P.accent[1]) +
        raider(58, 84, 0.9) +
        arrow(88, 92, 108, 92),
    },
    "dream-sequence": {
      el: "psychic",
      draw: () =>
        [
          [28, 92, 1],
          [52, 66, 2],
          [84, 86, 3],
          [104, 58, 4],
        ]
          .map(
            ([x, y, c]) =>
              `<ellipse cx="${x}" cy="${y}" rx="14" ry="6" fill="${P.accent[0]}" stroke="${P.accent[2]}" stroke-width="2"/>` +
              dots(x, y, c, P.hot),
          )
          .join("") +
        `<path d="M34 84 L46 72 M60 70 L76 82 M92 80 L100 66" stroke="${P.accent[2]}" stroke-width="2" stroke-dasharray="3 3" stroke-linecap="round"/>` +
        raider(28, 82, 0.85) +
        halo("psychic", 64, 28, 18) +
        glint(64, 28, 7, P.hot),
    },

    // Prismell · Light
    "prism-lance": {
      el: "light",
      draw: () =>
        danger(lane(14, 100, 116, 30, 10), 0.4) +
        glow("M14 100 L116 30", L.hot, 1.6, RED) +
        halo("light", 18, 96, 18) +
        glint(18, 96, 9, L.hot) +
        raider(74, 62, 0.9) +
        arrow(80, 72, 96, 92),
    },
    "fan-display": {
      el: "light",
      draw: () =>
        ["#ff6b6b", "#ffb347", "#ffe66b", "#7be08a", "#6bc4ff", "#b48cff"]
          .map(
            (c, i) =>
              `<path d="${wedge(64, 70, 58, -180 + i * 30 + 2, -180 + i * 30 + 28)}" fill="${c}" fill-opacity="${i === 2 ? 0.75 : 0.22}" stroke="${c}" stroke-width="${i === 2 ? 2.4 : 1.2}"/>`,
          )
          .join("") +
        halo("light", 64, 70, 18) +
        `<circle cx="64" cy="70" r="8" fill="url(#sa-orb-light)"/>` +
        `<circle cx="64" cy="100" r="9" fill="#ffe66b" stroke="${L.hot}" stroke-width="2"/>` +
        dots(64, 100, 3, "#5a3d00"),
    },
    glare: {
      el: "light",
      draw: () =>
        halo("light", 64, 34, 40) +
        `<path d="M34 34 Q64 10 94 34 Q64 58 34 34Z" fill="${L.hot}" stroke="${L.accent[1]}" stroke-width="2.4"/><circle cx="64" cy="34" r="9" fill="${L.accent[0]}"/><circle cx="64" cy="34" r="4" fill="#3a2600"/>` +
        glow("M64 6 V0 M34 12 L28 6 M94 12 L100 6 M20 34 H12 M108 34 H116", L.hot, 2, L.accent[1]) +
        raider(64, 92) +
        curveArrow(52, 108, 64, 120, 80, 108),
    },
    refraction: {
      el: "light",
      draw: () =>
        danger(lane(10, 30, 64, 66, 10), 0.36) +
        danger(lane(64, 66, 120, 40, 10), 0.36) +
        glow("M10 30 L64 66 L120 40", L.hot, 1.6, RED) +
        `<path d="M64 52 L74 66 L64 80 L54 66Z" fill="url(#sa-orb-light)" stroke="${L.hot}" stroke-width="1.6"/>` +
        raider(56, 100, 0.9),
    },
    "halo-crush": {
      el: "light",
      draw: () =>
        `<path d="M98 78 A40 17 0 1 1 82 61" fill="none" stroke="${RED}" stroke-width="7" stroke-opacity=".35" stroke-linecap="round"/>` +
        glow("M98 78 A40 17 0 1 1 82 61", L.hot, 2.4, RED) +
        `<path d="M88 64 L97 72" stroke="#7be08a" stroke-width="4" stroke-linecap="round"/>` +
        raider(66, 74, 0.9) +
        arrow(74, 70, 104, 56),
    },
    "light-relay": {
      el: "light",
      draw: () =>
        `<path d="M14 0 L30 44" stroke="url(#sa-up-light)" stroke-width="10" opacity=".45"/>` +
        glow("M14 0 L30 44 L80 36 L100 86", L.hot, 2, L.accent[1]) +
        raider(30, 50, 0.85) +
        `<path d="M80 26 L90 36 L80 46 L70 36Z" fill="#cfefff" stroke="${L.hot}" stroke-width="1.8"/>` +
        halo("light", 100, 90, 22) +
        `<path d="M100 78 L110 90 L100 104 L90 90Z" fill="url(#sa-orb-light)" stroke="${L.hot}" stroke-width="1.6"/>` +
        glint(100, 90, 4, WHITE),
    },

    // Lumiwick · Fire
    "dive-bomb": {
      el: "fire",
      draw: () =>
        danger(lane(20, 20, 96, 104, 22), 0.28) +
        `<path d="M30 32 L84 92" stroke="url(#sa-diag-fire)" stroke-width="8" stroke-linecap="round" opacity=".5"/>` +
        flame(46, 58, 0.7) +
        flame(64, 78, 0.8) +
        halo("fire", 26, 26, 22) +
        `<path d="M14 18 L34 30 L26 38Z M26 20 L40 22 L32 32Z" fill="${F.accent[1]}" stroke="${F.accent[2]}" stroke-width="1.4"/><circle cx="26" cy="26" r="7" fill="url(#sa-orb-fire)"/>` +
        raider(82, 88, 0.9) +
        arrow(92, 86, 114, 72),
    },
    "ember-rain": {
      el: "fire",
      draw: () =>
        [
          [28, 76],
          [64, 96],
          [100, 76],
          [64, 60],
        ]
          .map(
            ([x, y]) =>
              danger(ell(x, y, 13, 5.5), 0.28) +
              `<path d="M${x + 6} ${y - 44} L${x} ${y - 14}" stroke="url(#sa-up-fire)" stroke-width="4" stroke-linecap="round"/>` +
              `<circle cx="${x}" cy="${y - 12}" r="3.4" fill="${F.accent[2]}"/>`,
          )
          .join("") +
        raider(46, 92, 0.85) +
        raider(84, 92, 0.85),
    },
    "wing-gust": {
      el: "fire",
      draw: () =>
        danger(wedge(24, 64, 100, -28, 28), 0.2) +
        halo("fire", 22, 64, 22) +
        `<circle cx="22" cy="64" r="9" fill="url(#sa-orb-fire)"/>` +
        glow("M40 56 q14 -4 28 0 M44 70 q16 4 34 0 M58 62 q12 -2 22 0", F.accent[2], 2, F.accent[1]) +
        raider(96, 70, 0.9) +
        arrow(84, 82, 52, 82, 3.6),
    },
    "flame-ring": {
      el: "fire",
      draw: () =>
        floorGlow("fire", 64, 84, 52, 20, 0.6) +
        `<path d="${ell(64, 84, 44, 17)}" fill="none" stroke="${F.accent[0]}" stroke-width="7" opacity=".7"/>` +
        glow(ell(64, 84, 44, 17), F.accent[2], 2.4, F.accent[1]) +
        flame(22, 86, 0.5) +
        flame(48, 100, 0.55) +
        flame(84, 100, 0.55) +
        flame(106, 86, 0.5) +
        jumper(104, 72, 22, 0.85) +
        arrow(104, 34, 104, 20),
    },
    "scorched-earth": {
      el: "fire",
      draw: () =>
        [
          [34, 80, 18],
          [86, 68, 14],
          [74, 102, 20],
        ]
          .map(
            ([x, y, r]) =>
              `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${n(r * 0.42)}" fill="#2a0c04" stroke="${F.accent[0]}" stroke-width="2"/>` +
              flame(x - 4, y + 2, r / 22) +
              flame(x + 6, y + 1, r / 30),
          )
          .join("") +
        `<path d="M30 40 l8 -6 l-2 10 l8 -4" stroke="${F.accent[2]}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/>` +
        raider(54, 58, 0.85),
    },
    "heat-mark": {
      el: "fire",
      draw: () =>
        `<path d="M24 102 Q44 92 60 82" stroke="${RED}" stroke-width="2" stroke-dasharray="3 5" fill="none" stroke-linecap="round"/>` +
        danger(ell(66, 82, 24, 10), 0.3) +
        raider(66, 76) +
        mark(66, 52, F.accent[2]) +
        raider(112, 104, 0.75) +
        arrow(84, 70, 104, 54),
    },

    // Storm Twins · Electric
    "link-beam": {
      el: "electric",
      draw: () =>
        twin(20, 44, 11) +
        twin(108, 44, 11) +
        glow(
          bolt(
            [
              [28, 46],
              [100, 46],
            ],
            5,
            4,
          ),
          E.hot,
          2.4,
          E.accent[1],
        ) +
        danger(lane(20, 92, 108, 92, 12), 0.3) +
        jumper(64, 98, 26, 0.9) +
        arrow(64, 56, 64, 42),
    },
    "chain-lightning": {
      el: "electric",
      draw: () =>
        raider(26, 92, 0.85) +
        raider(64, 70, 0.85) +
        raider(102, 94, 0.85) +
        glow(
          bolt(
            [
              [28, 80],
              [62, 58],
              [100, 82],
            ],
            4,
            9,
          ),
          E.hot,
          2.2,
          E.accent[1],
        ) +
        mark(26, 60, RED) +
        arrow(64, 46, 64, 22) +
        arrow(16, 106, 4, 118) +
        arrow(112, 108, 124, 120),
    },
    "static-field": {
      el: "electric",
      draw: () =>
        danger(ell(64, 88, 50, 20), 0.26) +
        glow(
          bolt(
            [
              [26, 88],
              [50, 80],
              [74, 94],
              [100, 84],
            ],
            4,
            5,
          ),
          E.accent[2],
          1.6,
          E.accent[1],
        ) +
        sparks(
          [
            [40, 96, 1.8],
            [88, 98, 1.6],
            [64, 76, 1.4],
          ],
          E.hot,
        ) +
        jumper(64, 70, 22, 0.9) +
        arrow(40, 26, 92, 26),
    },
    "twin-rush": {
      el: "electric",
      draw: () =>
        danger(lane(14, 30, 114, 104, 18), 0.26) +
        danger(lane(114, 30, 14, 104, 18), 0.26) +
        twin(18, 30, 9) +
        twin(110, 30, 9) +
        raider(36, 86, 0.85) +
        arrow(28, 92, 10, 70),
    },
    polarity: {
      el: "electric",
      draw: () =>
        raider(42, 84, 0.95) +
        raider(86, 84, 0.95) +
        sign(42, 52, true, "#ff8a8a") +
        sign(86, 52, false, "#8ad0ff") +
        glow("M52 52 H76", E.accent[2], 1.6, E.accent[1]) +
        `<ellipse cx="64" cy="106" rx="16" ry="6" fill="#8ad0ff" fill-opacity=".3" stroke="#8ad0ff" stroke-width="2"/>`,
    },
    thunderclap: {
      el: "electric",
      draw: () =>
        danger(ell(56, 82, 40, 16), 0.32) +
        twin(56, 62, 13) +
        glow(
          bolt(
            [
              [56, 46],
              [50, 30],
              [60, 16],
            ],
            3,
            2,
          ),
          E.hot,
          2,
          E.accent[1],
        ) +
        raider(80, 86, 0.85) +
        arrow(92, 90, 118, 100),
    },
  };

const cache = new Map<RaidAttack, string>();
/** The illustrated icon for a boss attack, or undefined (no art for it). */
export function bossAttackArt(kind: RaidAttack) {
  const entry = art[kind];
  if (!entry) return undefined;
  let svg = cache.get(kind);
  if (!svg) {
    svg =
      `<svg class="skill-icon skill-art boss-attack-art" data-attack-art="${kind}" viewBox="0 0 128 128" aria-hidden="true" focusable="false">` +
      backdrop(entry.el) +
      entry.draw() +
      `<rect width="128" height="128" fill="url(#sa-vig)"/><rect width="128" height="128" fill="url(#sa-sheen)"/></svg>`;
    cache.set(kind, svg);
  }
  ensureSkillArtDefs();
  return svg;
}
/** Attacks with art (tests check every Hub attack has one). */
export const BOSS_ATTACK_ART = Object.keys(art) as RaidAttack[];

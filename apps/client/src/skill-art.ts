/**
 * Illustrated skill icons: a small painted scene per move (dark element-lit
 * backdrop, a lit subject with glow, sparks), instead of a single-colour
 * line glyph. 128 × 128, with the subject kept inside a centred circle so
 * the same art reads in the round in-match buttons and the rounded squares
 * of the roster and kit lists (the frame is the container's CSS).
 *
 * Cheap to draw: no SVG filters (blurs on five buttons that repaint during
 * cooldowns would cost older phones). Glow is layered translucent strokes
 * and radial gradients. Gradients are defined once per page in a hidden
 * <svg> (ensureSkillArtDefs), so icons repeat without duplicate ids.
 */
type Element =
  | "electric"
  | "fire"
  | "water"
  | "aura"
  | "light"
  | "psychic"
  | "earth"
  | "shadow";
interface Theme {
  /** Backdrop: centre, middle, edge. */
  bg: [string, string, string];
  /** Accent: deep, main, bright. */
  accent: [string, string, string];
  /** The near-white highlight. */
  hot: string;
}
const THEMES: Record<Element, Theme> = {
  electric: {
    bg: ["#4b3d98", "#1b1848", "#06071a"],
    accent: ["#e08a12", "#ffd84a", "#fff3a6"],
    hot: "#fffbe6",
  },
  fire: {
    bg: ["#7c2610", "#371008", "#110404"],
    accent: ["#e2410f", "#ff9a2a", "#ffe08a"],
    hot: "#fffbea",
  },
  water: {
    bg: ["#155a7c", "#082a42", "#020c16"],
    accent: ["#0c7fae", "#3fd0ee", "#bff6ff"],
    hot: "#ffffff",
  },
  aura: {
    bg: ["#3a3f9a", "#161a4c", "#05071a"],
    accent: ["#4b5fe0", "#8fa8ff", "#dfe6ff"],
    hot: "#ffffff",
  },
  light: {
    bg: ["#1d6b5a", "#0b2e2a", "#041311"],
    accent: ["#1fbf8e", "#86f0c0", "#e9fff4"],
    hot: "#fffdf0",
  },
  psychic: {
    bg: ["#7a2a74", "#33113a", "#100515"],
    accent: ["#c4359c", "#ff79d2", "#ffd3f1"],
    hot: "#fff3fb",
  },
  earth: {
    bg: ["#6b4a24", "#2e1f10", "#0f0905"],
    accent: ["#8a5a24", "#d9a85e", "#ffe2a8"],
    hot: "#fff6e0",
  },
  shadow: {
    bg: ["#3e2470", "#180d33", "#060312"],
    accent: ["#6a3fd0", "#a77bff", "#e6d8ff"],
    hot: "#f6f0ff",
  },
};
const ELEMENTS = Object.keys(THEMES) as Element[];

/** Shared gradients, once per page. */
export function skillArtDefs() {
  let d = "";
  for (const el of ELEMENTS) {
    const t = THEMES[el];
    d +=
      `<radialGradient id="sa-bg-${el}" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="${t.bg[0]}"/><stop offset=".55" stop-color="${t.bg[1]}"/><stop offset="1" stop-color="${t.bg[2]}"/></radialGradient>` +
      `<radialGradient id="sa-glow-${el}"><stop offset="0" stop-color="${t.accent[1]}" stop-opacity=".75"/><stop offset=".55" stop-color="${t.accent[1]}" stop-opacity=".22"/><stop offset="1" stop-color="${t.accent[1]}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="sa-core-${el}"><stop offset="0" stop-color="${t.hot}"/><stop offset=".3" stop-color="${t.accent[2]}"/><stop offset=".65" stop-color="${t.accent[1]}" stop-opacity=".7"/><stop offset="1" stop-color="${t.accent[0]}" stop-opacity="0"/></radialGradient>` +
      `<radialGradient id="sa-orb-${el}" cx=".4" cy=".36" r=".62"><stop offset="0" stop-color="${t.hot}"/><stop offset=".3" stop-color="${t.accent[2]}"/><stop offset=".7" stop-color="${t.accent[1]}"/><stop offset="1" stop-color="${t.accent[0]}"/></radialGradient>` +
      `<linearGradient id="sa-up-${el}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${t.accent[0]}"/><stop offset=".6" stop-color="${t.accent[1]}"/><stop offset="1" stop-color="${t.accent[2]}"/></linearGradient>` +
      `<linearGradient id="sa-diag-${el}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="${t.accent[0]}" stop-opacity="0"/><stop offset=".55" stop-color="${t.accent[1]}"/><stop offset="1" stop-color="${t.hot}"/></linearGradient>`;
  }
  d +=
    `<radialGradient id="sa-vig" cx=".5" cy=".46" r=".72"><stop offset=".6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".7"/></radialGradient>` +
    `<linearGradient id="sa-sheen" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".16"/><stop offset=".35" stop-color="#fff" stop-opacity="0"/></linearGradient>`;
  return `<svg class="skill-art-defs" width="0" height="0" aria-hidden="true" focusable="false" style="position:absolute;width:0;height:0;overflow:hidden"><defs>${d}</defs></svg>`;
}
/** Put the shared gradients on the page (once). */
export function ensureSkillArtDefs() {
  if (
    typeof document === "undefined" ||
    document.querySelector(".skill-art-defs")
  )
    return;
  const host = document.createElement("div");
  host.innerHTML = skillArtDefs();
  document.body.prepend(host.firstElementChild!);
}

// ── Drawing helpers ──────────────────────────────────────────────────────
const n = (v: number) => Math.round(v * 10) / 10;
/** A stroke with a soft halo (wide translucent copies underneath). */
function glow(
  d: string,
  color: string,
  width: number,
  halo = color,
  fill = "none",
) {
  return (
    `<path d="${d}" fill="none" stroke="${halo}" stroke-width="${n(width * 4)}" stroke-opacity=".12" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="none" stroke="${halo}" stroke-width="${n(width * 2.2)}" stroke-opacity=".28" stroke-linecap="round" stroke-linejoin="round"/>` +
    `<path d="${d}" fill="${fill}" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`
  );
}
/** A jagged lightning path through the given points (deterministic jitter). */
function bolt(points: [number, number][], jag = 5, seed = 1) {
  let s = seed;
  const rand = () => (s = (s * 9301 + 49297) % 233280) / 233280 - 0.5;
  let d = `M${points[0][0]} ${points[0][1]}`;
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1],
      [x1, y1] = points[i];
    const steps = Math.max(2, Math.round(Math.hypot(x1 - x0, y1 - y0) / 9));
    for (let k = 1; k <= steps; k++) {
      const u = k / steps,
        last = k === steps;
      const nx = -(y1 - y0),
        ny = x1 - x0,
        len = Math.hypot(nx, ny) || 1,
        j = last ? 0 : rand() * jag * 2;
      d += ` L${n(x0 + (x1 - x0) * u + (nx / len) * j)} ${n(y0 + (y1 - y0) * u + (ny / len) * j)}`;
    }
  }
  return d;
}
const sparks = (pts: [number, number, number][], color: string) =>
  pts
    .map(
      ([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}"/>`,
    )
    .join("");
/** Four-point star glint. */
const glint = (x: number, y: number, r: number, color: string) =>
  `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r}Z" fill="${color}"/>`;
const halo = (el: Element, x: number, y: number, r: number, o = 1) =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="url(#sa-glow-${el})" opacity="${o}"/>`;
const floorGlow = (
  el: Element,
  x: number,
  y: number,
  rx: number,
  ry: number,
  o = 1,
) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="url(#sa-glow-${el})" opacity="${o}"/>`;
const backdrop = (el: Element) =>
  `<rect width="128" height="128" fill="url(#sa-bg-${el})"/>`;

// ── The forty moves ──────────────────────────────────────────────────────
const E = THEMES.electric,
  F = THEMES.fire,
  W = THEMES.water,
  A = THEMES.aura,
  L = THEMES.light,
  P = THEMES.psychic,
  R = THEMES.earth,
  S = THEMES.shadow;
const art: Record<string, { el: Element; draw: () => string }> = {
  // Voltkit · Electric
  "Spark Dart": {
    el: "electric",
    draw: () =>
      `<path d="M18 104 L80 46" stroke="url(#sa-diag-electric)" stroke-width="10" stroke-linecap="round" opacity=".35"/>` +
      [
        [22, 88, 70, 40, 1],
        [34, 104, 86, 56, 2],
        [14, 74, 52, 38, 3],
      ]
        .map(
          ([x0, y0, x1, y1, s], i) =>
            `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="url(#sa-diag-electric)" stroke-width="${i === 1 ? 4 : 2.6}" stroke-linecap="round"/>` +
            glow(
              bolt(
                [
                  [x1 - 8, y1 + 8],
                  [x1 + 8, y1 - 8],
                ],
                3,
                s,
              ),
              E.hot,
              i === 1 ? 2.4 : 1.8,
              E.accent[1],
            ),
        )
        .join("") +
      halo("electric", 88, 42, 30) +
      `<circle cx="88" cy="42" r="10" fill="url(#sa-orb-electric)"/>` +
      glow(
        bolt(
          [
            [84, 30],
            [92, 42],
            [86, 54],
          ],
          3,
          7,
        ),
        E.hot,
        2.2,
        E.accent[1],
      ) +
      sparks(
        [
          [104, 30, 1.6],
          [102, 60, 1.4],
          [62, 22, 1.2],
          [26, 54, 1.1],
        ],
        E.accent[2],
      ),
  },
  "Static Lance": {
    el: "electric",
    draw: () =>
      `<path d="M14 98 L96 40 L102 48 L22 106Z" fill="url(#sa-diag-electric)" opacity=".9"/>` +
      glow(
        bolt(
          [
            [18, 101],
            [98, 44],
          ],
          4,
          3,
        ),
        E.hot,
        2.4,
        E.accent[1],
      ) +
      halo("electric", 100, 40, 30) +
      `<path d="M118 26 L92 36 L98 42 L104 52Z" fill="${E.hot}"/><path d="M118 26 L98 42" stroke="${E.accent[1]}" stroke-width="2"/>` +
      // Paralysis: a crackling ring and locked chain links at the tip.
      `<ellipse cx="102" cy="42" rx="18" ry="16" fill="none" stroke="${E.accent[2]}" stroke-width="2" stroke-dasharray="4 4" opacity=".8"/>` +
      glow(
        bolt(
          [
            [86, 30],
            [80, 18],
            [90, 14],
          ],
          3,
          11,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [112, 56],
            [118, 68],
            [108, 74],
          ],
          3,
          13,
        ),
        E.accent[2],
        1.6,
        E.accent[1],
      ) +
      sparks(
        [
          [40, 30, 1.4],
          [24, 60, 1.2],
          [70, 108, 1.5],
        ],
        E.accent[2],
      ),
  },
  "Ball Lightning": {
    el: "electric",
    draw: () =>
      `<g opacity=".35"><circle cx="34" cy="86" r="9" fill="${E.accent[1]}"/><circle cx="22" cy="96" r="6" fill="${E.accent[1]}"/></g>` +
      halo("electric", 68, 60, 50) +
      `<circle cx="68" cy="60" r="28" fill="url(#sa-orb-electric)"/>` +
      `<circle cx="68" cy="60" r="28" fill="none" stroke="${E.hot}" stroke-opacity=".5" stroke-width="1.5"/>` +
      glow(
        bolt(
          [
            [58, 42],
            [70, 58],
            [62, 66],
            [76, 80],
          ],
          2.5,
          5,
        ),
        "#fff",
        2,
        E.accent[2],
      ) +
      [
        [
          [92, 48],
          [104, 40],
          [112, 30],
        ],
        [
          [92, 74],
          [104, 84],
          [110, 96],
        ],
        [
          [44, 74],
          [32, 84],
          [28, 98],
        ],
        [
          [46, 44],
          [34, 34],
          [32, 22],
        ],
      ]
        .map((pts, i) =>
          glow(
            bolt(pts as [number, number][], 3, i + 2),
            E.accent[2],
            2,
            E.accent[1],
          ),
        )
        .join("") +
      `<ellipse cx="58" cy="47" rx="8" ry="5" fill="#fff" opacity=".55" transform="rotate(-30 58 47)"/>` +
      sparks(
        [
          [112, 62, 1.6],
          [18, 56, 1.4],
          [88, 112, 1.5],
        ],
        E.accent[2],
      ),
  },
  "Practice Grid": {
    el: "electric",
    draw: () =>
      `<path d="M8 40 Q22 22 42 30 Q56 14 76 24 Q96 12 120 32 Q110 44 90 40 Q70 48 54 40 Q30 50 8 40Z" fill="#2e2876"/>` +
      `<path d="M14 36 Q30 26 44 32 Q60 20 76 28 Q96 20 114 32" fill="none" stroke="#4d43a8" stroke-width="2"/>` +
      floorGlow("electric", 64, 90, 56, 24) +
      `<ellipse cx="64" cy="90" rx="46" ry="18" fill="#1a1440"/>` +
      `<g stroke="${E.accent[1]}" stroke-width="1.5" opacity=".85">` +
      [74, 82, 90, 98, 106]
        .map((y) => {
          const w = 46 * Math.sqrt(Math.max(0, 1 - ((y - 90) / 18) ** 2));
          return `<path d="M${n(64 - w)} ${y} H${n(64 + w)}"/>`;
        })
        .join("") +
      [-36, -18, 0, 18, 36]
        .map((x) => {
          const h = 18 * Math.sqrt(1 - (x / 46) ** 2);
          return `<path d="M${64 + x} ${n(90 - h)} V${n(90 + h)}"/>`;
        })
        .join("") +
      `</g>` +
      glow(
        `M18 90 A46 18 0 0 0 110 90 A46 18 0 0 0 18 90`,
        E.accent[2],
        2.4,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [40, 40],
            [36, 58],
            [44, 82],
          ],
          4,
          3,
        ),
        E.hot,
        2.2,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [88, 38],
            [94, 60],
            [84, 86],
          ],
          4,
          9,
        ),
        E.hot,
        2.2,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [64, 92],
            [60, 76],
            [66, 66],
          ],
          3,
          4,
        ),
        E.accent[2],
        1.8,
        E.accent[1],
      ) +
      sparks(
        [
          [30, 82, 1.5],
          [100, 98, 1.6],
          [64, 68, 1.3],
        ],
        E.accent[2],
      ),
  },
  "Static Glide": {
    el: "electric",
    draw: () =>
      // A sugar glider sailing on spread membranes over its takeoff pop.
      floorGlow("electric", 64, 100, 50, 14) +
      `<ellipse cx="64" cy="100" rx="44" ry="11" fill="none" stroke="${E.accent[2]}" stroke-width="2.2" opacity=".85"/>` +
      `<ellipse cx="64" cy="100" rx="30" ry="7" fill="none" stroke="${E.accent[1]}" stroke-width="1.4" opacity=".6"/>` +
      halo("electric", 64, 50, 40) +
      `<path d="M22 46 Q40 30 58 38 L64 34 L70 38 Q88 30 106 46 Q92 52 82 64 L70 58 L64 62 L58 58 L46 64 Q36 52 22 46Z" fill="url(#sa-orb-electric)"/>` +
      `<path d="M22 46 Q40 30 58 38 M106 46 Q88 30 70 38" fill="none" stroke="${E.hot}" stroke-width="1.6" opacity=".8"/>` +
      `<ellipse cx="64" cy="44" rx="9" ry="12" fill="${E.accent[1]}"/>` +
      `<circle cx="64" cy="34" r="7" fill="${E.accent[2]}"/><circle cx="61.5" cy="33" r="1.6" fill="${E.bg[2]}"/><circle cx="66.5" cy="33" r="1.6" fill="${E.bg[2]}"/>` +
      `<path d="M64 56 Q66 70 60 80" fill="none" stroke="${E.accent[1]}" stroke-width="4" stroke-linecap="round"/>` +
      glow(
        bolt(
          [
            [30, 74],
            [26, 86],
          ],
          3,
          7,
        ),
        E.hot,
        1.6,
        E.accent[1],
      ) +
      glow(
        bolt(
          [
            [98, 74],
            [102, 86],
          ],
          3,
          9,
        ),
        E.hot,
        1.6,
        E.accent[1],
      ) +
      sparks(
        [
          [16, 30, 1.4],
          [112, 28, 1.4],
          [44, 18, 1.2],
          [86, 16, 1.2],
        ],
        E.accent[2],
      ),
  },
  Overcharge: {
    el: "electric",
    draw: () =>
      floorGlow("electric", 64, 98, 54, 16) +
      `<ellipse cx="64" cy="98" rx="44" ry="12" fill="none" stroke="${E.accent[2]}" stroke-width="2" opacity=".8"/>` +
      `<ellipse cx="64" cy="98" rx="30" ry="8" fill="none" stroke="${E.accent[1]}" stroke-width="1.6" opacity=".6"/>` +
      `<g fill="${E.accent[1]}" opacity=".75">` +
      [0, 1, 2, 3, 4, 5, 6, 7]
        .map((k) => {
          const a = (k / 8) * Math.PI * 2 - Math.PI / 2,
            a1 = a - 0.09,
            a2 = a + 0.09;
          return `<path d="M64 62 L${n(64 + Math.cos(a1) * 54)} ${n(62 + Math.sin(a1) * 54)} L${n(64 + Math.cos(a2) * 54)} ${n(62 + Math.sin(a2) * 54)}Z"/>`;
        })
        .join("") +
      `</g>` +
      halo("electric", 64, 62, 46) +
      `<circle cx="64" cy="62" r="22" fill="url(#sa-core-electric)"/>` +
      [0, 1, 2, 3, 4]
        .map((k) => {
          const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
          return glow(
            bolt(
              [
                [64 + Math.cos(a) * 14, 62 + Math.sin(a) * 14],
                [64 + Math.cos(a) * 46, 62 + Math.sin(a) * 46],
              ],
              4,
              k + 3,
            ),
            E.hot,
            2.2,
            E.accent[1],
          );
        })
        .join("") +
      `<circle cx="64" cy="62" r="8" fill="#fff"/>` +
      sparks(
        [
          [24, 30, 1.5],
          [104, 24, 1.4],
          [112, 70, 1.6],
          [16, 72, 1.4],
        ],
        E.accent[2],
      ),
  },

  // Cindrake · Fire
  "Cinder Snap": {
    el: "fire",
    draw: () =>
      halo("fire", 70, 60, 44) +
      // A crescent bite of flame snapping forward.
      `<path d="M30 92 Q32 44 76 30 Q104 24 112 46 Q96 36 78 44 Q52 56 50 92Z" fill="url(#sa-up-fire)"/>` +
      `<path d="M38 88 Q42 54 76 40 Q94 34 104 42 Q86 42 74 50 Q56 62 56 88Z" fill="${F.accent[2]}" opacity=".85"/>` +
      `<path d="M60 84 Q62 64 80 54" stroke="${F.hot}" stroke-width="3" fill="none" stroke-linecap="round"/>` +
      [
        [98, 58],
        [106, 70],
        [94, 76],
      ]
        .map(
          ([x, y], i) =>
            `<path d="M${x} ${y} q6 -8 2 -14 q8 6 4 16 q-3 4 -6 -2Z" fill="${i ? F.accent[1] : F.accent[2]}"/>`,
        )
        .join("") +
      sparks(
        [
          [24, 40, 1.6],
          [92, 22, 1.3],
          [110, 92, 1.4],
          [44, 106, 1.2],
        ],
        F.accent[2],
      ),
  },
  "Crest Flare": {
    el: "fire",
    draw: () =>
      // A widening cone of flame from the lower left.
      `<path d="M16 100 L104 18 Q120 50 112 84Z" fill="url(#sa-glow-fire)" opacity=".9"/>` +
      `<path d="M18 98 Q60 60 100 30 Q104 52 98 70 Q70 74 18 98Z" fill="url(#sa-diag-fire)"/>` +
      `<path d="M20 96 Q60 66 104 58 Q100 76 92 88 Q60 86 20 96Z" fill="${F.accent[1]}" opacity=".75"/>` +
      `<path d="M22 96 Q58 72 92 64" stroke="${F.hot}" stroke-width="3" fill="none" stroke-linecap="round" opacity=".9"/>` +
      `<circle cx="20" cy="98" r="9" fill="url(#sa-core-fire)"/>` +
      sparks(
        [
          [96, 26, 1.8],
          [110, 46, 1.5],
          [102, 96, 1.4],
          [76, 22, 1.3],
          [118, 70, 1.2],
        ],
        F.accent[2],
      ) +
      `<g fill="none" stroke="${F.accent[2]}" stroke-width="1.6" stroke-linecap="round" opacity=".7"><path d="M60 40 q6 -6 12 -4"/><path d="M84 92 q8 2 12 -4"/></g>`,
  },
  "Magma Bomb": {
    el: "fire",
    draw: () =>
      `<path d="M14 104 Q30 70 52 62" stroke="url(#sa-diag-fire)" stroke-width="10" stroke-linecap="round" fill="none" opacity=".55"/>` +
      halo("fire", 70, 56, 46) +
      `<circle cx="70" cy="56" r="26" fill="#3a1408"/>` +
      // Cracked magma rock, glowing seams.
      `<circle cx="70" cy="56" r="26" fill="url(#sa-orb-fire)" opacity=".55"/>` +
      glow(
        `M56 44 L66 54 L60 62 L72 70 M76 38 L72 52 L84 58 M84 66 L78 74`,
        F.accent[2],
        2.4,
        F.accent[1],
      ) +
      `<path d="M70 30 q-4 -12 4 -20 q2 10 10 12 q-6 4 -14 8Z" fill="url(#sa-up-fire)"/>` +
      `<path d="M88 36 q4 -10 12 -12 q-2 8 2 14Z" fill="${F.accent[1]}"/>` +
      `<ellipse cx="62" cy="46" rx="7" ry="4" fill="#fff" opacity=".35" transform="rotate(-30 62 46)"/>` +
      sparks(
        [
          [104, 70, 1.8],
          [100, 88, 1.4],
          [30, 40, 1.3],
          [96, 18, 1.2],
        ],
        F.accent[2],
      ),
  },
  "Heat Cracks": {
    el: "fire",
    draw: () =>
      floorGlow("fire", 64, 96, 54, 16) +
      // A spiral tornado of flame.
      [0, 1, 2, 3]
        .map((k) => {
          const y = 92 - k * 18,
            rx = 40 - k * 6,
            ry = 10 - k;
          return `<path d="M${64 - rx} ${y} A${rx} ${ry} 0 0 0 ${64 + rx} ${y}" fill="none" stroke="${k % 2 ? F.accent[1] : F.accent[2]}" stroke-width="${5 - k * 0.6}" stroke-linecap="round" opacity="${0.95 - k * 0.12}"/><path d="M${64 + rx} ${y} A${rx} ${ry} 0 0 0 ${64 - rx} ${y}" fill="none" stroke="${F.accent[0]}" stroke-width="${3 - k * 0.4}" stroke-linecap="round" opacity=".5"/>`;
        })
        .join("") +
      `<path d="M64 98 Q50 70 62 46 Q66 36 64 22 Q80 40 72 62 Q68 80 64 98Z" fill="url(#sa-up-fire)" opacity=".9"/>` +
      `<path d="M64 92 Q58 72 64 56 Q70 72 64 92Z" fill="${F.hot}" opacity=".8"/>` +
      [
        [24, 70],
        [104, 64],
        [30, 44],
        [98, 40],
      ]
        .map(
          ([x, y], i) =>
            `<path d="M${x} ${y} q5 -7 1 -12 q7 5 3 13 q-2 3 -4 -1Z" fill="${i % 2 ? F.accent[1] : F.accent[2]}"/>`,
        )
        .join("") +
      sparks(
        [
          [20, 90, 1.5],
          [110, 86, 1.4],
          [64, 14, 1.3],
        ],
        F.accent[2],
      ),
  },
  "Sunfire Pillar": {
    el: "fire",
    draw: () =>
      floorGlow("fire", 64, 104, 50, 14) +
      `<ellipse cx="64" cy="104" rx="34" ry="9" fill="none" stroke="${F.accent[2]}" stroke-width="2" opacity=".85"/>` +
      `<rect x="40" y="0" width="48" height="104" fill="url(#sa-glow-fire)" opacity=".8"/>` +
      `<path d="M46 104 Q42 60 52 30 Q58 12 64 0 Q70 12 76 30 Q86 60 82 104Z" fill="url(#sa-up-fire)"/>` +
      `<path d="M54 104 Q52 66 60 36 Q64 22 64 8 Q68 24 70 40 Q76 70 74 104Z" fill="${F.accent[2]}"/>` +
      `<path d="M60 104 Q60 70 64 44 Q68 70 68 104Z" fill="${F.hot}"/>` +
      // A sun disc at the crown.
      `<circle cx="64" cy="22" r="12" fill="url(#sa-core-fire)"/>` +
      [0, 1, 2, 3, 4, 5]
        .map((k) => {
          const a = (k / 6) * Math.PI * 2;
          return `<path d="M${n(64 + Math.cos(a) * 16)} ${n(22 + Math.sin(a) * 16)} L${n(64 + Math.cos(a) * 24)} ${n(22 + Math.sin(a) * 24)}" stroke="${F.accent[2]}" stroke-width="2" stroke-linecap="round"/>`;
        })
        .join("") +
      sparks(
        [
          [28, 80, 1.6],
          [100, 74, 1.5],
          [24, 50, 1.2],
          [106, 44, 1.3],
        ],
        F.accent[2],
      ),
  },

  // Tidefin · Water
  "Tide Needle": {
    el: "water",
    draw: () =>
      `<path d="M14 100 Q60 84 96 40" stroke="url(#sa-diag-water)" stroke-width="7" fill="none" stroke-linecap="round" opacity=".5"/>` +
      halo("water", 94, 40, 26) +
      // A slim water needle with a droplet head.
      `<path d="M26 98 Q66 80 96 40 L102 46 Q72 86 30 104Z" fill="url(#sa-diag-water)"/>` +
      `<path d="M106 26 Q104 40 94 46 Q90 38 96 30 Q100 26 106 26Z" fill="${W.accent[2]}"/>` +
      `<path d="M104 30 Q102 38 96 42" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round"/>` +
      [
        [44, 96],
        [60, 88],
        [74, 74],
      ]
        .map(
          ([x, y], i) =>
            `<circle cx="${x}" cy="${y}" r="${2.6 - i * 0.5}" fill="${W.accent[2]}"/>`,
        )
        .join("") +
      `<g fill="none" stroke="${W.accent[1]}" stroke-width="1.4" opacity=".4"><path d="M8 112 Q30 106 52 112 T96 112 T128 110"/></g>` +
      sparks(
        [
          [112, 56, 1.5],
          [84, 22, 1.3],
          [24, 62, 1.2],
        ],
        W.accent[2],
      ),
  },
  "Gill Spray": {
    el: "water",
    draw: () => {
      // Three water droplets flicked from the gill fronds in a narrow fan.
      const drop = (x: number, y: number, s: number, rot: number) =>
        `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M0 -15 Q11 0 8 7 Q4 14 0 14 Q-4 14 -8 7 Q-11 0 0 -15Z" fill="url(#sa-orb-water)"/><ellipse cx="-3" cy="2" rx="2.4" ry="4" fill="#fff" opacity=".85"/></g>`;
      return (
        [
          [64, 30],
          [96, 52],
          [30, 56],
        ]
          .map(
            ([x, y]) =>
              `<path d="M64 108 L${x} ${y}" stroke="url(#sa-diag-water)" stroke-width="3" stroke-linecap="round" opacity=".55"/>`,
          )
          .join("") +
        halo("water", 64, 34, 22) +
        halo("water", 98, 54, 20) +
        halo("water", 30, 58, 20) +
        drop(64, 32, 1.1, 0) +
        drop(98, 54, 0.95, 50) +
        drop(30, 58, 0.95, -50) +
        `<path d="M40 110 Q52 96 64 104 Q76 96 88 110" fill="none" stroke="#ff9fc4" stroke-width="5" stroke-linecap="round" opacity=".8"/>` +
        sparks(
          [
            [80, 20, 1.4],
            [112, 74, 1.3],
            [16, 80, 1.2],
            [46, 18, 1.2],
          ],
          W.accent[2],
        )
      );
    },
  },
  Eddy: {
    el: "water",
    draw: () =>
      floorGlow("water", 64, 70, 58, 36, 0.8) +
      [0, 1, 2, 3, 4]
        .map((k) => {
          const r = 48 - k * 9;
          return `<path d="M${64 - r} 70 A${r} ${r * 0.55} 0 1 1 ${64 + r * 0.6} ${70 + r * 0.44}" fill="none" stroke="${k % 2 ? W.accent[1] : W.accent[2]}" stroke-width="${4.4 - k * 0.6}" stroke-linecap="round" opacity="${0.95 - k * 0.1}" transform="rotate(${k * 34} 64 70)"/>`;
        })
        .join("") +
      `<ellipse cx="64" cy="70" rx="8" ry="4.5" fill="${W.bg[2]}"/>` +
      `<ellipse cx="64" cy="70" rx="12" ry="7" fill="none" stroke="#fff" stroke-width="1.6" opacity=".8"/>` +
      [
        [24, 40],
        [104, 36],
        [110, 96],
        [20, 98],
      ]
        .map(
          ([x, y]) =>
            `<path d="M${x} ${y} q3 -6 0 -9 q-3 3 0 9Z" fill="${W.accent[2]}"/>`,
        )
        .join("") +
      sparks(
        [
          [64, 22, 1.5],
          [36, 26, 1.2],
        ],
        W.accent[2],
      ),
  },
  "Tide Double": {
    el: "water",
    draw: () =>
      // A misty decoy silhouette beside the real dash streaks.
      `<ellipse cx="44" cy="62" rx="26" ry="40" fill="url(#sa-glow-water)" opacity=".7"/>` +
      `<g opacity=".55"><circle cx="44" cy="44" r="12" fill="${W.accent[2]}"/><path d="M26 98 Q26 62 44 58 Q62 62 62 98Z" fill="${W.accent[2]}"/></g>` +
      `<g fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 4" opacity=".75"><circle cx="44" cy="44" r="12"/><path d="M26 98 Q26 62 44 58 Q62 62 62 98"/></g>` +
      [
        [70, 46, 118, 34],
        [72, 64, 122, 60],
        [70, 82, 116, 88],
      ]
        .map(([x0, y0, x1, y1], i) =>
          glow(
            `M${x0} ${y0} L${x1} ${y1}`,
            i === 1 ? W.hot : W.accent[2],
            i === 1 ? 3 : 2,
            W.accent[1],
          ),
        )
        .join("") +
      `<path d="M10 104 Q30 96 50 104 T90 104" fill="none" stroke="${W.accent[1]}" stroke-width="2" opacity=".5"/>` +
      sparks(
        [
          [86, 24, 1.4],
          [20, 30, 1.2],
          [104, 104, 1.3],
        ],
        W.accent[2],
      ),
  },
  "Riptide Wave": {
    el: "water",
    draw: () =>
      // A towering breaking wave, curling over.
      `<path d="M0 112 Q20 104 34 84 Q48 50 78 34 Q106 22 118 44 Q104 38 92 46 Q84 52 88 62 Q96 74 116 70 Q104 92 76 98 Q40 104 20 128 H0Z" fill="url(#sa-up-water)"/>` +
      `<path d="M30 92 Q46 58 78 42 Q100 32 112 44 Q100 42 90 50 Q80 58 86 70" fill="none" stroke="${W.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
      `<path d="M40 86 Q54 62 76 52" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/>` +
      [
        [116, 46, 3],
        [122, 58, 2.4],
        [110, 32, 2],
        [100, 24, 1.6],
        [122, 72, 2],
      ]
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${W.accent[2]}"/>`,
        )
        .join("") +
      `<path d="M0 118 Q30 110 60 116 T128 112 V128 H0Z" fill="${W.accent[0]}" opacity=".7"/>` +
      glow(`M20 70 L4 70 M24 56 L10 54`, W.accent[2], 2, W.accent[1]),
  },

  // Auralynx · Aura
  "Prism Jab": {
    el: "aura",
    draw: () =>
      halo("aura", 70, 60, 46) +
      // A crystal fist punching through a burst.
      [0, 1, 2, 3, 4, 5, 6, 7]
        .map((k) => {
          const a = (k / 8) * Math.PI * 2;
          return `<path d="M${n(84 + Math.cos(a) * 14)} ${n(48 + Math.sin(a) * 14)} L${n(84 + Math.cos(a) * 34)} ${n(48 + Math.sin(a) * 34)}" stroke="${A.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".7"/>`;
        })
        .join("") +
      `<path d="M30 94 L52 72 L60 80 L38 102Z" fill="${A.accent[0]}"/>` +
      `<path d="M50 70 L70 46 L92 42 L98 56 L90 70 L66 84Z" fill="url(#sa-orb-aura)"/>` +
      `<path d="M70 46 L80 60 L66 84 M80 60 L98 56 M80 60 L92 42" stroke="#fff" stroke-width="1.6" fill="none" opacity=".75"/>` +
      `<path d="M52 72 L66 84" stroke="${A.accent[2]}" stroke-width="3"/>` +
      glint(84, 48, 12, "#fff") +
      sparks(
        [
          [24, 40, 1.4],
          [108, 92, 1.5],
          [40, 20, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Prism Shot": {
    el: "aura",
    draw: () =>
      `<path d="M16 104 L82 48" stroke="url(#sa-diag-aura)" stroke-width="12" stroke-linecap="round" opacity=".5"/>` +
      halo("aura", 86, 44, 32) +
      // A faceted crystal shard flying, refracting rainbow edges.
      `<path d="M66 60 L88 26 L112 34 L104 58 L80 68Z" fill="url(#sa-orb-aura)"/>` +
      `<path d="M88 26 L90 50 L66 60 M90 50 L112 34 M90 50 L104 58 L80 68" stroke="#fff" stroke-width="1.5" fill="none" opacity=".8"/>` +
      `<path d="M62 64 L30 92" stroke="#ff9ad0" stroke-width="2" opacity=".7"/><path d="M66 68 L36 98" stroke="#9affd8" stroke-width="2" opacity=".7"/><path d="M58 60 L26 86" stroke="#fff3a0" stroke-width="2" opacity=".7"/>` +
      glint(100, 32, 9, "#fff") +
      sparks(
        [
          [112, 70, 1.5],
          [44, 30, 1.3],
          [96, 98, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Shatter Paw": {
    el: "aura",
    draw: () =>
      // A crystal-gauntleted lynx paw, a shockwave cracking outward.
      [0, 1, 2]
        .map(
          (k) =>
            `<path d="M${76 + k * 10} ${20 + k * 2} A${30 + k * 12} ${40 + k * 12} 0 0 1 ${76 + k * 10} ${108 - k * 2}" fill="none" stroke="${k ? A.accent[1] : A.accent[2]}" stroke-width="${4 - k}" stroke-linecap="round" opacity="${0.95 - k * 0.25}"/>`,
        )
        .join("") +
      halo("aura", 54, 64, 40) +
      `<ellipse cx="54" cy="72" rx="22" ry="20" fill="url(#sa-orb-aura)"/>` +
      [
        [36, 46, 8],
        [50, 40, 8.5],
        [64, 42, 8],
        [74, 52, 7],
      ]
        .map(
          ([x, y, r]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${r}" ry="${r + 1.5}" fill="url(#sa-orb-aura)"/>`,
        )
        .join("") +
      `<path d="M44 84 L54 64 L64 84 L54 96Z" fill="${A.hot}" opacity=".85"/><path d="M54 64 V96" stroke="${A.accent[0]}" stroke-width="1.2" opacity=".6"/>` +
      glow(
        `M96 40 L106 52 L100 60 L112 70 M100 86 L110 94`,
        "#fff",
        1.8,
        A.accent[1],
      ) +
      sparks(
        [
          [116, 30, 1.5],
          [118, 100, 1.4],
          [20, 30, 1.2],
        ],
        A.accent[2],
      ),
  },
  "Facet Guard": {
    el: "aura",
    draw: () =>
      halo("aura", 64, 62, 50) +
      // A faceted crystal shield bouncing a bolt back.
      `<path d="M64 14 L102 30 L96 78 L64 106 L32 78 L26 30Z" fill="url(#sa-orb-aura)" opacity=".9"/>` +
      `<path d="M64 14 L64 106 M26 30 L102 30 M32 78 L96 78 M26 30 L64 60 L102 30 M32 78 L64 60 L96 78" stroke="#fff" stroke-width="1.4" fill="none" opacity=".55"/>` +
      `<path d="M64 14 L102 30 L96 78 L64 106 L32 78 L26 30Z" fill="none" stroke="${A.accent[2]}" stroke-width="2.4"/>` +
      glow(`M8 44 L40 56`, "#ff9a9a", 2.4, "#ff6a6a") +
      glow(`M40 56 L10 76`, A.hot, 2.4, A.accent[1]) +
      `<path d="M10 76 l8 -1 l-4 7Z" fill="#fff"/>` +
      glint(78, 40, 9, "#fff") +
      sparks(
        [
          [110, 98, 1.5],
          [116, 54, 1.3],
        ],
        A.accent[2],
      ),
  },
  "Shard Nova": {
    el: "aura",
    draw: () =>
      floorGlow("aura", 64, 98, 54, 16) +
      `<ellipse cx="64" cy="98" rx="44" ry="12" fill="none" stroke="${A.accent[2]}" stroke-width="2" opacity=".8"/>` +
      halo("aura", 64, 60, 52) +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9]
        .map((k) => {
          const a = (k / 10) * Math.PI * 2,
            r1 = k % 2 ? 34 : 50;
          return `<path d="M64 60 L${n(64 + Math.cos(a - 0.12) * 18)} ${n(60 + Math.sin(a - 0.12) * 18)} L${n(64 + Math.cos(a) * r1)} ${n(60 + Math.sin(a) * r1)} L${n(64 + Math.cos(a + 0.12) * 18)} ${n(60 + Math.sin(a + 0.12) * 18)}Z" fill="${k % 2 ? A.accent[1] : A.accent[2]}" opacity=".9"/>`;
        })
        .join("") +
      `<circle cx="64" cy="60" r="20" fill="url(#sa-core-aura)"/>` +
      `<path d="M64 46 L74 60 L64 74 L54 60Z" fill="#fff"/>` +
      sparks(
        [
          [20, 26, 1.5],
          [108, 22, 1.4],
          [114, 76, 1.5],
        ],
        A.accent[2],
      ),
  },

  // Lumoth · Light
  Glint: {
    el: "light",
    draw: () =>
      `<path d="M16 102 Q48 84 80 50" stroke="url(#sa-diag-light)" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>` +
      [
        [34, 90, 1.8],
        [48, 80, 1.5],
        [60, 70, 1.3],
      ]
        .map(
          ([x, y, r]) =>
            `<circle cx="${x}" cy="${y}" r="${r}" fill="${L.accent[2]}"/>`,
        )
        .join("") +
      halo("light", 84, 46, 36) +
      glint(84, 46, 24, L.accent[1]) +
      glint(84, 46, 14, L.hot) +
      `<circle cx="84" cy="46" r="4" fill="#fff"/>` +
      glint(108, 78, 6, L.accent[2]) +
      glint(40, 30, 5, L.accent[2]) +
      sparks(
        [
          [106, 24, 1.3],
          [22, 60, 1.2],
        ],
        L.accent[2],
      ),
  },
  "Wing Dust": {
    el: "light",
    draw: () =>
      [
        [-50, 0.9],
        [-25, 1],
        [0, 1.2],
        [25, 1],
        [50, 0.9],
      ]
        .map(([deg, s], i) => {
          const a = ((deg - 90) * Math.PI) / 180,
            x = n(64 + Math.cos(a) * 46),
            y = n(104 + Math.sin(a) * 76);
          return (
            `<path d="M64 104 L${x} ${y}" stroke="url(#sa-diag-light)" stroke-width="2.4" stroke-linecap="round" opacity=".6"/>` +
            halo("light", x, y, 12 * s) +
            glint(x, y, 10 * s, i === 2 ? L.hot : L.accent[2])
          );
        })
        .join("") +
      `<ellipse cx="64" cy="106" rx="20" ry="5" fill="url(#sa-glow-light)"/>` +
      sparks(
        [
          [20, 50, 1.2],
          [108, 46, 1.3],
          [64, 12, 1.4],
        ],
        L.accent[2],
      ),
  },
  "Eyespot Flash": {
    el: "light",
    draw: () => {
      // Two wings snap open, their big eyespots flaring.
      const spot = (x: number, y: number) =>
        `<circle cx="${x}" cy="${y}" r="15" fill="${L.hot}"/><circle cx="${x}" cy="${y}" r="11" fill="${L.accent[1]}"/><circle cx="${x}" cy="${y}" r="6.5" fill="${L.bg[2]}"/><circle cx="${x - 2.4}" cy="${y - 2.6}" r="2.2" fill="#fff"/>`;
      return (
        halo("light", 64, 60, 50) +
        [0, 1, 2, 3, 4, 5, 6, 7]
          .map((k) => {
            const a = (k / 8) * Math.PI * 2,
              x0 = 64 + Math.cos(a) * 46,
              y0 = 60 + Math.sin(a) * 46,
              x1 = 64 + Math.cos(a) * 58,
              y1 = 60 + Math.sin(a) * 58;
            return `<path d="M${n(x0)} ${n(y0)} L${n(x1)} ${n(y1)}" stroke="${L.accent[2]}" stroke-width="2.4" stroke-linecap="round" opacity=".8"/>`;
          })
          .join("") +
        `<path d="M62 58 Q34 20 14 40 Q8 70 34 82 Q50 86 62 70Z" fill="url(#sa-up-light)"/>` +
        `<path d="M66 58 Q94 20 114 40 Q120 70 94 82 Q78 86 66 70Z" fill="url(#sa-up-light)"/>` +
        `<ellipse cx="64" cy="66" rx="5" ry="16" fill="${L.accent[0]}"/>` +
        spot(38, 56) +
        spot(90, 56) +
        sparks(
          [
            [22, 100, 1.4],
            [106, 100, 1.4],
            [64, 108, 1.3],
            [64, 14, 1.3],
          ],
          L.accent[2],
        )
      );
    },
  },
  Kindle: {
    el: "light",
    draw: () =>
      floorGlow("light", 64, 100, 46, 12) +
      halo("light", 64, 58, 50) +
      // An empowering flame-light rising through two upward chevrons.
      `<path d="M64 100 Q40 80 48 54 Q52 66 58 68 Q52 46 66 22 Q70 42 82 50 Q90 76 64 100Z" fill="url(#sa-up-light)"/>` +
      `<path d="M64 94 Q52 80 58 64 Q62 72 66 72 Q66 58 72 50 Q80 74 64 94Z" fill="${L.hot}"/>` +
      `<path d="M24 64 L36 52 L48 64 M80 64 L92 52 L104 64" fill="none" stroke="${L.accent[2]}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>` +
      `<path d="M24 80 L36 68 L48 80 M80 80 L92 68 L104 80" fill="none" stroke="${L.accent[1]}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7"/>` +
      glint(96, 26, 6, L.hot) +
      glint(30, 30, 5, L.accent[2]),
  },
  "Radiant Flare": {
    el: "light",
    draw: () =>
      floorGlow("light", 64, 98, 54, 16) +
      halo("light", 64, 60, 54) +
      [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
        .map((k) => {
          const a = (k / 12) * Math.PI * 2,
            r = k % 2 ? 36 : 52;
          return `<path d="M${n(64 + Math.cos(a) * 16)} ${n(60 + Math.sin(a) * 16)} L${n(64 + Math.cos(a) * r)} ${n(60 + Math.sin(a) * r)}" stroke="${k % 2 ? L.accent[1] : L.accent[2]}" stroke-width="${k % 2 ? 2.4 : 3.4}" stroke-linecap="round"/>`;
        })
        .join("") +
      `<circle cx="64" cy="60" r="20" fill="url(#sa-core-light)"/>` +
      glint(64, 60, 14, "#fff") +
      sparks(
        [
          [22, 24, 1.4],
          [106, 20, 1.5],
          [112, 96, 1.3],
          [16, 92, 1.3],
        ],
        L.accent[2],
      ),
  },

  // Mystowl · Psychic
  "Mind Dart": {
    el: "psychic",
    draw: () =>
      `<path d="M14 102 Q50 92 84 50" stroke="url(#sa-diag-psychic)" stroke-width="8" fill="none" stroke-linecap="round" opacity=".5"/>` +
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="${46 + k * 12}" cy="${86 - k * 12}" rx="${7 - k}" ry="${3.5 - k * 0.4}" fill="none" stroke="${P.accent[2]}" stroke-width="1.4" opacity="${0.4 + k * 0.2}" transform="rotate(-40 ${46 + k * 12} ${86 - k * 12})"/>`,
        )
        .join("") +
      halo("psychic", 88, 44, 30) +
      // A darting eye of psychic energy.
      `<path d="M70 52 Q88 30 108 34 Q100 52 78 60Z" fill="url(#sa-orb-psychic)"/>` +
      `<circle cx="92" cy="42" r="6" fill="#fff"/><circle cx="93" cy="42" r="3" fill="${P.accent[0]}"/>` +
      sparks(
        [
          [110, 60, 1.5],
          [70, 22, 1.3],
          [24, 70, 1.2],
        ],
        P.accent[2],
      ),
  },
  "Third-Eye Ray": {
    el: "psychic",
    draw: () =>
      // A third-eye firing a straight beam.
      `<path d="M42 64 L128 50 L128 78Z" fill="url(#sa-glow-psychic)"/>` +
      `<path d="M44 62 L128 58 L128 70 L44 66Z" fill="${P.accent[2]}"/>` +
      `<path d="M44 63.5 L128 63 L128 65 L44 64.5Z" fill="#fff"/>` +
      [80, 100, 118]
        .map(
          (x, i) =>
            `<ellipse cx="${x}" cy="64" rx="${4 + i}" ry="${12 + i * 3}" fill="none" stroke="${P.accent[2]}" stroke-width="1.6" opacity="${0.8 - i * 0.2}"/>`,
        )
        .join("") +
      halo("psychic", 38, 64, 30) +
      `<path d="M14 64 Q38 40 62 64 Q38 88 14 64Z" fill="url(#sa-orb-psychic)"/>` +
      `<circle cx="38" cy="64" r="10" fill="#fff"/><circle cx="40" cy="64" r="5.5" fill="${P.accent[0]}"/><circle cx="42" cy="62" r="2" fill="#fff"/>` +
      sparks(
        [
          [20, 30, 1.4],
          [30, 100, 1.3],
          [70, 30, 1.2],
        ],
        P.accent[2],
      ),
  },
  "Booming Hoot": {
    el: "psychic",
    draw: () =>
      halo("psychic", 64, 64, 30) +
      [0, 1, 2]
        .map(
          (k) =>
            `<circle cx="64" cy="64" r="${24 + k * 13}" fill="none" stroke="${k ? P.accent[1] : P.accent[2]}" stroke-width="${4 - k}" opacity="${0.95 - k * 0.25}"/>`,
        )
        .join("") +
      [0, 1, 2, 3]
        .map((k) => {
          const a = (k / 4) * Math.PI * 2 + Math.PI / 4,
            x = 64 + Math.cos(a) * 46,
            y = 64 + Math.sin(a) * 46,
            ax = Math.cos(a) * 9,
            ay = Math.sin(a) * 9;
          return `<path d="M${n(x - ax)} ${n(y - ay)} L${n(x + ax)} ${n(y + ay)} M${n(x + ax - ay * 0.6 - ax * 0.5)} ${n(y + ay + ax * 0.6 - ay * 0.5)} L${n(x + ax)} ${n(y + ay)} L${n(x + ax + ay * 0.6 - ax * 0.5)} ${n(y + ay - ax * 0.6 - ay * 0.5)}" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
        })
        .join("") +
      `<circle cx="64" cy="64" r="14" fill="url(#sa-core-psychic)"/>` +
      `<path d="M52 64 Q64 54 76 64 Q64 74 52 64Z" fill="#fff"/><circle cx="64" cy="64" r="3.5" fill="${P.accent[0]}"/>`,
  },
  "Wing Cloak": {
    el: "psychic",
    draw: () =>
      halo("psychic", 64, 62, 50) +
      // A hexagonal psychic barrier.
      `<path d="M64 14 L106 38 L106 86 L64 110 L22 86 L22 38Z" fill="url(#sa-glow-psychic)"/>` +
      `<path d="M64 14 L106 38 L106 86 L64 110 L22 86 L22 38Z" fill="none" stroke="${P.accent[2]}" stroke-width="3"/>` +
      `<g stroke="${P.accent[1]}" stroke-width="1.4" opacity=".7" fill="none"><path d="M64 30 L92 46 L92 78 L64 94 L36 78 L36 46Z"/><path d="M64 14 V30 M106 38 L92 46 M106 86 L92 78 M64 110 V94 M22 86 L36 78 M22 38 L36 46"/></g>` +
      `<path d="M48 62 Q64 46 80 62 Q64 78 48 62Z" fill="#fff"/><circle cx="64" cy="62" r="5" fill="${P.accent[0]}"/>` +
      glow(`M114 30 L96 44`, "#ffb0b0", 2, "#ff6a6a") +
      `<circle cx="96" cy="44" r="4" fill="#fff" opacity=".8"/>` +
      sparks(
        [
          [16, 20, 1.3],
          [112, 108, 1.4],
        ],
        P.accent[2],
      ),
  },
  "Silent Swoop": {
    el: "psychic",
    draw: () =>
      floorGlow("psychic", 64, 92, 50, 18) +
      // A target circle, then the psychic blast falling from above.
      `<ellipse cx="64" cy="92" rx="40" ry="13" fill="none" stroke="${P.accent[2]}" stroke-width="2.4"/>` +
      `<ellipse cx="64" cy="92" rx="26" ry="8" fill="none" stroke="${P.accent[1]}" stroke-width="1.8" stroke-dasharray="4 4"/>` +
      `<path d="M46 0 L82 0 L70 90 L58 90Z" fill="url(#sa-glow-psychic)"/>` +
      `<path d="M58 0 L70 0 L66 88 L62 88Z" fill="${P.accent[2]}"/>` +
      halo("psychic", 64, 86, 26) +
      `<circle cx="64" cy="86" r="10" fill="url(#sa-core-psychic)"/>` +
      `<path d="M46 34 Q64 18 82 34 Q64 50 46 34Z" fill="url(#sa-orb-psychic)"/><circle cx="64" cy="34" r="6" fill="#fff"/><circle cx="64" cy="34" r="3" fill="${P.accent[0]}"/>` +
      sparks(
        [
          [22, 70, 1.5],
          [106, 72, 1.5],
          [30, 104, 1.2],
          [100, 106, 1.2],
        ],
        P.accent[2],
      ),
  },

  // Terradon · Earth
  "Boulder Swipe": {
    el: "earth",
    draw: () =>
      // A wide arc of rock and dust swung across.
      `<path d="M16 90 Q24 36 76 24 Q108 20 118 40 Q100 34 80 38 Q40 48 30 94Z" fill="url(#sa-up-earth)" opacity=".85"/>` +
      `<path d="M22 92 Q30 46 76 32 Q98 28 110 36" fill="none" stroke="${R.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
      [
        [96, 46, 12],
        [108, 64, 9],
        [84, 70, 7],
      ]
        .map(
          ([x, y, r], i) =>
            `<path d="M${x - r} ${y} L${x - r * 0.4} ${y - r} L${x + r * 0.7} ${y - r * 0.8} L${x + r} ${y + r * 0.2} L${x + r * 0.3} ${y + r} L${x - r * 0.7} ${y + r * 0.7}Z" fill="${i ? R.accent[0] : R.accent[1]}" stroke="${R.accent[2]}" stroke-width="1.4"/>`,
        )
        .join("") +
      `<g fill="${R.accent[2]}" opacity=".5"><circle cx="40" cy="104" r="6"/><circle cx="54" cy="110" r="4"/><circle cx="28" cy="110" r="3"/></g>` +
      sparks(
        [
          [118, 82, 1.6],
          [70, 92, 1.2],
          [26, 40, 1.2],
        ],
        R.accent[2],
      ),
  },
  "Shell Bash": {
    el: "earth",
    draw: () =>
      floorGlow("earth", 64, 100, 52, 14) +
      // A heavy shell crashing down, stars of a stun.
      `<path d="M30 84 Q30 40 64 36 Q98 40 98 84Z" fill="url(#sa-up-earth)"/>` +
      `<path d="M30 84 Q30 40 64 36 Q98 40 98 84Z" fill="none" stroke="${R.accent[2]}" stroke-width="2.4"/>` +
      `<g fill="none" stroke="${R.accent[0]}" stroke-width="2"><path d="M64 36 V84 M44 46 L52 84 M84 46 L76 84 M34 64 H94"/></g>` +
      `<path d="M20 98 L34 86 L94 86 L108 98" fill="none" stroke="${R.accent[2]}" stroke-width="3" stroke-linecap="round"/>` +
      glow(
        `M14 96 L4 90 M114 96 L124 90 M24 104 L14 108 M104 104 L114 108`,
        R.accent[2],
        2,
        R.accent[1],
      ) +
      glint(44, 22, 6, "#fff3c0") +
      glint(64, 14, 7, "#fff3c0") +
      glint(84, 22, 6, "#fff3c0"),
  },
  "Shell Up": {
    el: "earth",
    draw: () =>
      halo("earth", 64, 70, 46, 0.8) +
      // A tortoise shell pulled shut, plates glowing, moss on top, regrowing.
      `<ellipse cx="64" cy="70" rx="48" ry="40" fill="none" stroke="#9be07a" stroke-width="2" opacity=".55" stroke-dasharray="4 5"/>` +
      `<path d="M22 92 Q20 50 64 44 Q108 50 106 92 Q100 100 64 100 Q28 100 22 92Z" fill="url(#sa-up-earth)"/>` +
      `<path d="M22 92 Q20 50 64 44 Q108 50 106 92" fill="none" stroke="${R.accent[2]}" stroke-width="2.4"/>` +
      `<path d="M52 58 L64 52 L76 58 L76 72 L64 78 L52 72Z M30 74 L40 64 L52 72 L50 88 L36 92 Z M98 74 L88 64 L76 72 L78 88 L92 92 Z" fill="none" stroke="${R.bg[2]}" stroke-width="2.2" stroke-linejoin="round" opacity=".7"/>` +
      `<path d="M36 52 Q48 40 64 42 Q80 40 92 52 Q80 48 64 50 Q48 48 36 52Z" fill="#6fae4f"/>` +
      `<g fill="#7dffb0"><path d="M14 40 h4 v-4 h4 v4 h4 v4 h-4 v4 h-4 v-4 h-4Z"/><path d="M104 28 h3 v-3 h3 v3 h3 v3 h-3 v3 h-3 v-3 h-3Z" opacity=".75"/></g>`,
  },
  "Mud Mire": {
    el: "earth",
    draw: () =>
      // A patch of sticky mud with a footprint sinking into it.
      floorGlow("earth", 64, 80, 54, 26, 0.7) +
      `<ellipse cx="64" cy="80" rx="50" ry="24" fill="${R.bg[1]}"/>` +
      `<ellipse cx="64" cy="78" rx="44" ry="19" fill="${R.accent[0]}"/>` +
      [
        [40, 76, 9, 5],
        [70, 70, 11, 6],
        [86, 86, 8, 4],
        [52, 90, 7, 3.5],
      ]
        .map(
          ([x, y, rx, ry]) =>
            `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${R.accent[1]}" opacity=".55"/>`,
        )
        .join("") +
      `<circle cx="60" cy="66" r="4" fill="none" stroke="${R.accent[2]}" stroke-width="1.6" opacity=".8"/><circle cx="82" cy="78" r="3" fill="none" stroke="${R.accent[2]}" stroke-width="1.4" opacity=".7"/>` +
      `<path d="M48 54 Q46 42 52 36 Q58 42 56 54Z M62 50 Q62 38 68 34 Q72 42 68 52Z" fill="${R.accent[1]}" opacity=".9"/>` +
      `<path d="M30 50 L40 58 M98 50 L88 58" stroke="${R.accent[2]}" stroke-width="2" stroke-linecap="round" opacity=".7"/>` +
      sparks(
        [
          [22, 44, 1.4],
          [112, 92, 1.3],
          [30, 104, 1.2],
        ],
        R.accent[2],
      ),
  },
  Tremor: {
    el: "earth",
    draw: () =>
      floorGlow("earth", 64, 84, 58, 22) +
      // The ground splitting in a star of cracks, rocks thrown up.
      `<ellipse cx="64" cy="86" rx="52" ry="20" fill="${R.bg[1]}"/>` +
      glow(
        `M64 86 L40 78 L18 82 M64 86 L54 100 L34 108 M64 86 L82 100 L100 108 M64 86 L88 76 L110 80 M64 86 L66 72`,
        R.accent[2],
        2.6,
        R.accent[1],
      ) +
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="64" cy="86" rx="${20 + k * 14}" ry="${7 + k * 5}" fill="none" stroke="${R.accent[1]}" stroke-width="${2.4 - k * 0.6}" opacity="${0.8 - k * 0.2}"/>`,
        )
        .join("") +
      [
        [40, 44, 9],
        [86, 38, 11],
        [64, 24, 7],
        [104, 56, 6],
        [24, 58, 6],
      ]
        .map(
          ([x, y, r], i) =>
            `<path d="M${x - r} ${y} L${x - r * 0.4} ${y - r} L${x + r * 0.7} ${y - r * 0.8} L${x + r} ${y + r * 0.2} L${x + r * 0.3} ${y + r} L${x - r * 0.7} ${y + r * 0.7}Z" fill="${i % 2 ? R.accent[0] : R.accent[1]}" stroke="${R.accent[2]}" stroke-width="1.2"/>`,
        )
        .join(""),
  },

  // Duskveil · Shadow
  "Lantern Wisp": {
    el: "shadow",
    draw: () =>
      `<path d="M14 104 Q40 96 54 80 Q66 66 80 56" stroke="url(#sa-diag-shadow)" stroke-width="10" fill="none" stroke-linecap="round" opacity=".5"/>` +
      halo("shadow", 86, 48, 32) +
      // A little ghost flame with a face.
      `<path d="M86 22 Q104 36 102 54 Q100 70 86 72 Q70 70 70 54 Q70 40 86 22Z" fill="url(#sa-orb-shadow)"/>` +
      `<path d="M70 56 Q60 64 52 62 Q60 72 74 68Z" fill="${S.accent[1]}" opacity=".8"/>` +
      `<ellipse cx="80" cy="52" rx="2.6" ry="3.6" fill="${S.bg[2]}"/><ellipse cx="92" cy="52" rx="2.6" ry="3.6" fill="${S.bg[2]}"/>` +
      sparks(
        [
          [106, 26, 1.4],
          [110, 76, 1.3],
          [40, 30, 1.2],
          [30, 80, 1.3],
        ],
        S.accent[2],
      ),
  },
  "Shade Crawl": {
    el: "shadow",
    draw: () =>
      // A shadow tearing along the ground, claws rising.
      `<ellipse cx="64" cy="94" rx="58" ry="14" fill="url(#sa-glow-shadow)"/>` +
      `<path d="M8 96 Q40 86 76 92 Q100 96 120 84 Q104 104 76 104 Q40 106 8 96Z" fill="${S.bg[2]}" stroke="${S.accent[1]}" stroke-width="2"/>` +
      [
        [70, 90],
        [86, 88],
        [102, 82],
      ]
        .map(
          ([x, y], i) =>
            `<path d="M${x} ${y} Q${x - 4} ${y - 30 - i * 4} ${x + 8} ${y - 44 - i * 6} Q${x + 2} ${y - 26} ${x + 8} ${y}Z" fill="url(#sa-up-shadow)"/>`,
        )
        .join("") +
      glow(`M10 82 L40 82 M14 70 L36 72`, S.accent[2], 1.8, S.accent[1]) +
      sparks(
        [
          [112, 30, 1.4],
          [40, 40, 1.2],
          [60, 24, 1.2],
        ],
        S.accent[2],
      ),
  },
  Ghostfire: {
    el: "shadow",
    draw: () => {
      const flame = (x: number, y: number, s: number) =>
        `<g transform="translate(${x} ${y}) scale(${s})">${halo("shadow", 0, 0, 22)}<path d="M0 -20 Q14 -6 12 6 Q10 18 0 18 Q-10 18 -12 6 Q-14 -6 0 -20Z" fill="url(#sa-up-shadow)"/><path d="M0 -6 Q6 2 5 8 Q4 14 0 14 Q-4 14 -5 8 Q-6 2 0 -6Z" fill="${S.hot}"/></g>`;
      return (
        [
          [64, 104, 64, 36],
          [64, 104, 32, 54],
          [64, 104, 96, 54],
        ]
          .map(
            ([x0, y0, x1, y1]) =>
              `<path d="M${x0} ${y0} L${x1} ${y1}" stroke="url(#sa-diag-shadow)" stroke-width="3" stroke-linecap="round" opacity=".5"/>`,
          )
          .join("") +
        flame(64, 36, 1.15) +
        flame(32, 56, 0.95) +
        flame(96, 56, 0.95) +
        sparks(
          [
            [20, 30, 1.3],
            [108, 26, 1.3],
            [64, 112, 1.3],
          ],
          S.accent[2],
        )
      );
    },
  },
  "Haunted Lantern": {
    el: "shadow",
    draw: () =>
      // A lantern hung on a crooked post, its ghost flame lighting the ground.
      floorGlow("shadow", 64, 104, 54, 14) +
      `<ellipse cx="64" cy="104" rx="50" ry="12" fill="none" stroke="${S.accent[2]}" stroke-width="1.6" opacity=".55" stroke-dasharray="4 4"/>` +
      `<path d="M44 106 V30 Q44 22 52 22 H74" fill="none" stroke="${S.bg[2]}" stroke-width="6" stroke-linecap="round"/>` +
      `<path d="M44 106 V30 Q44 22 52 22 H74" fill="none" stroke="${S.accent[0]}" stroke-width="2" stroke-linecap="round" opacity=".8"/>` +
      `<path d="M74 22 V32" stroke="${S.accent[2]}" stroke-width="1.6"/>` +
      halo("shadow", 76, 52, 30) +
      `<rect x="62" y="32" width="28" height="34" rx="7" fill="${S.bg[1]}" stroke="${S.accent[2]}" stroke-width="2.4"/>` +
      `<path d="M76 38 Q86 48 84 56 Q82 62 76 62 Q70 62 68 56 Q66 48 76 38Z" fill="#7dffe1"/>` +
      `<path d="M76 46 Q80 52 79 56 Q78 59 76 59 Q74 59 73 56 Q72 52 76 46Z" fill="#e6fff8"/>` +
      `<path d="M96 70 Q104 74 108 84" fill="none" stroke="#7dffe1" stroke-width="3" stroke-linecap="round" opacity=".8"/><circle cx="109" cy="87" r="4" fill="#7dffe1"/>` +
      sparks(
        [
          [22, 26, 1.3],
          [106, 22, 1.4],
          [20, 96, 1.2],
          [100, 50, 1.2],
        ],
        S.accent[2],
      ),
  },
  "Void Orb": {
    el: "shadow",
    draw: () =>
      halo("shadow", 64, 62, 54) +
      // A swirling void sphere with a dark core.
      [0, 1, 2]
        .map(
          (k) =>
            `<ellipse cx="64" cy="62" rx="${46 - k * 4}" ry="${14 + k * 2}" fill="none" stroke="${k ? S.accent[1] : S.accent[2]}" stroke-width="${2.6 - k * 0.6}" opacity="${0.9 - k * 0.2}" transform="rotate(${-20 + k * 40} 64 62)"/>`,
        )
        .join("") +
      `<circle cx="64" cy="62" r="26" fill="url(#sa-orb-shadow)"/>` +
      `<circle cx="64" cy="62" r="14" fill="${S.bg[2]}"/>` +
      `<circle cx="64" cy="62" r="14" fill="none" stroke="${S.accent[2]}" stroke-width="2"/>` +
      `<path d="M58 56 Q64 50 70 56" fill="none" stroke="${S.hot}" stroke-width="1.6" stroke-linecap="round" opacity=".7"/>` +
      sparks(
        [
          [18, 30, 1.4],
          [110, 24, 1.5],
          [112, 100, 1.4],
          [18, 100, 1.3],
        ],
        S.accent[2],
      ),
  },
};

export const SKILL_ART_NAMES = Object.keys(art);
const cache = new Map<string, string>();
/** The illustrated icon for a champion move, or undefined (no art yet). */
export function skillArt(name: string) {
  const entry = art[name];
  if (!entry) return undefined;
  let svg = cache.get(name);
  if (!svg) {
    svg =
      `<svg class="skill-icon skill-art" data-skill-art="${name}" viewBox="0 0 128 128" aria-hidden="true" focusable="false">` +
      backdrop(entry.el) +
      entry.draw() +
      `<rect width="128" height="128" fill="url(#sa-vig)"/><rect width="128" height="128" fill="url(#sa-sheen)"/></svg>`;
    cache.set(name, svg);
  }
  ensureSkillArtDefs();
  return svg;
}

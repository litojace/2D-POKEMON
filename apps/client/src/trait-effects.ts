import type { CharacterId } from "@arena/shared";
/**
 * Ambient trait auras for menu art (selected card, detail portrait, briefing).
 * Drawn around a creature in its 0..200 x 0..190 art box, feet at y ≈ 172.
 * `back` renders behind the creature, `front` over it. Markup is deterministic
 * per fighter so re-renders compare equal. With `still`, nothing animates.
 */
export interface TraitAura {
  defs: string;
  back: string;
  front: string;
}
type Kit = ReturnType<typeof kit>;
function kit(id: CharacterId, still: boolean) {
  let seed = [...id].reduce((n, c) => n * 31 + c.charCodeAt(0), 7) >>> 0;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  const r = (a: number, b: number) => a + rnd() * (b - a);
  const range = (n: number) => [...Array(n).keys()];
  const n1 = (v: number) => +v.toFixed(1);
  /** CSS animation attribute; negative delays spread phases so stills look alive. */
  const anim = (name: string, dur: number, delay = 0, ease = "linear") =>
    still
      ? ""
      : ` style="animation:ta-${name} ${dur}s ${ease} ${n1(-delay)}s infinite"`;
  /** Items ride an ellipse (SMIL) so they keep their shape while orbiting. */
  const orbit = (
    rx: number,
    ry: number,
    cy: number,
    dur: number,
    n: number,
    item: (i: number) => string,
    reverse = false,
  ) => {
    const sweep = reverse ? 0 : 1;
    const d = `M${100 - rx} ${cy}A${rx} ${ry} 0 1 ${sweep} ${100 + rx} ${cy}A${rx} ${ry} 0 1 ${sweep} ${100 - rx} ${cy}`;
    return range(n)
      .map((i) => {
        if (still) {
          const a = (i / n) * Math.PI * 2 + 0.4;
          return `<g transform="translate(${n1(100 + Math.cos(a) * rx)} ${n1(cy + Math.sin(a) * ry)})">${item(i)}</g>`;
        }
        return `<g>${item(i)}<animateMotion dur="${dur}s" begin="${n1(-(i / n) * dur)}s" repeatCount="indefinite" path="${d}"/></g>`;
      })
      .join("");
  };
  const defs = (c: string) =>
    `<filter id="ta-${id}-blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter><filter id="ta-${id}-soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.2"/></filter><radialGradient id="ta-${id}-pool"><stop stop-color="${c}" stop-opacity=".7"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient>`;
  const blur = `filter="url(#ta-${id}-blur)"`,
    soft = `filter="url(#ta-${id}-soft)"`;
  const pool = (rx = 70, ry = 14) =>
    `<ellipse class="ta-c" cx="100" cy="176" rx="${rx}" ry="${ry}" fill="url(#ta-${id}-pool)"${anim("pulse", 2.4, 0, "ease-in-out")}/>`;
  const rising = (
    n: number,
    make: (x: number, y: number, i: number) => string,
    x0 = 40,
    x1 = 160,
    dur: [number, number] = [2.5, 4.5],
  ) =>
    range(n)
      .map((i) => {
        const d = r(...dur),
          x = r(x0, x1),
          y = r(120, 175),
          phase = r(0, d);
        // A still frame spreads particles up their path instead of stacking them.
        const lift = still
          ? ` transform="translate(0 ${n1(-(phase / d) * 110)})"`
          : "";
        return `<g${lift}${anim("rise", d, phase, "ease-out")}>${make(n1(x), n1(y), i)}</g>`;
      })
      .join("");
  const bolt = (x: number, y: number, c: string, w: number) => {
    let d = `M${x} ${y}`,
      cx = x,
      cy = y;
    for (let i = 0; i < 4; i++) {
      cx += r(-10, 10);
      cy += 10;
      d += `L${n1(cx)} ${n1(cy)}`;
    }
    return `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
  };
  const star4 = (x: number, y: number, s: number, c: string) =>
    `<path d="M${x} ${n1(y - s)}Q${n1(x + s * 0.18)} ${n1(y - s * 0.18)} ${n1(x + s)} ${y}Q${n1(x + s * 0.18)} ${n1(y + s * 0.18)} ${x} ${n1(y + s)}Q${n1(x - s * 0.18)} ${n1(y + s * 0.18)} ${n1(x - s)} ${y}Q${n1(x - s * 0.18)} ${n1(y - s * 0.18)} ${x} ${n1(y - s)}Z" fill="${c}"/>`;
  const diamond = (w: number, h: number, c: string) =>
    `<path d="M0 ${-h}L${w} 0L0 ${h}L${-w} 0Z" fill="${c}" opacity=".95" stroke="#ffffff" stroke-width="1" stroke-opacity=".7"/>`;
  const ring = (n: number, radius: number, rot = 0) =>
    range(n)
      .map((i) => {
        const a = (i / n) * Math.PI * 2 + rot;
        return `${n1(Math.cos(a) * radius)},${n1(Math.sin(a) * radius)}`;
      })
      .join(" ");
  return {
    r,
    range,
    n1,
    anim,
    orbit,
    defs,
    blur,
    soft,
    pool,
    rising,
    bolt,
    star4,
    diamond,
    ring,
  };
}
const AURAS: Record<CharacterId, (k: Kit, id: CharacterId) => TraitAura> = {
  voltkit: (k) => ({
    defs: k.defs("#7ff3ff"),
    back: `${k.pool()}<ellipse class="ta-c" cx="100" cy="176" rx="62" ry="11" fill="none" stroke="#7ff3ff" stroke-width="2" stroke-dasharray="10 7 3 7"${k.anim("dash", 1.2)}/>${k
      .range(5)
      .map((i) => {
        const x = [16, 182, 26, 174, 100][i],
          y = [40, 50, 118, 126, -24][i];
        const flick = k.anim("flicker", 0.9 + i * 0.17, i * 0.3, "steps(1)");
        return `<g${flick} ${k.soft}>${k.bolt(x, y, i % 2 ? "#ffe76b" : "#7ff3ff", 2.6)}</g>`;
      })
      .join("")}`,
    front: k.orbit(
      98,
      36,
      120,
      3.2,
      6,
      (i) =>
        `<circle r="${i % 2 ? 3 : 4.5}" fill="${i % 2 ? "#ffe76b" : "#7ff3ff"}" ${k.soft}/><circle r="1.8" fill="#fff"/>`,
    ),
  }),
  cindrake: (k, id) => ({
    defs: k.defs("#ff7a2f"),
    back: `${k.pool(76, 16)}<ellipse cx="100" cy="120" rx="80" ry="60" fill="#ff6a2a" opacity=".22" ${k.blur}/>${k
      .range(7)
      .map((i) => {
        const x = 22 + i * 26,
          h = [60, 92, 120, 140, 120, 92, 60][i],
          w = 15;
        const tongue = (s: number, c: string) =>
          `<path d="M${k.n1(x - w * s)} 176Q${k.n1(x - w * s * 1.3)} ${k.n1(176 - h * s * 0.55)} ${k.n1(x + 4 * s)} ${k.n1(176 - h * s)}Q${k.n1(x + w * s * 0.2)} ${k.n1(176 - h * s * 0.62)} ${k.n1(x + w * s)} ${k.n1(176 - h * s * 0.48)}Q${k.n1(x + w * s * 1.1)} ${k.n1(176 - h * s * 0.18)} ${k.n1(x + w * s)} 176Z" fill="${c}"/>`;
        return `<g class="ta-base"${k.anim("flame", 0.6 + (i % 3) * 0.14, i * 0.17, "ease-in-out")} opacity=".9">${tongue(1, "#ff5a24")}${tongue(0.68, "#ff9a3c")}${tongue(0.38, "#ffe27a")}</g>`;
      })
      .join("")}`,
    front: k.rising(
      16,
      (x, y, i) =>
        `<circle cx="${x}" cy="${y}" r="${(i % 3) + 1.6}" fill="${i % 2 ? "#ffd34d" : "#ff8a3d"}"/><circle cx="${x}" cy="${y}" r="${(i % 3) + 4}" fill="#ff8a3d" opacity=".35" filter="url(#ta-${id}-soft)"/>`,
      30,
      170,
      [1.6, 3],
    ),
  }),
  tidefin: (k) => ({
    defs: k.defs("#4fd6e6"),
    back: `${k.pool()}${k
      .range(3)
      .map(
        (i) =>
          `<ellipse class="ta-c" cx="100" cy="176" rx="30" ry="6" fill="none" stroke="#bff6ff" stroke-width="2"${k.anim("ripple", 2.6, i * 0.87, "ease-out")}/>`,
      )
      .join(
        "",
      )}<g transform="translate(100 112) rotate(-14) scale(1 .34)"><g class="ta-c"${k.anim("spin", 5)}><circle r="104" fill="none" stroke="#4fd6e6" stroke-width="9" stroke-dasharray="120 40 60 60" opacity=".55"/><circle r="104" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-dasharray="60 100 30 90" opacity=".8"/></g></g>`,
    front: k.rising(
      12,
      (x, y, i) =>
        `<circle cx="${x}" cy="${y}" r="${2.5 + (i % 3) * 1.6}" fill="#dcfbff" fill-opacity=".18" stroke="#dcfbff" stroke-width="1.4"/><circle cx="${k.n1(x - 1.4)}" cy="${k.n1(y - 1.6)}" r="1" fill="#fff"/>`,
      30,
      170,
      [3, 5.5],
    ),
  }),
  auralynx: (k) => ({
    defs: k.defs("#7f9cff"),
    back: `${k.pool()}<g transform="translate(100 108)"><g class="ta-c"${k.anim("spin", 14)}><polygon points="${k.ring(6, 96)}" fill="#7f9cff" fill-opacity=".08" stroke="#c9f4ff" stroke-width="2" stroke-opacity=".7"/><polygon points="${k.ring(6, 80, Math.PI / 6)}" fill="none" stroke="#7f9cff" stroke-width="1.4" stroke-dasharray="6 6"/></g><circle class="ta-c" r="70" fill="#c9f4ff" opacity=".12" ${k.blur}${k.anim("pulse", 2, 0, "ease-in-out")}/></g>`,
    front: k.orbit(96, 40, 112, 6, 5, (i) =>
      k.diamond(6, 12, i % 2 ? "#c9f4ff" : "#9fb7ff"),
    ),
  }),
  lumoth: (k, id) => ({
    defs: k.defs("#fff1a0"),
    back: `${k.pool(72, 14)}<g transform="translate(100 100)"><g class="ta-c"${k.anim("spin", 24)}>${k
      .range(16)
      .map((i) => {
        const a = (i / 16) * Math.PI * 2,
          r0 = 92,
          r1 = i % 2 ? 100 : 109;
        return `<line x1="${k.n1(Math.cos(a) * r0)}" y1="${k.n1(Math.sin(a) * r0)}" x2="${k.n1(Math.cos(a) * r1)}" y2="${k.n1(Math.sin(a) * r1)}" stroke="#fff1a0" stroke-width="${i % 2 ? 2 : 3.5}" stroke-linecap="round" opacity=".5"/>`;
      })
      .join(
        "",
      )}</g><circle r="64" fill="#fff6c8" opacity=".25" ${k.blur}/></g>`,
    front: `${k
      .range(9)
      .map(
        (i) =>
          `<g class="ta-c"${k.anim("twinkle", 1.6 + (i % 4) * 0.4, i * 0.37, "ease-in-out")}>${k.star4(k.n1(k.r(-20, 220)), k.n1(k.r(-20, 165)), k.n1(k.r(5, 10)), i % 3 ? "#fff6c8" : "#ffffff")}</g>`,
      )
      .join(
        "",
      )}${k.rising(10, (x, y) => `<circle cx="${x}" cy="${y}" r="2.2" fill="#fff1a0" filter="url(#ta-${id}-soft)"/>`, 20, 180, [3.5, 6])}`,
  }),
  mystowl: (k, id) => ({
    defs: k.defs("#ff79d2"),
    back: `<ellipse class="ta-c" cx="100" cy="178" rx="54" ry="10" fill="url(#ta-${id}-pool)"${k.anim("pulse", 1.6, 0, "ease-in-out")}/>${k
      .range(3)
      .map(
        (i) =>
          `<circle class="ta-c" cx="100" cy="98" r="60" fill="none" stroke="${i % 2 ? "#9ff7ff" : "#ff79d2"}" stroke-width="2.5"${k.anim("wave", 3, i, "ease-out")} opacity="${0.75 - i * 0.2}"/>`,
      )
      .join("")}`,
    front: k.orbit(
      108,
      34,
      92,
      7,
      4,
      () =>
        `<circle r="12" fill="#ff79d2" opacity=".35" ${k.soft}/><circle r="9" fill="#2a0f3a" stroke="#ff79d2" stroke-width="1.6"/><path d="M-6 0Q0 -6 6 0Q0 6 -6 0Z" fill="#9ff7ff"/><circle r="2" fill="#2a0f3a"/><circle cx="-1.5" cy="-1.5" r="1" fill="#fff"/>`,
      true,
    ),
  }),
  terradon: (k) => ({
    defs: k.defs("#c79a5b"),
    back: `${k.pool(80, 14)}<path class="ta-c" d="M38 178L56 172L64 180L82 174M118 176L136 170L146 178L162 172" fill="none" stroke="#8fd36a" stroke-width="2.4" stroke-linecap="round" opacity=".9"${k.anim("pulse", 2.2, 0, "ease-in-out")}/>${k
      .range(3)
      .map(
        (i) =>
          `<ellipse class="ta-c" cx="${60 + i * 40}" cy="176" rx="18" ry="5" fill="#c79a5b" opacity=".35"${k.anim("ripple", 3, i, "ease-out")}/>`,
      )
      .join("")}`,
    front: `${k.orbit(110, 36, 124, 9, 6, (i) => {
      const s = 6 + (i % 3) * 2.5;
      return `<path d="M${-s} 2L${k.n1(-s * 0.4)} ${-s}L${s} ${k.n1(-s * 0.5)}L${k.n1(s * 0.7)} ${k.n1(s * 0.8)}Z" fill="${i % 2 ? "#a07a48" : "#7e6a55"}" stroke="#46301c" stroke-width="1.2"/><path d="M${k.n1(-s * 0.4)} ${-s}L${k.n1(s * 0.1)} ${k.n1(-s * 0.2)}L${s} ${k.n1(-s * 0.5)}" fill="none" stroke="#f1dcb5" stroke-width="1" opacity=".7"/>`;
    })}${k
      .range(5)
      .map(
        (i) =>
          `<g transform="translate(${50 + i * 22} ${45 + (i % 2) * 20})"><g class="ta-leaf"${k.anim("leaf", 4 + i * 0.6, i * 1.1, "ease-in-out")}><path d="M-6 0q6 -6 12 0q-6 6 -12 0Z" fill="#8fd36a"/></g></g>`,
      )
      .join("")}`,
  }),
  duskveil: (k) => ({
    defs: k.defs("#9c6bff"),
    back: `<ellipse cx="100" cy="176" rx="72" ry="14" fill="#120b26" opacity=".85"/>${k.pool(66, 12)}<g ${k.blur}>${k.rising(
      10,
      (x, y, i) =>
        `<ellipse cx="${x}" cy="${y}" rx="${12 + (i % 3) * 5}" ry="${16 + (i % 3) * 6}" fill="${i % 2 ? "#3a2470" : "#1e1340"}" opacity=".9"/>`,
      30,
      170,
      [3, 5],
    )}</g>`,
    front: k.orbit(
      100,
      40,
      104,
      5.5,
      3,
      () =>
        `<circle r="12" fill="#7dffe1" opacity=".35" ${k.soft}/><path d="M0 -13Q8 -2 5.5 4Q2.5 9.5 0 9.5Q-2.5 9.5 -5.5 4Q-8 -2 0 -13Z" fill="#7dffe1"/><path d="M0 -3Q3 2 2 5Q0 7 -2 5Q-3 2 0 -3Z" fill="#ffffff"/>`,
    ),
  }),
};
export function traitAura(id: CharacterId, still = false): TraitAura {
  return AURAS[id](kit(id, still), id);
}
/** Wrap a creature SVG (from creatureSvg) with its aura behind and in front. */
export function withAura(svg: string, id: CharacterId, still = false) {
  const aura = traitAura(id, still);
  return svg
    .replace(/^<svg /, '<svg class="trait-aura" overflow="visible" ')
    .replace("<defs>", `<defs>${aura.defs}`)
    .replace(/(<\/defs>)/, `$1<g class="ta-back">${aura.back}</g>`)
    .replace(/<\/svg>$/, `<g class="ta-front">${aura.front}</g></svg>`);
}

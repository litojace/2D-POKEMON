import type { CharacterId } from "@arena/shared";
import {
  DESIGNS,
  backPanel,
  onPole,
  torso,
  type Design,
  type Kit,
} from "./modern-designs";
import { CHESTNUT, lanternSpot, malletHead } from "./legend-details";

/**
 * Sun Dynasty (Legendary): the court of a desert kingdom in gold and lapis.
 * Every figure wears the court's broad bead collar (gold, lapis, turquoise
 * and carnelian rows with a fringe of drops that light in a run), a
 * pectoral of its own trade on the chest (a sun disc, a scarab, a lotus, a
 * star dial...) and headwear of its rank: the sovereign's striped headcloth
 * and sun crown, the astronomer's tall cap, the herald's falcon wings, the
 * keeper's palm fronds. Gold edges every garment (the Legendary trim in
 * modern-fashion.ts). Nothing covers the eyes (costume-fit.spec.ts): bands
 * sit on the head-top above them and a headcloth's lappets fall outside them.
 */
const GOLD = "#f2c14e",
  GOLD_D = "#b8823a",
  GOLD_L = "#fff3a8",
  LAPIS = "#2f5fb8",
  LAPIS_D = "#1f3a7a",
  TURQ = "#3fc8c0",
  CARN = "#c8402f",
  LINEN = "#f4ead2",
  LINEN_D = "#d9c59a";

const f = (v: number) => +v.toFixed(1);
const cx = (k: Kit) => k.C + k.side * 3;
const hx = (k: Kit) => k.hx + k.side * 2;
/** A glint that twinkles on gold or a gem. */
const glint = (
  k: Kit,
  x: number,
  y: number,
  r: number,
  i: number,
  c = "#ffffff",
) => k.lume("twinkle", k.path(k.star(x, y, r, 4, 0.3), c, "none", 0), i, c);
/** A sun disc: rays round a gold disc, `core` at its heart. */
const sunDisc = (k: Kit, x: number, y: number, r: number, core = GOLD_L) =>
  k.path(k.star(x, y, r * 1.45, 12, 0.72), GOLD, GOLD_D, 0.6) +
  k.circle(x, y, r, GOLD, GOLD_D, 0.7) +
  k.circle(x, y, r * 0.55, core, "none", 0);

// ---- The broad collar every figure wears.
type Rows = [string, string, string];
/**
 * The broad bead collar: a crescent round the neck in three rows, a fringe of
 * drops along its edge, every other drop lit in a run (lume chase). From
 * behind: its band over the shoulders and the gold counterweight that hangs
 * down the back to hold it.
 */
function collar(k: Kit, rows: Rows, drops = TURQ) {
  if (k.back) {
    const band =
      k.path(
        `M${k.C - k.W + 1} ${k.T - 1}Q${k.C} ${k.T + 9} ${k.C + k.W - 1} ${k.T - 1}L${k.C + k.W - 4} ${k.T - 5}Q${k.C} ${k.T + 3} ${k.C - k.W + 4} ${k.T - 5}Z`,
        rows[0],
        k.ink,
        0.8,
      ) +
      k.line(
        `M${k.C - k.W + 3} ${k.T - 2.6}Q${k.C} ${k.T + 6} ${k.C + k.W - 3} ${k.T - 2.6}`,
        rows[1],
        1.4,
      );
    // The counterweight: a keyhole of gold with a lapis inlay and a tassel.
    const y = k.T + 4;
    const weight =
      k.line(`M${k.C} ${y}V${y + 6}`, GOLD_D, 1.4) +
      k.path(
        `M${k.C - 3} ${y + 6}H${k.C + 3}L${k.C + 2} ${y + 13}Q${k.C + 5.5} ${y + 16} ${k.C} ${y + 21}Q${k.C - 5.5} ${y + 16} ${k.C - 2} ${y + 13}Z`,
        GOLD,
        GOLD_D,
        0.7,
      ) +
      k.circle(k.C, y + 16.5, 2, LAPIS, "none", 0) +
      k.line(`M${k.C} ${y + 21}V${y + 26}`, CARN, 1.6);
    k.put("scarf", band + weight);
    return;
  }
  const c = cx(k);
  if (k.side) {
    // In profile the collar's near half wraps from the nape to the chest.
    const s = k.side;
    const back = c - s * (k.W - 2),
      front = c + s * (k.W - 1);
    const outer = `M${back} ${k.T - 2}Q${c + s * 2} ${k.T + 16} ${front} ${k.T + 6}`;
    const shape = k.path(
      `${outer}L${front - s * 2} ${k.T - 1}Q${c} ${k.T + 6} ${back + s * 2} ${k.T - 5}Z`,
      rows[0],
      k.ink,
      0.8,
    );
    const mid =
      k.line(
        `M${back + s} ${k.T - 2}Q${c + s * 2} ${k.T + 11} ${front - s} ${k.T + 3}`,
        rows[1],
        1.5,
      ) +
      k.line(
        `M${back + s * 2} ${k.T - 3.6}Q${c + s} ${k.T + 6} ${front - s * 2} ${k.T}`,
        rows[2],
        1.2,
      );
    const fringe = [0.25, 0.45, 0.65, 0.85]
      .map((u, i) => {
        const x = f(
            (1 - u) * (1 - u) * back +
              2 * u * (1 - u) * (c + s * 2) +
              u * u * front,
          ),
          y = f(
            (1 - u) * (1 - u) * (k.T - 2) +
              2 * u * (1 - u) * (k.T + 16) +
              u * u * (k.T + 6),
          );
        const drop = k.path(
          `M${x - 1.6} ${y}Q${x} ${y + 5} ${x + 1.6} ${y}Z`,
          i % 2 ? drops : GOLD,
          k.ink,
          0.4,
        );
        return i % 2 ? k.lume("chase", drop, i, drops) : drop;
      })
      .join("");
    k.put("body", shape + mid + fringe);
    return;
  }
  const L = c - k.W + 1,
    R = c + k.W - 1;
  const shape = k.path(
    `M${L} ${k.T - 2}Q${c} ${k.T + 24} ${R} ${k.T - 2}L${c + 12} ${k.T - 4}Q${c} ${k.T + 6} ${c - 12} ${k.T - 4}Z`,
    rows[0],
    k.ink,
    0.8,
  );
  const mid =
    k.line(
      `M${L + 4} ${k.T - 2.4}Q${c} ${k.T + 18} ${R - 4} ${k.T - 2.4}`,
      rows[1],
      1.8,
    ) +
    k.line(
      `M${L + 9} ${k.T - 3}Q${c} ${k.T + 11.5} ${R - 9} ${k.T - 3}`,
      rows[2],
      1.4,
    );
  const n = 9;
  const fringe = Array.from({ length: n }, (_, i) => {
    const u = (i + 1) / (n + 1);
    const x = f((1 - u) * (1 - u) * L + 2 * u * (1 - u) * c + u * u * R),
      y = f(
        (1 - u) * (1 - u) * (k.T - 2) +
          2 * u * (1 - u) * (k.T + 24) +
          u * u * (k.T - 2),
      );
    const drop = k.path(
      `M${x - 1.7} ${y - 0.5}Q${x} ${y + 5.4} ${x + 1.7} ${y - 0.5}Z`,
      i % 2 ? drops : GOLD,
      k.ink,
      0.4,
    );
    return i % 2 ? k.lume("chase", drop, i >> 1, drops) : drop;
  }).join("");
  k.put("body", shape + mid + fringe);
}

// ---- Pectorals, hung below the collar on the chest.
type Pectoral =
  | "sun"
  | "bolt"
  | "phoenix"
  | "lotus"
  | "scarab"
  | "lamp"
  | "dial"
  | "pyramid"
  | "moon"
  | "coil"
  | "leaf"
  | "drop"
  | "wing"
  | "palette"
  | "palm"
  | "fan";
/** The pectoral's own drawing, centred on (x, y), r its size. */
function emblem(
  k: Kit,
  e: Pectoral,
  x: number,
  y: number,
  r: number,
  glow: string,
) {
  const lit = (svg: string, i = 0) => k.lume("pulse", svg, i, glow);
  switch (e) {
    case "sun":
      return lit(sunDisc(k, x, y, r * 0.7, glow));
    case "bolt":
      return (
        k.circle(x, y, r * 0.85, LAPIS_D, GOLD_D, 0.8) +
        lit(
          k.path(
            `M${x + r * 0.15} ${y - r * 0.75}L${x - r * 0.45} ${y + r * 0.1}H${x - r * 0.02}L${x - r * 0.18} ${y + r * 0.75}L${x + r * 0.45} ${y - r * 0.12}H${x + r * 0.04}Z`,
            glow,
            GOLD_D,
            0.5,
          ),
        )
      );
    case "phoenix": {
      const wing = (s: number) =>
        `M${x} ${y - r * 0.1}Q${x + s * r * 0.6} ${y - r * 0.9} ${x + s * r * 1.25} ${y - r * 0.55}Q${x + s * r * 0.9} ${y - r * 0.2} ${x + s * r * 1.05} ${y + r * 0.05}Q${x + s * r * 0.5} ${y + r * 0.05} ${x} ${y + r * 0.25}Z`;
      return (
        lit(k.path(wing(-1) + wing(1), glow, GOLD_D, 0.5)) +
        k.path(
          `M${x} ${y - r * 0.55}Q${x + r * 0.3} ${y} ${x} ${y + r * 0.9}Q${x - r * 0.3} ${y} ${x} ${y - r * 0.55}Z`,
          GOLD,
          GOLD_D,
          0.5,
        )
      );
    }
    case "lotus": {
      const petal = (a: number) =>
        `<path d="M${x} ${y + r * 0.5}Q${x - r * 0.34} ${y - r * 0.2} ${x} ${y - r * 0.85}Q${x + r * 0.34} ${y - r * 0.2} ${x} ${y + r * 0.5}Z" transform="rotate(${a} ${x} ${y + r * 0.5})" fill="${glow}" stroke="${GOLD_D}" stroke-width="0.5"/>`;
      return (
        lit(petal(-50) + petal(50) + petal(-24) + petal(24)) +
        petal(0) +
        k.line(`M${x - r * 0.7} ${y + r * 0.55}H${x + r * 0.7}`, GOLD, 1.4)
      );
    }
    case "scarab":
      return (
        lit(
          k.path(
            `M${x - r * 0.25} ${y - r * 0.2}Q${x - r * 1.25} ${y - r * 0.7} ${x - r * 1.2} ${y + r * 0.2}Q${x - r * 0.7} ${y + r * 0.1} ${x - r * 0.25} ${y + r * 0.35}Z M${x + r * 0.25} ${y - r * 0.2}Q${x + r * 1.25} ${y - r * 0.7} ${x + r * 1.2} ${y + r * 0.2}Q${x + r * 0.7} ${y + r * 0.1} ${x + r * 0.25} ${y + r * 0.35}Z`,
            glow,
            GOLD_D,
            0.5,
          ),
        ) +
        `<ellipse cx="${x}" cy="${y + r * 0.1}" rx="${r * 0.42}" ry="${r * 0.6}" fill="${LAPIS}" stroke="${GOLD_D}" stroke-width="0.6"/>` +
        k.circle(x, y - r * 0.6, r * 0.28, GOLD, GOLD_D, 0.5) +
        k.line(`M${x} ${y - r * 0.4}V${y + r * 0.65}`, GOLD, 0.7)
      );
    case "lamp":
      // An oil lamp, its flame lit.
      return (
        k.path(
          `M${x - r} ${y + r * 0.1}Q${x - r * 0.2} ${y + r * 0.75} ${x + r * 0.8} ${y + r * 0.1}L${x + r * 1.1} ${y - r * 0.15}L${x + r * 0.55} ${y - r * 0.05}Q${x} ${y - r * 0.25} ${x - r} ${y + r * 0.1}Z`,
          GOLD,
          GOLD_D,
          0.6,
        ) +
        lit(
          k.path(
            `M${x + r * 0.95} ${y - r * 0.2}Q${x + r * 0.65} ${y - r * 0.6} ${x + r * 1.05} ${y - r}Q${x + r * 1.35} ${y - r * 0.6} ${x + r * 0.95} ${y - r * 0.2}Z`,
            glow,
            "#e8701a",
            0.4,
          ),
        )
      );
    case "dial":
      return (
        k.circle(x, y, r * 0.95, LAPIS_D, GOLD, 1.2) +
        lit(k.path(k.star(x, y, r * 0.8, 8, 0.4), glow, "none", 0)) +
        k.circle(x, y, r * 0.18, GOLD, "none", 0)
      );
    case "pyramid":
      return (
        k.path(
          `M${x - r} ${y + r * 0.7}L${x} ${y - r * 0.85}L${x + r} ${y + r * 0.7}Z`,
          LINEN_D,
          GOLD_D,
          0.7,
        ) +
        lit(
          k.path(
            `M${x - r * 0.3} ${y - r * 0.4}L${x} ${y - r * 0.85}L${x + r * 0.3} ${y - r * 0.4}Z`,
            glow,
            GOLD_D,
            0.4,
          ),
        ) +
        k.line(
          `M${x - r * 0.55} ${y + r * 0.1}H${x + r * 0.55}M${x - r * 0.78} ${y + r * 0.42}H${x + r * 0.78}`,
          GOLD_D,
          0.6,
        )
      );
    case "moon":
      return (
        lit(
          k.path(
            `M${x - r} ${y - r * 0.2}A${r} ${r} 0 0 0 ${x + r} ${y - r * 0.2}A${r * 0.82} ${r * 0.72} 0 0 1 ${x - r} ${y - r * 0.2}Z`,
            glow,
            GOLD_D,
            0.5,
          ),
        ) + k.circle(x, y - r * 0.45, r * 0.42, GOLD, GOLD_D, 0.5)
      );
    case "coil": {
      let d = `M${x} ${y}`;
      for (let i = 1; i <= 14; i++) {
        const a = i * 0.75,
          rr = (i / 14) * r;
        d += `L${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`;
      }
      return (
        k.circle(x, y, r * 1.05, "#8a4a24", GOLD_D, 0.7) +
        lit(k.line(d, glow, 1.3))
      );
    }
    case "leaf":
      return (
        k.circle(x, y, r, LINEN, GOLD, 1.2) +
        lit(
          k.path(
            `M${x - r * 0.55} ${y + r * 0.5}Q${x - r * 0.7} ${y - r * 0.55} ${x + r * 0.55} ${y - r * 0.55}Q${x + r * 0.45} ${y + r * 0.6} ${x - r * 0.55} ${y + r * 0.5}Z`,
            glow,
            "#2f6b3a",
            0.5,
          ),
        ) +
        k.line(
          `M${x - r * 0.45} ${y + r * 0.4}L${x + r * 0.35} ${y - r * 0.35}`,
          "#2f6b3a",
          0.6,
        )
      );
    case "drop":
      return (
        k.path(
          `M${x} ${y - r}Q${x + r * 0.85} ${y + r * 0.15} ${x} ${y + r * 0.8}Q${x - r * 0.85} ${y + r * 0.15} ${x} ${y - r}Z`,
          GOLD,
          GOLD_D,
          0.6,
        ) +
        lit(
          k.path(
            `M${x} ${y - r * 0.6}Q${x + r * 0.55} ${y + r * 0.15} ${x} ${y + r * 0.55}Q${x - r * 0.55} ${y + r * 0.15} ${x} ${y - r * 0.6}Z`,
            glow,
            "none",
            0,
          ),
        )
      );
    case "wing": {
      const wing = (s: number) =>
        `M${x + s * r * 0.4} ${y - r * 0.05}Q${x + s * r * 1.2} ${y - r * 0.55} ${x + s * r * 1.6} ${y - r * 0.2}Q${x + s * r * 1.1} ${y + r * 0.1} ${x + s * r * 0.4} ${y + r * 0.3}Z`;
      return (
        k.path(wing(-1) + wing(1), LAPIS, GOLD_D, 0.6) +
        k.line(
          `M${x - r * 1.2} ${y - r * 0.15}Q${x - r * 0.8} ${y - r * 0.05} ${x - r * 0.5} ${y + r * 0.1}M${x + r * 1.2} ${y - r * 0.15}Q${x + r * 0.8} ${y - r * 0.05} ${x + r * 0.5} ${y + r * 0.1}`,
          GOLD,
          0.7,
        ) +
        lit(k.circle(x, y + r * 0.08, r * 0.45, glow, GOLD_D, 0.6))
      );
    }
    case "palette":
      // A scribe's palette: two ink wells, red and black, and a reed pen.
      return (
        k.rect(
          x - r * 0.45,
          y - r,
          r * 0.9,
          r * 2,
          r * 0.2,
          LINEN_D,
          GOLD_D,
          0.6,
        ) +
        lit(k.circle(x, y - r * 0.55, r * 0.22, glow, "none", 0), 0) +
        k.circle(x, y - r * 0.05, r * 0.22, "#2a2a36", "none", 0) +
        k.line(
          `M${x - r * 0.15} ${y + r * 0.25}L${x + r * 0.15} ${y + r * 0.85}`,
          GOLD_D,
          0.8,
        )
      );
    case "palm":
      return (
        k.circle(x, y, r, LINEN, GOLD, 1.2) +
        k.line(
          `M${x} ${y + r * 0.75}Q${x + r * 0.1} ${y} ${x} ${y - r * 0.2}`,
          "#8a5a2a",
          1.1,
        ) +
        lit(
          [-60, -25, 25, 60]
            .map(
              (a) =>
                `<path d="M${x} ${y - r * 0.2}Q${x + r * 0.35} ${y - r * 0.75} ${x + r * 0.75} ${y - r * 0.35}" transform="rotate(${a} ${x} ${y - r * 0.2})" fill="none" stroke="${glow}" stroke-width="1.4" stroke-linecap="round"/>`,
            )
            .join(""),
        )
      );
    case "fan":
      return (
        lit(
          k.path(
            `M${x} ${y + r * 0.6}L${x - r * 0.95} ${y - r * 0.35}Q${x} ${y - r * 1.1} ${x + r * 0.95} ${y - r * 0.35}Z`,
            glow,
            GOLD_D,
            0.6,
          ),
        ) +
        k.line(
          `M${x} ${y + r * 0.6}L${x - r * 0.5} ${y - r * 0.62}M${x} ${y + r * 0.6}V${y - r * 0.8}M${x} ${y + r * 0.6}L${x + r * 0.5} ${y - r * 0.62}`,
          GOLD_D,
          0.6,
        )
      );
  }
}
/** The pectoral on its chain, below the collar; off in the back view. */
function pectoral(k: Kit, e: Pectoral, glow: string, r = 6.5) {
  if (k.back) return;
  const x = cx(k) + (k.side ? k.side * 6 : 0),
    y = k.T + (k.side ? 15 : 19);
  k.put(
    "body",
    k.line(
      `M${x - 5} ${y - 9}L${x} ${y - r * 0.6}L${x + 5} ${y - 9}`,
      GOLD_D,
      0.9,
    ) +
      emblem(k, e, x, y, k.side ? r * 0.85 : r, glow) +
      glint(k, x - r * 0.4, y - r * 0.5, 1.4, 3),
  );
}
/** A gold belt and its buckle, low on the garment. */
const belt = (k: Kit, color = GOLD, h = 4) =>
  k.rect(k.L - 2, k.B - 10, k.R - k.L + 4, h, 0, color, k.ink, 0.6) +
  k.line(`M${k.L - 2} ${k.B - 10 + h / 2}H${k.R + 2}`, GOLD_D, 0.5);
/** Pleats: fine lines down a linen skirt from y0 to the hem. */
const pleats = (k: Kit, y0: number, color: string, n = 7) =>
  k.line(
    Array.from({ length: n }, (_, i) => {
      const x = k.L + ((i + 1) / (n + 1)) * (k.R - k.L);
      return `M${f(x)} ${y0}L${f(x + (x - k.C) * 0.12)} ${k.B + 4}`;
    }).join(""),
    color,
    0.6,
  );
/** Rows of gold scales across a garment, from y0 down to y1. */
const scales = (k: Kit, y0: number, y1: number, color: string) => {
  let d = "";
  for (let y = y0, row = 0; y < y1; y += 5, row++)
    for (let x = k.L - 2 + (row % 2) * 3; x < k.R + 2; x += 6)
      d += `M${f(x)} ${y}q3 4 6 0`;
  return k.line(d, color, 0.7);
};

// ---- Headwear. `y` is the brow line on the head-top, above the eyes.
/** A gold band round the head-top: front, profile (shorter), behind. */
function band(k: Kit, y: number, w: number, fill = GOLD, h = 5) {
  const x = hx(k),
    ww = k.side ? w * 0.85 : w;
  return k.path(
    `M${x - ww} ${y + 2}Q${x} ${y - 8} ${x + ww} ${y + 2}L${x + ww - 1} ${y + 2 + h}Q${x} ${y - 8 + h} ${x - ww + 1} ${y + 2 + h}Z`,
    fill,
    GOLD_D,
    0.7,
  );
}
/** Where a band's front jewel sits: its middle from the front, toward the face in profile. */
const brow = (k: Kit, y: number, w: number) => ({
  x: hx(k) + (k.side ? k.side * w * 0.55 : 0),
  y: y - (k.side ? 1.5 : 3),
});
/**
 * A striped headcloth: the cloth over the head-top in stripes, a gold brow
 * band, and from the front the two lappets falling beside the head, outside
 * the eyes; in profile one lappet behind the cheek, from behind its gathered
 * tail down the nape.
 */
function headcloth(k: Kit, y: number, w: number, a: string, b: string) {
  const x = hx(k);
  const top = y - 30;
  const stripes = (x0: number, x1: number) => {
    let d = "";
    for (let i = 1; i < 6; i++)
      d += `M${f(x0 + (x1 - x0) * (i / 6))} ${top + 3}L${f(x0 + (x1 - x0) * (i / 6) + (i - 3) * 2)} ${y + 3}`;
    return k.line(d, b, 2.2);
  };
  const crown = k.path(
    `M${x - w} ${y + 4}Q${x - w - 3} ${top + 4} ${x} ${top}Q${x + w + 3} ${top + 4} ${x + w} ${y + 4}Q${x} ${y - 6} ${x - w} ${y + 4}Z`,
    a,
  );
  const lappet = (s: number) => {
    const x0 = x + s * (w - 1),
      x1 = x + s * (w + 9);
    let d = "";
    for (let yy = y + 9; yy < y + 44; yy += 6)
      d += `M${x0 + s * 0.5} ${yy}L${x1 - s * 0.5} ${yy + 1}`;
    return (
      k.path(
        `M${x0} ${y + 2}L${x1} ${y + 4}L${x1 + s * 1} ${y + 46}Q${x + s * (w + 4)} ${y + 49} ${x0 - s * 1} ${y + 46}Z`,
        a,
      ) +
      k.line(d, b, 2.2) +
      k.line(`M${x0} ${y + 46}L${x1 + s} ${y + 46}`, GOLD, 1.8)
    );
  };
  if (k.back)
    return (
      crown +
      stripes(x - w + 6, x + w - 6) +
      k.path(
        `M${x - 9} ${y + 2}L${x + 9} ${y + 2}L${x + 6} ${y + 30}Q${x} ${y + 34} ${x - 6} ${y + 30}Z`,
        a,
      ) +
      k.line(
        `M${x - 7} ${y + 10}H${x + 7}M${x - 6.5} ${y + 17}H${x + 6.5}M${x - 6} ${y + 24}H${x + 6}`,
        b,
        2,
      ) +
      band(k, y, w + 1, GOLD, 4)
    );
  if (k.side)
    return (
      k.path(
        `M${x - k.side * 14} ${y + 3}L${x - k.side * 30} ${y + 4}L${x - k.side * 33} ${y + 40}Q${x - k.side * 24} ${y + 44} ${x - k.side * 15} ${y + 40}Z`,
        a,
      ) +
      k.line(
        `M${x - k.side * 16} ${y + 12}L${x - k.side * 31} ${y + 13}M${x - k.side * 16} ${y + 21}L${x - k.side * 32} ${y + 22}M${x - k.side * 16} ${y + 30}L${x - k.side * 32} ${y + 31}`,
        b,
        2.2,
      ) +
      crown +
      stripes(x - w + 6, x + w - 6) +
      band(k, y, w + 1, GOLD, 4)
    );
  return (
    lappet(-1) +
    lappet(1) +
    crown +
    stripes(x - w + 6, x + w - 6) +
    band(k, y, w + 1, GOLD, 4)
  );
}
/** A tall cap (cone cut flat), its band and a finial on top. */
function tallCap(
  k: Kit,
  y: number,
  w: number,
  h: number,
  fill: string,
  finial: string,
) {
  const x = hx(k),
    ww = k.side ? w * 0.85 : w;
  return (
    k.path(
      `M${x - ww} ${y + 3}L${x - ww * 0.55} ${y - h}Q${x} ${y - h - 4} ${x + ww * 0.55} ${y - h}L${x + ww} ${y + 3}Q${x} ${y - 5} ${x - ww} ${y + 3}Z`,
      fill,
    ) +
    band(k, y, w + 1, GOLD, 4) +
    finial
  );
}
/** A wrapped turban: a dome in folds, the end tucked, a jewelled brooch. */
function turban(k: Kit, y: number, w: number, fill: string, fold: string) {
  const x = hx(k),
    ww = k.side ? w * 0.9 : w;
  const dome = k.path(
    `M${x - ww} ${y + 4}Q${x - ww - 4} ${y - 30} ${x} ${y - 32}Q${x + ww + 4} ${y - 30} ${x + ww} ${y + 4}Q${x} ${y - 4} ${x - ww} ${y + 4}Z`,
    fill,
  );
  const folds = k.line(
    `M${x - ww + 2} ${y - 2}Q${x - 4} ${y - 22} ${x + ww - 6} ${y - 22}M${x - ww + 6} ${y - 14}Q${x + 2} ${y - 32} ${x + ww - 2} ${y - 6}M${x - ww + 3} ${y + 2}Q${x} ${y - 10} ${x + ww - 2} ${y + 1}`,
    fold,
    1.6,
  );
  return dome + folds;
}

// ---- Held pieces re-forged (their own taken off: SkinArt.heldOff in sun-art.ts).
/** The Moon Vizier's lantern becomes a pierced brass lamp, lit within. */
function brassLamp(k: Kit) {
  const { x, y } = lanternSpot(k);
  k.put(
    "tail",
    k.path(
      `M${x - 8} ${y - 6}Q${x} ${y - 20} ${x + 8} ${y - 6}Z`,
      GOLD,
      GOLD_D,
      0.8,
    ) +
      k.circle(x, y - 17, 1.8, GOLD, GOLD_D, 0.5) +
      k.path(
        `M${x - 8} ${y - 6}H${x + 8}L${x + 6} ${y + 9}H${x - 6}Z`,
        "#8a5a24",
        GOLD_D,
        0.8,
      ) +
      k.lume(
        "pulse",
        [-4, 0, 4]
          .map((d) =>
            k.path(k.star(x + d, y + 1, 1.8, 4, 0.4), "#ffd27a", "none", 0),
          )
          .join("") + k.circle(x, y - 3, 1.4, "#fff3c4", "none", 0),
        2,
        "#ffd27a",
      ) +
      k.path(
        `M${x - 6} ${y + 9}H${x + 6}L${x + 3} ${y + 13}H${x - 3}Z`,
        GOLD,
        GOLD_D,
        0.7,
      ),
  );
}
/** The Spice Healer's chestnut becomes a pomegranate, split to its seeds. */
function pomegranate(k: Kit) {
  if (k.back || k.side) return;
  const { x, y } = CHESTNUT;
  k.put(
    "armR",
    k.circle(x, y + 1, 9, "#b8282e", k.ink, 1) +
      k.path(`M${x - 3} ${y - 8}l1 -3h4l1 3Z`, "#8a1a24", k.ink, 0.6) +
      k.path(
        `M${x - 1} ${y - 3}Q${x + 6} ${y - 2} ${x + 7} ${y + 4}Q${x + 2} ${y + 7} ${x - 1} ${y + 2}Z`,
        "#ffe0d0",
        k.ink,
        0.6,
      ) +
      k.lume(
        "pulse",
        [
          [2, 0],
          [4.5, 2.5],
          [2.5, 3.6],
          [5, -0.5],
        ]
          .map(([dx, dy]) => k.circle(x + dx, y + dy, 1, "#ff3a5a", "none", 0))
          .join(""),
        4,
        "#ff6a7a",
      ),
  );
}
/** The Lotus Sceptre: the mallet's head becomes a sun disc in an open lotus. */
function sceptreHead(k: Kit) {
  const { x, y } = malletHead(k);
  const petal = (a: number) =>
    `<path d="M${x} ${y + 12}Q${x - 6} ${y + 2} ${x} ${y - 9}Q${x + 6} ${y + 2} ${x} ${y + 12}Z" transform="rotate(${a} ${x} ${y + 12})" fill="#ff9ac0" stroke="${k.ink}" stroke-width="0.7"/>`;
  k.put(
    "armR",
    k.circle(x, y, 18, "#2a7a8a", k.ink, 1) +
      petal(-62) +
      petal(62) +
      petal(-32) +
      petal(32) +
      k.lume("pulse", sunDisc(k, x, y - 2, 7.5, GOLD_L), 6, GOLD_L) +
      glint(k, x - 3, y - 6, 2, 5),
  );
}
export const SUN: Record<CharacterId, Design> = {
  // Storm Charioteer: a lapis tunic in gold scale, a sun pectoral with a
  // lightning bolt, a gold diadem whose bolt jewel lights.
  voltkit(k) {
    if (k.back)
      backPanel(
        k,
        LAPIS_D,
        scales(k, k.T + 6, k.B - 8, GOLD) +
          k.lume("pulse", sunDisc(k, k.C, k.T + 22, 5), 1, GOLD_L),
      );
    else
      k.put(
        "body",
        torso(k, LAPIS_D, scales(k, k.T + 10, k.B - 10, GOLD) + belt(k)),
      );
    collar(k, [GOLD, TURQ, CARN]);
    pectoral(k, "bolt", "#fff36a");
    const y = k.ht + 14,
      w = 30;
    const j = brow(k, y, w);
    k.put(
      "flame",
      band(k, y, w) +
        (k.back
          ? ""
          : k.circle(j.x, j.y, 4.2, LAPIS, GOLD_D, 0.8) +
            k.lume(
              "pulse",
              k.path(
                `M${j.x + 0.6} ${j.y - 3}L${j.x - 1.8} ${j.y + 0.4}H${j.x}L${j.x - 0.6} ${j.y + 3}L${j.x + 1.8} ${j.y - 0.5}H${j.x}Z`,
                "#fff36a",
                "none",
                0,
              ),
              0,
              "#fff36a",
            )),
    );
  },
  // Phoenix Prince: a carnelian robe with a hem of gold flame-feathers, a
  // phoenix on the chest; its own flame crest rises through a gold circlet.
  cindrake(k) {
    const robe = "#9a2a22";
    const hem = (y: number) => {
      let d = "";
      for (let x = k.L - 2; x < k.R + 2; x += 7) d += `M${x} ${y}l3.5 -7l3.5 7`;
      return k.path(d, GOLD, GOLD_D, 0.5);
    };
    if (k.back)
      backPanel(
        k,
        robe,
        hem(k.B - 2) +
          k.lume(
            "pulse",
            emblem(k, "phoenix", k.C, k.T + 22, 7, "#ffb347"),
            1,
            "#ffb347",
          ),
      );
    else k.put("body", torso(k, robe, hem(k.B + 1) + belt(k, GOLD, 3)));
    collar(k, [GOLD, LAPIS, TURQ]);
    pectoral(k, "phoenix", "#ffb347");
    const y = k.ht + 20,
      w = 26;
    const j = brow(k, y, w);
    k.put(
      "flame",
      band(k, y, w) +
        (k.back
          ? ""
          : k.path(
              `M${j.x} ${j.y - 5}L${j.x + 3.4} ${j.y}L${j.x} ${j.y + 5}L${j.x - 3.4} ${j.y}Z`,
              CARN,
              GOLD_D,
              0.7,
            ) + glint(k, j.x - 1, j.y - 1.5, 1.6, 2)),
    );
  },
  // River Pilot: a linen kilt with blue wave pleats and a lapis sash, a lotus
  // pectoral, a striped head-wrap whose ties trail behind.
  tidefin(k) {
    const waves = (y: number) =>
      k.line(`M${k.L - 2} ${y}q4 -3 8 0t8 0t8 0t8 0t8 0t8 0t8 0`, LAPIS, 1);
    if (k.back)
      backPanel(
        k,
        LINEN,
        waves(k.B - 6) +
          waves(k.B - 12) +
          k.line(`M${k.C - k.W} ${k.T + 2}L${k.C + k.W} ${k.B - 14}`, LAPIS, 4),
      );
    else
      k.put(
        "body",
        torso(
          k,
          LINEN,
          waves(k.B - 2) +
            waves(k.B - 8) +
            k.line(`M${k.L} ${k.T + 2}L${k.R} ${k.B - 12}`, LAPIS, 4.5) +
            k.line(`M${k.L} ${k.T + 2}L${k.R} ${k.B - 12}`, GOLD, 0.8),
        ),
      );
    collar(k, [TURQ, GOLD, LAPIS], GOLD_L);
    pectoral(k, "lotus", "#8ff0f0");
    const y = k.ht + 14,
      w = 34;
    const x = hx(k);
    const ww = k.side ? w * 0.85 : w;
    const stripes = k.line(
      `M${x - ww + 3} ${y + 2.5}Q${x} ${y - 6.5} ${x + ww - 3} ${y + 2.5}M${x - ww + 3} ${y + 6}Q${x} ${y - 3} ${x + ww - 3} ${y + 6}`,
      LAPIS,
      1.4,
    );
    const ties = k.back
      ? k.path(
          `M${x - 2} ${y + 4}l-8 18l5 1Z M${x + 2} ${y + 4}l9 16l-5 2Z`,
          LINEN,
          LAPIS,
          0.9,
        )
      : k.side
        ? k.path(
            `M${x - k.side * 26} ${y + 3}l${-k.side * 10} 16l${k.side * 4} 2Z`,
            LINEN,
            LAPIS,
            0.9,
          )
        : "";
    const j = brow(k, y, w);
    k.put(
      "flame",
      ties +
        band(k, y, w, LINEN, 8) +
        stripes +
        (k.back
          ? ""
          : k.circle(j.x, j.y + 3, 3, LAPIS, GOLD_D, 0.7) +
            glint(k, j.x - 0.8, j.y + 2, 1.5, 2)),
    );
  },
  // Temple Cat: white linen with a lapis-and-gold sash, a scarab with prism
  // wings, a diadem set with a prism gem between the ears.
  auralynx(k) {
    const sash = k.side
      ? ""
      : k.path(
          `M${k.C - 4} ${k.T + 6}H${k.C + 4}L${k.C + 5} ${k.B + 4}H${k.C - 5}Z`,
          LAPIS,
          k.ink,
          0.6,
        ) + k.line(`M${k.C} ${k.T + 8}V${k.B + 3}`, GOLD, 1);
    if (k.back)
      backPanel(
        k,
        LINEN,
        k.path(
          `M${k.C - 4} ${k.T + 4}H${k.C + 4}L${k.C + 5} ${k.B}H${k.C - 5}Z`,
          LAPIS,
          k.ink,
          0.6,
        ) +
          k.lume(
            "pulse",
            emblem(k, "scarab", k.C, k.T + 20, 6, "#c9a3ff"),
            1,
            "#c9a3ff",
          ),
      );
    else
      k.put(
        "body",
        torso(
          k,
          LINEN,
          sash +
            belt(k, GOLD, 3) +
            k.line(`M${k.L + 3} ${k.B - 6}H${k.R - 3}`, LAPIS, 1.2),
        ),
      );
    collar(k, [LAPIS, GOLD, TURQ]);
    pectoral(k, "scarab", "#c9a3ff");
    const y = k.ht + 14,
      w = 28;
    const j = brow(k, y, w);
    k.put(
      "flame",
      band(k, y, w) +
        (k.back
          ? ""
          : k.path(
              `M${j.x} ${j.y - 6}L${j.x + 4} ${j.y}L${j.x} ${j.y + 4}L${j.x - 4} ${j.y}Z`,
              "#c9a3ff",
              GOLD_D,
              0.7,
            ) +
            k.lume(
              "twinkle",
              k.path(k.star(j.x, j.y - 1, 2.4, 4, 0.3), "#ffffff", "none", 0),
              2,
              "#e6d6ff",
            )),
    );
  },
  // Lamp Keeper: a linen robe with an amber sash and an oil lamp hung at the
  // hip, a lamp pectoral, a hood fringed with gold beads that glint in a run.
  lumoth(k) {
    if (k.back)
      backPanel(
        k,
        LINEN_D,
        k.line(`M${k.C - k.W} ${k.B - 12}H${k.C + k.W}`, "#e8901a", 3),
      );
    else {
      const lx = cx(k) + (k.side ? -k.side * 6 : 14);
      k.put(
        "body",
        torso(
          k,
          LINEN_D,
          k.line(`M${k.L - 2} ${k.B - 12}H${k.R + 2}`, "#e8901a", 3.4) +
            pleats(k, k.B - 9, "#b8a070"),
        ) +
          k.line(`M${lx} ${k.B - 11}V${k.B - 5}`, GOLD_D, 0.8) +
          emblem(k, "lamp", lx - 2, k.B - 2, 4.4, "#ffd27a"),
      );
    }
    collar(k, [GOLD, TURQ, GOLD_D]);
    pectoral(k, "lamp", "#ffd27a", 6);
    const x = hx(k),
      y = k.ht + 16,
      w = 40;
    const hood = k.back
      ? k.path(
          `M${x - w} ${y + 6}Q${x - w - 4} ${y - 30} ${x} ${y - 32}Q${x + w + 4} ${y - 30} ${x + w} ${y + 6}L${x + w - 4} ${y + 22}Q${x} ${y + 30} ${x - w + 4} ${y + 22}Z`,
          "#e8dcc0",
        )
      : k.path(
          `M${x - w} ${y + 4}Q${x - w - 4} ${y - 30} ${x} ${y - 32}Q${x + w + 4} ${y - 30} ${x + w} ${y + 4}Q${x} ${y - 6} ${x - w} ${y + 4}Z`,
          "#e8dcc0",
        );
    const beads = Array.from({ length: 7 }, (_, i) => {
      const u = (i + 0.5) / 7;
      const bx = x - w + u * 2 * w,
        by = y + 4 - Math.sin(u * Math.PI) * 9.5 + 2.6;
      const b = k.circle(f(bx), f(by), 1.5, GOLD, GOLD_D, 0.4);
      return i % 2 ? k.lume("chase", b, i >> 1, GOLD_L) : b;
    }).join("");
    k.put(
      "flame",
      hood +
        k.line(
          `M${x - w + 6} ${y - 10}Q${x} ${y - 24} ${x + w - 6} ${y - 10}`,
          "#c8b890",
          1.1,
        ) +
        band(k, y, w - 1, GOLD, 3) +
        (k.back ? "" : beads),
    );
  },
  // Royal Astronomer: a lapis robe strewn with gold stars, a star dial on
  // the chest, a tall cap of the night sky with a crescent finial.
  mystowl(k) {
    const stars = (n: number, y0: number, y1: number) =>
      Array.from({ length: n }, (_, i) => {
        const x = k.L + 3 + (((i * 37) % 100) / 100) * (k.R - k.L - 6),
          y = y0 + (((i * 53) % 100) / 100) * (y1 - y0);
        const s = k.path(k.star(f(x), f(y), 1.8, 5), GOLD, "none", 0);
        return i % 3 === 0 ? k.lume("twinkle", s, i, GOLD_L) : s;
      }).join("");
    if (k.back)
      backPanel(
        k,
        LAPIS,
        stars(9, k.T + 6, k.B - 2) +
          k.line(
            `M${k.C - 12} ${k.T + 12}L${k.C - 2} ${k.T + 20}L${k.C + 9} ${k.T + 14}L${k.C + 14} ${k.T + 26}`,
            GOLD_L,
            0.6,
          ),
      );
    else
      k.put(
        "body",
        torso(k, LAPIS, stars(8, k.T + 12, k.B) + belt(k, GOLD, 3)),
      );
    collar(k, [GOLD, LAPIS_D, TURQ]);
    pectoral(k, "dial", "#fff3a8");
    const x = hx(k),
      y = k.ht + 14;
    const moon = `M${x - 6} ${y - 50}A7 7 0 1 0 ${x + 6} ${y - 50}A5.6 5.6 0 1 1 ${x - 6} ${y - 50}Z`;
    const capStars = [
      [-10, -12],
      [8, -22],
      [-3, -32],
      [12, -8],
    ]
      .map(
        ([dx, dy], i) =>
          k.path(
            k.star(x + dx * (k.side ? 0.8 : 1), y + dy, 1.9, 5),
            GOLD,
            "none",
            0,
          ) + (i === 1 ? glint(k, x + dx, y + dy, 2.4, 4, GOLD_L) : ""),
      )
      .join("");
    k.put(
      "flame",
      tallCap(
        k,
        y,
        30,
        40,
        LAPIS_D,
        k.lume("pulse", k.path(moon, GOLD, GOLD_D, 0.6), 1, GOLD_L),
      ) + capStars,
    );
  },
  // Obelisk Builder: a linen kilt under a leather harness, a gold pyramid
  // pectoral, a striped headcloth in sandstone and lapis.
  terradon(k) {
    const harness = (y0: number) =>
      k.line(
        `M${k.L + 2} ${y0}L${k.R - 2} ${k.B - 12}M${k.R - 2} ${y0}L${k.L + 2} ${k.B - 12}`,
        "#6e4a24",
        3,
      );
    if (k.back) backPanel(k, LINEN, harness(k.T + 2) + belt(k, "#6e4a24", 5));
    else
      k.put(
        "body",
        torso(
          k,
          LINEN,
          pleats(k, k.B - 9, "#c8b890") +
            belt(k, "#6e4a24", 5) +
            k.rect(k.C - 3, k.B - 10.5, 6, 6, 1, GOLD, GOLD_D, 0.6),
        ),
      );
    collar(k, [TURQ, GOLD, LAPIS]);
    pectoral(k, "pyramid", "#fff3a8", 7);
    k.put("flame", headcloth(k, k.ht + 16, 43, "#e8d4a0", LAPIS));
  },
  // Moon Vizier: a night-indigo robe with silver crescents, a moon pectoral,
  // a tall vizier's cap; its lantern becomes a pierced brass lamp.
  duskveil(k) {
    const robe = "#2a2448";
    const moons = (n: number, y0: number) =>
      Array.from({ length: n }, (_, i) => {
        const x = k.L + 5 + (i / Math.max(1, n - 1)) * (k.R - k.L - 10),
          y = y0 + (i % 2) * 9;
        return k.path(
          `M${f(x - 2.5)} ${y}A3 3 0 1 0 ${f(x + 2.5)} ${y}A2.4 2.4 0 1 1 ${f(x - 2.5)} ${y}Z`,
          "#d8dcf0",
          "none",
          0,
        );
      }).join("");
    if (k.back) backPanel(k, robe, moons(4, k.T + 12) + moons(4, k.B - 14));
    else k.put("body", torso(k, robe, moons(4, k.B - 16) + belt(k, GOLD, 3)));
    collar(k, [GOLD, "#b8c0e0", LAPIS], "#d8dcf0");
    pectoral(k, "moon", "#d8e8ff");
    const x = hx(k),
      y = k.ht + 16;
    const moon = `M${x - 5} ${y - 34}A6 6 0 1 0 ${x + 5} ${y - 34}A4.8 4.8 0 1 1 ${x - 5} ${y - 34}Z`;
    k.put(
      "flame",
      tallCap(
        k,
        y,
        26,
        26,
        "#3a2f6a",
        k.lume("pulse", k.path(moon, "#e8ecff", GOLD_D, 0.6), 1, "#d8e8ff"),
      ) +
        k.line(
          `M${x - 18} ${y - 6}Q${x} ${y - 12} ${x + 18} ${y - 6}`,
          GOLD,
          1,
        ),
    );
    brassLamp(k);
  },
  // Dune Caravaneer: a striped desert robe with a turquoise sash, a copper
  // coil brooch, a cream turban with a jewelled pin.
  coilemur(k) {
    const robeStripes = (y0: number, y1: number) => {
      let d = "";
      for (let x = k.L; x < k.R + 2; x += 6) d += `M${x} ${y0}V${y1}`;
      return k.line(d, "#b8562a", 2.4);
    };
    if (k.back)
      backPanel(
        k,
        "#f0dcb4",
        robeStripes(k.T, k.B + 4) +
          k.rect(k.C - k.W - 2, k.B - 14, 2 * k.W + 4, 6, 0, TURQ, k.ink, 0.6),
      );
    else
      k.put(
        "body",
        torso(
          k,
          "#f0dcb4",
          robeStripes(k.T + 6, k.B + 6) +
            k.rect(k.L - 2, k.B - 14, k.R - k.L + 4, 6, 0, TURQ, k.ink, 0.6),
        ),
      );
    collar(k, [GOLD, TURQ, GOLD_D]);
    pectoral(k, "coil", "#7ff3ff");
    const y = k.ht + 14,
      w = 36;
    const j = brow(k, y + 4, w);
    k.put(
      "flame",
      turban(k, y, w, "#f7ecd4", "#d8c4a0") +
        band(k, y, w, GOLD, 3) +
        (k.back
          ? ""
          : k.path(
              `M${j.x - 1} ${j.y - 2}Q${j.x + 4} ${j.y - 18} ${j.x + 10} ${j.y - 26}Q${j.x + 4} ${j.y - 14} ${j.x + 2} ${j.y - 2}Z`,
              "#ffffff",
              k.ink,
              0.6,
            ) +
            k.circle(j.x, j.y, 3.4, TURQ, GOLD_D, 0.8) +
            glint(k, j.x - 1, j.y - 1, 1.6, 2)),
    );
  },
  // Spice Healer: a teal robe with three spice pouches at the belt, a herb
  // pectoral, a carnelian headscarf fringed with gold coins; its chestnut
  // becomes a split pomegranate.
  pyranda(k) {
    const robe = "#1f6f6a";
    const pouches = (y: number) =>
      [
        [-14, "#c8402f"],
        [0, "#ffb21f"],
        [14, "#5aa84a"],
      ]
        .map(([d, c]) =>
          k.path(
            `M${k.C + (d as number) - 4} ${y}h8l-1 7q-3 2 -6 0Z`,
            c as string,
            k.ink,
            0.6,
          ),
        )
        .join("");
    if (k.back) backPanel(k, robe, belt(k, GOLD_D, 3));
    else
      k.put(
        "body",
        torso(k, robe, belt(k, GOLD_D, 3) + (k.side ? "" : pouches(k.B - 7))),
      );
    collar(k, [GOLD, CARN, TURQ]);
    pectoral(k, "leaf", "#8ff07a");
    const x = hx(k),
      y = k.ht + 14,
      w = 36;
    const scarf = k.back
      ? k.path(
          `M${x - w} ${y + 4}Q${x - w - 3} ${y - 30} ${x} ${y - 31}Q${x + w + 3} ${y - 30} ${x + w} ${y + 4}Q${x} ${y - 4} ${x - w} ${y + 4}Z`,
          CARN,
        ) +
        k.path(`M${x - 4} ${y + 2}l-6 20l6 -3l6 3l-6 -20Z`, CARN, k.ink, 0.7)
      : k.path(
          `M${x - w} ${y + 4}Q${x - w - 3} ${y - 30} ${x} ${y - 31}Q${x + w + 3} ${y - 30} ${x + w} ${y + 4}Q${x} ${y - 4} ${x - w} ${y + 4}Z`,
          CARN,
        );
    const nCoins = k.side ? 5 : 7;
    const coins = k.back
      ? ""
      : Array.from({ length: nCoins }, (_, i) => {
          const u = (i + 0.5) / nCoins;
          const ww = k.side ? w * 0.85 : w;
          const c = k.circle(
            f(x - ww + u * 2 * ww),
            f(y + 5 - Math.sin(u * Math.PI) * 8),
            1.7,
            GOLD,
            GOLD_D,
            0.5,
          );
          return i % 2 ? k.lume("chase", c, i >> 1, GOLD_L) : c;
        }).join("");
    k.put(
      "flame",
      scarf +
        k.line(
          `M${x - w + 5} ${y - 8}Q${x} ${y - 22} ${x + w - 5} ${y - 8}`,
          "#e8705a",
          1.4,
        ) +
        band(k, y, w, GOLD, 3) +
        coins,
    );
    pomegranate(k);
  },
  // Mirage Dancer: a pale turquoise dress with gold chains that glint in a
  // run, a moonstone drop, a jewelled circlet and a veil that floats behind.
  glacelle(k) {
    const dress = "#c8f0ea";
    const chain = (y: number, i0: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const u = (i + 0.5) / 6;
        const c = k.circle(
          f(k.L + u * (k.R - k.L)),
          f(y + Math.sin(u * Math.PI) * 5),
          1.2,
          GOLD,
          GOLD_D,
          0.4,
        );
        return i % 2 ? k.lume("chase", c, i0 + (i >> 1), GOLD_L) : c;
      }).join("") +
      k.line(`M${k.L} ${y}Q${k.C} ${y + 10} ${k.R} ${y}`, GOLD_D, 0.6);
    const x = hx(k),
      y = k.ht + 14,
      w = 30;
    const veil = (x0: number) =>
      k.path(
        `M${x0 - 12} ${y}Q${x0} ${y - 4} ${x0 + 12} ${y}L${x0 + 18} ${y + 52}Q${x0} ${y + 60} ${x0 - 18} ${y + 52}Z`,
        "#e8fbff99",
        "#9adcd8",
        0.8,
      );
    if (k.back) {
      backPanel(k, dress, chain(k.B - 10, 0));
      k.put("flame", veil(x) + band(k, y, w));
      collar(k, [GOLD, TURQ, LAPIS]);
      return;
    }
    k.put("body", torso(k, dress, chain(k.B - 12, 0) + chain(k.B - 4, 3)));
    collar(k, [GOLD, TURQ, LAPIS]);
    pectoral(k, "drop", "#e6fbff");
    const j = brow(k, y, w);
    // In profile the veil hangs behind the head and down the back.
    if (k.side) k.put("body", veil(x - k.side * 26), true);
    k.put(
      "flame",
      band(k, y, w) +
        k.line(`M${j.x} ${j.y + 3}V${j.y + 7}`, GOLD_D, 0.8) +
        k.path(
          `M${j.x} ${j.y + 6}Q${j.x + 3} ${j.y + 10} ${j.x} ${j.y + 13}Q${j.x - 3} ${j.y + 10} ${j.x} ${j.y + 6}Z`,
          "#c8f8ff",
          GOLD_D,
          0.6,
        ) +
        glint(k, j.x, j.y + 9, 1.6, 2, "#e6fbff"),
    );
  },
  // Falcon Herald: a lapis tunic in gold feather chevrons, a winged sun on
  // the chest, a diadem whose gold falcon wings sweep back from a sun disc.
  halcyra(k) {
    const chevrons = (y0: number, y1: number) => {
      let d = "";
      for (let y = y0; y < y1; y += 6)
        d += `M${k.L} ${y}L${k.C} ${y + 5}L${k.R} ${y}`;
      return k.line(d, GOLD, 0.9);
    };
    if (k.back) backPanel(k, LAPIS_D, chevrons(k.T + 6, k.B - 2));
    else
      k.put(
        "body",
        torso(k, LAPIS_D, chevrons(k.T + 12, k.B - 8) + belt(k, GOLD, 3)),
      );
    collar(k, [GOLD, LAPIS, TURQ]);
    pectoral(k, "wing", "#ffd84a", 6);
    const x = hx(k),
      y = k.ht + 14,
      w = 28;
    const wing = (s: number) => {
      const x0 = x + s * (w - 4);
      return (
        k.path(
          `M${x0} ${y}Q${x0 + s * 10} ${y - 20} ${x0 + s * 24} ${y - 24}Q${x0 + s * 18} ${y - 14} ${x0 + s * 20} ${y - 8}Q${x0 + s * 12} ${y - 6} ${x0 + s * 14} ${y}Q${x0 + s * 6} ${y + 2} ${x0} ${y + 4}Z`,
          GOLD,
          GOLD_D,
          0.8,
        ) +
        k.line(
          `M${x0 + s * 4} ${y - 2}Q${x0 + s * 12} ${y - 14} ${x0 + s * 20} ${y - 19}M${x0 + s * 5} ${y + 1}Q${x0 + s * 10} ${y - 6} ${x0 + s * 16} ${y - 8}`,
          LAPIS,
          1.1,
        )
      );
    };
    const wings = k.side ? wing(-k.side) : wing(-1) + wing(1);
    const j = brow(k, y, w);
    k.put(
      "flame",
      wings +
        band(k, y, w) +
        (k.back
          ? ""
          : k.lume("pulse", sunDisc(k, j.x, j.y - 1, 3.8, CARN), 0, "#ffd84a")),
    );
  },
  // Sun Sovereign: white linen under a striped royal apron, a great sun
  // pectoral, the striped headcloth of the throne crowned with a sun disc.
  sunbara(k) {
    const apron = (y0: number) => {
      const c = cx(k);
      return (
        k.path(
          `M${c - 9} ${y0}H${c + 9}L${c + 12} ${k.B + 5}H${c - 12}Z`,
          GOLD,
          GOLD_D,
          0.7,
        ) +
        k.line(
          `M${c - 5} ${y0 + 1}L${c - 6.5} ${k.B + 4}M${c} ${y0 + 1}V${k.B + 4}M${c + 5} ${y0 + 1}L${c + 6.5} ${k.B + 4}`,
          LAPIS,
          1.8,
        )
      );
    };
    if (k.back) backPanel(k, LINEN, belt(k, GOLD, 4));
    else
      k.put(
        "body",
        torso(k, LINEN, (k.side ? "" : apron(k.B - 12)) + belt(k, GOLD, 4)),
      );
    collar(k, [GOLD, LAPIS, CARN]);
    pectoral(k, "sun", "#fff36a", 7.5);
    const x = hx(k),
      y = k.ht + 20;
    const crown = k.back
      ? ""
      : k.path(
          `M${x - 10} ${y - 30}Q${x - 14} ${y - 42} ${x - 6} ${y - 50}Q${x - 11} ${y - 41} ${x - 5} ${y - 31}Z M${x + 10} ${y - 30}Q${x + 14} ${y - 42} ${x + 6} ${y - 50}Q${x + 11} ${y - 41} ${x + 5} ${y - 31}Z`,
          GOLD,
          GOLD_D,
          0.7,
        ) +
        k.lume(
          "pulse",
          k.circle(x, y - 40, 8, "#e8501a", GOLD_D, 0.8) +
            k.circle(x - 2.4, y - 42.4, 2.6, "#ffb347", "none", 0),
          0,
          "#ffb347",
        );
    k.put("flame", crown + headcloth(k, y, 44, GOLD, LAPIS));
  },
  // Lotus Sceptre: white linen with a lotus hem, a lotus pectoral, a diadem
  // with a lotus flower; its mallet becomes a sceptre crowned with a sun.
  astrabun(k) {
    const hem = (y: number) =>
      Array.from({ length: 6 }, (_, i) => {
        const x = k.L + ((i + 0.5) / 6) * (k.R - k.L);
        return k.path(
          `M${f(x)} ${y}Q${f(x - 3)} ${y - 4} ${f(x)} ${y - 8}Q${f(x + 3)} ${y - 4} ${f(x)} ${y}Z`,
          i % 2 ? TURQ : "#ff9ac0",
          k.ink,
          0.4,
        );
      }).join("");
    if (k.back) backPanel(k, LINEN, hem(k.B + 1));
    else k.put("body", torso(k, LINEN, hem(k.B + 3) + belt(k, GOLD, 3)));
    collar(k, [TURQ, GOLD, "#ff9ac0"]);
    pectoral(k, "lotus", "#ffb3d0");
    const y = k.ht + 14,
      w = 26;
    const j = brow(k, y, w);
    const petal = (a: number) =>
      `<path d="M${j.x} ${j.y + 2}Q${j.x - 4} ${j.y - 5} ${j.x} ${j.y - 12}Q${j.x + 4} ${j.y - 5} ${j.x} ${j.y + 2}Z" transform="rotate(${a} ${j.x} ${j.y + 2})" fill="#ffb3d0" stroke="${k.ink}" stroke-width="0.6"/>`;
    k.put(
      "flame",
      band(k, y, w) +
        (k.back
          ? ""
          : k.lume("pulse", petal(-40) + petal(40), 1, "#ffb3d0") +
            petal(0) +
            glint(k, j.x, j.y - 6, 1.6, 2)),
    );
    sceptreHead(k);
  },
  // Sphinx Guardian: a striped kilt under a gold breastplate, a scarab
  // pectoral, the striped headcloth of the guardian in gold and lapis.
  wombolder(k) {
    const plate = (y0: number) =>
      k.path(
        `M${k.L + 2} ${y0}Q${k.C} ${y0 + 8} ${k.R - 2} ${y0}L${k.R - 4} ${y0 + 14}Q${k.C} ${y0 + 20} ${k.L + 4} ${y0 + 14}Z`,
        GOLD,
        GOLD_D,
        0.8,
      ) +
      k.line(
        `M${k.L + 5} ${y0 + 7}Q${k.C} ${y0 + 14} ${k.R - 5} ${y0 + 7}`,
        GOLD_D,
        0.7,
      );
    const kilt = (y0: number) => {
      let d = "";
      for (let x = k.L; x < k.R + 2; x += 5) d += `M${x} ${y0}V${k.B + 4}`;
      return k.line(d, LAPIS, 2);
    };
    if (k.back) backPanel(k, LINEN, kilt(k.B - 10) + belt(k, GOLD, 3));
    else
      k.put(
        "body",
        torso(k, LINEN, kilt(k.B - 10) + plate(k.T + 6) + belt(k, GOLD, 3)),
      );
    collar(k, [GOLD, LAPIS, TURQ]);
    pectoral(k, "scarab", "#7ff0e0", 6.5);
    k.put("flame", headcloth(k, k.ht + 12, 40, GOLD, LAPIS));
  },
  // Royal Scribe: linen with a scribe's sash, a palette pectoral whose red
  // ink glows, a linen cap with a reed pen tucked at the ear; a scroll case
  // on the back.
  shadopus(k) {
    if (k.back) {
      backPanel(
        k,
        LINEN,
        k.line(`M${k.C - k.W} ${k.T + 4}L${k.C + k.W} ${k.B - 6}`, LAPIS, 3.4),
      );
      k.put(
        "scarf",
        k.rect(k.C + 4, k.T + 2, 9, 34, 4, "#8a5a2a", k.ink, 0.8) +
          k.rect(k.C + 3.5, k.T, 10, 4, 1.5, GOLD, GOLD_D, 0.6) +
          k.rect(k.C + 3.5, k.T + 32, 10, 4, 1.5, GOLD, GOLD_D, 0.6),
      );
    } else
      k.put(
        "body",
        torso(
          k,
          LINEN,
          k.line(`M${k.L} ${k.T + 4}L${k.R} ${k.B - 6}`, LAPIS, 3.4) +
            belt(k, GOLD, 3),
        ),
      );
    collar(k, [GOLD, LAPIS, GOLD_D]);
    pectoral(k, "palette", "#ff5a4a", 6.5);
    const x = hx(k),
      y = k.ht + 14,
      w = 36;
    const cap = k.path(
      `M${x - w} ${y + 4}Q${x - w - 3} ${y - 26} ${x} ${y - 28}Q${x + w + 3} ${y - 26} ${x + w} ${y + 4}Q${x} ${y - 5} ${x - w} ${y + 4}Z`,
      "#f7f0dc",
    );
    const tail = k.side
      ? k.path(
          `M${x - k.side * 24} ${y}Q${x - k.side * 40} ${y + 6} ${x - k.side * 38} ${y + 20}Q${x - k.side * 30} ${y + 12} ${x - k.side * 20} ${y + 6}Z`,
          "#f7f0dc",
        )
      : "";
    const pen = k.back
      ? ""
      : (() => {
          const px = x + (k.side ? k.side * 10 : 22);
          return (
            k.line(`M${px - 8} ${y - 18}L${px + 4} ${y + 2}`, "#c8a060", 1.8) +
            k.line(`M${px + 3} ${y}L${px + 5} ${y + 4}`, "#2a2a36", 1.4)
          );
        })();
    k.put("flame", tail + cap + band(k, y, w, GOLD, 3) + pen);
  },
  // Oasis Keeper: a palm-woven tunic with a green sash, a date-palm
  // pectoral, a crown of palm fronds on a gold band.
  pangrove(k) {
    const weave = (y0: number, y1: number) => {
      let d = "";
      for (let y = y0; y < y1; y += 5) d += `M${k.L - 2} ${y}H${k.R + 2}`;
      for (let x = k.L; x < k.R + 2; x += 5) d += `M${x} ${y0}V${y1}`;
      return k.line(d, "#b8945a", 0.6);
    };
    if (k.back)
      backPanel(
        k,
        "#d8b878",
        weave(k.T, k.B + 2) +
          k.rect(
            k.C - k.W - 2,
            k.B - 12,
            2 * k.W + 4,
            5,
            0,
            "#3f8a3a",
            k.ink,
            0.6,
          ),
      );
    else
      k.put(
        "body",
        torso(
          k,
          "#d8b878",
          weave(k.T, k.B + 6) +
            k.rect(
              k.L - 2,
              k.B - 12,
              k.R - k.L + 4,
              5,
              0,
              "#3f8a3a",
              k.ink,
              0.6,
            ),
        ),
      );
    collar(k, [TURQ, GOLD, "#3f8a3a"]);
    pectoral(k, "palm", "#9af07a");
    const x = hx(k),
      y = k.ht + 14,
      w = 30;
    const frond = (a: number, i: number) => {
      const svg = `<g transform="rotate(${a} ${x} ${y})"><path d="M${x} ${y}Q${x - 6} ${y - 18} ${x} ${y - 34}Q${x + 6} ${y - 18} ${x} ${y}Z" fill="#3f9a3a" stroke="${k.ink}" stroke-width="0.8"/><path d="M${x} ${y - 2}V${y - 31}" stroke="#2a6a2a" stroke-width="0.8" fill="none"/></g>`;
      return i === 2 ? k.lume("pulse", svg, 1, "#9af07a") : svg;
    };
    const fronds = (k.side ? [-30, -8, 14] : [-50, -25, 0, 25, 50])
      .map((a, i) => frond(a + (k.side ? k.side * 10 : 0), k.side ? i + 1 : i))
      .join("");
    k.put(
      "flame",
      fronds +
        band(k, y, w) +
        (k.back
          ? ""
          : k.circle(
              brow(k, y, w).x,
              brow(k, y, w).y,
              2.8,
              "#c8402f",
              GOLD_D,
              0.6,
            ) + glint(k, brow(k, y, w).x - 1, brow(k, y, w).y - 1, 1.4, 2)),
    );
  },
  // Shade Bearer: a desert-rose robe with a gold fringe, a little fan on the
  // chest, a linen cap; the great feather fan it carries for shade.
  mossloth(k) {
    const robe = "#e8a0a8";
    const fringe = (y: number) => {
      let d = "";
      for (let x = k.L; x < k.R + 2; x += 3) d += `M${x} ${y}v3`;
      return (
        k.line(`M${k.L - 2} ${y}H${k.R + 2}`, GOLD, 1.6) + k.line(d, GOLD, 0.8)
      );
    };
    if (k.back) backPanel(k, robe, fringe(k.B - 2));
    else
      k.put(
        "body",
        torso(
          k,
          robe,
          fringe(k.B) +
            k.rect(k.L - 2, k.B - 14, k.R - k.L + 4, 4, 0, TURQ, k.ink, 0.6),
        ),
      );
    collar(k, [GOLD, TURQ, CARN]);
    pectoral(k, "fan", "#ffffff", 6);
    const x = hx(k),
      y = k.ht + 14,
      w = 36;
    k.put(
      "flame",
      k.path(
        `M${x - w} ${y + 4}Q${x - w - 3} ${y - 22} ${x} ${y - 24}Q${x + w + 3} ${y - 22} ${x + w} ${y + 4}Q${x} ${y - 5} ${x - w} ${y + 4}Z`,
        "#f7f0dc",
      ) + band(k, y, w, GOLD, 3),
    );
    onPole(k, (px, py) => {
      const feathers = Array.from({ length: 7 }, (_, i) => {
        const a = -70 + i * (140 / 6);
        return `<path d="M${px} ${py + 8}Q${px - 5} ${py - 4} ${px} ${py - 16}Q${px + 5} ${py - 4} ${px} ${py + 8}Z" transform="rotate(${f(a)} ${px} ${py + 8})" fill="${i % 2 ? "#ffffff" : TURQ}" stroke="${k.ink}" stroke-width="0.7"/>`;
      }).join("");
      return (
        feathers +
        k.circle(px, py + 8, 3, GOLD, GOLD_D, 0.7) +
        k.lume(
          "twinkle",
          k.path(k.star(px, py + 8, 2, 4, 0.3), "#ffffff", "none", 0),
          4,
          GOLD_L,
        )
      );
    });
  },
};

Object.assign((DESIGNS.sun ??= {}), SUN);

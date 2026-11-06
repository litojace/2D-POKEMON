import type { CharacterId } from "@arena/shared";
import type { Facing } from "../animation/controller";
import type { CreaturePart } from "../creature-design";
import { profileFaceOrder } from "../creature-profile";
import { HEAD, type Palette } from "./skin-art";

/**
 * The Cyber Mecha Epics: each champion in its own paint over chrome, with
 * neon in a contrasting colour (the palette's glow). Three pieces:
 *
 *  - "mecha-helm" (crest layer): a chrome headset with ear pods and the
 *    champion's sensor: a V-fin, twin antennae, a crest fin or a radar dish.
 *  - "mecha-core" (neck layer): a segmented collar with a glowing core.
 *  - "mecha-pack" (back layer): a jetpack with two thrusters.
 *
 * The skins swap the champion's own head and neck pieces for these (see
 * SkinArt.replaces). Coordinates are final art units inside the part crops.
 */
export type MechaPiece = "mecha-helm" | "mecha-core" | "mecha-pack";
type Sensor = "vfin" | "antenna" | "fin" | "dish";
const MECHA: Record<
  CharacterId,
  { sensor: Sensor; band?: [number, number]; neck?: number }
> = {
  voltkit: { sensor: "vfin", band: [26, 14] },
  cindrake: { sensor: "fin", band: [24, 12] },
  tidefin: { sensor: "fin", band: [26, 12] },
  auralynx: { sensor: "vfin", band: [22, 14] },
  lumoth: { sensor: "antenna", band: [18, 12] },
  mystowl: { sensor: "antenna", band: [21, 13] },
  terradon: { sensor: "dish", band: [23, 12] },
  duskveil: { sensor: "antenna", band: [18, 40], neck: 121 },
  coilemur: { sensor: "antenna", band: [21, 13] },
  pyranda: { sensor: "vfin", band: [21, 13] },
  glacelle: { sensor: "vfin", band: [22, 12] },
  halcyra: { sensor: "dish", band: [19, 13] },
  sunbara: { sensor: "dish", band: [25, 12] },
  astrabun: { sensor: "vfin", band: [16, 14] },
  wombolder: { sensor: "fin", band: [29, 12], neck: 127 },
  shadopus: { sensor: "antenna", band: [27, 12], neck: 128 },
};

const CHROME = "#dfe6f0",
  STEEL = "#8d99ad",
  DARK = "#2a3242",
  INK = "#0a0e16";
const n = (v: number) => +v.toFixed(1);
const pt = (x: number, y: number) => `${n(x)} ${n(y)}`;
const shape = (d: string, fill = STEEL, width = 1.4) =>
  `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round"/>`;
const line = (d: string, color: string, width: number, opacity = 1) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ""}/>`;
const neon = (d: string, c: string, width = 1.3) =>
  line(d, c, width * 3, 0.35) +
  line(d, "#ffffff", width * 0.55) +
  line(d, c, width, 0.85);
const light = (x: number, y: number, r: number, c: string) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 2.1)}" fill="${c}" opacity=".3" stroke="none"/><circle cx="${n(x)}" cy="${n(y)}" r="${n(r)}" fill="${c}" stroke="${INK}" stroke-width="1"/><circle cx="${n(x - r * 0.3)}" cy="${n(y - r * 0.3)}" r="${n(r * 0.35)}" fill="#ffffff" stroke="none"/>`;

export function mechaSvg(
  piece: MechaPiece,
  id: CharacterId,
  dir: Facing,
  p: Palette,
): [CreaturePart, string][] {
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const back = dir === "up";
  const spec = MECHA[id];
  const c = p.glow;
  switch (piece) {
    case "mecha-helm": {
      // On the head itself where the champion's own crest sits behind it (Cindrake).
      const order = dir === "down" ? [] : profileFaceOrder(id, dir);
      const behind =
        order.includes("flame") &&
        order.indexOf("flame") < order.indexOf("head");
      return [
        [
          behind ? "head" : "flame",
          helm(spec, HEAD[id][dir], side, back, c, p),
        ],
      ];
    }
    case "mecha-core":
      return [["scarf", core(spec.neck ?? 124, side, back, c, p)]];
    case "mecha-pack":
      return [["wings", pack(side, back, c, p, spec.neck ?? 124)]];
  }
}

function helm(
  spec: (typeof MECHA)[CharacterId],
  h: { cx: number; top: number },
  side: number,
  back: boolean,
  c: string,
  p: Palette,
) {
  const [W, drop] = spec.band ?? [24, 12];
  const by = h.top + drop;
  const sx = side ? 0.72 : 1,
    ox = h.cx + side * 4;
  const X = (d: number) => ox + d * sx;
  const seat = (d: number) => {
    const t = (d / W + 1) / 2;
    return by + 5 - 24 * t * (1 - t);
  };
  let out = "";
  // The sensor, behind the band.
  switch (spec.sensor) {
    case "vfin": {
      // Twin swept blades in a V (the classic mecha antenna), chrome with a
      // neon edge, from a forehead mount.
      for (const s of [-1, 1]) {
        const x0 = X(s * 2),
          y0 = seat(0) + 3;
        const d = `M${pt(x0 - s * 2 * sx, y0)}L${pt(x0 + s * 30 * sx, y0 - 30)}L${pt(x0 + s * 22 * sx, y0 - 30)}L${pt(x0 + s * 4 * sx, y0 - 11)}L${pt(x0 + s * 3 * sx, y0 + 2)}Z`;
        out +=
          shape(d, CHROME, 1.5) +
          neon(
            `M${pt(x0 + s * 3 * sx, y0 - 4)}L${pt(x0 + s * 26 * sx, y0 - 28)}`,
            c,
            0.9,
          );
      }
      out += shape(
        `M${pt(X(-6), seat(0) + 4)}L${pt(X(0), seat(0) - 6)}L${pt(X(6), seat(0) + 4)}Z`,
        p.mid,
        1.3,
      );
      break;
    }
    case "antenna":
      for (const s of [-1, 1]) {
        const x0 = X(s * W * 0.55),
          y0 = seat(s * W * 0.55);
        const tx = x0 + s * 9 * sx,
          ty = y0 - 24;
        out +=
          line(`M${pt(x0, y0)}L${pt(tx, ty)}`, INK, 3.4) +
          line(`M${pt(x0, y0)}L${pt(tx, ty)}`, CHROME, 1.8) +
          light(tx, ty, 2.8, c);
      }
      break;
    case "fin": {
      const x0 = X(0),
        y0 = seat(0) + 1;
      const backward = -side * 8;
      out += shape(
        `M${pt(x0 - 7, y0)}L${pt(x0 - 4 + backward * 0.4, y0 - 20)}L${pt(x0 + 3 + backward, y0 - 28)}L${pt(x0 + 7, y0)}Z`,
        p.mid,
      );
      out += neon(
        `M${pt(x0, y0 - 3)}L${pt(x0 + 1 + backward * 0.8, y0 - 23)}`,
        c,
        1.1,
      );
      break;
    }
    case "dish": {
      // A small radar dish on a mast, over the far side of the head.
      const s = side || 1;
      const x0 = X(s * W * 0.55),
        y0 = seat(s * W * 0.55);
      const dx = x0 + s * 5,
        dy = y0 - 19;
      out +=
        line(`M${pt(x0, y0)}L${pt(dx, dy + 4)}`, INK, 3.4) +
        line(`M${pt(x0, y0)}L${pt(dx, dy + 4)}`, CHROME, 1.8);
      out += shape(
        `M${pt(dx - 11 * sx, dy - 4)}Q${pt(dx, dy + 12)} ${pt(dx + 11 * sx, dy - 4)}Q${pt(dx, dy + 2)} ${pt(dx - 11 * sx, dy - 4)}Z`,
        CHROME,
        1.3,
      );
      out +=
        line(`M${pt(dx, dy + 3)}L${pt(dx + s * 3, dy - 7)}`, INK, 1.2) +
        light(dx + s * 3, dy - 8, 1.8, c);
      break;
    }
  }
  // The band, its neon strip and the ear pods.
  const band = `M${pt(X(-W), by + 5)}Q${pt(X(0), by - 7)} ${pt(X(W), by + 5)}L${pt(X(W - 1), by + 11)}Q${pt(X(0), by - 1)} ${pt(X(-W + 1), by + 11)}Z`;
  out += shape(band, CHROME);
  out += neon(
    `M${pt(X(-W + 5), by + 8)}Q${pt(X(0), by - 2)} ${pt(X(W - 5), by + 8)}`,
    c,
    1,
  );
  for (const s of [-1, 1])
    out += light(X(s * (W - 4)), seat(s * (W - 4)) + 5, 1.6, c);
  if (!back) out += light(X(0) + side * 3, seat(0) + 4, 2.8, c);
  return out;
}

const P = (side: number, d: number) => 100 + side * 5 + d * (side ? 0.72 : 1);

function core(y: number, side: number, back: boolean, c: string, p: Palette) {
  let out = shape(
    `M${pt(P(side, -27), y)}Q${pt(P(side, 0), y + 11)} ${pt(P(side, 27), y)}L${pt(P(side, 25), y + 8)}Q${pt(P(side, 0), y + 19)} ${pt(P(side, -25), y + 8)}Z`,
    CHROME,
  );
  // Plate seams.
  for (const d of [-16, -6, 6, 16]) {
    const t = (d / 27 + 1) / 2;
    const y0 = y + 22 * t * (1 - t) * 2 - 0;
    out += line(
      `M${pt(P(side, d), y0 + 1)}L${pt(P(side, d * 0.95), y0 + 7)}`,
      DARK,
      1,
      0.55,
    );
  }
  out += line(
    `M${pt(P(side, -24), y + 1.5)}Q${pt(P(side, 0), y + 12)} ${pt(P(side, 24), y + 1.5)}`,
    "#ffffff",
    0.9,
    0.7,
  );
  if (back)
    return out + neon(`M${pt(P(side, -8), y + 13)}H${n(P(side, 8))}`, c, 1);
  // The core: a ringed light on the chest.
  const x = side ? P(side, side * 15) : 100,
    cy = y + (side ? 13 : 16);
  out += `<circle cx="${n(x)}" cy="${n(cy)}" r="7.5" fill="${p.mid}" stroke="${INK}" stroke-width="1.4"/>`;
  out += `<circle cx="${n(x)}" cy="${n(cy)}" r="9" fill="${c}" opacity=".25" stroke="none"/>`;
  out += `<circle cx="${n(x)}" cy="${n(cy)}" r="4.4" fill="${c}" stroke="${INK}" stroke-width="1"/><circle cx="${n(x)}" cy="${n(cy)}" r="2" fill="#ffffff" stroke="none"/>`;
  return out;
}

/** Two thrusters behind the shoulders; from behind, the whole pack. */
function pack(
  side: number,
  back: boolean,
  c: string,
  p: Palette,
  neck: number,
) {
  const y0 = neck - 4,
    y1 = neck + 30;
  const thruster = (x: number, w: number) =>
    shape(
      `M${pt(x - w, y0 + 4)}Q${pt(x, y0 - 4)} ${pt(x + w, y0 + 4)}L${pt(x + w, y1)}L${pt(x - w, y1)}Z`,
      CHROME,
    ) +
    line(`M${pt(x - w + 2, y0 + 8)}V${n(y1 - 4)}`, "#ffffff", 1, 0.6) +
    shape(
      `M${pt(x - w - 1, y1)}L${pt(x + w + 1, y1)}L${pt(x + w - 1, y1 + 6)}L${pt(x - w + 1, y1 + 6)}Z`,
      DARK,
      1.2,
    ) +
    neon(`M${pt(x - w + 2, y1 + 4)}H${n(x + w - 2)}`, c, 1) +
    line(`M${pt(x - w, y0 + 14)}H${n(x + w)}`, p.mid, 3);
  if (back)
    return (
      thruster(100 - 25, 7) +
      thruster(100 + 25, 7) +
      shape(
        `M${pt(100 - 18, y0 + 2)}H${n(100 + 18)}V${n(y1 - 2)}Q${pt(100, y1 + 4)} ${pt(100 - 18, y1 - 2)}Z`,
        p.mid,
        1.5,
      ) +
      line(`M${pt(100 - 14, y0 + 6)}H${n(100 + 14)}`, CHROME, 1.2, 0.7) +
      neon(`M100 ${n(y0 + 9)}V${n(y1 - 6)}`, c, 1.2) +
      light(100, y0 + 9, 2.2, c)
    );
  if (side) return thruster(100 - side * 24, 7) + thruster(100 - side * 14, 6);
  return thruster(100 - 31, 5.5) + thruster(100 + 31, 5.5);
}

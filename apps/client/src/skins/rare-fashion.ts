import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { Palette } from "./skin-art";

export type RareCollection = "wayfarer" | "moonlit-tea" | "astral-court";

/**
 * The three Rare costume collections, each with its own silhouette so they
 * read apart at a glance, even at battle size where a chibi champion's body
 * is small under a big head:
 *
 *  - Wayfarer: a big trail pack with a bedroll sticking out either side of
 *    the head, a short field jacket with a cross strap and belt, a red
 *    neckerchief with tails, and a satchel at the hip.
 *  - Moonlit Tea: a wrapped kimono with long furisode sleeves hanging at the
 *    sides, a wide obi whose butterfly bow shows past the waist (and fills the
 *    back), and a kanzashi hairpin with dangling blossoms.
 *  - Astral Court: a long velvet robe with gold trim, a starry shoulder mantle
 *    with gold epaulettes, and a floating star circlet over the head.
 *
 * Every piece is fitted to the champion's own torso cut (fashion-fits.ts) and
 * head anchor in each facing, and sits on a part the rig keeps steady (body,
 * flame), inside that part's crop box. `under` pieces go behind the part's
 * own art (a pack behind the torso, sleeves behind the arms).
 */
/** Marks an accessory's SVG to be drawn under its part's own art. */
export const UNDER = "<!--under-->";
export interface RarePiece {
  part: CreaturePart;
  svg: string;
  under?: boolean;
}

/** Bounding box of a torso cut (absolute M/L/Q/H/V commands). */
export function cutBox(d: string) {
  const xs: number[] = [],
    ys: number[] = [];
  const tokens = d.match(/[MLQHVZ]|-?\d*\.?\d+/g) ?? [];
  let cmd = "M";
  for (let i = 0; i < tokens.length; ) {
    const t = tokens[i];
    if (/[MLQHVZ]/.test(t)) {
      cmd = t;
      i++;
      continue;
    }
    if (cmd === "H") xs.push(+tokens[i++]);
    else if (cmd === "V") ys.push(+tokens[i++]);
    else {
      xs.push(+tokens[i]);
      ys.push(+tokens[i + 1]);
      i += 2;
    }
  }
  return {
    x0: Math.min(...xs),
    x1: Math.max(...xs),
    y0: Math.min(...ys),
    y1: Math.max(...ys),
  };
}

export function rareFashion(
  collection: RareCollection,
  id: CharacterId,
  dir: Facing,
  p: Palette,
  head: { cx: number; top: number },
  cut: string,
): RarePiece[] {
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const back = dir === "up";
  const bx = 100 + side * 7;
  const box = cutBox(cut);
  // Torso extents in final coordinates.
  const L = bx + box.x0,
    R = bx + box.x1,
    T = box.y0,
    B = box.y1,
    W = (R - L) / 2,
    C = (L + R) / 2;
  const bulky = ["terradon", "wombolder", "pangrove", "mossloth"].includes(id);
  const ink = p.dark;
  const out: RarePiece[] = [];
  // From behind, shells and glider membranes (the wings part) cover the
  // back, so back-mounted pieces go on the scarf part, painted last there.
  const backPart: CreaturePart = back ? "scarf" : "body";
  const put = (part: CreaturePart, svg: string, under = false) =>
    out.push({
      part,
      under,
      svg: `<g class="fashion-signature rare-${collection}" data-champion="${id}" data-view="${dir}">${svg}</g>`,
    });
  const path = (d: string, fill: string, stroke = ink, sw = 1.1) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const line = (d: string, color: string, sw = 1.1) => path(d, "none", color, sw);
  const circle = (x: number, y: number, r: number, fill: string, stroke = ink, sw = 0.8) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const ellipse = (x: number, y: number, rx: number, ry: number, fill: string, stroke = ink, sw = 1) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke = ink, sw = 1.1) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const star = (x: number, y: number, r: number, fill: string) =>
    path(
      `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`,
      fill,
      "none",
    );
  // The torso garment, clipped to the champion's own cut.
  const clipId = `rare-${collection}-${id}-${dir}`;
  const torso = (svg: string) =>
    put(
      "body",
      `<defs><clipPath id="${clipId}"><path d="${cut}" transform="translate(${bx} 0)"/></clipPath></defs><g clip-path="url(#${clipId})">${svg}</g>` +
        path(cut, "none", ink, 1.2).replace("<path", `<path transform="translate(${bx} 0)"`),
    );

  switch (collection) {
    case "wayfarer": {
      const jacket = bulky ? "#55704f" : "#5f7a52",
        leather = "#7a4e2c",
        bedroll = "#b8533a",
        stripe = "#f0d9a8",
        kerchief = "#d24a3a";
      // Short field jacket: the lower third is the champion's own body.
      const hemY = T + (B - T) * 0.68;
      torso(
        rect(L - 2, T - 2, R - L + 4, hemY - T + 2, 0, jacket, "none") +
          rect(L - 2, hemY - 3, R - L + 4, 4.5, 0, leather) +
          rect(C - 2.6, hemY - 3.4, 5.2, 5, 1, "#e2c36f", ink, 0.7) +
          (back
            ? ""
            : side
              ? line(`M${C + side * 3} ${T + 2}V${hemY - 3}`, "#3f5238", 1) +
                rect(C + side * (W - 9), T + 9, 7, 6, 1, "#6c8a5e", ink, 0.7)
              : // Chest pockets and the satchel strap crossing the chest.
                rect(L + 4, T + 7, 8, 6, 1, "#6c8a5e", ink, 0.7) +
                rect(R - 12, T + 7, 8, 6, 1, "#6c8a5e", ink, 0.7) +
                line(`M${L + 3} ${T + 1}L${R - 4} ${hemY - 2}`, leather, 3.4) +
                line(`M${L + 3} ${T + 1}L${R - 4} ${hemY - 2}`, "#a3714a", 1)),
      );
      // The trail pack: a bedroll across the shoulders shows either side of
      // the head from the front; from behind the whole pack covers the back.
      const roll = (x0: number, x1: number, y: number) =>
        rect(x0, y - 6, x1 - x0, 12, 6, bedroll) +
        [0.22, 0.78].map((k) => line(`M${x0 + (x1 - x0) * k} ${y - 6}V${y + 6}`, leather, 2.2)).join("") +
        line(`M${x0 + 4} ${y}H${x1 - 4}`, stripe, 0.9) +
        ellipse(x0 + 2.5, y, 2.5, 6, "#9a4330", ink, 0.8) +
        ellipse(x1 - 2.5, y, 2.5, 6, "#9a4330", ink, 0.8);
      if (back) {
        put(
          backPart,
          rect(C - 19, T - 3, 38, B - T - 4, 6, "#8a6038") +
            path(`M${C - 19} ${T + 2}H${C + 19}V${T + 12}Q${C} ${T + 17} ${C - 19} ${T + 12}Z`, "#a3714a") +
            rect(C - 3, T + 11, 6, 6, 1, "#e2c36f", ink, 0.7) +
            rect(C - 13, T + 21, 26, 10, 3, "#7a5530") +
            roll(C - 27, C + 27, T - 6),
        );
      } else if (side) {
        // Pack on the back, bedroll on top of it; the jacket hides its front.
        const px = C - side * (W + 6);
        put("body", rect(px - 8, T - 2, 16, B - T - 6, 5, "#8a6038") + roll(px - 9, px + 9, T - 7) + rect(px - side * 2 - 3, T + 8, 6, 9, 2, "#7a5530"), true);
      } else {
        put("body", roll(head.cx - 55, head.cx + 55, T - 6) + rect(L - 5, T - 4, 7, 22, 3, "#8a6038") + rect(R - 2, T - 4, 7, 22, 3, "#8a6038"), true);
      }
      // Satchel at the hip, on its strap.
      if (!back) {
        const sx = side ? C + side * (W - 4) : R - 3;
        put("body", rect(sx - 6, hemY - 1, 12, 10, 3, "#9b6a3e") + path(`M${sx - 6} ${hemY + 1}H${sx + 6}V${hemY + 5}Q${sx} ${hemY + 8} ${sx - 6} ${hemY + 5}Z`, "#b9844f") + circle(sx, hemY + 5, 1.2, "#e2c36f", ink, 0.5));
      }
      // Neckerchief: a knot under the chin with tails that fly to one side.
      const ky = T + 2,
        kx = back ? C : C + (side || 1) * 4;
      const tail = side ? -side : 1;
      put(
        back ? "scarf" : "body",
        back
          ? path(`M${C - 12} ${ky - 2}L${C + 12} ${ky - 2}L${C} ${ky + 12}Z`, kerchief)
          : path(`M${C - 13} ${ky - 3}Q${C} ${ky + 4} ${C + 13} ${ky - 3}L${C + 9} ${ky + 3}Q${C} ${ky + 8} ${C - 9} ${ky + 3}Z`, kerchief) +
              circle(kx, ky + 3, 3, "#b33a2d") +
              path(`M${kx} ${ky + 4}q${tail * 8} 2 ${tail * 13} 9l${-tail * 4} 2q${-tail * 4} -6 ${-tail * 9} -8Z`, kerchief) +
              path(`M${kx} ${ky + 4}q${tail * 3} 6 ${tail * 4} 13l${-tail * 4} 0q0 -7 ${-tail * 2} -11Z`, "#e05a48"),
      );
      break;
    }
    case "moonlit-tea": {
      const silk = bulky ? "#5b7d58" : "#45528a",
        lining = "#f2a6bf",
        obi = "#e87f9f",
        cord = "#f3d27a",
        collar = "#fbf1e4";
      const obiY = T + (B - T) * 0.52;
      // Wrapped kimono: left panel over right, a white under-collar, the obi.
      torso(
        rect(L - 2, T - 2, R - L + 4, B - T + 4, 0, silk, "none") +
          (back
            ? line(`M${C} ${T}V${obiY - 5}`, "#33406e", 1)
            : side
              ? path(`M${C + side * 2} ${T - 1}L${C + side * 9} ${obiY - 4}`, "none", collar, 2.6)
              : path(`M${L + 3} ${T}L${C + 6} ${obiY - 4}`, "none", collar, 3) + path(`M${R - 3} ${T}L${C + 2} ${obiY - 6}`, "none", collar, 2.4) + line(`M${L + 3} ${T}L${C + 6} ${obiY - 4}`, ink, 0.6)) +
          // A blossom on the silk.
          (back ? "" : [0, 1, 2, 3, 4].map((i) => circle(L + 7 + Math.cos(i * 1.256) * 2.2, B - 7 + Math.sin(i * 1.256) * 2.2, 1.5, lining, "none")).join("")) +
          rect(L - 2, obiY - 4.5, R - L + 4, 9, 0, obi) +
          line(`M${L} ${obiY}H${R}`, cord, 1.1) +
          circle(back ? C : C + (side ? side * 4 : 0), obiY, 1.6, cord, ink, 0.5),
      );
      // Furisode sleeves hang behind the arms, past the body's outline.
      // Furisode sleeves: long drapes that hang from under the arms and flare
      // out past them, lined in pink, rounded at the bottom.
      const sleeve = (x: number, s: number) =>
        path(`M${x} ${T + 6}q${s * 9} 0 ${s * 14} 4l${s * 3} 19q${s * 1} 7 ${-s * 7} 8l${-s * 8} 0q${-s * 4} 0 ${-s * 4} -5Z`, silk) +
        path(`M${x + s * 3} ${T + 27}q${s * 8} 1 ${s * 13} -1q${s * 1} 6 ${-s * 6} 8l${-s * 6} 0q${-s * 2} 0 ${-s * 1} -7Z`, lining, ink, 0.6) +
        line(`M${x + s * 6} ${T + 12}l${s * 3} 12`, "#33406e", 0.8);
      if (side) put("body", sleeve(C + side * (W - 9), side), true);
      else put("body", sleeve(L + 1, -1) + sleeve(R - 1, 1), true);
      // The butterfly bow: its wings past the waist from the front, the whole
      // bow across the back, beside the back in profile.
      const bow = (x: number, y: number, k: number) =>
        path(`M${x} ${y}q${-14 * k} ${-12 * k} ${-17 * k} ${-2 * k}q${2 * k} ${9 * k} ${17 * k} ${2 * k}Z`, obi) +
        path(`M${x} ${y}q${14 * k} ${-12 * k} ${17 * k} ${-2 * k}q${-2 * k} ${9 * k} ${-17 * k} ${2 * k}Z`, obi) +
        path(`M${x - 2} ${y + 1}l${-5 * k} ${13 * k}l${4 * k} 0l${2 * k} ${-11 * k}Z`, "#d4688a") +
        path(`M${x + 2} ${y + 1}l${5 * k} ${13 * k}l${-4 * k} 0l${-2 * k} ${-11 * k}Z`, "#d4688a") +
        rect(x - 3.5 * k, y - 4 * k, 7 * k, 8 * k, 2, "#f4a3bc");
      if (back) put(backPart, bow(C, obiY, 1.25));
      else if (side) put("body", bow(C - side * (W + 3), obiY, 0.8));
      else put("body", bow(C, obiY, 1.55), true);
      // Kanzashi: a cluster of blossoms at the side of the head with dangling
      // strands of petals.
      const ks = side ? -side : 1;
      const kx = head.cx + ks * (side ? 18 : 30),
        ky = Math.max(10, head.top) + (back ? 16 : 14);
      const blossom = (x: number, y: number, r: number, c: string) =>
        [0, 1, 2, 3, 4].map((i) => circle(x + Math.cos(i * 1.256 - 1.57) * r * 0.62, y + Math.sin(i * 1.256 - 1.57) * r * 0.62, r * 0.55, c, ink, 0.5)).join("") + circle(x, y, r * 0.3, cord, "none");
      put(
        "flame",
        line(`M${kx - ks * 3} ${ky + 2}l${-ks * 9} ${-7}`, "#7a4e2c", 1.6) +
          [-1, 0, 1]
            .map((k) => {
              const sx = kx + k * 4 * ks;
              return line(`M${sx} ${ky + 3}V${ky + 16 + Math.abs(k) * -3}`, cord, 0.6) + circle(sx, ky + 17 + Math.abs(k) * -3, 1.2, lining, ink, 0.4);
            })
            .join("") +
          blossom(kx, ky, 6.5, lining) +
          blossom(kx + ks * 6, ky - 4, 4.5, "#fbf1e4"),
      );
      break;
    }
    case "astral-court": {
      const velvet = "#161a36",
        mantle = "#2a3170",
        gold = "#e6c46a",
        pale = "#cfe6ff";
      // A long robe: gold-trimmed opening, star embroidery, a jewelled clasp.
      torso(
        rect(L - 2, T - 2, R - L + 4, B - T + 4, 0, velvet, "none") +
          (back
            ? line(`M${C - 6} ${T + 4}L${C} ${B}L${C + 6} ${T + 4}`, gold, 0.9)
            : line(`M${C + (side * 4 || -2)} ${T}V${B}`, gold, 1.4) + (side ? "" : line(`M${C + 2} ${T}V${B}`, gold, 1.4))) +
          line(`M${L} ${B - 2}H${R}`, gold, 1.6) +
          [
            [L + 6, T + 10],
            [R - 7, T + 14],
            [L + 9, B - 9],
            [R - 9, B - 8],
          ]
            .map(([x, y]) => star(x, y, 2, pale))
            .join(""),
      );
      // Shoulder mantle, scalloped, with fringed gold epaulettes. It sits on
      // the shoulders, under the chin, so it never paints over the face.
      const mW = W + 9,
        mY = T - 3;
      // Top edge over the shoulders, then a scalloped hem back from right to left.
      const hem = Array.from({ length: 6 }, (_, i) => {
        const x0 = C + mW - (i * mW) / 3,
          x1 = x0 - mW / 3;
        return `Q${(x0 + x1) / 2} ${mY + 19} ${x1} ${mY + 13}`;
      }).join("");
      const mantlePath = `M${C - mW} ${mY + 13}Q${C - mW} ${mY - 1} ${C} ${mY - 2}Q${C + mW} ${mY - 1} ${C + mW} ${mY + 13}${hem}Z`;
      put(
        backPart,
        path(mantlePath, mantle) +
          path(`M${C - mW + 2} ${mY + 12}Q${C} ${mY + 17} ${C + mW - 2} ${mY + 12}`, "none", gold, 1.2) +
          [0.25, 0.5, 0.75].map((k) => star(C - mW + mW * 2 * k, mY + 7 + (k === 0.5 ? 1 : 0), 1.5, pale)).join("") +
          (side
            ? ""
            : [-1, 1]
                .map((s) =>
                  ellipse(C + s * (mW - 3), mY + 5, 5.5, 3.5, gold) +
                  [0, 1, 2].map((i) => line(`M${C + s * (mW - 6 + i * 3)} ${mY + 8}v4`, gold, 0.9)).join(""),
                )
                .join("")) +
          (back ? "" : circle(side ? C + side * 5 : C, mY + 3, 2.6, "#7fb6ff", gold, 1)),
      );
      // A circlet of stars floats over the head, tilted toward the viewer.
      const cy = Math.max(10, head.top - 9),
        rx = side ? 12 : 17,
        ry = 4.5;
      put(
        "flame",
        ellipse(head.cx, cy, rx, ry, "none", gold, 1.4) +
          ellipse(head.cx, cy, rx, ry, "none", "#fff3c4", 0.5) +
          Array.from({ length: 5 }, (_, i) => {
            const a = Math.PI * (0.15 + (i / 4) * 0.7);
            return star(head.cx + Math.cos(a) * rx * (i % 2 ? 1 : 0.98), cy + Math.sin(a) * ry, i === 2 ? 3.6 : 2.2, i === 2 ? "#fff3c4" : gold);
          }).join(""),
      );
      break;
    }
  }
  return out;
}

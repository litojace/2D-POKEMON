import type { CharacterId } from "@arena/shared";
import type { FashionCollection } from "../../../../packages/shared/src/shop";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { Palette } from "./skin-art";

/** Character-specific equipment. Every piece is attached to a rig joint;
 * profile equipment is authored at the visible temple/wing, not squeezed. */
export function fashionSignatures(
  id: CharacterId,
  dir: Facing,
  collection: FashionCollection,
  p: Palette,
  head: { cx: number; top: number },
): [CreaturePart, string][] {
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0,
    back = dir === "up";
  const cx = head.cx,
    top = Math.max(6, head.top),
    gold = "#dcb873",
    ivory = "#f5e8cd";
  const fabric =
    collection === "wayfarer"
      ? "#536e61"
      : collection === "moonlit-tea"
        ? p.accent
        : collection === "astral-court"
          ? "#354362"
          : "#59443f";
  const path = (d: string, fill = fabric, stroke = p.dark, width = 1.1) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const line = (d: string, color = gold, width = 1.2) =>
    path(d, "none", color, width);
  const circle = (
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke = p.dark,
  ) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`;
  const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
  ) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${p.dark}" stroke-width="1"/>`;
  const motif = (x: number, y: number, r = 3) => {
    switch (collection) {
      case "wayfarer":
        return (
          path(
            `M${x - r} ${y}L${x} ${y - r}L${x + r} ${y}L${x} ${y + r}Z`,
            ivory,
            gold,
            0.7,
          ) + line(`M${x} ${y - r + 1}v${r * 2 - 2}`, p.accent, 0.9)
        );
      case "moonlit-tea":
        return (
          Array.from({ length: 5 }, (_, i) => {
            const a = (i * Math.PI * 2) / 5;
            return ellipse(
              x + Math.cos(a) * r * 0.55,
              y + Math.sin(a) * r * 0.55,
              r * 0.6,
              r * 0.45,
              ivory,
            );
          }).join("") + circle(x, y, r * 0.3, gold, "none")
        );
      case "astral-court":
        return path(
          `M${x} ${y - r - 1}L${x + r * 0.75} ${y}L${x} ${y + r + 1}L${x - r * 0.75} ${y}Z`,
          p.glow,
          gold,
          0.7,
        );
    }
  };
  const feather = (x: number, y: number, s = 1) =>
    path(
      `M${x} ${y}q${-12 * s} ${-12 * s} ${-5 * s} ${-18 * s}q${9 * s} ${9 * s} ${5 * s} ${18 * s}Z`,
      p.accent,
    ) + line(`M${x} ${y}l${-5 * s} ${-13 * s}`, gold, 0.7);
  const out: [CreaturePart, string][] = [];
  const put = (part: CreaturePart, svg: string) =>
    out.push([
      part,
      `<g class="fashion-signature" data-champion="${id}" data-view="${dir}" data-equipment="${collection}">${svg}</g>`,
    ]);
  // A carrier may be on both sides in front and on the nearest side in profile.
  // In profile the face points toward `side`, while the near ear, gill and
  // antenna roots sit behind it. Match the champion's authored profile art.
  const sides = side ? [-side] : [-1, 1];
  switch (id) {
    case "voltkit": {
      // The goggles remain visible: equipment laces around their upper rim.
      const y = top + 9;
      put(
        "flame",
        line(
          `M${cx - 25} ${y + 3}Q${cx} ${y - 6} ${cx + 25} ${y + 3}`,
          fabric,
          4,
        ) +
          line(
            `M${cx - 21} ${y + 2}Q${cx} ${y - 3} ${cx + 21} ${y + 2}`,
            gold,
            0.8,
          ) +
          sides.map((s) => motif(cx + s * 23, y + 3, 3)).join("") +
          (collection === "wayfarer"
            ? feather(cx - 17, y, 0.65)
            : collection === "astral-court"
              ? path(
                  `M${cx - 7} ${y - 2}L${cx} ${y - 12}L${cx + 7} ${y - 2}`,
                  fabric,
                ) + motif(cx, y - 6)
              : ""),
      );
      put(
        "scarf",
        back
          ? path("M89 131H111V151L100 155L89 151Z", "#987348") +
              line("M93 136H107V147H93Z", ivory, 0.8)
          : line("M77 129Q90 138 101 143", fabric, 3) + motif(82, 132, 3),
      );
      break;
    }
    case "cindrake": {
      // Horn sleeves, not a cap pasted across the flame crest.
      for (const s of sides) {
        const x = cx + s * (side ? 26 : 32),
          y = top + 18;
        put(
          "ears",
          path(
            `M${x - s * 7} ${y - 3}l${s * 12} -7l${s * 3} 8l${-s * 10} 7Z`,
            fabric,
          ) +
            line(`M${x - s * 4} ${y - 1}l${s * 12} -7`, gold, 1.5) +
            motif(x + s * 2, y + 1, 2.5),
        );
      }
      put(
        "scarf",
        path(
          `M${91 + side * 5} 129L${100 + side * 5} 125L${110 + side * 5} 131L${108 + side * 5} 141L${94 + side * 5} 142Z`,
          fabric,
        ) + motif(100 + side * 5, 134, 3),
      );
      break;
    }
    case "tidefin": {
      // Frond clasps rotate with the gills; the blade gets its own guard.
      for (const s of sides) {
        const x = cx + s * (side ? 28 : 43),
          y = top + 26;
        put(
          "ears",
          path(
            `M${x - s * 5} ${y - 6}q${s * 12} -4 ${s * 13} 2l${-s * 9} 9Z`,
            fabric,
          ) + motif(x + s * 2, y, 3),
        );
      }
      put(
        "flame",
        line(
          `M${cx - 20} ${top + 13}Q${cx} ${top + 7} ${cx + 20} ${top + 13}`,
          ivory,
          2,
        ) + motif(cx + (back ? -8 : 0), top + 9, 3),
      );
      const guardX = dir === "down" ? 136 : back ? 124 : side < 0 ? 111 : 89;
      put(
        "armR",
        path(
          `M${guardX - 8} 145Q${guardX + 3} 141 ${guardX + 10} 148L${guardX + 6} 154H${guardX - 9}Z`,
          fabric,
        ) + motif(guardX, 149, 3),
      );
      break;
    }
    case "auralynx": {
      for (const s of sides) {
        const x = cx + s * (side ? 27 : 34),
          y = top - 6;
        put(
          "ears",
          path(
            `M${x - s * 5} ${y - 3}l${s * 7} -7l${s * 2} 16l${-s * 8} 5Z`,
            fabric,
          ) +
            line(`M${x - s * 3} ${y + 5}l${s * 7} -4`, gold, 1.5) +
            motif(x, y + 2, 2),
        );
      }
      put(
        "flame",
        line(
          `M${cx - 11} ${top + 11}Q${cx} ${top + 16} ${cx + 11} ${top + 11}`,
          gold,
        ) + motif(cx, top + 13, 3),
      );
      // Separate wrist jewellery follows the crystal fists, never the torso.
      const wrists =
        dir === "down"
          ? [73, 127]
          : back
            ? [76, 124]
            : side < 0
              ? [79, 109]
              : [121, 91];
      wrists.forEach((x, i) =>
        put(
          i === 0 ? "armL" : "armR",
          path(`M${x - 7} 140h14v7h-14Z`, fabric) + motif(x, 143, 2.3),
        ),
      );
      break;
    }
    case "lumoth": {
      // A saddle between the wing roots and antenna pendants, no hat.
      for (const s of sides)
        put(
          "ears",
          line(`M${cx + s * 20} ${top - 11}l${s * 3} 8`, gold, 0.9) +
            motif(cx + s * 23, top - 2, 2.5),
        );
      put(
        "flame",
        path(
          `M${cx - 13} ${top + 10}Q${cx} ${top + 1} ${cx + 13} ${top + 10}Q${cx} ${top + 21} ${cx - 13} ${top + 10}Z`,
          fabric,
        ) + motif(cx, top + 10, 3),
      );
      if (!side)
        put(
          "wings",
          [-1, 1]
            .map(
              (s) =>
                path(
                  `M${100 + s * 31} 120q${s * 7} -9 ${s * 12} -3l${-s * 4} 12Z`,
                  fabric,
                ) + motif(100 + s * 36, 121, 2.5),
            )
            .join(""),
        );
      else {
        const x = 100 - side * 25;
        put(
          "wings",
          path(
            `M${x - 5} 120Q${x + 3} 114 ${x + 8} 121L${x + 4} 131Z`,
            fabric,
          ) + motif(x + 1, 122, 2.5),
        );
      }
      break;
    }
    case "mystowl": {
      const s = side || 1,
        x = cx + s * 22,
        y = top + 8;
      put(
        "flame",
        path(
          `M${x - s * 7} ${y + 4}q${s * 9} -10 ${s * 15} -8l${-s * 4} 12Z`,
          fabric,
        ) +
          feather(x + s * 3, y, 0.75) +
          motif(x, y + 3, 3),
      );
      put(
        "scarf",
        back
          ? line("M82 131Q100 151 118 131", gold, 1.8) + motif(100, 144, 4)
          : path("M90 130L100 126L111 132L104 141L94 139Z", fabric) +
              motif(100, 133, 3),
      );
      break;
    }
    case "terradon": {
      // An open crown leaves the sprout clear; shell gear is rear/side only.
      put(
        "flame",
        line(
          `M${cx - 27} ${top + 14}Q${cx} ${top + 23} ${cx + 27} ${top + 14}`,
          fabric,
          5,
        ) + sides.map((s) => motif(cx + s * 24, top + 15, 3)).join(""),
      );
      if (back)
        put(
          "body",
          path("M78 128Q100 119 122 128V149Q100 162 78 149Z", fabric) +
            path("M84 132H116V146H84Z", ivory) +
            line("M88 137H111M88 141H106", p.accent, 0.9) +
            motif(100, 151, 3),
        );
      else if (side)
        put(
          "body",
          path(`M${100 - side * 20} 129h18v23h-18Z`, fabric) +
            motif(109 - side * 20, 140, 4),
        );
      else
        put(
          "scarf",
          path("M77 131Q100 141 123 131L118 142H82Z", fabric) +
            motif(100, 138, 3.5),
        );
      break;
    }
    case "duskveil": {
      // Embroidered hood seam and side clasp, no second floating hat.
      put(
        "flame",
        line(`M${cx - 6} 8Q${cx + 12} 23 ${cx + 28} 43`, gold, 0.9) +
          path(`M${cx + 17} 29l11 6l-4 9l-10 -6Z`, fabric) +
          motif(cx + 20, 37, 3),
      );
      put(
        "scarf",
        path(
          back
            ? "M83 123L113 127L119 148L109 154L100 143L90 151Z"
            : "M81 127L99 133L119 124L114 145L101 140L92 154L87 143Z",
          fabric,
        ) + motif(back ? 106 : 92, 136, 3),
      );
      break;
    }
    case "coilemur": {
      const s = side || -1;
      put(
        "flame",
        path(
          `M${cx - 24} ${top + 8}Q${cx} ${top - 1} ${cx + 24} ${top + 8}L${cx + 19} ${top + 14}Q${cx} ${top + 6} ${cx - 20} ${top + 14}Z`,
          fabric,
        ) +
          circle(cx + s * 20, top + 9, 5, gold) +
          motif(cx + s * 20, top + 9, 2.5),
      );
      put(
        "scarf",
        back
          ? path("M87 128H111L116 150L94 154Z", fabric) +
              circle(100, 140, 7, gold) +
              circle(100, 140, 3, p.accent)
          : line("M79 126L118 150", fabric, 4) + motif(115, 146, 4),
      );
      break;
    }
    case "pyranda": {
      const s = side || -1;
      put(
        "flame",
        path(
          `M${cx - 21} ${top + 9}Q${cx - 19} ${top - 7} ${cx + 7} ${top - 4}L${cx + 23} ${top + 7}L${cx + 12} ${top + 13}Q${cx - 4} ${top + 6} ${cx - 21} ${top + 9}Z`,
          fabric,
        ) + motif(cx + s * 15, top + 5, 4),
      );
      put(
        "scarf",
        back
          ? path("M83 129Q101 120 118 129L114 154Q100 149 87 155Z", fabric) +
              line("M89 132L111 149M111 132L89 149", ivory, 0.8)
          : path(
              "M79 131L91 128L99 144L114 128L123 133L113 143L103 153H91Z",
              fabric,
            ) + motif(103, 147, 3),
      );
      break;
    }
    case "glacelle": {
      // Bell comb and chain of pearls, with open space around the face.
      put(
        "flame",
        path(
          `M${cx - 24} ${top + 13}Q${cx} ${top - 7} ${cx + 24} ${top + 13}L${cx + 18} ${top + 16}Q${cx} ${top + 5} ${cx - 18} ${top + 16}Z`,
          fabric,
        ) +
          [-1, 0, 1]
            .map((s) => motif(cx + s * 13, top + 8 + Math.abs(s) * 3, 3))
            .join(""),
      );
      put(
        "scarf",
        line("M80 129Q100 151 120 129", gold, 1) +
          [-1, 0, 1]
            .map((s) => circle(100 + s * 13, 140 - Math.abs(s) * 4, 2.5, ivory))
            .join(""),
      );
      break;
    }
    case "halcyra": {
      const s = side || -1;
      put(
        "flame",
        path(
          `M${cx + s * 13} ${top + 8}l${s * 7} -13l${s * 9} 4l${-s * 4} 15Z`,
          fabric,
        ) +
          feather(cx + s * 20, top + 6, 0.8) +
          motif(cx + s * 22, top + 11, 3),
      );
      put(
        "scarf",
        back
          ? path("M82 130L100 127L118 130L106 146L100 159L94 146Z", fabric) +
              motif(100, 138, 4)
          : path("M87 128L100 136L113 128L108 144L100 150L92 144Z", fabric) +
              motif(100, 141, 3),
      );
      break;
    }
    case "sunbara": {
      put(
        "flame",
        path(
          `M${cx - 28} ${top + 9}Q${cx - 20} ${top - 2} ${cx + 15} ${top + 2}L${cx + 28} ${top + 10}Q${cx} ${top + 18} ${cx - 28} ${top + 9}Z`,
          collection === "wayfarer" ? ivory : fabric,
        ) +
          line(
            `M${cx - 18} ${top + 6}Q${cx} ${top + 11} ${cx + 19} ${top + 7}`,
            p.accent,
            2.4,
          ) +
          motif(cx - 17, top + 8, 3),
      );
      put(
        "scarf",
        back
          ? path("M84 130Q100 142 116 130V151Q100 160 84 151Z", fabric) +
              motif(100, 146, 4)
          : path("M82 130Q100 140 118 130L115 141Q100 146 85 141Z", fabric) +
              motif(100, 140, 3),
      );
      break;
    }
    case "astrabun": {
      // Ear tie and a pendant on the opposite side, rather than a shared cap.
      const s = side || -1,
        x = cx + s * 25,
        y = top - 7;
      put(
        "ears",
        path(
          `M${x} ${y}q${-s * 13} -11 ${-s * 14} 0q${s * 4} 8 ${s * 14} 2q${s * 12} 6 ${s * 11} -3q${-s * 5} -8 ${-s * 11} 1Z`,
          fabric,
        ) +
          motif(x, y, 3) +
          line(`M${x - s * 3} ${y + 3}l${-s * 5} 12`, gold, 1),
      );
      put(
        "scarf",
        back
          ? circle(100, 150, 7, ivory) + motif(100, 149, 3)
          : path("M85 128L100 135L115 128L109 143H91Z", fabric) +
              motif(100, 138, 4),
      );
      break;
    }
    case "wombolder": {
      put(
        "flame",
        path(
          `M${cx - 27} ${top + 11}Q${cx - 25} ${top - 5} ${cx} ${top - 6}Q${cx + 25} ${top - 5} ${cx + 27} ${top + 11}L${cx + 31} ${top + 15}Q${cx} ${top + 21} ${cx - 31} ${top + 15}Z`,
          fabric,
        ) +
          line(`M${cx} ${top - 5}v16`, gold, 1.6) +
          motif(cx, top + 12, 4),
      );
      put(
        "scarf",
        line(
          back ? "M82 127L115 155M118 127L85 155" : "M83 128V154M117 128V154",
          fabric,
          4,
        ) + motif(back ? 100 : 83, back ? 140 : 135, 3),
      );
      break;
    }
    case "shadopus": {
      put(
        "flame",
        path(
          `M${cx - 25} ${top + 8}Q${cx - 19} ${top - 3} ${cx} ${top - 1}Q${cx + 24} ${top - 6} ${cx + 25} ${top + 8}Q${cx} ${top + 14} ${cx - 25} ${top + 8}Z`,
          fabric,
        ) +
          path(`M${cx - 19} ${top + 8}q18 7 39 0v5q-19 7 -39 0Z`, ivory) +
          motif(cx + (side || 1) * 15, top + 11, 3),
      );
      put(
        "scarf",
        line(
          back ? "M81 129Q100 147 119 129" : "M83 130Q100 145 117 130",
          fabric,
          3,
        ) +
          [-1, 0, 1]
            .map((s) => motif(100 + s * 11, 139 - Math.abs(s) * 4, 2.6))
            .join(""),
      );
      break;
    }
    case "pangrove": {
      for (const s of sides) {
        const x = cx + s * (side ? 24 : 31),
          y = top + 10;
        put(
          "flame",
          path(
            `M${x - s * 7} ${y - 3}q${s * 3} -10 ${s * 14} -9q${-s * 2} 13 ${-s * 14} 16Z`,
            fabric,
          ) + motif(x + s * 2, y - 2, 3),
        );
      }
      put(
        "scarf",
        path(
          back
            ? "M81 127L92 132L100 127L108 132L119 127L115 145L105 142L100 151L95 142L85 145Z"
            : "M80 129L92 135L100 128L108 135L120 129L113 143L104 139L100 147L96 139L87 143Z",
          fabric,
        ) + motif(100, 137, 3),
      );
      break;
    }
    case "mossloth": {
      const s = side || -1;
      put(
        "flame",
        path(
          `M${cx - 25} ${top + 11}Q${cx - 18} ${top - 7} ${cx + 12} ${top - 2}Q${cx + 23} ${top + 1} ${cx + 25} ${top + 11}L${cx + 13} ${top + 15}Q${cx - 7} ${top + 7} ${cx - 25} ${top + 11}Z`,
          fabric,
        ) + motif(cx + s * 18, top + 7, 4),
      );
      put(
        "scarf",
        path(
          back
            ? "M78 127Q100 119 122 127L119 147L106 143L100 156L92 144L81 150Z"
            : "M79 129Q100 138 121 129L116 144L104 141L97 154L89 141L82 146Z",
          fabric,
        ) + motif(back ? 100 : 89, back ? 135 : 137, 3),
      );
      break;
    }
  }
  return out;
}

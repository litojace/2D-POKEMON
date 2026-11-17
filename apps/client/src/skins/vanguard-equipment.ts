import type { CharacterId } from "@arena/shared";
import { proportioned, type CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { HeroPreview } from "./vanguard-art";

/** Eighteen authored equipment sets. Coordinates are final rig art units;
 * front, profile and rear closures are constructed independently. */
export function vanguardOutfit(
  id: CharacterId,
  dir: Facing,
  design: HeroPreview,
  head: { cx: number; top: number },
): [CreaturePart, string][] {
  const back = dir === "up",
    side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const cx = 100 + side * 6,
    hx = head.cx,
    hy = Math.max(14, head.top),
    ink = design.palette.dark;
  const cloth = design.suit,
    panel = design.panel,
    trim = design.trim,
    glow = design.palette.glow,
    ivory = "#fff1d9";
  const p = (d: string, fill = cloth, stroke = ink, sw = 1.2) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const l = (d: string, c = trim, w = 1.2) => p(d, "none", c, w);
  const e = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill = cloth,
    stroke = ink,
    sw = 1,
  ) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const diamond = (x: number, y: number, r = 4, fill = glow) =>
    p(
      `M${x} ${y - r}L${x + r * 0.7} ${y}L${x} ${y + r}L${x - r * 0.7} ${y}Z`,
      fill,
      trim,
      0.7,
    );
  const hex = (x: number, y: number, rx: number, ry: number, fill = cloth) =>
    p(
      `M${x - rx} ${y - ry * 0.5}L${x} ${y - ry}L${x + rx} ${y - ry * 0.5}V${y + ry * 0.5}L${x} ${y + ry}L${x - rx} ${y + ry * 0.5}Z`,
      fill,
    );
  const out: [CreaturePart, string][] = [];
  const put = (part: CreaturePart, svg: string) =>
    out.push([
      part,
      `<g class="hero-equipment" data-hero="${id}" data-view="${dir}">${svg}</g>`,
    ]);
  const local = (svg: string) =>
    `<g transform="translate(${cx} 0) scale(${side || 1} 1)">${svg}</g>`;
  const suit = (front: string, profile: string, rear: string, details = "") =>
    put("body", local(p(back ? rear : side ? profile : front) + details));
  const chest = (svg: string) => {
    if (!back)
      put(
        "body",
        `<g transform="translate(${cx} 141) scale(${side ? 0.7 : 1} 1)">${svg}</g>`,
      );
  };
  const buckle = (x: number, y: number) =>
    hex(x, y, 4, 3, trim) + l(`M${x - 2} ${y}h4`, ink, 0.8);
  const cuff = (part: CreaturePart, x: number, y = 143) =>
    put(
      part,
      p(`M${x - 7} ${y - 7}h14l1 11l-8 4l-8 -4Z`, panel) +
        l(`M${x - 5} ${y - 3}h10`, trim, 1.5),
    );
  const farPaw = ["auralynx", "duskveil", "coilemur", "wombolder"].includes(id)
    ? 76
    : 85;
  const left = side
      ? proportioned("armL", side === 1 ? 200 - farPaw : farPaw, 148)[0]
      : back
        ? 76
        : 71,
    right = side
      ? proportioned("armR", side === 1 ? 89 : 111, 148)[0]
      : back
        ? 124
        : 129;
  const footL = side === 1 ? 109 : side === -1 ? 91 : 84,
    footR = side === 1 ? 90 : side === -1 ? 110 : 116;
  const cape = (front: string, profile: string, rear: string, color = panel) =>
    put("wings", p(back ? rear : side ? profile : front, color));
  const band = (width = 27) =>
    p(
      `M${hx - width} ${hy + 16}Q${hx} ${hy + 6} ${hx + width} ${hy + 16}L${hx + width - 2} ${hy + 23}Q${hx} ${hy + 14} ${hx - width + 2} ${hy + 23}Z`,
      panel,
    );
  switch (id) {
    case "voltkit": {
      suit(
        "M-25 127L-13 121L0 127L13 121L25 127L22 151L11 162H-11L-22 151Z",
        "M-17 126L-7 121L15 127L18 147L9 159H-15L-20 145Z",
        "M-24 128L-12 122H12L24 128L19 154L8 162H-8L-19 154Z",
        l("M-17 129L-11 150H11L17 129", ivory, 2),
      );
      chest(l("M-9 -8L0 -2L9 -8M-9 -1L0 5L9 -1M-6 6L0 10L6 6", glow, 2.3));
      put(
        "flame",
        band(25) +
          (back
            ? l(`M${hx - 13} ${hy + 15}h26`, glow, 2)
            : [-1, 1]
                .filter((k) => !side || k === -side)
                .map(
                  (k) =>
                    hex(hx + k * 28, hy + 14, 7, 6, ivory) +
                    l(
                      `M${hx + k * 28 - 3} ${hy + 11}v6m3 -6v6m3 -6v6`,
                      cloth,
                      1,
                    ),
                )
                .join("")),
      );
      cuff("armL", left);
      cuff("armR", right);
      if (back)
        put(
          "body",
          hex(cx, 138, 10, 13, ivory) +
            l(`M${cx - 4} 132h8m-8 5h8m-8 5h8`, cloth, 1.6),
        );
      put("tail", diamond(side === 1 ? 54 : 146, 133, 5));
      break;
    }
    case "cindrake": {
      suit(
        "M-28 128L-14 122H14L28 128L25 146L17 161H-17L-25 146Z",
        "M-18 126L-5 122L17 127L21 145L11 161H-13L-20 148Z",
        "M-27 128L-15 122H15L27 128L22 151L12 164H-12L-22 151Z",
        p("M-18 137H18L16 146H-16Z", panel) + l("M-15 141H15", trim, 2),
      );
      cape(
        "M72 125L78 155L91 161L98 141L108 124Z",
        `M${cx - side * 9} 124L${cx - side * 29} 158L${cx - side * 8} 166L${cx + side * 2} 145Z`,
        "M73 123L82 159L102 168L114 146L127 128Z",
        ivory,
      );
      chest(
        p("M-7 -9V2Q0 13 7 2V-9H3V1Q0 5 -3 1V-9Z", trim) +
          l("M-3 -13V-10M3 -13V-10", glow, 1.4),
      );
      put(
        "body",
        local(
          p("M-26 125L-21 119L-10 125L0 130L16 123L24 127L16 136H-14Z", panel) +
            buckle(0, 132),
        ),
      );
      cuff("armL", left);
      put(
        "armR",
        hex(right, 143, 11, 12, ivory) +
          l(`M${right - 6} 138h12m-12 5h12m-12 5h8`, cloth, 1.6),
      );
      if (back)
        put(
          "body",
          local(
            p("M-13 128H13V149L0 155L-13 149Z", panel) +
              l("M-8 133H8M-8 138H8M-6 143H6", glow, 1.3),
          ),
        );
      break;
    }
    case "tidefin": {
      suit(
        "M-25 127Q0 118 25 127L28 142L17 160L0 165L-17 160L-28 142Z",
        "M-18 125Q0 119 18 127L22 140L10 163L-8 160L-21 146Z",
        "M-25 127Q0 120 25 127L23 145L13 163H-13L-23 145Z",
        p("M-18 130L0 139L18 130L13 150H-13Z", panel),
      );
      chest(l("M-9 -5Q-4 -11 1 -5Q5 -1 9 -5M-9 2Q-4 -4 1 2Q5 6 9 2", glow, 2));
      const gill = side ? -side : 1;
      put(
        "flame",
        band(22) +
          p(
            `M${hx + gill * 22} ${hy + 13}l${gill * 13} -7l${-gill * 2} 9l${-gill * 12} 4Z`,
            ivory,
          ),
      );
      cape(
        "M72 124L60 151L82 143L99 153L119 141L139 151L128 124Z",
        `M${cx - side * 12} 122L${cx - side * 37} 146L${cx - side * 17} 143L${cx - side * 9} 157L${cx + side * 2} 140Z`,
        "M72 122L57 145L81 142L100 160L119 142L143 145L128 122Z",
        ivory,
      );
      put(
        "armR",
        e(right, 146, 9, 11, design.palette.mid) +
          `<g transform="translate(${right} 0) scale(${side || 1} 1)">` +
          p("M-4 150Q4 127 13 112Q24 128 10 149L-3 156Z", ivory) +
          l("M5 143L13 124", cloth, 1.8) +
          "</g>",
      );
      cuff("armL", left);
      break;
    }
    case "auralynx": {
      suit(
        "M-23 126L-10 120L0 125L10 120L23 126L18 146L10 160L0 165L-10 160L-18 146Z",
        "M-15 126L-5 121L15 125L18 142L7 162L-11 157L-18 142Z",
        "M-21 126L-10 121H10L21 126L17 147L6 164H-6L-17 147Z",
        p("M-12 126L0 135L12 126L8 151L0 158L-8 151Z", ivory),
      );
      chest(p("M-7 -7L0 -11L7 -7V3L0 9L-7 3Z", glow) + l("M0 -8V6", cloth, 1));
      put(
        "flame",
        l(
          `M${hx - 25} ${hy + 17}L${hx - 8} ${hy + 12}M${hx + 8} ${hy + 12}L${hx + 25} ${hy + 17}`,
          ivory,
          4,
        ) + hex(hx, hy + 15, 7, 4, glow),
      );
      for (const [part, x] of [
        ["armL", left],
        ["armR", right],
      ] as const)
        put(
          part,
          hex(x, 143, 10, 13, ivory) +
            hex(x, 143, 5, 7, glow) +
            l(`M${x - 8} 143h3m10 0h3`, cloth, 1.3),
        );
      cape(
        "M78 123L69 146L83 150L94 136L106 136L117 150L131 146L122 123Z",
        `M${cx - side * 8} 122L${cx - side * 25} 143L${cx - side * 12} 151L${cx + side * 3} 136Z`,
        "M76 122L71 144L84 157L100 144L116 157L129 144L124 122Z",
        ivory,
      );
      break;
    }
    case "lumoth": {
      suit(
        "M-22 125L-10 121H10L22 125L18 142L8 155H-8L-18 142Z",
        "M-15 125L-4 121L14 125L17 140L6 154H-9L-17 140Z",
        "M-21 125L-11 121H11L21 125L16 143L6 156H-6L-16 143Z",
        p("M-14 127H14L10 144L0 150L-10 144Z", ivory),
      );
      chest(
        p("M-5 -8H5L8 4L0 10L-8 4Z", glow) + l("M-3 -5V3M3 -5V3", cloth, 1),
      );
      for (const k of [-1, 1].filter((k) => !side || k === -side))
        put(
          "wings",
          hex(side ? 100 - side * 28 : 100 + k * 34, 128, 7, 9, ivory) +
            e(side ? 100 - side * 28 : 100 + k * 34, 128, 3, 5, glow, "none"),
        );
      put(
        "flame",
        l(
          `M${hx - 22} ${hy + 19}Q${hx} ${hy + 28} ${hx + 22} ${hy + 19}`,
          trim,
          2,
        ) + e(hx, hy + 23, 4, 3, glow),
      );
      if (back)
        put(
          "body",
          local(
            p("M-10 126Q0 117 10 126L12 143L0 153L-12 143Z", ivory) +
              l("M-6 129V143M0 127V145M6 129V143", cloth, 1),
          ),
        );
      break;
    }
    case "mystowl": {
      suit(
        "M-26 126L-13 121L0 127L13 121L26 126L24 144L14 161L0 167L-14 161L-24 144Z",
        "M-18 125L-6 121L16 127L22 144L8 164L-10 160L-21 144Z",
        "M-26 125L-14 121H14L26 125L24 146L11 165H-11L-24 146Z",
        l("M-17 130L0 145L17 130M-10 152L0 158L10 152", ivory, 1.5),
      );
      cape(
        "M73 123L63 154L80 169L92 149L100 158L108 149L120 169L137 154L127 123Z",
        `M${cx - side * 7} 122L${cx - side * 34} 151L${cx - side * 18} 169L${cx + side * 7} 148Z`,
        "M72 120L60 154L80 169L100 155L120 169L140 154L128 120Z",
        panel,
      );
      if (back)
        put(
          "wings",
          l("M76 143L95 135L120 148L109 158M95 135L100 155", trim, 1) +
            e(76, 143, 2, 2, glow, "none") +
            e(95, 135, 2, 2, glow, "none") +
            e(120, 148, 2, 2, glow, "none"),
        );
      chest(
        l("M-9 -6L0 -9L7 1L-4 7", glow, 1.2) +
          e(-9, -6, 2, 2, glow, "none") +
          e(7, 1, 2, 2, glow, "none"),
      );
      put(
        "flame",
        band(25) +
          p(
            `M${hx + (side ? -side : 1) * 22} ${hy + 15}l${(side ? -side : 1) * 9} -11l-1 14Z`,
            ivory,
          ),
      );
      cuff("armL", left);
      put(
        "armR",
        p(`M${right - 6} 134h12v17h-12Z`, ivory) +
          l(`M${right - 3} 138h6m-6 4h6m-6 4h4`, cloth, 1),
      );
      break;
    }
    case "terradon": {
      suit(
        "M-31 129L-18 123H18L31 129L26 149L15 160H-15L-26 149Z",
        "M-20 127L-9 122L17 128L23 145L13 160H-14L-23 145Z",
        "M-30 127L-16 122H16L30 127L26 148L13 162H-13L-26 148Z",
        p("M-20 128L-12 125L-9 151H9L12 125L20 128L17 157H-17Z", ivory),
      );
      const shell = (x: number, y: number, rx: number, ry: number) =>
        hex(x, y, rx, ry, panel) +
        hex(x, y, rx * 0.78, ry * 0.78, ivory) +
        hex(x, y, rx * 0.54, ry * 0.58, cloth) +
        l(
          `M${x - rx * 0.5} ${y - ry * 0.55}L${x + rx * 0.5} ${y + ry * 0.55}M${x + rx * 0.5} ${y - ry * 0.55}L${x - rx * 0.5} ${y + ry * 0.55}`,
          trim,
          1.2,
        ) +
        p(
          `M${x} ${y + 7}Q${x - 13} ${y - 2} ${x - 6} ${y - 8}Q${x + 1} ${y - 6} ${x} ${y + 7}Q${x + 13} ${y - 2} ${x + 6} ${y - 8}Q${x - 1} ${y - 6} ${x} ${y + 7}Z`,
          glow,
        );
      if (back) put("wings", shell(100, 139, 32, 31));
      else if (side) put("body", shell(100 - side * 24, 139, 17, 27));
      else put("wings", shell(100, 139, 39, 29));
      put(
        "flame",
        band(26) +
          p(
            `M${hx - 6} ${hy + 10}L${hx} ${hy + 4}L${hx + 6} ${hy + 10}L${hx} ${hy + 17}Z`,
            glow,
          ),
      );
      chest(p("M-6 -5Q0 -12 6 -5L0 6Z", glow));
      cuff("armL", left);
      cuff("armR", right);
      break;
    }
    case "duskveil": {
      suit(
        "M-25 126L-12 121H12L25 126L23 146L15 159L5 154L-3 167L-12 154L-23 160Z",
        "M-17 124L-5 120L17 127L18 145L7 164L-5 156L-18 162L-21 144Z",
        "M-25 124L-13 120H13L25 124L23 145L13 161L2 155L-9 166L-23 154Z",
        p("M-14 128H14L16 143L0 152L-16 143Z", ivory),
      );
      chest(
        l(
          "M-9 -7Q-15 0 -9 7M-4 -4Q-8 0 -4 4M4 -4Q8 0 4 4M9 -7Q15 0 9 7",
          cloth,
          1.8,
        ),
      );
      put(
        "flame",
        p(
          `M${hx - 5} 20Q${hx + 17} 32 ${hx + 24} 51L${hx + 15} 55L${hx + 1} 35Z`,
          panel,
        ) + l(`M${hx + 5} 31l6 4m-3 4l6 4m-3 4l6 4`, glow, 2),
      );
      put(
        "head",
        [-1, 1]
          .filter((k) => !side || k === -side)
          .map(
            (k) =>
              p(`M${hx + k * 32 - 5} 88h10v18h-10Z`, ivory) +
              l(`M${hx + k * 32 - 2} 92v10m4 -10v10`, cloth, 1),
          )
          .join(""),
      );
      // Echo cage surrounds the actual tail lantern in all facings.
      const [lx, ly] = proportioned(
        "tail",
        dir === "right" ? 19 : dir === "down" ? 180 : 181,
        dir === "down" ? 118 : 121,
      );
      put(
        "tail",
        p(`M${lx - 8} ${ly - 9}h16l-2 19h-12Z`, "none", trim, 1.2) +
          l(`M${lx - 4} ${ly - 6}v12m8 -12v12`, glow, 1),
      );
      if (back)
        put(
          "body",
          local(
            hex(0, 139, 13, 15, ivory) +
              l("M-8 133H8M-8 139H8M-6 145H6", cloth, 2),
          ),
        );
      break;
    }
    case "coilemur": {
      suit(
        "M-23 125L-12 121L0 126L12 121L23 125L24 148L13 163H-13L-24 148Z",
        "M-17 125L-6 120L15 126L19 148L6 163H-12L-20 146Z",
        "M-23 125L-13 120H13L23 125L22 148L10 164H-10L-22 148Z",
        p("M-15 128L0 137L15 128L12 150H-12Z", panel),
      );
      chest(
        l("M-8 -7Q4 -12 5 -3Q4 4 -4 0M8 7Q-4 12 -5 3Q-4 -4 4 0", glow, 1.6),
      );
      put(
        "flame",
        band(22) +
          [-1, 1]
            .filter((k) => !side || k === -side)
            .map(
              (k) =>
                e(hx + k * 24, hy + 18, 6, 7, ivory) +
                l(`M${hx + k * 24 - 3} ${hy + 15}h6m-6 4h6`, cloth, 1.1),
            )
            .join(""),
      );
      if (back)
        put(
          "body",
          local(
            e(-11, 137, 7, 12, ivory) +
              e(11, 137, 7, 12, ivory) +
              l(
                "M-15 130h8m-8 5h8m-8 5h8m-8 5h8M7 130h8m-8 5h8m-8 5h8m-8 5h8",
                cloth,
                1.2,
              ),
          ),
        );
      cuff("armL", left);
      cuff("armR", right);
      for (const [part, x] of [
        ["legL", footL],
        ["legR", footR],
      ] as const)
        put(
          part,
          p(`M${x - 8} 159h15l4 10h-22Z`, panel) +
            l(`M${x - 5} 164h10`, glow, 2),
        );
      break;
    }
    case "pyranda": {
      suit(
        "M-28 128L-16 123H16L28 128L27 147L17 164H-17L-27 147Z",
        "M-20 127L-7 122L18 127L23 147L10 164H-14L-23 147Z",
        "M-27 127L-16 122H16L27 127L25 148L14 165H-14L-25 148Z",
        p("M-18 127L-7 125L-4 151H4L7 125L18 127L15 159H-15Z", ivory) +
          l("M-23 144H23", trim, 2),
      );
      chest(p("M0 7Q-12 -2 -6 -7Q0 -8 0 2Q0 -8 6 -7Q12 -2 0 7Z", cloth));
      put(
        "flame",
        band(25) +
          p(`M${hx - 20} ${hy + 14}l14 -5l3 8l-14 5Z`, ivory) +
          e(hx - 12, hy + 15, 2, 2, glow, "none"),
      );
      cuff("armL", left);
      put(
        "armR",
        e(right, 145, 9, 11, design.palette.mid) +
          p(`M${right - 8} 133h16v18h-16Z`, ivory) +
          hex(right, 141, 5, 6, glow),
      );
      if (back)
        put(
          "body",
          local(
            p("M-17 128Q0 122 17 128V152L9 160H-9L-17 152Z", ivory) +
              p("M-15 138H15V146H-15Z", panel) +
              hex(0, 139, 5, 7, glow) +
              buckle(-10, 151) +
              buckle(10, 151),
          ),
        );
      break;
    }
    case "glacelle": {
      suit(
        "M-24 126Q0 117 24 126L26 144L16 160L0 176L-16 160L-26 144Z",
        "M-17 125Q0 119 17 126L21 143L9 167L0 176L-14 158L-21 142Z",
        "M-24 125Q0 117 24 125L26 143L13 165L0 177L-13 165L-26 143Z",
        p("M-13 128Q0 133 13 128L15 145L0 164L-15 145Z", ivory) +
          l(
            "M-19 138L10 160M-10 130L18 150M19 138L-10 160M10 130L-18 150",
            trim,
            1,
          ),
      );
      chest(diamond(0, -2, 6, glow));
      put(
        "flame",
        [-1, 1]
          .filter((k) => !side || k === -side)
          .map(
            (k) =>
              p(
                `M${hx + k * 25} ${hy + 18}q${k * 11} -13 ${k * 14} -4l${-k * 4} 15l${-k * 10} -2Z`,
                cloth,
              ) + diamond(hx + k * 29, hy + 17, 3, ivory),
          )
          .join(""),
      );
      cape(
        "M76 127Q55 136 70 153L81 143L91 157L100 145L109 157L119 143L130 153Q145 136 124 127Z",
        `M${cx - side * 8} 125Q${cx - side * 37} 138 ${cx - side * 21} 156L${cx - side * 12} 143L${cx + side * 1} 155L${cx + side * 7} 136Z`,
        "M75 124Q59 145 74 159L87 149L100 167L113 149L126 159Q141 145 125 124Z",
        ivory,
      );
      for (const [part, x] of [
        ["armL", side === 1 ? 120 : side === -1 ? 80 : 56],
        ["armR", side === 1 ? 71 : side === -1 ? 129 : 144],
      ] as const)
        put(
          part,
          diamond(x, 133, 6) + l(`M${x - 6} 132l12 3m-11 1l10 -5`, cloth, 1),
        );
      break;
    }
    case "halcyra": {
      suit(
        "M-26 126L-13 121L0 127L13 121L26 126L23 148L11 161H-11L-23 148Z",
        "M-17 125L-6 120L16 126L20 145L8 162H-11L-20 144Z",
        "M-25 124L-12 120H12L25 124L22 146L12 163H-12L-22 146Z",
        p("M-17 128L0 137L17 128L11 152H-11Z", ivory) +
          l("M-19 135L19 151", trim, 1.2),
      );
      chest(l("M-8 -6H5L1 -9M-8 0H8L4 -3M-6 6H4L0 3", cloth, 1.8));
      put(
        "flame",
        band(20) +
          p(
            `M${hx + (side ? -side : 1) * 20} ${hy + 12}l${(side ? -side : 1) * 12} -12l-1 18Z`,
            ivory,
          ),
      );
      for (const [part, x] of [
        ["armL", left],
        ["armR", right],
      ] as const)
        put(
          part,
          p(`M${x - 6} 129L${x + 10} 136L${x + 5} 151L${x - 7} 144Z`, panel) +
            l(`M${x - 2} 136l5 6`, glow, 2),
        );
      if (back)
        put(
          "wings",
          p("M77 123L62 144L85 138L100 153L115 138L138 144L123 123Z", ivory) +
            l("M70 139L84 132M116 132L130 139", cloth, 1.5),
        );
      break;
    }
    case "sunbara": {
      suit(
        "M-30 128Q0 116 30 128L28 146L17 164H-17L-28 146Z",
        "M-21 127Q0 118 19 126L24 145L12 164H-15L-24 146Z",
        "M-29 126Q0 117 29 126L27 148L14 165H-14L-27 148Z",
        p("M-20 128Q0 144 20 128L17 151L0 160L-17 151Z", ivory),
      );
      chest(
        p("M-8 3Q-7 -11 0 -11Q7 -11 8 3Z", cloth) +
          l("M-11 5H11M-6 -12l-2 -3M0 -14v-3M6 -12l2 -3", trim, 1.2),
      );
      put(
        "flame",
        band(24) +
          p(
            `M${hx - 19} ${hy + 15}Q${hx - 3} ${hy - 4} ${hx + 19} ${hy + 8}L${hx + 10} ${hy + 18}Z`,
            ivory,
          ) +
          l(`M${hx - 11} ${hy + 12}l10 -7m-3 10l10 -8`, cloth, 1),
      );
      cape(
        "M71 125Q66 149 77 159L96 151L109 159L128 145L124 124Z",
        `M${cx - side * 11} 124Q${cx - side * 37} 145 ${cx - side * 20} 162L${cx + side * 6} 150L${cx + side * 8} 128Z`,
        "M71 123Q60 145 76 163L98 155L114 165L135 145L127 123Z",
        ivory,
      );
      cuff("armL", left);
      cuff("armR", right);
      if (back)
        put("wings", l("M79 132L88 143L98 132L108 143L120 132", cloth, 1.5));
      break;
    }
    case "astrabun": {
      suit(
        "M-23 125L-11 121L0 127L11 121L23 125L22 145L12 161H-12L-22 145Z",
        "M-16 125L-5 120L15 126L20 145L8 162H-11L-19 144Z",
        "M-22 124L-11 120H11L22 124L20 147L9 163H-9L-20 147Z",
        p("M-15 128L0 137L15 128L10 150H-10Z", ivory),
      );
      chest(
        p("M-8 -7Q10 -10 7 3Q5 11 -3 5L-9 9L-6 1L-13 2Z", glow) +
          l("M-9 -8l-5 -3M-11 -3l-5 -1", trim, 1),
      );
      put("flame", band(18) + diamond(hx, hy + 17, 4, glow));
      cuff("armL", left);
      const x = right + (side || 1) * 8;
      put(
        "armR",
        e(right, 146, 9, 10, design.palette.mid) +
          l(`M${x} 118V163`, panel, 5) +
          p(
            `M${x - 9} 117L${x - 12} 102L${x - 4} 105L${x} 98L${x + 4} 105L${x + 12} 102L${x + 8} 118L${x} 125Z`,
            ivory,
          ) +
          p(`M${x - 5} 116L${x} 106L${x + 5} 116L${x} 121Z`, glow),
      );
      for (const [part, bx] of [
        ["legL", side ? footL : 83],
        ["legR", side ? footR : 117],
      ] as const)
        put(
          part,
          p(`M${bx - 8} 157h15l5 12h-23Z`, panel) +
            p(`M${bx - 7} 164l14 -3l6 7l-20 2Z`, ivory),
        );
      if (back)
        put(
          "body",
          local(
            p("M-13 129H13L18 149L0 158L-18 149Z", ivory) +
              l("M-9 134L-5 147M9 134L5 147", cloth, 2),
          ),
        );
      break;
    }
    case "wombolder": {
      suit(
        "M-33 129L-20 122H20L33 129L29 150L17 164H-17L-29 150Z",
        "M-23 128L-9 121L21 128L27 148L12 165H-16L-27 147Z",
        "M-32 127L-18 121H18L32 127L28 150L15 166H-15L-28 150Z",
        p("M-23 129H23L20 143H-20Z", ivory) + l("M-22 150H22", panel, 4),
      );
      chest(l("M-9 -7L0 -2L9 -7M-7 0L0 5L7 0", cloth, 2.2));
      put(
        "flame",
        p(
          `M${hx - 25} ${hy + 22}Q${hx - 25} ${hy + 1} ${hx} ${hy + 2}Q${hx + 25} ${hy + 1} ${hx + 25} ${hy + 22}Z`,
          ivory,
        ) +
          p(`M${hx - 9} ${hy + 4}H${hx + 9}V${hy + 15}H${hx - 9}Z`, panel) +
          l(`M${hx - 4} ${hy + 7}h8m-8 4h8`, glow, 1),
      );
      for (const [part, x] of [
        ["armL", side ? left : 64],
        ["armR", side ? right : 136],
      ] as const)
        put(
          part,
          hex(x, 146, 13, 15, panel) +
            p(`M${x - 10} 137h20v12h-20Z`, ivory) +
            l(`M${x - 6} 140v6m6 -6v6m6 -6v6`, cloth, 1.5),
        );
      if (back)
        put(
          "body",
          local(
            hex(0, 138, 17, 17, panel) +
              hex(0, 138, 9, 11, ivory) +
              l("M-8 132L8 144M8 132L-8 144", cloth, 1.4),
          ),
        );
      break;
    }
    case "shadopus": {
      suit(
        "M-24 125Q0 116 24 125L26 139L18 153L7 150L0 159L-7 150L-18 153L-26 139Z",
        "M-16 124Q0 118 15 125L19 139L7 156L-6 150L-16 154L-20 139Z",
        "M-24 124Q0 115 24 124L25 139L15 156L0 151L-15 156L-25 139Z",
        p("M-14 126Q0 134 14 126L12 143L0 152L-12 143Z", ivory),
      );
      chest(p("M-7 4Q-12 -6 -5 -8Q0 -7 0 3Q0 -7 5 -8Q12 -6 7 4L0 9Z", glow));
      put(
        "flame",
        p(
          `M${hx - 25} ${hy + 18}Q${hx - 19} ${hy - 1} ${hx} ${hy + 5}Q${hx + 19} ${hy - 1} ${hx + 25} ${hy + 18}L${hx + 13} ${hy + 21}L${hx} ${hy + 12}L${hx - 13} ${hy + 21}Z`,
          ivory,
        ) + diamond(hx, hy + 12, 5, glow),
      );
      for (const [part, x] of [
        ["armL", side === 1 ? 133 : side === -1 ? 67 : 59],
        ["armR", side === 1 ? 67 : side === -1 ? 133 : 141],
      ] as const)
        put(part, e(x, 145, 7, 5, panel) + e(x, 144, 3, 3, glow, trim, 0.8));
      if (back)
        put(
          "body",
          local(
            p("M-15 127Q0 119 15 127L18 143L0 157L-18 143Z", ivory) +
              [-9, 0, 9].map((x) => e(x, 138, 3, 5, glow)).join(""),
          ),
        );
      break;
    }
    case "pangrove": {
      suit(
        "M-29 128L-17 122H17L29 128L27 146L17 164L0 169L-17 164L-27 146Z",
        "M-21 127L-8 121L19 127L25 146L12 165L0 168L-18 157L-25 143Z",
        "M-29 125L-17 120H17L29 125L27 147L15 166L0 172L-15 166L-27 147Z",
        p("M-20 127L0 140L20 127L17 145L0 160L-17 145Z", ivory),
      );
      chest(
        p("M0 9Q-15 -1 -6 -9Q4 -8 0 9Q15 -1 6 -9Q-4 -8 0 9Z", cloth) +
          l("M0 -7V8", trim, 1),
      );
      put(
        "flame",
        [-1, 0, 1]
          .map((k) =>
            p(
              `M${hx + k * 14} ${hy + 20}q${k * 7 - 4} -14 ${k * 7 + 4} -18q9 10 -4 18Z`,
              panel,
            ),
          )
          .join(""),
      );
      for (const [part, x] of [
        ["armL", side ? left : 66],
        ["armR", side ? right : 134],
      ] as const)
        put(
          part,
          p(
            `M${x} 129Q${x - 16} 138 ${x - 10} 153L${x} 160L${x + 10} 153Q${x + 16} 138 ${x} 129Z`,
            ivory,
          ) +
            p(`M${x} 135L${x + 6} 146L${x} 155L${x - 6} 146Z`, cloth) +
            l(`M${x} 137v15`, trim, 1),
        );
      if (back)
        put(
          "wings",
          p(
            "M72 122L100 114L128 122L132 142L116 162L100 171L84 162L68 142Z",
            panel,
          ) +
            [-1, 0, 1]
              .map((k) => p(`M${100 + k * 15} 126l-10 12l10 14l10 -14Z`, ivory))
              .join("") +
            p("M100 146L89 157L100 169L111 157Z", cloth),
        );
      break;
    }
    case "mossloth": {
      suit(
        "M-28 128Q0 117 28 128L26 148L15 165H-15L-26 148Z",
        "M-20 127Q0 118 18 126L23 145L10 165H-14L-24 146Z",
        "M-27 126Q0 117 27 126L26 148L13 166H-13L-26 148Z",
        p("M-18 128Q0 140 18 128L16 150L0 158L-16 150Z", ivory),
      );
      chest(
        p("M-9 -3Q-10 -9 -4 -8Q0 -14 5 -8Q12 -9 10 -2L5 5H-5Z", cloth) +
          l("M-5 1H6", trim, 1),
      );
      cape(
        "M70 125Q60 136 72 144Q66 155 81 158Q89 168 100 159Q111 168 119 158Q134 155 128 144Q140 136 130 125Z",
        `M${cx - side * 9} 122Q${cx - side * 35} 126 ${cx - side * 29} 141Q${cx - side * 39} 156 ${cx - side * 19} 164Q${cx - side * 6} 171 ${cx + side * 7} 152Z`,
        "M71 123Q57 135 68 147Q61 160 78 163Q89 174 100 164Q111 174 122 163Q139 160 132 147Q143 135 129 123Z",
        ivory,
      );
      put(
        "flame",
        p(
          `M${hx - 23} ${hy + 20}Q${hx - 17} ${hy + 4} ${hx + 7} ${hy + 9}L${hx + 23} ${hy + 18}L${hx + 12} ${hy + 24}Q${hx - 3} ${hy + 16} ${hx - 23} ${hy + 20}Z`,
          cloth,
        ) + buckle(hx + 12, hy + 19),
      );
      for (const [part, x] of [
        ["armL", left],
        ["armR", right],
      ] as const)
        put(
          part,
          e(x, 148, 10, 12, ivory) + p(`M${x - 8} 140h16v5h-16Z`, cloth),
        );
      if (back)
        put(
          "wings",
          l("M77 139Q100 152 123 139M83 151Q100 160 117 151", cloth, 1.3),
        );
      break;
    }
  }
  return out;
}

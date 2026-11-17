import { CARNIVAL_TEXTILES } from "./epic-materials";
import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { Palette } from "./skin-art";

export type NewEpicCollection = "abyssal-expedition" | "dream-carnival";
// Completely new construction, independent of the Rare coat/obi patterns.
// Each entry: rigid suit front, stagewear front, shoulder span, visor style,
// personal carnival headpiece. Side/rear are drawn in their own construction.
const DESIGNS = {
  voltkit: [
    "M-26 128L-16 122H16L26 128L22 155L10 163H-10L-22 155Z",
    "M-24 128L-10 122L0 130L10 122L24 128L20 150L28 164L10 158L0 169L-10 158L-28 164L-20 150Z",
    26,
    "round",
    "bells",
  ],
  cindrake: [
    "M-29 130L-17 122L-8 127H8L17 122L29 130L25 145L17 162H-17L-25 145Z",
    "M-25 129L-16 124L-4 130L8 123L26 130L20 148L30 159L17 157L10 170L0 160L-10 168L-20 158L-28 161L-20 144Z",
    29,
    "vent",
    "flame-fan",
  ],
  tidefin: [
    "M-26 128L-12 123H12L26 128L29 144L18 160L0 165L-18 160L-29 144Z",
    "M-23 128Q0 118 23 128L20 141Q34 151 26 164L13 158L0 172L-13 158L-26 164Q-34 151 -20 141Z",
    26,
    "fin",
    "fan",
  ],
  auralynx: [
    "M-23 126L-11 120L0 126L11 120L23 126L21 148L10 161L0 167L-10 161L-21 148Z",
    "M-21 126L-9 122L0 129L9 122L21 126L16 144L22 154L9 151L0 166L-9 151L-22 154L-16 144Z",
    23,
    "crystal",
    "crescent",
  ],
  lumoth: [
    "M-22 125L-10 120H10L22 125L18 143L8 155H-8L-18 143Z",
    "M-21 127Q0 119 21 127L16 139Q31 142 28 154Q17 160 9 150Q0 167 -9 150Q-17 160 -28 154Q-31 142 -16 139Z",
    22,
    "wing",
    "ribbons",
  ],
  mystowl: [
    "M-27 128L-13 122H13L27 128L29 145L18 163H-18L-29 145Z",
    "M-27 126L-14 121L0 130L14 121L27 126L23 145L29 166L13 159L6 170L0 162L-6 170L-13 159L-29 166L-23 145Z",
    27,
    "owl",
    "ringmaster",
  ],
  terradon: [
    "M-33 130L-23 123H23L33 130L29 149L17 160H-17L-29 149Z",
    "M-31 129Q0 117 31 129L28 144L34 158L22 164L11 157L0 163L-11 157L-22 164L-34 158L-28 144Z",
    33,
    "turtle",
    "carousel",
  ],
  duskveil: [
    "M-25 127L-13 122H13L25 127L24 144L18 157L7 151L0 166L-7 151L-18 157L-24 144Z",
    "M-26 126L-13 121L0 129L13 121L26 126L22 145L29 159L15 153L7 168L-1 157L-12 168L-19 153L-28 161Z",
    25,
    "bell",
    "puppet",
  ],
  coilemur: [
    "M-24 126L-14 121H14L24 126L25 148L15 162H-15L-25 148Z",
    "M-23 127L-12 121L0 128L12 121L23 127L19 147L25 160L12 157L4 166L-7 157L-22 165L-20 144Z",
    24,
    "coil",
    "hoops",
  ],
  pyranda: [
    "M-28 129L-17 122H17L28 129L29 147L18 164H-18L-29 147Z",
    "M-27 127Q-10 119 0 128Q16 119 27 129L22 146L28 160L13 159L5 170L-9 157L-23 164L-28 154Z",
    28,
    "rescue",
    "scarlet-fan",
  ],
  glacelle: [
    "M-25 126L-12 120H12L25 126L23 141L29 152L18 164H-18L-29 152L-23 141Z",
    "M-23 126Q0 118 23 126L19 140Q31 146 31 157Q23 168 13 160Q0 178 -13 160Q-23 168 -31 157Q-31 146 -19 140Z",
    25,
    "dome",
    "tassels",
  ],
  halcyra: [
    "M-24 128L-13 122H13L24 128L21 145L11 162L0 166L-11 162L-21 145Z",
    "M-24 126L-12 122L0 130L12 122L24 126L18 143L25 153L12 151L0 171L-12 151L-25 153L-18 143Z",
    24,
    "pilot",
    "opera",
  ],
  sunbara: [
    "M-30 128Q0 118 30 128L31 147L21 163H-21L-31 147Z",
    "M-29 128Q0 115 29 128L27 142L31 155Q20 171 0 164Q-20 171 -31 155L-27 142Z",
    30,
    "buoy",
    "sugar",
  ],
  astrabun: [
    "M-23 127L-12 121H12L23 127L20 148L10 160H-10L-20 148Z",
    "M-22 127L-10 121L0 128L10 121L22 127L17 143L23 156L10 154L0 167L-10 154L-23 156L-17 143Z",
    23,
    "rabbit",
    "rabbit-bells",
  ],
  wombolder: [
    "M-34 129L-22 121H22L34 129L31 149L20 164H-20L-31 149Z",
    "M-32 128L-19 122H19L32 128L30 146L34 158L21 166L7 161L0 168L-7 161L-21 166L-34 158L-30 146Z",
    34,
    "miner",
    "shako",
  ],
  shadopus: [
    "M-26 126L-12 120H12L26 126L29 141L20 153L9 150L0 162L-9 150L-20 153L-29 141Z",
    "M-25 126Q0 116 25 126L28 141L21 153L14 146L7 159L0 150L-7 159L-14 146L-21 153L-28 141Z",
    26,
    "nautilus",
    "eight-bells",
  ],
  pangrove: [
    "M-32 130L-18 121H18L32 130L28 146L19 161L0 168L-19 161L-28 146Z",
    "M-30 127L-16 120L0 127L16 120L30 127L24 143L30 155L16 153L8 168L0 157L-8 168L-16 153L-30 155L-24 143Z",
    32,
    "scales",
    "leaves",
  ],
  mossloth: [
    "M-31 129Q0 116 31 129L29 146L20 162L5 157L-5 166L-22 158L-31 145Z",
    "M-30 128Q-9 117 0 128Q12 118 30 129L27 147L31 157L17 163L5 156L-4 170L-14 157L-28 164L-32 150Z",
    31,
    "garden",
    "sleepy",
  ],
} as const satisfies Record<
  CharacterId,
  readonly [string, string, number, string, string]
>;

export function epicBodyCut(
  id: CharacterId,
  dir: Facing,
  theme: NewEpicCollection,
) {
  const [deep, stage, w] = DESIGNS[id];
  if (dir === "down") return theme === "abyssal-expedition" ? deep : stage;
  const n = Object.keys(DESIGNS).indexOf(id),
    waist = 14 + (n % 6),
    hem = 155 + (n % 8);
  if (dir === "up")
    return theme === "abyssal-expedition"
      ? `M${-w} 128L${-w + 10} 120H${w - 10}L${w} 128L${w - 3} ${hem - 9}L${waist} ${hem}H${-waist}L${-w + 3} ${hem - 9}Z`
      : `M${-w - 1} 126Q0 116 ${w + 1} 126L${w - 2} ${hem - 13}L${w + 2} ${hem}L12 ${hem - 4}L0 ${hem + 9}L-12 ${hem - 4}L${-w - 2} ${hem}L${-w + 2} ${hem - 13}Z`;
  // Native profile: back projects behind the shoulder, front closes at the chest.
  return theme === "abyssal-expedition"
    ? `M${-w * 0.65} 126L-8 121L${waist} 126L${waist + 5} 139L${waist} ${hem - 4}L-4 ${hem}L${-w * 0.65 - 3} ${hem - 12}Z`
    : `M${-w * 0.7} 125Q0 118 ${waist + 1} 128L${waist - 2} 143L${waist + 6} ${hem - 1}L5 ${hem - 5}L-6 ${hem + 7}L${-w * 0.7 - 5} ${hem - 1}L${-w * 0.7} 142Z`;
}

/** New Epic equipment occupies distinct body/head/limb joints; no Rare
 * costume paths or accessories are reused here. All effects stay budgeted. */
export function epicFashion(
  id: CharacterId,
  dir: Facing,
  theme: NewEpicCollection,
  p: Palette,
  head: { cx: number; top: number },
): [CreaturePart, string][] {
  const deep = theme === "abyssal-expedition",
    back = dir === "up",
    side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const [, , width, role, hat] = DESIGNS[id],
    n = Object.keys(DESIGNS).indexOf(id);
  const cx = 100 + side * 6,
    hx = head.cx,
    hy = Math.max(15, head.top),
    ink = p.dark;
  const metal = deep ? "#91b7bf" : "#f0c86a",
    cloth = deep ? "#294553" : CARNIVAL_TEXTILES[id][0],
    cream = deep ? "#c4e4df" : "#fff1d6";
  const accent = deep ? "#bd9c72" : CARNIVAL_TEXTILES[id][0];
  const path = (d: string, fill = cloth, stroke = ink, sw = 1.1) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const line = (d: string, color = metal, sw = 1.2) =>
    path(d, "none", color, sw);
  const circle = (
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke = ink,
  ) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`;
  const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill: string,
    stroke = ink,
  ) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="1"/>`;
  const star = (x: number, y: number, r = 3) =>
    path(
      `M${x} ${y - r}L${x + 1} ${y - 1}L${x + r} ${y}L${x + 1} ${y + 1}L${x} ${y + r}L${x - 1} ${y + 1}L${x - r} ${y}L${x - 1} ${y - 1}Z`,
      cream,
      metal,
      0.6,
    );
  const diamond = (x: number, y: number, r = 3) =>
    path(
      `M${x} ${y - r}L${x + r * 0.65} ${y}L${x} ${y + r}L${x - r * 0.65} ${y}Z`,
      p.glow,
      metal,
      0.7,
    );
  const gauge = (x: number, y: number, r = 5) =>
    circle(x, y, r, cream, metal) +
    circle(x, y, r * 0.67, ink, "none") +
    line(`M${x} ${y}l${r * 0.4} ${-r * 0.35}`, p.glow, 1) +
    circle(x, y, 1, accent, "none");
  const out: [CreaturePart, string][] = [];
  const put = (part: CreaturePart, svg: string) =>
    out.push([
      part,
      `<g class="epic-fashion fashion-signature" data-champion="${id}" data-view="${dir}" data-epic="${theme}" data-role="${role}">${svg}</g>`,
    ]);
  const cut = epicBodyCut(id, dir, theme),
    clip = `epic-cut-${theme}-${id}-${dir}`;
  let torso = path(cut, cloth);
  if (deep) {
    torso += path(
      back
        ? `M-15 126H15L18 153L8 159H-8L-18 153Z`
        : `M-14 129Q0 124 14 129L12 150L0 158L-12 150Z`,
      back ? "#597f8b" : "#50747f",
    );
    torso += line(
      back
        ? "M0 128V155M-10 133V149M10 133V149"
        : "M-11 133H11M-11 139H11M-8 150H8",
      metal,
      1,
    );
    torso += back ? gauge(0, 140, 6) : gauge(side ? 3 : 0, 141, 5);
    if (back) {
      const tank =
        role === "turtle" || role === "scales"
          ? 14
          : role === "garden"
            ? 11
            : 7;
      torso +=
        ellipse(-tank - 3, 139, 7, 16, "#415f70") +
        ellipse(tank + 3, 139, 7, 16, "#415f70") +
        line(`M${-tank - 9} 136h12M${tank - 3} 136h12`, accent, 3);
      if (role === "turtle" || role === "scales")
        torso +=
          path("M-21 128L0 121L21 128V149L0 161L-21 149Z", "#599b9b") +
          path(
            "M-14 133L0 127L14 133V145L0 153L-14 145Z",
            "#8ad0b955",
            metal,
            0.8,
          ) +
          gauge(0, 141, 6);
      if (role === "garden")
        torso +=
          path(
            "M-19 132Q-26 124 -22 119Q-16 124 -16 134M15 134Q24 121 20 117Q12 124 15 134Z",
            p.glow,
          ) + circle(-14, 126, 3, accent);
    } else if (side) {
      const tx = -side * 15;
      torso +=
        ellipse(tx, 139, 7, 14, "#4f7582") +
        line(`M${tx - 6} 137h12`, accent, 3);
    }
  } else {
    const opposite = CARNIVAL_TEXTILES[id][1];
    torso += path(
      back
        ? "M-12 126Q0 138 12 126L7 154L0 164L-7 154Z"
        : "M-13 127L0 142L13 127L8 157L0 164L-8 157Z",
      opposite,
    );
    torso += back
      ? line("M-16 128L16 153M16 128L-16 153", cream, 1.2)
      : diamond(0, 141, 5) +
        [-1, 1].map((s) => diamond(s * 15, 147, 4)).join("");
    torso += line(
      `M${-width + 4} 133L${-width + 3} 150M${width - 4} 133L${width - 3} 150`,
      metal,
      1,
    );
    if (role === "miner")
      torso +=
        ellipse(0, 148, 21, 12, cream) +
        path("M-21 146L-20 156Q0 168 20 156L21 146Q0 154 -21 146Z", accent) +
        line("M-14 151L-8 160L0 153L8 160L14 151", metal, 1.3);
    if (role === "turtle" && back)
      torso +=
        path("M-25 132Q0 113 25 132L19 143H-19Z", cream) +
        [-18, -6, 6, 18]
          .map((x) => path(`M${x - 5} 133v9h10v-9Z`, accent))
          .join("") +
        line("M-20 146H20", metal, 2);
  }
  put(
    "body",
    `<defs><clipPath id="${clip}"><path d="${cut}" transform="translate(${cx} 0)"/></clipPath></defs><g clip-path="url(#${clip})"><g transform="translate(${cx} 0)">${torso}</g></g>`,
  );

  // A pressure collar / stage ruff, not the Rare lapel-and-brooch arrangement.
  if (deep) {
    let collar = path(
      `M${cx - width - 2} 126Q${cx} 115 ${cx + width + 2} 126L${cx + width - 1} 136Q${cx} 126 ${cx - width + 1} 136Z`,
      "#4b6d7d",
    );
    collar += line(
      `M${cx - width + 2} 127Q${cx} 120 ${cx + width - 2} 127`,
      accent,
      3,
    );
    collar += gauge(cx + (side ? -side * 14 : width - 5), 130, 4);
    if (role === "buoy" || role === "rescue")
      collar +=
        ellipse(cx, 131, side ? 20 : 29, 9, accent) +
        ellipse(cx, 129, side ? 13 : 21, 4, "#294659");
    else
      collar += line(
        `M${cx - width + 5} 131Q${cx - width - 4} 146 ${cx - width + 9} 151`,
        p.glow,
        2,
      );
    put("body", collar);
  } else {
    const petals =
      role === "nautilus" ? 8 : role === "wing" ? 6 : role === "owl" ? 7 : 5;
    let ruff = "";
    for (let i = 0; i < petals; i++) {
      const x = cx - width + ((i + 0.5) * width * 2) / petals;
      ruff +=
        path(
          `M${x - 6} 123Q${x} 119 ${x + 6} 123L${x + 8} 134L${x} ${139 + (i % 2) * 3}L${x - 8} 134Z`,
          i % 2 ? cream : accent,
        ) + circle(x, 134, 1.5, metal, "none");
    }
    put("body", ruff + diamond(cx, 131, 4));
  }

  // Glass helmets and masks have separate front/profile/rear drawings.
  const cy = id === "shadopus" ? 84 : id === "terradon" ? 94 : 91;
  const rx =
    role === "turtle"
      ? 35
      : role === "owl"
        ? 44
        : role === "nautilus"
          ? 45
          : role === "garden"
            ? 42
            : 43;
  if (deep) {
    const rim = side ? 31 : rx;
    let glass: string;
    if (back) {
      glass =
        ellipse(hx, cy, rim, 33, "#294e64") +
        path(
          `M${hx - rim + 6} ${cy - 6}Q${hx} ${cy - 23} ${hx + rim - 6} ${cy - 6}V${cy + 15}Q${hx} ${cy + 29} ${hx - rim + 6} ${cy + 15}Z`,
          "#426d7c",
        ) +
        line(
          `M${hx - 15} ${cy - 9}h30M${hx - 15} ${cy - 2}h30M${hx - 15} ${cy + 5}h30`,
          metal,
          2,
        ) +
        gauge(hx, cy + 17, 5);
    } else if (side) {
      glass =
        path(
          `M${hx - side * 23} ${cy - 30}Q${hx + side * 32} ${cy - 34} ${hx + side * 35} ${cy - 4}Q${hx + side * 37} ${cy + 23} ${hx - side * 17} ${cy + 31}Q${hx - side * 35} ${cy + 15} ${hx - side * 35} ${cy - 5}Q${hx - side * 34} ${cy - 22} ${hx - side * 23} ${cy - 30}Z`,
          "#76dadb10",
          metal,
          2.2,
        ) +
        line(
          `M${hx - side * 22} ${cy - 25}Q${hx - side * 31} ${cy - 10} ${hx - side * 28} ${cy + 1}`,
          "#e0fff3",
          2,
        ) +
        path(
          `M${hx - side * 31} ${cy + 7}l${side * 8} 4v10l${-side * 8} -4Z`,
          "#294b61",
        ) +
        gauge(hx - side * 28, cy + 14, 4);
    } else {
      glass =
        ellipse(hx, cy, rx, 33, "#76dadb0b", metal) +
        `<ellipse cx="${hx}" cy="${cy}" rx="${rx + 2}" ry="35" fill="none" stroke="${accent}" stroke-width="1.8" stroke-dasharray="${role === "crystal" ? "9 6" : "16 9"}"/>` +
        line(
          `M${hx - rx + 9} ${cy - 13}Q${hx - rx + 10} ${cy - 25} ${hx - 14} ${cy - 26}`,
          "#ddfff4",
          2,
        ) +
        [-1, 1]
          .map(
            (s) =>
              path(
                `M${hx + s * (rx - 1) - 5} ${cy + 11}h10v11h-10Z`,
                "#294b61",
              ) + circle(hx + s * (rx - 1), cy + 16, 2, p.glow, "none"),
          )
          .join("");
    }
    put("head", glass);
    // Different instruments follow each species' head / antenna silhouette.
    let gear =
      path(
        `M${hx - 15} ${hy + 3}Q${hx} ${hy - 5} ${hx + 15} ${hy + 3}L${hx + 12} ${hy + 10}H${hx - 12}Z`,
        "#32586a",
      ) + gauge(hx, hy + 4, 4);
    if (["round", "coil", "rabbit"].includes(role))
      gear += [-1, 1]
        .filter((s) => !side || s === -side)
        .map(
          (s) =>
            circle(hx + s * 27, hy + 8, 7, "#294b61", metal) +
            circle(hx + s * 27, hy + 8, 3, p.glow, "none"),
        )
        .join("");
    else if (role === "vent")
      gear += [-1, 1]
        .filter((s) => !side || s === -side)
        .map(
          (s) =>
            path(
              `M${hx + s * 22} ${hy + 8}l${s * 10} -9l${s * 3} 13l${-s * 10} 7Z`,
              "#456e7b",
            ) + line(`M${hx + s * 27} ${hy + 7}l${s * 4} -3`, accent, 2),
        )
        .join("");
    else if (role === "dome" || role === "nautilus")
      gear +=
        path(
          `M${hx - 24} ${hy + 8}Q${hx - 23} ${hy - 12} ${hx} ${hy - 14}Q${hx + 23} ${hy - 12} ${hx + 24} ${hy + 8}Z`,
          "#b4ebe327",
          metal,
          1.8,
        ) +
        line(
          `M${hx - 14} ${hy - 3}Q${hx} ${hy - 11} ${hx + 14} ${hy - 3}`,
          "#e3fff5",
          1.4,
        );
    else if (role === "miner")
      gear +=
        path(
          `M${hx - 27} ${hy + 8}Q${hx - 23} ${hy - 9} ${hx} ${hy - 10}Q${hx + 23} ${hy - 9} ${hx + 27} ${hy + 8}Z`,
          accent,
        ) +
        circle(hx, hy + 2, 6, metal) +
        circle(hx, hy + 2, 3, p.glow);
    else if (role === "wing" || role === "owl" || role === "pilot")
      gear +=
        line(`M${hx + (side ? -side : 1) * 19} ${hy + 6}v-13l7 -4`, metal, 2) +
        circle(hx + (side ? -side : 1) * 19 + 7, hy - 11, 2.5, p.glow);
    else if (role === "bell")
      gear =
        path(
          `M${hx - 10} 20Q${hx + 17} 32 ${hx + 26} 53L${hx + 17} 60L${hx + 4} 42Z`,
          "#35596c",
        ) + gauge(hx + 12, 42, 5);
    else if (role === "crystal" || role === "scales")
      gear += diamond(hx - 20, hy + 7, 5) + diamond(hx + 20, hy + 7, 5);
    else
      gear +=
        line(`M${hx - 22} ${hy + 7}H${hx + 22}`, accent, 3) +
        circle(hx - 20, hy + 7, 3, p.glow) +
        circle(hx + 20, hy + 7, 3, p.glow);
    if (role === "vent")
      gear =
        path(
          `M${hx - 17} ${hy + 7}L${hx - 20} ${hy - 16}L${hx - 8} ${hy - 7}L${hx} ${hy - 33}L${hx + 9} ${hy - 7}L${hx + 20} ${hy - 18}L${hx + 17} ${hy + 7}Z`,
          "#476a77",
        ) +
        line(
          `M${hx} ${hy - 24}V${hy}M${hx - 12} ${hy - 8}l3 10M${hx + 12} ${hy - 8}l-3 10`,
          p.glow,
          2,
        ) +
        gear;
    put("flame", gear);
  } else {
    if (!back) {
      const wing = 8 + (n % 5) * 2;
      const mask = side
        ? path(
            `M${hx - side * 35} ${cy - 16}Q${hx - side * 5} ${cy - 26} ${hx + side * 27} ${cy - 11}L${hx + side * (31 + wing * 0.3)} ${cy - 20}L${hx + side * 24} ${cy + 10}Q${hx} ${cy + 17} ${hx - side * 30} ${cy + 7}Z`,
            accent,
            metal,
            1,
          )
        : path(
            `M${hx - 47} ${cy - 21}L${hx - 29} ${cy - 12}Q${hx - 12} ${cy - 22} ${hx} ${cy - 10}Q${hx + 12} ${cy - 22} ${hx + 29} ${cy - 12}L${hx + 47} ${cy - 21}L${hx + 39} ${cy + 6}Q${hx + 19} ${cy + 17} ${hx} ${cy + 5}Q${hx - 19} ${cy + 17} ${hx - 39} ${cy + 6}Z`,
            accent,
            metal,
            1,
          );
      put(
        "head",
        mask +
          diamond(hx, cy - 10, 4) +
          [-1, 1]
            .filter((s) => !side || s === -side)
            .map((s) => star(hx + s * (side ? 20 : 36), cy - 4, 3))
            .join(""),
      );
    } else
      put(
        "head",
        path(
          `M${hx - 23} ${cy - 7}Q${hx} ${cy - 18} ${hx + 23} ${cy - 7}L${hx + 17} ${cy + 4}Q${hx} ${cy + 13} ${hx - 17} ${cy + 4}Z`,
          accent,
        ) +
          line(
            `M${hx - 18} ${cy - 5}Q${hx} ${cy + 4} ${hx + 18} ${cy - 5}`,
            metal,
            0.9,
          ),
      );
    const t = hy + 4,
      s = side ? -side : 1;
    let crown = "";
    const bell = (x: number, y: number) =>
      circle(x, y, 3.1, metal) + line(`M${x - 1} ${y + 1}h2`, ink, 0.7);
    const plume = (x: number, y: number, k = 1) =>
      path(
        `M${x} ${y}Q${x - 18 * k} ${y - 14} ${x - 8 * k} ${y - 25}Q${x + 4 * k} ${y - 17} ${x} ${y}Z`,
        accent,
      ) + line(`M${x} ${y}l${-7 * k} -18`, cream, 0.8);
    switch (hat) {
      case "bells":
        crown =
          path(
            `M${hx - 24} ${t + 6}Q${hx - 29} ${t - 14} ${hx - 12} ${t - 21}L${hx - 4} ${t + 1}Q${hx + 16} ${t - 17} ${hx + 27} ${t - 9}L${hx + 15} ${t + 8}Z`,
            accent,
          ) +
          bell(hx - 12, t - 21) +
          bell(hx + 27, t - 9);
        break;
      case "flame-fan":
        crown =
          path(
            `M${hx - 18} ${t + 8}Q${hx - 27} ${t - 8} ${hx - 18} ${t - 23}L${hx - 9} ${t - 12}Q${hx - 7} ${t - 32} ${hx + 3} ${t - 39}Q${hx + 7} ${t - 22} ${hx + 11} ${t - 17}L${hx + 22} ${t - 26}Q${hx + 28} ${t - 6} ${hx + 17} ${t + 8}Z`,
            accent,
          ) +
          path(
            `M${hx - 9} ${t + 6}Q${hx - 12} ${t - 6} ${hx - 3} ${t - 13}L${hx + 2} ${t - 4}L${hx + 9} ${t - 11}Q${hx + 13} ${t + 1} ${hx + 6} ${t + 7}Z`,
            cream,
            metal,
            0.7,
          );
        break;
      case "fan":
      case "scarlet-fan":
        crown =
          path(
            `M${hx + s * 12} ${t + 10}Q${hx + s * 20} ${t - 17} ${hx + s * 35} ${t - 9}L${hx + s * 34} ${t + 4}Z`,
            accent,
          ) +
          line(
            `M${hx + s * 13} ${t + 8}l${s * 15} -13M${hx + s * 13} ${t + 8}l${s * 20} -6`,
            cream,
            0.8,
          );
        break;
      case "crescent":
        crown =
          path(
            `M${hx - 22} ${t + 8}Q${hx} ${t - 15} ${hx + 22} ${t + 8}Q${hx} ${t} ${hx - 22} ${t + 8}Z`,
            metal,
          ) +
          diamond(hx, t - 1, 7) +
          [-1, 1]
            .map((k) =>
              path(`M${hx + k * 24} ${t}l${k * 6} -13l${k * 2} 18Z`, accent),
            )
            .join("");
        break;
      case "ribbons":
        crown = [-1, 1]
          .map(
            (k) =>
              path(
                `M${hx + k * 19} ${t + 5}q${k * 15} -13 ${k * 17} -3q${-k * 3} 11 ${-k * 17} 6l${k * 8} 15l${-k * 8} -3Z`,
                accent,
              ) + bell(hx + k * 19, t + 6),
          )
          .join("");
        break;
      case "ringmaster":
        crown =
          path(
            `M${hx - 19} ${t + 6}L${hx - 23} ${t - 13}Q${hx} ${t - 22} ${hx + 23} ${t - 13}L${hx + 19} ${t + 6}Q${hx} ${t + 14} ${hx - 19} ${t + 6}Z`,
            accent,
          ) +
          line(
            `M${hx - 18} ${t + 2}Q${hx} ${t + 9} ${hx + 18} ${t + 2}`,
            cream,
            3,
          ) +
          plume(hx + 12, t - 2, 0.6);
        break;
      case "carousel":
        crown =
          path(
            `M${hx - 28} ${t + 7}L${hx} ${t - 15}L${hx + 28} ${t + 7}Q${hx} ${t + 13} ${hx - 28} ${t + 7}Z`,
            cream,
          ) +
          [-1, 0, 1]
            .map(
              (k) =>
                path(`M${hx + k * 12 - 5} ${t + 5}v7h10v-7Z`, accent) +
                bell(hx + k * 12, t + 13),
            )
            .join("");
        break;
      case "puppet":
        crown =
          path(
            `M${hx - 7} 14Q${hx + 24} 13 ${hx + 20} 35L${hx + 7} 30L${hx + 1} 42L${hx - 11} 27Z`,
            accent,
          ) +
          bell(hx + 19, 35) +
          star(hx + 3, 25, 5);
        break;
      case "hoops":
        crown =
          [-1, 1]
            .map(
              (k) =>
                ellipse(hx + k * 18, t - 3, 9, 13, "none", metal) +
                path(`M${hx + k * 18 - 7} ${t + 5}h14v7h-14Z`, accent),
            )
            .join("") + diamond(hx, t + 6, 4);
        break;
      case "tassels":
        crown =
          path(
            `M${hx - 28} ${t + 6}Q${hx} ${t - 18} ${hx + 28} ${t + 6}L${hx + 21} ${t + 12}Q${hx} ${t + 2} ${hx - 21} ${t + 12}Z`,
            cream,
          ) +
          [-1, 1]
            .map(
              (k) =>
                line(`M${hx + k * 24} ${t + 10}v12`, metal, 1) +
                bell(hx + k * 24, t + 24),
            )
            .join("");
        break;
      case "opera":
        crown =
          plume(hx + s * 17, t + 5, s * 0.8) +
          plume(hx + s * 22, t + 8, s * 0.6) +
          path(`M${hx + s * 13} ${t + 3}l${s * 16} 5l${-s * 7} 7Z`, metal);
        break;
      case "sugar":
        crown =
          path(
            `M${hx - 25} ${t + 7}L${hx - 22} ${t - 4}L${hx - 10} ${t + 1}L${hx} ${t - 14}L${hx + 10} ${t + 1}L${hx + 22} ${t - 4}L${hx + 25} ${t + 7}Z`,
            accent,
          ) + [-1, 0, 1].map((k) => star(hx + k * 15, t + 4, 3)).join("");
        break;
      case "rabbit-bells":
        crown =
          [-1, 1]
            .map(
              (k) =>
                path(`M${hx + k * 24 - 5} ${t + 3}l-2 -18l9 3l3 18Z`, accent) +
                bell(hx + k * 24, t + 9),
            )
            .join("") + diamond(hx, t + 5, 4);
        break;
      case "shako":
        crown =
          path(
            `M${hx - 25} ${t + 8}L${hx - 23} ${t - 13}Q${hx} ${t - 19} ${hx + 23} ${t - 13}L${hx + 25} ${t + 8}Z`,
            accent,
          ) +
          line(
            `M${hx - 19} ${t + 3}Q${hx} ${t + 9} ${hx + 19} ${t + 3}`,
            cream,
            3,
          ) +
          plume(hx, t - 7, 0.5);
        break;
      case "eight-bells":
        crown = [-1, 0, 1]
          .map(
            (k) =>
              path(
                `M${hx + k * 15 - 7} ${t + 8}Q${hx + k * 15 - 4} ${t - 12} ${hx + k * 15 + 9} ${t - 6}L${hx + k * 15 + 4} ${t + 10}Z`,
                k === 0 ? cream : accent,
              ) + bell(hx + k * 15 + 9, t - 6),
          )
          .join("");
        break;
      case "leaves":
        crown =
          [-1, 1]
            .map(
              (k) =>
                path(
                  `M${hx + k * 12} ${t + 8}Q${hx + k * 13} ${t - 13} ${hx + k * 32} ${t - 11}Q${hx + k * 30} ${t + 8} ${hx + k * 12} ${t + 8}Z`,
                  accent,
                ) + line(`M${hx + k * 16} ${t + 5}l${k * 12} -10`, cream, 0.8),
            )
            .join("") + diamond(hx, t + 7, 4);
        break;
      case "sleepy":
        crown =
          path(
            `M${hx - 24} ${t + 8}Q${hx - 16} ${t - 13} ${hx + 6} ${t - 9}Q${hx + 29} ${t - 9} ${hx + 24} ${t + 4}L${hx + 12} ${t - 1}L${hx + 9} ${t + 9}Z`,
            accent,
          ) +
          bell(hx + 24, t + 4) +
          star(hx - 9, t + 2, 4);
        break;
    }
    put(
      "flame",
      crown +
        line(
          `M${hx - 17} ${t + 8}Q${hx} ${t + 12} ${hx + 17} ${t + 8}`,
          metal,
          1.5,
        ),
    );
  }

  // Separately animated mounts persist through turns on the same weapon/wrists/wings.
  if (id === "tidefin") {
    const x = dir === "down" ? 136 : back ? 124 : side < 0 ? 111 : 89;
    put(
      "armR",
      path(
        `M${x - 9} 145Q${x} 138 ${x + 10} 145L${x + 8} 155H${x - 8}Z`,
        deep ? "#476b7b" : accent,
      ) + (deep ? gauge(x, 148, 3.5) : diamond(x, 148, 4)),
    );
  }
  if (id === "auralynx") {
    const xs =
      dir === "down"
        ? [73, 127]
        : back
          ? [76, 124]
          : side < 0
            ? [79, 109]
            : [121, 91];
    xs.forEach((x, i) =>
      put(
        i === 0 ? "armL" : "armR",
        path(
          `M${x - 9} 136L${x + 8} 136L${x + 10} 146L${x} 152L${x - 10} 146Z`,
          deep ? "#476c7c" : accent,
        ) + (deep ? gauge(x, 143, 3.5) : star(x, 143, 4)),
      ),
    );
  }
  if (id === "lumoth") {
    const xs = side ? [100 - side * 25] : [66, 134];
    put(
      "wings",
      xs
        .map((x) =>
          deep
            ? path(`M${x - 6} 115h12l4 18l-10 7l-10 -7Z`, "#476c7c") +
              line(`M${x - 4} 123h8M${x - 4} 128h8`, p.glow, 2)
            : path(
                `M${x} 121q-15 -15 -17 -2q1 11 17 4q16 6 16 -6q-5 -8 -16 4Z`,
                accent,
              ) + star(x, 122, 3),
        )
        .join(""),
    );
  }
  return out;
}

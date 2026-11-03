import type { CharacterId } from "@arena/shared";
import type { Facing } from "../animation/controller";
import type { CreaturePart } from "../creature-design";
import { HEAD, type Mythic, type Palette } from "./skin-art";

/** Persistent Awakening details, shared by portraits and the articulated rig.
 * Coordinates are final art units, inside the existing part crops. Ambient
 * animation stays in skin-fx; these details also read with reduced motion.
 */
export function awakeningSvg(
  mythic: Mythic,
  stage: number,
  champion: CharacterId,
  dir: Facing,
  p: Palette,
): [CreaturePart, string][] {
  if (stage < 2) return [];
  const full = stage >= 3;
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const { cx, top } = HEAD[champion][dir];
  const out: [CreaturePart, string][] = [];
  const add = (part: CreaturePart, svg: string) => out.push([part, svg]);
  const path = (d: string, fill = "none", stroke = p.glow, width = 2) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"/>`;
  const circle = (
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke = p.glow,
    width = 2,
  ) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  const star = (x: number, y: number, r: number, fill = p.glow) =>
    path(
      `M${x} ${y - r}L${x + r * 0.3} ${y - r * 0.3}L${x + r} ${y}L${x + r * 0.3} ${y + r * 0.3}L${x} ${y + r}L${x - r * 0.3} ${y + r * 0.3}L${x - r} ${y}L${x - r * 0.3} ${y - r * 0.3}Z`,
      fill,
      p.dark,
      1,
    );
  const crescent = (x: number, y: number, r: number) =>
    path(
      `M${x + r * 0.5} ${y - r}A${r} ${r} 0 1 0 ${x + r * 0.5} ${y + r}Q${x - r * 0.65} ${y} ${x + r * 0.5} ${y - r}Z`,
      p.accent,
      p.glow,
      1.5,
    );
  // Paired silhouette details narrow naturally in profile, without moving pivots.
  const paired = (draw: (sign: number) => string) =>
    `<g transform="translate(${side * 5} 0) translate(100 0) scale(${side ? 0.72 : 1} 1) translate(-100 0)">${[-1, 1].map(draw).join("")}</g>`;

  switch (mythic) {
    case "stormcrown":
      add(
        "scarf",
        paired((s) =>
          path(
            `M${100 + s * 13} 128L${100 + s * 28} 119L${100 + s * 23} 135L${100 + s * 32} 135L${100 + s * 15} 153L${100 + s * 19} 138L${100 + s * 11} 138Z`,
            "#ffd65b",
            "#6a4a1f",
          ),
        ),
      );
      if (full)
        add(
          "ears",
          paired((s) =>
            path(
              `M${100 + s * 34} 52L${100 + s * 48} 35L${100 + s * 43} 54L${100 + s * 52} 52L${100 + s * 34} 75L${100 + s * 38} 57Z`,
              "#fff3b0",
              "#d49b30",
            ),
          ),
        );
      break;
    case "sunforged":
      add(
        "scarf",
        path(
          `M76 126L84 132L87 124L93 134L100 126L107 134L113 124L116 132L124 126L119 143Q100 153 81 143Z`,
          "#c87624",
          "#ffe27a",
        ) + circle(100 + side * 4, 141, 5, "#fff3b0", "#ffd65b", 1),
      );
      if (full) {
        add(
          "body",
          circle(100 + side * 5, 143, 13, "#ffb02e", "#ffd65b", 3) +
            circle(100 + side * 5, 143, 6, "#fff3b0", "#ffe27a", 1),
        );
        add(
          "wings",
          paired((s) =>
            path(
              `M${100 + s * 27} 135Q${100 + s * 45} 114 ${100 + s * 40} 79L${100 + s * 61} 101L${100 + s * 48} 104L${100 + s * 65} 124L${100 + s * 49} 122L${100 + s * 55} 143Q${100 + s * 40} 147 ${100 + s * 27} 135Z`,
              "#ffb02e",
              "#ffe27a",
              2.5,
            ),
          ),
        );
      }
      break;
    case "moontide":
      add("flame", crescent(cx, top - 2, 12));
      if (full) {
        add(
          "wings",
          paired(
            (s) =>
              path(
                `M${100 + s * 30} 118Q${100 + s * 60} 91 ${100 + s * 76} 104Q${100 + s * 68} 114 ${100 + s * 73} 131Q${100 + s * 57} 121 ${100 + s * 51} 146Q${100 + s * 40} 137 ${100 + s * 28} 143Z`,
                "#3462a8",
                "#b8f6ff",
                2.5,
              ) +
              path(
                `M${100 + s * 36} 128Q${100 + s * 59} 111 ${100 + s * 67} 112`,
                "none",
                "#7ff3ff",
                2,
              ),
          ),
        );
        add(
          "scarf",
          paired((s) => crescent(100 + s * 21, 134, 6)),
        );
      }
      break;
    case "celestial-sage":
      add(
        "scarf",
        path(
          `M74 126Q100 140 126 126L122 136Q100 151 78 136Z`,
          "#4352a3",
          "#fff3b0",
        ) + star(100 + side * 4, 139, 8, "#fff3b0"),
      );
      if (full) {
        const points = Array.from({ length: 12 }, (_, i) => {
          const a = (Math.PI * 2 * i) / 12;
          return `${100 + Math.cos(a) * (i % 2 ? 44 : 65)},${112 + Math.sin(a) * (i % 2 ? 31 : 46)}`;
        }).join(" ");
        add(
          "wings",
          `<ellipse cx="100" cy="112" rx="59" ry="43" fill="none" stroke="#8dceff" stroke-width="2"/><polygon points="${points}" fill="#5261b0" fill-opacity=".22" stroke="#fff3b0" stroke-width="2"/>` +
            paired((s) => star(100 + s * 60, 112, 7, "#fff3b0")),
        );
      }
      break;
    case "starweaver":
      add(
        "wings",
        paired(
          (s) =>
            path(
              `M${100 + s * 18} 122Q${100 + s * 37} 87 ${100 + s * 62} 83Q${100 + s * 57} 112 ${100 + s * 34} 135Z`,
              "#394886",
              "#b8f6ff",
              2.5,
            ) +
            path(
              `M${100 + s * 24} 125L${100 + s * 41} 105L${100 + s * 55} 92`,
            ) +
            star(100 + s * 41, 105, 5),
        ),
      );
      if (full) {
        add(
          "wings",
          paired(
            (s) =>
              path(
                `M${100 + s * 25} 131Q${100 + s * 55} 116 ${100 + s * 78} 127Q${100 + s * 67} 153 ${100 + s * 35} 156Z`,
                "#6565ae",
                "#fff3b0",
                2.5,
              ) +
              path(
                `M${100 + s * 34} 143L${100 + s * 53} 137L${100 + s * 69} 132`,
                "none",
                "#fff3b0",
              ) +
              star(100 + s * 53, 137, 6, "#fff3b0"),
          ),
        );
        add("flame", star(cx, top - 6, 11, "#fff3b0"));
      }
      break;
    case "oracle":
      add(
        "scarf",
        paired(
          (s) =>
            path(
              `M${100 + s * 9} 130L${100 + s * 23} 124L${100 + s * 29} 142L${100 + s * 14} 148Z`,
              "#562d85",
              "#ffd6ff",
            ) +
            path(
              `M${100 + s * 18} 133L${100 + s * 22} 137L${100 + s * 18} 141L${100 + s * 15} 137Z`,
              "#b8f6ff",
              "#b8f6ff",
              1,
            ),
        ),
      );
      if (full) {
        add(
          "wings",
          paired((s) =>
            [0, 1, 2]
              .map((i) => {
                const x = 100 + s * (40 + i * 9),
                  y = 95 + i * 18;
                return `<g transform="rotate(${s * (18 + i * 12)} ${x} ${y})">${path(`M${x - 8} ${y - 12}H${x + 8}V${y + 12}H${x - 8}Z`, "#24123e", "#ffd6ff")}${star(x, y, 5, "#b8f6ff")}</g>`;
              })
              .join(""),
          ),
        );
        add(
          "flame",
          path(
            `M${cx - 20} ${top + 9}Q${cx} ${top - 14} ${cx + 20} ${top + 9}`,
            "none",
            "#ffd6ff",
            3,
          ) + star(cx, top - 3, 6, "#b8f6ff"),
        );
      }
      break;
    case "world-shell": {
      // Stage II: a gold torc with a little globe pendant. Stage III: a
      // second tree on the island and a rainbow in the waterfall's spray.
      const dx = side * 5;
      // Facing away, only the torc's clasp shows at the nape.
      if (dir === "up")
        add(
          "scarf",
          path("M84 119Q100 125 116 119", "none", "#8a5a12", 4.4) +
            path("M84 119Q100 125 116 119", "none", "#ffd65b", 2.4) +
            path("M100 118L104 122L100 126L96 122Z", "#ffd65b", "#8a5a12", 1.2),
        );
      else
        add(
          "scarf",
          path(`M${76 + dx} 121Q${100 + dx} 134 ${124 + dx} 121`, "none", "#8a5a12", 4.4) +
            path(`M${76 + dx} 121Q${100 + dx} 134 ${124 + dx} 121`, "none", "#ffd65b", 2.4) +
            circle(100 + dx, 133, 5.6, "#2f86d0", "#ffd65b", 2) +
            path(`M${97 + dx} 131q2 -2 5 0q1 3 -2 4q-3 0 -3 -4z`, "#5fbf5a", "none", 0) +
            `<circle cx="${98.4 + dx}" cy="130.6" r="1.2" fill="#ffffff" stroke="none"/>`,
        );
      if (full) {
        const y = top - 22;
        add(
          "flame",
          // A small rainbow in the waterfall's spray.
          path(`M${cx + 16} ${y + 24}A9 8 0 0 1 ${cx + 34} ${y + 24}`, "none", "#ff8fa8", 1.6) +
            path(`M${cx + 18} ${y + 24}A7 6 0 0 1 ${cx + 32} ${y + 24}`, "none", "#ffd65b", 1.6) +
            path(`M${cx + 20} ${y + 24}A5 4 0 0 1 ${cx + 30} ${y + 24}`, "none", "#7fd8ff", 1.6) +
            path(`M${cx + 18} ${y - 2}V${y - 10}`, "none", "#6a4424", 2.6) +
            circle(cx + 18, y - 13, 5.6, "#4faa3f", p.dark, 1.3) +
            `<circle cx="${cx + 16.5}" cy="${y - 15}" r="2.6" fill="#8fe06a" stroke="none"/>`,
        );
      }
      break;
    }
    case "eclipse":
      add(
        "head",
        path(
          `M${cx - 37} 72Q${cx - 42} 39 ${cx - 12} 34M${cx + 12} 34Q${cx + 42} 39 ${cx + 37} 72`,
          "none",
          "#ffd65b",
          3,
        ),
      );
      add(
        "tail",
        circle(
          dir === "right" ? 31.2 : 168.8,
          125.56,
          10,
          "none",
          "#fff3b0",
          2,
        ),
      );
      if (full) {
        add(
          "wings",
          paired((s) =>
            path(
              `M${100 + s * 34} 74L${100 + s * 51} 64L${100 + s * 47} 82L${100 + s * 66} 84L${100 + s * 54} 98L${100 + s * 73} 113L${100 + s * 53} 118L${100 + s * 61} 140L${100 + s * 40} 134`,
              "#19141f",
              "#ffd65b",
              2.5,
            ),
          ),
        );
        add(
          "scarf",
          paired((s) =>
            path(
              `M${100 + s * 8} 126L${100 + s * 22} 133L${100 + s * 28} 154L${100 + s * 13} 145Z`,
              "#fff3b0",
              "#c6923a",
              1.5,
            ),
          ),
        );
      }
      break;
    default:
      newAwakening(mythic, full, champion, dir, p, add, { path, circle, star, crescent, paired });
  }
  return out;
}

type Draw = {
  path: (d: string, fill?: string, stroke?: string, width?: number) => string;
  circle: (x: number, y: number, r: number, fill: string, stroke?: string, width?: number) => string;
  star: (x: number, y: number, r: number, fill?: string) => string;
  crescent: (x: number, y: number, r: number) => string;
  paired: (draw: (sign: number) => string) => string;
};

/**
 * Awakening details for the eight newest champions' Mythicals. Stage II adds
 * a chest piece (and, for some, a crown); stage III a large backdrop on the
 * wings layer, which sits behind the body in front and side views and is
 * drawn as an outline from behind, where that layer covers the back.
 */
function newAwakening(
  mythic: Mythic,
  full: boolean,
  champion: CharacterId,
  dir: Facing,
  p: Palette,
  add: (part: CreaturePart, svg: string) => void,
  { path, circle, star, crescent, paired }: Draw,
) {
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const back = dir === "up";
  const dx = side * 5;
  const { cx, top } = HEAD[champion][dir];
  // A pendant on a cord across the chest (from behind, the cord's clasp).
  const pendant = (jewel: string, cord = "#ffd65b") =>
    back
      ? path("M84 120Q100 126 116 120", "none", cord, 2.6)
      : path(`M${78 + dx} 121Q${100 + dx} 133 ${122 + dx} 121`, "none", cord, 2.4) + jewel;
  // A big disc behind the fighter; just its rim from behind.
  const backdrop = (x: number, y: number, r: number, fill: string, rim: string, inner = "") =>
    back
      ? `<circle cx="${x}" cy="${y}" r="${r}" fill="none" stroke="${rim}" stroke-width="3" opacity=".9"/>`
      : `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${rim}" stroke-width="2.5"/>${inner}`;
  // Backdrops stay inside the rig's wings crop (final art units: x 12 to 188,
  // y from about 48), so they rise beside the head rather than above it.
  const peekR = 25,
    peekX = cx + (side ? -side * 40 : 44),
    peekY = Math.max(top + 50, 51 + peekR);
  const comet = (x: number, y: number, r: number, tx: number, ty: number) =>
    path(`M${x} ${y}L${x + tx} ${y + ty}`, "none", "#9ff3ff", r * 0.9) +
    path(`M${x} ${y}L${x + tx * 0.7} ${y + ty * 0.7}`, "none", "#ffffff", r * 0.4) +
    star(x, y, r, "#ffffff");
  switch (mythic) {
    case "cometcaller":
      add("scarf", pendant(comet(100 + dx, 138, 7.5, -16, -10)));
      if (full)
        add(
          "flame",
          [-1, 0, 1]
            .map((k) => comet(cx + k * 20, top - 12 - (k ? 0 : 8), k ? 5.5 : 7, -k * 6 - 8, -16))
            .join(""),
        );
      break;
    case "harvest-moon":
      add(
        "scarf",
        pendant(
          circle(100 + dx, 139, 9, "#ffd27a", "#8a4a12", 1.8) +
            `<circle cx="${103 + dx}" cy="137" r="6.6" fill="#e8a040" opacity=".55"/>` +
            path(`M${100 + dx} 130V126`, "none", "#8a4a12", 1.8),
          "#ffd27a",
        ),
      );
      if (full)
        add(
          "wings",
          backdrop(
            peekX,
            peekY,
            peekR,
            "#ffd27a",
            "#ffb04a",
            [[-10, -8, 5], [9, -13, 3.6], [12, 7, 4.4], [-13, 11, 3]]
              .map(([x, y, r]) => `<circle cx="${peekX + x}" cy="${peekY + y}" r="${r}" fill="#f0b860" opacity=".6"/>`)
              .join(""),
          ),
        );
      break;
    case "polaris": {
      const north = (x: number, y: number, r: number) =>
        path(
          Array.from({ length: 16 }, (_, i) => {
            const a = -Math.PI / 2 + (i * Math.PI) / 8,
              len = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.55 : r * 0.22;
            return `${i ? "L" : "M"}${+(x + Math.cos(a) * len).toFixed(1)} ${+(y + Math.sin(a) * len).toFixed(1)}`;
          }).join("") + "Z",
          "#fff6c8",
          "#b89a3a",
          1.2,
        );
      add("flame", north(cx, top - 12, 17) + circle(cx, top - 12, 3, "#ffffff", "none", 0));
      if (full)
        add(
          "wings",
          paired(
            (s) =>
              path(`M${100 + s * 24} 112Q${100 + s * 54} 82 ${100 + s * 72} 96Q${100 + s * 60} 116 ${100 + s * 70} 140Q${100 + s * 50} 128 ${100 + s * 28} 138Z`, "#3fd8a8", "#bfffe8", 2) +
              path(`M${100 + s * 30} 120Q${100 + s * 52} 104 ${100 + s * 64} 106`, "none", "#c8a8ff", 3) +
              path(`M${100 + s * 32} 130Q${100 + s * 52} 120 ${100 + s * 64} 128`, "none", "#c8a8ff", 2.4),
          ),
        );
      break;
    }
    case "starfletch":
      add(
        "scarf",
        back
          ? path("M84 120Q100 126 116 120", "none", "#ffd65b", 2.6)
          : path(`M${84 + dx} 124Q${100 + dx} 146 ${116 + dx} 124`, "none", "#ffd65b", 2.6) +
              path(`M${84 + dx} 124L${116 + dx} 124`, "none", "#fff3b0", 1) +
              path(`M${100 + dx} 146L${100 + dx} 120`, "none", "#ffd65b", 2) +
              star(100 + dx, 118, 7, "#fff3b0"),
      );
      if (full)
        add("flame", [-1, 0, 1].map((k) => star(cx + k * 15 + side * 4, top - 8 - (k ? 0 : 9), k ? 6 : 8, "#ffe9a0")).join(""));
      break;
    case "daybreak":
      // A corona round the yuzu (Sunbara's sun), then a dawn-cloud collar and a sunrise.
      add(
        "flame",
        Array.from({ length: 12 }, (_, i) => {
          const a = (i / 12) * Math.PI * 2,
            y = top - 4;
          return path(
            `M${+(cx + Math.cos(a) * 17).toFixed(1)} ${+(y + Math.sin(a) * 15).toFixed(1)}L${+(cx + Math.cos(a) * 25).toFixed(1)} ${+(y + Math.sin(a) * 22).toFixed(1)}`,
            "none",
            "#ffd65b",
            2.6,
          );
        }).join(""),
      );
      if (full) {
        add(
          "scarf",
          back
            ? path("M74 126Q100 136 126 126", "none", "#ffd0a8", 6)
            : paired((s) => circle(100 + s * 14, 130, 8, "#fff0e0", "#ffb04a", 1.6) + circle(100 + s * 27, 126, 6, "#fff0e0", "#ffb04a", 1.6)) +
                circle(100 + dx, 133, 8.5, "#fff6ec", "#ffb04a", 1.6),
        );
        add(
          "wings",
          backdrop(
            cx,
            top + 60,
            back ? 36 : 40,
            "#ffc86a",
            "#ff9a3a",
            Array.from({ length: 8 }, (_, i) => {
              const a = Math.PI + (i / 7) * Math.PI;
              return path(
                `M${+(cx + Math.cos(a) * 44).toFixed(1)} ${+(top + 60 + Math.sin(a) * 44).toFixed(1)}L${+(cx + Math.cos(a) * 54).toFixed(1)} ${+(top + 60 + Math.sin(a) * 54).toFixed(1)}`,
                "none",
                "#ffb732",
                3,
              );
            }).join(""),
          ),
        );
      }
      break;
    case "full-moon":
      // A gold crescent tiara between the ears, then a full moon behind.
      add(
        "flame",
        path(
          `M${cx + side * 3 + 7} ${top - 8}A13 13 0 1 0 ${cx + side * 3 + 7} ${top + 16}Q${cx + side * 3 - 8} ${top + 4} ${cx + side * 3 + 7} ${top - 8}Z`,
          "#ffe680",
          "#a8862a",
          1.6,
        ),
      );
      if (full)
        add(
          "wings",
          backdrop(
            peekX,
            peekY,
            peekR,
            "#f6f4ff",
            "#ffe680",
            [[-10, -8, 5], [9, -13, 3.4], [12, 8, 5.6], [-13, 12, 3.2], [1, 1, 2.6]]
              .map(([x, y, r]) => `<circle cx="${peekX + x}" cy="${peekY + y}" r="${r}" fill="#d8dcf0"/>`)
              .join(""),
          ),
        );
      break;
    case "saturnine":
      add(
        "scarf",
        back
          ? path("M68 134Q100 146 132 134", "none", "#c8a8ff", 4)
          : path(`M${64 + dx} 132Q${100 + dx} 152 ${136 + dx} 132`, "none", "#c8a8ff", 4.4) +
              path(`M${64 + dx} 132Q${100 + dx} 152 ${136 + dx} 132`, "none", "#fff0d8", 1.4) +
              circle(70 + dx, 136, 3.6, "#e8e0ff", "#6a4a8a", 1.2) +
              circle(130 + dx, 136, 3, "#ffd27a", "#8a5a2a", 1.2),
      );
      if (full)
        add(
          "wings",
          back
            ? `<ellipse cx="100" cy="132" rx="74" ry="20" fill="none" stroke="#c8a8ff" stroke-width="5" opacity=".9"/>`
            : `<ellipse cx="100" cy="132" rx="76" ry="22" fill="none" stroke="#c8a8ff" stroke-width="7" opacity=".85"/><ellipse cx="100" cy="132" rx="76" ry="22" fill="none" stroke="#fff0d8" stroke-width="2"/><ellipse cx="100" cy="132" rx="64" ry="17" fill="none" stroke="#ffd27a" stroke-width="2" opacity=".8"/>`,
        );
      break;
    case "nebula":
      add(
        "armL",
        [[56, 140], [66, 150], [50, 152]].map(([x, y]) => star(x, y, 3.6, "#ff9be6")).join(""),
      );
      add(
        "armR",
        [[144, 140], [134, 150], [150, 152]].map(([x, y]) => star(x, y, 3.6, "#8ad8ff")).join(""),
      );
      if (full) {
        const arms = [0, 1, 2]
          .map((k) => {
            const a = (k * 2 * Math.PI) / 3;
            const pt = (r: number, t: number) =>
              `${+(peekX + Math.cos(a + t) * r).toFixed(1)} ${+(peekY + Math.sin(a + t) * r * 0.9).toFixed(1)}`;
            return path(`M${pt(4, 0)}Q${pt(20, 0.9)} ${pt(30, 1.9)}`, "none", k % 2 ? "#8ad8ff" : "#ff9be6", 3);
          })
          .join("");
        add(
          "wings",
          backdrop(peekX, peekY, peekR, "#2a0f4a", "#ff6bd6", arms + circle(peekX, peekY, 5, "#fff0ff", "none", 0)),
        );
      }
      break;
  }
}

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
    case "world-shell":
      add(
        "scarf",
        path(
          `M${111 + side * 5} 119Q${125 + side * 5} 132 ${116 + side * 5} 147Q${108 + side * 5} 155 ${120 + side * 5} 167`,
          "none",
          "#58b8e8",
          9,
        ) +
          path(
            `M${109 + side * 5} 120Q${122 + side * 5} 132 ${113 + side * 5} 148Q${107 + side * 5} 157 ${118 + side * 5} 166`,
            "none",
            "#cefbff",
            3,
          ),
      );
      if (full) {
        add(
          "flame",
          paired(
            (s) =>
              path(
                `M${100 + s * 34} ${top + 1}V${top - 22}`,
                "none",
                "#5a3a1a",
                4,
              ) +
              `<ellipse cx="${100 + s * 34}" cy="${top - 24}" rx="14" ry="12" fill="#4a8a2a" stroke="#2a3a1c" stroke-width="1.5"/><ellipse cx="${100 + s * 29}" cy="${top - 29}" rx="9" ry="7" fill="#9ccf63" stroke="none"/>`,
          ),
        );
        add(
          "body",
          `<ellipse cx="${97 + side * 5}" cy="153" rx="18" ry="8" fill="#58b8e8" stroke="#c8f6ff" stroke-width="2"/>` +
            path(
              `M${86 + side * 5} 153Q${97 + side * 5} 158 ${108 + side * 5} 153`,
              "none",
              "#cefbff",
              1.5,
            ),
        );
      }
      break;
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
  }
  return out;
}

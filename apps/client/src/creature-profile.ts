import type { CharacterId } from "@arena/shared";
import type { CreaturePart, Mood } from "./creature-design";
import type { Palette } from "./skins/skin-art";

interface ProfileDrawing {
  palette: Palette;
  prefix: string;
  mood: Mood;
  eye: (x: number, ring: string, width: number, height: number) => string;
  expression: (
    x: number,
    width: number,
    height: number,
    ink?: string,
  ) => string;
}

/** Authored side anatomy in the same 200×190 coordinates as the front rig.
 * Each part keeps its own joint. Left turns reflect these individual shapes,
 * before proportions, skin masks and accessories are applied.
 */
export function creatureProfile(
  id: CharacterId,
  direction: "left" | "right",
  drawing: ProfileDrawing,
): Record<CreaturePart, string> {
  const { palette: p, prefix, mood, eye, expression } = drawing;
  const body = "url(#" + prefix + "-body)",
    face = "url(#" + prefix + "-face)",
    pearl = "url(#" + prefix + "-pearl)",
    jewel = "url(#" + prefix + "-jewel)",
    shine = "url(#" + prefix + "-shine)";
  const path = (d: string, fill = body, attrs = "") =>
    '<path d="' + d + '" fill="' + fill + '"' + attrs + "/>";
  const line = (d: string, color = p.dark, width = 2, opacity = 1) =>
    path(
      d,
      "none",
      ' stroke="' +
        color +
        '" stroke-width="' +
        width +
        '" opacity="' +
        opacity +
        '"',
    );
  const ellipse = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill = body,
    attrs = "",
  ) =>
    '<ellipse cx="' +
    x +
    '" cy="' +
    y +
    '" rx="' +
    rx +
    '" ry="' +
    ry +
    '" fill="' +
    fill +
    '"' +
    attrs +
    "/>";
  const dot = (x: number, y: number, r: number, fill: string) =>
    ellipse(x, y, r, r, fill, ' stroke="none"');
  const glint = (d: string) => line(d, "#ffffff", 3, 0.55);
  const blush = (x = 116, y = 108) =>
    ellipse(x, y, 6.5, 3.5, "#ff8fb0", ' stroke="none" opacity=".45"');
  const mouth = (d: string) =>
    '<g class="profile-mouth">' + line(d, p.dark, 1.65) + "</g>";
  const star = (x: number, y: number, r: number, fill = p.glow) =>
    path(
      "M" +
        x +
        " " +
        (y - r) +
        "L" +
        (x + r * 0.35) +
        " " +
        (y - r * 0.35) +
        "L" +
        (x + r) +
        " " +
        y +
        "L" +
        (x + r * 0.35) +
        " " +
        (y + r * 0.35) +
        "L" +
        x +
        " " +
        (y + r) +
        "L" +
        (x - r * 0.35) +
        " " +
        (y + r * 0.35) +
        "L" +
        (x - r) +
        " " +
        y +
        "L" +
        (x - r * 0.35) +
        " " +
        (y - r * 0.35) +
        "Z",
      fill,
      ' stroke="none"',
    );
  const paw = (x: number, y: number, w = 12) =>
    path(
      "M" +
        (x - 8) +
        " " +
        (y - 19) +
        "Q" +
        (x - 14) +
        " " +
        (y - 7) +
        " " +
        (x - 10) +
        " " +
        (y - 1) +
        "Q" +
        (x - w) +
        " " +
        (y + 1) +
        " " +
        (x - w) +
        " " +
        (y + 4) +
        "Q" +
        x +
        " " +
        (y + 10) +
        " " +
        (x + w) +
        " " +
        (y + 4) +
        "Q" +
        (x + w + 3) +
        " " +
        (y - 2) +
        " " +
        (x + 6) +
        " " +
        (y - 7) +
        "L" +
        (x + 7) +
        " " +
        (y - 17) +
        "Z",
    ) +
    line(
      "M" +
        (x + 1) +
        " " +
        (y + 3) +
        "V" +
        (y + 6) +
        "M" +
        (x + 6) +
        " " +
        (y + 2) +
        "V" +
        (y + 5),
      p.dark,
      1.2,
      0.5,
    );
  const arm = (x: number) =>
    path(
      "M" +
        (x - 5) +
        " 123Q" +
        (x - 13) +
        " 132 " +
        (x - 9) +
        " 145Q" +
        (x - 6) +
        " 153 " +
        (x + 3) +
        " 150Q" +
        (x + 10) +
        " 148 " +
        (x + 8) +
        " 141L" +
        (x + 6) +
        " 130Q" +
        (x + 4) +
        " 122 " +
        (x - 5) +
        " 123Z",
    ) +
    ellipse(x, 150, 9, 6) +
    glint("M" + (x - 5) + " 130Q" + (x - 8) + " 134 " + (x - 7) + " 139");
  const far = (svg: string) =>
    '<g class="profile-far-limb" opacity=".72">' + svg + "</g>";
  const nearEye = (svg: string) =>
    '<g class="profile-near-eye">' + svg + "</g>";
  const flower = (x: number, y: number, color = "#ffb3d1") =>
    [0, 1, 2, 3, 4]
      .map((i) =>
        ellipse(
          x + Math.cos((i * Math.PI * 2) / 5) * 3.2,
          y + Math.sin((i * Math.PI * 2) / 5) * 3.2,
          2.5,
          2.5,
          color,
          ' stroke="none"',
        ),
      )
      .join("") + dot(x, y, 2, "#fff2ac");
  const layers: Record<CreaturePart, string> = {
    tail: "",
    wings: "",
    legL: far(paw(94, 160, 11)),
    legR: paw(118, 163, 14),
    body:
      path(
        "M90 113Q113 108 128 127Q138 145 126 159Q117 170 97 167Q77 164 77 144Q75 123 90 113Z",
      ) +
      path("M119 120Q135 132 130 151Q127 165 114 161Q106 146 111 130Z", pearl) +
      glint("M87 125Q89 120 95 119"),
    armL: far(arm(88)),
    armR: arm(112),
    head: "",
    ears: "",
    eyes: "",
    scarf: "",
    flame: "",
  };
  if (id === "voltkit") {
    layers.head =
      path(
        "M86 66Q104 56 122 65Q135 72 137 89Q141 96 148 98Q151 101 146 105Q140 117 119 120Q96 124 81 111Q67 96 74 80Q77 72 86 66Z",
        face,
      ) +
      path(
        "M78 100Q93 111 115 104Q130 99 147 100Q147 109 137 114Q116 127 94 117Q83 112 78 106Z",
        p.light,
        ' stroke="none"',
      ) +
      ellipse(122, 93, 15, 17, p.dark, ' stroke="none" opacity=".25"') +
      path(
        "M104 63Q111 63 116 66L116 79L110 83Z",
        p.dark,
        ' stroke="none" opacity=".65"',
      ) +
      path("M146 97Q151 97 149 100L146 101Z", p.dark, ' stroke="none"') +
      mouth("M145 105Q142 110 136 108") +
      blush(120, 109) +
      glint("M79 76Q85 70 94 70");
    layers.eyes = nearEye(eye(122, p.accent, 8.1, 10.1));
    const ear = (x: number, y: number, r: number) =>
      ellipse(x, y, r, r + 2) +
      ellipse(x, y + 1, r * 0.65, r * 0.68, p.light, ' stroke="none"') +
      ellipse(
        x + 2,
        y + 3,
        r * 0.28,
        r * 0.35,
        p.glow,
        ' stroke="none" opacity=".5"',
      );
    layers.ears =
      '<g opacity=".88">' + ear(114, 50, 15) + "</g>" + ear(82, 53, 20);
    layers.flame =
      path("M76 65Q101 62 132 76L135 83Q104 72 77 72Z", p.dark) +
      path("M76 63Q102 59 130 70L132 76Q105 66 77 70Z", p.accent) +
      ellipse(121, 68, 10, 9, p.accent) +
      ellipse(121, 68, 7, 6, jewel) +
      ellipse(101, 63, 7, 7.5, p.accent) +
      ellipse(101, 63, 4.5, 4.8, jewel) +
      glint("M118 65Q121 63 124 64");
    layers.scarf =
      path("M88 117Q108 125 123 117L123 125Q104 132 88 124Z", p.accent) +
      path("M115 126L110 139L118 136L122 140L123 127Z", p.accent) +
      line("M119 128L115 133H119L117 136", p.glow, 1.6);
    layers.wings =
      path("M91 121Q63 118 51 149Q70 144 82 158L101 145Z", p.light) +
      line("M58 145L69 132H78L90 125", p.accent, 2.1) +
      dot(70, 135, 2.2, p.accent);
    layers.tail =
      path(
        "M89 143Q61 160 34 150Q15 145 16 124Q16 111 24 104Q28 120 40 129Q61 141 90 132Z",
      ) +
      path(
        "M16 123Q16 111 24 104Q27 117 34 124L24 135Q18 131 16 123Z",
        p.light,
        ' stroke="none"',
      ) +
      line("M36 129L30 145M51 136L48 151", p.dark, 5, 0.32) +
      dot(24, 104, 12, shine) +
      ellipse(24, 104, 5, 6, jewel);
  }
  if (id === "cindrake") {
    layers.head =
      path(
        "M86 67Q105 57 123 66Q138 75 138 91L148 97Q151 100 147 104L142 107Q136 120 116 121Q93 124 79 110Q66 95 75 79Q79 71 86 67Z",
        face,
      ) +
      line("M82 76L88 83L84 90M94 66L101 74L98 80", p.glow, 2.2, 0.85) +
      dot(146, 98, 1.5, p.dark) +
      mouth("M145 105Q141 111 134 109") +
      blush(122, 109) +
      glint("M78 76Q85 69 94 69");
    layers.eyes = nearEye(eye(123, p.glow, 8.2, 10));
    layers.ears =
      path("M110 65L116 43L122 55L121 70Z", p.accent) +
      path("M89 74Q72 65 65 47Q82 52 98 58L99 70Z", p.accent) +
      line("M72 54L83 63", p.glow, 1.8, 0.8);
    layers.flame =
      path(
        "M79 65Q54 56 49 39Q61 45 72 40Q54 24 61 10Q70 26 85 25Q79 8 91 2Q94 20 110 30Q122 42 118 62Z",
        jewel,
      ) +
      path(
        "M85 61Q67 50 69 35Q78 44 86 41Q81 27 91 21Q93 37 105 41Q114 50 108 61Z",
        "#fff3b8",
        ' stroke="none"',
      ) +
      path(
        "M95 61Q86 52 94 43Q96 52 104 53L105 61Z",
        "#ffffff",
        ' stroke="none"',
      );
    layers.body =
      path(
        "M92 113Q116 110 129 130Q139 148 126 162Q114 173 96 166Q76 160 78 140Q79 122 92 113Z",
      ) +
      path(
        "M118 121Q135 128 134 143Q135 160 121 164L112 158Q117 140 112 125Z",
        pearl,
      ) +
      line(
        "M116 135L133 137M116 146L133 148M116 155L129 157",
        p.mid,
        1.7,
        0.7,
      ) +
      line("M86 132L90 139L87 148", p.glow, 2, 0.75);
    layers.armR =
      arm(112) +
      path("M102 144H122V150H102Z", p.accent) +
      dot(113, 147, 2, p.glow);
    layers.wings =
      path("M88 124Q66 111 63 90L76 98L82 94L85 109L96 116Z", p.accent) +
      line("M88 117Q74 108 68 96", p.glow, 1.8, 0.7);
    layers.tail =
      path(
        "M91 141Q67 151 45 146Q26 140 29 120Q15 129 21 146Q31 167 58 161Q77 159 92 153Z",
      ) +
      path(
        "M30 117Q17 108 20 91Q25 98 29 98Q27 85 36 78Q43 100 37 111Z",
        jewel,
      ) +
      path(
        "M30 111Q24 105 26 97Q30 102 33 102L34 111Z",
        "#fff3b8",
        ' stroke="none"',
      );
  }
  if (id === "tidefin") {
    layers.head =
      path(
        "M86 68Q106 59 124 67Q137 74 139 91Q145 94 148 99Q148 104 141 106Q136 117 117 120Q93 122 79 109Q66 96 74 80Q79 72 86 68Z",
        face,
      ) +
      mouth("M144 103Q139 110 132 107") +
      blush(122, 109) +
      dot(96, 105, 2, p.light) +
      glint("M79 77Q89 71 99 72");
    layers.eyes = nearEye(eye(123, "#7cf6ff", 8.3, 10.1));
    const gill = (d: string, vein: string) =>
      path(d, p.glow) + line(vein, "#ffd2e4", 1.6, 0.9);
    layers.ears =
      '<g opacity=".55">' +
      gill("M86 70Q62 51 54 62Q62 77 84 80Z", "M80 73L61 63") +
      "</g>" +
      gill("M91 76Q71 52 48 61Q52 77 88 84Z", "M84 78Q66 64 54 64") +
      gill("M88 88Q63 70 42 81Q49 95 88 97Z", "M82 91Q61 80 48 83") +
      gill("M88 99Q65 91 51 100Q62 115 92 107Z", "M84 103L57 102");
    layers.flame =
      path("M73 74Q105 60 136 77L136 85Q106 71 74 83Z", p.accent) +
      path(
        "M78 78Q57 72 42 77Q33 82 24 77Q31 92 51 87Q64 82 76 85Q55 85 47 96Q40 101 30 98Q40 113 56 102Q69 92 82 87Z",
        p.accent,
      ) +
      path("M125 69L131 65L135 70L131 78Z", "#ffe7c2") +
      line("M129 69L131 73L133 69", p.mid, 1.3);
    layers.body =
      path(
        "M94 114Q116 112 128 130Q136 149 122 163Q110 172 95 164Q79 158 80 140Q79 123 94 114Z",
      ) +
      path("M119 122Q135 135 129 153Q125 166 114 161Q108 143 113 130Z", pearl);
    layers.scarf =
      path("M84 145Q105 151 123 144L124 151Q105 160 85 153Z", p.accent) +
      path("M88 150Q77 152 68 163Q80 160 91 156Z", p.accent) +
      dot(122, 151, 3.2, "#ffe7c2");
    layers.armR =
      path("M117 149Q122 132 138 119Q139 137 128 151Z", jewel) +
      line("M125 146L136 123", "#ffffff", 1.5, 0.85) +
      path("M115 146L133 148L131 153L115 151Z", "#ffe7c2") +
      arm(112);
    layers.tail =
      path(
        "M91 141Q66 135 48 119Q35 99 12 91L25 122L9 129Q27 150 56 153Q74 158 91 154Z",
      ) +
      line("M13 93L34 125L11 130", p.light, 2) +
      line("M44 129Q60 147 83 149", p.light, 1.4, 0.55) +
      dot(39, 128, 3, p.light) +
      dot(51, 140, 2.8, p.light) +
      dot(64, 147, 2, p.light);
  }
  if (id === "auralynx") {
    layers.head =
      path(
        "M87 66Q106 56 124 66Q137 75 138 91L145 99L148 102Q148 106 141 108Q134 120 115 121Q94 124 80 111Q66 98 75 81Q79 72 87 66Z",
        face,
      ) +
      path("M81 95L69 101L77 106L71 111Q81 118 95 113L98 107Z", p.light) +
      path("M144 100L148 102L144 104L141 102Z", p.accent, ' stroke="none"') +
      mouth("M144 106Q141 111 135 109") +
      blush(123, 109) +
      glint("M83 76Q90 69 100 69");
    layers.eyes = nearEye(eye(123, p.glow, 8.4, 10.4));
    layers.ears =
      '<g opacity=".78">' +
      path("M111 68L108 37L120 23Q128 41 126 69Z") +
      path("M115 61L114 41L119 33L123 61Z", p.light, ' stroke="none"') +
      "</g>" +
      path("M80 78Q69 49 75 26Q95 34 106 61Z") +
      path("M83 67Q76 48 80 37Q91 44 98 60Z", p.light, ' stroke="none"') +
      path("M75 28L73 14L83 22Z", jewel);
    layers.body =
      path(
        "M94 115Q116 111 130 131Q139 148 127 163Q118 173 98 167Q81 162 81 144Q80 124 94 115Z",
      ) +
      path("M116 122Q134 128 132 148Q130 163 117 163Q107 150 111 134Z", pearl);
    layers.flame =
      path("M125 61L131 68L126 78L121 69Z", jewel) +
      line("M111 66L118 70", p.accent, 2, 0.8);
    layers.scarf =
      path(
        "M85 116Q107 109 127 117L124 126L116 123L109 128L101 123L93 127L86 123Z",
        p.light,
      ) +
      [92, 102, 112, 122]
        .map((x, i) => dot(x, 120 + (i % 2), 2.5, i === 2 ? jewel : p.accent))
        .join("");
    const gauntlet = (x: number) =>
      arm(x) +
      path(
        "M" +
          (x - 9) +
          " 144L" +
          (x - 5) +
          " 133L" +
          (x + 2) +
          " 131L" +
          (x + 10) +
          " 144L" +
          x +
          " 158Z",
        jewel,
      ) +
      line("M" + x + " 135V154", "#ffffff", 1.4, 0.7);
    layers.armL = far(gauntlet(88));
    layers.armR = gauntlet(112);
    layers.wings =
      '<ellipse cx="100" cy="115" rx="74" ry="46" fill="none" stroke="' +
      p.glow +
      '" stroke-width="1.4" stroke-dasharray="3 7" opacity=".45"/>' +
      [
        [37, 91, 8],
        [165, 97, 7],
        [144, 151, 8],
        [46, 146, 6],
      ]
        .map(([x, y, r]) =>
          path(
            "M" +
              x +
              " " +
              (y - r) +
              "L" +
              (x + r * 0.55) +
              " " +
              y +
              "L" +
              x +
              " " +
              (y + r) +
              "L" +
              (x - r * 0.55) +
              " " +
              y +
              "Z",
            jewel,
          ),
        )
        .join("");
    layers.tail =
      path(
        "M88 144Q68 149 60 138Q54 130 47 133Q50 123 61 127Q72 132 72 137Q79 141 91 135Z",
      ) +
      path(
        "M49 131Q55 124 62 129L65 137Q56 139 51 135Z",
        p.light,
        ' stroke="none"',
      );
  }
  if (id === "lumoth") {
    layers.head =
      path(
        "M87 65Q107 57 124 68Q138 78 138 95Q143 99 141 103Q136 117 117 120Q95 122 81 109Q68 95 76 79Q79 70 87 65Z",
        face,
      ) +
      mouth("M139 105Q136 110 132 107") +
      blush(122, 110) +
      glint("M83 74Q91 68 100 69");
    layers.eyes = nearEye(eye(124, p.glow, 8.7, 10.9));
    const fern = (d: string, x: number) =>
      line(d, p.dark, 2.1) +
      [0, 1, 2, 3]
        .map((i) =>
          line(
            "M" +
              (x - i * 3) +
              " " +
              (53 - i * 9) +
              "Q" +
              (x - i * 3 - 11) +
              " " +
              (48 - i * 9) +
              " " +
              (x - i * 3 - 14) +
              " " +
              (57 - i * 9),
            i === 3 ? p.glow : p.mid,
            2,
          ),
        )
        .join("");
    layers.ears =
      '<g opacity=".65">' +
      fern("M111 62Q121 33 112 16", 118) +
      dot(112, 16, 3, p.glow) +
      "</g>" +
      fern("M89 62Q82 33 72 15", 87) +
      dot(72, 15, 3.2, p.glow);
    layers.flame = path(
      "M89 63Q83 52 93 49L98 56Q100 47 108 49L108 62Z",
      p.accent,
    );
    const wing = (dx: number, opacity: number) =>
      '<g transform="translate(' +
      dx +
      ' 0)" opacity="' +
      opacity +
      '">' +
      path(
        "M94 131Q96 87 68 60Q47 39 31 51Q18 65 23 90Q27 118 67 128L91 138Z",
      ) +
      path("M91 130Q60 116 35 128Q13 142 30 160Q46 175 74 158L96 139Z") +
      ellipse(48, 88, 13, 15, p.light, ' stroke="none"') +
      ellipse(48, 88, 8.5, 10.5, p.glow) +
      ellipse(48, 89, 5, 7, p.dark) +
      dot(46, 85, 2, "#ffffff") +
      ellipse(47, 146, 11, 10, p.light, ' stroke="none"') +
      ellipse(47, 146, 7, 6, p.glow) +
      ellipse(47, 146, 3.7, 3.5, p.dark) +
      dot(46, 144, 1.5, "#ffffff") +
      line("M87 126Q57 110 30 58", p.light, 1.7, 0.7) +
      star(31, 71, 3.5, "#ffffff") +
      star(67, 151, 2.4, "#ffffff") +
      "</g>";
    layers.wings =
      '<g class="profile-folded-wings">' + wing(7, 0.7) + wing(0, 1) + "</g>";
    layers.scarf =
      path(
        "M86 125Q87 114 94 120Q100 112 106 121Q117 112 121 124Q130 121 128 131Q116 144 95 139Z",
        p.accent,
      ) + line("M97 132Q109 137 120 130", "#dff7ee", 1.8, 0.8);
    layers.body =
      path(
        "M96 116Q119 114 131 134Q139 151 125 164Q111 174 94 164Q77 151 82 133Z",
      ) +
      path("M121 130Q137 144 128 158Q122 168 115 161L111 140Z", pearl) +
      line("M98 153Q113 161 130 151", p.mid, 1.8, 0.65);
  }
  if (id === "mystowl") {
    layers.head =
      path(
        "M88 65Q107 57 125 68Q140 80 140 98Q138 116 120 121Q96 125 82 111Q68 97 75 81Q79 71 88 65Z",
        face,
      ) +
      path(
        "M125 72Q139 79 138 95Q138 112 123 116Q109 115 107 100Q104 81 116 75Z",
        p.accent,
      ) +
      path("M136 99L145 103L137 108Z", p.glow) +
      glint("M80 75Q87 69 97 69");
    layers.eyes = nearEye(eye(125, "#c86bff", 8.4, 10.6));
    const tuft = (d: string, inside: string) => path(d) + path(inside, p.light);
    layers.ears =
      '<g opacity=".7">' +
      tuft("M115 65Q83 47 76 19Q95 37 126 54Z", "M118 58Q95 43 84 30L125 58Z") +
      "</g>" +
      tuft("M103 67Q64 63 40 35Q70 48 115 55Z", "M102 62Q76 57 53 43L114 60Z") +
      tuft("M97 71Q62 77 47 59Q73 65 109 63Z", "M97 67Q74 70 58 64L109 66Z") +
      star(40, 34, 4.5);
    layers.flame =
      path("M128 49L134 59L128 71L122 61Z", jewel) +
      path("M118 43Q125 35 134 40Q126 39 124 46Z", p.glow, ' stroke="none"');
    layers.body =
      path(
        "M96 114Q119 113 131 134Q140 153 124 166Q103 174 87 158Q77 141 85 124Z",
      ) +
      path("M122 124L134 138L123 163L114 140Z", p.accent) +
      line("M118 137L124 143L120 151", p.mid, 1.7);
    layers.wings =
      path(
        "M101 118Q79 109 69 127Q55 146 35 148L46 155L38 159Q56 164 69 159L62 167Q84 173 107 146Z",
      ) +
      path(
        "M94 127Q76 143 50 151Q77 156 100 136Z",
        p.dark,
        ' stroke="none" opacity=".35"',
      ) +
      line("M94 137Q79 157 51 158", p.light, 1.5, 0.7) +
      star(83, 135, 3.3) +
      star(68, 151, 2.5, "#ffffff") +
      glint("M77 125Q84 119 90 123");
    layers.armL = layers.armR = "";
    layers.legL = far(line("M94 163L90 170M98 164L96 172", p.glow, 2.6));
    layers.legR = line(
      "M112 164L110 172M116 164L116 173M120 163L123 171",
      p.glow,
      2.8,
    );
    layers.tail = path("M93 147Q69 161 46 157L56 166Q78 178 103 159Z");
  }
  if (id === "terradon") {
    layers.head =
      path(
        "M95 65Q114 60 130 72Q140 82 139 95L147 100Q148 104 142 106Q139 119 121 122Q101 123 88 109Q77 96 83 81Q87 70 95 65Z",
        face,
      ) +
      mouth("M144 105Q140 111 134 109") +
      blush(122, 112) +
      glint("M92 75Q100 70 108 72") +
      line("M114 79Q123 74 131 81", p.dark, 1.8, 0.4);
    const sleepy =
      mood === "normal" || mood === "focus"
        ? ellipse(123, 95, 10.5, 9.5, "#1b1636") +
          ellipse(125, 98, 5.5, 4.5, p.glow) +
          dot(123, 97, 1.7, "#ffffff") +
          path(
            mood === "focus"
              ? "M112 92Q121 80 134 91L134 94Q124 88 112 95Z"
              : "M112 92Q122 79 134 92L134 97Q123 89 112 96Z",
            p.mid,
          ) +
          line("M112 95Q123 88 134 96", p.dark, 1.9)
        : expression(123, 10, 9);
    layers.eyes = nearEye(sleepy);
    layers.flame =
      line("M108 65Q105 49 110 38", "#5aa64a", 3) +
      path("M108 52Q92 41 89 49Q96 58 108 52Z", p.glow) +
      path("M108 46Q120 32 129 40Q120 51 108 46Z", p.glow) +
      line("M108 51L95 49M110 45L123 40", "#5aa64a", 1.3, 0.75) +
      flower(110, 36);
    layers.body =
      path(
        "M99 116Q122 116 134 136Q144 154 127 167Q109 175 92 159Q82 142 89 128Z",
      ) +
      path("M126 129Q142 140 134 157Q128 170 117 162L113 138Z", pearl) +
      line("M116 140L138 143M117 152L135 155", p.mid, 1.8, 0.7);
    layers.wings =
      path(
        "M40 157Q24 119 46 91Q64 72 89 79Q109 88 111 115L105 158Q78 174 40 157Z",
      ) +
      line(
        "M42 109L64 96L87 107L105 98M35 134L58 121L83 135L108 123M64 96L58 121L64 162M87 107L83 135L91 165",
        p.dark,
        2.1,
        0.6,
      ) +
      path(
        "M43 106Q43 88 62 91Q77 76 93 88L103 101Q89 94 81 106Q64 96 57 112Z",
        p.glow,
      ) +
      flower(55, 106) +
      flower(88, 94, "#ffffff") +
      path("M49 114L47 91L39 100L35 82L29 108L38 120Z", "#bfe9ff") +
      line("M35 91L36 108M45 99L43 111", "#ffffff", 1.3, 0.85);
    layers.armR =
      arm(112) +
      path("M103 131Q111 119 122 129L118 134Q111 130 103 135Z", p.accent);
    layers.armL = far(arm(88));
    layers.legR =
      paw(120, 163, 15) + line("M123 167V170M129 166V169", "#f6ead2", 2);
    layers.tail = path("M87 153Q66 160 57 152Q57 162 71 165L91 160Z");
  }
  if (id === "duskveil") {
    layers.head =
      path(
        "M73 108Q60 83 74 61Q84 47 86 29Q87 11 102 12Q112 12 115 21Q104 16 103 26Q100 41 118 49Q139 60 145 80Q149 94 140 108L134 102L130 114L122 108Q110 123 93 119L83 106L78 113Z",
        face,
      ) +
      path(
        "M125 75Q143 76 143 93Q142 110 128 116Q112 114 110 98Q108 83 125 75Z",
        p.accent,
      ) +
      path(
        "M110 86Q116 71 132 74Q143 76 146 84L142 90Q130 80 119 88L113 99Z",
        p.dark,
        ' stroke="none"',
      ) +
      glint("M76 70Q81 61 89 58") +
      star(117, 55, 4.5) +
      line("M125 49L129 45M128 53L132 49", p.light, 1.3, 0.6);
    let glow = ellipse(128, 93, 13, 13, shine, ' stroke="none" opacity=".7"');
    if (mood === "normal" || mood === "focus")
      glow +=
        ellipse(
          128,
          mood === "focus" ? 95 : 93,
          6.5,
          mood === "focus" ? 6 : 9,
          p.glow,
        ) + ellipse(130, 90, 2.5, 3, "#ffffff");
    else glow += expression(128, 7, 9, p.glow);
    layers.eyes = nearEye(glow);
    layers.body =
      path(
        "M94 116Q113 111 130 120Q127 143 142 165L132 162L129 173L119 164L111 174L103 162L92 172L83 162L72 166Q84 143 85 128Z",
      ) +
      line("M113 127Q105 145 111 160", p.light, 2, 0.4) +
      line("M93 146L88 158", p.light, 1.6, 0.3);
    layers.armL = far(
      path("M91 125Q79 130 77 146L86 148L97 135Z") +
        ellipse(81, 148, 5, 4, p.light),
    );
    layers.armR =
      path("M115 126Q126 131 128 147L117 149Q116 137 109 133Z") +
      ellipse(123, 149, 6, 5, p.light);
    layers.legL = layers.legR = "";
    layers.scarf =
      path("M87 114Q108 125 133 113L129 124Q111 137 87 123Z", p.dark) +
      path("M122 125Q114 129 121 135Q118 130 125 127Z", p.glow);
    layers.tail =
      line("M87 145Q63 154 57 126Q52 105 38 101Q25 98 25 108", p.dark, 3.8) +
      line("M25 103V108", p.dark, 2) +
      ellipse(25, 120, 15, 15, shine, ' stroke="none"') +
      path("M18 110H32L30 130H20Z", p.accent) +
      ellipse(25, 120, 4.5, 7, p.glow) +
      ellipse(25, 122, 2, 3.5, "#ffffff") +
      line("M17 109H33M19 131H31", p.dark, 2.8);
  }
  // Reflect authored geometry per layer, never the animated whole fighter.
  for (const part of Object.keys(layers) as CreaturePart[]) {
    if (!layers[part]) continue;
    layers[part] =
      '<g class="profile-part profile-' +
      part +
      '"' +
      (direction === "left" ? ' transform="matrix(-1 0 0 1 200 0)"' : "") +
      ">" +
      layers[part] +
      "</g>";
  }
  return layers;
}

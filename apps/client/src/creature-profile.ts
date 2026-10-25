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
    legL: far(paw(88, 159, 10)),
    legR: paw(113, 163, 13),
    body:
      path(
        "M91 115Q111 110 122 128Q130 140 124 154Q117 166 99 166Q83 163 81 147Q78 128 91 115Z",
      ) +
      path("M118 124Q132 140 123 155Q118 160 112 158Q108 140 118 124Z", pearl) +
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
        "M79 66Q98 54 120 63Q133 68 135 90Q145 94 146 100Q146 106 139 108Q135 119 112 121Q84 123 73 106Q63 86 79 66Z",
        face,
      ) +
      path(
        "M74 99Q91 108 111 103Q127 100 141 100Q145 107 137 112Q124 124 100 119Q81 117 74 106Z",
        p.light,
        ' stroke="none"',
      ) +
      ellipse(115, 93, 14.5, 16, p.dark, ' stroke="none" opacity=".23"') +
      path(
        "M98 63Q102 62 108 64L108 79L103 84Z",
        p.dark,
        ' stroke="none" opacity=".65"',
      ) +
      path("M142 97Q146 97 145 100L141 101Z", p.dark, ' stroke="none"') +
      mouth("M139 106Q136 110 131 108") +
      blush() +
      glint("M79 76Q85 70 94 70");
    layers.eyes = nearEye(eye(115, p.accent, 7.5, 10));
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
      '<g opacity=".82">' + ear(110, 49, 13) + "</g>" + ear(81, 54, 19);
    layers.flame =
      path("M75 64Q100 57 128 69L130 76Q105 65 76 72Z", p.accent) +
      ellipse(115, 66, 11, 9, p.accent) +
      ellipse(115, 66, 7.5, 6, jewel) +
      ellipse(94, 63, 6, 7, p.accent) +
      ellipse(94, 63, 3.5, 4, jewel) +
      glint("M112 63Q115 61 118 62");
    layers.scarf =
      path("M88 117Q108 125 123 117L123 125Q104 132 88 124Z", p.accent) +
      path("M115 126L110 139L118 136L122 140L123 127Z", p.accent) +
      line("M119 128L115 133H119L117 136", p.glow, 1.6);
    layers.wings =
      path("M90 123Q62 123 56 150Q72 143 84 156L98 147Z", p.light) +
      line("M63 146L70 135H78L88 127", p.accent, 2.1) +
      dot(70, 135, 2.2, p.accent);
    layers.tail =
      path(
        "M88 143Q57 155 39 140Q19 126 26 98Q30 83 39 82Q36 103 50 115Q64 128 90 132Z",
      ) +
      path(
        "M26 98Q28 86 39 82Q36 94 40 102Q34 107 26 107Z",
        p.light,
        ' stroke="none"',
      ) +
      line("M44 113Q42 121 46 128M60 124Q57 131 61 137", p.dark, 5, 0.32) +
      dot(38, 83, 12, shine) +
      ellipse(38, 83, 5, 6, jewel);
  }
  if (id === "cindrake") {
    layers.head =
      path(
        "M77 67Q95 55 118 64Q134 71 135 90L144 96Q148 100 144 105L138 109Q133 120 111 121Q88 123 76 110Q62 93 77 67Z",
        face,
      ) +
      line("M82 76L88 83L84 90M94 66L101 74L98 80", p.glow, 2.2, 0.85) +
      dot(142, 98, 1.5, p.dark) +
      mouth("M139 105Q135 111 129 109") +
      blush(114, 109) +
      glint("M78 76Q85 69 94 69");
    layers.eyes = nearEye(eye(116, p.glow, 7.4, 9.7));
    layers.ears =
      path("M110 65L116 43L122 55L121 70Z", p.accent) +
      path("M82 72Q68 62 62 47Q78 51 92 57L94 70Z", p.accent) +
      line("M69 53L79 62", p.glow, 1.8, 0.8);
    layers.flame =
      path(
        "M78 64Q62 45 73 27Q77 38 85 37Q73 17 91 3Q91 24 105 28Q103 16 113 12Q124 36 118 62Z",
        jewel,
      ) +
      path(
        "M85 61Q75 48 84 37Q89 47 97 47Q94 34 103 30Q115 45 108 60Z",
        "#fff3b8",
        ' stroke="none"',
      ) +
      path("M94 60Q90 52 98 47L105 60Z", "#ffffff", ' stroke="none"');
    layers.body =
      path(
        "M91 115Q114 112 123 129Q130 145 121 159Q114 168 97 166Q81 160 80 144Q78 126 91 115Z",
      ) +
      path(
        "M117 124Q127 128 127 141Q128 156 117 160L110 157Q115 139 110 127Z",
        pearl,
      ) +
      line("M114 136L126 137M114 146L125 147", p.mid, 1.7, 0.7) +
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
        "M90 143Q68 150 48 144Q25 138 30 114Q16 124 20 141Q29 162 56 159Q77 158 92 153Z",
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
        "M76 69Q94 59 117 65Q135 69 137 88Q147 92 146 99Q145 104 139 105Q132 118 112 120Q85 121 74 107Q63 87 76 69Z",
        face,
      ) +
      mouth("M139 103Q134 110 128 106") +
      blush(116, 108) +
      dot(96, 105, 2, p.light) +
      glint("M79 77Q89 71 99 72");
    layers.eyes = nearEye(eye(116, "#7cf6ff", 7.2, 9.3));
    const gill = (d: string, vein: string) =>
      path(d, p.glow) + line(vein, "#ffd2e4", 1.6, 0.9);
    layers.ears =
      '<g opacity=".55">' +
      gill("M86 70Q62 51 54 62Q62 77 84 80Z", "M80 73L61 63") +
      "</g>" +
      gill("M87 74Q65 52 47 63Q55 80 85 83Z", "M80 77Q62 65 53 65") +
      gill("M84 86Q56 68 40 80Q55 96 84 95Z", "M78 89Q58 79 46 81") +
      gill("M85 97Q63 88 51 98Q65 112 87 105Z", "M80 101L57 100");
    layers.flame =
      path("M73 74Q105 60 136 77L136 85Q106 71 74 83Z", p.accent) +
      path(
        "M78 78Q59 75 49 86Q63 83 76 85Q61 86 55 98Q70 91 82 87Z",
        p.accent,
      ) +
      path("M125 69L131 65L135 70L131 78Z", "#ffe7c2") +
      line("M129 69L131 73L133 69", p.mid, 1.3);
    layers.body =
      path(
        "M94 116Q111 113 121 128Q127 143 120 157Q112 167 99 165Q84 159 83 143Q81 127 94 116Z",
      ) +
      path("M116 126Q127 138 120 155Q117 161 112 158Q108 139 116 126Z", pearl);
    layers.scarf =
      path("M84 145Q105 151 123 144L124 151Q105 160 85 153Z", p.accent) +
      path("M88 150Q77 152 68 163Q80 160 91 156Z", p.accent) +
      dot(122, 151, 3.2, "#ffe7c2");
    layers.armR =
      path("M118 147Q120 120 139 100Q145 121 127 148Z", jewel) +
      line("M124 142Q130 120 138 108", "#ffffff", 1.5, 0.85) +
      path("M115 146L133 148L131 153L115 151Z", "#ffe7c2") +
      arm(112);
    layers.tail =
      path("M90 144Q63 139 43 123L18 99Q23 122 38 136L18 141Q49 157 88 155Z") +
      line("M18 99Q30 120 46 133L19 141", p.light, 2) +
      dot(47, 137, 2.7, p.light) +
      dot(58, 145, 2, p.light);
  }
  if (id === "auralynx") {
    layers.head =
      path(
        "M80 66Q99 55 120 64Q132 71 133 89L140 97L145 100Q147 104 141 107Q133 119 112 120Q90 122 77 109Q65 89 80 66Z",
        face,
      ) +
      path("M79 94L68 101L75 105L70 111L87 114L94 108Z", p.light) +
      path("M140 98L145 100L141 103L138 101Z", p.accent, ' stroke="none"') +
      mouth("M140 105Q138 111 132 108") +
      blush(119, 108) +
      glint("M83 76Q90 69 100 69");
    layers.eyes = nearEye(eye(116, p.glow, 7.5, 10));
    layers.ears =
      '<g opacity=".78">' +
      path("M109 68L106 34L118 22Q126 39 123 68Z") +
      path("M112 61L112 39L117 32L120 60Z", p.light, ' stroke="none"') +
      "</g>" +
      path("M77 77Q68 47 76 25Q92 34 102 61Z") +
      path("M80 66Q76 47 80 36L94 59Z", p.light, ' stroke="none"') +
      path("M76 27L74 13L83 21Z", jewel);
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
      path("M87 144Q65 147 62 137Q55 141 60 150Q71 159 89 153Z") +
      path("M60 140Q55 145 62 152L69 147Z", p.accent, ' stroke="none"');
  }
  if (id === "lumoth") {
    layers.head =
      path(
        "M81 65Q101 54 120 65Q135 74 136 93Q144 97 140 105Q135 118 115 120Q91 121 78 107Q66 88 81 65Z",
        face,
      ) +
      mouth("M138 104Q134 109 130 106") +
      blush(116, 109) +
      glint("M83 74Q91 68 100 69");
    layers.eyes = nearEye(eye(116, p.glow, 8.2, 10.7));
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
      path("M91 126Q77 78 41 63Q23 61 29 91Q36 119 88 134Z") +
      path("M88 130Q61 124 44 135Q34 150 52 159Q74 158 91 139Z") +
      ellipse(48, 96, 10, 12, p.light, ' stroke="none"') +
      ellipse(48, 97, 6, 8, p.glow) +
      ellipse(48, 98, 2.6, 3.6, p.dark) +
      ellipse(60, 145, 6, 6, p.light, ' stroke="none"') +
      dot(60, 145, 3, p.glow) +
      line("M83 123Q57 110 35 77", p.light, 1.7, 0.7) +
      star(38, 81, 3.5, "#ffffff") +
      star(73, 148, 2.4, "#ffffff") +
      "</g>";
    layers.wings = wing(-9, 0.65) + wing(0, 1);
    layers.scarf =
      path(
        "M86 125Q87 114 94 120Q100 112 106 121Q117 112 121 124Q130 121 128 131Q116 144 95 139Z",
        p.accent,
      ) + line("M97 132Q109 137 120 130", "#dff7ee", 1.8, 0.8);
    layers.body =
      path(
        "M96 120Q116 117 124 134Q129 152 117 163Q104 169 92 161Q79 148 86 132Z",
      ) +
      path("M116 135Q126 144 119 156Q114 165 109 157L108 141Z", pearl) +
      line("M98 153Q109 158 120 151", p.mid, 1.8, 0.65);
  }
  if (id === "mystowl") {
    layers.head =
      path(
        "M79 66Q99 54 121 65Q140 77 139 99Q136 116 116 121Q94 125 78 110Q63 89 79 66Z",
        face,
      ) +
      path(
        "M124 72Q136 77 136 91Q138 108 122 114Q106 114 103 101Q100 81 113 75Z",
        p.accent,
      ) +
      path("M136 99L145 103L137 108Z", p.glow) +
      glint("M80 75Q87 69 97 69");
    layers.eyes = nearEye(eye(120, "#c86bff", 7.5, 9.8));
    const tuft = (d: string, inside: string) => path(d) + path(inside, p.light);
    layers.ears =
      '<g opacity=".7">' +
      tuft("M116 65Q102 39 109 21Q125 34 128 56Z", "M119 56L112 31L122 44Z") +
      "</g>" +
      tuft("M94 68Q67 51 63 22Q82 45 104 55Z", "M91 60Q74 46 70 34L102 59Z") +
      path("M88 67Q64 65 53 48Q74 57 96 59Z", p.mid) +
      star(63, 21, 4.5);
    layers.flame =
      path("M128 49L134 59L128 71L122 61Z", jewel) +
      path("M118 43Q125 35 134 40Q126 39 124 46Z", p.glow, ' stroke="none"');
    layers.body =
      path(
        "M99 116Q117 116 124 133Q130 151 118 163Q100 170 87 156Q77 140 87 124Z",
      ) +
      path("M120 126L128 136L120 158L113 140Z", p.accent) +
      line("M118 137L124 143L120 151", p.mid, 1.7);
    layers.wings =
      path(
        "M97 118Q74 112 70 132Q61 150 46 157L55 160L50 166Q82 173 100 148Z",
      ) +
      path(
        "M88 127Q76 139 64 153Q83 152 94 137Z",
        p.dark,
        ' stroke="none" opacity=".35"',
      ) +
      star(78, 137, 3.3) +
      star(68, 151, 2.5, "#ffffff") +
      glint("M77 125Q84 119 90 123");
    layers.armL = layers.armR = "";
    layers.legL = far(line("M94 163L90 170M98 164L96 172", p.glow, 2.6));
    layers.legR = line(
      "M112 164L110 172M116 164L116 173M120 163L123 171",
      p.glow,
      2.8,
    );
    layers.tail = path("M89 150Q72 164 55 157L61 167Q78 176 98 159Z");
  }
  if (id === "terradon") {
    layers.head =
      path(
        "M92 65Q111 59 128 70Q138 80 136 92L144 98Q146 102 140 105Q137 118 118 120Q101 121 90 110Q78 98 82 82Q84 72 92 65Z",
        face,
      ) +
      mouth("M139 104Q136 110 129 107") +
      blush(116, 110) +
      glint("M92 75Q100 70 108 72") +
      line("M109 78Q117 74 126 79", p.dark, 1.8, 0.4);
    const sleepy =
      mood === "normal" || mood === "focus"
        ? ellipse(117, 94, 10.5, 9.5, "#1b1636") +
          ellipse(119, 97, 5.5, 4.5, p.glow) +
          dot(117, 96, 1.7, "#ffffff") +
          path(
            mood === "focus"
              ? "M106 91Q115 79 128 90L128 93Q118 87 106 94Z"
              : "M106 91Q116 78 128 91L128 96Q117 88 106 95Z",
            p.mid,
          ) +
          line("M106 94Q117 87 128 95", p.dark, 1.9)
        : expression(117, 10, 9);
    layers.eyes = nearEye(sleepy);
    layers.flame =
      line("M108 65Q105 49 110 38", "#5aa64a", 3) +
      path("M108 52Q92 41 89 49Q96 58 108 52Z", p.glow) +
      path("M108 46Q120 32 129 40Q120 51 108 46Z", p.glow) +
      line("M108 51L95 49M110 45L123 40", "#5aa64a", 1.3, 0.75) +
      flower(110, 36);
    layers.body =
      path(
        "M101 119Q120 118 130 136Q136 154 121 165Q106 171 94 157Q86 141 91 129Z",
      ) +
      path("M125 133Q135 142 126 157Q121 164 116 158L114 138Z", pearl) +
      line("M116 143L131 145M117 153L127 154", p.mid, 1.8, 0.7);
    layers.wings =
      path(
        "M48 155Q35 115 56 92Q73 75 95 82Q114 97 107 135L102 159Q77 168 48 155Z",
      ) +
      line(
        "M52 111L70 99L88 108L105 100M46 135L63 123L84 135L104 125M70 99L63 123L68 153M88 108L84 135L91 160",
        p.dark,
        2.1,
        0.6,
      ) +
      path(
        "M48 108Q53 89 69 93Q78 79 91 89L101 101Q88 95 83 105Q69 97 64 111Z",
        p.glow,
      ) +
      flower(61, 108) +
      flower(87, 96, "#ffffff") +
      path("M49 114L47 91L39 100L35 82L29 108L38 120Z", "#bfe9ff") +
      line("M35 91L36 108M45 99L43 111", "#ffffff", 1.3, 0.85);
    layers.armR =
      arm(112) +
      path("M103 131Q111 119 122 129L118 134Q111 130 103 135Z", p.accent);
    layers.armL = far(arm(88));
    layers.legR =
      paw(114, 163, 15) + line("M117 167V170M123 166V169", "#f6ead2", 2);
    layers.tail = path("M87 153Q66 160 57 152Q57 162 71 165L91 160Z");
  }
  if (id === "duskveil") {
    layers.head =
      path(
        "M72 105Q61 76 79 58Q93 47 95 24Q97 12 110 14Q103 24 109 39Q128 51 140 69Q147 83 140 103L136 98L132 110L125 106Q112 124 92 118L82 105L76 111Z",
        face,
      ) +
      path(
        "M130 77Q143 80 141 96Q137 110 126 116Q111 112 110 98Q110 81 130 77Z",
        p.accent,
      ) +
      path(
        "M112 84Q128 70 141 82L138 89Q126 80 112 94Z",
        p.dark,
        ' stroke="none"',
      ) +
      glint("M76 72Q80 64 87 61") +
      star(113, 57, 4.5) +
      line("M119 49L123 45M122 53L126 49", p.light, 1.3, 0.6);
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
        "M94 117Q111 111 126 119Q123 143 137 165L128 162L125 173L116 164L109 174L101 162L91 172L82 162L73 166Q86 144 86 127Z",
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
      line("M87 145Q61 148 54 120Q48 97 34 94Q25 94 25 104", p.dark, 3.8) +
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

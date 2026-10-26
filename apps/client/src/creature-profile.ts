import type { CharacterId } from "@arena/shared";
import type { CreaturePart, Mood } from "./creature-design";
import type { Palette } from "./skins/skin-art";
export type ArticulatedFacing = "left" | "right" | "up";
export const PROFILE_HEAD_WIDTH = 1.08;
export const PROFILE_FACE_PARTS: CreaturePart[] = [
  "head",
  "earFar",
  "ears",
  "eyes",
  "flame",
];
/** The drawing, texture bounds and particle landmarks share this side-head width. */
export function profileArtX(dir: string, part: CreaturePart, x: number) {
  return (dir === "left" || dir === "right") &&
    PROFILE_FACE_PARTS.includes(part)
    ? 100 + (x - 100) * PROFILE_HEAD_WIDTH
    : x;
}
/** Signature particle landmarks follow the newly authored anatomy. */
export function profileEmissionPoint(
  id: CharacterId,
  dir: ArticulatedFacing,
  part: CreaturePart,
  ax: number,
  ay: number,
): [number, number] {
  const x = (value: number) => (dir === "right" ? 200 - value : value);
  if (part === "tail" && id === "voltkit")
    return dir === "up" ? [161, 114] : [x(164), 101];
  if (part === "flame" && id === "cindrake" && dir !== "up")
    return [x(profileArtX(dir, part, 108 + ax - 100)), ay];
  if (part === "wings" && id === "lumoth" && dir !== "up") return [x(148), ay];
  if (part === "head" && dir !== "up")
    return [
      x(
        profileArtX(
          dir,
          part,
          (id === "terradon" ? 84 : id === "lumoth" ? 90 : 94) +
            (ax - 100) * 0.75,
        ),
      ),
      ay,
    ];
  return [ax, ay];
}
/** Far features occlude behind the head; the near ear retains its visible inner pinna. */
export function profileFaceOrder(
  id: CharacterId,
  dir: ArticulatedFacing,
): CreaturePart[] {
  if (id === "cindrake")
    return dir === "up"
      ? ["flame", "earFar", "ears", "head", "eyes"]
      : ["flame", "earFar", "head", "ears", "eyes"];
  if (id === "tidefin" && dir !== "up")
    return ["earFar", "head", "flame", "ears", "eyes"];
  return dir !== "up" && id === "voltkit"
    ? ["earFar", "head", "ears", "eyes", "flame"]
    : ["earFar", "ears", "head", "eyes", "flame"];
}
export function profilePartOrder(
  dir: ArticulatedFacing,
  id: CharacterId = "voltkit",
): CreaturePart[] {
  const lower: CreaturePart[] =
    dir === "up"
      ? ["tail", "legL", "legR", "armL", "armR", "body", "wings"]
      : ["tail", "wings", "armL", "legL", "legR", "body", "armR"];
  return [...lower, ...profileFaceOrder(id, dir), "scarf"];
}
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

/** Authored joints, before the same cute-proportion transform as the front art. */
export function profilePivot(
  id: CharacterId,
  dir: ArticulatedFacing,
  part: CreaturePart,
): [number, number] | undefined {
  if (part === "head") return [100, 112];
  const rear = dir === "up";
  const points: Partial<Record<CreaturePart, [number, number]>> = rear
    ? {
        armL: [72, 122],
        armR: [128, 122],
        legL: [82, 151],
        legR: [118, 151],
        tail: [id === "duskveil" ? 123 : 100, 146],
        wings: id === "auralynx" ? [100, 115] : [100, 126],
      }
    : {
        armL: [85, 124],
        armR: [111, 124],
        legL: [89, 151],
        legR: [112, 151],
        tail: [id === "duskveil" ? 123 : 119, 144],
        wings:
          id === "auralynx" ? [100, 115] : [116, id === "terradon" ? 134 : 126],
      };
  if (id === "terradon" && !rear)
    Object.assign(points, {
      armL: [77, 133],
      armR: [89, 137],
      legL: [126, 149],
      legR: [143, 151],
    });
  const point = points[part];
  return point && [dir === "right" ? 200 - point[0] : point[0], point[1]];
}

/** Complete upper arms extend underneath the torso; their shoulders are never cut edges. */
export function profilePartBounds(
  id: CharacterId,
  _dir: ArticulatedFacing,
  part: CreaturePart,
) {
  if (id === "terradon" && (part === "legL" || part === "legR"))
    return [20, 130, 160, 50];
  if (part === "body") return [44, 88, 112, 91];
  if (part === "armL" || part === "armR") return [32, 104, 136, 75];
  if (part === "flame") return [10, -4, 180, 132];
  return undefined;
}
export function profileViewBox(_id: CharacterId, _dir: ArticulatedFacing) {
  return "0 -12 200 202";
}

/**
 * Full vector anatomy for every side and rear view, using the front's palette,
 * gradients and outline. Hidden shoulders, hips and necks are painted in full;
 * nothing here is cut from a flattened illustration or deformed as one sheet.
 */
export function creatureProfile(
  id: CharacterId,
  direction: ArticulatedFacing,
  drawing: ProfileDrawing,
): { layers: Record<CreaturePart, string>; defs: string } {
  const { palette: p, prefix, mood, eye, expression } = drawing;
  const back = direction === "up";
  const body = `url(#${prefix}-body)`,
    face = `url(#${prefix}-face)`,
    pearl = `url(#${prefix}-pearl)`,
    jewel = `url(#${prefix}-jewel)`;
  const path = (d: string, fill = body, extra = "") =>
    `<path d="${d}" fill="${fill}"${extra}/>`;
  const e = (
    x: number,
    y: number,
    rx: number,
    ry: number,
    fill = body,
    extra = "",
  ) =>
    `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${fill}"${extra}/>`;
  const line = (d: string, colour = p.dark, width = 2, opacity = 1) =>
    path(
      d,
      "none",
      ` stroke="${colour}" stroke-width="${width}" stroke-linecap="round" opacity="${opacity}"`,
    );
  const shine = (x: number, y: number, w: number) =>
    line(`M${x} ${y}q${w * 0.45} -5 ${w} -1`, "#ffffff", 2.8, 0.5);
  const star = (x: number, y: number, s = 4, colour = p.glow) =>
    path(
      `M${x} ${y - s}L${x + s * 0.3} ${y - s * 0.25}L${x + s} ${y}L${x + s * 0.3} ${y + s * 0.25}L${x} ${y + s}L${x - s * 0.3} ${y + s * 0.25}L${x - s} ${y}L${x - s * 0.3} ${y - s * 0.25}Z`,
      colour,
      ' stroke="none"',
    );
  const flower = (x: number, y: number, colour = "#ffb3d1") =>
    [0, 1, 2, 3, 4]
      .map((i) =>
        e(
          x + Math.cos((i * Math.PI * 2) / 5) * 3,
          y + Math.sin((i * Math.PI * 2) / 5) * 3,
          2.8,
          2.8,
          colour,
          ' stroke="none"',
        ),
      )
      .join("") + e(x, y, 1.8, 1.8, "#fff2a0", ' stroke="none"');
  // Caps are intentionally broad under the chest/head, with no straight joint boundary.
  const arm = (x: number, y = 124, size = 9, pawX = x) =>
    `${e(x, y, size + 3, 13)}${path(`M${x - size} ${y - 4}Q${pawX - size - 3} ${y + 14} ${pawX - size + 1} 153Q${pawX} 161 ${pawX + size} 153Q${pawX + size + 3} ${y + 12} ${x + size} ${y - 4}Z`)}${e(pawX, 152, size + 1, 7)}${shine(pawX - 5, 149, 7)}`;
  const leg = (x: number, wide = 13) =>
    `${e(x, 151, wide * 0.85, 14)}${path(`M${x - 8} 146Q${x - wide} 156 ${x - wide} 167Q${x} 178 ${x + wide} 167Q${x + wide - 1} 153 ${x + 7} 146Z`)}${line(`M${x - 5} 168v3M${x + 1} 169v3M${x + 7} 168v2`, p.dark, 1.4, 0.5)}`;
  // Place the visible cheek behind/below the near eye, rather than hiding it under the iris.
  // Mystowl keeps the deeper pink from its front view; Duskveil has no blush.
  const cheek = (x: number, y = 107) =>
    e(
      x,
      y,
      7.2,
      4.3,
      id === "mystowl" ? "#c2268a" : "#ff8fb0",
      ' class="profile-blush" stroke="none" opacity=".7"',
    );
  const eyes = (x = 80, ring = p.glow, w = 8.3, h = 10.2) =>
    `<g class="profile-near-eye">${eye(x, ring, w, h)}</g>`;
  const grin = (x = 66, y = 108) => line(`M${x} ${y}q2.5 2 5 -.5`, p.dark, 1.6);
  const profiles: Record<CreaturePart, string> = {
    tail: "",
    wings: "",
    legL: leg(back ? 82 : 89, 11),
    legR: leg(back ? 118 : 112, 13),
    body: `${e(100, 121, 20, 17)}${e(back ? 100 : 102, back ? 139 : 141, back ? 29 : 27, back ? 29 : 27)}${back ? "" : e(94, 144, 16, 20, pearl)}${shine(back ? 81 : 88, 127, 14)}`,
    armL: arm(back ? 72 : 85, 124, 9, back ? 72 : 76),
    armR: arm(back ? 128 : 111),
    head: back
      ? `${e(100, 88, 39, 33, face)}${shine(76, 71, 22)}`
      : `${e(94, 88, 34, 33, face)}${shine(76, 69, 20)}${cheek(92)}${grin()}`,
    earFar: "",
    ears: "",
    eyes: back ? "" : eyes(),
    scarf: "",
    flame: "",
  };
  const wingSpot = (x: number, y: number, rx = 9, ry = 11) =>
    e(x, y, rx, ry, p.light) +
    e(x, y + 1, rx * 0.58, ry * 0.63, p.glow) +
    e(x, y + 2, rx * 0.28, ry * 0.31, p.dark);
  const antenna = (x: number, dx: number, top = 19) =>
    line(`M${x} 62Q${x + dx * 0.2} 31 ${x + dx} ${top}`, p.dark, 2.3) +
    [0, 1, 2, 3]
      .map((i) => {
        const t = (i + 1) / 5,
          px = x + dx * t,
          py = 62 - (62 - top) * t;
        return line(
          `M${px} ${py}q${dx > 0 ? 10 : -10} -5 ${dx > 0 ? 15 : -15} 4M${px} ${py}q${dx > 0 ? -7 : 7} -6 ${dx > 0 ? -11 : 11} 2`,
          p.mid,
          2,
        );
      })
      .join("") +
    e(x + dx, top, 3.2, 3.2, p.glow, ' stroke="none"');
  const crook = (rear: boolean) => {
    const root = rear ? 123 : 123;
    return (
      line(
        `M${root} 150Q146 145 151 123Q158 96 174 94Q182 94 181 104`,
        p.dark,
        4,
      ) +
      line("M181 102v8", p.dark, 2) +
      e(
        181,
        121,
        17,
        17,
        `url(#${prefix}-shine)`,
        ' class="lantern-glow" stroke="none"',
      ) +
      path("M173 110H189L186 132H176Z", p.accent) +
      e(181, 121, 4.5, 7, p.glow) +
      e(180, 122, 1.8, 3.5, "#ffffff", ' stroke="none"') +
      line("M172 109h18M174 133h14", p.dark, 2.8)
    );
  };

  if (id === "voltkit") {
    profiles.ears = back
      ? e(64, 57, 18, 20) +
        e(136, 57, 18, 20) +
        e(64, 59, 11, 12, p.light) +
        e(136, 59, 11, 12, p.light)
      : e(116, 45, 20, 23) +
        e(116, 47, 12, 15, p.light, ' stroke="none"') +
        e(116, 49, 6, 8, p.glow, ' opacity=".5" stroke="none"');
    if (!back)
      profiles.earFar =
        e(82, 46, 16, 22) +
        e(82, 47, 10, 14, p.light, ' stroke="none"') +
        e(82, 49, 4.5, 7, p.glow, ' opacity=".4" stroke="none"');
    profiles.head = back
      ? profiles.head +
        path(
          "M96 58Q100 55 104 58L103 118H97Z",
          p.dark,
          ' opacity=".7" stroke="none"',
        )
      : path(
          "M126 86Q125 60 102 56Q82 50 69 64Q61 74 63 88Q61 94 58 97Q56 100 60 102Q61 112 72 117Q93 128 114 115Q130 105 126 86Z",
          face,
        ) +
        e(80, 93, 15, 16, p.dark, ' opacity=".2" stroke="none"') +
        path(
          "M63 104Q77 114 94 106Q91 117 77 118Q65 116 63 104Z",
          p.light,
          ' stroke="none"',
        ) +
        path("M58 98Q61 96 63 99Q61 101 59 100Z", p.dark, ' stroke="none"') +
        cheek(93) +
        shine(76, 69, 20) +
        grin(65, 108);
    profiles.eyes = back ? "" : eyes(80, p.accent, 9.2, 10.8);
    profiles.flame = back
      ? path("M61 73Q100 57 139 73L137 81Q100 66 63 81Z", p.accent) +
        path("M88 66h24v7H88Z", p.dark)
      : path("M65 71Q93 63 128 76L127 83Q95 70 65 79Z", p.accent) +
        e(76, 68, 11, 9, p.accent) +
        e(94, 68, 6, 7, p.accent) +
        e(76, 68, 7.4, 6, jewel) +
        e(94, 68, 3.5, 4.6, jewel) +
        shine(71, 65, 7);
    profiles.tail = back
      ? path(
          "M97 147Q110 160 141 151Q161 141 160 113Q176 128 169 147Q158 175 119 170Q103 168 94 159Z",
        ) +
        path(
          "M158 112Q168 117 169 130L159 137Q164 125 158 112Z",
          p.light,
          ' stroke="none"',
        ) +
        e(161, 114, 5.5, 6, p.glow) +
        line("M121 156l4 11M143 151l7 11", p.light, 7)
      : path(
          "M119 141Q148 145 159 126Q166 116 162 100Q180 109 178 131Q173 157 141 164Q127 163 118 155Z",
        ) +
        path(
          "M162 100Q176 104 178 118L166 124Q169 110 162 100Z",
          p.light,
          ' stroke="none"',
        ) +
        line("M138 147l6 14M153 135l9 14", p.light, 8) +
        e(164, 101, 6, 6, p.glow) +
        e(162, 99, 2, 2, "#ffffff", ' stroke="none"');
    profiles.wings = back
      ? path("M75 120Q47 121 39 155Q56 148 68 158L85 149Z", p.light) +
        path("M125 120Q153 121 161 155Q144 148 132 158L115 149Z", p.light) +
        line("M44 150l14-13 13-2M156 150l-14-13-13-2", p.accent, 2.2)
      : path(
          "M114 121Q145 124 157 152Q143 148 134 157Q124 147 110 150Z",
          p.light,
        ) + line("M119 127l14 10 14 12M133 137l1 14", p.accent, 2.2);
    profiles.scarf = back
      ? path("M72 119Q100 128 128 119L125 127Q100 136 75 127Z", p.accent)
      : path("M78 117Q95 124 119 116L118 124Q98 133 80 125Z", p.accent) +
        star(84, 129, 6, p.glow);
    if (back) profiles.body += line("M98 120v39", p.dark, 4, 0.65);
  }
  if (id === "cindrake") {
    if (!back)
      profiles.head =
        path(
          "M128 86Q126 60 102 57Q80 53 69 67Q62 78 64 90Q57 94 56 100Q55 107 64 112Q80 123 105 118Q128 115 128 92Z",
          face,
        ) +
        shine(75, 69, 20) +
        cheek(94) +
        grin(65, 108) +
        e(61, 100, 1.1, 0.9, p.dark, ' stroke="none" opacity=".7"');
    profiles.eyes = back ? "" : eyes(82, p.glow, 9.6, 10.8);
    profiles.ears = back
      ? path("M65 77L53 52L78 70Z", p.dark) +
        path("M135 77L147 52L122 70Z", p.dark)
      : path("M107 77Q112 64 133 51L125 83Z", p.dark) +
        path("M115 73L127 60L122 77Z", p.mid, ' stroke="none"') +
        line("M116 73l8-9", p.light, 1.4, 0.6);
    if (!back)
      profiles.earFar =
        path("M77 77Q73 65 58 50L64 81Z", p.dark) +
        path("M69 73L62 59L67 76Z", p.mid, ' stroke="none"');
    profiles.flame = back
      ? path(
          "M76 64Q60 40 82 15Q80 39 96 43Q89 17 109 4Q104 31 119 38Q127 24 128 19Q145 46 127 65Z",
          jewel,
        ) +
        path(
          "M88 62Q79 48 94 32Q93 47 102 49Q104 31 115 27Q110 49 120 61Z",
          p.light,
          ' stroke="none"',
        )
      : path(
          "M81 66Q63 48 84 19Q83 38 95 42Q96 16 118 7Q110 28 123 35Q137 22 142 18Q143 48 124 64Z",
          jewel,
        ) +
        path(
          "M89 64Q83 48 98 34Q98 47 107 49Q111 32 122 28Q118 48 122 61Z",
          p.light,
          ' stroke="none"',
        );
    profiles.tail =
      (back
        ? path(
            "M97 148Q116 163 145 151Q164 143 164 124Q182 137 171 156Q156 179 123 173Q104 172 95 158Z",
          )
        : path(
            "M119 141Q148 148 164 131Q174 121 167 108Q188 126 177 147Q161 168 136 165L117 154Z",
          )) +
      path(
        back
          ? "M160 126Q148 114 159 98Q161 111 168 112Q169 101 177 93Q183 115 172 126Z"
          : "M167 111Q155 100 165 83Q168 97 174 99Q176 85 185 79Q189 100 178 112Z",
        jewel,
      );
    if (!back) {
      profiles.head += line("M118 86l-7 8 5 7-6 8", p.glow, 2, 0.8);
      profiles.body += line(
        "M80 135q14 4 27 0M80 146q14 5 27 0",
        p.mid,
        1.7,
        0.65,
      );
    }
    profiles.wings = back
      ? path("M77 122L58 112L63 142L81 150Z", p.accent) +
        path("M123 122L142 112L137 142L119 150Z", p.accent)
      : path(
          "M115 124Q134 115 146 97Q144 114 150 111Q147 126 136 132Q140 141 119 146Z",
          p.accent,
        ) + line("M120 137Q136 122 143 107", p.glow, 1.8, 0.7);
    // The wrist band is part of the near forearm, so it follows the paw.
    if (!back)
      profiles.armR +=
        path("M101 139Q111 143 121 139V146Q111 150 101 146Z", p.accent) +
        e(111, 144, 2, 2, p.glow, ' stroke="none"');
    if (back)
      profiles.body += [121, 137, 153]
        .map((y) => path(`M91 ${y + 5}L100 ${y - 5}L109 ${y + 5}Z`, p.accent))
        .join("");
  }
  if (id === "tidefin") {
    if (!back)
      profiles.head =
        path(
          "M129 87Q127 62 104 59Q80 53 67 68Q60 78 62 92Q58 99 62 106Q68 118 91 120Q116 124 126 106Q132 98 129 87Z",
          face,
        ) +
        shine(74, 72, 23) +
        grin(65, 108) +
        cheek(94);
    profiles.eyes = back ? "" : eyes(80, "#7cf6ff", 9.2, 10.3);
    const fronds = (x: number, y: number, dx: number) =>
      path(
        `M${x} ${y - 3}Q${x + dx * 0.7} ${y - 15} ${x + dx} ${y - 8}Q${x + dx * 0.7} ${y + 7} ${x} ${y + 5}Z`,
        p.glow,
      ) + line(`M${x + dx * 0.2} ${y}l${dx * 0.55} -4`, "#ffd2e4", 1.5, 0.8);
    profiles.ears = back
      ? [
          [-1, 65],
          [1, 135],
        ]
          .map(([sign, x]) =>
            [67, 81, 95]
              .map((y) => fronds(x, y, sign * (y === 81 ? 42 : 34)))
              .join(""),
          )
          .join("")
      : [69, 82, 96].map((y, i) => fronds(113, y, 35 - i * 3)).join("");
    profiles.flame = back
      ? path("M62 74Q100 59 138 74L136 84Q100 71 64 84Z", p.accent) +
        path(
          "M96 78Q81 91 79 109Q92 102 101 85Q109 101 123 110Q120 92 104 79Z",
          p.accent,
        )
      : path("M60 75Q89 61 127 75L124 83Q92 71 61 83Z", p.accent) +
        path(
          "M124 79Q145 76 159 89Q142 87 125 85M126 81Q145 87 150 108Q133 97 124 85Z",
          p.accent,
        ) +
        path("M71 67L77 63L82 68L77 76Z", "#ffe7c2");
    profiles.tail = back
      ? path(
          "M98 143Q119 148 143 132Q154 116 174 110L159 139L182 146Q155 173 119 165L96 155Z",
        ) + line("M125 151l32-12 16 6", p.light, 2)
      : path(
          "M116 140Q143 140 157 120Q166 105 184 99L168 129L190 132Q164 161 138 164L116 154Z",
        ) + line("M141 147l27-18 15 4", p.light, 2);
    profiles.tail +=
      e(147, 147, 3, 3, p.light, ' stroke="none"') +
      e(158, 137, 2.5, 2.5, p.light, ' stroke="none"');
    profiles.scarf =
      path(
        back
          ? "M74 143Q100 153 126 143L126 152Q100 164 74 152Z"
          : "M78 143Q101 152 122 143L123 152Q103 162 78 152Z",
        p.accent,
      ) + (back ? "" : path("M113 152Q130 158 135 171L118 161Z", p.accent));
    if (!back)
      profiles.armR =
        path("M103 151Q92 127 99 107Q116 118 113 149Z", jewel) +
        line("M105 147l-5-31", "#ffffff", 1.5, 0.7) +
        arm(111) +
        path("M100 150h22v6H100Z", "#ffe7c2");
  }
  if (id === "auralynx") {
    profiles.ears = back
      ? path("M67 77L60 23Q83 35 89 64Z") +
        path("M133 77L140 23Q117 35 111 64Z") +
        path("M62 25l-5-13 9 8Z", jewel) +
        path("M138 25l5-13-9 8Z", jewel)
      : path("M105 72Q108 44 118 20Q132 34 125 57L119 76Z") +
        path("M114 58L120 32Q128 43 122 61Z", p.light, ' stroke="none"') +
        path("M118 21l-1-13 8 9Z", jewel);
    if (!back)
      profiles.earFar =
        path("M73 67Q62 47 70 20Q87 34 94 65Z") +
        path("M75 57L73 32Q84 43 87 60Z", p.light, ' stroke="none"') +
        path("M70 21L66 8L75 17Z", jewel);
    if (!back)
      profiles.head =
        path(
          "M124 86Q124 62 103 56Q84 52 70 64Q61 74 63 91L59 99Q58 102 63 104Q66 116 84 120Q108 124 122 111Q129 101 124 86Z",
          face,
        ) +
        path("M59 99Q61 97 64 99L62 102Z", p.dark, ' stroke="none"') +
        shine(77, 70, 20) +
        grin(65, 108) +
        cheek(95);
    profiles.eyes = back ? "" : eyes(81, p.glow, 9.4, 10.8);
    profiles.flame = back ? "" : path("M73 60L80 67L75 77L69 69Z", jewel);
    profiles.scarf =
      path(
        back
          ? "M64 115Q100 129 136 115L129 130Q100 140 71 130Z"
          : "M74 115Q96 126 124 115L123 128Q98 140 77 129Z",
        p.light,
      ) +
      [0, 1, 2, 3, 4]
        .map((i) =>
          e(
            (back ? 75 : 81) + i * (back ? 12 : 9),
            125 + (i % 2) * 2,
            2.6,
            2.6,
            p.accent,
            ' stroke="none"',
          ),
        )
        .join("");
    for (const part of ["armL", "armR"] as const) {
      const x = profilePivot(id, direction, part)![0],
        canonical = direction === "right" ? 200 - x : x,
        paw = !back && part === "armL" ? canonical - 9 : canonical;
      profiles[part] =
        arm(canonical, 124, 9, paw) +
        path(
          `M${paw - 10} 145L${paw - 5} 132H${paw + 5}L${paw + 11} 145L${paw} 159Z`,
          jewel,
        ) +
        line(`M${paw} 135v21`, "#ffffff", 1.3, 0.6);
    }
    // Tucked, rounded paws belong to the levitating seated pose, rather than standing legs.
    for (const [part, x, reach] of [
      ["legL", back ? 82 : 89, -5],
      ["legR", back ? 118 : 112, 4],
    ] as const) {
      profiles[part] =
        e(x, 151, 11, 11) +
        e(x + reach, 161, 13, 7) +
        shine(x + reach - 6, 158, 7);
    }
    profiles.wings =
      `<ellipse cx="100" cy="115" rx="74" ry="46" fill="none" stroke="${p.glow}" stroke-width="1.4" stroke-dasharray="3 7" opacity=".45"/>` +
      [-2.6, -0.5, 0.9, 2.4]
        .map((a, i) =>
          star(
            100 + Math.cos(a) * 74,
            115 + Math.sin(a) * 46,
            7 + (i % 2),
            jewel,
          ),
        )
        .join("");
    profiles.tail = back
      ? path("M99 146Q122 162 139 145Q147 154 133 164Q113 172 96 156Z") +
        e(137, 151, 6, 6, p.accent)
      : path("M119 143Q139 151 144 136Q154 143 146 153Q133 164 118 155Z") +
        e(145, 141, 5, 6, p.accent);
  }
  if (id === "lumoth") {
    profiles.ears = back
      ? antenna(88, -28) + antenna(112, 28)
      : antenna(82, -19, 18) + antenna(106, 18, 16);
    profiles.head =
      (back
        ? e(100, 88, 37, 32, face)
        : e(90, 88, 32, 31, face) + cheek(91) + grin(67, 108)) +
      shine(back ? 76 : 73, 72, 20);
    profiles.eyes = back ? "" : eyes(78, p.glow, 9.8, 11.5);
    profiles.flame = path(
      back
        ? "M88 62Q88 45 100 47Q97 56 107 55L112 48Q123 56 111 64Z"
        : "M84 61Q82 49 94 48Q91 55 100 54L108 47Q118 56 107 64Z",
      p.accent,
    );
    profiles.wings = back
      ? [-1, 1]
          .map(
            (sign) =>
              path(
                `M${100 + sign * 10} 119Q${100 + sign * 30} 62 ${100 + sign * 74} 57Q${100 + sign * 91} 76 ${100 + sign * 74} 106L${100 + sign * 15} 132Z`,
              ) +
              path(
                `M${100 + sign * 13} 128Q${100 + sign * 62} 111 ${100 + sign * 68} 138Q${100 + sign * 65} 164 ${100 + sign * 38} 158Z`,
              ) +
              wingSpot(100 + sign * 57, 87) +
              wingSpot(100 + sign * 50, 143, 6, 6) +
              line(
                `M${100 + sign * 15} 124L${100 + sign * 66} 69`,
                p.light,
                1.4,
                0.7,
              ),
          )
          .join("")
      : path("M111 123Q121 72 155 66Q180 78 163 105Q147 121 114 132Z") +
        path("M114 127Q157 114 171 136Q175 158 148 162Q123 157 112 138Z") +
        wingSpot(148, 91) +
        wingSpot(149, 142, 7, 7) +
        line("M115 126Q134 103 156 76", p.light, 1.5, 0.6) +
        star(162, 81) +
        star(158, 149, 3);
    profiles.scarf = path(
      back
        ? "M68 121Q73 111 85 119Q92 108 100 119Q110 109 117 121Q131 113 135 128Q111 143 88 137Q74 138 68 129Z"
        : "M69 124Q70 115 82 121Q88 111 98 121Q111 115 119 127Q110 140 92 137Q77 141 69 130Z",
      p.accent,
    );
    if (back)
      profiles.body += line(
        "M92 136q8 5 16 0M90 148q10 6 20 0M93 159q7 4 14 0",
        p.mid,
        2,
      );
  }
  if (id === "mystowl") {
    profiles.ears = back
      ? [-1, 1]
          .map(
            (s) =>
              path(
                `M${100 + s * 15} 66Q${100 + s * 32} 44 ${100 + s * 47} 24L${100 + s * 33} 62Z`,
              ) +
              path(
                `M${100 + s * 28} 67L${100 + s * 65} 40L${100 + s * 49} 69Z`,
                p.light,
              ) +
              star(100 + s * 47, 23, 4),
          )
          .join("")
      : path(
          "M88 64Q102 37 122 18L111 55Q131 36 145 30L125 63Q143 48 156 48L135 72Z",
        ) +
        line("M99 58l20-28M116 62l24-23", p.light, 2, 0.8) +
        star(123, 19) +
        star(148, 32, 3);
    profiles.head = back
      ? e(100, 88, 39, 34, face) + shine(75, 72, 22)
      : e(94, 88, 34, 34, face) +
        e(79, 91, 24, 27, p.accent) +
        path("M57 99Q52 100 52 103L57 106Q59 103 57 99Z", p.glow) +
        shine(74, 69, 18) +
        cheek(92, 108);
    profiles.eyes = back ? "" : eyes(77, "#c86bff", 9.8, 11.2);
    profiles.flame = back
      ? ""
      : path("M72 52L80 62L74 73L67 63Z", jewel) +
        line("M73 45q6-7 14-5q-8 0-8 6", p.glow, 2.3);
    profiles.body =
      e(100, 137, back ? 29 : 25, 29) +
      (back
        ? line(
            "M84 130q16 10 32 0M82 143q18 10 36 0M87 156q13 6 26 0",
            p.light,
            2,
            0.4,
          )
        : path("M86 121L80 137L92 161L104 135Z", p.accent));
    profiles.wings = back
      ? [-1, 1]
          .map(
            (s) =>
              path(
                `M${100 + s * 20} 115Q${100 + s * 56} 120 ${100 + s * 58} 162L${100 + s * 42} 157L${100 + s * 34} 165L${100 + s * 20} 153Z`,
              ) +
              line(
                `M${100 + s * 31} 127q${s * 13} 16 ${s * 13} 29`,
                p.light,
                2,
                0.5,
              ) +
              star(100 + s * 40, 143, 3),
          )
          .join("")
      : path(
          "M110 117Q137 117 153 145L171 153Q156 166 141 161L132 168Q117 160 109 144Z",
        ) +
        path("M119 125Q136 132 145 150L160 153Q137 159 123 145Z", p.mid) +
        line("M121 130l22 21", p.light, 2, 0.7) +
        star(136, 143, 3.5) +
        star(148, 155, 2.5, "#ffffff");
    profiles.armL = profiles.armR = "";
    profiles.legL = line(
      back
        ? "M80 162l-4 10M85 163v10M90 163l4 9"
        : "M84 161l-4 11M89 162v11M94 162l4 9",
      p.glow,
      3,
    );
    profiles.legR = line(
      back
        ? "M110 163l-4 9M115 163v10M120 162l4 10"
        : "M107 161l-4 11M112 162v11M117 162l4 9",
      p.glow,
      3,
    );
    profiles.tail = back
      ? path("M91 149Q99 172 117 176L129 170L116 151Z") +
        line("M103 157l14 13", p.light, 2)
      : path("M116 151Q134 169 158 164L151 154L138 151L123 144Z") +
        line("M126 153l22 8", p.light, 2);
  }
  if (id === "terradon") {
    // A grove tortoise: the neck projects from a low dome, supported by four short legs.
    const foot = (
      x: number,
      y: number,
      px: number,
      floor: number,
      width: number,
    ) =>
      e(x, y, 11, 12) +
      path(
        `M${x - 9} ${y - 3}Q${px - width} ${floor - 22} ${px - width} ${floor - 5}Q${px} ${floor + 3} ${px + width} ${floor - 5}Q${px + width + 1} ${floor - 19} ${x + 9} ${y - 3}Z`,
      ) +
      e(px, floor - 5, width, 6) +
      line(
        `M${px - 6} ${floor - 5}v4M${px} ${floor - 4}v4M${px + 6} ${floor - 5}v4`,
        "#f6ead2",
        2.1,
      );
    profiles.head = back
      ? e(100, 102, 29, 27, face) + shine(79, 84, 18)
      : path(
          "M113 98Q112 77 92 72Q72 67 60 83Q54 91 55 102Q50 105 48 111Q47 117 55 121Q69 131 91 127Q112 124 115 108Z",
          face,
        ) +
        shine(66, 83, 20) +
        grin(55, 119) +
        e(52, 111, 1.2, 0.9, p.dark, ' stroke="none"') +
        cheek(84, 116);
    profiles.ears = "";
    profiles.eyes = back
      ? ""
      : `<g class="profile-near-eye" transform="translate(0 10)">${mood !== "normal" && mood !== "focus" ? expression(71, 10, 9) : eye(71, p.glow, 9.5, 9.2) + path("M59 89Q71 83 83 89L83 92Q71 88 59 92Z", p.mid) + line("M59 91q12-4 24 0", p.dark, 1.6)}</g>`;
    const sproutX = back ? 100 : 87;
    profiles.flame =
      line(`M${sproutX} 76Q${sproutX - 2} 62 ${sproutX + 1} 49`, "#5aa64a", 3) +
      path(
        `M${sproutX} 64Q${sproutX - 15} 51 ${sproutX - 20} 58Q${sproutX - 12} 68 ${sproutX} 64Z`,
        p.glow,
      ) +
      path(
        `M${sproutX} 58Q${sproutX + 12} 44 ${sproutX + 21} 49Q${sproutX + 13} 60 ${sproutX} 58Z`,
        p.glow,
      ) +
      flower(sproutX + 1, 47);
    profiles.wings =
      (back
        ? path(
            "M36 148Q32 117 59 101Q100 83 141 101Q168 117 164 148Q161 164 100 166Q39 164 36 148Z",
          )
        : path(
            "M82 141Q80 109 109 97Q136 85 162 106Q182 122 178 148Q174 163 133 164Q94 164 82 150Z",
          )) +
      line(
        back
          ? "M55 118Q70 108 82 110L100 123L118 110Q132 108 145 118M44 142L70 131L100 146L130 131L156 142M82 110L70 131M118 110L130 131M100 123V146"
          : "M94 119Q111 105 126 108L144 122Q161 119 171 129M88 141L109 130L135 146L159 140L175 149M126 108L109 130M144 122L135 146V160",
        p.dark,
        2.4,
        0.6,
      ) +
      line(
        back ? "M40 150Q100 173 160 150" : "M85 147Q128 172 176 149",
        p.light,
        3,
        0.65,
      ) +
      path(
        back
          ? "M42 122Q51 102 75 104Q85 93 101 100Q122 92 139 111Q153 110 159 128L140 121L123 124L103 114L81 119L60 116Z"
          : "M86 123Q91 105 110 107Q119 94 136 104Q156 101 169 124L151 121L137 127L119 117L105 123Z",
        p.glow,
      ) +
      flower(back ? 61 : 120, back ? 119 : 111) +
      flower(back ? 140 : 158, 134, "#ffffff") +
      path(
        back
          ? "M43 122L48 99L57 114L63 96L68 123Z"
          : "M153 124L158 100L166 115L172 103L178 130Z",
        "#bfe9ff",
      ) +
      line(
        back ? "M49 107l4 12M62 104v15" : "M159 107v14M171 111v13",
        "#ffffff",
        1.3,
        0.8,
      );
    profiles.body = back
      ? e(100, 145, 41, 21)
      : e(96, 126, 22, 18) +
        e(112, 145, 40, 19) +
        e(89, 148, 18, 15, pearl) +
        line("M74 143q15 6 29 0M75 153q15 5 28 0", p.mid, 1.8, 0.65);
    profiles.armL = back
      ? foot(72, 122, 59, 168, 13)
      : foot(77, 133, 69, 165, 12);
    profiles.armR = back
      ? foot(128, 122, 141, 168, 13)
      : foot(89, 137, 81, 174, 15);
    profiles.legL = back
      ? foot(82, 151, 81, 174, 13)
      : foot(126, 149, 129, 165, 12);
    profiles.legR = back
      ? foot(118, 151, 119, 174, 13)
      : foot(143, 151, 149, 174, 15);
    profiles.tail = back
      ? path("M96 150Q100 165 107 167L110 162L104 149Z")
      : path("M119 144Q146 147 165 142L182 151Q174 161 149 154L119 155Z");
    profiles.scarf = "";
  }
  if (id === "duskveil") {
    profiles.head = back
      ? path(
          "M60 108Q49 78 72 58Q92 39 99 18Q105 9 115 14Q104 29 112 43Q151 62 144 108Q127 128 100 124Q74 127 60 108Z",
          face,
        ) +
        line("M104 43q16 29 11 70", p.light, 2, 0.4) +
        star(125, 64, 4)
      : path(
          "M64 111Q50 78 79 54Q94 35 101 17Q109 9 118 15Q107 26 115 42Q148 61 140 105L132 101L126 114L113 109Q94 124 74 116Z",
          face,
        ) +
        e(84, 95, 20, 24, p.accent) +
        shine(74, 65, 18) +
        star(119, 58, 4);
    profiles.eyes = back
      ? ""
      : `<g class="profile-near-eye" transform="translate(9 0)">${mood !== "normal" && mood !== "focus" ? expression(75, 8, 9, p.glow) : e(75, 93, 7.5, mood === "focus" ? 6 : 9.5, p.glow) + e(72, 89, 3, 3, "#ffffff", ' stroke="none"')}${mood === "normal" ? line("M63 107q4 3 8-1", p.glow, 1.6) : ""}</g>`;
    profiles.ears = profiles.flame = "";
    profiles.body =
      path(
        back
          ? "M74 112Q100 105 126 112Q131 146 143 170L129 164L121 175L111 164L101 176L90 164L80 174L66 167L57 172Q70 145 74 112Z"
          : "M82 111Q104 105 119 117Q121 142 140 167L126 165L117 175L104 163L93 174L81 164L66 172Q77 143 82 111Z",
      ) +
      line(
        back
          ? "M100 121v39M81 143l-4 18M120 141l6 22"
          : "M96 123q0 23-6 39M115 144l6 18",
        p.light,
        1.7,
        0.3,
      );
    profiles.armL = arm(back ? 72 : 85, 124, 7, back ? 72 : 76);
    profiles.armR = arm(back ? 128 : 111, 124, 7);
    profiles.legL = profiles.legR = "";
    profiles.scarf = path(
      back
        ? "M64 111Q100 125 136 111L130 124Q100 138 70 124Z"
        : "M72 113Q95 125 127 112L124 125Q98 139 76 125Z",
      p.dark,
    );
    profiles.tail = crook(back);
  }
  // Paint the hidden clavicles as well as the visible torso. The circular
  // shoulder roots stay covered even at the largest casting rotations.
  profiles.body = e(100, id === "terradon" ? 120 : 111, 17, 20) + profiles.body;
  if (id !== "mystowl") {
    for (const part of ["armL", "armR"] as const) {
      const [px, py] = profilePivot(id, direction, part)!;
      profiles.body =
        e(direction === "right" ? 200 - px : px, py, 12, 13) + profiles.body;
    }
  }
  if (profiles.tail) {
    const [px, py] = profilePivot(id, direction, "tail")!;
    profiles.tail =
      e(
        direction === "right" ? 200 - px : px,
        py,
        7,
        7,
        id === "duskveil" ? p.dark : body,
      ) + profiles.tail;
  }
  for (const part of Object.keys(profiles) as CreaturePart[]) {
    if (!profiles[part]) continue;
    const canonical = profiles[part];
    profiles[part] =
      `<g class="profile-part profile-${part} articulated-part" data-articulated-facing="${direction}">${direction === "right" ? `<g transform="translate(200 0) scale(-1 1)">${canonical}</g>` : canonical}</g>`;
  }
  return { layers: profiles, defs: "" };
}

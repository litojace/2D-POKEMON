import type { CharacterId } from "@arena/shared";
import type { Facing } from "../animation/controller";
import type { CreaturePart } from "../creature-design";
import { profileFaceOrder } from "../creature-profile";
import { HEAD, type Mythic, type Palette } from "./skin-art";

/**
 * The Void Knight Mythicals: every champion in black steel with glowing runes
 * in its own colour. Each one swaps the champion's own head piece and neck
 * piece (goggles, crest, kerchief...) for its armour (see SkinArt.replaces):
 *
 *  - Stage I: a helm crest (a crown of blades, horns, an eclipse...) and a
 *    gorget with a rune clasp.
 *  - Stage II: spiked pauldrons and a tattered cape (Terradon's shell grows
 *    obsidian spikes instead).
 *  - Stage III: a fan of rune swords behind the shoulders, and a taller crest.
 *
 * Coordinates are final art units, inside the rig's part crops (head pieces
 * on "flame", neck pieces on "scarf", back pieces on "wings"). Battle
 * effects live in skin-fx.
 */
type Crest =
  | "blades"
  | "bolts"
  | "flames"
  | "ice"
  | "fins"
  | "eclipse"
  | "crystals"
  | "iron"
  | "none";
export interface VoidKnight {
  champion: CharacterId;
  /** Rune glow and its hot core. */
  rune: string;
  hot: string;
  crest: Crest;
  /** Half-width of the crest's band, and how far below the head top it sits. */
  band?: [number, number];
  horns?: "demon" | "ram" | "spike";
  /** Horn roots, from the head centre and top. */
  hornAt?: [number, number];
  /** The gorget's top edge (final art units). */
  neck?: number;
  /** The cape's hem; false for no cape. */
  cape?: number | false;
  /** One extra piece of the champion's own. */
  extra?: "third-eye" | "shell-spikes" | "rift-gem";
}

export const VOID_KNIGHTS: Record<Mythic, VoidKnight> = {
  "storm-revenant": {
    champion: "voltkit",
    rune: "#b48cff",
    hot: "#f1e8ff",
    crest: "bolts",
    band: [24, 14],
  },
  hellforge: {
    champion: "cindrake",
    rune: "#ff5a2e",
    hot: "#ffd08a",
    crest: "flames",
    band: [24, 12],
    horns: "demon",
    hornAt: [27, 20],
  },
  "abyssal-reaver": {
    champion: "tidefin",
    rune: "#2ef2d0",
    hot: "#d2fff6",
    crest: "fins",
    band: [26, 12],
  },
  "spectral-warden": {
    champion: "auralynx",
    rune: "#6fb4ff",
    hot: "#e2f0ff",
    crest: "blades",
    band: [21, 14],
  },
  "fallen-lightbringer": {
    champion: "lumoth",
    rune: "#ffd95a",
    hot: "#fff7cc",
    crest: "blades",
    band: [17, 12],
    cape: 156,
  },
  "void-inquisitor": {
    champion: "mystowl",
    rune: "#ff4fd2",
    hot: "#ffd6f5",
    crest: "blades",
    band: [20, 13],
    extra: "third-eye",
    cape: 158,
  },
  "obsidian-bulwark": {
    champion: "terradon",
    rune: "#8dff5a",
    hot: "#e6ffd0",
    crest: "crystals",
    band: [22, 12],
    horns: "ram",
    hornAt: [34, 30],
    cape: false,
    extra: "shell-spikes",
  },
  "crimson-sovereign": {
    champion: "duskveil",
    rune: "#ff2d55",
    hot: "#ffc4d0",
    crest: "none",
    horns: "demon",
    hornAt: [17, 52],
    neck: 121,
  },
  "volt-executioner": {
    champion: "coilemur",
    rune: "#4ff0ff",
    hot: "#e0ffff",
    crest: "bolts",
    band: [20, 13],
  },
  "ashen-warlord": {
    champion: "pyranda",
    rune: "#ff8a1e",
    hot: "#ffe2a8",
    crest: "flames",
    band: [20, 13],
  },
  rimebane: {
    champion: "glacelle",
    rune: "#7fe8ff",
    hot: "#f2fdff",
    crest: "ice",
    band: [22, 12],
    cape: 156,
  },
  nightfeather: {
    champion: "halcyra",
    rune: "#8a7cff",
    hot: "#e8e4ff",
    crest: "blades",
    band: [18, 13],
    cape: 156,
  },
  "eclipse-templar": {
    champion: "sunbara",
    rune: "#ffb02e",
    hot: "#fff0c4",
    crest: "eclipse",
    band: [24, 12],
  },
  "rift-duelist": {
    champion: "astrabun",
    rune: "#c86bff",
    hot: "#f4e4ff",
    crest: "blades",
    band: [15, 14],
    extra: "rift-gem",
  },
  "iron-juggernaut": {
    champion: "wombolder",
    rune: "#c8ff3a",
    hot: "#f4ffd2",
    crest: "iron",
    band: [30, 12],
    horns: "spike",
    hornAt: [30, 16],
    neck: 127,
  },
  "abyss-stalker": {
    champion: "shadopus",
    rune: "#ff3b9a",
    hot: "#ffd2e8",
    crest: "blades",
    band: [26, 12],
    neck: 128,
    cape: 158,
  },
  "thorn-warden": {
    champion: "pangrove",
    rune: "#7dff3a",
    hot: "#e8ffd0",
    crest: "blades",
    band: [24, 12],
    horns: "spike",
    hornAt: [30, 18],
    cape: 156,
  },
  "blight-sentinel": {
    champion: "mossloth",
    rune: "#3affc0",
    hot: "#d6fff2",
    crest: "crystals",
    band: [22, 10],
    horns: "ram",
    hornAt: [34, 30],
    cape: 158,
  },
};

const STEEL = "#252a37",
  PLATE = "#3b4255",
  EDGE = "#b3bccf",
  INK = "#07080d",
  CLOTH = "#16121f";
const n = (v: number) => +v.toFixed(1);
const pt = (x: number, y: number) => `${n(x)} ${n(y)}`;

/** The pieces a Void Knight wears at an Awakening stage, by rig part. */
export function awakeningSvg(
  mythic: Mythic,
  stage: number,
  champion: CharacterId,
  dir: Facing,
  _p: Palette,
): [CreaturePart, string][] {
  const k = VOID_KNIGHTS[mythic];
  if (!k) return [];
  const out: [CreaturePart, string][] = [];
  const add = (part: CreaturePart, svg: string) => svg && out.push([part, svg]);
  const v = {
    k,
    stage,
    dir,
    side: dir === "left" ? -1 : dir === "right" ? 1 : 0,
    back: dir === "up",
  };
  // Head pieces go on the crest layer, unless the champion's own crest sits
  // behind its head in this view (Cindrake): then on the head itself.
  const order = dir === "down" ? [] : profileFaceOrder(champion, dir);
  const helm: CreaturePart =
    order.indexOf("flame") >= 0 &&
    order.indexOf("flame") < order.indexOf("head")
      ? "head"
      : "flame";
  add(
    helm,
    crest(v, HEAD[champion][dir]) +
      horns(v, HEAD[champion][dir]) +
      faceExtra(v, HEAD[champion][dir]),
  );
  add("scarf", gorget(v));
  if (stage >= 2) add("wings", cape(v) + shellSpikes(v));
  if (stage >= 3) add("wings", swordFan(v));
  return out;
}

type View = {
  k: VoidKnight;
  stage: number;
  dir: Facing;
  side: number;
  back: boolean;
};

// ---------------------------------------------------------------- drawing kit
const shape = (d: string, fill = STEEL, width = 1.5) =>
  `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="${width}" stroke-linejoin="round"/>`;
const line = (d: string, color: string, width: number, opacity = 1) =>
  `<path d="${d}" fill="none" stroke="${color}" stroke-width="${width}" stroke-linecap="round" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ""}/>`;
/** A rune line: a soft halo under a hot core. */
const rune = (d: string, k: VoidKnight, width = 1.3) =>
  line(d, k.rune, width * 3, 0.35) + line(d, k.hot, width);
/** A glowing gem: a halo, a diamond and a glint. */
const gem = (x: number, y: number, r: number, k: VoidKnight) =>
  `<circle cx="${n(x)}" cy="${n(y)}" r="${n(r * 2)}" fill="${k.rune}" opacity=".3" stroke="none"/>` +
  shape(
    `M${pt(x, y - r * 1.25)}L${pt(x + r, y)}L${pt(x, y + r * 1.25)}L${pt(x - r, y)}Z`,
    k.rune,
    1.2,
  ) +
  `<path d="M${pt(x - r * 0.25, y - r * 0.7)}L${pt(x + r * 0.3, y - r * 0.15)}" stroke="#ffffff" stroke-width="${n(Math.max(0.8, r * 0.3))}" stroke-linecap="round" fill="none"/>`;
/**
 * A tapered spike from base `b` (width `w`) bending through `c` to tip `t`.
 * Used for blades, horns and armour spikes.
 */
function spike(
  b: [number, number],
  c: [number, number],
  t: [number, number],
  w: number,
  fill = STEEL,
) {
  const dx = c[0] - b[0],
    dy = c[1] - b[1],
    len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * (w / 2),
    ny = (dx / len) * (w / 2);
  return shape(
    `M${pt(b[0] + nx, b[1] + ny)}Q${pt(c[0] + nx * 0.5, c[1] + ny * 0.5)} ${pt(t[0], t[1])}Q${pt(c[0] - nx * 0.5, c[1] - ny * 0.5)} ${pt(b[0] - nx, b[1] - ny)}Z`,
    fill,
    1.3,
  );
}

// ---------------------------------------------------------------- the helm
/** A crest on a curved band across the head top (the champion's own piece is gone). */
function crest(v: View, h: { cx: number; top: number }) {
  const { k, stage, side, back } = v;
  if (k.crest === "none") return "";
  const [W, drop] = k.band ?? [24, 12];
  const by = h.top + drop;
  const sx = side ? 0.72 : 1,
    ox = h.cx + side * 4;
  const X = (d: number) => ox + d * sx;
  // The band's top edge, as a quadratic from -W to W (for seating the spikes).
  const seat = (d: number) => {
    const t = (d / W + 1) / 2;
    return by + 5 - 24 * t * (1 - t);
  };
  const grow = stage >= 3 ? 1.3 : 1;
  /** Crests read at battle size: a little taller than the band suggests. */
  const tall = 1.2;
  let out = "";
  const spikes = (
    offs: number[],
    heights: number[],
    draw: (x: number, y: number, h: number, lean: number, i: number) => string,
  ) =>
    offs
      .map((o, i) =>
        draw(
          X(o * W),
          seat(o * W),
          tall *
            heights[i] *
            (i === Math.floor(offs.length / 2) ? grow : 1 + (grow - 1) / 2),
          o * 4 * sx,
          i,
        ),
      )
      .join("");
  const mid = (len: number) => Math.floor(len / 2);
  switch (k.crest) {
    case "blades": {
      const offs = [-0.8, -0.42, 0, 0.42, 0.8];
      out += spikes(
        offs,
        [9, 15, 24, 15, 9],
        (x, y, hh, lean, i) =>
          spike(
            [x, y + 1],
            [x + lean * 0.4, y - hh * 0.5],
            [x + lean, y - hh],
            i === mid(offs.length) ? 9 : 7,
          ) +
          (i === mid(offs.length)
            ? rune(`M${pt(x, y - 3)}L${pt(x + lean * 0.8, y - hh + 7)}`, k, 1)
            : line(
                `M${pt(x - 1.2, y - 2)}L${pt(x + lean - 0.4, y - hh + 3)}`,
                EDGE,
                0.8,
                0.7,
              )),
      );
      break;
    }
    case "bolts": {
      const offs = [-0.75, 0, 0.75];
      out += spikes(offs, [16, 26, 16], (x, y, hh, lean, i) => {
        const s = i === 0 ? -1 : 1;
        const d = `M${pt(x - 4.5, y + 1)}L${pt(x - 1 + lean * 0.3, y - hh * 0.42)}L${pt(x - 5 * s + lean * 0.4, y - hh * 0.46)}L${pt(x + lean, y - hh)}L${pt(x + 2 + lean * 0.5, y - hh * 0.55)}L${pt(x + 6 * s + lean * 0.4, y - hh * 0.52)}L${pt(x + 4.5, y + 1)}Z`;
        return (
          shape(d) +
          rune(
            `M${pt(x, y - 2)}L${pt(x + lean * 0.4, y - hh * 0.48)}L${pt(x + lean * 0.9, y - hh + 4)}`,
            k,
            0.9,
          )
        );
      });
      break;
    }
    case "flames": {
      const offs = [-0.7, -0.35, 0, 0.35, 0.7];
      out += spikes(offs, [12, 18, 28, 18, 12], (x, y, hh, lean, i) => {
        const w = i === mid(offs.length) ? 7 : 5.5;
        const d = `M${pt(x - w, y + 1)}Q${pt(x - w - 2, y - hh * 0.55)} ${pt(x + lean, y - hh)}Q${pt(x + w * 0.4, y - hh * 0.6)} ${pt(x + w * 0.9, y - hh * 0.45)}Q${pt(x + w + 2, y - hh * 0.2)} ${pt(x + w, y + 1)}Z`;
        const inner = `M${pt(x - w * 0.45, y)}Q${pt(x - w * 0.5, y - hh * 0.4)} ${pt(x + lean * 0.6, y - hh * 0.62)}Q${pt(x + w * 0.5, y - hh * 0.3)} ${pt(x + w * 0.45, y)}Z`;
        return (
          `<path d="${d}" fill="${k.rune}" opacity=".35" stroke="none" transform="translate(0 -1.5)"/>` +
          shape(d, "#1a0d10") +
          `<path d="${inner}" fill="${k.rune}" stroke="none" opacity=".9"/>` +
          `<path d="${inner}" fill="${k.hot}" stroke="none" opacity=".7" transform="translate(${n(x * 0.3)} ${n(y * 0.3)}) scale(.7)"/>`
        );
      });
      break;
    }
    case "ice": {
      const offs = [-0.78, -0.4, 0, 0.4, 0.78];
      out += spikes(offs, [11, 17, 26, 17, 11], (x, y, hh, lean, i) => {
        const w = i === mid(offs.length) ? 5 : 4;
        const d = `M${pt(x - w, y + 1)}L${pt(x - w * 0.7 + lean * 0.5, y - hh * 0.7)}L${pt(x + lean, y - hh)}L${pt(x + w * 0.7 + lean * 0.5, y - hh * 0.62)}L${pt(x + w, y + 1)}Z`;
        return (
          shape(d, "#1d3448") +
          `<path d="M${pt(x, y)}L${pt(x + lean, y - hh)}L${pt(x + w * 0.7 + lean * 0.5, y - hh * 0.62)}L${pt(x + w, y + 1)}Z" fill="${k.rune}" opacity=".35" stroke="none"/>` +
          line(`M${pt(x, y - 1)}L${pt(x + lean, y - hh + 2)}`, k.hot, 0.9, 0.9)
        );
      });
      break;
    }
    case "fins": {
      // A swept dorsal fin over the crown and two small ones beside it.
      const tall = 30 * grow;
      const back = -(side || 0) * 10;
      const x0 = X(0);
      out += shape(
        `M${pt(x0 - 8, seat(0) + 1)}Q${pt(x0 - 6 + back * 0.3, seat(0) - tall * 0.6)} ${pt(x0 + back + 2, seat(0) - tall)}Q${pt(x0 + 10, seat(0) - tall * 0.55)} ${pt(x0 + 8, seat(0) + 1)}Z`,
      );
      out += rune(
        `M${pt(x0 - 2, seat(0) - 2)}Q${pt(x0 + back * 0.3, seat(0) - tall * 0.55)} ${pt(x0 + back * 0.85 + 1, seat(0) - tall + 6)}`,
        k,
        1,
      );
      for (const o of [-0.62, 0.62]) {
        const x = X(o * W),
          y = seat(o * W);
        out += spike([x, y + 1], [x + o * 6, y - 8], [x + o * 14, y - 14], 7);
      }
      break;
    }
    case "eclipse": {
      // A black sun on a short mast, with a corona of blades.
      const x0 = X(0),
        y0 = seat(0) - 16;
      const r = 11 * (stage >= 3 ? 1.15 : 1);
      out += spike([x0, seat(0) + 1], [x0, seat(0) - 5], [x0, y0 + r - 1], 8);
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
        const len = i % 2 ? 6 : 10;
        out += spike(
          [x0 + Math.cos(a) * (r - 1) * sx, y0 + Math.sin(a) * (r - 1)],
          [
            x0 + Math.cos(a) * (r + len / 2) * sx,
            y0 + Math.sin(a) * (r + len / 2),
          ],
          [x0 + Math.cos(a) * (r + len) * sx, y0 + Math.sin(a) * (r + len)],
          4.6,
          PLATE,
        );
      }
      out += `<ellipse cx="${n(x0)}" cy="${n(y0)}" rx="${n((r + 4) * sx)}" ry="${n(r + 4)}" fill="${k.rune}" opacity=".35" stroke="none"/>`;
      out += `<ellipse cx="${n(x0)}" cy="${n(y0)}" rx="${n(r * sx)}" ry="${n(r)}" fill="${k.hot}" stroke="${INK}" stroke-width="1.4"/>`;
      out += `<ellipse cx="${n(x0 + 2 * (side || 1) * sx)}" cy="${n(y0 - 1)}" rx="${n((r - 2.4) * sx)}" ry="${n(r - 2.4)}" fill="#07040a" stroke="none"/>`;
      break;
    }
    case "crystals": {
      // Obsidian crystals where the sprout grew.
      const offs = [-0.5, 0, 0.5];
      out += spikes(offs, [16, 25, 14], (x, y, hh, lean, i) => {
        const w = i === 1 ? 6.5 : 5;
        const d = `M${pt(x - w, y + 1)}L${pt(x - w + lean * 0.7, y - hh * 0.75)}L${pt(x + lean, y - hh)}L${pt(x + w + lean * 0.7, y - hh * 0.75)}L${pt(x + w, y + 1)}Z`;
        return (
          shape(d, "#14161a") +
          `<path d="M${pt(x + lean * 0.2, y)}L${pt(x + lean, y - hh)}L${pt(x + w + lean * 0.7, y - hh * 0.75)}L${pt(x + w, y + 1)}Z" fill="${k.rune}" opacity=".28" stroke="none"/>` +
          rune(
            `M${pt(x + lean * 0.25, y - 2)}L${pt(x + lean * 0.9, y - hh + 4)}`,
            k,
            0.9,
          )
        );
      });
      break;
    }
    case "iron": {
      // An iron cap over the crown: a riveted dome with a central ridge.
      const y1 = by + 9,
        y0 = h.top - 3;
      out += shape(
        `M${pt(X(-W), y1)}Q${pt(X(-W * 0.95), y0 - 2)} ${pt(X(0), y0)}Q${pt(X(W * 0.95), y0 - 2)} ${pt(X(W), y1)}Q${pt(X(0), y1 - 6)} ${pt(X(-W), y1)}Z`,
      );
      out += line(
        `M${pt(X(-W * 0.8), y1 - 6)}Q${pt(X(-W * 0.6), y0 + 3)} ${pt(X(-W * 0.15), y0 + 2)}`,
        EDGE,
        1.1,
        0.6,
      );
      out += shape(
        `M${pt(X(-3), y0 + 1)}L${pt(X(0), y0 - 6 * grow)}L${pt(X(3), y0 + 1)}L${pt(X(3), y1 - 5)}L${pt(X(-3), y1 - 5)}Z`,
        PLATE,
        1.2,
      );
      out += rune(
        `M${pt(X(-W + 3), y1 - 3)}Q${pt(X(0), y1 - 9)} ${pt(X(W - 3), y1 - 3)}`,
        k,
        1.1,
      );
      for (const o of [-0.7, -0.35, 0.35, 0.7])
        out += `<circle cx="${n(X(o * W))}" cy="${n(y1 - 4 - (1 - Math.abs(o)) * 3)}" r="1.6" fill="${EDGE}" stroke="${INK}" stroke-width=".8"/>`;
      return out;
    }
  }
  // The band itself, over the spikes' roots.
  const band = `M${pt(X(-W), by + 5)}Q${pt(X(0), by - 7)} ${pt(X(W), by + 5)}L${pt(X(W - 1), by + 11)}Q${pt(X(0), by - 1)} ${pt(X(-W + 1), by + 11)}Z`;
  out += shape(band, PLATE);
  out += line(
    `M${pt(X(-W + 2), by + 4)}Q${pt(X(0), by - 6)} ${pt(X(W - 2), by + 4)}`,
    EDGE,
    0.9,
    0.7,
  );
  out += rune(
    `M${pt(X(-W + 4), by + 8)}Q${pt(X(0), by - 2)} ${pt(X(W - 4), by + 8)}`,
    k,
    0.8,
  );
  if (!back)
    out += gem(X(0) + side * 3, seat(0) + 4, stage >= 3 ? 4.4 : 3.6, k);
  return out;
}

/** Horns from the sides of the head (or Duskveil's hood). */
function horns(v: View, h: { cx: number; top: number }) {
  const { k, stage, side } = v;
  if (!k.horns) return "";
  const [hx, hy] = k.hornAt ?? [26, 16];
  const sx = side ? 0.72 : 1;
  const g = stage >= 3 ? 1.25 : 1;
  return [-1, 1]
    .map((s) => {
      const bx = h.cx + side * 4 + s * hx * sx,
        by = h.top + hy;
      const X = (d: number) => bx + s * d * sx;
      if (k.horns === "ram")
        // Curling back and down beside the head.
        return (
          line(
            `M${pt(X(-2), by)}Q${pt(X(16), by - 18 * g)} ${pt(X(22 * g), by + 2)}Q${pt(X(22 * g), by + 14 * g)} ${pt(X(12), by + 12 * g)}`,
            INK,
            10.5,
          ) +
          line(
            `M${pt(X(-2), by)}Q${pt(X(16), by - 18 * g)} ${pt(X(22 * g), by + 2)}Q${pt(X(22 * g), by + 14 * g)} ${pt(X(12), by + 12 * g)}`,
            STEEL,
            7.6,
          ) +
          [0.2, 0.4, 0.6]
            .map((t) =>
              line(
                `M${pt(X(4 + t * 22 * g), by - 10 * g * (1 - t) - 1)}l${n(s * sx * 2)} 4`,
                EDGE,
                0.9,
                0.6,
              ),
            )
            .join("") +
          rune(
            `M${pt(X(2), by - 3)}Q${pt(X(15), by - 15 * g)} ${pt(X(20 * g), by + 1)}`,
            k,
            0.8,
          )
        );
      if (k.horns === "spike")
        return (
          spike(
            [X(0), by],
            [X(6 * g), by - 8 * g],
            [X(10 * g), by - 20 * g],
            9,
          ) + rune(`M${pt(X(2), by - 3)}L${pt(X(8 * g), by - 15 * g)}`, k, 0.8)
        );
      // Demon horns: out, then sweeping up.
      return (
        spike(
          [X(0), by],
          [X(18 * g), by - 6 * g],
          [X(14 * g), by - 32 * g],
          10,
        ) +
        rune(
          `M${pt(X(3), by - 2)}Q${pt(X(15 * g), by - 7 * g)} ${pt(X(13 * g), by - 26 * g)}`,
          k,
          0.8,
        )
      );
    })
    .join("");
}

/** A champion's own extra on its face layer. */
function faceExtra(v: View, h: { cx: number; top: number }) {
  const { k, stage, side, back } = v;
  if (back) return "";
  switch (k.extra) {
    case "third-eye": {
      const x = h.cx + side * 6,
        y = h.top + 26;
      return (
        shape(
          `M${pt(x - 9, y)}Q${pt(x, y - 8)} ${pt(x + 9, y)}Q${pt(x, y + 8)} ${pt(x - 9, y)}Z`,
          "#12061a",
          1.3,
        ) +
        `<circle cx="${n(x)}" cy="${n(y)}" r="${stage >= 3 ? 4.2 : 3.4}" fill="${k.rune}" stroke="none"/><circle cx="${n(x)}" cy="${n(y)}" r="1.6" fill="${k.hot}" stroke="none"/>` +
        `<ellipse cx="${n(x)}" cy="${n(y)}" rx="13" ry="9" fill="${k.rune}" opacity=".18" stroke="none"/>`
      );
    }
    case "rift-gem":
      return gem(h.cx + side * 5, h.top + 24, stage >= 3 ? 4.6 : 3.6, k);
  }
  return "";
}

// ---------------------------------------------------------------- the body
/** Paired pieces narrow in profile, as the torso does. */
const P = (v: View, d: number) => 100 + v.side * 5 + d * (v.side ? 0.72 : 1);

/** A plate gorget under the chin; stage II adds spiked pauldrons. */
function gorget(v: View) {
  const { k, stage, side, back } = v;
  const y = k.neck ?? 124;
  let out = "";
  if (stage >= 2)
    for (const s of [-1, 1]) {
      const cx = P(v, s * 30);
      const X = (d: number) => cx + s * d * (side ? 0.72 : 1);
      out +=
        spike([X(2), y - 2], [X(8), y - 10], [X(13), y - 17], 6) +
        spike([X(9), y + 1], [X(15), y - 4], [X(20), y - 8], 5) +
        shape(
          `M${pt(X(-11), y + 1)}Q${pt(X(2), y - 11)} ${pt(X(14), y + 3)}Q${pt(X(13), y + 13)} ${pt(X(-2), y + 13)}Z`,
          PLATE,
        ) +
        line(
          `M${pt(X(-7), y)}Q${pt(X(2), y - 7)} ${pt(X(10), y + 2)}`,
          EDGE,
          0.9,
          0.7,
        ) +
        `<circle cx="${n(X(2))}" cy="${n(y + 5)}" r="2" fill="${k.rune}" stroke="${INK}" stroke-width=".8"/>`;
    }
  out += shape(
    `M${pt(P(v, -28), y)}Q${pt(P(v, 0), y + 11)} ${pt(P(v, 28), y)}L${pt(P(v, 26), y + 9)}Q${pt(P(v, 0), y + 21)} ${pt(P(v, -26), y + 9)}Z`,
  );
  out += line(
    `M${pt(P(v, -25), y + 1.5)}Q${pt(P(v, 0), y + 12)} ${pt(P(v, 25), y + 1.5)}`,
    EDGE,
    0.9,
    0.6,
  );
  out += rune(
    `M${pt(P(v, -22), y + 6)}Q${pt(P(v, 0), y + 16)} ${pt(P(v, 22), y + 6)}`,
    k,
    0.9,
  );
  if (!back)
    out += gem(side ? P(v, side * 16) : 100, y + (side ? 13 : 16), 3.4, k);
  return out;
}

/** A row of hem points between two x positions (a tattered edge). */
function hem(x0: number, x1: number, y: number, teeth: number) {
  return Array.from({ length: teeth * 2 + 1 }, (_, i) => {
    const x = x0 + ((x1 - x0) * i) / (teeth * 2);
    return `L${pt(x, i % 2 ? y - 7 : y + (i % 4 === 0 ? 0 : 1))}`;
  }).join("");
}

/** A tattered cape behind the shoulders (it covers the back from behind). */
function cape(v: View) {
  const { k, side, back } = v;
  if (k.cape === false) return "";
  const y0 = (k.neck ?? 124) - 1,
    y1 = k.cape ?? 170;
  let d: string;
  if (side) {
    const b = -side;
    d = `M${pt(100 + side * 6, y0)}L${pt(100 + b * 18, y0 + 2)}Q${pt(100 + b * 40, (y0 + y1) / 2)} ${pt(100 + b * 44, y1)}${hem(100 + b * 44, 100 + side * 8, y1, 4)}Q${pt(100 + side * 14, y0 + 28)} ${pt(100 + side * 6, y0)}Z`;
  } else {
    const top = back ? 26 : 28,
      low = back ? 40 : 46;
    d = `M${pt(100 - top, y0)}L${pt(100 - low, y1)}${hem(100 - low, 100 + low, y1, 6)}L${pt(100 + top, y0)}Q${pt(100, y0 + 7)} ${pt(100 - top, y0)}Z`;
  }
  let out = shape(d, CLOTH);
  // The lining shows in front, the folds and a sigil from behind.
  if (!back)
    out += `<path d="${d}" fill="${k.rune}" opacity=".16" stroke="none"/>`;
  else {
    const my = (y0 + y1) / 2 + 2;
    out +=
      line(
        `M${pt(84, y0 + 8)}L${pt(76, y1 - 8)}M${pt(116, y0 + 8)}L${pt(124, y1 - 8)}`,
        "#000000",
        2,
        0.35,
      ) +
      rune(
        `M100 ${n(my - 11)}L${pt(106, my)}L100 ${n(my + 11)}L${pt(94, my)}ZM100 ${n(my - 16)}V${n(my + 16)}`,
        k,
        1,
      );
  }
  out += rune(
    back || side
      ? `M${pt(side ? 100 - side * 40 : 100 - 38, y1 - 6)}Q100 ${n(y1 - 2)} ${pt(side ? 100 + side * 6 : 100 + 38, y1 - 6)}`
      : `M${pt(100 - 43, y1 - 6)}L${pt(100 - 30, y1 - 8)}M${pt(100 + 43, y1 - 6)}L${pt(100 + 30, y1 - 8)}`,
    k,
    0.8,
  );
  return out;
}

/** Terradon: obsidian spikes along its shell instead of a cape. */
function shellSpikes(v: View) {
  const { k, side, back } = v;
  if (k.extra !== "shell-spikes") return "";
  const S = (x: number, y: number, ax: number, ay: number, len = 13) =>
    spike(
      [x, y],
      [x + ax * len * 0.5, y + ay * len * 0.5],
      [x + ax * len, y + ay * len],
      8,
      "#14161a",
    ) +
    rune(
      `M${pt(x + ax * 2, y + ay * 2)}L${pt(x + ax * len * 0.7, y + ay * len * 0.7)}`,
      k,
      0.7,
    );
  if (back)
    return [
      [100, 104, 0, -1],
      [80, 112, -0.5, -0.9],
      [120, 112, 0.5, -0.9],
      [66, 130, -0.9, -0.5],
      [134, 130, 0.9, -0.5],
      [90, 136, -0.2, -1],
      [110, 136, 0.2, -1],
    ]
      .map(([x, y, ax, ay]) => S(x, y, ax, ay))
      .join("");
  if (side)
    return [
      [100 - side * 26, 112, -side * 0.6, -0.8],
      [100 - side * 38, 128, -side * 0.9, -0.4],
      [100 - side * 40, 146, -side, 0],
    ]
      .map(([x, y, ax, ay]) => S(x, y, ax, ay))
      .join("");
  return [
    [64, 116, -0.8, -0.6],
    [136, 116, 0.8, -0.6],
    [58, 136, -1, -0.15],
    [142, 136, 1, -0.15],
  ]
    .map(([x, y, ax, ay]) => S(x, y, ax, ay))
    .join("");
}

/** Stage III: four rune swords fanned behind the shoulders. */
function swordFan(v: View) {
  const { k, side } = v;
  const sx = side ? 0.72 : 1;
  const px = 100 - side * 10,
    py = (k.neck ?? 124) + 14;
  const r0 = 24,
    r1 = 78;
  return [-78, -48, 48, 78]
    .map((deg) => {
      const a = (deg * Math.PI) / 180;
      const ux = Math.sin(a) * sx,
        uy = -Math.cos(a);
      const nx = Math.cos(a) * sx,
        ny = Math.sin(a);
      const at = (r: number, w = 0) =>
        pt(px + ux * r + nx * w, py + uy * r + ny * w);
      const blade = `M${at(r0, 3.8)}L${at(r1 - 10, 3.8)}L${at(r1)}L${at(r1 - 10, -3.8)}L${at(r0, -3.8)}Z`;
      return (
        line(`M${at(r0 - 9)}L${at(r0)}`, INK, 4.2) +
        line(`M${at(r0 - 9)}L${at(r0)}`, "#3a2c44", 2.6) +
        shape(blade, "#2c3242", 1.4) +
        `<path d="M${at(r0 + 2, 0)}L${at(r1 - 10, 0)}L${at(r1)}L${at(r1 - 10, 3.8)}L${at(r0 + 2, 3.8)}Z" fill="${EDGE}" opacity=".22" stroke="none"/>` +
        rune(`M${at(r0 + 5)}L${at(r1 - 13)}`, k, 1.1) +
        line(`M${at(r0, 8.5)}L${at(r0, -8.5)}`, INK, 5) +
        line(`M${at(r0, 8)}L${at(r0, -8)}`, PLATE, 2.8) +
        `<circle cx="${at(r0 - 10).split(" ")[0]}" cy="${at(r0 - 10).split(" ")[1]}" r="2.6" fill="${k.rune}" stroke="${INK}" stroke-width="1"/>`
      );
    })
    .join("");
}

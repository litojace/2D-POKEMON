import type { CharacterId } from "@arena/shared";
import { BACK_TRAIT, DESIGNS, backUnder, hatShape, torso, type Design, type Kit } from "./modern-designs";

/**
 * Grand Prix (Epic): one race, a driver of its own for every champion, each
 * in its team's racing suit with a stripe down the front, a checkered band
 * at the shoulder and a number board on the chest whose digits light up in
 * play (lume layers). Headwear tells the drivers apart: an open-face helmet
 * with its visor raised, aviator goggles pushed up, a team cap, or a pit
 * wall headset. Nothing covers the eyes (costume-fit.spec.ts).
 */
type Head = "helmet" | "goggles" | "cap" | "headset";
interface Racer {
  /** The suit, its stripe and trim, the number's light. */
  suit: string;
  stripe: string;
  glow: string;
  number: string;
  head: Head;
  /** Headwear sits this much higher, where the eyes are high on the head. */
  lift?: number;
}
export const RACERS: Record<CharacterId, Racer> = {
  voltkit: { suit: "#2f6fe0", stripe: "#ffd23f", glow: "#fff3a8", number: "7", head: "cap" },
  cindrake: { suit: "#d8262a", stripe: "#ffffff", glow: "#ffd23f", number: "1", head: "helmet" },
  tidefin: { suit: "#0fa3a3", stripe: "#ff7a59", glow: "#bff8ff", number: "11", head: "cap" },
  auralynx: { suit: "#f4f4f8", stripe: "#7a4fd8", glow: "#c9a3ff", number: "3", head: "helmet" },
  lumoth: { suit: "#1f2a44", stripe: "#7dff8a", glow: "#7dff8a", number: "9", head: "goggles" },
  mystowl: { suit: "#5a2f8a", stripe: "#ffd23f", glow: "#ffe08a", number: "22", head: "goggles" },
  terradon: { suit: "#5f6e36", stripe: "#ff9a2e", glow: "#ffd27a", number: "4", head: "goggles" },
  duskveil: { suit: "#22222e", stripe: "#8ff5e6", glow: "#8ff5e6", number: "13", head: "goggles" },
  coilemur: { suit: "#ff8a1f", stripe: "#1f2a44", glow: "#7ff3ff", number: "8", head: "helmet" },
  pyranda: { suit: "#c8402f", stripe: "#f2e2a8", glow: "#ffd23f", number: "5", head: "cap" },
  glacelle: { suit: "#7fc8ff", stripe: "#ffffff", glow: "#e6fbff", number: "10", head: "helmet" },
  halcyra: { suit: "#1f4f6e", stripe: "#ff6a3a", glow: "#ffb347", number: "2", head: "goggles" },
  sunbara: { suit: "#ffb21f", stripe: "#d8262a", glow: "#fff3a8", number: "6", head: "cap" },
  astrabun: { suit: "#ff6fae", stripe: "#ffffff", glow: "#fff3a8", number: "12", head: "helmet" },
  wombolder: { suit: "#3a3a48", stripe: "#d8ff3a", glow: "#d8ff3a", number: "44", head: "goggles", lift: 8 },
  shadopus: { suit: "#14121f", stripe: "#ff4fd8", glow: "#ff4fd8", number: "88", head: "headset" },
  pangrove: { suit: "#1f7a3a", stripe: "#ffd23f", glow: "#e6ff8a", number: "15", head: "goggles" },
  mossloth: { suit: "#8fd0b0", stripe: "#ff8fbe", glow: "#ffffff", number: "0", head: "cap" },
};

const cx = (k: Kit) => k.C + k.side * 3;
const hx = (k: Kit) => k.hx + k.side * 2;
/** Which of a seven-segment digit's segments are lit: a b c d e f g. */
const SEGMENTS: Record<string, string> = {
  "0": "abcdef",
  "1": "bc",
  "2": "abdeg",
  "3": "abcdg",
  "4": "bcfg",
  "5": "acdfg",
  "6": "acdefg",
  "7": "abc",
  "8": "abcdefg",
  "9": "abcdfg",
};
/** A number on an LED board: each digit's segments, w wide and h tall. */
function digits(k: Kit, num: string, x: number, y: number, h: number, color: string, from = 0) {
  const w = h * 0.52,
    gap = h * 0.22,
    t = h * 0.13;
  const total = num.length * w + (num.length - 1) * gap;
  return [...num].map((d, n) => {
    const x0 = x - total / 2 + n * (w + gap),
      y0 = y - h / 2,
      ym = y,
      y1 = y + h / 2;
    const seg: Record<string, string> = {
      a: `M${x0 + t} ${y0}H${x0 + w - t}`,
      b: `M${x0 + w} ${y0 + t}V${ym - t / 2}`,
      c: `M${x0 + w} ${ym + t / 2}V${y1 - t}`,
      d: `M${x0 + t} ${y1}H${x0 + w - t}`,
      e: `M${x0} ${ym + t / 2}V${y1 - t}`,
      f: `M${x0} ${y0 + t}V${ym - t / 2}`,
      g: `M${x0 + t} ${ym}H${x0 + w - t}`,
    };
    const lit = [...(SEGMENTS[d] ?? "")].map((s) => seg[s]).join("");
    return k.lume("chase", k.line(lit, color, t * 1.15), from + n, color);
  }).join("");
}
/** A checkered strip from (x0, y) to (x1, y), two rows of squares. */
function checker(k: Kit, x0: number, x1: number, y: number, s: number) {
  const n = Math.max(2, Math.round((x1 - x0) / s));
  const w = (x1 - x0) / n;
  let out = k.rect(x0, y, x1 - x0, s * 2, 0, "#ffffff", k.ink, 0.5);
  for (let i = 0; i < n; i++) out += k.rect(x0 + i * w, y + (i % 2 ? s : 0), w, s, 0, "#1f1f26", "none", 0);
  return out;
}

function design(id: CharacterId): Design {
  const r = RACERS[id];
  return (k) => {
    const board = (x: number, y: number, h: number) =>
      k.rect(x - h * 0.9 - (r.number.length - 1) * h * 0.37, y - h * 0.75, h * 1.8 + (r.number.length - 1) * h * 0.74, h * 1.5, 2, "#15151c", k.ink, 0.7) +
      digits(k, r.number, x, y, h, r.glow);
    if (k.back) {
      // The back: the stripe, the checkered shoulders and a big number, lit.
      // The suit goes under what the champion carries on its back; the
      // number shows over it: bolted to a shell or a boulder like a car's,
      // and a small bib high between the shoulders above wings, moss,
      // leaves or a cotton tail.
      backUnder(k, r.suit,
        k.rect(k.C - 4, k.T - 2, 8, k.B - k.T + 4, 0, r.stripe, "none", 0) +
          checker(k, k.C - k.W, k.C + k.W, k.T + 1, 2.6));
      const trait = BACK_TRAIT[id];
      if (trait?.kind === "shell" || trait?.kind === "rock") {
        const [, y0, , y1] = trait.box;
        k.put("scarf", k.rect(k.C - 4, y0 + 8, 8, y1 - y0 - 16, 2, r.stripe, k.ink, 0.6) + board(k.C, y0 + (y1 - y0) * 0.45, 13));
      } else k.put("scarf", trait ? board(k.C, k.T + 9, 10) : board(k.C, k.T + 20, 15));
    } else {
      const c = cx(k);
      k.put("body", torso(k, r.suit,
        k.rect(c - 3.5, k.T - 2, 7, k.B - k.T + 6, 0, r.stripe, "none", 0) +
          checker(k, k.L - 2, k.R + 2, k.T - 1, 2.4) +
          // A zip, a belt and the number board on the chest.
          k.line(`M${c} ${k.T + 5}V${k.B + 3}`, k.ink, 0.6) +
          k.rect(k.L - 2, k.B - 9, k.R - k.L + 4, 4, 0, "#2a2a36", "none", 0) +
          board(c + (k.side ? k.side * 4 : 0), k.T + 17, k.side ? 9 : 11)));
    }
    const x = hx(k),
      y = k.ht + 14 - (r.lift ?? 0);
    switch (r.head) {
      case "helmet": {
        // An open-face helmet: the shell over the head-top, ending above the
        // eyes, a stripe over the crown, the visor raised on top.
        const w = k.side ? 36 : 42;
        const shell = k.path(`M${x - w} ${y + 4}Q${x - w - 2} ${y - 34} ${x} ${y - 36}Q${x + w + 2} ${y - 34} ${x + w} ${y + 4}Q${x} ${y - 6} ${x - w} ${y + 4}Z`, r.suit);
        const stripe = k.line(`M${x} ${y - 36}Q${x + (k.side ? k.side * 6 : 0)} ${y - 18} ${x} ${y - 3}`, r.stripe, 5);
        const visor = k.back ? "" : k.path(`M${x - w + 6} ${y - 18}Q${x} ${y - 30} ${x + w - 6} ${y - 18}L${x + w - 8} ${y - 10}Q${x} ${y - 20} ${x - w + 8} ${y - 10}Z`, "#3a5a8acc", k.ink, 0.8);
        const shine = k.back ? "" : k.line(`M${x - w + 14} ${y - 20}Q${x - 8} ${y - 26} ${x + 4} ${y - 25}`, "#ffffffaa", 1.4);
        k.put("flame", shell + stripe + visor + shine + k.line(`M${x - w} ${y + 3}Q${x} ${y - 7} ${x + w} ${y + 3}`, r.stripe, 1.6));
        break;
      }
      case "goggles": {
        // Aviator goggles pushed up on a padded band, above the eyes.
        const span = k.side ? 0 : 19;
        const lens = (gx: number) => k.circle(gx, y - 4, 10, "#c8b080") + k.circle(gx, y - 4, 7.4, "#3a6a8a", k.ink, 0.6) + k.lume("twinkle", k.line(`M${gx - 3} ${y - 6}L${gx - 1} ${y - 8}`, "#ffffff", 1.4), 0, "#ffffff");
        const strap = k.back
          ? k.line(`M${x - 44} ${y + 2}Q${x} ${y + 8} ${x + 44} ${y + 2}`, "#5a3a24", 4)
          : k.line(k.side ? `M${x + k.side * 6} ${y - 4}Q${x - k.side * 14} ${y - 8} ${x - k.side * 30} ${y + 6}` : `M${x - 44} ${y + 2}Q${x} ${y - 10} ${x + 44} ${y + 2}`, "#5a3a24", 4);
        k.put("flame", strap + (k.back ? "" : k.side ? lens(x + k.side * 8) : lens(x - span) + lens(x + span) + k.line(`M${x - span + 8} ${y - 4}H${x + span - 8}`, "#c8b080", 2)));
        break;
      }
      case "cap":
        // A team cap: the crown in the suit's colour, a stripe, the bill.
        k.put("flame", hatShape(k, 39, 27, y, r.suit, r.stripe, 1.25) + k.line(`M${x - 23} ${y - 7}Q${x} ${y - 2} ${x + 23} ${y - 7}`, r.stripe, 2.8) +
          (k.back ? "" : k.lume("pulse", k.path(k.star(x + (k.side ? k.side * 7 : 0), y - 17, 5, 5), r.glow, k.ink, 0.5), 2, r.glow)));
        break;
      case "headset": {
        // A pit-wall headset: big cups, a band, a boom mic, a lit cup ring.
        const ey = k.ht + 44,
          span = 46;
        const cup = (c: number, i: number) => k.circle(c, ey, 10, "#2a2a36") + k.lume("pulse", `<circle cx="${c}" cy="${ey}" r="7.6" fill="none" stroke="${r.glow}" stroke-width="1.6"/>`, i, r.glow);
        if (k.side) {
          const e = k.hx - k.side * 16;
          k.put("flame", k.line(`M${e} ${ey - 9}Q${e - k.side * 4} ${k.ht} ${e + k.side * 18} ${k.ht + 2}`, "#2a2a36", 4) + cup(e, 0) +
            k.line(`M${e} ${ey + 8}Q${e + k.side * 6} ${ey + 22} ${e + k.side * 24} ${ey + 24}`, "#2a2a36", 1.6));
        } else
          k.put("flame", k.line(`M${k.hx - span} ${ey - 8}C${k.hx - span} ${k.ht - 16} ${k.hx + span} ${k.ht - 16} ${k.hx + span} ${ey - 8}`, "#2a2a36", 4) + cup(k.hx - span, 0) + cup(k.hx + span, 1) +
            (k.back ? "" : k.line(`M${k.hx - span} ${ey + 8}Q${k.hx - span + 6} ${ey + 24} ${k.hx - span + 26} ${ey + 26}`, "#2a2a36", 1.6)));
        break;
      }
    }
  };
}

Object.assign((DESIGNS.racing ??= {}), Object.fromEntries((Object.keys(RACERS) as CharacterId[]).map((id) => [id, design(id)])));

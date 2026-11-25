import type { CharacterId } from "@arena/shared";
import { BACK_TRAIT, DESIGNS, backUnder, hatShape, torso, type Design, type Kit } from "./modern-designs";

/**
 * Rainy Day (Rare): a raincoat for every champion and its own way of keeping
 * dry: a sou'wester, a bucket hat, a frog hat, a duck cap, a little
 * umbrella worn as a hat, or something held overhead on a pole (an
 * umbrella, a lotus leaf, a toadstool). Nothing here gives off light: a
 * Rare draws nothing at rest (no lume layers).
 */
interface Rain {
  /** The raincoat and its trim (toggles, pocket, hat band). */
  coat: string;
  trim: string;
  /** Polka dots on the coat, in the trim's colour. */
  dots?: boolean;
  keep: "souwester" | "bucket" | "frog" | "duck" | "brolly-hat" | "umbrella" | "leaf" | "toadstool" | "leaf-hat";
  /** A second colour for the hat or canopy (stripes, panels, spots). */
  second?: string;
  /** Headwear sits this much higher, where the eyes are high on the head. */
  lift?: number;
}
export const RAIN: Record<CharacterId, Rain> = {
  voltkit: { coat: "#ffd23f", trim: "#2f6fb8", keep: "souwester" },
  cindrake: { coat: "#d8342c", trim: "#ffe9b0", keep: "umbrella", second: "#ffb347" },
  tidefin: { coat: "#3f8fe0", trim: "#ffffff", dots: true, keep: "umbrella", second: "#ffffff" },
  auralynx: { coat: "#b79af0", trim: "#fff3a8", keep: "brolly-hat", second: "#f4eaff" },
  lumoth: { coat: "#9fe0c0", trim: "#ffffff", keep: "leaf" },
  mystowl: { coat: "#27376b", trim: "#f2c14e", keep: "souwester" },
  terradon: { coat: "#5fae5a", trim: "#fff3c4", keep: "leaf" },
  duskveil: { coat: "#8a90a6", trim: "#2b2f3d", keep: "umbrella", second: "#3a3f52" },
  coilemur: { coat: "#ff8a3a", trim: "#fff3d6", keep: "bucket", second: "#ffffff" },
  pyranda: { coat: "#e8443a", trim: "#ffd23f", keep: "duck" },
  glacelle: { coat: "#ffc2dc", trim: "#ffffff", dots: true, keep: "brolly-hat", second: "#ff8fbe" },
  halcyra: { coat: "#1fa7a0", trim: "#ffd23f", keep: "souwester" },
  sunbara: { coat: "#ffd23f", trim: "#3f9a4a", keep: "frog" },
  astrabun: { coat: "#ff8fbe", trim: "#ffffff", dots: true, keep: "umbrella", second: "#ffffff" },
  wombolder: { coat: "#7a8a4a", trim: "#f2e2a8", keep: "bucket", second: "#5f6e36", lift: 8 },
  shadopus: { coat: "#7a5ad8", trim: "#ffd23f", keep: "brolly-hat", second: "#ffd23f" },
  pangrove: { coat: "#f2e2a8", trim: "#c8402f", keep: "toadstool" },
  mossloth: { coat: "#8fc7e8", trim: "#fff6ea", keep: "leaf-hat" },
};

const cx = (k: Kit) => k.C + k.side * 3;
const hx = (k: Kit) => k.hx + k.side * 2;
/**
 * Something held up on a pole over a shoulder: an umbrella, a leaf, a
 * toadstool. From the front it is held high at C + 40, above the head and
 * closer in than modern-designs' onPole (C + 64), so a canopy 32 across
 * each side shows over the head and stays inside the crops play draws it
 * from (costume-fit.spec.ts); the pole ends under the middle of what it
 * holds.
 */
function held(k: Kit, item: (x: number, y: number) => string) {
  const s = k.side ? -k.side : 1;
  if (k.back) {
    const x = k.C - s * 34,
      y = k.T - 34;
    k.put("scarf", k.line(`M${k.C + s * 10} ${k.B - 4}L${x} ${y + 12}`, "#7a5a3a", 2.2) + item(x, y));
  } else {
    // Held high, so the canopy shows above the head rather than behind it.
    const x = k.C + s * (k.side ? 24 : 40),
      y = k.T - 86;
    // The pole on the body, behind it; what it holds on the head-top layer,
    // over a crest, tall ears or a hood, whose crop has room above the head.
    k.put("body", k.line(`M${k.C + s * 12} ${k.B - 6}L${x} ${y + 12}`, "#7a5a3a", 2.2), true);
    k.put("flame", item(x, y));
  }
}
/** A drop of rain, its point up. */
const drop = (k: Kit, x: number, y: number, s = 1) =>
  k.path(`M${x} ${y - 4 * s}Q${x + 3.4 * s} ${y + 1.2 * s} ${x} ${y + 2.6 * s}Q${x - 3.4 * s} ${y + 1.2 * s} ${x} ${y - 4 * s}Z`, "#bfe8ff", "#5a9ad8", 0.6);
/** An umbrella's canopy, r across each side, scalloped along its lower edge. */
function canopy(k: Kit, x: number, y: number, r: number, a: string, b: string) {
  const n = 4,
    w = (2 * r) / n;
  let edge = "";
  for (let i = 0; i < n; i++) edge += `q${-w / 2} ${-4} ${-w} 0`;
  return (
    k.path(`M${x - r} ${y}Q${x - r} ${y - r * 0.95} ${x} ${y - r}Q${x + r} ${y - r * 0.95} ${x + r} ${y}${edge}Z`, a) +
    // Two panels in the second colour, and the ribs between them.
    k.path(`M${x - w} ${y - 1.4}Q${x - w * 0.9} ${y - r * 0.82} ${x} ${y - r}Q${x - w * 0.1} ${y - r * 0.5} ${x} ${y - 1.4}q${-w / 2} ${-4} ${-w} 0Z`, b, "none", 0) +
    k.line(`M${x} ${y - r}V${y - 2}M${x} ${y - r}Q${x - w * 0.95} ${y - r * 0.8} ${x - w} ${y - 2}M${x} ${y - r}Q${x + w * 0.95} ${y - r * 0.8} ${x + w} ${y - 2}`, k.ink, 0.7) +
    k.path(`M${x - 1.2} ${y - r}V${y - r - 4}H${x + 1.2}V${y - r}Z`, b, k.ink, 0.6)
  );
}
/** A broad leaf held stem-down, its tip to one side, a drop hanging from it. */
const leaf = (k: Kit, x: number, y: number, r: number) =>
  k.path(`M${x - r} ${y - 2}Q${x - r * 0.6} ${y - r * 0.9} ${x + r * 0.2} ${y - r * 0.8}Q${x + r} ${y - r * 0.6} ${x + r * 1.15} ${y + 2}Q${x + r * 0.3} ${y - 4} ${x - r} ${y - 2}Z`, "#5fbf5a", "#2f6b2f", 1) +
  k.line(`M${x - r * 0.9} ${y - 3}Q${x} ${y - r * 0.62} ${x + r * 1.05} ${y}`, "#2f6b2f", 0.8) +
  k.line(`M${x - r * 0.3} ${y - r * 0.42}l${-r * 0.18} ${-r * 0.3}M${x + r * 0.25} ${y - r * 0.42}l${r * 0.05} ${-r * 0.32}M${x + r * 0.7} ${y - r * 0.22}l${r * 0.16} ${-r * 0.24}`, "#2f6b2f", 0.6) +
  drop(k, x + r * 1.1, y + 7, 0.8);

function design(id: CharacterId): Design {
  const look = RAIN[id];
  return (k) => {
    const { coat, trim } = look;
    const second = look.second ?? trim;
    const dots = (x0: number, x1: number) =>
      look.dots ? [0, 1, 2, 3, 4, 5, 6, 7].map((i) => k.circle(x0 + 4 + ((i * 9.7) % (x1 - x0 - 8)), k.T + 6 + ((i * 7.3) % 30), 1.5, trim, "none", 0)).join("") : "";
    // The raincoat: a flap down the front with toggles, a pocket, a dry hem.
    if (k.back) {
      // The raincoat goes under what the champion carries on its back (a
      // shell, a boulder, folded wings, moss, leaves): the rain beads on
      // those instead, one drop catching the light.
      backUnder(k, coat, dots(k.C - k.W, k.C + k.W) + k.path(`M${k.C - 11} ${k.T + 1}Q${k.C} ${k.T + 15} ${k.C + 11} ${k.T + 1}Q${k.C} ${k.T + 6} ${k.C - 11} ${k.T + 1}Z`, coat, k.ink, 0.8) + k.line(`M${k.C - k.W} ${k.B - 2}H${k.C + k.W}`, trim, 1.6));
      const trait = BACK_TRAIT[id];
      if (trait && trait.kind !== "tail") {
        const [x0, y0, x1, y1] = trait.box;
        const at = (u: number, v: number) => [x0 + (x1 - x0) * u, y0 + (y1 - y0) * v] as const;
        const beads = ([[0.3, 0.35, 1.1], [0.62, 0.5, 1.3], [0.45, 0.72, 1]] as const).map(([u, v, sc], i) => {
          const [x, y] = at(u, v);
          const d = drop(k, x, y, sc);
          return i === 1 ? k.lume("twinkle", d + k.circle(x - 0.8, y - 0.6, 0.7, "#ffffff", "none", 0), 0, "#e6f6ff") : d;
        });
        k.put("scarf", beads.join(""));
      }
    }
    else {
      const c = cx(k);
      k.put("body", torso(k, coat,
        dots(k.L, k.R) +
          k.path(`M${c - 9} ${k.T - 2}Q${c} ${k.T + 5} ${c + 9} ${k.T - 2}L${c + 9} ${k.T + 3}Q${c} ${k.T + 10} ${c - 9} ${k.T + 3}Z`, trim, k.ink, 0.6) +
          k.line(`M${c} ${k.T + 7}V${k.B + 3}`, k.ink, 0.6) +
          [0, 1, 2].map((i) => k.rect(c - 3.4, k.T + 12 + i * 7.5, 6.8, 2.6, 1.3, trim, k.ink, 0.5)).join("") +
          k.rect(c + (k.side ? k.side * 6 : 7), k.B - 13, 8, 6, 1.5, coat, k.ink, 0.6) +
          k.line(`M${k.L} ${k.B - 2}H${k.R}`, trim, 1.6)));
    }
    const x = hx(k),
      y = k.ht + 14 - (look.lift ?? 0);
    switch (look.keep) {
      case "souwester": {
        // The fisherman's hat: a long brim at the back to shed the rain.
        const tail = k.back ? k.path(`M${x - 34} ${y}Q${x} ${y + 22} ${x + 34} ${y}Q${x} ${y + 6} ${x - 34} ${y}Z`, coat) : k.side ? k.path(`M${x - k.side * 6} ${y + 1}Q${x - k.side * 40} ${y + 4} ${x - k.side * 48} ${y + 14}Q${x - k.side * 30} ${y + 12} ${x - k.side * 8} ${y + 6}Z`, coat) : "";
        k.put("flame", tail + hatShape(k, 34, 24, y, coat, coat, 1.3) + k.line(`M${x - 21} ${y - 5}Q${x} ${y - 1} ${x + 21} ${y - 5}`, trim, 2.6) + (k.back ? "" : drop(k, x + (k.side ? -k.side * 40 : 46), y + 12)));
        break;
      }
      case "bucket":
        k.put("flame", hatShape(k, 33, 23, y, coat, coat, 1.22) + k.line(`M${x - 20} ${y - 6}Q${x} ${y - 2} ${x + 20} ${y - 6}`, second, 2.4) + k.line(`M${x - 20} ${y - 13}Q${x} ${y - 9} ${x + 20} ${y - 13}`, second, 2.4) + (k.back ? "" : drop(k, x + (k.side ? -k.side * 38 : -44), y + 10)));
        break;
      case "frog": {
        // A frog's face on a rain hat: two eyes on top, a wide smile.
        const frog = "#5fbf5a";
        const eye = (ex: number, open: boolean) => k.circle(ex, y - 23, 7.4, frog) + (open ? k.circle(ex, y - 24, 4.6, "#ffffff") + k.circle(ex, y - 24, 2.2, "#1f2a1f", "none", 0) : "");
        k.put("flame", (k.side ? eye(x + k.side * 8, true) : eye(x - 15, !k.back) + eye(x + 15, !k.back)) + hatShape(k, 33, 23, y, frog, frog, 1.22) +
          (k.back ? "" : k.line(k.side ? `M${x + k.side * 6} ${y - 7}Q${x + k.side * 16} ${y - 3} ${x + k.side * 24} ${y - 8}` : `M${x - 13} ${y - 8}Q${x} ${y - 2} ${x + 13} ${y - 8}`, "#2f6b2f", 1.4) + (k.side ? "" : k.circle(x - 19, y - 8, 2.2, "#ff9ab0", "none", 0) + k.circle(x + 19, y - 8, 2.2, "#ff9ab0", "none", 0))));
        break;
      }
      case "duck": {
        // A duck cap: a round yellow crown, bead eyes and an orange bill.
        const w = k.side ? 33 : 38,
          yellow = "#ffd23f";
        const crown = k.path(`M${x - w} ${y}Q${x - w} ${y - 28} ${x} ${y - 29}Q${x + w} ${y - 28} ${x + w} ${y}Q${x} ${y - 7} ${x - w} ${y}Z`, yellow);
        const bill = k.back ? "" : k.side
          ? k.path(`M${x + k.side * w * 0.55} ${y - 8}Q${x + k.side * (w + 16)} ${y - 9} ${x + k.side * (w + 15)} ${y - 3}Q${x + k.side * (w + 2)} ${y + 1} ${x + k.side * w * 0.55} ${y - 1}Z`, "#ff8a2a")
          : k.path(`M${x - 11} ${y - 7}Q${x} ${y - 12} ${x + 11} ${y - 7}Q${x} ${y + 3} ${x - 11} ${y - 7}Z`, "#ff8a2a");
        const eyes = k.back ? "" : k.side ? k.circle(x + k.side * 12, y - 17, 2, "#1f1f2a", "none", 0) : k.circle(x - 12, y - 17, 2, "#1f1f2a", "none", 0) + k.circle(x + 12, y - 17, 2, "#1f1f2a", "none", 0);
        k.put("flame", crown + eyes + bill + k.path(`M${x - 3} ${y - 29}q-3 -8 3 -9q4 3 0 9Z`, yellow));
        break;
      }
      case "brolly-hat":
        // A little umbrella worn on the head, its handle tucked away.
        k.put("flame", canopy(k, x, y + 2, k.side ? 30 : 34, coat, second) + (k.back ? "" : drop(k, x + (k.side ? -k.side * 36 : 40), y + 12)));
        break;
      case "umbrella":
        // Resting on the shoulder, its canopy behind the head.
        held(k, (px, py) => canopy(k, px, py + 14, 32, coat, second) + drop(k, px - 34, py + 22) + drop(k, px + 30, py + 24, 0.8));
        break;
      case "leaf":
        held(k, (px, py) => leaf(k, px - 4, py + 14, 30));
        break;
      case "toadstool":
        // A toadstool for an umbrella: a red cap with white spots.
        held(k, (px, py) =>
          `<g transform="translate(${px} ${py + 14}) scale(1.4) translate(${-px} ${-(py + 12)})">` +
            k.path(`M${px - 25} ${py + 12}Q${px - 24} ${py - 12} ${px} ${py - 13}Q${px + 24} ${py - 12} ${px + 25} ${py + 12}Q${px} ${py + 6} ${px - 25} ${py + 12}Z`, "#d8342c") +
            k.circle(px - 11, py - 1, 4, "#fff6ea", "none", 0) + k.circle(px + 8, py - 5, 3.2, "#fff6ea", "none", 0) + k.circle(px + 14, py + 4, 2.4, "#fff6ea", "none", 0) + k.circle(px - 2, py + 5, 2.2, "#fff6ea", "none", 0) +
            "</g>" + drop(k, px - 36, py + 24, 0.9));
        break;
      case "leaf-hat":
        // A big leaf laid over the head, its stem curling up.
        k.put("flame", k.path(`M${x - 42} ${y + 4}Q${x - 30} ${y - 26} ${x + 4} ${y - 26}Q${x + 40} ${y - 24} ${x + 46} ${y + 6}Q${x + 6} ${y - 8} ${x - 42} ${y + 4}Z`, "#5fbf5a", "#2f6b2f", 1.1) +
          k.line(`M${x - 38} ${y + 1}Q${x} ${y - 20} ${x + 42} ${y + 3}`, "#2f6b2f", 0.9) + k.line(`M${x - 40} ${y + 3}q-8 -4 -7 -12`, "#2f6b2f", 2.2) +
          (k.back ? "" : drop(k, x + 46, y + 14)));
        break;
    }
  };
}

Object.assign((DESIGNS.rain ??= {}), Object.fromEntries((Object.keys(RAIN) as CharacterId[]).map((id) => [id, design(id)])));

import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { Palette } from "./skin-art";
import { fashionCut } from "./fashion-fits";
import { cutBox, UNDER } from "./rare-fashion";

/**
 * Sky Pirates, the second Legendary collection: a crew of sky-pirate
 * captains. The silhouette is the tricorne (the one shape that reads at
 * battle size under a chibi head) and a captain's coat: gold-trimmed, double
 * buttoned, a red sash and buckle, a frilled shirt at the neck and a cutlass
 * at the hip. Each captain has their own coat colour and hat plume.
 *
 * Pieces sit on parts the rig keeps steady (body, flame) and are fitted to
 * the champion's torso cut and head anchor in every facing. From behind,
 * shells and glider membranes cover the body, so the coat's back and tails
 * go on the scarf part, painted last there (as in rare-fashion.ts).
 */
export const PIRATE_STYLE: Record<
  CharacterId,
  { coat: string; plume: string; hat?: number; lift?: number }
> = {
  // coat colour, plume colour, hat scale and how far it sits down the head.
  voltkit: { coat: "#2c4f8c", plume: "#ffd65b" },
  cindrake: { coat: "#8c2f2c", plume: "#ffb347", hat: 0.9, lift: 6 },
  tidefin: { coat: "#1f5a6e", plume: "#ff8fb8" },
  auralynx: { coat: "#4a3b8c", plume: "#bfe8ff" },
  lumoth: { coat: "#2f6b4f", plume: "#fff3b0", hat: 0.9 },
  mystowl: { coat: "#5a2f6e", plume: "#ffe19a", hat: 0.95 },
  terradon: { coat: "#5b4a2c", plume: "#9fe08a" },
  duskveil: { coat: "#2a2448", plume: "#8ff5e6", hat: 0.85 },
  coilemur: { coat: "#8c5a1f", plume: "#7ff3ff" },
  pyranda: { coat: "#6e1f2c", plume: "#ffd27a" },
  glacelle: { coat: "#2c5f8c", plume: "#ffffff", hat: 0.9 },
  halcyra: { coat: "#1f4f6e", plume: "#ff8a5c", hat: 0.9, lift: 4 },
  sunbara: { coat: "#a5582c", plume: "#ffcf4d" },
  astrabun: { coat: "#3b3f8c", plume: "#fff3c4", hat: 0.9 },
  wombolder: { coat: "#4a4a5a", plume: "#ff6a5a" },
  shadopus: { coat: "#3a2c6e", plume: "#ff8fd0" },
  pangrove: { coat: "#5a3a1f", plume: "#ff8fb8", hat: 0.9, lift: 4 },
  mossloth: { coat: "#6e5a3a", plume: "#c9a3e7" },
};

export function pirateOutfit(
  id: CharacterId,
  dir: Facing,
  p: Palette,
  head: { cx: number; top: number },
): [CreaturePart, string][] {
  const style = PIRATE_STYLE[id];
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const back = dir === "up";
  const bx = 100 + side * 7;
  const cut = fashionCut(id, dir, "wayfarer");
  const box = cutBox(cut);
  const L = bx + box.x0,
    R = bx + box.x1,
    T = box.y0,
    B = box.y1,
    W = (R - L) / 2,
    C = (L + R) / 2;
  const ink = p.dark,
    gold = "#e6c46a",
    goldDark = "#a8823a",
    sash = "#c8323a",
    shirt = "#fbf3e2",
    felt = "#24202e";
  const out: [CreaturePart, string][] = [];
  const put = (part: CreaturePart, svg: string, under = false) =>
    out.push([
      part,
      (under ? UNDER : "") +
        `<g class="fashion-signature sky-pirates" data-champion="${id}" data-view="${dir}">${svg}</g>`,
    ]);
  const path = (d: string, fill: string, stroke = ink, sw = 1.1) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const line = (d: string, color: string, sw = 1.1) => path(d, "none", color, sw);
  const circle = (x: number, y: number, r: number, fill: string, stroke = ink, sw = 0.7) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke = ink, sw = 1.1) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;

  // ---- The coat, clipped to the champion's own torso cut.
  const clipId = `pirate-${id}-${dir}`;
  const coatBody = (svg: string) =>
    `<defs><clipPath id="${clipId}"><path d="${cut}" transform="translate(${bx} 0)"/></clipPath></defs><g clip-path="url(#${clipId})">${svg}</g>` +
    path(cut, "none", ink, 1.2).replace("<path", `<path transform="translate(${bx} 0)"`);
  const sashY = T + (B - T) * 0.56;
  if (back) {
    // From behind: the coat's back with a centre vent and split tails, over
    // any shell or membrane, so it goes on the scarf part.
    put(
      "scarf",
      path(`M${C - W - 2} ${T + 1}Q${C} ${T - 4} ${C + W + 2} ${T + 1}L${C + W + 4} ${B + 4}L${C + 2} ${B - 2}L${C} ${B + 6}L${C - 2} ${B - 2}L${C - W - 4} ${B + 4}Z`, style.coat) +
        line(`M${C} ${sashY + 4}V${B + 4}`, ink, 0.9) +
        rect(C - W - 2, sashY - 3.5, W * 2 + 4, 7, 2, sash) +
        line(`M${C - W} ${T + 3}Q${C} ${T - 1} ${C + W} ${T + 3}`, gold, 1.4) +
        [-1, 1].map((s) => circle(C + s * 5, sashY + 9, 1.4, gold, goldDark, 0.5)).join(""),
    );
  } else {
    put(
      "body",
      coatBody(
        rect(L - 2, T - 2, R - L + 4, B - T + 6, 0, style.coat, "none") +
          // Frilled shirt and lapels at the neck.
          (side
            ? path(`M${C + side * 2} ${T - 1}l${side * 8} 0l${-side * 5} 12Z`, shirt, ink, 0.8)
            : path(`M${C - 9} ${T - 1}L${C} ${T + 13}L${C + 9} ${T - 1}Z`, shirt, ink, 0.8) +
              [0, 1, 2].map((i) => path(`M${C - 3} ${T + 2 + i * 3.5}q3 2 6 0`, "none", "#d9cdb4", 0.8)).join("") +
              path(`M${C - 9} ${T - 1}L${C - 3} ${T + 12}L${C - 13} ${T + 9}Z`, style.coat, gold, 1) +
              path(`M${C + 9} ${T - 1}L${C + 3} ${T + 12}L${C + 13} ${T + 9}Z`, style.coat, gold, 1)) +
          // Double row of gold buttons.
          (side
            ? [0, 1].map((i) => circle(C + side * 6, T + 15 + i * 6, 1.4, gold, goldDark, 0.5)).join("")
            : [-1, 1].flatMap((s) => [0, 1].map((i) => circle(C + s * 6, T + 15 + i * 6, 1.3, gold, goldDark, 0.5))).join("")) +
          // Red sash with a gold buckle, and a gold hem.
          rect(L - 2, sashY - 3.5, R - L + 4, 7, 0, sash) +
          rect(C + (side ? side * 3 : 0) - 3.5, sashY - 3, 7, 6, 1, gold, goldDark, 0.7) +
          line(`M${L} ${B - 1.5}H${R}`, gold, 1.6),
      ),
    );
    // The sash's knotted tails hang at one hip; a cutlass rides the other.
    const ts = side ? -side : -1;
    put(
      "body",
      path(`M${C + ts * (W - 3)} ${sashY + 2}l${ts * 3} 11l${ts * 4} -1l${-ts * 2} -10Z`, sash, ink, 0.8),
    );
    {
      const hs = side ? -side : 1;
      const hx = C + hs * (W + 1);
      put(
        "body",
        // Scabbard behind the coat edge, guard and grip on top.
        path(`M${hx} ${sashY + 1}l${hs * 5} 16l${hs * 2} -1l${-hs * 4} -15Z`, "#3a2a1c", ink, 0.8) +
          path(`M${hx - 3} ${sashY - 1}q3 -4 6 0q-3 3 -6 0Z`, gold, goldDark, 0.6) +
          line(`M${hx} ${sashY - 2}l${-hs * 1} -5`, "#5a3a22", 2),
        true,
      );
    }
  }

  // ---- The tricorne, on the flame (head-top) part. A chibi head is about
  // 90 art units wide, so the hat spans most of it and its crown rises above.
  const k = style.hat ?? 1;
  const x = head.cx,
    y = Math.max(head.top, 16) + 13 + (style.lift ?? 0);
  const w = 45 * k,
    h = 24 * k;
  // An ostrich plume: a broad, curling feather with a quill and barbs.
  const plume = (px: number, py: number, s: number) =>
    path(`M${px} ${py}C${px + s * 4} ${py - 6} ${px + s * 16} ${py - 10} ${px + s * 17} ${py - 22}C${px + s * 12} ${py - 20} ${px + s * 6} ${py - 18} ${px + s * 2} ${py - 12}C${px - s * 1} ${py - 8} ${px - s * 2} ${py - 4} ${px} ${py}Z`, style.plume, ink, 0.8) +
    line(`M${px} ${py}C${px + s * 5} ${py - 7} ${px + s * 12} ${py - 12} ${px + s * 16} ${py - 21}`, "#ffffff", 0.7) +
    [0.35, 0.55, 0.75].map((u) => line(`M${px + s * 16 * u} ${py - 21 * u}l${-s * 3} ${-2 + u * 2}`, ink, 0.5)).join("");
  let hat: string;
  if (side) {
    // Profile: the crown, and the brim's front corner pointing the way the
    // captain faces, its back corner turned up behind.
    const f = side;
    hat =
      path(`M${x - f * w * 0.45} ${y - h * 0.3}Q${x - f * w * 0.4} ${y - h * 1.3} ${x + f * w * 0.1} ${y - h * 1.3}Q${x + f * w * 0.5} ${y - h * 1.25} ${x + f * w * 0.45} ${y - h * 0.3}Z`, felt) +
      path(`M${x - f * w * 0.8} ${y - h * 0.85}Q${x - f * w * 0.55} ${y - h * 0.2} ${x} ${y + 3}L${x + f * w * 0.95} ${y - h * 0.15}Q${x + f * w * 0.45} ${y - h * 0.55} ${x} ${y - h * 0.55}Q${x - f * w * 0.45} ${y - h * 0.55} ${x - f * w * 0.8} ${y - h * 0.85}Z`, felt) +
      line(`M${x - f * w * 0.8} ${y - h * 0.85}Q${x - f * w * 0.45} ${y - h * 0.55} ${x} ${y - h * 0.55}Q${x + f * w * 0.45} ${y - h * 0.55} ${x + f * w * 0.95} ${y - h * 0.15}`, gold, 1.5) +
      plume(x - f * w * 0.35, y - h * 0.95, -f);
  } else {
    // Front (and back): the crown behind a brim turned up into a V-shaped
    // flap, its two side corners cocked up and out, a gold edge along it.
    const crown = path(`M${x - w * 0.55} ${y - h * 0.4}Q${x - w * 0.5} ${y - h * 1.38} ${x} ${y - h * 1.38}Q${x + w * 0.5} ${y - h * 1.38} ${x + w * 0.55} ${y - h * 0.4}Z`, felt);
    const flapTop = `M${x - w} ${y - h * 0.72}Q${x - w * 0.6} ${y - h * 0.78} ${x - w * 0.3} ${y - h * 0.98}Q${x} ${y - h * 0.5} ${x + w * 0.3} ${y - h * 0.98}Q${x + w * 0.6} ${y - h * 0.78} ${x + w} ${y - h * 0.72}`;
    const flap = path(`${flapTop}Q${x + w * 0.55} ${y + 1} ${x} ${y + 5}Q${x - w * 0.55} ${y + 1} ${x - w} ${y - h * 0.72}Z`, felt);
    hat =
      crown +
      // A soft highlight on the felt.
      path(`M${x - w * 0.35} ${y - h * 1.1}Q${x - w * 0.1} ${y - h * 1.32} ${x + w * 0.15} ${y - h * 1.28}`, "none", "#5a5468", 2) +
      // A band of the captain's colour round the crown.
      path(`M${x - w * 0.53} ${y - h * 0.62}Q${x} ${y - h * 0.75} ${x + w * 0.53} ${y - h * 0.62}L${x + w * 0.54} ${y - h * 0.48}Q${x} ${y - h * 0.6} ${x - w * 0.54} ${y - h * 0.48}Z`, style.coat, ink, 0.6) +
      flap +
      line(flapTop, gold, 1.6) +
      (back
        ? plume(x - w * 0.45, y - h * 0.95, -1)
        : // A gold compass-rose emblem at the front, a plume over a corner.
          circle(x, y - h * 0.2, 4.2 * k, gold, goldDark, 0.6) +
          path(`M${x} ${y - h * 0.2 - 3.8 * k}L${x + 1.2 * k} ${y - h * 0.2}L${x} ${y - h * 0.2 + 3.8 * k}L${x - 1.2 * k} ${y - h * 0.2}Z`, "#fff3c4", "none") +
          path(`M${x - 3.8 * k} ${y - h * 0.2}L${x} ${y - h * 0.2 - 1.2 * k}L${x + 3.8 * k} ${y - h * 0.2}L${x} ${y - h * 0.2 + 1.2 * k}Z`, "#fff3c4", "none") +
          plume(x + w * 0.5, y - h * 0.92, 1));
  }
  put("flame", hat);
  return out;
}

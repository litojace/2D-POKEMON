import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { Palette } from "./skin-art";
import { fashionCut } from "./fashion-fits";
import { cutBox, UNDER } from "./rare-fashion";
import { DESIGNS } from "./modern-designs";
import "./modern-viet";
import "./modern-viet-legend";

/**
 * Modern collections (prototype): Neon Campus, Hero Squad, Starlight Idol,
 * Hồn Việt and Stars & Stripes. Each dresses a champion in a costume plus
 * one or two signature accessories, and marks the pieces that give off
 * light with `lume`: the glowing parts of the costume (an emissive mask, as
 * games do it), drawn lit in the texture and animated on top of it in play.
 *
 *   <g class="lume" data-lume="pulse|blink|chase|twinkle" data-i="0..">
 *
 *  - pulse: breathes slowly (a chest emblem, an LED ring);
 *  - blink: an indicator light, at most 2 flashes a second, small, so it
 *    stays far under the three-flashes-a-second safety line;
 *  - chase: a row of lights lit one after another (marquee bulbs, piping),
 *    `data-i` giving each light's place in the row;
 *  - twinkle: sparkles that glint at their own moments.
 */
export type ModernTheme = "campus" | "hero" | "idol" | "viet" | "stars" | "vietlegend";

/** Per-champion colours and the emblem drawn on its costume. */
const LOOK: Record<CharacterId, { a: string; b: string; emblem: Emblem }> = {
  voltkit: { a: "#2b4c9b", b: "#ffd84a", emblem: "bolt" },
  cindrake: { a: "#a8322c", b: "#ffb347", emblem: "flame" },
  tidefin: { a: "#1f6f8b", b: "#7ff0ff", emblem: "wave" },
  auralynx: { a: "#4a3b8c", b: "#c7a8ff", emblem: "gem" },
  lumoth: { a: "#2f6b4f", b: "#fff1a0", emblem: "moon" },
  mystowl: { a: "#5a2f6e", b: "#ffe08a", emblem: "moon" },
  terradon: { a: "#5b4a2c", b: "#9fe08a", emblem: "peak" },
  duskveil: { a: "#2a2448", b: "#8ff5e6", emblem: "moon" },
  coilemur: { a: "#8c5a1f", b: "#7ff3ff", emblem: "bolt" },
  pyranda: { a: "#7a1f2c", b: "#ffd27a", emblem: "heart" },
  glacelle: { a: "#2c5f8c", b: "#d8f6ff", emblem: "flake" },
  halcyra: { a: "#1f4f6e", b: "#ff9a6a", emblem: "wing" },
  sunbara: { a: "#a5582c", b: "#ffd84a", emblem: "sun" },
  astrabun: { a: "#3b3f8c", b: "#fff3c4", emblem: "star" },
  wombolder: { a: "#4a4a5a", b: "#ff7a5a", emblem: "peak" },
  shadopus: { a: "#3a2c6e", b: "#ff8fd0", emblem: "gem" },
  pangrove: { a: "#5a3a1f", b: "#ffb3cf", emblem: "leaf" },
  mossloth: { a: "#6e5a3a", b: "#d2b3f0", emblem: "leaf" },
};
type Emblem = "bolt" | "flame" | "wave" | "gem" | "moon" | "peak" | "heart" | "flake" | "wing" | "sun" | "star" | "leaf";

/** A small emblem centred on (x, y), r across. */
function emblemPath(e: Emblem, x: number, y: number, r: number) {
  const P = (pts: number[][]) => "M" + pts.map(([u, v]) => `${(x + u * r).toFixed(1)} ${(y + v * r).toFixed(1)}`).join("L") + "Z";
  switch (e) {
    case "bolt":
      return P([[0.15, -1], [-0.55, 0.12], [-0.05, 0.12], [-0.2, 1], [0.55, -0.15], [0.05, -0.15]]);
    case "flame":
      return `M${x} ${y - r}C${x + r * 0.9} ${y - r * 0.2} ${x + r * 0.7} ${y + r} ${x} ${y + r}C${x - r * 0.7} ${y + r} ${x - r * 0.9} ${y - r * 0.2} ${x} ${y - r}Z`;
    case "wave":
      return `M${x - r} ${y + r * 0.3}Q${x - r * 0.5} ${y - r} ${x} ${y}Q${x + r * 0.5} ${y + r * 0.8} ${x + r} ${y - r * 0.3}L${x + r} ${y + r * 0.6}L${x - r} ${y + r * 0.6}Z`;
    case "gem":
      return P([[0, -1], [0.8, -0.3], [0.5, 0.9], [-0.5, 0.9], [-0.8, -0.3]]);
    case "moon":
      return `M${x + r * 0.3} ${y - r}A${r} ${r} 0 1 0 ${x + r * 0.3} ${y + r}A${r * 0.75} ${r * 0.75} 0 1 1 ${x + r * 0.3} ${y - r}Z`;
    case "peak":
      return P([[-1, 0.8], [-0.3, -0.6], [0, -0.1], [0.35, -0.9], [1, 0.8]]);
    case "heart":
      return `M${x} ${y + r * 0.9}C${x - r * 1.4} ${y - r * 0.1} ${x - r * 0.6} ${y - r * 1.1} ${x} ${y - r * 0.35}C${x + r * 0.6} ${y - r * 1.1} ${x + r * 1.4} ${y - r * 0.1} ${x} ${y + r * 0.9}Z`;
    case "flake":
      return [0, 60, 120].map((a) => {
        const c = Math.cos((a * Math.PI) / 180) * r,
          s = Math.sin((a * Math.PI) / 180) * r;
        return `M${x - c} ${y - s}L${x + c} ${y + s}`;
      }).join("");
    case "wing":
      return `M${x - r} ${y + r * 0.6}Q${x - r * 0.2} ${y - r * 1.2} ${x + r} ${y - r * 0.6}Q${x + r * 0.2} ${y - r * 0.2} ${x + r * 0.6} ${y + r * 0.1}Q${x} ${y + r * 0.1} ${x - r} ${y + r * 0.6}Z`;
    case "sun":
      return `M${x} ${y}m-${r * 0.5} 0a${r * 0.5} ${r * 0.5} 0 1 0 ${r} 0a${r * 0.5} ${r * 0.5} 0 1 0 -${r} 0` +
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return `M${x + Math.cos(a) * r * 0.7} ${y + Math.sin(a) * r * 0.7}L${x + Math.cos(a) * r} ${y + Math.sin(a) * r}`;
        }).join("");
    case "star":
      return star(x, y, r, 5);
    case "leaf":
      return `M${x - r * 0.8} ${y + r * 0.8}Q${x - r} ${y - r * 0.6} ${x + r * 0.8} ${y - r * 0.8}Q${x + r * 0.6} ${y + r * 0.9} ${x - r * 0.8} ${y + r * 0.8}Z`;
  }
}
const LINE_EMBLEMS: Emblem[] = ["flake"];
function star(x: number, y: number, r: number, n: number, inner = 0.45) {
  let d = "";
  for (let i = 0; i < n * 2; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / n;
    const rr = i % 2 ? r * inner : r;
    d += `${i ? "L" : "M"}${(x + Math.cos(a) * rr).toFixed(1)} ${(y + Math.sin(a) * rr).toFixed(1)}`;
  }
  return d + "Z";
}

export function modernOutfit(
  theme: ModernTheme,
  id: CharacterId,
  dir: Facing,
  p: Palette,
  head: { cx: number; top: number },
): [CreaturePart, string][] {
  const look = LOOK[id];
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
  const ink = p.dark;
  const out: [CreaturePart, string][] = [];
  const put = (part: CreaturePart, svg: string, under = false) =>
    out.push([part, (under ? UNDER : "") + `<g class="fashion-modern modern-${theme}" data-champion="${id}" data-view="${dir}">${svg}</g>`]);
  const path = (d: string, fill: string, stroke = ink, sw = 1.1) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" stroke-linecap="round"/>`;
  const line = (d: string, color: string, sw = 1.1) => path(d, "none", color, sw);
  const circle = (x: number, y: number, r: number, fill: string, stroke = ink, sw = 0.7) =>
    `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  const rect = (x: number, y: number, w: number, h: number, r: number, fill: string, stroke = ink, sw = 1.1) =>
    `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
  /** A glowing piece: lit colour in the texture, animated in play. */
  const lume = (kind: "pulse" | "blink" | "chase" | "twinkle", svg: string, i = 0, color = look.b) =>
    `<g class="lume" data-lume="${kind}" data-i="${i}" data-color="${color}">${svg}</g>`;
  const emblem = (e: Emblem, x: number, y: number, r: number, color: string, sw = 0.6) =>
    LINE_EMBLEMS.includes(e) ? line(emblemPath(e, x, y, r), color, 1.6) : path(emblemPath(e, x, y, r), color, ink, sw);
  const clipId = `modern-${theme}-${id}-${dir}`;
  const garment = (svg: string) =>
    `<defs><clipPath id="${clipId}"><path d="${cut}" transform="translate(${bx} 0)"/></clipPath></defs><g clip-path="url(#${clipId})">${svg}</g>` +
    path(cut, "none", ink, 1.2).replace("<path", `<path transform="translate(${bx} 0)"`);
  const hx = head.cx,
    ht = Math.max(head.top, 16);
  const ox = side * 4;
  // A champion's own design in this collection, where one is drawn.
  const design = DESIGNS[theme]?.[id];
  if (design) {
    design({ id, side, back, hx, ht, C, T, B, W, L, R, ink, put, path, line, circle, rect, lume, garment, star });
    return out;
  }

  switch (theme) {
    // ---- Neon Campus: blazer, shirt and tie, LED headphones.
    case "campus": {
      const blazer = look.a,
        shirt = "#f7f4ee";
      if (back) {
        put("scarf", path(`M${C - W - 1} ${T + 1}Q${C} ${T - 4} ${C + W + 1} ${T + 1}L${C + W + 2} ${B + 2}L${C - W - 2} ${B + 2}Z`, blazer) +
          // A backpack with a light strip down it.
          rect(C - 11, T + 4, 22, 24, 5, "#3a3f52") + rect(C - 7, T + 16, 14, 9, 3, "#4b5168") +
          lume("pulse", rect(C - 1.2, T + 6, 2.4, 9, 1.2, look.b, "none")));
      } else {
        put("body", garment(
          rect(L - 2, T - 2, R - L + 4, B - T + 6, 0, blazer, "none") +
            (side
              ? path(`M${C + side * 3} ${T - 1}l${side * 8} 0l${-side * 6} 14Z`, shirt, ink, 0.8) + path(`M${C + side * 6} ${T + 1}l${side * 2} 0l${side * 1} 12l${-side * 3} 3l${-side * 2} -3Z`, look.b, ink, 0.6)
              : path(`M${C - 10} ${T - 1}L${C} ${T + 15}L${C + 10} ${T - 1}Z`, shirt, ink, 0.8) +
                // The tie, and lapels with light piping along their edges.
                path(`M${C - 2.5} ${T + 1}L${C + 2.5} ${T + 1}L${C + 3.5} ${T + 13}L${C} ${T + 17}L${C - 3.5} ${T + 13}Z`, look.b, ink, 0.6) +
                path(`M${C - 10} ${T - 1}L${C - 3} ${T + 14}L${C - 14} ${T + 10}Z`, blazer, ink, 0.8) +
                path(`M${C + 10} ${T - 1}L${C + 3} ${T + 14}L${C + 14} ${T + 10}Z`, blazer, ink, 0.8) +
                [0, 1, 2, 3].map((i) => lume("chase", circle(C - 10 + i * 2.2, T + i * 4.2, 0.9, look.b, "none", 0), i)).join("") +
                [0, 1, 2, 3].map((i) => lume("chase", circle(C + 10 - i * 2.2, T + i * 4.2, 0.9, look.b, "none", 0), i)).join("")) +
            // A breast-pocket crest that glows.
            lume("pulse", emblem(look.emblem, C + (side ? side * 7 : -11), T + 18, 3.2, look.b, 0.4)) +
            line(`M${L} ${B - 1.5}H${R}`, "#ffffff55", 1.2),
        ));
      }
      // LED headphones: a band over the head, cups with a glowing ring and a
      // little status light that blinks.
      // The cups sit on the sides of the head, clear of the eyes.
      const cupY = ht + 46;
      const span = side ? 0 : 52;
      if (side) {
        const cx = hx - side * 18;
        put("flame", line(`M${cx} ${cupY - 8}Q${cx - side * 4} ${ht - 8} ${cx + side * 14} ${ht - 4}`, "#2b2f3d", 4.2) +
          circle(cx, cupY, 11, "#2b2f3d") + circle(cx, cupY, 7.5, "#3d4256", "#1b1e28", 0.8) +
          lume("pulse", `<circle cx="${cx}" cy="${cupY}" r="9.2" fill="none" stroke="${look.b}" stroke-width="1.6"/>`) +
          lume("blink", circle(cx + side * 5, cupY - 6, 1.3, "#7dff8a", "none", 0), 0, "#7dff8a"));
      } else {
        put("flame", line(`M${hx - span} ${cupY - 8}Q${hx - span + 2} ${ht - 12} ${hx} ${ht - 12}Q${hx + span - 2} ${ht - 12} ${hx + span} ${cupY - 8}`, "#2b2f3d", 4.2) +
          [-1, 1].map((s) => circle(hx + s * span, cupY, 9.5, "#2b2f3d") + circle(hx + s * span, cupY, 6, "#3d4256", "#1b1e28", 0.8) +
            lume("pulse", `<circle cx="${hx + s * span}" cy="${cupY}" r="7.8" fill="none" stroke="${look.b}" stroke-width="1.5"/>`)).join("") +
          (back ? "" : lume("blink", circle(hx + span, cupY - 8.5, 1.3, "#7dff8a", "none", 0), 0, "#7dff8a")));
      }
      break;
    }
    // ---- Hero Squad: suit, a glowing chest emblem, belt, and a cape.
    case "hero": {
      const suit = look.a,
        trim = look.b,
        cape = "#c8323a";
      if (back) {
        put("scarf", path(`M${C - W + 2} ${T}Q${C} ${T - 4} ${C + W - 2} ${T}L${C + W + 8} ${B + 12}Q${C} ${B + 18} ${C - W - 8} ${B + 12}Z`, cape) +
          // Light runs down the cape's hem.
          [0, 1, 2, 3, 4, 5].map((i) => {
            const u = i / 5;
            const x = C - W - 6 + u * (2 * W + 12),
              y = B + 12 + Math.sin(u * Math.PI) * 5;
            return lume("chase", circle(x, y, 1.1, trim, "none", 0), i, trim);
          }).join("") +
          lume("pulse", emblem(look.emblem, C, T + 14, 5, trim, 0.5), 0, trim));
      } else {
        // Cape behind: its collar shows over the shoulders.
        put("body", path(`M${C - W - 4} ${T + 2}L${C - W - 9} ${B + 10}L${C - W + 2} ${B + 2}Z`, cape, ink, 0.9) +
          path(`M${C + W + 4} ${T + 2}L${C + W + 9} ${B + 10}L${C + W - 2} ${B + 2}Z`, cape, ink, 0.9), true);
        const ex = C + side * 4,
          ey = T + 12;
        put("body", garment(
          rect(L - 2, T - 2, R - L + 4, B - T + 6, 0, suit, "none") +
            // Panel lines and a belt with a glowing buckle.
            line(`M${L + 2} ${T + 3}Q${C} ${T + 9} ${R - 2} ${T + 3}`, trim, 1) +
            rect(L - 2, B - 11, R - L + 4, 5, 0, "#2a2a36") +
            lume("pulse", rect(ex - 3, B - 11.5, 6, 6, 1.5, trim, ink, 0.6), 1, trim) +
            // The emblem plate, and the emblem itself giving off light.
            (side ? "" : path(`M${ex} ${ey - 9}L${ex + 9} ${ey}L${ex} ${ey + 9}L${ex - 9} ${ey}Z`, "#ffffff", ink, 0.8)) +
            lume("pulse", emblem(look.emblem, ex, ey, side ? 4.5 : 5.5, trim, 0.5), 0, trim),
        ));
        put("body", path(`M${C - W - 3} ${T}Q${C - W + 2} ${T - 5} ${C - W + 8} ${T - 1}L${C - W + 2} ${T + 4}Z`, cape, ink, 0.8) +
          path(`M${C + W + 3} ${T}Q${C + W - 2} ${T - 5} ${C + W - 8} ${T - 1}L${C + W - 2} ${T + 4}Z`, cape, ink, 0.8));
      }
      // A hero's comm earpiece with a blinking light.
      if (!back) {
        const ex = side ? hx - side * 2 : hx + 40;
        put("flame", rect(ex - 3, ht + 30, 6, 9, 3, "#2a2a36") + lume("blink", circle(ex, ht + 32.5, 1.2, "#ff4f5a", "none", 0), 0, "#ff4f5a"));
      }
      break;
    }
    // ---- Starlight Idol: stage jacket with a star brooch and sequins, a
    // headset mic with LEDs and a big ribbon bow.
    case "idol": {
      const jacket = "#ffffff",
        accent = look.b === "#ffd84a" ? "#ff6fae" : look.b,
        pink = "#ff6fae";
      if (back) {
        put("scarf", path(`M${C - W - 1} ${T + 1}Q${C} ${T - 4} ${C + W + 1} ${T + 1}L${C + W + 3} ${B}L${C - W - 3} ${B}Z`, jacket) +
          path(`M${C - W - 4} ${B - 4}Q${C} ${B + 4} ${C + W + 4} ${B - 4}L${C + W + 7} ${B + 6}Q${C} ${B + 12} ${C - W - 7} ${B + 6}Z`, pink) +
          [0, 1, 2, 3, 4].map((i) => lume("twinkle", star(C - W + 2 + i * (W - 2) / 2, T + 10 + (i % 2) * 6, 1.6, 4), i, "#ffffff")).join(""));
      } else {
        put("body", garment(
          rect(L - 2, T - 2, R - L + 4, B - T + 6, 0, jacket, "none") +
            // A frilled hem, sequins that glint and a star brooch at the neck.
            path(`M${L - 2} ${B - 8}Q${C - W / 2} ${B - 3} ${C} ${B - 8}Q${C + W / 2} ${B - 3} ${R + 2} ${B - 8}L${R + 2} ${B + 4}L${L - 2} ${B + 4}Z`, pink, ink, 0.8) +
            [0, 1, 2, 3, 4, 5].map((i) => lume("twinkle", star(L + 4 + ((i * 7.3) % (R - L - 6)), T + 12 + ((i * 5.7) % 12), 1.3, 4), i, "#fff6c9")).join("") +
            path(`M${C - 9 + ox} ${T - 1}Q${C + ox} ${T + 6} ${C + 9 + ox} ${T - 1}`, "none", accent, 2.2),
        ));
        put("body", lume("pulse", path(star(C + ox, T + 5, 4.8, 5), "#fff3a8", ink, 0.6), 0, "#fff3a8"));
      }
      // The headset: a slim band, an ear piece with LEDs and a boom mic.
      const span = side ? 0 : 52;
      const ey = ht + 46;
      const earX = side ? hx - side * 18 : hx - span;
      put("flame",
        (side ? line(`M${earX} ${ey - 6}Q${earX - side * 4} ${ht - 8} ${earX + side * 14} ${ht - 4}`, "#f2f2f8", 2.4) : line(`M${hx - span} ${ey - 6}Q${hx - span} ${ht - 12} ${hx} ${ht - 12}Q${hx + span} ${ht - 12} ${hx + span} ${ey - 6}`, "#f2f2f8", 2.4)) +
          circle(earX, ey, 6.5, "#f2f2f8") +
          [0, 1, 2].map((i) => lume("blink", circle(earX - 2.5 + i * 2.5, ey, 0.9, pink, "none", 0), i, pink)).join("") +
          // The boom mic curves in to the corner of the mouth.
          (back ? "" : line(`M${earX} ${ey + 5}Q${earX + (side || 1) * 2} ${ey + 22} ${earX + (side || 1) * 20} ${ey + 25}`, "#f2f2f8", 1.6) +
            circle(earX + (side || 1) * 21, ey + 25, 2.4, "#3a3a48")),
      );
      // A big ribbon bow on the head, its edge catching the light.
      const bowX = side ? hx + side * 8 : hx + 24,
        bowY = ht + 4;
      const bow =
        path(`M${bowX} ${bowY}C${bowX - 6} ${bowY - 10} ${bowX - 16} ${bowY - 10} ${bowX - 16} ${bowY - 2}C${bowX - 16} ${bowY + 6} ${bowX - 6} ${bowY + 6} ${bowX} ${bowY}Z`, pink) +
        path(`M${bowX} ${bowY}C${bowX + 6} ${bowY - 10} ${bowX + 16} ${bowY - 10} ${bowX + 16} ${bowY - 2}C${bowX + 16} ${bowY + 6} ${bowX + 6} ${bowY + 6} ${bowX} ${bowY}Z`, pink) +
        circle(bowX, bowY, 3, "#ffd1e6");
      put("flame", bow + lume("twinkle", star(bowX + 11, bowY - 6, 2.2, 4), 3, "#ffffff"));
      break;
    }
    // ---- Hồn Việt: an áo dài top (stand collar, side closure, long front
    // panel) with gold lotus embroidery, a nón lá with a Đông Sơn sun, and a
    // Hội An lantern charm.
    case "viet": {
      const silk = VIET_SILK[id] ?? "#c8102e",
        gold = "#f2c14e",
        goldDark = "#a8823a";
      const lotus = (x: number, y: number, r: number) =>
        path(`M${x} ${y + r * 0.4}C${x - r * 0.35} ${y - r * 0.2} ${x - r * 0.2} ${y - r * 0.8} ${x} ${y - r}C${x + r * 0.2} ${y - r * 0.8} ${x + r * 0.35} ${y - r * 0.2} ${x} ${y + r * 0.4}Z`, gold, goldDark, 0.4) +
        path(`M${x} ${y + r * 0.4}C${x - r * 0.9} ${y + r * 0.2} ${x - r} ${y - r * 0.5} ${x - r * 0.75} ${y - r * 0.55}C${x - r * 0.4} ${y - r * 0.3} ${x - r * 0.2} ${y} ${x} ${y + r * 0.4}Z`, gold, goldDark, 0.4) +
        path(`M${x} ${y + r * 0.4}C${x + r * 0.9} ${y + r * 0.2} ${x + r} ${y - r * 0.5} ${x + r * 0.75} ${y - r * 0.55}C${x + r * 0.4} ${y - r * 0.3} ${x + r * 0.2} ${y} ${x} ${y + r * 0.4}Z`, gold, goldDark, 0.4);
      if (back) {
        put("scarf", path(`M${C - W - 1} ${T + 1}Q${C} ${T - 4} ${C + W + 1} ${T + 1}L${C + W + 1} ${B - 2}L${C + 6} ${B + 16}L${C - 6} ${B + 16}L${C - W - 1} ${B - 2}Z`, silk) +
          rect(C - 7, T - 3, 14, 5, 1.5, silk) + lume("pulse", lotus(C, B + 4, 5.5), 0, gold));
      } else {
        const fx = C + ox;
        put("body",
          // The front panel (vạt trước) falls past the waist.
          path(`M${fx - 8} ${B - 6}L${fx + 8} ${B - 6}L${fx + 7} ${B + 16}Q${fx} ${B + 19} ${fx - 7} ${B + 16}Z`, silk, ink, 0.9) +
            lume("pulse", lotus(fx, B + 9, 4.2), 1, gold), true);
        put("body", garment(
          rect(L - 2, T - 2, R - L + 4, B - T + 6, 0, silk, "none") +
            // The side closure from the collar to the arm, with gold buttons.
            line(`M${fx + 2} ${T + 2}Q${fx + 8} ${T + 5} ${fx + 12} ${T + 11}`, goldDark, 1) +
            [0, 1, 2].map((i) => circle(fx + 4 + i * 3.6, T + 3.4 + i * 2.6, 0.9, gold, goldDark, 0.4)).join("") +
            // Gold lotus embroidery that glows warmly.
            lume("pulse", lotus(fx - (side ? 0 : 4), T + 15, 6), 0, gold),
        ));
        // The stand collar.
        put("body", rect(fx - 8, T - 4, 16, 6, 2, silk, ink, 0.9) + line(`M${fx - 7} ${T - 2.6}H${fx + 7}`, gold, 0.8));
        // A Hội An lantern charm at the hip, flickering warmly.
        const lx = C + (side ? -side : 1) * (W + 3),
          ly = T + 18;
        put("body",
          line(`M${lx} ${ly - 6}V${ly - 2}`, goldDark, 0.8) +
            lume("pulse", `<ellipse cx="${lx}" cy="${ly + 3}" rx="3.6" ry="5" fill="#ff5a3a" stroke="${ink}" stroke-width="0.6"/>` +
              line(`M${lx - 3.4} ${ly + 3}H${lx + 3.4}`, gold, 0.6), 2, "#ffb347") +
            rect(lx - 2.2, ly - 2.4, 4.4, 1.4, 0.4, gold, goldDark, 0.3) + rect(lx - 2.2, ly + 7.6, 4.4, 1.4, 0.4, gold, goldDark, 0.3) +
            line(`M${lx} ${ly + 9}V${ly + 13}`, "#ff5a3a", 0.8),
        );
      }
      // Nón lá: a wide conical leaf hat with rings of its ribs, a chin ribbon
      // and a Đông Sơn sun (a star of rays) that glows from inside it.
      const w = side ? 40 : 48;
      const y = ht + 14,
        apex = y - 30;
      const hatX = hx + (side ? side * 2 : 0);
      const ribs = [0.35, 0.6, 0.82].map((u) => line(`M${hatX - w * u} ${apex + (y - apex) * u}Q${hatX} ${apex + (y - apex) * u + 4 * u} ${hatX + w * u} ${apex + (y - apex) * u}`, "#b8955a", 0.7)).join("");
      const sunX = hatX,
        sunY = apex + (y - apex) * 0.62;
      const rays = Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `M${sunX + Math.cos(a) * 2.6} ${sunY + Math.sin(a) * 1.4}L${sunX + Math.cos(a) * 6.5} ${sunY + Math.sin(a) * 3.4}`;
      }).join("");
      put("flame",
        path(`M${hatX} ${apex}L${hatX + w} ${y}Q${hatX} ${y + 9} ${hatX - w} ${y}Z`, "#f1d9a0", "#8a6a3a", 1.1) + ribs +
          (back ? "" : lume("pulse", line(rays, gold, 0.9) + `<ellipse cx="${sunX}" cy="${sunY}" rx="2.4" ry="1.4" fill="${gold}"/>`, 0, gold) +
            // The chin ribbon runs down the side of the head, off the face.
            (side ? "" : line(`M${hatX - w * 0.94} ${y + 1}Q${hatX - w * 1.08} ${y + 22} ${hatX - w * 0.98} ${y + 38}`, silk, 1.4))),
      );
      break;
    }
    // ---- Stars & Stripes: a varsity jacket with a star patch and striped
    // ribbing, marquee bulbs along the hem, and a star cap.
    case "stars": {
      const navy = "#1f2f5c",
        red = "#c8323a",
        cream = "#f7f1e1";
      if (back) {
        put("scarf", path(`M${C - W - 1} ${T + 1}Q${C} ${T - 4} ${C + W + 1} ${T + 1}L${C + W + 2} ${B + 2}L${C - W - 2} ${B + 2}Z`, navy) +
          path(star(C, T + 13, 7, 5), cream, ink, 0.7) +
          [0, 1, 2, 3, 4, 5].map((i) => lume("chase", circle(C - W + 2 + i * (2 * W - 4) / 5, B - 1, 1.1, "#fff0b0", "none", 0), i, "#fff0b0")).join(""));
      } else {
        put("body", garment(
          rect(L - 2, T - 2, R - L + 4, B - T + 6, 0, navy, "none") +
            // Striped ribbing at the hem and the neck.
            [0, 1, 2].map((i) => line(`M${L} ${B - 7 + i * 2.4}H${R}`, i % 2 ? cream : red, 1.3)).join("") +
            (side ? "" : line(`M${C - 9} ${T}L${C} ${T + 9}L${C + 9} ${T}`, red, 2) + line(`M${C - 8} ${T + 2}L${C} ${T + 10}L${C + 8} ${T + 2}`, cream, 0.9)) +
            // Snap buttons and the star patch, which twinkles.
            (side ? "" : [0, 1, 2].map((i) => circle(C, T + 13 + i * 5, 0.9, cream, "none", 0)).join("")) +
            lume("twinkle", path(star(C + (side ? side * 5 : -10), T + 15, 4.5, 5), cream, red, 0.8), 0, "#ffffff") +
            // Marquee bulbs along the hem, lit in a running chase.
            [0, 1, 2, 3, 4, 5].map((i) => lume("chase", circle(L + 3 + i * (R - L - 6) / 5, B - 1, 1.1, "#fff0b0", "none", 0), i, "#fff0b0")).join(""),
        ));
      }
      // A ball cap: crown, bill (turned to the side the champion faces) and
      // a star on the front that glows.
      const cw = side ? 30 : 36;
      const cy = ht + 18;
      const capX = hx + side * 2;
      let cap = path(`M${capX - cw} ${cy}Q${capX - cw} ${cy - 26} ${capX} ${cy - 27}Q${capX + cw} ${cy - 26} ${capX + cw} ${cy}Z`, navy) +
        line(`M${capX - cw + 3} ${cy - 2}H${capX + cw - 3}`, red, 2.2) + circle(capX, cy - 26.5, 1.8, red);
      if (side) cap += path(`M${capX + side * cw * 0.6} ${cy - 1}Q${capX + side * (cw + 18)} ${cy - 2} ${capX + side * (cw + 20)} ${cy + 4}Q${capX + side * cw * 0.8} ${cy + 5} ${capX + side * cw * 0.5} ${cy + 3}Z`, red);
      else if (!back) cap += path(`M${capX - cw + 4} ${cy}Q${capX} ${cy + 10} ${capX + cw - 4} ${cy}Q${capX} ${cy + 4} ${capX - cw + 4} ${cy}Z`, red);
      if (!back) cap += lume("twinkle", path(star(capX + side * 4, cy - 12, 6, 5), cream, "#d9cfb8", 0.6), 1, "#ffffff");
      put("flame", cap);
      break;
    }
  }
  return out;
}

/** Each champion's áo dài silk (red and gold lead, with the national colours). */
const VIET_SILK: Partial<Record<CharacterId, string>> = {
  voltkit: "#c8102e",
  cindrake: "#c8102e",
  tidefin: "#2f7fb8",
  mystowl: "#7a3f9a",
  terradon: "#2f6b4f",
  sunbara: "#e85a2a",
  pyranda: "#c8102e",
  glacelle: "#f4f4f8",
  lumoth: "#f6e7a8",
  astrabun: "#d6457a",
};

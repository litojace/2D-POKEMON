import type { CharacterId } from "@arena/shared";
import { DESIGNS, type Design, type Kit } from "./modern-designs";
import "./modern-viet";

/**
 * Hồn Việt as a Legendary (design preview): each champion's Epic costume,
 * made fuller, with the champion's own prop traded for one from its story
 * (Astrabun's mallet becomes a Trung Thu rabbit lantern, Sunbara's yuzu a
 * crown of hoa mai, Tidefin's fin-blade a lotus lamp, Terradon's shell the
 * golden shell of Kim Quy).
 */
const GOLD = "#f2c14e",
  GOLD_DARK = "#a8823a";
const epic = (id: CharacterId, k: Kit) => DESIGNS.viet?.[id]?.(k);

export const VIET_LEGEND: Partial<Record<CharacterId, Design>> = {
  // Thỏ Ngọc: the mallet becomes a rabbit lantern on a bamboo rod (its head
  // repainted red, a lantern drawn over it); a long silk shawl and the moon.
  astrabun(k) {
    epic("astrabun", k);
    // Where the mallet head is drawn in each view (measured from the art,
    // final units); the left view mirrors the right.
    const spot = k.back ? [143, 99] : k.side ? [54, 106] : [150.7, 101.5];
    const cx = k.side < 0 ? 200 - spot[0] : spot[0],
      cy = spot[1],
      w = 19,
      h = 17;
    const flip = "";
    k.put("armR", `<g${flip}>` +
      k.lume("pulse", `<ellipse cx="${cx}" cy="${cy}" rx="${w}" ry="${h}" fill="#e8322a" stroke="${k.ink}" stroke-width="1"/>` +
        [-0.5, 0, 0.5].map((u) => k.line(`M${cx + u * w} ${cy - h + 1}Q${cx + u * w * 1.4} ${cy} ${cx + u * w} ${cy + h - 1}`, "#b81f1a", 0.8)).join(""), 0, "#ffb347") +
      // Rabbit ears on the lantern and gold caps.
      k.path(`M${cx - 6} ${cy - h + 2}l-3 -10l6 6Z M${cx + 6} ${cy - h + 2}l3 -10l-6 6Z`, "#f4f1f8", k.ink, 0.6) +
      k.rect(cx - w * 0.6, cy - h - 1, w * 1.2, 3, 1, GOLD, GOLD_DARK, 0.5) + k.rect(cx - w * 0.6, cy + h - 2, w * 1.2, 3, 1, GOLD, GOLD_DARK, 0.5) +
      k.line(`M${cx} ${cy + h + 1}v6`, "#e8322a", 1) + "</g>");
    // A long silk shawl over the shoulders, its ends trailing.
    if (!k.back) {
      const c = k.C + k.side * 3;
      k.put("body", k.path(`M${c - 16} ${k.T - 2}Q${c} ${k.T + 6} ${c + 16} ${k.T - 2}L${c + 18} ${k.T + 2}Q${c} ${k.T + 12} ${c - 18} ${k.T + 2}Z`, "#c9b8f0", k.ink, 0.7) +
        k.lume("twinkle", [0, 1, 2].map((i) => k.circle(c - 10 + i * 10, k.T + 5 + (i % 2) * 2, 0.9, "#ffffff", "none", 0)).join(""), 2, "#ffffff"));
    }
  },
  // Xuân Hoa Mai: the yuzu gives way to a crown of hoa mai whose hearts glow,
  // a gold-embroidered red áo dài, and a lì xì envelope at the sash.
  sunbara(k) {
    epic("sunbara", k);
    const x = k.hx + k.side * 2,
      y = k.ht - 2;
    const bloom = (bx: number, by: number, r: number, i: number) =>
      Array.from({ length: 5 }, (_, j) => {
        const a = (j / 5) * Math.PI * 2 - Math.PI / 2;
        return k.circle(bx + Math.cos(a) * r, by + Math.sin(a) * r, r * 0.8, "#ffd84a", "#c8902a", 0.5);
      }).join("") + k.lume("pulse", k.circle(bx, by, r * 0.55, "#ff8a1a", "none", 0), i, "#ffb347");
    const blooms = k.side ? [[x, y - 6, 7], [x - k.side * 12, y + 2, 5]] : [[x, y - 8, 8], [x - 15, y + 1, 5.5], [x + 15, y + 1, 5.5]];
    k.put("flame", k.line(`M${x - 22} ${y + 8}Q${x} ${y - 2} ${x + 22} ${y + 8}`, "#7a4a24", 2) +
      blooms.map(([bx, by, r], i) => bloom(bx, by, r, i)).join(""));
    if (!k.back) {
      const c = k.C + k.side * 3;
      k.put("body", k.rect(c + (k.side ? 0 : -14), k.B - 14, 7, 9, 1, "#e8322a", GOLD, 0.8) + k.circle(c + (k.side ? 3.5 : -10.5), k.B - 9.5, 1.4, GOLD, "none", 0));
    }
  },
  // Kim Quy: the golden turtle of the legend; its shell plates turn gold and
  // glow along their seams.
  terradon(k) {
    epic("terradon", k);
    // The shell (wings part) spans the back; draw gold plates over it.
    const plates = (cx: number, cy: number, s: number) =>
      [[0, 0], [-1, -0.6], [1, -0.6], [-1, 0.6], [1, 0.6], [0, -1.2], [0, 1.2]].map(([u, v], i) => {
        const px = cx + u * 12 * s,
          py = cy + v * 10 * s;
        const pts = Array.from({ length: 6 }, (_, j) => {
          const a = (j / 6) * Math.PI * 2;
          return `${(px + Math.cos(a) * 7 * s).toFixed(1)} ${(py + Math.sin(a) * 6 * s).toFixed(1)}`;
        });
        return k.lume(i % 2 ? "chase" : "pulse", k.path(`M${pts.join("L")}Z`, "#e6c46a", "#a8823a", 1), i, GOLD);
      }).join("");
    // Over the costume's back, where the shell shows.
    if (k.back) k.put("scarf", plates(100, 130, 1.2));
    else if (k.side) k.put("scarf", plates(k.side > 0 ? 66 : 134, 126, 0.85));
  },
  // Hoa Đăng: the fin-blade becomes a lotus lamp held up, its flame glowing.
  tidefin(k) {
    epic("tidefin", k);
    if (k.back) return;
    // The blade's tip in each view (measured; the left view mirrors the right).
    const tip = k.side ? [84, 130] : [150, 128];
    const bx = k.side < 0 ? 200 - tip[0] : tip[0],
      by = tip[1];
    const flip = "";
    k.put("armR", `<g${flip} transform="translate(${bx} ${by}) scale(1.7) translate(${-bx} ${-by})">` + [-1, -0.5, 0, 0.5, 1].map((s) => k.path(`M${bx} ${by + 4}Q${bx + s * 12} ${by} ${bx + s * 7} ${by - 8}Q${bx + s * 3} ${by - 2} ${bx} ${by + 4}Z`, "#ff9ac0", k.ink, 0.6)).join("") +
      k.lume("pulse", k.path(`M${bx} ${by - 14}Q${bx + 3} ${by - 8} ${bx} ${by - 4}Q${bx - 3} ${by - 8} ${bx} ${by - 14}Z`, "#ffd84a", "#ff8a1a", 0.6), 0, "#ffb347") + "</g>");
  },
};

/**
 * The Legendary mark every Hồn Việt champion wears over its costume: a
 * gold-embroidered silk sash across the chest, its stitches lit in a run.
 */
function sash(k: Kit) {
  const stitches = (x0: number, y0: number, x1: number, y1: number) =>
    [0, 1, 2, 3, 4].map((i) => {
      const u = (i + 0.5) / 5;
      return k.lume("chase", k.circle(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, 0.9, "#fff3c4", "none", 0), i, GOLD);
    }).join("");
  if (k.back) {
    k.put("scarf", k.line(`M${k.C - k.W} ${k.T + 2}L${k.C + k.W} ${k.B - 6}`, GOLD, 3.4) + stitches(k.C - k.W, k.T + 2, k.C + k.W, k.B - 6));
    return;
  }
  const s = k.side || 1;
  const x0 = k.C - s * (k.W + 1),
    x1 = k.C + s * (k.W - 2);
  k.put("body", k.line(`M${x0} ${k.T + 1}L${x1} ${k.B - 8}`, GOLD, 3.4) + k.line(`M${x0} ${k.T + 1}L${x1} ${k.B - 8}`, GOLD_DARK, 0.6) + stitches(x0, k.T + 1, x1, k.B - 8));
}
const ROSTER: CharacterId[] = ["voltkit", "cindrake", "tidefin", "auralynx", "lumoth", "mystowl", "terradon", "duskveil", "coilemur", "pyranda", "glacelle", "halcyra", "sunbara", "astrabun", "wombolder", "shadopus", "pangrove", "mossloth"];
for (const id of ROSTER) {
  const own = VIET_LEGEND[id];
  (DESIGNS.vietlegend ??= {})[id] = (k) => {
    if (own) own(k);
    else epic(id, k);
    sash(k);
  };
}

import { fashionCut } from "./fashion-fits";
import { fashionSignatures } from "./fashion-signatures";
import { epicFashion } from "./epic-fashion";
import type { CharacterId } from "@arena/shared";
import type { FashionCollection } from "../../../../packages/shared/src/shop";
import type { CreaturePart } from "../creature-design";
import type { Facing } from "../animation/controller";
import type { Palette } from "./skin-art";

export type FashionAccessory = `fashion-${FashionCollection}`;

/** Outfits stay on the existing body/scarf/head joints, in the same crop boxes. */
export function fashionOutfit(
  collection: FashionCollection,
  id: CharacterId,
  dir: Facing,
  p: Palette,
  head: { cx: number; top: number },
): [CreaturePart, string][] {
  if (collection === "abyssal-expedition" || collection === "dream-carnival")
    return epicFashion(id, dir, collection, p, head);
  const side = dir === "left" ? -1 : dir === "right" ? 1 : 0;
  const back = dir === "up";
  const cx = 100 + side * 7,
    w = side ? 19 : 27;
  const ink = p.dark,
    cream = "#f5e8cb",
    gold = "#ddba75";
  const path = (d: string, fill: string, stroke = ink, sw = 1.2) =>
    `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}" stroke-linejoin="round" fill-rule="evenodd"/>`;
  const line = (d: string, color = gold, sw = 1.2) =>
    path(d, "none", color, sw);
  const circle = (
    x: number,
    y: number,
    r: number,
    fill: string,
    stroke = ink,
  ) =>
    `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width=".8"/>`;
  const jewel = (x: number, y: number, r = 4) =>
    path(
      `M${x} ${y - r}L${x + r * 0.7} ${y}L${x} ${y + r}L${x - r * 0.7} ${y}Z`,
      p.glow,
      gold,
      0.7,
    );
  const star = (x: number, y: number, r = 3) =>
    path(
      `M${x} ${y - r}L${x + 1} ${y - 1}L${x + r} ${y}L${x + 1} ${y + 1}L${x} ${y + r}L${x - 1} ${y + 1}L${x - r} ${y}L${x - 1} ${y - 1}Z`,
      gold,
      "none",
    );
  const flower = (x: number, y: number, r = 3) =>
    Array.from({ length: 5 }, (_, i) => {
      const a = (i * Math.PI * 2) / 5;
      return circle(
        x + Math.cos(a) * r * 0.7,
        y + Math.sin(a) * r * 0.7,
        r * 0.65,
        p.accent,
        "none",
      );
    }).join("") + circle(x, y, r * 0.35, gold, "none");
  const gear = (x: number, y: number, r: number) =>
    circle(x, y, r, gold) +
    Array.from({ length: 8 }, (_, i) => {
      const a = (i * Math.PI) / 4;
      return line(
        `M${x + Math.cos(a) * r} ${y + Math.sin(a) * r}l${Math.cos(a) * 2.2} ${Math.sin(a) * 2.2}`,
        gold,
        2,
      );
    }).join("") +
    circle(x, y, r * 0.38, p.dark, "none");
  // Each champion has its own cut; these material choices preserve its anatomy.
  const bulky = ["terradon", "wombolder", "pangrove", "mossloth"].includes(id);
  const flight = ["lumoth", "mystowl", "glacelle", "halcyra"].includes(id);
  const ghost = ["duskveil", "shadopus"].includes(id);
  const hem = ghost ? 154 : bulky ? 158 : 164;
  const width = bulky ? w + 4 : flight ? w - 3 : w;
  const body: [CreaturePart, string][] = [];
  const cut = fashionCut(id, dir, collection);
  const clip = `fashion-cut-${id}-${dir}-${collection}`;
  const coat = (svg: string) =>
    body.push([
      "body",
      `<defs><clipPath id="${clip}"><path d="${cut}" transform="translate(${cx} 0)" clip-rule="evenodd"/></clipPath></defs><g clip-path="url(#${clip})">${svg}</g>`,
    ]);
  const wrap = (svg: string) => `<g transform="translate(${cx} 0)">${svg}</g>`;
  switch (collection) {
    case "wayfarer": {
      const green = bulky ? "#526d54" : flight ? "#526e77" : "#5d7162";
      coat(
        wrap(
          path(cut, green) +
            line(
              `M${-width + 4} 132L${-width + 1} ${hem - 6}Q-12 ${hem - 3} -9 ${hem - 6}M${width - 4} 132L${width - 1} ${hem - 6}Q12 ${hem - 3} 9 ${hem - 6}`,
              "#bdc7a1",
              0.9,
            ) +
            (back
              ? path(`M-10 135L0 130L10 135L0 147Z`, cream) +
                line("M0 132V145M-7 137H7", gold)
              : path("M-12 128L0 138L12 128L9 147H-9Z", cream)),
        ),
      );
      break;
    }
    case "moonlit-tea": {
      // Indigo or matcha silk against the blossom-pink coat, never pink on pink.
      const silk = bulky ? "#5f7f5c" : "#46548a";
      coat(
        wrap(
          path(cut, silk) +
            (back
              ? line(`M0 129V${hem}`, cream, 0.8)
              : path(
                  `M${-width + 5} 126L13 ${hem - 6}L21 ${hem - 6}L-7 123Z`,
                  cream,
                ) +
                path(
                  `M${width - 5} 126L-12 ${hem - 4}L-19 ${hem - 4}L7 123Z`,
                  p.accent,
                )) +
            flower(-width + 9, hem - 6, 3) +
            flower(width - 7, 135, 2.5),
        ),
      );
      break;
    }
    case "astral-court": {
      // Darker than the midnight coat, so the gold trim frames a clear robe.
      const velvet = "#161a36";
      coat(
        wrap(
          path(cut, velvet) +
            line(
              `M${-width + 3} 129L${-width + 1} ${hem - 3}Q-12 ${hem - 9} 0 ${hem}Q12 ${hem - 9} ${width - 1} ${hem - 3}L${width - 3} 129`,
              gold,
              1.4,
            ) +
            line(`M-15 137L-5 145L8 138L17 ${hem - 7}`, "#aecfe3", 0.8) +
            [-15, -5, 8, 17]
              .map((x, i) => star(x, [137, 145, 138, hem - 7][i], 2))
              .join("") +
            (back
              ? jewel(0, 137, 5)
              : path("M-10 126L0 138L10 126L6 151H-6Z", cream)),
        ),
      );
      break;
    }
  }
  body.push(...fashionSignatures(id, dir, collection, p, head));
  // Profile garments show the visible side only; headwear uses its own anchors.
  return body.map(([part, svg]) => [
    part,
    `<g class="fashion-outfit fashion-${collection}" data-fit="${bulky ? "shell" : flight ? "wing" : ghost ? "spirit" : "standard"}">${svg}</g>`,
  ]);
}

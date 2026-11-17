import { vanguardPreviewFx } from "./vanguard-fx";
import { creatureLayers, type CreaturePart } from "../creature-design";
import type { CharacterId } from "@arena/shared";
import { profilePartOrder } from "../creature-profile";
import type { Facing } from "../animation/controller";
import { HEAD } from "./skin-art";
import { vanguardOutfit } from "./vanguard-equipment";
import { VANGUARD_DESIGNS } from "./vanguard-art";
export { VANGUARD_DESIGNS as HERO_PREVIEWS } from "./vanguard-art";
export type HeroChampion = CharacterId;
export function heroOutfit(id: CharacterId, dir: Facing) {
  return vanguardOutfit(id, dir, VANGUARD_DESIGNS[id], HEAD[id][dir]);
}
export function heroPreviewLayers(id: CharacterId, dir: Facing) {
  return creatureLayers(id, dir, "normal", { skin: `${id}-nova-vanguard` });
}
export function heroPreviewSvg(id: CharacterId, dir: Facing) {
  const { defs, layers } = heroPreviewLayers(id, dir);
  const fx = vanguardPreviewFx(id, dir);
  const order: CreaturePart[] =
    dir === "down"
      ? [
          "tail",
          "wings",
          "legL",
          "legR",
          "body",
          "armL",
          "armR",
          "head",
          "ears",
          "eyes",
          "flame",
          "scarf",
        ]
      : profilePartOrder(dir, id);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-12 -40 224 238" aria-label="${id} ${dir}">${defs}<g fill="none" stroke="${VANGUARD_DESIGNS[id].palette.dark}" stroke-width="2.1" stroke-linejoin="round" stroke-linecap="round"><ellipse cx="100" cy="178" rx="35" ry="6" fill="#071120" opacity=".35" stroke="none"/>${order.map((part) => `<g class="hero-part hero-${part}">${layers[part]}${fx[part] ?? ""}</g>`).join("")}</g></svg>`;
}

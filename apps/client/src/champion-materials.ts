import type { CharacterId } from "@arena/shared";
import type { CreaturePart } from "./creature-design";
import type { Palette } from "./skins/skin-art";

/** Tiny brush marks, baked with the existing articulated front art and skin palette. */
export function championMaterials(
  id: CharacterId,
  prefix: string,
  p: Palette,
  layers: Record<CreaturePart, string>,
) {
  const key = `${prefix}-surface`;
  const fur = `<path d="M1 2q2 1 2 3M7 7q2 1 2 3" stroke="${p.dark}" opacity=".16"/><path d="M2 1l2 1M8 6l2 1" stroke="${p.light}" opacity=".27"/>`;
  const scales = `<path d="M0 3q3 4 6 0M6 8q3 4 6 0" stroke="${p.dark}" opacity=".15"/><path d="M1 2l2 1M7 7l2 1" stroke="${p.light}" opacity=".25"/>`;
  const feathers = `<path d="M1 1q1 4 4 6q3-2 4-6M5 7v3" stroke="${p.dark}" opacity=".16"/><path d="M2 1l2 3" stroke="${p.light}" opacity=".27"/>`;
  const stone = `<path d="M2 2l2 .5M8 7l1-1" stroke="${p.dark}" opacity=".2"/><path d="M2 1l2 .5M8 6l1-1" stroke="${p.light}" opacity=".3"/>`;
  const velvet = `<path d="M2 1v3M8 7v2" stroke="${p.light}" opacity=".15"/>`;
  const mark =
    id === "terradon"
      ? stone
      : id === "mystowl"
        ? feathers
        : id === "duskveil"
          ? velvet
          : id === "cindrake" || id === "tidefin"
            ? scales
            : fur;
  let defs = `<defs><pattern id="${key}" width="12" height="12" patternUnits="userSpaceOnUse"><g fill="none" stroke-width=".55" stroke-linecap="round">${mark}</g></pattern>`;
  for (const part of [
    "tail",
    "wings",
    "legL",
    "legR",
    "body",
    "armL",
    "armR",
    "head",
    "earFar",
    "ears",
  ] as const) {
    if (!layers[part]) continue;
    const mask = `${key}-${part}`;
    defs += `<mask id="${mask}" style="mask-type:alpha" maskUnits="userSpaceOnUse" x="-40" y="-60" width="280" height="280">${layers[part]}</mask>`;
    // No displacement, blur or expanded alpha: joints and foot contacts cannot move.
    layers[part] +=
      `<g class="champion-material" mask="url(#${mask})" stroke="none" opacity="${part === "head" ? 0.42 : 0.72}"><path fill="url(#${key})" d="M-40-60H240V220H-40Z"/></g>`;
  }
  return defs + "</defs>";
}

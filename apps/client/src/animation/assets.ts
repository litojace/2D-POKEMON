import type { CharacterId } from "@arena/shared";
import {
  creatureSvgRenderer,
  creatureParts,
  proportioned,
  MOODS,
  lookFor,
  type CreaturePart,
  type Mood,
  type SkinLook,
} from "../creature-design";
import { SKIN_ART } from "../skins/skin-art";
import type { Facing } from "./controller";
export type Part = CreaturePart;
export const parts = creatureParts;
export interface RigAsset {
  key: string;
  url: string;
  width: number;
  height: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}
/**
 * The texture suffix for a worn Shop skin ("" for the champion's own look).
 * The Awakening stage is part of it only when the skin's art changes with it.
 */
export function skinSuffix(id: CharacterId, worn?: SkinLook | null) {
  const look = lookFor(id, worn);
  if (!look) return "";
  const stage = look.stage ?? 1;
  const art = SKIN_ART[look.skin];
  const staged =
    !!art.mythic || (art.stageAccessories ?? []).some((s) => stage >= s.stage);
  return `~${look.skin}${staged ? `~${stage}` : ""}`;
}
export function rigKey(id: CharacterId, dir: Facing, part: Part, suffix = "") {
  return `rig-${id}-${dir}-${part}${suffix}`;
}
/** The eyes texture for an expression ("normal" is the plain eyes part). */
export function moodKey(id: CharacterId, dir: Facing, mood: Mood, suffix = "") {
  return mood === "normal"
    ? rigKey(id, dir, "eyes", suffix)
    : `${rigKey(id, dir, "eyes")}-${mood}${suffix}`;
}
const definitions: Record<Part, { bounds: number[]; pivot: number[] }> = {
  tail: { bounds: [0, 40, 200, 140], pivot: [130, 137] },
  wings: { bounds: [0, 30, 200, 145], pivot: [100, 115] },
  legL: { bounds: [50, 135, 90, 45], pivot: [78, 151] },
  legR: { bounds: [60, 135, 90, 45], pivot: [122, 151] },
  body: { bounds: [44, 103, 112, 76], pivot: [100, 130] },
  armL: { bounds: [39, 114, 101, 52], pivot: [65, 122] },
  // Tall enough for Tidefin's fin-blade.
  armR: { bounds: [60, 84, 110, 86], pivot: [135, 122] },
  head: { bounds: [35, 8, 130, 123], pivot: [100, 100] },
  ears: { bounds: [5, 0, 190, 115], pivot: [100, 65] },
  eyes: { bounds: [52, 68, 96, 44], pivot: [100, 93] },
  scarf: { bounds: [35, 90, 150, 84], pivot: [100, 118] },
  flame: { bounds: [30, -2, 140, 110], pivot: [100, 65] },
};
/** A part's crop box once its proportion transform is applied. */
function box(part: Part) {
  const [x, y, w, h] = definitions[part].bounds;
  const [x0, y0] = proportioned(part, x, y),
    [x1, y1] = proportioned(part, x + w, y + h);
  return [x0, y0, x1 - x0, y1 - y0].map((v) => +v.toFixed(2));
}
const pivot = (part: Part, x: number, y: number) => proportioned(part, x, y);
/**
 * Rest offsets (in rig pixels, half of art units) the rig uses to keep the
 * face parts attached to the head while it bobs, tilts and recoils.
 */
export const rigAnchors = (() => {
  const [, head] = pivot(
    "head",
    ...(definitions.head.pivot as [number, number]),
  );
  const [, eyes] = pivot(
    "eyes",
    ...(definitions.eyes.pivot as [number, number]),
  );
  const [, ears] = pivot(
    "ears",
    ...(definitions.ears.pivot as [number, number]),
  );
  return {
    headY: (head - 130) * 0.5,
    eyesLift: (head - eyes) * 0.5,
    earsLift: (head - ears) * 0.5,
  };
})();
function asset(
  id: CharacterId,
  dir: Facing,
  part: Part,
  mood: Mood = "normal",
  look: SkinLook | null = null,
  render = creatureSvgRenderer(id, dir, mood, look),
): RigAsset {
  const suffix = skinSuffix(id, look);
  const { pivot: defaultPivot } = definitions[part];
  const b = box(part);
  let q = dir === "right" && part === "tail" ? [70, 137] : defaultPivot;
  if (dir === "left" || dir === "right") {
    const side = dir === "right" ? 1 : -1;
    const projected: Partial<Record<Part, number>> = {
      armL: 88,
      armR: 112,
      legL: 87,
      legR: 113,
    };
    if (projected[part] !== undefined)
      q = [100 + side * (projected[part]! - 100), defaultPivot[1]];
  }
  q = pivot(part, q[0], q[1]);
  return {
    key:
      part === "eyes"
        ? moodKey(id, dir, mood, suffix)
        : rigKey(id, dir, part, suffix),
    url: "data:image/svg+xml;base64," + btoa(render(part, b.join(" "))),
    width: b[2],
    height: b[3],
    originX: (q[0] - b[0]) / b[2],
    originY: (q[1] - b[1]) / b[3],
    x: (q[0] - 100) * 0.5,
    y: (q[1] - 130) * 0.5,
  };
}
const DIRS: Facing[] = ["up", "down", "left", "right"];
/**
 * Every texture a fighter's rig uses: each part for each facing, plus the
 * expression eyes (happy, hurt, dizzy, focus) for the facings that show a face.
 * Combat uses all facings; fixed-angle previews can request a subset.
 */
export function rigAssets(
  id: CharacterId,
  look: SkinLook | null = null,
  directions: readonly Facing[] = DIRS,
): RigAsset[] {
  // Each normal facing supplies twelve crops. Building its patterns, masks
  // and Awakening accessories for every crop stalls the animation thread.
  const drawings = new Map(
    directions.map((dir) => [
      dir,
      creatureSvgRenderer(id, dir, "normal", look),
    ]),
  );
  return [
    ...directions.flatMap((dir) =>
      parts.map((part) =>
        asset(id, dir, part, "normal", look, drawings.get(dir)!),
      ),
    ),
    ...directions
      .filter((dir) => dir !== "up")
      .flatMap((dir) =>
        MOODS.map((mood) => asset(id, dir, "eyes", mood, look)),
      ),
  ];
}
/** A point of the creature art (200×190 canvas) in rig pixels from its root. */
export function rigPoint(part: Part, x: number, y: number) {
  const [px, py] = proportioned(part, x, y);
  return { x: (px - 100) * 0.5, y: (py - 130) * 0.5 };
}

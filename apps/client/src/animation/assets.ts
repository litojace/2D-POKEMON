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
import { profilePartBounds } from "../creature-profile";
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
export function wholeKey(
  id: CharacterId,
  dir: Facing,
  mood: Mood = "normal",
  suffix = "",
) {
  return `rig-${id}-${dir}-whole${mood === "normal" ? "" : `-${mood}`}${suffix}`;
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
function box(id: CharacterId, part: Part, dir: Facing) {
  const profile = dir === "left" || dir === "right";
  // Side headbands trail behind the gills; keep their ribbons in the crop.
  const [sourceX, y, w, h] =
    profile && part === "flame" ? [10, -2, 180, 110] : definitions[part].bounds;
  // Tidefin's blade projects forward in profile; its crop follows the turn.
  const x = dir === "left" && part === "armR" ? 200 - sourceX - w : sourceX;
  const [x0, y0] = proportioned(part, x, y),
    [x1, y1] = proportioned(part, x + w, y + h);
  const painted = dir !== "down" ? profilePartBounds(id, dir, part) : undefined;
  const minX = Math.min(x0, painted ? painted[0] - 2 : x0),
    minY = Math.min(y0, painted ? painted[1] - 2 : y0),
    maxX = Math.max(x1, painted ? painted[0] + painted[2] + 2 : x1),
    maxY = Math.max(y1, painted ? painted[1] + painted[3] + 2 : y1);
  return [minX, minY, maxX - minX, maxY - minY].map((v) => +v.toFixed(2));
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
  const b = box(id, part, dir);
  let q = defaultPivot;
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
    // The side tail grows from the rear hip; wings fold around the back.
    if (part === "tail") q = [100 - side * 14, 144];
    if (part === "wings" && id !== "auralynx")
      q = [100 - side * 12, id === "terradon" ? 134 : 126];
  }
  q = pivot(part, q[0], q[1]);
  if (dir === "up") {
    if (part === "armL") q = pivot(part, 80, 122);
    if (part === "armR") q = pivot(part, 120, 122);
    if (part === "legL") q = pivot(part, 87, 151);
    if (part === "legR") q = pivot(part, 113, 151);
    if (part === "tail")
      q = [
        id === "duskveil"
          ? 123
          : id === "cindrake"
            ? 116
            : id === "tidefin"
              ? 110
              : 100,
        148,
      ];
  }
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
    ...directions
      .filter((dir) => dir !== "down")
      .flatMap((dir) => {
        const boxes = parts.map((part) => box(id, part, dir));
        const x = Math.min(...boxes.map((b) => b[0])) - 2,
          y = Math.min(...boxes.map((b) => b[1])) - 2;
        const w = Math.max(...boxes.map((b) => b[0] + b[2])) - x + 2,
          h = Math.max(...boxes.map((b) => b[1] + b[3])) - y + 2;
        return (
          dir === "up"
            ? (["normal"] as Mood[])
            : (["normal", ...MOODS] as Mood[])
        ).map((mood) => ({
          key: wholeKey(id, dir, mood, skinSuffix(id, look)),
          url:
            "data:image/svg+xml;base64," +
            btoa(
              creatureSvgRenderer(
                id,
                dir,
                mood,
                look,
              )(
                undefined,
                [x, y, w, h].join(" "),
                id === "auralynx" ? ["wings"] : [],
              ).replace(/<ellipse class="fighter-shadow"[^>]*\/>/, ""),
            ),
          width: w,
          height: h,
          originX: (100 - x) / w,
          originY: (130 - y) / h,
          x: 0,
          y: 0,
        }));
      }),
  ];
}
/** A point of the creature art (200×190 canvas) in rig pixels from its root. */
export function rigPoint(part: Part, x: number, y: number) {
  const [px, py] = proportioned(part, x, y);
  return { x: (px - 100) * 0.5, y: (py - 130) * 0.5 };
}

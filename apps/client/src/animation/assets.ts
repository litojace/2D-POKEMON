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
import {
  frontPartBounds,
  profilePartBounds,
  profilePivot,
  profileArtX,
} from "../creature-profile";
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
  earFar: { bounds: [5, 0, 190, 115], pivot: [100, 65] },
  ears: { bounds: [5, 0, 190, 115], pivot: [100, 65] },
  eyes: { bounds: [52, 68, 96, 44], pivot: [100, 93] },
  scarf: { bounds: [35, 90, 150, 84], pivot: [100, 118] },
  flame: { bounds: [30, -2, 140, 110], pivot: [100, 65] },
};
/**
 * Costumes reach past the champion's own outline (a surfboard on the back,
 * a lantern on a pole, a cape's hem, a hat's brim): with one on, these parts
 * crop a wider box (art units, before proportions) so nothing is cut off.
 */
const COSTUME_BOUNDS: Partial<Record<Part, number[]>> = {
  body: [0, 0, 200, 190],
  scarf: [0, -20, 200, 210],
  wings: [0, -60, 200, 250],
  flame: [0, -14, 200, 204],
  armR: [0, 50, 200, 140],
};
const COSTUMES = /^(modern-|vanguard$|sky-pirates$)/;
const wearsCostume = (look: SkinLook | null) =>
  !!look &&
  (SKIN_ART[look.skin]?.accessories ?? []).some((a) => COSTUMES.test(a));
/** A part's crop box once its proportion transform is applied. */
function box(id: CharacterId, part: Part, dir: Facing, costume = false) {
  const profile = dir === "left" || dir === "right";
  // Side headbands trail behind the gills; keep their ribbons in the crop.
  const [sourceX, y, w, h] =
    profile && part === "flame" ? [10, -2, 180, 110] : definitions[part].bounds;
  // Tidefin's blade projects forward in profile; its crop follows the turn.
  const x = dir === "left" && part === "armR" ? 200 - sourceX - w : sourceX;
  const [x0, y0] = proportioned(part, x, y),
    [x1, y1] = proportioned(part, x + w, y + h);
  const own =
    dir !== "down"
      ? profilePartBounds(id, dir, part)
      : frontPartBounds(id, part);
  const wide = costume ? COSTUME_BOUNDS[part] : undefined;
  const extra =
    own && wide
      ? (() => {
          const ux = Math.min(own[0], wide[0]),
            uy = Math.min(own[1], wide[1]);
          return [
            ux,
            uy,
            Math.max(own[0] + own[2], wide[0] + wide[2]) - ux,
            Math.max(own[1] + own[3], wide[1] + wide[3]) - uy,
          ];
        })()
      : (own ?? wide);
  const [ex0, ey0] = extra ? proportioned(part, extra[0], extra[1]) : [x0, y0];
  const [ex1, ey1] = extra
    ? proportioned(part, extra[0] + extra[2], extra[1] + extra[3])
    : [x1, y1];
  const minX = profileArtX(dir, part, Math.min(x0, ex0 - 2)),
    minY = Math.min(y0, ey0 - 2),
    maxX = profileArtX(dir, part, Math.max(x1, ex1 + 2)),
    maxY = Math.max(y1, ey1 + 2);
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
/** Head/face pivots follow the authored neck joint in each view. */
export function rigAnchorsFor(id: CharacterId, dir: Facing) {
  if (dir === "down") return rigAnchors;
  const head = pivot("head", ...profilePivot(id, dir, "head")!)[1];
  return {
    headY: (head - 130) * 0.5,
    eyesLift: (head - pivot("eyes", 100, 93)[1]) * 0.5,
    earsLift: (head - pivot("ears", 100, 65)[1]) * 0.5,
  };
}

/**
 * Each rig texture's width in art units, by key. A texture rasterized bigger
 * than that (the menu previews' sharper rigs) is drawn at this size: see
 * FighterRig's images and `cosmeticLayer`.
 */
export const artWidths = new Map<string, number>();
/**
 * Each rig texture's pivot as a fraction of its crop (Phaser's origin), by
 * key. A costume crops some parts in a wider box than the champion's own
 * (COSTUME_BOUNDS), so the same pivot sits at another fraction of it: the
 * rig sets this whenever a part changes texture (rig.ts), or the part would
 * keep the default crop's fractions and be drawn tens of units off its joint.
 */
export const artOrigins = new Map<string, readonly [number, number]>();
/** The drawing behind the asset just made (for its light layers). */
let lastSvg = "";
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
  const b = box(id, part, dir, wearsCostume(look));
  const joint =
    dir === "down"
      ? defaultPivot
      : (profilePivot(id, dir, part) ?? defaultPivot);
  const q = pivot(part, joint[0], joint[1]);
  const key =
    part === "eyes"
      ? moodKey(id, dir, mood, suffix)
      : rigKey(id, dir, part, suffix);
  artWidths.set(key, b[2]);
  const originX = (q[0] - b[0]) / b[2],
    originY = (q[1] - b[1]) / b[3];
  artOrigins.set(key, [originX, originY]);
  const svg = render(part, b.join(" "));
  lastSvg = svg;
  return {
    key,
    url: "data:image/svg+xml;base64," + btoa(svg),
    width: b[2],
    height: b[3],
    originX,
    originY,
    x: (q[0] - 100) * 0.5,
    y: (q[1] - 130) * 0.5,
  };
}
/**
 * Glowing pieces (`<g class="lume" data-lume=… data-i=…>` in a costume) get
 * their own light layers, one per way of glowing: the part's texture with
 * only those pieces showing, softened by a glow. The rig lays each over its
 * part with additive blending and fades it in time (see FighterRig), the way
 * games animate an emissive mask. Chases, blinks and twinkles split into two
 * phases (even and odd lights) so neighbours light in turn.
 */
export type LumeKind = "pulse" | "blink" | "chase" | "twinkle";
export interface LumeLayer {
  key: string;
  kind: LumeKind;
  phase: number;
}
/** Light layers by the part texture they sit on. */
export const lumeLayers = new Map<string, LumeLayer[]>();
const LUME =
  /<g class="lume" data-lume="(pulse|blink|chase|twinkle)" data-i="(\d+)"/g;
const LUME_STYLE =
  `<defs><filter id="lume-glow" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="2.6" result="b"/>` +
  `<feMerge><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>` +
  `<style>*{visibility:hidden}clipPath *,mask *{visibility:visible}.lume-on,.lume-on *{visibility:visible}.lume-on{filter:url(#lume-glow)}</style>`;
function lumeAssets(base: RigAsset, svg: string): RigAsset[] {
  if (!svg.includes('class="lume"')) return [];
  const found = new Map<string, LumeLayer>();
  for (const m of svg.matchAll(LUME)) {
    const kind = m[1] as LumeKind;
    const phase = kind === "pulse" ? 0 : +m[2] % 2;
    const key = `${base.key}~lume-${kind}${phase}`;
    found.set(key, { key, kind, phase });
  }
  const layers = [...found.values()];
  lumeLayers.set(base.key, layers);
  return layers.map((l) => {
    const marked = svg.replace(LUME, (all, kind: string, i: string) =>
      kind === l.kind && (kind === "pulse" ? 0 : +i % 2) === l.phase
        ? all.replace('class="lume"', 'class="lume lume-on"')
        : all,
    );
    const open = marked.indexOf(">", marked.indexOf("<svg")) + 1;
    const only = marked.slice(0, open) + LUME_STYLE + marked.slice(open);
    artWidths.set(l.key, base.width);
    artOrigins.set(l.key, [base.originX, base.originY]);
    return {
      ...base,
      key: l.key,
      url:
        "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(only))),
    };
  });
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
  // Each normal facing supplies thirteen crops. Building its patterns, masks
  // and Awakening accessories for every crop stalls the animation thread.
  const drawings = new Map(
    directions.map((dir) => [
      dir,
      creatureSvgRenderer(id, dir, "normal", look),
    ]),
  );
  return [
    ...directions.flatMap((dir) =>
      parts.flatMap((part) => {
        const a = asset(id, dir, part, "normal", look, drawings.get(dir)!);
        return [a, ...lumeAssets(a, lastSvg)];
      }),
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

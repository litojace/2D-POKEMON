import type { CharacterId } from "@arena/shared";
import type { CreaturePart, Mood } from "./creature-design";
import type { Palette } from "./skins/skin-art";
import reference from "./art/reference-profiles.json";
import rearReference from "./art/reference-backs.json";
type PaintedFacing = "left" | "right" | "up";

interface ProfileDrawing {
  palette: Palette;
  prefix: string;
  mood: Mood;
  eye: (x: number, ring: string, width: number, height: number) => string;
  expression: (
    x: number,
    width: number,
    height: number,
    ink?: string,
  ) => string;
}
interface PaintedPart {
  bounds: number[];
  image: string;
}
interface PaintedProfile {
  parts: Partial<Record<CreaturePart, PaintedPart>>;
  eye?: { x: number; y: number; rx: number; ry: number; paint: number[] };
}
const profiles = Object.fromEntries(
  Object.keys(reference.profiles).map((id) => [
    id,
    {
      ...reference.profiles[id as CharacterId],
      ...rearReference.profiles[id as CharacterId],
    },
  ]),
) as Record<CharacterId, Record<PaintedFacing, PaintedProfile>>;

/** Final art coordinates, including the reference tails and ribbons. */
export function profilePartBounds(
  id: CharacterId,
  dir: PaintedFacing,
  part: CreaturePart,
) {
  return profiles[id][dir].parts[part]?.bounds;
}

export function profileViewBox(id: CharacterId, dir: PaintedFacing) {
  const boxes = Object.values(profiles[id][dir].parts).map((a) => a.bounds);
  const x = Math.min(0, ...boxes.map((b) => b[0])) - 4;
  const y = Math.min(-12, ...boxes.map((b) => b[1])) - 4;
  const right = Math.max(200, ...boxes.map((b) => b[0] + b[2])) + 4;
  const bottom = Math.max(190, ...boxes.map((b) => b[1] + b[3])) + 4;
  return [x, y, right - x, bottom - y].join(" ");
}

const MID: Record<CharacterId, string> = {
  voltkit: "#ffd65b",
  cindrake: "#ff7a4f",
  tidefin: "#4fd6e6",
  auralynx: "#7f9cff",
  lumoth: "#86f0c0",
  mystowl: "#ff79d2",
  terradon: "#c79a5b",
  duskveil: "#9c6bff",
};
function hue(hex: string) {
  const [r, g, b] = [1, 3, 5].map(
    (i) => parseInt(hex.slice(i, i + 2), 16) / 255,
  );
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min;
  return {
    h: !d
      ? 0
      : 60 *
        (max === r
          ? (g - b) / d
          : max === g
            ? (b - r) / d + 2
            : (r - g) / d + 4),
    s: max ? d / max : 0,
    v: max,
  };
}

/**
 * Actual pixels from the approved illustrations, split at the existing joints.
 * Each facing has its own source art. Inverse transforms cancel the outer
 * FACE/FRAME proportions so the copied head and body keep their original shape.
 */
export function creatureProfile(
  id: CharacterId,
  direction: PaintedFacing,
  drawing: ProfileDrawing,
): { layers: Record<CreaturePart, string>; defs: string } {
  const { palette, prefix, mood, expression } = drawing;
  const profile = profiles[id][direction];
  const base = hue(MID[id]),
    target = hue(palette.mid);
  const changed = palette.mid.toLowerCase() !== MID[id];
  const filterId = `${prefix}-reference-colours`;
  const filter = changed
    ? `<defs><filter id="${filterId}" color-interpolation-filters="sRGB"><feColorMatrix type="hueRotate" values="${target.h - base.h}"/><feColorMatrix type="saturate" values="${Math.min(2, target.s / Math.max(0.1, base.s))}"/><feComponentTransfer>${["R", "G", "B"].map((c) => `<feFunc${c} type="linear" slope="${Math.min(1.3, target.v / Math.max(0.1, base.v))}"/>`).join("")}</feComponentTransfer></filter></defs>`
    : "";
  const result = {} as Record<CreaturePart, string>;
  for (const part of [
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
    "scarf",
    "flame",
  ] as const) {
    const asset = profile.parts[part];
    let art = "";
    if (asset) {
      const [x, y, width, height] = asset.bounds;
      art = `<image x="${x}" y="${y}" width="${width}" height="${height}" href="${asset.image}"/>`;
    }
    if (part === "eyes" && profile.eye) {
      const { x, y, rx, ry } = profile.eye;
      if (mood !== "normal" && mood !== "focus") {
        art = `<g transform="translate(${x} ${y}) scale(${rx / 10} ${ry / 12}) translate(-100 -93)">${expression(100, 9, 11, id === "duskveil" ? palette.glow : palette.dark)}</g>`;
      } else if (mood === "focus") {
        const d = direction === "right" ? 1 : -1;
        art += `<path d="M${x - d * rx} ${y - ry}L${x + d * rx} ${y - ry * 0.55}" stroke="${palette.dark}" stroke-width="2.8" stroke-linecap="round"/>`;
      }
      art = `<g class="profile-near-eye">${art}</g>`;
    }
    const face = ["head", "ears", "eyes", "flame"].includes(part);
    const s = face ? 1.17 : 0.86,
      cx = 100,
      cy = face ? 118 : 172;
    const inverse = `matrix(${1 / s} 0 0 ${1 / s} ${cx - cx / s} ${cy - cy / s})`;
    result[part] = art
      ? `<g class="profile-part profile-${part} reference-profile" data-reference-facing="${direction}"><g transform="${inverse}"${changed ? ` filter="url(#${filterId})"` : ""}>${art}</g></g>`
      : "";
  }
  return { layers: result, defs: filter };
}

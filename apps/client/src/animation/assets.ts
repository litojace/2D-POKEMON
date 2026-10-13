import type { CharacterId } from "@arena/shared";
import {
  creatureSvg,
  creatureParts,
  type CreaturePart,
} from "../creature-design";
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
export function rigKey(id: CharacterId, dir: Facing, part: Part) {
  return `rig-${id}-${dir}-${part}`;
}
const definitions: Record<Part, { bounds: number[]; pivot: number[] }> = {
  tail: { bounds: [5, 50, 190, 125], pivot: [130, 137] },
  wings: { bounds: [10, 40, 180, 115], pivot: [100, 115] },
  legL: { bounds: [50, 135, 90, 45], pivot: [78, 151] },
  legR: { bounds: [60, 135, 90, 45], pivot: [122, 151] },
  body: { bounds: [48, 103, 104, 70], pivot: [100, 130] },
  armL: { bounds: [39, 114, 101, 52], pivot: [65, 122] },
  armR: { bounds: [60, 114, 101, 52], pivot: [135, 122] },
  head: { bounds: [35, 40, 130, 91], pivot: [100, 100] },
  ears: { bounds: [25, 5, 150, 75], pivot: [100, 65] },
  eyes: { bounds: [60, 70, 80, 30], pivot: [100, 86] },
  scarf: { bounds: [35, 90, 150, 66], pivot: [100, 118] },
  flame: { bounds: [60, 5, 80, 75], pivot: [100, 65] },
};
export function rigAssets(id: CharacterId): RigAsset[] {
  return (["up", "down", "left", "right"] as Facing[]).flatMap((dir) =>
    parts.map((part) => {
      const { bounds: b, pivot: defaultPivot } = definitions[part];
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
      return {
        key: rigKey(id, dir, part),
        url:
          "data:image/svg+xml;base64," +
          btoa(creatureSvg(id, dir, part, b.join(" "))),
        width: b[2],
        height: b[3],
        originX: (q[0] - b[0]) / b[2],
        originY: (q[1] - b[1]) / b[3],
        x: (q[0] - 100) * 0.5,
        y: (q[1] - 130) * 0.5,
      };
    }),
  );
}

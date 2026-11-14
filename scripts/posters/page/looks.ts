/**
 * Each boss's materials (which painter treatment each rig piece gets) and
 * where its face is (kept crisp), for the poster painter (paint.ts).
 */
import type { Light, MatTable } from "./paint";

export const KEY: [number, number, number] = [-0.55, -0.7, 0.62];

export interface Look {
  mats: MatTable;
  light: Light;
  /** The face's half-size around the eyes, in world px (mouth included below). */
  face: [number, number];
}
const light = (o: Partial<Light>): Light => ({
  key: KEY,
  keyTint: [1.06, 1.0, 0.92],
  shadowTint: [0.72, 0.7, 0.92],
  rimColor: [1, 0.92, 0.75],
  bounceColor: [0.6, 0.5, 0.9],
  ...o,
});

export const LOOKS: Record<string, Look> = {
  emberwing: {
    face: [62, 52],
    light: light({
      keyTint: [1.08, 0.98, 0.85],
      shadowTint: [0.78, 0.6, 0.78],
      rimColor: [1, 0.85, 0.55],
      bounceColor: [1, 0.45, 0.25],
    }),
    mats: [
      [/eyes|mouth/, { keep: true }],
      [
        /body/,
        {
          tex: "paper",
          strength: 0.75,
          round: 1,
          spec: 0.08,
          sss: [0.32, 0.12, 0.0],
          sssK: 0.35,
          expose: 0.86,
          rim: 0.7,
        },
      ],
      [/arm/, { spec: 0.55, shin: 30, round: 0.7 }],
      [/burn/, { strength: 0.4, spec: 0.05 }],
    ],
  },
  tidewyrm: {
    face: [64, 50],
    light: light({
      keyTint: [1.02, 1.04, 1.04],
      shadowTint: [0.62, 0.72, 0.92],
      rimColor: [0.85, 1, 1],
      bounceColor: [0.25, 0.85, 0.9],
    }),
    mats: [
      [/swirl/, { skip: true }],
      [
        /body|head|tail|leg/,
        {
          spec: 0.55,
          shin: 80,
          tex: "caustic",
          glitter: 0.0015,
          rim: 0.85,
          round: 0.95,
        },
      ],
      [/gill/, { strength: 0.5, round: 1.3, spec: 0.12, rim: 0.4 }],
      [/pearl/, { spec: 1, shin: 90, round: 1 }],
      [/eye_|mouth/, { keep: true }],
    ],
  },
  gloomshade: {
    face: [58, 46],
    light: light({
      keyTint: [0.98, 0.95, 1.08],
      shadowTint: [0.55, 0.5, 0.85],
      rimColor: [0.9, 0.8, 1],
      bounceColor: [0.6, 0.35, 1],
      key2: [-0.8, 0.35, 0.5],
      key2Color: [1, 0.78, 0.45],
    }),
    mats: [
      [/drips/, { skip: true }],
      [
        /body|arm|tail|deep|hangs/,
        {
          spec: 0.85,
          shin: 60,
          spec2: 0.9,
          tex: "ink",
          sss: [0.22, 0.08, 0.4],
          sssK: 0.18,
          rim: 0.8,
          glitter: 0.001,
        },
      ],
      [/eyes|mouth/, { keep: true }],
    ],
  },
  grumblecrag: {
    face: [40, 44],
    light: light({
      keyTint: [1.08, 1.0, 0.86],
      shadowTint: [0.7, 0.62, 0.78],
      rimColor: [1, 0.9, 0.65],
      bounceColor: [1, 0.7, 0.3],
    }),
    mats: [
      [
        /body|over/,
        {
          tex: "fleece",
          cream: [0.98, 0.91, 0.76],
          strength: 0.75,
          spec: 0.04,
          rim: 0.65,
          round: 0.85,
          amb: 0.58,
          expose: 1.14,
        },
      ],
      [
        /head/,
        {
          cream: [0.98, 0.91, 0.76],
          strength: 0.6,
          spec: 0.08,
          amb: 0.55,
          expose: 1.08,
        },
      ],
      [
        /horns/,
        { tex: "horn", spec: 0.6, shin: 30, round: 0.8, glitter: 0.004 },
      ],
      [/leg/, { round: 0.6, spec: 0.1 }],
      [/eyes|mouth/, { keep: true }],
    ],
  },
};

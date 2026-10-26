/** Shared presentation conventions. World positions and combat shapes are not
 * transformed here: upright actors meet the ground at their authored feet. */
export const WORLD_ART = {
  groundY: 0.65,
  spritePadding: 12,
  fighterFeet: 21,
  sun: { x: 0.42, y: 0.08 },
  shadow: { alpha: 0.34, blur: 14 },
} as const;

/** Height of a circular ground feature for a given full width. */
export const groundHeight = (width: number) => width * WORLD_ART.groundY;

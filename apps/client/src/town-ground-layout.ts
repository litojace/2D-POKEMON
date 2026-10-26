import { WORLD_ART } from "../../../packages/shared/src/world-art";

type Point = readonly [number, number];
/** Offset curves in the unprojected ground plane, then project ONCE. This
 * keeps road widths and their stone pattern consistent through every bend. */
export function groundRoadOutline(
  pts: readonly Point[],
  width: number,
): Point[] {
  if (pts.length < 2) return [];
  const yScale = WORLD_ART.groundY,
    radius = width / 2;
  const angles = pts.map((_, i) => {
    const a = pts[Math.max(0, i - 1)],
      b = pts[Math.min(pts.length - 1, i + 1)];
    return Math.atan2((b[1] - a[1]) / yScale, b[0] - a[0]);
  });
  const offset = (p: Point, angle: number): Point => [
    p[0] + Math.cos(angle) * radius,
    p[1] + Math.sin(angle) * radius * yScale,
  ];
  const left = pts.map((p, i) => offset(p, angles[i] + Math.PI / 2));
  const right = pts.map((p, i) => offset(p, angles[i] - Math.PI / 2)).reverse();
  const cap = (p: Point, angle: number) =>
    Array.from({ length: 9 }, (_, i) => offset(p, angle - (i / 8) * Math.PI));
  return [
    ...left,
    ...cap(pts.at(-1)!, angles.at(-1)! + Math.PI / 2),
    ...right,
    ...cap(pts[0], angles[0] - Math.PI / 2),
  ];
}

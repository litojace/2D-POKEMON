/** Fit desktop/portrait; distribute the complete court across landscape touch screens. */
export function arenaViewport(
  width: number,
  height: number,
  landscapeTouch: boolean,
) {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const fit = Math.min(width / 1600, height / 900);
  const zoomX = landscapeTouch ? width / 1600 : fit;
  const zoomY = landscapeTouch ? height / 900 : fit;
  return { zoomX, zoomY, fighterX: fit / zoomX, fighterY: fit / zoomY };
}

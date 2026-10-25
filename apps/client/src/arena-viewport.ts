/**
 * Uniform projection only: circles stay round and visuals match hitboxes.
 * Desktop/portrait fit the whole court; landscape touch screens fill the arena
 * box (cover) and the follow camera scrolls, so fighters are larger on phones.
 */
export function arenaViewport(
  width: number,
  height: number,
  landscapeTouch: boolean,
  /** World shown above the court (y < 0), e.g. a court's stands. */
  top = 0,
) {
  width = Math.max(1, width);
  height = Math.max(1, height);
  const zoom = landscapeTouch
    ? Math.max(width / 1600, height / 900)
    : Math.min(width / 1600, height / (900 + top));
  return { zoomX: zoom, zoomY: zoom, fighterX: 1, fighterY: 1 };
}

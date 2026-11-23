import { decodePng } from "./png";

type Box = { x: number; y: number; width: number; height: number };

/**
 * Where a label's letters sit inside its box, from a page screenshot (taken
 * at `scale` device pixels per CSS pixel) and the box's place on the page:
 * the ink (pixels far from the box's own colour, its most common one)
 * against the box's middle. Returns the ink centre's offset from the box's
 * centre in CSS pixels (positive: right of / below the middle).
 */
export function inkOffset(png: Buffer, box: Box, scale: number) {
  const { width, data } = decodePng(png);
  // Inset by the corner radius' worth so the rounded corners don't count.
  const inset = Math.round(2 * scale);
  const left = Math.round(box.x * scale),
    top = Math.round(box.y * scale),
    right = Math.round((box.x + box.width) * scale),
    bottom = Math.round((box.y + box.height) * scale);
  const at = (x: number, y: number) => {
    const i = (y * width + x) * 4;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const counts = new Map<string, number>();
  for (let y = top + inset; y < bottom - inset; y++)
    for (let x = left + inset; x < right - inset; x++) {
      const k = at(x, y).join(",");
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
  const bg = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])[0][0]
    .split(",")
    .map(Number);
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -1,
    y1 = -1;
  for (let y = top + inset; y < bottom - inset; y++)
    for (let x = left + inset; x < right - inset; x++) {
      const [r, g, b] = at(x, y);
      if (Math.abs(r - bg[0]) + Math.abs(g - bg[1]) + Math.abs(b - bg[2]) < 150)
        continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
  if (x1 < 0) throw new Error("no letters found in the label");
  return {
    dx: ((x0 + x1 + 1) / 2 - (left + right) / 2) / scale,
    dy: ((y0 + y1 + 1) / 2 - (top + bottom) / 2) / scale,
  };
}

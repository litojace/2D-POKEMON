/**
 * The QR code on shared pictures (share-link.ts holds the address). The
 * encoder is qrcode-generator (MIT); this file is only loaded when a
 * picture is drawn, never with the game's first scripts.
 */
import qrcode from "qrcode-generator";

/** Quiet zone around the code, in modules: the standard's 4, so a camera
 * finds it on any background, printed or on a screen. */
export const QR_MARGIN = 4;

/** The code's dark (true) and light modules, row by row. Level M: up to
 * 15% of it can be smudged or covered and it still reads. */
export function qrMatrix(text: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(text, "Byte");
  qr.make();
  const n = qr.getModuleCount();
  return Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => qr.isDark(r, c)),
  );
}

/**
 * Draw the code on a white rounded square (its quiet zone) of `size` px at
 * x, y. Module edges are rounded to whole pixels, so neighbouring modules
 * never leave a hairline between them.
 */
export function drawQr(
  g: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  size: number,
) {
  const m = qrMatrix(text);
  const n = m.length;
  const cell = size / (n + 2 * QR_MARGIN);
  g.save();
  g.fillStyle = "#ffffff";
  g.beginPath();
  // The corners stay inside the quiet zone.
  g.roundRect(x, y, size, size, Math.min(cell * 2.5, size * 0.08));
  g.fill();
  g.fillStyle = "#0b1020";
  const edge = (i: number) => Math.round(x + (QR_MARGIN + i) * cell);
  const edgeY = (i: number) => Math.round(y + (QR_MARGIN + i) * cell);
  for (let r = 0; r < n; r++) {
    let c = 0;
    while (c < n) {
      if (!m[r][c]) {
        c++;
        continue;
      }
      const start = c;
      while (c < n && m[r][c]) c++;
      g.fillRect(
        edge(start),
        edgeY(r),
        edge(c) - edge(start),
        edgeY(r + 1) - edgeY(r),
      );
    }
  }
  g.restore();
  return { modules: n, cell };
}

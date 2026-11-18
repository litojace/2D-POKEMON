/**
 * Turning SVG artwork into pixels off the critical path: the fighters' rig
 * layers before a battle (fighter-prepaint.ts) and skin thumbnails
 * (skin-thumbnails.ts).
 */

/** A quiet moment (or `timeout` ms, whichever comes first). */
export function idle(timeout: number) {
  return new Promise<void>((resolve) => {
    const w = window as Window & {
      requestIdleCallback?: (
        cb: () => void,
        opts?: { timeout: number },
      ) => number;
    };
    if (w.requestIdleCallback)
      w.requestIdleCallback(() => resolve(), { timeout });
    else setTimeout(resolve, 0);
  });
}

/** The SVG at the texture's size, as Phaser's SVGFile resizes it. */
export function sizedSvg(text: string, width: number, height: number) {
  const xml = new DOMParser().parseFromString(text, "text/xml");
  const svg = xml.getElementsByTagName("svg")[0];
  if (!svg) return text;
  const w = parseFloat(svg.getAttribute("width") ?? "");
  const h = parseFloat(svg.getAttribute("height") ?? "");
  if (!svg.hasAttribute("viewBox") && w && h)
    svg.setAttribute("viewBox", `0  0 ${w} ${h}`);
  svg.setAttribute("width", `${width}px`);
  svg.setAttribute("height", `${height}px`);
  return new XMLSerializer().serializeToString(svg);
}

let crcTable: Uint32Array | undefined;
function crc32(bytes: Uint8Array) {
  if (!crcTable) {
    crcTable = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      crcTable[n] = c >>> 0;
    }
  }
  let c = ~0;
  for (let i = 0; i < bytes.length; i++)
    c = crcTable[(c ^ bytes[i]) & 255] ^ (c >>> 8);
  return ~c >>> 0;
}
function pngChunk(type: string, data: Uint8Array) {
  const out = new Uint8Array(12 + data.length);
  const view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/**
 * A PNG of the canvas, made at once. The browser's own encoders
 * (`toBlob`, `convertToBlob`) wait for idle time, and a menu with a live
 * fighter on it has little: they took a second or more each (Nov 2026). Here
 * the pixels are read back and compressed by a CompressionStream, which
 * doesn't wait; without one, `toBlob`.
 */
export async function canvasPng(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
) {
  const { width, height } = canvas;
  if (typeof CompressionStream === "undefined")
    return new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
  const rgba = ctx.getImageData(0, 0, width, height).data;
  // Each row filtered "Sub" (the difference from the pixel on its left), in
  // one pass: skin thumbnails came out a little smaller than the browser's
  // own PNGs of them (63–70 KB against 75–87 KB at 371×378).
  const stride = width * 4;
  const raw = new Uint8Array((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const o = y * (stride + 1) + 1,
      r = y * stride;
    raw[o - 1] = 1;
    for (let x = 0; x < 4; x++) raw[o + x] = rgba[r + x];
    for (let x = 4; x < stride; x++)
      raw[o + x] = (rgba[r + x] - rgba[r + x - 4]) & 255;
  }
  const deflated = new Uint8Array(
    await new Response(
      new Blob([raw]).stream().pipeThrough(new CompressionStream("deflate")),
    ).arrayBuffer(),
  );
  const header = new Uint8Array(13);
  const view = new DataView(header.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  header[8] = 8; // 8 bits per channel
  header[9] = 6; // RGBA, not premultiplied (as getImageData gives it)
  return new Blob(
    [
      new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
      pngChunk("IHDR", header),
      pngChunk("IDAT", deflated),
      pngChunk("IEND", new Uint8Array()),
    ],
    { type: "image/png" },
  );
}

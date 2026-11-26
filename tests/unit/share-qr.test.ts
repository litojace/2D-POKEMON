import { describe, expect, it } from "vitest";
import jsQR from "jsqr";
import { QR_MARGIN, drawQr, qrMatrix } from "../../apps/client/src/share-qr";
import {
  SHARE_SITE,
  shareLink,
  shownSite,
} from "../../apps/client/src/share-link";
import { previewWays } from "../../apps/client/src/share-preview-ways";
import { blocksMenu, SAVE_PICTURE } from "../../apps/client/src/touch-hold";

/**
 * A pretend 2D canvas that paints rectangles into RGBA pixels, enough for
 * drawQr: the white rounded square (drawn as its box) and the modules. The
 * pixels go to jsQR, a decoder that has nothing to do with the encoder.
 */
function raster(w: number, h: number, background = [11, 16, 32]) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let i = 0; i < w * h; i++) data.set([...background, 255], i * 4);
  let fill = [0, 0, 0];
  let path: [number, number, number, number] | null = null;
  const paint = (x: number, y: number, rw: number, rh: number) => {
    for (
      let yy = Math.max(0, Math.round(y));
      yy < Math.min(h, Math.round(y + rh));
      yy++
    )
      for (
        let xx = Math.max(0, Math.round(x));
        xx < Math.min(w, Math.round(x + rw));
        xx++
      )
        data.set([...fill, 255], (yy * w + xx) * 4);
  };
  const g = {
    save() {},
    restore() {},
    beginPath() {},
    set fillStyle(c: string) {
      fill = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
    },
    roundRect(x: number, y: number, rw: number, rh: number) {
      path = [x, y, rw, rh];
    },
    fill() {
      if (path) paint(...path);
      path = null;
    },
    fillRect: paint,
  };
  return { g: g as unknown as CanvasRenderingContext2D, data };
}

/** Shrink pixels by an integer factor (a picture seen smaller), averaging. */
function shrink(data: Uint8ClampedArray, w: number, h: number, f: number) {
  const W = Math.floor(w / f),
    H = Math.floor(h / f);
  const out = new Uint8ClampedArray(W * H * 4);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      for (let c = 0; c < 4; c++) {
        let sum = 0;
        for (let dy = 0; dy < f; dy++)
          for (let dx = 0; dx < f; dx++)
            sum += data[((y * f + dy) * w + x * f + dx) * 4 + c];
        out[(y * W + x) * 4 + c] = sum / (f * f);
      }
  return { out, W, H };
}

describe("the QR code on shared pictures", () => {
  const link = shareLink("card");

  it("holds the game's address with where the visit came from", () => {
    expect(link).toBe(`${SHARE_SITE}/?ref=card`);
    expect(shareLink("result", "https://parena.litojace.com/")).toBe(
      "https://parena.litojace.com/?ref=result",
    );
    // A future site with its own path and query keeps them.
    expect(shareLink("card", "https://example.com/play?lang=en")).toBe(
      "https://example.com/play?lang=en&ref=card",
    );
    expect(shownSite("https://parena.litojace.com/")).toBe(
      "parena.litojace.com",
    );
    // Never the page's own origin (the app's is capacitor://localhost).
    expect(SHARE_SITE).toMatch(/^https:\/\//);
  });

  it("is a small, square code with the standard quiet zone", () => {
    const m = qrMatrix(link);
    expect(m.length).toBeGreaterThanOrEqual(21);
    // Version 3 or 4 at most: big modules, easy for a camera.
    expect(m.length).toBeLessThanOrEqual(33);
    expect(m.every((row) => row.length === m.length)).toBe(true);
    expect(QR_MARGIN).toBe(4);
  });

  for (const size of [120, 156, 224, 320]) {
    it(`decodes to the address when drawn ${size} px wide`, () => {
      const W = size + 80,
        H = size + 60;
      const { g, data } = raster(W, H);
      const { cell } = drawQr(g, link, 40, 30, size);
      expect(cell).toBeGreaterThan(2.5);
      const read = jsQR(data, W, H);
      expect(read?.data).toBe(link);
    });
  }

  it("still decodes when the picture is seen at half and a third size", () => {
    const W = 1200,
      H = 630;
    const { g, data } = raster(W, H);
    drawQr(g, link, 936, 346, 224);
    for (const f of [2, 3]) {
      const { out, W: w, H: h } = shrink(data, W, H, f);
      expect(jsQR(out, w, h)?.data).toBe(link);
    }
  });

  it("leaves no hairline between neighbouring modules", () => {
    // Whole-pixel edges: every module's pixels are all dark or all light.
    const size = 157; // an awkward size, cells are fractional
    const { g, data } = raster(size, size, [255, 255, 255]);
    const { modules, cell } = drawQr(g, link, 0, 0, size);
    const m = qrMatrix(link);
    for (let r = 0; r < modules; r++)
      for (let c = 0; c < modules; c++) {
        const x = Math.floor((QR_MARGIN + c + 0.5) * cell),
          y = Math.floor((QR_MARGIN + r + 0.5) * cell);
        const v = data[(y * size + x) * 4];
        expect(v < 128).toBe(m[r][c]);
      }
  });
});

describe("the picture preview", () => {
  it("offers what each device can really do", () => {
    // iPhone Safari or the installed web app: share sheet, hold to save.
    expect(
      previewWays({ ios: true, app: false, touch: true, canShare: true }),
    ).toEqual({
      share: true,
      save: false,
      filesOnly: true,
      hint: "Press and hold the picture, then Save to Photos.",
    });
    // The iPhone app: the same (its web view has no downloads).
    expect(
      previewWays({ ios: true, app: true, touch: true, canShare: true }).save,
    ).toBe(false);
    // Android Chrome: share, download, or hold.
    expect(
      previewWays({ ios: false, app: false, touch: true, canShare: true }),
    ).toEqual({
      share: true,
      save: true,
      filesOnly: false,
      hint: "Or press and hold the picture to download it.",
    });
    // A computer without a share sheet: Save image only.
    expect(
      previewWays({ ios: false, app: false, touch: false, canShare: false }),
    ).toEqual({ share: false, save: true, filesOnly: false, hint: "" });
  });

  it("lets the picture's own long-press menu through", () => {
    const picture = {
      closest: (s: string) => (s.includes(SAVE_PICTURE) ? {} : null),
    };
    expect(blocksMenu(picture)).toBe(false);
  });
});

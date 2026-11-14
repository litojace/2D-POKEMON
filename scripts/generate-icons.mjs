// Renders scripts/app-icon.svg to every icon the game ships:
//
//   node scripts/generate-icons.mjs
//
// - the iPhone app icon (1024 x 1024) in the Xcode asset catalog,
// - the iPhone launch screen: the icon's fighter, whole, at a fifth of the
//   square on the app's background colour #0b1020 (capacitor.config.ts),
// - the PWA icons in apps/client/public/icons. The maskable one (Android
//   may crop it to a circle of 80% of its width) shows the fighter whole and
//   smaller, so the circle never cuts the ears.
//
// The icon's <svg id="hero" data-fighter="..."> is filled with that
// fighter's portrait.svg, so the icon follows any redraw of the fighter.
//
// The SVG is drawn by the Chromium that Playwright uses (set PW_CHROMIUM to
// use another binary). Every PNG is written as plain RGB, without an alpha
// channel: App Store Connect rejects an app icon that has one, even if every
// pixel is opaque.
import { chromium } from "@playwright/test";
import { readFileSync, writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

const source = readFileSync(new URL("./app-icon.svg", import.meta.url), "utf8");
const hero = source.match(/<svg id="hero" data-fighter="(\w+)"[^>]*>/);
if (!hero)
  throw new Error('app-icon.svg needs <svg id="hero" data-fighter="...">');
const portrait = readFileSync(
  `apps/client/public/assets/fighters/${hero[1]}/portrait.svg`,
  "utf8",
);
/** The portrait's drawing, without its own <svg> element. */
const fighter = portrait.slice(
  portrait.indexOf(">") + 1,
  portrait.lastIndexOf("</svg>"),
);
const portraitBox = portrait.match(/viewBox="([^"]+)"/)[1];
/** The icon, with the hero element given new attributes (or kept as is). */
const icon = (attributes = hero[0]) =>
  source.replace(hero[0] + "</svg>", attributes + fighter + "</svg>");
const svg = icon();
// Whole fighter inside the maskable safe circle (radius 410 of 1024).
const maskable = icon(
  `<svg id="hero" x="187" y="190" width="650" height="650" viewBox="${portraitBox}">`,
);
// Whole fighter alone, for the launch screen.
const fighterOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${portraitBox}" width="1024" height="1024">${fighter}</svg>`;

const assets = "apps/client/ios/App/App/Assets.xcassets/";
const pwa = "apps/client/public/icons/";

/**
 * An RGB PNG (colour type 2, 8 bits) from rows of RGB bytes. Every row uses
 * the Paeth filter, which keeps the icon's smooth gradients small.
 */
function png(width, height, rgb) {
  const stride = width * 3;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const out = y * (stride + 1);
    rows[out] = 4;
    for (let i = 0; i < stride; i++) {
      const at = y * stride + i;
      const a = i >= 3 ? rgb[at - 3] : 0;
      const b = y > 0 ? rgb[at - stride] : 0;
      const c = i >= 3 && y > 0 ? rgb[at - stride - 3] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      rows[out + 1 + i] = (rgb[at] - predictor) & 0xff;
    }
  }
  const chunk = (type, data) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length);
    head.write(type, 4, "latin1");
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])));
    return Buffer.concat([head, data, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(rows, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const browser = await chromium.launch(
  process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
);
const page = await browser.newPage();

/** Draws `art` at `size` px, centred on a `canvas` px square of `background`. */
async function render(art, size, canvas = size, background = "#0b1020") {
  const base64 = await page.evaluate(
    async ({ art, size, canvas, background }) => {
      const image = new Image();
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(art);
      await image.decode();
      const element = document.createElement("canvas");
      element.width = element.height = canvas;
      const context = element.getContext("2d");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas, canvas);
      const offset = (canvas - size) / 2;
      context.drawImage(image, offset, offset, size, size);
      const rgba = context.getImageData(0, 0, canvas, canvas).data;
      const rgb = new Uint8Array((rgba.length / 4) * 3);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += 3) {
        rgb[j] = rgba[i];
        rgb[j + 1] = rgba[i + 1];
        rgb[j + 2] = rgba[i + 2];
      }
      let text = "";
      for (let i = 0; i < rgb.length; i += 0x8000)
        text += String.fromCharCode(...rgb.subarray(i, i + 0x8000));
      return btoa(text);
    },
    { art, size, canvas, background },
  );
  return png(canvas, canvas, Buffer.from(base64, "base64"));
}

writeFileSync(
  assets + "AppIcon.appiconset/AppIcon-512@2x.png",
  await render(svg, 1024),
);
const splash = await render(fighterOnly, 546, 2732);
for (const name of [
  "splash-2732x2732.png",
  "splash-2732x2732-1.png",
  "splash-2732x2732-2.png",
])
  writeFileSync(assets + "Splash.imageset/" + name, splash);
for (const [name, size] of [
  ["arena-192.png", 192],
  ["arena-512.png", 512],
  ["apple-touch-icon.png", 180],
])
  writeFileSync(pwa + name, await render(svg, size));
writeFileSync(pwa + "arena-maskable-512.png", await render(maskable, 512));

await browser.close();
console.log(
  `Rendered the app icon, launch screen and PWA icons from scripts/app-icon.svg (${hero[1]}).`,
);

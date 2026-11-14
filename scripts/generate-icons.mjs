// Renders scripts/app-icon.svg to every icon the game ships:
//
//   node scripts/generate-icons.mjs
//
// - the iPhone app icon (1024 x 1024) in the Xcode asset catalog, in its
//   three appearances (Contents.json is written too):
//   - default: the whole icon, opaque RGB (App Store Connect rejects an app
//     icon with an alpha channel, even if every pixel is opaque),
//   - dark: without #backdrop, on transparency, "so the system-provided
//     background can show through", and with the bolt and the clash toned
//     down (Apple: "avoid excessively bright images"),
//   - tinted: the dark icon as a grayscale image (gray + alpha), which iOS
//     colours with the tint the player picks,
// - the alternate app icons players pick in Settings → App icon (ALTERNATES
//   below, from scripts/app-icons): each its own icon set, with the same
//   three appearances, and a 144 px thumbnail in public/icons/app-icons for
//   the picker (with one of the default icon),
// - the iPhone launch screen: the icon's fighters, whole and facing each
//   other, on the app's background colour #0b1020 (capacitor.config.ts),
// - the PWA icons in apps/client/public/icons. Android may crop the maskable
//   one to a circle of 80% of its width, so there the [data-face] groups
//   shrink toward the centre and the circle shows the faces, not just eyes.
//
// Each empty <svg data-fighter="..."> in the icon is filled with that
// fighter's portrait.svg, so the icon follows any redraw of the fighters.
//
// The SVG is drawn by the Chromium that Playwright uses (set PW_CHROMIUM to
// use another binary). Apple's guidance for the appearances:
// https://developer.apple.com/documentation/xcode/configuring-your-app-icon
import { chromium } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { deflateSync, crc32 } from "node:zlib";

/** How much the faces and clash shrink in the maskable icon, about the clash point. */
const MASKABLE_FACE_SCALE = 0.68;
const CLASH = [512, 520];
/** The dark icon's bolt and clash opacity (the default icon's are 1). */
const DARK_BOLT = 0.7;
const DARK_CLASH = 0.45;
/**
 * The alternate app icons players can pick in Settings, as [asset catalog
 * set, source in scripts/app-icons]. apps/client/src/app-icon-setting.ts
 * lists the same sets, and the Xcode build setting
 * ASSETCATALOG_COMPILER_ALTERNATE_APPICON_NAMES names them;
 * tests/unit/app-icons.test.ts checks all three agree.
 */
const ALTERNATES = [
  ["AppIcon-Pyranda", "pyranda.svg"],
  ["AppIcon-SplitFace", "split-face.svg"],
  ["AppIcon-StareDown", "stare-down.svg"],
];
/** The Settings picker's thumbnails: 72 pt at 2x, in public/icons/app-icons. */
const THUMBNAIL = 144;

/** A fighter's drawing, without its own <svg> element, and its viewBox. */
function portrait(name) {
  const file = readFileSync(
    `apps/client/public/assets/fighters/${name}/portrait.svg`,
    "utf8",
  );
  return {
    art: file.slice(file.indexOf(">") + 1, file.lastIndexOf("</svg>")),
    box: file.match(/viewBox="([^"]+)"/)[1],
  };
}
/** An icon SVG with every empty <svg data-fighter> drawn in, and the names. */
function withFighters(text, file) {
  const found = [
    ...text.matchAll(/<svg data-fighter="(\w+)"[^>]*>(?=<\/svg>)/g),
  ];
  if (found.length === 0)
    throw new Error(
      `${file} needs at least one empty <svg data-fighter="...">`,
    );
  for (const [element, name] of found)
    text = text.replace(
      element + "</svg>",
      element + portrait(name).art + "</svg>",
    );
  return { svg: text, names: found.map(([, name]) => name) };
}
/** `text` with `from` replaced by `to`, which must occur exactly `count` times. */
function swap(text, from, to, count = 1, file = "app-icon.svg") {
  const found = text.split(from).length - 1;
  if (found !== count)
    throw new Error(`${file}: expected ${count} of ${from}, found ${found}`);
  return text.replaceAll(from, to);
}
/** The dark appearance: no #backdrop; #bolt and #clash, where drawn, toned down. */
function darken(svg, file) {
  let dark = swap(
    svg,
    '<g id="backdrop">',
    '<g id="backdrop" display="none">',
    1,
    file,
  );
  if (svg.includes('<g id="bolt" '))
    dark = swap(dark, '<g id="bolt" ', `<g id="bolt" opacity="${DARK_BOLT}" `);
  if (svg.includes('<g id="clash">'))
    dark = swap(
      dark,
      '<g id="clash">',
      `<g id="clash" opacity="${DARK_CLASH}">`,
    );
  return dark;
}

const main = withFighters(
  readFileSync(new URL("./app-icon.svg", import.meta.url), "utf8"),
  "app-icon.svg",
);
const svg = main.svg;
const fighters = main.names;
const [cx, cy] = CLASH;
// The clash shrinks with the faces, so it doesn't cover their inner eyes.
const shrink = `transform="translate(${cx} ${cy}) scale(${MASKABLE_FACE_SCALE}) translate(${-cx} ${-cy})"`;
let maskable = swap(
  svg,
  '<g data-face="" ',
  `<g data-face="" ${shrink} `,
  fighters.length,
);
maskable = swap(maskable, '<g id="clash">', `<g id="clash" ${shrink}>`);
const dark = darken(svg, "app-icon.svg");

// The launch screen: the fighters whole, side by side, the later ones
// mirrored to face the first.
const width = 1024 / fighters.length;
const fightersOnly = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${fighters
  .map((name, i) => {
    const { art, box } = portrait(name);
    const x = i * width;
    const drawing = `<svg x="${x}" y="${(1024 - width) / 2}" width="${width}" height="${width}" viewBox="${box}">${art}</svg>`;
    return i === 0
      ? drawing
      : `<g transform="translate(${2 * x + width} 0) scale(-1 1)">${drawing}</g>`;
  })
  .join("")}</svg>`;

const assets = "apps/client/ios/App/App/Assets.xcassets/";
const pwa = "apps/client/public/icons/";

/** PNG colour types by channel count: gray + alpha, RGB, RGBA. */
const COLOUR_TYPE = { 2: 4, 3: 2, 4: 6 };
/**
 * An 8-bit PNG from rows of `channels`-byte pixels. Every row uses the Paeth
 * filter, which keeps the icon's smooth gradients small.
 */
function png(width, height, pixels, channels) {
  const stride = width * channels;
  const rows = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    const out = y * (stride + 1);
    rows[out] = 4;
    for (let i = 0; i < stride; i++) {
      const at = y * stride + i;
      const a = i >= channels ? pixels[at - channels] : 0;
      const b = y > 0 ? pixels[at - stride] : 0;
      const c = i >= channels && y > 0 ? pixels[at - stride - channels] : 0;
      const p = a + b - c;
      const pa = Math.abs(p - a),
        pb = Math.abs(p - b),
        pc = Math.abs(p - c);
      const predictor = pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      rows[out + 1 + i] = (pixels[at] - predictor) & 0xff;
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
  ihdr.set([8, COLOUR_TYPE[channels], 0, 0, 0], 8);
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

/**
 * Draws `art` at `size` px, centred on a `canvas` px square. `format` is
 * "rgb" (on `background`), "rgba" (on transparency) or "gray-alpha" (on
 * transparency, as luminance).
 */
async function render(
  art,
  size,
  { canvas = size, background = "#0b1020", format = "rgb" } = {},
) {
  const channels = { "gray-alpha": 2, rgb: 3, rgba: 4 }[format];
  const base64 = await page.evaluate(
    async ({ art, size, canvas, background, format, channels }) => {
      const image = new Image();
      image.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(art);
      await image.decode();
      const element = document.createElement("canvas");
      element.width = element.height = canvas;
      const context = element.getContext("2d");
      if (format === "rgb") {
        context.fillStyle = background;
        context.fillRect(0, 0, canvas, canvas);
      }
      const offset = (canvas - size) / 2;
      context.drawImage(image, offset, offset, size, size);
      const rgba = context.getImageData(0, 0, canvas, canvas).data;
      const out = new Uint8Array((rgba.length / 4) * channels);
      for (let i = 0, j = 0; i < rgba.length; i += 4, j += channels) {
        if (format === "gray-alpha") {
          // Rec. 709 luma, as the eye weighs red, green and blue.
          out[j] = Math.round(
            0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2],
          );
          out[j + 1] = rgba[i + 3];
        } else {
          out[j] = rgba[i];
          out[j + 1] = rgba[i + 1];
          out[j + 2] = rgba[i + 2];
          if (channels === 4) out[j + 3] = rgba[i + 3];
        }
      }
      let text = "";
      for (let i = 0; i < out.length; i += 0x8000)
        text += String.fromCharCode(...out.subarray(i, i + 0x8000));
      return btoa(text);
    },
    { art, size, canvas, background, format, channels },
  );
  return png(canvas, canvas, Buffer.from(base64, "base64"), channels);
}

/**
 * Writes an app icon set: its default, dark and tinted 1024 px images and the
 * Contents.json that names them. `files` are the three file names.
 */
async function writeIconSet(set, light, dark, files) {
  const folder = `${assets}${set}.appiconset/`;
  mkdirSync(folder, { recursive: true });
  const appearances = [
    [files[0], null, await render(light, 1024)],
    [files[1], "dark", await render(dark, 1024, { format: "rgba" })],
    [files[2], "tinted", await render(dark, 1024, { format: "gray-alpha" })],
  ];
  for (const [file, , image] of appearances)
    writeFileSync(folder + file, image);
  writeFileSync(
    folder + "Contents.json",
    JSON.stringify(
      {
        images: appearances.map(([filename, value]) => ({
          ...(value && {
            appearances: [{ appearance: "luminosity", value }],
          }),
          filename,
          idiom: "universal",
          platform: "ios",
          size: "1024x1024",
        })),
        info: { author: "xcode", version: 1 },
      },
      null,
      2,
    ) + "\n",
  );
}

await writeIconSet("AppIcon", svg, dark, [
  "AppIcon-512@2x.png",
  "AppIcon-dark.png",
  "AppIcon-tinted.png",
]);
mkdirSync(pwa + "app-icons", { recursive: true });
writeFileSync(`${pwa}app-icons/AppIcon.png`, await render(svg, THUMBNAIL));
for (const [set, file] of ALTERNATES) {
  const alternate = withFighters(
    readFileSync(new URL(`./app-icons/${file}`, import.meta.url), "utf8"),
    file,
  );
  await writeIconSet(set, alternate.svg, darken(alternate.svg, file), [
    `${set}.png`,
    `${set}-dark.png`,
    `${set}-tinted.png`,
  ]);
  writeFileSync(
    `${pwa}app-icons/${set}.png`,
    await render(alternate.svg, THUMBNAIL),
  );
}

const splash = await render(fightersOnly, 820, { canvas: 2732 });
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
  `Rendered the app icon (${fighters.join(" vs ")}) and ${ALTERNATES.length} alternates, each default, dark and tinted, with their Settings thumbnails; the launch screen; and the PWA icons.`,
);

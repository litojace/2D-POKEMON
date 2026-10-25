/** Pixel-preserving import of the approved reference sheets. No generated art. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

const root = fileURLToPath(new URL("../", import.meta.url));
const source = root + "art-source/side-views/";
const sheets = ["first-four.png", "last-four.png"];
// Rectangles and joints are in the reference sheets' original pixel coordinates.
const spec = {
  voltkit: {
    sheet: 0,
    height: 150,
    roots: [835, 1324],
    boxes: [
      [755, 116, 235, 191],
      [1175, 116, 250, 191],
    ],
    eyes: [
      [818, 204, 17, 22],
      [1345, 202, 17, 22],
    ],
    regions: {
      tail: [
        [854, 250],
        [911, 238],
        [945, 194],
        [989, 199],
        [991, 307],
        [853, 307],
      ],
      wings: [
        [853, 246],
        [876, 249],
        [912, 292],
        [884, 285],
        [862, 297],
      ],
      legL: [
        [806, 284],
        [829, 283],
        [839, 304],
        [801, 305],
      ],
      legR: [
        [832, 281],
        [863, 279],
        [879, 307],
        [827, 307],
      ],
      armL: [
        [799, 249],
        [813, 246],
        [826, 272],
        [813, 287],
        [798, 282],
      ],
      armR: [
        [828, 245],
        [847, 246],
        [858, 271],
        [850, 290],
        [829, 289],
        [824, 276],
      ],
      head: [
        [761, 180],
        [800, 157],
        [853, 165],
        [895, 184],
        [900, 218],
        [879, 246],
        [824, 247],
        [775, 233],
      ],
      ears: [
        [775, 116],
        [914, 116],
        [917, 183],
        [879, 200],
        [785, 180],
      ],
      flame: [
        [787, 156],
        [822, 145],
        [876, 166],
        [899, 187],
        [892, 210],
        [852, 180],
        [791, 182],
      ],
      scarf: [
        [800, 244],
        [846, 239],
        [850, 253],
        [837, 273],
        [817, 264],
      ],
    },
  },
  cindrake: {
    sheet: 0,
    height: 182,
    roots: [825, 1348],
    boxes: [
      [748, 321, 240, 210],
      [1180, 321, 250, 211],
    ],
    eyes: [
      [800, 432, 17, 20],
      [1363, 433, 17, 20],
    ],
    regions: {
      tail: [
        [843, 473],
        [874, 475],
        [926, 471],
        [930, 409],
        [984, 409],
        [988, 522],
        [874, 527],
        [841, 506],
      ],
      legL: [
        [785, 504],
        [810, 500],
        [823, 529],
        [781, 530],
      ],
      legR: [
        [815, 500],
        [848, 494],
        [869, 532],
        [808, 532],
      ],
      armL: [
        [789, 473],
        [800, 469],
        [811, 495],
        [801, 510],
        [788, 501],
      ],
      armR: [
        [810, 468],
        [833, 472],
        [851, 495],
        [838, 514],
        [813, 507],
      ],
      head: [
        [748, 400],
        [794, 384],
        [858, 393],
        [887, 420],
        [879, 455],
        [844, 475],
        [796, 472],
        [757, 451],
      ],
      flame: [
        [772, 321],
        [930, 321],
        [931, 441],
        [878, 453],
        [868, 400],
        [790, 401],
      ],
      ears: [
        [832, 397],
        [850, 384],
        [884, 378],
        [870, 415],
        [852, 416],
      ],
    },
  },
  tidefin: {
    sheet: 0,
    height: 137,
    roots: [804, 1368],
    boxes: [
      [728, 558, 270, 178],
      [1168, 558, 270, 178],
    ],
    eyes: [
      [789, 620, 19, 22],
      [1380, 620, 19, 22],
    ],
    regions: {
      tail: [
        [831, 680],
        [872, 684],
        [933, 630],
        [998, 634],
        [998, 729],
        [841, 731],
      ],
      legL: [
        [777, 713],
        [799, 706],
        [812, 736],
        [774, 736],
      ],
      legR: [
        [795, 707],
        [830, 706],
        [843, 737],
        [791, 737],
      ],
      armL: [
        [783, 669],
        [793, 665],
        [802, 696],
        [790, 711],
        [781, 697],
      ],
      armR: [
        [797, 666],
        [820, 670],
        [833, 698],
        [819, 715],
        [796, 704],
      ],
      head: [
        [729, 585],
        [776, 568],
        [830, 580],
        [856, 612],
        [846, 647],
        [811, 672],
        [763, 668],
        [731, 649],
      ],
      flame: [
        [758, 558],
        [898, 559],
        [957, 582],
        [957, 658],
        [865, 657],
        [838, 602],
        [749, 592],
      ],
      ears: [
        [826, 562],
        [884, 562],
        [910, 585],
        [895, 646],
        [856, 655],
        [827, 627],
      ],
      scarf: [
        [780, 700],
        [838, 690],
        [848, 737],
        [823, 730],
        [799, 712],
      ],
    },
  },
  auralynx: {
    sheet: 0,
    height: 180,
    roots: [826, 1324],
    boxes: [
      [744, 752, 244, 228],
      [1172, 752, 244, 228],
    ],
    eyes: [
      [820, 866, 19, 23],
      [1349, 870, 19, 23],
    ],
    regions: {
      tail: [
        [852, 935],
        [874, 927],
        [922, 888],
        [944, 943],
        [892, 964],
        [852, 956],
      ],
      wings: [
        [901, 826],
        [988, 827],
        [988, 973],
        [875, 979],
        [874, 958],
        [922, 945],
      ],
      legL: [
        [782, 955],
        [809, 948],
        [824, 976],
        [781, 979],
      ],
      legR: [
        [815, 948],
        [848, 946],
        [866, 979],
        [809, 979],
      ],
      armL: [
        [780, 917],
        [796, 913],
        [809, 946],
        [791, 955],
        [779, 943],
      ],
      armR: [
        [813, 918],
        [841, 916],
        [865, 945],
        [839, 968],
        [815, 955],
      ],
      head: [
        [744, 818],
        [790, 801],
        [855, 814],
        [899, 844],
        [902, 886],
        [878, 911],
        [817, 920],
        [762, 899],
      ],
      ears: [
        [761, 752],
        [915, 752],
        [901, 851],
        [855, 838],
        [810, 814],
        [779, 830],
      ],
      flame: [
        [770, 817],
        [793, 810],
        [815, 829],
        [797, 855],
        [775, 851],
      ],
      scarf: [
        [783, 905],
        [855, 899],
        [867, 924],
        [829, 933],
        [787, 928],
      ],
    },
  },
  lumoth: {
    sheet: 1,
    height: 165,
    roots: [829, 1338],
    boxes: [
      [765, 118, 195, 194],
      [1203, 118, 195, 194],
    ],
    eyes: [
      [809, 219, 17, 22],
      [1337, 218, 17, 22],
    ],
    regions: {
      wings: [
        [854, 170],
        [960, 166],
        [960, 307],
        [851, 311],
        [837, 270],
      ],
      legL: [
        [809, 290],
        [827, 282],
        [840, 307],
        [805, 310],
      ],
      legR: [
        [830, 284],
        [858, 281],
        [872, 310],
        [822, 310],
      ],
      armL: [
        [795, 263],
        [810, 254],
        [822, 278],
        [809, 288],
        [795, 281],
      ],
      armR: [
        [820, 259],
        [841, 256],
        [859, 280],
        [843, 295],
        [822, 289],
      ],
      head: [
        [786, 187],
        [815, 174],
        [845, 177],
        [866, 195],
        [876, 220],
        [862, 244],
        [840, 260],
        [809, 260],
        [783, 244],
        [779, 220],
      ],
      ears: [
        [765, 118],
        [919, 118],
        [916, 183],
        [855, 199],
        [789, 188],
      ],
      flame: [
        [805, 178],
        [834, 161],
        [847, 182],
        [840, 192],
        [814, 194],
      ],
      scarf: [
        [792, 254],
        [823, 248],
        [858, 253],
        [855, 276],
        [821, 281],
        [796, 274],
      ],
    },
  },
  mystowl: {
    sheet: 1,
    height: 170,
    roots: [829, 1343],
    boxes: [
      [766, 330, 194, 207],
      [1200, 330, 194, 207],
    ],
    eyes: [
      [805, 436, 18, 23],
      [1348, 436, 18, 23],
    ],
    regions: {
      tail: [
        [833, 492],
        [867, 488],
        [939, 499],
        [957, 528],
        [835, 530],
      ],
      wings: [
        [841, 454],
        [858, 452],
        [883, 462],
        [907, 486],
        [952, 500],
        [952, 523],
        [894, 531],
        [843, 516],
        [824, 484],
      ],
      legL: [
        [805, 516],
        [821, 514],
        [831, 537],
        [804, 537],
      ],
      legR: [
        [820, 515],
        [840, 511],
        [853, 537],
        [817, 537],
      ],
      head: [
        [781, 392],
        [814, 381],
        [850, 386],
        [870, 406],
        [876, 437],
        [860, 463],
        [830, 474],
        [794, 471],
        [767, 452],
        [772, 421],
      ],
      ears: [
        [785, 330],
        [951, 330],
        [948, 385],
        [856, 415],
        [800, 401],
      ],
      flame: [
        [777, 377],
        [792, 375],
        [802, 399],
        [789, 422],
        [776, 412],
      ],
    },
  },
  terradon: {
    sheet: 1,
    height: 155,
    roots: [834, 1329],
    boxes: [
      [754, 556, 190, 194],
      [1186, 556, 190, 194],
    ],
    eyes: [
      [797, 648, 17, 13],
      [1335, 648, 17, 13],
    ],
    regions: {
      tail: [
        [851, 718],
        [898, 713],
        [942, 710],
        [942, 744],
        [856, 747],
      ],
      wings: [
        [849, 600],
        [893, 604],
        [941, 636],
        [944, 732],
        [900, 743],
        [854, 708],
        [841, 664],
      ],
      legL: [
        [794, 728],
        [818, 719],
        [831, 750],
        [790, 750],
      ],
      legR: [
        [822, 720],
        [859, 716],
        [885, 750],
        [817, 750],
      ],
      armL: [
        [785, 688],
        [802, 679],
        [817, 707],
        [805, 726],
        [788, 718],
      ],
      armR: [
        [812, 678],
        [837, 682],
        [851, 715],
        [836, 733],
        [811, 721],
      ],
      head: [
        [773, 614],
        [801, 599],
        [831, 596],
        [855, 609],
        [869, 636],
        [860, 665],
        [841, 684],
        [809, 688],
        [778, 675],
        [756, 656],
        [762, 629],
      ],
      flame: [
        [783, 556],
        [881, 556],
        [884, 606],
        [808, 615],
      ],
    },
  },
  duskveil: {
    sheet: 1,
    height: 176,
    roots: [826, 1341],
    boxes: [
      [768, 772, 201, 214],
      [1184, 772, 201, 214],
    ],
    eyes: [
      [805, 875, 13, 19],
      [1342, 877, 13, 19],
    ],
    regions: {
      tail: [
        [859, 924],
        [883, 906],
        [923, 893],
        [966, 912],
        [969, 968],
        [904, 971],
        [850, 963],
      ],
      armL: [
        [787, 924],
        [799, 917],
        [814, 936],
        [802, 948],
        [787, 941],
      ],
      armR: [
        [823, 921],
        [844, 918],
        [857, 944],
        [842, 959],
        [824, 949],
      ],
      head: [
        [768, 772],
        [912, 772],
        [916, 882],
        [894, 918],
        [858, 920],
        [803, 911],
        [775, 892],
      ],
      scarf: [
        [797, 905],
        [846, 902],
        [863, 919],
        [829, 927],
        [797, 921],
      ],
    },
  },
};

const tmp = "/tmp/arena-reference-import/";
mkdirSync(tmp, { recursive: true });
const input = [];
for (const [id, f] of Object.entries(spec)) {
  for (const [i, box] of f.boxes.entries()) {
    const [x, y, w, h] = box,
      dir = ["left", "right"][i];
    const file = tmp + id + "-" + dir + ".png";
    execFileSync("magick", [
      source + sheets[f.sheet],
      "-crop",
      `${w}x${h}+${x}+${y}`,
      "+repage",
      "-alpha",
      "on",
      "-fuzz",
      id === "duskveil" ? "3.5%" : "7%",
      "-fill",
      "none",
      "-draw",
      `color 0,0 floodfill color ${w - 1},0 floodfill color 0,${h - 1} floodfill color ${w - 1},${h - 1} floodfill`,
      file,
    ]);
    input.push({
      id,
      dir,
      i,
      ...f,
      box,
      image: "data:image/png;base64," + readFileSync(file).toString("base64"),
    });
  }
}
// Canvas only copies/masks existing pixels; it never redraws the illustrations.
const { chromium } = await import(
  process.env.PLAYWRIGHT_MODULE || "playwright"
);
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
  args: ["--no-sandbox", "--disable-gpu"],
});
try {
  const page = await browser.newPage();
  const profiles = await page.evaluate(async (input) => {
    const result = {};
    const polygonContains = (points, x, y) => {
      let inside = false;
      for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
        const a = points[i],
          b = points[j];
        if (
          a[1] > y !== b[1] > y &&
          x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0]
        )
          inside = !inside;
      }
      return inside;
    };
    for (const f of input) {
      const image = new Image();
      image.src = f.image;
      await image.decode();
      const [left, top, width, height] = f.box,
        scale = f.height / height;
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(image, 0, 0);
      const raw = ctx.getImageData(0, 0, width, height);
      const [ex, ey, rx, ry] = f.eyes[f.i];
      const pixels = Object.fromEntries(
        [
          "body",
          "tail",
          "wings",
          "legL",
          "legR",
          "armL",
          "armR",
          "head",
          "ears",
          "eyes",
          "scarf",
          "flame",
        ].map((p) => [p, new Uint8ClampedArray(raw.data.length)]),
      );
      const boxes = {};
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4;
          if (!raw.data[offset + 3]) continue;
          const sx = left + x,
            sy = top + y;
          const mx = f.i === 0 ? sx : f.roots[0] + f.roots[1] - sx;
          let part = "body";
          for (const [p, poly] of Object.entries(f.regions))
            if (polygonContains(poly, mx, sy)) part = p;
          if (((sx - ex) / rx) ** 2 + ((sy - ey) / ry) ** 2 <= 1) part = "eyes";
          pixels[part].set(raw.data.subarray(offset, offset + 4), offset);
          const b = (boxes[part] ??= [width, height, 0, 0]);
          b[0] = Math.min(b[0], x);
          b[1] = Math.min(b[1], y);
          b[2] = Math.max(b[2], x);
          b[3] = Math.max(b[3], y);
        }
      const sampleX = Math.min(
          width - 1,
          Math.max(0, Math.round(ex - left + (f.i === 0 ? 1 : -1) * (rx + 4))),
        ),
        sampleY = Math.round(ey - top);
      const rgb =
        f.id === "duskveil"
          ? [18, 11, 38]
          : Array.from(
              raw.data.slice(
                (sampleY * width + sampleX) * 4,
                (sampleY * width + sampleX) * 4 + 3,
              ),
            );
      const bodyColors = {
        voltkit: [232, 190, 71],
        cindrake: [236, 128, 76],
        tidefin: [71, 194, 214],
        auralynx: [127, 151, 236],
        lumoth: [126, 213, 175],
        mystowl: [201, 95, 171],
        terradon: [173, 134, 77],
        duskveil: [122, 76, 188],
      };
      // Hidden paint behind joints and eyes is covered by the copied pixels at
      // rest; it prevents transparent holes when a limb moves or an eye closes.
      for (let y = 0; y < height; y++)
        for (let x = 0; x < width; x++) {
          const offset = (y * width + x) * 4;
          if (!raw.data[offset + 3]) continue;
          const wx = 100 + (left + x - f.roots[f.i]) * scale,
            wy = 172 - f.height + y * scale;
          let part, color;
          if (pixels.eyes[offset + 3]) {
            part = "head";
            color = rgb;
          } else if (
            ["armR"].some((p) => pixels[p][offset + 3]) &&
            ((wx - 100) / 23) ** 2 + ((wy - 146) / 24) ** 2 < 1
          ) {
            part = "body";
            color = bodyColors[f.id];
          }
          if (!part) continue;
          pixels[part].set([...color, raw.data[offset + 3]], offset);
          const b = (boxes[part] ??= [width, height, 0, 0]);
          b[0] = Math.min(b[0], x);
          b[1] = Math.min(b[1], y);
          b[2] = Math.max(b[2], x);
          b[3] = Math.max(b[3], y);
        }
      const parts = {};
      for (const [part, rgba] of Object.entries(pixels)) {
        if (!boxes[part]) continue;
        // One source-pixel bleed covers sampling seams between adjacent cuts.
        // Every added edge pixel is also copied from the original illustration.
        const base = rgba.slice();
        for (let y = 0; y < height; y++)
          for (let x = 0; x < width; x++) {
            const offset = (y * width + x) * 4;
            if (base[offset + 3] || !raw.data[offset + 3]) continue;
            const neighbors = [
              [x - 1, y],
              [x + 1, y],
              [x, y - 1],
              [x, y + 1],
            ];
            if (
              !neighbors.some(
                ([nx, ny]) =>
                  nx >= 0 &&
                  nx < width &&
                  ny >= 0 &&
                  ny < height &&
                  base[(ny * width + nx) * 4 + 3],
              )
            )
              continue;
            rgba.set(raw.data.subarray(offset, offset + 4), offset);
            const b = boxes[part];
            b[0] = Math.min(b[0], x);
            b[1] = Math.min(b[1], y);
            b[2] = Math.max(b[2], x);
            b[3] = Math.max(b[3], y);
          }
        const b = boxes[part],
          x = b[0],
          y = b[1],
          w = b[2] - x + 1,
          h = b[3] - y + 1;
        ctx.putImageData(new ImageData(rgba, width, height), 0, 0);
        const crop = document.createElement("canvas");
        crop.width = w;
        crop.height = h;
        crop.getContext("2d").drawImage(canvas, x, y, w, h, 0, 0, w, h);
        parts[part] = {
          bounds: [
            100 + (left + x - f.roots[f.i]) * scale,
            172 - f.height + y * scale,
            w * scale,
            h * scale,
          ],
          image: crop.toDataURL("image/png"),
        };
      }
      const eye = {
        x: 100 + (ex - f.roots[f.i]) * scale,
        y: 172 - f.height + (ey - top) * scale,
        rx: rx * scale,
        ry: ry * scale,
        paint: rgb,
      };
      (result[f.id] ??= {})[f.dir] = { parts, eye };
    }
    return result;
  }, input);
  const manifest = {
    schemaVersion: 1,
    sources: sheets.map((name) => ({
      name,
      sha256: createHash("sha256")
        .update(readFileSync(source + name))
        .digest("hex"),
    })),
    profiles,
  };
  mkdirSync(root + "src/art", { recursive: true });
  writeFileSync(
    root + "src/art/reference-profiles.json",
    JSON.stringify(manifest),
  );
  console.log(
    "Imported",
    input.length,
    "profiles directly from the reference pixels.",
  );
} finally {
  await browser.close();
}

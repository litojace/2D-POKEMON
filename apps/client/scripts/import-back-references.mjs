/** Prepare generated rear-view art as the same joint layers used by the rig. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
const root = fileURLToPath(new URL("../", import.meta.url));
const files = ["first-three.png", "remaining-five.png"];
const groups = [
  ["cindrake", "tidefin", "auralynx"],
  ["voltkit", "lumoth", "mystowl", "terradon", "duskveil"],
];
const source = root + "art-source/back-views/";
const input = files.map((file, i) => ({
  image:
    "data:image/png;base64," + readFileSync(source + file).toString("base64"),
  ids: groups[i],
}));
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
    const profiles = {};
    const heights = {
      voltkit: 150,
      cindrake: 182,
      tidefin: 140,
      auralynx: 180,
      lumoth: 165,
      mystowl: 170,
      terradon: 155,
      duskveil: 176,
    };
    const colors = {
      voltkit: [232, 190, 71],
      cindrake: [236, 128, 76],
      tidefin: [71, 194, 214],
      auralynx: [127, 151, 236],
      lumoth: [126, 213, 175],
      mystowl: [201, 95, 171],
      terradon: [173, 134, 77],
      duskveil: [122, 76, 188],
    };
    const parts = [
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
    ];
    const rect = (x, y, l, t, r, b) => x >= l && x <= r && y >= t && y <= b;
    for (const sheet of input) {
      const img = new Image();
      img.src = sheet.image;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.width;
      c.height = img.height;
      const ctx = c.getContext("2d", { willReadFrequently: true });
      ctx.drawImage(img, 0, 0);
      const raw = ctx.getImageData(0, 0, c.width, c.height),
        w = c.width,
        h = c.height,
        n = w * h;
      // Identify each character as a connected silhouette; detached crystals,
      // sparkle tips and lanterns are assigned to the closest main silhouette.
      const labels = new Int32Array(n),
        components = [];
      let serial = 0;
      for (let p = 0; p < n; p++)
        if (!labels[p] && raw.data[p * 4 + 3] >= 80) {
          const label = ++serial,
            queue = [p];
          labels[p] = label;
          let at = 0,
            sx = 0,
            sy = 0;
          while (at < queue.length) {
            const v = queue[at++],
              x = v % w,
              y = Math.floor(v / w);
            sx += x;
            sy += y;
            for (const q of [
              x ? v - 1 : -1,
              x < w - 1 ? v + 1 : -1,
              y ? v - w : -1,
              y < h - 1 ? v + w : -1,
            ])
              if (q >= 0 && !labels[q] && raw.data[q * 4 + 3] >= 80) {
                labels[q] = label;
                queue.push(q);
              }
          }
          components.push({
            label,
            count: queue.length,
            x: sx / queue.length,
            y: sy / queue.length,
          });
        }
      const mains = components
        .toSorted((a, b) => b.count - a.count)
        .slice(0, sheet.ids.length)
        .sort((a, b) => a.x - b.x);
      if (mains.length !== sheet.ids.length)
        throw Error("Missing rear silhouettes");
      const owner = new Map(
        components.map((comp) => [
          comp.label,
          mains.reduce(
            (best, m, i) =>
              Math.hypot(comp.x - m.x, comp.y - m.y) < best.d
                ? { i, d: Math.hypot(comp.x - m.x, comp.y - m.y) }
                : best,
            { i: 0, d: Infinity },
          ).i,
        ]),
      );
      // Bleed the original soft edges back onto their nearest opaque component.
      const assigned = new Int16Array(n).fill(-1);
      for (let p = 0; p < n; p++)
        if (labels[p]) assigned[p] = owner.get(labels[p]);
      for (let pass = 0; pass < 4; pass++) {
        const before = assigned.slice();
        for (let p = 0; p < n; p++)
          if (assigned[p] < 0 && raw.data[p * 4 + 3]) {
            const x = p % w,
              y = Math.floor(p / w);
            for (const q of [
              x ? p - 1 : -1,
              x < w - 1 ? p + 1 : -1,
              y ? p - w : -1,
              y < h - 1 ? p + w : -1,
            ])
              if (q >= 0 && before[q] >= 0) {
                assigned[p] = before[q];
                break;
              }
          }
      }
      for (let i = 0; i < sheet.ids.length; i++) {
        const id = sheet.ids[i];
        let minX = w,
          minY = h,
          maxX = 0,
          maxY = 0;
        for (let p = 0; p < n; p++)
          if (assigned[p] === i) {
            const x = p % w,
              y = Math.floor(p / w);
            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
          }
        const sw = maxX - minX + 1,
          sh = maxY - minY + 1;
        const src = document.createElement("canvas");
        src.width = sw;
        src.height = sh;
        const sc = src.getContext("2d");
        const rgba = new Uint8ClampedArray(sw * sh * 4);
        for (let y = 0; y < sh; y++)
          for (let x = 0; x < sw; x++) {
            const p = (minY + y) * w + minX + x;
            if (assigned[p] === i)
              rgba.set(raw.data.subarray(p * 4, p * 4 + 4), (y * sw + x) * 4);
          }
        sc.putImageData(new ImageData(rgba, sw, sh), 0, 0);
        const pic = document.createElement("canvas");
        pic.height = 270;
        pic.width = Math.round((sw / sh) * 270);
        const pc = pic.getContext("2d", { willReadFrequently: true });
        pc.drawImage(src, 0, 0, pic.width, pic.height);
        const pw = pic.width,
          ph = pic.height,
          data = pc.getImageData(0, 0, pw, ph).data;
        let footX = 0,
          weight = 0;
        for (let y = Math.floor(ph * 0.98); y < ph; y++)
          for (let x = 0; x < pw; x++) {
            const a = data[(y * pw + x) * 4 + 3];
            if (a > 128) {
              footX += x * a;
              weight += a;
            }
          }
        const rootX = weight ? footX / weight : pw / 2,
          scale = heights[id] / ph,
          top = 172 - heights[id];
        const pix = Object.fromEntries(
          parts.map((p) => [p, new Uint8ClampedArray(data.length)]),
        );
        for (let y = 0; y < ph; y++)
          for (let x = 0; x < pw; x++) {
            const off = (y * pw + x) * 4;
            if (!data[off + 3]) continue;
            const wx = 100 + (x - rootX) * scale,
              wy = top + y * scale;
            let p = "body";
            const inRect = (l, t, r, b) => rect(wx, wy, l, t, r, b);
            if (
              (id === "voltkit" && inRect(-50, 80, 103, 174)) ||
              (id === "cindrake" && inRect(-60, 106, 132, 173)) ||
              (id === "tidefin" && inRect(-70, 100, 116, 175)) ||
              (id === "auralynx" && inRect(85, 136, 116, 168)) ||
              (id === "mystowl" && inRect(88, 143, 114, 174)) ||
              (id === "terradon" && inRect(90, 142, 114, 174)) ||
              (id === "duskveil" && inRect(125, 105, 220, 171))
            )
              p = "tail";
            if (
              (id === "voltkit" && inRect(43, 123, 161, 160)) ||
              (id === "lumoth" && inRect(15, 70, 185, 166)) ||
              (id === "mystowl" && inRect(40, 120, 161, 166)) ||
              (id === "terradon" && inRect(27, 85, 173, 162)) ||
              (id === "auralynx" &&
                wy > 50 &&
                wy < 163 &&
                (wx < 62 || wx > 138))
            )
              p = "wings";
            if (inRect(48, 155, 99, 175)) p = "legL";
            if (inRect(101, 155, 152, 175)) p = "legR";
            if (
              inRect(
                id === "terradon" ? 24 : 48,
                124,
                id === "terradon" ? 53 : 84,
                156,
              )
            )
              p = "armL";
            if (
              inRect(
                id === "terradon" ? 147 : 116,
                124,
                id === "terradon" ? 178 : 153,
                156,
              )
            )
              p = "armR";
            if (id === "auralynx" && inRect(85, 136, 116, 166)) p = "tail";
            if (id === "lumoth" && inRect(87, 143, 114, 166)) p = "tail";
            if (id === "mystowl" && inRect(88, 143, 114, 174)) p = "tail";
            if (id === "terradon" && inRect(90, 142, 114, 174)) p = "tail";
            if (
              (id !== "duskveil" && inRect(48, 55, 153, 122)) ||
              (id === "duskveil" && inRect(33, -10, 167, 121))
            )
              p = "head";
            if (
              ["voltkit", "auralynx", "lumoth", "mystowl", "tidefin"].includes(
                id,
              ) &&
              inRect(8, -24, 192, 66)
            )
              p = "ears";
            if (id === "tidefin" && wy < 111 && (wx < 58 || wx > 142))
              p = "ears";
            if (id === "cindrake" && inRect(27, -25, 168, 69)) p = "flame";
            if (
              id === "cindrake" &&
              wy > 35 &&
              wy < 94 &&
              (wx < 63 || wx > 137)
            )
              p = "ears";
            if (id === "terradon" && inRect(62, -10, 142, 76)) p = "flame";
            if (id === "duskveil" && inRect(72, -15, 126, 34)) p = "flame";
            if (
              ["auralynx", "lumoth", "duskveil"].includes(id) &&
              inRect(65, 117, 139, 131)
            )
              p = "scarf";
            if (id === "tidefin" && inRect(106, 131, 161, 160)) p = "scarf";
            pix[p].set(data.subarray(off, off + 4), off);
          }
        // Fill only hidden torso pixels, behind the rear limbs/wings/tail. These
        // are all drawn above the torso in a rear view and expose this on motion.
        for (let y = 0; y < ph; y++)
          for (let x = 0; x < pw; x++) {
            const o = (y * pw + x) * 4;
            if (!data[o + 3] || pix.body[o + 3]) continue;
            const wx = 100 + (x - rootX) * scale,
              wy = top + y * scale;
            if (
              ((wx - 100) / 24) ** 2 + ((wy - 144) / 25) ** 2 < 1 &&
              !pix.head[o + 3] &&
              !pix.scarf[o + 3]
            )
              pix.body.set([...colors[id], data[o + 3]], o);
          }
        const out = {};
        for (const [part, rgba] of Object.entries(pix)) {
          const before = rgba.slice();
          for (let y = 0; y < ph; y++)
            for (let x = 0; x < pw; x++) {
              const o = (y * pw + x) * 4;
              if (rgba[o + 3] || !data[o + 3]) continue;
              for (const [nx, ny] of [
                [x - 1, y],
                [x + 1, y],
                [x, y - 1],
                [x, y + 1],
              ])
                if (
                  nx >= 0 &&
                  nx < pw &&
                  ny >= 0 &&
                  ny < ph &&
                  before[(ny * pw + nx) * 4 + 3]
                ) {
                  rgba.set(data.subarray(o, o + 4), o);
                  break;
                }
            }
          let l = pw,
            t = ph,
            r = -1,
            b = -1;
          for (let y = 0; y < ph; y++)
            for (let x = 0; x < pw; x++)
              if (rgba[(y * pw + x) * 4 + 3]) {
                l = Math.min(l, x);
                t = Math.min(t, y);
                r = Math.max(r, x);
                b = Math.max(b, y);
              }
          if (r < l) continue;
          pc.putImageData(new ImageData(rgba, pw, ph), 0, 0);
          const cut = document.createElement("canvas");
          cut.width = r - l + 1;
          cut.height = b - t + 1;
          cut
            .getContext("2d")
            .drawImage(
              pic,
              l,
              t,
              cut.width,
              cut.height,
              0,
              0,
              cut.width,
              cut.height,
            );
          out[part] = {
            bounds: [
              100 + (l - rootX) * scale,
              top + t * scale,
              cut.width * scale,
              cut.height * scale,
            ],
            image: cut.toDataURL("image/png"),
          };
        }
        profiles[id] = { up: { parts: out } };
      }
    }
    return profiles;
  }, input);
  const manifest = {
    schemaVersion: 1,
    sources: files.map((name) => ({
      name,
      sha256: createHash("sha256")
        .update(readFileSync(source + name))
        .digest("hex"),
    })),
    profiles,
  };
  mkdirSync(root + "src/art", { recursive: true });
  writeFileSync(
    root + "src/art/reference-backs.json",
    JSON.stringify(manifest),
  );
  console.log(
    "Prepared",
    Object.keys(profiles).length,
    "rear views with separate animated parts.",
  );
} finally {
  await browser.close();
}

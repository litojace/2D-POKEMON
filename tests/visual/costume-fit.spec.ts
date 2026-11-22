import { expect, test, type Page } from "@playwright/test";

// Costumes (the modern collections, Nova Vanguard, Sky Pirates) are drawn in
// play from per-part crops of the art (animation/assets.ts). Two checks:
// - nothing of a costume is cut off: no crop has more of its picture on its
//   edge than the champion's own default crop does (a surfboard, a torch on
//   a pole, a hem once lost its ends this way);
// - headwear sits clear of the eyes: no costume piece drawn over the eyes
//   (a hat's brim, a helmet, a band, a held prop) covers more than a tenth
//   of their top third, beyond what the champion itself covers. Eyewear,
//   worn over the eyes on purpose, is listed in the test.

async function open(page: Page) {
  await page.route("**/costume-fit-page", (r) =>
    r.fulfill({ contentType: "text/html", body: "<body></body>" }),
  );
  await page.goto("/costume-fit-page");
}

/** How many edge pixels of each image are drawn, per side. */
const edges = (page: Page, items: { key: string; url: string }[]) =>
  page.evaluate(async (items) => {
    const out: Record<string, { l: number; r: number; t: number; b: number }> =
      {};
    const c = document.createElement("canvas");
    const g = c.getContext("2d", { willReadFrequently: true })!;
    for (const it of items) {
      const im = new Image();
      im.src = it.url;
      await im.decode();
      const W = im.naturalWidth,
        H = im.naturalHeight;
      c.width = W;
      c.height = H;
      g.clearRect(0, 0, W, H);
      g.drawImage(im, 0, 0, W, H);
      const d = g.getImageData(0, 0, W, H).data;
      const e = { l: 0, r: 0, t: 0, b: 0 };
      for (let y = 0; y < H; y++) {
        if (d[y * W * 4 + 3] > 60) e.l++;
        if (d[(y * W + W - 1) * 4 + 3] > 60) e.r++;
      }
      for (let x = 0; x < W; x++) {
        if (d[x * 4 + 3] > 60) e.t++;
        if (d[((H - 1) * W + x) * 4 + 3] > 60) e.b++;
      }
      out[it.key] = e;
    }
    return out;
  }, items);

test("no costume is cut off by the crops play draws it from", async ({
  page,
}) => {
  test.setTimeout(600_000);
  await open(page);
  const art: { key: string; url: string; skin: string | null }[] =
    await page.evaluate(async () => {
      const { cropArt } = await import("/costume-audit.ts");
      return cropArt();
    });
  expect(art.filter((a) => a.skin).length).toBeGreaterThan(400);
  const e = await edges(page, art);
  const cut: string[] = [];
  for (const a of art) {
    if (!a.skin) continue;
    const base = e[a.key.split("~")[0]] ?? { l: 0, r: 0, t: 0, b: 0 };
    const mine = e[a.key];
    const sides = (["l", "r", "t", "b"] as const).filter(
      (s) => mine[s] - base[s] > 4,
    );
    if (sides.length) cut.push(`${a.key}: cut at ${sides.join(", ")}`);
  }
  expect(cut).toEqual([]);
});

// The same check for every champion's own art: a crop whose edge is drawn
// on cuts the picture off (Glacelle's left wing-flap and the tip of its body
// were cut this way in the lobby and in play). The default boxes are in
// animation/assets.ts; a champion that reaches past them gets its own
// (frontPartBounds, profilePartBounds in creature-profile.ts).
test("no champion's own art is cut off by its crops", async ({ page }) => {
  test.setTimeout(300_000);
  await open(page);
  const art: { key: string; url: string }[] = await page.evaluate(async () => {
    const { championCrops } = await import("/costume-audit.ts");
    return championCrops();
  });
  expect(art.length).toBeGreaterThan(400);
  const e = await edges(page, art);
  const cut = art
    .map((a) => {
      const sides = (["l", "r", "t", "b"] as const).filter(
        (s) => e[a.key][s] > 4,
      );
      return sides.length ? `${a.key}: cut at ${sides.join(", ")}` : "";
    })
    .filter(Boolean);
  expect(cut).toEqual([]);
});

test("headwear sits clear of the eyes", async ({ page }) => {
  test.setTimeout(600_000);
  await open(page);
  const art: {
    skin: string;
    dir: string;
    eyes: string;
    baseOver: string[];
    wornOver: string[];
  }[] = await page.evaluate(async () => {
    const { eyeArt } = await import("/costume-audit.ts");
    return eyeArt();
  });
  const report = await page.evaluate(async (art) => {
    const S = 240;
    const c = document.createElement("canvas");
    c.width = c.height = S;
    const g = c.getContext("2d", { willReadFrequently: true })!;
    /** The pictures drawn on one canvas, as alpha. */
    const alpha = async (svgs: string[]) => {
      g.clearRect(0, 0, S, S);
      for (const svg of svgs) {
        const im = new Image();
        im.src =
          "data:image/svg+xml;charset=utf-8," +
          encodeURIComponent(
            svg.replace("<svg", `<svg width="${S}" height="${S}"`),
          );
        await im.decode();
        g.drawImage(im, 0, 0, S, S);
      }
      const d = g.getImageData(0, 0, S, S).data;
      const a = new Uint8Array(S * S);
      for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
      return a;
    };
    const out: { skin: string; dir: string; top: number; all: number }[] = [];
    for (const r of art) {
      const eyes = await alpha([r.eyes]);
      const before = await alpha(r.baseOver);
      const after = await alpha(r.wornOver);
      let y0 = S,
        y1 = -1;
      eyes.forEach((v, i) => {
        if (v > 128) {
          y0 = Math.min(y0, Math.floor(i / S));
          y1 = Math.max(y1, Math.floor(i / S));
        }
      });
      // The top third of the eyes: where a hat's brim or a band would sit.
      const cut = y0 + (y1 - y0) / 3;
      let top = 0,
        topN = 0,
        all = 0,
        allN = 0;
      eyes.forEach((v, i) => {
        if (v <= 128) return;
        // Covered by the costume, and not already by the champion itself.
        const hit = after[i] > 160 && before[i] <= 160;
        allN++;
        if (hit) all++;
        if (Math.floor(i / S) <= cut) {
          topN++;
          if (hit) top++;
        }
      });
      out.push({
        skin: r.skin,
        dir: r.dir,
        top: +(top / Math.max(1, topN)).toFixed(3),
        all: +(all / Math.max(1, allN)).toFixed(3),
      });
    }
    return out;
  }, art);
  // Eyewear, worn over the eyes on purpose.
  const EYEWEAR = new Set([
    "sunbara-stars-stripes", // Fourth of July: star sunglasses
    "halcyra-hero-squad", // Skysight: a targeting lens
    "mossloth-hon-viet", // Ông Đồ: round spectacles
    "mystowl-neon-campus", // Library Prefect: round glasses
  ]);
  expect(report.length).toBeGreaterThan(300);
  const low = report
    .filter((r) => !EYEWEAR.has(r.skin) && r.top > 0.1)
    .map(
      (r) =>
        `${r.skin} ${r.dir}: covers ${Math.round(r.top * 100)}% of the eyes' top`,
    );
  expect(low).toEqual([]);
});

// Micro-benchmark: a 256² detail texture laid over a stretched ground, 1440×900.
const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({
    executablePath: "/opt/pw-browsers/chromium-1243/chrome-linux64/chrome",
  });
  const p = await b.newPage();
  const r = await p.evaluate(() => {
    const W = 1440,
      H = 900;
    const cv = document.createElement("canvas");
    cv.width = W;
    cv.height = H;
    const g = cv.getContext("2d");
    const bg = document.createElement("canvas");
    bg.width = W / 2;
    bg.height = H / 2; // a 1x ground stretched (as the farm at zoom)
    const bgg = bg.getContext("2d");
    bgg.fillStyle = "#7cc45e";
    bgg.fillRect(0, 0, bg.width, bg.height);
    const tile = document.createElement("canvas");
    tile.width = tile.height = 256;
    const tg = tile.getContext("2d"),
      d = tg.createImageData(256, 256);
    for (let i = 0; i < d.data.length; i += 4) {
      const v = Math.random() * 255;
      d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
      d.data[i + 3] = 255;
    }
    tg.putImageData(d, 0, 0);
    const pat = g.createPattern(tile, "repeat");
    const run = (fn) => {
      const t = [];
      for (let i = 0; i < 40; i++) {
        const t0 = performance.now();
        fn();
        g.getImageData(0, 0, 1, 1);
        t.push(performance.now() - t0);
      }
      t.sort((a, b) => a - b);
      return +t[20].toFixed(2);
    };
    const ground = () => g.drawImage(bg, 0, 0, W, H);
    return {
      groundOnly: run(ground),
      detailSourceOver: run(() => {
        ground();
        g.globalAlpha = 0.12;
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
      }),
      detailSoftLight: run(() => {
        ground();
        g.globalCompositeOperation = "soft-light";
        g.globalAlpha = 0.5;
        g.fillStyle = pat;
        g.fillRect(0, 0, W, H);
        g.globalAlpha = 1;
        g.globalCompositeOperation = "source-over";
      }),
      fullScreenOverlayMultiply: run(() => {
        ground();
        g.globalCompositeOperation = "multiply";
        g.fillStyle = "#ffd8b0";
        g.fillRect(0, 0, W, H);
        g.globalCompositeOperation = "source-over";
      }),
    };
  });
  console.log(JSON.stringify(r));
  await b.close();
})();

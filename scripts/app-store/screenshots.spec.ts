/**
 * App Store screenshots: the scenes in scenes.ts, captured at the iPhone
 * sizes App Store Connect asks for (docs/app-store-screenshots.md).
 *
 *   npx playwright test --config scripts/app-store/playwright.config.ts
 *
 * Raw captures go to app-store-screenshots/raw/<device>/, and the framed
 * ones, with their captions, to app-store-screenshots/<device>/: those are
 * the files to upload.
 */
import { test } from "@playwright/test";
import { mkdirSync, readFileSync } from "node:fs";
import { DEVICES, SCENES, middayZone, player } from "./scenes";

export const OUT = "app-store-screenshots";

/** The game's display face, inlined so the frame needs no server. */
const FONT = readFileSync(
  "apps/client/public/assets/fonts/barlow-condensed-latin-800-normal.woff2",
).toString("base64");

/**
 * The upload: the capture framed on the game's night blue (a fire glow on
 * one side, an ice glow on the other, like the icon) under its caption, at
 * the same pixel size as the capture.
 */
function frame(
  capture: Buffer,
  caption: string,
  width: number,
  height: number,
) {
  const band = Math.round(height * 0.17);
  const margin = Math.round(height * 0.045);
  const shotH = height - band - margin;
  const shotW = Math.round((shotH * width) / height);
  return `<!doctype html><meta charset="utf-8"><style>
    @font-face { font-family: Barlow; font-weight: 800; src: url(data:font/woff2;base64,${FONT}) format("woff2"); }
    html, body { margin: 0; width: ${width}px; height: ${height}px; overflow: hidden; }
    body {
      background:
        radial-gradient(60% 90% at 0% 100%, #ff6a2b55, transparent 70%),
        radial-gradient(60% 90% at 100% 100%, #2a8cff55, transparent 70%),
        radial-gradient(80% 70% at 50% 0%, #22306b, #0b1020 75%);
      font-family: Barlow, "Arial Narrow", sans-serif;
    }
    h1 {
      position: absolute; left: 0; right: 0; top: 0; height: ${band}px; margin: 0;
      display: flex; align-items: center; justify-content: center;
      color: #fff; font-weight: 800; text-transform: uppercase;
      font-size: ${Math.round(height * 0.082)}px; letter-spacing: 0.02em;
      text-shadow: 0 ${Math.round(height * 0.006)}px ${Math.round(height * 0.02)}px #0008;
    }
    img {
      position: absolute; top: ${band}px; left: ${Math.round((width - shotW) / 2)}px;
      width: ${shotW}px; height: ${shotH}px;
      border-radius: ${Math.round(shotH * 0.045)}px;
      box-shadow: 0 ${Math.round(height * 0.015)}px ${Math.round(height * 0.05)}px #000a, 0 0 0 ${Math.max(2, Math.round(height * 0.002))}px #ffffff22;
    }
  </style><h1>${caption}</h1><img src="data:image/png;base64,${capture.toString("base64")}">`;
}

const only = process.env.SCENES?.split(",");
for (const device of DEVICES)
  for (const scene of SCENES.filter((s) => !only || only.includes(s.name)))
    test(`${device.name} ${scene.name}`, async ({ browser }) => {
      const context = await browser.newContext({
        viewport: device.viewport,
        deviceScaleFactor: 3,
        isMobile: true,
        hasTouch: true,
        timezoneId: middayZone(),
      });
      try {
        const page = await context.newPage();
        await player(page);
        await scene.capture(page);
        const file = `${SCENES.indexOf(scene) + 1}-${scene.name}.png`;
        mkdirSync(`${OUT}/raw/${device.name}`, { recursive: true });
        const capture = await page.screenshot({
          path: `${OUT}/raw/${device.name}/${file}`,
        });
        // The framed upload, at the capture's own pixel size.
        const [width, height] = [
          device.viewport.width * 3,
          device.viewport.height * 3,
        ];
        const framing = await browser.newContext({
          viewport: { width, height },
        });
        try {
          const sheet = await framing.newPage();
          await sheet.setContent(frame(capture, scene.caption, width, height));
          await sheet.evaluate(() => document.fonts.ready);
          mkdirSync(`${OUT}/${device.name}`, { recursive: true });
          await sheet.screenshot({ path: `${OUT}/${device.name}/${file}` });
        } finally {
          await framing.close();
        }
      } finally {
        await context.close();
      }
    });

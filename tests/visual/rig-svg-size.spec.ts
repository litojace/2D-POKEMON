import { expect, test } from "@playwright/test";
import type { CharacterId } from "@arena/shared";
import { CHAMPION_SKINS } from "../../packages/shared/src/shop";
import { rigAssets } from "../../apps/client/src/animation/assets";
import { sizedRigSvg } from "../../apps/client/src/animation/rig-textures";
import { openLobby } from "./helpers";

// Rig parts sized in their own SVG text (rig-textures.ts sizedRigSvg) come
// out pixel for pixel as Phaser's SVG loader made them: it parsed each part,
// gave it a viewBox if it had none, set `width="Wpx" height="Hpx"` and wrote
// it out again, which cost a phone 166 ms each time a skin was tried on. The
// same parts, rasterized both ways in the browser at the Shop's 3× scale,
// must match exactly.
const FIGHTERS: CharacterId[] = ["voltkit", "tidefin", "cindrake", "glacelle"];
test("rig parts sized in their text match Phaser's own sizing, pixel for pixel", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const parts: {
    key: string;
    url: string;
    sized: string;
    w: number;
    h: number;
  }[] = [];
  for (const id of FIGHTERS) {
    const skins = CHAMPION_SKINS.filter((s) => s.champion === id).slice(0, 2);
    for (const look of [null, ...skins.map((s) => ({ skin: s.id }))])
      for (const a of rigAssets(id, look, ["down", "left"])) {
        const w = Math.round(a.width * 3),
          h = Math.round(a.height * 3);
        const sized = sizedRigSvg(a.url, w, h);
        expect(sized, `${a.key}: sized in its text`).toBeDefined();
        parts.push({ key: a.key, url: a.url, sized: sized!, w, h });
      }
  }
  expect(parts.length).toBeGreaterThan(100);
  await openLobby(page);
  const mismatches = await page.evaluate(async (parts) => {
    const B64 = "data:image/svg+xml;base64,";
    // Phaser 3.90's SVGFile.onProcess, with a width and height.
    const phaser = (text: string, width: number, height: number) => {
      const xml = new DOMParser().parseFromString(text, "text/xml");
      const svg = xml.getElementsByTagName("svg")[0];
      const hasViewBox = svg.hasAttribute("viewBox");
      const w = parseFloat(svg.getAttribute("width")!),
        h = parseFloat(svg.getAttribute("height")!);
      if (!hasViewBox && w && h)
        svg.setAttribute("viewBox", "0  0 " + w + " " + h);
      svg.setAttribute("width", width + "px");
      svg.setAttribute("height", height + "px");
      return new XMLSerializer().serializeToString(svg);
    };
    const pixels = async (text: string) => {
      const url = URL.createObjectURL(
        new Blob([text], { type: "image/svg+xml;charset=utf-8" }),
      );
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d", { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0);
      URL.revokeObjectURL(url);
      return {
        w: c.width,
        h: c.height,
        data: ctx.getImageData(0, 0, c.width, c.height).data,
      };
    };
    const out: string[] = [];
    for (const p of parts) {
      const a = await pixels(phaser(atob(p.url.slice(B64.length)), p.w, p.h));
      const b = await pixels(atob(p.sized.slice(B64.length)));
      if (a.w !== b.w || a.h !== b.h) {
        out.push(`${p.key}: ${a.w}×${a.h} against ${b.w}×${b.h}`);
        continue;
      }
      let diff = 0;
      for (let i = 0; i < a.data.length; i++)
        if (a.data[i] !== b.data[i]) diff++;
      if (diff) out.push(`${p.key}: ${diff} channel values differ`);
    }
    return out;
  }, parts);
  console.log(`${parts.length} rig parts compared`);
  expect(mismatches).toEqual([]);
});

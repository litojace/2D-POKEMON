/**
 * Lumiwick as one picture for the briefing diagrams (raid-guide-sprites.ts):
 * drawn once per look from the same atlas pieces and placements as battle,
 * in three-quarter view: floating, or `exposed`, dropped onto the floor and
 * dazed with its flame heart open. Empty without a canvas (outside a browser).
 */
import { paintLumiwickAtlas, type LumiAtlas } from "./boss-lumiwick-paint";
import { lumiwickPlacements, lumiwickPose } from "./boss-lumiwick";

let sheet: LumiAtlas | null = null;
let guides: Partial<
  Record<
    "calm" | "exposed",
    {
      url: string;
      crop: [number, number, number, number];
      core: [number, number];
    }
  >
> = {};
const W = 360,
  H = 300,
  CX = 180,
  CY = 285,
  K = 0.95;

export function lumiwickGuideImage(exposed = false) {
  const key = exposed ? "exposed" : "calm";
  const P = lumiwickPose({
    clock: 1.3,
    phase: 1,
    reduced: true,
    flight: 1,
    windup: 0,
    castAge: 99,
    exposed,
    groundAge: 3,
    takeoffAge: 99,
    stagger: exposed,
    hurt: 0,
    dead: false,
    deadAge: 0,
    roarAge: 99,
  });
  const placed = lumiwickPlacements(P, 1);
  const core: [number, number] = [
    CX + placed.heart.x * K,
    CY + placed.heart.y * K,
  ];
  if (
    !guides[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      sheet ??= paintLumiwickAtlas();
      const canvas = document.createElement("canvas");
      canvas.width = W;
      canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      for (const p of placed.placements) {
        const f = sheet.frames[p.piece];
        if (!f) continue;
        ctx.save();
        ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
        if (p.add) ctx.globalCompositeOperation = "lighter";
        ctx.translate(CX + p.x * K, CY + p.y * K);
        ctx.rotate(p.rot);
        ctx.scale((p.sx * K) / f.q, (p.sy * K) / f.q);
        ctx.drawImage(
          sheet.canvas,
          f.x,
          f.y,
          f.w,
          f.h,
          -f.ox * f.w,
          -f.oy * f.h,
          f.w,
          f.h,
        );
        ctx.restore();
      }
      // the crop: the picture's own pixels, with a little margin
      const data = ctx.getImageData(0, 0, W, H).data;
      let x0 = W,
        y0 = H,
        x1 = 0,
        y1 = 0;
      for (let y = 0; y < H; y++)
        for (let x = 0; x < W; x++)
          if (data[(y * W + x) * 4 + 3] > 40) {
            if (x < x0) x0 = x;
            if (x > x1) x1 = x;
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      x0 = Math.max(0, x0 - 4);
      y0 = Math.max(0, y0 - 4);
      x1 = Math.min(W, x1 + 4);
      y1 = Math.min(H, y1 + 4);
      guides[key] = {
        url: canvas.toDataURL("image/png"),
        crop: [x0, y0, x1 - x0, y1 - y0],
        core,
      };
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  const g = guides[key];
  return {
    url: g?.url ?? "",
    width: W,
    height: H,
    crop: (g?.crop ?? [40, 20, 280, 270]) as readonly [
      number,
      number,
      number,
      number,
    ],
    core: core as readonly [number, number],
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetLumiwickGuide() {
  guides = {};
}

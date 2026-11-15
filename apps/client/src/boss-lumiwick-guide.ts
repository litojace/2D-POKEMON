/**
 * Lumiwick as one picture for the briefing diagrams (raid-guide-sprites.ts):
 * drawn once per look from the same atlas pieces and placements as battle,
 * in three-quarter view: floating, or `exposed`, dropped onto the floor and
 * dazed with its flame heart open. Empty without a canvas (outside a browser).
 */
import {
  lumiwickPieces,
  paintedLumiwickAtlas,
  paintLumiwickPiece,
  type PieceSpec,
} from "./boss-lumiwick-paint";
import { lumiwickPlacements, lumiwickPose } from "./boss-lumiwick";

let guides: Partial<Record<"calm" | "exposed", string>> = {};
const W = 360,
  H = 300,
  CX = 180,
  CY = 285,
  K = 0.95;
/**
 * The crop around each look: its pixels (alpha over 40) plus 4 px, measured
 * once from the painted picture so that no pixel is read back at runtime
 * (tests/visual/raid-guide-pictures.spec.ts checks it still fits).
 */
export const LUMI_GUIDE_CROPS = {
  calm: [34, 60, 215, 197],
  exposed: [83, 143, 183, 157],
} as const;
/** Pieces painted for the guide (tests count them: never the whole atlas). */
export const lumiwickGuideStats = { pieces: 0 };
let specs: Map<string, PieceSpec> | undefined;

const guidePose = (exposed: boolean) =>
  lumiwickPose({
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

/** Paint one look: from the battle atlas if it is still in memory, else only the pieces this pose uses. */
function paintGuide(exposed: boolean) {
  const placed = lumiwickPlacements(guidePose(exposed), 1);
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const sheet = paintedLumiwickAtlas();
  // a CPU canvas unless it copies from the battle atlas (a GPU one)
  const ctx = canvas.getContext(
    "2d",
    sheet ? undefined : { willReadFrequently: true },
  )!;
  specs ??= new Map(lumiwickPieces().map((p) => [p.name, p]));
  for (const p of placed.placements) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, p.alpha));
    if (p.add) ctx.globalCompositeOperation = "lighter";
    ctx.translate(CX + p.x * K, CY + p.y * K);
    ctx.rotate(p.rot);
    const f = sheet?.frames[p.piece];
    if (sheet && f) {
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
    } else if (!sheet) {
      const spec = specs.get(p.piece);
      if (spec) {
        const pc = paintLumiwickPiece(spec, 1, true);
        lumiwickGuideStats.pieces++;
        ctx.scale((p.sx * K) / pc.q, (p.sy * K) / pc.q);
        ctx.drawImage(pc.canvas, -pc.ox, -pc.oy);
      }
    }
    ctx.restore();
  }
  return canvas.toDataURL("image/png");
}

/**
 * The picture's URL with its crop and where the heart sits. With `paint`
 * false it only answers what is known (the URL stays empty until a call
 * paints it): the briefing paints later, off its render (raid-guide-sprites.ts).
 */
export function lumiwickGuideImage(exposed = false, paint = true) {
  const key = exposed ? "exposed" : "calm";
  const placed = lumiwickPlacements(guidePose(exposed), 1);
  const core: [number, number] = [
    CX + placed.heart.x * K,
    CY + placed.heart.y * K,
  ];
  if (
    paint &&
    !guides[key] &&
    typeof document !== "undefined" &&
    typeof document.createElement === "function"
  ) {
    try {
      guides[key] = paintGuide(exposed);
    } catch {
      /* No drawing surface: the diagram shows no picture. */
    }
  }
  return {
    url: guides[key] ?? "",
    width: W,
    height: H,
    crop: LUMI_GUIDE_CROPS[key] as readonly [number, number, number, number],
    core: core as readonly [number, number],
  };
}
/** Forget the drawn guide pictures (tests). */
export function resetLumiwickGuide() {
  guides = {};
}

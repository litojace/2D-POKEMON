/**
 * Each boss as a big transparent cutout, drawn from its own rig painters at
 * poster density, in a poster pose. Returns the canvas and where its face
 * and body sit in it (canvas px).
 */
import { paintLumiwickAtlas } from "../../../apps/client/src/boss-lumiwick-paint";
import {
  lumiwickPlacements,
  lumiwickPose,
  type LumiCue,
} from "../../../apps/client/src/boss-lumiwick";

export interface Cutout {
  canvas: HTMLCanvasElement;
  face: { x: number; y: number };
  body: { x: number; y: number };
}
export interface CutoutOpts {
  /** poster px per world px */
  k: number;
  facing?: number;
  t?: number;
  action?: string;
  phase?: number;
}

/** The eyes' midpoint (canvas px), else the head. */
function eyesOr(
  eyes: { x: number; y: number }[] | undefined,
  head: { x: number; y: number },
  cx: number,
  cy: number,
  k: number,
) {
  const e = eyes?.length
    ? {
        x: eyes.reduce((a, p) => a + p.x, 0) / eyes.length,
        y: eyes.reduce((a, p) => a + p.y, 0) / eyes.length,
      }
    : head;
  return { x: cx + e.x * k, y: cy + e.y * k };
}
type Frame = {
  x: number;
  y: number;
  w: number;
  h: number;
  q: number;
  ox: number;
  oy: number;
};
interface Pl {
  piece: string;
  x: number;
  y: number;
  rot: number;
  sx: number;
  sy: number;
  alpha: number;
  add?: boolean;
  glow?: boolean;
}

/** Draw atlas placements whose frame origin is a 0-1 fraction (ox, oy). */
function drawFrac(
  ctx: CanvasRenderingContext2D,
  atlas: HTMLCanvasElement,
  frames: Record<string, Frame>,
  pls: Pl[],
  cx: number,
  cy: number,
  k: number,
) {
  for (const p of pls) {
    const f = frames[p.piece];
    if (!f) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
    if (p.add || p.glow) ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx + p.x * k, cy + p.y * k);
    ctx.rotate(p.rot);
    ctx.scale((p.sx * k) / f.q, (p.sy * k) / f.q);
    ctx.drawImage(
      atlas,
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
}

const baseCue = (): LumiCue => ({
  clock: 0.3,
  phase: 2,
  reduced: true,
  flight: 1,
  windup: 0,
  castAge: 99,
  exposed: false,
  groundAge: 0,
  takeoffAge: 99,
  stagger: false,
  hurt: 0,
  dead: false,
  deadAge: 0,
  roarAge: 99,
});

export function lumiwick(o: CutoutOpts): Cutout {
  const density = Math.max(1, o.k * 1.15);
  const atlas = paintLumiwickAtlas(density);
  const cue = baseCue();
  cue.phase = o.phase ?? 2;
  if (o.action) {
    cue.windKind = o.action;
    cue.windup = o.t ?? 0.8;
  }
  const P = lumiwickPose(cue);
  const placed = lumiwickPlacements(P, o.facing ?? 0, { x: 0, y: 1 });
  const W = Math.ceil(520 * o.k),
    H = Math.ceil(620 * o.k);
  const cx = W / 2,
    cy = H * 0.9;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  drawFrac(ctx, atlas.canvas, atlas.frames, placed.placements, cx, cy, o.k);
  return {
    canvas: c,
    face: eyesOr(placed.eyes, placed.head, cx, cy, o.k),
    body: { x: cx + placed.heart.x * o.k, y: cy + placed.heart.y * o.k },
  };
}

// ───────────────────────── Tidelotl ─────────────────────────
import {
  tidelotlPieces,
  tidelotlPlacements,
  tidelotlPose,
  paintPiece as paintLotlPiece,
  type LotlCue,
} from "../../../apps/client/src/boss-tidelotl";

export function tidelotl(
  o: CutoutOpts & { wet?: boolean; patch?: Record<string, unknown> },
): Cutout {
  const cue: LotlCue = {
    clock: 0.3,
    phase: o.phase ?? 2,
    reduced: true,
    windup: o.t ?? 0.8,
    windKind: o.action,
    castAge: 99,
    stranded: false,
    stagger: false,
    hurt: 0,
    dead: false,
    rise: 1,
    deathSink: 0,
    roarAge: 99,
  };
  const P = tidelotlPose(cue);
  if (o.patch) Object.assign(P, o.patch);
  const layout = tidelotlPlacements(
    P,
    o.facing ?? 1,
    cue.phase,
    o.wet ?? false,
  );
  const byName = new Map(tidelotlPieces().map((p) => [p.name, p]));
  const density = Math.max(1, o.k * 1.15);
  const W = Math.ceil(700 * o.k),
    H = Math.ceil(700 * o.k);
  const cx = W / 2,
    cy = H * 0.78;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const painted = new Map<string, ReturnType<typeof paintLotlPiece>>();
  for (const pl of layout.placements) {
    if (/shadow|puddle/i.test(pl.piece)) continue;
    const pc = byName.get(pl.piece);
    if (!pc) continue;
    if (!painted.has(pl.piece))
      painted.set(
        pl.piece,
        paintLotlPiece({ ...pc, q: pc.q * density }, cue.phase),
      );
    const im = painted.get(pl.piece);
    if (!im) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, pl.alpha);
    ctx.translate(cx + pl.x * o.k, cy + pl.y * o.k);
    ctx.rotate(pl.rot);
    ctx.scale((pl.sx * o.k) / im.q, (pl.sy * o.k) / im.q);
    ctx.drawImage(im.canvas, -im.ox, -im.oy);
    ctx.restore();
  }
  return {
    canvas: c,
    face: { x: cx + layout.head.x * o.k, y: cy + layout.head.y * o.k },
    body: { x: cx + layout.pearl.x * o.k, y: cy + layout.pearl.y * o.k },
  };
}

// ───────────────────────── Inkpurr ─────────────────────────
import {
  inkPlacements,
  inkPose,
  type InkCue,
} from "../../../apps/client/src/boss-inkpurr";
import {
  inkPieceSpecs,
  paintPieceCanvas,
  pieceCanvasSize,
} from "../../../apps/client/src/boss-inkpurr-paint";

export function inkpurr(
  o: CutoutOpts & { patch?: Record<string, unknown> },
): Cutout {
  const cue: InkCue = {
    clock: 0,
    phase: o.phase ?? 2,
    reduced: true,
    windKind: o.action,
    windup: o.t ?? 0.8,
    castAge: 99,
    stagger: false,
    exposed: false,
    hurt: 0,
    dead: false,
    deadAge: 0,
    roarAge: 99,
    flicker: false,
  };
  const P = inkPose(cue);
  if (o.patch) Object.assign(P, o.patch);
  const placed = inkPlacements(P, {
    facing: o.facing ?? 1,
    phase: cue.phase,
    clock: 0,
  });
  // paint only the pieces shown, untrimmed (the shipped trims are measured at battle density)
  const qs = Math.max(1, o.k * 1.6);
  const specs = new Map(inkPieceSpecs(qs).map((p: any) => [p.name, p]));
  const pieces = new Map<
    string,
    { src: HTMLCanvasElement; q: number; ox: number; oy: number }
  >();
  const W = Math.ceil(520 * o.k),
    H = Math.ceil(520 * o.k);
  const cx = W / 2,
    cy = H * 0.85;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  for (const p of [...placed.placements].sort((a, b) => a.z - b.z)) {
    if (/shadow|puddle/i.test(p.piece)) continue;
    const sp: any = specs.get(p.piece);
    if (!sp) continue;
    if (!pieces.has(p.piece)) {
      const out: any = paintPieceCanvas(sp.name, sp.box, sp.q, sp.draw, sp.opt);
      const { pad } = pieceCanvasSize(sp.box, sp.q);
      if (out)
        pieces.set(p.piece, {
          src: out.src,
          q: sp.q,
          ox: pad - sp.box[0] * sp.q,
          oy: pad - sp.box[1] * sp.q,
        });
    }
    const f = pieces.get(p.piece);
    if (!f) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
    if (p.glow) ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx + p.x * o.k, cy + p.y * o.k);
    ctx.rotate(p.rot);
    ctx.scale((p.sx * o.k) / f.q, (p.sy * o.k) / f.q);
    ctx.drawImage(f.src, -f.ox, -f.oy);
    ctx.restore();
  }
  return {
    canvas: c,
    face: eyesOr(placed.eyes, placed.head, cx, cy, o.k),
    body: { x: cx + placed.body.x * o.k, y: cy + placed.body.y * o.k },
  };
}

// ───────────────────────── Cragmuff ─────────────────────────
import { buildAtlas as buildCragAtlas } from "../../../apps/client/src/boss-cragmuff-art";
import {
  CRAGMUFF_SCALE,
  cragmuffPlacements,
  cragmuffPose,
  type CragmuffCue,
} from "../../../apps/client/src/boss-cragmuff";

export function cragmuff(
  o: CutoutOpts & { cue?: Partial<CragmuffCue> },
): Cutout {
  const cue: CragmuffCue = {
    time: 0,
    breath: 0,
    phase: o.phase ?? 3,
    reduced: true,
    charge: 0,
    charging: false,
    slam: 0,
    impact: 0,
    debris: 0,
    transform: 0,
    crash: 0,
    windKind: o.action,
    windup: o.t ?? 0.8,
    castAge: 99,
    stagger: false,
    exposed: false,
    dazed: false,
    hurt: 0,
    dead: false,
    deathAge: 0,
    stride: 0,
    speed: 0,
    ...o.cue,
  };
  const P = cragmuffPose(cue);
  const ph = Math.max(1, Math.min(3, Math.round(cue.phase))) as 1 | 2 | 3;
  const placed = cragmuffPlacements(P, o.facing ?? 1, ph, 0, true);
  const A = buildCragAtlas(Math.max(1, o.k * 1.3));
  const page: HTMLCanvasElement = A.pages[0];
  console.log("crag atlas", page.width, page.height);
  const W = Math.ceil(560 * o.k),
    H = Math.ceil(480 * o.k);
  const cx = W / 2,
    cy = H * 0.86;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const SC = CRAGMUFF_SCALE * o.k;
  const draw = (list: any[], add: boolean) => {
    for (const p of list) {
      const f = A.pieces[p.piece];
      if (!f) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
      if (add || p.glow) ctx.globalCompositeOperation = "lighter";
      ctx.translate(cx + p.x * SC, cy + p.y * SC);
      ctx.rotate(p.rot);
      ctx.scale((p.sx * SC) / f.q, (p.sy * SC) / f.q);
      ctx.drawImage(
        page,
        f.sx,
        f.sy,
        f.w,
        f.h,
        -f.ox * f.q,
        -f.oy * f.q,
        f.w,
        f.h,
      );
      ctx.restore();
    }
  };
  const pl: any = placed;
  draw(pl.images, false);
  if (pl.glows) draw(pl.glows, true);
  const head = pl.eyes?.length
    ? {
        x: pl.eyes.reduce((a: number, e: any) => a + e.x, 0) / pl.eyes.length,
        y: pl.eyes.reduce((a: number, e: any) => a + e.y, 0) / pl.eyes.length,
      }
    : pl.head;
  const core = pl.core ?? { x: 0, y: -60 };
  return {
    canvas: c,
    face: { x: cx + head.x * SC, y: cy + head.y * SC },
    body: { x: cx + core.x * SC, y: cy + core.y * SC },
  };
}

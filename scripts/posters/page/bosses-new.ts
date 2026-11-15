/**
 * Cutouts for the newest bosses (Prismell, Snoozaku), loaded on demand: their
 * rig painters come from "@poster-rigs" (the client's source by default, or
 * the folder given to build-posters --rigs while they are on other branches).
 */
import {
  eyesOr,
  piece,
  type Cutout,
  type CutoutOpts,
  type Layer,
} from "./bosses";
import {
  PRISMELL_SCALE,
  prismellPlacements,
  prismellPose,
  type PrismellCue,
} from "@poster-rigs/boss-prismell";
import { paintPrismellPieces } from "@poster-rigs/boss-prismell-paint";
import {
  SNOOZAKU_SCALE,
  snoozakuPlacements,
  snoozakuPose,
  type SnoozakuCue,
} from "@poster-rigs/boss-snoozaku";
import { buildAtlas as buildSnoozakuAtlas } from "@poster-rigs/boss-snoozaku-art";

export function prismell(
  o: CutoutOpts & { patch?: Record<string, unknown> },
): Cutout {
  const cue: PrismellCue = {
    clock: 0,
    phase: o.phase ?? 2,
    reduced: true,
    windKind: o.action,
    windup: o.t ?? 0.8,
    castAge: 99,
    roarAge: 99,
    exposed: false,
    stagger: false,
    hurt: 0,
    dead: false,
    deadAge: 0,
  };
  const P = prismellPose(cue);
  if (o.patch) Object.assign(P, o.patch);
  const placed: any = prismellPlacements(P, o.facing ?? 1, cue.phase);
  const all = [...placed.images, ...placed.glows];
  const frames: any = paintPrismellPieces(
    [...new Set(all.map((p: any) => p.piece))],
    o.k * PRISMELL_SCALE * 1.3,
  );
  const W = Math.ceil(560 * o.k),
    H = Math.ceil(520 * o.k);
  const cx = W / 2,
    cy = H * 0.86;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const layers: Layer[] = [];
  for (const p of placed.images.concat(placed.glows)) {
    if (/shadow|puddle/i.test(p.piece)) continue;
    const f = frames[p.piece];
    if (!f) continue;
    ctx.save();
    ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
    if (p.glow) ctx.globalCompositeOperation = "lighter";
    ctx.translate(cx + p.x * o.k, cy + p.y * o.k);
    ctx.rotate(p.rot);
    ctx.scale((p.sx * o.k) / f.q, (p.sy * o.k) / f.q);
    piece(
      ctx,
      layers,
      p.piece,
      !!p.glow,
      f.canvas,
      0,
      0,
      f.canvas.width,
      f.canvas.height,
      -f.ox * f.q,
      -f.oy * f.q,
    );
    ctx.restore();
  }
  return {
    canvas: c,
    face: eyesOr(placed.eyes, placed.head, cx, cy, o.k),
    body: { x: cx + placed.shell.x * o.k, y: cy + placed.shell.y * o.k },
    layers,
  };
}

export function snoozaku(
  o: CutoutOpts & { cue?: Partial<SnoozakuCue> },
): Cutout {
  const cue: SnoozakuCue = {
    time: 0,
    phase: o.phase ?? 2,
    reduced: true,
    windKind: o.action,
    windup: o.t ?? 0.8,
    castAge: 99,
    roarAge: 99,
    nightmareAge: 99,
    exposed: false,
    stagger: false,
    hurt: 0,
    dead: false,
    deadAge: 0,
    stride: 0,
    speed: 0,
    ...o.cue,
  };
  const P = snoozakuPose(cue);
  const ph = Math.max(1, Math.min(3, Math.round(cue.phase))) as 1 | 2 | 3;
  const placed: any = snoozakuPlacements(P, o.facing ?? 1, ph, 0, true);
  const A: any = buildSnoozakuAtlas(Math.max(1, o.k * 1.3));
  const page: HTMLCanvasElement = A.pages[0];
  const W = Math.ceil(600 * o.k),
    H = Math.ceil(560 * o.k);
  const cx = W / 2,
    cy = H * 0.88;
  const c = document.createElement("canvas");
  c.width = W;
  c.height = H;
  const ctx = c.getContext("2d")!;
  const SC = SNOOZAKU_SCALE * o.k;
  const layers: Layer[] = [];
  const draw = (list: any[], add: boolean) => {
    for (const p of list) {
      if (/shadow|puddle/i.test(p.piece)) continue;
      const f = A.pieces[p.piece];
      if (!f) continue;
      ctx.save();
      ctx.globalAlpha = Math.min(1, Math.max(0, p.alpha));
      if (add || p.glow) ctx.globalCompositeOperation = "lighter";
      ctx.translate(cx + p.x * SC, cy + p.y * SC);
      ctx.rotate(p.rot);
      ctx.scale((p.sx * SC) / f.q, (p.sy * SC) / f.q);
      piece(
        ctx,
        layers,
        p.piece,
        !!(add || p.glow),
        page,
        f.sx,
        f.sy,
        f.w,
        f.h,
        -f.ox * f.q,
        -f.oy * f.q,
      );
      ctx.restore();
    }
  };
  draw(placed.images, false);
  if (placed.glows) draw(placed.glows, true);
  const e = placed.eyes?.length
    ? {
        x:
          placed.eyes.reduce((a: number, q: any) => a + q.x, 0) /
          placed.eyes.length,
        y:
          placed.eyes.reduce((a: number, q: any) => a + q.y, 0) /
          placed.eyes.length,
      }
    : placed.head;
  return {
    canvas: c,
    face: { x: cx + e.x * SC, y: cy + e.y * SC },
    body: { x: cx + placed.heart.x * SC, y: cy + placed.heart.y * SC },
    layers,
  };
}

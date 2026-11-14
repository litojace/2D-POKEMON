import * as B from "./bosses";
import { POSTERS, renderPoster } from "./posters";

/** WebP at the best quality that fits the byte budget. */
function encode(c: HTMLCanvasElement, maxBytes: number) {
  let lo = 0.3,
    hi = 0.95,
    best = c.toDataURL("image/webp", lo);
  for (let i = 0; i < 7; i++) {
    const q = (lo + hi) / 2;
    const d = c.toDataURL("image/webp", q);
    if ((d.length - 23) * 0.75 <= maxBytes) {
      best = d;
      lo = q;
    } else hi = q;
  }
  return best;
}
const w = window as any;
w.B = B;
w.toPng = (c: HTMLCanvasElement) => c.toDataURL("image/png");
w.posterIds = () => Object.keys(POSTERS);
w.buildPoster = async (
  id: string,
  budget: { splash: number; portrait: number; thumb: number },
) => {
  const p = await renderPoster(id);
  return {
    splash: encode(p.splash.canvas, budget.splash),
    portrait: encode(p.portrait.canvas, budget.portrait),
    thumb: encode(p.thumb, budget.thumb),
    face: p.splash.face,
    body: p.splash.body,
    portraitFace: p.portrait.face,
  };
};
w.ready = true;

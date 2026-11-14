import type { RaidBossId } from "../../../packages/shared/src/raid-roster";
import { cragmuffGuideImage } from "./boss-cragmuff";
import { tidelotlGuideImage } from "./boss-tidelotl";
import { inkGuideImage } from "./boss-inkpurr";
import { somnaraGuideImage } from "./boss-vector-somnara";
import { prismaGuideImage } from "./boss-vector-prisma";
import { lumiwickGuideImage } from "./boss-lumiwick-guide";
import { twinsGuideImage } from "./boss-vector-twins";

interface GuideArt {
  url: string;
  width: number;
  height: number;
  crop: readonly [number, number, number, number];
  core: readonly [number, number];
  cores?: readonly (readonly [number, number])[];
}
/** Each boss's picture: `paint` false answers the crop and core at once, with the URL only once painted. */
const GUIDES: Record<
  RaidBossId,
  (exposed: boolean, paint: boolean) => GuideArt
> = {
  tidewyrm: tidelotlGuideImage,
  gloomshade: inkGuideImage,
  somnara: somnaraGuideImage,
  prismatail: prismaGuideImage,
  emberwing: lumiwickGuideImage,
  "storm-twins": twinsGuideImage,
  grumblecrag: cragmuffGuideImage,
};

// ── painting off the briefing's render ──
// A picture takes tens to hundreds of ms to paint the first time (seconds
// where the GPU is emulated, before the painters moved to CPU canvases), so
// the briefing never waits for one: the diagram is laid out at once from the
// crop, and each missing picture is painted when the page is idle, one per
// callback, then filled into every diagram showing it.
const queue: [RaidBossId, boolean][] = [];
let running = false;
const lookOf = (exposed: boolean) => (exposed ? "exposed" : "calm");
function paintNext() {
  const job = queue.shift();
  if (!job) {
    running = false;
    return;
  }
  const [id, exposed] = job;
  const { url } = GUIDES[id](exposed, true);
  if (url)
    document
      .querySelectorAll(
        `image[data-guide-art="${id}"][data-guide-look="${lookOf(exposed)}"]`,
      )
      .forEach((el) => el.setAttribute("href", url));
  later(paintNext);
}
function later(run: () => void) {
  if (typeof requestIdleCallback === "function")
    requestIdleCallback(run, { timeout: 300 });
  else setTimeout(run, 16);
}
function paintSoon(id: RaidBossId, exposed: boolean) {
  if (typeof document === "undefined") return;
  if (queue.some(([b, e]) => b === id && e === exposed)) return;
  queue.push([id, exposed]);
  if (!running) {
    running = true;
    later(paintNext);
  }
}

/** The boss for a briefing diagram: each boss draws itself once into a
 * picture (boss-*.ts), clipped to one complete creature. The picture arrives
 * a moment after the diagram (painted off the render, see above). */
export function raidGuideSprite(
  boss: RaidBossId,
  exposed = false,
  shadow = true,
  _action = 0,
) {
  const floor = shadow
    ? '<ellipse cy="25" rx="38" ry="8" fill="#061122" opacity=".65"/>'
    : "";
  const ring = (cx: number, cy: number) =>
    exposed
      ? `<circle cx="${cx}" cy="${cy}" r="12" fill="#82ffe7" fill-opacity=".15" stroke="#82ffe7" stroke-width="2"/>`
      : "";
  const id: RaidBossId = boss in GUIDES ? boss : "grumblecrag",
    art = GUIDES[id](exposed, false),
    [sx, sy, w, h] = art.crop,
    scale = Math.min(90 / w, 80 / h),
    frameX = -45 + (90 - w * scale) / 2,
    frameY = 25 - h * scale;
  if (!art.url) paintSoon(id, exposed);
  return `<g data-guide-boss="${boss}">${floor}<svg x="${frameX}" y="${frameY}" width="${w * scale}" height="${h * scale}" viewBox="${sx} ${sy} ${w} ${h}" preserveAspectRatio="xMidYMax meet" overflow="hidden"><image data-guide-sprite="${boss}" data-guide-art="${id}" data-guide-look="${lookOf(exposed)}"${art.url ? ` href="${art.url}"` : ""} width="${art.width}" height="${art.height}"/></svg>${(art.cores ?? [art.core]).map((c) => ring(frameX + (c[0] - sx) * scale, frameY + (c[1] - sy) * scale)).join("")}</g>`;
}

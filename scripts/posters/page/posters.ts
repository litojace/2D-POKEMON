/**
 * Each boss's poster: its pose, its painter look (looks.ts), its arena and
 * setting, its element's colours. `renderPoster(id)` paints the boss once,
 * composes the splash (1536x1024) and the portrait (600x900) around it, and
 * crops the thumb (320x213) from the splash around the boss.
 */
import { canvas, type Scene, type Theme } from "./compose";
import { compose } from "./scene";
import { paintBoss } from "./paint";
import { LOOKS } from "./looks";
import * as B from "./bosses";
import type { Cutout } from "./bosses";

import arenaEmber from "../../../apps/client/src/art/raid-arenas/emberwing.webp";
import arenaTide from "../../../apps/client/src/art/raid-arenas/tidewyrm.webp";
import arenaGloom from "../../../apps/client/src/art/raid-arenas/gloomshade.webp";
import arenaCrag from "../../../apps/client/src/art/raid-arenas/grumblecrag.webp";

type Frame = Pick<Scene, "place" | "sun" | "horizon" | "spin">;
export interface PosterDef {
  arena: string;
  theme: Theme;
  setting: Scene["setting"];
  /** The cutout at k (poster px per world px). */
  cutout: (k: number) => Cutout | Promise<Cutout>;
  /** k: the cutout's scale, about the splash's size (the portrait reuses it). */
  k: number;
  seed: number;
  splash: Frame;
  portrait: Frame;
}

// the key light is upper left in every scene (looks.ts KEY)
const SUN = { x: 0.2, y: 0.12 };

export const POSTERS: Record<string, PosterDef> = {
  emberwing: {
    arena: arenaEmber,
    setting: "sunset",
    seed: 11,
    k: 3.9,
    cutout: (k) =>
      B.lumiwick({
        k,
        facing: 0,
        action: "ember-rain",
        t: 0.9,
        phase: 2,
        patch: { heat: 0, flare: 0.15, fl: 0.9 },
      }),
    theme: {
      sky: ["#311447", "#8a2f5e", "#ec7448", "#ffd08a"],
      light: "#ffd890",
      haze: "#e89a72",
      cloud: ["#fff1d0", "#f2a07a", "#8a3a5a"],
      ribbons: [
        ["#ff5a1a", "#ffa032", "#fff2b0"],
        ["#ff3060", "#ff8a4a", "#ffe6c0"],
        ["#ffb000", "#ffd25a", "#fffbe0"],
      ],
      rim: "#ffe2a0",
      aura: "#ff9a3a",
      crack: "#ff7a1a",
      shade: "#3a0e22",
      particles: ["embers", "embers", "motes"],
      spark: "#ffd27a",
      stone: "#8a5a52",
    },
    splash: {
      place: { cx: 0.52, cy: 0.5, h: 0.8, maxW: 0.5 },
      sun: { x: 0.18, y: 0.28 },
      horizon: 0.7,
    },
    portrait: {
      place: { cx: 0.5, cy: 0.5, h: 0.78, maxW: 0.96, faceY: 0.4 },
      sun: { x: 0.15, y: 0.2 },
      horizon: 0.74,
    },
  },
  tidewyrm: {
    arena: arenaTide,
    setting: "sea",
    seed: 23,
    k: 3.3,
    cutout: (k) =>
      B.tidelotl({ k, facing: 1, action: "hightide", t: 0.9, phase: 2 }),
    theme: {
      sky: ["#0a3a5c", "#1f7d98", "#5cc8cf", "#d4fbf2"],
      light: "#f0fff4",
      haze: "#7fd2d2",
      cloud: ["#ffffff", "#a8e4e2", "#3a7a90"],
      ribbons: [
        ["#00a8ff", "#3ee6ff", "#e8ffff"],
        ["#00e0c0", "#7affe6", "#f0fffa"],
        ["#ff70b0", "#ffb0d8", "#fff0f8"],
      ],
      rim: "#f0ffff",
      aura: "#4ae0ff",
      crack: "#5af0ff",
      shade: "#04203a",
      particles: ["droplets", "bubbles", "droplets", "motes"],
      spark: "#d8ffff",
      stone: "#4a7a80",
    },
    splash: {
      place: { cx: 0.52, cy: 0.44, h: 0.66, maxW: 0.58 },
      sun: SUN,
      horizon: 0.58,
    },
    portrait: {
      place: { cx: 0.47, cy: 0.45, h: 0.6, maxW: 1.1, faceY: 0.42 },
      sun: { x: 0.15, y: 0.1 },
      horizon: 0.6,
    },
  },
  gloomshade: {
    arena: arenaGloom,
    setting: "night",
    seed: 37,
    k: 4.4,
    cutout: (k) =>
      B.inkpurr({ k, facing: 1, action: "hands", t: 0.9, phase: 2 }),
    theme: {
      sky: ["#070418", "#1c1046", "#4a2c8a", "#a684d8"],
      light: "#f4e6c8",
      haze: "#5a4490",
      cloud: ["#e6dcff", "#7c64b8", "#22164a"],
      ribbons: [
        ["#8a3cff", "#c08aff", "#f6eaff"],
        ["#ff3cc8", "#ff8ae0", "#fff0fb"],
        ["#ffc23c", "#ffe08a", "#fffbea"],
      ],
      rim: "#f4e6ff",
      aura: "#a060ff",
      crack: "#c080ff",
      shade: "#070214",
      particles: ["ink", "motes", "ink", "stars"],
      spark: "#efdcff",
      stone: "#4a3c70",
    },
    splash: {
      place: { cx: 0.52, cy: 0.52, h: 0.72, maxW: 0.6 },
      sun: { x: 0.2, y: 0.14 },
      horizon: 0.72,
    },
    portrait: {
      place: { cx: 0.42, cy: 0.5, h: 0.66, maxW: 1.05, faceY: 0.44 },
      sun: { x: 0.18, y: 0.1 },
      horizon: 0.76,
    },
  },
  grumblecrag: {
    arena: arenaCrag,
    setting: "canyon",
    seed: 41,
    k: 4.7,
    cutout: (k) =>
      B.cragmuff({
        k,
        facing: 1,
        action: "charge",
        cue: { charge: 0.9 },
        phase: 3,
      }),
    theme: {
      sky: ["#24306a", "#6a5c96", "#f0a860", "#ffe6a8"],
      light: "#fff0c0",
      haze: "#d8a882",
      cloud: ["#fff6e4", "#e8b898", "#7a5050"],
      ribbons: [
        ["#ff9a00", "#ffc23a", "#fff6c8"],
        ["#ffcf40", "#ffe68a", "#fffbe8"],
        ["#e06a1a", "#ffa04a", "#ffe8c8"],
      ],
      rim: "#fff2c8",
      aura: "#ffb040",
      crack: "#ffb020",
      shade: "#2a1606",
      particles: ["crystals", "motes", "crystals", "motes"],
      spark: "#ffe6a0",
      stone: "#a8764a",
    },
    splash: {
      place: { cx: 0.52, cy: 0.55, h: 0.66, maxW: 0.6, ground: 0.9 },
      sun: SUN,
      horizon: 0.62,
    },
    portrait: {
      place: { cx: 0.42, cy: 0.5, h: 0.58, maxW: 1.15, ground: 0.84 },
      sun: { x: 0.15, y: 0.1 },
      horizon: 0.6,
    },
  },
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, no) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = no;
    im.src = src;
  });
}
/** Downscale in halving steps (clean), then to the exact size. */
function resample(
  src: HTMLCanvasElement,
  sx: number,
  sy: number,
  sw: number,
  sh: number,
  w: number,
  h: number,
) {
  let cur = canvas(sw, sh);
  cur.getContext("2d")!.drawImage(src, sx, sy, sw, sh, 0, 0, sw, sh);
  while (cur.width / 2 > w * 1.2) {
    const c = canvas(cur.width / 2, cur.height / 2);
    const g = c.getContext("2d")!;
    g.imageSmoothingQuality = "high";
    g.drawImage(cur, 0, 0, c.width, c.height);
    cur = c;
  }
  const out = canvas(w, h);
  const g = out.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(cur, 0, 0, w, h);
  return out;
}

export async function renderPoster(id: string, def: PosterDef = POSTERS[id]) {
  const arena = await loadImage(def.arena);
  const cut = await def.cutout(def.k);
  const look = LOOKS[id];
  const fr: [number, number] = [look.face[0] * def.k, look.face[1] * def.k];
  const bossPx = Math.max(cut.canvas.width, cut.canvas.height);
  const painted = paintBoss(
    cut,
    look.mats,
    look.light,
    { x: cut.face.x, y: cut.face.y + fr[1] * 0.3, rx: fr[0], ry: fr[1] },
    bossPx / 2200,
  );
  const base = {
    arena,
    theme: def.theme,
    setting: def.setting,
    boss: painted,
    face: cut.face,
    body: cut.body,
    faceR: fr,
  };
  const splash = compose({
    W: 1536,
    H: 1024,
    seed: def.seed,
    ...base,
    ...def.splash,
  });
  const portrait = compose({
    W: 600,
    H: 900,
    seed: def.seed + 1,
    ...base,
    ...def.portrait,
  });
  // the thumb: cropped around the boss (about two thirds of its height), the face inside
  const S = splash.canvas;
  const [bx, by, bw, bh] = splash.box;
  let ch = (bh * S.height) / 0.68,
    cw = (ch * 320) / 213;
  if (cw > S.width) {
    cw = S.width;
    ch = (cw * 213) / 320;
  }
  let cx = (bx + bw / 2) * S.width,
    cy = (by + bh / 2) * S.height;
  const fx = splash.face[0] * S.width,
    fy = splash.face[1] * S.height;
  cx = Math.min(Math.max(cx, fx - cw * 0.3), fx + cw * 0.3);
  cy = Math.min(Math.max(cy, fy - ch * 0.25), fy + ch * 0.25);
  const x0 = Math.min(Math.max(0, cx - cw / 2), S.width - cw),
    y0 = Math.min(Math.max(0, cy - ch / 2), S.height - ch);
  const thumb = resample(S, x0, y0, cw, ch, 320, 213);
  const thumbFace: [number, number] = [(fx - x0) / cw, (fy - y0) / ch];
  return { splash, portrait, thumb, thumbFace, painted };
}

/**
 * Each boss's poster: its cutout and pose, its arena, its element's light.
 * `renderPoster(id)` draws the splash (1536x1024), the portrait (600x900)
 * and the thumb (320x213), and says where the face and body landed.
 */
import { compose, canvas, rgba, type Scene, type Theme } from "./compose";
import * as B from "./bosses";
import type { Cutout } from "./bosses";

import arenaEmber from "../../../apps/client/src/art/raid-arenas/emberwing.webp";
import arenaTide from "../../../apps/client/src/art/raid-arenas/tidewyrm.webp";
import arenaGloom from "../../../apps/client/src/art/raid-arenas/gloomshade.webp";
import arenaCrag from "../../../apps/client/src/art/raid-arenas/grumblecrag.webp";
import arenaPrism from "../../../apps/client/src/art/raid-arenas/prismatail.webp";
import arenaSomn from "../../../apps/client/src/art/raid-arenas/somnara.webp";

export interface PosterDef {
  arena: string;
  theme: Theme;
  /** The cutout at k (poster px per world px). */
  cutout: (k: number) => Cutout | Promise<Cutout>;
  /** k for the splash; the portrait reuses the same cutout. */
  k: number;
  seed: number;
  splash: Pick<Scene, "place" | "sun" | "horizon" | "spin">;
  portrait: Pick<Scene, "place" | "sun" | "horizon" | "spin">;
  extraSky?: Scene["extraSky"];
}

const crescent = (col: string, x: number, y: number, R: number) =>
  ((g: CanvasRenderingContext2D, s: Scene, u: number) => {
    const cx = x * s.W,
      cy = y * s.H,
      r = R * u;
    g.save();
    g.globalCompositeOperation = "screen";
    const gl = g.createRadialGradient(cx, cy, 0, cx, cy, r * 3.2);
    gl.addColorStop(0, rgba(col, 0.55));
    gl.addColorStop(1, rgba(col, 0));
    g.fillStyle = gl;
    g.fillRect(cx - r * 4, cy - r * 4, r * 8, r * 8);
    g.globalCompositeOperation = "source-over";
    const m = canvas(r * 2.4, r * 2.4);
    const mg = m.getContext("2d")!;
    const mgr = mg.createRadialGradient(
      r * 0.9,
      r * 0.9,
      0,
      r * 1.2,
      r * 1.2,
      r,
    );
    mgr.addColorStop(0, "#fffbe8");
    mgr.addColorStop(1, col);
    mg.fillStyle = mgr;
    mg.beginPath();
    mg.arc(r * 1.2, r * 1.2, r, 0, Math.PI * 2);
    mg.fill();
    mg.globalCompositeOperation = "destination-out";
    mg.beginPath();
    mg.arc(r * 1.65, r * 0.9, r * 0.86, 0, Math.PI * 2);
    mg.fill();
    g.drawImage(m, cx - r * 1.2, cy - r * 1.2);
    g.restore();
  }) as Scene["extraSky"];

export const POSTERS: Record<string, PosterDef> = {
  emberwing: {
    arena: arenaEmber,
    seed: 11,
    k: 3.1,
    cutout: (k) =>
      B.lumiwick({ k, facing: 0, action: "ember-rain", t: 0.9, phase: 2 }),
    theme: {
      sky: ["#2a0f3e", "#7a2350", "#e2603a", "#ffc070"],
      light: "#ffcf7a",
      haze: "#e88a5c",
      cloud: ["#fff0c8", "#f39a6a", "#7a3150"],
      ribbons: [
        ["#ff5a1a", "#ffa032", "#fff2b0"],
        ["#ff3060", "#ff8a4a", "#ffe6c0"],
        ["#ffb000", "#ffd25a", "#fffbe0"],
      ],
      rim: "#ffe2a0",
      aura: "#ff9a3a",
      crack: "#ff7a1a",
      shade: "#3a0e22",
      particles: ["embers", "embers", "lanterns", "motes"],
      spark: "#ffd27a",
      stone: "#6a3a3a",
    },
    splash: {
      place: { cx: 0.5, cy: 0.5, h: 0.8, maxW: 0.5 },
      sun: { x: 0.5, y: 0.2 },
      horizon: 0.74,
    },
    portrait: {
      place: { cx: 0.5, cy: 0.47, h: 0.72, maxW: 0.9 },
      sun: { x: 0.5, y: 0.2 },
      horizon: 0.78,
    },
  },
  tidewyrm: {
    arena: arenaTide,
    seed: 23,
    k: 2.6,
    cutout: (k) =>
      B.tidelotl({ k, facing: 1, action: "hightide", t: 0.9, phase: 2 }),
    theme: {
      sky: ["#06223a", "#0d5872", "#2fb2c0", "#bff4ee"],
      light: "#d8fff6",
      haze: "#5cc8cc",
      cloud: ["#f4ffff", "#8fdcdc", "#2a6a82"],
      ribbons: [
        ["#00a8ff", "#3ee6ff", "#e8ffff"],
        ["#00e0c0", "#7affe6", "#f0fffa"],
        ["#ff70b0", "#ffb0d8", "#fff0f8"],
      ],
      rim: "#e6ffff",
      aura: "#4ae0ff",
      crack: "#5af0ff",
      shade: "#03192c",
      particles: ["droplets", "bubbles", "droplets", "motes"],
      spark: "#b8fbff",
      stone: "#2a5a66",
    },
    extraSky: crescent("#e8fff8", 0.8, 0.14, 46),
    splash: {
      place: { cx: 0.5, cy: 0.52, h: 0.74, maxW: 0.62 },
      sun: { x: 0.52, y: 0.2 },
      horizon: 0.74,
    },
    portrait: {
      place: { cx: 0.46, cy: 0.47, h: 0.6, maxW: 1.08 },
      sun: { x: 0.5, y: 0.2 },
      horizon: 0.78,
    },
  },
  gloomshade: {
    arena: arenaGloom,
    seed: 37,
    k: 3.0,
    cutout: (k) =>
      B.inkpurr({ k, facing: 1, action: "hands", t: 0.9, phase: 2 }),
    theme: {
      sky: ["#0c0624", "#2c1660", "#7a46c0", "#e0b8ff"],
      light: "#f2d8ff",
      haze: "#7e5cc0",
      cloud: ["#f0e0ff", "#9a78d8", "#2e1a5a"],
      ribbons: [
        ["#8a3cff", "#c08aff", "#f6eaff"],
        ["#ff3cc8", "#ff8ae0", "#fff0fb"],
        ["#ffc23c", "#ffe08a", "#fffbea"],
      ],
      rim: "#f0dcff",
      aura: "#a060ff",
      crack: "#c080ff",
      shade: "#0a0420",
      particles: ["ink", "motes", "ink", "stars"],
      spark: "#e8d0ff",
      stone: "#3e2e66",
    },
    extraSky: crescent("#ffe9a8", 0.34, 0.1, 44),
    splash: {
      place: { cx: 0.5, cy: 0.53, h: 0.72, maxW: 0.6 },
      sun: { x: 0.5, y: 0.22 },
      horizon: 0.74,
    },
    portrait: {
      place: { cx: 0.48, cy: 0.47, h: 0.62, maxW: 1.02 },
      sun: { x: 0.5, y: 0.2 },
      horizon: 0.78,
    },
  },
  grumblecrag: {
    arena: arenaCrag,
    seed: 41,
    k: 2.6,
    cutout: (k) =>
      B.cragmuff({
        k,
        facing: 1,
        action: "charge",
        cue: { charge: 0.9 },
        phase: 3,
      }),
    theme: {
      sky: ["#1e1630", "#6a4060", "#d88a58", "#ffd8a0"],
      light: "#ffe2a8",
      haze: "#c89070",
      cloud: ["#fff4e0", "#e0a888", "#5a3a40"],
      ribbons: [
        ["#ff9a00", "#ffc23a", "#fff6c8"],
        ["#ffcf40", "#ffe68a", "#fffbe8"],
        ["#e06a1a", "#ffa04a", "#ffe8c8"],
      ],
      rim: "#fff2c0",
      aura: "#ffb040",
      crack: "#ffb020",
      shade: "#2a1606",
      particles: ["crystals", "motes", "crystals", "motes"],
      spark: "#ffe6a0",
      stone: "#7a6248",
    },
    splash: {
      place: { cx: 0.5, cy: 0.54, h: 0.7, maxW: 0.64 },
      sun: { x: 0.5, y: 0.2 },
      horizon: 0.74,
    },
    portrait: {
      place: { cx: 0.4, cy: 0.48, h: 0.56, maxW: 1.2 },
      sun: { x: 0.5, y: 0.2 },
      horizon: 0.78,
    },
  },
};
export const ARENAS = { prismatail: arenaPrism, somnara: arenaSomn };

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((ok, no) => {
    const im = new Image();
    im.onload = () => ok(im);
    im.onerror = no;
    im.src = src;
  });
}
function shrink(src: HTMLCanvasElement, w: number, h: number) {
  // halve in steps for a clean small picture
  let cur = src;
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
  const sw = cur.width,
    sh = (cur.width * h) / w;
  g.drawImage(cur, 0, (cur.height - sh) / 2, sw, sh, 0, 0, w, h);
  return out;
}

export async function renderPoster(id: string, def: PosterDef = POSTERS[id]) {
  const arena = await loadImage(def.arena);
  const cutout = await def.cutout(def.k);
  const splash = compose({
    W: 1536,
    H: 1024,
    arena,
    cutout,
    theme: def.theme,
    seed: def.seed,
    extraSky: def.extraSky,
    ...def.splash,
  });
  const portrait = compose({
    W: 600,
    H: 900,
    arena,
    cutout,
    theme: def.theme,
    seed: def.seed + 1,
    extraSky: def.extraSky,
    ...def.portrait,
  });
  const thumb = shrink(splash.canvas, 320, 213);
  return { splash, portrait, thumb };
}

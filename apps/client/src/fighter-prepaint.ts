/**
 * Fighter rig textures rasterized ahead of the battle, while the player is in
 * the menus (their own champion) or waits in a room (everyone in it).
 *
 * A battle's renderer is destroyed after every battle (main.ts, so iOS keeps
 * the page), so each battle turned every fighter's 64 rig layers from SVG
 * into pixels again behind the loading screen: on an Android phone that
 * "assets" phase took 0.47–0.81 s of a 0.7–1.25 s duel load (arena-load,
 * Nov 2026). Rasterized here, the battle only hands the canvases to WebGL.
 *
 * The canvases are the same pixels Phaser's SVG loader makes: the SVG gets
 * the texture's size as its width and height (as Phaser's SVGFile does), is
 * decoded, and is drawn once at that size. A battle texture keeps using
 * its canvas, and Phaser leaves the canvas as it is when the battle ends,
 * so the next battle (a rematch) reuses it. Only the fighters wanted now
 * are kept (about 3.8 MB of pixels per fighter and look); the rest are
 * dropped when the wanted set changes.
 */
import type Phaser from "phaser";
import type { CharacterId } from "@arena/shared";
import { rigAssets, skinSuffix, type RigAsset } from "./animation/assets";
import type { SkinLook } from "./creature-design";
import { addCanvasTexture } from "./canvas-texture";
import { idle, sizedSvg } from "./svg-raster";

export interface WantedFighter {
  character: CharacterId;
  look?: SkinLook | null;
}

/** Texture key → its rasterized layer. */
const painted = new Map<string, HTMLCanvasElement>();
/** The rig layers of each wanted fighter and look, in painting order. */
let wanted = new Map<string, RigAsset[]>();
let wantedSignature = "";
/** Bumped whenever the plan changes, so a running pass stops. */
let generation = 0;
let running = false;
/** A battle is on: paint nothing until the menus or a room are back. */
let paused = false;

/** Wait this long after a screen appears, so its entrance isn't held up. */
export const FIGHTER_PREPAINT_DELAY_MS = 900;

const fighterKey = (f: WantedFighter) =>
  `${f.character}${f.look ? skinSuffix(f.character, f.look) : ""}`;

/**
 * Rasterize these fighters' rig layers in quiet moments and drop any other
 * fighter's. The base look is always wanted for a fighter (a battle loads it
 * even when a skin is worn); a worn skin's layers are wanted too.
 */
export function syncFighterPrepaint(fighters: readonly WantedFighter[]) {
  if (paused) {
    paused = false;
    wantedSignature = "";
  }
  const sets = new Map<string, WantedFighter>();
  for (const f of fighters) {
    sets.set(f.character, { character: f.character });
    if (f.look && skinSuffix(f.character, f.look)) sets.set(fighterKey(f), f);
  }
  const signature = [...sets.keys()].sort().join(",");
  if (signature === wantedSignature) return;
  wantedSignature = signature;
  const next = new Map<string, RigAsset[]>();
  for (const [key, f] of sets)
    next.set(
      key,
      wanted.get(key) ??
        (f.look ? rigAssets(f.character, f.look) : rigAssets(f.character)),
    );
  wanted = next;
  const keep = new Set([...wanted.values()].flat().map((a) => a.key));
  for (const key of [...painted.keys()])
    if (!keep.has(key)) painted.delete(key);
  generation++;
  if (keep.size && ![...keep].every((key) => painted.has(key))) schedule();
}

/**
 * A battle is starting or on: stop painting (it would compete with the
 * battle) but keep what's painted, which the battle takes.
 */
export function holdFighterPrepaint() {
  if (paused) return;
  paused = true;
  generation++;
}

function schedule() {
  const mine = generation;
  window.setTimeout(() => {
    if (mine === generation && !running && !paused) void paintAll();
  }, FIGHTER_PREPAINT_DELAY_MS);
}

/** Layers that wouldn't rasterize here: the battle loads them as before. */
const failed = new Set<string>();
/**
 * Layers painted at once. One: four at once finished only about a fifth
 * sooner on a 4× slowed CPU, and made the menus stall up to 0.47 s.
 */
const BATCH = 1;
async function paintAll() {
  running = true;
  try {
    while (!paused) {
      const batch = [...wanted.values()]
        .flat()
        .filter((a) => !painted.has(a.key) && !failed.has(a.key))
        .slice(0, BATCH);
      if (!batch.length) return;
      const canvases = await Promise.all(
        batch.map((a) => rasterize(a).catch(() => undefined)),
      );
      // The plan may have changed meanwhile: keep only what is still wanted.
      const keep = new Set([...wanted.values()].flat().map((a) => a.key));
      batch.forEach((a, i) => {
        const canvas = canvases[i];
        if (!keep.has(a.key)) return;
        if (canvas) painted.set(a.key, canvas);
        else failed.add(a.key);
      });
    }
  } finally {
    running = false;
  }
}
async function rasterize(a: RigAsset) {
  await idle(1500);
  const base64 = a.url.slice(a.url.indexOf(",") + 1);
  const text = sizedSvg(atob(base64), a.width, a.height);
  const url = URL.createObjectURL(
    new Blob([text], { type: "image/svg+xml;charset=utf-8" }),
  );
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    await idle(1500);
    const canvas = document.createElement("canvas");
    canvas.width = a.width;
    canvas.height = a.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw Error("no 2d context");
    ctx.drawImage(image, 0, 0);
    return canvas;
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Give the scene each of these layers that was rasterized ahead and that it
 * doesn't have yet. Returns how many were added; the rest load as before.
 */
export function addPrepaintedLayers(scene: Phaser.Scene, layers: RigAsset[]) {
  let added = 0;
  for (const a of layers) {
    const canvas = painted.get(a.key);
    if (!canvas || scene.textures.exists(a.key)) continue;
    addCanvasTexture(scene.textures, a.key, canvas);
    added++;
  }
  return added;
}

/**
 * A layer whose canvas came back blank (rig-health.ts: Safari let its
 * pixels go while the page was hidden): never hand it out again.
 */
export function forgetPrepainted(key: string) {
  painted.delete(key);
}

/** What's rasterized now (tests). */
export const prepaintedLayerKeys = () => [...painted.keys()];

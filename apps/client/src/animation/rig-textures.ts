import type Phaser from "phaser";
import { artWidths, type RigAsset } from "./assets";

/**
 * Sharper rig textures for a scene that draws one fighter large (the menu
 * previews, shop-preview.ts): the SVG parts are rasterized `scale` times
 * bigger. Rig images stay their size in art units and tell the texture its
 * resolution, which Phaser's canvas renderer divides a frame by when it
 * draws (rig.ts), so the fighter keeps its size and gains detail. Battles
 * keep 1. Canvas renderer only: the WebGL renderer ignores `resolution`.
 */
const textureScale = new WeakMap<Phaser.Scene, number>();
export function setRigTextureScale(scene: Phaser.Scene, scale: number) {
  textureScale.set(scene, Math.max(1, scale));
}
const SVG_BASE64 = "data:image/svg+xml;base64,";
/**
 * The rig part's SVG at `width`×`height` px, sized in its own text, as
 * Phaser's SVG loader sizes it when given a size (a viewBox from its width
 * and height if it has none, then `width="Wpx" height="Hpx"`). Phaser does
 * that by parsing the whole SVG and writing it out again: on a phone at 4×
 * CPU, 147 ms of parsing and 19 of writing for one skin's parts in the
 * Shop, each time a skin was tried on (Nov 2026). Only the opening tag is
 * touched here. Undefined if the part isn't a base64 SVG (Phaser sizes it).
 */
export function sizedRigSvg(url: string, width: number, height: number) {
  if (!url.startsWith(SVG_BASE64)) return undefined;
  const text = atob(url.slice(SVG_BASE64.length));
  const start = text.indexOf("<svg");
  const end = start < 0 ? -1 : text.indexOf(">", start);
  if (end < 0 || text[end - 1] === "/") return undefined;
  let open = text.slice(start, end);
  const attr = (name: string) =>
    parseFloat(open.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1] ?? "");
  const w = attr("width"),
    h = attr("height");
  if (!/\sviewBox="/.test(open) && w && h) open += ` viewBox="0  0 ${w} ${h}"`;
  open = open.replace(/\s(?:width|height)="[^"]*"/g, "");
  open += ` width="${width}px" height="${height}px"`;
  return SVG_BASE64 + btoa(text.slice(0, start) + open + text.slice(end));
}
/** Queue the `assets` not loaded yet, at the scene's texture scale. */
export function loadRigTextures(scene: Phaser.Scene, assets: RigAsset[]) {
  const scale = textureScale.get(scene) ?? 1;
  for (const a of assets)
    if (!scene.textures.exists(a.key)) {
      const width = Math.round(a.width * scale),
        height = Math.round(a.height * scale);
      const sized = sizedRigSvg(a.url, width, height);
      if (sized) scene.load.svg(a.key, sized);
      else scene.load.svg(a.key, a.url, { width, height });
    }
}
/**
 * How much bigger than its art a rig texture was rasterized: 1 for a
 * battle's textures (their art's width give or take a rounded pixel) and
 * for anything that isn't a rig part.
 */
export function textureResolution(key: string, sourceWidth: number) {
  const art = artWidths.get(key);
  const r = art ? sourceWidth / art : 1;
  return r < 1.1 ? 1 : r;
}

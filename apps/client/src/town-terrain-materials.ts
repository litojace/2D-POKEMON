import { WORLD_ART } from "../../../packages/shared/src/world-art";
import { stonePaver } from "./world-materials";

type Ctx = CanvasRenderingContext2D;
export type TerrainSurface = "grass" | "earth" | "cobble" | "slab";
export type TerrainPaint = Record<TerrainSurface, CanvasPattern>;

/** All flat surfaces share the fountain's ground plane and upper-left light. */
export const TERRAIN = {
  mortar: "#a29378",
  edge: "#b8a78a",
  stone: ["#d1c09e", "#c4b494", "#d9c9aa", "#cabb9e"],
} as const;

/** Soft overlapping samples, wrapped at the edges, avoid the recognizable
 * four-way reflection of a small repeated lawn tile. Only used while baking. */
function meadow(source: HTMLImageElement) {
  const tile = document.createElement("canvas");
  tile.width = 1536;
  tile.height = 998;
  const c = tile.getContext("2d")!;
  c.fillStyle = "#62783b";
  c.fillRect(0, 0, tile.width, tile.height);
  const half = source.naturalWidth / 2;
  const random = (i: number) => {
    const n = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    return n - Math.floor(n);
  };
  const patch = document.createElement("canvas");
  patch.width = 224;
  patch.height = 146;
  const p = patch.getContext("2d")!;
  for (let i = 0; i < 650; i++) {
    p.clearRect(0, 0, 224, 146);
    const crop = 260 + random(i * 7.9) * 160;
    p.drawImage(
      source,
      3 + random(i * 3.7) * (half - crop - 6),
      3 + random(i * 5.1) * (half - crop - 6),
      crop,
      crop,
      0,
      0,
      224,
      146,
    );
    p.globalCompositeOperation = "destination-in";
    p.save();
    p.scale(1, 146 / 224);
    const fade = p.createRadialGradient(112, 112, 22, 112, 112, 112);
    fade.addColorStop(0, "#000");
    fade.addColorStop(0.5, "rgba(0,0,0,.8)");
    fade.addColorStop(1, "transparent");
    p.fillStyle = fade;
    p.fillRect(0, 0, 224, 224);
    p.restore();
    p.globalCompositeOperation = "source-over";
    const x = random(i * 11.3) * tile.width,
      y = random(i * 13.7) * tile.height;
    for (const ox of [-tile.width, 0, tile.width])
      for (const oy of [-tile.height, 0, tile.height]) {
        c.save();
        c.translate(x + ox, y + oy);
        c.scale(i % 2 ? -1 : 1, 1);
        c.drawImage(patch, -112, -73);
        c.restore();
      }
  }
  c.fillStyle = "rgba(37,73,44,.18)";
  c.fillRect(0, 0, tile.width, tile.height);
  return tile;
}

/** Bake-only source art. Phones receive the finished ground, not this atlas.
 * The procedural fallback uses the same stone sizes, palette and projection. */
export function terrainPaint(
  ctx: Ctx,
  source?: HTMLImageElement,
): TerrainPaint {
  const surfaces = ["grass", "earth", "cobble", "slab"] as const;
  const result = {} as TerrainPaint;
  for (const [index, kind] of surfaces.entries()) {
    if (source && kind === "grass") {
      result.grass = ctx.createPattern(meadow(source), "repeat")!;
      continue;
    }
    const size = kind === "slab" ? 384 : kind === "cobble" ? 256 : 320;
    const tile = document.createElement("canvas");
    // Mirrored repeats meet exactly at the source tile boundaries.
    tile.width = size * 2;
    tile.height = Math.round(size * WORLD_ART.groundY) * 2;
    const c = tile.getContext("2d")!;
    const h = tile.height / 2;
    const unit = document.createElement("canvas");
    unit.width = size;
    unit.height = h;
    const u = unit.getContext("2d")!;
    if (source) {
      const half = source.naturalWidth / 2;
      // Inset avoids borrowing a neighbouring material at the atlas seam.
      u.drawImage(
        source,
        (index % 2) * half + 2,
        Math.floor(index / 2) * half + 2,
        half - 4,
        half - 4,
        0,
        0,
        size,
        h,
      );
    } else {
      u.fillStyle =
        kind === "grass"
          ? "#5d7b42"
          : kind === "earth"
            ? "#c9ac78"
            : TERRAIN.mortar;
      u.fillRect(0, 0, size, h);
      if (kind === "cobble" || kind === "slab") {
        const w = kind === "slab" ? 76 : 28,
          sh = kind === "slab" ? 34 : 17;
        for (let row = 0, y = 0; y < h; row++, y += sh)
          for (let x = (-(row % 2) * w) / 2; x < size; x += w)
            stonePaver(
              u,
              x + 1,
              y + 1,
              w - 2,
              sh - 2,
              2,
              TERRAIN.stone[(row + Math.floor(x / w) + 100) % 4],
            );
      } else {
        for (let k = 0; k < 1700; k++) {
          const x = (k * 73.13) % size,
            y = (k * 31.71) % h;
          u.fillStyle = k % 2 ? "rgba(225,219,157,.14)" : "rgba(33,60,31,.13)";
          u.fillRect(
            x,
            y,
            kind === "grass" ? 0.8 : 1.5,
            kind === "grass" ? 3 : 0.7,
          );
        }
      }
    }
    for (let yy = 0; yy < 2; yy++)
      for (let xx = 0; xx < 2; xx++) {
        c.save();
        c.translate(xx ? size * 2 : 0, yy ? h * 2 : 0);
        c.scale(xx ? -1 : 1, yy ? -1 : 1);
        c.drawImage(unit, 0, 0);
        c.restore();
      }
    result[kind] = ctx.createPattern(tile, "repeat")!;
  }
  return result;
}

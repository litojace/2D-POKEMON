import type { TownBuilding } from "../../../packages/shared/src/town";
import type { Sprite } from "./town-art";
import {
  ARCHITECTURE,
  architectureLayout,
  architecturePlacement,
  WINDMILL_ROTOR_SCALE,
  type Frame,
  type Point,
} from "../../../packages/shared/src/town-building-layout";
export {
  ARCHITECTURE,
  architectureFrame,
  architectureLayout,
} from "../../../packages/shared/src/town-building-layout";

export interface ArchitecturePlacement {
  sprite: Sprite;
  flags: { x: number; y: number }[];
  flames: { x: number; y: number }[];
  chimney?: { x: number; y: number };
  hub?: { x: number; y: number };
  rotorScale: number;
}
function placement(
  source: CanvasImageSource,
  frame: Frame,
  width: number,
  offset: Point = [0, 0],
): ArchitecturePlacement {
  const layout = architectureLayout(frame, width),
    scale = layout.scale,
    point = (p: Point) => {
      const q = layout.point(p);
      return { x: q.x + offset[0], y: q.y + offset[1] };
    };
  const [sx, sy, sw, sh] = frame.crop;
  // Room for the separately animated flags' fixed poles above the roofline.
  const pad = 48;
  const ax = (frame.anchor[0] - sx) * scale + pad - offset[0],
    ay = (frame.anchor[1] - sy) * scale + pad - offset[1];
  const flags = (frame.flags ?? []).map(point),
    flames = (frame.flames ?? []).map(point);
  return {
    flags,
    flames,
    chimney: frame.chimney ? point(frame.chimney) : undefined,
    hub: frame.hub ? point(frame.hub) : undefined,
    rotorScale: WINDMILL_ROTOR_SCALE,
    sprite: {
      w: sw * scale + pad * 2,
      h: sh * scale + pad * 2,
      ax,
      ay,
      draw(ctx) {
        ctx.drawImage(source, sx, sy, sw, sh, pad, pad, sw * scale, sh * scale);
        for (const p of flags) {
          ctx.strokeStyle = "#86704d";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.moveTo(ax + p.x, ay + p.y);
          ctx.lineTo(ax + p.x, ay + p.y - 44);
          ctx.stroke();
        }
      },
    },
  };
}
export function paintedBuilding(source: CanvasImageSource, b: TownBuilding) {
  const { frame, width, offset } = architecturePlacement(b);
  return placement(source, frame, width, offset);
}
export function architectureName(
  b: TownBuilding,
): Exclude<keyof typeof ARCHITECTURE, "temple"> | "raidHall" {
  const frame = architecturePlacement(b).frame;
  const name = Object.entries(ARCHITECTURE).find(
    ([, value]) => value === frame,
  )![0] as keyof typeof ARCHITECTURE;
  return name === "temple" ? "raidHall" : name;
}
/** HD exports are normalized to the original crop and doorstep coordinates.
 * Share their source textures across houses, preserving every native pixel. */
export function nativeBuilding(
  source: HTMLImageElement,
  b: TownBuilding,
  key: string,
) {
  const art = paintedBuilding(source, b),
    { frame, width } = architecturePlacement(b),
    scale = width / frame.inkWidth;
  art.sprite.nativeImage = {
    key,
    crop: [0, 0, source.naturalWidth, source.naturalHeight],
    rect: [48, 48, frame.crop[2] * scale, frame.crop[3] * scale],
  };
  return art;
}
export function paintedStall(source: CanvasImageSource, color: string): Sprite {
  const p = placement(source, ARCHITECTURE.market, 220),
    draw = p.sprite.draw;
  p.sprite.draw = (ctx) => {
    draw(ctx);
    const mark = architectureLayout(ARCHITECTURE.market, 220).point([737, 880]);
    const x = p.sprite.ax + mark.x,
      y = p.sprite.ay + mark.y;
    ctx.fillStyle = "#bc8f3f";
    ctx.beginPath();
    ctx.ellipse(x, y, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(x, y, 3.7, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();
  };
  return p.sprite;
}
export function nativeStall(source: HTMLImageElement | HTMLCanvasElement, key: string): Sprite {
  const sprite = placement(source, ARCHITECTURE.market, 220).sprite,
    scale = 220 / ARCHITECTURE.market.inkWidth;
  sprite.nativeImage = {
    key,
    crop: [
      0,
      0,
      "naturalWidth" in source ? source.naturalWidth : source.width,
      "naturalHeight" in source ? source.naturalHeight : source.height,
    ],
    rect: [
      48,
      48,
      ARCHITECTURE.market.crop[2] * scale,
      ARCHITECTURE.market.crop[3] * scale,
    ],
  };
  return sprite;
}

/** A market stall's cloth colour: hue (degrees) and saturation/brightness
 * multipliers applied to the painted red awning stripes and table runner. */
export interface ClothColor {
  hue: number;
  sat: number;
  val: number;
}
/**
 * Recolour the red cloth in RGBA pixels (in place). Only strongly red
 * pixels change (hue within 20° of red, saturated, not near black), so the
 * cream stripes, wood, lantern and blue curtain keep their colours; the
 * shading of the cloth is kept by changing hue only and scaling the rest.
 */
export function recolorCloth(data: Uint8ClampedArray, color: ClothColor) {
  const hue = (((color.hue % 360) + 360) % 360) / 60;
  for (let i = 0; i < data.length; i += 4) {
    if (!data[i + 3]) continue;
    const r = data[i] / 255,
      g = data[i + 1] / 255,
      b = data[i + 2] / 255;
    const max = Math.max(r, g, b);
    if (max !== r || max < 0.25) continue;
    const min = Math.min(g, b),
      d = max - min;
    if (d / max <= 0.45) continue;
    const h = ((g - b) / d) * 60; // -60..60 around red
    if (h > 16 || h < -20) continue;
    const v = Math.min(1, max * color.val),
      s = Math.min(1, (d / max) * color.sat),
      c = v * s,
      x = c * (1 - Math.abs((hue % 2) - 1)),
      m = v - c;
    const k = Math.floor(hue) % 6;
    const [R, G, B] =
      k === 0 ? [c, x, 0] : k === 1 ? [x, c, 0] : k === 2 ? [0, c, x] : k === 3 ? [0, x, c] : k === 4 ? [x, 0, c] : [c, 0, x];
    data[i] = Math.round((R + m) * 255);
    data[i + 1] = Math.round((G + m) * 255);
    data[i + 2] = Math.round((B + m) * 255);
  }
}
/**
 * The stall picture with its cloth recoloured, on a canvas (painted once).
 * At `size` pixels square (512: the stall is about 220 units wide, so this
 * stays sharp at normal zoom while three of them cost what one 1024 did).
 */
export function recoloredStall(source: HTMLImageElement, color: ClothColor, size = 512) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, size, size);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height);
  recolorCloth(pixels.data, color);
  ctx.putImageData(pixels, 0, 0);
  return canvas;
}

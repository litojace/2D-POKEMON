import type { Sprite } from "./town-art";

type Crop = readonly [number, number, number, number];
export const NATURE_FRAMES: readonly Crop[] = [
  [30, 44, 381, 362],
  [440, 53, 381, 349],
  [852, 45, 372, 368],
  [40, 412, 363, 457],
  [461, 453, 359, 408],
  [918, 437, 255, 429],
  [34, 918, 372, 295],
  [431, 914, 399, 297],
  [874, 952, 345, 250],
];
export const PROP_FRAMES = {
  well: [45, 12, 377, 447],
  lamp: [581, 13, 90, 442],
  board: [798, 18, 430, 420],
  sign: [77, 471, 327, 360],
  crates: [437, 541, 394, 283],
  mirror: [912, 432, 277, 411],
  plinth: [67, 864, 330, 350],
  dummy: [492, 837, 278, 382],
  planter: [824, 863, 405, 342],
} as const satisfies Record<string, Crop>;
export const ANIMAL_FRAMES: readonly Crop[] = [
  [16, 82, 343, 208],
  [402, 74, 310, 217],
  [735, 91, 337, 199],
  [1124, 89, 298, 201],
  [72, 384, 237, 283],
  [423, 381, 233, 286],
  [761, 380, 281, 288],
  [1123, 380, 272, 287],
  [18, 717, 331, 267],
  [385, 725, 328, 270],
  [766, 725, 254, 281],
  [1119, 694, 313, 297],
];

/** Full, independent illustrations fit inside the existing collision-safe frame. */
function painted(
  source: CanvasImageSource,
  crop: Crop,
  frame: Sprite,
  stretch = false,
  board = false,
  direct = false,
): Sprite {
  const [sx, sy, sw, sh] = crop,
    scale = Math.min((frame.w - 8) / sw, (frame.ay - 3) / sh);
  const w = stretch ? frame.w - 8 : sw * scale,
    h = stretch ? frame.ay - 3 : sh * scale;
  return {
    ...frame,
    ...(direct && !board
      ? {
          nativeImage: {
            crop,
            rect: [frame.ax - w / 2, frame.ay - h, w, h] as const,
          },
        }
      : {}),
    draw(ctx) {
      const [sx, sy, sw, sh] = crop,
        maxW = frame.w - 8,
        maxH = frame.ay - 3;
      const scale = Math.min(maxW / sw, maxH / sh);
      const w = stretch ? maxW : sw * scale,
        h = stretch ? maxH : sh * scale;
      const x = frame.ax - w / 2,
        y = frame.ay - h;
      ctx.save();
      if (board) {
        // Separate mirror ornament sits below the board in the source atlas.
        // Keep both complete board feet while excluding that transparent middle.
        ctx.beginPath();
        ctx.rect(x, y, w, h * 0.92);
        ctx.rect(x, y + h * 0.92, w * 0.24, h * 0.08);
        ctx.rect(x + w * 0.77, y + h * 0.92, w * 0.23, h * 0.08);
        ctx.clip();
      }
      ctx.drawImage(source, sx, sy, sw, sh, x, y, w, h);
      ctx.restore();
    },
  };
}
export function paintedNature(
  source: CanvasImageSource,
  kind: "crown" | "trunk" | "bush" | "rock",
  variant: number,
  frame: Sprite,
) {
  const index =
    kind === "crown"
      ? variant === 3
        ? 3
        : variant === 4
          ? 2
          : variant === 1
            ? 1
            : 0
      : kind === "trunk"
        ? variant === 4
          ? 5
          : 4
        : kind === "rock"
          ? 8
          : variant === 1
            ? 6
            : 7;
  return painted(
    source,
    NATURE_FRAMES[index],
    frame,
    kind === "trunk",
    false,
    true,
  );
}
export function paintedProp(
  source: CanvasImageSource,
  kind: string,
  frame: Sprite,
) {
  const crop = PROP_FRAMES[kind as keyof typeof PROP_FRAMES];
  return crop
    ? painted(source, crop, frame, kind === "board", kind === "board", true)
    : frame;
}
export function paintedAnimal(
  source: CanvasImageSource,
  kind: "duck" | "hen" | "dog" | "gull",
  pose: string,
  index: number,
  female: boolean,
  frame: Sprite,
): Sprite {
  if (kind === "gull") {
    return {
      ...frame,
      draw(ctx) {
        const [sx, sy, sw, sh] = ANIMAL_FRAMES[11];
        const scale = Math.min((frame.w - 6) / sw, (frame.h - 4) / sh);
        ctx.drawImage(
          source,
          sx,
          sy,
          sw,
          sh,
          frame.ax - (sw * scale) / 2,
          frame.ay - (sh * scale) / 2,
          sw * scale,
          sh * scale,
        );
      },
    };
  }
  const cell =
    kind === "duck"
      ? pose === "dabble"
        ? female
          ? 5
          : 4
        : (female ? 2 : 0) + (index % 2)
      : kind === "hen"
        ? female
          ? 7
          : 6
        : kind === "dog"
          ? pose === "sit"
            ? 10
            : 8 + (index % 2)
          : 11;
  return painted(source, ANIMAL_FRAMES[cell], frame);
}

/** Actual blank gold plaque within the plinth source crop, in source pixels. */
export const PLINTH_PLAQUE = { x: 110, y: 124, width: 110, height: 56 };
export function plinthLabelBounds(frame: Sprite) {
  return {
    x: frame.ax - 48 + (PLINTH_PLAQUE.x * 96) / 330,
    y: frame.ay - 67 + (PLINTH_PLAQUE.y * 67) / 350,
    width: (PLINTH_PLAQUE.width * 96) / 330,
    height: (PLINTH_PLAQUE.height * 67) / 350,
  };
}
export function paintedPlinth(
  source: CanvasImageSource,
  frame: Sprite,
  name: string | null,
): Sprite {
  return {
    ...frame,
    draw(ctx) {
      const [x, y, w, h] = PROP_FRAMES.plinth;
      ctx.drawImage(source, x, y, w, h, frame.ax - 48, frame.ay - 67, 96, 67);
      ctx.fillStyle = "rgba(47,40,27,.18)";
      ctx.beginPath();
      ctx.ellipse(frame.ax, frame.ay - 58, 22, 6, 0, 0, Math.PI * 2);
      ctx.fill();
      if (name) {
        const plaque = plinthLabelBounds(frame),
          pad = 0.8;
        const words = name.toUpperCase().trim().split(/\s+/);
        const lines =
          words.length > 1
            ? [words.slice(0, -1).join(" "), words.at(-1)!]
            : words;
        const lineHeight = (plaque.height - pad * 2) / lines.length;
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          plaque.x + pad,
          plaque.y + pad,
          plaque.width - pad * 2,
          plaque.height - pad * 2,
        );
        ctx.clip();
        ctx.fillStyle = "#3d2b10";
        ctx.textAlign = "center";
        ctx.textBaseline = "alphabetic";
        for (const [i, line] of lines.entries()) {
          let size = lines.length > 1 ? 6.2 : 7;
          do {
            ctx.font = `700 ${size}px 'Barlow Condensed', 'Arial Narrow', sans-serif`;
            const ink = ctx.measureText(line);
            if (
              Math.max(
                ink.width,
                ink.actualBoundingBoxLeft + ink.actualBoundingBoxRight,
              ) <=
              plaque.width - pad * 2
            )
              break;
            size -= 0.25;
          } while (size >= 4.5);
          const metrics = ctx.measureText(line),
            ascent = metrics.actualBoundingBoxAscent,
            descent = metrics.actualBoundingBoxDescent;
          const centre = plaque.y + pad + lineHeight * (i + 0.5);
          ctx.fillText(
            line,
            plaque.x +
              plaque.width / 2 -
              (metrics.actualBoundingBoxRight - metrics.actualBoundingBoxLeft) /
                2,
            centre + (ascent - descent) / 2,
          );
        }
        ctx.restore();
      }
    },
  };
}

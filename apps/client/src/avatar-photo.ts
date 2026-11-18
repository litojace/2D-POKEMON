/**
 * Your own picture as your avatar (docs/hidden-picks.md, "Avatars"): a
 * photo from the device, at most 10 MB, cut to its middle square and made
 * 256 px here, so only a small file (WebP, or JPEG where the browser can't
 * make WebP, as Safari) leaves the device. The server takes at most 64 KB.
 */
import {
  PHOTO_MAX_BYTES,
  PHOTO_SIZE,
  PHOTO_SOURCE_MAX_BYTES,
} from "../../../packages/shared/src/avatars";

export class PhotoError extends Error {}

/** A file a player picked, as the 256 px picture the server takes. */
export async function preparePhoto(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/"))
    throw new PhotoError("Pick a photo (an image file).");
  if (file.size > PHOTO_SOURCE_MAX_BYTES)
    throw new PhotoError("That photo is over 10 MB. Pick a smaller one.");
  let image: ImageBitmap;
  try {
    image = await createImageBitmap(file);
  } catch {
    throw new PhotoError("That photo couldn't be opened. Try another one.");
  }
  // The middle square, filling the circle.
  const side = Math.min(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = PHOTO_SIZE;
  const g = canvas.getContext("2d")!;
  g.imageSmoothingQuality = "high";
  g.drawImage(
    image,
    (image.width - side) / 2,
    (image.height - side) / 2,
    side,
    side,
    0,
    0,
    PHOTO_SIZE,
    PHOTO_SIZE,
  );
  image.close();
  for (const quality of [0.86, 0.75, 0.6, 0.45]) {
    const webp = await blobOf(canvas, "image/webp", quality);
    // Safari makes a PNG when asked for WebP: use a JPEG there.
    const blob =
      webp?.type === "image/webp"
        ? webp
        : await blobOf(canvas, "image/jpeg", quality);
    if (blob && blob.size <= PHOTO_MAX_BYTES) return blob;
  }
  throw new PhotoError(
    "That photo couldn't be made small enough. Try another.",
  );
}

const blobOf = (canvas: HTMLCanvasElement, type: string, quality: number) =>
  new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

/**
 * What a device can do with a shared picture (share-preview.ts). On iPhone
 * and iPad, Safari files a download in Files, an installed web app often
 * drops it and the app's web view has none, so there the picture is kept
 * with a long press (Save to Photos) or the share sheet's Save Image.
 */
export function previewWays(o: {
  ios: boolean;
  app: boolean;
  touch: boolean;
  canShare: boolean;
}) {
  const apple = o.ios || o.app;
  return {
    share: o.canShare,
    save: !apple,
    hint: apple
      ? "Press and hold the picture, then Save to Photos."
      : o.touch
        ? "Or press and hold the picture to download it."
        : "",
    /** The share sheet gets the file alone (iOS drops words or Save Image
     * when words come with it). */
    filesOnly: apple,
  };
}

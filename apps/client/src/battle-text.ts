/**
 * Floating battle text (damage numbers, "COMBO!") made with less work per
 * label, drawn exactly as before.
 *
 * Every number is a new Phaser Text. Phaser measures its font on creation by
 * drawing a test string on a canvas and reading every pixel back
 * (getImageData), and `setResolution` afterwards drew and uploaded the
 * label's canvas a second time. A raid shows several numbers a second (every
 * hit on the boss), and on an iPhone a canvas read-back waits for the
 * graphics chip, so each one was a hitch in a busy fight.
 *
 * Here the font's measure is taken once per font (Phaser's own measure, from
 * the first label with that font) and handed to later labels, and the
 * resolution goes in with the style, so each label is drawn and uploaded
 * once. The measure only depends on the font, so the labels are the same.
 * It is taken again after a web font finishes loading, in case the first
 * one was measured on the fallback font.
 */
import type Phaser from "phaser";

/** A font's measure, as Phaser's TextStyle keeps it. */
export interface FontMetrics {
  ascent: number;
  descent: number;
  fontSize: number;
}

const measured = new Map<string, FontMetrics>();
let watching = false;
/** Forget the measures (a web font has loaded since). */
export function forgetFontMetrics() {
  measured.clear();
}
function watchFonts() {
  if (watching) return;
  watching = true;
  try {
    document.fonts?.addEventListener?.("loadingdone", forgetFontMetrics);
  } catch {
    /* No font loading API: measures are kept. */
  }
}

/** The font a style draws with: Phaser's TextStyle joins the same three. */
export function fontKey(style: Phaser.Types.GameObjects.Text.TextStyle) {
  return [style.fontStyle ?? "", style.fontSize ?? "", style.fontFamily ?? ""]
    .join(" ")
    .trim();
}

/**
 * `scene.add.text` for a floating battle label at `resolution` canvas pixels
 * per world pixel (what `.setResolution(resolution)` gave).
 */
export function addBattleText(
  scene: Phaser.Scene,
  x: number,
  y: number,
  text: string,
  style: Phaser.Types.GameObjects.Text.TextStyle,
  resolution: number,
) {
  watchFonts();
  const key = fontKey(style);
  const metrics = measured.get(key);
  const label = scene.add.text(x, y, text, {
    ...style,
    resolution,
    ...(metrics ? { metrics: { ...metrics } } : {}),
  });
  if (!metrics) {
    const m = label.getTextMetrics() as Partial<FontMetrics>;
    if (
      typeof m.ascent === "number" &&
      typeof m.descent === "number" &&
      typeof m.fontSize === "number"
    )
      measured.set(key, {
        ascent: m.ascent,
        descent: m.descent,
        fontSize: m.fontSize,
      });
  }
  return label;
}

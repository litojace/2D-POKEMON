import { lowGraphics } from "../graphics-quality";

/**
 * Lighter menus where the device needs it (ui/light-effects.css): at Low
 * graphics (chosen in Settings, or picked by Auto) the hub and its panels
 * drop blur, big soft shadows and decorative loops. High keeps the look.
 * Reduced motion stops the loops by itself (a media query in the same file).
 *
 * The page's root carries the answer, `data-ui-effects="light" | "full"`;
 * main.ts asks again when the hub changes and when Settings change.
 */
export function syncUiEffects(root = document.documentElement) {
  const value = lowGraphics() ? "light" : "full";
  if (root.dataset.uiEffects !== value) root.dataset.uiEffects = value;
}

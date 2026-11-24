/**
 * `hub-graphics-low` on <body> while the Plaza is at Low
 * graphics: the header's glass buttons then drop their blur (ui/aero.css).
 *
 * This was a `body:has(.plaza-layer[data-graphics="low"])` selector.
 * A :has() like that makes the browser re-check styles far beyond the
 * element that changed: in a battle, every cooldown tick on a skill button
 * restyled about 140 elements instead of a handful (docs/network-performance.md,
 * "Battle style recalculation"). A class costs nothing.
 */
export function syncHubGraphics(doc: Document = document) {
  doc.body?.classList.toggle(
    "hub-graphics-low",
    !!doc.querySelector('.plaza-layer[data-graphics="low"]'),
  );
}

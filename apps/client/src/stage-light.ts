/**
 * The preview windows' spotlight (owner's choice, option C, 6 Nov 2026;
 * docs/ui-remodel/spotlight/options.html): no beam, a glow in the fighter's
 * element colour behind them, and a lit floor disc with a ring under their
 * feet, like a character reveal.
 *
 * Drawn as an SVG in the fighter's own frame (the same viewBox as the still
 * fighter, which the live rig keeps in step with its camera), so the disc
 * sits under the feet at any stage size, for the still fighter and the live
 * one alike: nothing changes or flashes when the rig finishes loading. The
 * colour is the stage's `--el`. Gradients only (no blur filter), so Low
 * graphics draws the same light at no extra cost.
 */

/** Where the fighters' feet are in the art's source units (their contact
 * shadow's centre: creature-design draws it at y ≈ 171–177). */
const FEET = { x: 100, y: 172 } as const;

export function stageLight(viewBox: string, scope: string) {
  const glow = `${scope}-stage-glow`,
    disc = `${scope}-stage-disc`;
  const stop = (offset: number, opacity: number) =>
    `<stop offset="${offset}" style="stop-color:var(--el);stop-opacity:${opacity}"/>`;
  const { x, y } = FEET;
  return `<svg class="stage-light" aria-hidden="true" focusable="false" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="${glow}">${stop(0, 0.5)}${stop(0.5, 0.17)}${stop(1, 0)}</radialGradient><radialGradient id="${disc}">${stop(0, 0.5)}${stop(0.68, 0.14)}${stop(1, 0)}</radialGradient></defs><circle class="stage-light-glow" cx="${x}" cy="${y - 80}" r="112" fill="url(#${glow})"/><ellipse class="stage-light-outer" cx="${x}" cy="${y}" rx="104" ry="17" fill="none" style="stroke:var(--el)" stroke-opacity=".3" stroke-width="1" vector-effect="non-scaling-stroke"/><ellipse class="stage-light-disc" cx="${x}" cy="${y}" rx="78" ry="13" fill="url(#${disc})"/><ellipse class="stage-light-ring" cx="${x}" cy="${y}" rx="78" ry="13" fill="none" style="stroke:var(--el)" stroke-opacity=".75" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

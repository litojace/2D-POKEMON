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

/**
 * A Legendary's rays (the fitting room's stage, fitting-room.css "the stage
 * by rarity"): nine thin wedges fanning up from the feet, fading out with
 * distance. Part of this picture so they start at the feet at any stage
 * size and in any pose; hidden unless the stage says so. Still, one path.
 */
function rays(id: string) {
  const { x, y } = FEET;
  const reach = 640,
    half = (3.4 * Math.PI) / 180;
  const at = (angle: number) =>
    `${(x + reach * Math.sin(angle)).toFixed(1)} ${(y - reach * Math.cos(angle)).toFixed(1)}`;
  let d = "";
  for (let deg = -64; deg <= 64; deg += 16) {
    const a = (deg * Math.PI) / 180;
    d += `M${x} ${y}L${at(a - half)}L${at(a + half)}Z`;
  }
  return {
    def: `<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y}" r="${reach}"><stop offset="0" stop-color="#ffd978" stop-opacity="0"/><stop offset=".075" stop-color="#ffd978" stop-opacity=".3"/><stop offset=".26" stop-color="#ffd978" stop-opacity=".14"/><stop offset=".6" stop-color="#ffd978" stop-opacity=".08"/><stop offset="1" stop-color="#ffd978" stop-opacity="0"/></radialGradient>`,
    art: `<path class="stage-light-rays" visibility="hidden" d="${d}" fill="url(#${id})"/>`,
  };
}

export function stageLight(viewBox: string, scope: string) {
  const glow = `${scope}-stage-glow`,
    disc = `${scope}-stage-disc`;
  const fan = rays(`${scope}-stage-rays`);
  const stop = (offset: number, opacity: number) =>
    `<stop offset="${offset}" style="stop-color:var(--el);stop-opacity:${opacity}"/>`;
  const { x, y } = FEET;
  return `<svg class="stage-light" aria-hidden="true" focusable="false" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="${glow}">${stop(0, 0.5)}${stop(0.5, 0.17)}${stop(1, 0)}</radialGradient><radialGradient id="${disc}">${stop(0, 0.5)}${stop(0.68, 0.14)}${stop(1, 0)}</radialGradient>${fan.def}</defs>${fan.art}<circle class="stage-light-glow" cx="${x}" cy="${y - 80}" r="112" fill="url(#${glow})"/><ellipse class="stage-light-outer" cx="${x}" cy="${y}" rx="104" ry="17" fill="none" style="stroke:var(--el)" stroke-opacity=".3" stroke-width="1" vector-effect="non-scaling-stroke"/><ellipse class="stage-light-disc" cx="${x}" cy="${y}" rx="78" ry="13" fill="url(#${disc})"/><ellipse class="stage-light-ring" cx="${x}" cy="${y}" rx="78" ry="13" fill="none" style="stroke:var(--el)" stroke-opacity=".75" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

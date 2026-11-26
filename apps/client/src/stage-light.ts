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
 * A Legendary's halo (the fitting room's stage, fitting-room.css "the stage
 * by rarity"): gold light behind the fighter's head and a pool of gold at
 * their feet, the same light as a Legendary tile's backdrop (ui/components.css)
 * in the fighter's own units. Part of this picture so it sits behind the head
 * at any stage size and in any pose; hidden unless the stage says so. It
 * replaced a fan of rays (owner, 26 Nov 2026: the tiles' rays looked busy, and
 * the stage should match them). Still, inside the viewBox.
 */
function halo(id: string) {
  const { x, y } = FEET;
  const head = `${id}-head`,
    floor = `${id}-floor`;
  return {
    def: `<radialGradient id="${head}" gradientUnits="userSpaceOnUse" cx="${x}" cy="${y - 99}" r="78"><stop offset="0" stop-color="#ffe08a" stop-opacity=".55"/><stop offset=".52" stop-color="#ffbf3c" stop-opacity=".28"/><stop offset="1" stop-color="#ffbf3c" stop-opacity="0"/></radialGradient><radialGradient id="${floor}"><stop offset="0" stop-color="#ffbf3c" stop-opacity=".4"/><stop offset="1" stop-color="#ffbf3c" stop-opacity="0"/></radialGradient>`,
    art: `<g class="stage-light-halo" visibility="hidden"><circle cx="${x}" cy="${y - 99}" r="78" fill="url(#${head})"/><ellipse cx="${x}" cy="${y}" rx="90" ry="58" fill="url(#${floor})"/></g>`,
  };
}

export function stageLight(viewBox: string, scope: string) {
  const glow = `${scope}-stage-glow`,
    disc = `${scope}-stage-disc`;
  const gold = halo(`${scope}-stage-halo`);
  const stop = (offset: number, opacity: number) =>
    `<stop offset="${offset}" style="stop-color:var(--el);stop-opacity:${opacity}"/>`;
  const { x, y } = FEET;
  return `<svg class="stage-light" aria-hidden="true" focusable="false" viewBox="${viewBox}" preserveAspectRatio="xMidYMid meet"><defs><radialGradient id="${glow}">${stop(0, 0.5)}${stop(0.5, 0.17)}${stop(1, 0)}</radialGradient><radialGradient id="${disc}">${stop(0, 0.5)}${stop(0.68, 0.14)}${stop(1, 0)}</radialGradient>${gold.def}</defs><circle class="stage-light-glow" cx="${x}" cy="${y - 80}" r="112" fill="url(#${glow})"/>${gold.art}<ellipse class="stage-light-outer" cx="${x}" cy="${y}" rx="104" ry="17" fill="none" style="stroke:var(--el)" stroke-opacity=".3" stroke-width="1" vector-effect="non-scaling-stroke"/><ellipse class="stage-light-disc" cx="${x}" cy="${y}" rx="78" ry="13" fill="url(#${disc})"/><ellipse class="stage-light-ring" cx="${x}" cy="${y}" rx="78" ry="13" fill="none" style="stroke:var(--el)" stroke-opacity=".75" stroke-width="1.5" vector-effect="non-scaling-stroke"/></svg>`;
}

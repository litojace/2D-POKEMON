import { TIER_NAMES } from "../../../packages/shared/src/cosmetic-tier";
import { titleTier } from "../../../packages/shared/src/title-tier";

const esc = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
const HEX = /^#[0-9a-fA-F]{6}$/;

/**
 * A player's title as a small tag in its tier's look (title-tier.ts; the
 * same steps as over heads in the Plaza, plaza-title-art.ts): Common is the
 * title in its colour, Rare an ink plate, Epic an edged plate with a glint,
 * Legendary gold-edged with notched ends and twinkling stars, Mythical a
 * drifting ribbon. Styled in themes/poster/plaza.css (`.title-tag`).
 */
export function titleTag(title: string, color: string | null | undefined) {
  const tier = titleTier(title),
    c = color && HEX.test(color) ? color : "#ffd65b",
    star =
      tier === "legendary" || tier === "mythic"
        ? '<i aria-hidden="true">✦</i>'
        : "";
  return `<span class="title-tag" data-tier="${tier}" style="--title:${c}" title="${TIER_NAMES[tier]} title">${star}<span>${esc(title)}</span>${star}</span>`;
}

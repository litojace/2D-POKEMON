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

export interface TitleTagOptions {
  /** Take the font, size, case and spacing of where it sits (the Lobby's
   *  corner, the Profile): only the tier's paint and stars are added. */
  fit?: boolean;
  /** Never moves (where it is always on screen, or one of many). */
  still?: boolean;
}

/**
 * A player's title in its tier's look (title-tier.ts; the same steps as
 * over heads in the Plaza, plaza-title-art.ts), with no plate or frame:
 * Common is the title in its colour, Rare is shaded, Epic has a glint
 * across its letters, Legendary gold-lit letters and twinkling stars,
 * Mythical letters whose colours drift. Styled in themes/poster/plaza.css
 * (`.title-tag`); under the look underneath it is the title in its colour.
 */
export function titleTag(
  title: string,
  color: string | null | undefined,
  options: TitleTagOptions = {},
) {
  const tier = titleTier(title),
    c = color && HEX.test(color) ? color : "#ffd65b",
    star =
      tier === "legendary" || tier === "mythic"
        ? '<i aria-hidden="true">✦</i>'
        : "",
    cls = `title-tag${options.fit ? " is-fit" : ""}${options.still ? " is-still" : ""}`;
  return `<span class="${cls}" data-tier="${tier}" style="--title:${c};color:${c}" title="${TIER_NAMES[tier]} title">${star}<span>${esc(title)}</span>${star}</span>`;
}

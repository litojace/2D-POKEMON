import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  AVATAR_VIEWBOX,
  creatureSvg,
  proportioned,
  type SkinLook,
} from "./creature-design";

/** A borderless contact shadow shared by Home and full fighter previews. */
export function withSoftGround(svg: string, id: CharacterId) {
  // The old floor at y=177 predates the chibi limb proportions. Anchor the
  // contact shade to the authored paws, using the same transform as the rig.
  // Hovering fighters keep a diffuse floor beneath their airborne idle.
  const hovering = ["auralynx", "lumoth", "mystowl", "duskveil"].includes(id);
  const pawY = id === "terradon" ? 172 : id === "cindrake" ? 172 : 171;
  const pawX = id === "terradon" ? 65 : id === "cindrake" ? 78 : 80;
  const [left, feet] = proportioned("legL", pawX, pawY);
  const ground = hovering ? 177 : feet;
  const contact = hovering
    ? ""
    : [left, 200 - left]
        .map(
          (x) =>
            `<ellipse cx="${x}" cy="${feet}" rx="12" ry="3" fill="url(#home-contact)"/>`,
        )
        .join("");
  return svg
    .replace(
      "</defs>",
      '<radialGradient id="home-contact"><stop stop-color="#020612" stop-opacity=".65"/><stop offset=".45" stop-color="#020612" stop-opacity=".4"/><stop offset="1" stop-color="#020612" stop-opacity="0"/></radialGradient><radialGradient id="home-floor-light"><stop stop-color="var(--element)" stop-opacity=".2"/><stop offset="1" stop-color="var(--element)" stop-opacity="0"/></radialGradient></defs>',
    )
    .replace(
      /<ellipse class="fighter-shadow"[^>]*\/>/,
      `<g class="home-contact-shadow" stroke="none"><ellipse cx="100" cy="${ground + 1}" rx="62" ry="11" fill="url(#home-floor-light)"/><ellipse class="fighter-shadow" cx="100" cy="${ground}" rx="42" ry="${hovering ? 9 : 6}" fill="url(#home-contact)"/>${contact}</g>`,
    );
}
/**
 * Give an inline SVG's ids (gradients, filters) a placement-specific suffix.
 *
 * Every copy of a fighter shares ids like "cindrake-down-body". When the first
 * copy in the page sits in a hidden screen (display: none), browsers resolve
 * url(#…) to it and paint nothing, so the visible copy loses its fills and
 * looks see-through. The suffix is stable so re-renders compare equal.
 */
export function scopeIds(svg: string, scope: string) {
  const ids = new Set([...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  if (!ids.size) return svg;
  return svg
    .replace(
      /(\sid=")([^"]+)"/g,
      (_, a: string, id: string) => `${a}${id}-${scope}"`,
    )
    .replace(/url\(#([^)]+)\)/g, (all, id: string) =>
      ids.has(id) ? `url(#${id}-${scope})` : all,
    )
    .replace(/(href=")#([^"]+)"/g, (all, a: string, id: string) =>
      ids.has(id) ? `${a}#${id}-${scope}"` : all,
    );
}
export function fighterArt(
  id: CharacterId,
  viewBox?: string,
  look?: SkinLook | null,
) {
  return creatureSvg(id, "down", undefined, viewBox, "normal", look).replace(
    "<svg ",
    `<svg role="img" data-fighter="${id}" aria-label="${CHARACTERS[id].name}" `,
  );
}
/** Centred head-and-shoulders portrait for avatars. */
export function fighterAvatar(
  id: CharacterId,
  scope = "avatar",
  look?: SkinLook | null,
) {
  return scopeIds(fighterArt(id, AVATAR_VIEWBOX, look), scope);
}
export function fighterTextureData(id: CharacterId) {
  return "data:image/svg+xml;base64," + btoa(fighterArt(id));
}

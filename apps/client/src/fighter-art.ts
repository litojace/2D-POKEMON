import { CHARACTERS, type CharacterId } from "@arena/shared";
import { AVATAR_VIEWBOX, creatureSvg } from "./creature-design";
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
export function fighterArt(id: CharacterId, viewBox?: string) {
  return creatureSvg(id, "down", undefined, viewBox).replace(
    "<svg ",
    `<svg role="img" aria-label="${CHARACTERS[id].name}" `,
  );
}
/** Centred head-and-shoulders portrait for avatars. */
export function fighterAvatar(id: CharacterId, scope = "avatar") {
  return scopeIds(fighterArt(id, AVATAR_VIEWBOX), scope);
}
export function fighterTextureData(id: CharacterId) {
  return "data:image/svg+xml;base64," + btoa(fighterArt(id));
}

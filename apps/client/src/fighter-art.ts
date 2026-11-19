import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  AVATAR_VIEWBOX,
  HOVERING,
  creatureSvg,
  proportioned,
  type SkinLook,
} from "./creature-design";

/** A borderless contact shadow shared by Home and full fighter previews. */
/** The menu art's contact shadow (SVG art units), for anything on its plane. */
export function menuShadow(id: CharacterId) {
  const hovering = HOVERING.includes(id);
  const pawY = id === "terradon" ? 172 : id === "cindrake" ? 172 : 171;
  const pawX = id === "terradon" ? 65 : id === "cindrake" ? 78 : 80;
  const feet = proportioned("legL", pawX, pawY)[1];
  return { cx: 100, cy: hovering ? 177 : feet, rx: 32, ry: hovering ? 7 : 4.5 };
}
export function withSoftGround(svg: string, id: CharacterId) {
  // The old floor at y=177 predates the chibi limb proportions. Anchor the
  // contact shade to the authored paws, using the same transform as the rig.
  // Hovering fighters keep a diffuse floor beneath their airborne idle.
  const hovering = HOVERING.includes(id);
  const pawY = id === "terradon" ? 172 : id === "cindrake" ? 172 : 171;
  const pawX = id === "terradon" ? 65 : id === "cindrake" ? 78 : 80;
  const [left, feet] = proportioned("legL", pawX, pawY);
  const shadow = menuShadow(id),
    ground = shadow.cy;
  const contact = hovering
    ? ""
    : [left, 200 - left]
        .map(
          (x) =>
            `<ellipse cx="${x}" cy="${feet}" rx="9" ry="2.4" fill="url(#home-contact)"/>`,
        )
        .join("");
  return svg
    .replace(
      "</defs>",
      '<radialGradient id="home-contact"><stop stop-color="#020612" stop-opacity=".65"/><stop offset=".45" stop-color="#020612" stop-opacity=".4"/><stop offset="1" stop-color="#020612" stop-opacity="0"/></radialGradient></defs>',
    )
    .replace(
      /<ellipse class="fighter-shadow"[^>]*\/>/,
      `<g class="home-contact-shadow" stroke="none"><ellipse class="fighter-shadow" cx="${shadow.cx}" cy="${ground}" rx="${shadow.rx}" ry="${shadow.ry}" fill="url(#home-contact)"/>${contact}</g>`,
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
  /** Without masked overlays (see creatureLayers). */
  flat = false,
) {
  return creatureSvg(
    id,
    "down",
    undefined,
    viewBox,
    "normal",
    look,
    flat,
  ).replace(
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
const pictures = new Map<string, string>();
/**
 * A portrait as one picture (`<img>`) instead of inline SVG, for screens
 * that show many: the Spire's floors list 150 portraits, about 42,000 SVG
 * elements inline, and opening that tab took seconds on a phone (every
 * element styled and laid out). Like a game's icon sprite, each portrait
 * (`key`) is drawn once from `svg()` and every copy shows that drawing.
 * Where pictures can't be made from memory (tests outside a browser), the
 * inline SVG.
 */
export function svgPicture(
  key: string,
  svg: () => string,
  id: CharacterId,
  inline: () => string = svg,
) {
  if (typeof Blob === "undefined" || typeof URL.createObjectURL !== "function")
    return inline();
  let url = pictures.get(key);
  if (!url) {
    url = URL.createObjectURL(new Blob([svg()], { type: "image/svg+xml" }));
    pictures.set(key, url);
  }
  return `<img class="fighter-portrait" src="${url}" alt="${CHARACTERS[id].name}" data-fighter="${id}" draggable="false" decoding="async">`;
}
/**
 * Like svgPicture, but keeping the art's own `<svg>` box (its viewBox, so it
 * lays out exactly as the inline art does), emptied, with the picture as its
 * background. For art whose box CSS sizes as inline SVG.
 */
export function svgBackdrop(
  key: string,
  svg: () => string,
  id: CharacterId,
  inline: () => string = svg,
) {
  if (typeof Blob === "undefined" || typeof URL.createObjectURL !== "function")
    return inline();
  let kept = backdrops.get(key);
  if (!kept) {
    const markup = svg();
    kept = {
      url: URL.createObjectURL(new Blob([markup], { type: "image/svg+xml" })),
      viewBox:
        markup.match(/<svg [^>]*viewBox="([^"]*)"/)?.[1] ?? "0 0 200 200",
    };
    backdrops.set(key, kept);
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${kept.viewBox}" role="img" data-fighter="${id}" aria-label="${CHARACTERS[id].name}" style="background:url(${kept.url}) 50% 50% / contain no-repeat"></svg>`;
}
const backdrops = new Map<string, { url: string; viewBox: string }>();
/** fighterAvatar's portrait as a picture (svgPicture). */
export function fighterPortrait(id: CharacterId, look?: SkinLook | null) {
  return svgPicture(
    look ? `${id} ${JSON.stringify(look)}` : id,
    () => fighterArt(id, AVATAR_VIEWBOX, look),
    id,
    () => fighterAvatar(id, `portrait-${id}`, look),
  );
}
export function fighterTextureData(id: CharacterId) {
  return "data:image/svg+xml;base64," + btoa(fighterArt(id));
}

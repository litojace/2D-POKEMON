import { TONES, type Skin } from "./animation/cosmetics";

/** Use the battle rig's palette for static Shop art, rather than a hue filter.
 * Filter individual parts so the eyes stay untouched, just like cosmeticLayer.
 * sRGB and the same luminance weights keep the thumbnail and canvas in sync. */
export function colourPreview(svg: string, id: string) {
  const spec = TONES[id as Skin];
  if (!spec) return svg;
  const filter = `preview-palette-${id}`;
  const channels = [16, 8, 0].map((shift) =>
    spec.tones.map((c) => ((c >> shift) & 255) / 255).join(" "),
  );
  const shader = `<filter id="${filter}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values=".299 .587 .114 0 0 .299 .587 .114 0 0 .299 .587 .114 0 0 0 0 0 1 0"/><feComponentTransfer>${channels.map((table, i) => `<feFunc${["R", "G", "B"][i]} type="table" tableValues="${table}"/>`).join("")}</feComponentTransfer><feComposite in2="SourceGraphic" operator="arithmetic" k1="0" k2="${1 - spec.keep}" k3="${spec.keep}" k4="0"/></filter>`;
  return svg
    .replace("</defs>", `${shader}</defs>`)
    .replace(
      /<g class="fighter-(tail|wings|legL|legR|torso|armL|armR|head|ears|flame|scarf)"/g,
      `$& filter="url(#${filter})"`,
    );
}
export const hasColourPalette = (id: string) => !!TONES[id as Skin];

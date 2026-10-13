import { CHARACTERS, type CharacterId } from "@arena/shared";
import { AVATAR_VIEWBOX, creatureSvg } from "./creature-design";
export function fighterArt(id: CharacterId, viewBox?: string) {
  return creatureSvg(id, "down", undefined, viewBox).replace(
    "<svg ",
    `<svg role="img" aria-label="${CHARACTERS[id].name}" `,
  );
}
/** Centred head-and-shoulders portrait for avatars. */
export function fighterAvatar(id: CharacterId) {
  return fighterArt(id, AVATAR_VIEWBOX);
}
export function fighterTextureData(id: CharacterId) {
  return "data:image/svg+xml;base64," + btoa(fighterArt(id));
}

import { CHARACTERS, type CharacterId } from "@arena/shared";
import { creatureSvg } from "./creature-design";
export function fighterArt(id: CharacterId) {
  return creatureSvg(id).replace(
    "<svg ",
    `<svg role="img" aria-label="${CHARACTERS[id].name}" `,
  );
}
export function fighterTextureData(id: CharacterId) {
  return "data:image/svg+xml;base64," + btoa(fighterArt(id));
}

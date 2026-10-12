import type { CharacterId } from "@arena/shared";
import { fighterPackSchema, type FighterPack } from "./asset-schema";
const manifests = import.meta.glob(
  "../../public/assets/fighters/*/animations.json",
  { eager: true, import: "default" },
);
export function fighterPack(id: CharacterId): FighterPack | undefined {
  const raw = manifests[`../../public/assets/fighters/${id}/animations.json`];
  return raw ? fighterPackSchema.parse(raw) : undefined;
}

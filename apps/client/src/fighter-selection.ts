/**
 * Fighter art and records shared by the Lobby stage and the roster (the
 * game's one fighter picker since UI remodel step 5: the rooms use the
 * roster too). The old room picker that lived here is gone.
 */
import { fighterPack } from "./animation/pack-config";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { fighterArt, scopeIds, withSoftGround } from "./fighter-art";
import { CREATURE_VIEWBOX } from "./creature-design";
import { colourPreview } from "./colour-preview";
import { lookOn, type RaidLoadout } from "../../../packages/shared/src/raid";
/** Your equipped Shop skins, shown on the roster cards and detail art. */
let worn: Partial<Record<CharacterId, { skin: string; stage: number }>> = {};
export function setWornSkins(value: typeof worn | undefined) {
  worn = value ?? {};
}
/** The Shop skin a fighter wears (and its awakening stage), if any. */
export const wornSkin = (id: CharacterId) => worn[id];
/** Your equipped shared looks (Colors, aura...), worn by every fighter. */
let wornLook: RaidLoadout = {};
export function setWornLook(value: RaidLoadout | undefined) {
  wornLook = value ?? {};
}
/** Keep Terradon's eye line aligned while giving its earless head the same
 * visual presence as the other portraits. The sprout remains inside frame. */
const rosterPortraitFrame = (id?: string) =>
  id === "terradon" ? "30 3 140 140" : "22 -8 156 156";
type WornSkin = { skin: string; stage: number } | null | undefined;
function art(
  id: CharacterId,
  large = false,
  scopeName?: string,
  skin: WornSkin = worn[id],
  look: RaidLoadout = wornLook,
) {
  const pack = fighterPack(id);
  if (pack && pack.kind !== "layered")
    return `<img class="creature-portrait" loading="lazy" decoding="async" src="/assets/fighters/${id}/${large ? pack.selection : pack.portrait}" alt="${CHARACTERS[id].name}">`;
  // Card and detail portrait of the same fighter need their own ids.
  const svg = fighterArt(id, large ? undefined : rosterPortraitFrame(id), skin);
  const framed = large ? withSoftGround(svg, id) : svg;
  const scope = scopeName ?? (large ? "detail" : "card");
  // As the Wardrobe shows it: the fighter skin, else its Colors (its own,
  // else the shared ones). No element aura: the Shop, Wardrobe and battle
  // rigs don't wear one either.
  const colours = lookOn(look, id).skin;
  const palette = !skin && colours ? colours : "";
  return scopeIds(palette ? colourPreview(framed, palette) : framed, scope);
}
/**
 * The padded frame the large fighter art is shown in wherever the live rig
 * lies over it (the roster's detail, the Lobby stage): the rig's selection
 * framing (SELECTION_PREVIEW) draws in exactly this frame.
 */
export const RIG_FRAME = "-20 -40 240 250";
/** The large fighter art with its worn skin and Colors, for a stage (the
 * Lobby's, the roster's). Each stage needs its own `scope` for its ids.
 * `skin` and `look`: another player's (a party member's); null for none. */
export function fighterStageArt(
  id: CharacterId,
  scope = "lobby",
  skin: WornSkin = worn[id],
  look: RaidLoadout = wornLook,
) {
  return art(id, true, scope, skin, look)
    .split(`viewBox="${CREATURE_VIEWBOX}"`)
    .join(`viewBox="${RIG_FRAME}"`);
}
/** The live rig's `data-preview-look`: the equipped shared looks. */
export const previewLook = (look: RaidLoadout = wornLook) =>
  encodeURIComponent(JSON.stringify(look ?? {}));
/** Long range when the basic attack reaches across the arena, else close range. */
export function attackRange(id: CharacterId): "long" | "close" {
  return CHARACTERS[id].basic.range >= 400 ? "long" : "close";
}
/** Your matches per fighter (from your records), for mastery badges. */
let mastery: Record<string, { matches: number; wins: number }> = {};
export function setMastery(
  value: Record<string, { matches: number; wins: number }>,
) {
  mastery = value;
}
/** Matches you've played with a fighter (0 until your records load). */
export function masteryMatches(id: CharacterId) {
  return mastery[id]?.matches ?? 0;
}

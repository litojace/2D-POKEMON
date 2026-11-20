// Art for costume-fit.spec.ts: every costume skin's rig crops (as play draws
// them) beside the champion's default ones, and its whole drawing beside the
// default one with the default eyes alone, to measure what covers the eyes.
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { rigAssets } from "../../../apps/client/src/animation/assets";
import { creatureSvgRenderer } from "../../../apps/client/src/creature-design";
import { SKIN_ART } from "../../../apps/client/src/skins/skin-art";
import { profilePartOrder } from "../../../apps/client/src/creature-profile";
import type { CreaturePart } from "../../../apps/client/src/creature-design";
import type { Facing } from "../../../apps/client/src/animation/controller";

const DIRS: Facing[] = ["down", "left", "right", "up"];
/** Skins that dress the champion in a costume reaching past its outline. */
export const costumeSkins = () =>
  Object.entries(SKIN_ART)
    .filter(([, art]) =>
      (art.accessories ?? []).some((a) =>
        /^(modern-|vanguard$|sky-pirates$)/.test(a),
      ),
    )
    .map(([key]) => key);
const championOf = (skin: string) =>
  (Object.keys(CHARACTERS) as CharacterId[]).find((id) =>
    skin.startsWith(`${id}-`),
  )!;

const PARTS =
  /-(body|armL|armR|scarf|flame|hat|head|legL|legR|wings|tail)(~[^~]*)?$/;
/** Each crop play draws, default and costume, as images to check. */
export function cropArt(skins = costumeSkins()) {
  const out: { key: string; url: string; skin: string | null }[] = [];
  const take = (skin: string | null, list: ReturnType<typeof rigAssets>) => {
    for (const a of list)
      if (!a.key.includes("~lume") && PARTS.test(a.key))
        out.push({ key: a.key, url: a.url, skin });
  };
  const champions = new Set(skins.map(championOf));
  for (const id of champions) take(null, rigAssets(id, null, DIRS));
  for (const skin of skins)
    take(skin, rigAssets(championOf(skin), { skin, stage: 1 }, DIRS));
  return out;
}

/**
 * For each costume skin and view: the default eyes alone, and the parts
 * drawn over the eyes (the head-top piece and the scarf from the front;
 * whatever follows the eyes in a profile's order), default and costume,
 * each as its own picture on the same canvas.
 */
export function eyeArt(skins = costumeSkins()) {
  return skins.flatMap((skin) => {
    const id = championOf(skin);
    return (["down", "left", "right"] as Facing[]).map((dir) => {
      const base = creatureSvgRenderer(id, dir, "normal", null);
      const worn = creatureSvgRenderer(id, dir, "normal", { skin, stage: 1 });
      const viewBox = base().match(/viewBox="([^"]+)"/)![1];
      const order = dir === "down" ? [] : profilePartOrder(dir, id);
      const over: CreaturePart[] =
        dir === "down"
          ? ["flame", "hat", "scarf"]
          : [...new Set([...order.slice(order.indexOf("eyes") + 1), "hat", "scarf"])] as CreaturePart[];
      return {
        skin,
        dir,
        eyes: base("eyes", viewBox),
        baseOver: over.map((p) => base(p, viewBox)),
        wornOver: over.map((p) => worn(p, viewBox)),
      };
    });
  });
}

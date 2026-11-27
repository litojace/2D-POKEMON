/**
 * The startup curtain as it ships, held still to look at
 * (loading-preview.html): ?p=<0-1> fills the bar, ?f=<fighter>&skin=<skin
 * id>&stage=<1-3> picks who runs on it, ?art=<scene id> puts a painting
 * behind it. A review page, not part of the game. ?v=refs draws the
 * painting brief's skins for reference pictures
 * (scripts/loading-art/export-references.mjs); ?v=roster every champion.
 * (The styles this page once offered to choose from, tips beside a fighter
 * and so on, went with the tips, 27 Nov 2026.)
 */
import "./ui/tokens.css";
import "./style.css";
import "./server-connection.css";
import "./loading-preview.css";
import { CHARACTERS, type CharacterId } from "@arena/shared";
import { fighterStageArt } from "./fighter-selection";
import { LOADING_ART, LOADING_SCENES } from "./loading-art";
import { CHAMPION_SKINS } from "../../../packages/shared/src/shop";
import {
  curtainStep,
  holdStartupCurtain,
  setCurtainArt,
  setCurtainRunner,
} from "./server-connection";

const query = new URLSearchParams(location.search);
const style = query.get("v") ?? "a";
const fighter = (
  Object.hasOwn(CHARACTERS, query.get("f") ?? "") ? query.get("f") : "voltkit"
) as CharacterId;
const skin = query.get("skin");
const progress = Number(query.get("p") ?? 0.62);
const styles: Record<string, string> = {};

// refs: every skin the painting brief uses, one per box, for
// scripts/loading-art/export-references.mjs to save as reference pictures.
if (style === "refs") {
  const skins = new Map<string, CharacterId>();
  for (const scene of LOADING_SCENES)
    for (const f of scene.fighters) skins.set(f.skin, f.champion);
  styles.refs = `<div class="lp-refs">${[...skins]
    .map(
      ([id, champion]) =>
        `<figure data-ref="${id}">${fighterStageArt(champion, `ref-${id}`, { skin: id, stage: 1 })}</figure>`,
    )
    .join("")}</div>`;
}
// roster: every champion in its default look, to tell who is in a painting;
// &c=<champion>,... instead shows those champions' Legendary and Mythical
// Shop skins (to tell which skin a painting shows).
if (style === "roster") {
  const only = query.get("c")?.split(",");
  const looks: [CharacterId, string | undefined][] = only
    ? CHAMPION_SKINS.filter(
        (s) =>
          only.includes(s.champion) &&
          (s.rarity === "legendary" || s.rarity === "mythical"),
      ).map((s) => [s.champion as CharacterId, s.id])
    : (Object.keys(CHARACTERS) as CharacterId[]).map((id) => [id, undefined]);
  styles.roster = `<div class="lp-refs">${looks
    .map(
      ([id, skin]) =>
        `<figure data-ref="${skin ?? id}">${fighterStageArt(id, `roster-${skin ?? id}`, skin ? { skin, stage: 1 } : undefined)}<figcaption>${skin ?? id}</figcaption></figure>`,
    )
    .join("")}</div>`;
}
if (styles[style])
  document.querySelector("#loading-preview")!.innerHTML = styles[style];
else {
  holdStartupCurtain();
  setCurtainArt(LOADING_ART.find((a) => a.id === query.get("art")) ?? null);
  setCurtainRunner(
    fighter,
    skin ? { skin, stage: Number(query.get("stage") ?? 1) } : null,
  );
  curtainStep(progress, "Loading your profile…");
}

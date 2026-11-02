import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  CHAMPION_SKINS,
  CHAMPION_SKIN_BY_ID,
  LOOK_ITEMS,
  LOOK_ITEM_BY_ID,
  type Economy,
} from "../../../packages/shared/src/shop";
import { tierChip } from "./tier-chip";
import {
  cosmeticTier,
  TIER_NAMES,
} from "../../../packages/shared/src/cosmetic-tier";
import { cosmeticPicture } from "./cosmetic-picture";
import {
  FRAME_MAX_STARS,
  FRAME_STAR_CLEARS,
  RAID_BOSSES,
  bossClears,
  frameStars,
  rewardBoss,
  RAID_COSMETICS,
  RAID_REWARDS,
  type RaidProgress,
  type RaidLoadout,
  type RaidSlot,
} from "../../../packages/shared/src/raid";
import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey";
import { fighterArt, fighterAvatar, scopeIds } from "./fighter-art";
import { colourPreview, hasColourPalette } from "./colour-preview";
import { itemPicture } from "./shop-ui";
import { previewViewBox } from "./shop-preview-layout";
import { iconLabel, menuIcon } from "./menu-icons";

export type WardrobeSlot = "champion" | RaidSlot;
export const WARDROBE_SLOTS: [WardrobeSlot, string][] = [
  ["champion", "Champion skin"],
  ["skin", "Colors"],
  ["aura", "Aura"],
  ["entrance", "Entrance"],
  ["victory", "Victory"],
  ["frame", "Portrait frame"],
];
export interface WardrobeView {
  champion: CharacterId;
  slot: WardrobeSlot | "all";
  preview?: string;
  action: "idle" | "entrance" | "victory";
  effects?: boolean;
  /** Local try-on only; equipment always uses saved boss clears. */
  frameStars?: number;
}
export interface WardrobeItem {
  id: string;
  name: string;
  description: string;
  slot: WardrobeSlot;
  source: string;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function wardrobeItem(id: string): WardrobeItem | undefined {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin)
    return { ...skin, slot: "champion", source: "Shop · Champion skin" };
  const piece = LOOK_ITEM_BY_ID[id];
  if (piece) return { ...piece, source: "Shop · Collection" };
  const raid = RAID_COSMETICS[id as keyof typeof RAID_COSMETICS];
  if (raid)
    return {
      ...raid,
      id,
      source: raid.boss
        ? `Boss reward · ${RAID_BOSSES[raid.boss].name}`
        : "Boss reward",
    };
  const journey = JOURNEY_ITEM_BY_ID[id];
  if (journey) return { ...journey, source: "Journey reward" };
}
/** The inventory is earned items only; server ownership remains authoritative. */
export function wardrobeOwned(
  e: Economy,
  p: RaidProgress | null,
  champion: CharacterId,
) {
  const earned = new Set([...(p?.cosmetics ?? []), ...(p?.earned ?? [])]);
  const ids = [
    ...CHAMPION_SKINS.filter(
      (i) => i.champion === champion && e.owned.includes(i.id),
    ).map((i) => i.id),
    ...LOOK_ITEMS.filter((i) => e.owned.includes(i.id)).map((i) => i.id),
    ...RAID_REWARDS.filter((i) => i.slot !== "title" && earned.has(i.id)).map(
      (i) => i.id,
    ),
  ];
  return [...new Set(ids)].map((id) => wardrobeItem(id)!).filter(Boolean);
}
export const wardrobeWorn = (
  slot: WardrobeSlot,
  champion: CharacterId,
  e: Economy,
  look: RaidLoadout,
) =>
  slot === "champion"
    ? (e.looks[champion]?.skin ?? null)
    : (look[slot] ?? null);

/** Preview a complete outfit without changing anything the player has equipped. */
export function wardrobeOutfit(
  view: WardrobeView,
  e: Economy,
  look: RaidLoadout,
) {
  let skin = e.looks[view.champion] ?? null;
  const outfit = { ...look };
  const item = view.preview ? wardrobeItem(view.preview) : undefined;
  if (view.preview === "original") skin = null;
  else if (item?.slot === "champion")
    skin = {
      skin: item.id,
      stage:
        e.looks[view.champion]?.skin === item.id
          ? e.looks[view.champion]!.stage
          : (e.awakening[item.id]?.stage ?? 1),
    };
  else if (item) outfit[item.slot] = item.id;
  return { skin, look: outfit };
}
export function wardrobePreviewParts(
  view: WardrobeView,
  e: Economy,
  p: RaidProgress | null,
  loadout: RaidLoadout,
) {
  const owned = wardrobeOwned(e, p, view.champion);
  const selected = owned.find((i) => i.id === view.preview);
  const outfit = wardrobeOutfit(view, e, loadout);
  const skinned = !!outfit.skin;
  const palette = !skinned ? (outfit.look.skin ?? "") : "";
  const current = selected
    ? wardrobeWorn(selected.slot, view.champion, e, loadout) === selected.id
    : false;
  const original = view.preview === "original";
  const trying =
    (!!selected && !current) || (original && !!e.looks[view.champion]);
  const action = selected
    ? `<button type="button" class="${current ? "secondary" : "primary btn-primary"}" data-wardrobe-save="${selected.id}" data-wardrobe-remove="${current}">${iconLabel(current ? "cancel" : "check", current ? "Take off" : "Equip")}</button>`
    : original && e.looks[view.champion]
      ? `<button type="button" class="primary btn-primary" data-wardrobe-clear="champion">${iconLabel("check", "Use original skin")}</button>`
      : '<span class="wardrobe-equipped-label">Your equipped outfit</span>';
  const frame = outfit.look.frame;
  const earnedStars = frameStars(frame, bossClears(p));
  const frameOnly = selected?.slot === "frame";
  if (frameOnly) {
    const boss = rewardBoss(selected.id);
    const stars = boss
      ? Math.max(
          0,
          Math.min(FRAME_MAX_STARS, Math.trunc(view.frameStars ?? earnedStars)),
        )
      : 0;
    const tier = cosmeticTier(selected.id, stars);
    const clears = boss ? (bossClears(p)[boss] ?? 0) : 0;
    const levels = boss
      ? `<div class="wardrobe-frame-levels" role="group" aria-label="Preview frame stars">${Array.from({ length: FRAME_MAX_STARS + 1 }, (_, level) => `<button type="button" data-wardrobe-frame-stars="${level}" data-locked="${level > earnedStars}" aria-pressed="${level === stars}" aria-label="Preview ${level} stars · ${TIER_NAMES[cosmeticTier(selected.id, level)]}${level === earnedStars ? " · Current level" : level > earnedStars ? " · Not yet earned" : ""}"><b>${level}★</b><small>${level ? `${level * FRAME_STAR_CLEARS} wins` : "Base"}</small></button>`).join("")}</div>`
      : "";
    return {
      stage: `<section class="shop-preview wardrobe-preview" aria-label="Frame preview"><div class="shop-live-stage is-item is-frame wardrobe-frame-stage" data-preview-champion="${view.champion}" data-preview-item="${selected.id}" data-preview-action="idle" role="img" aria-label="${escape(selected.name)} · ${boss ? `${stars} stars · ` : ""}${TIER_NAMES[tier]}"><div class="shop-preview-fallback">${cosmeticPicture(selected.id, view.champion, "wardrobe-frame-level", stars)}</div></div></section>`,
      animations: `<div class="wardrobe-preview-actions is-frame-preview"><div class="wardrobe-frame-heading"><b>${boss ? "Frame evolution" : "Portrait frame"}</b>${tierChip(selected.id, stars)}</div>${levels}${boss ? `<p class="wardrobe-frame-summary" role="status"><b>Viewing ${stars}★</b> · Your level: ${earnedStars}★<br>${stars > earnedStars ? `Unlock at ${stars * FRAME_STAR_CLEARS} wins against ${RAID_BOSSES[boss].name}.` : earnedStars === FRAME_MAX_STARS ? "Maximum level earned." : `${clears}/${(earnedStars + 1) * FRAME_STAR_CLEARS} wins toward your next star.`}</p><p class="wardrobe-frame-preview-note">Preview only · Effects evolve at 3★ and 5★. Equipping uses your earned level.</p>` : ""}</div>`,
      footer: `<footer class="wardrobe-footer" data-selection="true"><div class="wardrobe-selection"><small>${boss && stars !== earnedStars ? `PREVIEWING ${stars}★ · YOUR FRAME IS ${earnedStars}★` : trying ? "TRYING ON · NOT SAVED" : "EQUIPPED FRAME"}</small><b>${escape(selected.name)}</b><p>${escape(selected.description)}</p></div><p class="wardrobe-status" role="status"></p><div class="wardrobe-save">${action}</div></footer>`,
    };
  }
  const fallback = scopeIds(
    colourPreview(
      fighterArt(view.champion, previewViewBox(view.action), outfit.skin),
      palette,
    ),
    "wardrobe-preview",
  );
  const portrait = frame
    ? `<span class="raid-cosmetic-preview wardrobe-frame" data-cosmetic="${frame}" data-frame-stars="${earnedStars}" aria-label="${escape(wardrobeItem(frame)?.name ?? "Equipped portrait frame")}"><span class="portrait-disc">${scopeIds(colourPreview(fighterAvatar(view.champion, "wardrobe-frame", outfit.skin), palette), "wardrobe-avatar-colors")}</span></span>`
    : "";
  return {
    stage: `<section class="shop-preview wardrobe-preview" aria-label="Complete outfit preview"><div class="shop-live-stage" data-preview-champion="${view.champion}" data-preview-item="${outfit.skin?.skin ?? ""}" data-preview-stage="${outfit.skin?.stage ?? 1}" data-preview-action="${view.action}" data-preview-look="${encodeURIComponent(JSON.stringify(outfit.look))}" role="img" aria-label="${CHARACTERS[view.champion].name} ${trying ? "try-on" : "equipped outfit"}"><div class="shop-preview-fallback${palette ? ` raid-cosmetic-preview${hasColourPalette(palette) ? " is-colour-matched" : ""}` : ""}" data-cosmetic="${palette}">${fallback}</div></div></section>`,
    animations: `<div class="wardrobe-preview-actions${view.effects ? " is-open" : ""}"><button type="button" class="wardrobe-effects-toggle" data-wardrobe-effects aria-label="Preview outfit animations" aria-expanded="${!!view.effects}">${menuIcon("sparkle")}</button><div class="wardrobe-animation-buttons" role="group" aria-label="Preview outfit animations"><button type="button" class="secondary" data-wardrobe-action="entrance" aria-label="Preview entrance" title="Preview entrance" aria-pressed="${view.action === "entrance"}">${iconLabel("enter", "Entrance")}</button><button type="button" class="secondary" data-wardrobe-action="victory" aria-label="Preview victory" title="Preview victory" aria-pressed="${view.action === "victory"}">${iconLabel("sparkle", "Victory")}</button><button type="button" class="secondary" data-wardrobe-action="idle" aria-pressed="${view.action === "idle"}">Idle</button></div>${portrait}</div>`,
    footer: `<footer class="wardrobe-footer" data-selection="${!!selected || !!(original && e.looks[view.champion])}"><div class="wardrobe-selection"><small>${trying ? "TRYING ON · NOT SAVED" : "EQUIPPED OUTFIT"}</small><b>${escape(selected?.name ?? (original ? "Original skin" : CHARACTERS[view.champion].name))}</b><p>${escape(selected?.description ?? "Browse your collection to preview a change.")}${selected?.slot === "skin" && skinned ? " Your champion skin covers these colors; take it off to reveal them." : ""}</p></div><p class="wardrobe-status" role="status"></p><div class="wardrobe-save">${action}</div></footer>`,
  };
}
/** Boss frames: stars earned and the clears for the next one. */
export function frameStarNote(id: string, p: RaidProgress | null) {
  const boss = rewardBoss(id);
  if (
    !boss ||
    RAID_COSMETICS[id as keyof typeof RAID_COSMETICS]?.slot !== "frame"
  )
    return "";
  const clears = bossClears(p)[boss] ?? 0,
    stars = frameStars(id, bossClears(p));
  return `<small class="wardrobe-frame-stars${stars >= FRAME_MAX_STARS ? " is-legendary" : ""}">${"★".repeat(stars)}${"☆".repeat(FRAME_MAX_STARS - stars)} ${stars >= FRAME_MAX_STARS ? TIER_NAMES[cosmeticTier(id, stars)] : `${clears}/${(stars + 1) * FRAME_STAR_CLEARS} clears`}</small>`;
}
export function wardrobeMarkup(
  view: WardrobeView,
  e: Economy,
  p: RaidProgress | null,
  loadout: RaidLoadout,
  problem = "",
) {
  const owned = wardrobeOwned(e, p, view.champion);
  const items = owned.filter(
    (i) => view.slot === "all" || i.slot === view.slot,
  );
  const parts = wardrobePreviewParts(view, e, p, loadout);
  const original = view.preview === "original";
  const cards = items
    .map((i) => {
      const worn = wardrobeWorn(i.slot, view.champion, e, loadout) === i.id;
      return `<button type="button" class="wardrobe-item${view.preview === i.id ? " is-selected" : ""}" data-wardrobe-preview="${i.id}" aria-pressed="${view.preview === i.id}"><span class="wardrobe-item-art">${itemPicture(i.id, view.champion, `wardrobe-${i.id}`, e.looks[view.champion]?.skin === i.id ? e.looks[view.champion]!.stage : (e.awakening[i.id]?.stage ?? 1), frameStars(i.id, bossClears(p)))}</span><span class="wardrobe-item-copy"><b>${escape(i.name)}</b>${i.slot === "champion" ? "" : tierChip(i.id, frameStars(i.id, bossClears(p)))}<small>${escape(i.source)}</small>${frameStarNote(i.id, p)}<span class="wardrobe-item-state${worn ? " is-equipped-text" : ""}">${worn ? `${menuIcon("check")}Equipped` : WARDROBE_SLOTS.find(([s]) => s === i.slot)![1]}</span></span></button>`;
    })
    .join("");
  const wearing = WARDROBE_SLOTS.map(([slot, label]) => {
    const id = wardrobeWorn(slot, view.champion, e, loadout);
    const info = id ? wardrobeItem(id) : undefined;
    const covered = slot === "skin" && id && e.looks[view.champion];
    return `<div class="wardrobe-worn-row"><button type="button" data-wardrobe-slot="${slot}" aria-label="Browse ${label}"><span>${label}</span><b>${escape(info?.name ?? (slot === "champion" ? "Original skin" : "None"))}</b>${covered ? "<small>Covered by champion skin</small>" : ""}</button>${id ? `<button type="button" class="wardrobe-clear" data-wardrobe-clear="${slot}" aria-label="Take off ${escape(info?.name ?? label)}">${menuIcon("cancel")}</button>` : ""}</div>`;
  }).join("");
  return `<section class="wardrobe"><header class="wardrobe-heading"><span class="eyebrow">YOUR COLLECTION</span><h2>${iconLabel("wardrobe", "Wardrobe")}</h2><p>Champion skins for each fighter. Colors and effects shared across your roster.</p></header>
  <div class="wardrobe-layout"><aside class="wardrobe-showcase"><div class="wardrobe-fighter-picker"><label for="wardrobe-champion">Fighter</label><select id="wardrobe-champion">${Object.entries(
    CHARACTERS,
  )
    .map(
      ([id, c]) =>
        `<option value="${id}"${id === view.champion ? " selected" : ""}>${c.name}</option>`,
    )
    .join("")}</select></div>
  ${parts.stage}
  ${parts.animations}
  <div class="wardrobe-wearing"><h3>Currently wearing</h3>${wearing}</div></aside>
  <section class="wardrobe-inventory"><nav class="wardrobe-filters" aria-label="Wardrobe categories">${[["all", "All"], ...WARDROBE_SLOTS].map(([slot, label]) => `<button type="button" data-wardrobe-slot="${slot}" aria-pressed="${view.slot === slot}">${label}</button>`).join("")}</nav><div class="wardrobe-inventory-heading"><h3>${view.slot === "all" ? "Owned items" : WARDROBE_SLOTS.find(([s]) => s === view.slot)![1]}</h3><span>${items.length} owned</span><button type="button" class="quiet" data-wardrobe-shop>${iconLabel("shop", "Visit Shop")}</button></div>
  ${problem ? `<p class="wardrobe-warning" role="alert">${escape(problem)}</p>` : ""}<div class="wardrobe-grid">${view.slot === "all" || view.slot === "champion" ? `<button type="button" class="wardrobe-item${original ? " is-selected" : ""}" data-wardrobe-preview="original" aria-pressed="${original}"><span class="wardrobe-item-art">${fighterAvatar(view.champion, "wardrobe-original")}</span><span class="wardrobe-item-copy"><b>Original skin</b><small>${CHARACTERS[view.champion].name}</small><span class="wardrobe-item-state${!e.looks[view.champion] ? " is-equipped-text" : ""}">${!e.looks[view.champion] ? `${menuIcon("check")}Equipped` : "Always available"}</span></span></button>` : ""}${cards}</div>${!items.length ? '<div class="wardrobe-empty"><b>Your collection starts here</b><p>Buy items in the Shop or earn rewards by defeating bosses. Owned items for this fighter appear here.</p><button type="button" class="secondary" data-wardrobe-raids>Explore boss rewards</button></div>' : ""}
  </section></div>${parts.footer}</section>`;
}

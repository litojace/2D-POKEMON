/**
 * The fitting room (UI remodel step 2, docs/ui-remodel/PLAN.md): the Shop
 * and the Wardrobe in one screen. The fighter stands on a stage on the left,
 * the catalogue is on the right and the action sits bottom right. The
 * Shop | Wardrobe switch only changes the catalogue; the stage, what you are
 * trying on and the action bar stay.
 *
 * This module is markup and rules only (no DOM, no network), so it can be
 * tested as plain functions. screens/fitting-room.ts wires it up. Every price
 * shown mirrors the database (`shopPrice`), and the server's answer to a
 * purchase or an equip is what the screen shows afterwards.
 */
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  AWAKENING,
  CHAMPION_SKINS,
  CHAMPION_SKIN_BY_ID,
  COINS,
  COLLECTION_NAMES,
  LOOK_ITEMS,
  LOOK_ITEM_BY_ID,
  MISSION_COINS,
  MYTHIC_TRIAL_WINS,
  RARITY_NAMES,
  SHOP_BUNDLES,
  shopPrice,
  type Collection,
  type Economy,
  type Rarity,
} from "../../../../packages/shared/src/shop";
import {
  FRAME_MAX_STARS,
  FRAME_STAR_CLEARS,
  RAID_BOSSES,
  RAID_COSMETICS,
  RAID_REWARDS,
  bossClears,
  frameStars,
  rewardBoss,
  type RaidLoadout,
  type RaidProgress,
  type RaidSlot,
} from "../../../../packages/shared/src/raid";
import {
  JOURNEY_ITEMS,
  JOURNEY_ITEM_BY_ID,
} from "../../../../packages/shared/src/journey";
import {
  TIER_NAMES,
  cosmeticTier,
} from "../../../../packages/shared/src/cosmetic-tier";
import { fighterAvatar, scopeIds } from "../fighter-art";
import { creatureSvg, type SkinLook } from "../creature-design";
import { colourPreview, hasColourPalette } from "../colour-preview";
import { previewViewBox } from "../shop-preview-layout";
import { framedAvatar } from "../portraits";
import { itemPicture, picksCountdown } from "../shop-ui";
import { menuIcon } from "../menu-icons";
import {
  actionBar,
  actions,
  attrs,
  avatar,
  button,
  chips,
  emptyState,
  esc,
  iconButton,
  itemTile,
  price,
  rarityTag,
  segmented,
  tabs,
  tag,
  timer,
  type RarityName,
} from "../ui/components";

/* ------------------------------------------------------------- the model */

export type FitMode = "shop" | "wardrobe";
export type ShopSection = "today" | "skins" | "mythic" | "collections";
export const SHOP_SECTIONS: [ShopSection, string][] = [
  ["today", "Today"],
  ["skins", "Skins"],
  ["mythic", "Mythic Hall"],
  ["collections", "Collections"],
];
/** The six things a fighter wears. "champion" is the fighter's own skin. */
export type FitSlot = "champion" | RaidSlot;
export const FIT_SLOTS: [FitSlot, string][] = [
  ["champion", "Skin"],
  ["skin", "Colors"],
  ["aura", "Aura"],
  ["entrance", "Entrance"],
  ["victory", "Victory"],
  ["frame", "Frame"],
];
const SLOT_NAME = Object.fromEntries(FIT_SLOTS) as Record<FitSlot, string>;
const FIGHTERS = Object.keys(CHARACTERS) as CharacterId[];

export interface FitView {
  mode: FitMode;
  section: ShopSection;
  /** The Wardrobe's slot tab. */
  slot: FitSlot;
  /** The fighter on the stage. */
  champion: CharacterId;
  /**
   * What is being tried on, per slot: an item id, or null for "none" (the
   * original look for the skin slot). A slot that isn't here shows what is
   * equipped. Nothing here is saved until Equip.
   */
  tryOn: Partial<Record<FitSlot, string | null>>;
  /** The item (or set) the action bar is about. */
  selected: string | null;
  /** Awakening stage shown for a Mythical on the stage. */
  stage?: number;
  /** Boss frame stars shown on the stage (a preview only, never saved). */
  frameStars?: number;
  /** The animation the stage plays. */
  action: "idle" | "entrance" | "victory";
  ownership: "all" | "owned" | "unowned";
  rarity: Rarity | "all";
  collection: Collection;
}
export interface FitData {
  /** null: not loaded (yet), or the Shop isn't available. */
  economy: Economy | null;
  progress: RaidProgress | null;
  /** The equipped shared looks (Colors, aura, entrance, victory, frame). */
  look: RaidLoadout;
  /** Why something is missing (a load failed). */
  problem?: string;
  /** Still loading the first copy. */
  loading?: boolean;
  /** Low graphics: a still fighter instead of the live rig. */
  low?: boolean;
  /** Today's picks seen already (the NEW tag on Today goes). */
  seenDay?: string;
}

export function fitView(
  mode: FitMode,
  champion: CharacterId,
  extra: Partial<FitView> = {},
): FitView {
  return {
    mode,
    section: "today",
    slot: "champion",
    champion,
    tryOn: {},
    selected: null,
    action: "idle",
    ownership: "all",
    rarity: "all",
    collection: SHOP_BUNDLES[0].collection,
    ...extra,
  };
}

/** Anything you can own or wear, with where it comes from. */
export interface FitItem {
  id: string;
  name: string;
  description: string;
  slot: FitSlot;
  source: string;
}
export function fitItem(id: string): FitItem | undefined {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin)
    return {
      id,
      name: skin.name,
      description: skin.description,
      slot: "champion",
      source: `${CHARACTERS[skin.champion].name} skin`,
    };
  const piece = LOOK_ITEM_BY_ID[id];
  if (piece)
    return {
      id,
      name: piece.name,
      description: piece.description,
      slot: piece.slot,
      source: `${COLLECTION_NAMES[piece.collection]} · for every fighter`,
    };
  const raid = RAID_COSMETICS[id as keyof typeof RAID_COSMETICS];
  if (raid)
    return {
      id,
      name: raid.name,
      description: raid.description,
      slot: raid.slot,
      source: raid.boss
        ? `Boss reward · ${RAID_BOSSES[raid.boss].name}`
        : "Boss reward",
    };
  const journey = JOURNEY_ITEM_BY_ID[id];
  if (journey)
    return {
      id,
      name: journey.name,
      description: journey.description,
      slot: journey.slot,
      source: "Journey reward",
    };
}
const nameOf = (id: string) =>
  fitItem(id)?.name ?? SHOP_BUNDLES.find((b) => b.id === id)?.name ?? id;

/**
 * What you own for a slot: bought skins and pieces, and boss rewards you
 * earned. The server decides ownership; this only lists what it sent.
 */
export function ownedFor(
  slot: FitSlot,
  champion: CharacterId,
  e: Economy,
  p: RaidProgress | null,
): FitItem[] {
  if (slot === "champion")
    return CHAMPION_SKINS.filter(
      (s) => s.champion === champion && e.owned.includes(s.id),
    ).map((s) => fitItem(s.id)!);
  const earned = new Set([...(p?.cosmetics ?? []), ...(p?.earned ?? [])]);
  const ids = [
    ...LOOK_ITEMS.filter((i) => i.slot === slot && e.owned.includes(i.id)).map(
      (i) => i.id,
    ),
    // Journey rewards (levels and seasons) are owned items too.
    ...JOURNEY_ITEMS.filter(
      (i) => i.slot === slot && e.owned.includes(i.id),
    ).map((i) => i.id),
    ...RAID_REWARDS.filter((r) => r.slot === slot && earned.has(r.id)).map(
      (r) => r.id,
    ),
  ];
  return [...new Set(ids)].map((id) => fitItem(id)!).filter(Boolean);
}
/** Is this item yours (bought, or earned in raids)? */
export function owns(id: string, d: FitData) {
  if (!d.economy) return false;
  if (d.economy.owned.includes(id)) return true;
  const earned = [
    ...(d.progress?.cosmetics ?? []),
    ...(d.progress?.earned ?? []),
  ];
  return earned.includes(id) && !!RAID_COSMETICS[id as never];
}
/** What a slot holds now (saved), for the fighter on the stage. */
export function wornIn(slot: FitSlot, view: FitView, d: FitData) {
  return slot === "champion"
    ? (d.economy?.looks[view.champion]?.skin ?? null)
    : (d.look[slot] ?? null);
}
/** What a slot shows on the stage: the try-on, else what is worn. */
export function shownIn(slot: FitSlot, view: FitView, d: FitData) {
  return slot in view.tryOn
    ? (view.tryOn[slot] ?? null)
    : wornIn(slot, view, d);
}
/** The highest Awakening stage you have reached with a Mythical. */
export function reachedStage(id: string, e: Economy | null) {
  if (!e) return 1;
  if (e.mythicTesting) return 3;
  return e.awakening[id]?.stage ?? 1;
}
/** The stage a skin shows on the stage. */
function stageOf(id: string, view: FitView, d: FitData) {
  if (CHAMPION_SKIN_BY_ID[id]?.rarity !== "mythical") return 1;
  if (view.stage) return view.stage;
  const worn = d.economy?.looks[view.champion];
  return worn?.skin === id ? worn.stage : reachedStage(id, d.economy);
}
/** The whole outfit on the stage: equipped things plus every try-on. */
export function stageOutfit(view: FitView, d: FitData) {
  const skinId = shownIn("champion", view, d);
  const skin: SkinLook | null = skinId
    ? { skin: skinId, stage: stageOf(skinId, view, d) }
    : null;
  const look: RaidLoadout = { ...d.look };
  for (const [slot] of FIT_SLOTS) {
    if (slot === "champion" || !(slot in view.tryOn)) continue;
    const id = view.tryOn[slot];
    if (id) look[slot] = id as never;
    else delete look[slot];
  }
  return { skin, look };
}

/** One change the Wardrobe would save. */
export interface FitChange {
  slot: FitSlot;
  from: string | null;
  to: string | null;
  /** Awakening stage to save with a Mythical. */
  stage?: number;
}
/**
 * The Wardrobe's pending changes: try-ons of things you own that differ
 * from what you wear. Try-ons of things you don't own aren't saved (they
 * are listed by notOwnedTryOns).
 */
export function pendingChanges(view: FitView, d: FitData): FitChange[] {
  if (!d.economy) return [];
  const out: FitChange[] = [];
  for (const [slot] of FIT_SLOTS) {
    if (!(slot in view.tryOn)) continue;
    const to = view.tryOn[slot] ?? null;
    const from = wornIn(slot, view, d);
    if (to && !owns(to, d)) continue;
    if (slot === "champion") {
      const worn = d.economy.looks[view.champion];
      if (to) {
        // A Mythical can be saved at any stage you have reached.
        const stage = Math.min(
          stageOf(to, view, d),
          reachedStage(to, d.economy),
        );
        if (to !== from || (worn && stage !== worn.stage))
          out.push({ slot, from, to, stage });
        continue;
      }
    }
    if (to !== from) out.push({ slot, from, to });
  }
  return out;
}
export const notOwnedTryOns = (view: FitView, d: FitData) =>
  Object.values(view.tryOn).filter((id): id is string => !!id && !owns(id, d));
/**
 * Going to the Wardrobe: it shows only what you own, so a Shop try-on of
 * something you don't own leaves the stage (it stayed on, while the slot
 * under it read "Original"). Try-ons of things you own stay, as changes
 * Equip can save; so does a frame picked to look at.
 */
export function dropUnownedTryOns(view: FitView, d: FitData) {
  if (!d.economy) return;
  let dropped = false;
  for (const [slot] of FIT_SLOTS) {
    const id = view.tryOn[slot];
    if (!id || owns(id, d)) continue;
    delete view.tryOn[slot];
    dropped = true;
    if (slot === "champion") view.stage = undefined;
  }
  if (
    view.selected &&
    !owns(view.selected, d) &&
    fitItem(view.selected)?.slot !== "frame"
  ) {
    view.selected = null;
    dropped = true;
  }
  if (dropped) view.action = "idle";
}

/* ------------------------------------------------------------ prices */

const n = (v: number) => v.toLocaleString("en-US");
export const isMythic = (id: string) =>
  CHAMPION_SKIN_BY_ID[id]?.rarity === "mythical";
/** Mythic Trial wins with a fighter so far. */
export const trialWins = (e: Economy, c: CharacterId) =>
  Math.min(MYTHIC_TRIAL_WINS, e.trialWins[c] ?? 0);
/** A Mythical you can't buy yet (testers skip the trial). */
export function trialLocked(id: string, e: Economy) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  return (
    !!skin &&
    skin.rarity === "mythical" &&
    !e.mythicTesting &&
    !e.owned.includes(id) &&
    trialWins(e, skin.champion) < MYTHIC_TRIAL_WINS
  );
}
/**
 * The numbers a purchase confirmation shows. A preview only: the server
 * sets the price and checks the balance when the purchase is sent.
 */
export function purchase(id: string, e: Economy) {
  const cost = shopPrice(id, e.owned, e.picks.deal);
  if (cost === null) return null;
  const set = SHOP_BUNDLES.find((b) => b.id === id);
  const full = set
    ? set.items
        .filter((i) => !e.owned.includes(i))
        .reduce((s, i) => s + LOOK_ITEM_BY_ID[i].price, 0)
    : (shopPrice(id, e.owned, null) ?? cost);
  const unlimited = !!e.unlimitedCoins;
  return {
    price: cost,
    /** The price before today's or the set's discount. */
    was: full > cost ? full : undefined,
    balance: e.balance,
    after: unlimited ? e.balance : e.balance - cost,
    unlimited,
    /** Coins still needed (0 when you can pay). */
    short: unlimited ? 0 : Math.max(0, cost - e.balance),
    locked: trialLocked(id, e),
  };
}
/** Coins the unfinished missions still pay today. */
export const missionCoinsLeft = (e: Economy) =>
  e.missions.filter((m) => !m.done).reduce((s, m) => s + m.coins, 0);

/* ---------------------------------------------------------------- art */

const RARITY_OF: Record<string, RarityName> = {
  common: "common",
  rare: "rare",
  epic: "epic",
  legendary: "legendary",
  mythic: "mythical",
  mythical: "mythical",
};
/** One rarity for every item: shop rarity, or the cosmetic tier (boss frames climb with stars). */
export function rarityOf(id: string, stars = 0): RarityName {
  const shop = CHAMPION_SKIN_BY_ID[id]?.rarity ?? LOOK_ITEM_BY_ID[id]?.rarity;
  return RARITY_OF[shop ?? cosmeticTier(id, stars)] ?? "common";
}
const starsOf = (id: string, d: FitData) =>
  frameStars(id, bossClears(d.progress));
function pictureOf(id: string, view: FitView, d: FitData, scope: string) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  return itemPicture(
    id,
    skin?.champion ?? view.champion,
    scope,
    skin ? stageOf(id, { ...view, stage: undefined }, d) : 1,
    starsOf(id, d),
  );
}
/** A still of a fighter in a look, framed like the live rig. */
function stillFighter(
  champion: CharacterId,
  skin: SkinLook | null,
  palette: string,
  action: string,
  scope: string,
) {
  return scopeIds(
    colourPreview(
      creatureSvg(
        champion,
        "down",
        undefined,
        previewViewBox(action),
        "normal",
        skin,
      ).replace("<svg ", '<svg aria-hidden="true" '),
      palette,
    ),
    scope,
  );
}
const elVar = (c: CharacterId) =>
  `var(--el-${CHARACTERS[c].element.toLowerCase()})`;

/* -------------------------------------------------------------- stage */

function stageMarkup(view: FitView, d: FitData) {
  const e = d.economy;
  const outfit = stageOutfit(view, d);
  const selected = view.selected ? fitItem(view.selected) : undefined;
  const frameView = selected?.slot === "frame";
  const name = CHARACTERS[view.champion].name;
  const palette = outfit.skin ? "" : (outfit.look.skin ?? "");
  const clears = bossClears(d.progress);
  const earnedStars = frameStars(outfit.look.frame, clears);
  let live: string;
  let extra = "";
  if (frameView) {
    // A frame is shown on the portrait it goes around, large.
    const boss = rewardBoss(selected.id);
    const mine = frameStars(selected.id, clears);
    const stars = boss
      ? Math.max(
          0,
          Math.min(FRAME_MAX_STARS, Math.trunc(view.frameStars ?? mine)),
        )
      : 0;
    const tier = cosmeticTier(selected.id, stars);
    live = `<div class="shop-live-stage is-item is-frame portrait-review-stage fit-frame-stage" data-preview-champion="${view.champion}" data-preview-item="${esc(selected.id)}" data-preview-action="idle" data-tier="${tier}" role="img" aria-label="${esc(`${name} portrait · ${selected.name}${boss ? ` · ${stars} stars` : ""} · ${TIER_NAMES[tier]}`)}"><div class="shop-preview-fallback"><div class="portrait-review-avatar fit-frame-avatar">${framedAvatar({ character: view.champion, raidLook: { ...outfit.look, frame: selected.id as never }, championLooks: outfit.skin ? { [view.champion]: outfit.skin } : {} }, "fit-frame-live", stars)}</div></div></div>`;
    if (boss) {
      const have = clears[boss] ?? 0;
      extra = `<div class="fit-stars" role="group" aria-label="Preview frame level">${Array.from(
        { length: FRAME_MAX_STARS + 1 },
        (_, level) =>
          `<button type="button" class="ui-btn is-s" data-fit-stars="${level}" aria-pressed="${level === stars}" aria-label="${esc(`Preview ${level} stars · ${TIER_NAMES[cosmeticTier(selected.id, level)]}${level ? ` · ${level * FRAME_STAR_CLEARS} wins` : " · Base"}${level === mine ? " · Your level" : level > mine ? " · Not yet earned" : ""}`)}"${level > mine ? ' data-locked="true"' : ""}>${level}★</button>`,
      ).join(
        "",
      )}</div><small class="ui-note fit-stars-note" role="status">Your level: ${mine}★ · ${stars > mine ? `Unlock at ${stars * FRAME_STAR_CLEARS} wins` : mine >= FRAME_MAX_STARS ? "Maximum level earned." : `${have}/${(mine + 1) * FRAME_STAR_CLEARS} clears`}</small>`;
    }
  } else {
    const look = outfit.skin;
    const still = stillFighter(
      view.champion,
      look,
      palette,
      view.action,
      "fit-stage",
    );
    const colours =
      palette && hasColourPalette(palette)
        ? " raid-cosmetic-preview is-colour-matched"
        : palette
          ? " raid-cosmetic-preview"
          : "";
    live = `<div class="shop-live-stage fit-live${d.low ? " is-still" : ""}" data-preview-champion="${view.champion}" data-preview-item="${esc(view.selected ?? look?.skin ?? "")}" data-preview-skin="${esc(look?.skin ?? "")}" data-preview-stage="${look?.stage ?? 1}" data-preview-look="${encodeURIComponent(JSON.stringify(outfit.look))}" data-preview-action="${view.action}" role="img" aria-label="${esc(`${name}${look?.skin ? ` in ${nameOf(look.skin)}` : ""}`)}"><div class="shop-preview-fallback${colours}"${palette ? ` data-cosmetic="${esc(palette)}"` : ""}>${still}</div>${d.low ? `<div class="shop-preview-fallback fit-original" hidden>${stillFighter(view.champion, null, "", view.action, "fit-original")}</div>` : ""}</div>`;
  }
  // Top: the portrait frame you'd wear (opens the Frame slot), and the
  // animations that only play on the stage.
  const frameBadge = `<button type="button" class="fit-frame-badge" data-fit-slot="frame" aria-label="Portrait frame: ${esc(outfit.look.frame ? nameOf(outfit.look.frame) : "none")}. Choose a frame">${framedAvatar({ character: view.champion, raidLook: outfit.look, championLooks: outfit.skin ? { [view.champion]: outfit.skin } : {} }, "fit-badge", earnedStars)}<small>${outfit.look.frame ? "Portrait frame" : "No frame"}</small></button>`;
  const plays =
    !frameView && !d.low
      ? `<span class="fit-plays">${button("Entrance", { size: "s", icon: "enter", attrs: { "data-fit-play": "entrance", "aria-pressed": view.action === "entrance" } })}${button("Victory", { size: "s", icon: "sparkle", attrs: { "data-fit-play": "victory", "aria-pressed": view.action === "victory" } })}</span>`
      : "";
  // Bottom: what is on the stage, Hold to compare, awakening stages.
  const focus = view.selected ?? outfit.skin?.skin ?? null;
  const info = focus ? fitItem(focus) : undefined;
  const set = view.selected
    ? SHOP_BUNDLES.find((b) => b.id === view.selected)
    : undefined;
  const state = !focus
    ? "Wearing"
    : e && owns(focus, d)
      ? wornIn(info?.slot ?? "champion", view, d) === focus
        ? "Equipped"
        : "Yours · trying on"
      : "Trying on";
  const compare =
    !frameView && (outfit.skin || (palette && hasColourPalette(palette)))
      ? button("Hold to compare", {
          size: "s",
          attrs: {
            "data-preview-compare": "hold",
            "aria-pressed": "false",
            disabled: !d.low,
            title: "Hold to see the original look",
          },
        })
      : "";
  const mythic = outfit.skin && isMythic(outfit.skin.skin) && !frameView;
  const reached = mythic ? reachedStage(outfit.skin!.skin, e) : 1;
  const awaken = mythic
    ? `<span class="fit-awaken" role="group" aria-label="Awakening stage">${[
        1, 2, 3,
      ]
        .map(
          (s) =>
            `<button type="button" class="ui-btn is-s" data-fit-awaken="${s}" aria-pressed="${s === outfit.skin!.stage}" aria-label="Show Stage ${"I".repeat(s)}${s > reached ? " (not reached)" : ""}"${s > reached ? ' data-locked="true"' : ""}>${"I".repeat(s)}</button>`,
        )
        .join("")}</span>`
    : "";
  const awakenNote = mythic
    ? `<small class="ui-note fit-awaken-note">${esc(awakeningNote(outfit.skin!.skin, e))}</small>`
    : "";
  const title = set
    ? set.name
    : (info?.name ?? (outfit.skin ? nameOf(outfit.skin.skin) : name));
  const sub = set
    ? `${set.items.length} pieces for every fighter`
    : (info?.source ?? (outfit.skin ? "" : `${name} · original look`));
  const rarity =
    focus && !set ? rarityTag(rarityOf(focus, starsOf(focus, d))) : "";
  return `<section class="ui-split-stage fit-stage${frameView ? " is-frame" : ""}" style="--el:${elVar(view.champion)}" aria-label="Try-on stage" data-fit-region="stage"><div class="fit-light" aria-hidden="true"></div>${live}<div class="fit-stage-top">${frameBadge}${plays}</div><div class="fit-stage-info"><span class="fit-row">${rarity}<span class="ui-note">${state}</span></span><b class="fit-stage-name">${esc(title)}</b>${sub ? `<small class="ui-note fit-stage-sub">${esc(sub)}</small>` : ""}${extra}${compare || awaken ? `<span class="fit-row fit-stage-tools">${compare}${awaken}</span>` : ""}${awakenNote}</div></section>`;
}
export function awakeningNote(id: string, e: Economy | null) {
  if (e?.mythicTesting) return "All stages unlocked for testing.";
  const a = e?.awakening[id];
  if (!a)
    return `Stage II: ${AWAKENING.stage2Wins} wins wearing it. Stage III: ${AWAKENING.stage3Wins} wins and a raid clear.`;
  if (a.stage >= 3) return `Stage III · ${a.wins} wins wearing it.`;
  return `Stage ${"I".repeat(a.stage)} · ${a.wins}/${a.stage < 2 ? AWAKENING.stage2Wins : AWAKENING.stage3Wins} wins${a.stage === 2 && !a.peril3 ? " and a raid clear" : ""} for the next stage.`;
}

/* --------------------------------------------------------------- head */

function headMarkup(view: FitView, d: FitData) {
  const mode = segmented(
    [
      { id: "shop", label: "Shop", selected: view.mode === "shop" },
      { id: "wardrobe", label: "Wardrobe", selected: view.mode === "wardrobe" },
    ],
    "Shop or Wardrobe",
    "mode",
    true,
  );
  const fresh = d.economy && d.seenDay !== d.economy.picks.day;
  const sections =
    view.mode === "shop"
      ? tabs(
          SHOP_SECTIONS.map(([id, label]) => ({
            id,
            label,
            selected: id === view.section,
            attrs: id === "today" && fresh ? { "data-new": true } : undefined,
          })),
          "Shop sections",
          "section",
        ).replace(/(data-new[^>]*>Today)/, `$1${tag("New", "new")}`)
      : `<span class="ui-note fit-hint">Your items · try them on, then Equip</span>`;
  return `<header class="ui-panel-head fit-head" data-fit-region="head">${mode}${sections}${iconButton("cancel", "Back to the Lobby", { class: "ui-close", "data-ui-close": true })}</header>`;
}

/* ------------------------------------------------------------- tiles */

function shopTile(id: string, view: FitView, d: FitData) {
  const e = d.economy!;
  const skin = CHAMPION_SKIN_BY_ID[id];
  const item = fitItem(id)!;
  const worn = wornFor(id, d);
  let foot: string;
  let footKind: "default" | "ok" | "trial" | "dim" = "default";
  if (owns(id, d)) {
    foot = worn ? `${menuIcon("check")}Equipped` : "Owned";
    footKind = "ok";
  } else if (trialLocked(id, e)) {
    foot = `Trial ${trialWins(e, skin!.champion)}/${MYTHIC_TRIAL_WINS} wins`;
    footKind = "trial";
  } else {
    const p = purchase(id, e)!;
    foot = price(p.price, p.was);
  }
  return itemTile({
    id,
    art: pictureOf(id, view, d, `fit-${id}`),
    name: item.name,
    sub: skin ? `${CHARACTERS[skin.champion].name} skin` : SLOT_NAME[item.slot],
    rarity: rarityOf(id),
    foot,
    footKind,
    corner: id === e.picks.deal && !owns(id, d) ? tag("−20%", "sale") : "",
    pressed: view.selected === id,
    attrs: { "data-slot": item.slot },
  });
}
/** Is this item worn now (on any fighter for a skin)? */
function wornFor(id: string, d: FitData) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin) return d.economy?.looks[skin.champion]?.skin === id;
  const item = fitItem(id);
  return !!item && item.slot !== "champion" && d.look[item.slot] === id;
}
const section = (title: string, note = "") =>
  `<div class="fit-section"><h3 class="ui-h">${esc(title)}</h3>${note}</div>`;
const grid = (tiles: string, cols = 4, cls = "") =>
  `<div class="ui-grid fit-grid${cls ? ` ${cls}` : ""}" style="--cols:${cols}">${tiles}</div>`;

function fighterRow(view: FitView, d: FitData, label: string) {
  return `<div class="ui-chips fit-fighters" role="group" aria-label="${esc(label)}">${FIGHTERS.map(
    (c) =>
      `<button type="button" class="fit-fighter" data-fit-fighter="${c}" aria-pressed="${c === view.champion}" aria-label="${esc(CHARACTERS[c].name)}" style="--el:${elVar(c)}">${avatar(fighterAvatar(c, `fit-fighter-${c}`, d.economy?.looks[c] ?? null), { element: CHARACTERS[c].element, size: 34 })}<span>${esc(CHARACTERS[c].name)}</span></button>`,
  ).join("")}</div>`;
}

/* --------------------------------------------------------- shop body */

function todayBody(view: FitView, d: FitData) {
  const e = d.economy!;
  const countdown = picksCountdown();
  const deal = e.picks.items.find(
    (id) =>
      id === e.picks.deal && shopPrice(id, e.owned, e.picks.deal) !== null,
  );
  let featured = "";
  if (deal) {
    const p = purchase(deal, e)!;
    const item = fitItem(deal)!;
    const cost = p.locked
      ? `<span class="ui-tile-foot is-trial">Trial ${trialWins(e, CHAMPION_SKIN_BY_ID[deal].champion)}/${MYTHIC_TRIAL_WINS} wins</span>`
      : price(p.price, p.was);
    const skin = CHAMPION_SKIN_BY_ID[deal];
    featured = `<button type="button" class="fit-deal" data-ui-item="${esc(deal)}" data-slot="${esc(item.slot)}" data-rarity="${rarityOf(deal)}" aria-pressed="${view.selected === deal}"><span class="fit-deal-art">${pictureOf(deal, view, d, `fit-deal-${deal}`)}</span><span class="fit-deal-text"><span class="fit-row">${rarityTag(rarityOf(deal))}${tag("20% off today", "sale")}</span><b class="fit-deal-name">${esc(item.name)}</b><small class="ui-note">${esc(`${skin ? `${CHARACTERS[skin.champion].name} skin` : item.source} · ${item.description}`)}</small><span class="fit-deal-price">${cost}</span></span><span class="fit-deal-timer">${timer(`Ends in ${countdown}`)}</span></button>`;
  }
  const picks = e.picks.items.filter((id) => id !== deal);
  const bundles = SHOP_BUNDLES.filter(
    (b) => shopPrice(b.id, e.owned, null) !== null,
  )
    .map((b) => ({
      b,
      have: b.items.filter((i) => e.owned.includes(i)).length,
    }))
    .sort((x, y) => y.have - x.have)
    .slice(0, 3);
  const left = missionCoinsLeft(e);
  const earn = `<div class="fit-earn" role="note"><b>Earn coins</b><span>Win against players <b>+${COINS.pvpWin}</b> · loss <b>+${COINS.pvpLoss}</b></span><span>Raid clear <b>+${COINS.raidClear[3]}</b></span><span>Missions <b>+${MISSION_COINS.easy} / ${MISSION_COINS.medium} / ${MISSION_COINS.hard}</b></span><span class="fit-earn-left">Missions left today: ${price(left)}</span></div>`;
  return `${featured}${section("Daily picks", timer(`New picks in ${countdown}`))}${grid(
    picks.map((id) => shopTile(id, view, d)).join(""),
    3,
    "fit-picks",
  )}${bundles.length ? `${section("Bundles", '<small class="ui-note">20% off the pieces you don\'t own</small>')}${bundles.map(({ b }) => bundleRow(b.id, view, d)).join("")}` : ""}${earn}`;
}
function bundleRow(id: string, view: FitView, d: FitData) {
  const e = d.economy!;
  const set = SHOP_BUNDLES.find((b) => b.id === id)!;
  const have = set.items.filter((i) => e.owned.includes(i)).length;
  const p = purchase(id, e);
  return `<button type="button" class="fit-bundle" data-ui-item="${esc(id)}" data-rarity="epic" aria-pressed="${view.selected === id}"><span class="fit-bundle-art">${set.items.map((i) => `<span>${pictureOf(i, view, d, `fit-set-${i}`)}</span>`).join("")}</span><span class="fit-bundle-text"><b class="ui-h">${esc(set.name)}</b><small class="ui-note">${set.items.length} pieces for every fighter · ${have} owned</small></span><span class="fit-bundle-price">${p ? price(p.price, p.was) : `<span class="ui-tag is-ok">${menuIcon("check")}Complete</span>`}</span></button>`;
}
function filters(view: FitView, count: number, rarity: boolean, noun: string) {
  const own = segmented(
    (
      [
        ["all", "All"],
        ["owned", "Owned"],
        ["unowned", "Not owned"],
      ] as const
    ).map(([id, label]) => ({ id, label, selected: view.ownership === id })),
    "Ownership",
    "own",
  );
  const rare = rarity
    ? chips(
        [
          { id: "all", label: "All rarities", selected: view.rarity === "all" },
          ...(Object.entries(RARITY_NAMES) as [Rarity, string][]).map(
            ([id, label]) => ({ id, label, selected: view.rarity === id }),
          ),
        ],
        "Rarity",
        "rarity",
      )
    : "";
  return `<div class="fit-filters">${own}${rare}<small class="ui-note fit-count" role="status">${count} ${count === 1 ? noun : `${noun}s`}</small></div>`;
}
const ownershipMatch = (id: string, view: FitView, d: FitData) =>
  view.ownership === "all" ||
  (view.ownership === "owned") === !!d.economy?.owned.includes(id);
const noMatch = () =>
  emptyState(
    "Nothing matches",
    "Try another fighter, or clear the filters.",
    button("Clear filters", { size: "s", attrs: { "data-fit-reset": true } }),
  );
function skinsBody(view: FitView, d: FitData) {
  // A fighter with no skins in the Shop yet (the newest champions).
  if (!CHAMPION_SKINS.some((s) => s.champion === view.champion))
    return `${fighterRow(view, d, "Fighter")}${emptyState(
      "No skins yet",
      `${CHARACTERS[view.champion].name} has no skins in the Shop yet. Colors and effects in Collections fit every fighter.`,
      button("Collections", {
        size: "s",
        attrs: { "data-ui-section": "collections" },
      }),
    )}`;
  const skins = CHAMPION_SKINS.filter(
    (s) =>
      s.champion === view.champion &&
      ownershipMatch(s.id, view, d) &&
      (view.rarity === "all" || s.rarity === view.rarity),
  );
  return `${fighterRow(view, d, "Fighter")}${filters(view, skins.length, true, "skin")}${
    skins.length
      ? grid(skins.map((s) => shopTile(s.id, view, d)).join(""))
      : noMatch()
  }`;
}
function mythicBody(view: FitView, d: FitData) {
  const e = d.economy!;
  const skins = CHAMPION_SKINS.filter(
    (s) => s.rarity === "mythical" && ownershipMatch(s.id, view, d),
  );
  const intro = e.mythicTesting
    ? '<p class="ui-note">Testing: Mythic Trials and Awakening stages are open.</p>'
    : `<p class="ui-note">Each fighter's Mythical opens after ${MYTHIC_TRIAL_WINS} wins against players or raid clears with that fighter. Wear it to awaken it: Stage II at ${AWAKENING.stage2Wins} wins, Stage III at ${AWAKENING.stage3Wins} wins and a raid clear.</p>`;
  return `${intro}${filters(view, skins.length, false, "Mythical")}${
    skins.length
      ? grid(skins.map((s) => mythicTile(s.id, view, d)).join(""))
      : noMatch()
  }`;
}
function mythicTile(id: string, view: FitView, d: FitData) {
  const e = d.economy!;
  const a = e.awakening[id];
  // The foot already says the trial or the price; an owned Mythical shows
  // how far it has awakened instead of whose skin it is.
  if (e.mythicTesting || !e.owned.includes(id)) return shopTile(id, view, d);
  const progress = `Stage ${"I".repeat(a?.stage ?? 1)} · ${a?.wins ?? 0}/${AWAKENING.stage3Wins} wins`;
  return shopTile(id, view, d).replace(
    /<small class="ui-tile-sub">[^<]*<\/small>/,
    `<small class="ui-tile-sub">${esc(progress)}</small>`,
  );
}
function collectionsBody(view: FitView, d: FitData) {
  const e = d.economy!;
  const picker = `<div class="ui-chips fit-collections" role="group" aria-label="Collection">${SHOP_BUNDLES.map(
    (b) =>
      `<button type="button" class="ui-chip" data-fit-collection="${b.collection}" aria-pressed="${b.collection === view.collection}">${esc(COLLECTION_NAMES[b.collection])}<span class="ui-tag">${b.items.filter((i) => e.owned.includes(i)).length}/${b.items.length}</span></button>`,
  ).join("")}</div>`;
  const set = SHOP_BUNDLES.find((b) => b.collection === view.collection)!;
  const skins = CHAMPION_SKINS.filter((c) => c.collection === set.collection);
  const have = skins.filter((c) => e.owned.includes(c.id)).length;
  const bonus = skins.length
    ? `<p class="ui-note">Own all ${skins.length} ${esc(COLLECTION_NAMES[set.collection])} fighter skins and the frame is yours free (${have}/${skins.length}).</p>`
    : "";
  return `<p class="ui-note">Colors and effects for every fighter · trying on ${esc(CHARACTERS[view.champion].name)}.</p>${picker}${bundleRow(set.id, view, d)}${bonus}${grid(
    set.items.map((id) => shopTile(id, view, d)).join(""),
    5,
  )}`;
}

/* ----------------------------------------------------- wardrobe body */

function wardrobeBody(view: FitView, d: FitData) {
  const e = d.economy!;
  const slots = `<div class="fit-slots" role="tablist" aria-label="What your fighter wears">${FIT_SLOTS.map(
    ([slot, label]) => {
      const id = shownIn(slot, view, d);
      const on = slot === view.slot;
      return `<button type="button" class="fit-slot" role="tab" aria-selected="${on}" tabindex="${on ? 0 : -1}" data-fit-slot="${slot}"${slot in view.tryOn && id !== wornIn(slot, view, d) ? ' data-changed="true"' : ""}><span class="fit-slot-art">${id ? pictureOf(id, view, d, `fit-slot-${slot}`) : slot === "champion" ? fighterAvatar(view.champion, "fit-slot-original") : "<i>—</i>"}</span><small>${label}</small><b class="${id ? "" : "is-none"}">${esc(id ? nameOf(id) : slot === "champion" ? "Original" : "None")}</b></button>`;
    },
  ).join("")}</div>`;
  const items = ownedFor(view.slot, view.champion, e, d.progress);
  const worn = wornIn(view.slot, view, d);
  // The tile for what is tried on in this slot is pressed (undefined: none).
  const tried =
    view.slot in view.tryOn ? (view.tryOn[view.slot] ?? null) : undefined;
  const fighter = CHARACTERS[view.champion].name;
  const plain =
    view.slot === "champion"
      ? itemTile({
          id: "original",
          art: fighterAvatar(view.champion, "fit-original-tile"),
          name: "Original look",
          sub: "Always yours",
          foot: worn ? "Owned" : `${menuIcon("check")}Equipped`,
          footKind: "ok",
          pressed: tried === null,
        })
      : itemTile({
          id: "none",
          art: `<i class="fit-none" aria-hidden="true">—</i>`,
          name: `No ${SLOT_NAME[view.slot].toLowerCase()}`,
          sub: "Take it off",
          foot: worn ? "" : `${menuIcon("check")}Equipped`,
          footKind: "ok",
          pressed: tried === null,
        });
  const tiles = items
    .map((i) => {
      const stars = starsOf(i.id, d);
      const isWorn = worn === i.id;
      const frame = i.slot === "frame" && rewardBoss(i.id);
      return itemTile({
        id: i.id,
        art: pictureOf(i.id, view, d, `fit-own-${i.id}`),
        name: i.name,
        sub: frame
          ? `${"★".repeat(stars)}${"☆".repeat(FRAME_MAX_STARS - stars)} · ${i.source}`
          : i.source,
        rarity: rarityOf(i.id, stars),
        foot: isWorn ? `${menuIcon("check")}Equipped` : "Owned",
        footKind: "ok",
        pressed: tried === i.id,
        attrs: { "data-slot": i.slot },
      });
    })
    .join("");
  // Owned items only (owner's decision 3); the rest are in the Shop.
  const missing =
    view.slot === "champion"
      ? CHAMPION_SKINS.filter(
          (s) => s.champion === view.champion && !e.owned.includes(s.id),
        ).length
      : LOOK_ITEMS.filter(
          (i) => i.slot === view.slot && !e.owned.includes(i.id),
        ).length;
  const what =
    view.slot === "champion"
      ? `${fighter} skins`
      : SLOT_NAME[view.slot] === "Colors"
        ? "Colors"
        : `${SLOT_NAME[view.slot].toLowerCase()}s`;
  const noSkins =
    view.slot === "champion" &&
    !CHAMPION_SKINS.some((s) => s.champion === view.champion);
  const more = `<button type="button" class="ui-tile fit-more" data-fit-more="${noSkins ? "skin" : view.slot}"><span class="ui-tile-art">${menuIcon("shop")}</span><span></span><b class="ui-tile-name">More in the Shop</b><small class="ui-tile-sub">${noSkins ? `No ${esc(fighter)} skins yet` : missing ? `${missing} more ${esc(what)}` : "See what's new"}</small><span class="ui-tile-foot is-dim">Open the Shop →</span></button>`;
  const heading =
    view.slot === "champion" ? `${fighter} skins` : SLOT_NAME[view.slot];
  return `${fighterRow(view, d, "Fighter")}${slots}${section(heading, `<small class="ui-note">${items.length + (view.slot === "champion" ? 1 : 0)} owned</small>`)}${grid(plain + tiles + more)}${!items.length ? `<p class="ui-note fit-empty-note">${view.slot === "frame" || view.slot === "aura" ? "Buy pieces in the Shop or earn them from raid bosses." : "Buy pieces in the Shop to wear them here."}</p>` : ""}`;
}

/* -------------------------------------------------------- action bar */

function footArt(id: string, view: FitView, d: FitData) {
  return `<span class="fit-foot-art">${pictureOf(id, view, d, `fit-foot-${id}`)}</span>`;
}
const footText = (title: string, note: string, top = "") =>
  `<span class="fit-foot-text">${top}<b class="ui-h">${esc(title)}</b><small class="ui-note">${note}</small></span>`;
const status =
  '<p class="fit-status ui-note" role="status" aria-live="polite"></p>';

function shopFoot(view: FitView, d: FitData) {
  const e = d.economy;
  const id = view.selected;
  if (!e || !id)
    return actionBar(
      `${footText("Try anything on", "Tap an item to see it on your fighter. Try-ons are free.")}${status}`,
      "",
    );
  const set = SHOP_BUNDLES.find((b) => b.id === id);
  const p = purchase(id, e);
  const name = nameOf(id);
  if (set) {
    const info = footText(
      name,
      p
        ? `${set.items.length} pieces · 20% off the ones you don't own`
        : "You own every piece",
    );
    return actionBar(
      `${info}${status}`,
      p ? buyActions(id, p) : actions(button("Complete", { disabled: true })),
    );
  }
  const item = fitItem(id)!;
  const art = footArt(id, view, d);
  const top = rarityTag(rarityOf(id, starsOf(id, d)));
  if (owns(id, d)) {
    // The worn Mythical at another reached stage: Equip saves that stage.
    const restage =
      wornFor(id, d) &&
      isMythic(id) &&
      view.tryOn.champion === id &&
      pendingChanges(view, d).some((c) => c.slot === "champion");
    const worn = wornFor(id, d) && !restage;
    return actionBar(
      `${art}${footText(name, worn ? "Equipped" : "In your collection", top)}${status}`,
      actions(
        worn
          ? button("Take off", { attrs: { "data-fit-unequip": id } })
          : button("Equip", {
              kind: "ok",
              icon: "check",
              attrs: { "data-fit-equip": id },
            }),
      ),
    );
  }
  if (!p)
    return actionBar(
      `${art}${footText(name, "Not for sale", top)}${status}`,
      "",
    );
  if (p.locked) {
    const c = CHAMPION_SKIN_BY_ID[id].champion;
    return actionBar(
      `${art}${footText(name, `Mythic Trial: ${trialWins(e, c)}/${MYTHIC_TRIAL_WINS} wins as ${esc(CHARACTERS[c].name)}`, top)}${status}`,
      actions(
        button(`Play as ${CHARACTERS[c].name}`, {
          attrs: { "data-fit-play-as": c },
        }),
      ),
    );
  }
  const was = p.was ? `<s>${n(p.was)}</s> → ${n(p.price)} today · ` : "";
  const note = p.unlimited
    ? "Testing: purchases don't spend coins"
    : p.short
      ? `You need ${n(p.short)} more coins`
      : `${was}Try-ons are free`;
  return actionBar(
    `${art}${footText(item.name, note, top)}${status}`,
    buyActions(id, p),
  );
}
function buyActions(id: string, p: NonNullable<ReturnType<typeof purchase>>) {
  const buy = button("Buy", {
    kind: "primary",
    after: price(p.price),
    disabled: p.short > 0,
    attrs: {
      "data-fit-buy": id,
      title: p.short ? `You need ${n(p.short)} more coins` : undefined,
    },
  });
  return p.short
    ? actions(
        button("Earn coins", { attrs: { "data-fit-missions": true } }),
        buy,
      )
    : actions(buy);
}
function wardrobeFoot(view: FitView, d: FitData) {
  const changes = pendingChanges(view, d);
  const away = notOwnedTryOns(view, d);
  const fighter = CHARACTERS[view.champion].name;
  const list = changes
    .map((c) => {
      const label = SLOT_NAME[c.slot];
      const none = c.slot === "champion" ? "Original" : "None";
      const to = c.to ? nameOf(c.to) : none;
      if (c.from === c.to && c.stage)
        return `${label}: Stage ${"I".repeat(c.stage)}`;
      return `${label}: ${c.from ? nameOf(c.from) : none} → ${to}`;
    })
    .join(" · ");
  const note = changes.length
    ? list
    : away.length
      ? `${away.map(nameOf).join(", ")} ${away.length === 1 ? "is" : "are"} in the Shop`
      : "Try something on, then Equip";
  const outfit = stageOutfit(view, d);
  const art = `<span class="fit-foot-art">${fighterAvatar(view.champion, "fit-foot-fighter", outfit.skin)}</span>`;
  return actionBar(
    `${art}${footText(`${fighter} · ${changes.length ? `${changes.length} change${changes.length === 1 ? "" : "s"}` : "no changes"}`, esc(note))}${status}`,
    actions(
      button("Revert", {
        disabled: !Object.keys(view.tryOn).length,
        attrs: { "data-fit-revert": true },
      }),
      button("Equip", {
        kind: "ok",
        icon: "check",
        disabled: !changes.length,
        attrs: { "data-fit-save": true },
      }),
    ),
  );
}

/* ------------------------------------------------------------ the screen */

export interface FitParts {
  stage: string;
  head: string;
  body: string;
  foot: string;
}
export function fittingRoomParts(view: FitView, d: FitData): FitParts {
  const e = d.economy;
  let body: string;
  if (!e)
    body = d.loading
      ? `<p class="ui-note" role="status">Loading the Shop…</p>`
      : emptyState(
          "The Shop isn't available",
          d.problem ||
            "Log in to earn coins from raids, missions and matches, then spend them here.",
          button("Try again", { size: "s", attrs: { "data-fit-retry": true } }),
        );
  else if (view.mode === "wardrobe") body = wardrobeBody(view, d);
  else
    body = {
      today: todayBody,
      skins: skinsBody,
      mythic: mythicBody,
      collections: collectionsBody,
    }[view.section](view, d);
  // With coins loaded, a problem is the raid rewards: it only matters for
  // what the Wardrobe lists.
  const warn =
    e && d.problem && view.mode === "wardrobe"
      ? `<p class="fit-warning" role="alert">${esc(d.problem)}</p>`
      : "";
  return {
    stage: stageMarkup(view, d),
    head: headMarkup(view, d),
    body: `<div class="ui-panel-body fit-body" data-fit-region="body"${attrs({ "data-mode": view.mode, "data-section": view.mode === "shop" ? view.section : view.slot })}>${warn}${body}</div>`,
    foot: (view.mode === "shop"
      ? shopFoot(view, d)
      : wardrobeFoot(view, d)
    ).replace(
      '<footer class="ui-panel-foot"',
      '<footer class="ui-panel-foot" data-fit-region="foot"',
    ),
  };
}
/** The whole screen: the stage beside the catalogue, in one panel. */
export function fittingRoomMarkup(view: FitView, d: FitData) {
  const p = fittingRoomParts(view, d);
  return `<section class="ui-panel is-split fit-room" role="dialog" aria-label="${view.mode === "shop" ? "Shop" : "Wardrobe"}" data-fit-mode="${view.mode}">${p.stage}<div class="ui-split-main">${p.head}${p.body}${p.foot}</div></section>`;
}

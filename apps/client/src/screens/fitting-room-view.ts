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
  SKIN_BUNDLES,
  BUNDLE_BY_ID,
  ALL_BUNDLES,
  isSkinBundle,
  itemListPrice,
  skinPrice,
  shopPrice,
  type Collection,
  type ChampionLook,
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
  COLLECTION_FRAMES,
  JOURNEY_ITEM_BY_ID,
  REWARD_ITEMS,
} from "../../../../packages/shared/src/journey";
import {
  TIER_NAMES,
  cosmeticTier,
} from "../../../../packages/shared/src/cosmetic-tier";
import { fighterAvatar, fighterPortrait, scopeIds } from "../fighter-art";
import { creatureSvg, type SkinLook } from "../creature-design";
import { colourPreview, hasColourPalette } from "../colour-preview";
import { previewViewBox } from "../shop-preview-layout";
import { stageLight } from "../stage-light";
import { avatarImage, framePortrait } from "../portraits";
import { itemPicture, picksCountdown } from "../shop-ui";
import { isNewArrival } from "../shop-arrivals";
import { menuIcon } from "../menu-icons";
import {
  actionBar,
  actions,
  attrs,
  avatar,
  bar,
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
  /** The animation the stage plays ("ultimate": a Mythical's, at Stage III). */
  action: "idle" | "entrance" | "victory" | "ultimate";
  ownership: "all" | "owned" | "unowned";
  /** The Skins grid's order: rarest first (the default), or cheapest. */
  sort: "rarity" | "price";
  rarity: Rarity | "all";
  collection: Collection;
}
export interface FitData {
  /** null: not loaded (yet), or the Shop isn't available. */
  economy: Economy | null;
  progress: RaidProgress | null;
  /** The equipped shared looks (Colors, aura, entrance, victory, frame). */
  look: RaidLoadout;
  /** Your avatar (null: the default), shown inside a frame being viewed. */
  avatar?: string | null;
  /** Why something is missing (a load failed). */
  problem?: string;
  /** Still loading the first copy. */
  loading?: boolean;
  /** Low graphics: a still fighter instead of the live rig. */
  low?: boolean;
  /** Today's picks seen already (the NEW tag on Today goes). */
  seenDay?: string;
  /** A phone held sideways (max-height 500 px): Mythic Hall picks one
   * fighter at a time instead of the grid of all of them. */
  compact?: boolean;
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
    sort: "rarity",
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
  if (journey) {
    const set = COLLECTION_FRAMES.find((f) => f.id === id);
    return {
      id,
      name: journey.name,
      description: journey.description,
      slot: journey.slot,
      source: set
        ? `Collection reward · ${COLLECTION_NAMES[set.collection]}`
        : "Journey reward",
    };
  }
}
const nameOf = (id: string) =>
  fitItem(id)?.name ?? BUNDLE_BY_ID[id]?.name ?? id;
/**
 * Does this build know the item? The server's catalogue grows after a build
 * ships, so ids it sends (Today's picks, what is worn, the raid look) can be
 * ones this build has no name, picture or price for. Everything that takes
 * an id from the server asks this first and treats an unknown one as absent
 * (an unknown pick threw in shopTile and blanked Today,
 * the tab the Shop opens on).
 */
export const knownItem = (id: string | null | undefined): id is string =>
  !!id && !!fitItem(id);
/** A fighter's saved skin, if this build knows it (else the original look). */
export function wornSkin(
  e: Economy | null,
  c: CharacterId,
): ChampionLook | null {
  const look = e?.looks[c];
  return look && CHAMPION_SKIN_BY_ID[look.skin] ? look : null;
}

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
    // Journey rewards (levels and seasons) and collection frames are owned
    // items too.
    ...REWARD_ITEMS.filter(
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
  if (slot === "champion")
    return wornSkin(d.economy, view.champion)?.skin ?? null;
  const id = d.look[slot];
  return knownItem(id) ? id : null;
}
/** What a slot shows on the stage: the try-on, else what is worn. */
export function shownIn(slot: FitSlot, view: FitView, d: FitData) {
  if (!(slot in view.tryOn)) return wornIn(slot, view, d);
  const id = view.tryOn[slot] ?? null;
  return id && !knownItem(id) ? wornIn(slot, view, d) : id;
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
  const worn = wornSkin(d.economy, view.champion);
  return worn?.skin === id ? worn.stage : reachedStage(id, d.economy);
}
/** The whole outfit on the stage: equipped things plus every try-on. */
export function stageOutfit(view: FitView, d: FitData) {
  const skinId = shownIn("champion", view, d);
  const skin: SkinLook | null = skinId
    ? { skin: skinId, stage: stageOf(skinId, view, d) }
    : null;
  const look: RaidLoadout = {};
  for (const [slot] of FIT_SLOTS) {
    if (slot === "champion") continue;
    const id = shownIn(slot, view, d);
    if (id) look[slot] = id as never;
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
    if (to && (!owns(to, d) || !knownItem(to))) continue;
    if (slot === "champion") {
      const worn = wornSkin(d.economy, view.champion);
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
/** Is anything on the stage that you don't wear (a try-on, another stage)? */
export const trying = (view: FitView) =>
  Object.keys(view.tryOn).length > 0 || view.stage !== undefined;
export const notOwnedTryOns = (view: FitView, d: FitData) =>
  Object.values(view.tryOn).filter((id): id is string => !!id && !owns(id, d));
/**
 * Going to the Wardrobe: it shows only what you own, so a Shop try-on of
 * something you don't own leaves the stage (it stayed on, while the slot
 * under it read "Original"). Try-ons of things you own stay, as changes
 * Equip can save; so does a frame picked to look at. True when a fighter
 * skin left, so the caller can bring your own fighter back.
 */
export function dropUnownedTryOns(view: FitView, d: FitData) {
  if (!d.economy) return false;
  let dropped = false;
  const skin = view.tryOn.champion;
  const skinDropped = !!skin && !owns(skin, d);
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
  /** A skin you don't own left the stage (it may have brought its fighter). */
  return skinDropped;
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
  const set = BUNDLE_BY_ID[id];
  const full = set
    ? set.items
        .filter((i) => !e.owned.includes(i))
        .reduce((s, i) => s + itemListPrice(i), 0)
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
  // A frame goes round a portrait: yours, as on the stage and everywhere
  // players see you. (It was an empty ring.)
  if (!skin && fitItem(id)?.slot === "frame")
    // With its tier in the markup, as cosmeticPicture writes it: the edge
    // and halo are right from the first frame, before the preview attaches.
    return framePortrait(avatarImage(d.avatar), id, starsOf(id, d)).replace(
      /data-frame-stars="(\d+)"/,
      (all, stars) => `${all} data-tier="${cosmeticTier(id, Number(stars))}"`,
    );
  return itemPicture(
    id,
    skin?.champion ?? view.champion,
    scope,
    skin ? stageOf(id, { ...view, stage: undefined }, d) : 1,
    starsOf(id, d),
    true,
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
  // Something picked that this build doesn't know isn't on the stage.
  if (view.selected && !selected && !BUNDLE_BY_ID[view.selected])
    view = { ...view, selected: null };
  const frameView = selected?.slot === "frame";
  const name = CHARACTERS[view.champion].name;
  const palette = outfit.skin ? "" : (outfit.look.skin ?? "");
  const clears = bossClears(d.progress);
  let live: string;
  let extra = "";
  if (frameView) {
    // A frame is shown large on the portrait it goes around: your avatar,
    // as everyone sees you (identityPortrait), whatever fighter is chosen.
    const boss = rewardBoss(selected.id);
    const mine = frameStars(selected.id, clears);
    const stars = boss
      ? Math.max(
          0,
          Math.min(FRAME_MAX_STARS, Math.trunc(view.frameStars ?? mine)),
        )
      : 0;
    const tier = cosmeticTier(selected.id, stars);
    live = `<div class="shop-live-stage is-item is-frame portrait-review-stage fit-frame-stage" data-preview-champion="${view.champion}" data-preview-item="${esc(selected.id)}" data-preview-action="idle" data-tier="${tier}" role="img" aria-label="${esc(`Your portrait · ${selected.name}${boss ? ` · ${stars} stars` : ""} · ${TIER_NAMES[tier]}`)}"><div class="shop-preview-fallback"><div class="portrait-review-avatar fit-frame-avatar">${framePortrait(avatarImage(d.avatar), selected.id, stars)}</div></div></div>`;
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
    live = `<div class="shop-live-stage fit-live${d.low ? " is-still" : ""}" data-preview-champion="${view.champion}" data-preview-item="${esc(view.selected ?? look?.skin ?? "")}" data-preview-skin="${esc(look?.skin ?? "")}" data-preview-stage="${look?.stage ?? 1}" data-preview-look="${encodeURIComponent(JSON.stringify(outfit.look))}" data-preview-action="${view.action}" role="img" aria-label="${esc(`${name}${look?.skin ? ` in ${nameOf(look.skin)}` : ""}`)}">${stageLight(previewViewBox(view.action), "fit")}<div class="shop-preview-fallback${colours}"${palette ? ` data-cosmetic="${esc(palette)}"` : ""}>${still}</div>${d.low ? `<div class="shop-preview-fallback fit-original" hidden>${stillFighter(view.champion, null, "", view.action, "fit-original")}</div>` : ""}</div>`;
  }
  // Top: the animations that only play on the stage. (No portrait frame
  // badge: portraits are preset avatars, and the Frame slot picks frames.)
  // A Mythical also shows its Stage III ultimate.
  const mythicShown =
    !!outfit.skin &&
    CHAMPION_SKIN_BY_ID[outfit.skin.skin]?.rarity === "mythical";
  const animations =
    !frameView && !d.low
      ? `${button("Entrance", { size: "s", icon: "enter", attrs: { "data-fit-play": "entrance", "aria-pressed": String(view.action === "entrance"), title: "Entrance" } })}${button("Victory", { size: "s", icon: "sparkle", attrs: { "data-fit-play": "victory", "aria-pressed": String(view.action === "victory"), title: "Victory" } })}${mythicShown ? button("Ultimate", { size: "s", icon: "battle", attrs: { "data-fit-play": "ultimate", "aria-pressed": String(view.action === "ultimate"), title: "Ultimate (Stage III)" } }) : ""}`
      : "";
  // Back to what you wear, while something you haven't equipped is on.
  const back = trying(view)
    ? button("Your look", {
        size: "s",
        icon: "again",
        attrs: { "data-fit-revert": true, title: "Back to the look you wear" },
      })
    : "";
  const plays =
    animations || back
      ? `<span class="fit-plays">${animations}${back}</span>`
      : "";
  // Bottom: what is on the stage, Hold to compare, awakening stages.
  const focus = view.selected ?? outfit.skin?.skin ?? null;
  const info = focus ? fitItem(focus) : undefined;
  const set = view.selected ? BUNDLE_BY_ID[view.selected] : undefined;
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
          icon: "swap",
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
    ? setNote(set.id)
    : (info?.source ?? (outfit.skin ? "" : `${name} · original look`));
  const rarity =
    focus && !set ? rarityTag(rarityOf(focus, starsOf(focus, d))) : "";
  // The stage dresses up with what stands on it: the item in focus, else
  // the skin worn (fitting-room.css, "the stage by rarity").
  const stageRarity = set
    ? ""
    : focus
      ? rarityOf(focus, starsOf(focus, d))
      : "";
  return `<section class="ui-split-stage fit-stage${frameView ? " is-frame" : ""}" style="--el:${elVar(view.champion)}"${stageRarity ? ` data-rarity="${stageRarity}"` : ""} aria-label="Try-on stage" data-fit-region="stage">${live}${plays ? `<div class="fit-stage-top">${plays}</div>` : ""}<div class="fit-stage-info"><span class="fit-row">${rarity}<span class="ui-note">${state}</span></span><b class="fit-stage-name">${esc(title)}</b>${sub ? `<small class="ui-note fit-stage-sub">${esc(sub)}</small>` : ""}${extra}${compare || awaken ? `<span class="fit-row fit-stage-tools">${compare}${awaken}</span>` : ""}${awakenNote}</div></section>`;
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
  const item = fitItem(id);
  // An id this build doesn't know (see knownItem): no tile.
  if (!item) return "";
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
    // Known but with no price (a reward, never sold): say so, don't throw.
    const p = purchase(id, e);
    foot = p ? price(p.price, p.was) : "Not for sale";
    if (!p) footKind = "dim";
  }
  return itemTile({
    id,
    art: pictureOf(id, view, d, `fit-${id}`),
    name: item.name,
    sub: skin ? skinSub(skin) : SLOT_NAME[item.slot],
    rarity: rarityOf(id),
    foot,
    footKind,
    corner: owns(id, d)
      ? ""
      : id === e.picks.deal
        ? tag("−20%", "sale")
        : isNewArrival(id)
          ? tag("New", "new")
          : "",
    pressed: view.selected === id,
    attrs: { "data-slot": item.slot },
  });
}
/**
 * A skin's second line: its collection where it has one (two Wombolder
 * skins are both "Bulldozer": Hero Squad and Cyber Mecha), else whose it is.
 */
const skinSub = (skin: (typeof CHAMPION_SKINS)[number]) =>
  skin.collection
    ? `${COLLECTION_NAMES[skin.collection]} · ${CHARACTERS[skin.champion].name}`
    : `${CHARACTERS[skin.champion].name} skin`;
/** Rarest first: what a Shop leads with. */
const RARITY_RANK: Record<RarityName, number> = {
  mythical: 0,
  mythic: 0,
  legendary: 1,
  epic: 2,
  rare: 3,
  common: 4,
};
/**
 * The Skins grid's order. Rarest first, new arrivals leading their rarity,
 * then the catalogue's order (it used to be the catalogue's order alone:
 * the 500-coin skins sat in the middle of a fighter's page). Or cheapest
 * first, at the list price: today's deal doesn't move a skin.
 */
export function sortSkins<T extends (typeof CHAMPION_SKINS)[number]>(
  skins: readonly T[],
  sort: FitView["sort"],
  isNew: (id: string) => boolean = isNewArrival,
): T[] {
  const fresh = new Map(skins.map((s) => [s.id, isNew(s.id)]));
  return skins
    .map((s, i) => ({ s, i }))
    .sort((x, y) =>
      sort === "price"
        ? skinPrice(x.s) - skinPrice(y.s) || x.i - y.i
        : RARITY_RANK[x.s.rarity] - RARITY_RANK[y.s.rarity] ||
          Number(fresh.get(y.s.id)) - Number(fresh.get(x.s.id)) ||
          x.i - y.i,
    )
    .map(({ s }) => s);
}
/** Is this item worn now (on any fighter for a skin)? */
function wornFor(id: string, d: FitData) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin) return wornSkin(d.economy, skin.champion)?.skin === id;
  const item = fitItem(id);
  return !!item && item.slot !== "champion" && d.look[item.slot] === id;
}
const section = (title: string, note = "") =>
  `<div class="fit-section"><h3 class="ui-h">${esc(title)}</h3>${note}</div>`;
const grid = (tiles: string, cols = 4, cls = "") =>
  `<div class="ui-grid fit-grid${cls ? ` ${cls}` : ""}" style="--cols:${cols}">${tiles}</div>`;

function fighterRow(
  view: FitView,
  d: FitData,
  label: string,
  /** A mark on a fighter's avatar and words added to its name for screen
   * readers (Mythic Hall: whose Mythical you own). */
  mark?: (c: CharacterId) => { badge: string; say: string } | null,
) {
  return `<div class="ui-chips fit-fighters" role="group" aria-label="${esc(label)}">${FIGHTERS.map(
    (c) => {
      const m = mark?.(c);
      // A picture of each fighter, drawn once (fighterPortrait): the row is
      // rebuilt on every tap, and eighteen inline fighters cost each time.
      return `<button type="button" class="fit-fighter" data-fit-fighter="${c}" aria-pressed="${c === view.champion}" aria-label="${esc(CHARACTERS[c].name + (m ? `, ${m.say}` : ""))}" style="--el:${elVar(c)}">${avatar(fighterPortrait(c, wornSkin(d.economy, c)), { element: CHARACTERS[c].element, size: 34 })}${m?.badge ?? ""}<span>${esc(CHARACTERS[c].name)}</span></button>`;
    },
  ).join("")}</div>`;
}

/* --------------------------------------------------------- shop body */

/**
 * Today's "New in the Shop": recent arrivals (shop-arrivals.ts) you don't
 * own yet, rarest first. New collections stay out of Today's Picks until
 * the database opens them (in_picks, migration 20261125120000), so without
 * this row a new collection only showed to someone who went through Skins
 * fighter by fighter. One skin per new skin collection: the one for the
 * fighter you're looking at, else the first you don't own (a collection
 * dresses all eighteen, and eighteen tiles would bury the rest). Look
 * pieces one by one. Nothing already shown above it (the deal, the picks).
 */
export function newInShop(
  view: FitView,
  d: FitData,
  isNew: (id: string) => boolean = isNewArrival,
  max = 6,
) {
  const e = d.economy;
  if (!e) return [];
  const shown = new Set([e.picks.deal, ...e.picks.items]);
  const fresh = (id: string) => isNew(id) && !owns(id, d) && !shown.has(id);
  const skins = new Map<string, string>();
  for (const s of CHAMPION_SKINS) {
    if (!fresh(s.id)) continue;
    const key = s.collection ?? s.id;
    const held = skins.get(key);
    if (
      !held ||
      (s.champion === view.champion &&
        CHAMPION_SKIN_BY_ID[held].champion !== view.champion)
    )
      skins.set(key, s.id);
  }
  const pieces = LOOK_ITEMS.filter((i) => fresh(i.id)).map((i) => i.id);
  return [...skins.values(), ...pieces]
    .map((id, i) => ({ id, i, rank: RARITY_RANK[rarityOf(id)] }))
    .sort((x, y) => x.rank - y.rank || x.i - y.i)
    .slice(0, max)
    .map(({ id }) => id);
}
/** The collections the new items come from, by name (the row's note). */
function arrivalNames(ids: string[]) {
  const names = ids
    .map(
      (id) =>
        CHAMPION_SKIN_BY_ID[id]?.collection ?? LOOK_ITEM_BY_ID[id]?.collection,
    )
    .filter((c): c is Collection => !!c)
    .map((c) => COLLECTION_NAMES[c]);
  return [...new Set(names)].join(" · ");
}

function todayBody(view: FitView, d: FitData) {
  const e = d.economy!;
  const countdown = picksCountdown();
  // Only the picks this build knows (see knownItem).
  const known = e.picks.items.filter(knownItem);
  const deal = known.find(
    (id) =>
      id === e.picks.deal && shopPrice(id, e.owned, e.picks.deal) !== null,
  );
  const dealPrice = deal ? purchase(deal, e) : null;
  const dealItem = deal ? fitItem(deal) : undefined;
  let featured = "";
  if (deal && dealPrice && dealItem) {
    const p = dealPrice;
    const item = dealItem;
    const cost = p.locked
      ? `<span class="ui-tile-foot is-trial">Trial ${trialWins(e, CHAMPION_SKIN_BY_ID[deal].champion)}/${MYTHIC_TRIAL_WINS} wins</span>`
      : price(p.price, p.was);
    const skin = CHAMPION_SKIN_BY_ID[deal];
    featured = `<button type="button" class="fit-deal" data-ui-item="${esc(deal)}" data-slot="${esc(item.slot)}" data-rarity="${rarityOf(deal)}" aria-pressed="${view.selected === deal}"><span class="fit-deal-art">${pictureOf(deal, view, d, `fit-deal-${deal}`)}</span><span class="fit-deal-text"><span class="fit-row">${rarityTag(rarityOf(deal))}${tag("20% off today", "sale")}<span class="fit-deal-timer">${timer(`Ends in ${countdown}`)}</span></span><b class="fit-deal-name">${esc(item.name)}</b><small class="ui-note">${esc(`${skin ? `${CHARACTERS[skin.champion].name} skin` : item.source} · ${item.description}`)}</small><span class="fit-deal-price">${cost}</span></span></button>`;
  }
  const picks = featured ? known.filter((id) => id !== deal) : known;
  const bundles = ALL_BUNDLES.filter(
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
  const arrivals = newInShop(view, d);
  const fresh = arrivals.length
    ? `${section("New in the Shop", `<small class="ui-note">${esc(arrivalNames(arrivals))}</small>`)}${grid(
        arrivals.map((id) => shopTile(id, view, d)).join(""),
        3,
        "fit-picks fit-new",
      )}`
    : "";
  const daily = picks.length
    ? `${section("Daily picks", timer(`New picks in ${countdown}`))}${grid(
        picks.map((id) => shopTile(id, view, d)).join(""),
        3,
        "fit-picks",
      )}`
    : "";
  return `${featured}${fresh}${daily}${bundles.length ? `${section("Bundles", '<small class="ui-note">20% off the pieces you don\'t own</small>')}${bundles.map(({ b }) => bundleRow(b.id, view, d)).join("")}` : ""}${earn}`;
}
/** What a set holds, in a few words. */
export function setNote(id: string) {
  const set = BUNDLE_BY_ID[id];
  return isSkinBundle(id)
    ? `${set.items.length} skins, one for every fighter`
    : `${set.items.length} pieces for every fighter`;
}
/**
 * The pieces a set's row and confirmation show: a Look set's five pieces;
 * a skin set's skin for the fighter you're looking at (the other seventeen
 * are the same design), so a row never draws eighteen fighters.
 */
export function setPreview(id: string, champion: CharacterId) {
  const set = BUNDLE_BY_ID[id];
  if (!isSkinBundle(id)) return set.items;
  const mine = set.items.find(
    (i) => CHAMPION_SKIN_BY_ID[i]?.champion === champion,
  );
  return mine ? [mine] : set.items.slice(0, 1);
}
function bundleRow(id: string, view: FitView, d: FitData, card = false) {
  const e = d.economy!;
  const set = BUNDLE_BY_ID[id];
  const have = set.items.filter((i) => e.owned.includes(i)).length;
  const p = purchase(id, e);
  // A set is as rare as its rarest piece (Look sets were all "epic").
  const rarity = set.items
    .map((i) => rarityOf(i))
    .reduce((a, b) => (RARITY_RANK[b] < RARITY_RANK[a] ? b : a));
  return `<button type="button" class="fit-bundle" data-ui-item="${esc(id)}" data-rarity="${rarity}" aria-pressed="${view.selected === id}"><span class="fit-bundle-art">${setPreview(
    id,
    view.champion,
  )
    .map((i) => `<span>${pictureOf(i, view, d, `fit-set-${i}`)}</span>`)
    .join(
      "",
    )}</span><span class="fit-bundle-text"><b class="ui-h">${esc(card ? set.name.replace(/ skins$/i, "") : set.name)}</b><small class="ui-note">${card ? `${have}/${set.items.length} owned` : `${esc(setNote(id))} · ${have} owned`}</small></span><span class="fit-bundle-price">${p ? price(p.price, p.was) : `<span class="ui-tag is-ok">${menuIcon("check")}Complete</span>`}</span></button>`;
}
function filters(
  view: FitView,
  count: number,
  rarity: boolean,
  noun: string,
  sortable = false,
) {
  // The order, as a switch of two halves (owner's pick B, 25 Nov): both
  // orders in sight, the lit one is the order shown, one tap changes it. A
  // long toggle button used to fill a phone's row for two choices. The
  // marks are the tiles' own: the rarity diamond and the coin of a price;
  // the words show where there is room (fitting-room.css).
  const sort = sortable
    ? `<div class="ui-seg fit-sort" role="group" aria-label="Order">${(
        [
          ["rarity", "Rarest", '<i class="fit-gem" aria-hidden="true"></i>'],
          ["price", "Cheapest", '<i class="ui-coin" aria-hidden="true"></i>'],
        ] as const
      )
        .map(
          ([id, word, mark]) =>
            `<button type="button" data-fit-sort="${id}" aria-pressed="${view.sort === id}" aria-label="${word} first" title="${word} first">${mark}<span class="fit-sort-word">${word}</span></button>`,
        )
        .join("")}</div>`
    : "";
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
  return `<div class="fit-filters${sortable ? " has-sort" : ""}">${own}${sort}${rare}<small class="ui-note fit-count" role="status">${count} ${count === 1 ? noun : `${noun}s`}</small></div>`;
}
const ownershipMatch = (id: string, view: FitView, d: FitData) =>
  view.ownership === "all" ||
  (view.ownership === "owned") === !!d.economy?.owned.includes(id);
const noMatch = () =>
  emptyState(
    "Nothing matches",
    "Try another fighter, or clear the filters.",
    button("Clear filters", {
      icon: "cancel",
      size: "s",
      attrs: { "data-fit-reset": true },
    }),
  );
function skinsBody(view: FitView, d: FitData) {
  // A fighter with no skins in the Shop yet (the newest champions).
  if (!CHAMPION_SKINS.some((s) => s.champion === view.champion))
    return `${fighterRow(view, d, "Fighter")}${emptyState(
      "No skins yet",
      `${CHARACTERS[view.champion].name} has no skins in the Shop yet. Colors and effects in Collections fit every fighter.`,
      button("Collections", {
        icon: "sparkle",
        size: "s",
        attrs: { "data-ui-section": "collections" },
      }),
    )}`;
  // A phone held sideways has one row for the filters: ownership and the
  // order. Sorted rarest first, a fighter's 18 skins already stand grouped
  // by rarity, so the rarity chips are left to wider screens.
  const rarity = d.compact ? "all" : view.rarity;
  const skins = sortSkins(
    CHAMPION_SKINS.filter(
      (s) =>
        s.champion === view.champion &&
        ownershipMatch(s.id, view, d) &&
        (rarity === "all" || s.rarity === rarity),
    ),
    view.sort,
  );
  // The skins come first; the collection rewards follow them. (Above the
  // grid they filled a phone's first screen: no skin showed until you
  // scrolled.)
  return `${fighterRow(view, d, "Fighter")}${filters(view, skins.length, !d.compact, "skin", true)}${
    skins.length
      ? grid(skins.map((s) => shopTile(s.id, view, d)).join(""))
      : noMatch()
  }${collectionReward("cyber", view, d)}${
    // The Arcade frame, on the fighters with an Arcade skin.
    CHAMPION_SKINS.some(
      (s) => s.champion === view.champion && s.collection === "arcade",
    )
      ? collectionReward("arcade", view, d)
      : ""
  }`;
}
/**
 * Full-roster skin sets, in Collections with the other sets for every
 * fighter: a compact grid of cards (two or three to a row, so eleven sets
 * fit in a few rows on a phone instead of a long scroll), each shown with
 * the fighter you're trying on in its skin. Highest rarity first, newest
 * first within it; complete sets drop to the end.
 */
const SET_RANK: Record<string, number> = {
  legendary: 0,
  epic: 1,
  rare: 2,
  common: 3,
};
function skinSets(view: FitView, d: FitData) {
  const e = d.economy!;
  const rank = (id: string) =>
    SET_RANK[rarityOf(BUNDLE_BY_ID[id].items[0])] ?? 4;
  const cards = SKIN_BUNDLES.map((b, i) => ({ b, i }))
    .sort(
      (x, y) =>
        Number(shopPrice(x.b.id, e.owned, null) === null) -
          Number(shopPrice(y.b.id, e.owned, null) === null) ||
        rank(x.b.id) - rank(y.b.id) ||
        y.i - x.i,
    )
    .map(({ b }) => bundleRow(b.id, view, d, true))
    .join("");
  return `${section("Skin sets", '<small class="ui-note">Every fighter in one design · 20% off the skins you don\'t own</small>')}<div class="fit-skin-sets">${cards}</div>`;
}
/** A skin collection's reward frame: how close you are, with its picture. */
function collectionReward(
  collection: (typeof COLLECTION_FRAMES)[number]["collection"],
  view: FitView,
  d: FitData,
) {
  const e = d.economy!;
  const frame = COLLECTION_FRAMES.find((f) => f.collection === collection)!;
  const skins = CHAMPION_SKINS.filter((s) => s.collection === collection);
  const have = skins.filter((s) => e.owned.includes(s.id)).length;
  const text = e.owned.includes(frame.id)
    ? `The <b>${esc(frame.name)}</b> is yours (${have}/${skins.length} ${esc(COLLECTION_NAMES[collection])} skins).`
    : `Own all ${skins.length} ${esc(COLLECTION_NAMES[collection])} skins and the <b>${esc(frame.name)}</b> is yours free (${have}/${skins.length}).`;
  return `<div class="fit-set-reward" data-fit-reward="${frame.id}"><span class="fit-set-reward-art">${pictureOf(frame.id, view, d, `fit-reward-${collection}`)}</span><p class="ui-note">${text}</p></div>`;
}
function mythicBody(view: FitView, d: FitData) {
  if (d.compact) return mythicPick(view, d);
  const e = d.economy!;
  const skins = CHAMPION_SKINS.filter(
    (s) => s.rarity === "mythical" && ownershipMatch(s.id, view, d),
  );
  const intro = e.mythicTesting
    ? '<p class="ui-note">Testing: Mythic Trials and Awakening stages are open.</p>'
    : `<p class="ui-note">Each fighter's Mythical opens after ${MYTHIC_TRIAL_WINS} wins against players or raid clears with that fighter. Wear it to awaken it: Stage II at ${AWAKENING.stage2Wins} wins, Stage III at ${AWAKENING.stage3Wins} wins and a raid clear.</p>`;
  return `${intro}${collectionReward("void", view, d)}${filters(view, skins.length, false, "Mythical")}${
    skins.length
      ? grid(skins.map((s) => mythicTile(s.id, view, d)).join(""))
      : noMatch()
  }`;
}
/**
 * Mythic Hall on a phone: the fighter row (a gold mark on those whose
 * Mythical you own, a ring on a trial under way), then the chosen fighter's
 * Mythical with its three awakening stages. One screen instead of a grid
 * of eighteen tall tiles; the row still shows where you stand overall.
 */
function mythicPick(view: FitView, d: FitData) {
  const e = d.economy!;
  const mythicOf = (c: CharacterId) =>
    CHAMPION_SKINS.find((s) => s.champion === c && s.rarity === "mythical");
  const row = fighterRow(view, d, "Fighter", (c) => {
    const m = mythicOf(c);
    if (!m) return null;
    if (e.owned.includes(m.id))
      return {
        badge: '<i class="fit-fighter-mark is-owned" aria-hidden="true"></i>',
        say: "Mythical owned",
      };
    const wins = trialWins(e, c);
    return wins > 0 && trialLocked(m.id, e)
      ? {
          badge: '<i class="fit-fighter-mark is-trial" aria-hidden="true"></i>',
          say: `Mythic Trial ${wins} of ${MYTHIC_TRIAL_WINS} wins`,
        }
      : null;
  });
  const have = CHAMPION_SKINS.filter(
    (s) => s.rarity === "mythical" && e.owned.includes(s.id),
  ).length;
  const all = CHAMPION_SKINS.filter((s) => s.rarity === "mythical").length;
  const intro = `<p class="ui-note">${
    e.mythicTesting
      ? "Testing: Mythic Trials and Awakening stages are open."
      : `One Mythical per fighter · ${have}/${all} yours. Pick a fighter.`
  }</p>`;
  const m = mythicOf(view.champion);
  if (!m)
    return `${intro}${row}${emptyState(
      "No Mythical yet",
      `${CHARACTERS[view.champion].name} has no Mythical in the Shop yet.`,
    )}`;
  return `${intro}${row}<div class="fit-mythic-one">${mythicTile(m.id, view, d)}${mythicStages(m.id, e)}</div>${collectionReward("void", view, d)}`;
}
/** A Mythical's three awakening stages, with where you are. */
function mythicStages(id: string, e: Economy) {
  const champ = CHAMPION_SKIN_BY_ID[id]!.champion;
  const owned = e.owned.includes(id) || e.mythicTesting;
  const a = e.awakening[id];
  const wins = a?.wins ?? 0;
  const reached = owned ? reachedStage(id, e) : 0;
  const open = trialLocked(id, e)
    ? `Mythic Trial: ${trialWins(e, champ)}/${MYTHIC_TRIAL_WINS} wins with ${esc(CHARACTERS[champ].name)}`
    : owned
      ? "Yours"
      : "Open to buy";
  const steps: [number, string][] = [
    [1, open],
    [2, `${AWAKENING.stage2Wins} wins wearing it`],
    [3, `${AWAKENING.stage3Wins} wins and a raid clear`],
  ];
  return `<div class="fit-mythic-stages"><ol>${steps
    .map(
      ([n, text]) =>
        `<li${n <= reached ? ' class="is-reached"' : ""}><b>Stage ${"I".repeat(n)}</b><small>${text}</small></li>`,
    )
    .join("")}</ol>${
    owned && !e.mythicTesting
      ? bar(wins, AWAKENING.stage3Wins, {
          label: `Awakening: ${wins} of ${AWAKENING.stage3Wins} wins`,
        }) +
        `<small class="ui-note">${wins}/${AWAKENING.stage3Wins} wins${a?.peril3 ? " · raid cleared" : ""}</small>`
      : ""
  }</div>`;
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
  )}${skinSets(view, d)}`;
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
  const more = `<button type="button" class="ui-tile fit-more" data-fit-more="${noSkins ? "skin" : view.slot}"><span class="ui-tile-art">${menuIcon("shop")}</span><span class="ui-rarity is-none"></span><b class="ui-tile-name">More in the Shop</b><small class="ui-tile-sub">${noSkins ? `No ${esc(fighter)} skins yet` : missing ? `${missing} more ${esc(what)}` : "See what's new"}</small><span class="ui-tile-foot is-dim">Open the Shop →</span></button>`;
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
    // Nothing picked yet: an action bar with nothing to act on, which
    // phones fold away (data-idle, ui/components.css).
    return actionBar(
      `${footText("Try anything on", "Tap an item to see it on your fighter. Try-ons are free.")}${status}`,
      "",
    ).replace(
      '<footer class="ui-panel-foot"',
      '<footer class="ui-panel-foot" data-idle',
    );
  const set = BUNDLE_BY_ID[id];
  const p = purchase(id, e);
  const name = nameOf(id);
  if (set) {
    const info = footText(
      name,
      p
        ? `${setNote(id)} · 20% off the ones you don't own`
        : "You own every piece",
    );
    return actionBar(
      `${info}${status}`,
      p
        ? buyActions(id, p)
        : actions(button("Complete", { icon: "check", disabled: true })),
    );
  }
  const item = fitItem(id);
  if (!item) return shopFoot({ ...view, selected: null }, d);
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
          ? button("Take off", {
              icon: "cancel",
              attrs: { "data-fit-unequip": id },
            })
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
          icon: "enter",
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
        button("Earn coins", {
          icon: "missions",
          attrs: { "data-fit-missions": true },
        }),
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
  // How many changes above the fighter's name, as the Shop's bar puts the
  // rarity above the item's: "Voltkit · no changes" on one line was cut to
  // "VOLTKI…" on a 667 px phone, where the note under it is hidden.
  const count = changes.length
    ? `${changes.length} change${changes.length === 1 ? "" : "s"}`
    : "No changes";
  const top = `<small class="fit-foot-count"${changes.length ? ' data-changes="true"' : ""}>${count}</small>`;
  return actionBar(
    `${art}${footText(fighter, esc(note), top)}${status}`,
    actions(
      button("Revert", {
        icon: "again",
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
          button("Try again", {
            icon: "again",
            size: "s",
            attrs: { "data-fit-retry": true },
          }),
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

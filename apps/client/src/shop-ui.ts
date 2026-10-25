import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  AWAKENING,
  CHAMPION_SKINS,
  CHAMPION_SKIN_BY_ID,
  COLLECTION_NAMES,
  LOOK_ITEMS,
  LOOK_ITEM_BY_ID,
  MYTHIC_TRIAL_WINS,
  RARITY_NAMES,
  SHOP_BUNDLES,
  shopPrice,
  shopRarity,
  type Collection,
  type Economy,
  type Rarity,
} from "../../../packages/shared/src/shop";
import {
  RAID_COSMETICS,
  type RaidLoadout,
} from "../../../packages/shared/src/raid";
import { JOURNEY_ITEM_BY_ID } from "../../../packages/shared/src/journey";
import { colourPreview, hasColourPalette } from "./colour-preview";
import { nextRaidDayAt } from "../../../packages/shared/src/raid-roster";
import { fighterArt, fighterAvatar, scopeIds } from "./fighter-art";
import { buttonIcon, iconLabel } from "./menu-icons";
import { creatureSvg, type SkinLook } from "./creature-design";
import { previewViewBox } from "./shop-preview-layout";

/**
 * The Shop and daily missions (design §10). Markup only: AccountUI wires the
 * buttons. Every price shown mirrors the database, which is what charges.
 */
export type ShopTab = "today" | "champions" | "mythic" | "collections";
export const SHOP_TABS: [ShopTab, string][] = [
  ["today", "Today"],
  ["champions", "Champion skins"],
  ["mythic", "Mythic Hall"],
  ["collections", "Collections"],
];
export interface ShopView {
  tab: ShopTab;
  champion: CharacterId;
  /** The item shown in the big preview. */
  preview?: string | null;
  /** Awakening stage previewed for a Mythical. */
  stage?: number;
  ownership?: "all" | "owned" | "unowned";
  rarity?: Rarity | "all";
  collection?: Collection;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export const coins = (n: number) => n.toLocaleString("en-US");
const CHAMPIONS = Object.keys(CHARACTERS) as CharacterId[];
const MYTHIC_SLUG = Object.fromEntries(
  CHAMPION_SKINS.filter((s) => s.rarity === "mythical").map((s) => [
    s.champion,
    s.id.slice(s.champion.length + 1),
  ]),
) as Record<CharacterId, string>;

/** The coin balance chip (header and Shop). */
export function coinChip(
  balance: number | null | undefined,
  id = "",
  unlimited = false,
) {
  return `<span class="coin-chip pill"${id ? ` id="${id}"` : ""}>${unlimited ? '<span class="sr-only">Unlimited </span>' : ""}${buttonIcon("coin")}<b${unlimited ? ' aria-hidden="true" title="Unlimited coins · Admin testing"' : ""}>${unlimited ? "∞" : balance == null ? "—" : coins(balance)}</b><span class="sr-only"> coins</span></span>`;
}
const rarityBadge = (r: Rarity | null) =>
  r
    ? `<span class="rarity-badge rarity-${r}"><i class="rarity-gem" aria-hidden="true"></i>${RARITY_NAMES[r]}</span>`
    : "";
/** "7 h 24 min" until the next Pacific midnight, when Today's Picks change. */
export function picksCountdown(now = Date.now()) {
  const minutes = Math.max(
    1,
    Math.round((nextRaidDayAt(new Date(now)) - now) / 60_000),
  );
  const h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h ? `${h} h ${m} min` : `${m} min`;
}

// Isolated images let browsers cache/rasterize skin artwork once instead of
// keeping thousands of SVG mask/filter nodes live in the scrolling catalog.
const skinThumbnails = new Map<string, string>();
function skinThumbnail(id: string, champion: CharacterId, stage: number) {
  const key = `${id}:${stage}`;
  let url = skinThumbnails.get(key);
  if (!url) {
    url = `data:image/svg+xml,${encodeURIComponent(fighterArt(champion, undefined, { skin: id, stage }))}`;
    if (skinThumbnails.size >= 64)
      skinThumbnails.delete(skinThumbnails.keys().next().value!);
    skinThumbnails.set(key, url);
  }
  return `<img src="${url}" alt="" aria-hidden="true" width="200" height="202" loading="lazy" decoding="async">`;
}

/** A small picture of any item, worn by the previewed champion. */
export function itemPicture(
  id: string,
  champion: CharacterId,
  scope: string,
  stage = 1,
) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin) return skinThumbnail(id, skin.champion, stage);
  const look =
    LOOK_ITEM_BY_ID[id] ??
    RAID_COSMETICS[id as keyof typeof RAID_COSMETICS] ??
    JOURNEY_ITEM_BY_ID[id];
  if (look)
    return `<span class="raid-cosmetic-preview shop-look-preview" data-cosmetic="${id}">${hasColourPalette(id) ? `<img src="data:image/svg+xml,${encodeURIComponent(colourPreview(fighterAvatar(champion, scope), id))}" width="84" height="84" alt="" loading="lazy" decoding="async">` : fighterAvatar(champion, scope)}</span>`;
  return "";
}
function itemName(id: string) {
  return (
    CHAMPION_SKIN_BY_ID[id]?.name ??
    LOOK_ITEM_BY_ID[id]?.name ??
    SHOP_BUNDLES.find((b) => b.id === id)?.name ??
    id
  );
}
function itemLine(id: string) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin) return `${CHARACTERS[skin.champion].name} skin`;
  const look = LOOK_ITEM_BY_ID[id];
  if (look)
    return `${COLLECTION_NAMES[look.collection]} · ${look.slot === "skin" ? "Colours" : look.slot[0].toUpperCase() + look.slot.slice(1)} for every fighter`;
  return "Collection set";
}
/** Mythic Trial wins with a champion so far. */
const trial = (e: Economy, c: CharacterId) =>
  Math.min(MYTHIC_TRIAL_WINS, e.trialWins[c] ?? 0);

/** Buy / Equip / Equipped / Locked for one item. */
export function itemAction(
  id: string,
  e: Economy | null,
  loadout: RaidLoadout = {},
) {
  if (!e) return `<span class="shop-state">Log in to shop</span>`;
  const skin = CHAMPION_SKIN_BY_ID[id];
  const look = LOOK_ITEM_BY_ID[id];
  if (e.owned.includes(id)) {
    const worn = skin
      ? e.looks[skin.champion]?.skin === id
      : look
        ? loadout[look.slot] === id
        : false;
    if (worn)
      return `<button class="secondary shop-unequip is-equipped-text" data-shop-unequip="${id}">${iconLabel("check", "Equipped")}</button>`;
    return `<button class="secondary" data-shop-equip="${id}">${iconLabel("swap", "Equip")}</button>`;
  }
  const price = shopPrice(id, e.owned, e.picks.deal);
  if (price === null)
    return `<span class="shop-state">${iconLabel("check", "Owned")}</span>`;
  if (
    !e.mythicTesting &&
    skin?.rarity === "mythical" &&
    trial(e, skin.champion) < MYTHIC_TRIAL_WINS
  )
    return `<span class="shop-state shop-locked">Mythic Trial ${trial(e, skin.champion)}/${MYTHIC_TRIAL_WINS}</span>`;
  const short = !e.unlimitedCoins && e.balance < price;
  const full = e.picks.deal === id ? shopPrice(id, e.owned, null) : null;
  const was =
    full && full > price
      ? `<s class="shop-was"><span class="sr-only">Was </span>${coins(full)}</s>`
      : "";
  return `<button class="primary shop-buy" data-shop-buy="${id}" data-price="${price}" ${short ? `disabled title="You need ${coins(price - e.balance)} more coins"` : ""}>${buttonIcon("coin")}${was}<span class="shop-price">${coins(price)}</span></button>`;
}
function ownershipBadge(id: string, e: Economy | null, loadout: RaidLoadout) {
  if (!e?.owned.includes(id)) return "";
  const skin = CHAMPION_SKIN_BY_ID[id];
  const piece = LOOK_ITEM_BY_ID[id];
  const equipped = skin
    ? e.looks[skin.champion]?.skin === id
    : piece && loadout[piece.slot] === id;
  return `<span class="shop-owned-badge${equipped ? " is-equipped-text" : ""}">${iconLabel("check", equipped ? "Equipped" : "Owned")}</span>`;
}
/** One item card (the hero is today's deal, laid out wide). */
function card(
  id: string,
  view: ShopView,
  e: Economy | null,
  loadout: RaidLoadout,
  extra = "",
  hero = false,
) {
  const rarity = shopRarity(id);
  const price = e ? shopPrice(id, e.owned, e.picks.deal) : null;
  const deal = e?.picks.deal === id && price !== null;
  const selected = previewItem(view, e) === id;
  const blurb = hero
    ? `<p class="shop-card-blurb">${escape(CHAMPION_SKIN_BY_ID[id]?.description ?? LOOK_ITEM_BY_ID[id]?.description ?? "")}</p>`
    : "";
  return `<article class="shop-card rarity-${rarity ?? "set"}${selected ? " is-selected" : ""}${deal ? " is-deal" : ""}${hero ? " is-hero" : ""}">
    <button class="shop-card-art" data-shop-preview="${id}" aria-label="Preview ${escape(itemName(id))}" aria-pressed="${selected}">${itemPicture(id, view.champion, `shop-${view.tab}-${id}`)}</button>
    <div class="shop-card-body"><div class="shop-card-badges">${rarityBadge(rarity)}${deal ? '<span class="deal-badge">20% off today</span>' : ""}${ownershipBadge(id, e, loadout)}</div><b class="shop-card-name">${escape(itemName(id))}</b><small>${escape(itemLine(id))}</small>${blurb}${extra}</div>
    <div class="shop-card-action">${itemAction(id, e, loadout)}</div>
  </article>`;
}

export function previewItem(view: ShopView, e: Economy | null) {
  return (
    view.preview ??
    (view.tab === "today"
      ? e?.picks.items[0]
      : view.tab === "mythic"
        ? `${view.champion}-${MYTHIC_SLUG[view.champion]}`
        : view.tab === "collections"
          ? `${view.collection ?? SHOP_BUNDLES[0].collection}-colours`
          : e?.looks[view.champion]?.skin) ??
    null
  );
}

/** Front-facing live battle rig with motion controls, or a portrait frame. */
export function shopPreviewMarkup(
  view: ShopView,
  e: Economy | null,
  loadout: RaidLoadout,
) {
  const id = previewItem(view, e);
  const skin = id ? CHAMPION_SKIN_BY_ID[id] : undefined;
  const champion = skin?.champion ?? view.champion;
  const stage = skin?.rarity === "mythical" ? (view.stage ?? 1) : 1;
  const look = skin ? { skin: skin.id, stage } : null;
  const piece = id ? LOOK_ITEM_BY_ID[id] : undefined;
  const stages =
    skin?.rarity === "mythical"
      ? `<div class="shop-stages" role="group" aria-label="Awakening stage">${[
          1, 2, 3,
        ]
          .map(
            (s) =>
              `<button type="button" class="${s === stage ? "active" : ""}" data-shop-stage="${s}" aria-pressed="${s === stage}">Stage ${"I".repeat(s)}</button>`,
          )
          .join("")}</div><p class="shop-note">${awakeningNote(skin.id, e)}</p>`
      : "";
  const title = id
    ? escape(itemName(id))
    : `${CHARACTERS[champion].name}'s own look`;
  const text = skin
    ? escape(skin.description)
    : piece
      ? `${escape(piece.description)}. Worn by every fighter${piece.slot === "skin" ? " (a champion skin wins over Colours)" : ""}.`
      : "Pick a skin to see it in the live preview.";
  const frame = piece?.slot === "frame";
  // Each item plays the animation that shows it off; no picker needed.
  const action =
    piece?.slot === "entrance"
      ? "entrance"
      : piece?.slot === "victory"
        ? "victory"
        : "idle";
  const fallback = frame
    ? itemPicture(piece.id, champion, "shop-piece-preview")
    : scopeIds(
        colourPreview(
          frontPreviewArt(champion, look, action),
          piece?.slot === "skin" ? piece.id : "",
        ),
        "shop-live-fallback",
      );
  const fallbackClass =
    piece?.slot === "skin"
      ? ` raid-cosmetic-preview shop-preview-colours${hasColourPalette(piece.id) ? " is-colour-matched" : ""}`
      : "";
  const compare =
    skin || piece?.slot === "skin"
      ? '<button type="button" class="shop-compare" data-preview-compare aria-pressed="false" disabled>Compare original</button>'
      : "";
  const controls = compare
    ? `<div class="shop-preview-controls">${compare}</div>`
    : "";
  const price = id && e ? shopPrice(id, e.owned, e.picks.deal) : null;
  const locked =
    skin?.rarity === "mythical" &&
    e &&
    !e.mythicTesting &&
    !e.owned.includes(skin.id) &&
    trial(e, champion) < MYTHIC_TRIAL_WINS;
  const shortfall =
    e && !e.unlimitedCoins && price !== null && price > e.balance && !locked
      ? `<p class="shop-shortfall">${coins(price - e.balance)} more coins needed</p><button type="button" class="secondary shop-earn" data-shop-missions>${iconLabel("coin", "Earn coins · Daily missions")}</button>`
      : "";
  const purchase = id
    ? `<div class="shop-preview-purchase" aria-label="Selected item actions">${itemAction(id, e, loadout)}${shortfall}</div>`
    : "";
  return `<section class="shop-preview rarity-${(id && shopRarity(id)) || "set"}" aria-label="Cosmetic preview"><div class="shop-preview-visual"><div class="shop-live-stage${frame ? " is-frame" : ""}" data-preview-champion="${champion}" data-preview-item="${id ?? ""}" data-preview-stage="${stage}" data-preview-action="${action}" role="img" aria-label="${title} ${frame ? "profile frame" : "animated preview"}"><div class="shop-preview-fallback${fallbackClass}"${piece?.slot === "skin" ? ` data-cosmetic="${piece.id}"` : ""}>${fallback}</div></div>${frame ? '<p class="shop-frame-caption">Profile frame</p>' : ""}${controls}</div><div class="shop-preview-text"><div class="shop-preview-kicker">${rarityBadge(id ? shopRarity(id) : null)}<span>${frame ? "Portrait frame" : "Live preview"}</span></div><h3>${title}</h3><p>${text}</p>${stages}${purchase}</div></section>`;
}
/** Match the front-facing live preview while its textures load. */
function frontPreviewArt(
  id: CharacterId,
  look: SkinLook | null,
  action: string,
) {
  return creatureSvg(
    id,
    "down",
    undefined,
    previewViewBox(action),
    "normal",
    look,
  ).replace("<svg ", '<svg aria-hidden="true" ');
}
function awakeningNote(id: string, e: Economy | null) {
  if (e?.mythicTesting)
    return "Admin testing · All three stages are available to equip.";
  const a = e?.awakening[id];
  if (!a)
    return `Stage II: ${AWAKENING.stage2Wins} wins wearing it. Stage III: ${AWAKENING.stage3Wins} wins and a Peril 3 raid clear with this champion.`;
  return `Your Awakening: Stage ${"I".repeat(a.stage)} · ${a.wins} wins wearing it${a.stage < 3 ? ` · next at ${a.stage < 2 ? AWAKENING.stage2Wins : AWAKENING.stage3Wins} wins${a.stage === 2 && !a.peril3 ? " and a Peril 3 clear" : ""}` : ""}.`;
}

function todayTab(view: ShopView, e: Economy | null, loadout: RaidLoadout) {
  if (!e) return "";
  // Today's deal leads as a wide card (if it's still for sale).
  const deal = e.picks.items.find(
    (id) =>
      id === e.picks.deal && shopPrice(id, e.owned, e.picks.deal) !== null,
  );
  const cards = [
    ...(deal ? [deal] : []),
    ...e.picks.items.filter((id) => id !== deal),
  ]
    .map((id) => card(id, view, e, loadout, "", id === deal))
    .join("");
  return `<h3 class="shop-heading">Today's picks <small>New picks in ${picksCountdown()}</small></h3><div class="shop-grid shop-picks">${cards}</div>`;
}
function matchesOwnership(id: string, view: ShopView, e: Economy | null) {
  return (
    !view.ownership ||
    view.ownership === "all" ||
    (view.ownership === "owned"
      ? !!e?.owned.includes(id)
      : !e?.owned.includes(id))
  );
}
function browseFilters(view: ShopView, count: number, showRarity = false) {
  const ownership = (["all", "owned", "unowned"] as const)
    .map(
      (value) =>
        `<button type="button" data-shop-ownership="${value}" aria-pressed="${(view.ownership ?? "all") === value}">${{ all: "All", owned: "Owned", unowned: "Not owned" }[value]}</button>`,
    )
    .join("");
  const rarity = showRarity
    ? `<label class="shop-rarity-filter">Rarity <select data-shop-rarity><option value="all">All rarities</option>${Object.entries(
        RARITY_NAMES,
      )
        .map(
          ([value, label]) =>
            `<option value="${value}"${view.rarity === value ? " selected" : ""}>${label}</option>`,
        )
        .join("")}</select></label>`
    : "";
  return `<div class="shop-browse"><div class="shop-ownership" role="group" aria-label="Ownership">${ownership}</div>${rarity}<span class="shop-result-count" role="status">${count} ${count === 1 ? "skin" : "skins"}</span></div>`;
}
const emptyResults =
  '<div class="shop-empty"><b>No skins match these filters</b><p>Try another fighter or browse all rarities and ownership states.</p><button type="button" class="secondary" data-shop-reset>Clear filters</button></div>';
function championsTab(view: ShopView, e: Economy | null, loadout: RaidLoadout) {
  const chips = CHAMPIONS.map(
    (c) =>
      `<button type="button" class="shop-champion${c === view.champion ? " active" : ""}" data-shop-champion="${c}" aria-pressed="${c === view.champion}">${fighterAvatar(c, `shop-chip-${c}`, e?.looks[c] ?? null)}<span>${CHARACTERS[c].name}</span></button>`,
  ).join("");
  const own = e?.looks[view.champion]
    ? `<button class="secondary" data-shop-unequip-champion="${view.champion}">${iconLabel("cancel", "Wear the original look")}</button>`
    : "";
  const skins = CHAMPION_SKINS.filter(
    (s) =>
      s.champion === view.champion &&
      matchesOwnership(s.id, view, e) &&
      (!view.rarity || view.rarity === "all" || s.rarity === view.rarity),
  );
  return `<div class="shop-champions" role="group" aria-label="Champion">${chips}</div>${own ? `<p class="shop-own">${own}</p>` : ""}${browseFilters(view, skins.length, true)}${
    skins.length
      ? `<div class="shop-grid">${skins
          .map((s) => card(s.id, view, e, loadout))
          .join("")}</div>`
      : emptyResults
  }`;
}
function mythicTab(view: ShopView, e: Economy | null, loadout: RaidLoadout) {
  const skins = CHAMPION_SKINS.filter(
    (s) => s.rarity === "mythical" && matchesOwnership(s.id, view, e),
  );
  const intro = e?.mythicTesting
    ? "Admin testing · Mythic Trials and raid clears are bypassed. Get a skin and choose any Awakening stage."
    : `Mythicals can't be bought with coins alone: win <b>${MYTHIC_TRIAL_WINS} matches or raid clears</b> with the champion first (wins against players and raid clears count, bots don't). They awaken as you win in them.`;
  return `<p class="shop-intro">${intro}</p>${browseFilters(view, skins.length)}${!skins.length ? emptyResults : ""}<div class="shop-grid">${skins
    .map((s) => {
      const t = e ? trial(e, s.champion) : 0;
      const owned = e?.owned.includes(s.id);
      const a = e?.awakening[s.id];
      const bar = e?.mythicTesting
        ? '<span class="shop-progress"><small>All three stages available for testing</small></span>'
        : owned
          ? `<span class="shop-progress"><progress max="${AWAKENING.stage3Wins}" value="${Math.min(AWAKENING.stage3Wins, a?.wins ?? 0)}"></progress><small>Awakening Stage ${"I".repeat(a?.stage ?? 1)} · ${a?.wins ?? 0}/${AWAKENING.stage3Wins} wins</small></span>`
          : `<span class="shop-progress"><progress max="${MYTHIC_TRIAL_WINS}" value="${t}"></progress><small>Trial ${t}/${MYTHIC_TRIAL_WINS} wins as ${CHARACTERS[s.champion].name}</small></span>`;
      return card(s.id, view, e, loadout, bar);
    })
    .join("")}</div>`;
}
function collectionsTab(
  view: ShopView,
  e: Economy | null,
  loadout: RaidLoadout,
) {
  const selected = view.collection ?? SHOP_BUNDLES[0].collection;
  const picker = `<div class="shop-collection-picker" role="group" aria-label="Collection">${SHOP_BUNDLES.map((b) => `<button type="button" data-shop-collection="${b.collection}" aria-pressed="${b.collection === selected}"><b>${COLLECTION_NAMES[b.collection]}</b><span>${b.items.filter((id) => e?.owned.includes(id)).length}/${b.items.length} owned</span></button>`).join("")}</div>`;
  const sets = SHOP_BUNDLES.filter((b) => b.collection === selected)
    .map((b) => {
      const price = e ? shopPrice(b.id, e.owned, e.picks.deal) : null;
      const action = !e
        ? ""
        : price === null
          ? `<span class="shop-state">${iconLabel("check", "Complete")}</span>`
          : `<button class="primary shop-buy" data-shop-buy="${b.id}" data-price="${price}" ${!e.unlimitedCoins && e.balance < price ? "disabled" : ""}>${buttonIcon("coin")}<span class="shop-price">Set ${coins(price)}</span></button>`;
      // Collection bonus: every champion skin of this collection unlocks its frame.
      const skins = CHAMPION_SKINS.filter((c) => c.collection === b.collection);
      const have = skins.filter((c) => e?.owned.includes(c.id)).length;
      const bonus = skins.length
        ? `<small class="shop-bonus">Own all ${skins.length} ${COLLECTION_NAMES[b.collection as Collection]} champion skins to get the frame free (${have}/${skins.length})</small>`
        : "";
      return `<section class="shop-collection"><header><h3>${COLLECTION_NAMES[b.collection as Collection]}</h3><small>All five pieces · 20% off what you don't own</small>${action}${bonus}</header><div class="shop-grid">${b.items.map((id) => card(id, view, e, loadout)).join("")}</div></section>`;
    })
    .join("");
  return `<p class="shop-intro">Collection pieces work on every fighter. Choose a set to explore its colours, aura, frame, entrance and victory effect. Previewing on ${CHARACTERS[view.champion].name}.</p>${picker}${sets}`;
}
export function shopMarkup(
  view: ShopView,
  e: Economy | null,
  loadout: RaidLoadout = {},
  problem = "",
) {
  const tabs = `<nav class="shop-tabs" role="tablist" aria-label="Shop sections">${SHOP_TABS.map(
    ([id, label]) =>
      `<button role="tab" type="button" data-shop-tab="${id}" aria-selected="${id === view.tab}" class="${id === view.tab ? "active" : ""}">${label}</button>`,
  ).join("")}</nav>`;
  const body = !e
    ? `<p class="shop-intro">${problem ? escape(problem) : "Log in to earn coins from raids, missions and matches against players, then spend them here."}</p>`
    : {
        today: todayTab,
        champions: championsTab,
        mythic: mythicTab,
        collections: collectionsTab,
      }[view.tab](view, e, loadout);
  const preview = shopPreviewMarkup(view, e, loadout);
  return `<div class="shop"><header class="shop-head"><h2>${iconLabel("shop", "Shop")}</h2><button type="button" class="secondary" data-wardrobe-open>${iconLabel("wardrobe", "Wardrobe")}</button>${coinChip(e?.balance, "", e?.unlimitedCoins)}</header>${tabs}${preview}<div class="shop-body">${e?.unlimitedCoins ? '<p class="shop-note">Admin testing · Purchases don’t spend coins.</p>' : ""}${body}</div><p class="shop-status" role="status"></p></div>`;
}
/** Collection pieces' slot (for equipping). */
export const lookSlot = (id: string) => LOOK_ITEM_BY_ID[id]?.slot;

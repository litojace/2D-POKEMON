import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  AWAKENING,
  CHAMPION_SKINS,
  CHAMPION_SKIN_BY_ID,
  COINS,
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
import type { RaidLoadout } from "../../../packages/shared/src/raid";
import { fighterArt, fighterAvatar, scopeIds } from "./fighter-art";
import { buttonIcon, iconLabel } from "./menu-icons";
import { creatureSvg, CREATURE_VIEWBOX, type SkinLook } from "./creature-design";

/**
 * The Shop and daily missions (design §10). Markup only: AccountUI wires the
 * buttons. Every price shown mirrors the database, which is what charges.
 */
export type ShopTab = "today" | "champions" | "mythic" | "collections" | "missions";
export const SHOP_TABS: [ShopTab, string][] = [
  ["today", "Today"],
  ["champions", "Champion skins"],
  ["mythic", "Mythic Hall"],
  ["collections", "Collections"],
  ["missions", "Missions"],
];
export interface ShopView {
  tab: ShopTab;
  champion: CharacterId;
  /** The item shown in the big preview. */
  preview?: string | null;
  /** Awakening stage previewed for a Mythical. */
  stage?: number;
}
const escape = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
export const coins = (n: number) => n.toLocaleString("en-US");
const CHAMPIONS = Object.keys(CHARACTERS) as CharacterId[];
const MYTHIC_SLUG = Object.fromEntries(
  CHAMPION_SKINS.filter((s) => s.rarity === "mythical").map((s) => [s.champion, s.id.slice(s.champion.length + 1)]),
) as Record<CharacterId, string>;

/** The coin balance chip (header and Shop). */
export function coinChip(balance: number | null | undefined, id = "") {
  return `<span class="coin-chip"${id ? ` id="${id}"` : ""}>${buttonIcon("coin")}<b>${balance == null ? "—" : coins(balance)}</b><span class="sr-only"> coins</span></span>`;
}
const rarityBadge = (r: Rarity | null) =>
  r ? `<span class="rarity-badge rarity-${r}">${RARITY_NAMES[r]}</span>` : "";

/** A small picture of any item, worn by the previewed champion. */
export function itemPicture(id: string, champion: CharacterId, scope: string, stage = 1) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin) return scopeIds(fighterArt(skin.champion, undefined, { skin: id, stage }), scope);
  const look = LOOK_ITEM_BY_ID[id];
  if (look)
    return `<span class="raid-cosmetic-preview shop-look-preview" data-cosmetic="${id}">${fighterAvatar(champion, scope)}</span>`;
  return "";
}
function itemName(id: string) {
  return CHAMPION_SKIN_BY_ID[id]?.name ?? LOOK_ITEM_BY_ID[id]?.name ?? SHOP_BUNDLES.find((b) => b.id === id)?.name ?? id;
}
function itemLine(id: string) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  if (skin) return `${CHARACTERS[skin.champion].name} skin`;
  const look = LOOK_ITEM_BY_ID[id];
  if (look) return `${COLLECTION_NAMES[look.collection]} · ${look.slot === "skin" ? "Colours" : look.slot[0].toUpperCase() + look.slot.slice(1)} for every fighter`;
  return "Collection set";
}
/** Mythic Trial wins with a champion so far. */
const trial = (e: Economy, c: CharacterId) => Math.min(MYTHIC_TRIAL_WINS, e.trialWins[c] ?? 0);

/** Buy / Equip / Equipped / Locked for one item. */
export function itemAction(id: string, e: Economy | null, loadout: RaidLoadout = {}) {
  if (!e) return `<span class="shop-state">Log in to shop</span>`;
  const skin = CHAMPION_SKIN_BY_ID[id];
  const look = LOOK_ITEM_BY_ID[id];
  if (e.owned.includes(id)) {
    const worn = skin ? e.looks[skin.champion]?.skin === id : look ? loadout[look.slot] === id : false;
    if (worn)
      return `<button class="secondary shop-unequip" data-shop-unequip="${id}">${iconLabel("check", "Equipped")}</button>`;
    return `<button class="secondary" data-shop-equip="${id}">${iconLabel("swap", "Equip")}</button>`;
  }
  const price = shopPrice(id, e.owned, e.picks.deal);
  if (price === null) return `<span class="shop-state">${iconLabel("check", "Owned")}</span>`;
  if (skin?.rarity === "mythical" && trial(e, skin.champion) < MYTHIC_TRIAL_WINS)
    return `<span class="shop-state shop-locked">Mythic Trial ${trial(e, skin.champion)}/${MYTHIC_TRIAL_WINS}</span>`;
  const short = e.balance < price;
  return `<button class="primary shop-buy" data-shop-buy="${id}" data-price="${price}" ${short ? `disabled title="You need ${coins(price - e.balance)} more coins"` : ""}>${buttonIcon("coin")}<span>${coins(price)}</span></button>`;
}
/** One item card. */
function card(id: string, view: ShopView, e: Economy | null, loadout: RaidLoadout, extra = "") {
  const rarity = shopRarity(id);
  const price = e ? shopPrice(id, e.owned, e.picks.deal) : null;
  const deal = e?.picks.deal === id && price !== null;
  const selected = view.preview === id;
  return `<article class="shop-card rarity-${rarity ?? "set"}${selected ? " is-selected" : ""}${deal ? " is-deal" : ""}">
    <button class="shop-card-art" data-shop-preview="${id}" aria-label="Preview ${escape(itemName(id))}" aria-pressed="${selected}">${itemPicture(id, view.champion, `shop-${view.tab}-${id}`)}</button>
    <div class="shop-card-body">${rarityBadge(rarity)}${deal ? '<span class="deal-badge">20% off today</span>' : ""}<b>${escape(itemName(id))}</b><small>${escape(itemLine(id))}</small>${extra}</div>
    <div class="shop-card-action">${itemAction(id, e, loadout)}</div>
  </article>`;
}

/** The big preview: a skin in four facings (and its stages), or a piece worn. */
function previewPanel(view: ShopView, e: Economy | null) {
  // Nothing picked yet: today's first pick, or the skin this champion wears.
  const id =
    view.preview ??
    (view.tab === "today" ? e?.picks.items[0] : view.tab === "mythic" ? `${view.champion}-${MYTHIC_SLUG[view.champion]}` : e?.looks[view.champion]?.skin) ??
    null;
  const skin = id ? CHAMPION_SKIN_BY_ID[id] : undefined;
  const champion = skin?.champion ?? view.champion;
  const stage = skin?.rarity === "mythical" ? (view.stage ?? 1) : 1;
  const look = skin ? { skin: skin.id, stage } : null;
  const faces = (["down", "left", "right", "up"] as const)
    .map((dir) => `<span class="shop-face">${scopeIds(fighterArtFacing(champion, dir, look), `shop-face-${dir}`)}</span>`)
    .join("");
  const piece = id ? LOOK_ITEM_BY_ID[id] : undefined;
  const stages =
    skin?.rarity === "mythical"
      ? `<div class="shop-stages" role="group" aria-label="Awakening stage">${[1, 2, 3]
          .map((s) => `<button type="button" class="${s === stage ? "active" : ""}" data-shop-stage="${s}" aria-pressed="${s === stage}">Stage ${"I".repeat(s)}</button>`)
          .join("")}</div><p class="shop-note">${awakeningNote(skin.id, e)}</p>`
      : "";
  const title = id ? escape(itemName(id)) : `${CHARACTERS[champion].name}'s own look`;
  const text = skin
    ? escape(skin.description)
    : piece
      ? `${escape(piece.description)}. Worn by every fighter${piece.slot === "skin" ? " (a champion skin wins over Colours)" : ""}.`
      : "Pick a skin to preview it from every side.";
  return `<section class="shop-preview" aria-live="polite"><div class="shop-faces${piece ? " is-piece" : ""}">${piece ? itemPicture(piece.id, champion, "shop-piece-preview") : faces}</div><div class="shop-preview-text">${rarityBadge(id ? shopRarity(id) : null)}<h3>${title}</h3><p>${text}</p>${stages}</div></section>`;
}
/** Plain creature art in any facing (the Shop's preview). */
function fighterArtFacing(id: CharacterId, dir: "down" | "left" | "right" | "up", look: SkinLook | null) {
  return creatureSvg(id, dir, undefined, CREATURE_VIEWBOX, "normal", look).replace("<svg ", '<svg aria-hidden="true" ');
}
function awakeningNote(id: string, e: Economy | null) {
  const a = e?.awakening[id];
  if (!a) return `Stage II: ${AWAKENING.stage2Wins} wins wearing it. Stage III: ${AWAKENING.stage3Wins} wins and a Peril 3 raid clear with this champion.`;
  return `Your Awakening: Stage ${"I".repeat(a.stage)} · ${a.wins} wins wearing it${a.stage < 3 ? ` · next at ${a.stage < 2 ? AWAKENING.stage2Wins : AWAKENING.stage3Wins} wins${a.stage === 2 && !a.peril3 ? " and a Peril 3 clear" : ""}` : ""}.`;
}

function todayTab(view: ShopView, e: Economy | null, loadout: RaidLoadout) {
  if (!e) return "";
  return `<h3 class="shop-heading">Today's Picks <small>New picks at midnight Pacific</small></h3><div class="shop-grid">${e.picks.items.map((id) => card(id, view, e, loadout)).join("")}</div>${missionsBlock(e, true)}`;
}
function championsTab(view: ShopView, e: Economy | null, loadout: RaidLoadout) {
  const chips = CHAMPIONS.map(
    (c) => `<button type="button" class="shop-champion${c === view.champion ? " active" : ""}" data-shop-champion="${c}" aria-pressed="${c === view.champion}">${fighterAvatar(c, `shop-chip-${c}`, e?.looks[c] ?? null)}<span>${CHARACTERS[c].name}</span></button>`,
  ).join("");
  const own = e?.looks[view.champion] ? `<button class="secondary" data-shop-unequip-champion="${view.champion}">${iconLabel("cancel", "Wear the original look")}</button>` : "";
  return `<div class="shop-champions" role="group" aria-label="Champion">${chips}</div>${own ? `<p class="shop-own">${own}</p>` : ""}<div class="shop-grid">${CHAMPION_SKINS.filter((s) => s.champion === view.champion)
    .map((s) => card(s.id, view, e, loadout))
    .join("")}</div>`;
}
function mythicTab(view: ShopView, e: Economy | null, loadout: RaidLoadout) {
  return `<p class="shop-intro">Mythicals can't be bought with coins alone: win <b>${MYTHIC_TRIAL_WINS} matches or raid clears</b> with the champion first (wins against players and raid clears count, bots don't). They awaken as you win in them.</p><div class="shop-grid">${CHAMPION_SKINS.filter((s) => s.rarity === "mythical")
    .map((s) => {
      const t = e ? trial(e, s.champion) : 0;
      const owned = e?.owned.includes(s.id);
      const a = e?.awakening[s.id];
      const bar = owned
        ? `<span class="shop-progress"><progress max="${AWAKENING.stage3Wins}" value="${Math.min(AWAKENING.stage3Wins, a?.wins ?? 0)}"></progress><small>Awakening Stage ${"I".repeat(a?.stage ?? 1)} · ${a?.wins ?? 0}/${AWAKENING.stage3Wins} wins</small></span>`
        : `<span class="shop-progress"><progress max="${MYTHIC_TRIAL_WINS}" value="${t}"></progress><small>Trial ${t}/${MYTHIC_TRIAL_WINS} wins as ${CHARACTERS[s.champion].name}</small></span>`;
      return card(s.id, view, e, loadout, bar);
    })
    .join("")}</div>`;
}
function collectionsTab(view: ShopView, e: Economy | null, loadout: RaidLoadout) {
  const sets = SHOP_BUNDLES.map((b) => {
    const price = e ? shopPrice(b.id, e.owned, e.picks.deal) : null;
    const action = !e
      ? ""
      : price === null
        ? `<span class="shop-state">${iconLabel("check", "Complete")}</span>`
        : `<button class="primary shop-buy" data-shop-buy="${b.id}" data-price="${price}" ${e.balance < price ? "disabled" : ""}>${buttonIcon("coin")}<span>Set ${coins(price)}</span></button>`;
    // Collection bonus: every champion skin of this collection unlocks its frame.
    const skins = CHAMPION_SKINS.filter((c) => c.collection === b.collection);
    const have = skins.filter((c) => e?.owned.includes(c.id)).length;
    const bonus = skins.length
      ? `<small class="shop-bonus">Own all ${skins.length} ${COLLECTION_NAMES[b.collection as Collection]} champion skins to get the frame free (${have}/${skins.length})</small>`
      : "";
    return `<section class="shop-collection"><header><h3>${COLLECTION_NAMES[b.collection as Collection]}</h3><small>All five pieces · 20% off what you don't own</small>${action}${bonus}</header><div class="shop-grid">${b.items.map((id) => card(id, view, e, loadout)).join("")}</div></section>`;
  }).join("");
  return `<p class="shop-intro">Collection pieces work on every fighter. Equip them here or on a boss's Rewards tab in the Raid Hub. Previewing on ${CHARACTERS[view.champion].name}.</p>${sets}`;
}
/** Daily missions: progress, the one free re-roll, the streak and today's caps. */
export function missionsBlock(e: Economy, compact = false) {
  const left = e.missions.filter((m) => !m.done).length;
  const cards = e.missions
    .map(
      (m) => `<li class="mission tier-${m.tier}${m.done ? " is-done" : ""}"><span class="mission-tier">${m.tier}</span><b class="mission-title">${escape(m.text)}</b><div class="mission-footer"><progress aria-label="${escape(m.text)} progress" max="${m.target}" value="${Math.min(m.progress, m.target)}"></progress><div class="mission-meta"><span>${Math.min(m.progress, m.target)}/${m.target}</span><span class="mission-reward">${buttonIcon("coin")}<span>${m.coins}<span class="sr-only"> coins</span></span></span></div>${!compact ? `<div class="mission-actions">${m.done ? `<span class="mission-complete">${iconLabel("check", "Completed")}</span>` : !e.rerolled ? `<button class="quiet" data-mission-reroll="${m.slot}">${iconLabel("shuffle", "Re-roll")}</button>` : ""}</div>` : ""}</div></li>`,
    )
    .join("");
  const streak = `<p class="mission-streak">${buttonIcon("sparkle")}<span>Streak <b>${e.streak}</b> day${e.streak === 1 ? "" : "s"} · all three each day for 7 days pays +${COINS.streakBonus}; all three today pays +${COINS.allMissionsBonus}</span></p>`;
  const caps = compact
    ? ""
    : `<p class="shop-note">Today: raid clears paid ${Math.min(e.today.raidClears, COINS.raidClearsPaidPerDay)}/${COINS.raidClearsPaidPerDay} · matches against players paid ${Math.min(e.today.pvpMatches, COINS.pvpMatchesPaidPerDay)}/${COINS.pvpMatchesPaidPerDay}. Coins come from raids, missions and real matches (not bots).${e.rerolled ? " You've used today's re-roll." : " One free re-roll a day."}</p>`;
  return `<section class="missions"><h3 class="shop-heading">Daily missions <small>${left ? `${left} left` : "All done"}</small></h3><ul class="mission-list">${cards}</ul>${streak}${caps}</section>`;
}

export function shopMarkup(view: ShopView, e: Economy | null, loadout: RaidLoadout = {}, problem = "") {
  const tabs = `<nav class="shop-tabs" role="tablist" aria-label="Shop sections">${SHOP_TABS.map(
    ([id, label]) => `<button role="tab" type="button" data-shop-tab="${id}" aria-selected="${id === view.tab}" class="${id === view.tab ? "active" : ""}">${label}</button>`,
  ).join("")}</nav>`;
  const body = !e
    ? `<p class="shop-intro">${problem ? escape(problem) : "Log in to earn coins from raids, missions and matches against players, then spend them here."}</p>`
    : {
        today: todayTab,
        champions: championsTab,
        mythic: mythicTab,
        collections: collectionsTab,
        missions: (_v: ShopView, econ: Economy) => missionsBlock(econ),
      }[view.tab](view, e, loadout);
  const preview = view.tab === "missions" ? "" : previewPanel(view, e);
  return `<div class="shop"><header class="shop-head"><div><div class="eyebrow">ELEMENT ARENA</div><h2>${iconLabel("shop", "Shop")}</h2></div>${coinChip(e?.balance)}</header>${tabs}${preview}<div class="shop-body">${body}</div><p class="shop-status" role="status"></p></div>`;
}
/** Collection pieces' slot (for equipping). */
export const lookSlot = (id: string) => LOOK_ITEM_BY_ID[id]?.slot;
export const isLookItem = (id: string) => LOOK_ITEMS.some((i) => i.id === id);

// UI remodel mockups. Every picture, name, price and rule comes from the real
// game modules; only the player's state (coins, owned items, progress,
// friends) is sample data. ?s=<screen> picks the screen.
import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  fighterArt,
  fighterAvatar,
} from "../../../apps/client/src/fighter-art";
import { menuIcon } from "../../../apps/client/src/menu-icons";
import { elementIcon } from "../../../apps/client/src/element-icons";
import { abilityIcon } from "../../../apps/client/src/ability-icons";
import { itemPicture } from "../../../apps/client/src/shop-ui";
import { RAID_SPLASH } from "../../../apps/client/src/raid-splash-art";
import {
  CHAMPION_SKINS,
  CHAMPION_SKIN_BY_ID,
  LOOK_ITEMS,
  LOOK_ITEM_BY_ID,
  SHOP_BUNDLES,
  COLLECTION_NAMES,
  COINS,
  MYTHIC_TRIAL_WINS,
  shopPrice,
  type Rarity,
} from "../../../packages/shared/src/shop";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  type RaidBossId,
} from "../../../packages/shared/src/raid-roster";
import {
  RAID_BOSS_PERKS,
  RAID_REWARDS,
} from "../../../packages/shared/src/raid";
import {
  SEASON_THEMES,
  SEASON_RULES,
  seasonTheme,
  seasonReward,
  JOURNEY_ITEM_BY_ID,
  LEVEL_MILESTONES,
  WEEKLY_GOALS,
  levelCoins,
} from "../../../packages/shared/src/journey";
import { RANKS } from "../../../packages/shared/src/accounts";
import "../../../apps/client/src/cosmetic-fx.css";
import "../../../apps/client/src/collection-frames.css";
import "../../../apps/client/src/boss-frames.css";
import "./ui-kit.css";
import "./mockup.css";

const q = new URLSearchParams(location.search);
const fromHash = () => location.hash.replace(/^#/, "").replace(/-island$/, "");
let screen = q.get("s") ?? (fromHash() || "lobby");
const ids = Object.keys(CHARACTERS) as CharacterId[];
const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
const el = (c: CharacterId) =>
  `var(--el-${CHARACTERS[c].element.toLowerCase()})`;
const coins = (n: number) => n.toLocaleString("en-US");
const price = (n: number, was?: number) =>
  `<span class="ui-price"><i class="ui-coin"></i>${was ? `<s>${coins(was)}</s>` : ""}${coins(n)}</span>`;
const rarityLabel: Record<string, string> = {
  common: "Common",
  rare: "Rare",
  epic: "Epic",
  legendary: "Legendary",
  mythical: "Mythical",
};
const rarity = (r: string) =>
  `<span class="ui-rarity${r === "mythical" ? " is-mythic" : ""}" data-rarity="${r}">${rarityLabel[r]}</span>`;
const elementPill = (c: CharacterId) =>
  `<span class="ui-element" style="--el:${el(c)}">${elementIcon(CHARACTERS[c].element)}${CHARACTERS[c].element}</span>`;
const art = (c: CharacterId, skin?: string, stage = 1) =>
  fighterArt(c, undefined, skin ? ({ skin, stage } as never) : undefined);
const avatar = (c: CharacterId, status?: string, size?: number) =>
  `<span class="ui-avatar" style="--el:${el(c)}${size ? `;--size:${size}px` : ""}">${fighterAvatar(c, `av-${c}-${Math.random().toString(36).slice(2, 6)}`)}${status ? `<i class="ui-status" style="--st:var(--st-${status})"></i>` : ""}</span>`;

/* Collection pieces: simple stand-ins drawn here, because the game's own
   pictures (cosmeticPicture) rely on style.css. The real screens reuse them. */
const HUE: Record<string, string> = {
  winter: "#bfefff",
  festival: "#ff6b5a",
  garden: "#7fd67a",
  arcade: "#ff8fd8",
  celestial: "#ffe39d",
  candy: "#ff9bd2",
  galaxy: "#9c7bff",
  retro: "#7fe7ff",
  aurora: "#9ff3d8",
  ember: "#ffb980",
  tide: "#86deff",
  astral: "#d2b0ff",
};
function lookArt(id: string, slot?: string, hueKey?: string) {
  const look = LOOK_ITEM_BY_ID[id];
  const kind = slot ?? look?.slot ?? "skin";
  const c = HUE[hueKey ?? look?.collection ?? ""] ?? "#ffd65b";
  if (kind === "skin" || kind === "colors")
    return itemPicture(id, ME.fighter, `l-${id}`);
  if (kind === "aura")
    return `<svg viewBox="0 0 100 100"><ellipse cx="50" cy="62" rx="40" ry="14" fill="none" stroke="${c}" stroke-width="3" opacity=".5"/>${Array.from(
      { length: 10 },
      (_, i) => {
        const a = (i / 10) * Math.PI * 2;
        return `<circle cx="${50 + Math.cos(a) * 40}" cy="${62 + Math.sin(a) * 14}" r="${3 + (i % 3)}" fill="${c}"/>`;
      },
    ).join("")}</svg>`;
  if (kind === "frame")
    return `<svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="#1a2547"/><circle cx="50" cy="50" r="38" fill="none" stroke="${c}" stroke-width="7"/><circle cx="50" cy="50" r="44" fill="none" stroke="${c}" stroke-width="2" stroke-dasharray="3 6" opacity=".7"/><circle cx="50" cy="12" r="6" fill="${c}"/></svg>`;
  const burst = Array.from({ length: 8 }, (_, i) => {
    const a = (i / 8) * Math.PI * 2;
    return `<path d="M50 50 L${50 + Math.cos(a - 0.15) * 40} ${50 + Math.sin(a - 0.15) * 40} L${50 + Math.cos(a + 0.15) * 40} ${50 + Math.sin(a + 0.15) * 40}Z" fill="${c}" opacity=".75"/>`;
  }).join("");
  return kind === "entrance"
    ? `<svg viewBox="0 0 100 100"><path d="M18 78h64" stroke="${c}" stroke-width="4" stroke-linecap="round"/><path d="M50 14v50M34 40l16 24 16-24" fill="none" stroke="${c}" stroke-width="7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
    : `<svg viewBox="0 0 100 100">${burst}<circle cx="50" cy="50" r="12" fill="#fff8"/></svg>`;
}
const picture = (id: string, c?: CharacterId) =>
  CHAMPION_SKIN_BY_ID[id]
    ? itemPicture(id, c ?? CHAMPION_SKIN_BY_ID[id].champion, `p-${id}`)
    : lookArt(id);

/* Sample player state (not from a server). */
const ME = {
  name: "tester",
  title: "Cragbreaker",
  level: 12,
  fighter: "voltkit" as CharacterId,
  balance: 2340,
  leaves: 1234,
  owned: [
    "voltkit-midnight",
    "voltkit-stormcrown",
    "candy-colours",
    "galaxy-aura",
    "cindrake-ashen",
  ],
  equipped: { voltkit: "voltkit-stormcrown" } as Record<string, string>,
  picks: [
    "cindrake-blue-flame",
    "lumoth-starweaver",
    "mystowl-scholar",
    "galaxy-frame",
  ],
  deal: "cindrake-blue-flame",
  trialWins: { voltkit: 30, lumoth: 4 } as Record<string, number>,
  mastery: { voltkit: 31, cindrake: 7, tidefin: 16, lumoth: 3 } as Record<
    string,
    number
  >,
};
const owns = (id: string) => ME.owned.includes(id);

/* ----------------------------------------------------------------- shell */
const RAIL: [string, string, Parameters<typeof menuIcon>[0], number?][] = [
  ["fighters", "Fighters", "user"],
  ["wardrobe", "Wardrobe", "wardrobe"],
  ["shop", "Shop", "shop"],
  ["raids", "Raids", "bestiary"],
  ["journey", "Journey", "sparkle", 1],
  ["missions", "Missions", "missions", 4],
  ["ranks", "Ranks", "leaderboard"],
  ["friends", "Friends", "friends", 1],
];
function hud() {
  return `<header class="m-hud">
  <button class="m-profile" type="button">${avatar(ME.fighter, undefined, 40)}<span class="m-profile-text"><b>${ME.name}</b><small>${ME.title}</small><span class="ui-bar"><i style="--p:38%"></i></span></span><span class="m-lv ui-num">Lv ${ME.level}</span></button>
  <div class="ui-seg is-display m-scenes"><button aria-pressed="true">Lobby</button><button aria-pressed="false">Plaza</button><button aria-pressed="false">Farm</button></div>
  <div class="m-wallet"><span class="ui-pill"><i class="ui-coin"></i><span class="ui-num">${coins(ME.balance)}</span></span><span class="ui-pill"><i class="m-leaf"></i><span class="ui-num">${coins(ME.leaves)}</span></span><button class="ui-icon-btn" aria-label="Settings">${menuIcon("settings")}</button></div>
</header>`;
}
function rail(active: string) {
  return `<nav class="m-rail">${RAIL.map(
    ([id, label, icon, badge]) =>
      `<button type="button" data-rail="${id}" ${id === active ? 'aria-current="page"' : ""}>${menuIcon(icon)}<span>${label}</span>${badge ? `<i class="ui-badge">${badge}</i>` : ""}</button>`,
  ).join("")}</nav>`;
}
function head(kicker: string, title: string, extra = "", close = true) {
  return `<div class="ui-panel-head"><div class="ui-heading"><span class="ui-kicker">${kicker}</span><h2 class="ui-title">${title}</h2></div>${extra}${close ? `<button class="ui-icon-btn ui-close" aria-label="Back to the Lobby">${menuIcon("cancel")}</button>` : ""}</div>`;
}
const timer = (t: string) => `<span class="ui-timer">${t}</span>`;

/* ----------------------------------------------------------- fitting room */
function stage(
  c: CharacterId,
  skin: string | undefined,
  info: string,
  opts: { aura?: boolean; frame?: boolean } = {},
) {
  return `<section class="m-stage" style="--el:${el(c)}" aria-label="Try-on stage">
  <div class="m-beam"></div><div class="m-pool"></div>
  ${opts.aura ? `<div class="m-aura"><div class="m-aura-ring">${Array.from({ length: 12 }, (_, i) => `<i style="--a:${i * 30}deg"></i>`).join("")}</div></div>` : ""}
  <div class="m-hero">${art(c, skin, skin === "voltkit-stormcrown" ? 2 : 1)}</div>
  <div class="m-stage-top"><span class="m-frame-badge">${avatar(c, undefined, 64)}<small>Portrait frame</small></span><span class="m-fx"><button class="ui-btn is-s">${menuIcon("enter")}Entrance</button><button class="ui-btn is-s">${menuIcon("sparkle")}Victory</button></span></div>
  <div class="m-stage-info">${info}</div>
</section>`;
}
function itemTile(
  id: string,
  opts: { pressed?: boolean; c?: CharacterId; wardrobe?: boolean } = {},
) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  const look = LOOK_ITEM_BY_ID[id];
  const r: Rarity = skin?.rarity ?? look?.rarity ?? "common";
  const name = skin?.name ?? look?.name ?? id;
  const sub = skin
    ? `${CHARACTERS[skin.champion].name} skin`
    : look
      ? `${COLLECTION_NAMES[look.collection]} · ${look.slot === "skin" ? "Colors" : look.slot[0].toUpperCase() + look.slot.slice(1)}`
      : "";
  const equipped = skin && ME.equipped[skin.champion] === id;
  const have = owns(id);
  let foot: string;
  if (equipped)
    foot = `<span class="ui-tile-foot is-ok">${menuIcon("check")}Equipped</span>`;
  else if (have) foot = `<span class="ui-tile-foot is-ok">Owned</span>`;
  else if (skin && r === "mythical") {
    const w = Math.min(MYTHIC_TRIAL_WINS, ME.trialWins[skin.champion] ?? 0);
    foot = `<span class="ui-tile-foot is-trial">Trial ${w}/${MYTHIC_TRIAL_WINS} wins</span>`;
  } else {
    const p = shopPrice(id, ME.owned, ME.deal)!;
    const base = shopPrice(id, ME.owned, null)!;
    foot = `<span class="ui-tile-foot">${price(p, p !== base ? base : undefined)}</span>`;
  }
  const tag =
    opts.wardrobe && !have && !equipped
      ? `<span class="ui-tag">Shop</span>`
      : id === ME.deal
        ? `<span class="ui-tag is-sale">−20%</span>`
        : "";
  const pic = picture(id, opts.c);
  return `<button type="button" class="ui-tile${r === "mythical" ? " is-mythic" : ""}${opts.wardrobe && !have && !equipped ? " is-unowned" : ""}" data-rarity="${r}" aria-pressed="${!!opts.pressed}">${tag}<span class="ui-tile-art">${pic}</span>${rarity(r)}<b class="ui-tile-name">${name}</b><small class="ui-tile-sub">${sub}</small>${foot}</button>`;
}
function fitFoot(id: string, action: string) {
  const skin = CHAMPION_SKIN_BY_ID[id];
  const look = LOOK_ITEM_BY_ID[id];
  const name = skin?.name ?? look?.name ?? id;
  const r = skin?.rarity ?? look?.rarity ?? "common";
  return `<div class="ui-panel-foot"><div class="ui-foot-info"><span class="m-foot-art">${picture(id)}</span><span class="m-foot-text">${rarity(r)}<b class="ui-h">${name}</b><small class="ui-note">${id === ME.deal ? `<s>1,500</s> → 1,200 today · ` : ""}Try-ons are free</small></span></div>${action}</div>`;
}
function shopToday() {
  const deal = CHAMPION_SKIN_BY_ID[ME.deal];
  const dealPrice = shopPrice(ME.deal, ME.owned, ME.deal)!;
  const base = shopPrice(ME.deal, ME.owned, null)!;
  const set = SHOP_BUNDLES[1];
  const setPrice = shopPrice(set.id, ME.owned, null)!;
  const setFull = set.items.reduce((s, i) => s + LOOK_ITEM_BY_ID[i].price, 0);
  return `<button type="button" class="m-deal" data-rarity="${deal.rarity}" aria-pressed="true">
    <span class="m-deal-art">${art(deal.champion, deal.id)}</span>
    <span class="m-deal-text"><span class="m-row">${rarity(deal.rarity)}<span class="ui-tag is-sale">20% off today</span></span><b class="m-deal-name">${deal.name}</b><small class="ui-note">${CHARACTERS[deal.champion].name} skin · ${deal.description}</small><span class="m-deal-price">${price(dealPrice, base)}</span></span>
    <span class="m-deal-timer">${timer("Ends in 7 h 12 m")}</span>
  </button>
  <div class="m-section"><h3 class="ui-h">Daily picks</h3>${timer("New picks in 7 h 12 m")}</div>
  <div class="ui-grid m-picks" style="--cols:3">${ME.picks
    .filter((p) => p !== ME.deal)
    .map((id) => itemTile(id))
    .join("")}</div>
  <div class="m-section"><h3 class="ui-h">Bundles</h3><small class="ui-note">20% off the pieces you don't own</small></div>
  <button type="button" class="m-bundle" data-rarity="epic"><span class="m-bundle-art">${set.items.map((i) => `<span>${lookArt(i)}</span>`).join("")}</span><span class="m-bundle-text"><b class="ui-h">${set.name}</b><small class="ui-note">${set.items.length} pieces for every fighter · 1 owned</small></span><span class="m-bundle-price">${price(setPrice, setFull)}</span></button>
  <div class="m-earn"><b>Earn coins</b><span>Player match win <b>+${COINS.pvpWin}</b> · loss <b>+${COINS.pvpLoss}</b></span><span>Raid clear <b>+${COINS.raidClear[3]}</b></span><span>Missions <b>+40 / 70 / 120</b></span><span class="m-earn-left">Missions left today: <b>${price(310)}</b></span></div>`;
}
function fittingRoom(mode: "shop" | "wardrobe") {
  const tabs =
    mode === "shop"
      ? [["Today", true, "NEW"], ["Skins"], ["Mythic Hall"], ["Collections"]]
      : [
          ["Skin", true],
          ["Colors"],
          ["Aura"],
          ["Entrance"],
          ["Victory"],
          ["Frame"],
        ];
  const tabRow =
    mode === "shop"
      ? `<div class="ui-tabs m-head-tabs" role="tablist">${tabs.map(([t, on, n]) => `<button role="tab" aria-selected="${!!on}">${t}${n ? `<span class="ui-tag is-new">${n}</span>` : ""}</button>`).join("")}</div>`
      : `<span class="ui-note m-hint">Your items · try them on, then Equip</span>`;
  const switcher = `<div class="ui-seg is-display"><button aria-pressed="${mode === "shop"}">Shop</button><button aria-pressed="${mode === "wardrobe"}">Wardrobe</button></div>`;
  let body: string, foot: string, stageHtml: string;
  if (mode === "shop") {
    const deal = CHAMPION_SKIN_BY_ID[ME.deal];
    body = shopToday();
    foot = fitFoot(
      ME.deal,
      `<div class="ui-actions"><button class="ui-btn is-primary">Buy ${price(shopPrice(ME.deal, ME.owned, ME.deal)!)}</button></div>`,
    );
    stageHtml = stage(
      deal.champion,
      deal.id,
      `<span class="m-row">${rarity(deal.rarity)}<span class="ui-note">Trying on</span></span><b class="m-stage-name">${deal.name}</b><small class="ui-note">${CHARACTERS[deal.champion].name} skin</small><span class="m-row"><button class="ui-btn is-s">Hold to compare</button></span>`,
    );
  } else {
    const c = ME.fighter;
    // Owned items only (owner's decision 3); the Shop has the rest.
    const skins = [
      `${c}-original`,
      ...CHAMPION_SKINS.filter((s) => s.champion === c && owns(s.id)).map(
        (s) => s.id,
      ),
    ];
    const more = CHAMPION_SKINS.filter(
      (s) => s.champion === c && !owns(s.id),
    ).length;
    const slots: [string, string, string][] = [
      ["Skin", "Stormcrown", "voltkit-stormcrown"],
      ["Colors", "Candy colors", "candy-colours"],
      ["Aura", "Galaxy aura", "galaxy-aura"],
      ["Entrance", "None", ""],
      ["Victory", "None", ""],
      ["Frame", "None", ""],
    ];
    body = `<div class="ui-chips m-fighters">${ids.map((id) => `<button class="m-fchip" aria-pressed="${id === c}" style="--el:${el(id)}">${avatar(id, undefined, 34)}<span>${CHARACTERS[id].name}</span></button>`).join("")}</div>
    <div class="m-slots" role="tablist" aria-label="Slots">${slots.map(([s, v, id], i) => `<button class="m-slot" role="tab" aria-selected="${i === 0}"><span class="m-slot-art">${id ? picture(id, c) : `<i>—</i>`}</span><small>${s}</small><b class="${id ? "" : "is-none"}">${v}</b></button>`).join("")}</div>
    <div class="m-section"><h3 class="ui-h">Voltkit skins</h3><small class="ui-note">${skins.length} owned</small></div>
    <div class="ui-grid" style="--cols:4">${skins
      .map((id, i) =>
        i === 0
          ? `<button type="button" class="ui-tile" data-rarity="common"><span class="ui-tile-art">${art(c)}</span><span class="ui-rarity" data-rarity="common">Original</span><b class="ui-tile-name">Original look</b><small class="ui-tile-sub">Always yours</small><span class="ui-tile-foot is-ok">Owned</span></button>`
          : itemTile(id, {
              pressed: id === "voltkit-midnight",
            }),
      )
      .join(
        "",
      )}<button type="button" class="ui-tile m-more-tile" data-go="shop"><span class="ui-tile-art">${menuIcon("shop")}</span><span></span><b class="ui-tile-name">More in the Shop</b><small class="ui-tile-sub">${more} more Voltkit skins</small><span class="ui-tile-foot is-dim">Open the Shop →</span></button></div>`;
    foot = `<div class="ui-panel-foot"><div class="ui-foot-info"><span class="m-foot-art">${art(c, "voltkit-midnight")}</span><span class="m-foot-text"><b class="ui-h">Voltkit · 1 change</b><small class="ui-note">Skin: Stormcrown → Midnight</small></span></div><div class="ui-actions"><button class="ui-btn">Revert</button><button class="ui-btn is-ok">${menuIcon("check")}Equip</button></div></div>`;
    stageHtml = stage(
      c,
      "voltkit-midnight",
      `<span class="m-row">${rarity("common")}<span class="ui-note">Trying on</span></span><b class="m-stage-name">Midnight</b><small class="ui-note">Voltkit skin · owned</small><span class="m-row"><button class="ui-btn is-s">Hold to compare</button></span>`,
      { aura: true },
    );
  }
  return `${stageHtml.replace('class="m-stage"', 'class="m-stage m-fit-stage"')}<section class="ui-panel m-fit is-${mode}" aria-label="Shop and Wardrobe"><div class="ui-panel-head m-fit-head">${switcher}${tabRow}<button class="ui-icon-btn ui-close" aria-label="Back to the Lobby">${menuIcon("cancel")}</button></div><div class="ui-panel-body">${body}</div>${foot}</section>`;
}
function confirmModal() {
  const deal = CHAMPION_SKIN_BY_ID[ME.deal];
  const p = shopPrice(ME.deal, ME.owned, ME.deal)!;
  return `<div class="ui-scrim"><div class="ui-modal m-confirm" role="dialog" aria-label="Buy ${deal.name}">
  <div class="m-confirm-art" data-rarity="${deal.rarity}">${art(deal.champion, deal.id)}</div>
  <div class="m-confirm-body"><span class="ui-kicker">Confirm purchase</span><b class="ui-title">${deal.name}</b><span class="m-row">${rarity(deal.rarity)}<span class="ui-note">${CHARACTERS[deal.champion].name} skin</span></span>
  <dl class="m-ledger"><dt>Price</dt><dd>${price(p, 1500)}</dd><dt>Your coins</dt><dd>${price(ME.balance)}</dd><dt>After</dt><dd>${price(ME.balance - p)}</dd></dl>
  <label class="m-check"><input type="checkbox" checked> Wear it now</label></div>
  <div class="m-confirm-acts ui-actions"><button class="ui-btn">Cancel</button><button class="ui-btn is-primary">Buy ${price(p)}</button></div>
</div></div>`;
}

/* --------------------------------------------------------------- roster */
const range = (c: CharacterId) =>
  ((CHARACTERS[c].basic as { range?: number }).range ?? 0) > 300
    ? "Ranged"
    : "Close";
function masteryRing(c: CharacterId) {
  const m = ME.mastery[c] ?? 0;
  const tiers = [
    ["B", 5, "#d69a6a"],
    ["S", 15, "#cfd8e6"],
    ["G", 30, "#ffd166"],
    ["C", 60, "#9ff3ff"],
  ] as const;
  const got = [...tiers].reverse().find((t) => m >= t[1]);
  const next = tiers.find((t) => m < t[1]);
  const p = next ? Math.round((m / next[1]) * 100) : 100;
  return `<span class="ui-ring m-mastery" style="--p:${p};--ring:${got?.[2] ?? "#6f7d99"};--size:34px" title="Mastery"><b class="ui-num">${got?.[0] ?? "–"}</b></span>`;
}
function roster() {
  const elements = [...new Set(ids.map((c) => CHARACTERS[c].element))];
  return `<section class="ui-panel m-roster">${head("Your roster · 8 fighters", "Fighters", `<div class="m-tools"><div class="ui-chips"><button class="ui-chip" aria-pressed="true">All</button>${elements.map((e) => `<button class="ui-chip" aria-label="${e}" style="color:var(--el-${e.toLowerCase()})">${elementIcon(e)}</button>`).join("")}</div><div class="ui-seg"><button aria-pressed="true">Any range</button><button aria-pressed="false">Ranged</button><button aria-pressed="false">Close</button></div><label class="m-sort">Sort <select><option>Mastery</option><option>Name</option><option>Element</option></select></label></div>`)}
  <div class="ui-panel-body"><div class="ui-grid m-cards" style="--cols:4">${[
    ...ids,
  ]
    .sort((a, b) => (ME.mastery[b] ?? 0) - (ME.mastery[a] ?? 0))
    .map((c) => {
      const owned = CHAMPION_SKINS.filter(
        (s) => s.champion === c && owns(s.id),
      ).length;
      return `<button type="button" class="m-card" style="--el:${el(c)}" aria-pressed="${c === ME.fighter}">
      <span class="m-card-top">${elementPill(c)}${masteryRing(c)}</span>
      <span class="m-card-art">${art(c, ME.equipped[c])}</span>
      <span class="m-card-text"><b class="m-card-name">${CHARACTERS[c].name}</b><small>${CHARACTERS[c].role}</small></span>
      <span class="m-card-foot"><span class="ui-tag">${range(c)}</span><span class="ui-note">${owned + 1}/8 looks</span>${c === ME.fighter ? `<span class="ui-tag is-ok">${menuIcon("check")}Playing</span>` : ""}</span>
    </button>`;
    })
    .join("")}</div></div>
  <div class="ui-panel-foot"><div class="ui-foot-info">${avatar(ME.fighter, undefined, 44)}<span class="m-foot-text"><small class="ui-note">You play as</small><b class="ui-h">Voltkit</b></span></div><div class="ui-actions"><button class="ui-btn">Details</button><button class="ui-btn is-primary">Select</button></div></div></section>`;
}
function fighterDetail() {
  const c: CharacterId = "cindrake";
  const f = CHARACTERS[c];
  const keys = ["Q", "E", "R", "F"];
  const stat = (label: string, v: number, max: number) =>
    `<div class="m-stat"><span>${label}</span><span class="ui-bar is-thick"><i style="--p:${Math.round((v / max) * 100)}%;--bar:${el(c)}"></i></span><b class="ui-num">${v}</b></div>`;
  const perks = Object.entries(RAID_BOSS_PERKS).filter(([, p]) => p?.[c]);
  const info = `<span class="m-row">${elementPill(c)}<span class="ui-tag">${range(c)}</span></span><b class="m-stage-name">${f.name}</b><small class="ui-note">${f.role}</small><div class="m-stats">${stat("Health", f.health, 200)}${stat("Speed", f.speed, 300)}${stat("Basic DPS", Math.round(f.basic.damage / ((f.basic as { interval?: number }).interval ?? 1)), 40)}</div>`;
  return `${stage(c, undefined, info)
    .replace('class="m-stage"', 'class="m-stage m-detail-stage"')
    .replace(
      /<div class="m-stage-top">[\s\S]*?<\/span><\/div>/,
      `<div class="m-stage-top"><span class="m-counter ui-num">02<small>/08</small></span>${masteryRing(c)}</div><button class="ui-icon-btn m-prev" aria-label="Previous fighter">‹</button><button class="ui-icon-btn m-next" aria-label="Next fighter">›</button>`,
    )}
  <section class="ui-panel m-fit m-detail"><div class="ui-panel-head"><button class="ui-btn is-s">‹ Roster</button><span class="ui-note m-hint">${f.description}</span><button class="ui-icon-btn ui-close" aria-label="Back to the Lobby">${menuIcon("cancel")}</button></div>
  <div class="ui-tabs"><button aria-selected="false">Overview</button><button aria-selected="true">Skills</button><button aria-selected="false">Skins <span class="ui-tag">1/8</span></button></div>
  <div class="ui-panel-body m-detail-body">
    <div class="m-skill-preview"><div class="m-skill-video">${abilityIcon(f.skills[0].name)}<span class="ui-tag">▶ Playing</span></div><div class="m-skill-preview-text"><span class="ui-kicker">Q · ${f.skills[0].cooldown}s cooldown</span><b class="ui-h">${f.skills[0].name}</b><p class="ui-note">${f.skills[0].description}</p></div></div>
    <div class="m-skills">${[...f.skills.map((s, i) => [keys[i], s, i === 3 ? "Ultimate" : `${s.cooldown}s`] as const), ["LMB", f.basic, "Basic"] as const].map(([k, s, cd], i) => `<button class="m-skill" aria-pressed="${i === 0}"><span class="m-key">${k}</span><span class="m-skill-icon">${abilityIcon(s.name)}</span><span class="m-skill-text"><b>${s.name}</b><small>${s.description}</small></span><span class="m-cd ui-num">${cd}</span></button>`).join("")}</div>
    ${
      perks.length
        ? `<div class="m-tricks"><span class="ui-kicker">Raid tricks</span>${perks
            .slice(0, 2)
            .map(
              ([b, p]) =>
                `<span class="m-trick"><b>${RAID_BOSSES[b as RaidBossId].name}</b> · ${p![c]!.skill}: ${p![c]!.text}</span>`,
            )
            .join("")}</div>`
        : ""
    }
  </div>
  <div class="ui-panel-foot"><div class="ui-foot-info"><span class="m-foot-text"><small class="ui-note">Mastery · Silver in 8 matches</small><span class="ui-bar"><i style="--p:47%;--bar:#d69a6a"></i></span></span></div><div class="ui-actions"><button class="ui-btn">Try skins</button><button class="ui-btn is-primary">Select</button></div></div></section>`;
}

/* --------------------------------------------------- missions & journey */
const MISSIONS = [
  ["Play 2 matches", "easy", 2, 2, 40, true],
  ["Use 30 skills", "easy", 18, 30, 40, false],
  ["Win a match", "medium", 1, 1, 70, true],
  ["Win as Cindrake or Lumoth", "medium", 0, 1, 70, false],
  ["Beat 3 Hard bots", "hard", 1, 3, 120, false],
  ["Clear a raid with no downs", "hard", 0, 1, 120, false],
] as const;
function missions() {
  const done = MISSIONS.filter((m) => m[5]).length;
  const rows = MISSIONS.map(
    ([t, tier, n, max, co, ok]) =>
      `<div class="m-mission${ok ? " is-done" : ""}" data-tier="${tier}"><div class="m-mission-main"><span class="m-row m-mission-top"><b>${t}</b><span class="ui-num">${Math.min(n, max)}/${max}</span></span><span class="ui-bar"><i style="--p:${(Math.min(n, max) / max) * 100}%;--bar:${ok ? "var(--ui-ok)" : "var(--tier)"}"></i></span><small class="m-mission-pay"><span class="m-diff">${tier}</span>${price(co)}<span>· +50 XP</span></small></div>${ok ? `<span class="m-paid">${menuIcon("check")}Paid</span>` : `<button class="ui-icon-btn m-swap" aria-label="Change this mission">${menuIcon("shuffle")}</button>`}</div>`,
  ).join("");
  const streak = 3;
  return `<section class="ui-panel ui-sheet m-missions">${head(`Daily · new in 7 h 12 m`, "Missions")}
  <div class="ui-panel-body"><div class="m-mission-sum"><span><b>${done}/6</b> done · all six: ${price(COINS.allMissionsBonus)}</span><span class="ui-note">5 changes left</span></div>${rows}
  <div class="m-streak"><span><b>Streak</b> · day ${streak}</span><span class="m-streak-dots">${Array.from({ length: 7 }, (_, k) => `<i class="${k < streak ? "is-on" : ""}${k === 6 ? " is-pay" : ""}">${k === 6 ? `+${COINS.streakBonus}` : ""}</i>`).join("")}</span></div>
  <p class="ui-note">Coins and XP are added the moment a mission is done.</p></div></section>`;
}
function journey() {
  const season = "2026-12";
  const theme = SEASON_THEMES[seasonTheme(season)];
  const rules = SEASON_RULES;
  const tier = 7;
  const road = Array.from({ length: rules.tiers }, (_, k) => {
    const t = k + 1;
    const rw = seasonReward(t, season, rules);
    const item = rw.item ? JOURNEY_ITEM_BY_ID[rw.item] : null;
    const st = t < tier ? "got" : t === tier ? "cur" : "lock";
    return `<div class="m-tier is-${st}${item ? " is-big" : ""}"><small class="ui-num">${t}</small><span class="m-tier-art">${item ? lookArt(rw.item!, item.slot === "colors" ? "skin" : item.slot, seasonTheme(season)) : `<i class="ui-coin"></i>`}</span><em>${item ? `Season ${item.slot === "victory" ? "finale" : item.slot}` : `${rw.coins} coins`}</em>${st === "got" ? `<b class="m-tick">${menuIcon("check")}</b>` : ""}</div>`;
  }).join("");
  const goals = WEEKLY_GOALS.map((g, i) => {
    const n = [3, 50, 1, 0][i];
    const ok = n >= g.target;
    return `<div class="m-goal${ok ? " is-done" : ""}"><span class="m-row"><b>${g.text}</b><span class="ui-num">${n}/${g.target}</span></span><span class="ui-bar"><i style="--p:${(n / g.target) * 100}%;--bar:${ok ? "var(--ui-ok)" : theme.color}"></i></span><small class="ui-note">${ok ? "Paid · +250 season XP" : "+250 season XP"}</small></div>`;
  }).join("");
  const upcoming = LEVEL_MILESTONES.filter((m) => m.level > ME.level).slice(
    0,
    4,
  );
  const next = upcoming[0];
  const lvlArt = (m: (typeof LEVEL_MILESTONES)[number]) => {
    const it = m.item ? JOURNEY_ITEM_BY_ID[m.item] : null;
    return it
      ? lookArt(m.item!, it.slot === "colors" ? "skin" : it.slot, "aurora")
      : `<svg viewBox="0 0 100 100"><path d="M20 70h60l-6-34-14 14-10-22-10 22-14-14z" fill="#ffd65b"/></svg>`;
  };
  return `<section class="ui-panel m-journey" style="--season:${theme.color};--season-2:${theme.accent}">${head(`Season · ${theme.name}`, "Journey", `<div class="ui-tabs m-head-tabs"><button aria-selected="true">Season</button><button aria-selected="false">Levels</button><button aria-selected="false">Weekly arcade</button></div>`)}
  <div class="ui-panel-body">
    <div class="m-season"><span class="m-level"><b class="ui-num">${ME.level}</b><small>Level</small></span><div class="m-season-main"><span class="m-row"><b class="ui-h">${theme.name}</b><span class="ui-num">Tier ${tier} / ${rules.tiers}</span></span><span class="ui-bar is-thick"><i style="--p:45%;--bar:linear-gradient(90deg,var(--season),var(--season-2))"></i></span><span class="m-row"><small class="ui-note">540 / ${coins(rules.tierXp)} XP to tier ${tier + 1}</small>${timer("Ends in 28 d 6 h")}</span></div><div class="m-spark"><span class="ui-kicker">Daily Spark</span><b class="ui-num">380 XP</b><small class="ui-note">left today at ×2</small></div></div>
    <div class="m-section"><h3 class="ui-h">Season road</h3><small class="ui-note">${rules.tiers} tiers · ${SEASON_RULES.itemTiers.length} cosmetics · every tier pays 50 coins</small></div>
    <div class="m-road">${road}</div>
    <div class="m-two"><div><div class="m-section"><h3 class="ui-h">Weekly goals</h3>${timer("Resets in 4 d 7 h")}</div><div class="m-goals">${goals}</div></div>
    <div class="m-nextlvl"><div class="m-section"><h3 class="ui-h">Level road</h3><small class="ui-note">+${levelCoins(next.level)} coins every level</small></div><div class="m-lvl-now"><span class="m-row"><b>Level ${ME.level} → ${ME.level + 1}</b><span class="ui-num">125 / 375 XP</span></span><span class="ui-bar"><i style="--p:33%"></i></span></div>${upcoming.map((m, i) => `<div class="m-lvl${i === 0 ? " is-next" : ""}"><span class="m-lvl-art">${lvlArt(m)}</span><span><small class="ui-note">Level ${m.level}</small><b>${m.item ? JOURNEY_ITEM_BY_ID[m.item].name : `Title: ${m.title}`}</b></span></div>`).join("")}</div></div>
  </div></section>`;
}

/* ---------------------------------------------------------------- raids */
const CLEARS: Partial<Record<RaidBossId, number>> = {
  grumblecrag: 3,
  emberwing: 1,
  tidewyrm: 0,
};
const stars = (n: number) =>
  `<span class="m-stars" aria-label="${n} of 3">${"★".repeat(n)}<i>${"★".repeat(3 - n)}</i></span>`;
function raidHall() {
  return `<section class="ui-panel m-raids">${head("Raid Hall · 7 bosses · solo or up to 4", "Raids", `<div class="ui-chips"><button class="ui-chip" aria-pressed="true">All</button><button class="ui-chip">Not cleared</button><button class="ui-chip">★</button><button class="ui-chip">★★</button><button class="ui-chip">★★★</button></div>`)}
  <div class="ui-panel-body"><div class="ui-grid m-bosses" style="--cols:4">${RAID_BOSS_ORDER.map(
    (b, i) => {
      const info = RAID_BOSSES[b];
      const cl = CLEARS[b] ?? 0;
      const perks = Object.keys(RAID_BOSS_PERKS[b] ?? {}).slice(
        0,
        3,
      ) as CharacterId[];
      const locked = false;
      const total = RAID_REWARDS.filter((r) => r.boss === b).length;
      const earned = cl ? Math.min(total, cl + 1) : 0;
      return `<button type="button" class="m-boss${locked ? " is-locked" : ""}" style="--boss:${info.color}" aria-pressed="${b === "grumblecrag"}">
    <span class="m-boss-art"><img src="${RAID_SPLASH[b].thumb}" alt="">${locked ? `<span class="ui-tag is-lock">${menuIcon("leave")}Clear Emberwing</span>` : cl ? `<span class="ui-tag is-ok">${cl} clear${cl > 1 ? "s" : ""}</span>` : `<span class="ui-tag is-new">New</span>`}</span>
    <span class="m-boss-text"><span class="m-row"><b class="ui-h">${info.name}</b>${stars(info.stars)}</span><small class="ui-note">${info.element} · ${info.signature}</small></span>
    <span class="m-boss-foot"><span class="m-recs" title="Fighters with a trick here">${perks.map((c) => avatar(c, undefined, 26)).join("")}</span><span class="m-boss-reward"><span class="ui-note">${earned} / ${total} rewards</span></span></span>
    </button>`;
    },
  ).join(
    "",
  )}<button type="button" class="m-boss m-practice"><span class="m-practice-icon">${menuIcon("target")}</span><span class="m-boss-text"><b class="ui-h">Attack practice</b><small class="ui-note">Drill any boss attack on its own. Nothing to lose.</small></span><span class="ui-btn is-s">Choose an attack</span></button></div></div></section>`;
}
function raidBoss() {
  const b: RaidBossId = "grumblecrag";
  const info = RAID_BOSSES[b];
  const perks = Object.entries(RAID_BOSS_PERKS[b] ?? {}) as [
    CharacterId,
    { skill: string; text: string },
  ][];
  return `<section class="m-stage m-boss-stage" style="--el:${info.color}"><img class="m-boss-hero" src="${RAID_SPLASH[b].hero}" alt=""><div class="m-stage-info"><span class="m-row"><span class="ui-element" style="--el:var(--el-earth)">${elementIcon("earth")}Earth</span>${stars(info.stars)}</span><b class="m-stage-name">${info.name}</b><small class="ui-note">${info.epithet} · ${info.signature}</small></div></section>
  <section class="ui-panel m-fit m-boss-panel"><div class="ui-panel-head"><button class="ui-btn is-s">‹ Raid Hall</button><span class="ui-note m-hint">${info.blurb}</span><button class="ui-icon-btn ui-close" aria-label="Back to the Lobby">${menuIcon("cancel")}</button></div>
  <div class="ui-tabs"><button aria-selected="true">Party</button><button aria-selected="false">Attacks · practice</button><button aria-selected="false">Rewards</button><button aria-selected="false">Guide</button></div>
  <div class="ui-panel-body">
    <div class="m-party">${[
      ["tester", "voltkit", "You · host"],
      ["Kai", "cindrake", "Ready"],
    ]
      .map(
        ([n, c, s]) =>
          `<div class="m-seat">${avatar(c as CharacterId, "online", 52)}<b>${n}</b><small class="ui-note">${s}</small></div>`,
      )
      .join(
        "",
      )}${[1, 2].map(() => `<button class="m-seat is-open"><span class="m-plus">+</span><b>Invite</b><small class="ui-note">Open seat</small></button>`).join("")}</div>
    <div class="m-invites"><span class="ui-kicker">Invite</span>${[
      ["Rae", "tidefin", "plaza", "In the Plaza"],
      ["Mina", "lumoth", "busy", "In a match · back soon"],
    ]
      .map(
        ([n, c, st, sub]) =>
          `<div class="ui-row">${avatar(c as CharacterId, st, 36)}<span class="ui-row-main"><b>${n}</b><small>${sub}</small></span><button class="ui-btn is-s${st === "busy" ? "" : " is-primary"}"${st === "busy" ? " disabled" : ""}>${menuIcon("create")}Invite</button></div>`,
      )
      .join("")}</div>
    <div class="m-section"><h3 class="ui-h">Good picks here</h3><small class="ui-note">Fighters with a trick against ${info.name}</small></div>
    <div class="m-picks-row">${perks
      .slice(0, 3)
      .map(
        ([c, p]) =>
          `<div class="m-pick">${avatar(c, undefined, 40)}<span><b>${CHARACTERS[c].name}</b><small class="ui-note">${p.skill}: ${p.text}</small></span></div>`,
      )
      .join("")}</div>
    <div class="m-section"><h3 class="ui-h">Next rewards</h3><small class="ui-note">3 clears so far</small></div>
    <div class="m-rewards">${[
      ["Cragbound colors", "3 / 5 clears", 60, "rare"],
      ["Cragstone skin", "3 / 10 clears", 30, "legendary"],
      ["Mountain aura", "Clear with no downs", 0, "legendary"],
    ]
      .map(
        ([n, s, p, r]) =>
          `<div class="m-reward" data-rarity="${r}"><span class="m-reward-art">${elementIcon("earth")}</span><span class="m-reward-text"><b>${n}</b><small class="ui-note">${s}</small><span class="ui-bar"><i style="--p:${p}%;--bar:var(--r)"></i></span></span></div>`,
      )
      .join("")}</div>
  </div>
  <div class="ui-panel-foot"><div class="ui-foot-info"><div class="ui-seg"><button aria-pressed="false">Solo</button><button aria-pressed="true">With party</button></div><small class="ui-note">2 of 4 seats · rewards for everyone who clears</small></div><div class="ui-actions"><button class="ui-btn">${menuIcon("target")}Practice</button><button class="ui-btn is-primary">Start raid</button></div></div></section>`;
}

/* -------------------------------------------------- ranks and leaderboard */
function ranks() {
  const names = [
    "Aria",
    "Bram",
    "Cleo",
    "Dax",
    "Esme",
    "Finn",
    "Gus",
    "Hana",
    "Ivo",
    "Jude",
    "Koa",
    "Lior",
    "Mae",
    "Nico",
  ];
  const rows = names.map((n, i) => ({
    rank: i + 1,
    name: n,
    rating: 1620 - i * 22,
    wins: 60 - i * 3,
    losses: 20 + i,
    c: ids[i % 8],
  }));
  const rankOf = (r: number) => [...RANKS].reverse().find((x) => r >= x.min)!;
  const me = {
    rank: 23,
    name: ME.name,
    rating: 1110,
    wins: 36,
    losses: 26,
    c: ME.fighter,
  };
  const row = (r: typeof me, mine = false) => {
    const rk = rankOf(r.rating);
    return `<div class="m-lb-row${mine ? " is-me" : ""}${r.rank <= 3 ? ` is-top is-top-${r.rank}` : ""}"><span class="m-lb-rank ui-num">${r.rank <= 3 ? `<i class="m-medal">${r.rank}</i>` : r.rank}</span>${avatar(r.c, undefined, 36)}<span class="m-lb-name"><b>${r.name}${mine ? ' <span class="ui-tag is-new">You</span>' : ""}</b><small style="color:${rk.color}">${rk.name}</small></span><span class="ui-num m-lb-rating">${r.rating}</span><span class="m-lb-wl">${r.wins}–${r.losses}</span></div>`;
  };
  const cur = rankOf(1110);
  const nxt = RANKS[RANKS.findIndex((x) => x.name === cur.name) + 1];
  return `<section class="ui-panel m-ranks">${head("Season · November 2026 · ends in 27 d", "Ranks", `<div class="ui-seg"><button aria-pressed="true">Everyone</button><button aria-pressed="false">Friends</button></div>`)}
  <div class="ui-panel-body m-ranks-body">
    <aside class="m-myrank" style="--rank:${cur.color}"><span class="m-tier-badge"><svg viewBox="0 0 100 110"><path d="M50 4 94 26v38c0 24-20 38-44 44C26 102 6 88 6 64V26Z" fill="color-mix(in srgb,var(--rank) 30%,#121a33)" stroke="var(--rank)" stroke-width="5"/><path d="M50 30 58 46 76 48 63 60 66 78 50 69 34 78 37 60 24 48 42 46Z" fill="var(--rank)"/></svg></span><b class="ui-title" style="color:var(--rank)">${cur.name}</b><span class="ui-num m-rating">1110 <small>rating</small></span><span class="ui-bar is-thick"><i style="--p:${((1110 - cur.min) / (nxt.min - cur.min)) * 100}%;--bar:var(--rank)"></i></span><small class="ui-note">${nxt.min - 1110} more for ${nxt.name} · best 1140</small>
    <ol class="m-ladder">${[...RANKS]
      .reverse()
      .map(
        (r) =>
          `<li class="${r.name === cur.name ? "is-cur" : ""}" style="--rank:${r.color}"><i></i><span>${r.name}</span><small class="ui-num">${r.min}</small></li>`,
      )
      .join("")}</ol></aside>
    <div class="m-lb"><div class="m-lb-head"><span>#</span><span></span><span>Player</span><span>Rating</span><span>W–L</span></div><div class="m-lb-list">${rows.map((r) => row(r)).join("")}</div>${row(me, true).replace("m-lb-row", "m-lb-row m-lb-pinned")}</div>
  </div></section>`;
}

/* -------------------------------------------------------------- friends */
function friends() {
  const list: [string, CharacterId, string, string, string][] = [
    ["Kai", "cindrake", "online", "In the Lobby", "invite"],
    ["Mina", "lumoth", "busy", "In a 2v2 · 2–1", "watch"],
    ["Rae", "tidefin", "plaza", "In the Plaza", "invite"],
    ["Juniper", "terradon", "away", "Online 1 h ago", ""],
    ["Oskar", "mystowl", "away", "Online yesterday", ""],
  ];
  const act = (a: string) =>
    a === "invite"
      ? `<button class="ui-btn is-s is-primary m-inv">${menuIcon("create")}Invite</button>`
      : a === "watch"
        ? `<button class="ui-btn is-s">${menuIcon("watch")}Watch</button>`
        : "";
  return `<section class="ui-panel ui-sheet m-friends">${head("3 online · party 1 / 4", "Friends", `<button class="ui-icon-btn" aria-label="Add a friend">${menuIcon("create")}</button>`)}
  <div class="ui-tabs"><button aria-selected="true">Friends <span class="ui-tag">6</span></button><button aria-selected="false">Requests <span class="ui-badge m-inline-badge">1</span></button><button aria-selected="false">Recent</button></div>
  <div class="ui-panel-body">
    <div class="m-request ui-row">${avatar("auralynx", undefined, 40)}<span class="ui-row-main"><b>Pip</b><small>wants to be friends</small></span><span class="ui-row-acts"><button class="ui-btn is-s">Decline</button><button class="ui-btn is-s is-ok">Accept</button></span></div>
    <span class="ui-kicker">Online · 3</span>
    ${list
      .slice(0, 3)
      .map(
        ([n, c, st, s, a]) =>
          `<div class="ui-row">${avatar(c, st, 44)}<span class="ui-row-main"><b>${n}</b><small>${s}</small></span><span class="ui-row-acts">${act(a)}<button class="ui-icon-btn m-more" aria-label="More">${menuIcon("more")}</button></span></div>`,
      )
      .join("")}
    <span class="ui-kicker m-dim-kicker">Offline · 2</span>
    ${list
      .slice(3)
      .map(
        ([n, c, st, s]) =>
          `<div class="ui-row is-offline">${avatar(c, st, 44)}<span class="ui-row-main"><b>${n}</b><small>${s}</small></span><span class="ui-row-acts"><button class="ui-icon-btn m-more" aria-label="More">${menuIcon("more")}</button></span></div>`,
      )
      .join("")}
    <div class="m-code"><span><small class="ui-note">Your friend code</small><b class="ui-num">A1B2 C3D4</b></span><button class="ui-btn is-s">${menuIcon("copy")}Copy</button><button class="ui-btn is-s">${menuIcon("share")}Share</button></div>
  </div></section>`;
}

/* --------------------------------------------------------------- profile */
function profile() {
  const tiles: [string, string][] = [
    ["31", "Matches"],
    ["20", "Wins"],
    ["65%", "Win rate"],
    ["4", "Raid clears"],
  ];
  const titles = [
    ["No title", false],
    ["Cragbreaker", true],
    ["Rising Spark", false],
    ["Pupil", false],
  ] as const;
  return `<section class="ui-panel m-profile-panel">${head("Player card", ME.name, `<button class="ui-btn is-s">${menuIcon("share")}Share card</button>`)}
  <div class="ui-panel-body m-profile-body">
    <aside class="m-card-big" style="--el:${el(ME.fighter)}"><span class="m-card-big-art">${art(ME.fighter, ME.equipped.voltkit, 2)}</span><span class="m-card-big-text"><small class="ui-kicker" style="color:#d9b98a">${ME.title}</small><b class="ui-title">${ME.name}</b><span class="m-row"><span class="ui-tag is-new">Lv ${ME.level}</span><span class="ui-tag" style="color:#65d38a">Pupil · 1000</span><span class="ui-tag">Gold Voltkit</span></span></span></aside>
    <div class="m-profile-main">
      <div class="m-tiles">${tiles.map(([v, l]) => `<div class="m-tile"><b class="ui-num">${v}</b><small class="ui-note">${l}</small></div>`).join("")}</div>
      <div class="m-section"><h3 class="ui-h">Title</h3><small class="ui-note">Tap to wear it · saved at once</small></div>
      <div class="ui-chips m-titles">${titles.map(([t, on]) => `<button class="ui-chip" aria-pressed="${on}">${on ? menuIcon("check") : ""}${t}</button>`).join("")}</div>
      <div class="m-section"><h3 class="ui-h">Fighter mastery</h3><small class="ui-note">Badges for matches played</small></div>
      <div class="m-mastery-row">${ids.map((c) => `<span class="m-mastery-chip" style="--el:${el(c)}">${avatar(c, undefined, 36)}${masteryRing(c)}</span>`).join("")}</div>
      <div class="m-two-even"><div class="m-mini"><span class="ui-kicker">Journey</span><span class="m-row"><b>Level ${ME.level}</b><span class="ui-note">Tier 7 / 30 · ${SEASON_THEMES[seasonTheme("2026-12")].name}</span></span><span class="ui-bar"><i style="--p:33%"></i></span></div><div class="m-mini"><span class="ui-kicker">Ranked</span><span class="m-row"><b style="color:#65d38a">Pupil · 1000</b><span class="ui-note">5 placement matches left</span></span><span class="ui-bar"><i style="--p:0%;--bar:#65d38a"></i></span></div></div>
      <div class="m-section"><h3 class="ui-h">Raid trophies</h3><small class="ui-note">Clears per boss</small></div>
      <div class="m-trophies">${RAID_BOSS_ORDER.map((b) => `<span class="m-trophy${CLEARS[b] ? "" : " is-none"}"><img src="${RAID_SPLASH[b].thumb}" alt=""><b class="ui-num">${CLEARS[b] ?? 0}</b></span>`).join("")}</div>
      <div class="m-links"><button class="ui-btn">${menuIcon("leaderboard")}Ranks</button><button class="ui-btn">${menuIcon("sparkle")}Journey</button><button class="ui-btn">${menuIcon("bestiary")}Raid rewards</button></div>
    </div>
  </div></section>`;
}

/* --------------------------------------------------------------- render */
const SCREENS: Record<string, [string, () => string]> = {
  shop: ["shop", () => fittingRoom("shop")],
  confirm: ["shop", () => fittingRoom("shop") + confirmModal()],
  wardrobe: ["wardrobe", () => fittingRoom("wardrobe")],
  roster: ["fighters", roster],
  fighter: ["fighters", fighterDetail],
  missions: ["missions", missions],
  journey: ["journey", journey],
  raids: ["raids", raidHall],
  boss: ["raids", raidBoss],
  ranks: ["ranks", ranks],
  friends: ["friends", friends],
  profile: ["", profile],
};
SCREENS.lobby = ["", () => ""];
function draw() {
  const [active, render] = SCREENS[screen] ?? SCREENS.lobby;
  const lobbyBehind = ["lobby", "missions", "friends"].includes(screen);
  document.getElementById("app")!.innerHTML =
    `<div class="ui m-game${lobbyBehind ? " has-lobby" : ""}" data-screen="${screen}">
  <div class="m-backdrop"></div>
  ${lobbyBehind ? `<div class="m-lobby-hint"><div class="m-lobby-fighter">${art(ME.fighter, ME.equipped.voltkit, 2)}</div><div class="m-play"><span class="m-mode"><b>1v1 Duel</b><small>Private room · best of five</small></span><button class="ui-btn is-primary m-playbtn">▶ Play</button></div></div>` : ""}
  ${hud()}${rail(active)}${render()}
</div>`;
  // Tell a demo frame around this page which screen is showing.
  parent?.postMessage({ mockupScreen: screen }, "*");
}
function go(next: string) {
  screen = next;
  draw();
}
/** Clicks that move between screens, as they would in the game. */
const RAIL_TO: Record<string, string> = {
  fighters: "roster",
  wardrobe: "wardrobe",
  shop: "shop",
  raids: "raids",
  journey: "journey",
  missions: "missions",
  ranks: "ranks",
  friends: "friends",
};
document.addEventListener("click", (event) => {
  const t = event.target as Element;
  const hit = (sel: string) => t.closest(sel);
  const go1 = hit("[data-go]") as HTMLElement | null;
  if (go1) return go(go1.dataset.go!);
  const railButton = hit(".m-rail button") as HTMLElement | null;
  if (railButton) return go(RAIL_TO[railButton.dataset.rail!] ?? "lobby");
  if (hit(".m-profile")) return go("profile");
  if (hit(".ui-close")) return go("lobby");
  if (hit(".ui-scrim .ui-btn")) return go("shop");
  if (hit(".m-fit .ui-seg button")) {
    const label = (t.closest("button") as HTMLElement).textContent!.trim();
    return go(label === "Wardrobe" ? "wardrobe" : "shop");
  }
  if (hit(".m-fit.is-shop .ui-actions .is-primary")) return go("confirm");
  if (hit(".m-card") || hit(".m-roster .ui-actions button"))
    return go("fighter");
  if (hit(".m-detail .ui-panel-head .ui-btn")) return go("roster");
  if (hit(".m-detail .ui-actions button:first-child")) return go("wardrobe");
  if (hit(".m-boss:not(.m-practice)")) return go("boss");
  if (hit(".m-boss-panel .ui-panel-head .ui-btn")) return go("raids");
  if (hit(".m-links button")) {
    const label = (t.closest("button") as HTMLElement)
      .textContent!.trim()
      .toLowerCase();
    return go(
      label.includes("ranks")
        ? "ranks"
        : label.includes("journey")
          ? "journey"
          : "raids",
    );
  }
});
window.addEventListener("hashchange", () => {
  if (fromHash()) go(fromHash());
});
draw();
/** The phone's Dynamic Island and home bar, simulated (?island or #…-island). */
function applyIsland(on: boolean) {
  const s = document.documentElement.style;
  for (const [side, px] of [
    ["left", 59],
    ["right", 59],
    ["bottom", 21],
  ] as const)
    if (on) s.setProperty(`--safe-${side}`, `${px}px`);
    else s.removeProperty(`--safe-${side}`);
  document.getElementById("island-sim")?.remove();
  if (on)
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="island-sim"><div style="position:fixed;left:11px;top:50%;width:37px;height:126px;margin-top:-63px;border-radius:19px;background:#000;z-index:99"></div><div style="position:fixed;left:50%;bottom:8px;width:140px;height:5px;margin-left:-70px;border-radius:3px;background:#ffffffc0;z-index:99"></div></div>`,
    );
}
applyIsland(q.has("island") || location.hash.endsWith("-island"));
window.addEventListener("hashchange", () =>
  applyIsland(q.has("island") || location.hash.endsWith("-island")),
);
(window as unknown as { __ready: boolean }).__ready = true;

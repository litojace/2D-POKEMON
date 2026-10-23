import { CHARACTERS, type CharacterId } from "@arena/shared";
import { masteryTier } from "../../../packages/shared/src/accounts";
import {
  playerLevel,
  SEASON_TIER_XP,
  SEASON_TIERS,
  seasonTheme,
  SEASON_THEMES,
} from "../../../packages/shared/src/journey";
import type { Economy } from "../../../packages/shared/src/shop";
import type { RaidLoadout } from "../../../packages/shared/src/raid";
import { masteryMatches } from "./fighter-selection";
import { fighterArt, scopeIds, withSoftGround } from "./fighter-art";
import { fighterPack } from "./animation/pack-config";
import { elementIcon } from "./element-icons";
import { menuIcon } from "./menu-icons";
import { portraitCosmetics } from "./portraits";
import { withAura } from "./trait-effects";

export type HomeMode = "duel" | "teams" | "ffa" | "raid";
export const HOME_MODES = [
  ["duel", "1v1 Duel", "Private room · best of five"],
  ["teams", "2v2 Teams", "Private room · best of five"],
  ["ffa", "Free-for-all", "Private room · 3–4 players"],
  ["raid", "Boss Raid", "Choose a boss · 1–4 players"],
] as const;

export function lastHomeFighter(): CharacterId {
  try {
    const id = localStorage.getItem("arena-featured-fighter");
    if (id && Object.hasOwn(CHARACTERS, id)) return id as CharacterId;
  } catch {
    /* Optional preference. */
  }
  return "voltkit";
}
export function rememberHomeFighter(id: CharacterId) {
  try {
    localStorage.setItem("arena-featured-fighter", id);
  } catch {
    /* Optional preference. */
  }
}
export function homeElement(id: CharacterId) {
  return `var(--el-${CHARACTERS[id].element.toLowerCase()})`;
}
export function homeFeature(
  id: CharacterId,
  economy?: Economy,
  look?: RaidLoadout,
) {
  const c = CHARACTERS[id],
    tier = masteryTier(masteryMatches(id));
  const pack = fighterPack(id);
  // Leave room for tall crests and the animated idle above the full-body crop.
  // Keep this presentation frame separate from avatars and in-match textures.
  const art =
    pack && pack.kind !== "layered"
      ? `<img class="creature-portrait" src="/assets/fighters/${id}/${pack.selection}" alt="${c.name}">`
      : scopeIds(
          withAura(
            withSoftGround(
              fighterArt(id, "-20 -40 240 250", economy?.looks[id]),
              id,
            ),
            id,
          ),
          "home-feature",
        );
  const cosmetic = portraitCosmetics({
    character: id,
    // Portrait borders and their ornaments belong on avatars, not this stage.
    raidLook: { ...look, frame: null },
    championLooks: economy?.looks,
  });
  return `<div class="home-fighter-stage selected-art" data-raid-cosmetic="${cosmetic}"><span class="home-fighter-halo" aria-hidden="true"></span><div class="home-fighter-art player-avatar" data-raid-cosmetic="${cosmetic}" data-preview-champion="${id}" data-preview-item="${economy?.looks[id]?.skin ?? ""}" data-preview-stage="${economy?.looks[id]?.stage ?? 1}" data-preview-look="${encodeURIComponent(JSON.stringify(look ?? {}))}" data-preview-action="idle" aria-label="${c.name} animated preview">${art}</div><span class="home-fighter-ground" aria-hidden="true"></span></div><div class="home-fighter-copy"><span class="home-element-label">${elementIcon(c.element)} ${c.element}</span><h1>${c.name}</h1><p class="home-fighter-role">${c.role}</p><span class="home-mastery pill" style="--mastery:${tier?.color ?? "var(--text-dim)"}">${menuIcon("sparkle")}<span>${tier ? `${tier.name} mastery` : "New challenger"}<small>${masteryMatches(id)} matches played</small></span></span><button type="button" class="quiet home-change-fighter" data-home-open="fighters">Change fighter ${menuIcon("swap")}</button></div>`;
}
export function homeJourney(e?: Economy) {
  const j = e?.journey,
    season = j?.season;
  const tier = season
    ? Math.min(SEASON_TIERS, Math.floor(season.xp / SEASON_TIER_XP))
    : 0;
  const total = season?.xp ?? 0;
  const xp = tier === SEASON_TIERS ? SEASON_TIER_XP : total % SEASON_TIER_XP;
  return `<button type="button" id="home-adventure" class="home-adventure home-season-card"><span class="home-season-icon">${menuIcon("sparkle")}</span><span class="home-season-body"><span class="home-season-heading"><b>${season ? SEASON_THEMES[seasonTheme(season.id)].name : "Your adventure"}</b><small>${season ? `TIER ${tier} / ${SEASON_TIERS}` : j ? `LEVEL ${playerLevel(j.xp).level}` : "LEVELS & REWARDS"}</small></span><progress aria-label="Season tier progress" max="${SEASON_TIER_XP}" value="${xp}"></progress><span class="home-season-meta">${season ? `${xp} / ${SEASON_TIER_XP} XP · Free season rewards` : "Player levels · Weekly arcade · Boss Rush"}</span></span><span aria-hidden="true">→</span></button>`;
}
export function homeMissionBadge(e?: Economy) {
  const done = e?.missions.filter((m) => m.done).length ?? 0,
    total = e?.missions.length ?? 0;
  return `<button type="button" class="home-missions home-rail-item" id="home-missions" aria-label="Daily missions${total ? `: ${done} of ${total} done` : ""}" title="Daily missions">${menuIcon("missions")}<span>MISSIONS</span>${total ? `<small class="home-nav-badge pill">${done}/${total}</small>` : ""}</button>`;
}
export function homeModeLabel(mode: HomeMode) {
  return HOME_MODES.find((m) => m[0] === mode)![1];
}
export function homeShell(
  controls: string,
  roster: string,
  mode: HomeMode,
  id: CharacterId,
  economy?: Economy,
  look?: RaidLoadout,
) {
  return `<div class="home-screen" style="--element:${homeElement(id)}"><nav class="home-rail" aria-label="Main navigation"><div class="home-rail-main"><button type="button" class="home-rail-item is-active" data-home-nav="play" aria-current="page" title="Play">${menuIcon("battle")}<span>PLAY</span></button><button type="button" class="home-rail-item" id="town-open" title="Elemental Plaza: walk around with other players">${menuIcon("home")}<span>TOWN</span></button><button type="button" class="home-rail-item" id="raid-bestiary" title="Raids">${menuIcon("bestiary")}<span>RAIDS</span></button><button type="button" class="home-rail-item" data-home-open="fighters" title="Fighters">${menuIcon("user")}<span>FIGHTERS</span></button><button type="button" class="home-rail-item" id="wardrobe-open" title="Wardrobe">${menuIcon("wardrobe")}<span>WARDROBE</span></button><button type="button" class="home-rail-item" id="shop-open" title="Shop">${menuIcon("shop")}<span>SHOP</span></button><button type="button" class="home-rail-item" id="home-friends" title="Friends">${menuIcon("friends")}<span>FRIENDS</span></button></div><div class="home-rail-extra">${homeMissionBadge(economy)}</div><small class="home-rail-caption">ELEMENT<br>ARENA</small></nav><section class="home-scene" aria-label="Featured fighter"><div class="home-scene-heading"><span class="eyebrow">ELEMENTAL COLISEUM</span><span class="home-scene-tag">YOUR NEXT LEGEND STARTS HERE</span></div><div class="home-feature">${homeFeature(id, economy, look)}</div><div class="home-journey-slot">${homeJourney(economy)}</div><div class="home-launch"><button type="button" class="quiet home-more-play" data-home-open="play">${menuIcon("friends")} Join a friend / Play solo</button><div class="home-launch-row"><div class="home-mode-wrap"><button type="button" class="home-mode-toggle btn-secondary" id="home-mode-toggle" aria-expanded="false" aria-controls="home-modes"><span><small>GAME MODE</small><b>${homeModeLabel(mode)}</b></span><span aria-hidden="true">⌃</span></button><div id="home-modes" class="mode-picker card" role="radiogroup" aria-label="Room type" hidden>${HOME_MODES.map(([value, label, hint]) => `<button type="button" role="radio" class="bot-level mode-level${mode === value ? " active" : ""}" data-mode="${value}" aria-checked="${mode === value}"><b>${label}</b><small>${hint}</small></button>`).join("")}</div></div><button class="primary btn-primary home-play" id="create" aria-label="${mode === "raid" ? "Play Boss Raid: open Raid Hub" : `Play ${homeModeLabel(mode)}: create private room`}"><span>PLAY</span>${menuIcon("battle")}</button></div><p class="home-launch-hint">${mode === "raid" ? "Choose your boss in the Raid Hub" : "Create a private room · Invite your crew"}</p></div><span class="home-scene-index" aria-hidden="true">${String(Object.keys(CHARACTERS).indexOf(id) + 1).padStart(2, "0")} / 08</span></section><button type="button" class="home-panel-scrim" data-home-close aria-label="Close panel" tabindex="-1" hidden></button><section id="home-fighter-panel" class="home-drawer home-roster-drawer" role="dialog" aria-modal="true" aria-labelledby="home-fighters-title" tabindex="-1" hidden><header class="home-drawer-head"><div><span class="eyebrow">YOUR ROSTER</span><h2 id="home-fighters-title">Choose your fighter</h2></div><button type="button" class="home-panel-close btn-secondary" data-home-close aria-label="Close fighter selection">×</button></header><div class="home-drawer-scroll"><div class="roster-panel">${roster}</div></div></section><section id="home-play-panel" class="home-drawer home-play-drawer" role="dialog" aria-modal="true" aria-labelledby="home-play-title" tabindex="-1" hidden><header class="home-drawer-head"><div><span class="eyebrow">PLAY YOUR WAY</span><h2 id="home-play-title">Bring a friend. Find a rival.</h2></div><button type="button" class="home-panel-close btn-secondary" data-home-close aria-label="Close play options">×</button></header><div class="home-drawer-scroll"><aside class="room-panel card">${controls}</aside></div></section></div>`;
}

/** Reuse mounted fighter art when economy data changes; swap it only for a new look. */
const featureKeys = new WeakMap<HTMLElement, string>();
const journeyKeys = new WeakMap<HTMLElement, string>();
export function syncHomeScene(
  root: HTMLElement,
  id: CharacterId,
  e?: Economy,
  look?: RaidLoadout,
) {
  const home = root.querySelector<HTMLElement>(".home-screen");
  if (!home) return;
  home.style.setProperty("--element", homeElement(id));
  const feature = home.querySelector<HTMLElement>(".home-feature")!;
  const key = JSON.stringify([id, e?.looks[id], look, masteryMatches(id)]);
  if (featureKeys.get(feature) !== key) {
    feature.innerHTML = homeFeature(id, e, look);
    featureKeys.set(feature, key);
  }
  const journeySlot = home.querySelector<HTMLElement>(".home-journey-slot")!;
  const journeyKey = JSON.stringify(e?.journey ?? null);
  if (journeyKeys.get(journeySlot) !== journeyKey) {
    journeySlot.innerHTML = homeJourney(e);
    journeyKeys.set(journeySlot, journeyKey);
  }
  const mission = home.querySelector<HTMLElement>("#home-missions")!;
  const total = e?.missions.length ?? 0,
    done = e?.missions.filter((m) => m.done).length ?? 0;
  mission.setAttribute(
    "aria-label",
    `Daily missions${total ? `: ${done} of ${total} done` : ""}`,
  );
  let badge = mission.querySelector<HTMLElement>(".home-nav-badge");
  if (total) {
    if (!badge) {
      badge = document.createElement("small");
      badge.className = "home-nav-badge pill";
      mission.append(badge);
    }
    badge.textContent = `${done}/${total}`;
  } else badge?.remove();
  home.querySelector(".home-scene-index")!.textContent =
    `${String(Object.keys(CHARACTERS).indexOf(id) + 1).padStart(2, "0")} / 08`;
}

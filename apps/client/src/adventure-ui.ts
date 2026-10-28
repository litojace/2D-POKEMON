import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  playerLevel,
  LEVEL_MILESTONES,
  LEVEL_COINS,
  JOURNEY_ITEM_BY_ID,
  SEASON_THEMES,
  SEASON_TIERS,
  SEASON_TIER_XP,
  WEEKLY_GOALS,
  seasonTheme,
  seasonReward,
  type Journey,
} from "../../../packages/shared/src/journey";
import { ARCADE_EVENTS, arcadeWeek } from "../../../packages/shared/src/arcade";
import {
  pacificDate,
  type RaidLoadout,
} from "../../../packages/shared/src/raid";
import type { Economy } from "../../../packages/shared/src/shop";
import { fighterAvatar } from "./fighter-art";
import { coinChip } from "./shop-ui";
import { iconLabel } from "./menu-icons";
export type AdventureTab = "levels" | "season" | "arcade";
export interface AdventureView {
  tab: AdventureTab;
  preview?: string;
}
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function levelBar(j: Journey, compact = false) {
  const p = playerLevel(j.xp),
    next = LEVEL_MILESTONES.find((m) => m.level > p.level);
  return `<div class="journey-level${compact ? " is-compact" : ""}"><span class="journey-level-badge"><small>LEVEL</small><b>${p.level}</b></span><div><div class="journey-level-line"><b>${p.level === 50 ? "Elemental Legend" : "Your next adventure"}</b><small>${p.needed ? `${p.into.toLocaleString()} / ${p.needed.toLocaleString()} XP` : "MAX LEVEL"}</small></div><progress max="100" value="${p.percent}" aria-label="Player level ${p.level} progress"></progress>${compact ? "" : `<small>${next ? `Next milestone · Level ${next.level} · ${next.title ?? JOURNEY_ITEM_BY_ID[next.item!]?.name}` : "Every milestone earned. Seasonal journeys keep bringing new rewards."}</small>`}</div></div>`;
}
export function resultXp(
  j: Journey | undefined,
  ref: string | undefined,
  status?: "saving" | "saved" | "unavailable",
  eligible = true,
) {
  if (!j || !ref) return "";
  const award = j.recent.find((r) => r.ref === ref);
  if (!award)
    return `<p class="journey-xp-pending" role="status">${status === "saved" && !eligible ? "No XP earned · finish at least 20 seconds of active play to qualify." : status === "unavailable" ? "XP could not be saved. Check your connection and database update." : "Updating your XP…"}</p>`;
  const batch = j.recent.filter(
    (r) => r.at === award.at && (r.ref === ref || r.source === "mission"),
  );
  const gained = batch.reduce((n, r) => n + r.amount, 0);
  const later = j.recent
    .filter((r) => Date.parse(r.at) > Date.parse(award.at))
    .reduce((n, r) => n + r.amount, 0);
  const before = playerLevel(Math.max(0, j.xp - later - gained)).level;
  const after = playerLevel(Math.max(0, j.xp - later)).level;
  const milestones = LEVEL_MILESTONES.filter(
    (m) => m.level > before && m.level <= after,
  ).map((m) => m.title ?? JOURNEY_ITEM_BY_ID[m.item!].name);
  return `<section class="journey-result-xp" aria-label="Experience earned"><strong>+${gained} XP</strong>${gained > award.amount ? `<small class="journey-xp-breakdown">${award.amount} from this run · ${gained - award.amount} from daily missions</small>` : ""}${after > before ? `<p class="journey-level-up">LEVEL UP · ${before} → ${after}<small>+${(after - before) * LEVEL_COINS} coins${milestones.length ? ` · ${milestones.map(escape).join(" · ")}` : ""}</small></p>` : ""}${levelBar(j, true)}</section>`;
}
function glyph(slot: string, color = "#9ff3d8") {
  const shape =
    slot === "coins"
      ? '<circle cx="20" cy="20" r="15"/><circle cx="20" cy="20" r="11" opacity=".45"/><path d="M20 10v20M25 14c-8-5-16 3-5 6s3 11-5 6"/>'
      : slot === "frame"
        ? '<rect x="6" y="6" width="28" height="28" rx="8"/><path d="M4 13V4h9M27 4h9v9M4 27v9h9M27 36h9v-9"/>'
        : slot === "skin"
          ? '<path d="M20 4Q5 19 8 27a13 13 0 0024 0Q35 19 20 4Z"/><path d="M14 22q-2 8 6 9"/>'
          : slot === "entrance"
            ? '<path d="M7 32l13-13M9 22l-4 4M17 34l-4 4M27 4l3 8 8 3-8 3-3 8-3-8-8-3 8-3Z"/>'
            : slot === "aura"
              ? '<ellipse cx="20" cy="25" rx="17" ry="8"/><ellipse cx="20" cy="20" rx="9" ry="17" transform="rotate(45 20 20)"/>'
              : '<path d="M10 9l5 8 5-11 5 11 5-8-3 18H13Z"/><path d="M12 33h16"/>';
  return `<svg class="journey-reward-glyph" viewBox="0 0 40 40" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" aria-hidden="true">${shape}</svg>`;
}
function rewardCard(
  id: string | null,
  label: string,
  goal: string,
  unlocked: boolean,
  selected?: string,
  title = false,
) {
  const item = id ? JOURNEY_ITEM_BY_ID[id] : undefined;
  const tag = id ? "button" : "article";
  return `<${tag} ${id ? 'type="button"' : ""} class="journey-reward${unlocked ? " is-earned" : ""}${id === selected ? " is-selected" : ""}" ${id ? `data-journey-preview="${id}" aria-pressed="${id === selected}"` : ""}>${glyph(item?.slot ?? "title", item?.color)}<span><small>${goal}</small><b>${escape(item?.name ?? label)}</b><em>${unlocked ? "✓ Earned" : title ? "Title milestone" : "Preview reward"}</em></span></${tag}>`;
}
function preview(
  view: AdventureView,
  e: Economy | undefined,
  champion: CharacterId,
  loadout: RaidLoadout,
) {
  const item = JOURNEY_ITEM_BY_ID[view.preview ?? "wayfarer-frame"];
  if (!item) return "";
  const owned = e?.owned.includes(item.id) ?? false,
    active = loadout[item.slot] === item.id,
    frame = item.slot === "frame";
  const action =
    item.slot === "victory"
      ? "victory"
      : item.slot === "entrance"
        ? "entrance"
        : "idle";
  return `<aside class="journey-preview shop-preview" style="--journey-color:${item.color}"><div class="shop-preview-visual"><div class="shop-live-stage${frame ? " is-frame" : ""}" data-preview-champion="${champion}" data-preview-item="${item.id}" data-preview-stage="1" data-preview-action="${action}" role="img" aria-label="${escape(item.name)} preview"><div class="shop-preview-fallback"><span class="raid-cosmetic-preview" data-cosmetic="${item.id}" style="--journey-color:${item.color};--journey-accent:${item.accent}">${fighterAvatar(champion, "journey-preview")}</span></div></div></div><div class="shop-preview-text"><span class="eyebrow">${owned ? "In your collection" : "Reward preview"}</span><h3>${escape(item.name)}</h3><p>${escape(item.description)}.</p><small>Previewing ${CHARACTERS[champion].name} · ${item.slot}</small>${owned ? `<button type="button" class="secondary${active ? " is-equipped-text" : ""}" data-journey-equip="${item.id}" ${active ? "disabled" : ""}>${iconLabel(active ? "check" : "swap", active ? "Equipped" : "Equip")}</button>` : '<p class="journey-lock">Earn this reward through your player level or its seasonal journey.</p>'}</div></aside>`;
}
function levels(
  view: AdventureView,
  e: Economy | undefined,
  champion: CharacterId,
  look: RaidLoadout,
) {
  const level = e?.journey ? playerLevel(e.journey.xp).level : 0;
  return `${e?.journey ? levelBar(e.journey) : ""}<p class="adventure-intro">Every level earns ${LEVEL_COINS} coins. Every five levels brings a milestone. Your level never changes combat stats.</p><div class="journey-layout">${preview(view, e, champion, look)}<div class="journey-rewards">${LEVEL_MILESTONES.map((m) => rewardCard(m.item, m.title ?? "", `LEVEL ${m.level}`, level >= m.level, view.preview, !m.item)).join("")}</div></div><details class="journey-help"><summary>How to earn XP</summary><p>Finish a PvP match: 50 XP, plus 25 for a win. AI matches: 25 XP. Raid clears: 100 / 150 / 200 XP by Peril. Raid attempts earn 20 XP per phase reached. Daily missions add 50 XP.</p><p>Results need at least 20 seconds of play and participation. Practice and abandoned matches do not award XP. Rewards are added automatically.</p></details>`;
}
function season(
  view: AdventureView,
  e: Economy | undefined,
  champion: CharacterId,
  look: RaidLoadout,
) {
  const s = e?.journey?.season,
    sid = s?.id ?? pacificDate().slice(0, 7),
    theme = SEASON_THEMES[seasonTheme(sid)],
    xp = s?.xp ?? 0,
    tier = Math.min(SEASON_TIERS, Math.floor(xp / SEASON_TIER_XP));
  const day = pacificDate(),
    end = new Date(`${sid}-01T12:00:00Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  const days = Math.max(
    0,
    Math.ceil((end.getTime() - Date.parse(day + "T12:00:00Z")) / 86400000),
  );
  const cards = Array.from({ length: SEASON_TIERS }, (_, i) => {
    const n = i + 1,
      r = seasonReward(n, sid);
    return `<div class="season-tier${tier >= n ? " is-earned" : ""}"><small>TIER ${n}</small>${r.item ? `<button data-journey-preview="${r.item}" aria-label="Preview ${escape(JOURNEY_ITEM_BY_ID[r.item].name)}">${glyph(JOURNEY_ITEM_BY_ID[r.item].slot, theme.color)}</button>` : glyph("coins", "#ffd991")}<b>${r.item ? escape(JOURNEY_ITEM_BY_ID[r.item].name) : "+50 coins"}</b>${r.item ? "<small>+50 coins</small>" : ""}<span>${tier >= n ? "✓ Earned" : `${n * SEASON_TIER_XP} XP`}</span></div>`;
  }).join("");
  return `<header class="season-banner" style="--journey-color:${theme.color}"><div><span class="eyebrow">FREE MONTHLY JOURNEY · ${sid}</span><h2>${theme.name}</h2><p>${days} days left · all rewards are free · earned cosmetics stay yours</p></div><strong>${tier}<small> / ${SEASON_TIERS} tiers</small></strong><progress aria-label="Season progress" max="${SEASON_TIERS * SEASON_TIER_XP}" value="${Math.min(xp, SEASON_TIERS * SEASON_TIER_XP)}"></progress></header><div class="season-layout"><div><h3>Weekly goals <small>Reset Monday · +250 season XP each</small></h3><div class="season-goals">${WEEKLY_GOALS.map(
    (g) => {
      const done = s?.completed.includes(g.id),
        n = Math.min(g.target, s?.goals[g.id] ?? 0);
      return `<article class="season-goal${done ? " is-earned" : ""}"><b>${g.text}</b><progress aria-label="${g.text}" max="${g.target}" value="${n}"></progress><span>${n}/${g.target} · ${done ? "✓ Complete" : "+250 season XP"}</span></article>`;
    },
  ).join(
    "",
  )}</div><div class="season-tiers">${cards}</div></div>${preview(view, e, champion, look)}</div><p class="adventure-intro">All earned account XP also advances this season. Rewards are added automatically. Repeated cosmetics from a returning theme pay 100 extra coins.</p>`;
}
function arcade() {
  const weekly = arcadeWeek(pacificDate()),
    event = ARCADE_EVENTS[weekly.id];
  return `<div class="adventure-mode-hero" style="--journey-color:${event.color}"><span class="eyebrow">THIS WEEK’S ARCADE · UNTIL ${weekly.end}</span><h2>${event.name}</h2><p>${event.text}</p><div class="arcade-illustration arcade-${weekly.id}" aria-hidden="true"><span>✦</span><i></i><b>${weekly.id === "crown-chase" ? "CHASE THE CROWN" : weekly.id === "meteor-mayhem" ? "WATCH THE SKY" : "UNLEASH YOUR ULTIMATE"}</b></div></div><div class="adventure-mode-details"><article><h3>Make your move</h3><p>${event.tip}</p></article><article><h3>Play your way</h3><p>Challenge an AI opponent, share a private 1v1 code, or bring three friends for 2v2. Arcade earns XP and weekly-goal progress. PvP rating stays separate.</p></article></div><div class="adventure-actions"><button class="primary" data-adventure-play="arcade-bot">${iconLabel("bot", "Play vs AI")}</button><button class="secondary" data-adventure-play="arcade-duel">${iconLabel("battle", "Private 1v1")}</button><button class="secondary" data-adventure-play="arcade-teams">${iconLabel("friends", "Private 2v2")}</button></div>`;
}
export function adventureMarkup(
  view: AdventureView,
  e: Economy | undefined,
  champion: CharacterId,
  look: RaidLoadout = {},
) {
  const tabs = (
    [
      ["levels", "Player levels"],
      ["season", "Season"],
      ["arcade", "Weekly arcade"],
    ] as const
  )
    .map(
      ([id, label]) =>
        `<button role="tab" type="button" data-adventure-tab="${id}" aria-selected="${view.tab === id}" class="${view.tab === id ? "active" : ""}">${label}</button>`,
    )
    .join("");
  const message =
    e && !e.journey
      ? '<p class="journey-update" role="status">Saving player XP and seasonal rewards needs database migration 022_player_journey.sql. Weekly arcade is ready to play.</p>'
      : "";
  return `<div class="adventure"><nav class="adventure-tabs" role="tablist" aria-label="Adventure sections">${tabs}</nav><header class="adventure-head"><h2>${iconLabel("bestiary", "Adventure")}</h2>${coinChip(e?.balance, "", e?.unlimitedCoins)}</header>${message}${view.tab === "levels" ? levels(view, e, champion, look) : view.tab === "season" ? season(view, e, champion, look) : arcade()}<p class="adventure-status" role="status"></p></div>`;
}

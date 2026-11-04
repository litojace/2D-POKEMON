/**
 * The Journey (UI remodel step 4, docs/ui-remodel/PLAN.md): a panel inside
 * the Lobby with three tabs. Markup and rules only (no DOM);
 * screens/journey.ts wires it up.
 *
 * - Season: one banner (level ring, the season and its tier, XP to the next
 *   tier, the season's countdown and the Daily Spark); the season road,
 *   scrolling sideways, cosmetic tiers larger than coin tiers and the next
 *   tier lit; the weekly goals with their reset; a short level road.
 * - Levels: every level milestone, earned or not, and how XP is earned.
 * - Weekly arcade: this week's event; the three ways to play it.
 *
 * A reward you pick (a cosmetic tier or level reward) shows in the action
 * bar, where you equip it once it is yours. Every countdown is the server's
 * clock (serverNow, Pacific days as the server keeps them).
 */
import type { CharacterId } from "@arena/shared";
import {
  DAILY_SPARK_XP,
  JOURNEY_ITEM_BY_ID,
  LEVEL_MILESTONES,
  MAX_PLAYER_LEVEL,
  SEASON_THEMES,
  SEASON_TIER_COINS,
  WEEKLY_GOALS,
  levelCoins,
  milestoneNames,
  playerLevel,
  seasonReward,
  seasonRules,
  seasonTheme,
  sparkLeft,
  type Journey,
} from "../../../../packages/shared/src/journey";
import {
  ARCADE_EVENTS,
  arcadeWeek,
} from "../../../../packages/shared/src/arcade";
import type { RaidLoadout } from "../../../../packages/shared/src/raid";
import type { Economy } from "../../../../packages/shared/src/shop";
import { menuIcon } from "../menu-icons";
import { itemPicture, picksCountdown } from "../shop-ui";
import { seasonCountdown, serverDay, weeklyCountdown } from "../ui/countdown";
import {
  actionBar,
  actions,
  bar,
  button,
  esc,
  panelHead,
  ring,
  tabs,
  timer,
} from "../ui/components";

export type JourneyTab = "season" | "levels" | "arcade";
export const JOURNEY_TABS: [JourneyTab, string][] = [
  ["season", "Season"],
  ["levels", "Levels"],
  ["arcade", "Weekly arcade"],
];
/** Season XP each weekly goal pays (the server's amount). */
export const WEEKLY_GOAL_XP = 250;

export interface JourneyView {
  tab: JourneyTab;
  /** The reward shown in the action bar (a journey item id). */
  selected: string | null;
  /** An equip on its way (the item id). */
  equipping: string | null;
  /** The last equip's problem, if any. */
  status: string;
}
export interface JourneyData {
  economy: Economy | null;
  /** What you wear now (the raid appearance loadout). */
  look: RaidLoadout;
  /** The fighter rewards are pictured on. */
  champion: CharacterId;
  loading?: boolean;
  problem?: string;
}

export const journeyView = (tab: JourneyTab = "season"): JourneyView => ({
  tab,
  selected: null,
  equipping: null,
  status: "",
});

/* --------------------------------------------------------------- rules */

/** This season: its id (from the server; else today's month), rules, tier. */
export function seasonState(j: Journey | undefined, now?: number) {
  const s = j?.season;
  const id = s?.id ?? serverDay(now).slice(0, 7);
  const rules = seasonRules(s);
  const xp = Math.max(0, s?.xp ?? 0);
  const tier = Math.min(rules.tiers, Math.floor(xp / rules.tierXp));
  const into = tier >= rules.tiers ? rules.tierXp : xp - tier * rules.tierXp;
  return {
    id,
    rules,
    xp,
    tier,
    into,
    theme: SEASON_THEMES[seasonTheme(id)],
  };
}
/** Every tier of the season road, in order. */
export function seasonRoad(j: Journey | undefined, now?: number) {
  const s = seasonState(j, now);
  return Array.from({ length: s.rules.tiers }, (_, i) => {
    const n = i + 1;
    const reward = seasonReward(n, s.id, s.rules);
    return {
      tier: n,
      item: reward.item,
      coins: reward.coins,
      xp: n * s.rules.tierXp,
      state:
        n <= s.tier
          ? ("got" as const)
          : n === s.tier + 1
            ? ("next" as const)
            : ("lock" as const),
    };
  });
}
/** Level milestones from your next level on (the short level road). */
export function nextMilestones(level: number, count = 4) {
  return LEVEL_MILESTONES.filter((m) => m.level > level).slice(0, count);
}
/** Where a journey item comes from, in words ("Level 55", "Season tier 12"). */
export function itemSource(id: string, j: Journey | undefined) {
  const level = LEVEL_MILESTONES.find((m) => m.item === id)?.level;
  if (level)
    return { kind: "level" as const, at: level, label: `Level ${level}` };
  const tier = seasonRoad(j).find((t) => t.item === id)?.tier;
  if (tier)
    return { kind: "season" as const, at: tier, label: `Season tier ${tier}` };
  return { kind: "season" as const, at: 0, label: "An earlier season" };
}
/** The reward picked first: the next one to earn on this tab, else the last. */
export function defaultPick(tab: JourneyTab, e: Economy | null) {
  const j = e?.journey;
  if (tab === "levels") {
    const level = j ? playerLevel(j.xp).level : 1;
    const items = LEVEL_MILESTONES.filter((m) => m.item);
    return (items.find((m) => m.level > level) ?? items[items.length - 1]).item;
  }
  const road = seasonRoad(j).filter((t) => t.item);
  return (
    (road.find((t) => t.state !== "got") ?? road[road.length - 1])?.item ?? null
  );
}
/** Can you wear it (owned), and are you wearing it? */
export function itemState(id: string, d: JourneyData) {
  const item = JOURNEY_ITEM_BY_ID[id];
  const owned = !!d.economy?.owned.includes(id);
  return { item, owned, worn: !!item && d.look[item.slot] === id };
}

/* -------------------------------------------------------------- pieces */

const num = (n: number) => n.toLocaleString("en-US");
const SLOT_WORD: Record<string, string> = {
  frame: "frame",
  aura: "aura",
  skin: "colors",
  victory: "finale",
  entrance: "entrance",
};
const crown = `<svg class="journey-crown" viewBox="0 0 40 40" aria-hidden="true"><path d="M8 29h24l-2-15-6 6-4-10-4 10-6-6z" fill="var(--ui-accent)"/><path d="M9 33h22" stroke="var(--ui-accent)" stroke-width="2.5" stroke-linecap="round"/></svg>`;
const picture = (id: string, d: JourneyData, scope: string) =>
  itemPicture(id, d.champion, scope);

function spark(j: Journey | undefined) {
  if (!j?.spark) return "";
  const left = sparkLeft(j);
  return `<div class="journey-banner-spark${left ? "" : " is-spent"}"><span class="ui-kicker">Daily Spark</span><b class="ui-num">${left ? `${num(left)} XP` : "Used up"}</b><small class="ui-note">${left ? "left today at ×2" : "for today"} · renews in ${esc(picksCountdown())}</small></div>`;
}

function banner(tab: "season" | "levels", d: JourneyData) {
  const j = d.economy?.journey;
  const p = playerLevel(j?.xp ?? 0);
  const s = seasonState(j);
  const levelRing = ring(
    p.percent,
    100,
    `<span class="journey-ring-text"><b class="ui-num">${p.level}</b><small>Level</small></span>`,
    {
      label: `Level ${p.level}, ${Math.round(p.percent)}% to the next`,
      color: "var(--season)",
    },
  );
  const main =
    tab === "season"
      ? `<span class="journey-row"><b class="ui-h">${esc(s.theme.name)}</b><span class="ui-num journey-tier-count">Tier ${s.tier} / ${s.rules.tiers}</span></span>${bar(s.into, s.rules.tierXp, { label: "Season tier progress", color: "linear-gradient(90deg, var(--season), var(--season-2))", thick: true })}<span class="journey-row"><small class="ui-note">${s.tier >= s.rules.tiers ? `All ${s.rules.tiers} tiers earned` : `${num(s.into)} / ${num(s.rules.tierXp)} XP to tier ${s.tier + 1}`}</small>${timer(`Ends in ${seasonCountdown(s.id)}`)}</span>`
      : (() => {
          const next = nextMilestones(p.level, 1)[0];
          return `<span class="journey-row"><b class="ui-h">${p.level === MAX_PLAYER_LEVEL ? "Element Master" : "Your next adventure"}</b><span class="ui-num journey-tier-count">${p.needed ? `${num(p.into)} / ${num(p.needed)} XP` : "Max level"}</span></span>${bar(p.percent, 100, { label: `Player level ${p.level} progress`, color: "var(--ui-accent)", thick: true })}<span class="journey-row"><small class="ui-note">${next ? `Next milestone · Level ${next.level} · ${milestoneNames(next).map(esc).join(" + ")}` : "Every milestone earned. Seasons keep bringing new rewards."}</small></span>`;
        })();
  return `<div class="journey-banner">${levelRing}<div class="journey-banner-main">${main}</div>${spark(j)}</div>`;
}

function seasonTier(
  t: ReturnType<typeof seasonRoad>[number],
  view: JourneyView,
  d: JourneyData,
) {
  const tick =
    t.state === "got"
      ? `<b class="journey-tick" aria-hidden="true">${menuIcon("check")}</b>`
      : "";
  const state =
    t.state === "got"
      ? "earned"
      : t.state === "next"
        ? "next"
        : `${num(t.xp)} XP`;
  if (!t.item)
    return `<div class="journey-tier is-${t.state}" role="listitem" aria-label="Tier ${t.tier}: ${SEASON_TIER_COINS} coins, ${state}"><small class="ui-num">${t.tier}</small><span class="journey-tier-art"><i class="ui-coin"></i></span><em>${t.coins} coins</em>${tick}</div>`;
  const item = JOURNEY_ITEM_BY_ID[t.item];
  return `<div role="listitem" class="journey-tier-slot"><button type="button" class="journey-tier is-big is-${t.state}" data-journey-item="${t.item}" aria-pressed="${view.selected === t.item}" aria-label="Tier ${t.tier}: ${esc(item.name)}, ${state}"><small class="ui-num">${t.tier}</small><span class="journey-tier-art">${picture(t.item, d, `jt-${t.item}`)}</span><em>Season ${SLOT_WORD[item.slot] ?? item.slot}</em>${tick}</button></div>`;
}

function goals(j: Journey | undefined) {
  const s = j?.season;
  return WEEKLY_GOALS.map((g) => {
    const done = !!s?.completed.includes(g.id);
    const n = Math.min(g.target, s?.goals[g.id] ?? 0);
    return `<div class="journey-goal${done ? " is-done" : ""}"><span class="journey-row"><b>${esc(g.text)}</b><span class="ui-num">${n}/${g.target}</span></span>${bar(n, g.target, { label: g.text, color: done ? "var(--ui-ok)" : "var(--season)" })}<small class="ui-note">${done ? `Paid · +${WEEKLY_GOAL_XP} season XP` : `+${WEEKLY_GOAL_XP} season XP`}</small></div>`;
  }).join("");
}

function milestoneRow(
  m: (typeof LEVEL_MILESTONES)[number],
  first: boolean,
  view: JourneyView,
  d: JourneyData,
) {
  const art = m.item ? picture(m.item, d, `jl-${m.item}`) : crown;
  const name = m.item ? JOURNEY_ITEM_BY_ID[m.item].name : `Title: ${m.title}`;
  const inner = `<span class="journey-lvl-art">${art}</span><span class="journey-lvl-text"><small class="ui-note">Level ${m.level}</small><b>${esc(name)}</b></span>`;
  return m.item
    ? `<button type="button" class="journey-lvl${first ? " is-next" : ""}" data-journey-item="${m.item}" aria-pressed="${view.selected === m.item}">${inner}</button>`
    : `<div class="journey-lvl${first ? " is-next" : ""}">${inner}</div>`;
}

function levelRoad(view: JourneyView, d: JourneyData) {
  const j = d.economy?.journey;
  const p = playerLevel(j?.xp ?? 0);
  const upcoming = nextMilestones(p.level);
  const coins = levelCoins(Math.min(MAX_PLAYER_LEVEL, p.level + 1));
  return `<section class="journey-levelroad" aria-label="Level road"><div class="journey-section"><h3 class="ui-h">Level road</h3><small class="ui-note">+${coins} coins every level</small></div><div class="journey-lvl-now"><span class="journey-row"><b>${p.needed ? `Level ${p.level} → ${p.level + 1}` : `Level ${p.level}`}</b><span class="ui-num">${p.needed ? `${num(p.into)} / ${num(p.needed)} XP` : "Max"}</span></span>${bar(p.percent, 100, { label: `Level ${p.level} progress` })}</div>${upcoming.length ? upcoming.map((m, i) => milestoneRow(m, i === 0, view, d)).join("") : `<p class="ui-note">Every level reward is yours.</p>`}</section>`;
}

function notice(d: JourneyData) {
  if (d.problem)
    return `<p class="journey-notice" role="status">${esc(d.problem)}</p>`;
  if (d.economy && !d.economy.journey)
    return `<p class="journey-notice" role="status">Saving player XP and seasonal rewards needs database migration 022_player_journey.sql. Weekly arcade is ready to play.</p>`;
  return "";
}

function seasonBody(view: JourneyView, d: JourneyData) {
  const j = d.economy?.journey;
  const s = seasonState(j);
  const road = seasonRoad(j);
  return `${notice(d)}${banner("season", d)}<div class="journey-section"><h3 class="ui-h">Season road</h3><small class="ui-note">${s.rules.tiers} tiers · ${s.rules.itemTiers.length} cosmetics · every tier pays ${SEASON_TIER_COINS} coins</small></div><div class="journey-road" role="list" aria-label="Season road, tier ${s.tier} of ${s.rules.tiers}" tabindex="0" data-journey-road>${road.map((t) => seasonTier(t, view, d)).join("")}</div><div class="journey-two"><section aria-label="Weekly goals"><div class="journey-section"><h3 class="ui-h">Weekly goals</h3>${timer(`Resets in ${weeklyCountdown()}`)}</div><div class="journey-goals">${goals(j)}</div></section>${levelRoad(view, d)}</div><p class="ui-note">All earned account XP also advances this season. Rewards are added automatically; earned cosmetics stay yours. Repeated cosmetics from a returning theme pay 100 extra coins.</p>`;
}

function levelsBody(view: JourneyView, d: JourneyData) {
  const j = d.economy?.journey;
  const level = j ? playerLevel(j.xp).level : 0;
  const tile = (
    m: (typeof LEVEL_MILESTONES)[number],
    kind: "title" | "item",
  ) => {
    const earned = level >= m.level;
    const cls = `journey-prize${earned ? " is-earned" : ""}${kind === "title" ? " is-title" : ""}`;
    const state = `<em>${earned ? "✓ Earned" : kind === "title" ? "Title" : "Reward"}</em>`;
    if (kind === "title")
      return `<div class="${cls}"><span class="journey-prize-art">${crown}</span><small>Level ${m.level}</small><b>${esc(m.title!)}</b>${state}</div>`;
    const item = JOURNEY_ITEM_BY_ID[m.item!];
    return `<button type="button" class="${cls}" data-journey-item="${m.item}" aria-pressed="${view.selected === m.item}"><span class="journey-prize-art">${picture(m.item!, d, `jr-${m.item}`)}</span><small>Level ${m.level}</small><b>${esc(item.name)}</b>${state}</button>`;
  };
  const rewards = LEVEL_MILESTONES.flatMap((m) => [
    ...(m.title ? [tile(m, "title")] : []),
    ...(m.item ? [tile(m, "item")] : []),
  ]).join("");
  return `${notice(d)}${banner("levels", d)}<p class="ui-note">Every level earns 30 coins, and 100 coins from level 50 to ${MAX_PLAYER_LEVEL}. Milestones bring cosmetics and titles. Your level never changes combat stats.</p><div class="journey-section"><h3 class="ui-h">Level road</h3><small class="ui-note">${LEVEL_MILESTONES.length} milestones to level ${MAX_PLAYER_LEVEL}</small></div><div class="journey-prizes" role="group" aria-label="Level rewards">${rewards}</div><details class="journey-earn"><summary>How to earn XP</summary><p>Finish a PvP match: 50 XP, plus 25 for a win. AI matches: 25 XP. Raid clears: 100 / 150 / 200 XP by Peril. Raid attempts earn 20 XP per phase reached. Daily missions add 50 XP. Daily Spark: the first ${DAILY_SPARK_XP} XP you earn each day count double.</p><p>Results need at least 20 seconds of play and participation. Practice and abandoned matches do not award XP. Rewards are added automatically.</p></details>`;
}

/** This week's arcade (it changes on Monday, Pacific time). */
export function arcadeNow(now?: number) {
  const week = arcadeWeek(serverDay(now));
  return { ...week, event: ARCADE_EVENTS[week.id] };
}

function arcadeBody() {
  const a = arcadeNow();
  const motto =
    a.id === "crown-chase"
      ? "Chase the crown"
      : a.id === "meteor-mayhem"
        ? "Watch the sky"
        : "Unleash your ultimate";
  return `<section class="journey-arcade" style="--arcade:${a.event.color}"><div class="journey-arcade-text"><span class="ui-kicker">This week's arcade</span><h3 class="ui-title">${esc(a.event.name)}</h3><p>${esc(a.event.text)}</p>${timer(`Ends in ${weeklyCountdown()}`)}</div><div class="journey-arcade-art" aria-hidden="true"><span>✦</span><b>${motto}</b></div></section><div class="journey-arcade-cards"><article><h3 class="ui-h">Make your move</h3><p>${esc(a.event.tip)}</p></article><article><h3 class="ui-h">Play your way</h3><p>Challenge an AI opponent, share a private 1v1 code, or bring three friends for 2v2. Arcade earns XP and weekly-goal progress. PvP rating stays separate.</p></article></div>`;
}

/* ---------------------------------------------------------- action bar */

function rewardFoot(view: JourneyView, d: JourneyData) {
  const id = view.selected;
  const item = id ? JOURNEY_ITEM_BY_ID[id] : undefined;
  if (!id || !item)
    return actionBar(
      `<span class="ui-note">Pick a reward to see it.</span>`,
      actions(
        button("Wardrobe", { attrs: { "data-journey-wardrobe": true } }),
        button("Equip", { kind: "ok", disabled: true }),
      ),
    );
  const { owned, worn } = itemState(id, d);
  const j = d.economy?.journey;
  const source = itemSource(id, j);
  const line = owned
    ? `${source.label} · ${worn ? "Wearing it" : "In your collection"}`
    : source.kind === "level"
      ? `${source.label} · ${playerLevel(j?.xp ?? 0).level >= source.at ? "Arriving soon" : "Keep levelling up"}`
      : `${source.label} · ${num(source.at * seasonState(j).rules.tierXp)} season XP`;
  const busy = view.equipping === id;
  const label = worn
    ? "Equipped"
    : owned
      ? busy
        ? "Equipping…"
        : "Equip"
      : "Locked";
  return actionBar(
    `<span class="journey-foot-art">${picture(id, d, "journey-foot")}</span><span class="journey-foot-text"><b class="ui-h">${esc(item.name)}</b><small class="ui-note">${esc(line)}</small><small class="journey-status" role="status">${esc(view.status)}</small></span>`,
    actions(
      button("Wardrobe", { attrs: { "data-journey-wardrobe": true } }),
      button(label, {
        kind: owned ? "ok" : "default",
        icon: worn ? "check" : undefined,
        disabled: !owned || worn || view.equipping !== null,
        attrs: { "data-journey-equip": id },
      }),
    ),
  );
}

function arcadeFoot() {
  const a = arcadeNow();
  return actionBar(
    `<span class="journey-foot-text"><b class="ui-h">${esc(a.event.name)}</b><small class="ui-note">Earns XP and weekly-goal progress</small></span>`,
    actions(
      button("Private 1v1", { attrs: { "data-journey-play": "arcade-duel" } }),
      button("Private 2v2", { attrs: { "data-journey-play": "arcade-teams" } }),
      button("Play vs AI", {
        kind: "primary",
        attrs: { "data-journey-play": "arcade-bot" },
      }),
    ),
  );
}

export function journeyMarkup(view: JourneyView, d: JourneyData) {
  const s = seasonState(d.economy?.journey);
  const head = panelHead(
    "Journey",
    `Season · ${s.theme.name}`,
    tabs(
      JOURNEY_TABS.map(([id, label]) => ({
        id,
        label,
        selected: view.tab === id,
      })),
      "Journey sections",
      "jtab",
    ),
  );
  const body =
    view.tab === "season"
      ? seasonBody(view, d)
      : view.tab === "levels"
        ? levelsBody(view, d)
        : arcadeBody();
  const foot = view.tab === "arcade" ? arcadeFoot() : rewardFoot(view, d);
  return `<section class="ui-panel journey-room" role="dialog" aria-label="Journey" data-journey-tab="${view.tab}" style="--season:${s.theme.color};--season-2:${s.theme.accent}">${head}<div class="ui-panel-body journey-body" data-journey-region="body" data-tab="${view.tab}">${body}</div>${foot}</section>`;
}

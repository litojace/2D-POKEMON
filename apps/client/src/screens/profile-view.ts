/**
 * The player card and profile (UI remodel step 7, docs/ui-remodel/PLAN.md).
 * Markup and rules only (no DOM); screens/profile.ts wires it up.
 *
 * A panel: your card on the left (your Lobby fighter in the look you wear,
 * your title, name, level, rank and best mastery), and beside it your
 * matches, wins, win rate and raid clears as four tiles; your titles as
 * chips that equip on tap; mastery for every fighter; Journey and Ranked
 * summaries; raid trophies per boss; achievements; links to Ranks, Journey
 * and raid rewards. A guest saves their account here. Share card draws the
 * card as a picture (screens/profile.ts). Every number is the server's.
 */
import {
  CHARACTERS,
  FIGHTER_IDS,
  type CharacterId,
} from "../../../../packages/shared/src/index";
import {
  rankColor,
  NAME_CHANGE_DAYS,
  type NameStatus,
  type Progress,
  type Title,
} from "../../../../packages/shared/src/accounts";
import {
  playerLevel,
  type Journey,
} from "../../../../packages/shared/src/journey";
import {
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  type RaidBossId,
} from "../../../../packages/shared/src/raid-roster";
import type { RaidProgress } from "../../../../packages/shared/src/raid";
import { fighterAvatar } from "../fighter-art";
import { fighterStageArt, RIG_FRAME } from "../fighter-selection";
import { CREATURE_VIEWBOX } from "../creature-design";
import { sortTitles, titleTreatment } from "../player-nameplate";
import { raidSplashImage } from "../raid-splash-art";
import {
  avatar,
  bar,
  button,
  emptyState,
  esc,
  panelHead,
  ring,
  tag,
} from "../ui/components";
import { mastery } from "./roster-view";
import { serverNow } from "../server-clock";
import { countdownText } from "../ui/countdown";
import { seasonState } from "./journey-view";
import { rankProgress } from "./ranks-view";

export interface ProfileData {
  name: string;
  /** The equipped title's name and colour (the account's). */
  title: string | null;
  titleColor: string | null;
  titles: Title[];
  guest: boolean;
  /** "Administrator" / "Player" and the email, for the line under the tiles. */
  role: string;
  email?: string;
  /** Your Lobby fighter: the card shows it in the look you wear. */
  fighter: CharacterId;
  journey?: Journey;
  /** null while loading; problem when it couldn't load. */
  progress: Progress | null;
  progressProblem?: string;
  raids: RaidProgress | null;
  /** When you can next change your name (null until loaded, or unknown). */
  nameStatus: NameStatus | null;
}
export interface ProfileView {
  /** The title being equipped ("" for no title), while the server answers. */
  equipping: string | null;
  /** The last answer ("Title on." or the server's reason). */
  status: string;
  /** The guest's save-account answer. */
  saveStatus: string;
  /** The name form is open. */
  renaming: boolean;
  /** A name change is on its way. */
  nameBusy: boolean;
  /** The last name answer ("Name changed." or the reason). */
  nameMessage: string;
}
export const profileView = (): ProfileView => ({
  equipping: null,
  status: "",
  saveStatus: "",
  renaming: false,
  nameBusy: false,
  nameMessage: "",
});

/**
 * When you can next change your name: null when you can now (or before the
 * status loads: the server decides either way). Counted on the server's
 * clock.
 */
export function nameLockedFor(s: NameStatus | null, now = serverNow()) {
  if (!s?.nextAt) return null;
  const left = Date.parse(s.nextAt) - now;
  return left > 0 ? left : null;
}

const num = (n: number) => n.toLocaleString("en-US");
const safeColor = (c: string | null | undefined, fallback = "#a9b4c9") =>
  c && /^#[0-9a-f]{6}$/i.test(c) ? c : fallback;
const elVar = (c: CharacterId) =>
  `var(--el-${CHARACTERS[c].element.toLowerCase()})`;

/** The four headline numbers. */
export function profileTiles(p: Progress | null, raids: RaidProgress | null) {
  const rate = p && p.matches ? Math.round((100 * p.wins) / p.matches) : 0;
  const clears = raids ? (raids.totalClears ?? raids.clears) : null;
  return [
    { value: p ? num(p.matches) : "–", label: "Matches" },
    { value: p ? num(p.wins) : "–", label: "Wins" },
    { value: p ? `${rate}%` : "–", label: "Win rate" },
    { value: clears === null ? "–" : num(clears), label: "Raid clears" },
  ];
}
/** Your best mastery: the tier and the fighter you've played most. */
export function bestMastery(p: Progress | null) {
  if (!p) return null;
  let best: { id: CharacterId; matches: number } | null = null;
  for (const id of FIGHTER_IDS) {
    const matches = p.fighters[id]?.matches ?? 0;
    if (matches > 0 && (!best || matches > best.matches))
      best = { id, matches };
  }
  if (!best) return null;
  const tier = mastery(best.matches).tier;
  return tier
    ? { id: best.id, text: `${tier.name} ${CHARACTERS[best.id].name}` }
    : null;
}
/** "Pupil · 1,000", or Unranked with placement matches left. */
export function rankLine(p: Progress | null) {
  const r = p?.rating;
  if (!r) return null;
  const placing = (r.placementLeft ?? 0) > 0;
  return {
    text: placing
      ? `Unranked · ${num(r.rating)}`
      : `${r.rank} · ${num(r.rating)}`,
    color: placing ? rankColor(undefined) : rankColor(r.rank),
    note: placing
      ? `${r.placementLeft} placement ${r.placementLeft === 1 ? "match" : "matches"} left`
      : r.next
        ? r.next.name === "Legendary Grandmaster" && r.rating >= r.next.at
          ? "Reach #1 for Legendary Grandmaster"
          : `${num(r.next.at - r.rating)} more for ${r.next.name}`
        : "Top of the ladder",
  };
}

/* ------------------------------------------------------------- pieces */

/**
 * The card's fighter in the look you wear, framed on the creature itself
 * (the stage's frame leaves room for the live rig's motion, which a still
 * card doesn't need), so it fills the card.
 */
export const cardArt = (c: CharacterId, scope: string) =>
  fighterStageArt(c, scope)
    .split(`viewBox="${RIG_FRAME}"`)
    .join(`viewBox="${CREATURE_VIEWBOX}"`);

/** The card other players see: your fighter, title, name and tags. */
export function playerCard(d: ProfileData) {
  const level = d.journey ? playerLevel(d.journey.xp).level : null;
  const rank = rankLine(d.progress);
  const best = bestMastery(d.progress);
  const tags = [
    level !== null ? tag(`Lv ${level}`, "new") : "",
    rank
      ? `<span class="ui-tag pf-rank-tag" style="color:${rank.color}">${esc(rank.text)}</span>`
      : "",
    best ? tag(best.text) : "",
  ].join("");
  return `<aside class="pf-card" style="--el:${elVar(d.fighter)}" aria-label="Your player card"><span class="pf-card-art" aria-hidden="true">${cardArt(d.fighter, "profile")}</span><span class="pf-card-text">${d.title ? `<small class="pf-card-title player-title title-${titleTreatment(d.title)}" style="--title-color:${safeColor(d.titleColor)};color:${safeColor(d.titleColor)}">${esc(d.title)}</small>` : ""}<b class="pf-card-name">${esc(d.name)}</b><span class="pf-card-tags">${tags}</span></span></aside>`;
}

function tiles(d: ProfileData) {
  return `<div class="pf-tiles">${profileTiles(d.progress, d.raids)
    .map(
      (t) =>
        `<div class="pf-tile"><b class="ui-num">${esc(t.value)}</b><small>${esc(t.label)}</small></div>`,
    )
    .join("")}</div>`;
}

const section = (title: string, note: string, id: string) =>
  `<div class="pf-section"><h3 class="ui-h" id="${id}">${esc(title)}</h3><small class="ui-note">${esc(note)}</small></div>`;

/** Titles as chips: a tap wears it, saved at once. */
function titleChips(d: ProfileData, view: ProfileView) {
  const sorted = sortTitles(d.titles);
  const current = sorted.find((t) => t.name === d.title)?.id ?? "";
  const chip = (t: Title | null) => {
    const id = t?.id ?? "";
    const on = id === current;
    const busy = view.equipping === id;
    const color = t ? safeColor(t.color) : "var(--ui-dim)";
    return `<button type="button" class="pf-title-chip${on ? " is-on" : ""}" style="--title:${color}" aria-pressed="${on}" data-profile-title="${esc(id)}"${t?.description ? ` title="${esc(t.description)}"` : ""}${view.equipping !== null ? " disabled" : ""}${busy ? ' aria-busy="true"' : ""}><span>${esc(t?.name ?? "No title")}</span></button>`;
  };
  return `<div class="pf-titles" role="group" aria-labelledby="pf-titles-h">${chip(null)}${sorted.map(chip).join("")}</div>${sorted.length ? "" : '<p class="ui-note">Earn titles from ranks, raids, achievements and events. They show up here.</p>'}<p class="ui-note pf-status" role="status">${esc(view.status)}</p>`;
}

function masteryGrid(d: ProfileData) {
  return `<ul class="pf-mastery">${FIGHTER_IDS.map((id) => {
    const matches = d.progress?.fighters[id]?.matches ?? 0;
    const wins = d.progress?.fighters[id]?.wins ?? 0;
    const m = mastery(matches);
    const label = `${CHARACTERS[id].name}: ${m.tier?.name ?? "no"} mastery, ${matches} played, ${wins} won${m.next ? `, ${m.next.left} more for ${m.next.name}` : ""}`;
    return `<li class="pf-mastery-chip${m.tier ? "" : " is-none"}" style="--el:${elVar(id)}" title="${esc(label)}" aria-label="${esc(label)}">${avatar(fighterAvatar(id, `pf-m-${id}`), { element: CHARACTERS[id].element, size: 36 })}${ring(m.progress, 100, `<b class="ui-num">${m.tier ? m.tier.name[0] : "–"}</b>`, { label: `${m.tier?.name ?? "No"} mastery`, color: m.tier?.color ?? "var(--ui-faint)", size: 26 })}</li>`;
  }).join("")}</ul>`;
}

function summaries(d: ProfileData) {
  const lvl = d.journey ? playerLevel(d.journey.xp) : null;
  const s = d.journey ? seasonState(d.journey) : null;
  const journey = `<button type="button" class="pf-mini" data-profile-go="journey"><span class="ui-kicker">Journey</span><span class="pf-mini-row"><b>${lvl ? `Level ${lvl.level}` : "Journey"}</b><span class="ui-note">${s ? `Tier ${s.tier} / ${s.rules.tiers} · ${esc(s.theme.name)}` : "Levels and the season road"}</span></span>${bar(lvl ? lvl.percent : 0, 100, { label: "Progress to the next level" })}</button>`;
  const r = d.progress?.rating;
  const rank = rankLine(d.progress);
  const p = r ? rankProgress(r) : null;
  const ranked = `<button type="button" class="pf-mini" data-profile-go="ranks"><span class="ui-kicker">Ranked</span><span class="pf-mini-row"><b style="color:${rank?.color ?? "var(--ui-text)"}">${esc(rank?.text ?? "Ranks")}</b><span class="ui-note">${esc(p?.text ?? (d.progress ? "Play another player to get a rating" : "Loading…"))}</span></span>${bar(p?.value ?? 0, p?.max ?? 1, { label: "Progress to the next rank", color: rank?.color })}</button>`;
  return `<div class="pf-minis">${journey}${ranked}</div>`;
}

function trophies(d: ProfileData) {
  return `<ul class="pf-trophies">${RAID_BOSS_ORDER.map((b: RaidBossId) => {
    const clears = d.raids?.bosses?.[b]?.clears ?? 0;
    return `<li><button type="button" class="pf-trophy${clears ? "" : " is-none"}" style="--boss:${RAID_BOSSES[b].color}" data-profile-boss="${b}" aria-label="${esc(`${RAID_BOSSES[b].name}: ${clears} ${clears === 1 ? "clear" : "clears"}. Open its rewards`)}">${raidSplashImage(b)}<span class="pf-trophy-name">${esc(RAID_BOSSES[b].name)}</span><b class="ui-num">${num(clears)}</b></button></li>`;
  }).join("")}</ul>`;
}

function achievements(d: ProfileData) {
  const list = d.progress?.achievements ?? [];
  if (!list.length) return "";
  const earned = list.filter((a) => a.earnedAt).length;
  return `${section("Achievements", `${earned} / ${list.length} · each one gives its title`, "pf-ach-h")}<ul class="pf-achievements" aria-labelledby="pf-ach-h">${list
    .map(
      (a) =>
        `<li class="${a.earnedAt ? "is-earned" : ""}"><b>${esc(a.name)}</b><small>${esc(a.description)}</small></li>`,
    )
    .join("")}</ul>`;
}

/** Guests keep their progress by adding an email (Supabase sends a link). */
function saveAccount(view: ProfileView) {
  return `<form class="pf-save" data-profile-save><span class="pf-save-text"><b>Keep your progress</b><small class="ui-note">Guest accounts live only on this device. Add your email and your records, titles and name come with you.</small></span><span class="pf-save-row"><input name="email" type="email" required autocomplete="email" placeholder="you@example.com" aria-label="Email"><button type="submit" class="ui-btn is-s is-primary"><span>Save</span></button></span><small class="ui-note pf-save-status" role="status">${esc(view.saveStatus)}</small></form>`;
}

/** Your name: change it once every 14 days (the server keeps the count). */
function nameRow(d: ProfileData, view: ProfileView) {
  const locked = nameLockedFor(d.nameStatus);
  const note = locked
    ? `You can change it again in ${countdownText(locked)}`
    : `You can change it once every ${NAME_CHANGE_DAYS} days`;
  // The form is always in the markup (hidden when closed), so opening it
  // changes attributes and focus and the typed text stay put.
  const form = `<form class="pf-name-form" data-profile-name-form${view.renaming ? "" : " hidden"}><input name="name" maxlength="20" required autocomplete="nickname" spellcheck="false" aria-label="New name" value="${esc(d.name)}"${view.nameBusy ? " disabled" : ""}>${button("Cancel", { size: "s", disabled: view.nameBusy, attrs: { "data-profile-name-cancel": true } })}<button type="submit" class="ui-btn is-s is-primary"${view.nameBusy ? ' disabled aria-busy="true"' : ""}><span>Save</span></button></form>`;
  return `${section("Name", note, "pf-name-h")}<div class="pf-name" aria-labelledby="pf-name-h"><div class="pf-name-row"${view.renaming ? " hidden" : ""}><b class="pf-name-now">${esc(d.name)}</b>${button("Change name", { size: "s", disabled: !!locked, attrs: { "data-profile-rename": true, title: locked ? note : undefined } })}</div>${form}<p class="ui-note pf-name-message" role="status">${esc(view.nameMessage)}</p></div>`;
}

function main(d: ProfileData, view: ProfileView) {
  if (!d.progress && d.progressProblem)
    return `${tiles(d)}${emptyState("Your records aren't available", d.progressProblem, button("Try again", { size: "s", attrs: { "data-profile-retry": true } }))}`;
  return `${tiles(d)}${d.guest ? saveAccount(view) : ""}${nameRow(d, view)}${section("Title", "Tap to wear it · saved at once", "pf-titles-h")}${titleChips(d, view)}${section("Fighter mastery", "Badges for matches played", "pf-mastery-h")}${masteryGrid(d)}${summaries(d)}${section("Raid trophies", "Clears per boss", "pf-trophy-h")}${trophies(d)}${achievements(d)}<div class="pf-links">${button("Ranks", { icon: "leaderboard", attrs: { "data-profile-go": "ranks" } })}${button("Journey", { icon: "sparkle", attrs: { "data-profile-go": "journey" } })}${button("Raid rewards", { icon: "bestiary", attrs: { "data-profile-go": "raids" } })}</div><p class="ui-note pf-who">${esc(d.role)}${d.email ? ` · ${esc(d.email)}` : ""}</p>`;
}

export function profileMarkup(view: ProfileView, d: ProfileData) {
  const tools = button("Share card", {
    size: "s",
    icon: "share",
    attrs: { "data-profile-share": true },
  });
  return `<section class="ui-panel profile-panel" role="dialog" aria-label="Player card">${panelHead(d.name, "Player card", tools)}<div class="ui-panel-body pf-body">${playerCard(d)}<div class="pf-main" data-profile-main>${main(d, view)}</div></div></section>`;
}

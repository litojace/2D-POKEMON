/**
 * Raids (UI remodel step 5, docs/ui-remodel/PLAN.md): the Raid Hall (every
 * boss as a card, plus Attack practice) and a boss's page (its art on the
 * stage; Party · Attacks · Rewards · Guide). Markup and rules only (no DOM);
 * screens/raid-hall.ts wires it up.
 *
 * Raids have one difficulty: a boss's "difficulty" is its 1–3 stars. The
 * other bosses open after the first Grumblecrag clear, so a new player sees
 * locked cards that say why.
 */
import { CHARACTERS, type CharacterId } from "@arena/shared";
import type { Friend } from "../../../../packages/shared/src/accounts";
import { soloRevives } from "../raid-solo";
import {
  RAID_ATTACKS,
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  RAID_REWARDS,
  bossClears,
  frameStars,
  raidAttacksOf,
  raidChapters,
  raidPerksOf,
  type RaidAttack,
  type RaidBossId,
  type RaidProgress,
} from "../../../../packages/shared/src/raid";
import { raidGoals, type RaidGoal } from "../raid-presentation";
import { raidPortraitImage, raidSplashImage } from "../raid-splash-art";
import { fighterAvatar } from "../fighter-art";
import { friendStatus } from "./friends-view";
import { itemPicture } from "../shop-ui";
import { menuIcon } from "../menu-icons";
import {
  actionBar,
  actions,
  avatar,
  bar,
  button,
  chips,
  elementTag,
  emptyState,
  esc,
  iconButton,
  rarityTag,
  segmented,
  tabs,
  tag,
  type Presence,
  type RarityName,
} from "../ui/components";
import { cosmeticTier } from "../../../../packages/shared/src/cosmetic-tier";

export type RaidTab = "party" | "attacks" | "rewards" | "guide";
export const RAID_TABS: [RaidTab, string][] = [
  ["party", "Party"],
  ["attacks", "Attacks · practice"],
  ["rewards", "Rewards"],
  ["guide", "Guide"],
];
export type RaidFilter = "all" | "open" | "1" | "2" | "3";
export const RAID_FILTERS: [RaidFilter, string, string][] = [
  ["all", "All", "All bosses"],
  ["open", "Not cleared", "Bosses you have not cleared"],
  ["1", "★", "One-star bosses"],
  ["2", "★★", "Two-star bosses"],
  ["3", "★★★", "Three-star bosses"],
];
/** Up to four raiders: you and three more. */
export const RAID_SEATS = 4;

export interface RaidView {
  mode: "hall" | "boss";
  boss: RaidBossId;
  tab: RaidTab;
  filter: RaidFilter;
  /** The attack Practice drills (Attacks tab); the boss's first by default. */
  attack: RaidAttack | null;
  /** Solo (straight in) or With party (a room your party follows you into). */
  play: "solo" | "party";
  /** Friends invited from this page (the button says Invited). */
  invited: string[];
  /** The last answer worth telling (an invite refused, …). */
  status: string;
  /** The reward opened to its full rule (Rewards tab), if any. */
  reward?: string | null;
}
export interface RaidSeat {
  id: string;
  name: string;
  character: CharacterId;
  leader: boolean;
  me: boolean;
}
export interface RaidData {
  /** Saved raid progress; null when signed out or unavailable. */
  progress: RaidProgress | null;
  loading: boolean;
  problem: string;
  me: { name: string; character: CharacterId };
  /** Your Lobby party (you included), or empty when you play alone. */
  party: RaidSeat[];
  /** You lead your party, or have none: you can start. */
  leader: boolean;
  /** Your friends (online first), or null while loading / unavailable. */
  friends: Friend[] | null;
  /** You are in a room already (a raid can't start from here). */
  inRoom: boolean;
}

export const raidView = (
  boss: RaidBossId = "grumblecrag",
  extra: Partial<RaidView> = {},
): RaidView => ({
  mode: "hall",
  boss,
  tab: "party",
  filter: "all",
  attack: null,
  play: "solo",
  invited: [],
  status: "",
  ...extra,
});

/* ------------------------------------------------------------- rules */

/** The other bosses open after any Grumblecrag clear. */
export function raidUnlocked(p: RaidProgress | null, boss: RaidBossId) {
  if (boss === "grumblecrag") return true;
  return (p?.bosses?.grumblecrag?.clears ?? p?.clears ?? 0) > 0;
}
/** Clears of one boss (old saves kept Grumblecrag's at the top level). */
export function bossClearCount(p: RaidProgress | null, boss: RaidBossId) {
  return (
    p?.bosses?.[boss]?.clears ?? (boss === "grumblecrag" ? (p?.clears ?? 0) : 0)
  );
}
export function rewardCounts(p: RaidProgress | null, boss: RaidBossId) {
  const total = RAID_REWARDS.filter((r) => r.boss === boss).length;
  const earned = p ? raidGoals(p, boss).filter((g) => g.done).length : 0;
  return { earned, total };
}
/** The bosses the hall shows under a filter, in the game's order. */
export function hallBosses(filter: RaidFilter, p: RaidProgress | null) {
  return RAID_BOSS_ORDER.filter((id) => {
    const b = RAID_BOSSES[id];
    if (filter === "open") return b.playable && !bossClearCount(p, id);
    if (filter === "all") return true;
    return b.stars === Number(filter);
  });
}
/** Fighters with a trick against a boss (RAID_BOSS_PERKS). */
export function bossTricks(boss: RaidBossId) {
  return Object.entries(raidPerksOf(boss)).map(([c, perk]) => ({
    character: c as CharacterId,
    skill: perk!.skill,
    text: perk!.text,
  }));
}
/** Who sits in the four seats: you first, then your party. */
export function raidSeats(d: RaidData): RaidSeat[] {
  const me = d.party.find((s) => s.me) ?? {
    id: "me",
    name: d.me.name,
    character: d.me.character,
    leader: true,
    me: true,
  };
  return [
    { ...me, character: d.me.character },
    ...d.party.filter((s) => !s.me),
  ].slice(0, RAID_SEATS);
}
/** A friend you could invite to your party now. */
export const canInvite = (f: Friend, d: RaidData) =>
  !!f.online &&
  f.activity !== "match" &&
  f.activity !== "practice" &&
  !d.party.some((s) => s.id === f.id);
/** What Solo / With party will do, and whether Start raid can go now. */
export function startState(view: RaidView, d: RaidData) {
  const b = RAID_BOSSES[view.boss];
  const size = Math.max(1, d.party.length);
  const play: RaidView["play"] = size > 1 ? "party" : view.play;
  const reason = !b.playable
    ? `${b.name} is coming soon.`
    : !raidUnlocked(d.progress, view.boss)
      ? `Clear Grumblecrag once to unlock ${b.name}.`
      : d.inRoom
        ? "Leave your current room first."
        : !d.leader
          ? "Your party leader starts the raid."
          : "";
  const note = reason
    ? reason
    : play === "solo"
      ? soloRevives(view.boss)
        ? "Just you · one self-revive · a little less boss health"
        : "Just you · no revive at ★★★"
      : size > 1
        ? `${size} of ${RAID_SEATS} seats · your party follows you in`
        : `A room for up to ${RAID_SEATS} · invite friends there`;
  // Solo against a ★★★ boss: no self-revive, so the note is a warning.
  const warn = !reason && play === "solo" && !soloRevives(view.boss);
  return { play, ok: !reason, reason, note, soloLocked: size > 1, warn };
}
/** The attack Practice drills: the picked one, or the boss's first. */
export const practiceAttack = (view: RaidView) =>
  view.attack && raidAttacksOf(view.boss).includes(view.attack)
    ? view.attack
    : raidAttacksOf(view.boss)[0];

/* ------------------------------------------------------------ pieces */

const stars = (n: number) =>
  `<span class="rh-stars" role="img" aria-label="Difficulty ${n} of 3">${"★".repeat(n)}<i aria-hidden="true">${"★".repeat(3 - n)}</i></span>`;
const lockIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>`;
const fighterChip = (c: CharacterId, scope: string, size = 26) =>
  avatar(fighterAvatar(c, scope), { element: CHARACTERS[c].element, size });
const presenceOf = (f: Friend): Presence =>
  !f.online
    ? "away"
    : f.activity === "match" || f.activity === "practice"
      ? "busy"
      : f.activity === "town"
        ? "plaza"
        : "online";

function bossCard(id: RaidBossId, d: RaidData) {
  const b = RAID_BOSSES[id];
  const p = d.progress;
  const locked = b.playable && !raidUnlocked(p, id);
  const clears = bossClearCount(p, id);
  const { earned, total } = rewardCounts(p, id);
  const corner = !b.playable
    ? tag("Coming soon")
    : locked
      ? `<span class="ui-tag is-lock">${lockIcon}Clear Grumblecrag first</span>`
      : clears
        ? tag(`${clears} ${clears === 1 ? "clear" : "clears"}`, "ok")
        : tag("New", "new");
  const tricks = bossTricks(id).slice(0, 3);
  const label = `${b.name}, ${b.stars} ${b.stars === 1 ? "star" : "stars"}, ${b.element}${locked ? ", locked: clear Grumblecrag first" : !b.playable ? ", coming soon" : clears ? `, ${clears} ${clears === 1 ? "clear" : "clears"}` : ", new"}`;
  // A vertical card: the boss's portrait fills it, its name and details
  // over the foot of the picture.
  return `<button type="button" class="rh-card${locked ? " is-locked" : ""}${b.playable ? "" : " is-soon"}" style="--boss:${b.color}" data-raid-card="${id}" aria-label="${esc(label)}"><span class="rh-card-art">${raidPortraitImage(id)}</span><span class="rh-card-top">${corner}${stars(b.stars)}</span><span class="rh-card-text"><b class="rh-card-name">${esc(b.name)}</b><small class="ui-note rh-card-line">${esc(b.element)} · ${esc(b.signature)}</small><span class="rh-card-foot"><span class="rh-tricks" title="Fighters with a trick here">${tricks.map((t) => fighterChip(t.character, `rh-${id}-${t.character}`)).join("")}</span><span class="ui-note">${p ? `${earned} / ${total} rewards` : `${total} rewards`}</span></span></span></button>`;
}
function practiceCard() {
  return `<button type="button" class="rh-card rh-practice" data-raid-practice-card aria-label="Attack practice: drill any boss attack on its own"><span class="rh-practice-icon" aria-hidden="true">${menuIcon("target")}</span><span class="rh-card-text"><b class="ui-h">Attack practice</b><small class="ui-note">Drill any boss attack on its own. Nothing to lose.</small></span><span class="ui-btn is-s" aria-hidden="true">Choose an attack</span></button>`;
}

/* -------------------------------------------------------------- hall */

function hallMarkup(view: RaidView, d: RaidData) {
  const p = d.progress;
  const shown = hallBosses(view.filter, p);
  const filters = chips(
    RAID_FILTERS.map(([id, label, aria]) => ({
      id,
      label,
      selected: view.filter === id,
      attrs: { "aria-label": aria },
    })),
    "Filter bosses",
    "raid-filter",
  );
  const totals = p
    ? `${rewardTotal(p)} · ${p.totalClears ?? p.clears ?? 0} clears`
    : "";
  const notes = [
    d.loading
      ? `<p class="ui-note rh-note" role="status">Loading your raid records…</p>`
      : "",
    d.problem
      ? `<p class="ui-note rh-note is-problem" role="status">${esc(d.problem)} Raids are still playable; saved rewards need the database update (migrations 007–009) and server storage configuration.</p>`
      : "",
    !p && !d.loading && !d.problem
      ? `<p class="ui-note rh-note">Log in to save clears and rewards.</p>`
      : "",
  ].join("");
  const grid = shown.length
    ? `<div class="ui-grid rh-grid" role="group" aria-label="Bosses">${shown.map((id) => bossCard(id, d)).join("")}${practiceCard()}</div>`
    : emptyState(
        "Every boss here is cleared",
        "Try another filter, or run a favourite again.",
        button("Show all", { size: "s", attrs: { "data-raid-filter": "all" } }),
      );
  return `<section class="ui-panel rh-room" role="dialog" aria-label="Raids" data-raid-mode="hall"><header class="ui-panel-head rh-head"><div class="ui-heading"><span class="ui-kicker">Raid Hall · ${RAID_BOSS_ORDER.length} bosses · solo or up to ${RAID_SEATS}${totals ? ` · ${totals}` : ""}</span><h2 class="ui-title">Raids</h2></div>${filters}${iconButton("cancel", "Back to the Lobby", { class: "ui-close", "data-ui-close": true })}</header><div class="ui-panel-body rh-body rh-hall-body" data-raid-region="body"><div class="rh-notes">${notes}</div>${grid}</div></section>`;
}
function rewardTotal(p: RaidProgress) {
  const earned = RAID_BOSS_ORDER.reduce(
    (n, id) => n + rewardCounts(p, id).earned,
    0,
  );
  const total = RAID_REWARDS.filter((r) => r.boss).length;
  return `${earned}/${total} rewards`;
}

/* -------------------------------------------------------- boss page */

/**
 * Each boss's vertical framing of its (wide) painting, in fractions of the
 * picture: `body` is the point kept in the middle of a tall stage (head and
 * body together, like a poster), `face` the point a phone's small stage
 * zooms in on, by `zoom` (raid-hall.css does the arithmetic).
 */
export const BOSS_FRAMES: Record<
  RaidBossId,
  { body: [number, number]; face: [number, number]; zoom: number }
> = {
  grumblecrag: { body: [0.55, 0.4], face: [0.56, 0.26], zoom: 1.8 },
  tidewyrm: { body: [0.47, 0.62], face: [0.56, 0.64], zoom: 1.9 },
  gloomshade: { body: [0.52, 0.55], face: [0.6, 0.62], zoom: 1.7 },
  somnara: { body: [0.38, 0.4], face: [0.31, 0.33], zoom: 1.6 },
  prismatail: { body: [0.57, 0.45], face: [0.63, 0.2], zoom: 2 },
  emberwing: { body: [0.52, 0.5], face: [0.52, 0.47], zoom: 1.8 },
  "storm-twins": { body: [0.52, 0.4], face: [0.5, 0.35], zoom: 1.2 },
};
/**
 * The stage: the boss's painting framed vertically on the boss (a poster),
 * its name and how to win over the foot of it. Phones zoom in on the face.
 */
function stage(id: RaidBossId) {
  const b = RAID_BOSSES[id];
  const f = BOSS_FRAMES[id];
  const vars = `--el:${b.color};--cx:${f.body[0]};--cy:${f.body[1]};--fx:${f.face[0]};--fy:${f.face[1]};--fz:${f.zoom}`;
  return `<section class="ui-split-stage rh-stage" style="${vars}" aria-label="${esc(b.name)}"><span class="rh-poster">${raidSplashImage(id, true)}</span><div class="rh-stage-info"><span class="rh-row">${elementTag(b.element)}${stars(b.stars)}</span><b class="rh-stage-name">${esc(b.name)}</b><small class="ui-note rh-stage-line">${esc(b.epithet)}</small><p class="rh-win"><span class="ui-kicker">How to win</span><b>${esc(b.signature)}</b></p></div></section>`;
}
function seat(s: RaidSeat, i: number) {
  const sub = s.me
    ? s.leader && i === 0
      ? "You · leader"
      : "You"
    : s.leader
      ? "Leader"
      : "In your party";
  return `<div class="rh-seat${s.me ? " is-me" : ""}">${fighterChip(s.character, `rh-seat-${i}`, 52)}<b>${esc(s.name)}</b><small class="ui-note">${esc(sub)}</small></div>`;
}
/**
 * A reward: its picture, name, rule and progress. A tap opens it in place
 * to the whole rule and what the item is (the card's one-line rule is cut
 * short); another tap closes it. On a desktop the rule is also its tooltip.
 */
function rewardCard(g: RaidGoal, d: RaidData, scope: string, open: boolean) {
  const r = g.reward;
  const stars = d.progress ? frameStars(r.id, bossClears(d.progress)) : 0;
  const art =
    r.slot === "title"
      ? `<span class="rh-title-art" aria-hidden="true">${menuIcon("leaderboard")}</span>`
      : itemPicture(r.id, d.me.character, `${scope}-${r.id}`, 1, stars);
  const rarity =
    r.slot === "title"
      ? ""
      : rarityTag(cosmeticTier(r.id, stars) as RarityName);
  // The whole rule, and what the item is (a title is worn under your
  // name). Open, the short line keeps only progress (3/10 clears), never a
  // second copy of the rule.
  const more = `<span class="rh-reward-more" id="${scope}-${esc(r.id)}-more"><span><strong>How to earn</strong> ${esc(r.goal)}</span><span><strong>What it is</strong> ${esc(r.slot === "title" ? "A title to wear under your name" : r.description)}</span></span>`;
  const line =
    open && g.text === r.goal
      ? ""
      : `<small class="ui-note">${esc(g.text)}</small>`;
  return `<button type="button" class="rh-reward${g.done ? " is-done" : ""}${open ? " is-open" : ""}" data-raid-reward="${esc(r.id)}" aria-expanded="${open}"${open ? ` aria-controls="${scope}-${esc(r.id)}-more"` : ""} title="${esc(open ? "Tap to close" : r.goal)}"><span class="rh-reward-art">${art}</span><span class="rh-reward-text"><b>${esc(g.name)}</b>${rarity || line ? `<span class="rh-reward-line">${rarity}${line}</span>` : ""}${bar(g.value, g.max, { label: `${g.name} progress`, color: g.done ? "var(--ui-ok)" : "var(--boss)" })}${open ? more : ""}</span>${g.done ? `<span class="rh-check" role="img" aria-label="Earned">${menuIcon("check")}</span>` : ""}</button>`;
}
function partyTab(view: RaidView, d: RaidData) {
  const b = RAID_BOSSES[view.boss];
  const seats = raidSeats(d);
  const open = Array.from(
    { length: RAID_SEATS - seats.length },
    (_, k) =>
      `<button type="button" class="rh-seat is-open" data-raid-open-seat="${k}"><span class="rh-plus" aria-hidden="true">+</span><b>Invite</b><small class="ui-note">Open seat</small></button>`,
  ).join("");
  const friends =
    d.friends === null
      ? `<p class="ui-note">Loading your friends…</p>`
      : (() => {
          const list = d.friends
            .filter((f) => f.online && !d.party.some((s) => s.id === f.id))
            .slice(0, 6);
          if (!list.length)
            return `<p class="ui-note rh-nofriends">None of your friends are online right now. ${button("Friends", { size: "s", icon: "friends", attrs: { "data-raid-friends": true } })}</p>`;
          return list
            .map((f) => {
              const invited = view.invited.includes(f.id);
              const can = canInvite(f, d) && d.leader;
              const c = (
                f.fighter && Object.hasOwn(CHARACTERS, f.fighter)
                  ? f.fighter
                  : "voltkit"
              ) as CharacterId;
              return `<div class="ui-row rh-friend">${avatar(fighterAvatar(c, `rh-friend-${f.id}`), { element: CHARACTERS[c].element, status: presenceOf(f), size: 36 })}<span class="ui-row-main"><b>${esc(f.name)}</b><small>${esc(friendStatus(f))}</small></span><span class="ui-row-acts">${button(invited ? "Invited" : "Invite", { size: "s", kind: can && !invited ? "primary" : "default", icon: invited ? "check" : "add-friend", disabled: !can || invited, attrs: { "data-raid-invite": f.id, "aria-label": `${invited ? "Invited" : "Invite"} ${f.name}` } })}</span></div>`;
            })
            .join("");
        })();
  // Every fighter with a trick here: a tall screen shows them all; a short
  // one scrolls. The rewards have their own tab (owner, 5 Nov).
  const tricks = bossTricks(view.boss);
  return `<div class="rh-seats" role="group" aria-label="Raid party">${seats.map(seat).join("")}${open}</div>
<div class="rh-invites" data-raid-invites><span class="ui-kicker">Invite</span><div class="rh-friends">${friends}</div></div>
<p class="ui-note rh-status" role="status">${esc(view.status)}</p>
<div class="rh-section"><h3 class="ui-h">Good picks here</h3><small class="ui-note">Fighters with a trick against ${esc(b.name)}</small></div>
<div class="rh-picks">${tricks.map((t) => `<div class="rh-pick">${fighterChip(t.character, `rh-pick-${t.character}`, 40)}<span><b>${esc(CHARACTERS[t.character].name)}</b><small class="ui-note">${esc(t.skill)}: ${esc(t.text)}</small></span></div>`).join("")}</div>
<div class="rh-section rh-strip-head"><h3 class="ui-h">Its attacks</h3><small class="ui-note">Pick one to practise it</small></div>
<div class="rh-strip" role="group" aria-label="${esc(b.name)} attacks">${raidAttacksOf(
    view.boss,
  )
    .map(
      (a) =>
        `<button type="button" class="rh-attack is-mini" data-raid-attack-go="${a}" aria-label="Practise ${esc(RAID_ATTACKS[a].name)}: ${esc(RAID_ATTACKS[a].practice)}" title="${esc(RAID_ATTACKS[a].practice)}"><span class="rh-attack-icon" aria-hidden="true">${menuIcon(ATTACK_ICONS[a] ?? "target")}</span><span class="rh-attack-text"><b>${esc(RAID_ATTACKS[a].name)}</b></span></button>`,
    )
    .join("")}</div>`;
}
function attacksTab(view: RaidView, d: RaidData) {
  const b = RAID_BOSSES[view.boss];
  const pick = practiceAttack(view);
  const locked = b.playable && !raidUnlocked(d.progress, view.boss);
  return `<p class="ui-note">${raidAttacksOf(view.boss).length} attacks. Pick one, then Practice drills it on its own: nothing to lose, no rewards.</p><div class="rh-attacks" role="group" aria-label="${esc(b.name)} attacks">${raidAttacksOf(
    view.boss,
  )
    .map(
      (a) =>
        `<button type="button" class="rh-attack" data-raid-attack="${a}" aria-pressed="${a === pick}"${locked ? " disabled" : ""}><span class="rh-attack-icon" aria-hidden="true">${menuIcon(ATTACK_ICONS[a] ?? "target")}</span><span class="rh-attack-text"><b>${esc(RAID_ATTACKS[a].name)}</b><small>${esc(RAID_ATTACKS[a].practice)}</small></span></button>`,
    )
    .join("")}</div>`;
}
function rewardsTab(view: RaidView, d: RaidData) {
  const b = RAID_BOSSES[view.boss];
  if (!b.playable)
    return `<p class="ui-note">Each boss brings its own titles, skin, aura, entrance, frame and victory.</p>`;
  if (!d.progress)
    return `<p class="ui-note">${d.loading ? "Loading your progress…" : "Log in to see your progress."}</p>`;
  const goals = raidGoals(d.progress, view.boss);
  const { earned, total } = rewardCounts(d.progress, view.boss);
  return `<div class="rh-section"><h3 class="ui-h">${earned} of ${total} earned</h3>${button("Wardrobe", { size: "s", icon: "wardrobe", attrs: { "data-raid-wardrobe": true } })}</div><p class="ui-note">Wear what you earn in the Wardrobe; it shows on all your fighters. Appearance only, no stat changes.</p><div class="rh-rewards is-all">${goals.map((g) => rewardCard(g, d, "rh-all", view.reward === g.reward.id)).join("")}</div>`;
}
function guideTab(view: RaidView) {
  const b = RAID_BOSSES[view.boss];
  if (!b.playable)
    return `<p>${esc(b.blurb)}</p><p class="ui-note"><b>Coming soon.</b> Its attacks and rewards will be available when it arrives.</p>`;
  return `<p class="rh-blurb">${esc(b.blurb)}</p><div class="rh-section"><h3 class="ui-h">Three chapters</h3></div><ol class="rh-chapters">${raidChapters(
    view.boss,
  )
    .map(
      (c) =>
        `<li><b>${esc(c.name)}</b><small class="ui-note">${esc(c.objective)}</small></li>`,
    )
    .join(
      "",
    )}</ol><div class="rh-section"><h3 class="ui-h">Fighter tricks</h3></div><div class="rh-picks is-all">${bossTricks(
    view.boss,
  )
    .map(
      (t) =>
        `<div class="rh-pick">${fighterChip(t.character, `rh-guide-${t.character}`, 40)}<span><b>${esc(CHARACTERS[t.character].name)} · ${esc(t.skill)}</b><small class="ui-note">${esc(t.text)}</small></span></div>`,
    )
    .join(
      "",
    )}</div><p class="ui-note rh-rules">${soloRevives(view.boss) ? "Solo: one self-revive and a little less boss health." : "Solo: no revive against a ★★★ boss, and a little less boss health."} Teams revive each other. Raids never change your PvP rating.</p>`;
}
function bossMarkup(view: RaidView, d: RaidData) {
  const b = RAID_BOSSES[view.boss];
  const s = startState(view, d);
  const tabRow = tabs(
    RAID_TABS.map(([id, label]) => ({
      id,
      label,
      selected: view.tab === id,
    })),
    b.name,
    "raid-tab",
  );
  const body = {
    party: () => partyTab(view, d),
    attacks: () => attacksTab(view, d),
    rewards: () => rewardsTab(view, d),
    guide: () => guideTab(view),
  }[view.tab]();
  const mode = segmented(
    [
      {
        id: "solo",
        label: "Solo",
        selected: s.play === "solo",
        attrs: s.soloLocked
          ? { disabled: true, title: "Leave your party to raid solo" }
          : {},
      },
      { id: "party", label: "With party", selected: s.play === "party" },
    ],
    "How to raid",
    "raid-play",
  );
  const attack = practiceAttack(view);
  const foot = actionBar(
    s.ok
      ? `${mode}<small class="ui-note rh-foot-note${s.warn ? " is-warning" : ""}">${esc(s.note)}</small>`
      : `<small class="ui-note rh-foot-note is-reason" role="status">${esc(s.reason)}</small>`,
    actions(
      button("Practice", {
        icon: "target",
        disabled: !s.ok || !attack,
        attrs: {
          "data-raid-practice": attack ?? "",
          title: attack ? `Practise ${RAID_ATTACKS[attack].name}` : undefined,
        },
      }),
      button("Start raid", {
        kind: "primary",
        disabled: !s.ok,
        attrs: { "data-raid-start": s.play },
      }),
    ),
  );
  return `<section class="ui-panel is-split rh-room" role="dialog" aria-label="${esc(b.name)}" data-raid-mode="boss" data-raid-boss="${view.boss}" style="--boss:${b.color}">${stage(view.boss)}<div class="ui-split-main"><header class="ui-panel-head rh-head">${button("Raid Hall", { size: "s", icon: "back", attrs: { "data-raid-back": true } })}${view.tab === "guide" ? "" : `<span class="ui-note rh-hint">${esc(b.blurb)}</span>`}${iconButton("cancel", "Back to the Lobby", { class: "ui-close", "data-ui-close": true })}</header>${tabRow}<div class="ui-panel-body rh-body" data-raid-region="body" data-tab="${view.tab}">${body}</div>${foot}</div></section>`;
}

/** The whole screen: the hall, or one boss's page. */
export function raidMarkup(view: RaidView, d: RaidData) {
  return view.mode === "hall" ? hallMarkup(view, d) : bossMarkup(view, d);
}

/** One icon per boss attack, from the game's menu icons. */
const ATTACK_ICONS: Partial<
  Record<RaidAttack, Parameters<typeof menuIcon>[0]>
> = {
  charge: "motion",
  slam: "battle",
  debris: "sparkle",
  volley: "swipe",
  eruption: "target",
  share: "target",
  dive: "swipe",
  wave: "swipe",
  bubbles: "sparkle",
  hightide: "swipe",
  undertow: "motion",
  prison: "target",
  "prism-lance": "motion",
  "fan-display": "swipe",
  glare: "search",
  refraction: "sparkle",
  "halo-crush": "target",
  "light-relay": "sparkle",
  "dive-bomb": "motion",
  "ember-rain": "sparkle",
  "wing-gust": "swipe",
  "flame-ring": "target",
  "scorched-earth": "sparkle",
  "heat-mark": "target",
  "brazier-lighting": "sparkle",
  "link-beam": "motion",
  "chain-lightning": "motion",
  "static-field": "target",
  "twin-rush": "motion",
  polarity: "fullscreen",
  thunderclap: "target",
  lunge: "motion",
  hands: "battle",
  snuff: "target",
  curse: "sparkle",
  split: "fullscreen",
  pulse: "motion",
  lullaby: "sound",
  "tail-splash": "swipe",
  "dream-bubbles": "sparkle",
  "falling-stars": "sparkle",
  "whale-song": "sound",
  "dream-sequence": "sparkle",
  nightmare: "search",
};

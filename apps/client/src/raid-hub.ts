import {
  CHARACTERS,
  type CharacterId,
} from "@arena/shared";
import {
  RAID_ATTACKS,
  RAID_BOSSES,
  RAID_BOSS_ORDER,
  RAID_REWARDS,
  raidAttacksOf,
  raidChapters,
  raidPerksOf,
  type RaidBossId,
  type RaidProgress,
} from "../../../packages/shared/src/raid";
import { raidCrest } from "./raid-crests";
import { raidGoal, raidGoals } from "./raid-presentation";
import { iconLabel, menuIcon } from "./menu-icons";

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const time = (s: number) =>
  `${Math.floor(s / 60)}:${Math.floor(s % 60)
    .toString()
    .padStart(2, "0")}`;
const stars = (n: number) =>
  `<span class="raid-stars" aria-label="Difficulty ${n} of 3">${"★".repeat(n)}<span aria-hidden="true">${"★".repeat(3 - n)}</span></span>`;

export type RaidHubTab = "overview" | "attacks" | "rewards" | "records";
export const RAID_HUB_TABS: [RaidHubTab, string][] = [
  ["overview", "Overview"],
  ["attacks", "Attacks"],
  ["rewards", "Rewards"],
  ["records", "Records"],
];

/** The other bosses open after any Grumblecrag clear. */
export function raidUnlocked(p: RaidProgress | null, boss: RaidBossId) {
  if (boss === "grumblecrag") return true;
  return (p?.bosses?.grumblecrag?.clears ?? p?.clears ?? 0) > 0;
}

function rewardCount(p: RaidProgress | null) {
  const earned = p
    ? RAID_REWARDS.filter((r) => raidGoal(p, r).done).length
    : 0;
  return { earned, total: RAID_REWARDS.length };
}

/** Every boss is available through ordinary raids, with saved rewards and records. */
export function raidHubMarkup(p: RaidProgress | null) {
  const counts = rewardCount(p);
  const cards = RAID_BOSS_ORDER.map((id) => {
    const b = RAID_BOSSES[id];
    const goals = p ? raidGoals(p, id) : [];
    const done = goals.filter((g) => g.done).length;
    const total = RAID_REWARDS.filter((r) => r.boss === id).length;
    const record = p?.bosses?.[id] ?? (id === "grumblecrag" && p ? { highestPeril: p.highestPeril, clears: p.clears } : null);
    const locked = b.playable && !raidUnlocked(p, id);
    const flawless = RAID_REWARDS.some(
      (r) => r.boss === id && r.rule.kind === "flawless" && !!p?.earned?.includes(r.id),
    );
    const status = !b.playable
      ? `<span class="raid-card-ribbon">Coming soon</span>`
      : locked
        ? '<span class="raid-card-ribbon is-locked">Clear Grumblecrag to unlock</span>'
        : record && record.clears
          ? `<span class="raid-card-peril">Best: Peril ${record.highestPeril}${flawless ? " ✦" : ""}</span>`
          : '<span class="raid-card-ribbon is-new">New</span>';
    return `<button type="button" class="raid-boss-card${b.playable ? "" : " is-soon"}${locked ? " is-locked" : ""}" data-raid-boss="${id}" style="--boss:${b.color}"><span class="raid-card-art">${raidCrest(id)}</span><span class="raid-card-body"><span class="raid-card-top"><b>${b.name}</b>${stars(b.stars)}</span><small>${b.element}</small><span class="raid-card-signature">${b.signature}</span>${status}${b.playable && total ? `<span class="raid-card-progress"><progress value="${done}" max="${total}" aria-label="${b.name} rewards"></progress><small>${done}/${total} rewards</small></span>` : ""}</span></button>`;
  }).join("");
  return `<div class="raid-hub">
<header class="raid-hub-head"><div><div class="eyebrow">Boss raids · co-op · 1–4 players</div><h2>Raid Hub</h2></div><div class="raid-hub-totals"><span><b>${counts.earned}/${counts.total}</b>rewards</span><span><b>${p?.totalClears ?? p?.clears ?? 0}</b>clears</span></div></header>
<section class="raid-boss-grid" aria-label="Bosses">${cards}</section>
<section class="raid-hub-join"><label for="raid-join-code">Join a friend's raid</label><div class="join-row"><input id="raid-join-code" maxlength="6" placeholder="ABC123" autocomplete="off"><button type="button" class="secondary" id="raid-join">${iconLabel("enter", "Join")}</button></div></section>
${p ? "" : '<p class="raid-appearance-note">Log in to save clears and rewards. Peril 1 is always open.</p>'}
</div>`;
}

function overview(id: RaidBossId) {
  const b = RAID_BOSSES[id];
  if (!b.playable)
    return `<p>${b.blurb}</p><p class="raid-hub-soon"><b>Coming soon.</b> Its attacks and rewards will be available when it arrives.</p>`;
  const perks = Object.entries(raidPerksOf(id))
    .map(
      ([champ, perk]) =>
        `<li><b>${CHARACTERS[champ as CharacterId].name} · ${perk!.skill}</b><small>${perk!.text}</small></li>`,
    )
    .join("");
  return `<p>${b.blurb}</p><h4>Three chapters</h4><ol class="raid-hub-chapters">${raidChapters(id).map((c) => `<li><b>${c.name}</b><small>${c.objective}</small></li>`).join("")}</ol><h4>Champion tricks</h4><ul class="raid-hub-perks">${perks}</ul><p class="raid-hub-rules">Solo: one self-revive on Peril 1–2, none on Peril 3. Teams revive each other. Raids never change your PvP rating.</p>`;
}

function attacks(id: RaidBossId) {
  if (!RAID_BOSSES[id].playable) return `<p>Attack details arrive with the boss.</p>`;
  return `<ul class="raid-hub-attacks">${raidAttacksOf(id).map((a) => `<li><b>${RAID_ATTACKS[a].name}</b><small>${RAID_ATTACKS[a].tip}</small></li>`).join("")}</ul><p class="raid-hub-rules">Practice any attack from the raid lobby: the host opens <i>Practice the boss's attacks</i>.</p>`;
}

function rewards(id: RaidBossId, p: RaidProgress | null) {
  if (!RAID_BOSSES[id].playable) return `<p>Each boss brings its own titles, skin, aura, entrance, frame and victory.</p>`;
  if (!p) return `<p>Log in to see your progress.</p>`;
  return `<div class="raid-rewards">${raidGoals(p, id)
    .map(
      (g) =>
        `<div class="raid-goal${g.done ? " is-complete" : ""}"><span class="raid-reward-check" aria-hidden="true">${g.done ? "✓" : "○"}</span><span><b>${escape(g.name)}</b><small>${escape(g.text)}</small></span><progress value="${g.value}" max="${g.max}" aria-label="${escape(g.name)} progress"></progress></div>`,
    )
    .join("")}</div>`;
}

function records(id: RaidBossId, p: RaidProgress | null) {
  const b = RAID_BOSSES[id];
  if (!b.playable) return `<p>No records yet.</p>`;
  const r = p?.bosses?.[id] ?? (id === "grumblecrag" && p ? { clears: p.clears, highestPeril: p.highestPeril, bestSeconds: p.bestSeconds, runs: p.runs ?? 0 } : null);
  const feats = p?.stats?.[id]?.feats ?? 0;
  return `<div class="fighter-stats raid-hub-stats"><span><b>${r?.clears ?? 0}</b>Clears</span><span><b>${r?.highestPeril ?? 0}</b>Highest Peril</span><span><b>${r?.bestSeconds == null ? "—" : time(r.bestSeconds)}</b>Best clear</span><span><b>${r?.runs ?? 0}</b>Attempts</span><span><b>${feats}</b>Feats</span></div>`;
}

/** One boss: overview, attacks, rewards (with appearance) and records. */
export function raidBossPageMarkup(
  id: RaidBossId,
  tab: RaidHubTab,
  p: RaidProgress | null,
  appearance = "",
) {
  const b = RAID_BOSSES[id];
  const locked = b.playable && !raidUnlocked(p, id);
  const body =
    tab === "overview"
      ? overview(id)
      : tab === "attacks"
        ? attacks(id)
        : tab === "rewards"
          ? rewards(id, p) + (b.playable ? appearance : "")
          : records(id, p);
  return `<div class="raid-hub raid-boss-page" style="--boss:${b.color}">
<button type="button" class="quiet raid-hub-back" id="raid-hub-back">${iconLabel("back", "All bosses")}</button>
<header class="raid-boss-head"><div class="raid-boss-art">${raidCrest(id)}</div><div><span class="eyebrow">${b.element}</span><h2>${b.name}</h2><p>${b.epithet} ${stars(b.stars)}</p></div></header>
<div class="raid-hub-tabs" role="tablist" aria-label="${b.name}">${RAID_HUB_TABS.map(([t, label]) => `<button type="button" role="tab" id="raid-tab-${t}" aria-selected="${t === tab}" aria-controls="raid-tab-panel" data-raid-tab="${t}" class="${t === tab ? "is-active" : ""}">${label}</button>`).join("")}</div>
<section class="raid-hub-panel" id="raid-tab-panel" role="tabpanel" aria-labelledby="raid-tab-${tab}">${body}</section>
${
  b.playable
    ? locked
      ? `<p class="raid-hub-locked">${menuIcon("bestiary")}<span>Clear Grumblecrag once to unlock ${b.name}.</span></p>`
      : `<div class="raid-hub-actions"><button type="button" class="primary" data-raid-start="room">${iconLabel("create", "Create raid room")}</button><button type="button" class="secondary" data-raid-start="solo">${iconLabel("target", "Play solo now")}</button></div>`
    : ""
}
</div>`;
}

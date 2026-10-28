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
  type RaidAttack,
  type RaidBossId,
  type RaidProgress,
} from "../../../packages/shared/src/raid";
import { raidCrest } from "./raid-crests";
import { fighterAvatar } from "./fighter-art";
import { raidGuideSprite } from "./raid-guide-sprites";
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
  ["attacks", "Attacks & practice"],
  ["rewards", "Rewards"],
  ["records", "Records"],
];

const RAID_SKILL_ICONS: Record<RaidAttack, Parameters<typeof menuIcon>[0]> = {
  charge: "motion", slam: "battle", debris: "sparkle", volley: "swipe", eruption: "target", share: "target",
  dive: "swipe", wave: "swipe", bubbles: "sparkle", hightide: "swipe", undertow: "motion", prison: "target",
  "prism-lance": "motion", "fan-display": "swipe", glare: "search", refraction: "sparkle",
  "halo-crush": "target", "light-relay": "sparkle", "dive-bomb": "motion", "ember-rain": "sparkle",
  "wing-gust": "swipe", "flame-ring": "target", "scorched-earth": "sparkle", "heat-mark": "target",
  "brazier-lighting": "sparkle", "link-beam": "motion", "chain-lightning": "motion", "static-field": "target",
  "twin-rush": "motion", polarity: "fullscreen", thunderclap: "target", lunge: "motion", hands: "battle",
  snuff: "target", curse: "sparkle", split: "fullscreen", pulse: "motion", lullaby: "sound",
  "tail-splash": "swipe", "dream-bubbles": "sparkle", "falling-stars": "sparkle", "whale-song": "sound",
  "dream-sequence": "sparkle", nightmare: "search",
};

const raidSkillIcon = (attack: RaidAttack) => menuIcon(RAID_SKILL_ICONS[attack]);

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
        `<li><span class="raid-hub-perk-art" aria-hidden="true">${fighterAvatar(champ as CharacterId, `raid-perk-${id}-${champ}`)}</span><span class="raid-hub-perk-copy"><b>${CHARACTERS[champ as CharacterId].name} · ${perk!.skill}</b><small>${perk!.text}</small></span></li>`,
    )
    .join("");
  return `<p>${b.blurb}</p><h4>Three chapters</h4><ol class="raid-hub-chapters">${raidChapters(id).map((c) => `<li><b>${c.name}</b><small>${c.objective}</small></li>`).join("")}</ol><h4>Champion tricks</h4><ul class="raid-hub-perks">${perks}</ul><p class="raid-hub-rules">Solo: one self-revive on Peril 1–2, none on Peril 3. Teams revive each other. Raids never change your PvP rating.</p>`;
}

function attacks(id: RaidBossId) {
  if (!RAID_BOSSES[id].playable) return `<p>Attack details arrive with the boss.</p>`;
  return `<ul class="raid-hub-attacks">${raidAttacksOf(id).map((a) => `<li><div class="raid-attack-title"><span class="raid-attack-skill-icon" aria-hidden="true">${raidSkillIcon(a)}</span><b>${RAID_ATTACKS[a].name}</b></div><small>${RAID_ATTACKS[a].practice}</small><button type="button" class="secondary" data-hub-practice="${a}">${iconLabel("target", "Practise attack")}</button></li>`).join("")}</ul><p class="raid-hub-rules">Choose an attack to start a safe solo practice. Hits and dodges are counted; no health is lost.</p>`;
}

function roster(p: RaidProgress | null, selected: RaidBossId) {
  return `<nav class="raid-boss-roster" aria-label="Choose a raid boss">${RAID_BOSS_ORDER.map((id) => {
    const b = RAID_BOSSES[id];
    const record = p?.bosses?.[id] ?? (id === "grumblecrag" && p ? { highestPeril: p.highestPeril, clears: p.clears } : null);
    const locked = b.playable && !raidUnlocked(p, id);
    return `<button type="button" class="raid-roster-card${id === selected ? " is-selected" : ""}${locked ? " is-locked" : ""}" data-raid-boss="${id}" style="--boss:${b.color}" aria-pressed="${id === selected}" aria-label="${b.name}${locked ? ", locked" : ""}"><span class="raid-roster-art">${raidCrest(id)}</span><span class="raid-roster-name">${b.name}</span><span class="raid-roster-meta">${locked ? "Locked" : record?.clears ? `Peril ${record.highestPeril}` : b.element}</span></button>`;
  }).join("")}</nav>`;
}

function showcase(id: RaidBossId, p: RaidProgress | null) {
  const b = RAID_BOSSES[id];
  const locked = b.playable && !raidUnlocked(p, id);
  const moves = raidAttacksOf(id);
  const skills = moves.map((attack) => `<button type="button" class="raid-showcase-skill" data-hub-practice="${attack}" title="Practise ${RAID_ATTACKS[attack].name}"${locked ? " disabled" : ""}><span class="raid-showcase-skill-icon" aria-hidden="true">${raidSkillIcon(attack)}</span><span><b>${RAID_ATTACKS[attack].name}</b><small>${RAID_ATTACKS[attack].practice}</small></span></button>`).join("");
  return `<section class="raid-boss-showcase" style="--boss:${b.color}" aria-label="${b.name} boss overview"><div class="raid-showcase-stage"><span class="raid-showcase-aura"></span><svg class="raid-showcase-sprite" viewBox="-65 -65 130 115" aria-hidden="true" focusable="false"><g class="raid-showcase-pose raid-showcase-pose-idle">${raidGuideSprite(id, false, true, 0)}</g><g class="raid-showcase-pose raid-showcase-pose-action">${raidGuideSprite(id, false, false, 2)}</g></svg><span class="raid-showcase-ground"></span></div><div class="raid-showcase-content"><div class="raid-showcase-identity"><span class="eyebrow">${b.element} · ${b.epithet}</span><div class="raid-showcase-name"><h2>${b.name}</h2>${stars(b.stars)}</div><p>${b.blurb}</p></div><div class="raid-showcase-skills-head"><h3>Boss skills</h3><span>${moves.length} attacks · tap to practise</span></div><div class="raid-showcase-skills">${skills}</div>${locked ? `<p class="raid-hub-locked">${menuIcon("bestiary")}<span>Clear Grumblecrag once to unlock ${b.name}.</span></p>` : ""}</div></section>`;
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
${showcase(id, p)}
${roster(p, id)}
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

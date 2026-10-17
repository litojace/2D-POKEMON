import { CHARACTERS, type Snapshot } from "@arena/shared";
import {
  RAID_CHAPTERS,
  RAID_PINGS,
  RAID_REWARDS,
  type RaidBossId,
  type RaidContribution,
  type RaidProgress,
  type RaidReward,
} from "../../../packages/shared/src/raid";
import { fighterAvatar } from "./fighter-art";
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function raidCue(state: Snapshot, myId: string) {
  const r = state.raid!;
  if (state.phase !== "playing") return RAID_CHAPTERS[r.phase - 1].objective;
  if (r.staggerUntil > state.time)
    return "Core exposed — unleash your ultimates!";
  const w = r.warnings[0];
  if (w?.kind === "charge") {
    const locked = w.lockAt !== undefined && state.time >= w.lockAt;
    if (locked) return "Charge locked — clear the lane!";
    const who =
      w.targetId === myId
        ? "You are"
        : `${state.players.find((p) => p.id === w.targetId)?.name ?? "An ally"} is`;
    return `${who} targeted${w.teach ? " — lead the charge into a pillar!" : " — bait the charge!"}`;
  }
  if (w?.kind === "slam")
    return w.followUp
      ? "Second slam — jump again or leave the circle!"
      : w.teach
        ? "Ground slam — jump as the ring fills!"
        : "Slam — jump!";
  if (w?.kind === "debris")
    return w.teach
      ? "Falling debris — move out of the marked circles!"
      : "Debris — keep moving!";
  const name = (id?: string) =>
    id === myId
      ? "you"
      : (state.players.find((p) => p.id === id)?.name ?? "an ally");
  if (w?.kind === "volley")
    return w.teach
      ? "Rock volley — leave the cone or hide behind a pillar!"
      : "Volley — get out of the cone!";
  if (w?.kind === "eruption")
    return w.targetId === myId
      ? "Eruptions are chasing you — keep running, away from your team!"
      : `Eruptions chase ${name(w.targetId)} — give them room!`;
  if (w?.kind === "share") {
    if (w.lockAt !== undefined)
      return state.time >= w.lockAt
        ? "Meteor locked — step out of the circle!"
        : "Meteor on you — wait for it to lock, then step out!";
    return w.targetId === myId
      ? `Meteor on you — gather your team! (${w.sharers ?? 1} sharing)`
      : `Meteor on ${name(w.targetId)} — stack on them to share it! (${w.sharers ?? 1} sharing)`;
  }
  // A teammate's signal.
  const ping = [...(r.pings ?? [])]
    .reverse()
    .find((q) => q.until > state.time && q.playerId !== myId);
  if (ping)
    return `${state.players.find((p) => p.id === ping.playerId)?.name ?? "An ally"}: ${RAID_PINGS[ping.kind].label}!`;
  const down = state.players.find(
    (p) => !p.out && r.downed[p.id] && p.id !== myId,
  );
  if (down) return `Revive ${down.name} — stand inside their green ring.`;
  if (r.exposedUntil > state.time)
    return "Armor broken — strike the glowing core!";
  return RAID_CHAPTERS[r.phase - 1].objective;
}

/** One fun role per raider who stood out (top damage, revives, pillars). */
export function raidRoles(contributions: Record<string, RaidContribution>) {
  const roles: Record<string, string[]> = {};
  const best = (stat: "damage" | "revives" | "pillars", label: string) => {
    const top = Object.entries(contributions).sort(
      (a, b) => b[1][stat] - a[1][stat],
    )[0];
    if (top && top[1][stat] > 0) (roles[top[0]] ??= []).push(label);
  };
  best("damage", "Heavy Hitter");
  best("revives", "Medic");
  best("pillars", "Bait Master");
  return roles;
}
export function raidContributions(state: Snapshot) {
  const r = state.raid!;
  const roles = raidRoles(r.contributions ?? {});
  return `<section class="raid-contributions" aria-label="Team contributions"><h3>Team contributions</h3><div class="raid-score-head" aria-hidden="true"><span>Raider</span><span>Damage</span><span>Revives</span><span>Pillars</span></div>${state.players
    .filter((p) => !p.raidBoss)
    .map((p) => {
      const stats = r.contributions?.[p.id] ?? {
        damage: 0,
        revives: 0,
        pillars: 0,
      };
      return `<div class="raid-score-row"><div class="raid-score-player"><span class="raid-score-avatar" aria-hidden="true" data-raid-cosmetic="${Object.values(p.raidLook ?? {}).filter(Boolean).join(" ")}">${fighterAvatar(p.character, "raid-result-" + p.id)}</span><span><b>${escape(p.name)}</b><small>${CHARACTERS[p.character].name}${p.out ? " · Left" : ""}${r.standIns?.includes(p.id) ? " · AI stand-in" : ""}</small>${(roles[p.id] ?? []).map((role) => `<em class="raid-role">${role}</em>`).join("")}</span></div><span aria-label="Damage">${Math.round(stats.damage).toLocaleString("en-US")}</span><span aria-label="Revives">${stats.revives}</span><span aria-label="Pillars broken">${stats.pillars}</span></div>`;
    })
    .join(
      "",
    )}<p class="raid-score-note">Revives credit everyone who helped. Pillars credit the raider who baited the charge.</p></section>`;
}

export interface RaidGoal {
  id: string;
  reward: RaidReward;
  name: string;
  value: number;
  max: number;
  text: string;
  done: boolean;
}
/** Has the player earned a reward? Uses the server's list when it has one. */
function earnedReward(p: RaidProgress, reward: RaidReward, computed: boolean) {
  if (p.earned) return p.earned.includes(reward.id);
  // Before migration 009: titles and cosmetics are listed by name / id.
  return (
    computed ||
    p.cosmetics.includes(reward.id) ||
    (reward.slot === "title" && p.titles.includes(reward.name))
  );
}
/** One reward's exact progress from saved records (never invented). */
export function raidGoal(p: RaidProgress, reward: RaidReward): RaidGoal {
  const boss = reward.boss ?? "grumblecrag";
  const record = p.bosses?.[boss] ??
    (boss === "grumblecrag"
      ? { clears: p.clears, highestPeril: p.highestPeril }
      : { clears: 0, highestPeril: 0 });
  const rule = reward.rule;
  const label = reward.slot === "title" ? `${reward.name} title` : reward.name;
  const goal = (value: number, max: number, text: string) => {
    const done = earnedReward(p, reward, value >= max);
    return {
      id: reward.id,
      reward,
      name: label,
      value: done ? max : Math.min(value, max),
      max,
      text,
      done,
    };
  };
  switch (rule.kind) {
    case "clears":
      return goal(record.clears, rule.n, rule.n === 1 ? reward.goal : `${Math.min(record.clears, rule.n)}/${rule.n} clears`);
    case "peril":
      return goal(Math.min(record.highestPeril, rule.n), rule.n, reward.goal);
    case "stat": {
      const stats = p.stats?.[boss];
      const known = stats !== undefined || (boss === "grumblecrag" && p.pillars !== undefined);
      const have = stats?.[rule.stat] ?? (boss === "grumblecrag" ? (p[rule.stat] ?? 0) : 0);
      return goal(have, rule.n, known
        ? `${Math.min(have, rule.n)}/${rule.n} ${rule.stat === "pillars" ? "pillars baited" : "revives"} · wins and losses count`
        : "Counts from the next raid update");
    }
    case "total-clears": {
      const total = p.totalClears ?? p.clears;
      return goal(total, rule.n, `${Math.min(total, rule.n)}/${rule.n} clears across every boss`);
    }
    default:
      return goal(0, 1, reward.goal);
  }
}
/** Every reward for a boss (and the cross-boss ones), with exact progress. */
export function raidGoals(p: RaidProgress, boss: RaidBossId = "grumblecrag") {
  return RAID_REWARDS.filter((r) => r.boss === boss).map((r) => raidGoal(p, r));
}
export function raidRewardProgress(progress: RaidProgress | null | undefined) {
  if (!progress)
    return `<div class="raid-next-reward"><b>Your next reward</b><p>${progress === null ? "Open the Raid Hub to check your progress." : "Loading your reward progress…"}</p></div>`;
  // Rare Gilded encounters are never "next": they can't be worked towards.
  const goal = raidGoals(progress).find((g) => !g.done && g.reward.rule.kind !== "gilded") ?? {
    name: "All milestone rewards earned",
    text: "Try a new champion or today's Raid of the Day board.",
    value: 1,
    max: 1,
  };
  return `<div class="raid-next-reward"><span>YOUR NEXT MILESTONE</span><b>${goal.name}</b><progress aria-label="${goal.name}" value="${goal.value}" max="${goal.max}"></progress><p>${goal.text}</p></div>`;
}

import { CHARACTERS, type Snapshot } from "@arena/shared";
import {
  RAID_CHAPTERS,
  RAID_PINGS,
  RAID_TITLE_GOALS,
  type RaidContribution,
  type RaidProgress,
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

/** Every raid reward with its exact progress. */
export function raidGoals(p: RaidProgress) {
  const pillars = p.pillars ?? 0,
    revives = p.revives ?? 0;
  const counted = p.pillars !== undefined;
  return [
    { name: "Cragbreaker title", value: Math.min(p.clears, 1), max: 1, text: "Clear Grumblecrag" },
    { name: "Cragbound colors", value: Math.min(p.clears, 5), max: 5, text: `${Math.min(p.clears, 5)}/5 clears` },
    { name: "Cragstone skin", value: Math.min(p.clears, 10), max: 10, text: `${Math.min(p.clears, 10)}/10 clears` },
    { name: "Mountainborn entrance", value: Math.min(p.highestPeril, 2), max: 2, text: "Clear Peril 2" },
    { name: "Conqueror frame + Mountain Conqueror title", value: Math.min(p.highestPeril, 3), max: 3, text: "Clear Peril 3" },
    { name: "Mountain aura", value: p.cosmetics.includes("mountain-aura") ? 1 : 0, max: 1, text: "Clear Peril 3 with no downs" },
    ...Object.entries(RAID_TITLE_GOALS).map(([name, goal]) => {
      const have = goal.stat === "pillars" ? pillars : revives;
      return {
        name: `${name} title`,
        value: Math.min(have, goal.count),
        max: goal.count,
        text: counted
          ? `${Math.min(have, goal.count)}/${goal.count} ${goal.stat === "pillars" ? "pillars baited" : "revives"} · wins and losses count`
          : "Counts from the next raid update",
      };
    }),
  ];
}
export function raidRewardProgress(progress: RaidProgress | null | undefined) {
  if (!progress)
    return `<div class="raid-next-reward"><b>Your next reward</b><p>${progress === null ? "Open Bestiary & rewards to check your progress." : "Loading your reward progress…"}</p></div>`;
  const goal = raidGoals(progress).find((g) => g.value < g.max) ?? {
    name: "All milestone rewards earned",
    text: "Try a new champion or the weekly leaderboard.",
    value: 1,
    max: 1,
  };
  return `<div class="raid-next-reward"><span>YOUR NEXT MILESTONE</span><b>${goal.name}</b><progress aria-label="${goal.name}" value="${goal.value}" max="${goal.max}"></progress><p>${goal.text}</p></div>`;
}

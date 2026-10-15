import { CHARACTERS, type Snapshot } from "@arena/shared";
import {
  RAID_CHAPTERS,
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
  const down = state.players.find(
    (p) => !p.out && r.downed[p.id] && p.id !== myId,
  );
  if (down) return `Revive ${down.name} — stand inside their green ring.`;
  if (r.exposedUntil > state.time)
    return "Armor broken — strike the glowing core!";
  return RAID_CHAPTERS[r.phase - 1].objective;
}

export function raidContributions(state: Snapshot) {
  const r = state.raid!;
  return `<section class="raid-contributions" aria-label="Team contributions"><h3>Team contributions</h3><div class="raid-score-head" aria-hidden="true"><span>Raider</span><span>Damage</span><span>Revives</span><span>Pillars</span></div>${state.players
    .filter((p) => !p.raidBoss)
    .map((p) => {
      const stats = r.contributions?.[p.id] ?? {
        damage: 0,
        revives: 0,
        pillars: 0,
      };
      return `<div class="raid-score-row"><div class="raid-score-player"><span class="raid-score-avatar" aria-hidden="true">${fighterAvatar(p.character, "raid-result-" + p.id)}</span><span><b>${escape(p.name)}</b><small>${CHARACTERS[p.character].name}${p.out ? " · Left" : ""}</small></span></div><span aria-label="Damage">${Math.round(stats.damage).toLocaleString("en-US")}</span><span aria-label="Revives">${stats.revives}</span><span aria-label="Pillars broken">${stats.pillars}</span></div>`;
    })
    .join(
      "",
    )}<p class="raid-score-note">Revives credit everyone who helped. Pillars credit the raider who baited the charge.</p></section>`;
}

export function raidRewardProgress(progress: RaidProgress | null | undefined) {
  if (!progress)
    return `<div class="raid-next-reward"><b>Your next reward</b><p>${progress === null ? "Open Bestiary & rewards to check your progress." : "Loading your reward progress…"}</p></div>`;
  const goal =
    progress.clears < 1
      ? {
          name: "Cragbreaker title",
          detail: "Complete your first raid",
          value: 0,
          max: 1,
        }
      : progress.clears < 5
        ? {
            name: "Cragbound colors",
            detail: `${progress.clears}/5 clears`,
            value: progress.clears,
            max: 5,
          }
        : progress.highestPeril < 3
          ? {
              name: "Mountain Conqueror title",
              detail: `Highest Peril: ${progress.highestPeril}/3`,
              value: progress.highestPeril,
              max: 3,
            }
          : !progress.cosmetics.includes("mountain-aura")
            ? {
                name: "Mountain aura",
                detail: "Clear Peril 3 with no downs",
                value: 0,
                max: 1,
              }
            : {
                name: "All milestone rewards earned",
                detail: "Try a new champion or the weekly leaderboard.",
                value: 1,
                max: 1,
              };
  return `<div class="raid-next-reward"><span>YOUR NEXT MILESTONE</span><b>${goal.name}</b><progress aria-label="${goal.name}" value="${goal.value}" max="${goal.max}"></progress><p>${goal.detail}</p></div>`;
}

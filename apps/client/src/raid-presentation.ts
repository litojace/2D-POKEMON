import { portraitAvatar, portraitCosmetics } from "./portraits";
import { CHARACTERS, type Snapshot } from "@arena/shared";
import {
  raidChapters,
  DREAM_RUNE_NAMES,
  raidPingLabel,
  RAID_REWARDS,
  type RaidBossId,
  type RaidContribution,
  type RaidProgress,
  type RaidReward,
} from "../../../packages/shared/src/raid";
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
  if (state.phase !== "playing") return raidChapters(r.boss)[r.phase - 1].objective;
  if (r.staggerUntil > state.time)
    return "Core exposed — unleash your ultimates!";
  const w = r.warnings[0];
  const tide = somnaraCue(state, myId) || tidewyrmCue(state, myId) || gloomshadeCue(state, myId);
  if (tide) return tide;
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
    return `${state.players.find((p) => p.id === ping.playerId)?.name ?? "An ally"}: ${raidPingLabel(ping.kind, r.boss)}!`;
  const down = state.players.find(
    (p) => !p.out && r.downed[p.id] && p.id !== myId,
  );
  if (down) return `Revive ${down.name} — stand inside their green ring.`;
  if (r.exposedUntil > state.time)
    return r.boss === "tidewyrm"
      ? "Stranded — hit it while it's on dry land!"
      : r.boss === "gloomshade"
        ? "Found it — strike the glowing core!"
        : "Armor broken — strike the glowing core!";
  return raidChapters(r.boss)[r.phase - 1].objective;
}
/** Tidewyrm's callouts, most urgent first. */
function tidewyrmCue(state: Snapshot, myId: string) {
  const r = state.raid!;
  if (r.boss !== "tidewyrm") return "";
  const name = (id?: string) =>
    id === myId ? "you" : (state.players.find((p) => p.id === id)?.name ?? "an ally");
  const prison = r.prisons?.[0];
  if (prison)
    return prison.playerId === myId
      ? r.partySize > 1
        ? "Trapped in a bubble — mash attack while your team pops it!"
        : "Trapped in a bubble — mash attack to break out!"
      : `${name(prison.playerId)} is trapped — pop the bubble: three hits!`;
  if ((r.floodUntil ?? 0) > state.time)
    return r.partySize > 1 ? "High Tide — stay on an island, two per island!" : "High Tide — stay on an island!";
  if (r.undertow) return "Undertow — dash outward, away from the whirlpool!";
  const wave = (r.waves ?? [])[0];
  if (wave) return wave.high ? "High wave — be on an island!" : "Low wave — jump it!";
  const w = r.warnings[0];
  if (!w) return "";
  if (w.kind === "dive") {
    const locked = w.lockAt !== undefined && state.time >= w.lockAt;
    if (locked) return w.targetId === myId ? "It's locked — step off now!" : "Splash coming — clear the ring!";
    return w.targetId === myId
      ? w.teach
        ? "The ripple follows you — walk it onto an island, then step off!"
        : "Ripple on you — lead it onto an island!"
      : `The ripple follows ${name(w.targetId)} — give them room near an island.`;
  }
  if (w.kind === "wave") return w.high ? "A high wave is coming — get on an island!" : "A low wave is coming — get ready to jump!";
  if (w.kind === "bubbles") return w.teach ? "Bubbles — weave through or pop them with attacks!" : "Bubbles — weave through!";
  if (w.kind === "hightide") return "The water's rising — get on an island!";
  if (w.kind === "undertow") return "A whirlpool forms — move away from the centre!";
  if (w.kind === "prison") return w.targetId === myId ? "A bubble is closing on you!" : `A bubble is closing on ${name(w.targetId)}!`;
  return "";
}

/** Gloomshade's callouts, most urgent first. */
function gloomshadeCue(state: Snapshot, myId: string) {
  const r = state.raid!;
  if (r.boss !== "gloomshade") return "";
  const name = (id?: string) =>
    id === myId ? "you" : (state.players.find((p) => p.id === id)?.name ?? "an ally");
  const mine = r.curses?.[myId];
  if (mine && mine.hauntedUntil > state.time) return "Haunted — get into lantern light to cleanse it!";
  const w = r.warnings[0];
  if (w?.kind === "hands")
    return w.shiftAt !== undefined && state.time < w.shiftAt
      ? "Grasping Hands — the tiles will flip! Watch for the flicker."
      : "Grasping Hands — stand on a tile without hands!";
  if (w?.kind === "pulse") return w.teach ? "Nightmare Pulse — jump as the ring fills (every copy shows one)!" : "Nightmare Pulse — jump!";
  if (w?.kind === "lunge")
    return w.targetId === myId ? "Shadow Lunge on you — sidestep the lane!" : `Shadow Lunge at ${name(w.targetId)} — keep out of the lane!`;
  if (mine && mine.stacks > 0)
    return r.partySize > 1 ? "Cursed — move away from your team and find lantern light!" : "Cursed — keep moving and find lantern light!";
  if (w?.kind === "snuff") return "A lantern is going out!";
  if (w?.kind === "curse")
    return w.targetId === myId ? "A curse is coming for you — find lantern light!" : `A curse is coming for ${name(w.targetId)} — spread out!`;
  if (w?.kind === "split") return "It's splitting — watch which one casts a shadow in the light!";
  if (r.exposedUntil > state.time) return "";
  if ((r.revealUntil ?? 0) > state.time) return "The real one is marked — hit it six times in a row!";
  if ((r.decoys?.length ?? 0) > 0) return "Find the real one: only it casts a shadow in lantern light. Copies curse you.";
  if ((r.lanterns ?? []).some((l) => !l.lit)) return "A lantern is out — hit it twice to relight it.";
  return "";
}

/** Somnara's private cues use only the recipient's view. */
function somnaraCue(state: Snapshot, myId: string) {
  const r = state.raid!;
  if (r.boss !== "somnara") return "";
  const drowsy = r.drowsy?.[myId];
  if (drowsy && drowsy.sleepUntil > state.time) return "Asleep — a teammate can tap you awake without hurting you!";
  if (r.quietZone) return "Whale Song — follow the moving teal Quiet Zone!";
  if (r.warnings.some(w => w.kind === "falling-stars")) return "Falling Stars — stand between the constellation points!";
  const dream = r.dream, view = state.raidDream;
  if (dream) {
    if (view?.id === dream.id && view.full) return `${dream.dreamerId === myId ? "You are the Dreamer" : "Dream revealed"}${view.backwards ? " — read RIGHT TO LEFT" : ""}. Call 1–4, then step the pads (${dream.step}/${dream.length}).`;
    const called = [...(r.runeCalls ?? [])].reverse().find(q => q.until > state.time && q.step === dream.step && q.playerId === dream.dreamerId);
    return called ? `${DREAM_RUNE_NAMES[called.rune]} called — enter that rune pad (${dream.step}/${dream.length})!` : "Listen to the Dreamer's rune calls, then enter the pads in order.";
  }
  if (r.exposedUntil > state.time) return "Dream solved — strike Somnara's shining heart!";
  if (r.warnings.some(w => w.kind === "lullaby") || r.dreamRings?.length) return "Lullaby Rings — jump! Three Drowsy stacks put you to sleep.";
  if (r.warnings.some(w => w.kind === "tail-splash")) return "Tail Splash — leave the marked lane!";
  if (r.dreamBubbles?.length) return "Pop the Dream Bubbles or outrun them.";
  return "";
}
/** One fun role per raider who stood out (top damage, revives, pillars). */
export function raidRoles(
  contributions: Record<string, RaidContribution>,
  boss: RaidBossId = "grumblecrag",
) {
  const roles: Record<string, string[]> = {};
  const best = (stat: "damage" | "revives" | "pillars", label: string) => {
    const top = Object.entries(contributions).sort(
      (a, b) => b[1][stat] - a[1][stat],
    )[0];
    if (top && top[1][stat] > 0) (roles[top[0]] ??= []).push(label);
  };
  best("damage", "Heavy Hitter");
  best("revives", "Medic");
  best("pillars", boss === "tidewyrm" ? "Strand Master" : boss === "gloomshade" ? "Lantern Keeper" : boss === "somnara" ? "Dream Guide" : "Bait Master");
  return roles;
}
/** What the boss-feature column counts (pillars baited, strands …). */
export const featureLabel = (boss: RaidBossId) =>
  boss === "tidewyrm" ? "Strands" : boss === "gloomshade" ? "Relights" : boss === "somnara" ? "Runes" : "Pillars";
export function raidContributions(state: Snapshot) {
  const r = state.raid!;
  const roles = raidRoles(r.contributions ?? {}, r.boss);
  return `<section class="raid-contributions" aria-label="Team contributions"><h3>Team contributions</h3><div class="raid-score-head" aria-hidden="true"><span>Raider</span><span>Damage</span><span>Revives</span><span>${featureLabel(r.boss)}</span></div>${state.players
    .filter((p) => !p.raidBoss)
    .map((p) => {
      const stats = r.contributions?.[p.id] ?? {
        damage: 0,
        revives: 0,
        pillars: 0,
      };
      return `<div class="raid-score-row"><div class="raid-score-player"><span class="raid-score-avatar" aria-hidden="true" data-raid-cosmetic="${portraitCosmetics(p)}">${portraitAvatar(p, "raid-result-" + p.id)}</span><span><b>${escape(p.name)}</b><small>${CHARACTERS[p.character].name}${p.out ? " · Left" : ""}${r.standIns?.includes(p.id) ? " · AI stand-in" : ""}</small>${(roles[p.id] ?? []).map((role) => `<em class="raid-role">${role}</em>`).join("")}</span></div><span aria-label="Damage">${Math.round(stats.damage).toLocaleString("en-US")}</span><span aria-label="Revives">${stats.revives}</span><span aria-label="${r.boss === "tidewyrm" ? "Strands" : r.boss === "gloomshade" ? "Lanterns relit" : r.boss === "somnara" ? "Correct runes" : "Pillars broken"}">${stats.pillars}</span></div>`;
    })
    .join(
      "",
    )}<p class="raid-score-note">Revives credit everyone who helped. ${r.boss === "somnara" ? "Runes credit the raider whose fighter or clone entered the correct pad." : r.boss === "tidewyrm" ? "Strands credit the raider who baited the dive." : r.boss === "gloomshade" ? "Relights credit the raider who lit the lantern." : "Pillars credit the raider who baited the charge."}</p></section>`;
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
        ? `${Math.min(have, rule.n)}/${rule.n} ${rule.stat === "pillars" ? (boss === "tidewyrm" ? "strands" : boss === "gloomshade" ? "lanterns relit" : boss === "somnara" ? "correct runes" : "pillars baited") : "revives"} · wins and losses count`
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
export function raidRewardProgress(
  progress: RaidProgress | null | undefined,
  boss: RaidBossId = "grumblecrag",
) {
  if (!progress)
    return `<div class="raid-next-reward"><b>Your next reward</b><p>${progress === null ? "Open the Raid Hub to check your progress." : "Loading your reward progress…"}</p></div>`;
  // Rare Gilded encounters are never "next": they can't be worked towards.
  const goal = raidGoals(progress, boss).find((g) => !g.done && g.reward.rule.kind !== "gilded") ?? {
    name: "All milestone rewards earned",
    text: "Try a new champion or today's Raid of the Day board.",
    value: 1,
    max: 1,
  };
  return `<div class="raid-next-reward"><span>Your next milestone</span><b>${goal.name}</b><progress aria-label="${goal.name}" value="${goal.value}" max="${goal.max}"></progress><p>${goal.text}</p></div>`;
}

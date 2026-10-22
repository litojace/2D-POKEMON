import { CHARACTERS } from "@arena/shared";
import {
  MISSION_BY_ID,
  type MissionMetric,
} from "../../../packages/shared/src/shop";
import { RAID_REWARDS } from "../../../packages/shared/src/raid";
import { RAID_BOSSES } from "../../../packages/shared/src/raid-roster";

/** Explain the same metrics that finished matches and raids award. */
export function missionHelp(id: string) {
  const mission = MISSION_BY_ID[id];
  if (!mission)
    return "Complete the objective shown on this card in a finished match or raid.";
  const champions = mission.champions
    ?.map((c) => CHARACTERS[c].name)
    .join(" or ");
  const instructions: Record<MissionMetric, string> = {
    play: "Finish matches against bots or other players. Wins and losses count. Completed bot matches have no minimum duration; matches against players must last at least 20 seconds. Raids do not count for this mission.",
    wins: "Win a full match against a bot or other players. Completed bot matches have no minimum duration; matches against players must last at least 20 seconds. Raid clears do not count as match wins.",
    "pvp-wins":
      "Win full matches against other players in a room with no bots. Matches must last at least 20 seconds; bot wins and raid clears do not count.",
    "skill-uses":
      "Activate skills 1–4 in matches or raids. Successful casts, including ultimates, count across multiple games. Basic attacks do not count.",
    ults: "Fill your ultimate meter, then activate skill 4 in a match or raid. Repeat across games until you reach the target. EX skills do not count as ultimates.",
    "raid-clear":
      "Choose Boss Raid and defeat a boss on any Peril. Solo and party clears count, including Raid of the Day. Defeats do not count.",
    "daily-clear":
      "Choose Boss Raid, enable Raid of the Day in the lobby, and defeat today's boss. A regular raid against the same boss does not count.",
    revives:
      "Play a raid with allies. Stand close to a downed ally to fill their revive bar. Each completed revive you helped with counts, even if another ally also helped. Solo self-revives do not count.",
    "raid-peril3":
      "Choose Boss Raid, turn off Raid of the Day, select Peril 3, and defeat the boss. Clear lower Perils first if Peril 3 is locked. Solo or party clears count.",
    "raid-flawless":
      "Defeat a raid boss without anyone in the party being downed during the entire run. You can do this solo on any Peril. Taking damage is allowed; being revived does not restore a flawless run.",
    feat: "Win a raid while completing that boss's special feat. Any Peril counts; the challenges below must be completed within one run.",
    "hard-bot-win":
      "Choose Hard under bot difficulty on the home screen, then select Battle an AI bot and win the full match. Completed matches count at any duration. Easy and Normal bots do not count.",
    "wins-with": `Choose ${champions ?? "one of the fighters named on this card"}, then win a match against a bot or other players. Completed bot matches have no minimum duration; matches against players must last at least 20 seconds. Raid clears do not count.`,
    "teams-unharmed":
      "Win a full 2v2 Teams match without your fighter being knocked out in any round. Your teammate may be knocked out. Completed bot matches have no minimum duration; matches against players must last at least 20 seconds.",
    "bot-wins":
      "Select Battle an AI bot and win full matches on any difficulty. Completed matches count at any duration. Wins against players do not count for this mission.",
    minutes:
      "Play matches or raids and finish them. Whole minutes from each finished game add together; time in menus does not count. You do not need to reach the target in one game.",
    "raid-play":
      "Finish a raid by defeating the boss or reaching a defeat result. A defeat must last at least 20 seconds to count. Leaving early or using attack practice does not count.",
    "raid-solo":
      "Start a Boss Raid with only yourself in the party and defeat the boss. Any Peril counts. Clearing a raid with another player does not count as solo.",
    "raid-solo-p2":
      "Start a Boss Raid alone on Peril 2 or Peril 3 and defeat the boss. Raid of the Day also counts when played alone. Peril 1 clears do not count.",
    "raid-party":
      "Create a Boss Raid room, share its code with another player, and defeat the boss together. Any Peril counts. You do not need to add each other to your Friends list.",
    "ffa-wins":
      "Choose Free-for-all, play against other players with no bots, and win the full match. The match must last at least 20 seconds. Duel and 2v2 wins do not count.",
  };
  return instructions[mission.metric];
}

/** Use the reward catalog so boss feat instructions stay consistent. */
export function missionFeatExamples(id: string) {
  return MISSION_BY_ID[id]?.metric === "feat"
    ? RAID_REWARDS.filter((item) => item.boss && item.rule.kind === "feat").map(
        (item) =>
          `${RAID_BOSSES[item.boss!].name}: ${item.goal.replace(/^Feat:\s*/i, "")}.`,
      )
    : [];
}

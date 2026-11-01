import type { CharacterId } from "@arena/shared";
import {
  RAID_BOSSES,
  RAID_REWARDS,
  type RaidProgress,
  type RaidReward,
} from "../../../packages/shared/src/raid";
import { itemPicture } from "./shop-ui";
import { tierChip } from "./tier-chip";
import "./reward-reveal.css";

/**
 * "You unlocked something": a card that flips over when a raid clear earns
 * new rewards. Which rewards a player has already seen is remembered per
 * account in this browser; the first time we see an account we only record
 * its rewards (no flood of old unlocks), so only real new ones are revealed.
 */
const KEY = (account: string) => `ea-seen-rewards:${account}`;
function read(account: string): Set<string> | undefined {
  try {
    const raw = localStorage.getItem(KEY(account));
    return raw ? new Set(JSON.parse(raw) as string[]) : undefined;
  } catch {
    return undefined;
  }
}
function write(account: string, ids: Iterable<string>) {
  try {
    localStorage.setItem(KEY(account), JSON.stringify([...ids]));
  } catch {
    /* Optional: without storage the reveal simply does not repeat-guard. */
  }
}
function earnedIds(p: RaidProgress) {
  return new Set([...(p.earned ?? []), ...(p.cosmetics ?? [])]);
}
/** Remember what this account has, without revealing it (sign-in, hub). */
export function noteSeenRewards(account: string | undefined, p: RaidProgress) {
  if (!account) return;
  const seen = read(account) ?? new Set<string>();
  for (const id of earnedIds(p)) seen.add(id);
  write(account, seen);
}
/** Rewards earned since this account last looked; marks them seen. */
export function takeNewRewards(
  account: string | undefined,
  p: RaidProgress,
): RaidReward[] {
  if (!account) return [];
  const seen = read(account);
  const earned = earnedIds(p);
  write(account, new Set([...(seen ?? []), ...earned]));
  if (!seen) return [];
  return RAID_REWARDS.filter((r) => earned.has(r.id) && !seen.has(r.id));
}

const SLOT_LABEL: Record<string, string> = {
  title: "Title",
  skin: "Colors",
  frame: "Portrait frame",
  aura: "Aura",
  entrance: "Entrance",
  victory: "Victory pose",
};
const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

export function rewardCard(r: RaidReward, champion: CharacterId) {
  const boss = r.boss ? RAID_BOSSES[r.boss] : undefined;
  const art =
    r.slot === "title"
      ? `<span class="reveal-title-art">${escape(r.name)}</span>`
      : itemPicture(r.id, champion, `reveal-${r.id}`);
  return `<div class="reveal-card" style="--reveal:${boss?.color ?? "#ffd76a"}"><div class="reveal-face reveal-back" aria-hidden="true"><span>?</span></div><div class="reveal-face reveal-front"><span class="reveal-slot">${SLOT_LABEL[r.slot] ?? r.slot}</span>${r.slot === "title" ? "" : tierChip(r.id)}<span class="reveal-art">${art}</span><b class="reveal-name">${escape(r.name)}</b><small class="reveal-source">${boss ? escape(boss.name) : "Boss raids"} · ${escape(r.goal)}</small></div></div>`;
}

/** Show the new rewards one card at a time. Resolves when dismissed. */
export function showRewardReveal(
  rewards: RaidReward[],
  champion: CharacterId,
  host: HTMLElement = document.body,
) {
  if (!rewards.length) return Promise.resolve();
  document.getElementById("reward-reveal")?.remove();
  const root = document.createElement("div");
  root.id = "reward-reveal";
  root.setAttribute("role", "dialog");
  root.setAttribute("aria-modal", "true");
  root.setAttribute("aria-label", "New reward unlocked");
  host.append(root);
  let index = 0;
  return new Promise<void>((resolve) => {
    const show = () => {
      const r = rewards[index];
      const last = index === rewards.length - 1;
      root.innerHTML = `<div class="reveal-stage"><p class="reveal-eyebrow">New reward unlocked${rewards.length > 1 ? ` · ${index + 1} of ${rewards.length}` : ""}</p>${rewardCard(r, champion)}<button type="button" class="primary reveal-next">${last ? "Awesome!" : "Next reward"}</button><p class="reveal-hint">${r.slot === "title" ? "Equip it from your profile." : "Equip it in the Wardrobe."}</p></div>`;
      // Flip on the next frame so the turn animates.
      requestAnimationFrame(() =>
        root.querySelector(".reveal-card")?.classList.add("is-flipped"),
      );
      const button = root.querySelector<HTMLButtonElement>(".reveal-next")!;
      button.focus({ preventScroll: true });
      button.onclick = () => {
        if (last) {
          root.remove();
          resolve();
        } else {
          index++;
          show();
        }
      };
    };
    show();
  });
}

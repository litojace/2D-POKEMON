/**
 * What a finished match gave you, on its result sheet (owner, 26 Nov 2026):
 * a short celebration in the plain summary's place. Your fighter hops and
 * confetti falls on a win, then one tile after another shows what moved: XP
 * (the bar runs, LEVEL UP when it fills, and what the level opened), rank,
 * the season, your fighter's mastery, coins. A player should feel what they
 * just earned before the button asks for another match.
 *
 * Markup and the numbers behind it; no layout is read here. The sheet is
 * drawn again whenever its markup changes (overlay.ts sets innerHTML: the
 * XP arriving, the opponent ready), which would start every animation over,
 * so syncRewardMotion puts each tile's animations back where they were.
 * Everything animates by transform and opacity (docs/network-performance.md,
 * "Keeping battles smooth"); reduced motion and Low graphics show the end
 * state at once.
 */
import {
  LEVEL_MILESTONES,
  levelUpCoins,
  MAX_PLAYER_LEVEL,
  milestoneNames,
  playerLevel,
  seasonRules,
  type Journey,
} from "../../../packages/shared/src/journey";
import {
  MASTERY_TIERS,
  RANKS,
  masteryTier,
  nextMastery,
  rankColor,
  type Rating,
} from "../../../packages/shared/src/accounts";
import { esc } from "./ui/components";
import { menuIcon, type IconName } from "./menu-icons";
import { unlocksBetween } from "./feature-unlocks";
import { xpAward, type XpAward } from "./adventure-ui";
import "./result-rewards.css";

export interface RewardFacts {
  won: boolean;
  journey: Journey | undefined;
  /** "match:<id>", once the match has one. */
  ref: string | undefined;
  status?: "saving" | "saved" | "unavailable";
  /** You played long enough to earn XP (server.ts activityEligible). */
  eligible: boolean;
  /** Your rating after a rated match, once every player's game saved it. */
  rating?: Rating;
  /** The fighter you played, and your matches with it. */
  mastery?: { fighter: string; matches: number };
  /** Coins this match paid, once the balance has moved. */
  coins?: number;
  /** No motion: reduced motion or Low graphics. */
  still?: boolean;
  /** The daily gift, in a line: tomorrow's, or today's still waiting. */
  gift?: string;
}

const num = (n: number) => n.toLocaleString("en-US");
const clamp01 = (n: number) => Math.max(0, Math.min(1, n));
const signed = (n: number) => `${n >= 0 ? "+" : "−"}${num(Math.abs(n))}`;

/** A bar that runs from `from` to `to` (0–1); `wrap`: it filled and began again. */
function bar(from: number, to: number, wrap = false, label = "") {
  return `<span class="rw-bar${wrap ? " is-wrap" : ""}" role="img" aria-label="${esc(label)}" style="--from:${clamp01(from).toFixed(3)};--to:${clamp01(to).toFixed(3)}"><i></i></span>`;
}
interface Tile {
  id: string;
  icon: IconName;
  label: string;
  /** Where you stand now ("Lv 2", "Pupil · 1,020"). */
  value: string;
  /** What this match added ("+125 XP"); markup. */
  gain?: string;
  bar?: string;
  /** A line under the bar. */
  note?: string;
  /** A burst over the tile once its bar has run ("LEVEL UP"). */
  burst?: string;
  tone?: "up" | "down";
}
const tile = (t: Tile, i: number) =>
  `<li class="rw-tile${t.burst ? " has-burst" : ""}${t.tone ? ` is-${t.tone}` : ""}" data-rw="${t.id}" style="--i:${i}"><span class="rw-icon" aria-hidden="true">${menuIcon(t.icon)}</span><span class="rw-head"><span class="rw-label">${esc(t.label)}</span>${t.gain ? `<em class="rw-gain">${t.gain}</em>` : ""}</span><b class="rw-value">${t.value}</b>${t.bar ?? ""}${t.note ? `<small class="rw-note">${t.note}</small>` : ""}${t.burst ? `<strong class="rw-burst">${esc(t.burst)}</strong>` : ""}</li>`;

/**
 * Where the XP came from, short enough for a tile ("Match 25 · First Win
 * 75 · Spark 100"); nothing when it all came from the match itself.
 */
export function xpBreakdown(a: XpAward) {
  const parts = [
    a.run ? `Match ${num(a.run)}` : "",
    a.firstWin ? `First Win ${num(a.firstWin)}` : "",
    a.missions ? `Missions ${num(a.missions)}` : "",
    a.spark ? `Spark ${num(a.spark)}` : "",
  ].filter(Boolean);
  return parts.length > 1 ? parts.join(" · ") : "";
}
/** The XP tile: the level bar from before the match to after it. */
export function xpTile(a: XpAward): Tile {
  const before = playerLevel(a.xpBefore),
    after = playerLevel(a.xpAfter),
    up = after.level > before.level;
  return {
    id: "xp",
    icon: "sparkle",
    label: "XP",
    value: `Lv ${after.level}${after.needed ? ` <small>${num(after.into)} / ${num(after.needed)} XP</small>` : after.level === MAX_PLAYER_LEVEL ? " <small>Max level</small>" : ""}`,
    gain: `+${num(a.gained)} XP`,
    bar: bar(
      before.percent / 100,
      after.percent / 100,
      up,
      `Level ${after.level}, ${Math.round(after.percent)}% of the way to the next`,
    ),
    note: xpBreakdown(a) || undefined,
    burst: up ? "Level up" : undefined,
  };
}
/** The rank tile: your rating's place between this rank and the next. */
export function rankTile(r: Rating): Tile | null {
  if (r.before === undefined) return null;
  const delta = r.rating - r.before;
  const at = (rating: number) => {
    let i = 0;
    for (let k = 0; k < RANKS.length; k++) if (rating >= RANKS[k].min) i = k;
    const floor = RANKS[i].min,
      ceiling = RANKS[i + 1]?.min;
    return {
      i,
      share: ceiling === undefined ? 1 : (rating - floor) / (ceiling - floor),
    };
  };
  const was = at(r.before),
    now = at(r.rating);
  const promoted = now.i > was.i,
    demoted = now.i < was.i;
  // A new tier (its title, coins and a shield) reads louder than a step.
  const tierUp = promoted && RANKS[now.i].tier > RANKS[was.i].tier;
  return {
    id: "rank",
    icon: "leaderboard",
    label: r.placementLeft
      ? `Rank · ${r.placementLeft} placement left`
      : "Rank",
    value: `<i style="color:${rankColor(r.rank)}">${esc(r.rank)}</i> <small>${num(r.rating)}</small>`,
    gain: signed(delta),
    // A new rank starts its bar again; a lost one shows where you landed.
    bar: bar(
      promoted ? 0 : demoted ? now.share : was.share,
      now.share,
      false,
      r.next
        ? `${num(r.rating)} rating, ${esc(r.next.name)} at ${num(r.next.at)}`
        : `${num(r.rating)} rating`,
    ),
    // The shield that held this loss says so; else what comes next.
    note: r.shielded
      ? "Your shield held"
      : r.next
        ? `${esc(r.next.name)} at ${num(r.next.at)}`
        : "The highest rank",
    // Placement has no rank to rise in; the match that ends it gives one.
    burst: r.placementLeft
      ? undefined
      : r.shielded
        ? "Shield"
        : r.previousRank === "Unranked"
          ? "Ranked"
          : tierUp
            ? "New tier"
            : promoted
              ? "Rank up"
              : undefined,
    tone: delta >= 0 ? "up" : "down",
  };
}
/** The season tile: tiers are 800 XP each (or the season's own rules). */
export function seasonTile(j: Journey, a: XpAward): Tile {
  const rules = seasonRules(j.season);
  const tierOf = (xp: number) =>
    Math.min(rules.tiers, Math.floor(Math.max(0, xp) / rules.tierXp));
  const shareOf = (xp: number) =>
    tierOf(xp) >= rules.tiers
      ? 1
      : (Math.max(0, xp) % rules.tierXp) / rules.tierXp;
  const now = j.season.xp,
    was = now - a.gained;
  const up = tierOf(now) > tierOf(was);
  return {
    id: "season",
    icon: "star",
    label: "Season",
    value: `Tier ${tierOf(now)} <small>of ${rules.tiers}</small>`,
    gain: `+${num(a.gained)}`,
    bar: bar(
      shareOf(was),
      shareOf(now),
      up,
      `Season tier ${tierOf(now)} of ${rules.tiers}`,
    ),
    note:
      tierOf(now) >= rules.tiers
        ? "Every tier reached"
        : `${num(Math.max(0, now) % rules.tierXp)} / ${num(rules.tierXp)} to tier ${tierOf(now) + 1}`,
    burst: up ? "Tier up" : undefined,
  };
}
/** The mastery tile: matches with this fighter toward its next tier. */
export function masteryTile(m: { fighter: string; matches: number }): Tile {
  const tier = masteryTier(m.matches),
    next = nextMastery(m.matches);
  const floor = tier?.matches ?? 0,
    span = next ? next.matches - floor : 1;
  const share = (matches: number) =>
    next ? (Math.max(floor, matches) - floor) / span : 1;
  // This match is the one that reached the tier.
  const reached = !!tier && tier.matches === m.matches;
  return {
    id: "mastery",
    icon: "user",
    label: "Mastery",
    value: tier
      ? `<i style="color:${tier.color}">${tier.name}</i> <small>${esc(m.fighter)} · ${num(m.matches)}</small>`
      : `${esc(m.fighter)} <small>${num(m.matches)} of ${MASTERY_TIERS[0].matches}</small>`,
    gain: "+1",
    bar: bar(
      reached ? 0 : share(m.matches - 1),
      share(m.matches),
      false,
      next
        ? `${num(m.matches)} matches, ${next.name} at ${next.matches}`
        : `${num(m.matches)} matches, the top tier`,
    ),
    note: next ? `${next.name} at ${next.matches} matches` : "The top tier",
    burst: reached ? tier.name : undefined,
  };
}
/** The coins tile: what the match, its missions and a level-up paid. */
export function coinsTile(coins: number): Tile {
  return {
    id: "coins",
    icon: "coin",
    label: "Coins",
    value: `+${num(coins)}`,
    note: "In your wallet",
  };
}

/** The tiles a match shows, in the order they appear. */
export function rewardTiles(f: RewardFacts): Tile[] {
  const a = xpAward(f.journey, f.ref);
  const tiles: (Tile | null)[] = [
    a ? xpTile(a) : null,
    f.rating ? rankTile(f.rating) : null,
    a && f.journey ? seasonTile(f.journey, a) : null,
    // Counted once your records have this match (the count includes it).
    f.mastery && f.mastery.matches > 0 ? masteryTile(f.mastery) : null,
    f.coins && f.coins > 0 ? coinsTile(f.coins) : null,
  ];
  return tiles.filter((t): t is Tile => !!t);
}

/**
 * A level this match reached, in words: its coins, a milestone's title or
 * cosmetic, and the feature it opened (feature-unlocks.ts).
 */
export function levelUpLine(a: XpAward) {
  if (a.after <= a.before) return "";
  const milestones = LEVEL_MILESTONES.filter(
    (m) => m.level > a.before && m.level <= a.after,
  ).flatMap(milestoneNames);
  const opened = unlocksBetween(a.before, a.after).map((u) => u.name);
  const parts = [
    `+${levelUpCoins(a.before, a.after)} coins`,
    ...milestones,
    ...(opened.length ? [`Unlocked: ${opened.join(", ")}`] : []),
  ];
  return `<p class="rw-levelup" data-rw="levelup"><b>Level ${a.after}</b>${parts.map((p) => `<span>${esc(p)}</span>`).join("")}</p>`;
}

/** Confetti: a fixed scatter (the same every time: markup must not change). */
const CONFETTI = Array.from({ length: 22 }, (_, i) => {
  const x = (i * 37 + 11) % 100,
    delay = ((i * 53) % 9) * 60,
    hue = [46, 150, 200, 330, 280][i % 5],
    drift = ((i * 29) % 40) - 20,
    spin = 240 + ((i * 71) % 480);
  return `<i style="--x:${x}%;--d:${delay}ms;--h:${hue};--dx:${drift}px;--r:${spin}deg"></i>`;
}).join("");

/** Confetti over the sheet's head, on a win. It lays nothing out. */
export const confettiMarkup = () =>
  `<span class="rw-confetti" data-rw="confetti" aria-hidden="true">${CONFETTI}</span>`;
/** Your fighter beside the score: it hops on a win. */
export const fighterHop = (portrait: string, won: boolean, still = false) =>
  `<span class="rw-fighter${won && !still ? " is-hopping" : ""}" data-rw="fighter" aria-hidden="true">${portrait}</span>`;

/** The rewards block: the tiles, or how the XP is doing while it's saved. */
export function rewardsMarkup(f: RewardFacts) {
  if (!f.journey || !f.ref) return "";
  const a = xpAward(f.journey, f.ref);
  const tiles = rewardTiles(f);
  const pending = a
    ? ""
    : `<p class="rw-pending" role="status">${f.status === "saved" && !f.eligible ? "No XP earned · finish at least 20 seconds of active play to qualify." : f.status === "unavailable" ? "XP could not be saved. Check your connection and database update." : "Updating your XP…"}</p>`;
  return `<section class="rw${f.still ? " is-still" : ""}" aria-label="What this match earned">${tiles.length ? `<ul class="rw-tiles" data-count="${tiles.length}">${tiles.map(tile).join("")}</ul>` : ""}${a ? levelUpLine(a) : ""}${pending}${f.gift ? `<p class="rw-gift">${menuIcon("star")}<span>${esc(f.gift)}</span></p>` : ""}</section>`;
}

/**
 * Keep the celebration's animations where they were when the sheet's markup
 * is set again. Each animated part (`data-rw`) is timed from when it first
 * appeared for this match (`key`); a part that appears later (the rank,
 * once every game saved the match) starts then. Reads no layout.
 */
const firstSeen = new Map<string, number>();
let seenFor = "";
export function syncRewardMotion(
  root: ParentNode,
  key: string,
  now = performance.now(),
) {
  if (key !== seenFor) {
    seenFor = key;
    firstSeen.clear();
  }
  for (const part of Array.from(
    root.querySelectorAll<HTMLElement>("[data-rw]"),
  )) {
    const id = part.dataset.rw!;
    const since = firstSeen.get(id);
    if (since === undefined) {
      firstSeen.set(id, now);
      continue;
    }
    const elapsed = now - since;
    for (const a of part.getAnimations?.({ subtree: true }) ?? [])
      a.currentTime = elapsed;
  }
}

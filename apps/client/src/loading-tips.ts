import { RULES } from "@arena/shared";
import type { PvpMode } from "./loading-art";

/**
 * Tips shown on the startup curtain (docs/loading-screens.md). Every number
 * comes from the rules the server plays by (RULES, ORB_SPOTS and
 * simulation.ts stepOrbs), so a tip can never drift from the game:
 * - one orb at a time in a 1v1, its spot alternating top / bottom centre,
 *   its kind alternating healing / energy, both counts reset each round and
 *   starting at the top with a healing orb: healing is always on top;
 * - in team modes and free-for-all one orb at each spot, kinds alternating;
 * - nobody at full health (or full meter) takes that kind of orb.
 */
export type LoadingTip = {
  id: string;
  text: string;
  /**
   * The modes it is about (none: every mode). Behind a painting of one mode
   * (loading-art.ts), only that mode's tips and the general ones show.
   */
  modes?: PvpMode[];
};

const pct = (share: number) => `${Math.round(share * 100)}%`;
const healEvery = RULES.orbInterval * 2;
const ultRatio = RULES.ultPerDamageDealt / RULES.ultPerDamageTaken;

/**
 * Short on purpose (the owner, 20 Nov): one or two lines, read at a glance.
 */
export const LOADING_TIPS: LoadingTip[] = [
  {
    id: "duel-orbs",
    modes: ["duel"],
    text: `1v1: healing orb spawns top centre at ${RULES.orbFirst} s, then every ${healEvery} s; energy orbs spawn bottom centre between.`,
  },
  {
    id: "orb-values",
    text: `Healing orb: +${pct(RULES.orbHeal)} health. Energy orb: +${RULES.orbEnergy} ultimate charge.`,
  },
  {
    id: "orb-full",
    text: "Full health or a full ultimate? You walk through that orb, so it waits for you.",
  },
  {
    id: "team-orbs",
    modes: ["teams", "ffa"],
    text: `2v2 and free-for-all: orbs spawn top and bottom centre at ${RULES.orbFirst} s, then every ${RULES.orbInterval} s.`,
  },
  {
    id: "basic-cooldowns",
    text: `Each basic attack that lands takes ${RULES.basicHitCooldownCut} s off your other skills' cooldowns.`,
  },
  {
    id: "ult-charge",
    text: `Dealing damage charges your ultimate ${ultRatio.toFixed(1)}× faster than taking it.`,
  },
  {
    id: "comeback",
    text: `Lost a round? You start the next one with +${RULES.ultComeback} ultimate charge.`,
  },
  {
    id: "best-of",
    text: `Best of ${RULES.roundsToWin * 2 - 1}: the first to win ${RULES.roundsToWin} rounds takes the match.`,
  },
];

/**
 * Time to read a tip: a beat to notice it plus about a fifth of a second a
 * word, within 2.5 and 5 seconds (shortened with the tips, 20 Nov: about
 * 3.5 s a start instead of 6).
 */
export function tipReadMs(tip: LoadingTip) {
  const words = tip.text.split(/\s+/).filter(Boolean).length;
  return Math.min(5000, Math.max(2500, 1000 + words * 220));
}

const LAST_TIP_KEY = "ea-last-tip";
/**
 * "off" only for the visual harness (each test start would be seconds
 * slower). Players have no switch: every start waits for its tip alike.
 */
export const TIPS_SETTING_KEY = "ea-loading-tips";

export function tipsEnabled() {
  try {
    return localStorage.getItem(TIPS_SETTING_KEY) !== "off";
  } catch {
    return true;
  }
}

/** Whether a tip suits a painting of this mode (no painting: every tip). */
export const tipFits = (tip: LoadingTip, mode?: PvpMode) =>
  !mode || !tip.modes || tip.modes.includes(mode);

/**
 * The tip after `from` that suits this mode, in order, so every start
 * teaches something new.
 */
export function tipAfter(from: LoadingTip | undefined, mode?: PvpMode) {
  const start = from ? LOADING_TIPS.indexOf(from) : -1;
  for (let step = 1; step <= LOADING_TIPS.length; step++) {
    const tip = LOADING_TIPS[(start + step) % LOADING_TIPS.length];
    if (tipFits(tip, mode)) return tip;
  }
  return LOADING_TIPS[0];
}

/** The next tip after the one shown last time (suiting the painting's mode). */
export function nextTip(mode?: PvpMode): LoadingTip {
  let last: LoadingTip | undefined;
  try {
    const id = localStorage.getItem(LAST_TIP_KEY);
    last = LOADING_TIPS.find((t) => t.id === id);
  } catch {
    /* Storage blocked: start at the first. */
  }
  const tip = tipAfter(last, mode);
  noteTipShown(tip);
  return tip;
}

export function noteTipShown(tip: LoadingTip) {
  try {
    localStorage.setItem(LAST_TIP_KEY, tip.id);
  } catch {
    /* optional */
  }
}

/** The tip as the curtain shows it. */
export function tipMarkup(tip: LoadingTip) {
  const text = tip.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    // A number keeps its unit on the same line ("36 s", not "36" / "s").
    .replace(/(\d) (s\b)/g, "$1\u00a0$2");
  return `<span class="server-startup-tip-text"><b>TIP</b> ${text}</span>`;
}

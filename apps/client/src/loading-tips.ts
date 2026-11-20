import { ORB_SPOTS, RULES } from "@arena/shared";
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
  /** A small map of the arena showing where the orbs appear. */
  map?: "duel-orbs" | "team-orbs";
  /**
   * The modes it is about (none: every mode). Behind a painting of one mode
   * (loading-art.ts), only that mode's tips and the general ones show.
   */
  modes?: PvpMode[];
};

const pct = (share: number) => `${Math.round(share * 100)}%`;
const healEvery = RULES.orbInterval * 2;
const ultRatio = RULES.ultPerDamageDealt / RULES.ultPerDamageTaken;

export const LOADING_TIPS: LoadingTip[] = [
  {
    id: "duel-orbs",
    map: "duel-orbs",
    modes: ["duel"],
    text: `1v1: the healing orb appears at the top centre ${RULES.orbFirst} s into each round, then every ${healEvery} s. The energy orb appears at the bottom centre in between.`,
  },
  {
    id: "orb-values",
    text: `A healing orb restores ${pct(RULES.orbHeal)} of your health. An energy orb adds ${RULES.orbEnergy} charge to your ultimate (full at ${RULES.ultMax}).`,
  },
  {
    id: "orb-full",
    text: "At full health you walk straight through a healing orb, and with a full ultimate through an energy orb. It stays for when you need it.",
  },
  {
    id: "team-orbs",
    map: "team-orbs",
    modes: ["teams", "ffa"],
    text: `2v2 and free-for-all: an orb appears at the top and the bottom centre together, ${RULES.orbFirst} s into each round and every ${RULES.orbInterval} s after, healing and energy taking turns.`,
  },
  {
    id: "basic-cooldowns",
    text: `Every basic attack that lands takes ${RULES.basicHitCooldownCut} s off your other skills' cooldowns. Keep hitting to cast more often.`,
  },
  {
    id: "ult-charge",
    text: `Your ultimate charges ${ultRatio.toFixed(1)}× faster from damage you deal than from damage you take, and slowly on its own during a round.`,
  },
  {
    id: "comeback",
    text: `Lost a round? You start the next one with ${RULES.ultComeback} extra ultimate charge.`,
  },
  {
    id: "best-of",
    text: `Every match is best of ${RULES.roundsToWin * 2 - 1}: the first to win ${RULES.roundsToWin} rounds takes it.`,
  },
];

/**
 * Time to read a tip: about a quarter second a word (an unhurried reading
 * pace, for players reading in a second language too), plus a beat to
 * notice it, within 3 and 7 seconds.
 */
export function tipReadMs(tip: LoadingTip) {
  const words = tip.text.split(/\s+/).filter(Boolean).length;
  return Math.min(7000, Math.max(3000, 1200 + words * 250));
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

/** The arena from above (1600 × 900) with its orb spots marked. */
function tipMap(kind: NonNullable<LoadingTip["map"]>) {
  const [top, bottom] = ORB_SPOTS;
  const orb = (x: number, y: number, fill: string, label: string) =>
    `<g transform="translate(${x} ${y})"><circle r="150" fill="${fill}" opacity="0.25"/><circle r="100" fill="${fill}"/><text y="44" text-anchor="middle" font-size="130" font-weight="700" fill="#06101f">${label}</text></g>`;
  const heal = "#7dffb0",
    energy = "#ffd166";
  const orbs =
    kind === "duel-orbs"
      ? orb(top.x, top.y, heal, "+") + orb(bottom.x, bottom.y, energy, "⚡")
      : orb(top.x, top.y, heal, "+") +
        orb(bottom.x, bottom.y, heal, "+") +
        `<text x="1030" y="500" font-size="130" font-weight="700" fill="#ffd166">→ ⚡</text>`;
  return `<svg class="server-startup-tip-map" viewBox="0 0 1600 900" aria-hidden="true" focusable="false"><rect x="20" y="20" width="1560" height="860" rx="90" fill="#0d2a33" stroke="#dfbd6b" stroke-width="18"/><line x1="800" y1="40" x2="800" y2="860" stroke="#dfbd6b55" stroke-width="10" stroke-dasharray="40 30"/><circle cx="260" cy="450" r="44" fill="#6fb5ff"/><circle cx="1340" cy="450" r="44" fill="#ff7a7a"/>${orbs}</svg>`;
}

/** The tip as the curtain shows it. */
export function tipMarkup(tip: LoadingTip) {
  const text = tip.text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `${tip.map ? tipMap(tip.map) : ""}<span class="server-startup-tip-text"><b>TIP</b> ${text}</span>`;
}

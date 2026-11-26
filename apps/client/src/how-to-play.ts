/**
 * How to play: the game's reference screen, for any time after the first
 * minutes (the Lobby tour and Getting started do the first minutes).
 *
 * Built like the help screens of big games (docs/onboarding.md): topics in
 * tabs, one idea per card, a picture where it helps, a sentence or two, and
 * a Go button that opens the feature the card is about. The Controls tab
 * starts on the device being used (touch, keyboard or controller), with the
 * player's own key bindings.
 *
 * Everything here is data: a new mode or system is a card in HELP_TOPICS,
 * not a new screen. Numbers come from the shared rules so the text cannot
 * drift from the game. Markup only; main.ts opens it and runs the Go buttons.
 */
import { CHARACTERS, EX, RING, RULES } from "@arena/shared";
import {
  RAID_RITE_OFFER,
  RAID_RITE_PICKS,
} from "../../../packages/shared/src/raid";
import { esc } from "./ui/components";
import { menuIcon, type IconName } from "./menu-icons";
import { helpArt, type HelpArt } from "./illustrated-help";
import "./how-to-play.css";

/** What a card's Go button opens (main.ts runs these). */
export type HelpGo =
  | "play"
  | "practice"
  | "fighters"
  | "raids"
  | "spire"
  | "missions"
  | "journey"
  | "shop"
  | "wardrobe"
  | "ranks"
  | "friends"
  | "plaza"
  | "controls";
export type HelpTopicId =
  "basics" | "battle" | "controls" | "modes" | "progress" | "social";
export interface HelpCard {
  title: string;
  text: string;
  icon?: IconName;
  art?: HelpArt;
  go?: { to: HelpGo; label: string };
}
export interface HelpTopic {
  id: HelpTopicId;
  label: string;
  /** One line under the tabs: what this topic is for. */
  lead: string;
  cards: HelpCard[];
}

const FIGHTERS = Object.keys(CHARACTERS).length;
const ROUND_MINUTES = Math.round(RULES.roundSeconds / 60);
const BEST_OF = RULES.roundsToWin * 2 - 1;

export const HELP_TOPICS: HelpTopic[] = [
  {
    id: "basics",
    label: "Basics",
    lead: "Real-time battles between elemental fighters. Here is the whole idea.",
    cards: [
      {
        title: "Win the match",
        icon: "battle",
        text: `A match is best of ${BEST_OF}: the first side to win ${RULES.roundsToWin} rounds takes it. A round lasts up to ${ROUND_MINUTES} minutes.`,
      },
      {
        title: "Press PLAY",
        icon: "enter",
        text: "PLAY starts the mode in the bar above it. Quick Match finds another player, or offers a practice bot if nobody is around.",
        go: { to: "play", label: "Choose a mode" },
      },
      {
        title: "Pick a fighter",
        icon: "user",
        text: `${FIGHTERS} fighters, each with a basic attack, three skills and an ultimate. Switch with the arrows in the Lobby; Fighters shows every kit and its combo.`,
        go: { to: "fighters", label: "See fighters" },
      },
      {
        title: "Practise first",
        icon: "target",
        text: "Solo test puts you on a court with a training target to try every skill. Vs AI Easy is a gentle first real match.",
        go: { to: "practice", label: "Solo test" },
      },
    ],
  },
  {
    id: "battle",
    label: "Battle",
    lead: "What wins fights. Every fighter plays by these rules.",
    cards: [
      {
        title: "Keep attacking",
        art: "attack",
        text: `Basic attacks have no cooldown. Each one that lands takes ${RULES.basicHitCooldownCut} s off your three skills' cooldowns.`,
      },
      {
        title: "Charge your ultimate",
        art: "ultimate",
        text: "The gold meter fills as you deal and take damage. When it is full, your fourth skill is ready. Losing a round gives you a head start on the next.",
      },
      {
        title: "Power up with EX",
        art: "ex",
        text: `Press the ultimate before it is full to arm EX (${EX.cost}% of the meter): your next skill hits ${Math.round((EX.damage - 1) * 100)}% harder and ${Math.round((EX.radius - 1) * 100)}% wider.`,
      },
      {
        title: "Dash and jump",
        art: "jump",
        text: `Dash (every ${RULES.dashCooldown} s) dodges shots. Jump over glowing ground zones.`,
      },
      {
        title: "Take cover",
        art: "cover",
        text: "Stone blocks stop shots, yours and theirs. Fight around them.",
      },
      {
        title: "Grab the orbs",
        art: "orbs",
        text: `Orbs appear at the top and bottom of the court. Green heals ${Math.round(RULES.orbHeal * 100)}% health; gold gives ${RULES.orbEnergy} ultimate charge.`,
      },
      {
        title: "Stay inside the ring",
        art: "ring",
        text: `In a round's last ${RING.startsBefore} seconds the safe circle shrinks to the middle. Outside it you lose health.`,
      },
      {
        title: "When time runs out",
        icon: "info",
        text: "The side with more health left wins the round. A tie goes to overtime: everyone loses health until someone falls.",
      },
    ],
  },
  {
    id: "controls",
    label: "Controls",
    lead: "", // Filled per device (controlsTopic).
    cards: [],
  },
  {
    id: "modes",
    label: "Modes",
    lead: "Everything PLAY can start. Pick it in the bar above PLAY.",
    cards: [
      {
        title: "Quick Match",
        icon: "battle",
        text: "A 1v1 against another player. If nobody is searching, you are offered a bot to spar with while you wait.",
        go: { to: "play", label: "Choose a mode" },
      },
      {
        title: "Vs AI",
        icon: "bot",
        text: "Easy, Normal or Hard bots, best of five. Your first two are shorter: one round, then first to two. Bot matches never change your rank.",
        go: { to: "play", label: "Choose a mode" },
      },
      {
        title: "Private rooms",
        icon: "friends",
        text: "1v1, 2v2 Teams or Free-for-all (3–4 players). Share the room code; friends can join or watch.",
        go: { to: "play", label: "Choose a mode" },
      },
      {
        title: "Boss Raids",
        icon: "bestiary",
        text: `Team up (1–4 players) against a giant boss. Before the fight each raider picks ${RAID_RITE_PICKS} of ${RAID_RITE_OFFER} rites. Stand by a downed ally to revive them. Easier bosses give a solo raider one self-revive.`,
        go: { to: "raids", label: "Open Raids" },
      },
      {
        title: "The Spire",
        icon: "star",
        text: "A climb, floor by floor, against waves of Echoes and a boss at the top of each zone. Pick a blessing after every floor; cleared floors are saved at once.",
        go: { to: "spire", label: "Open the Spire" },
      },
    ],
  },
  {
    id: "progress",
    label: "Progress",
    lead: "What you earn by playing. Levels never change combat stats.",
    cards: [
      {
        title: "Level and XP",
        icon: "sparkle",
        text: "Matches, raids and missions give XP. Levels unlock rewards to wear; a fight stays fair for everyone.",
      },
      {
        title: "Daily missions",
        icon: "missions",
        text: "New missions every day, paid in coins and XP. Tap a mission to see exactly what counts.",
        go: { to: "missions", label: "Open Missions" },
      },
      {
        title: "Journey",
        icon: "leaderboard",
        text: "The season's track: play to climb its tiers and unlock its frames and rewards.",
        go: { to: "journey", label: "Open Journey" },
      },
      {
        title: "Ranks",
        art: "ranks",
        text: "Matches against other players change your rating. Climb from Newbie to Legendary and keep the titles you reach.",
        go: { to: "ranks", label: "Open Ranks" },
      },
      {
        title: "Shop and Wardrobe",
        icon: "shop",
        text: "Spend coins on skins and looks. Put on what you own, including raid rewards, in the Wardrobe.",
        go: { to: "shop", label: "Open Shop" },
      },
    ],
  },
  {
    id: "social",
    label: "Plaza & friends",
    lead: "Play together, or just hang out.",
    cards: [
      {
        title: "The Plaza",
        icon: "home",
        text: "Walk around with other players, emote and chat. Plaza Today has small daily quests (a goal, a lap, catching falling orbs) that pay coins.",
        go: { to: "plaza", label: "Go to the Plaza" },
      },
      {
        title: "Friends and parties",
        icon: "friends",
        text: "Add friends, see who is online, and invite them from the Lobby's empty slots. A party plays and raids together.",
        go: { to: "friends", label: "Open Friends" },
      },
      {
        title: "Chat",
        icon: "chat",
        text: "The chat button next to your profile: talk to your party, your team, the room or the Plaza, and message friends.",
      },
    ],
  },
];

/* ------------------------------------------------------------ controls */

export type HelpDevice = "touch" | "keys" | "pad";
export interface HelpKeys {
  move: string;
  basic: string;
  skills: string;
  dash: string;
  jump: string;
}
export interface HelpControls {
  /** The device in use: its tab opens first. */
  device: HelpDevice;
  /** Keyboard bindings (the player's own). */
  keys: HelpKeys;
  /** Controller button names. */
  pad: HelpKeys;
  /** Skills are previewed while held and cast on release. */
  preview: boolean;
}
type Row = [key: string, what: string];
export function controlRows(device: HelpDevice, c: HelpControls): Row[] {
  if (device === "touch")
    return [
      ["Left side", "Drag anywhere on the left half to move"],
      [
        "Attack",
        "The big button. Hold it to keep attacking; aim follows the nearest enemy",
      ],
      [
        "Skills",
        "The three round buttons; the large fourth is your ultimate (or EX before it is full)",
      ],
      ["Dash · Jump", "Dodge shots · hop over ground attacks"],
      ["Target", "The crosshair picks which enemy to aim at"],
      ["Settings", "The gear: sound, graphics, controls and more"],
    ];
  const k = device === "pad" ? c.pad : c.keys;
  const aim = device === "pad" ? "Right stick aims" : "The mouse aims";
  return [
    [k.move, `Move · ${aim}`],
    [k.basic, "Basic attack · hold to keep attacking"],
    [
      k.skills,
      `Skills · the last is your ultimate (or EX before it is full)${c.preview ? " · hold to preview, release to cast" : ""}`,
    ],
    [k.dash, "Dash"],
    [k.jump, "Jump"],
    [
      device === "pad" ? "MENU" : "ESC",
      "Settings · change keys under Controls",
    ],
  ];
}
const DEVICES: [HelpDevice, string][] = [
  ["touch", "Touch"],
  ["keys", "Keyboard"],
  ["pad", "Controller"],
];

function controlsBody(c: HelpControls, device: HelpDevice) {
  const seg = `<div class="htp-devices" role="group" aria-label="Device">${DEVICES.map(([d, label]) => `<button type="button" aria-pressed="${d === device}" data-htp-device="${d}">${label}</button>`).join("")}</div>`;
  const rows = controlRows(device, c)
    .map(
      ([key, what]) =>
        `<li><kbd>${esc(key)}</kbd><span>${esc(what)}</span></li>`,
    )
    .join("");
  return `${seg}<ul class="htp-keys">${rows}</ul>${device === "touch" ? "" : `<div class="htp-actions">${goButton({ to: "controls", label: "Change keys" })}</div>`}`;
}

/* -------------------------------------------------------------- markup */

const goButton = (go: NonNullable<HelpCard["go"]>) =>
  `<button type="button" class="htp-go" data-htp-go="${go.to}">${esc(go.label)}${menuIcon("enter")}</button>`;

function cardMarkup(c: HelpCard, canGo: boolean) {
  const picture = c.art
    ? helpArt(c.art)
    : `<span class="htp-icon" aria-hidden="true">${menuIcon(c.icon ?? "info")}</span>`;
  return `<article class="htp-card${c.art ? " has-art" : ""}">${picture}<div class="htp-card-text"><h3>${esc(c.title)}</h3><p>${esc(c.text)}</p>${c.go && canGo ? goButton(c.go) : ""}</div></article>`;
}

export interface HelpState {
  topic: HelpTopicId;
  device: HelpDevice;
  /** Offer "Replay the Lobby tour" (only in the hub). */
  canTour: boolean;
  /** Go buttons that leave for another screen (not from inside a room). */
  canGo: boolean;
}

/** The topic's body (the tabs stay; only this part changes on a tab). */
export function helpTopicMarkup(s: HelpState, c: HelpControls) {
  const topic = HELP_TOPICS.find((t) => t.id === s.topic) ?? HELP_TOPICS[0];
  if (topic.id === "controls")
    return `<p class="htp-lead">Your controls on this device. Switch to see the others.</p>${controlsBody(c, s.device)}`;
  return `<p class="htp-lead">${esc(topic.lead)}</p><div class="htp-cards">${topic.cards.map((card) => cardMarkup(card, s.canGo)).join("")}</div>`;
}

/** The whole screen, for the game's dialog (main.ts). */
export function howToPlayMarkup(s: HelpState, c: HelpControls) {
  const tabs = `<div class="htp-tabs" role="tablist" aria-label="Topics">${HELP_TOPICS.map((t) => `<button type="button" role="tab" id="htp-tab-${t.id}" aria-controls="htp-body" aria-selected="${t.id === s.topic}" tabindex="${t.id === s.topic ? 0 : -1}" data-htp-topic="${t.id}">${esc(t.label)}</button>`).join("")}</div>`;
  const foot = `<div class="htp-foot dialog-actions">${s.canTour ? `<button type="button" class="htp-foot-btn" data-htp-tour>${menuIcon("again")}<span>Replay the Lobby tour</span></button>` : ""}${s.canGo ? `<button type="button" class="htp-foot-btn" data-htp-guide>${menuIcon("sparkle")}<span>Getting started</span></button>` : ""}</div>`;
  return `<div class="help-screen htp" data-topic="${s.topic}"><h2>How to play</h2>${tabs}<div class="htp-body" id="htp-body" role="tabpanel" aria-labelledby="htp-tab-${s.topic}" tabindex="0">${helpTopicMarkup(s, c)}</div>${s.canTour || s.canGo ? foot : ""}</div>`;
}

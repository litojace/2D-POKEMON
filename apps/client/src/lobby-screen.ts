import { CHARACTERS, type CharacterId } from "@arena/shared";
import {
  JOURNEY_ITEM_BY_ID,
  SEASON_THEMES,
  playerLevel,
  seasonReward,
  seasonRules,
  seasonTheme,
  sparkLeft,
  type Journey,
} from "../../../packages/shared/src/journey";
import type { Economy } from "../../../packages/shared/src/shop";
import type { RaidLoadout } from "../../../packages/shared/src/raid";
import { iconLabel, menuIcon } from "./menu-icons";
import { fighterStageArt, wornSkin } from "./fighter-selection";
import { lowGraphics } from "./graphics-quality";
import type { ShopPreviewHandle } from "./shop-preview";
import { QUIP_MOVE_MS, pickQuip } from "./lobby-quips";
import { elementIcon } from "./element-icons";
import { picksCountdown } from "./shop-ui";
import "./lobby.css";
import { fadeIn } from "./ui/motion";
import { setInner } from "./ui/patch";
import { avatarImage } from "./portraits";
import { openHubPanelNow } from "./ui/hub-panel";
import { guideCard, type GuideView } from "./getting-started";
import { spireLobbyIcon } from "./spire-art";
import type { SpireLobbyCard } from "./spire-nudge";
import { setPerfSource } from "./perf-hud";

/**
 * The Lobby: the one-screen hub after login (hub redesign phase 2). Your
 * fighter stands in the middle, party slots beside it (in a party the
 * leader stands in the middle on everyone's screen, the others beside), PLAY in the bottom
 * right with the mode next to it, the menu rail on the left and a few cards
 * on the right. The walkable world is the Plaza tab; see hub-scene.ts.
 * Plain DOM over a blurred painting of the plaza: no canvas, light on phones.
 */
export type LobbyMode =
  | "duel"
  | "teams"
  | "ffa"
  | "raid"
  | "bot-easy"
  | "bot-normal"
  | "bot-hard"
  | "practice";
/**
 * The bot's three levels, each with its colour (green, amber, red: the
 * usual order, amber rather than gold, which marks what's selected) and
 * 1 to 3 pips, so the level reads without the colour too.
 */
export const AI_LEVELS = [
  { id: "easy", name: "Easy", hint: "Learning", pips: 1 },
  { id: "normal", name: "Normal", hint: "A fair fight", pips: 2 },
  { id: "hard", name: "Hard", hint: "No mercy", pips: 3 },
] as const;
export type AiLevel = (typeof AI_LEVELS)[number]["id"];
/** A level's name in its colour, with its pips (text: just the name). */
export const aiLevelMark = (id: AiLevel) => {
  const l = AI_LEVELS.find((x) => x.id === id)!;
  return `<span class="ai-level" data-ai-level="${l.id}">${l.name}<i class="ai-pips" aria-hidden="true">${[1, 2, 3].map((n) => `<i${n <= l.pips ? ' class="on"' : ""}></i>`).join("")}</i></span>`;
};
export const LOBBY_MODES: readonly {
  id: LobbyMode;
  label: string;
  hint: string;
  icon: Parameters<typeof menuIcon>[0];
  /** A bot match's level: the label ends in it, coloured. */
  ai?: AiLevel;
}[] = [
  {
    id: "duel",
    label: "1v1 Duel",
    hint: "Private room · best of five",
    icon: "battle",
  },
  {
    id: "teams",
    label: "2v2 Teams",
    hint: "Private room · best of five",
    icon: "friends",
  },
  {
    id: "ffa",
    label: "Free-for-all",
    hint: "Private room · 3–4 players",
    icon: "target",
  },
  {
    id: "raid",
    label: "Boss Raid",
    hint: "Choose a boss · 1–4 players",
    icon: "bestiary",
  },
  {
    id: "bot-easy",
    label: "Vs AI · Easy",
    hint: "Learning · best of five",
    icon: "bot",
    ai: "easy",
  },
  {
    id: "bot-normal",
    label: "Vs AI · Normal",
    hint: "A fair fight · best of five",
    icon: "bot",
    ai: "normal",
  },
  {
    id: "bot-hard",
    label: "Vs AI · Hard",
    hint: "No mercy · best of five",
    icon: "bot",
    ai: "hard",
  },
  {
    id: "practice",
    label: "Solo test",
    hint: "Practice skills on a target",
    icon: "target",
  },
];
const MODE_KEY = "arena-lobby-mode";
/** The mode this device picked last, or null if it never picked one. */
export function chosenLobbyMode(): LobbyMode | null {
  try {
    const value = localStorage.getItem(MODE_KEY);
    if (LOBBY_MODES.some((m) => m.id === value)) return value as LobbyMode;
  } catch {
    /* Optional preference. */
  }
  return null;
}
/**
 * What PLAY starts: the mode picked last, or, for a new player, a match
 * against an Easy bot. A 1v1 Duel is a private room that waits for a
 * second player: a first tap shouldn't leave a newcomer waiting alone.
 */
export function savedLobbyMode(): LobbyMode {
  return chosenLobbyMode() ?? "bot-easy";
}
/**
 * A party can't play a bot match: when nobody picked a mode, PLAY gives it
 * the room that fits its size instead of an error.
 */
export function partyLobbyMode(mode: LobbyMode, size: number): LobbyMode {
  if (size < 2 || chosenLobbyMode()) return mode;
  if (!mode.startsWith("bot-") && mode !== "practice") return mode;
  return size === 2 ? "duel" : size === 3 ? "ffa" : "teams";
}
function saveLobbyMode(mode: LobbyMode) {
  try {
    localStorage.setItem(MODE_KEY, mode);
  } catch {
    /* Optional preference. */
  }
}

export type LobbyAction =
  | "fighters"
  | "wardrobe"
  | "shop"
  | "raids"
  | "journey"
  | "missions"
  | "ranks"
  | "friends"
  | "invite"
  | "leave-party"
  | "party-room"
  | "guide"
  | "spire"
  | "more-play";
/**
 * Six, so each is a finger (44 pt) tall on every phone. The Wardrobe is the
 * Shop's other tab (the same screen), and the Journey has its card on the
 * Lobby at every size.
 */
const RAIL: [LobbyAction, string, Parameters<typeof menuIcon>[0]][] = [
  ["fighters", "Fighters", "user"],
  ["shop", "Shop", "shop"],
  ["raids", "Raids", "bestiary"],
  ["missions", "Missions", "missions"],
  ["ranks", "Ranks", "leaderboard"],
  ["friends", "Friends", "friends"],
];

/** Another party member, as they stand on your Lobby stage. */
export interface LobbyPartyMember {
  name: string;
  character: CharacterId;
  leader: boolean;
  /** The Shop skin saved on that champion (from their account). */
  skin?: { skin: string; stage: number } | null;
  /** Their equipped raid look: colours, aura, entrance, frame. */
  look?: RaidLoadout;
  /** Your own seat (in someone else's party): a tap changes your fighter. */
  you?: boolean;
  /** Their account id (for Kick). */
  id?: string;
  /** You lead and may remove them: a tap on their seat offers Kick. */
  kickable?: boolean;
  /** Their connection dropped; the party keeps their place a while. */
  away?: boolean;
}
export interface LobbyView {
  character: CharacterId;
  /**
   * Your party's leader when it isn't you: they stand in the middle, as on
   * every member's screen, and you stand beside them (a `you` seat).
   */
  host?: LobbyPartyMember;
  /** The other members of your party (up to three), or none. */
  party: LobbyPartyMember[];
  /** Your party's room is open and you're not in it: Rejoin shows. */
  partyRoom?: boolean;
  /** You lead a party of two or more: "♛ You" under your fighter. */
  leading?: boolean;
  /** Party size including you (0: no party). */
  partySize: number;
  /** The party's members as themselves (avatars), for its bar. */
  partyFaces?: { name: string; avatar: string | null; leader: boolean }[];
  economy?: Economy;
  /** Your equipped raid look (colours, aura...), shown on your fighter. */
  look?: RaidLoadout;
  /** Friend requests waiting for an answer. */
  friendRequests: number;
  /** Friends online right now (null: not loaded). */
  friendsOnline: number | null;
  /** Getting started, for a new player: in the Journey card's place. */
  guide?: GuideView;
  /** The Spire's card once it is open, and a dot on Raids while it's new (spire-nudge.ts). */
  spire?: SpireLobbyCard | null;
}
export interface LobbyOptions {
  onAction(action: LobbyAction): void;
  onPlay(mode: LobbyMode): void;
  /** Step to the previous (-1) or next (1) fighter. */
  onStep(direction: -1 | 1): void;
  /** The leader confirmed Kick on a member's seat. */
  onKick?(id: string): void;
  reduced: boolean;
}
export interface LobbyHandle {
  update(view: LobbyView): void;
  close(): void;
}

const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const hex = (color: number) => `#${color.toString(16).padStart(6, "0")}`;

/** A mode's name: a bot match's level in its colour, with its pips. */
const modeLabel = (m: (typeof LOBBY_MODES)[number]) =>
  m.ai ? `Vs AI · ${aiLevelMark(m.ai)}` : m.label;

function modeButton(mode: LobbyMode) {
  const m = LOBBY_MODES.find((x) => x.id === mode)!;
  return `<span class="lobby-mode-icon">${menuIcon(m.icon)}</span><span class="lobby-mode-text"><b>${modeLabel(m)}</b><small>${m.hint}</small></span><span class="lobby-mode-caret" aria-hidden="true">▴</span>`;
}

const lookData = (look: RaidLoadout | undefined) =>
  encodeURIComponent(JSON.stringify(look ?? {}));
/**
 * A party seat: a friend's fighter in their saved skin and look (the same
 * live rig as yours, laid over still artwork), or a way to invite one. Both
 * stand on a podium on the stage's floor, like your fighter.
 */
export function slotMarkup(member: LobbyPartyMember | undefined, seat = 0) {
  // An open seat: anyone in the party may invite a friend into it.
  if (!member)
    return `<button type="button" class="lobby-slot" data-lobby-action="invite" aria-label="Invite a friend to your party"><span aria-hidden="true">+</span><small>Invite</small></button><span class="lobby-podium is-open" aria-hidden="true"></span>`;
  const skin = member.skin ?? null;
  const label = `${member.you ? "You" : escape(member.name)}${member.leader ? ", party leader" : ""}${member.away ? ", reconnecting" : ""}`;
  // Your own seat beside the leader: a tap opens Fighters to change it.
  // A member's seat on the leader's stage: a tap offers Kick, a second
  // tap on it removes them (lobby-screen.ts arms one seat at a time).
  const tap = member.you
    ? `<button type="button" class="lobby-member-tap" data-lobby-action="fighters" aria-label="Change your fighter" title="Change your fighter"></button>`
    : member.kickable && member.id
      ? `<button type="button" class="lobby-member-tap" data-lobby-member="${escape(member.id)}" aria-expanded="false" aria-label="${escape(member.name)}: party options"></button><button type="button" class="lobby-kick" data-lobby-kick="${escape(member.id)}" aria-label="Remove ${escape(member.name)} from the party">Kick</button>`
      : "";
  return `<figure class="lobby-member${member.you ? " is-you" : ""}${member.away ? " is-away" : ""}" style="--element:${hex(CHARACTERS[member.character].color)}" aria-label="${label}"><div class="lobby-member-art fighter-rig-stage" data-preview-champion="${member.character}" data-preview-item="${escape(skin?.skin ?? "")}" data-preview-stage="${skin?.stage ?? 1}" data-preview-look="${lookData(member.look)}" data-preview-action="idle">${fighterStageArt(member.character, `lobby-seat-${seat}`, skin, member.look ?? {})}</div><span class="lobby-podium" aria-hidden="true"></span>${tap}<figcaption>${member.leader ? '<b class="lobby-crown" aria-hidden="true">♛</b>' : ""}${member.you ? "You" : escape(member.name)}${member.away ? '<small class="lobby-away">· reconnecting</small>' : ""}</figcaption></figure>`;
}
/** The Journey card: season tier, the next cosmetic, today's Daily Spark. */
export function journeyCard(j: Journey | undefined) {
  if (!j)
    return `<span class="lobby-card-kicker">Journey</span><b>Levels and seasons</b><small>Open to see your rewards</small>`;
  const rules = seasonRules(j.season),
    sid = j.season.id,
    theme = SEASON_THEMES[seasonTheme(sid)],
    tier = Math.min(rules.tiers, Math.floor(j.season.xp / rules.tierXp)),
    into = tier >= rules.tiers ? rules.tierXp : j.season.xp % rules.tierXp,
    next = rules.itemTiers.find((t) => t > tier),
    item = next ? seasonReward(next, sid, rules).item : null,
    spark = sparkLeft(j);
  return `<span class="lobby-card-kicker">Journey · ${escape(theme.name)}</span><span class="lobby-card-row"><b>Tier ${tier} / ${rules.tiers}</b><small>Lv ${playerLevel(j.xp).level}</small></span><progress max="${rules.tierXp}" value="${into}" aria-label="Season tier progress"></progress><small>${item ? `Next: ${escape(JOURNEY_ITEM_BY_ID[item]?.name ?? "reward")} at tier ${next}` : "Every season cosmetic earned"}</small>${j.spark ? `<small class="lobby-spark${spark ? "" : " is-spent"}">Daily Spark · ${spark ? `${spark} XP left at ×2` : "used up today"}</small>` : ""}`;
}
/** The Spire card's words (its tower art stays as it is). */
export function spireCard(n: Pick<SpireLobbyCard, "title" | "note">) {
  return `<span class="lobby-card-kicker">The Spire</span><b>${escape(n.title)}</b><small>${escape(n.note)}</small>`;
}
/** The Missions card: how many are done and when new ones arrive. */
export function missionsCard(e: Economy | undefined) {
  if (!e || !e.missions.length)
    return `<span class="lobby-card-kicker">Daily missions</span><b>Six a day</b><small>Open to see today's missions</small>`;
  const done = e.missions.filter((m) => m.done).length,
    total = e.missions.length;
  return `<span class="lobby-card-kicker">Daily missions</span><span class="lobby-card-row"><b>${done} / ${total} done</b><small>New in ${picksCountdown()}</small></span><progress max="${Math.max(1, total)}" value="${done}" aria-label="Missions done today"></progress>`;
}

export function openLobby(options: LobbyOptions): LobbyHandle {
  const layer = document.createElement("div");
  layer.className = "lobby-layer";
  // One screen that never scrolls; but overflow: hidden still lets
  // scrollIntoView move it (a card brought into view), which left the whole
  // Lobby up under the header. Put it back. (overflow: clip would stop it
  // too, but lazy pictures in a panel then never load.)
  layer.addEventListener(
    "scroll",
    () => {
      if (layer.scrollTop || layer.scrollLeft) layer.scrollTo(0, 0);
    },
    { passive: true },
  );
  let mode = savedLobbyMode();
  /** Fighter + worn skin + stage now drawn on the stage. */
  let artKey: string | undefined;
  // The selected fighter moves with the same live rig as the Fighters roster
  // (shop-preview.ts, "selection" framing) over its still artwork. Low
  // graphics keeps the still artwork, as in the Plaza.
  let rig: ShopPreviewHandle | undefined;
  let rigLoading = false;
  let closed = false;
  /** Each seat's live rig, and what it shows. */
  const seatRigs: (ShopPreviewHandle | undefined)[] = [];
  const seatKeys: (string | undefined)[] = [];
  layer.innerHTML = `<div class="lobby-backdrop" aria-hidden="true"></div>
<nav class="lobby-rail" aria-label="Main menu">${RAIL.map(
    ([id, label, icon]) =>
      `<button type="button" data-lobby-action="${id}" title="${label}" aria-label="${label}">${menuIcon(icon)}<span>${label}</span><i class="lobby-badge" data-badge-for="${id}" hidden></i></button>`,
  ).join("")}</nav>
<section class="lobby-stage" aria-label="Your fighter">
  <div class="lobby-party-bar" id="lobby-party-bar" hidden><span class="lobby-party-faces" id="lobby-party-faces"></span><span id="lobby-party-size"></span><button type="button" class="lobby-rejoin" id="lobby-rejoin" data-lobby-action="party-room" hidden>${iconLabel("enter", "Rejoin room")}</button><button type="button" data-lobby-action="leave-party">${iconLabel("leave", "Leave party")}</button></div>
  <div class="lobby-party">
    <div class="lobby-slot-wrap" id="lobby-slot-0"></div>
    <figure class="lobby-fighter" id="lobby-fighter"><div class="lobby-fighter-art fighter-rig-stage" id="lobby-fighter-art" data-preview-look="%7B%7D" data-preview-action="idle"></div><span class="lobby-floor" aria-hidden="true"></span><button type="button" class="lobby-fighter-tap" id="lobby-fighter-tap" aria-label="Poke your fighter" title="Poke your fighter"></button><output class="lobby-emote-bubble" id="lobby-emote-bubble" hidden></output></figure>
    <div class="lobby-slot-wrap" id="lobby-slot-1"></div>
    <div class="lobby-slot-wrap lobby-slot-third" id="lobby-slot-2" hidden></div>
  </div>
  <div class="lobby-nameplate">
    <button type="button" class="lobby-step" data-lobby-step="-1" aria-label="Previous fighter">‹</button>
    <div class="lobby-name"><h2 id="lobby-fighter-name"></h2><span class="element-pill" id="lobby-fighter-element"></span><small class="lobby-host-name" id="lobby-host-name"></small></div>
    <button type="button" class="lobby-step" data-lobby-step="1" aria-label="Next fighter">›</button>
  </div>
</section>
<aside class="lobby-cards" aria-label="Today">
  <button type="button" class="lobby-card" data-lobby-action="journey" id="lobby-journey-card"></button>
  <button type="button" class="lobby-card lobby-spire-card" data-lobby-action="spire" id="lobby-spire-card" hidden><span class="lobby-spire-art" aria-hidden="true">${spireLobbyIcon()}</span><span class="lobby-spire-text" id="lobby-spire-text"></span></button>
  <button type="button" class="lobby-card lobby-missions-card" data-lobby-action="missions" id="lobby-missions-card"></button>
  <button type="button" class="lobby-card lobby-friends-card" data-lobby-action="friends" id="lobby-friends-card"><span class="lobby-card-kicker">Friends</span><b id="lobby-friends-online">Friends online</b><small>Invite, join or watch</small></button>
</aside>
<div class="lobby-play">
  <div class="lobby-mode-menu" id="lobby-mode-menu" role="menu" aria-label="Game mode" hidden>${LOBBY_MODES.map(
    (m) =>
      `<button type="button" role="menuitemradio" data-lobby-mode="${m.id}" aria-checked="${m.id === mode}">${menuIcon(m.icon)}<span><b>${modeLabel(m)}</b><small>${m.hint}</small></span></button>`,
  ).join(
    "",
  )}<button type="button" role="menuitem" class="lobby-mode-more" data-lobby-action="more-play">${menuIcon("enter")}<span><b>Join or watch</b><small>Room code, name and more</small></span></button></div>
  <button type="button" class="lobby-mode" id="lobby-mode" aria-haspopup="menu" aria-expanded="false" aria-controls="lobby-mode-menu">${modeButton(mode)}</button>
  <button type="button" class="lobby-play-button" id="lobby-play"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.6v12.8a1.1 1.1 0 0 0 1.7.93l10-6.4a1.1 1.1 0 0 0 0-1.86l-10-6.4A1.1 1.1 0 0 0 8 5.6z"/></svg><span>PLAY</span></button>
</div>`;
  document.body.append(layer);
  // Each hub scene (Lobby, Plaza) fades in as you switch to it.
  fadeIn([layer], 260);
  document.body.classList.add("hub-screen");
  const $ = <T extends HTMLElement>(id: string) =>
    layer.querySelector<T>(`#${id}`)!;
  const menu = $("lobby-mode-menu"),
    modeToggle = $<HTMLButtonElement>("lobby-mode");
  const setMenu = (open: boolean) => {
    menu.hidden = !open;
    modeToggle.setAttribute("aria-expanded", String(open));
    if (open)
      menu
        .querySelector<HTMLButtonElement>(`[data-lobby-mode="${mode}"]`)
        ?.focus({ preventScroll: true });
  };
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
  let armTimer: ReturnType<typeof setTimeout> | undefined;
  /** Put away a seat's Kick. */
  const disarm = () => {
    clearTimeout(armTimer);
    for (const figure of Array.from(
      layer.querySelectorAll<HTMLElement>(".lobby-member.is-armed"),
    )) {
      figure.classList.remove("is-armed");
      figure
        .querySelector("[data-lobby-member]")
        ?.setAttribute("aria-expanded", "false");
    }
  };
  /** The bubble over your fighter: a line it says. */
  const say = (text: string, ms: number) => {
    const bubble = $<HTMLOutputElement>("lobby-emote-bubble");
    bubble.textContent = text;
    bubble.classList.add("is-line");
    bubble.hidden = false;
    const spot = linePlace(bubble);
    bubble.style.top = `${spot.top}px`;
    bubble.style.left = `${spot.left}px`;
    bubble.style.setProperty("--tail", `${spot.tail}px`);
    bubble.classList.remove("is-popping");
    void bubble.offsetWidth;
    bubble.classList.add("is-popping");
    clearTimeout(bubbleTimer);
    bubbleTimer = setTimeout(() => (bubble.hidden = true), ms);
  };
  /**
   * Where a line's bubble goes (px from the figure's top): its tail just
   * above the fighter's head, which starts anywhere from the top of its
   * box (tall ears, flames) to a third of the way down (a round body). The
   * live rig says where its drawn pixels start; the still artwork (Low
   * graphics) puts the bubble over the whole box. Never above the top bar,
   * never out of the stage (its tail then still points at the head).
   * Returns px from the figure's top left.
   */
  const linePlace = (bubble: HTMLElement) => {
    const figure = $("lobby-fighter").getBoundingClientRect();
    const row = layer.querySelector(".lobby-party")!.getBoundingClientRect();
    const tail = 8;
    const head = rig?.inkTop() ?? figure.top;
    const width = bubble.offsetWidth,
      height = bubble.offsetHeight;
    const middle = figure.left + figure.width / 2;
    const centre = Math.min(
      Math.max(middle, row.left + width / 2 + 4),
      row.right - width / 2 - 4,
    );
    const left = centre - width / 2;
    let limit =
      (parseFloat(
        getComputedStyle(document.documentElement).getPropertyValue(
          "--safe-top",
        ),
      ) || 0) + 6;
    for (const e of Array.from(
      document.querySelectorAll(
        ".hub-scenes, #account-profile, #account-coins, #home-settings, .lobby-party-bar:not([hidden])",
      ),
    )) {
      const r = e.getBoundingClientRect();
      if (r.width && r.left < left + width && r.right > left)
        limit = Math.max(limit, r.bottom + 6);
    }
    return {
      top: Math.round(Math.max(limit, head - tail - height) - figure.top),
      left: Math.round(centre - figure.left),
      // Within the bubble's straight edge (its corners are 14 px round).
      tail: Math.round(
        Math.min(Math.max(middle - centre, 20 - width / 2), width / 2 - 20),
      ),
    };
  };
  /** The champion on the stage now. */
  let champion: CharacterId | undefined;
  let lastQuip: string | undefined;
  /** Recent taps on the fighter: four within three seconds is a poke. */
  let taps: number[] = [];
  /** When the move a tap started ends; a tap before then only talks. */
  let movingUntil = 0;
  let hopTimer: ReturnType<typeof setTimeout> | undefined;
  /** A tap on your fighter: it moves and says something. */
  const poke = () => {
    if (!champion) return;
    const now = performance.now();
    taps = [...taps.filter((t) => now - t < 3000), now];
    const quip = pickQuip(champion, lastQuip, taps.length >= 4);
    lastQuip = quip.text;
    say(
      quip.text,
      Math.min(4200, Math.max(2600, 1600 + quip.text.length * 50)),
    );
    if (now < movingUntil || options.reduced) return;
    const ms = QUIP_MOVE_MS[quip.move];
    movingUntil = now + ms;
    // The live rig plays the move; the still artwork (Low graphics, or
    // before the rig is ready) hops.
    if (rig?.play(quip.move, ms)) return;
    const art = $("lobby-fighter-art");
    art.classList.remove("is-hopping");
    void art.offsetWidth;
    art.classList.add("is-hopping");
    clearTimeout(hopTimer);
    hopTimer = setTimeout(() => art.classList.remove("is-hopping"), 600);
  };
  layer.addEventListener("click", (event) => {
    const target = event.target as Element;
    const action = target.closest<HTMLElement>("[data-lobby-action]")?.dataset
      .lobbyAction as LobbyAction | undefined;
    const step =
      target.closest<HTMLElement>("[data-lobby-step]")?.dataset.lobbyStep;
    const pick = target.closest<HTMLElement>("[data-lobby-mode]")?.dataset
      .lobbyMode as LobbyMode | undefined;
    if (target.closest("#lobby-mode")) return setMenu(menu.hidden);
    // A tap anywhere else closes the menu, and so does its own "Join or
    // watch", which opens the play drawer over it.
    if (!target.closest("#lobby-mode-menu") || action) setMenu(false);
    if (pick) {
      mode = pick;
      saveLobbyMode(mode);
      modeToggle.innerHTML = modeButton(mode);
      menu
        .querySelectorAll<HTMLElement>("[data-lobby-mode]")
        .forEach((b) =>
          b.setAttribute("aria-checked", String(b.dataset.lobbyMode === mode)),
        );
      setMenu(false);
      modeToggle.focus({ preventScroll: true });
      return;
    }
    // Kick, on the leader's stage: a tap on a member's seat shows it, a
    // tap on Kick removes them; any other tap puts it away.
    const kick = target.closest<HTMLElement>("[data-lobby-kick]");
    if (kick) {
      disarm();
      return options.onKick?.(kick.dataset.lobbyKick!);
    }
    const seat = target.closest<HTMLElement>("[data-lobby-member]");
    if (seat) {
      const figure = seat.closest<HTMLElement>(".lobby-member")!;
      const open = !figure.classList.contains("is-armed");
      disarm();
      if (open) {
        figure.classList.add("is-armed");
        seat.setAttribute("aria-expanded", "true");
        armTimer = setTimeout(disarm, 4000);
      }
      return;
    }
    disarm();
    if (target.closest("#lobby-fighter-tap")) return poke();
    if (step) return options.onStep(step === "-1" ? -1 : 1);
    if (target.closest("#lobby-play")) return options.onPlay(mode);
    // The rail button of the screen that is open (lit, aria-current) closes
    // it: a second tap on the same icon. Only the rail: a card that opens a
    // screen never closes one.
    const open = openHubPanelNow();
    if (open && target.closest('.lobby-rail [aria-current="page"]')) {
      open.close();
      return;
    }
    if (action) options.onAction(action);
  });
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape" && !menu.hidden) {
      // Handled: an open hub panel (ui/hub-panel.ts) stays open.
      event.preventDefault();
      setMenu(false);
      modeToggle.focus({ preventScroll: true });
    }
  };
  layer.addEventListener("keydown", onKey);
  // A dialog, a full-screen drawer or a full hub panel covers the Lobby: its
  // animations pause (the fighter's idle and aura) so the screen on top gets
  // the device, and resume when it closes. A sheet leaves the Lobby showing.
  const syncCovered = () => {
    const covered = !!document.querySelector(
      "dialog[open], .home-drawer:not([hidden]), .ui-panel:not(.ui-sheet, [data-ui-leaving])",
    );
    layer.classList.toggle("is-covered", covered);
    rig?.suspend(covered);
    for (const seat of seatRigs) seat?.suspend(covered);
  };
  /** A friend in a seat moves like your fighter (not on Low graphics). */
  const mountSeatRig = (seat: number) => {
    if (closed || lowGraphics()) return;
    const key = seatKeys[seat];
    void import("./shop-preview")
      .then(({ mountShopPreview }) => {
        const figure = $(`lobby-slot-${seat}`).querySelector<HTMLElement>(
          ".lobby-member",
        );
        // Closed, or the seat changed again while the renderer loaded.
        if (closed || !figure || seatKeys[seat] !== key || seatRigs[seat])
          return;
        seatRigs[seat] = mountShopPreview(figure, "selection");
        seatRigs[seat]!.suspend(layer.classList.contains("is-covered"));
      })
      .catch(() => {
        // The still artwork stays when the renderer can't load.
      });
  };
  /** Why your fighter is still artwork, for the frame-rate read-out. */
  let stillWhy = "";
  const mountRig = () => {
    if (rig || rigLoading || closed) return;
    if (lowGraphics()) {
      stillWhy = "Low graphics";
      return;
    }
    rigLoading = true;
    stillWhy = "loading";
    void import("./shop-preview")
      .then(({ mountShopPreview }) => {
        rigLoading = false;
        if (closed || rig || lowGraphics()) return;
        rig = mountShopPreview($("lobby-fighter"), "selection");
        rig.suspend(layer.classList.contains("is-covered"));
      })
      .catch((error: unknown) => {
        // The still artwork stays when the renderer can't load (the
        // read-out says why).
        rigLoading = false;
        stillWhy = `failed: ${error instanceof Error ? error.message : String(error)}`;
      });
  };
  /**
   * Graphics changed (Settings, or Auto settling on Low after a slow
   * Plaza): the fighters follow at once. They were only set up when the
   * Lobby opened or the fighter changed, so a Lobby opened on Low stayed
   * still artwork after picking High (owner, iPad Pro 13" M4, 17 Nov 2026).
   */
  const syncGraphics = () => {
    if (closed) return;
    if (lowGraphics()) {
      rig?.();
      rig = undefined;
      stillWhy = "Low graphics";
      for (const [i, seat] of seatRigs.entries()) {
        seat?.();
        seatRigs[i] = undefined;
      }
      return;
    }
    if (!rig) mountRig();
    for (let i = 0; i < 3; i++)
      if (!seatRigs[i] && seatKeys[i] && seatKeys[i] !== "null")
        mountSeatRig(i);
  };
  document.addEventListener("ea-graphics-change", syncGraphics);
  /**
   * The cards' column ends 8px above the mode button. Where the cards don't
   * all fit (short phones, a safe area, the Spire card shown), the least
   * urgent one steps aside: Friends, then Missions (the rail's badge still
   * counts them). Where only one card fits, a new zone keeps the Spire card
   * over the Journey or guide card; otherwise the Journey stays (the Spire
   * is still a tap away on Raids).
   * Measured once after an update or a resize, never per frame.
   */
  let fitFrame = 0;
  const fitCards = () => {
    fitFrame = 0;
    if (closed) return;
    const spireCardEl = $("lobby-spire-card");
    const spireShown = !spireCardEl.hidden;
    const order = [
      $("lobby-friends-card"),
      $("lobby-missions-card"),
      ...(spireShown
        ? spireCardEl.classList.contains("is-new")
          ? [$("lobby-journey-card")]
          : [spireCardEl]
        : []),
    ];
    for (const card of [
      $("lobby-friends-card"),
      $("lobby-missions-card"),
      $("lobby-journey-card"),
      spireCardEl,
    ])
      card.classList.remove("is-squeezed");
    const limit =
      layer.querySelector(".lobby-play")!.getBoundingClientRect().top - 8;
    const bottom = () =>
      Math.max(
        0,
        ...Array.from(
          layer.querySelectorAll<HTMLElement>(".lobby-cards > .lobby-card"),
          (c) => c.getBoundingClientRect().bottom,
        ),
      );
    for (const card of order) {
      if (bottom() <= limit) break;
      card.classList.add("is-squeezed");
    }
  };
  const fitSoon = () => {
    if (!fitFrame) fitFrame = requestAnimationFrame(fitCards);
  };
  addEventListener("resize", fitSoon);
  void document.fonts?.ready.then(fitSoon);
  const coverWatch = new MutationObserver(syncCovered);
  coverWatch.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open", "hidden", "data-ui-leaving"],
  });
  syncCovered();
  // The frame-rate read-out (perf-hud.ts): your fighter's frames, our own
  // drawing time (median and slowest) and its canvas, while the Lobby shows.
  const perfSource = () => {
    if (layer.classList.contains("is-covered")) return undefined;
    if (!rig) return `fighter: still art (${stillWhy || "no live rig"})`;
    const p = rig.perf();
    if (p.failed) return `fighter: still art (${p.failed})`;
    return (
      `fighter ${p.fps} fps  late ${Math.round(p.late * 100)}%\n` +
      `ours ${p.stepMs} ms (max ${p.stepMaxMs})\n` +
      `canvas ${p.canvas} @${p.resolution}x tex ${p.textures}x`
    );
  };
  setPerfSource("lobby", perfSource);
  return {
    update(view) {
      // The middle of the stage: your fighter, or your party's leader.
      const host = view.host;
      const character = host?.character ?? view.character;
      const skin = host ? (host.skin ?? null) : wornSkin(view.character);
      const centreLook = host ? host.look : view.look;
      const look = lookData(centreLook);
      const key = `${host ? `host:${host.name}` : "me"}|${character}|${skin?.skin ?? ""}|${skin?.stage ?? 1}|${look}`;
      // Only your own fighter steps through the roster from here. The
      // arrows keep their place (not [hidden], which style.css takes out of
      // the nameplate's grid, pulling the name off the fighter's axis).
      for (const step of Array.from(
        layer.querySelectorAll<HTMLButtonElement>(".lobby-step"),
      )) {
        step.classList.toggle("is-waiting", !!host);
        step.disabled = !!host;
        if (host) step.setAttribute("aria-hidden", "true");
        else step.removeAttribute("aria-hidden");
      }
      // The leader's name takes the element pill's place (same height, so
      // the stage doesn't move on a short phone).
      // You lead: the same crown under your own fighter, "♛ You".
      const crown = host ? host.name : view.leading ? "You" : "";
      $("lobby-host-name").textContent = crown ? `♛ ${crown}` : "";
      layer.querySelector(".lobby-name")!.classList.toggle("is-host", !!crown);
      $("lobby-fighter").classList.toggle("is-host", !!host);
      $("lobby-fighter").classList.toggle("is-away", !!host?.away);
      $("lobby-fighter-tap").setAttribute(
        "aria-label",
        host ? `Poke ${host.name}'s fighter` : "Poke your fighter",
      );
      if (key !== artKey) {
        artKey = key;
        if (champion !== character) {
          champion = character;
          lastQuip = undefined;
          taps = [];
        }
        const fighter = CHARACTERS[character];
        const art = $("lobby-fighter-art");
        $("lobby-fighter").style.setProperty("--element", hex(fighter.color));
        art.innerHTML = fighterStageArt(
          character,
          "lobby",
          host ? skin : undefined,
          centreLook ?? {},
        );
        art.dataset.previewChampion = character;
        art.dataset.previewItem = skin?.skin ?? "";
        art.dataset.previewStage = String(skin?.stage ?? 1);
        art.dataset.previewLook = look;
        $("lobby-fighter-name").textContent = fighter.name;
        $("lobby-fighter-element").innerHTML =
          `${elementIcon(fighter.element)}${fighter.element}`;
        art.classList.toggle("is-still", options.reduced);
        // New artwork: the rig re-attaches its canvas and poses the new look.
        if (rig) rig.update($("lobby-fighter"), "selection");
        else mountRig();
      }
      // Only a seat whose friend (or look) changed is drawn again.
      for (let i = 0; i < 3; i++) {
        const member = view.party[i];
        const seatKey = JSON.stringify(member ?? null);
        if (seatKey === seatKeys[i]) continue;
        seatKeys[i] = seatKey;
        seatRigs[i]?.();
        seatRigs[i] = undefined;
        $(`lobby-slot-${i}`).innerHTML = slotMarkup(member, i);
        if (member) mountSeatRig(i);
      }
      // Graphics may have changed since (Auto settling on Low elsewhere).
      syncGraphics();
      // One seat on each side keeps the stage even; the third seat (above
      // the right one) appears once both are taken. The server still allows
      // four players, and Friends can invite at any time.
      $("lobby-slot-2").hidden = view.party.length < 2;
      // Low graphics: PLAY keeps its glow but stops its light sweep.
      layer.dataset.graphics = lowGraphics() ? "low" : "auto";
      $("lobby-party-bar").hidden = view.partySize < 2;
      $("lobby-party-size").textContent = `Party · ${view.partySize}/4`;
      setInner(
        $("lobby-party-faces"),
        (view.partyFaces ?? [])
          .map(
            (f) =>
              `<span class="lobby-party-face${f.leader ? " is-leader" : ""}" title="${escape(f.name)}${f.leader ? " (leader)" : ""}">${avatarImage(f.avatar)}</span>`,
          )
          .join(""),
      );
      $("lobby-rejoin").hidden = !view.partyRoom;
      // In place (ui/patch.ts): updates come often (friends online, the
      // economy) and the cards' pictures and progress bars stay as they are.
      // A new player's guide takes the Journey card's place until it's done
      // or hidden (getting-started.ts); there is no room for a fourth card.
      const first = $("lobby-journey-card"),
        guide = view.guide?.active ? view.guide : undefined;
      first.dataset.lobbyAction = guide ? "guide" : "journey";
      first.classList.toggle("is-guide", !!guide);
      setInner(
        first,
        guide ? guideCard(guide) : journeyCard(view.economy?.journey),
      );
      setInner($("lobby-missions-card"), missionsCard(view.economy));
      $("lobby-friends-online").textContent =
        view.friendsOnline === null
          ? "Friends online"
          : `${view.friendsOnline} friend${view.friendsOnline === 1 ? "" : "s"} online`;
      const badge = layer.querySelector<HTMLElement>(
        '[data-badge-for="friends"]',
      )!;
      badge.hidden = !view.friendRequests;
      badge.textContent = String(Math.min(99, view.friendRequests));
      const missions = view.economy?.missions ?? [];
      const left = missions.filter((m) => !m.done).length;
      const missionBadge = layer.querySelector<HTMLElement>(
        '[data-badge-for="missions"]',
      )!;
      missionBadge.hidden = !missions.length || !left;
      missionBadge.textContent = String(left);
      missionBadge.classList.add("is-count");
      // The Spire, once open: its card above Missions (a shortcut past the
      // Raid Hub), glowing with a dot on Raids while something is new.
      const spire = view.spire ?? null;
      const spireCardEl = $("lobby-spire-card");
      spireCardEl.hidden = !spire;
      spireCardEl.classList.toggle("is-new", !!spire?.fresh);
      layer.classList.toggle("has-spire", !!spire);
      if (spire) setInner($("lobby-spire-text"), spireCard(spire));
      fitSoon();
      const raidBadge = layer.querySelector<HTMLElement>(
        '[data-badge-for="raids"]',
      )!;
      raidBadge.hidden = !spire?.fresh;
      raidBadge.classList.add("is-new");
    },
    close() {
      closed = true;
      rig?.();
      rig = undefined;
      for (const seat of seatRigs.splice(0)) seat?.();
      clearTimeout(bubbleTimer);
      clearTimeout(hopTimer);
      clearTimeout(armTimer);
      coverWatch.disconnect();
      setPerfSource("lobby", undefined);
      document.removeEventListener("ea-graphics-change", syncGraphics);
      cancelAnimationFrame(fitFrame);
      removeEventListener("resize", fitSoon);
      layer.removeEventListener("keydown", onKey);
      layer.remove();
      document.body.classList.remove("hub-screen");
    },
  };
}

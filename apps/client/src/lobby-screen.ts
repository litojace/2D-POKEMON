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
import { menuIcon } from "./menu-icons";
import { fighterStageArt, wornSkin } from "./fighter-selection";
import { lowGraphics } from "./graphics-quality";
import type { ShopPreviewHandle } from "./shop-preview";
import { fighterArt } from "./fighter-art";
import { elementIcon } from "./element-icons";
import { picksCountdown } from "./shop-ui";
import "./lobby.css";

/**
 * The Lobby: the one-screen hub after login (hub redesign phase 2). Your
 * fighter stands in the middle, party slots beside it, PLAY in the bottom
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
export const LOBBY_MODES: readonly {
  id: LobbyMode;
  label: string;
  hint: string;
  icon: Parameters<typeof menuIcon>[0];
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
    hint: "Best of five against a bot",
    icon: "bot",
  },
  {
    id: "bot-normal",
    label: "Vs AI · Normal",
    hint: "Best of five against a bot",
    icon: "bot",
  },
  {
    id: "bot-hard",
    label: "Vs AI · Hard",
    hint: "Best of five against a bot",
    icon: "bot",
  },
  {
    id: "practice",
    label: "Solo test",
    hint: "Practice skills on a target",
    icon: "target",
  },
];
const MODE_KEY = "arena-lobby-mode";
export function savedLobbyMode(): LobbyMode {
  try {
    const value = localStorage.getItem(MODE_KEY);
    if (LOBBY_MODES.some((m) => m.id === value)) return value as LobbyMode;
  } catch {
    /* Optional preference. */
  }
  return "duel";
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
  | "farm"
  | "more-play";
const RAIL: [LobbyAction, string, Parameters<typeof menuIcon>[0]][] = [
  ["fighters", "Fighters", "user"],
  ["wardrobe", "Wardrobe", "wardrobe"],
  ["shop", "Shop", "shop"],
  ["raids", "Raids", "bestiary"],
  ["journey", "Journey", "sparkle"],
  ["missions", "Missions", "missions"],
  ["ranks", "Ranks", "leaderboard"],
  ["friends", "Friends", "friends"],
];
const EMOTES = ["👋", "❤️", "😂", "GG", "🔥"] as const;

/** Another party member, as they stand on your Lobby stage. */
export interface LobbyPartyMember {
  name: string;
  character: CharacterId;
  leader: boolean;
}
export interface LobbyView {
  character: CharacterId;
  /** The other members of your party (up to three), or none. */
  party: LobbyPartyMember[];
  /** Party size including you (0: no party). */
  partySize: number;
  economy?: Economy;
  /** Friend requests waiting for an answer. */
  friendRequests: number;
  /** Friends online right now (null: not loaded). */
  friendsOnline: number | null;
}
export interface LobbyOptions {
  onAction(action: LobbyAction): void;
  onPlay(mode: LobbyMode): void;
  /** Step to the previous (-1) or next (1) fighter. */
  onStep(direction: -1 | 1): void;
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

function modeButton(mode: LobbyMode) {
  const m = LOBBY_MODES.find((x) => x.id === mode)!;
  return `<span class="lobby-mode-icon">${menuIcon(m.icon)}</span><span class="lobby-mode-text"><b>${m.label}</b><small>${m.hint}</small></span><span class="lobby-mode-caret" aria-hidden="true">▴</span>`;
}

/** A party slot: a friend's fighter, or a way to invite one. */
export function slotMarkup(member: LobbyPartyMember | undefined) {
  if (!member)
    return `<button type="button" class="lobby-slot" data-lobby-action="invite" aria-label="Invite a friend to your party"><span aria-hidden="true">+</span><small>Invite</small></button>`;
  return `<figure class="lobby-member" style="--element:${hex(CHARACTERS[member.character].color)}" aria-label="${escape(member.name)}${member.leader ? ", party leader" : ""}"><span class="lobby-member-art">${fighterArt(member.character, "20 0 160 160")}</span><figcaption>${member.leader ? '<b class="lobby-crown" aria-hidden="true">♛</b>' : ""}${escape(member.name)}</figcaption></figure>`;
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
  let mode = savedLobbyMode();
  /** Fighter + worn skin + stage now drawn on the stage. */
  let artKey: string | undefined;
  // The selected fighter moves with the same live rig as the Fighters roster
  // (shop-preview.ts, "selection" framing) over its still artwork. Low
  // graphics keeps the still artwork, as in the Plaza and the Farm.
  let rig: ShopPreviewHandle | undefined;
  let rigLoading = false;
  let closed = false;
  let partyKey: string | undefined;
  layer.innerHTML = `<div class="lobby-backdrop" aria-hidden="true"></div>
<nav class="lobby-rail" aria-label="Main menu">${RAIL.map(
    ([id, label, icon]) =>
      `<button type="button" data-lobby-action="${id}" title="${label}" aria-label="${label}">${menuIcon(icon)}<span>${label}</span><i class="lobby-badge" data-badge-for="${id}" hidden></i></button>`,
  ).join("")}</nav>
<section class="lobby-stage" aria-label="Your fighter">
  <div class="lobby-party-bar" id="lobby-party-bar" hidden><span id="lobby-party-size"></span><button type="button" data-lobby-action="leave-party">Leave party</button></div>
  <div class="lobby-party">
    <div class="lobby-slot-wrap" id="lobby-slot-0"></div>
    <figure class="lobby-fighter" id="lobby-fighter"><div class="lobby-fighter-art fighter-rig-stage" id="lobby-fighter-art" data-preview-look="%7B%7D" data-preview-action="idle"></div><span class="lobby-floor" aria-hidden="true"></span><output class="lobby-emote-bubble" id="lobby-emote-bubble" hidden></output></figure>
    <div class="lobby-slot-wrap" id="lobby-slot-1"></div>
    <div class="lobby-slot-wrap lobby-slot-third" id="lobby-slot-2"></div>
  </div>
  <div class="lobby-nameplate">
    <button type="button" class="lobby-step" data-lobby-step="-1" aria-label="Previous fighter">‹</button>
    <div class="lobby-name"><h2 id="lobby-fighter-name"></h2><span class="element-pill" id="lobby-fighter-element"></span></div>
    <button type="button" class="lobby-step" data-lobby-step="1" aria-label="Next fighter">›</button>
  </div>
</section>
<aside class="lobby-cards" aria-label="Today">
  <button type="button" class="lobby-card lobby-raid-card" data-lobby-action="raids"><span class="lobby-card-kicker">Raid Hall</span><b>Seven bosses</b><small>Solo or co-op · 1–4 players</small></button>
  <button type="button" class="lobby-card lobby-farm-card" data-lobby-action="farm" id="lobby-farm-card"><span class="lobby-card-kicker">Elemental Farm</span><span class="lobby-card-row"><b>Grow crops</b><small>Enter →</small></span><small id="lobby-farm-leaves">Earn Gold Leaves</small></button>
  <button type="button" class="lobby-card" data-lobby-action="journey" id="lobby-journey-card"></button>
  <button type="button" class="lobby-card lobby-missions-card" data-lobby-action="missions" id="lobby-missions-card"></button>
  <button type="button" class="lobby-card lobby-friends-card" data-lobby-action="friends" id="lobby-friends-card"><span class="lobby-card-kicker">Friends</span><b id="lobby-friends-online">Friends online</b><small>Invite, join or watch</small></button>
</aside>
<div class="lobby-emotes" role="group" aria-label="Emotes" data-open="false">
  <button type="button" class="lobby-emote-toggle" aria-expanded="false" aria-label="Emotes" title="Emotes">😊</button>
  <div class="lobby-emote-list">${EMOTES.map((e) => `<button type="button" data-lobby-emote="${e}" aria-label="Emote ${e}">${e}</button>`).join("")}</div>
</div>
<div class="lobby-play">
  <div class="lobby-mode-menu" id="lobby-mode-menu" role="menu" aria-label="Game mode" hidden>${LOBBY_MODES.map(
    (m) =>
      `<button type="button" role="menuitemradio" data-lobby-mode="${m.id}" aria-checked="${m.id === mode}">${menuIcon(m.icon)}<span><b>${m.label}</b><small>${m.hint}</small></span></button>`,
  ).join(
    "",
  )}<button type="button" role="menuitem" class="lobby-mode-more" data-lobby-action="more-play">${menuIcon("enter")}<span><b>Join or watch</b><small>Room code, name and more</small></span></button></div>
  <button type="button" class="lobby-mode" id="lobby-mode" aria-haspopup="menu" aria-expanded="false" aria-controls="lobby-mode-menu">${modeButton(mode)}</button>
  <button type="button" class="lobby-play-button" id="lobby-play"><span aria-hidden="true">▶</span>PLAY</button>
</div>`;
  document.body.append(layer);
  document.body.classList.add("hub-screen");
  const $ = <T extends HTMLElement>(id: string) =>
    layer.querySelector<T>(`#${id}`)!;
  const menu = $("lobby-mode-menu"),
    modeToggle = $<HTMLButtonElement>("lobby-mode"),
    emotes = layer.querySelector<HTMLElement>(".lobby-emotes")!;
  const setMenu = (open: boolean) => {
    menu.hidden = !open;
    modeToggle.setAttribute("aria-expanded", String(open));
    if (open)
      menu
        .querySelector<HTMLButtonElement>(`[data-lobby-mode="${mode}"]`)
        ?.focus({ preventScroll: true });
  };
  const setEmotes = (open: boolean) => {
    emotes.dataset.open = String(open);
    emotes
      .querySelector(".lobby-emote-toggle")!
      .setAttribute("aria-expanded", String(open));
  };
  let bubbleTimer: ReturnType<typeof setTimeout> | undefined;
  layer.addEventListener("click", (event) => {
    const target = event.target as Element;
    const action = target.closest<HTMLElement>("[data-lobby-action]")?.dataset
      .lobbyAction as LobbyAction | undefined;
    const step =
      target.closest<HTMLElement>("[data-lobby-step]")?.dataset.lobbyStep;
    const pick = target.closest<HTMLElement>("[data-lobby-mode]")?.dataset
      .lobbyMode as LobbyMode | undefined;
    const emote =
      target.closest<HTMLElement>("[data-lobby-emote]")?.dataset.lobbyEmote;
    if (target.closest("#lobby-mode")) return setMenu(menu.hidden);
    if (!target.closest("#lobby-mode-menu")) setMenu(false);
    if (target.closest(".lobby-emote-toggle"))
      return setEmotes(emotes.dataset.open !== "true");
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
    if (emote) {
      const bubble = $<HTMLOutputElement>("lobby-emote-bubble");
      bubble.textContent = emote;
      bubble.hidden = false;
      bubble.classList.remove("is-popping");
      void bubble.offsetWidth;
      bubble.classList.add("is-popping");
      clearTimeout(bubbleTimer);
      bubbleTimer = setTimeout(() => (bubble.hidden = true), 2600);
      setEmotes(false);
      return;
    }
    if (step) return options.onStep(step === "-1" ? -1 : 1);
    if (target.closest("#lobby-play")) return options.onPlay(mode);
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
      "dialog[open], .home-drawer:not([hidden]), .ui-panel:not(.ui-sheet)",
    );
    layer.classList.toggle("is-covered", covered);
    rig?.suspend(covered);
  };
  const mountRig = () => {
    if (rig || rigLoading || closed || lowGraphics()) return;
    rigLoading = true;
    void import("./shop-preview")
      .then(({ mountShopPreview }) => {
        rigLoading = false;
        if (closed || rig) return;
        rig = mountShopPreview($("lobby-fighter"), "selection");
        rig.suspend(layer.classList.contains("is-covered"));
      })
      .catch(() => {
        // The still artwork stays when the renderer can't load.
        rigLoading = false;
      });
  };
  const coverWatch = new MutationObserver(syncCovered);
  coverWatch.observe(document.body, {
    subtree: true,
    childList: true,
    attributes: true,
    attributeFilter: ["open", "hidden"],
  });
  syncCovered();
  return {
    update(view) {
      const skin = wornSkin(view.character);
      const key = `${view.character}|${skin?.skin ?? ""}|${skin?.stage ?? 1}`;
      if (key !== artKey) {
        artKey = key;
        const fighter = CHARACTERS[view.character];
        const art = $("lobby-fighter-art");
        $("lobby-fighter").style.setProperty("--element", hex(fighter.color));
        art.innerHTML = fighterStageArt(view.character);
        art.dataset.previewChampion = view.character;
        art.dataset.previewItem = skin?.skin ?? "";
        art.dataset.previewStage = String(skin?.stage ?? 1);
        $("lobby-fighter-name").textContent = fighter.name;
        $("lobby-fighter-element").innerHTML =
          `${elementIcon(fighter.element)}${fighter.element}`;
        art.classList.toggle("is-still", options.reduced);
        // New artwork: the rig re-attaches its canvas and poses the new look.
        if (rig) rig.update($("lobby-fighter"), "selection");
        else mountRig();
      }
      const slots = view.party
        .map((m) => JSON.stringify([m.name, m.character, m.leader]))
        .join("|");
      if (slots !== partyKey) {
        partyKey = slots;
        for (let i = 0; i < 3; i++)
          $(`lobby-slot-${i}`).innerHTML = slotMarkup(view.party[i]);
      }
      $("lobby-party-bar").hidden = view.partySize < 2;
      $("lobby-party-size").textContent = `Party · ${view.partySize}/4`;
      const leaves = view.economy?.leaves?.balance;
      $("lobby-farm-leaves").textContent =
        leaves === undefined
          ? "Earn Gold Leaves"
          : `${leaves.toLocaleString("en-US")} Gold Leaves`;
      $("lobby-journey-card").innerHTML = journeyCard(view.economy?.journey);
      $("lobby-missions-card").innerHTML = missionsCard(view.economy);
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
    },
    close() {
      closed = true;
      rig?.();
      rig = undefined;
      clearTimeout(bubbleTimer);
      coverWatch.disconnect();
      layer.removeEventListener("keydown", onKey);
      layer.remove();
      if (!document.querySelector(".farm-layer"))
        document.body.classList.remove("hub-screen");
    },
  };
}

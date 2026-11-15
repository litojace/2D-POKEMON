/**
 * Quick chat in a battle (docs/chat-plan.md): one button top left, a 2×4
 * grid of calls and emotes beside it, a bubble over the speaker's name, and
 * the last three team lines fading under the button. No typing, no drawer:
 * the keyboard would cover the controls.
 *
 * - Teammates hear calls and phrases; opponents only see emotes (the server
 *   decides), and "Mute rivals" hides those too on this device.
 * - In a raid the grid starts with the raid's team signals (Stack, Revive,
 *   Bait…), which mark the arena as before (raid-ping), in place of the
 *   raid's own signals button.
 *
 * Performance (docs/network-performance.md): nothing here runs per frame.
 * The bubble is a child of the fighter's nameplate, so it moves with it for
 * free; the feed fades with a CSS animation (opacity only); no layout is
 * read.
 */
import {
  CHAT_CALLS,
  CHAT_EMOTES,
  CHAT_PHRASES,
  quickText,
  type ChatQuick,
} from "../../../../packages/shared/src/chat";
import type { RaidPingKind } from "../../../../packages/shared/src/raid";
import { menuIcon } from "../menu-icons";

interface Reply {
  ok: boolean;
  error?: string;
}
export interface BattleChatHooks {
  send(quick: ChatQuick): Promise<Reply>;
  ping(kind: RaidPingKind): void;
  /** A raid signal's label on this boss ("Island here" on Tidewyrm). */
  pingLabel(kind: RaidPingKind): string;
}
export interface BattleChatView {
  /** Shown in a battle with other people in it; in a raid, its signals. */
  sync(show: boolean, raid: boolean): void;
  /**
   * A line from the room: `plate` is the speaker's nameplate (a bubble goes
   * over it), `team` whether they fight on your side.
   */
  receive(
    text: string,
    name: string,
    plate: HTMLElement | null,
    team: boolean,
    emote: boolean,
  ): void;
  close(): void;
}

const MUTE_KEY = "ea-mute-rivals";
const PVP: ChatQuick[] = [
  "attack",
  "back",
  "help",
  "omw",
  "group",
  "gg",
  "wave",
  "fire",
];
const RAID: ChatQuick[] = ["help", "omw", "careful", "gg", "fire"];
const PINGS: RaidPingKind[] = ["stack", "revive", "bait"];
const BUBBLE_MS = 2600;
const FEED_LINES = 3;

const label = (q: ChatQuick) =>
  q in CHAT_EMOTES
    ? quickText(q)
    : ((CHAT_CALLS as Record<string, string>)[q] ??
      (CHAT_PHRASES as Record<string, string>)[q]);

function readMute() {
  try {
    return localStorage.getItem(MUTE_KEY) === "1";
  } catch {
    return false;
  }
}

export function mountBattleChat(hooks: BattleChatHooks): BattleChatView {
  const button = document.createElement("button");
  button.type = "button";
  button.id = "battle-chat";
  button.className = "battle-chat";
  button.hidden = true;
  button.setAttribute("aria-label", "Quick chat");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "battle-chat-grid");
  button.innerHTML = menuIcon("chat");
  const grid = document.createElement("div");
  grid.id = "battle-chat-grid";
  grid.className = "battle-chat-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "Quick chat");
  grid.hidden = true;
  const feed = document.createElement("ol");
  feed.className = "battle-chat-feed";
  feed.setAttribute("aria-live", "polite");
  document.body.append(button, grid, feed);

  let raid = false;
  let muted = readMute();
  let sentAt = 0;

  function render() {
    const chips = (raid ? RAID : PVP).map(
      (q) =>
        `<button type="button"${q in CHAT_EMOTES ? ' class="is-emote"' : ""} data-battle-quick="${q}" aria-label="${q in CHAT_EMOTES ? q : label(q)}">${label(q)}</button>`,
    );
    const pings = raid
      ? PINGS.map(
          (k) =>
            `<button type="button" class="is-ping" data-battle-ping="${k}">${hooks.pingLabel(k)}</button>`,
        )
      : [];
    grid.innerHTML = [
      ...pings,
      ...chips,
      // (No rivals in a raid.)
      ...(raid
        ? []
        : [
            `<button type="button" class="is-mute" data-battle-mute aria-pressed="${muted}">${muted ? "Rivals muted" : "Mute rivals"}</button>`,
          ]),
    ].join("");
  }

  const setOpen = (open: boolean) => {
    grid.hidden = !open;
    button.setAttribute("aria-expanded", String(open));
  };
  button.addEventListener("click", () => {
    if (grid.hidden) render();
    setOpen(grid.hidden);
  });
  grid.addEventListener("click", (e) => {
    const t = e.target as HTMLElement;
    const quick = t.closest<HTMLElement>("[data-battle-quick]")?.dataset
      .battleQuick as ChatQuick | undefined;
    const ping = t.closest<HTMLElement>("[data-battle-ping]")?.dataset
      .battlePing as RaidPingKind | undefined;
    if (t.closest("[data-battle-mute]")) {
      muted = !muted;
      try {
        localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
      } catch {
        /* No storage: for this battle only. */
      }
      render();
      return;
    }
    if (ping) hooks.ping(ping);
    else if (quick) {
      const now = performance.now();
      if (now - sentAt < 1000) return;
      sentAt = now;
      void hooks.send(quick);
    } else return;
    setOpen(false);
  });
  // A press anywhere else closes the grid (not the button: it toggles).
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (grid.hidden) return;
      const t = e.target as Node;
      if (!grid.contains(t) && !button.contains(t)) setOpen(false);
    },
    true,
  );

  function bubble(plate: HTMLElement, text: string) {
    let b = plate.querySelector<HTMLElement>(":scope > .chat-bubble");
    if (!b) {
      b = document.createElement("span");
      b.className = "chat-bubble";
      plate.append(b);
    }
    b.textContent = text;
    b.classList.toggle("is-emote", [...text].length <= 2);
    // Pop in, hold, fade (Web Animations: no style flush or layout read).
    b.getAnimations().forEach((a) => a.cancel());
    b.animate(
      [
        { opacity: 0, transform: "translate(-50%, 6px) scale(0.6)" },
        { opacity: 1, transform: "translate(-50%, 0) scale(1)", offset: 0.08 },
        { opacity: 1, transform: "translate(-50%, 0) scale(1)", offset: 0.85 },
        { opacity: 0, transform: "translate(-50%, -6px) scale(1)" },
      ],
      { duration: BUBBLE_MS, fill: "forwards", easing: "ease-out" },
    );
  }

  return {
    sync(show, isRaid) {
      button.hidden = !show;
      feed.hidden = !show;
      if (!show) {
        setOpen(false);
        feed.replaceChildren();
      }
      if (isRaid !== raid) {
        raid = isRaid;
        if (!grid.hidden) render();
      }
      button.dataset.raid = String(raid);
    },
    receive(text, name, plate, team, emote) {
      if (button.hidden) return;
      if (!team && (muted || !emote)) return;
      if (plate) bubble(plate, text);
      const li = document.createElement("li");
      const who = document.createElement("b");
      who.textContent = name;
      li.append(who, document.createTextNode(` ${text}`));
      if (!team) li.classList.add("is-rival");
      feed.append(li);
      while (feed.children.length > FEED_LINES)
        feed.firstElementChild!.remove();
      li.addEventListener("animationend", () => li.remove(), { once: true });
    },
    close() {
      button.remove();
      grid.remove();
      feed.remove();
    },
  };
}

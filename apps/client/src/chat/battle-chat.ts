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
 * - Each feed line starts with who heard it: TEAM (a call or a phrase, the
 *   speaker's side only) or ALL (an emote, or a watcher's line).
 * - Watching a room: emotes and cheers (no calls: a watcher takes no side).
 *   The players see a watcher's line in the feed, an eye before the name;
 *   "Mute others" (was "Mute rivals") hides watchers along with rivals.
 *
 * Motion (ui/motion.ts rules: transform and opacity only, never waited on,
 * off with reduced motion or Low graphics): the grid fades and scales in
 * and out; a new feed line slides in from the left; when a fourth line
 * pushes the oldest out, the others glide up into its place instead of
 * jumping (its height is read once, at that moment, never per frame).
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
import { EASE_OUT, uiMotion } from "../ui/motion";

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
  /**
   * Shown in a battle with other people in it; in a raid, its signals;
   * `watcher` when this device watches the room (cheers, no calls).
   */
  sync(show: boolean, raid: boolean, watcher?: boolean): void;
  /**
   * A line from the room: `plate` is the speaker's nameplate (a bubble goes
   * over it), `team` whether they fight on your side, `watcher` whether
   * the speaker is watching the room.
   */
  receive(
    text: string,
    name: string,
    plate: HTMLElement | null,
    team: boolean,
    emote: boolean,
    watcher?: boolean,
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
/** Watching: cheers and emotes, the same eight in a battle and a raid. */
const WATCH: ChatQuick[] = [
  "nice",
  "wp",
  "go",
  "gg",
  "clap",
  "fire",
  "laugh",
  "wave",
];
const PINGS: RaidPingKind[] = ["stack", "revive", "bait"];
const BUBBLE_MS = 2600;
const FEED_LINES = 3;
/** The feed's row gap (chat.css, .battle-chat-feed gap). */
const FEED_GAP = 2;

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
  let watching = false;
  let muted = readMute();
  let sentAt = 0;

  function render() {
    const chips = (watching ? WATCH : raid ? RAID : PVP).map(
      (q) =>
        `<button type="button"${q in CHAT_EMOTES ? ' class="is-emote"' : ""} data-battle-quick="${q}" aria-label="${q in CHAT_EMOTES ? q : label(q)}">${label(q)}</button>`,
    );
    const pings =
      raid && !watching
        ? PINGS.map(
            (k) =>
              `<button type="button" class="is-ping" data-battle-ping="${k}">${hooks.pingLabel(k)}</button>`,
          )
        : [];
    // In a battle it hides rivals and watchers alike; a watcher hides the
    // players' emotes. (A raid has no rivals: no button, as before.)
    const others = watching ? "players" : "others";
    grid.innerHTML = [
      ...pings,
      ...chips,
      ...(raid && !watching
        ? []
        : [
            `<button type="button" class="is-mute" data-battle-mute aria-pressed="${muted}">${muted ? `${others[0].toUpperCase()}${others.slice(1)} muted` : `Mute ${others}`}</button>`,
          ]),
    ].join("");
  }

  let open = false;
  let gridFade: Animation | null = null;
  const setOpen = (next: boolean) => {
    if (next === open) return;
    open = next;
    button.setAttribute("aria-expanded", String(open));
    gridFade?.cancel();
    gridFade = null;
    // Applied at once (pressable or not); the fade only plays over it.
    grid.inert = !open;
    if (open) grid.hidden = false;
    if (!uiMotion() || typeof grid.animate !== "function") {
      grid.hidden = !open;
      return;
    }
    const shut = { opacity: 0, transform: "scale(0.94)" },
      shown = { opacity: 1, transform: "none" };
    gridFade = grid.animate(open ? [shut, shown] : [shown, shut], {
      duration: open ? 140 : 110,
      easing: EASE_OUT,
    });
    if (!open)
      gridFade.onfinish = () => {
        if (!open) grid.hidden = true;
      };
  };
  button.addEventListener("click", () => {
    if (!open) render();
    setOpen(!open);
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
      if (!open) return;
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
    sync(show, isRaid, isWatcher = false) {
      button.hidden = !show;
      feed.hidden = !show;
      if (!show) {
        setOpen(false);
        feed.replaceChildren();
      }
      if (isRaid !== raid || isWatcher !== watching) {
        raid = isRaid;
        watching = isWatcher;
        if (open) render();
      }
      button.dataset.raid = String(raid);
      button.dataset.watching = String(watching);
    },
    receive(text, name, plate, team, emote, watcher = false) {
      if (button.hidden) return;
      // A watcher's cheer reaches everyone; a rival's only as an emote.
      if (!team && (muted || (!emote && !watcher))) return;
      if (plate) bubble(plate, text);
      const li = document.createElement("li");
      const who = document.createElement("b");
      who.textContent = name;
      // A watcher: an eye before the name (they have no fighter).
      if (watcher) {
        who.insertAdjacentHTML("afterbegin", menuIcon("watch"));
        const eye = who.firstElementChild!;
        eye.removeAttribute("aria-hidden");
        eye.setAttribute("role", "img");
        eye.setAttribute("aria-label", "Watching");
      }
      // Who heard it (the server decides; this says what it decided): an
      // emote or a watcher's line reaches the whole room, a call or a
      // phrase only the speaker's side.
      const to = emote || watcher ? "all" : "team";
      li.dataset.to = to;
      const tag = document.createElement("span");
      tag.className = "battle-chat-to";
      tag.textContent = to === "all" ? "ALL" : "TEAM";
      const said = document.createElement("span");
      said.textContent = text;
      // The name and the words share one cell (the tags make a column).
      const body = document.createElement("span");
      body.className = "battle-chat-say";
      body.append(who, " ", said);
      li.append(tag, body);
      if (watcher) li.classList.add("is-watcher");
      else if (!team) li.classList.add("is-rival");
      const motion = uiMotion() && typeof li.animate === "function";
      // A fourth line pushes the oldest out: the others glide up into its
      // place (its height read once, now, before the new line is added).
      const out: HTMLElement[] = [];
      while (feed.children.length - out.length >= FEED_LINES)
        out.push(feed.children[out.length] as HTMLElement);
      const lift = motion
        ? out.reduce((h, el) => h + el.offsetHeight, 0) + out.length * FEED_GAP
        : 0;
      for (const el of out) el.remove();
      feed.append(li);
      li.addEventListener("animationend", () => li.remove(), { once: true });
      if (!motion) return;
      if (lift)
        for (const el of Array.from(feed.children) as HTMLElement[])
          if (el !== li)
            el.animate(
              [{ transform: `translateY(${lift}px)` }, { transform: "none" }],
              { duration: 180, easing: EASE_OUT },
            );
      li.animate(
        [
          {
            opacity: 0,
            transform: `translate(-10px, ${lift ? lift : 0}px)`,
          },
          { opacity: 1, transform: "none" },
        ],
        { duration: lift ? 180 : 150, easing: EASE_OUT },
      );
    },
    close() {
      button.remove();
      grid.remove();
      feed.remove();
    },
  };
}

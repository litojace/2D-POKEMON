/**
 * In-game chat on screen (docs/chat-plan.md): the chat button and the
 * drawer it opens.
 *
 * - The button sits in the hub's top bar 12 px right of the player card
 *   (placed by scene-switch-place.ts, which already measures that bar), and
 *   top left in a room. Its dot counts lines that came while it was shut.
 * - The drawer slides in from the left over the screen's left side, so the
 *   PLAY and Ready buttons on the right stay free. Tabs: the party, the
 *   room or Nearby, whichever you are in, and Friends (signed-in players):
 *   your friends, each with their unread count, and a conversation with one.
 *   A row of quick-chat chips sits over the typing box, so a line can go
 *   without the keyboard.
 * - With the keyboard up (iPhone), the drawer shrinks to the room above it:
 *   measured from visualViewport when it resizes, never every frame.
 *
 * Lines are built with textContent: nothing a player types becomes markup.
 */
import {
  CHAT_EMOTES,
  CHAT_LIMITS,
  CHAT_PHRASES,
  quickText,
  typingRefusal,
  type ChatChannel,
  type ChatLine,
  type ChatMode,
  type ChatQuick,
} from "../../../../packages/shared/src/chat";
import { filterChat } from "../../../../packages/shared/src/chat-filter";
import { iconLabel, menuIcon } from "../menu-icons";
import { needsStamp, stampLong, stampText } from "./chat-time";
import type { PushState } from "./push-setup";

export type ChatPlace = "hub" | "room" | "none";
interface Reply {
  ok: boolean;
  error?: string;
}
export interface ChatFriend {
  id: string;
  name: string;
  online: boolean;
  unread: number;
}
export interface ChatHooks {
  /** `to`: the friend, on the Friends tab. */
  send(
    channel: ChatChannel,
    body: { text: string } | { quick: ChatQuick },
    to?: string,
  ): Promise<Reply & { kept?: boolean }>;
  history(channel: ChatChannel, to?: string): Promise<ChatLine[]>;
  /** Your friends for the Friends tab (null: couldn't load them). */
  friends(): Promise<ChatFriend[] | null>;
  /** You read everything this friend sent so far. */
  read(friendId: string): void;
  /** The signed-in player, or null. */
  me(): { id: string; guest: boolean } | null;
  /** Block a player (it asks first); resolves true once blocked. */
  block(accountId: string, name: string): Promise<boolean>;
  /** Report a line: the server attaches the lines it kept. */
  report(channel: ChatChannel, lineId: number, to?: string): Promise<Reply>;
  /** The player picked a chat setting (keep it, tell the server). */
  setMode(mode: ChatMode): void;
  /**
   * Notifications of friends' messages on this device (push-setup.ts):
   * what it can do, and turning them on or off (from the tap itself).
   */
  push?: {
    state(): Promise<PushState | "server-off">;
    toggle(on: boolean): Promise<Reply>;
    /** Game news (admins' announcements) on this device, and changing it. */
    news?(): boolean;
    setNews?(on: boolean): Promise<Reply>;
  };
}
export interface ChatView {
  /** Where the button shows, and which channels are open now. */
  sync(place: ChatPlace, channels: Partial<Record<ChatChannel, boolean>>): void;
  /** A line from the server. */
  receive(line: ChatLine): void;
  /** Typed lines on or off on the server (quick chat is always on). */
  setFreeText(on: boolean): void;
  /** The player's chat setting (Settings): free, quick chat only, off. */
  setMode(mode: ChatMode): void;
  /** Unread friends' messages, by friend (on connecting). */
  setUnread(byFriend: Record<string, number>): void;
  /** Open the chat on a conversation with this friend (the Friends list). */
  openFriend(id: string, name: string): void;
  /** Put the hub button at this spot (px from the top left). */
  placeButton(x: number, y: number): void;
  isOpen(): boolean;
  close(): void;
}

const LABEL: Record<ChatChannel, string> = {
  party: "Party",
  team: "Team",
  room: "Room",
  place: "Nearby",
  friend: "Friends",
};
// A 2v2 room's Team comes before Room: it opens first (docs/hidden-picks.md).
const CHANNELS: ChatChannel[] = ["party", "team", "room", "place", "friend"];
/** The quick chips under the lines: emotes, then phrases. */
const CHIPS: ChatQuick[] = [
  ...(Object.keys(CHAT_EMOTES) as ChatQuick[]),
  ...(Object.keys(CHAT_PHRASES) as ChatQuick[]),
];

const MODE_NOTE: Record<ChatMode, string> = {
  free: "Type with your party, room and friends; quick chat everywhere. Tap a message to mute, block or report.",
  quick:
    "Only preset phrases and emotes: no typed messages, from you or to you.",
  off: "No chat at all. Your team's raid signals still show on the arena.",
};

export function mountChat(hooks: ChatHooks): ChatView {
  const button = document.createElement("button");
  button.type = "button";
  button.id = "chat-button";
  button.className = "chat-button";
  button.hidden = true;
  button.setAttribute("aria-label", "Chat");
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "chat-drawer");
  button.innerHTML = `${menuIcon("chat")}<span class="chat-unread" hidden></span>`;
  const unread = button.querySelector<HTMLElement>(".chat-unread")!;

  const drawer = document.createElement("aside");
  drawer.id = "chat-drawer";
  drawer.className = "chat-drawer";
  drawer.hidden = true;
  drawer.setAttribute("role", "dialog");
  drawer.setAttribute("aria-label", "Chat");
  drawer.innerHTML = `<header class="chat-head"><div class="chat-tabs" role="tablist" aria-label="Chat channels"></div><button type="button" class="chat-gear" aria-label="Chat settings" aria-expanded="false">${menuIcon("settings")}</button><button type="button" class="chat-close" aria-label="Close chat">${menuIcon("cancel")}</button></header><div class="chat-prefs" hidden><div class="chat-modes" role="radiogroup" aria-label="Chat">${(
    [
      ["free", "On"],
      ["quick", "Quick only"],
      ["off", "Off"],
    ] as const
  )
    .map(
      ([m, label]) =>
        `<button type="button" role="radio" data-chat-mode="${m}" aria-checked="false">${label}</button>`,
    )
    .join(
      "",
    )}</div><p class="chat-mode-note"></p><div class="chat-push" hidden><button type="button" role="switch" class="chat-push-toggle" aria-checked="false">Notify me of friends' messages</button><p class="chat-push-note"></p><button type="button" role="switch" class="chat-news-toggle" aria-checked="true" hidden>Game news from the admins</button></div></div><div class="chat-with" hidden><button type="button" class="chat-back" aria-label="All friends">${menuIcon("back")}</button><b></b></div><ol class="chat-lines" aria-live="polite"></ol><p class="chat-empty" hidden></p><div class="chat-quick" role="group" aria-label="Quick chat">${CHIPS.map((q) => `<button type="button" class="chat-chip" data-chat-quick="${q}">${quickText(q)}</button>`).join("")}</div><form class="chat-form"><input id="chat-input" class="chat-input" type="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" maxlength="${CHAT_LIMITS.length}" aria-label="Message"><button type="submit" class="chat-send" aria-label="Send">${iconLabel("send", "Send")}</button></form><p class="chat-note" role="status"></p>`;
  document.body.append(button, drawer);
  const tabs = drawer.querySelector<HTMLElement>(".chat-tabs")!;
  const list = drawer.querySelector<HTMLOListElement>(".chat-lines")!;
  const empty = drawer.querySelector<HTMLElement>(".chat-empty")!;
  const quick = drawer.querySelector<HTMLElement>(".chat-quick")!;
  const form = drawer.querySelector<HTMLFormElement>(".chat-form")!;
  const input = drawer.querySelector<HTMLInputElement>(".chat-input")!;
  const note = drawer.querySelector<HTMLElement>(".chat-note")!;
  const gear = drawer.querySelector<HTMLButtonElement>(".chat-gear")!;
  const prefs = drawer.querySelector<HTMLElement>(".chat-prefs")!;

  const lines: Record<ChatChannel, ChatLine[]> = {
    party: [],
    team: [],
    room: [],
    place: [],
    friend: [],
  };
  const unseen: Record<ChatChannel, number> = {
    party: 0,
    team: 0,
    room: 0,
    place: 0,
    friend: 0,
  };
  const loaded = new Set<string>();
  // Friends: a conversation per friend, and how many each sent unread.
  const friendLines = new Map<string, ChatLine[]>();
  const friendUnseen = new Map<string, number>();
  let friends: ChatFriend[] | null = null;
  /** The friend whose conversation is open (null: the list of friends). */
  let friendTo: { id: string; name: string } | null = null;
  const countFriends = () => {
    let n = 0;
    for (const v of friendUnseen.values()) n += v;
    unseen.friend = n;
  };
  /** The lines a channel shows now (a friend's: the open conversation). */
  const linesOf = (c: ChatChannel) =>
    c !== "friend"
      ? lines[c]
      : friendTo
        ? (friendLines.get(friendTo.id) ?? [])
        : [];
  /** Who the other side of a friend's line is. */
  const otherOf = (l: ChatLine) =>
    l.from.id === hooks.me()?.id ? (l.to ?? "") : l.from.id;
  let open: ChatChannel[] = [];
  let active: ChatChannel | null = null;
  let place: ChatPlace = "none";
  let freeText = false;
  let mode: ChatMode = "free";
  /** Players muted on this device for this session (their lines hidden). */
  const muted = new Set<string>();
  let noteTimer = 0;

  const say = (text: string) => {
    note.textContent = text;
    clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => (note.textContent = ""), 4000);
  };

  function lineElement(l: ChatLine) {
    const li = document.createElement("li");
    li.className = "chat-line";
    li.dataset.line = String(l.id);
    li.dataset.at = String(l.at);
    const mine = l.from.id === hooks.me()?.id;
    if (mine) li.classList.add("is-mine");
    if (l.quick) li.classList.add("is-quick");
    // Someone else's line is a button: tap it to mute, block or report.
    const body = document.createElement(mine ? "div" : "button");
    body.className = "chat-say";
    if (!mine) {
      (body as HTMLButtonElement).type = "button";
      body.dataset.from = l.from.id;
      body.setAttribute("aria-haspopup", "true");
    }
    const who = document.createElement("b");
    who.textContent = l.from.name;
    // Someone watching the room: an eye before the name.
    if (l.watcher) {
      li.classList.add("is-watcher");
      who.insertAdjacentHTML("afterbegin", menuIcon("watch"));
      const eye = who.firstElementChild!;
      eye.removeAttribute("aria-hidden");
      eye.setAttribute("role", "img");
      eye.setAttribute("aria-label", "Watching");
    }
    const what = document.createElement("span");
    what.textContent = l.quick ? quickText(l.quick) : (l.text ?? "");
    body.append(who, what);
    li.append(body);
    return li;
  }
  /** A small centred time before a line that starts a stretch (chat-time.ts). */
  function stampElement(at: number) {
    const li = document.createElement("li");
    li.className = "chat-stamp";
    li.setAttribute("role", "separator");
    const t = document.createElement("time");
    t.dateTime = new Date(at).toISOString();
    t.textContent = stampText(at);
    t.title = stampLong(at);
    li.setAttribute("aria-label", stampLong(at));
    li.append(t);
    return li;
  }
  /** Lines with their time stamps between them. */
  function withStamps(lines: ChatLine[]) {
    const out: HTMLElement[] = [];
    let prev: number | null = null;
    for (const l of lines) {
      if (needsStamp(l.at, prev)) out.push(stampElement(l.at));
      out.push(lineElement(l));
      prev = l.at;
    }
    return out;
  }
  const shown = (c: ChatChannel) =>
    linesOf(c).filter((l) => !muted.has(l.from.id));

  /** The menu under a line: mute, block, report (with a second step). */
  function lineMenu(li: HTMLElement, l: ChatLine) {
    list.querySelector(".chat-menu")?.remove();
    const menu = document.createElement("li");
    menu.className = "chat-menu";
    const plain = () => {
      menu.innerHTML = `<button type="button" data-chat-act="mute">${iconLabel("sound", "Mute")}</button><button type="button" data-chat-act="block">${iconLabel("block", "Block")}</button><button type="button" data-chat-act="report">${iconLabel("report", "Report")}</button>`;
    };
    plain();
    menu.addEventListener("click", async (e) => {
      const act = (e.target as HTMLElement).closest<HTMLElement>(
        "[data-chat-act]",
      )?.dataset.chatAct;
      if (!act) return;
      if (act === "mute") {
        muted.add(l.from.id);
        menu.remove();
        renderLines();
        say(`${l.from.name} is muted until you restart the game.`);
      } else if (act === "block") {
        menu.remove();
        if (await hooks.block(l.from.id, l.from.name)) {
          muted.add(l.from.id);
          renderLines();
        }
      } else if (act === "report") {
        menu.innerHTML = `<p>Report this message from <b></b>? The last messages go with it.</p><button type="button" data-chat-act="send">${iconLabel("report", "Report")}</button><button type="button" data-chat-act="cancel">${iconLabel("cancel", "Cancel")}</button>`;
        menu.querySelector("b")!.textContent = l.from.name;
      } else if (act === "cancel") menu.remove();
      else if (act === "send" && active) {
        const reply = await hooks.report(
          active,
          l.id,
          active === "friend" ? friendTo?.id : undefined,
        );
        menu.remove();
        say(
          reply.ok
            ? "Report sent. Thank you: we look at every report."
            : (reply.error ?? "Couldn't send the report. Try again."),
        );
      }
    });
    li.after(menu);
  }

  function renderTabs() {
    tabs.innerHTML = open
      .map(
        (c) =>
          `<button type="button" role="tab" class="chat-tab" data-chat-tab="${c}" aria-selected="${c === active}"${c === "friend" ? ` aria-label="${LABEL[c]}"` : ""}>${c === "friend" ? `${menuIcon("friends")}<span>${LABEL[c]}</span>` : LABEL[c]}${unseen[c] && c !== active ? `<i>${Math.min(unseen[c], 9)}${unseen[c] > 9 ? "+" : ""}</i>` : ""}</button>`,
      )
      .join("");
  }

  /** The Friends tab without a conversation open: your friends. */
  function friendRows() {
    return (friends ?? []).map((f) => {
      const li = document.createElement("li");
      li.className = "chat-friend";
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.chatFriend = f.id;
      b.dataset.name = f.name;
      const n = friendUnseen.get(f.id) ?? 0;
      b.setAttribute(
        "aria-label",
        `${f.name}, ${f.online ? "online" : "offline"}${n ? `, ${n} new` : ""}`,
      );
      const dot = document.createElement("i");
      dot.className = f.online ? "is-online" : "";
      const name = document.createElement("b");
      name.textContent = f.name;
      b.append(dot, name);
      if (n) {
        const count = document.createElement("em");
        count.textContent = n > 9 ? "9+" : String(n);
        b.append(count);
      }
      li.append(b);
      return li;
    });
  }

  function renderLines() {
    const listing = active === "friend" && !friendTo && mode !== "off";
    drawer.classList.toggle("is-listing", listing);
    const head = drawer.querySelector<HTMLElement>(".chat-with")!;
    head.hidden = !(active === "friend" && friendTo);
    if (friendTo) head.querySelector("b")!.textContent = friendTo.name;
    list.replaceChildren(
      ...(listing ? friendRows() : withStamps(active ? shown(active) : [])),
    );
    empty.hidden =
      mode !== "off" &&
      !!active &&
      (listing ? !!friends?.length : shown(active).length > 0);
    // After the note: while it shows, the list is hidden (no height), and
    // scrolling it then left a channel's loaded history at its oldest line.
    list.scrollTop = listing ? 0 : list.scrollHeight;
    empty.textContent =
      mode === "off"
        ? "Chat is off. Turn it on with the gear above."
        : !active
          ? "Invite a friend to a party, or join a room, to chat."
          : listing
            ? friends === null
              ? "Loading your friends…"
              : friends.length
                ? ""
                : "Add friends from Friends on the Lobby's left to message them here."
            : active === "team"
              ? "Only your team reads this. Agree on your fighters here."
              : active === "room" && open.includes("team")
                ? "Both teams read Room. Plan your picks in Team."
                : "No messages yet. Say hi!";
  }

  function renderForm() {
    const me = hooks.me();
    const own = active
      ? typingRefusal({
          channel: active,
          inBattle: false,
          guest: !!me?.guest,
          mode,
        })
      : null;
    // Your own setting first, then the server's switch, then the channel.
    const refusal = !active
      ? "Nobody to chat with yet."
      : active === "friend" && !friendTo
        ? "Choose a friend."
        : mode !== "free"
          ? own
          : !freeText
            ? "Quick chat only for now."
            : own;
    input.disabled = !!refusal;
    input.placeholder = refusal ?? "Message";
    form.querySelector<HTMLButtonElement>(".chat-send")!.disabled = !!refusal;
    for (const b of Array.from(
      quick.querySelectorAll<HTMLButtonElement>("button"),
    ))
      b.disabled =
        !active || mode === "off" || (active === "friend" && !friendTo);
  }

  function renderBadge() {
    const total = open.reduce(
      // (Friends counts every friend's unread, the open one aside.)
      (n, c) =>
        n + (drawer.hidden || c !== active || c === "friend" ? unseen[c] : 0),
      0,
    );
    unread.hidden = total === 0;
    unread.textContent = total > 9 ? "9+" : String(total);
    button.setAttribute("aria-label", total ? `Chat, ${total} new` : "Chat");
  }

  /** Kept lines first, then any that came while they loaded. */
  const merge = (older: ChatLine[], now: ChatLine[]) => {
    const seen = new Set(now.map((l) => l.id));
    // Stored friends' lines have negative ids (newer: further below zero),
    // live ones positive: order by time, then id.
    return [...older.filter((l) => !seen.has(l.id)), ...now]
      .sort((a, b) => a.at - b.at || Math.abs(a.id) - Math.abs(b.id))
      .slice(-CHAT_LIMITS.history);
  };
  async function load(c: ChatChannel) {
    if (c === "friend") return;
    if (loaded.has(c)) return;
    loaded.add(c);
    const history = await hooks.history(c);
    lines[c] = merge(history, lines[c]);
    if (c === active) renderLines();
  }
  async function loadFriend(id: string) {
    const key = `friend:${id}`;
    if (!loaded.has(key)) {
      loaded.add(key);
      const history = await hooks.history("friend", id);
      friendLines.set(id, merge(history, friendLines.get(id) ?? []));
    }
    if (active === "friend" && friendTo?.id === id) renderLines();
  }
  async function loadFriends() {
    const got = await hooks.friends();
    if (got) {
      friends = got;
      for (const f of got) {
        // The open conversation is read as it comes.
        if (f.id === friendTo?.id && !drawer.hidden) continue;
        if (f.unread) friendUnseen.set(f.id, f.unread);
        else friendUnseen.delete(f.id);
      }
    } else friends ??= [];
    countFriends();
    if (active === "friend") renderLines();
    renderTabs();
    renderBadge();
  }
  /** Open one friend's conversation (null: back to the list). */
  function talkTo(f: { id: string; name: string } | null) {
    friendTo = f;
    if (f) {
      if (friendUnseen.delete(f.id)) hooks.read(f.id);
      countFriends();
      void loadFriend(f.id);
    }
    renderTabs();
    renderLines();
    renderForm();
    renderBadge();
  }

  function select(c: ChatChannel | null) {
    active = c;
    if (c === "friend") {
      // The list is read again each time (a friend added a moment ago).
      void loadFriends();
      if (friendTo && friendUnseen.delete(friendTo.id)) hooks.read(friendTo.id);
      countFriends();
    } else if (c) {
      unseen[c] = 0;
      void load(c);
    }
    renderTabs();
    renderLines();
    renderForm();
    renderBadge();
  }

  // The keyboard (iPhone): the drawer keeps to the room above it.
  const viewport = window.visualViewport;
  const fitKeyboard = () => {
    if (!viewport || drawer.hidden) return;
    const covered = Math.max(
      0,
      window.innerHeight - viewport.height - viewport.offsetTop,
    );
    drawer.style.setProperty("--chat-keyboard", `${Math.round(covered)}px`);
    drawer.classList.toggle("is-typing", covered > 80);
  };
  viewport?.addEventListener("resize", fitKeyboard);

  function setOpen(want: boolean) {
    if (want === !drawer.hidden) return;
    drawer.hidden = !want;
    button.setAttribute("aria-expanded", String(want));
    document.body.classList.toggle("chat-open", want);
    if (want) {
      if (!active || !open.includes(active)) select(open[0] ?? null);
      else select(active);
      fitKeyboard();
    } else {
      input.blur();
      drawer.style.removeProperty("--chat-keyboard");
      drawer.classList.remove("is-typing");
    }
    renderBadge();
  }

  button.addEventListener("click", () => setOpen(drawer.hidden));
  // The chat's own settings: on, quick chat only, off.
  const renderPrefs = () => {
    for (const b of Array.from(
      prefs.querySelectorAll<HTMLButtonElement>("[data-chat-mode]"),
    ))
      b.setAttribute("aria-checked", String(b.dataset.chatMode === mode));
    prefs.querySelector(".chat-mode-note")!.textContent = MODE_NOTE[mode];
  };
  // Notifications of friends' messages (signed-in players; push-setup.ts).
  const pushRow = prefs.querySelector<HTMLElement>(".chat-push")!;
  const pushToggle =
    pushRow.querySelector<HTMLButtonElement>(".chat-push-toggle")!;
  const pushNote = pushRow.querySelector<HTMLElement>(".chat-push-note")!;
  const newsToggle =
    pushRow.querySelector<HTMLButtonElement>(".chat-news-toggle")!;
  newsToggle.addEventListener("click", async () => {
    if (!hooks.push?.setNews || newsToggle.disabled) return;
    const want = newsToggle.getAttribute("aria-checked") !== "true";
    newsToggle.disabled = true;
    const reply = await hooks.push.setNews(want);
    if (!reply.ok && reply.error) say(reply.error);
    newsToggle.disabled = false;
    refreshPush();
  });
  const PUSH_NOTE: Record<PushState, string> = {
    on: "On for this device: a notification when a friend messages you while you're away (it says who, not what), and news from the admins if you keep it on below.",
    off: "Get a notification when a friend messages you while you're away (it says who, not what), and news from the admins.",
    "install-first":
      "On iPhone and iPad, add the game to your Home Screen first (Share, then Add to Home Screen), and turn this on there.",
    blocked:
      "Notifications are blocked for this game in your browser settings.",
    unsupported: "",
  };
  let pushNow: PushState | "server-off" = "unsupported";
  const renderPush = (state: PushState | "server-off") => {
    pushNow = state;
    const me = hooks.me();
    pushRow.hidden =
      !hooks.push ||
      !me ||
      me.guest ||
      state === "unsupported" ||
      state === "server-off";
    pushToggle.setAttribute("aria-checked", String(state === "on"));
    pushToggle.disabled = state === "install-first" || state === "blocked";
    pushNote.textContent = state === "server-off" ? "" : PUSH_NOTE[state];
    // Game news: only once notifications are on for this device.
    newsToggle.hidden = state !== "on" || !hooks.push?.setNews;
    newsToggle.setAttribute(
      "aria-checked",
      String(hooks.push?.news?.() ?? true),
    );
  };
  const refreshPush = () =>
    void hooks.push
      ?.state()
      .then(renderPush)
      .catch(() => renderPush("unsupported"));
  pushToggle.addEventListener("click", async () => {
    if (!hooks.push || pushToggle.disabled) return;
    const want = pushNow !== "on";
    pushToggle.disabled = true;
    // (The browser asks inside this tap: nothing is awaited before it.)
    const reply = await hooks.push.toggle(want);
    if (!reply.ok && reply.error) say(reply.error);
    pushToggle.disabled = false;
    refreshPush();
  });
  gear.addEventListener("click", () => {
    prefs.hidden = !prefs.hidden;
    gear.setAttribute("aria-expanded", String(!prefs.hidden));
    renderPrefs();
    if (!prefs.hidden) refreshPush();
  });
  prefs.addEventListener("click", (e) => {
    const pick = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-chat-mode]",
    )?.dataset.chatMode as ChatMode | undefined;
    if (!pick || pick === mode) return;
    hooks.setMode(pick);
  });
  drawer
    .querySelector(".chat-close")!
    .addEventListener("click", () => setOpen(false));
  list.addEventListener("click", (e) => {
    const say = (e.target as HTMLElement).closest<HTMLElement>(
      ".chat-say[data-from]",
    );
    if (!say || !active) return;
    const li = say.closest<HTMLElement>(".chat-line")!;
    const l = linesOf(active).find((x) => String(x.id) === li.dataset.line);
    if (l) lineMenu(li, l);
  });
  list.addEventListener("click", (e) => {
    const pick = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-chat-friend]",
    );
    if (pick)
      talkTo({ id: pick.dataset.chatFriend!, name: pick.dataset.name ?? "" });
  });
  drawer
    .querySelector(".chat-back")!
    .addEventListener("click", () => talkTo(null));
  tabs.addEventListener("click", (e) => {
    const tab = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-chat-tab]",
    );
    if (tab) select(tab.dataset.chatTab as ChatChannel);
  });
  quick.addEventListener("click", async (e) => {
    const chip = (e.target as HTMLElement).closest<HTMLElement>(
      "[data-chat-quick]",
    );
    if (!chip || !active) return;
    const to = active === "friend" ? friendTo : null;
    if (active === "friend" && !to) return;
    const reply = await hooks.send(
      active,
      { quick: chip.dataset.chatQuick as ChatQuick },
      to?.id,
    );
    if (!reply.ok) say(reply.error ?? "Couldn't send. Try again.");
    else offlineNote(to, reply.kept);
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!active || input.disabled) return;
    const checked = filterChat(input.value);
    if (!checked.ok) return say(checked.error);
    const to = active === "friend" ? friendTo : null;
    if (active === "friend" && !to) return;
    const reply = await hooks.send(active, { text: input.value }, to?.id);
    if (!reply.ok) return say(reply.error ?? "Couldn't send. Try again.");
    input.value = "";
    offlineNote(to, reply.kept);
  });
  /** A line to an offline friend that wasn't kept: they won't see it. */
  function offlineNote(to: { id: string } | null, kept?: boolean) {
    if (!to || kept !== false) return;
    const f = friends?.find((x) => x.id === to.id);
    if (f && !f.online) say(`${f.name} is offline and won't see this one.`);
  }
  // Typing in the box doesn't steer the fighter or open other shortcuts.
  input.addEventListener("keydown", (e) => {
    e.stopPropagation();
    if (e.key === "Escape") setOpen(false);
  });
  // A press outside the drawer and its button closes it.
  document.addEventListener(
    "pointerdown",
    (e) => {
      if (drawer.hidden) return;
      const t = e.target as Node;
      if (!drawer.contains(t) && !button.contains(t)) setOpen(false);
    },
    true,
  );
  document.addEventListener("keydown", (e) => {
    if (button.hidden) return;
    if (e.key === "Escape" && !drawer.hidden) return setOpen(false);
    // Enter opens the chat (desktop) unless something else has the keys:
    // a box being typed in, or a focused control Enter presses (a button,
    // a link, the Lobby's fighter), which keeps its own Enter.
    const busy = (e.target as HTMLElement | null)?.closest?.(
      "input, textarea, select, [contenteditable], dialog, button, a[href], summary, [role=button], [role=tab], [role=menuitem]",
    );
    if (e.key === "Enter" && drawer.hidden && !busy) {
      setOpen(true);
      if (!input.disabled) input.focus();
      e.preventDefault();
    }
  });

  return {
    sync(next, channels) {
      place = next;
      const was = open.join();
      open = CHANNELS.filter((c) => channels[c]);
      // A channel that closed forgets its lines (a party ended, a room left;
      // Friends: you signed out).
      for (const c of CHANNELS)
        if (!channels[c]) {
          lines[c] = [];
          unseen[c] = 0;
          loaded.delete(c);
        }
      if (!channels.friend) {
        friendLines.clear();
        friendUnseen.clear();
        for (const k of [...loaded])
          if (k.startsWith("friend:")) loaded.delete(k);
        friends = null;
        friendTo = null;
      }
      // A channel that just opened (you joined a room) comes first; Friends
      // never pushes ahead of the others.
      const fresh = open.find(
        (c) => c !== "friend" && !was.split(",").includes(c),
      );
      if (fresh && was) active = fresh;
      button.hidden = place === "none" || !hooks.me();
      button.dataset.place = place;
      if (button.hidden) setOpen(false);
      if (open.join() !== was && !drawer.hidden)
        select(active && open.includes(active) ? active : (open[0] ?? null));
      renderBadge();
    },
    receive(line) {
      if (!open.includes(line.channel)) return;
      if (muted.has(line.from.id) || mode === "off") return;
      const mine = line.from.id === hooks.me()?.id;
      const friend = line.channel === "friend" ? otherOf(line) : "";
      if (line.channel === "friend" && !friend) return;
      let list0 =
        line.channel === "friend"
          ? friendLines.get(friend)
          : lines[line.channel];
      if (!list0) friendLines.set(friend, (list0 = []));
      if (list0.some((l) => l.id === line.id)) return;
      list0.push(line);
      if (list0.length > CHAT_LIMITS.history) list0.shift();
      if (line.channel === "friend") {
        const here =
          !drawer.hidden && active === "friend" && friendTo?.id === friend;
        if (here) {
          if (!mine) hooks.read(friend);
        } else {
          if (!mine)
            friendUnseen.set(friend, (friendUnseen.get(friend) ?? 0) + 1);
          countFriends();
          if (!drawer.hidden && active === "friend" && !friendTo) renderLines();
          renderTabs();
          renderBadge();
          return;
        }
      }
      if (!drawer.hidden && line.channel === active) {
        const atEnd =
          list.scrollHeight - list.scrollTop - list.clientHeight < 40;
        const rows = list.querySelectorAll<HTMLElement>(".chat-line");
        const prev = rows[rows.length - 1];
        const before = prev ? Number(prev.dataset.at) : null;
        if (needsStamp(line.at, Number.isFinite(before) ? before : null))
          list.append(stampElement(line.at));
        list.append(lineElement(line));
        // Past the history's length, the oldest line goes (with its stamp).
        if (list.querySelectorAll(".chat-line").length > CHAT_LIMITS.history) {
          list.querySelector(".chat-line")?.remove();
          // A stamp left with no line of its own (the next has its own).
          const first = list.firstElementChild;
          if (
            first?.classList.contains("chat-stamp") &&
            first.nextElementSibling?.classList.contains("chat-stamp")
          )
            first.remove();
        }
        empty.hidden = true;
        if (atEnd || mine) list.scrollTop = list.scrollHeight;
      } else if (!mine) unseen[line.channel]++;
      renderTabs();
      renderBadge();
    },
    setUnread(byFriend) {
      friendUnseen.clear();
      for (const [id, n] of Object.entries(byFriend))
        if (n > 0 && id !== friendTo?.id) friendUnseen.set(id, n);
      countFriends();
      renderTabs();
      renderBadge();
    },
    openFriend(id, name) {
      if (!open.includes("friend")) return;
      setOpen(true);
      select("friend");
      talkTo({ id, name });
    },
    setFreeText(on) {
      freeText = on;
      renderForm();
    },
    setMode(next) {
      mode = next;
      renderLines();
      renderForm();
      renderPrefs();
    },
    placeButton(x, y) {
      button.style.setProperty("--chat-x", `${Math.round(x)}px`);
      button.style.setProperty("--chat-y", `${Math.round(y)}px`);
    },
    isOpen: () => !drawer.hidden,
    close: () => setOpen(false),
  };
}

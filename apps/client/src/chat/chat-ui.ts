/**
 * In-game chat on screen (docs/chat-plan.md): the chat button and the
 * drawer it opens.
 *
 * - The button sits in the hub's top bar 12 px right of the player card
 *   (placed by scene-switch-place.ts, which already measures that bar), and
 *   top left in a room. Its dot counts lines that came while it was shut.
 * - The drawer slides in from the left over the screen's left side, so the
 *   PLAY and Ready buttons on the right stay free. Tabs: the party and the
 *   room, whichever you are in. A row of quick-chat chips sits over the
 *   typing box, so a line can go without the keyboard.
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
  type ChatQuick,
} from "../../../../packages/shared/src/chat";
import { filterChat } from "../../../../packages/shared/src/chat-filter";
import { menuIcon } from "../menu-icons";

export type ChatPlace = "hub" | "room" | "none";
interface Reply {
  ok: boolean;
  error?: string;
}
export interface ChatHooks {
  send(
    channel: ChatChannel,
    body: { text: string } | { quick: ChatQuick },
  ): Promise<Reply>;
  history(channel: ChatChannel): Promise<ChatLine[]>;
  /** The signed-in player, or null. */
  me(): { id: string; guest: boolean } | null;
}
export interface ChatView {
  /** Where the button shows, and which channels are open now. */
  sync(place: ChatPlace, channels: Partial<Record<ChatChannel, boolean>>): void;
  /** A line from the server. */
  receive(line: ChatLine): void;
  /** Typed lines on or off on the server (quick chat is always on). */
  setFreeText(on: boolean): void;
  /** Put the hub button at this spot (px from the top left). */
  placeButton(x: number, y: number): void;
  isOpen(): boolean;
  close(): void;
}

const LABEL: Record<ChatChannel, string> = {
  party: "Party",
  room: "Room",
  place: "Nearby",
};
/** The quick chips under the lines: emotes, then phrases. */
const CHIPS: ChatQuick[] = [
  ...(Object.keys(CHAT_EMOTES) as ChatQuick[]),
  ...(Object.keys(CHAT_PHRASES) as ChatQuick[]),
];

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
  drawer.innerHTML = `<header class="chat-head"><div class="chat-tabs" role="tablist" aria-label="Chat channels"></div><button type="button" class="chat-close" aria-label="Close chat">${menuIcon("cancel")}</button></header><ol class="chat-lines" aria-live="polite"></ol><p class="chat-empty" hidden></p><div class="chat-quick" role="group" aria-label="Quick chat">${CHIPS.map((q) => `<button type="button" class="chat-chip" data-chat-quick="${q}">${quickText(q)}</button>`).join("")}</div><form class="chat-form"><input id="chat-input" class="chat-input" type="text" enterkeyhint="send" autocomplete="off" autocapitalize="sentences" maxlength="${CHAT_LIMITS.length}" aria-label="Message"><button type="submit" class="chat-send" aria-label="Send">Send</button></form><p class="chat-note" role="status"></p>`;
  document.body.append(button, drawer);
  const tabs = drawer.querySelector<HTMLElement>(".chat-tabs")!;
  const list = drawer.querySelector<HTMLOListElement>(".chat-lines")!;
  const empty = drawer.querySelector<HTMLElement>(".chat-empty")!;
  const quick = drawer.querySelector<HTMLElement>(".chat-quick")!;
  const form = drawer.querySelector<HTMLFormElement>(".chat-form")!;
  const input = drawer.querySelector<HTMLInputElement>(".chat-input")!;
  const note = drawer.querySelector<HTMLElement>(".chat-note")!;

  const lines: Record<ChatChannel, ChatLine[]> = {
    party: [],
    room: [],
    place: [],
  };
  const unseen: Record<ChatChannel, number> = { party: 0, room: 0, place: 0 };
  const loaded = new Set<ChatChannel>();
  let open: ChatChannel[] = [];
  let active: ChatChannel | null = null;
  let place: ChatPlace = "none";
  let freeText = false;
  let noteTimer = 0;

  const say = (text: string) => {
    note.textContent = text;
    clearTimeout(noteTimer);
    noteTimer = window.setTimeout(() => (note.textContent = ""), 4000);
  };

  function lineElement(l: ChatLine) {
    const li = document.createElement("li");
    li.className = "chat-line";
    if (l.from.id === hooks.me()?.id) li.classList.add("is-mine");
    if (l.quick) li.classList.add("is-quick");
    const who = document.createElement("b");
    who.textContent = l.from.name;
    const what = document.createElement("span");
    what.textContent = l.quick ? quickText(l.quick) : (l.text ?? "");
    li.append(who, what);
    return li;
  }

  function renderTabs() {
    tabs.innerHTML = open
      .map(
        (c) =>
          `<button type="button" role="tab" class="chat-tab" data-chat-tab="${c}" aria-selected="${c === active}">${LABEL[c]}${unseen[c] && c !== active ? `<i>${Math.min(unseen[c], 9)}${unseen[c] > 9 ? "+" : ""}</i>` : ""}</button>`,
      )
      .join("");
  }

  function renderLines() {
    list.replaceChildren(...(active ? lines[active] : []).map(lineElement));
    list.scrollTop = list.scrollHeight;
    empty.hidden = !!active && lines[active].length > 0;
    empty.textContent = !active
      ? "Invite a friend to a party, or join a room, to chat."
      : "No messages yet. Say hi!";
  }

  function renderForm() {
    const me = hooks.me();
    const refusal = !active
      ? "Nobody to chat with yet."
      : !freeText
        ? "Quick chat only for now."
        : typingRefusal({
            channel: active,
            inBattle: false,
            guest: !!me?.guest,
            mode: "free",
          });
    input.disabled = !!refusal;
    input.placeholder = refusal ?? "Message";
    form.querySelector<HTMLButtonElement>(".chat-send")!.disabled = !!refusal;
    for (const b of Array.from(
      quick.querySelectorAll<HTMLButtonElement>("button"),
    ))
      b.disabled = !active;
  }

  function renderBadge() {
    const total = open.reduce(
      (n, c) => n + (drawer.hidden || c !== active ? unseen[c] : 0),
      0,
    );
    unread.hidden = total === 0;
    unread.textContent = total > 9 ? "9+" : String(total);
    button.setAttribute("aria-label", total ? `Chat, ${total} new` : "Chat");
  }

  async function load(c: ChatChannel) {
    if (loaded.has(c)) return;
    loaded.add(c);
    const history = await hooks.history(c);
    const seen = new Set(lines[c].map((l) => l.id));
    lines[c] = [...history.filter((l) => !seen.has(l.id)), ...lines[c]]
      .sort((a, b) => a.id - b.id)
      .slice(-CHAT_LIMITS.history);
    if (c === active) renderLines();
  }

  function select(c: ChatChannel | null) {
    active = c;
    if (c) {
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
  drawer
    .querySelector(".chat-close")!
    .addEventListener("click", () => setOpen(false));
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
    const reply = await hooks.send(active, {
      quick: chip.dataset.chatQuick as ChatQuick,
    });
    if (!reply.ok) say(reply.error ?? "Couldn't send. Try again.");
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!active || input.disabled) return;
    const checked = filterChat(input.value);
    if (!checked.ok) return say(checked.error);
    const reply = await hooks.send(active, { text: input.value });
    if (!reply.ok) return say(reply.error ?? "Couldn't send. Try again.");
    input.value = "";
  });
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
    // Enter opens the chat (desktop) unless something else has the keys.
    const busy = (e.target as HTMLElement | null)?.closest?.(
      "input, textarea, select, [contenteditable], dialog",
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
      open = (["party", "room", "place"] as ChatChannel[]).filter(
        (c) => channels[c],
      );
      // A channel that closed forgets its lines (a party ended, a room left).
      for (const c of ["party", "room", "place"] as ChatChannel[])
        if (!channels[c]) {
          lines[c] = [];
          unseen[c] = 0;
          loaded.delete(c);
        }
      // A channel that just opened (you joined a room) comes first.
      const fresh = open.find((c) => !was.split(",").includes(c));
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
      const list0 = lines[line.channel];
      if (list0.some((l) => l.id === line.id)) return;
      list0.push(line);
      if (list0.length > CHAT_LIMITS.history) list0.shift();
      const mine = line.from.id === hooks.me()?.id;
      if (!drawer.hidden && line.channel === active) {
        const atEnd =
          list.scrollHeight - list.scrollTop - list.clientHeight < 40;
        list.append(lineElement(line));
        if (list.children.length > CHAT_LIMITS.history)
          list.firstElementChild?.remove();
        empty.hidden = true;
        if (atEnd || mine) list.scrollTop = list.scrollHeight;
      } else if (!mine) unseen[line.channel]++;
      renderTabs();
      renderBadge();
    },
    setFreeText(on) {
      freeText = on;
      renderForm();
    },
    placeButton(x, y) {
      button.style.setProperty("--chat-x", `${Math.round(x)}px`);
      button.style.setProperty("--chat-y", `${Math.round(y)}px`);
    },
    isOpen: () => !drawer.hidden,
    close: () => setOpen(false),
  };
}

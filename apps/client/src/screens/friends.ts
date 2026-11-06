import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import {
  friendsMarkup,
  friendsView,
  type FriendsData,
  type FriendsTab,
  type FriendsView,
} from "./friends-view";
import "./friends.css";

/**
 * The Friends sheet's behaviour (UI remodel step 6). Markup comes from
 * friends-view.ts. It opens beside the Lobby (or, in a private room, where
 * the room's picker stands). Every change asks the server and shows its
 * answer; the list refreshes itself every 15 s while the sheet is open and
 * when the server says it changed.
 */
type Reply = { ok: boolean; error?: string };
export interface FriendsHooks {
  data(): FriendsData;
  /** Reload the friends list; resolves once data() has it. */
  reload(): Promise<void>;
  loadRecent(): Promise<void>;
  respond(id: string, accept: boolean): Promise<void>;
  remove(id: string): Promise<void>;
  /** Send a request (by code or id); resolves with what happened. */
  request(body: { code?: string; playerId?: string }): Promise<string>;
  inviteToParty(id: string): Promise<Reply>;
  inviteToRoom(id: string): Promise<Reply>;
  join(code: string): void;
  watch(code: string): void;
  /** Keep pins on this device; false when the browser couldn't. */
  savePins(pins: ReadonlySet<string>): boolean;
  pins: ReadonlySet<string>;
  /** Where to open (a private room); the Lobby by default. */
  host?: HTMLElement;
  onClose?(): void;
}
export interface FriendsScreen {
  refresh(): void;
  reload(): Promise<void>;
  close(): void;
  readonly isOpen: boolean;
  readonly view: FriendsView;
}

const TICK_MS = 15_000;
/** How long Invite shows "Invited" before it can be sent again. */
const INVITED_MS = 30_000;

export function openFriends(hooks: FriendsHooks): FriendsScreen {
  const view = friendsView(hooks.pins);
  const busy = view.busy as Set<string>;
  const invited = new Map<string, number>();
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  const root = () => panel.root;
  const q = <T extends HTMLElement>(s: string) => root().querySelector<T>(s);

  function render() {
    if (closed) return;
    const now = Date.now();
    for (const [id, until] of invited) if (until <= now) invited.delete(id);
    view.invited = new Set(invited.keys());
    // The list box keeps its scroll even when its rows are rebuilt.
    const box = q<HTMLElement>("[data-friends-list]");
    const top = box?.scrollTop ?? 0;
    const next = parse(friendsMarkup(view, hooks.data()));
    patch(root(), template, next);
    template = next;
    if (box && box.isConnected) box.scrollTop = top;
  }
  const focusOn = (selector: string) => {
    const el = q<HTMLElement>(selector);
    el?.focus({ preventScroll: true });
    return !!el;
  };
  const say = (text: string) => {
    view.status = text;
    render();
  };
  async function reload() {
    await hooks.reload();
    render();
  }
  /** Run a request for a row; its buttons wait meanwhile. */
  async function act(id: string, run: () => Promise<string>) {
    if (busy.has(id)) return;
    busy.add(id);
    view.status = "";
    render();
    try {
      view.status = await run();
    } catch (error) {
      view.status =
        error instanceof Error ? error.message : "That didn't work. Try again.";
    }
    busy.delete(id);
    render();
  }
  function setTab(tab: FriendsTab) {
    if (view.tab === tab) return;
    view.tab = tab;
    view.menu = view.removing = null;
    render();
    q<HTMLElement>("[data-friends-list]")?.scrollTo({ top: 0 });
    if (tab === "recent" && hooks.data().recent === null)
      void hooks.loadRecent().then(render);
  }
  function toggleAdd(open = !view.adding) {
    view.adding = open;
    render();
    if (open) focusOn("#fr-add-code");
    else focusOn("[data-friend-add-open].fr-add-toggle");
  }
  async function copyCode(share: boolean) {
    const code = hooks.data().list?.code.toUpperCase();
    if (!code) return;
    if (share && navigator.share) {
      try {
        await navigator.share({
          title: "Add me in Element Arena",
          text: `Add me in Element Arena with friend code ${code}`,
        });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      }
    }
    try {
      await navigator.clipboard.writeText(code);
      say(
        share ? "Code copied: paste it to your friend." : "Friend code copied.",
      );
    } catch {
      say(`Your friend code is ${code}.`);
    }
  }
  async function invite(id: string, room: boolean) {
    await act(id, async () => {
      const reply = await (room
        ? hooks.inviteToRoom(id)
        : hooks.inviteToParty(id));
      if (!reply.ok)
        throw new Error(reply.error ?? "Couldn't send the invite. Try again.");
      invited.set(id, Date.now() + INVITED_MS);
      setTimeout(render, INVITED_MS + 50);
      return room ? "Room invite sent." : "Party invite sent.";
    });
  }

  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root().contains(t) || t.disabled) return;
    const d = t.dataset;
    if (d.uiFriendsTab) setTab(d.uiFriendsTab as FriendsTab);
    else if (d.friendAddOpen !== undefined)
      toggleAdd(t.classList.contains("fr-add-toggle") ? !view.adding : true);
    else if (d.friendMenu) {
      view.menu = view.menu === d.friendMenu ? null : d.friendMenu;
      view.removing = null;
      render();
    } else if (d.friendPin) {
      // Read ids before rendering: a render renames the clicked button's
      // data attributes (dataset is live).
      const id = d.friendPin;
      const pins = new Set(view.pins);
      if (pins.has(id)) pins.delete(id);
      else pins.add(id);
      view.pins = pins;
      view.status = hooks.savePins(pins)
        ? ""
        : "Pinned for this visit: your browser couldn't save it.";
      render();
      focusOn(`[data-friend-pin="${CSS.escape(id)}"]`);
    } else if (d.friendRemove) {
      const id = d.friendRemove;
      view.removing = id;
      render();
      focusOn(`[data-friend-keep="${CSS.escape(id)}"]`);
    } else if (d.friendKeep) {
      const id = d.friendKeep;
      view.removing = null;
      render();
      focusOn(`[data-friend-remove="${CSS.escape(id)}"]`);
    } else if (d.friendRemoveOk) {
      const id = d.friendRemoveOk;
      void act(id, async () => {
        await hooks.remove(id);
        const pins = new Set(view.pins);
        if (pins.delete(id)) {
          view.pins = pins;
          hooks.savePins(pins);
        }
        view.menu = view.removing = null;
        return "Friend removed.";
      });
    } else if (d.friendAccept) {
      const id = d.friendAccept;
      void act(id, async () => {
        await hooks.respond(id, true);
        return "You're now friends.";
      });
    } else if (d.friendDecline) {
      const id = d.friendDecline;
      void act(id, async () => {
        await hooks.respond(id, false);
        return "Request declined.";
      });
    } else if (d.friendCancel) {
      const id = d.friendCancel;
      void act(id, async () => {
        await hooks.remove(id);
        return "Request cancelled.";
      });
    } else if (d.friendAddId) {
      const id = d.friendAddId;
      void act(id, () => hooks.request({ playerId: id }));
    } else if (d.friendInvite) void invite(d.friendInvite, false);
    else if (d.friendRoomInvite) void invite(d.friendRoomInvite, true);
    else if (d.friendJoin) {
      const code = d.friendJoin;
      panel.close();
      hooks.join(code);
    } else if (d.friendWatch) {
      const code = d.friendWatch;
      panel.close();
      hooks.watch(code);
    } else if (d.friendCopy !== undefined) void copyCode(false);
    else if (d.friendShare !== undefined) void copyCode(true);
    else if (d.friendRetry !== undefined) void reload();
    else if (d.friendRecentRetry !== undefined)
      void hooks.loadRecent().then(render);
  };
  const onSubmit = (event: SubmitEvent) => {
    const form = (event.target as Element).closest<HTMLFormElement>(
      "[data-friend-add-form]",
    );
    if (!form) return;
    event.preventDefault();
    const input = form.querySelector<HTMLInputElement>("input")!;
    const code = input.value.replace(/\s+/g, "").toUpperCase();
    if (!/^[0-9A-F]{8}$/.test(code)) {
      say("A friend code is 8 letters (A–F) and digits.");
      input.focus();
      return;
    }
    void act(`code:${code}`, async () => {
      const text = await hooks.request({ code });
      input.value = "";
      return text;
    });
  };
  // Keyboard: arrows along the tabs (they follow focus) and up / down the
  // rows; Escape closes a row's options or the add row before the sheet.
  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    if (event.key === "Escape") {
      if (view.menu || view.adding) {
        event.preventDefault();
        event.stopPropagation();
        const menu = view.menu;
        view.menu = view.removing = null;
        if (view.adding && !menu) toggleAdd(false);
        else {
          render();
          if (menu) focusOn(`[data-friend-menu="${CSS.escape(menu)}"]`);
        }
      }
      return;
    }
    if (t.matches('[role="tab"]') && /^Arrow(Left|Right)$/.test(event.key)) {
      const items = Array.from(
        t.parentElement!.querySelectorAll<HTMLElement>('[role="tab"]'),
      );
      const next =
        items[items.indexOf(t) + (event.key === "ArrowRight" ? 1 : -1)];
      if (!next) return;
      event.preventDefault();
      next.focus();
      next.click();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    const row = t.closest<HTMLElement>(".fr-row");
    if (!row || !t.matches("button")) return;
    const rows = Array.from(root().querySelectorAll<HTMLElement>(".fr-row"));
    const next = rows[rows.indexOf(row) + (event.key === "ArrowDown" ? 1 : -1)];
    if (!next) return;
    event.preventDefault();
    const target = next.querySelector<HTMLElement>(
      ".ui-row-acts > button:not([disabled])",
    );
    target?.focus();
    target?.scrollIntoView({ block: "nearest" });
  };

  const html = friendsMarkup(view, hooks.data());
  template = parse(html);
  const tick = setInterval(() => {
    if (document.hidden) return;
    render();
    void reload();
  }, TICK_MS);
  panel = openHubPanel(html, {
    rail: hooks.host ? undefined : "friends",
    host: hooks.host,
    onClose: () => {
      closed = true;
      clearInterval(tick);
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("submit", onSubmit);
  root().addEventListener("keydown", onKey);
  focusOn('[role="tab"][aria-selected="true"]');
  return {
    refresh: render,
    reload,
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}

/** Pinned friends live on this device, per account (as before step 6). */
const pinKey = (accountId: string) => `arena-friend-pins:${accountId}`;
export function readPinnedFriends(accountId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(pinKey(accountId)) ?? "[]",
    );
    return new Set(
      Array.isArray(value)
        ? value
            .filter((id): id is string => typeof id === "string")
            .slice(0, 500)
        : [],
    );
  } catch {
    return new Set();
  }
}
export function savePinnedFriends(
  accountId: string,
  pins: ReadonlySet<string>,
) {
  try {
    localStorage.setItem(pinKey(accountId), JSON.stringify([...pins]));
    return true;
  } catch {
    return false;
  }
}

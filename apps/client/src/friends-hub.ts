import {
  friendsSchema,
  type FriendList,
} from "../../../packages/shared/src/accounts";
import {
  friendCounts,
  friendsMarkup,
  type FriendsFilter,
  type FriendsRoom,
  type FriendsView,
} from "./friends-view";
import { shareInvite } from "./invite";

export function readPinnedFriends(accountId: string): Set<string> {
  try {
    const value: unknown = JSON.parse(
      localStorage.getItem(`arena-friend-pins:${accountId}`) ?? "[]",
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
interface Hooks {
  accountId: string;
  room: FriendsRoom;
  api: (path: string, body?: unknown) => Promise<unknown>;
  request: (body: { code: string }) => Promise<boolean>;
  notify: (message: string) => void;
  join?: (code: string) => void;
  watch?: (code: string) => void;
  createRoom?: () => void;
  onClose: () => void;
}
/** A single open social screen: background refresh never resets its filters or form. */
export class FriendsHub {
  private root: HTMLElement;
  private body: HTMLElement;
  private view: FriendsView;
  private list?: FriendList;
  private pending = new Set<string>();
  private revision = 0;
  private disposed = false;
  private markup = "";
  private refreshFailed = false;
  private messageTimer?: ReturnType<typeof setTimeout>;
  private timer: ReturnType<typeof setInterval>;
  private observer: MutationObserver;
  private compact = matchMedia("(max-width: 1000px), (max-height: 600px)");
  private updateInert = () => {
    const open =
      this.compact.matches && this.root.classList.contains("is-adding");
    this.root.querySelector<HTMLElement>(".friends-roster")!.inert = open;
    this.root.querySelector<HTMLElement>(".friends-hub-tools")!.inert = open;
  };
  private keydown = (event: KeyboardEvent) => {
    if (event.key !== "Escape") return;
    if (this.root.classList.contains("is-adding") && this.compact.matches) {
      event.preventDefault();
      event.stopPropagation();
      this.toggleAdd(false);
    } else if (this.view.removing) {
      event.preventDefault();
      event.stopPropagation();
      this.view.removing = undefined;
      this.render();
    }
  };
  constructor(
    private dialog: HTMLDialogElement,
    private hooks: Hooks,
  ) {
    this.root = dialog.querySelector<HTMLElement>(".friends-hub")!;
    this.body = this.root.querySelector<HTMLElement>("#friends-body")!;
    this.view = {
      filter: "all",
      query: "",
      favorites: readPinnedFriends(hooks.accountId),
      busy: this.pending,
    };
    this.root.addEventListener("click", this.click);
    this.root.addEventListener("keydown", this.keydown);
    this.compact.addEventListener("change", this.updateInert);
    this.root
      .querySelector<HTMLInputElement>("#friend-search")!
      .addEventListener("input", (event) => {
        this.view.query = (event.target as HTMLInputElement).value;
        this.view.removing = undefined;
        this.body.scrollTop = 0;
        this.render();
      });
    this.root.querySelector<HTMLFormElement>("#friend-add")!.onsubmit = (
      event,
    ) => void this.add(event);
    this.dialog.addEventListener("close", this.closed);
    document.addEventListener("visibilitychange", this.visibility);
    this.timer = setInterval(() => {
      if (!document.hidden) void this.refresh();
    }, 15000);
    this.observer = new MutationObserver(() => {
      if (!this.root.isConnected) this.dispose();
    });
    this.observer.observe(dialog, { childList: true });
  }
  dispose = () => {
    if (this.disposed) return;
    this.disposed = true;
    this.revision++;
    clearInterval(this.timer);
    clearTimeout(this.messageTimer);
    this.observer.disconnect();
    document.removeEventListener("visibilitychange", this.visibility);
    this.dialog.removeEventListener("close", this.closed);
    this.root.removeEventListener("click", this.click);
    this.root.removeEventListener("keydown", this.keydown);
    this.compact.removeEventListener("change", this.updateInert);
    this.hooks.onClose();
  };
  private closed = () => {
    // A queued close event can belong to the screen that this one replaced.
    if (!this.dialog.open) this.dispose();
  };
  private visibility = () => {
    if (!document.hidden) void this.refresh();
  };
  private message(text: string) {
    this.root.querySelector<HTMLElement>("#friend-message")!.textContent = text;
    const mobile = this.root.querySelector<HTMLElement>(
      ".friends-mobile-status",
    )!;
    mobile.textContent = text;
    clearTimeout(this.messageTimer);
    if (text)
      this.messageTimer = setTimeout(() => {
        mobile.textContent = "";
      }, 6000);
  }
  private render() {
    if (!this.list || this.disposed) return;
    const list = this.list,
      counts = friendCounts(list, this.view.favorites);
    this.root.querySelector<HTMLElement>("#friends-summary")!.textContent =
      `${counts.online} online · ${counts.all} friend${counts.all === 1 ? "" : "s"}`;
    for (const button of Array.from(
      this.root.querySelectorAll<HTMLButtonElement>(
        ".friends-filters [data-friend-filter]",
      ),
    )) {
      const filter = button.dataset.friendFilter as FriendsFilter;
      button.classList.toggle("is-active", filter === this.view.filter);
      button.setAttribute("aria-pressed", String(filter === this.view.filter));
      const count = button.querySelector<HTMLElement>("[data-friend-count]")!;
      count.textContent = String(counts[filter]);
      count.classList.toggle(
        "has-requests",
        filter === "requests" && counts.incoming > 0,
      );
    }
    this.root.querySelector<HTMLElement>(".friend-code-value")!.textContent =
      list.code;
    const next = friendsMarkup(list, this.view);
    if (next === this.markup) return;
    const scroll = this.body.scrollTop,
      focused = document.activeElement as HTMLElement | null;
    const inside = focused && this.body.contains(focused);
    const row =
      focused?.closest<HTMLElement>("[data-friend-row]")?.dataset.friendRow;
    const key = inside
      ? Object.keys(focused.dataset).find((k) =>
          [
            "accept",
            "decline",
            "remove",
            "join",
            "watch",
            "friendPin",
            "friendRemoveConfirm",
            "friendRemoveCancel",
          ].includes(k),
        )
      : undefined;
    const value = key ? focused!.dataset[key] : undefined;
    const open = Array.from(
      this.body.querySelectorAll<HTMLDetailsElement>("details[open]"),
    ).map((d) => d.dataset.friendMenu ?? "requests");
    this.body.innerHTML = next;
    this.markup = next;
    for (const detail of Array.from(
      this.body.querySelectorAll<HTMLDetailsElement>("details"),
    ))
      detail.open = open.includes(detail.dataset.friendMenu ?? "requests");
    if (inside) {
      const target = key
        ? Array.from(this.body.querySelectorAll<HTMLElement>("button")).find(
            (b) => b.dataset[key] === value,
          )
        : undefined;
      const fallback = row
        ? Array.from(
            this.body.querySelectorAll<HTMLElement>("[data-friend-row]"),
          )
            .find((r) => r.dataset.friendRow === row)
            ?.querySelector<HTMLElement>("button,summary")
        : undefined;
      (target ?? fallback ?? this.body).focus({ preventScroll: true });
    }
    this.body.scrollTop = scroll;
  }
  async refresh() {
    if (this.disposed) return;
    if (!this.root.isConnected || !this.dialog.open) {
      this.dispose();
      return;
    }
    const revision = ++this.revision;
    const refresh =
      this.root.querySelector<HTMLButtonElement>("#friends-refresh")!;
    refresh.setAttribute("aria-busy", "true");
    try {
      const list = friendsSchema.parse(await this.hooks.api("/api/friends"));
      if (this.disposed || revision !== this.revision) return;
      this.list = list;
      if (this.refreshFailed) this.message("");
      this.refreshFailed = false;
      this.render();
      this.root.querySelector<HTMLElement>("#friends-connection")!.textContent =
        "Live";
    } catch (error) {
      if (this.disposed || revision !== this.revision) return;
      this.refreshFailed = true;
      this.root.querySelector<HTMLElement>("#friends-connection")!.textContent =
        "Reconnect";
      this.message(
        error instanceof Error
          ? error.message
          : "Couldn't update your friends. Try Refresh.",
      );
      if (!this.list) {
        this.body.innerHTML =
          '<div class="friends-empty"><h3>Your crew is taking a moment</h3><p>Check your connection and try again.</p><button type="button" class="secondary" data-friend-retry>Try again</button></div>';
        this.markup = "";
      }
    } finally {
      if (!this.disposed && revision === this.revision)
        refresh.removeAttribute("aria-busy");
    }
  }
  private toggleAdd(open: boolean) {
    this.root.classList.toggle("is-adding", open);
    this.updateInert();
    for (const button of Array.from(
      this.root.querySelectorAll<HTMLElement>("[data-friend-add-toggle]"),
    ))
      button.setAttribute("aria-expanded", String(open));
    if (open)
      this.root
        .querySelector<HTMLInputElement>("#friend-add-code")!
        .focus({ preventScroll: true });
    else
      this.root
        .querySelector<HTMLElement>(
          ".friends-search-row [data-friend-add-toggle]",
        )!
        .focus({ preventScroll: true });
  }
  private async add(event: SubmitEvent) {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const button = form.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    )!;
    if (button.disabled || !form.reportValidity()) return;
    const input = form.querySelector<HTMLInputElement>('input[name="code"]')!;
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    try {
      if (await this.hooks.request({ code: input.value.trim().toUpperCase() }))
        form.reset();
    } finally {
      button.disabled = false;
      button.removeAttribute("aria-busy");
    }
  }
  private async act(id: string, path: string, payload: unknown) {
    if (this.pending.has(id)) return;
    this.pending.add(id);
    this.render();
    try {
      await this.hooks.api(path, payload);
      if (path.endsWith("/remove")) {
        const pins = new Set(this.view.favorites);
        pins.delete(id);
        this.view.favorites = pins;
        this.savePins();
        this.message("Friend list updated.");
      } else
        this.message(
          (payload as { accept: boolean }).accept
            ? "Added to your crew."
            : "Friend request declined.",
        );
      this.view.removing = undefined;
      await this.refresh();
    } catch (error) {
      this.message(
        error instanceof Error
          ? error.message
          : "That didn't work. Please try again.",
      );
    } finally {
      this.pending.delete(id);
      this.render();
    }
  }
  private savePins() {
    try {
      localStorage.setItem(
        `arena-friend-pins:${this.hooks.accountId}`,
        JSON.stringify([...this.view.favorites]),
      );
    } catch {
      this.message(
        "Pinned for this visit. Your browser couldn't save this preference.",
      );
    }
  }
  private async copyCode(share = false) {
    const code =
      this.list?.code ??
      this.root.querySelector<HTMLElement>(".friend-code-value")!.textContent!;
    if (share && navigator.share && matchMedia("(pointer: coarse)").matches) {
      try {
        await navigator.share({
          title: "Join my Element Arena crew",
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
      this.message("Friend code copied. Send it to your crew.");
    } catch {
      this.message(`Your friend code is ${code}.`);
    }
  }
  private click = (event: MouseEvent) => {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button",
    );
    if (!button || button.disabled) return;
    const d = button.dataset;
    if (d.friendFilter) {
      this.view.filter = d.friendFilter as FriendsFilter;
      this.view.removing = undefined;
      this.body.scrollTop = 0;
      this.render();
    } else if (d.friendPin) {
      const pins = new Set(this.view.favorites);
      pins.has(d.friendPin) ? pins.delete(d.friendPin) : pins.add(d.friendPin);
      this.view.favorites = pins;
      this.savePins();
      this.render();
    } else if (button.hasAttribute("data-friend-add-toggle"))
      this.toggleAdd(true);
    else if (button.hasAttribute("data-friend-add-close"))
      this.toggleAdd(false);
    else if (button.hasAttribute("data-friend-clear-search")) {
      const input =
        this.root.querySelector<HTMLInputElement>("#friend-search")!;
      input.value = "";
      this.view.query = "";
      this.render();
      input.focus();
    } else if (
      button.id === "friends-refresh" ||
      button.hasAttribute("data-friend-retry")
    )
      void this.refresh();
    else if (button.id === "friend-code" || button.id === "friend-share-code")
      void this.copyCode(button.id === "friend-share-code");
    else if (d.accept)
      void this.act(d.accept, "/api/friends/respond", {
        playerId: d.accept,
        accept: true,
      });
    else if (d.decline)
      void this.act(d.decline, "/api/friends/respond", {
        playerId: d.decline,
        accept: false,
      });
    else if (d.remove) {
      if (button.hasAttribute("data-cancel-request"))
        void this.act(d.remove, "/api/friends/remove", { playerId: d.remove });
      else {
        this.view.removing = d.remove;
        this.render();
        this.body
          .querySelector<HTMLElement>("[data-friend-remove-cancel]")
          ?.focus({ preventScroll: true });
      }
    } else if (d.friendRemoveConfirm)
      void this.act(d.friendRemoveConfirm, "/api/friends/remove", {
        playerId: d.friendRemoveConfirm,
      });
    else if (button.hasAttribute("data-friend-remove-cancel")) {
      this.view.removing = undefined;
      this.render();
    } else if (d.join && this.hooks.join) {
      this.dialog.close();
      this.hooks.join(d.join);
    } else if (d.watch && this.hooks.watch) {
      this.dialog.close();
      this.hooks.watch(d.watch);
    } else if (button.id === "friend-room-action") {
      if (this.hooks.room.code)
        void shareInvite(this.hooks.room.code).then((result) =>
          this.message(
            result === "failed"
              ? `Share room code ${this.hooks.room.code}.`
              : result === "copied"
                ? "Room invite copied. Send it to your crew."
                : "",
          ),
        );
      else if (this.hooks.room.canCreate && this.hooks.createRoom) {
        this.dialog.close();
        this.hooks.createRoom();
      }
    }
  };
}

// Announcements from the admins (migration 20261122120000): a banner at the
// top of the screen, once per announcement on this device. Games online get
// one the moment an admin sends it (the "announcement" socket event); the
// rest fetch the running ones when they sign in (accounts.ts). A banner waits
// while a battle is on, so it never covers the fight. The game's own notices
// with a link (domain-move.ts) ask in a dialog instead: on a phone in
// landscape a banner long enough to explain them covered the top bar.
import {
  announcementSchema,
  type Announcement,
} from "../../../packages/shared/src/accounts";
import "./announcements.css";

const SEEN_KEY = "ea-announcements-seen";
const ICONS: Record<Announcement["tone"], string> = {
  info: '<path d="M12 11v6"/><path d="M12 7.5h.01"/><circle cx="12" cy="12" r="10"/>',
  event:
    '<path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9Z"/>',
  warning:
    '<path d="M12 3 2 21h20Z"/><path d="M12 10v5"/><path d="M12 18h.01"/>',
};

const TONE_LABELS: Record<Announcement["tone"], string> = {
  info: "Announcement",
  event: "Event",
  warning: "Heads up",
};
/** The link a game notice offers, and the dialog's heading. */
export interface NoticeLink {
  href: string;
  label: string;
  title: string;
}

function readSeen(): number[] {
  try {
    const list = JSON.parse(localStorage.getItem(SEEN_KEY) ?? "[]");
    return Array.isArray(list) ? list.filter((n) => Number.isInteger(n)) : [];
  } catch {
    return [];
  }
}
function writeSeen(ids: number[]) {
  try {
    // The newest 50 are plenty: older ones have ended long ago.
    localStorage.setItem(SEEN_KEY, JSON.stringify(ids.slice(-50)));
  } catch {
    /* No storage: it may show again next time. */
  }
}

export class AnnouncementBanner {
  private queue: Announcement[] = [];
  private shown: Announcement | null = null;
  private el: HTMLElement | null = null;
  private waitTimer = 0;
  private closeDialog: (() => void) | null = null;
  /** Local notices with a button to follow (domain-move.ts). */
  private links = new Map<number, NoticeLink>();

  constructor(
    private busy: () => boolean = () =>
      document.body.classList.contains("battle-active"),
    private now = () => Date.now(),
  ) {}

  /** One announcement (a socket event) or a list (the sign-in fetch). */
  receive(data: unknown) {
    const items = Array.isArray(data) ? data : [data];
    const seen = new Set(readSeen());
    for (const item of items) {
      const parsed = announcementSchema.safeParse(item);
      if (!parsed.success) continue;
      const a = parsed.data;
      if (seen.has(a.id) || Date.parse(a.endsAt) <= this.now()) continue;
      if (this.shown?.id === a.id || this.queue.some((q) => q.id === a.id))
        continue;
      this.queue.push(a);
    }
    // Oldest first, so the latest ends up on top of the pile last.
    this.queue.sort(
      (x, y) => Date.parse(x.createdAt) - Date.parse(y.createdAt),
    );
    this.next();
  }
  /** A notice from the game itself, asked in a dialog with a link button. */
  notice(a: Announcement, link: NoticeLink) {
    this.links.set(a.id, link);
    this.receive(a);
  }
  /** An admin ended it early: take it away. */
  end(data: unknown) {
    const id = (data as { id?: unknown } | null)?.id;
    if (typeof id !== "number") return;
    this.queue = this.queue.filter((a) => a.id !== id);
    if (this.shown?.id === id) this.hide(false);
  }

  private next(): void {
    if (this.shown || !this.queue.length) return;
    if (this.busy()) {
      // Wait for the battle to end.
      if (!this.waitTimer)
        this.waitTimer = window.setInterval(() => {
          if (this.busy()) return;
          clearInterval(this.waitTimer);
          this.waitTimer = 0;
          this.next();
        }, 2000);
      return;
    }
    const a = this.queue.shift()!;
    if (Date.parse(a.endsAt) <= this.now()) return this.next();
    this.shown = a;
    const link = this.links.get(a.id);
    if (link) return this.ask(a, link);
    const el = document.createElement("div");
    el.className = `announcement-banner tone-${a.tone}`;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[a.tone]}</svg><div class="announcement-text"><b></b><p></p></div><button type="button" class="announcement-ok">OK</button>`;
    el.querySelector("b")!.textContent = TONE_LABELS[a.tone];
    // Text only: never markup from the message.
    el.querySelector("p")!.textContent = a.message;
    const ok = el.querySelector<HTMLButtonElement>(".announcement-ok")!;
    ok.onclick = () => this.hide(true);
    document.body.append(el);
    this.el = el;
    requestAnimationFrame(() => el.classList.add("is-shown"));
  }
  /**
   * The notice as a dialog: the whole message, the link and Later. Nothing
   * behind it is half-covered; Later (or Escape) puts it away until the
   * notice's next id.
   */
  private ask(a: Announcement, link: NoticeLink) {
    const wrap = document.createElement("div");
    wrap.innerHTML = `<div class="ui-scrim announcement-dialog" data-announcement-dialog><div class="ui-modal" role="dialog" aria-modal="true" aria-labelledby="announcement-dialog-title" aria-describedby="announcement-dialog-text"><div class="ui-modal-body"><span class="ui-kicker"></span><b class="ui-title" id="announcement-dialog-title"></b><p class="ui-note" id="announcement-dialog-text"></p></div><div class="ui-actions"><button type="button" class="ui-btn" data-announcement-later>Later</button><a class="ui-btn is-primary" data-announcement-go></a></div></div></div>`;
    const scrim = wrap.firstElementChild as HTMLElement;
    // Text only: never markup from the message.
    scrim.querySelector(".ui-kicker")!.textContent = TONE_LABELS[a.tone];
    scrim.querySelector(".ui-title")!.textContent = link.title;
    scrim.querySelector(".ui-note")!.textContent = a.message;
    const go = scrim.querySelector<HTMLAnchorElement>(
      "[data-announcement-go]",
    )!;
    go.href = link.href;
    go.textContent = link.label;
    const returnFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      this.hide(true);
    };
    this.closeDialog = () => {
      document.removeEventListener("keydown", onKey, true);
      scrim.remove();
      returnFocus?.focus?.({ preventScroll: true });
    };
    scrim
      .querySelector<HTMLButtonElement>("[data-announcement-later]")!
      .addEventListener("click", () => this.hide(true));
    document.addEventListener("keydown", onKey, true);
    // Inside an open <dialog>, so it sits above it (as the age question).
    (document.querySelector("dialog[open]") ?? document.body).append(scrim);
    go.focus({ preventScroll: true });
  }
  private hide(markSeen: boolean) {
    if (this.shown && markSeen) writeSeen([...readSeen(), this.shown.id]);
    this.closeDialog?.();
    this.closeDialog = null;
    this.el?.remove();
    this.el = null;
    this.shown = null;
    this.next();
  }
}

// Announcements from the admins (migration 20261122120000): a banner at the
// top of the screen, once per announcement on this device. Games online get
// one the moment an admin sends it (the "announcement" socket event); the
// rest fetch the running ones when they sign in (accounts.ts). A banner waits
// while a battle is on, so it never covers the fight.
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
  /** Local notices with a button to follow (domain-move.ts). */
  private links = new Map<number, { href: string; label: string }>();

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
  /** A notice from the game itself, with a link button ("Open"). */
  notice(a: Announcement, link: { href: string; label: string }) {
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
    const el = document.createElement("div");
    el.className = `announcement-banner tone-${a.tone}`;
    el.setAttribute("role", "status");
    el.setAttribute("aria-live", "polite");
    el.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[a.tone]}</svg><div class="announcement-text"><b></b><p></p></div><button type="button" class="announcement-ok">OK</button>`;
    el.querySelector("b")!.textContent =
      a.tone === "event"
        ? "Event"
        : a.tone === "warning"
          ? "Heads up"
          : "Announcement";
    // Text only: never markup from the message.
    el.querySelector("p")!.textContent = a.message;
    const ok = el.querySelector<HTMLButtonElement>(".announcement-ok")!;
    ok.onclick = () => this.hide(true);
    const link = this.links.get(a.id);
    if (link) {
      // The link leads; OK becomes "Later" beside it.
      const go = document.createElement("a");
      go.className = "announcement-go";
      go.href = link.href;
      go.textContent = link.label;
      ok.textContent = "Later";
      ok.classList.add("is-quiet");
      ok.before(go);
    }
    document.body.append(el);
    this.el = el;
    requestAnimationFrame(() => el.classList.add("is-shown"));
  }
  private hide(markSeen: boolean) {
    if (this.shown && markSeen) writeSeen([...readSeen(), this.shown.id]);
    this.el?.remove();
    this.el = null;
    this.shown = null;
    this.next();
  }
}

// The Admin panel (accounts.ts opens it for admin accounts): a console with
// five sections in the dialog's tab bar — Overview, Players, Online, Reports
// and Titles. Phones held sideways come first: one scrolling column under
// the tab bar, a sticky tool row, rows that open in place to show a
// player's tools, and the result of every action in a toast at the bottom
// of the screen (never at the end of a long list).
//
// It only uses the existing admin routes (apps/server/src/accounts.ts):
// no new server code or migration. After an action the open section is
// redrawn in place, so the list keeps its scroll position.
import type {
  AdminPlayerStatus,
  Announcement,
  ManagedPlayer,
  OnlineActivity,
  OnlineList,
  PlayerDirectory,
  ProblemReport,
  ReportList,
  Title,
} from "../../../packages/shared/src/accounts";
import { REPORT_CATEGORIES } from "../../../packages/shared/src/accounts";
import { photoIdOf } from "../../../packages/shared/src/avatars";
import { buttonIcon, type IconName } from "./menu-icons";
import { TITLE_PRESETS, sortTitles } from "./player-nameplate";
import { focusForTyping } from "./screen-pin";
import {
  ACTIVITY_LABELS,
  describeActivity,
  onlineFor,
  renderOnline,
} from "./admin-online";
import "./admin-panel.css";

export type AdminTab =
  "overview" | "players" | "online" | "reports" | "titles" | "announce";
export type OnlineFilter = "all" | OnlineActivity;
export interface AdminView {
  tab: AdminTab;
  search: string;
  offset: number;
  status: "open" | "resolved" | "all";
  reportOffset: number;
  onlineFilter: OnlineFilter;
  /** Players: newest accounts first, or most recently online first. */
  sort: "new" | "online";
  /** The player row that is open, showing its tools. */
  open: string | null;
  /** An inline step waiting for the admin: "delete:<id>", "suspend:<id>",
   *  "newtitle:<id>", "title-edit:<id>", "title-new", "title-delete:<id>". */
  pending: string | null;
}
export interface AdminHooks {
  api(path: string, body?: unknown): Promise<unknown>;
  openDialog(html: string): void;
  fighterName(id: string): string;
}

const PAGE = 50;
/** Chat mutes an admin can pick (hours; 0 lifts a mute). */
export const MUTE_CHOICES = [
  { hours: 1, label: "1 h" },
  { hours: 24, label: "24 h" },
  { hours: 168, label: "7 days" },
  { hours: 0, label: "Unmute" },
] as const;
/** How long an announcement shows (the database takes 1 to 168 hours). */
export const ANNOUNCE_HOURS = [
  { hours: 1, label: "1 hour" },
  { hours: 6, label: "6 hours" },
  { hours: 24, label: "24 hours" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "7 days" },
] as const;
const TONE_LABELS: Record<Announcement["tone"], string> = {
  info: "Announcement",
  event: "Event",
  warning: "Heads up",
};
/** "in 5h", "in 2d", "in 12m". */
export function untilText(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.ceil((Date.parse(iso) - now) / 60000));
  if (minutes < 60) return `in ${minutes}m`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}
/** A player row's "Seen 3h ago" / "Never seen" (or Joined, before the
 *  server sends last-online). */
export function seenText(
  lastOnline: string | null | undefined,
  createdAt: string,
  now = Date.now(),
) {
  if (lastOnline === undefined)
    return `Joined ${new Date(createdAt).toLocaleDateString()}`;
  if (lastOnline === null) return "Never seen";
  const when = ago(lastOnline, now);
  return `Seen ${when === "now" ? "just now" : when}`;
}
/** One-tap amounts in the Coins form. */
export const COIN_PRESETS = [100, 500, 1000, 5000] as const;
/** Coin ledger reasons, as an admin reads them. */
const COIN_REASONS: Record<string, string> = {
  admin: "Admin",
  pvp: "Match",
  raid: "Raid",
  spire: "Spire",
  level: "Level up",
  "daily-first": "First win of the day",
  streak: "Mission streak",
  mission: "Mission",
  "missions-bonus": "Missions bonus",
  season: "Season",
  "season-repeat": "Season",
  expedition: "Expedition",
  "plaza-quest": "Plaza quest",
  "plaza-wish": "Wishing fountain",
  "plaza-fish-first": "Fishing",
  "leaf-trade": "Leaf trade",
  "leaf-retire": "Leaves retired",
  buy: "Shop",
};
/** A fresh id for one coin change (the database pays each id once). */
export function newRef() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return crypto.randomUUID();
  const hex = (n: number) =>
    Array.from({ length: n }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
  return `${hex(8)}-${hex(4)}-4${hex(3)}-${"89ab"[Math.floor(Math.random() * 4)]}${hex(3)}-${hex(12)}`;
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const escape = (text: string) =>
  text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
const icon = (name: IconName) => buttonIcon(name);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** "now", "5m ago", "3h ago", "2d ago", then the date. */
export function ago(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.floor((now - Date.parse(iso)) / 60000));
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** A picture report's photo id (a UUID, or nothing). */
export function photoTarget(context: Record<string, string> | undefined) {
  const id = context?.avatarPhoto;
  return typeof id === "string" && photoIdOf(`photo:${id}`) ? id : "";
}
/** The reported player of a chat report ("Name (uuid)" in its context). */
export function chatTarget(context: Record<string, string> | undefined) {
  if (context?.source !== "chat") return null;
  return (
    /\(([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\)$/i.exec(
      context.reported ?? "",
    )?.[1] ?? null
  );
}
/** Who a report is about: a player report (`player`), a picture report
 *  (`playerId`) or a chat report. */
export function reportedPlayer(context: Record<string, string> | undefined) {
  for (const id of [context?.player, context?.playerId])
    if (typeof id === "string" && UUID.test(id)) return id;
  return chatTarget(context);
}
/** The context keys shown on a report's first line; the rest fold away. */
const MAIN_CONTEXT = ["playerName", "reported", "room", "screen", "source"];

const SECTIONS: Record<AdminTab, { label: string; icon: IconName }> = {
  overview: { label: "Overview", icon: "home" },
  players: { label: "Players", icon: "user" },
  online: { label: "Online", icon: "friends" },
  reports: { label: "Reports", icon: "report" },
  titles: { label: "Titles", icon: "star" },
  announce: { label: "Announce", icon: "send" },
};

export class AdminPanel {
  view: AdminView = {
    tab: "overview",
    search: "",
    offset: 0,
    status: "open",
    reportOffset: 0,
    onlineFilter: "all",
    sort: "new",
    open: null,
    pending: null,
  };
  private online: OnlineList = { players: [], guests: 0, at: "" };
  private onlineError = "";
  private reports: ReportList = { reports: [], total: 0, open: 0 };
  private reportsError = "";
  private openReports: number | null = null;
  private directory: PlayerDirectory = { players: [], total: 0 };
  private totalPlayers: number | null = null;
  private titles: Title[] = [];
  private announcements: Announcement[] = [];
  private announceError = "";
  /** The announcement being written (kept across redraws). */
  private draft = {
    message: "",
    tone: "info" as Announcement["tone"],
    hours: 24,
  };
  /** Each opened player's coins and chat stop (or why it couldn't load). */
  private status = new Map<string, AdminPlayerStatus | { error: string }>();
  private timer?: ReturnType<typeof setTimeout>;
  private toastTimer?: ReturnType<typeof setTimeout>;
  /** Bumped by every load, so a slow answer never draws over a newer one. */
  private generation = 0;

  constructor(private hooks: AdminHooks) {}

  /**
   * Open (or redraw) the panel. `changes` move the view; `quiet` redraws in
   * place without the loading state (the Online tab's auto-refresh).
   */
  async show(changes: Partial<AdminView> = {}, quiet = false) {
    clearTimeout(this.timer);
    const before = this.view.tab;
    Object.assign(this.view, changes);
    const tabChanged = before !== this.view.tab;
    const mounted = this.mounted();
    if (!mounted) this.hooks.openDialog(this.shell(this.loading()));
    else if (!quiet) this.markLoading(tabChanged);
    const generation = ++this.generation;
    try {
      await this.load();
    } catch (error) {
      if (generation !== this.generation) return;
      this.draw(
        `<div class="adm-empty adm-error">${icon("info")}<p>${escape(
          error instanceof Error
            ? error.message
            : "Unable to load this section.",
        )}</p><button type="button" class="secondary" data-act="refresh">${icon("again")}Try again</button></div>`,
        tabChanged,
      );
      return;
    }
    if (generation !== this.generation) return;
    this.draw(this.body(), tabChanged);
    this.afterDraw();
  }

  /** Stop the Online tab's refresh (the panel closed or another screen opened). */
  stop() {
    clearTimeout(this.timer);
    clearTimeout(this.toastTimer);
  }

  // ---------------------------------------------------------------- data

  private async load() {
    const { api } = this.hooks;
    const v = this.view;
    // The online list comes from the game server's memory: always cheap,
    // never blocks the rest.
    const online = (api("/api/admin/online") as Promise<OnlineList>).then(
      (list) => {
        this.online = list;
        this.onlineError = "";
      },
      (error: unknown) => {
        this.onlineError =
          error instanceof Error ? error.message : "Online list unavailable.";
        this.online = { players: [], guests: 0, at: new Date().toISOString() };
      },
    );
    // Reports are optional: if they can't load, the other tools still work.
    const reportQuery =
      v.tab === "reports"
        ? `status=${v.status}&offset=${v.reportOffset}`
        : "status=open&offset=0";
    const reports = (
      api(`/api/admin/reports?${reportQuery}`) as Promise<ReportList>
    ).then(
      (list) => {
        this.reports = list;
        this.openReports = list.open;
        this.reportsError = "";
      },
      (error: unknown) => {
        this.reportsError =
          error instanceof Error ? error.message : "Reports are unavailable.";
        this.reports = { reports: [], total: 0, open: 0 };
      },
    );
    const work: Promise<unknown>[] = [online, reports];
    if (v.tab === "players" || v.tab === "overview")
      work.push(
        (
          api(
            `/api/admin/players?search=${encodeURIComponent(v.tab === "players" ? v.search : "")}&offset=${v.tab === "players" ? v.offset : 0}&sort=${v.tab === "players" ? v.sort : "new"}`,
          ) as Promise<PlayerDirectory>
        ).then((directory) => {
          this.directory = directory;
          if (v.tab === "overview" || !v.search)
            this.totalPlayers = directory.total;
        }),
      );
    if (v.tab === "announce")
      work.push(
        (api("/api/admin/announcements") as Promise<Announcement[]>).then(
          (list) => {
            this.announcements = list;
            this.announceError = "";
          },
          (error: unknown) => {
            this.announcements = [];
            this.announceError =
              error instanceof Error
                ? error.message
                : "Announcements are unavailable.";
          },
        ),
      );
    if (v.tab === "players" || v.tab === "titles")
      work.push(
        (api("/api/admin/titles") as Promise<Title[]>).then(
          (titles) => (this.titles = titles),
        ),
      );
    await Promise.all(work);
  }

  // --------------------------------------------------------------- frame

  private mounted() {
    const dialog = document.getElementById(
      "dialog",
    ) as HTMLDialogElement | null;
    return !!dialog?.open && !!document.getElementById("adm-root");
  }
  private tabs() {
    const counts: Partial<Record<AdminTab, string>> = {
      online: this.onlineError ? "" : String(this.online.players.length || ""),
      reports: this.openReports ? String(this.openReports) : "",
    };
    return `<div class="admin-tabs adm-tabs" role="tablist" aria-label="Admin sections">${(
      Object.keys(SECTIONS) as AdminTab[]
    )
      .map((id) => {
        const on = this.view.tab === id;
        const count = counts[id];
        return `<button type="button" role="tab" class="admin-tab ${on ? "active" : ""}" data-tab="${id}" aria-selected="${on}">${icon(SECTIONS[id].icon)}<span class="adm-tab-label">${SECTIONS[id].label}</span>${count ? `<b class="admin-count${id === "online" ? " live" : ""}" data-count="${id}">${count}</b>` : ""}</button>`;
      })
      .join("")}</div>`;
  }
  private shell(inner: string) {
    return `${this.tabs()}<div class="adm" id="adm-root" data-tab="${this.view.tab}">${inner}</div><p id="admin-message" class="adm-toast" role="status" aria-live="polite"></p>`;
  }
  private loading() {
    return `${this.head()}<div class="adm-loading" aria-busy="true"><span></span><span></span><span></span></div>`;
  }
  private markLoading(clear: boolean) {
    const root = document.getElementById("adm-root")!;
    root.dataset.tab = this.view.tab;
    this.syncTabs();
    if (clear) root.innerHTML = this.loading();
    else root.setAttribute("aria-busy", "true");
  }
  /** Section title, what it shows, and its own buttons. */
  private head() {
    const v = this.view;
    const title = SECTIONS[v.tab].label;
    let sub = "";
    let tools = "";
    if (v.tab === "overview")
      sub = this.online.at
        ? `Updated ${new Date(this.online.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
        : "Game at a glance";
    if (v.tab === "players")
      sub = v.search
        ? `${plural(this.directory.total, "match")} for “${escape(v.search)}”`
        : this.totalPlayers === null
          ? "Every account"
          : plural(this.totalPlayers, "account");
    if (v.tab === "online")
      sub = `<span class="adm-live" aria-hidden="true"></span>Live · ${this.online.players.length} signed in · ${this.online.guests} not signed in`;
    if (v.tab === "reports")
      sub =
        this.openReports === null
          ? "Player reports"
          : `${this.openReports} open`;
    if (v.tab === "announce") {
      const running = this.announcements.filter(
        (a) => Date.parse(a.endsAt) > Date.now(),
      ).length;
      sub = running
        ? `${running} running · every player sees them`
        : "A banner for every player";
    }
    if (v.tab === "titles") {
      sub = plural(this.titles.length, "title");
      tools = `<button type="button" class="adm-btn adm-btn-primary" data-act="title-new">${icon("create")}<span>New title</span></button>`;
    }
    return `<header class="adm-head"><div class="adm-head-text"><h2>${title}</h2><p class="adm-sub">${sub}</p></div><div class="adm-head-tools">${tools}<button type="button" class="adm-icon-btn" id="online-refresh" data-act="refresh" aria-label="Refresh" title="Refresh">${icon("again")}</button></div></header>`;
  }
  private syncTabs() {
    const bar = document.querySelector<HTMLElement>("#dialog .admin-tabs");
    if (!bar) return;
    const fresh = document.createElement("div");
    fresh.innerHTML = this.tabs();
    bar.replaceChildren(...Array.from(fresh.firstElementChild!.childNodes));
    this.bindTabs();
  }
  private bindTabs() {
    document
      .querySelectorAll<HTMLButtonElement>("#dialog .admin-tab")
      .forEach((tab) => {
        tab.onclick = () => {
          const id = tab.dataset.tab as AdminTab;
          if (id === this.view.tab) return;
          void this.show({ tab: id, pending: null });
        };
      });
    document
      .querySelector<HTMLButtonElement>("#dialog .admin-tab.active")
      ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  private draw(body: string, toTop: boolean) {
    if (!this.mounted()) this.hooks.openDialog(this.shell(""));
    const root = document.getElementById("adm-root")!;
    root.dataset.tab = this.view.tab;
    root.removeAttribute("aria-busy");
    root.innerHTML = `${this.head()}${body}`;
    this.syncTabs();
    if (toTop) {
      const scroller = root.closest<HTMLElement>(".dialog-content");
      if (scroller) scroller.scrollTop = 0;
    }
    root.onclick = (event) => void this.click(event);
    root.onchange = (event) => void this.change(event);
    root.onsubmit = (event) => void this.submit(event);
    root.oninput = (event) => this.input(event);
  }
  private afterDraw() {
    const v = this.view;
    // An open player row loads their coins and chat stop once.
    if (v.tab === "players" && v.open && !this.status.has(v.open))
      void this.loadStatus(v.open);
    // A step that asks for typing puts the cursor in its field.
    const field = document.querySelector<HTMLInputElement>(
      "#adm-root [data-autofocus]",
    );
    if (field) focusForTyping(field);
    else
      document
        .querySelector<HTMLElement>("#adm-root [data-confirm]")
        ?.focus({ preventScroll: true });
    // The open player row stays in view after a redraw.
    if (v.open)
      document
        .querySelector<HTMLElement>(`#adm-root [data-player="${v.open}"]`)
        ?.scrollIntoView({ block: "nearest" });
    // A picture report: load the picture itself.
    document
      .querySelectorAll<HTMLElement>("#adm-root [data-admin-photo]")
      .forEach((box) => this.loadPhoto(box));
    if (v.tab === "online" && !this.onlineError)
      this.timer = setTimeout(() => {
        if (this.mounted() && this.view.tab === "online")
          void this.show({}, true);
      }, 10000);
  }
  private async loadStatus(id: string) {
    let result: AdminPlayerStatus | { error: string };
    try {
      result = (await this.hooks.api(
        `/api/admin/players/${id}/status`,
      )) as AdminPlayerStatus;
    } catch (error) {
      result = {
        error:
          error instanceof Error ? error.message : "Couldn't load their coins.",
      };
    }
    this.status.set(id, result);
    // Redraw only if their row is still the open one and nothing is typed.
    const typing = document.activeElement?.closest?.("#adm-root form");
    if (
      this.mounted() &&
      this.view.tab === "players" &&
      this.view.open === id &&
      !typing
    )
      this.redraw();
  }
  private loadPhoto(box: HTMLElement) {
    const pic = box.querySelector<HTMLElement>(".admin-photo-pic")!;
    void (
      this.hooks.api(
        `/api/admin/avatar-photo/${box.dataset.adminPhoto}`,
      ) as Promise<{
        src: string | null;
        hidden: boolean;
      }>
    ).then(
      ({ src, hidden }) => {
        if (!src) {
          pic.textContent = "Already removed.";
          return;
        }
        const img = document.createElement("img");
        img.src = src;
        img.alt = "The reported picture";
        pic.replaceChildren(img);
        if (hidden) pic.dataset.hidden = "Hidden (3 reports)";
      },
      () => (pic.textContent = "Couldn't load it."),
    );
  }
  /** The result of an action, at the bottom of the screen for 4 s. */
  say(text: string, error = false) {
    const toast = document.getElementById("admin-message");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.toggle("is-error", error);
    toast.classList.toggle("is-shown", !!text);
    clearTimeout(this.toastTimer);
    if (text)
      this.toastTimer = setTimeout(
        () => toast.classList.remove("is-shown"),
        error ? 6000 : 4000,
      );
  }
  private fail(error: unknown) {
    this.say(error instanceof Error ? error.message : "Request failed.", true);
  }

  // -------------------------------------------------------------- bodies

  private body() {
    switch (this.view.tab) {
      case "overview":
        return this.overviewBody();
      case "players":
        return this.playersBody();
      case "online":
        return this.onlineBody();
      case "reports":
        return this.reportsBody();
      case "titles":
        return this.titlesBody();
      case "announce":
        return this.announceBody();
    }
  }
  private notice(text: string) {
    return text
      ? `<p class="admin-notice adm-notice">${icon("info")}<span>${escape(text)}</span></p>`
      : "";
  }

  private overviewBody() {
    const players = this.online.players;
    const fighting = players.filter((p) => p.activity === "match").length;
    const tile = (
      tab: AdminTab,
      value: string | number,
      label: string,
      detail: string,
      tone = "",
    ) =>
      `<button type="button" class="adm-kpi ${tone}" data-act="go" data-tab="${tab}"><b>${value}</b><span>${label}</span><small>${detail}</small></button>`;
    const kpis = `<div class="adm-kpis">${tile(
      "online",
      this.onlineError ? "–" : players.length,
      "Online",
      this.onlineError
        ? "unavailable"
        : `${plural(this.online.guests, "visitor")} not signed in`,
      "is-live",
    )}${tile(
      "online",
      this.onlineError ? "–" : fighting,
      "In matches",
      `${players.filter((p) => p.activity === "lobby").length} in lobbies`,
    )}${tile(
      "reports",
      this.reportsError ? "–" : (this.openReports ?? 0),
      "Open reports",
      this.reportsError
        ? "unavailable"
        : this.openReports
          ? "need a look"
          : "all clear",
      this.openReports ? "is-alert" : "",
    )}${tile(
      "players",
      this.totalPlayers ?? "–",
      "Players",
      "accounts in total",
    )}</div>`;
    const find = `<form class="adm-search adm-find" data-form="find" role="search"><span class="adm-search-box">${icon("search")}<input name="search" placeholder="Find a player by name or ID" aria-label="Find a player" autocomplete="off" enterkeyhint="search"></span><button class="adm-btn adm-btn-primary">Find</button></form>`;
    const reports = this.reports.reports
      .filter((r) => r.status === "open")
      .slice(0, 3);
    const attention = `<section class="adm-panel"><header><h3>${icon("report")}Needs attention</h3><button type="button" class="adm-link" data-act="go" data-tab="reports">All reports</button></header>${
      this.reportsError
        ? this.notice(this.reportsError)
        : reports.length
          ? `<ul class="adm-mini">${reports
              .map(
                (r) =>
                  `<li><button type="button" data-act="go" data-tab="reports"><span class="report-category ${r.category}">${escape(REPORT_CATEGORIES[r.category] ?? r.category)}</span><span class="adm-mini-text">${escape(r.message)}</span><small>${ago(r.createdAt)}</small></button></li>`,
              )
              .join("")}</ul>`
          : `<p class="adm-quiet">${icon("check")}No open reports.</p>`
    }</section>`;
    const live = [...players]
      .sort(
        (a, b) =>
          Number(b.activity === "match") - Number(a.activity === "match"),
      )
      .slice(0, 5);
    const liveNow = `<section class="adm-panel"><header><h3>${icon("friends")}Live now</h3><button type="button" class="adm-link" data-act="go" data-tab="online">Everyone online</button></header>${
      this.onlineError
        ? this.notice(this.onlineError)
        : live.length
          ? `<ul class="adm-mini">${live
              .map(
                (p) =>
                  `<li><button type="button" data-act="manage" data-id="${escape(p.id)}"><span class="online-dot ${p.activity}" aria-hidden="true"></span><span class="adm-mini-text"><strong>${escape(p.displayName)}</strong> · ${describeActivity(p, this.hooks.fighterName)}</span><small>${onlineFor(p.since, Date.now())}</small></button></li>`,
              )
              .join("")}</ul>`
          : `<p class="adm-quiet">Nobody is signed in right now.</p>`
    }</section>`;
    return `${kpis}${find}<div class="adm-panels">${attention}${liveNow}</div>`;
  }

  private playersBody() {
    const v = this.view;
    const { players, total } = this.directory;
    const onlineById = new Map(this.online.players.map((p) => [p.id, p]));
    const search = `<div class="adm-sticky adm-player-tools"><form id="admin-search" class="adm-search" data-form="search" role="search"><span class="adm-search-box">${icon("search")}<input name="search" placeholder="Name or player ID" value="${escape(v.search)}" aria-label="Search players" autocomplete="off" enterkeyhint="search">${v.search ? `<button type="button" class="adm-clear" data-act="clear-search" aria-label="Clear search">${icon("cancel")}</button>` : ""}</span><button class="adm-btn adm-btn-primary">Search</button></form><div class="adm-chips adm-sort" role="group" aria-label="Order">${(
      [
        ["new", "Newest"],
        ["online", "Last online"],
      ] as const
    )
      .map(
        ([id, label]) =>
          `<button type="button" class="${v.sort === id ? "active" : ""}" data-act="sort" data-sort="${id}" aria-pressed="${v.sort === id}">${label}</button>`,
      )
      .join("")}</div></div>`;
    const rows = players
      .map((p) =>
        this.playerRow(p, onlineById.get(p.id) ? onlineById.get(p.id)! : null),
      )
      .join("");
    return `${search}<div class="admin-list adm-list">${
      rows ||
      `<div class="adm-empty">${icon("search")}<p>${v.search ? `No players match “${escape(v.search)}”.` : "No players yet."}</p></div>`
    }</div>${this.pager("players", v.offset, total)}`;
  }
  private pager(kind: "players" | "reports", offset: number, total: number) {
    if (total <= PAGE) return "";
    const prev = kind === "players" ? "admin-prev" : "report-prev";
    const next = kind === "players" ? "admin-next" : "report-next";
    return `<nav class="admin-pagination adm-pager" aria-label="Pages"><button type="button" id="${prev}" class="adm-btn" data-act="page" data-kind="${kind}" data-step="-1" ${offset === 0 ? "disabled" : ""}>${icon("back")}<span>Previous</span></button><span>${offset + 1}–${Math.min(offset + PAGE, total)} of ${total}</span><button type="button" id="${next}" class="adm-btn" data-act="page" data-kind="${kind}" data-step="1" ${offset + PAGE >= total ? "disabled" : ""}><span>Next</span><span class="adm-flip">${icon("back")}</span></button></nav>`;
  }
  private playerRow(
    p: ManagedPlayer,
    live: OnlineList["players"][number] | null,
  ) {
    const v = this.view;
    const open = v.open === p.id;
    const owned = sortTitles(
      this.titles.filter((t) => p.titleIds.includes(t.id)),
    );
    const name = escape(p.displayName);
    const status = p.suspended
      ? '<span class="admin-badge danger">Suspended</span>'
      : live
        ? `<span class="adm-online"><span class="online-dot ${live.activity}" aria-hidden="true"></span>${ACTIVITY_LABELS[live.activity]}</span>`
        : "";
    const head = `<button type="button" class="adm-row-main" data-act="toggle" aria-expanded="${open}" aria-controls="adm-detail-${p.id}"><span class="adm-avatar" aria-hidden="true">${escape([...p.displayName][0]?.toUpperCase() ?? "?")}</span><span class="adm-row-text"><span class="adm-row-name"><strong>${name}</strong>${p.isAdmin ? '<span class="admin-badge">Admin</span>' : ""}</span><small>${p.title ? `${escape(p.title)} · ` : ""}${live ? `Joined ${new Date(p.createdAt).toLocaleDateString()}` : seenText(p.lastOnline, p.createdAt)}${owned.length ? ` · ${plural(owned.length, "title")}` : ""}</small></span>${status}<span class="adm-chevron" aria-hidden="true"></span></button>`;
    return `<article class="admin-row adm-player${open ? " is-open" : ""}${p.suspended ? " is-suspended" : ""}" data-player="${p.id}" data-name="${name}">${head}${open ? this.playerDetail(p, owned, live) : ""}</article>`;
  }
  private playerDetail(
    p: ManagedPlayer,
    owned: Title[],
    live: OnlineList["players"][number] | null,
  ) {
    const pending = this.view.pending;
    const name = escape(p.displayName);
    const grantable = sortTitles(
      this.titles.filter((t) => t.active && !p.titleIds.includes(t.id)),
    );
    const facts = `<dl class="adm-facts"><div><dt>Player ID</dt><dd class="adm-id"><code>${p.id}</code><button type="button" class="adm-icon-btn adm-copy" data-act="copy" data-copy="${p.id}" aria-label="Copy player ID" title="Copy ID">${icon("copy")}</button></dd></div><div><dt>Status</dt><dd>${p.suspended ? '<span class="adm-bad">Suspended</span>' : "Active"}</dd></div><div><dt>Right now</dt><dd>${live ? `${describeActivity(live, this.hooks.fighterName)} · ${onlineFor(live.since, Date.now())}` : "Offline"}</dd></div><div><dt>Last online</dt><dd>${live ? "Now" : p.lastOnline ? `${escape(new Date(p.lastOnline).toLocaleString([], { dateStyle: "short", timeStyle: "short" }))} · ${ago(p.lastOnline)}` : p.lastOnline === null ? "Never seen" : "Unknown"}</dd></div><div><dt>Joined</dt><dd>${new Date(p.createdAt).toLocaleString()}</dd></div>${p.isAdmin ? "" : this.statusFacts(p.id)}</dl>`;
    const newTitle =
      pending === `newtitle:${p.id}` ? this.titleForm(null, "grant") : "";
    const titles = `<section class="adm-block"><h4>Titles</h4><div class="admin-titles-row">${owned
      .map(
        (t) =>
          `<span class="title-chip" style="--chip:${escape(t.color)}">${escape(t.name)}<button type="button" data-act="revoke" data-title="${t.id}" aria-label="Remove ${escape(t.name)}" title="Remove title">×</button></span>`,
      )
      .join(
        "",
      )}<select class="grant-select" data-act="grant" aria-label="Grant a title to ${name}"><option value="">+ Grant title…</option>${grantable.map((t) => `<option value="${t.id}">${escape(t.name)}</option>`).join("")}<option value="__new">Create new title…</option></select></div>${newTitle}</section>`;
    if (p.isAdmin)
      return `<div class="adm-detail" id="adm-detail-${p.id}">${facts}${titles}<p class="adm-quiet">${icon("admin")}Administrators can't be suspended, muted or deleted here.</p></div>`;
    const mute = `<div class="adm-field"><span>Chat</span><div class="adm-seg" role="group" aria-label="Mute ${name}'s chat">${MUTE_CHOICES.map(
      (c) =>
        `<button type="button" data-act="mute" data-hours="${c.hours}"${c.hours === 0 ? ' class="adm-seg-end"' : ""}>${c.hours ? `Mute ${c.label}` : c.label}</button>`,
    ).join("")}</div></div>`;
    let confirm = "";
    if (pending === `suspend:${p.id}`)
      confirm = `<div class="admin-confirm adm-confirm"><p><b>${p.suspended ? "Unsuspend" : "Suspend"} ${name}?</b> ${p.suspended ? "They can log in and play again." : "They are removed from any match and can't play until unsuspended."}</p><div class="admin-actions"><button type="button" class="adm-btn ${p.suspended ? "adm-btn-primary" : "adm-btn-danger"}" data-confirm data-act="suspend-yes">${p.suspended ? "Unsuspend" : "Suspend"}</button><button type="button" class="adm-btn" data-act="cancel">Cancel</button></div></div>`;
    if (pending === `delete:${p.id}`)
      confirm = `<div class="admin-confirm adm-confirm"><p><b>Permanently delete ${name}?</b> Their login, profile and titles are removed for good. This cannot be undone.</p><label><span>Type <b>${name}</b> to confirm</span><input data-confirm-name data-autofocus autocomplete="off" aria-label="Type ${name} to confirm"></label><div class="admin-actions"><button type="button" class="adm-btn adm-btn-danger" data-confirm data-act="delete-yes" disabled>Delete account</button><button type="button" class="adm-btn" data-act="cancel">Cancel</button></div></div>`;
    const actions = `<section class="adm-block"><h4>Moderation</h4>${mute}<div class="adm-actions"><button type="button" class="adm-btn ${p.suspended ? "adm-btn-primary" : ""}" data-act="suspend">${icon(p.suspended ? "check" : "lock")}<span>${p.suspended ? "Unsuspend" : "Suspend"}</span></button><button type="button" class="adm-btn adm-btn-danger" data-act="delete">${icon("trash")}<span>Delete account</span></button></div>${confirm}</section>`;
    return `<div class="adm-detail" id="adm-detail-${p.id}">${facts}${titles}${this.coinsBlock(p.id)}${actions}</div>`;
  }
  /** Coins and chat lines of a player's facts (loading, or why not). */
  private statusFacts(id: string) {
    const st = this.status.get(id);
    if (!st)
      return `<div><dt>Coins</dt><dd class="adm-dim">Loading…</dd></div><div><dt>Chat</dt><dd class="adm-dim">Loading…</dd></div>`;
    if ("error" in st)
      return `<div class="adm-wide"><dt>Coins &amp; chat</dt><dd class="adm-dim">${escape(st.error)}</dd></div>`;
    const chat = st.chatUntil
      ? `<span class="adm-bad">Muted until ${escape(new Date(st.chatUntil).toLocaleString([], { dateStyle: "short", timeStyle: "short" }))}</span>${st.chatReason ? ` · ${escape(st.chatReason)}` : ""}`
      : "Can chat";
    return `<div><dt>Coins</dt><dd data-coins><b>${st.balance.toLocaleString()}</b></dd></div><div><dt>Chat</dt><dd data-chat>${chat}</dd></div>`;
  }
  /** Add or take coins, with a reason; their latest coin movements below. */
  private coinsBlock(id: string) {
    const st = this.status.get(id);
    if (!st || "error" in st) return "";
    const history = st.coins.length
      ? `<details class="adm-details"><summary>Latest coin changes</summary><ul class="adm-ledger">${st.coins
          .map(
            (c) =>
              `<li><b class="${c.amount < 0 ? "adm-minus" : "adm-plus"}">${c.amount > 0 ? "+" : ""}${c.amount.toLocaleString()}</b><span>${escape(COIN_REASONS[c.reason] ?? c.reason)}</span><small>${ago(c.at)}</small></li>`,
          )
          .join("")}</ul></details>`
      : "";
    return `<section class="adm-block"><h4>Coins</h4><form class="adm-coins" data-form="coins" data-ref="${newRef()}"><div class="adm-coin-row"><input name="amount" type="number" inputmode="numeric" min="1" max="100000" step="1" required placeholder="Amount" aria-label="Coins"><div class="adm-presets" role="group" aria-label="Quick amounts">${COIN_PRESETS.map((n) => `<button type="button" data-act="coin-preset" data-amount="${n}">${n.toLocaleString()}</button>`).join("")}</div></div><input name="reason" maxlength="120" minlength="3" required placeholder="Why? (kept in the admin log)" aria-label="Reason" autocomplete="off"><div class="adm-actions"><button class="adm-btn adm-btn-primary" name="dir" value="add">${icon("create")}<span>Add coins</span></button><button class="adm-btn adm-btn-danger" name="dir" value="take">${icon("cancel")}<span>Take coins</span></button></div></form>${history}</section>`;
  }

  private onlineBody() {
    if (this.onlineError) return this.notice(this.onlineError);
    return renderOnline(
      this.online,
      this.hooks.fighterName,
      Date.now(),
      this.view.onlineFilter,
    );
  }

  private reportsBody() {
    const v = this.view;
    const filter = `<div class="report-filter adm-chips adm-sticky" role="group" aria-label="Report status">${(
      ["open", "resolved", "all"] as const
    )
      .map(
        (s) =>
          `<button type="button" class="${v.status === s ? "active" : ""}" data-act="status" data-status="${s}" aria-pressed="${v.status === s}">${s[0].toUpperCase() + s.slice(1)}${s === "open" && this.openReports ? ` <b>${this.openReports}</b>` : ""}</button>`,
      )
      .join("")}</div>`;
    if (this.reportsError) return `${filter}${this.notice(this.reportsError)}`;
    const cards = this.reports.reports.map((r) => this.reportCard(r)).join("");
    return `${filter}<div class="admin-list adm-list">${
      cards ||
      `<div class="adm-empty">${icon("check")}<p>No ${v.status === "all" ? "" : v.status + " "}reports.</p></div>`
    }</div>${this.pager("reports", v.reportOffset, this.reports.total)}`;
  }
  private reportCard(r: ProblemReport) {
    const context = r.context ?? {};
    const target = reportedPlayer(context);
    const chat = chatTarget(context);
    const photo = photoTarget(context);
    const main = MAIN_CONTEXT.filter((k) => context[k]).map(
      (k) => `<span><i>${escape(k)}</i> ${escape(String(context[k]))}</span>`,
    );
    const rest = Object.entries(context).filter(
      ([k]) => !MAIN_CONTEXT.includes(k),
    );
    const details = rest.length
      ? `<details class="adm-details"><summary>${plural(rest.length, "more detail")}</summary><dl>${rest
          .map(
            ([k, val]) =>
              `<div><dt>${escape(k)}</dt><dd>${escape(String(val))}</dd></div>`,
          )
          .join("")}</dl></details>`
      : "";
    const open = r.status === "open";
    return `<article class="report-card adm-report ${r.status}" data-report="${r.id}"><header class="adm-report-head"><span class="report-category ${r.category}">${escape(REPORT_CATEGORIES[r.category] ?? r.category)}</span><strong>${escape(r.reporterName || "Deleted player")}</strong><small title="${escape(new Date(r.createdAt).toLocaleString())}">${ago(r.createdAt)}</small>${open ? "" : '<span class="adm-done">Resolved</span>'}</header><p class="report-text">${escape(r.message)}</p>${
      main.length
        ? `<p class="report-context adm-context">${main.join("")}</p>`
        : ""
    }${details}${
      photo
        ? `<div class="admin-photo" data-admin-photo="${photo}"><span class="admin-photo-pic" aria-label="The reported picture">Loading…</span><div class="adm-actions"><button type="button" class="adm-btn" data-act="photo" data-keep="true">${icon("check")}<span>Keep picture</span></button><button type="button" class="adm-btn adm-btn-danger" data-act="photo" data-keep="false">${icon("trash")}<span>Remove picture</span></button></div></div>`
        : ""
    }<div class="adm-actions adm-report-actions"><button type="button" class="adm-btn ${open ? "adm-btn-primary" : ""}" data-act="resolve" data-resolve="${open}">${icon(open ? "check" : "again")}<span>${open ? "Mark resolved" : "Reopen"}</span></button>${
      chat
        ? `<button type="button" class="adm-btn" data-act="chat-stop" data-chat-stop="${chat}">${icon("chat")}<span>Stop their chat 24 h</span></button>`
        : ""
    }${
      target
        ? `<button type="button" class="adm-btn" data-act="manage" data-id="${target}">${icon("user")}<span>Reported player</span></button>`
        : ""
    }${
      r.reporterId
        ? `<button type="button" class="adm-btn adm-btn-quiet" data-act="manage" data-id="${escape(r.reporterId)}">${icon("search")}<span>Reporter</span></button>`
        : ""
    }</div></article>`;
  }

  private readDraft(form: HTMLFormElement) {
    const fields = new FormData(form);
    this.draft.message = String(fields.get("message") ?? "").trim();
    const hours = Number(fields.get("hours"));
    if (ANNOUNCE_HOURS.some((h) => h.hours === hours)) this.draft.hours = hours;
  }
  private announceBody() {
    const d = this.draft;
    const pending = this.view.pending === "announce";
    const tones = (["info", "event", "warning"] as const)
      .map(
        (t) =>
          `<button type="button" class="${d.tone === t ? "active" : ""}" data-act="announce-tone" data-tone="${t}" aria-pressed="${d.tone === t}">${TONE_LABELS[t]}</button>`,
      )
      .join("");
    const hours = ANNOUNCE_HOURS.find((h) => h.hours === d.hours)!;
    const online = this.online.players.length + this.online.guests;
    const confirm = pending
      ? `<div class="admin-confirm adm-confirm"><p><b>Send this to every player?</b> ${online ? `${plural(online, "player")} online now see it at once; ` : ""}everyone who signs in during the next ${hours.label} sees it once.</p><div class="admin-actions"><button type="button" class="adm-btn adm-btn-primary" data-confirm data-act="announce-yes">${icon("send")}<span>Send now</span></button><button type="button" class="adm-btn" data-act="cancel">Cancel</button></div></div>`
      : "";
    const form = `<form class="adm-panel adm-announce" data-form="announce"><label class="adm-field-block"><span>Message</span><textarea name="message" rows="2" maxlength="300" required placeholder="What should every player know?" aria-label="Announcement">${escape(d.message)}</textarea><small data-count>${d.message.length} / 300</small></label><div class="adm-announce-row"><div class="adm-chips" role="group" aria-label="Kind">${tones}</div><label class="adm-hours"><span>Shows for</span><select name="hours" aria-label="Shows for">${ANNOUNCE_HOURS.map((h) => `<option value="${h.hours}"${h.hours === d.hours ? " selected" : ""}>${h.label}</option>`).join("")}</select></label></div><div class="adm-preview tone-${d.tone}" aria-hidden="true"><b>${TONE_LABELS[d.tone]}</b><span data-preview>${escape(d.message || "Your message")}</span></div>${
      pending
        ? confirm
        : `<div class="adm-actions"><button class="adm-btn adm-btn-primary">${icon("send")}<span>Send to everyone</span></button></div>`
    }</form>`;
    const now = Date.now();
    const list = this.announceError
      ? this.notice(this.announceError)
      : this.announcements.length
        ? `<div class="adm-list">${this.announcements
            .map((a) => {
              const running = Date.parse(a.endsAt) > now;
              return `<article class="adm-panel adm-sent${running ? "" : " is-ended"}" data-announcement="${a.id}"><header><span class="adm-tone tone-${a.tone}">${TONE_LABELS[a.tone]}</span><small>${a.by ? `${escape(a.by)} · ` : ""}${ago(a.createdAt)}</small><span class="${running ? "adm-running" : "adm-done-tag"}">${running ? `Ends ${untilText(a.endsAt, now)}` : "Ended"}</span></header><p>${escape(a.message)}</p>${running ? `<div class="adm-actions"><button type="button" class="adm-btn adm-btn-danger" data-act="announce-end" data-id="${a.id}">${icon("cancel")}<span>End now</span></button></div>` : ""}</article>`;
            })
            .join("")}</div>`
        : `<div class="adm-empty">${icon("send")}<p>No announcements yet.</p></div>`;
    return `${form}<h3 class="adm-subhead">Sent</h3>${list}`;
  }
  private titlesBody() {
    const pending = this.view.pending;
    const titles = sortTitles(this.titles);
    const form =
      pending === "title-new"
        ? `<div class="adm-panel adm-new-title">${this.titleForm(null, "save")}</div>`
        : "";
    const rows = titles
      .map((t) => {
        if (pending === `title-edit:${t.id}`)
          return `<article class="adm-title is-editing" data-title-row="${t.id}">${this.titleForm(t, "save")}</article>`;
        const confirm =
          pending === `title-delete:${t.id}`
            ? `<div class="admin-confirm adm-confirm"><p><b>Delete “${escape(t.name)}”?</b> It is removed from every player who has it. This cannot be undone.</p><div class="admin-actions"><button type="button" class="adm-btn adm-btn-danger" data-confirm data-act="title-delete-yes" data-id="${t.id}">Delete title</button><button type="button" class="adm-btn" data-act="cancel">Cancel</button></div></div>`
            : "";
        return `<article class="adm-title${t.active ? "" : " is-off"}" data-title-row="${t.id}"><span class="adm-swatch" style="--chip:${escape(t.color)}" aria-hidden="true"></span><div class="adm-title-text"><span class="title-chip" style="--chip:${escape(t.color)}">${escape(t.name)}</span><small>${escape(t.description || "No description")}</small></div><button type="button" class="adm-switch" role="switch" aria-checked="${t.active}" data-act="title-active" data-id="${t.id}" aria-label="${escape(t.name)} can be granted">${t.active ? "On" : "Off"}</button><button type="button" class="adm-icon-btn" data-act="title-edit" data-id="${t.id}" aria-label="Edit ${escape(t.name)}" title="Edit">${icon("edit")}</button><button type="button" class="adm-icon-btn adm-danger-icon" data-act="title-delete" data-id="${t.id}" aria-label="Delete ${escape(t.name)}" title="Delete">${icon("trash")}</button>${confirm}</article>`;
      })
      .join("");
    return `${form}<p class="adm-hint">Titles that are off stay with the players who have them but can't be granted.</p><div class="adm-list adm-titles">${
      rows ||
      `<div class="adm-empty">${icon("star")}<p>No titles yet.</p></div>`
    }</div>`;
  }
  /** Create or edit a title. `grant`: create it and grant it to the open player. */
  private titleForm(title: Title | null, mode: "save" | "grant") {
    const preset =
      TITLE_PRESETS.find(
        (p) =>
          !this.titles.some(
            (t) => t.name.toLowerCase() === p.name.toLowerCase(),
          ),
      ) ?? TITLE_PRESETS[0];
    const name = title?.name ?? (mode === "grant" ? preset.name : "");
    const color = title?.color ?? preset.color;
    return `<form class="new-title-form adm-title-form" data-form="title" data-mode="${mode}" data-id="${title?.id ?? ""}"><label class="adm-color"><input name="color" type="color" value="${escape(color)}" aria-label="Title color"></label><input name="name" maxlength="40" required placeholder="Title name" value="${escape(name)}" aria-label="Title name" data-autofocus>${
      mode === "save"
        ? `<input name="description" maxlength="160" placeholder="Description (optional)" value="${escape(title?.description ?? "")}" aria-label="Title description">`
        : ""
    }<div class="adm-actions"><button class="adm-btn adm-btn-primary">${icon("save")}<span>${mode === "grant" ? "Create &amp; grant" : title ? "Save" : "Create"}</span></button><button type="button" class="adm-btn" data-act="cancel">Cancel</button></div></form>`;
  }

  // -------------------------------------------------------------- events

  private row(target: Element) {
    const row = target.closest<HTMLElement>("[data-player]");
    return row
      ? { id: row.dataset.player!, name: row.dataset.name ?? "" }
      : null;
  }
  /** Run an action, then redraw with its message (or show the error). */
  private async act(
    button: HTMLButtonElement | HTMLSelectElement | null,
    work: () => Promise<unknown>,
    message: string,
    changes: Partial<AdminView> = {},
  ) {
    if (button) button.disabled = true;
    try {
      await work();
      await this.show({ pending: null, ...changes }, true);
      this.say(message);
    } catch (error) {
      this.fail(error);
      if (button?.isConnected) button.disabled = false;
    }
  }

  private async click(event: MouseEvent) {
    const button = (event.target as Element).closest<HTMLButtonElement>(
      "button[data-act]",
    );
    if (!button || button.disabled) return;
    const { api } = this.hooks;
    const v = this.view;
    const act = button.dataset.act!;
    const row = this.row(button);
    const titleName = (id: string) =>
      this.titles.find((t) => t.id === id)?.name ?? "Title";
    switch (act) {
      case "refresh":
        this.status.clear();
        return void this.show();
      case "coin-preset": {
        const field = button
          .closest("form")
          ?.querySelector<HTMLInputElement>('input[name="amount"]');
        if (field) field.value = button.dataset.amount!;
        return;
      }
      case "go":
        return void this.show({
          tab: button.dataset.tab as AdminTab,
          pending: null,
        });
      case "manage": {
        const id = button.dataset.id!;
        return void this.show({
          tab: "players",
          search: id,
          offset: 0,
          open: id,
          pending: null,
        });
      }
      case "clear-search":
        return void this.show({
          search: "",
          offset: 0,
          open: null,
          pending: null,
        });
      case "page": {
        const step = Number(button.dataset.step) * PAGE;
        if (button.dataset.kind === "reports")
          return void this.show(
            { reportOffset: Math.max(0, v.reportOffset + step) },
            false,
          ).then(() => this.scrollTop());
        return void this.show({
          offset: Math.max(0, v.offset + step),
          open: null,
          pending: null,
        }).then(() => this.scrollTop());
      }
      case "toggle":
        if (!row) return;
        // Opening a row is local: no need to ask the server again.
        v.open = v.open === row.id ? null : row.id;
        v.pending = null;
        return this.redraw();
      case "cancel":
        v.pending = null;
        return this.redraw();
      case "copy":
        try {
          await navigator.clipboard.writeText(button.dataset.copy!);
          this.say("Player ID copied.");
        } catch {
          this.say("Couldn't copy: hold the ID to select it.", true);
        }
        return;
      case "revoke":
        if (!row) return;
        return this.act(
          button,
          () =>
            api("/api/admin/grants", {
              playerId: row.id,
              titleId: button.dataset.title,
              grant: false,
            }),
          `“${titleName(button.dataset.title!)}” removed from ${row.name}.`,
        );
      case "mute": {
        if (!row) return;
        this.status.delete(row.id);
        const hours = Number(button.dataset.hours);
        const choice = MUTE_CHOICES.find((c) => c.hours === hours)!;
        return this.act(
          button,
          () =>
            api("/api/admin/chat-ban", {
              playerId: row.id,
              hours,
              reason: "Set in the Admin panel",
            }),
          hours
            ? `${row.name} can't chat for ${choice.label}.`
            : `${row.name} can chat again.`,
        );
      }
      case "suspend":
        if (!row) return;
        v.pending = `suspend:${row.id}`;
        return this.redraw();
      case "delete":
        if (!row) return;
        v.pending = `delete:${row.id}`;
        return this.redraw();
      case "suspend-yes": {
        if (!row) return;
        const p = this.directory.players.find((x) => x.id === row.id);
        const suspended = !!p?.suspended;
        return this.act(
          button,
          () =>
            api("/api/admin/players/suspend", {
              id: row.id,
              suspended: !suspended,
            }),
          `${row.name} is ${suspended ? "no longer suspended" : "suspended"}.`,
        );
      }
      case "delete-yes":
        if (!row) return;
        return this.act(
          button,
          () => api("/api/admin/players/delete", { id: row.id, confirm: true }),
          `${row.name} was deleted.`,
          { open: null },
        );
      case "status":
        return void this.show({
          status: button.dataset.status as AdminView["status"],
          reportOffset: 0,
        });
      case "resolve": {
        const id = Number(
          button.closest<HTMLElement>("[data-report]")!.dataset.report,
        );
        const resolved = button.dataset.resolve === "true";
        return this.act(
          button,
          () => api("/api/admin/reports/resolve", { id, resolved }),
          resolved ? "Report marked resolved." : "Report reopened.",
        );
      }
      case "chat-stop":
        return this.act(
          button,
          () =>
            api("/api/admin/chat-ban", {
              playerId: button.dataset.chatStop,
              hours: 24,
              reason: "From a chat report",
            }),
          "Their chat is stopped for 24 hours.",
        );
      case "photo": {
        const box = button.closest<HTMLElement>("[data-admin-photo]")!;
        const keep = button.dataset.keep === "true";
        return this.act(
          button,
          () =>
            api("/api/admin/avatar-photo", {
              photo: box.dataset.adminPhoto,
              keep,
            }),
          keep
            ? "Picture kept and shown again."
            : "Picture removed. They can add one again in 7 days.",
        );
      }
      case "title-new":
        v.pending = v.pending === "title-new" ? null : "title-new";
        if (v.tab !== "titles") return void this.show({ tab: "titles" });
        return this.redraw();
      case "title-edit":
        v.pending = `title-edit:${button.dataset.id}`;
        return this.redraw();
      case "title-delete":
        v.pending = `title-delete:${button.dataset.id}`;
        return this.redraw();
      case "title-delete-yes": {
        const id = button.dataset.id!;
        const name = titleName(id);
        return this.act(
          button,
          () => api("/api/admin/titles/delete", { id, confirm: true }),
          `Title “${name}” was deleted.`,
        );
      }
      case "title-active": {
        const title = this.titles.find((t) => t.id === button.dataset.id);
        if (!title) return;
        return this.act(
          button,
          () =>
            api("/api/admin/titles", {
              id: title.id,
              name: title.name,
              description: title.description,
              color: title.color,
              active: !title.active,
            }),
          title.active
            ? `“${title.name}” can no longer be granted.`
            : `“${title.name}” can be granted again.`,
        );
      }
      case "sort":
        return void this.show({
          sort: button.dataset.sort as AdminView["sort"],
          offset: 0,
          open: null,
          pending: null,
        });
      case "announce-tone":
        this.draft.tone = button.dataset.tone as Announcement["tone"];
        return this.redraw();
      case "announce-yes": {
        const { message, tone, hours } = this.draft;
        button.disabled = true;
        try {
          await api("/api/admin/announce", { message, tone, hours });
          this.draft = { message: "", tone: "info", hours: 24 };
          await this.show({ pending: null }, true);
          this.say("Sent to every player.");
        } catch (error) {
          this.fail(error);
          if (button.isConnected) button.disabled = false;
        }
        return;
      }
      case "announce-end": {
        const id = Number(button.dataset.id);
        return this.act(
          button,
          () => api("/api/admin/announcements/end", { id }),
          "Announcement ended. Players no longer see it.",
        );
      }
      case "online-filter":
        v.onlineFilter = button.dataset.filter as OnlineFilter;
        return this.redraw();
    }
  }
  private scrollTop() {
    const scroller = document
      .querySelector<HTMLElement>("#adm-root")
      ?.closest<HTMLElement>(".dialog-content");
    if (scroller) scroller.scrollTop = 0;
  }
  /** Draw the section again from what is already loaded. */
  private redraw() {
    clearTimeout(this.timer);
    this.draw(this.body(), false);
    this.afterDraw();
  }

  /** Add or take coins (the form's own id makes a retry pay once). */
  private async coins(form: HTMLFormElement, submitter: HTMLElement | null) {
    const row = this.row(form);
    if (!row) return;
    const fields = new FormData(form);
    const take = (submitter as HTMLButtonElement | null)?.value === "take";
    const size = Math.floor(Number(fields.get("amount")));
    const reason = String(fields.get("reason") ?? "").trim();
    if (!(size >= 1 && size <= 100000))
      return this.say("Choose 1 to 100,000 coins.", true);
    if (reason.length < 3)
      return this.say("Say why (3 characters or more).", true);
    const buttons = Array.from(
      form.querySelectorAll<HTMLButtonElement>("button"),
    );
    buttons.forEach((b) => (b.disabled = true));
    try {
      const result = (await this.hooks.api("/api/admin/coins", {
        playerId: row.id,
        amount: take ? -size : size,
        reason,
        ref: form.dataset.ref,
      })) as { applied: number; balance: number };
      this.status.delete(row.id);
      await this.show({ pending: null }, true);
      this.say(
        result.applied === 0
          ? `Nothing changed: ${row.name} has ${result.balance.toLocaleString()} coins.`
          : `${result.applied > 0 ? "Added" : "Took"} ${Math.abs(result.applied).toLocaleString()} coins ${result.applied > 0 ? "to" : "from"} ${row.name}. Balance: ${result.balance.toLocaleString()}.`,
      );
    } catch (error) {
      this.fail(error);
      buttons.forEach((b) => b.isConnected && (b.disabled = false));
    }
  }
  private async change(event: Event) {
    const select = event.target as HTMLSelectElement;
    if (select.dataset.act !== "grant" || !select.value) return;
    const row = this.row(select);
    if (!row) return;
    if (select.value === "__new") {
      this.view.pending = `newtitle:${row.id}`;
      return this.redraw();
    }
    const titleId = select.value;
    const name = this.titles.find((t) => t.id === titleId)?.name ?? "Title";
    await this.act(
      select,
      () =>
        this.hooks.api("/api/admin/grants", {
          playerId: row.id,
          titleId,
          grant: true,
        }),
      `“${name}” granted to ${row.name}.`,
    );
  }

  private input(event: Event) {
    const field = event.target as HTMLInputElement;
    const announce = field.closest<HTMLFormElement>(
      'form[data-form="announce"]',
    );
    if (announce) {
      this.readDraft(announce);
      const count = announce.querySelector("[data-count]");
      if (count) count.textContent = `${this.draft.message.length} / 300`;
      const preview = document.querySelector("#adm-root [data-preview]");
      if (preview)
        preview.textContent = this.draft.message.trim() || "Your message";
      return;
    }
    if (!field.matches("[data-confirm-name]")) return;
    const row = this.row(field);
    const confirm = field
      .closest(".admin-confirm")
      ?.querySelector<HTMLButtonElement>("[data-confirm]");
    if (confirm && row) confirm.disabled = field.value.trim() !== row.name;
  }

  private async submit(event: SubmitEvent) {
    event.preventDefault();
    const form = event.target as HTMLFormElement;
    const fields = new FormData(form);
    const kind = form.dataset.form;
    if (kind === "search" || kind === "find") {
      const search = String(fields.get("search") ?? "").trim();
      return void this.show({
        tab: "players",
        search,
        offset: 0,
        open: UUID.test(search) ? search : null,
        pending: null,
      });
    }
    if (kind === "coins") return this.coins(form, event.submitter);
    if (kind === "announce") {
      this.readDraft(form);
      if (this.draft.message.length < 3)
        return this.say("Write 3 characters or more.", true);
      this.view.pending = "announce";
      return this.redraw();
    }
    if (kind !== "title") return;
    const submit = form.querySelector<HTMLButtonElement>(
      "button:not([type=button])",
    );
    const name = String(fields.get("name") ?? "").trim();
    const color = String(fields.get("color") ?? "#ffe58f");
    const existing = this.titles.find((t) => t.id === form.dataset.id);
    const save = () =>
      this.hooks.api("/api/admin/titles", {
        id: existing?.id ?? null,
        name,
        description:
          String(fields.get("description") ?? "").trim() ||
          existing?.description ||
          "An arena honor awarded by an administrator.",
        color,
        active: existing?.active ?? true,
      }) as Promise<string>;
    if (form.dataset.mode === "grant") {
      const row = this.row(form);
      if (!row) return;
      return this.act(
        submit,
        async () => {
          const titleId = await save();
          await this.hooks.api("/api/admin/grants", {
            playerId: row.id,
            titleId,
            grant: true,
          });
        },
        `Created “${name}” and granted it to ${row.name}.`,
      );
    }
    return this.act(
      submit,
      save,
      existing ? `“${name}” saved.` : `Title “${name}” created.`,
    );
  }
}

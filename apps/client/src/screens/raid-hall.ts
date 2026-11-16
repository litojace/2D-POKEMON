import type {
  RaidAttack,
  RaidBossId,
} from "../../../../packages/shared/src/raid";
import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import { enter, whenSettled } from "../ui/motion";
import {
  raidMarkup,
  raidView,
  startState,
  type RaidData,
  type RaidFilter,
  type RaidTab,
  type RaidView,
} from "./raid-hall-view";
import "./raid-hall.css";
import "./spire.css";
import { spireStartState, type SpireTab } from "./spire-view";

/**
 * Raids' behaviour (UI remodel step 5). Markup comes from raid-hall-view.ts.
 * It opens inside the Lobby as a panel (openHubPanel): the boss list, and a
 * boss's page with its art on the stage. Start raid goes through the game's
 * own room calls (hooks.start); Invite asks the server to invite
 * a friend to your Lobby party, and the page shows its answer.
 */
export interface RaidHooks {
  data(): RaidData;
  start(boss: RaidBossId, o: { solo?: boolean; returnTab: RaidTab }): void;
  /** Start a Spire climb (a raid room the party follows you into). */
  startSpire?(o: { solo?: boolean; returnTab: SpireTab; zone: number }): void;
  /** Invite a friend to your Lobby party; resolves with the server's answer. */
  invite(id: string): Promise<{ ok: boolean; error?: string }>;
  /** Friends (to invite from somewhere else), the Wardrobe (to wear rewards). */
  friends(): void;
  wardrobe(): void;
  onClose?(): void;
}
export interface RaidScreen {
  refresh(): void;
  /** Show a boss's page (or the hall) on a tab. */
  show(boss?: RaidBossId, tab?: RaidTab): void;
  /** Show the Spire's page on a tab. */
  showSpire(tab?: SpireTab): void;
  close(): void;
  readonly isOpen: boolean;
  readonly view: RaidView;
}

const FOCUS_KEYS = [
  "data-raid-card",
  "data-raid-spire",
  "data-ui-spire-tab",
  "data-ui-spire-zone",
  "data-ui-raid-filter",
  "data-ui-raid-tab",
  "data-ui-raid-play",
  "data-raid-attack",
  "data-raid-invite",
  "data-raid-open-seat",
  "data-raid-back",
  "data-raid-start",
];

export function openRaids(
  hooks: RaidHooks,
  o: { boss?: RaidBossId; tab?: RaidTab; spire?: SpireTab } = {},
): RaidScreen {
  const view = raidView(o.boss ?? "grumblecrag", {
    mode: o.spire ? "spire" : o.boss ? "boss" : "hall",
    tab: o.tab ?? "party",
    spireTab: o.spire,
  });
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  let navigation: Animation[] = [];
  let hallScroll = 0;
  const root = () => panel.root;
  const q = <T extends HTMLElement>(s: string) => root().querySelector<T>(s);

  const focusKey = () => {
    const el = document.activeElement;
    if (!el || !root().contains(el)) return "";
    const target = el.closest(FOCUS_KEYS.map((k) => `[${k}]`).join(","));
    if (!target) return "";
    const key = FOCUS_KEYS.find((k) => target.hasAttribute(k))!;
    return `[${key}="${CSS.escape(target.getAttribute(key)!)}"]`;
  };
  function render(swap = false, direction = 1) {
    if (closed) return;
    const key = focusKey();
    const next = parse(raidMarkup(view, hooks.data()));
    if (swap || next.dataset.raidMode !== template.dataset.raidMode) {
      for (const animation of navigation) animation.cancel();
      navigation = [];
      // Hall ⇄ boss page, another boss or another tab: swap the insides whole.
      for (const a of Array.from(root().attributes))
        if (!["tabindex", "data-graphics"].includes(a.name))
          root().removeAttribute(a.name);
      for (const a of Array.from(next.attributes))
        root().setAttribute(a.name, a.value);
      root().replaceChildren(...Array.from(next.cloneNode(true).childNodes));
      q<HTMLElement>("[data-raid-region=body]")?.scrollTo({ top: 0 });
      // Apply navigation immediately; only its presentation glides. Back
      // travels in the opposite direction. Shared motion respects reduced
      // motion and Low graphics, with no delayed clicks or snapshot overlays.
      for (const child of Array.from(root().children)) {
        const animation = enter(
          child,
          {
            opacity: 0,
            transform: `translateX(${direction * 24}px)`,
          },
          { duration: 260 },
        );
        if (animation) navigation.push(animation);
      }
    } else patch(root(), template, next);
    template = next;
    const active = document.activeElement as HTMLButtonElement | null;
    if (key && (!active?.matches(key) || active.disabled))
      (
        q<HTMLElement>(`${key}:not([disabled])`) ??
        q<HTMLElement>('[role="tab"][aria-selected="true"]') ??
        q<HTMLElement>(".ui-chip[aria-pressed=true]") ??
        root()
      ).focus({ preventScroll: true });
  }
  const openBoss = (boss: RaidBossId, tab: RaidTab = "party") => {
    if (view.mode === "hall")
      hallScroll = q<HTMLElement>(".rh-grid")?.scrollLeft ?? 0;
    view.mode = "boss";
    view.boss = boss;
    view.tab = tab;
    view.attack = null;
    view.reward = null;
    view.status = "";
    render(true);
    q<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({
      preventScroll: true,
    });
  };
  const openSpire = (tab: SpireTab = "climb") => {
    if (view.mode === "hall")
      hallScroll = q<HTMLElement>(".rh-grid")?.scrollLeft ?? 0;
    view.mode = "spire";
    view.spireTab = tab;
    view.status = "";
    render(true);
    q<HTMLElement>('[role="tab"][aria-selected="true"]')?.focus({
      preventScroll: true,
    });
  };
  const toHall = () => {
    const from = view.mode === "spire" ? "spire" : view.boss;
    view.mode = "hall";
    view.status = "";
    render(true, -1);
    q<HTMLElement>(".rh-grid")?.scrollTo({ left: hallScroll });
    // Back on the card you came from, scrolled into view.
    const card = q<HTMLElement>(
      from === "spire" ? "[data-raid-spire]" : `[data-raid-card="${from}"]`,
    );
    card?.scrollIntoView({ block: "nearest" });
    card?.focus({ preventScroll: true });
  };
  const start = (solo: boolean) => {
    if (view.mode === "spire") {
      const s = spireStartState(view, hooks.data());
      if (!s.ok || !hooks.startSpire) return;
      panel.close();
      hooks.startSpire({
        solo,
        returnTab: view.spireTab ?? "climb",
        zone: s.zone,
      });
      return;
    }
    const s = startState(view, hooks.data());
    if (!s.ok) return;
    panel.close();
    hooks.start(view.boss, { solo, returnTab: view.tab });
  };
  async function invite(id: string) {
    view.invited = [...view.invited, id];
    view.status = "";
    render();
    const reply = await hooks
      .invite(id)
      .catch(() => ({ ok: false, error: "Couldn't send this invitation." }));
    if (closed) return;
    if (!reply.ok) {
      view.invited = view.invited.filter((f) => f !== id);
      view.status = reply.error ?? "Couldn't send this invitation.";
    }
    render();
  }

  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root().contains(t) || t.disabled) return;
    const d = t.dataset;
    if (d.raidCard) openBoss(d.raidCard as RaidBossId);
    else if (d.raidSpire !== undefined) openSpire();
    else if (d.uiSpireTab) {
      const tabs: SpireTab[] = ["climb", "floors", "blessings"];
      const direction =
        tabs.indexOf(d.uiSpireTab as SpireTab) <
        tabs.indexOf(view.spireTab ?? "climb")
          ? -1
          : 1;
      view.spireTab = d.uiSpireTab as SpireTab;
      // Only the tab's contents change: patch them in and glide them, not
      // the whole column. (Gliding the column with its scroller inside left
      // a stale band painted over the Floors tab's first rows in Chromium.)
      render();
      const body = q<HTMLElement>("[data-raid-region=body]");
      body?.scrollTo({ top: 0 });
      for (const animation of navigation) animation.cancel();
      navigation = [];
      for (const child of Array.from(body?.children ?? [])) {
        const animation = enter(
          child,
          { opacity: 0, transform: `translateX(${direction * 24}px)` },
          { duration: 260 },
        );
        if (animation) navigation.push(animation);
      }
      q<HTMLElement>(`[data-ui-spire-tab="${view.spireTab}"]`)?.focus({
        preventScroll: true,
      });
    } else if (d.uiSpireZone) {
      // The zone to climb (Climb tab): only an open one is enabled.
      view.spireZone = Number(d.uiSpireZone);
      render();
    } else if (d.uiRaidFilter) {
      view.filter = d.uiRaidFilter as RaidFilter;
      render();
    } else if (d.raidFilter) {
      view.filter = d.raidFilter as RaidFilter;
      render();
    } else if (d.raidBack !== undefined) toHall();
    else if (d.uiRaidTab) {
      const tabs: RaidTab[] = ["party", "attacks", "rewards", "guide"];
      const direction =
        tabs.indexOf(d.uiRaidTab as RaidTab) < tabs.indexOf(view.tab) ? -1 : 1;
      view.tab = d.uiRaidTab as RaidTab;
      view.status = "";
      render(true, direction);
      q<HTMLElement>(`[data-ui-raid-tab="${view.tab}"]`)?.focus({
        preventScroll: true,
      });
    } else if (d.uiRaidPlay) {
      view.play = d.uiRaidPlay as RaidView["play"];
      render();
    } else if (d.raidAttackGo) {
      // The Party tab's attack strip: to the Attacks tab, that attack picked.
      view.tab = "attacks";
      view.attack = d.raidAttackGo as RaidAttack;
      render(true);
      q<HTMLElement>(`[data-raid-attack="${view.attack}"]`)?.focus({
        preventScroll: true,
      });
    } else if (d.raidAttack) {
      view.attack = d.raidAttack as RaidAttack;
      render();
    } else if (d.raidStart) start(d.raidStart === "solo");
    else if (d.raidInvite) void invite(d.raidInvite);
    else if (d.raidOpenSeat !== undefined) {
      // An open seat: to the invite list (or Friends, with nobody online).
      const first = q<HTMLButtonElement>(
        "[data-raid-invite]:not([disabled]), [data-raid-friends]",
      );
      first?.scrollIntoView({ block: "nearest" });
      first?.focus();
    } else if (d.raidFriends !== undefined) {
      panel.close();
      hooks.friends();
    } else if (d.raidWardrobe !== undefined) {
      panel.close();
      hooks.wardrobe();
    } else if (d.raidReward) {
      // A reward opens to its whole rule; again (or another one) closes it.
      view.reward = view.reward === d.raidReward ? null : d.raidReward;
      render();
      q<HTMLElement>(`[data-raid-reward="${d.raidReward}"]`)?.focus({
        preventScroll: true,
      });
    }
  };
  // Arrows: across the boss cards (a grid), the filters, the tabs and the
  // attacks. Tabs follow focus; cards open with Enter or a click.
  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    const step = (
      {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      } as Record<string, [number, number]>
    )[event.key];
    if (!step) return;
    const group = t.closest<HTMLElement>(
      ".ui-tabs, .ui-seg, .ui-chips, .rh-grid, .rh-attacks, .rh-strip, .sp-zones",
    );
    if (!group || !root().contains(group)) return;
    const items = Array.from(
      group.querySelectorAll<HTMLElement>(":scope > button"),
    ).filter((b) => !(b as HTMLButtonElement).disabled);
    const i = items.indexOf(t.closest(":scope > button") ?? t);
    if (i < 0) return;
    let cols = items.length;
    if (group.classList.contains("rh-grid"))
      cols = getComputedStyle(group).gridTemplateColumns.split(" ").length;
    else if (
      group.classList.contains("rh-attacks") ||
      group.classList.contains("rh-strip")
    )
      cols = getComputedStyle(group).gridTemplateColumns.split(" ").length;
    else if (step[1]) return;
    const next = items[i + step[0] + step[1] * cols];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (next.matches('[role="tab"], [data-raid-attack]')) next.click();
  };

  const html = raidMarkup(view, hooks.data());
  template = parse(html);
  panel = openHubPanel(html, {
    rail: "raids",
    onClose: () => {
      closed = true;
      for (const animation of navigation) animation.cancel();
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("keydown", onKey);
  (o.boss
    ? q<HTMLElement>('[role="tab"][aria-selected="true"]')
    : q<HTMLElement>("[data-raid-card]")
  )?.focus({ preventScroll: true });
  let refreshing = false;
  return {
    // Fresh data that lands while the panel slides in waits for it to
    // settle (one redraw, not one per answer).
    refresh: () => {
      if (refreshing) return;
      refreshing = true;
      whenSettled(panel.root, () => {
        refreshing = false;
        render();
      });
    },
    show: (boss, tab) => {
      if (boss) openBoss(boss, tab ?? "party");
      else toHall();
    },
    showSpire: (tab) => openSpire(tab ?? "climb"),
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}

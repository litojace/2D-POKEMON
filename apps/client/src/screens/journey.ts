import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import {
  defaultPick,
  journeyMarkup,
  journeyView,
  type JourneyData,
  type JourneyTab,
  type JourneyView,
} from "./journey-view";
import "./journey.css";

/**
 * The Journey's behaviour (UI remodel step 4). Markup comes from
 * journey-view.ts. It opens inside the Lobby as a panel (openHubPanel).
 * Picking a reward shows it in the action bar; Equip wears it (the shared
 * appearance route, /api/raids/equip); Wardrobe opens the fitting room.
 * The arcade tab's buttons start this week's arcade.
 */
export interface JourneyHooks {
  data(): JourneyData;
  /** Wear a journey reward you own; resolves once the server answered. */
  equip(item: string): Promise<void>;
  /** The fitting room's Wardrobe. */
  wardrobe(): void;
  /** Start this week's arcade: "arcade-bot", "arcade-duel" or "arcade-teams". */
  play(mode: string): void;
  onClose?(): void;
}
export interface JourneyScreen {
  refresh(): void;
  close(): void;
  readonly isOpen: boolean;
  readonly view: JourneyView;
}

const TICK_MS = 30_000;
const FOCUS_KEYS = [
  "data-ui-jtab",
  "data-journey-item",
  "data-journey-equip",
  "data-journey-wardrobe",
  "data-journey-play",
];

export function openJourney(
  hooks: JourneyHooks,
  o: { tab?: JourneyTab } = {},
): JourneyScreen {
  const view = journeyView(o.tab);
  view.selected = defaultPick(view.tab, hooks.data().economy);
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  /** Did you pick a reward yourself? If not, fresh data picks the next one. */
  let picked = false;
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
  /** Bring the next tier (or the picked one) into the road's view. */
  function showRoadTier(smooth = false) {
    const road = q<HTMLElement>("[data-journey-road]");
    const tile =
      road?.querySelector<HTMLElement>(".journey-tier.is-next") ??
      Array.from(
        road?.querySelectorAll<HTMLElement>(".journey-tier.is-got") ?? [],
      ).pop();
    if (!road || !tile) return;
    const left =
      tile.getBoundingClientRect().left -
      road.getBoundingClientRect().left +
      road.scrollLeft -
      (road.clientWidth - tile.offsetWidth) / 2;
    road.scrollTo({
      left: Math.max(0, left),
      behavior:
        smooth && !matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "smooth"
          : "auto",
    });
  }
  function render(newTab = false) {
    if (closed) return;
    const key = focusKey();
    const next = parse(journeyMarkup(view, hooks.data()));
    if (newTab) {
      // Another tab is another layout: swap the panel's insides whole.
      for (const a of Array.from(next.attributes))
        root().setAttribute(a.name, a.value);
      root().replaceChildren(...Array.from(next.cloneNode(true).childNodes));
      q<HTMLElement>("[data-journey-region=body]")?.scrollTo({ top: 0 });
      showRoadTier();
    } else patch(root(), template, next);
    template = next;
    const active = document.activeElement as HTMLButtonElement | null;
    if (key && (!active?.matches(key) || active.disabled))
      (
        q<HTMLElement>(`${key}:not([disabled])`) ??
        q<HTMLElement>('[role="tab"][aria-selected="true"]')
      )?.focus({
        preventScroll: true,
      });
  }
  const setTab = (tab: JourneyTab) => {
    if (tab === view.tab) return;
    view.tab = tab;
    view.status = "";
    picked = false;
    if (tab !== "arcade")
      view.selected = defaultPick(tab, hooks.data().economy);
    render(true);
  };
  async function equip(item: string) {
    if (view.equipping) return;
    view.equipping = item;
    view.status = "";
    render();
    try {
      await hooks.equip(item);
    } catch (error) {
      view.status =
        error instanceof Error ? error.message : "Could not equip that reward.";
    }
    view.equipping = null;
    render();
  }

  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root().contains(t) || t.disabled) return;
    const d = t.dataset;
    if (d.uiJtab) setTab(d.uiJtab as JourneyTab);
    else if (d.journeyItem) {
      view.selected = d.journeyItem;
      picked = true;
      view.status = "";
      render();
    } else if (d.journeyEquip) void equip(d.journeyEquip);
    else if (d.journeyWardrobe !== undefined) {
      panel.close();
      hooks.wardrobe();
    } else if (d.journeyPlay) {
      panel.close();
      hooks.play(d.journeyPlay);
    }
  };
  // Arrows: through the tabs (focus picks), along the season road, and
  // across the level rewards.
  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    const step = (
      { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -1, ArrowDown: 1 } as Record<
        string,
        number
      >
    )[event.key];
    if (!step) return;
    const vertical = event.key === "ArrowUp" || event.key === "ArrowDown";
    let items: HTMLElement[] = [];
    if (t.matches('[role="tab"]') && !vertical)
      items = Array.from(root().querySelectorAll('[role="tab"]'));
    else if (
      t.closest("[data-journey-road]") &&
      t.matches("button") &&
      !vertical
    )
      items = Array.from(root().querySelectorAll("[data-journey-road] button"));
    else if (t.closest(".journey-prizes") && t.matches("button"))
      items = Array.from(root().querySelectorAll(".journey-prizes button"));
    else if (t.closest(".journey-levelroad") && t.matches("button") && vertical)
      items = Array.from(root().querySelectorAll(".journey-levelroad button"));
    const i = items.indexOf(t);
    const next = i < 0 ? undefined : items[i + step];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.scrollIntoView({ block: "nearest", inline: "nearest" });
    if (next.matches('[role="tab"]')) next.click();
  };

  const html = journeyMarkup(view, hooks.data());
  template = parse(html);
  const tick = setInterval(() => render(), TICK_MS);
  panel = openHubPanel(html, {
    rail: "journey",
    onClose: () => {
      closed = true;
      clearInterval(tick);
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("keydown", onKey);
  showRoadTier();
  return {
    refresh: () => {
      // Fresh data picks the next reward to earn, unless you picked one.
      if (!picked && view.tab !== "arcade")
        view.selected = defaultPick(view.tab, hooks.data().economy);
      const wasEmpty = !template.querySelector(".journey-tier.is-got");
      render();
      if (wasEmpty) showRoadTier();
    },
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}

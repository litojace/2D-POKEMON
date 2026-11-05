import type { CharacterId } from "@arena/shared";
import { lowGraphics } from "../graphics-quality";
import type { ShopPreviewHandle } from "../shop-preview";
import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import {
  rosterMarkup,
  rosterOrder,
  rosterView,
  stepFighter,
  type RosterData,
  type RosterRange,
  type RosterSort,
  type RosterTab,
  type RosterView,
} from "./roster-view";
import "./roster.css";

/**
 * The roster's behaviour (UI remodel step 3). Markup comes from
 * roster-view.ts. It opens inside the Lobby (openHubPanel): the grid of
 * fighters with filters and sort, and a fighter's detail on the stage with
 * the live rig ("selection" framing; a still fighter on Low graphics).
 * Select makes the fighter your Lobby fighter; Try skins opens the fitting
 * room on that fighter.
 */
export interface RosterHooks {
  data(): Omit<RosterData, "low">;
  /** Make this fighter your Lobby fighter. */
  choose(c: CharacterId): void;
  /** The fitting room on this fighter's skins. */
  skins(c: CharacterId): void;
  /** In a room: Ready (or Cancel ready) with the fighter shown. */
  ready?(c: CharacterId): void;
  /** In a room: the corner button leaves the room. */
  leave?(): void;
  onClose?(): void;
}
export interface RosterScreen {
  refresh(): void;
  close(): void;
  readonly isOpen: boolean;
  readonly view: RosterView;
}

const FOCUS_KEYS = [
  "data-roster-card",
  "data-roster-element",
  "data-roster-range",
  "data-roster-sort",
  "data-roster-skill",
  "data-ui-rtab",
  "data-roster-step",
  "data-roster-details",
  "data-roster-select",
  "data-roster-ready",
  "data-roster-back",
  "data-roster-reset",
];

export function openRoster(
  hooks: RosterHooks,
  o: {
    focus?: CharacterId;
    mode?: "grid" | "detail";
    /** A room's picker (UI remodel step 5): mounted in the room, it stays
     * open there; Lock in and Ready act without closing it. */
    room?: { host: HTMLElement };
  } = {},
): RosterScreen {
  const low = lowGraphics();
  const data = (): RosterData => ({ ...hooks.data(), low });
  const view = rosterView(o.focus ?? hooks.data().playing, {
    mode: o.mode ?? "grid",
  });
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  let preview: ShopPreviewHandle | undefined;
  let importing = false;
  let host: Element | null = null;
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
  function render(resetScroll = false) {
    if (closed) return;
    const key = focusKey();
    const next = parse(rosterMarkup(view, data()));
    // The grid and the detail are different layouts: swap the whole panel
    // between them, patch in place within one.
    if (next.dataset.rosterMode !== template.dataset.rosterMode) {
      for (const name of Array.from(root().attributes))
        if (!["tabindex", "data-graphics"].includes(name.name))
          root().removeAttribute(name.name);
      for (const name of Array.from(next.attributes))
        root().setAttribute(name.name, name.value);
      root().replaceChildren(...Array.from(next.cloneNode(true).childNodes));
    } else
      // The rig stage holds the preview's canvas: swap it whole when its
      // fighter changes, so the preview is re-attached (afterRender).
      patch(
        root(),
        template,
        next,
        ".shop-live-stage, .raid-cosmetic-preview, .fighter-rig-stage",
      );
    template = next;
    if (resetScroll)
      q<HTMLElement>("[data-roster-region=body]")?.scrollTo({ top: 0 });
    // Focus stays on the control it was on (a reorder can move a card), or
    // goes to the picked card, then the next action, never to the page.
    const active = document.activeElement as HTMLButtonElement | null;
    if (key && (!active?.matches(key) || active.disabled)) {
      const same = q<HTMLButtonElement>(key);
      (same && !same.disabled
        ? same
        : (q<HTMLElement>('.roster-card[aria-pressed="true"]') ??
          q<HTMLElement>(".ui-panel-foot .ui-btn:not([disabled])") ??
          root())
      ).focus({ preventScroll: true });
    }
    afterRender();
  }
  /** One live rig, on the detail's stage only (a still fighter on Low). */
  function afterRender() {
    const stage = q<HTMLElement>("[data-roster-region=stage]");
    const rig = stage?.querySelector(".fighter-rig-stage") ?? null;
    if (low) return;
    if (!stage) {
      preview?.suspend(true);
      return;
    }
    if (preview) {
      if (rig !== host) preview.update(stage, "selection");
      host = rig;
      preview.suspend(false);
    } else if (!importing) {
      importing = true;
      void import("../shop-preview")
        .then(({ mountShopPreview }) => {
          const now = q<HTMLElement>("[data-roster-region=stage]");
          if (closed) return;
          if (now) {
            preview = mountShopPreview(now, "selection");
            host = now.querySelector(".fighter-rig-stage");
          } else importing = false;
        })
        .catch(() => {
          // The still fighter stays.
        });
    }
  }

  /** A filter hid the picked fighter: pick the first one shown. */
  const keepPick = () => {
    const shown = rosterOrder(view, data());
    if (shown.length && !shown.includes(view.focus)) view.focus = shown[0];
  };
  const select = (c: CharacterId) => {
    hooks.choose(c);
    if (o.room) render();
    else panel.close();
  };
  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLElement>("button");
    if (!t || !root().contains(t) || (t as HTMLButtonElement).disabled) return;
    const d = t.dataset;
    let scroll = false;
    if (d.rosterCard) {
      const c = d.rosterCard as CharacterId;
      // A second click or tap on the picked card opens its detail.
      if (view.focus === c) {
        view.mode = "detail";
        scroll = true;
      }
      view.focus = c;
    } else if (d.rosterElement) {
      view.element = d.rosterElement;
      keepPick();
    } else if (d.rosterRange) {
      view.range = d.rosterRange as RosterRange;
      keepPick();
    } else if (d.rosterReset !== undefined) {
      view.element = "All";
      view.range = "any";
    } else if (d.rosterDetails) {
      view.mode = "detail";
      view.focus = d.rosterDetails as CharacterId;
      view.skill = 0;
      scroll = true;
    } else if (d.rosterBack !== undefined) {
      view.mode = "grid";
      scroll = true;
    } else if (d.rosterStep) {
      view.focus = stepFighter(view, data(), Number(d.rosterStep));
      view.skill = 0;
    } else if (d.uiRtab) {
      view.tab = d.uiRtab as RosterTab;
      scroll = true;
    } else if (d.rosterSkill)
      view.skill = d.rosterSkill === "basic" ? "basic" : Number(d.rosterSkill);
    else if (d.rosterSelect) return select(d.rosterSelect as CharacterId);
    else if (d.rosterReady) return hooks.ready?.(d.rosterReady as CharacterId);
    else if (d.rosterLeave !== undefined) return hooks.leave?.();
    else if (d.rosterSkins) {
      const c = d.rosterSkins as CharacterId;
      panel.close();
      hooks.skins(c);
      return;
    } else return;
    render(scroll);
  };
  const onChange = (event: Event) => {
    const t = event.target as HTMLSelectElement;
    if (!t.matches("[data-roster-sort]")) return;
    view.sort = t.value as RosterSort;
    render();
  };
  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    // In the detail, ‹ › (and [ ]) step through fighters from anywhere.
    if (
      view.mode === "detail" &&
      !t.closest(".ui-tabs, .roster-skills, select") &&
      (event.key === "[" || event.key === "]")
    ) {
      event.preventDefault();
      view.focus = stepFighter(view, data(), event.key === "]" ? 1 : -1);
      view.skill = 0;
      render();
      return;
    }
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
      ".ui-tabs, .ui-seg, .ui-chips, .ui-grid, .roster-skills",
    );
    if (!group || !root().contains(group)) return;
    const items = Array.from(
      group.querySelectorAll<HTMLElement>(":scope > button"),
    ).filter((b) => !(b as HTMLButtonElement).disabled);
    const i = items.indexOf(t.closest(":scope > button") ?? t);
    if (i < 0) return;
    let cols = items.length;
    if (group.classList.contains("ui-grid"))
      cols = getComputedStyle(group).gridTemplateColumns.split(" ").length;
    else if (group.classList.contains("roster-skills")) cols = 1;
    else if (step[1]) return;
    const next = items[i + step[0] + step[1] * cols];
    if (!next) return;
    event.preventDefault();
    next.focus();
    // Tabs, cards and skills follow focus.
    if (next.matches('[role="tab"], [data-roster-card], [data-roster-skill]'))
      next.click();
  };
  // Enter on a picked card opens its detail (a second click does too).
  const onKeyCard = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    if (event.key !== "Enter" || !t.matches("[data-roster-card]")) return;
    const c = t.dataset.rosterCard as CharacterId;
    if (view.focus !== c) return;
    event.preventDefault();
    view.mode = "detail";
    view.skill = 0;
    render(true);
  };

  const html = rosterMarkup(view, data());
  template = parse(html);
  panel = openHubPanel(html, {
    rail: o.room ? undefined : "fighters",
    host: o.room?.host,
    // In a room, Escape goes back from a fighter's detail to the grid; the
    // picker itself stays (leaving the room is the corner button).
    escape: o.room
      ? () => {
          if (view.mode !== "detail") return;
          view.mode = "grid";
          render(true);
          q<HTMLElement>(`[data-roster-card="${view.focus}"]`)?.focus({
            preventScroll: true,
          });
        }
      : undefined,
    onClose: () => {
      closed = true;
      preview?.();
      preview = undefined;
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("change", onChange);
  root().addEventListener("keydown", onKeyCard);
  root().addEventListener("keydown", onKey);
  afterRender();
  // Keep the picked card in view (a filter or sort can move it).
  q<HTMLElement>(`[data-roster-card="${view.focus}"]`)?.focus({
    preventScroll: true,
  });
  return {
    refresh: () => render(),
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}

import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import {
  ranksMarkup,
  ranksView,
  type RanksData,
  type RanksScope,
  type RanksView,
} from "./ranks-view";
import "./ranks.css";

/**
 * The Ranks panel's behaviour (UI remodel step 6). Markup comes from
 * ranks-view.ts. Road / Everyone / Friends switches what the right side
 * shows (Friends loads the first time it is picked); the season's countdown
 * is redrawn every 30 s on the server's clock.
 */
/** The two boards the server answers (the road needs neither). */
export type BoardScope = Exclude<RanksScope, "road">;
export interface RanksHooks {
  data(): RanksData;
  /** Load (or reload) a board; resolves once data() has it. */
  load(scope: BoardScope): Promise<void>;
  friends(): void;
  /** Report another player's own picture (asks first). */
  reportPhoto?(photo: string, name: string): void;
  onClose?(): void;
}
export interface RanksScreen {
  refresh(): void;
  close(): void;
  readonly isOpen: boolean;
  readonly view: RanksView;
}

const TICK_MS = 30_000;

export function openRanks(hooks: RanksHooks): RanksScreen {
  const view = ranksView();
  let template: HTMLElement;
  let panel: HubPanel;
  let closed = false;
  const root = () => panel.root;

  function render() {
    if (closed) return;
    const next = parse(ranksMarkup(view, hooks.data()));
    patch(root(), template, next);
    template = next;
  }
  async function load(scope: BoardScope) {
    await hooks.load(scope);
    render();
  }
  function pick(scope: RanksScope) {
    if (view.scope === scope) return;
    view.scope = scope;
    render();
    root()
      .querySelector<HTMLElement>("[data-ranks-list], [data-ranks-road]")
      ?.scrollTo({ top: 0 });
    // Shown at once on the copy it has (warmed at startup), and asked for
    // again behind it; redrawn only where the answer changed.
    if (scope === "friends") void load("friends");
  }

  const onClick = (event: MouseEvent) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root().contains(t) || t.disabled) return;
    const d = t.dataset;
    if (d.uiScope) pick(d.uiScope as RanksScope);
    else if (d.ranksRetry !== undefined)
      void load(view.scope === "friends" ? "friends" : "everyone");
    else if (d.ranksReportPhoto)
      hooks.reportPhoto?.(d.ranksReportPhoto, d.ranksReportName ?? "");
    else if (d.ranksFriends !== undefined) {
      panel.close();
      hooks.friends();
    }
  };
  // Left / right move along Road / Everyone / Friends and pick.
  const onKey = (event: KeyboardEvent) => {
    const t = event.target as HTMLElement;
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    if (!t.matches(".ui-seg > button")) return;
    const items = Array.from(
      t.parentElement!.querySelectorAll<HTMLButtonElement>(":scope > button"),
    );
    const next =
      items[
        items.indexOf(t as HTMLButtonElement) +
          (event.key === "ArrowRight" ? 1 : -1)
      ];
    if (!next) return;
    event.preventDefault();
    next.focus();
    next.click();
  };

  const html = ranksMarkup(view, hooks.data());
  template = parse(html);
  const tick = setInterval(render, TICK_MS);
  panel = openHubPanel(html, {
    rail: "ranks",
    onClose: () => {
      closed = true;
      clearInterval(tick);
      hooks.onClose?.();
    },
  });
  root().addEventListener("click", onClick);
  root().addEventListener("keydown", onKey);
  root()
    .querySelector<HTMLElement>('.ui-seg > [aria-pressed="true"]')
    ?.focus({ preventScroll: true });
  return {
    refresh: render,
    close: () => panel.close(),
    get isOpen() {
      return !closed;
    },
    get view() {
      return view;
    },
  };
}

/**
 * Getting started's behaviour (rules and markup: getting-started.ts). It
 * keeps the account's saved progress, folds in what the account shows, opens
 * the sheet inside the Lobby (openHubPanel) and tells the player when a step
 * is done.
 */
import { openHubPanel, type HubPanel } from "./ui/hub-panel";
import {
  GUIDE_STEPS,
  guideMarkup,
  guideView,
  loadGuide,
  saveGuide,
  settleGuide,
  type GuideFacts,
  type GuideSave,
  type GuideStep,
  type GuideView,
} from "./getting-started";
import type { Feature } from "./feature-unlocks";

export interface GuideHooks {
  account(): string | undefined;
  facts(): GuideFacts;
  /** Do a step (play a bot match, open Raids, the Wardrobe, a scene). */
  go(step: GuideStep): void;
  /** The Lobby card follows. */
  changed(): void;
  toast(text: string): void;
  /** Steps whose feature is still locked at the player's level. */
  locks?(): Partial<Record<GuideStep, Feature>>;
}

export function createGuide(hooks: GuideHooks) {
  let owner: string | undefined;
  let save: GuideSave = { done: {} };
  let panel: HubPanel | undefined;

  const store = (next: GuideSave) => {
    const before = guideView(save),
      was = save.started;
    save = next;
    saveGuide(owner, save);
    const after = guideView(save);
    // Only a guide the player has seen says so (an old account's facts
    // folding in on the first look stay quiet).
    if (was && after.count > before.count)
      hooks.toast(
        after.next === null
          ? "Getting started complete. You're all set!"
          : `Getting started · ${after.count} of ${GUIDE_STEPS.length} done`,
      );
    panel?.update(guideMarkup(after, hooks.locks?.()));
  };
  /** The current view, after the account's facts. */
  const view = (): GuideView => {
    const id = hooks.account();
    if (id !== owner) {
      owner = id;
      save = loadGuide(id);
    }
    if (!owner) return guideView({ done: {} });
    const next = settleGuide(save, hooks.facts());
    if (JSON.stringify(next) !== JSON.stringify(save)) store(next);
    return guideView(save);
  };
  const mark = (step: GuideStep) => {
    view();
    if (!owner || save.done[step]) return;
    store({ ...save, done: { ...save.done, [step]: true } });
    hooks.changed();
  };
  const setHidden = (hidden: boolean) => {
    view();
    if (!owner) return;
    store({ ...save, hidden, started: save.started || !hidden });
    hooks.changed();
  };
  const onClick = (event: Event) => {
    const t = (event.target as Element).closest<HTMLElement>(
      "[data-guide-go], [data-guide-hide], [data-guide-show]",
    );
    if (!t) return;
    if (t.dataset.guideGo) {
      panel?.close();
      hooks.go(t.dataset.guideGo as GuideStep);
    } else setHidden(t.dataset.guideHide !== undefined);
  };
  const open = () => {
    panel?.close();
    const p = openHubPanel(guideMarkup(view(), hooks.locks?.()), {
      onClose: () => {
        if (panel === p) panel = undefined;
      },
    });
    panel = p;
    p.root.addEventListener("click", onClick);
  };
  return {
    view,
    mark,
    open,
    /** Settings → Help → Getting started: back on the Lobby, and open. */
    reopen() {
      setHidden(false);
      open();
    },
  };
}

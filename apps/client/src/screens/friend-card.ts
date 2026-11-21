/**
 * A friend's player card (docs/match-history.md): the card they show
 * (avatar in their frame, title, name, rank, best mastery), their four
 * numbers and their match history. Read-only; the same panel as your own
 * card (profile-view.ts), so phones get the same layout. It opens from
 * Friends (a friend's options) or from a match board in any history; Back
 * returns to Friends.
 */
import { normalizeCharacterId } from "../../../../packages/shared/src/index";
import type {
  Friend,
  MatchHistory,
  Progress,
} from "../../../../packages/shared/src/accounts";
import type {
  RaidLoadout,
  RaidProgress,
} from "../../../../packages/shared/src/raid";
import type { RaidBossId } from "../../../../packages/shared/src/raid-roster";
import { openHubPanel, type HubPanel } from "../ui/hub-panel";
import { parse, patch } from "../ui/patch";
import { button, esc, panelHead } from "../ui/components";
import { playerCard, profileTiles, type ProfileData } from "./profile-view";
import { historyMarkup, type HistoryState } from "./match-history-view";
import { historyController, type HistoryQuery } from "./match-history";
import "./profile.css";
import "./match-history.css";

export type FriendCardPerson = Pick<
  Friend,
  | "id"
  | "name"
  | "title"
  | "titleColor"
  | "fighter"
  | "avatar"
  | "look"
  | "raidClears"
>;

/** The card's data, as your own card reads it. */
export function friendCardData(
  f: FriendCardPerson,
  h: HistoryState,
): ProfileData {
  const clears = Object.values(f.raidClears ?? {}).reduce((a, b) => a + b, 0);
  const progress: Progress | null = h.totals
    ? {
        matches: h.totals.matches,
        wins: h.totals.wins,
        fighters: h.totals.fighters,
        achievements: [],
        season: { id: "", matches: 0, wins: 0 },
        ...(h.rating ? { rating: h.rating } : {}),
      }
    : null;
  return {
    name: f.name,
    title: f.title ?? null,
    titleColor: f.titleColor ?? null,
    titles: [],
    guest: false,
    role: "",
    fighter: normalizeCharacterId(f.fighter) ?? "voltkit",
    avatar: f.avatar ?? null,
    look: f.look as RaidLoadout | undefined,
    clears: f.raidClears as Partial<Record<RaidBossId, number>> | undefined,
    progress,
    raids: { clears, totalClears: clears } as unknown as RaidProgress,
    nameStatus: null,
    canDelete: false,
  };
}

export function friendCardMarkup(
  f: FriendCardPerson,
  h: HistoryState,
  o: { back: boolean; canOpen?: (id: string) => boolean; now?: number },
) {
  const d = friendCardData(f, h);
  const tiles = `<div class="pf-tiles">${profileTiles(
    h.totals ? d.progress : null,
    d.raids,
  )
    .map(
      (t) =>
        `<div class="pf-tile"><b class="ui-num">${esc(t.value)}</b><small>${esc(t.label)}</small></div>`,
    )
    .join("")}</div>`;
  const tools = o.back
    ? button("Friends", {
        size: "s",
        icon: "back",
        attrs: {
          "data-friend-card-back": true,
          "aria-label": "Back to Friends",
        },
      })
    : "";
  return `<section class="ui-panel profile-panel friend-card-panel" role="dialog" aria-label="${esc(`${f.name}'s player card`)}">${panelHead(f.name, "Friend's card", tools)}<div class="ui-panel-body pf-body">${playerCard(d, `${f.name}'s player card`)}<div class="pf-main" data-profile-main>${tiles}${historyMarkup(h, { whose: `${f.name}'s`, canOpen: o.canOpen, now: o.now })}</div></div></section>`;
}

export interface FriendCardHooks {
  person: FriendCardPerson;
  history(q: HistoryQuery & { player: string }): Promise<MatchHistory>;
  /** Back to Friends (no button when it didn't open from there). */
  back?(): void;
  /** Another friend's card, from a match board. */
  isFriend?(id: string): boolean;
  open?(id: string, name: string): void;
  onClose?(): void;
}
export interface FriendCardScreen {
  close(): void;
  readonly isOpen: boolean;
}

export function openFriendCard(hooks: FriendCardHooks): FriendCardScreen {
  const person = hooks.person;
  let template: HTMLElement;
  let panel: HubPanel | undefined;
  let closed = false;
  const history = historyController(
    (q) => hooks.history({ ...q, player: person.id }),
    () => render(),
    (id, name) => {
      panel?.close();
      hooks.open?.(id, name);
    },
  );
  const markup = () =>
    friendCardMarkup(person, history.state, {
      back: !!hooks.back,
      canOpen: hooks.open
        ? (id) => id !== person.id && !!hooks.isFriend?.(id)
        : undefined,
    });
  function render() {
    if (closed || !panel) return;
    const next = parse(markup());
    patch(panel.root, template, next);
    template = next;
  }
  const html = markup();
  template = parse(html);
  panel = openHubPanel(html, {
    onClose: () => {
      closed = true;
      hooks.onClose?.();
    },
  });
  const root = panel.root;
  root.addEventListener("click", (event) => {
    const t = (event.target as Element).closest<HTMLButtonElement>("button");
    if (!t || !root.contains(t) || t.disabled) return;
    if (history.click(t)) return;
    if (t.dataset.friendCardBack !== undefined) {
      panel?.close();
      hooks.back?.();
    }
  });
  history.ensure();
  return {
    close: () => panel?.close(),
    get isOpen() {
      return !closed;
    },
  };
}

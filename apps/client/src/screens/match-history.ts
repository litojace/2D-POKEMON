/**
 * Match history's behaviour (docs/match-history.md), shared by your player
 * card and a friend's: loads the first page when asked, the next one on
 * More, starts again on a filter, opens one match's board at a time.
 * Markup comes from match-history-view.ts.
 */
import type {
  MatchHistory,
  MatchHistoryKind,
} from "../../../../packages/shared/src/accounts";
import { historyState, type HistoryState } from "./match-history-view";

export interface HistoryQuery {
  kind: MatchHistoryKind;
  at?: string;
  id?: string;
}
export interface HistoryController {
  readonly state: HistoryState;
  /** Load the first page unless it's loaded or loading. */
  ensure(): void;
  /** A tap inside the panel: true when it was one of history's. */
  click(t: HTMLElement): boolean;
}

export function historyController(
  load: (q: HistoryQuery) => Promise<MatchHistory>,
  render: () => void,
  openPlayer?: (id: string, name: string) => void,
): HistoryController {
  const state = historyState();
  // Answers for an older filter (or an older first page) are dropped.
  let ask = 0;
  async function page(first: boolean) {
    if (state.loading && !first) return;
    const n = ++ask;
    state.loading = true;
    state.problem = "";
    if (first) {
      state.matches = null;
      state.next = null;
      state.open = null;
    }
    render();
    try {
      const got = await load({
        kind: state.kind,
        ...(first || !state.next ? {} : state.next),
      });
      if (n !== ask) return;
      // A match can't show twice (a page that overlaps the one before).
      const seen = new Set((state.matches ?? []).map((m) => m.id));
      state.matches = [
        ...(state.matches ?? []),
        ...got.matches.filter((m) => !seen.has(m.id)),
      ];
      state.next = got.next;
      if (first) {
        state.totals = got.totals;
        state.rating = got.rating;
      }
    } catch (error) {
      if (n !== ask) return;
      state.problem =
        error instanceof Error && error.message
          ? error.message
          : "Couldn't load matches.";
    }
    state.loading = false;
    render();
  }
  return {
    state,
    ensure() {
      if (state.matches === null && !state.loading) void page(true);
    },
    click(t) {
      const d = t.dataset;
      if (d.uiHistoryKind) {
        const kind = d.uiHistoryKind as MatchHistoryKind;
        if (kind !== state.kind) {
          state.kind = kind;
          void page(true);
        }
      } else if (d.historyMatch) {
        state.open = state.open === d.historyMatch ? null : d.historyMatch;
        render();
      } else if (d.historyMore !== undefined) void page(false);
      else if (d.historyRetry !== undefined) void page(true);
      else if (d.historyPlayer && openPlayer)
        openPlayer(d.historyPlayer, d.historyName ?? "");
      else return false;
      return true;
    },
  };
}

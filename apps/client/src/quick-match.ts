/**
 * Quick Match's search sheet (docs/pvp-plan.md, item 1). PLAY in Quick
 * Match queues on the server ("quick-join"); this sheet shows the wait and
 * how many players are online, and after QUICK_MATCH_FALLBACK_MS offers a
 * clearly labelled sparring bot, which starts by itself after
 * QUICK_MATCH_OFFER_MS unless the player keeps searching or cancels.
 *
 * No layout reads: the timer only changes text once a second.
 */
import {
  QUICK_FILL_MS,
  QUICK_MATCH_FALLBACK_MS,
  QUICK_MATCH_OFFER_MS,
  type FillMode,
} from "@arena/shared";
import "./quick-match.css";

export interface QuickSearchOptions {
  /** Players online besides you, from the server's reply. */
  online: number;
  /** Cancel: leave the queue. */
  onCancel(): void;
  /** Take the sparring bot (pressed, or the offer ran out). */
  onBot(): void;
  /** For tests: the waits, in ms. */
  fallbackMs?: number;
  offerMs?: number;
}
export interface QuickSearchHandle {
  /** Paired with a player, or the bot match started: close quietly. */
  close(): void;
  readonly open: boolean;
}

const clock = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};
const onlineText = (n: number) =>
  n <= 0
    ? "No one else is online right now"
    : `${n} other player${n === 1 ? "" : "s"} online`;

/** What a 2v2 or Free-for-all search says (docs/pvp-plan.md, "Bots fill in"). */
export const FILL_SEARCH: Record<FillMode, { kicker: string; label: string }> =
  {
    teams: { kicker: "2v2 Teams", label: "2v2 Teams search" },
    ffa: { kicker: "Free-for-all", label: "Free-for-all search" },
  };
export interface FillSearchOptions {
  mode: FillMode;
  online: number;
  onCancel(): void;
  /** Start with bots in the empty seats (pressed, or the wait ran out). */
  onFill(): void;
  /** For tests: the wait, in ms. */
  fillMs?: number;
}
/**
 * The search sheet for 2v2 and Free-for-all: it says from the start that
 * bots take the empty seats, counts down to it, and lets the player start
 * at once. No offer to answer (the 1v1 sheet's): the mode's card already
 * said bots fill in. The timer only changes text, four times a second.
 */
export function openFillSearch(o: FillSearchOptions): QuickSearchHandle {
  const fillMs = o.fillMs ?? QUICK_FILL_MS;
  const words = FILL_SEARCH[o.mode];
  const sheet = document.createElement("div");
  sheet.className = "quick-search";
  sheet.id = "quick-search";
  sheet.dataset.state = "searching";
  sheet.dataset.mode = o.mode;
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-live", "polite");
  sheet.setAttribute("aria-label", words.label);
  const left = (ms: number) => Math.max(0, Math.ceil(ms / 1000));
  sheet.innerHTML = `<span class="ui-kicker">${words.kicker}</span><b class="quick-title">Searching for players</b><small class="quick-online">${onlineText(o.online)}</small><small class="quick-fill">Bots take the empty seats in <b data-quick-count>${left(fillMs)}</b> s. They are labelled (Bot).</small><div class="quick-actions"><button type="button" class="primary" data-quick-fill>Start with bots</button><button type="button" class="secondary btn-secondary" data-quick-cancel>Cancel</button></div>`;
  document.body.append(sheet);
  let open = true;
  const started = Date.now();
  const close = () => {
    if (!open) return;
    open = false;
    clearInterval(timer);
    sheet.remove();
  };
  const fill = () => {
    if (!open) return;
    // The room arrives next ("quick-found"); the sheet waits for it.
    clearInterval(timer);
    sheet.dataset.state = "starting";
    sheet.querySelector(".quick-title")!.textContent = "Starting your match";
    sheet
      .querySelectorAll<HTMLButtonElement>("button")
      .forEach((b) => (b.disabled = true));
    o.onFill();
  };
  sheet.querySelector<HTMLButtonElement>("[data-quick-fill]")!.onclick = fill;
  sheet.querySelector<HTMLButtonElement>("[data-quick-cancel]")!.onclick =
    () => {
      close();
      o.onCancel();
    };
  const timer = window.setInterval(() => {
    const rest = fillMs - (Date.now() - started);
    if (rest <= 0) return fill();
    const count = sheet.querySelector("[data-quick-count]");
    const text = String(left(rest));
    if (count && count.textContent !== text) count.textContent = text;
  }, 250);
  return {
    close,
    get open() {
      return open;
    },
  };
}

export function openQuickSearch(o: QuickSearchOptions): QuickSearchHandle {
  const fallbackMs = o.fallbackMs ?? QUICK_MATCH_FALLBACK_MS;
  const offerMs = o.offerMs ?? QUICK_MATCH_OFFER_MS;
  const sheet = document.createElement("div");
  sheet.className = "quick-search";
  sheet.id = "quick-search";
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-live", "polite");
  sheet.setAttribute("aria-label", "Quick Match");
  document.body.append(sheet);
  let open = true;
  let started = Date.now();
  let offerAt = 0;
  let timer = 0;

  const searching = () => {
    offerAt = 0;
    sheet.dataset.state = "searching";
    sheet.innerHTML = `<span class="ui-kicker">Quick Match · 1v1</span><b class="quick-title">Searching for an opponent</b><span class="quick-time" data-quick-time>0:00</span><small class="quick-online">${onlineText(o.online)}</small><div class="quick-actions"><button type="button" class="secondary btn-secondary" data-quick-cancel>Cancel</button></div>`;
    sheet.querySelector<HTMLButtonElement>("[data-quick-cancel]")!.onclick =
      () => {
        close();
        o.onCancel();
      };
  };
  const offer = () => {
    offerAt = Date.now();
    sheet.dataset.state = "offer";
    sheet.innerHTML = `<span class="ui-kicker">Quick Match · 1v1</span><b class="quick-title">No one is free right now</b><small class="quick-online">Fight a sparring bot while you wait? It's an AI, labelled (Bot).</small><div class="quick-actions"><button type="button" class="primary" data-quick-bot>Fight a bot <span data-quick-count>${Math.ceil(offerMs / 1000)}</span></button><button type="button" class="secondary btn-secondary" data-quick-keep>Keep searching</button><button type="button" class="quiet" data-quick-cancel>Cancel</button></div>`;
    sheet.querySelector<HTMLButtonElement>("[data-quick-bot]")!.onclick = () =>
      takeBot();
    sheet.querySelector<HTMLButtonElement>("[data-quick-keep]")!.onclick =
      () => {
        started = Date.now();
        searching();
      };
    sheet.querySelector<HTMLButtonElement>("[data-quick-cancel]")!.onclick =
      () => {
        close();
        o.onCancel();
      };
  };
  const takeBot = () => {
    close();
    o.onBot();
  };
  const tick = () => {
    const now = Date.now();
    if (offerAt) {
      const left = offerMs - (now - offerAt);
      if (left <= 0) return takeBot();
      const count = sheet.querySelector("[data-quick-count]");
      if (count) count.textContent = String(Math.ceil(left / 1000));
      return;
    }
    const waited = now - started;
    if (waited >= fallbackMs) return offer();
    const time = sheet.querySelector("[data-quick-time]");
    if (time) time.textContent = clock(waited);
  };
  const close = () => {
    if (!open) return;
    open = false;
    clearInterval(timer);
    sheet.remove();
  };
  searching();
  timer = window.setInterval(tick, 250);
  return {
    close,
    get open() {
      return open;
    },
  };
}

/**
 * Leaving the game leaves the game: no playing on in the background.
 *
 * A phone that switches away (home swipe, app switcher, another app) keeps
 * its game connection open while iOS or Android freezes the page, and a
 * page that is then swiped away from the app switcher is killed without a
 * word. The server only noticed when its heartbeat went unanswered, so
 * friends kept seeing the player online, the Plaza kept their avatar and a
 * room kept their seat looking live, for up to a minute or more.
 *
 * So the client says goodbye itself: on a phone or tablet the connection
 * closes the moment the page is hidden (there is no later moment: a frozen
 * page runs no timers, and a killed one runs nothing). On a computer, where
 * a hidden tab keeps running, it closes after a while hidden. Closing the
 * tab or app (pagehide) closes it at once everywhere.
 *
 * Coming back reconnects, and the usual resume (main.ts, "resume" with the
 * room token) puts the player back in a room the server still holds for
 * them (RULES.reconnectMs).
 */

/** The part of the Socket.IO client this needs. */
export interface ExitSocket {
  readonly connected: boolean;
  /** True while connected or trying to connect. */
  readonly active: boolean;
  connect(): unknown;
  disconnect(): unknown;
}

export interface BackgroundExitOptions {
  socket: ExitSocket;
  /** May the game connect now? (signed in, not paused for another device) */
  canConnect: () => boolean;
  /** Close at once when hidden (phones, tablets, the app). */
  closeAtOnce: () => boolean;
  /** How long a computer's hidden tab stays connected (ms). */
  desktopHiddenMs?: number;
  /** Told when the connection was closed for the background. */
  onLeave?: () => void;
  doc?: Pick<Document, "hidden" | "addEventListener">;
  win?: Pick<Window, "addEventListener">;
  setTimer?: (run: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}

/** A computer's hidden tab: still online for this long, then offline. */
export const DESKTOP_HIDDEN_MS = 120_000;

/**
 * Phones and tablets (and the app): their pages are frozen soon after they
 * are hidden. A touch laptop's main pointer is its touchpad, so it counts
 * as a computer.
 */
export function freezesWhenHidden(native: boolean) {
  if (native) return true;
  try {
    return matchMedia("(pointer: coarse)").matches;
  } catch {
    return false;
  }
}

export function watchBackgroundExit(o: BackgroundExitOptions) {
  const doc = o.doc ?? document,
    win = o.win ?? window,
    setTimer = o.setTimer ?? ((run, ms) => setTimeout(run, ms)),
    clearTimer =
      o.clearTimer ?? ((t) => clearTimeout(t as ReturnType<typeof setTimeout>));
  /** The connection is closed because the game went to the background. */
  let away = false;
  let timer: unknown;
  const stopTimer = () => {
    if (timer !== undefined) clearTimer(timer);
    timer = undefined;
  };
  const leave = () => {
    stopTimer();
    if (away || !(o.socket.connected || o.socket.active)) return;
    away = true;
    o.socket.disconnect();
    o.onLeave?.();
  };
  const back = () => {
    stopTimer();
    if (!away || doc.hidden) return;
    away = false;
    if (o.canConnect() && !o.socket.active) o.socket.connect();
  };
  doc.addEventListener("visibilitychange", () => {
    if (!doc.hidden) return back();
    if (o.closeAtOnce()) return leave();
    if (timer === undefined)
      timer = setTimer(() => {
        timer = undefined;
        if (doc.hidden) leave();
      }, o.desktopHiddenMs ?? DESKTOP_HIDDEN_MS);
  });
  // Closing the tab or app, or a page kept for Back (bfcache): gone now.
  win.addEventListener("pagehide", leave);
  win.addEventListener("pageshow", back);
  return {
    /** Closed for the background (main.ts holds off other reconnects). */
    get away() {
      return away;
    },
    /** The app is back in front (Capacitor's resume): reconnect. */
    back,
  };
}

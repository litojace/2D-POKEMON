import { expect, it } from "vitest";
import {
  DESKTOP_HIDDEN_MS,
  watchBackgroundExit,
} from "../../apps/client/src/background-exit";

/** A page, a window, a socket and a clock to drive by hand. */
function rig(o: { atOnce: boolean; canConnect?: boolean }) {
  const listeners = new Map<string, (() => void)[]>();
  const on = (type: string, fn: () => void) =>
    listeners.set(type, [...(listeners.get(type) ?? []), fn]);
  const fire = (type: string) => listeners.get(type)?.forEach((fn) => fn());
  const doc = { hidden: false, addEventListener: on };
  const socket = {
    connected: true,
    active: true,
    connects: 0,
    disconnects: 0,
    connect() {
      this.connects++;
      this.connected = this.active = true;
    },
    disconnect() {
      this.disconnects++;
      this.connected = this.active = false;
    },
  };
  const timers: { run: () => void; at: number }[] = [];
  let now = 0,
    left = 0;
  const exit = watchBackgroundExit({
    socket,
    canConnect: () => o.canConnect ?? true,
    closeAtOnce: () => o.atOnce,
    onLeave: () => left++,
    doc: doc as never,
    win: { addEventListener: on } as never,
    setTimer: (run, ms) => {
      const t = { run, at: now + ms };
      timers.push(t);
      return t;
    },
    clearTimer: (t) => timers.splice(timers.indexOf(t as never), 1),
  });
  return {
    exit,
    socket,
    left: () => left,
    hide() {
      doc.hidden = true;
      fire("visibilitychange");
    },
    show() {
      doc.hidden = false;
      fire("visibilitychange");
    },
    fire,
    doc,
    advance(ms: number) {
      now += ms;
      for (const t of timers.filter((t) => t.at <= now)) {
        timers.splice(timers.indexOf(t), 1);
        t.run();
      }
    },
  };
}

it("a phone leaves the game the moment it goes to the background", () => {
  const r = rig({ atOnce: true });
  r.hide();
  // Closed by the client: the server lets the player go now, not after
  // its heartbeat gives up on a frozen (or killed) app.
  expect(r.socket.disconnects).toBe(1);
  expect(r.exit.away).toBe(true);
  expect(r.left()).toBe(1);
  // Back in front: reconnect (main.ts resumes the room from there).
  r.show();
  expect(r.socket.connects).toBe(1);
  expect(r.exit.away).toBe(false);
});

it("a computer's hidden tab stays online for a while, then leaves", () => {
  const r = rig({ atOnce: false });
  r.hide();
  r.advance(DESKTOP_HIDDEN_MS - 1);
  expect(r.socket.disconnects).toBe(0);
  // Back before the time: nothing happened, nothing to redo.
  r.show();
  r.advance(DESKTOP_HIDDEN_MS);
  expect(r.socket.disconnects).toBe(0);
  expect(r.socket.connects).toBe(0);
  // Hidden for the whole time: offline, and back again on return.
  r.hide();
  r.advance(DESKTOP_HIDDEN_MS);
  expect(r.socket.disconnects).toBe(1);
  r.show();
  expect(r.socket.connects).toBe(1);
});

it("closing the page closes the connection everywhere", () => {
  const r = rig({ atOnce: false });
  r.fire("pagehide");
  expect(r.socket.disconnects).toBe(1);
  // A page restored from the Back cache reconnects.
  r.fire("pageshow");
  expect(r.socket.connects).toBe(1);
});

it("never reconnects a game it didn't close, or one that may not connect", () => {
  // Already offline (signed out, paused for another device): untouched.
  const off = rig({ atOnce: true });
  off.socket.connected = off.socket.active = false;
  off.hide();
  off.show();
  expect(off.socket.disconnects + off.socket.connects).toBe(0);
  expect(off.left()).toBe(0);
  // Closed for the background, but signed out meanwhile: stays closed.
  const out = rig({ atOnce: true, canConnect: false });
  out.hide();
  out.show();
  expect(out.socket.disconnects).toBe(1);
  expect(out.socket.connects).toBe(0);
  // Capacitor's resume and the page's own event both arrive: one connect.
  const twice = rig({ atOnce: true });
  twice.hide();
  twice.doc.hidden = false;
  twice.exit.back();
  twice.show();
  expect(twice.socket.connects).toBe(1);
});

import { afterEach, expect, it, vi } from "vitest";
import { watchRendererLifecycle } from "../../apps/client/src/renderer-lifecycle";
import type Phaser from "phaser";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});
it("resumes a suspended drawing loop and recovers context loss without reloading a match", () => {
  vi.useFakeTimers();
  const doc = Object.assign(new EventTarget(), {
    hidden: false,
    body: { append: vi.fn() },
    createElement: () => ({
      style: { cssText: "" },
      setAttribute: vi.fn(),
      append: vi.fn(),
      remove: vi.fn(),
    }),
  });
  const win = new EventTarget(),
    canvas = new EventTarget(),
    callbacks = new Map<string, () => void>();
  const game = {
    canvas,
    isRunning: true,
    isPaused: true,
    resume: vi.fn(),
    loop: { sleep: vi.fn(), wake: vi.fn() },
    scale: { refresh: vi.fn() },
    events: {
      once: (key: string, f: () => void) => callbacks.set(key, f),
      off: vi.fn(),
    },
  };
  game.resume.mockImplementation(() => {
    game.isPaused = false;
  });
  const resize = vi.fn(),
    reload = vi.fn();
  let active = true;
  vi.stubGlobal("document", doc);
  vi.stubGlobal("window", win);
  vi.stubGlobal("location", { reload });
  watchRendererLifecycle(game as unknown as Phaser.Game, () => active, resize);
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(game.loop.sleep).toHaveBeenCalled();
  doc.hidden = false;
  win.dispatchEvent(new Event("pageshow"));
  expect(game.resume).toHaveBeenCalledTimes(1);
  expect(resize).toHaveBeenCalledTimes(1);
  expect(game.loop.wake).toHaveBeenCalledTimes(1);
  const lost = new Event("webglcontextlost", { cancelable: true });
  canvas.dispatchEvent(lost);
  expect(lost.defaultPrevented).toBe(true);
  vi.advanceTimersByTime(1801);
  expect(doc.body.append).toHaveBeenCalledTimes(1);
  expect(reload).not.toHaveBeenCalled();
  canvas.dispatchEvent(new Event("webglcontextrestored"));
  expect(game.loop.wake).toHaveBeenCalledTimes(2);
  active = false;
  win.dispatchEvent(new Event("pageshow"));
  expect(game.loop.wake).toHaveBeenCalledTimes(2);
  callbacks.get("destroy")!();
  win.dispatchEvent(new Event("pageshow"));
  expect(game.loop.wake).toHaveBeenCalledTimes(2);
});

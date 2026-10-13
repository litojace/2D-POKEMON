import { afterEach, describe, expect, it } from "vitest";
import {
  canLockLandscape,
  fullscreenLandscape,
  lockLandscape,
} from "../../apps/client/src/orientation";

type Env = {
  lock?: (o: string) => Promise<void>;
  fullscreen?: boolean;
  installed?: boolean;
  requestFullscreen?: () => Promise<void>;
};
const saved = ["screen", "matchMedia", "document", "navigator"].map(
  (k) => [k, Object.getOwnPropertyDescriptor(globalThis, k)] as const,
);
const set = (key: string, value: unknown) =>
  Object.defineProperty(globalThis, key, {
    value,
    configurable: true,
    writable: true,
  });
function browser(env: Env) {
  const calls: string[] = [];
  const doc = {
    fullscreenElement: env.fullscreen ? {} : null,
    documentElement: {
      requestFullscreen: env.requestFullscreen
        ? async () => {
            calls.push("fullscreen");
            await env.requestFullscreen!();
            doc.fullscreenElement = {};
          }
        : undefined,
    },
  };
  set("document", doc);
  set("navigator", {});
  set("matchMedia", (q: string) => ({
    matches: !!env.installed && q.includes("standalone"),
  }));
  set("screen", {
    orientation: env.lock
      ? {
          lock: async (o: string) => {
            calls.push(`lock:${o}`);
            await env.lock!(o);
          },
        }
      : {},
  });
  return calls;
}
afterEach(() => {
  for (const [k, d] of saved)
    if (d) Object.defineProperty(globalThis, k, d);
    else delete (globalThis as unknown as Record<string, unknown>)[k];
});
const ok = async () => {};
describe("landscape lock", () => {
  it("only asks while fullscreen or installed", async () => {
    const calls = browser({ lock: ok });
    expect(canLockLandscape()).toBe(false);
    expect(await lockLandscape()).toBe(false);
    expect(calls).toEqual([]);
    browser({ lock: ok, fullscreen: true });
    expect(await lockLandscape()).toBe(true);
    browser({ lock: ok, installed: true });
    expect(await lockLandscape()).toBe(true);
  });
  it("treats a browser without lock (iPhone Safari) as unsupported", async () => {
    browser({ fullscreen: true });
    expect(canLockLandscape()).toBe(false);
    expect(await lockLandscape()).toBe(false);
  });
  it("swallows a rejected lock", async () => {
    browser({
      fullscreen: true,
      lock: () => Promise.reject(new Error("NotSupportedError")),
    });
    expect(await lockLandscape()).toBe(false);
  });
  it("enters fullscreen first, then locks; skips fullscreen when installed", async () => {
    let calls = browser({ lock: ok, requestFullscreen: ok });
    expect(await fullscreenLandscape()).toBe(true);
    expect(calls).toEqual(["fullscreen", "lock:landscape"]);
    calls = browser({ lock: ok, requestFullscreen: ok, installed: true });
    expect(await fullscreenLandscape()).toBe(true);
    expect(calls).toEqual(["lock:landscape"]);
  });
  it("never throws when fullscreen is refused or missing", async () => {
    browser({
      lock: ok,
      requestFullscreen: () => Promise.reject(new Error("denied")),
    });
    expect(await fullscreenLandscape()).toBe(false);
    browser({});
    expect(await fullscreenLandscape()).toBe(false);
  });
});

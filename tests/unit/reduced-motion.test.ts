import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// Settings → Reduce motion (apps/client/src/reduced-motion.ts): the game's
// own switch, off by default; the device's accessibility setting no longer
// decides anything (owner, 27 Nov 2026).

const store = new Map<string, string>();
const root = { dataset: {} as Record<string, string> };
beforeEach(() => {
  store.clear();
  root.dataset = {};
  vi.resetModules();
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  });
  vi.stubGlobal("document", { documentElement: root });
  // A device that asks for reduced motion: the game doesn't look.
  vi.stubGlobal("matchMedia", () => {
    throw new Error("the game asked the device about motion");
  });
});
const load = () => import("../../apps/client/src/reduced-motion");

describe("Reduce motion", () => {
  it("is off by default, whatever the device says", async () => {
    const m = await load();
    expect(m.reducedMotion()).toBe(false);
    expect(m.reducedMotionQuery.matches).toBe(false);
    expect(root.dataset.motion).toBeUndefined();
  });

  it("turns on for code and for CSS, tells its listeners, and is kept", async () => {
    const m = await load();
    const heard: boolean[] = [];
    const listener = () => heard.push(m.reducedMotion());
    m.reducedMotionQuery.addEventListener("change", listener);
    m.setReducedMotion(true);
    expect(m.reducedMotion()).toBe(true);
    expect(root.dataset.motion).toBe("reduced");
    expect(store.get("ea-reduce-motion")).toBe("on");
    m.setReducedMotion(true); // no change: nobody is told again
    m.setReducedMotion(false);
    expect(root.dataset.motion).toBeUndefined();
    expect(store.has("ea-reduce-motion")).toBe(false);
    expect(heard).toEqual([true, false]);
    m.reducedMotionQuery.removeEventListener("change", listener);
    m.setReducedMotion(true);
    expect(heard).toEqual([true, false]);
  });

  it("starts from the kept choice", async () => {
    store.set("ea-reduce-motion", "on");
    const m = await load();
    expect(m.reducedMotion()).toBe(true);
    expect(root.dataset.motion).toBe("reduced");
  });

  it("can be set for this visit only", async () => {
    const m = await load();
    m.setReducedMotion(true, false);
    expect(m.reducedMotion()).toBe(true);
    expect(store.has("ea-reduce-motion")).toBe(false);
  });

  it("works without storage", async () => {
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
      removeItem: () => {
        throw new Error("blocked");
      },
    });
    const m = await load();
    expect(m.reducedMotion()).toBe(false);
    m.setReducedMotion(true);
    expect(m.reducedMotion()).toBe(true);
  });
});

// Nothing in the game's own code or styles asks the device any more: a rule
// for less motion goes under :root[data-motion="reduced"], code reads
// reducedMotion(). (The legal pages' to-top.js and the dev preview pages
// are not the game.)
describe("the device's reduced-motion setting", () => {
  const SRC = join(__dirname, "../../apps/client/src");
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) walk(path);
      else if (/\.(ts|css)$/.test(name)) files.push(path);
    }
  };
  walk(SRC);

  it("is not read anywhere in the client", () => {
    const asking = files.filter(
      (file) =>
        !file.endsWith("reduced-motion.ts") &&
        /prefers-reduced-motion/.test(readFileSync(file, "utf8")),
    );
    expect(asking.map((f) => f.slice(SRC.length + 1))).toEqual([]);
  });

  it("is not read by the boot screen either", () => {
    expect(readFileSync(join(SRC, "../index.html"), "utf8")).not.toMatch(
      /prefers-reduced-motion/,
    );
  });
});

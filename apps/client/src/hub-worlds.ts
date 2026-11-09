/**
 * The hub's optional worlds (Farm, Plaza, Bistro) load on demand: each is a
 * large scene the game doesn't need to start, so its code is a separate file
 * fetched the first time it is wanted (or a while after the hub opened, see
 * `warm`), then kept for the rest of the session. Loading never opens
 * anything by itself: the caller decides again, once the code is here,
 * whether the world is still wanted (the player may have gone elsewhere,
 * logged out or joined a match).
 *
 * A browser keeps a failed `import()` failed: importing the same file again
 * gives the same error without asking the network (checked in Chromium). So
 * a world whose code failed to load stays failed until the page reloads,
 * which is also what a deploy needs (the new version's files).
 */
import type * as FarmModule from "./farm/farm-screen";
import type * as PlazaModule from "./plaza/plaza-screen";
import type * as BistroModule from "./bistro/bistro-scene";

export type World = "farm" | "plaza" | "bistro";
export interface WorldModules {
  farm: typeof FarmModule;
  plaza: typeof PlazaModule;
  bistro: typeof BistroModule;
}
type Importers = { [W in World]: () => Promise<WorldModules[W]> };
const IMPORTERS: Importers = {
  farm: () => import("./farm/farm-screen"),
  plaza: () => import("./plaza/plaza-screen"),
  bistro: () => import("./bistro/bistro-scene"),
};
/** How long the hub is open before the other worlds' code is fetched. */
export const WARM_DELAY_MS = 5_000;

export interface WorldLoader {
  /** The world's code, if it has loaded. */
  loaded<W extends World>(world: W): WorldModules[W] | undefined;
  /** Whether its code is on the way. */
  loading(world: World): boolean;
  /**
   * The world's code if it has loaded. Otherwise its load starts, or the
   * one on the way is joined (a warm-up's too), and `arrived` is called once
   * when it settles, with the module or undefined if it failed, however
   * often this is asked meanwhile. After a failure nothing starts again.
   */
  want<W extends World>(
    world: W,
    arrived: (module: WorldModules[W] | undefined) => void,
  ): WorldModules[W] | undefined;
  /** Whether its code failed to load (for good, until the page reloads). */
  failed(world: World): boolean;
  /**
   * WARM_DELAY_MS from now, load the worlds not loaded yet, one at a time
   * while the page is idle (and online). A warm-up that fails is reported
   * when that world is wanted.
   */
  warm(worlds?: readonly World[]): void;
  /** Stop warming (a match started). */
  stopWarming(): void;
}

export function worldLoader(
  options: {
    importers?: Partial<Importers>;
    onFail?(world: World, error: unknown): void;
    online?(): boolean;
    idle?(run: () => void): () => void;
    delay?(run: () => void, ms: number): () => void;
  } = {},
): WorldLoader {
  const importers = { ...IMPORTERS, ...options.importers } as Importers;
  const online =
    options.online ??
    (() => typeof navigator === "undefined" || navigator.onLine !== false);
  const idle =
    options.idle ??
    ((run: () => void) => {
      if (typeof requestIdleCallback === "function") {
        const id = requestIdleCallback(run, { timeout: 4000 });
        return () => cancelIdleCallback(id);
      }
      const id = setTimeout(run, 1500);
      return () => clearTimeout(id);
    });
  const delay =
    options.delay ??
    ((run: () => void, ms: number) => {
      const id = setTimeout(run, ms);
      return () => clearTimeout(id);
    });
  const modules: Partial<WorldModules> = {};
  const pending = new Map<World, Promise<unknown>>();
  /** Worlds whose code failed to load. */
  const failures = new Set<World>();
  /** Worlds whose `want` callback is waiting for the load to settle. */
  const awaited = new Set<World>();
  /** Bumped by stopWarming, so a warm-up in progress doesn't go on. */
  let warmRun = 0;
  let cancelWarmStep: (() => void) | undefined;
  let warming = false;

  function fetchWorld<W extends World>(
    world: W,
  ): Promise<WorldModules[W] | undefined> {
    const done = modules[world];
    if (done) return Promise.resolve(done);
    const inFlight = pending.get(world);
    if (inFlight) return inFlight as Promise<WorldModules[W] | undefined>;
    const promise = importers[world]().then(
      (module) => {
        modules[world] = module;
        pending.delete(world);
        return module;
      },
      (error: unknown) => {
        pending.delete(world);
        failures.add(world);
        options.onFail?.(world, error);
        return undefined;
      },
    );
    pending.set(world, promise);
    return promise;
  }
  const loader: WorldLoader = {
    loaded: (world) => modules[world],
    loading: (world) => pending.has(world),
    want(world, arrived) {
      const done = modules[world];
      if (done) return done;
      if (awaited.has(world) || failures.has(world)) return undefined;
      awaited.add(world);
      void fetchWorld(world).then((module) => {
        awaited.delete(world);
        arrived(module);
      });
      return undefined;
    },
    failed: (world) => failures.has(world),
    warm(worlds = ["farm", "bistro", "plaza"]) {
      if (warming) return;
      const queue = worlds.filter((w) => !modules[w] && !failures.has(w));
      if (!queue.length) return;
      warming = true;
      const run = warmRun;
      const next = () => {
        cancelWarmStep = undefined;
        if (run !== warmRun) return;
        const world = queue.shift();
        if (!world) {
          warming = false;
          return;
        }
        cancelWarmStep = idle(() => {
          cancelWarmStep = undefined;
          // Loaded or failed meanwhile; offline, a failure would stick.
          if (modules[world] || failures.has(world) || !online()) return next();
          void fetchWorld(world).then(next);
        });
      };
      cancelWarmStep = delay(next, WARM_DELAY_MS);
    },
    stopWarming() {
      warmRun++;
      warming = false;
      cancelWarmStep?.();
      cancelWarmStep = undefined;
    },
  };
  return loader;
}

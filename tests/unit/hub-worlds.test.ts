import { describe, expect, it, vi } from "vitest";
import {
  WARM_DELAY_MS,
  worldLoader,
  type World,
} from "../../apps/client/src/hub-worlds";

/** An import the test settles by hand. */
function deferred() {
  let resolve!: (v: unknown) => void, reject!: (e: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
function setup() {
  const calls: Record<World, ReturnType<typeof deferred>[]> = {
    farm: [],
    plaza: [],
    bistro: [],
  };
  const importer = (world: World) => () => {
    const d = deferred();
    calls[world].push(d);
    return d.promise as never;
  };
  /** Pending idle callbacks and WARM_DELAY_MS waits: run by hand. */
  const idle: (() => void)[] = [];
  const delays: (() => void)[] = [];
  const queue = (list: (() => void)[], run: () => void) => {
    const task = () => {
      list.splice(list.indexOf(task), 1);
      run();
    };
    list.push(task);
    return () => void list.splice(list.indexOf(task), 1);
  };
  const onFail = vi.fn();
  let online = true;
  const loader = worldLoader({
    importers: {
      farm: importer("farm"),
      plaza: importer("plaza"),
      bistro: importer("bistro"),
    },
    onFail,
    online: () => online,
    idle: (run) => queue(idle, run),
    delay: (run, ms) => {
      expect(ms).toBe(WARM_DELAY_MS);
      return queue(delays, run);
    },
  });
  return {
    loader,
    calls,
    idle,
    delays,
    onFail,
    offline: (v: boolean) => (online = !v),
  };
}

describe("hub world loader", () => {
  it("shares one import between callers, calls back once, and keeps the module", async () => {
    const { loader, calls } = setup();
    const arrived = vi.fn();
    expect(loader.want("farm", arrived)).toBeUndefined();
    // The hub syncs again and again while it loads.
    expect(loader.want("farm", arrived)).toBeUndefined();
    expect(calls.farm).toHaveLength(1);
    expect(loader.loading("farm")).toBe(true);
    const module = { openFarmScreen: () => {} };
    calls.farm[0].resolve(module);
    await flush();
    expect(arrived).toHaveBeenCalledTimes(1);
    expect(arrived).toHaveBeenCalledWith(module);
    expect(loader.loaded("farm")).toBe(module);
    expect(loader.loading("farm")).toBe(false);
    // Loaded: returned at once, no further imports.
    expect(loader.want("farm", arrived)).toBe(module);
    expect(calls.farm).toHaveLength(1);
  });

  it("a failed load stays failed (a browser won't fetch it again) and is reported once", async () => {
    const { loader, calls, onFail } = setup();
    const arrived = vi.fn();
    loader.want("bistro", arrived);
    calls.bistro[0].reject(new Error("offline"));
    await flush();
    expect(arrived).toHaveBeenCalledWith(undefined);
    expect(onFail).toHaveBeenCalledTimes(1);
    expect(loader.failed("bistro")).toBe(true);
    expect(loader.loaded("bistro")).toBeUndefined();
    // Asked again (another sync): no new import, no new report.
    expect(loader.want("bistro", arrived)).toBeUndefined();
    expect(calls.bistro).toHaveLength(1);
    expect(arrived).toHaveBeenCalledTimes(1);
    expect(onFail).toHaveBeenCalledTimes(1);
    // The other worlds are unaffected.
    loader.want("plaza", () => {});
    expect(calls.plaza).toHaveLength(1);
  });

  it("finishes a load that lands late without opening anything itself", async () => {
    const { loader, calls } = setup();
    const opened = vi.fn();
    let wanted = true;
    loader.want("farm", (m) => {
      // The caller decides again when the code arrives (here: moved on).
      if (m && wanted) opened();
    });
    wanted = false;
    calls.farm[0].resolve({});
    await flush();
    expect(opened).not.toHaveBeenCalled();
    expect(loader.loaded("farm")).toEqual({});
  });

  it("warms worlds one at a time, a while after the hub opens, and stops when asked", async () => {
    const { loader, calls, idle, delays } = setup();
    loader.warm(["farm", "bistro", "plaza"]);
    loader.warm(); // already warming: no second queue
    // Nothing is fetched until the hub has been open a while.
    expect(idle).toHaveLength(0);
    expect(delays).toHaveLength(1);
    delays[0]();
    expect(idle).toHaveLength(1);
    idle[0]();
    expect(calls.farm).toHaveLength(1);
    calls.farm[0].resolve({ farm: 1 });
    await flush();
    expect(loader.loaded("farm")).toEqual({ farm: 1 });
    expect(idle).toHaveLength(1);
    idle[0]();
    expect(calls.bistro).toHaveLength(1);
    // A match starts: the warm-up stops, and the plaza is never fetched.
    loader.stopWarming();
    calls.bistro[0].resolve({});
    await flush();
    expect(idle).toHaveLength(0);
    expect(calls.plaza).toHaveLength(0);
    // Warming again later picks up only what is still missing.
    loader.warm(["farm", "bistro", "plaza"]);
    delays[0]();
    idle[0]();
    expect(calls.farm).toHaveLength(1);
    expect(calls.bistro).toHaveLength(1);
    expect(calls.plaza).toHaveLength(1);
  });

  it("opens a world wanted while its warm-up is loading it (once, when it arrives)", async () => {
    const { loader, calls, idle, delays } = setup();
    loader.warm(["farm"]);
    delays[0]();
    idle[0]();
    expect(calls.farm).toHaveLength(1);
    // The player opens the Farm mid warm-up: the same import is joined.
    const arrived = vi.fn();
    expect(loader.want("farm", arrived)).toBeUndefined();
    expect(loader.want("farm", arrived)).toBeUndefined();
    expect(calls.farm).toHaveLength(1);
    calls.farm[0].resolve({ farm: 1 });
    await flush();
    expect(arrived).toHaveBeenCalledTimes(1);
    expect(arrived).toHaveBeenCalledWith({ farm: 1 });
  });

  it("doesn't warm while offline (a failed import would stick) or before the delay", async () => {
    const { loader, calls, idle, delays, offline } = setup();
    offline(true);
    loader.warm(["plaza", "bistro"]);
    delays[0]();
    idle[0]();
    idle[0]();
    expect(calls.plaza).toHaveLength(0);
    expect(calls.bistro).toHaveLength(0);
    expect(loader.failed("plaza")).toBe(false);
    // Back online, wanting it loads it.
    offline(false);
    loader.want("plaza", () => {});
    expect(calls.plaza).toHaveLength(1);
    // A match during the wait: nothing at all is fetched.
    const other = setup();
    other.loader.warm();
    other.loader.stopWarming();
    expect(other.delays).toHaveLength(0);
    expect(other.idle).toHaveLength(0);
  });
});

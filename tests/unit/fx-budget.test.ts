import { afterEach, describe, expect, it, vi } from "vitest";
import { Fx, FX_BUDGETS } from "../../apps/client/src/fx-engine";

function sceneFixture() {
  const handlers = new Map<
    string,
    { fn: Function; context: unknown; once: boolean }[]
  >();
  let graphics = 0,
    images = 0,
    destroyed = 0;
  function object() {
    const values: Record<string, unknown> = { depth: 0 };
    const o: any = new Proxy(values, {
      get: (_, key: string) => {
        if (key in values) return values[key];
        if (key === "destroy")
          return () => {
            destroyed++;
            return o;
          };
        if (key === "setDepth")
          return (d: number) => {
            values.depth = d;
            return o;
          };
        return (...args: unknown[]) => {
          if (args.some((a) => typeof a === "number" && !Number.isFinite(a)))
            throw Error("Non-finite drawing command");
          return o;
        };
      },
    });
    return o;
  }
  const scene: any = {
    time: { now: 1000 },
    textures: { exists: () => true },
    add: {
      graphics: () => {
        graphics++;
        return object();
      },
      image: () => {
        images++;
        return object();
      },
    },
    cameras: { main: { width: 1280, height: 720, zoom: 1, shake() {} } },
    events: {
      on(name: string, fn: Function, context: unknown) {
        handlers.set(name, [
          ...(handlers.get(name) ?? []),
          { fn, context, once: false },
        ]);
      },
      once(name: string, fn: Function, context: unknown) {
        handlers.set(name, [
          ...(handlers.get(name) ?? []),
          { fn, context, once: true },
        ]);
      },
      off(name: string, fn: Function) {
        handlers.set(
          name,
          (handlers.get(name) ?? []).filter((h) => h.fn !== fn),
        );
      },
    },
  };
  const emit = (name: string, time = 1000) => {
    for (const h of [...(handlers.get(name) ?? [])]) {
      h.fn.call(h.context, time, 16);
      if (h.once) scene.events.off(name, h.fn);
    }
  };
  return {
    scene,
    emit,
    counts: () => ({ graphics, images, destroyed }),
    frame: (time: number) => {
      emit("preupdate", time);
      emit("postupdate", time);
    },
  };
}
afterEach(() => vi.unstubAllGlobals());

describe("shared battle effect budget", () => {
  it("bounds particles and reusable sprite pools on a compact screen", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
    }));
    const f = sceneFixture(),
      fx = new Fx(f.scene),
      limit = FX_BUDGETS.compact;
    f.emit("preupdate");
    fx.burst({
      x: 500,
      y: 400,
      count: 10000,
      kind: "mote",
      color: 0xffffff,
      speed: [0, 10],
      life: [1, 2],
      size: [1, 2],
    });
    for (let i = 0; i < 1000; i++) {
      fx.glow(500, 400, 30, 0xffffff);
      fx.glow(500, 400, 30, 0xffffff, 1, true);
      fx.soft(500, 400, 30, 0xffffff);
    }
    f.emit("postupdate");
    expect(fx.diagnostics()).toMatchObject({
      particles: limit.particles,
      glows: limit.glows,
      floorGlows: limit.floorGlows,
      softs: limit.softs,
    });
    const before = f.counts();
    f.emit("preupdate", 1016);
    for (let i = 0; i < 1000; i++) {
      fx.glow(500, 400, 30, 0xffffff);
      fx.soft(500, 400, 30, 0xffffff);
    }
    f.emit("postupdate", 1016);
    expect(f.counts()).toEqual(before);
  });
  it("animates from the scene's actual clock, sorts behind cover and cleans up", () => {
    const f = sceneFixture(),
      fx = new Fx(f.scene);
    fx.setOccluders([370]);
    const samples: { k: number; depth: number }[] = [];
    fx.animate(
      100,
      (k) => samples.push({ k, depth: (fx.g as any).depth }),
      300,
    );
    const before = f.counts();
    f.frame(1000);
    f.frame(1050);
    f.frame(1100);
    expect(samples.map((s) => s.k)).toEqual([0, 0.5, 1]);
    expect(samples.every((s) => s.depth < 2.037)).toBe(true);
    expect(fx.diagnostics().animations).toBe(0);
    expect(f.counts().graphics - before.graphics).toBe(3); // One cover band, no Graphics per timeline.
    fx.animate(100, () => {
      throw Error("Disposed callback ran");
    });
    fx.destroy();
    const disposed = f.counts().destroyed;
    f.emit("shutdown");
    expect(f.counts().destroyed).toBe(disposed);
    expect(fx.diagnostics().animations).toBe(0);
    expect(() => f.frame(1150)).not.toThrow();
  });
  it("keeps core cast timelines ahead of optional accents and reserves transient detail", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("max-width"),
    }));
    const f = sceneFixture(),
      fx = new Fx(f.scene),
      before = f.counts();
    for (let i = 0; i < 100; i++) fx.animate(200, () => {}, 400, true);
    expect(fx.diagnostics().animations).toBe(FX_BUDGETS.compact.accents);
    let casts = 0;
    for (let i = 0; i < 100; i++) fx.animate(200, () => casts++, 400);
    expect(fx.diagnostics().animations).toBe(FX_BUDGETS.compact.animations);
    while (fx.detail(4)) {
      /* A crowded field consumes its persistent allowance. */
    }
    expect(fx.detail(8, true)).toBe(true);
    f.frame(1016);
    expect(casts).toBe(FX_BUDGETS.compact.animations);
    expect(f.counts()).toEqual(before);
    f.frame(1300);
    expect(fx.diagnostics().animations).toBe(0);
  });
  it("skips optional movement for reduced motion while retaining core cast feedback", () => {
    vi.stubGlobal("matchMedia", (query: string) => ({
      matches: query.includes("reduced-motion"),
    }));
    const f = sceneFixture(),
      fx = new Fx(f.scene);
    let core = 0,
      accents = 0;
    fx.animate(200, () => accents++, 400, true);
    fx.animate(200, () => core++, 400);
    expect(fx.detail(1)).toBe(false);
    f.frame(1100);
    expect(core).toBe(1);
    expect(accents).toBe(0);
  });
});

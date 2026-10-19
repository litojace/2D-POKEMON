import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountShopPreview } from "../../apps/client/src/shop-preview";
import { CHAMPION_SKIN_BY_ID } from "../../packages/shared/src/shop";

const mock = vi.hoisted(() => ({
  scene: undefined as any,
  render: vi.fn(),
  reset: vi.fn(),
  destroy: vi.fn(),
  rigDestroy: vi.fn(),
  rigs: vi.fn(),
  games: vi.fn(),
  assets: vi.fn(),
  postRender: undefined as (() => void) | undefined,
  textures: new Set<string>(),
  pending: [] as string[],
  finish: undefined as (() => void) | undefined,
  autoLoad: true,
  canvas: { setAttribute: vi.fn(), remove: vi.fn() },
}));
vi.mock("phaser", () => ({
  default: {
    CANVAS: 1,
    Core: { Events: { POST_RENDER: "postrender" } },
    Scene: class {
      add = {
        graphics: () => {
          const graphics: any = new Proxy({}, { get: () => () => graphics });
          return graphics;
        },
      };
      textures = {
        exists: (key: string) => mock.textures.has(key),
        remove: (key: string) => mock.textures.delete(key),
      };
      load = {
        svg: (key: string) => {
          mock.pending.push(key);
        },
        once: (_: string, fn: () => void) => {
          mock.finish = () => {
            mock.pending.forEach((key) => mock.textures.add(key));
            mock.pending = [];
            fn();
          };
        },
        start: () => {
          if (mock.autoLoad) mock.finish!();
        },
      };
      cameras = {
        main: { setZoom: vi.fn().mockReturnThis(), centerOn: vi.fn() },
      };
      game = {
        canvas: mock.canvas,
        events: {
          once: (_: string, fn: () => void) => {
            mock.postRender = fn;
          },
        },
      };
    },
    Game: class {
      canvas = mock.canvas;
      scale = { parent: undefined, refresh: vi.fn() };
      constructor(config: any) {
        mock.games();
        mock.scene = new config.scene();
      }
      destroy = mock.destroy;
    },
  },
}));
vi.mock("../../apps/client/src/animation/assets", () => ({
  skinSuffix: (_: string, skin: any) =>
    skin ? `~${skin.skin}~${skin.stage}` : "",
  rigAssets: (id: string, skin: any) => {
    mock.assets(id, skin);
    return [
      {
        key: `${id}-${skin?.skin ?? "original"}-${skin?.stage ?? 1}`,
        url: "svg",
        width: 20,
        height: 20,
      },
    ];
  },
}));
vi.mock("../../apps/client/src/animation/rig", () => ({
  FighterRig: class {
    constructor(_: any, champion: string) {
      mock.rigs(champion);
    }
    root = { setScale: vi.fn() };
    controller = { reset: mock.reset };
    render = mock.render;
    destroy = mock.rigDestroy;
  },
}));
vi.mock("../../apps/client/src/skins/collection-fx", () => ({
  drawCollectionAura: vi.fn(),
}));

function panel(
  action = "idle",
  item = "voltkit-snowcap",
  champion = "voltkit",
  stage = 1,
) {
  const classes = new Set<string>(item.endsWith("-frame") ? ["is-frame"] : []);
  const host = {
    classList: {
      contains: (c: string) => classes.has(c),
      add: (c: string) => classes.add(c),
      remove: (c: string) => classes.delete(c),
    },
    dataset: {
      previewChampion: champion,
      previewItem: item,
      previewStage: String(stage),
      previewAction: action,
    },
    getAttribute: () => "Snowcap animated preview",
    setAttribute: vi.fn(),
    appendChild: vi.fn(),
  };
  const toggle = {
    disabled: true,
    textContent: "Loading preview…",
    setAttribute: vi.fn(),
  };
  const element = {
    querySelector: (selector: string) =>
      selector === ".shop-live-stage"
        ? host
        : selector === "[data-preview-toggle]"
          ? toggle
          : null,
    querySelectorAll: () => [],
  } as unknown as HTMLElement;
  return { host, toggle, element };
}
function preview(action = "idle") {
  const p = panel(action);
  const dispose = mountShopPreview(p.element);
  mock.scene.create();
  return { ...p, dispose };
}
function draw() {
  mock.scene.update(0, 16);
  mock.postRender?.();
}
function change(
  dispose: ReturnType<typeof mountShopPreview>,
  p: ReturnType<typeof panel>,
) {
  dispose.update(p.element);
  vi.runAllTimers();
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mock.postRender = undefined;
  mock.textures.clear();
  mock.pending = [];
  mock.autoLoad = true;
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("matchMedia", () => ({
    matches: false,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }));
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal("requestAnimationFrame", (fn: () => void) => setTimeout(fn, 0));
  vi.stubGlobal("cancelAnimationFrame", clearTimeout);
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("Shop live previews", () => {
  it("stays idle at the same position and facing across several animation cycles", () => {
    const { dispose } = preview();
    for (let i = 0; i < 400; i++) mock.scene.update(i * 50, 50);
    expect(mock.render).toHaveBeenCalledTimes(400);
    expect(mock.reset).not.toHaveBeenCalled();
    for (const [pose, x, y] of mock.render.mock.calls) {
      expect({
        speed: pose.speed,
        dash: pose.dash,
        angle: pose.angle,
        x,
        y,
      }).toEqual({ speed: 0, dash: false, angle: Math.PI / 2, x: 200, y: 174 });
      expect(pose.greet || pose.victory).toBe(false);
    }
    dispose();
  });
  it("reveals the canvas only after the first posed frame has actually rendered", () => {
    const { host, toggle, dispose } = preview();
    expect(host.classList.contains("is-ready")).toBe(false);
    expect(toggle.disabled).toBe(true);
    mock.scene.update(0, 16);
    expect(mock.render).toHaveBeenCalledOnce();
    expect(host.classList.contains("is-ready")).toBe(false);
    mock.postRender!();
    expect(host.classList.contains("is-ready")).toBe(true);
    expect(toggle.disabled).toBe(false);
    dispose();
  });
  it("does not reveal an abandoned preview when its pending frame finishes", () => {
    const { host, dispose } = preview();
    mock.scene.update(0, 16);
    dispose();
    mock.postRender!();
    expect(host.classList.contains("is-ready")).toBe(false);
    expect(mock.destroy).toHaveBeenCalledExactlyOnceWith(true);
  });
  it.each(["entrance", "victory"])(
    "keeps %s cosmetics animated without running",
    (action) => {
      const { dispose } = preview(action);
      draw();
      const pose = mock.render.mock.calls[0][0];
      expect(pose.greet).toBe(action === "entrance");
      expect(pose.victory).toBe(action === "victory");
      expect(pose.speed).toBe(0);
      expect(pose.dash).toBe(false);
      dispose();
    },
  );
  it("reuses one renderer and decoded textures when returning to a skin", () => {
    const { dispose } = preview();
    draw();
    change(dispose, panel("idle", "voltkit-midnight"));
    draw();
    change(dispose, panel());
    draw();
    expect(mock.games).toHaveBeenCalledOnce();
    expect(mock.assets).toHaveBeenCalledTimes(3);
    expect(mock.textures.size).toBe(3);
    expect(mock.render.mock.lastCall![0].skin.skin).toBe("voltkit-snowcap");
    expect(mock.destroy).not.toHaveBeenCalled();
    dispose();
  });
  it("coalesces rapid taps and renders only the latest selection after a pending load", () => {
    mock.autoLoad = false;
    const { dispose, host } = preview();
    const finishOld = mock.finish!;
    dispose.update(panel("idle", "voltkit-midnight").element);
    const latest = panel("idle", "auralynx-celestial-sage", "auralynx", 3);
    change(dispose, latest);
    finishOld(); // The first skin finished, but should never be shown.
    expect(mock.rigs).not.toHaveBeenCalled();
    mock.finish!();
    draw();
    expect(mock.rigs).toHaveBeenCalledExactlyOnceWith("auralynx");
    expect(mock.render.mock.lastCall![0].skin).toEqual({
      skin: "auralynx-celestial-sage",
      stage: 3,
    });
    expect(host.classList.contains("is-ready")).toBe(false);
    expect(latest.host.classList.contains("is-ready")).toBe(true);
    expect(
      mock.assets.mock.calls.some(
        ([, look]) => look?.skin === "voltkit-midnight",
      ),
    ).toBe(false);
    dispose();
  });
  it("does not duplicate a rig when a stale load finishes before the scheduled selection", () => {
    mock.autoLoad = false;
    const { dispose } = preview();
    const finishOld = mock.finish!;
    dispose.update(panel("idle", "voltkit-midnight").element);
    finishOld();
    mock.finish!();
    vi.runAllTimers();
    draw();
    expect(mock.rigs).toHaveBeenCalledExactlyOnceWith("voltkit");
    dispose();
  });
  it("ignores the previous selection's pending post-render callback", () => {
    const { dispose } = preview();
    mock.scene.update(0, 16);
    const oldFrame = mock.postRender!;
    const next = panel("idle", "voltkit-midnight");
    change(dispose, next);
    oldFrame();
    expect(next.host.classList.contains("is-ready")).toBe(false);
    draw();
    expect(next.host.classList.contains("is-ready")).toBe(true);
    dispose();
  });
  it("bounds decoded looks and reloads evicted textures correctly", () => {
    const { dispose } = preview();
    const ids = Object.keys(CHAMPION_SKIN_BY_ID).slice(0, 14);
    for (const id of ids) {
      change(dispose, panel("idle", id, CHAMPION_SKIN_BY_ID[id].champion));
      draw();
      expect(mock.textures.size).toBeLessThanOrEqual(8);
    }
    change(dispose, panel());
    draw();
    expect(mock.render.mock.lastCall![0].skin.skin).toBe("voltkit-snowcap");
    expect(mock.textures.has("voltkit-voltkit-snowcap-1")).toBe(true);
    dispose();
  });
  it("keeps frames static and releases the renderer even if a load is unfinished", () => {
    const { dispose } = preview();
    draw();
    change(dispose, panel("idle", "galaxy-frame"));
    mock.render.mockClear();
    draw();
    expect(mock.render).not.toHaveBeenCalled();
    expect(mock.canvas.remove).toHaveBeenCalledOnce();
    mock.autoLoad = false;
    change(dispose, panel("idle", "voltkit-midnight"));
    dispose();
    mock.finish!();
    expect(mock.destroy).toHaveBeenCalledExactlyOnceWith(true);
    expect(mock.rigs).toHaveBeenCalledTimes(1);
  });
});

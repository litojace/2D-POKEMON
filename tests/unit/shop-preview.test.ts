import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mountShopPreview } from "../../apps/client/src/shop-preview";

const mock = vi.hoisted(() => ({
  scene: undefined as any,
  render: vi.fn(),
  reset: vi.fn(),
  destroy: vi.fn(),
  postRender: undefined as (() => void) | undefined,
}));
vi.mock("phaser", () => ({ default: {
  CANVAS: 1,
  Core: { Events: { POST_RENDER: "postrender" } },
  Scene: class {
    add = { graphics: () => {
      const graphics: any = new Proxy({}, { get: () => () => graphics });
      return graphics;
    } };
    cameras = { main: { setZoom: vi.fn().mockReturnThis(), centerOn: vi.fn() } };
    game = { events: { once: (_: string, fn: () => void) => { mock.postRender = fn; } } };
  },
  Game: class {
    constructor(config: any) { mock.scene = new config.scene(); }
    destroy = mock.destroy;
  },
} }));
vi.mock("../../apps/client/src/animation/assets", () => ({ rigAssets: () => [] }));
vi.mock("../../apps/client/src/animation/rig", () => ({ FighterRig: class {
  root = { setScale: vi.fn() };
  controller = { reset: mock.reset };
  render = mock.render;
} }));
vi.mock("../../apps/client/src/skins/collection-fx", () => ({ drawCollectionAura: vi.fn() }));

function preview(action = "idle") {
  const classes = new Set<string>();
  const host = {
    classList: { contains: (c: string) => classes.has(c), add: (c: string) => classes.add(c), remove: (c: string) => classes.delete(c) },
    dataset: { previewChampion: "voltkit", previewItem: "voltkit-snowcap", previewStage: "1", previewAction: action },
    getAttribute: () => "Snowcap animated preview",
    querySelector: () => ({ setAttribute: vi.fn() }),
  };
  const toggle = { disabled: true, textContent: "Loading preview…", setAttribute: vi.fn() };
  const panel = {
    querySelector: (selector: string) => selector === ".shop-live-stage" ? host : selector === "[data-preview-toggle]" ? toggle : null,
    querySelectorAll: () => [],
  };
  const dispose = mountShopPreview(panel as unknown as HTMLElement);
  mock.scene.create();
  return { host, toggle, dispose };
}

beforeEach(() => {
  vi.clearAllMocks();
  mock.postRender = undefined;
  vi.stubGlobal("document", { hidden: false });
  vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.stubGlobal("IntersectionObserver", class { observe() {} disconnect() {} });
});
afterEach(() => vi.unstubAllGlobals());

describe("Shop live previews", () => {
  it("stays idle at the same position and facing across several animation cycles", () => {
    const { dispose } = preview();
    for (let i = 0; i < 400; i++) mock.scene.update(i * 50, 50);
    expect(mock.render).toHaveBeenCalledTimes(400);
    expect(mock.reset).not.toHaveBeenCalled();
    for (const [pose, x, y] of mock.render.mock.calls) {
      expect({ speed: pose.speed, dash: pose.dash, angle: pose.angle, x, y }).toEqual({ speed: 0, dash: false, angle: Math.PI / 2, x: 200, y: 174 });
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
  it.each(["entrance", "victory"])("keeps %s cosmetics animated without running", (action) => {
    const { dispose } = preview(action);
    mock.scene.update(0, 16);
    const pose = mock.render.mock.calls[0][0];
    expect(pose.greet).toBe(action === "entrance");
    expect(pose.victory).toBe(action === "victory");
    expect(pose.speed).toBe(0);
    expect(pose.dash).toBe(false);
    dispose();
  });
});

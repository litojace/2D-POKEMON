import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { watchMenuMotion } from "../../apps/client/src/menu-motion";

const portrait = () => {
  const svg = { pauseAnimations: vi.fn(), unpauseAnimations: vi.fn() };
  const attributes = new Set<string>();
  return {
    svg,
    attributes,
    querySelectorAll: () => [svg],
    toggleAttribute: (name: string, value: boolean) =>
      value ? attributes.add(name) : attributes.delete(name),
    removeAttribute: (name: string) => attributes.delete(name),
  };
};
let cards: ReturnType<typeof portrait>[];
let menu: any;
let panel: any;
let doc: EventTarget & { hidden: boolean };
let intersect: (entries: any[]) => void;
let mutations: (() => void)[];
let unobserve: ReturnType<typeof vi.fn>;
let dispose: (() => void) | undefined;
beforeEach(() => {
  cards = [portrait(), portrait()];
  menu = { hidden: false, querySelectorAll: () => cards };
  panel = { open: false };
  doc = Object.assign(new EventTarget(), { hidden: false });
  mutations = [];
  unobserve = vi.fn();
  vi.stubGlobal("document", doc);
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: typeof intersect) {
        intersect = callback;
      }
      observe = vi.fn();
      unobserve = unobserve;
      disconnect = vi.fn();
    },
  );
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        mutations.push(callback);
      }
      observe = vi.fn();
      disconnect = vi.fn();
    },
  );
  dispose = watchMenuMotion(menu, panel);
});
afterEach(() => {
  dispose?.();
  vi.unstubAllGlobals();
});
const visible = (index: number, on: boolean) =>
  intersect([{ target: cards[index], isIntersecting: on }]);
it("runs only visible portraits and pauses both CSS parts and SVG aura clocks", () => {
  visible(0, true);
  expect(cards[0].attributes.has("data-motion-paused")).toBe(false);
  expect(cards[0].svg.unpauseAnimations).toHaveBeenCalledOnce();
  expect(cards[1].attributes.has("data-motion-paused")).toBe(true);
  expect(cards[1].svg.pauseAnimations).toHaveBeenCalledOnce();
  visible(0, false);
  expect(cards[0].attributes.has("data-motion-paused")).toBe(true);
  expect(cards[0].svg.pauseAnimations).toHaveBeenCalledTimes(2);
});
it("holds background portraits while a menu covers them and resumes only the visible ones", () => {
  visible(0, true);
  panel.open = true;
  mutations[1]();
  visible(1, true);
  expect(cards.every((c) => c.attributes.has("data-motion-paused"))).toBe(true);
  visible(1, false);
  panel.open = false;
  mutations[1]();
  expect(cards[0].attributes.has("data-motion-paused")).toBe(false);
  expect(cards[1].attributes.has("data-motion-paused")).toBe(true);
});
it("stops for hidden tabs and the battle screen without resetting animation phases", () => {
  visible(0, true);
  doc.hidden = true;
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(cards[0].attributes.has("data-motion-paused")).toBe(true);
  menu.hidden = true;
  doc.hidden = false;
  doc.dispatchEvent(new Event("visibilitychange"));
  expect(cards[0].attributes.has("data-motion-paused")).toBe(true);
  menu.hidden = false;
  mutations[0]();
  expect(cards[0].attributes.has("data-motion-paused")).toBe(false);
});
it("retires replaced portraits and observes newly equipped skins without retaining old SVGs", () => {
  const removed = cards[0];
  cards = [portrait()];
  mutations[0]();
  expect(unobserve).toHaveBeenCalledWith(removed);
  expect(cards[0].attributes.has("data-motion-paused")).toBe(true);
  visible(0, true);
  expect(cards[0].svg.unpauseAnimations).toHaveBeenCalledOnce();
  dispose!();
  dispose = undefined;
  expect(cards[0].attributes.has("data-motion-paused")).toBe(false);
});

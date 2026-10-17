import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  isScrollLocked,
  lockScrollWhileOpen,
  setScrollLock,
} from "../../apps/client/src/scroll-lock";

let sync: () => void;
let style: Record<string, string>;
let rootStyle: Record<string, string>;
let scrollTo: ReturnType<typeof vi.fn>;
let resize: () => void;
beforeEach(() => {
  style = {
    position: "relative",
    top: "",
    left: "",
    right: "",
    width: "",
    paddingRight: "12px",
  };
  rootStyle = { scrollbarGutter: "auto" };
  scrollTo = vi.fn();
  vi.stubGlobal("document", {
    body: { style, getBoundingClientRect: () => ({ width: 1000 }) },
    documentElement: {
      style: rootStyle,
      clientWidth: 1000,
      classList: { add: vi.fn(), remove: vi.fn() },
    },
  });
  vi.stubGlobal("window", {
    scrollX: 4,
    scrollY: 230,
    innerWidth: 1015,
    scrollTo,
    addEventListener: vi.fn((_event, listener) => {
      resize = listener;
    }),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal(
    "MutationObserver",
    class {
      constructor(callback: () => void) {
        sync = callback;
      }
      observe = vi.fn();
    },
  );
});
afterEach(() => {
  setScrollLock(false);
  vi.unstubAllGlobals();
});

it("pins the current layout and reserves desktop scrollbar space without changing padding", () => {
  setScrollLock(true);
  expect(style).toMatchObject({
    position: "fixed",
    top: "-230px",
    left: "-4px",
    width: "1000px",
    paddingRight: "12px",
  });
  expect(rootStyle.scrollbarGutter).toBe("stable");
  setScrollLock(false);
  expect(style).toMatchObject({
    position: "relative",
    top: "",
    width: "",
    paddingRight: "12px",
  });
  expect(rootStyle.scrollbarGutter).toBe("auto");
  expect(scrollTo).toHaveBeenCalledWith({
    left: 4,
    top: 230,
    behavior: "instant",
  });
});

it("does not overwrite the original position when opening a dialog from an already locked menu", () => {
  setScrollLock(true);
  window.scrollY = 0;
  setScrollLock(true);
  expect(style.top).toBe("-230px");
  setScrollLock(false);
  expect(scrollTo).toHaveBeenCalledExactlyOnceWith({
    left: 4,
    top: 230,
    behavior: "instant",
  });
});

it("keeps the page locked across menu-to-dialog transitions and releases it when both close", () => {
  const menu = Object.assign(new EventTarget(), { open: false });
  const dialog = Object.assign(new EventTarget(), { open: false });
  lockScrollWhileOpen(menu as HTMLDetailsElement, dialog as HTMLDialogElement);
  menu.open = true;
  sync();
  expect(isScrollLocked()).toBe(true);
  dialog.open = true;
  menu.open = false;
  sync();
  expect(isScrollLocked()).toBe(true);
  expect(scrollTo).not.toHaveBeenCalled();
  dialog.open = false;
  dialog.dispatchEvent(new Event("close"));
  expect(isScrollLocked()).toBe(false);
  expect(scrollTo).toHaveBeenCalledOnce();
});

it("does not introduce scrollbar space on mobile or short pages", () => {
  window.innerWidth = 1000;
  setScrollLock(true);
  expect(rootStyle.scrollbarGutter).toBe("auto");
});

it("fits the new viewport when rotating with a menu open and retires the resize listener", () => {
  setScrollLock(true);
  Object.assign(document.documentElement, { clientWidth: 600 });
  resize();
  expect(style.width).toBe("600px");
  expect(style.top).toBe("-230px");
  setScrollLock(false);
  expect(style.width).toBe("");
  expect(window.removeEventListener).toHaveBeenCalledWith("resize", resize);
});

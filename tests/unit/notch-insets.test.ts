import { afterEach, expect, it, vi } from "vitest";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.resetModules();
});

it("finds the notch from the turn, preferring window.orientation", async () => {
  const { notchSide } = await import("../../apps/client/src/notch-insets");
  // Turned counterclockwise: the phone's top, and its notch, go left.
  expect(notchSide(90, undefined)).toBe("left");
  expect(notchSide(-90, undefined)).toBe("right");
  expect(notchSide(undefined, 90)).toBe("left");
  expect(notchSide(undefined, 270)).toBe("right");
  // iOS 16.4 had screen.orientation.angle the wrong way round.
  expect(notchSide(-90, 90)).toBe("right");
  expect(notchSide(0, 0)).toBe(null);
  expect(notchSide(180, undefined)).toBe(null);
  expect(notchSide(undefined, undefined)).toBe(null);
});

it("trims only iOS's symmetric landscape insets, on the side away from the notch", async () => {
  const { trimmedInsets, CORNER_ROOM } =
    await import("../../apps/client/src/notch-insets");
  expect(trimmedInsets({ left: 59, right: 59 }, "left")).toEqual({
    left: 59,
    right: CORNER_ROOM,
  });
  expect(trimmedInsets({ left: 47, right: 47 }, "right")).toEqual({
    left: CORNER_ROOM,
    right: 47,
  });
  // Android: the cutout's side only, already.
  expect(trimmedInsets({ left: 32, right: 0 }, "left")).toBe(null);
  // iPad, desktop, or a side we can't tell.
  expect(trimmedInsets({ left: 0, right: 0 }, "left")).toBe(null);
  expect(trimmedInsets({ left: 59, right: 59 }, null)).toBe(null);
});

function stubPage(o: {
  orientation: number;
  width?: number;
  height?: number;
  inset?: number;
}) {
  const props = new Map<string, string>();
  const style = {
    getPropertyValue: (k: string) => props.get(k) ?? "",
    setProperty: (k: string, v: string) => void props.set(k, v),
    removeProperty: (k: string) => void props.delete(k),
  };
  const page = { ...o };
  vi.stubGlobal("document", {
    documentElement: { style },
    body: { appendChild: () => {} },
    createElement: () => ({ setAttribute() {}, style: {} }),
  });
  vi.stubGlobal("getComputedStyle", () => ({
    paddingLeft: `${page.inset ?? 59}px`,
    paddingRight: `${page.inset ?? 59}px`,
  }));
  vi.stubGlobal("screen", {});
  vi.stubGlobal("window", page);
  Object.defineProperty(globalThis, "innerWidth", {
    get: () => page.width ?? 932,
    configurable: true,
  });
  Object.defineProperty(globalThis, "innerHeight", {
    get: () => page.height ?? 430,
    configurable: true,
  });
  return { props, page };
}

it("writes the trimmed insets, follows a half turn, and clears them in portrait", async () => {
  const { props, page } = stubPage({ orientation: 90 });
  const { applyNotchInsets, CORNER_ROOM } =
    await import("../../apps/client/src/notch-insets");
  expect(applyNotchInsets()).toBe(true);
  expect(props.get("--safe-left")).toBe("59px");
  expect(props.get("--safe-right")).toBe(`${CORNER_ROOM}px`);
  expect(applyNotchInsets()).toBe(false); // nothing new
  page.orientation = -90; // half turn: same size, notch now on the right
  expect(applyNotchInsets()).toBe(true);
  expect(props.get("--safe-left")).toBe(`${CORNER_ROOM}px`);
  expect(props.get("--safe-right")).toBe("59px");
  Object.assign(page, { orientation: 0, width: 430, height: 932 });
  expect(applyNotchInsets()).toBe(true);
  expect(props.has("--safe-left")).toBe(false);
  expect(props.has("--safe-right")).toBe(false);
});

it("leaves insets someone else set alone", async () => {
  const { props } = stubPage({ orientation: 90 });
  props.set("--safe-left", "40px");
  props.set("--safe-right", "40px");
  const { applyNotchInsets } =
    await import("../../apps/client/src/notch-insets");
  expect(applyNotchInsets()).toBe(false);
  expect(props.get("--safe-right")).toBe("40px");
});

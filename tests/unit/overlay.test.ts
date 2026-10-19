import { afterEach, expect, it, vi } from "vitest";
import { setOverlayMarkup } from "../../apps/client/src/overlay";
afterEach(() => vi.unstubAllGlobals());
it("preserves button content across snapshots until the overlay state changes", () => {
  let writes = 0,
    html = "";
  const element = {
    get innerHTML() {
      return html;
    },
    set innerHTML(value: string) {
      writes++;
      html = value;
    },
  } as HTMLElement;
  const ready = '<button id="instructions-ready">I’m ready</button>';
  setOverlayMarkup(element, ready);
  for (let i = 0; i < 30; i++)
    expect(setOverlayMarkup(element, ready)).toBe(false);
  expect(writes).toBe(1);
  expect(setOverlayMarkup(element, "Waiting for opponent…")).toBe(true);
  setOverlayMarkup(element, "");
  setOverlayMarkup(element, "");
  expect(writes).toBe(3);
});

it("preserves a scrolling instruction panel and focus across live updates, resetting for a new screen", () => {
  let html = "",
    position = 0,
    scrollWrites = 0;
  const button = { id: "ready", hasAttribute: () => false, focus: vi.fn() };
  const scroller = {
    get scrollTop() {
      return position;
    },
    set scrollTop(value: number) {
      position = value;
      scrollWrites++;
    },
  };
  const element = {
    dataset: {},
    contains: (node: unknown) => node === button,
    querySelector: () => (html ? scroller : null),
    get innerHTML() {
      return html;
    },
    set innerHTML(value: string) {
      html = value;
      position = 0;
    },
  } as unknown as HTMLElement;
  vi.stubGlobal("document", {
    activeElement: button,
    getElementById: () => button,
  });
  setOverlayMarkup(element, "Instructions and Ready", "briefing");
  position = 120;
  scrollWrites = 0;
  for (let i = 0; i < 10; i++)
    setOverlayMarkup(element, "Instructions and Ready", "briefing");
  expect(scrollWrites).toBe(0);
  setOverlayMarkup(element, "Instructions and Waiting", "briefing");
  expect(position).toBe(120);
  expect(button.focus).toHaveBeenLastCalledWith({ preventScroll: true });
  setOverlayMarkup(element, "Match results", "finished");
  expect(position).toBe(0);
});

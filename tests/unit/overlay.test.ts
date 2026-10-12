import { expect, it } from "vitest";
import { setOverlayMarkup } from "../../apps/client/src/overlay";
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

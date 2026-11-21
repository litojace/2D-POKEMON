import { afterEach, describe, expect, it, vi } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { focusForTyping, pinScreen } from "../../apps/client/src/screen-pin";

const page = (x: number, y: number) => {
  const w = {
    scrollX: x,
    scrollY: y,
    scrollTo(nx: number, ny: number) {
      w.scrollX = nx;
      w.scrollY = ny;
    },
  };
  return w;
};

// A fixed-screen page Safari left lifted goes back to the top (screen-pin.ts).
describe("screen pin", () => {
  it("puts a lifted hub or battle back at the top", () => {
    const w = page(0, 74);
    expect(pinScreen(w, true, false, false)).toBe(true);
    expect([w.scrollX, w.scrollY]).toEqual([0, 0]);
  });
  it("leaves the keyboard's lift alone while typing", () => {
    const w = page(0, 74);
    expect(pinScreen(w, true, true, false)).toBe(false);
    expect(w.scrollY).toBe(74);
  });
  it("leaves pages that scroll, and dialogs' own pinning, alone", () => {
    expect(pinScreen(page(0, 300), false, false, false)).toBe(false);
    expect(pinScreen(page(0, 300), true, false, true)).toBe(false);
    expect(pinScreen(page(0, 0), true, false, false)).toBe(false);
  });
});

/**
 * A text field focused for typing never takes `preventScroll`: on iPhone and
 * iPad it also stops Safari lifting the page above the keyboard, so a field a
 * button opened sat under the keyboard (focusForTyping in screen-pin.ts).
 */
describe("text fields focused for typing", () => {
  const SRC = join(__dirname, "../../apps/client/src");
  const files = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory()
        ? files(join(dir, e.name))
        : e.name.endsWith(".ts")
          ? [join(dir, e.name)]
          : [],
    );
  // One statement that finds or names an input box and focuses it unscrolled.
  const FIELD_NO_SCROLL =
    /(HTMLInputElement|HTMLTextAreaElement|\binput\b|#fr-add-code)[^;{}]*\.focus\(\{\s*preventScroll:\s*true/g;
  it("let the browser bring them above the keyboard", () => {
    const found = files(SRC).flatMap((file) =>
      [...readFileSync(file, "utf8").matchAll(FIELD_NO_SCROLL)].map(
        (m) => `${relative(SRC, file)}: ${m[0].replace(/\s+/g, " ")}`,
      ),
    );
    expect(found).toEqual([]);
  });
  // focus() with select() kept the name box under the iPhone keyboard where
  // focus() alone was lifted: selecting goes through focusForTyping only.
  it("select their text only through focusForTyping", () => {
    const found = files(SRC)
      .filter((file) => !file.endsWith("screen-pin.ts"))
      .flatMap((file) =>
        [
          ...readFileSync(file, "utf8").matchAll(
            /(HTMLInputElement|HTMLTextAreaElement|\binput\b|\bfield\b)[^;{}]*\.select\(\)/g,
          ),
        ].map((m) => `${relative(SRC, file)}: ${m[0].replace(/\s+/g, " ")}`),
      );
    expect(found).toEqual([]);
  });
});

describe("focusForTyping", () => {
  class FakeInput {
    calls: string[] = [];
    focus(options?: unknown) {
      this.calls.push(options === undefined ? "focus" : "focus+options");
    }
    select() {
      this.calls.push("select");
    }
  }
  const touch = (coarse: boolean) => {
    vi.stubGlobal("HTMLInputElement", FakeInput);
    vi.stubGlobal("matchMedia", (q: string) => ({
      matches: coarse && q === "(pointer: coarse)",
    }));
  };
  afterEach(() => vi.unstubAllGlobals());

  it("focuses with no options, so iOS may lift the page", () => {
    touch(true);
    const f = new FakeInput();
    expect(focusForTyping(f as unknown as HTMLElement)).toBe(true);
    expect(f.calls).toEqual(["focus"]);
    expect(focusForTyping(null)).toBe(false);
  });
  it("selects the text with a mouse, never on a touch screen", () => {
    touch(true);
    const phone = new FakeInput();
    focusForTyping(phone as unknown as HTMLElement, { selectAll: true });
    expect(phone.calls).toEqual(["focus"]);
    touch(false);
    const desk = new FakeInput();
    focusForTyping(desk as unknown as HTMLElement, { selectAll: true });
    expect(desk.calls).toEqual(["focus", "select"]);
  });
});

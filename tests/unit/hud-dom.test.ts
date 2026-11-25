import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  setHudDisabled,
  setHudHidden,
  setHudMarkup,
  setHudText,
  sweepPercent,
} from "../../apps/client/src/hud-dom";

/**
 * A stand-in for an element that counts what a browser would have to
 * answer: nodes put in or taken out (Chromium restyles everything a
 * `:has()` rule can reach for each one), and attribute writes.
 */
function element(text = "") {
  const el = {
    children: [] as { nodeType: number; data: string; remove(): void }[],
    inserted: 0,
    removed: 0,
    hiddenWrites: 0,
    isHidden: false,
    get firstChild() {
      return el.children[0] ?? null;
    },
    get lastChild() {
      return el.children[el.children.length - 1] ?? null;
    },
    get textContent() {
      return el.children.map((c) => c.data).join("");
    },
    set textContent(value: string) {
      el.removed += el.children.length;
      el.children = [];
      if (value) {
        el.children.push(node(value));
        el.inserted++;
      }
    },
    get hidden() {
      return el.isHidden;
    },
    set hidden(value: boolean) {
      el.hiddenWrites++;
      el.isHidden = value;
    },
  };
  const node = (data: string) => {
    const n = {
      nodeType: 3,
      data,
      remove() {
        el.children = el.children.filter((c) => c !== n);
        el.removed++;
      },
    };
    return n;
  };
  if (text) el.children.push(node(text));
  return el;
}
const asElement = (el: ReturnType<typeof element>) =>
  el as unknown as HTMLElement;

describe("battle HUD writes (docs/network-performance.md, section 20)", () => {
  it("changes a countdown in its own text node: nothing goes in or out", () => {
    const el = element("3.2");
    const first = el.firstChild;
    for (const text of ["3.1", "3.0", "2.9", "2.9", "2.8"])
      setHudText(asElement(el), text);
    expect(el.textContent).toBe("2.8");
    expect(el.firstChild).toBe(first);
    expect([el.inserted, el.removed]).toEqual([0, 0]);
  });
  it("writes nothing for the same text", () => {
    const el = element("Cindrake");
    let writes = 0;
    const text = el.firstChild!;
    let data = text.data;
    Object.defineProperty(text, "data", {
      get: () => data,
      set(value: string) {
        writes++;
        data = value;
      },
    });
    for (let frame = 0; frame < 60; frame++)
      setHudText(asElement(el), "Cindrake");
    expect(writes).toBe(0);
    expect([el.inserted, el.removed]).toEqual([0, 0]);
  });
  it("empties and fills again (`:empty` stays true to the markup)", () => {
    const el = element("1.0");
    setHudText(asElement(el), "");
    expect(el.children).toHaveLength(0);
    setHudText(asElement(el), "");
    expect([el.inserted, el.removed]).toEqual([0, 1]);
    setHudText(asElement(el), "8.0");
    expect(el.textContent).toBe("8.0");
    expect(el.inserted).toBe(1);
  });
  it("leaves `hidden` alone when it is already so", () => {
    const el = element();
    for (let frame = 0; frame < 60; frame++) setHudHidden(asElement(el), true);
    setHudHidden(asElement(el), false);
    expect(el.hiddenWrites).toBe(2);
    expect(el.hidden).toBe(false);
  });
  it("moves a cooldown ring in half percents, within 0–100", () => {
    expect(sweepPercent(33.26)).toBe("33.5%");
    expect(sweepPercent(33.2)).toBe("33%");
    expect(sweepPercent(-4)).toBe("0%");
    expect(sweepPercent(140)).toBe("100%");
    // An 18 s cooldown at 30 snapshots a second: 540 snapshots, 201 steps.
    const steps = new Set<string>();
    for (let tick = 0; tick <= 540; tick++)
      steps.add(sweepPercent((100 * tick) / 540));
    expect(steps.size).toBe(201);
  });
});

describe("the battle's per-frame code", () => {
  const read = (file: string) =>
    readFileSync(
      new URL(`../../apps/client/src/${file}`, import.meta.url),
      "utf8",
    );
  it("never reads the window's size itself (viewport-size.ts keeps it)", () => {
    // A read forces the page's styles and layout up to date: in the scene's
    // update it cost a style recalculation in the middle of every frame.
    const lines = read("main.ts")
      .split("\n")
      .filter((line) => /\binner(Width|Height)\b/.test(line));
    // The one read left: the device line of a problem report.
    expect(lines.map((line) => line.trim().slice(0, 8))).toEqual(["device: "]);
  });
  it("gives the cooldown to its ring alone, with no copy that inherits", () => {
    const css = read("style.css");
    expect(css).toMatch(/@property --cooldown \{[^}]*inherits: false/);
    expect(css).not.toMatch(/--skill-sweep\s*:/);
    // Running a transition on it restyled the button every frame.
    expect(css).not.toMatch(/transition:[^;]*--cooldown/);
  });
  it("counts cooldowns down in place", () => {
    const touch = read("touch-controls.ts");
    expect(touch).not.toMatch(/label\.textContent = text/);
    expect(touch).toContain(
      'setHudText(button.querySelector<HTMLElement>(".touch-cooldown")!, text)',
    );
  });
});

describe("a card of markup (the raid's revive card)", () => {
  /** As a browser: `innerHTML` reads back differently from what was set. */
  function card() {
    let node: object | null = null;
    const el = {
      writes: 0,
      get firstChild() {
        return node;
      },
      get innerHTML() {
        return "<svg><path></path></svg>";
      },
      set innerHTML(value: string) {
        el.writes++;
        node = value ? {} : null;
      },
      clear() {
        node = null;
      },
    };
    return el;
  }
  it("is built once, not at every snapshot", () => {
    const el = card();
    const html = el as unknown as HTMLElement;
    const markup = "<svg><path/></svg><b>Downed</b><span>0%</span>";
    for (let i = 0; i < 30; i++) setHudMarkup(html, markup);
    expect(el.writes).toBe(1);
    expect(setHudMarkup(html, markup.replace("0%", "12%"))).toBe(true);
    expect(el.writes).toBe(2);
  });
  it("is built again after someone else emptied it", () => {
    const el = card();
    const html = el as unknown as HTMLElement;
    setHudMarkup(html, "<b>Downed</b>");
    el.clear();
    expect(setHudMarkup(html, "<b>Downed</b>")).toBe(true);
    expect(el.writes).toBe(2);
  });
  it("leaves a button's disabled alone when it is the same", () => {
    let writes = 0;
    const button = {
      off: false,
      get disabled() {
        return button.off;
      },
      set disabled(v: boolean) {
        writes++;
        button.off = v;
      },
    };
    for (let i = 0; i < 30; i++) setHudDisabled(button, true);
    setHudDisabled(button, false);
    expect(writes).toBe(2);
  });
});

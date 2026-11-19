import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { syncHubGraphics } from "../../apps/client/src/hub-graphics";

/** A document with just enough for syncHubGraphics. */
function page(low: string[]) {
  const classes = new Set<string>();
  return {
    classes,
    doc: {
      body: {
        classList: {
          toggle: (name: string, on: boolean) =>
            on ? classes.add(name) : classes.delete(name),
        },
      },
      querySelector: (selector: string) => {
        expect(selector).toBe(
          '.plaza-layer[data-graphics="low"]',
        );
        return low.length ? {} : null;
      },
    } as unknown as Document,
  };
}

describe("hub graphics class", () => {
  it("marks the body while the Plaza is at Low", () => {
    const low = page(["plaza"]);
    syncHubGraphics(low.doc);
    expect(low.classes.has("hub-graphics-low")).toBe(true);
    const high = page([]);
    high.classes.add("hub-graphics-low");
    syncHubGraphics(high.doc);
    expect(high.classes.has("hub-graphics-low")).toBe(false);
  });
});

/**
 * :has() selectors that restyled far more than the element that changed
 * on every battle HUD update (docs/network-performance.md, "Battle style
 * recalculation"): they are classes now and must stay so.
 */
describe("selectors kept off :has()", () => {
  const css = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      if (statSync(path).isDirectory()) return css(path);
      return name.endsWith(".css") ? [readFileSync(path, "utf8")] : [];
    });
  const all = css("apps/client/src").join("\n");
  it.each([
    ".prefs-grid:has(",
    "dialog:has(.admin-tabs)",
    'body:has(.plaza-layer[data-graphics="low"])',
  ])("%s", (selector) => {
    expect(all).not.toContain(selector);
  });
});

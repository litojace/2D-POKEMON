import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EDITABLE, blocksMenu } from "../../apps/client/src/touch-hold";

// The game is not a page to copy from: a long press on a phone (hold to
// harvest on the Farm) or a drag or right click on a computer selects
// nothing and opens no menu (owner, 6–7 Nov 2026).
const field = { closest: (s: string) => (s === EDITABLE ? {} : null) };
const plain = { closest: () => null };

describe("menus and selection", () => {
  it("cancels a menu or a drag everywhere but a field you type in", () => {
    expect(blocksMenu(plain)).toBe(true);
    expect(blocksMenu(null)).toBe(true);
    expect(blocksMenu(field)).toBe(false);
    expect(EDITABLE).toContain("input");
    expect(EDITABLE).toContain("textarea");
  });
  it("the stylesheet stops selection, the callout and image drags on every device, not in fields", () => {
    const css = readFileSync("apps/client/src/style.css", "utf8");
    const at = css.indexOf("/* Not a page to copy");
    expect(at).toBeGreaterThan(-1);
    const block = css.slice(at, at + 900);
    // Not inside a media query: phones and computers alike.
    expect(block).toMatch(
      /\*\/\nhtml \{\s*-webkit-user-select: none;\s*user-select: none;\s*-webkit-touch-callout: none;/,
    );
    expect(block).toMatch(/img,\s*a,\s*svg \{\s*-webkit-user-drag: none;/);
    expect(block).toMatch(
      /:is\(input, textarea, select, \[contenteditable="true"\]\) \{\s*-webkit-user-select: text;\s*user-select: text;/,
    );
  });
});

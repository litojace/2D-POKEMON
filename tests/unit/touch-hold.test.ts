import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { EDITABLE, blocksTouchMenu } from "../../apps/client/src/touch-hold";

// A long press on a phone is a game action (hold to harvest on the Farm),
// not the phone's text selection or Copy menu (owner, 6 Nov 2026).
const field = { closest: (s: string) => (s === EDITABLE ? {} : null) };
const plain = { closest: () => null };

describe("long press on a touch screen", () => {
  it("cancels a finger's context menu, except in a field you type in", () => {
    expect(blocksTouchMenu(true, plain)).toBe(true);
    expect(blocksTouchMenu(true, null)).toBe(true);
    expect(blocksTouchMenu(true, field)).toBe(false);
    // A mouse's right click keeps its menu.
    expect(blocksTouchMenu(false, plain)).toBe(false);
    expect(EDITABLE).toContain("input");
    expect(EDITABLE).toContain("textarea");
  });
  it("the stylesheet stops selection and the callout on touch screens, not in fields", () => {
    const css = readFileSync("apps/client/src/style.css", "utf8");
    const block = css.slice(
      css.indexOf("@media (any-pointer: coarse) {\n  html {"),
    );
    expect(block).toMatch(
      /^@media \(any-pointer: coarse\) \{\s*html \{\s*-webkit-user-select: none;\s*user-select: none;\s*-webkit-touch-callout: none;/,
    );
    expect(block).toMatch(
      /:is\(input, textarea, select, \[contenteditable="true"\]\) \{\s*-webkit-user-select: text;\s*user-select: text;/,
    );
  });
});

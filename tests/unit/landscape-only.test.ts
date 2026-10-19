import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Element Arena plays in landscape only on touch devices. */
describe("landscape only", () => {
  const css = readFileSync("apps/client/src/style.css", "utf8");
  const html = readFileSync("apps/client/index.html", "utf8");
  const config = readFileSync("apps/client/vite.config.ts", "utf8");
  it("asks installed apps to open in landscape (Android honours it)", () => {
    expect(config).toMatch(/orientation:\s*"landscape"/);
  });
  it("covers every screen on touch devices held upright, never on desktop", () => {
    expect(html).toContain('id="rotate-gate"');
    // Hidden by default, shown only for touch screens in portrait.
    expect(css).toMatch(/#rotate-gate\s*\{\s*display:\s*none;\s*\}/);
    const rule = css.match(/@media \(orientation: portrait\) and \(pointer: coarse\) and \(hover: none\) \{\s*#rotate-gate \{[^}]*\}/);
    expect(rule?.[0]).toMatch(/position:\s*fixed;\s*inset:\s*0;/);
    expect(rule?.[0]).toContain("display: grid");
    // Dialogs (top layer) are hidden behind it too.
    expect(css).toMatch(/dialog \{ visibility: hidden; \}/);
  });
});

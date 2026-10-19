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
    expect(css).toMatch(/dialog \{ visibility: hidden; opacity: 0; pointer-events: none; \}/);
  });
  it("keeps the stylesheet's braces balanced (a lost one nests later rules)", () => {
    const code = css.replace(/\/\*[\s\S]*?\*\//g, "");
    let depth = 0;
    for (const ch of code) {
      if (ch === "{") depth++;
      if (ch === "}") depth--;
      expect(depth).toBeGreaterThanOrEqual(0);
    }
    expect(depth).toBe(0);
  });
});

describe("shop grid", () => {
  it("keeps a lone filtered card card-sized (auto-fill, never auto-fit)", () => {
    const css = readFileSync("apps/client/src/style.css", "utf8");
    const rules = css.match(/\.shop-grid \{[^}]*grid-template-columns:[^;]*;/g) ?? [];
    expect(rules.length).toBeGreaterThan(0);
    for (const rule of rules) expect(rule).not.toContain("auto-fit");
  });
});

describe("main screens", () => {
  it("share one fixed size, so switching tabs never resizes the window", () => {
    const css = readFileSync("apps/client/src/style.css", "utf8");
    const rule = css.match(/dialog:is\(:has\(\.shop\), :has\(\.raid-hub\)[^{]*\{[^}]*\}/)?.[0] ?? "";
    for (const screen of [".missions-screen", ".profile-screen", ".friends-screen", "#leaderboard-body", ".admin-tabs"]) expect(rule).toContain(screen);
    // A fixed height, not just a cap.
    expect(rule).toMatch(/\n\s*height: var\(--hub-height\);/);
  });
});

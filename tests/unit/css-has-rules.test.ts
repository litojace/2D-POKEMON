import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * `.a:has(...) > *` (or `.a:has(...) *`): a `:has()` in the middle of a
 * selector that then matches every child. Chrome rechecks such a rule on
 * every style change anywhere in the page, battles included, even when the
 * screen it styles is closed. One of them (`.pf-main:has(> .pf-account) > *`,
 * the Profile screen) cost about 40% of all style recalculation in a duel
 * (25 Nov 2026; a Pixel 8a spent 22 ms a frame). Use a class set by the
 * screen's markup instead (profile-view.ts `has-account`).
 */
function hasThenAny(selector: string) {
  const at = selector.lastIndexOf(":has(");
  if (at < 0) return false;
  let depth = 0,
    end = at + 4;
  for (; end < selector.length; end++) {
    if (selector[end] === "(") depth++;
    else if (selector[end] === ")" && --depth === 0) break;
  }
  return (
    /^\s*[>~+]?\s*\*\s*$/.test(selector.slice(end + 1)) &&
    /\S/.test(selector.slice(end + 1))
  );
}

describe("CSS :has() rules", () => {
  it("never match every child after a :has() (slow style recalculation on Chrome)", () => {
    const files = execSync(
      "git ls-files 'apps/client/src/*.css' 'apps/client/src/**/*.css'",
    )
      .toString()
      .trim()
      .split("\n");
    const bad: string[] = [];
    for (const file of files) {
      const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
      // Each rule's selector list: the text before a "{" back to the last
      // "}", ";" or "{" (at-rule preludes such as @media are skipped).
      for (const m of css.matchAll(/(?:^|[{};])\s*([^{};@][^{};]*)\{/g))
        for (const sel of m[1].split(/,(?![^(]*\))/))
          if (hasThenAny(sel.trim()))
            bad.push(`${file}  ${sel.trim().replace(/\s+/g, " ")}`);
    }
    expect(bad).toEqual([]);
  });

  it("catches the pattern", () => {
    expect(hasThenAny(".pf-main:has(> .pf-account) > *")).toBe(true);
    expect(hasThenAny(".a:has(.b) *")).toBe(true);
    expect(hasThenAny(".pf-main.has-account > *")).toBe(false);
    expect(hasThenAny(".a:has(.b) .c")).toBe(false);
    expect(hasThenAny(".a:has(> .b)")).toBe(false);
  });
});

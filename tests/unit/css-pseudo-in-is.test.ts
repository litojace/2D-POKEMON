import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";

/**
 * A pseudo-element (`::before`, `::after`, `::placeholder`…) inside `:is()`,
 * `:where()`, `:not()` or `:has()` is not valid there. The browser drops it
 * from the forgiving list without a word, and the rest of the rule applies,
 * so it looks as if it works. light-effects.css listed `.lobby-play::before`
 * and a raid cosmetic's `::after` in the `:is()` that stops the looping
 * lights on Low graphics and with Reduce motion: both loops kept running
 * (27 Nov 2026). Write `.a::before` as a selector of its own, or
 * `:is(.a, .b)::before`.
 */
export function pseudoInsideList(css: string) {
  const clean = css.replace(/\/\*[\s\S]*?\*\//g, (m) =>
    m.replace(/[^\n]/g, " "),
  );
  const found: { line: number; text: string }[] = [];
  const open = /:(is|where|not|has)\(/g;
  let m: RegExpExecArray | null;
  while ((m = open.exec(clean))) {
    let depth = 1,
      i = m.index + m[0].length;
    const start = i;
    while (i < clean.length && depth) {
      if (clean[i] === "(") depth++;
      else if (clean[i] === ")") depth--;
      i++;
    }
    const inner = clean.slice(start, i - 1);
    if (/::[a-z-]/i.test(inner))
      found.push({
        line: clean.slice(0, m.index).split("\n").length,
        text: `:${m[1]}(${inner.replace(/\s+/g, " ").trim()})`,
      });
  }
  return found;
}

describe("pseudo-elements stay outside :is(), :where(), :not() and :has()", () => {
  it("finds one, and leaves a pseudo-element after the list alone", () => {
    expect(pseudoInsideList(".x :is(.a, .b::before) { }")).toHaveLength(1);
    expect(pseudoInsideList(".x :where(*, *::after) { }")).toHaveLength(1);
    expect(pseudoInsideList(":is(.a, .b)::before { }")).toEqual([]);
    expect(pseudoInsideList("/* :is(.a::before) */ .a { }")).toEqual([]);
  });

  it("no client stylesheet has one", () => {
    const files = execSync(
      "git ls-files 'apps/client/src/*.css' 'apps/client/src/**/*.css'",
    )
      .toString()
      .trim()
      .split("\n")
      .filter(Boolean);
    expect(files.length).toBeGreaterThan(20);
    const bad = files.flatMap((f) =>
      pseudoInsideList(readFileSync(f, "utf8")).map(
        (h) => `${f}:${h.line} ${h.text.slice(0, 100)}`,
      ),
    );
    expect(bad).toEqual([]);
  });
});

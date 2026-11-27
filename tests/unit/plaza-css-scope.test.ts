import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The Plaza's styles stay on the Plaza. Shared screens open inside the
 * Plaza's layer (your player card: `.plaza-layer > .ui-panel-host`), so a
 * rule like `.plaza-layer button { font: inherit; color: inherit }` also
 * restyled the card's tabs, buttons and title chips there: the card looked
 * different on the Plaza than in the Lobby (owner, 24 Nov). Each rule under
 * `.plaza-layer` must name the Plaza's own part (`.pz`, a `pz-` class or
 * id, `:where(.pz)`), so the card is the Lobby's card wherever it opens.
 */
const ALLOWED = new Set([
  // Hidden is hidden everywhere (the shared UI relies on it too).
  ".plaza-layer [hidden]",
  // Where the shared panel host sits over the Plaza (no Lobby rail).
  ".plaza-layer > .ui-panel-host",
]);

/** The selectors of a stylesheet, split on top-level commas only. */
function selectors(css: string) {
  const out: string[] = [];
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of text.matchAll(/([^{}]+)\{/g)) {
    const head = m[1].trim();
    if (!head || head.startsWith("@") || /^(from|to|[\d.]+%)\b/.test(head))
      continue;
    let depth = 0;
    let part = "";
    for (const ch of head) {
      if (ch === "(") depth++;
      if (ch === ")") depth--;
      if (ch === "," && depth === 0) {
        out.push(part.trim());
        part = "";
      } else part += ch;
    }
    out.push(part.trim());
  }
  return out.map((s) => s.replace(/\s+/g, " "));
}

/** The part of a selector after `.plaza-layer`'s own compound. */
function inside(sel: string) {
  const at = sel.indexOf(".plaza-layer");
  let i = at + ".plaza-layer".length;
  let depth = 0;
  for (; i < sel.length; i++) {
    const ch = sel[i];
    if (ch === "(") depth++;
    if (ch === ")") depth--;
    if (depth === 0 && (ch === " " || ch === ">")) break;
  }
  return sel.slice(i).trim();
}

describe("plaza.css", () => {
  const css = readFileSync("apps/client/src/plaza/plaza.css", "utf8");
  it("styles only the Plaza's own parts, never a screen opened over it", () => {
    const loose = selectors(css)
      .filter((s) => s.includes(".plaza-layer") && !ALLOWED.has(s))
      .filter((s) => {
        const rest = inside(s);
        return rest !== "" && !/[.#]pz\b|[.#]pz-|:where\(\.pz\)/.test(rest);
      });
    expect(loose).toEqual([]);
  });
  it("catches the rule that restyled the player card's buttons", () => {
    const bad = ".plaza-layer button { font: inherit; }";
    const found = selectors(bad).filter(
      (s) => !/[.#]pz\b|[.#]pz-|:where\(\.pz\)/.test(inside(s)),
    );
    expect(found).toEqual([".plaza-layer button"]);
  });
});

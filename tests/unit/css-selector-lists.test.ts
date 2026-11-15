import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, it } from "vitest";

/**
 * No empty item in a selector list, such as a comma left before the `)` of
 * an `:is(...)`. Chromium skips the empty item and keeps the rule, so the
 * visual tests pass, but the build's CSS minifier reports it as a syntax
 * error and other engines need not be as forgiving: on an iPhone the whole
 * rule could be dropped.
 */
const SRC = join(__dirname, "../../apps/client/src");

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? e.name === "node_modules"
        ? []
        : cssFiles(join(dir, e.name))
      : e.name.endsWith(".css")
        ? [join(dir, e.name)]
        : [],
  );
}

it("no selector list in the client's CSS has an empty item", () => {
  const found: string[] = [];
  for (const file of cssFiles(SRC)) {
    // Comments out, so a comma in prose is not counted.
    const css = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, (c) =>
      c.replace(/[^\n]/g, " "),
    );
    // A `,` then `)` up to a rule's `{` (in a selector; a value's
    // `var(--x, )` ends at `;` or `}`, never at `{`), or `(,` likewise.
    for (const m of css.matchAll(/(,\s*\)|\(\s*,)[^;{}]*\{/g)) {
      const line = css.slice(0, m.index).split("\n").length;
      found.push(`${relative(SRC, file)}:${line}`);
    }
  }
  expect(found).toEqual([]);
});

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/** Every stylesheet the client ships. */
function stylesheets(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return stylesheets(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

describe("no content-visibility in the client's styles", () => {
  // Safari on iPhone sometimes skipped drawing the insides of a roster card
  // with content-visibility: auto once it was picked: the card's frame showed,
  // its fighter and name stayed blank (owner, 12 Nov). Raid hall cards had the
  // same rule. Desktop Chromium never shows it, so the visual tests can't
  // catch it coming back: this does.
  it.each(stylesheets("apps/client/src"))("%s", (file) => {
    const rules = readFileSync(file, "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "")
      .match(/content-visibility\s*:[^;}]*/g);
    expect(rules, file).toBeNull();
  });
});

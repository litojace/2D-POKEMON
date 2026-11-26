import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The backdrops item pictures stand on (--r-backdrop in ui/components.css):
 *  tiles, the Shop's deal card and the action bar. */
describe("rarity backdrops", () => {
  const css = readFileSync("apps/client/src/ui/components.css", "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
  /** The rule that sets a tier's colour and backdrop. */
  const rule = (tier: string) =>
    css.match(
      new RegExp(`\\[data-rarity="${tier}"\\][^{]*\\{([^}]*)\\}`),
    )?.[1] ?? "";
  const backdrop = (tier: string) =>
    rule(tier).match(/--r-backdrop:([^;]*);/)?.[1] ?? "";

  it("gives each tier above Common a backdrop of still gradients only", () => {
    for (const tier of ["rare", "epic", "legendary", "mythical"]) {
      const value = backdrop(tier);
      expect(value, tier).toMatch(/gradient\(/);
      // No pictures, filters or motion: a grid of tiles costs the same on
      // Low graphics as on High.
      expect(value, tier).not.toMatch(
        /url\(|image-set|filter|var\(--[a-z-]*anim/,
      );
    }
  });

  it("lights a Legendary softly from behind the head, without a fan of rays", () => {
    // The rays looked busy in a grid of Legendaries side by side; the owner
    // chose a halo instead (26 Nov 2026, option B of the demo).
    const value = backdrop("legendary");
    expect(value).not.toMatch(/conic-gradient/);
    expect(value).toMatch(/radial-gradient\(\s*circle at 50% 40%/);
  });
});

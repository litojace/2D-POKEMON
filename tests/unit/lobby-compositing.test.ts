import { readFileSync, existsSync } from "node:fs";
import { expect, it } from "vitest";

// The Lobby's live fighter redraws every frame over its backdrop. A
// full-screen CSS filter and a blended glow under it made the aura stutter
// on an iPhone while the Shop (its panel covering both) stayed smooth
// (owner, iPhone 17 Pro Max, 17 Nov 2026): the blur is baked into the
// picture (scripts/lobby-backdrop/blur.py) and the glow is plain alpha.
const css = readFileSync("apps/client/src/lobby.css", "utf8");
const rule = (selector: string) => {
  const start = css.indexOf(`\n${selector} {`);
  expect(start, selector).toBeGreaterThan(-1);
  return css.slice(start, css.indexOf("\n}", start));
};

it("draws the Lobby's backdrop from a pre-blurred picture, with no filter", () => {
  const backdrop = rule(".lobby-backdrop");
  expect(backdrop).not.toMatch(/^\s*filter:/m);
  const url = backdrop.match(
    /\/assets\/backgrounds\/lobby-backdrop-[0-9a-f]{8}\.webp/,
  );
  expect(url).not.toBeNull();
  expect(existsSync(`apps/client/public${url![0]}`)).toBe(true);
});

it("lays the fighter's glow without a blend mode", () => {
  expect(rule(".lobby-fighter::before")).not.toMatch(/mix-blend-mode/);
});

it("gives the Lobby fighter's canvas its own compositing layer", () => {
  // The iPhone read-out: the page at 27 frames a second, our drawing 1 ms.
  expect(css).toMatch(
    /\.lobby-fighter-art > canvas,\s*\.lobby-member-art > canvas \{\s*will-change: transform;/,
  );
});

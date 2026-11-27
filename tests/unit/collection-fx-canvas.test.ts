import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

/**
 * The Look effects draw on Phaser Graphics in a match and on the canvas
 * stand-in (fx-canvas.ts) in every Shop, Wardrobe and reward thumbnail. A
 * call the stand-in lacks throws there and blanks the tile: a rounded stroke
 * on Candy's cake did (26 Nov), caught only by the visual specs.
 */
it("draws Look effects only with calls the thumbnail canvas has", () => {
  const fx = [
    "apps/client/src/skins/collection-fx.ts",
    "apps/client/src/skins/raid-entrance-fx.ts",
    "apps/client/src/skins/raid-aura-fx.ts",
    "apps/client/src/skins/raid-victory-fx.ts",
  ]
    .map((f) => readFileSync(f, "utf8"))
    .join("\n");
  const canvas = readFileSync("apps/client/src/skins/fx-canvas.ts", "utf8");
  const used = new Set(
    [
      ...fx.matchAll(
        /\.(fill[A-Z]\w*|stroke[A-Z]\w*|lineBetween|lineStyle|beginPath|arc|moveTo|lineTo|closePath)\(/g,
      ),
    ].map((m) => m[1]),
  );
  expect(used.size).toBeGreaterThan(8);
  const missing = [...used].filter(
    (m) => !new RegExp(`\\b${m}\\s*\\(`).test(canvas),
  );
  expect(missing).toEqual([]);
});

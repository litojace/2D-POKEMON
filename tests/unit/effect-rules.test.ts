import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";

/**
 * Skill effects draw through the effects engine (fx-engine.ts: fx.g,
 * fx.floor, fx.glow, fx.soft, fx.burst, fx.trail) or the shared `shot`
 * helper, never by adding their own game objects to the scene. That keeps
 * every effect inside the battle graphics levels (particles, trails and
 * Low's glow budget), inside the effect budget test's counts
 * (tests/visual/effect-budget.spec.ts), and pooled: an object made per cast
 * costs an older phone a display-list insert and sort each time. Timers
 * that only drive drawing into the engine's layers (tweens.addCounter) are
 * fine.
 */
const SRC = join(__dirname, "../../apps/client/src");
const FILES = readdirSync(SRC).filter(
  (f) =>
    /^skill-fx-.*\.ts$/.test(f) ||
    f === "fx-physics.ts" ||
    // the bosses' attack effects keep to the same rule
    /-attack-fx\.ts$/.test(f),
);
const OWN_OBJECTS =
  /\.add\.(graphics|image|sprite|text|circle|rectangle|ellipse|particles|container|line|polygon|arc|star|triangle|zone)\s*\(|new\s+Phaser\./;

it("finds the skill effect files", () => {
  expect(FILES.length).toBeGreaterThanOrEqual(11);
  expect(FILES).toContain("prismell-attack-fx.ts");
});

it("draws skill effects through the effects engine, not with their own scene objects", () => {
  const offenders = FILES.flatMap((file) => {
    const lines = readFileSync(join(SRC, file), "utf8").split("\n");
    return lines.flatMap((line, i) =>
      OWN_OBJECTS.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [],
    );
  });
  expect(offenders).toEqual([]);
});

it("would catch an effect that adds its own object, on any line", () => {
  expect(OWN_OBJECTS.test("const g = scene.add.graphics();")).toBe(true);
  expect(OWN_OBJECTS.test("fx.glow(x, y, 20, c);")).toBe(false);
  // Two in a row are both caught (no state carried between lines).
  const lines = ["scene.add.image(0, 0, k);", "scene.add.text(0, 0, t);"];
  expect(lines.filter((l) => OWN_OBJECTS.test(l))).toHaveLength(2);
});

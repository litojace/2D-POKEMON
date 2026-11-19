import { expect, it } from "vitest";
import {
  CHARACTERS,
  COMBOS,
  RITES,
  inMeters,
  meters,
} from "../../packages/shared/src/index";
import { RAID_ATTACKS } from "../../packages/shared/src/raid";

it("shows court pixels as meters, 50 px to the meter", () => {
  expect(meters(300)).toBe("6 m");
  expect(meters(165)).toBe("3.3 m");
  expect(inMeters("A 240 px curtain, 90px out, 200 px a second.")).toBe(
    "A 4.8 m curtain, 1.8 m out, 4 m a second.",
  );
  // Other words that happen to start with "px" are left alone.
  expect(inMeters("pxl 12 pixels")).toBe("pxl 12 pixels");
});

it("leaves no px in any text a player reads about a champion or a raid", () => {
  const texts = [
    ...Object.values(CHARACTERS).flatMap((c) => [
      c.description,
      c.basic.description,
      ...c.skills.map((s) => s.description),
    ]),
    ...RITES.map((r) => r.text),
    ...Object.values(COMBOS).map((c) => c.text),
    ...Object.values(RAID_ATTACKS).flatMap((a) => [a.tip, a.summary]),
  ];
  for (const t of texts) expect(t).not.toMatch(/\d\s?px\b/);
});

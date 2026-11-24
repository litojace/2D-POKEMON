import { expect, it } from "vitest";
import { CHARACTERS } from "@arena/shared";
import {
  abilityArtwork,
  abilityIcon,
} from "../../apps/client/src/ability-icons";
import { SKILL_ART_NAMES } from "../../apps/client/src/skill-art";
it("gives all ninety basic attacks and skills explicit artwork", () => {
  const names = Object.values(CHARACTERS).flatMap((c) =>
    [c.basic, ...c.skills].map((a) => a.name),
  );
  expect(names).toHaveLength(90);
  expect(new Set(names).size).toBe(names.length);
  expect(names.every((name) => !!abilityArtwork[name])).toBe(true);
  expect(
    new Set(names.map((name) => abilityArtwork[name].art)).size,
  ).toBeGreaterThan(30);
  // Every move has its own illustrated scene.
  for (const name of names) expect(SKILL_ART_NAMES, name).toContain(name);
  expect(new Set(names.map((name) => abilityIcon(name))).size).toBe(
    names.length,
  );
  expect(
    names.every((name) => abilityIcon(name).includes('aria-hidden="true"')),
  ).toBe(true);
});

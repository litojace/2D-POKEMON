import { expect, it } from "vitest";
import { CHARACTERS } from "@arena/shared";
import {
  abilityArtwork,
  abilityIcon,
} from "../../apps/client/src/ability-icons";
it("gives all forty basic attacks and skills explicit artwork", () => {
  const names = Object.values(CHARACTERS).flatMap((c) =>
    [c.basic, ...c.skills].map((a) => a.name),
  );
  expect(names).toHaveLength(40);
  expect(names.every((name) => !!abilityArtwork[name])).toBe(true);
  expect(
    new Set(names.map((name) => abilityArtwork[name].art)).size,
  ).toBeGreaterThan(15);
  expect(
    names.every((name) => abilityIcon(name).includes('aria-hidden="true"')),
  ).toBe(true);
});

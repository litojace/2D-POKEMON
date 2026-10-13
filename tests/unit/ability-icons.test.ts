import { expect, it } from "vitest";
import { CHARACTERS } from "@arena/shared";
import {
  abilityArtwork,
  abilityIcon,
} from "../../apps/client/src/ability-icons";
it("gives all twenty-four configured abilities explicit explicit artwork", () => {
  const names = Object.values(CHARACTERS).flatMap((c) =>
    c.skills.map((a) => a.name),
  );
  expect(names).toHaveLength(24);
  expect(names.every((name) => !!abilityArtwork[name])).toBe(true);
  expect(
    new Set(names.map((name) => abilityArtwork[name].art)).size,
  ).toBeGreaterThan(15);
  expect(
    names.every((name) => abilityIcon(name).includes('aria-hidden="true"')),
  ).toBe(true);
});

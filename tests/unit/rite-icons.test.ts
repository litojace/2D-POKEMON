import { it, expect } from "vitest";
import { RITES } from "@arena/shared";
import { riteAbility, riteEffect, riteIcon, RITE_EFFECTS } from "../../apps/client/src/rite-icons";
import { abilityArtwork } from "../../apps/client/src/ability-icons";

it("gives every rite its skill's own icon and an effect badge", () => {
  for (const rite of RITES) {
    const ability = riteAbility(rite);
    expect(ability, rite.id).toBeDefined();
    expect(abilityArtwork[ability!.name] ?? null, ability!.name).not.toBeNull();
    const effect = riteEffect(rite);
    expect(RITE_EFFECTS[effect]).toBeDefined();
    const html = riteIcon(rite);
    expect(html).toContain("skill-icon");
    expect(html).toContain("rite-badge");
  }
  // Majors that change how a move works read as a new move or effect.
  const thunder = RITES.find((r) => r.name === "Thunderhead")!;
  expect(riteEffect(thunder)).toBe("transform");
  const lockdown = RITES.find((r) => r.name === "Lockdown Grid")!;
  expect(riteEffect(lockdown)).toBe("status");
  expect(riteEffect(RITES.find((r) => r.name === "Quick Lance")!)).toBe("cooldown");
});

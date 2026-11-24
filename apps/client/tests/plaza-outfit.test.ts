import { expect, it } from "vitest";
import { plazaOutfitKey } from "../src/plaza/plaza-outfit";
import type { RaidLoadout } from "../../../packages/shared/src/raid";
it("notices changes in every wardrobe slot even when the selected champion stays the same", () => {
  const old = plazaOutfitKey("auralynx", null, {});
  for (const slot of ["skin", "aura", "entrance", "victory", "frame"] as const)
    expect(plazaOutfitKey("auralynx", null, { [slot]: "new-item" })).not.toBe(
      old,
    );
});
it("notices champion and Awakening changes without resending reordered or empty loadouts", () => {
  const look: RaidLoadout = { skin: "candy-colours", aura: "nightmote" };
  expect(plazaOutfitKey("auralynx", null, look)).toBe(
    plazaOutfitKey("auralynx", undefined, {
      aura: "nightmote",
      skin: "candy-colours",
    }),
  );
  expect(plazaOutfitKey("auralynx", null, {})).toBe(
    plazaOutfitKey("auralynx", undefined, { skin: null, aura: null }),
  );
  expect(
    plazaOutfitKey(
      "auralynx",
      { skin: "auralynx-celestial-sage", stage: 1 },
      look,
    ),
  ).not.toBe(
    plazaOutfitKey(
      "auralynx",
      { skin: "auralynx-celestial-sage", stage: 3 },
      look,
    ),
  );
  expect(plazaOutfitKey("auralynx", null, look)).not.toBe(
    plazaOutfitKey("voltkit", null, look),
  );
});

import { expect, it } from "vitest";
import { townOutfitKey } from "../src/town-outfit";
import type { RaidLoadout } from "../../../packages/shared/src/raid";
it("notices changes in every wardrobe slot even when the selected champion stays the same", () => {
  const old = townOutfitKey("auralynx", null, {});
  for (const slot of ["skin", "aura", "entrance", "victory", "frame"] as const)
    expect(townOutfitKey("auralynx", null, { [slot]: "new-item" })).not.toBe(
      old,
    );
});
it("notices champion and Awakening changes without resending reordered or empty loadouts", () => {
  const look: RaidLoadout = { skin: "candy-colours", aura: "nightmote" };
  expect(townOutfitKey("auralynx", null, look)).toBe(
    townOutfitKey("auralynx", undefined, {
      aura: "nightmote",
      skin: "candy-colours",
    }),
  );
  expect(townOutfitKey("auralynx", null, {})).toBe(
    townOutfitKey("auralynx", undefined, { skin: null, aura: null }),
  );
  expect(
    townOutfitKey(
      "auralynx",
      { skin: "auralynx-celestial-sage", stage: 1 },
      look,
    ),
  ).not.toBe(
    townOutfitKey(
      "auralynx",
      { skin: "auralynx-celestial-sage", stage: 3 },
      look,
    ),
  );
  expect(townOutfitKey("auralynx", null, look)).not.toBe(
    townOutfitKey("voltkit", null, look),
  );
});

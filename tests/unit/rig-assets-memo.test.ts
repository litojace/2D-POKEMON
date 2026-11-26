import { expect, it } from "vitest";
import { rigAssets } from "../../apps/client/src/animation/assets";

// A look's whole set of layers is made once while anything holds it: the
// battle reuses the sets the menus and the room made (fighter-prepaint.ts)
// instead of making them again for every battle (assets.ts `sets`).
it("hands out the same set of layers for the same look", () => {
  const own = rigAssets("voltkit");
  expect(rigAssets("voltkit")).toBe(own);
  expect(rigAssets("voltkit", null)).toBe(own);
  const skin = rigAssets("voltkit", { skin: "voltkit-wayfarer" });
  expect(skin).not.toBe(own);
  expect(rigAssets("voltkit", { skin: "voltkit-wayfarer" })).toBe(skin);
  expect(skin.every((a) => a.key.includes("~voltkit-wayfarer"))).toBe(true);
  expect(rigAssets("tidefin")).not.toBe(own);
});

it("makes a preview's few facings fresh (only whole sets are kept)", () => {
  const down = rigAssets("cindrake", null, ["down"]);
  expect(rigAssets("cindrake", null, ["down"])).not.toBe(down);
  expect(down.length).toBeLessThan(rigAssets("cindrake").length);
});

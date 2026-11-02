import { expect, it } from "vitest";
import {
  cosmeticTier,
  TIER_NAMES,
} from "../../packages/shared/src/cosmetic-tier";
import {
  RAID_REWARDS,
  frameStars,
  type RaidProgress,
} from "../../packages/shared/src/raid";
import type { Economy } from "../../packages/shared/src/shop";
import { cosmeticPicture } from "../../apps/client/src/cosmetic-picture";
import {
  frameStarNote,
  wardrobeMarkup,
  wardrobePreviewParts,
} from "../../apps/client/src/wardrobe-ui";

const economy = {
  owned: ["galaxy-frame"],
  looks: {},
  awakening: {},
} as unknown as Economy;
const progress = (clears: number, id = "conqueror", boss = "grumblecrag") =>
  ({
    cosmetics: [id],
    earned: [id],
    loadout: {},
    bosses: { [boss]: { clears } },
  }) as unknown as RaidProgress;

it("every boss frame's stars, tier label and thumbnail agree at each tier boundary", () => {
  for (const item of RAID_REWARDS.filter((r) => r.slot === "frame" && r.boss)) {
    for (const clears of [0, 9, 10, 29, 30, 49, 50, 100]) {
      const p = progress(clears, item.id, item.boss!);
      const stars = frameStars(item.id, { [item.boss!]: clears });
      const expected =
        stars >= 5 ? "mythic" : stars >= 3 ? "legendary" : "epic";
      expect(cosmeticTier(item.id, stars)).toBe(expected);
      const picture = cosmeticPicture(item.id, "voltkit", "test", stars);
      expect(picture).toContain(`data-tier="${expected}"`);
      expect(picture).toContain(`data-frame-stars="${stars}"`);
      expect(picture).not.toContain("<svg");
      const markup = wardrobeMarkup(
        { champion: "voltkit", slot: "frame", action: "idle" },
        economy,
        p,
        {},
      );
      expect(markup).toContain(
        `data-frame-stars="${stars}" data-tier="${expected}"`,
      );
      if (stars === 5) {
        expect(frameStarNote(item.id, p)).toContain("★★★★★ Mythical");
        expect(frameStarNote(item.id, p)).not.toContain(">★★★★★ Legendary");
      }
    }
  }
});
it("future levels are try-ons only, while the earned level and equip action stay unchanged", () => {
  const p = progress(16);
  const before = JSON.stringify({ economy, p });
  for (let stars = 0; stars <= 5; stars++) {
    const parts = wardrobePreviewParts(
      {
        champion: "voltkit",
        slot: "frame",
        preview: "conqueror",
        action: "idle",
        frameStars: stars,
      },
      economy,
      p,
      {},
    );
    expect(parts.stage).toContain(`data-frame-stars="${stars}"`);
    expect(parts.stage).toContain(
      `data-tier="${cosmeticTier("conqueror", stars)}"`,
    );
    expect(parts.stage).not.toContain("<svg");
    expect(parts.animations.match(/data-wardrobe-frame-stars=/g)).toHaveLength(
      6,
    );
    expect(parts.animations).toContain("Your level: 1★");
    expect(parts.footer).toContain('data-wardrobe-save="conqueror"');
    if (stars > 1)
      expect(parts.animations).toContain(
        `Unlock at ${stars * 10} wins against Grumblecrag.`,
      );
  }
  expect(JSON.stringify({ economy, p })).toBe(before);
});
it("Shop frames retain their own rarity without a boss-level picker", () => {
  const parts = wardrobePreviewParts(
    {
      champion: "voltkit",
      slot: "frame",
      preview: "galaxy-frame",
      action: "idle",
      frameStars: 5,
    },
    economy,
    progress(50),
    {},
  );
  expect(parts.stage).toContain(`data-tier="mythic"`);
  expect(parts.animations).not.toContain("data-wardrobe-frame-stars");
  expect(parts.animations).toContain(TIER_NAMES.mythic);
});
it("viewing a lower level on a maxed frame never invents a sixth star", () => {
  const parts = wardrobePreviewParts(
    {
      champion: "voltkit",
      slot: "frame",
      preview: "conqueror",
      action: "idle",
      frameStars: 0,
    },
    economy,
    progress(50),
    {},
  );
  expect(parts.animations).toContain("Your level: 5★");
  expect(parts.animations).toContain("Maximum level earned.");
  expect(parts.animations).not.toContain("50/60");
});

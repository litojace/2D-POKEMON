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
  fitView,
  fittingRoomParts,
  pendingChanges,
  type FitData,
  type FitView,
} from "../../apps/client/src/screens/fitting-room-view";

// Boss frames climb with stars (10 clears each). In the Wardrobe (the
// fitting room, UI remodel step 2) a star level can be previewed on the
// stage; only the item is ever saved, never a preview level.
const economy = {
  balance: 0,
  owned: ["galaxy-frame"],
  picks: { day: "2026-10-17", items: [], deal: null },
  trialWins: {},
  looks: {},
  awakening: {},
  missions: [],
  rerolled: false,
  streak: 0,
  today: { raidClears: 0, pvpMatches: 0 },
} as unknown as Economy;
const progress = (clears: number, id = "conqueror", boss = "grumblecrag") =>
  ({
    cosmetics: [id],
    earned: [id],
    loadout: {},
    bosses: { [boss]: { clears } },
  }) as unknown as RaidProgress;
const data = (
  p: RaidProgress,
  e: Economy = economy,
  look: FitData["look"] = {},
): FitData => ({ economy: e, progress: p, look });
const frameView = (extra: Partial<FitView> = {}) =>
  fitView("wardrobe", "voltkit", {
    slot: "frame",
    selected: "conqueror",
    ...extra,
  });

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
      // The Wardrobe tile: the same picture, stars and rarity label.
      const body = fittingRoomParts(
        fitView("wardrobe", "voltkit", { slot: "frame" }),
        data(p),
      ).body;
      expect(body).toContain(
        `data-frame-stars="${stars}" data-tier="${expected}"`,
      );
      const tile = body.slice(body.indexOf(`data-ui-item="${item.id}"`));
      expect(tile).toContain(
        `${"★".repeat(stars)}${"☆".repeat(5 - stars)} · Boss reward`,
      );
      expect(tile).toContain(`>${TIER_NAMES[expected]}</span>`);
    }
  }
});
it("future levels are try-ons only, while the earned level and equip action stay unchanged", () => {
  const p = progress(16);
  const before = JSON.stringify({ economy, p });
  for (let stars = 0; stars <= 5; stars++) {
    const view = frameView({
      frameStars: stars,
      tryOn: { frame: "conqueror" },
    });
    const parts = fittingRoomParts(view, data(p));
    expect(parts.stage).toContain(`data-frame-stars="${stars}"`);
    expect(parts.stage).toContain(
      `data-tier="${cosmeticTier("conqueror", stars)}"`,
    );
    expect(parts.stage).toContain('data-fighter="voltkit"');
    expect(parts.stage).toContain('class="portrait-disc"');
    expect(parts.stage.match(/data-fit-stars=/g)).toHaveLength(6);
    expect(parts.stage).toContain("Your level: 1★");
    if (stars > 1)
      expect(parts.stage).toContain(`Unlock at ${stars * 10} wins`);
    // Equip saves the frame itself; a preview level is never sent.
    expect(pendingChanges(view, data(p))).toEqual([
      { slot: "frame", from: null, to: "conqueror" },
    ]);
    expect(parts.foot).not.toMatch(/disabled[^>]*data-fit-save/);
  }
  expect(JSON.stringify({ economy, p })).toBe(before);
});
it("Shop frames keep their own rarity, with no level picker", () => {
  const parts = fittingRoomParts(
    frameView({ selected: "galaxy-frame", frameStars: 5 }),
    data(progress(50)),
  );
  expect(parts.stage).toContain(
    `data-tier="${cosmeticTier("galaxy-frame", 0)}"`,
  );
  expect(parts.stage).not.toContain("data-fit-stars");
});
it("viewing a lower level on a maxed frame never invents a sixth star", () => {
  const stage = fittingRoomParts(
    frameView({ frameStars: 0 }),
    data(progress(50)),
  ).stage;
  expect(stage).toContain("Your level: 5★");
  expect(stage).toContain("Maximum level earned.");
  expect(stage).not.toContain("50/60");
});
it("reviews the actual equipped champion skin and awakening stage inside the chosen frame", () => {
  const e = {
    ...economy,
    looks: { tidefin: { skin: "tidefin-moontide", stage: 3 } },
  } as Economy;
  const stage = fittingRoomParts(
    fitView("wardrobe", "tidefin", { slot: "frame", selected: "conqueror" }),
    data(progress(40), e, { skin: "candy-colours" }),
  ).stage;
  expect(stage).toContain('data-portrait-frame="conqueror"');
  expect(stage).toContain('data-frame-stars="4"');
  expect(stage).toContain('data-fighter="tidefin"');
  expect(stage).toContain("tidefin-moontide");
  expect(stage).not.toContain("preview-palette-candy-colours-fit-frame-live");
});
it("shows equipped Colors on the avatar when no champion skin covers them", () => {
  const stage = fittingRoomParts(
    fitView("wardrobe", "terradon", { slot: "frame", selected: "conqueror" }),
    data(progress(20), economy, { skin: "candy-colours" }),
  ).stage;
  expect(stage).toContain('data-fighter="terradon"');
  expect(stage).toContain(
    'id="preview-palette-candy-colours-fit-frame-live-colors"',
  );
  expect(stage).toContain('data-frame-stars="2"');
});

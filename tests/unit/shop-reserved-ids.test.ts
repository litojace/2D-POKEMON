import { expect, it } from "vitest";
import {
  ALL_BUNDLES,
  CHAMPION_SKINS,
  LOOK_ITEMS,
} from "../../packages/shared/src/shop";
import { REWARD_ITEMS } from "../../packages/shared/src/journey";
import { RAID_REWARDS } from "../../packages/shared/src/raid";

/**
 * Everything the Shop sells and every reward the game gives share one id
 * space: the reward items of the Journey, the seasons and the collection
 * frames are rows of arena_shop_items (never on sale), and a raid reward is
 * equipped by its id in the same slots. The catalog seed is an upsert, so a
 * new Shop item named like a reward (`astral-aura`, `void-frame`...) would
 * overwrite the reward's row: its name, its price, its collection.
 */
const sold = [...CHAMPION_SKINS, ...LOOK_ITEMS, ...ALL_BUNDLES].map(
  (i) => i.id,
);
const rewards = [
  ...REWARD_ITEMS.map((i) => i.id),
  ...RAID_REWARDS.map((r) => r.id),
];

it("never sells an item under a reward's id", () => {
  expect(rewards.length).toBeGreaterThan(80);
  expect(sold.filter((id) => rewards.includes(id))).toEqual([]);
});

it("keeps Shop ids unique and in the form the database and the seed check read", () => {
  expect(new Set(sold).size).toBe(sold.length);
  for (const id of sold) expect(id).toMatch(/^[a-z]+(-[a-z0-9]+)+$/);
});

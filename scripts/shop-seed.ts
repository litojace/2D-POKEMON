/**
 * The SQL seed rows for the Shop catalog and missions from
 * packages/shared/src/shop.ts, for pasting into a migration. Print them with
 *   node --experimental-strip-types scripts/print-shop-seed.ts
 * tests/unit/shop-catalog.test.ts checks the migration still matches.
 */
import {
  CHAMPION_SKINS,
  LOOK_ITEMS,
  MISSIONS,
  SHOP_BUNDLES,
  skinPrice,
} from "../packages/shared/src/shop.ts";

const q = (s: string | null | undefined) =>
  s == null ? "null" : `'${s.replace(/'/g, "''")}'`;
const items = [
  ...CHAMPION_SKINS.map(
    (s) =>
      `  (${q(s.id)}, 'champion', ${q(s.champion)}, null, ${q(s.name)}, ${q(s.rarity)}, ${q(s.collection)}, ${skinPrice(s)}, null)`,
  ),
  ...LOOK_ITEMS.map(
    (i) =>
      `  (${q(i.id)}, 'look', null, ${q(i.slot)}, ${q(i.name)}, ${q(i.rarity)}, ${q(i.collection)}, ${i.price}, null)`,
  ),
  ...SHOP_BUNDLES.map(
    (b) =>
      `  (${q(b.id)}, 'bundle', null, null, ${q(b.name)}, null, ${q(b.collection)}, 0, array[${b.items.map(q).join(", ")}])`,
  ),
];
export const shopItemsSql = (
  `insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values\n${items.join(",\n")}\non conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,\n  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;`
);
export const missionsSql = (
  `insert into public.arena_missions(id, tier, text, metric, target, coins, champions) values\n${MISSIONS.map(
    (m) =>
      `  (${q(m.id)}, ${q(m.tier)}, ${q(m.text)}, ${q(m.metric)}, ${m.target}, ${m.coins}, ${m.champions ? `array[${m.champions.map(q).join(", ")}]` : "null"})`,
  ).join(",\n")}\non conflict (id) do update set tier = excluded.tier, text = excluded.text, metric = excluded.metric,\n  target = excluded.target, coins = excluded.coins, champions = excluded.champions;`
);

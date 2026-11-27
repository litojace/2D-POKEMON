-- Look pieces sold on their own, outside any set. Safe to run again; keeps
-- ownership.
--
-- Eight pieces, each with its own theme, slot and tier, priced like a set's
-- piece of that slot and tier (docs/shop-new-items.md, item 9):
--   Firefly aura      Rare       900   Crystal aura      Epic     1,440
--   Bubble entrance   Rare     1,000   Portal entrance   Epic     1,600
--   Laurel frame      Rare       800   Crown frame       Epic     1,280
--   Trophy victory    Epic     1,800   Meteor victory    Mythical 4,500
-- No set and no bundle. Their collection, 'singles', has no champion skins,
-- so arena_collection_bonus never gives a frame away.
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
-- New rows stay out of Today's Picks (in_picks false) until a migration
-- opens them.
begin;

-- Never add items before the picks opt-in exists: they would join Today's Picks.
do $$
begin
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'arena_shop_items' and column_name = 'in_picks'
  ) then
    raise exception 'Run 20261125120000_shop_picks_opt_in.sql first';
  end if;
end $$;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('firefly-aura', 'look', null, 'aura', 'Firefly aura', 'rare', 'singles', 900, null),
  ('crystal-aura', 'look', null, 'aura', 'Crystal aura', 'epic', 'singles', 1440, null),
  ('bubble-entrance', 'look', null, 'entrance', 'Bubble entrance', 'rare', 'singles', 1000, null),
  ('portal-entrance', 'look', null, 'entrance', 'Portal entrance', 'epic', 'singles', 1600, null),
  ('laurel-frame', 'look', null, 'frame', 'Laurel frame', 'rare', 'singles', 800, null),
  ('crown-frame', 'look', null, 'frame', 'Crown frame', 'epic', 'singles', 1280, null),
  ('trophy-victory', 'look', null, 'victory', 'Trophy victory', 'epic', 'singles', 1800, null),
  ('meteor-victory', 'look', null, 'victory', 'Meteor victory', 'mythical', 'singles', 4500, null)
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

select
  (select count(*) from public.arena_shop_items where collection = 'singles' and kind = 'look' and active) as singles,
  (select count(*) from public.arena_shop_items where collection = 'singles' and in_picks) as in_todays_picks;

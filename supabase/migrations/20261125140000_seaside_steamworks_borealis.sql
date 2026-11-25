-- Three Look sets: Seaside, Steamworks and Borealis. Safe to run again; keeps ownership.
--
-- Five pieces each (Colors, Aura, Entrance, Frame, Victory), for every
-- champion, and their set at 80% of the pieces you don't own yet:
--   Seaside     standard set   300 /   900 / 1,000 /   800 / 1,800
--   Steamworks  premium set    480 / 1,440 / 1,600 / 1,280 / 2,880
--   Borealis    showcase set   750 / 2,250 / 2,500 / 2,000 / 4,500
-- the same prices as the sets of their tier (Candy; Winter; Galaxy).
-- None of the three has champion skins, so arena_collection_bonus never
-- gives their frame away.
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
-- They are new rows, so they stay out of Today's Picks (in_picks is false by
-- default, 20261125120000_shop_picks_opt_in.sql) until a migration opens them.
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
  ('seaside-colours', 'look', null, 'skin', 'Seaside colors', 'common', 'seaside', 300, null),
  ('seaside-aura', 'look', null, 'aura', 'Seashell aura', 'rare', 'seaside', 900, null),
  ('seaside-entrance', 'look', null, 'entrance', 'Sandcastle entrance', 'rare', 'seaside', 1000, null),
  ('seaside-frame', 'look', null, 'frame', 'Shell frame', 'rare', 'seaside', 800, null),
  ('seaside-victory', 'look', null, 'victory', 'Sunset victory', 'epic', 'seaside', 1800, null),
  ('steamworks-colours', 'look', null, 'skin', 'Brass colors', 'rare', 'steamworks', 480, null),
  ('steamworks-aura', 'look', null, 'aura', 'Gear aura', 'epic', 'steamworks', 1440, null),
  ('steamworks-entrance', 'look', null, 'entrance', 'Wind-up entrance', 'epic', 'steamworks', 1600, null),
  ('steamworks-frame', 'look', null, 'frame', 'Cog frame', 'epic', 'steamworks', 1280, null),
  ('steamworks-victory', 'look', null, 'victory', 'Clock-tower victory', 'epic', 'steamworks', 2880, null),
  ('borealis-colours', 'look', null, 'skin', 'Borealis colors', 'epic', 'borealis', 750, null),
  ('borealis-aura', 'look', null, 'aura', 'Northern-lights aura', 'mythical', 'borealis', 2250, null),
  ('borealis-entrance', 'look', null, 'entrance', 'Skyfall entrance', 'mythical', 'borealis', 2500, null),
  ('borealis-frame', 'look', null, 'frame', 'Polar-star frame', 'mythical', 'borealis', 2000, null),
  ('borealis-victory', 'look', null, 'victory', 'Sky-curtain victory', 'mythical', 'borealis', 4500, null),
  ('seaside-set', 'bundle', null, null, 'Seaside set', null, 'seaside', 0, array['seaside-colours', 'seaside-aura', 'seaside-entrance', 'seaside-frame', 'seaside-victory']),
  ('steamworks-set', 'bundle', null, null, 'Steamworks set', null, 'steamworks', 0, array['steamworks-colours', 'steamworks-aura', 'steamworks-entrance', 'steamworks-frame', 'steamworks-victory']),
  ('borealis-set', 'bundle', null, null, 'Borealis set', null, 'borealis', 0, array['borealis-colours', 'borealis-aura', 'borealis-entrance', 'borealis-frame', 'borealis-victory'])
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

select
  (select count(*) from public.arena_shop_items where collection in ('seaside', 'steamworks', 'borealis') and kind = 'look' and active) as look_pieces,
  (select count(*) from public.arena_shop_items where id in ('seaside-set', 'steamworks-set', 'borealis-set') and cardinality(items) = 5) as sets,
  (select count(*) from public.arena_shop_items where collection in ('seaside', 'steamworks', 'borealis') and in_picks) as in_todays_picks;

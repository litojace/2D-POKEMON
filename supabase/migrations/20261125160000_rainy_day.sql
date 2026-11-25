-- Rainy Day: a Rare collection, a raincoat for every champion. Safe to run again; keeps ownership.
--
-- 18 skins, each with its own way of keeping dry (a sou'wester, a frog hat,
-- an umbrella, a lotus leaf, a toadstool...), Rare at 1,500 coins, and their
-- full-roster set: like the other sets it costs 80% of the skins you don't
-- own yet (arena_item_price) and buying it grants each skin (arena_buy_item).
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
  ('voltkit-rainy-day', 'champion', 'voltkit', null, 'Puddle Jumper', 'rare', 'rainy-day', 1500, null),
  ('cindrake-rainy-day', 'champion', 'cindrake', null, 'Dry Ember', 'rare', 'rainy-day', 1500, null),
  ('tidefin-rainy-day', 'champion', 'tidefin', null, 'Rain Dancer', 'rare', 'rainy-day', 1500, null),
  ('auralynx-rainy-day', 'champion', 'auralynx', null, 'Drizzle Duelist', 'rare', 'rainy-day', 1500, null),
  ('lumoth-rainy-day', 'champion', 'lumoth', null, 'Dewdrop', 'rare', 'rainy-day', 1500, null),
  ('mystowl-rainy-day', 'champion', 'mystowl', null, 'Storm Watcher', 'rare', 'rainy-day', 1500, null),
  ('terradon-rainy-day', 'champion', 'terradon', null, 'Lily Pad', 'rare', 'rainy-day', 1500, null),
  ('duskveil-rainy-day', 'champion', 'duskveil', null, 'Grey Skies', 'rare', 'rainy-day', 1500, null),
  ('coilemur-rainy-day', 'champion', 'coilemur', null, 'Puddle Skipper', 'rare', 'rainy-day', 1500, null),
  ('pyranda-rainy-day', 'champion', 'pyranda', null, 'Rubber Ducky', 'rare', 'rainy-day', 1500, null),
  ('glacelle-rainy-day', 'champion', 'glacelle', null, 'Mizzle', 'rare', 'rainy-day', 1500, null),
  ('halcyra-rainy-day', 'champion', 'halcyra', null, 'Squall Rider', 'rare', 'rainy-day', 1500, null),
  ('sunbara-rainy-day', 'champion', 'sunbara', null, 'Froggy Day', 'rare', 'rainy-day', 1500, null),
  ('astrabun-rainy-day', 'champion', 'astrabun', null, 'Cloud Hopper', 'rare', 'rainy-day', 1500, null),
  ('wombolder-rainy-day', 'champion', 'wombolder', null, 'Mudlark', 'rare', 'rainy-day', 1500, null),
  ('shadopus-rainy-day', 'champion', 'shadopus', null, 'Brolly Top', 'rare', 'rainy-day', 1500, null),
  ('pangrove-rainy-day', 'champion', 'pangrove', null, 'Toadstool Shelter', 'rare', 'rainy-day', 1500, null),
  ('mossloth-rainy-day', 'champion', 'mossloth', null, 'Dozy Drizzle', 'rare', 'rainy-day', 1500, null),
  ('rainy-day-skins', 'bundle', null, null, 'Rainy Day skins', null, 'rainy-day', 0, array['voltkit-rainy-day', 'cindrake-rainy-day', 'tidefin-rainy-day', 'auralynx-rainy-day', 'lumoth-rainy-day', 'mystowl-rainy-day', 'terradon-rainy-day', 'duskveil-rainy-day', 'coilemur-rainy-day', 'pyranda-rainy-day', 'glacelle-rainy-day', 'halcyra-rainy-day', 'sunbara-rainy-day', 'astrabun-rainy-day', 'wombolder-rainy-day', 'shadopus-rainy-day', 'pangrove-rainy-day', 'mossloth-rainy-day'])
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

select
  (select count(*) from public.arena_shop_items where collection = 'rainy-day' and kind = 'champion' and rarity = 'rare' and price = 1500 and active) as rainy_day_skins,
  (select cardinality(items) from public.arena_shop_items where id = 'rainy-day-skins') as set_pieces,
  (select count(*) from public.arena_shop_items where collection = 'rainy-day' and in_picks) as in_todays_picks;

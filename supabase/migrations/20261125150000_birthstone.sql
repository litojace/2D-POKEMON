-- Birthstone: a Common collection, a gemstone palette for every champion. Safe to run again; keeps ownership.
--
-- 18 skins, one gem each (Amethyst, Sapphire, Citrine...), Common at 500
-- coins, and their full-roster set: like the other sets it costs 80% of the
-- skins you don't own yet (arena_item_price) and buying it grants each skin
-- (arena_buy_item).
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
  ('voltkit-birthstone', 'champion', 'voltkit', null, 'Amethyst', 'common', 'birthstone', 500, null),
  ('cindrake-birthstone', 'champion', 'cindrake', null, 'Sapphire', 'common', 'birthstone', 500, null),
  ('tidefin-birthstone', 'champion', 'tidefin', null, 'Citrine', 'common', 'birthstone', 500, null),
  ('auralynx-birthstone', 'champion', 'auralynx', null, 'Emerald', 'common', 'birthstone', 500, null),
  ('lumoth-birthstone', 'champion', 'lumoth', null, 'Ruby', 'common', 'birthstone', 500, null),
  ('mystowl-birthstone', 'champion', 'mystowl', null, 'Topaz', 'common', 'birthstone', 500, null),
  ('terradon-birthstone', 'champion', 'terradon', null, 'Turquoise', 'common', 'birthstone', 500, null),
  ('duskveil-birthstone', 'champion', 'duskveil', null, 'Garnet', 'common', 'birthstone', 500, null),
  ('coilemur-birthstone', 'champion', 'coilemur', null, 'Peridot', 'common', 'birthstone', 500, null),
  ('pyranda-birthstone', 'champion', 'pyranda', null, 'Aquamarine', 'common', 'birthstone', 500, null),
  ('glacelle-birthstone', 'champion', 'glacelle', null, 'Opal', 'common', 'birthstone', 500, null),
  ('halcyra-birthstone', 'champion', 'halcyra', null, 'Tourmaline', 'common', 'birthstone', 500, null),
  ('sunbara-birthstone', 'champion', 'sunbara', null, 'Lapis', 'common', 'birthstone', 500, null),
  ('astrabun-birthstone', 'champion', 'astrabun', null, 'Moonstone', 'common', 'birthstone', 500, null),
  ('wombolder-birthstone', 'champion', 'wombolder', null, 'Malachite', 'common', 'birthstone', 500, null),
  ('shadopus-birthstone', 'champion', 'shadopus', null, 'Onyx', 'common', 'birthstone', 500, null),
  ('pangrove-birthstone', 'champion', 'pangrove', null, 'Tanzanite', 'common', 'birthstone', 500, null),
  ('mossloth-birthstone', 'champion', 'mossloth', null, 'Carnelian', 'common', 'birthstone', 500, null),
  ('birthstone-skins', 'bundle', null, null, 'Birthstone skins', null, 'birthstone', 0, array['voltkit-birthstone', 'cindrake-birthstone', 'tidefin-birthstone', 'auralynx-birthstone', 'lumoth-birthstone', 'mystowl-birthstone', 'terradon-birthstone', 'duskveil-birthstone', 'coilemur-birthstone', 'pyranda-birthstone', 'glacelle-birthstone', 'halcyra-birthstone', 'sunbara-birthstone', 'astrabun-birthstone', 'wombolder-birthstone', 'shadopus-birthstone', 'pangrove-birthstone', 'mossloth-birthstone'])
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

select
  (select count(*) from public.arena_shop_items where collection = 'birthstone' and kind = 'champion' and rarity = 'common' and price = 500 and active) as birthstone_skins,
  (select cardinality(items) from public.arena_shop_items where id = 'birthstone-skins') as set_pieces,
  (select count(*) from public.arena_shop_items where collection = 'birthstone' and in_picks) as in_todays_picks;

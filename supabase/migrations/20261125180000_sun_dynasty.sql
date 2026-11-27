-- Sun Dynasty: a Legendary collection, a figure of a desert court for every champion. Safe to run again; keeps ownership.
--
-- 18 skins in gold and lapis, each with glowing pieces, a motif of its own,
-- a sun-mosaic landing and a winged-sunrise victory, Legendary at 5,500
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
  ('voltkit-sun-dynasty', 'champion', 'voltkit', null, 'Storm Charioteer', 'legendary', 'sun-dynasty', 5500, null),
  ('cindrake-sun-dynasty', 'champion', 'cindrake', null, 'Phoenix Prince', 'legendary', 'sun-dynasty', 5500, null),
  ('tidefin-sun-dynasty', 'champion', 'tidefin', null, 'River Pilot', 'legendary', 'sun-dynasty', 5500, null),
  ('auralynx-sun-dynasty', 'champion', 'auralynx', null, 'Temple Cat', 'legendary', 'sun-dynasty', 5500, null),
  ('lumoth-sun-dynasty', 'champion', 'lumoth', null, 'Lamp Keeper', 'legendary', 'sun-dynasty', 5500, null),
  ('mystowl-sun-dynasty', 'champion', 'mystowl', null, 'Royal Astronomer', 'legendary', 'sun-dynasty', 5500, null),
  ('terradon-sun-dynasty', 'champion', 'terradon', null, 'Obelisk Builder', 'legendary', 'sun-dynasty', 5500, null),
  ('duskveil-sun-dynasty', 'champion', 'duskveil', null, 'Moon Vizier', 'legendary', 'sun-dynasty', 5500, null),
  ('coilemur-sun-dynasty', 'champion', 'coilemur', null, 'Dune Caravaneer', 'legendary', 'sun-dynasty', 5500, null),
  ('pyranda-sun-dynasty', 'champion', 'pyranda', null, 'Spice Healer', 'legendary', 'sun-dynasty', 5500, null),
  ('glacelle-sun-dynasty', 'champion', 'glacelle', null, 'Mirage Dancer', 'legendary', 'sun-dynasty', 5500, null),
  ('halcyra-sun-dynasty', 'champion', 'halcyra', null, 'Falcon Herald', 'legendary', 'sun-dynasty', 5500, null),
  ('sunbara-sun-dynasty', 'champion', 'sunbara', null, 'Sun Sovereign', 'legendary', 'sun-dynasty', 5500, null),
  ('astrabun-sun-dynasty', 'champion', 'astrabun', null, 'Lotus Sceptre', 'legendary', 'sun-dynasty', 5500, null),
  ('wombolder-sun-dynasty', 'champion', 'wombolder', null, 'Sphinx Guardian', 'legendary', 'sun-dynasty', 5500, null),
  ('shadopus-sun-dynasty', 'champion', 'shadopus', null, 'Royal Scribe', 'legendary', 'sun-dynasty', 5500, null),
  ('pangrove-sun-dynasty', 'champion', 'pangrove', null, 'Oasis Keeper', 'legendary', 'sun-dynasty', 5500, null),
  ('mossloth-sun-dynasty', 'champion', 'mossloth', null, 'Shade Bearer', 'legendary', 'sun-dynasty', 5500, null),
  ('sun-dynasty-skins', 'bundle', null, null, 'Sun Dynasty skins', null, 'sun-dynasty', 0, array['voltkit-sun-dynasty', 'cindrake-sun-dynasty', 'tidefin-sun-dynasty', 'auralynx-sun-dynasty', 'lumoth-sun-dynasty', 'mystowl-sun-dynasty', 'terradon-sun-dynasty', 'duskveil-sun-dynasty', 'coilemur-sun-dynasty', 'pyranda-sun-dynasty', 'glacelle-sun-dynasty', 'halcyra-sun-dynasty', 'sunbara-sun-dynasty', 'astrabun-sun-dynasty', 'wombolder-sun-dynasty', 'shadopus-sun-dynasty', 'pangrove-sun-dynasty', 'mossloth-sun-dynasty'])
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

select
  (select count(*) from public.arena_shop_items where collection = 'sun-dynasty' and kind = 'champion' and rarity = 'legendary' and price = 5500 and active) as sun_dynasty_skins,
  (select cardinality(items) from public.arena_shop_items where id = 'sun-dynasty-skins') as set_pieces,
  (select count(*) from public.arena_shop_items where collection = 'sun-dynasty' and in_picks) as in_todays_picks;

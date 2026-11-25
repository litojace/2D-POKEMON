-- Grand Prix: an Epic collection, a racing driver for every champion. Safe to run again; keeps ownership.
--
-- 18 skins, each in its team's suit with a number board that lights up and
-- its own headwear, Epic at 3,500 coins, and their full-roster set: like the
-- other sets it costs 80% of the skins you don't own yet (arena_item_price)
-- and buying it grants each skin (arena_buy_item).
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
  ('voltkit-grand-prix', 'champion', 'voltkit', null, 'Lightning Lap', 'epic', 'grand-prix', 3500, null),
  ('cindrake-grand-prix', 'champion', 'cindrake', null, 'Turbo Blaze', 'epic', 'grand-prix', 3500, null),
  ('tidefin-grand-prix', 'champion', 'tidefin', null, 'Slipstream', 'epic', 'grand-prix', 3500, null),
  ('auralynx-grand-prix', 'champion', 'auralynx', null, 'Pole Position', 'epic', 'grand-prix', 3500, null),
  ('lumoth-grand-prix', 'champion', 'lumoth', null, 'Night Rally', 'epic', 'grand-prix', 3500, null),
  ('mystowl-grand-prix', 'champion', 'mystowl', null, 'Rally Navigator', 'epic', 'grand-prix', 3500, null),
  ('terradon-grand-prix', 'champion', 'terradon', null, 'Off-Road Tank', 'epic', 'grand-prix', 3500, null),
  ('duskveil-grand-prix', 'champion', 'duskveil', null, 'Ghost Lap', 'epic', 'grand-prix', 3500, null),
  ('coilemur-grand-prix', 'champion', 'coilemur', null, 'Drift Spark', 'epic', 'grand-prix', 3500, null),
  ('pyranda-grand-prix', 'champion', 'pyranda', null, 'Pit Crew Chief', 'epic', 'grand-prix', 3500, null),
  ('glacelle-grand-prix', 'champion', 'glacelle', null, 'Ice Track', 'epic', 'grand-prix', 3500, null),
  ('halcyra-grand-prix', 'champion', 'halcyra', null, 'Air Race Ace', 'epic', 'grand-prix', 3500, null),
  ('sunbara-grand-prix', 'champion', 'sunbara', null, 'Sunrise Rally', 'epic', 'grand-prix', 3500, null),
  ('astrabun-grand-prix', 'champion', 'astrabun', null, 'Kart Star', 'epic', 'grand-prix', 3500, null),
  ('wombolder-grand-prix', 'champion', 'wombolder', null, 'Monster Wheel', 'epic', 'grand-prix', 3500, null),
  ('shadopus-grand-prix', 'champion', 'shadopus', null, 'Pit Wall Strategist', 'epic', 'grand-prix', 3500, null),
  ('pangrove-grand-prix', 'champion', 'pangrove', null, 'Jungle Rally', 'epic', 'grand-prix', 3500, null),
  ('mossloth-grand-prix', 'champion', 'mossloth', null, 'Slow Lane', 'epic', 'grand-prix', 3500, null),
  ('grand-prix-skins', 'bundle', null, null, 'Grand Prix skins', null, 'grand-prix', 0, array['voltkit-grand-prix', 'cindrake-grand-prix', 'tidefin-grand-prix', 'auralynx-grand-prix', 'lumoth-grand-prix', 'mystowl-grand-prix', 'terradon-grand-prix', 'duskveil-grand-prix', 'coilemur-grand-prix', 'pyranda-grand-prix', 'glacelle-grand-prix', 'halcyra-grand-prix', 'sunbara-grand-prix', 'astrabun-grand-prix', 'wombolder-grand-prix', 'shadopus-grand-prix', 'pangrove-grand-prix', 'mossloth-grand-prix'])
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

select
  (select count(*) from public.arena_shop_items where collection = 'grand-prix' and kind = 'champion' and rarity = 'epic' and price = 3500 and active) as grand_prix_skins,
  (select cardinality(items) from public.arena_shop_items where id = 'grand-prix-skins') as set_pieces,
  (select count(*) from public.arena_shop_items where collection = 'grand-prix' and in_picks) as in_todays_picks;

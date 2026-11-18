-- Sky Pirates: the second Legendary collection. Safe to run again; keeps ownership.
--
-- 18 sky-pirate captain skins, one per champion, Legendary at 5,500 coins
-- (the rarity came with 20261118100000), and their full-roster set: like the
-- other sets it costs 80% of the skins you don't own yet (arena_item_price)
-- and buying it grants each skin (arena_buy_item).
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-sky-pirates', 'champion', 'voltkit', null, 'Storm Corsair', 'legendary', 'sky-pirates', 5500, null),
  ('cindrake-sky-pirates', 'champion', 'cindrake', null, 'Cinder Buccaneer', 'legendary', 'sky-pirates', 5500, null),
  ('tidefin-sky-pirates', 'champion', 'tidefin', null, 'Tide Admiral', 'legendary', 'sky-pirates', 5500, null),
  ('auralynx-sky-pirates', 'champion', 'auralynx', null, 'Prism Navigator', 'legendary', 'sky-pirates', 5500, null),
  ('lumoth-sky-pirates', 'champion', 'lumoth', null, 'Lantern Lookout', 'legendary', 'sky-pirates', 5500, null),
  ('mystowl-sky-pirates', 'champion', 'mystowl', null, 'Chart Quartermaster', 'legendary', 'sky-pirates', 5500, null),
  ('terradon-sky-pirates', 'champion', 'terradon', null, 'Ironhull Captain', 'legendary', 'sky-pirates', 5500, null),
  ('duskveil-sky-pirates', 'champion', 'duskveil', null, 'Ghost Ship Wisp', 'legendary', 'sky-pirates', 5500, null),
  ('coilemur-sky-pirates', 'champion', 'coilemur', null, 'Rigging Runner', 'legendary', 'sky-pirates', 5500, null),
  ('pyranda-sky-pirates', 'champion', 'pyranda', null, 'Spice Raider', 'legendary', 'sky-pirates', 5500, null),
  ('glacelle-sky-pirates', 'champion', 'glacelle', null, 'Frost Privateer', 'legendary', 'sky-pirates', 5500, null),
  ('halcyra-sky-pirates', 'champion', 'halcyra', null, 'Crow''s Nest Ace', 'legendary', 'sky-pirates', 5500, null),
  ('sunbara-sky-pirates', 'champion', 'sunbara', null, 'Sunset Skipper', 'legendary', 'sky-pirates', 5500, null),
  ('astrabun-sky-pirates', 'champion', 'astrabun', null, 'Moonsail Bosun', 'legendary', 'sky-pirates', 5500, null),
  ('wombolder-sky-pirates', 'champion', 'wombolder', null, 'Anchor Warden', 'legendary', 'sky-pirates', 5500, null),
  ('shadopus-sky-pirates', 'champion', 'shadopus', null, 'Kraken Captain', 'legendary', 'sky-pirates', 5500, null),
  ('pangrove-sky-pirates', 'champion', 'pangrove', null, 'Jungle Corsair', 'legendary', 'sky-pirates', 5500, null),
  ('mossloth-sky-pirates', 'champion', 'mossloth', null, 'Hammock Pirate', 'legendary', 'sky-pirates', 5500, null),
  ('sky-pirates-skins', 'bundle', null, null, 'Sky Pirates skins', null, 'sky-pirates', 0, array['voltkit-sky-pirates', 'cindrake-sky-pirates', 'tidefin-sky-pirates', 'auralynx-sky-pirates', 'lumoth-sky-pirates', 'mystowl-sky-pirates', 'terradon-sky-pirates', 'duskveil-sky-pirates', 'coilemur-sky-pirates', 'pyranda-sky-pirates', 'glacelle-sky-pirates', 'halcyra-sky-pirates', 'sunbara-sky-pirates', 'astrabun-sky-pirates', 'wombolder-sky-pirates', 'shadopus-sky-pirates', 'pangrove-sky-pirates', 'mossloth-sky-pirates'])

on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

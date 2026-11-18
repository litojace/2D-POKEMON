-- Stars & Stripes: a Legendary collection of American figures. Safe to run again; keeps ownership.
--
-- 18 skins, one per champion (a space ranger, Lady Liberty, a sheriff, a
-- hot-rod racer, a stage magician...), Legendary at 5,500 coins, and their
-- full-roster set: like the other sets it costs 80% of the skins you don't
-- own yet (arena_item_price) and buying it grants each skin (arena_buy_item).
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-stars-stripes', 'champion', 'voltkit', null, 'Space Ranger', 'legendary', 'stars-stripes', 5500, null),
  ('cindrake-stars-stripes', 'champion', 'cindrake', null, 'Hot-Rod Racer', 'legendary', 'stars-stripes', 5500, null),
  ('tidefin-stars-stripes', 'champion', 'tidefin', null, 'Malibu Surfer', 'legendary', 'stars-stripes', 5500, null),
  ('auralynx-stars-stripes', 'champion', 'auralynx', null, 'Jazz Cat', 'legendary', 'stars-stripes', 5500, null),
  ('lumoth-stars-stripes', 'champion', 'lumoth', null, 'Neon Diner', 'legendary', 'stars-stripes', 5500, null),
  ('mystowl-stars-stripes', 'champion', 'mystowl', null, 'Lady Liberty', 'legendary', 'stars-stripes', 5500, null),
  ('terradon-stars-stripes', 'champion', 'terradon', null, 'Sheriff', 'legendary', 'stars-stripes', 5500, null),
  ('duskveil-stars-stripes', 'champion', 'duskveil', null, 'Film Noir', 'legendary', 'stars-stripes', 5500, null),
  ('coilemur-stars-stripes', 'champion', 'coilemur', null, 'Rodeo Rider', 'legendary', 'stars-stripes', 5500, null),
  ('pyranda-stars-stripes', 'champion', 'pyranda', null, 'Ace Pitcher', 'legendary', 'stars-stripes', 5500, null),
  ('glacelle-stars-stripes', 'champion', 'glacelle', null, 'Aurora Alaska', 'legendary', 'stars-stripes', 5500, null),
  ('halcyra-stars-stripes', 'champion', 'halcyra', null, 'Barnstormer', 'legendary', 'stars-stripes', 5500, null),
  ('sunbara-stars-stripes', 'champion', 'sunbara', null, 'Fourth of July', 'legendary', 'stars-stripes', 5500, null),
  ('astrabun-stars-stripes', 'champion', 'astrabun', null, 'Stage Magician', 'legendary', 'stars-stripes', 5500, null),
  ('wombolder-stars-stripes', 'champion', 'wombolder', null, 'Linebacker', 'legendary', 'stars-stripes', 5500, null),
  ('shadopus-stars-stripes', 'champion', 'shadopus', null, 'Times Square DJ', 'legendary', 'stars-stripes', 5500, null),
  ('pangrove-stars-stripes', 'champion', 'pangrove', null, 'Park Ranger', 'legendary', 'stars-stripes', 5500, null),
  ('mossloth-stars-stripes', 'champion', 'mossloth', null, 'Woodstock Folk', 'legendary', 'stars-stripes', 5500, null),
  ('stars-stripes-skins', 'bundle', null, null, 'Stars & Stripes skins', null, 'stars-stripes', 0, array['voltkit-stars-stripes', 'cindrake-stars-stripes', 'tidefin-stars-stripes', 'auralynx-stars-stripes', 'lumoth-stars-stripes', 'mystowl-stars-stripes', 'terradon-stars-stripes', 'duskveil-stars-stripes', 'coilemur-stars-stripes', 'pyranda-stars-stripes', 'glacelle-stars-stripes', 'halcyra-stars-stripes', 'sunbara-stars-stripes', 'astrabun-stars-stripes', 'wombolder-stars-stripes', 'shadopus-stars-stripes', 'pangrove-stars-stripes', 'mossloth-stars-stripes'])

on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

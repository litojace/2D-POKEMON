-- Hero Squad: an Epic collection of original superheroes. Safe to run again; keeps ownership.
--
-- 18 skins, one hero per champion with its own powers on show, Epic at 3,500
-- coins, and their full-roster set: like the other sets it costs 80% of the
-- skins you don't own yet (arena_item_price) and buying it grants each skin
-- (arena_buy_item).
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-hero-squad', 'champion', 'voltkit', null, 'Volt Streak', 'epic', 'hero-squad', 3500, null),
  ('cindrake-hero-squad', 'champion', 'cindrake', null, 'Blaze Breaker', 'epic', 'hero-squad', 3500, null),
  ('tidefin-hero-squad', 'champion', 'tidefin', null, 'Tide Guardian', 'epic', 'hero-squad', 3500, null),
  ('auralynx-hero-squad', 'champion', 'auralynx', null, 'Prism Fist', 'epic', 'hero-squad', 3500, null),
  ('lumoth-hero-squad', 'champion', 'lumoth', null, 'Lumina', 'epic', 'hero-squad', 3500, null),
  ('mystowl-hero-squad', 'champion', 'mystowl', null, 'Third Eye', 'epic', 'hero-squad', 3500, null),
  ('terradon-hero-squad', 'champion', 'terradon', null, 'Iron Bulwark', 'epic', 'hero-squad', 3500, null),
  ('duskveil-hero-squad', 'champion', 'duskveil', null, 'Duskwatch', 'epic', 'hero-squad', 3500, null),
  ('coilemur-hero-squad', 'champion', 'coilemur', null, 'Magnetail', 'epic', 'hero-squad', 3500, null),
  ('pyranda-hero-squad', 'champion', 'pyranda', null, 'Chestnut Comet', 'epic', 'hero-squad', 3500, null),
  ('glacelle-hero-squad', 'champion', 'glacelle', null, 'Frost Sentinel', 'epic', 'hero-squad', 3500, null),
  ('halcyra-hero-squad', 'champion', 'halcyra', null, 'Skysight', 'epic', 'hero-squad', 3500, null),
  ('sunbara-hero-squad', 'champion', 'sunbara', null, 'Solar Flare', 'epic', 'hero-squad', 3500, null),
  ('astrabun-hero-squad', 'champion', 'astrabun', null, 'Moon Blink', 'epic', 'hero-squad', 3500, null),
  ('wombolder-hero-squad', 'champion', 'wombolder', null, 'Bulldozer', 'epic', 'hero-squad', 3500, null),
  ('shadopus-hero-squad', 'champion', 'shadopus', null, 'Inkshade', 'epic', 'hero-squad', 3500, null),
  ('pangrove-hero-squad', 'champion', 'pangrove', null, 'Leaf Ranger', 'epic', 'hero-squad', 3500, null),
  ('mossloth-hero-squad', 'champion', 'mossloth', null, 'Chrono Keeper', 'epic', 'hero-squad', 3500, null),
  ('hero-squad-skins', 'bundle', null, null, 'Hero Squad skins', null, 'hero-squad', 0, array['voltkit-hero-squad', 'cindrake-hero-squad', 'tidefin-hero-squad', 'auralynx-hero-squad', 'lumoth-hero-squad', 'mystowl-hero-squad', 'terradon-hero-squad', 'duskveil-hero-squad', 'coilemur-hero-squad', 'pyranda-hero-squad', 'glacelle-hero-squad', 'halcyra-hero-squad', 'sunbara-hero-squad', 'astrabun-hero-squad', 'wombolder-hero-squad', 'shadopus-hero-squad', 'pangrove-hero-squad', 'mossloth-hero-squad'])

on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

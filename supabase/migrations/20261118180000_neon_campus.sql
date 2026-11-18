-- Neon Campus: an Epic collection, a school club for every champion. Safe to run again; keeps ownership.
--
-- 18 skins, one club each (gaming, chemistry, swimming, the student council,
-- photography...), Epic at 3,500 coins, and their full-roster set: like the
-- other sets it costs 80% of the skins you don't own yet (arena_item_price)
-- and buying it grants each skin (arena_buy_item).
-- The rows come from packages/shared/src/shop.ts (scripts/shop-seed.ts);
-- tests/unit/shop-catalog.test.ts checks they match.
begin;

insert into public.arena_shop_items(id, kind, champion, slot, name, rarity, collection, price, items) values
  ('voltkit-neon-campus', 'champion', 'voltkit', null, 'Game Club Ace', 'epic', 'neon-campus', 3500, null),
  ('cindrake-neon-campus', 'champion', 'cindrake', null, 'Lab Prodigy', 'epic', 'neon-campus', 3500, null),
  ('tidefin-neon-campus', 'champion', 'tidefin', null, 'Swim Team Star', 'epic', 'neon-campus', 3500, null),
  ('auralynx-neon-campus', 'champion', 'auralynx', null, 'Council President', 'epic', 'neon-campus', 3500, null),
  ('lumoth-neon-campus', 'champion', 'lumoth', null, 'Photo Club Snap', 'epic', 'neon-campus', 3500, null),
  ('mystowl-neon-campus', 'champion', 'mystowl', null, 'Library Prefect', 'epic', 'neon-campus', 3500, null),
  ('terradon-neon-campus', 'champion', 'terradon', null, 'Team Captain', 'epic', 'neon-campus', 3500, null),
  ('duskveil-neon-campus', 'champion', 'duskveil', null, 'Drama Club Lead', 'epic', 'neon-campus', 3500, null),
  ('coilemur-neon-campus', 'champion', 'coilemur', null, 'Robotics Whiz', 'epic', 'neon-campus', 3500, null),
  ('pyranda-neon-campus', 'champion', 'pyranda', null, 'Bake Club Chef', 'epic', 'neon-campus', 3500, null),
  ('glacelle-neon-campus', 'champion', 'glacelle', null, 'Choir Soloist', 'epic', 'neon-campus', 3500, null),
  ('halcyra-neon-campus', 'champion', 'halcyra', null, 'Archery Ace', 'epic', 'neon-campus', 3500, null),
  ('sunbara-neon-campus', 'champion', 'sunbara', null, 'Art Club Painter', 'epic', 'neon-campus', 3500, null),
  ('astrabun-neon-campus', 'champion', 'astrabun', null, 'Stargazer', 'epic', 'neon-campus', 3500, null),
  ('wombolder-neon-campus', 'champion', 'wombolder', null, 'Garden Club Keeper', 'epic', 'neon-campus', 3500, null),
  ('shadopus-neon-campus', 'champion', 'shadopus', null, 'Mystery Club Sleuth', 'epic', 'neon-campus', 3500, null),
  ('pangrove-neon-campus', 'champion', 'pangrove', null, 'Band Drummer', 'epic', 'neon-campus', 3500, null),
  ('mossloth-neon-campus', 'champion', 'mossloth', null, 'Nap Club Captain', 'epic', 'neon-campus', 3500, null),
  ('neon-campus-skins', 'bundle', null, null, 'Neon Campus skins', null, 'neon-campus', 0, array['voltkit-neon-campus', 'cindrake-neon-campus', 'tidefin-neon-campus', 'auralynx-neon-campus', 'lumoth-neon-campus', 'mystowl-neon-campus', 'terradon-neon-campus', 'duskveil-neon-campus', 'coilemur-neon-campus', 'pyranda-neon-campus', 'glacelle-neon-campus', 'halcyra-neon-campus', 'sunbara-neon-campus', 'astrabun-neon-campus', 'wombolder-neon-campus', 'shadopus-neon-campus', 'pangrove-neon-campus', 'mossloth-neon-campus'])

on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

-- Starlight Idol: an Epic collection, a stage act for every champion. Safe to run again; keeps ownership.
--
-- 18 skins, one act each (a rock frontman, a disco dancer, a crystal
-- soprano, a DJ...), Epic at 3,500 coins, and their full-roster set: like the
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
  ('voltkit-starlight-idol', 'champion', 'voltkit', null, 'Thunder Riff', 'epic', 'starlight-idol', 3500, null),
  ('cindrake-starlight-idol', 'champion', 'cindrake', null, 'Pyro Headliner', 'epic', 'starlight-idol', 3500, null),
  ('tidefin-starlight-idol', 'champion', 'tidefin', null, 'Pearl Popstar', 'epic', 'starlight-idol', 3500, null),
  ('auralynx-starlight-idol', 'champion', 'auralynx', null, 'Prism Soloist', 'epic', 'starlight-idol', 3500, null),
  ('lumoth-starlight-idol', 'champion', 'lumoth', null, 'Disco Flutter', 'epic', 'starlight-idol', 3500, null),
  ('mystowl-starlight-idol', 'champion', 'mystowl', null, 'Midnight Enchantress', 'epic', 'starlight-idol', 3500, null),
  ('terradon-starlight-idol', 'champion', 'terradon', null, 'Street Beat', 'epic', 'starlight-idol', 3500, null),
  ('duskveil-starlight-idol', 'champion', 'duskveil', null, 'Phantom Crooner', 'epic', 'starlight-idol', 3500, null),
  ('coilemur-starlight-idol', 'champion', 'coilemur', null, 'Synth Looper', 'epic', 'starlight-idol', 3500, null),
  ('pyranda-starlight-idol', 'champion', 'pyranda', null, 'Chestnut MC', 'epic', 'starlight-idol', 3500, null),
  ('glacelle-starlight-idol', 'champion', 'glacelle', null, 'Crystal Soprano', 'epic', 'starlight-idol', 3500, null),
  ('halcyra-starlight-idol', 'champion', 'halcyra', null, 'Plume Showstar', 'epic', 'starlight-idol', 3500, null),
  ('sunbara-starlight-idol', 'champion', 'sunbara', null, 'Sunflower Sweetheart', 'epic', 'starlight-idol', 3500, null),
  ('astrabun-starlight-idol', 'champion', 'astrabun', null, 'Mochi Starlet', 'epic', 'starlight-idol', 3500, null),
  ('wombolder-starlight-idol', 'champion', 'wombolder', null, 'Bedrock Drummer', 'epic', 'starlight-idol', 3500, null),
  ('shadopus-starlight-idol', 'champion', 'shadopus', null, 'Neon Octave', 'epic', 'starlight-idol', 3500, null),
  ('pangrove-starlight-idol', 'champion', 'pangrove', null, 'Island Serenader', 'epic', 'starlight-idol', 3500, null),
  ('mossloth-starlight-idol', 'champion', 'mossloth', null, 'Lo-fi Lullaby', 'epic', 'starlight-idol', 3500, null),
  ('starlight-idol-skins', 'bundle', null, null, 'Starlight Idol skins', null, 'starlight-idol', 0, array['voltkit-starlight-idol', 'cindrake-starlight-idol', 'tidefin-starlight-idol', 'auralynx-starlight-idol', 'lumoth-starlight-idol', 'mystowl-starlight-idol', 'terradon-starlight-idol', 'duskveil-starlight-idol', 'coilemur-starlight-idol', 'pyranda-starlight-idol', 'glacelle-starlight-idol', 'halcyra-starlight-idol', 'sunbara-starlight-idol', 'astrabun-starlight-idol', 'wombolder-starlight-idol', 'shadopus-starlight-idol', 'pangrove-starlight-idol', 'mossloth-starlight-idol'])
on conflict (id) do update set kind = excluded.kind, champion = excluded.champion, slot = excluded.slot,
  name = excluded.name, rarity = excluded.rarity, collection = excluded.collection, price = excluded.price, items = excluded.items;

commit;

select
  (select count(*) from public.arena_shop_items where collection = 'starlight-idol' and kind = 'champion' and rarity = 'epic' and price = 3500 and active) as starlight_idol_skins,
  (select cardinality(items) from public.arena_shop_items where id = 'starlight-idol-skins') as set_pieces,
  (select count(*) from public.arena_shop_items where collection = 'starlight-idol' and in_picks) as in_todays_picks;

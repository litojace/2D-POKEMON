-- The Arcade frame: own all eight Arcade skins (the neon Epics) and it's
-- yours, like the Void Knight and Cyber Mecha frames (071). Run after 071.
--
--  * Reward-only (never sold): active = false, price 0, so arena_buy_item
--    refuses it and arena_collection_bonus (071) grants it. The id matches
--    COLLECTION_FRAMES in packages/shared/src/journey.ts.
--  * Anyone who already owns every Arcade skin gets it now.
-- Safe to run again.
begin;

insert into public.arena_shop_items(id, kind, slot, name, rarity, collection, price, active) values
  ('arcade-frame', 'look', 'frame', 'Arcade frame', 'epic', 'arcade', 0, false)
on conflict (id) do update set kind = excluded.kind, slot = excluded.slot, name = excluded.name,
  rarity = excluded.rarity, collection = excluded.collection, price = 0, active = false;

select public.arena_collection_bonus(player_id)
  from (select distinct player_id from public.arena_owned_items) owners;

commit;

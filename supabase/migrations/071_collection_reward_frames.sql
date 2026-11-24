-- Reward frames for the two champion-skin collections without one: own all
-- sixteen Void Knights (067) for the Void Knight frame, or all sixteen Cyber
-- Mechas (069) for the Cyber Mecha frame. Run after 069.
--
--  * The frames are reward-only, like the Journey's (051): never sold
--    (active = false, so arena_buy_item refuses them), price 0. The ids
--    match COLLECTION_FRAMES in packages/shared/src/journey.ts.
--  * arena_collection_bonus (011) granted only frames that are on sale. It
--    now also grants a collection's reward-only frame (price 0). Frames with
--    no collection (the Journey's) never match, so nothing else changes.
--  * Anyone who already owns a whole collection gets its frame now.
-- Safe to run again.
begin;

insert into public.arena_shop_items(id, kind, slot, name, rarity, collection, price, active) values
  ('void-frame', 'look', 'frame', 'Void Knight frame', 'mythical', 'void', 0, false),
  ('cyber-frame', 'look', 'frame', 'Cyber Mecha frame', 'epic', 'cyber', 0, false)
on conflict (id) do update set kind = excluded.kind, slot = excluded.slot, name = excluded.name,
  rarity = excluded.rarity, collection = excluded.collection, price = 0, active = false;

create or replace function public.arena_collection_bonus(pid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.arena_owned_items(player_id, item_id)
  select pid, f.id from public.arena_shop_items f
   where f.kind = 'look' and f.slot = 'frame' and (f.active or f.price = 0)
     and f.collection is not null
     and exists (select 1 from public.arena_shop_items s
                  where s.kind = 'champion' and s.active and s.collection = f.collection)
     and not exists (select 1 from public.arena_shop_items s
                      where s.kind = 'champion' and s.active and s.collection = f.collection
                        and not exists (select 1 from public.arena_owned_items o
                                         where o.player_id = pid and o.item_id = s.id))
  on conflict do nothing
$$;
revoke all on function public.arena_collection_bonus(uuid) from public, anon, authenticated, service_role;

select public.arena_collection_bonus(player_id)
  from (select distinct player_id from public.arena_owned_items) owners;

commit;

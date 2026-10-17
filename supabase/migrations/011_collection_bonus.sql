-- Element Arena: collection bonus (design §10.5.1).
-- Own every champion skin in a collection (e.g. all five Winter skins) and
-- that collection's portrait frame is yours for free. Checked on every
-- purchase; a one-time backfill covers anyone who already qualifies.
-- Run after 010_shop.sql.

create or replace function public.arena_collection_bonus(pid uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.arena_owned_items(player_id, item_id)
  select pid, f.id from public.arena_shop_items f
   where f.kind = 'look' and f.slot = 'frame' and f.active
     and exists (select 1 from public.arena_shop_items s
                  where s.kind = 'champion' and s.active and s.collection = f.collection)
     and not exists (select 1 from public.arena_shop_items s
                      where s.kind = 'champion' and s.active and s.collection = f.collection
                        and not exists (select 1 from public.arena_owned_items o
                                         where o.player_id = pid and o.item_id = s.id))
  on conflict do nothing
$$;
revoke all on function public.arena_collection_bonus(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); item public.arena_shop_items; price integer; paid integer;
begin
  if me is null then raise exception 'Login required'; end if;
  if not exists (select 1 from public.arena_profiles where id = me and not suspended) then raise exception 'Login required'; end if;
  select * into item from public.arena_shop_items where id = p_item and active;
  if not found then raise exception 'That item is not for sale'; end if;
  if item.rarity = 'mythical' and coalesce((select wins from public.arena_champion_wins
       where player_id = me and champion = item.champion), 0) < 30 then
    raise exception 'Mythic Trial: win 30 matches or raids with this champion first';
  end if;
  price = public.arena_item_price(me, p_item, d);
  if price is null then raise exception 'You already own this'; end if;
  insert into public.arena_wallets(player_id) values (me) on conflict do nothing;
  update public.arena_wallets set balance = balance - price where player_id = me and balance >= price;
  get diagnostics paid = row_count;
  if paid = 0 then raise exception 'Not enough coins'; end if;
  insert into public.arena_coin_ledger(player_id, amount, reason, ref, day)
  values (me, -price, 'buy', p_item || ':' || gen_random_uuid(), d);
  insert into public.arena_owned_items(player_id, item_id)
  select me, x from unnest(case when item.kind = 'bundle' then item.items else array[item.id] end) x
  on conflict do nothing;
  perform public.arena_collection_bonus(me);
  return public.arena_economy();
end; $$;
revoke all on function public.arena_buy_item(text) from public, anon;
grant execute on function public.arena_buy_item(text) to authenticated;

-- Anyone who already owns a whole collection gets its frame now.
select public.arena_collection_bonus(player_id)
  from (select distinct player_id from public.arena_owned_items) owners;

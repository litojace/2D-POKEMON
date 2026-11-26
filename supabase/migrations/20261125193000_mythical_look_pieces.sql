-- A Mythical Look piece sells on its own; the Mythic Trial is for Void
-- Knight skins. Safe to run again.
--
-- arena_buy_item (075, as in 017) asked any Mythical item for 30 wins with
-- "its champion". A Look piece has no champion (champion is null), so its
-- wins were always 0 and every Mythical piece bought alone failed with
-- "Mythic Trial: win 30 matches or raids with this champion first". That
-- covers Galaxy's and Borealis's aura, entrance, frame and victory. Their
-- sets still sold, since a bundle has no rarity. The Shop never showed a lock
-- on these pieces (trialLocked only looks at champion skins), so a player
-- saw a Buy button that always failed.
--
-- The function is the same as in 075, except that the trial applies to
-- champion skins only (item.kind = 'champion').
begin;

create or replace function public.arena_buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); item public.arena_shop_items; price integer; paid integer;
begin
  if me is null then raise exception 'Login required'; end if;
  if not exists (select 1 from public.arena_profiles where id = me and not suspended) then raise exception 'Login required'; end if;
  select * into item from public.arena_shop_items where id = p_item and active;
  if not found then raise exception 'That item is not for sale'; end if;
  if not public.arena_is_admin() and item.kind = 'champion' and item.rarity = 'mythical'
     and coalesce((select wins from public.arena_champion_wins
       where player_id = me and champion = item.champion), 0) < 30 then
    raise exception 'Mythic Trial: win 30 matches or raids with this champion first';
  end if;
  price = public.arena_item_price(me, p_item, d);
  if price is null then raise exception 'You already own this'; end if;
  -- Resolve privileges from the authenticated identity, never a client flag.
  if public.arena_is_admin() then
    insert into public.arena_admin_audit(actor_id, action, target_id, details)
    values (me, 'shop_test_purchase', me, jsonb_build_object('item', p_item, 'price', price));
  else
    insert into public.arena_wallets(player_id) values (me) on conflict do nothing;
    update public.arena_wallets set balance = balance - price where player_id = me and balance >= price;
    get diagnostics paid = row_count;
    if paid = 0 then raise exception 'Not enough coins'; end if;
    insert into public.arena_coin_ledger(player_id, amount, reason, ref, day)
    values (me, -price, 'buy', p_item || ':' || gen_random_uuid(), d);
  end if;
  insert into public.arena_owned_items(player_id, item_id)
  select me, x from unnest(case when item.kind = 'bundle' then item.items else array[item.id] end) x
  on conflict do nothing;
  perform public.arena_collection_bonus(me);
  return public.arena_economy();
end; $$;
revoke all on function public.arena_buy_item(text) from public, anon;
grant execute on function public.arena_buy_item(text) to authenticated;

commit;

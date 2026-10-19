-- Unlimited Shop spending for existing, non-suspended administrators.
-- Run after 015_somnara.sql. Safe to run again.
-- Keep the real wallet balance and normal progression requirements intact.
begin;

create or replace function public.arena_economy() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today();
begin
  if me is null then raise exception 'Login required'; end if;
  perform public.arena_ensure_missions(me, d);
  return jsonb_build_object(
    'unlimitedCoins', public.arena_is_admin(),
    'balance', coalesce((select balance from public.arena_wallets where player_id = me), 0),
    'owned', coalesce((select jsonb_agg(item_id order by item_id) from public.arena_owned_items where player_id = me), '[]'::jsonb),
    'picks', jsonb_build_object('day', d,
      'items', coalesce((select jsonb_agg(item_id) from public.arena_shop_picks(d)), '[]'::jsonb),
      'deal', (select item_id from public.arena_shop_picks(d) where deal)),
    'trialWins', coalesce((select jsonb_object_agg(champion, wins) from public.arena_champion_wins where player_id = me), '{}'::jsonb),
    'awakening', coalesce((select jsonb_object_agg(i.id, jsonb_build_object(
        'wins', coalesce(sp.wins, 0), 'peril3', coalesce(sp.peril3, false),
        'stage', public.arena_awakening(coalesce(sp.wins, 0), coalesce(sp.peril3, false))))
      from public.arena_owned_items o join public.arena_shop_items i on i.id = o.item_id
      left join public.arena_skin_progress sp on sp.player_id = me and sp.skin_id = i.id
      where o.player_id = me and i.rarity = 'mythical'), '{}'::jsonb),
    'looks', coalesce((select jsonb_object_agg(champion, jsonb_build_object('skin', skin, 'stage', stage))
      from public.arena_champion_looks where player_id = me), '{}'::jsonb),
    'missions', coalesce((select jsonb_agg(jsonb_build_object('day', mp.day, 'slot', mp.slot, 'id', m.id,
        'text', m.text, 'tier', m.tier, 'progress', mp.progress, 'target', m.target,
        'coins', m.coins, 'done', mp.done) order by mp.slot)
      from public.arena_mission_progress mp join public.arena_missions m on m.id = mp.mission_id
      where mp.player_id = me and mp.day = d), '[]'::jsonb),
    'rerolled', coalesce((select rerolled from public.arena_mission_days where player_id = me and day = d), false),
    'streak', public.arena_mission_streak(me, d),
    'today', jsonb_build_object(
      'raidClears', (select count(*) from public.arena_coin_ledger where player_id = me and day = d and reason = 'raid'),
      'pvpMatches', (select count(*) from public.arena_coin_ledger where player_id = me and day = d and reason = 'pvp')));
end; $$;
revoke all on function public.arena_economy() from public, anon;
grant execute on function public.arena_economy() to authenticated;

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

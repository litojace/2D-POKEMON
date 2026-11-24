-- Undo 073: Shop Colors are for every fighter again. Run after 073.
--
-- 073 made a collection's Colors bought on their own dress only the champion
-- they were bought for. That rule is withdrawn: buying them once dresses every
-- fighter, as before 073. Every function 073 changed is put back exactly as it
-- was (arena_buy_item(p_item) as in 017, arena_economy as in 036,
-- arena_raid_progress as in 028, arena_friends as in 033), 073's own
-- functions and tables are dropped, and anything bought or worn under 073
-- becomes the old kind: Colors bought for a champion are owned for everyone
-- (arena_owned_items), and Colors a champion wore go in the all-fighter Skin
-- slot if it was empty. (When this ran on the live project, 073's tables were
-- still empty: nobody had bought or worn Colors per champion.)
begin;

-- Anything bought or worn under 073 becomes the old kind.
insert into public.arena_owned_items(player_id, item_id)
select distinct player_id, item_id from public.arena_colour_unlocks
on conflict do nothing;
insert into public.arena_raid_loadouts(player_id)
select distinct player_id from public.arena_champion_colours
on conflict (player_id) do nothing;
update public.arena_raid_loadouts l set skin = c.item_id
  from (select distinct on (player_id) player_id, item_id
          from public.arena_champion_colours order by player_id, champion) c
 where l.player_id = c.player_id and l.skin is null;

-- As in 017.
drop function if exists public.arena_buy_item(text, text);
create or replace function public.arena_buy_item(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); item public.arena_shop_items; price integer; paid integer;
begin
  if me is null then raise exception 'Login required'; end if;
  if not exists (select 1 from public.arena_profiles where id = me and not suspended) then raise exception 'Login required'; end if;
  select * into item from public.arena_shop_items where id = p_item and active;
  if not found then raise exception 'That item is not for sale'; end if;
  if not public.arena_is_admin() and item.rarity = 'mythical' and coalesce((select wins from public.arena_champion_wins
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

-- As in 036.
create or replace function public.arena_economy() returns jsonb
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  e = public.arena_economy_before_journey();
  return e || jsonb_build_object(
    'journey', public.arena_journey(),
    'rerollsUsed', coalesce((select rerolls_used from public.arena_mission_days
      where player_id = auth.uid() and day = public.arena_today()), 0),
    'rerollLimit', 5,
    'leaves', public.arena_leaves());
end; $$;

-- As in 028.
create or replace function public.arena_raid_progress() returns jsonb
language sql security definer set search_path = public as $$
  select public.arena_raid_progress_before_mode_retirement() - 'today' - 'dailyClears'
$$;

-- As in 033.
create or replace function public.arena_friends() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare result jsonb;
begin
 perform public.arena_require_player();
 select jsonb_build_object(
  'code', public.arena_friend_code(auth.uid()),
  'friends', coalesce((select jsonb_agg(jsonb_build_object(
    'id',p.id,'name',p.display_name,'title',t.name,'titleColor',t.color,
    'lastOnline',p.last_online_at,'fighter',p.portrait_character,'frame',l.frame,
    'look',jsonb_build_object('skin',l.skin,'aura',l.aura,'entrance',l.entrance,'frame',l.frame,'victory',l.victory),
    'championLooks',coalesce((select jsonb_object_agg(c.champion,jsonb_build_object('skin',c.skin,'stage',c.stage))
      from public.arena_champion_looks c where c.player_id=p.id and c.champion=p.portrait_character),'{}'::jsonb),
    'raidClears',coalesce((select jsonb_object_agg(b.boss,b.clears) from (
      select r.boss,count(*) as clears from public.arena_raid_players rp
      join public.arena_raid_runs r on r.id=rp.run_id
      where rp.player_id=p.id and r.result='victory' group by r.boss
    ) b),'{}'::jsonb)
  ) order by lower(p.display_name))
    from public.arena_friendships f
    join public.arena_profiles p on p.id = case when f.a=auth.uid() then f.b else f.a end
    left join public.arena_titles t on t.id=p.equipped_title and t.active
    left join public.arena_raid_loadouts l on l.player_id=p.id
    where (f.a=auth.uid() or f.b=auth.uid()) and not p.suspended),'[]'::jsonb),
  'incoming', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.from_id where r.to_id=auth.uid() and not p.suspended),'[]'::jsonb),
  'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.to_id where r.from_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end; $$;

-- 073's own functions and tables.
drop function if exists public.arena_equip_champion_colours(text, text);
drop function if exists public.arena_colours_for(uuid, text, text);
drop function if exists public.arena_is_champion_colours(text);
drop table if exists public.arena_champion_colours;
drop table if exists public.arena_colour_unlocks;

commit;

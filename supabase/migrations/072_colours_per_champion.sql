-- Shop Colors are bought for one champion. Run after 071.
--
-- Buying a collection's Colors piece on its own now dresses only the
-- champion you buy it for (the one shown in the Shop); to wear it on another
-- champion, buy it again for that one, at the same price. A collection set
-- (the bundle) still gives its Colors to every fighter. Colors from the
-- Journey and from raids are never sold and stay all-fighter.
--
--  * arena_colour_unlocks: which champions a player bought each Colors for.
--    arena_owned_items keeps meaning "for every fighter".
--  * arena_champion_colours: the Colors each champion wears. They win over
--    the all-fighter Skin slot (arena_raid_loadouts.skin) on that champion,
--    and a champion skin still wins over both.
--  * arena_buy_item(p_item, p_champion): Colors need the champion.
--  * arena_equip_champion_colours(p_champion, p_item): wear (or take off,
--    null) Colors on one champion: bought for it, or owned for everyone.
--  * arena_economy() adds `colourUnlocks`; arena_raid_progress() adds
--    `loadout.colours`; arena_friends() shows a friend's portrait champion in
--    the Colors it wears.
--  * Colors already bought on their own (not with their set) become Colors
--    for one champion: the player's Lobby fighter (their farmer, else their
--    portrait champion, else Voltkit). If they wore them, that champion keeps
--    wearing them. Colors that came with a set stay all-fighter.
begin;

create table if not exists public.arena_colour_unlocks (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  item_id text not null references public.arena_shop_items(id),
  champion text not null check (champion = any (public.arena_champion_ids())),
  created_at timestamptz not null default now(),
  primary key (player_id, item_id, champion)
);
create table if not exists public.arena_champion_colours (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  champion text not null check (champion = any (public.arena_champion_ids())),
  item_id text not null references public.arena_shop_items(id),
  primary key (player_id, champion)
);
-- Only the functions below read or write them.
alter table public.arena_colour_unlocks enable row level security;
alter table public.arena_champion_colours enable row level security;
revoke all on public.arena_colour_unlocks from public, anon, authenticated;
revoke all on public.arena_champion_colours from public, anon, authenticated;

/** Colors sold in the Shop on their own: bought per champion. */
create or replace function public.arena_is_champion_colours(p_item text) returns boolean
language sql stable set search_path = '' as $$
  select exists (select 1 from public.arena_shop_items i
    where i.id = p_item and i.kind = 'look' and i.slot = 'skin' and i.price > 0)
$$;

/** Can this player wear these Colors on this champion? */
create or replace function public.arena_colours_for(pid uuid, p_item text, p_champion text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.arena_owned_items o where o.player_id = pid and o.item_id = p_item)
      or exists (select 1 from public.arena_colour_unlocks u
                  where u.player_id = pid and u.item_id = p_item and u.champion = p_champion)
$$;
revoke all on function public.arena_colours_for(uuid, text, text) from public, anon, authenticated;

-- Existing Colors bought on their own become one champion's.
with lone as (
  select o.player_id, o.item_id,
         coalesce((select f.farmer from public.arena_farms f where f.player_id = o.player_id),
                  (select p.portrait_character from public.arena_profiles p where p.id = o.player_id),
                  'voltkit') as champion
    from public.arena_owned_items o
   where public.arena_is_champion_colours(o.item_id)
     -- Its set was not bought (by coins, or as an administrator's test).
     and not exists (select 1 from public.arena_coin_ledger l
                       where l.player_id = o.player_id and l.reason = 'buy'
                         and split_part(l.ref, ':', 1) = split_part(o.item_id, '-', 1) || '-set')
     and not exists (select 1 from public.arena_admin_audit a
                       where a.actor_id = o.player_id and a.action = 'shop_test_purchase'
                         and a.details->>'item' = split_part(o.item_id, '-', 1) || '-set')
), unlocked as (
  insert into public.arena_colour_unlocks(player_id, item_id, champion)
  select player_id, item_id, champion from lone
  on conflict do nothing
  returning player_id, item_id, champion
), worn as (
  insert into public.arena_champion_colours(player_id, champion, item_id)
  select l.player_id, l.champion, l.item_id from lone l
    join public.arena_raid_loadouts r on r.player_id = l.player_id and r.skin = l.item_id
  on conflict (player_id, champion) do nothing
  returning player_id, item_id
), unworn as (
  update public.arena_raid_loadouts r set skin = null
    from lone l where r.player_id = l.player_id and r.skin = l.item_id
  returning r.player_id
)
delete from public.arena_owned_items o
 using lone l where o.player_id = l.player_id and o.item_id = l.item_id;

-- As in 017, with Colors bought for one champion.
drop function if exists public.arena_buy_item(text);
create or replace function public.arena_buy_item(p_item text, p_champion text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); item public.arena_shop_items; price integer; paid integer;
  colours boolean;
begin
  if me is null then raise exception 'Login required'; end if;
  if not exists (select 1 from public.arena_profiles where id = me and not suspended) then raise exception 'Login required'; end if;
  select * into item from public.arena_shop_items where id = p_item and active;
  if not found then raise exception 'That item is not for sale'; end if;
  colours = public.arena_is_champion_colours(p_item);
  if colours then
    if p_champion is null or not (p_champion = any (public.arena_champion_ids())) then
      raise exception 'Choose the fighter these colors are for';
    end if;
    if public.arena_colours_for(me, p_item, p_champion) then
      raise exception 'You already own these colors for that fighter';
    end if;
  end if;
  if not public.arena_is_admin() and item.rarity = 'mythical' and coalesce((select wins from public.arena_champion_wins
       where player_id = me and champion = item.champion), 0) < 30 then
    raise exception 'Mythic Trial: win 30 matches or raids with this champion first';
  end if;
  price = public.arena_item_price(me, p_item, d);
  if price is null then raise exception 'You already own this'; end if;
  -- Resolve privileges from the authenticated identity, never a client flag.
  if public.arena_is_admin() then
    insert into public.arena_admin_audit(actor_id, action, target_id, details)
    values (me, 'shop_test_purchase', me, jsonb_build_object('item', p_item, 'price', price)
      || case when colours then jsonb_build_object('champion', p_champion) else '{}'::jsonb end);
  else
    insert into public.arena_wallets(player_id) values (me) on conflict do nothing;
    update public.arena_wallets set balance = balance - price where player_id = me and balance >= price;
    get diagnostics paid = row_count;
    if paid = 0 then raise exception 'Not enough coins'; end if;
    insert into public.arena_coin_ledger(player_id, amount, reason, ref, day)
    values (me, -price, 'buy', p_item || ':' || gen_random_uuid(), d);
  end if;
  if colours then
    insert into public.arena_colour_unlocks(player_id, item_id, champion)
    values (me, p_item, p_champion) on conflict do nothing;
  else
    insert into public.arena_owned_items(player_id, item_id)
    select me, x from unnest(case when item.kind = 'bundle' then item.items else array[item.id] end) x
    on conflict do nothing;
  end if;
  perform public.arena_collection_bonus(me);
  return public.arena_economy();
end; $$;
revoke all on function public.arena_buy_item(text, text) from public, anon;
grant execute on function public.arena_buy_item(text, text) to authenticated;

create or replace function public.arena_equip_champion_colours(p_champion text, p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_champion is null or not (p_champion = any (public.arena_champion_ids())) then
    raise exception 'Choose a valid champion';
  end if;
  if p_item is null then
    delete from public.arena_champion_colours where player_id = me and champion = p_champion;
    return public.arena_economy();
  end if;
  if not public.arena_is_champion_colours(p_item) then raise exception 'Those are not Shop colors'; end if;
  if not public.arena_colours_for(me, p_item, p_champion) then
    raise exception 'You do not own these colors for that fighter';
  end if;
  insert into public.arena_champion_colours(player_id, champion, item_id)
  values (me, p_champion, p_item)
  on conflict (player_id, champion) do update set item_id = excluded.item_id;
  return public.arena_economy();
end; $$;
revoke all on function public.arena_equip_champion_colours(text, text) from public, anon;
grant execute on function public.arena_equip_champion_colours(text, text) to authenticated;

-- As in 036 (a wrapper over the earlier versions), with colourUnlocks.
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
    'leaves', public.arena_leaves(),
    'colourUnlocks', coalesce((select jsonb_object_agg(item_id, champions) from (
        select item_id, jsonb_agg(champion order by champion) champions
          from public.arena_colour_unlocks where player_id = auth.uid() group by item_id) u),
      '{}'::jsonb));
end; $$;

-- As in 028 (a wrapper), with the Colors each champion wears in the loadout.
create or replace function public.arena_raid_progress() returns jsonb
language sql security definer set search_path = public as $$
  select jsonb_set(v, '{loadout}', coalesce(v->'loadout', '{}'::jsonb) || jsonb_build_object('colours',
    coalesce((select jsonb_object_agg(c.champion, c.item_id) from public.arena_champion_colours c
               where c.player_id = auth.uid()), '{}'::jsonb)))
    from (select public.arena_raid_progress_before_mode_retirement() - 'today' - 'dailyClears' as v) p
$$;

-- As in 033, with a friend's portrait champion in the Colors it wears.
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
    'look',jsonb_build_object('skin',coalesce(cc.item_id,l.skin),'aura',l.aura,'entrance',l.entrance,'frame',l.frame,'victory',l.victory),
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
    left join public.arena_champion_colours cc on cc.player_id=p.id and cc.champion=p.portrait_character
    where (f.a=auth.uid() or f.b=auth.uid()) and not p.suspended),'[]'::jsonb),
  'incoming', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.from_id where r.to_id=auth.uid() and not p.suspended),'[]'::jsonb),
  'outgoing', coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name) order by r.created_at)
    from public.arena_friend_requests r join public.arena_profiles p on p.id=r.to_id where r.from_id=auth.uid()),'[]'::jsonb)
 ) into result;
 return result;
end; $$;

commit;

-- The Supply Balloon, fairer (058 asked for too much):
--  * The crate of a crop you can't grow yet is at most 5 levels ahead (was
--    20), so friends near your level can fill it.
--  * The balloon can leave early with the crates you filled: it pays 1.6x
--    their value and their XP; all six full still add a Gold Fertilizer.
--    A crate no friend can fill never holds the balloon back.
--  * Balloons already waiting: a crate more than 5 levels ahead that is not
--    filled yet gets a crop in range instead.
-- Run after 067_farm_storm_waters.sql. Safe to run again.
begin;

-- As in 058_farm_balloon.sql, the stretch crate at most 5 levels ahead.
create or replace function public.arena_farm_balloon_new(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lvl integer = coalesce((select level from public.arena_farms where player_id = pid), 1);
  crates jsonb = '[]'::jsonb; c public.arena_farm_crops; used text[] = '{}';
begin
  for c in select * from public.arena_farm_crops where level <= lvl order by random() limit 5 loop
    used = used || c.id;
    crates = crates || jsonb_build_array(jsonb_build_object('crop', c.id,
      'qty', public.arena_farm_crate_qty(c.rarity), 'state', 'open', 'by', null));
  end loop;
  select * into c from public.arena_farm_crops
   where level > lvl and level <= lvl + 5 order by random() limit 1;
  if c.id is null then
    select * into c from public.arena_farm_crops where not id = any(used) order by random() limit 1;
  end if;
  crates = crates || jsonb_build_array(jsonb_build_object('crop', c.id,
    'qty', public.arena_farm_crate_qty(c.rarity), 'state', 'open', 'by', null));
  -- A low farm grows few kinds: repeat crops to make six crates.
  while jsonb_array_length(crates) < 6 loop
    crates = jsonb_build_array(crates->0) || crates;
  end loop;
  insert into public.arena_farm_balloons(player_id, crates, arrives_at) values (pid, crates, null)
  on conflict (player_id) do update set crates = excluded.crates, arrives_at = null;
end; $$;

-- As in 058_farm_balloon.sql, plus what launching now would pay.
create or replace function public.arena_farm_balloon_view(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'crates', b.crates,
    'arrivesAt', b.arrives_at,
    'launches', b.launches,
    'leaves', case when b.crates is not null then (round((select sum(public.arena_farm_crate_value(x))
      from jsonb_array_elements(b.crates) x) * 1.6 / 5) * 5)::integer end,
    'xp', case when b.crates is not null then (select sum(c.xp * (x->>'qty')::integer)
      from jsonb_array_elements(b.crates) x join public.arena_farm_crops c on c.id = x->>'crop') end,
    -- What launching now pays: only the crates already full.
    'leavesNow', case when b.crates is not null then coalesce((round((select sum(public.arena_farm_crate_value(x))
      from jsonb_array_elements(b.crates) x where x->>'state' = 'done') * 1.6 / 5) * 5)::integer, 0) end,
    'xpNow', case when b.crates is not null then coalesce((select sum(c.xp * (x->>'qty')::integer)
      from jsonb_array_elements(b.crates) x join public.arena_farm_crops c on c.id = x->>'crop'
      where x->>'state' = 'done'), 0) end,
    'helperStars', coalesce((select stars from public.arena_farm_helpers where player_id = pid), 0),
    'helperLeavesToday', coalesce((select leaves from public.arena_farm_help_days
      where player_id = pid and day = public.arena_today()), 0),
    'helperCap', 600,
    'helpers', coalesce((select jsonb_object_agg(pr.id, pr.display_name) from public.arena_profiles pr
      where pr.id in (select (x->>'by')::uuid from jsonb_array_elements(b.crates) x where x->>'by' is not null)),
      '{}'::jsonb))
  from public.arena_farm_balloons b where b.player_id = pid
$$;
revoke all on function public.arena_farm_balloon_new(uuid), public.arena_farm_balloon_view(uuid)
  from public, anon, authenticated, service_role;

-- As in 058_farm_balloon.sql, launching with any crates filled.
create or replace function public.arena_farm_balloon_act(p_request uuid, p_kind text, p_slot integer default null)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); b public.arena_farm_balloons; crate jsonb;
  inserted integer; err text; gained jsonb; v_leaves integer; v_xp integer; v_done integer; v_all integer;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or p_kind not in ('fill', 'ask', 'launch')
     or (p_kind <> 'launch' and (p_slot is null or p_slot not between 0 and 5)) then
    raise exception 'Invalid balloon request';
  end if;
  perform public.arena_farm_ensure(me);
  perform 1 from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('balloon', public.arena_farm_balloon_view(me), 'ok', false, 'repeated', true);
  end if;
  perform public.arena_farm_balloon_refresh(me);
  select * into b from public.arena_farm_balloons where player_id = me for update;
  if b.crates is null then err = 'The next balloon is on its way';
  elsif p_kind = 'launch' then
    -- It can leave early with the crates you filled; all six add a Gold
    -- Fertilizer.
    select count(*) filter (where x->>'state' = 'done'), count(*) into v_done, v_all
      from jsonb_array_elements(b.crates) x;
    if v_done = 0 then
      err = 'Fill a crate first';
    else
      v_leaves = (round((select sum(public.arena_farm_crate_value(x)) from jsonb_array_elements(b.crates) x
        where x->>'state' = 'done') * 1.6 / 5) * 5)::integer;
      select sum(c.xp * (x->>'qty')::integer) into v_xp
        from jsonb_array_elements(b.crates) x join public.arena_farm_crops c on c.id = x->>'crop'
       where x->>'state' = 'done';
      if v_leaves > 0 then
        perform public.arena_grant_leaves(me, v_leaves, 'farm-balloon', p_request::text, d);
      end if;
      perform public.arena_farm_add_xp(me, v_xp);
      if v_done = v_all then
        update public.arena_farms set fert_gold = fert_gold + 1 where player_id = me;
      end if;
      update public.arena_farm_balloons set crates = null, arrives_at = now() + interval '1 hour',
        launches = launches + 1 where player_id = me;
      gained = jsonb_build_object('leaves', v_leaves, 'xp', v_xp, 'crates', v_done,
        'bonus', case when v_done = v_all then 'gold' end);
    end if;
  else
    crate = b.crates->p_slot;
    if crate->>'state' = 'done' then err = 'This crate is full';
    elsif p_kind = 'ask' then
      if crate->>'state' = 'asked' then err = 'Your friends already see this crate';
      elsif (select count(*) from jsonb_array_elements(b.crates) x where x->>'state' = 'asked'
               or (x->>'by') is not null) >= 3 then
        err = 'You can ask friends for 3 crates a balloon';
      else
        update public.arena_farm_balloons set crates = jsonb_set(crates, array[p_slot::text, 'state'], '"asked"')
         where player_id = me;
      end if;
    elsif not public.arena_farm_take(me, crate->>'crop', (crate->>'qty')::integer) then
      err = 'You need ' || (crate->>'qty') || ' ' || (select name from public.arena_farm_crops where id = crate->>'crop');
    else
      update public.arena_farm_balloons set crates = jsonb_set(crates, array[p_slot::text, 'state'], '"done"')
       where player_id = me;
      insert into public.arena_farm_crate_log(player_id, owner, crop, qty)
      values (me, me, crate->>'crop', (crate->>'qty')::integer);
    end if;
  end if;
  return jsonb_build_object('balloon', public.arena_farm_balloon_view(me), 'ok', err is null, 'error', err,
    'gained', gained);
end; $$;
revoke all on function public.arena_farm_balloon_act(uuid, text, integer) from public, anon;
grant execute on function public.arena_farm_balloon_act(uuid, text, integer) to authenticated;

-- Balloons already waiting: crates too far ahead, not filled yet, get a crop
-- in range (a friend who was asked sees the new one).
do $$
declare bl record; n jsonb; cr jsonb; c public.arena_farm_crops; i integer;
begin
  for bl in select b.player_id, b.crates, coalesce(f.level, 1) lvl
      from public.arena_farm_balloons b left join public.arena_farms f on f.player_id = b.player_id
     where b.crates is not null loop
    n = bl.crates;
    for i in 0 .. jsonb_array_length(n) - 1 loop
      cr = n->i;
      if cr->>'state' <> 'done' and coalesce((select level from public.arena_farm_crops
           where id = cr->>'crop'), 0) > bl.lvl + 5 then
        c = null;
        select * into c from public.arena_farm_crops
         where level > bl.lvl and level <= bl.lvl + 5 order by random() limit 1;
        if c.id is null then
          select * into c from public.arena_farm_crops where level <= bl.lvl order by random() limit 1;
        end if;
        n = jsonb_set(n, array[i::text], jsonb_build_object('crop', c.id,
          'qty', public.arena_farm_crate_qty(c.rarity), 'state', 'open', 'by', null));
      end if;
    end loop;
    if n is distinct from bl.crates then
      update public.arena_farm_balloons set crates = n where player_id = bl.player_id;
    end if;
  end loop;
end $$;

commit;

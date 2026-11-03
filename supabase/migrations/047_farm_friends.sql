-- Hub redesign, phase 5i: friends' farms.
-- Run after 046_farm_perks.sql. Safe to run again.
--  * You can visit the farm of anyone on your Friends list and, as in the
--    prototype:
--    water a dry growing crop (+2 farm XP), catch a bug (+3 XP),
--    sneak 1 crop from a ripe plot (with its mutation), or
--    drop a bug on a growing crop (a prank, 3 a Pacific day).
--  * Limits so friends can't farm each other: helping pays at most 60 XP a
--    Pacific day; at most 10 sneaks a day; each ripe planting loses at most
--    1 crop to sneaking (its harvest gives one less), and each friend can
--    try it once. Auralynx's Shield (046) stops pranks.
--  * A guard dog on duty catches a sneaking friend (Goldie 25%, Inky 80%,
--    Fluffy 40%): the friend pays a 20 Gold Leaves fine to the farm's owner
--    and goes home empty-handed.
--  * The owner sees who visited and what they did.
begin;

alter table public.arena_farm_plots add column if not exists stolen smallint not null default 0
  check (stolen between 0 and 1);

create table if not exists public.arena_farm_friend_days (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  help_xp integer not null default 0,
  sneaks integer not null default 0,
  pranks integer not null default 0,
  primary key (player_id, day)
);
create table if not exists public.arena_farm_sneaks (
  thief uuid not null references public.arena_profiles(id) on delete cascade,
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  idx integer not null,
  planted_at timestamptz not null,
  primary key (thief, owner, idx, planted_at)
);
create table if not exists public.arena_farm_visits (
  id bigserial primary key,
  owner uuid not null references public.arena_profiles(id) on delete cascade,
  visitor uuid not null references public.arena_profiles(id) on delete cascade,
  at timestamptz not null default now(),
  kind text not null check (kind in ('water', 'catch', 'sneak', 'caught', 'prank')),
  crop text,
  n integer not null default 1
);
create index if not exists arena_farm_visits_owner on public.arena_farm_visits(owner, at desc);
alter table public.arena_farm_friend_days enable row level security;
alter table public.arena_farm_sneaks enable row level security;
alter table public.arena_farm_visits enable row level security;
revoke all on public.arena_farm_friend_days, public.arena_farm_sneaks, public.arena_farm_visits
  from public, anon, authenticated, service_role;

-- A crow, and anything snuck, leave with the crop (045's trigger, extended).
create or replace function public.arena_farm_plots_crow() returns trigger
language plpgsql set search_path = public as $$
begin
  if new.crop is distinct from old.crop or new.planted_at is distinct from old.planted_at then
    new.crow_at = null;
    new.stolen = 0;
  end if;
  return new;
end; $$;

-- A plot's harvest: Terradon's 3 (046) or 2, less what friends snuck.
create or replace function public.arena_farm_yield(pid uuid, p_idx integer) returns integer
language sql stable security definer set search_path = public as $$
  select greatest(1, (case when (select farmer from public.arena_farms where player_id = pid) = 'terradon'
    then 3 else 2 end) - coalesce((select stolen from public.arena_farm_plots where player_id = pid and idx = p_idx), 0))
$$;

create or replace function public.arena_farm_are_friends(x uuid, y uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.arena_friendships where a = least(x, y) and b = greatest(x, y))
$$;

-- A friend's farm as a visitor sees it.
create or replace function public.arena_farm_view(me uuid, pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', pid,
    'name', pr.display_name,
    'fighter', pr.portrait_character,
    'level', f.level,
    'farmer', f.farmer,
    'now', now(),
    'plots', (select jsonb_agg(jsonb_build_object(
        'i', p.idx, 'owned', p.owned, 'crop', p.crop,
        'progress', round(s.g::numeric, 4),
        'ripeAt', public.arena_farm_ripe_at(p),
        'wet', coalesce(s.wet, false), 'pests', p.pests,
        'mutation', case when s.g >= 1 then public.arena_farm_mutation(pid, p, s.ripe_weather) end,
        -- Ripe, and still worth a try for this visitor.
        'sneak', s.g >= 1 and p.stolen < 1 and not exists (select 1 from public.arena_farm_sneaks k
          where k.thief = me and k.owner = pid and k.idx = p.idx and k.planted_at = p.planted_at)) order by p.idx)
      from public.arena_farm_plots p cross join lateral public.arena_farm_sim(p, now()) s where p.player_id = pid),
    'dog', public.arena_farm_dog(pid, now()),
    'scarecrow', f.scarecrow,
    'sprinklers', f.sprinklers,
    'today', (select jsonb_build_object('helpXp', coalesce(max(d.help_xp), 0), 'sneaks', coalesce(max(d.sneaks), 0),
        'pranks', coalesce(max(d.pranks), 0))
      from public.arena_farm_friend_days d where d.player_id = me and d.day = public.arena_today()))
  from public.arena_farms f join public.arena_profiles pr on pr.id = f.player_id
  where f.player_id = pid
$$;

-- Your friends who have a farm, for the Friends sheet.
create or replace function public.arena_farm_friends() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  return coalesce((select jsonb_agg(x order by lower(x->>'name')) from (
    select jsonb_build_object('id', pr.id, 'name', pr.display_name, 'fighter', pr.portrait_character,
      'level', f.level, 'dog', public.arena_farm_dog(pr.id, now()),
      'bugs', (select coalesce(sum(p.pests), 0) from public.arena_farm_plots p where p.player_id = pr.id),
      'ripe', (select count(*) from public.arena_farm_plots p
        where p.player_id = pr.id and p.crop is not null and p.stolen < 1
          and public.arena_farm_growth(p, now()) >= 1
          and not exists (select 1 from public.arena_farm_sneaks k
            where k.thief = me and k.owner = pr.id and k.idx = p.idx and k.planted_at = p.planted_at))) x
    from public.arena_friendships fs
    join public.arena_profiles pr on pr.id = case when fs.a = me then fs.b else fs.a end
    join public.arena_farms f on f.player_id = pr.id
    where (fs.a = me or fs.b = me) and not pr.suspended
    limit 100) y), '[]'::jsonb);
end; $$;
revoke all on function public.arena_farm_friends() from public, anon;
grant execute on function public.arena_farm_friends() to authenticated;

-- Visit a friend's farm.
create or replace function public.arena_farm_friend(p_friend uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_friend is null or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can visit';
  end if;
  if not exists (select 1 from public.arena_farms where player_id = p_friend) then
    raise exception 'This friend has no farm yet';
  end if;
  perform public.arena_farm_dogs(p_friend);
  return public.arena_farm_view(me, p_friend);
end; $$;
revoke all on function public.arena_farm_friend(uuid) from public, anon;
grant execute on function public.arena_farm_friend(uuid) to authenticated;

-- Help, sneak or prank on a friend's farm. Answers with their farm as you
-- see it and what each action did. A retried request is answered, never
-- applied twice.
create or replace function public.arena_farm_friend_act(p_request uuid, p_friend uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  a jsonb; i integer = 0; kind text; plot integer; p public.arena_farm_plots; s record;
  results jsonb = '[]'::jsonb; err text; gained jsonb; inserted integer; v_xp integer = 0;
  v_day public.arena_farm_friend_days; owner_f public.arena_farms; v_dog text; v_mut text;
  give integer; v_fine integer; v_catch double precision;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or jsonb_typeof(p_actions) is distinct from 'array'
     or jsonb_array_length(p_actions) not between 1 and 30 then
    raise exception 'Invalid farm request';
  end if;
  if p_friend is null or p_friend = me or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can visit';
  end if;
  if not exists (select 1 from public.arena_farms where player_id = p_friend) then
    raise exception 'This friend has no farm yet';
  end if;
  perform public.arena_farm_ensure(me);
  -- Both farms, always locked in the same order.
  perform 1 from public.arena_farms where player_id in (me, p_friend) order by player_id for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('farm', public.arena_farm_view(me, p_friend), 'results', '[]'::jsonb, 'repeated', true);
  end if;
  perform public.arena_farm_dogs(p_friend);
  insert into public.arena_farm_friend_days(player_id, day) values (me, d) on conflict do nothing;
  select * into owner_f from public.arena_farms where player_id = p_friend;
  v_dog = public.arena_farm_dog(p_friend, t);
  for a in select * from jsonb_array_elements(p_actions) loop
    i = i + 1; err = null; gained = null;
    kind = a->>'a';
    plot = case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer end;
    p = null;
    if plot between 0 and 49 then
      select * into p from public.arena_farm_plots where player_id = p_friend and idx = plot for update;
    end if;
    select * into v_day from public.arena_farm_friend_days x where x.player_id = me and x.day = d;
    if p.idx is null then err = 'Unknown plot';
    elsif kind = 'water' then
      select * into s from public.arena_farm_sim(p, t);
      if p.crop is null or s.g >= 1 then err = 'Nothing growing here';
      elsif s.wet then err = 'Already watered';
      else
        update public.arena_farm_plots set progress = s.g, progress_at = t, wet = true
         where player_id = p_friend and idx = plot;
        give = least(2, greatest(0, 60 - v_day.help_xp));
        update public.arena_farm_friend_days x set help_xp = x.help_xp + give where x.player_id = me and x.day = d;
        v_xp = v_xp + give;
        insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'water', p.crop);
        gained = jsonb_build_object('xp', give);
      end if;
    elsif kind = 'catch' then
      if p.pests < 1 then err = 'No bugs here';
      else
        perform public.arena_farm_set_pests(p_friend, plot, p.pests - 1, t);
        give = least(3, greatest(0, 60 - v_day.help_xp));
        update public.arena_farm_friend_days x set help_xp = x.help_xp + give where x.player_id = me and x.day = d;
        v_xp = v_xp + give;
        insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'catch', p.crop);
        gained = jsonb_build_object('xp', give);
      end if;
    elsif kind = 'sneak' then
      select * into s from public.arena_farm_sim(p, t);
      if p.crop is null or s.g < 1 then err = 'Nothing ripe here';
      elsif p.stolen >= 1 then err = 'Someone already snuck a crop from this plot';
      elsif exists (select 1 from public.arena_farm_sneaks k where k.thief = me and k.owner = p_friend
          and k.idx = plot and k.planted_at = p.planted_at) then err = 'You already tried this plot';
      elsif v_day.sneaks >= 10 then err = 'That''s enough sneaking for today';
      elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = me)
          >= 80 + 40 * (select barn_upgrades from public.arena_farms where player_id = me) then
        err = 'Your barn is full';
      else
        insert into public.arena_farm_sneaks(thief, owner, idx, planted_at) values (me, p_friend, plot, p.planted_at);
        update public.arena_farm_friend_days x set sneaks = x.sneaks + 1 where x.player_id = me and x.day = d;
        v_catch = coalesce((array[0.25, 0.8, 0.4])[array_position(array['gold', 'black', 'cream'], v_dog)], 0);
        if random() < v_catch then
          -- Caught: a 20 leaf fine to the owner, if you have it.
          v_fine = case when public.arena_spend_leaves(me, 20, 'farm-fine', p_request || ':' || i, d) then 20 else 0 end;
          if v_fine > 0 then
            perform public.arena_grant_leaves(p_friend, 20, 'farm-fine', me || ':' || p_request || ':' || i, d);
          end if;
          insert into public.arena_farm_visits(owner, visitor, kind, crop, n) values (p_friend, me, 'caught', p.crop, v_fine);
          gained = jsonb_build_object('caught', v_dog, 'fine', v_fine);
        else
          v_mut = coalesce(public.arena_farm_mutation(p_friend, p, s.ripe_weather), '');
          update public.arena_farm_plots set stolen = 1 where player_id = p_friend and idx = plot;
          insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (me, p.crop, v_mut, 1)
          on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 1;
          insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'sneak', p.crop);
          gained = jsonb_build_object('crop', p.crop, 'qty', 1, 'mutation', v_mut);
        end if;
      end if;
    elsif kind = 'prank' then
      select * into s from public.arena_farm_sim(p, t);
      if v_day.pranks >= 3 then err = 'No pranks left today';
      elsif owner_f.farmer = 'auralynx' then err = 'Their Shield blocks pranks';
      elsif p.crop is null or s.g >= 1 then err = 'Bugs only go on growing crops';
      elsif p.pests >= 3 then err = 'That plot can''t take more bugs';
      else
        perform public.arena_farm_set_pests(p_friend, plot, p.pests + 1, t);
        update public.arena_farm_friend_days x set pranks = x.pranks + 1 where x.player_id = me and x.day = d;
        insert into public.arena_farm_visits(owner, visitor, kind, crop) values (p_friend, me, 'prank', p.crop);
        gained = jsonb_build_object('pranksLeft', 2 - v_day.pranks);
      end if;
    else
      err = 'Unknown action';
    end if;
    results = results || jsonb_build_array(case when err is null
      then jsonb_build_object('ok', true) || coalesce(gained, '{}'::jsonb)
      else jsonb_build_object('ok', false, 'error', err) end);
  end loop;
  perform public.arena_farm_add_xp(me, v_xp);
  delete from public.arena_farm_visits where owner = p_friend and at < t - interval '30 days';
  return jsonb_build_object('farm', public.arena_farm_view(me, p_friend), 'results', results, 'xp', v_xp,
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = me), 0));
end; $$;
revoke all on function public.arena_farm_friend_act(uuid, uuid, jsonb) from public, anon;
grant execute on function public.arena_farm_friend_act(uuid, uuid, jsonb) to authenticated;
revoke all on function public.arena_farm_plots_crow(), public.arena_farm_yield(uuid, integer),
  public.arena_farm_are_friends(uuid, uuid), public.arena_farm_view(uuid, uuid)
  from public, anon, authenticated, service_role;

-- The farm state as in 046, plus who visited lately.
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  with c as (select public.arena_farm_state_core(pid) j, f.farmer, f.warm_until
    from public.arena_farms f where f.player_id = pid)
  select c.j || jsonb_build_object(
    'weather', case when c.farmer = 'mystowl' then c.j->'weather' else (c.j->'weather') - 'later' end,
    'farmer', c.farmer,
    'perksUsed', coalesce((select jsonb_agg(u.perk order by u.perk) from public.arena_farm_perk_uses u
      where u.player_id = pid and u.day = public.arena_today()), '[]'::jsonb),
    'warmUntil', case when c.warm_until > now() then c.warm_until end,
    'orders', coalesce((select jsonb_agg(jsonb_build_object('slot', o.slot, 'items', o.items,
        'leaves', o.leaves, 'xp', o.xp, 'bonus', o.bonus, 'who', o.who, 'face', o.face,
        'waitUntil', o.wait_until) order by o.slot)
      from public.arena_farm_orders o where o.player_id = pid), '[]'::jsonb),
    'bookRewards', coalesce((select jsonb_agg(b.found order by b.found)
      from public.arena_farm_book_rewards b where b.player_id = pid), '[]'::jsonb),
    'wishReady', not exists (select 1 from public.arena_farm_wishes w
      where w.player_id = pid and w.day = public.arena_today()),
    'mastery', coalesce((select jsonb_object_agg(m.crop, m.stars) from public.arena_farm_mastery m
      where m.player_id = pid and m.stars > 0), '{}'::jsonb),
    'dog', (select jsonb_build_object('type', h.dog, 'since', h.started_at, 'until', h.ends_at)
      from public.arena_farm_dog_hires h
      where h.player_id = pid and h.started_at <= now() and h.ends_at > now()
      order by h.ends_at desc limit 1),
    'dogGifts', coalesce((select jsonb_agg(jsonb_build_object('at', g.dug_at, 'dog', g.dog,
        'kind', g.kind, 'crop', g.crop, 'qty', g.qty) order by g.dug_at desc)
      from (select * from public.arena_farm_dog_gifts g where g.player_id = pid
        order by g.dug_at desc limit 10) g), '[]'::jsonb),
    'crows', coalesce((select jsonb_object_agg(x.idx::text, x.crow_at) from public.arena_farm_plots x
      where x.player_id = pid and x.crow_at is not null), '{}'::jsonb),
    'visits', coalesce((select jsonb_agg(jsonb_build_object('id', v.id, 'at', v.at, 'name', pr.display_name,
        'kind', v.kind, 'crop', v.crop, 'n', v.n) order by v.at desc, v.id desc)
      from (select * from public.arena_farm_visits v where v.owner = pid and v.at > now() - interval '3 days'
        order by v.at desc, v.id desc limit 20) v join public.arena_profiles pr on pr.id = v.visitor), '[]'::jsonb))
  from c
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;
commit;

select
  to_regprocedure('public.arena_farm_friend_act(uuid, uuid, jsonb)') is not null as farm_friends_enabled;

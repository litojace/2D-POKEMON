-- Element Bistro, part 3: the staff's energy, janitors and litter, the
-- Staff Corner, and friends who work at your bistro. Run after
-- 070_bistro_popularity.sql. Safe to run again.
--
-- Rules match packages/shared/src/bistro.ts (tests/integration/bistro.test.ts
-- checks the two agree); see docs/bistro-gdd.md §1.
--
--  * Energy (0 to 100 + 10 a level above 1): work drains it by the hour (a
--    cook 14, a waiter 12, a janitor 10; each Staff Corner, up to two, takes
--    a quarter off), and the rest after a shift brings back 15 an hour. A
--    worker at 50 or more is at full pace, from 20 at 85%, below 20 at 60%:
--    tired staff are slower, never stopped. Energy is kept as of the
--    bistro's last_seen. A staff meal (feed) takes a serving off the counter
--    and gives 50, once in 10 minutes.
--  * Janitors (from level 4) clear the tables, so waiters only serve; while
--    you are away 8% of guests drop litter (up to 10), which janitors sweep
--    at 30 an hour each, and litter takes a point of popularity each.
--  * Friends as staff: hire a friend for any role; they work 10% faster,
--    their meal at your bistro fills their energy, and each day they open
--    their own bistro they get 3 XP for each bistro they work at (up to 5).
--    If you stop being friends, they stay on as a creature.
begin;

alter table public.arena_bistro_staff drop constraint if exists arena_bistro_staff_role_check;
alter table public.arena_bistro_staff add constraint arena_bistro_staff_role_check
  check (role in ('cook', 'waiter', 'janitor'));
alter table public.arena_bistro_staff add column if not exists energy double precision
  check (energy is null or energy >= 0);
alter table public.arena_bistro_staff add column if not exists fed_at timestamptz;
alter table public.arena_bistro_staff add column if not exists friend_id uuid;
-- A creature works once at a bistro, and so does a friend.
alter table public.arena_bistro_staff drop constraint if exists arena_bistro_staff_player_id_creature_key;
create unique index if not exists arena_bistro_staff_creature
  on public.arena_bistro_staff(player_id, creature) where friend_id is null;
create unique index if not exists arena_bistro_staff_friend
  on public.arena_bistro_staff(player_id, friend_id) where friend_id is not null;
create index if not exists arena_bistro_staff_friend_of
  on public.arena_bistro_staff(friend_id) where friend_id is not null;
alter table public.arena_bistros add column if not exists trash integer not null default 0
  check (trash between 0 and 10);
insert into public.arena_bistro_kinds(kind, name, price, level, charm, floor) values
  ('corner', 'Staff Corner', 600, 5, 1, false)
on conflict (kind) do update set name = excluded.name, price = excluded.price,
  level = excluded.level, charm = excluded.charm, floor = excluded.floor;
-- The XP friends get for working at your bistro, once a day each.
create table if not exists public.arena_bistro_paydays (
  worker uuid not null references public.arena_profiles(id) on delete cascade,
  employer uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  primary key (worker, employer, day)
);
alter table public.arena_bistro_paydays enable row level security;

-- ───────────── energy ─────────────

create or replace function public.arena_bistro_energy_max(p_level integer) returns double precision
language sql immutable set search_path = '' as $$ select (100 + 10 * (p_level - 1))::float8 $$;
create or replace function public.arena_bistro_mood(e double precision) returns double precision
language sql immutable set search_path = '' as $$
  select case when e >= 50 then 1::float8 when e >= 20 then 0.85::float8 else 0.6::float8 end
$$;
create or replace function public.arena_bistro_drain(p_role text, p_corners integer) returns double precision
language sql immutable set search_path = '' as $$
  select (case p_role when 'cook' then 14 when 'waiter' then 12 else 10 end)::float8
    * (1 - 0.25 * p_corners)::float8
$$;
-- Energy after ms of work from e; after ms of rest.
create or replace function public.arena_bistro_after_work(p_role text, e double precision, ms double precision,
  p_corners integer) returns double precision
language sql immutable set search_path = public as $$
  select greatest(0::float8, e - (public.arena_bistro_drain(p_role, p_corners) * ms) / 3600000::float8)
$$;
create or replace function public.arena_bistro_after_rest(p_level integer, e double precision, ms double precision)
returns double precision language sql immutable set search_path = public as $$
  select least(public.arena_bistro_energy_max(p_level), e + (15::float8 * ms) / 3600000::float8)
$$;
-- How fast someone works (1 is a fresh level-1 creature).
create or replace function public.arena_bistro_work_speed(p_level integer, p_friend boolean, e double precision)
returns double precision language sql immutable set search_path = public as $$
  select (public.arena_bistro_speed(p_level) * case when p_friend then 1.1::float8 else 1::float8 end)
    * public.arena_bistro_mood(e)
$$;
create or replace function public.arena_bistro_corners(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select least(2, count(*))::integer from public.arena_bistro_items where player_id = pid and kind = 'corner'
$$;
-- A staff member's energy ms after the bistro's last_seen, at work.
create or replace function public.arena_bistro_energy(s public.arena_bistro_staff, ms double precision, p_corners integer)
returns double precision language sql immutable set search_path = public as $$
  select public.arena_bistro_after_work(s.role, coalesce(s.energy, public.arena_bistro_energy_max(s.level)), ms, p_corners)
$$;
-- How long a dish takes with this kitchen, this cook's level and pace (energy, friend).
create or replace function public.arena_bistro_cook_ms(p_seconds integer, p_kitchen integer, p_cook integer,
  p_pace double precision)
returns integer language sql immutable set search_path = public as $$
  select round((p_seconds * 1000 * (1 - 0.1 * p_kitchen) / (public.arena_bistro_speed(p_cook) * p_pace))::numeric)::integer
$$;
revoke all on function public.arena_bistro_energy_max(integer), public.arena_bistro_mood(double precision),
  public.arena_bistro_drain(text, integer),
  public.arena_bistro_after_work(text, double precision, double precision, integer),
  public.arena_bistro_after_rest(integer, double precision, double precision),
  public.arena_bistro_work_speed(integer, boolean, double precision), public.arena_bistro_corners(uuid),
  public.arena_bistro_energy(public.arena_bistro_staff, double precision, integer),
  public.arena_bistro_cook_ms(integer, integer, integer, double precision)
  from public, anon, authenticated, service_role;

-- Start a dish at time t, at a cook's pace (1 for you).
create or replace function public.arena_bistro_start(pid uuid, p_idx integer, p_dish text, t timestamptz, p_cook integer,
  p_pace double precision)
returns text language plpgsql security definer set search_path = public as $$
declare st public.arena_bistro_stoves; d public.arena_bistro_dishes; b public.arena_bistros;
begin
  select * into st from public.arena_bistro_stoves where player_id = pid and idx = p_idx;
  if st.idx is null then return 'No stove there.'; end if;
  if st.dish is not null then return 'That stove is busy.'; end if;
  select * into d from public.arena_bistro_dishes where id = p_dish;
  if d.id is null then return 'Unknown dish.'; end if;
  select * into b from public.arena_bistros where player_id = pid;
  if d.level > b.level then return d.name || ' opens at level ' || d.level || '.'; end if;
  if b.coins < d.cost then return 'You need ' || d.cost || ' coins for ' || d.name || '.'; end if;
  update public.arena_bistros set coins = coins - d.cost where player_id = pid;
  update public.arena_bistro_stoves set dish = d.id, started_at = t, perfect = false,
    dur_ms = public.arena_bistro_cook_ms(d.seconds, b.kitchen_lv, p_cook, p_pace)
   where player_id = pid and idx = p_idx;
  return null;
end; $$;
create or replace function public.arena_bistro_start(pid uuid, p_idx integer, p_dish text, t timestamptz, p_cook integer)
returns text language sql security definer set search_path = public as $$
  select public.arena_bistro_start(pid, p_idx, p_dish, t, p_cook, 1::float8)
$$;
-- The cooks' turn at time t, their energy worn down since p_from.
create or replace function public.arena_bistro_kitchen(pid uuid, t timestamptz, p_from timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare c public.arena_bistro_staff; i integer = 0; n_stoves integer; v_idx integer; st public.arena_bistro_stoves;
  r jsonb; pick text; b public.arena_bistros; plated integer = 0; started integer = 0; spent integer = 0; lv integer = 0;
  corners integer = public.arena_bistro_corners(pid); pace double precision;
begin
  select count(*) into n_stoves from public.arena_bistro_stoves where player_id = pid;
  for c in select * from public.arena_bistro_staff where player_id = pid and role = 'cook' order by id loop
    v_idx = n_stoves - 1 - i;
    i = i + 1;
    if v_idx < 0 then continue; end if;
    select * into st from public.arena_bistro_stoves where player_id = pid and idx = v_idx;
    if st.dish is not null and t >= st.started_at + make_interval(secs => st.dur_ms / 1000.0) then
      r = public.arena_bistro_plate(pid, v_idx, t);
      if r ? 'ok' then plated = plated + 1; lv = lv + (r->>'levels')::integer; end if;
    end if;
    select * into st from public.arena_bistro_stoves where player_id = pid and idx = v_idx;
    if st.dish is null and public.arena_bistro_servings(pid) < 24 then
      select * into b from public.arena_bistros where player_id = pid;
      -- Their dish, or the best one the bistro can still pay for.
      select d.id into pick from public.arena_bistro_dishes d
       where d.level <= b.level and d.cost <= b.coins
       order by (d.id = c.dish) desc, d.ord desc limit 1;
      -- Their pace: tired from the work since p_from, and a friend's bonus.
      pace = case when c.friend_id is not null then 1.1::float8 else 1::float8 end
        * public.arena_bistro_mood(public.arena_bistro_energy(c, extract(epoch from t - p_from) * 1000, corners));
      if pick is not null and public.arena_bistro_start(pid, v_idx, pick, t, c.level, pace) is null then
        started = started + 1;
        spent = spent + (select cost from public.arena_bistro_dishes where id = pick);
      end if;
    end if;
  end loop;
  return jsonb_build_object('plated', plated, 'started', started, 'spent', spent, 'levels', lv);
end; $$;
create or replace function public.arena_bistro_kitchen(pid uuid, t timestamptz) returns jsonb
language sql security definer set search_path = public as $$
  select public.arena_bistro_kitchen(pid, t, t)
$$;
revoke all on function public.arena_bistro_start(uuid, integer, text, timestamptz, integer, double precision),
  public.arena_bistro_start(uuid, integer, text, timestamptz, integer),
  public.arena_bistro_kitchen(uuid, timestamptz, timestamptz), public.arena_bistro_kitchen(uuid, timestamptz)
  from public, anon, authenticated, service_role;
-- 0..50: litter now takes a point each (up to 8).
create or replace function public.arena_bistro_popularity(pid uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select least(50::float8, greatest(0::float8,
    b.rating * 6
    + least(10::float8, coalesce((select sum(k.charm) from public.arena_bistro_items i
        join public.arena_bistro_kinds k on k.kind = i.kind where i.player_id = pid), 0)::float8 / 3)
    + 0::float8
    + least(4::float8, 0.5::float8 * public.arena_bistro_likes_week(pid)::float8
        + 0.5::float8 * public.arena_bistro_dined_today(pid)::float8)
    - least(8::float8, b.trash::float8)))
  from public.arena_bistros b where b.player_id = pid
$$;
-- What the time away's pace is made of (see serviceParts()): the arrivals,
-- the seats' turnover, a waiter's meal and the clearing (none with a janitor).
create or replace function public.arena_bistro_service_parts(pid uuid,
  out arrivals double precision, out seat_rate double precision, out t_meal double precision,
  out seats integer, out clear double precision)
language plpgsql stable security definer set search_path = public as $$
declare r record; sum_w integer = 0;
begin
  arrivals = 1 / greatest(2.2::float8, 9::float8 - 0.136::float8 * public.arena_bistro_popularity(pid));
  seat_rate = 0; seats = 0; t_meal = 0;
  for r in select * from public.arena_bistro_walks(pid) loop
    seat_rate = seat_rate + 1 / (20::float8 + (2 * r.guest)::float8 / 2::float8);
    seats = seats + 1;
    sum_w = sum_w + r.waiter;
  end loop;
  if seats > 0 then t_meal = sum_w::float8 / seats::float8 / 2.8::float8 + 5::float8; end if;
  clear = case when exists (select 1 from public.arena_bistro_staff where player_id = pid and role = 'janitor')
    then 0::float8 else 1.2::float8 end;
end; $$;
-- The staff of a role, their pace summed, ms after last_seen.
create or replace function public.arena_bistro_pace(pid uuid, p_role text, ms double precision, p_corners integer)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare s public.arena_bistro_staff; total double precision = 0;
begin
  for s in select * from public.arena_bistro_staff where player_id = pid and role = p_role order by id loop
    total = total + public.arena_bistro_work_speed(s.level, s.friend_id is not null,
      public.arena_bistro_energy(s, ms, p_corners));
  end loop;
  return total;
end; $$;
create or replace function public.arena_bistro_service_rate(pid uuid) returns double precision
language plpgsql stable security definer set search_path = public as $$
declare p record; speed double precision;
begin
  select * into p from public.arena_bistro_service_parts(pid);
  speed = public.arena_bistro_pace(pid, 'waiter', 0, public.arena_bistro_corners(pid));
  return least(p.arrivals, p.seat_rate, case when p.seats > 0 then speed / (p.t_meal + p.clear) else 0::float8 end);
end; $$;
revoke all on function public.arena_bistro_service_parts(uuid), public.arena_bistro_pace(uuid, text, double precision, integer),
  public.arena_bistro_service_rate(uuid), public.arena_bistro_popularity(uuid)
  from public, anon, authenticated, service_role;
-- Bring the bistro up to time t (see 068), with tired staff, litter and janitors.
create or replace function public.arena_bistro_catch_up(pid uuid, t timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare b public.arena_bistros; v_from timestamptz; v_end timestamptz; tt timestamptz; ev jsonb;
  rate double precision; acc double precision = 0; v_slot integer; v_dish text; v_price integer;
  v_special text; bill integer; v_served integer = 0; v_coins integer = 0; v_spent integer = 0; v_batches integer = 0;
  lv integer = 0; away boolean; cap interval;
  p record; corners integer; secs double precision; ms double precision; served_now integer;
  v_trash integer; dirt double precision = 0; sweep double precision = 0; jr double precision;
begin
  -- Friends who are friends no more stay on as creatures (a free one if theirs is taken).
  update public.arena_bistro_staff s set friend_id = null,
    creature = case when exists (select 1 from public.arena_bistro_staff o where o.player_id = pid
        and o.friend_id is null and o.creature = s.creature)
      then (select c from unnest(public.arena_champion_ids()) c where not exists (
        select 1 from public.arena_bistro_staff o where o.player_id = pid and o.creature = c) limit 1)
      else s.creature end
   where s.player_id = pid and s.friend_id is not null and not public.arena_farm_are_friends(pid, s.friend_id);
  select * into b from public.arena_bistros where player_id = pid;
  v_from = b.last_seen;
  update public.arena_bistros set last_seen = t where player_id = pid;
  if v_from is null or t <= v_from then return; end if;
  away = t - v_from >= interval '60 seconds';
  cap = make_interval(hours => (array[2, 4, 6, 8])[b.shift_lv + 1]);
  v_end = case when away then least(t, v_from + cap) else t end;
  select * into p from public.arena_bistro_service_parts(pid);
  corners = public.arena_bistro_corners(pid);
  v_trash = b.trash;
  v_special = public.arena_bistro_special(b.level, public.arena_today());
  tt = v_from;
  while tt < v_end loop
    ev = public.arena_bistro_kitchen(pid, tt, v_from);
    v_batches = v_batches + (ev->>'plated')::integer;
    v_spent = v_spent + (ev->>'spent')::integer;
    lv = lv + (ev->>'levels')::integer;
    if away then
      secs = least(15000, extract(epoch from v_end - tt) * 1000) / 1000;
      ms = extract(epoch from tt - v_from) * 1000;
      -- The waiters' pace now (tired from the work since v_from).
      rate = least(p.arrivals, p.seat_rate, case when p.seats > 0
        then public.arena_bistro_pace(pid, 'waiter', ms, corners) / (p.t_meal + p.clear) else 0::float8 end);
      acc = acc + rate * 0.5::float8 * secs;
      served_now = 0;
      while acc >= 1 loop
        select slot, dish into v_slot, v_dish from public.arena_bistro_counter
         where player_id = pid and dish is not null and servings > 0 order by servings desc, slot limit 1;
        if v_slot is null then acc = least(acc, 1); exit; end if;
        perform public.arena_bistro_take(pid, v_dish);
        select price into v_price from public.arena_bistro_dishes where id = v_dish;
        bill = public.arena_bistro_pay(v_price, v_dish = v_special, false, 1, 2, false, false);
        update public.arena_bistros set coins = coins + bill, served = served + 1 where player_id = pid;
        v_coins = v_coins + bill;
        v_served = v_served + 1;
        lv = lv + public.arena_bistro_add_xp(pid, 1);
        served_now = served_now + 1;
        acc = acc - 1;
      end loop;
      -- Litter from the guests; the janitors sweep it up.
      dirt = dirt + 0.08::float8 * served_now;
      while dirt >= 1 loop
        v_trash = least(10, v_trash + 1);
        dirt = dirt - 1;
      end loop;
      jr = public.arena_bistro_pace(pid, 'janitor', ms, corners);
      sweep = sweep + ((jr * 30::float8) / 3600::float8) * secs;
      while sweep >= 1 and v_trash > 0 loop
        v_trash = v_trash - 1;
        sweep = sweep - 1;
      end loop;
      if v_trash = 0 then sweep = least(sweep, 1::float8); end if;
    end if;
    tt = tt + interval '15 seconds';
  end loop;
  -- Energy: worn down by the work, then the rest after the shift.
  update public.arena_bistro_staff s set energy = public.arena_bistro_after_rest(s.level,
      public.arena_bistro_energy(s, extract(epoch from v_end - v_from) * 1000, corners),
      extract(epoch from t - v_end) * 1000)
   where s.player_id = pid;
  update public.arena_bistros set trash = v_trash where player_id = pid;
  if away then
    update public.arena_bistros set away = jsonb_build_object(
      'worked', round(extract(epoch from v_end - v_from) * 1000),
      'away', round(extract(epoch from t - v_from) * 1000),
      'capped', t - v_from > cap,
      'served', v_served, 'coins', v_coins, 'spent', v_spent, 'batches', v_batches, 'levels', lv)
     where player_id = pid;
  end if;
end; $$;
revoke all on function public.arena_bistro_catch_up(uuid, timestamptz) from public, anon, authenticated, service_role;
-- What the player sees: also the staff's energy, friends on the team, litter.
create or replace function public.arena_bistro_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.arena_bistros; t timestamptz = now(); d date = public.arena_today();
begin
  select * into b from public.arena_bistros where player_id = pid;
  return jsonb_build_object(
    'v', 1,
    'now', (extract(epoch from t) * 1000)::bigint,
    'coins', b.coins, 'xp', b.xp, 'level', b.level,
    'rating', round(b.rating::numeric, 3), 'served', b.served,
    'floor', b.floor, 'wall', b.wall, 'floors', to_jsonb(b.floors), 'walls', to_jsonb(b.walls),
    'kitchenLv', b.kitchen_lv, 'shiftLv', b.shift_lv, 'sizeLv', b.size_lv, 'chef', b.chef, 'likes', b.likes,
    'likesWeek', public.arena_bistro_likes_week(pid),
    'trash', b.trash,
    'lastSeen', coalesce((extract(epoch from b.last_seen) * 1000)::bigint, 0),
    'special', public.arena_bistro_special(b.level, d),
    'items', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'kind', kind, 'x', x, 'y', y, 'rot', rot) order by id)
      from public.arena_bistro_items where player_id = pid), '[]'::jsonb),
    'nextId', coalesce((select max(id) from public.arena_bistro_items where player_id = pid), 0) + 1,
    'stored', coalesce((select jsonb_object_agg(kind, qty) from public.arena_bistro_stored
      where player_id = pid and qty > 0), '{}'::jsonb),
    'stoves', (select jsonb_agg(case when dish is null then jsonb_build_object('dish', null, 'start', 0, 'perfect', false)
        else jsonb_build_object('dish', dish, 'start', (extract(epoch from started_at) * 1000)::bigint,
          'perfect', perfect, 'dur', dur_ms) end order by idx)
      from public.arena_bistro_stoves where player_id = pid),
    'counter', (select jsonb_agg(case when dish is null then 'null'::jsonb
        else jsonb_build_object('dish', dish, 'servings', servings, 'perfect', perfect) end order by slot)
      from public.arena_bistro_counter where player_id = pid),
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', s.id,
        'char', coalesce(fp.portrait_character, s.creature), 'role', s.role,
        'level', s.level, 'dish', s.dish,
        'energy', coalesce(s.energy, public.arena_bistro_energy_max(s.level)),
        'fedAt', coalesce((extract(epoch from s.fed_at) * 1000)::bigint, 0))
        || case when fp.id is null then '{}'::jsonb
          else jsonb_build_object('friend', jsonb_build_object('id', fp.id, 'name', fp.display_name)) end
        order by s.id)
      from public.arena_bistro_staff s left join public.arena_profiles fp on fp.id = s.friend_id
      where s.player_id = pid), '[]'::jsonb),
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = pid), 0),
    'tradedToday', coalesce((select sum(amount) from public.arena_leaf_ledger
      where player_id = pid and day = d and reason = 'bistro-trade'), 0),
    -- Friends who ate here today, newest first.
    'friendGuests', coalesce((select jsonb_agg(jsonb_build_object('name', p.display_name,
        'fighter', p.portrait_character, 'dish', x.dish) order by x.created_at desc)
      from public.arena_bistro_dines x join public.arena_profiles p on p.id = x.diner
      where x.owner = pid and x.day = d), '[]'::jsonb),
    'dinesToday', (select count(*) from public.arena_bistro_dines where diner = pid and day = d));
end; $$;
revoke all on function public.arena_bistro_state(uuid) from public, anon, authenticated, service_role;
-- Open the bistro (see 068), and collect a friend's payday.
create or replace function public.arena_bistro() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); v_away jsonb; d date = public.arena_today(); n integer; v_pay jsonb = null;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_bistro_ensure(me);
  perform 1 from public.arena_bistros where player_id = me for update;
  perform public.arena_bistro_catch_up(me, now());
  select away into v_away from public.arena_bistros where player_id = me;
  update public.arena_bistros set away = null where player_id = me and away is not null;
  -- Payday: 3 XP for each friend's bistro you work at, once a day, up to 5.
  insert into public.arena_bistro_paydays(worker, employer, day)
  select me, s.player_id, d from public.arena_bistro_staff s
   where s.friend_id = me and public.arena_farm_are_friends(me, s.player_id)
     and not exists (select 1 from public.arena_bistro_paydays x where x.worker = me and x.employer = s.player_id and x.day = d)
   order by s.player_id
   limit greatest(0, 5 - (select count(*) from public.arena_bistro_paydays x where x.worker = me and x.day = d))
  on conflict do nothing;
  get diagnostics n = row_count;
  if n > 0 then
    perform public.arena_bistro_add_xp(me, 3 * n);
    v_pay = jsonb_build_object('xp', 3 * n, 'bistros', n);
  end if;
  return public.arena_bistro_state(me) || jsonb_build_object('away', v_away, 'payday', v_pay);
end; $$;
revoke all on function public.arena_bistro() from public, anon;
grant execute on function public.arena_bistro() to authenticated;
-- Actions (see 068); also feed {id} (a staff meal), sweep (litter), and
-- hire {role, char} or {role, friend} for any of the three roles.
create or replace function public.arena_bistro_act(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  b public.arena_bistros; a jsonb; i integer = 0; v_kind text; err text; gained jsonb; inserted integer;
  st public.arena_bistro_stoves; v_dish public.arena_bistro_dishes; k public.arena_bistro_kinds;
  v_idx integer; n integer; v_price integer; v_cost integer; r jsonb; v_x integer; v_y integer; v_rot integer;
  v_id integer; v_seats integer; v_vip boolean; v_hearts integer; v_bill integer; v_slot integer;
  v_staff public.arena_bistro_staff; v_count integer; v_lv integer; v_away jsonb; v_traded integer;
  results jsonb = '[]'::jsonb; v_friend uuid; v_char text; v_e double precision;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or jsonb_typeof(p_actions) is distinct from 'array'
     or jsonb_array_length(p_actions) not between 1 and 40 then
    raise exception 'Invalid bistro request';
  end if;
  perform public.arena_bistro_ensure(me);
  -- One request at a time per bistro.
  perform 1 from public.arena_bistros where player_id = me for update;
  insert into public.arena_bistro_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('bistro', public.arena_bistro_state(me), 'results', '[]'::jsonb, 'repeated', true);
  end if;
  delete from public.arena_bistro_requests where player_id = me and created_at < t - interval '2 days';
  perform public.arena_bistro_catch_up(me, t);
  select away into v_away from public.arena_bistros where player_id = me;
  update public.arena_bistros set away = null where player_id = me and away is not null;
  for a in select * from jsonb_array_elements(p_actions) loop
    i = i + 1; err = null; gained = null;
    v_kind = a->>'a';
    select * into b from public.arena_bistros where player_id = me;
    v_idx = case when jsonb_typeof(a->'stove') = 'number' then (a->>'stove')::integer else null end;
    if v_kind in ('cook', 'stir', 'plate') then
      select * into st from public.arena_bistro_stoves where player_id = me and idx = v_idx;
    end if;
    if v_kind in ('cook', 'stir', 'plate') and st.idx is null then
      err = 'No stove there.';
    elsif v_kind = 'cook' then
      err = public.arena_bistro_start(me, v_idx, a->>'dish', t, 1);
    elsif v_kind = 'stir' then
      if st.dish is null or st.perfect
         or t < st.started_at + make_interval(secs => st.dur_ms * 0.78 / 1000.0)
         or t >= st.started_at + make_interval(secs => st.dur_ms * 0.96 / 1000.0) then
        err = 'Not the golden moment.';
      else
        update public.arena_bistro_stoves set perfect = true where player_id = me and idx = v_idx;
      end if;
    elsif v_kind = 'plate' then
      r = public.arena_bistro_plate(me, v_idx, t);
      if r ? 'error' then err = r->>'error'; else gained = r - 'ok'; end if;
    elsif v_kind = 'serve' then
      select * into v_dish from public.arena_bistro_dishes where id = a->>'dish';
      select count(*) into v_seats from public.arena_bistro_seats(me);
      -- The allowance refills by the seats; each guest takes one.
      b.sale_budget = least(v_seats + 4, b.sale_budget + greatest(0, extract(epoch from t - b.sale_at)) * (v_seats * 0.1));
      update public.arena_bistros set sale_budget = b.sale_budget, sale_at = t where player_id = me;
      if v_dish.id is null then err = 'Unknown dish.';
      elsif b.sale_budget < 1 then err = 'Too many guests at once.';
      else
        v_slot = public.arena_bistro_take(me, v_dish.id);
        if v_slot is null then err = 'None left on the counter.';
        else
          -- A VIP only while the VIP allowance lasts.
          v_vip = coalesce((a->>'vip')::boolean, false) and b.vip_budget >= 1;
          v_hearts = least(3, greatest(1, coalesce((a->>'hearts')::integer, 3)));
          v_bill = public.arena_bistro_pay(v_dish.price,
            v_dish.id = public.arena_bistro_special(b.level, d), v_vip,
            coalesce((a->>'combo')::integer, 1), v_hearts, coalesce((a->>'quick')::boolean, false),
            public.arena_bistro_rush(t));
          update public.arena_bistros set coins = coins + v_bill, served = served + 1,
            sale_budget = sale_budget - 1,
            vip_budget = least(3, vip_budget + 0.15) - case when v_vip then 1 else 0 end,
            rating = least(5, greatest(0, rating + ((case v_hearts when 3 then 5 when 2 then 4 else 2.5 end) - rating) * 0.08))
           where player_id = me;
          v_lv = public.arena_bistro_add_xp(me, case when v_vip then 3 else 1 end);
          gained = jsonb_build_object('coins', v_bill, 'vip', v_vip, 'levels', v_lv);
        end if;
      end if;
    elsif v_kind = 'leave' then
      -- A guest left hungry: the stars drop a little.
      update public.arena_bistros set rating = greatest(0, rating + (0.5 - rating) * 0.08) where player_id = me;
    elsif v_kind = 'place' then
      select * into k from public.arena_bistro_kinds where kind = a->>'kind';
      v_x = case when jsonb_typeof(a->'x') = 'number' then (a->>'x')::integer else -1 end;
      v_y = case when jsonb_typeof(a->'y') = 'number' then (a->>'y')::integer else -1 end;
      v_rot = least(3, greatest(0, coalesce((a->>'rot')::integer, 0)));
      v_id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer else null end;
      if k.kind is null then err = 'Unknown item.';
      elsif v_id is not null and not exists (select 1 from public.arena_bistro_items
          where player_id = me and id = v_id and kind = k.kind) then err = 'Nothing there.';
      elsif v_id is null and coalesce((select qty from public.arena_bistro_stored
          where player_id = me and kind = k.kind), 0) < 1 then err = 'None in storage.';
      else
        err = public.arena_bistro_place_error(me, k.kind, v_x, v_y, v_id);
        if err is null then
          begin
            if v_id is null then
              update public.arena_bistro_stored set qty = qty - 1 where player_id = me and kind = k.kind;
              insert into public.arena_bistro_items(player_id, id, kind, x, y, rot)
              values (me, coalesce((select max(id) from public.arena_bistro_items where player_id = me), 0) + 1,
                k.kind, v_x, v_y, v_rot);
            else
              update public.arena_bistro_items set x = v_x, y = v_y, rot = v_rot where player_id = me and id = v_id;
            end if;
            err = public.arena_bistro_plan_error(me);
            -- A plan that doesn't work is undone.
            if err is not null then raise exception using errcode = 'P0001', message = 'bistro-plan'; end if;
          exception when sqlstate 'P0001' then
            if sqlerrm <> 'bistro-plan' then raise; end if;
          end;
        end if;
      end if;
    elsif v_kind = 'store' then
      v_id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer else null end;
      if not exists (select 1 from public.arena_bistro_items where player_id = me and id = v_id) then
        err = 'Nothing there.';
      else
        insert into public.arena_bistro_stored(player_id, kind, qty)
        select me, kind, 1 from public.arena_bistro_items where player_id = me and id = v_id
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
        delete from public.arena_bistro_items where player_id = me and id = v_id;
      end if;
    elsif v_kind = 'buy' then
      select * into k from public.arena_bistro_kinds where kind = a->>'kind';
      if k.kind is null then err = 'Unknown item.';
      elsif k.level > b.level then err = 'Opens at level ' || k.level || '.';
      elsif b.coins < k.price then err = 'You need ' || k.price || ' coins.';
      else
        update public.arena_bistros set coins = coins - k.price where player_id = me;
        insert into public.arena_bistro_stored(player_id, kind, qty) values (me, k.kind, 1)
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
      end if;
    elsif v_kind = 'style' then
      v_price = case a->>'kind'
        when 'floor' then case a->>'id' when 'checker' then 0 when 'wood' then 150 when 'teal' then 220 end
        when 'wall' then case a->>'id' when 'butter' then 0 when 'mint' then 150 when 'brick' then 220 end end;
      if v_price is null then err = 'Unknown style.';
      elsif not ((a->>'kind' = 'floor' and a->>'id' = any(b.floors)) or (a->>'kind' = 'wall' and a->>'id' = any(b.walls)))
            and b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      elsif a->>'kind' = 'floor' then
        update public.arena_bistros set
          coins = coins - case when a->>'id' = any(floors) then 0 else v_price end,
          floors = case when a->>'id' = any(floors) then floors else floors || (a->>'id') end,
          floor = a->>'id' where player_id = me;
      else
        update public.arena_bistros set
          coins = coins - case when a->>'id' = any(walls) then 0 else v_price end,
          walls = case when a->>'id' = any(walls) then walls else walls || (a->>'id') end,
          wall = a->>'id' where player_id = me;
      end if;
    elsif v_kind = 'stove' then
      select count(*) into n from public.arena_bistro_stoves where player_id = me;
      v_price = (array[0, 0, 200, 450])[n + 1];
      if n >= 4 then err = 'Every stove slot is in use.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price where player_id = me;
        insert into public.arena_bistro_stoves(player_id, idx) values (me, n);
      end if;
    elsif v_kind = 'expand' then
      -- A bigger dining room: level 4 / 800, level 8 / 2,500, level 12 / 6,000.
      v_lv = (array[4, 8, 12])[b.size_lv + 1];
      v_price = (array[800, 2500, 6000])[b.size_lv + 1];
      if v_price is null then err = 'The dining room is as big as it gets.';
      elsif b.level < v_lv then err = 'Expand at level ' || v_lv || '.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price, size_lv = size_lv + 1 where player_id = me;
      end if;
    elsif v_kind in ('kitchen', 'shift') then
      v_lv = case when v_kind = 'kitchen' then b.kitchen_lv else b.shift_lv end;
      v_price = case when v_kind = 'kitchen' then (array[300, 700, 1400])[v_lv + 1] else (array[300, 800, 1600])[v_lv + 1] end;
      if v_price is null then err = case when v_kind = 'kitchen' then 'The kitchen is fully upgraded.' else 'Shifts are as long as they go.' end;
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      elsif v_kind = 'kitchen' then
        update public.arena_bistros set coins = coins - v_price, kitchen_lv = kitchen_lv + 1 where player_id = me;
      else
        update public.arena_bistros set coins = coins - v_price, shift_lv = shift_lv + 1 where player_id = me;
      end if;
    elsif v_kind = 'hire' then
      select count(*) into v_count from public.arena_bistro_staff where player_id = me and role = a->>'role';
      v_lv = case a->>'role' when 'cook' then (array[2, 5, 9])[v_count + 1] when 'waiter' then (array[1, 3, 6])[v_count + 1]
        when 'janitor' then (array[4, 8])[v_count + 1] end;
      v_price = case a->>'role' when 'cook' then (array[250, 900, 2000])[v_count + 1] when 'waiter' then (array[0, 400, 1000])[v_count + 1]
        when 'janitor' then (array[300, 900])[v_count + 1] end;
      v_friend = case when coalesce(a->>'friend', '') ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
        then (a->>'friend')::uuid end;
      v_char = case when v_friend is not null
        then (select portrait_character from public.arena_profiles where id = v_friend and not suspended) else a->>'char' end;
      if a->>'role' not in ('cook', 'waiter', 'janitor') then err = 'Unknown role.';
      elsif v_lv is null then err = 'You have every ' || (a->>'role') || ' you can hire.';
      elsif b.level < v_lv then err = 'Hire at level ' || v_lv || '.';
      elsif a ? 'friend' and (v_friend is null or v_friend = me or not public.arena_farm_are_friends(me, v_friend)) then
        err = 'Only friends can work here.';
      elsif v_char is null or not (v_char = any(public.arena_champion_ids())) then err = 'Unknown creature.';
      elsif v_friend is not null and exists (select 1 from public.arena_bistro_staff where player_id = me and friend_id = v_friend) then
        err = 'Already on your team.';
      elsif v_friend is null and exists (select 1 from public.arena_bistro_staff where player_id = me and friend_id is null and creature = v_char) then
        err = 'Already on your team.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price where player_id = me;
        insert into public.arena_bistro_staff(player_id, id, creature, role, dish, friend_id)
        values (me, coalesce((select max(id) from public.arena_bistro_staff where player_id = me), 0) + 1,
          v_char, a->>'role',
          case when a->>'role' = 'cook' then (select id from public.arena_bistro_dishes where level <= b.level order by ord desc limit 1)
            else 'goicuon' end, v_friend);
      end if;
    elsif v_kind = 'feed' then
      select * into v_staff from public.arena_bistro_staff where player_id = me
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      select slot, dish into v_slot, v_char from public.arena_bistro_counter
       where player_id = me and dish is not null and servings > 0 order by servings desc, slot limit 1;
      if v_staff.id is null then err = 'Not on your team.';
      elsif v_staff.fed_at is not null and t < v_staff.fed_at + interval '10 minutes' then
        err = 'They just ate: try again in a few minutes.';
      elsif v_slot is null then err = 'Nothing on the counter to eat.';
      else
        perform public.arena_bistro_take(me, v_char);
        -- Energy is as of now (the catch-up just ran).
        v_e = coalesce(v_staff.energy, public.arena_bistro_energy_max(v_staff.level));
        update public.arena_bistro_staff set fed_at = t,
          energy = least(public.arena_bistro_energy_max(level), v_e + 50)
         where player_id = me and id = v_staff.id;
      end if;
    elsif v_kind = 'sweep' then
      if b.trash <= 0 then err = 'Nothing to sweep.';
      else update public.arena_bistros set trash = trash - 1 where player_id = me;
      end if;
    elsif v_kind = 'train' then
      select * into v_staff from public.arena_bistro_staff where player_id = me
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      if v_staff.id is null then err = 'Not on your team.';
      elsif v_staff.level >= 5 then err = 'Already at the top level.';
      elsif b.coins < 150 * v_staff.level * v_staff.level then err = 'You need ' || 150 * v_staff.level * v_staff.level || ' coins.';
      else
        update public.arena_bistros set coins = coins - 150 * v_staff.level * v_staff.level where player_id = me;
        update public.arena_bistro_staff set level = level + 1 where player_id = me and id = v_staff.id;
      end if;
    elsif v_kind = 'cookdish' then
      select * into v_staff from public.arena_bistro_staff where player_id = me and role = 'cook'
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      select * into v_dish from public.arena_bistro_dishes where id = a->>'dish';
      if v_staff.id is null then err = 'Not a cook.';
      elsif v_dish.id is null then err = 'Unknown dish.';
      elsif v_dish.level > b.level then err = 'Opens at level ' || v_dish.level || '.';
      else update public.arena_bistro_staff set dish = v_dish.id where player_id = me and id = v_staff.id;
      end if;
    elsif v_kind = 'chef' then
      if not (a->>'id' = any(public.arena_champion_ids())) then err = 'Unknown creature.';
      else update public.arena_bistros set chef = a->>'id' where player_id = me;
      end if;
    elsif v_kind = 'trade' then
      n = case when jsonb_typeof(a->'lots') = 'number' then (a->>'lots')::integer else null end;
      v_traded = coalesce((select sum(amount) from public.arena_leaf_ledger
        where player_id = me and day = d and reason = 'bistro-trade'), 0);
      if n is null or n < 1 or n > 15 then err = 'Choose how many to trade.';
      elsif v_traded + n * 20 > 300 then err = 'You can trade for at most 300 Gold Leaves a day.';
      elsif b.coins < n * 100 then err = 'You need ' || n * 100 || ' coins.';
      elsif not public.arena_grant_leaves(me, n * 20, 'bistro-trade', p_request || ':' || i, d) then
        err = 'The trade could not be made.';
      else
        update public.arena_bistros set coins = coins - n * 100 where player_id = me;
        gained = jsonb_build_object('leaves', n * 20);
      end if;
    elsif v_kind = 'sync' then
      null;
    else
      err = 'Unknown action.';
    end if;
    results = results || jsonb_build_array(case when err is null
      then jsonb_build_object('ok', true) || coalesce(gained, '{}'::jsonb)
      else jsonb_build_object('ok', false, 'error', err) end);
  end loop;
  return jsonb_build_object('bistro', public.arena_bistro_state(me), 'results', results, 'away', v_away);
end; $$;
revoke all on function public.arena_bistro_act(uuid, jsonb) from public, anon;
grant execute on function public.arena_bistro_act(uuid, jsonb) to authenticated;
-- Eat at a friend's (see 068): if you work there, it fills your energy.
create or replace function public.arena_bistro_friend_act(p_request uuid, p_friend uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); inserted integer; v_slot integer; v_dish text;
  v_price integer; v_pay integer; gained jsonb = '{}'::jsonb; err text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_friend is null or not public.arena_farm_are_friends(me, p_friend) then
    raise exception 'Only friends can visit';
  end if;
  if not exists (select 1 from public.arena_bistros where player_id = p_friend) then
    raise exception 'This friend has no bistro yet';
  end if;
  if p_request is null or p_kind not in ('dine', 'like') then raise exception 'Invalid bistro request'; end if;
  perform public.arena_bistro_ensure(me);
  -- Your bistro first, then theirs (the same order everywhere: no deadlock).
  perform 1 from public.arena_bistros where player_id in (me, p_friend) order by player_id for update;
  insert into public.arena_bistro_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('bistro', public.arena_bistro_view(me, p_friend), 'ok', true, 'repeated', true);
  end if;
  if p_kind = 'dine' then
    if exists (select 1 from public.arena_bistro_dines where diner = me and owner = p_friend and day = d) then
      err = 'You already ate here today.';
    elsif (select count(*) from public.arena_bistro_dines where diner = me and day = d) >= 10 then
      err = 'You ate at 10 bistros today: come back tomorrow.';
    else
      select slot, dish into v_slot, v_dish from public.arena_bistro_counter
       where player_id = p_friend and dish is not null and servings > 0 order by servings desc, slot limit 1;
      if v_slot is null then err = 'Nothing on their counter right now.';
      else
        perform public.arena_bistro_take(p_friend, v_dish);
        select price into v_price from public.arena_bistro_dishes where id = v_dish;
        v_pay = v_price + round(v_price * 0.5)::integer;
        update public.arena_bistros set coins = coins + v_pay, served = served + 1 where player_id = p_friend;
        perform public.arena_bistro_add_xp(p_friend, 2);
        update public.arena_bistros set coins = coins + 10 where player_id = me;
        perform public.arena_bistro_add_xp(me, 5);
        insert into public.arena_bistro_dines(diner, owner, day, dish) values (me, p_friend, d, v_dish);
        -- Working there? Your meal fills your energy.
        update public.arena_bistro_staff set energy = public.arena_bistro_energy_max(level)
         where player_id = p_friend and friend_id = me;
        gained = jsonb_build_object('dish', v_dish, 'paid', v_pay, 'coins', 10, 'xp', 5);
      end if;
    end if;
  else
    insert into public.arena_bistro_likes(liker, owner, week) values (me, p_friend, date_trunc('week', d)::date)
    on conflict do nothing;
    get diagnostics inserted = row_count;
    if inserted = 0 then err = 'You liked this bistro this week.';
    else
      update public.arena_bistros set likes = likes + 1 where player_id = p_friend;
      perform public.arena_bistro_add_xp(me, 2);
      gained = jsonb_build_object('xp', 2);
    end if;
  end if;
  return jsonb_build_object('bistro', public.arena_bistro_view(me, p_friend),
    'ok', err is null, 'error', err) || gained;
end; $$;
revoke all on function public.arena_bistro_friend_act(uuid, uuid, text) from public, anon;
grant execute on function public.arena_bistro_friend_act(uuid, uuid, text) to authenticated;

commit;

select
  to_regprocedure('public.arena_bistro_pace(uuid,text,double precision,integer)') is not null as bistro_energy_enabled,
  exists (select 1 from public.arena_bistro_kinds where kind = 'corner') as bistro_staff_corner_seeded;

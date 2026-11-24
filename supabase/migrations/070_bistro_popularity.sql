-- Element Bistro, part 2: popularity and the floor plan's walks.
-- Run after 068_bistro.sql. Safe to run again.
--
-- Rules match packages/shared/src/bistro.ts (tests/integration/bistro.test.ts
-- checks the two agree), see docs/bistro-gdd.md §3–4.
--
--  * Popularity (0..50): rating × 6, plus the decor (charm / 3, up to 10),
--    plus friends (half a point a like this week and a friend's meal today,
--    up to 4). It sets how often guests come: every max(2.2, 9 − 0.136 × P) s.
--  * The floor plan's walks: steps from the door and from the counter's
--    pickup spots (breadth-first). Each seat turns over in 20 s plus the walk
--    in and out; a waiter's meal takes the average walk there and back at
--    2.8 steps a second, plus 5 s handling and 1.2 s clearing. While you are
--    away, guests are served at the slowest of the arrivals, the seats and
--    the waiters, so a good plan earns more.
begin;

-- Steps from the sources (tile indexes y * w + x) to every tile: -1 where
-- you can't get to. Index y * w + x + 1 in the result.
create or replace function public.arena_bistro_dist(b boolean[], w integer, h integer, src integer[])
returns integer[] language plpgsql immutable set search_path = '' as $$
declare d integer[] = array_fill(-1, array[w * h]); q integer[] = '{}'; head integer = 1;
  k integer; x integer; y integer; nx integer; ny integer; nk integer; i integer;
begin
  foreach k in array src loop
    if k >= 0 and k < w * h and not b[k + 1] and d[k + 1] < 0 then
      d[k + 1] = 0;
      q = q || k;
    end if;
  end loop;
  while head <= coalesce(array_length(q, 1), 0) loop
    k = q[head]; head = head + 1;
    x = k % w; y = k / w;
    for i in 1..4 loop
      nx = x + (array[1, 0, -1, 0])[i];
      ny = y + (array[0, 1, 0, -1])[i];
      if nx < 0 or ny < 0 or nx >= w or ny >= h then continue; end if;
      nk = ny * w + nx;
      if b[nk + 1] or d[nk + 1] >= 0 then continue; end if;
      d[nk + 1] = d[k + 1] + 1;
      q = q || nk;
    end loop;
  end loop;
  return d;
end; $$;
-- The nearest value of a field on the free tiles beside the targets (-1 if none).
create or replace function public.arena_bistro_near(d integer[], b boolean[], w integer, h integer,
  xs integer[], ys integer[])
returns integer language plpgsql immutable set search_path = '' as $$
declare best integer = -1; j integer; i integer; nx integer; ny integer; nk integer;
begin
  for j in 1..array_length(xs, 1) loop
    for i in 1..4 loop
      nx = xs[j] + (array[1, 0, -1, 0])[i];
      ny = ys[j] + (array[0, 1, 0, -1])[i];
      if nx < 0 or ny < 0 or nx >= w or ny >= h then continue; end if;
      nk = ny * w + nx;
      if b[nk + 1] or d[nk + 1] < 0 then continue; end if;
      if best < 0 or d[nk + 1] < best then best = d[nk + 1]; end if;
    end loop;
  end loop;
  return best;
end; $$;
-- Every seat you can get to, with its walks (by chair, as the client lists them).
create or replace function public.arena_bistro_walks(pid uuid)
returns table(chair integer, tbl integer, guest integer, waiter integer)
language plpgsql stable security definer set search_path = public as $$
declare w integer; h integer; b boolean[]; dd integer[]; dk integer[]; s record; g integer; k integer;
begin
  select public.arena_bistro_cols(size_lv), public.arena_bistro_rows(size_lv) into w, h
    from public.arena_bistros where player_id = pid;
  b = public.arena_bistro_blocked(pid);
  dd = public.arena_bistro_dist(b, w, h, array[7 * w]);
  dk = public.arena_bistro_dist(b, w, h, array[3 * w + 1, 3 * w + 2, 3 * w + 3, 3 * w + 4]);
  for s in select se.chair, se.cx, se.cy, se.tbl, t.x tx, t.y ty
      from public.arena_bistro_seats(pid) se
      join public.arena_bistro_items t on t.player_id = pid and t.id = se.tbl
      order by se.chair loop
    g = public.arena_bistro_near(dd, b, w, h, array[s.cx], array[s.cy]);
    k = public.arena_bistro_near(dk, b, w, h, array[s.cx, s.tx], array[s.cy, s.ty]);
    if g < 0 or k < 0 then continue; end if;
    chair = s.chair; tbl = s.tbl; guest = g + 1; waiter = 2 * k;
    return next;
  end loop;
end; $$;
-- Likes this week and friends' meals today, at a bistro.
create or replace function public.arena_bistro_likes_week(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.arena_bistro_likes
   where owner = pid and week = date_trunc('week', public.arena_today())::date
$$;
create or replace function public.arena_bistro_dined_today(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::integer from public.arena_bistro_dines where owner = pid and day = public.arena_today()
$$;
-- 0..50, not rounded (see popularity() in the shared rules).
create or replace function public.arena_bistro_popularity(pid uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select least(50::float8, greatest(0::float8,
    b.rating * 6
    + least(10::float8, coalesce((select sum(k.charm) from public.arena_bistro_items i
        join public.arena_bistro_kinds k on k.kind = i.kind where i.player_id = pid), 0)::float8 / 3)
    + 0::float8
    + least(4::float8, 0.5::float8 * public.arena_bistro_likes_week(pid)::float8
        + 0.5::float8 * public.arena_bistro_dined_today(pid)::float8)
    - 0::float8))
  from public.arena_bistros b where b.player_id = pid
$$;
-- Guests a second the staff can serve while you are away (see serviceRate()).
create or replace function public.arena_bistro_service_rate(pid uuid) returns double precision
language plpgsql stable security definer set search_path = public as $$
declare arrivals double precision; seat_rate double precision = 0; n integer = 0; sum_w integer = 0;
  speed double precision = 0; waiter_rate double precision = 0; r record;
begin
  arrivals = 1 / greatest(2.2::float8, 9::float8 - 0.136::float8 * public.arena_bistro_popularity(pid));
  for r in select * from public.arena_bistro_walks(pid) loop
    seat_rate = seat_rate + 1 / (20::float8 + (2 * r.guest)::float8 / 2::float8);
    n = n + 1;
    sum_w = sum_w + r.waiter;
  end loop;
  for r in select level from public.arena_bistro_staff where player_id = pid and role = 'waiter' order by id loop
    speed = speed + public.arena_bistro_speed(r.level);
  end loop;
  if n > 0 then
    waiter_rate = speed / (sum_w::float8 / n::float8 / 2.8::float8 + 5::float8 + 1.2::float8);
  end if;
  return least(arrivals, seat_rate, waiter_rate);
end; $$;
revoke all on function public.arena_bistro_dist(boolean[], integer, integer, integer[]),
  public.arena_bistro_near(integer[], boolean[], integer, integer, integer[], integer[]),
  public.arena_bistro_walks(uuid), public.arena_bistro_likes_week(uuid),
  public.arena_bistro_dined_today(uuid), public.arena_bistro_popularity(uuid),
  public.arena_bistro_service_rate(uuid)
  from public, anon, authenticated, service_role;

-- What the player sees: also this week's likes (for the popularity).
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
    'staff', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'char', creature, 'role', role,
        'level', level, 'dish', dish) order by id)
      from public.arena_bistro_staff where player_id = pid), '[]'::jsonb),
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

-- Friends' bistros: with their popularity.
create or replace function public.arena_bistro_friends() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  return coalesce((select jsonb_agg(x order by lower(x->>'name')) from (
    select jsonb_build_object('id', pr.id, 'name', pr.display_name, 'fighter', pr.portrait_character,
      'level', b.level, 'rating', round(b.rating::numeric, 2), 'likes', b.likes, 'served', b.served,
      'popularity', round(public.arena_bistro_popularity(pr.id)::numeric, 1),
      'servings', public.arena_bistro_servings(pr.id),
      'dined', exists (select 1 from public.arena_bistro_dines x where x.diner = me and x.owner = pr.id and x.day = d),
      'liked', exists (select 1 from public.arena_bistro_likes l where l.liker = me and l.owner = pr.id
        and l.week = date_trunc('week', d)::date)) x
    from public.arena_friendships fs
    join public.arena_profiles pr on pr.id = case when fs.a = me then fs.b else fs.a end
    join public.arena_bistros b on b.player_id = pr.id
    where (fs.a = me or fs.b = me) and not pr.suspended
    limit 100) y), '[]'::jsonb);
end; $$;
revoke all on function public.arena_bistro_friends() from public, anon;
grant execute on function public.arena_bistro_friends() to authenticated;

commit;

select
  to_regprocedure('public.arena_bistro_popularity(uuid)') is not null as bistro_popularity_enabled,
  to_regprocedure('public.arena_bistro_walks(uuid)') is not null as bistro_walks_enabled;

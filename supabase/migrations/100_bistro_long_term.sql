-- Element Bistro, part 5: the long game. Run after 074_bistro_dishes.sql
-- (it does not need 071 or 072). Safe to run again.
--
-- Rules match packages/shared/src/bistro.ts (tests/integration/bistro.test.ts
-- checks the two agree); see docs/bistro-gdd.md §9.
--
--  * Balance: while you are away guests come at half the pace for two
--    hours, then 40%, and from four hours 30%.
--  * More to reach for up to level 30: six dishes opening at levels 10 to
--    26, two more expansions (level 16 and 20, up to 21 × 14), staff up to
--    level 10.
--  * Catering orders (two slots, three from level 10, four from 20): a
--    dish or two in quantity, paid 1.6 times their price, gone after six
--    hours; a new one 15 minutes after you fill one, 30 after you skip it.
--  * Regulars: five guests with a three-visit story (a dish in quantity
--    each time); the last visit gives a Golden Plate and 1,000 coins.
--  * Events through the year (Harvest Moon, Lantern Festival): orders and
--    regulars give tokens, spent on the event's decor (a full set adds
--    charm); tokens reset when the next event starts.
--  * A weekly league among friends: points for guests (1), orders (10),
--    regulars (15) and meals at friends' (3); claim last week's place.
--  * Branches: from level 30, start over with a star (+10% on every price,
--    up to five), keeping dish levels, the pantry, styles and regulars.
begin;

alter table public.arena_bistro_items drop constraint if exists arena_bistro_items_x_check;
alter table public.arena_bistro_items drop constraint if exists arena_bistro_items_y_check;
alter table public.arena_bistro_items add constraint arena_bistro_items_x_check check (x between 0 and 20);
alter table public.arena_bistro_items add constraint arena_bistro_items_y_check check (y between 0 and 13);
alter table public.arena_bistros drop constraint if exists arena_bistros_size_lv_check;
alter table public.arena_bistros add constraint arena_bistros_size_lv_check check (size_lv between 0 and 5);
alter table public.arena_bistro_staff drop constraint if exists arena_bistro_staff_level_check;
alter table public.arena_bistro_staff add constraint arena_bistro_staff_level_check check (level between 1 and 10);
alter table public.arena_bistros add column if not exists stars integer not null default 0 check (stars between 0 and 5);
alter table public.arena_bistros add column if not exists tokens integer not null default 0 check (tokens >= 0);
alter table public.arena_bistros add column if not exists token_event text;
alter table public.arena_bistro_kinds add column if not exists event text;
alter table public.arena_bistro_kinds add column if not exists tokens integer;
alter table public.arena_bistro_kinds add column if not exists gift boolean not null default false;

insert into public.arena_bistro_dishes(id, ord, name, level, seconds, cost, servings, price, xp) values
  ('banhxeo', 9, 'Sizzling Crepe', 10, 240, 180, 18, 20, 38),
  ('miquang', 10, 'Turmeric Noodles', 13, 480, 260, 20, 26, 52),
  ('chaca', 11, 'Dill Fish Grill', 16, 720, 400, 22, 36, 70),
  ('flan', 12, 'Caramel Flan', 19, 360, 300, 24, 28, 60),
  ('banhcanh', 13, 'Crab Noodle Soup', 22, 900, 600, 24, 50, 95),
  ('phoenix', 14, 'Phoenix Feast', 26, 1200, 900, 26, 70, 130)
on conflict (id) do update set ord = excluded.ord, name = excluded.name, level = excluded.level,
  seconds = excluded.seconds, cost = excluded.cost, servings = excluded.servings,
  price = excluded.price, xp = excluded.xp;
insert into public.arena_bistro_kinds(kind, name, price, level, charm, floor, event, tokens, gift) values
  ('pumpkin', 'Pumpkin Lantern', 1, 1, 4, false, 'harvest', 30, false),
  ('haybale', 'Hay Bale', 1, 1, 3, false, 'harvest', 20, false),
  ('lantern', 'Red Lantern Stand', 1, 1, 4, false, 'lantern', 30, false),
  ('blossom', 'Plum Blossom', 1, 1, 5, false, 'lantern', 40, false),
  ('trophy', 'Golden Plate', 1, 1, 6, false, null, null, true)
on conflict (kind) do update set name = excluded.name, price = excluded.price, level = excluded.level,
  charm = excluded.charm, floor = excluded.floor, event = excluded.event, tokens = excluded.tokens, gift = excluded.gift;

create table if not exists public.arena_bistro_orders (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  slot integer not null check (slot between 0 and 3),
  dishes jsonb,
  coins integer not null default 0,
  xp integer not null default 0,
  tokens integer not null default 0,
  expires_at timestamptz,
  next_at timestamptz,
  primary key (player_id, slot)
);
create table if not exists public.arena_bistro_regulars (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  rid text not null,
  step integer not null default 0 check (step between 0 and 3),
  primary key (player_id, rid)
);
create table if not exists public.arena_bistro_week (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null,
  points integer not null default 0,
  primary key (player_id, week)
);
create table if not exists public.arena_bistro_league_claims (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  week date not null,
  primary key (player_id, week)
);
-- The regulars' stories (REGULARS in the shared rules).
create table if not exists public.arena_bistro_regular_steps (
  rid text not null,
  level integer not null,
  name text not null,
  step integer not null,
  dish text not null references public.arena_bistro_dishes(id),
  qty integer not null,
  primary key (rid, step)
);
insert into public.arena_bistro_regular_steps(rid, level, name, step, dish, qty) values
    ('mira', 3, 'Mira', 0, 'goicuon', 6),
    ('mira', 3, 'Mira', 1, 'pho', 8),
    ('mira', 3, 'Mira', 2, 'buncha', 10),
    ('tobi', 6, 'Tobi', 0, 'banhmi', 10),
    ('tobi', 6, 'Tobi', 1, 'comtam', 10),
    ('tobi', 6, 'Tobi', 2, 'caphe', 12),
    ('juno', 10, 'Juno', 0, 'che', 12),
    ('juno', 10, 'Juno', 1, 'banhxeo', 12),
    ('juno', 10, 'Juno', 2, 'lau', 10),
    ('rook', 15, 'Rook', 0, 'miquang', 14),
    ('rook', 15, 'Rook', 1, 'chaca', 12),
    ('rook', 15, 'Rook', 2, 'banhcanh', 14),
    ('sage', 20, 'Sage', 0, 'flan', 14),
    ('sage', 20, 'Sage', 1, 'banhcanh', 14),
    ('sage', 20, 'Sage', 2, 'phoenix', 12)
on conflict (rid, step) do update set level = excluded.level, name = excluded.name, dish = excluded.dish, qty = excluded.qty;
alter table public.arena_bistro_orders enable row level security;
alter table public.arena_bistro_regulars enable row level security;
alter table public.arena_bistro_week enable row level security;
alter table public.arena_bistro_league_claims enable row level security;
alter table public.arena_bistro_regular_steps enable row level security;

-- ───────────── helpers ─────────────

-- A plate's price at a dish level and with branch stars (whole numbers until the end).
create or replace function public.arena_bistro_price_at(p_price integer, p_lv integer, p_stars integer) returns integer
language sql immutable set search_path = '' as $$
  select round((p_price * (100 + 12 * (p_lv - 1)) * (10 + p_stars))::numeric / 1000)::integer
$$;
create or replace function public.arena_bistro_price_at(p_price integer, p_lv integer) returns integer
language sql immutable set search_path = public as $$ select public.arena_bistro_price_at(p_price, p_lv, 0) $$;
create or replace function public.arena_bistro_stars(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select stars from public.arena_bistros where player_id = pid), 0)
$$;
-- How many of the guests come while you are away, by how long it's been.
create or replace function public.arena_bistro_away_rate(ms double precision) returns double precision
language sql immutable set search_path = '' as $$
  select case when ms < 7200000 then 0.5::float8 when ms < 14400000 then 0.4::float8 else 0.3::float8 end
$$;
-- The event on a (Pacific) day, or null.
create or replace function public.arena_bistro_event(d date) returns text
language sql immutable set search_path = '' as $$
  select case when to_char(d, 'MM-DD') between '09-15' and '11-30' then 'harvest'
    when to_char(d, 'MM-DD') >= '12-15' or to_char(d, 'MM-DD') <= '02-28' then 'lantern' end
$$;
-- This week's league points (the week starts Monday, Pacific).
create or replace function public.arena_bistro_points(pid uuid, n integer) returns void
language sql security definer set search_path = public as $$
  insert into public.arena_bistro_week(player_id, week, points)
  select pid, date_trunc('week', public.arena_today())::date, n where n > 0
  on conflict (player_id, week) do update set points = public.arena_bistro_week.points + n
$$;
-- Tokens belong to an event: a new one starts them from nothing.
create or replace function public.arena_bistro_tokens_sync(pid uuid) returns void
language sql security definer set search_path = public as $$
  update public.arena_bistros set tokens = 0, token_event = public.arena_bistro_event(public.arena_today())
   where player_id = pid and token_event is distinct from public.arena_bistro_event(public.arena_today())
$$;
-- Servings of a dish on the counter.
create or replace function public.arena_bistro_on_counter(pid uuid, p_dish text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum(servings), 0)::integer from public.arena_bistro_counter where player_id = pid and dish = p_dish
$$;
-- Catering orders: post new ones where a slot is free, let old ones go.
create or replace function public.arena_bistro_orders_refresh(pid uuid, t timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare b public.arena_bistros; n integer; i integer; o public.arena_bistro_orders; k integer;
  picks text[]; d text; q integer; arr jsonb; v_coins numeric; v_xp integer;
begin
  select * into b from public.arena_bistros where player_id = pid;
  n = 2 + case when b.level >= 10 then 1 else 0 end + case when b.level >= 20 then 1 else 0 end;
  delete from public.arena_bistro_orders where player_id = pid and slot >= n;
  for i in 0..n - 1 loop
    insert into public.arena_bistro_orders(player_id, slot, next_at) values (pid, i, t) on conflict do nothing;
    select * into o from public.arena_bistro_orders where player_id = pid and slot = i;
    if o.dishes is not null and o.expires_at <= t then
      update public.arena_bistro_orders set dishes = null, next_at = t where player_id = pid and slot = i;
      o.dishes = null; o.next_at = t;
    end if;
    if o.dishes is null and o.next_at <= t then
      k = case when b.level >= 4 and random() < 0.4 then 2 else 1 end;
      select array_agg(id) into picks from (select id from public.arena_bistro_dishes
        where level <= b.level order by random() limit k) x;
      arr = '[]'::jsonb; v_coins = 0; v_xp = 0;
      foreach d in array picks loop
        q = 4 + floor(random() * (4 + b.level / 2))::integer;
        arr = arr || jsonb_build_array(jsonb_build_object('dish', d, 'qty', q));
        v_coins = v_coins + q * public.arena_bistro_price_at((select price from public.arena_bistro_dishes where id = d),
          public.arena_bistro_lv(pid, d), b.stars);
        v_xp = v_xp + q * 2;
      end loop;
      update public.arena_bistro_orders set dishes = arr, coins = round(v_coins * 1.6)::integer, xp = v_xp,
        tokens = case when public.arena_bistro_event(public.arena_today()) is not null then 5 else 0 end,
        expires_at = t + interval '6 hours', next_at = null
       where player_id = pid and slot = i;
    end if;
  end loop;
end; $$;
revoke all on function public.arena_bistro_price_at(integer, integer, integer), public.arena_bistro_price_at(integer, integer),
  public.arena_bistro_stars(uuid), public.arena_bistro_away_rate(double precision), public.arena_bistro_event(date),
  public.arena_bistro_points(uuid, integer), public.arena_bistro_tokens_sync(uuid),
  public.arena_bistro_on_counter(uuid, text), public.arena_bistro_orders_refresh(uuid, timestamptz)
  from public, anon, authenticated, service_role;

-- 0..50 (see 074): a full event set adds 6 charm.
create or replace function public.arena_bistro_popularity(pid uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select least(50::float8, greatest(0::float8,
    b.rating * 6
    + least(10::float8, (coalesce((select sum(k.charm) from public.arena_bistro_items i
        join public.arena_bistro_kinds k on k.kind = i.kind where i.player_id = pid), 0)
      + 6 * ((case when exists (select 1 from public.arena_bistro_items where player_id = pid and kind = 'pumpkin')
               and exists (select 1 from public.arena_bistro_items where player_id = pid and kind = 'haybale') then 1 else 0 end)
           + (case when exists (select 1 from public.arena_bistro_items where player_id = pid and kind = 'lantern')
               and exists (select 1 from public.arena_bistro_items where player_id = pid and kind = 'blossom') then 1 else 0 end))
      )::float8 / 3)
    + least(6::float8, public.arena_bistro_gourmet(pid)::float8 / 40::float8)
    + least(4::float8, 0.5::float8 * public.arena_bistro_likes_week(pid)::float8
        + 0.5::float8 * public.arena_bistro_dined_today(pid)::float8)
    - least(8::float8, b.trash::float8)))
  from public.arena_bistros b where b.player_id = pid
$$;
revoke all on function public.arena_bistro_popularity(uuid) from public, anon, authenticated, service_role;
-- Bring the bistro up to time t (see 074): fewer guests the longer you're away, stars on prices, league points.
create or replace function public.arena_bistro_catch_up(pid uuid, t timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare b public.arena_bistros; v_from timestamptz; v_end timestamptz; tt timestamptz; ev jsonb;
  rate double precision; acc double precision = 0; v_slot integer; v_dish text; v_price integer;
  v_special text; bill integer; v_served integer = 0; v_coins integer = 0; v_spent integer = 0; v_batches integer = 0;
  lv integer = 0; away boolean; cap interval;
  p record; corners integer; secs double precision; ms double precision; served_now integer;
  v_trash integer; dirt double precision = 0; sweep double precision = 0; jr double precision;
begin
  perform public.arena_bistro_tokens_sync(pid);
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
      acc = acc + rate * public.arena_bistro_away_rate(ms) * secs;
      served_now = 0;
      while acc >= 1 loop
        select slot, dish into v_slot, v_dish from public.arena_bistro_counter
         where player_id = pid and dish is not null and servings > 0 order by servings desc, slot limit 1;
        if v_slot is null then acc = least(acc, 1); exit; end if;
        perform public.arena_bistro_take(pid, v_dish);
        select public.arena_bistro_price_at(price, public.arena_bistro_lv(pid, v_dish), b.stars) into v_price
          from public.arena_bistro_dishes where id = v_dish;
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
  perform public.arena_bistro_points(pid, v_served);
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
-- What the player sees (see 074): also stars, tokens, the event, regulars, orders and the league.
create or replace function public.arena_bistro_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare b public.arena_bistros; t timestamptz = now(); d date = public.arena_today();
  wk date = date_trunc('week', public.arena_today())::date; lw date = (date_trunc('week', public.arena_today()) - interval '7 days')::date;
  my_last integer;
begin
  select * into b from public.arena_bistros where player_id = pid;
  my_last = coalesce((select points from public.arena_bistro_week where player_id = pid and week = lw), 0);
  return jsonb_build_object(
    'v', 1,
    'now', (extract(epoch from t) * 1000)::bigint,
    'coins', b.coins, 'xp', b.xp, 'level', b.level,
    'rating', round(b.rating::numeric, 3), 'served', b.served,
    'floor', b.floor, 'wall', b.wall, 'floors', to_jsonb(b.floors), 'walls', to_jsonb(b.walls),
    'kitchenLv', b.kitchen_lv, 'shiftLv', b.shift_lv, 'sizeLv', b.size_lv, 'chef', b.chef, 'likes', b.likes,
    'likesWeek', public.arena_bistro_likes_week(pid),
    'trash', b.trash,
    'stars', b.stars, 'tokens', b.tokens,
    'event', public.arena_bistro_event(d),
    'regulars', coalesce((select jsonb_object_agg(rid, step) from public.arena_bistro_regulars where player_id = pid), '{}'::jsonb),
    'orders', coalesce((select jsonb_agg(jsonb_build_object('slot', slot, 'dishes', dishes, 'coins', coins, 'xp', xp,
        'tokens', tokens, 'expires', coalesce((extract(epoch from expires_at) * 1000)::bigint, 0),
        'next', coalesce((extract(epoch from next_at) * 1000)::bigint, 0)) order by slot)
      from public.arena_bistro_orders where player_id = pid), '[]'::jsonb),
    'league', jsonb_build_object(
      'week', coalesce((select jsonb_agg(jsonb_build_object('name', p.display_name, 'fighter', p.portrait_character,
          'points', coalesce(w.points, 0), 'me', p.id = pid) order by coalesce(w.points, 0) desc, lower(p.display_name))
        from public.arena_profiles p
        left join public.arena_bistro_week w on w.player_id = p.id and w.week = wk
        where p.id = pid or (public.arena_farm_are_friends(pid, p.id) and exists (select 1 from public.arena_bistros x where x.player_id = p.id))),
        '[]'::jsonb),
      'last', case when my_last > 0 then jsonb_build_object('points', my_last,
          'rank', 1 + (select count(*) from public.arena_bistro_week w2 where w2.week = lw and w2.points > my_last
            and public.arena_farm_are_friends(pid, w2.player_id)),
          'claimed', exists (select 1 from public.arena_bistro_league_claims c where c.player_id = pid and c.week = lw))
        end),
    'dishLv', coalesce((select jsonb_object_agg(dish, jsonb_build_object('lv', lv, 'mastery', mastery))
      from public.arena_bistro_dish_lv where player_id = pid), '{}'::jsonb),
    'pantry', coalesce((select jsonb_object_agg(ingredient, qty) from public.arena_bistro_pantry
      where player_id = pid and qty > 0), '{}'::jsonb),
    'marketBought', coalesce((select jsonb_object_agg(ingredient, qty) from public.arena_bistro_market
      where player_id = pid and day = d), '{}'::jsonb),
    'farmSent', coalesce((select qty from public.arena_bistro_farm_sent where player_id = pid and day = d), 0),
    'farmCrops', coalesce((select jsonb_object_agg(crop, qty) from public.arena_farm_barn
      where player_id = pid and mutation = '' and qty > 0
        and crop in ('wheat', 'mint', 'pepper', 'lotus', 'milk')), '{}'::jsonb),
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
-- A friend's bistro as a visitor sees it (see 074): not their orders or league either.
create or replace function public.arena_bistro_view(me uuid, pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select (public.arena_bistro_state(pid) - 'coins' - 'leaves' - 'tradedToday' - 'stored' - 'dinesToday' - 'lastSeen'
    - 'pantry' - 'marketBought' - 'farmSent' - 'farmCrops' - 'tokens' - 'orders' - 'league' - 'regulars')
    || jsonb_build_object(
      'id', pid,
      'name', pr.display_name,
      'fighter', pr.portrait_character,
      'dined', exists (select 1 from public.arena_bistro_dines x where x.diner = me and x.owner = pid
        and x.day = public.arena_today()),
      'liked', exists (select 1 from public.arena_bistro_likes l where l.liker = me and l.owner = pid
        and l.week = date_trunc('week', public.arena_today())::date),
      'myDines', (select count(*) from public.arena_bistro_dines x where x.diner = me and x.day = public.arena_today()))
  from public.arena_profiles pr where pr.id = pid
$$;
revoke all on function public.arena_bistro_view(uuid, uuid) from public, anon, authenticated, service_role;
-- Open the bistro (see 073): post catering orders too.
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
  perform public.arena_bistro_orders_refresh(me, now());
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
-- Actions (see 074); also order {slot}, skip {slot}, regular {id}, league, branch; event items for tokens.
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
  v_rec text[]; v_spice integer; v_have integer; v_ing text;
  v_order public.arena_bistro_orders; v_od jsonb; v_reg record; v_step integer; v_ev text; v_last integer; lw date;
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
  perform public.arena_bistro_orders_refresh(me, t);
  v_ev = public.arena_bistro_event(d);
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
          v_bill = public.arena_bistro_pay(public.arena_bistro_price_at(v_dish.price, public.arena_bistro_lv(me, v_dish.id), b.stars),
            v_dish.id = public.arena_bistro_special(b.level, d), v_vip,
            coalesce((a->>'combo')::integer, 1), v_hearts, coalesce((a->>'quick')::boolean, false),
            public.arena_bistro_rush(t));
          update public.arena_bistros set coins = coins + v_bill, served = served + 1,
            sale_budget = sale_budget - 1,
            vip_budget = least(3, vip_budget + 0.15) - case when v_vip then 1 else 0 end,
            rating = least(5, greatest(0, rating + ((case v_hearts when 3 then 5 when 2 then 4 else 2.5 end) - rating) * 0.08))
           where player_id = me;
          v_lv = public.arena_bistro_add_xp(me, case when v_vip then 3 else 1 end);
          perform public.arena_bistro_points(me, 1);
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
      elsif k.gift then err = 'That one is a gift from a regular.';
      elsif k.level > b.level then err = 'Opens at level ' || k.level || '.';
      elsif k.event is not null and k.event is distinct from v_ev then err = 'Only during its event.';
      elsif k.event is not null and b.tokens < k.tokens then err = 'You need ' || k.tokens || ' tokens.';
      elsif k.event is not null then
        update public.arena_bistros set tokens = tokens - k.tokens where player_id = me;
        insert into public.arena_bistro_stored(player_id, kind, qty) values (me, k.kind, 1)
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
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
      v_lv = (array[4, 8, 12, 16, 20])[b.size_lv + 1];
      v_price = (array[800, 2500, 6000, 12000, 20000])[b.size_lv + 1];
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
    elsif v_kind = 'dishup' then
      select * into v_dish from public.arena_bistro_dishes where id = a->>'dish';
      select l.lv, l.mastery into v_lv, n from public.arena_bistro_dish_lv l where l.player_id = me and l.dish = v_dish.id;
      v_lv = coalesce(v_lv, 1); n = coalesce(n, 0);
      v_rec = public.arena_bistro_recipe(v_dish.id);
      v_spice = (array[0, 0, 0, 0, 1, 1, 2, 2, 3])[v_lv];
      v_cost = v_dish.cost * (array[2, 5, 10, 16, 22, 30, 40, 50, 60])[v_lv];
      if v_dish.id is null then err = 'Unknown dish.';
      elsif v_dish.level > b.level then err = 'Opens at level ' || v_dish.level || '.';
      elsif v_lv >= 10 then err = v_dish.name || ' is at the top level.';
      elsif n < 5 * v_lv then err = 'Cook ' || (5 * v_lv - n) || ' more batches of ' || v_dish.name || ' first.';
      elsif public.arena_bistro_pantry_qty(me, v_rec[1]) < v_lv then
        err = 'You need ' || v_lv || ' ' || public.arena_bistro_ingredient_name(v_rec[1]) || '.';
      elsif public.arena_bistro_pantry_qty(me, v_rec[2]) < v_lv then
        err = 'You need ' || v_lv || ' ' || public.arena_bistro_ingredient_name(v_rec[2]) || '.';
      elsif public.arena_bistro_pantry_qty(me, 'spice') < v_spice then err = 'You need ' || v_spice || ' Spice.';
      elsif b.coins < v_cost then err = 'You need ' || v_cost || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_cost where player_id = me;
        update public.arena_bistro_pantry set qty = qty - v_lv where player_id = me and ingredient in (v_rec[1], v_rec[2]);
        update public.arena_bistro_pantry set qty = qty - v_spice where player_id = me and ingredient = 'spice' and v_spice > 0;
        insert into public.arena_bistro_dish_lv(player_id, dish, lv, mastery) values (me, v_dish.id, v_lv + 1, 0)
        on conflict (player_id, dish) do update set lv = v_lv + 1, mastery = 0;
      end if;
    elsif v_kind = 'market' then
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else null end;
      v_ing = a->>'id';
      v_price = public.arena_bistro_market_price(t, v_ing);
      v_count = coalesce((select qty from public.arena_bistro_market where player_id = me and day = d and ingredient = v_ing), 0);
      if v_price is null then err = 'That''s not at the Market right now.';
      elsif n is null or n < 1 or n > 5 then err = 'Choose how many to buy.';
      elsif v_count + n > 5 then err = 'At most 5 ' || public.arena_bistro_ingredient_name(v_ing) || ' a day.';
      elsif public.arena_bistro_pantry_qty(me, v_ing) + n > 99 then err = 'Your pantry can''t hold more of that.';
      elsif b.coins < v_price * n then err = 'You need ' || v_price * n || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price * n where player_id = me;
        perform public.arena_bistro_add_ingredient(me, v_ing, n);
        insert into public.arena_bistro_market(player_id, day, ingredient, qty) values (me, d, v_ing, n)
        on conflict (player_id, day, ingredient) do update set qty = public.arena_bistro_market.qty + n;
      end if;
    elsif v_kind = 'farm' then
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else null end;
      v_char = a->>'id';
      v_ing = case v_char when 'wheat' then 'flour' when 'mint' then 'herbs' when 'pepper' then 'chili'
        when 'lotus' then 'beans' when 'milk' then 'milk' end;
      v_count = coalesce((select qty from public.arena_bistro_farm_sent where player_id = me and day = d), 0);
      v_have = coalesce((select qty from public.arena_farm_barn where player_id = me and crop = v_char and mutation = ''), 0);
      if v_ing is null then err = 'That doesn''t go in the bistro.';
      elsif n is null or n < 1 or n > 30 then err = 'Choose how many to bring.';
      elsif v_count + n > 30 then err = 'At most 30 ingredients a day from the Farm.';
      elsif v_have < n * 3 then err = 'You need ' || n * 3 || ' in the Farm''s barn.';
      elsif public.arena_bistro_pantry_qty(me, v_ing) + n > 99 then err = 'Your pantry can''t hold more of that.';
      else
        update public.arena_farm_barn set qty = qty - n * 3 where player_id = me and crop = v_char and mutation = '';
        perform public.arena_bistro_add_ingredient(me, v_ing, n);
        insert into public.arena_bistro_farm_sent(player_id, day, qty) values (me, d, n)
        on conflict (player_id, day) do update set qty = public.arena_bistro_farm_sent.qty + n;
      end if;
    elsif v_kind in ('order', 'skip') then
      select * into v_order from public.arena_bistro_orders where player_id = me
        and slot = case when jsonb_typeof(a->'slot') = 'number' then (a->>'slot')::integer end;
      if v_order.dishes is null then err = 'No order there yet.';
      elsif v_kind = 'skip' then
        update public.arena_bistro_orders set dishes = null, next_at = t + interval '30 minutes'
         where player_id = me and slot = v_order.slot;
      else
        for v_od in select * from jsonb_array_elements(v_order.dishes) loop
          if err is null and public.arena_bistro_on_counter(me, v_od->>'dish') < (v_od->>'qty')::integer then
            err = 'You need ' || (v_od->>'qty') || ' ' || (select name from public.arena_bistro_dishes where id = v_od->>'dish') || ' on the counter.';
          end if;
        end loop;
        if err is null then
          for v_od in select * from jsonb_array_elements(v_order.dishes) loop
            for n in 1..(v_od->>'qty')::integer loop perform public.arena_bistro_take(me, v_od->>'dish'); end loop;
          end loop;
          update public.arena_bistros set coins = coins + v_order.coins, tokens = tokens + v_order.tokens where player_id = me;
          perform public.arena_bistro_add_xp(me, v_order.xp);
          perform public.arena_bistro_points(me, 10);
          update public.arena_bistro_orders set dishes = null, next_at = t + interval '15 minutes'
           where player_id = me and slot = v_order.slot;
        end if;
      end if;
    elsif v_kind = 'regular' then
      v_step = coalesce((select step from public.arena_bistro_regulars where player_id = me and rid = a->>'id'), 0);
      select r.*, dd.name dname, dd.level dlevel, dd.price dprice,
        (select count(*) from public.arena_bistro_regular_steps r2 where r2.rid = r.rid) nsteps
        into v_reg from public.arena_bistro_regular_steps r join public.arena_bistro_dishes dd on dd.id = r.dish
       where r.rid = a->>'id' and r.step = least(v_step, 2);
      if v_reg.rid is null then err = 'Nobody by that name.';
      elsif b.level < v_reg.level then err = v_reg.name || ' comes by at level ' || v_reg.level || '.';
      elsif v_step >= v_reg.nsteps then err = v_reg.name || '''s story is complete.';
      elsif v_reg.dlevel > b.level then err = v_reg.dname || ' opens at level ' || v_reg.dlevel || '.';
      elsif public.arena_bistro_on_counter(me, v_reg.dish) < v_reg.qty then
        err = 'You need ' || v_reg.qty || ' ' || v_reg.dname || ' on the counter.';
      else
        for n in 1..v_reg.qty loop perform public.arena_bistro_take(me, v_reg.dish); end loop;
        update public.arena_bistros set coins = coins + v_reg.qty * v_reg.dprice * 3
            + case when v_step = v_reg.nsteps - 1 then 1000 else 0 end,
          tokens = tokens + case when v_ev is not null then 3 else 0 end
         where player_id = me;
        perform public.arena_bistro_add_xp(me, v_reg.qty * 3);
        if v_step = v_reg.nsteps - 1 then
          insert into public.arena_bistro_stored(player_id, kind, qty) values (me, 'trophy', 1)
          on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + 1;
        end if;
        insert into public.arena_bistro_regulars(player_id, rid, step) values (me, v_reg.rid, v_step + 1)
        on conflict (player_id, rid) do update set step = v_step + 1;
        perform public.arena_bistro_points(me, 15);
      end if;
    elsif v_kind = 'league' then
      lw = (date_trunc('week', d) - interval '7 days')::date;
      v_last = coalesce((select points from public.arena_bistro_week where player_id = me and week = lw), 0);
      n = 1 + (select count(*) from public.arena_bistro_week w2 where w2.week = lw and w2.points > v_last
        and public.arena_farm_are_friends(me, w2.player_id));
      if v_last < 50 or exists (select 1 from public.arena_bistro_league_claims where player_id = me and week = lw) then
        err = 'Nothing to claim.';
      else
        insert into public.arena_bistro_league_claims(player_id, week) values (me, lw);
        update public.arena_bistros set coins = coins + case n when 1 then 2000 when 2 then 1200 when 3 then 800 else 300 end
         where player_id = me;
        perform public.arena_bistro_add_ingredient(me, 'spice', case n when 1 then 5 when 2 then 3 when 3 then 2 else 1 end);
      end if;
    elsif v_kind = 'branch' then
      if b.level < 30 then err = 'Open a new branch at level 30.';
      elsif b.stars >= 5 then err = 'Five stars: the most there are.';
      else
        -- Start over: the furniture goes into storage, the first room comes back.
        insert into public.arena_bistro_stored(player_id, kind, qty)
        select me, kind, count(*) from public.arena_bistro_items where player_id = me group by kind
        on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + excluded.qty;
        delete from public.arena_bistro_items where player_id = me;
        insert into public.arena_bistro_items(player_id, id, kind, x, y, rot) values
          (me, 1, 'rug', 3, 5, 0), (me, 2, 'table', 4, 5, 0), (me, 3, 'chair', 3, 5, 1),
          (me, 4, 'chair', 5, 5, 3), (me, 5, 'table', 8, 4, 0), (me, 6, 'chair', 8, 3, 2),
          (me, 7, 'chair', 8, 5, 0), (me, 8, 'table', 8, 7, 0), (me, 9, 'chair', 7, 7, 1),
          (me, 10, 'chair', 9, 7, 3), (me, 11, 'plant', 10, 0, 0), (me, 12, 'plant', 0, 8, 0),
          (me, 13, 'plant', 6, 0, 0);
        delete from public.arena_bistro_stoves where player_id = me;
        insert into public.arena_bistro_stoves(player_id, idx) values (me, 0), (me, 1);
        update public.arena_bistro_counter set dish = case slot when 0 then 'goicuon' end,
          servings = case slot when 0 then 6 else 0 end, perfect = false where player_id = me;
        delete from public.arena_bistro_staff where player_id = me;
        insert into public.arena_bistro_staff(player_id, id, creature, role) values (me, 1, 'sunbara', 'waiter');
        delete from public.arena_bistro_orders where player_id = me;
        update public.arena_bistros set level = 1, xp = 0, coins = 500, rating = 3, kitchen_lv = 0, shift_lv = 0,
          size_lv = 0, trash = 0, stars = stars + 1 where player_id = me;
      end if;
    elsif v_kind = 'train' then
      select * into v_staff from public.arena_bistro_staff where player_id = me
        and id = case when jsonb_typeof(a->'id') = 'number' then (a->>'id')::integer end;
      if v_staff.id is null then err = 'Not on your team.';
      elsif v_staff.level >= 10 then err = 'Already at the top level.';
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
-- Eat at a friend's (see 074): their stars count; 3 league points.
create or replace function public.arena_bistro_friend_act(p_request uuid, p_friend uuid, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); inserted integer; v_slot integer; v_dish text;
  v_price integer; v_pay integer; gained jsonb = '{}'::jsonb; err text; v_ing text;
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
        select public.arena_bistro_price_at(price, public.arena_bistro_lv(p_friend, v_dish), public.arena_bistro_stars(p_friend)) into v_price
          from public.arena_bistro_dishes where id = v_dish;
        v_pay = v_price + round(v_price * 0.5)::integer;
        update public.arena_bistros set coins = coins + v_pay, served = served + 1 where player_id = p_friend;
        perform public.arena_bistro_add_xp(p_friend, 2);
        update public.arena_bistros set coins = coins + 10 where player_id = me;
        perform public.arena_bistro_add_xp(me, 5);
        insert into public.arena_bistro_dines(diner, owner, day, dish) values (me, p_friend, d, v_dish);
        -- Working there? Your meal fills your energy.
        update public.arena_bistro_staff set energy = public.arena_bistro_energy_max(level)
         where player_id = p_friend and friend_id = me;
        -- An ingredient to take home: one of the dish's, or Spice one time in ten.
        v_ing = case when random() < 0.1 then 'spice'
          else (public.arena_bistro_recipe(v_dish))[1 + floor(random() * 2)::integer] end;
        perform public.arena_bistro_add_ingredient(me, v_ing, 1);
        perform public.arena_bistro_points(me, 3);
        gained = jsonb_build_object('dish', v_dish, 'paid', v_pay, 'coins', 10, 'xp', 5, 'ingredient', v_ing);
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
  to_regprocedure('public.arena_bistro_orders_refresh(uuid,timestamptz)') is not null as bistro_orders_enabled,
  (select count(*) from public.arena_bistro_dishes) = 14 as bistro_dishes_seeded;

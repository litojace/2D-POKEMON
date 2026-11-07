-- Element Bistro, part 4: dish levels, ingredients, the Market and the
-- Farm's crops in the kitchen. Run after 073_bistro_staff.sql. Safe to run
-- again.
--
-- Rules match packages/shared/src/bistro.ts (tests/integration/bistro.test.ts
-- checks the two agree); see docs/bistro-gdd.md §2.
--
--  * Each dish has a level, 1 to 10. A batch put on the counter is a point
--    of mastery (a perfect one two); a level-up from L takes 5 × L mastery,
--    L of each of the dish's two ingredients, Spice from level 5 and coins
--    (the dish's cost × 2, 5, 10, 16, 22, 30, 40, 50, 60). Each level raises
--    the price 12% and every third adds a serving.
--  * Gourmet points (each level above 1 × the level the dish opens at) add
--    up to 6 points of popularity (one for every 40).
--  * Ingredients (up to 99 of each): the Market sells four every four hours
--    (the same for everyone; 20 to 60 coins, 5 of each a Pacific day); three
--    plain crops from the Farm's barn make one (wheat → flour, mint → herbs,
--    pepper → chili, lotus → beans, Storm Milk → milk; 30 a day, never
--    back); a meal at a friend's bistro gives one of the dish's (or Spice,
--    one time in ten); each bistro level gives three.
begin;

create table if not exists public.arena_bistro_dish_lv (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  dish text not null references public.arena_bistro_dishes(id),
  lv integer not null default 1 check (lv between 1 and 10),
  mastery integer not null default 0 check (mastery >= 0),
  primary key (player_id, dish)
);
create table if not exists public.arena_bistro_pantry (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  ingredient text not null check (ingredient in ('rice', 'flour', 'herbs', 'pork', 'egg', 'beans',
    'coconut', 'coffee', 'milk', 'chili', 'spice')),
  qty integer not null default 0 check (qty between 0 and 99),
  primary key (player_id, ingredient)
);
create table if not exists public.arena_bistro_market (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  ingredient text not null,
  qty integer not null default 0,
  primary key (player_id, day, ingredient)
);
create table if not exists public.arena_bistro_farm_sent (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  qty integer not null default 0,
  primary key (player_id, day)
);
alter table public.arena_bistro_dish_lv enable row level security;
alter table public.arena_bistro_pantry enable row level security;
alter table public.arena_bistro_market enable row level security;
alter table public.arena_bistro_farm_sent enable row level security;

-- ───────────── catalog and helpers ─────────────

create or replace function public.arena_bistro_recipe(p_dish text) returns text[]
language sql immutable set search_path = '' as $$
  select case p_dish when 'goicuon' then array['rice', 'herbs'] when 'banhmi' then array['flour', 'pork']
    when 'pho' then array['flour', 'herbs'] when 'buncha' then array['flour', 'pork']
    when 'comtam' then array['rice', 'egg'] when 'che' then array['beans', 'coconut']
    when 'caphe' then array['coffee', 'milk'] when 'lau' then array['chili', 'beans'] end
$$;
create or replace function public.arena_bistro_ingredient_name(p_id text) returns text
language sql immutable set search_path = '' as $$
  select case p_id when 'rice' then 'Rice' when 'flour' then 'Flour' when 'herbs' then 'Herbs' when 'pork' then 'Pork'
    when 'egg' then 'Eggs' when 'beans' then 'Beans' when 'coconut' then 'Coconut' when 'coffee' then 'Coffee'
    when 'milk' then 'Milk' when 'chili' then 'Chili' when 'spice' then 'Spice' end
$$;
create or replace function public.arena_bistro_lv(pid uuid, p_dish text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select lv from public.arena_bistro_dish_lv where player_id = pid and dish = p_dish), 1)
$$;
create or replace function public.arena_bistro_price_at(p_price integer, p_lv integer) returns integer
language sql immutable set search_path = '' as $$
  select round((p_price * (1 + 0.12 * (p_lv - 1)))::numeric)::integer
$$;
create or replace function public.arena_bistro_gourmet(pid uuid) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce(sum((l.lv - 1) * d.level), 0)::integer from public.arena_bistro_dish_lv l
    join public.arena_bistro_dishes d on d.id = l.dish where l.player_id = pid
$$;
create or replace function public.arena_bistro_pantry_qty(pid uuid, p_id text) returns integer
language sql stable security definer set search_path = public as $$
  select coalesce((select qty from public.arena_bistro_pantry where player_id = pid and ingredient = p_id), 0)
$$;
create or replace function public.arena_bistro_add_ingredient(pid uuid, p_id text, n integer) returns void
language sql security definer set search_path = public as $$
  insert into public.arena_bistro_pantry(player_id, ingredient, qty) values (pid, p_id, least(99, n))
  on conflict (player_id, ingredient) do update set qty = least(99, public.arena_bistro_pantry.qty + n)
$$;
-- The Market at time t: an ingredient's price, or null when it isn't sold.
create or replace function public.arena_bistro_market_price(t timestamptz, p_id text) returns integer
language plpgsql stable set search_path = '' as $$
declare slot bigint = floor(extract(epoch from t) * 1000 / 14400000)::bigint;
  base text[] = array['rice', 'flour', 'herbs', 'pork', 'egg', 'beans', 'coconut', 'coffee', 'milk', 'chili']; st integer; stp integer; j integer; i integer;
begin
  st = (slot % 10)::integer;
  stp = (array[1, 3, 7, 9])[((slot / 10) % 4)::integer + 1];
  for j in 0..3 loop
    i = (st + j * stp) % 10;
    if base[i + 1] = p_id then return 20 + ((slot * 7 + i * 13) % 41)::integer; end if;
  end loop;
  return null;
end; $$;
revoke all on function public.arena_bistro_recipe(text), public.arena_bistro_ingredient_name(text),
  public.arena_bistro_lv(uuid, text), public.arena_bistro_price_at(integer, integer), public.arena_bistro_gourmet(uuid),
  public.arena_bistro_pantry_qty(uuid, text), public.arena_bistro_add_ingredient(uuid, text, integer),
  public.arena_bistro_market_price(timestamptz, text)
  from public, anon, authenticated, service_role;

-- XP with level-ups (see 068); each level also gives three ingredients.
create or replace function public.arena_bistro_add_xp(pid uuid, amount integer) returns integer
language plpgsql security definer set search_path = public as $$
declare b public.arena_bistros; gained integer = 0;
begin
  if amount <= 0 then return 0; end if;
  select * into b from public.arena_bistros where player_id = pid;
  b.xp = b.xp + amount;
  while b.level < 30 and b.xp >= public.arena_bistro_need(b.level) loop
    b.xp = b.xp - public.arena_bistro_need(b.level);
    b.level = b.level + 1;
    b.coins = b.coins + 40 + 20 * b.level;
    -- And a few ingredients: two of one, one of the next.
    perform public.arena_bistro_add_ingredient(pid, (array['rice', 'flour', 'herbs', 'pork', 'egg', 'beans', 'coconut', 'coffee', 'milk', 'chili'])[(b.level * 3) % 10 + 1], 2);
    perform public.arena_bistro_add_ingredient(pid, (array['rice', 'flour', 'herbs', 'pork', 'egg', 'beans', 'coconut', 'coffee', 'milk', 'chili'])[(b.level * 3 + 1) % 10 + 1], 1);
    gained = gained + 1;
  end loop;
  if b.level >= 30 then b.xp = least(b.xp, public.arena_bistro_need(30)); end if;
  update public.arena_bistros set level = b.level, xp = b.xp, coins = b.coins where player_id = pid;
  return gained;
end; $$;
revoke all on function public.arena_bistro_add_xp(uuid, integer) from public, anon, authenticated, service_role;
-- Plate a dish (see 068): servings by its level, and mastery.
create or replace function public.arena_bistro_plate(pid uuid, p_idx integer, t timestamptz) returns jsonb
language plpgsql security definer set search_path = public as $$
declare st public.arena_bistro_stoves; d public.arena_bistro_dishes; v_slot integer; n integer; lv integer;
  v_dlv integer;
begin
  select * into st from public.arena_bistro_stoves where player_id = pid and idx = p_idx;
  if st.dish is null then return jsonb_build_object('error', 'Nothing cooking there.'); end if;
  if t < st.started_at + make_interval(secs => st.dur_ms / 1000.0) then
    return jsonb_build_object('error', 'Not ready yet.');
  end if;
  select * into d from public.arena_bistro_dishes where id = st.dish;
  v_dlv = public.arena_bistro_lv(pid, st.dish);
  n = d.servings + (v_dlv - 1) / 3 + case when st.perfect then 2 else 0 end;
  select slot into v_slot from public.arena_bistro_counter where player_id = pid and dish = st.dish order by slot limit 1;
  if v_slot is null then
    select slot into v_slot from public.arena_bistro_counter where player_id = pid and dish is null order by slot limit 1;
  end if;
  if v_slot is null then return jsonb_build_object('error', 'The counter is full: serve some dishes first.'); end if;
  update public.arena_bistro_counter set dish = st.dish, servings = servings + n, perfect = perfect or st.perfect
   where player_id = pid and slot = v_slot;
  update public.arena_bistro_stoves set dish = null, started_at = null, dur_ms = null, perfect = false
   where player_id = pid and idx = p_idx;
  -- Mastery toward the dish's next level.
  insert into public.arena_bistro_dish_lv(player_id, dish, lv, mastery)
  values (pid, d.id, 1, least(5, case when st.perfect then 2 else 1 end))
  on conflict (player_id, dish) do update set mastery = least(5 * public.arena_bistro_dish_lv.lv,
    public.arena_bistro_dish_lv.mastery + case when st.perfect then 2 else 1 end);
  lv = public.arena_bistro_add_xp(pid, d.xp);
  return jsonb_build_object('ok', true, 'slot', v_slot, 'servings', n, 'xp', d.xp, 'levels', lv);
end; $$;
revoke all on function public.arena_bistro_plate(uuid, integer, timestamptz) from public, anon, authenticated, service_role;
-- 0..50: gourmet points now count (up to 6).
create or replace function public.arena_bistro_popularity(pid uuid) returns double precision
language sql stable security definer set search_path = public as $$
  select least(50::float8, greatest(0::float8,
    b.rating * 6
    + least(10::float8, coalesce((select sum(k.charm) from public.arena_bistro_items i
        join public.arena_bistro_kinds k on k.kind = i.kind where i.player_id = pid), 0)::float8 / 3)
    + least(6::float8, public.arena_bistro_gourmet(pid)::float8 / 40::float8)
    + least(4::float8, 0.5::float8 * public.arena_bistro_likes_week(pid)::float8
        + 0.5::float8 * public.arena_bistro_dined_today(pid)::float8)
    - least(8::float8, b.trash::float8)))
  from public.arena_bistros b where b.player_id = pid
$$;
revoke all on function public.arena_bistro_popularity(uuid) from public, anon, authenticated, service_role;
-- Bring the bistro up to time t (see 073): plates at the dish's level price.
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
        select public.arena_bistro_price_at(price, public.arena_bistro_lv(pid, v_dish)) into v_price
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
-- What the player sees (see 073): also dish levels, the pantry, today's Market and Farm.
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
-- A friend's bistro as a visitor sees it (see 068): not their pantry either.
create or replace function public.arena_bistro_view(me uuid, pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select (public.arena_bistro_state(pid) - 'coins' - 'leaves' - 'tradedToday' - 'stored' - 'dinesToday' - 'lastSeen'
    - 'pantry' - 'marketBought' - 'farmSent' - 'farmCrops')
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
-- Actions (see 073); also dishup {dish}, market {id, qty} and farm {id: crop, qty}.
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
          v_bill = public.arena_bistro_pay(public.arena_bistro_price_at(v_dish.price, public.arena_bistro_lv(me, v_dish.id)),
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
-- Eat at a friend's (see 073): at their dish's level price; take an ingredient home.
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
        select public.arena_bistro_price_at(price, public.arena_bistro_lv(p_friend, v_dish)) into v_price
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
  to_regprocedure('public.arena_bistro_market_price(timestamptz,text)') is not null as bistro_market_enabled,
  to_regclass('public.arena_bistro_pantry') is not null as bistro_pantry_ready;

-- Element Bistro, part 8: stoves from the Shop. Run after
-- 102_bistro_orders_aside.sql. Safe to run again.
--
-- Stoves are bought in the Shop (Clay Stove, Steel Range +15% speed from level
-- 8, Dragon Oven +30% from level 16) and placed on the kitchen's back wall in
-- Decorate: on a free spot, or swapped for a stove standing there (it goes into
-- storage). The kitchen gains a column with each room expansion (x 0 to 5 + the
-- size step), so the back wall holds 4 stoves at first and 9 at the biggest;
-- furniture in the new column goes into storage. Stoves keep their numbers (0,
-- 1, 2, ...): cooks still take them from the last one back. Rules match
-- packages/shared/src/bistro.ts (placeStove, moveStove, buyStoveModel, buyStove,
-- buyExpand, openBranch, startCooking).
begin;

alter table public.arena_bistro_stoves drop constraint if exists arena_bistro_stoves_idx_check;
alter table public.arena_bistro_stoves add constraint arena_bistro_stoves_idx_check check (idx between 0 and 8);
alter table public.arena_bistro_stoves add column if not exists x integer;
alter table public.arena_bistro_stoves add column if not exists model text not null default 'clay';
update public.arena_bistro_stoves set x = idx + 1 where x is null;
alter table public.arena_bistro_stoves alter column x set not null;
alter table public.arena_bistro_stoves drop constraint if exists arena_bistro_stoves_model_check;
alter table public.arena_bistro_stoves add constraint arena_bistro_stoves_model_check check (model in ('clay', 'steel', 'dragon'));
create unique index if not exists arena_bistro_stoves_spot on public.arena_bistro_stoves(player_id, x);

create table if not exists public.arena_bistro_stove_store (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  model text not null check (model in ('clay', 'steel', 'dragon')),
  qty integer not null default 0 check (qty >= 0),
  primary key (player_id, model)
);
alter table public.arena_bistro_stove_store enable row level security;

-- The kitchen's last column (kitchenX1): 5, one more with each expansion.
create or replace function public.arena_bistro_kitchen_x1(p_size integer) returns integer
language sql immutable set search_path = '' as $$ select 5 + coalesce(p_size, 0) $$;
-- A stove's speed (STOVES in the shared rules).
create or replace function public.arena_bistro_stove_speed(p_model text) returns double precision
language sql immutable set search_path = '' as $$
  select case p_model when 'steel' then 1.15::float8 when 'dragon' then 1.3::float8 else 1::float8 end
$$;
-- Furniture inside the kitchen (after it grows) goes into storage.
create or replace function public.arena_bistro_clear_kitchen(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare kx integer;
begin
  select public.arena_bistro_kitchen_x1(size_lv) into kx from public.arena_bistros where player_id = pid;
  insert into public.arena_bistro_stored(player_id, kind, qty)
  select pid, kind, count(*) from public.arena_bistro_items where player_id = pid and x <= kx and y <= 2 group by kind
  on conflict (player_id, kind) do update set qty = public.arena_bistro_stored.qty + excluded.qty;
  delete from public.arena_bistro_items where player_id = pid and x <= kx and y <= 2;
end; $$;
revoke all on function public.arena_bistro_kitchen_x1(integer), public.arena_bistro_stove_speed(text),
  public.arena_bistro_clear_kitchen(uuid) from public, anon, authenticated, service_role;

-- Rooms already expanded have a wider kitchen now.
select public.arena_bistro_clear_kitchen(player_id) from public.arena_bistros where size_lv > 0;

-- The walls of the room (see 068): the kitchen, as wide as it is now.
create or replace function public.arena_bistro_blocked(pid uuid) returns boolean[]
language plpgsql stable security definer set search_path = public as $$
declare w integer; h integer; b boolean[]; it record; x integer; y integer; kx integer;
begin
  select public.arena_bistro_cols(size_lv), public.arena_bistro_rows(size_lv),
      public.arena_bistro_kitchen_x1(size_lv) into w, h, kx
    from public.arena_bistros where player_id = pid;
  b = array_fill(false, array[w * h]);
  for x in 0..kx loop for y in 0..2 loop b[y * w + x + 1] = true; end loop; end loop;
  for it in select i.x, i.y from public.arena_bistro_items i
      join public.arena_bistro_kinds k on k.kind = i.kind
      where i.player_id = pid and not k.floor loop
    if it.x < w and it.y < h then b[it.y * w + it.x + 1] = true; end if;
  end loop;
  return b;
end; $$;
revoke all on function public.arena_bistro_blocked(uuid) from public, anon, authenticated, service_role;
create or replace function public.arena_bistro_place_error(pid uuid, p_kind text, px integer, py integer, p_ignore integer)
returns text language plpgsql stable security definer set search_path = public as $$
declare k public.arena_bistro_kinds; n integer; dx integer; dy integer; tx integer; ty integer; w integer; h integer; kx integer;
begin
  select public.arena_bistro_cols(size_lv), public.arena_bistro_rows(size_lv),
      public.arena_bistro_kitchen_x1(size_lv) into w, h, kx
    from public.arena_bistros where player_id = pid;
  select * into k from public.arena_bistro_kinds where kind = p_kind;
  if k.kind is null then return 'Unknown item.'; end if;
  n = case when k.floor then 1 else 0 end;
  for dx in 0..n loop for dy in 0..n loop
    tx = px + dx; ty = py + dy;
    if tx < 0 or ty < 0 or tx >= w or ty >= h then return 'That''s outside the restaurant.'; end if;
    if tx <= kx and ty <= 2 then return 'The kitchen stays clear.'; end if;
    if not k.floor and ((tx = 0 and ty = 7) or (tx = 1 and ty = 7) or (ty = 3 and tx between 1 and 4)
        or (tx = 6 and ty = 3)) then
      return 'Keep the doorway and the counter clear.';
    end if;
    if exists (select 1 from public.arena_bistro_items i join public.arena_bistro_kinds ik on ik.kind = i.kind
        where i.player_id = pid and i.id <> coalesce(p_ignore, -1) and ik.floor = k.floor
          and tx between i.x and i.x + case when ik.floor then 1 else 0 end
          and ty between i.y and i.y + case when ik.floor then 1 else 0 end) then
      return 'Something''s already there.';
    end if;
  end loop; end loop;
  return null;
end; $$;
revoke all on function public.arena_bistro_place_error(uuid, text, integer, integer, integer) from public, anon, authenticated, service_role;
-- Start a dish (see 073): at the stove's speed too.
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
    -- The stove's speed counts like the cook's pace (startCooking does the same).
    dur_ms = public.arena_bistro_cook_ms(d.seconds, b.kitchen_lv, p_cook, p_pace * public.arena_bistro_stove_speed(st.model))
   where player_id = pid and idx = p_idx;
  return null;
end; $$;
-- A new bistro (see 068): two Clay Stoves on the first two spots.
create or replace function public.arena_bistro_ensure(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inserted integer;
begin
  insert into public.arena_bistros(player_id, chef)
  values (pid, coalesce((select portrait_character from public.arena_profiles where id = pid), 'voltkit'))
  on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  -- The starting room: three tables with two chairs each, a rug and ferns
  -- (defaultState in packages/shared/src/bistro.ts).
  insert into public.arena_bistro_items(player_id, id, kind, x, y, rot) values
    (pid, 1, 'rug', 3, 5, 0), (pid, 2, 'table', 4, 5, 0), (pid, 3, 'chair', 3, 5, 1),
    (pid, 4, 'chair', 5, 5, 3), (pid, 5, 'table', 8, 4, 0), (pid, 6, 'chair', 8, 3, 2),
    (pid, 7, 'chair', 8, 5, 0), (pid, 8, 'table', 8, 7, 0), (pid, 9, 'chair', 7, 7, 1),
    (pid, 10, 'chair', 9, 7, 3), (pid, 11, 'plant', 10, 0, 0), (pid, 12, 'plant', 0, 8, 0),
    (pid, 13, 'plant', 6, 0, 0)
  on conflict do nothing;
  insert into public.arena_bistro_stoves(player_id, idx, x, model) values (pid, 0, 1, 'clay'), (pid, 1, 2, 'clay')
  on conflict do nothing;
  insert into public.arena_bistro_counter(player_id, slot, dish, servings) values
    (pid, 0, 'goicuon', 6), (pid, 1, null, 0), (pid, 2, null, 0), (pid, 3, null, 0)
  on conflict do nothing;
  insert into public.arena_bistro_staff(player_id, id, creature, role) values (pid, 1, 'sunbara', 'waiter')
  on conflict do nothing;
end; $$;
revoke all on function public.arena_bistro_ensure(uuid) from public, anon, authenticated, service_role;
-- What the player sees (see 102): the stoves' spots and models, stoves in storage.
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
        'tokens', tokens, 'filled', filled, 'expires', coalesce((extract(epoch from expires_at) * 1000)::bigint, 0),
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
    'stoveStore', coalesce((select jsonb_object_agg(model, qty) from public.arena_bistro_stove_store
      where player_id = pid and qty > 0), '{}'::jsonb),
    'stoves', (select jsonb_agg(case when dish is null then jsonb_build_object('dish', null, 'start', 0, 'perfect', false)
        else jsonb_build_object('dish', dish, 'start', (extract(epoch from started_at) * 1000)::bigint,
          'perfect', perfect, 'dur', dur_ms) end || jsonb_build_object('x', x, 'model', model) order by idx)
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
-- A friend's bistro (see 100): not their stoves in storage.
create or replace function public.arena_bistro_view(me uuid, pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select (public.arena_bistro_state(pid) - 'coins' - 'leaves' - 'tradedToday' - 'stored' - 'dinesToday' - 'lastSeen'
    - 'pantry' - 'marketBought' - 'farmSent' - 'farmCrops' - 'tokens' - 'orders' - 'league' - 'regulars' - 'stoveStore')
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
-- Actions (see 102): stovebuy, stoveplace, stovemove; stove, expand and branch as above.
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
  v_model text; v_kx integer; v_sp integer; v_lvl integer; v_name text;
  v_order public.arena_bistro_orders; v_od jsonb; v_need integer; v_put integer; v_done boolean; v_k integer; v_reg record; v_step integer; v_ev text; v_last integer; lw date;
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
      -- A Clay Stove on the first free back-wall spot (buyStove).
      select count(*) into n from public.arena_bistro_stoves where player_id = me;
      v_kx = public.arena_bistro_kitchen_x1(b.size_lv);
      select g into v_x from generate_series(1, v_kx - 1) g
       where not exists (select 1 from public.arena_bistro_stoves s where s.player_id = me and s.x = g) order by g limit 1;
      if n >= v_kx - 1 or v_x is null then err = 'Every stove spot is in use.';
      elsif b.coins < 200 then err = 'You need 200 coins.';
      else
        update public.arena_bistros set coins = coins - 200 where player_id = me;
        insert into public.arena_bistro_stoves(player_id, idx, x, model) values (me, n, v_x, 'clay');
      end if;
    elsif v_kind = 'stovebuy' then
      -- A stove from the Shop, into storage (buyStoveModel).
      v_model = a->>'model';
      select x.price, x.level, x.name into v_price, v_lvl, v_name from (values
        ('clay', 200, 1, 'Clay Stove'), ('steel', 1200, 8, 'Steel Range'), ('dragon', 4000, 16, 'Dragon Oven'))
        as x(model, price, level, name) where x.model = v_model;
      if v_name is null then err = 'Unknown stove.';
      elsif v_lvl > b.level then err = v_name || ' opens at level ' || v_lvl || '.';
      elsif b.coins < v_price then err = 'You need ' || v_price || ' coins.';
      else
        update public.arena_bistros set coins = coins - v_price where player_id = me;
        insert into public.arena_bistro_stove_store(player_id, model, qty) values (me, v_model, 1)
        on conflict (player_id, model) do update set qty = public.arena_bistro_stove_store.qty + 1;
      end if;
    elsif v_kind = 'stoveplace' then
      -- A stove from storage onto the back wall: a new one, or a swap (placeStove).
      v_model = a->>'model';
      v_x = case when jsonb_typeof(a->'x') = 'number' then (a->>'x')::integer else -1 end;
      v_kx = public.arena_bistro_kitchen_x1(b.size_lv);
      select * into st from public.arena_bistro_stoves where player_id = me and x = v_x;
      if v_model is null or v_model not in ('clay', 'steel', 'dragon') then err = 'Unknown stove.';
      elsif coalesce((select qty from public.arena_bistro_stove_store where player_id = me and model = v_model), 0) < 1 then
        err = 'None in storage.';
      elsif v_x < 1 or v_x > v_kx - 1 then err = 'Stoves go on the kitchen''s back wall.';
      elsif st.idx is not null and st.dish is not null then err = 'That stove is cooking: wait until it''s done.';
      elsif st.idx is not null and st.model = v_model then err = 'That''s the same stove.';
      elsif st.idx is null and (select count(*) from public.arena_bistro_stoves where player_id = me) >= v_kx - 1 then
        err = 'Every stove spot is in use.';
      else
        if st.idx is not null then
          insert into public.arena_bistro_stove_store(player_id, model, qty) values (me, st.model, 1)
          on conflict (player_id, model) do update set qty = public.arena_bistro_stove_store.qty + 1;
          update public.arena_bistro_stoves set model = v_model where player_id = me and idx = st.idx;
        else
          insert into public.arena_bistro_stoves(player_id, idx, x, model)
          values (me, (select count(*) from public.arena_bistro_stoves where player_id = me), v_x, v_model);
        end if;
        update public.arena_bistro_stove_store set qty = qty - 1 where player_id = me and model = v_model;
        delete from public.arena_bistro_stove_store where player_id = me and qty <= 0;
      end if;
    elsif v_kind = 'stovemove' then
      -- A stove to another free spot on the back wall (moveStove).
      v_x = case when jsonb_typeof(a->'x') = 'number' then (a->>'x')::integer else -1 end;
      v_kx = public.arena_bistro_kitchen_x1(b.size_lv);
      select * into st from public.arena_bistro_stoves where player_id = me and idx = v_idx;
      if st.idx is null then err = 'No stove there.';
      elsif v_x < 1 or v_x > v_kx - 1 then err = 'Stoves go on the kitchen''s back wall.';
      elsif exists (select 1 from public.arena_bistro_stoves where player_id = me and x = v_x and idx <> st.idx) then
        err = 'Something''s already there.';
      else
        update public.arena_bistro_stoves set x = v_x where player_id = me and idx = st.idx;
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
        -- The kitchen grows a column: furniture standing there goes into storage.
        perform public.arena_bistro_clear_kitchen(me);
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
        -- What was put aside goes back on the counter.
        perform public.arena_bistro_return_aside(me, v_order.filled);
        update public.arena_bistro_orders set dishes = null, filled = '{}'::jsonb, next_at = t + interval '30 minutes'
         where player_id = me and slot = v_order.slot;
      else
        -- Put aside what it still needs, as much as the counter has.
        v_put = 0;
        for v_od in select * from jsonb_array_elements(v_order.dishes) loop
          v_need = least(greatest(0, (v_od->>'qty')::integer - coalesce((v_order.filled->>(v_od->>'dish'))::integer, 0)),
            public.arena_bistro_on_counter(me, v_od->>'dish'));
          for v_k in 1..v_need loop perform public.arena_bistro_take(me, v_od->>'dish'); end loop;
          if v_need > 0 then
            v_order.filled = jsonb_set(v_order.filled, array[v_od->>'dish'],
              to_jsonb(coalesce((v_order.filled->>(v_od->>'dish'))::integer, 0) + v_need));
          end if;
          v_put = v_put + v_need;
        end loop;
        select bool_and(coalesce((v_order.filled->>(x->>'dish'))::integer, 0) >= (x->>'qty')::integer) into v_done
          from jsonb_array_elements(v_order.dishes) x;
        if v_put = 0 and not v_done then
          err = 'Nothing for this order on the counter yet.';
        elsif v_done then
          update public.arena_bistros set coins = coins + v_order.coins, tokens = tokens + v_order.tokens where player_id = me;
          perform public.arena_bistro_add_xp(me, v_order.xp);
          perform public.arena_bistro_points(me, 10);
          update public.arena_bistro_orders set dishes = null, filled = '{}'::jsonb, next_at = t + interval '15 minutes'
           where player_id = me and slot = v_order.slot;
        else
          update public.arena_bistro_orders set filled = v_order.filled where player_id = me and slot = v_order.slot;
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
        insert into public.arena_bistro_stove_store(player_id, model, qty)
        select me, model, count(*) from public.arena_bistro_stoves where player_id = me group by model
        on conflict (player_id, model) do update set qty = public.arena_bistro_stove_store.qty + excluded.qty;
        delete from public.arena_bistro_stoves where player_id = me;
        insert into public.arena_bistro_stoves(player_id, idx, x, model) values (me, 0, 1, 'clay'), (me, 1, 2, 'clay');
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

commit;

select to_regclass('public.arena_bistro_stove_store') is not null as bistro_stove_shop;

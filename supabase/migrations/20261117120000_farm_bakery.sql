-- The Bakery: the Farm's first processing chain (docs/farm-bakery.md).
-- Run after 20261116180000_spire_zone2.sql. Safe to run again.
--   * arena_farm_bakery_recipes: six recipes (the same as BAKERY_RECIPES in
--     packages/shared/src/farm-bakery.ts): ingredients from the barn (plain
--     crops and Storm Milk), oven time, farm XP, a fixed sell price and the
--     farm level each unlocks at. Each baked good is a barn good.
--   * The Bakery stands below the lane, right of the path (its ground is
--     1070..1320 × 850..940). Decorations can't stand there any more
--     (arena_farm_decor_fits, as DECOR_BLOCKS); any that did go into
--     storage, to place again for free.
--   * It is built at farm level 10 for 1,200 Gold Leaves (+40 farm XP). Its
--     oven bakes one thing at a time, from a queue of 2 slots (600, 1,200
--     and 2,400 leaves buy a 3rd, 4th and 5th). A new one starts when the
--     last in the queue is done, or now: every time is the database's
--     clock, so the queue bakes on while the player is away. A finished
--     good waits in its slot until collected (a tap), into the barn (one
--     space each), for its XP.
--   * Actions in arena_farm_act_more (wrapping 20261116120000's): buy-bakery,
--     buy-bake-slot, bake, bake-collect, sell-good. arena_farm_state adds
--     'bakery': owned, slots and the queue.
--   * Orders: with a bakery, some new orders also ask for a baked good it
--     can make (arena_farm_new_order wraps 070's, now
--     arena_farm_new_order_crops: change the crops' orders there).
--     arena_farm_order names any good in its "You need" answer (a missing
--     crop name used to make the whole answer null).
begin;

create table if not exists public.arena_farm_bakery_recipes (
  id text primary key,
  name text not null,
  level integer not null check (level between 1 and 100),
  seconds integer not null check (seconds > 0),
  xp integer not null check (xp >= 0),
  sell integer not null check (sell > 0),
  -- [[good, count], ...]: plain crops or 'milk'.
  items jsonb not null
);
insert into public.arena_farm_bakery_recipes(id, name, level, seconds, xp, sell, items) values
  ('bread', 'Breeze Bread', 10, 600, 6, 24, '[["wheat", 3]]'),
  ('berrytart', 'Volt Berry Tart', 11, 1800, 12, 40, '[["voltberry", 3], ["wheat", 2]]'),
  ('milkbun', 'Storm Milk Bun', 12, 2700, 16, 105, '[["wheat", 2], ["milk", 1]]'),
  ('carrotcake', 'Carrot Cake', 14, 5400, 28, 130, '[["carrot", 3], ["wheat", 2], ["milk", 1]]'),
  ('pumpkinpie', 'Lava Pumpkin Pie', 18, 10800, 45, 150, '[["pumpkin", 2], ["wheat", 2], ["milk", 1]]'),
  ('cornbread', 'Twin Bolt Cornbread', 60, 21600, 80, 210, '[["boltcorn", 2], ["milk", 1]]')
on conflict (id) do update set name = excluded.name, level = excluded.level, seconds = excluded.seconds,
  xp = excluded.xp, sell = excluded.sell, items = excluded.items;
alter table public.arena_farm_bakery_recipes enable row level security;
revoke all on public.arena_farm_bakery_recipes from public, anon, authenticated, service_role;
-- Baked goods go in the barn.
insert into public.arena_farm_goods(id) select id from public.arena_farm_bakery_recipes on conflict do nothing;

alter table public.arena_farms add column if not exists bakery boolean not null default false;
alter table public.arena_farms add column if not exists bakery_slots integer not null default 2;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'arena_farms_bakery_slots_check'
      and conrelid = 'public.arena_farms'::regclass) then
    alter table public.arena_farms add constraint arena_farms_bakery_slots_check
      check (bakery_slots between 2 and 5);
  end if;
end $$;

-- The oven's queue: one row per slot in use, until its good is collected.
create table if not exists public.arena_farm_bakery_queue (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  slot integer not null check (slot between 0 and 4),
  recipe text not null references public.arena_farm_bakery_recipes(id),
  started_at timestamptz not null,
  ready_at timestamptz not null check (ready_at > started_at),
  primary key (player_id, slot)
);
alter table public.arena_farm_bakery_queue enable row level security;
revoke all on public.arena_farm_bakery_queue from public, anon, authenticated, service_role;

-- Decorations standing on the Bakery's ground go into storage (once: a
-- second run finds none there).
with moved as (
  delete from public.arena_farm_decor_pieces p
   using public.arena_farm_decor_items i
   where i.id = p.item
     and p.x - coalesce(i.w, 30) < 1320 and 1070 < p.x + coalesce(i.w, 30)
     and p.y - coalesce(i.d, 14) < 940 and 850 < p.y + 4
  returning p.player_id, p.item
)
insert into public.arena_farm_decor_credits(player_id, item, qty)
select player_id, item, count(*)::integer from moved group by player_id, item
on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + excluded.qty;

-- As in 20261116120000, with the Bakery's ground among the blocks.
create or replace function public.arena_farm_decor_fits(pid uuid, v_item text, px integer, py integer,
  except_id bigint default null) returns text
language plpgsql stable security definer set search_path = public as $$
declare i public.arena_farm_decor_items; x0 double precision; x1 double precision;
  y0 double precision; y1 double precision; b record; cx double precision; cy double precision;
begin
  select * into i from public.arena_farm_decor_items where id = v_item;
  if px is null or py is null or px % 10 <> 0 or py % 10 <> 0 then
    return 'Choose a spot on the farm';
  end if;
  x0 = px - coalesce(i.w, 30); x1 = px + coalesce(i.w, 30);
  y0 = py - coalesce(i.d, 14); y1 = py + 4;
  if x0 < 20 or x1 > 1740 or y0 < 120 or y1 > 1060 then
    return 'Choose a spot on the farm';
  end if;
  for b in select * from (values
      ('rect', 314, 1456, 338, 770), ('rect', 380, 1480, 770, 842),
      ('rect', 20, 1460, 120, 360), ('rect', 1450, 1750, 390, 690),
      ('rect', 80, 220, 630, 726), ('rect', 1470, 1680, 754, 840),
      ('rect', 250, 326, 520, 576), ('rect', 830, 940, 770, 1060),
      ('rect', 1070, 1320, 850, 940)) r(k, a1, a2, a3, a4) loop
    if x0 < b.a2 and b.a1 < x1 and y0 < b.a4 and b.a3 < y1 then
      return 'Something is in the way';
    end if;
  end loop;
  -- Ovals: centre, radii (the pond, then the farm's trees).
  for b in select * from (values (250, 990, 190, 82),
      (338, 230, 52, 26), (812, 190, 52, 26), (44, 400, 52, 26), (1480, 340, 52, 26),
      (1700, 330, 52, 26), (70, 210, 52, 26), (640, 1050, 52, 26), (1120, 1060, 52, 26),
      (1450, 1040, 52, 26), (1720, 1000, 52, 26), (40, 1060, 52, 26)) o(ox, oy, rx, ry) loop
    cx = least(greatest(b.ox::double precision, x0), x1);
    cy = least(greatest(b.oy::double precision, y0), y1);
    if ((cx - b.ox) / b.rx) ^ 2 + ((cy - b.oy) / b.ry) ^ 2 < 1 then
      return 'Something is in the way';
    end if;
  end loop;
  if exists (select 1 from public.arena_farm_decor_pieces p
      join public.arena_farm_decor_items o on o.id = p.item
     where p.player_id = pid and p.id is distinct from except_id
       and x0 < p.x + coalesce(o.w, 30) and p.x - coalesce(o.w, 30) < x1
       and y0 < p.y + 4 and p.y - coalesce(o.d, 14) < y1) then
    return 'Too close to another decoration';
  end if;
  return null;
end; $$;
revoke all on function public.arena_farm_decor_fits(uuid, text, integer, integer, bigint)
  from public, anon, authenticated, service_role;

-- The name of anything the barn holds.
create or replace function public.arena_farm_good_name(p_good text) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select name from public.arena_farm_crops where id = p_good),
    (select name from public.arena_farm_bakery_recipes where id = p_good),
    case when p_good = 'milk' then 'Storm Milk' end, p_good)
$$;
revoke all on function public.arena_farm_good_name(text) from public, anon, authenticated, service_role;

-- The farm state: as before, with the Bakery.
do $$
begin
  if to_regprocedure('public.arena_farm_state_prebakery(uuid)') is null then
    alter function public.arena_farm_state(uuid) rename to arena_farm_state_prebakery;
  end if;
end $$;
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_state_prebakery(pid) || coalesce((select jsonb_build_object('bakery',
      jsonb_build_object('owned', f.bakery, 'slots', f.bakery_slots,
        'queue', coalesce((select jsonb_agg(jsonb_build_object('slot', q.slot, 'recipe', q.recipe,
            'startedAt', q.started_at, 'readyAt', q.ready_at) order by q.ready_at, q.slot)
          from public.arena_farm_bakery_queue q where q.player_id = pid), '[]'::jsonb)))
    from public.arena_farms f where f.player_id = pid), '{}'::jsonb)
$$;
revoke all on function public.arena_farm_state(uuid), public.arena_farm_state_prebakery(uuid)
  from public, anon, authenticated, service_role;

-- The Bakery's actions; everything else as before (20261116120000's function).
-- arena_farm_act_core holds the farm's row lock for the whole request.
do $$
begin
  if to_regprocedure('public.arena_farm_act_prebakery(uuid, jsonb, text, timestamptz, date)') is null then
    alter function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date) rename to arena_farm_act_prebakery;
  end if;
end $$;
create or replace function public.arena_farm_act_more(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; r public.arena_farm_bakery_recipes; q public.arena_farm_bakery_queue;
  item jsonb; n integer; cost integer; used integer; v_slot integer; v_start timestamptz;
begin
  xp = 0;
  if a->>'a' is null or a->>'a' not in ('buy-bakery', 'buy-bake-slot', 'bake', 'bake-collect', 'sell-good') then
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_act_prebakery(pid, a, ref, t, d) x;
    return;
  end if;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'buy-bakery' then
    if f.bakery then err = 'You already have the bakery';
    elsif f.level < 10 then err = 'Unlocks at farm level 10';
    elsif not public.arena_spend_leaves(pid, 1200, 'farm-bakery', 'bakery', d) then
      err = 'Not enough Gold Leaves';
    else
      update public.arena_farms set bakery = true where player_id = pid;
      gained = jsonb_build_object('bakery', true, 'cost', 1200);
      xp = 40;
    end if;
  elsif a->>'a' = 'buy-bake-slot' then
    if not f.bakery then err = 'Build the bakery first';
    elsif f.bakery_slots >= 5 then err = 'Your bakery has every slot';
    else
      cost = case f.bakery_slots when 2 then 600 when 3 then 1200 else 2400 end;
      if not public.arena_spend_leaves(pid, cost, 'farm-bake-slot', (f.bakery_slots + 1)::text, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farms set bakery_slots = bakery_slots + 1 where player_id = pid;
        gained = jsonb_build_object('bakeSlots', f.bakery_slots + 1, 'cost', cost);
      end if;
    end if;
  elsif a->>'a' = 'bake' then
    select * into r from public.arena_farm_bakery_recipes where id = a->>'recipe';
    if not f.bakery then err = 'Build the bakery first';
    elsif r.id is null then err = 'Unknown recipe';
    elsif f.level < r.level then err = 'Unlocks at farm level ' || r.level;
    elsif (select count(*) from public.arena_farm_bakery_queue where player_id = pid) >= f.bakery_slots then
      err = 'The bakery queue is full';
    else
      -- Every ingredient first, so nothing is taken when one is short.
      for item in select * from jsonb_array_elements(r.items) loop
        if coalesce((select qty from public.arena_farm_barn where player_id = pid
            and crop = item->>0 and mutation = ''), 0) < (item->>1)::integer then
          err = 'You need ' || (item->>1) || ' ' || public.arena_farm_good_name(item->>0);
          exit;
        end if;
      end loop;
      if err is null then
        for item in select * from jsonb_array_elements(r.items) loop
          update public.arena_farm_barn set qty = qty - (item->>1)::integer
           where player_id = pid and crop = item->>0 and mutation = '';
        end loop;
        select s into v_slot from generate_series(0, f.bakery_slots - 1) s
         where not exists (select 1 from public.arena_farm_bakery_queue
           where player_id = pid and slot = s) order by s limit 1;
        -- One at a time: after the last in the queue, or now.
        v_start = greatest(t, coalesce((select max(ready_at) from public.arena_farm_bakery_queue
          where player_id = pid), t));
        insert into public.arena_farm_bakery_queue(player_id, slot, recipe, started_at, ready_at)
        values (pid, v_slot, r.id, v_start, v_start + make_interval(secs => r.seconds));
        gained = jsonb_build_object('baking', r.id, 'slot', v_slot,
          'readyAt', v_start + make_interval(secs => r.seconds));
      end if;
    end if;
  elsif a->>'a' = 'bake-collect' then
    v_slot = case when jsonb_typeof(a->'slot') = 'number' and (a->>'slot') ~ '^[0-9]$'
      then (a->>'slot')::integer end;
    select * into q from public.arena_farm_bakery_queue where player_id = pid and slot = v_slot for update;
    if q.slot is null then err = 'Nothing in that slot';
    elsif q.ready_at > t then err = 'Still baking';
    elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid) + 1
        > 80 + 40 * f.barn_upgrades then
      err = 'Your barn is full';
    else
      select * into r from public.arena_farm_bakery_recipes where id = q.recipe;
      delete from public.arena_farm_bakery_queue where player_id = pid and slot = q.slot;
      insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, q.recipe, '', 1)
      on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 1;
      gained = jsonb_build_object('baked', q.recipe, 'qty', 1, 'slot', q.slot, 'xp', r.xp);
      xp = r.xp;
    end if;
  else
    select * into r from public.arena_farm_bakery_recipes where id = a->>'good';
    n = case when jsonb_typeof(a->'qty') = 'number' and (a->>'qty') ~ '^[0-9]+$'
      then (a->>'qty')::integer end;
    if r.id is null then err = 'Unknown good';
    elsif n is null or n < 1 or n > 10000 then err = 'Choose how many to sell';
    else
      update public.arena_farm_barn set qty = qty - n
       where player_id = pid and crop = r.id and mutation = '' and qty >= n;
      get diagnostics used = row_count;
      if used = 0 then err = 'You don''t have that many';
      else
        cost = r.sell * n;
        perform public.arena_grant_leaves(pid, cost, 'farm-sell', ref, d);
        gained = jsonb_build_object('leaves', cost);
      end if;
    end if;
  end if;
end; $$;
revoke all on function public.arena_farm_act_more(uuid, jsonb, text, timestamptz, date),
  public.arena_farm_act_prebakery(uuid, jsonb, text, timestamptz, date)
  from public, anon, authenticated, service_role;

-- New orders: 070's crops, then, with a bakery, sometimes a baked good it
-- can make (1 or 2), paid like the crops: 1.45 × its price, and its XP.
do $$
begin
  if to_regprocedure('public.arena_farm_new_order_crops(uuid, integer, integer)') is null then
    alter function public.arena_farm_new_order(uuid, integer, integer) rename to arena_farm_new_order_crops;
  end if;
end $$;
create or replace function public.arena_farm_new_order(pid uuid, p_slot integer, p_level integer) returns void
language plpgsql security definer set search_path = public as $$
declare r public.arena_farm_bakery_recipes; o public.arena_farm_orders; n integer;
begin
  perform public.arena_farm_new_order_crops(pid, p_slot, p_level);
  if random() >= 0.45 or not coalesce((select bakery from public.arena_farms where player_id = pid), false) then
    return;
  end if;
  select * into o from public.arena_farm_orders where player_id = pid and slot = p_slot;
  if o.items is null or jsonb_array_length(o.items) >= 3 then return; end if;
  select * into r from public.arena_farm_bakery_recipes where level <= greatest(1, p_level)
   order by random() limit 1;
  if r.id is null then return; end if;
  n = 1 + floor(random() * 2)::integer;
  update public.arena_farm_orders
     set items = items || jsonb_build_array(jsonb_build_array(r.id, n)),
         leaves = leaves + (round(r.sell * n * 1.45 / 5) * 5)::integer,
         xp = xp + r.xp * n
   where player_id = pid and slot = p_slot;
end; $$;
revoke all on function public.arena_farm_new_order(uuid, integer, integer),
  public.arena_farm_new_order_crops(uuid, integer, integer)
  from public, anon, authenticated, service_role;

-- As in 040, naming any good it is short of (a baked good has no crop name).
create or replace function public.arena_farm_order(p_request uuid, p_slot integer, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today(); o public.arena_farm_orders;
  item jsonb; need integer; take integer; b record; inserted integer; err text; gained jsonb;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or p_slot is null or p_slot not between 0 and 2 or p_kind not in ('deliver', 'skip') then
    raise exception 'Invalid order request';
  end if;
  perform public.arena_farm_ensure(me);
  perform 1 from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('farm', public.arena_farm_state(me), 'ok', false, 'repeated', true);
  end if;
  perform public.arena_farm_orders_refresh(me);
  select * into o from public.arena_farm_orders where player_id = me and slot = p_slot for update;
  if o.items is null then err = 'A new order is on its way';
  elsif p_kind = 'skip' then
    update public.arena_farm_orders set items = null, wait_until = t + interval '5 minutes'
     where player_id = me and slot = p_slot;
  else
    -- Enough of every good (any mutation)?
    for item in select * from jsonb_array_elements(o.items) loop
      if coalesce((select sum(qty) from public.arena_farm_barn where player_id = me and crop = item->>0), 0)
         < (item->>1)::integer then
        err = 'You need ' || (item->>1) || ' ' || public.arena_farm_good_name(item->>0);
        exit;
      end if;
    end loop;
    if err is null then
      for item in select * from jsonb_array_elements(o.items) loop
        need = (item->>1)::integer;
        -- Plain first, then the cheapest mutations.
        for b in select mutation, qty from public.arena_farm_barn
            where player_id = me and crop = item->>0 and qty > 0
            order by public.arena_farm_mutation_mult(mutation), mutation loop
          exit when need = 0;
          take = least(need, b.qty);
          update public.arena_farm_barn set qty = qty - take
           where player_id = me and crop = item->>0 and mutation = b.mutation;
          need = need - take;
        end loop;
      end loop;
      perform public.arena_grant_leaves(me, o.leaves, 'farm-order', p_request::text, d);
      perform public.arena_farm_add_xp(me, o.xp);
      if o.bonus is not null then
        update public.arena_farms set fert_norm = fert_norm + case when o.bonus = 'norm' then 1 else 0 end,
          fert_super = fert_super + case when o.bonus = 'super' then 1 else 0 end,
          fert_gold = fert_gold + case when o.bonus = 'gold' then 1 else 0 end where player_id = me;
      end if;
      update public.arena_farm_orders set items = null, wait_until = t + interval '80 minutes'
       where player_id = me and slot = p_slot;
      gained = jsonb_build_object('leaves', o.leaves, 'xp', o.xp, 'bonus', o.bonus, 'who', o.who);
    end if;
  end if;
  return jsonb_build_object('farm', public.arena_farm_state(me), 'ok', err is null, 'error', err, 'gained', gained);
end; $$;
revoke all on function public.arena_farm_order(uuid, integer, text) from public, anon;
grant execute on function public.arena_farm_order(uuid, integer, text) to authenticated;

commit;

select
  to_regclass('public.arena_farm_bakery_queue') is not null as farm_bakery_enabled,
  (select count(*) from public.arena_farm_bakery_recipes) = 6 as bakery_recipes_seeded;

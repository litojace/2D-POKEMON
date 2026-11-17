-- The Chicken Coop, and more cows. Run after 20261116180000_spire_zone2.sql.
-- Safe to run again. Numbers and reasons: docs/farm-coop.md.
--   * The coop opens at farm level 14 for 1500 Gold Leaves (+40 farm XP),
--     with 3 hens. 6 more can be bought, each from its own farm level:
--     Lv 17 / 20 / 24 / 28 / 32 / 36 for 500 / 700 / 900 / 1100 / 1300 / 1500.
--   * A hungry hen eats 2 plain Breeze Wheat from the barn and lays one
--     Sunny Egg 2 hours later (server time); collecting it gives 3 farm XP,
--     and the hen is hungry again. Eggs take barn space and sell for 30
--     Gold Leaves times their own price of the day (0.85 to 1.35).
--   * The coop stands on the grass below the lane, right of the gate's
--     path (990..1350 × 846..1010, world px); the farm tree that stood at
--     (1120, 1060) is felled. Decorations can't stand on the coop
--     (arena_farm_decor_fits, as DECOR_BLOCKS / COOP in
--     packages/shared/src/farm.ts) and any already there go into storage
--     (placed again for free); the felled tree's spot is free ground.
--   * Order board: with a coop, an order may ask for eggs too.
--   * More cows: the pasture's 2nd cow from farm level 40 (6000 Gold
--     Leaves) and the 3rd from 55 (10000). Each gives 2 Storm Milk every
--     2 hours like the first (its first milk 20 minutes after it arrives);
--     `milk` takes the cow (0, the first, when left out).
--   * Hooks as in 049/20261116120000: the actions go through
--     arena_farm_act_extra and the fields through arena_farm_state_extra,
--     each wrapping the function it replaces (renamed once).
begin;

-- Eggs are a barn good.
insert into public.arena_farm_goods(id) values ('egg') on conflict do nothing;

alter table public.arena_farms add column if not exists coop boolean not null default false;

-- Each hen: its place in the coop (0..8) and when its egg is due (null: hungry).
create table if not exists public.arena_farm_hens (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  idx smallint not null check (idx between 0 and 8),
  egg_at timestamptz,
  primary key (player_id, idx)
);
alter table public.arena_farm_hens enable row level security;
revoke all on public.arena_farm_hens from public, anon, authenticated, service_role;

-- The 2nd and 3rd cows (1, 2) and when each one's milk is ready; the first
-- cow's stays arena_farms.milk_at.
create table if not exists public.arena_farm_cows (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  idx smallint not null check (idx between 1 and 2),
  milk_at timestamptz not null,
  primary key (player_id, idx)
);
alter table public.arena_farm_cows enable row level security;
revoke all on public.arena_farm_cows from public, anon, authenticated, service_role;

-- Eggs' price of the day, the same for everyone (0.85 to 1.35).
create or replace function public.arena_farm_egg_mult(p_day date) returns numeric
language sql immutable set search_path = public as $$
  select round((0.85 + 0.5 * public.arena_farm_hash('egg:' || p_day::text))::numeric, 2)
$$;

-- Decorations standing where the coop goes move into storage.
with gone as (
  delete from public.arena_farm_decor_pieces p
   using public.arena_farm_decor_items i
   where i.id = p.item
     and p.x - coalesce(i.w, 30) < 1350 and 990 < p.x + coalesce(i.w, 30)
     and p.y - coalesce(i.d, 14) < 1010 and 846 < p.y + 4
  returning p.player_id, p.item
)
insert into public.arena_farm_decor_credits(player_id, item, qty)
select player_id, item, count(*)::integer from gone group by player_id, item
on conflict (player_id, item) do update set qty = public.arena_farm_decor_credits.qty + excluded.qty;

-- As in 20261116120000, with the coop among the blocks and one tree fewer.
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
      ('rect', 990, 1350, 846, 1010)) r(k, a1, a2, a3, a4) loop
    if x0 < b.a2 and b.a1 < x1 and y0 < b.a4 and b.a3 < y1 then
      return 'Something is in the way';
    end if;
  end loop;
  -- Ovals: centre, radii (the pond, then the farm's trees; the one at
  -- (1120, 1060) was felled for the coop).
  for b in select * from (values (250, 990, 190, 82),
      (338, 230, 52, 26), (812, 190, 52, 26), (44, 400, 52, 26), (1480, 340, 52, 26),
      (1700, 330, 52, 26), (70, 210, 52, 26), (640, 1050, 52, 26),
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

-- The coop's actions and the other cows; anything else as before (064's function).
do $$
begin
  if to_regprocedure('public.arena_farm_act_extra_pasture(uuid, jsonb, text, timestamptz, date)') is null then
    alter function public.arena_farm_act_extra(uuid, jsonb, text, timestamptz, date) rename to arena_farm_act_extra_pasture;
  end if;
end $$;
create or replace function public.arena_farm_act_extra(pid uuid, a jsonb, ref text, t timestamptz, d date,
  out err text, out gained jsonb, out xp integer)
language plpgsql security definer set search_path = public as $$
declare f public.arena_farms; h public.arena_farm_hens; c public.arena_farm_cows; n integer;
  cost integer; used integer; lv integer;
begin
  xp = 0;
  n = case when jsonb_typeof(a->'cow') = 'number' and (a->>'cow') ~ '^[0-9]+$' then (a->>'cow')::integer end;
  if a->>'a' = 'milk' and a ? 'cow' and (n is null or n > 2) then
    err = 'Choose a cow';
    return;
  end if;
  if a->>'a' not in ('buy-coop', 'buy-hen', 'feed-hen', 'collect-egg', 'sell-eggs', 'buy-cow')
      and not (a->>'a' = 'milk' and coalesce(n between 1 and 2, false)) then
    select x.err, x.gained, x.xp into err, gained, xp
      from public.arena_farm_act_extra_pasture(pid, a, ref, t, d) x;
    return;
  end if;
  select * into f from public.arena_farms where player_id = pid;
  if a->>'a' = 'buy-cow' then
    select count(*) + 1 into n from public.arena_farm_cows where player_id = pid;
    lv = case n when 1 then 40 when 2 then 55 end;
    cost = case n when 1 then 6000 when 2 then 10000 end;
    if not f.pasture then err = 'Open the pasture first';
    elsif lv is null then err = 'Your pasture is full';
    elsif f.level < lv then err = 'Unlocks at farm level ' || lv;
    -- One purchase per place in the pasture: a retry can never buy it twice.
    elsif not public.arena_spend_leaves(pid, cost, 'farm-cow', 'cow-' || n, d) then
      err = 'Not enough Gold Leaves';
    else
      insert into public.arena_farm_cows(player_id, idx, milk_at) values (pid, n, t + interval '20 minutes');
      gained = jsonb_build_object('cow', n, 'cost', cost, 'milkAt', t + interval '20 minutes');
    end if;
  elsif a->>'a' = 'milk' then
    -- The 2nd or 3rd cow (the first is 064's).
    select * into c from public.arena_farm_cows where player_id = pid and idx = n for update;
    if c.idx is null then err = 'Choose a cow';
    elsif c.milk_at > t then err = 'The cow is still grazing';
    elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid) + 2
        > 80 + 40 * f.barn_upgrades then
      err = 'Your barn is full';
    else
      insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, 'milk', '', 2)
      on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 2;
      update public.arena_farm_cows set milk_at = t + interval '2 hours' where player_id = pid and idx = n;
      gained = jsonb_build_object('milk', 2, 'cow', n, 'milkAt', t + interval '2 hours');
      xp = 8;
    end if;
  elsif a->>'a' = 'buy-coop' then
    if f.coop then err = 'You already have the coop';
    elsif f.level < 14 then err = 'Unlocks at farm level 14';
    elsif not public.arena_spend_leaves(pid, 1500, 'farm-coop', 'coop', d) then
      err = 'Not enough Gold Leaves';
    else
      update public.arena_farms set coop = true where player_id = pid;
      insert into public.arena_farm_hens(player_id, idx)
      select pid, k from generate_series(0, 2) k on conflict do nothing;
      gained = jsonb_build_object('coop', true);
      xp = 40;
    end if;
  elsif a->>'a' = 'sell-eggs' then
    n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer end;
    if n is null or n < 1 or n > 10000 then err = 'Choose how many to sell';
    else
      update public.arena_farm_barn set qty = qty - n
       where player_id = pid and crop = 'egg' and mutation = '' and qty >= n;
      get diagnostics used = row_count;
      if used = 0 then err = 'You don''t have that many';
      else
        cost = greatest(1, round(30 * public.arena_farm_egg_mult(d)))::integer * n;
        perform public.arena_grant_leaves(pid, cost, 'farm-sell', ref, d);
        gained = jsonb_build_object('leaves', cost);
      end if;
    end if;
  elsif not f.coop then
    err = 'Open the coop first';
  elsif a->>'a' = 'buy-hen' then
    select count(*) into n from public.arena_farm_hens where player_id = pid;
    lv = case n when 3 then 17 when 4 then 20 when 5 then 24 when 6 then 28 when 7 then 32 when 8 then 36 end;
    cost = case n when 3 then 500 when 4 then 700 when 5 then 900 when 6 then 1100
      when 7 then 1300 when 8 then 1500 end;
    if cost is null then err = 'Your coop is full';
    elsif f.level < lv then err = 'Unlocks at farm level ' || lv;
    -- One purchase per place in the coop: a retry can never buy it twice.
    elsif not public.arena_spend_leaves(pid, cost, 'farm-hen', 'hen-' || n, d) then
      err = 'Not enough Gold Leaves';
    else
      insert into public.arena_farm_hens(player_id, idx) values (pid, n);
      gained = jsonb_build_object('hen', n, 'cost', cost);
    end if;
  else
    n = case when jsonb_typeof(a->'hen') = 'number' and (a->>'hen') ~ '^[0-9]+$' then (a->>'hen')::integer end;
    select * into h from public.arena_farm_hens where player_id = pid and idx = n for update;
    if h.idx is null then err = 'Choose a hen';
    elsif a->>'a' = 'feed-hen' then
      if h.egg_at > t then err = 'This hen is already fed';
      elsif h.egg_at is not null then err = 'Collect her egg first';
      else
        update public.arena_farm_barn set qty = qty - 2
         where player_id = pid and crop = 'wheat' and mutation = '' and qty >= 2;
        get diagnostics used = row_count;
        if used = 0 then err = 'You need 2 Breeze Wheat';
        else
          update public.arena_farm_hens set egg_at = t + interval '2 hours' where player_id = pid and idx = n;
          gained = jsonb_build_object('fed', n, 'eggAt', t + interval '2 hours');
        end if;
      end if;
    else
      if h.egg_at is null then err = 'Feed this hen first';
      elsif h.egg_at > t then err = 'This hen is still laying';
      elsif (select coalesce(sum(qty), 0) from public.arena_farm_barn where player_id = pid) + 1
          > 80 + 40 * f.barn_upgrades then
        err = 'Your barn is full';
      else
        insert into public.arena_farm_barn(player_id, crop, mutation, qty) values (pid, 'egg', '', 1)
        on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 1;
        update public.arena_farm_hens set egg_at = null where player_id = pid and idx = n;
        gained = jsonb_build_object('egg', 1, 'hen', n);
        xp = 3;
      end if;
    end if;
  end if;
end; $$;

-- The coop's fields; everything else as before (050's function).
do $$
begin
  if to_regprocedure('public.arena_farm_state_extra_pasture(uuid)') is null then
    alter function public.arena_farm_state_extra(uuid) rename to arena_farm_state_extra_pasture;
  end if;
end $$;
create or replace function public.arena_farm_state_extra(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_state_extra_pasture(pid) || coalesce((select jsonb_build_object(
      'coop', f.coop,
      'hens', coalesce((select jsonb_agg(jsonb_build_object('i', h.idx, 'eggAt', h.egg_at) order by h.idx)
        from public.arena_farm_hens h where h.player_id = pid), '[]'::jsonb),
      'eggMult', public.arena_farm_egg_mult(public.arena_today()),
      'cows', coalesce((select jsonb_agg(jsonb_build_object('i', c.idx, 'milkAt', c.milk_at) order by c.idx)
        from public.arena_farm_cows c where c.player_id = pid), '[]'::jsonb))
    from public.arena_farms f where f.player_id = pid), '{}'::jsonb)
$$;

-- A friend's farm as before, plus their coop and cows (they see your hens).
do $$
begin
  if to_regprocedure('public.arena_farm_view_pasture(uuid, uuid)') is null then
    alter function public.arena_farm_view(uuid, uuid) rename to arena_farm_view_pasture;
  end if;
end $$;
create or replace function public.arena_farm_view(me uuid, pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_view_pasture(me, pid) || jsonb_build_object(
    'coop', coalesce((select f.coop from public.arena_farms f where f.player_id = pid), false),
    'hens', (select count(*) from public.arena_farm_hens h where h.player_id = pid),
    'cows', case when coalesce((select f.pasture from public.arena_farms f where f.player_id = pid), false)
      then 1 + (select count(*) from public.arena_farm_cows c where c.player_id = pid) else 0 end)
$$;

-- New orders as in 070; with a coop, about a third also ask for 2 to 4 eggs
-- (paid like crops: 1.45 × their base price, and 3 XP each).
do $$
begin
  if to_regprocedure('public.arena_farm_new_order_crops(uuid, integer, integer)') is null then
    alter function public.arena_farm_new_order(uuid, integer, integer) rename to arena_farm_new_order_crops;
  end if;
end $$;
create or replace function public.arena_farm_new_order(pid uuid, p_slot integer, p_level integer) returns void
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  perform public.arena_farm_new_order_crops(pid, p_slot, p_level);
  if exists (select 1 from public.arena_farms where player_id = pid and coop) and random() < 0.35 then
    n = 2 + floor(random() * 3)::integer;
    update public.arena_farm_orders
       set items = items || jsonb_build_array(jsonb_build_array('egg', n)),
           leaves = leaves + (round(30 * n * 1.45 / 5) * 5)::integer,
           xp = xp + 3 * n
     where player_id = pid and slot = p_slot and items is not null;
  end if;
end; $$;

-- Delivering an order (040) names what's missing from the crops table; eggs
-- aren't there, so an order short of eggs is answered here first.
do $$
begin
  if to_regprocedure('public.arena_farm_order_crops(uuid, integer, text)') is null then
    alter function public.arena_farm_order(uuid, integer, text) rename to arena_farm_order_crops;
  end if;
end $$;
create or replace function public.arena_farm_order(p_request uuid, p_slot integer, p_kind text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); need integer;
begin
  if me is not null and p_kind = 'deliver' and p_request is not null
      and exists (select 1 from public.arena_profiles where id = me and not suspended)
      and not exists (select 1 from public.arena_farm_requests where player_id = me and request = p_request) then
    select (i->>1)::integer into need
      from public.arena_farm_orders o cross join lateral jsonb_array_elements(o.items) i
     where o.player_id = me and o.slot = p_slot and o.items is not null and i->>0 = 'egg'
     limit 1;
    if need > coalesce((select sum(qty) from public.arena_farm_barn where player_id = me and crop = 'egg'), 0) then
      return jsonb_build_object('farm', public.arena_farm_state(me), 'ok', false,
        'error', 'You need ' || need || ' Sunny Egg');
    end if;
  end if;
  return public.arena_farm_order_crops(p_request, p_slot, p_kind);
end; $$;

revoke all on function public.arena_farm_egg_mult(date),
  public.arena_farm_act_extra(uuid, jsonb, text, timestamptz, date),
  public.arena_farm_act_extra_pasture(uuid, jsonb, text, timestamptz, date),
  public.arena_farm_state_extra(uuid), public.arena_farm_state_extra_pasture(uuid),
  public.arena_farm_view(uuid, uuid), public.arena_farm_view_pasture(uuid, uuid),
  public.arena_farm_new_order(uuid, integer, integer), public.arena_farm_new_order_crops(uuid, integer, integer),
  public.arena_farm_order_crops(uuid, integer, text)
  from public, anon, authenticated, service_role;
revoke all on function public.arena_farm_order(uuid, integer, text) from public, anon;
grant execute on function public.arena_farm_order(uuid, integer, text) to authenticated;
commit;

select
  to_regclass('public.arena_farm_hens') is not null as farm_coop_enabled,
  to_regprocedure('public.arena_farm_act_extra_pasture(uuid, jsonb, text, timestamptz, date)') is not null as farm_coop_hooked;

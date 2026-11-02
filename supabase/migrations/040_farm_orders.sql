-- Hub redesign, phase 5b: farm orders.
-- Run after 039_farm_weather.sql. Safe to run again.
--  * Three order slots per player. An order asks for 1–3 kinds of crops you
--    can grow and pays 1.45× their market value in Gold Leaves (rounded to
--    5), their harvest XP, and 30% of the time a bag of fertilizer.
--  * Delivering takes the crops from the barn (plain ones first, then the
--    cheapest mutations) and brings a new order 80 minutes later; skipping
--    brings one 5 minutes later. Orders are made on the server.
--  * The farm state is now a core plus extras (orders here), so later
--    migrations add to arena_farm_state without copying the core.
begin;

create table if not exists public.arena_farm_orders (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  slot smallint not null check (slot between 0 and 2),
  -- [[crop, count], …], or null while the slot waits for a new order.
  items jsonb,
  leaves integer,
  xp integer,
  bonus text check (bonus in ('norm', 'super', 'gold')),
  who text,
  face text,
  wait_until timestamptz,
  primary key (player_id, slot)
);
alter table public.arena_farm_orders enable row level security;
revoke all on public.arena_farm_orders from public, anon, authenticated, service_role;

-- Make (or remake) the order in one slot.
create or replace function public.arena_farm_new_order(pid uuid, p_slot integer, p_level integer) returns void
language plpgsql security definer set search_path = public as $$
declare pool text[]; kinds integer; used text[] = '{}'; pick text; c public.arena_farm_crops;
  items jsonb = '[]'::jsonb; n integer; val integer = 0; v_xp integer = 0; r integer;
begin
  pool = array(select id from public.arena_farm_crops where level <= greatest(1, p_level) order by level, id);
  kinds = 1 + floor(random() * least(3, array_length(pool, 1)))::integer;
  for k in 1..kinds loop
    loop
      pick = pool[1 + floor(random() * array_length(pool, 1))::integer];
      exit when not pick = any(used);
    end loop;
    used = used || pick;
    select * into c from public.arena_farm_crops where id = pick;
    n = 2 + floor(random() * (case when c.level > 4 then 4 else 7 end))::integer;
    items = items || jsonb_build_array(jsonb_build_array(c.id, n));
    val = val + c.sell * n;
    v_xp = v_xp + c.xp * n;
  end loop;
  r = 1 + floor(random() * 8)::integer;
  insert into public.arena_farm_orders(player_id, slot, items, leaves, xp, bonus, who, face, wait_until)
  values (pid, p_slot, items, (round(val * 1.45 / 5) * 5)::integer, v_xp,
    case when random() < 0.3 then (array['super', 'gold', 'norm'])[1 + floor(random() * 3)::integer] end,
    (array['Volt Boba Truck', 'Raid Hall', 'Cindrake''s Forge', 'Mystowl''s Library',
      'Tidefin''s Kitchen', 'Lumoth''s Shrine', 'Terradon''s Quarry', 'Shadow Guild'])[r],
    (array['voltkit', 'auralynx', 'cindrake', 'mystowl', 'tidefin', 'lumoth', 'terradon', 'duskveil'])[r],
    null)
  on conflict (player_id, slot) do update set items = excluded.items, leaves = excluded.leaves,
    xp = excluded.xp, bonus = excluded.bonus, who = excluded.who, face = excluded.face, wait_until = null;
end; $$;
-- Fill empty slots and slots whose wait is over.
create or replace function public.arena_farm_orders_refresh(pid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare lvl integer = coalesce((select level from public.arena_farms where player_id = pid), 1);
begin
  for s in 0..2 loop
    if not exists (select 1 from public.arena_farm_orders where player_id = pid and slot = s)
       or exists (select 1 from public.arena_farm_orders where player_id = pid and slot = s
         and items is null and wait_until <= now()) then
      perform public.arena_farm_new_order(pid, s, lvl);
    end if;
  end loop;
end; $$;
revoke all on function public.arena_farm_new_order(uuid, integer, integer),
  public.arena_farm_orders_refresh(uuid) from public, anon, authenticated, service_role;

-- The farm state's core (from 039, unchanged).
create or replace function public.arena_farm_state_core(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare f public.arena_farms; t timestamptz = now(); d date = public.arena_today(); r bigint;
  ws bigint = public.arena_farm_slot(now());
begin
  select * into f from public.arena_farms where player_id = pid;
  r = public.arena_farm_restock(t);
  return jsonb_build_object(
    'now', t,
    'level', f.level,
    'xp', f.xp,
    'landBought', f.land_bought,
    'barnCap', 80 + 40 * f.barn_upgrades,
    'barnUpgrades', f.barn_upgrades,
    'fertilizer', jsonb_build_object('norm', f.fert_norm, 'super', f.fert_super, 'gold', f.fert_gold),
    'plots', (select jsonb_agg(jsonb_build_object(
        'i', p.idx, 'owned', p.owned, 'crop', p.crop,
        'progress', round(s.g::numeric, 4),
        'ripeAt', public.arena_farm_ripe_at(p),
        'wet', coalesce(s.wet, false), 'fertilizer', p.fertilizer,
        'mutation', case when s.g >= 1 then public.arena_farm_mutation(pid, p, s.ripe_weather) end) order by p.idx)
      from public.arena_farm_plots p cross join lateral public.arena_farm_sim(p, t) s where p.player_id = pid),
    'weather', jsonb_build_object('now', public.arena_farm_weather(ws),
      'next', public.arena_farm_weather(ws + 1), 'later', public.arena_farm_weather(ws + 2),
      'until', to_timestamp((ws + 1) * 14400)),
    'seeds', coalesce((select jsonb_object_agg(crop, qty) from public.arena_farm_seeds
      where player_id = pid and qty > 0), '{}'::jsonb),
    'barn', coalesce((select jsonb_agg(jsonb_build_object('crop', crop, 'mutation', mutation, 'qty', qty)
        order by crop, mutation) from public.arena_farm_barn where player_id = pid and qty > 0), '[]'::jsonb),
    'harvests', coalesce((select jsonb_object_agg(crop, harvests) from public.arena_farm_harvests
      where player_id = pid), '{}'::jsonb),
    'market', jsonb_build_object('day', d,
      'mult', (select jsonb_object_agg(m.crop, m.mult) from public.arena_farm_market(d, f.level, pid) m),
      'hot', (select m.crop from public.arena_farm_market(d, f.level, pid) m where m.hot)),
    'shop', jsonb_build_object('window', r,
      'restockAt', to_timestamp((r + 1) * 14400 + 7200),
      'stock', (select jsonb_object_agg(c.id, greatest(0, public.arena_farm_stock(r, c.id, c.rarity)
          - coalesce((select qty from public.arena_farm_purchases b
              where b.player_id = pid and b.restock = r and b.crop = c.id), 0)))
        from public.arena_farm_crops c)),
    'leaves', coalesce((select balance from public.arena_leaf_wallets where player_id = pid), 0));
end; $$;
revoke all on function public.arena_farm_state_core(uuid) from public, anon, authenticated, service_role;

-- The farm state: the core, plus the orders.
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_state_core(pid) || jsonb_build_object(
    'orders', coalesce((select jsonb_agg(jsonb_build_object('slot', o.slot, 'items', o.items,
        'leaves', o.leaves, 'xp', o.xp, 'bonus', o.bonus, 'who', o.who, 'face', o.face,
        'waitUntil', o.wait_until) order by o.slot)
      from public.arena_farm_orders o where o.player_id = pid), '[]'::jsonb))
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;

-- Opening the farm fills the order board.
create or replace function public.arena_farm() returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  perform public.arena_farm_ensure(me);
  perform public.arena_farm_orders_refresh(me);
  return public.arena_farm_state(me);
end; $$;
revoke all on function public.arena_farm() from public, anon;
grant execute on function public.arena_farm() to authenticated;

-- Deliver or skip an order. Answers like arena_farm_act: the farm, and
-- whether it worked. A retried request is answered, never applied twice.
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
    -- Enough of every crop (any mutation)?
    for item in select * from jsonb_array_elements(o.items) loop
      if coalesce((select sum(qty) from public.arena_farm_barn where player_id = me and crop = item->>0), 0)
         < (item->>1)::integer then
        err = 'You need ' || (item->>1) || ' ' || (select name from public.arena_farm_crops where id = item->>0);
        exit;
      end if;
    end loop;
    if err is null then
      for item in select * from jsonb_array_elements(o.items) loop
        need = (item->>1)::integer;
        -- Plain crops first, then the cheapest mutations.
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

select to_regprocedure('public.arena_farm_order(uuid, integer, text)') is not null as farm_orders_enabled;

-- Hub redesign, phase 5c: crop book rewards.
-- Run after 040_farm_orders.sql. Safe to run again.
--  * Finding crops (harvesting each kind once) pays, once each:
--    5 crops +100 Gold Leaves, 10 crops 2 Gold Fertilizer, 20 crops +1,000
--    Gold Leaves, all 25 the title "Elemental Botanist". (The prototype's
--    15-crop Golden Voltkit Statue comes with decorations; the 25-crop title
--    was also called "Elemental Farmer", the farm level 100 title.)
--  * The farm action function becomes a core plus a wrapper, like the farm
--    state in 040, so rewards are paid right after the harvest that earns
--    them without copying the actions again.
begin;

create table if not exists public.arena_farm_book_rewards (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  found integer not null check (found in (5, 10, 15, 20, 25)),
  granted_at timestamptz not null default now(),
  primary key (player_id, found)
);
alter table public.arena_farm_book_rewards enable row level security;
revoke all on public.arena_farm_book_rewards from public, anon, authenticated, service_role;

insert into public.arena_titles(name, description, color, active)
select 'Elemental Botanist', 'Find all 25 crops in the farm''s crop book.', '#9be07a', true
where not exists (select 1 from public.arena_titles where name = 'Elemental Botanist');

-- Pay any crop book reward now earned. Returns the newly paid ones.
create or replace function public.arena_farm_book_rewards(pid uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare n_found integer; m integer; inserted integer; paid jsonb = '[]'::jsonb;
begin
  n_found = (select count(*) from public.arena_farm_harvests where player_id = pid and harvests > 0);
  foreach m in array array[5, 10, 20, 25] loop
    continue when n_found < m;
    insert into public.arena_farm_book_rewards(player_id, found) values (pid, m) on conflict do nothing;
    get diagnostics inserted = row_count;
    continue when inserted = 0;
    if m = 5 then
      perform public.arena_grant_leaves(pid, 100, 'farm-book', '5', public.arena_today());
    elsif m = 10 then
      update public.arena_farms set fert_gold = fert_gold + 2 where player_id = pid;
    elsif m = 20 then
      perform public.arena_grant_leaves(pid, 1000, 'farm-book', '20', public.arena_today());
    else
      insert into public.arena_player_titles(player_id, title_id)
      select pid, id from public.arena_titles where name = 'Elemental Botanist' on conflict do nothing;
    end if;
    paid = paid || to_jsonb(m);
  end loop;
  return paid;
end; $$;
revoke all on function public.arena_farm_book_rewards(uuid) from public, anon, authenticated, service_role;

-- The farm actions' core (from 039, unchanged).
create or replace function public.arena_farm_act_core(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  f public.arena_farms; a jsonb; i integer = 0; kind text; plot integer; p public.arena_farm_plots;
  c public.arena_farm_crops; g double precision; n integer; cost integer; used integer;
  results jsonb = '[]'::jsonb; err text; gained jsonb; harvested integer = 0; v_xp integer = 0;
  inserted integer; r bigint; left_stock integer; v_owned boolean[]; k integer; v_mult numeric;
  v_mut text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_request is null or jsonb_typeof(p_actions) is distinct from 'array'
     or jsonb_array_length(p_actions) not between 1 and 60 then
    raise exception 'Invalid farm request';
  end if;
  perform public.arena_farm_ensure(me);
  -- One request at a time per farm.
  select * into f from public.arena_farms where player_id = me for update;
  insert into public.arena_farm_requests(player_id, request) values (me, p_request) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then
    return jsonb_build_object('farm', public.arena_farm_state(me), 'results', '[]'::jsonb, 'repeated', true);
  end if;
  delete from public.arena_farm_requests where player_id = me and created_at < t - interval '2 days';
  for a in select * from jsonb_array_elements(p_actions) loop
    i = i + 1; err = null; gained = null;
    kind = a->>'a';
    plot = case when jsonb_typeof(a->'plot') = 'number' then (a->>'plot')::integer else null end;
    p = null;
    if plot is not null and plot between 0 and 49 then
      select * into p from public.arena_farm_plots where player_id = me and idx = plot for update;
    end if;
    select * into f from public.arena_farms where player_id = me;
    if kind in ('plant', 'water', 'fertilize', 'harvest', 'dig', 'buy-land') and p.idx is null then
      err = 'Unknown plot';
    elsif kind = 'plant' then
      select * into c from public.arena_farm_crops where id = a->>'crop';
      if not p.owned then err = 'Buy this plot first';
      elsif p.crop is not null then err = 'Something is already growing here';
      elsif c.id is null then err = 'Unknown crop';
      elsif c.level > f.level then err = 'Unlocks at farm level ' || c.level;
      else
        update public.arena_farm_seeds set qty = qty - 1 where player_id = me and crop = c.id and qty > 0;
        get diagnostics used = row_count;
        if used = 0 then err = 'Out of ' || c.name || ' seeds';
        else
          update public.arena_farm_plots set crop = c.id, planted_at = t, progress = 0, progress_at = t,
            wet = false, fertilizer = null, mutation = null where player_id = me and idx = plot;
        end if;
      end if;
    elsif kind = 'water' then
      g = public.arena_farm_growth(p, t);
      if p.crop is null or g >= 1 then err = 'Nothing growing here';
      elsif (public.arena_farm_sim(p, t)).wet then err = 'Already watered';
      else
        update public.arena_farm_plots set progress = g, progress_at = t, wet = true
         where player_id = me and idx = plot;
      end if;
    elsif kind = 'fertilize' then
      g = public.arena_farm_growth(p, t);
      if p.crop is null or g >= 1 then err = 'Nothing growing here';
      elsif a->>'kind' = 'super' then
        if f.level < 6 then err = 'Unlocks at farm level 6';
        elsif f.fert_super < 1 then err = 'Out of Super Fertilizer';
        else
          update public.arena_farms set fert_super = fert_super - 1 where player_id = me;
          update public.arena_farm_plots set progress = least(0.999, g + 0.5), progress_at = t
           where player_id = me and idx = plot;
        end if;
      elsif a->>'kind' in ('norm', 'gold') then
        if p.fertilizer is not null then err = 'This plot is already fertilized';
        elsif a->>'kind' = 'gold' and f.level < 24 then err = 'Unlocks at farm level 24';
        elsif (a->>'kind' = 'norm' and f.fert_norm < 1) or (a->>'kind' = 'gold' and f.fert_gold < 1) then
          err = 'Out of that fertilizer';
        else
          update public.arena_farms set fert_norm = fert_norm - case when a->>'kind' = 'norm' then 1 else 0 end,
            fert_gold = fert_gold - case when a->>'kind' = 'gold' then 1 else 0 end where player_id = me;
          update public.arena_farm_plots set progress = g, progress_at = t, fertilizer = a->>'kind'
           where player_id = me and idx = plot;
        end if;
      else err = 'Unknown fertilizer';
      end if;
    elsif kind = 'harvest' then
      g = public.arena_farm_growth(p, t);
      if p.crop is null then err = 'Nothing to harvest';
      elsif g < 1 then err = 'Not ripe yet';
      elsif (select coalesce(sum(b.qty), 0) from public.arena_farm_barn b where b.player_id = me) + 2
            > 80 + 40 * f.barn_upgrades then err = 'Your barn is full';
      else
        select * into c from public.arena_farm_crops where id = p.crop;
        v_mut = coalesce(public.arena_farm_mutation(me, p, (public.arena_farm_sim(p, t)).ripe_weather), '');
        insert into public.arena_farm_barn(player_id, crop, mutation, qty)
        values (me, p.crop, v_mut, 2)
        on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + 2;
        insert into public.arena_farm_harvests(player_id, crop, harvests) values (me, p.crop, 1)
        on conflict (player_id, crop) do update set harvests = public.arena_farm_harvests.harvests + 1;
        update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
          wet = false, fertilizer = null, mutation = null where player_id = me and idx = plot;
        harvested = harvested + 1;
        v_xp = v_xp + c.xp;
        gained = jsonb_build_object('crop', c.id, 'qty', 2, 'xp', c.xp, 'mutation', v_mut);
      end if;
    elsif kind = 'dig' then
      if p.crop is null then err = 'Nothing to dig up';
      else
        update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
          wet = false, fertilizer = null, mutation = null where player_id = me and idx = plot;
      end if;
    elsif kind = 'buy-seeds' then
      select * into c from public.arena_farm_crops where id = a->>'crop';
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else 1 end;
      r = public.arena_farm_restock(t);
      if c.id is null then err = 'Unknown crop';
      elsif n is null or n < 1 or n > 50 then err = 'Choose how many seeds';
      elsif c.level > f.level then err = 'Unlocks at farm level ' || c.level;
      else
        left_stock = public.arena_farm_stock(r, c.id, c.rarity) - coalesce((select b.qty from public.arena_farm_purchases b
          where b.player_id = me and b.restock = r and b.crop = c.id), 0);
        if n > left_stock then err = case when left_stock <= 0 then 'Sold out until the restock' else 'Only ' || left_stock || ' left' end;
        elsif not public.arena_spend_leaves(me, c.seed_cost * n, 'farm-seeds', p_request || ':' || i, d) then
          err = 'Not enough Gold Leaves';
        else
          insert into public.arena_farm_purchases(player_id, restock, crop, qty) values (me, r, c.id, n)
          on conflict (player_id, restock, crop) do update set qty = public.arena_farm_purchases.qty + n;
          insert into public.arena_farm_seeds(player_id, crop, qty) values (me, c.id, n)
          on conflict (player_id, crop) do update set qty = public.arena_farm_seeds.qty + n;
        end if;
      end if;
    elsif kind = 'buy-land' then
      k = f.land_bought;
      select array_agg(x.owned order by x.idx) into v_owned from public.arena_farm_plots x where x.player_id = me;
      if p.owned then err = 'You already own this plot';
      elsif k >= 35 then err = 'You own every plot';
      elsif not ((plot % 10 > 0 and v_owned[plot]) or (plot % 10 < 9 and v_owned[plot + 2])
                 or (plot >= 10 and v_owned[plot - 9]) or (plot < 40 and v_owned[plot + 11])) then
        err = 'You can only buy plots next to land you own';
      elsif f.level < public.arena_farm_land_level(k) then err = 'Needs farm level ' || public.arena_farm_land_level(k);
      elsif not public.arena_spend_leaves(me, public.arena_farm_land_price(k), 'farm-land', (k + 1)::text, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farm_plots set owned = true where player_id = me and idx = plot;
        update public.arena_farms set land_bought = land_bought + 1 where player_id = me;
        v_xp = v_xp + 10;
      end if;
    elsif kind = 'sell' then
      select * into c from public.arena_farm_crops where id = a->>'crop';
      n = case when jsonb_typeof(a->'qty') = 'number' then (a->>'qty')::integer else null end;
      if c.id is null then err = 'Unknown crop';
      elsif n is null or n < 1 or n > 10000 then err = 'Choose how many to sell';
      else
        update public.arena_farm_barn b set qty = b.qty - n
         where b.player_id = me and b.crop = c.id and b.mutation = coalesce(a->>'mutation', '') and b.qty >= n;
        get diagnostics used = row_count;
        if used = 0 then err = 'You don''t have that many';
        else
          select m.mult into v_mult from public.arena_farm_market(d, f.level, me) m where m.crop = c.id;
          cost = greatest(1, round(c.sell * coalesce(v_mult, 1)
            * public.arena_farm_mutation_mult(coalesce(a->>'mutation', ''))))::integer * n;
          perform public.arena_grant_leaves(me, cost, 'farm-sell', p_request || ':' || i, d);
          gained = jsonb_build_object('leaves', cost);
        end if;
      end if;
    elsif kind = 'buy-fertilizer' then
      cost = case a->>'kind' when 'norm' then 60 when 'super' then 90 when 'gold' then 200 else null end;
      if cost is null then err = 'Unknown fertilizer';
      elsif (a->>'kind' = 'super' and f.level < 6) or (a->>'kind' = 'gold' and f.level < 24) then
        err = 'Unlocks at farm level ' || case a->>'kind' when 'super' then 6 else 24 end;
      elsif not public.arena_spend_leaves(me, cost, 'farm-fertilizer', p_request || ':' || i, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farms set
          fert_norm = fert_norm + case when a->>'kind' = 'norm' then 3 else 0 end,
          fert_super = fert_super + case when a->>'kind' = 'super' then 1 else 0 end,
          fert_gold = fert_gold + case when a->>'kind' = 'gold' then 1 else 0 end
         where player_id = me;
      end if;
    elsif kind = 'upgrade-barn' then
      cost = 250 * (f.barn_upgrades + 1);
      if f.barn_upgrades >= 100 then err = 'Your barn is as big as it gets';
      elsif not public.arena_spend_leaves(me, cost, 'farm-barn', (f.barn_upgrades + 1)::text, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farms set barn_upgrades = barn_upgrades + 1 where player_id = me;
      end if;
    else
      err = 'Unknown action';
    end if;
    results = results || jsonb_build_array(case when err is null
      then jsonb_build_object('ok', true) || coalesce(gained, '{}'::jsonb)
      else jsonb_build_object('ok', false, 'error', err) end);
  end loop;
  -- A drag that harvests three or more plots earns a combo bonus.
  if harvested >= 3 then v_xp = v_xp + 3 * harvested; end if;
  perform public.arena_farm_add_xp(me, v_xp);
  return jsonb_build_object('farm', public.arena_farm_state(me), 'results', results,
    'combo', case when harvested >= 3 then harvested else 0 end, 'xp', v_xp);
end; $$;
revoke all on function public.arena_farm_act_core(uuid, jsonb) from public, anon, authenticated, service_role;

-- Farm actions: the core, then any crop book reward the harvests earned.
create or replace function public.arena_farm_act(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare r jsonb; book jsonb;
begin
  r = public.arena_farm_act_core(p_request, p_actions);
  if coalesce((r->>'repeated')::boolean, false) then return r; end if;
  book = public.arena_farm_book_rewards(auth.uid());
  if jsonb_array_length(book) > 0 then
    r = r || jsonb_build_object('farm', public.arena_farm_state(auth.uid()), 'book', book);
  end if;
  return r;
end; $$;
revoke all on function public.arena_farm_act(uuid, jsonb) from public, anon;
grant execute on function public.arena_farm_act(uuid, jsonb) to authenticated;

-- The farm state: the core, the orders, and the crop book rewards paid.
create or replace function public.arena_farm_state(pid uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select public.arena_farm_state_core(pid) || jsonb_build_object(
    'orders', coalesce((select jsonb_agg(jsonb_build_object('slot', o.slot, 'items', o.items,
        'leaves', o.leaves, 'xp', o.xp, 'bonus', o.bonus, 'who', o.who, 'face', o.face,
        'waitUntil', o.wait_until) order by o.slot)
      from public.arena_farm_orders o where o.player_id = pid), '[]'::jsonb),
    'bookRewards', coalesce((select jsonb_agg(b.found order by b.found)
      from public.arena_farm_book_rewards b where b.player_id = pid), '[]'::jsonb))
$$;
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;

-- Crop book rewards already earned before this migration are paid now.
do $$
declare pid uuid;
begin
  for pid in select distinct player_id from public.arena_farm_harvests loop
    perform public.arena_farm_book_rewards(pid);
  end loop;
end $$;
commit;

select to_regprocedure('public.arena_farm_book_rewards(uuid)') is not null as crop_book_rewards_enabled;

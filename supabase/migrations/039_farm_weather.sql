-- Hub redesign, phase 5a: farm weather and mutations.
-- Run after 038_plaza.sql. Safe to run again.
--  * Weather changes every 4 hours on the UTC clock (0:00, 4:00, …), the
--    same for everyone, with the next two windows as the forecast:
--    Sunny 30 (grow ×1.1), Rain 22 (waters every growing crop), Thunderstorm
--    14, Moonlit Night 14, Frost 12 (grow ×0.85), Rainbow 8.
--  * Growth is worked out window by window, so the weather while a crop
--    grows sets when it ripens.
--  * When a crop ripens it may mutate, by the weather at that moment: Gold
--    3% (Gold Fertilizer ×3, Rainbow weather ×3), Rainbow 0.5% (Rainbow
--    weather ×10); and Shocked 25% in a storm, Moonlit 25% on a moonlit
--    night, Frozen 25% in frost, Wet 30% in rain. Mutations multiply the
--    sell price: Gold ×5, Rainbow ×15, Shocked ×3, Moonlit ×2.5, Frozen ×2,
--    Wet ×1.5.
--  * The rolls come from a secret salt, so nobody can work out a lucky
--    moment to plant.
begin;

create table if not exists public.arena_farm_salt (
  id integer primary key default 1 check (id = 1),
  salt text not null
);
insert into public.arena_farm_salt(id, salt)
values (1, md5(random()::text || clock_timestamp()::text || random()::text))
on conflict (id) do nothing;
-- Tests (or an operator) can pin the weather; normally this table is empty.
-- 'none' means no weather and no mutations at all (for tests of growth).
create table if not exists public.arena_farm_weather_pin (
  id integer primary key default 1 check (id = 1),
  weather text not null check (weather in ('none', 'sun', 'rain', 'storm', 'moon', 'frost', 'rainbow'))
);
alter table public.arena_farm_salt enable row level security;
alter table public.arena_farm_weather_pin enable row level security;
revoke all on public.arena_farm_salt, public.arena_farm_weather_pin
  from public, anon, authenticated, service_role;

-- The 4-hour weather window a moment falls in.
create or replace function public.arena_farm_slot(at timestamptz) returns bigint
language sql immutable set search_path = '' as $$
  select floor(extract(epoch from at) / 14400)::bigint
$$;
create or replace function public.arena_farm_weather(p_slot bigint) returns text
language sql stable security definer set search_path = public as $$
  select coalesce((select weather from public.arena_farm_weather_pin where id = 1),
    case when h < 30 then 'sun' when h < 52 then 'rain' when h < 66 then 'storm'
      when h < 80 then 'moon' when h < 92 then 'frost' else 'rainbow' end)
  from (select floor(100 * public.arena_farm_hash('weather:' || p_slot))::integer as h) x
$$;
create or replace function public.arena_farm_weather_speed(w text) returns double precision
language sql immutable set search_path = '' as $$
  select case w when 'sun' then 1.1 when 'frost' then 0.85 else 1 end::double precision
$$;
-- A secret number in [0, 1) for one planting.
create or replace function public.arena_farm_roll(pid uuid, p_idx integer, p_planted timestamptz, p_tag text)
returns double precision
language sql stable security definer set search_path = public as $$
  select public.arena_farm_hash((select salt from public.arena_farm_salt where id = 1)
    || ':' || pid || ':' || p_idx || ':' || extract(epoch from p_planted) || ':' || p_tag)
$$;

-- A plot's growth up to a moment, window by window: growth 0–1, whether it
-- is wet (watered, or rained on since planting), and when it ripened (or
-- will ripen, if `upto` is far enough ahead) with the weather then.
create or replace function public.arena_farm_sim(p public.arena_farm_plots, upto timestamptz,
  out g double precision, out wet boolean, out ripe_at timestamptz, out ripe_weather text)
language plpgsql stable set search_path = public as $$
declare at timestamptz; base double precision; s bigint; w text; seg_end timestamptz;
  rate double precision; need double precision; steps integer = 0;
begin
  if p.crop is null then g = 0; wet = false; return; end if;
  base = (case when p.fertilizer is not null then 1.4 else 1 end)
    / (select grow_seconds from public.arena_farm_crops where id = p.crop)::double precision;
  g = p.progress; at = p.progress_at;
  wet = p.wet or exists (select 1 from generate_series(public.arena_farm_slot(p.planted_at),
    public.arena_farm_slot(p.progress_at)) x where public.arena_farm_weather(x) = 'rain');
  if g >= 1 then
    g = 1; ripe_at = p.progress_at; ripe_weather = public.arena_farm_weather(public.arena_farm_slot(at));
    return;
  end if;
  loop
    s = public.arena_farm_slot(at);
    w = public.arena_farm_weather(s);
    if w = 'rain' then wet = true; end if;
    seg_end = to_timestamp((s + 1) * 14400);
    rate = base * (case when wet then 1.35 else 1 end) * public.arena_farm_weather_speed(w);
    need = (1 - g) / rate;
    if at + make_interval(secs => need) <= least(seg_end, upto) then
      g = 1; ripe_at = at + make_interval(secs => need); ripe_weather = w;
      return;
    end if;
    if seg_end >= upto then
      g = least(1, g + rate * greatest(0, extract(epoch from (upto - at))));
      return;
    end if;
    g = g + rate * extract(epoch from (seg_end - at));
    at = seg_end;
    steps = steps + 1;
    if steps > 1000 then return; end if;
  end loop;
end; $$;
-- Growth 0–1 at a moment, and when the crop ripens (weather included).
create or replace function public.arena_farm_growth(p public.arena_farm_plots, at timestamptz) returns double precision
language sql stable set search_path = public as $$
  select (public.arena_farm_sim(p, at)).g
$$;
create or replace function public.arena_farm_ripe_at(p public.arena_farm_plots) returns timestamptz
language sql stable set search_path = public as $$
  select case when p.crop is null then null
    else (public.arena_farm_sim(p, p.progress_at + interval '90 days')).ripe_at end
$$;
-- The mutations a ripe crop has: '' or names joined by '+', sorted.
create or replace function public.arena_farm_mutation(pid uuid, p public.arena_farm_plots, w text) returns text
language plpgsql stable set search_path = public as $$
declare gold double precision; rb double precision; r1 double precision; r2 double precision;
  m1 text; m2 text; wm text; wp double precision;
begin
  -- 'none' is the pinned no-weather of tests: no mutations at all.
  if p.crop is null or w is null or w = 'none' then return ''; end if;
  gold = 0.03 * (case when p.fertilizer = 'gold' then 3 else 1 end) * (case when w = 'rainbow' then 3 else 1 end);
  rb = 0.005 * (case when w = 'rainbow' then 10 else 1 end);
  r1 = public.arena_farm_roll(pid, p.idx, p.planted_at, 'luck');
  r2 = public.arena_farm_roll(pid, p.idx, p.planted_at, 'weather');
  m1 = case when r1 < rb then 'rainbow' when r1 < rb + gold then 'gold' end;
  wm = case w when 'storm' then 'shock' when 'moon' then 'moon' when 'frost' then 'frost' when 'rain' then 'wet' end;
  wp = case w when 'rain' then 0.3 else 0.25 end;
  if wm is not null and r2 < wp then m2 = wm; end if;
  return array_to_string(array(select x from unnest(array[m1, m2]) x where x is not null order by x collate "C"), '+');
end; $$;
-- The sell price multiplier of a mutation key.
create or replace function public.arena_farm_mutation_mult(p_key text) returns double precision
language sql immutable set search_path = '' as $$
  select coalesce(exp(sum(ln(case m when 'gold' then 5 when 'rainbow' then 15 when 'shock' then 3
    when 'moon' then 2.5 when 'frost' then 2 when 'wet' then 1.5 else 1 end))), 1)
  from unnest(string_to_array(nullif(p_key, ''), '+')) m
$$;
revoke all on function public.arena_farm_slot(timestamptz), public.arena_farm_weather(bigint),
  public.arena_farm_weather_speed(text), public.arena_farm_roll(uuid, integer, timestamptz, text),
  public.arena_farm_sim(public.arena_farm_plots, timestamptz),
  public.arena_farm_growth(public.arena_farm_plots, timestamptz),
  public.arena_farm_ripe_at(public.arena_farm_plots),
  public.arena_farm_mutation(uuid, public.arena_farm_plots, text),
  public.arena_farm_mutation_mult(text)
  from public, anon, authenticated, service_role;

-- The farm state now carries the weather, wetness from rain and mutations.
create or replace function public.arena_farm_state(pid uuid) returns jsonb
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
revoke all on function public.arena_farm_state(uuid) from public, anon, authenticated, service_role;

-- Actions: rain counts as watered, harvests keep their mutation, and
-- mutations multiply the sell price.
create or replace function public.arena_farm_act(p_request uuid, p_actions jsonb) returns jsonb
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
revoke all on function public.arena_farm_act(uuid, jsonb) from public, anon;
grant execute on function public.arena_farm_act(uuid, jsonb) to authenticated;
commit;

select public.arena_farm_weather(public.arena_farm_slot(now())) as weather_now,
  to_regprocedure('public.arena_farm_sim(public.arena_farm_plots, timestamptz)') is not null as weather_growth_enabled;

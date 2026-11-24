-- Mutated crops sell for the price the Market shows. Run after 055.
--
-- The sell price is one rounding after every multiplier: sell × market ×
-- mutation (packages/shared/src/farm.ts; the client's Market works it out with
-- Math.round). The server paid one Gold Leaf less whenever that came out at
-- exactly .5. For example, wheat (5) Shocked (×3) on a ×1.50 day is 22.5: the
-- Market showed 23, and the server paid 22. There were two causes:
--   - arena_farm_mutation_mult multiplied with exp(sum(ln(…))), so ×3 came
--     out as 2.9999999999999996 (or …0004);
--   - the price was a double, which round() takes half to even (22.5 → 22).
-- The multiplier is now exact. Every product of 5, 15, 3, 2.5, 2 and 1.5 is a
-- double with no error, so its type stays (an earlier file re-run after this
-- one still applies). The price is worked out in numeric by
-- arena_farm_sell_price, which rounds half away from zero, as Math.round does
-- for positive prices. arena_farm_act_core is copied from 044_farm_tools.sql
-- with only its sell price read through that function.
begin;

create or replace function public.arena_farm_mutation_mult(p_key text) returns double precision
language sql immutable set search_path = '' as $$
  -- Products of these have at most four decimals: rounding to six removes the
  -- logarithms' error and nothing else.
  select coalesce(round(exp(sum(ln(case m when 'gold' then 5 when 'rainbow' then 15 when 'shock' then 3
    when 'moon' then 2.5 when 'frost' then 2 when 'wet' then 1.5 else 1 end::numeric))), 6)::double precision, 1)
  from unnest(string_to_array(nullif(p_key, ''), '+')) m
$$;
revoke all on function public.arena_farm_mutation_mult(text) from public, anon, authenticated, service_role;

-- What one crop sells for: at least 1 Gold Leaf.
create or replace function public.arena_farm_sell_price(p_sell integer, p_mult numeric, p_mutation text)
returns integer
language sql immutable set search_path = '' as $$
  select greatest(1, round(p_sell * coalesce(p_mult, 1)
    * public.arena_farm_mutation_mult(coalesce(p_mutation, ''))::numeric))::integer
$$;
revoke all on function public.arena_farm_sell_price(integer, numeric, text)
  from public, anon, authenticated, service_role;

-- As in 044_farm_tools.sql, with the sell price from arena_farm_sell_price.
create or replace function public.arena_farm_act_core(p_request uuid, p_actions jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); t timestamptz = now(); d date = public.arena_today();
  f public.arena_farms; a jsonb; i integer = 0; kind text; plot integer; p public.arena_farm_plots;
  q public.arena_farm_plots; j integer; s record;
  c public.arena_farm_crops; g double precision; n integer; cost integer; used integer;
  results jsonb = '[]'::jsonb; err text; gained jsonb; harvested integer = 0; v_xp integer = 0;
  inserted integer; r bigint; left_stock integer; v_owned boolean[]; k integer; v_mult numeric;
  v_mut text; v_size integer; v_plots jsonb; v_tool text; v_level integer; v_yield integer;
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
    if kind in ('plant', 'water', 'fertilize', 'harvest', 'dig', 'buy-land', 'catch') and p.idx is null then
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
          -- Sprinklers water rows from the top: row 1 with the first, and so on.
          update public.arena_farm_plots set crop = c.id, planted_at = t, progress = 0, progress_at = t,
            wet = plot / 10 < f.sprinklers, fertilizer = null, mutation = null, pests = 0
           where player_id = me and idx = plot;
        end if;
      end if;
    elsif kind = 'water' then
      -- The can you own sets the area: one plot, three in a row, or 3×3.
      n = 0; v_plots = '[]'::jsonb;
      for j in select * from public.arena_farm_area(plot, f.can_level) loop
        select * into q from public.arena_farm_plots where player_id = me and idx = j for update;
        if not q.owned or q.crop is null then continue; end if;
        select * into s from public.arena_farm_sim(q, t);
        if s.g >= 1 or s.wet then continue; end if;
        update public.arena_farm_plots set progress = s.g, progress_at = t, wet = true
         where player_id = me and idx = j;
        n = n + 1; v_plots = v_plots || to_jsonb(j);
      end loop;
      if n = 0 then
        g = public.arena_farm_growth(p, t);
        err = case when p.crop is null or g >= 1 then 'Nothing growing here' else 'Already watered' end;
      else gained = jsonb_build_object('watered', v_plots);
      end if;
    elsif kind = 'catch' then
      -- A hand catches one bug; the Big Net one on every plot of a 3×3.
      v_size = case when a->>'tool' = 'net' and f.big_net then 3 else 1 end;
      n = 0;
      for j in select * from public.arena_farm_area(plot, v_size) loop
        select * into q from public.arena_farm_plots where player_id = me and idx = j for update;
        if q.pests > 0 then
          perform public.arena_farm_set_pests(me, j, q.pests - 1, t);
          perform public.arena_farm_caught(me, j);
          n = n + 1;
        end if;
      end loop;
      if n = 0 then err = 'No bugs here';
      else
        v_xp = v_xp + n;
        gained = jsonb_build_object('caught', n, 'xp', n);
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
      -- By hand one plot; with the Sickle every ripe plot of a 3×3.
      v_size = case when a->>'tool' = 'sickle' then 3 else 1 end;
      if v_size = 3 and not f.sickle then err = 'Buy the Sickle first';
      else
        n = 0; v_plots = '[]'::jsonb;
        for j in select * from public.arena_farm_area(plot, v_size) loop
          select * into q from public.arena_farm_plots where player_id = me and idx = j for update;
          if q.crop is null then
            if v_size = 1 then err = 'Nothing to harvest'; end if;
            continue;
          end if;
          select * into s from public.arena_farm_sim(q, t);
          if s.g < 1 then
            if v_size = 1 then err = 'Not ripe yet'; end if;
            continue;
          end if;
          v_yield = public.arena_farm_yield(me, j);
          if (select coalesce(sum(b.qty), 0) from public.arena_farm_barn b where b.player_id = me) + v_yield
              > 80 + 40 * f.barn_upgrades then
            err = 'Your barn is full';
            exit;
          end if;
          select * into c from public.arena_farm_crops where id = q.crop;
          v_mut = coalesce(public.arena_farm_mutation(me, q, s.ripe_weather), '');
          insert into public.arena_farm_barn(player_id, crop, mutation, qty)
          values (me, q.crop, v_mut, v_yield)
          on conflict (player_id, crop, mutation) do update set qty = public.arena_farm_barn.qty + v_yield;
          insert into public.arena_farm_harvests(player_id, crop, harvests) values (me, q.crop, 1)
          on conflict (player_id, crop) do update set harvests = public.arena_farm_harvests.harvests + 1;
          update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
            wet = false, fertilizer = null, mutation = null, pests = 0 where player_id = me and idx = j;
          harvested = harvested + 1;
          v_xp = v_xp + c.xp;
          n = n + 1;
          v_plots = v_plots || jsonb_build_object('plot', j, 'crop', c.id, 'qty', v_yield, 'xp', c.xp, 'mutation', v_mut);
        end loop;
        if n > 0 then
          gained = case when v_size = 1 then (v_plots->0) - 'plot'
            else jsonb_build_object('harvested', v_plots, 'barnFull', err is not null) end;
          err = null;
        elsif err is null then err = 'Nothing ripe here';
        end if;
      end if;
    elsif kind = 'dig' then
      if p.crop is null then err = 'Nothing to dig up';
      else
        update public.arena_farm_plots set crop = null, planted_at = null, progress = 0, progress_at = null,
          wet = false, fertilizer = null, mutation = null, pests = 0 where player_id = me and idx = plot;
      end if;
    elsif kind = 'buy-tool' then
      v_tool = a->>'tool';
      cost = case v_tool when 'scarecrow' then 300 when 'can2' then 600 when 'net2' then 700
        when 'sickle' then 1200 when 'can3' then 4000
        when 'sprinkler' then (array[1500, 2200, 3000, 3800, 4500])[least(5, f.sprinklers + 1)] end;
      v_level = case v_tool when 'scarecrow' then 4 when 'can2' then 8 when 'net2' then 10
        when 'sickle' then 14 when 'can3' then 30
        when 'sprinkler' then (array[18, 26, 34, 42, 50])[least(5, f.sprinklers + 1)] end;
      if cost is null then err = 'Unknown tool';
      elsif (v_tool = 'scarecrow' and f.scarecrow) or (v_tool = 'can2' and f.can_level >= 2)
         or (v_tool = 'net2' and f.big_net) or (v_tool = 'sickle' and f.sickle)
         or (v_tool = 'can3' and f.can_level >= 3) then err = 'You already have it';
      elsif v_tool = 'sprinkler' and f.sprinklers >= 5 then err = 'Every row has a sprinkler';
      elsif v_tool = 'can3' and f.can_level < 2 then err = 'Buy the Copper Can first';
      elsif f.level < v_level then err = 'Unlocks at farm level ' || v_level;
      elsif not public.arena_spend_leaves(me, cost, 'farm-tool',
          case when v_tool = 'sprinkler' then 'sprinkler-' || (f.sprinklers + 1) else v_tool end, d) then
        err = 'Not enough Gold Leaves';
      else
        update public.arena_farms set
          scarecrow = scarecrow or v_tool = 'scarecrow',
          can_level = case v_tool when 'can2' then 2 when 'can3' then 3 else can_level end,
          big_net = big_net or v_tool = 'net2',
          sickle = sickle or v_tool = 'sickle',
          sprinklers = sprinklers + case when v_tool = 'sprinkler' then 1 else 0 end
         where player_id = me;
        gained = jsonb_build_object('tool', v_tool, 'cost', cost);
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
          cost = public.arena_farm_sell_price(c.sell, v_mult, coalesce(a->>'mutation', '')) * n;
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
      select x.err, x.gained, x.xp into err, gained, n
        from public.arena_farm_act_more(me, a, p_request || ':' || i, t, d) x;
      if err is null then v_xp = v_xp + coalesce(n, 0); end if;
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

commit;

-- Element Bistro: the time away is worked out fast enough. Run after
-- 105_bistro_all_recipes.sql. Safe to run again.
--
-- A big bistro left for a full shift (8 hours) took about 15 seconds to
-- catch up, past the 8 seconds a player's request may run: every load was
-- cancelled, so the bistro was never brought up to date and could not open
-- again ("Can't reach the bistro"). Now:
--   - while away the bistro is worked out in 60-second steps (15 seconds
--     before; online it stays 15). simulateAway in packages/shared/src/bistro.ts
--     takes the same steps;
--   - the waiters' speed perk is looked up once, not at every step;
--   - the cooks' turn is skipped while every cook's stove is busy and nothing
--     on it is done (it would change nothing);
--   - the guests of a step are served in memory (the fullest slot first, the
--     serving taken from the first slot with that dish, as before), and the
--     counter, the coins, the guests served and the XP are written once a step.

begin;

-- The crew's pace without the room's perks (arena_bistro_pace adds them).
create or replace function public.arena_bistro_crew(pid uuid, p_role text, ms double precision, p_corners integer)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare s public.arena_bistro_staff; total double precision = 0;
begin
  for s in select * from public.arena_bistro_staff where player_id = pid and role = p_role order by id loop
    total = total + public.arena_bistro_work_speed(s.level, s.friend_id is not null,
      public.arena_bistro_energy(s, ms, p_corners));
  end loop;
  return total;
end; $$;
revoke all on function public.arena_bistro_crew(uuid, text, double precision, integer) from public, anon, authenticated, service_role;
create or replace function public.arena_bistro_pace(pid uuid, p_role text, ms double precision, p_corners integer)
returns double precision language plpgsql stable security definer set search_path = public as $$
declare total double precision = public.arena_bistro_crew(pid, p_role, ms, p_corners);
begin
  -- Serving carts and the like make the waiters faster (rateFrom does the same).
  if p_role = 'waiter' then
    total = total * (1::float8 + public.arena_bistro_perk(pid, 'speed')::float8 / 100::float8);
  end if;
  return total;
end; $$;
revoke all on function public.arena_bistro_pace(uuid, text, double precision, integer) from public, anon, authenticated, service_role;

create or replace function public.arena_bistro_catch_up(pid uuid, t timestamptz) returns void
language plpgsql security definer set search_path = public as $$
declare b public.arena_bistros; v_from timestamptz; v_end timestamptz; tt timestamptz; ev jsonb;
  rate double precision; acc double precision = 0; v_dish text; v_price integer;
  v_special text; bill integer; v_served integer = 0; v_coins integer = 0; v_spent integer = 0; v_batches integer = 0;
  lv integer = 0; away boolean; cap interval; step interval;
  p record; corners integer; secs double precision; ms double precision; served_now integer;
  v_trash integer; dirt double precision = 0; sweep double precision = 0; jr double precision;
  v_speed double precision; n_stoves integer; n_cooks integer; v_next timestamptz; v_idle boolean; v_due timestamptz;
  prices jsonb = '{}'::jsonb; c_slot integer[]; c_dish text[]; c_n integer[]; c_was integer[];
  i integer; best integer; step_coins integer;
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
  step = case when away then interval '60 seconds' else interval '15 seconds' end;
  cap = make_interval(hours => (array[2, 4, 6, 8])[b.shift_lv + 1]);
  v_end = case when away then least(t, v_from + cap) else t end;
  select * into p from public.arena_bistro_service_parts(pid);
  corners = public.arena_bistro_corners(pid);
  v_speed = 1::float8 + public.arena_bistro_perk(pid, 'speed')::float8 / 100::float8;
  v_trash = b.trash;
  v_special = public.arena_bistro_special(b.level, public.arena_today());
  select count(*) into n_stoves from public.arena_bistro_stoves where player_id = pid;
  select count(*) into n_cooks from public.arena_bistro_staff where player_id = pid and role = 'cook';
  -- A plate's price by dish (dish levels and stars don't change while away).
  select coalesce(jsonb_object_agg(d.id, public.arena_bistro_price_at(d.price, public.arena_bistro_lv(pid, d.id), b.stars)), '{}'::jsonb)
    into prices from public.arena_bistro_dishes d;
  v_next = v_from;
  tt = v_from;
  while tt < v_end loop
    -- The cooks: only when a stove of theirs is free or a dish on one is done.
    if n_cooks > 0 and tt >= v_next then
      ev = public.arena_bistro_kitchen(pid, tt, v_from);
      v_batches = v_batches + (ev->>'plated')::integer;
      v_spent = v_spent + (ev->>'spent')::integer;
      lv = lv + (ev->>'levels')::integer;
      select bool_or(dish is null), min(started_at + make_interval(secs => dur_ms / 1000.0))
        into v_idle, v_due
        from public.arena_bistro_stoves
       where player_id = pid and idx >= n_stoves - n_cooks;
      v_next = case when v_idle or v_due is null then tt + step else v_due end;
    end if;
    if away then
      secs = least(extract(epoch from step), extract(epoch from v_end - tt));
      ms = extract(epoch from tt - v_from) * 1000;
      -- The waiters' pace now (tired from the work since v_from).
      rate = least(p.arrivals, p.seat_rate, case when p.seats > 0
        then public.arena_bistro_crew(pid, 'waiter', ms, corners) * v_speed / (p.t_meal + p.clear) else 0::float8 end);
      acc = acc + rate * public.arena_bistro_away_rate(ms) * secs;
      served_now = 0;
      step_coins = 0;
      if acc >= 1 then
        select array_agg(slot order by slot), array_agg(dish order by slot), array_agg(servings order by slot)
          into c_slot, c_dish, c_n
          from public.arena_bistro_counter where player_id = pid;
        c_was = c_n;
        while acc >= 1 loop
          -- The fullest slot's dish (the first slot on a tie)...
          best = null;
          for i in 1..coalesce(array_length(c_slot, 1), 0) loop
            if c_dish[i] is not null and c_n[i] > 0 and (best is null or c_n[i] > c_n[best]) then best = i; end if;
          end loop;
          if best is null then acc = least(acc, 1); exit; end if;
          v_dish = c_dish[best];
          -- ...taken from the first slot holding it (as arena_bistro_take).
          for i in 1..array_length(c_slot, 1) loop
            if c_dish[i] = v_dish and c_n[i] > 0 then
              c_n[i] = c_n[i] - 1;
              exit;
            end if;
          end loop;
          v_price = (prices->>v_dish)::integer;
          bill = public.arena_bistro_pay(v_price, v_dish = v_special, false, 1, 2, false, false);
          step_coins = step_coins + bill;
          served_now = served_now + 1;
          acc = acc - 1;
        end loop;
        for i in 1..coalesce(array_length(c_slot, 1), 0) loop
          if c_n[i] is distinct from c_was[i] then
            if c_n[i] <= 0 then
              update public.arena_bistro_counter set dish = null, servings = 0, perfect = false
               where player_id = pid and slot = c_slot[i];
            else
              update public.arena_bistro_counter set servings = c_n[i] where player_id = pid and slot = c_slot[i];
            end if;
          end if;
        end loop;
        if served_now > 0 then
          update public.arena_bistros set coins = coins + step_coins, served = served + served_now where player_id = pid;
          v_coins = v_coins + step_coins;
          v_served = v_served + served_now;
          lv = lv + public.arena_bistro_add_xp(pid, served_now);
        end if;
      end if;
      -- Litter from the guests; the janitors sweep it up.
      dirt = dirt + 0.08::float8 * served_now;
      while dirt >= 1 loop
        v_trash = least(10, v_trash + 1);
        dirt = dirt - 1;
      end loop;
      jr = public.arena_bistro_crew(pid, 'janitor', ms, corners);
      sweep = sweep + ((jr * 30::float8) / 3600::float8) * secs;
      while sweep >= 1 and v_trash > 0 loop
        v_trash = v_trash - 1;
        sweep = sweep - 1;
      end loop;
      if v_trash = 0 then sweep = least(sweep, 1::float8); end if;
    end if;
    tt = tt + step;
  end loop;
  -- Online, the cooks' latest turn is now, as the scene shows it, and not the
  -- last step (the time of the request before): a dish done since then is
  -- plated and the next one started now.
  if not away then
    ev = public.arena_bistro_kitchen(pid, t, v_from);
    lv = lv + (ev->>'levels')::integer;
  end if;
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

commit;

select position('arena_bistro_crew' in pg_get_functiondef('public.arena_bistro_catch_up(uuid,timestamptz)'::regprocedure)) > 0
  as bistro_fast_catch_up;

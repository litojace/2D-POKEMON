-- Element Bistro, part 6: the cooks' stoves stay in step. Run after
-- 100_bistro_long_term.sql. Safe to run again.
--
-- While you play, the scene runs the cooks as of now; the server ran them as
-- of the request before (its 15-second steps start there). So each answer
-- (every guest's coins) took back a dish a cook had just plated and started,
-- and the pot flickered until the scene did it again. Online, the server now
-- also gives the cooks their turn at the time of the request.
begin;

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
  -- Online, the cooks' latest turn is now, as the scene shows it, and not the
  -- last 15-second step (the time of the request before): a dish done since
  -- then is plated and the next one started now.
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

select position('Online, the cooks' in pg_get_functiondef('public.arena_bistro_catch_up(uuid,timestamptz)'::regprocedure)) > 0
  as bistro_cooks_in_step;

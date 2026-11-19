-- Remove the Farm and the Bistro, and retire Gold Leaves (owner's decision,
-- Nov 2026: Element Arena focuses on PvP; the Bistro's code lives on in its
-- own repository, litojace/bistro-street).
--
-- What this deletes for good:
--   * every Farm table (the arena_farm* tables and arena_farms) and the 110
--     arena_farm* functions;
--   * every Bistro table (the arena_bistro* tables, arena_bistros and
--     arena_bistro_farm_sent) and the 75 arena_bistro* functions. Bistro coin
--     balances go with them: they are not converted;
--   * the Gold Leaves wallet and ledger (arena_leaf_wallets,
--     arena_leaf_ledger) and their four functions, AFTER every leaf balance
--     is paid out once in shop coins at the old rate (100 leaves -> 5 coins).
-- What it keeps: accounts, shop coins (arena_wallets, arena_coin_ledger),
-- the Plaza, and everything else. No table outside these has a foreign key
-- into them, no view or outside trigger uses them, so nothing is dropped
-- with CASCADE.
--
-- Order (the owner's): pay coins for leaves -> re-create the functions that
-- stay -> drop the Farm, Bistro and leaf functions -> drop the tables.
--   0. earned Farm titles stay, worded as history;
--   1. leaves -> coins, once (coin ledger reason 'leaf-retire'); today's Plaza
--      quest and orb records move off the leaf ledger;
--   2. the Plaza without leaves: quests pay coins, orbs pay nothing directly,
--      Volt Boba is free, treats are a free daily allowance (they were Farm
--      crops); arena_economy() without 'leaves';
--   3. drop the functions (all but the Farm's three trigger functions);
--   4. drop the tables, in one statement (their triggers, indexes and
--      sequences go with them);
--   5. drop the three trigger functions.
-- Every step is safe to run again, and it all runs in one transaction: if
-- anything fails, nothing changes.

begin;

-- 0. Farm titles stay with the players who earned them (arena_titles is not a
--    Farm table, and titles show only to their owners), but they can't be
--    earned any more, so their descriptions say what was done, not a goal.
--    Only the original wording is changed: an admin's edit is left alone.
update public.arena_titles t set description = v.now
  from (values
    ('Green Thumb', 'Reach farm level 25.', 'Reached farm level 25 while the Farm was open.'),
    ('Master Grower', 'Reach farm level 50.', 'Reached farm level 50 while the Farm was open.'),
    ('Harvest Legend', 'Reach farm level 75.', 'Reached farm level 75 while the Farm was open.'),
    ('Elemental Farmer', 'Reach farm level 100.', 'Reached farm level 100 while the Farm was open.'),
    ('Elemental Botanist', 'Find all 25 crops in the farm''s crop book.',
      'Found all 25 crops in the crop book while the Farm was open.')
  ) v(name, was, now)
 where t.name = v.name and t.description = v.was;

-- 1. Gold Leaves -> shop coins, once per player, before anything is dropped.
--    coins = floor(balance * 5 / 100); a share of 0 pays nothing. The coin
--    ledger is unique on (player, reason, ref), so arena_grant pays each
--    player at most once even if this ran again with the wallets still here;
--    once the wallets are gone, this step is skipped.
--    Today's Plaza quests already paid in leaves, and today's caught orbs,
--    are carried over, so nobody is paid twice today or catches more than
--    the daily cap.
alter table public.arena_plaza_days add column if not exists paid text[] not null default '{}';
create table if not exists public.arena_plaza_orbs (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  ref text not null,
  day date not null,
  primary key (player_id, ref)
);
create index if not exists arena_plaza_orbs_day on public.arena_plaza_orbs(player_id, day);
alter table public.arena_plaza_orbs enable row level security;
revoke all on public.arena_plaza_orbs from public, anon, authenticated;

do $$
begin
  if to_regclass('public.arena_leaf_wallets') is not null then
    perform public.arena_grant(w.player_id, (w.balance * 5 / 100)::integer, 'leaf-retire', 'leaf-retire',
        public.arena_today())
      from public.arena_leaf_wallets w
     where w.balance * 5 / 100 > 0;
  end if;
  if to_regclass('public.arena_leaf_ledger') is not null then
    insert into public.arena_plaza_days(player_id, day)
    select distinct l.player_id, l.day from public.arena_leaf_ledger l
     where l.reason = 'plaza-quest' and l.day = public.arena_today()
    on conflict do nothing;
    update public.arena_plaza_days t set paid = (
        select coalesce(array_agg(distinct x order by x), '{}') from unnest(t.paid || q.ids) x)
      from (select l.player_id, array_agg(split_part(l.ref, ':', 2)) ids from public.arena_leaf_ledger l
             where l.reason = 'plaza-quest' and l.day = public.arena_today() group by l.player_id) q
     where t.player_id = q.player_id and t.day = public.arena_today();
    insert into public.arena_plaza_orbs(player_id, ref, day)
    select l.player_id, l.ref, l.day from public.arena_leaf_ledger l
     where l.reason = 'plaza-orb' and l.day = public.arena_today()
    on conflict do nothing;
  end if;
end $$;

-- 2. The Plaza without Gold Leaves (packages/shared/src/plaza.ts:
--    PLAZA_QUESTS' coins, PLAZA.treatsDaily, PLAZA_TREATS; the integration
--    test tests/integration/remove-farm-bistro-leaves.test.ts checks they
--    agree). The quests' reward column changes name, so the function is
--    dropped and made again (create or replace can't rename it).
drop function if exists public.arena_plaza_quests();
create function public.arena_plaza_quests() returns table(id text, needed integer, coins integer)
language sql immutable set search_path = public as $$
  values ('goal', 1, 2), ('lap', 1, 2), ('cheers', 15, 2), ('orbs', 10, 1), ('photo', 1, 1)
$$;
revoke all on function public.arena_plaza_quests() from public, anon, authenticated, service_role;

create or replace function public.arena_plaza_state(pid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare d date = public.arena_today(); w date = public.arena_plaza_week(public.arena_today()); t public.arena_plaza_days;
begin
  select * into t from public.arena_plaza_days where player_id = pid and day = d;
  return jsonb_build_object(
    'day', d,
    'quests', (select jsonb_object_agg(q.id, jsonb_build_object(
        'n', least(q.needed, case q.id when 'goal' then coalesce(t.goal, 0) when 'lap' then coalesce(t.lap, 0)
          when 'cheers' then coalesce(t.cheers, 0) when 'orbs' then coalesce(t.orbs, 0) else coalesce(t.photo, 0) end),
        'done', q.id = any(coalesce(t.paid, '{}'))))
      from public.arena_plaza_quests() q),
    'orbsToday', (select count(*) from public.arena_plaza_orbs o where o.player_id = pid and o.day = d),
    'bestLapMs', (select best_ms from public.arena_plaza_laps where player_id = pid and week = w),
    'board', coalesce((select jsonb_agg(jsonb_build_object('name', b.display_name, 'ms', b.best_ms, 'me', b.player_id = pid) order by b.best_ms, b.set_at)
      from (select l.player_id, l.best_ms, l.set_at, p.display_name from public.arena_plaza_laps l
        join public.arena_profiles p on p.id = l.player_id and not p.suspended
        where l.week = w order by l.best_ms, l.set_at limit 5) b), '[]'::jsonb));
end; $$;
revoke all on function public.arena_plaza_state(uuid) from public, anon, authenticated, service_role;

create or replace function public.arena_plaza_record(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  pid uuid; k text = p->>'kind'; v_ref text = p->>'ref'; d date = public.arena_today();
  ms integer; n integer; t public.arena_plaza_days; q record; have integer; inserted integer;
begin
  begin pid = (p->>'player')::uuid; exception when others then raise exception 'Bad player'; end;
  if pid is null or not exists (select 1 from public.arena_profiles where id = pid and not suspended) then
    return null;
  end if;
  insert into public.arena_plaza_days(player_id, day) values (pid, d) on conflict do nothing;
  -- One Plaza record at a time per player, so the caps hold.
  select * into t from public.arena_plaza_days where player_id = pid and day = d for update;
  if k = 'orb' then
    -- ref: "<shower start, in UTC minutes>-<orb id>". At most 50 a day and
    -- 10 a shower count; each orb once.
    if v_ref is null or v_ref !~ '^[0-9]{6,12}-[0-9]{1,9}$' then raise exception 'Bad orb'; end if;
    if (select count(*) from public.arena_plaza_orbs o where o.player_id = pid and o.day = d) < 50
       and (select count(*) from public.arena_plaza_orbs o
         where o.player_id = pid and o.ref like split_part(v_ref, '-', 1) || '-%') < 10 then
      insert into public.arena_plaza_orbs(player_id, ref, day) values (pid, v_ref, d) on conflict do nothing;
      get diagnostics inserted = row_count;
      if inserted > 0 then
        update public.arena_plaza_days set orbs = orbs + 1 where player_id = pid and day = d;
      end if;
    end if;
  elsif k = 'goal' then
    update public.arena_plaza_days set goal = 1 where player_id = pid and day = d;
  elsif k = 'photo' then
    update public.arena_plaza_days set photo = 1 where player_id = pid and day = d;
  elsif k = 'cheers' then
    n = least(15, greatest(0, coalesce((p->>'n')::integer, 0)));
    update public.arena_plaza_days set cheers = greatest(cheers, n) where player_id = pid and day = d;
  elsif k = 'lap' then
    ms = (p->>'ms')::integer;
    if ms is null or ms < 1000 or ms > 600000 then raise exception 'Bad lap'; end if;
    insert into public.arena_plaza_laps(player_id, week, best_ms) values (pid, public.arena_plaza_week(d), ms)
    on conflict (player_id, week) do update set best_ms = excluded.best_ms, set_at = now()
      where excluded.best_ms < public.arena_plaza_laps.best_ms;
    if ms < 30000 then update public.arena_plaza_days set lap = 1 where player_id = pid and day = d; end if;
  else
    raise exception 'Unknown Plaza event';
  end if;
  -- A quest done today pays its coins once.
  select * into t from public.arena_plaza_days where player_id = pid and day = d;
  for q in select * from public.arena_plaza_quests() loop
    have = case q.id when 'goal' then t.goal when 'lap' then t.lap when 'cheers' then t.cheers
      when 'orbs' then t.orbs else t.photo end;
    if have >= q.needed and not (q.id = any(t.paid)) then
      update public.arena_plaza_days set paid = paid || q.id where player_id = pid and day = d;
      perform public.arena_grant(pid, q.coins, 'plaza-quest', d::text || ':' || q.id, d);
    end if;
  end loop;
  return public.arena_plaza_state(pid);
end; $$;
revoke all on function public.arena_plaza_record(jsonb) from public, anon, authenticated;
grant execute on function public.arena_plaza_record(jsonb) to service_role;

-- Volt Boba is free now (the game server still keeps its cooldown).
create or replace function public.arena_plaza_boba(p_ref text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_ref is null or p_ref !~ '^[0-9a-f-]{36}$' then raise exception 'Bad request'; end if;
  return jsonb_build_object('ok', true);
end; $$;
revoke all on function public.arena_plaza_boba(text) from public, anon;
grant execute on function public.arena_plaza_boba(text) to authenticated;

-- Plaza treats: 10 a Pacific day, free. They used to be crops from the
-- Farm's barn.
create table if not exists public.arena_plaza_treat_days (
  player_id uuid not null references public.arena_profiles(id) on delete cascade,
  day date not null,
  thrown integer not null default 0 check (thrown between 0 and 10),
  last_request uuid,
  primary key (player_id, day)
);
alter table public.arena_plaza_treat_days enable row level security;
revoke all on public.arena_plaza_treat_days from public, anon, authenticated;

create or replace function public.arena_plaza_treats() returns integer
language plpgsql stable security definer set search_path = public as $$
declare me uuid = auth.uid();
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  return 10 - coalesce((select thrown from public.arena_plaza_treat_days
    where player_id = me and day = public.arena_today()), 0);
end; $$;

create or replace function public.arena_plaza_treat(p_ref uuid) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); r public.arena_plaza_treat_days; v_treat text;
begin
  if me is null or not exists (select 1 from public.arena_profiles where id = me and not suspended) then
    raise exception 'Login required';
  end if;
  if p_ref is null then raise exception 'Bad request'; end if;
  insert into public.arena_plaza_treat_days(player_id, day) values (me, d) on conflict do nothing;
  select * into r from public.arena_plaza_treat_days where player_id = me and day = d for update;
  if r.last_request = p_ref then
    return jsonb_build_object('ok', false, 'error', 'Already thrown', 'left', 10 - r.thrown);
  end if;
  if r.thrown >= 10 then
    return jsonb_build_object('ok', false, 'error', 'No treats left today. More tomorrow!', 'left', 0);
  end if;
  v_treat = (array['candy', 'cupcake', 'donut', 'lollipop', 'cookie'])[r.thrown % 5 + 1];
  update public.arena_plaza_treat_days set thrown = thrown + 1, last_request = p_ref
   where player_id = me and day = d;
  return jsonb_build_object('ok', true, 'treat', v_treat, 'left', 10 - r.thrown - 1);
end; $$;
revoke all on function public.arena_plaza_treats(), public.arena_plaza_treat(uuid) from public, anon;
grant execute on function public.arena_plaza_treats(), public.arena_plaza_treat(uuid) to authenticated;

-- The economy without 'leaves'.
create or replace function public.arena_economy() returns jsonb
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  e = public.arena_economy_before_journey();
  return e || jsonb_build_object(
    'journey', public.arena_journey(),
    'rerollsUsed', coalesce((select rerolls_used from public.arena_mission_days
      where player_id = auth.uid() and day = public.arena_today()), 0),
    'rerollLimit', 5);
end; $$;

-- 3. The Farm's, the Bistro's and Gold Leaves' functions (the Farm's three
--    trigger functions go after their tables, in step 5).
-- The Farm (107 of 110).
drop function if exists public.arena_farm();
drop function if exists public.arena_farm_act(uuid,jsonb);
drop function if exists public.arena_farm_act_core(uuid,jsonb);
drop function if exists public.arena_farm_act_decor(uuid,jsonb,text,timestamp with time zone,date);
drop function if exists public.arena_farm_act_extra(uuid,jsonb,text,timestamp with time zone,date);
drop function if exists public.arena_farm_act_extra_coop(uuid,jsonb,text,timestamp with time zone,date);
drop function if exists public.arena_farm_act_extra_pasture(uuid,jsonb,text,timestamp with time zone,date);
drop function if exists public.arena_farm_act_more(uuid,jsonb,text,timestamp with time zone,date);
drop function if exists public.arena_farm_act_prebakery(uuid,jsonb,text,timestamp with time zone,date);
drop function if exists public.arena_farm_act_spots(uuid,jsonb,text,timestamp with time zone,date);
drop function if exists public.arena_farm_add_xp(uuid,integer);
drop function if exists public.arena_farm_are_friends(uuid,uuid);
drop function if exists public.arena_farm_area(integer,integer);
drop function if exists public.arena_farm_balloon();
drop function if exists public.arena_farm_balloon_act(uuid,text,integer);
drop function if exists public.arena_farm_balloon_new(uuid);
drop function if exists public.arena_farm_balloon_refresh(uuid);
drop function if exists public.arena_farm_balloon_view(uuid);
drop function if exists public.arena_farm_bond_level(integer);
drop function if exists public.arena_farm_book_rewards(uuid);
drop function if exists public.arena_farm_bugs(uuid);
drop function if exists public.arena_farm_caught(uuid,integer);
drop function if exists public.arena_farm_charm(uuid);
drop function if exists public.arena_farm_charm_bonus(uuid);
drop function if exists public.arena_farm_crate_qty(text);
drop function if exists public.arena_farm_crate_value(jsonb);
drop function if exists public.arena_farm_decor_cap(integer);
drop function if exists public.arena_farm_decor_fits(uuid,text,integer,integer,bigint);
drop function if exists public.arena_farm_decor_seasons(date);
drop function if exists public.arena_farm_dog(uuid,timestamp with time zone);
drop function if exists public.arena_farm_dogs(uuid);
drop function if exists public.arena_farm_egg_mult(date);
drop function if exists public.arena_farm_ensure(uuid);
drop function if exists public.arena_farm_friend(uuid);
drop function if exists public.arena_farm_friend_act(uuid,uuid,jsonb);
drop function if exists public.arena_farm_friends();
drop function if exists public.arena_farm_giant_chance();
drop function if exists public.arena_farm_giant_roll(uuid,integer,timestamp with time zone[]);
drop function if exists public.arena_farm_giants(uuid,timestamp with time zone);
drop function if exists public.arena_farm_giants_json(uuid,timestamp with time zone);
drop function if exists public.arena_farm_gift_open(uuid);
drop function if exists public.arena_farm_gift_pick(uuid,uuid,date);
drop function if exists public.arena_farm_gift_send(uuid);
drop function if exists public.arena_farm_gifts();
drop function if exists public.arena_farm_gifts_state(uuid);
drop function if exists public.arena_farm_gone();
drop function if exists public.arena_farm_good_name(text);
drop function if exists public.arena_farm_growth(public.arena_farm_plots,timestamp with time zone);
drop function if exists public.arena_farm_harvest_giant(uuid,integer,timestamp with time zone);
drop function if exists public.arena_farm_hash(text);
drop function if exists public.arena_farm_help_fill(uuid,uuid,integer);
drop function if exists public.arena_farm_help_list();
drop function if exists public.arena_farm_help_list_for(uuid);
drop function if exists public.arena_farm_here(uuid,text);
drop function if exists public.arena_farm_here_view(uuid,uuid);
drop function if exists public.arena_farm_invite_claim(text);
drop function if exists public.arena_farm_invite_pay(uuid);
drop function if exists public.arena_farm_invites_counted(uuid);
drop function if exists public.arena_farm_land_level(integer);
drop function if exists public.arena_farm_land_price(integer);
drop function if exists public.arena_farm_like(uuid);
drop function if exists public.arena_farm_market(date,integer,uuid);
drop function if exists public.arena_farm_master(uuid,text);
drop function if exists public.arena_farm_milk_mult(date);
drop function if exists public.arena_farm_mutation(uuid,public.arena_farm_plots,text);
drop function if exists public.arena_farm_mutation_mult(text);
drop function if exists public.arena_farm_need(integer);
drop function if exists public.arena_farm_new_order(uuid,integer,integer);
drop function if exists public.arena_farm_new_order_crops(uuid,integer,integer);
drop function if exists public.arena_farm_new_order_prebakery(uuid,integer,integer);
drop function if exists public.arena_farm_order(uuid,integer,text);
drop function if exists public.arena_farm_order_crops(uuid,integer,text);
drop function if exists public.arena_farm_order_prebakery(uuid,integer,text);
drop function if exists public.arena_farm_orders_refresh(uuid);
drop function if exists public.arena_farm_paper_for(uuid);
drop function if exists public.arena_farm_party(uuid);
drop function if exists public.arena_farm_perk_of(text);
drop function if exists public.arena_farm_rate(public.arena_farm_plots);
drop function if exists public.arena_farm_rebase(uuid,timestamp with time zone);
drop function if exists public.arena_farm_restock(timestamp with time zone);
drop function if exists public.arena_farm_ripe_at(public.arena_farm_plots);
drop function if exists public.arena_farm_roll(uuid,integer,timestamp with time zone,text);
drop function if exists public.arena_farm_sell_price(integer,numeric,text);
drop function if exists public.arena_farm_set_pests(uuid,integer,integer,timestamp with time zone);
drop function if exists public.arena_farm_sim(public.arena_farm_plots,timestamp with time zone);
drop function if exists public.arena_farm_slot(timestamp with time zone);
drop function if exists public.arena_farm_stall();
drop function if exists public.arena_farm_stall_act(uuid,text,integer,text,text,integer,integer,uuid);
drop function if exists public.arena_farm_stall_view(uuid);
drop function if exists public.arena_farm_state(uuid);
drop function if exists public.arena_farm_state_core(uuid);
drop function if exists public.arena_farm_state_decor(uuid);
drop function if exists public.arena_farm_state_extra(uuid);
drop function if exists public.arena_farm_state_extra_pasture(uuid);
drop function if exists public.arena_farm_state_prebakery(uuid);
drop function if exists public.arena_farm_state_spots(uuid);
drop function if exists public.arena_farm_stock(bigint,text,text);
drop function if exists public.arena_farm_take(uuid,text,integer);
drop function if exists public.arena_farm_tour();
drop function if exists public.arena_farm_tour_for(uuid);
drop function if exists public.arena_farm_unit_price(uuid,text,text);
drop function if exists public.arena_farm_view(uuid,uuid);
drop function if exists public.arena_farm_view_pasture(uuid,uuid);
drop function if exists public.arena_farm_weather(bigint);
drop function if exists public.arena_farm_weather_speed(text);
drop function if exists public.arena_farm_wish();
drop function if exists public.arena_farm_yield(uuid,integer);
-- The Bistro (75).
drop function if exists public.arena_bistro();
drop function if exists public.arena_bistro_act(uuid,jsonb);
drop function if exists public.arena_bistro_add_ingredient(uuid,text,integer);
drop function if exists public.arena_bistro_add_xp(uuid,integer);
drop function if exists public.arena_bistro_after_rest(integer,double precision,double precision);
drop function if exists public.arena_bistro_after_work(text,double precision,double precision,integer);
drop function if exists public.arena_bistro_away_rate(double precision);
drop function if exists public.arena_bistro_blocked(uuid);
drop function if exists public.arena_bistro_catch_up(uuid,timestamp with time zone);
drop function if exists public.arena_bistro_clear_kitchen(uuid);
drop function if exists public.arena_bistro_cols(integer);
drop function if exists public.arena_bistro_cook_ms(integer,integer,integer);
drop function if exists public.arena_bistro_cook_ms(integer,integer,integer,double precision);
drop function if exists public.arena_bistro_corners(uuid);
drop function if exists public.arena_bistro_counter_add(uuid,text,integer);
drop function if exists public.arena_bistro_crew(uuid,text,double precision,integer);
drop function if exists public.arena_bistro_dined_today(uuid);
drop function if exists public.arena_bistro_dist(boolean[],integer,integer,integer[]);
drop function if exists public.arena_bistro_drain(text,integer);
drop function if exists public.arena_bistro_energy(public.arena_bistro_staff,double precision,integer);
drop function if exists public.arena_bistro_energy_max(integer);
drop function if exists public.arena_bistro_ensure(uuid);
drop function if exists public.arena_bistro_event(date);
drop function if exists public.arena_bistro_friend(uuid);
drop function if exists public.arena_bistro_friend_act(uuid,uuid,text);
drop function if exists public.arena_bistro_friends();
drop function if exists public.arena_bistro_gourmet(uuid);
drop function if exists public.arena_bistro_ingredient_name(text);
drop function if exists public.arena_bistro_kitchen(uuid,timestamp with time zone);
drop function if exists public.arena_bistro_kitchen(uuid,timestamp with time zone,timestamp with time zone);
drop function if exists public.arena_bistro_kitchen(uuid,timestamp with time zone,timestamp with time zone,timestamp with time zone);
drop function if exists public.arena_bistro_kitchen_x1(integer);
drop function if exists public.arena_bistro_likes_week(uuid);
drop function if exists public.arena_bistro_lv(uuid,text);
drop function if exists public.arena_bistro_market_price(timestamp with time zone,text);
drop function if exists public.arena_bistro_mood(double precision);
drop function if exists public.arena_bistro_near(integer[],boolean[],integer,integer,integer[],integer[]);
drop function if exists public.arena_bistro_need(integer);
drop function if exists public.arena_bistro_on_counter(uuid,text);
drop function if exists public.arena_bistro_orders_refresh(uuid,timestamp with time zone);
drop function if exists public.arena_bistro_pace(uuid,text,double precision,integer);
drop function if exists public.arena_bistro_pantry_qty(uuid,text);
drop function if exists public.arena_bistro_pay(integer,boolean,boolean,integer,integer,boolean,boolean);
drop function if exists public.arena_bistro_pay(integer,boolean,boolean,integer,integer,boolean,boolean,integer);
drop function if exists public.arena_bistro_perk(uuid,text);
drop function if exists public.arena_bistro_place_error(uuid,text,integer,integer,integer);
drop function if exists public.arena_bistro_plan_error(uuid);
drop function if exists public.arena_bistro_plate(uuid,integer,timestamp with time zone);
drop function if exists public.arena_bistro_points(uuid,integer);
drop function if exists public.arena_bistro_popularity(uuid);
drop function if exists public.arena_bistro_price_at(integer,integer);
drop function if exists public.arena_bistro_price_at(integer,integer,integer);
drop function if exists public.arena_bistro_reach(boolean[],integer,integer,integer,integer,integer,integer);
drop function if exists public.arena_bistro_recipe(text);
drop function if exists public.arena_bistro_return_aside(uuid,jsonb);
drop function if exists public.arena_bistro_rows(integer);
drop function if exists public.arena_bistro_rush(timestamp with time zone);
drop function if exists public.arena_bistro_seats(uuid);
drop function if exists public.arena_bistro_service_parts(uuid);
drop function if exists public.arena_bistro_service_rate(uuid);
drop function if exists public.arena_bistro_servings(uuid);
drop function if exists public.arena_bistro_special(integer,date);
drop function if exists public.arena_bistro_speed(integer);
drop function if exists public.arena_bistro_stars(uuid);
drop function if exists public.arena_bistro_start(uuid,integer,text,timestamp with time zone,integer);
drop function if exists public.arena_bistro_start(uuid,integer,text,timestamp with time zone,integer,double precision);
drop function if exists public.arena_bistro_state(uuid);
drop function if exists public.arena_bistro_state_base(uuid);
drop function if exists public.arena_bistro_state_coop(uuid);
drop function if exists public.arena_bistro_stove_speed(text);
drop function if exists public.arena_bistro_take(uuid,text);
drop function if exists public.arena_bistro_tokens_sync(uuid);
drop function if exists public.arena_bistro_view(uuid,uuid);
drop function if exists public.arena_bistro_walks(uuid);
drop function if exists public.arena_bistro_work_speed(integer,boolean,double precision);
-- Gold Leaves (4).
drop function if exists public.arena_grant_leaves(uuid,integer,text,text,date);
drop function if exists public.arena_leaves();
drop function if exists public.arena_spend_leaves(uuid,integer,text,text,date);
drop function if exists public.arena_trade_leaves(integer);

-- 4. The tables, all in one statement so their links to each other need no
--    CASCADE.
drop table if exists
  public.arena_bistro_counter,
  public.arena_bistro_dines,
  public.arena_bistro_dish_lv,
  public.arena_bistro_dishes,
  public.arena_bistro_farm_sent,
  public.arena_bistro_items,
  public.arena_bistro_kinds,
  public.arena_bistro_league_claims,
  public.arena_bistro_likes,
  public.arena_bistro_market,
  public.arena_bistro_orders,
  public.arena_bistro_pantry,
  public.arena_bistro_paydays,
  public.arena_bistro_regular_steps,
  public.arena_bistro_regulars,
  public.arena_bistro_requests,
  public.arena_bistro_staff,
  public.arena_bistro_stored,
  public.arena_bistro_stove_store,
  public.arena_bistro_stoves,
  public.arena_bistro_week,
  public.arena_bistros,
  public.arena_farm_bakery_queue,
  public.arena_farm_bakery_recipes,
  public.arena_farm_balloons,
  public.arena_farm_barn,
  public.arena_farm_bonds,
  public.arena_farm_book_rewards,
  public.arena_farm_cows,
  public.arena_farm_crate_log,
  public.arena_farm_crops,
  public.arena_farm_decor,
  public.arena_farm_decor_credits,
  public.arena_farm_decor_items,
  public.arena_farm_decor_pieces,
  public.arena_farm_decor_set_items,
  public.arena_farm_decor_sets,
  public.arena_farm_dog_gifts,
  public.arena_farm_dog_hires,
  public.arena_farm_friend_days,
  public.arena_farm_gifts,
  public.arena_farm_goods,
  public.arena_farm_harvests,
  public.arena_farm_help_days,
  public.arena_farm_helpers,
  public.arena_farm_hens,
  public.arena_farm_invite_rewards,
  public.arena_farm_invites,
  public.arena_farm_likes,
  public.arena_farm_mastery,
  public.arena_farm_orders,
  public.arena_farm_party_days,
  public.arena_farm_perk_uses,
  public.arena_farm_plots,
  public.arena_farm_presence,
  public.arena_farm_purchases,
  public.arena_farm_requests,
  public.arena_farm_salt,
  public.arena_farm_seeds,
  public.arena_farm_sneaks,
  public.arena_farm_stall,
  public.arena_farm_stall_days,
  public.arena_farm_stall_sales,
  public.arena_farm_visits,
  public.arena_farm_weather_pin,
  public.arena_farm_wishes,
  public.arena_farms,
  public.arena_leaf_ledger,
  public.arena_leaf_wallets;

-- 5. The Farm's trigger functions.
drop function if exists public.arena_farm_crops_good();
drop function if exists public.arena_farm_plots_crow();
drop function if exists public.arena_farm_plots_giant_crow();

commit;

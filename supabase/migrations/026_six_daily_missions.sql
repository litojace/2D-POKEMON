-- Six distinct daily missions and five shared free changes per Pacific day.
-- Run after 025_mission_completion.sql. Safe to run again.
-- Keeps existing slots, progress, accumulated time, rewards and changes spent.
-- Already-earned daily/streak bonuses remain earned; new bonuses require all six.
begin;

alter table public.arena_mission_progress
  drop constraint if exists arena_mission_progress_slot_check;
alter table public.arena_mission_progress
  add constraint arena_mission_progress_slot_check check (slot between 0 and 5);
alter table public.arena_mission_days
  drop constraint if exists arena_mission_days_rerolls_used_check;
alter table public.arena_mission_days
  add constraint arena_mission_days_rerolls_used_check check (rerolls_used between 0 and 5);

create or replace function public.arena_ensure_missions(pid uuid, p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare v_social boolean; s record; next_id text;
begin
  insert into public.arena_mission_days(player_id, day, social)
  values (pid, p_day, public.arena_plays_with_people(pid, p_day)) on conflict do nothing;
  -- The day lock also serializes appending slots with rerolls and match results.
  select coalesce(social, true) into v_social from public.arena_mission_days
   where player_id = pid and day = p_day for update;
  for s in select * from (values
      (0, 'easy'), (1, 'medium'), (2, 'hard'),
      (3, 'easy'), (4, 'medium'), (5, 'hard')) slots(slot, tier) order by slot
  loop
    if exists (select 1 from public.arena_mission_progress
      where player_id = pid and day = p_day and slot = s.slot) then continue; end if;
    -- Keep the original three picks. The additional three are solo-friendly,
    -- so team players always have options without needing a party for every slot.
    select m.id into next_id from public.arena_missions m
     where m.active and m.tier = s.tier and (m.solo or (v_social and s.slot < 3))
       and not exists (select 1 from public.arena_mission_progress mp
         where mp.player_id = pid and mp.day = p_day and mp.mission_id = m.id)
     order by md5(p_day::text || ':' || m.id), m.id limit 1;
    if next_id is null then raise exception 'Not enough distinct daily missions'; end if;
    insert into public.arena_mission_progress(player_id, day, slot, mission_id)
    values (pid, p_day, s.slot, next_id);
  end loop;
end; $$;
revoke all on function public.arena_ensure_missions(uuid,date) from public, anon, authenticated, service_role;

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
revoke all on function public.arena_economy() from public, anon;
grant execute on function public.arena_economy() to authenticated;

create or replace function public.arena_mission_bump(pid uuid, p_day date, p_metric text, p_amount integer, p_character text)
returns void language plpgsql security definer set search_path = public as $$
declare row record; streak integer;
begin
  if p_amount <= 0 then return; end if;
  perform public.arena_ensure_missions(pid, p_day);
  -- Use the same lock order as mission changes; simultaneous results cannot lose progress.
  perform 1 from public.arena_mission_days where player_id = pid and day = p_day for update;
  for row in
    update public.arena_mission_progress mp
       set progress = least(m.target, mp.progress + case when p_metric = 'play-milliseconds'
             then (mp.time_remainder_ms + p_amount) / 60000 else p_amount end),
           time_remainder_ms = case when p_metric = 'play-milliseconds'
             then (mp.time_remainder_ms + p_amount) % 60000 else mp.time_remainder_ms end
      from public.arena_missions m
     where mp.player_id = pid and mp.day = p_day and not mp.done
       and m.id = mp.mission_id and (m.metric = p_metric
         or (m.metric = 'minutes' and p_metric = 'play-milliseconds'))
       and (m.champions is null or p_character = any(m.champions))
    returning mp.slot, mp.progress, m.target, m.coins
  loop
    if row.progress >= row.target then
      update public.arena_mission_progress set done = true
       where player_id = pid and day = p_day and slot = row.slot;
      perform public.arena_grant(pid, row.coins, 'mission', p_day::text || ':' || row.slot, p_day);
    end if;
  end loop;
  if (select count(*) from public.arena_mission_progress where player_id = pid and day = p_day and done) = 6
     and not (select bonus from public.arena_mission_days where player_id = pid and day = p_day) then
    update public.arena_mission_days set bonus = true where player_id = pid and day = p_day;
    perform public.arena_grant(pid, 50, 'missions-bonus', p_day::text, p_day);
    streak := public.arena_mission_streak(pid, p_day);
    if streak > 0 and streak % 7 = 0 then
      perform public.arena_grant(pid, 300, 'streak', p_day::text, p_day);
    end if;
  end if;
end; $$;

revoke all on function public.arena_mission_bump(uuid,date,text,integer,text) from public, anon, authenticated, service_role;

create or replace function public.arena_reroll_mission(p_slot integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); d date = public.arena_today();
  used integer; v_social boolean; current_id text; was_solo boolean;
  completed boolean; v_tier text; next_id text;
begin
  if me is null then raise exception 'Login required'; end if;
  if p_slot is null or p_slot not between 0 and 5 then
    raise exception 'Unknown mission';
  end if;
  perform public.arena_ensure_missions(me, d);
  -- Serialize changes across all six slots so rapid requests share one cap.
  select rerolls_used, coalesce(social, true) into used, v_social
    from public.arena_mission_days where player_id = me and day = d for update;
  if used >= 5 then raise exception 'You have used all 5 free mission changes today'; end if;
  select mission_id, done into current_id, completed
    from public.arena_mission_progress
   where player_id = me and day = d and slot = p_slot for update;
  if not found then raise exception 'Unknown mission'; end if;
  if completed then raise exception 'That mission is already done'; end if;
  select tier, solo into v_tier, was_solo from public.arena_missions where id = current_id;
  -- Continue through the daily order instead of toggling the first two picks.
  -- A social mission is always replaced by a solo-friendly one.
  select id into next_id from public.arena_missions
   where active and tier = v_tier and id <> current_id
     and (solo or (v_social and was_solo))
     and not exists (select 1 from public.arena_mission_progress mp
       where mp.player_id = me and mp.day = d and mp.mission_id = arena_missions.id)
   order by case when md5(d::text || ':' || id) > md5(d::text || ':' || current_id) then 0 else 1 end,
     md5(d::text || ':' || id), id limit 1;
  if next_id is null then raise exception 'No other mission today'; end if;
  update public.arena_mission_progress set mission_id = next_id, progress = 0, time_remainder_ms = 0
   where player_id = me and day = d and slot = p_slot;
  update public.arena_mission_days set rerolls_used = used + 1, rerolled = true
   where player_id = me and day = d;
  return public.arena_economy();
end; $$;

revoke all on function public.arena_reroll_mission(integer) from public, anon;
grant execute on function public.arena_reroll_mission(integer) to authenticated;
commit;

select
  position('(5, ''hard'')' in pg_get_functiondef('public.arena_ensure_missions(uuid,date)'::regprocedure)) > 0
    as six_daily_missions_enabled,
  position('''rerollLimit'', 5' in pg_get_functiondef('public.arena_economy()'::regprocedure)) > 0
    as five_free_changes_enabled,
  position('and done) = 6' in pg_get_functiondef('public.arena_mission_bump(uuid,date,text,integer,text)'::regprocedure)) > 0
    as all_six_streak_goal_enabled;

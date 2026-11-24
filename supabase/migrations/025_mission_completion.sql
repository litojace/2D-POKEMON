-- Mission completion audit: retain short-game time and count Boss Rush activity.
-- Run after 024_fast_bot_missions.sql. Safe to run again.
-- Preserves existing progress/rewards, the three-change allowance, fast bot
-- missions, PvP gates, result XP, weekly goals and ordinary raid-clear rules.
begin;

-- Whole minutes remain the public progress unit; retain unused milliseconds
-- on each active mission so rounding and changing one slot cannot erase another.
alter table public.arena_mission_progress
  add column if not exists time_remainder_ms integer not null default 0
    check (time_remainder_ms between 0 and 59999);

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
  if (select count(*) from public.arena_mission_progress where player_id = pid and day = p_day and done) = 3
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

create or replace function public.arena_record_activity_before_journey(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  pl jsonb; pid uuid; inserted integer;
  kind text = p->>'kind';
  rid text = p->>'id';
  d date = (p->>'day')::date;
  ch text; won boolean; people boolean; active numeric; raid jsonb;
  cleared boolean; peril integer; v_skin text;
  party integer = jsonb_array_length(p->'players');
begin
  if kind not in ('match', 'raid', 'expedition') or rid is null or d is null
     or jsonb_typeof(p->'players') <> 'array' or jsonb_array_length(p->'players') not between 1 and 4
     or d not between public.arena_today() - 1 and public.arena_today() + 1 then
    raise exception 'Invalid activity';
  end if;
  insert into public.arena_activity(id, kind, day) values (rid, kind, d) on conflict do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return; end if;
  for pl in select * from jsonb_array_elements(p->'players') loop
    pid = (pl->>'accountId')::uuid;
    if not exists (select 1 from public.arena_profiles where id = pid) then continue; end if;
    ch = pl->>'character';
    won = coalesce((pl->>'won')::boolean, false);
    people = coalesce((pl->>'vsPeople')::boolean, false);
    active = coalesce((pl->>'activeSeconds')::numeric, 0);
    raid = pl->'raid';
    cleared = kind = 'raid' and coalesce((raid->>'cleared')::boolean, false);
    peril = least(3, greatest(1, coalesce((raid->>'peril')::integer, 1)));
    perform public.arena_ensure_missions(pid, d);
    perform public.arena_mission_bump(pid, d, 'skill-uses', least(500, greatest(0, coalesce((pl->>'skillUses')::integer, 0))), ch);
    perform public.arena_mission_bump(pid, d, 'ults', least(50, greatest(0, coalesce((pl->>'ults')::integer, 0))), ch);
    -- Keep sub-minute time per mission, including short matches and Boss Rush.
    -- Preserve the existing 30-minute contribution limit per result.
    perform public.arena_mission_bump(pid, d, 'play-milliseconds',
      round(least(1800, greatest(0, active)) * 1000)::integer, ch);
    -- No minimum duration for completed bot matches; PvP keeps its existing gate.
    if kind = 'match' and (active >= 20
      or (active >= 0 and not people and pl->>'botLevel' in ('easy', 'normal', 'hard'))) then
      if people and (select count(*) from public.arena_coin_ledger
                      where player_id = pid and day = d and reason = 'pvp') < 10 then
        perform public.arena_grant(pid, case when won then 15 else 6 end, 'pvp', rid, d);
      end if;
      perform public.arena_mission_bump(pid, d, 'play', 1, ch);
      if won then
        if people then perform public.arena_mission_bump(pid, d, 'pvp-wins', 1, ch); end if;
        if pl->>'botLevel' = 'hard' then perform public.arena_mission_bump(pid, d, 'hard-bot-win', 1, ch); end if;
        perform public.arena_mission_bump(pid, d, 'wins-with', 1, ch);
        perform public.arena_mission_bump(pid, d, 'wins', 1, ch);
        if pl->>'botLevel' is not null then perform public.arena_mission_bump(pid, d, 'bot-wins', 1, ch); end if;
        if pl->>'mode' = 'ffa' and people then perform public.arena_mission_bump(pid, d, 'ffa-wins', 1, ch); end if;
        if pl->>'mode' = 'teams' and not coalesce((pl->>'knockedOut')::boolean, true) then
          perform public.arena_mission_bump(pid, d, 'teams-unharmed', 1, ch);
        end if;
      end if;
    end if;
    if kind = 'raid' then
      perform public.arena_mission_bump(pid, d, 'raid-play', 1, ch);
      perform public.arena_mission_bump(pid, d, 'revives', least(100, greatest(0, coalesce((raid->>'revives')::integer, 0))), ch);
      if cleared then
        if (select count(*) from public.arena_coin_ledger
             where player_id = pid and day = d and reason = 'raid') < 5 then
          perform public.arena_grant(pid, (array[30, 45, 60])[peril], 'raid', rid, d);
        end if;
        perform public.arena_mission_bump(pid, d, 'raid-clear', 1, ch);
        -- Alone or with friends (counting raiders with accounts).
        if party = 1 then
          perform public.arena_mission_bump(pid, d, 'raid-solo', 1, ch);
          if peril >= 2 then perform public.arena_mission_bump(pid, d, 'raid-solo-p2', 1, ch); end if;
        else
          perform public.arena_mission_bump(pid, d, 'raid-party', 1, ch);
        end if;
        if coalesce((raid->>'daily')::boolean, false) then
          perform public.arena_grant(pid, 50, 'daily-first', d::text, d);
          perform public.arena_mission_bump(pid, d, 'daily-clear', 1, ch);
        end if;
        if peril >= 3 then perform public.arena_mission_bump(pid, d, 'raid-peril3', 1, ch); end if;
        if coalesce((raid->>'flawless')::boolean, false) then perform public.arena_mission_bump(pid, d, 'raid-flawless', 1, ch); end if;
        if coalesce((raid->>'feat')::boolean, false) then perform public.arena_mission_bump(pid, d, 'feat', 1, ch); end if;
      end if;
    end if;
    -- Mythic Trials and Awakening count wins against people and raid clears.
    if (won and people and kind = 'match' and active >= 20) or cleared then
      insert into public.arena_champion_wins(player_id, champion, wins) values (pid, ch, 1)
      on conflict (player_id, champion) do update set wins = public.arena_champion_wins.wins + 1;
      v_skin = pl->>'skin';
      if v_skin is not null and exists (
          select 1 from public.arena_owned_items o join public.arena_shop_items i on i.id = o.item_id
           where o.player_id = pid and o.item_id = v_skin and i.kind = 'champion' and i.champion = ch) then
        insert into public.arena_skin_progress(player_id, skin_id, wins, peril3)
        values (pid, v_skin, 1, cleared and peril >= 3)
        on conflict (player_id, skin_id) do update
          set wins = public.arena_skin_progress.wins + 1,
              peril3 = public.arena_skin_progress.peril3 or excluded.peril3;
      end if;
    end if;
  end loop;
end; $$;

revoke all on function public.arena_record_activity_before_journey(jsonb) from public, anon, authenticated, service_role;

create or replace function public.arena_record_activity(p jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare pl jsonb; pid uuid; d date=(p->>'day')::date; w date; rid text=p->>'id'; k text=p->>'kind';
 eligible jsonb; inserted integer; amount integer; active numeric; clear boolean; peril integer; legs integer; q public.arena_weekly_goals; goal text; val integer; target integer;
begin
 if k is null or k not in ('match','raid','expedition') or rid is null or length(rid)>160 or d is null
 or jsonb_typeof(p->'players') is distinct from 'array' or jsonb_array_length(p->'players') not between 1 and 4
 or d not between public.arena_today()-1 and public.arena_today()+1 then raise exception 'Invalid activity'; end if;
 insert into public.arena_journey_receipts values(rid) on conflict do nothing;
 get diagnostics inserted=row_count; if inserted=0 then return; end if;
 -- Boss Rush contributes skills, ultimates and play time, never ordinary raid clears.
  -- Idle or departed seats cannot earn mission XP indirectly through a teammate.
  -- Keep placeholder seats so filtering an idle teammate cannot turn co-op into a solo clear.
  select jsonb_agg(case when not coalesce((x.value->>'abandoned')::boolean,false)
     and coalesce((x.value->>'participated')::boolean,true) then x.value else '{"accountId":null}'::jsonb end)
   into eligible from jsonb_array_elements(p->'players') as x(value);
  perform public.arena_record_activity_before_journey(p || jsonb_build_object('players',eligible));
 w=d-(extract(isodow from d)::int-1);
 for pl in select * from jsonb_array_elements(p->'players') loop
  pid=(pl->>'accountId')::uuid;
  if not exists(select 1 from public.arena_profiles where id=pid and not suspended) then continue; end if;
  active=coalesce((pl->>'activeSeconds')::numeric,0);
  if active<20 or coalesce((pl->>'abandoned')::boolean,false) or not coalesce((pl->>'participated')::boolean,true) then continue; end if;
  amount=0; legs=0;
  clear=coalesce((pl->'raid'->>'cleared')::boolean,false);
  peril=least(3,greatest(1,coalesce((pl->'raid'->>'peril')::int,1)));
  if k='match' then
   amount=case when coalesce((pl->>'vsPeople')::boolean,false) then 50+case when coalesce((pl->>'won')::boolean,false) then 25 else 0 end
               when pl->>'botLevel' is not null then 25 else 0 end;
  elsif k='raid' then
   amount=case when clear then (array[100,150,200])[peril] else 20*least(3,greatest(1,coalesce((pl->'raid'->>'phaseReached')::int,1))) end;
  elsif k='expedition' then
   legs=least(3,greatest(0,coalesce((pl->'expedition'->>'completed')::int,0)));
   amount=legs*80+case when legs=3 then 100 else 20 end;
   if legs>0 and (select count(*) from public.arena_coin_ledger where player_id=pid and day=d and reason='expedition')<3 then
    perform public.arena_grant(pid,legs*30+case when legs=3 then 50 else 0 end,'expedition',rid,d);
   end if;
  end if;
  perform public.arena_add_xp(pid,amount,k,rid,d);
  if amount<=0 then continue; end if;
  insert into public.arena_weekly_goals(player_id,week) values(pid,w) on conflict do nothing;
  update public.arena_weekly_goals set play=least(5,play+1),skills=least(50,skills+least(500,greatest(0,coalesce((pl->>'skillUses')::int,0)))),
   raids=least(2,raids+case when k='raid' and clear then 1 when k='expedition' then legs else 0 end),
   arcade=least(3,arcade+case when k='match' and pl->>'arcade' is not null then 1 else 0 end)
   where player_id=pid and week=w returning * into q;
  foreach goal in array array['play','skills','raids','arcade'] loop
   val=case goal when 'play' then q.play when 'skills' then q.skills when 'raids' then q.raids else q.arcade end;
   target=case goal when 'play' then 5 when 'skills' then 50 when 'raids' then 2 else 3 end;
   if val>=target and not goal=any(q.completed) then
    update public.arena_weekly_goals set completed=array_append(completed,goal) where player_id=pid and week=w;
    perform public.arena_add_season_xp(pid,250,'weekly:'||w||':'||goal,d);
   end if;
  end loop;
 end loop;
end; $$;

revoke all on function public.arena_record_activity(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_activity(jsonb) to service_role;

create or replace function public.arena_reroll_mission(p_slot integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  me uuid = auth.uid(); d date = public.arena_today();
  used integer; v_social boolean; current_id text; was_solo boolean;
  completed boolean; v_tier text; next_id text;
begin
  if me is null then raise exception 'Login required'; end if;
  if p_slot is null or p_slot not between 0 and 2 then
    raise exception 'Unknown mission';
  end if;
  perform public.arena_ensure_missions(me, d);
  -- Serialize changes across all three slots so rapid requests share one cap.
  select rerolls_used, coalesce(social, true) into used, v_social
    from public.arena_mission_days where player_id = me and day = d for update;
  if used >= 3 then raise exception 'You have used all 3 free mission changes today'; end if;
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
  position('play-milliseconds' in pg_get_functiondef(
    'public.arena_mission_bump(uuid,date,text,integer,text)'::regprocedure)) > 0
    as cumulative_mission_time_enabled,
  position('if k<>''expedition'' then' in pg_get_functiondef(
    'public.arena_record_activity(jsonb)'::regprocedure)) = 0
    and position('expedition' in pg_get_functiondef(
      'public.arena_record_activity_before_journey(jsonb)'::regprocedure)) > 0
    as boss_rush_activity_missions_enabled,
  has_function_privilege('service_role', 'public.arena_record_activity(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.arena_record_activity(jsonb)', 'execute')
    as trusted_activity_recording_only;

-- Completed bot matches count for daily missions at any duration.
-- Run after 023_three_mission_changes.sql. Safe to run again.
-- The journey wrapper still excludes abandoned/idle seats. PvP rewards,
-- result XP, weekly goals, Mythic Trials and raid progression retain their rules.
begin;

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
  if kind not in ('match', 'raid') or rid is null or d is null
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
    -- Time played, in whole minutes (at most 30 from one match or raid).
    perform public.arena_mission_bump(pid, d, 'minutes', least(30, greatest(0, floor(active / 60)::integer)), ch);
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
revoke all on function public.arena_record_activity_before_journey(jsonb)
  from public, anon, authenticated, service_role;

commit;

select
  position('active >= 0 and not people' in pg_get_functiondef(
    'public.arena_record_activity_before_journey(jsonb)'::regprocedure)) > 0 as fast_bot_missions_enabled,
  has_function_privilege('service_role', 'public.arena_record_activity(jsonb)', 'execute')
    and not has_function_privilege('authenticated', 'public.arena_record_activity(jsonb)', 'execute')
    as trusted_activity_recording_only;

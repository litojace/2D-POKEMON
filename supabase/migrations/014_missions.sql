-- Daily missions that fit how you play (design §10.4, extended).
-- Missions get a `solo` flag: false means it needs other people (a real
-- match, a 2v2, a free-for-all, a party raid). Players who haven't played a
-- match against people in the past 7 days are only given solo missions, and a
-- re-roll of a mission that needs people always lands on a solo one. The pool
-- grows from 15 to 30 missions, with new metrics for wins, bot wins, time
-- played, raids played, solo clears, party clears and free-for-all wins.
-- Missions already given out today are kept. Run after 013.
begin;

alter table public.arena_missions add column if not exists solo boolean not null default true;
-- Whether this player's missions that day may need other people.
alter table public.arena_mission_days add column if not exists social boolean;

-- Kept identical to MISSIONS in packages/shared/src/shop.ts (a unit test compares them).
insert into public.arena_missions(id, tier, text, metric, target, coins, champions, solo) values
  ('play-2', 'easy', 'Play 2 matches', 'play', 2, 40, null, true),
  ('raid-1', 'easy', 'Clear any raid', 'raid-clear', 1, 40, null, true),
  ('skills-30', 'easy', 'Use 30 skills', 'skill-uses', 30, 40, null, true),
  ('ults-3', 'easy', 'Use your ultimate 3 times', 'ults', 3, 40, null, true),
  ('win-1', 'easy', 'Win a match', 'wins', 1, 40, null, true),
  ('raid-play-1', 'easy', 'Finish a raid, win or lose', 'raid-play', 1, 40, null, true),
  ('minutes-10', 'easy', 'Play for 10 minutes', 'minutes', 10, 40, null, true),
  ('pvp-wins-2', 'medium', 'Win 2 matches against players', 'pvp-wins', 2, 70, null, false),
  ('daily-1', 'medium', 'Clear today''s Raid of the Day', 'daily-clear', 1, 70, null, true),
  ('revives-3', 'medium', 'Help revive 3 allies in raids', 'revives', 3, 70, null, false),
  ('earth-water', 'medium', 'Win a match as Terradon or Tidefin', 'wins-with', 1, 70, array['terradon', 'tidefin'], true),
  ('fire-light', 'medium', 'Win a match as Cindrake or Lumoth', 'wins-with', 1, 70, array['cindrake', 'lumoth'], true),
  ('electric-aura', 'medium', 'Win a match as Voltkit or Auralynx', 'wins-with', 1, 70, array['voltkit', 'auralynx'], true),
  ('psychic-shadow', 'medium', 'Win a match as Mystowl or Duskveil', 'wins-with', 1, 70, array['mystowl', 'duskveil'], true),
  ('hard-bot', 'medium', 'Beat a Hard bot', 'hard-bot-win', 1, 70, null, true),
  ('bot-wins-3', 'medium', 'Win 3 matches against bots', 'bot-wins', 3, 70, null, true),
  ('raids-2', 'medium', 'Clear 2 raids', 'raid-clear', 2, 70, null, true),
  ('raid-solo-1', 'medium', 'Clear a raid on your own', 'raid-solo', 1, 70, null, true),
  ('ults-8', 'medium', 'Use your ultimate 8 times', 'ults', 8, 70, null, true),
  ('raid-party', 'medium', 'Clear a raid with a friend', 'raid-party', 1, 70, null, false),
  ('raid-p3', 'hard', 'Clear any raid on Peril 3', 'raid-peril3', 1, 120, null, true),
  ('raid-flawless', 'hard', 'Clear a raid with no downs', 'raid-flawless', 1, 120, null, true),
  ('teams-unharmed', 'hard', 'Win a 2v2 without being knocked out', 'teams-unharmed', 1, 120, null, false),
  ('feat-1', 'hard', 'Complete a boss feat', 'feat', 1, 120, null, true),
  ('pvp-wins-5', 'hard', 'Win 5 matches against players', 'pvp-wins', 5, 120, null, false),
  ('hard-bots-3', 'hard', 'Beat 3 Hard bots', 'hard-bot-win', 3, 120, null, true),
  ('raids-3', 'hard', 'Clear 3 raids', 'raid-clear', 3, 120, null, true),
  ('raid-solo-p2', 'hard', 'Clear a raid on your own on Peril 2 or higher', 'raid-solo-p2', 1, 120, null, true),
  ('minutes-30', 'hard', 'Play for 30 minutes', 'minutes', 30, 120, null, true),
  ('ffa-win', 'hard', 'Win a free-for-all', 'ffa-wins', 1, 120, null, false)
on conflict (id) do update set tier = excluded.tier, text = excluded.text, metric = excluded.metric,
  target = excluded.target, coins = excluded.coins, champions = excluded.champions, solo = excluded.solo;

-- A day's mission for a tier (offset 1 = the next one), the same for everyone
-- who plays the same way.
create or replace function public.arena_daily_mission(p_day date, p_tier text, p_offset integer, p_social boolean)
returns text language sql stable security definer set search_path = public as $$
  select id from public.arena_missions where active and tier = p_tier and (solo or p_social)
   order by md5(p_day::text || ':' || id) offset p_offset limit 1
$$;
revoke all on function public.arena_daily_mission(date, text, integer, boolean) from public, anon, authenticated, service_role;
create or replace function public.arena_daily_mission(p_day date, p_tier text, p_offset integer)
returns text language sql stable security definer set search_path = public as $$
  select public.arena_daily_mission(p_day, p_tier, p_offset, true)
$$;

-- Has this player played a match against people in the past week?
create or replace function public.arena_plays_with_people(pid uuid, p_day date) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.arena_coin_ledger
                  where player_id = pid and reason = 'pvp' and day between p_day - 7 and p_day)
$$;
revoke all on function public.arena_plays_with_people(uuid, date) from public, anon, authenticated, service_role;

create or replace function public.arena_ensure_missions(pid uuid, p_day date) returns void
language plpgsql security definer set search_path = public as $$
declare v_social boolean;
begin
  insert into public.arena_mission_days(player_id, day, social)
  values (pid, p_day, public.arena_plays_with_people(pid, p_day)) on conflict do nothing;
  select coalesce(social, true) into v_social from public.arena_mission_days where player_id = pid and day = p_day;
  insert into public.arena_mission_progress(player_id, day, slot, mission_id)
  select pid, p_day, s.slot, public.arena_daily_mission(p_day, s.tier, 0, v_social)
    from (values (0, 'easy'), (1, 'medium'), (2, 'hard')) s(slot, tier)
   where public.arena_daily_mission(p_day, s.tier, 0, v_social) is not null
  on conflict do nothing;
end; $$;
revoke all on function public.arena_ensure_missions(uuid, date) from public, anon, authenticated, service_role;

-- One free re-roll a day. It never lands on the same mission, and replacing
-- one that needs other people always gives one you can do alone.
create or replace function public.arena_reroll_mission(p_slot integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare me uuid = auth.uid(); d date = public.arena_today(); v_tier text; current_id text; was_solo boolean;
  v_social boolean; next_id text;
begin
  if me is null then raise exception 'Login required'; end if;
  perform public.arena_ensure_missions(me, d);
  if (select rerolled from public.arena_mission_days where player_id = me and day = d) then
    raise exception 'You already re-rolled a mission today';
  end if;
  if exists (select 1 from public.arena_mission_progress where player_id = me and day = d and slot = p_slot and done) then
    raise exception 'That mission is already done';
  end if;
  v_tier = (array['easy', 'medium', 'hard'])[p_slot + 1];
  if v_tier is null then raise exception 'Unknown mission'; end if;
  select mp.mission_id, m.solo into current_id, was_solo
    from public.arena_mission_progress mp join public.arena_missions m on m.id = mp.mission_id
   where mp.player_id = me and mp.day = d and mp.slot = p_slot;
  select coalesce(social, true) into v_social from public.arena_mission_days where player_id = me and day = d;
  select id into next_id from public.arena_missions
   where active and tier = v_tier and id <> current_id
     and (solo or (v_social and was_solo))
   order by md5(d::text || ':' || id) limit 1;
  if next_id is null then raise exception 'No other mission today'; end if;
  update public.arena_mission_progress set mission_id = next_id, progress = 0
   where player_id = me and day = d and slot = p_slot;
  update public.arena_mission_days set rerolled = true where player_id = me and day = d;
  return public.arena_economy();
end; $$;
revoke all on function public.arena_reroll_mission(integer) from public, anon;
grant execute on function public.arena_reroll_mission(integer) to authenticated;

-- The game server's report of a finished match or raid (as in 010, plus the
-- new mission metrics).
create or replace function public.arena_record_activity(p jsonb) returns void
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
    if kind = 'match' and active >= 20 then
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
revoke all on function public.arena_record_activity(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_activity(jsonb) to service_role;

commit;

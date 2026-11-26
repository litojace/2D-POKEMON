-- A new player's first matches against a bot are short (one round, then
-- first to two: INTRO_ROUNDS in packages/shared/src/index.ts), and the first
-- one they win reaches level 2, where the first feature opens
-- (apps/client/src/feature-unlocks.ts).
--
-- A bot match's own XP is 25 (50 with the Daily Spark), and level 2 needs
-- 100. The day's missions often add the rest ("Win a match" is 50 more, and
-- its Spark), but not every day's six do, and one round against an Easy bot
-- can end inside the 20 seconds of play a match needs to earn anything. So
-- after a short match is won, an account still under level 2 gets the First
-- Win XP: what it lacks to reach level 2, and no more. With the Spark
-- doubling it the account ends at 199 XP at most, short of level 3 (225):
-- this never skips a level by itself.
--
-- The server marks such a match with "intro" (the round wins it needed) on
-- its player. An account at level 2 or above gets nothing, so it is paid at
-- most once per account, and never to an account that already played.
--
-- arena_record_activity is replaced in place (the wrapper from migration
-- 20261119170000, which pays the Quick Match bot's coins, with this added),
-- so this is safe to run again: nothing is renamed, and arena_add_xp pays
-- once per (player, source, ref).
begin;

create or replace function public.arena_record_activity(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  pl jsonb; pid uuid;
  rid text = p->>'id';
  d date = (p->>'day')::date;
  have bigint;
  need bigint = public.arena_level_threshold(2);
begin
  perform public.arena_record_activity_before_quick_bot(p);
  if p->>'kind' is distinct from 'match' or rid is null or d is null then return; end if;
  for pl in select * from jsonb_array_elements(p->'players') loop
    if pl->>'botLevel' is null
       or coalesce((pl->>'vsPeople')::boolean, false)
       or not coalesce((pl->>'won')::boolean, false)
       or coalesce((pl->>'abandoned')::boolean, false)
       or not coalesce((pl->>'participated')::boolean, true) then
      continue;
    end if;
    pid = (pl->>'accountId')::uuid;
    if not exists (select 1 from public.arena_profiles where id = pid) then continue; end if;
    -- Quick Match's fallback bot: 5 coins under the PvP cap (20261119170000).
    if pl->>'quick' = 'bot'
       and (select count(*) from public.arena_coin_ledger
            where player_id = pid and day = d and reason = 'pvp') < 10 then
      perform public.arena_grant(pid, 5, 'pvp', rid, d);
    end if;
    -- The First Win XP: a new player's short match tops them up to level 2.
    if pl->>'intro' is not null then
      have = coalesce((select xp from public.arena_player_xp where player_id = pid), 0);
      if have < need then
        perform public.arena_add_xp(pid, (need - have)::integer, 'first-win', rid, d);
      end if;
    end if;
  end loop;
end; $$;
revoke all on function public.arena_record_activity(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_activity(jsonb) to service_role;

commit;

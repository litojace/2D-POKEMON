-- Quick Match (docs/pvp-plan.md, item 4): a player who searched for a real
-- opponent, found nobody and beat the sparring bot instead earns 5 coins.
-- It shares the PvP coin cap (10 paid matches a day, reason 'pvp'), so it
-- never pays more than playing people would. Bot matches started from the
-- menu still pay only through missions (docs/raid-roster-design.md §10).
--
-- The server marks such a match with "quick": "bot" on each player. Safe to
-- run again: the rename happens once, the wrapper is replaced in place, and
-- arena_grant pays once per (player, reason, ref).
begin;

do $$ begin
  if to_regprocedure('public.arena_record_activity_before_quick_bot(jsonb)') is null then
    alter function public.arena_record_activity(jsonb) rename to arena_record_activity_before_quick_bot;
  end if;
end $$;
revoke all on function public.arena_record_activity_before_quick_bot(jsonb) from public, anon, authenticated, service_role;

create or replace function public.arena_record_activity(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare
  pl jsonb; pid uuid;
  rid text = p->>'id';
  d date = (p->>'day')::date;
begin
  perform public.arena_record_activity_before_quick_bot(p);
  if p->>'kind' is distinct from 'match' or rid is null or d is null then return; end if;
  for pl in select * from jsonb_array_elements(p->'players') loop
    if pl->>'quick' is distinct from 'bot'
       or pl->>'botLevel' is null
       or coalesce((pl->>'vsPeople')::boolean, false)
       or not coalesce((pl->>'won')::boolean, false)
       or coalesce((pl->>'abandoned')::boolean, false)
       or not coalesce((pl->>'participated')::boolean, true) then
      continue;
    end if;
    pid = (pl->>'accountId')::uuid;
    if not exists (select 1 from public.arena_profiles where id = pid) then continue; end if;
    if (select count(*) from public.arena_coin_ledger
        where player_id = pid and day = d and reason = 'pvp') < 10 then
      perform public.arena_grant(pid, 5, 'pvp', rid, d);
    end if;
  end loop;
end; $$;
revoke all on function public.arena_record_activity(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_activity(jsonb) to service_role;

commit;

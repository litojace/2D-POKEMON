-- Retire Boss Rush and Raid of the Day without removing earned progress.
-- The stable mission id keeps existing six-slot days, progress and payouts intact.
begin;

update public.arena_missions
set text = 'Clear a raid as Voltkit or Auralynx', metric = 'raid-clear',
    champions = array['voltkit', 'auralynx'], solo = true
where id = 'daily-1';

-- Preserve the proven ordinary reward paths behind service-only guards.
do $$ begin
  if to_regprocedure('public.arena_record_activity_before_mode_retirement(jsonb)') is null then
    alter function public.arena_record_activity(jsonb) rename to arena_record_activity_before_mode_retirement;
  end if;
  if to_regprocedure('public.arena_record_raid_before_mode_retirement(jsonb)') is null then
    alter function public.arena_record_raid(jsonb) rename to arena_record_raid_before_mode_retirement;
  end if;
  if to_regprocedure('public.arena_raid_progress_before_mode_retirement()') is null then
    alter function public.arena_raid_progress() rename to arena_raid_progress_before_mode_retirement;
  end if;
end $$;
revoke all on function public.arena_record_activity_before_mode_retirement(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.arena_record_raid_before_mode_retirement(jsonb) from public, anon, authenticated, service_role;
revoke all on function public.arena_raid_progress_before_mode_retirement() from public, anon, authenticated, service_role;

create or replace function public.arena_record_activity(p jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p->>'kind' is null or p->>'kind' not in ('match', 'raid') then
    raise exception 'This activity mode has been retired';
  end if;
  if jsonb_typeof(p->'players') = 'array' and exists (
    select 1 from jsonb_array_elements(p->'players') pl
    where coalesce((pl->'raid'->>'daily')::boolean, false)
  ) then raise exception 'Daily raids have been retired'; end if;
  perform public.arena_record_activity_before_mode_retirement(p);
end; $$;
revoke all on function public.arena_record_activity(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_activity(jsonb) to service_role;

create or replace function public.arena_record_raid(p_receipt jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  if coalesce((p_receipt->>'daily')::boolean, false) then
    raise exception 'Daily raids have been retired';
  end if;
  perform public.arena_record_raid_before_mode_retirement(p_receipt);
end; $$;
revoke all on function public.arena_record_raid(jsonb) from public, anon, authenticated;
grant execute on function public.arena_record_raid(jsonb) to service_role;

create or replace function public.arena_raid_progress() returns jsonb
language sql security definer set search_path = public as $$
  select public.arena_raid_progress_before_mode_retirement() - 'today' - 'dailyClears'
$$;
revoke all on function public.arena_raid_progress() from public, anon;
grant execute on function public.arena_raid_progress() to authenticated;

notify pgrst, 'reload schema';
commit;

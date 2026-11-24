-- Three free mission changes per Pacific calendar day, shared across slots.
-- Run after 022_player_journey.sql. Safe to run again.
begin;

alter table public.arena_mission_days
  add column if not exists rerolls_used integer not null default 0
    check (rerolls_used between 0 and 3);
-- Preserve the single change already spent under the old allowance.
update public.arena_mission_days set rerolls_used = 1
 where rerolled and rerolls_used = 0;

-- Retain the legacy flag for older clients, plus admin and journey state.
create or replace function public.arena_economy() returns jsonb
language plpgsql security definer set search_path = public as $$
declare e jsonb;
begin
  e = public.arena_economy_before_journey();
  return e || jsonb_build_object(
    'journey', public.arena_journey(),
    'rerollsUsed', coalesce((select rerolls_used from public.arena_mission_days
      where player_id = auth.uid() and day = public.arena_today()), 0),
    'rerollLimit', 3);
end; $$;
revoke all on function public.arena_economy() from public, anon;
grant execute on function public.arena_economy() to authenticated;

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
  update public.arena_mission_progress set mission_id = next_id, progress = 0
   where player_id = me and day = d and slot = p_slot;
  update public.arena_mission_days set rerolls_used = used + 1, rerolled = true
   where player_id = me and day = d;
  return public.arena_economy();
end; $$;
revoke all on function public.arena_reroll_mission(integer) from public, anon;
grant execute on function public.arena_reroll_mission(integer) to authenticated;

commit;

select
  exists (select 1 from information_schema.columns where table_schema = 'public'
    and table_name = 'arena_mission_days' and column_name = 'rerolls_used') as mission_change_counter_enabled,
  position('rerollLimit' in pg_get_functiondef('public.arena_economy()'::regprocedure)) > 0 as mission_change_allowance_enabled;

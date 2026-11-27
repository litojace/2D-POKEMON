-- The Lobby tour (apps/client/src/hub-tour.ts, docs/onboarding.md): whether
-- a player finished or skipped it, and how far they got, kept with the
-- account. Another device then doesn't show it again, and the new-player
-- funnel (docs/player-funnel.md) can count who skips and where.
-- Run after 20261120140000_match_history.sql. Safe to run again.
--
-- It lives on arena_preferences (migration 108): one row per player, read
-- and written only through the two functions below.
begin;

alter table public.arena_preferences add column if not exists tour text;
alter table public.arena_preferences add column if not exists tour_reached smallint;
alter table public.arena_preferences add column if not exists tour_at timestamptz;
do $$ begin
 if not exists (
  select 1 from pg_constraint
  where conname = 'arena_preferences_tour_check'
   and conrelid = 'public.arena_preferences'::regclass
 ) then
  alter table public.arena_preferences add constraint arena_preferences_tour_check
   check (tour in ('done', 'skipped') and tour_reached between 0 and 20);
 end if;
end $$;

-- How your tour ended ('done' or 'skipped'), or null if it never has.
create or replace function public.arena_my_tour() returns text
language plpgsql stable security definer set search_path='' as $$
declare saved text;
begin
 perform public.arena_require_player();
 select tour into saved from public.arena_preferences where user_id=auth.uid();
 return saved;
end; $$;

-- Keep how your tour ended and how many steps you saw. A replay that ends
-- differently replaces it.
create or replace function public.arena_save_tour(p_result text, p_reached int)
returns void
language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_player();
 if coalesce(p_result, '') not in ('done', 'skipped') then
  raise exception 'That is not how a tour ends.'; end if;
 if p_reached is null or p_reached < 0 or p_reached > 20 then
  raise exception 'That is not a tour step.'; end if;
 insert into public.arena_preferences(user_id, tour, tour_reached, tour_at, updated_at)
  values (auth.uid(), p_result, p_reached, now(), now())
  on conflict (user_id) do update set
   tour = excluded.tour,
   tour_reached = excluded.tour_reached,
   tour_at = excluded.tour_at,
   updated_at = excluded.updated_at;
end; $$;

revoke all on function public.arena_my_tour(), public.arena_save_tour(text, int)
 from public, anon, authenticated;
grant execute on function public.arena_my_tour(), public.arena_save_tour(text, int)
 to authenticated;
commit;
notify pgrst, 'reload schema';

-- In-game chat: an admin can stop a player chatting for a while
-- (docs/chat-plan.md). Run after 20261114095946_boss_identity_refresh.sql.
-- Safe to run again.
--
-- Chat itself is not stored: party, room and Nearby lines live only in the
-- game server's memory. A report copies the lines it is about into
-- arena_reports (its context), as reports always have. This adds:
--   - arena_chat_restrictions: until when a player may not type in chat
--     (quick chat stays open to them);
--   - arena_admin_chat_ban(player, hours, reason): an admin sets it, or lifts
--     it with 0 hours;
--   - arena_chat_stopped_until(player): the game server reads it (service
--     role only).
-- Until this runs, the game works as before: nobody is stopped, and the
-- admin's button says the database needs this update.

begin;

create table if not exists public.arena_chat_restrictions (
  player uuid primary key references public.arena_profiles(id) on delete cascade,
  until timestamptz not null,
  reason text check (reason is null or char_length(reason) <= 300),
  set_by uuid references public.arena_profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.arena_chat_restrictions enable row level security;
revoke all on public.arena_chat_restrictions from anon, authenticated;

-- An admin stops (or, with 0 hours, lets again) a player chatting.
create or replace function public.arena_admin_chat_ban(p_player uuid, p_hours integer, p_reason text)
returns void language plpgsql security definer set search_path='' as $$
begin
 perform public.arena_require_admin();
 if p_player is null or not exists (select 1 from public.arena_profiles where id = p_player) then
  raise exception 'Player not found';
 end if;
 if p_hours is null or p_hours < 0 or p_hours > 24 * 365 then
  raise exception 'Choose 0 to 8760 hours';
 end if;
 if p_hours = 0 then
  delete from public.arena_chat_restrictions where player = p_player;
  return;
 end if;
 insert into public.arena_chat_restrictions(player, until, reason, set_by)
 values (p_player, now() + make_interval(hours => p_hours), left(p_reason, 300), auth.uid())
 on conflict (player) do update set until = excluded.until, reason = excluded.reason,
   set_by = excluded.set_by, created_at = now();
end; $$;

-- Until when this player may not type (null: they may). The game server asks.
create or replace function public.arena_chat_stopped_until(p_player uuid)
returns timestamptz language sql stable security definer set search_path='' as $$
 select until from public.arena_chat_restrictions
  where player = p_player and until > now();
$$;

revoke all on function public.arena_admin_chat_ban(uuid, integer, text),
 public.arena_chat_stopped_until(uuid) from public, anon, authenticated;
grant execute on function public.arena_admin_chat_ban(uuid, integer, text) to authenticated;
grant execute on function public.arena_chat_stopped_until(uuid) to service_role;
commit;
notify pgrst, 'reload schema';

-- The avatar library grows to 77 (packages/shared/src/avatars.ts): the
-- second batch's 25 (Expressions, ea-avatar-053 … ea-avatar-077) join the
-- 52 of 20261119100000_player_avatars.sql, which all stay. Only the id
-- check changes, on the column and in arena_set_avatar (its body as 100's).
-- Run after 20261119150000_bistro_league_ids.sql. Safe to run again.

begin;

alter table public.arena_profiles drop constraint if exists arena_profiles_avatar_check;
alter table public.arena_profiles add constraint arena_profiles_avatar_check
  check (
    avatar is null
    or avatar ~ '^ea-avatar-0(0[1-9]|[1-6][0-9]|7[0-7])$'
    or avatar ~ '^photo:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  );

create or replace function public.arena_set_avatar(p_avatar text) returns text
language plpgsql security definer set search_path = '' as $$
begin
 perform public.arena_require_player();
 if p_avatar is null or p_avatar !~ '^ea-avatar-0(0[1-9]|[1-6][0-9]|7[0-7])$' then
  raise exception 'Choose an avatar from the library.' using errcode = '22023';
 end if;
 update public.arena_profiles set avatar = p_avatar where id = auth.uid();
 return p_avatar;
end; $$;
revoke all on function public.arena_set_avatar(text) from public, anon;
grant execute on function public.arena_set_avatar(text) to authenticated;

commit;
